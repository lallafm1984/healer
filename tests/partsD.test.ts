/** 묶음 D 새 부품 (51 5장): 보물 욕심 · 녹는 보호막 · 부화하는 알, 자동 힐러 대응 */
import { describe, expect, it } from 'vitest';
import { BOSSES, type AddDef, type SkillDef, type SkillEffect } from '../src/data/bosses';
import * as E from '../src/engine';
import { autoHealer } from '../src/engine/auto';
import { aggroTarget, applyDebuff, focusOrder, greedTargets, runEffect } from '../src/engine/bossParts';
import { fromDef } from '../src/engine/bosses';
import type { BossSkill, Fight } from '../src/engine';

const steps = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const fight = (hero: 'priest' | 'druid' | 'paladin' = 'priest', encounter: E.FightConfig['encounter'] = 'plague') => {
  const f = E.create({ encounter, diff: '보통', seed: 1, hero }); quiet(f); return f;
};
const skill = { name: '김 서린 수건', st: {} } as unknown as BossSkill;
const run = (f: Fight, e: SkillEffect) => runEffect(f, skill, e);
const BOSS_KEYS = (k: keyof typeof BOSSES) => BOSSES[k].skills.map(s => s.key);

const GREED: SkillDef = { key: 'greed', name: '반짝이 내놔!', icon: '반짝', kind: 'buster', first: 1, period: 99, cast: 2.5, warn: 'buster', target: { p: 'greed', n: 1, nMythic: 2 },
  effect: { p: 'greed', dmg: 270, debuff: { name: '무거운 주머니', type: '물리', left: 8, vuln: 0.15 } } };
const EGG: AddDef = { name: '굴러온 알', short: '알', hp: 0.02, dmg: 0, every: 0, at: 'random',
  job: { p: 'hatch', sec: 12, add: { name: '새끼 용', short: '새끼', hp: 0.03, dmg: 40, every: 2 } } };

describe('보물 욕심 (P-GREED)', () => {
  it('체력 비율이 가장 높은 탱커 · 나 아닌 사람을 고름 (1%p 안은 같은 것으로 보고 무작위)', () => {
    const f = fight();
    const others = f.party.filter(u => u.role !== 'tank' && !u.me);
    others.forEach((u, i) => { u.hp = u.max * (0.5 + i * 0.01); });
    const top = others[others.length - 1];
    expect(greedTargets(f, 1)).toEqual([top]);
    // 탱커 · 나는 가득 차 있어도 안 고름
    for (const u of f.party) if (u.role === 'tank' || u.me) u.hp = u.max;
    expect(greedTargets(f, 1)[0].role).not.toBe('tank');
    expect(greedTargets(f, 1)[0].me).toBe(false);
    // 모두 가득이면 여러 번 고를 때 한 사람만 나오지 않음
    others.forEach(u => { u.hp = u.max; });
    const seen = new Set<number>();
    for (let i = 0; i < 30; i++) seen.add(greedTargets(f, 1)[0].id);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('예고 때 정해진 사람이 맞음 (그 뒤에 더 건강한 사람이 생겨도) · 맞은 사람에게 디버프', () => {
    const f = fight();
    const others = f.party.filter(u => u.role !== 'tank' && !u.me);
    others.forEach(u => { u.hp = u.max * 0.6; });
    const top = others[0];
    top.hp = top.max;
    fromDef(f, GREED);
    steps(f, 1.1);
    const tel = f.tels.find(t => t.skill.key === 'greed')!;
    expect(tel.units).toEqual([top.id]);
    expect(tel.skill.greed).toBe(270);
    others[1].hp = others[1].max; top.hp = top.max * 0.95;
    const hp0 = top.hp, hp1 = others[1].hp;
    steps(f, 2.6);
    expect(top.hp).toBeLessThan(hp0 * 0.85);
    expect(others[1].hp).toBeCloseTo(hp1, 0);
    expect(top.debuffs.some(d => d.name === '무거운 주머니')).toBe(true);
  });

  it('악몽은 nMythic명', () => {
    const f = fight();
    f.mythic = true;
    fromDef(f, GREED);
    steps(f, 1.1);
    expect(f.tels.find(t => t.skill.key === 'greed')!.units.length).toBe(2);
  });
});

describe('녹는 보호막 (P-MELT)', () => {
  it('열기 동안 흡수 보호막이 초마다 남은 양의 rate씩 녹고, 보호막 · 외부 생존기 시간이 두 배로 줄어듦', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'ranged')!;
    u.mods.push({ k: 'absorb', v: 100, until: f.t + 30, src: 'test' });
    u.guardian = 20; u.shield = 8; u.sacr = 12; u.redu = 12; u.reduCut = 0.2;
    run(f, { p: 'melt', sec: 8, rate: 0.25 });
    expect(f.melt).toMatchObject({ name: '김 서린 수건', rate: 0.25 });
    steps(f, 2);
    expect(u.mods.find(m => m.k === 'absorb')!.v).toBeCloseTo(100 * 0.75 ** 2, 0);
    expect(u.guardian).toBeCloseTo(16, 1);
    expect(u.shield).toBeCloseTo(4, 1);
    expect(u.sacr).toBeCloseTo(8, 1);
    expect(u.redu).toBeCloseTo(8, 1);
    steps(f, 6.2);
    const g = u.guardian;
    steps(f, 1);
    expect(g - u.guardian).toBeCloseTo(1, 1); // 열기가 끝나면 원래 빠르기
  });

  it('성역 피해 감소 (안에 있으면 틱마다 다시 참)는 안 녹음', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'ranged')!;
    run(f, { p: 'melt', sec: 8, rate: 0.25 });
    for (let i = 0; i < 20; i++) { u.redu = Math.max(u.redu, E.DT * 2); E.step(f); f.events.length = 0; }
    expect(u.redu).toBeGreaterThan(0);
  });

  it('자동 힐러는 열기 중 외부 생존기를 맞기 1.5초 안에만 씀', () => {
    const f = fight('priest');
    f.level = 20; f.mana = 100; f.cd.guardian = 0;
    const tk = f.party.find(x => x.role === 'tank')!;
    tk.hp = tk.max * 0.6;
    run(f, { p: 'melt', sec: 10, rate: 0.25 });
    const buster = fromDef(f, { key: 'bust', name: '꼬리 철썩', kind: 'buster', first: 0, period: 99, cast: 3, warn: 'buster', dmg: 500, target: 'tank', effect: { p: 'tank' } });
    E.step(f); f.events.length = 0;
    expect(f.tels.some(t => t.skill === buster)).toBe(true);
    autoHealer(f);
    expect(tk.guardian).toBe(0);
    f.cast = null; f.gcd = 0; f.queued = null;
    steps(f, 1.6);
    tk.hp = tk.max * 0.6;
    f.cast = null; f.gcd = 0; f.queued = null;
    autoHealer(f);
    expect(tk.guardian).toBeGreaterThan(0);
  });
});

describe('부화하는 알 (판 위 적 + 시간 제한)', () => {
  it('시간 안에 못 깨면 그 칸에서 새끼가 나오고, 깨면 안 나옴. 딜러는 폭탄처럼 먼저 잡음', () => {
    const f = fight('priest', 'mimic');
    run(f, { p: 'adds', n: 1, add: EGG });
    const egg = f.mobs.find(m => m.name === '굴러온 알')!;
    const cell = egg.add!.cell!;
    expect(focusOrder(f)[0]).toBe(egg);
    steps(f, 12.1);
    expect(egg.alive).toBe(false);
    const chick = f.mobs.find(m => m.name === '새끼 용')!;
    expect(chick.alive).toBe(true);
    expect(chick.add!.cell).toBe(cell);
    expect(f.cells[cell].block).toBe('add');

    const g = fight('priest', 'mimic');
    run(g, { p: 'adds', n: 1, add: EGG });
    const egg2 = g.mobs.find(m => m.name === '굴러온 알')!;
    egg2.hp = 0; egg2.alive = false;
    steps(g, 13);
    expect(g.mobs.some(m => m.name === '새끼 용')).toBe(false);
  });
});

describe('5인 대신 맞기 (달군 쇠)', () => {
  it('탱커가 하나뿐이면 중첩이 가득 찰 때 근접 딜러가 sub초 보스를 받고 탱커 디버프가 풀림', () => {
    const f = fight('priest', 'warden');
    const tk = f.party.find(u => u.role === 'tank')!;
    const def = { name: '달군 쇠', type: '물리' as const, left: 20, lock: true, stackMax: 4, vuln: 0.15, swap: 4, sub: 6 };
    for (let i = 0; i < 3; i++) applyDebuff(f, tk, def);
    expect(aggroTarget(f)).toBe(tk);
    applyDebuff(f, tk, def);
    const st = aggroTarget(f)!;
    expect(st.role).toBe('melee');
    expect(tk.debuffs.some(d => d.name === '달군 쇠')).toBe(false);
    steps(f, 5.9);
    expect(aggroTarget(f)).toBe(st);
    steps(f, 0.2);
    expect(aggroTarget(f)).toBe(tk);
    // 탱커가 둘이면 원래 교대
    const g = fight();
    const [a, b] = g.party.filter(u => u.role === 'tank');
    for (let i = 0; i < 4; i++) applyDebuff(g, a, def);
    expect(aggroTarget(g)).toBe(b);
    expect(g.sub).toBeNull();
  });
});

describe('묶음 D1 판 조각', () => {
  it('금화 더미: 15초 안에 못 깨면 보스가 주워 피해 +20% (겹침), 깨면 그대로', () => {
    const f = fight('priest', 'mimic');
    const HOARD: AddDef = { name: '금화 더미', short: '금화', hp: 0.02, dmg: 0, every: 0, at: 'random', job: { p: 'hoard', sec: 15, boost: 0.2 } };
    const m0 = f.dmgMult;
    run(f, { p: 'adds', n: 1, add: HOARD });
    expect(focusOrder(f)[0].name).toBe('금화 더미');
    steps(f, 15.1);
    expect(f.mobs.some(m => m.alive && m.name === '금화 더미')).toBe(false);
    expect(f.dmgMult / m0).toBeCloseTo(1.2, 6);
    run(f, { p: 'adds', n: 1, add: HOARD });
    const pile = f.mobs.find(m => m.alive && m.name === '금화 더미')!;
    pile.hp = 0; pile.alive = false;
    steps(f, 16);
    expect(f.dmgMult / m0).toBeCloseTo(1.2, 6);
  });

  it('줄 불길: 맞은 줄 사람에게 불씨 (받는 치유 −25%)', () => {
    const f = E.create({ encounter: 'bulttung', diff: '보통', seed: 2 }); quiet(f);
    const s = f.bs.fire0; s.next = f.t;
    E.step(f); f.events.length = 0;
    const tel = f.tels.find(t => t.skill === s)!;
    const inRow = f.party.filter(u => tel.cells.has(u.cell));
    expect(inRow.length).toBeGreaterThan(0);
    steps(f, 3.1);
    for (const u of inRow) if (u.alive) expect(u.debuffs.find(d => d.name === '불씨')?.healCut).toBe(0.25);
    expect(f.party.filter(u => !inRow.includes(u)).some(u => u.debuffs.some(d => d.name === '불씨'))).toBe(false);
  });

  it('보물 수레: 세로 줄을 1초마다 한 줄씩 훑고 (못 피함), 악몽은 돌아오며 한 번 더', () => {
    const f = E.create({ encounter: 'deolkeong', diff: '보통', seed: 2 }); quiet(f);
    const s = f.bs.cart; s.next = f.t;
    E.step(f);
    const cols = new Set<number>();
    for (let i = 0; i < 400 && (i < 2 || f.tels.some(t => t.skill === s)); i++) {
      for (const t of f.tels) if (t.skill === s) cols.add(f.cells[[...t.cells][0]].col);
      E.step(f);
    }
    expect(cols.size).toBe(new Set(f.cells.map(c => c.col)).size);
    expect(f.party.some(u => u.moving)).toBe(false);
    expect(BOSS_KEYS('deolkeong')).toContain('cartm');
  });
});
