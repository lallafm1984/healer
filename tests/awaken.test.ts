/** 강화 각성 제거: 단계·성공/실패는 유지하고 무작위 옵션은 바꾸지 않는다. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { itemStats, lineValue, type GearItem } from '../src/data/equipment';
import { enhanceTry, G } from '../src/game/state';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';

const head = (plus = 0): GearItem => ({
  id: 5, slot: 'head', kind: 'hood', grade: '영웅', plus, name: '', lv: 30,
  lines: [{ stat: 'crit', roll: 0.8 }, { stat: 'haste', roll: 0.8 }], specs: [],
});

describe('각성 없는 강화', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.player.gold = 1e7; G.save.mats.stone = 999; G.save.mats.refined = 999;
  });
  it.each([3, 6, 9])('+%i 성공·실패·재성공에도 무작위 옵션은 그대로', to => {
    const gear = head(to - 1);
    G.save.gear.equipped.head = gear;
    const lines = structuredClone(gear.lines), stats = itemStats(gear, 30), roll = vi.fn(() => 0);
    expect(enhanceTry(5, roll)).toEqual({ id: 5, ok: true, from: to - 1, to });
    expect(roll).toHaveBeenCalledTimes(1);
    expect(itemStats(gear, 30).int).toBeGreaterThan(stats.int);
    expect(itemStats(gear, 30).crit).toBe(stats.crit);
    expect(enhanceTry(5, () => 0.99)).toEqual({ id: 5, ok: false, from: to, to });
    expect(enhanceTry(5, () => 0)).toEqual({ id: 5, ok: true, from: to, to: to + 1 });
    expect(gear.lines).toEqual(lines);
    expect(gear).not.toHaveProperty('top');
  });
  it('이전 각성 기록을 가방·착용·보관 직업 장비에서 제거하고 강화 단계·굴림은 유지', () => {
    const s = newSave(1), gear = { ...head(6), top: 9, lines: head().lines.map(l => ({ ...l, up: 0.02 })) };
    s.v = 12;
    s.gear.equipped.head = gear;
    s.gear.bag = [{ ...gear, id: 6 }];
    s.heroes.druid = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0,
      gear: { equipped: { head: { ...gear, id: 7 } }, bag: [{ ...gear, id: 8 }], seen: 8 } };
    const expected = itemStats(head(6), 30), out = migrate(s);
    expect(out.v).toBe(SAVE_VERSION);
    const all = [out.gear.equipped.head!, out.gear.bag[0], out.heroes.druid!.gear!.equipped.head!, out.heroes.druid!.gear!.bag[0]];
    for (const item of all) {
      expect(item.plus).toBe(6);
      expect(item.lines).toEqual(head().lines);
      expect(item).not.toHaveProperty('top');
      expect(itemStats(item, 30)).toEqual(expected);
    }
    expect(migrate(out)).toEqual(out);
    expect(gear.top).toBe(9); // 원본 입력은 건드리지 않는다.
    expect(gear.lines[0].up).toBe(0.02);
    expect(lineValue(gear, gear.lines[0], 30)).toBe(lineValue(head(), head().lines[0], 30));
  });
});
