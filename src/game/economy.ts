/**
 * 재화·임무·상점·시즌 패스·앱 결제 상품 규칙 (12, 13, 15, 81). 화면과 분리된 순수 계산 (시각·난수는 받아서 씀).
 * 휴식 (90, 코드 이름 stamina)은 game/stamina.ts
 */
import { goalBond } from './guild';
import { RAID10_LV } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { HeroKey } from '../data/heroes';
import {
  CHAR_SLOT, JOB_PRICE, jobProductId, MERIT, MERIT_GEAR_COST, MERIT_WEEK_CAP, NOADS, PAID_HEROES, PASS_GAIN, PASS_LEVELS, PASS_XP, passFree, slotGold, type PassReward,
} from '../data/economy';
import { resourceBalance, spendResource } from './resources';
import { HEROES } from '../data/heroes';
import { HERO_FROM, makeItem, rollItem, SLOTS, type GearItem, type ItemGrade, type SlotKey } from '../data/equipment';
import {
  CHEST_BANK, CHEST_REWARD, DAILY, DAILY_BASIC, DAILY_N, GUILD_GOAL, MISSION_REWARD, missionOpen, WEEKLY, WEEKLY_LV, WEEKLY_N, WEEKLY_REWARD, type MissionDef, type RunEvent,
} from '../data/missions';
import { clearGold, MAX_LEVEL } from '../data/progression';
import { newDaily, newWeekly, noteSpecs, topLevel, type MissionSave, type SaveData } from '../platform/storage';
import { dayKey, daysBetween, seasonOf, weekKey } from './clock';
import { TUT } from './tutorial';

// ---------- 리셋 ----------
function pick(pool: MissionDef[], n: number, lv: number, hero: HeroKey, r: () => number, basicMax = n, skip: string[] = []): MissionSave[] {
  const can = pool.filter(m => missionOpen(m, lv, hero) && !skip.includes(m.key));
  const out: MissionSave[] = [];
  while (out.length < n && can.length) {
    const i = Math.floor(r() * can.length), m = can.splice(i, 1)[0];
    if (DAILY_BASIC.includes(m.key) && out.filter(x => DAILY_BASIC.includes(x.key)).length >= basicMax) continue;
    out.push({ key: m.key, n: 0, got: false });
  }
  return out;
}

/** fixed = 지금 못 채워서 바꾼 일일 임무 수 (길드를 빼 둠 · 직업을 바꿈) */
export interface Rollover { day: boolean; week: boolean; banked: number; season: boolean; fixed: number }

/** 접속·화면 진입 때 부름. 날이 바뀌었으면 일일 임무 새로, 주가 바뀌었으면 주간 새로 (13 1장) */
export function rollover(save: SaveData, now: number, r: () => number): Rollover {
  const out: Rollover = { day: false, week: false, banked: 0, season: false, fixed: 0 };
  const day = dayKey(now), week = weekKey(now), lv = topLevel(save);
  const d = save.daily;
  if (d.day !== day) {
    // 접속 안 한 날의 완료 상자는 2일까지 쌓임 (13 7장). 접속했는데 못 깬 날은 없음
    const missed = d.day ? Math.max(0, daysBetween(d.day, day) - 1) : 0;
    const banked = Math.min(CHEST_BANK, d.banked + missed);
    out.banked = banked - d.banked;
    save.daily = { ...newDaily(day), banked, missions: pick(DAILY, DAILY_N, lv, save.hero, r, 2) };
    out.day = true;
  }
  // 지금 못 채우는 임무 → 다른 임무로. 하루 교체 횟수는 안 씀
  // (길드를 빼기 전에 뽑힌 길드 임무, 직업을 바꿔 아직 지울 디버프가 없는 「해제 성공」)
  const ms = save.daily.missions;
  ms.forEach((m, i) => {
    const def = DAILY.find(x => x.key === m.key);
    if (m.got || !def || missionOpen(def, lv, save.hero)) return;
    const basic = ms.filter((x, j) => j !== i && DAILY_BASIC.includes(x.key)).length;
    const nw = pick(DAILY, 1, lv, save.hero, r, 2 - basic, ms.map(x => x.key))[0];
    if (nw) { ms[i] = nw; out.fixed++; }
  });
  if (save.weekly.week !== week) {
    // 지난주 주간 도전 기록 → 월요일 상자 (13 3-2)
    // 상자는 그 기록을 세운 직업이 받음 (장비가 직업마다, 2026-10-12)
    if (save.weekly.week && save.weekly.chalBest > 0) {
      if (save.weekly.chalBest >= save.chalChest) save.chalChestHero = save.weekly.chalHero;
      save.chalChest = Math.max(save.chalChest, save.weekly.chalBest);
    }
    save.weekly = { ...newWeekly(week), missions: lv >= WEEKLY_LV ? pick(lv >= RAID10_LV ? WEEKLY : WEEKLY.filter(m => m.key !== 'w_raid3'), WEEKLY_N, lv, save.hero, r) : [] };
    out.week = true;
  }
  // 레벨이 올라 주간 임무가 열렸으면 (Lv 10) 이번 주 것을 바로 줌
  if (!save.weekly.missions.length && lv >= WEEKLY_LV) save.weekly.missions = pick(WEEKLY.filter(m => m.key !== 'w_raid3' || lv >= RAID10_LV), WEEKLY_N, lv, save.hero, r);
  const sn = seasonOf(now).n;
  if (save.pass.season !== sn) { save.pass = { season: sn, xp: 0, free: [] }; out.season = true; }
  return out;
}

// ---------- 임무 진행 ----------
const defOf = (key: string) => DAILY.find(m => m.key === key) || WEEKLY.find(m => m.key === key)!;

function bump(list: MissionSave[], f: (m: MissionDef) => number): string[] {
  const done: string[] = [];
  for (const s of list) {
    const m = defOf(s.key);
    if (!m || s.n >= m.need) continue;
    const add = f(m);
    if (add > 0) { s.n = Math.min(m.need, s.n + add); if (s.n >= m.need) done.push(m.text); }
  }
  return done;
}

/** 판이 끝나면 임무 진행. 다 채운 임무 이름을 돌려줌 (결과 화면) */
export function onRun(save: SaveData, e: RunEvent): string[] {
  const done = [...bump(save.daily.missions, m => (m.run ? m.run(e) : 0)), ...bump(save.weekly.missions, m => (m.run ? m.run(e) : 0))];
  if (e.win && e.dungeon && !e.pub && !save.weekly.guild.got) save.weekly.guild.n = Math.min(GUILD_GOAL.need, save.weekly.guild.n + 1);
  return done;
}

/** 장비 판매 · 완료 상자 같은 행동 (판매는 한 개마다 1) */
export function onAct(save: SaveData, act: 'sell' | 'chest'): void {
  bump(save.daily.missions, m => (m.act === act ? 1 : 0));
  bump(save.weekly.missions, m => (m.act === act ? 1 : 0));
}

export const missionDef = defOf;
export const missionReady = (s: MissionSave) => !s.got && s.n >= defOf(s.key).need;

// ---------- 보상 ----------
/** 이 레벨 「클리어 골드 1판」 (보통 A, 12 3-1). 임무 · 상자 · 패스 골드의 기준 */
export const runGold = (lv: number) => clearGold(lv, '보통', 'A');

export interface Gain { gold?: number; pass?: number; items?: GearItem[]; deco?: string; /** 처음 얻은 특수능력 (42 1-6) */ newSpecs?: string[] }

function give(save: SaveData, g: Gain, now: number): Gain {
  save.player.gold += g.gold || 0;
  for (const it of g.items || []) save.gear.bag.push(it);
  if (g.items?.length) g.newSpecs = noteSpecs(save, g.items);
  if (g.deco && !save.decos.includes(g.deco)) save.decos.push(g.deco);
  if (g.pass) g.pass = addPassXp(save, g.pass, now);
  return g;
}

/** 임무 보상 받기 (13 2-1): 일일 = 클리어 골드의 20%, 주간 = 클리어 골드 3판 (81) (+ 패스 경험치). 91: v16의 강화석 → #172 전 골드 */
export function claimMission(save: SaveData, kind: 'daily' | 'weekly', i: number, now: number): Gain | string {
  const s = (kind === 'daily' ? save.daily : save.weekly).missions[i];
  if (!s || !missionReady(s)) return '아직 못 채움';
  s.got = true;
  const gold = runGold(topLevel(save));
  return kind === 'daily'
    ? give(save, { gold: Math.round(gold * MISSION_REWARD.goldShare), pass: PASS_GAIN.daily }, now)
    : give(save, { gold: gold * WEEKLY_REWARD.runs, pass: PASS_GAIN.weekly }, now);
}

/** 완료 상자 장비: 레벨에 맞는 난이도 기준 (13 2-1), 등급대는 내 레벨 (86) */
const chestDiff = (lv: number): DiffName => (lv >= RAID10_LV ? '어려움' : '보통');

/** 일일 완료 상자: 오늘 것 (임무 5개 받음) 또는 놓친 날 쌓인 것 */
export function chestState(save: SaveData): { today: boolean; banked: number } {
  const d = save.daily;
  return { today: !d.chest && d.missions.length > 0 && d.missions.every(m => m.got), banked: d.banked };
}
export function claimChest(save: SaveData, r: () => number, now: number, double = false): Gain | string {
  const st = chestState(save);
  if (!st.today && !st.banked && !double) return '임무 5개를 다 받으면 열림';
  if (double) {
    if (!save.daily.chest || save.daily.chest2) return '오늘 상자를 먼저 받기';
    save.daily.chest2 = true;
  } else if (st.today) save.daily.chest = true;
  else save.daily.banked--;
  // 장비는 지금 직업 레벨로 (장비가 직업마다, 2026-10-12)
  const my = save.player.level;
  const it = rollItem(r, chestDiff(my), 'A', my, save.nextId++, { hero: save.hero, classLoot: true, lv: my, tierLv: my }); // 지금 직업 전용 70% (72)
  if (!double) onAct(save, 'chest');
  return give(save, { gold: runGold(my) * CHEST_REWARD.runs, pass: double ? 0 : PASS_GAIN.chest, items: [it] }, now);
}

/** 하루 1회 무료 교체 (13 2-1) */
export function swapMission(save: SaveData, i: number, r: () => number): string {
  const d = save.daily, s = d.missions[i];
  if (!s || s.got) return '바꿀 수 없음';
  if (d.swapped) return '오늘 교체를 이미 씀';
  const basic = d.missions.filter((m, j) => j !== i && DAILY_BASIC.includes(m.key)).length;
  const nw = pick(DAILY, 1, topLevel(save), save.hero, r, 2 - basic, d.missions.map(m => m.key))[0];
  if (!nw) return '바꿀 임무가 없음';
  d.missions[i] = nw; d.swapped = true;
  return '';
}

/** 길드 주간 목표 (93 6-1): 명성 + 그 주에 길드파티로 출전한 길드원 인연 +2 (예전 길드원 경험치 몫 대신) */
export function claimGuildGoal(save: SaveData): string {
  const g = save.weekly.guild;
  if (g.got || g.n < GUILD_GOAL.need) return '아직 못 채움';
  g.got = true;
  save.guild.fame += GUILD_GOAL.fame;
  goalBond(save);
  return '';
}

/**
 * 주간 도전 월요일 상자 (13 3-2): 지난주 최고 단계 기준 장비 등급 보장 (2026-10-13 Lim): 5단계 고급 1 · 10 희귀 1 · 15 영웅 1 · 20 영웅 2.
 * 1~4단계는 골드만 (예전: 고급 1 · 5 희귀 · 10 영웅 · 15 영웅 2 · 20 영웅 3). 영웅은 받는 캐릭터가 Lv 45부터 (그 전엔 희귀, 88). 전설은 Lv 100 20인 레이드만
 * 골드 = 받는 캐릭터 레벨 클리어 골드 × goldRuns (1 + 단계 ÷ 5 판: 1~4단계 1 · 5~9단계 2 … 20단계 5. v16 강화석이던 것을 91에서 #172 전 골드로)
 */
export function chalChestOf(stage: number, level = MAX_LEVEL): { grades: ItemGrade[]; goldRuns: number } {
  // 88: 영웅은 Lv 45 (HERO_FROM)부터. 그 전엔 희귀로 (초반은 희귀까지)
  const hero: ItemGrade = level >= HERO_FROM ? '영웅' : '희귀';
  const grades: ItemGrade[] = stage >= 20 ? [hero, hero] : stage >= 15 ? [hero] : stage >= 10 ? ['희귀'] : stage >= 5 ? ['고급'] : [];
  return { grades, goldRuns: 1 + Math.floor(stage / 5) };
}
export function claimChalChest(save: SaveData, r: () => number, now: number): Gain | string {
  const stage = save.chalChest;
  if (!stage) return '받을 상자 없음';
  // v12: 어느 직업에서든 수령 가능. 장비 효과는 기록을 세운 직업을 따른다.
  const h = save.chalChestHero ?? save.hero;
  save.chalChest = 0;
  delete save.chalChestHero;
  // 장비 (아이템 레벨)는 받는 캐릭터 레벨 기준 (2026-10-13 Lim 「보상시 해당 캐릭터 레벨에 기반해서」)
  const lv = save.player.level, c = chalChestOf(stage, lv);
  const items = c.grades.map(g => makeItem(r, SLOTS[Math.floor(r() * SLOTS.length)].key, g, save.nextId++, undefined, { hero: h, classLoot: true, lv }));
  return give(save, { gold: c.goldRuns * runGold(lv), items, pass: PASS_GAIN.challenge }, now);
}

// ---------- 시즌 패스 ----------
export const passLevel = (xp: number) => Math.min(PASS_LEVELS, Math.floor(xp / PASS_XP));
/** 패스 경험치 (마지막 3주 +50%). 실제로 더한 양을 돌려줌 */
export function addPassXp(save: SaveData, amt: number, now: number): number {
  const x = Math.round(amt * (seasonOf(now).catchUp ? 1.5 : 1));
  save.pass.xp += x;
  return x;
}
export function passGain(save: SaveData, lv: number): Gain {
  const f: PassReward = passFree(lv);
  return { gold: (f.runs ?? 0) * runGold(topLevel(save)) + (f.gold ?? 0), deco: f.deco || f.title };
}
/** 패스 보상 받기 (81: 한 줄, 프리미엄 라인 없음) */
export function claimPass(save: SaveData, lv: number, now: number): Gain | string {
  if (lv < 1 || lv > passLevel(save.pass.xp)) return '아직 못 올라감';
  if (save.pass.free.includes(lv)) return '이미 받음';
  save.pass.free.push(lv);
  return give(save, passGain(save, lv), now);
}

// ---------- 상점 ----------
/** 공훈 교환 (12 3-5): 원하는 부위 영웅 장비 1개 */
export function exchangeMerit(save: SaveData, slot: SlotKey, r: () => number = Math.random): GearItem | string {
  if (!SLOTS.some(s => s.key === slot)) return '없는 부위';
  if (save.wallet.merit < MERIT_GEAR_COST) return `공훈 부족 (${MERIT_GEAR_COST} 필요)`;
  save.wallet.merit -= MERIT_GEAR_COST;
  const g: ItemGrade = '영웅';
  const it = makeItem(r, slot, g, save.nextId++, undefined, { hero: save.hero, classLoot: true, lv: save.player.level }); // 지금 직업 전용 70% (72)
  save.gear.bag.push(it);
  noteSpecs(save, [it]);
  return it;
}

// ---------- 레이드 주간 규칙 ----------
/** 레이드 보스 처치 공훈 (주 150 상한, 레이드마다 따로) */
export function meritFor(save: SaveData, raid: 10 | 20, diff: DiffName): number {
  const left = Math.max(0, MERIT_WEEK_CAP - save.weekly.merit[raid]);
  return Math.min(left, MERIT[raid][diff]);
}
/** v12: 같은 캐릭터의 모든 직업이 레이드 주 1회 제한을 공유 */
export const lootKey = (_hero: HeroKey, content: string, diff: DiffName) => `${content}|${diff}`;
/** v11 직업 접두사가 남아 있어도 보스·난이도별 수령 이력으로 처리 */
export const raidLootOpen = (save: SaveData, content: string, diff: DiffName) => !save.weekly.loot.some(k => k.split('|').slice(-2).join('|') === lootKey(save.hero, content, diff));

// ---------- 앱 결제 상품 (81 3장): 광고 제거 패키지 · 직업 4종. 계정 것 (shareAccount가 캐릭터마다 옮김) ----------
export interface ProductInfo { id: string; name: string; price: string; owned: boolean }
/** 상점에 거는 상품 (광고 제거 → 직업 순서) */
export function products(save: SaveData): ProductInfo[] {
  const own = (id: string) => save.bought.includes(id);
  return [
    { ...NOADS, owned: own(NOADS.id) },
    ...PAID_HEROES.map(h => ({ id: jobProductId(h), name: HEROES[h].name, price: JOB_PRICE, owned: own(jobProductId(h)) })),
  ];
}
/** 결제가 끝난 뒤 상품 주기 (화면이 platform/billing purchase 성공 뒤에 부름). 성공 = 빈 문자열 */
export function grantProduct(save: SaveData, id: string): string {
  if (!products(save).some(p => p.id === id)) return '없는 상품';
  if (save.bought.includes(id)) return '이미 산 상품';
  save.bought.push(id);
  return '';
}

// ---------- 캐릭터 칸 (68 2장): 골드로 모아 사거나 앱 결제로 바로 (Lim 2026-10-12 「둘 다」, v16에서 골드와 함께 뺐다가 91에서 되살림) ----------
export interface SlotOffer {
  /** 산 칸 수 (처음 1) · 최대 */
  have: number; max: number;
  /** 다음 칸 골드 값 · 골드로 살 때 필요한 지금 캐릭터 레벨 */
  gold: number; lv: number;
  /** 골드로 살 수 있음 / 아니면 이유 */
  ok: boolean; why: string;
  /** 앱 결제로 살 수 있음 / 아니면 이유 (레벨 · 골드 조건 없음) */
  cash: boolean; cashWhy: string;
  /** 앱 결제 상품 (platform/billing purchase에 id) */
  iap: { id: string; name: string; price: string };
}

export function slotOffer(save: SaveData): SlotOffer {
  const have = save.roster.slots, gold = slotGold(have), lv = CHAR_SLOT.lv;
  const cashWhy = have >= CHAR_SLOT.max ? `칸이 가득 참 (최대 ${CHAR_SLOT.max})` : save.tut < TUT.done ? '튜토리얼을 마치면 살 수 있음' : '';
  const why = cashWhy
    || (save.player.level < lv && !save.settings.devUnlock ? `이 캐릭터 Lv ${lv}부터` : '')
    || (resourceBalance(save, 'gold') < gold ? `골드 부족 (${gold.toLocaleString('ko-KR')} 필요)` : '');
  return { have, max: CHAR_SLOT.max, gold, lv, ok: !why, why, cash: !cashWhy, cashWhy, iap: CHAR_SLOT.iap };
}

/** 지금 캐릭터 골드로 칸 하나 사기. 성공 = 빈 문자열, 아니면 이유 */
export function buySlot(save: SaveData): string {
  const o = slotOffer(save);
  if (!o.ok) return o.why;
  spendResource(save, 'gold', o.gold);
  save.roster.slots++;
  return '';
}

/** 앱 결제가 끝난 뒤 칸 하나 주기 (화면이 purchase(CHAR_SLOT.iap.id) 성공 뒤에 부름). 성공 = 빈 문자열 */
export function grantSlot(save: SaveData): string {
  const o = slotOffer(save);
  if (!o.cash) return o.cashWhy;
  save.roster.slots++;
  return '';
}
