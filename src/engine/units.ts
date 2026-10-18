import { hexDist } from './board';
import { threatDps } from './threat';
import { BARK, DRUID_BIG } from '../data/heroConst';
import { SKILLS, type SkillKey } from '../data/skills';
import { bark, cellOf, DT, dripDamage, dripTick, emit, flowTick, hasAbsorb, heal, healFlow, hpLineTick, linger, onDebuffEnd, submerged } from './core';
import { dangerAt, dodgeRate, doReact, endurable, finishMove, moveTo, pickCell } from './movement';
import { adjLow, calmFor, renewEnd, talentHot } from './talents';
import { TX } from '../data/talents';
import { charmTick, land, pullTick } from './bossParts';
import { abFear, dpsMods, guardNow, hasMod } from './abilities';
import { dotSpec, dpsSpec, hotDone, renewDone, shieldGone, sv, under } from './specials';
import { barkCut, putSprout, sproutSpec } from './heroes';
import { dropDone } from './shaman';
import { mistHop } from './monk';
import { frontCell, posDps } from './position';
import { mentored, persDps, persIgnoresZone, persThink } from './persona';
import { SULK, type PersName } from '../data/personalities';
import type { Cell, Debuff, Fight, Hot, Unit } from './types';

/** 비켜 설 디버프: 보스를 키우는 옮겨붙음 (P-JUMP) · 부풀기 (P-SWELL, 46 4-1 성격 포인트) */
const awayFrom = (d: Debuff): boolean => !!d.swell || (d.end?.p === 'jump' && d.end.boost > 0);
/**
 * 비켜 서기: 사교형은 그대로, 눈치 (회피율)에 따라 놓침. 옆에 아무도 없는 안전한 칸 중 가장 가까운 곳, 디버프가 끝날 때까지 머묾.
 * 작은 판 (5인 10칸)에서 그런 칸이 없으면 옆 사람이 지금보다 적은 칸 중 가장 적은 곳 (2026-10-10)
 */
export function stepAway(f: Fight, u: Unit, sec: number): boolean {
  for (const d of u.debuffs) if (awayFrom(d)) d.stepped = true;
  if (!u.p.calm && ((u.p.dist ?? 0) > 0 || f.rng() >= dodgeRate(f, u))) return false; // 침착함은 꼭 비켜 섬 (75)
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
  if (u.p.calm) bark(f, u, null, false, 'calmStep');
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
  if (u.flow) flowTick(f, u);
  if (u.drip) dripTick(f, u);
  if (u.lift) { // 띄워 올리기 (P-LIFT, 56 5장): 하늘에서는 붙어 있던 지속 힐 · 지속 피해만 돌고, 시간이 되면 내려옴
    linger(() => carried(f, u, dt));
    if (u.alive && u.lift && f.t + 1e-9 >= u.lift.until) land(f, u);
    return;
  }
  if (!carried(f, u, dt)) return;
  for (const z of f.zones) if (z.cells.has(u.cell) && !(u.debuffs.length && u.debuffs.some(d => d.hide))) dripDamage(f, u, z.dps * dt, true);
  if (!u.alive) return;
  if (u.moving) { u.moving.left -= dt; if (u.moving.left <= 0) finishMove(f, u); }
  if (u.pulled) pullTick(f, u);
  if (u.debuffs.length && u.debuffs.some(d => d.noMove)) return; // 얼림·삼킴: 제자리
  if (u.mods.length && hasMod(u, 'stop')) return; // 붕대 감기·명상·얼음 방패: 멈춤
  if (u.react && f.t >= u.react.at && !u.moving) doReact(f, u);
  if (f.k % 4 !== 0 || u.moving || u.react) return;
  think(f, u);
}

/** 붙어 있는 것 한 틱: 지속 힐 · 보호 효과 시간 · 디버프 (지속 피해 · 끝남). 그 사이 쓰러지면 false */
function carried(f: Fight, u: Unit, dt: number): boolean {
  if (u.hot > 0) {
    u.hot -= dt; u.hotTick += dt;
    if (u.hotTick >= 3 - 1e-9) { u.hotTick -= 3; if (f.sp) under('renew', true, () => heal(f, u, 80 * (1 + sv(f, 'quickRenew')), false)); else heal(f, u, 80, false); } // 짙은 소생 (42 사제 04)
    if (u.hot <= 0 && f.sp && u.alive) { hotDone(f); renewDone(f, u); } // 묘지기 등불 (42 3장) · 소생의 매듭 (42 사제 19)
    if (u.hot <= 0 && f.tx.on.hopRenew && u.alive) renewEnd(f, u); // 옮겨 가는 소생
  }
  if (u.hots.length) hotTick(f, u, dt);
  if (u.redu > 0) u.redu -= dt;
  if (u.sacr > 0) u.sacr -= dt;
  if (u.immune > 0) u.immune -= dt;
  for (const e of u.echo) { healFlow(f, u, e.rate * dt); e.left -= dt; }
  u.echo = u.echo.filter(e => e.left > 0);
  if (u.guardian > 0) u.guardian -= dt;
  if (u.shield > 0) u.shield -= dt;
  if (f.melt && f.t < f.melt.until) meltTick(f, u, dt); // 녹는 보호막 (P-MELT, 51 5장)
  if (u.thanks > 0) u.thanks -= dt;
  for (const d of u.debuffs.slice()) {
    d.left -= dt;
    if (d.debt && debtTick(f, u, d, dt)) continue;
    if ((d.cureAt != null || d.grow) && hpLineTick(f, u, d, dt)) continue;
    if (d.charm && charmTick(f, u, d)) continue; // 매혹 (P-CHARM)
    if (d.swell) { // 부풀기 (P-SWELL): every초마다 1중첩
      d.swellT = (d.swellT ?? 0) + dt;
      if (d.swellT >= d.swell.every - 1e-9) { d.swellT -= d.swell.every; d.stack = Math.min(d.swell.max, (d.stack ?? 1) + 1); }
    }
    if (d.untilBossLoss != null && f.bossHp <= d.bossAt! - f.bossMax * d.untilBossLoss + 1e-9) { // 삼키기: 보스를 그만큼 깎으면 풀림
      u.debuffs = u.debuffs.filter(x => x !== d); emit(f, { type: 'cure', id: u.id, name: d.name }); continue;
    }
    if (d.grow) { if (d.stack) dripDamage(f, u, d.stack * d.grow.dot * dt * (f.sp ? dotSpec(f, d) : 1), true); }
    else if (d.dot) {
      const x = (d.stackMax ? d.dot * (d.stack ?? 1) * dt : d.dot * dt) * (f.sp ? dotSpec(f, d) : 1); // 감기약 · 해독초 · 상처 소독 … (42 2-5 · 2-8)
      const hp0 = u.hp;
      dripDamage(f, u, x, true);
      if (d.feed && !f.over) f.bossHp = Math.min(f.bossMax, f.bossHp + Math.max(0, hp0 - u.hp) * d.feed); // 젊음의 갈망: 빨아들인 만큼 보스 회복
    }
    if (!u.alive) return false;
    if (d.left <= 0) { u.debuffs = u.debuffs.filter(x => x !== d); onDebuffEnd(f, u, d, false); }
  }
  return u.alive;
}

/**
 * 빌린 생명 (P-DEBT, 59 5장) 한 틱: 빚이 초마다 grow씩 불어남 (어둠물에 잠기면 2배). 그림자 감옥에 갇힌 동안은 빚도 시간도 멈춤 (59 4-1 밤그늘).
 * 멈췄으면 true (이번 틱 이 디버프는 끝)
 */
function debtTick(f: Fight, u: Unit, d: Debuff, dt: number): boolean {
  if (u.debuffs.some(x => x.jail)) { d.left += dt; return true; }
  const grow = f.mythic && d.debt!.growMythic ? d.debt!.growMythic : d.debt!.grow; // 악몽 마지막 그림자 12%
  d.debtLeft = (d.debtLeft ?? 0) * (1 + grow * dt * (f.zones.length && submerged(f, u) ? 2 : 1));
  return false;
}

/** 0.2초마다 판단: 장판 피하기 · 도망 · 비켜 서기 · 제자리로 · 삐짐 (04 4장) */
function think(f: Fight, u: Unit): void {
  const inZone = f.zones.find(z => z.cells.has(u.cell));
  if (inZone && u.ignoreZone !== inZone.id && f.t >= u.retryAt) {
    if (u.ps && persIgnoresZone(f, u)) { u.retryAt = f.t + 1; } // 다혈질 분노 · 소심이 당황 (75)
    else if (u.p.stubborn && inZone.dps * 2 * f.dmgMult < u.p.stubborn * u.max) { u.ignoreZone = inZone.id; }
    else if (endurable(f, u, inZone)) { u.ignoreZone = inZone.id; guardNow(f, u); } // 참을성 (95)
    else if (u.p.brave && u.hp / u.max >= u.p.brave) { u.retryAt = f.t + 1; }
    else {
      const rate = dodgeRate(f, u);
      if (f.rng() < rate) { const c = pickCell(f, u, { safe: true }); if (c) moveTo(f, u, c); else u.retryAt = f.t + 1.5; }
      else u.retryAt = f.t + (1.5 + f.rng() * 1.5) * (u.fm?.retry ?? 1); // 침착 (97 FM)
    }
    return;
  }
  if (u.ps && persThink(f, u)) return; // 새 성격 20종 (75)
  // 도망: 겁쟁이 (50%). 쉼터가 있으면 신중파도 40% 아래에서 쉼터로 (사제 특성, 06 6장)
  const shelter = shelterFor(f);
  const fleeAt = (u.p.flee ? u.p.flee * (f.mentors && mentored(f, u) ? 0.5 : 1) * (u.fm?.flee ?? 1) : 0) || (shelter && u.pers && SHELTER_GO.includes(u.pers) ? SHELTER_GO_HP : 0); // 큰형 옆이면 반 (95) · 침착 (97 FM)
  if (fleeAt || u.fleeing) {
    if (!u.fleeing && fleeAt && u.hp / u.max < fleeAt && !calmFor(f, u) && !((u.ab || u.mods.length) && abFear(f, u))) {
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
  // 위치 규칙 (2026-10-13 Lim): 1열에 탱커가 없어 적이 아무나 때리면, 탱커가 비어 있는 안전한 1열 칸으로 바로 나가 다시 잡음 (거기가 새 자리)
  if (f.loose && u.role === 'tank' && !u.pulled && !(u.padUntil != null && u.padUntil > f.t) && !(u.awayUntil != null && u.awayUntil > f.t)) {
    const c = frontCell(f, u);
    if (c && c.i !== u.cell && moveTo(f, u, c)) { u.home = c.i; u.homeAt = null; return; }
  }
  // 회피가 끝나면 원래 자리로 복귀 (04 3장 상태 머신). 신중파는 1초 더 기다림
  if (!u.fleeing && !u.pulled && !(u.padUntil != null && u.padUntil > f.t) && !(u.awayUntil != null && u.awayUntil > f.t) && u.home >= 0 && u.cell !== u.home) {
    const h = f.cells[u.home];
    if (!h.unit && !h.block && !dangerAt(f, u.home)) {
      if (u.homeAt == null) u.homeAt = u.p.homebody ? f.t : f.t + (u.fm?.homeWait ?? 1) + (u.p.react && u.p.react < 1 ? 1 : 0) + (u.p.edge?.back ?? 0); // 집돌이 바로 · 모서리파 늦게 (95) · 위치 잡기 (97 FM)
      else if (f.t >= u.homeAt) { u.homeAt = null; moveTo(f, u, h); if (u.p.homebody) bark(f, u, null, false, 'homeBack'); return; }
    } else u.homeAt = null;
  }
  if (u.p.attention) sulkThink(f, u, u.p.attention);
}

/** 관심종자 삐짐 (04 4장): attention초 동안 직접 힐을 못 받으면 삐짐 (딜 −25%). 다시 삐짐 · 횟수 · 혼자 풀림은 SULK (2026-10-16) */
function sulkThink(f: Fight, u: Unit, after: number): void {
  if (f.cfg.proto) { // 프로토타입 일치: 힐을 받을 때까지, 몇 번이든
    if (!u.sulking && f.t - u.lastHeal > after && f.t > 8) { u.sulking = true; bark(f, u, null, true, 'sulk'); }
    return;
  }
  if (u.sulking) {
    if (f.t - (u.sulkFrom ?? f.t) >= SULK.long) { u.sulking = false; u.sulkOff = f.t; }
    return;
  }
  const n = u.sulkN ?? 0;
  if (n >= SULK.max || f.t <= 8) return;
  if (f.t - Math.max(u.lastHeal, u.sulkOff ?? 0) > (n ? SULK.again : after)) {
    u.sulking = true; u.sulkN = n + 1; u.sulkFrom = f.t;
    bark(f, u, null, true, 'sulk');
  }
}

/** 쉼터가 있으면 도망 대신 쉼터로 가는 성격과 체력 (06 6장. 소심이는 아직 없는 성격) */
const SHELTER_GO: PersName[] = ['신중파'];
const SHELTER_GO_HP = 0.4;

/** 쉼터 (사제 특성): 비어 있고 위험하지 않으면 도망가는 파티원이 그리로 */
function shelterFor(f: Fight): Cell | null {
  const i = f.tx.shelter;
  return i >= 0 && !f.cells[i].unit && !dangerAt(f, i) ? f.cells[i] : null;
}

/** 지속 힐 한 틱 회복량: 정한 회복량을 다 쓰면 (고요한 숲으로 늘어난 시간) 마지막 틱 값 */
const hotAmt = (h: Hot): number => (h.amts ? h.amts[Math.min(h.i, h.amts.length - 1)] : h.per);
/** 지속 힐 틱 (드루이드·성기사). 다 차면 직업 패시브(순환)로 마나를 돌려줄 수 있게 이벤트 대신 콜백 */
export function hotTick(f: Fight, u: Unit, dt: number): void {
  const on = f.tx.on;
  const give = (h: Hot, amt: number) => {
    h.rest = Math.max(0, h.rest - amt);
    const over0 = f.stats.overheal;
    if (f.sp) under(h.key, true, () => heal(f, u, amt * hotMult(f, u, h), false));
    else heal(f, u, amt * hotMult(f, u, h), false);
    if (on.overflowSap && f.stats.overheal > over0) { const v = adjLow(f, u, 1)[0]; if (v && v.hp < v.max) heal(f, v, (f.stats.overheal - over0) * TX.overflowSap, false, true); } // 넘치는 수액 (77)
  };
  hots: for (const h of u.hots.slice()) {
    if (h.hopK === f.k) continue; // 이 틱에 옮겨 온 수도사 안개 (시간은 옮기기 전 대상에서 이미 뺌)
    h.left -= dt; h.tick -= dt;
    while (h.tick <= 1e-9 && h.rest > 1e-9) {
      const amt = Math.min(h.rest, hotAmt(h));
      h.i++; h.tick += h.every;
      if (h.key === 'wanderMist' && f.hero === 'monk') { // 떠도는 안개 (79 3-2): 대상이 다 차 있으면 옮겨 감
        h.rest = Math.max(0, h.rest - amt);
        if (mistHop(f, u, h, amt)) continue hots;
        h.rest += amt;
      }
      give(h, amt);
      if (!u.alive) return;
    }
    // 고요한 숲으로 늘어난 시간이 틱 간격으로 안 나눠떨어지면, 끝날 때 지난 몫만큼 (2026-10-14 직업 밸런스 검토: 연장해도 회복량이 그대로이던 것)
    if (h.left <= 1e-9 && h.rest > 1e-9) {
      give(h, Math.min(h.rest, hotAmt(h) * Math.max(0, 1 - h.tick / h.every)));
      if (!u.alive) return;
      if (h.rest < 1e-6) h.rest = 0;
    }
    if (h.left <= 1e-9 || h.rest <= 1e-9) {
      u.hots = u.hots.filter(x => x !== h);
      if (f.sp && h.rest <= 1e-9) hotDone(f); // 묘지기 등불 (42 3장)
      if (h.key === 'droplet' && h.rest <= 1e-9 && f.hero === 'shaman') dropDone(f, u); // 물웅덩이 (주술 02)
      if (h.key === 'sprout' && h.rest <= 1e-9) {
        f.mana = Math.min(100, f.mana + (f.level >= 10 ? 0.4 : 0) + sv(f, 'dewDrop')); // 순환 (25 드루이드 패시브) · 이슬 맺힘 (42 드루 17)
        if (!h.hop && sv(f, 'sproutHop')) sproutHop(f, u);
        if (h.again) putSprout(f, u, sproutSpec(f)); // 숲의 기억 (77): 한 번 더 (다시 걸린 것은 또 안 걸림)
      }
    }
  }
}

/**
 * 지속 힐 배율: 나무껍질(+20%), 드루이드 군락 (붙어 있는 새싹마다 +10%, 최대 +30%. 20인은 +30%씩 최대 +90%, 들꽃 군락에도).
 * 특성 (77): 번지는 군락 (칸마다 +5%, 생장 · 들꽃에도), 이끼 자리 · 푸른 들판 (talentHot)
 */
export function hotMult(f: Fight, u: Unit, h: { key: string }): number {
  let m = u.redu > 0 && f.hero === 'druid' && u.reduCut === barkCut(f) ? 1 + BARK.hot : 1; // 나무껍질은 드루이드만 (성역 0.2와 값이 같아 성기사 지속 힐이 +20% 되던 것, QA 2026-10-15)
  const colony = h.key === 'sprout' || (h.key === 'wildflower' && f.enc.big) || (!!f.tx.on.colonyAll && (h.key === 'growth' || h.key === 'wildflower'));
  if (colony && f.level >= 6) m *= 1 + colonyN(f, u) * ((f.enc.big ? DRUID_BIG.colonyStep : 0.1) + sv(f, 'wideGrove') + (f.tx.on.colonyAll ? TX.colonyAll : 0)); // 20인 보정 (26 9-1) · 넓은 군락 (42 드루 01) · 번지는 군락 (77)
  if (f.tx.hotm) m *= talentHot(f, u, h.key as SkillKey);
  return m;
}

/** 군락 칸 수 (최대 3): 옆 칸에 새싹이 걸린 아군 수. 특성 (77): 탱커의 숲 (탱커 2칸 이상), 5인 이하 번지는 군락 (1칸 이상) · 뻗는 뿌리 (2칸 이상), 레이드는 뻗는 뿌리가 2칸 거리까지 셈 */
export function colonyN(f: Fight, u: Unit): number {
  const tx = f.tx;
  const c = cellOf(f, u), small = f.party.length <= 5, far = !small && !!tx.on.wideRoots ? 2 : 1;
  let n = 0;
  for (const v of f.party) if (v !== u && v.alive && v.hots.some(x => x.key === 'sprout')) { const d = hexDist(cellOf(f, v), c); if (d >= 1 && d <= far) n++; }
  if (tx.on.guardianGrove && u.role === 'tank') n = Math.max(2, n);
  if (tx.on.colonyAll && small) n = Math.max(1, n);
  if (tx.on.wideRoots && small) n = Math.max(TX.wideRoots.min, n);
  return Math.min(3, n);
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

/** 파티원 1명 초당 딜. f가 있으면 장비 특수능력 (42 2-7 지원) · 위치 규칙까지 */
export function unitDps(u: Unit, f?: Fight): number {
  if (!u.alive || u.fleeing || u.me || u.lift) return 0; // 띄워 올려진 동안 딜 0 (P-LIFT)
  if (u.debuffs.length && u.debuffs.some(d => d.noDps)) return 0; // 얼림·침묵·삼킴
  if (u.immune > 0) return 0; // 보호의 손: 그동안 딜 0
  if (u.sleep != null && f && u.sleep > f.t) return 0; // 점성술사 별의 잠 (79 4-2): 딜 없음
  if (u.moving) return 0; // 움직이는 동안 딜 0 (모든 직업)
  const pos = f?.R.pos ? posDps(f, u) : 1; // 위치 규칙: 근접은 1 · 2열에서만, 원거리는 1 · 2열이면 50%
  if (pos <= 0) return 0;
  let d = u.dps * (u.p.dps || 1) * pos;
  for (const x of u.debuffs) if (x.dpsCut) d *= 1 - x.dpsCut; // 하품 (54 4-3)
  if (u.sulking) d *= 0.75;
  if (u.thanks > 0) d *= 1.1;
  if (u.mods.length) d *= dpsMods(u); // 파티원 능력 (17)
  if (f?.sp) d *= dpsSpec(f, u);
  if (f?.cheer && f.t < f.cheer.until) d *= f.cheer.mult; // 전투의 함성 (05 6-D)
  if (f?.persOn) d *= persDps(f, u); // 새 성격 20종 · 응원 (75)
  if (f?.thr) d *= threatDps(f, u); // 어그로 (96): 선 가까이 와서 줄임 · 뺏은 뒤 멈춤
  return d;
}
