import { HEROES } from '../data/heroes';
import { DISPELLABLE, PASSIVE_LEVEL, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey, type SlotName } from '../data/skills';
import { hexDist } from './board';
import { cellOf, DT, emit, heal, living, onDebuffEnd, unitById } from './core';
import { heroApply, heroChannelTick, heroTick, hotCount } from './heroes';
import { reviveTarget } from './items';
import type { ActionResult, Fight, Unit } from './types';

/** 이 레벨에서 배운 스킬·패시브인지 (06 7장) */
export const knows = (f: Fight, key: SkillKey) => f.level >= SKILL_LEVEL[key];
export const knowsPassive = (f: Fight, key: PassiveKey) => f.hero === 'priest' && f.level >= PASSIVE_LEVEL[key];

/**
 * 휠 자리 → 실제 스킬. 휠 자리 이름은 사제 스킬 이름을 그대로 쓴다 (heal = 기본 힐 칸, poh = 광역 힐 칸 …, unique = 8번째 칸).
 * 사제는 성언 게이지가 차면 치유 → 평온, 기원 → 신성화. 다른 직업은 그 칸의 직업 스킬 (25 2장)
 */
export const SLOT_OF: Record<string, SlotName> = { heal: 'basic', flash: 'fast', renew: 'hot', poh: 'aoe', purify: 'dispel', guardian: 'ext', hymn: 'raid', unique: 'unique' };
export function slotKey(f: Fight, slot: string): SkillKey {
  if (f.hero === 'priest') {
    if (slot === 'heal' && f.g.p >= 100) return 'serenity';
    if (slot === 'poh' && f.g.s >= 100) return 'sanctify';
    return slot as SkillKey;
  }
  const s = SLOT_OF[slot];
  return (s && HEROES[f.hero].slots[s]) || (slot as SkillKey);
}

export function canTarget(f: Fight, key: SkillKey, cellIdx: number): ActionResult {
  const sk = SKILLS[key];
  if (sk.power && f.power3 < (sk.powerAll ? 1 : sk.power)) return { ok: false, reason: `신성한 힘 부족 (${f.power3}/${sk.powerAll ? 1 : sk.power})` };
  if (sk.target === 'dead') {
    if (key === 'rebirth' && f.rebirthUsed) return { ok: false, reason: '환생은 전투당 1회' };
    const u = reviveTarget(f);
    return u ? { ok: true, u } : { ok: false, reason: '쓰러진 파티원 없음' };
  }
  if (sk.target === 'none') return { ok: true };
  const c = f.cells[cellIdx];
  if (!c || !c.unit) return { ok: false, reason: '빈 칸' };
  const u = c.unit;
  if (!u.alive) return { ok: false, reason: `${u.nick}은(는) 쓰러짐` };
  if (key === 'purify' && !u.debuffs.some(d => DISPELLABLE[d.type])) return { ok: false, reason: '정화로 지울 디버프 없음' };
  if (sk.slot === 'dispel' && f.hero !== 'priest' && !u.debuffs.some(d => HEROES[f.hero].dispel.includes(d.type))) return { ok: false, reason: `${sk.name}로 지울 디버프 없음` };
  if (key === 'bloom' && !hotCount(u)) return { ok: false, reason: '거둘 지속 힐 없음' };
  return { ok: true, u };
}

/** 스킬 사용 (칸 탭·휠). 시전 중 다른 대상 = 취소 후 새 대상, GCD 중이면 예약 */
export function use(f: Fight, key: SkillKey, cellIdx: number): ActionResult {
  if (f.over) return { ok: false };
  const sk = SKILLS[key];
  if (!knows(f, key)) return { ok: false, reason: `${sk.name}: Lv ${SKILL_LEVEL[key]}에 배움` };
  const tg = canTarget(f, key, cellIdx);
  if (!tg.ok) return tg;
  if (sk.cd && (f.cd[key] ?? 0) > 0) return { ok: false, reason: `${sk.name} 재사용 대기 ${Math.ceil(f.cd[key]!)}초` };
  if (f.mana < sk.cost) { f.stats.manaFails++; return { ok: false, reason: '마나 부족' }; }
  const uid = tg.u ? tg.u.id : null;
  if (f.cast && f.cast.uid === uid && f.cast.key === key) return { ok: true, same: true };
  if (f.channel > 0) { f.channel = 0; f.stats.hymnBroken++; emit(f, { type: 'msg', text: `${SKILLS[HEROES[f.hero].slots.raid!].name} 끊김` }); }
  if (f.cast) { f.cast = null; f.stats.cancels++; f.gcd = 0; } // 시전을 취소하고 새 대상으로 바꿀 때는 GCD를 돌려준다 (02 4-2)
  if (f.gcd > 0) { f.queued = { key, uid }; return { ok: true, queued: true }; }
  exec(f, key, cellIdx, tg.u);
  return { ok: true };
}

function exec(f: Fight, key: SkillKey, cellIdx: number, u: Unit | undefined): void {
  const sk = SKILLS[key];
  f.gcd = f.gcdBase;
  f.stats.casts[key] = (f.stats.casts[key] || 0) + 1;
  if (sk.cast > 0) {
    const tm = sk.cast / (1 + f.gear.haste);
    f.cast = { key, cell: cellIdx, uid: u!.id, left: tm, total: tm };
    return;
  }
  if (sk.channel) {
    f.mana -= sk.cost; f.cd[key] = sk.cd; f.channel = sk.channel; f.chTick = 0;
    emit(f, { type: 'sound', name: 'hymn' });
    return;
  }
  f.mana -= sk.cost;
  if (sk.cd) f.cd[key] = sk.cd;
  apply(f, key, u!);
}

function apply(f: Fight, key: SkillKey, u: Unit): void {
  if (f.hero !== 'priest') { heroApply(f, key, u); return; }
  const sk = SKILLS[key];
  if (key === 'heal' || key === 'flash' || key === 'serenity') {
    heal(f, u, sk.amt! * (u.hot > 0 && key !== 'serenity' && knowsPassive(f, 'grace') ? 1.1 : 1), true);
    if (knowsPassive(f, 'echo')) u.echo.push({ left: 4, rate: (sk.amt! * 0.15) / 4 });
    if (key === 'serenity') emit(f, { type: 'sound', name: 'bell' });
  } else if (key === 'renew') {
    u.hot = 9; u.hotTick = 0; u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'poh' || key === 'sanctify') {
    const c = cellOf(f, u);
    for (const v of living(f)) if (hexDist(cellOf(f, v), c) <= 1) heal(f, v, sk.amt!, true);
    if (key === 'sanctify') emit(f, { type: 'sound', name: 'bell' });
  } else if (key === 'purify') {
    const ds = u.debuffs.filter(d => DISPELLABLE[d.type]).sort((a, b) => (a.trap ? 1 : 0) - (b.trap ? 1 : 0) || (b.stack || 0) - (a.stack || 0));
    const d = ds[0];
    u.debuffs = u.debuffs.filter(x => x !== d);
    if (d.trap) f.stats.trapPops++; else f.stats.dispels++;
    emit(f, { type: 'sound', name: 'dispel' });
    emit(f, { type: 'dispel', id: u.id, trap: !!d.trap });
    onDebuffEnd(f, u, d, true);
  } else if (key === 'guardian') {
    u.guardian = 10;
    emit(f, { type: 'sound', name: 'renew' });
  }
  // 성언 게이지
  const before = { p: f.g.p, s: f.g.s };
  if (key === 'serenity') f.g.p = 0;
  if (key === 'sanctify') f.g.s = 0;
  if (knowsPassive(f, 'words')) {
    if (sk.gp) f.g.p = Math.min(100, f.g.p + sk.gp);
    if (sk.gs && knows(f, 'poh')) f.g.s = Math.min(100, f.g.s + sk.gs);
  }
  if (before.p < 100 && f.g.p >= 100) emit(f, { type: 'gauge', which: '평온' });
  if (before.s < 100 && f.g.s >= 100) emit(f, { type: 'gauge', which: '신성화' });
}

/** 힐러 한 틱: 마나 재생, 재사용 대기, 찬가, 시전 완료, 예약 실행 */
export function healerTick(f: Fight): void {
  const dt = DT;
  const regen = 1.0 * f.gear.regen * f.enc.manaCoef * (f.symbol > 0 ? 4 : 1) * (f.medit > 0 ? 2.5 : 1);
  if (f.medit > 0) f.medit -= dt;
  if (f.potCd > 0) f.potCd = Math.max(0, f.potCd - dt);
  f.mana = Math.min(100, f.mana + regen * dt);
  if (f.symbol > 0) f.symbol -= dt;
  if (!f.symbolUsed && f.mana < 30 && knowsPassive(f, 'symbol')) { f.symbolUsed = true; f.symbol = 5; emit(f, { type: 'msg', text: '상징: 5초간 마나 회복 4배' }); }
  for (const k in f.cd) f.cd[k as SkillKey] = Math.max(0, f.cd[k as SkillKey]! - dt);
  if (f.gcd > 0) f.gcd -= dt;
  if (f.channel > 0) {
    f.channel -= dt; f.chTick += dt;
    if (f.chTick >= 1 - 1e-9) { f.chTick -= 1; if (f.hero === 'priest') { for (const u of living(f)) heal(f, u, 120, true); } else heroChannelTick(f); }
  }
  if (f.hero !== 'priest') heroTick(f, dt);
  if (f.cast) {
    f.cast.left -= dt;
    if (f.cast.left <= 1e-9) {
      const c = f.cast; f.cast = null;
      const sk = SKILLS[c.key];
      const u = unitById(f, c.uid);
      if (sk.target === 'dead') { if (u && !u.alive && f.mana >= sk.cost) { f.mana -= sk.cost; apply(f, c.key, u); } else emit(f, { type: 'msg', text: `${sk.name} 취소` }); }
      else if (!u || !u.alive) emit(f, { type: 'msg', text: '대상이 쓰러져 시전 취소' });
      else if (f.mana < sk.cost) { f.stats.manaFails++; emit(f, { type: 'msg', text: '마나 부족' }); }
      else { f.mana -= sk.cost; apply(f, c.key, u); }
    }
  }
  if (f.queued && f.gcd <= 0 && !f.cast && f.channel <= 0) {
    const q = f.queued; f.queued = null;
    const sk = SKILLS[q.key];
    const tu = q.uid == null ? null : unitById(f, q.uid);
    if (q.uid != null && (!tu || !tu.alive) && sk.target !== 'dead') { f.stats.queueLost++; emit(f, { type: 'msg', text: '대상이 쓰러져 예약한 힐 취소' }); }
    else {
      const idx = tu ? tu.cell : 0;
      const tg = canTarget(f, q.key, idx);
      if (tg.ok && !(sk.cd && (f.cd[q.key] ?? 0) > 0) && f.mana >= sk.cost) exec(f, q.key, idx, tg.u);
      else { f.stats.queueLost++; if (!tg.ok && tg.reason) emit(f, { type: 'msg', text: tg.reason }); }
    }
  }
  f.stats.minMana = Math.min(f.stats.minMana, f.mana);
}
