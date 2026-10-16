/**
 * 캐릭터 선택 (68, 2026-10-12 Lim): 타이틀 → 캐릭터 선택 → 게임 시작. 캐릭터마다 따로 계정처럼,
 * 같이 쓰는 건 설정 · 산 것 · 캐릭터 칸. 칸은 골드로 모아 사거나 앱 결제로 바로 (Lim 「둘 다」)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CHAR_SLOT, slotGold } from '../src/data/economy';
import { makeItem } from '../src/data/equipment';
import { buySlot, grantSlot, rollover, slotOffer } from '../src/game/economy';
import { charList, G, makeChar, pickChar, resetSave } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { adCharge } from '../src/game/stamina';
import { charKey, load, loadChar, migrate, newSave, save, SAVE_VERSION, type KV, type SaveData } from '../src/platform/storage';

let seed = 3;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const DAY = new Date(2026, 9, 12, 9).getTime(), NEXT_DAY = new Date(2026, 9, 13, 9).getTime();
const fresh = (slots = 3) => {
  G.save = newSave(1);
  G.save.tut = TUT.done;
  G.save.settings.devUnlock = false;
  G.save.roster.slots = slots;
  rollover(G.save, DAY, rng);
};
/** 기록되는 기기 저장 (쓴 순서도 남김) */
const memKV = () => {
  const m = new Map<string, string>(), log: string[] = [];
  const kv: KV = {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); log.push(`set ${k}`); },
    removeItem: k => { m.delete(k); log.push(`del ${k}`); },
  };
  return { kv, m, log };
};

describe('캐릭터 목록', () => {
  beforeEach(() => fresh());
  it('새 저장 = 사제 캐릭터 하나, 칸 1', () => {
    const s = newSave(5);
    expect(s.roster).toEqual({ cur: 1, slots: 1, next: 2, chars: [{ id: 1, hero: 'priest', name: '사제', level: 1, at: 5 }] });
  });
  it('만들면 그 캐릭터로 바뀌고, 목록에 지금 캐릭터 표시', () => {
    G.save.player.level = 33;
    expect(makeChar('paladin', '', DAY)).toBe('');
    expect(G.save.hero).toBe('paladin');
    expect(charList()).toEqual([
      { id: 1, hero: 'priest', name: '사제', level: 33, at: 1, cur: false },
      { id: 2, hero: 'paladin', name: '성기사', level: 1, at: DAY, cur: true },
    ]);
  });
  it('튜토리얼 중 · 빈 칸이 없으면 못 만듦', () => {
    G.save.tut = TUT.explore;
    expect(makeChar('druid')).toMatch(/튜토리얼/);
    G.save.tut = TUT.done; G.save.roster.slots = 1;
    expect(makeChar('druid')).toMatch(/빈 칸이 없음/);
    expect(G.save.roster.chars).toHaveLength(1);
  });
  it('같은 직업 둘도 됨, 이름은 안 적으면 「사제 2」 · 적으면 8자까지', () => {
    makeChar('priest', '', DAY);
    expect(G.save.hero).toBe('priest');
    makeChar('druid', '  아주아주긴숲지기이름  ', DAY);
    expect(charList().map(c => c.name)).toEqual(['사제', '사제 2', '아주아주긴숲지기']);
  });
  it('튜토리얼은 계정에 한 번: 새 캐릭터는 바로 로비', () => {
    makeChar('druid', '', DAY);
    expect(G.save.tut).toBe(TUT.done);
  });
  it('없는 캐릭터 · 지금 캐릭터는 못 고름', () => {
    expect(pickChar(1, DAY)).toBe(false);
    expect(pickChar(9, DAY)).toBe(false);
  });
});

describe('캐릭터마다 따로, 계정은 같이 (68 3장)', () => {
  beforeEach(() => fresh());
  it('골드 · 공훈 · 도감 · 기록 · 임무 · 칭호는 캐릭터마다', () => {
    const s = G.save;
    s.player.gold = 900; s.wallet.merit = 3;
    s.gear.codex = ['x']; s.clears.rustfort = { 보통: { stars: 3, grade: 'A', best: 100, n: 2 } }; s.decos = ['칭호'];
    s.daily.missions[0].n = 1;
    makeChar('druid', '', DAY);
    const d = G.save;
    expect([d.player.gold, d.wallet.merit, d.gear.codex, d.clears, d.decos]).toEqual([0, 0, [], {}, []]);
    expect(d.daily.missions.every(m => m.n === 0)).toBe(true);
    pickChar(1, DAY);
    expect([G.save.player.gold, G.save.clears.rustfort?.보통?.stars, G.save.daily.missions[0].n]).toEqual([900, 3, 1]);
  });
  it('설정 · 산 상품 · 휴식 · 패스는 계정 (휠 배치 · 칸 탭은 캐릭터, 81)', () => {
    makeChar('druid', '', DAY);
    const s = G.save;
    s.settings.sound = false; s.settings.tapKey = 'flash';
    s.bought = ['noads']; s.stamina = { n: 37, at: DAY, day: 'd', ads: 2 }; s.pass.xp = 3000;
    pickChar(1, DAY);
    const p = G.save;
    expect([p.settings.sound, p.settings.tapKey, p.bought, p.stamina.n, p.stamina.ads, p.pass.xp]).toEqual([false, 'heal', ['noads'], 37, 2, 3000]);
    p.stamina.n = 12;
    pickChar(2, DAY);
    expect([G.save.stamina.n, G.save.settings.tapKey]).toEqual([12, 'flash']);
  });
  it('휴식 광고 충전은 캐릭터를 바꿔도 하루 3번 (계정, 81)', () => {
    makeChar('druid', '', DAY);
    for (let i = 0; i < 3; i++) expect(adCharge(G.save, NEXT_DAY)).toBe('');
    pickChar(1, NEXT_DAY);
    expect(adCharge(G.save, NEXT_DAY)).toMatch(/3번/);
  });
  it('광고 본 횟수는 캐릭터마다 (캐릭터 상자에 붙은 광고)', () => {
    G.save.daily.ads.chest = 1;
    makeChar('druid', '', DAY);
    expect(G.save.daily.ads.chest).toBe(0);
  });
});

describe('캐릭터 칸 (68 2장, Lim 「둘 다」, 91에서 골드로 사는 길 되살림)', () => {
  beforeEach(() => fresh(1));
  it('골드: 지금 캐릭터 Lv 10부터, 2번째 2,000 · 3번째 5,000 · 그 뒤 10,000, 최대 6칸', () => {
    expect([slotGold(1), slotGold(2), slotGold(3), slotGold(5)]).toEqual([2000, 5000, 10000, 10000]);
    G.save.player.level = 9; G.save.player.gold = 99999;
    expect(slotOffer(G.save)).toMatchObject({ have: 1, max: 6, gold: 2000, ok: false, cash: true });
    expect(buySlot(G.save)).toMatch(/Lv 10/);
    G.save.player.level = 10; G.save.player.gold = 1999;
    expect(buySlot(G.save)).toMatch(/골드 부족/);
    G.save.player.gold = 7000;
    expect(buySlot(G.save)).toBe('');
    expect([G.save.roster.slots, G.save.player.gold]).toEqual([2, 5000]);
    expect(buySlot(G.save)).toBe('');
    expect([G.save.roster.slots, G.save.player.gold]).toEqual([3, 0]);
    G.save.roster.slots = CHAR_SLOT.max; G.save.player.gold = 99999;
    expect(buySlot(G.save)).toMatch(/가득/);
    expect(grantSlot(G.save)).toMatch(/가득/);
  });
  it('앱 결제: 레벨 · 골드 조건 없이 (튜토리얼 뒤)', () => {
    G.save.player.level = 1;
    expect(slotOffer(G.save).iap).toEqual(CHAR_SLOT.iap);
    expect(grantSlot(G.save)).toBe('');
    expect(G.save.roster.slots).toBe(2);
    G.save.tut = TUT.explore;
    expect(grantSlot(G.save)).toMatch(/튜토리얼/);
  });
  it('산 칸은 계정: 다른 캐릭터에서도 그대로', () => {
    G.save.roster.slots = 2;
    makeChar('druid', '', DAY);
    expect(slotOffer(G.save)).toMatchObject({ have: 2 });
    pickChar(1, DAY);
    expect(G.save.roster.slots).toBe(2);
  });
});

describe('기기 저장 (캐릭터마다 키)', () => {
  const two = (kv: KV): SaveData => {
    const d = newSave(1);
    d.tut = TUT.done; d.roster.slots = 2; d.player.xp = 300;
    save(d, kv);
    G.save = load(kv);
    return G.save;
  };
  it('쉬는 캐릭터는 따로 키, 쉬는 캐릭터를 먼저 쓰고 지금 저장을 씀', () => {
    const { kv, m, log } = memKV();
    two(kv);
    makeChar('druid', '', DAY);
    // 기기 저장이 없는 테스트 환경이라 쉬는 사제는 메모리에 → 기기에 쓰면 따로 키로
    log.length = 0;
    save(G.save, kv);
    expect(log).toEqual([`set ${charKey(1)}`, 'set healer.save', `del ${charKey(2)}`]);
    expect(G.save.roster.chars.every(c => !c.park)).toBe(true);
    expect(JSON.parse(m.get(charKey(1))!).player.xp).toBe(300);
    expect(JSON.parse(m.get('healer.save')!).hero).toBe('druid');
    expect(JSON.parse(m.get(charKey(1))!).roster).toBeUndefined();
  });
  it('껐다 켜도 캐릭터를 다시 고를 수 있음', () => {
    const { kv } = memKV();
    two(kv);
    makeChar('druid', '', DAY);
    save(G.save, kv);
    G.save = load(kv);
    expect(G.save.hero).toBe('druid');
    const p = loadChar(G.save, 1, kv)!;
    expect([p.hero, p.player.xp]).toEqual(['priest', 300]);
  });
  it('저장 지우고 처음부터: 캐릭터 키도 모두 지움', () => {
    const { kv, m } = memKV();
    two(kv);
    makeChar('druid', '', DAY);
    save(G.save, kv);
    expect(m.has(charKey(1))).toBe(true);
    // resetSave는 기기 저장 (localStorage)을 씀 → 여기선 목록의 메모리 캐릭터가 지워지는지만
    makeChar('paladin', '', DAY);
    resetSave();
    expect(G.save.roster.chars).toHaveLength(1);
    expect(G.save.hero).toBe('priest');
  });
});

describe('옛 저장 나누기 v10 → v11 (68 4장)', () => {
  const v10 = (o: Record<string, unknown>) => migrate(JSON.parse(JSON.stringify({ ...newSave(1), v: 10, tut: TUT.done, ...o })));
  const hs = (level: number, o: Record<string, unknown> = {}) => ({ layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, level, xp: 0, ...o });
  it('해 본 직업마다 캐릭터, 칸 = 캐릭터 수. 퀘스트 중 · 안 해 본 직업은 캐릭터 없음', () => {
    const s = v10({ hero: 'priest', player: { level: 40, xp: 0, gold: 10 }, heroes: { druid: hs(12), paladin: { layout: null, tapKey: 'heal', unlocked: false, quest: 0, wins: 0 } } });
    expect(s.roster.chars.map(c => [c.id, c.hero, c.level])).toEqual([[1, 'priest', 40], [2, 'druid', 12]]);
    expect([s.roster.cur, s.roster.slots, s.roster.next]).toEqual([1, 2, 3]);
  });
  it('계정 것은 가장 높은 캐릭터에게, 나머지는 자기 장비 도감 · 들어갈 수 있는 장소 기록만 (옛 골드는 v16에서 버림, v17 강화석 · 정제 → 골드)', () => {
    const own = makeItem(rng, 'weapon', '희귀', 5);
    const s = v10({
      hero: 'priest', player: { level: 40, xp: 0, gold: 10 }, mats: { stone: 4, refined: 1 }, bag: { mana: 19 }, decos: ['t'], // bag = v15 전 소비 아이템 가방 (불러오면 버림)
      gear: { equipped: {}, bag: [], seen: 0, codex: ['k'], dex: ['d'], dexPaid: 2 },
      clears: { plateau: { 보통: { stars: 3, grade: 'A', best: 50, n: 1 } }, abyss1: { 보통: { stars: 2, grade: 'B', best: 400, n: 1 } } },
      heroes: { druid: hs(12, { gear: { equipped: { weapon: own }, bag: [], seen: 0 } }) },
    });
    expect([s.player.gold, 'mats' in s, 'bag' in s, s.gear.codex, s.gear.dexPaid, s.decos]).toEqual([900, false, false, ['k'], 2, ['t']]);
    const d = s.roster.chars[1].park!;
    expect([d.hero, d.player.level, d.player.gold, 'mats' in d, 'bag' in d, d.gear.dexPaid, d.tut]).toEqual(['druid', 12, 0, false, false, 0, TUT.done]);
    expect(d.gear.equipped.weapon?.id).toBe(5);
    expect(d.gear.dex.length).toBeGreaterThan(0);
    expect(Object.keys(d.clears)).toEqual(['plateau']);
    expect(Object.keys(s.clears).sort()).toEqual(['abyss1', 'plateau']);
  });
  it('공훈 · 휠 배치는 그 직업 캐릭터로, 설정은 모두 같이 (크리스탈 · 열쇠는 81에서 없앰)', () => {
    const s = v10({
      hero: 'priest', player: { level: 40, xp: 0, gold: 0 }, wallet: { crystal: 70, shards: 2, merit: 30, ticket: 0 } as never, settings: { ...newSave(1).settings, sound: false },
      weekly: { week: 'w', missions: [], craft: 1, merit: { 10: 30, 20: 0 }, loot: ['priest|abyss1|보통', 'druid|abyss1|보통'], chalBest: 8, chalHero: 'druid', guild: { n: 0, got: false } } as never,
      heroes: { druid: hs(50, { tapKey: 'flash', merit: { n: 120, week: 'w', got: { 10: 100, 20: 0 } } }) },
    });
    const d = s.roster.chars[1].park!;
    expect([s.wallet.merit, s.weekly.merit[10], s.weekly.loot, s.weekly.chalBest]).toEqual([30, 30, ['abyss1|보통'], 0]);
    expect([d.wallet.merit, d.weekly.merit[10], d.weekly.loot, d.weekly.chalBest, d.settings.tapKey]).toEqual([120, 100, ['druid|abyss1|보통'], 8, 'flash']);
    expect([d.settings.sound, d.wallet, s.wallet]).toEqual([false, { merit: 120 }, { merit: 30 }]);
  });
  it('기기에서 읽으면 쉬는 캐릭터를 바로 따로 키에 씀', () => {
    const { kv, m } = memKV();
    kv.setItem('healer.save', JSON.stringify({ ...newSave(1), v: 10, heroes: { druid: hs(12) } }));
    const s = load(kv);
    expect(s.roster.chars.every(c => !c.park)).toBe(true);
    expect(JSON.parse(m.get(charKey(2))!).hero).toBe('druid');
    expect(JSON.parse(m.get('healer.save')!).v).toBe(SAVE_VERSION);
  });
});
