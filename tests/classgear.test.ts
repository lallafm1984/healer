/**
 * 밸런스 다듬기 (2026-10-12 Lim): 장비는 직업마다 · 지능 무른 상한 · 해제 충전.
 * 「한 직업을 다 키우면 새로운 느낌으로 다시」 → 높은 직업 장비를 새 직업이 빌려 쓰지 못함
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { makeItem, intEff, INT_SOFT, statsToGear, type GearItem } from '../src/data/equipment';
import { SPECS } from '../src/data/specials';
import { SKILLS } from '../src/data/skills';
import { CHAL, chalLimit } from '../src/data/challenge';
import * as E from '../src/engine';
import { cdOf } from '../src/engine/talents';
import { claimChalChest, exchangeMerit, raidLootOpen, rollover } from '../src/game/economy';
import { settle, type BattleResult } from '../src/game/settle';
import { equip, G, switchHero } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';

let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const item = (id: number, o: Partial<GearItem> = {}): GearItem => ({ ...makeItem(rng, 'weapon', '희귀', id), ...o });
const specOf = (hero: string) => Object.keys(SPECS).find(k => SPECS[k].hero === hero)!;

describe('장비는 직업마다 (v10)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
    G.save.player.level = 40;
    G.save.nextId = 10;
    G.save.gear.bag = [item(1), item(2)];
    equip(1);
  });
  it('새 직업은 맨몸 · 빈 가방, 돌아오면 원래 장비', () => {
    expect(switchHero('druid')).toBe(true);
    expect(G.save.gear.equipped).toEqual({});
    expect(G.save.gear.bag).toEqual([]);
    G.save.gear.bag.push(item(20));
    expect(switchHero('priest')).toBe(true);
    expect(G.save.gear.equipped.weapon?.id).toBe(1);
    expect(G.save.gear.bag.map(x => x.id)).toEqual([2]);
    expect(switchHero('druid')).toBe(true);
    expect(G.save.gear.bag.map(x => x.id)).toEqual([20]);
  });
  it('도감 · 재료 · 골드는 계정', () => {
    G.save.gear.codex = ['a']; G.save.gear.dex = ['b']; G.save.mats.stone = 9;
    switchHero('druid');
    expect([G.save.gear.codex, G.save.gear.dex, G.save.mats.stone]).toEqual([['a'], ['b'], 9]);
  });
  it('새 직업 가방엔 새것 점이 안 뜸 (지금까지 나온 id는 본 것으로)', () => {
    switchHero('druid');
    expect(G.save.gear.seen).toBe(9);
  });
});

describe('옛 저장 나누기 (v9 → v10)', () => {
  const old = (o: Record<string, unknown>) => {
    const d = newSave(1) as unknown as Record<string, unknown>;
    return migrate(JSON.parse(JSON.stringify({ ...d, v: 9, nextId: 50, ...o })));
  };
  it('착용 · 가방은 가장 높은 직업에게, 다른 직업 전용 특수능력 장비는 그 직업 가방으로', () => {
    const w = item(1), b = item(2), dru = item(3, { specs: [{ key: specOf('druid'), roll: 0.5 }] });
    const s = old({
      hero: 'druid', player: { level: 12, xp: 0, gold: 5 },
      heroes: { priest: { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, level: 60, xp: 0 }, druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0 } },
      gear: { equipped: { weapon: w }, bag: [b, dru], seen: 3, codex: [], dex: [], dexPaid: 0 },
      weekly: { week: 'x', missions: [], craft: 0, merit: { 10: 0, 20: 0 }, loot: ['abyss1|보통'], chalBest: 0, guild: { n: 0, got: false } },
    });
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.gear.equipped).toEqual({});
    expect(s.gear.bag.map(x => x.id)).toEqual([3]);
    expect(s.heroes.priest!.gear!.equipped.weapon?.id).toBe(1);
    expect(s.heroes.priest!.gear!.bag.map(x => x.id)).toEqual([2]);
    expect(s.heroes.paladin?.gear).toBeUndefined();
    expect(s.weekly.loot).toEqual(['druid|abyss1|보통']);
  });
  it('지금 직업이 가장 높으면 그대로 (같은 레벨이면 지금 직업)', () => {
    const s = old({
      hero: 'priest', player: { level: 30, xp: 0, gold: 5 },
      heroes: { druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0, level: 30, xp: 0 } },
      gear: { equipped: { weapon: item(1) }, bag: [item(2)], seen: 2, codex: [], dex: [], dexPaid: 0 },
    });
    expect(s.gear.equipped.weapon?.id).toBe(1);
    expect(s.gear.bag.map(x => x.id)).toEqual([2]);
    expect(s.heroes.druid!.gear).toBeUndefined();
  });
  it('v10 저장은 다시 나누지 않음', () => {
    const d = newSave(1);
    d.hero = 'druid'; d.player.level = 5;
    d.heroes.priest = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, level: 60, xp: 0 };
    d.gear.equipped.weapon = item(1);
    const s = migrate(JSON.parse(JSON.stringify(d)));
    expect(s.gear.equipped.weapon?.id).toBe(1);
    expect(s.heroes.priest!.gear).toBeUndefined();
  });
});

describe('레이드 · 주간 보상도 장비를 받는 직업 것', () => {
  const result = (o: Partial<BattleResult> = {}): BattleResult => ({
    content: 'abyss1', diff: '보통', win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 360, restSec: 30, deaths: 0,
    healed: 7000, overheal: 1000, dispels: 2, dispellable: 2, endMana: 40, minMana: 5, auto: false,
    party: [{ nick: '가', pers: '덜렁이', role: 'melee', alive: true }], detail: [], ...o,
  });
  const MON = new Date(2026, 9, 12, 7).getTime(), NEXT = new Date(2026, 9, 19, 7).getTime();
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
    G.save.player.level = 60;
    G.save.heroes.druid = { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0 };
    rollover(G.save, MON, rng);
  });
  it('레이드 주 1회 장비는 직업마다', () => {
    settle(G.save, result(), () => 0.5);
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(false);
    switchHero('druid');
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(true);
  });
  it('공훈과 주 상한은 직업마다 (새 직업은 0부터, 돌아오면 그대로)', () => {
    settle(G.save, result(), () => 0.5);
    const got = G.save.weekly.merit[10], n = G.save.wallet.merit;
    expect(n).toBeGreaterThan(0);
    switchHero('druid');
    expect([G.save.wallet.merit, G.save.weekly.merit[10]]).toEqual([0, 0]);
    expect(exchangeMerit(G.save, 'ring')).toMatch(/부족/);
    switchHero('priest');
    expect([G.save.wallet.merit, G.save.weekly.merit[10]]).toEqual([n, got]);
  });
  it('다음 주에 돌아오면 공훈은 남고 주 상한만 새로', () => {
    settle(G.save, result(), () => 0.5);
    const n = G.save.wallet.merit;
    switchHero('druid');
    rollover(G.save, NEXT, rng);
    switchHero('priest');
    expect([G.save.wallet.merit, G.save.weekly.merit[10]]).toEqual([n, 0]);
  });
  it('주간 도전 상자는 기록을 세운 직업이 받음', () => {
    G.save.weekly.chalBest = 0;
    settle(G.save, result({ content: CHAL.content, diff: CHAL.diff, chal: 12, limit: chalLimit(12), time: 300, segN: 4, segIdx: 3 }), () => 0.5, [], MON);
    expect(G.save.weekly.chalHero).toBe('priest');
    rollover(G.save, NEXT, rng);
    expect([G.save.chalChest, G.save.chalChestHero]).toEqual([12, 'priest']);
    switchHero('druid');
    expect(claimChalChest(G.save, rng, NEXT)).toMatch(/사제로/);
    expect(G.save.chalChest).toBe(12);
    switchHero('priest');
    expect(typeof claimChalChest(G.save, rng, NEXT)).toBe('object');
    expect(G.save.chalChestHero).toBeUndefined();
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
