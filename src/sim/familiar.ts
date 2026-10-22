/**
 * 익숙한 사람 검사 (2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」): 순차 레벨링 구간 (장소 Lv 20까지, sim/novice) 밖의
 * 탐험 · 던전 · 레이드를 익숙한 사람 (engine/novice FAMILIAR = 내 Lv 20부터의 사람: 반응 0.2초 · 고르기 0.06초/bit · 누르기 0.2초, 대기열 · 기믹 공략 앎)으로 잰다.
 * 조건은 자동 밸런스 기준 그대로 (sim/balance standard: 적 레벨 = 내 레벨, 쉬움 · 보통 장비 없음 · 어려움 고급 · 악몽 희귀, 공개모집, 특성 빌드 A · B · C,
 * 기준 직업 셋 평균). 숙련 (지금 자동 힐러)은 같은 조건 · 시드의 balance measure. 명령줄은 scripts/sim-familiar.ts (npm run sim:familiar)
 * 하한 (2026-10-22 Lim 「고친다. 20레벨 이후는 장비를 감안해서 고치자」): 익숙한 사람은 적 레벨 = 내 레벨에 길잡이 길에서 그 레벨까지 받은 장비 (sim/journey),
 * 누르는 사람은 그 레벨 사람 (engine/novice noviceAt: Lv 20 익숙 → Lv 60 능숙). 목표 FAMILIAR_TARGET (Lv 21 → 100 직선)
 */
import { CONTENT, stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { HeroKey } from '../data/heroes';
import { rampPlace } from '../data/progression';
import type { Tune } from '../data/tune';
import { noviceHealer } from '../engine/auto';
import { noviceAt, type NoviceOpts } from '../engine/novice';
import { balanceable, BASE_HEROES, runOnce, targetOf } from './balance';
import { gearAt, journey } from './journey';

/** 하한 목표 (%): 적 레벨 21 → 100 사이 직선 (「초반 쉽게 후반 어렵게」), 쉬움은 그대로 */
export const FAMILIAR_TARGET: Record<DiffName, [number, number]> = { '쉬움': [90, 90], '보통': [85, 80], '어려움': [60, 45], '악몽': [45, 30] };
export const FAMILIAR_LV_SPAN = [21, 100] as const;
/** 칸의 하한 목표 (적 레벨 기준) */
export function familiarTarget(x: FamiliarCell): number {
  const [a, b] = FAMILIAR_TARGET[x.d], [l0, l1] = FAMILIAR_LV_SPAN, t = Math.max(0, Math.min(1, (stageOf(x.c, x.d) - l0) / (l1 - l0)));
  return Math.round((a + (b - a) * t) * 10) / 10;
}
/** 길 시드 수 (balance 시드 s는 길 ((s − 1) % JOURNEYS) + 1의 장비) */
export const JOURNEYS = 5;
/** 이 칸 · 직업 · 시드의 플레이어: 적 레벨 (100까지)과 길잡이 길에서 그 레벨까지 받은 장비 */
export const familiarPlayer = (x: FamiliarCell, hero: HeroKey, seed: number) => {
  const lv = Math.min(100, stageOf(x.c, x.d));
  return { lv, eq: gearAt(journey(hero, ((seed - 1) % JOURNEYS) + 1), lv) };
};

export interface FamiliarCell { c: ContentDef; d: DiffName }
/** 검사 칸: 순차 구간 밖 장소 (레이드 포함) × 난이도, 적 레벨 순 */
export const familiarCells = (diffs: DiffName[]): FamiliarCell[] =>
  CONTENT.filter(c => balanceable(c) && !rampPlace(c)).flatMap(c => diffs.map(d => ({ c, d }))).sort((a, b) => stageOf(a.c, a.d) - stageOf(b.c, b.d) || a.c.stageLv - b.c.stageLv);

export interface FamiliarMeasure { rate: number; byHero: Partial<Record<HeroKey, number>>; fails: Record<string, number>; time: number }
/**
 * 직업마다 시드 1 ~ n. familiar = 그 레벨 사람 (noviceAt)이 길 장비로, expert = 지금 자동 힐러가 자동 밸런스 기준 조건 (balance measure와 같은 시드 · 조건).
 * opts = 사람 값 바꿔 보기, stdGear = 익숙한 사람도 기준 조건 장비 (#368 첫 측정)
 */
export function measureFamiliar(x: FamiliarCell, n: number, pilot: 'familiar' | 'expert' = 'familiar', heroes: HeroKey[] = BASE_HEROES, tune?: Tune, opts?: Partial<NoviceOpts>, stdGear = false): FamiliarMeasure {
  const byHero: Partial<Record<HeroKey, number>> = {}, fails: Record<string, number> = {};
  let wins = 0, time = 0;
  for (const h of heroes) {
    let w = 0;
    for (let s = 1; s <= n; s++) {
      const player = pilot === 'familiar' && !stdGear ? familiarPlayer(x, h, s) : undefined;
      const who = { ...noviceAt(Math.min(100, stageOf(x.c, x.d)), s), ...opts };
      const tweak = pilot === 'familiar' ? { healer: (f: Parameters<typeof noviceHealer>[0]) => noviceHealer(f, who), player } : undefined;
      const r = runOnce(x.c, x.d, h, s, tune, 'common', tweak);
      if (r.win) { w++; time += r.time; } else fails[r.reason] = (fails[r.reason] || 0) + 1;
    }
    byHero[h] = Math.round((100 * w) / n);
    wins += w;
  }
  return { rate: (100 * wins) / (n * heroes.length), byHero, fails, time: wins ? time / wins : 0 };
}

/** 숙련 목표 (장소 레벨 곡선, balance targetOf)의 가운데값: 익숙한 사람과 견주는 기준 */
export const expertAim = (x: FamiliarCell) => targetOf(x.c, x.d).aim;
/** 레벨 구간 (103 난이도 곡선과 같은 끊음) */
export const bandOf = (lv: number) => (lv <= 45 ? 'Lv 21~45' : lv <= 70 ? 'Lv 46~70' : 'Lv 71~100+');
export const kindOf = (c: ContentDef) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind === 'dungeon' ? '던전' : '탐험');
