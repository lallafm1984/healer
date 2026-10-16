/**
 * 개발 빌드 「골드 무제한」 (91, 예전 「강화석 무제한」 devStones, Lim 2026-10-14 강화 테스트): 골드는 따지지도 쓰지도 않음.
 * 실제 잔액은 그대로 두고 (Infinity를 저장하지 않음) 보이는 잔액만 ∞. 끄면 실제 잔액으로 돌아옴
 */
import { resourceBalance } from '../src/game/resources';
import { beforeEach, describe, expect, it } from 'vitest';
import { rerollCost, type GearItem } from '../src/data/equipment';
import { G, reroll } from '../src/game/state';
import { migrate, newSave } from '../src/platform/storage';

const neck = (): GearItem => ({ id: 7, slot: 'neck', kind: 'medal', grade: '희귀', name: '', lv: 40, lines: [{ stat: 'haste', roll: 0.8 }], specs: [{ key: 'warmTouch', roll: 0.8 }] });

describe('골드 무제한 (개발 빌드)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = 3; G.save.player.level = 60; G.save.player.gold = 0;
    G.save.gear.bag = [neck()];
  });
  it('꺼져 있으면 골드가 모자라 재설정을 못 함', () => {
    expect(reroll(7, 'line', 0, () => 0).err).toMatch(/^골드 부족/);
    expect(G.save.gear.bag[0].rr).toBeUndefined();
  });
  it('켜면 골드 0이어도 재설정하고 줄지 않음, 저장에 Infinity를 넣지 않음, 재설정 레벨 제한은 유지', () => {
    G.save.settings.devGold = true;
    expect(reroll(7, 'line', 0, () => 0).err).toBe('');
    expect(reroll(7, 'spec', 0, () => 0).err).toBe('');
    expect(G.save.player.gold).toBe(0);
    const restored = migrate(JSON.parse(JSON.stringify(G.save)));
    expect(restored.settings.devGold).toBe(true);
    expect(restored.player.gold).toBe(0);
    expect(resourceBalance(restored, 'gold')).toBe(Infinity);
    G.save.player.level = 19;
    expect(reroll(7, 'line', 0).err).toMatch(/Lv 20/);
  });
  it('켜는 동안 실제 잔액을 유지하며 해제하면 정상 비용으로 돌아옴', () => {
    G.save.player.gold = 5000;
    G.save.settings.devGold = true;
    reroll(7, 'line', 0, () => 0);
    expect(G.save.player.gold).toBe(5000);
    G.save.settings.devGold = false;
    expect(resourceBalance(G.save, 'gold')).toBe(5000);
    const c = rerollCost(G.save.gear.bag[0], false).gold;
    expect(reroll(7, 'line', 0, () => 0).err).toBe('');
    expect(G.save.player.gold).toBe(5000 - c);
    expect(resourceBalance(newSave(1), 'gold')).toBe(0);
  });
  it('옛 저장 (v16)의 강화석 무제한 = 골드 무제한, 강화 연출 설정은 버림', () => {
    const old = JSON.parse(JSON.stringify(newSave(1)));
    old.v = 16; delete old.player.gold; old.settings.devStones = true; old.settings.quickEnhance = true;
    const s = migrate(old);
    expect(s.settings.devGold).toBe(true);
    expect(s.settings).not.toHaveProperty('devStones');
    expect(s.settings).not.toHaveProperty('quickEnhance');
  });
});
