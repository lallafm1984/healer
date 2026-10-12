/**
 * 기기 저장 (21 0-5). 한 덩어리 JSON + 버전 번호. 버전이 오르면 migrate에서 옛 저장을 고친다.
 * 지금은 localStorage. 앱에서 OS가 웹 저장소를 지울 위험이 보이면 Capacitor Preferences로 바꾼다.
 */
import type { DiffName } from '../data/difficulty';
import { itemName, kindOf, LEGEND, lookOf, randomLines, rollLines, takenStats, rollSpecs, specCount, specKeysOf, SLOTS, type Equipped, type GearItem } from '../data/equipment';
import { uniqueOf } from '../data/uniques';
import { namedOf, SPECS } from '../data/specials';
import { rngFrom } from '../engine/rng';
import { codexGroupOf, codexKeys, SPEC_TITLES } from '../data/specials';
import { DEX_TABS, dexKeys, dexKeysOf, dexTabOf } from '../data/dex';
import type { GuildMember, PostTier } from '../data/guild';
import { HERO_KEYS, HEROES, type HeroKey } from '../data/heroes';
import { CONTENT } from '../data/content';
import { STARTER_BAG } from '../data/economy';
import type { ItemKey } from '../data/items';
import type { Grade } from '../data/progression';

export const SAVE_KEY = 'healer.save';
export const SAVE_VERSION = 11;

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
  /**
   * 직업마다 장비 (v10, 2026-10-12 Lim 「한 직업을 다 키우면 새로운 느낌으로 다시」): 착용 · 가방 · 새것 점 기준.
   * 지금 직업 것은 save.gear에 있고, 바꿀 때 여기에 넣고 꺼냄 (레벨과 같은 방식). 없으면 아직 장비 없음 = 맨몸으로 시작.
   * 도감 · 골드 · 강화석 같은 재료는 계정 (save.gear.codex · dex, mats)
   */
  gear?: HeroGear;
  /** 직업마다 공훈 (v10): 레이드에서 번 공훈 n · 그 주 week에 받은 양 got (주 상한). 지금 직업 것은 wallet.merit · weekly.merit */
  merit?: HeroMerit;
}

/** 다른 직업에 넣어 둔 장비 (HeroSave.gear) */
export interface HeroGear { equipped: Equipped; bag: GearItem[]; seen: number }
/** 다른 직업에 넣어 둔 공훈 (HeroSave.merit). week가 이번 주가 아니면 got은 0으로 봄 */
export interface HeroMerit { n: number; week: string; got: { 10: number; 20: number } }

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
  /** 10 · 20인 레이드 판도 5인 던전 칸 모양으로 그리고 칸 크기 비율대로 줄임 (2026-10-11 Lim 비교용). 옛 저장엔 없음 = 꺼짐 */
  raidFiveLook?: boolean;
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
  /** 레이드마다 이번 주 받은 공훈 (상한 150). v10부터 지금 직업 것 (공훈이 직업마다) */
  merit: { 10: number; 20: number };
  /** 이번 주 장비를 받은 레이드 보스·난이도 (13 3-4: 보스마다 난이도별 주 1회). v10부터 직업마다 (「직업|장소|난이도」, 장비가 직업마다라서) */
  loot: string[];
  /** 주간 도전: 이번 주 제한시간 안에 깬 최고 단계 */
  chalBest: number;
  /** chalBest를 세운 직업 (v10): 월요일 상자는 그 직업이 받음 (장비가 직업마다라서) */
  chalHero?: HeroKey;
  /** 길드 주간 목표 진행 · 받음 */
  guild: { n: number; got: boolean };
}

/** 시즌 패스 (15 4장) */
export interface PassSave { season: number; xp: number; premium: boolean; free: number[]; prem: number[] }

/**
 * 캐릭터 하나 (68, v11): 칸 하나에 캐릭터 하나, 직업은 만들 때 고정. 캐릭터마다 따로 계정처럼 (골드 · 장비 · 도감 · 임무 · 기록 전부).
 * 지금 캐릭터 저장은 SAVE_KEY, 쉬는 캐릭터는 charKey(id)에 통째로
 */
export interface CharMeta {
  id: number;
  hero: HeroKey;
  name: string;
  /** 마지막으로 저장할 때 레벨 (캐릭터 선택에 보임) */
  level: number;
  /** 마지막으로 고른 시각 (ms) */
  at: number;
  /** 아직 따로 키에 안 쓴 쉬는 캐릭터 (저장 옮기기 직후 · 기기 저장이 없을 때). save()가 charKey(id)에 쓰고 지움 */
  park?: SaveData;
}

/** 캐릭터 목록 (계정): cur = 지금 캐릭터 id, slots = 산 칸 수 (처음 1), next = 다음 캐릭터 id */
export interface Roster { cur: number; slots: number; next: number; chars: CharMeta[] }

export interface SaveData {
  v: number;
  /** 처음 만든 시각 (ms) */
  createdAt: number;
  settings: Settings;
  /** level·xp = 지금 직업 레벨 (34 3장, 다른 직업 것은 heroes에). gold는 계정 */
  player: { level: number; xp: number; gold: number };
  /**
   * equipped · bag · seen = 지금 직업의 장비 (v10부터 직업마다, 다른 직업 것은 heroes[h].gear).
   * seen = 캐릭터 › 장비에서 마지막으로 본 장비 id (이보다 큰 id = 새것 점, 27 4-2). 옛 저장엔 없어서 migrate가 채움.
   * codex = 얻은 적 있는 특수능력 · 이름 있는 장신구 키 (도감, 42 1-6). v8부터, 옛 저장은 가진 장비로 채움. 도감 · 장비 도감은 계정
   */
  gear: { equipped: Equipped; bag: GearItem[]; seen?: number; codex: string[]; /** 장비 도감 칸 (34 6-10 ④, data/dex). 옛 저장은 가진 장비로 채움 */ dex: string[]; /** 장비 도감 보상을 받은 단계 수 */ dexPaid: number };
  /** 강화 재료 (12 1장): 강화석 (+1~+5), 정제 강화석 (+6~+10) */
  mats: { stone: number; refined: number };
  /** 소비 아이템 단축칸 구성. null은 빈자리이며 옛 압축 배열도 같은 순서로 읽는다. */
  items: (ItemKey | null)[];
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
  /** 주간 도전 상자를 받을 직업 (그 기록을 세운 직업, v10). 없으면 아무 직업이나 (옛 저장) */
  chalChestHero?: HeroKey;
  /** 첫 구매 보너스를 받은 상품 (15 3장) */
  firstBuy: string[];
  /** v11: 캐릭터 목록 (계정, 68). 캐릭터를 바꿀 때 shareAccount가 새 캐릭터 저장으로 옮김 */
  roster: Roster;
}

export const newDaily = (day = ''): DailySave => ({ day, missions: [], swapped: false, chest: false, banked: 0, pub: 0, ads: { cont: 0, chest: 0, reroll: 0 }, chest2: false });
export const newWeekly = (week = ''): WeeklySave => ({ week, missions: [], craft: 0, merit: { 10: 0, 20: 0 }, loot: [], chalBest: 0, guild: { n: 0, got: false } });

/** 그 직업의 저장 (없으면 기본: 기본 배치, 칸 탭 = 기본 힐 칸, 사제만 처음부터 해금) */
export function heroSaveOf(d: SaveData, h: HeroKey): HeroSave {
  return (d.heroes[h] ||= { layout: null, tapKey: 'heal', unlocked: h === 'priest', quest: 0, wins: 0 });
}

/** 그 직업 레벨 (지금 캐릭터 직업은 player, 다른 직업은 그 직업 캐릭터 중 가장 높은 레벨 (v11), 없으면 1) */
export function heroLevelOf(d: SaveData, h: HeroKey): number {
  if (h === d.hero) return d.player.level;
  const cs = d.roster?.chars.filter(c => c.hero === h && c.id !== d.roster.cur) ?? [];
  return cs.length ? Math.max(...cs.map(c => c.level)) : d.heroes[h]?.level ?? 1;
}

/** 기준 레벨 (34 3-1): 길드 · 상점 물약 · 임무 보상 같은 것의 기준. v11부터 캐릭터마다 따로라 지금 캐릭터 레벨 (다른 직업 레벨이 저장에 안 남음) */
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
    roster: newRoster('priest', now),
  };
}

/** 캐릭터 하나짜리 목록 (새 저장: 사제, 튜토리얼) */
export const newRoster = (hero: HeroKey, now: number, level = 1): Roster => ({ cur: 1, slots: 1, next: 2, chars: [{ id: 1, hero, name: HEROES[hero].name, level, at: now }] });

/** 옛 버전 저장을 지금 버전으로. 모르는 값은 새 저장 기본값으로 채움 */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return newSave();
  const o = raw as Partial<SaveData>;
  const base = newSave(typeof o.createdAt === 'number' ? o.createdAt : Date.now());
  const obj = <T extends object>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...d, ...(v as T) } : d);
  const out: SaveData = {
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
    roster: rosterOf(o.roster, HERO_KEYS.includes(o.hero as HeroKey) ? (o.hero as HeroKey) : 'priest', base.createdAt),
  };
  if ((o.v ?? 0) < 10) gearByHero(out);
  if ((o.v ?? 0) < 11) splitChars(out, out.createdAt);
  return out;
}

/** 저장의 캐릭터 목록 (깨졌거나 없으면 지금 직업 캐릭터 하나) */
function rosterOf(v: unknown, hero: HeroKey, now: number): Roster {
  const r = v as Partial<Roster> | null;
  if (!r || typeof r !== 'object' || !Array.isArray(r.chars)) return newRoster(hero, now);
  const chars = r.chars.filter(c => c && typeof c.id === 'number' && HERO_KEYS.includes(c.hero)).map(c => ({ ...c, name: typeof c.name === 'string' ? c.name : HEROES[c.hero].name, level: typeof c.level === 'number' ? c.level : 1, at: typeof c.at === 'number' ? c.at : 0 }));
  if (!chars.length) return newRoster(hero, now);
  const cur = chars.some(c => c.id === r.cur) ? r.cur! : chars[0].id;
  return { cur, slots: Math.max(chars.length, typeof r.slots === 'number' ? r.slots : 1), next: Math.max(typeof r.next === 'number' ? r.next : 0, ...chars.map(c => c.id + 1)), chars };
}

// ---------- 캐릭터 (68, v11) ----------

/** 쉬는 캐릭터 저장 키 */
export const charKey = (id: number) => `healer.char.${id}`;

/**
 * 계정 것을 새 캐릭터 저장으로 옮김 (68 3장): 설정 (휠 배치 · 칸 탭은 캐릭터 것) · 돈 주고 산 것 (크리스탈 · 월정액 · 패스 · 첫 구매) · 캐릭터 목록.
 * 나머지 (골드 · 재료 · 장비 · 도감 · 임무 · 광고 횟수 · 기록)는 캐릭터마다
 */
export function shareAccount(from: SaveData, to: SaveData): void {
  to.settings = { ...from.settings, layout: to.settings.layout, tapKey: to.settings.tapKey };
  to.wallet.crystal = from.wallet.crystal;
  to.member = from.member;
  to.firstBuy = [...from.firstBuy];
  to.pass = { ...from.pass, free: [...from.pass.free], prem: [...from.pass.prem] };
  to.roster = from.roster;
}

/** 쉬는 캐릭터 저장을 읽음 (아직 따로 안 쓴 것 먼저). 목록은 지금 저장 것을 그대로 씀 (shareAccount) */
export function loadChar(d: SaveData, id: number, kv: KV | null = store()): SaveData | null {
  const c = d.roster.chars.find(x => x.id === id);
  if (!c || id === d.roster.cur) return null;
  if (c.park) return c.park;
  try {
    const s = kv?.getItem(charKey(id));
    return s ? migrate(JSON.parse(s)) : null;
  } catch {
    return null;
  }
}

/** 지금 캐릭터를 쉬게 둠 (다음 save()가 charKey에 씀). 목록은 빼고 (계정 것이라 지금 저장에만) */
export function parkChar(d: SaveData): void {
  const c = d.roster.chars.find(x => x.id === d.roster.cur);
  if (!c) return;
  c.level = d.player.level; c.hero = d.hero;
  const p = { ...d } as Partial<SaveData>;
  delete p.roster;
  c.park = p as SaveData;
}

/** 쉬는 캐릭터 저장을 모두 지움 (설정 「저장 지우고 처음부터」) */
export function wipeChars(d: SaveData, kv: KV | null = store()): void {
  for (const c of d.roster.chars) { delete c.park; try { kv?.removeItem?.(charKey(c.id)); } catch { /* 없으면 그만 */ } }
}

/**
 * v11 캐릭터 나누기 (68 4장): 해 본 직업마다 캐릭터 하나 (지금 직업 · 해금 · 레벨 · 경험치 · 이긴 판 · 장비가 있는 직업). 칸 = 캐릭터 수.
 * 직업마다였던 것 (레벨 · 장비 · 공훈 · 휠 배치 · 특성 · 레이드 주 1회 장비)은 그 캐릭터로. 계정이던 것 (골드 · 재료 · 열쇠 · 소비 아이템 · 도감 · 임무 · 상자 · 길드 · 칭호)은
 * 가장 높은 레벨 캐릭터 (같으면 지금 캐릭터, v10 장비 주인과 같음)가 갖고, 나머지는 골드 0 · 처음 가방 · 자기 장비로 다시 채운 도감 · 새 임무.
 * 클리어 기록은 나머지 캐릭터도 자기 레벨로 들어갈 수 있는 장소 것만 (난이도 사슬이 닫히지 않게)
 */
function splitChars(d: SaveData, now: number): void {
  const hs = (h: HeroKey) => d.heroes[h];
  const cur = d.hero;
  const lvOf = (h: HeroKey) => (h === cur ? d.player.level : hs(h)?.level ?? 1);
  const played = (h: HeroKey) => {
    const s = hs(h);
    return h === cur || (!!s && (s.unlocked || lvOf(h) > 1 || (s.xp ?? 0) > 0 || s.wins > 0 || !!s.gear));
  };
  const list = HERO_KEYS.filter(played);
  if (list.length === 1) { d.roster = newRoster(cur, now, d.player.level); return; }
  const main = list.reduce<HeroKey>((b, h) => (lvOf(h) > lvOf(b) ? h : b), cur);
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const week = d.weekly.week, chalOwner = d.weekly.chalHero ?? main, chestOwner = d.chalChestHero ?? main;
  const build = (h: HeroKey): SaveData => {
    const s = h === cur ? null : hs(h), mine = h === main, lv = lvOf(h);
    const c = newSave(d.createdAt);
    const hero: HeroSave = { ...(hs(h) ?? { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0 }), unlocked: true };
    delete hero.level; delete hero.xp; delete hero.gear; delete hero.merit;
    const g = s ? s.gear : { equipped: d.gear.equipped, bag: d.gear.bag, seen: d.gear.seen ?? d.nextId - 1 };
    const merit = s ? { n: s.merit?.n ?? 0, got: s.merit?.week === week ? s.merit.got : { 10: 0, 20: 0 } } : { n: d.wallet.merit, got: d.weekly.merit };
    Object.assign(c, {
      hero: h, heroes: { [h]: hero }, tut: d.tut, nextId: d.nextId, items: [...d.items],
      settings: { ...d.settings, layout: s ? s.layout : d.settings.layout, tapKey: s ? s.tapKey : d.settings.tapKey },
      player: { level: lv, xp: s ? s.xp ?? 0 : d.player.xp, gold: mine ? d.player.gold : 0 },
      gear: { equipped: g?.equipped ?? {}, bag: g?.bag ?? [], seen: g?.seen ?? d.nextId - 1, codex: mine ? d.gear.codex : [], dex: mine ? d.gear.dex : [], dexPaid: mine ? d.gear.dexPaid : 0 },
      mats: mine ? d.mats : c.mats, bag: mine ? d.bag : c.bag,
      wallet: { crystal: d.wallet.crystal, shards: mine ? d.wallet.shards : 0, merit: merit.n, ticket: mine ? d.wallet.ticket : 0 },
      clears: mine ? d.clears : Object.fromEntries(Object.entries(d.clears).filter(([k]) => (CONTENT.find(x => x.key === k)?.unlockLv ?? 1) <= lv)),
      last: h === cur ? d.last : null,
      guild: mine ? d.guild : c.guild, decos: mine ? d.decos : [], chalOpen: mine ? d.chalOpen : 1,
      daily: mine ? d.daily : c.daily,
      weekly: {
        ...(mine ? d.weekly : newWeekly(week)), merit: merit.got,
        loot: d.weekly.loot.filter(k => k.startsWith(`${h}|`)),
        chalBest: chalOwner === h ? d.weekly.chalBest : 0, chalHero: chalOwner === h ? d.weekly.chalHero : undefined,
      },
      chalChest: chestOwner === h ? d.chalChest : 0, chalChestHero: chestOwner === h ? d.chalChestHero : undefined,
      pass: d.pass, member: d.member, firstBuy: d.firstBuy, createdAt: d.createdAt,
    } satisfies Partial<SaveData>);
    const out = clone(c);
    if (!mine) { const items = [...Object.values(out.gear.equipped), ...out.gear.bag]; noteSpecs(out, items); }
    return out;
  };
  let id = 1;
  const built = list.map(h => ({ h, id: id++, save: build(h) }));
  const chars: CharMeta[] = built.map(b => ({ id: b.id, hero: b.h, name: HEROES[b.h].name, level: b.save.player.level, at: now, ...(b.h === cur ? {} : { park: b.save }) }));
  const me = built.find(b => b.h === cur)!;
  Object.assign(d, me.save);
  d.roster = { cur: me.id, slots: chars.length, next: id, chars };
}

/** 그 장비에 붙은 직업 전용 특수능력의 직업 (없으면 undefined). 직업 전용은 그 직업으로 돌 때만 나와서 (42 1-4) 얻은 직업을 알 수 있음 */
const heroOfItem = (it: GearItem): HeroKey | undefined => (it.specs ?? []).map(l => SPECS[l.key]?.hero).find(h => !!h);

/**
 * v10 직업마다 장비 (2026-10-12 Lim): 옛 저장의 공용 장비를 나눔. 착용 장비 · 가방은 가장 높은 직업 (같으면 지금 직업)이 갖고,
 * 다른 직업 전용 특수능력이 붙은 가방 장비는 그 직업 가방으로 (그 직업으로 돌 때 얻은 장비). 나머지 직업은 맨몸으로 시작.
 * 공훈 (장비로 바꾸는 레이드 재화)도 가장 높은 직업에게. 레이드 주 1회 장비 기록은 지금 직업 것으로
 */
function gearByHero(d: SaveData): void {
  const lvOf = (h: HeroKey) => heroLevelOf(d, h);
  const owner = HERO_KEYS.reduce<HeroKey>((b, h) => (lvOf(h) > lvOf(b) ? h : b), d.hero);
  const g = d.gear, bags: Partial<Record<HeroKey, GearItem[]>> = {};
  const keep: GearItem[] = [];
  for (const it of g.bag) {
    const h = heroOfItem(it) ?? owner;
    (bags[h] ||= []).push(it);
  }
  for (const h of HERO_KEYS) {
    const bag = bags[h] ?? [];
    if (h === d.hero) { keep.push(...bag); continue; }
    if (h !== owner && !bag.length) continue;
    heroSaveOf(d, h).gear = { equipped: h === owner ? g.equipped : {}, bag, seen: g.seen ?? d.nextId - 1 };
  }
  if (owner !== d.hero) {
    g.equipped = {};
    heroSaveOf(d, owner).merit = { n: d.wallet.merit, week: d.weekly.week, got: d.weekly.merit };
    d.wallet.merit = 0; d.weekly.merit = { 10: 0, 20: 0 };
  }
  g.bag = keep;
  d.weekly.loot = d.weekly.loot.map(k => (k.split('|').length === 2 ? `${d.hero}|${k}` : k));
}

/**
 * 옛 장비를 지금 모양으로: 세트 표시를 빼고 (세트 장비 제거), 종류가 없으면 그 부위 첫 종류 (v7, 34 12장 6번),
 * 특수능력 줄이 없으면 등급만큼 굴림 (v8, 42 1-1, 직업 전용은 그 저장의 지금 직업 것).
 * v9 옵션 정비 (Lim 2026-10-11): 무작위 옵션은 새 줄 수만큼 앞에서부터 남김 (굴림 · 각성 값 그대로, 모자라면 굴림).
 * 고유 능력은 전설만: 희귀 · 영웅 고유 장비는 고정 특수능력을 보통 줄 (굴림 최대)로, 이름 있는 장신구는 특수능력 1줄 굴림으로 바꾸고 떨어진 장소 생김새.
 * 전설은 고유 장비 · 이름 있는 장신구가 아니면 첫 특수능력이 고유 능력 (1.5배), 둘째 줄은 없앰.
 * 굴림은 장비 id로 정해서 몇 번 불러도 같음. 이름은 등급 말 + 종류
 */
function upgradeItem(it: GearItem, hero: HeroKey): GearItem {
  if (!it || typeof it !== 'object') return it;
  const c: GearItem & { set?: unknown } = { ...it };
  delete c.set;
  const k = kindOf(c), n = randomLines(k, c.grade);
  c.kind = k.key;
  const taken = takenStats(k);
  const lines = Array.isArray(c.lines) ? c.lines.filter(l => l && !taken.includes(l.stat)).slice(0, n) : [];
  if (lines.length < n) lines.push(...rollLines(rngFrom(Math.imul(c.id || 1, 0x2545f491) ^ 0x6a09e667), n - lines.length, [...taken, ...lines.map(l => l.stat)]));
  c.lines = lines;
  if (!Array.isArray(c.specs)) {
    const r = rngFrom(Math.imul(c.id || 1, 0x9e3779b1) ^ 0x3c6ef372);
    c.specs = rollSpecs(r, c.slot, c.grade, specCount(r, c.grade), { hero });
  }
  if (c.grade !== LEGEND) {
    const un = uniqueOf(c.unique), nm = namedOf(c.named);
    if (un) c.specs = [{ key: un.spec, roll: 1 }];
    else if (nm) c.specs = rollSpecs(rngFrom(Math.imul(c.id || 1, 0x85ebca6b) ^ 0x1b873593), c.slot, c.grade, 1, { hero });
    if (un || nm) { const look = lookOf((un ?? nm)!.place); if (look) c.look = look; }
    delete c.unique; delete c.named;
    c.specs = c.specs.filter(l => !l.legend);
  } else if (c.unique || c.named) c.specs = [];
  else if (!c.specs.some(l => l.legend)) c.specs = c.specs.slice(0, 1).map(l => ({ key: l.key, roll: 1, legend: true as const }));
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
  // v10: 다른 직업에 넣어 둔 장비도 지금 장비와 같이 고침 (그 직업 것으로 굴림)
  for (const h of HERO_KEYS) {
    const gs = hs[h]?.gear;
    if (!gs) continue;
    const equipped: Equipped = {};
    if (gs.equipped && typeof gs.equipped === 'object') for (const [k, it] of Object.entries(gs.equipped)) if (it) equipped[k as keyof Equipped] = upgradeItem(it, h);
    hs[h] = { ...hs[h]!, gear: { equipped, bag: Array.isArray(gs.bag) ? gs.bag.map(it => upgradeItem(it, h)) : [], seen: typeof gs.seen === 'number' ? gs.seen : 0 } };
  }
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
    // v11 캐릭터 나누기 직후: 쉬는 캐릭터를 바로 따로 키에 씀
    if (kv && d.roster.chars.some(c => c.park)) save(d, kv);
    return d;
  } catch {
    return newSave();
  }
}

/**
 * 지금 캐릭터 저장 (계정 것 포함). 쉬게 둔 캐릭터 (park)가 있으면 먼저 그 키에 쓰고 나서 지금 저장을 씀 →
 * 중간에 꺼져도 지금 저장은 앞 상태 그대로라 캐릭터가 사라지지 않음. 기기 저장이 없으면 park는 메모리에 남음
 */
export function save(data: SaveData, kv: KV | null = store()): boolean {
  try {
    const r = data.roster, me = r.chars.find(c => c.id === r.cur);
    if (me) { me.level = data.player.level; me.hero = data.hero; }
    if (!kv) return false;
    for (const c of r.chars) if (c.park) { kv.setItem(charKey(c.id), JSON.stringify(c.park)); delete c.park; }
    kv.setItem(SAVE_KEY, JSON.stringify(data));
    kv.removeItem?.(charKey(r.cur));
    return true;
  } catch { return false; }
}
