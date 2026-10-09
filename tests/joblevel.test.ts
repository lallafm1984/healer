/** 직업별 레벨 (34 3·4장): 레벨·경험치는 직업마다, 해금·길드·상점·임무는 가장 높은 직업 레벨. 따라잡기 경험치는 없음 (34 v0.2) */
import { beforeEach, describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { clearXp, gradeOf } from '../src/data/progression';
import * as E from '../src/engine';
import { raidLootOpen } from '../src/game/economy';
import { capOf } from '../src/game/guild';
import { settle, type BattleResult } from '../src/game/settle';
import { G, heroStatus, lockOf, otherHeroFor, switchHero, switchOpen } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { heroLevelOf, migrate, newSave, SAVE_VERSION, topLevel } from '../src/platform/storage';

const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
  healed: 7000, overheal: 1000, dispels: 2, dispellable: 2, endMana: 40, minMana: 5, auto: false,
  party: [{ nick: '가', pers: '덜렁이', role: 'melee', alive: true }], detail: [], ...o,
});

describe('저장 이전 (34 3-4)', () => {
  it('옛 저장의 레벨·경험치를 열린 모든 직업에 넣고, 퀘스트 중인 직업은 Lv 1', () => {
    const s = migrate({
      v: 5, hero: 'druid', player: { level: 30, xp: 120, gold: 9 },
      heroes: { druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 4 }, paladin: { layout: null, tapKey: 'heal', unlocked: false, quest: 0, wins: 0 } },
    });
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.player).toEqual({ level: 30, xp: 120, gold: 9 });
    expect(s.heroes.priest).toMatchObject({ level: 30, xp: 120, unlocked: true });
    expect(heroLevelOf(s, 'druid')).toBe(30);
    expect(s.heroes.druid!.wins).toBe(4);
    expect(heroLevelOf(s, 'paladin')).toBe(1);
    expect(topLevel(s)).toBe(30);
  });
  it('v6 저장은 그대로 (다시 옮기지 않음)', () => {
    const d = newSave(1);
    d.player.level = 12;
    d.heroes.druid = { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0, level: 3, xp: 5 };
    const s = migrate(JSON.parse(JSON.stringify(d)));
    expect(heroLevelOf(s, 'druid')).toBe(3);
    expect(s.heroes.priest).toBeUndefined();
  });
});

describe('직업 바꾸기와 레벨 (34 3-1 · 3-2)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
    G.save.player.level = 25; G.save.player.xp = 40; G.save.player.gold = 777;
  });
  it('새 직업은 Lv 1부터, 돌아오면 원래 레벨. 골드는 같이', () => {
    expect(switchHero('druid')).toBe(true);
    expect(G.save.player).toEqual({ level: 1, xp: 0, gold: 777 });
    G.save.player.level = 4;
    expect(switchHero('priest')).toBe(true);
    expect(G.save.player).toEqual({ level: 25, xp: 40, gold: 777 });
    expect(heroLevelOf(G.save, 'druid')).toBe(4);
  });
  it('해금·직업 바꾸기는 가장 높은 직업 레벨로 (낮은 직업으로 와도 닫히지 않음)', () => {
    switchHero('druid');
    expect(G.save.player.level).toBe(1);
    expect(topLevel(G.save)).toBe(25);
    expect(switchOpen().ok).toBe(true);
    expect(heroStatus('paladin').state).toBe('quest');
    expect(switchHero('priest')).toBe(true);
  });
  it('콘텐츠는 지금 직업 레벨로 잠기고, 다른 직업이 열었으면 그 직업을 알려 줌', () => {
    G.save.heroes.druid = { layout: null, tapKey: 'heal', unlocked: true, quest: 1, wins: 0 };
    switchHero('druid');
    const c = contentOf('swamp');
    expect(lockOf(c).locked).toBe(true);
    expect(otherHeroFor(lockOf(c).lv)).toEqual({ hero: 'priest', lv: 25 });
    expect(otherHeroFor(26)).toBeNull();
  });
  it('따라잡기 없음: 다른 직업보다 낮아도 경험치는 그 레벨 그대로 (34 v0.2)', () => {
    switchHero('druid');
    G.save.player.level = 10;
    const x = settle(G.save, result(), () => 0.5);
    expect(x.xp).toBe(clearXp(10, '보통', gradeOf(0), { win: true }));
    expect('catchUp' in x).toBe(false);
  });
  it('레이드 주 1회 장비는 계정에 한 번 (직업을 바꿔도 다시 안 줌, 34 4장 4번)', () => {
    G.save.player.level = 40;
    settle(G.save, result({ content: 'abyss1', diff: '보통', segN: 1, segIdx: 0 }), () => 0.5);
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(false);
    switchHero('druid');
    expect(raidLootOpen(G.save, 'abyss1', '보통')).toBe(false);
  });
  it('길드원 레벨 상한 = 가장 높은 직업 레벨 (34 4장 8번)', () => {
    const top = capOf(G.save);
    switchHero('druid');
    expect(capOf(G.save)).toEqual(top);
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
