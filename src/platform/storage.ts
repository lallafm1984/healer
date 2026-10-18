/**
 * 기기 저장 (21 0-5). 한 덩어리 JSON + 버전 번호. 버전이 오르면 migrate에서 옛 저장을 고친다.
 * 지금은 localStorage. 앱에서 OS가 웹 저장소를 지울 위험이 보이면 Capacitor Preferences로 바꾼다.
 */
import type { DiffName } from '../data/difficulty';
import { itemName, kindOf, LEGEND, lookOf, RANDOM_BASE, randomLines, rollLines, takenStats, rollSpecs, specCount, specKeysOf, SLOTS, SPEC_LINES, type Equipped, type GearItem } from '../data/equipment';
import { uniqueOf } from '../data/uniques';
import { namedOf, SPECS } from '../data/specials';
import { rngFrom } from '../engine/rng';
import { codexGroupOf, codexKeys, SPEC_TITLES } from '../data/specials';
import { DEX_TABS, dexKeys, dexKeysOf, dexTabOf } from '../data/dex';
import type { GuildMember, PostTier } from '../data/guild';
import { HERO_KEYS, HEROES, type HeroKey } from '../data/heroes';
import { CONTENT } from '../data/content';
import { STAMINA } from '../data/economy';
import type { Grade } from '../data/progression';

export const SAVE_KEY = 'healer.save';
/**
 * v15 (2026-10-16 Lim): 소비 아이템 단축칸 · 가방을 없앰. v16 (2026-10-16 Lim): 골드를 없앰 (옛 저장의 골드는 버림).
 * v17 (2026-10-16 Lim, 91 디아2식): 강화 없앰 (plus 지움, 무작위 옵션 굴림 r → r ÷ 0.8로 값 그대로), 강화석 · 정제 강화석 → 골드 (1개 100 · 500), 골드 다시
 */
export const SAVE_VERSION = 18;
/** v17: 남은 강화석 · 정제 강화석 1개를 골드로 (91) */
export const MAT_GOLD = { stone: 100, refined: 500 };

/** 칸 탭 기본 힐 = 휠 칸 (이름은 사제 스킬 이름 그대로: heal = 기본 힐 칸, flash = 빠른 힐 칸, renew = 지속 힐 칸) */
export type TapKey = 'heal' | 'flash' | 'renew';

/** 직업마다 따로 두는 것 (25 4-1, 34 3-1): 휠 배치·칸 탭·특성·착용 조합·클리어 수. 성장·인벤토리는 캐릭터 공통 (v12) */
export interface HeroSave {
  /** v12: 공용 인벤토리의 실제 아이템 ID만 기억. 최초 전환은 현재 장비를 그대로 사용 */
  loadout?: Partial<Record<keyof Equipped, number>>;
  layout: Record<string, string | null> | null;
  tapKey: TapKey;
  /** 직업 퀘스트를 끝냄 (사제는 처음부터) */
  unlocked: boolean;
  /** 직업 퀘스트 진행 */
  quest: number;
  /** 이 직업으로 이긴 판 수 */
  wins: number;
  /** v6~v10 저장 이전 전용. v12 런타임 성장에는 사용하지 않음 */
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
  /** v10 저장 이전 전용. v12 인벤토리는 save.gear 하나이며 loadout은 ID만 보관 */
  gear?: HeroGear;
  /** v10 공훈 이전 전용. v12는 캐릭터 공통 wallet.merit · weekly.merit */
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
  /** 개발 빌드: 자동 힐러로 구경 */
  auto: boolean;
  /** 개발 빌드: 콘텐츠 레벨 잠금 무시 (아직 레벨을 올릴 콘텐츠가 적어서) */
  devUnlock: boolean;
  /** 개발 빌드: 레벨과 상관없이 스킬 전부 (06 7장 해금 무시) */
  allSkills: boolean;
  /** 개발 빌드: 골드 비용을 무시하고 실제 보유량은 차감하지 않음 (91, 예전 devStones 강화석 무제한). 옛 저장엔 없음 = 꺼짐 */
  devGold?: boolean;
  /** 개발 빌드 「휴식 무제한」 (90, 81 때 이름 그대로): 휴식이 줄지 않고 휴식 보너스가 늘 붙음. 옛 저장엔 없음 = 꺼짐 */
  devStamina?: boolean;
  /** 개발 빌드 「전 직업 선택」: 구매 · 레벨 조건 없이 일곱 직업 모두 전환. 끄면 원래 잠금 (켜 둔 동안 바꾼 직업은 해금으로 남기지 않음). 옛 저장엔 없음 = 꺼짐 */
  devJobs?: boolean;
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
  /** 레이드마다 이번 주 받은 공훈 (상한 150). 같은 캐릭터의 모든 직업이 공유 */
  merit: { 10: number; 20: number };
  /** 이번 주 장비를 받은 레이드 보스·난이도 (13 3-4: 보스마다 난이도별 주 1회). v12는 캐릭터 공통 「장소|난이도」, 옛 직업 접두사는 migrate에서 제거 */
  loot: string[];
  /** 주간 도전: 이번 주 제한시간 안에 깬 최고 단계 */
  chalBest: number;
  /** chalBest를 세운 직업: 월요일 상자 장비의 전용 효과 기준. 현재 직업과 무관하게 수령 가능 */
  chalHero?: HeroKey;
  /** 길드 주간 목표 진행 · 받음 */
  guild: { n: number; got: boolean };
}

/** 시즌 패스 (15 4장). 81에서 프리미엄 라인을 없애 보상 한 줄 (free = 받은 단계) */
export interface PassSave { season: number; xp: number; free: number[] }

/**
 * 휴식 (90, 81 2장 때 이름 stamina 그대로, 계정): n = 지금 값 (광고 충전으로 최대치를 넘을 수 있음), at = 다음 1이 차기 시작한 시각 (ms, 최대치 이상이면 마지막으로 본 시각).
 * day · ads = 광고 충전 횟수를 센 날 (오전 6시 리셋 날짜 키)과 그날 횟수
 */
export interface StaminaSave { n: number; at: number; day: string; ads: number }
export const newStamina = (now: number): StaminaSave => ({ n: STAMINA.max, at: now, day: '', ads: 0 });

/**
 * 캐릭터 하나 (68, v11): 칸 하나에 캐릭터 하나, 직업은 만들 때 고정. 캐릭터마다 따로 계정처럼 (장비 · 도감 · 임무 · 기록 전부).
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
  /** v12: 현재 캐릭터의 공통 레벨·경험치·골드. 직업 전환으로 변경하지 않음. v16: 골드 없앰, v17 (91): 골드 다시 */
  player: { level: number; xp: number; gold: number };
  /**
   * v12: equipped · bag · seen = 현재 캐릭터 공용 장비. 직업별 loadout은 이 실물의 ID를 참조.
   * seen = 새것 점 기준 id (이보다 큰 id = 새것 점). 옛 저장엔 없어서 migrate가 채움.
   * opened = seen보다 큰 id 가운데 상세를 열어 봤거나 장착한 장비 (2026-10-17 Lim, 새것 점은 장비마다 상세를 본 뒤 꺼짐). 새것이 다 꺼지면 seen을 올리고 지움.
   * codex = 얻은 적 있는 특수능력 · 이름 있는 장신구 키 (도감, 42 1-6). v8부터, 옛 저장은 가진 장비로 채움. 도감 · 장비 도감은 계정
   */
  gear: { equipped: Equipped; bag: GearItem[]; seen?: number; opened?: number[]; codex: string[]; /** 장비 도감 칸 (34 6-10 ④, data/dex). 옛 저장은 가진 장비로 채움 */ dex: string[]; /** 장비 도감 보상을 받은 단계 수 */ dexPaid: number };
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
  /** v5: 재화 (12). v14 (81): 크리스탈 · 악몽 열쇠 · 모집권을 없애고 공훈만 */
  wallet: { merit: number };
  daily: DailySave;
  weekly: WeeklySave;
  pass: PassSave;
  /** v14 (81): 휴식 (90, 계정) */
  stamina: StaminaSave;
  /** v14 (81): 산 앱 결제 상품 id (계정, 광고 제거 패키지 · 직업). 예전 월정액 · 크리스탈 · 첫 구매 기록은 없앰 */
  bought: string[];
  /** 주간 도전: 열린 단계 (실패해도 안 내려감, 13 7장) */
  chalOpen: number;
  /** 받은 칭호·꾸미기 이름 (그림은 원화 작업 때) */
  decos: string[];
  /** 지난주 주간 도전 최고 단계 → 월요일 상자 (0 = 없음) */
  chalChest: number;
  /** 주간 도전 상자를 받을 직업 (그 기록을 세운 직업, v10). 없으면 아무 직업이나 (옛 저장) */
  chalChestHero?: HeroKey;
  /** v11: 캐릭터 목록 (계정, 68). 캐릭터를 바꿀 때 shareAccount가 새 캐릭터 저장으로 옮김 */
  roster: Roster;
  /** v18: 인연 (길드 v2 93 3-2, game/bond): 만난 파티원 닉네임 → 점수 · 만난 판 · 함께 이긴 판 · 살려 준 횟수 · 딜 1등. 캐릭터마다 */
  users: Record<string, BondRec>;
}

/** 인연 한 사람 (v18) */
export interface BondRec { pt: number; met: number; wins: number; saved: number; mvp: number }

export const newDaily = (day = ''): DailySave => ({ day, missions: [], swapped: false, chest: false, banked: 0, pub: 0, ads: { cont: 0, chest: 0, reroll: 0 }, chest2: false });
export const newWeekly = (week = ''): WeeklySave => ({ week, missions: [], merit: { 10: 0, 20: 0 }, loot: [], chalBest: 0, guild: { n: 0, got: false } });

/** 그 직업의 저장 (없으면 기본: 기본 배치, 칸 탭 = 기본 힐 칸, 사제만 처음부터 해금) */
export function heroSaveOf(d: SaveData, h: HeroKey): HeroSave {
  return (d.heroes[h] ||= { layout: null, tapKey: 'heal', unlocked: h === 'priest', quest: 0, wins: 0 });
}

/** v12: 현재 캐릭터의 공통 레벨. 다른 캐릭터의 레벨은 참조하지 않는다. */
export function heroLevelOf(d: SaveData, _h: HeroKey): number { return d.player.level; }

/** 기준 레벨 (34 3-1): 길드 · 상점 물약 · 임무 보상 같은 것의 기준. v11부터 캐릭터마다 따로라 지금 캐릭터 레벨 (다른 직업 레벨이 저장에 안 남음) */
export function topLevel(d: SaveData): number {
  return d.player.level;
}

/** 자동 화면 테스트 (Playwright, navigator.webdriver)인가: 테스트가 전제하는 「레벨 잠금 무시」 켜짐을 그대로 */
const AUTOMATION = typeof navigator !== 'undefined' && navigator.webdriver === true;
/** 새 저장 설정. 「레벨 잠금 무시」 (devUnlock)는 꺼짐 (2026-10-16 Lim QA 「추천대로」: 새로 시작하면 처음 하는 사람과 같은 잠금), 화면 테스트만 켜짐. 옛 저장은 저장된 값 그대로 */
export const DEFAULT_SETTINGS: Settings = { sound: true, vibrate: true, hand: 'right', tapKey: 'heal', zoom: true, compactSkills: true, reducedEffects: false, auto: false, devUnlock: AUTOMATION, allSkills: false, layout: null };

export function newSave(now = Date.now()): SaveData {
  return {
    v: SAVE_VERSION, createdAt: now, settings: { ...DEFAULT_SETTINGS },
    player: { level: 1, xp: 0, gold: 0 }, gear: { equipped: {}, bag: [], seen: 0, codex: [], dex: [], dexPaid: 0 }, clears: {}, last: null, nextId: 1, tut: 0,
    hero: 'priest', heroes: {}, guild: newGuild(),
    wallet: { merit: 0 }, daily: newDaily(), weekly: newWeekly(),
    pass: { season: 0, xp: 0, free: [] }, stamina: newStamina(now), bought: [], chalOpen: 1, decos: [], chalChest: 0,
    roster: newRoster('priest', now), users: {},
  };
}

/** 캐릭터 하나짜리 목록 (새 저장: 사제, 튜토리얼) */
export const newRoster = (hero: HeroKey, now: number, level = 1): Roster => ({ cur: 1, slots: 1, next: 2, chars: [{ id: 1, hero, name: HEROES[hero].name, level, at: now }] });

/** v18 인연 명부: 숫자가 아닌 칸은 0, 모르는 사람 꼴은 버림 */
function usersOf(v: unknown): Record<string, BondRec> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, BondRec> = {};
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  for (const [k, r] of Object.entries(v as Record<string, unknown>)) {
    if (!k || !r || typeof r !== 'object') continue;
    const o = r as Partial<BondRec>;
    out[k] = { pt: n(o.pt), met: n(o.met), wins: n(o.wins), saved: n(o.saved), mvp: n(o.mvp) };
  }
  return out;
}

/** 옛 버전 저장을 지금 버전으로. 모르는 값은 새 저장 기본값으로 채움 */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return newSave();
  const o = raw as Partial<SaveData>;
  const base = newSave(typeof o.createdAt === 'number' ? o.createdAt : Date.now());
  const obj = <T extends object>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...d, ...(v as T) } : d);
  const out: SaveData = {
    ...base, ...o, v: SAVE_VERSION,
    settings: { ...obj(o.settings, base.settings), compactSkills: true },
    player: obj(o.player, base.player),
    // 27: 새것 점 기준 (옛 저장은 지금 가진 장비를 다 본 것으로)
    gear: gearOf(o, HERO_KEYS.includes(o.hero as HeroKey) ? (o.hero as HeroKey) : 'priest', base.nextId),
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
    // v5: 재화·임무·패스. v14 (81): 공훈만 남기고 크리스탈 · 악몽 열쇠 · 모집권은 버림
    wallet: { merit: typeof o.wallet?.merit === 'number' ? o.wallet.merit : 0 },
    daily: o.daily && typeof o.daily === 'object' ? { ...base.daily, ...o.daily, ads: obj(o.daily.ads, base.daily.ads) } : base.daily,
    weekly: o.weekly && typeof o.weekly === 'object' ? { ...base.weekly, ...o.weekly, merit: obj(o.weekly.merit, base.weekly.merit), guild: obj(o.weekly.guild, base.weekly.guild) } : base.weekly,
    pass: passOf(o.pass, base.pass),
    // v18: 인연 (옛 저장은 빈 명부. 옛 길드원 · 스카우트 옮기기는 길드 v2 핵심 PR에서)
    users: usersOf(o.users),
    stamina: staminaOf(o.stamina, base.stamina),
    bought: Array.isArray(o.bought) ? o.bought.filter((k): k is string => typeof k === 'string') : [],
    chalOpen: typeof o.chalOpen === 'number' ? o.chalOpen : 1,
    decos: Array.isArray(o.decos) ? o.decos : [],
    chalChest: typeof o.chalChest === 'number' ? o.chalChest : 0,
    roster: rosterOf(o.roster, HERO_KEYS.includes(o.hero as HeroKey) ? (o.hero as HeroKey) : 'priest', base.createdAt),
  };
  // v14 (81): 월정액 · 첫 구매 기록은 버림 (크리스탈 상품이 없어짐). v15: 소비 아이템 단축칸 (items) · 가방 (bag)도 버림
  for (const k of ['member', 'firstBuy', 'items', 'bag'] as const) delete (out as unknown as Record<string, unknown>)[k];
  // v17 (91): 골드 다시. 골드는 0부터 (v16이 버린 옛 골드는 되살리지 않음), 남은 강화석 · 정제 강화석을 골드로. 강화석 무제한 → 골드 무제한
  const legacy = o as unknown as { mats?: { stone?: unknown; refined?: unknown }; settings?: { devStones?: unknown } };
  if ((o.v ?? 0) < 17) {
    const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, x) : 0);
    out.player.gold = n(legacy.mats?.stone) * MAT_GOLD.stone + n(legacy.mats?.refined) * MAT_GOLD.refined;
    if (legacy.settings?.devStones) out.settings.devGold = true;
    // 일일 임무 「장비 강화」 → 「장비 판매」 (진행 그대로)
    for (const m of out.daily.missions) if (m.key === 'enhance2') m.key = 'sell2';
  } else if (typeof out.player.gold !== 'number' || !isFinite(out.player.gold)) out.player.gold = 0;
  for (const k of ['mats'] as const) delete (out as unknown as Record<string, unknown>)[k];
  for (const k of ['devStones', 'quickEnhance'] as const) delete (out.settings as unknown as Record<string, unknown>)[k];
  // 「레이드 판을 5인 던전 모양으로」 설정은 버림: 모든 판이 5인 던전 모양 (2026-10-16 Lim, 저장 형식은 그대로 v16)
  delete (out.settings as unknown as Record<string, unknown>).raidFiveLook;
  delete (out.weekly as unknown as Record<string, unknown>).craft;
  if ((o.v ?? 0) < 10) gearByHero(out);
  if ((o.v ?? 0) < 11) splitChars(out, out.createdAt);
  // 이전 캐릭터들은 그대로 보존. 같은 캐릭터 안의 직업 전환으로 주간 보상을 다시 받지 못한다.
  out.weekly.loot = [...new Set((Array.isArray(out.weekly.loot) ? out.weekly.loot : []).filter((k): k is string => typeof k === 'string').map(k => k.split('|').slice(-2).join('|')))];
  return out;
}

/** 시즌 패스: 시즌 · 경험치 · 받은 단계만 (v14, 프리미엄 라인 없음) */
function passOf(v: unknown, d: PassSave): PassSave {
  const p = v as Partial<PassSave> | null;
  if (!p || typeof p !== 'object') return d;
  return { season: typeof p.season === 'number' ? p.season : d.season, xp: typeof p.xp === 'number' ? p.xp : d.xp, free: Array.isArray(p.free) ? p.free.filter(n => typeof n === 'number') : [] };
}

/** 휴식: 깨졌거나 없으면 가득 (v14 처음 = 가득 찬 채로 시작) */
function staminaOf(v: unknown, d: StaminaSave): StaminaSave {
  const s = v as Partial<StaminaSave> | null;
  if (!s || typeof s !== 'object' || typeof s.n !== 'number' || !isFinite(s.n) || typeof s.at !== 'number') return d;
  return { n: Math.max(0, Math.floor(s.n)), at: s.at, day: typeof s.day === 'string' ? s.day : '', ads: typeof s.ads === 'number' ? s.ads : 0 };
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
 * 계정 것을 새 캐릭터 저장으로 옮김 (68 3장): 설정 (휠 배치 · 칸 탭은 캐릭터 것) · 산 상품 · 휴식 (81 · 90) · 패스 · 캐릭터 목록.
 * 나머지 (재료 · 장비 · 도감 · 임무 · 광고 횟수 · 기록)는 캐릭터마다
 */
export function shareAccount(from: SaveData, to: SaveData): void {
  to.settings = { ...from.settings, layout: to.settings.layout, tapKey: to.settings.tapKey };
  to.bought = [...from.bought];
  to.stamina = { ...from.stamina };
  to.pass = { ...from.pass, free: [...from.pass.free] };
  to.roster = from.roster;
}

/** 쉬는 캐릭터 저장을 읽음 (아직 따로 안 쓴 것 먼저). 목록은 지금 저장 것을 그대로 씀 (shareAccount) */
export function loadChar(d: SaveData, id: number, kv: KV | null = store()): SaveData | null {
  const c = d.roster.chars.find(x => x.id === id);
  if (!c || id === d.roster.cur) return null;
  if (c.park) return c.park.v < SAVE_VERSION ? migrate(c.park) : c.park;
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
      hero: h, heroes: { [h]: hero }, tut: d.tut, nextId: d.nextId,
      settings: { ...d.settings, layout: s ? s.layout : d.settings.layout, tapKey: s ? s.tapKey : d.settings.tapKey },
      player: { level: lv, xp: s ? s.xp ?? 0 : d.player.xp, gold: mine ? d.player.gold : 0 },
      gear: { equipped: g?.equipped ?? {}, bag: g?.bag ?? [], seen: g?.seen ?? d.nextId - 1, codex: mine ? d.gear.codex : [], dex: mine ? d.gear.dex : [], dexPaid: mine ? d.gear.dexPaid : 0 },
      wallet: { merit: merit.n },
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
      pass: d.pass, stamina: d.stamina, bought: d.bought, createdAt: d.createdAt,
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
  // v9 이전 저장만의 직업별 레벨. v12 공통 레벨 조회를 사용하면 기존 자산의 주인이 바뀐다.
  const lvOf = (h: HeroKey) => h === d.hero ? d.player.level : d.heroes[h]?.level ?? 1;
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
 * v9 옵션 정비 (Lim 2026-10-11): 무작위 옵션은 새 줄 수만큼 앞에서부터 남김 (굴림 유지, 모자라면 굴림). v13은 각성 추가값과 최고 강화 기록을 제거한다.
 * 고유 능력은 전설만: 희귀 · 영웅 고유 장비는 고정 특수능력을 보통 줄 (굴림 최대)로, 이름 있는 장신구는 특수능력 1줄 굴림으로 바꾸고 떨어진 장소 생김새.
 * 전설은 고유 장비 · 이름 있는 장신구가 아니면 첫 특수능력이 고유 능력 (1.5배). 88부터 전설은 특수능력 1줄을 더 가짐 (고유 능력이 이미 있는 장비만 남김, 옛 전설은 그대로).
 * 굴림은 장비 id로 정해서 몇 번 불러도 같음. 이름은 등급 말 + 종류
 */
function upgradeItem(it: GearItem, hero: HeroKey, level: number, v: number): GearItem {
  if (!it || typeof it !== 'object') return it;
  const c: GearItem & { set?: unknown; top?: unknown; plus?: unknown } = { ...it };
  delete c.set;
  delete c.top;
  // v17 (91): 강화 단계를 지움. 무작위 옵션 굴림은 기준값 (최대값의 RANDOM_BASE) 대비로 바꿔 값 그대로 (0.6~1 → 0.75~1.25). 주 · 종류 옵션 굴림은 없음 = 1, 고유 능력 배율은 없음 = 1.5
  delete c.plus;
  if (v < 17 && Array.isArray(c.lines)) c.lines = c.lines.map(l => (l && typeof l.roll === 'number' ? { ...l, roll: Math.round((l.roll / RANDOM_BASE) * 1e4) / 1e4 } : l));
  // 아이템 레벨 (2026-10-13): 옛 장비는 읽을 때 그 직업 레벨 (지금 성능 그대로에서 시작해 레벨이 오르면 약해짐)
  if (typeof c.lv !== 'number') c.lv = Math.max(1, Math.round(level) || 1);
  const k = kindOf(c), n = randomLines(k, c.grade);
  c.kind = k.key;
  const taken = takenStats(k);
  const lines = Array.isArray(c.lines) ? c.lines.filter(l => l && !taken.includes(l.stat)).slice(0, n) : [];
  if (lines.length < n) lines.push(...rollLines(rngFrom(Math.imul(c.id || 1, 0x2545f491) ^ 0x6a09e667), n - lines.length, [...taken, ...lines.map(l => l.stat)]));
  c.lines = lines.map(l => {
    const clean: typeof l & { up?: unknown } = { ...l };
    delete clean.up;
    return clean;
  });
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
  } else if (c.unique || c.named) c.specs = c.specs.filter(l => !l.legend).slice(0, SPEC_LINES[LEGEND]); // 88: 고유 능력 + 특수능력 1줄 (옛 전설은 0줄 그대로)
  else {
    const lg = c.specs.find(l => l.legend) ?? (c.specs[0] && { key: c.specs[0].key, roll: 1, legend: true as const });
    c.specs = lg ? [lg, ...c.specs.filter(l => !l.legend && l.key !== lg.key).slice(0, c.specs.some(l => l.legend) ? SPEC_LINES[LEGEND] : 0)] : [];
  }
  c.name = itemName(c);
  return c;
}

/** 장비 칸 (v8: 옛 장비 특수능력 굴림, 도감에 가진 장비의 특수능력을 채움) */
function gearOf(o: Partial<SaveData>, hero: HeroKey, nextId: number): SaveData['gear'] {
  const g = o.gear, lv = typeof o.player?.level === 'number' ? o.player.level : 1, v = o.v ?? 0;
  const equipped: Equipped = {};
  if (g?.equipped && typeof g.equipped === 'object') for (const [k, it] of Object.entries(g.equipped)) if (it) equipped[k as keyof Equipped] = upgradeItem(it, hero, lv, v);
  const bag = Array.isArray(g?.bag) ? g!.bag.map(it => upgradeItem(it, hero, lv, v)) : [];
  // 가진 장비의 특수능력은 늘 도감에 (옛 저장 · migrate가 굴린 줄 포함)
  const codex = Array.isArray(g?.codex) ? g!.codex.filter(k => typeof k === 'string') : [];
  for (const it of [...SLOTS.map(s => equipped[s.key]), ...bag]) if (it) for (const k of specKeysOf(it)) if (!codex.includes(k)) codex.push(k);
  // 장비 도감도 가진 장비로 채움 (34 6-10 ④)
  const dex = Array.isArray(g?.dex) ? g!.dex.filter(k => typeof k === 'string') : [];
  for (const it of [...SLOTS.map(s => equipped[s.key]), ...bag]) if (it) for (const k of dexKeysOf(it)) if (!dex.includes(k)) dex.push(k);
  const dexPaid = typeof g?.dexPaid === 'number' ? g.dexPaid : 0;
  const seen = typeof g?.seen === 'number' ? g.seen : (typeof o.nextId === 'number' ? o.nextId : nextId) - 1;
  // 새것 점을 장비마다 끄기 (2026-10-17): 옛 저장엔 없음 = 아직 연 장비 없음. seen 아래 · 숫자 아닌 값은 버림
  const opened = Array.isArray(g?.opened) ? [...new Set(g!.opened.filter(n => typeof n === 'number' && n > seen))] : [];
  return { equipped, bag, seen, ...(opened.length ? { opened } : {}), codex, dex, dexPaid };
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
/** 79 직업 4종 전 저장에 있던 직업 */
const LEGACY_HEROES: HeroKey[] = ['priest', 'druid', 'paladin'];
function heroesOf(o: Partial<SaveData>): SaveData['heroes'] {
  const hs: SaveData['heroes'] = o.heroes && typeof o.heroes === 'object' ? { ...o.heroes } : {};
  // v10: 다른 직업에 넣어 둔 장비도 지금 장비와 같이 고침 (그 직업 것으로 굴림)
  for (const h of HERO_KEYS) {
    const gs = hs[h]?.gear;
    if (!gs) continue;
    const equipped: Equipped = {}, lv = hs[h]?.level ?? (typeof o.player?.level === 'number' ? o.player.level : 1);
    if (gs.equipped && typeof gs.equipped === 'object') for (const [k, it] of Object.entries(gs.equipped)) if (it) equipped[k as keyof Equipped] = upgradeItem(it, h, lv, o.v ?? 0);
    hs[h] = { ...hs[h]!, gear: { equipped, bag: Array.isArray(gs.bag) ? gs.bag.map(it => upgradeItem(it, h, lv, o.v ?? 0)) : [], seen: typeof gs.seen === 'number' ? gs.seen : 0 } };
  }
  if ((o.v ?? 0) >= 6) return hs;
  const level = typeof o.player?.level === 'number' ? o.player.level : 1, xp = typeof o.player?.xp === 'number' ? o.player.xp : 0;
  const cur = HERO_KEYS.includes(o.hero as HeroKey) ? o.hero : 'priest';
  for (const h of LEGACY_HEROES) { // v6 이전 저장에는 사제 · 드루이드 · 성기사만 있었음 (79 직업은 레벨 해금이라 옮길 것 없음)
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

/** 프로토타입 화면이 따로 쓰던 키 (스킬 배치). 처음 v2로 올릴 때 한 번 가져온다 */
const OLD_LAYOUT = 'nhh.skillLayout.v1';

export function load(kv: KV | null = store()): SaveData {
  try {
    const s = kv?.getItem(SAVE_KEY);
    const raw = s ? JSON.parse(s) : null;
    const d = migrate(raw);
    if (!raw || raw.v < 2) {
      try {
        const lay = kv?.getItem(OLD_LAYOUT);
        if (lay) d.settings.layout = JSON.parse(lay);
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
