/**
 * 재화·임무·상점·시즌 패스 규칙 (12, 13, 15). 화면과 분리된 순수 계산 (시각·난수는 받아서 씀).
 */
import { ALL_DIFFS } from '../data/content';
import type { DiffName } from '../data/difficulty';
import {
  BAG_MAX, itemPrice, MEMBER, MERIT, MERIT_GEAR_COST, MERIT_WEEK_CAP, PASS_GAIN, PASS_LEVELS, PASS_PREMIUM_CRYSTAL, PASS_XP, passFree, passPremium,
  SHARD_CRAFT, SHARD_MAX, type PassReward,
} from '../data/economy';
import { itemName, LEGEND_LEVEL, rollItem, SLOTS, type GearItem, type ItemGrade, type SlotKey } from '../data/equipment';
import type { ItemKey } from '../data/items';
import {
  CHEST_BANK, CHEST_REWARD, DAILY, DAILY_BASIC, DAILY_N, GUILD_GOAL, MISSION_REWARD, WEEKLY, WEEKLY_LV, WEEKLY_N, type MissionDef, type RunEvent,
} from '../data/missions';
import { addXp, clearGold, xpToNext } from '../data/progression';
import { newDaily, newWeekly, type MissionSave, type SaveData } from '../platform/storage';
import { dayKey, daysBetween, seasonOf, weekKey } from './clock';

// ---------- 리셋 ----------
function pick(pool: MissionDef[], n: number, lv: number, r: () => number, basicMax = n, skip: string[] = []): MissionSave[] {
  const can = pool.filter(m => m.lv <= lv && !skip.includes(m.key));
  const out: MissionSave[] = [];
  while (out.length < n && can.length) {
    const i = Math.floor(r() * can.length), m = can.splice(i, 1)[0];
    if (DAILY_BASIC.includes(m.key) && out.filter(x => DAILY_BASIC.includes(x.key)).length >= basicMax) continue;
    out.push({ key: m.key, n: 0, got: false });
  }
  return out;
}

export interface Rollover { day: boolean; week: boolean; memberCrystal: number; banked: number; season: boolean }

/** 접속·화면 진입 때 부름. 날이 바뀌었으면 일일 임무 새로, 주가 바뀌었으면 주간 새로 (13 1장) */
export function rollover(save: SaveData, now: number, r: () => number): Rollover {
  const out: Rollover = { day: false, week: false, memberCrystal: 0, banked: 0, season: false };
  const day = dayKey(now), week = weekKey(now), lv = save.player.level;
  const d = save.daily;
  if (d.day !== day) {
    // 접속 안 한 날의 완료 상자는 2일까지 쌓임 (13 7장). 접속했는데 못 깬 날은 없음
    const missed = d.day ? Math.max(0, daysBetween(d.day, day) - 1) : 0;
    const banked = Math.min(CHEST_BANK, d.banked + missed);
    out.banked = banked - d.banked;
    save.daily = { ...newDaily(day), banked, missions: pick(DAILY, DAILY_N, lv, r, 2) };
    out.day = true;
    if (isMember(save, now)) { save.wallet.crystal += MEMBER.daily; out.memberCrystal = MEMBER.daily; }
  }
  if (save.weekly.week !== week) {
    // 지난주 주간 도전 기록 → 월요일 상자 (13 3-2)
    if (save.weekly.week && save.weekly.chalBest > 0) save.chalChest = Math.max(save.chalChest, save.weekly.chalBest);
    save.weekly = { ...newWeekly(week), missions: lv >= WEEKLY_LV ? pick(lv >= 35 ? WEEKLY : WEEKLY.filter(m => m.key !== 'w_raid3'), WEEKLY_N, lv, r) : [] };
    out.week = true;
  }
  // 레벨이 올라 주간 임무가 열렸으면 (Lv 10) 이번 주 것을 바로 줌
  if (!save.weekly.missions.length && lv >= WEEKLY_LV) save.weekly.missions = pick(WEEKLY.filter(m => m.key !== 'w_raid3' || lv >= 35), WEEKLY_N, lv, r);
  const sn = seasonOf(now).n;
  if (save.pass.season !== sn) { save.pass = { season: sn, xp: 0, premium: false, free: [], prem: [] }; out.season = true; }
  return out;
}

export const isMember = (save: SaveData, now = Date.now()) => save.member > now;

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

/** 강화·완료 상자 같은 행동 */
export function onAct(save: SaveData, act: 'enhance' | 'chest'): void {
  bump(save.daily.missions, m => (m.act === act ? 1 : 0));
  bump(save.weekly.missions, m => (m.act === act ? 1 : 0));
}

export const missionDef = defOf;
export const missionReady = (s: MissionSave) => !s.got && s.n >= defOf(s.key).need;

// ---------- 보상 ----------
/** 이 레벨 「클리어 골드 1판」 (보통 A) */
export const runGold = (lv: number) => clearGold(lv, '보통', 'A');

export interface Gain { gold?: number; stone?: number; refined?: number; crystal?: number; shards?: number; ticket?: number; pass?: number; items?: GearItem[]; deco?: string }

function give(save: SaveData, g: Gain, now: number): Gain {
  save.player.gold += g.gold || 0;
  save.mats.stone += g.stone || 0;
  save.mats.refined += g.refined || 0;
  save.wallet.crystal += g.crystal || 0;
  save.wallet.shards = Math.min(SHARD_MAX, save.wallet.shards + (g.shards || 0));
  save.wallet.ticket += g.ticket || 0;
  for (const it of g.items || []) save.gear.bag.push(it);
  if (g.deco && !save.decos.includes(g.deco)) save.decos.push(g.deco);
  if (g.pass) g.pass = addPassXp(save, g.pass, now);
  return g;
}

/** 임무 보상 받기 (13 2-1, 12 3-4): 일일 = 골드 20% + 강화석 2, 주간 = 종 조각 1 */
export function claimMission(save: SaveData, kind: 'daily' | 'weekly', i: number, now: number): Gain | string {
  const s = (kind === 'daily' ? save.daily : save.weekly).missions[i];
  if (!s || !missionReady(s)) return '아직 못 채움';
  if (kind === 'weekly' && save.wallet.shards >= SHARD_MAX) return `종 조각이 가득 참 (최대 ${SHARD_MAX})`;
  s.got = true;
  return kind === 'daily'
    ? give(save, { gold: Math.round(runGold(save.player.level) * MISSION_REWARD.goldShare), stone: MISSION_REWARD.stone, pass: PASS_GAIN.daily }, now)
    : give(save, { shards: 1, pass: PASS_GAIN.weekly }, now);
}

/** 완료 상자 장비: 레벨에 맞는 난이도 기준 (13 2-1) */
const chestDiff = (lv: number): DiffName => (lv >= 35 ? '어려움' : '보통');

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
  const lv = save.player.level;
  const it = rollItem(r, chestDiff(lv), 'A', lv, save.nextId++);
  if (!double) onAct(save, 'chest');
  return give(save, { gold: runGold(lv), stone: CHEST_REWARD.stone, pass: double ? 0 : PASS_GAIN.chest, items: [it] }, now);
}

/** 하루 1회 무료 교체 (13 2-1) */
export function swapMission(save: SaveData, i: number, r: () => number): string {
  const d = save.daily, s = d.missions[i];
  if (!s || s.got) return '바꿀 수 없음';
  if (d.swapped) return '오늘 교체를 이미 씀';
  const basic = d.missions.filter((m, j) => j !== i && DAILY_BASIC.includes(m.key)).length;
  const nw = pick(DAILY, 1, save.player.level, r, 2 - basic, d.missions.map(m => m.key))[0];
  if (!nw) return '바꿀 임무가 없음';
  d.missions[i] = nw; d.swapped = true;
  return '';
}

/** 길드 주간 목표 (13 3장): 명성 + 길드원 전원 경험치 (다음 레벨까지의 절반) */
export function claimGuildGoal(save: SaveData): string {
  const g = save.weekly.guild;
  if (g.got || g.n < GUILD_GOAL.need) return '아직 못 채움';
  g.got = true;
  save.guild.fame += GUILD_GOAL.fame;
  for (const m of save.guild.members) {
    const p = { level: m.lv, xp: m.xp };
    addXp(p, Math.round(xpToNext(m.lv) * GUILD_GOAL.xpShare));
    m.lv = Math.min(p.level, save.player.level); m.xp = m.lv < p.level ? 0 : p.xp;
  }
  return '';
}

/** 주간 도전 월요일 상자 (13 3-2): 지난주 최고 단계 기준 장비 등급 보장 (5 희귀 / 10 영웅 / 15 영웅 2개 / 20 전설 확률) */
export function chalChestOf(stage: number): { grades: ItemGrade[]; legend: number; goldRuns: number } {
  const grades: ItemGrade[] = stage >= 15 ? ['영웅', '영웅'] : stage >= 10 ? ['영웅'] : stage >= 5 ? ['희귀'] : ['고급'];
  return { grades, legend: stage >= 20 ? 0.25 : 0, goldRuns: 1 + Math.floor(stage / 5) };
}
export function claimChalChest(save: SaveData, r: () => number, now: number): Gain | string {
  const stage = save.chalChest;
  if (!stage) return '받을 상자 없음';
  save.chalChest = 0;
  const c = chalChestOf(stage), lv = save.player.level;
  const items = c.grades.map((g, i) => {
    const slot = SLOTS[Math.floor(r() * SLOTS.length)].key;
    const grade: ItemGrade = i === 0 && lv >= LEGEND_LEVEL && r() < c.legend ? '전설' : g;
    return { id: save.nextId++, slot, grade, plus: 0, name: itemName(slot, grade) } as GearItem;
  });
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
  return { gold: f.gold ? f.gold * runGold(save.player.level) : 0, stone: f.stone, refined: f.refined, crystal: f.crystal, ticket: f.ticket, deco: f.deco || f.title };
}
export function claimPass(save: SaveData, lv: number, line: 'free' | 'prem', now: number): Gain | string {
  if (lv < 1 || lv > passLevel(save.pass.xp)) return '아직 못 올라감';
  if (line === 'prem' && !save.pass.premium) return '프리미엄 패스가 필요';
  const got = save.pass[line];
  if (got.includes(lv)) return '이미 받음';
  got.push(lv);
  return line === 'free' ? give(save, passGain(save, lv), now) : give(save, { deco: passPremium(lv) }, now);
}
export function buyPremium(save: SaveData): string {
  if (save.pass.premium) return '이미 있음';
  if (save.wallet.crystal < PASS_PREMIUM_CRYSTAL) return `크리스탈 부족 (${PASS_PREMIUM_CRYSTAL.toLocaleString()} 필요)`;
  save.wallet.crystal -= PASS_PREMIUM_CRYSTAL; save.pass.premium = true;
  return '';
}

// ---------- 상점 ----------
/** 소비 아이템 사기 (19 11장, 15 6-4) */
export function buyItem(save: SaveData, k: ItemKey, n = 1): string {
  const price = itemPrice(k, save.player.level);
  if (price == null) return '상점에서 안 팖';
  const have = save.bag[k] || 0;
  n = Math.min(n, BAG_MAX - have);
  if (n <= 0) return `가방이 가득 참 (최대 ${BAG_MAX})`;
  if (save.player.gold < price * n) return `골드 부족 (${(price * n).toLocaleString()} 필요)`;
  save.player.gold -= price * n; save.bag[k] = have + n;
  return '';
}

/** 종 조각 제작 (12 3-4) */
export function craftShard(save: SaveData): string {
  if (save.wallet.shards >= SHARD_MAX) return `종 조각이 가득 참 (최대 ${SHARD_MAX})`;
  if (save.weekly.craft >= SHARD_CRAFT.weekly) return `이번 주 제작 ${SHARD_CRAFT.weekly}번을 다 씀`;
  if (save.player.gold < SHARD_CRAFT.gold) return `골드 부족 (${SHARD_CRAFT.gold.toLocaleString()} 필요)`;
  if (save.mats.stone < SHARD_CRAFT.stone) return `강화석 부족 (${SHARD_CRAFT.stone} 필요)`;
  save.player.gold -= SHARD_CRAFT.gold; save.mats.stone -= SHARD_CRAFT.stone; save.weekly.craft++; save.wallet.shards++;
  return '';
}

/** 공훈 교환 (12 3-5): 원하는 부위 영웅 장비 1개 */
export function exchangeMerit(save: SaveData, slot: SlotKey): GearItem | string {
  if (!SLOTS.some(s => s.key === slot)) return '없는 부위';
  if (save.wallet.merit < MERIT_GEAR_COST) return `공훈 부족 (${MERIT_GEAR_COST} 필요)`;
  save.wallet.merit -= MERIT_GEAR_COST;
  const g: ItemGrade = '영웅';
  const it: GearItem = { id: save.nextId++, slot, grade: g, plus: 0, name: itemName(slot, g) };
  save.gear.bag.push(it);
  return it;
}

// ---------- 레이드 주간 규칙 · 악몽 입장 ----------
/** 레이드 보스 처치 공훈 (주 150 상한, 레이드마다 따로) */
export function meritFor(save: SaveData, raid: 10 | 20, diff: DiffName): number {
  const left = Math.max(0, MERIT_WEEK_CAP - save.weekly.merit[raid]);
  return Math.min(left, MERIT[raid][diff]);
}
export const lootKey = (content: string, diff: DiffName) => `${content}|${diff}`;
/** 이번 주 이 보스·난이도 장비를 아직 안 받음 (13 3-4) */
export const raidLootOpen = (save: SaveData, content: string, diff: DiffName) => !save.weekly.loot.includes(lootKey(content, diff));

/** 악몽 입장 = 종 조각 1개 (12 3-4) */
export const needsShard = (diff: DiffName) => diff === '악몽';
export function spendShard(save: SaveData): string {
  if (save.wallet.shards < 1) return '종 조각이 없음 (상점에서 제작하거나 주간 임무로)';
  save.wallet.shards--;
  return '';
}

/** 일일 공개모집 보너스 판이면 장비 굴림 난이도를 한 단계 위로 (13 2-2) */
export const bonusDiff = (d: DiffName): DiffName => ALL_DIFFS[Math.min(ALL_DIFFS.length - 1, ALL_DIFFS.indexOf(d) + 1)];

/** 월정액 (15 5장): 30일 연장 + 크리스탈 300 바로 */
export function grantMember(save: SaveData, now: number): void {
  save.member = Math.max(save.member, now) + MEMBER.days * 24 * 3600e3;
  save.wallet.crystal += MEMBER.now;
}
