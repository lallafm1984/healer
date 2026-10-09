import { HEROES } from '../data/heroes';
import { DISPELLABLE, PASSIVE_LEVEL, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey, type SlotName } from '../data/skills';
import { DT, emit, heal, living, onDebuffEnd, unitById } from './core';
import { heroApply, heroChannelTick, heroTick, hotCount, putHot } from './heroes';
import { orderHeal } from './bossParts';
import { reviveTarget } from './items';
import { adjLow, castOf, cdOf, costOf, directSpread, focusMult, has, overflow, pohAt, renewSec, spendGuard, talentTick, wordCap, wordPower, wordReady, wordSpent } from './talents';
import type { ActionResult, Debuff, Fight, Unit } from './types';

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
    if (slot === 'heal' && wordReady(f, f.g.p)) return 'serenity';
    if (slot === 'poh' && wordReady(f, f.g.s)) return 'sanctify';
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
  if (key === 'purify' && !u.debuffs.some(d => DISPELLABLE[d.type] && !d.lock)) return { ok: false, reason: '정화로 지울 디버프 없음' };
  if (sk.slot === 'dispel' && f.hero !== 'priest' && !u.debuffs.some(d => HEROES[f.hero].dispel.includes(d.type) && !d.lock)) return { ok: false, reason: `${sk.name}로 지울 디버프 없음` };
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
  if (tg.u && tg.u.debuffs.length && invertTap(f, key, tg.u)) return { ok: false, reason: '뒤집힌 축복: 힐이 피해가 됨 (한 번 더 누르면 사용)' };
  if (sk.cd && (f.cd[key] ?? 0) > 0) return { ok: false, reason: `${sk.name} 재사용 대기 ${Math.ceil(f.cd[key]!)}초` };
  if (f.lock[key]) return { ok: false, reason: `${sk.name} 잠김 ${Math.ceil(f.lock[key]!.left)}초 (진동)` };
  if (f.mana < costOf(f, key)) { f.stats.manaFails++; return { ok: false, reason: '마나 부족' }; }
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
  f.tx.lastAct = f.t;
  const tm = castOf(f, key);
  if (tm > 0) {
    f.cast = { key, cell: cellIdx, uid: u!.id, left: tm, total: tm };
    return;
  }
  if (sk.channel) {
    f.mana -= costOf(f, key); f.cd[key] = cdOf(f, key); f.channel = sk.channel; f.chTick = 0;
    emit(f, { type: 'sound', name: 'hymn' });
    if (f.me.debuffs.length) countUse(f, undefined);
    return;
  }
  f.mana -= costOf(f, key);
  if (sk.cd) f.cd[key] = cdOf(f, key);
  if (key === 'guardian' && has(f, 'twoGuard')) spendGuard(f);
  apply(f, key, u!);
}

/** 차례·뒤집힌 축복에서 「그 사람을 힐한다」로 치는 휠 칸: 단일 대상 힐 (기본·빠른·지속) */
const SINGLE_HEAL = new Set<SlotName>(['basic', 'fast', 'hot']);
export const singleHeal = (key: SkillKey): boolean => SINGLE_HEAL.has(SKILLS[key].slot) && SKILLS[key].target === 'ally';

const HEAL_TAP = new Set<SlotName>(['basic', 'fast', 'hot', 'aoe']);
/**
 * 뒤집힌 축복 실수 방지 (35 4-3): 쉬움·보통은 그 칸에 힐을 처음 누르면 칸만 흔들리고 안 나감. 같은 디버프에 두 번째부터 나감.
 * 해제·외부 생존기는 그대로 나감
 */
function invertTap(f: Fight, key: SkillKey, u: Unit): boolean {
  if (!HEAL_TAP.has(SKILLS[key].slot) || (f.cfg.diff !== '쉬움' && f.cfg.diff !== '보통')) return false;
  const d = u.debuffs.find(x => x.invert);
  if (!d || f.invertTap === d.id) return false;
  f.invertTap = d.id;
  emit(f, { type: 'shake', id: u.id });
  return true;
}

/** 마력 역류 (P-RECOIL): 스킬이 나갈 때마다 1중첩. 해제로 그 디버프를 지운 한 번은 안 셈 (지운 순간 그때까지 중첩만큼 터짐) */
function countUse(f: Fight, rc: Debuff | undefined): void {
  const d = rc ?? f.me.debuffs.find(x => x.count);
  if (d && f.me.debuffs.includes(d)) d.stack = (d.stack ?? 0) + 1;
}

function apply(f: Fight, key: SkillKey, u: Unit): void {
  const rc = f.me.debuffs.length ? f.me.debuffs.find(d => d.count) : undefined;
  applySkill(f, key, u);
  if (rc) countUse(f, rc);
}

function applySkill(f: Fight, key: SkillKey, u: Unit): void {
  if (f.order && singleHeal(key)) orderHeal(f, u); // 차례 (P-ORDER)
  if (f.hero !== 'priest') { heroApply(f, key, u); return; }
  const sk = SKILLS[key];
  if (key === 'heal' || key === 'flash' || key === 'serenity') {
    let amt = sk.amt! * (u.hot > 0 && key !== 'serenity' && knowsPassive(f, 'grace') ? 1.1 : 1);
    if (key === 'serenity') amt *= wordPower(f.g.p);
    amt *= focusMult(f, u);
    const over0 = f.stats.overheal;
    heal(f, u, amt, true);
    if (key === 'heal' && has(f, 'overflow')) overflow(f, u, f.stats.overheal - over0);
    if (knowsPassive(f, 'echo')) u.echo.push({ left: 4, rate: (sk.amt! * 0.15) / 4 });
    directSpread(f, key, u, amt);
    if (key === 'serenity' && has(f, 'cleansingWord')) cleanseOne(f, u);
    if (key === 'serenity') emit(f, { type: 'sound', name: 'bell' });
  } else if (key === 'renew') {
    u.hot = renewSec(f); u.hotTick = 0; u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    if (has(f, 'hopRenew')) u.hotHop = false;
    if (has(f, 'shareRenew')) { const v = adjLow(f, u, 1, true)[0]; if (v) { v.hot = renewSec(f); v.hotTick = 0; v.hotHop = false; } }
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'poh' || key === 'sanctify') {
    let amt = sk.amt!, r = 1;
    if (key === 'sanctify') amt *= wordPower(f.g.s);
    if (key === 'poh' && has(f, 'wideCircle')) { r = 2; amt *= 0.8; }
    pohAt(f, u.cell, amt, r);
    if (key === 'poh' && has(f, 'doublePoh')) f.tx.later.push({ at: f.t + 2, cell: u.cell, amt: amt * 0.5, r });
    if (key === 'sanctify') emit(f, { type: 'sound', name: 'bell' });
  } else if (key === 'purify') {
    const ds = u.debuffs.filter(d => DISPELLABLE[d.type] && !d.lock).sort((a, b) => (a.trap ? 1 : 0) - (b.trap ? 1 : 0) || (b.stack || 0) - (a.stack || 0));
    const d = ds[0];
    u.debuffs = u.debuffs.filter(x => x !== d);
    if (d.trap) f.stats.trapPops++; else f.stats.dispels++;
    emit(f, { type: 'sound', name: 'dispel' });
    emit(f, { type: 'dispel', id: u.id, trap: !!d.trap });
    onDebuffEnd(f, u, d, true);
    if (!d.trap && has(f, 'washed')) heal(f, u, 150, true); // 씻어낸 자리
  } else if (key === 'guardian') {
    u.guardian = 10;
    emit(f, { type: 'sound', name: 'renew' });
  }
  // 성언 게이지
  const before = { p: f.g.p, s: f.g.s };
  if (key === 'serenity') f.g.p = wordSpent(f.g.p);
  if (key === 'sanctify') f.g.s = wordSpent(f.g.s);
  if ((key === 'serenity' || key === 'sanctify') && has(f, 'echoWord')) f.tx.echoUntil = f.t + 5; // 말씀의 여운
  if (knowsPassive(f, 'words')) {
    const cap = wordCap(f), gm = has(f, 'fullHeart') ? 1.3 : 1;
    if (sk.gp) f.g.p = Math.min(cap, f.g.p + sk.gp * gm);
    if (sk.gs && knows(f, 'poh')) f.g.s = Math.min(cap, f.g.s + sk.gs * gm);
  }
  if (before.p < 100 && f.g.p >= 100) emit(f, { type: 'gauge', which: '평온' });
  if (before.s < 100 && f.g.s >= 100) emit(f, { type: 'gauge', which: '신성화' });
}

/** 씻는 말씀: 종류와 상관없이 디버프 1개 (지우면 터지는 함정·해제 불가는 빼고) */
function cleanseOne(f: Fight, u: Unit): void {
  const d = u.debuffs.filter(x => !x.trap && !x.lock).sort((a, b) => (b.stack || 0) - (a.stack || 0))[0];
  if (!d) return;
  u.debuffs = u.debuffs.filter(x => x !== d);
  f.stats.dispels++;
  emit(f, { type: 'dispel', id: u.id });
  onDebuffEnd(f, u, d, true);
}

/** 힐러 한 틱: 마나 재생, 재사용 대기, 찬가, 시전 완료, 예약 실행 */
export function healerTick(f: Fight): void {
  const dt = DT;
  let regen = f.R.regen * f.gear.regen * f.enc.manaCoef * (f.symbol > 0 ? 4 : 1) * (f.medit > 0 ? 2.5 : 1);
  if (f.cast || f.channel > 0) f.tx.lastAct = f.t;
  else if (f.tx.on.breather && f.t - f.tx.lastAct >= 3 - 1e-9) regen *= 2; // 숨 고르기
  if (f.medit > 0) f.medit -= dt;
  if (f.potCd > 0) f.potCd = Math.max(0, f.potCd - dt);
  f.mana = Math.min(100, f.mana + regen * dt);
  if (f.symbol > 0) f.symbol -= dt;
  if (!f.symbolUsed && f.mana < 30 && knowsPassive(f, 'symbol')) { f.symbolUsed = true; f.symbol = 5; emit(f, { type: 'msg', text: '상징: 5초간 마나 회복 4배' }); }
  for (const k in f.cd) f.cd[k as SkillKey] = Math.max(0, f.cd[k as SkillKey]! - dt);
  if (f.me.debuffs.length) for (const d of f.me.debuffs) if (d.drain) f.mana = Math.max(0, f.mana - d.drain * dt); // 마나 갈취 표식 (P-DRAIN)
  for (const k in f.lock) { const l = f.lock[k as SkillKey]!; l.left -= dt; if (l.left <= 1e-9) delete f.lock[k as SkillKey]; } // 진동 잠김
  if (f.gcd > 0) f.gcd -= dt;
  if (f.channel > 0) {
    f.channel -= dt; f.chTick += dt;
    if (f.chTick >= 1 - 1e-9) { f.chTick -= 1; if (f.hero === 'priest') { for (const u of living(f)) heal(f, u, 120, true); } else heroChannelTick(f); }
    // 찬가의 끝자락: 끊기지 않고 끝나면 전원 6초 지속 힐 120
    if (f.channel <= 1e-9 && has(f, 'hymnTail')) { f.channel = 0; for (const u of living(f)) putHot(u, 'hymn', { sec: 6, every: 2, total: 120 }); }
  }
  if (f.hero !== 'priest') heroTick(f, dt);
  else if (f.tx.on && Object.keys(f.tx.on).length) talentTick(f, dt);
  if (f.cast) {
    f.cast.left -= dt;
    if (f.cast.left <= 1e-9) {
      const c = f.cast; f.cast = null;
      const sk = SKILLS[c.key];
      const u = unitById(f, c.uid);
      const cost = costOf(f, c.key);
      if (sk.target === 'dead') { if (u && !u.alive && f.mana >= cost) { f.mana -= cost; apply(f, c.key, u); } else emit(f, { type: 'msg', text: `${sk.name} 취소` }); }
      else if (!u || !u.alive) emit(f, { type: 'msg', text: '대상이 쓰러져 시전 취소' });
      else if (f.mana < cost) { f.stats.manaFails++; emit(f, { type: 'msg', text: '마나 부족' }); }
      else { f.mana -= cost; if (sk.cd) f.cd[c.key] = cdOf(f, c.key); apply(f, c.key, u); } // 시전 스킬의 재사용 대기는 시전이 끝날 때 (들꽃 군락)
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
      if (tg.ok && !(sk.cd && (f.cd[q.key] ?? 0) > 0) && !f.lock[q.key] && f.mana >= costOf(f, q.key)) exec(f, q.key, idx, tg.u);
      else { f.stats.queueLost++; if (!tg.ok && tg.reason) emit(f, { type: 'msg', text: tg.reason }); }
    }
  }
  f.stats.minMana = Math.min(f.stats.minMana, f.mana);
}
