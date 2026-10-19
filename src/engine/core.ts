import { armorFactor, type DamageAim } from '../data/armor';
import { healingShareScore } from '../data/healing-share';
import { healThreat, takenThreat } from './threat';
import { SPREAD } from '../data/bosses';
import { HEROES } from '../data/heroes';
import { SANCTUARY } from '../data/heroConst';
import { hexDist } from './board';
import { abHurt, abLethal, blocksDebuff, dmgMods, healMods } from './abilities';
import { affDebuffEnd, affHeal } from './affixes';
import { relayHurt } from './relay';
import { heroLethal, heroTaken, NEW_HERO } from './heroes';
import { posTaken } from './position';
import { talentDeath, talentTaken } from './talents';
import { coverPart, persDebuff, persDeath, persDispel, persHealed, persHealTaken, persHurt, sturdyTaken } from './persona';
import { afterHeal, afterHurt, critBonus, critMult, debuffSec, dmgSpec, during, healSpec, immune, intAmt, lastBreath, shieldGone, specDeath, specDebtPaid, specDebuffEnd, specFlip, specJump, sv } from './specials';
import type { BarkSit } from '../data/talk/sits';
import { clumsy, sharp } from '../data/fm';
import { STAT_ACT } from '../data/rules';
import type { Cell, Debuff, Fight, FightEvent, Mob, Unit } from './types';

/** 한 틱 = 0.05초 */
export const DT = 0.05;

/** 성기사 희생: 대상이 받는 피해 중 내가 대신 받는 비율 (25 3장) */
export const SACRIFICE_CUT = 0.3;

/** 살아 있고 판 위에 있는 파티원. 띄워 올려진 사람 (P-LIFT)은 하늘에 있어 빠짐: 보스 기술 · 광역 힐 · 이웃 칸 효과가 안 닿음 */
export const living = (f: Fight): Unit[] => f.party.filter(u => u.alive && !u.lift);
export const cellOf = (f: Fight, u: Unit): Cell => f.cells[u.cell];
/** 파티원 (없으면 헤매는 영혼 칸, P-SOUL) */
export const unitById = (f: Fight, id: number): Unit | undefined => f.party.find(x => x.id === id) ?? (f.souls.length ? f.souls.find(x => x.id === id) : undefined);

export function emit(f: Fight, ev: FightEvent): void {
  f.events.push(ev);
}

/**
 * 파티원 말풍선. force가 아니면 4초 간격 + 60% 확률.
 * sit = 무슨 상황인지 (41 문서). 화면(battle/talk.ts)이 상황·성격·직업에 맞는 대사로 바꿔 보여 줌. 프로토타입 규칙에서는 안 붙임 (parity)
 */
export function bark(f: Fight, u: Unit, text: string | null, force: boolean, sit: BarkSit): void {
  if (!u.alive || u.me) return;
  if (!force && f.t - u.barkAt < 4) return;
  if (!force && f.rng() > 0.6) return;
  u.barkAt = f.t;
  const barks = u.p.barks;
  const ev: FightEvent = { type: 'bark', id: u.id, text: text || barks?.[Math.floor(f.rng() * barks.length)] || '' };
  if (!f.cfg.proto) ev.sit = sit;
  emit(f, ev);
}

/**
 * 회복. direct = 직접 힐(숫자 표시, 관심·감사 성격 반응).
 * raw = 이미 배율이 붙은 값 (사제 흘러넘침): 장비·레벨·특성 배율과 치명타를 다시 안 붙임
 */
export function heal(f: Fight, u: Unit, amt: number, direct: boolean, raw = false): number {
  if (!u.alive || amt <= 0) return 0;
  if (u.lift && !sharing && !lingering) return 0; // 띄워 올리기 (P-LIFT): 미리 건 지속 힐 · 나눔 사슬 몫만 닿음
  if (u.sleep != null && u.sleep > f.t) return 0; // 점성술사 별의 잠 (79 4-2): 회복도 없음
  let crit = false;
  if (!raw) {
    amt *= f.gear.heal * f.power;
    // 사제 특성 (06 6장): 슬픔의 힘 (파티원이 쓰러진 뒤 5초 +30%), 벼랑 끝 손길 (30% 이하 대상 직접 힐 +25%)
    if (f.tx.griefUntil > f.t) amt *= 1.3;
    if (direct && f.tx.on.brink && u.hp <= u.max * 0.3) amt *= 1.25;
    if (f.sp) amt *= healSpec(f, u, direct); // 장비 특수능력 (42)
    crit = f.rng() < f.gear.crit + (f.sp ? critBonus(f) : 0);
    if (crit) amt *= f.sp ? critMult(f) : 1.5;
  }
  if (f.links.length && !sharing) { const o = shareWith(f, u); if (o) return shared(() => heal(f, u, amt / 2, direct, true) + heal(f, o, amt / 2, direct, true)); } // 생명 사슬 나눔형
  if (f.bless && f.t < f.bless.until) amt *= f.bless.heal; // 영혼 축복 (P-SOUL): 받는 치유 증가
  if (u.mods.length) amt *= healMods(f, u); // 광란 (받는 치유 +30%), 얼음 방패 (치유 없음)
  if (u.ps) amt *= persHealTaken(u, direct); // 지속힐 체질 · 큰 힐 체질 · 자립형 (95)
  if (f.aff) amt *= affHeal(f); // 메마름 (받는 치유 -20%)
  if (f.zones.length) ringFeed(f, u); // 요정 고리 (P-GROW): 안에서 치유를 받으면 자람
  if (u.debuffs.length) {
    const ch = u.debuffs.find(d => d.charm);
    if (ch) ch.left += ch.charm!.heal; // 매혹 (P-CHARM): 힐하면 지배가 길어짐
    const cut = u.debuffs.reduce((s, d) => s + (d.healCut ?? 0) * (d.stack ?? 1), 0); // 얼룩진 장갑·먼지 범벅 (35 4-3·4-5)
    if (cut) amt *= Math.max(0, 1 - cut * (1 - sv(f, 'holdingHand'))); // 받치는 손 (42 기믹 08)
    if (u.debuffs.some(d => d.invert)) { invertHeal(f, u, f.zones.length && submerged(f, u) ? amt * 2 : amt); return 0; } // 뒤집힌 축복 (P-INVERT). 어둠물에 잠기면 2배 (59 3-1 발렌)
    const ab = u.debuffs.find(d => d.absorbLeft);
    if (ab) { // 치유 흡수 (P-ABSORB): 막을 먼저 깎고, 다 깎으면 막이 사라짐
      const take = Math.min(amt, ab.absorbLeft!);
      ab.absorbLeft! -= take; amt -= take;
      if (direct) emit(f, { type: 'heal', id: u.id, amt: Math.round(take), eff: 0, crit });
      if (ab.absorbLeft! <= 1e-6) { u.debuffs = u.debuffs.filter(x => x !== ab); emit(f, { type: 'cure', id: u.id, name: ab.name }); }
      if (amt <= 1e-9) return 0;
    }
  }
  if (f.zones.length && submerged(f, u)) amt *= 1 - TIDE_CUT; // 어둠물 밀물 (P-TIDE, 59 5장): 잠긴 사람은 받는 치유 절반 (지속 힐 · 광역 힐도)
  if (f.watch && f.t >= f.watch.until) f.watch.fill += amt * f.watch.rate; // 주시 (P-AGGRO): 넘친 치유까지 게이지에
  if (f.thr) healThreat(f, amt); // 어그로 (96): 넘친 치유까지 위협 (주시가 있는 보스는 주시만)
  const hp0 = u.hp, eff = Math.max(0, Math.min(amt, healTop(u) - u.hp)); // 치유 상한 (P-CAP): 상한 위는 넘친 치유
  u.hp += eff;
  u.got += eff;
  f.stats.healed += eff;
  f.stats.overheal += amt - eff;
  if (amt - eff > 1e-9) { // 넘치는 빛 (P-OVER): 그릇에 모이고, 과부하 표식이면 이웃이 아픔
    let over = amt - eff;
    const o0 = over, bowl = sv(f, 'moonBowl');
    if (u.debuffs.length) over = payDebt(f, u, over, direct); // 빌린 생명 (P-DEBT, 59 5장): 넘친 치유는 빚부터 갚고 남는 몫만 그릇에
    if (bowl && o0 > over && f.vessel && f.t < f.vessel.until) f.vessel.fill += (o0 - over) / 2; // 검은물결의 달빛 그릇 (59 6장): 빚을 갚은 몫도 절반
    if (over > 1e-9) {
      if (f.vessel && f.t < f.vessel.until) f.vessel.fill += over * (1 + sv(f, 'breathFlask') + bowl); // 후우의 숨결 병 (56 6장) · 달빛 그릇
      if (u.debuffs.length) overload(f, u, over);
    }
  }
  if (direct) {
    emit(f, { type: 'heal', id: u.id, amt: Math.round(amt), eff: Math.round(eff), crit });
    u.lastHeal = f.t;
    if (f.envy) persHealed(f, u); // 샘쟁이 (95)
    if (u.sulking) u.sulking = false;
    if (u.p.thanks) { u.thanks = 3; if (f.rng() < 0.35) bark(f, u, null, false, 'thanks'); }
  } else if (flowing) { const w = (u.flow ??= { amt: 0, eff: 0, t0: f.t }); w.amt += amt; w.eff += eff; }
  else if (eff >= 0.5) emit(f, { type: 'tick', id: u.id, amt: Math.round(amt), eff: Math.round(eff), crit }); // 지속 · 간접 회복도 숫자 (2026-10-16 Lim 「비구름 회복량이 안 보임」)
  if (f.sp && !raw) afterHeal(f, u, amt, eff, crit, direct, hp0);
  return eff;
}

/** 흐르는 회복 숫자를 모으는 시간 (초): 틱 (0.05초)마다 숫자가 뜨면 못 읽음 */
export const FLOW_SEC = 1;
let flowing = false;
/** 초마다 조금씩 차는 회복 (성역 · 메아리 · 쉼터 · 모이는 안개, amt = 이번 틱 몫): 회복은 그대로, 숫자는 FLOW_SEC씩 모아 tick 사건 하나로 */
export function healFlow(f: Fight, u: Unit, amt: number): number {
  const was = flowing;
  flowing = true;
  try { return heal(f, u, amt, false); } finally { flowing = was; }
}
let dripping = false;
/** 틱마다 조금씩 드는 피해 (장판 · 지속 피해 · 쥐 떼 · 줄 피해, amt = 이번 틱 몫): 피해는 그대로, 숫자는 FLOW_SEC씩 모아 dmg 사건 하나로 */
export function dripDamage(f: Fight, u: Unit, amt: number, magic = false, aim: DamageAim = 'party'): void {
  const was = dripping;
  dripping = true;
  try { damage(f, u, amt, magic, aim); } finally { dripping = was; }
}
/** 모아 둔 틱 피해를 숫자 하나로 (파티원 한 틱에서 · 쓰러질 때는 바로) */
export function dripTick(f: Fight, u: Unit, now = false): void {
  const w = u.drip!;
  if (!now && f.t - w.t0 < FLOW_SEC - 1e-9) return;
  u.drip = undefined;
  if (w.amt >= 0.5) emit(f, { type: 'dmg', id: u.id, amt: Math.round(w.amt) });
}

/** 모아 둔 흐르는 회복을 숫자 하나로 (파티원 한 틱에서) */
export function flowTick(f: Fight, u: Unit): void {
  const w = u.flow!;
  if (f.t - w.t0 < FLOW_SEC - 1e-9) return;
  u.flow = undefined;
  if (w.eff >= 0.5) emit(f, { type: 'tick', id: u.id, amt: Math.round(w.amt), eff: Math.round(w.eff), crit: false });
}

/** 요정 고리 (P-GROW, 48 5장): 고리 안에 선 사람이 치유를 받으면 한 겹 자람 (둘레 1칸씩, every초에 한 번, 최대 max겹) */
function ringFeed(f: Fight, u: Unit): void {
  for (const z of f.zones) {
    const r = z.ring;
    if (!r || r.n >= r.max || !z.cells.has(u.cell) || f.t + 1e-9 < r.at + r.every) continue;
    r.n++; r.at = f.t;
    const c0 = f.cells[r.center];
    z.cells = new Set(f.cells.filter(c => c.block !== 'hole' && hexDist(c, c0) <= r.n).map(c => c.i));
    emit(f, { type: 'fx', name: 'ring-grow', cell: r.center });
    emit(f, { type: 'msg', text: `${r.name}: ${u.nick}이(가) 안에서 치유를 받아 한 겹 자람 (${r.n}겹)` });
  }
}

/** 어둠물 밀물 (P-TIDE, 59 5장): 잠긴 칸에 선 사람이 받는 치유가 줄어드는 비율 */
export const TIDE_CUT = 0.5;
/** 어둠물에 잠긴 칸에 서 있음 (움직이는 중이면 떠난 칸 기준) */
export const submerged = (f: Fight, u: Unit): boolean => f.zones.some(z => z.tide && z.cells.has(u.cell));

/** 빌린 생명 (P-DEBT, 59 5장): 체력을 가득 채우고 채운 만큼 (최소 최대 체력 × min)이 빚. 이미 빚이 있으면 그 빚에 더하고 시간은 처음부터 */
export function lend(f: Fight, u: Unit, d: Debuff): Debuff {
  const add = Math.max(u.max - u.hp, d.debt!.min * u.max);
  u.hp = Math.max(u.hp, u.max);
  const old = u.debuffs.find(x => x !== d && x.debt && x.name === d.name);
  if (old) { old.debtLeft = (old.debtLeft ?? 0) + add; old.left = d.left; u.debuffs = u.debuffs.filter(x => x !== d); }
  else d.debtLeft = add;
  emit(f, { type: 'fx', name: 'debt-lend', on: u.id });
  return old ?? d;
}

/** 넘친 치유가 빚을 갚음 (P-DEBT). 다 갚으면 디버프가 사라짐. 남는 넘친 치유를 돌려줌 */
function payDebt(f: Fight, u: Unit, over: number, direct: boolean): number {
  const d = u.debuffs.find(x => (x.debtLeft ?? 0) > 1e-6);
  if (!d) return over;
  const mult = 1 + sv(f, 'debtLantern'); // 꺼지지 않는 등불 (59 6장): 빚을 갚을 때 1.2배
  const pay = Math.min(over * mult, d.debtLeft!);
  d.debtLeft! -= pay;
  if (direct) emit(f, { type: 'fx', name: 'debt-pay', on: u.id });
  if (d.debtLeft! <= 1e-6) {
    u.debuffs = u.debuffs.filter(x => x !== d);
    emit(f, { type: 'cure', id: u.id, name: d.name });
    emit(f, { type: 'msg', text: `${d.name}: ${u.nick}의 빚을 다 갚음` });
    if (f.sp) specDebtPaid(f, u); // 마지막 그림자의 저울
  }
  return over - pay / mult;
}

/** 빌린 생명 시간 끝 (또는 터지는 덫과 함께): 남은 빚만큼 피해 (고정) */
export function collectDebt(f: Fight, u: Unit, d: Debuff): void {
  const left = d.debtLeft ?? 0;
  d.debtLeft = 0;
  if (left <= 1e-6 || !u.alive) return;
  emit(f, { type: 'fx', name: 'debt-collect', on: u.id });
  emit(f, { type: 'msg', text: `${d.name}: ${u.nick}에게서 남은 빚 ${Math.round(left)}을 거둬 감` });
  damage(f, u, left / f.dmgMult, false, 'fixed');
}

/** 빚이 터지는 덫: 빌린 생명이 같이 걸려 있으면 남은 빚을 지금 거둬 감 */
function burstDebt(f: Fight, u: Unit): void {
  const d = u.debuffs.find(x => (x.debtLeft ?? 0) > 1e-6);
  if (!d) return;
  u.debuffs = u.debuffs.filter(x => x !== d);
  collectDebt(f, u, d);
}

/** 치유로 채울 수 있는 끝: 최대 체력, 치유 상한 (P-CAP)이 걸려 있으면 최대 체력 × cap (여럿이면 가장 낮은 것) */
export function healTop(u: Unit): number {
  let top = u.max;
  if (u.debuffs.length) for (const d of u.debuffs) if (d.cap != null) top = Math.min(top, u.max * d.cap);
  return top;
}

/** 띄워 올리기 (P-LIFT, 56 5장): 떠 있는 사람에게 이미 붙어 있던 것 (지속 힐 · 지속 피해 디버프)이 도는 중 */
let lingering = false;
export function linger<T>(fn: () => T): T {
  const was = lingering;
  lingering = true;
  try { return fn(); } finally { lingering = was; }
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
  const near = living(f).filter(v => v !== u && hexDist(cellOf(f, v), c) === 1);
  if (near.length) emit(f, { type: 'fx', name: 'overflow', on: u.id });
  for (const v of near) damage(f, v, (over * d.over!) / f.dmgMult, true, 'fixed');
}

/** 뒤집힌 축복 (P-INVERT, 35 4-3): 들어올 치유량만큼 피해. 보호막·피해 감소·보호의 손(물리 취급)은 통함 */
function invertHeal(f: Fight, u: Unit, amt: number): void {
  amt *= 1 - sv(f, 'clearEye'); // 맑은 눈 (42 기믹 01)
  if (amt <= 0) return;
  f.stats.inverted = (f.stats.inverted ?? 0) + amt;
  emit(f, { type: 'hurt', id: u.id, amt: Math.round(amt) });
  damage(f, u, amt / f.dmgMult, false, 'fixed');
}

/** 받은 피해 기록 칸 (초) · 칸 수 (15초, 79 4-2 별의 기억 · 82 모으기: 별 5개 × 긴 기억 3초) */
export const DMG_LOG_STEP = 0.5, DMG_LOG_N = 30;
/** 받은 피해를 0.5초 칸 링버퍼에 (지난 칸은 비움) */
export function logDmg(f: Fight, u: Unit, amt: number): void {
  const k = Math.floor(f.t / DMG_LOG_STEP), log = (u.dmgLog ??= new Array<number>(DMG_LOG_N).fill(0));
  const last = u.dmgLogK ?? k;
  for (let i = Math.max(last + 1, k - DMG_LOG_N + 1); i <= k; i++) log[i % DMG_LOG_N] = 0;
  u.dmgLogK = k;
  log[k % DMG_LOG_N] += amt;
}
/** 최근 sec초 동안 받은 피해 (0.5초 칸 단위, 지금 칸 포함) */
export function recentDmg(f: Fight, u: Unit, sec: number): number {
  if (!u.dmgLog || u.dmgLogK == null) return 0;
  const k = Math.floor(f.t / DMG_LOG_STEP), n = Math.min(DMG_LOG_N, Math.round(sec / DMG_LOG_STEP));
  let sum = 0;
  for (let i = k - n + 1; i <= k; i++) if (i <= u.dmgLogK && i > u.dmgLogK - DMG_LOG_N) sum += u.dmgLog[((i % DMG_LOG_N) + DMG_LOG_N) % DMG_LOG_N];
  return sum;
}

/** 흡수 보호막이 남아 있는지 */
export const hasAbsorb = (f: Fight, u: Unit): boolean => u.mods.some(m => m.k === 'absorb' && m.until > f.t && m.v > 1e-9);

/**
 * 이 사람이 받을 양 (보스 배율 · 받는 피해 증가 · 직업군 방어력 · 위치 · 장비 · 특성 · 직업 · 보호 · 피해 감소). damage()와 강타 예고 숫자 (bossParts telDmg)가 같이 씀.
 * ahead = 맞을 때까지 남은 초: 보호 · 피해 감소는 그때도 남아 있어야 줄임 (성역은 그때도 그 칸이 성역이면). damage()는 0 = 지금
 */
export function takenAmt(f: Fight, u: Unit, amt: number, magic: boolean, aim: DamageAim, ahead = 0): number {
  amt *= f.dmgMult;
  if (u.debuffs.length) { const v = u.debuffs.reduce((x, d) => x + (d.vuln ?? 0) * (d.stack ?? 1), 0); if (v) amt *= 1 + v; } // 가시 · 공허 (P-SWAP)
  if (f.armor) amt *= armorFactor(u.role, aim);
  if (f.R.pos && u.role === 'ranged') amt *= posTaken(f, u); // 위치 규칙: 레이드 판 1 · 2열 원거리는 +50%
  if (f.sp) amt *= dmgSpec(f, u); // 장비 특수능력 (42 보호 · 지원 · 기믹)
  if (u.me && f.tx.on.firmWill) amt *= 0.8; // 굳은 의지 (06 6장)
  if (f.tx.cut) amt *= talentTaken(f, u, magic); // 드루이드 · 성기사 특성 (77)
  if (NEW_HERO(f)) amt *= heroTaken(f, u, magic); // 79 직업 (토템 · 생존기 · 특성)
  if (u.me && f.gear.endure) amt *= 1 - f.gear.endure; // 장비 인내 (34 6-4)
  if (f.sturdy) amt *= sturdyTaken(f, u); // 든든이 옆 (95)
  if (u.fm) amt *= u.fm.taken; // 방어 (97 FM)
  if (u.shield > ahead) amt *= 0.6;
  if (u.redu > ahead) amt *= 1 - u.reduCut;
  else if (ahead > 0 && f.sanctuary && f.sanctuary.end > f.t + ahead && f.sanctuary.cells.has(u.cell)) amt *= 1 - SANCTUARY.cut; // 성역은 서 있는 동안 틱마다 다시 걸림
  return amt;
}

/**
 * 피해. magic = 보스 광역·장판·지속 피해 (평타·버스터·적 근접은 물리, 17 수호기사).
 * aim = 수치를 누구 기준으로 적었나 (data/armor.ts). 직업군 방어력은 둘 다 줄이고, fixed는 무시 (34 9-3)
 */
export function damage(f: Fight, u: Unit, amt: number, magic = false, aim: DamageAim = 'party'): void {
  if (!u.alive || amt <= 0) return;
  if (u.lift && !sharing && !lingering) return; // 띄워 올리기 (P-LIFT): 보스 기술 · 장판은 안 닿고 지속 피해 · 나눔 사슬 몫만
  if (u.sleep != null && u.sleep > f.t) return; // 점성술사 별의 잠 (79 4-2): 피해 없음
  if (f.links.length && !sharing) { // 생명 사슬 나눔형: 맞은 사람 방어력으로 줄인 뒤 반씩 「고정」으로 (34 9-3, 탱커 버스터가 사슬 건너 딜러에게 그대로 가지 않게)
    const o = shareWith(f, u);
    if (o) { const half = (amt * (f.armor ? armorFactor(u.role, aim) : 1)) / 2; shared(() => { damage(f, u, half, magic, 'fixed'); damage(f, o, half, magic, 'fixed'); }); return; }
  }
  amt = takenAmt(f, u, amt, magic, aim);
  if (f.abOn || u.mods.length) { // 파티원 능력 (17) · 특수능력 보호막 · 피해 감소 (42)
    const had = !!f.sp?.v.warmPebble && hasAbsorb(f, u);
    amt = dmgMods(f, u, amt, magic);
    if (had && !hasAbsorb(f, u)) shieldGone(f, u); // 따끈한 조약돌 (51 6장)
    if (amt < 0) return;
  }
  if (u.immune > 0 && !magic) return; // 보호의 손: 물리 피해 무시 (25 성기사)
  if (u.sacr > 0 && f.me.alive && f.me !== u) { // 희생: 받는 피해의 30%를 내가 대신. 기도하는 희생 (42 성기 08): 몫 +, 내가 받는 것 −20%
    const pray = sv(f, 'prayingSacrifice');
    const part = amt * (SACRIFICE_CUT + pray);
    amt -= part;
    damage(f, f.me, (part * (pray ? 0.8 : 1)) / f.dmgMult, magic, 'fixed');
  }
  if (u.coverBy) { // 영웅이 대신 맞아 줌 (75)
    const c = coverPart(f, u, amt);
    if (c) { amt -= c.part; damage(f, c.by, c.part / f.dmgMult, magic, 'fixed'); }
  }
  // 은혜 갚기 (06 6장): 내가 죽을 피해를 이번 전투에서 내 치유가 크게 도운 파티원 (체력 50% 이상)이 한 번 대신 맞아 줌
  if (u.me && f.tx.on.repay && !f.tx.repayUsed && u.guardian <= 0 && u.hp - amt <= 0) {
    const total = f.party.reduce((t, x) => t + (x.me ? 0 : x.got), 0);
    const v = living(f).filter(x => !x.me && x.hp >= x.max * 0.5).sort((a, b) => healingShareScore(b.role, b.got, total, f.party.length) - healingShareScore(a.role, a.got, total, f.party.length) || b.hp / b.max - a.hp / a.max)[0];
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
  if (u.low == null || u.hp / u.max < u.low) { u.low = Math.max(0, u.hp / u.max); } // 성장 행동 판단에 쓸 최저 체력
  if (f.thr) takenThreat(f, amt); // 어그로 (96): 내 위협 = 치유 ÷ 받은 피해
  if (dripping) { const w = (u.drip ??= { amt: 0, t0: f.t }); w.amt += amt; } // 피해 숫자 (화면 빨간 숫자): 틱 피해는 모아서
  else if (amt >= 0.5) emit(f, { type: 'dmg', id: u.id, amt: Math.round(amt) });
  if (f.hero === 'astrologer') logDmg(f, u, amt); // 별의 기억 (79 4-2): 보호막 · 피해 감소 뒤 실제로 받은 피해
  if (u.ps) persHurt(f, u, amt); // 몰입형 · 완벽주의자 (75)
  if (f.sp) afterHurt(f, u, u.hp + amt);
  if (amt > 0 && f.relay && f.relay.id === u.id) relayHurt(f, u); // 사제 빛의 전이: 회복하고 옮겨 감 (보호막이 다 막으면 그대로)
  if (amt > u.max * 0.15) u.flash = 0.35;
  if (u.hp > 0 && u.wob != null && !u.me && !dripping && amt >= STAT_ACT.bigHit * u.max) bigHit(f, u); // 99 맷집: 휘청 · 버팀
  if (u.hp <= 0) {
    if (u.guardian > 0) {
      u.guardian = 0;
      u.hp = u.max * 0.4;
      emit(f, { type: 'sound', name: 'chime' });
      emit(f, { type: 'msg', text: `수호 영혼이 ${u.nick}을(를) 살림` });
      if (sv(f, 'wakeGuard')) heal(f, u, intAmt(f, sv(f, 'wakeGuard')), true, true); // 깨어 있는 수호 (42 사제 06)
      return;
    }
    if (f.sp && lastBreath(f, u)) return; // 마지막 숨 (42 보호 06)
    if (NEW_HERO(f) && heroLethal(f, u, amt)) return; // 79 직업 (나를 지키는 샘 …)
    // 쓰러지면 칸을 비운다 → 다른 파티원이 그 칸으로 이동할 수 있음 (2026-10-07 Lim)
    if (u.moving) { const to = f.cells[u.moving.to]; if (to.unit === u) to.unit = null; }
    { const here = f.cells[u.cell]; if (here.unit === u) here.unit = null; }
    if (u.drip) dripTick(f, u, true); // 쓰러지기 전 모아 둔 틱 피해
    u.alive = false; u.hp = 0; u.debuffs = []; u.hot = 0; u.hots = []; u.echo = []; u.flow = undefined; u.moving = null; u.react = null; u.shield = 0; u.redu = 0; u.sacr = 0; u.immune = 0; u.diedAt = f.t;
    if (u.mods.length) { u.mods = []; u.max = u.base; }
    if (u.max < u.base) u.max = u.base;
    f.stats.deaths++;
    if (!u.me && f.tx.on.grief) f.tx.griefUntil = f.t + 5; // 슬픔의 힘
    if (!u.me && f.tx.death) talentDeath(f, u); // 남은 꽃 · 순교의 빛 (77)
    if (!u.me && f.sp) specDeath(f); // 굳센 결의 · 되감기 (42)
    if (f.persOn) persDeath(f, u); // 다혈질 (75)
    emit(f, { type: 'death', id: u.id });
    emit(f, { type: 'sound', name: 'death' });
  }
}

/** 99 맷집: 큰 한 방 뒤. 15 밑은 서툼만큼 「휘청」 (공격 · 새 이동 · 판단 멈춤), 15 넘으면 잘함만큼 「버팀」 (칸 위 글) */
function bigHit(f: Fight, u: Unit): void {
  const tough = u.fmStats?.tough ?? 10;
  if (u.staggerUntil != null && f.t < u.staggerUntil) return;
  if (f.rng() < STAT_ACT.stagger * clumsy(tough)) {
    u.staggerUntil = f.t + STAT_ACT.staggerSec;
    emit(f, { type: 'stagger', id: u.id });
    if (f.rng() < 0.4) bark(f, u, null, false, 'reel');
  } else if (sharp(tough) > 0 && f.rng() < sharp(tough)) {
    u.steadyAt = f.t;
    emit(f, { type: 'stagger', id: u.id, steady: true });
  }
}
/** 99 맷집: 지금 휘청하는 중 */
export const staggered = (f: Fight, u: Unit): boolean => u.staggerUntil != null && f.t < u.staggerUntil;

export function addDebuff(f: Fight, u: Unit, d: Omit<Debuff, 'id'>): Debuff {
  const o: Debuff = { id: f.nextId++, ...d };
  if (u.mods.length && blocksDebuff(f, u, o.type)) return o; // 주문 반사·그림자 망토: 안 걸림
  if (f.sp) { // 면역 향 · 줄어드는 독기 (42 해제 04 · 05)
    if (immune(f, u, o.name)) return o;
    if (!o.lock && !o.trap && HEROES[f.hero].dispel.includes(o.type)) o.left *= debuffSec(f, true);
  }
  u.debuffs.push(o);
  if (u.ps) persDebuff(f, u); // 소심이 (75)
  if (HEROES[f.hero].dispel.includes(o.type) && !o.trap) f.stats.dispellable++;
  emit(f, { type: 'debuff', id: u.id, dtype: o.type });
  if (o.charm) emit(f, { type: 'fx', name: 'hearts', on: u.id });
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
  if (dispelled && u.ps) persDispel(f, u); // 예민형 (95)
  if (f.sp) specDebuffEnd(f, u, d); // 금빛수염 단추
  if (f.sp && dispelled && d.trap) { during(f, 'trap', () => { if (f.aff) affDebuffEnd(f, u, d, dispelled); if (d.end) debuffEnd(f, u, d, dispelled); }); return; } // 함정 감지 (42 해제 06)
  if (f.aff) affDebuffEnd(f, u, d, dispelled); // 어픽스 불안정·메아리
  if (d.end) debuffEnd(f, u, d, dispelled);
  if (d.end && 'debt' in d.end && d.end.debt) burstDebt(f, u); // 빚이 터지는 덫 (59 4-1 밤그늘): 덫이 터질 때 남은 빚도 함께
  if (f.sp && d.end?.p === 'flip' && !dispelled) specFlip(f, u); // 뒤죽박죽 졸업장
  if (d.debtLeft) collectDebt(f, u, d); // 빌린 생명 (P-DEBT): 시간이 다 되면 남은 빚
}

/** 보스가 주는 피해 +boost (걸어오는 쫄 흡수 · 옮겨붙음 시간 끝). 겹치면 더함 (+10% · +20% …), 체력바에 「강해짐」 */
export function empowerBoss(f: Fight, boost: number, why: string): void {
  f.dmgMult *= (1 + f.empower + boost) / (1 + f.empower);
  f.empower += boost;
  emit(f, { type: 'sound', name: 'aoe' });
  emit(f, { type: 'fx', name: 'rage' });
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
    case 'blast': {
      // 불안정한 마력 · 서리 표식 (P-TRAP): 두든 지우든 이웃 칸이 터짐. 지우면 바로
      const c = cellOf(f, u);
      emit(f, { type: 'sound', name: 'burst' });
      for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) === 1) damage(f, v, e.dmg, true);
      emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 이웃 칸이 터짐` });
      return;
    }
    case 'trapHit': {
      // 가문의 반지 (P-TRAP, 35 4-3): 두면 그 사람만, 지우면 이웃 칸이 터짐
      if (!dispelled) { damage(f, u, e.dmg, true); emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 시간 끝` }); return; }
      const c = cellOf(f, u);
      emit(f, { type: 'sound', name: 'burst' });
      for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) === 1) damage(f, v, e.burst, true);
      emit(f, { type: 'msg', text: `${d.name}: 지워서 이웃 칸이 터짐` });
      return;
    }
    case 'trapLoan': {
      // 그림자 덫 (59 3-2 마지막 그림자): 두면 그 사람만, 지우면 터지는 대신 이웃 칸 아군 n명에게 빌린 생명
      if (!dispelled) { damage(f, u, e.dmg, true); emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 시간 끝` }); return; }
      const c = cellOf(f, u), near = living(f).filter(v => v !== u && !v.lift && hexDist(cellOf(f, v), c) === 1);
      for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(f.rng() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
      const got = near.slice(0, e.n);
      for (const v of got) { const x = addDebuff(f, v, { ...e.loan }); if (v.debuffs.includes(x)) lend(f, v, x); }
      emit(f, { type: 'msg', text: got.length ? `${d.name}: 지워서 ${got.map(v => v.nick).join(' · ')}에게 빚` : `${d.name}: 지움 (옆에 아무도 없음)` });
      return;
    }
    case 'jump': {
      // 옮겨붙음 (P-JUMP): 지우면 이웃 칸 1명에게 더 세게, 혼자면 사라짐. 시간이 다 되면 보스가 강해짐. 약한 판 (진동에 옮김)은 그냥 사라짐
      if (e.on === 'quake') return;
      if (!dispelled) { if (e.boost) empowerBoss(f, e.boost, `${d.name} 시간 끝`); return; } // boost 0 = 버티면 그냥 사라짐 (거울 저주)
      const c = cellOf(f, u);
      const near = living(f).filter(v => v !== u && hexDist(cellOf(f, v), c) === 1);
      if (!near.length) { emit(f, { type: 'msg', text: `${d.name}: 옆에 아무도 없어 사라짐` }); return; }
      const v = near[Math.floor(f.rng() * near.length)];
      const { id: _id, ...rest } = d;
      addDebuff(f, v, { ...rest, left: e.sec, dot: (d.dot ?? 0) * e.mult });
      emit(f, { type: 'fx', name: 'fireball-green', on: u.id, to: v.id });
      emit(f, { type: 'msg', text: `${d.name}이(가) ${v.nick}에게 옮겨붙음` });
      if (f.sp) specJump(f, v); // 녹슨 수문 열쇠
      return;
    }
    case 'pop': {
      // 부풀기 (P-SWELL, 46 5장): 지우면 이웃 칸만 중첩 × pop, 두면 본인 중첩 × self + 이웃 칸 중첩 × near
      const n = d.stack ?? 1, c = cellOf(f, u);
      const near = living(f).filter(v => v !== u && hexDist(cellOf(f, v), c) === 1);
      emit(f, { type: 'sound', name: 'burst' });
      emit(f, { type: 'fx', name: dispelled ? 'swell-pop' : 'explode', on: u.id }); // 지우면 퐁 (37 G), 두면 펑 (37 F)
      for (const v of near) damage(f, v, (dispelled ? e.pop : e.near) * n, true);
      if (!dispelled) damage(f, u, e.self * n, true);
      emit(f, { type: 'msg', text: dispelled ? `${d.name} ${n}중첩: 지워서 이웃 칸이 터짐` : `${d.name} ${n}중첩: ${u.nick} 터짐` });
      return;
    }
    case 'flip': {
      // 뒤집힘 저주 (P-FLIP, 46 5장): 두면 체력 비율이 뒤집힘 (가장 낮아도 min). 지우면 그냥 사라짐
      if (dispelled || !u.alive) return;
      const r = Math.max(e.min ?? 0.05, 1 - u.hp / u.max);
      u.hp = u.max * r;
      emit(f, { type: 'fx', name: 'coin-flip', on: u.id });
      emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 체력 ${Math.round(r * 100)}%로 뒤집힘` });
      return;
    }
    case 'pass': {
      // 넘어가는 포자 (P-PASS, 48 5장): 지우면 남은 막이 체력 비율이 가장 높은 다른 아군에게 (시간 처음부터), 두면 남은 막만큼 피해
      const left = d.absorbLeft ?? 0;
      if (left <= 1e-6) return;
      if (!dispelled) {
        emit(f, { type: 'fx', name: 'splash', on: u.id });
        emit(f, { type: 'msg', text: `${d.name}: ${u.nick} 시간 끝, 남은 막만큼 피해` });
        damage(f, u, left / f.dmgMult, true);
        return;
      }
      const v = living(f).filter(x => x !== u && !x.debuffs.some(y => y.name === d.name)).sort((a, b) => b.hp / b.max - a.hp / a.max)[0];
      if (!v) { emit(f, { type: 'msg', text: `${d.name}: 넘어갈 사람이 없어 사라짐` }); return; }
      const { id: _id, ...rest } = d;
      addDebuff(f, v, { ...rest, left: e.sec, absorbLeft: left });
      emit(f, { type: 'fx', name: 'spore-pass', on: u.id, to: v.id });
      emit(f, { type: 'msg', text: `${d.name}이(가) ${v.nick}에게 넘어감` });
      return;
    }
    case 'stackHit': {
      // 마력 역류 (P-RECOIL): 끝나도 지워도 그때까지 중첩만큼
      const n = d.stack ?? 0;
      if (n <= 0) return;
      damage(f, u, e.dmg * n, true);
      emit(f, { type: 'sound', name: 'burst' });
      emit(f, { type: 'fx', name: 'recoil', on: u.id });
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
