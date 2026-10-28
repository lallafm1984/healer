/**
 * 초보 검사 (2026-10-22 Lim 「테스트 자동힐시 처음사용자 시점의 조작의 테스트로 초반 난이도 체크로직이 필요하다」).
 * 처음 하는 사람 (engine/novice: 늦은 판단 · 누르기, 한눈팔기, 체력 읽기 오차, 옆 칸, 늦게 보는 디버프, 잊는 큰 버튼, 대기열 · 기믹 공략 모름)이
 * 튜토리얼과 초반 순차 레벨링 구간 (장소 Lv 20까지, 70)을 길잡이 길대로 갈 때의 클리어율을 잰다. 명령줄은 scripts/sim-novice.ts (npm run sim:novice).
 * 조건 = 그 칸에 처음 들어가는 플레이어: 길의 레벨 · 드롭 장비 (sim/ramp, 자동 밸런스 어려움 · 악몽 기준과 같은 흐름), 특성 빌드 A · B · C 번갈아,
 * 공개모집 (능력 · FM 레벨, 게임 party.ts와 같음). 튜토리얼 판 (첫 전투 2인 · 녹슨 고원 쉬움)은 튜토리얼 파티 (스킬 없음).
 * 자동 밸런스 (sim/balance)의 쉬움 · 보통 기준 (적 레벨 = 내 레벨 · 장비 없음)과 달리, 보통은 쉬움을 깬 레벨 (적보다 1 ~ 2 낮음)로 들어감.
 * 숙련 (pilot 'expert' = 지금 자동 힐러)도 같은 조건으로 재서 조작 몫과 레벨 · 장비 몫을 나눠 본다
 */
import { diffAffixes } from '../data/affixes';
import { CONTENT, contentOf, stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { gearStatsOf, specsOf } from '../data/equipment';
import type { HeroKey } from '../data/heroes';
import { rampDiffs, rampMain, rampPlace, recLevel } from '../data/progression';
import { TALENTS } from '../data/talents';
import type { Tune } from '../data/tune';
import { autoHealer, noviceHealer } from '../engine/auto';
import { restCarry } from '../engine/dungeon';
import { create, recruitParty, step } from '../engine/fight';
import { noviceAt, noviceOf, type NoviceOpts } from '../engine/novice';
import type { Carry, Fight, RosterEntry } from '../engine/types';
import { DUO_PARTY } from '../game/tutorial';
import { HERO_HAND } from './familiar';
import { rampPlayer } from './ramp';

/** 누가 누르나: 처음 하는 사람 · 지금 자동 힐러 */
export type Pilot = 'novice' | 'expert';

/**
 * 초보 목표 클리어율 (%): 이보다 낮으면 「초보에게 어려움」. 2026-10-22 Lim 「추천대로」 (B안), 같은 날 「레벨 10까지 쉽게」로 장소 Lv EARLY_LV까지는 A안 (NOVICE_TARGET_EARLY).
 * 튜토리얼 판은 따로 (TUT_TARGET): 처음 두 판에서 지면 바로 그만둘 수 있음. 재는 사람은 그 칸에 들어가는 내 레벨의 사람 (engine/novice noviceAt: Lv 10까지 처음, Lv 11부터 중급자 = 익숙, 2026-10-27)
 */
export const NOVICE_TARGET: Partial<Record<DiffName, number>> = { '쉬움': 90, '보통': 75, '어려움': 50 };
export const NOVICE_TARGET_EARLY: Partial<Record<DiffName, number>> = { '쉬움': 95, '보통': 85, '어려움': 60 };
export const EARLY_LV = 10;
export const TUT_TARGET = 95;
/**
 * 보충 장소 (113 7-1) 어려움 목표: 장소 Lv 10 80% · Lv 11 ~ 20 75%. 길잡이가 원본 다시 하기 대신 보내는 칸이라 원본 어려움 (60 · 50)보다 높게
 * (원본 어려움 최저치만 통과한 장소로 반복판을 바꾸면 레벨업 체감이 막힘). 쉬움 · 보통 · 장소 Lv 1 ~ 9 어려움 (길 밖)은 원본 목표 그대로
 */
export const SUPP_HARD = { early: 80, later: 75 };

/** 검사하는 칸 하나 (tutorial = 첫 전투, tut = 튜토리얼 판으로 하는 녹슨 고원 쉬움, off = 길 밖 칸: 장소 Lv 1 ~ 9 어려움) */
export interface NoviceCell { c: ContentDef; d: DiffName; tut: boolean; off?: boolean }
/**
 * 검사 칸: 첫 전투 → 장소를 레벨 순으로 길의 난이도 (rampDiffs: 장소 Lv 1 ~ 9 쉬움 · 보통, 10 ~ 20 쉬움 · 보통 · 어려움) 가운데 diffs만.
 * 녹슨 고원 쉬움은 튜토리얼 판 (처음 하는 사람은 튜토리얼에서 처음 깸).
 * 장소 Lv 1 ~ 9 어려움 (길 밖, off)도 넣는다 (2026-10-22 가상 사용자 QA: 길잡이가 추천하지 않아도 열린 칸 가운데 높은 곳을 고르는 사람이 가는데
 * 처음 하는 사람은 11 ~ 19%만 깼음): 들어가는 사람 = 그 장소 보통을 깬 뒤 (sim/ramp)
 */
export function noviceCells(diffs: DiffName[] = ['쉬움', '보통'], supps = false): NoviceCell[] {
  const out: NoviceCell[] = [{ c: contentOf('tutorial'), d: '쉬움', tut: true }];
  // 보충 장소 (113)는 길이 아님: supps면 함께 (원본 다시 하기 차례에 들어가는 칸, 원본과 같은 난이도)
  for (const c of CONTENT.filter(x => (supps ? rampPlace(x) : rampMain(x)) && x.ready).sort((a, b) => a.stageLv - b.stageLv)) {
    for (const d of rampDiffs(c)) if (diffs.includes(d)) out.push({ c, d, tut: c.key === 'plateau' && d === '쉬움' });
    if (!rampDiffs(c).includes('어려움') && diffs.includes('어려움')) out.push({ c, d: '어려움', tut: false, off: true });
  }
  return out;
}
export const cellLabel = (x: NoviceCell) => `${x.c.name}${x.tut ? ' (튜토리얼)' : x.off ? ' (길 밖)' : ''} ${x.d}`;

/** 구간 사이 휴식 (초, sim/balance와 같음) */
const REST = 10;
const MAX_T = 700 * 1.25;

export interface NoviceRun {
  win: boolean;
  time: number;
  reason: string;
  /** 플레이어 레벨 · 끼고 있는 장비 수 */
  lv: number;
  gear: number;
  /** 초보 기록 (구간 합): 누른 수 · 옆 칸 · 한눈판 수 · 헛탭 */
  presses: number;
  misTaps: number;
  lapses: number;
  fails: number;
}

/** 한 판: 장소의 구간을 차례로 (구간 사이 휴식). opts = 초보 값 바꿔 보기, tune = 모든 구간에 이 보정 (data/tune 대신, 자동 밸런스 초보 하한) */
export function runNovice(x: NoviceCell, hero: HeroKey, seed: number, pilot: Pilot = 'novice', opts?: Partial<NoviceOpts>, tune?: Tune): NoviceRun {
  const { c, d } = x, segs = c.fights(d), stageLv = stageOf(c, d);
  const first = c.key === 'tutorial';
  const rp = first ? { lv: 1, eq: {} } : rampPlayer(c, d, hero, seed);
  const party: RosterEntry[] = first ? DUO_PARTY : x.tut ? recruitParty(segs[0], seed) : recruitParty(segs[0], seed, { abilities: true, myLv: rp.lv, stageLv: recLevel(c, d) });
  const affixes = c.kind === 'dungeon' ? diffAffixes(d, stageLv) : [];
  const talents = TALENTS.map(t => (t.lv <= rp.lv ? seed % 3 : null));
  const out: NoviceRun = { win: false, time: 0, reason: '', lv: rp.lv, gear: Object.keys(rp.eq).length, presses: 0, misTaps: 0, lapses: 0, fails: 0 };
  const who = { ...noviceAt(rp.lv, seed), ...HERO_HAND[hero], ...opts }; // 한 판 내내 같은 사람 (구간마다 시드가 달라도), 직업 손 (수도사 연타 예약)
  const healer = pilot === 'novice' ? (f: Fight) => noviceHealer(f, who) : autoHealer;
  let carry: Carry | undefined;
  for (let i = 0; i < segs.length; i++) {
    const f = create({
      encounter: segs[i], diff: d, seed: seed + i * 7919, hero, level: rp.lv, heroLv: rp.lv, stageLv,
      talents, party, affixes: affixes.length ? affixes : undefined, carry, tune, gearStats: gearStatsOf(rp.eq, rp.lv), specs: specsOf(rp.eq, hero),
    });
    while (!f.over && f.t < MAX_T) { healer(f); step(f); f.events.length = 0; }
    out.time += f.t;
    if (pilot === 'novice') { const s = noviceOf(f).stats; out.presses += s.presses; out.misTaps += s.misTaps; out.lapses += s.lapses; out.fails += s.fails; }
    if (f.over !== 'win') { out.reason = f.over ? f.reason : '시간 초과'; return out; }
    carry = restCarry(f, REST);
  }
  out.win = true;
  return out;
}

export interface NoviceMeasure {
  rate: number;
  /** 진 이유별 판 수 */
  fails: Record<string, number>;
  /** 이긴 판 평균 시간 (초) */
  time: number;
  /** 평균 레벨 · 장비 수 */
  lv: number;
  gear: number;
  /** 분당 누른 수 (초보만) */
  apm: number;
}
/** 시드 seed0 ~ seed0 + n − 1 */
export function measureNovice(x: NoviceCell, hero: HeroKey, n: number, pilot: Pilot = 'novice', opts?: Partial<NoviceOpts>, seed0 = 1, tune?: Tune): NoviceMeasure {
  let wins = 0, time = 0, all = 0, lv = 0, gear = 0, presses = 0;
  const fails: Record<string, number> = {};
  for (let s = seed0; s < seed0 + n; s++) {
    const r = runNovice(x, hero, s, pilot, opts, tune);
    all += r.time; lv += r.lv; gear += r.gear; presses += r.presses;
    if (r.win) { wins++; time += r.time; } else fails[r.reason] = (fails[r.reason] || 0) + 1;
  }
  return { rate: (100 * wins) / n, fails, time: wins ? time / wins : 0, lv: lv / n, gear: gear / n, apm: all ? presses / (all / 60) : 0 };
}

/** 이 칸의 초보 목표 (없으면 null = 검사 안 함) */
export const noviceTarget = (x: NoviceCell): number | null => {
  if (x.c.key === 'tutorial' || x.tut) return TUT_TARGET;
  if (x.c.anchor && x.d === '어려움' && !x.off) return x.c.stageLv <= EARLY_LV ? SUPP_HARD.early : SUPP_HARD.later;
  return (x.c.stageLv <= EARLY_LV ? NOVICE_TARGET_EARLY : NOVICE_TARGET)[x.d] ?? null;
};
