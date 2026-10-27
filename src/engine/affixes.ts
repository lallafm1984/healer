/**
 * 어픽스 전투 효과 (07 3장, 13 3-3). 어픽스가 없으면 f.aff = null이고 아무것도 안 바뀜 (프로토타입 일치).
 */
import type { AffixKey } from '../data/affixes';
import { U, UNIT } from '../data/bosses';
import { addMod } from './abilities';
import { hexDist } from './board';
import { fromDef } from './bosses';
import { addDebuff, cellOf, damage, emit, living, randomTargets } from './core';
import type { Debuff, Fight, Mob, Telegraph, Unit } from './types';

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
  // 115 (2026-10-27 Lim 「더 늘릴만한 요소가 있는지 찾아보자」 → 추천 첫 묶음 8개, 「좋은 어픽스는 제거. 나안」)
  /** 넘침 (WoW 쐐기 Overflowing): 넘친 치유 × share가 그 사람에게 치유 흡수 막 (P-ABSORB 모양, 그 사람 최대 체력 × cap까지, 해제 안 됨). 막은 sec초마다 새로 */
  overflow: { share: 0.5, cap: 0.2, sec: 20 },
  /** 진동 (WoW 쐐기 원래 Quaking, P-QUAKE): first초부터 every초마다 cast초 예고, 울리면 내가 시전 중인 힐이 끊기고 lock초 잠김 + 전원 바탕 체력 dmg (마법) */
  tremor: { first: 12, every: 20, cast: 2, lock: 3, dmg: 0.04 },
  /** 산만함 (WoW 쐐기 Skittish): 탱커 위협 배율 (어그로 96, 되찾기 규칙은 그대로) */
  skittish: 0.6,
  /** 완치 선고 (WoW 쐐기 Afflicted · FF14 선고, P-FULL): first초부터 every초마다 탱커 아닌 1명에게 바탕 체력 drop 피해 + sec초 표식. 가득 차면 사라지고, 시간이 다 되면 바탕 체력 hit */
  doom: { first: 8, every: 30, sec: 8, drop: 0.2, hit: 0.35 },
  /** 결속 (WoW 쐐기 Bolstering): 보스가 아닌 적이 쓰러질 때마다 살아 있는 보스 아닌 적 체력 · 피해 +per (더해서 겹침) */
  bolster: { per: 0.15 },
  /** 옮겨붙는 역병 (WoW 리치 왕 괴저 역병, P-JUMP): first초부터 every초마다 탱커 아닌 1명에게 sec초 질병 (초당 바탕 체력 dot). 지우면 옆 칸 1명에게 × mult로 옮겨붙고, 두면 끝날 때 적 피해 +boost */
  blight: { first: 6, every: 25, sec: 12, dot: 0.03, mult: 1.5, boost: 0.05 },
  /** 시간의 족쇄 (PoE 시간의 사슬): 내 재사용 대기 배율 (특성 버튼 포함) */
  chains: 1.25,
  /** 도전자의 위기 (WoW 쐐기 Challenger's Peril): 파티원이 쓰러질 때마다 제한시간에 더하는 초 */
  peril: 15,
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
  doomAt: number;
  blightAt: number;
  /** 결속: 적 id → 받은 중첩 */
  bolster: Record<number, number>;
  /** 도전자의 위기: 제한시간에 더한 초 (chalTime) */
  lost: number;
}

export function initAffixes(f: Fight, keys: AffixKey[]): void {
  if (!keys.length) return;
  const on: AffixState['on'] = {};
  for (const k of keys) on[k] = true;
  f.aff = { on, raged: false, plagueAt: 15, unstableAt: 20, contagionAt: 12, panicReady: {}, pulseAt: AFX.pulse.first, quakeAt: AFX.quake.first,
    doomAt: AFX.doom.first, blightAt: AFX.blight.first, bolster: {}, lost: 0 };
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
  if (on.bolster) {
    // 결속: 보스 아닌 적의 기술은 피해 × (1 + 중첩 × per). 판 위 쫄 (P-ADD)은 쓰러질 때 add.dmg에 바로 곱함
    for (const s of f.skills) {
      const id = s.mob;
      if (id == null || f.mobs.find(m => m.id === id)?.boss) continue;
      const fire = s.fire, hit = s.hit, mult = (g: Fight) => 1 + AFX.bolster.per * (g.aff?.bolster[id] ?? 0);
      if (fire) s.fire = g => { const m = mult(g); g.dmgMult *= m; try { fire(g); } finally { g.dmgMult /= m; } };
      if (hit) s.hit = (g, t) => { const m = mult(g); g.dmgMult *= m; try { hit(g, t); } finally { g.dmgMult /= m; } };
    }
  }
  // 진동: 보스 기술 부품 (P-QUAKE)을 주기 기술로 더함 → 예고 · 휠 떨림 · 자동 힐러 판단 · 기술 대기열이 그대로 따라옴
  if (on.tremor) {
    const t = AFX.tremor;
    fromDef(f, { key: 'afx-tremor', name: '진동', icon: '진동', kind: 'aoe', first: t.first, period: t.every, cast: t.cast, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(t.dmg), lock: t.lock } });
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
/** 내 재사용 대기 (시간의 족쇄, 115) */
export const affCd = (f: Fight) => (f.aff?.on.chains ? AFX.chains : 1);
/** 탱커 위협 (산만함, 115) */
export const affTankThreat = (f: Fight) => (f.aff?.on.skittish ? AFX.skittish : 1);
/** 제한시간에 셀 이 전투의 시간 (주간 도전): 전투 시간 + 도전자의 위기로 더한 초 (115) */
export const chalTime = (f: Fight) => f.t + (f.aff?.lost ?? 0);

/** 넘침 (115): 넘친 치유 over의 몫이 그 사람에게 치유 흡수 막으로 남음 (core heal, 빚을 갚고 남은 몫) */
export function affOverflow(f: Fight, u: Unit, over: number): void {
  if (!f.aff?.on.overflow || !u.alive || over <= 1e-9) return;
  const o = AFX.overflow, cap = u.max * o.cap, add = over * o.share;
  const d = u.debuffs.find(x => x.name === '넘침');
  if (d) { d.absorbLeft = Math.min(cap, (d.absorbLeft ?? 0) + add); d.left = o.sec; return; }
  addDebuff(f, u, { name: '넘침', type: '마법', left: o.sec, lock: true, absorbLeft: Math.min(cap, add) });
  emit(f, { type: 'fx', name: 'absorb', on: u.id });
}

/** 도전자의 위기 (115): 파티원이 쓰러질 때 (core damage, 나 빼고) */
export function affDeath(f: Fight, u: Unit): void {
  if (!f.aff?.on.peril || u.me) return;
  f.aff.lost += AFX.peril;
  emit(f, { type: 'msg', text: `도전자의 위기: ${u.nick} 쓰러짐, 제한시간 −${AFX.peril}초` });
}

/** 괴저: 보스 평타가 탱커에게 맞을 때 (bossParts autoHit) */
export function affNecrotic(f: Fight, tk: Unit): void {
  if (!f.aff?.on.necrotic || !tk.alive) return;
  const n = AFX.necrotic, d = tk.debuffs.find(x => x.name === '괴저');
  if (d) { d.stack = Math.min(n.max, (d.stack ?? 1) + 1); d.left = n.fade; return; }
  addDebuff(f, tk, { name: '괴저', type: '질병', left: n.fade, lock: true, healCut: n.per, stack: 1 });
}

/** 보스가 아닌 적이 쓰러질 때 (core damageMob · fight mobDown): 복수심 · 결속 */
export function affMobDown(f: Fight, down: Mob): void {
  if (down.boss || f.over) return;
  if (f.aff?.on.bolster) bolster(f, down);
  if (!f.aff?.on.spite) return;
  const s = AFX.spite;
  for (const u of living(f)) {
    const d = u.debuffs.find(x => x.name === '복수심');
    if (d) { d.stack = Math.min(s.max, (d.stack ?? 1) + 1); d.left = s.sec; continue; }
    addDebuff(f, u, { name: '복수심', type: '저주', left: s.sec, lock: true, dot: baseHp(u) * s.dot, stack: 1, stackMax: s.max });
  }
  emit(f, { type: 'msg', text: '복수심: 파티 전체 지속 피해' });
}

/** 결속 (115): 살아 있는 보스 아닌 적 체력 (남은 비율 그대로) · 피해 +per. 일반 구간은 적 체력 합 (보스 막대)도 */
function bolster(f: Fight, down: Mob): void {
  const a = f.aff!, per = AFX.bolster.per;
  const left = f.mobs.filter(m => m.alive && !m.boss && m !== down);
  if (!left.length) return;
  for (const m of left) {
    const n = a.bolster[m.id] ?? 0, k = (1 + per * (n + 1)) / (1 + per * n);
    a.bolster[m.id] = n + 1;
    if (!m.add && f.bodyHp) f.bossMax += m.max * (k - 1);
    m.max *= k; m.hp *= k;
    if (m.add) m.add.dmg *= k;
  }
  if (f.bodyHp) f.bossHp = f.mobs.reduce((s, q) => s + (q.add ? 0 : q.hp), 0);
  emit(f, { type: 'msg', text: `결속: 남은 적 체력 · 피해 +${Math.round(per * 100)}%` });
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
  if (a.on.doom && f.t >= a.doomAt) {
    const d = AFX.doom;
    a.doomAt += d.every;
    for (const u of randomTargets(f, 1, u => u.role !== 'tank' && !u.debuffs.some(x => x.name === '완치 선고'))) {
      damage(f, u, baseHp(u) * d.drop, true); // 걸릴 때 한 번 (가득 찬 사람도 바로 안 풀림, 모자 뽑기 drop과 같음)
      if (u.alive) addDebuff(f, u, { name: '완치 선고', type: '저주', left: d.sec, lock: true, cureAt: 1, end: { p: 'hit', dmg: baseHp(u) * d.hit } });
    }
  }
  if (a.on.blight && f.t >= a.blightAt) {
    const b = AFX.blight;
    a.blightAt += b.every;
    for (const u of randomTargets(f, 1, u => u.role !== 'tank' && !u.debuffs.some(x => x.name === '옮겨붙는 역병')))
      addDebuff(f, u, { name: '옮겨붙는 역병', type: '질병', left: b.sec, dot: baseHp(u) * b.dot, end: { p: 'jump', sec: b.sec, mult: b.mult, boost: b.boost } });
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
