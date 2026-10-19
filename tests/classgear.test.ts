/**
 * 밸런스 다듬기 (2026-10-12 Lim, 67): 장비는 직업마다 (v11부터 캐릭터마다, 68) · 지능 무른 상한 · 해제 4초.
 * 「한 직업을 다 키우면 새로운 느낌으로 다시」 → 높은 캐릭터 장비를 새 캐릭터가 빌려 쓰지 못함
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
import { equip, G, makeChar, pickChar } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';

let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const item = (id: number, o: Partial<GearItem> = {}): GearItem => ({ ...makeItem(rng, 'weapon', '희귀', id), ...o });
const specOf = (hero: string) => Object.keys(SPECS).find(k => SPECS[k].hero === hero)!;

describe('장비는 캐릭터마다 (v10 직업마다 → v11 캐릭터마다, 68)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
    G.save.roster.slots = 2;
    G.save.player.level = 40;
    G.save.nextId = 10;
    G.save.gear.bag = [item(1), item(2)];
    equip(1);
  });
  it('새 캐릭터는 맨몸 · 빈 가방, 돌아오면 원래 장비', () => {
    expect(makeChar('druid')).toBe('');
    expect(G.save.gear.equipped).toEqual({});
    expect(G.save.gear.bag).toEqual([]);
    G.save.gear.bag.push(item(20));
    expect(pickChar(1)).toBe(true);
    expect(G.save.gear.equipped.weapon?.id).toBe(1);
    expect(G.save.gear.bag.map(x => x.id)).toEqual([2]);
    expect(pickChar(2)).toBe(true);
    expect(G.save.gear.bag.map(x => x.id)).toEqual([20]);
  });
  it('도감 · 골드도 캐릭터마다 (67에선 계정이었음)', () => {
    G.save.gear.codex = ['a']; G.save.gear.dex = ['b']; G.save.player.gold = 50;
    makeChar('druid');
    expect([G.save.gear.codex, G.save.gear.dex, G.save.player.gold]).toEqual([[], [], 0]);
    pickChar(1);
    expect([G.save.gear.codex, G.save.gear.dex, G.save.player.gold]).toEqual([['a'], ['b'], 50]);
  });
  it('새 캐릭터는 장비 번호 · 새것 점 기준도 처음부터', () => {
    makeChar('druid');
    expect([G.save.nextId, G.save.gear.seen]).toEqual([1, 0]);
  });
});

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

describe('레이드 · 주간 보상도 캐릭터 것', () => {
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
    G.save.roster.slots = 2;
    G.save.player.level = 60;
    rollover(G.save, MON, rng);
  });
  it('레이드 주 1회 장비는 캐릭터마다', () => {
    settle(G.save, result(), () => 0.5);
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(false);
    makeChar('druid', '', MON);
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(true);
  });
  it('공훈과 주 상한은 캐릭터마다 (새 캐릭터는 0부터, 돌아오면 그대로)', () => {
    settle(G.save, result(), () => 0.5, [], MON); // 정산 시각을 MON으로 (오늘 날짜로 정산하면 MON과 다른 주가 되어 돌아올 때 주 상한이 새로 시작함)
    const got = G.save.weekly.merit[10], n = G.save.wallet.merit;
    expect(n).toBeGreaterThan(0);
    makeChar('druid', '', MON);
    expect([G.save.wallet.merit, G.save.weekly.merit[10]]).toEqual([0, 0]);
    expect(exchangeMerit(G.save, 'ring')).toMatch(/부족/);
    pickChar(1, MON);
    expect([G.save.wallet.merit, G.save.weekly.merit[10]]).toEqual([n, got]);
  });
  it('다음 주에 돌아오면 공훈은 남고 주 상한만 새로', () => {
    settle(G.save, result(), () => 0.5, [], MON);
    const n = G.save.wallet.merit;
    makeChar('druid', '', MON);
    pickChar(1, NEXT);
    expect([G.save.wallet.merit, G.save.weekly.merit[10]]).toEqual([n, 0]);
  });
  it('주간 도전 상자는 기록을 세운 캐릭터가 받음', () => {
    G.save.weekly.chalBest = 0;
    settle(G.save, result({ content: CHAL.content, diff: CHAL.diff, chal: 12, limit: chalLimit(12), time: 300, segN: 4, segIdx: 3 }), () => 0.5, [], MON);
    makeChar('druid', '', MON);
    expect(G.save.chalChest).toBe(0);
    pickChar(1, NEXT);
    expect([G.save.chalChest, G.save.chalChestHero]).toEqual([12, 'priest']);
    expect(typeof claimChalChest(G.save, rng, NEXT)).toBe('object');
    expect(G.save.chalChest).toBe(0);
    pickChar(2, NEXT);
    expect(claimChalChest(G.save, rng, NEXT)).toMatch(/없음/);
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
