/**
 * 점성술사 (79 4장, 83 별 조각 시전): 별빛 치유 · 반짝임이 별 조각을 모으고, 별자리 스킬 (별비 · 북극성 · 별의 기억)은 시전이 끝날 때
 * 조각을 모두 써서 별 1 + 조각개로 터진다 (예전 누르고 떼는 모으기는 83에서 없앰). 조각을 다 채워 쓰면 가득 찬 별자리. 별자리 표식 (다음 직접 힐 +), 별의 잠, 별의 기억 (최근 받은 피해).
 * 특성 (79 4-7)과 직업 전용 특수능력 (79 4-8)의 엔진 훅도 여기서. heroes.ts가 직업마다 나눠 부르고, 초신성은 판 위 물건 (totems.ts)
 */
import { HEROES } from '../data/heroes';
import { ASTRO } from '../data/heroConst';
import { SKILLS, type SkillKey } from '../data/skills';
import { TX } from '../data/talents';
import { adjHurt, near } from './allies';
import { emit, heal, living, msg, recentDmg } from './core';
import { noteUsed } from './healer';
import { doDispel, heroHeal, heroPassive, putHot } from './heroes';
import { activeOn } from './talents';
import { placeTotem } from './totems';
import { aoeCount, aoeDone, guardSec, sv, under } from './specials';
import type { Fight, Hot, Totem, Unit } from './types';

/** 점성술사 전투 상태 (이번 별자리에 쓴 조각 · 별의 길 · 두 번째 별비 · 가득 찬 별자리 뒤 가속 · 특성 재발동) */
export interface AstroState {
  used: number;
  path: boolean;
  later: { at: number; cell: number; stars: number }[];
  hasteUntil: number;
  unfadingUsed: boolean;
  prophecyCd: number;
  foreseenCd: number;
  fallingCd: number;
  telSeen: number;
}
export const newAstro = (): AstroState => ({ used: 0, path: false, later: [], hasteUntil: -1, unfadingUsed: false, prophecyCd: 0, foreseenCd: 0, fallingCd: 0, telSeen: 0 });

/** 처음 쓸 때 만듦: 품고 온 조각 (점성 24)은 그때 */
const st = (f: Fight): AstroState => {
  if (f.astro) return f.astro;
  f.astro = newAstro();
  if (f.sp && sv(f, 'shardStart')) f.shards = Math.min(shardMax(f), sv(f, 'shardStart'));
  return f.astro;
};

/** 별의 잠에 들어 있는지 (피해 · 회복 · 딜 없음) */
export const asleep = (f: Fight, u: Unit): boolean => u.sleep != null && u.sleep > f.t;

// ---------- 별 조각 · 별자리 (83) ----------
/** 별 조각 최대 (다섯째 별이면 4) */
export const shardMax = (f: Fight): number => (f.tx.on.fifthStar ? TX.fifthStar.max - 1 : ASTRO.shard.max);
/** 가장 큰 별자리 = 1 + 조각 최대 (4, 다섯째 별 5) */
export const starMax = (f: Fight): number => 1 + shardMax(f);
export function gainShard(f: Fight, n: number): void {
  if (f.level < HEROES.astrologer.system.lv) return; // 고유 시스템 별 조각은 Lv 6부터 (다른 직업 시스템과 같게, QA 2026-10-15)
  f.shards = Math.min(shardMax(f), f.shards + n);
}
/** 별자리 스킬: 시전이 끝날 때 조각을 모두 씀 (빠른 잇기 · 내리는 밤 · 빠른 별자리 점성 06이 시전을 줄임) */
export const CONSTELLATION = new Set<SkillKey>(['starfall', 'polaris', 'starMemory']);
/** 지금 별자리를 터뜨리면 별 몇 개인지 (조각은 쓰지 않음, 화면 · 자동 힐러) */
export const starsNow = (f: Fight): number => (f.astro?.path ? starMax(f) : Math.min(starMax(f), 1 + f.shards));
/**
 * 별자리를 터뜨림 (별자리 스킬 효과를 낼 때): 조각을 모두 써서 별 = 1 + 조각, 별의 길이면 가득. 가득 찬 별자리 = 별 최대.
 * 쓴 조각 수를 기억 (밝은 조각 점성 01) · 조각의 마나 (점성 17)
 */
export function constellation(f: Fight): { stars: number; full: boolean } {
  const s = st(f), used = f.shards, stars = starsNow(f);
  f.shards = 0;
  s.used = used;
  s.path = false;
  if (used && f.sp && sv(f, 'shardMana')) f.mana = Math.min(100, f.mana + used * sv(f, 'shardMana'));
  return { stars, full: stars >= starMax(f) };
}

// ---------- 표식 ----------
/** 별자리 표식 걸기 (8초 · 2초마다 · 모두 120, 오래 남는 표식 +4초 그만큼): 다음 직접 힐 보너스 한 번 */
export function putMark(f: Fight, u: Unit): Hot {
  const m = ASTRO.mark, sec = m.sec + (f.sp ? sv(f, 'markSec') : 0);
  const h = putHot(u, 'starMark', { sec, every: m.tick, total: (SKILLS.starMark.amt! * sec) / m.sec });
  h.bonus = true;
  return h;
}
/** 표식 보너스 배율 (새긴 표식 80%). 쓰면 보너스만 사라지고 지속 힐은 남음. 표식의 숨 · 옮겨 가는 표식 */
function markBonus(f: Fight, u: Unit): number {
  const h = u.hots.find(x => x.key === 'starMark' && x.bonus);
  if (!h) return 1;
  h.bonus = false;
  if (f.tx.on.markBreath) f.mana = Math.min(100, f.mana + TX.markBreath.mana); // 표식의 숨
  if (f.sp && sv(f, 'markEcho')) { // 옮겨 가는 표식 (점성 19): 붙어 있는 다친 아군 1명에게
    const v = adjHurt(f, u, 3).find(x => !x.hots.some(y => y.key === 'starMark'));
    if (v) { u.hots = u.hots.filter(x => x !== h); v.hots.push({ ...h, bonus: true }); }
  }
  return 1 + (f.tx.on.etchedMark ? TX.etchedMark : ASTRO.mark.next);
}

/** 별 읽기 (Lv 4 패시브) · 더 읽는 별 (점성 18): 보스 예고가 찍힌 아군 (칸에 예고 · 표적 표시) */
export function readMult(f: Fight, u: Unit): number {
  if (!f.tels.length) return 1;
  if (!f.tels.some(t => t.cells.has(u.cell) || t.units.includes(u.id))) return 1;
  return 1 + (heroPassive(f, '별 읽기') ? ASTRO.read : 0) + (f.sp ? sv(f, 'readMore') : 0);
}
/** 점성술사 직접 힐: 표식 보너스 (한 번) · 별 읽기 */
function direct(f: Fight, u: Unit, amt: number): number {
  return heroHeal(f, u, amt * markBonus(f, u));
}

// ---------- 스킬 ----------
/** 별비 한 번: 별 수마다 회복 · 범위 (맑은 밤 · 넓은 하늘 · 다섯째 별 · 모이는 빛), 위력 배율 */
export function fallSpec(f: Fight, stars: number): { amt: number; r: number } {
  const on = f.tx.on;
  if (stars >= 5) return { amt: TX.fifthStar.fall, r: 2 };
  const i = Math.max(1, stars) - 1;
  let amt: number = ASTRO.fall.amt[i], r = ASTRO.fall.range[i];
  if ((stars === 2 || stars === 3) && on.clearNight) { r = TX.clearNight.range; amt *= 1 + TX.clearNight.heal; }
  if (stars === 4 && on.wideSky) { r = TX.wideSky.range; amt *= 1 + TX.wideSky.heal; }
  return { amt, r };
}
function starfall(f: Fight, u: Unit, o: { stars: number; full: boolean }): void {
  const s = st(f), { amt, r } = fallSpec(f, o.stars), cell = u.cell;
  const m = (o.full ? 1 + ASTRO.star.fullHeal : 1) * (1 + s.used * (f.sp ? sv(f, 'brightShard') : 0)) * (f.enc.big ? ASTRO.big.fall : 1); // 밝은 조각 (점성 01) · 20인 보정
  const center = u;
  const vs = r === 0 ? [u] : near(f, cell, r);
  if (f.sp) aoeCount(f, vs.length);
  for (const v of vs) {
    if (v !== center) noteUsed(f, 'starfall', v.id);
    direct(f, v, amt * m * (f.tx.on.gatherLight && o.stars === 3 && v === center ? TX.gatherLight : 1)); // 모이는 빛
  }
  if (vs.length >= 5 && f.sp && sv(f, 'wideFall')) f.mana = Math.min(100, f.mana + sv(f, 'wideFall')); // 쏟아지는 별 (점성 05)
  if (f.sp) aoeDone(f, cell, amt, r);
  if (o.full && f.tx.on.secondStarfall) s.later.push({ at: f.t + TX.secondStarfall.delay, cell, stars: o.stars }); // 두 번째 별비
  emit(f, { type: 'sound', name: 'chime' });
}
function polaris(f: Fight, u: Unit, o: { stars: number; full: boolean }): void {
  const on = f.tx.on, s = st(f);
  let amt = o.stars >= 5 ? TX.fifthStar.polaris : ASTRO.polaris[Math.max(1, o.stars) - 1];
  if (o.full) amt *= 1 + ASTRO.star.fullHeal;
  amt *= 1 + s.used * (f.sp ? sv(f, 'brightShard') : 0); // 밝은 조각 (점성 01)
  if (on.brightPolaris && u.hp < u.max * TX.brightPolaris.hp) amt *= 1 + TX.brightPolaris.heal; // 빛나는 북극성
  if (on.onePoint && u.role === 'tank') amt *= 1 + TX.onePoint; // 한 점
  direct(f, u, amt);
  if (f.sp && sv(f, 'twinPolaris')) { const v = adjHurt(f, u, 1)[0]; if (v) heal(f, v, amt * sv(f, 'twinPolaris'), true); } // 쌍둥이 북극성 (점성 02)
  if (o.full && on.risingPolaris) f.cd.polaris = Math.max(0, (f.cd.polaris ?? 0) - TX.risingPolaris); // 떠오르는 북극성
  emit(f, { type: 'sound', name: 'chime' });
}
/** 가득 찬 별자리 (83: 조각을 다 채워 터뜨림, 예전 완벽 타이밍): 별의 순환 (Lv 10) · 별의 길 · 가득 찬 별의 서두름 (점성 23) */
function fullDone(f: Fight): void {
  const s = st(f);
  if (heroPassive(f, '별의 순환')) f.mana = Math.min(100, f.mana + ASTRO.cycle);
  if (f.tx.on.starPath) s.path = true;
  if (f.sp && sv(f, 'perfectHaste')) s.hasteUntil = f.t + 4;
  msg(f, '가득 찬 별자리');
}

/** 별의 기억 (82 · 83 별자리): 별 1개마다 2초 (긴 기억 3초) 더 먼 피해의 50% (탱커의 기억 70%, 나누는 기억 +), 적어도 100 (힐 배율을 거친) */
export function memoryAmt(f: Fight, u: Unit, stars = 2): number {
  const sec = Math.max(1, stars) * (f.tx.on.longMemory ? TX.longMemory : ASTRO.memory.step);
  const share = (f.tx.on.tankMemory && u.role === 'tank' ? TX.tankMemory : ASTRO.memory.share) + (f.sp ? sv(f, 'memoryShare') : 0);
  return Math.max(SKILLS.starMemory.amt!, (recentDmg(f, u, sec) * share) / (f.gear.heal * f.power));
}

/** 점성술사 스킬 효과 */
export function astroApply(f: Fight, key: SkillKey, u: Unit): void {
  const on = f.tx.on;
  if (key === 'starHeal') {
    direct(f, u, SKILLS.starHeal.amt!);
    gainShard(f, activeOn(f, 'milkyWay') ? TX.milkyWay.shards : 1); // 은하수 (★): 2개씩
  } else if (key === 'twinkle') {
    const amt = SKILLS.twinkle.amt!;
    direct(f, u, amt);
    gainShard(f, f.tx.on.threeShards ? TX.threeShards : 1); // 넉넉한 조각 (83)
    if (on.scatterTwinkle) { const v = adjHurt(f, u, 1)[0]; if (v) heal(f, v, amt * TX.scatterTwinkle, true); } // 흩어지는 반짝임
  } else if (key === 'starMark') {
    putMark(f, u);
    if (on.linkedMark) for (const v of adjHurt(f, u, 6).filter(x => !x.hots.some(h => h.key === 'starMark')).slice(0, TX.linkedMark.n)) putMark(f, v); // 이어진 표식
    u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'clearStar') {
    const n = u.debuffs.length;
    doDispel(f, u);
    if (u.debuffs.length < n && f.sp && sv(f, 'clearMark')) putMark(f, u); // 맑은 표식 (점성 20)
  } else if (key === 'starfall' || key === 'polaris') {
    const o = constellation(f);
    if (key === 'starfall') starfall(f, u, o); else polaris(f, u, o);
    if (o.full) fullDone(f);
    st(f).used = 0;
  } else if (key === 'starSleep') {
    u.sleep = f.t + guardSec(f, ASTRO.sleep.sec + (f.sp ? sv(f, 'deepSleep') : 0)); // 깊은 잠 (점성 04) · 수호의 깃 (42 보호 07)
    emit(f, { type: 'sound', name: 'renew' });
    msg(f, '별의 잠: {n}', { n: u.nick });
  } else if (key === 'starMemory') {
    const o = constellation(f); // 83: 시전이 끝날 때 조각을 모두 씀 (별 1개마다 2초)
    const m = (o.full ? 1 + ASTRO.star.fullHeal : 1) * (1 + st(f).used * (f.sp ? sv(f, 'brightShard') : 0)); // 밝은 조각 (점성 01)
    for (const v of living(f)) heal(f, v, memoryAmt(f, v, o.stars) * m * readMult(f, v), true);
    if (o.full) fullDone(f);
    st(f).used = 0;
    emit(f, { type: 'sound', name: 'hymn' });
  }
}

// ---------- 마나 · 피해 ----------
/** 점성술사 특성 마나 배율 (79 4-7): 작은 반짝임 · 아끼는 별비 · 아끼는 기억 */
export function astroCost(f: Fight, key: SkillKey): number {
  const on = f.tx.on;
  if (key === 'twinkle' && on.smallTwinkle) return 1 - TX.smallTwinkle;
  if (key === 'starfall' && on.thriftFall) return TX.thriftFall.cost / SKILLS.starfall.cost;
  if (key === 'starMemory' && on.thriftMemory) return TX.thriftMemory.cost / SKILLS.starMemory.cost;
  return 1;
}
/** 받는 피해 배율: 차분한 손 (83: 시전하는 동안 나) · 별 무리 (조각마다 나) */
export function astroTaken(f: Fight, u: Unit): number {
  if (!u.me) return 1;
  let m = 1;
  if (f.tx.on.calmHands && f.cast) m *= 1 - TX.calmHands;
  if (f.tx.on.starCrowd && f.shards) m *= 1 - TX.starCrowd * f.shards;
  return m;
}
/** 내가 죽을 피해 (지지 않는 별): 그 피해를 없던 것으로 하고 별의 잠 4초 (행동은 됨). 전투마다 1회 */
export function astroLethal(f: Fight, u: Unit, amt: number): boolean {
  if (!u.me || !f.tx.on.unfading) return false;
  const s = st(f);
  if (s.unfadingUsed) return false;
  s.unfadingUsed = true;
  u.hp = Math.max(1, u.hp + amt);
  u.sleep = f.t + TX.unfading.sec;
  msg(f, '지지 않는 별: 별의 잠');
  return true;
}

// ---------- 한 틱 ----------
/** 점성술사 한 틱: 두 번째 별비, 특성 (예언 · 내다본 손 · 떨어지는 별) */
export function astroTick(f: Fight, dt: number): void {
  const s = st(f), on = f.tx.on;
  if (s.later.length) {
    const due = s.later.filter(x => x.at <= f.t + 1e-9);
    if (due.length) {
      s.later = s.later.filter(x => x.at > f.t + 1e-9);
      for (const x of due) { // 두 번째 별비 (특성): 같은 자리 50% (표식 · 완벽 없이)
        const { amt, r } = fallSpec(f, x.stars);
        const vs = r === 0 ? living(f).filter(v => v.cell === x.cell) : near(f, x.cell, r);
        under('starfall', false, () => { for (const v of vs) { heal(f, v, amt * TX.secondStarfall.share, true); noteUsed(f, 'starfall', v.id); } });
      }
    }
  }
  if (s.prophecyCd > 0) s.prophecyCd -= dt;
  if (s.foreseenCd > 0) s.foreseenCd -= dt;
  if (s.fallingCd > 0) s.fallingCd -= dt;
  if ((on.prophecy || on.foreseen) && f.tels.length) {
    for (const t of f.tels) {
      if (t.id <= s.telSeen) continue;
      s.telSeen = t.id;
      if (on.foreseen && t.kind === 'aoe' && s.foreseenCd <= 0) { s.foreseenCd = TX.foreseen.cd; gainShard(f, TX.foreseen.n); } // 내다본 손
      if (on.prophecy && t.kind === 'buster' && s.prophecyCd <= 0) { // 예언: 그 탱커에게 표식
        const tk = f.party.find(v => v.id === t.units[0]);
        if (tk && tk.alive) { s.prophecyCd = TX.prophecy.cd; putMark(f, tk); }
      }
    }
  }
  if (on.fallingStar && s.fallingCd <= 0 && (f.cd.twinkle ?? 0) > 0 && living(f).some(v => v.hp < v.max * TX.fallingStar.hp)) { // 떨어지는 별
    s.fallingCd = TX.fallingStar.cd; f.cd.twinkle = 0;
  }
}

/** 초신성 (특성 ◎): 빈 칸에 별 (깨지지 않음), 3초 뒤 터짐 */
export function supernova(f: Fight, cell: number): void {
  placeTotem(f, 'nova', cell, TX.supernova.delay, { firm: true });
}
/** 판 위 물건이 사라짐: 초신성이 시간이 다 되면 2칸 거리 안 아군 400 */
export function astroTotemGone(f: Fight, t: Totem, broken: boolean): void {
  if (t.kind !== 'nova' || broken || f.t + 1e-9 < t.until) return;
  under(null, false, () => { for (const v of near(f, t.cell, TX.supernova.range)) { heal(f, v, TX.supernova.amt * readMult(f, v), true); noteUsed(f, 'starfall', v.id); } });
  emit(f, { type: 'sound', name: 'chime' });
}

/** 별빛 치유 즉시 (은하수 ★) */
export const instantStar = (f: Fight, key: SkillKey): boolean => key === 'starHeal' && activeOn(f, 'milkyWay');
/** 가득 찬 별의 서두름 (점성 23): 가득 찬 별자리 뒤 4초 가속 */
export const astroHaste = (f: Fight): number => (f.astro && f.astro.hasteUntil > f.t ? sv(f, 'perfectHaste') : 0);
