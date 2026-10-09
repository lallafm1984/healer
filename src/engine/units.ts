import { aimMult, rageMult } from '../data/classes';
import { hexDist } from './board';
import { BARK, DRUID_BIG } from '../data/heroConst';
import { bark, cellOf, damage, DT, emit, heal, hpLineTick, onDebuffEnd } from './core';
import { dangerAt, dodgeRate, doReact, finishMove, moveTo, pickCell } from './movement';
import { calmHymn, renewEnd } from './talents';
import { charmTick, pullTick } from './bossParts';
import { abFear, dpsMods, hasMod } from './abilities';
import type { PersName } from '../data/personalities';
import type { Cell, Fight, Unit } from './types';

/** 파티원 한 틱: 지속 효과, 디버프, 장판 피해, 이동, 0.2초마다 판단 (04 4장) */
export function unitTick(f: Fight, u: Unit): void {
  const dt = DT;
  if (u.flash > 0) u.flash -= dt;
  if (!u.alive) return;
  if (u.hot > 0) {
    u.hot -= dt; u.hotTick += dt;
    if (u.hotTick >= 3 - 1e-9) { u.hotTick -= 3; heal(f, u, 80, false); }
    if (u.hot <= 0 && f.tx.on.hopRenew && u.alive) renewEnd(f, u); // 옮겨 가는 소생
  }
  if (u.hots.length) hotTick(f, u, dt);
  if (u.redu > 0) u.redu -= dt;
  if (u.sacr > 0) u.sacr -= dt;
  if (u.immune > 0) u.immune -= dt;
  for (const e of u.echo) { heal(f, u, e.rate * dt, false); e.left -= dt; }
  u.echo = u.echo.filter(e => e.left > 0);
  if (u.guardian > 0) u.guardian -= dt;
  if (u.shield > 0) u.shield -= dt;
  if (u.bulwark > 0) u.bulwark -= dt;
  if (u.thanks > 0) u.thanks -= dt;
  if (u.cls) { if (u.flow > 0) u.flow -= dt; u.aim = u.moving ? (u.mods.length && hasMod(u, 'aim') ? u.aim : 0) : u.aim + dt; }
  for (const d of u.debuffs.slice()) {
    d.left -= dt;
    if ((d.cureAt != null || d.grow) && hpLineTick(f, u, d, dt)) continue;
    if (d.charm && charmTick(f, u, d)) continue; // 매혹 (P-CHARM)
    if (d.untilBossLoss != null && f.bossHp <= d.bossAt! - f.bossMax * d.untilBossLoss + 1e-9) { // 삼키기: 보스를 그만큼 깎으면 풀림
      u.debuffs = u.debuffs.filter(x => x !== d); emit(f, { type: 'cure', id: u.id, name: d.name }); continue;
    }
    if (d.grow) { if (d.stack) damage(f, u, d.stack * d.grow.dot * dt, true); }
    else if (d.dot) damage(f, u, d.stackMax ? d.dot * (d.stack ?? 1) * dt : d.dot * dt, true);
    if (!u.alive) return;
    if (d.left <= 0) { u.debuffs = u.debuffs.filter(x => x !== d); onDebuffEnd(f, u, d, false); }
  }
  if (!u.alive) return;
  for (const z of f.zones) if (z.cells.has(u.cell) && !(u.debuffs.length && u.debuffs.some(d => d.hide))) damage(f, u, z.dps * dt, true);
  if (!u.alive) return;
  if (u.moving) { u.moving.left -= dt; if (u.moving.left <= 0) finishMove(f, u); }
  if (u.pulled) pullTick(f, u);
  if (u.debuffs.length && u.debuffs.some(d => d.noMove)) return; // 얼림·삼킴: 제자리
  if (u.mods.length && hasMod(u, 'stop')) return; // 붕대 감기·명상·얼음 방패: 멈춤
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
  // 도망: 겁쟁이 (50%). 쉼터가 있으면 신중파도 40% 아래에서 쉼터로 (사제 특성, 06 6장)
  const shelter = shelterFor(f);
  const fleeAt = u.p.flee || (shelter && u.pers && SHELTER_GO.includes(u.pers) ? SHELTER_GO_HP : 0);
  if (fleeAt || u.fleeing) {
    if (!u.fleeing && fleeAt && u.hp / u.max < fleeAt && !calmHymn(f) && !((u.ab || u.mods.length) && abFear(f, u))) {
      const c = shelter || pickCell(f, u, { safe: true, back: true });
      if (c) { moveTo(f, u, c); u.fleeing = true; bark(f, u, u.p.flee ? u.p.barks![0] : '쉼터로!', true, u.p.flee ? 'flee' : 'shelter'); }
    } else if (u.fleeing && u.hp / u.max >= 0.8) {
      u.fleeing = false;
      const c = pickCell(f, u, { safe: true, home: true });
      if (c && hexDist(c, cellOf(f, u)) >= 1) moveTo(f, u, c);
    }
  }
  // 회피가 끝나면 원래 자리로 복귀 (04 3장 상태 머신). 신중파는 1초 더 기다림
  if (!u.fleeing && !u.pulled && !(u.padUntil != null && u.padUntil > f.t) && u.home >= 0 && u.cell !== u.home) {
    const h = f.cells[u.home];
    if (!h.unit && !h.block && !dangerAt(f, u.home)) {
      if (u.homeAt == null) u.homeAt = f.t + 1 + (u.p.react && u.p.react < 1 ? 1 : 0);
      else if (f.t >= u.homeAt) { u.homeAt = null; moveTo(f, u, h); return; }
    } else u.homeAt = null;
  }
  if (u.p.attention && !u.sulking && f.t - u.lastHeal > u.p.attention && f.t > 8) { u.sulking = true; bark(f, u, null, true, 'sulk'); }
}

/** 쉼터가 있으면 도망 대신 쉼터로 가는 성격과 체력 (06 6장. 소심이는 아직 없는 성격) */
const SHELTER_GO: PersName[] = ['신중파'];
const SHELTER_GO_HP = 0.4;

/** 쉼터 (사제 특성): 비어 있고 위험하지 않으면 도망가는 파티원이 그리로 */
function shelterFor(f: Fight): Cell | null {
  const i = f.tx.shelter;
  return i >= 0 && !f.cells[i].unit && !dangerAt(f, i) ? f.cells[i] : null;
}

/** 지속 힐 틱 (드루이드·성기사). 다 차면 직업 패시브(순환)로 마나를 돌려줄 수 있게 이벤트 대신 콜백 */
export function hotTick(f: Fight, u: Unit, dt: number): void {
  for (const h of u.hots.slice()) {
    h.left -= dt; h.tick -= dt;
    while (h.tick <= 1e-9 && h.rest > 0) {
      const amt = h.amts ? (h.amts[h.i] ?? 0) : h.per;
      h.i++; h.tick += h.every;
      h.rest = Math.max(0, h.rest - amt);
      heal(f, u, amt * hotMult(f, u, h), false);
      if (!u.alive) return;
    }
    if (h.left <= 1e-9 || h.rest <= 1e-9) {
      u.hots = u.hots.filter(x => x !== h);
      if (h.key === 'sprout' && h.rest <= 1e-9) f.mana = Math.min(100, f.mana + (f.level >= 10 ? 0.4 : 0)); // 순환 (25 드루이드 패시브)
    }
  }
}

/** 지속 힐 배율: 나무껍질(+20%), 드루이드 군락 (붙어 있는 새싹마다 +10%, 최대 +30%. 20인은 +30%씩 최대 +90%, 들꽃 군락에도) */
function hotMult(f: Fight, u: Unit, h: { key: string }): number {
  let m = u.redu > 0 && u.reduCut === BARK.cut ? 1 + BARK.hot : 1;
  if ((h.key === 'sprout' || (h.key === 'wildflower' && f.enc.big)) && f.level >= 6) {
    const c = cellOf(f, u);
    let n = 0;
    for (const v of f.party) if (v !== u && v.alive && v.hots.some(x => x.key === 'sprout') && hexDist(cellOf(f, v), c) === 1) n++;
    m *= 1 + Math.min(3, n) * (f.enc.big ? DRUID_BIG.colonyStep : 0.1); // 20인 보정 (26 9-1)
  }
  return m;
}

/** 지금 파티 초당 딜 (이동·도망 중은 0, 삐짐 -25%, 감사 +10%, 직업 패시브) */
export function partyDps(f: Fight): number {
  let s = 0;
  for (const u of f.party) s += unitDps(u);
  return s;
}

/** 파티원 1명 초당 딜 */
export function unitDps(u: Unit): number {
  if (!u.alive || u.fleeing || u.me) return 0;
  if (u.debuffs.length && u.debuffs.some(d => d.noDps)) return 0; // 얼림·침묵·삼킴
  if (u.immune > 0) return 0; // 보호의 손: 그동안 딜 0
  if (u.moving && u.cls !== 'hunter') return 0;
  let d = u.dps * (u.p.dps || 1);
  if (u.sulking) d *= 0.75;
  if (u.thanks > 0) d *= 1.1;
  if (u.cls) d *= classDps(u);
  if (u.mods.length) d *= dpsMods(u); // 파티원 능력 (17)
  return d;
}

/** 직업 패시브 딜 배율 (17 2장) */
function classDps(u: Unit): number {
  switch (u.cls) {
    case 'berserker': return rageMult(u.hp / u.max);
    case 'swordsman': return u.flow > 0 ? 1.15 : 1;
    case 'archer': return aimMult(u.aim);
    case 'hunter': return u.moving ? 0.6 : 1;
    default: return 1;
  }
}
