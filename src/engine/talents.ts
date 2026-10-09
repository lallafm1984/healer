/**
 * 사제 특성 효과 (06 6장). 특성이 없으면 어느 함수도 결과를 바꾸지 않는다 (×1, +0, 난수 그대로 → 프로토타입 일치).
 * 보조 버튼 특성(기적·쉼터·정점·흩빛)은 GCD 밖에서 바로 쓰고 마나도 안 든다
 */
import { DRUID_BIG } from '../data/heroConst';
import { TALENT_DEF, talentKeys, type TalentKey } from '../data/talents';
import { SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { cellOf, emit, heal, living } from './core';
import type { ActionResult, Fight, TalentState, Unit } from './types';

/** 두 겹 수호 충전 시간, 쉼터 초당 회복 */
export const TWO_GUARD_RE = 120;
export const SHELTER_HPS = 30;

export function newTalents(f: Fight): TalentState {
  const on: TalentState['on'] = {};
  if (f.hero === 'priest') for (const k of talentKeys(f.cfg.talents, f.level)) on[k] = true;
  const act: TalentState['act'] = {};
  for (const k of Object.keys(on) as TalentKey[]) if (TALENT_DEF[k].active) act[k] = { cd: 0, left: 0, used: false };
  return { on, act, griefUntil: -1, echoUntil: -1, lastAct: 0, focus: null, guard: 2, guardRe: 0, repayUsed: false, shelter: -1, later: [] };
}

export const has = (f: Fight, k: TalentKey): boolean => !!f.tx.on[k];
/** 보조 버튼 특성이 지금 켜져 있는지 (정점·흩빛) */
export const activeOn = (f: Fight, k: TalentKey): boolean => (f.tx.act[k]?.left ?? 0) > 0;

/** 마나 소모: 가벼운 손끝 (순간 ×0.8), 말씀의 여운 (×0.5), 기도의 정점 (×1.5) */
export function costOf(f: Fight, key: SkillKey): number {
  let c = SKILLS[key].cost;
  if (key === 'flash' && f.tx.on.lightTouch) c *= 0.8;
  if (f.tx.echoUntil > f.t) c *= 0.5;
  if (activeOn(f, 'zenith')) c *= 1.5;
  if (f.standin) c *= f.standin.mana; // 특성 트리 없는 직업 임시 보정
  return c;
}

/** 시전 시간: 손에 익은 치유 (치유 -0.3초), 기도의 정점 (즉시) */
export function castOf(f: Fight, key: SkillKey): number {
  const base = f.R.cast?.[key] ?? SKILLS[key].cast;
  if (!(base > 0)) return 0;
  if (activeOn(f, 'zenith')) return 0;
  return (key === 'heal' && f.tx.on.practiced ? base - 0.3 : base) / (1 + f.gear.haste);
}

/** 재사용 대기 (쓸 때 거는 값): 빨라진 찬가 (찬가 -60초) */
export function cdOf(f: Fight, key: SkillKey): number {
  let cd = SKILLS[key].cd || 0;
  if (key === 'hymn' && f.tx.on.quickHymn) cd -= 60;
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
export const areaRadius = (f: Fight, key: SkillKey): number => (key === 'poh' && f.tx.on.wideCircle ? 2 : key === 'wildflower' && f.enc.big ? DRUID_BIG.wildRange : 1); // 들꽃 군락 20인 보정 (26 9-1)

/** 치유의 기원 (반경 r) */
export function pohAt(f: Fight, cellIdx: number, amt: number, r: number): void {
  const c = f.cells[cellIdx];
  for (const v of living(f)) if (hexDist(cellOf(f, v), c) <= r) heal(f, v, amt, true);
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
  emit(f, { type: 'sound', name: 'bell' });
  emit(f, { type: 'msg', text: def.active!.dur ? `${def.name}: ${def.active!.dur}초` : def.name });
  return { ok: true };
}

/** 특성 한 틱: 보조 버튼 시간, 쉼터 회복, 두 겹 수호 충전, 두 번째 기원 */
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
      for (const x of due) { pohAt(f, x.cell, x.amt, x.r); emit(f, { type: 'sound', name: 'renew' }); }
    }
  }
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
