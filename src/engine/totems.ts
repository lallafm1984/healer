/**
 * 판 위 물건 (79 6-1): 주술사 샘 · 대지 토템, 바다의 자리, 수도사 안개 샘, 결계사 성채, 점성술사 초신성.
 * 칸 위에 서지만 길을 막지 않는다 (파티원이 그 칸에 서도 됨). 효과 (회복 · 피해 감소)는 직업 코드 (heroes.ts)가 이 목록을 보고 낸다.
 * 깨짐 (79 2-3): 그 칸에 장판이 생기거나, 예고 공격이 그 칸에 떨어지거나 (이번 틱에 맞는 예고), 그 칸에 쫄 · 영혼이 나오면. firm이면 안 깨짐
 */
import { emit } from './core';
import { totemGone } from './heroes';
import type { Fight, Totem, TotemKind } from './types';

/** 한 칸에 하나만 서는 토템: 주술사 샘 · 대지 (2026-10-16 Lim 「그 칸에 토템이 이미 있으면 전 토템은 없어지고 새로 세운 것만」, 그림 · 효과 모두) */
export const ONE_PER_CELL: ReadonlySet<TotemKind> = new Set<TotemKind>(['spring', 'earth']);
/** 그 칸에 서 있는 샘 · 대지 토템 */
export const shamanTotemAt = (f: Fight, cell: number): Totem | undefined => f.totems.find(t => t.cell === cell && ONE_PER_CELL.has(t.kind));

/**
 * 그 종류의 물건을 칸에 세움. 종류마다 max개까지, 넘으면 가장 오래된 것이 사라짐 (79 2-3 「종류마다 하나」, 특성 두 개의 샘 · 두 대지면 2).
 * 샘 · 대지 토템은 그 칸에 서 있던 샘 · 대지 토템을 밀어냄 (ONE_PER_CELL)
 */
export function placeTotem(f: Fight, kind: TotemKind, cell: number, sec: number, o: { max?: number; firm?: boolean; tick?: number } = {}): Totem {
  const same = f.totems.filter(t => t.kind === kind).sort((a, b) => a.at - b.at);
  const max = o.max ?? 1;
  for (const old of same.slice(0, Math.max(0, same.length - max + 1))) { f.totems = f.totems.filter(t => t !== old); totemGone(f, old, false); }
  if (ONE_PER_CELL.has(kind)) for (const old of f.totems.filter(t => t.cell === cell && ONE_PER_CELL.has(t.kind))) { f.totems = f.totems.filter(t => t !== old); totemGone(f, old, false); }
  const t: Totem = { kind, cell, until: f.t + sec, tick: o.tick ?? 0, at: f.t, firm: o.firm };
  f.totems.push(t);
  return t;
}

/** 판 위 그 종류 물건 (세운 순서) */
export const totemsOf = (f: Fight, kind: TotemKind): Totem[] => f.totems.filter(t => t.kind === kind);

/** 이 칸에 선 물건이 깨지는지: 장판 · 이번 틱에 맞는 예고 · 쫄 · 영혼 */
export function totemBreaks(f: Fight, cell: number): boolean {
  const c = f.cells[cell];
  if (c.block === 'add' || c.block === 'soul' || c.block === 'hole') return true;
  if (f.zones.length && f.zones.some(z => z.cells.has(cell))) return true;
  return f.tels.length > 0 && f.tels.some(t => t.impact <= f.t + 1e-9 && t.cells.has(cell));
}

/** 판 위 물건 한 틱 (healerTick): 시간이 다 되면 사라지고, 깨지는 칸이면 깨짐 (작은 무너짐 이펙트) */
export function totemsTick(f: Fight): void {
  for (const t of f.totems.slice()) {
    if (f.t + 1e-9 >= t.until) { f.totems = f.totems.filter(x => x !== t); totemGone(f, t, false); continue; }
    if (!t.firm && totemBreaks(f, t.cell)) {
      f.totems = f.totems.filter(x => x !== t);
      emit(f, { type: 'fx', name: 'crumble', cell: t.cell });
      totemGone(f, t, true);
    }
  }
}

/** 물건을 다른 칸으로 옮김 (주술사 특성 토템 부르기): 남은 시간은 그대로 */
export function moveTotem(t: Totem, cell: number): void {
  t.cell = cell;
}
