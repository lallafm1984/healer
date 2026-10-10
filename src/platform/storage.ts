/**
 * 기기 저장 (21 0-5). 한 덩어리 JSON + 버전 번호. 버전이 오르면 migrate에서 옛 저장을 고친다.
 * 지금은 localStorage. 앱에서 OS가 웹 저장소를 지울 위험이 보이면 Capacitor Preferences로 바꾼다.
 */
import type { DiffName } from '../data/difficulty';
import { EXTRA_LINES, itemName, kindOf, rollLines, rollSpecs, specCount, specKeysOf, SLOTS, type Equipped, type GearItem } from '../data/equipment';
import { rngFrom } from '../engine/rng';
import { codexGroupOf, codexKeys, SPEC_TITLES } from '../data/specials';
import { DEX_TABS, dexKeys, dexKeysOf, dexTabOf } from '../data/dex';
import type { GuildMember, PostTier } from '../data/guild';
import { HERO_KEYS, HEROES, type HeroKey } from '../data/heroes';
import { STARTER_BAG } from '../data/economy';
import type { ItemKey } from '../data/items';
import type { Grade } from '../data/progression';

export const SAVE_KEY = 'healer.save';
export const SAVE_VERSION = 8;

/** 칸 탭 기본 힐 = 휠 칸 (이름은 사제 스킬 이름 그대로: heal = 기본 힐 칸, flash = 빠른 힐 칸, renew = 지속 힐 칸) */
export type TapKey = 'heal' | 'flash' | 'renew';

/** 직업마다 따로 두는 것 (25 4-1, 34 3-1): 휠 배치·칸 탭, 레벨·경험치, 퀘스트, 클리어 수 */
export interface HeroSave {
  layout: Record<string, string | null> | null;
  tapKey: TapKey;
  /** 직업 퀘스트를 끝냄 (사제는 처음부터) */
  unlocked: boolean;
  /** 직업 퀘스트 진행 */
  quest: number;
  /** 이 직업으로 이긴 판 수 */
  wins: number;
  /**
   * 직업 레벨·경험치 (34 3장). 지금 직업 것은 player.level·xp에 있고, 바꿀 때 여기에 넣고 꺼냄.
   * 없으면 아직 이 직업으로 안 해 봄 = Lv 1
   */
  level?: number;
  xp?: number;
  /** 특성 (06 6장): 단마다 고른 칸 번호 (0~2, 안 고름 = null). 직업마다 따로 (25 4-1). 지금 프리셋의 고름 */
  talents?: (number | null)[];
  /**
   * 특성 프리셋 3벌 (27 4-5). 지금 프리셋 칸은 바꿀 때 talents에서 넣어 두고, 다른 칸을 talents로 꺼냄.
   * 옛 저장엔 없음 = 프리셋 1 하나 (지금 talents)
   */
  presets?: (number | null)[][];
  /** 지금 프리셋 (0~2, 없으면 0) */
  preset?: number;
}

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** 스킬 휠 위치 (왼손 모드) */
  hand: 'right' | 'left';
  /** 칸 탭 기본 힐 */
  tapKey: TapKey;
  /** 20인 판에서 탭한 칸 확대 */
  zoom: boolean;
  /** 하단 스킬 단축 패널. 옛 저장과 첫 실행은 기존 휠 유지 */
  compactSkills: boolean;
  /** 전투 정보는 유지하고 흔들림·부유 숫자 등 시각 효과를 줄임 */
  reducedEffects: boolean;
  /** 강화 연출 짧게 (0.5초, 34 7-3). 옛 저장엔 없음 = 꺼짐 */
  quickEnhance?: boolean;
  /** 개발 빌드: 자동 힐러로 구경 */
  auto: boolean;
  /** 개발 빌드: 콘텐츠 레벨 잠금 무시 (아직 레벨을 올릴 콘텐츠가 적어서) */
  devUnlock: boolean;
  /** 개발 빌드: 레벨과 상관없이 스킬 전부 (06 7장 해금 무시) */
  allSkills: boolean;
  /** 스킬 휠 8방향 배치 (09 S17). null = 기본 배치 */
  layout: Record<string, string | null> | null;
}

export interface ClearRecord {
  /** 받은 별 (가장 많이 받은 판) */
  stars: number;
  grade: Grade;
  /** 가장 빠른 클리어 (초) */
  best: number;
  n: number;
}

/** 인연 스카우트 후보 (02 9-3 ②): 공개모집에서 잘 살려 줘서 호감도가 가득 찬 파티원 */
export type Scout = Omit<GuildMember, 'id' | 'xp' | 'aptUp' | 'star' | 'runs'> & { from: string };

/** 길드 (02 9장): Lv 15에 열림 */
export interface GuildSave {
  name: string;
  members: GuildMember[];
  scouts: Scout[];
  /** 낸 공고와 지원자 3명 (고를 때까지 남음) */
  post: { tier: PostTier; cands: GuildMember[] } | null;
  /** 길드 명성: 길드파티로 이긴 판 (명성 지원자는 나중에) */
  fame: number;
  nextId: number;
  /** 마지막 길드파티 편성 (길드원 id) */
  pick: number[];
}

export const newGuild = (): GuildSave => ({ name: '새벽의 손', members: [], scouts: [], post: null, fame: 0, nextId: 1, pick: [] });

/** 임무 하나: 진행 · 보상 받음 */
export interface MissionSave { key: string; n: number; got: boolean }

/** 매일 오전 6시에 새로 (13 1장) */
export interface DailySave {
  /** 리셋 기준 날짜 (YYYY-MM-DD) */
  day: string;
  missions: MissionSave[];
  /** 하루 1회 무료 교체를 씀 */
  swapped: boolean;
  /** 오늘 완료 상자를 받음 */
  chest: boolean;
  /** 놓친 날 완료 상자 (최대 2, 13 7장) */
  banked: number;
  /** 공개모집 보너스를 쓴 판 수 (13 2-2) */
  pub: number;
  /** 보상형 광고를 본 횟수 (15 7장) */
  ads: { cont: number; chest: number; reroll: number };
  /** 오늘 완료 상자 2배 (광고) 받음 */
  chest2: boolean;
}

/** 매주 월요일 오전 6시에 새로 */
export interface WeeklySave {
  week: string;
  missions: MissionSave[];
  /** 악몽 열쇠 제작 횟수 (주 5회) */
  craft: number;
  /** 레이드마다 이번 주 받은 공훈 (상한 150) */
  merit: { 10: number; 20: number };
  /** 이번 주 장비를 받은 레이드 보스·난이도 (13 3-4: 보스마다 난이도별 주 1회) */
  loot: string[];
  /** 주간 도전: 이번 주 제한시간 안에 깬 최고 단계 */
  chalBest: number;
  /** 길드 주간 목표 진행 · 받음 */
  guild: { n: number; got: boolean };
}

/** 시즌 패스 (15 4장) */
export interface PassSave { season: number; xp: number; premium: boolean; free: number[]; prem: number[] }

export interface SaveData {
  v: number;
  /** 처음 만든 시각 (ms) */
  createdAt: number;
  settings: Settings;
  /** level·xp = 지금 직업 레벨 (34 3장, 다른 직업 것은 heroes에). gold는 계정 */
  player: { level: number; xp: number; gold: number };
  /**
   * seen = 캐릭터 › 장비에서 마지막으로 본 장비 id (이보다 큰 id = 새것 점, 27 4-2). 옛 저장엔 없어서 migrate가 채움.
   * codex = 얻은 적 있는 특수능력 · 이름 있는 장신구 키 (도감, 42 1-6). v8부터, 옛 저장은 가진 장비로 채움
   */
  gear: { equipped: Equipped; bag: GearItem[]; seen?: number; codex: string[]; /** 장비 도감 칸 (34 6-10 ④, data/dex). 옛 저장은 가진 장비로 채움 */ dex: string[]; /** 장비 도감 보상을 받은 단계 수 */ dexPaid: number };
  /** 강화 재료 (12 1장): 강화석 (+1~+5), 정제 강화석 (+6~+10) */
  mats: { stone: number; refined: number };
  /** 소비 아이템 단축칸 구성 */
  items: ItemKey[];
  /** 콘텐츠 → 난이도 → 기록 */
  clears: Record<string, Partial<Record<DiffName, ClearRecord>>>;
  /** 로비에 보여 줄 지난 판 한마디 */
  last: { content: string; diff: DiffName; win: boolean; grade: string | null } | null;
  /** 장비 id 발급용 */
  nextId: number;
  /** 첫 5분 튜토리얼 진행 (game/tutorial.ts TUT) */
  tut: number;
  /** 지금 직업 (25). settings.layout·tapKey는 지금 직업 것이고, 바꿀 때 heroes에 넣고 꺼냄 */
  hero: HeroKey;
  heroes: Partial<Record<HeroKey, HeroSave>>;
  /** v4: 길드 (02 9장, 17) */
  guild: GuildSave;
  /** v5: 재화 (12): 크리스탈 · 악몽 열쇠 (최대 5) · 공훈 · 모집권 */
  wallet: { crystal: number; shards: number; merit: number; ticket: number };
  /** v5: 소비 아이템 가방 (19 11장, 종류마다 최대 20) */
  bag: Partial<Record<ItemKey, number>>;
  daily: DailySave;
  weekly: WeeklySave;
  pass: PassSave;
  /** 월정액 끝나는 시각 (ms, 0 = 없음) */
  member: number;
  /** 주간 도전: 열린 단계 (실패해도 안 내려감, 13 7장) */
  chalOpen: number;
  /** 받은 칭호·꾸미기 이름 (그림은 원화 작업 때) */
  decos: string[];
  /** 지난주 주간 도전 최고 단계 → 월요일 상자 (0 = 없음) */
  chalChest: number;
  /** 첫 구매 보너스를 받은 상품 (15 3장) */
  firstBuy: string[];
}

export const newDaily = (day = ''): DailySave => ({ day, missions: [], swapped: false, chest: false, banked: 0, pub: 0, ads: { cont: 0, chest: 0, reroll: 0 }, chest2: false });
export const newWeekly = (week = ''): WeeklySave => ({ week, missions: [], craft: 0, merit: { 10: 0, 20: 0 }, loot: [], chalBest: 0, guild: { n: 0, got: false } });

/** 그 직업의 저장 (없으면 기본: 기본 배치, 칸 탭 = 기본 힐 칸, 사제만 처음부터 해금) */
export function heroSaveOf(d: SaveData, h: HeroKey): HeroSave {
  return (d.heroes[h] ||= { layout: null, tapKey: 'heal', unlocked: h === 'priest', quest: 0, wins: 0 });
}

/** 그 직업 레벨 (지금 직업은 player, 안 해 본 직업은 1) */
export function heroLevelOf(d: SaveData, h: HeroKey): number {
  return h === d.hero ? d.player.level : d.heroes[h]?.level ?? 1;
}

/** 가장 높은 직업 레벨 (34 3-1): 직업 해금 · 직업 바꾸기 · 길드 · 상점 물약 · 임무 보상 같은 계정 것의 기준 */
export function topLevel(d: SaveData): number {
  return Math.max(d.player.level, ...HERO_KEYS.map(h => d.heroes[h]?.level ?? 1));
}

export const DEFAULT_SETTINGS: Settings = { sound: true, vibrate: true, hand: 'right', tapKey: 'heal', zoom: true, compactSkills: false, reducedEffects: false, auto: false, devUnlock: true, allSkills: false, layout: null };

export function newSave(now = Date.now()): SaveData {
  return {
    v: SAVE_VERSION, createdAt: now, settings: { ...DEFAULT_SETTINGS },
    player: { level: 1, xp: 0, gold: 0 }, gear: { equipped: {}, bag: [], seen: 0, codex: [], dex: [], dexPaid: 0 }, mats: { stone: 0, refined: 0 }, items: ['mana', 'life'], clears: {}, last: null, nextId: 1, tut: 0,
    hero: 'priest', heroes: {}, guild: newGuild(),
    wallet: { crystal: 0, shards: 0, merit: 0, ticket: 0 }, bag: { ...STARTER_BAG }, daily: newDaily(), weekly: newWeekly(),
    pass: { season: 0, xp: 0, premium: false, free: [], prem: [] }, member: 0, chalOpen: 1, decos: [], chalChest: 0, firstBuy: [],
  };
}

/** 옛 버전 저장을 지금 버전으로. 모르는 값은 새 저장 기본값으로 채움 */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return newSave();
  const o = raw as Partial<SaveData>;
  const base = newSave(typeof o.createdAt === 'number' ? o.createdAt : Date.now());
  const obj = <T extends object>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...d, ...(v as T) } : d);
  return {
    ...base, ...o, v: SAVE_VERSION,
    settings: obj(o.settings, base.settings),
    player: obj(o.player, base.player),
    // 27: 새것 점 기준 (옛 저장은 지금 가진 장비를 다 본 것으로)
    gear: gearOf(o, HERO_KEYS.includes(o.hero as HeroKey) ? (o.hero as HeroKey) : 'priest', base.nextId),
    mats: obj(o.mats, base.mats),
    items: Array.isArray(o.items) ? o.items : base.items,
    clears: obj(o.clears, {}),
    last: o.last && typeof o.last === 'object' ? o.last : null,
    nextId: typeof o.nextId === 'number' ? o.nextId : base.nextId,
    // 튜토리얼 전에 만든 저장: 이미 해 본 사람이면 끝난 걸로 (3 = TUT.done). 2 = 예전 「녹슨 요새 첫 클리어」 단계 → 끝 (34 5-2)
    tut: typeof o.tut === 'number' ? (o.tut === 2 ? 3 : o.tut) : (o.player?.level ?? 1) > 1 || Object.keys(o.clears || {}).length ? 3 : 0,
    // v3: 직업 (옛 저장은 사제)
    hero: HERO_KEYS.includes(o.hero as HeroKey) ? (o.hero as HeroKey) : 'priest',
    heroes: heroesOf(o),
    // v4: 길드 (옛 저장은 빈 길드)
    guild: guildOf(o.guild),
    // v5: 재화·가방·임무·패스 (옛 저장은 처음 가방부터)
    wallet: obj(o.wallet, base.wallet),
    bag: obj(o.bag, base.bag),
    daily: o.daily && typeof o.daily === 'object' ? { ...base.daily, ...o.daily, ads: obj(o.daily.ads, base.daily.ads) } : base.daily,
    weekly: o.weekly && typeof o.weekly === 'object' ? { ...base.weekly, ...o.weekly, merit: obj(o.weekly.merit, base.weekly.merit), guild: obj(o.weekly.guild, base.weekly.guild) } : base.weekly,
    pass: obj(o.pass, base.pass),
    member: typeof o.member === 'number' ? o.member : 0,
    chalOpen: typeof o.chalOpen === 'number' ? o.chalOpen : 1,
    decos: Array.isArray(o.decos) ? o.decos : [],
    chalChest: typeof o.chalChest === 'number' ? o.chalChest : 0,
    firstBuy: Array.isArray(o.firstBuy) ? o.firstBuy : [],
  };
}

/**
 * 옛 장비를 지금 모양으로: 세트 표시를 빼고 (세트 장비 제거), 종류가 없으면 그 부위 첫 종류 + 등급만큼 추가 옵션 굴림 (v7, 34 12장 6번),
 * 특수능력 줄이 없으면 등급만큼 굴림 (v8, 42 1-1, 직업 전용은 그 저장의 지금 직업 것).
 * 굴림은 장비 id로 정해서 몇 번 불러도 같음. 이름은 등급 말 + 종류
 */
function upgradeItem(it: GearItem, hero: HeroKey): GearItem {
  if (!it || typeof it !== 'object') return it;
  const c: GearItem & { set?: unknown } = { ...it };
  delete c.set;
  if (!c.kind || !Array.isArray(c.lines)) {
    const k = kindOf(c);
    c.kind = k.key;
    c.lines = rollLines(rngFrom(Math.imul(c.id || 1, 0x2545f491) ^ 0x6a09e667), EXTRA_LINES[c.grade] ?? 1, k.fixed);
  }
  if (!Array.isArray(c.specs)) {
    const r = rngFrom(Math.imul(c.id || 1, 0x9e3779b1) ^ 0x3c6ef372);
    c.specs = rollSpecs(r, c.slot, c.grade, specCount(r, c.grade), { hero });
  }
  c.name = itemName(c);
  return c;
}

/** 장비 칸 (v8: 옛 장비 특수능력 굴림, 도감에 가진 장비의 특수능력을 채움) */
function gearOf(o: Partial<SaveData>, hero: HeroKey, nextId: number): SaveData['gear'] {
  const g = o.gear;
  const equipped: Equipped = {};
  if (g?.equipped && typeof g.equipped === 'object') for (const [k, it] of Object.entries(g.equipped)) if (it) equipped[k as keyof Equipped] = upgradeItem(it, hero);
  const bag = Array.isArray(g?.bag) ? g!.bag.map(it => upgradeItem(it, hero)) : [];
  // 가진 장비의 특수능력은 늘 도감에 (옛 저장 · migrate가 굴린 줄 포함)
  const codex = Array.isArray(g?.codex) ? g!.codex.filter(k => typeof k === 'string') : [];
  for (const it of [...SLOTS.map(s => equipped[s.key]), ...bag]) if (it) for (const k of specKeysOf(it)) if (!codex.includes(k)) codex.push(k);
  // 장비 도감도 가진 장비로 채움 (34 6-10 ④)
  const dex = Array.isArray(g?.dex) ? g!.dex.filter(k => typeof k === 'string') : [];
  for (const it of [...SLOTS.map(s => equipped[s.key]), ...bag]) if (it) for (const k of dexKeysOf(it)) if (!dex.includes(k)) dex.push(k);
  const dexPaid = typeof g?.dexPaid === 'number' ? g.dexPaid : 0;
  return { equipped, bag, seen: typeof g?.seen === 'number' ? g.seen : (typeof o.nextId === 'number' ? o.nextId : nextId) - 1, codex, dex, dexPaid };
}

/**
 * 새 장비의 특수능력을 도감에 적고, 처음 얻은 것만 돌려줌 (결과 화면 「새 특수능력!」, 42 1-6).
 * 그걸로 도감 묶음 하나를 다 모으면 칭호를 decos에 넣음
 */
export function noteSpecs(d: SaveData, items: readonly (GearItem | null | undefined)[]): string[] {
  noteDex(d, items);
  const out: string[] = [];
  for (const it of items) if (it) for (const k of specKeysOf(it)) if (!d.gear.codex.includes(k)) { d.gear.codex.push(k); out.push(k); }
  for (const k of out) {
    const g = codexGroupOf(k), t = g && SPEC_TITLES[g];
    if (t && !d.decos.includes(t) && codexKeys(g).every(x => d.gear.codex.includes(x))) d.decos.push(t);
  }
  return out;
}

/** 새 장비를 장비 도감에 적고 처음 채운 칸을 돌려줌 (34 6-10 ④). 묶음 하나를 다 채우면 칭호를 decos에 넣음 */
export function noteDex(d: SaveData, items: readonly (GearItem | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const it of items) if (it) for (const k of dexKeysOf(it)) if (!d.gear.dex.includes(k)) { d.gear.dex.push(k); out.push(k); }
  for (const t of DEX_TABS) if (out.some(k => dexTabOf(k) === t.key) && !d.decos.includes(t.title) && dexKeys(t.key).every(k => d.gear.dex.includes(k))) d.decos.push(t.title);
  return out;
}

/**
 * v6 직업별 레벨 (34 3-4): 옛 저장의 레벨·경험치를 열린 모든 직업에 넣음 (손해 없음). 지금 직업 것은 player 그대로.
 * 아직 안 연 직업 (퀘스트 중 포함)은 열 때 Lv 1
 */
function heroesOf(o: Partial<SaveData>): SaveData['heroes'] {
  const hs: SaveData['heroes'] = o.heroes && typeof o.heroes === 'object' ? { ...o.heroes } : {};
  if ((o.v ?? 0) >= 6) return hs;
  const level = typeof o.player?.level === 'number' ? o.player.level : 1, xp = typeof o.player?.xp === 'number' ? o.player.xp : 0;
  const cur = HERO_KEYS.includes(o.hero as HeroKey) ? o.hero : 'priest';
  for (const h of HERO_KEYS) {
    const s = hs[h], open = !HEROES[h].unlock.quest || !!s?.unlocked;
    if (!open || h === cur) continue;
    hs[h] = { layout: null, tapKey: 'heal', unlocked: h === 'priest', quest: 0, wins: 0, ...s, level, xp };
  }
  return hs;
}

function guildOf(v: unknown): GuildSave {
  const d = newGuild();
  if (!v || typeof v !== 'object') return d;
  const g = v as Partial<GuildSave>;
  return {
    name: typeof g.name === 'string' ? g.name : d.name,
    members: Array.isArray(g.members) ? g.members : [],
    scouts: Array.isArray(g.scouts) ? g.scouts : [],
    post: g.post && typeof g.post === 'object' && Array.isArray(g.post.cands) ? g.post : null,
    fame: typeof g.fame === 'number' ? g.fame : 0,
    nextId: typeof g.nextId === 'number' ? g.nextId : 1,
    pick: Array.isArray(g.pick) ? g.pick : [],
  };
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
}

function store(): KV | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** 프로토타입 화면이 따로 쓰던 키 (스킬 배치·단축칸). 처음 v2로 올릴 때 한 번 가져온다 */
const OLD_LAYOUT = 'nhh.skillLayout.v1';
const OLD_ITEMS = 'nhh.items.v1';

export function load(kv: KV | null = store()): SaveData {
  try {
    const s = kv?.getItem(SAVE_KEY);
    const raw = s ? JSON.parse(s) : null;
    const d = migrate(raw);
    if (!raw || raw.v < 2) {
      try {
        const lay = kv?.getItem(OLD_LAYOUT);
        if (lay) d.settings.layout = JSON.parse(lay);
        const it = kv?.getItem(OLD_ITEMS);
        if (it) { const a = JSON.parse(it); if (Array.isArray(a)) d.items = a; }
      } catch { /* 옛 값이 깨졌으면 기본값 */ }
    }
    return d;
  } catch {
    return newSave();
  }
}

export function save(data: SaveData, kv: KV | null = store()): boolean {
  try { kv?.setItem(SAVE_KEY, JSON.stringify(data)); return !!kv; } catch { return false; }
}
