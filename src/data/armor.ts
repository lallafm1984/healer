/**
 * 직업군 기본 방어력 (34 9-2, Lim 2026-10-09): 받는 「일반」 피해를 줄임. 장비와 상관없음.
 * 탱커는 처음 90%였다가 「같은 피해 100을 탱커가 30 받게」로 70% (Lim 2026-10-09).
 * 「고정」 피해(체력 비율, 대신 맞기·나눠 받기로 옮겨 가는 피해)는 방어력을 무시한다 (34 9-3).
 */
import type { Role } from '../engine/types';

export const ARMOR: Record<Role, number> = { tank: 0.7, melee: 0.5, ranged: 0.3, healer: 0.3 };

/**
 * 피해를 누구 기준으로 적었나. 수치는 「그 기준 대상이 실제로 받는 양」으로 두고 (35 1-2),
 * 엔진이 방어력 없는 값으로 바꿔 계산한다 (34 9-3: 탱커를 노리는 기술 ÷0.3, 나머지 ÷0.7과 같은 결과).
 * tank = 평타·버스터·졸개의 탱커 공격 / party = 광역·장판·지속 피해 등 나머지 (원거리·힐러 기준) / fixed = 방어력 무시
 */
export type DamageAim = 'tank' | 'party' | 'fixed';

/** 방어력을 넣은 배율. 기준 대상과 같은 직업군이면 정확히 1 */
export function armorFactor(role: Role, aim: DamageAim): number {
  if (aim === 'fixed') return 1;
  return (1 - ARMOR[role]) / (1 - ARMOR[aim === 'tank' ? 'tank' : 'ranged']);
}

/**
 * 5인 이상 보스전에서 탱커가 모두 쓰러진 뒤 보스가 광폭화하기까지 (35 6-4). 3인 탐험·잡몹 구간은 방어력만.
 * 처음엔 10인·20인만이었는데, 탱커 70%면 5인도 1분쯤 버텨서 5인까지 넓힘 (Lim 2026-10-09)
 */
export const NO_TANK_SEC = 12;
export const NO_TANK_MIN_PARTY = 5;
/** 탱커 없음 광폭화는 맞을 때마다 피해 +50% (1, 1.5, 2, …): 레이드는 다른 힐러가 있어 그냥 광폭화는 1분 넘게 버팀 */
export const NO_TANK_RAMP = 0.5;
