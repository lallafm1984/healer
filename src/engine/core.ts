import { DISPELLABLE } from '../data/skills';
import { hexDist } from './board';
import type { Cell, Debuff, Fight, FightEvent, Unit } from './types';

/** 한 틱 = 0.05초 */
export const DT = 0.05;

export const living = (f: Fight): Unit[] => f.party.filter(u => u.alive);
export const cellOf = (f: Fight, u: Unit): Cell => f.cells[u.cell];
export const unitById = (f: Fight, id: number): Unit | undefined => f.party.find(x => x.id === id);

export function emit(f: Fight, ev: FightEvent): void {
  f.events.push(ev);
}

/** 파티원 말풍선. force가 아니면 4초 간격 + 60% 확률 */
export function bark(f: Fight, u: Unit, text?: string | null, force?: boolean): void {
  if (!u.alive || u.me) return;
  if (!force && f.t - u.barkAt < 4) return;
  if (!force && f.rng() > 0.6) return;
  u.barkAt = f.t;
  const barks = u.p.barks;
  emit(f, { type: 'bark', id: u.id, text: text || barks?.[Math.floor(f.rng() * barks.length)] || '' });
}

/** 회복. direct = 직접 힐(숫자 표시, 관심·감사 성격 반응) */
export function heal(f: Fight, u: Unit, amt: number, direct: boolean): number {
  if (!u.alive || amt <= 0) return 0;
  amt *= f.gear.heal * f.power;
  const crit = f.rng() < f.gear.crit;
  if (crit) amt *= 1.5;
  const eff = Math.min(amt, u.max - u.hp);
  u.hp += eff;
  f.stats.healed += eff;
  f.stats.overheal += amt - eff;
  if (direct) {
    emit(f, { type: 'heal', id: u.id, amt: Math.round(amt), eff: Math.round(eff), crit });
    u.lastHeal = f.t;
    if (u.sulking) u.sulking = false;
    if (u.p.thanks) { u.thanks = 3; if (f.rng() < 0.35) bark(f, u); }
  }
  return eff;
}

/** 피해. magic = 보스 광역·장판·지속 피해 (평타·버스터·잡몹 근접은 물리, 17 수호기사) */
export function damage(f: Fight, u: Unit, amt: number, magic = false): void {
  if (!u.alive || amt <= 0) return;
  amt *= f.dmgMult;
  if (u.shield > 0) amt *= 0.6;
  if (u.cls) {
    if (magic && u.cls === 'paladin') amt *= 0.9;
    if (u.cls === 'swordsman') u.flow = 3;
  }
  u.hp -= amt;
  if (amt > u.max * 0.15) u.flash = 0.35;
  if (u.hp <= 0) {
    if (u.guardian > 0) {
      u.guardian = 0;
      u.hp = u.max * 0.4;
      emit(f, { type: 'sound', name: 'bell' });
      emit(f, { type: 'msg', text: `수호 영혼이 ${u.nick}을(를) 살림` });
      return;
    }
    // 쓰러지면 칸을 비운다 → 다른 파티원이 그 칸으로 이동할 수 있음 (2026-10-07 Lim)
    if (u.moving) { const to = f.cells[u.moving.to]; if (to.unit === u) to.unit = null; }
    { const here = f.cells[u.cell]; if (here.unit === u) here.unit = null; }
    u.alive = false; u.hp = 0; u.debuffs = []; u.hot = 0; u.echo = []; u.moving = null; u.react = null; u.shield = 0; u.diedAt = f.t;
    if (u.max < u.base) u.max = u.base;
    f.stats.deaths++;
    emit(f, { type: 'death', id: u.id });
    emit(f, { type: 'sound', name: 'death' });
  }
}

export function addDebuff(f: Fight, u: Unit, d: Omit<Debuff, 'id'>): Debuff {
  const o: Debuff = { id: f.nextId++, ...d };
  u.debuffs.push(o);
  if (DISPELLABLE[o.type] && !o.trap) f.stats.dispellable++;
  emit(f, { type: 'debuff', id: u.id, dtype: o.type });
  return o;
}

/** 살아 있는 파티원 중 무작위 n명 */
export function randomTargets(f: Fight, n: number, filter?: (u: Unit) => boolean): Unit[] {
  const c = living(f).filter(filter || (() => true));
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(f.rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c.slice(0, n);
}

/** 전염이 터짐: 이웃 칸에 피해 + 독침 */
export function spread(f: Fight, u: Unit): void {
  const c = cellOf(f, u);
  emit(f, { type: 'sound', name: 'burst' });
  for (const v of living(f)) {
    if (v !== u && hexDist(cellOf(f, v), c) === 1) {
      damage(f, v, 150, true);
      if (v.alive) addDebuff(f, v, { name: '독침', type: '독', left: 12, dot: 15 });
    }
  }
}

export function onDebuffEnd(f: Fight, u: Unit, d: Debuff, _dispelled: boolean): void {
  if (d.name === '썩은 숨결') u.max = u.base;
  if (d.name === '전염') spread(f, u);
}
