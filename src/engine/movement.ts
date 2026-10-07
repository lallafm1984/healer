import { hexDist } from './board';
import { bark, cellOf, living } from './core';
import type { Cell, Fight, Role, Telegraph, Unit, Zone } from './types';

export type Zone3 = 'front' | 'mid' | 'back';

export function zoneOf(f: Fight, row: number): Zone3 {
  const x = f.rows === 1 ? 0 : row / (f.rows - 1);
  return x < 0.34 ? 'front' : x > 0.66 ? 'back' : 'mid';
}

/** 역할별 선호 줄 (04 5-2) */
export const ZONE_PREF: Record<Role, Record<Zone3, number>> = {
  tank: { front: 70, mid: 0, back: -40 },
  melee: { front: 20, mid: 15, back: -10 },
  ranged: { front: -10, mid: 5, back: 20 },
  healer: { front: -30, mid: 5, back: 25 },
};

export function adjAllies(f: Fight, cell: Cell, self: Unit): number {
  let n = 0;
  for (const c of f.cells) if (c.unit && c.unit !== self && c.unit.alive && hexDist(c, cell) === 1) n++;
  return n;
}

export function centerX(f: Fight): number {
  let a = Infinity, b = -Infinity;
  for (const c of f.cells) { a = Math.min(a, c.px); b = Math.max(b, c.px); }
  return (a + b) / 2;
}

export function dangerAt(f: Fight, idx: number, extra?: Set<number>): boolean {
  if (extra && extra.has(idx)) return true;
  for (const z of f.zones) if (z.cells.has(idx)) return true;
  for (const t of f.tels) if (t.kind === 'zone' && t.cells.has(idx)) return true;
  return false;
}

export interface PickOpts {
  safe?: boolean;
  extra?: Set<number>;
  back?: boolean;
  home?: boolean;
}

/** 이동할 칸 고르기 (04 5-1) */
export function pickCell(f: Fight, u: Unit, opts: PickOpts): Cell | null {
  const cur = cellOf(f, u);
  let best: Cell | null = null, bs = -Infinity;
  for (const c of f.cells) {
    if (c.unit && c.unit !== u) continue;
    if (c.i === u.cell) continue;
    if (opts.safe && dangerAt(f, c.i, opts.extra)) continue;
    let s = 100;
    s += ZONE_PREF[u.role][zoneOf(f, c.row)] * (u.role === 'tank' ? 1 : 0.8);
    s += (u.p.dist || 0) * adjAllies(f, c, u) * 8;
    s -= 10 * hexDist(cur, c);
    if (opts.back) s += c.row * 40 - adjAllies(f, c, u) * 5;
    if (opts.home && c.i === u.home) s += 60;
    s += f.rng() * 2;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}

export function moveTo(f: Fight, u: Unit, c: Cell | null): boolean {
  if (!c) return false;
  const from = cellOf(f, u);
  let time = 0.4 * Math.max(1, hexDist(from, c));
  if (u.cls === 'rogue') time *= 0.75;
  c.unit = u;
  u.moving = { from: from.i, to: c.i, left: time, total: time };
  return true;
}

export function finishMove(f: Fight, u: Unit): void {
  const m = u.moving!;
  f.cells[m.from].unit = null;
  u.cell = m.to;
  u.moving = null;
}

/** 장판 예고에 대한 반응 예약 */
export function scheduleReactions(f: Fight, tel: Telegraph): void {
  for (const u of living(f)) {
    const pos = u.moving ? u.moving.to : u.cell;
    const inZ = tel.cells.has(pos);
    let rt = 0.8 * f.diff.react * (u.p.react || 1);
    if (u.me) rt = 0.6 * f.diff.react;
    else if (u.cls === 'mage') rt += 0.2;
    if (inZ) {
      let at = f.t + rt;
      if (u.p.greedy) at = Math.max(at, tel.impact - 0.3);
      u.react = { at, tel: tel.id };
    } else if (u.p.wrongWay && f.rng() < u.p.wrongWay && !u.fleeing) {
      u.react = { at: f.t + rt, tel: tel.id, wrong: true };
      u.wrongUntil = f.t + rt;
    }
  }
}

export function zoneThreat(f: Fight, tel: Telegraph | Zone): number {
  return (tel.dps || 0) * 2 * f.dmgMult;
}

export function dodgeRate(f: Fight, u: Unit): number {
  if (u.cls === 'rogue') return Math.max(0.05, Math.min(0.98, f.diff.dodge + (u.p.dodge || 0) + 0.08));
  return Math.max(0.05, Math.min(0.98, u.me ? f.diff.dodge + 0.1 : f.diff.dodge + (u.p.dodge || 0)));
}

export function doReact(f: Fight, u: Unit): void {
  const r = u.react!; u.react = null;
  const tel: Telegraph | Zone | undefined = f.tels.find(t => t.id === r.tel) || f.zones.find(z => z.id === r.tel);
  if (!tel) return;
  if (r.wrong) {
    const free = f.cells.filter(c => !c.unit && tel.cells.has(c.i));
    if (free.length) { moveTo(f, u, free[Math.floor(f.rng() * free.length)]); bark(f, u, u.p.barks![1], true); }
    return;
  }
  if (u.p.stubborn && zoneThreat(f, tel) < u.p.stubborn * u.max) { u.ignoreZone = tel.id; bark(f, u, u.p.barks![0]); return; }
  if (u.p.brave && u.hp / u.max >= u.p.brave) { u.retryAt = f.t + 1; bark(f, u, u.p.barks![0]); return; }
  const rate = dodgeRate(f, u);
  const impact = 'impact' in tel ? tel.impact : 0;
  if (f.rng() < rate) {
    const c = pickCell(f, u, { safe: true, extra: tel.cells });
    if (c) { moveTo(f, u, c); if (u.pers === '신중파') bark(f, u); }
    else { bark(f, u, '피할 곳이 없어!', true); u.retryAt = f.t + 1.5; }
  } else {
    u.mistakeUntil = Math.max(f.t, (impact || f.t) - 0.5) + 0.5;
    u.retryAt = (impact || f.t) + 1.5 + f.rng() * 2.5;
    bark(f, u, null, true);
  }
}
