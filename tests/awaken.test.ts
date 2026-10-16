/**
 * 옛 강화 · 각성 기록 정리 (v13 각성 제거 → v17 강화 제거, 91 디아2식): 각성 추가값 (up · top)과 강화 단계 (plus)를 지우고,
 * 무작위 옵션 굴림은 새 기준 (최대값 × 0.8 대비)으로 바꿔 값 그대로. 가방 · 착용 · 보관 직업 장비 모두, 몇 번 불러도 같음.
 */
import { describe, expect, it } from 'vitest';
import { itemStats, lineValue, pctLvMult, RANDOM_BASE, type GearItem } from '../src/data/equipment';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';

/** v16 장비 (굴림 = 최대값 대비 0.6~1, 강화 단계 plus) */
const head = (plus = 0) => ({
  id: 5, slot: 'head', kind: 'hood', grade: '영웅', plus, name: '', lv: 30,
  lines: [{ stat: 'crit', roll: 0.8 }, { stat: 'haste', roll: 0.6 }], specs: [],
}) as unknown as GearItem;

describe('옛 각성 · 강화 기록 정리', () => {
  it('각성 기록 · 강화 단계를 지우고 무작위 옵션 값은 그대로 (굴림 r → r ÷ 0.8, 강화 몫은 아이템 레벨 배율이 맡음)', () => {
    const s = newSave(1), gear = { ...head(6), top: 9, lines: head().lines.map(l => ({ ...l, up: 0.02 })) };
    s.v = 12;
    s.gear.equipped.head = gear;
    s.gear.bag = [{ ...gear, id: 6 }];
    s.heroes.druid = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0,
      gear: { equipped: { head: { ...gear, id: 7 } }, bag: [{ ...gear, id: 8 }], seen: 8 } };
    const out = migrate(s);
    expect(out.v).toBe(SAVE_VERSION);
    const all = [out.gear.equipped.head!, out.gear.bag[0], out.heroes.druid!.gear!.equipped.head!, out.heroes.druid!.gear!.bag[0]];
    for (const item of all) {
      expect(item).not.toHaveProperty('plus');
      expect(item).not.toHaveProperty('top');
      expect(item.lines).toEqual([{ stat: 'crit', roll: 1 }, { stat: 'haste', roll: 0.75 }]);
      expect(item.fixedRolls).toBeUndefined(); // 주 · 종류 옵션 굴림 없음 = 1 (예전 고정값)
      // 무작위 옵션 값은 예전 +0 값 그대로 (최대값 × 예전 굴림), 그 위에 아이템 레벨 배율
      const cur = itemStats(item, 30), lv30 = (1 + 0.08 * 3.65) * pctLvMult(30);
      expect(cur.crit).toBeCloseTo(0.04 * 1.3 * 1.25 * 0.8 * lv30);
      expect(cur.haste).toBeCloseTo(0.05 * 1.3 * 1.25 * 0.6 * lv30);
    }
    expect(migrate(out)).toEqual(out); // 두 번 불러도 굴림을 또 나누지 않음
    expect(gear.top).toBe(9); // 원본 입력은 건드리지 않는다.
    expect(gear.lines[0].up).toBe(0.02);
    expect(lineValue(out.gear.equipped.head!, out.gear.equipped.head!.lines[0], 30)).toBeCloseTo(RANDOM_BASE * 0.04 * 1.3 * 1.25 * 1 * (1 + 0.08 * 3.65) * pctLvMult(30)); // 옛 각성 up은 값에 안 들어감
  });
});
