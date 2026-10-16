/**
 * 주술사 (79 2장): 칸을 읽는 힐러. 샘 토템 (가운데 버튼 → 칸) · 대지 토템 · 비구름 토템, 연쇄 치유 (붙은 다친 아군끼리, 물방울이 걸린 아군은 2칸),
 * 영혼 잇기 (체력 비율 맞추기). 특성 (79 2-7)과 직업 전용 특수능력 (79 2-8)의 엔진 훅도 여기서.
 * heroes.ts가 직업마다 나눠 부르고, 판 위 물건 (시간 · 깨짐)은 totems.ts
 */
import { SHAMAN } from '../data/heroConst';
import { SKILLS, type SkillKey } from '../data/skills';
import { TX } from '../data/talents';
import { giveAbsorb } from './abilities';
import { hexDist } from './board';
import { cellOf, emit, heal, healTop, living } from './core';
import { noteUsed } from './healer';
import { doDispel, heroHeal, heroPassive, putHot } from './heroes';
import { activeOn, cdOf } from './talents';
import { ONE_PER_CELL, placeTotem, shamanTotemAt, totemBreaks, totemsOf } from './totems';
import { aoeCount, aoeDone, guardSec, raidSec, sv, under } from './specials';
import type { Fight, Hot, Totem, Unit } from './types';

/** 주술사 전투 상태 (비구름 · 물웅덩이 · 대지 충전 · 특성 재발동) */
export interface ShamanState {
  rainUntil: number;
  rainTick: number;
  puddles: { cell: number; until: number }[];
  /** 두 대지 (특성): 남은 충전 · 다음 충전까지 */
  earth: number;
  earthRe: number;
  letFlowCd: number;
  alertCd: number;
  lastSpringCd: number;
  selfUsed: boolean;
  telSeen: number;
}
export const newShaman = (): ShamanState => ({ rainUntil: -1, rainTick: 0, puddles: [], earth: 2, earthRe: 0, letFlowCd: 0, alertCd: 0, lastSpringCd: 0, selfUsed: false, telSeen: 0 });

const st = (f: Fight): ShamanState => (f.sham ??= newShaman());
/** 비구름 토템이 떠 있음 */
export const raining = (f: Fight): boolean => !!f.sham && f.sham.rainUntil > f.t;
const hasDrop = (u: Unit) => u.hots.some(h => h.key === 'droplet');
const near = (f: Fight, u: Unit, r: number) => { const c = cellOf(f, u); return living(f).filter(v => hexDist(cellOf(f, v), c) <= r); };

/** 샘 토템 거리 (넓은 샘 2칸) · 바다의 자리 2칸 */
export const springRange = (f: Fight, t: Totem): number => (t.kind === 'sea' ? TX.seaSeat.range : f.tx.on.freshSpring ? TX.freshSpring.range : SHAMAN.spring.range);
/** 샘 토템 시간 (마르지 않는 샘 +6초) */
export const springSec = (f: Fight): number => SHAMAN.spring.sec + sv(f, 'tallSpring');
/** 그 칸에 선 아군이 토템 범위 (샘 · 바다 · 대지) 안인지 (토템 곁 · 대지의 품) */
export function inTotem(f: Fight, u: Unit): boolean {
  const c = cellOf(f, u);
  for (const t of f.totems) {
    const r = t.kind === 'earth' ? 1 : t.kind === 'spring' || t.kind === 'sea' ? springRange(f, t) : -1;
    if (r >= 0 && hexDist(f.cells[t.cell], c) <= r) return true;
  }
  return false;
}

/** 물방울 걸기 (12초 · 3초마다 · 모두 210 × 위력) */
export function putDrop(f: Fight, u: Unit, power = 1): Hot {
  const d = SHAMAN.droplet;
  return putHot(u, 'droplet', { sec: d.sec, every: d.tick, total: SKILLS.droplet.amt! * power });
}
/** 지속 힐 한 틱을 지금 바로 (흘려보내기): 남은 회복량에서 한 틱 */
function tickNow(f: Fight, u: Unit, h: Hot): void {
  const amt = Math.min(h.rest, h.per);
  h.rest -= amt; h.i++; h.tick = h.every;
  under(h.key, true, () => heal(f, u, amt, false));
}

// ---------- 스킬 ----------
/** 연쇄 치유가 튈 길: 첫 대상 → 지금 대상과 붙어 있고 (물방울이 걸린 아군은 2칸) 아직 안 맞았고 체력이 다 차지 않은 아군 중 체력 비율이 가장 낮은 아군 (79 2-2) */
export function chainPath(f: Fight, u: Unit, n = chainN(f)): Unit[] {
  const path = [u], all = living(f);
  let cur = u;
  while (path.length < n) {
    const c = cellOf(f, cur);
    const next = all.filter(v => !path.includes(v) && v.hp < healTop(v) - 1e-9 && hexDist(cellOf(f, v), c) <= (hasDrop(v) ? SHAMAN.droplet.chainRange : 1))
      .sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (!next) break;
    path.push(next); cur = next;
  }
  return path;
}
/** 잔물결이 튈 곳 (82): 연쇄 치유와 같은 길 (붙어 있음, 물방울이 걸리면 2칸)에서 힐하면 손해인 사람 (뒤집힌 축복) · 떠 있는 사람은 빼고 체력 비율이 가장 낮은 아군 */
export function rippleTo(f: Fight, u: Unit): Unit | undefined {
  const c = cellOf(f, u);
  return living(f).filter(v => v !== u && v.hp < healTop(v) - 1e-9 && !v.lift && !v.debuffs.some(d => d.invert) && hexDist(cellOf(f, v), c) <= (hasDrop(v) ? SHAMAN.droplet.chainRange : 1))
    .sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
}
/** 연쇄 치유가 닿는 인원 (긴 사슬 6명) */
export const chainN = (f: Fight): number => (f.tx.on.longChain ? TX.longChain.n : SHAMAN.chain.n);

function chainHeal(f: Fight, u: Unit): void {
  const on = f.tx.on, decay = on.endlessChain ? TX.endlessChain : SHAMAN.chain.decay;
  const path = chainPath(f, u);
  if (f.sp) aoeCount(f, path.length);
  let amt = SKILLS.chainHeal.amt!, carry = 0;
  path.forEach((v, i) => {
    if (i > 0) {
      if (!(on.dropChain && hasDrop(v))) amt *= decay; // 물방울 사슬 (79 2-7): 물방울이 걸린 아군에게 튈 때는 안 줆
      noteUsed(f, 'chainHeal', v.id); // 첫 대상은 healer applySkill이 기록
    }
    const over0 = f.stats.overheal, give = amt + carry;
    heroHeal(f, v, give);
    carry = on.overflowChain ? (f.stats.overheal - over0) / (f.gear.heal * f.power) : 0; // 넘치는 사슬: 넘친 양을 다음 대상에 (배율 전 단위로)
  });
  if (on.returnChain && u.alive) heroHeal(f, u, SKILLS.chainHeal.amt! * TX.returnChain); // 되돌아오는 사슬
  if (heroPassive(f, '밀려오는 물') && path.length >= SHAMAN.tide.n) f.mana = Math.min(100, f.mana + SHAMAN.tide.mana);
  if (f.sp && sv(f, 'chainDrop')) { const last = path[path.length - 1]; if (path.length > 1 && !hasDrop(last)) putDrop(f, last, 0.5).hop = true; } // 사슬 끝 물방울 (주술 19)
  if (f.sp) aoeDone(f, u.cell, SKILLS.chainHeal.amt!, 1);
  emit(f, { type: 'sound', name: 'chime' });
}

/** 영혼 잇기 (79 2-2): 대상과 붙은 아군의 체력 비율을 평균으로. 힐로 세지 않음 (치명타 · 힐 증가 없음), 오른 쪽만 치유량 통계에. 그 뒤 6초 받는 피해 −10% */
function spiritLink(f: Fight, u: Unit): void {
  const vs = near(f, u, 1);
  const r = vs.reduce((a, v) => a + v.hp / v.max, 0) / vs.length;
  for (const v of vs) {
    const to = Math.max(1, v.max * r), d = to - v.hp;
    v.hp = to;
    if (d > 0) { f.stats.healed += d; v.got += d; emit(f, { type: 'heal', id: v.id, amt: Math.round(d), eff: Math.round(d), crit: false }); }
    v.mods = v.mods.filter(m => m.src !== 'spiritLink');
    v.mods.push({ k: 'cut', v: SHAMAN.link.cut + sv(f, 'deepLink'), until: f.t + SHAMAN.link.sec, src: 'spiritLink' });
  }
  emit(f, { type: 'sound', name: 'chime' });
}

/** 잔물결이 튐 (물의 정령, 79 2-7): 붙어 있는 다친 아군 2명에게 75% · 56% */
function spiritJump(f: Fight, u: Unit, amt: number): void {
  if (!activeOn(f, 'waterSpirit')) return;
  const c = cellOf(f, u);
  const vs = living(f).filter(v => v !== u && v.hp < healTop(v) - 1e-9 && hexDist(cellOf(f, v), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, TX.waterSpirit.n);
  vs.forEach((v, i) => heroHeal(f, v, amt * TX.waterSpirit.share[i]));
}

/** 주술사 스킬 효과 */
export function shamanApply(f: Fight, key: SkillKey, u: Unit): void {
  const on = f.tx.on;
  if (key === 'ripple') {
    const amt = SKILLS.ripple.amt! * (on.rapids && u.hp < u.max * TX.rapids.hp ? 1 + TX.rapids.heal : 1); // 급류 (소나기를 없애며 잔물결로, 2026-10-16)
    heroHeal(f, u, amt);
    const v = rippleTo(f, u);
    if (v) { noteUsed(f, 'ripple', v.id); heroHeal(f, v, SKILLS.ripple.amt! * SHAMAN.ripple.bounce); } // 82: 붙은 가장 다친 아군에게 한 번 튐
    if (on.sprayShower) { const c = cellOf(f, u), w = living(f).filter(x => x !== u && x !== v && x.hp < healTop(x) - 1e-9 && hexDist(cellOf(f, x), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if (w) { noteUsed(f, 'ripple', w.id); heroHeal(f, w, amt * TX.sprayShower); } } // 흩뿌리는 잔물결
    if (on.rippleChain) { const h = u.hots.find(x => x.key === 'droplet'); if (h) { h.rest += (h.per / h.every) * TX.rippleChain; h.left += TX.rippleChain; } } // 잔물결 이음
    spiritJump(f, u, amt);
  } else if (key === 'droplet') {
    putDrop(f, u);
    if (on.splitDrop) { const c = cellOf(f, u), v = living(f).filter(x => x !== u && x.hp < healTop(x) - 1e-9 && !hasDrop(x) && hexDist(cellOf(f, x), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if (v) putDrop(f, v, TX.splitDrop); } // 갈라지는 물방울
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'washing') {
    const before = u.debuffs.slice();
    doDispel(f, u);
    const gone = before.find(d => !u.debuffs.includes(d));
    if (gone) {
      if (f.sp && sv(f, 'washDrop') && !hasDrop(u)) putDrop(f, u, 0.5).hop = true; // 씻김 물방울 (주술 20)
      if (on.washSpread) { // 번지는 씻김: 붙은 아군 1명의 같은 종류 디버프도
        const type = gone.type, c = cellOf(f, u);
        const v = living(f).find(x => x !== u && hexDist(cellOf(f, x), c) === 1 && x.debuffs.some(d => d.type === type && !d.lock && !d.trap));
        if (v) doDispel(f, v);
      }
    }
  } else if (key === 'chainHeal') {
    chainHeal(f, u);
  } else if (key === 'rainTotem') {
    const s = st(f);
    s.rainUntil = f.t + raidSec(f, 'rainTotem', SHAMAN.rain.sec) + sv(f, 'longRain'); s.rainTick = SHAMAN.rain.tick;
    emit(f, { type: 'sound', name: 'hymn' });
    emit(f, { type: 'msg', text: `비구름 토템: ${Math.round(s.rainUntil - f.t)}초` });
  } else if (key === 'spiritLink') {
    spiritLink(f, u);
  }
}

/** 칸에 쓰는 스킬: 샘 · 대지 토템 (79 2-3). 고른 칸에 세움, 빈 칸도 됨 (2026-10-16 Lim) */
export function shamanCell(f: Fight, key: SkillKey, cell: number): void {
  const on = f.tx.on;
  if (key === 'springTotem') {
    placeTotem(f, 'spring', cell, springSec(f), { max: on.twinSpring ? TX.twinSpring.n : 1, tick: SHAMAN.spring.tick });
  } else if (key === 'earthTotem') {
    placeTotem(f, 'earth', cell, guardSec(f, SHAMAN.earth.sec), { max: on.twinEarth ? TX.twinEarth.n : 1 });
    if (on.twinEarth) spendEarth(f);
    if (f.sp && sv(f, 'earthEcho') && f.rng() < sv(f, 'earthEcho')) { // 대지의 울림 (주술 23): 한 칸에 토템 하나라 붙은 빈 토템 자리에
      const at = freeBeside(f, cell);
      if (at != null) { placeTotem(f, 'spring', at, springSec(f), { max: on.twinSpring ? TX.twinSpring.n : 1, tick: SHAMAN.spring.tick }); noteCell(f, 'springTotem', at); }
    }
    const u = f.cells[cell]?.unit;
    emit(f, { type: 'msg', text: u ? `대지 토템: ${u.nick}` : '대지 토템' });
  } else return;
  noteCell(f, key, cell);
  emit(f, { type: 'sound', name: 'renew' });
}
/** 칸에 그리는 이펙트 (판 위 물건): 그 칸에 선 사람이 있으면 그 사람, 없으면 칸 */
export function noteCell(f: Fight, key: SkillKey, cell: number): void {
  const u = f.cells[cell]?.unit;
  if (u) { noteUsed(f, key, u.id); return; }
  const used = (f.used ??= []);
  if (used.length < 32) used.push({ key, uid: -1, cell });
}

/** 두 대지 (특성): 쓰면 충전 하나, 다 쓰면 다음 충전까지 대기 (충전 시간 = 대지 토템 재사용) */
function spendEarth(f: Fight): void {
  const s = st(f);
  s.earth = Math.max(0, s.earth - 1);
  if (s.earthRe <= 0) s.earthRe = f.cd.earthTotem || cdOf(f, 'earthTotem'); // 충전 시간 = 실제 재사용 (생존기 단련 · 서두르는 별 등, QA 2026-10-15)
  f.cd.earthTotem = s.earth > 0 ? 0 : s.earthRe;
}

// ---------- 한 틱 ----------
/** 샘 토템 (바다의 자리) 한 번: 범위 안 아군 회복. 샘지기 (토템 칸 2배) · 물의 방패 (가득 찬 아군 보호막) · 샘 긷기 (3명 이상이면 마나) */
export function springPulse(f: Fight, t: Totem): void {
  const on = f.tx.on, c = f.cells[t.cell], r = springRange(f, t), sea = t.kind === 'sea';
  const amt = (sea ? TX.seaSeat.amt : SKILLS.springTotem.amt! * (on.freshSpring ? 1 - TX.freshSpring.heal : 1) * (1 + sv(f, 'deepSpring'))) * (f.enc.big ? SHAMAN.spring.big : 1);
  let n = 0;
  for (const v of living(f)) {
    if (hexDist(cellOf(f, v), c) > r) continue;
    const m = on.keeperSpring && !sea && v.cell === t.cell && !v.moving ? TX.keeperSpring : 1;
    const full = v.hp >= healTop(v) - 1e-9;
    const eff = under('springTotem', true, () => heal(f, v, amt * m, false));
    if (eff > 0) n++;
    if (on.waterShield && full) giveAbsorb(f, v, Math.min(amt * m, TX.waterShield.max) * f.gear.heal * f.power, TX.waterShield.sec, 0.6); // 물의 방패
  }
  if (n >= 3 && f.sp && sv(f, 'springDraw')) f.mana = Math.min(100, f.mana + sv(f, 'springDraw')); // 샘 긷기 (주술 17)
}

/** 주술사 한 틱: 샘 · 바다 회복, 비구름, 물웅덩이, 두 대지 충전, 특성 (흘려보내기 · 경계하는 토템) */
export function shamanTick(f: Fight, dt: number): void {
  const s = st(f), on = f.tx.on;
  for (const t of f.totems) {
    if (t.kind !== 'spring' && t.kind !== 'sea') continue;
    t.tick -= dt;
    while (t.tick <= 1e-9) { t.tick += t.kind === 'sea' ? TX.seaSeat.tick : SHAMAN.spring.tick; springPulse(f, t); }
  }
  if (s.rainUntil > -1) {
    if (f.t > s.rainUntil + 1e-9) s.rainUntil = -1;
    else {
      s.rainTick -= dt;
      if (s.rainTick <= 1e-9) {
        s.rainTick += SHAMAN.rain.tick;
        under('rainTotem', true, () => { for (const v of living(f)) heal(f, v, SKILLS.rainTotem.amt!, false); });
        noteUsed(f, 'rainTotem', f.me.id);
      }
    }
  }
  if (s.puddles.length) s.puddles = s.puddles.filter(p => p.until > f.t);
  if (on.twinEarth && s.earth < TX.twinEarth.n) {
    s.earthRe -= dt;
    if (s.earthRe <= 1e-9) { s.earth++; s.earthRe = s.earth < TX.twinEarth.n ? cdOf(f, 'earthTotem') : 0; }
    f.cd.earthTotem = s.earth > 0 ? 0 : s.earthRe;
  }
  if (s.letFlowCd > 0) s.letFlowCd -= dt;
  if (s.alertCd > 0) s.alertCd -= dt;
  if (s.lastSpringCd > 0) s.lastSpringCd -= dt;
  const me = f.me;
  if (on.letFlow && s.letFlowCd <= 0 && me.alive && me.hp < me.max * TX.letFlow.hp) { // 흘려보내기
    s.letFlowCd = TX.letFlow.cd;
    tickNow(f, me, putDrop(f, me));
    emit(f, { type: 'msg', text: '흘려보내기: 물방울' });
  }
  if (on.alertTotem && f.tels.length) { // 경계하는 토템: 새 광역 예고에 샘 토템이 바로 한 번
    let fresh = false;
    for (const t of f.tels) if (t.id > s.telSeen) { if (t.kind === 'aoe') fresh = true; s.telSeen = t.id; }
    if (fresh && s.alertCd <= 0) { const sp = totemsOf(f, 'spring'); if (sp.length) { s.alertCd = TX.alertTotem.cd; for (const t of sp) springPulse(f, t); } }
  }
}

/** 물방울이 끝까지 감: 물웅덩이 (주술 02) */
export function dropDone(f: Fight, u: Unit): void {
  if (f.sp && sv(f, 'puddle')) st(f).puddles.push({ cell: u.cell, until: f.t + SHAMAN.puddle });
}

/** 받는 피해 배율: 대지 토템 (칸 위 뿌리 내린 토템) · 돌 물방울 · 물웅덩이 · 대지의 품 */
export function shamanTaken(f: Fight, u: Unit): number {
  let m = 1;
  if (f.totems.length) {
    const c = cellOf(f, u);
    let cut = 0;
    for (const t of f.totems) if (t.kind === 'earth') {
      const d = hexDist(f.cells[t.cell], c);
      if (d <= 1) cut = Math.max(cut, (d === 0 && f.tx.on.rootTotem ? TX.rootTotem : SHAMAN.earth.cut) + sv(f, 'hardEarth'));
    }
    m *= 1 - cut;
    if (u.me && f.tx.on.earthGrace && inTotem(f, u)) m *= 1 - TX.earthGrace; // 대지의 품
  }
  if (f.tx.on.stoneDrop && hasDrop(u)) m *= 1 - TX.stoneDrop; // 돌 물방울
  const s = f.sham;
  if (s && s.puddles.length && s.puddles.some(p => p.cell === u.cell && p.until > f.t)) m *= 1 - sv(f, 'puddle'); // 물웅덩이
  return m;
}

/** 내가 죽을 피해 (나를 지키는 샘): 판 위 샘 토템이 깨지고 체력 30%로 버팀. 버텼으면 true */
export function shamanLethal(f: Fight, u: Unit): boolean {
  if (!u.me || !f.tx.on.springSelf) return false;
  const s = st(f), sp = totemsOf(f, 'spring')[0];
  if (s.selfUsed || !sp) return false;
  s.selfUsed = true;
  f.totems = f.totems.filter(t => t !== sp);
  emit(f, { type: 'fx', name: 'crumble', cell: sp.cell });
  u.hp = u.max * TX.springSelf.hp;
  emit(f, { type: 'msg', text: '나를 지키는 샘: 샘 토템이 대신 깨짐' });
  return true;
}

/** 판 위 물건이 사라짐: 샘 토템이 깨지면 토템의 마지막 물 (주술 21) */
export function shamanTotemGone(f: Fight, t: Totem, broken: boolean): void {
  if (broken && t.kind === 'spring' && f.sp && sv(f, 'totemMend')) springPulse(f, t);
}

/** 파티원이 쓰러짐: 마지막 샘 (특성) — 그 칸에 마나 없이 샘 토템 (지금 샘 토템은 사라짐) */
export function shamanDeath(f: Fight, u: Unit): void {
  const s = st(f);
  if (!f.tx.on.lastSpring || s.lastSpringCd > 0 || u.me) return;
  s.lastSpringCd = TX.lastSpring.cd;
  f.totems = f.totems.filter(t => t.kind !== 'spring');
  placeTotem(f, 'spring', u.cell, springSec(f), { tick: SHAMAN.spring.tick });
  noteCell(f, 'springTotem', u.cell);
}

/** 토템 부르기 (특성 ◎): 판 위 내 샘 · 대지 토템을 고른 칸으로 (남은 시간 그대로) */
export function callTotems(f: Fight, cell: number): void {
  // 한 칸에 토템 하나 (2026-10-16): 가장 나중에 세운 것이 고른 칸, 나머지는 그 옆 빈 토템 자리 (자리가 없으면 사라짐)
  const ts = f.totems.filter(t => ONE_PER_CELL.has(t.kind)).reverse().sort((a, b) => b.at - a.at); // 같은 때 세웠으면 뒤에 들어간 것이 나중
  for (const t of ts) t.cell = -1; // 옮기는 동안 판에서 뺌
  ts.forEach((t, i) => { t.cell = i === 0 ? cell : freeBeside(f, cell) ?? -1; });
  for (const t of ts) if (t.cell < 0) { f.totems = f.totems.filter(x => x !== t); shamanTotemGone(f, t, false); }
}
/** 칸 옆 (1칸) 토템 없는 자리: 무너지거나 막힌 칸 · 깨질 칸은 빼고, 붙은 아군이 가장 많은 곳. 없으면 null */
export function freeBeside(f: Fight, cell: number): number | null {
  const c0 = f.cells[cell], live = living(f);
  let best: number | null = null, bn = -1;
  for (const c of f.cells) {
    if (hexDist(c, c0) !== 1 || c.block || totemBreaks(f, c.i) || shamanTotemAt(f, c.i)) continue;
    const n = live.filter(v => hexDist(cellOf(f, v), c) <= 1).length;
    if (n > bn) { bn = n; best = c.i; }
  }
  return best;
}
/** 바다의 자리 (특성 ◎): 깨지지 않는 큰 샘 */
export function seaSeat(f: Fight, cell: number): void {
  placeTotem(f, 'sea', cell, TX.seaSeat.dur, { firm: true, tick: TX.seaSeat.tick });
}

/** 토템 곁 (주술 18): 토템 범위 안 아군에게 하는 직접 힐 + */
export const totemSide = (f: Fight, u: Unit): number => (f.totems.length && inTotem(f, u) ? sv(f, 'totemSide') : 0);
/** 비구름 동안 가속 (주술 24 비의 서두름) */
export const rainHaste = (f: Fight): number => (raining(f) ? sv(f, 'rainHaste') : 0);
