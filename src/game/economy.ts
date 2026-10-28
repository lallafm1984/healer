/**
 * 재화·임무·상점·앱 결제 상품 규칙 (12, 13, 15, 81). 화면과 분리된 순수 계산 (시각·난수는 받아서 씀). 시즌 패스 · 공훈은 2026-10-20 Lim 「시즌패스 시스템 제거」 · 「공훈 재화및 시스템도 제거하자」로 없앰.
 * 휴식 (90, 코드 이름 stamina)은 game/stamina.ts
 */
import { EXPED } from '../data/guild';
import { RAID10_LV, RAID20_LV } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { HeroKey } from '../data/heroes';
import {
  JOB_GOLD, JOB_PRICE, jobProductId, NOADS, PAID_HEROES,
} from '../data/economy';
import { HEROES } from '../data/heroes';
import { HERO_FROM, makeItem, rollItem, SLOTS, type GearItem, type ItemGrade } from '../data/equipment';
import {
  CHEST_BANK, CHEST_REWARD, DAILY, DAILY_BASIC, DAILY_N, GUILD_GOAL, MISSION_REWARD, missionOpen, WEEKLY, WEEKLY_LV, WEEKLY_N, WEEKLY_REWARD, type MissionDef, type RunEvent,
} from '../data/missions';
import { clearGold, MAX_LEVEL } from '../data/progression';
import { newDaily, newWeekly, topLevel, type MissionSave, type SaveData } from '../platform/storage';
import { dayKey, daysBetween, weekKey } from './clock';
import { CHAL } from '../data/challenge';
import { pickChalContent } from './runmode';
import { resourceBalance, spendResource } from './resources';

// ---------- 리셋 ----------
/**
 * 지금 받을 수 있는 임무: 레벨 · 직업 (missionOpen) + 길드 임무는 길드원이 있을 때만
 * (2026-10-22 가상 사용자 QA: 길드가 생기고 (그때 Lv 15) 영입을 안 한 사람은 「길드파티로 클리어」가 뽑혀도 한 번도 못 채움)
 */
export const missionCan = (save: SaveData, m: MissionDef, lv = topLevel(save)) => missionOpen(m, lv, save.hero) && (!m.guild || (save.guild.founded && save.guild.members.length > 0));
function pick(save: SaveData, pool: MissionDef[], n: number, lv: number, r: () => number, basicMax = n, skip: string[] = []): MissionSave[] {
  const can = pool.filter(m => missionCan(save, m, lv) && !skip.includes(m.key));
  const out: MissionSave[] = [];
  while (out.length < n && can.length) {
    const i = Math.floor(r() * can.length), m = can.splice(i, 1)[0];
    if (DAILY_BASIC.includes(m.key) && out.filter(x => DAILY_BASIC.includes(x.key)).length >= basicMax) continue;
    out.push({ key: m.key, n: 0, got: false });
  }
  return out;
}

/** fixed = 지금 못 채워서 바꾼 일일 임무 수 (길드를 빼 둠 · 직업을 바꿈) */
export interface Rollover { day: boolean; week: boolean; banked: number; fixed: number }

/**
 * 주간 임무 후보: 10인이 열리기 전 (RAID10_LV)엔 레이드 임무 빼고, 「일일 상자 5번」은 이번 주 남은 날 (오늘 포함) · 오늘 안 연 상자 · 쌓인 상자로
 * 5번을 채울 수 있을 때만 (105 QA 2 · 3: 주 중간에 Lv 10이 되거나 주 첫 접속이 토 · 일이면 못 깨는데도 뽑혔음). 일일 리셋 뒤에 부름
 */
function weeklyPool(save: SaveData, lv: number, day: string, week: string): MissionDef[] {
  const left = 7 - daysBetween(week, day), chests = (left - 1) + (save.daily.chest ? 0 : 1) + save.daily.banked;
  return WEEKLY.filter(m => (m.key !== 'w_raid3' || lv >= RAID10_LV) && (m.key !== 'w_chest5' || chests >= 5));
}

/**
 * 접속·화면 진입 때 부름. 날이 바뀌었으면 일일 임무 새로, 주가 바뀌었으면 주간 새로 (13 1장).
 * 키 (YYYY-MM-DD)가 지금까지 본 것보다 늦을 때만 리셋 (2026-10-19 103 다른 문제점 1: 시계를 뒤로 갔다 오면 주 첫 표 · 상자가 다시 나오던 것)
 */
export function rollover(save: SaveData, now: number, r: () => number): Rollover {
  const out: Rollover = { day: false, week: false, banked: 0, fixed: 0 };
  const day = dayKey(now), week = weekKey(now), lv = topLevel(save);
  const d = save.daily;
  if (d.day < day) {
    // 접속 안 한 날의 완료 상자는 2일까지 쌓임 (13 7장). 접속했는데 못 깬 날은 없음
    const missed = d.day ? Math.max(0, daysBetween(d.day, day) - 1) : 0;
    const banked = Math.min(CHEST_BANK, d.banked + missed);
    out.banked = banked - d.banked;
    save.daily = { ...newDaily(day), banked, missions: pick(save, DAILY, DAILY_N, lv, r, 2) };
    out.day = true;
  }
  // 지금 못 채우는 임무 → 다른 임무로
  // (길드를 빼기 전에 뽑힌 길드 임무 · 길드원이 없어진 뒤의 길드 임무, 직업을 바꿔 아직 지울 디버프가 없는 「해제 성공」)
  const ms = save.daily.missions;
  ms.forEach((m, i) => {
    const def = DAILY.find(x => x.key === m.key);
    if (m.got || !def || missionCan(save, def, lv)) return;
    const basic = ms.filter((x, j) => j !== i && DAILY_BASIC.includes(x.key)).length;
    const nw = pick(save, DAILY, 1, lv, r, 2 - basic, ms.map(x => x.key))[0];
    if (nw) { ms[i] = nw; out.fixed++; }
  });
  if (save.weekly.week < week) {
    // 지난주 주간 도전 기록 → 월요일 상자 (13 3-2)
    // 상자는 그 기록을 세운 직업이 받음 (장비가 직업마다, 2026-10-12)
    if (save.weekly.week && save.weekly.chalBest > 0) {
      if (save.weekly.chalBest >= save.chalChest) save.chalChestHero = save.weekly.chalHero;
      save.chalChest = Math.max(save.chalChest, save.weekly.chalBest);
    }
    const last = save.weekly.chal;
    save.weekly = { ...newWeekly(week), missions: lv >= WEEKLY_LV ? pick(save, weeklyPool(save, lv, day, week), WEEKLY_N, lv, r) : [] };
    // 이번 주 주간 도전 던전 (110 2차): 내 레벨 이하 던전 가운데 무작위, 지난주 것은 빼고
    save.weekly.chal = pickChalContent(lv, r, last);
    out.week = true;
  }
  // 레벨이 올라 주간 임무가 열렸으면 (Lv 10) 이번 주 것을 바로 줌
  if (!save.weekly.missions.length && lv >= WEEKLY_LV) save.weekly.missions = pick(save, weeklyPool(save, lv, day, save.weekly.week || week), WEEKLY_N, lv, r);
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
  if (e.win && (e.dungeon || e.explore) && !e.pub && !save.weekly.guild.got) save.weekly.guild.n = Math.min(GUILD_GOAL.need, save.weekly.guild.n + 1); // 길드 주간 목표: 탐험 길드파티도 (105 QA)
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
/**
 * 이 레벨 「클리어 골드 1판」 = 그 레벨에 열린 가장 큰 콘텐츠 한 판 (보통 A, 12 3-1 · 2026-10-20 Lim 카드 「넷 다」, 103): Lv 45 전 던전 · 45~69 10인 · 70부터 20인.
 * 임무 · 상자 골드의 기준 (예전 던전 한 판: Lv 100 일일 임무 하나가 판 49초어치였음)
 */
export const runGold = (lv: number) => clearGold(lv, '보통', 'A', lv >= RAID20_LV ? 20 : lv >= RAID10_LV ? 10 : 0);

export interface Gain { gold?: number; items?: GearItem[] }

function give(save: SaveData, g: Gain): Gain {
  save.player.gold += g.gold || 0;
  for (const it of g.items || []) save.gear.bag.push(it);
  return g;
}

/** 임무 하나 보상 골드 (13 2-1): 일일 = 클리어 골드의 35%, 주간 = 클리어 골드 1.75판 (2026-10-22 B안, 예전 20% · 3판), 정수로 반올림. 받기와 임무 화면 표시가 함께 씀 */
export function missionGold(save: SaveData, kind: 'daily' | 'weekly'): number {
  const gold = runGold(topLevel(save));
  return Math.round(gold * (kind === 'daily' ? MISSION_REWARD.goldShare : WEEKLY_REWARD.runs));
}

/** 임무 보상 받기. 91: v16의 강화석 → #172 전 골드 */
export function claimMission(save: SaveData, kind: 'daily' | 'weekly', i: number): Gain | string {
  const s = (kind === 'daily' ? save.daily : save.weekly).missions[i];
  if (!s || !missionReady(s)) return '아직 못 채움';
  s.got = true;
  return give(save, { gold: missionGold(save, kind) });
}

/** 완료 상자 장비: 레벨에 맞는 난이도 기준 (13 2-1), 등급대는 내 레벨 (86) */
const chestDiff = (lv: number): DiffName => (lv >= RAID10_LV ? '어려움' : '보통');

/** 일일 완료 상자: 오늘 것 (임무 5개 받음) 또는 놓친 날 쌓인 것 */
export function chestState(save: SaveData): { today: boolean; banked: number } {
  const d = save.daily;
  return { today: !d.chest && d.missions.length > 0 && d.missions.every(m => m.got), banked: d.banked };
}
export function claimChest(save: SaveData, r: () => number, double = false): Gain | string {
  const st = chestState(save);
  if (!st.today && !st.banked && !double) return `임무 ${save.daily.missions.length}개를 다 받으면 열림`; // Lv 1~4는 4개 (105 QA)
  if (double) {
    if (!save.daily.chest || save.daily.chest2) return '오늘 상자를 먼저 받기';
    save.daily.chest2 = true;
  } else if (st.today) save.daily.chest = true;
  else save.daily.banked--;
  // 장비는 지금 직업 레벨로 (장비가 직업마다, 2026-10-12)
  const my = save.player.level;
  const it = rollItem(r, chestDiff(my), 'A', my, save.nextId++, { hero: save.hero, classLoot: true, lv: my, tierLv: my }); // 지금 직업 전용 70% (72)
  if (!double) onAct(save, 'chest');
  return give(save, { gold: runGold(my) * CHEST_REWARD.runs, items: [it] });
}

/** 주간 원정 상자 (93 8장): 원정 셋을 다 끝내면 클리어 골드 5판 + 장비 1 (지금 직업 레벨 · 전용 70%) */
export function claimExped(save: SaveData, r: () => number): Gain | string {
  const x = save.guild.exped;
  if (!x.list.length || !x.list.every(c => c.done)) return '원정 셋을 다 끝내면 열림';
  if (x.got) return '이번 주는 받음';
  x.got = true;
  const my = save.player.level;
  const it = rollItem(r, chestDiff(my), 'A', my, save.nextId++, { hero: save.hero, classLoot: true, lv: my, tierLv: my });
  return give(save, { gold: runGold(my) * EXPED.chestGold, items: [it] });
}

/** 길드 주간 목표 (93 6-1): 명성 보상 */
export function claimGuildGoal(save: SaveData): string {
  const g = save.weekly.guild;
  if (g.got || g.n < GUILD_GOAL.need) return '아직 못 채움';
  g.got = true;
  save.guild.fame += GUILD_GOAL.fame;
  return '';
}

/**
 * 주간 도전 월요일 상자 (13 3-2): 지난주 최고 단계 기준 장비 등급 보장 (2026-10-13 Lim): 5단계 고급 1 · 10 희귀 1 · 15 영웅 1 · 20 영웅 2.
 * 1~4단계는 골드만 (예전: 고급 1 · 5 희귀 · 10 영웅 · 15 영웅 2 · 20 영웅 3). 영웅은 받는 캐릭터가 Lv 45부터 (그 전엔 희귀, 88). 전설은 Lv 100 레이드 어려움 · 악몽만 (10인은 20인의 절반)
 * 골드 = 받는 캐릭터 레벨 클리어 골드 × goldRuns (1 + 단계 ÷ 5 판: 1~4단계 1 · 5~9단계 2 … 20단계 5. v16 강화석이던 것을 91에서 #172 전 골드로)
 * × CHAL.rewardCut (110 2차 Lim 「경험치 및 골드 지급은 반으로」) = gold
 */
export function chalChestOf(stage: number, level = MAX_LEVEL): { grades: ItemGrade[]; goldRuns: number; gold: number } {
  // 88: 영웅은 Lv 45 (HERO_FROM)부터. 그 전엔 희귀로 (초반은 희귀까지)
  const hero: ItemGrade = level >= HERO_FROM ? '영웅' : '희귀';
  const grades: ItemGrade[] = stage >= 20 ? [hero, hero] : stage >= 15 ? [hero] : stage >= 10 ? ['희귀'] : stage >= 5 ? ['고급'] : [];
  const goldRuns = 1 + Math.floor(stage / 5);
  return { grades, goldRuns, gold: Math.round(goldRuns * runGold(level) * CHAL.rewardCut) };
}
export function claimChalChest(save: SaveData, r: () => number): Gain | string {
  const stage = save.chalChest;
  if (!stage) return '받을 상자 없음';
  // v12: 어느 직업에서든 수령 가능. 장비 효과는 기록을 세운 직업을 따른다.
  const h = save.chalChestHero ?? save.hero;
  save.chalChest = 0;
  delete save.chalChestHero;
  // 장비 (아이템 레벨)는 받는 캐릭터 레벨 기준 (2026-10-13 Lim 「보상시 해당 캐릭터 레벨에 기반해서」)
  const lv = save.player.level, c = chalChestOf(stage, lv);
  const items = c.grades.map(g => makeItem(r, SLOTS[Math.floor(r() * SLOTS.length)].key, g, save.nextId++, undefined, { hero: h, classLoot: true, lv }));
  return give(save, { gold: c.gold, items });
}

// ---------- 상점 ----------
// ---------- 레이드 주간 규칙 ----------
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
/** 직업을 골드로 사기 (JOB_GOLD, 레벨 조건 없음): 골드를 쓰고 앱 결제와 같은 상품을 줌. 성공 = 빈 문자열 */
export function buyJobWithGold(save: SaveData, h: HeroKey): string {
  const id = jobProductId(h);
  if (!PAID_HEROES.includes(h)) return '없는 상품';
  if (save.bought.includes(id)) return '이미 산 상품';
  if (resourceBalance(save, 'gold') < JOB_GOLD) return '골드 부족';
  spendResource(save, 'gold', JOB_GOLD);
  return grantProduct(save, id);
}
