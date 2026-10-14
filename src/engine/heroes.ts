/**
 * 직업별 스킬 효과와 고유 시스템 (25 3장). 사제는 06.
 * healer.ts가 공통 흐름(시전·마나·GCD·예약)을 맡고, 여기서는 「맞았을 때 무슨 일이 일어나는가」만 다룬다.
 */
import { HEROES, type HeroKey } from '../data/heroes';
import { BARK, BEACON, HAND_GUARD, REBIRTH, SANCTUARY, WAVE } from '../data/heroConst';
import { SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { cellOf, emit, heal, living, onDebuffEnd } from './core';
import { noteUsed } from './healer';
import { reviveUnit } from './items';
import { areaRadius } from './talents';
import { aoeCount, aoeDone, guardSec, hc, powerSpent, raidSec, specDispel, sv, twin, under } from './specials';
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
  const h: Hot = { key, name: SKILLS[key].name, left: o.sec, tick: o.every, every: o.every, per, amts, i: 0, rest: sum };
  u.hots = u.hots.filter(x => x.key !== key);
  u.hots.push(h);
  return h;
}

/** 지속 힐 마지막 틱 회복량 (고요한 숲으로 늘어난 시간에 이 값으로 틱, units hotAmt) */
const hotTail = (h: Hot): number => (h.amts ? h.amts[h.amts.length - 1] : h.per);

/** 그 사람에게 걸린 지속 힐 개수 (사제 소생 포함) */
export const hotCount = (u: Unit) => u.hots.length + (u.hot > 0 ? 1 : 0);

/** 봉화 몫: 파티 5인까지 40%, 10인 레이드 30%, 20인 레이드 25% (73) + 큰 봉화 (42 성기 01) */
export const beaconShare = (f: Fight): number => (f.party.length >= 20 ? BEACON.raid20 : f.party.length >= 10 ? BEACON.raid10 : BEACON.share) + sv(f, 'bigBeacon');

/** 직접 힐 (직업 패시브·봉화까지). 성기사 봉화는 다른 사람에게 한 단일 힐의 몫 (beaconShare)을 봉화 대상에게. toBeacon = false면 봉화로 안 옮김 (빛의 파도, 73) */
export function heroHeal(f: Fight, u: Unit, amt: number, toBeacon = true): number {
  let m = 1;
  if (f.hero === 'druid' && heroPassive(f, '뿌리 깊음') && hotCount(u) >= 2) m = 1.1;
  if (f.hero === 'paladin' && heroPassive(f, '굳건한 손') && u.role === 'tank') m = 1.1;
  const done = heal(f, u, amt * m, true);
  if (f.hero === 'paladin' && f.beacon != null && toBeacon) {
    const share = beaconShare(f);
    const b = f.beacon !== u.id ? f.party.find(x => x.id === f.beacon) : undefined;
    if (b && b.alive) heal(f, b, amt * m * share, false);
    if (sv(f, 'secondBeacon')) { const b2 = secondBeacon(f); if (b2 && b2 !== u) heal(f, b2, amt * m * share * 0.5, false); } // 두 번째 봉화 (42 성기 02)
  }
  return done;
}

/** 두 번째 봉화 대상: 봉화가 아닌 다른 탱커, 없으면 나 (봉화가 나면 없음) */
function secondBeacon(f: Fight): Unit | undefined {
  return f.party.find(x => x.alive && x.role === 'tank' && x.id !== f.beacon) ?? (f.me.alive && f.me.id !== f.beacon ? f.me : undefined);
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
  const ds = u.debuffs.filter(d => HEROES[f.hero].dispel.includes(d.type) && !d.lock).sort((a, b) => (a.trap ? 1 : 0) - (b.trap ? 1 : 0) || (b.stack || 0) - (a.stack || 0));
  const d = ds[0];
  if (!d) return;
  u.debuffs = u.debuffs.filter(x => x !== d);
  if (d.trap) f.stats.trapPops++; else f.stats.dispels++;
  emit(f, { type: 'sound', name: 'dispel' });
  emit(f, { type: 'dispel', id: u.id, trap: !!d.trap });
  onDebuffEnd(f, u, d, true);
  if (f.sp) specDispel(f, u, d);
}

/** 나무껍질 피해 감소 (굵은 껍질 42 드루 05 더함). 지속 힐 배율이 나무껍질인지 알아볼 때도 같은 값 */
export const barkCut = (f: Fight): number => BARK.cut + sv(f, 'thickBark');
/** 성기사 신성한 힘 최대 (넘치는 신성한 힘 42 성기 05) */
export const powerMax = (f: Fight): number => 3 + sv(f, 'morePower');

const around = (f: Fight, u: Unit, r = 1) => { const c = cellOf(f, u); return living(f).filter(v => hexDist(cellOf(f, v), c) <= r); };

/** 빛의 파도가 들어갈 사람: 대상 둘레 r칸 안에서 체력 비율이 낮은 순서로 WAVE.max명 (73) */
export const waveTargets = (f: Fight, u: Unit, r: number): Unit[] => around(f, u, r).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, WAVE.max);

const hasSprout = (u: Unit) => u.hots.some(h => h.key === 'sprout');
/** 장비로 거는 새싹 (42 드루 19~23): 새싹이 없을 때만. half = 절반 시간 · 절반 회복량 (옮겨 가지 않음, 옮겨 가는 새싹과 같은 몫) */
function giveSprout(f: Fight, u: Unit | undefined, half: boolean): void {
  if (!u || !u.alive || hasSprout(u)) return;
  const amt = SKILLS.sprout.amt!;
  const h = putHot(u, 'sprout', half ? { sec: 6, every: 3, total: amt / 2 } : { sec: 12, every: 3, total: amt });
  if (half) h.hop = true;
}
/** 옆 칸에서 새싹이 없는 아군 중 체력 비율이 가장 낮은 1명 */
const sproutless = (f: Fight, u: Unit) => around(f, u).filter(v => v !== u && !hasSprout(v)).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
/** 디버프를 지웠는지 보며 해제 (잎새 정화 · 정화의 손길) */
function dispelled(f: Fight, u: Unit): boolean {
  const n = u.debuffs.length;
  doDispel(f, u);
  return u.debuffs.length < n;
}

/** 드루이드 */
function druid(f: Fight, key: SkillKey, u: Unit): void {
  const sk = SKILLS[key];
  if (key === 'sprout') {
    putHot(u, 'sprout', { sec: 12, every: 3, total: sk.amt! });
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    if (f.sp && sv(f, 'sproutWind') && f.rng() < sv(f, 'sproutWind')) giveSprout(f, sproutless(f, u), false); // 퍼지는 새싹 (42 드루 23)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'growth') {
    heroHeal(f, u, sk.amt!);
    putHot(u, 'growth', { sec: 6, every: 2, total: 90 });
  } else if (key === 'bloom') {
    const h = u.hots.slice().sort((a, b) => b.rest - a.rest)[0];
    if (h) { u.hots = u.hots.filter(x => x !== h); heroHeal(f, u, h.rest * 1.5); }
    else if (u.hot > 0) { const rest = Math.ceil(u.hot / 3) * 80; u.hot = 0; heroHeal(f, u, rest * 1.5); }
    if (f.sp && sv(f, 'pollen')) giveSprout(f, sproutless(f, u), true); // 꽃가루 (42 드루 19)
    emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'wildflower') {
    const vs = around(f, u, areaRadius(f, 'wildflower')); // 20인은 2칸 (26 9-1)
    if (f.sp) aoeCount(f, vs.length);
    for (const v of vs) putHot(v, 'wildflower', { sec: 7, every: 1.75, amts: [70, 45, 30, 15] }); // 7초 안에 4번 (2026-10-14 검토: 2초 간격이면 마지막 15가 7초에 잘려 145)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'natureCleanse') {
    if (dispelled(f, u) && f.sp && sv(f, 'leafCleanse')) giveSprout(f, u, true); // 잎새 정화 (42 드루 21)
  } else if (key === 'bark') {
    u.redu = guardSec(f, BARK.sec); u.reduCut = barkCut(f); // 수호의 깃 · 굵은 껍질 (42)
    if (f.sp) twin(f, u, v => { v.redu = guardSec(f, BARK.sec) / 2; v.reduCut = barkCut(f); }); // 쌍둥이 방패
    if (f.sp && sv(f, 'barkSprout')) giveSprout(f, u, false); // 껍질 아래 새순 (42 드루 20)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'rebirth') {
    if (u.alive || !reviveUnit(f, u, REBIRTH.hp + sv(f, 'quickRebirth'))) { emit(f, { type: 'msg', text: '환생 실패: 되살릴 빈 칸 없음' }); return; } // 빠른 환생 (42 드루 08)
    f.rebirthUsed = true;
    emit(f, { type: 'msg', text: `환생: ${u.nick}` });
  }
}

/** 성기사 */
function paladin(f: Fight, key: SkillKey, u: Unit): void {
  const sk = SKILLS[key];
  if (key === 'holyLight' || key === 'holyStrike') {
    heroHeal(f, u, sk.amt!);
    let gain = 1;
    if (f.sp) {
      if (key === 'holyLight' && sv(f, 'risingPower') && f.rng() < sv(f, 'risingPower')) gain++; // 차오르는 힘 (42 성기 19)
      if (key === 'holyStrike' && sv(f, 'strikeEcho') && hc.crit) gain++; // 일격의 메아리 (42 성기 23)
    }
    f.power3 = Math.min(powerMax(f), f.power3 + gain);
  } else if (key === 'oath') {
    const n = Math.max(1, f.power3);
    f.power3 = 0;
    putHot(u, 'oath', { sec: 4 * n, every: 2, total: sk.amt! * n });
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    if (n >= 3 && heroPassive(f, '헌신')) f.mana = Math.min(100, f.mana + 2);
    if (n >= 3 && f.sp) { f.mana = Math.min(100, f.mana + sv(f, 'oathBreath')); powerSpent(f, n); } // 서약의 숨 · 밝은 결의 (42 성기 20 · 24)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'lightWave') {
    if (f.sp) powerSpent(f, f.power3); // 밝은 결의 (42 성기 24)
    f.power3 = 0;
    const r = 1 + sv(f, 'wideWave'); // 퍼지는 파도 (42 성기 06)
    // 범위 안에서 체력 비율이 가장 낮은 WAVE.max명만, 봉화로는 안 옮김 (73). 이펙트도 그 사람들 칸에만 (스킬 대상 칸 기록은 healer applySkill이 건너뜀)
    const vs = waveTargets(f, u, r);
    if (f.sp) aoeCount(f, vs.length);
    for (const v of vs) { noteUsed(f, key, v.id); heroHeal(f, v, sk.amt!, false); }
    if (f.sp) aoeDone(f, u.cell, sk.amt!, r);
    if (heroPassive(f, '헌신')) f.mana = Math.min(100, f.mana + 2);
    emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'handCleanse') {
    if (dispelled(f, u) && f.sp && sv(f, 'cleansePower')) f.power3 = Math.min(powerMax(f), f.power3 + 1); // 정화의 손길 (42 성기 21)
  } else if (key === 'sacrifice') {
    u.sacr = guardSec(f, 12); // 수호의 깃 (42 보호 07)
    if (f.sp) twin(f, u, v => { v.sacr = Math.max(v.sacr, guardSec(f, 12) / 2); }); // 쌍둥이 방패
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'sanctuary') {
    const c = cellOf(f, u);
    const sec = raidSec(f, 'sanctuary', SANCTUARY.sec); // 길어진 노래 · 긴 성역 (42)
    f.sanctuary = { cells: new Set(f.cells.filter(x => hexDist(x, c) <= 1).map(x => x.i)), end: f.t + sec };
    emit(f, { type: 'sound', name: 'chime' });
    emit(f, { type: 'msg', text: `빛의 성역: ${sec}초` });
  } else if (key === 'handGuard') {
    u.immune = HAND_GUARD.sec;
    emit(f, { type: 'sound', name: 'chime' });
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
    if (f.sp) under('sanctuary', false, () => heal(f, u, SANCTUARY.hps * dt, false)); else heal(f, u, SANCTUARY.hps * dt, false);
  }
}

/** 공대 쿨기 정신 집중 1초마다 (사제 찬가 120, 드루이드 숲 100 + 지속 힐 +2초) */
export function heroChannelTick(f: Fight): void {
  if (f.hero === 'druid') {
    for (const u of living(f)) {
      heal(f, u, 100, true);
      // 남은 시간 +2초 = 그 지속 힐 마지막 틱 빠르기로 2초만큼 회복량도 더함 (2026-10-14 검토: 시간만 늘고 남은 회복량이 그대로라 새싹은 더 회복하지 않던 것)
      for (const h of u.hots) { h.rest += (hotTail(h) / h.every) * 2; h.left += 2; }
      if (u.hot > 0) u.hot += 2;
    }
  } else {
    for (const u of living(f)) heal(f, u, 120, true);
  }
}

/** 전투 시작 때 직업별 안내 (전투 화면 위쪽 문구) */
export const heroRing = (f: Fight): { label: string; value: string } => {
  if (f.hero === 'paladin') return { label: '신성한 힘', value: `${f.power3}/${powerMax(f)}` };
  if (f.hero === 'druid') return { label: '새싹', value: String(f.party.filter(u => u.alive && u.hots.some(h => h.key === 'sprout')).length) };
  return { label: '마나', value: String(Math.floor(f.mana)) };
};

export type { HeroKey };
