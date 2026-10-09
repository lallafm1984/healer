/** 보스 부품 (38 0-3·0-4, 35 3장): 수치 단위, 디버프 부품 (해제 불가 · 체력 선 · 쇠약 · 끝날 때), 대상 고르기 */
import { describe, expect, it } from 'vitest';
import { bossHpFor, U, UNIT, type DebuffDef, type SkillEffect } from '../src/data/bosses';
import { CLASSES } from '../src/data/classes';
import * as E from '../src/engine';
import { applyDebuff, backTargets, bossTaken, focusOrder, lowestTargets, offTank, orderHeal, runEffect, watchInit } from '../src/engine/bossParts';
import { moveTo, pickCell, zoneOf } from '../src/engine/movement';
import { ABILITIES } from '../src/data/abilities';
import { unitDps } from '../src/engine/units';
import { hexDist } from '../src/engine/board';
import { fromDef } from '../src/engine/bosses';
import { addDebuff, damage, damageMob, heal } from '../src/engine/core';
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

describe('끌어당김 (P-PULL)', () => {
  const PULL = { p: 'pull', sec: 6, dmg: 60 } as const;
  const setup = () => {
    const f = fight();
    const tank = f.party.find(u => u.role === 'tank')!;
    const [u] = backTargets(f, 1);
    return { f, tank, u, home: u.cell };
  };
  it('뒷줄부터 고름 (탱커·나 빼고)', () => {
    const f = fight();
    const ts = backTargets(f, 2);
    expect(ts.every(u => u.role !== 'tank' && !u.me)).toBe(true);
    const rows = ts.map(u => f.cells[u.cell].row);
    const others = f.party.filter(u => u.role !== 'tank' && !u.me && !ts.includes(u)).map(u => f.cells[u.cell].row);
    for (const r of others) expect(r).toBeLessThanOrEqual(Math.min(...rows));
  });
  it('탱커 옆 빈 칸으로 끌려와 평타를 탱커와 번갈아 맞고, 시간이 다 되면 제자리로', () => {
    const { f, tank, u, home } = setup();
    runEffect(f, {} as BossSkill, PULL, { units: [u.id] } as never);
    expect(u.pulled).toBeTruthy();
    steps(f, 0.5);
    expect(hexDist(f.cells[u.cell], f.cells[tank.cell])).toBe(1);
    const auto = { st: {} } as BossSkill;
    const hp = [tank.hp, u.hp];
    for (let i = 0; i < 4; i++) runEffect(f, auto, { p: 'auto', dmg: 70 });
    expect(tank.hp).toBeLessThan(hp[0]);
    expect(hp[1] - u.hp).toBeCloseTo(2 * 60 * f.dmgMult);
    steps(f, 6);
    expect(u.pulled).toBeNull();
    steps(f, 3);
    expect(u.cell).toBe(home);
  });
  it('끌려온 칸을 벗어나면 (도망·장판 피하기) 바로 끝', () => {
    const { f, u } = setup();
    runEffect(f, {} as BossSkill, PULL, { units: [u.id] } as never);
    steps(f, 0.5);
    const c = f.cells.find(x => !x.unit)!;
    moveTo(f, u, c);
    steps(f, 0.1);
    expect(u.pulled).toBeNull();
  });
});

describe('쫄 (P-ADD) · 쓰러질 때 (P-BURST)', () => {
  const ROT_DUST: DebuffDef = { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } };
  const BONES = { name: '되살아난 뼈', short: '뼈', hp: 0.04, dmg: 18, every: 2, down: { p: 'debuff', debuff: ROT_DUST } } as const;
  it('딜러를 1명씩 맡아 때리고, 보스 체력에는 안 들어감', () => {
    const f = fight();
    run(f, { p: 'adds', n: 2, add: BONES });
    const adds = f.mobs.filter(m => m.add);
    expect(adds).toHaveLength(2);
    expect(adds.every(m => m.max === f.bossMax * 0.04)).toBe(true);
    const on = adds.map(m => f.party.find(u => u.id === m.add!.on)!);
    expect(new Set(on).size).toBe(2);
    expect(on.every(u => u.role === 'melee' || u.role === 'ranged')).toBe(true);
    expect(f.bossHp).toBe(f.bossMax);
    // 쫄 피해 기준 = 원거리 (근접은 직업군 방어력 차이만큼 덜 맞음)
    const r = on.find(u => u.role === 'ranged')!, hp = r.hp;
    steps(f, 2.05);
    expect(hp - r.hp).toBeCloseTo(18 * f.dmgMult);
  });
  it('딜러 딜은 쫄부터, 탱커 딜은 보스로. 쓰러지면 맡던 사람에게 부패 (최대 체력 -10%), 지우면 돌아옴', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1 });
    f.skills.forEach(s => { s.next = Infinity; });
    run(f, { p: 'adds', n: 1, add: BONES });
    const m = f.mobs.find(x => x.add)!;
    const u = f.party.find(x => x.id === m.add!.on)!;
    let bossDealt = 0, tankHits = 0;
    // 쫄이 살아 있는 동안 보스는 탱커 딜만 맞음 (쫄을 쓰러뜨린 한 방의 남는 딜은 보스로)
    for (let i = 0; i < 400 && m.alive; i++) {
      const b = f.bossHp; E.step(f);
      if (m.alive) { bossDealt += b - f.bossHp; for (const ev of f.events) if (ev.type === 'hit' && f.party.find(x => x.id === ev.uid)?.role === 'tank') tankHits += ev.amt; }
      f.events.length = 0;
    }
    expect(m.alive).toBe(false);
    expect(tankHits).toBeGreaterThan(0);
    expect(bossDealt).toBeCloseTo(tankHits, 0);
    E.step(f);
    const d = u.debuffs.find(x => x.name === '부패')!;
    expect(d).toBeTruthy();
    expect(u.max).toBeCloseTo(u.base * 0.9);
    doDispel(f, u);
    expect(u.max).toBe(u.base);
  });
  it('파열: 쫄이 쓰러질 때마다 모두 1중첩, 지속 피해 = 중첩만큼', () => {
    const f = fight();
    const BURST: DebuffDef = { name: '파열', type: '물리', left: 4, dot: 6, stackMax: 10 };
    run(f, { p: 'adds', n: 2, add: { ...BONES, down: { p: 'burst', debuff: BURST } } });
    for (const m of f.mobs) damageMob(f, m, m.max);
    E.step(f);
    for (const u of f.party) expect(u.debuffs.find(d => d.name === '파열')?.stack).toBe(2);
    const v = dealer(f), hp = v.hp;
    steps(f, 1);
    expect(hp - v.hp).toBeCloseTo(2 * 6 * f.dmgMult, 1);
  });
  it('쫄이 남아 있어도 보스가 쓰러지면 「보스를 쓰러뜨림」', () => {
    const f = fight();
    run(f, { p: 'adds', n: 1, add: BONES });
    f.bossHp = 0;
    E.step(f);
    expect(f.over).toBe('win');
    expect(f.reason).toBe('보스를 쓰러뜨림');
  });
});

describe('흐르는 장판 (향로 연기)', () => {
  it('왼쪽 끝 열에서 every초마다 한 열씩 오른쪽으로, 다음 열은 미리 예고', () => {
    const f = fight();
    const s = fromDef(f, { key: 'smoke', name: '향로 연기', kind: 'zone', first: 0, period: 999, cast: 2.5, dps: 24, dur: 2, cells: { p: 'flow', every: 2 } });
    s.next = f.t;
    const cols: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      E.step(f); f.events.length = 0;
      for (const z of f.zones) if (!seen.has(z.id)) { seen.add(z.id); cols.push(f.cells[[...z.cells][0]].col); }
    }
    const all = [...new Set(f.cells.map(c => c.col))].sort((a, b) => a - b);
    expect(cols).toEqual(all);
  });
});

describe('피난처 (P-SAFE) · 한 번 맞는 장판', () => {
  const BELLY = { key: 'belly', name: '배치기', kind: 'zone', first: 0, period: 999, cast: 4, hitDmg: 360, cells: { p: 'safe', at: 'edge', n: 6 } } as const;
  it('바깥 6칸이 안전 칸 (금빛), 나머지 칸은 모두 맞는 칸', () => {
    const f = fight();
    const s = fromDef(f, BELLY);
    s.next = f.t; E.step(f);
    const tel = f.tels.find(t => t.skill === s)!;
    expect(tel.cells.size).toBe(f.cells.length - 6);
    expect(tel.safe!.size).toBe(6);
    expect([...tel.cells].some(i => tel.safe!.has(i))).toBe(false);
  });
  it('4초 예고 동안 파티원이 안전 칸으로 비키고, 남은 사람·배 속(hide)은 따로', () => {
    const f = fight();
    const s = fromDef(f, BELLY);
    s.next = f.t; E.step(f);
    const tel = f.tels.find(t => t.skill === s)!;
    const inside = f.party.filter(u => tel.cells.has(u.cell));
    const swallowed = dealer(f);
    swallowed.debuffs.push({ id: 999, name: '삼키기', type: '물리', left: 99, lock: true, hide: true, noMove: true, noDps: true });
    const hp = new Map(f.party.map(u => [u.id, u.hp]));
    steps(f, 4.1);
    expect(f.tels.includes(tel)).toBe(false);
    for (const u of f.party) {
      const hit = hp.get(u.id)! - u.hp > 100;
      if (u === swallowed) expect(hit).toBe(false);
      else if (hit) expect(tel.cells.has(u.cell)).toBe(true);
    }
    expect(inside.length).toBeGreaterThan(0);
    expect(f.party.filter(u => u !== swallowed && tel.cells.has(u.cell)).length).toBeLessThan(inside.filter(u => u !== swallowed).length);
  });
  it('center + tank: 가운데에서 가까운 칸 n개와 탱커 칸이 안전', () => {
    const f = fight();
    const tank = f.party.find(u => u.role === 'tank')!;
    const s = fromDef(f, { ...BELLY, key: 'roof', cells: { p: 'safe', at: 'center', n: 4, tank: true } });
    s.next = f.t; E.step(f);
    const tel = f.tels.find(t => t.skill === s)!;
    expect(tel.safe!.has(tank.cell)).toBe(true);
    expect(tel.safe!.size).toBeGreaterThanOrEqual(4);
  });
  it('악몽에서만 도는 기술 (when mythic)', () => {
    const f = E.create({ encounter: 'warden', diff: '악몽', seed: 1 });
    const g = fight();
    for (const x of [f, g]) { x.skills.forEach(s => { s.next = Infinity; }); fromDef(x, { ...BELLY, key: 'm', when: { mythic: true } }).next = x.t; E.step(x); }
    expect(f.tels.length).toBe(1);
    expect(g.tels.length).toBe(0);
  });
});

describe('무너지는 바닥 (P-HOLE) · 칸을 차지하는 쫄 (토템)', () => {
  it('가장자리 빈 칸부터 구멍, 최대 개수까지, 빈 칸은 1개 이상 남김, 아무도 구멍으로 안 감', () => {
    const f = fight();
    for (let i = 0; i < 6; i++) run(f, { p: 'hole', n: 1, max: 3 });
    const holes = f.cells.filter(c => c.block === 'hole');
    expect(holes).toHaveLength(3);
    expect(f.cells.filter(c => !c.unit && !c.block).length).toBeGreaterThanOrEqual(1);
    const g = fight();
    for (let i = 0; i < g.cells.length; i++) run(g, { p: 'hole', n: 1, max: g.cells.length });
    expect(g.cells.filter(c => !c.unit && !c.block)).toHaveLength(1);
    const u = dealer(f);
    for (let i = 0; i < 20; i++) { const c = pickCell(f, u, { safe: true }); expect(c?.block).toBeUndefined(); }
  });
  it('토템: 빈 칸 하나를 막고 이웃 칸에 오라 장판, 부수면 칸과 오라가 사라짐', () => {
    const f = fight();
    run(f, { p: 'adds', n: 1, add: { name: '진흙 토템', short: '토템', hp: 0.05, dmg: 0, every: 99, aura: 9 } });
    const m = f.mobs.find(x => x.add)!;
    const c = f.cells[m.add!.cell!];
    expect(c.block).toBe('add');
    const z = f.zones.find(x => x.id === m.add!.zone)!;
    expect([...z.cells].every(i => hexDist(f.cells[i], c) === 1)).toBe(true);
    expect(m.add!.on).toBe(0);
    damageMob(f, m, m.max);
    E.step(f);
    expect(c.block).toBeUndefined();
    expect(f.zones.some(x => x.id === z.id)).toBe(false);
  });
});

describe('상태 디버프: 딜 0 · 못 움직임 · 보스를 깎으면 풀림 (삼키기)', () => {
  const SWALLOW: DebuffDef = { name: '삼키기', type: '물리', left: 8, dot: 30, lock: true, noDps: true, noMove: true, hide: true, untilBossLoss: 0.04 };
  it('삼켜진 사람은 딜 0, 장판에 안 맞고, 보스 체력 4%를 더 깎으면 풀림', () => {
    const f = fight();
    const u = dealer(f);
    u.dps = 10;
    expect(unitDps(u)).toBeGreaterThan(0);
    applyDebuff(f, u, SWALLOW);
    expect(unitDps(u)).toBe(0);
    f.zones.push({ id: 1, cells: new Set([u.cell]), end: Infinity, dps: 50 });
    const hp = u.hp;
    steps(f, 1);
    expect(hp - u.hp).toBeCloseTo(30 * f.dmgMult, 0); // 위산만
    expect(f.cells.findIndex(c => c.unit === u)).toBe(u.cell); // 제자리
    f.bossHp -= f.bossMax * 0.04;
    E.step(f);
    expect(u.debuffs.some(d => d.name === '삼키기')).toBe(false);
  });
});

describe('치유 훅: 받는 치유 감소 · 뒤집힌 축복 (P-INVERT)', () => {
  const GLOVE: DebuffDef = { name: '얼룩진 장갑', type: '저주', left: 12, healCut: 0.5 };
  const DUST: DebuffDef = { name: '먼지 범벅', type: '마법', left: 20, healCut: 0.08, stackMax: 5 };
  const INVERT: DebuffDef = { name: '뒤집힌 축복', type: '저주', left: 8, invert: true };

  it('받는 치유 −비율, 중첩 디버프는 × 중첩', () => {
    const f = fight();
    const u = dealer(f);
    u.hp = u.max * 0.3;
    applyDebuff(f, u, GLOVE);
    let h0 = u.hp;
    expect(heal(f, u, 40, true, true)).toBeCloseTo(20);
    expect(u.hp - h0).toBeCloseTo(20);
    u.debuffs = [];
    for (let i = 0; i < 3; i++) applyDebuff(f, u, DUST);
    h0 = u.hp;
    heal(f, u, 40, true, true);
    expect(u.hp - h0).toBeCloseTo(30.4);
  });

  it('뒤집힌 축복: 들어올 치유만큼 피해 (빨간 숫자), 보호막은 통함', () => {
    const f = fight();
    const u = dealer(f);
    u.hp = u.max * 0.8;
    applyDebuff(f, u, INVERT);
    f.events.length = 0;
    let h0 = u.hp;
    expect(heal(f, u, 40, true, true)).toBe(0);
    expect(h0 - u.hp).toBeCloseTo(40);
    expect(f.events).toContainEqual({ type: 'hurt', id: u.id, amt: 40 });
    expect(f.stats.inverted).toBeCloseTo(40);
    u.shield = 5;
    h0 = u.hp;
    heal(f, u, 40, false, true); // 지속·광역 힐도 피해가 됨
    expect(h0 - u.hp).toBeCloseTo(24);
  });

  it('쉬움·보통은 그 칸 첫 힐이 안 나가고 칸만 흔들림, 두 번째부터 나감. 어려움은 바로', () => {
    for (const diff of ['보통', '어려움'] as const) {
      const f = E.create({ encounter: 'warden', diff, seed: 1 });
      quiet(f);
      const u = dealer(f);
      applyDebuff(f, u, INVERT);
      const r1 = E.use(f, 'flash', u.cell);
      if (diff === '보통') {
        expect(r1.ok).toBe(false);
        expect(r1.reason).toContain('뒤집힌 축복');
        expect(f.events).toContainEqual({ type: 'shake', id: u.id });
        expect(f.cast).toBeNull();
        expect(E.use(f, 'flash', u.cell).ok).toBe(true);
      } else expect(r1.ok).toBe(true);
      expect(f.cast?.uid).toBe(u.id);
    }
  });
});

describe('차례 (P-ORDER) · 보스 멍함', () => {
  const ORDER: SkillEffect = { p: 'order', n: 3, sec: 8, wrong: 180, miss: 150, daze: { sec: 4, vuln: 1.2 } };
  const ordered = (f: Fight) => f.order!.ids.map(id => f.party.find(u => u.id === id)!);

  it('탱커 아닌 3명에게 번호, 순서대로 힐하면 보스 4초 멍함 (기술 안 씀, 받는 피해 +20%)', () => {
    const f = fight();
    run(f, ORDER);
    expect(f.order!.ids).toHaveLength(3);
    const us = ordered(f);
    expect(us.every(u => u.role !== 'tank')).toBe(true);
    for (const u of us) orderHeal(f, u);
    expect(f.order).toBeNull();
    expect(f.daze).toEqual({ until: f.t + 4, vuln: 1.2 });
    // 멍한 동안 평타가 안 들어옴
    const tk = f.party.find(u => u.role === 'tank')!;
    const auto = f.skills.find(s => s.key === 'auto')!;
    auto.next = f.t;
    const hp = tk.hp;
    steps(f, 3.9);
    expect(tk.hp).toBe(hp);
    steps(f, 0.3);
    expect(f.daze).toBeNull();
  });

  it('멍한 보스는 같은 딜에 20% 더 깎임', () => {
    const loss = (daze: boolean) => {
      const f = E.create({ encounter: 'warden', diff: '보통', seed: 3 });
      f.skills.forEach(s => { s.next = Infinity; });
      if (daze) f.daze = { until: 99, vuln: 1.2 };
      const hp = f.bossHp;
      steps(f, 6);
      return hp - f.bossHp;
    };
    expect(loss(true) / loss(false)).toBeCloseTo(1.2, 1);
  });

  it('순서가 틀리면 그 사람 피해 + 처음부터 (쉬움은 피해 없이), 받은 번호에 또 힐하면 그대로', () => {
    for (const diff of ['보통', '쉬움'] as const) {
      const f = E.create({ encounter: 'warden', diff, seed: 1 });
      quiet(f);
      run(f, ORDER);
      const [a, b, c] = ordered(f);
      orderHeal(f, a);
      orderHeal(f, a);
      expect(f.order!.i).toBe(1);
      const hp = c.hp;
      orderHeal(f, c);
      expect(f.order!.i).toBe(0);
      if (diff === '보통') expect(c.hp).toBeLessThan(hp); else expect(c.hp).toBe(hp);
      orderHeal(f, a); orderHeal(f, b);
      expect(f.order!.i).toBe(2);
    }
  });

  it('스킬로 셈: 단일 대상 힐만 (지속 힐 소생 포함), 시간이 다 되면 못 받은 사람마다 피해', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, level: 10 });
    quiet(f);
    run(f, ORDER);
    const [a, b, c] = ordered(f);
    expect(E.use(f, 'renew', a.cell).ok).toBe(true);
    expect(f.order!.i).toBe(1);
    f.gcd = 0;
    expect(E.use(f, 'poh', b.cell).ok).toBe(true); // 광역 힐은 안 셈
    f.cast = null; f.gcd = 0;
    expect(f.order!.i).toBe(1);
    const hb = b.hp, hc = c.hp, ha = a.hp;
    steps(f, 8.1);
    expect(f.order).toBeNull();
    expect(f.daze).toBeNull();
    expect(b.hp).toBeLessThan(hb);
    expect(c.hp).toBeLessThan(hc);
    expect(a.hp).toBeGreaterThanOrEqual(ha);
  });
});

describe('판에 나오는 적 (35 3-I): 빈 칸 차지 · 부탱커 · 일점사 · 치유 쫄 · 폭탄 · 보호막 수정', () => {
  const IMP = { name: '꼬마 악마', short: '악마', hp: 0.03, dmg: 20, every: 2 };
  const free = (f: Fight) => f.cells.filter(c => !c.unit && !c.block).length;

  it('빈 칸에 나와 칸을 막고, 때리는 쫄은 탱커 가까이. 빈 칸은 1개 이상 남김', () => {
    const f = fight();
    const before = free(f);
    run(f, { p: 'adds', n: 99, add: IMP }); // 판 크기와 상관없이 빈 칸이 1개 남을 때까지
    const adds = f.mobs.filter(m => m.add);
    expect(adds).toHaveLength(before - 1);
    expect(free(f)).toBe(1);
    expect(adds.every(m => f.cells[m.add!.cell!].block === 'add')).toBe(true);
    const f2 = fight();
    run(f2, { p: 'adds', n: 1, add: IMP });
    const c = f2.cells[f2.mobs[f2.mobs.length - 1].add!.cell!];
    const tk = f2.party.find(u => u.role === 'tank')!;
    const nearest = Math.min(...f2.cells.filter(x => (!x.unit && !x.block) || x === c).map(x => hexDist(x, f2.cells[tk.cell])));
    expect(hexDist(c, f2.cells[tk.cell])).toBe(nearest);
  });

  it('레이드: 부탱커가 쫄 옆 칸으로 가서 끌고, 쫄은 부탱커만 때림. 부탱커가 쓰러지면 딜러에게', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1 });
    quiet(f);
    const off = offTank(f)!;
    expect(off.role).toBe('tank');
    run(f, { p: 'adds', n: 2, add: IMP });
    const adds = f.mobs.filter(m => m.add);
    expect(adds.every(m => m.add!.on === off.id)).toBe(true);
    steps(f, 1);
    expect(hexDist(f.cells[off.cell], f.cells[adds[0].add!.cell!])).toBe(1);
    expect(off.home).toBe(off.cell);
    const hp = off.hp;
    steps(f, 1.1);
    expect(off.hp).toBeLessThan(hp);
    off.hp = 0.1; (off as Unit).alive = false;
    steps(f, 2.1);
    expect(adds.every(m => { const u = f.party.find(x => x.id === m.add!.on)!; return u.role === 'melee' || u.role === 'ranged'; })).toBe(true);
  });

  it('일점사: 치유 쫄 → 폭탄 → 보호막 수정 → 그 밖 (같으면 먼저 나온 것), 딜러 딜은 맨 앞 적에게', () => {
    const f = fight();
    run(f, { p: 'adds', n: 1, add: IMP });
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '수정', short: '수정', dmg: 0, job: { p: 'pylon', cut: 0.9 } } });
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '치유사', short: '치유', dmg: 0, job: { p: 'mend', every: 99, pct: 0.01 } } });
    expect(focusOrder(f).map(m => m.name)).toEqual(['치유사', '수정', '꼬마 악마']);
    f.party.forEach(u => { u.dps = 10; });
    const [mender, pylon, imp] = focusOrder(f);
    steps(f, 2);
    expect(mender.hp).toBeLessThan(mender.max);
    expect(pylon.hp).toBe(pylon.max);
    expect(imp.hp).toBe(imp.max);
  });

  it('치유하는 쫄: every초마다 보스 체력 회복 (최대 넘지 않음)', () => {
    const f = fight();
    f.bossHp = f.bossMax * 0.5;
    run(f, { p: 'adds', n: 1, add: { ...IMP, dmg: 0, job: { p: 'mend', every: 3, pct: 0.02 } } });
    steps(f, 3.05);
    expect(f.bossHp).toBeCloseTo(f.bossMax * 0.52);
  });

  it('폭탄: 시간 안에 못 깨면 모두 피해, 사라지고 칸이 빔. 깨면 안 터짐', () => {
    const f = fight();
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '폭탄', dmg: 0, job: { p: 'bomb', sec: 4, dmg: 50 } } });
    const m = f.mobs[f.mobs.length - 1], c = f.cells[m.add!.cell!];
    const v = dealer(f), hp = v.hp;
    steps(f, 3.9);
    expect(v.hp).toBe(hp);
    steps(f, 0.2);
    expect(m.alive).toBe(false);
    expect(hp - v.hp).toBeCloseTo(50 * f.dmgMult);
    expect(c.block).toBeUndefined();
    const g = fight();
    run(g, { p: 'adds', n: 1, add: { ...IMP, name: '폭탄', dmg: 0, job: { p: 'bomb', sec: 4, dmg: 50 } } });
    const b = g.mobs[g.mobs.length - 1];
    damageMob(g, b, b.max);
    const w = dealer(g), hw = w.hp;
    steps(g, 5);
    expect(w.hp).toBe(hw);
  });

  it('보호막 수정: 서 있는 동안 보스가 받는 피해 −90%', () => {
    const f = fight();
    expect(bossTaken(f)).toBe(1);
    run(f, { p: 'adds', n: 1, add: { ...IMP, dmg: 0, job: { p: 'pylon', cut: 0.9 } } });
    expect(bossTaken(f)).toBeCloseTo(0.1);
    const tk = f.party.find(u => u.role === 'tank')!;
    tk.dps = 50;
    const hp = f.bossHp;
    steps(f, 2);
    expect(hp - f.bossHp).toBeGreaterThan(0);
    expect(hp - f.bossHp).toBeCloseTo(tk.dealt * 0.1, 0); // 탱커 딜은 보스로, 그중 10%만 들어감
  });
});

describe('판에 나오는 적 2 (35 3-I): 감옥 · 걸어오는 쫄 · 자폭 쫄 · 큰 쫄 · 쫄 떼', () => {
  const IMP = { name: '꼬마 악마', short: '악마', hp: 0.03, dmg: 20, every: 2 };
  const JAIL: SkillEffect = { p: 'jail', n: 1, name: '심연 감옥', short: '감옥', hp: 0.04, dot: 10 };
  const raid = () => { const f = E.create({ encounter: 'plague', diff: '보통', seed: 1 }); quiet(f); return f; };

  it('감옥: 탱커·나 아닌 1명이 갇힘 (딜 0 · 못 움직임 · 해제 안 됨 · 초당 피해), 칸은 안 차지', () => {
    const f = fight();
    const free = f.cells.filter(c => !c.unit && !c.block).length;
    run(f, JAIL);
    const m = f.mobs.find(x => x.add?.job?.p === 'jail')!;
    const u = f.party.find(x => x.id === m.add!.on)!;
    expect(u.role).not.toBe('tank');
    expect(u.me).toBeFalsy();
    const d = u.debuffs.find(x => x.id === m.add!.hold)!;
    expect(d).toMatchObject({ name: '심연 감옥', noDps: true, noMove: true, lock: true, dot: 10 });
    expect(m.max).toBeCloseTo(f.bossMax * 0.04);
    expect(f.cells.filter(c => !c.unit && !c.block).length).toBe(free);
    const hp = u.hp;
    steps(f, 1);
    expect(hp - u.hp).toBeGreaterThan(0);
  });

  it('감옥을 깨면 풀리고, 갇힌 사람이 쓰러지면 감옥도 사라짐', () => {
    const f = fight();
    run(f, JAIL);
    const m = f.mobs.find(x => x.add?.job?.p === 'jail')!;
    const u = f.party.find(x => x.id === m.add!.on)!;
    damageMob(f, m, m.max);
    E.step(f);
    expect(u.debuffs.some(x => x.name === '심연 감옥')).toBe(false);
    expect(f.events.some(e => e.type === 'cure' && e.id === u.id)).toBe(true);
    const g = fight();
    run(g, JAIL);
    const j = g.mobs.find(x => x.add?.job?.p === 'jail')!;
    const v = g.party.find(x => x.id === j.add!.on)!;
    damage(g, v, 1e9, false, 'fixed');
    steps(g, 0.2);
    expect(j.alive).toBe(false);
  });

  it('일점사 순서: 치유 쫄 → 폭탄 → 감옥 → 보호막 수정 → 그 밖', () => {
    const f = raid();
    run(f, { p: 'adds', n: 1, add: IMP });
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '수정', dmg: 0, job: { p: 'pylon', cut: 0.9 } } });
    run(f, JAIL);
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '폭탄', dmg: 0, job: { p: 'bomb', sec: 99, dmg: 1 } } });
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '치유사', dmg: 0, job: { p: 'mend', every: 99, pct: 0.01 } } });
    expect(focusOrder(f).map(m => m.name)).toEqual(['치유사', '폭탄', '심연 감옥', '수정', '꼬마 악마']);
  });

  it('걸어오는 쫄: 뒷줄에 나와 every초마다 한 줄씩 앞으로, 걸음이 다 되면 흡수 → 보스 피해 +10%씩 (더함)', () => {
    const f = raid();
    const mult = f.dmgMult;
    const MARCH = { ...IMP, name: '진흙 덩이', short: '진흙', dmg: 0, job: { p: 'march' as const, every: 3, boost: 0.1 } };
    run(f, { p: 'adds', n: 1, add: MARCH });
    const m = f.mobs[f.mobs.length - 1];
    const row0 = f.cells[m.add!.cell!].row;
    const freeRows = f.cells.filter(c => (!c.unit && !c.block) || c.i === m.add!.cell).map(c => c.row);
    expect(row0).toBe(Math.max(...freeRows));
    expect(m.add!.steps).toBe(row0 + 1);
    let last = row0;
    for (let k = 1; k <= row0; k++) {
      steps(f, 3);
      const r = f.cells[m.add!.cell!].row;
      expect(r).toBeLessThanOrEqual(last);
      expect(r).toBeGreaterThanOrEqual(row0 - k);
      last = r;
      expect(m.alive).toBe(true);
    }
    steps(f, 3);
    expect(m.alive).toBe(false);
    expect(f.empower).toBeCloseTo(0.1);
    expect(f.dmgMult / mult).toBeCloseTo(1.1);
    run(f, { p: 'adds', n: 1, add: MARCH });
    steps(f, 3 * (f.cells[f.mobs[f.mobs.length - 1].add!.cell!].row + 1) + 0.1);
    expect(f.empower).toBeCloseTo(0.2);
    expect(f.dmgMult / mult).toBeCloseTo(1.2);
    // 잡으면 흡수 안 됨
    const g = raid();
    run(g, { p: 'adds', n: 1, add: MARCH });
    const w = g.mobs[g.mobs.length - 1];
    damageMob(g, w, w.max);
    steps(g, 30);
    expect(g.empower).toBe(0);
  });

  it('자폭 쫄: 노린 사람에게서 떨어져 나와 한 칸씩 다가가고, 붙으면 그 사람 + 이웃 칸 피해', () => {
    const f = raid();
    const FIX = { ...IMP, name: '불씨', short: '불씨', dmg: 0, job: { p: 'fixate' as const, every: 2, dmg: 60, splash: 20 } };
    run(f, { p: 'adds', n: 1, add: FIX });
    const m = f.mobs[f.mobs.length - 1];
    const u = f.party.find(x => x.id === m.add!.on)!;
    expect(u.role).not.toBe('tank');
    u.dps = 0;
    const dist = () => hexDist(f.cells[m.add!.cell!], f.cells[u.cell]);
    const d0 = dist();
    expect(d0).toBeGreaterThanOrEqual(2);
    steps(f, 2.05);
    expect(dist()).toBeLessThanOrEqual(d0);
    const hp = u.hp;
    const nb = f.party.filter(v => v !== u && v.alive && hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
    const nbHp = nb.map(v => v.hp);
    steps(f, 2 * (d0 + 1));
    expect(m.alive).toBe(false);
    expect(hp - u.hp).toBeGreaterThan(0);
    nb.forEach((v, i) => expect(v.hp).toBeLessThan(nbHp[i]));
    // 잡으면 안 터짐
    const g = raid();
    run(g, { p: 'adds', n: 1, add: FIX });
    const x = g.mobs[g.mobs.length - 1];
    const t = g.party.find(y => y.id === x.add!.on)!, th = t.hp;
    damageMob(g, x, x.max);
    steps(g, 12);
    expect(t.hp).toBe(th);
  });

  it('큰 쫄: 부탱커에게 예고(소리) 뒤 강타 (탱커 기준)', () => {
    const f = raid();
    const off = offTank(f)!;
    run(f, { p: 'adds', n: 1, add: { ...IMP, name: '거한', short: '거한', hp: 0.1, dmg: 0, job: { p: 'smash', every: 6, warn: 2, dmg: 300 } } });
    const m = f.mobs[f.mobs.length - 1];
    expect(m.add!.on).toBe(off.id);
    off.hp = off.max;
    let warned = false;
    const end = f.t + 5.9;
    while (f.t < end) { E.step(f); if (f.events.some(e => e.type === 'sound' && e.name === 'buster')) warned = true; f.events.length = 0; }
    expect(warned).toBe(true);
    expect(off.hp).toBe(off.max);
    steps(f, 0.2);
    expect(off.max - off.hp).toBeCloseTo(300 * f.dmgMult);
  });

  it('쫄 떼: 딜러 딜이 떼 모두에게 같이 들어감', () => {
    const f = raid();
    run(f, { p: 'adds', n: 5, add: { ...IMP, name: '해골', short: '해골', hp: 0.005, cleave: true } });
    const swarm = f.mobs.filter(m => m.add?.cleave);
    expect(swarm).toHaveLength(5);
    f.party.forEach(u => { u.dps = 10; });
    steps(f, 1);
    expect(swarm.every(m => m.hp < m.max)).toBe(true);
    steps(f, 20);
    expect(swarm.every(m => !m.alive)).toBe(true);
  });
});

describe('서리 마탑 부품 (35 4-4): 진동 · 숨 고르기 · 커지는 광역 · 마력 역류 · 주시', () => {
  const ally = (f: Fight) => f.party.find(u => u.role === 'melee')!;

  it('진동: 시전 중인 힐이 끊기고 그 스킬이 잠김, 전원 피해. 시간이 지나면 풀림', () => {
    const f = fight();
    const u = ally(f);
    u.hp = u.max * 0.5;
    expect(E.use(f, 'heal', u.cell).ok).toBe(true);
    expect(f.cast?.key).toBe('heal');
    const hp = dealer(f).hp;
    run(f, { p: 'quake', dmg: 40, lock: 3 });
    expect(f.cast).toBeNull();
    expect(f.lock.heal).toEqual({ left: 3, total: 3 });
    expect(hp - dealer(f).hp).toBeCloseTo(40 * f.dmgMult);
    f.gcd = 0;
    const r = E.use(f, 'heal', u.cell);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('잠김');
    expect(E.use(f, 'flash', u.cell).ok).toBe(true); // 다른 스킬은 됨
    steps(f, 3.1);
    expect(f.lock.heal).toBeUndefined();
  });

  it('진동: 찬가(채널)도 끊기고 잠김, 시전 중이 아니면 피해만', () => {
    const f = fight();
    expect(E.use(f, 'hymn', ally(f).cell).ok).toBe(true);
    expect(f.channel).toBeGreaterThan(0);
    run(f, { p: 'quake', dmg: 40, lock: 3 });
    expect(f.channel).toBe(0);
    expect(f.lock.hymn).toBeDefined();
    const g = fight();
    run(g, { p: 'quake', dmg: 40, lock: 3 });
    expect(Object.keys(g.lock)).toHaveLength(0);
  });

  it('진동 기술은 예고에 quake 표시 (휠 떨림)', () => {
    const f = fight();
    const s = fromDef(f, { key: 'rune', name: '룬 진동', kind: 'aoe', first: 0, period: 15, cast: 2, effect: { p: 'quake', dmg: 40, lock: 3 } });
    expect(s.quake).toBe(true);
    steps(f, 0.1);
    expect(f.tels.some(t => t.skill.quake)).toBe(true);
  });

  it('숨 고르기: 보스가 쉬고 (체력바 이름), 그 이름의 디버프가 모두 사라짐', () => {
    const f = fight();
    const tk = f.party.find(u => u.role === 'tank')!;
    const FROST: DebuffDef = { name: '서리', type: '마법', left: 99, healCut: 0.1, stackMax: 5 };
    applyDebuff(f, tk, FROST); applyDebuff(f, tk, FROST);
    expect(tk.debuffs.find(d => d.name === '서리')!.stack).toBe(2);
    runEffect(f, { name: '숨 고르기', st: {} } as unknown as BossSkill, { p: 'rest', sec: 6, clear: '서리' });
    expect(f.daze).toMatchObject({ until: f.t + 6, vuln: 1, name: '숨 고르기' });
    expect(tk.debuffs.some(d => d.name === '서리')).toBe(false);
    const auto = f.skills.find(s => s.key === 'auto')!;
    auto.next = f.t;
    const hp = tk.hp;
    steps(f, 5.9);
    expect(tk.hp).toBe(hp);
  });

  it('커지는 광역: 쓸 때마다 grow만큼 더 아픔', () => {
    const f = fight();
    const s = fromDef(f, { key: 'core', first: Infinity, period: 60, cast: 0, effect: { p: 'all', dmg: 100, grow: 30 } });
    const v = dealer(f);
    const hits: number[] = [];
    for (let i = 0; i < 3; i++) { v.hp = v.max; s.fire!(f); hits.push(v.max - v.hp); }
    expect(hits[1] - hits[0]).toBeCloseTo(30 * f.dmgMult);
    expect(hits[2] - hits[1]).toBeCloseTo(30 * f.dmgMult);
  });

  it('마력 역류: 스킬이 나갈 때마다 1중첩, 끝나면 중첩 × 피해', () => {
    const f = fight();
    const RECOIL: DebuffDef = { name: '마력 역류', type: '마법', left: 10, count: true, end: { p: 'stackHit', dmg: 30 } };
    const d = applyDebuff(f, f.me, RECOIL)!;
    expect(d.stack).toBe(0);
    for (const u of [ally(f), dealer(f)]) { f.gcd = 0; expect(E.use(f, 'renew', u.cell).ok).toBe(true); } // 즉시 스킬 2번
    expect(d.stack).toBe(2);
    f.me.hp = f.me.max;
    steps(f, 10.1);
    expect(f.me.debuffs.includes(d)).toBe(false);
    expect(f.me.max - f.me.hp).toBeGreaterThanOrEqual(60 * f.dmgMult - 1);
  });

  it('마력 역류: 지우면 그때까지 중첩만큼 바로 터지고, 지운 그 한 번은 안 셈', () => {
    const f = fight();
    const RECOIL: DebuffDef = { name: '마력 역류', type: '마법', left: 10, count: true, end: { p: 'stackHit', dmg: 30 } };
    const d = applyDebuff(f, f.me, RECOIL)!;
    f.gcd = 0; E.use(f, 'renew', ally(f).cell);
    expect(d.stack).toBe(1);
    f.me.hp = f.me.max;
    f.gcd = 0;
    expect(E.use(f, 'purify', f.me.cell).ok).toBe(true);
    expect(f.me.debuffs.includes(d)).toBe(false);
    expect(f.me.max - f.me.hp).toBeCloseTo(30 * f.dmgMult);
    // 0중첩에 지우면 피해 없음
    const g = fight();
    applyDebuff(g, g.me, RECOIL);
    g.me.hp = g.me.max;
    expect(E.use(g, 'purify', g.me.cell).ok).toBe(true);
    expect(g.me.hp).toBe(g.me.max);
  });

  it('주시: 넣은 치유(넘친 치유 포함)로 게이지가 차고, 가득 차면 보스가 sec초 동안 나를 every초마다 때림', () => {
    const f = fight();
    watchInit(f, { cap: 0.5, sec: 6, every: 1.5, dmg: 50 });
    const w = f.watch!;
    expect(w.max).toBeCloseTo(f.party.reduce((a, u) => a + u.max, 0) * 0.5);
    const tk = f.party.find(u => u.role === 'tank')!;
    tk.hp = tk.max;
    heal(f, tk, w.max * 0.6, true, true); // 전부 넘친 치유여도 참
    expect(w.fill).toBeCloseTo(w.max * 0.6);
    heal(f, tk, w.max * 0.5, true, true);
    f.me.hp = f.me.max;
    steps(f, 0.05);
    expect(w.until).toBeCloseTo(f.t + 6, 0);
    expect(w.fill).toBe(0);
    steps(f, 6);
    const lost = f.me.max - f.me.hp;
    expect(lost).toBeGreaterThan(3.5 * 50 * f.dmgMult);
    expect(lost).toBeLessThan(4.5 * 50 * f.dmgMult + 1);
    // 노리는 동안은 게이지가 안 참
    const g = fight();
    watchInit(g, { cap: 0.5, sec: 6, every: 1.5, dmg: 50 });
    g.watch!.until = g.t + 5;
    heal(g, g.party[0], 999, true, true);
    expect(g.watch!.fill).toBe(0);
  });

  it('주시: 도발 능력이 있는 파티원이 있으면 tauntSec, 악몽은 게이지가 mythicRate배', () => {
    const f = E.create({ encounter: 'warden', diff: '악몽', seed: 1, party: E.recruitParty('warden', 1, { abilities: true }) });
    const hasTaunt = f.abOn && f.party.some(u => u.ab && ['taunt', 'wrath'].includes(u.ab.key));
    watchInit(f, { cap: 1, sec: 6, tauntSec: 3, every: 1.5, dmg: 50, mythicRate: 1.3 });
    expect(f.watch!.rate).toBe(1.3);
    expect(f.watch!.sec).toBe(hasTaunt ? 3 : 6);
  });

  it('판 위 쫄도 파티원 도발에 끌려감', () => {
    const f = fight();
    run(f, { p: 'adds', n: 1, add: { name: '꼬마 악마', short: '악마', hp: 0.03, dmg: 20, every: 2 } });
    const m = f.mobs[f.mobs.length - 1];
    const tk = f.party.find(u => u.role === 'tank')!;
    expect(m.add!.on).not.toBe(tk.id);
    f.ab.taunt = tk.id; f.ab.tauntUntil = f.t + 10;
    tk.hp = tk.max;
    const on = f.party.find(u => u.id === m.add!.on)!, hp = on.hp;
    steps(f, 2.1);
    expect(tk.hp).toBeLessThan(tk.max);
    expect(on.hp).toBe(hp);
  });
});

describe('깨진 신전 부품 (35 4-5): 무력화 · 반격 틈 · 받침 · 청소약', () => {
  const STAG: SkillEffect = { p: 'stagger', sec: 10, need: 4, hp: 0.7, tank: 2, win: { sec: 8, vuln: 1.3 }, fail: { dmg: 100, lock: 3 } };

  it('무력화: 체력 70% 이상인 파티원 딜로 게이지가 차면 보스 무방비 (기술 쉼, 받는 피해 +30%)', () => {
    const f = fight();
    f.party.forEach(u => { if (!u.me) u.dps = 20; u.hp = u.max; });
    run(f, STAG);
    const g = f.stagger!;
    expect(g.need).toBeGreaterThan(0);
    steps(f, 9.5);
    expect(f.stagger).toBeNull();
    expect(f.daze).toMatchObject({ vuln: 1.3, name: '무방비' });
  });

  it('무력화: 체력이 기준 아래인 사람 딜은 안 셈 → 못 채우면 전원 피해 + 시전 스킬 잠김', () => {
    const f = fight();
    f.party.forEach(u => { if (!u.me) { u.dps = 20; u.hp = u.max * 0.5; } });
    run(f, STAG);
    steps(f, 5);
    expect(f.stagger!.fill).toBe(0);
    const v = dealer(f), hp = v.hp;
    steps(f, 5.1);
    expect(f.stagger).toBeNull();
    expect(f.daze).toBeNull();
    expect(hp - v.hp).toBeGreaterThanOrEqual(100 * f.dmgMult * 0.99);
    expect(f.lock.heal).toBeDefined(); // 치유는 시전 스킬
    expect(f.lock.renew).toBeUndefined(); // 소생은 즉시
  });

  it('반격 틈: 끊기 가능 기술이 되고, 끊으면 보스 기절. 못 끊으면 앞줄만 맞음', () => {
    const f = fight();
    const s = fromDef(f, { key: 'gleam', name: '수정 반짝임', kind: 'aoe', first: 0, period: 25, cast: 1.5, effect: { p: 'counter', stun: 4, dmg: 200 } });
    expect(s.cut).toBe(true);
    expect(s.stunOnCut).toBe(4);
    // 끊기 능력 없는 파티: 맞을 때 앞줄 (판 앞쪽 3분의 1)만
    const front = f.party.filter(u => zoneOf(f, f.cells[u.cell].row) === 'front' && !u.me), back = f.party.filter(u => zoneOf(f, f.cells[u.cell].row) !== 'front');
    const hp0 = f.party.map(u => u.hp);
    steps(f, 1.6);
    expect(front.length).toBeGreaterThan(0);
    front.forEach(u => expect(u.hp).toBeLessThan(hp0[f.party.indexOf(u)]));
    back.forEach(u => expect(u.hp).toBe(hp0[f.party.indexOf(u)]));
  });

  it('반격 틈: 끊기 능력자가 끊으면 기절, 침묵(딜 0)이면 못 끊음', () => {
    const mk = (silenced: boolean) => {
      const f = fight();
      f.abOn = true;
      const u = dealer(f);
      const kick = Object.values(ABILITIES).find(a => a.fx.e === 'interrupt')!;
      u.ab = { key: kick.key, star: 5, ready: 0, uses: 0, fired: [], hist: [], lastCounter: 0 };
      if (silenced) u.debuffs.push({ id: 900, name: '돌가루', type: '마법', left: 6, noDps: true });
      f.rng = () => 0;
      const s = fromDef(f, { key: 'gleam', name: '수정 반짝임', kind: 'aoe', first: 0, period: 25, cast: 1.5, effect: { p: 'counter', stun: 4, dmg: 200 } });
      s.next = f.t;
      E.step(f);
      return f;
    };
    expect(mk(false).daze).toMatchObject({ name: '기절' });
    expect(mk(true).daze).toBeNull();
  });

  it('받침: 빈 칸에 금빛 발판, 갈 수 있는 사람이 들어가 맞고, 빈 발판은 전원 피해', () => {
    const f = fight();
    const s = fromDef(f, { key: 'pads', name: '제단 발판', kind: 'aoe', first: 0, period: 30, cast: 2.5, effect: { p: 'tower', n: 2, dmg: 120, empty: 60 } });
    expect(s.pads).toBe(true);
    s.next = f.t; E.step(f);
    const tel = f.tels.find(t => t.skill === s)!;
    expect(tel.cells.size).toBe(2);
    expect([...tel.safe!]).toEqual([...tel.cells]);
    const go = f.party.filter(u => u.padUntil != null);
    expect(go.length).toBe(2);
    expect(go.every(u => u.role !== 'tank' && !u.me && u.pers !== '겁쟁이')).toBe(true);
    go.forEach(u => { u.hp = u.max; });
    steps(f, 2.6);
    go.forEach(u => expect(u.hp).toBeLessThan(u.max));
    expect(f.party.every(u => u.padUntil == null)).toBe(true);
    // 아무도 안 가면 (모두 겁쟁이) 빈 발판 2개 = 전원 피해 2번
    const g = fight();
    g.party.forEach(u => { u.pers = '겁쟁이'; });
    const t = fromDef(g, { key: 'pads', name: '제단 발판', kind: 'aoe', first: 0, period: 30, cast: 2.5, effect: { p: 'tower', n: 2, dmg: 120, empty: 60 } });
    t.next = g.t;
    const v = dealer(g), hp = v.hp;
    steps(g, 2.6);
    expect(hp - v.hp).toBeCloseTo(120 * g.dmgMult);
  });

  it('청소약: 쓸 때마다 다음 디버프 (질병 → 독 → 저주 → 마법)', () => {
    const f = fight();
    const types = ['질병', '독', '저주', '마법'];
    const s = fromDef(f, { key: 'soap', first: Infinity, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: types.map(t => ({ name: `${t} 청소약`, type: t, left: 8, dot: 5 })) } });
    const got: string[] = [];
    for (let i = 0; i < 4; i++) { s.fire!(f); got.push(f.party.flatMap(u => u.debuffs).sort((a, b) => b.id - a.id)[0].type); }
    expect(got).toEqual(types);
  });
});

describe('디버프 부품 2 (35 3장): 마나 갈취 · 매혹 · 옮겨붙음', () => {
  it('마나 갈취: 표식은 내 마나 초당 -drain (지우면 멈춤), 쫄은 살아 있는 동안', () => {
    const f = fight();
    f.mana = 80;
    const d = applyDebuff(f, f.me, { name: '마나 흡수', type: '마법', left: 20, drain: 2 })!;
    const regen = (() => { const g = fight(); g.mana = 80; steps(g, 5); return g.mana - 80; })();
    steps(f, 5);
    expect(f.mana).toBeCloseTo(80 + regen - 10, 0);
    f.me.debuffs = f.me.debuffs.filter(x => x !== d);
    const g = fight();
    g.mana = 80;
    run(g, { p: 'adds', n: 1, add: { name: '마나 공허', short: '공허', hp: 0.03, dmg: 0, every: 9, job: { p: 'drain', pct: 3 } } });
    steps(g, 5);
    expect(g.mana).toBeCloseTo(80 + regen - 15, 0);
    expect(focusOrder(g)[0].name).toBe('마나 공허');
  });

  it('매혹: 딜 0, 이웃 칸 아군을 때림, 힐하면 길어지고 체력 50% 아래면 풀림', () => {
    const f = fight();
    const u = dealer(f);
    const d = applyDebuff(f, u, { name: '매혹', type: '마법', left: 8, noDps: true, charm: { every: 2, dmg: 40, heal: 1, free: 0.5 } })!;
    const at = f.cells[u.cell];
    const near = f.party.filter(v => v !== u && hexDist(f.cells[v.cell], at) === 1);
    f.party.forEach(v => { v.hp = v.max; });
    steps(f, 2.05);
    near.forEach(v => expect(v.hp).toBeLessThan(v.max));
    const left = d.left;
    heal(f, u, 10, true, true);
    expect(d.left).toBeCloseTo(left + 1);
    u.hp = u.max * 0.4;
    E.step(f);
    expect(u.debuffs.includes(d)).toBe(false);
  });

  it('옮겨붙음: 지우면 이웃 칸 1명에게 더 세게, 혼자면 사라짐, 시간이 다 되면 보스 강해짐', () => {
    const PLAGUE: DebuffDef = { name: '괴저 역병', type: '질병', left: 10, dot: 10, end: { p: 'jump', sec: 10, mult: 1.5, boost: 0.05 } };
    const f = fight();
    const u = f.party.find(v => !v.me && f.party.some(w => w !== v && hexDist(f.cells[w.cell], f.cells[v.cell]) === 1))!;
    applyDebuff(f, u, PLAGUE);
    doDispel(f, u);
    const moved = f.party.filter(v => v.debuffs.some(d => d.name === '괴저 역병'));
    expect(moved).toHaveLength(1);
    expect(moved[0]).not.toBe(u);
    expect(hexDist(f.cells[moved[0].cell], f.cells[u.cell])).toBe(1);
    expect(moved[0].debuffs.find(d => d.name === '괴저 역병')!.dot).toBeCloseTo(15);
    // 이웃이 없으면 사라짐
    const g = fight();
    const v = dealer(g);
    for (const w of g.party) if (w !== v && hexDist(g.cells[w.cell], g.cells[v.cell]) === 1) { const far = g.cells.find(c => !c.unit && !c.block && hexDist(c, g.cells[v.cell]) > 1)!; g.cells[w.cell].unit = null; far.unit = w; w.cell = far.i; w.home = far.i; }
    applyDebuff(g, v, PLAGUE);
    doDispel(g, v);
    expect(g.party.some(w => w.debuffs.some(d => d.name === '괴저 역병'))).toBe(false);
    // 시간이 다 되면 보스 +5%
    const h = fight();
    const mult = h.dmgMult;
    applyDebuff(h, dealer(h), { ...PLAGUE, left: 1 });
    steps(h, 1.1);
    expect(h.empower).toBeCloseTo(0.05);
    expect(h.dmgMult / mult).toBeCloseTo(1.05);
  });
});

describe('부품 10 (35 3장·4-7): 헤매는 영혼 · 생명 사슬 · 넘치는 빛', () => {
  const SPIRIT: SkillEffect = {
    p: 'soul', name: '오염된 늪 정령', short: '정령', hp: 0.25, sec: 12, type: '질병',
    win: { text: '정화의 물', cure: '독', heal: { pct: 0.15, sec: 8 } },
    fail: { text: '오염 분출', dmg: 180, near: true, debuff: { name: '늪독', type: '독', left: 10, dot: 5 } },
  };

  it('영혼: 빈 칸에 나오고 파티원이 아님. 칸 탭으로 단일 힐만, 가득 채우면 축복', () => {
    const f = fight();
    const free0 = f.cells.filter(c => !c.unit && !c.block).length;
    run(f, SPIRIT);
    expect(f.souls).toHaveLength(1);
    const s = f.souls[0];
    expect(f.party.includes(s)).toBe(false);
    expect(f.cells[s.cell].block).toBe('soul');
    expect(f.cells.filter(c => !c.unit && !c.block).length).toBe(free0 - 1);
    expect(s.hp / s.max).toBeCloseTo(0.25);
    expect(E.canTarget(f, 'heal', s.cell).ok).toBe(true);
    expect(E.canTarget(f, 'renew', s.cell).ok).toBe(true);
    expect(E.canTarget(f, 'poh', s.cell).ok).toBe(false);
    // 소생(지속 힐)도 영혼에서 틱이 돎
    E.use(f, 'renew', s.cell);
    const hp0 = s.hp;
    steps(f, 3.05);
    expect(s.hp).toBeGreaterThan(hp0);
    // 독 하나씩 지움 + 받는 치유 +15%
    const u = dealer(f);
    applyDebuff(f, u, { name: '독침', type: '독', left: 20, dot: 1 });
    heal(f, s, s.max, true, true);
    E.step(f);
    expect(f.souls).toHaveLength(0);
    expect(f.cells[s.cell].block).toBeUndefined();
    expect(u.debuffs.some(d => d.name === '독침')).toBe(false);
    u.hp = u.max / 2;
    expect(heal(f, u, 50, false, true)).toBeCloseTo(57.5);
    steps(f, 8);
    expect(f.bless).toBeNull();
  });

  it('영혼: 유형이 맞는 해제는 바로 성공, 못 채우면 이웃 칸 피해 + 디버프', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, level: 10 });
    quiet(f);
    run(f, SPIRIT);
    const s = f.souls[0];
    expect(E.use(f, 'purify', s.cell).ok).toBe(true);
    E.step(f);
    expect(f.souls).toHaveLength(0);
    // 시간이 다 되면 이웃 칸만
    const g = fight();
    run(g, SPIRIT);
    const t = g.souls[0], at = g.cells[t.cell];
    g.party.forEach(v => { v.hp = v.max; });
    steps(g, 12.1);
    expect(g.souls).toHaveLength(0);
    for (const v of g.party) {
      const near = hexDist(g.cells[v.cell], at) === 1;
      expect(v.debuffs.some(d => d.name === '늪독')).toBe(near);
    }
  });

  it('영혼: 보스 피해 감소 축복은 시간이 다 되면 되돌아옴', () => {
    const f = fight();
    const m0 = f.dmgMult;
    run(f, { p: 'soul', name: '꼬마 오토의 기억', short: '오토', hp: 0.3, sec: 10, win: { text: '기분이 풀림', weak: { pct: 0.25, sec: 10 } }, fail: { text: '전원 피해', dmg: 90 } });
    heal(f, f.souls[0], 1e6, true, true);
    E.step(f);
    expect(f.dmgMult / m0).toBeCloseTo(0.75);
    steps(f, 10.1);
    expect(f.dmgMult / m0).toBeCloseTo(1);
    expect(f.weak).toBeNull();
  });

  it('생명 사슬 균형형: 체력 비율 차이가 30%p를 넘으면 끊어지며 둘 다 피해 (걸린 뒤 2초는 안 끊어짐)', () => {
    const f = fight();
    f.party.forEach(v => { v.hp = v.max; });
    run(f, { p: 'link', kind: 'balance', name: '저주 실', sec: 12, gap: 0.3, dmg: 100 });
    expect(f.links).toHaveLength(1);
    const l = f.links[0];
    const a = f.party.find(v => v.id === l.a)!, b = f.party.find(v => v.id === l.b)!;
    expect(a.role).not.toBe('tank');
    expect(a.debuffs.some(d => d.link?.to === b.id)).toBe(true);
    a.hp = a.max * 0.6;
    steps(f, 1);
    expect(f.links).toHaveLength(1);
    const hb = b.hp;
    steps(f, 1.1);
    expect(f.links).toHaveLength(0);
    expect(b.hp).toBeLessThan(hb);
    expect(a.debuffs.some(d => d.link) || b.debuffs.some(d => d.link)).toBe(false);
    // 시간이 다 되면 그냥 풀림
    const g = fight();
    run(g, { p: 'link', kind: 'balance', name: '자매의 실', sec: 4, pick: 'tanks', dmg: 100, aim: 'tank' });
    // 5인은 탱커가 하나라 두 탱커 사슬 대신 탱커 아닌 둘
    expect(g.party.filter(v => v.debuffs.some(d => d.link)).map(v => v.role)).not.toContain('tank');
    steps(g, 4.1);
    expect(g.links).toHaveLength(0);
    expect(g.party.some(v => v.debuffs.some(d => d.link))).toBe(false);
    // 10인은 두 탱커
    const r = E.create({ encounter: 'plague', diff: '보통', seed: 1 });
    quiet(r);
    run(r, { p: 'link', kind: 'balance', name: '자매의 실', sec: 4, pick: 'tanks', dmg: 100, aim: 'tank' });
    expect(r.party.filter(v => v.debuffs.some(d => d.link)).map(v => v.role)).toEqual(['tank', 'tank']);
  });

  it('생명 사슬 나눔형: 받는 피해·치유를 반씩 나눔', () => {
    const f = fight();
    f.armor = false;
    run(f, { p: 'link', kind: 'share', name: '가문의 사슬', sec: 10 });
    const l = f.links[0];
    const a = f.party.find(v => v.id === l.a)!, b = f.party.find(v => v.id === l.b)!;
    a.hp = a.max; b.hp = b.max;
    damage(f, a, 200, true);
    expect(a.max - a.hp).toBeCloseTo(100 * f.dmgMult);
    expect(b.max - b.hp).toBeCloseTo(100 * f.dmgMult);
    const ha = a.hp, hb = b.hp;
    heal(f, a, 50, true, true);
    expect(a.hp - ha).toBeCloseTo(25);
    expect(b.hp - hb).toBeCloseTo(25);
  });

  it('넘치는 빛: 그릇은 넘친 치유로 차서 전원 보호막, 과부하 표식은 넘친 만큼 이웃 피해', () => {
    const f = fight();
    run(f, { p: 'vessel', name: '백합 꽃병', need: 0.1, sec: 15, shield: 6 });
    const need = f.vessel!.need;
    const u = dealer(f);
    u.hp = u.max;
    heal(f, u, need / 2, true, true);
    expect(f.vessel!.fill).toBeCloseTo(need / 2);
    heal(f, u, need / 2, true, true);
    E.step(f);
    expect(f.vessel).toBeNull();
    expect(f.party.every(v => v.shield > 5)).toBe(true);
    // 과부하: 넘친 치유 × over
    const g = fight();
    const v = g.party.find(x => !x.me && g.party.some(w => w !== x && hexDist(g.cells[w.cell], g.cells[x.cell]) === 1))!;
    const near = g.party.filter(w => w !== v && hexDist(g.cells[w.cell], g.cells[v.cell]) === 1);
    g.party.forEach(w => { w.hp = w.max; });
    applyDebuff(g, v, { name: '넘치는 빛', type: '마법', left: 10, lock: true, over: 0.5 });
    v.hp = v.max - 40;
    heal(g, v, 140, true, true);
    for (const w of near) expect(w.max - w.hp).toBeCloseTo(50, 0);
  });
});
