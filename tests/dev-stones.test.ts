/** 개발 빌드 「강화석 무제한」 (Lim 2026-10-14 강화 테스트): 강화석 · 정제 강화석은 따지지도 쓰지도 않고 골드는 씀 */
import { beforeEach, describe, expect, it } from 'vitest';
import { enhanceCost, type GearItem } from '../src/data/equipment';
import { enhanceLack, enhanceTry, G } from '../src/game/state';
import { newSave } from '../src/platform/storage';

const neck = (plus: number): GearItem => ({ id: 7, slot: 'neck', kind: 'medal', grade: '희귀', plus, name: '', lines: [], specs: [] });

describe('강화석 무제한', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.player.gold = 100000; G.save.mats.stone = 0; G.save.mats.refined = 0;
  });
  it('꺼져 있으면 지금처럼 강화석이 모자라 못 함', () => {
    G.save.gear.equipped.neck = neck(1);
    expect(enhanceLack(neck(1))).toMatch(/^강화석 부족/);
    expect(enhanceTry(7, () => 0)).toMatch(/^강화석 부족/);
    expect(G.save.player.gold).toBe(100000);
  });
  it('켜면 강화석 · 정제 강화석이 0이어도 강화하고 줄지 않음, 골드는 씀', () => {
    G.save.settings.devStones = true;
    G.save.gear.equipped.neck = neck(1);
    const c1 = enhanceCost(neck(1))!;
    expect(enhanceLack(neck(1))).toBe('');
    expect(enhanceTry(7, () => 0)).toMatchObject({ ok: true, from: 1, to: 2 });
    expect([G.save.mats.stone, G.save.player.gold]).toEqual([0, 100000 - c1.gold]);
    // +6부터 드는 정제 강화석도 쓰지 않음
    G.save.gear.equipped.neck = neck(6);
    const gold = G.save.player.gold, c6 = enhanceCost(neck(6))!;
    expect(c6.refined).toBe(1);
    expect(enhanceTry(7, () => 0)).toMatchObject({ ok: true, to: 7 });
    expect([G.save.mats.refined, G.save.player.gold]).toEqual([0, gold - c6.gold]);
  });
  it('켜도 골드가 모자라면 못 함', () => {
    G.save.settings.devStones = true;
    G.save.player.gold = 0;
    G.save.gear.equipped.neck = neck(1);
    expect(enhanceTry(7, () => 0)).toMatch(/^골드 부족/);
  });
});
