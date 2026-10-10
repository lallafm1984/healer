/** 묶음 B 새 부품 (46 5장): 부풀기 · 치유 상한 · 뒤집힘 저주 · 일반 구간 적이 쓰러질 때 · 사슬 짝 고르기, 자동 힐러 대응 */
import { describe, expect, it } from 'vitest';
import type { DebuffDef, SkillEffect } from '../src/data/bosses';
import * as E from '../src/engine';
import { applyDebuff, runEffect } from '../src/engine/bossParts';
import { autoHealer } from '../src/engine/auto';
import { hexDist } from '../src/engine/board';
import { damageMob, heal, healTop } from '../src/engine/core';
import { doDispel } from '../src/engine/heroes';
import type { BossSkill, Fight, Unit } from '../src/engine';

const steps = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const fight = (hero: 'priest' | 'druid' | 'paladin' = 'druid', encounter: E.FightConfig['encounter'] = 'plague') => {
  const f = E.create({ encounter, diff: '보통', seed: 1, hero }); quiet(f); return f;
};
const run = (f: Fight, e: SkillEffect) => runEffect(f, {} as BossSkill, e);
/** u 옆 칸에 vs를 세우고 나머지는 u에게서 떨어뜨림 */
function place(f: Fight, u: Unit, vs: Unit[]): void {
  const free = (c: Fight['cells'][number]) => !c.block && !f.party.some(w => w.cell === c.i);
  for (const w of f.party) if (w !== u && !vs.includes(w) && hexDist(f.cells[w.cell], f.cells[u.cell]) <= 1) {
    const far = f.cells.find(c => free(c) && hexDist(c, f.cells[u.cell]) >= 3)!;
    f.cells[w.cell].unit = null; w.cell = w.home = far.i; far.unit = w;
  }
  for (const v of vs) if (hexDist(f.cells[v.cell], f.cells[u.cell]) !== 1) {
    const c = f.cells.find(x => free(x) && hexDist(x, f.cells[u.cell]) === 1)!;
    f.cells[v.cell].unit = null; v.cell = v.home = c.i; c.unit = v;
  }
}

const BUBBLE: DebuffDef = { name: '독 거품', type: '독', left: 16, swell: { every: 4, max: 4 }, end: { p: 'pop', pop: 36, self: 72, near: 48 } };
const INK: DebuffDef = { name: '먹물', type: '독', left: 15, cap: 0.6 };
const COIN: DebuffDef = { name: '동전 뒤집기', type: '저주', left: 10, end: { p: 'flip' } };

describe('부풀기 (P-SWELL)', () => {
  it('1중첩으로 걸려 4초마다 1중첩, 최대 4', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'ranged')!;
    const d = applyDebuff(f, u, BUBBLE)!;
    expect(d.stack).toBe(1);
    steps(f, 4.05);
    expect(d.stack).toBe(2);
    steps(f, 8);
    expect(d.stack).toBe(4);
    steps(f, 3);
    expect(d.stack).toBe(4);
  });

  it('지우면 이웃 칸만 중첩 × pop, 본인은 안 맞음', () => {
    const f = fight('druid');
    const [u, v] = f.party.filter(x => x.role === 'ranged');
    place(f, u, [v]);
    const d = applyDebuff(f, u, BUBBLE)!;
    steps(f, 8.05);
    expect(d.stack).toBe(3);
    const hu = u.hp, hv = v.hp;
    doDispel(f, u);
    expect(u.debuffs.some(x => x.name === '독 거품')).toBe(false);
    expect(u.hp).toBe(hu);
    expect(hv - v.hp).toBeGreaterThan(36 * 3 * f.dmgMult * 0.25);
    const dropDispel = hv - v.hp;
    // 두면 끝날 때 본인 + 이웃이 더 크게
    const f2 = fight('druid');
    const [u2, v2] = f2.party.filter(x => x.role === 'ranged');
    place(f2, u2, [v2]);
    applyDebuff(f2, u2, BUBBLE);
    u2.hp = u2.max; v2.hp = v2.max;
    const h2u = u2.hp, h2v = v2.hp;
    steps(f2, 16.05);
    expect(h2u - u2.hp).toBeGreaterThan(0);
    expect(h2v - v2.hp).toBeGreaterThan(dropDispel);
  });

  it('옆에 아무도 없으면 지워도 아무도 안 맞음', () => {
    const f = fight('druid');
    const u = f.party.find(x => x.role === 'ranged')!;
    place(f, u, []);
    applyDebuff(f, u, BUBBLE);
    const hp = f.party.map(x => x.hp);
    doDispel(f, u);
    expect(f.party.map(x => x.hp)).toEqual(hp);
  });
});

describe('치유 상한 (P-CAP)', () => {
  it('치유로는 최대 체력 × cap까지만, 넘는 몫은 넘친 치유', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, INK);
    expect(healTop(u)).toBeCloseTo(u.max * 0.6);
    u.hp = u.max * 0.5;
    const over0 = f.stats.overheal;
    heal(f, u, u.max, true, true);
    expect(u.hp).toBeCloseTo(u.max * 0.6);
    expect(f.stats.overheal - over0).toBeCloseTo(u.max * 0.9);
  });

  it('이미 상한보다 높으면 깎지 않고, 치유도 안 들어감', () => {
    const f = fight();
    const u = f.party.find(x => x.role === 'ranged')!;
    u.hp = u.max * 0.9;
    applyDebuff(f, u, INK);
    heal(f, u, 100, true, true);
    expect(u.hp).toBeCloseTo(u.max * 0.9);
  });

  it('지우면 다시 가득까지 참', () => {
    const f = fight('druid');
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, INK);
    doDispel(f, u);
    u.hp = u.max * 0.5;
    heal(f, u, u.max, true, true);
    expect(u.hp).toBeCloseTo(u.max);
  });
});

describe('뒤집힘 저주 (P-FLIP)', () => {
  it('시간이 다 되면 체력 비율이 뒤집힘', () => {
    const f = fight('priest');
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, { ...COIN, left: 1 });
    u.hp = u.max * 0.3;
    steps(f, 1.05);
    expect(u.hp / u.max).toBeCloseTo(0.7, 1);
  });

  it('가득이면 5%까지, 지우면 그냥 사라짐', () => {
    const f = fight('druid');
    const [u, v] = f.party.filter(x => x.role === 'ranged');
    applyDebuff(f, u, { ...COIN, left: 1 });
    u.hp = u.max;
    steps(f, 1.05);
    expect(u.alive).toBe(true);
    expect(u.hp / u.max).toBeCloseTo(0.05, 2);
    applyDebuff(f, v, COIN);
    v.hp = v.max;
    doDispel(f, v);
    steps(f, 11);
    expect(v.hp).toBeCloseTo(v.max);
  });
});

describe('일반 구간 적이 쓰러질 때 (MobDef.down)', () => {
  it('먼지 유령이 쓰러질 때마다 살아 있는 모두에게 1중첩', () => {
    const f = E.create({ encounter: 'gate', diff: '보통', seed: 1 });
    // 정문 구간 적 목록을 먼지 유령으로 바꿔 봄 (데이터 부품만 시험)
    const dust: DebuffDef = { name: '먼지 파열', type: '저주', left: 4, dot: 6, stackMax: 5 };
    quiet(f);
    f.mobs.forEach(m => { m.down = { p: 'burst', debuff: dust }; });
    const [a, b] = f.mobs;
    damageMob(f, a, a.hp + 1);
    damageMob(f, b, b.hp + 1);
    steps(f, 0.1);
    for (const u of E.living(f)) expect(u.debuffs.find(d => d.name === '먼지 파열')?.stack).toBe(2);
    steps(f, 0.5);
    for (const u of E.living(f)) expect(u.debuffs.find(d => d.name === '먼지 파열')?.stack).toBe(2); // 한 번만
  });

});

describe('사슬 짝 고르기 (pick linked)', () => {
  it('사슬에 묶인 사람에게 먼저, 모자라면 탱커 · 나 빼고', () => {
    const f = fight();
    run(f, { p: 'link', kind: 'share', name: '백 년 서약', sec: 20 });
    const tied = f.party.filter(u => u.debuffs.some(d => d.link));
    expect(tied).toHaveLength(2);
    run(f, { p: 'debuff', n: 1, pick: 'linked', debuff: { name: '잠꼬대 저주', type: '저주', left: 6, invert: true } });
    expect(tied.some(u => u.debuffs.some(d => d.name === '잠꼬대 저주'))).toBe(true);
    run(f, { p: 'debuff', n: 3, pick: 'linked', debuff: { name: '소금물 저주', type: '저주', left: 12, cap: 0.6 } });
    const got = f.party.filter(u => u.debuffs.some(d => d.name === '소금물 저주'));
    expect(got).toHaveLength(3);
    expect(tied.every(u => got.includes(u))).toBe(true);
    expect(got.every(u => u.role !== 'tank' || tied.includes(u))).toBe(true);
    expect(got.some(u => u.me && !tied.includes(u))).toBe(false);
  });
});

describe('자동 힐러 대응 (46 5장)', () => {
  /** 자동 힐러가 이번에 힐을 넣는 사람 (시전 · 즉시 · 대기) */
  const decide = (f: Fight): number | null => {
    f.cast = null; f.queued = null; f.gcd = 0;
    const hp = f.party.map(u => u.hp);
    autoHealer(f);
    const c = f.cast as { uid: number } | null, q = f.queued as { uid: number } | null;
    return c?.uid ?? q?.uid ?? f.party.find((u, i) => u.hp > hp[i] + 1e-6)?.id ?? null;
  };

  it('드루이드: 부풀기를 다른 디버프보다 먼저 지움', () => {
    const f = fight('druid');
    f.party.forEach(u => { u.hp = u.max; });
    const [u, v] = f.party.filter(x => x.role === 'ranged');
    applyDebuff(f, v, { name: '독침', type: '독', left: 12, dot: 10 });
    applyDebuff(f, u, BUBBLE);
    f.mana = 100;
    autoHealer(f);
    expect(u.debuffs.some(d => d.name === '독 거품')).toBe(false);
  });

  it('뒤집힘: 체력이 낮으면 지우지 않고 둠, 높으면 지움', () => {
    const f = fight('druid');
    f.party.forEach(u => { u.hp = u.max; });
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, COIN);
    u.hp = u.max * 0.3;
    f.mana = 100;
    for (let i = 0; i < 5; i++) { decide(f); }
    expect(u.debuffs.some(d => d.name === '동전 뒤집기')).toBe(true);
    u.hp = u.max * 0.9;
    autoHealer(f);
    expect(u.debuffs.some(d => d.name === '동전 뒤집기')).toBe(false);
  });

  it('사제: 끝나기 직전 뒤집힘 대상이 높으면 힐하지 않음', () => {
    const f = fight('priest');
    f.party.forEach(u => { u.hp = u.max; });
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, { ...COIN, left: 2 });
    u.hp = u.max * 0.7;
    f.mana = 100;
    expect(decide(f)).not.toBe(u.id);
  });

  it('사제: 치유 상한까지 찬 사람은 가득 찬 것으로 봄', () => {
    const f = fight('priest');
    f.party.forEach(u => { u.hp = u.max; });
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, INK);
    u.hp = u.max * 0.6;
    f.mana = 100;
    expect(decide(f)).not.toBe(u.id);
  });
});
