import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, load, migrate, newSave, save, SAVE_KEY, SAVE_VERSION, type KV } from '../src/platform/storage';

const mem = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => ({
  data: { ...init },
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = v; },
});

describe('기기 저장', () => {
  it('처음이면 새 저장: Lv 1, 골드 0, 장비 없음, 단축칸 마나·생명', () => {
    const s = load(mem());
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.player).toEqual({ level: 1, xp: 0, gold: 0 });
    expect(s.gear).toEqual({ equipped: {}, bag: [], seen: 0 });
    expect(s.items).toEqual(['mana', 'life']);
  });
  it('저장 후 다시 읽으면 같음', () => {
    const kv = mem();
    const s = newSave(123);
    s.settings.hand = 'left';
    s.settings.compactSkills = true;
    s.settings.reducedEffects = true;
    s.player.gold = 500;
    s.gear.bag.push({ id: 1, slot: 'ring', kind: 'ring', grade: '희귀', plus: 0, name: '축복받은 반지', lines: [{ stat: 'int', roll: 0.8 }, { stat: 'hp', roll: 0.7 }] });
    expect(save(s, kv)).toBe(true);
    expect(load(kv)).toEqual(s);
  });
  it('기존 저장은 기본 휠과 기존 효과로 유지한다', () => {
    const s = newSave(123);
    const old = JSON.parse(JSON.stringify(s));
    delete old.settings.compactSkills; delete old.settings.reducedEffects;
    const migrated = migrate(old);
    expect(migrated.settings.compactSkills).toBe(false);
    expect(migrated.settings.reducedEffects).toBe(false);
    expect(migrated.player).toEqual(s.player);
  });
  it('깨진 저장이면 새 저장', () => {
    expect(load(mem({ [SAVE_KEY]: '{깨짐' })).v).toBe(SAVE_VERSION);
  });
  it('옛 저장(v1)에 없는 값은 기본값으로 채움', () => {
    const s = migrate({ v: 1, createdAt: 5, settings: { sound: false, vibrate: true, hand: 'right' } });
    expect(s).toEqual({ ...newSave(5), settings: { ...DEFAULT_SETTINGS, sound: false } });
  });
  it('v1에서 올릴 때 프로토타입 화면이 따로 쓰던 스킬 배치·단축칸을 가져옴', () => {
    const lay = { NW: 'hymn', N: 'purify', NE: 'heal', W: 'renew', E: 'flash', SW: null, S: 'poh', SE: 'guardian' };
    const kv = mem({ [SAVE_KEY]: JSON.stringify({ v: 1, createdAt: 1, settings: {} }), 'nhh.skillLayout.v1': JSON.stringify(lay), 'nhh.items.v1': '["mana","cleanse"]' });
    const s = load(kv);
    expect(s.settings.layout).toEqual(lay);
    expect(s.items).toEqual(['mana', 'cleanse']);
  });
  it('저장소가 없어도 멈추지 않음', () => {
    expect(save(newSave(), null)).toBe(false);
    expect(load(null).v).toBe(SAVE_VERSION);
  });
});
