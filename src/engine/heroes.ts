/**
 * 직업별 스킬 효과와 고유 시스템 (25 3장). 사제는 06.
 * healer.ts가 공통 흐름(시전·마나·GCD·예약)을 맡고, 여기서는 「맞았을 때 무슨 일이 일어나는가」만 다룬다.
 */
import { HEROES, type HeroKey } from '../data/heroes';
import { BARK, BEACON, HAND_GUARD, REBIRTH, SANCTUARY } from '../data/heroConst';
import { SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { aoeMana, cellOf, emit, heal, living, onDebuffEnd } from './core';
import { reviveUnit } from './items';
import { areaRadius } from './talents';
import type { Fight, Hot, Unit } from './types';

/** 그 직업 패시브를 배웠는지 (25 3장: 직업마다 Lv 4·10) */
export const heroPassive = (f: Fight, name: string): boolean => {
  const p = HEROES[f.hero].passives.find(x => x.name === name);
  return !!p && f.level >= p.lv;
};

/** 지속 힐 걸기 (같은 스킬은 덮어씀) */
export function putHot(u: Unit, key: SkillKey, o: { sec: number; every: number; total?: number; amts?: number[] }): Hot {
  const amts = o.amts;
  const n = Math.round(o.sec / o.every);
  const per = amts ? 0 : (o.total || 0) / n;
  const sum = amts ? amts.reduce((a, b) => a + b, 0) : o.total || 0;
  const h: Hot = { key, name: SKILLS[key].name, left: o.sec, tick: o.every, every: o.every, per, amts, i: 0, rest: sum, sum };
  u.hots = u.hots.filter(x => x.key !== key);
  u.hots.push(h);
  return h;
}

/** 그 사람에게 걸린 지속 힐 개수 (사제 소생 포함) */
export const hotCount = (u: Unit) => u.hots.length + (u.hot > 0 ? 1 : 0);

/** 직접 힐 (직업 패시브·봉화까지). 성기사 봉화는 다른 사람에게 한 힐의 40%를 봉화 대상에게 */
export function heroHeal(f: Fight, u: Unit, amt: number): number {
  let m = 1;
  if (f.hero === 'druid' && heroPassive(f, '뿌리 깊음') && hotCount(u) >= 2) m = 1.1;
  if (f.hero === 'paladin' && heroPassive(f, '굳건한 손') && u.role === 'tank') m = 1.1;
  const done = heal(f, u, amt * m, true);
  if (f.hero === 'paladin' && f.beacon != null && f.beacon !== u.id) {
    const b = f.party.find(x => x.id === f.beacon);
    if (b && b.alive) heal(f, b, amt * m * BEACON.share, false);
  }
  return done;
}

/** 봉화 지정 (휠 가운데를 누르고 칸 탭). 전투 중 바꾸기는 10초 대기 */
export function setBeacon(f: Fight, u: Unit): boolean {
  if (f.hero !== 'paladin' || f.level < HEROES.paladin.system.lv) return false;
  if (f.beaconCd > 0 || !u.alive) return false;
  f.beacon = u.id;
  f.beaconCd = BEACON.cd;
  emit(f, { type: 'beacon', id: u.id });
  emit(f, { type: 'msg', text: `봉화: ${u.nick}` });
  return true;
}

/** 그 직업이 지울 수 있는 디버프인지 */
export const dispellable = (f: Fight, type: string) => HEROES[f.hero].dispel.includes(type);

/** 해제 한 번 (직업 공통): 함정은 뒤로, 많이 겹친 것 먼저 */
export function doDispel(f: Fight, u: Unit): void {
  const ds = u.debuffs.filter(d => HEROES[f.hero].dispel.includes(d.type)).sort((a, b) => (a.trap ? 1 : 0) - (b.trap ? 1 : 0) || (b.stack || 0) - (a.stack || 0));
  const d = ds[0];
  if (!d) return;
  u.debuffs = u.debuffs.filter(x => x !== d);
  if (d.trap) f.stats.trapPops++; else f.stats.dispels++;
  emit(f, { type: 'sound', name: 'dispel' });
  emit(f, { type: 'dispel', id: u.id, trap: !!d.trap });
  onDebuffEnd(f, u, d, true);
}

const around = (f: Fight, u: Unit, r = 1) => { const c = cellOf(f, u); return living(f).filter(v => hexDist(cellOf(f, v), c) <= r); };

/** 드루이드 */
function druid(f: Fight, key: SkillKey, u: Unit): void {
  const sk = SKILLS[key];
  if (key === 'sprout') {
    putHot(u, 'sprout', { sec: 12, every: 3, total: sk.amt! });
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'growth') {
    heroHeal(f, u, sk.amt!);
    putHot(u, 'growth', { sec: 6, every: 2, total: 90 });
  } else if (key === 'bloom') {
    const h = u.hots.slice().sort((a, b) => b.rest - a.rest)[0];
    if (h) { u.hots = u.hots.filter(x => x !== h); heroHeal(f, u, h.rest * 1.5); }
    else if (u.hot > 0) { const rest = Math.ceil(u.hot / 3) * 80; u.hot = 0; heroHeal(f, u, rest * 1.5); }
    emit(f, { type: 'sound', name: 'bell' });
  } else if (key === 'wildflower') {
    const vs = around(f, u, areaRadius(f, 'wildflower')), m = 1 + f.fx.aoeHeal; // 20인은 2칸 (26 9-1)
    for (const v of vs) putHot(v, 'wildflower', { sec: 7, every: 2, amts: [70 * m, 45 * m, 30 * m, 15 * m] });
    aoeMana(f, vs.length);
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'natureCleanse') {
    doDispel(f, u);
  } else if (key === 'bark') {
    u.redu = BARK.sec; u.reduCut = BARK.cut;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'rebirth') {
    if (u.alive || !reviveUnit(f, u, REBIRTH.hp)) { emit(f, { type: 'msg', text: '환생 실패: 되살릴 빈 칸 없음' }); return; }
    f.rebirthUsed = true;
    emit(f, { type: 'msg', text: `환생: ${u.nick}` });
  }
}

/** 성기사 */
function paladin(f: Fight, key: SkillKey, u: Unit): void {
  const sk = SKILLS[key];
  if (key === 'holyLight' || key === 'holyStrike') {
    heroHeal(f, u, sk.amt!);
    f.power3 = Math.min(3, f.power3 + 1);
  } else if (key === 'oath') {
    const n = Math.max(1, f.power3);
    f.power3 = 0;
    putHot(u, 'oath', { sec: 4 * n, every: 2, total: sk.amt! * n });
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    if (n === 3 && heroPassive(f, '헌신')) f.mana = Math.min(100, f.mana + 2);
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'lightWave') {
    f.power3 = 0;
    const vs = around(f, u);
    for (const v of vs) heroHeal(f, v, sk.amt! * (1 + f.fx.aoeHeal));
    aoeMana(f, vs.length);
    if (heroPassive(f, '헌신')) f.mana = Math.min(100, f.mana + 2);
    emit(f, { type: 'sound', name: 'bell' });
  } else if (key === 'handCleanse') {
    doDispel(f, u);
  } else if (key === 'sacrifice') {
    u.sacr = 12;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'sanctuary') {
    const c = cellOf(f, u);
    f.sanctuary = { cells: new Set(f.cells.filter(x => hexDist(x, c) <= 1).map(x => x.i)), end: f.t + SANCTUARY.sec };
    emit(f, { type: 'sound', name: 'bell' });
    emit(f, { type: 'msg', text: `빛의 성역: ${SANCTUARY.sec}초` });
  } else if (key === 'handGuard') {
    u.immune = HAND_GUARD.sec;
    emit(f, { type: 'sound', name: 'bell' });
    emit(f, { type: 'msg', text: `보호의 손: ${u.nick}` });
  }
}

/** 사제 밖 직업의 스킬 효과 */
export function heroApply(f: Fight, key: SkillKey, u: Unit): void {
  if (f.hero === 'druid') druid(f, key, u);
  else if (f.hero === 'paladin') paladin(f, key, u);
}

/** 직업 고유 시스템의 한 틱 (성역 범위 회복·봉화 대기) */
export function heroTick(f: Fight, dt: number): void {
  if (f.hero !== 'paladin') return;
  if (f.beaconCd > 0) f.beaconCd -= dt;
  const s = f.sanctuary;
  if (!s) return;
  if (f.t >= s.end) { f.sanctuary = null; return; }
  for (const u of living(f)) {
    if (!s.cells.has(u.cell)) { if (u.reduCut === SANCTUARY.cut) u.redu = 0; continue; }
    u.redu = Math.max(u.redu, dt * 2); u.reduCut = SANCTUARY.cut;
    heal(f, u, SANCTUARY.hps * dt, false);
  }
}

/** 공대 쿨기 정신 집중 1초마다 (사제 찬가 120, 드루이드 숲 100 + 지속 힐 +2초) */
export function heroChannelTick(f: Fight): void {
  if (f.hero === 'druid') {
    for (const u of living(f)) {
      heal(f, u, 100, true);
      for (const h of u.hots) h.left += 2;
      if (u.hot > 0) u.hot += 2;
    }
  } else {
    for (const u of living(f)) heal(f, u, 120, true);
  }
}

/** 전투 시작 때 직업별 안내 (전투 화면 위쪽 문구) */
export const heroRing = (f: Fight): { label: string; value: string } => {
  if (f.hero === 'paladin') return { label: '신성한 힘', value: `${f.power3}/3` };
  if (f.hero === 'druid') return { label: '새싹', value: String(f.party.filter(u => u.alive && u.hots.some(h => h.key === 'sprout')).length) };
  return { label: '마나', value: String(Math.floor(f.mana)) };
};

export type { HeroKey };
