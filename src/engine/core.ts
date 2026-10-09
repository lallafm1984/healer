import { armorFactor, type DamageAim } from '../data/armor';
import { SPREAD } from '../data/bosses';
import { HEROES } from '../data/heroes';
import { BULWARK } from '../data/traits';
import { hexDist } from './board';
import { abHurt, abLethal, blocksDebuff, dmgMods, healMods } from './abilities';
import { affDebuffEnd, affHeal } from './affixes';
import type { Cell, Debuff, Fight, FightEvent, Mob, Unit } from './types';

/** 한 틱 = 0.05초 */
export const DT = 0.05;

/** 성기사 희생: 대상이 받는 피해 중 내가 대신 받는 비율 (25 3장) */
export const SACRIFICE_CUT = 0.3;

export const living = (f: Fight): Unit[] => f.party.filter(u => u.alive);
export const cellOf = (f: Fight, u: Unit): Cell => f.cells[u.cell];
/** 파티원 (없으면 헤매는 영혼 칸, P-SOUL) */
export const unitById = (f: Fight, id: number): Unit | undefined => f.party.find(x => x.id === id) ?? (f.souls.length ? f.souls.find(x => x.id === id) : undefined);

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

/**
 * 회복. direct = 직접 힐(숫자 표시, 관심·감사 성격 반응).
 * raw = 이미 배율이 붙은 값 (사제 흘러넘침): 장비·레벨·특성 배율과 치명타를 다시 안 붙임
 */
export function heal(f: Fight, u: Unit, amt: number, direct: boolean, raw = false): number {
  if (!u.alive || amt <= 0) return 0;
  let crit = false;
  if (!raw) {
    amt *= f.gear.heal * f.power;
    if (f.standin) amt *= f.standin.heal; // 특성 트리 없는 직업 임시 보정
    // 사제 특성 (06 6장): 슬픔의 힘 (파티원이 쓰러진 뒤 5초 +30%), 벼랑 끝 손길 (30% 이하 대상 직접 힐 +25%)
    if (f.tx.griefUntil > f.t) amt *= 1.3;
    if (direct && f.tx.on.brink && u.hp <= u.max * 0.3) amt *= 1.25;
    crit = f.rng() < f.gear.crit;
    if (crit) amt *= 1.5;
  }
  if (f.links.length && !sharing) { const o = shareWith(f, u); if (o) return shared(() => heal(f, u, amt / 2, direct, true) + heal(f, o, amt / 2, direct, true)); } // 생명 사슬 나눔형
  if (f.bless && f.t < f.bless.until) amt *= f.bless.heal; // 영혼 축복 (P-SOUL): 받는 치유 증가
  if (u.mods.length) amt *= healMods(f, u); // 광란 (받는 치유 +30%), 얼음 방패 (치유 없음)
  if (f.aff) amt *= affHeal(f); // 메마름 (받는 치유 -20%)
  if (u.debuffs.length) {
    const ch = u.debuffs.find(d => d.charm);
    if (ch) ch.left += ch.charm!.heal; // 매혹 (P-CHARM): 힐하면 지배가 길어짐
    const cut = u.debuffs.reduce((s, d) => s + (d.healCut ?? 0) * (d.stack ?? 1), 0); // 얼룩진 장갑·먼지 범벅 (35 4-3·4-5)
    if (cut) amt *= Math.max(0, 1 - cut);
    if (u.debuffs.some(d => d.invert)) { invertHeal(f, u, amt); return 0; } // 뒤집힌 축복 (P-INVERT)
  }
  if (f.watch && f.t >= f.watch.until) f.watch.fill += amt * f.watch.rate; // 주시 (P-AGGRO): 넘친 치유까지 게이지에
  const eff = Math.min(amt, u.max - u.hp);
  u.hp += eff;
  u.got += eff;
  f.stats.healed += eff;
  f.stats.overheal += amt - eff;
  if (amt - eff > 1e-9) { // 넘치는 빛 (P-OVER): 그릇에 모이고, 과부하 표식이면 이웃이 아픔
    if (f.vessel && f.t < f.vessel.until) f.vessel.fill += amt - eff;
    if (u.debuffs.length) overload(f, u, amt - eff);
  }
  if (direct) {
    emit(f, { type: 'heal', id: u.id, amt: Math.round(amt), eff: Math.round(eff), crit });
    u.lastHeal = f.t;
    if (u.sulking) u.sulking = false;
    if (u.p.thanks) { u.thanks = 3; if (f.rng() < 0.35) bark(f, u); }
  }
  return eff;
}

/** 생명 사슬 나눔형 (P-LINK): 나눠 받는 중에는 다시 나누지 않음 */
let sharing = false;
function shared<T>(fn: () => T): T {
  sharing = true;
  try { return fn(); } finally { sharing = false; }
}
function shareWith(f: Fight, u: Unit): Unit | null {
  for (const l of f.links) {
    if (l.kind !== 'share' || (l.a !== u.id && l.b !== u.id)) continue;
    const o = f.party.find(x => x.id === (l.a === u.id ? l.b : l.a));
    return o && o.alive ? o : null;
  }
  return null;
}

/** 넘치는 빛 과부하형 (P-OVER): 넘친 치유 × over만큼 이웃 칸 아군 피해 (방어력·보스 배율 무시) */
function overload(f: Fight, u: Unit, over: number): void {
  const d = u.debuffs.find(x => x.over);
  if (!d) return;
  const c = cellOf(f, u);
  for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) === 1) damage(f, v, (over * d.over!) / f.dmgMult, true, 'fixed');
}

/** 뒤집힌 축복 (P-INVERT, 35 4-3): 들어올 치유량만큼 피해. 보호막·피해 감소·보호의 손(물리 취급)은 통함 */
function invertHeal(f: Fight, u: Unit, amt: number): void {
  if (amt <= 0) return;
  f.stats.inverted = (f.stats.inverted ?? 0) + amt;
  emit(f, { type: 'hurt', id: u.id, amt: Math.round(amt) });
  damage(f, u, amt / f.dmgMult, false, 'fixed');
}

/** 호감도 (06 6장 은혜 갚기): 길드원은 함께 출전한 수, 공개모집은 이번 판에 내 힐을 받은 양 (인연 스카우트와 같은 기준). 길드원이 먼저 */
const affinity = (u: Unit): number => (u.gid != null ? 1e9 + u.runs : u.got);

/**
 * 피해. magic = 보스 광역·장판·지속 피해 (평타·버스터·적 근접은 물리, 17 수호기사).
 * aim = 수치를 누구 기준으로 적었나 (data/armor.ts). 직업군 방어력은 둘 다 줄이고, fixed는 무시 (34 9-3)
 */
export function damage(f: Fight, u: Unit, amt: number, magic = false, aim: DamageAim = 'party'): void {
  if (!u.alive || amt <= 0) return;
  if (f.links.length && !sharing) { const o = shareWith(f, u); if (o) { shared(() => { damage(f, u, amt / 2, magic, aim); damage(f, o, amt / 2, magic, aim); }); return; } } // 생명 사슬 나눔형
  amt *= f.dmgMult;
  if (f.armor) amt *= armorFactor(u.role, aim);
  if (u.me && f.tx.on.firmWill) amt *= 0.8; // 굳은 의지 (06 6장)
  if (u.me && f.standin) amt *= f.standin.guard; // 특성 트리 없는 직업 임시 보정
  if (u.shield > 0) amt *= 0.6;
  if (u.bulwark > 0) amt *= 1 - BULWARK.cut;
  if (u.redu > 0) amt *= 1 - u.reduCut;
  if (f.abOn) { amt = dmgMods(f, u, amt, magic); if (amt < 0) return; } // 파티원 능력 (17)
  if (u.immune > 0 && !magic) return; // 보호의 손: 물리 피해 무시 (25 성기사)
  if (u.sacr > 0 && f.me.alive && f.me !== u) { // 희생: 받는 피해의 30%를 내가 대신
    const part = amt * SACRIFICE_CUT;
    amt -= part;
    damage(f, f.me, part / f.dmgMult, magic, 'fixed');
  }
  if (u.cls) {
    if (magic && u.cls === 'paladin') amt *= 0.9;
    if (u.cls === 'swordsman') u.flow = 3;
  }
  // 은혜 갚기 (06 6장): 내가 죽을 피해를 호감도가 가장 높은 파티원 (체력 50% 이상)이 한 번 대신 맞아 줌
  if (u.me && f.tx.on.repay && !f.tx.repayUsed && u.guardian <= 0 && u.hp - amt <= 0) {
    const v = living(f).filter(x => !x.me && x.hp >= x.max * 0.5).sort((a, b) => affinity(b) - affinity(a) || b.hp / b.max - a.hp / a.max)[0];
    if (v) {
      f.tx.repayUsed = true;
      emit(f, { type: 'msg', text: `은혜 갚기: ${v.nick}이(가) 대신 맞음` });
      damage(f, v, amt / f.dmgMult, magic, 'fixed');
      return;
    }
  }
  if (u.ab) {
    if (u.hp - amt <= 0 && u.guardian <= 0 && abLethal(f, u)) return; // 얼음 방패
    abHurt(f, u); // 거합 반격
  }
  u.hp -= amt;
  if (amt > u.max * 0.15) u.flash = 0.35;
  if (u.hp <= 0) {
    if (u.guardian > 0) {
      u.guardian = 0;
      u.hp = u.max * 0.4;
      emit(f, { type: 'sound', name: 'chime' });
      emit(f, { type: 'msg', text: `수호 영혼이 ${u.nick}을(를) 살림` });
      return;
    }
    // 쓰러지면 칸을 비운다 → 다른 파티원이 그 칸으로 이동할 수 있음 (2026-10-07 Lim)
    if (u.moving) { const to = f.cells[u.moving.to]; if (to.unit === u) to.unit = null; }
    { const here = f.cells[u.cell]; if (here.unit === u) here.unit = null; }
    u.alive = false; u.hp = 0; u.debuffs = []; u.hot = 0; u.hots = []; u.echo = []; u.moving = null; u.react = null; u.shield = 0; u.redu = 0; u.sacr = 0; u.immune = 0; u.diedAt = f.t;
    if (u.mods.length) { u.mods = []; u.max = u.base; }
    if (u.max < u.base) u.max = u.base;
    f.stats.deaths++;
    if (!u.me && f.tx.on.grief) f.tx.griefUntil = f.t + 5; // 슬픔의 힘
    emit(f, { type: 'death', id: u.id });
    emit(f, { type: 'sound', name: 'death' });
  }
}

export function addDebuff(f: Fight, u: Unit, d: Omit<Debuff, 'id'>): Debuff {
  const o: Debuff = { id: f.nextId++, ...d };
  if (u.mods.length && blocksDebuff(f, u, o.type)) return o; // 주문 반사·그림자 망토: 안 걸림
  u.debuffs.push(o);
  if (HEROES[f.hero].dispel.includes(o.type) && !o.trap) f.stats.dispellable++;
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
      damage(f, v, SPREAD.dmg, true);
      if (v.alive) addDebuff(f, v, { ...SPREAD.debuff });
    }
  }
}

export function onDebuffEnd(f: Fight, u: Unit, d: Debuff, dispelled: boolean): void {
  if (u.soul) { u.soul.cleansed = dispelled; return; } // 헤매는 영혼: 해제로 바로 성공 (P-SOUL)
  if (f.aff) affDebuffEnd(f, u, d, dispelled); // 어픽스 불안정·메아리
  if (d.end) debuffEnd(f, u, d, dispelled);
}

/** 보스가 주는 피해 +boost (걸어오는 쫄 흡수 · 옮겨붙음 시간 끝). 겹치면 더함 (+10% · +20% …), 체력바에 「강해짐」 */
export function empowerBoss(f: Fight, boost: number, why: string): void {
  f.dmgMult *= (1 + f.empower + boost) / (1 + f.empower);
  f.empower += boost;
  emit(f, { type: 'sound', name: 'aoe' });
  emit(f, { type: 'msg', text: `${why}: 보스 피해 +${Math.round(f.empower * 100)}%` });
}

/** 디버프 끝 부품 (data/bosses.ts DebuffEnd) */
function debuffEnd(f: Fight, u: Unit, d: Debuff, dispelled: boolean): void {
  const e = d.end!;
  switch (e.p) {
    case 'restoreMax': setMax(u); return;
    case 'spread': spread(f, u); return;
    case 'colDmg': {
      // 유령 성가대 독창 (26 4-3): 안 지우고 끝나면 그 사람이 선 열 전체. 지우면 그냥 사라짐 (함정 아님)
      if (dispelled) return;
      const col = cellOf(f, u).col;
      for (const v of living(f)) if (cellOf(f, v).col === col) damage(f, v, e.dmg, true);
      emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 줄 전체 피해` });
      return;
    }
    case 'hit':
      if (dispelled) return;
      damage(f, u, e.dmg, true);
      emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 시간 끝` });
      return;
    case 'jump': {
      // 옮겨붙음 (P-JUMP): 지우면 이웃 칸 1명에게 더 세게, 혼자면 사라짐. 시간이 다 되면 보스가 강해짐
      if (!dispelled) { empowerBoss(f, e.boost, `${d.name} 시간 끝`); return; }
      const c = cellOf(f, u);
      const near = living(f).filter(v => v !== u && hexDist(cellOf(f, v), c) === 1);
      if (!near.length) { emit(f, { type: 'msg', text: `${d.name}: 옆에 아무도 없어 사라짐` }); return; }
      const v = near[Math.floor(f.rng() * near.length)];
      const { id: _id, ...rest } = d;
      addDebuff(f, v, { ...rest, left: e.sec, dot: (d.dot ?? 0) * e.mult });
      emit(f, { type: 'msg', text: `${d.name}이(가) ${v.nick}에게 옮겨붙음` });
      return;
    }
    case 'stackHit': {
      // 마력 역류 (P-RECOIL): 끝나도 지워도 그때까지 중첩만큼
      const n = d.stack ?? 0;
      if (n <= 0) return;
      damage(f, u, e.dmg * n, true);
      emit(f, { type: 'sound', name: 'burst' });
      emit(f, { type: 'msg', text: `${d.name} ${n}중첩 터짐` });
      return;
    }
  }
}

/**
 * 체력 선 디버프 (35 3-A): grow = cureAt 아래인 동안 중첩이 쌓임 (쇠약 P-WOUND),
 * cureAt = 그 체력 비율 이상이면 바로 사라짐 (쇠약 · 완치 표식 P-FULL). 사라질 때 end는 안 함
 */
export function hpLineTick(f: Fight, u: Unit, d: Debuff, dt: number): boolean {
  const above = d.cureAt != null && u.hp >= u.max * d.cureAt - 1e-6;
  if (above) {
    u.debuffs = u.debuffs.filter(x => x !== d);
    emit(f, { type: 'cure', id: u.id, name: d.name });
    return true;
  }
  if (d.grow) {
    d.growT = (d.growT ?? 0) + dt;
    if (d.growT >= d.grow.every - 1e-9) { d.growT -= d.grow.every; d.stack = Math.min(d.grow.max, (d.stack ?? 0) + 1); }
  }
  return false;
}

/** 최대 체력 = 기본 × (1 − 걸려 있는 디버프의 maxCut 합) (썩은 숨결·부패). 체력은 새 최대를 넘지 않게 */
export function setMax(u: Unit): void {
  u.max = u.base * (1 - u.debuffs.reduce((s, d) => s + (d.maxCut ?? 0), 0));
  u.hp = Math.min(u.hp, u.max);
}

/** 보스가 아닌 적(또는 보스 몸통)에 피해. 쓰러지면 시전 중이던 기술도 끊김. 몸통 전투면 적 체력 합을 다시 셈 (쫄은 빼고) */
export function damageMob(f: Fight, m: Mob, x: number): void {
  if (!m.alive || x <= 0) return;
  m.hp -= x;
  if (m.hp <= 1e-9) {
    m.hp = 0; m.alive = false;
    f.tels = f.tels.filter(t => t.skill.mob !== m.id);
    emit(f, { type: 'mobDown', id: m.id, name: m.name });
  }
  if (f.bodyHp) f.bossHp = f.mobs.reduce((s, q) => s + (q.add ? 0 : q.hp), 0);
}
