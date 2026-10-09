/** 힐러 장비 (08 4-2, sim gear_stats). 등급별 [힐량 보정, 보조 능력치 개수] */
export type GradeName = '없음' | '일반' | '고급' | '희귀' | '영웅' | '전설';

export const GRADE: Record<GradeName, readonly [number, number]> = {
  '없음': [0, 0],
  '일반': [0.02, 0],
  '고급': [0.04, 1],
  '희귀': [0.06, 2],
  '영웅': [0.08, 3],
  '전설': [0.10, 3],
};

export type GearId = 'none' | 'adv0' | 'rare5' | 'epic5';

export interface GearPreset {
  label: string;
  /** 6부위 공통 등급 */
  g: GradeName;
  /** 강화 단계 */
  u: number;
}

export const GEARS: Record<GearId, GearPreset> = {
  none: { label: '장비 없음', g: '없음', u: 0 },
  adv0: { label: '고급 +0', g: '고급', u: 0 },
  rare5: { label: '희귀 +5', g: '희귀', u: 5 },
  epic5: { label: '영웅 +5', g: '영웅', u: 5 },
};

export interface GearStats {
  heal: number;
  regen: number;
  haste: number;
  /** 장비 치명타 몫. 기본 치명타는 엔진이 더함 (data/rules baseCrit) */
  crit: number;
}

export function gearStats(id: GearId): GearStats {
  const { g, u } = GEARS[id];
  const [h, s] = GRADE[g];
  const n = (6 * s) / 3;
  return { heal: g === '없음' ? 1 : 1 + 6 * (h + 0.005 * u), regen: 1 + 0.03 * n, haste: 0.02 * n, crit: 0.02 * n };
}
