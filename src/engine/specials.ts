/**
 * 장비 특수능력 엔진 (42). 데이터 (값 · 글)는 data/specials.ts, 전투에 넘길 값은 cfg.specs (specTotals로 더한 것).
 * 특수능력이 하나도 없으면 f.sp = null이고 이 파일의 훅은 아무것도 바꾸지 않는다 (난수도 안 씀 → 옛 결과 그대로).
 * 훅 자리: 치유 배율 · 치유 뒤 (core heal) · 받는 피해 · 쓰러짐 (core damage) · 시전 (healer exec · apply) ·
 * 마나 소모 · 시전 시간 · 재사용 대기 (talents) · 해제 · 부활 · 보스 예고 · 페이즈 · 끊기 · 한 틱 (healerTick)
 */
import { INT_BASE } from '../data/rules';
import { namedOf, SPECS } from '../data/specials';
import { SKILLS, type SkillKey, type SlotName } from '../data/skills';
import { hexDist } from './board';
import { addMod } from './abilities';
import { cellOf, emit, heal, living, onDebuffEnd, submerged } from './core';
import type { Debuff, Fight, Telegraph, Unit } from './types';

/** 전투 중 특수능력 상태 */
export interface SpecRun {
  /** 켜진 값 (key → 값) */
  v: Record<string, number>;
  /** 잠깐 켜진 효과의 끝 시각 */
  until: Record<string, number>;
  /** 발동 효과가 다시 켜질 수 있는 시각 (재사용 대기) */
  ready: Record<string, number>;
  /** 전투당 횟수 */
  used: Record<string, number>;
  /** 마지막 한 대상 직접 힐 대상 (단골 손님 · 고루고루) */
  last: number | null;
  /** 이어 쓴 서로 다른 스킬 (별자리) */
  chain: SkillKey[];
  /** 이어 쓴 즉시 시전 스킬 수 (바람 탄 발걸음) · 다음 시전 힐 즉시 */
  inst: number;
  free: boolean;
  /** 직접 힐 시전 수 · 다음 힐 + (꿀벌의 춤) */
  bee: number;
  beeOn: boolean;
  /** 쉬지 않고 시전한 시간 (바쁜 손) */
  busy: number;
  /** 대상마다 깃털 이불을 다시 쓸 수 있는 시각 */
  quilt: Record<number, number>;
  /** 해제한 디버프에 안 걸림 (면역 향) */
  imm: { id: number; name: string; until: number }[];
  /** n초 뒤 같은 자리 광역 힐 (금빛 메아리 · 기원의 메아리) */
  later: { at: number; cell: number; amt: number; r: number }[];
  /** 지금 들어가는 피해가 함정 터짐 (함정 감지) · 폭탄 (폭탄 해체반) */
  trap: boolean;
  bomb: boolean;
  /** 최근 4초 직접 힐 대상 (백합 코사지) · 다음 직접 힐 마나 0 */
  near: { id: number; t: number }[];
  lilyFree: boolean;
  /** 바로 앞에 해제한 유형 (닳은 묵주) */
  dtype: string | null;
  /** 아군마다 최근 2초 잃은 체력 (밧줄 매듭) */
  hurt: Record<number, { t: number; d: number }[]>;
  /** 디버프가 끝나거나 지워진 아군 (금빛수염 단추: 다음 직접 힐 +) */
  button: Record<number, true>;
}

export function newSpecs(v: Record<string, number> | undefined): SpecRun | null {
  if (!v) return null;
  const on: Record<string, number> = {};
  for (const k in v) if (v[k] > 0) on[k] = v[k];
  if (!Object.keys(on).length) return null;
  return { v: on, until: {}, ready: {}, used: {}, last: null, chain: [], inst: 0, free: false, bee: 0, beeOn: false, busy: 0, quilt: {}, imm: [], later: [], trap: false, bomb: false, near: [], lilyFree: false, dtype: null, hurt: {}, button: {} };
}

/** 켜진 값 (없으면 0) */
export const sv = (f: Fight, k: string): number => (f.sp ? f.sp.v[k] ?? 0 : 0);
const on = (f: Fight, k: string): boolean => (f.sp!.until[k] ?? -1) > f.t;
/** 특수능력 이름 (칸 위 금색 글자) */
const nameOf = (k: string): string => SPECS[k]?.name ?? namedOf(k)?.name ?? k;
/** 특수능력이 켜졌다고 칸 위에 이름 (u 없으면 나) */
export const shout = (f: Fight, k: string, u: Unit = f.me): void => { emit(f, { type: 'spec', id: u.id, name: nameOf(k) }); };
/** 지능 n배 회복량 · 보호막 (스킬 회복량 기준 INT_BASE, 장비 지능 · 레벨 배율까지) */
export const intAmt = (f: Fight, x: number): number => x * INT_BASE * f.gear.heal * f.power;

/**
 * 재사용 대기가 있는 발동: 준비됐으면 sec초 켜고 대기를 건다. chance가 있으면 그 확률로 (특수능력이 있을 때만 난수를 씀)
 */
function proc(f: Fight, k: string, sec: number, cd: number, chance = 1): boolean {
  const s = f.sp!;
  if (!s.v[k] || (s.ready[k] ?? 0) > f.t + 1e-9) return false;
  if (chance < 1 && f.rng() >= chance) return false;
  s.until[k] = f.t + sec;
  s.ready[k] = f.t + cd;
  shout(f, k);
  return true;
}

// ---------- 치유 문맥 ----------
/** 지금 나가는 치유가 어느 스킬에서 왔나. key = null이면 스킬 밖 (메아리 · 아이템 등) */
export const hc = { key: null as SkillKey | null, tick: false, n: 0, same: null as boolean | null, bee: false, crit: false };

/** key 스킬의 치유로 fn을 돌림 (지속 힐 틱 · 공대 쿨기 틱) */
export function under<T>(key: SkillKey | null, tick: boolean, fn: () => T): T {
  const o = { ...hc };
  hc.key = key; hc.tick = tick; hc.n = 0; hc.same = null; hc.bee = false; hc.crit = false;
  try { return fn(); } finally { Object.assign(hc, o); }
}

const SINGLE = new Set<SlotName>(['basic', 'fast', 'hot']);
const HEAL_SLOT = new Set<SlotName>(['basic', 'fast', 'hot', 'aoe']);
const baseCast = (f: Fight, k: SkillKey): number => f.R.cast?.[k] ?? SKILLS[k].cast;
const isSingle = (k: SkillKey | null): boolean => !!k && SINGLE.has(SKILLS[k].slot) && SKILLS[k].target === 'ally';
const hasHot = (u: Unit): boolean => u.hots.length > 0 || u.hot > 0;
const bossPct = (f: Fight): number => (f.bossMax > 0 ? f.bossHp / f.bossMax : 1);
/** 보물 욕심 예고가 노린 사람이거나, 사냥 예고 중에 지금 맞을 사람 (체력 비율이 가장 낮은 탱커 아닌 사람) */
const aimedAt = (f: Fight, u: Unit): boolean => f.tels.some(t => (t.skill.greed != null && t.units.includes(u.id))
  || (!!t.skill.hunt && u.role !== 'tank' && living(f).every(x => x.role === 'tank' || x.hp / x.max >= u.hp / u.max - 1e-9)));

/** 치유 배율 (core heal, 장비 · 레벨 배율 다음 · 치명타 전). 조건이 맞는 것을 더한다 */
export function healSpec(f: Fight, u: Unit, direct: boolean): number {
  const v = f.sp!.v, k = hc.key, sk = k ? SKILLS[k] : null;
  const tick = hc.tick, single = direct && !tick && isSingle(k), aoe = !!sk && sk.slot === 'aoe';
  const pct = u.hp / u.max;
  let m = 0;
  if (single) {
    m += v.warmTouch ?? 0;
    if (hc.same === true) m += v.regular ?? 0;
    if (hc.same === false) m += v.evenly ?? 0;
    if (hasHot(u)) m += v.layer ?? 0;
  }
  if (aoe) { m += v.wideEmbrace ?? 0; if (hc.n >= 4) m += v.bigBowl ?? 0; }
  if (tick) m += v.lingerLight ?? 0;
  if (sk && sk.slot === 'raid') m += v.strongChorus ?? 0;
  if (direct && !tick) {
    if (pct < 0.35) m += v.edgeTouch ?? 0;
    if (pct < 0.3) m += v.ladyPortrait ?? 0;
    if (f.t - u.lastHeal >= 10) m += v.calmRipple ?? 0;
    if (k && HEAL_SLOT.has(sk!.slot)) {
      const c = baseCast(f, k);
      if (c >= 2) m += v.slowHand ?? 0;
      if (c === 0) m += v.quickAid ?? 0;
    }
  }
  if (u.role === 'tank') {
    m += v.shieldFriend ?? 0;
    if (v.braveSong && on(f, 'braveSong')) m += v.braveSong;
    if (v.scrapWhistle && on(f, 'scrapWhistle')) m += v.scrapWhistle;
  }
  if (v.blackStone && alone(f, u)) m += v.blackStone;
  if (v.lordIncense && u.debuffs.filter(d => !d.hide).length >= 2) m += v.lordIncense;
  if (v.heirSeal && u.debuffs.some(d => d.link)) m += v.heirSeal; // 가주의 인장 (46 6장)
  if (v.roseBrooch && on(f, 'roseBrooch')) m += v.roseBrooch;
  if (v.luckyCoin && direct && !tick && pct >= 0.4 - 1e-9 && pct <= 0.6 + 1e-9) m += v.luckyCoin; // 앞면 금화 (46 6장)
  if (v.lighthouseEmber && aoe && f.tels.some(t => t.kind === 'aoe' || t.kind === 'buster')) m += v.lighthouseEmber; // 등대 불씨
  if (v.sailorCompass && u.debuffs.some(d => d.cap != null || (d.healCut ?? 0) > 0)) m += v.sailorCompass; // 선원의 나침반
  if (v.goldButton && direct && !tick && f.sp!.button[u.id]) { m += v.goldButton; delete f.sp!.button[u.id]; } // 금빛수염 단추
  if (v.chippedCup && u.debuffs.some(d => d.absorbLeft)) m += v.chippedCup; // 이 빠진 찻잔 (48 6장)
  if (v.dragonScale && u.debuffs.some(d => d.type === '독')) m += v.dragonScale; // 용 비늘 조각
  if (v.rubinaPearl && direct && !tick && aimedAt(f, u)) m += v.rubinaPearl; // 루비나의 진주 (51 6장)
  if (v.lakePebble && u.debuffs.some(d => d.link)) m += v.lakePebble; // 호숫가 조약돌
  if (v.threeShards && u.soul) m += v.threeShards; // 세 조각 목걸이
  if (v.riddleNote && direct && !tick && on(f, 'riddleNote')) m += v.riddleNote; // 냥크스의 수수께끼 쪽지 (54 6장)
  if (v.jellyLight && (f.zones.some(z => z.cells.has(u.cell)) || f.tels.some(t => t.kind === 'zone' && !t.fake && t.cells.has(u.cell)))) m += v.jellyLight; // 해파리 불빛
  if (v.prayerKnot && u.debuffs.some(d => d.cureAt != null && d.cureAt >= 1)) m += v.prayerKnot; // 깊은잠의 기도 매듭
  if (v.featherBrooch && f.tels.some(t => t.skill.glass)) m += v.featherBrooch; // 사라샤의 깃털 브로치 (모래시계 뒤집기 예고 동안)
  if (v.nightcapTassel && f.tels.some(t => t.skill.safe && !t.fake && t.safe && !t.safe.has(u.cell))) m += v.nightcapTassel; // 하품호텝의 수면 모자 술 (54 6장)
  if (v.pinwheelPin && u.pulled) m += v.pinwheelPin; // 바람개비 핀
  if (v.fleeceRing && nearChain(f, u)) m += v.fleeceRing; // 복슬 양털 반지 (56 6장)
  if (v.millVane && tick && u.lift) m += v.millVane; // 풍차 날개 조각
  if (v.stormWedge && u.role === 'tank' && f.party.some(w => w !== u && w.role === 'tank' && w.alive && w.lift)) m += v.stormWedge; // 우르릉의 번개 쐐기
  if (v.festInvite && direct && !tick && u.debuffs.some(d => d.noDps)) m += v.festInvite; // 축제 초대장 (48 6장)
  if (v.wetGlove && f.zones.length && submerged(f, u)) m += v.wetGlove; // 마부의 젖은 장갑 (59 6장)
  if (v.dawnPebble && direct && u.pulsed) { m += v.dawnPebble; u.pulsed = false; } // 첫 햇살 조약돌 (59 6장): 박동에 맞은 아군에게 하는 다음 힐
  if (v.mazeMap && u.debuffs.some(d => (d.debtLeft ?? 0) > 1e-6)) m += v.mazeMap; // 밤그늘의 미궁 지도
  if (v.rainbowSpore && u.soul) m += v.rainbowSpore; // 무지개 포자
  if (v.mossBrooch && aoe && f.stagger) m += v.mossBrooch; // 이끼 브로치
  if (u.me && v.brokenChain && on(f, 'brokenChain')) m += v.brokenChain;
  if (f.t < 20) m += v.firstWord ?? 0;
  if (bossPct(f) < 0.3) m += v.secondWind ?? 0;
  if (f.mana > 90) m += v.brimming ?? 0;
  if (hc.bee) m += v.beeDance ?? 0;
  if (v.rainbow && on(f, 'rainbow')) m += v.rainbow;
  if (v.encore && on(f, 'encore')) m += v.encore;
  if (v.sunrise && on(f, 'sunrise')) m += v.sunrise;
  if (v.constellation && on(f, 'constellation')) m += v.constellation;
  if (v.warmCloak && u.debuffs.some(d => d.dot || d.grow)) m += v.warmCloak;
  if (v.shelterMap && f.tels.some(t => t.kind === 'zone' && t.cells.has(u.cell))) m += v.shelterMap;
  if (k === 'serenity') m += v.serenityEcho ?? 0;
  if (k === 'oath') m += v.firmOath ?? 0;
  return 1 + m;
}

/** 번개 구름 (연쇄 번개 예고)이 뜬 아군의 옆 칸 (복슬 양털 반지) */
function nearChain(f: Fight, u: Unit): boolean {
  const c = cellOf(f, u);
  return f.tels.some(t => t.skill.chain && t.units.some(id => id !== u.id && f.party.some(w => w.id === id && hexDist(cellOf(f, w), c) === 1)));
}

/** 옆 칸에 살아 있는 아군이 없음 (검은 돌 부적) */
function alone(f: Fight, u: Unit): boolean {
  const c = cellOf(f, u);
  return !living(f).some(x => x !== u && hexDist(cellOf(f, x), c) === 1);
}

/** 치명타 확률 + (별똥별 소원 · 신전 성수병) */
export function critBonus(f: Fight): number {
  const v = f.sp!.v;
  return (v.wishStar && on(f, 'wishStar') ? v.wishStar : 0) + (v.templeVial && on(f, 'templeVial') ? v.templeVial : 0);
}
/** 치명타 치유 배율 (기본 1.5 × 다정한 치명타) */
export const critMult = (f: Fight): number => 1.5 * (1 + sv(f, 'kindCrit'));

/** 내가 거는 보호막 (단단한 껍데기 · 코볼트 임명장 · 온천 수건). 같은 출처는 더하고 최대 체력 절반까지 */
function shield(f: Fight, u: Unit, amt: number, sec: number, src: string): void {
  if (!u.alive || amt <= 0) return;
  const sp = f.sp!.v;
  amt *= 1 + sv(f, 'hardShell')
    + (sp.koboldWarrant && u.hp >= u.max * 0.9 ? sp.koboldWarrant : 0) // 코볼트 임명장 (51 6장)
    + (sp.spaTowel && f.tels.some(t => (t.kind === 'aoe' || t.kind === 'buster') && t.impact - f.t <= 2) ? sp.spaTowel : 0); // 온천 수건
  const old = u.mods.find(m => m.k === 'absorb' && m.src === src && m.until > f.t);
  const v = Math.min(u.max * 0.5, (old ? old.v : 0) + amt);
  addMod(u, { k: 'absorb', v, until: f.t + sec, src });
  if (!old) shout(f, src, u);
}

/** 옆 칸 아군 중 체력 비율이 가장 낮은 1명 */
function lowNear(f: Fight, u: Unit): Unit | undefined {
  const c = cellOf(f, u);
  return living(f).filter(v => v !== u && v.hp < v.max && hexDist(cellOf(f, v), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
}

/** 치유가 들어간 뒤 (core heal, 배율이 다시 붙지 않는 값은 안 옴). amt = 들어온 양, eff = 실제 회복, hp0 = 들어오기 전 체력 */
export function afterHeal(f: Fight, u: Unit, amt: number, eff: number, crit: boolean, direct: boolean, hp0: number): void {
  const s = f.sp!, v = s.v, k = hc.key, over = amt - eff;
  const single = direct && !hc.tick && isSingle(k);
  if (crit) {
    hc.crit = true;
    if (v.wishStar) proc(f, 'wishStar', 6, 15);
    if (v.insight && (s.ready.insight ?? 0) <= f.t) { s.ready.insight = f.t + 1; f.mana = Math.min(100, f.mana + v.insight); }
    if (single && v.bounceLight) { const n = lowNear(f, u); if (n) { emit(f, { type: 'fx', name: 'bounce', on: u.id, to: n.id }); heal(f, n, amt * v.bounceLight, true, true); } } // 화면: 빛 구슬이 옆 칸으로 (36 J fx-bounce)
  }
  if (over > 1e-9) {
    if (v.overflowKind) {
      const n = living(f).filter(x => x !== u && x.hp < x.max).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
      if (n) heal(f, n, over * v.overflowKind, false, true);
    }
    if (direct && v.bubble) shield(f, u, over * v.bubble, 6, 'bubble');
    if (v.lightBreath && over > amt * 0.5 && (s.ready.lightBreath ?? 0) <= f.t) { s.ready.lightBreath = f.t + 2; f.mana = Math.min(100, f.mana + v.lightBreath); }
    if (v.roseBrooch && over > amt * 0.5) proc(f, 'roseBrooch', 4, 8); // 장미 브로치 (46 6장)
  }
  if (direct && !hc.tick) {
    if (v.featherQuilt && hp0 < u.max * 0.25 && (s.quilt[u.id] ?? 0) <= f.t) { s.quilt[u.id] = f.t + 20; shield(f, u, intAmt(f, v.featherQuilt), 8, 'featherQuilt'); }
    if (v.rhythm && (u.role === 'melee' || u.role === 'ranged')) addMod(u, { k: 'dps', v: v.rhythm, until: f.t + 6, src: 'rhythm' });
    if (v.holdTogether && k && SKILLS[k].slot === 'aoe') addMod(u, { k: 'mcut', v: v.holdTogether, until: f.t + 4, src: 'holdTogether' });
  }
  if (hc.tick && v.fireflies && f.rng() < 0.03) heal(f, u, intAmt(f, v.fireflies), true, true);
  if (v.leechJar && hp0 < u.max - 1e-9 && u.hp >= u.max - 1e-9) proc(f, 'leechJar', 4, 10);
}

// ---------- 시전 ----------
/** 스킬이 나갈 때 (시전 시작 · 즉시 시전). 마나를 쓴 뒤, 효과 전 */
export function specExec(f: Fight, key: SkillKey, castTime: number): void {
  const s = f.sp!, v = s.v, sk = SKILLS[key];
  if (HEAL_SLOT.has(sk.slot)) {
    if (v.sunHandful) proc(f, 'sunHandful', 8, 20, 0.08);
    if (v.rainbow) proc(f, 'rainbow', 10, 25, 0.05);
    if (v.rustyCog) proc(f, 'rustyCog', 10, 20, 0.1);
  }
  if (v.windStep) {
    if (castTime > 0) s.inst = 0;
    else if (++s.inst >= 3 && (s.ready.windStep ?? 0) <= f.t) { s.inst = 0; s.free = true; s.ready.windStep = f.t + 12; }
  }
  if (v.constellation) {
    s.chain = s.chain.includes(key) ? [key] : [...s.chain, key];
    if (s.chain.length >= 4) { s.chain = []; s.until.constellation = f.t + 6; shout(f, 'constellation'); }
  }
  if (sk.slot === 'raid') {
    if (v.encore) s.until.encore = f.t + 12;
    if (v.frozenHourglass) s.until.frozenHourglass = f.t + 15;
    if (v.starClock) cdCut(f, ['dispel', 'ext'], v.starClock);
  }
}

/** 바람 탄 발걸음: 다음 시전 힐 즉시 (시전 시간이 있는 힐 칸만) */
export const freeCast = (f: Fight, key: SkillKey): boolean => !!f.sp?.free && baseCast(f, key) > 0 && HEAL_SLOT.has(SKILLS[key].slot);

/** 그 칸 스킬들의 남은 재사용 대기 − sec초 */
function cdCut(f: Fight, slots: SlotName[], sec: number): void {
  for (const k in f.cd) if (slots.includes(SKILLS[k as SkillKey].slot)) f.cd[k as SkillKey] = Math.max(0, f.cd[k as SkillKey]! - sec);
}

/** 스킬 효과를 낼 때 (healer apply): 대상 · 꿀벌 · 단골/고루 문맥을 세우고 fn */
export function specApply(f: Fight, key: SkillKey, u: Unit, fn: () => void): void {
  const s = f.sp!, v = s.v, sk = SKILLS[key];
  under(key, false, () => {
    if (isSingle(key)) { hc.same = s.last == null ? null : s.last === u.id; s.last = u.id; if (v.lilyCorsage) lily(f, u); }
    if (v.beeDance && HEAL_SLOT.has(sk.slot)) {
      if (s.beeOn) { hc.bee = true; s.beeOn = false; }
      if (++s.bee % 5 === 0) s.beeOn = true;
    }
    fn();
  });
}

/** 백합 코사지: 4초 안에 서로 다른 3명에게 직접 힐 → 다음 직접 힐 마나 0. 공짜로 나간 힐은 세지 않고 처음부터 */
function lily(f: Fight, u: Unit): void {
  const s = f.sp!;
  if (s.lilyFree) { s.lilyFree = false; s.near = []; return; }
  s.near = s.near.filter(x => x.t > f.t - 4 - 1e-9 && x.id !== u.id);
  s.near.push({ id: u.id, t: f.t });
  if (s.near.length >= 3 && (s.ready.lilyCorsage ?? 0) <= f.t + 1e-9) { s.near = []; s.lilyFree = true; s.ready.lilyCorsage = f.t + 15; shout(f, 'lilyCorsage'); }
}

/** 광역 힐이 몇 명에게 들어가는지 (큰 그릇 · 신전 성수병). 광역 힐 칸 문맥에서 힐 전에 부름 */
export function aoeCount(f: Fight, n: number): void {
  hc.n = n;
  if (n >= 4 && f.sp!.v.templeVial) f.sp!.until.templeVial = f.t + 6;
}

/** 광역 힐이 끝나면: 치명타가 있었으면 금빛 메아리 (3초 뒤 같은 자리에 그 힐의 v) */
export function aoeDone(f: Fight, cell: number, amt: number, r: number): void {
  const v = f.sp!.v.goldEcho;
  if (v && hc.crit && hc.key) { f.sp!.later.push({ at: f.t + 3, cell, amt: amt * v, r }); shout(f, 'goldEcho'); }
}

/** n초 뒤 같은 자리 광역 힐 예약 (기원의 메아리) */
export function later(f: Fight, at: number, cell: number, amt: number, r: number): void {
  f.sp!.later.push({ at, cell, amt, r });
}

// ---------- 마나 · 시간 ----------
/** 가속 (장비 + 잠깐 켜진 발동 + 바쁜 손), 상한까지 */
export function hasteOf(f: Fight): number {
  if (!f.sp) return f.gear.haste;
  const v = f.sp.v;
  let h = f.gear.haste;
  for (const k of ['sunHandful', 'resolve', 'drumbeat', 'rustyCog', 'leechJar']) if (v[k] && on(f, k)) h += v[k];
  if (v.stillHeart && on(f, 'stillHeart') && f.t + 1e-9 >= (f.sp.until.stillHeartFrom ?? 0)) h += v.stillHeart; // 멈춘 심장 조각 (59 6장)
  if (v.busyHands) h += (v.busyHands * Math.min(5, Math.floor(f.sp.busy / 2))) / 5;
  return Math.min(f.R.hasteCap, h);
}
/** 지금 GCD */
export const gcdNow = (f: Fight): number => f.R.gcd / (1 + hasteOf(f));

/** 마나 소모 배율 (u = 대상, 알 때만) */
export function costSpec(f: Fight, key: SkillKey, u?: Unit): number {
  const v = f.sp!.v, sk = SKILLS[key];
  if (f.sp!.lilyFree && isSingle(key)) return 0;
  let cut = 0;
  if (baseCast(f, key) === 0 && !sk.channel && sk.slot !== 'raid') cut += v.pouch ?? 0;
  if (u && u.hp > u.max * 0.8 && HEAL_SLOT.has(sk.slot)) cut += v.thrifty ?? 0;
  if (f.t < 15) cut += v.firstCup ?? 0;
  if (bossPct(f) < 0.2) cut += v.dusk ?? 0;
  if (sk.slot === 'raid') cut += v.raidBreath ?? 0;
  if (v.frozenHourglass && on(f, 'frozenHourglass')) cut += v.frozenHourglass;
  if (v.silverBookmark && f.mana < 50 && isSingle(key)) cut += v.silverBookmark; // 은빛 책갈피 (46 6장)
  if (key === 'hymn' && v.hymnBreath) cut += 0.5;
  return Math.max(0, 1 - cut);
}

/** 시전 시간 배율 (낙타 털실 반지: 진동 뒤 잠깐 −) */
export function castMult(f: Fight): number {
  const v = f.sp!.v.camelYarn;
  return v && on(f, 'camelYarn') ? 1 - v : 1;
}

/** 시전 시간 − 초 (직업 전용) */
export function castCut(f: Fight, key: SkillKey): number {
  const v = f.sp!.v;
  if (key === 'flash') return v.flashLight ?? 0;
  if (key === 'growth') return v.dawnDew ?? 0;
  if (key === 'rebirth') return v.quickRebirth ? 1 : 0;
  return 0;
}

/** 재사용 대기 (쓸 때 거는 값) */
export function cdSpec(f: Fight, key: SkillKey, cd: number): number {
  const v = f.sp!.v, slot = SKILLS[key].slot;
  if (slot === 'raid') cd *= 1 - (v.hurryStar ?? 0);
  if (slot === 'ext') cd *= 1 - (v.survivalDrill ?? 0);
  if (slot === 'dispel') cd -= v.cleanHands ?? 0;
  if (key === 'holyStrike') cd -= v.combo ?? 0;
  if (key === 'bloom') cd -= v.hastyBloom ?? 0;
  return Math.max(0, cd);
}

/** 마나 재생 배율 */
export function regenSpec(f: Fight): number {
  const v = f.sp!.v;
  let m = 1;
  if (f.mana < 30) m += v.springSip ?? 0;
  if (v.stillMoment && !f.cast && f.channel <= 0 && f.t - f.tx.lastAct >= 3 - 1e-9) m += v.stillMoment;
  if (v.toadCharm && on(f, 'toadCharm')) m += v.toadCharm;
  if (v.pilgrimCharm && living(f).every(u => u.hp >= u.max * 0.7 - 1e-9)) m += v.pilgrimCharm;
  if (v.frozenQuill && f.me.debuffs.length) m += v.frozenQuill; // 얼어붙은 깃펜 (46 6장)
  return m;
}

/** 공대 쿨기 · 생존기 효과 시간 */
export const raidSec = (f: Fight, key: SkillKey, sec: number): number => sec + sv(f, 'longSong') + (key === 'quietwood' ? sv(f, 'forestBreath') : 0) + (key === 'sanctuary' ? sv(f, 'longSanctuary') : 0);
export const guardSec = (f: Fight, sec: number): number => sec * (1 + sv(f, 'guardFeather'));

/** 쌍둥이 방패: 생존기를 쓰면 옆 칸 1명 (체력 비율이 가장 낮은)에게도 절반 시간 */
export function twin(f: Fight, u: Unit, give: (v: Unit) => void): void {
  if (!sv(f, 'twinShield')) return;
  const c = cellOf(f, u);
  const v = living(f).filter(x => x !== u && hexDist(cellOf(f, x), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
  if (v) give(v);
}

// ---------- 해제 · 디버프 ----------
/** 녹슨 수문 열쇠 (46 6장): 해제한 디버프가 이웃에게 옮겨붙으면 옮겨 간 아군 회복 */
export function specJump(f: Fight, to: Unit): void {
  const x = f.sp!.v.sluiceKey;
  if (!x) return;
  heal(f, to, intAmt(f, x), true, true);
  shout(f, 'sluiceKey', to);
}

/** 해제를 하면 (함정이 아니어도 · 함정이어도) */
export function specDispel(f: Fight, u: Unit, d: Debuff): void {
  const s = f.sp!, v = s.v;
  if (v.thankHand) f.mana = Math.min(100, f.mana + v.thankHand);
  if (v.brushOff) heal(f, u, intAmt(f, v.brushOff), true, true);
  if (v.immuneIncense) s.imm.push({ id: u.id, name: d.name, until: f.t + v.immuneIncense });
  if (v.busyDay) cdCut(f, ['ext'], v.busyDay);
  if (v.plagueCenser && (s.ready.plagueCenser ?? 0) <= f.t) { s.ready.plagueCenser = f.t + 15; shield(f, u, intAmt(f, v.plagueCenser), 8, 'plagueCenser'); }
  if (v.wornRosary) { if (s.dtype && s.dtype !== d.type) { cdCut(f, ['dispel'], v.wornRosary); shout(f, 'wornRosary'); } s.dtype = d.type; }
  // 꼬마등 유리병 (48 6장): 지울 때 대상이 50% 아래면 그 아군에게 보호막
  if (v.lampGlass && u.hp < u.max * 0.5 && (s.ready.lampGlass ?? 0) <= f.t) { s.ready.lampGlass = f.t + 12; shield(f, u, intAmt(f, v.lampGlass), 8, 'lampGlass'); }
  // 광대버섯 왕관 조각 (48 6장): 그 확률로 이웃 칸 아군 1명의 같은 유형 디버프도 함께 지움
  if (v.amanitaShard && f.rng() < v.amanitaShard) {
    const c = f.cells[u.cell];
    const w = living(f).find(x => x !== u && hexDist(f.cells[x.cell], c) === 1 && x.debuffs.some(y => y.type === d.type && !y.lock && !y.trap));
    const y = w?.debuffs.find(x => x.type === d.type && !x.lock && !x.trap);
    if (w && y) {
      w.debuffs = w.debuffs.filter(x => x !== y);
      emit(f, { type: 'dispel', id: w.id, trap: false });
      onDebuffEnd(f, w, y, true);
      shout(f, 'amanitaShard', w);
    }
  }
  // 소라 껍데기 (46 6장): 터지는 디버프 (부풀기 · 함정 · 터지는 마력)를 지우면 대상과 이웃 칸 아군에게 보호막
  if (v.conchShell && (d.trap || d.end?.p === 'pop' || d.end?.p === 'trapHit' || d.end?.p === 'blast') && (s.ready.conchShell ?? 0) <= f.t) {
    s.ready.conchShell = f.t + 15;
    const c = f.cells[u.cell];
    for (const w of living(f)) if (w === u || hexDist(f.cells[w.cell], c) === 1) shield(f, w, intAmt(f, v.conchShell), 8, 'conchShell');
  }
}
/** 디버프가 끝나거나 지워짐 (금빛수염 단추: 그 아군의 다음 직접 힐 +). 숨은 디버프 (삼키기 같은)는 안 셈 */
export function specDebuffEnd(f: Fight, u: Unit, d: Debuff): void {
  if (f.sp!.v.goldButton && !d.hide && u.alive) f.sp!.button[u.id] = true;
}
/** 두 번 털기: 해제가 그 확률로 재사용 대기 없이 */
export const twiceBrush = (f: Fight): boolean => !!f.sp?.v.twiceBrush && f.rng() < f.sp.v.twiceBrush;

/** 면역 향: 해제한 그 디버프에 아직 안 걸림 */
export function immune(f: Fight, u: Unit, name: string): boolean {
  const s = f.sp!;
  if (!s.imm.length) return false;
  s.imm = s.imm.filter(x => x.until > f.t);
  return s.imm.some(x => x.id === u.id && x.name === name);
}

/** 디버프가 걸릴 때 지속 시간 배율 (줄어드는 독기: 내가 지울 수 있는 디버프) */
export const debuffSec = (f: Fight, canDispel: boolean): number => (canDispel ? 1 - sv(f, 'fadingMiasma') : 1);

const DOT_CUT: Record<string, string> = { '질병': 'coldMedicine', '독': 'antidote', '마법': 'spellWard', '저주': 'curseBreak' };
/** 지속 피해 디버프 배율 (감기약 · 해독초 · 마법 막이 · 저주 풀이 · 상처 소독) */
export function dotSpec(f: Fight, d: Debuff): number {
  const v = f.sp!.v;
  let m = 1 - (v[DOT_CUT[d.type]] ?? 0);
  if (d.grow) m *= 1 - (v.woundClean ?? 0);
  return m;
}

// ---------- 받는 피해 ----------
/** 받는 피해 배율 (core damage, 직업군 방어력 다음) */
export function dmgSpec(f: Fight, u: Unit): number {
  const s = f.sp!, v = s.v;
  let m = 1;
  if (u.role === 'tank') {
    m *= 1 - (v.heartyMeal ?? 0);
    if (v.sturdyBack && hasHot(u)) m *= 1 - v.sturdyBack;
    if (v.prop) {
      const tanks = living(f).filter(x => x.role === 'tank');
      if (tanks.length >= 2 && tanks.every(x => x === u || x.hp / x.max >= u.hp / u.max)) m *= 1 - v.prop;
    }
  }
  if (u.pulled) m *= 1 - (v.heavyFeet ?? 0);
  if (s.trap) m *= 1 - (v.trapSense ?? 0);
  if (s.bomb) m *= 1 - (v.bombSquad ?? 0);
  if (u.me && v.turtleCharm && f.mana < 30) m *= 1 - v.turtleCharm; // 거북 등딱지 부적 (48 6장)
  if (v.coldAnvil && f.stagger) m *= 1 - v.coldAnvil; // 식은 모루 조각 (51 6장)
  if (v.heartShard && u.debuffs.some(d => d.end?.p === 'flip') && u.hp >= u.max * 0.4 - 1e-9 && u.hp <= u.max * 0.6 + 1e-9) m *= 1 - v.heartShard; // 심장뿌리 조각 (54 6장)
  if (v.starMap && on(f, 'starMap')) m *= 1 - v.starMap; // 별 지도 조각 (54 6장)
  return m;
}

/** 내가 건 보호막 (흡수)이 깨지거나 녹아 없어지면 (따끈한 조약돌, 51 6장): 그 아군 지능 v 회복, 재사용 6초 */
export function shieldGone(f: Fight, u: Unit): void {
  const s = f.sp!, v = s.v.warmPebble;
  if (!v || !u.alive || (s.ready.warmPebble ?? 0) > f.t + 1e-9) return;
  s.ready.warmPebble = f.t + 6;
  heal(f, u, intAmt(f, v), true, true);
  shout(f, 'warmPebble', u);
}

/** 함정이 터지는 동안 · 폭탄이 터지는 동안 fn (그 피해에만 배율) */
export function during<T>(f: Fight, what: 'trap' | 'bomb', fn: () => T): T {
  if (!f.sp) return fn();
  const o = f.sp[what];
  f.sp[what] = true;
  try { return fn(); } finally { f.sp[what] = o; }
}

/** 피해가 들어간 뒤: 탱커 30% 아래 (용기의 노래), 내 체력 40% 아래 (마지막 버팀) */
export function afterHurt(f: Fight, u: Unit, hp0: number): void {
  const s = f.sp!, v = s.v;
  if (u.role === 'tank' && v.braveSong && hp0 >= u.max * 0.3 && u.hp < u.max * 0.3) proc(f, 'braveSong', 5, 25);
  if (u.me && v.lastStand && !s.used.lastStand && u.hp < u.max * 0.4) {
    s.used.lastStand = 1;
    addMod(u, { k: 'cut', v: v.lastStand, until: f.t + 8, src: 'lastStand' });
    shout(f, 'lastStand');
  }
  if (v.ropeKnot && u.hp > 0) rope(f, u, hp0 - u.hp);
  if (u.me && v.brokenChain && hp0 >= u.max * 0.5 && u.hp < u.max * 0.5 && u.hp > 0) proc(f, 'brokenChain', 8, 60); // 끊어진 사슬 (39 4장)
}

/** 밧줄 매듭: 2초 안에 최대 체력 30% 넘게 잃으면 그 아군에게 보호막 (재사용 20초) */
function rope(f: Fight, u: Unit, d: number): void {
  const s = f.sp!, h = (s.hurt[u.id] = (s.hurt[u.id] ?? []).filter(x => x.t > f.t - 2 - 1e-9));
  h.push({ t: f.t, d });
  if ((s.ready.ropeKnot ?? 0) > f.t + 1e-9 || h.reduce((a, x) => a + x.d, 0) <= u.max * 0.3) return;
  s.ready.ropeKnot = f.t + 20;
  s.hurt[u.id] = [];
  shield(f, u, intAmt(f, s.v.ropeKnot), 8, 'ropeKnot');
}

/** 마지막 숨: 파티원이 쓰러질 피해를 받으면 체력 1로 버팀 (전투당 1번). 버텼으면 true */
export function lastBreath(f: Fight, u: Unit): boolean {
  const s = f.sp!;
  if (u.me || !s.v.lastBreath || s.used.lastBreath) return false;
  s.used.lastBreath = 1;
  u.hp = 1;
  shout(f, 'lastBreath', u);
  return true;
}

/** 파티원이 쓰러지면 (굳센 결의 · 되감기, 전투당 2번) */
export function specDeath(f: Fight): void {
  const s = f.sp!, v = s.v;
  if (v.resolve && (s.used.resolve ?? 0) < 2) { s.used.resolve = (s.used.resolve ?? 0) + 1; s.until.resolve = f.t + 10; shout(f, 'resolve'); }
  if (v.rewind && (s.used.rewind ?? 0) < 2) { s.used.rewind = (s.used.rewind ?? 0) + 1; cdCut(f, ['ext'], v.rewind); }
}

/** 일어선 파티원 (일어서는 빛): 체력 +v, 5초 동안 받는 피해 −30% */
export function specRevive(f: Fight, u: Unit): void {
  const v = sv(f, 'risingLight');
  if (!v) return;
  u.hp = Math.min(u.max, u.hp + u.max * v);
  addMod(u, { k: 'cut', v: 0.3, until: f.t + 5, src: 'risingLight' });
}

// ---------- 보스 쪽 ----------
/** 보스 예고가 뜨면 (북소리: 버스터 · 광역) */
export function specTel(f: Fight, tel: Telegraph): void {
  if (tel.kind === 'buster' || tel.kind === 'aoe') proc(f, 'drumbeat', 4, 20);
}
/** 버스터가 들어가면 (고철 호루라기: 탱커가 맞으면 3초) */
export function specBuster(f: Fight, tel: Telegraph): void {
  if (!f.sp!.v.scrapWhistle || !tel.units.some(id => f.party.some(u => u.id === id && u.alive && u.role === 'tank'))) return;
  f.sp!.until.scrapWhistle = f.t + 3;
  shout(f, 'scrapWhistle');
}
/** 보스 기술에 시전 · 채널이 끊기면 (눈꽃 결정) */
export function specBroken(f: Fight): void {
  const v = f.sp!.v.snowCrystal;
  if (!v) return;
  f.mana = Math.min(100, f.mana + v);
  shout(f, 'snowCrystal');
}
/** 지속 힐이 끝까지 가면 (묘지기 등불, 2초에 한 번) */
export function hotDone(f: Fight): void {
  const s = f.sp!, v = s.v.graveLantern;
  if (!v || (s.ready.graveLantern ?? 0) > f.t + 1e-9) return;
  s.ready.graveLantern = f.t + 2;
  f.mana = Math.min(100, f.mana + v);
}
/** 신기루가 걷히면 (냥크스의 수수께끼 쪽지: 1초 동안 직접 힐 +). gone = 걷힌 가짜 예고 (칠흑의 기사단 휘장) */
export function specReveal(f: Fight, gone: Telegraph[] = []): void {
  if (f.sp!.v.riddleNote) f.sp!.until.riddleNote = f.t + 1;
  echoDrop(f);
  shadowVeil(f);
  knightBanner(f, gone);
}
/** 칠흑의 기사단 휘장 (59 6장): 가짜 번개 구름이 걷히면 진짜 번개 구름 대상의 이웃 가운데 낮은 2명 보호막 */
function knightBanner(f: Fight, gone: Telegraph[]): void {
  const v = f.sp!.v.knightBanner;
  if (!v || !gone.some(t => t.skill.chain)) return;
  let any = false;
  for (const o of f.tels.filter(t => t.skill.chain && !t.fake && gone.some(g => g.skill === t.skill))) {
    for (const id of o.units) {
      const u = f.party.find(w => w.id === id);
      if (!u) continue;
      const c = cellOf(f, u);
      const near = living(f).filter(w => w !== u && hexDist(cellOf(f, w), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, 2);
      for (const w of near) shield(f, w, intAmt(f, v), 6, 'knightBanner');
      any ||= near.length > 0;
    }
  }
  if (any) shout(f, 'knightBanner');
}
/** 빌린 생명의 빚을 다 갚으면 (마지막 그림자의 저울: 그 아군 보호막) */
export function specDebtPaid(f: Fight, u: Unit): void {
  const v = f.sp!.v.shadowScale;
  if (!v || !u.alive) return;
  shield(f, u, intAmt(f, v), 6, 'shadowScale');
  shout(f, 'shadowScale', u);
}
/** 어둠물이 빠지면 (세레나의 젖은 악보: 잠겨 있던 아군 회복) */
export function specTideEbb(f: Fight, cells: Set<number>): void {
  const v = f.sp!.v.wetScore;
  if (!v) return;
  const wet = living(f).filter(u => cells.has(u.cell));
  for (const u of wet) heal(f, u, intAmt(f, v), true, true);
  if (wet.length) shout(f, 'wetScore');
}
/** 되울림의 물방울 (54 6장): 신기루가 걷히거나 모래시계가 되돌리면 가장 낮은 아군 2명 작은 힐 */
function echoDrop(f: Fight): void {
  const v = f.sp!.v.echoDrop;
  if (!v) return;
  const low = living(f).filter(u => u.hp < u.max).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, 2);
  for (const u of low) heal(f, u, intAmt(f, v), true, true);
  if (low.length) shout(f, 'echoDrop');
}
/** 띄워 올려진 아군이 내려오면 (부리부리의 우표: 낙하 피해 전에 보호막) */
export function specLand(f: Fight, u: Unit): void {
  const v = f.sp!.v.postStamp;
  if (v) shield(f, u, intAmt(f, v), 6, 'postStamp');
  shadowVeil(f);
}
/** 넘치는 빛 그릇이 가득 차면 (빗자루 승차권: 마나 회복) */
export function specVessel(f: Fight): void {
  const v = f.sp!.v.broomTicket;
  if (!v) return;
  f.mana = Math.min(100, f.mana + v);
  shout(f, 'broomTicket');
}
/** 뒤집힘 저주가 끝나 뒤집힌 아군 (뒤죽박죽 졸업장: 40~60%면 보호막) */
export function specFlip(f: Fight, u: Unit): void {
  const v = f.sp!.v.diploma;
  if (!v || !u.alive || u.hp < u.max * 0.4 - 1e-9 || u.hp > u.max * 0.6 + 1e-9) return;
  shield(f, u, intAmt(f, v), 6, 'diploma');
}
/** 신기루가 걷히거나 띄워진 아군이 내려오면 (어둑이의 그림자 휘장: 가장 낮은 아군 1명 보호막) */
function shadowVeil(f: Fight): void {
  const v = f.sp!.v.shadowVeil;
  if (!v) return;
  const low = living(f).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
  if (low) shield(f, low, intAmt(f, v), 6, 'shadowVeil');
}
/** 연쇄 번개가 피뢰침에서 멈추면 (빛갈래의 프리즘: 그 아군 회복) */
export function specRod(f: Fight, u: Unit): void {
  const v = f.sp!.v.prism;
  if (!v || !u.alive) return;
  heal(f, u, intAmt(f, v), true, true);
  shout(f, 'prism', u);
}
/** 크게 뛰기 (59 4-4): 시전 불가가 끝나면 2초 동안 가속 (멈춘 심장 조각) */
export function specBeat(f: Fight, sec: number): void {
  if (!f.sp!.v.stillHeart) return;
  f.sp!.until.stillHeartFrom = f.t + sec;
  f.sp!.until.stillHeart = f.t + sec + 2;
}
/** 진동이 울리면 (낙타 털실 반지: 2초 동안 시전 시간 −) */
export function specQuake(f: Fight): void {
  if (f.sp!.v.camelYarn) f.sp!.until.camelYarn = f.t + 2;
}
/** 모래시계가 체력을 되돌리면 (거꾸로 모래알: 마나 회복) */
export function specRewind(f: Fight): void {
  echoDrop(f);
  const v = f.sp!.v.backSand;
  if (!v) return;
  f.mana = Math.min(100, f.mana + v);
  shout(f, 'backSand');
}
/** 페이즈가 바뀌면 (해돋이) */
export function specPhase(f: Fight): void {
  if (f.sp!.v.sunrise) f.sp!.until.sunrise = f.t + 8;
}
/** 파티원이 보스 시전을 끊으면 (끊기 박자) */
export function specCut(f: Fight): void {
  if (f.sp!.v.cutBeat) f.sp!.until.cutBeat = f.t + 6;
  if (f.sp!.v.starMap) f.sp!.until.starMap = f.t + 6; // 별 지도 조각
}

/** 파티원 딜 배율 (응원 깃발 · 사기 진작 · 끊기 박자 · 앞장서기 · 정예 사냥꾼 · 활기찬 아침 · 보호막 수정 깨기) */
export function dpsSpec(f: Fight, u: Unit): number {
  const v = f.sp!.v;
  let m = 1;
  if ((u.role === 'melee' || u.role === 'ranged') && u.hp > u.max * 0.9) m += v.cheerFlag ?? 0;
  if (bossPct(f) < 0.3) m += v.morale ?? 0;
  if (v.cutBeat && on(f, 'cutBeat')) m += v.cutBeat;
  if (u.role === 'tank' && hasHot(u)) m += v.leadOn ?? 0;
  if (f.t < 15) m += v.brightMorning ?? 0;
  if (f.mobs.length && f.mobs.some(x => x.alive && (x.elite || x.add))) m += v.eliteHunter ?? 0;
  return m;
}

// ---------- 한 틱 ----------
/** healerTick 끝에서: 바쁜 손, 별빛 장막, 두꺼비 부적, 예약한 광역 힐, 효과 시간 (능력 파티원이 없을 때) */
export function specTick(f: Fight, dt: number, pohAt: (f: Fight, cell: number, amt: number, r: number) => void): void {
  const s = f.sp!, v = s.v;
  if (v.busyHands) { if (f.t - f.tx.lastAct >= 3 - 1e-9) s.busy = 0; else if (f.cast || f.channel > 0 || f.gcd > 0) s.busy += dt; }
  if (v.toadCharm && !s.used.toadCharm && f.mana < 30) { s.used.toadCharm = 1; s.until.toadCharm = f.t + 12; shout(f, 'toadCharm'); }
  if (v.starVeil && f.k % 4 === 0 && (s.ready.starVeil ?? 0) <= f.t) {
    const live = living(f);
    if (live.filter(u => u.hp < u.max * 0.5).length >= 3) {
      s.ready.starVeil = f.t + 30;
      for (const u of live) addMod(u, { k: 'cut', v: v.starVeil, until: f.t + 4, src: 'starVeil' });
      shout(f, 'starVeil');
    }
  }
  if (s.later.length) {
    const due = s.later.filter(x => x.at <= f.t + 1e-9);
    if (due.length) { s.later = s.later.filter(x => x.at > f.t + 1e-9); for (const x of due) under(null, false, () => pohAt(f, x.cell, x.amt, x.r)); }
  }
  if (!f.abOn) for (const u of f.party) if (u.mods.length) u.mods = u.mods.filter(m => m.until > f.t);
}

/** 위기의 직감: 파티 평균 체력 40% 아래면 공대 쿨기 재사용이 2배 빨리 */
export function crisis(f: Fight): boolean {
  if (!sv(f, 'crisisSense')) return false;
  const live = living(f);
  return live.length > 0 && live.reduce((a, u) => a + u.hp / u.max, 0) / live.length < 0.4;
}
