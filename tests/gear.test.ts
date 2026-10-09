/** 장비 강화·분해·드롭 (02 10장, 12 3장) */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearMats, ENHANCE_RATE, enhanceCost, equippedStats, EXTRA_LINES, gearStatsOf, itemName, itemStats, kindsOf, makeItem, rollItem, salvageOf, SLOTS, STAT_KEYS, statsToGear, type GearItem,
} from '../src/data/equipment';
import { gearStats } from '../src/data/gear';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { rngFrom } from '../src/engine/rng';
import { settle, type BattleResult } from '../src/game/settle';
import { enhance, G, salvage } from '../src/game/state';
import { migrate, newSave } from '../src/platform/storage';

const item = (o: Partial<GearItem> = {}): GearItem => ({ id: 1, slot: 'head', kind: '', grade: '희귀', plus: 0, name: '', lines: [], ...o });

describe('강화 (34 6-5: 확률, +2 이상 실패 시 1단계 하락, 12 3-2)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('비용 (시도 한 번): 골드 = 등급 기본값 × 목표 단계², +1~+5 강화석 단계만큼, +6~+10 정제 강화석 1개', () => {
    expect(enhanceCost(item())).toEqual({ gold: 10, stone: 1, refined: 0, to: 1, rate: 1, fail: 0 });
    expect(enhanceCost(item({ plus: 4 }))).toEqual({ gold: 10 * 25, stone: 5, refined: 0, to: 5, rate: 0.7, fail: 3 });
    expect(enhanceCost(item({ plus: 5, grade: '영웅' }))).toEqual({ gold: 20 * 36, stone: 0, refined: 1, to: 6, rate: 0.6, fail: 4 });
    expect(enhanceCost(item({ plus: 9, grade: '전설' }))).toMatchObject({ gold: 40 * 100, refined: 1, rate: 0.35, fail: 8 });
    expect(enhanceCost(item({ plus: 10 }))).toBeNull();
  });
  it('성공 확률은 단계가 오를수록 낮아지고, +1은 늘 성공 · 실패하면 +1까지는 그대로', () => {
    expect(ENHANCE_RATE.slice(1)).toEqual([1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35]);
    for (let i = 2; i < ENHANCE_RATE.length; i++) expect(ENHANCE_RATE[i]).toBeLessThan(ENHANCE_RATE[i - 1]);
    expect(enhanceCost(item({ plus: 0 }))!.fail).toBe(0);
    expect(enhanceCost(item({ plus: 1 }))!.fail).toBe(1);
    expect(enhanceCost(item({ plus: 2 }))!.fail).toBe(1);
  });
  it('모자라면 이유, 성공하면 한 단계 오름 (재료 씀)', () => {
    const it = item({ id: 7 });
    G.save.gear.equipped.head = it;
    expect(enhance(7, () => 0)).toMatch(/골드 부족/);
    G.save.player.gold = 100;
    expect(enhance(7, () => 0)).toMatch(/강화석 부족/);
    G.save.mats.stone = 1;
    expect(enhance(7, () => 0)).toBe('');
    expect([it.plus, G.save.player.gold, G.save.mats.stone]).toEqual([1, 90, 0]);
  });
  it('실패: +2 이상이면 1단계 떨어지고, +1에서는 그대로. 재료는 실패해도 씀, 대성공 없음', () => {
    const it = item({ id: 7, plus: 4 });
    G.save.gear.bag = [it];
    G.save.player.gold = 10000; G.save.mats.stone = 20;
    expect(enhance(7, () => 0.99)).toBe('강화 실패 · +4 → +3');
    expect([it.plus, G.save.player.gold, G.save.mats.stone]).toEqual([3, 10000 - 250, 15]);
    it.plus = 1;
    expect(enhance(7, () => 0.99)).toBe('강화 실패 · +1 그대로');
    expect(it.plus).toBe(1);
    // 성공 확률 바로 아래 굴림은 성공 (90% → 0.899)
    it.plus = 2;
    expect(enhance(7, () => 0.899)).toBe('');
    expect(it.plus).toBe(3);
    expect(enhance(7, () => 0.8)).toBe('강화 실패 · +3 → +2');
  });
});

describe('분해 (12 3-1)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('골드 = 등급값 + 강화 단계당 10%, 영웅·전설은 정제 강화석', () => {
    expect(salvageOf(item({ grade: '일반' }))).toEqual({ gold: 10, stone: 1, refined: 0 });
    expect(salvageOf(item({ grade: '영웅', plus: 5 }))).toEqual({ gold: 300, stone: 6, refined: 1 });
  });
  it('가방 장비만, 여러 개 한 번에', () => {
    G.save.gear.bag = [item({ id: 1, grade: '일반' }), item({ id: 2, grade: '고급' }), item({ id: 3 })];
    G.save.gear.equipped.head = item({ id: 9 });
    const r = salvage([1, 2, 9]);
    expect(r).toEqual({ n: 2, gold: 40, stone: 3, refined: 0 });
    expect(G.save.gear.bag.map(x => x.id)).toEqual([3]);
    expect(G.save.gear.equipped.head?.id).toBe(9);
    expect([G.save.player.gold, G.save.mats.stone]).toEqual([40, 3]);
  });
  it('옛 저장은 재료 0', () => {
    const o = newSave(1) as Partial<ReturnType<typeof newSave>>;
    delete o.mats;
    expect(migrate(o).mats).toEqual({ stone: 0, refined: 0 });
  });
});

describe('세트 없음', () => {
  it('떨어지는 장비는 모두 등급 이름 장비, 세트 표시 없음', () => {
    let k = 11; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const it = rollItem(r, '악몽', 'B', 60, i);
      expect(it.name).toBe(itemName(it));
      expect(Object.keys(it).sort()).toEqual(['grade', 'id', 'kind', 'lines', 'name', 'plus', 'slot', 'specs']);
    }
  });
  it('옛 저장의 세트 장비는 세트 표시를 빼고 등급 이름으로 (강화·잠금은 그대로)', () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    o.gear.equipped = { head: { id: 1, slot: 'head', grade: '희귀', plus: 3, name: '새벽 순례자의 두건', set: 'dawn', lock: true }, weapon: { id: 2, slot: 'weapon', grade: '고급', plus: 0, name: '튼튼한 지팡이' } };
    o.gear.bag = [{ id: 3, slot: 'ring', grade: '영웅', plus: 0, name: '순례자의 반지', set: 'dawn' }];
    const g = migrate(o).gear;
    expect(g.equipped.head).toMatchObject({ id: 1, slot: 'head', kind: 'hood', grade: '희귀', plus: 3, name: '축복받은 두건', lock: true });
    expect(g.equipped.weapon).toMatchObject({ id: 2, slot: 'weapon', kind: 'staff', grade: '고급', plus: 0, name: '튼튼한 지팡이' });
    expect(g.bag).toMatchObject([{ id: 3, slot: 'ring', kind: 'ring', grade: '영웅', plus: 0, name: '성스러운 반지' }]);
    expect('set' in g.equipped.head! || 'set' in g.bag[0]).toBe(false);
  });
});

describe('클리어 재료', () => {
  const res = (o: Partial<BattleResult>): BattleResult => ({
    content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
    healed: 7000, overheal: 1000, dispels: 0, dispellable: 0, endMana: 20, minMana: 5, auto: false, party: [], detail: [], ...o,
  });
  it('던전 강화석 (난이도마다 +1), 레이드는 정제 강화석도', () => {
    expect(clearMats('쉬움', 0)).toEqual({ stone: 1, refined: 0 });
    expect(clearMats('악몽', 0)).toEqual({ stone: 4, refined: 0 });
    expect(clearMats('보통', 10)).toEqual({ stone: 3, refined: 1 });
    expect(clearMats('악몽', 20)).toEqual({ stone: 5, refined: 3 });
  });
  it('정산에 들어가고 저장됨, 지면 없음', () => {
    const s = newSave(1);
    const x = settle(s, res({}), () => 0.5);
    expect(x.mats).toEqual({ stone: 2, refined: 0 });
    expect(s.mats).toEqual({ stone: 2, refined: 0 });
    const y = settle(s, res({ win: false }), () => 0.5);
    expect(y.mats).toEqual({ stone: 0, refined: 0 });
  });
});

describe('장비 종류 · 옵션 (34 6-2 ~ 6-5)', () => {
  it('뽑은 장비: 그 부위 종류, 등급만큼 추가 옵션 (서로 다르고 고정 옵션과도 다름), 굴림 60~100%', () => {
    const r = rngFrom(5);
    for (let i = 0; i < 3000; i++) {
      const it = rollItem(r, '악몽', 'S', 60, i), ks = kindsOf(it.slot), k = ks.find(x => x.key === it.kind)!;
      expect(k).toBeTruthy();
      expect(it.lines).toHaveLength(EXTRA_LINES[it.grade]);
      expect(new Set(it.lines.map(l => l.stat)).size).toBe(it.lines.length);
      expect(it.lines.some(l => l.stat === k.fixed)).toBe(false);
      for (const l of it.lines) { expect(l.roll).toBeGreaterThanOrEqual(0.6); expect(l.roll).toBeLessThanOrEqual(1); }
    }
  });
  it('주 능력치는 강화로 오르고, 고정 옵션은 장신구만 강화로 오름', () => {
    const staff = item({ slot: 'weapon', kind: 'staff', grade: '영웅' });
    expect(itemStats(staff)).toMatchObject({ int: 0.12, haste: 0.05, hp: 0 });
    const s5 = itemStats({ ...staff, plus: 5 });
    expect(s5.int).toBeCloseTo(0.12 * 1.4);
    expect(s5.haste).toBeCloseTo(0.05);
    const robe = itemStats(item({ slot: 'chest', kind: 'robe', grade: '희귀', plus: 10 }));
    expect(robe.int).toBeCloseTo(0.07 * 0.8 * 1.8);
    expect(robe.hp).toBeCloseTo(0.05 * 0.8 * 1.8);
    expect(robe.spirit).toBeCloseTo(0.08 * 0.8);
    const signet = itemStats(item({ slot: 'ring', kind: 'signet', grade: '영웅', plus: 5 }));
    expect(signet.int).toBe(0);
    expect(signet.haste).toBeCloseTo(0.05 * 1.4);
  });
  it('추가 옵션 값 = 그 능력치 영웅 최대값 × 등급 배율 × 굴림', () => {
    const it = item({ slot: 'hands', kind: 'gloves', grade: '전설', lines: [{ stat: 'crit', roll: 0.75 }, { stat: 'int', roll: 1 }] });
    const s = itemStats(it);
    expect(s.crit).toBeCloseTo(0.04 * 1.2 * 0.75);
    expect(s.int).toBeCloseTo(0.07 * 1.2 + 0.05 * 1.2);
  });
  it('치명타 · 가속 · 인내는 합 상한까지', () => {
    const g = statsToGear({ int: 0.5, hp: 0.4, crit: 0.7, haste: 0.6, spirit: 0.3, endure: 0.45 });
    expect(g).toEqual({ heal: 1.5, regen: 1.3, crit: 0.5, haste: 0.5, hp: 0.4, endure: 0.3 });
  });
  it('시뮬 프리셋 = 6부위 그 등급 · 강화 장비의 기댓값', () => {
    const r = rngFrom(9), n = 3000, sum = Object.fromEntries(STAT_KEYS.map(k => [k, 0])) as Record<string, number>;
    for (let i = 0; i < n; i++) {
      const eq = Object.fromEntries(SLOTS.map(s => [s.key, { ...makeItem(r, s.key, '희귀', i), plus: 5 }]));
      const st = equippedStats(eq);
      for (const k of STAT_KEYS) sum[k] += st[k] / n;
    }
    const p = gearStats('rare5');
    expect(1 + sum.int).toBeCloseTo(p.heal, 2);
    expect(1 + sum.spirit).toBeCloseTo(p.regen, 2);
    expect(sum.crit).toBeCloseTo(p.crit, 2);
    expect(sum.haste).toBeCloseTo(p.haste, 2);
    expect(sum.hp).toBeCloseTo(p.hp!, 2);
    expect(sum.endure).toBeCloseTo(p.endure!, 2);
  });
  it('전투: 체력은 내 최대 체력, 인내는 내가 받는 피해를 줄임', () => {
    const base = E.create({ encounter: 'warden', diff: '보통', seed: 1 });
    const geared = E.create({ encounter: 'warden', diff: '보통', seed: 1, gearStats: { ...gearStatsOf({}), hp: 0.2, endure: 0.25 } });
    expect(geared.me.max).toBeCloseTo(base.me.max * 1.2);
    const hit = (f: typeof base) => { const before = f.me.hp; damage(f, f.me, 100, false, 'fixed'); return before - f.me.hp; };
    expect(hit(geared)).toBeCloseTo(hit(base) * 0.75);
  });
  it('옛 장비 이전: 그 부위 첫 종류 + 등급만큼 추가 옵션, 몇 번 불러도 같음', () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    o.gear.bag = [{ id: 7, slot: 'neck', grade: '영웅', plus: 2, name: '성스러운 목걸이' }];
    const a = migrate(o).gear.bag[0], b = migrate(JSON.parse(JSON.stringify(o))).gear.bag[0];
    expect(a).toMatchObject({ kind: 'beads', name: '성스러운 구슬 목걸이', plus: 2 });
    expect(a.lines).toHaveLength(3);
    expect(b).toEqual(a);
    expect(migrate(JSON.parse(JSON.stringify({ ...o, gear: { ...o.gear, bag: [a] } }))).gear.bag[0]).toEqual(a); // 이미 바뀐 장비는 그대로
  });
});
