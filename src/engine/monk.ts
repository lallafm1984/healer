/**
 * 수도사 (79 3장): 박자를 타는 힐러. 생기 손바닥 (GCD 1.0)을 2.5초 안에 이어 치면 기 리듬이 올라 손바닥이 세지고,
 * 리듬 3부터 떠도는 안개 재사용이 두 배로 빨리 돈다. 떠도는 안개는 대상이 다 차면 붙은 다친 아군에게 스스로 옮겨 간다.
 * 특성 (79 3-7)과 직업 전용 특수능력 (79 3-8)의 엔진 훅도 여기서. heroes.ts가 직업마다 나눠 부르고, 안개 샘은 판 위 물건 (totems.ts)
 */
import { MONK } from '../data/heroConst';
import { HEROES } from '../data/heroes';
import { SKILLS, type SkillKey } from '../data/skills';
import { TX } from '../data/talents';
import { hexDist } from './board';
import { adjHurt, hurt, near, shun } from './allies';
import { cellOf, emit, heal, healFlow, living, onDebuffEnd } from './core';
import { noteUsed } from './healer';
import { dispellable, doDispel, heroHeal, heroPassive, putHot } from './heroes';
import { activeOn } from './talents';
import { placeTotem } from './totems';
import { aoeCount, aoeDone, guardSec, specDispel, sv, twin, under } from './specials';
import type { Fight, Hot, Unit } from './types';

/** 수도사 전투 상태 (고요한 호흡 · 잔잔한 바람 · 특성 재발동 · 한 점 리듬 대상) */
export interface MonkState {
  /** 고요한 호흡 (Lv 10 패시브): 이 시각까지 마나 소모 −, 썼는지 (전투마다 한 번) */
  calmUntil: number;
  calmUsed: boolean;
  /** 잔잔한 바람 (특성): 이 시각까지 마나 소모 − */
  windUntil: number;
  /** 마지막 손바닥 대상 (한 점 리듬) */
  lastPalm: number;
  mistBodyCd: number;
  crisisCd: number;
  againUsed: boolean;
  telSeen: number;
}
export const newMonk = (): MonkState => ({ calmUntil: -1, calmUsed: false, windUntil: -1, lastPalm: -1, mistBodyCd: 0, crisisCd: 0, againUsed: false, telSeen: 0 });

const st = (f: Fight): MonkState => (f.monk ??= newMonk());
const hasMist = (u: Unit) => u.hots.some(h => h.key === 'wanderMist');

/** 안개 숨결 범위: 1칸 + 넓은 숨결 (수도 05) + 20인 보정 */
export const breathRange = (f: Fight): number => 1 + (f.sp ? sv(f, 'wideBreath') : 0) + (f.enc.big ? MONK.big.breath : 0);

/** 안개가 걸린 아군 (79 3-2): 떠도는 안개 (감싸기 안개 포함)가 붙어 있거나, 모이는 안개 샘 (특성) 범위 안 */
export function misted(f: Fight, u: Unit): boolean {
  if (hasMist(u)) return true;
  if (!f.totems.length) return false;
  const c = cellOf(f, u);
  return f.totems.some(t => t.kind === 'mist' && hexDist(f.cells[t.cell], c) <= 1);
}

// ---------- 기 리듬 ----------
/** 리듬 최대 (일곱 박자 7) · 이어지는 시간 (느슨한 박자 3.5초) */
export const beatMax = (f: Fight): number => (f.tx.on.sevenBeat ? TX.sevenBeat : MONK.beat.max);
export const beatWindow = (f: Fight): number => (f.tx.on.wideBeat ? TX.wideBeat : MONK.beat.window);
/** 리듬을 n 올림 (최대까지) · 이어지는 시간 새로. 박자의 마나 (수도 17): 리듬이 5가 되면 마나. 기 리듬은 Lv 6부터 (79 3-3) */
export function addBeat(f: Fight, n: number): void {
  if (f.level < HEROES.monk.system.lv) return;
  const was = f.beat;
  f.beat = Math.min(beatMax(f), f.beat + n);
  f.beatUntil = f.t + beatWindow(f);
  if (was < MONK.beat.max && f.beat >= MONK.beat.max && f.sp && sv(f, 'beatMana')) f.mana = Math.min(100, f.mana + sv(f, 'beatMana'));
}
/** 리듬이 끊김: 0으로 (흔들림 없는 마음이면 절반 내림, 그다음 박자 안에 또 없으면 또 절반) */
function beatBreak(f: Fight): void {
  f.beat = f.tx.on.steadyMind ? Math.floor(f.beat * TX.steadyMind) : 0;
  f.beatUntil = f.beat > 0 ? f.t + beatWindow(f) : 0;
}

/** 생기 손바닥 배율: 리듬마다 6% (한 점 리듬 같은 대상 9% · 깊은 박자 수도 01 +) · 스며드는 안개 · 묵직한 · 급한 손바닥 */
export function palmMult(f: Fight, u: Unit, beat: number, same: boolean): number {
  const on = f.tx.on;
  const step = (on.focusBeat && same ? TX.focusBeat : MONK.beat.step) + (f.sp ? sv(f, 'deepBeat') : 0);
  let m = 1 + beat * step;
  if (heroPassive(f, '스며드는 안개') && misted(f, u)) m *= 1 + MONK.seep;
  if (on.heavyPalm && u.role === 'tank') m *= 1 + TX.heavyPalm;
  if (on.urgentPalm && u.hp < u.max * TX.urgentPalm.hp) m *= 1 + TX.urgentPalm.heal;
  return m;
}

// ---------- 떠도는 안개 ----------
/** 떠도는 안개 시간 · 모두 회복량 (긴 안개 +6초 그만큼 · 머무는 안개 +30%) */
export function mistSpec(f: Fight): { sec: number; total: number } {
  const on = f.tx.on, sec = MONK.mist.sec + (on.longMist ? TX.longMist : 0);
  return { sec, total: (SKILLS.wanderMist.amt! * sec * (on.stayMist ? 1 + TX.stayMist : 1)) / MONK.mist.sec };
}
/** 안개 걸기. sec · total을 주면 그 값 (감싸기 안개 · 흩어지는 안개 · 안개 길 · 손바닥 안개) */
export function putMist(f: Fight, u: Unit, o = mistSpec(f)): Hot {
  const h = putHot(u, 'wanderMist', { sec: o.sec, every: MONK.mist.tick, total: o.total }); // 한 번 회복량은 3초 틱 기준
  const every = mistEvery(f);
  if (every !== h.every) { h.every = every; h.tick = every; } // 안개 폭풍: 틱만 빨라짐 (한 번 회복량 그대로)
  if (f.tx.on.stayMist) h.stay = true;
  return h;
}
/** 짧은 안개 (sec초, 떠도는 안개와 같은 초당 회복): 감싸기 안개 6초 90 · 흩어지는 안개 9초 · 안개 길 6초 */
export const shortMist = (f: Fight, u: Unit, sec: number, total = (SKILLS.wanderMist.amt! * sec) / MONK.mist.sec): Hot | null => (hasMist(u) ? null : putMist(f, u, { sec, total }));
/** 안개 틱 간격: 안개 폭풍 (특성) 동안 1.5초 */
const mistEvery = (f: Fight): number => (activeOn(f, 'mistStorm') ? TX.mistStorm.tick : MONK.mist.tick);

/** 안개가 옮겨 갈 곳: 붙어 있고 (멀리 가는 안개 2칸) 안개가 없고 체력이 다 차지 않은 아군 중 잃은 체력이 가장 큰 아군 */
function mistTo(f: Fight, u: Unit, skip?: Unit): Unit | undefined {
  const c = cellOf(f, u), r = f.tx.on.farMist ? TX.farMist.range : 1;
  return living(f).filter(v => v !== u && v !== skip && !hasMist(v) && hurt(v) && !v.lift && !shun(v) && hexDist(cellOf(f, v), c) <= r)
    .sort((a, b) => (b.max - b.hp) - (a.max - a.hp))[0];
}

/**
 * 안개 한 틱 (units hotTick, 틱 회복량 amt를 막 뺀 뒤): 대상이 다 차 있으면 옮겨 갈 곳으로 그 틱째 옮겨 감 (남은 시간 · 회복량 그대로).
 * 옮겼으면 true (그 틱 회복은 여기서 함), 옮길 곳이 없거나 머무는 안개면 false (그 틱은 지금 대상에게 = 넘침)
 */
export function mistHop(f: Fight, u: Unit, h: Hot, amt: number): boolean {
  if (h.stay || hurt(u)) return false;
  const v = mistTo(f, u);
  if (!v) return false;
  u.hots = u.hots.filter(x => x !== h);
  v.hots.push(h);
  h.hopK = f.k; h.hops = (h.hops ?? 0) + 1;
  let m = f.tx.on.farMist ? 1 + TX.farMist.step : 1; // 멀리 가는 안개: 옮겨 갈 때마다 다음 회복 +
  if (f.sp && h.hops === 1 && sv(f, 'twinMist')) { // 갈라지는 안개 (수도 02): 처음 옮겨 갈 때 둘로 (남은 회복량 그대로 둘)
    const w = mistTo(f, u, v);
    if (w) w.hots.push({ ...h, hops: h.hops });
  }
  under('wanderMist', true, () => heal(f, v, amt * m, false));
  if (f.sp && sv(f, 'hopHeal')) under('wanderMist', true, () => heal(f, v, h.per, false)); // 옮겨 가며 치유 (수도 19): 한 틱 더
  noteUsed(f, 'wanderMist', v.id);
  return true;
}

// ---------- 스킬 ----------
/** 생기 손바닥 */
function palm(f: Fight, u: Unit): void {
  const s = st(f), on = f.tx.on;
  if (f.beat > 0 && f.t > f.beatUntil + 1e-9 && !activeOn(f, 'thousandHands')) beatBreak(f);
  addBeat(f, 1);
  const same = s.lastPalm === u.id;
  s.lastPalm = u.id;
  const amt = SKILLS.vitalPalm.amt! * palmMult(f, u, f.beat, same);
  heroHeal(f, u, amt);
  if (on.palmSplash) { const v = adjHurt(f, u, 1)[0]; if (v) heal(f, v, amt * TX.palmSplash, true); } // 튀는 손바닥
  if (on.beatSpread && f.beat >= TX.beatSpread.at) for (const v of adjHurt(f, u, TX.beatSpread.n)) heal(f, v, amt * TX.beatSpread.share, true); // 퍼지는 박자
  if (f.sp && sv(f, 'palmMist') && !hasMist(u) && f.rng() < sv(f, 'palmMist')) shortMist(f, u, MONK.wrapMist.sec); // 손바닥 안개 (수도 24)
}
/** 붙어 있는 다친 아군 (체력 비율이 낮은 순) n명 */

/** 되살림 바람 해제: 함정 · 해제 막힘은 건너뛰고 지울 수 있는 마법 · 질병 n개 (79 3-2) */
function windDispel(f: Fight, u: Unit, n: number): void {
  for (let i = 0; i < n; i++) {
    const d = u.debuffs.filter(x => dispellable(f, x.type) && !x.lock && !x.trap).sort((a, b) => (b.stack || 0) - (a.stack || 0))[0];
    if (!d) return;
    u.debuffs = u.debuffs.filter(x => x !== d);
    f.stats.dispels++;
    emit(f, { type: 'dispel', id: u.id, trap: false });
    onDebuffEnd(f, u, d, true);
    if (f.sp) specDispel(f, u, d);
  }
}

/** 수도사 스킬 효과 */
export function monkApply(f: Fight, key: SkillKey, u: Unit): void {
  const on = f.tx.on, s = st(f);
  if (key === 'vitalPalm') {
    palm(f, u);
  } else if (key === 'mistWrap') {
    // 82: 즉시 · 리듬 비례. 늦었으면 (박자 시간이 지남) 리듬이 먼저 끊김, 제때면 박자를 이어 줌 (리듬은 그대로)
    if (f.beat > 0 && f.t > f.beatUntil + 1e-9 && !activeOn(f, 'thousandHands')) beatBreak(f);
    heroHeal(f, u, SKILLS.mistWrap.amt! * (1 + f.beat * MONK.wrap.step));
    if (f.beat > 0) f.beatUntil = f.t + beatWindow(f);
    shortMist(f, u, MONK.wrapMist.sec, MONK.wrapMist.amt);
    if (on.embrace) { u.mods = u.mods.filter(m => m.src !== 'embrace'); u.mods.push({ k: 'cut', v: TX.embrace.cut, until: f.t + TX.embrace.sec, src: 'embrace' }); } // 품어 주기
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
  } else if (key === 'wanderMist') {
    putMist(f, u);
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'clearChi') {
    const n = u.debuffs.length;
    doDispel(f, u);
    if (u.debuffs.length < n) {
      if (on.chiWave) for (const v of near(f, u.cell, 1)) heal(f, v, TX.chiWave.amt, true); // 기의 물결
      if (f.sp && sv(f, 'chiCleanse')) addBeat(f, sv(f, 'chiCleanse')); // 기의 정화 (수도 20)
    }
  } else if (key === 'mistBreath') {
    const r = breathRange(f);
    const vs = near(f, u.cell, r);
    if (f.sp) aoeCount(f, vs.length);
    const amt = SKILLS.mistBreath.amt!;
    for (const v of vs) heal(f, v, amt * (misted(f, v) ? 1 + MONK.breath.mist : 1) * (on.mistPillar && v === u ? TX.mistPillar : 1), true); // 안개 기둥
    if (f.sp) aoeDone(f, u.cell, amt, r);
    emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'soothe') {
    u.redu = guardSec(f, MONK.soothe.sec); u.reduCut = MONK.soothe.cut + sv(f, 'deepSoothe'); // 깊은 누그러뜨림 (수도 04)
    if (f.sp) twin(f, u, v => { v.redu = guardSec(f, MONK.soothe.sec) / 2; v.reduCut = MONK.soothe.cut + sv(f, 'deepSoothe'); }); // 쌍둥이 방패
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'reviveWind') {
    const n = 1 + (f.sp ? sv(f, 'clearWind') : 0); // 맑은 바람 (수도 08)
    for (const v of living(f)) {
      heal(f, v, SKILLS.reviveWind.amt! * (on.windKnot && v.role === 'tank' ? TX.windKnot : 1), true); // 바람 매듭
      windDispel(f, v, n);
      if (on.mistPath) shortMist(f, v, TX.mistPath.sec); // 안개 길
    }
    if (on.calmWind) s.windUntil = f.t + TX.calmWind.sec; // 잔잔한 바람
    emit(f, { type: 'sound', name: 'hymn' });
  } else if (key === 'tea') {
    f.mana = Math.min(100, f.mana + MONK.tea.mana + (f.sp ? sv(f, 'strongTea') : 0)); // 진한 차 (수도 07)
    addBeat(f, MONK.tea.beat);
    emit(f, { type: 'sound', name: 'chime' });
    emit(f, { type: 'msg', text: `차 한 잔: 리듬 ${f.beat}` });
  }
}

// ---------- 마나 · 피해 ----------
/** 수도사 마나 소모 배율 (특성 밖 패시브 포함): 고요한 호흡 · 잔잔한 바람 (모두), 가벼운 손바닥 · 끝없는 박자 · 아끼는 안개 · 아끼는 숨결 */
export function monkCost(f: Fight, key: SkillKey): number {
  const on = f.tx.on, s = f.monk;
  let m = 1;
  if (s && s.calmUntil > f.t) m *= 1 - MONK.calm.cost;
  if (s && s.windUntil > f.t) m *= 1 - TX.calmWind.cost;
  if (key === 'vitalPalm') {
    if (on.lightPalm) m *= 1 - TX.lightPalm;
    if (on.endlessBeat && f.beat >= TX.endlessBeat.at) m *= 1 - TX.endlessBeat.cost;
  }
  if (key === 'wanderMist' && on.mistThrift) m *= TX.mistThrift.cost / SKILLS.wanderMist.cost;
  if (key === 'mistBreath' && on.thriftBreath) m *= TX.thriftBreath.cost / SKILLS.mistBreath.cost;
  return m;
}
/** 손바닥 GCD: 천 개의 손 (특성) 동안 0.5초 (가속 전) */
export const palmGcd = (f: Fight): number | null => (activeOn(f, 'thousandHands') ? TX.thousandHands.gcd : null);

/** 받는 피해 배율: 강철 몸 (나, 리듬마다) · 안개 몸 (켜진 동안) */
export function monkTaken(f: Fight, u: Unit): number {
  if (!u.me) return 1;
  let m = 1;
  if (f.tx.on.ironBody) m *= 1 - Math.min(TX.ironBody.max, TX.ironBody.step * f.beat);
  return m;
}
/** 내가 죽을 피해 (다시 부는 바람): 체력 25%로 버팀. 전투마다 1회 */
export function monkLethal(f: Fight, u: Unit): boolean {
  if (!u.me || !f.tx.on.windAgain) return false;
  const s = st(f);
  if (s.againUsed) return false;
  s.againUsed = true;
  u.hp = u.max * TX.windAgain.hp;
  emit(f, { type: 'msg', text: '다시 부는 바람' });
  return true;
}
/** 파티원이 쓰러짐 (흩어지는 안개): 그 칸과 붙어 있는 아군 3명에게 9초 안개 */
export function monkDeath(f: Fight, u: Unit): void {
  const c = f.cells[u.cell];
  const vs = living(f).filter(v => v !== u && !hasMist(v) && hexDist(cellOf(f, v), c) <= 1).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, TX.scatterMist.n);
  for (const v of vs) shortMist(f, v, TX.scatterMist.sec);
}

// ---------- 한 틱 ----------
/** 수도사 한 틱: 리듬 끊김 · 천 개의 손 · 안개 빨리 돌기 (리듬 3+) · 안개 폭풍 틱 · 안개 샘 · 고요한 호흡 · 특성 (안개 몸 · 위기의 숨결) */
export function monkTick(f: Fight, dt: number): void {
  const s = st(f), on = f.tx.on;
  if (activeOn(f, 'thousandHands')) { if (f.beat > 0) f.beatUntil = Math.max(f.beatUntil, f.t + beatWindow(f)); } // 천 개의 손: 리듬이 안 내려감
  else if (f.beat > 0 && f.t > f.beatUntil + 1e-9) beatBreak(f);
  if (f.beat >= MONK.beat.mistFast && (f.cd.wanderMist ?? 0) > 0) f.cd.wanderMist = Math.max(0, f.cd.wanderMist! - dt * (MONK.beat.mistCdMult - 1)); // 리듬 3부터 안개 두 배로
  const every = mistEvery(f);
  for (const u of f.party) for (const h of u.hots) if (h.key === 'wanderMist' && h.every !== every) { h.every = every; h.tick = Math.min(h.tick, every); } // 안개 폭풍
  for (const t of f.totems) { // 모이는 안개 샘 (특성): 그 칸과 붙은 아군 초당 회복
    if (t.kind !== 'mist') continue;
    under('wanderMist', true, () => { for (const v of near(f, t.cell, 1)) healFlow(f, v, TX.gatherMist.hps * dt); });
  }
  if (!s.calmUsed && heroPassive(f, '고요한 호흡') && f.mana < MONK.calm.mana * 100) { // 고요한 호흡 (Lv 10)
    s.calmUsed = true; s.calmUntil = f.t + MONK.calm.sec;
    emit(f, { type: 'msg', text: `고요한 호흡: ${MONK.calm.sec}초` });
  }
  if (s.mistBodyCd > 0) s.mistBodyCd -= dt;
  if (s.crisisCd > 0) s.crisisCd -= dt;
  const me = f.me;
  if (on.mistBody && s.mistBodyCd <= 0 && me.alive && me.hp < me.max * TX.mistBody.hp) { // 안개 몸
    s.mistBodyCd = TX.mistBody.cd;
    if (!hasMist(me)) putMist(f, me);
    me.mods = me.mods.filter(m => m.src !== 'mistBody');
    me.mods.push({ k: 'cut', v: TX.mistBody.cut, until: f.t + TX.mistBody.sec, src: 'mistBody' });
    emit(f, { type: 'msg', text: `안개 몸: ${TX.mistBody.sec}초` });
  }
  if (on.crisisBreath && f.tels.length) { // 위기의 숨결: 새 광역 예고에 안개 숨결 재사용이 바로 끝남
    let fresh = false;
    for (const t of f.tels) if (t.id > s.telSeen) { if (t.kind === 'aoe') fresh = true; s.telSeen = t.id; }
    if (fresh && s.crisisCd <= 0 && (f.cd.mistBreath ?? 0) > 0) { s.crisisCd = TX.crisisBreath.cd; f.cd.mistBreath = 0; emit(f, { type: 'msg', text: '위기의 숨결' }); }
  }
}

/** 모이는 안개 (특성 ◎): 빈 칸에 안개 샘 */
export function gatherMist(f: Fight, cell: number): void {
  placeTotem(f, 'mist', cell, TX.gatherMist.dur);
}
/** 기 폭발 (특성 ◎): 고른 칸 중심 2칸 안 아군 회복, 리듬마다 +10%, 리듬 0 */
export function chiBurst(f: Fight, cell: number): void {
  const amt = TX.chiBurst.amt * (1 + f.beat * TX.chiBurst.step);
  under(null, false, () => { for (const v of near(f, cell, TX.chiBurst.range)) heal(f, v, amt, true); });
  f.beat = 0; f.beatUntil = 0;
}

/** 안개 손길 (수도 18): 안개가 걸린 아군에게 하는 직접 힐 + */
export const mistTouch = (f: Fight, u: Unit): number => (misted(f, u) ? sv(f, 'mistTouch') : 0);
/** 박자의 서두름 (수도 23): 리듬마다 가속 */
export const beatHaste = (f: Fight): number => (f.hero === 'monk' ? f.beat * sv(f, 'beatHaste') : 0);
