/**
 * 직업별 스킬 효과와 고유 시스템 (25 3장). 사제는 06.
 * healer.ts가 공통 흐름(시전·마나·GCD·예약)을 맡고, 여기서는 「맞았을 때 무슨 일이 일어나는가」만 다룬다.
 */
import { HEROES, type HeroKey } from '../data/heroes';
import { BARK, BEACON, HAND_GUARD, QUIETWOOD, REBIRTH, SANCTUARY, SHAMAN } from '../data/heroConst';
import { shamanApply, shamanCell, shamanLethal, shamanTaken, shamanTick, shamanTotemGone } from './shaman';
import { monkApply, monkLethal, monkTaken, monkTick } from './monk';
import { warderApply, warderShieldBroken, warderTaken, warderTick } from './warder';
import { astroApply, astroLethal, astroTaken, astroTick, astroTotemGone, readMult } from './astro';
import { SKILLS, type SkillKey } from '../data/skills';
import { TX } from '../data/talents';
import { hexDist } from './board';
import { cellOf, emit, heal, healTop, living, onDebuffEnd } from './core';
import { noteUsed } from './healer';
import { reviveUnit } from './items';
import { activeOn, adjLow, areaRadius, rescueLater, sanctuaryReach, waveMax, wildAt } from './talents';
import { aoeCount, aoeDone, guardSec, hc, powerSpent, raidSec, skillSpec, specDispel, sv, twin, under } from './specials';
import { hotMult as hotMultOf } from './units';
import type { Fight, Hot, Totem, Unit } from './types';

/** 그 직업 패시브를 배웠는지 (25 3장: 직업마다 Lv 4·10) */
export const heroPassive = (f: Fight, name: string): boolean => {
  const p = HEROES[f.hero].passives.find(x => x.name === name);
  return !!p && f.level >= p.lv;
};

/** 지속 힐 걸기 (같은 스킬은 덮어씀, keep이면 두고 하나 더). name = 표시 이름 (특성 지속 힐, 없으면 스킬 이름) */
export function putHot(u: Unit, key: SkillKey, o: { sec: number; every: number; total?: number; amts?: number[]; name?: string; keep?: boolean }): Hot {
  const amts = o.amts;
  const n = Math.round(o.sec / o.every);
  const per = amts ? 0 : (o.total || 0) / n;
  const sum = amts ? amts.reduce((a, b) => a + b, 0) : o.total || 0;
  const h: Hot = { key, name: o.name ?? SKILLS[key].name, left: o.sec, tick: o.every, every: o.every, per, amts, i: 0, rest: sum };
  if (!o.keep) u.hots = u.hots.filter(x => x.key !== key);
  u.hots.push(h);
  return h;
}

/** 드루이드 새싹 한 번: 12초 · 3초마다 · 모두 280. 긴 새싹 (+2초, 그만큼 더) · 서두른 새싹 (2초마다, 시간 2/3, 회복량 그대로) (77) */
export function sproutSpec(f: Fight): { sec: number; every: number; total: number } {
  const base = 12 + (f.tx.on.longSprout ? TX.longSprout : 0), every = f.tx.on.quickSprout ? TX.quickSprout : 3;
  return { sec: (base * every) / 3, every, total: (SKILLS.sprout.amt! * base) / 12 };
}
/** 새싹 걸기: 두 겹 새싹이면 2개까지, 겹쳐 거는 것은 60% (이미 2개면 덜 남은 쪽을 바꿈, 77) */
export function putSprout(f: Fight, u: Unit, o = sproutSpec(f)): Hot {
  if (f.tx.on.twinSprout) {
    const mine = u.hots.filter(h => h.key === 'sprout');
    if (mine.length >= 2) { const old = mine.sort((a, b) => a.rest - b.rest)[0]; u.hots = u.hots.filter(h => h !== old); }
    return putHot(u, 'sprout', { ...o, total: o.total * (mine.length ? TX.twinSprout : 1), keep: true });
  }
  return putHot(u, 'sprout', o);
}

/** 지속 힐 마지막 틱 회복량 (고요한 숲으로 늘어난 시간에 이 값으로 틱, units hotAmt) */
const hotTail = (h: Hot): number => (h.amts ? h.amts[h.amts.length - 1] : h.per);

/** 그 사람에게 걸린 지속 힐 개수 (사제 소생 포함) */
export const hotCount = (u: Unit) => u.hots.length + (u.hot > 0 ? 1 : 0);

/** 봉화 몫: 파티 5인까지 40%, 10인 레이드 30%, 20인 레이드 25% (73) + 큰 봉화 (42 성기 01) */
export const beaconShare = (f: Fight): number => (f.party.length >= 20 ? BEACON.raid20 : f.party.length >= 10 ? BEACON.raid10 : BEACON.share) + sv(f, 'bigBeacon');

/**
 * 직접 힐 (직업 패시브·봉화까지). 성기사 봉화는 다른 사람에게 한 단일 힐의 몫 (beaconShare)을 봉화 대상에게. toBeacon = false면 봉화로 안 옮김 (빛의 파도, 73).
 * 특성 (77): 탱커의 빛 (굳건한 손 25%), 번지는 봉화 · 봉화의 숨 · 모두의 기사 (봉화 몫이 가는 곳), 빛의 울림 (봉화 대상 직접 힐이 둘레로)
 */
export function heroHeal(f: Fight, u: Unit, amt: number, toBeacon = true): number {
  let m = 1;
  if (f.hero === 'druid' && heroPassive(f, '뿌리 깊음') && hotCount(u) >= 2) m = 1.1;
  if (f.hero === 'paladin' && heroPassive(f, '굳건한 손') && u.role === 'tank') m = 1 + (f.tx.on.tankLight ? TX.tankLight : 0.1);
  if (f.hero === 'shaman' && heroPassive(f, '깊은 물') && u.hp < u.max * SHAMAN.deep.hp) m = 1 + SHAMAN.deep.heal; // 깊은 물 (79 2-4)
  if (f.hero === 'astrologer') m = readMult(f, u); // 별 읽기 (79 4-4)
  const done = heal(f, u, amt * m, true);
  if (f.hero === 'paladin' && f.beacon != null && toBeacon) {
    const share = beaconShare(f);
    const b = f.party.find(x => x.id === f.beacon);
    let given = false;
    if (f.tx.on.allKnight) { // 모두의 기사: 봉화 대상과 그 옆 칸 중 가장 다친 n명에게 (직접 힐 대상은 빼고)
      if (b && b.alive && b !== u) for (const v of around(f, b).filter(v => v !== u).sort((x, y) => x.hp / x.max - y.hp / y.max).slice(0, TX.allKnight.n)) { heal(f, v, amt * m * share * TX.allKnight.share, false); given = true; }
    } else if (b && b.alive && b !== u) {
      let to = b;
      if (f.tx.on.beaconDrift && b.hp >= b.max * TX.beaconDrift) { const v = adjLow(f, b, 1)[0]; if (v && v !== u && v.hp < healTop(v)) to = v; } // 번지는 봉화
      heal(f, to, amt * m * share, false); given = true;
    }
    if (given && f.tx.on.beaconBreath) f.mana = Math.min(100, f.mana + TX.beaconBreath.mana); // 봉화의 숨
    if (sv(f, 'secondBeacon')) { const b2 = secondBeacon(f); if (b2 && b2 !== u) heal(f, b2, amt * m * share * 0.5, false); } // 두 번째 봉화 (42 성기 02)
  }
  if (f.tx.on.beaconRing && toBeacon && u.id === f.beacon) for (const v of around(f, u)) if (v !== u) heal(f, v, amt * m * TX.beaconRing, false); // 빛의 울림
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

/** 빛의 파도가 들어갈 사람: 대상 둘레 r칸 안에서 체력 비율이 낮은 순서로 WAVE.max명 (73, 밀려오는 파도면 5명 77) */
export const waveTargets = (f: Fight, u: Unit, r: number): Unit[] => around(f, u, r).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, waveMax(f));

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
  const sk = SKILLS[key], on = f.tx.on;
  if (key === 'sprout') {
    const o = sproutSpec(f);
    if (on.earlySprout && u.hp >= u.max * TX.earlySprout.hp) o.total *= 1 + TX.earlySprout.heal; // 이른 새싹 (77)
    const h = putSprout(f, u, o);
    if (f.tx.freeSprout > 0) f.tx.freeSprout--; // 생장의 숨 (77): 이 새싹은 마나 없이
    if (activeOn(f, 'forestMemory')) h.again = true; // 숲의 기억 (77)
    if (on.rescueSprout && u.hp <= u.max * TX.rescueSprout.hp) hotNow(f, u, h, TX.rescueSprout.mult); // 급한 새싹 (77)
    if (f.tx.moss) f.tx.moss.set(u.cell, f.t + TX.mossBed.sec); // 이끼 자리 (77): 새싹을 건 칸
    if (on.cleanFlower && f.t >= f.tx.cleanAt && u.debuffs.some(d => dispellable(f, d.type) && !d.lock && !d.trap) && dispelled(f, u)) f.tx.cleanAt = f.t + TX.cleanFlower.cd; // 맑은 새싹 (77)
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    if (f.sp && sv(f, 'sproutWind') && f.rng() < sv(f, 'sproutWind')) giveSprout(f, sproutless(f, u), false); // 퍼지는 새싹 (42 드루 23)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'growth') {
    const amt = sk.amt! * (on.sproutGrowth && hasSprout(u) ? 1 + TX.sproutGrowth : 1); // 단비 (77)
    heroHeal(f, u, amt);
    if (on.branchGrowth) { const v = adjLow(f, u, 1)[0]; if (v) heal(f, v, amt * TX.branchGrowth, true); } // 곁가지 생장 (77)
    putHot(u, 'growth', on.deepGrowth ? { sec: TX.deepGrowth.sec, every: 2, total: TX.deepGrowth.amt } : { sec: 6, every: 2, total: 90 }); // 깊어지는 생장 (77)
    if (on.growthBreath) f.tx.freeSprout = 1; // 생장의 숨 (77)
  } else if (key === 'bloom') {
    const h = u.hots.slice().sort((a, b) => b.rest - a.rest)[0];
    let amt = 0;
    if (h) { amt = h.rest * 1.5; heroHeal(f, u, amt); u.hots = u.hots.filter(x => x !== h); } // 지우기 전에 회복: 뿌리 깊음 (지속 힐 2개 이상)이 거두는 것도 셈
    else if (u.hot > 0) { const rest = Math.ceil(u.hot / 3) * 80; u.hot = 0; amt = rest * 1.5; heroHeal(f, u, amt); }
    if (amt && on.seedScatter) for (const v of adjLow(f, u, TX.seedScatter.n)) heal(f, v, amt * TX.seedScatter.share, true); // 흩날리는 꽃씨 (77)
    if (f.sp && sv(f, 'pollen')) giveSprout(f, sproutless(f, u), true); // 꽃가루 (42 드루 19)
    emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'wildflower') {
    const r = areaRadius(f, 'wildflower'); // 20인은 2칸 (26 9-1)
    if (f.sp) aoeCount(f, around(f, u, r).length);
    const vs = wildAt(f, u.cell, 1, r);
    if (on.rebloomField) f.tx.later.push({ at: f.t + 7, cell: u.cell, amt: TX.rebloomField, r, kind: 'wild' }); // 다시 피는 들꽃 (77)
    if (on.flowerTrail || on.wakeForest) for (const v of vs) for (const h of v.hots) if (h.key === 'sprout') {
      if (on.flowerTrail) { h.rest += (h.per / h.every) * TX.flowerTrail; h.left += TX.flowerTrail; } // 이어 피는 꽃 (77): 시간 + 그만큼 회복량
      if (on.wakeForest) heal(f, v, h.per * TX.wakeForest * hotMultOf(f, v, h), false); // 깨어나는 숲 (77): 한 틱 더
    }
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'natureCleanse') {
    const done = dispelled(f, u);
    if (done && f.sp && sv(f, 'leafCleanse')) giveSprout(f, u, true); // 잎새 정화 (42 드루 21)
    if (on.washRain) { // 씻어 내는 비 (77): 옆 칸 1명도, 지운 사람마다 회복
      if (done) heal(f, u, TX.washRain.amt, true);
      const c = cellOf(f, u), v = living(f).find(v => v !== u && hexDist(cellOf(f, v), c) === 1 && v.debuffs.some(d => dispellable(f, d.type) && !d.lock && !d.trap));
      if (v && dispelled(f, v)) heal(f, v, TX.washRain.amt, true);
    }
  } else if (key === 'bark') {
    u.redu = guardSec(f, BARK.sec); u.reduCut = barkCut(f); // 수호의 깃 · 굵은 껍질 (42)
    if (f.sp) twin(f, u, v => { v.redu = guardSec(f, BARK.sec) / 2; v.reduCut = barkCut(f); }); // 쌍둥이 방패
    if (f.sp && sv(f, 'barkSprout')) giveSprout(f, u, false); // 껍질 아래 새순 (42 드루 20)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'quietwood') {
    // 82: 즉시 · 파티 전원. 걸린 지속 힐은 늘리고 (늘어난 시간 = 마지막 틱 빠르기로 회복량도), 새싹이 없는 아군에게는 새싹 (깊은 숲 42 드루 13 = 심는 새싹 회복량 +)
    const sec = raidSec(f, 'quietwood', QUIETWOOD.ext), o = sproutSpec(f); // 길어진 노래 · 숲의 숨결 (42)
    o.total *= 1 + skillSpec(f, 'quietwood', 'heal');
    for (const v of living(f)) {
      for (const h of v.hots) {
        h.rest += (hotTail(h) / h.every) * sec; h.left += sec;
        if (QUIETWOOD.now) heal(f, v, hotTail(h) * QUIETWOOD.now * hotMultOf(f, v, h), false); // 바로 한 번 더 (깨어나는 숲처럼 남은 회복량은 그대로)
      }
      if (v.hot > 0) v.hot += sec;
      if (!hasSprout(v)) putSprout(f, v, { ...o });
      v.lastHeal = f.t; if (v.sulking) v.sulking = false;
    }
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'rebirth') {
    const hp = (f.tx.rebirths ? TX.secondSpring.hp : REBIRTH.hp) + sv(f, 'quickRebirth'); // 두 번째 봄 (77): 두 번째는 25%
    if (u.alive || !reviveUnit(f, u, hp)) { emit(f, { type: 'msg', text: '환생 실패: 되살릴 빈 칸 없음' }); return; } // 빠른 환생 (42 드루 08)
    f.tx.rebirths++;
    f.rebirthUsed = f.tx.rebirths >= (on.secondSpring ? 2 : 1);
    emit(f, { type: 'msg', text: `환생: ${u.nick}` });
  }
}

/** 성기사 */
function paladin(f: Fight, key: SkillKey, u: Unit): void {
  const sk = SKILLS[key], on = f.tx.on;
  if (key === 'holyLight' || key === 'holyStrike') {
    let amt = sk.amt!;
    if (key === 'holyStrike' && on.heavyStrike) amt *= 1 + Math.min(TX.heavyStrike.max, (1 - u.hp / u.max) * TX.heavyStrike.per); // 무거운 일격 (77)
    if (key === 'holyLight') f.tx.freeLight = false; // 모아 둔 빛 (77): 이번 손길이 마나 없이 나감
    heroHeal(f, u, amt);
    if (key === 'holyLight' && on.twinHands) { const v = adjLow(f, u, 1)[0]; if (v) heal(f, v, amt * TX.twinHands, true); } // 두 손의 빛 (77)
    let gain = activeOn(f, 'dawnVow') ? TX.dawnVow.gain : 1; // 새벽의 맹세 (77)
    if (f.sp) {
      if (key === 'holyLight' && sv(f, 'risingPower') && f.rng() < sv(f, 'risingPower')) gain++; // 차오르는 힘 (42 성기 19)
      if (key === 'holyStrike' && sv(f, 'strikeEcho') && hc.crit) gain++; // 일격의 메아리 (42 성기 23)
    }
    const was = f.power3;
    f.power3 = Math.min(powerMax(f), f.power3 + gain);
    if (on.freeLight && was < powerMax(f) && f.power3 >= powerMax(f)) f.tx.freeLight = true; // 모아 둔 빛 (77)
  } else if (key === 'oath') {
    const n = Math.max(1, f.power3);
    f.power3 = 0;
    let total = sk.amt! * n * holyBoost(f);
    if (on.martyr && f.tx.martyrUntil > f.t) total *= 1 + TX.martyr.oath; // 순교의 빛 (77)
    putHot(u, 'oath', { sec: 4 * n, every: 2, total });
    if (on.shareOath) { // 나눠 주는 서약 (77): 옆 칸에서 가장 낮은 1명에게 절반 (더 큰 서약이 걸려 있으면 그대로)
      const v = adjLow(f, u, 1)[0], o = v?.hots.find(h => h.key === 'oath');
      if (v && (!o || o.rest < total * TX.shareOath)) putHot(v, 'oath', { sec: 4 * n, every: 2, total: total * TX.shareOath });
    }
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    devotion(f, n);
    if (n >= 3 && f.sp) { f.mana = Math.min(100, f.mana + sv(f, 'oathBreath')); powerSpent(f, n); } // 서약의 숨 · 밝은 결의 (42 성기 20 · 24)
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'lightWave') {
    const n = f.power3, spend = on.endlessLight ? Math.min(n, TX.endlessLight) : n; // 끝없는 빛 (77): 2칸만
    if (f.sp) powerSpent(f, spend); // 밝은 결의 (42 성기 24)
    f.power3 = Math.min(powerMax(f), n - spend + (on.waveMarch ? 1 : 0)); // 빛의 행진 (77): 1칸 돌려받음
    const r = 1 + sv(f, 'wideWave'); // 퍼지는 파도 (42 성기 06)
    const amt = sk.amt! * holyBoost(f) * (on.fullWave ? 1 + TX.fullWave.heal : 1); // 밀려오는 파도 (77)
    // 범위 안에서 체력 비율이 가장 낮은 WAVE.max명만, 봉화로는 안 옮김 (73). 이펙트도 그 사람들 칸에만 (스킬 대상 칸 기록은 healer applySkill이 건너뜀)
    const vs = waveTargets(f, u, r);
    if (f.sp) aoeCount(f, vs.length);
    for (const v of vs) {
      noteUsed(f, key, v.id); heroHeal(f, v, amt, false);
      if (on.waveEcho) putHot(v, 'lightWave', { sec: TX.waveEcho.sec, every: 2, total: TX.waveEcho.amt, name: '파도의 여운' }); // 파도의 여운 (77)
    }
    if (on.waveCleanse) { const v = vs.find(v => v.debuffs.some(d => dispellable(f, d.type) && !d.lock && !d.trap)); if (v) doDispel(f, v); } // 빛의 길 (77)
    if (f.sp) aoeDone(f, u.cell, amt, r);
    devotion(f, spend);
    emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'handCleanse') {
    if (dispelled(f, u) && f.sp && sv(f, 'cleansePower')) f.power3 = Math.min(powerMax(f), f.power3 + 1); // 정화의 손길 (42 성기 21)
  } else if (key === 'sacrifice') {
    u.sacr = guardSec(f, 12); // 수호의 깃 (42 보호 07)
    if (f.sp) twin(f, u, v => { v.sacr = Math.max(v.sacr, guardSec(f, 12) / 2); }); // 쌍둥이 방패
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'sanctuary') {
    const c = cellOf(f, u), reach = sanctuaryReach(f); // 넓은 성역 (77): 2칸, 초당 회복 −25%
    const sec = raidSec(f, 'sanctuary', SANCTUARY.sec); // 길어진 노래 · 긴 성역 (42)
    f.sanctuary = { cells: new Set(f.cells.filter(x => hexDist(x, c) <= reach.r).map(x => x.i)), end: f.t + sec, hps: SANCTUARY.hps * reach.hps };
    emit(f, { type: 'sound', name: 'chime' });
    emit(f, { type: 'msg', text: `빛의 성역: ${sec}초` });
  } else if (key === 'handGuard') {
    u.immune = HAND_GUARD.sec;
    rescueLater(f, u); // 구원의 손 (77)
    emit(f, { type: 'sound', name: 'chime' });
    emit(f, { type: 'msg', text: `보호의 손: ${u.nick}` });
  }
}

/** 헌신 (Lv 10 패시브): 신성한 힘 3칸을 한 번에 쓰면 마나 2%. 헌신의 길 (77)이면 2칸부터 3% */
function devotion(f: Fight, n: number): void {
  const p = f.tx.on.devotionPath;
  if (!p && !heroPassive(f, '헌신')) return; // 헌신의 길 (Lv 5 단)은 패시브 헌신 (Lv 10) 전에도 (QA 2026-10-15)
  if (n >= (p ? TX.devotionPath.min : 3)) f.mana = Math.min(100, f.mana + (p ? TX.devotionPath.mana : 2));
}
/** 빛의 서약 · 빛의 파도 회복량 (77): 새벽의 맹세 · 가득 찬 빛가 켜져 있는 동안 */
const holyBoost = (f: Fight): number => (activeOn(f, 'dawnVow') ? 1 + TX.dawnVow.heal : 1) * (activeOn(f, 'resolveFill') ? 1 + TX.resolveFill.heal : 1);
/** 지속 힐 한 틱을 지금 바로 (급한 새싹 77): mult배로, 다음 틱은 간격만큼 뒤 */
function hotNow(f: Fight, u: Unit, h: Hot, mult: number): void {
  const amt = Math.min(h.rest, h.per);
  h.rest -= amt; h.i++; h.tick = h.every;
  heal(f, u, amt * mult * hotMultOf(f, u, h), false);
}

/** 사제 밖 직업의 스킬 효과 */
export function heroApply(f: Fight, key: SkillKey, u: Unit): void {
  if (f.hero === 'druid') druid(f, key, u);
  else if (f.hero === 'paladin') paladin(f, key, u);
  else if (f.hero === 'shaman') shamanApply(f, key, u);
  else if (f.hero === 'monk') monkApply(f, key, u);
  else if (f.hero === 'astrologer') astroApply(f, key, u);
  else if (f.hero === 'warder') warderApply(f, key, u);
}

// ---------- 79 직업 4종 공통 자리 (직업 PR마다 채움) ----------
/** 칸에 쓰는 스킬 (주술사 샘 토템): 마나 · 재사용은 healer exec가 씀 */
export function heroCell(f: Fight, key: SkillKey, cell: number): void {
  if (f.hero === 'shaman') shamanCell(f, key, cell);
}
/** 판 위 물건이 사라짐 (broken = 깨짐, 아니면 시간이 다 됨 · 새로 세워 밀려남): 주술사 토템의 마지막 물 · 나를 지키는 샘 (79 2장) */
export function totemGone(f: Fight, t: Totem, broken: boolean): void {
  if (f.hero === 'shaman') shamanTotemGone(f, t, broken);
  else if (f.hero === 'astrologer') astroTotemGone(f, t, broken);
}
/** 79 직업의 받는 피해 배율 (core damage, 직업 생존기 · 토템 · 특성). 사제 · 드루이드 · 성기사는 1 */
export function heroTaken(f: Fight, u: Unit, _magic: boolean): number {
  if (f.hero === 'shaman') return shamanTaken(f, u);
  if (f.hero === 'monk') return monkTaken(f, u);
  if (f.hero === 'astrologer') return astroTaken(f, u);
  if (f.hero === 'warder') return warderTaken(f, u);
  return 1;
}
/** 79 직업이 죽을 피해를 막음 (나를 지키는 샘 …). 막았으면 true */
export function heroLethal(f: Fight, u: Unit, amt: number): boolean {
  if (f.hero === 'shaman') return shamanLethal(f, u);
  if (f.hero === 'monk') return monkLethal(f, u);
  if (f.hero === 'astrologer') return astroLethal(f, u, amt);
  return false;
}
/** 79 직업 4종인지 (core damage 훅을 탈지) */
export const NEW_HERO = (f: Fight): boolean => f.hero !== 'priest' && f.hero !== 'druid' && f.hero !== 'paladin';
/** 힐러가 건 흡수 보호막 (src HEALER_SHIELD)이 피해로 다 깨짐: 결계사 깨진 막의 빛 (79 5-4) */
export function shieldBroken(f: Fight, u: Unit): void {
  if (f.hero === 'warder') warderShieldBroken(f, u);
}

/** 직업 고유 시스템의 한 틱 (성역 범위 회복·봉화 대기, 79 직업은 그 직업 파일) */
export function heroTick(f: Fight, dt: number): void {
  if (f.hero === 'shaman') { shamanTick(f, dt); return; }
  if (f.hero === 'monk') { monkTick(f, dt); return; }
  if (f.hero === 'astrologer') { astroTick(f, dt); return; }
  if (f.hero === 'warder') { warderTick(f, dt); return; }
  if (f.hero !== 'paladin') return;
  if (f.beaconCd > 0) f.beaconCd -= dt;
  const s = f.sanctuary;
  if (!s) return;
  if (f.t >= s.end) { f.sanctuary = null; return; }
  for (const u of living(f)) {
    if (!s.cells.has(u.cell)) { if (u.reduCut === SANCTUARY.cut) u.redu = 0; continue; }
    u.redu = Math.max(u.redu, dt * 2); u.reduCut = SANCTUARY.cut;
    const hps = s.hps ?? SANCTUARY.hps; // 넓은 성역 (77)
    if (f.sp) under('sanctuary', false, () => heal(f, u, hps * dt, false)); else heal(f, u, hps * dt, false);
  }
}


/** 전투 시작 때 직업별 안내 (전투 화면 위쪽 문구) */
export const heroRing = (f: Fight): { label: string; value: string } => {
  if (f.hero === 'paladin') return { label: '신성한 힘', value: `${f.power3}/${powerMax(f)}` };
  if (f.hero === 'druid') return { label: '새싹', value: String(f.party.filter(u => u.alive && u.hots.some(h => h.key === 'sprout')).length) };
  return { label: '마나', value: String(Math.floor(f.mana)) };
};

export type { HeroKey };
