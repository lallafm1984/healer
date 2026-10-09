/** 보스 부품 (38 0-3·0-4, 35 3장): 수치 단위, 디버프 부품 (해제 불가 · 체력 선 · 쇠약 · 끝날 때), 대상 고르기 */
import { describe, expect, it } from 'vitest';
import { bossHpFor, U, UNIT, type DebuffDef, type SkillEffect } from '../src/data/bosses';
import { CLASSES } from '../src/data/classes';
import * as E from '../src/engine';
import { lowestTargets, runEffect } from '../src/engine/bossParts';
import { addDebuff } from '../src/engine/core';
import { doDispel } from '../src/engine/heroes';
import type { BossSkill, Fight, Unit } from '../src/engine';

const steps = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const fight = () => { const f = E.create({ encounter: 'warden', diff: '보통', seed: 1 }); quiet(f); return f; };
const dealer = (f: Fight) => f.party.find(u => u.role === 'ranged')!;
const run = (f: Fight, e: SkillEffect) => runEffect(f, {} as BossSkill, e);

/** 쇠약 (35 4-1 병든 맥박): 90% 아래면 3초마다 1중첩, 중첩당 초당 6, 최대 5, 해제 불가 */
const WOUND: DebuffDef = { name: '쇠약', type: '질병', left: 20, lock: true, cureAt: 0.9, grow: { every: 3, dot: 6, max: 5 } };

describe('수치 단위 (35 1-2)', () => {
  it('비율을 레벨 1 · 보통 값으로', () => {
    expect(UNIT).toEqual({ tank: 1000, dps: 600, me: 550, heal: 300 });
    expect(U.tank(0.5)).toBe(500);
    expect(U.dps(0.25)).toBe(150);
    expect(U.me(0.15)).toBe(83);
    expect(U.heal(1)).toBe(300);
  });
  it('보스 체력 = 공개모집 평균 딜 × 목표 시간', () => {
    const avg = (role: string) => { const cs = Object.values(CLASSES).filter(c => c.role === role); return cs.reduce((s, c) => s + c.dps * 10, 0) / cs.length; };
    const dps = avg('tank') + avg('melee') + 2 * avg('ranged');
    expect(bossHpFor(120, { tank: 1, melee: 1, ranged: 2 })).toBe(Math.round(dps * 120 / 100) * 100);
    expect(bossHpFor(240, { tank: 1, melee: 1, ranged: 2 })).toBeGreaterThan(bossHpFor(120, { tank: 1, melee: 1, ranged: 2 }) * 1.9);
  });
});

describe('해제 불가 (lock)', () => {
  it('직업 해제·정화 두루마리로 안 지워짐, 판에는 해제 불가로 보임', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, items: ['cleanse'] });
    quiet(f);
    const u = dealer(f);
    addDebuff(f, u, { ...WOUND });
    doDispel(f, u);
    expect(u.debuffs.map(d => d.name)).toEqual(['쇠약']);
    expect(E.useItem(f, 'cleanse', 0).ok).toBe(false);
    expect(u.debuffs).toHaveLength(1);
    expect(E.canTarget(f, 'purify', u.cell).ok).toBe(false);
  });
});

describe('체력 선 · 쇠약 (P-WOUND)', () => {
  it('90% 아래면 3초마다 중첩이 쌓이고 중첩만큼 지속 피해', () => {
    const f = fight();
    const u = dealer(f);
    u.hp = u.max * 0.5;
    const d = addDebuff(f, u, { ...WOUND });
    steps(f, 2.9);
    expect(d.stack ?? 0).toBe(0);
    expect(u.hp).toBeCloseTo(u.max * 0.5);
    steps(f, 0.2);
    expect(d.stack).toBe(1);
    const hp = u.hp;
    steps(f, 1);
    expect(hp - u.hp).toBeCloseTo(6 * f.dmgMult, 1);
    steps(f, 20);
    expect(u.debuffs).toHaveLength(0); // 20초 끝
  });
  it('최대 5중첩', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'tank')!;
    u.hp = u.max * 0.5;
    const d = addDebuff(f, u, { ...WOUND, left: 60 });
    steps(f, 30);
    expect(d.stack).toBe(5);
  });
  it('90% 이상으로 채우면 바로 사라짐 (끝 부품은 안 함)', () => {
    const f = fight();
    const u = dealer(f);
    u.hp = u.max * 0.5;
    addDebuff(f, u, { ...WOUND, end: { p: 'hit', dmg: 999 } });
    steps(f, 4);
    u.hp = u.max * 0.9;
    E.step(f);
    expect(f.events.some(e => e.type === 'cure' && e.id === u.id && e.name === '쇠약')).toBe(true);
    f.events.length = 0;
    expect(u.debuffs).toHaveLength(0);
    expect(u.hp).toBeCloseTo(u.max * 0.9);
  });
  it('최대 체력이 깎이면 같은 체력으로도 선을 넘음 (썩은 축복을 두면 쉬워짐, 35 4-1)', () => {
    const f = fight();
    const u = dealer(f);
    u.hp = u.max * 0.8;
    addDebuff(f, u, { ...WOUND });
    steps(f, 0.1);
    expect(u.debuffs).toHaveLength(1);
    u.max = u.hp / 0.95;
    steps(f, 0.1);
    expect(u.debuffs).toHaveLength(0);
  });
});

describe('디버프 끝 부품', () => {
  it('hit: 시간이 다 되면 그 사람 피해, 지우면 없음', () => {
    const f = fight();
    const u = dealer(f);
    const mark: DebuffDef = { name: '표식', type: '마법', left: 1, end: { p: 'hit', dmg: 100 } };
    addDebuff(f, u, { ...mark });
    doDispel(f, u);
    expect(u.hp).toBe(u.max);
    addDebuff(f, u, { ...mark });
    steps(f, 1.1);
    expect(u.max - u.hp).toBeCloseTo(100 * f.dmgMult);
  });
});

describe('대상 고르기', () => {
  it('lowest: 체력 비율이 가장 낮은 사람부터, 사냥은 탱커 빼고 (P-HUNT)', () => {
    const f = fight();
    const [tank, ...rest] = [f.party.find(u => u.role === 'tank')!, ...f.party.filter(u => u.role !== 'tank')];
    tank.hp = 1;
    rest.forEach((u, i) => { u.hp = u.max * (0.9 - i * 0.1); });
    expect(lowestTargets(f, 2).map(u => u.id)).toEqual([tank.id, rest[rest.length - 1].id]);
    run(f, { p: 'debuff', n: 1, pick: 'lowest', debuff: { name: '사냥', type: '마법', left: 5 } });
    expect(rest[rest.length - 1].debuffs.map(d => d.name)).toEqual(['사냥']);
    expect(tank.debuffs).toHaveLength(0);
  });
  it("n: 'all' = 살아 있는 모두", () => {
    const f = fight();
    run(f, { p: 'debuff', n: 'all', debuff: { ...WOUND } });
    expect(f.party.every(u => u.debuffs.some(d => d.name === '쇠약'))).toBe(true);
  });
});

describe('최대 체력 깎기 (P-HPDOWN · 썩은 축복)', () => {
  const ROT = { p: 'rot', n: 1, debuff: { name: '썩은 축복', type: '질병', left: 30, end: { p: 'restoreMax' } }, pct: 0.08, max: 4 } as const;
  it('again: 이미 걸린 사람이 있으면 그 확률로 다시, 지우면 최대 체력이 돌아옴', () => {
    const f = fight();
    const u = dealer(f);
    const base = u.max;
    run(f, { ...ROT, again: 1, n: 1 });
    const hit = f.party.find(x => x.debuffs.length)!;
    for (let i = 0; i < 5; i++) run(f, { ...ROT, again: 1 });
    expect(f.party.filter(x => x.debuffs.length)).toEqual([hit]);
    expect(hit.debuffs[0].stack).toBe(4);
    expect(hit.max).toBeCloseTo(hit.base * (1 - 0.32));
    doDispel(f, hit);
    expect(hit.max).toBe(hit.base);
    expect(u.max).toBe(base);
  });
  it('again 0이면 아무나 (이미 걸린 사람도 다시 고를 수 있음)', () => {
    const f = fight();
    for (let i = 0; i < 12; i++) run(f, { ...ROT, again: 0 });
    expect(f.party.filter((x: Unit) => x.debuffs.length).length).toBeGreaterThan(1);
  });
});
