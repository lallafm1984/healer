/** 개발 빌드 「강화석 무제한」 (Lim 2026-10-14 강화 테스트): 강화석 · 정제 강화석은 따지지도 쓰지도 않음. v16 (2026-10-16): 골드와 「골드 무제한」은 없앰 */
import { resourceBalance } from '../src/game/resources';
import { beforeEach, describe, expect, it } from 'vitest';
import { enhanceCost, type GearItem } from '../src/data/equipment';
import { enhanceLack, enhanceTry, G, reroll } from '../src/game/state';
import { migrate, newSave } from '../src/platform/storage';

const neck = (plus: number): GearItem => ({ id: 7, slot: 'neck', kind: 'medal', grade: '희귀', plus, name: '', lines: [], specs: [] });

describe('강화석 무제한', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.mats.stone = 0; G.save.mats.refined = 0;
  });
  it('꺼져 있으면 지금처럼 강화석이 모자라 못 함', () => {
    G.save.gear.equipped.neck = neck(1);
    expect(enhanceLack(neck(1))).toMatch(/^강화석 부족/);
    expect(enhanceTry(7, () => 0)).toMatch(/^강화석 부족/);
  });
  it('켜면 강화석 · 정제 강화석이 0이어도 강화하고 줄지 않음', () => {
    G.save.settings.devStones = true;
    G.save.gear.equipped.neck = neck(1);
    expect(enhanceLack(neck(1))).toBe('');
    expect(enhanceTry(7, () => 0)).toMatchObject({ ok: true, from: 1, to: 2 });
    expect(G.save.mats.stone).toBe(0);
    // +6부터 드는 정제 강화석도 쓰지 않음
    G.save.gear.equipped.neck = neck(6);
    expect(enhanceCost(neck(6))!.refined).toBe(3);
    expect(enhanceTry(7, () => 0)).toMatchObject({ ok: true, to: 7 });
    expect(G.save.mats.refined).toBe(0);
  });
});

// 무한 재화는 실제 수량을 덮어쓰지 않으며 다른 소비 경로에도 같은 규칙을 쓴다.
describe('강화석 무제한 공통 처리', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = 3; G.save.player.level = 60;
    G.save.settings.devStones = true;
    G.save.gear.bag = [{ ...neck(2), lines: [{ stat: 'haste', roll: 0.8 }], specs: [{ key: 'warmTouch', roll: 0.8 }] }];
  });
  it('잔액 0으로 성공·실패 모두 시도하고 저장에 Infinity를 넣지 않음', () => {
    expect(enhanceTry(7, () => 0)).toMatchObject({ ok: true, to: 3 });
    expect(enhanceTry(7, () => 0.99)).toMatchObject({ ok: false, to: 3 });
    expect(G.save.mats).toEqual({ stone: 0, refined: 0 });
    const restored = migrate(JSON.parse(JSON.stringify(G.save)));
    expect(restored.settings.devStones).toBe(true);
    expect(restored.mats).toEqual({ stone: 0, refined: 0 });
    expect(resourceBalance(restored, 'stone')).toBe(Infinity);
  });
  it('켜는 동안 실제 잔액을 유지하며 해제하면 정상 비용으로 돌아옴', () => {
    G.save.mats.stone = 10;
    enhanceTry(7, () => 0);
    expect(G.save.mats.stone).toBe(10);
    G.save.settings.devStones = false;
    expect(resourceBalance(G.save, 'stone')).toBe(10);
    G.save.gear.bag[0].plus = 0;
    expect(enhanceTry(7, () => 0)).toMatchObject({ ok: true, to: 1 });
    expect(G.save.mats.stone).toBe(9);
  });
  it('재설정에도 적용되며 재설정 레벨 제한은 유지', () => {
    expect(reroll(7, 'line', 0, () => 0).err).toBe('');
    expect(reroll(7, 'spec', 0, () => 0).err).toBe('');
    expect(G.save.mats.refined).toBe(0);
    G.save.player.level = 49;
    expect(reroll(7, 'line', 0).err).toMatch(/Lv 50/);
  });
  it('강화 상한은 유지 · 꺼진 기본 설정은 유한 잔액', () => {
    G.save.gear.bag[0].plus = 10;
    expect(enhanceTry(7)).toBe('이미 +10');
    const fresh = newSave(1);
    expect(resourceBalance(fresh, 'stone')).toBe(0);
    expect(resourceBalance(fresh, 'refined')).toBe(0);
  });
  it('옛 저장의 골드 · 골드 무제한 옵션은 불러올 때 버림 (v16)', () => {
    const old = JSON.parse(JSON.stringify(newSave(1)));
    old.v = 15; old.player.gold = 12345; old.settings.devGold = true;
    const s = migrate(old);
    expect(s.player).toEqual({ level: 1, xp: 0 });
    expect(s.settings).not.toHaveProperty('devGold');
  });
});
