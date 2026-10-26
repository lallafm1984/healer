/**
 * 위치 규칙 (2026-10-13 Lim, data/rules POS_RULES). 1열 = 적에 가장 가까운 줄 (row 0).
 * 공격 · 받는 피해는 움직이는 동안 떠난 칸 기준 (도착하면 새 줄). 탱커가 적을 잡는지는 가는 칸 기준 (1열로 나가기 시작하면 바로 잡고, 떠나기 시작하면 바로 놓침).
 * 프로토타입 규칙 (parity 테스트)에는 없음.
 */
import { hexDist } from './board';
import { emit, living, randomTargets } from './core';
import { dangerAt, moveTo } from './movement';
import type { Cell, Fight, Role, Unit } from './types';

const rowOf = (f: Fight, u: Unit): number => f.cells[u.cell]?.row ?? 0;
/** 원거리가 이 줄에 서면 약해지나 (레이드 판의 1 · 2열만) */
const rangedNear = (f: Fight, row: number): boolean => !!f.R.pos && f.rows >= f.R.pos.rangedMinRows && row < f.R.pos.rangedRows;

/** 이 사람이 1열에 서 있는 (또는 1열로 가는) 탱커인가 (규칙이 꺼져 있으면 탱커면 됨) */
export function frontTank(f: Fight, u: Unit): boolean {
  return u.role === 'tank' && (!f.R.pos || (f.cells[u.moving ? u.moving.to : u.cell]?.row ?? 0) < f.R.pos.tankRows);
}

/** 탱커가 나갈 1열 칸: 비어 있고 위험하지 않은 칸 중 가장 가까운 곳 (없으면 null) */
export function frontCell(f: Fight, u: Unit): Cell | null {
  const p = f.R.pos;
  if (!p) return null;
  const at = f.cells[u.cell];
  let best: Cell | null = null;
  for (const c of f.cells) {
    if (c.row >= p.tankRows || c.block || (c.unit && c.unit !== u) || dangerAt(f, c.i)) continue;
    if (!best || hexDist(at, c) < hexDist(at, best)) best = c;
  }
  return best;
}

/**
 * 1열에 비어 있는 안전한 칸이 없어 탱커가 못 나갈 때 (2026-10-27 Lim 「탱커가 1분가까이(거의 무한으로) 어그로를 못잡고 방황」): 안전한 1열 칸에 선 파티원
 * (탱커 · 나 말고, 탱커에게 가장 가까운 사람)이 1열 밖 가장 가까운 안전한 빈 칸으로 비켜 섬 (근접은 공격하는 줄 안, 그 칸이 새 자리). 탱커는 칸이 비면 그리로 나감.
 * 예전엔 장판이 1열 두 칸을 덮고 남은 칸에 근접이 서 있으면 장판이 걷힐 때까지 (8 ~ 9초) 탱커가 2열에서 머뭇거리며 보스를 못 잡았음. 비켰으면 true
 */
export function yieldFront(f: Fight, tank: Unit): boolean {
  const p = f.R.pos;
  if (!p) return false;
  const at = f.cells[tank.cell];
  let seat: Cell | null = null;
  for (const c of f.cells) {
    const v = c.unit;
    if (c.row >= p.tankRows || c.block || !v || v.role === 'tank' || v.me || !v.alive || v.moving || dangerAt(f, c.i)) continue;
    if (!seat || hexDist(at, c) < hexDist(at, seat)) seat = c;
  }
  if (!seat) return false;
  const v = seat.unit!;
  let best: Cell | null = null, bs = Infinity;
  for (const c of f.cells) {
    if (c.unit || c.block || c.row < p.tankRows || dangerAt(f, c.i)) continue;
    const s = hexDist(seat, c) * 10 - posPref(f, v.role, c, 100);
    if (s < bs) { bs = s; best = c; }
  }
  if (!best || !moveTo(f, v, best)) return false;
  v.home = best.i; v.homeAt = null;
  return true;
}

/** 위치에 따른 공격력 배율: 근접 (탱커 포함)은 1 · 2열 밖이면 0, 원거리는 레이드 판 1 · 2열이면 rangedDps */
export function posDps(f: Fight, u: Unit): number {
  const p = f.R.pos;
  if (!p) return 1;
  const row = rowOf(f, u);
  if (u.role === 'tank' || u.role === 'melee') return row < p.meleeRows ? 1 : 0;
  if (u.role === 'ranged') return rangedNear(f, row) ? p.rangedDps : 1;
  return 1;
}

/** 위치에 따른 받는 피해 배율: 원거리가 레이드 판 1 · 2열이면 rangedTaken */
export function posTaken(f: Fight, u: Unit): number {
  return u.role === 'ranged' && rangedNear(f, rowOf(f, u)) ? f.R.pos!.rangedTaken : 1;
}

/** 칸 고르기 (배치 · 장판 피하기) 가산점: 규칙을 지키는 칸을 고름. 막히면 어쩔 수 없이 규칙 밖으로 (그때 규칙이 작동) */
export function posPref(f: Fight, role: Role, c: Cell, w: number): number {
  const p = f.R.pos;
  if (!p) return 0;
  if (role === 'tank') return c.row < p.tankRows ? w * 1.5 : 0;
  if (role === 'melee') return c.row < p.meleeRows ? 0 : -w;
  if (role === 'ranged') return rangedNear(f, c.row) ? -w : 0;
  return 0;
}

/**
 * 탱커 앞줄 이탈 (매 틱, 보스보다 먼저): 살아 있는 탱커가 있는데 아무도 1열에 없으면 적이 다른 파티원 중 무작위 1명을 노림.
 * 노린 사람은 탱커가 1열로 돌아오거나 그 사람이 쓰러질 때까지 그대로 (쓰러지면 다시 뽑음). 다른 파티원이 없으면 나 (2인 튜토리얼)
 */
export function looseTick(f: Fight): void {
  if (!f.R.pos) return;
  const live = living(f), tanks = live.filter(u => u.role === 'tank');
  if (!tanks.length || tanks.some(u => frontTank(f, u))) {
    if (f.loose) { f.loose = null; emit(f, { type: 'loose', on: null }); }
    return;
  }
  if (f.loose && live.some(u => u.id === f.loose!.id)) return;
  const v = randomTargets(f, 1, u => u.role !== 'tank' && !u.me)[0] ?? (live.includes(f.me) ? f.me : undefined);
  if (!v) return;
  f.loose = { id: v.id, since: f.loose?.since ?? f.t };
  emit(f, { type: 'loose', on: v.id });
}
