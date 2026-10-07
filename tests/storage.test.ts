import { describe, expect, it } from 'vitest';
import { load, migrate, newSave, save, SAVE_KEY, SAVE_VERSION, type KV } from '../src/platform/storage';

const mem = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => ({
  data: { ...init },
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = v; },
});

describe('기기 저장', () => {
  it('처음이면 새 저장', () => {
    const s = load(mem());
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.settings).toEqual({ sound: true, vibrate: true, hand: 'right' });
  });
  it('저장 후 다시 읽으면 같음', () => {
    const kv = mem();
    const s = newSave(123);
    s.settings.hand = 'left';
    expect(save(s, kv)).toBe(true);
    expect(load(kv)).toEqual(s);
  });
  it('깨진 저장이면 새 저장', () => {
    expect(load(mem({ [SAVE_KEY]: '{깨짐' })).v).toBe(SAVE_VERSION);
  });
  it('옛 저장에 없는 값은 기본값으로 채움', () => {
    const s = migrate({ v: 0, createdAt: 5, settings: { sound: false } });
    expect(s).toEqual({ v: SAVE_VERSION, createdAt: 5, settings: { sound: false, vibrate: true, hand: 'right' } });
  });
  it('저장소가 없어도 멈추지 않음', () => {
    expect(save(newSave(), null)).toBe(false);
    expect(load(null).v).toBe(SAVE_VERSION);
  });
});
