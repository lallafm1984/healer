/**
 * 힐러 성장·보상 수치 (P1 초안). 근거: 02 부록 B(경험치 곡선), 12 3-1(골드), 18 2-2(레벨 마일스톤), 19(소비 아이템 칸).
 * 경험치 지급량은 문서에 없어 새로 정함 (24 문서). Lv 1~100 곡선은 18 1장 도달 시점에 맞춤 (xpShare, 2026-10-07).
 */
import type { DiffName } from './difficulty';
import { CONTENT, isLeveling, type ContentDef, type ContentKey } from './content';

export const MAX_LEVEL = 100;

const lvClamp = (level: number) => Math.max(1, Math.min(MAX_LEVEL, level));

/**
 * 레벨 배율 (34 1-2): 숫자를 작게 시작해서 크게 키움. Lv 1 = 0.4 (예전 숫자 ÷2.5: 힐러 체력 220 · 치유 120),
 * 레벨마다 Lv 1 값의 +16% → Lv 100 ≈ 6.74 (전사 탱커 Lv 100 체력 6,399 · 수호기사 6,079, 2026-10-13 Lim 「100레벨 탱커 6천대」. 예전 +22%는 9.1 · 전사 8,656).
 * 힐러 힐량·체력과 파티원·적 체력·피해·딜 모두 이 배율로 곱한다. 세기 차이는 적 세기 0.95 (rules.ts) · 장비 · 특성 · 난이도.
 * 마나는 % 체계라 레벨로 늘지 않음 (18 2-1).
 */
export const NUM_SCALE = 0.4;
export const LV_GROWTH = 0.16;
export const lvPower = (level: number) => NUM_SCALE * (1 + LV_GROWTH * (lvClamp(level) - 1));
/** 프로토타입 레벨 배율 (34 이전, parity 테스트): Lv 1 = 1.0, 레벨마다 +0.08 */
export const lvPowerProto = (level: number) => 1 + 0.08 * (lvClamp(level) - 1);

/** 다음 레벨까지 필요한 경험치 (02 부록 B: 100 × 레벨^1.6) */
export const xpToNext = (level: number) => (level >= MAX_LEVEL ? Infinity : Math.round(100 * level ** 1.6));

export type Grade = 'S' | 'A' | 'B' | 'C';

/** 정산 등급: 던전 전체 쓰러진 파티원 수 (프로토타입과 같음) */
export const gradeOf = (deaths: number): Grade => (deaths === 0 ? 'S' : deaths === 1 ? 'A' : deaths <= 3 ? 'B' : 'C');

/** 골드·경험치 배율 (12 3-1) */
export const REWARD_DIFF: Record<DiffName, number> = { '쉬움': 0.8, '보통': 1.0, '어려움': 1.3, '악몽': 1.6 };
export const REWARD_GRADE: Record<Grade, number> = { S: 1.2, A: 1.1, B: 1.0, C: 0.9 };

/** 레이드 보스 1마리 골드 배율 (26 6장): 10인 ×1.5, 20인 ×2.2 (레벨 맞춤으로 2·3에서 낮춤, 32 3-2) */
export const RAID_GOLD = { 10: 1.5, 20: 2.2 } as const;
/** 탐험 골드·경험치 배율 (32 3-3): 구간 1개라 짧고 쉬움. 적 레벨이 내 레벨이 되며 던전보다 나은 파밍 자리가 되지 않게 */
export const EXPLORE_REWARD = 0.35;

/** 클리어 골드 = (50 + 10 × 적 레벨) × 난이도 × 등급. 레이드는 보스 1마리마다 × RAID_GOLD (12 3-1). raid = 레이드 인원 (0 = 던전·탐험) */
export function clearGold(stageLv: number, diff: DiffName, grade: Grade, raid: 0 | 10 | 20 = 0): number {
  const g = (50 + 10 * stageLv) * REWARD_DIFF[diff] * REWARD_GRADE[grade];
  return Math.round(raid ? g * RAID_GOLD[raid] : g);
}

/**
 * 클리어 경험치 = 지금 레벨에서 필요한 양의 이 비율 × 난이도 × 등급 (18 1장 도달 시점에 맞춤).
 * 낮은 레벨은 1판 ≈ 1레벨, 높을수록 판 수가 늘어남. Lv 15부터 ×0.85, Lv 70부터는 절반 (20인 레이드가 있어서).
 * 장소와의 레벨 차이에 따른 경험치 보정은 없음. 정산에서 탐험·레이드 콘텐츠 배율을 적용함.
 */
export const xpShare = (level: number) => Math.min(1, 14 * level ** -1.1) * (level >= 15 ? 0.85 : 1) * (level >= 70 ? 0.5 : 1);
/** 레이드 한 판 = 던전 한 판의 10인 1.2배, 20인 1.4배 (전투가 더 김, 26 6장. 레벨 맞춤으로 1.5·2에서 낮춤, 32 3-1) */
export const XP_RAID = { 10: 1.2, 20: 1.4 } as const;
/** 이긴 판만 경험치. 지면 (전멸 · 포기) 없음 (2026-10-13 Lim, 예전엔 20%) */
export function clearXp(level: number, diff: DiffName, grade: Grade | null, opts: { raid?: 0 | 10 | 20; win: boolean }): number {
  if (level >= MAX_LEVEL || !opts.win) return 0;
  const g = grade ? REWARD_GRADE[grade] : 1;
  const x = xpToNext(level) * xpShare(level) * REWARD_DIFF[diff] * g * (opts.raid ? XP_RAID[opts.raid] : 1);
  return Math.max(1, Math.round(x));
}

/**
 * 초반 순차 레벨링 (70, Lim 2026-10-12): 내 레벨이 RAMP_LV 이하일 때 장소 Lv RAMP_LV까지의 탐험 · 던전은 경험치를 장소가 정함
 * (내 레벨 · 탐험 ×0.35와 상관없이). 장소 몫 (rampSpan) = 그 장소 레벨에서 다음 장소가 열리는 레벨까지 필요한 경험치.
 * 쉬움 50% + 보통 60%를 처음 깨면 다음 장소 레벨이 됨 (어려움 · 다시 하기 없이). 첫 클리어는 등급과 상관없이 같고, 다시 깨면 RAMP_REPEAT × 등급, 지면 없음.
 * 정한 양이라 레벨이 앞서 있으면 덜 오르고 (지나온 곳 돌기는 조금만), 뒤처져 있으면 더 오름.
 * Lv RAMP_LV + 1부터는 어느 장소든 clearXp 그대로 (장소 레벨 차이 감산 없음)
 */
export const RAMP_LV = 20;
export const RAMP_FIRST: Record<DiffName, number> = { '쉬움': 0.5, '보통': 0.6, '어려움': 0.7, '악몽': 0.8 };
export const RAMP_REPEAT = 0.4;

/** 순차 레벨링 구간 장소: 장소 Lv RAMP_LV까지의 탐험 · 던전 (튜토리얼 첫 전투 빼고) */
export const rampPlace = (c: ContentDef) => isLeveling(c) && !c.hidden && c.stageLv <= RAMP_LV;
/** 순차 레벨링 구간: 내 레벨 RAMP_LV 이하 · 구간 장소 */
export const inRamp = (c: ContentDef, level: number) => level <= RAMP_LV && rampPlace(c);

const spans = new Map<ContentKey, number>();
/** 장소 몫: 장소 레벨 → 다음 탐험 · 던전이 열리는 레벨까지 필요한 경험치 (같은 레벨에 장소가 여럿이면 나눔). 녹슨 고원 1 → 3, 고철 더미 언덕 3 → 5 */
export function rampSpan(c: ContentDef): number {
  let s = spans.get(c.key);
  if (s == null) {
    const lv = CONTENT.filter(x => isLeveling(x) && !x.hidden && x.ready).map(x => x.stageLv);
    const next = Math.min(MAX_LEVEL, ...lv.filter(l => l > c.stageLv));
    let need = 0;
    for (let l = c.stageLv; l < next; l++) need += xpToNext(l);
    s = Math.round(need / Math.max(1, lv.filter(l => l === c.stageLv).length));
    spans.set(c.key, s);
  }
  return s;
}

/** 순차 레벨링 구간 장소 한 판 경험치 (first = 이 캐릭터가 이 난이도를 처음 깸) */
export function rampXp(c: ContentDef, diff: DiffName, o: { first: boolean; grade: Grade | null; win: boolean }): number {
  if (!o.win) return 0;
  const x = rampSpan(c) * RAMP_FIRST[diff] * (o.first ? 1 : RAMP_REPEAT);
  return Math.max(1, Math.round(o.first || !o.grade ? x : x * REWARD_GRADE[o.grade]));
}

/** 경험치를 더하고 오른 레벨 목록을 돌려줌 */
export function addXp(p: { level: number; xp: number }, amt: number): number[] {
  const ups: number[] = [];
  p.xp += amt;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    ups.push(p.level);
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return ups;
}

/**
 * 별 3개 (09 S08). 조건은 P1 초안 (24 문서):
 * ① 클리어 ② 아무도 안 쓰러짐(던전 전체) ③ 오버힐 40% 이하.
 * 자동 힐러 시뮬은 오버힐 30~37%라 ③은 손으로 아껴 힐하면 받는 별.
 */
export const STAR_OVERHEAL = 0.4;
export function starsOf(r: { win: boolean; deaths: number; overheal: number }): boolean[] {
  return [r.win, r.win && r.deaths === 0, r.win && r.overheal <= STAR_OVERHEAL];
}

/** 단축칸이 하나씩 열리는 레벨 (34 8장: 특성이 Lv 50에 끝나서 당김): Lv 1 = 2칸, Lv 15 = 3칸, Lv 30 = 4칸. 지금 직업 레벨 기준 */
export const ITEM_SLOT_LV = [1, 15, 30] as const;
/** 소비 아이템 단축칸 수 (18 2-2, 19, 34 8장) */
export const itemSlots = (level: number) => (level >= ITEM_SLOT_LV[2] ? 4 : level >= ITEM_SLOT_LV[1] ? 3 : 2);

/** 길드 탭 해금 (09 1-1, 18) */
export const GUILD_LEVEL = 15;
/** 특성 탭 해금 (특성 1단, 34 2-1) */
export const TALENT_LEVEL = 5;
/** 정점 수련 (34 2-2): 특성이 끝난 Lv 51부터 레벨마다 지능·체력 +0.3% (Lv 100 = +15%). 고르는 것 없음 */
export const APEX_FROM = 50;
export const APEX_STEP = 0.003;
export const apexOf = (level: number) => 1 + APEX_STEP * Math.max(0, lvClamp(level) - APEX_FROM);
