/**
 * 떠돌이 상인 · 미확인 장비 (106, 2026-10-20 Lim 「디아블로2 갬블 요소처럼 … 골드소비처」): 값 · 등급 확률 · 사기 (부위 · 종류 · 레벨 · 골드 · 잠금)
 */
import { describe, expect, it } from 'vitest';
import { MERCHANT, merchantGold } from '../src/data/economy';
import { HERO_FROM, ITEM_GRADES, kindsOf, SLOTS } from '../src/data/equipment';
import { rngFrom } from '../src/engine/rng';
import { buyUnknown, merchantOdds, merchantOffer } from '../src/game/merchant';
import { TUT } from '../src/game/tutorial';
import { newSave, type SaveData } from '../src/platform/storage';

const at = (lv: number, gold = 1e6): SaveData => {
  const s = newSave(1);
  s.tut = TUT.done; s.player.level = lv; s.player.gold = gold;
  return s;
};
const grade = (o: number[], g: string) => o[ITEM_GRADES.indexOf(g as never)];

describe('값: 100 × 내 Lv (Lim 「100레벨 기준 만골드」)', () => {
  it('Lv 10 1,000 · 45 4,500 · 70 7,000 · 100 10,000', () => {
    expect([10, 45, 70, 100].map(merchantGold)).toEqual([1000, 4500, 7000, 10000]);
    expect(MERCHANT.lv).toBe(10);
  });
});

describe('등급 확률: 그 레벨 어려움 바탕 표 + 영웅 (Lv 45부터, 100에 8%), 전설 없음', () => {
  it('합 1, 전설 0, 일반 0 (최소 고급)', () => {
    for (let lv = 1; lv <= 100; lv++) {
      const o = merchantOdds(lv);
      expect(o.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      expect(grade(o, '전설')).toBe(0);
      expect(grade(o, '일반')).toBe(0);
    }
  });
  it('영웅은 Lv 45 전 0, 그 뒤 레벨마다 오르고 Lv 100에 8%', () => {
    expect(grade(merchantOdds(HERO_FROM - 1), '영웅')).toBe(0);
    expect(grade(merchantOdds(HERO_FROM), '영웅')).toBeGreaterThan(0);
    expect(grade(merchantOdds(100), '영웅')).toBeCloseTo(MERCHANT.hero, 9);
    for (let lv = HERO_FROM; lv < 100; lv++) expect(grade(merchantOdds(lv + 1), '영웅')).toBeGreaterThan(grade(merchantOdds(lv), '영웅'));
  });
  it('레벨대: Lv 10~20 고급 80 · 희귀 20, 21~44 고급 60 · 희귀 40, 45부터 희귀 + 영웅', () => {
    expect(merchantOdds(15).slice(0, 3)).toEqual([0, 0.8, 0.2]);
    expect(merchantOdds(30).slice(0, 3)).toEqual([0, 0.6, 0.4]);
    expect(grade(merchantOdds(60), '고급')).toBe(0);
  });
});

describe('사기', () => {
  it('고른 부위 · 종류, 장비 레벨 = 내 레벨, 골드를 값만큼 쓰고 가방에', () => {
    const s = at(60, 20000), r = rngFrom(7);
    const it = buyUnknown(s, 'neck', 'pendant', r);
    if (typeof it === 'string') throw new Error(it);
    expect(it.slot).toBe('neck'); expect(it.kind).toBe('pendant'); expect(it.lv).toBe(60);
    expect(s.player.gold).toBe(20000 - merchantGold(60));
    expect(s.gear.bag.some(b => b.id === it.id)).toBe(true);
  });
  it('여러 번 사면 등급 비율이 확률표와 맞음 (Lv 100 영웅 8% 안팎, 전설 없음)', () => {
    const s = at(100, 1e8), r = rngFrom(11), n = 4000, count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const sl = SLOTS[i % SLOTS.length].key, k = kindsOf(sl)[i % 5].key;
      const it = buyUnknown(s, sl, k, r);
      if (typeof it === 'string') throw new Error(it);
      count[it.grade] = (count[it.grade] ?? 0) + 1;
    }
    expect((count['영웅'] ?? 0) / n).toBeGreaterThan(0.06); expect((count['영웅'] ?? 0) / n).toBeLessThan(0.1);
    expect(count['전설'] ?? 0).toBe(0);
  });
  it('골드가 모자라면 안 사짐 (골드 그대로), 개발 골드 무제한이면 잔액을 안 씀', () => {
    const s = at(50, merchantGold(50) - 1);
    expect(buyUnknown(s, 'weapon', 'staff', rngFrom(1))).toBe('골드 부족');
    expect(s.player.gold).toBe(merchantGold(50) - 1);
    s.settings.devGold = true;
    expect(typeof buyUnknown(s, 'weapon', 'staff', rngFrom(1))).toBe('object');
    expect(s.player.gold).toBe(merchantGold(50) - 1);
  });
  it('Lv 10 전 · 튜토리얼 중엔 잠김, 없는 종류는 안 됨', () => {
    expect(merchantOffer(at(9)).lock).toBe('Lv 10에 열림');
    const t = at(30); t.tut = TUT.explore;
    expect(merchantOffer(t).open).toBe(false);
    expect(buyUnknown(at(30), 'weapon', 'ring', rngFrom(1))).toBe('없는 장비');
    expect(merchantOffer(at(10)).ok).toBe(true);
  });
});
