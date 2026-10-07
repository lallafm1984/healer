/** 장비 강화·분해·세트 (02 10장, 12 3장) */
import { beforeEach, describe, expect, it } from 'vitest';
import { clearMats, enhanceCost, rollItem, salvageOf, type GearItem } from '../src/data/equipment';
import { NO_SET_FX, setCounts, setFxOf, SETS } from '../src/data/sets';
import * as E from '../src/engine';
import { cdOf } from '../src/engine/talents';
import { settle, type BattleResult } from '../src/game/settle';
import { enhance, G, salvage } from '../src/game/state';
import { migrate, newSave } from '../src/platform/storage';

const item = (o: Partial<GearItem> = {}): GearItem => ({ id: 1, slot: 'head', grade: '희귀', plus: 0, name: '', ...o });

describe('강화 (12 3-2)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('비용: 골드 = 등급 기본값 × 단계², +1~+5 강화석, +6~+10 정제 강화석', () => {
    expect(enhanceCost(item())).toEqual({ gold: 40, stone: 1, refined: 0, to: 1 });
    expect(enhanceCost(item({ plus: 4 }))).toEqual({ gold: 40 * 25, stone: 5, refined: 0, to: 5 });
    expect(enhanceCost(item({ plus: 5, grade: '영웅' }))).toEqual({ gold: 80 * 36, stone: 0, refined: 1, to: 6 });
    expect(enhanceCost(item({ plus: 10 }))).toBeNull();
  });
  it('희귀 0 → +5 = 골드 2,200 (12 문서 예시)', () => {
    let g = 0; const it = item();
    for (let i = 0; i < 5; i++) { g += enhanceCost(it)!.gold; it.plus++; }
    expect(g).toBe(2200);
  });
  it('착용·가방 장비 모두 강화, 모자라면 이유, 실패 없음', () => {
    const it = item({ id: 7 });
    G.save.gear.equipped.head = it;
    expect(enhance(7)).toMatch(/골드 부족/);
    G.save.player.gold = 100;
    expect(enhance(7)).toMatch(/강화석 부족/);
    G.save.mats.stone = 1;
    expect(enhance(7)).toBe('');
    expect([it.plus, G.save.player.gold, G.save.mats.stone]).toEqual([1, 60, 0]);
  });
});

describe('분해 (12 3-1)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('골드 = 등급값 + 강화 단계당 10%, 영웅·전설은 정제 강화석', () => {
    expect(salvageOf(item({ grade: '일반' }))).toEqual({ gold: 10, stone: 1, refined: 0 });
    expect(salvageOf(item({ grade: '영웅', plus: 5 }))).toEqual({ gold: 300, stone: 6, refined: 1 });
  });
  it('가방 장비만, 여러 개 한 번에', () => {
    G.save.gear.bag = [item({ id: 1, grade: '일반' }), item({ id: 2, grade: '고급' }), item({ id: 3 })];
    G.save.gear.equipped.head = item({ id: 9 });
    const r = salvage([1, 2, 9]);
    expect(r).toEqual({ n: 2, gold: 40, stone: 3, refined: 0 });
    expect(G.save.gear.bag.map(x => x.id)).toEqual([3]);
    expect(G.save.gear.equipped.head?.id).toBe(9);
    expect([G.save.player.gold, G.save.mats.stone]).toEqual([40, 3]);
  });
  it('옛 저장은 재료 0', () => {
    const o = newSave(1) as Partial<ReturnType<typeof newSave>>;
    delete o.mats;
    expect(migrate(o).mats).toEqual({ stone: 0, refined: 0 });
  });
});

describe('세트 (02 10-3)', () => {
  it('세트 부위만 셈, 2세트·4세트 효과', () => {
    const d = SETS.dawn;
    const two = [item({ slot: d.slots[0], set: 'dawn' }), item({ slot: d.slots[1], set: 'dawn' }), item({ slot: 'weapon', set: 'dawn' })];
    expect(setCounts(two)).toEqual({ dawn: 2 });
    expect(setFxOf(two)).toEqual({ ...NO_SET_FX, hotAmt: 0.15 });
    const four = d.slots.map(s => item({ slot: s, set: 'dawn' }));
    expect(setFxOf(four)).toEqual({ ...NO_SET_FX, hotAmt: 0.15, hotEnd: 0.3 });
  });
  it('세트 드롭: 던전 세트는 희귀 이상·세트 부위만, 이름은 「세트의 부위」', () => {
    let seen = 0, k = 11;
    const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 3000; i++) {
      const it = rollItem(r, '어려움', 'B', 30, i, SETS.dawn);
      if (it.set) {
        seen++;
        expect(['희귀', '영웅', '전설']).toContain(it.grade);
        expect(SETS.dawn.slots).toContain(it.slot);
        expect(it.name.startsWith('새벽 순례자의 ')).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(200);
  });
  it('레이드 세트는 영웅 이상이면 언제나', () => {
    let k = 3; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const it = rollItem(r, '악몽', 'B', 60, i, SETS.belfry);
      const eligible = SETS.belfry.slots.includes(it.slot) && it.grade !== '희귀';
      expect(!!it.set).toBe(eligible);
    }
  });
});

describe('세트 효과 (전투)', () => {
  const fight = (fx: Partial<typeof NO_SET_FX>, enc: 'plague' | 'warden' = 'plague') => {
    const f = E.create({ encounter: enc, diff: '보통', seed: 3, level: 100, setFx: fx });
    f.gear.crit = 0; f.skills.forEach(s => { s.next = Infinity; });
    return f;
  };
  const step = (f: ReturnType<typeof fight>, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };
  it('새벽 순례자: 소생 틱 +15%, 끝까지 가면 총량 30%', () => {
    const f = fight({ hotAmt: 0.15, hotEnd: 0.3 });
    const u = f.party[0]; u.max = 1e6; u.hp = 1;
    E.use(f, 'renew', u.cell);
    step(f, 9.2);
    expect(u.hp - 1).toBeCloseTo(80 * 1.15 * 3 * 1.3, 4);
  });
  it('종탑 순례자: 공대 쿨기 -40초, 범위 힐 +10%', () => {
    const f = fight({ raidCd: 40, aoeHeal: 0.1 });
    expect(cdOf(f, 'hymn')).toBe(140);
    for (const u of f.party) u.hp = 1;
    const u = f.party[0];
    E.use(f, 'poh', u.cell); step(f, 2.1);
    expect(u.hp - 1).toBeCloseTo(198, 4);
  });
  it('대성당의 빛: 마나 재생 +10%, 범위 힐 6명 이상이면 마나 +2%', () => {
    const f = fight({ regen: 0.1 }), g = fight({});
    f.mana = g.mana = 10; step(f, 1); step(g, 1);
    expect(f.mana - 10).toBeCloseTo((g.mana - 10) * 1.1, 6);
    const h = fight({ aoeMana: 2 });
    const c = h.party.find(u => h.party.filter(v => E.hexDist(h.cells[v.cell], h.cells[u.cell]) <= 1).length >= 6);
    if (c) {
      const k = fight({});
      E.use(h, 'poh', c.cell); E.use(k, 'poh', c.cell);
      step(h, 2.1); step(k, 2.1);
      expect(h.mana - k.mana).toBeCloseTo(2, 6);
    }
  });
});

describe('클리어 재료', () => {
  const res = (o: Partial<BattleResult>): BattleResult => ({
    content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
    healed: 7000, overheal: 1000, dispels: 0, dispellable: 0, endMana: 20, minMana: 5, auto: false, party: [], detail: [], ...o,
  });
  it('던전 강화석 (난이도마다 +1), 레이드는 정제 강화석도', () => {
    expect(clearMats('쉬움', 0)).toEqual({ stone: 1, refined: 0 });
    expect(clearMats('악몽', 0)).toEqual({ stone: 4, refined: 0 });
    expect(clearMats('보통', 10)).toEqual({ stone: 3, refined: 1 });
    expect(clearMats('악몽', 20)).toEqual({ stone: 5, refined: 3 });
  });
  it('정산에 들어가고 저장됨, 지면 없음', () => {
    const s = newSave(1);
    const x = settle(s, res({}), () => 0.5);
    expect(x.mats).toEqual({ stone: 2, refined: 0 });
    expect(s.mats).toEqual({ stone: 2, refined: 0 });
    const y = settle(s, res({ win: false }), () => 0.5);
    expect(y.mats).toEqual({ stone: 0, refined: 0 });
  });
});
