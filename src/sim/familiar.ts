/**
 * 익숙한 사람 검사 (2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」): 순차 레벨링 구간 (장소 Lv 20까지, sim/novice) 밖의
 * 탐험 · 던전 · 레이드를 익숙한 사람 (engine/novice FAMILIAR = 내 Lv 20부터의 사람: 반응 0.2초 · 고르기 0.06초/bit · 누르기 0.2초, 대기열 · 기믹 공략 앎)으로 잰다.
 * 조건은 자동 밸런스 기준 그대로 (sim/balance standard: 적 레벨 = 내 레벨, 쉬움 · 보통 장비 없음 · 어려움 고급 · 악몽 희귀, 공개모집, 특성 빌드 A · B · C,
 * 기준 직업 셋 평균). 숙련 (지금 자동 힐러)은 같은 조건 · 시드의 balance measure. 명령줄은 scripts/sim-familiar.ts (npm run sim:familiar)
 */
import { CONTENT, stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { HeroKey } from '../data/heroes';
import { rampPlace } from '../data/progression';
import type { Tune } from '../data/tune';
import { noviceHealer } from '../engine/auto';
import { FAMILIAR, type NoviceOpts } from '../engine/novice';
import { balanceable, BASE_HEROES, runOnce, targetOf } from './balance';

export interface FamiliarCell { c: ContentDef; d: DiffName }
/** 검사 칸: 순차 구간 밖 장소 (레이드 포함) × 난이도, 적 레벨 순 */
export const familiarCells = (diffs: DiffName[]): FamiliarCell[] =>
  CONTENT.filter(c => balanceable(c) && !rampPlace(c)).flatMap(c => diffs.map(d => ({ c, d }))).sort((a, b) => stageOf(a.c, a.d) - stageOf(b.c, b.d) || a.c.stageLv - b.c.stageLv);

export interface FamiliarMeasure { rate: number; byHero: Partial<Record<HeroKey, number>>; fails: Record<string, number>; time: number }
/** 직업마다 시드 1 ~ n (balance measure와 같은 시드 · 조건). pilot expert = 지금 자동 힐러, opts = 익숙한 사람 값 바꿔 보기 */
export function measureFamiliar(x: FamiliarCell, n: number, pilot: 'familiar' | 'expert' = 'familiar', heroes: HeroKey[] = BASE_HEROES, tune?: Tune, opts?: Partial<NoviceOpts>): FamiliarMeasure {
  const byHero: Partial<Record<HeroKey, number>> = {}, fails: Record<string, number> = {};
  const who = { ...FAMILIAR, ...opts };
  const tweak = pilot === 'familiar' ? { healer: (f: Parameters<typeof noviceHealer>[0]) => noviceHealer(f, who) } : undefined;
  let wins = 0, time = 0;
  for (const h of heroes) {
    let w = 0;
    for (let s = 1; s <= n; s++) {
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
