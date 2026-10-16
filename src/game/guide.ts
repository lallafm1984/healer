/**
 * 모험 길잡이 (86, 2026-10-16 Lim 「자기에게 맞는 난이도인지 잘 모르겠고, 각 컨텐츠를 찾아가면서 깨야 하는 불친절함」).
 * 탐험 · 던전 모든 장소 · 난이도 가운데 지금 내 레벨 · 장비에 맞는 칸을 골라 한 곳을 추천한다.
 * 로비 「출전」 · 다음 목표, 출전 화면 처음 고른 곳 · 추천 표시, 결과 화면 「다음」이 모두 이것을 따른다.
 *
 * 적합도 (fitOf): 그 칸을 맞춘 기준 레벨 (적 레벨, 순차 구간 장소는 70의 길에서 그 난이도에 들어가는 레벨) − 내 레벨
 *   −3 이하 여유 · −2 ~ +1 적정 · +2 ~ +3 도전 · +4 이상 위험. 권장 장비 (어려움 고급 · 악몽 희귀 +5)에 못 미치면 적어도 도전 (레벨 세기가 1.5배 넘게 앞서면 한 단계 위).
 *   클리어율 목표 (보통 95 · 어려움 85 · 악몽 75%)를 잰 조건이 「적 레벨 = 내 레벨 · 권장 장비」라서 적정 = 그 목표 근처.
 * 추천 순서:
 *   - 순차 구간 (내 Lv 20 이하, 70): 적정인 쉬움 · 보통 첫 클리어를 장소 레벨 순 · 쉬움 → 보통 (70의 길 그대로, 어려움 없이).
 *   - 그 뒤: 적정인 칸 가운데 어려운 난이도 (등급 · 경험치가 큼) → 안 깬 곳 → 적 레벨 높은 곳 (아이템 레벨) → 장소 레벨 높은 곳.
 *   적정이 없으면 여유 가운데 적 레벨 높은 곳, 그것도 없으면 도전 가운데 낮은 곳.
 */
import { ALL_DIFFS, CONTENT, isLeveling, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { avgScore, recommendedFor } from '../data/equipment';
import { lvPower, RAMP_LV, rampRefLevel, rampXp } from '../data/progression';
import { G, lockOf } from './state';

export type Fit = '여유' | '적정' | '도전' | '위험';
export const FITS: Fit[] = ['여유', '적정', '도전', '위험'];
/** 적합도 설명 (출전 화면 안내 · 화면 읽기) */
export const FIT_TEXT: Record<Fit, string> = {
  '여유': '내 레벨보다 낮음 · 장비 레벨도 낮음',
  '적정': '내 레벨 · 장비에 맞음',
  '도전': '조금 높음',
  '위험': '많이 높음',
};

export interface Stage { content: ContentKey; diff: DiffName }
/** 권장 장비가 없어도 한 단계만 어렵게 보는 레벨 세기 차이 (내 레벨 세기 ÷ 기준 레벨 세기) */
export const OVERPOWER = 1.5;

/** 그 칸을 맞춘 기준 레벨: 탐험 · 던전 = 적 레벨 (순차 구간 장소는 70의 길에서 들어가는 레벨), 레이드 = 적 레벨 (내 레벨과 열림 레벨 중 큰 쪽) */
export const refLevel = (c: ContentDef, d: DiffName, level: number) =>
  (isLeveling(c) ? rampRefLevel(c, d) ?? stageOf(c, d) : Math.max(level, stageOf(c, d)));

/** 적합도. gear = 착용 장비 평균 점수 (avgScore) */
export function fitOf(c: ContentDef, d: DiffName, level: number, gear: number): Fit {
  const gap = refLevel(c, d, level) - level;
  let i = gap <= -3 ? 0 : gap <= 1 ? 1 : gap <= 3 ? 2 : 3;
  // 권장 장비에 못 미치면 적어도 도전 (권장 장비 차이가 레벨 몇 개 앞선 것보다 훨씬 큼). 레벨 세기가 1.5배 넘게 앞서 있으면 한 단계만
  const rec = recommendedFor(c, d);
  if (rec && gear < rec.score) i = lvPower(level) >= OVERPOWER * lvPower(refLevel(c, d, level)) ? i + 1 : Math.max(i + 1, 2);
  return FITS[Math.min(FITS.length - 1, i)];
}

export interface GuideCtx {
  level: number;
  /** 착용 장비 평균 점수 */
  gear: number;
  clears: Partial<Record<string, Partial<Record<DiffName, unknown>>>>;
  /** 들어갈 수 있는 칸 (레벨 · 사슬 잠금) */
  open: (c: ContentDef, d: DiffName) => boolean;
}

interface Cand { c: ContentDef; d: DiffName; fit: Fit; first: boolean; st: number; xp: number }
const di = (d: DiffName) => ALL_DIFFS.indexOf(d);

/** 추천 순서대로 칸 목록 (탐험 · 던전만). 앞일수록 좋음 */
export function rankStages(ctx: GuideCtx): Stage[] {
  const all: Cand[] = [];
  for (const c of CONTENT) {
    if (!isLeveling(c) || c.hidden || !c.ready) continue;
    for (const d of ALL_DIFFS) {
      if (!ctx.open(c, d)) continue;
      const first = !ctx.clears[c.key]?.[d];
      all.push({ c, d, fit: fitOf(c, d, ctx.level, ctx.gear), first, st: stageOf(c, d), xp: rampXp(c, d, { first, grade: 'A', win: true }) });
    }
  }
  const fit = all.filter(x => x.fit === '적정');
  // 순차 구간: 쉬움 · 보통 첫 클리어를 장소 레벨 순 (지금 장소 보통 → 다음 장소 쉬움). 70의 길 그대로
  if (ctx.level <= RAMP_LV) {
    const ramp = fit.filter(x => di(x.d) <= 1).sort((a, b) => Number(b.first) - Number(a.first) || a.c.stageLv - b.c.stageLv || di(a.d) - di(b.d) || b.xp - a.xp);
    if (ramp.some(x => x.first)) return [...ramp, ...rest(fit.filter(x => di(x.d) > 1)), ...fallback(all)].map(stage);
  }
  return [...rest(fit), ...fallback(all)].map(stage);
}
/** 순차 구간 뒤: 어려운 난이도 → 안 깬 곳 → 적 레벨 → 장소 레벨 */
const rest = (xs: Cand[]) => xs.sort((a, b) => di(b.d) - di(a.d) || Number(b.first) - Number(a.first) || b.st - a.st || b.c.stageLv - a.c.stageLv);
/** 적정이 없을 때: 여유 가운데 적 레벨 높은 곳 → 도전 가운데 낮은 곳 */
const fallback = (all: Cand[]) => [
  ...all.filter(x => x.fit === '여유').sort((a, b) => b.st - a.st || di(b.d) - di(a.d)),
  ...all.filter(x => x.fit === '도전').sort((a, b) => a.st - b.st || di(a.d) - di(b.d)),
];
const stage = (x: Cand): Stage => ({ content: x.c.key, diff: x.d });

/** 실제 레벨로 들어갈 수 있는지 (개발 빌드 「레벨 잠금 무시」로 열린 곳은 추천하지 않음) */
const realOpen = (c: ContentDef, d: DiffName) => {
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
