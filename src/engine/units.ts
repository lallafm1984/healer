import { aimMult, rageMult } from '../data/classes';
import { hexDist } from './board';
import { BARK, DRUID_BIG } from '../data/heroConst';
import { SKILLS } from '../data/skills';
import { bark, cellOf, damage, DT, emit, hasAbsorb, heal, hpLineTick, onDebuffEnd } from './core';
import { dangerAt, dodgeRate, doReact, finishMove, moveTo, pickCell } from './movement';
import { calmHymn, renewEnd } from './talents';
import { charmTick, pullTick } from './bossParts';
import { abFear, dpsMods, hasMod } from './abilities';
import { dotSpec, dpsSpec, hotDone, shieldGone, sv, under } from './specials';
import { barkCut } from './heroes';
import type { PersName } from '../data/personalities';
import type { Cell, Debuff, Fight, Unit } from './types';

/** 비켜 설 디버프: 보스를 키우는 옮겨붙음 (P-JUMP) · 부풀기 (P-SWELL, 46 4-1 성격 포인트) */
const awayFrom = (d: Debuff): boolean => !!d.swell || (d.end?.p === 'jump' && d.end.boost > 0);
/**
 * 비켜 서기: 사교형은 그대로, 눈치 (회피율)에 따라 놓침. 옆에 아무도 없는 안전한 칸 중 가장 가까운 곳, 디버프가 끝날 때까지 머묾.
 * 작은 판 (5인 10칸)에서 그런 칸이 없으면 옆 사람이 지금보다 적은 칸 중 가장 적은 곳 (2026-10-10)
 */
function stepAway(f: Fight, u: Unit, sec: number): boolean {
  for (const d of u.debuffs) if (awayFrom(d)) d.stepped = true;
  if ((u.p.dist ?? 0) > 0 || f.rng() >= dodgeRate(f, u)) return false;
  if (!f.party.some(v => v !== u && v.alive && hexDist(cellOf(f, v), cellOf(f, u)) === 1)) return false;
  const cur = cellOf(f, u);
  const nearAt = (c: Cell) => f.party.filter(v => v !== u && v.alive && hexDist(f.cells[v.moving ? v.moving.to : v.cell], c) <= 1).length;
  let best: Cell | null = null, fewest = nearAt(cur);
  for (const c of f.cells) {
    if (c.block || (c.unit && c.unit !== u) || dangerAt(f, c.i)) continue;
    const n = nearAt(c);
    if (n < fewest || (n === fewest && best && hexDist(cur, c) < hexDist(cur, best))) { best = c; fewest = n; }
  }
  if (!best || !moveTo(f, u, best)) return false;
  u.awayUntil = f.t + sec + 0.5; u.homeAt = null;
  return true;
}

/**
 * 녹는 보호막 (P-MELT, 51 5장): 흡수 보호막은 초마다 남은 양의 rate씩 녹고, 보호막 · 외부 생존기 (수호 영혼 · 나무껍질 · 희생)는 한 번 더 줄어듦 (두 배 빠르게).
 * 성역 피해 감소 (안에 있는 동안 틱마다 dt × 2로 다시 참)는 그대로
 */
function meltTick(f: Fight, u: Unit, dt: number): void {
  const k = Math.pow(1 - f.melt!.rate, dt), had = hasAbsorb(f, u);
  for (const m of u.mods) if (m.k === 'absorb') { m.v *= k; if (m.v < u.max * 0.01) m.until = 0; } // 거의 다 녹으면 사라짐
  if (had && f.sp && !hasAbsorb(f, u)) shieldGone(f, u); // 따끈한 조약돌 (51 6장)
  if (u.shield > 0) u.shield -= dt;
  if (u.guardian > 0) u.guardian -= dt;
  if (u.sacr > 0) u.sacr -= dt;
  if (u.redu > dt * 2 + 1e-9) u.redu -= dt;
}

/** 파티원 한 틱: 지속 효과, 디버프, 장판 피해, 이동, 0.2초마다 판단 (04 4장) */
export function unitTick(f: Fight, u: Unit): void {
  const dt = DT;
  if (u.flash > 0) u.flash -= dt;
  if (!u.alive) return;
  if (u.hot > 0) {
    u.hot -= dt; u.hotTick += dt;
    if (u.hotTick >= 3 - 1e-9) { u.hotTick -= 3; if (f.sp) under('renew', true, () => heal(f, u, 80 * (1 + sv(f, 'quickRenew')), false)); else heal(f, u, 80, false); } // 짙은 소생 (42 사제 04)
    if (u.hot <= 0 && f.sp && u.alive) hotDone(f); // 묘지기 등불 (42 3장)
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
  if (f.melt && f.t < f.melt.until) meltTick(f, u, dt); // 녹는 보호막 (P-MELT, 51 5장)
  if (u.bulwark > 0) u.bulwark -= dt;
  if (u.thanks > 0) u.thanks -= dt;
  if (u.cls) { if (u.flow > 0) u.flow -= dt; u.aim = u.moving ? (u.mods.length && hasMod(u, 'aim') ? u.aim : 0) : u.aim + dt; }
  for (const d of u.debuffs.slice()) {
    d.left -= dt;
    if ((d.cureAt != null || d.grow) && hpLineTick(f, u, d, dt)) continue;
    if (d.charm && charmTick(f, u, d)) continue; // 매혹 (P-CHARM)
    if (d.swell) { // 부풀기 (P-SWELL): every초마다 1중첩
      d.swellT = (d.swellT ?? 0) + dt;
      if (d.swellT >= d.swell.every - 1e-9) { d.swellT -= d.swell.every; d.stack = Math.min(d.swell.max, (d.stack ?? 1) + 1); }
    }
    if (d.untilBossLoss != null && f.bossHp <= d.bossAt! - f.bossMax * d.untilBossLoss + 1e-9) { // 삼키기: 보스를 그만큼 깎으면 풀림
      u.debuffs = u.debuffs.filter(x => x !== d); emit(f, { type: 'cure', id: u.id, name: d.name }); continue;
    }
    if (d.grow) { if (d.stack) damage(f, u, d.stack * d.grow.dot * dt * (f.sp ? dotSpec(f, d) : 1), true); }
    else if (d.dot) {
      const x = (d.stackMax ? d.dot * (d.stack ?? 1) * dt : d.dot * dt) * (f.sp ? dotSpec(f, d) : 1); // 감기약 · 해독초 · 상처 소독 … (42 2-5 · 2-8)
      const hp0 = u.hp;
      damage(f, u, x, true);
      if (d.feed && !f.over) f.bossHp = Math.min(f.bossMax, f.bossHp + Math.max(0, hp0 - u.hp) * d.feed); // 젊음의 갈망: 빨아들인 만큼 보스 회복
    }
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
  // 옮겨붙음 본판 (P-JUMP, 46 3-1) · 부풀기 (P-SWELL, 46 4-1): 들면 옆에 아무도 없는 칸으로 비켜 섬 (지워도 옆 사람이 안 맞게)
  if (u.debuffs.length && !u.me) { const d = u.debuffs.find(x => awayFrom(x) && !x.stepped); if (d && stepAway(f, u, d.left)) return; }
  // 회피가 끝나면 원래 자리로 복귀 (04 3장 상태 머신). 신중파는 1초 더 기다림
  if (!u.fleeing && !u.pulled && !(u.padUntil != null && u.padUntil > f.t) && !(u.awayUntil != null && u.awayUntil > f.t) && u.home >= 0 && u.cell !== u.home) {
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
      if (f.sp) under(h.key, true, () => heal(f, u, amt * hotMult(f, u, h), false));
      else heal(f, u, amt * hotMult(f, u, h), false);
      if (!u.alive) return;
    }
    if (h.left <= 1e-9 || h.rest <= 1e-9) {
      u.hots = u.hots.filter(x => x !== h);
      if (f.sp && h.rest <= 1e-9) hotDone(f); // 묘지기 등불 (42 3장)
      if (h.key === 'sprout' && h.rest <= 1e-9) {
        f.mana = Math.min(100, f.mana + (f.level >= 10 ? 0.4 : 0)); // 순환 (25 드루이드 패시브)
        if (!h.hop && sv(f, 'sproutHop')) sproutHop(f, u);
      }
    }
  }
}

/** 지속 힐 배율: 나무껍질(+20%), 드루이드 군락 (붙어 있는 새싹마다 +10%, 최대 +30%. 20인은 +30%씩 최대 +90%, 들꽃 군락에도) */
function hotMult(f: Fight, u: Unit, h: { key: string }): number {
  let m = u.redu > 0 && u.reduCut === barkCut(f) ? 1 + BARK.hot : 1;
  if ((h.key === 'sprout' || (h.key === 'wildflower' && f.enc.big)) && f.level >= 6) {
    const c = cellOf(f, u);
    let n = 0;
    for (const v of f.party) if (v !== u && v.alive && v.hots.some(x => x.key === 'sprout') && hexDist(cellOf(f, v), c) === 1) n++;
    m *= 1 + Math.min(3, n) * ((f.enc.big ? DRUID_BIG.colonyStep : 0.1) + sv(f, 'wideGrove')); // 20인 보정 (26 9-1) · 넓은 군락 (42 드루 01)
  }
  return m;
}

/** 옮겨 가는 새싹 (42 드루 02): 끝까지 간 새싹이 새싹 없는 옆 칸 1명 (체력 비율이 가장 낮은)에게 절반 시간 · 절반 회복량으로 */
function sproutHop(f: Fight, u: Unit): void {
  const c = cellOf(f, u);
  const v = f.party.filter(x => x !== u && x.alive && !x.hots.some(h => h.key === 'sprout') && hexDist(cellOf(f, x), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
  if (!v) return;
  const per = SKILLS.sprout.amt! / 4;
  v.hots.push({ key: 'sprout', name: '새싹', left: 6, tick: 3, every: 3, per, i: 0, rest: per * 2, hop: true });
}

/** 지금 파티 초당 딜 (이동·도망 중은 0, 삐짐 -25%, 감사 +10%, 직업 패시브) */
export function partyDps(f: Fight): number {
  let s = 0;
  for (const u of f.party) s += unitDps(u, f);
  return s;
}

/** 파티원 1명 초당 딜. f가 있으면 장비 특수능력 (42 2-7 지원)까지 */
export function unitDps(u: Unit, f?: Fight): number {
  if (!u.alive || u.fleeing || u.me) return 0;
  if (u.debuffs.length && u.debuffs.some(d => d.noDps)) return 0; // 얼림·침묵·삼킴
  if (u.immune > 0) return 0; // 보호의 손: 그동안 딜 0
  if (u.moving && u.cls !== 'hunter') return 0;
  let d = u.dps * (u.p.dps || 1);
  if (u.sulking) d *= 0.75;
  if (u.thanks > 0) d *= 1.1;
  if (u.cls) d *= classDps(u);
  if (u.mods.length) d *= dpsMods(u); // 파티원 능력 (17)
  if (f?.sp) d *= dpsSpec(f, u);
  if (f?.cheer && f.t < f.cheer.until) d *= f.cheer.mult; // 전투의 함성 (05 6-D)
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
