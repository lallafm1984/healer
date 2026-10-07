/**
 * 길드 (02 9장, 12 3-3, 17 8~9장, 18). 수치는 초안.
 * 길드원 = 레벨·자질·능력 ★을 가진 파티원. 편성 화면에서 골라 데려간다 (02 9-2 편성 = 공략).
 */
import { ABILITIES, AB_GRADE } from './abilities';
import type { ClassKey } from './classes';
import type { PersName } from './personalities';
import type { TraitKey } from './traits';

/** 자질 3축 ●1~●5 (17 9-1): 공격 = 딜, 맷집 = 최대 체력, 눈치 = 반응 시간·장판 회피 */
export const APT = {
  atk: [0.88, 0.94, 1, 1.06, 1.12],
  tough: [0.9, 0.95, 1, 1.05, 1.1],
  react: [1.15, 1.07, 1, 0.93, 0.85],
  dodge: [-0.04, -0.02, 0, 0.02, 0.04],
} as const;
export const APT_NAMES = ['공격', '맷집', '눈치'] as const;
export const aptIdx = (n: number | undefined) => Math.max(0, Math.min(4, (n ?? 3) - 1));

export interface GuildMember {
  id: number;
  nick: string;
  cls: ClassKey;
  pers: PersName;
  traits: TraitKey[];
  lv: number;
  xp: number;
  /** 영입 때 자질 (공격·맷집·눈치) */
  apt0: [number, number, number];
  /** 육성 포인트로 올린 자질 */
  aptUp: [number, number, number];
  ab: string;
  /** 능력 강화 ★ (육성 포인트) */
  star: number;
  /** 출전 수 */
  runs: number;
}

export type PostTier = 'normal' | 'better' | 'best';
/** 골드 모집 공고 (12 3-3): 일반 500 · 고급 2,000 · 명문 8,000. 후보 3명 중 1명 */
export const POSTS: Record<PostTier, { name: string; gold: number; lv: [number, number]; desc: string }> = {
  normal: { name: '일반', gold: 500, lv: [-6, -3], desc: '내 레벨보다 3~6 낮은 지원자' },
  better: { name: '고급', gold: 2000, lv: [-3, -1], desc: '내 레벨보다 1~3 낮은 지원자, 고급 능력이 조금 더' },
  best: { name: '명문', gold: 8000, lv: [-1, 0], desc: '내 레벨 근처 지원자, 자질 ●4 이상 40%, 고급·희귀 능력이 더' },
};
export const POST_CANDS = 3;

/** 인연 스카우트 (12 3-3, 02 9-3 ②): 공개모집에서 잘 살려 준 파티원. 목록은 최근 순 최대 */
export const SCOUT_GOLD = 300;
export const SCOUT_MAX = 8;
/** 길드원 훈련 1레벨 = 길드원 레벨 × 30 골드 (12 3-3) */
export const trainCost = (lv: number) => lv * 30;
/** 능력 다시 뽑기 · 육성 포인트 초기화 (17 8-1) */
export const REROLL_GOLD = 3000;
export const RESET_GOLD = 5000;
/** 육성 포인트 1점 골드 = 길드원 레벨 × 100 */
export const pointCost = (lv: number) => lv * 100;
/** 육성 포인트 (17 8-1): Lv 20·30 … 100에 1점씩, 모두 9점 */
export const pointsAt = (lv: number) => Math.max(0, Math.min(9, Math.floor(lv / 10) - 1));
export const pointsUsed = (m: GuildMember) => m.aptUp[0] + m.aptUp[1] + m.aptUp[2] + m.star;

/** 길드 정원 (02 9-2, 18 2-2): 시작 6 → Lv 35 12 (10인 레이드) → Lv 70 25 (20인 레이드) */
export function guildCap(level: number): { lv: number; cap: number } {
  return level >= 70 ? { lv: 3, cap: 25 } : level >= 35 ? { lv: 2, cap: 12 } : { lv: 1, cap: 6 };
}

/** 자질 합 (●) */
export const aptOf = (m: GuildMember): [number, number, number] => [0, 1, 2].map(i => Math.min(5, m.apt0[i] + m.aptUp[i])) as [number, number, number];

/** 전투력 (17 9-3): 레벨 × 100 × 자질 보정 × ★ 보정 × 능력 등급 + 특성 보정 (좋은 특성 +50) */
export function memberPower(m: Pick<GuildMember, 'lv' | 'ab' | 'star' | 'traits'> & { apt: [number, number, number] }): number {
  const sum = m.apt[0] + m.apt[1] + m.apt[2];
  const g = ABILITIES[m.ab] ? AB_GRADE[ABILITIES[m.ab].grade].mult : 1;
  return Math.round(m.lv * 100 * (1 + (sum - 9) * 0.03) * (1 + m.star * 0.02) * g + m.traits.length * 50);
}

/** 자질 한 축 뽑기 (17 9-1): ●3 46% · ●2·●4 22% · ●1·●5 5%. 명문은 ●4 이상 40% */
export function rollApt(r: () => number, best = false): number {
  const x = r();
  if (best) return x < 0.08 ? 5 : x < 0.4 ? 4 : x < 0.82 ? 3 : x < 0.97 ? 2 : 1;
  return x < 0.05 ? 1 : x < 0.27 ? 2 : x < 0.73 ? 3 : x < 0.95 ? 4 : 5;
}
