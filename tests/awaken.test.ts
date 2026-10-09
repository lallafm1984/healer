/** 옵션 각성 · 목표까지 강화 예상 (34 6-5 · 7-3) */
import { beforeEach, describe, expect, it } from 'vitest';
import { awakenValue, enhanceForecast, type GearItem } from '../src/data/equipment';
import { enhanceTry, G } from '../src/game/state';
import { newSave } from '../src/platform/storage';

const head = (o: Partial<GearItem> = {}): GearItem => ({
  id: 5, slot: 'head', kind: 'hood', grade: '영웅', plus: 0, name: '', lines: [{ stat: 'crit', roll: 0.8 }, { stat: 'haste', roll: 0.8 }], specs: [], ...o,
});

describe('목표까지 강화 예상', () => {
  it('평균 시도: +5까지 약 7번 · +8까지 약 24번 · +10까지 약 70번 (34 6-5)', () => {
    const it0 = head();
    expect(enhanceForecast(it0, 5).tries).toBeGreaterThan(6);
    expect(enhanceForecast(it0, 5).tries).toBeLessThan(8);
    expect(enhanceForecast(it0, 8).tries).toBeGreaterThan(20);
    expect(enhanceForecast(it0, 8).tries).toBeLessThan(28);
    expect(enhanceForecast(it0, 10).tries).toBeGreaterThan(60);
    expect(enhanceForecast(it0, 10).tries).toBeLessThan(80);
  });
  it('지금 단계부터만 셈, 첫 단계 (+1 100%)는 1번', () => {
    expect(enhanceForecast(head(), 1)).toEqual({ tries: 1, gold: 20, stone: 1, refined: 0 });
    expect(enhanceForecast(head({ plus: 9 }), 10).tries).toBeCloseTo(enhanceForecast(head(), 10).tries - enhanceForecast(head(), 9).tries);
  });
});

describe('옵션 각성 (+3 · +6 · +9 처음 닿을 때만)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.player.gold = 1e7; G.save.mats.stone = 999; G.save.mats.refined = 999;
  });
  it('+3에 처음 닿으면 한 줄이 영웅 최대값 25% 오르고, 떨어졌다 다시 닿으면 안 함', () => {
    G.save.gear.equipped.head = head({ plus: 2 });
    const o = enhanceTry(5, () => 0) as Exclude<ReturnType<typeof enhanceTry>, string>;
    const it = G.save.gear.equipped.head!;
    expect([o.ok, o.to, o.awaken]).toEqual([true, 3, 0]);
    expect(it.lines[0].up).toBeCloseTo(awakenValue(it.lines[0]));
    expect(it.top).toBe(3);
    const f = enhanceTry(5, () => 0.99) as Exclude<ReturnType<typeof enhanceTry>, string>;
    expect([f.ok, f.to, f.awaken]).toEqual([false, 2, null]);
    expect(it.lines[0].up).toBeCloseTo(awakenValue(it.lines[0]));
    const again = enhanceTry(5, () => 0) as Exclude<ReturnType<typeof enhanceTry>, string>;
    expect([again.ok, again.to, again.awaken]).toEqual([true, 3, null]);
    expect(it.lines[1].up).toBeUndefined();
  });
  it('옛 장비 (최고 단계 기록 없음)는 지금 단계를 이미 닿은 것으로', () => {
    G.save.gear.equipped.head = head({ plus: 5 });
    const o = enhanceTry(5, () => 0) as Exclude<ReturnType<typeof enhanceTry>, string>;
    expect([o.to, o.awaken]).toEqual([6, 0]);
    G.save.gear.equipped.head = head({ plus: 6, top: undefined });
    const p = enhanceTry(5, () => 0) as Exclude<ReturnType<typeof enhanceTry>, string>;
    expect([p.to, p.awaken]).toEqual([7, null]);
  });
});
