/** 쓰러진 파티원 되살리기 (드루이드 환생 · 장비 특수능력). 2026-10-16 소비 아이템 (부활 깃털 등)은 없앰 */
import { hexDist } from './board';
import { bark, emit } from './core';
import { dangerAt } from './movement';
import { specRevive } from './specials';
import type { Fight, Unit } from './types';

/** 되살릴 대상: 쓰러진 탱커 우선, 그다음 가장 최근에 쓰러진 파티원 */
export function reviveTarget(f: Fight): Unit | null {
  const dead = f.party.filter(u => !u.alive && !u.me);
  if (!dead.length) return null;
  const tanks = dead.filter(u => u.role === 'tank');
  const pool = tanks.length ? tanks : dead;
  return pool.reduce((a, b) => ((b.diedAt || 0) > (a.diedAt || 0) ? b : a));
}

/** 쓰러진 파티원을 체력 pct로 일으킴 (드루이드 환생 등). 원래 칸이 차 있으면 가까운 빈 칸 */
export function reviveUnit(f: Fight, u: Unit, pct: number): boolean {
  let c = f.cells[u.cell];
  if (c.unit || c.block) {
    const free = f.cells.filter(x => !x.unit && !x.block && !dangerAt(f, x.i));
    const any = free.length ? free : f.cells.filter(x => !x.unit && !x.block);
    if (!any.length) return false;
    c = any.reduce((a, b) => (hexDist(b, f.cells[u.cell]) < hexDist(a, f.cells[u.cell]) ? b : a));
  }
  u.alive = true; u.max = u.base; u.hp = u.max * pct; u.cell = c.i; c.unit = u;
  u.debuffs = []; u.moving = null; u.react = null; u.fleeing = false; u.sulking = false; u.retryAt = f.t + 1;
  if (f.sp) specRevive(f, u); // 일어서는 빛 (42 보호 09)
  emit(f, { type: 'revive', id: u.id });
  emit(f, { type: 'sound', name: 'chime' });
  bark(f, u, '살았다…! 감사', true, 'revived');
  return true;
}
