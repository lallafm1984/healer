/**
 * 떠돌이 상인 · 미확인 장비 (106, 2026-10-20 Lim 「디아블로2 갬블 요소처럼 … 골드소비처」): 값 · 등급 확률 · 사기 (부위 · 종류 · 레벨 · 골드 · 잠금)
 */
import { describe, expect, it } from 'vitest';
import { MERCHANT } from '../src/data/economy';
import { runGold } from '../src/game/economy';
import { HERO_FROM, ITEM_GRADES, kindsOf, SLOTS } from '../src/data/equipment';
import { rngFrom } from '../src/engine/rng';
import { buyUnknown, merchantGold, merchantOdds, merchantOffer } from '../src/game/merchant';
import { TUT } from '../src/game/tutorial';
import { newSave, type SaveData } from '../src/platform/storage';

const at = (lv: number, gold = 1e6): SaveData => {
  const s = newSave(1);
  s.tut = TUT.done; s.player.level = lv; s.player.gold = gold;
  return s;
};
const grade = (o: number[], g: string) => o[ITEM_GRADES.indexOf(g as never)];

describe('값: 그 레벨 가장 큰 콘텐츠 한 판 골드에 비례, Lv 100에 2만 (Lim 「레이드 획득 골드의 20배 정도」)', () => {
  it('Lv 10 1,300 · 30 3,030 · 45 6,490 · 60 8,450 · 70 14,290 · 100 20,000', () => {
    expect([10, 30, 45, 60, 70, 100].map(merchantGold)).toEqual([1300, 3030, 6490, 8450, 14290, 20000]);
    expect(MERCHANT.lv).toBe(10);
  });
  it('어느 레벨이든 한 판 골드의 같은 배수 (10골드 반올림 안), 레벨이 오르면 줄지 않음', () => {
    for (let lv = 1; lv <= 100; lv++) {
      expect(Math.abs(merchantGold(lv) - (runGold(lv) * MERCHANT.top) / runGold(100))).toBeLessThanOrEqual(5);
      if (lv > 1) expect(merchantGold(lv)).toBeGreaterThanOrEqual(merchantGold(lv - 1));
    }
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
  it('고른 부위, 장비 레벨 = 내 레벨, 골드를 값만큼 쓰고 가방에', () => {
    const s = at(60, 20000), r = rngFrom(7);
    const it = buyUnknown(s, 'neck', r);
    if (typeof it === 'string') throw new Error(it);
    expect(it.slot).toBe('neck'); expect(it.lv).toBe(60);
    expect(s.player.gold).toBe(20000 - merchantGold(60));
    expect(s.gear.bag.some(b => b.id === it.id)).toBe(true);
  });
  it('종류는 그 부위 다섯 가지 중 고르게 (Lim 「부위만 고르게」)', () => {
    const s = at(60, 1e8), r = rngFrom(3), n = 2500, count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const it = buyUnknown(s, 'weapon', r);
      if (typeof it === 'string') throw new Error(it);
      count[it.kind] = (count[it.kind] ?? 0) + 1;
    }
    expect(Object.keys(count).sort()).toEqual(kindsOf('weapon').map(k => k.key).sort());
    for (const k of kindsOf('weapon')) { expect(count[k.key] / n).toBeGreaterThan(0.16); expect(count[k.key] / n).toBeLessThan(0.24); }
  });
  it('여러 번 사면 등급 비율이 확률표와 맞음 (Lv 100 영웅 8% 안팎, 전설 없음)', () => {
    const s = at(100, 1e8), r = rngFrom(11), n = 4000, count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const it = buyUnknown(s, SLOTS[i % SLOTS.length].key, r);
      if (typeof it === 'string') throw new Error(it);
      count[it.grade] = (count[it.grade] ?? 0) + 1;
    }
    expect((count['영웅'] ?? 0) / n).toBeGreaterThan(0.06); expect((count['영웅'] ?? 0) / n).toBeLessThan(0.1);
    expect(count['전설'] ?? 0).toBe(0);
  });
  it('골드가 모자라면 안 사짐 (골드 그대로), 개발 골드 무제한이면 잔액을 안 씀', () => {
    const s = at(50, merchantGold(50) - 1);
    expect(buyUnknown(s, 'weapon', rngFrom(1))).toBe('골드 부족');
    expect(s.player.gold).toBe(merchantGold(50) - 1);
    s.settings.devGold = true;
    expect(typeof buyUnknown(s, 'weapon', rngFrom(1))).toBe('object');
    expect(s.player.gold).toBe(merchantGold(50) - 1);
  });
  it('Lv 10 전 · 튜토리얼 중엔 잠김, 없는 부위는 안 됨', () => {
    expect(merchantOffer(at(9)).lock).toBe('Lv 10에 열림');
    const t = at(30); t.tut = TUT.explore;
    expect(merchantOffer(t).open).toBe(false);
    expect(buyUnknown(at(30), 'tail' as never, rngFrom(1))).toBe('없는 부위');
    expect(merchantOffer(at(10)).ok).toBe(true);
  });
});
