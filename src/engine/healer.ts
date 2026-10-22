import { HEROES } from '../data/heroes';
import { MONK } from '../data/heroConst';
import { DISPELLABLE, PASSIVE_LEVEL, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey, type SlotName } from '../data/skills';
import { affRegen } from './affixes';
import { DT, cellOf, emit, heal, living, onDebuffEnd, unitById } from './core';
import { hexDist } from './board';
import { relayTick, putRelay } from './relay';
import { totemsTick } from './totems';
import { heroApply, heroCell, heroTick, hotCount, putHot } from './heroes';
import { palmGcd } from './monk';
import { judgeReady, warderRegen } from './warder';
import { crisis, freeCast, gcdNow, guardSec, hc, later, raidSec, regenSpec, specApply, specDispel, specExec, specTick, sv, twiceBrush, twin, under } from './specials';
import { orderHeal } from './bossParts';
import { reviveTarget } from './revive';
import { adjLow, castOf, cdOf, costOf, directSpread, focusMult, has, overflow, pohAt, renewSec, spendGuard, talentTick, waveNeed, wordCap, wordPower, wordReady, wordSpent } from './talents';
import { TX } from '../data/talents';
import type { ActionResult, Debuff, Fight, Unit } from './types';

/** 이 레벨에서 배운 스킬·패시브인지 (06 7장) */
export const knows = (f: Fight, key: SkillKey) => f.level >= SKILL_LEVEL[key];
export const knowsPassive = (f: Fight, key: PassiveKey) => f.hero === 'priest' && f.level >= PASSIVE_LEVEL[key];

/** 전투당 횟수 소진 여부. 엔진 판정·수동 입력·버튼 표시가 같은 기준을 사용한다. */
export const skillUsesSpent = (f: Fight, key: SkillKey): boolean => key === 'rebirth' && f.rebirthUsed;

/**
 * 휠 자리 → 실제 스킬. 휠 자리 이름은 사제 스킬 이름을 그대로 쓴다 (heal = 기본 힐 칸, poh = 광역 힐 칸 …, unique = 8번째 칸).
 * 사제는 평온 게이지가 차면 치유 → 성언: 평온 (82: 신성화는 없앰). 다른 직업은 그 칸의 직업 스킬 (25 2장)
 */
export const SLOT_OF: Record<string, SlotName> = { heal: 'basic', flash: 'fast', renew: 'hot', poh: 'aoe', purify: 'dispel', guardian: 'ext', hymn: 'raid', unique: 'unique' };
export function slotKey(f: Fight, slot: string): SkillKey {
  if (f.hero === 'priest' && slot !== 'unique') {
    if (slot === 'heal' && wordReady(f, f.g.p)) return 'serenity';
    return slot as SkillKey;
  }
  const s = SLOT_OF[slot];
  return (s && HEROES[f.hero].slots[s]) || (slot as SkillKey);
}

export function canTarget(f: Fight, key: SkillKey, cellIdx: number): ActionResult {
  const sk = SKILLS[key];
  if (sk.power) { const need = sk.powerAll ? 1 : key === 'lightWave' ? waveNeed(f) : sk.power; if (f.power3 < need) return { ok: false, reason: `신성한 힘 부족 (${f.power3}/${need})` }; } // 끝없는 빛 (77): 빛의 파도 2칸부터
  if (sk.target === 'dead') {
    if (skillUsesSpent(f, key)) return { ok: false, reason: '환생은 전투당 1회' };
    const u = reviveTarget(f);
    return u ? { ok: true, u } : { ok: false, reason: '쓰러진 파티원 없음' };
  }
  if (sk.target === 'none') return { ok: true };
  if (sk.target === 'cell') { // 칸을 고르는 스킬 (주술사 샘 토템, 79 6-1): 무너진 바닥만 안 됨
    const c = f.cells[cellIdx];
    if (!c) return { ok: false, reason: '칸 선택' };
    return c.block === 'hole' ? { ok: false, reason: '무너진 바닥에는 못 세움' } : { ok: true };
  }
  const c = f.cells[cellIdx];
  if (c && !c.unit && c.block === 'soul') return soulTarget(f, key, c.i);
  if (!c || !c.unit) return { ok: false, reason: '빈 칸' };
  const u = c.unit;
  if (!u.alive) return { ok: false, reason: `${u.nick}은(는) 쓰러짐` };
  if (u.lift) return { ok: false, reason: `닿지 않음: ${u.nick}은(는) 하늘에 떠 있음` }; // 띄워 올리기 (P-LIFT, 56 5장)
  if (key === 'purify' && !u.debuffs.some(d => DISPELLABLE[d.type] && !d.lock)) return { ok: false, reason: '정화로 지울 디버프 없음' };
  if (sk.slot === 'dispel' && f.hero !== 'priest' && !u.debuffs.some(d => HEROES[f.hero].dispel.includes(d.type) && !d.lock)) return { ok: false, reason: `${sk.name}로 지울 디버프 없음` };
  if (key === 'bloom' && !hotCount(u)) return { ok: false, reason: '거둘 지속 힐 없음' };
  return { ok: true, u };
}

/** 헤매는 영혼 칸 (P-SOUL): 단일 힐(기본·빠른·지속)과, 영혼의 유형을 지우는 해제만 */
function soulTarget(f: Fight, key: SkillKey, i: number): ActionResult {
  const u = f.souls.find(x => x.cell === i);
  if (!u) return { ok: false, reason: '빈 칸' };
  const sk = SKILLS[key];
  if (singleHeal(key)) return { ok: true, u };
  if (sk.slot === 'dispel') {
    const can = (t: string) => (f.hero === 'priest' ? !!DISPELLABLE[t] : HEROES[f.hero].dispel.includes(t));
    return u.debuffs.some(d => can(d.type)) ? { ok: true, u } : { ok: false, reason: `${u.soul!.name}: ${sk.name}로 못 지움` };
  }
  return { ok: false, reason: `${u.soul!.name}: 단일 힐만 들어감` };
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
  if (key === 'judgment' && !judgeReady(f)) return { ok: false, reason: '심판: 인장이 붙은 아군 없음' }; // 79 5-3
  if (f.mana < costOf(f, key, tg.u)) { f.stats.manaFails++; return { ok: false, reason: '마나 부족' }; }
  if (sk.gcd === 0) { exec(f, key, cellIdx, tg.u); return { ok: true }; } // GCD를 안 쓰는 스킬 (차 한 잔): 시전 · GCD 중에도 바로, 시전을 끊지 않음
  const uid = tg.u ? tg.u.id : null;
  if (f.cast && f.cast.uid === uid && f.cast.key === key) return { ok: true, same: true };
  if (f.channel > 0) { f.channel = 0; f.stats.hymnBroken++; emit(f, { type: 'msg', text: `${SKILLS[HEROES[f.hero].slots.raid!].name} 끊김` }); }
  if (f.cast) { f.cast = null; f.stats.cancels++; f.gcd = 0; } // 시전을 취소하고 새 대상으로 바꿀 때는 GCD를 돌려준다 (02 4-2)
  if (f.gcd > 0) { f.queued = sk.target === 'cell' ? { key, uid, cell: cellIdx } : { key, uid }; return { ok: true, queued: true }; }
  exec(f, key, cellIdx, tg.u);
  return { ok: true };
}

/** 이 스킬이 거는 GCD (가속 반영): 스킬마다 GCD (79 6-1, 수도사 손바닥 1.0초)면 규칙 GCD에 대한 비율만큼 */
export function gcdOf(f: Fight, key: SkillKey): number {
  const tg = key === 'vitalPalm' && palmGcd(f), g = tg || SKILLS[key].gcd; // 천 개의 손 (79 3-7)
  const v = g == null ? f.gcdBase : (f.gcdBase * g) / f.R.gcd;
  return key === 'vitalPalm' && !tg && MONK.palmGcdMin ? Math.max(MONK.palmGcdMin, v) : v; // 손바닥 대기 하한 (84 밸런스: 장비 가속이 높은 악몽에서 수도사만 크게 세지던 것)
}

function exec(f: Fight, key: SkillKey, cellIdx: number, u: Unit | undefined): void {
  const sk = SKILLS[key];
  if (f.sp) f.gcdBase = gcdNow(f); // 발동 가속 (42)
  if (sk.gcd !== 0) f.gcd = gcdOf(f, key);
  f.stats.casts[key] = (f.stats.casts[key] || 0) + 1;
  f.tx.lastAct = f.t;
  if (sk.target === 'none') u = f.me; // 대상 없는 스킬 (공대 쿨기 · 차 한 잔 · 심판): 효과는 나를 기준으로 (79 6-1)
  const tm = castOf(f, key, u);
  if (f.sp) { if (tm === 0 && freeCast(f, key)) f.sp.free = false; specExec(f, key, tm); } // 바람 탄 발걸음 · 시전 발동 (42)
  if (tm > 0) {
    f.cast = { key, cell: cellIdx, uid: u!.id, left: tm, total: tm };
    return;
  }
  if (sk.target === 'cell') { // 칸에 세우는 스킬 (샘 토템): 마나 · 재사용을 쓰고 그 칸에
    f.mana -= costOf(f, key); if (sk.cd) f.cd[key] = cdOf(f, key);
    heroCell(f, key, cellIdx);
    return;
  }
  if (sk.channel) {
    f.mana -= costOf(f, key); f.cd[key] = cdOf(f, key); f.channel = f.sp ? raidSec(f, key, sk.channel) : sk.channel; f.chTick = 0; // 길어진 노래 · 숲의 숨결 (42)
    emit(f, { type: 'sound', name: 'hymn' });
    noteUsed(f, key, f.me.id);
    if (f.me.debuffs.length) countUse(f, undefined);
    return;
  }
  f.mana -= costOf(f, key, u);
  if (sk.cd) f.cd[key] = cdOf(f, key);
  if (sk.slot === 'dispel' && f.sp && twiceBrush(f)) f.cd[key] = 0; // 두 번 털기 (42 해제 03)
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

/** 화면 이펙트용 기록 (Fight.used) 상한: 비우지 않는 시뮬레이션에서 끝없이 쌓이지 않게 */
const USED_MAX = 32;
/** 화면이 이 칸에 그 스킬 이펙트를 그림 (공통 치유 빛 대신). 쓰는 순간 · 정신 집중 1초마다 · 빛의 전이 회복마다 */
export function noteUsed(f: Fight, key: SkillKey, uid: number): void {
  const used = (f.used ??= []);
  if (used.length < USED_MAX) used.push({ key, uid });
}

function apply(f: Fight, key: SkillKey, u: Unit): void {
  const rc = f.me.debuffs.length ? f.me.debuffs.find(d => d.count) : undefined;
  if (f.sp) specApply(f, key, u, () => applySkill(f, key, u)); // 치유 문맥 (42)
  else applySkill(f, key, u);
  if (rc) countUse(f, rc);
}

function applySkill(f: Fight, key: SkillKey, u: Unit): void {
  if (u.lift) { emit(f, { type: 'msg', text: `닿지 않음: ${u.nick}은(는) 하늘에 떠 있음` }); return; } // 예약해 둔 힐이 나갈 때 떠 버림 (P-LIFT)
  if (key !== 'lightWave' && key !== 'judgment') noteUsed(f, key, u.id); // 빛의 파도 · 심판은 실제로 회복한 사람 칸마다 (heroes 73, warder)
  if (f.order && singleHeal(key) && !u.soul) orderHeal(f, u); // 차례 (P-ORDER)
  if (f.hero !== 'priest') { heroApply(f, key, u); return; }
  const sk = SKILLS[key];
  if (key === 'heal' || key === 'flash' || key === 'serenity') {
    let amt = sk.amt! * (u.hot > 0 && key !== 'serenity' && knowsPassive(f, 'grace') ? 1.1 : 1);
    if (key === 'serenity') amt *= wordPower(f.g.p);
    amt *= focusMult(f, u);
    const over0 = f.stats.overheal;
    heal(f, u, amt, true);
    if (key === 'heal' && has(f, 'overflow')) overflow(f, u, f.stats.overheal - over0);
    if (key === 'serenity' && sv(f, 'serenityEcho') && f.stats.overheal > over0) putHot(u, 'serenity', { sec: 4, every: 1, total: (f.stats.overheal - over0) / (f.gear.heal * f.power) }); // 평온의 여운 (42 사제 02)
    if (knowsPassive(f, 'echo')) u.echo.push({ left: 4, rate: (sk.amt! * 0.15) / 4 });
    directSpread(f, key, u, amt);
    if (key === 'serenity' && f.sp && sv(f, 'wideSanctify')) for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), cellOf(f, u)) <= sv(f, 'wideSanctify')) heal(f, v, amt * 0.5, true); // 넓은 평온 (42 사제 03, 82)
    if (key === 'serenity' && has(f, 'cleansingWord')) cleanseOne(f, u);
    if (key === 'serenity') emit(f, { type: 'sound', name: 'chime' });
  } else if (key === 'renew') {
    u.hot = renewSec(f); u.hotTick = 0; u.lastHeal = f.t; if (u.sulking) u.sulking = false;
    if (has(f, 'hopRenew')) u.hotHop = false;
    if (has(f, 'shareRenew')) { const v = adjLow(f, u, 1, true)[0]; if (v) { v.hot = renewSec(f); v.hotTick = 0; v.hotHop = false; } }
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'poh') {
    let amt = sk.amt!, r = 1;
    if (has(f, 'wideCircle')) { r = 2; amt *= 0.8; }
    pohAt(f, u.cell, amt, r);
    if (has(f, 'doublePoh')) f.tx.later.push({ at: f.t + 2, cell: u.cell, amt: amt * 0.5, r });
    if (f.sp && sv(f, 'pohEcho') && f.rng() < sv(f, 'pohEcho')) later(f, f.t + 2, u.cell, amt * 0.5, r); // 기원의 메아리 (42 사제 05)
    if (f.sp && hc.n >= 4 && sv(f, 'groupPrayer')) fillWords(f, 100 * sv(f, 'groupPrayer')); // 모두의 기도 (42 사제 21, 82: 평온 게이지)
  } else if (key === 'purify') {
    const ds = u.debuffs.filter(d => DISPELLABLE[d.type] && !d.lock).sort((a, b) => (a.trap ? 1 : 0) - (b.trap ? 1 : 0) || (b.stack || 0) - (a.stack || 0));
    const d = ds[0];
    u.debuffs = u.debuffs.filter(x => x !== d);
    if (d.trap) f.stats.trapPops++; else f.stats.dispels++;
    emit(f, { type: 'sound', name: 'dispel' });
    emit(f, { type: 'dispel', id: u.id, trap: !!d.trap });
    onDebuffEnd(f, u, d, true);
    if (!d.trap && has(f, 'washed')) heal(f, u, 150, true); // 씻어낸 자리
    if (f.sp) specDispel(f, u, d);
    if (f.sp && sv(f, 'clearPrayer')) fillWords(f, 100 * sv(f, 'clearPrayer')); // 맑은 기도 (42 사제 20)
  } else if (key === 'guardian') {
    u.guardian = guardSec(f, 10); // 수호의 깃 (42 보호 07)
    if (f.sp) twin(f, u, v => { v.guardian = Math.max(v.guardian, guardSec(f, 10) / 2); }); // 쌍둥이 방패
    emit(f, { type: 'sound', name: 'renew' });
  } else if (key === 'relay') {
    putRelay(f, u);
    emit(f, { type: 'sound', name: 'renew' });
  }
  // 평온 게이지 (82: 하나)
  if (key === 'serenity') {
    f.g.p = wordSpent(f.g.p);
    if (f.sp && sv(f, 'crossWord')) f.g.p = Math.max(f.g.p, 100 * sv(f, 'crossWord')); // 번지는 울림 (42 사제 18, 82): 쓴 뒤 게이지가 이만큼에서 시작
    if (has(f, 'echoWord')) f.tx.echoUntil = f.t + 5; // 말씀의 여운
  }
  fillWords(f, sk.gp ?? 0);
}

/** 평온 게이지 채우기 (06 4장, 82: 게이지는 평온 하나): 충만한 마음 · 깊은 성언 (42 사제 01)이면 더 빨리. 100%가 되는 순간 알림 */
export function fillWords(f: Fight, gp: number): void {
  if (!knowsPassive(f, 'words') || !gp) return;
  const before = f.g.p;
  const gm = (has(f, 'fullHeart') ? 1.3 : 1) * (1 + sv(f, 'deepWord'));
  f.g.p = Math.min(wordCap(f), f.g.p + gp * gm);
  if (before < 100 && f.g.p >= 100) emit(f, { type: 'gauge', which: '평온' });
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
  let regen = f.R.regen * f.gear.regen * f.enc.manaCoef * (f.symbol > 0 ? 4 : 1);
  if (f.sp) regen *= regenSpec(f); // 샘물 한 모금 · 고요한 순간 · 두꺼비 부적 (42)
  if (f.tx.on.calmBreath) regen *= 1 + TX.calmBreath * f.power3; // 고른 호흡 (77)
  if (f.hero === 'warder' && f.tx.any) regen *= warderRegen(f); // 막의 숨 · 장막의 숨 (79 5-7)
  if (f.cast || f.channel > 0) f.tx.lastAct = f.t;
  else if (f.tx.on.breather && f.t - f.tx.lastAct >= 3 - 1e-9) regen *= 2; // 숨 고르기
  if (f.aff) regen *= affRegen(f); // 고갈 (110)
  f.mana = Math.min(100, f.mana + regen * dt);
  if (f.symbol > 0) f.symbol -= dt;
  if (!f.symbolUsed && f.mana < 30 && knowsPassive(f, 'symbol')) { f.symbolUsed = true; f.symbol = 5; emit(f, { type: 'msg', text: '상징: 5초간 마나 회복 4배' }); }
  const cr = f.sp ? crisis(f) : false; // 위기의 직감 (42 쿨기 06): 공대 쿨기 2배 빨리
  for (const k in f.cd) f.cd[k as SkillKey] = Math.max(0, f.cd[k as SkillKey]! - (cr && SKILLS[k as SkillKey].slot === 'raid' ? 2 * dt : dt));
  if (f.me.debuffs.length) for (const d of f.me.debuffs) if (d.drain) f.mana = Math.max(0, f.mana - d.drain * dt); // 마나 갈취 표식 (P-DRAIN)
  for (const k in f.lock) { const l = f.lock[k as SkillKey]!; l.left -= dt; if (l.left <= 1e-9) delete f.lock[k as SkillKey]; } // 진동 잠김
  if (f.gcd > 0) f.gcd -= dt;
  if (f.channel > 0) {
    f.channel -= dt; f.chTick += dt;
    if (f.chTick >= 1 - 1e-9) {
      f.chTick -= 1;
      const tick = () => { for (const u of living(f)) heal(f, u, 120, true); }; // 정신 집중 공대 쿨기는 사제 찬가뿐 (82: 고요한 숲은 즉시)
      if (f.sp) under(HEROES[f.hero].slots.raid!, false, tick); else tick();
      noteUsed(f, HEROES[f.hero].slots.raid!, f.me.id); // 찬가: 1초마다 그 스킬 이펙트 (Lim 「스킬별로 이펙트가 달라야」)
    }
    if (f.channel <= 1e-9 && f.sp && f.hero === 'priest' && sv(f, 'hymnBreath')) { f.channel = 0; f.mana = Math.min(100, f.mana + sv(f, 'hymnBreath')); } // 찬가의 숨결 (42 사제 07)
    // 찬가의 끝자락: 끊기지 않고 끝나면 전원 6초 지속 힐 120
    if (f.channel <= 1e-9 && has(f, 'hymnTail')) { f.channel = 0; for (const u of living(f)) putHot(u, 'hymn', { sec: 6, every: 2, total: 120 }); }
  }
  if (f.relays.length) relayTick(f);
  if (f.hero !== 'priest') heroTick(f, dt);
  if (f.totems.length) totemsTick(f); // 판 위 물건 (79 6-1): 시간 · 깨짐 (그 틱의 토템 회복이 먼저)
  if (f.tx.any) talentTick(f, dt);
  if (f.cast) {
    f.cast.left -= dt;
    if (f.cast.left <= 1e-9) {
      const c = f.cast; f.cast = null;
      const sk = SKILLS[c.key];
      const u = sk.target === 'none' ? f.me : unitById(f, c.uid); // 대상 없는 시전 (결계사 심판): 나를 기준으로
      const cost = costOf(f, c.key, u);
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
      const idx = q.cell ?? (tu ? tu.cell : 0);
      const tg = canTarget(f, q.key, idx);
      if (tg.ok && !(sk.cd && (f.cd[q.key] ?? 0) > 0) && !f.lock[q.key] && f.mana >= costOf(f, q.key, tg.u)) exec(f, q.key, idx, tg.u);
      else { f.stats.queueLost++; if (!tg.ok && tg.reason) emit(f, { type: 'msg', text: tg.reason }); }
    }
  }
  if (f.sp) specTick(f, dt, pohAt);
  f.stats.minMana = Math.min(f.stats.minMana, f.mana);
}
