/**
 * 개발 빌드 「골드 무제한」 (91, 예전 「강화석 무제한」 devStones, Lim 2026-10-14 강화 테스트): 골드는 따지지도 쓰지도 않음.
 * 실제 잔액은 그대로 두고 (Infinity를 저장하지 않음) 보이는 잔액만 ∞. 끄면 실제 잔액으로 돌아옴
 */
import { resourceBalance } from '../src/game/resources';
import { beforeEach, describe, expect, it } from 'vitest';
import { MERCHANT } from '../src/data/economy';
import { buyUnknown, merchantGold } from '../src/game/merchant';
import { G } from '../src/game/state';
import { migrate, newSave } from '../src/platform/storage';

// 골드를 쓰는 곳으로 행상인 (106)을 씀 (예전엔 장비 재설정, 2026-10-21 Lim 「아이템의 능력치 재설정 기능제거」)
describe('골드 무제한 (개발 빌드)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = 3; G.save.player.level = 60; G.save.player.gold = 0;
  });
  it('꺼져 있으면 골드가 모자라 못 삼', () => {
    expect(buyUnknown(G.save, 'neck', () => 0)).toBe('골드 부족');
    expect(G.save.gear.bag).toEqual([]);
  });
  it('켜면 골드 0이어도 사고 줄지 않음, 저장에 Infinity를 넣지 않음, 레벨 제한은 유지', () => {
    G.save.settings.devGold = true;
    expect(typeof buyUnknown(G.save, 'neck', () => 0)).toBe('object');
    expect(typeof buyUnknown(G.save, 'ring', () => 0)).toBe('object');
    expect([G.save.player.gold, G.save.gear.bag.length]).toEqual([0, 2]);
    const restored = migrate(JSON.parse(JSON.stringify(G.save)));
    expect(restored.settings.devGold).toBe(true);
    expect(restored.player.gold).toBe(0);
    expect(resourceBalance(restored, 'gold')).toBe(Infinity);
    G.save.player.level = MERCHANT.lv - 1;
    expect(buyUnknown(G.save, 'neck')).toBe(`Lv ${MERCHANT.lv}에 열림`);
  });
  it('켜는 동안 실제 잔액을 유지하며 해제하면 정상 값으로 돌아옴', () => {
    G.save.player.gold = 50000;
    G.save.settings.devGold = true;
    buyUnknown(G.save, 'neck', () => 0);
    expect(G.save.player.gold).toBe(50000);
    G.save.settings.devGold = false;
    expect(resourceBalance(G.save, 'gold')).toBe(50000);
    expect(typeof buyUnknown(G.save, 'neck', () => 0)).toBe('object');
    expect(G.save.player.gold).toBe(50000 - merchantGold(60));
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
