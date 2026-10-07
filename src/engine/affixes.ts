/**
 * 어픽스 전투 효과 (07 3장, 13 3-3). 어픽스가 없으면 f.aff = null이고 아무것도 안 바뀜 (프로토타입 일치).
 */
import type { AffixKey } from '../data/affixes';
import { addMod } from './abilities';
import { hexDist } from './board';
import { addDebuff, cellOf, damage, emit, living, randomTargets } from './core';
import type { Debuff, Fight, Telegraph, Unit } from './types';

const RAGE = { at: 0.3, mult: 1.3 };
const FRENZY = 1.3;
const HASTE = 0.85;
const DRY = 0.8;

export interface AffixState {
  on: Partial<Record<AffixKey, true>>;
  raged: boolean;
  plagueAt: number;
  unstableAt: number;
  contagionAt: number;
  /** 동요: 다시 패닉할 수 있는 시각 */
  panicReady: Record<number, number>;
}

export function initAffixes(f: Fight, keys: AffixKey[]): void {
  if (!keys.length) return;
  const on: AffixState['on'] = {};
  for (const k of keys) on[k] = true;
  f.aff = { on, raged: false, plagueAt: 15, unstableAt: 20, contagionAt: 12, panicReady: {} };
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

/** 받는 치유 (메마름) */
export const affHeal = (f: Fight) => (f.aff?.on.dry ? DRY : 1);

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
  if (a.on.panic) {
    for (const u of f.party) {
      if (!u.alive || u.me || u.hp > u.max * 0.3 || (a.panicReady[u.id] || 0) > f.t) continue;
      a.panicReady[u.id] = f.t + 15;
      addMod(u, { k: 'nodps', v: 1, until: f.t + 3, src: 'panic' });
      emit(f, { type: 'msg', text: `동요: ${u.nick} 패닉` });
    }
  }
}

/** 디버프가 끝날 때 (지움 = dispelled). 불안정 함정·메아리 */
export function affDebuffEnd(f: Fight, u: Unit, d: Debuff, dispelled: boolean): void {
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
