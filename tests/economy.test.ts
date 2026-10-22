/** 재화 (12, 81)·일일 주간 (13)·상점 (15). 소비 아이템 가방 (19 11장)은 2026-10-16, 시즌 패스 · 공훈은 2026-10-20 없앰 (저장 v28) */
import { describe, expect, it } from 'vitest';
import { FEATURES } from '../src/data/features';
import type { HeroKey } from '../src/data/heroes';
import { DAILY, DAILY_BASIC, WEEKLY, WEEKLY_REWARD } from '../src/data/missions';
import { clearGold } from '../src/data/progression';
import { dayKey, daysBetween, weekKey } from '../src/game/clock';
import {
  chalChestOf, chestState, claimChalChest, claimChest, claimMission,
  missionReady, onAct, onRun, rollover, runGold, swapMission,
} from '../src/game/economy';
import { settle, type BattleResult } from '../src/game/settle';
import { migrate, newSave, type SaveData } from '../src/platform/storage';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** 2026-10-07 (수) 정오 */
const T0 = new Date(2026, 9, 7, 12).getTime();
const H = 3600e3, D = 24 * H;

function save(level = 20): SaveData {
  const s = newSave(1);
  s.tut = 3; s.player.level = level;
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
});

describe('일일 임무 (13 2-1)', () => {
  it('pub2: 길드가 꺼지면 「탐험 클리어」 (던전 클리어와 겹치지 않게, 2026-10-17 Lim), 켜면 공개모집 던전 · 레이드', () => {
    const pub2 = DAILY.find(m => m.key === 'pub2')!, was = FEATURES.guild;
    try {
      FEATURES.guild = false;
      expect(pub2.text).toBe('탐험 클리어');
      expect(pub2.run!(ev({ dungeon: false, explore: true }))).toBe(1);
      expect(pub2.run!(ev())).toBe(0); // 던전 승리는 clear3 몫
      expect(pub2.run!(ev({ dungeon: false, explore: true, win: false }))).toBe(0);
      FEATURES.guild = true;
      expect(pub2.text).toBe('공개모집으로 클리어');
      expect(pub2.run!(ev())).toBe(1);
      expect(pub2.run!(ev({ dungeon: false, explore: true }))).toBe(1); // 탐험도 셈 (103: Lv 1~4는 던전이 없음)
    } finally { FEATURES.guild = was; }
  });
  it('날이 바뀌면 5개 (Lv 1~4는 던전이 없어 「던전 클리어」 빼고 4개, 103), 단순 판 수 임무는 2개까지, 레벨에 맞는 것만', () => {
    for (let i = 0; i < 30; i++) {
      seed = i + 1;
      const s = save(5), low = save(3);
      expect(s.daily.missions.length).toBe(5);
      expect(low.daily.missions.length).toBe(4);
      expect(low.daily.missions.some(m => m.key === 'clear3')).toBe(false);
      expect(s.daily.missions.filter(m => DAILY_BASIC.includes(m.key)).length).toBeLessThanOrEqual(2);
      expect(low.daily.missions.every(m => DAILY.find(d => d.key === m.key)!.lv <= 3)).toBe(true);
    }
  });
  it('판·판매로 채우고 받기: 클리어 골드의 20% (91: #172 전 골드 값, 「장비 강화」 → 「장비 판매」)', () => {
    const s = save(20);
    s.daily.missions = [{ key: 'clear3', n: 0, got: false }, { key: 'nodeath', n: 0, got: false }, { key: 'sell2', n: 0, got: false }, { key: 'dispel10', n: 0, got: false }, { key: 'guild2', n: 0, got: false }];
    expect(onRun(s, ev())).toEqual(['사망자 0명으로 클리어']);
    onRun(s, ev({ pub: false, deaths: 2 })); onRun(s, ev({ win: false }));
    expect(s.daily.missions.map(m => m.n)).toEqual([2, 1, 0, 9, 1]); // 해제는 진 판도 셈
    onAct(s, 'sell'); onAct(s, 'sell'); onAct(s, 'sell');
    expect(s.daily.missions[2].n).toBe(2);
    expect(DAILY.some(m => m.key === 'enhance2')).toBe(false);
    expect(claimMission(s, 'daily', 0)).toBe('아직 못 채움');
    const g0 = s.player.gold;
    const r = claimMission(s, 'daily', 1);
    expect(runGold(20)).toBe(clearGold(20, '보통', 'A'));
    expect(r).toEqual({ gold: Math.round(runGold(20) * 0.2) });
    expect(s.player.gold - g0).toBe(55);
    expect(claimMission(s, 'daily', 1)).toBe('아직 못 채움');
  });
  it('완료 상자: 5개 다 받으면 1번 (클리어 골드 1판 + 장비 1개), 광고로 한 번 더', () => {
    const s = save(20);
    expect(claimChest(s, rng)).toMatch(/5개/);
    s.daily.missions.forEach(m => { m.n = 99; m.got = true; });
    expect(chestState(s).today).toBe(true);
    const bag = s.gear.bag.length;
    const r = claimChest(s, rng);
    expect(r).toMatchObject({ gold: runGold(20) });
    expect(r).not.toHaveProperty('pass');
    expect(s.gear.bag.length).toBe(bag + 1);
    expect(claimChest(s, rng)).toMatch(/5개/);
    expect(claimChest(s, rng, true)).toMatchObject({ gold: runGold(20) });
    expect(claimChest(s, rng, true)).toMatch(/먼저/);
  });
  it('놓친 날 상자는 2일까지 쌓임, 접속한 날 못 받은 건 안 쌓임 (13 7장)', () => {
    const s = save(20);
    rollover(s, T0 + D, rng);
    expect(s.daily.banked).toBe(0);
    rollover(s, T0 + 5 * D, rng);
    expect(s.daily.banked).toBe(2);
    expect(claimChest(s, rng)).toMatchObject({ gold: runGold(20) });
    expect(s.daily.banked).toBe(1);
  });
  it('「해제 성공」은 지울 디버프가 나오는 레벨부터 (2026-10-18 해금 레벨 검토, 예전엔 모든 직업 Lv 5)', () => {
    const can = (h: HeroKey, lv: number) => Array.from({ length: 40 }, (_, i) => {
      seed = i + 1;
      const s = newSave(1);
      s.tut = 3; s.hero = h; s.player.level = lv;
      rollover(s, T0, rng);
      return s.daily.missions.some(m => m.key === 'dispel10');
    }).some(Boolean);
    expect([can('priest', 6), can('priest', 7), can('astrologer', 12), can('astrologer', 13), can('shaman', 21), can('shaman', 22)]).toEqual([false, true, false, true, false, true]);
  });
  it('직업을 바꿔 못 채우게 된 「해제 성공」은 다음 화면 진입 때 다른 임무로 (교체 횟수는 안 씀)', () => {
    const s = save(15);
    s.daily.missions = [{ key: 'clear3', n: 0, got: false }, { key: 'nodeath', n: 0, got: false }, { key: 'sell2', n: 0, got: false }, { key: 'dispel10', n: 3, got: false }, { key: 'mana20', n: 0, got: false }];
    expect(rollover(s, T0, rng).fixed).toBe(0);
    s.hero = 'shaman';
    expect(rollover(s, T0, rng).fixed).toBe(1);
    expect(s.daily.missions.length).toBe(5);
    expect(s.daily.missions.map(m => m.key)).not.toContain('dispel10');
    expect(s.daily.swapped).toBe(false);
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
  it('Lv 10부터 3개, 10인 레이드 열림 (Lv 45) 전엔 레이드 임무 없음, 1개 = 클리어 골드 3판 (91: #172 전 값)', () => {
    expect(save(9).weekly.missions).toEqual([]);
    for (let i = 0; i < 20; i++) { seed = i + 3; expect(save(20).weekly.missions.some(m => m.key === 'w_raid3')).toBe(false); }
    const s = save(40);
    expect(s.weekly.missions.length).toBe(3);
    s.weekly.missions = [{ key: 'w_raid3', n: 0, got: false }, { key: 'w_chest5', n: 0, got: false }, { key: 'w_hard5', n: 0, got: false }];
    for (let i = 0; i < 3; i++) onRun(s, ev({ raid: 10 }));
    expect(missionReady(s.weekly.missions[0])).toBe(true);
    const g0 = s.player.gold;
    expect(claimMission(s, 'weekly', 0)).toEqual({ gold: runGold(40) * WEEKLY_REWARD.runs });
    expect(s.player.gold - g0).toBe(495 * 3);
    expect(claimMission(s, 'weekly', 0)).toMatch(/못 채움/);
    expect(WEEKLY.length).toBeGreaterThanOrEqual(3);
  });
  it('월요일 오전 6시에 리셋: 레이드 장비 기록, 주간 도전 기록 → 상자', () => {
    const s = save(40);
    s.weekly.loot = ['abyss1|보통']; s.weekly.chalBest = 12;
    rollover(s, new Date(2026, 9, 12, 5).getTime(), rng);
    expect(s.weekly.loot.length).toBe(1);
    rollover(s, new Date(2026, 9, 12, 6).getTime(), rng);
    expect([s.weekly.loot.length, s.weekly.chalBest, s.chalChest]).toEqual([0, 0, 12]);
    const r = claimChalChest(s, rng);
    expect(typeof r).toBe('object');
    expect((r as { items: { grade: string }[] }).items.map(i => i.grade)).toEqual(['희귀']);
    expect(s.chalChest).toBe(0);
  });
  it('주간 도전 상자 (2026-10-13 Lim): 5단계 고급 1 · 10 희귀 1 · 15 영웅 1 · 20 영웅 2, 1~4단계는 골드만. 장비 · 골드는 받는 캐릭터 레벨, 골드는 반 (110 2차)', () => {
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20].map(n => chalChestOf(n).grades.join('+'))).toEqual(['', '', '고급', '고급', '희귀', '희귀', '영웅', '영웅', '영웅+영웅']);
    const s = save(30);
    s.heroes.druid = { ...(s.heroes.druid ?? {}), level: 80 } as never; // 다른 캐릭터가 더 높아도 이 캐릭터 레벨로
    s.chalChest = 20;
    const r = claimChalChest(s, rng) as { items: { grade: string; lv?: number }[]; gold: number };
    expect(r.items.map(i => [i.grade, i.lv])).toEqual([['희귀', 30], ['희귀', 30]]); // 88: 영웅은 받는 캐릭터 Lv 45부터, 그 전엔 희귀
    expect(chalChestOf(20, 44).grades).toEqual(['희귀', '희귀']);
    expect(chalChestOf(15, 45).grades).toEqual(['영웅']);
    const h = save(50); h.chalChest = 20;
    expect((claimChalChest(h, rng) as { items: { grade: string }[] }).items.map(i => i.grade)).toEqual(['영웅', '영웅']);
    expect([1, 4, 5, 10, 20].map(n => chalChestOf(n).goldRuns)).toEqual([1, 1, 2, 3, 5]);
    expect(r.gold).toBe(Math.round(5 * runGold(30) * 0.5));
    const t = save(30); t.chalChest = 3;
    const g0 = t.player.gold;
    const g = claimChalChest(t, rng) as { items?: unknown[]; gold: number };
    expect(g.items ?? []).toEqual([]);
    expect([g.gold, t.player.gold - g0]).toEqual([193, 193]); // 385의 반
  });
});

describe('재화 (12)', () => {
  it('81: 크리스탈 · 악몽 열쇠 · 모집권 · 월정액이 저장에 없음, v28: 시즌 패스 · 공훈도 없음, v31: 도감 칭호 (decos)도 없음 (옛 저장은 버림)', () => {
    const d = migrate({ v: 13, createdAt: 1, wallet: { crystal: 500, shards: 3, merit: 40, ticket: 2 }, member: 9e15, firstBuy: ['c100'], pass: { season: 1, xp: 3000, premium: true, free: [1], prem: [1] }, weekly: { week: 'x', craft: 3, merit: { 10: 90, 20: 0 } }, decos: ['시즌 테두리'], heroes: { druid: { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, merit: { n: 5, week: 'x', got: { 10: 0, 20: 0 } } } } });
    expect(['member', 'firstBuy', 'wallet', 'pass'].filter(k => k in d)).toEqual([]);
    expect(['merit' in d.weekly, 'merit' in (d.heroes.druid ?? {})]).toEqual([false, false]);
    expect('decos' in d).toBe(false);
    expect(['wallet' in newSave(1), 'pass' in newSave(1), 'merit' in newSave(1).weekly]).toEqual([false, false, false]);
    expect('craft' in d.weekly).toBe(false);
    expect(d.bought).toEqual([]);
  });
  it('소비 아이템 가방 · 단축칸은 없음 (2026-10-16): 새 저장에 없고 옛 저장 (v14)의 것은 버림', () => {
    expect(['bag' in newSave(1), 'items' in newSave(1)]).toEqual([false, false]);
    const d = migrate({ v: 14, createdAt: 1, player: { level: 20, xp: 0, gold: 5 }, bag: { mana: 3 }, items: ['mana', 'life'] });
    expect(['bag' in d, 'items' in d]).toEqual([false, false]);
  });
});

describe('정산 연결', () => {
  it('공개모집 일일 보너스: 이긴 판 첫 3번 (좋은 장비 확률, v16: 골드 ×2 없앰)', () => {
    const s = save(20);
    expect([0, 1, 2, 3].map(() => settle(s, result(), rng, [], T0).pubBonus)).toEqual([1, 2, 3, 0]);
    expect(settle(s, result(), rng, [], T0).pubBonus).toBe(0);
  });
  it('레이드: 장비는 매 판 1개 · 보스·난이도마다 주 첫 클리어만 레이드 보상 (Lim 「주 첫 판만 크게」), 공훈 없음 (v28)', () => {
    const s = save(40);
    s.daily.pub = 3;
    const raid = () => settle(s, result({ content: 'abyss1', diff: '어려움', segN: 1, segIdx: 0 }), rng, [], T0);
    const a = raid();
    expect([a.items.length, a.raidLoot, 'merit' in a]).toEqual([1, 'first', false]);
    const b = raid();
    expect([b.items.length, b.raidLoot]).toEqual([1, 'again']);
    expect(s.weekly.loot).toEqual(['abyss1|어려움']); // 다시 깬 판은 주 첫 보상 기록을 더하지 않음
    expect(['wallet' in s, 'merit' in s.weekly]).toEqual([false, false]);
  });
  it('첫 클리어 표시, 임무 진행', () => {
    const s = save(20);
    const x = settle(s, result(), rng, [], T0);
    expect(x.first).toBe(true);
    expect(s.daily.missions.some(m => m.n > 0)).toBe(true);
  });
});

describe('시계를 뒤로 (103 다른 문제점 1)', () => {
  it('일일 · 주간은 지금까지 본 것보다 늦을 때만 리셋: 7일 뒤로 갔다 와도 주 첫 보상 기록 그대로', () => {
    const s = save(40), now = T0 + 7 * 864e5;
    rollover(s, now, rng);
    s.weekly.loot = ['abyss1|보통'];
    const day = s.daily.day, week = s.weekly.week;
    rollover(s, now - 7 * 864e5, rng); // 시계를 7일 뒤로
    expect([s.daily.day, s.weekly.week, s.weekly.loot]).toEqual([day, week, ['abyss1|보통']]);
    rollover(s, now, rng); // 돌아옴: 같은 날 · 같은 주
    expect(s.weekly.loot).toEqual(['abyss1|보통']);
    rollover(s, now + 7 * 864e5, rng); // 진짜 다음 주
    expect(s.weekly.loot).toEqual([]);
  });
});

describe('보상 넷 (103 「넷 다」 2 · 4)', () => {
  it('클리어 골드 1판 (임무 · 상자 · 도감 기준) = 그 레벨에 열린 가장 큰 콘텐츠 보통 A 한 판: Lv 45 전 던전 · 45~69 10인 · 70부터 20인', () => {
    expect(runGold(44)).toBe(clearGold(44, '보통', 'A'));
    expect(runGold(45)).toBe(clearGold(45, '보통', 'A', 10));
    expect(runGold(69)).toBe(clearGold(69, '보통', 'A', 10));
    expect(runGold(70)).toBe(clearGold(70, '보통', 'A', 20));
  });
});

describe('105 QA: 탐험 길드파티도 「클리어」 임무 · 길드 주간 목표', () => {
  it('길드파티로 클리어 · 주간 목표는 탐험 길드파티도 셈', () => {
    const g2 = DAILY.find(m => m.key === 'guild2')!;
    expect(g2.run!(ev({ dungeon: false, explore: true, pub: false }))).toBe(1);
    const s = save(20);
    onRun(s, ev({ dungeon: false, explore: true, pub: false }));
    expect(s.weekly.guild.n).toBe(1);
  });
});

describe('105 QA 2바퀴: 주 중간 첫 주간 임무', () => {
  it('남은 날 · 안 연 상자로 「일일 상자 5번」을 못 채우면 안 뽑음', () => {
    for (let i = 0; i < 20; i++) {
      seed = i + 3;
      const s = save(9); // 2026-10-07 (수), 주는 월요일 10-05부터
      s.player.level = 10;
      rollover(s, T0 + 2 * D, rng); // 금요일에 Lv 10: 남은 날 3 (금 · 토 · 일) → 상자 많아야 3~4개
      expect(s.weekly.missions.length).toBeGreaterThan(0);
      expect(s.weekly.missions.some(m => m.key === 'w_chest5')).toBe(false);
    }
  });
});

describe('105 QA 3바퀴: 주 첫 접속이 토 · 일', () => {
  it('새 주를 토 · 일에 처음 열면 「일일 상자 5번」은 못 채워서 안 뽑음, 월요일엔 뽑힐 수 있음', () => {
    for (let i = 0; i < 20; i++) {
      seed = i + 7;
      const s = save(15);
      const sat = new Date(2026, 9, 17, 12).getTime(); // 10-12 주의 토요일
      rollover(s, sat, rng);
      expect(s.weekly.missions.some(m => m.key === 'w_chest5'), `seed ${seed}`).toBe(false);
    }
    let any = false;
    for (let i = 0; i < 20 && !any; i++) { seed = i + 7; const s = save(15); rollover(s, new Date(2026, 9, 12, 12).getTime(), rng); any = s.weekly.missions.some(m => m.key === 'w_chest5'); }
    expect(any).toBe(true);
  });
});
