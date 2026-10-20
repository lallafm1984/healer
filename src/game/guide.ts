/**
 * 모험 길잡이 (86, 2026-10-16 Lim 「자기에게 맞는 난이도인지 잘 모르겠고, 각 컨텐츠를 찾아가면서 깨야 하는 불친절함」).
 * 탐험 · 던전 모든 장소 · 난이도 가운데 지금 내 레벨 · 장비에 맞는 칸을 골라 한 곳을 추천한다.
 * 로비 「출전」 · 다음 목표, 출전 화면 처음 고른 곳 · 추천 표시, 결과 화면 「다음」이 모두 이것을 따른다.
 *
 * 적합도 (fitOf, 92: 2026-10-17 Lim 「적정의 난이도가 너무 힘겹게 클리어된다」): 칸마다 빠듯함 점수 = 난이도 + 레벨 + 장비.
 *   −2 이하 여유 · −1 ~ +1 적정 · +2 ~ +3 도전 · +4 이상 위험. 적정 = 그 장소 레벨의 어려움 목표 클리어율 (sim/balance 레벨 곡선 CURVE, 103 「난이도 곡선」).
 *   - 난이도 (diffStep): −2 · −1 · 0 · +2 (예전 평평한 목표 쉬움 99 · 보통 97 · 어려움 85 · 악몽 75%에 맞춰 정한 값. 지금 목표는 레벨 곡선 #304, 걸음은 그대로).
 *     순차 구간 Lv 10~20 장소 악몽은 예전 길이라 어려움 목표로 맞춰 둠 (92) → 0.
 *   - 레벨 (lvStep): 기준 레벨 (적 레벨, 순차 구간 장소는 그 난이도에 들어가는 레벨) − 내 레벨. 모자라면 2레벨마다 +1 (힘은 적 레벨 아래로 안 내려가서
 *     특성 · 장비 아이템 레벨만 모자람), 앞서면 레벨 힘이 12% 늘 때마다 −1 (시뮬: Lv 20 넘은 장소에서 1~3레벨 앞서거나 뒤져도 클리어율이 거의 같음).
 *   - 장비: 권장 장비 (어려움 고급 · 악몽 희귀)에 못 미치면 +2 (적어도 도전), 한 단계 위 (보통 고급 · 어려움 희귀 · 악몽 영웅) 이상이면 −1
 *     (시뮬: 악몽 고급 48 · 희귀 81 · 영웅 92%, 어려움 고급 91 · 희귀 96%).
 * 추천 순서 (2026-10-20 Lim 「게임 가이드에서 악몽 난이도는 추천을 안하는 방식으로 해서 순차적으로 진행되게」): 악몽은 추천하지 않음 (열림 · 보상 · 직접 고르기 · 적합도 꼬리표는 그대로).
 *   - 순차 구간 (내 Lv 20 이하, 70 · 90): 길 첫 클리어 (장소 Lv 1~9 쉬움 · 보통, 10~20 쉬움 · 보통 · 어려움, rampDiffs) 가운데 들어가는 레벨이 내 레벨 ±1인 칸을 장소 레벨 순 · 쉬운 난이도부터.
 *   - 그 뒤: 안 깬 칸을 장소 레벨 순 · 쉬움 → 보통 → 어려움 (다 깨면 다음 장소 쉬움). 적 레벨이 내 레벨 − 10 밑 (FAME_LOW_GAP, 명성 낮은 장소와 같은 선) · 위험 칸은 건너뜀.
 *   - 갈 첫 클리어가 없으면 적정 어려움 가운데 적 레벨 높은 곳 (반복), 그것도 없으면 여유 가운데 적 레벨 높은 곳, 그다음 도전 가운데 낮은 곳.
 *   (예전 Lv 21부터 「적정 가운데 어려운 난이도 먼저」는 거의 늘 악몽이었음: 길잡이 1순위만 따라 Lv 100까지 판의 92%)
 */
import { ALL_DIFFS, CONTENT, isLeveling, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { avgScore, presetScore, RECOMMENDED, recommendedFor } from '../data/equipment';
import { FAME_LOW_GAP } from '../data/guild';
import { lvPower, RAMP_LV, rampDiffs, rampFour, rampPlace, rampRefLevel, rampXp } from '../data/progression';
import { G, lockOf } from './state';

export type Fit = '여유' | '적정' | '도전' | '위험';
/** 적합도 설명 (출전 화면 안내 · 화면 읽기) */
export const FIT_TEXT: Record<Fit, string> = {
  '여유': '쉽게 깨는 칸',
  '적정': '내 레벨 · 장비에 알맞은 칸',
  '도전': '빠듯한 칸',
  '위험': '많이 어려운 칸',
};

export interface Stage { content: ContentKey; diff: DiffName }

/** 그 칸을 맞춘 기준 레벨: 탐험 · 던전 = 적 레벨 (순차 구간 장소는 70의 길에서 들어가는 레벨), 레이드 = 적 레벨 (내 레벨과 열림 레벨 중 큰 쪽) */
export const refLevel = (c: ContentDef, d: DiffName, level: number) =>
  (isLeveling(c) ? rampRefLevel(c, d) ?? stageOf(c, d) : Math.max(level, stageOf(c, d)));

/**
 * 출전 화면 · 편성 「권장 레벨」 (92): 그 칸을 맞춘 플레이어 레벨. 순차 구간 장소는 길에서 들어가는 레벨 (온실 악몽 = 적 Lv 16이지만 Lv 11,
 * 적 레벨보다 높으면 적 레벨: 튜토리얼 녹슨 고원 쉬움), 그 밖은 적 레벨
 */
export const recLevel = (c: ContentDef, d: DiffName) => Math.min(stageOf(c, d), (isLeveling(c) && rampRefLevel(c, d)) || Infinity);

/** 난이도 몫: 클리어율 목표 쉬움 99 · 보통 97 · 어려움 85 · 악몽 75%. 순차 구간 Lv 10~20 장소 악몽은 길이라 85%로 맞춤 (92) */
const STEP: Record<DiffName, number> = { '쉬움': -2, '보통': -1, '어려움': 0, '악몽': 2 };
export const diffStep = (c: ContentDef, d: DiffName) => (d === '악몽' && rampFour(c) ? 0 : STEP[d]);
/** 레벨 몫. gap = 기준 레벨 − 내 레벨: 모자라면 2레벨마다 +1, 앞서면 레벨 힘 (lvPower)이 12% 늘 때마다 −1 */
export function lvStep(ref: number, level: number): number {
  if (ref >= level) return Math.floor((ref - level) / 2);
  return -Math.floor((lvPower(level) / lvPower(ref) - 1) / 0.12 + 1e-9) || 0;
}
/** 한 단계 위 장비 (이 점수 이상이면 −1): 보통 고급 · 어려움 희귀 · 악몽 영웅 (특수능력 1줄) */
const OVER: Partial<Record<DiffName, number>> = {
  '보통': RECOMMENDED['어려움']!.score,
  '어려움': RECOMMENDED['악몽']!.score,
  '악몽': presetScore('영웅', 1.4, 1),
};

/** 빠듯함 점수 (−2 이하 여유 · −1 ~ +1 적정 · +2 ~ +3 도전 · +4 이상 위험). gear = 착용 장비 평균 점수 (avgScore) */
export function challengeOf(c: ContentDef, d: DiffName, level: number, gear: number): number {
  // 레이드는 적이 늘 내 레벨이라 레벨 몫 없음 (장비 몫만)
  let s = diffStep(c, d) + (isLeveling(c) ? lvStep(refLevel(c, d, level), level) : 0);
  // 순차 구간 장소 (장소 Lv 20까지)는 그 길의 드롭 장비로 맞춰서 장비 몫 없음
  if (isLeveling(c) && rampPlace(c)) return s;
  const rec = recommendedFor(c, d), over = OVER[d];
  if (rec && gear < rec.score) s = Math.max(s + 2, 2);
  else if (over != null && gear >= over) s -= 1;
  return s;
}

/** 적합도 */
export function fitOf(c: ContentDef, d: DiffName, level: number, gear: number): Fit {
  const s = challengeOf(c, d, level, gear);
  return s <= -2 ? '여유' : s <= 1 ? '적정' : s <= 3 ? '도전' : '위험';
}

export interface GuideCtx {
  level: number;
  /** 착용 장비 평균 점수 */
  gear: number;
  clears: Partial<Record<string, Partial<Record<DiffName, unknown>>>>;
  /** 들어갈 수 있는 칸 (레벨 · 사슬 잠금) */
  open: (c: ContentDef, d: DiffName) => boolean;
}

interface Cand {
  c: ContentDef; d: DiffName; fit: Fit; first: boolean; st: number; xp: number;
  /** 기준 레벨 − 내 레벨 (순차 구간 길 고르기) */
  gap: number;
}
const di = (d: DiffName) => ALL_DIFFS.indexOf(d);

/** 추천 순서대로 칸 목록 (탐험 · 던전만). 앞일수록 좋음 */
export function rankStages(ctx: GuideCtx): Stage[] {
  const all: Cand[] = [];
  for (const c of CONTENT) {
    if (!isLeveling(c) || c.hidden || !c.ready) continue;
    for (const d of ALL_DIFFS) {
      if (d === '악몽' || !ctx.open(c, d)) continue; // 악몽은 추천하지 않음 (2026-10-20 Lim)
      const first = !ctx.clears[c.key]?.[d];
      all.push({ c, d, fit: fitOf(c, d, ctx.level, ctx.gear), first, st: stageOf(c, d), xp: rampXp(c, d, { first, grade: 'A', win: true }),
        gap: refLevel(c, d, ctx.level) - ctx.level });
    }
  }
  // 순차 구간: 길 첫 클리어를 장소 레벨 순 (장소 Lv 1~9 쉬움 → 보통, 10~20 쉬움 → 보통 → 어려움, 그다음 장소 쉬움). 70 · 90의 길.
  // 길 칸은 들어가는 레벨이 내 레벨 ±1이면 (쉬움은 적합도로는 여유여도) 차례대로
  if (ctx.level <= RAMP_LV) {
    const onPath = (x: Cand) => rampDiffs(x.c).includes(x.d);
    const ramp = all.filter(x => onPath(x) && Math.abs(x.gap) <= 1).sort((a, b) => Number(b.first) - Number(a.first) || a.c.stageLv - b.c.stageLv || di(a.d) - di(b.d) || b.xp - a.xp);
    if (ramp.some(x => x.first)) return uniq([...ramp, ...rest(all.filter(x => !onPath(x)), ctx.level), ...fallback(all)]);
  }
  return uniq([...rest(all, ctx.level), ...fallback(all)]);
}
/** 앞에 나온 칸은 한 번만 */
const uniq = (xs: Cand[]): Stage[] => [...new Set(xs)].map(stage);
/**
 * 순차 구간 뒤: 안 깬 칸 (위험 · 내 레벨 − FAME_LOW_GAP 밑 빼고)을 장소 레벨 순 · 쉬움 → 보통 → 어려움 (같은 장소 레벨이면 경험치 큰 던전 먼저),
 * 그다음 적정 어려움 (다 깬 뒤 반복) 가운데 적 레벨 높은 곳 → 장소 레벨 높은 곳
 */
const rest = (xs: Cand[], level: number) => [
  ...xs.filter(x => x.first && x.fit !== '위험' && x.st >= level - FAME_LOW_GAP).sort((a, b) => a.c.stageLv - b.c.stageLv || di(a.d) - di(b.d) || Number(b.c.kind === 'dungeon') - Number(a.c.kind === 'dungeon')),
  ...xs.filter(x => x.fit === '적정' && x.d === '어려움' && !x.first).sort((a, b) => b.st - a.st || b.c.stageLv - a.c.stageLv),
];
/** 적정이 없을 때: 여유 가운데 적 레벨 높은 곳 → 도전 가운데 낮은 곳 */
const fallback = (all: Cand[]) => [
  ...all.filter(x => x.fit === '여유').sort((a, b) => b.st - a.st || di(b.d) - di(a.d)),
  ...all.filter(x => x.fit === '도전').sort((a, b) => a.st - b.st || di(a.d) - di(b.d)),
];
const stage = (x: Cand): Stage => ({ content: x.c.key, diff: x.d });

/** 실제 레벨로 들어갈 수 있는지 (개발 빌드 「레벨 잠금 무시」로 열린 곳은 추천하지 않음) */
export const realOpen = (c: ContentDef, d: DiffName) => {
  const p = lockOf(c), l = lockOf(c, d);
  return !p.locked && !p.dev && !l.locked && !l.dev;
};
/** 지금 캐릭터의 길잡이 맥락 */
export function guideCtx(): GuideCtx {
  const lv = G.save.player.level;
  return { level: lv, gear: avgScore(G.save.gear.equipped, lv), clears: G.save.clears, open: realOpen };
}

/** 지금 추천 칸 (없으면 null) */
export const guide = (): Stage | null => rankStages(guideCtx())[0] ?? null;

/** 지금 캐릭터 기준 그 칸의 적합도 */
export function fitNow(c: ContentDef, d: DiffName): Fit {
  const lv = G.save.player.level;
  return fitOf(c, d, lv, avgScore(G.save.gear.equipped, lv));
}

/**
 * 출전 화면 난이도 칸 꼬리표 (여유 · 적정 · 도전 · 위험): 지금 레벨로 들어갈 수 있는 칸만. 장소 · 난이도가 레벨로 잠겼거나
 * (개발 빌드 「레벨 잠금 무시」로 열린 곳 포함) 앞 난이도를 못 깼거나 준비 중이면 없음 (2026-10-17 Lim 「지금 레벨로 진입 못하는 레이드의 난이도 버튼이 적정」)
 */
export const fitShown = (c: ContentDef, d: DiffName): Fit | null => (c.ready && realOpen(c, d) ? fitNow(c, d) : null);
