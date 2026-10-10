/** 묶음 C 새 부품 (48 5장): 요정 고리 · 넘어가는 포자 · 모자 뽑기 · 걸릴 때 피해, 자동 힐러 대응 */
import { describe, expect, it } from 'vitest';
import type { DebuffDef, SkillEffect } from '../src/data/bosses';
import * as E from '../src/engine';
import { applyDebuff, runEffect, zoneCells } from '../src/engine/bossParts';
import { hexDist } from '../src/engine/board';
import { heal } from '../src/engine/core';
import { doDispel } from '../src/engine/heroes';
import type { BossSkill, Fight } from '../src/engine';

const steps = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const fight = (hero: 'priest' | 'druid' | 'paladin' = 'priest', encounter: E.FightConfig['encounter'] = 'plague') => {
  const f = E.create({ encounter, diff: '보통', seed: 1, hero }); quiet(f); return f;
};
const skill = { name: '독버섯 고리', st: {} } as unknown as BossSkill;
const run = (f: Fight, e: SkillEffect) => runEffect(f, skill, e);

const RING: SkillEffect = { p: 'ring', n: 1, sec: 18, dps: 30, every: 2, max: 2, maxMythic: 3 };
const SPORE: DebuffDef = { name: '포자 솜뭉치', type: '질병', left: 14, dot: 6, absorb: 240, end: { p: 'pass', sec: 14 } };

describe('요정 고리 (P-GROW)', () => {
  it('탱커 · 나 아닌 사람 발밑에 1칸 고리, 안에서 치유를 받으면 2초에 한 번 한 겹씩 자람 (최대 2겹)', () => {
    const f = fight();
    run(f, RING);
    const z = f.zones.find(x => x.ring)!;
    expect(z.cells.size).toBe(1);
    const u = f.party.find(x => z.cells.has(x.cell))!;
    expect(u.role).not.toBe('tank');
    expect(u.me).toBe(false);
    u.ignoreZone = z.id; // 걸어 나가지 않게
    u.hp = u.max * 0.5;
    heal(f, u, 50, true, true);
    expect(z.ring!.n).toBe(1);
    const c0 = f.cells[z.ring!.center];
    expect([...z.cells].every(i => hexDist(f.cells[i], c0) <= 1)).toBe(true);
    expect(z.cells.size).toBe(f.cells.filter(c => c.block !== 'hole' && hexDist(c, c0) <= 1).length);
    heal(f, u, 50, true, true);
    expect(z.ring!.n).toBe(1); // 2초 안에는 한 번만
    steps(f, 2.05);
    heal(f, u, 50, true, true);
    expect(z.ring!.n).toBe(2);
    steps(f, 2.05);
    heal(f, u, 50, true, true);
    expect(z.ring!.n).toBe(2);
    steps(f, 14);
    expect(f.zones.some(x => x.ring)).toBe(false);
  });

  it('밖에 선 사람을 힐해도 안 자라고, 안에 선 사람은 초당 피해', () => {
    const f = fight();
    run(f, RING);
    const z = f.zones.find(x => x.ring)!;
    const u = f.party.find(x => z.cells.has(x.cell))!;
    const v = f.party.find(x => x.alive && !z.cells.has(x.cell))!;
    u.ignoreZone = z.id;
    v.hp = v.max * 0.5;
    heal(f, v, 50, true, true);
    expect(z.ring!.n).toBe(0);
    const hp = u.hp;
    steps(f, 1);
    expect(hp - u.hp).toBeGreaterThan(30 * f.dmgMult * 0.5);
  });

  it('악몽은 maxMythic겹, 피난처 안전 칸에서 고리 칸은 빠짐', () => {
    const f = fight();
    f.mythic = true;
    run(f, RING);
    const z = f.zones.find(x => x.ring)!;
    expect(z.ring!.max).toBe(3);
    const hit = zoneCells(f, skill, { p: 'safe', at: 'edge', n: 30 });
    for (const i of z.cells) expect(hit.has(i)).toBe(true);
  });

  it('파티원은 고리 밖으로 걸어 나옴', () => {
    const f = fight();
    run(f, RING);
    const z = f.zones.find(x => x.ring)!;
    const u = f.party.find(x => z.cells.has(x.cell))!;
    u.p = { ...u.p, stubborn: 0, brave: 0 };
    steps(f, 8);
    expect(z.cells.has(u.cell)).toBe(false);
  });
});

describe('넘어가는 포자 (P-PASS)', () => {
  it('치유가 먼저 막을 깎고, 지우면 남은 막이 체력 비율이 가장 높은 다른 아군에게 (시간 처음부터)', () => {
    const f = fight('priest');
    const [u, v] = f.party.filter(x => x.role !== 'tank' && !x.me);
    f.party.forEach(x => { x.hp = x.max * 0.6; });
    v.hp = v.max;
    u.hp = u.max * 0.4;
    applyDebuff(f, u, SPORE);
    const full = 240 * f.dmgMult;
    expect(u.debuffs.find(d => d.name === SPORE.name)!.absorbLeft).toBeCloseTo(full);
    const hp = u.hp;
    heal(f, u, full * 0.4, true, true);
    expect(u.hp).toBeCloseTo(hp);
    steps(f, 3);
    doDispel(f, u);
    expect(u.debuffs.some(d => d.name === SPORE.name)).toBe(false);
    const d = v.debuffs.find(x => x.name === SPORE.name)!;
    expect(d).toBeTruthy();
    expect(d.absorbLeft).toBeCloseTo(full * 0.6);
    expect(d.left).toBeCloseTo(14);
  });

  it('지우지 않고 시간이 다 되면 남은 막만큼 피해, 다 녹이면 그냥 사라짐', () => {
    const f = fight('priest');
    const [u, v] = f.party.filter(x => x.role === 'ranged');
    applyDebuff(f, u, { ...SPORE, left: 1, dot: 0 });
    const left = u.debuffs[0].absorbLeft!;
    u.hp = u.max;
    steps(f, 1.05);
    expect(u.max - u.hp).toBeGreaterThan(left * 0.95);
    applyDebuff(f, v, { ...SPORE, left: 1, dot: 0 });
    v.hp = v.max * 0.5;
    heal(f, v, 240 * f.dmgMult + 10, true, true);
    expect(v.debuffs.some(d => d.name === SPORE.name)).toBe(false);
    const hv = v.hp;
    steps(f, 1.05);
    expect(v.hp).toBeCloseTo(hv);
  });

  it('넘어갈 사람이 없으면 사라짐', () => {
    const f = fight('priest');
    const u = f.party.find(x => x.role === 'ranged')!;
    for (const x of f.party) applyDebuff(f, x, SPORE);
    doDispel(f, u);
    expect(u.debuffs.some(d => d.name === SPORE.name)).toBe(false);
    expect(f.party.filter(x => x.debuffs.filter(d => d.name === SPORE.name).length > 1)).toHaveLength(0);
  });
});

describe('모자 뽑기 · 걸릴 때 피해', () => {
  const HATS: DebuffDef[] = [
    { name: '실크해트', type: '마법', left: 8, invert: true },
    { name: '고깔모자', type: '마법', left: 12, cap: 0.7 },
    { name: '왕관 모자', type: '마법', left: 12, lock: true, cureAt: 1, drop: 240, end: { p: 'hit', dmg: 270 } },
  ];

  it('탱커 · 나 아닌 사람마다 셋 중 하나', () => {
    const f = fight();
    run(f, { p: 'cycle', n: 2, random: true, debuffs: HATS });
    const got = f.party.filter(u => u.debuffs.some(d => HATS.some(h => h.name === d.name)));
    expect(got).toHaveLength(2);
    for (const u of got) {
      expect(u.role).not.toBe('tank');
      expect(u.me).toBe(false);
      expect(u.debuffs.filter(d => HATS.some(h => h.name === d.name))).toHaveLength(1);
    }
  });

  it('완치 모자는 가득 찬 사람에게 걸려도 떨어뜨려서 바로 안 풀림', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'ranged')!;
    u.hp = u.max;
    applyDebuff(f, u, HATS[2]);
    steps(f, 0.2);
    expect(u.hp).toBeLessThan(u.max);
    expect(u.debuffs.some(d => d.name === '왕관 모자')).toBe(true);
    heal(f, u, u.max, true, true);
    steps(f, 0.1);
    expect(u.debuffs.some(d => d.name === '왕관 모자')).toBe(false);
  });
});

// 자동 힐러 대응 (고리 · 포자)은 tests/autoParts.test.ts
