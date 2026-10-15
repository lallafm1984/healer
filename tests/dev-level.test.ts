import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeItem } from '../src/data/equipment';
import { Flow } from '../src/game/flow';
import { G, heroStatus, setTestMaxLevel } from '../src/game/state';
import { load, migrate, newSave, type KV } from '../src/platform/storage';

describe('개발 옵션: 100레벨로 변경', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const kv: KV = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
    vi.stubGlobal('localStorage', kv);
    G.save = newSave(1);
    G.save.tut = 99;
    G.save.player = { level: 16, xp: 1234, gold: 1080 };
    G.save.wallet.merit = 80;
    G.save.mats = { stone: 12, refined: 3 };
    G.save.gear.bag = [{ ...makeItem(() => 0.5, 'neck', '희귀', 7, 'medal', { lv: 16 }), plus: 2 }];
    G.save = migrate(G.save);
    Flow.running = false;
  });
  afterEach(() => { Flow.running = false; vi.unstubAllGlobals(); });

  it('레벨과 경험치만 변경하고 재접속·캐릭터 목록에도 100레벨을 유지', () => {
    const expected = structuredClone(G.save);
    expected.player.level = 100;
    expected.player.xp = 0;
    expected.roster.chars.find(c => c.id === expected.roster.cur)!.level = 100;
    expect(setTestMaxLevel()).toBe(true);
    expect(G.save).toEqual(expected);
    const restored = load();
    expect(restored.player).toEqual({ level: 100, xp: 0, gold: 1080 });
    expect(restored.gear).toEqual(expected.gear);
    expect(restored.roster.chars.find(c => c.id === restored.roster.cur)?.level).toBe(100);
    expect(heroStatus('paladin').state).toBe('open');
  });

  it('전투·구간 휴식 중에는 저장을 변경하지 않음', () => {
    Flow.running = true;
    const before = structuredClone(G.save);
    expect(setTestMaxLevel()).toBe(false);
    expect(G.save).toEqual(before);
  });

  it('이미 100레벨이면 다시 적용하지 않음', () => {
    setTestMaxLevel();
    const before = structuredClone(G.save);
    expect(setTestMaxLevel()).toBe(false);
    expect(G.save).toEqual(before);
  });
});
