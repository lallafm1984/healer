/**
 * 어픽스 전투 효과 (07 3장, 13 3-3). 어픽스가 없으면 f.aff = null이고 아무것도 안 바뀜 (프로토타입 일치).
 */
import type { AffixKey } from '../data/affixes';
import { UNIT } from '../data/bosses';
import { addMod } from './abilities';
import { hexDist } from './board';
import { addDebuff, cellOf, damage, emit, living, randomTargets } from './core';
import type { Debuff, Fight, Telegraph, Unit } from './types';

const RAGE = { at: 0.3, mult: 1.3 };
const FRENZY = 1.3;
const HASTE = 0.85;
const DRY = 0.8;
/**
 * 110 새 어픽스 (2026-10-22 Lim 「다양한 어픽스를 추가」). 피해 비율은 보스 기술처럼 역할 바탕 체력 (UNIT) 기준이라 적 피해 배율 (레벨 · 단계)을 함께 탐
 * (그 사람 최대 체력에 곱하면 레벨 배율이 두 번 들어가 Lv 100 지진이 전멸을 냈음)
 */
export const AFX = {
  /** 깊은 상처: 체력 below 아래인 동안 every초마다 1중첩 (최대 max), 중첩마다 초당 바탕 체력 dot, below 이상이면 사라짐 (쇠약 P-WOUND 모양) */
  grievous: { below: 0.9, every: 2, max: 3, dot: 0.005 },
  /** 파동: first초부터 every초마다 파티 전체 바탕 체력 dmg (마법) */
  pulse: { first: 15, every: 25, dmg: 0.08 },
  /** 괴저: 보스 평타를 맞은 탱커에게 1중첩 (받는 치유 −per), 최대 max, fade초 안 맞으면 사라짐 */
  necrotic: { per: 0.04, max: 5, fade: 5 },
  /** 고갈: 내 마나 회복 배율 */
  drain: 0.5,
  /** 한기: 내 시전 시간 배율 */
  chill: 1.15,
  /** 폭군: 보스 구간 보스 체력 · 피해 배율 */
  tyrant: { hp: 1.15, dmg: 1.1 },
  /** 지진: first초부터 every초마다 n명에게 표시, delay초 뒤 그 사람 바탕 체력 self · 옆 칸 near (고정 피해) */
  quake: { first: 10, every: 20, n: 2, delay: 3, self: 0.12, near: 0.06 },
  /** 복수심: 보스가 아닌 적이 쓰러질 때마다 파티 전체에 sec초 지속 피해 (초당 바탕 체력 dot), 또 쓰러지면 중첩 (최대 max) · 시간 새로 */
  spite: { sec: 4, dot: 0.04, max: 5 },
};

export interface AffixState {
  on: Partial<Record<AffixKey, true>>;
  raged: boolean;
  plagueAt: number;
  unstableAt: number;
  contagionAt: number;
  /** 동요: 다시 패닉할 수 있는 시각 */
  panicReady: Record<number, number>;
  pulseAt: number;
  quakeAt: number;
}

export function initAffixes(f: Fight, keys: AffixKey[]): void {
  if (!keys.length) return;
  const on: AffixState['on'] = {};
  for (const k of keys) on[k] = true;
  f.aff = { on, raged: false, plagueAt: 15, unstableAt: 20, contagionAt: 12, panicReady: {}, pulseAt: AFX.pulse.first, quakeAt: AFX.quake.first };
  if (on.tyrant && f.enc.script !== 'trash') { f.bossMax *= AFX.tyrant.hp; f.bossHp *= AFX.tyrant.hp; f.dmgMult *= AFX.tyrant.dmg; }
  if (on.haste) for (const s of f.skills) if (!s.hidden && isFinite(s.period)) { s.period *= HASTE; if (isFinite(s.next)) s.next *= HASTE; }
  if (on.frenzy) {
    for (const m of f.mobs) if (!m.boss) { m.hp *= FRENZY; m.max *= FRENZY; }
    if (f.enc.script === 'trash') { f.bossMax = f.bossHp = f.mobs.reduce((a, m) => a + m.hp, 0); }
    // 보스 아닌 적의 기술은 피해 ×1.3
    for (const s of f.skills) {
      if (s.mob == null || f.mobs.find(m => m.id === s.mob)?.boss) continue;
      const fire = s.fire, hit = s.hit;
      if (fire) s.fire = g => { g.dmgMult *= FRENZY; try { fire(g); } finally { g.dmgMult /= FRENZY; } };
      if (hit) s.hit = (g, t) => { g.dmgMult *= FRENZY; try { hit(g, t); } finally { g.dmgMult /= FRENZY; } };
    }
  }
  // 동요는 능력 효과(멈춤)를 빌려 씀 → 능력 틱이 돌아야 풀림
  if (on.panic) f.abOn = true;
}

/** 역할 바탕 체력 (보스 기술 U.tank · U.dps · U.me와 같은 단위) */
const baseHp = (u: Unit) => (u.role === 'tank' ? UNIT.tank : u.me ? UNIT.me : UNIT.dps);

/** 받는 치유 (메마름) */
export const affHeal = (f: Fight) => (f.aff?.on.dry ? DRY : 1);
/** 내 마나 회복 (고갈) */
export const affRegen = (f: Fight) => (f.aff?.on.drain ? AFX.drain : 1);
/** 내 시전 시간 (한기) */
export const affCast = (f: Fight) => (f.aff?.on.chill ? AFX.chill : 1);

/** 괴저: 보스 평타가 탱커에게 맞을 때 (bossParts autoHit) */
export function affNecrotic(f: Fight, tk: Unit): void {
  if (!f.aff?.on.necrotic || !tk.alive) return;
  const n = AFX.necrotic, d = tk.debuffs.find(x => x.name === '괴저');
  if (d) { d.stack = Math.min(n.max, (d.stack ?? 1) + 1); d.left = n.fade; return; }
  addDebuff(f, tk, { name: '괴저', type: '질병', left: n.fade, lock: true, healCut: n.per, stack: 1 });
}

/** 복수심: 보스가 아닌 적이 쓰러질 때 (core damageMob · fight mobDown) */
export function affMobDown(f: Fight, boss: boolean): void {
  if (!f.aff?.on.spite || boss || f.over) return;
  const s = AFX.spite;
  for (const u of living(f)) {
    const d = u.debuffs.find(x => x.name === '복수심');
    if (d) { d.stack = Math.min(s.max, (d.stack ?? 1) + 1); d.left = s.sec; continue; }
    addDebuff(f, u, { name: '복수심', type: '저주', left: s.sec, lock: true, dot: baseHp(u) * s.dot, stack: 1, stackMax: s.max });
  }
  emit(f, { type: 'msg', text: '복수심: 파티 전체 지속 피해' });
}

/** 매 틱 */
export function affixTick(f: Fight): void {
  const a = f.aff!;
  if (a.on.rage && !a.raged && f.enc.script !== 'trash' && f.bossHp <= f.bossMax * RAGE.at) {
    a.raged = true; f.dmgMult *= RAGE.mult;
    emit(f, { type: 'phase', text: '격노: 보스 피해 +30%' });
  }
  if (a.on.plague && f.t >= a.plagueAt) {
    a.plagueAt += 25;
    for (const u of randomTargets(f, 2, u => !u.me && !u.debuffs.some(d => d.name === '역병 독'))) addDebuff(f, u, { name: '역병 독', type: '독', left: 10, dot: 15 });
  }
  if (a.on.unstable && f.t >= a.unstableAt) {
    a.unstableAt += 30;
    for (const u of randomTargets(f, 1, u => !u.debuffs.some(d => d.name === '불안정'))) addDebuff(f, u, { name: '불안정', type: '마법', left: 8, trap: true });
  }
  if (a.on.contagion && f.t >= a.contagionAt) {
    a.contagionAt += 30;
    for (const u of randomTargets(f, 2, u => !u.debuffs.some(d => d.name === '전염병'))) addDebuff(f, u, { name: '전염병', type: '질병', left: 12, dot: 10 });
  }
  if (a.on.grievous) {
    const g = AFX.grievous;
    for (const u of f.party) {
      if (!u.alive || u.hp >= u.max * g.below || u.debuffs.some(d => d.name === '깊은 상처')) continue;
      addDebuff(f, u, { name: '깊은 상처', type: '저주', left: Infinity, lock: true, cureAt: g.below, grow: { every: g.every, dot: baseHp(u) * g.dot, max: g.max }, stack: 0 });
    }
  }
  if (a.on.pulse && f.t >= a.pulseAt) {
    a.pulseAt += AFX.pulse.every;
    emit(f, { type: 'msg', text: '파동: 파티 전체 피해' });
    for (const u of living(f)) damage(f, u, baseHp(u) * AFX.pulse.dmg, true, 'fixed');
  }
  if (a.on.quake && f.t >= a.quakeAt) {
    a.quakeAt += AFX.quake.every;
    for (const u of randomTargets(f, AFX.quake.n, u => !u.debuffs.some(d => d.name === '지진'))) addDebuff(f, u, { name: '지진', type: '마법', left: AFX.quake.delay, lock: true });
  }
  if (a.on.panic) {
    for (const u of f.party) {
      if (!u.alive || u.me || u.hp > u.max * 0.3 || (a.panicReady[u.id] || 0) > f.t) continue;
      a.panicReady[u.id] = f.t + 15;
      addMod(u, { k: 'nodps', v: 1, until: f.t + 3, src: 'panic' });
      emit(f, { type: 'msg', text: `동요: ${u.nick} 패닉` });
    }
  }
}

/** 디버프가 끝날 때 (지움 = dispelled). 불안정 함정·메아리 · 지진 */
export function affDebuffEnd(f: Fight, u: Unit, d: Debuff, dispelled: boolean): void {
  if (d.name === '지진') {
    emit(f, { type: 'msg', text: `지진: ${u.nick} 주변 피해` });
    const c = cellOf(f, u);
    damage(f, u, baseHp(u) * AFX.quake.self, true, 'fixed');
    for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) <= 1) damage(f, v, baseHp(v) * AFX.quake.near, true, 'fixed');
    return;
  }
  if (d.name === '불안정') {
    if (dispelled) {
      emit(f, { type: 'msg', text: `불안정 폭발: ${u.nick} 주변 피해` });
      const c = cellOf(f, u);
      for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) <= 1) damage(f, v, 150, true);
    } else damage(f, u, 250, true);
    return;
  }
  if (dispelled && f.aff?.on.echo && !d.trap && f.rng() < 0.1) {
    const c = cellOf(f, u);
    const v = living(f).find(x => x !== u && hexDist(cellOf(f, x), c) === 1 && !x.debuffs.some(e => e.name === d.name));
    if (v) { addDebuff(f, v, { name: d.name, type: d.type, left: d.left > 1 ? d.left : 6, dot: d.dot, stack: d.stack }); emit(f, { type: 'msg', text: `메아리: ${d.name}이(가) ${v.nick}에게 옮겨감` }); }
  }
}

/** 혼돈의 바닥: 장판 예고에 1곳 더 (파티원이 선 칸 중 하나) */
export function affChaos(f: Fight, tel: Telegraph): void {
  if (!f.aff?.on.chaos || tel.kind !== 'zone') return;
  const c = living(f).filter(u => !tel.cells.has(u.cell));
  if (!c.length) return;
  tel.cells.add(c[Math.floor(f.rng() * c.length)].cell);
}
