/** 재설정 (34 6-8 · 42 1-6): Lv 20부터 (91, 예전 50) 한 줄 다시 굴림 (옵션은 같은 50~160% 굴림), 비용 골드, 특수능력은 같은 묶음 안에서 3배 비용, Lv 60부터 후보 2개 */
import { beforeEach, describe, expect, it } from 'vitest';
import { kindOf, REROLL_GOLD, REROLL_LEVEL, rerollCost, rerollLine, rerollSpec, SPEC_REROLL_MULT, type GearItem } from '../src/data/equipment';
import { SPECS } from '../src/data/specials';
import { rngFrom } from '../src/engine/rng';
import { G, pickReroll, reroll } from '../src/game/state';
import { newSave } from '../src/platform/storage';

const ring = (o: Partial<GearItem> = {}): GearItem => ({
  id: 7, slot: 'ring', kind: 'ring', grade: '영웅', name: '', rr: 0, lv: 50,
  lines: [{ stat: 'crit', roll: 0.7 }, { stat: 'haste', roll: 0.8 }, { stat: 'spirit', roll: 0.9 }],
  specs: [{ key: 'wishStar', roll: 0.7 }], ...o,
});
const setup = (level: number) => {
  G.save = newSave(1);
  G.save.player.level = level;
  G.save.player.gold = 50000;
  G.save.gear.bag = [ring()];
};

describe('비용', () => {
  it('골드 = 등급 값 (75 · 125 · 250 · 500 · 1000) × (1 + 아이템 레벨 ÷ 10) × (1 + 이 장비에서 한 횟수), 특수능력은 3배 (91, #172 전 값)', () => {
    expect(REROLL_GOLD).toEqual({ '일반': 75, '고급': 125, '희귀': 250, '영웅': 500, '전설': 1000 });
    expect(rerollCost(ring(), false)).toEqual({ gold: 3000 });
    expect(rerollCost(ring({ rr: 2 }), false)).toEqual({ gold: 9000 });
    expect(rerollCost(ring(), true)).toEqual({ gold: 3000 * SPEC_REROLL_MULT });
    expect(rerollCost(ring({ rr: 1, lv: 20, grade: '희귀' }), true)).toEqual({ gold: 250 * 3 * 2 * SPEC_REROLL_MULT });
    expect(REROLL_LEVEL).toBe(20);
  });
});

describe('굴림', () => {
  it('옵션 줄: 고정 옵션 · 다른 줄 능력치는 안 나옴', () => {
    const it0 = ring(), r = rngFrom(5), fx = kindOf(it0).fixed;
    for (let n = 0; n < 300; n++) {
      const l = rerollLine(r, it0, 0);
      expect([fx, 'haste', 'spirit']).not.toContain(l.stat);
      expect(l).not.toHaveProperty('up');
      expect(l.roll).toBeGreaterThanOrEqual(0.5);
      expect(l.roll).toBeLessThanOrEqual(1.6);
    }
  });
  it('특수능력 줄: 같은 묶음 · 그 부위 · 등급 안에서, 직업 전용은 같은 직업, 다른 줄과 안 겹침', () => {
    const r = rngFrom(8);
    const it0 = ring({ grade: '전설', specs: [{ key: 'wishStar', roll: 0.7 }, { key: 'warmTouch', roll: 1 }] });
    const seen = new Set<string>();
    for (let n = 0; n < 400; n++) {
      const l = rerollSpec(r, it0, 0), d = SPECS[l.key];
      expect(d.group).toBe('proc');
      expect(d.slots).toContain('ring');
      expect(d.hero).toBeUndefined();
      seen.add(l.key);
    }
    expect(seen.size).toBeGreaterThan(3);
    const hero = ring({ grade: '전설', specs: [{ key: 'pohEcho', roll: 1 }] });
    for (let n = 0; n < 200; n++) expect(SPECS[rerollSpec(r, hero, 0).key].hero).toBe('priest');
  });
});

describe('재설정 하기', () => {
  beforeEach(() => setup(50));
  it('Lv 20 아래는 못 함', () => {
    setup(19);
    expect(reroll(7, 'line', 0, rngFrom(1)).err).toMatch(/Lv 20/);
    expect(G.save.gear.bag[0].rr).toBe(0);
  });
  it('그 줄만 바뀌고 비용을 냄, 횟수가 늘어 다음엔 더 비쌈 (Lv 60 전 = 후보 1개)', () => {
    const before = structuredClone(G.save.gear.bag[0]);
    const res = reroll(7, 'line', 1, rngFrom(3));
    const it = G.save.gear.bag[0];
    expect(res).toEqual({ err: '', alt: undefined });
    expect(it.lines[0]).toEqual(before.lines[0]);
    expect(it.lines[2]).toEqual(before.lines[2]);
    expect(it.specs).toEqual(before.specs);
    expect(it.rr).toBe(1);
    expect(G.save.player.gold).toBe(50000 - 3000);
    reroll(7, 'spec', 0, rngFrom(4));
    expect(G.save.player.gold).toBe(50000 - 3000 - 3000 * SPEC_REROLL_MULT * 2);
    expect(G.save.gear.codex).toContain(G.save.gear.bag[0].specs![0].key);
  });
  it('골드가 모자라면 아무것도 안 바뀜', () => {
    G.save.player.gold = 8999;
    const before = structuredClone(G.save.gear.bag[0]);
    expect(reroll(7, 'spec', 0, rngFrom(1)).err).toMatch(/골드 부족 \(9,000 필요\)/);
    expect(G.save.gear.bag[0]).toEqual(before);
  });
  it('Lv 60부터 후보 2개: 첫 후보가 들어가고, 둘째로 바꿀 수 있음', () => {
    setup(60);
    const res = reroll(7, 'spec', 0, rngFrom(9));
    expect(res.alt).toBeDefined();
    const alt = res.alt as { key: string; roll: number };
    expect(pickReroll(7, 'spec', 0, alt)).toBe(true);
    expect(G.save.gear.bag[0].specs![0]).toEqual(alt);
    expect(G.save.gear.codex).toContain(alt.key);
  });
});
