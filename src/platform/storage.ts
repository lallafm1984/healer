/**
 * 기기 저장 (21 0-5). 한 덩어리 JSON + 버전 번호. 버전이 오르면 migrate에서 옛 저장을 고친다.
 * 지금은 localStorage. 앱에서 OS가 웹 저장소를 지울 위험이 보이면 Capacitor Preferences로 바꾼다.
 */
export const SAVE_KEY = 'healer.save';
export const SAVE_VERSION = 1;

export interface SaveData {
  v: number;
  /** 처음 만든 시각 (ms) */
  createdAt: number;
  settings: { sound: boolean; vibrate: boolean; hand: 'right' | 'left' };
}

export function newSave(now = Date.now()): SaveData {
  return { v: SAVE_VERSION, createdAt: now, settings: { sound: true, vibrate: true, hand: 'right' } };
}

/** 옛 버전 저장을 지금 버전으로. 모르는 값은 새 저장 기본값으로 채움 */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return newSave();
  const o = raw as Partial<SaveData>;
  const base = newSave(typeof o.createdAt === 'number' ? o.createdAt : Date.now());
  return { ...base, ...o, v: SAVE_VERSION, settings: { ...base.settings, ...(o.settings || {}) } };
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function store(): KV | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function load(kv: KV | null = store()): SaveData {
  try {
    const s = kv?.getItem(SAVE_KEY);
    return s ? migrate(JSON.parse(s)) : newSave();
  } catch {
    return newSave();
  }
}

export function save(data: SaveData, kv: KV | null = store()): boolean {
  try { kv?.setItem(SAVE_KEY, JSON.stringify(data)); return !!kv; } catch { return false; }
}
