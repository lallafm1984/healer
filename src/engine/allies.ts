/** 79 직업 (점성술사 · 수도사 · 결계사)이 같이 쓰는 아군 고르기 (예전엔 직업 파일마다 같은 줄을 복사해 둠) */
import { hexDist } from './board';
import { cellOf, healTop, living } from './core';
import type { Fight, Unit } from './types';

/** 회복할 자리가 있음 (최대 체력 · 받는 치유 제한 아래) */
export const hurt = (v: Unit) => v.hp < healTop(v) - 1e-9;
/** 저절로 가는 회복 (튀는 · 옮겨 가는 · 이어진 회복)이 고르지 않는 아군: 뒤집힌 축복 (힐이 피해가 됨) */
export const shun = (v: Unit) => v.debuffs.length > 0 && v.debuffs.some(d => d.invert);
/** c칸에서 r칸 안의 살아 있는 아군 */
export const near = (f: Fight, c: number, r: number) => { const x = f.cells[c]; return living(f).filter(v => hexDist(cellOf(f, v), x) <= r); };
/** u 바로 옆 (1칸) 다친 아군을 체력 비율이 낮은 순서로 n명 (뒤집힌 축복은 빼고) */
export const adjHurt = (f: Fight, u: Unit, n: number): Unit[] => {
  const c = cellOf(f, u);
  return living(f).filter(v => v !== u && hurt(v) && !shun(v) && hexDist(cellOf(f, v), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, n);
};
