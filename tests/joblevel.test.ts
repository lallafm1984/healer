/** 직업별 레벨 (34 3·4장 → 68 캐릭터마다): 레벨·경험치·길드·상점·임무 기준 모두 그 캐릭터 레벨. 따라잡기 경험치는 없음 (34 v0.2) */
import { beforeEach, describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { clearXp, gradeOf, restRun, rampXp } from '../src/data/progression';
import * as E from '../src/engine';
import { raidLootOpen } from '../src/game/economy';
import { PARTY_POOL } from '../src/data/nicknames';
import { capOf, newMember, personOf } from '../src/game/guild';
import { settle, type BattleResult } from '../src/game/settle';
import { G, heroStatus, lockOf, makeChar, otherHeroFor, pickChar, switchOpen } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { heroLevelOf, migrate, newSave, SAVE_VERSION, topLevel } from '../src/platform/storage';

const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
  healed: 7000, overheal: 1000, dispels: 2, dispellable: 2, endMana: 40, minMana: 5, auto: false,
  party: [{ nick: '가', pers: '덜렁이', role: 'melee', alive: true }], detail: [], ...o,
});

describe('저장 이전 (34 3-4 → 68 v11)', () => {
  it('옛 저장의 레벨·경험치를 열린 모든 직업에 넣고 (v6), 해 본 직업마다 캐릭터로 (v11). 퀘스트 중인 직업은 캐릭터 없음', () => {
    const s = migrate({
      v: 5, hero: 'druid', player: { level: 30, xp: 120, gold: 9 }, mats: { stone: 3, refined: 1 },
      heroes: { druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 4 }, paladin: { layout: null, tapKey: 'heal', unlocked: false, quest: 0, wins: 0 } },
    });
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.player).toEqual({ level: 30, xp: 120, gold: 800 }); // v16이 버린 옛 골드는 없음, v17: 강화석 3 · 정제 1 → 300 + 500
    expect(s.roster.chars.map(c => [c.hero, c.level])).toEqual([['priest', 30], ['druid', 30]]);
    expect(s.roster.chars[0].park!.player).toEqual({ level: 30, xp: 120, gold: 0 });
    expect(heroLevelOf(s, 'priest')).toBe(30);
    expect(s.heroes.druid!.wins).toBe(4);
    expect(heroLevelOf(s, 'paladin')).toBe(30);
    expect(topLevel(s)).toBe(30);
  });
  it('v6 뒤 저장은 레벨을 다시 옮기지 않음', () => {
    const d = newSave(1) as unknown as Record<string, unknown> & ReturnType<typeof newSave>;
    d.v = 10; d.player.level = 12;
    d.heroes.druid = { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0, level: 3, xp: 5 };
    const s = migrate(JSON.parse(JSON.stringify(d)));
    expect(heroLevelOf(s, 'druid')).toBe(12);
    expect(s.roster.chars.find(c => c.hero === 'druid')!.park!.player.level).toBe(3);
    expect(s.player.level).toBe(12);
  });
});

describe('캐릭터마다 레벨 (34 3장 → 68)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
    G.save.roster.slots = 3;
    G.save.player.level = 25; G.save.player.xp = 40; G.save.player.gold = 777;
  });
  it('새 캐릭터는 Lv 1 · 골드 0부터, 돌아오면 원래 레벨 · 골드', () => {
    expect(makeChar('druid')).toBe('');
    expect(G.save.player).toEqual({ level: 1, xp: 0, gold: 0 });
    G.save.player.level = 4;
    expect(pickChar(1)).toBe(true);
    expect(G.save.player).toEqual({ level: 25, xp: 40, gold: 777 });
    expect(heroLevelOf(G.save, 'druid')).toBe(25);
    expect(G.save.roster.chars.find(c => c.id === 2)!.level).toBe(4);
  });
  it('기준 레벨 (길드 · 상점 · 임무)도 그 캐릭터 레벨', () => {
    makeChar('druid');
    expect(G.save.player.level).toBe(1);
    expect(topLevel(G.save)).toBe(1);
    expect(switchOpen().ok).toBe(true);
    expect(pickChar(1)).toBe(true);
    expect(topLevel(G.save)).toBe(25);
  });
  it('콘텐츠는 지금 캐릭터 공통 레벨로 잠김, 직업 전환으로 우회할 수 없음', () => {
    makeChar('druid');
    const c = contentOf('swamp');
    expect(lockOf(c).locked).toBe(true);
    expect(otherHeroFor(lockOf(c).lv)).toBeNull();
    expect(otherHeroFor(26)).toBeNull();
    expect(heroStatus('paladin').state).toBe('locked');
  });
  it('따라잡기 없음: 다른 캐릭터보다 낮아도 경험치는 그 레벨 그대로 (34 v0.2)', () => {
    makeChar('druid');
    G.save.player.level = 10;
    // Lv 20까지 장소 Lv 20까지는 장소가 정한 경험치 (70), 다른 캐릭터 레벨과 상관없음
    const x = settle(G.save, result({ stage: 10 }), () => 0.5);
    expect(x.xp).toBe(restRun(rampXp(contentOf('rustfort'), '보통', { first: true, grade: gradeOf(0), win: true })));
    G.save.player.level = 30;
    expect(settle(G.save, result({ stage: 30 }), () => 0.5).xp).toBe(restRun(clearXp(30, '보통', gradeOf(0), { win: true })));
    expect('catchUp' in x).toBe(false);
  });
  it('레이드 주 1회 장비는 캐릭터마다', () => {
    G.save.player.level = 40;
    settle(G.save, result({ content: 'abyss1', diff: '보통', segN: 1, segIdx: 0 }), () => 0.5);
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(false);
    makeChar('druid');
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(true);
    pickChar(1);
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(false);
  });
  it('길드원 레벨 상한 = 그 캐릭터 레벨 (34 4장 8번), 정원은 명성 (93 6-2)이라 캐릭터와 상관없음', () => {
    G.save.player.level = 80;
    const p = personOf(PARTY_POOL.warrior[0].nick)!, cap = capOf(G.save);
    expect(newMember(G.save, p, 90).lv).toBe(80);
    makeChar('druid');
    expect(G.save.player.level).toBeLessThan(80);
    expect(newMember(G.save, p, 90).lv).toBe(G.save.player.level);
    expect(capOf(G.save)).toEqual(cap);
  });
});

describe('길드원은 적 레벨 위로 안 감 (34 4장 8번)', () => {
  it('Lv 40 길드원이 Lv 10 판에 오면 Lv 10 세기', () => {
    const roster = [{ role: 'tank' as const, pers: '덜렁이' as const, nick: '가', cls: 'warrior' as const, lv: 40 }];
    const hi = E.create({ encounter: 'warden', diff: '보통', seed: 1, stageLv: 10, heroLv: 10, party: roster });
    const same = E.create({ encounter: 'warden', diff: '보통', seed: 1, stageLv: 10, heroLv: 10, party: [{ ...roster[0], lv: 10 }] });
    const t = (f: typeof hi) => f.party.find(u => u.nick === '가')!;
    expect(t(hi).max).toBeCloseTo(t(same).max);
  });
});
