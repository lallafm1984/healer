/** QA 후속 (2026-10-16 Lim): 직업에 효과 없는 공통 특수능력은 그 직업 드롭 · 재설정에서 빠짐 · % 옵션 아이템 레벨 배율 (91: 강화 대신 아이템 레벨 배율이 모든 옵션에) */
import { describe, expect, it } from 'vitest';
import { ilvBonus, makeItem, optionsOf, pctLvMult, rerollSpec, rollSpecs, type GearItem } from '../src/data/equipment';
import { HERO_KEYS } from '../src/data/heroes';
import { NO_EFFECT, SPECS, specUseful } from '../src/data/specials';
import { rngFrom } from '../src/engine/rng';

describe('직업에 효과 없는 공통 특수능력 (NO_EFFECT)', () => {
  it('모두 공통 특수능력이고 그 직업만 빠짐', () => {
    for (const [k, hs] of Object.entries(NO_EFFECT)) {
      expect(SPECS[k], k).toBeTruthy();
      expect(SPECS[k].hero, k).toBeUndefined();
      for (const h of HERO_KEYS) expect(specUseful(k, h)).toBe(!hs.includes(h));
      expect(specUseful(k)).toBe(true);
    }
  });
  it('그 직업으로 돌 때 드롭 · 재설정에 안 나옴, 다른 직업은 그대로 나옴', () => {
    const r = rngFrom(11);
    const seen: Record<string, Set<string>> = { warder: new Set(), priest: new Set() };
    for (const hero of ['warder', 'priest'] as const) for (let i = 0; i < 4000; i++) {
      for (const slot of ['head', 'chest', 'hands', 'ring', 'neck', 'weapon'] as const) for (const l of rollSpecs(r, slot, '영웅', 1, { hero })) seen[hero].add(l.key);
    }
    for (const k of Object.keys(NO_EFFECT).filter(k => NO_EFFECT[k].includes('warder'))) {
      expect(seen.warder.has(k), k).toBe(false);
      expect(seen.priest.has(k), k).toBe(true);
    }
    const it: GearItem = { id: 1, slot: 'chest', kind: 'robe', grade: '희귀', name: '', lines: [], specs: [{ key: 'sturdyBack', roll: 1 }] };
    for (let i = 0; i < 300; i++) expect(NO_EFFECT[rerollSpec(r, it, 0, 'warder').key]?.includes('warder') ?? false).toBe(false);
  });
});

describe('장비 옵션 (2026-10-16 Lim 「모든 수치가 레벨에 맞게」, 91: 예전 강화 몫은 아이템 레벨 배율)', () => {
  const staff = (lv: number): GearItem => ({ id: 1, slot: 'weapon', kind: 'staff', grade: '영웅', name: '', lv, lines: [{ stat: 'crit', roll: 1 }, { stat: 'int', roll: 1 }], specs: [] });
  it('% 옵션은 아이템 레벨 75~125%, 내 레벨이 바뀌어도 그 장비 %는 그대로', () => {
    expect(pctLvMult(1)).toBeCloseTo(0.75);
    expect(pctLvMult(100)).toBeCloseTo(1.25);
    expect(pctLvMult(undefined)).toBe(1);
    const lo = optionsOf(staff(10), 10), hi = optionsOf(staff(90), 90);
    const pct = (o: typeof lo, s: string) => o.find(x => x.stat === s)!.v;
    expect(pct(hi, 'haste') / pct(lo, 'haste')).toBeCloseTo((pctLvMult(90) * ilvBonus(90)) / (pctLvMult(10) * ilvBonus(10)));
    expect(pct(optionsOf(staff(10), 60), 'crit')).toBeCloseTo(pct(lo, 'crit'));
  });
  it('아이템 레벨 배율은 주 · 종류 · 무작위 옵션 모두 같은 비율 (예전 강화 +8%/단계 자리)', () => {
    const a = optionsOf(staff(40), 40), b = optionsOf({ ...staff(40), lv: undefined }, 40);
    for (let i = 0; i < a.length; i++) expect(a[i].v / b[i].v).toBeCloseTo(ilvBonus(40) * (a[i].stat === 'int' || a[i].stat === 'hp' ? 1 : pctLvMult(40)));
  });
  it('특수능력 값은 아이템 레벨 배율을 안 받음', () => {
    const lo = makeItem(rngFrom(3), 'neck', '영웅', 1, undefined, { hero: 'priest', lv: 50 });
    const hi = makeItem(rngFrom(3), 'neck', '영웅', 1, undefined, { hero: 'priest', lv: 100 });
    expect(hi.specs).toEqual(lo.specs);
  });
});
