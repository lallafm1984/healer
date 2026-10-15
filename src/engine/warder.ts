/**
 * 결계사 (79 5장): 미리 막는 힐러. 힐과 보호막이 대상에게 인장을 붙이고, 가운데 버튼 심판이 인장이 붙은 가장 다친 6명을 한꺼번에 치유한다.
 * 2026-10-16 Lim 「주인공은 공격 스킬을 넣지 않는다」: 보스를 치는 것 (심판 · 빛의 창 · 거울 막)을 없애고 빛의 창 자리에 막 옮기기
 * 보호막은 힐러 흡수 보호막 (abilities giveAbsorb, P-MELT에 녹음). 특성 (79 5-7)과 직업 전용 특수능력 (79 5-8)의 엔진 훅도 여기서.
 * heroes.ts가 직업마다 나눠 부르고, 성채는 판 위 물건 (totems.ts)
 */
import { WARDER } from '../data/heroConst';
import { SKILLS, type SkillKey } from '../data/skills';
import { TX } from '../data/talents';
import { absorbLeft, giveAbsorb, HEALER_SHIELD } from './abilities';
import { hexDist } from './board';
import { cellOf, emit, heal, healTop, living } from './core';
import { noteUsed } from './healer';
import { doDispel, heroHeal, heroPassive } from './heroes';
import { activeOn } from './talents';
import { placeTotem, totemsOf } from './totems';
import { aoeCount, aoeDone, guardSec, healSpec, raidSec, sv, twin, under } from './specials';
import type { Fight, Unit } from './types';

/** 결계사 전투 상태 (빛의 장막 · 특성 재발동 · 나를 위한 막 · 창 뒤의 심판) */
export interface WarderState {
  /** 빛의 장막을 쓴 뒤 (82): 장막의 숨 · 함께 드는 짐이 켜진 시각까지, judged = 함께 드는 짐 심판을 썼는지 */
  veil: { until: number; judged: boolean } | null;
  stepCd: number;
  preCd: number;
  lastCd: number;
  selfAt: number;
  /** 창 뒤의 심판 (결계 08): 다음 심판 시전 −초 */
  judgeCut: number;
  /** 거울 막 (결계 02): 빛의 막을 씌운 양 (배율 전 단위, 깨질 때 되돌림) */
  barrier: Map<number, number>;
  telSeen: number;
}
export const newWarder = (): WarderState => ({ veil: null, stepCd: 0, preCd: 0, lastCd: 0, selfAt: 0, judgeCut: 0, barrier: new Map(), telSeen: 0 });
const st = (f: Fight): WarderState => (f.warder ??= newWarder());
const hurt = (v: Unit) => v.hp < healTop(v) - 1e-9;
const shun = (v: Unit) => v.debuffs.length > 0 && v.debuffs.some(d => d.invert);
const near = (f: Fight, c: number, r: number) => { const x = f.cells[c]; return living(f).filter(v => hexDist(cellOf(f, v), x) <= r); };
const adjLowest = (f: Fight, u: Unit, n: number, pick: (v: Unit) => boolean = () => true): Unit[] => {
  const c = cellOf(f, u);
  return living(f).filter(v => v !== u && !shun(v) && pick(v) && hexDist(cellOf(f, v), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, n);
};

// ---------- 인장 ----------
/** 인장 시간 (긴 인장 25초) */
export const sealSec = (f: Fight): number => (f.tx.on.longSeal ? TX.longSeal : WARDER.seal.sec);
export const sealed = (f: Fight, u: Unit): boolean => u.seal != null && u.seal > f.t;
/** 인장 붙이기 (다시 붙이면 시간만 새로). 새 인장 (특성): 인장이 없던 아군이면 회복 */
export function putSeal(f: Fight, u: Unit): void {
  if (!u.alive) return;
  const fresh = !sealed(f, u);
  u.seal = f.t + sealSec(f);
  if (fresh && f.tx.on.freshSeal) heal(f, u, TX.freshSeal.amt, true);
}
/** 심판 · 빛의 창이 고르는 아군: 인장이 있고 살아 있고 체력이 다 차지 않은 아군 중 체력 비율이 낮은 순 */
export const sealTargets = (f: Fight, n: number): Unit[] => living(f).filter(u => sealed(f, u) && hurt(u) && !shun(u)).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, n);
/** 심판이 회복하는 최대 인원: 6명 (20인 · 10인 · 5인 보정), 넓은 심판 */
export function judgeCount(f: Fight): number {
  if (f.tx.on.sharedLoad && f.warder?.veil && f.warder.veil.until > f.t && !f.warder.veil.judged) return f.party.length; // 함께 드는 짐 (82): 장막 뒤 첫 심판은 인원 제한 없이
  const base = f.enc.big ? WARDER.big.judge : f.party.length >= 10 ? WARDER.raid.judge : f.party.length >= 5 ? WARDER.five.judge : WARDER.judge.n;
  return f.tx.on.wideJudge ? Math.max(TX.wideJudge, base) : base;
}
/** 심판을 쓸 수 있는지 (인장이 붙은 아군이 있음, 79 5-3) */
export const judgeReady = (f: Fight): boolean => living(f).some(u => sealed(f, u));

// ---------- 보호막 ----------
/** 보호막 씌우기: 양 = 힐과 같은 식 (지능 · 힐 배율 · 힐 증가 특수능력, 치명타 없음), 같은 대상은 남은 양에 더하고 시간은 새로, 내 보호막 합은 최대 체력 60%까지 */
export function giveShield(f: Fight, u: Unit, amt: number, sec: number): number {
  if (!u.alive || amt <= 0) return 0;
  const v = amt * f.gear.heal * f.power * (f.sp ? healSpec(f, u, true) : 1);
  return giveAbsorb(f, u, v, sec, WARDER.shieldCap);
}
/** 내 보호막 (힐러 흡수 보호막)이 있는지 */
const shielded = (f: Fight, u: Unit): boolean => absorbLeft(f, u) > 0;

/** 결계 원 범위: 1칸 (넓은 결계 2칸) + 20인 보정 */
export const circleRange = (f: Fight): number => (f.tx.on.wideWard ? TX.wideWard.range : 1) + (f.enc.big ? WARDER.big.circle : 0);

/** 결계사 직접 힐 배율: 막 위의 빛 (보호막이 있는 대상) · 인장 손길 (결계 18, 인장이 붙은 대상) */
function directMult(f: Fight, u: Unit): number {
  let m = 1;
  if (f.tx.on.lightOnBarrier && shielded(f, u)) m *= 1 + TX.lightOnBarrier;
  if (f.sp && sealed(f, u)) m *= 1 + sv(f, 'sealTouch');
  return m;
}

// ---------- 스킬 ----------
/** 심판 회복 (인장이 붙은 가장 다친 n명) · 심판의 막 (결계 21: 회복량의 비율만큼 보호막) */
function sealBurst(f: Fight, key: SkillKey, n: number, amt: number): Unit[] {
  const vs = sealTargets(f, n);
  vs.forEach((v, i) => {
    noteUsed(f, key, v.id);
    const eff = heal(f, v, amt * (key === 'judgment' && i === 0 && f.tx.on.heavyJudge ? TX.heavyJudge : 1), true); // 무거운 심판
    if (f.sp && sv(f, 'judgeHit') && eff > 0) giveAbsorb(f, v, eff * sv(f, 'judgeHit'), 6, WARDER.shieldCap, true); // 심판의 막 (결계 21)
    if (key === 'judgment' && f.tx.on.sealEcho) v.seal = f.t + sealSec(f); // 인장의 메아리
  });
  return vs;
}
/** 심판 (가운데 버튼, 79 5-3): 인장 6명 (넓은 심판 8명) 90, 인장의 대가 · 심판의 마나. 보스 피해는 없음 (2026-10-16) */
function judgment(f: Fight): void {
  const s = st(f);
  s.judgeCut = 0;
  const vs = sealBurst(f, 'judgment', judgeCount(f), SKILLS.judgment.amt! * (1 + (f.sp ? sv(f, 'deepSeal') : 0)));
  if (s.veil && s.veil.until > f.t && f.tx.on.sharedLoad) s.veil.judged = true;
  if (vs.length >= WARDER.price.n && heroPassive(f, '인장의 대가')) f.mana = Math.min(100, f.mana + WARDER.price.mana);
  if (f.sp && sv(f, 'judgeMana')) f.mana = Math.min(100, f.mana + vs.length * sv(f, 'judgeMana')); // 심판의 마나 (결계 17)
  emit(f, { type: 'sound', name: 'chime' });
}

/** 결계사 스킬 효과 */
export function warderApply(f: Fight, key: SkillKey, u: Unit): void {
  const on = f.tx.on, s = st(f);
  if (key === 'sealHeal') {
    heroHeal(f, u, SKILLS[key].amt! * directMult(f, u));
    putSeal(f, u);
    if (on.sealSpread) for (const v of adjLowest(f, u, TX.sealSpread.n, v => !sealed(f, v))) putSeal(f, v); // 번지는 인장
  } else if (key === 'lightBarrier') {
    const amt = SKILLS.lightBarrier.amt! * (on.thickBarrier && u.role === 'tank' ? 1 + TX.thickBarrier : 1); // 두꺼운 막
    giveShield(f, u, amt, WARDER.barrier.sec);
    s.barrier.set(u.id, amt);
    putSeal(f, u);
    if (on.splitBarrier) for (const v of adjLowest(f, u, 1)) { giveShield(f, v, amt * TX.splitBarrier, WARDER.barrier.sec); putSeal(f, v); } // 갈라지는 막
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'wardCleanse') {
    const n = u.debuffs.length;
    doDispel(f, u);
    if (u.debuffs.length < n) {
      if (on.cleanWard) for (const v of near(f, u.cell, 1)) giveShield(f, v, TX.cleanWard.amt, WARDER.circle.sec); // 맑은 결계
      if (f.sp && sv(f, 'cleanSeal')) putSeal(f, u); // 맑은 인장 (결계 20)
    }
  } else if (key === 'wardCircle') {
    const r = circleRange(f), amt = SKILLS.wardCircle.amt! * (on.wideWard ? 1 + TX.wideWard.amt : 1); // 넓은 결계 · 20인 보정
    const vs = near(f, u.cell, r);
    if (f.sp) aoeCount(f, vs.length);
    for (const v of vs) {
      if (v !== u) noteUsed(f, 'wardCircle', v.id);
      giveShield(f, v, amt * (on.doubleCircle && v === u ? TX.doubleCircle : 1), WARDER.circle.sec); // 두 겹 원
      putSeal(f, v);
    }
    if (f.sp) aoeDone(f, u.cell, amt, r);
    emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'guardWard') {
    // 82: 큰 보호막 (대상 최대 체력 비율, 힐 배율과 상관없이) + 인장. 긴 수호 (결계 04) · 수호의 깃 (42) · 굳은 결계
    const sec = guardSec(f, WARDER.guard.sec + (f.sp ? sv(f, 'longGuard') : 0)), hp = on.firmWard ? TX.firmWard : WARDER.guard.hp;
    giveAbsorb(f, u, u.max * hp, sec, WARDER.shieldCap);
    putSeal(f, u);
    if (f.sp) twin(f, u, v => { giveAbsorb(f, v, v.max * hp / 2, sec / 2, WARDER.shieldCap); }); // 쌍둥이 방패
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'lightVeil') {
    // 82: 파티 전원 보호막 + 인장 (장막의 탱커 2배 · 굳은 장막 결계 05 +). 장막의 숨 · 함께 드는 짐은 쓴 뒤 10초
    const sec = raidSec(f, 'lightVeil', WARDER.veil.sec) + (f.sp ? sv(f, 'longVeil') : 0), amt = SKILLS.lightVeil.amt! * (1 + (f.sp ? sv(f, 'firmVeil') : 0)); // 긴 장막 (결계 07)
    s.veil = { until: f.t + WARDER.veil.after, judged: false };
    for (const v of living(f)) {
      if (v !== f.me) noteUsed(f, 'lightVeil', v.id);
      giveShield(f, v, amt * (on.veilTank && v.role === 'tank' ? TX.veilTank : 1), sec);
      putSeal(f, v);
    }
    emit(f, { type: 'sound', name: 'hymn' });
  } else if (key === 'wardShift') {
    // 막 옮기기 (빛의 창 대신, 2026-10-16): 다른 아군에게 씌운 내 보호막을 절반씩 거두고 (주고받는 막: 거둔 양만큼 회복), 대상에게 기본 막 + 거둔 막
    let got = 0;
    for (const v of living(f)) {
      if (v === u) continue;
      const m = v.mods.find(x => x.k === 'absorb' && x.src === HEALER_SHIELD && x.until > f.t);
      if (!m || m.v <= 0) continue;
      const x = m.v * WARDER.shift.take;
      m.v -= x; got += x;
      if (on.repentTime) under(null, false, () => heal(f, v, x * TX.repentTime.heal, true, true)); // 주고받는 막 (특성 50)
    }
    giveShield(f, u, SKILLS.wardShift.amt!, WARDER.shift.sec);
    if (got > 0) giveAbsorb(f, u, got, WARDER.shift.sec, WARDER.shieldCap, true);
    putSeal(f, u);
    if (f.sp && sv(f, 'spearJudge')) s.judgeCut = sv(f, 'spearJudge'); // 옮긴 뒤의 심판 (결계 08)
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'judgment') {
    judgment(f);
  }
}

// ---------- 마나 · 시전 · 피해 ----------
/** 결계사 마나 배율 (79 5-7): 가벼운 인장 · 아끼는 원 · 끝없는 심판 (심판 마나 없음) */
export function warderCost(f: Fight, key: SkillKey): number {
  const on = f.tx.on;
  if (key === 'judgment' && activeOn(f, 'endlessJudge')) return 0;
  if (key === 'sealHeal' && on.lightSeal) return 1 - TX.lightSeal;
  if (key === 'wardCircle' && on.thriftCircle) return TX.thriftCircle.cost / SKILLS.wardCircle.cost;
  return 1;
}
/** 심판 시전 시간 (가속 전): 심판의 망치 동안 즉시, 끝없는 심판 1.0초, 빠른 심판 1.5초, 창 뒤의 심판 −초 */
export function judgeCast(f: Fight): number {
  if (activeOn(f, 'judgeHammer')) return 0;
  const base = activeOn(f, 'endlessJudge') ? TX.endlessJudge.cast : f.tx.on.quickJudge ? TX.quickJudge : SKILLS.judgment.cast;
  return Math.max(0.5, base - (f.warder?.judgeCut ?? 0));
}
/** 받는 피해 배율: 성채 · 나눠 지는 짐 (나). 빛의 장막은 82부터 보호막 */
export function warderTaken(f: Fight, u: Unit): number {
  const on = f.tx.on;
  let m = 1;
  if (f.totems.length) {
    const c = cellOf(f, u);
    if (f.totems.some(t => t.kind === 'citadel' && hexDist(f.cells[t.cell], c) <= TX.citadel.range)) m *= 1 - TX.citadel.cut;
  }
  if (u.me && on.sharedBurden) m *= 1 - Math.min(TX.sharedBurden.max, TX.sharedBurden.step * living(f).filter(v => v !== u && shielded(f, v)).length);
  return m;
}
/** 마나 재생 배율: 막의 숨 (나에게 보호막) · 장막의 숨 (장막이 쳐진 동안) */
export function warderRegen(f: Fight): number {
  let m = 1;
  if (f.tx.on.barrierBreath && shielded(f, f.me)) m *= 1 + TX.barrierBreath;
  if (f.tx.on.veilBreath && f.warder?.veil && f.warder.veil.until > f.t) m *= TX.veilBreath;
  return m;
}
/** 막의 서두름 (결계 23): 나에게 보호막이 있으면 가속 */
export const shieldHaste = (f: Fight): number => (f.hero === 'warder' && shielded(f, f.me) ? sv(f, 'shieldHaste') : 0);

/** 내 보호막이 피해로 다 깨짐: 깨진 막의 빛 (Lv 4, 더 밝은 깨짐 +) · 막의 인장 (결계 19) · 거울 막 (결계 02) */
export function warderShieldBroken(f: Fight, u: Unit): void {
  if (!u.alive) return;
  if (heroPassive(f, '깨진 막의 빛')) under(null, false, () => heal(f, u, WARDER.broken * (1 + (f.sp ? sv(f, 'brokenMore') : 0)), true));
  if (f.sp && sv(f, 'barrierSeal') && sealed(f, u)) u.seal = f.t + sealSec(f);
  const s = st(f), amt = s.barrier.get(u.id);
  if (amt != null) {
    s.barrier.delete(u.id);
    // 거울 막 (결계 02, 2026-10-16 보스 공격 대신): 붙어 있는 가장 다친 아군에게 그 막 두께의 비율만큼 막
    if (f.sp && sv(f, 'mirrorBarrier')) { const v = adjLowest(f, u, 1)[0]; if (v) giveShield(f, v, amt * sv(f, 'mirrorBarrier'), WARDER.barrier.sec); }
  }
}

// ---------- 한 틱 ----------
/** 결계사 한 틱: 장막 끝, 성채 보호막, 특성 (나를 위한 막 · 막아서기 · 미리 친 결계) */
export function warderTick(f: Fight, dt: number): void {
  const s = st(f), on = f.tx.on;
  if (s.veil && s.veil.until <= f.t) s.veil = null;
  for (const t of f.totems) {
    if (t.kind !== 'citadel') continue;
    t.tick -= dt;
    if (t.tick <= 1e-9) { t.tick += TX.citadel.tick; under(null, false, () => { for (const v of near(f, t.cell, TX.citadel.range)) giveShield(f, v, TX.citadel.amt, TX.citadel.tick + 1); }); }
  }
  if (on.selfBarrier && f.t + 1e-9 >= s.selfAt && f.me.alive) { s.selfAt = f.t + TX.selfBarrier.every; giveShield(f, f.me, TX.selfBarrier.amt, TX.selfBarrier.every); } // 나를 위한 막
  if (s.stepCd > 0) s.stepCd -= dt;
  if (s.preCd > 0) s.preCd -= dt;
  if (s.lastCd > 0) s.lastCd -= dt;
  if (on.stepIn && s.stepCd <= 0) { // 막아서기
    const v = living(f).find(x => x.hp < x.max * TX.stepIn.hp && !shun(x));
    if (v) { s.stepCd = TX.stepIn.cd; giveShield(f, v, TX.stepIn.amt, WARDER.barrier.sec); emit(f, { type: 'msg', text: `막아서기: ${v.nick}` }); }
  }
  if (on.preWard && f.tels.length) { // 미리 친 결계: 새 광역 예고에 결계 원 재사용이 바로 끝남
    let fresh = false;
    for (const t of f.tels) if (t.id > s.telSeen) { if (t.kind === 'aoe') fresh = true; s.telSeen = t.id; }
    if (fresh && s.preCd <= 0 && (f.cd.wardCircle ?? 0) > 0) { s.preCd = TX.preWard.cd; f.cd.wardCircle = 0; }
  }
}
/** 파티원이 쓰러짐 (마지막 결계): 붙어 있는 아군 모두에게 보호막 */
export function warderDeath(f: Fight, u: Unit): void {
  const s = st(f);
  if (s.lastCd > 0) return;
  s.lastCd = TX.lastWard.cd;
  const c = f.cells[u.cell];
  for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) <= 1) giveShield(f, v, TX.lastWard.amt, WARDER.barrier.sec);
}
/** 성채 (특성 ◎): 빈 칸에 12초 (깨지지 않음), 3초마다 보호막 */
export function citadel(f: Fight, cell: number): void {
  placeTotem(f, 'citadel', cell, TX.citadel.dur, { firm: true, tick: 0 });
}
/** 빛의 장막을 쓴 뒤 10초 (장막의 숨 · 함께 드는 짐, 자동 힐러) */
export const veilOf = (f: Fight) => (f.warder?.veil && f.warder.veil.until > f.t ? f.warder.veil : null);
export const citadels = (f: Fight) => totemsOf(f, 'citadel');
