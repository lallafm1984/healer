/** 재설정 (34 6-8 · 42 1-6): Lv 50부터 한 줄 다시 굴림, 특수능력은 같은 묶음 안에서 3배 비용, Lv 60부터 후보 2개 */
import { beforeEach, describe, expect, it } from 'vitest';
import { kindOf, REROLL_GOLD, rerollCost, rerollLine, rerollSpec, SPEC_REROLL_MULT, type GearItem } from '../src/data/equipment';
import { SPECS } from '../src/data/specials';
import { rngFrom } from '../src/engine/rng';
import { G, pickReroll, reroll } from '../src/game/state';
import { newSave } from '../src/platform/storage';

const ring = (o: Partial<GearItem> = {}): GearItem => ({
  id: 7, slot: 'ring', kind: 'ring', grade: '영웅', plus: 0, name: '', rr: 0,
  lines: [{ stat: 'crit', roll: 0.7, up: 0.01 }, { stat: 'haste', roll: 0.8 }, { stat: 'spirit', roll: 0.9 }],
  specs: [{ key: 'wishStar', roll: 0.7 }], ...o,
});
const setup = (level: number) => {
  G.save = newSave(1);
  G.save.player.level = level;
  G.save.player.gold = 100000;
  G.save.mats.refined = 50;
  G.save.gear.bag = [ring()];
};

describe('비용', () => {
  it('옵션 한 줄 = 등급 기본 골드 + 정제 강화석 1, 할 때마다 기본값만큼 비싸짐, 특수능력은 3배', () => {
    expect(rerollCost(ring(), false)).toEqual({ gold: REROLL_GOLD['영웅'], refined: 1 });
    expect(rerollCost(ring({ rr: 2 }), false)).toEqual({ gold: REROLL_GOLD['영웅'] * 3, refined: 1 });
    expect(rerollCost(ring(), true)).toEqual({ gold: REROLL_GOLD['영웅'] * SPEC_REROLL_MULT, refined: SPEC_REROLL_MULT });
  });
});

describe('굴림', () => {
  it('옵션 줄: 고정 옵션 · 다른 줄 능력치는 안 나오고, 각성 값은 사라짐', () => {
    const it0 = ring(), r = rngFrom(5), fx = kindOf(it0).fixed;
    for (let n = 0; n < 300; n++) {
      const l = rerollLine(r, it0, 0);
      expect([fx, 'haste', 'spirit']).not.toContain(l.stat);
      expect(l.up).toBeUndefined();
      expect(l.roll).toBeGreaterThanOrEqual(0.6);
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
  it('Lv 50 아래는 못 함', () => {
    setup(49);
    expect(reroll(7, 'line', 0, rngFrom(1)).err).toMatch(/Lv 50/);
    expect(G.save.gear.bag[0].rr).toBe(0);
  });
  it('그 줄만 바뀌고 비용을 냄, 횟수가 늘어 다음엔 더 비쌈 (Lv 50 = 후보 1개)', () => {
    const before = structuredClone(G.save.gear.bag[0]);
    const res = reroll(7, 'line', 1, rngFrom(3));
    const it = G.save.gear.bag[0];
    expect(res).toEqual({ err: '', alt: undefined });
    expect(it.lines[0]).toEqual(before.lines[0]);
    expect(it.lines[2]).toEqual(before.lines[2]);
    expect(it.specs).toEqual(before.specs);
    expect(it.rr).toBe(1);
    expect(G.save.player.gold).toBe(100000 - REROLL_GOLD['영웅']);
    expect(G.save.mats.refined).toBe(49);
    reroll(7, 'spec', 0, rngFrom(4));
    expect(G.save.player.gold).toBe(100000 - REROLL_GOLD['영웅'] - REROLL_GOLD['영웅'] * 2 * SPEC_REROLL_MULT);
    expect(G.save.mats.refined).toBe(49 - SPEC_REROLL_MULT);
    expect(G.save.gear.codex).toContain(G.save.gear.bag[0].specs![0].key);
  });
  it('재료가 모자라면 아무것도 안 바뀜', () => {
    G.save.mats.refined = 2;
    const before = structuredClone(G.save.gear.bag[0]);
    expect(reroll(7, 'spec', 0, rngFrom(1)).err).toMatch(/정제 강화석 부족/);
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
