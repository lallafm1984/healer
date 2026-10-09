/**
 * 자동 밸런스 (38 0-6): 장소 × 난이도마다 기준 조건으로 자동 힐러를 돌려 클리어율을 재고, 목표 밖이면
 * 피해 배율(tune.dmg)을 찾아 data/tune.ts에 적는다. 명령줄은 scripts/balance.ts (npm run balance).
 * 기준 조건 (26 9-2, Lim 2026-10-07 「추천으로 모두」): 열림 레벨 (난이도만 잠긴 건 그 레벨), 그 레벨에서 열린 특성
 * (사제는 빌드 A·B·C 번갈아, 드루이드·성기사는 임시 보정), 공개모집 파티원 능력 1개, 권장 장비 (쉬움·보통 없음, 어려움 고급, 악몽 희귀 +5),
 * 단축칸 마나·생명 물약, 던전은 그 레벨의 난이도 어픽스. 세 직업 평균.
 * 목표 (26 9-2): 보통 거의 100% (95% 아래면 낮춤), 어려움 약 85%, 악몽 약 75%. 38 0-6에 처음 적은 「보통 85 · 어려움 60~70」은
 * 악몽보다 어려움이 어려워지는 숫자라 9-2로 맞춤 (2026-10-09).
 */
import { diffAffixes, type AffixKey } from '../data/affixes';
import { ALL_DIFFS, CONTENT, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import type { GearId } from '../data/gear';
import { HERO_KEYS, type HeroKey } from '../data/heroes';
import type { ItemKey } from '../data/items';
import { TALENTS } from '../data/talents';
import type { Tune, TuneTable } from '../data/tune';
import { autoHealer } from '../engine/auto';
import { restCarry } from '../engine/dungeon';
import { create, recruitParty, step } from '../engine/fight';
import type { Carry } from '../engine/types';

/** 목표 클리어율 (%). 쉬움·보통은 아래 선만 (넘으면 그대로), 어려움·악몽은 min~max 안. aim = 배율을 찾을 때 겨누는 값 */
export const TARGET: Record<DiffName, { min: number; max: number; aim: number }> = {
  '쉬움': { min: 98, max: 100, aim: 99 },
  '보통': { min: 95, max: 100, aim: 97 },
  '어려움': { min: 78, max: 92, aim: 85 },
  '악몽': { min: 68, max: 82, aim: 75 },
};
/** 권장 장비 (data/equipment RECOMMENDED: 어려움 고급, 악몽 희귀 +5) */
export const STD_GEAR: Record<DiffName, GearId> = { '쉬움': 'none', '보통': 'none', '어려움': 'adv0', '악몽': 'rare5' };
const ITEMS: ItemKey[] = ['mana', 'life'];
/** 던전 구간 사이 휴식 (초, scripts/sim-dungeon과 같음) */
const REST = 10;
const MAX_T = 700;
/** 찾는 배율 범위 */
const LO = 0.4, HI = 3;

/** 맞출 장소: 만든 것만 (튜토리얼 첫 전투·자리 표시 예시는 뺌) */
export const balanceable = (c: ContentDef) => c.ready && !c.hidden && !c.sample && c.fights('보통').length > 0;

export interface Std { lv: number; gear: GearId; affixes: AffixKey[] }
export function standard(c: ContentDef, d: DiffName): Std {
  const lv = stageOf(c, d);
  return { lv, gear: STD_GEAR[d], affixes: c.kind === 'dungeon' ? diffAffixes(d, lv) : [] };
}

/** 사제 특성: 열린 단만, 빌드 b = 0·1·2 칸 (scripts/sim-raids와 같음) */
const build = (lv: number, b: number) => TALENTS.map(t => (t.lv <= lv ? b : null));

export interface Run { win: boolean; time: number; reason: string }
/** 한 판: 장소의 구간을 차례로 (구간 사이 휴식, 파티는 첫 구간에서 뽑은 그대로). tune을 주면 모든 구간에 그 값 (data/tune 대신) */
export function runOnce(c: ContentDef, d: DiffName, hero: HeroKey, seed: number, tune?: Tune): Run {
  const segs = c.fights(d), s = standard(c, d);
  const party = recruitParty(segs[0], seed, { abilities: true });
  let carry: Carry | undefined, time = 0;
  for (let i = 0; i < segs.length; i++) {
    const f = create({
      encounter: segs[i], diff: d, gear: s.gear, seed: seed + i * 7919, items: ITEMS, hero, level: s.lv, heroLv: s.lv, stageLv: s.lv,
      talents: hero === 'priest' ? build(s.lv, seed % 3) : undefined, party, affixes: s.affixes.length ? s.affixes : undefined, carry, tune,
    });
    while (!f.over && f.t < MAX_T) { autoHealer(f); step(f); f.events.length = 0; }
    time += f.t;
    if (f.over !== 'win') return { win: false, time, reason: f.over ? f.reason : '시간 초과' };
    carry = restCarry(f, REST);
  }
  return { win: true, time, reason: '' };
}

export interface Measure {
  /** 세 직업 평균 클리어율 (%) */
  rate: number;
  byHero: Record<HeroKey, number>;
  /** 이긴 판 평균 시간 (초) */
  time: number;
  /** 진 이유별 판 수 */
  fails: Record<string, number>;
}
/** 직업마다 시드 1~n으로 돌림 (같은 시드라 배율을 바꿔 가며 재도 흔들림이 적음) */
export function measure(c: ContentDef, d: DiffName, n: number, tune?: Tune): Measure {
  const byHero = {} as Record<HeroKey, number>, fails: Record<string, number> = {};
  let wins = 0, time = 0;
  for (const h of HERO_KEYS) {
    let w = 0;
    for (let s = 1; s <= n; s++) {
      const r = runOnce(c, d, h, s, tune);
      if (r.win) { w++; time += r.time; } else fails[r.reason] = (fails[r.reason] || 0) + 1;
    }
    byHero[h] = Math.round((100 * w) / n);
    wins += w;
  }
  return { rate: (100 * wins) / (n * HERO_KEYS.length), byHero, time: wins ? time / wins : 0, fails };
}

/**
 * 클리어율이 aim에 가장 가까운 피해 배율. 배율이 클수록 클리어율이 낮다고 보고 로그 눈금에서 반으로 나눠 찾음.
 * rate = 배율 → 클리어율 (%). 배율은 0.01 단위
 */
export function findDmg(rate: (dmg: number) => number, aim: number, lo = LO, hi = HI, iters = 9): { dmg: number; rate: number } {
  let best = { dmg: 1, rate: -1, gap: Infinity };
  for (let i = 0; i < iters && hi - lo > 0.015; i++) {
    const mid = Math.round(Math.sqrt(lo * hi) * 100) / 100;
    const r = rate(mid), gap = Math.abs(r - aim);
    if (gap <= best.gap) best = { dmg: mid, rate: r, gap }; // 같으면 나중 값 (경계에 더 가까움)
    if (gap <= 1) break;
    if (r > aim) lo = mid; else hi = mid;
  }
  return { dmg: best.dmg, rate: best.rate };
}

/** 장소의 지금 보정: 모든 구간이 같은 값이면 그 값 ({} = 보정 없음), 구간마다 다르면 null */
export function placeTune(t: TuneTable, c: ContentDef, d: DiffName): Tune | null {
  const vals = [...new Set(c.fights(d))].map(k => t[k]?.[d] ?? {});
  const same = vals.every(v => v.dmg === vals[0].dmg && v.hp === vals[0].hp);
  return same ? { ...vals[0] } : null;
}

export type Verdict = 'ok' | 'easy' | 'hard';
export const verdictOf = (d: DiffName, rate: number): Verdict => (rate < TARGET[d].min ? 'hard' : rate > TARGET[d].max ? 'easy' : 'ok');

export interface Row {
  key: ContentKey;
  name: string;
  diff: DiffName;
  std: Std;
  /** 지금 보정 (null = 구간마다 다름) */
  cur: Tune | null;
  now: Measure;
  verdict: Verdict;
  /** 목표 밖이라 찾은 새 피해 배율과 그때 결과 */
  next?: { dmg: number; m: Measure };
}

/** 장소 하나 · 난이도 하나: 지금 값으로 재고, 목표 밖이면 (search) 피해 배율을 찾음 */
export function balanceOne(t: TuneTable, c: ContentDef, d: DiffName, n: number, search = true): Row {
  const cur = placeTune(t, c, d);
  let now = measure(c, d, n), verdict = verdictOf(d, now.rate);
  // 목표 밖이면 판 수를 두 배로 다시 재서 확인 (선 근처의 흔들림으로 값을 자꾸 바꾸지 않게)
  if (search && verdict !== 'ok') { now = measure(c, d, n * 2); verdict = verdictOf(d, now.rate); }
  const row: Row = { key: c.key, name: c.name, diff: d, std: standard(c, d), cur, now, verdict };
  if (!search || verdict === 'ok') return row;
  const base = cur ?? {};
  const seen = new Map<number, Measure>();
  const at = (dmg: number) => { if (!seen.has(dmg)) seen.set(dmg, measure(c, d, n, { ...base, dmg })); return seen.get(dmg)!.rate; };
  // 쉬움·보통은 아래 선만: 지금보다 쉽게만 (지금 배율 아래에서 찾음)
  const curDmg = base.dmg ?? 1;
  const hi = TARGET[d].max >= 100 ? curDmg : HI;
  const r = findDmg(at, TARGET[d].aim, LO, hi);
  row.next = { dmg: r.dmg, m: seen.get(r.dmg)! };
  return row;
}

/** 찾은 값을 표에 넣음: 장소의 모든 구간 · 그 난이도에 같은 피해 배율 (1이면 지움) */
export function applyRows(t: TuneTable, rows: Row[]): TuneTable {
  const out: TuneTable = JSON.parse(JSON.stringify(t));
  for (const r of rows) {
    if (!r.next) continue;
    const c = CONTENT.find(x => x.key === r.key)!;
    for (const seg of new Set(c.fights(r.diff))) {
      const e: Tune = { ...(out[seg]?.[r.diff] ?? {}), dmg: r.next.dmg };
      if (e.dmg === 1) delete e.dmg;
      const row = (out[seg] ??= {});
      if (Object.keys(e).length) row[r.diff] = e; else delete row[r.diff];
      if (!Object.keys(row).length) delete out[seg];
    }
  }
  return out;
}

const fmtTune = (x: Tune) => [x.dmg != null ? `dmg: ${x.dmg}` : '', x.hp != null ? `hp: ${x.hp}` : ''].filter(Boolean).join(', ');
/** TUNE 표를 data/tune.ts 모양 글로 (전투 순서 = ENCOUNTERS 순서, 난이도 순서 고정) */
export function renderTune(t: TuneTable): string {
  const lines = (Object.keys(ENCOUNTERS) as EncounterKey[]).filter(k => t[k] && Object.keys(t[k]!).length).map(k => {
    const v = t[k]!;
    return `  ${k}: { ${ALL_DIFFS.filter(d => v[d]).map(d => `'${d}': { ${fmtTune(v[d]!)} }`).join(', ')} },`;
  });
  return `export const TUNE: TuneTable = {\n${lines.join('\n')}\n};\n`;
}
/** data/tune.ts 내용에서 TUNE 부분만 바꿈 (위 설명·타입은 그대로) */
export function rewriteTuneFile(src: string, t: TuneTable): string {
  const i = src.indexOf('export const TUNE');
  if (i < 0) throw new Error('data/tune.ts에 export const TUNE이 없음');
  return src.slice(0, i) + renderTune(t);
}
