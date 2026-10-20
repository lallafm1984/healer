/**
 * 자동 밸런스 (38 0-6): 장소 × 난이도마다 기준 조건으로 자동 힐러를 돌려 클리어율을 재고, 목표 밖이면
 * 피해 배율(tune.dmg)을 찾아 data/tune.ts에 적는다. 명령줄은 scripts/balance.ts (npm run balance).
 * 기준 조건 (26 9-2, Lim 2026-10-07 「추천으로 모두」): 열림 레벨 (난이도만 잠긴 건 그 레벨), 그 레벨에서 열린 특성
 * (세 직업 모두 빌드 A·B·C 번갈아, 77. 예전 드루이드·성기사는 임시 보정), 공개모집 파티원 능력 1개, 권장 장비 (쉬움·보통 없음, 어려움 고급, 악몽 희귀 × 1.4, 91)와
 * 그 등급의 대표 특수능력 (data/gear GEAR_SPECS, 42 1-7),
 * 던전은 그 레벨의 난이도 어픽스. 세 직업 평균.
 * 목표: 장소 레벨 곡선 (아래 CURVE, #304 · 103 「난이도 곡선」). 쉬움은 TARGET 그대로, 장소를 모르면 TARGET (예전 평평한 목표 보통 97 · 어려움 85 · 악몽 75).
 * 바쁨 하한 (Lim 2026-10-10 「초반에도 힐러가 충분히 바빠야 재미 있는데 조작이 너무 한가하다」): 쉬움 · 보통은 클리어율이 목표 안이어도
 * 받는 피해가 치유 한 번 크기로 분당 BUSY번이 안 되면 피해 배율을 올림 (클리어율이 목표값 아래로 가지 않는 만큼만).
 * 순차 레벨링 구간 (70, 장소 Lv 20까지) 어려움 · 악몽은 권장 장비 대신 그 난이도가 처음 열린 플레이어의 레벨 · 드롭 장비 (sim/ramp, 2026-10-13 Lim
 * 「Lv 1 어려움이 자동 힐로 안 깨짐」: 권장 장비로는 녹슨 고원 어려움 80%, 실제 Lv 3 · 장비 1~2개로는 3%).
 */
import { diffAffixes, type AffixKey } from '../data/affixes';
import { ALL_DIFFS, CONTENT, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { gearStatsOf, specsOf } from '../data/equipment';
import { classSpecs, presetSpecs, type GearId } from '../data/gear';
import type { HeroKey } from '../data/heroes';
import { TALENTS } from '../data/talents';
import type { Tune, TuneTable } from '../data/tune';
import { autoHealer } from '../engine/auto';
import { restCarry } from '../engine/dungeon';
import { create, recruitParty, step } from '../engine/fight';
import type { Carry, Fight, RosterEntry } from '../engine/types';
import { SKILLS } from '../data/skills';
import { rampLevel, rampPlayer, usesRamp } from './ramp';

/** 목표 클리어율 (%). 쉬움·보통은 아래 선만 (넘으면 그대로), 어려움·악몽은 min~max 안. aim = 배율을 찾을 때 겨누는 값 */
export const TARGET: Record<DiffName, { min: number; max: number; aim: number }> = {
  '쉬움': { min: 98, max: 100, aim: 99 },
  '보통': { min: 95, max: 100, aim: 97 },
  '어려움': { min: 78, max: 92, aim: 85 },
  '악몽': { min: 68, max: 82, aim: 75 },
};
/**
 * 장소 레벨 곡선 (2026-10-19 Lim 「난이도 벨런스는 초반 쉽게 후반 어렵게」, 기획 103): 장소 레벨 (stageOf) 구간 Lv 1~20 · 21~45 · 46~70 · 71~100의 목표값을
 * 구간 가운데 (CURVE_LV)에 두고 사이는 직선, 끝 밖은 그대로. 보통은 아래 선만 (목표 − 2), 어려움 · 악몽은 목표 ± 7. 쉬움은 TARGET 그대로.
 * 예전 「순차 구간 Lv 10~20 장소 악몽 = 어려움 목표」 (92)는 이 곡선이 대신함 (Lv 20 악몽 목표 85 안팎 = 예전 어려움 목표)
 */
export const CURVE_LV = [10.5, 33, 58, 85.5];
export const CURVE: Partial<Record<DiffName, number[]>> = { '보통': [99, 97, 96, 94], '어려움': [92, 87, 82, 77], '악몽': [85, 78, 72, 65] };
export const CURVE_BAND = { low: 2, band: 7 };
export function aimAt(d: DiffName, lv: number): number {
  const ys = CURVE[d];
  if (!ys) return TARGET[d].aim;
  if (lv <= CURVE_LV[0]) return ys[0];
  for (let i = 1; i < CURVE_LV.length; i++) if (lv <= CURVE_LV[i]) { const t = (lv - CURVE_LV[i - 1]) / (CURVE_LV[i] - CURVE_LV[i - 1]); return Math.round((ys[i - 1] + (ys[i] - ys[i - 1]) * t) * 10) / 10; }
  return ys[ys.length - 1];
}
/** 칸의 목표 = 그 장소 · 난이도의 장소 레벨 곡선 (장소를 모르면 TARGET) */
export const targetOf = (c: ContentDef | undefined, d: DiffName): { min: number; max: number; aim: number } => {
  if (!c || !CURVE[d]) return TARGET[d];
  const aim = aimAt(d, stageOf(c, d));
  return lowerOnly(d) ? { min: aim - CURVE_BAND.low, max: 100, aim } : { min: aim - CURVE_BAND.band, max: aim + CURVE_BAND.band, aim };
};
/**
 * 바쁨 하한 (쉬움 · 보통): 파티가 받는 피해 ÷ 치유 한 번 (사제 치유, 지능의 100%)을 분당. GCD 1.5초면 분당 40번이 끝이라
 * 보통 24 = 피해만 따라가도 GCD의 60%, 넘친 치유 · 해제까지 치면 거의 쉬지 않고 누름. 쉬움은 그 0.8 (난이도 피해 배율과 같은 비)
 */
export const BUSY: Partial<Record<DiffName, number>> = { '쉬움': 19, '보통': 24 };
/** 권장 장비 (data/equipment RECOMMENDED: 어려움 고급, 악몽 희귀 +5) */
export const STD_GEAR: Record<DiffName, GearId> = { '쉬움': 'none', '보통': 'none', '어려움': 'adv0', '악몽': 'rare5' };
/** 던전 구간 사이 휴식 (초, scripts/sim-dungeon과 같음) */
const REST = 10;
const MAX_T = 700 * 1.25; // 한 판 끝 (초): 광폭화 배율 (ENRAGE_MULT, 102)만큼 함께 늘림
/** 찾는 배율 범위 */
const LO = 0.4, HI = 3;

/** 맞출 장소: 만든 것만 (튜토리얼 첫 전투는 뺌) */
export const balanceable = (c: ContentDef) => c.ready && !c.hidden && c.fights('보통').length > 0;

/** 기준 조건: lv = 적 레벨, gear = 장비 (ramp = 순차 레벨링 기준 플레이어의 드롭 장비, 시드마다), heroLv = 내 레벨 (없으면 적 레벨) */
export interface Std { lv: number; gear: GearId | 'ramp'; affixes: AffixKey[]; heroLv?: number }
export function standard(c: ContentDef, d: DiffName): Std {
  const lv = stageOf(c, d), affixes = c.kind === 'dungeon' ? diffAffixes(d, lv) : [];
  return usesRamp(c, d) ? { lv, gear: 'ramp', affixes, heroLv: rampLevel(c, d) } : { lv, gear: STD_GEAR[d], affixes };
}
/** 기준 조건 한 줄 (적 레벨 · 내 레벨 · 장비) */
export const stdLabel = (s: Std) => `Lv ${String(s.lv).padStart(3)}${s.heroLv != null ? ` (내 Lv ${s.heroLv})` : ''} [${s.gear === 'ramp' ? '드롭 장비' : s.gear}${s.affixes.length ? ` · ${s.affixes.join('+')}` : ''}]`;

/** 특성: 열린 단만, 빌드 b = 0·1·2 칸 (세 직업 같은 단 구조, scripts/sim-raids와 같음) */
const build = (lv: number, b: number) => TALENTS.map(t => (t.lv <= lv ? b : null));

export interface Run {
  win: boolean;
  time: number;
  reason: string;
  /** 파티가 받은 피해를 치유 한 번 크기로 나눈 값 (구간 합) */
  heals: number;
  /** 어그로 (96): 딜러가 · 내가 뺏은 횟수 (구간 합) */
  steals?: number;
  healerSteals?: number;
  /** 어그로 보정용: 딜러 · 나의 위협 ÷ 탱커 위협 평균 (첫 구간) */
  thrRatio?: { d: number; me: number };
  /** 진 판: 끝난 구간에 남은 보스 체력 몫 · 살아 있던 딜러 수 (시간 초과가 「못 잡는 보스」인지 「딜러가 다 쓰러지고 탱커 · 힐러만 버팀」인지) */
  bossLeft?: number;
  dealersLeft?: number;
  dealers?: number;
}
/** 특수능력 프리셋: common = 대표 공통 특수능력 (GEAR_SPECS), class = 그 직업 전용 특수능력 (classSpecs, 79 전용장비 밸런스) */
export type SpecMode = 'common' | 'class';
/** sim 손잡이 (기준 판에서 바꿔 보기, 96 어그로 레벨 차이 판): party = 뽑은 파티를 고침, heroUp = 내 레벨 + */
export interface RunTweak { party?: (p: RosterEntry[], stageLv: number) => void; heroUp?: number; /** 구간이 끝날 때마다 (시뮬레이션 관찰) */ onFight?: (f: Fight) => void }
/** 한 판: 장소의 구간을 차례로 (구간 사이 휴식, 파티는 첫 구간에서 뽑은 그대로). tune을 주면 모든 구간에 그 값 (data/tune 대신) */
export function runOnce(c: ContentDef, d: DiffName, hero: HeroKey, seed: number, tune?: Tune, specs: SpecMode = 'common', tweak?: RunTweak): Run {
  const segs = c.fights(d), s = standard(c, d);
  const party = recruitParty(segs[0], seed, { abilities: true, myLv: s.heroLv ?? s.lv, stageLv: s.lv }); // 97 FM: 저마다 레벨 (칸 ±1)
  tweak?.party?.(party, s.lv);
  // 순차 레벨링 기준이면 시드마다 그 플레이어의 드롭 장비 (레벨은 시드와 상관없음)
  const rp = s.gear === 'ramp' ? rampPlayer(c, d, hero, seed) : null, lv = (s.heroLv ?? s.lv) + (tweak?.heroUp ?? 0);
  const gear = rp ? { gearStats: gearStatsOf(rp.eq, rp.lv), specs: specsOf(rp.eq, hero) }
    : { gear: s.gear as GearId, specs: specs === 'class' ? classSpecs(s.gear as GearId, hero, seed) : presetSpecs(s.gear as GearId, hero) };
  let carry: Carry | undefined, time = 0, heals = 0, steals = 0, healerSteals = 0, thrRatio: Run['thrRatio'];
  for (let i = 0; i < segs.length; i++) {
    const f = create({
      encounter: segs[i], diff: d, seed: seed + i * 7919, hero, level: lv, heroLv: lv, stageLv: s.lv,
      talents: build(lv, seed % 3), party, affixes: s.affixes.length ? s.affixes : undefined, carry, tune, ...gear, // 특성은 세 직업 모두 빌드 A · B · C 번갈아 (77)
    });
    const hp0 = f.party.reduce((a, u) => a + u.hp, 0);
    while (!f.over && f.t < MAX_T) { autoHealer(f); step(f); f.events.length = 0; }
    tweak?.onFight?.(f);
    time += f.t; steals += f.stats.steals ?? 0; healerSteals += f.stats.healerSteals ?? 0;
    if (f.thr && !thrRatio && f.thr.acc.dn) thrRatio = { d: f.thr.acc.d / f.thr.acc.dn, me: f.thr.acc.mn ? f.thr.acc.me / f.thr.acc.mn : 0 };
    // 받은 피해 = 그동안 들어간 치유 + 줄어든 체력 (넘친 피해 · 보호막은 빼고)
    heals += (f.stats.healed + hp0 - f.party.reduce((a, u) => a + Math.max(0, u.hp), 0)) / (SKILLS.heal.amt! * f.gear.heal * f.power);
    if (f.over !== 'win') return { win: false, time, reason: f.over ? f.reason : '시간 초과', heals, steals, healerSteals, thrRatio, bossLeft: f.bossMax > 0 ? f.bossHp / f.bossMax : 0, dealersLeft: f.party.filter(u => u.alive && !u.me && u.role !== 'tank').length, dealers: f.party.filter(u => !u.me && u.role !== 'tank').length };
    carry = restCarry(f, REST);
  }
  return { win: true, time, reason: '', heals, steals, healerSteals, thrRatio };
}

/**
 * 장소 보정 (tune.ts)의 기준 직업 (79 1-5): 사제 · 드루이드 · 성기사 평균. 79 직업 4종은 평균에 넣지 않고 「간격 검사」만
 * (난이도 · 콘텐츠마다 세 직업 평균 ±GAP_LIMIT%p, scripts/gap.ts). 넣으면 장소 보정 수백 칸이 다시 흔들림
 */
export const BASE_HEROES: HeroKey[] = ['priest', 'druid', 'paladin'];
/** 새 직업 간격 한계 (%p, 79 1-5) */
export const GAP_LIMIT = 5;

export interface Measure {
  /** 기준 직업 평균 클리어율 (%) */
  rate: number;
  byHero: Partial<Record<HeroKey, number>>;
  /** 이긴 판 평균 시간 (초) */
  time: number;
  /** 진 이유별 판 수 */
  fails: Record<string, number>;
  /** 바쁨: 받는 피해 ÷ 치유 한 번, 분당 (모든 판) */
  busy: number;
}
/** 직업마다 시드 1~n으로 돌림 (같은 시드라 배율을 바꿔 가며 재도 흔들림이 적음). heroes = 잴 직업 (기준 직업) */
export function measure(c: ContentDef, d: DiffName, n: number, tune?: Tune, heroes: HeroKey[] = BASE_HEROES): Measure {
  const byHero: Partial<Record<HeroKey, number>> = {}, fails: Record<string, number> = {};
  let wins = 0, time = 0, all = 0, heals = 0;
  for (const h of heroes) {
    let w = 0;
    for (let s = 1; s <= n; s++) {
      const r = runOnce(c, d, h, s, tune);
      all += r.time; heals += r.heals;
      if (r.win) { w++; time += r.time; } else fails[r.reason] = (fails[r.reason] || 0) + 1;
    }
    byHero[h] = Math.round((100 * w) / n);
    wins += w;
  }
  return { rate: (100 * wins) / (n * heroes.length), byHero, time: wins ? time / wins : 0, fails, busy: all ? heals / (all / 60) : 0 };
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
export const verdictOf = (d: DiffName, rate: number, c?: ContentDef): Verdict => { const t = targetOf(c, d); return rate < t.min ? 'hard' : rate > t.max ? 'easy' : 'ok'; };

export interface Row {
  key: ContentKey;
  name: string;
  diff: DiffName;
  std: Std;
  /** 지금 보정 (null = 구간마다 다름) */
  cur: Tune | null;
  now: Measure;
  verdict: Verdict;
  /** 목표 밖 (또는 바쁨 하한 아래)이라 찾은 새 피해 배율과 그때 결과 */
  next?: { dmg: number; m: Measure };
}

/** 쉬움 · 보통인데 클리어율은 목표 안이고 바쁨 하한 아래 */
export const tooIdle = (d: DiffName, m: Measure, c?: ContentDef): boolean => BUSY[d] != null && verdictOf(d, m.rate, c) === 'ok' && m.busy < BUSY[d]! - 0.5;

/** 장소 하나 · 난이도 하나: 지금 값으로 재고, 목표 밖이면 (search) 피해 배율을 찾음 */
export function balanceOne(t: TuneTable, c: ContentDef, d: DiffName, n: number, search = true): Row {
  const cur = placeTune(t, c, d);
  let now = measure(c, d, n), verdict = verdictOf(d, now.rate, c);
  // 목표 밖이면 판 수를 두 배로 다시 재서 확인 (선 근처의 흔들림으로 값을 자꾸 바꾸지 않게)
  if (search && verdict !== 'ok') { now = measure(c, d, n * 2); verdict = verdictOf(d, now.rate, c); }
  const row: Row = { key: c.key, name: c.name, diff: d, std: standard(c, d), cur, now, verdict };
  if (!search) return row;
  const base = cur ?? {};
  const seen = new Map<number, Measure>();
  const at = (dmg: number) => { if (!seen.has(dmg)) seen.set(dmg, measure(c, d, n, { ...base, dmg })); return seen.get(dmg)!.rate; };
  if (verdict === 'ok') {
    if (!tooIdle(d, now, c)) return row;
    // 바쁨 하한: 받는 피해는 배율에 거의 비례 → 하한까지 올린 배율 (덜 오르면 세 번까지 다시).
    // 클리어율은 목표값 (aim, 찾기와 같이 1 차이까지) 아래로 내리지 않음: 넘으면 마지막으로 괜찮던 배율과 그 사이에서 목표값에 맞춤
    const curDmg = base.dmg ?? 1, aim = targetOf(c, d).aim, floor = aim - 1;
    let ok = curDmg, m = now;
    for (let i = 0; i < 3 && tooIdle(d, m, c); i++) {
      const want = Math.ceil(ok * (BUSY[d]! / m.busy) * 100) / 100;
      if (want - ok < 0.015) break;
      if (at(want) >= floor) { ok = want; m = seen.get(want)!; continue; }
      findDmg(at, aim, ok, want);
      // 잰 배율 중 아래 선을 넘은 가장 큰 값 (선 근처는 판 수에 따라 흔들려서 가장 가까운 값이 선 밑일 수 있음)
      for (const [x, mm] of seen) if (x > ok && x < want && mm.rate >= floor) ok = x;
      break;
    }
    if (ok > curDmg) row.next = { dmg: ok, m: seen.get(ok)! };
    return row;
  }
  // 쉬움·보통은 아래 선만: 지금보다 쉽게만 (지금 배율 아래에서 찾음)
  const curDmg = base.dmg ?? 1;
  const hi = lowerOnly(d) ? curDmg : HI;
  const r = findDmg(at, targetOf(c, d).aim, LO, hi);
  const dmg = lowerOnly(d) && r.rate >= targetOf(c, d).aim - 1 ? closeIn(at, d, r.dmg, curDmg, 4, targetOf(c, d).aim) : r.dmg;
  row.next = { dmg, m: seen.get(dmg)! };
  return row;
}

function lowerOnly(d: DiffName): boolean { return TARGET[d].max >= 100; }
/**
 * 쉬움 · 보통 (아래 선만): 찾기는 첫 값 (LO와 지금 배율 사이 가운데)이 목표값 1 안이면 멈춰서 너무 쉬워지고 바쁨이 크게 줆 (2026-10-12 tune).
 * 찾은 배율 (good)과 지금 배율 (bad) 사이를 좁혀 목표값 − 1을 지키는 가장 큰 배율로
 */
export function closeIn(rate: (dmg: number) => number, d: DiffName, good: number, bad: number, iters = 4, aim = TARGET[d].aim): number {
  const floor = aim - 1;
  for (let i = 0; i < iters && bad - good > 0.015; i++) {
    const mid = Math.round(((good + bad) / 2) * 100) / 100;
    if (mid <= good || mid >= bad) break;
    if (rate(mid) >= floor) good = mid; else bad = mid;
  }
  return good;
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
