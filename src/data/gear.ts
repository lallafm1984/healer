/** 힐러 장비 등급 이름과 시뮬 프리셋 (08 4-2, 34 6장). 장비 한 개의 모양은 data/equipment */
import { presetStats, statsToGear } from './equipment';

export type GradeName = '없음' | '일반' | '고급' | '희귀' | '영웅' | '전설';

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
  /** 치유 회복량 배율 (1 + 지능) */
  heal: number;
  /** 마나 재생 배율 (1 + 정신력) */
  regen: number;
  haste: number;
  /** 장비 치명타 몫. 기본 치명타는 엔진이 더함 (data/rules baseCrit) */
  crit: number;
  /** 내 최대 체력 + 비율 (34 6-5 방어구 주 능력치 · 체력 옵션). 옛 설정엔 없음 = 0 */
  hp?: number;
  /** 내가 받는 피해 − 비율 (인내, 상한 30%). 옛 설정엔 없음 = 0 */
  endure?: number;
}

/** 프로토타입 엔진의 등급별 [힐량 보정, 보조 능력치 개수] (08 4-2, sim gear_stats). 일치 테스트(proto)에서만 */
const PROTO_GRADE: Record<GradeName, readonly [number, number]> = {
  '없음': [0, 0], '일반': [0.02, 0], '고급': [0.04, 1], '희귀': [0.06, 2], '영웅': [0.08, 3], '전설': [0.10, 3],
};
/** 프로토타입 엔진의 프리셋 능력치 (34 6장 이전 장비 계산, 일치 테스트용) */
export function protoGearStats(id: GearId): GearStats {
  const { g, u } = GEARS[id];
  const [h, s] = PROTO_GRADE[g];
  const n = (6 * s) / 3;
  return { heal: g === '없음' ? 1 : 1 + 6 * (h + 0.005 * u), regen: 1 + 0.03 * n, haste: 0.02 * n, crit: 0.02 * n };
}

/** 프리셋 능력치: 6부위 모두 그 등급 · 강화의 기댓값 장비 (data/equipment presetStats) */
export function gearStats(id: GearId): GearStats {
  const { g, u } = GEARS[id];
  if (g === '없음') return { heal: 1, regen: 1, haste: 0, crit: 0, hp: 0, endure: 0 };
  return statsToGear(presetStats(g, u));
}
