/**
 * 밸런스 다듬기 (2026-10-12 Lim, 67): 옛 저장 나누기 (v9 → v11) · 지능 무른 상한 · 해제 4초.
 * 캐릭터마다 장비 · 보상 검사는 2026-10-27 캐릭터 만들기 · 고르기 코드를 지우며 뺌 (Lim 「지워」)
 */
import { describe, expect, it } from 'vitest';
import { makeItem, intEff, INT_SOFT, statsToGear, type GearItem } from '../src/data/equipment';
import { SPECS } from '../src/data/specials';
import { SKILLS } from '../src/data/skills';
import * as E from '../src/engine';
import { cdOf } from '../src/engine/talents';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';

let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const item = (id: number, o: Partial<GearItem> = {}): GearItem => ({ ...makeItem(rng, 'weapon', '희귀', id), ...o });
const specOf = (hero: string) => Object.keys(SPECS).find(k => SPECS[k].hero === hero)!;

describe('옛 저장 나누기 (v9 → v10 → v11)', () => {
  const old = (o: Record<string, unknown>) => {
    const d = newSave(1) as unknown as Record<string, unknown>;
    return migrate(JSON.parse(JSON.stringify({ ...d, v: 9, nextId: 50, ...o })));
  };
  it('착용 · 가방은 가장 높은 직업 캐릭터에게, 다른 직업 전용 특수능력 장비는 그 직업 캐릭터 가방으로', () => {
    const w = item(1), b = item(2), dru = item(3, { specs: [{ key: specOf('druid'), roll: 0.5 }] });
    const s = old({
      hero: 'druid', player: { level: 12, xp: 0, gold: 5 }, mats: { stone: 2, refined: 1 },
      heroes: { priest: { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, level: 60, xp: 0 }, druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0 } },
      gear: { equipped: { weapon: w }, bag: [b, dru], seen: 3, codex: [], dex: [], dexPaid: 0 },
      weekly: { week: 'x', missions: [], craft: 0, merit: { 10: 0, 20: 0 }, loot: ['abyss1|보통'], chalBest: 0, guild: { n: 0, got: false } },
    });
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.roster.chars.map(c => [c.hero, c.level])).toEqual([['priest', 60], ['druid', 12]]);
    expect(s.hero).toBe('druid');
    expect(s.gear.equipped).toEqual({});
    expect(s.gear.bag.map(x => x.id)).toEqual([3]);
    expect(s.player.gold).toBe(0);
    const p = s.roster.chars[0].park!;
    expect(p.hero).toBe('priest');
    expect(p.gear.equipped.weapon?.id).toBe(1);
    expect(p.gear.bag.map(x => x.id)).toEqual([2]);
    expect(p.player.gold).toBe(700); // v17: 옛 골드는 v16이 버림, 강화석 2 · 정제 1 → 700 (가장 높은 캐릭터)
    expect(s.heroes.priest).toBeUndefined();
    expect(s.weekly.loot).toEqual(['abyss1|보통']);
    expect(p.weekly.loot).toEqual([]);
  });
  it('지금 직업이 가장 높으면 그대로 (같은 레벨이면 지금 직업)', () => {
    const s = old({
      hero: 'priest', player: { level: 30, xp: 0, gold: 5 }, mats: { stone: 2, refined: 1 },
      heroes: { druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0, level: 30, xp: 0 } },
      gear: { equipped: { weapon: item(1) }, bag: [item(2)], seen: 2, codex: [], dex: [], dexPaid: 0 },
    });
    expect(s.gear.equipped.weapon?.id).toBe(1);
    expect(s.gear.bag.map(x => x.id)).toEqual([2]);
    expect(s.player.gold).toBe(700);
    const p = s.roster.chars.find(c => c.hero === 'druid')!.park!;
    expect([p.gear.equipped, p.gear.bag, p.player.gold, p.player.level]).toEqual([{}, [], 0, 30]);
  });
  it('v11 저장은 다시 나누지 않음', () => {
    const d = newSave(1);
    d.hero = 'druid'; d.player.level = 5;
    d.heroes.priest = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, level: 60, xp: 0 };
    d.gear.equipped.weapon = item(1);
    const s = migrate(JSON.parse(JSON.stringify(d)));
    expect(s.gear.equipped.weapon?.id).toBe(1);
    expect(s.roster.chars).toHaveLength(1);
  });
});

describe('지능 무른 상한', () => {
  it(`${INT_SOFT * 100}%까지 그대로, 넘는 몫은 절반`, () => {
    expect(intEff(0.3)).toBeCloseTo(0.3);
    expect(intEff(0.45)).toBeCloseTo(0.45);
    expect(intEff(0.69)).toBeCloseTo(0.57);
    expect(intEff(0.83)).toBeCloseTo(0.64);
    const s = { int: 0.83, spirit: 0, haste: 0, crit: 0, hp: 0, endure: 0 } as Parameters<typeof statsToGear>[0];
    expect(statsToGear(s).heal).toBeCloseTo(1.64);
  });
});

describe('해제 재사용 대기 4초 (2026-10-12 Lim 「해제는 쿨타임을 짧게」)', () => {
  const fight = (proto = false, hero: 'priest' | 'druid' | 'paladin' = 'priest') => E.create({ encounter: 'warden', diff: '보통', seed: 1, level: 30, proto, hero });
  it('세 직업 해제 모두 4초, 프로토타입 규칙은 예전 8초', () => {
    expect(cdOf(fight(), 'purify')).toBe(4);
    expect(cdOf(fight(false, 'druid'), 'natureCleanse')).toBe(4);
    expect(cdOf(fight(false, 'paladin'), 'handCleanse')).toBe(4);
    expect(SKILLS.purify.cd).toBe(4);
    expect(cdOf(fight(true), 'purify')).toBe(8);
  });
});
