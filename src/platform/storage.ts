/**
 * 기기 저장 (21 0-5). 한 덩어리 JSON + 버전 번호. 버전이 오르면 migrate에서 옛 저장을 고친다.
 * 지금은 localStorage. 앱에서 OS가 웹 저장소를 지울 위험이 보이면 Capacitor Preferences로 바꾼다.
 */
import type { DiffName } from '../data/difficulty';
import type { Equipped, GearItem } from '../data/equipment';
import { HERO_KEYS, type HeroKey } from '../data/heroes';
import type { ItemKey } from '../data/items';
import type { Grade } from '../data/progression';

export const SAVE_KEY = 'healer.save';
export const SAVE_VERSION = 3;

/** 칸 탭 기본 힐 = 휠 칸 (이름은 사제 스킬 이름 그대로: heal = 기본 힐 칸, flash = 빠른 힐 칸, renew = 지속 힐 칸) */
export type TapKey = 'heal' | 'flash' | 'renew';

/** 직업마다 따로 두는 것 (25 4-1): 휠 배치·칸 탭, 퀘스트, 클리어 수 (숙련도) */
export interface HeroSave {
  layout: Record<string, string | null> | null;
  tapKey: TapKey;
  /** 직업 퀘스트를 끝냄 (사제는 처음부터) */
  unlocked: boolean;
  /** 직업 퀘스트 진행 */
  quest: number;
  /** 이 직업으로 이긴 판 수 (숙련도, 25 4-3) */
  wins: number;
  /** 특성 (06 6장): 단마다 고른 칸 번호 (0~2, 안 고름 = null). 직업마다 따로 (25 4-1) */
  talents?: (number | null)[];
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

export interface SaveData {
  v: number;
  /** 처음 만든 시각 (ms) */
  createdAt: number;
  settings: Settings;
  player: { level: number; xp: number; gold: number };
  gear: { equipped: Equipped; bag: GearItem[] };
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
}

/** 그 직업의 저장 (없으면 기본: 기본 배치, 칸 탭 = 기본 힐 칸, 사제만 처음부터 해금) */
export function heroSaveOf(d: SaveData, h: HeroKey): HeroSave {
  return (d.heroes[h] ||= { layout: null, tapKey: 'heal', unlocked: h === 'priest', quest: 0, wins: 0 });
}

export const DEFAULT_SETTINGS: Settings = { sound: true, vibrate: true, hand: 'right', tapKey: 'heal', zoom: true, auto: false, devUnlock: true, allSkills: false, layout: null };

export function newSave(now = Date.now()): SaveData {
  return {
    v: SAVE_VERSION, createdAt: now, settings: { ...DEFAULT_SETTINGS },
    player: { level: 1, xp: 0, gold: 0 }, gear: { equipped: {}, bag: [] }, items: ['mana', 'life'], clears: {}, last: null, nextId: 1, tut: 0,
    hero: 'priest', heroes: {},
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
    gear: { equipped: obj(o.gear?.equipped, {}), bag: Array.isArray(o.gear?.bag) ? o.gear!.bag : [] },
    items: Array.isArray(o.items) ? o.items : base.items,
    clears: obj(o.clears, {}),
    last: o.last && typeof o.last === 'object' ? o.last : null,
    nextId: typeof o.nextId === 'number' ? o.nextId : base.nextId,
    // 튜토리얼 전에 만든 저장: 이미 해 본 사람이면 끝난 걸로 (3 = TUT.done)
    tut: typeof o.tut === 'number' ? o.tut : (o.player?.level ?? 1) > 1 || Object.keys(o.clears || {}).length ? 3 : 0,
    // v3: 직업 (옛 저장은 사제)
    hero: HERO_KEYS.includes(o.hero as HeroKey) ? (o.hero as HeroKey) : 'priest',
    heroes: obj(o.heroes, {}),
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
