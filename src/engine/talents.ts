/**
 * 특성 효과: 사제 (06 6장) · 드루이드 · 성기사 (77). 특성이 없으면 어느 함수도 결과를 바꾸지 않는다 (×1, +0, 난수 그대로 → 프로토타입 일치).
 * 보조 버튼 특성 (기적 · 쉼터 · 정점 · 흩빛 · 봄비 · 숲의 기억 · 고목 · 결의 · 새벽)은 GCD 밖에서 바로 쓰고 마나도 안 든다
 */
import { DRUID_BIG, HAND_GUARD, WAVE } from '../data/heroConst';
import { TALENT_DEF, talentKeys, TX, type TalentKey } from '../data/talents';
import { SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { cellOf, emit, heal, living } from './core';
import { barkCut, powerMax, putHot, putSprout } from './heroes';
import { aoeCount, aoeDone, castCut, castMult, cdSpec, costSpec, freeCast, hasteOf, sv } from './specials';
import type { ActionResult, Fight, TalentState, Unit } from './types';

/** 두 겹 수호 충전 시간, 쉼터 초당 회복 */
export const TWO_GUARD_RE = 120;
export const SHELTER_HPS = 30;

/** 받는 피해를 바꾸는 특성 (core damage가 tx.cut일 때만 talentTaken을 부름) */
const CUT_KEYS: TalentKey[] = ['firmStem', 'nearGrove', 'beaconWeight', 'guardOath', 'vowGuard', 'rescueHand', 'lightArmor'];
/** 지속 힐 배율을 바꾸는 특성 (units hotMult가 tx.hotm일 때만 talentHot을 부름) */
const HOT_KEYS: TalentKey[] = ['mossBed', 'greenField'];

export function newTalents(f: Fight): TalentState {
  const on: TalentState['on'] = {};
  for (const k of talentKeys(f.cfg.talents, f.level, f.hero)) on[k] = true;
  const act: TalentState['act'] = {};
  for (const k of Object.keys(on) as TalentKey[]) if (TALENT_DEF[k].active) act[k] = { cd: 0, left: 0, used: false };
  return {
    on, act, griefUntil: -1, echoUntil: -1, lastAct: 0, focus: null, guard: 2, guardRe: 0, repayUsed: false, shelter: -1, later: [],
    any: Object.keys(on).length > 0, cut: CUT_KEYS.some(k => on[k]), hotm: HOT_KEYS.some(k => on[k]), death: !!(on.fallenFlower || on.martyr),
    freeSprout: 0, moss: on.mossBed ? new Map() : null, treeCd: 0, watchCd: 0, telSeen: 0, rebirths: 0, freeLight: false, cleanAt: 0, martyrUntil: -1, breathCd: 0,
  };
}

export const has = (f: Fight, k: TalentKey): boolean => !!f.tx.on[k];
/** 보조 버튼 특성이 지금 켜져 있는지 (정점·흩빛) */
export const activeOn = (f: Fight, k: TalentKey): boolean => (f.tx.act[k]?.left ?? 0) > 0;

/**
 * 마나 소모: 가벼운 손끝 (순간 ×0.8), 말씀의 여운 (×0.5), 기도의 정점 (×1.5), 장비 특수능력 (42, u = 대상을 알 때).
 * 드루이드 · 성기사 (77): 이른 새싹 · 생장의 숨 · 가벼운 파도 · 곧은 마음 · 모아 둔 빛
 */
export function costOf(f: Fight, key: SkillKey, u?: Unit): number {
  let c = SKILLS[key].cost;
  if (key === 'flash' && f.tx.on.lightTouch) c *= 0.8;
  if (f.hero !== 'priest' && f.tx.any) c *= heroCost(f, key, u);
  if (f.tx.echoUntil > f.t) c *= 0.5;
  if (activeOn(f, 'zenith')) c *= 1.5;
  c *= f.manaCut; // 특성 단 마나 보정 (세 직업 공통, 77)
  if (f.sp) c *= costSpec(f, key, u);
  return c;
}

/** 드루이드 · 성기사 특성 마나 배율 (77) */
function heroCost(f: Fight, key: SkillKey, u?: Unit): number {
  const on = f.tx.on;
  switch (key) {
    case 'sprout':
      if (f.tx.freeSprout > 0) return 0; // 생장의 숨
      return on.earlySprout && u && u.hp >= u.max * TX.earlySprout.hp ? TX.earlySprout.cost : 1; // 이른 새싹
    case 'lightWave': return on.freeWave ? 0 : 1; // 가벼운 파도
    case 'holyLight':
    case 'holyStrike':
      if (key === 'holyLight' && f.tx.freeLight) return 0; // 모아 둔 빛
      return on.steadyHeart && u && u.id === f.beacon ? 1 - TX.steadyHeart : 1; // 곧은 마음
    default: return 1;
  }
}

/**
 * 시전 시간: 손에 익은 치유 (치유 -0.3초), 기도의 정점 (즉시), 장비 특수능력 (42: 바람 탄 발걸음 즉시 · 직업 전용 −초 · 발동 가속).
 * 곧은 손길 (빛의 손길 −0.3초) · 다급한 손 (낮은 대상에게 빛의 손길 절반, u = 대상을 알 때, 77)
 */
export function castOf(f: Fight, key: SkillKey, u?: Unit): number {
  const base = f.R.cast?.[key] ?? SKILLS[key].cast;
  if (!(base > 0)) return 0;
  if (activeOn(f, 'zenith')) return 0;
  if (f.sp && freeCast(f, key)) return 0;
  const cut = (key === 'heal' && f.tx.on.practiced) || (key === 'holyLight' && f.tx.on.swiftLight) ? (key === 'heal' ? 0.3 : TX.swiftLight) : 0;
  const quick = key === 'holyLight' && f.tx.on.quickHand && u && u.hp <= u.max * TX.quickHand.hp ? TX.quickHand.cast : 1;
  const b = base - cut - (f.sp ? castCut(f, key) : 0);
  return ((Math.max(0.5, b) * quick) / (1 + hasteOf(f))) * (f.slow && f.t < f.slow.until ? f.slow.mult : 1) * (f.sp ? castMult(f) : 1); // 깨진 시간 (05 5-E) · 낙타 털실 반지
}

/** 재사용 대기 (쓸 때 거는 값): 빨라진 찬가 (찬가 -60초), 장비 특수능력 (42 쿨기 · 해제 · 직업 전용) */
export function cdOf(f: Fight, key: SkillKey): number {
  let cd = f.R.cd?.[key] ?? (SKILLS[key].cd || 0);
  if (key === 'hymn' && f.tx.on.quickHymn) cd -= 60;
  if (f.sp) cd = cdSpec(f, key, cd);
  return cd;
}

/** 화면의 재사용 대기 바 기준 */
export function cdMax(f: Fight, key: SkillKey): number {
  if (key === 'guardian' && f.tx.on.twoGuard) return TWO_GUARD_RE;
  return cdOf(f, key);
}

/** 성언 게이지 상한: 아껴 둔 말씀이면 2회분 */
export const wordCap = (f: Fight): number => (f.tx.on.savedWord ? 200 : 100);
/** 성언을 쓸 수 있는지: 100%, 끊이지 않는 말씀이면 50%부터 (약한 성언) */
export const wordReady = (f: Fight, g: number): boolean => g >= 100 || (!!f.tx.on.endless && g >= 50);
/** 성언 위력: 100% 미만에서 쓰면 50% */
export const wordPower = (g: number): number => (g >= 100 ? 1 : 0.5);
/** 성언을 쓰면 게이지 100 (모자라면 전부) 소모 */
export const wordSpent = (g: number): number => (g >= 100 ? g - 100 : 0);

/** 그 사람 옆 칸 아군 중 체력 비율이 낮은 순서로 n명 */
export function adjLow(f: Fight, u: Unit, n: number, skipRenew = false): Unit[] {
  const c = cellOf(f, u);
  return living(f)
    .filter(v => v !== u && hexDist(cellOf(f, v), c) === 1)
    .sort((a, b) => (skipRenew ? (a.hot > 0 ? 1 : 0) - (b.hot > 0 ? 1 : 0) : 0) || a.hp / a.max - b.hp / b.max)
    .slice(0, n);
}

/** 범위 힐 반경: 넓은 원이면 기원 반경 2 */
export const areaRadius = (f: Fight, key: SkillKey): number => (key === 'poh' && f.tx.on.wideCircle ? 2 : key === 'wildflower' && f.enc.big ? DRUID_BIG.wildRange : 1) + (key === 'wildflower' ? sv(f, 'flowerSea') : 0); // 들꽃 군락 20인 보정 (26 9-1) · 들꽃 바다 (42 드루 04)

/** 치유의 기원 (반경 r) */
export function pohAt(f: Fight, cellIdx: number, amt: number, r: number): void {
  const c = f.cells[cellIdx];
  const vs = living(f).filter(v => hexDist(cellOf(f, v), c) <= r);
  if (f.sp) aoeCount(f, vs.length); // 큰 그릇 · 신전 성수병 (42)
  for (const v of vs) heal(f, v, amt, true);
  if (f.sp) aoeDone(f, cellIdx, amt, r); // 금빛 메아리 (42 발동 11)
}

/** 소생 지속 시간: 긴 숨결 +3초 */
export const renewSec = (f: Fight): number => (f.tx.on.longBreath ? 12 : 9);

/** 한 사람만 본다: 같은 대상을 이어서 치유하면 10%씩, 최대 50% */
export function focusMult(f: Fight, u: Unit): number {
  if (!f.tx.on.focusOne) return 1;
  const n = f.tx.focus && f.tx.focus.uid === u.id ? f.tx.focus.n + 1 : 0;
  f.tx.focus = { uid: u.id, n };
  return 1 + Math.min(5, n) * 0.1;
}

/** 한 대상 직접 힐 뒤 퍼지는 것: 두 방패의 끈, 흩날리는 빛, 번지는 평온 */
export function directSpread(f: Fight, key: SkillKey, u: Unit, amt: number): void {
  if (f.tx.on.twoShields && u.role === 'tank') {
    const o = living(f).find(v => v !== u && v.role === 'tank');
    if (o) heal(f, o, amt * 0.3, true);
  }
  if (activeOn(f, 'scatter')) for (const v of adjLow(f, u, 2)) heal(f, v, amt * 0.4, true);
  if (key === 'serenity' && f.tx.on.spreadSerenity) for (const v of adjLow(f, u, 2)) heal(f, v, amt * 0.5, true);
}

/** 흘러넘침: 치유로 넘친 힐량의 50%를 옆에서 가장 다친 아군에게 (이미 배율이 붙은 값이라 그대로) */
export function overflow(f: Fight, u: Unit, over: number): void {
  if (over <= 0) return;
  const v = adjLow(f, u, 1)[0];
  if (v && v.hp < v.max) heal(f, v, over * 0.5, true, true);
}

/** 옮겨 가는 소생: 끝나면 체력이 가장 낮은 옆 아군에게 한 번 */
export function renewEnd(f: Fight, u: Unit): void {
  if (u.hotHop) return;
  const v = adjLow(f, u, 1, true)[0];
  if (!v) return;
  v.hot = renewSec(f); v.hotTick = 0; v.hotHop = true;
}

/** 보조 버튼 특성을 쓸 수 있는지 (쉼터 칸은 useTalent에서) */
export function talentReady(f: Fight, key: TalentKey): ActionResult {
  const def = TALENT_DEF[key], a = f.tx.act[key];
  if (!def.active || !a) return { ok: false, reason: `${def.name}: 고르지 않은 특성` };
  if (def.active.once && a.used) return { ok: false, reason: `${def.name}: 전투당 1회` };
  if (a.cd > 0) return { ok: false, reason: `${def.name} 재사용 대기 ${Math.ceil(a.cd)}초` };
  if (a.left > 0) return { ok: false, reason: `${def.name} 효과 중` };
  if (key === 'miracle' && f.g.p >= 100 && f.g.s >= 100) return { ok: false, reason: '성언 게이지가 이미 가득 참' };
  if (key === 'springRain' && !living(f).some(v => !sprouted(v))) return { ok: false, reason: '새싹이 없는 아군 없음' };
  if (key === 'oldTree' && !treeSum(f, oldTreeTarget(f))) return { ok: false, reason: '거둘 새싹 없음' };
  return { ok: true };
}

/** 보조 버튼 특성 쓰기 (GCD·마나 없음) */
export function useTalent(f: Fight, key: TalentKey, cellIdx?: number): ActionResult {
  if (f.over) return { ok: false };
  const r = talentReady(f, key);
  if (!r.ok) return r;
  const def = TALENT_DEF[key], a = f.tx.act[key]!;
  if (def.active!.cell) {
    const c = cellIdx == null ? undefined : f.cells[cellIdx];
    if (!c) return { ok: false, reason: '쉼터로 만들 빈 칸 선택' };
    if (c.unit || c.block) return { ok: false, reason: '빈 칸만 고를 수 있음' };
  }
  a.cd = def.active!.cd; a.left = def.active!.dur; a.used = true;
  f.tx.lastAct = f.t;
  if (key === 'miracle') {
    const b = { p: f.g.p, s: f.g.s };
    f.g.p = Math.max(f.g.p, 100); f.g.s = Math.max(f.g.s, 100);
    if (b.p < 100) emit(f, { type: 'gauge', which: '평온' });
    if (b.s < 100) emit(f, { type: 'gauge', which: '신성화' });
  }
  if (key === 'shelter') f.tx.shelter = cellIdx!;
  if (key === 'springRain') for (const v of living(f)) if (!sprouted(v)) putSprout(f, v); // 봄비 (77)
  if (key === 'oldTree') { // 한 그루의 고목 (77): 다른 아군 새싹을 모두 거둬 가장 낮은 사람에게
    const u = oldTreeTarget(f)!, sum = treeSum(f, u);
    for (const v of living(f)) if (v !== u) v.hots = v.hots.filter(h => h.key !== 'sprout');
    heal(f, u, sum * TX.oldTree.mult, true);
  }
  if (key === 'resolveFill') f.power3 = powerMax(f); // 가득 찬 빛 (77): 회복량 +는 켜져 있는 동안 (heroes holyBoost)
  emit(f, { type: 'sound', name: 'chime' });
  emit(f, { type: 'msg', text: def.active!.dur ? `${def.name}: ${def.active!.dur}초` : def.name });
  return { ok: true };
}

const sprouted = (u: Unit) => u.hots.some(h => h.key === 'sprout');
/** 한 그루의 고목 대상: 체력 비율이 가장 낮은 아군 (닿지 않는 사람 빼고) */
const oldTreeTarget = (f: Fight): Unit | undefined => living(f).filter(v => !v.lift).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
/** 한 그루의 고목으로 거둘 새싹 남은 회복량 (대상 말고 다른 아군) */
function treeSum(f: Fight, u: Unit | undefined): number {
  if (!u) return 0;
  let sum = 0;
  for (const v of living(f)) if (v !== u) for (const h of v.hots) if (h.key === 'sprout') sum += h.rest;
  return sum;
}

/** 특성 한 틱: 보조 버튼 시간, 쉼터 회복, 두 겹 수호 충전, 두 번째 기원 · 다시 피는 들꽃 · 구원의 손, 나무의 몸, 경계의 싹, 이끼 */
export function talentTick(f: Fight, dt: number): void {
  const tx = f.tx;
  for (const k in tx.act) {
    const a = tx.act[k as TalentKey]!;
    if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
    if (a.left > 0) {
      a.left -= dt;
      if (a.left <= 1e-9) { a.left = 0; if (k === 'shelter') tx.shelter = -1; }
    }
  }
  if (tx.shelter >= 0) {
    const u = f.cells[tx.shelter].unit;
    if (u && u.alive && !u.moving && u.cell === tx.shelter) heal(f, u, SHELTER_HPS * dt, false);
  }
  if (tx.on.twoGuard) {
    if (tx.guard < 2) {
      tx.guardRe -= dt;
      if (tx.guardRe <= 1e-9) { tx.guard++; tx.guardRe = tx.guard < 2 ? TWO_GUARD_RE : 0; }
    }
    f.cd.guardian = tx.guard > 0 ? 0 : tx.guardRe;
  }
  if (tx.later.length) {
    const due = tx.later.filter(x => x.at <= f.t + 1e-9);
    if (due.length) {
      tx.later = tx.later.filter(x => x.at > f.t + 1e-9);
      for (const x of due) {
        if (x.kind === 'wild') wildAt(f, x.cell, x.amt, x.r); // 다시 피는 들꽃
        else if (x.kind === 'heal') { const u = f.party.find(v => v.id === x.uid); if (u?.alive) heal(f, u, x.amt, true); continue; } // 구원의 손
        else pohAt(f, x.cell, x.amt, x.r);
        emit(f, { type: 'sound', name: 'renew' });
      }
    }
  }
  if (f.hero !== 'priest') heroTalentTick(f, dt);
}

/** 드루이드 · 성기사 특성 한 틱 (77) */
function heroTalentTick(f: Fight, dt: number): void {
  const tx = f.tx, on = tx.on;
  if (tx.treeCd > 0) tx.treeCd -= dt;
  if (tx.watchCd > 0) tx.watchCd -= dt;
  if (tx.breathCd > 0) tx.breathCd -= dt;
  // 나무의 몸: 내 체력이 선 아래면 나에게 나무껍질
  const me = f.me;
  if (on.treeBody && tx.treeCd <= 0 && me.alive && me.hp < me.max * TX.treeBody.hp) {
    tx.treeCd = TX.treeBody.cd;
    me.redu = Math.max(me.redu, TX.treeBody.sec); me.reduCut = barkCut(f);
    emit(f, { type: 'msg', text: `나무의 몸: ${TX.treeBody.sec}초` });
  }
  // 경계의 싹: 새 광역 예고가 뜨면 새싹이 없는 낮은 사람 몇 명에게 절반 새싹 (신기루 가짜는 걷힌 뒤에야 알 수 있으니 진짜 · 가짜 모두)
  if (on.watchSprout && f.tels.length) {
    let fresh = false;
    for (const t of f.tels) if (t.id > tx.telSeen) { if (t.kind === 'aoe') fresh = true; tx.telSeen = t.id; }
    if (fresh && tx.watchCd <= 0) {
      const w = TX.watchSprout;
      const vs = living(f).filter(v => !sprouted(v) && !v.lift).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, w.n);
      if (vs.length) {
        tx.watchCd = w.cd;
        for (const v of vs) putHot(v, 'sprout', { sec: w.sec, every: 3, total: w.amt }).hop = true;
      }
    }
  }
}

/** 들꽃 군락 한 번 (대상 칸 둘레 r): 7초 동안 4번, 처음이 큼. power = 위력 배율 (꽃잎 바람 · 다시 피는 들꽃) */
export function wildAt(f: Fight, cellIdx: number, power: number, r: number): Unit[] {
  const c = f.cells[cellIdx];
  const vs = living(f).filter(v => hexDist(cellOf(f, v), c) <= r);
  const amts = WILD_AMTS.map(a => a * power);
  for (const v of vs) putHot(v, 'wildflower', { sec: 7, every: 1.75, amts }); // 7초 안에 4번 (2026-10-14 검토: 2초 간격이면 마지막 15가 7초에 잘려 145)
  return vs;
}
/** 들꽃 군락 회복 (모두 160) */
export const WILD_AMTS = [70, 45, 30, 15];

/** 받는 피해 배율 (77): 단단한 줄기 · 곁의 숲 · 빛의 무게 · 굳은 서약 · 지키는 맹세 · 구원의 손 · 빛의 갑옷 */
export function talentTaken(f: Fight, u: Unit, magic: boolean): number {
  const on = f.tx.on;
  let m = 1;
  if (on.firmStem && u.role === 'tank' && sprouted(u)) m *= 1 - TX.firmStem;
  if (on.beaconWeight && f.beacon === u.id) m *= 1 - TX.beaconWeight;
  if (on.guardOath && u.hots.some(h => h.key === 'oath')) m *= 1 - TX.guardOath;
  if (on.vowGuard && u.sacr > 0) m *= 1 - TX.vowGuard;
  if (on.rescueHand && magic && u.immune > 0) m *= TX.rescueHand.magic;
  if (u.me) {
    if (on.nearGrove) { const c = cellOf(f, u); m *= 1 - Math.min(TX.nearGrove.max, TX.nearGrove.step * living(f).filter(v => v !== u && hexDist(cellOf(f, v), c) === 1).length); }
    if (on.lightArmor) m *= 1 - TX.lightArmor * f.power3;
  }
  return m;
}

/** 지속 힐 배율 (77): 이끼 자리 (이끼 칸 위에 서 있으면) · 푸른 들판 (새싹이 파티 절반 이상) */
export function talentHot(f: Fight, u: Unit, key: SkillKey): number {
  let m = 1;
  if (f.tx.moss && (f.tx.moss.get(u.cell) ?? -1) > f.t && !u.moving) m *= 1 + TX.mossBed.hot;
  if (key === 'sprout' && f.tx.on.greenField) {
    const all = living(f);
    if (all.filter(sprouted).length >= all.length * TX.greenField.share) m *= 1 + TX.greenField.hot;
  }
  return m;
}

/** 파티원이 쓰러질 때 (77): 남은 꽃 · 순교의 빛 */
export function talentDeath(f: Fight, u: Unit): void {
  if (f.tx.on.fallenFlower) {
    const c = f.cells[u.cell], w = TX.fallenFlower;
    for (const v of living(f)) if (hexDist(cellOf(f, v), c) <= 1) putHot(v, 'bloom', { sec: w.sec, every: 2, total: w.amt, name: '남은 꽃' });
  }
  if (f.tx.on.martyr) { f.power3 = powerMax(f); f.tx.martyrUntil = f.t + TX.martyr.sec; }
}

/** 빛의 파도를 쓰는 데 드는 신성한 힘: 끝없는 빛이면 2칸 (77) */
export const waveNeed = (f: Fight): number => (f.tx.on.endlessLight ? TX.endlessLight : 3);
/** 빛의 파도 최대 인원: 밀려오는 파도 (77) */
export const waveMax = (f: Fight): number => (f.tx.on.fullWave ? TX.fullWave.n : WAVE.max);
/** 빛의 성역 반경 · 초당 회복 배율: 넓은 성역 (77) */
export const sanctuaryReach = (f: Fight): { r: number; hps: number } => (f.tx.on.wideSanctuary ? { r: 2, hps: 1 - TX.wideSanctuary } : { r: 1, hps: 1 });
/** 구원의 손: 보호의 손이 끝날 때 회복 예약 */
export function rescueLater(f: Fight, u: Unit): void {
  if (f.tx.on.rescueHand) f.tx.later.push({ at: f.t + HAND_GUARD.sec, cell: u.cell, amt: TX.rescueHand.amt, r: 0, kind: 'heal', uid: u.id });
}

/** 두 겹 수호: 쓰면 충전 하나, 다 쓰면 다음 충전까지 대기 */
export function spendGuard(f: Fight): void {
  const tx = f.tx;
  tx.guard--;
  if (tx.guardRe <= 0) tx.guardRe = TWO_GUARD_RE;
  f.cd.guardian = tx.guard > 0 ? 0 : tx.guardRe;
}

/** 고요한 찬가: 찬가 동안 도망 안 감·장판 회피 +15% */
export const calmHymn = (f: Fight): boolean => !!f.tx.on.calmHymn && f.channel > 0;
/** 겁먹고 도망가지 않는지: 고요한 찬가 (찬가 동안 모두) · 흔들림 없는 빛 (성역 안, 77) */
export const calmFor = (f: Fight, u: Unit): boolean => calmHymn(f) || (!!f.tx.on.steadyLight && !!f.sanctuary && f.sanctuary.cells.has(u.cell));
/** 장판 회피 보너스: 고요한 찬가 · 흔들림 없는 빛 (+15%) */
export const calmDodge = (f: Fight, u: Unit): number => (calmHymn(f) ? 0.15 : f.tx.on.steadyLight && f.sanctuary?.cells.has(u.cell) ? TX.steadyLight : 0);
