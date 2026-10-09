/** 재화 (12)·일일 주간 (13)·상점·패스 (15)·소비 아이템 가방 (19 11장) */
import { describe, expect, it } from 'vitest';
import { BAG_MAX, itemPrice, MEMBER, MERIT, PASS_XP, SHARD_CRAFT, SHARD_MAX, STARTER_BAG } from '../src/data/economy';
import { DAILY, DAILY_BASIC, WEEKLY } from '../src/data/missions';
import { clearGold } from '../src/data/progression';
import * as E from '../src/engine';
import { dayKey, daysBetween, seasonOf, weekKey } from '../src/game/clock';
import {
  addPassXp, buyItem, buyPremium, chestState, claimChalChest, claimChest, claimMission, claimPass, craftShard, exchangeMerit, grantMember, isMember,
  missionReady, onAct, onRun, passLevel, rollover, runGold, spendShard, swapMission,
} from '../src/game/economy';
import { settle, type BattleResult } from '../src/game/settle';
import { migrate, newSave, type SaveData } from '../src/platform/storage';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** 2026-10-07 (수) 정오 */
const T0 = new Date(2026, 9, 7, 12).getTime();
const H = 3600e3, D = 24 * H;

function save(level = 20, gold = 100000): SaveData {
  const s = newSave(1);
  s.tut = 3; s.player.level = level; s.player.gold = gold;
  rollover(s, T0, rng);
  return s;
}
const ev = (o: Partial<Parameters<typeof onRun>[1]> = {}) => ({
  win: true, dungeon: true, raid: 0 as const, pub: true, diffIdx: 1, deaths: 0, overhealPct: 20, endManaPct: 30, dispels: 3, pers: ['덜렁이'], chal: 0, ...o,
});
const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
  healed: 7000, overheal: 1000, dispels: 2, dispellable: 2, endMana: 40, minMana: 5, auto: false,
  party: [{ nick: '가', pers: '덜렁이', role: 'melee', alive: true }], detail: [], ...o,
});

describe('리셋 시각 (13 1장: 오전 6시, 월요일)', () => {
  it('오전 6시 전은 어제, 주간은 월요일', () => {
    expect(dayKey(new Date(2026, 9, 7, 5, 59).getTime())).toBe('2026-10-06');
    expect(dayKey(new Date(2026, 9, 7, 6, 0).getTime())).toBe('2026-10-07');
    expect(weekKey(T0)).toBe('2026-10-05');
    expect(weekKey(new Date(2026, 9, 5, 5).getTime())).toBe('2026-09-28');
    expect(daysBetween('2026-10-05', '2026-10-08')).toBe(3);
  });
  it('시즌 1은 2026-10-05부터 13주, 마지막 3주 따라잡기', () => {
    expect(seasonOf(T0)).toMatchObject({ n: 1, week: 0, catchUp: false });
    expect(seasonOf(T0 + 10 * 7 * D)).toMatchObject({ n: 1, week: 10, catchUp: true });
    expect(seasonOf(T0 + 13 * 7 * D).n).toBe(2);
  });
});

describe('일일 임무 (13 2-1)', () => {
  it('날이 바뀌면 5개, 단순 판 수 임무는 2개까지, 레벨에 맞는 것만', () => {
    for (let i = 0; i < 30; i++) {
      seed = i + 1;
      const s = save(3);
      expect(s.daily.missions.length).toBe(5);
      expect(s.daily.missions.filter(m => DAILY_BASIC.includes(m.key)).length).toBeLessThanOrEqual(2);
      expect(s.daily.missions.every(m => DAILY.find(d => d.key === m.key)!.lv <= 3)).toBe(true);
    }
  });
  it('판·강화로 채우고 받기: 골드 = 클리어 1판의 20%, 강화석 2, 패스 경험치 60', () => {
    const s = save(20);
    s.daily.missions = [{ key: 'clear3', n: 0, got: false }, { key: 'nodeath', n: 0, got: false }, { key: 'enhance2', n: 0, got: false }, { key: 'dispel10', n: 0, got: false }, { key: 'guild2', n: 0, got: false }];
    expect(onRun(s, ev())).toEqual(['사망자 0명으로 클리어']);
    onRun(s, ev({ pub: false, deaths: 2 })); onRun(s, ev({ win: false }));
    expect(s.daily.missions.map(m => m.n)).toEqual([2, 1, 0, 9, 1]); // 해제는 진 판도 셈
    onAct(s, 'enhance'); onAct(s, 'enhance'); onAct(s, 'enhance');
    expect(s.daily.missions[2].n).toBe(2);
    expect(claimMission(s, 'daily', 0, T0)).toBe('아직 못 채움');
    const g0 = s.player.gold, st0 = s.mats.stone;
    const r = claimMission(s, 'daily', 1, T0);
    expect(r).toMatchObject({ gold: Math.round(runGold(20) * 0.2), stone: 2, pass: 60 });
    expect([s.player.gold - g0, s.mats.stone - st0, s.pass.xp]).toEqual([Math.round(runGold(20) * 0.2), 2, 60]);
    expect(claimMission(s, 'daily', 1, T0)).toBe('아직 못 채움');
  });
  it('완료 상자: 5개 다 받으면 1번 (골드 1판 + 강화석 5 + 장비 1개), 광고로 한 번 더', () => {
    const s = save(20);
    expect(claimChest(s, rng, T0)).toMatch(/5개/);
    s.daily.missions.forEach(m => { m.n = 99; m.got = true; });
    expect(chestState(s).today).toBe(true);
    const bag = s.gear.bag.length;
    const r = claimChest(s, rng, T0);
    expect(r).toMatchObject({ gold: runGold(20), stone: 5, pass: 100 });
    expect(s.gear.bag.length).toBe(bag + 1);
    expect(claimChest(s, rng, T0)).toMatch(/5개/);
    expect(claimChest(s, rng, T0, true)).toMatchObject({ gold: runGold(20), stone: 5 });
    expect(claimChest(s, rng, T0, true)).toMatch(/먼저/);
  });
  it('놓친 날 상자는 2일까지 쌓임, 접속한 날 못 받은 건 안 쌓임 (13 7장)', () => {
    const s = save(20);
    rollover(s, T0 + D, rng);
    expect(s.daily.banked).toBe(0);
    rollover(s, T0 + 5 * D, rng);
    expect(s.daily.banked).toBe(2);
    expect(claimChest(s, rng, T0 + 5 * D)).toMatchObject({ stone: 5 });
    expect(s.daily.banked).toBe(1);
  });
  it('하루 1번 무료 교체, 받은 임무는 못 바꿈', () => {
    const s = save(20);
    const before = s.daily.missions.map(m => m.key);
    expect(swapMission(s, 0, rng)).toBe('');
    expect(before).not.toContain(s.daily.missions[0].key);
    expect(swapMission(s, 1, rng)).toMatch(/이미/);
  });
});

describe('주간 (13 3장)', () => {
  it('Lv 10부터 3개, Lv 35 전엔 레이드 임무 없음, 1개 = 악몽 열쇠 1 (최대 5)', () => {
    expect(save(9).weekly.missions).toEqual([]);
    for (let i = 0; i < 20; i++) { seed = i + 3; expect(save(20).weekly.missions.some(m => m.key === 'w_raid3')).toBe(false); }
    const s = save(40);
    expect(s.weekly.missions.length).toBe(3);
    s.weekly.missions = [{ key: 'w_raid3', n: 0, got: false }, { key: 'w_chest5', n: 0, got: false }, { key: 'w_hard5', n: 0, got: false }];
    for (let i = 0; i < 3; i++) onRun(s, ev({ raid: 10 }));
    expect(missionReady(s.weekly.missions[0])).toBe(true);
    s.wallet.shards = SHARD_MAX;
    expect(claimMission(s, 'weekly', 0, T0)).toMatch(/가득/);
    s.wallet.shards = 1;
    expect(claimMission(s, 'weekly', 0, T0)).toMatchObject({ shards: 1, pass: 800 });
    expect(s.wallet.shards).toBe(2);
    expect(WEEKLY.length).toBeGreaterThanOrEqual(3);
  });
  it('월요일 오전 6시에 리셋: 제작 횟수·공훈 상한·레이드 장비 기록, 주간 도전 기록 → 상자', () => {
    const s = save(40);
    s.weekly.craft = 5; s.weekly.merit[10] = 150; s.weekly.loot = ['abyss1|보통']; s.weekly.chalBest = 12;
    rollover(s, new Date(2026, 9, 12, 5).getTime(), rng);
    expect(s.weekly.craft).toBe(5);
    rollover(s, new Date(2026, 9, 12, 6).getTime(), rng);
    expect([s.weekly.craft, s.weekly.merit[10], s.weekly.loot.length, s.weekly.chalBest, s.chalChest]).toEqual([0, 0, 0, 0, 12]);
    const r = claimChalChest(s, rng, T0);
    expect(typeof r).toBe('object');
    expect((r as { items: { grade: string }[] }).items.map(i => i.grade)).toEqual(['영웅']);
    expect(s.chalChest).toBe(0);
  });
});

describe('재화 (12)', () => {
  it('악몽 열쇠: 제작 골드 1,000 + 강화석 5, 주 5회, 최대 5개. 악몽 입장에 1개', () => {
    const s = save(30);
    s.mats.stone = 100;
    for (let i = 0; i < 5; i++) expect(craftShard(s)).toBe('');
    expect(craftShard(s)).toMatch(/가득/);
    s.wallet.shards = 0;
    expect(craftShard(s)).toMatch(/5번/);
    expect(s.player.gold).toBe(100000 - 5 * SHARD_CRAFT.gold);
    expect(spendShard(s)).toMatch(/없음/);
    s.wallet.shards = 1;
    expect(spendShard(s)).toBe('');
    expect(s.wallet.shards).toBe(0);
  });
  it('공훈 교환: 원하는 부위 영웅 장비 1개 = 100', () => {
    const s = save(40);
    s.wallet.merit = 150;
    expect(exchangeMerit(s, 'tail' as never)).toMatch(/없는 부위/);
    const it = exchangeMerit(s, 'ring', () => 0); // 첫 종류 (반지)
    expect(it).toMatchObject({ id: expect.any(Number), grade: '영웅', slot: 'ring', kind: 'ring', plus: 0, name: '성스러운 반지' });
    expect(typeof it === 'object' && it.lines).toHaveLength(3);
    expect(s.wallet.merit).toBe(50);
    expect(exchangeMerit(s, 'ring')).toMatch(/부족/);
  });
  it('소비 아이템: 레벨 비례 가격, 종류마다 최대 20, 깃털은 안 팖', () => {
    const s = save(20);
    expect(itemPrice('mana', 20)).toBe(200);
    expect(itemPrice('feather', 20)).toBeNull();
    s.bag.mana = 18;
    expect(buyItem(s, 'mana', 5)).toBe('');
    expect([s.bag.mana, s.player.gold]).toEqual([BAG_MAX, 100000 - 2 * 200]);
    expect(buyItem(s, 'mana')).toMatch(/가득/);
    expect(buyItem(s, 'feather')).toMatch(/안 팖/);
  });
  it('새 저장·옛 저장(v4)은 처음 가방', () => {
    expect(newSave(1).bag).toEqual(STARTER_BAG);
    const d = migrate({ v: 4, createdAt: 1, player: { level: 20, xp: 0, gold: 5 } });
    expect([d.bag, d.wallet.shards, d.weekly.merit[20], d.pass.xp]).toEqual([STARTER_BAG, 0, 0, 0]);
  });
});

describe('정산 연결', () => {
  it('공개모집 일일 보너스: 이긴 판 첫 3번 골드 ×2', () => {
    const s = save(20);
    const golds = [0, 1, 2, 3].map(() => settle(s, result(), rng, [], T0).gold);
    const base = clearGold(5, '보통', 'S'); // 녹슨 요새 열림 레벨 (34 5-2)
    expect(golds).toEqual([base * 2, base * 2, base * 2, base]);
    expect(settle(s, result(), rng, [], T0).pubBonus).toBe(0);
  });
  it('레이드: 공훈 (주 150 상한), 장비는 보스·난이도마다 주 1번', () => {
    const s = save(40);
    s.daily.pub = 3;
    const raid = () => settle(s, result({ content: 'abyss1', diff: '어려움', segN: 1, segIdx: 0 }), rng, [], T0);
    const a = raid();
    expect([a.merit, a.items.length, a.lootLocked]).toEqual([MERIT[10]['어려움'], 1, false]);
    const b = raid();
    expect([b.merit, b.items, b.lootLocked]).toEqual([15, [], true]);
    for (let i = 0; i < 10; i++) raid();
    expect(s.weekly.merit[10]).toBe(150);
    expect(raid().merit).toBe(0);
    expect(s.wallet.merit).toBe(150);
  });
  it('쓴 소비 아이템은 가방에서 빠짐 (튜토리얼은 그대로), 첫 클리어 크리스탈, 임무 진행', () => {
    const s = save(20);
    s.bag.mana = 3;
    const x = settle(s, result({ itemsUsed: { mana: 2 } }), rng, [], T0);
    expect(s.bag.mana).toBe(1);
    expect(x.crystal).toBe(10);
    expect(s.daily.missions.some(m => m.n > 0)).toBe(true);
    const t = newSave(1); t.bag.mana = 3;
    settle(t, result({ itemsUsed: { mana: 2 } }), rng);
    expect(t.bag.mana).toBe(3);
  });
  it('엔진: 가방에 남은 만큼만 단축칸 횟수 (19 11장)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, items: ['mana', 'life', 'cleanse'], itemCap: { mana: 0, life: 1 } });
    expect(f.items).toEqual({ mana: 0, life: 1, cleanse: 1 });
    expect(E.create({ encounter: 'warden', diff: '보통', seed: 1, items: ['life'] }).items).toEqual({ life: 2 });
  });
});

describe('시즌 패스 · 월정액 (15 4·5장)', () => {
  it('1,000마다 1단계 (최대 50), 무료 라인 받기, 프리미엄은 크리스탈 1,000', () => {
    const s = save(20);
    expect(addPassXp(s, 2500, T0)).toBe(2500);
    expect(passLevel(s.pass.xp)).toBe(2);
    expect(passLevel(PASS_XP * 80)).toBe(50);
    expect(claimPass(s, 3, 'free', T0)).toMatch(/못 올라감/);
    expect(claimPass(s, 1, 'free', T0)).toMatchObject({ stone: 5 });
    expect(claimPass(s, 1, 'free', T0)).toMatch(/이미/);
    expect(claimPass(s, 1, 'prem', T0)).toMatch(/프리미엄/);
    expect(buyPremium(s)).toMatch(/부족/);
    s.wallet.crystal = 1200;
    expect(buyPremium(s)).toBe('');
    expect(claimPass(s, 1, 'prem', T0)).toMatchObject({ deco: '시즌 애드온 (기본형)' });
    expect(s.decos).toContain('시즌 애드온 (기본형)');
    expect(s.wallet.crystal).toBe(200);
  });
  it('따라잡기 3주는 패스 경험치 +50%', () => {
    const s = save(20);
    expect(addPassXp(s, 100, T0 + 11 * 7 * D)).toBe(150);
  });
  it('월정액: 300 바로 + 매일 30 (날이 바뀔 때)', () => {
    const s = save(20);
    grantMember(s, T0);
    expect([isMember(s, T0), s.wallet.crystal]).toEqual([true, MEMBER.now]);
    rollover(s, T0 + D, rng);
    expect(s.wallet.crystal).toBe(MEMBER.now + MEMBER.daily);
    expect(isMember(s, T0 + 31 * D)).toBe(false);
  });
});
