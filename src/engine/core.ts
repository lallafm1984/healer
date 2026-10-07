import { HEROES } from '../data/heroes';
import { BULWARK } from '../data/traits';
import { hexDist } from './board';
import { abHurt, abLethal, blocksDebuff, dmgMods, healMods } from './abilities';
import type { Cell, Debuff, Fight, FightEvent, Mob, Unit } from './types';

/** 한 틱 = 0.05초 */
export const DT = 0.05;

/** 성기사 희생: 대상이 받는 피해 중 내가 대신 받는 비율 (25 3장) */
export const SACRIFICE_CUT = 0.3;

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

/** 세트 「대성당의 빛」 4세트: 범위 힐이 6명 이상을 치유하면 마나 */
export function aoeMana(f: Fight, n: number): void {
  if (n >= 6 && f.fx.aoeMana) f.mana = Math.min(100, f.mana + f.fx.aoeMana);
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
    // 사제 특성 (06 6장): 슬픔의 힘 (파티원이 쓰러진 뒤 5초 +30%), 벼랑 끝 손길 (30% 이하 대상 직접 힐 +25%)
    if (f.tx.griefUntil > f.t) amt *= 1.3;
    if (direct && f.tx.on.brink && u.hp <= u.max * 0.3) amt *= 1.25;
    crit = f.rng() < f.gear.crit;
    if (crit) amt *= 1.5;
  }
  if (u.mods.length) amt *= healMods(f, u); // 광란 (받는 치유 +30%), 얼음 방패 (치유 없음)
  const eff = Math.min(amt, u.max - u.hp);
  u.hp += eff;
  u.got += eff;
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

/** 피해. magic = 보스 광역·장판·지속 피해 (평타·버스터·적 근접은 물리, 17 수호기사) */
export function damage(f: Fight, u: Unit, amt: number, magic = false): void {
  if (!u.alive || amt <= 0) return;
  amt *= f.dmgMult;
  if (u.me && f.tx.on.firmWill) amt *= 0.8; // 굳은 의지 (06 6장)
  if (u.shield > 0) amt *= 0.6;
  if (u.bulwark > 0) amt *= 1 - BULWARK.cut;
  if (u.redu > 0) amt *= 1 - u.reduCut;
  if (f.abOn) { amt = dmgMods(f, u, amt, magic); if (amt < 0) return; } // 파티원 능력 (17)
  if (u.immune > 0 && !magic) return; // 보호의 손: 물리 피해 무시 (25 성기사)
  if (u.sacr > 0 && f.me.alive && f.me !== u) { // 희생: 받는 피해의 30%를 내가 대신
    const part = amt * SACRIFICE_CUT;
    amt -= part;
    damage(f, f.me, part / f.dmgMult, magic);
  }
  if (u.cls) {
    if (magic && u.cls === 'paladin') amt *= 0.9;
    if (u.cls === 'swordsman') u.flow = 3;
  }
  // 은혜 갚기 (06 6장): 내가 죽을 피해를 한 번 대신 맞아 줌. 호감도가 아직 없어서 체력 비율이 가장 높은 파티원 (50% 이상)
  if (u.me && f.tx.on.repay && !f.tx.repayUsed && u.guardian <= 0 && u.hp - amt <= 0) {
    const v = living(f).filter(x => !x.me && x.hp >= x.max * 0.5).sort((a, b) => b.hp / b.max - a.hp / a.max)[0];
    if (v) {
      f.tx.repayUsed = true;
      emit(f, { type: 'msg', text: `은혜 갚기: ${v.nick}이(가) 대신 맞음` });
      damage(f, v, amt / f.dmgMult, magic);
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
      emit(f, { type: 'sound', name: 'bell' });
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
      damage(f, v, 150, true);
      if (v.alive) addDebuff(f, v, { name: '독침', type: '독', left: 12, dot: 15 });
    }
  }
}

export function onDebuffEnd(f: Fight, u: Unit, d: Debuff, dispelled: boolean): void {
  if (d.name === '썩은 숨결') u.max = u.base;
  if (d.name === '전염') spread(f, u);
  // 무음 성가대 독창 (26 4-3): 안 지우고 끝나면 그 사람이 선 열 전체 200. 지우면 그냥 사라짐 (함정 아님)
  if (d.name === '독창' && !dispelled) {
    const col = cellOf(f, u).col;
    for (const v of living(f)) if (cellOf(f, v).col === col) damage(f, v, 200, true);
    emit(f, { type: 'msg', text: `독창: ${u.nick} 줄 전체 피해` });
  }
}

/** 보스가 아닌 적(또는 보스 몸통)에 피해. 쓰러지면 시전 중이던 기술도 끊김. 적 체력 합을 다시 셈 */
export function damageMob(f: Fight, m: Mob, x: number): void {
  if (!m.alive || x <= 0) return;
  m.hp -= x;
  if (m.hp <= 1e-9) {
    m.hp = 0; m.alive = false;
    f.tels = f.tels.filter(t => t.skill.mob !== m.id);
    emit(f, { type: 'mobDown', id: m.id, name: m.name });
  }
  f.bossHp = f.mobs.reduce((s, q) => s + q.hp, 0);
}
