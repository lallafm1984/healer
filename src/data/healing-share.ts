import type { Role } from '../engine/types';

/** 은혜 갚기: 탱커의 받은 치유가 항상 가장 크므로 역할·파티 규모별 평소 치유 몫으로 보정한다. */
const HEAL_SHARE: Record<3 | 5 | 10 | 20, Record<Exclude<Role, 'healer'>, number>> = {
  3: { tank: 0.964, melee: 0.171, ranged: 0.248 },
  5: { tank: 0.79, melee: 0.125, ranged: 0.154 },
  10: { tank: 0.543, melee: 0.082, ranged: 0.093 },
  20: { tank: 0.44, melee: 0.045, ranged: 0.055 },
};
export function healingShareScore(role: Role, got: number, total: number, size: number): number {
  const n = size <= 3 ? 3 : size <= 5 ? 5 : size <= 10 ? 10 : 20;
  return total > 0 ? got / total / (role === 'healer' ? 1 : HEAL_SHARE[n][role]) : 0;
}
