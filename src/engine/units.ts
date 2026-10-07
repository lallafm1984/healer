import { hexDist } from './board';
import { bark, cellOf, damage, DT, heal, onDebuffEnd } from './core';
import { dangerAt, dodgeRate, doReact, finishMove, moveTo, pickCell } from './movement';
import type { Fight, Unit } from './types';

/** 파티원 한 틱: 지속 효과, 디버프, 장판 피해, 이동, 0.2초마다 판단 (04 4장) */
export function unitTick(f: Fight, u: Unit): void {
  const dt = DT;
  if (u.flash > 0) u.flash -= dt;
  if (!u.alive) return;
  if (u.hot > 0) { u.hot -= dt; u.hotTick += dt; if (u.hotTick >= 3 - 1e-9) { u.hotTick -= 3; heal(f, u, 80, false); } }
  for (const e of u.echo) { heal(f, u, e.rate * dt, false); e.left -= dt; }
  u.echo = u.echo.filter(e => e.left > 0);
  if (u.guardian > 0) u.guardian -= dt;
  if (u.shield > 0) u.shield -= dt;
  if (u.thanks > 0) u.thanks -= dt;
  for (const d of u.debuffs.slice()) {
    d.left -= dt;
    if (d.dot) damage(f, u, d.dot * dt);
    if (!u.alive) return;
    if (d.left <= 0) { u.debuffs = u.debuffs.filter(x => x !== d); onDebuffEnd(f, u, d, false); }
  }
  if (!u.alive) return;
  for (const z of f.zones) if (z.cells.has(u.cell)) damage(f, u, z.dps * dt);
  if (!u.alive) return;
  if (u.moving) { u.moving.left -= dt; if (u.moving.left <= 0) finishMove(f, u); }
  if (u.react && f.t >= u.react.at && !u.moving) doReact(f, u);
  if (f.k % 4 !== 0 || u.moving || u.react) return;
  const inZone = f.zones.find(z => z.cells.has(u.cell));
  if (inZone && u.ignoreZone !== inZone.id && f.t >= u.retryAt) {
    if (u.p.stubborn && inZone.dps * 2 * f.dmgMult < u.p.stubborn * u.max) { u.ignoreZone = inZone.id; }
    else if (u.p.brave && u.hp / u.max >= u.p.brave) { u.retryAt = f.t + 1; }
    else {
      const rate = dodgeRate(f, u);
      if (f.rng() < rate) { const c = pickCell(f, u, { safe: true }); if (c) moveTo(f, u, c); else u.retryAt = f.t + 1.5; }
      else u.retryAt = f.t + 1.5 + f.rng() * 1.5;
    }
    return;
  }
  if (u.p.flee) {
    if (!u.fleeing && u.hp / u.max < u.p.flee) {
      const c = pickCell(f, u, { safe: true, back: true });
      if (c) { moveTo(f, u, c); u.fleeing = true; bark(f, u, u.p.barks![0], true); }
    } else if (u.fleeing && u.hp / u.max >= 0.8) {
      u.fleeing = false;
      const c = pickCell(f, u, { safe: true, home: true });
      if (c && hexDist(c, cellOf(f, u)) >= 1) moveTo(f, u, c);
    }
  }
  // 회피가 끝나면 원래 자리로 복귀 (04 3장 상태 머신). 신중파는 1초 더 기다림
  if (!u.fleeing && u.home >= 0 && u.cell !== u.home) {
    const h = f.cells[u.home];
    if (!h.unit && !dangerAt(f, u.home)) {
      if (u.homeAt == null) u.homeAt = f.t + 1 + (u.p.react && u.p.react < 1 ? 1 : 0);
      else if (f.t >= u.homeAt) { u.homeAt = null; moveTo(f, u, h); return; }
    } else u.homeAt = null;
  }
  if (u.p.attention && !u.sulking && f.t - u.lastHeal > u.p.attention && f.t > 8) { u.sulking = true; bark(f, u, null, true); }
}

/** 지금 파티 초당 딜 (이동·도망 중은 0, 삐짐 -25%, 감사 +10%) */
export function partyDps(f: Fight): number {
  let s = 0;
  for (const u of f.party) {
    if (!u.alive || u.moving || u.fleeing || u.me) continue;
    let d = u.dps * (u.p.dps || 1);
    if (u.sulking) d *= 0.75;
    if (u.thanks > 0) d *= 1.1;
    s += d;
  }
  return s;
}
