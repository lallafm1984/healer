/** 난이도 (02 부록 A, 04 2-2). dmg = 받는 피해 배율, dodge = 파티원 회피 확률, react = 반응 시간 배율 */
export type DiffName = '쉬움' | '보통' | '어려움' | '악몽';

export interface Difficulty {
  dmg: number;
  dodge: number;
  react: number;
}

export const DIFFS: Record<DiffName, Difficulty> = {
  '쉬움': { dmg: 0.8, dodge: 0.95, react: 0.7 },
  '보통': { dmg: 1.0, dodge: 0.85, react: 1.0 },
  '어려움': { dmg: 1.2, dodge: 0.75, react: 1.2 },
  '악몽': { dmg: 1.4, dodge: 0.65, react: 1.4 },
};

/** 악몽 보정: 파티원 체력·딜 ×1.15, 보스 체력 ×1.3 (20인 레이드는 보스 체력 보정 없음) */
export const MYTHIC = { party: 1.15, bossHp: 1.3 } as const;
