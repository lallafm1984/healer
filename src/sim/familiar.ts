/**
 * 익숙한 사람 검사 (2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」): 순차 레벨링 구간 (장소 Lv 20까지, sim/novice) 밖의
 * 탐험 · 던전 · 레이드를 익숙한 사람 (engine/novice FAMILIAR = 내 Lv 20부터의 사람: 반응 0.2초 · 고르기 0.06초/bit · 누르기 0.2초, 대기열 · 기믹 공략 앎)으로 잰다.
 * 조건은 자동 밸런스 기준 그대로 (sim/balance standard: 적 레벨 = 내 레벨, 쉬움 · 보통 장비 없음 · 어려움 고급 · 악몽 희귀, 공개모집, 특성 빌드 A · B · C,
 * 기준 직업 셋 평균). 숙련 (지금 자동 힐러)은 같은 조건 · 시드의 balance measure. 명령줄은 scripts/sim-familiar.ts (npm run sim:familiar)
 * 하한 (2026-10-22 Lim 「고친다. 20레벨 이후는 장비를 감안해서 고치자」): 익숙한 사람은 적 레벨 = 내 레벨에 길잡이 길에서 그 레벨까지 받은 장비 (sim/journey),
 * 누르는 사람은 그 레벨 사람 (engine/novice noviceAt: Lv 20 익숙 → Lv 60 능숙). 목표 FAMILIAR_TARGET (Lv 21 → 100 직선)
 * 레벨 디자인 기준 (2026-10-22 Lim 「장비는 20레벨 부터 부위마다 중간 등급 기준으로해서 너무 쉽지도, 너무 어렵지도 않는 적절한 레벨디자인이 필요하다」):
 * 장비 = 6부위 모두 희귀 (일반 · 고급 · 희귀 · 영웅 · 전설의 가운데), 옵션 굴림 100% (가운데), 아이템 레벨 = 내 레벨 (midGear). 길 장비 (journey)는 견줘 보기용.
 * 목표는 띠 (DESIGN: 아래 선 = 예전 하한 FAMILIAR_TARGET, 위 선 = 아래 선 + 14, 가운데를 겨눔). 자동 밸런스 (balance balanceOne)가 이 칸들을 이 기준으로 맞춤
 */
import { CONTENT, stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { HeroKey } from '../data/heroes';
import { rampPlace } from '../data/progression';
import type { Tune } from '../data/tune';
import { noviceHealer } from '../engine/auto';
import { gearStatsOf, makeItem, SLOTS, specsOf, type Equipped, type ItemGrade } from '../data/equipment';
import { noviceAt, type NoviceOpts } from '../engine/novice';
import { rngFrom } from '../engine/rng';
import { balanceable, BASE_HEROES, runOnce, targetOf } from './balance';
import { gearAt, journey } from './journey';

/** 하한 (띠의 아래 선, %): 적 레벨 21 → 100 사이 직선 (「초반 쉽게 후반 어렵게」), 쉬움은 그대로 */
export const FAMILIAR_TARGET: Record<DiffName, [number, number]> = { '쉬움': [90, 90], '보통': [85, 80], '어려움': [60, 45], '악몽': [45, 30] };
export const FAMILIAR_LV_SPAN = [21, 100] as const;
/** 띠 폭: 위 선 = 아래 선 + DESIGN_BAND × 2, 가운데 = 아래 선 + DESIGN_BAND (쉬움은 아래 선만) */
export const DESIGN_BAND = 7;
/** 칸의 하한 (적 레벨 기준) */
export function familiarTarget(x: FamiliarCell): number {
  const [a, b] = FAMILIAR_TARGET[x.d], [l0, l1] = FAMILIAR_LV_SPAN, t = Math.max(0, Math.min(1, (stageOf(x.c, x.d) - l0) / (l1 - l0)));
  return Math.round((a + (b - a) * t) * 10) / 10;
}
/** 칸의 레벨 디자인 띠: 아래 선 · 위 선 · 겨눌 값 (쉬움은 아래 선만, 위 선 100) */
export function designTarget(x: FamiliarCell): { min: number; max: number; aim: number } {
  const min = familiarTarget(x);
  return x.d === '쉬움' ? { min, max: 100, aim: Math.min(99, min + DESIGN_BAND) } : { min, max: Math.min(100, min + DESIGN_BAND * 2), aim: min + DESIGN_BAND };
}
/** 레벨 디자인 장비 등급: 다섯 등급의 가운데 */
export const MID_GRADE: ItemGrade = '희귀';
const midMemo = new Map<string, Equipped>();
/** 6부위 모두 MID_GRADE, 옵션 굴림 100%, 아이템 레벨 = lv (종류 · 무작위 옵션 줄은 시드로) */
export function midGear(lv: number, hero: HeroKey, seed: number): Equipped {
  const key = `${lv}:${hero}:${seed}`;
  let eq = midMemo.get(key);
  if (eq) return eq;
  const r = rngFrom(Math.imul(seed >>> 0, 0x3c6ef372) ^ (lv * 0x9e37) ^ hero.length);
  eq = {};
  SLOTS.forEach((s, i) => {
    const it = makeItem(r, s.key, MID_GRADE, i + 1, undefined, { lv, hero });
    it.fixedRolls = it.fixedRolls?.map(() => 1);
    it.lines = it.lines.map(l => ({ ...l, roll: 1 }));
    eq![s.key] = it;
  });
  midMemo.set(key, eq);
  return eq;
}
/** 중간 등급 장비 전투 설정 (gearStats · specs, 화면 테스트 · simulateDungeon용) */
export function midGearConfig(lv: number, hero: HeroKey, seed: number) {
  const eq = midGear(lv, hero, seed);
  return { gearStats: gearStatsOf(eq, lv), specs: specsOf(eq, hero) };
}
/** 길 시드 수 (balance 시드 s는 길 ((s − 1) % JOURNEYS) + 1의 장비) */
export const JOURNEYS = 5;
/** 장비 기준: mid = 중간 등급 (레벨 디자인), journey = 길잡이 길 드롭 (#369), std = 자동 밸런스 기준 조건 (#368) */
export type GearBasis = 'mid' | 'journey' | 'std';
/** 이 칸 · 직업 · 시드의 플레이어: 적 레벨 (100까지)과 그 장비 */
export const familiarPlayer = (x: FamiliarCell, hero: HeroKey, seed: number, basis: GearBasis = 'mid') => {
  const lv = Math.min(100, stageOf(x.c, x.d));
  return { lv, eq: basis === 'journey' ? gearAt(journey(hero, ((seed - 1) % JOURNEYS) + 1), lv) : midGear(lv, hero, seed) };
};

export interface FamiliarCell { c: ContentDef; d: DiffName }
/** 검사 칸: 순차 구간 밖 장소 (레이드 포함) × 난이도, 적 레벨 순 */
export const familiarCells = (diffs: DiffName[]): FamiliarCell[] =>
  CONTENT.filter(c => balanceable(c) && !rampPlace(c)).flatMap(c => diffs.map(d => ({ c, d }))).sort((a, b) => stageOf(a.c, a.d) - stageOf(b.c, b.d) || a.c.stageLv - b.c.stageLv);

export interface FamiliarMeasure { rate: number; byHero: Partial<Record<HeroKey, number>>; fails: Record<string, number>; time: number }
/**
 * 직업마다 시드 1 ~ n. familiar = 그 레벨 사람 (noviceAt)이 basis 장비로 (기본 중간 등급), expert = 지금 자동 힐러가 자동 밸런스 기준 조건 (balance measure와 같은 시드 · 조건).
 * opts = 사람 값 바꿔 보기
 */
export function measureFamiliar(x: FamiliarCell, n: number, pilot: 'familiar' | 'expert' = 'familiar', heroes: HeroKey[] = BASE_HEROES, tune?: Tune, opts?: Partial<NoviceOpts>, basis: GearBasis = 'mid'): FamiliarMeasure {
  const byHero: Partial<Record<HeroKey, number>> = {}, fails: Record<string, number> = {};
  let wins = 0, time = 0;
  for (const h of heroes) {
    let w = 0;
    for (let s = 1; s <= n; s++) {
      const player = pilot === 'familiar' && basis !== 'std' ? familiarPlayer(x, h, s, basis) : undefined;
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

/** 레벨 디자인 기준 한 판을 숙련 자동 힐러로: 자동 밸런스 기준 조건에서 장비만 중간 등급 (장소 테스트 「보통이면 거의 다 깸」) */
export const designRun = (c: ContentDef, d: DiffName, hero: HeroKey, seed: number) => runOnce(c, d, hero, seed, undefined, 'common', { player: familiarPlayer({ c, d }, hero, seed) });

/** 숙련 목표 (장소 레벨 곡선, balance targetOf)의 가운데값: 익숙한 사람과 견주는 기준 */
export const expertAim = (x: FamiliarCell) => targetOf(x.c, x.d).aim;
/** 레벨 구간 (103 난이도 곡선과 같은 끊음) */
export const bandOf = (lv: number) => (lv <= 45 ? 'Lv 21~45' : lv <= 70 ? 'Lv 46~70' : 'Lv 71~100+');
export const kindOf = (c: ContentDef) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind === 'dungeon' ? '던전' : '탐험');
