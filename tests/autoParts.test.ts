/** 자동 힐러의 기믹 대응 (38 0-5, 35 3장 표의 「힐러 판단」): 부품마다 자동 힐러가 알맞게 고르는지 */
import { describe, expect, it, vi } from 'vitest';
import type { AddDef, SkillEffect } from '../src/data/bosses';
import type { EncounterKey } from '../src/data/encounters';
import { HERO_KEYS, type HeroKey } from '../src/data/heroes';
import * as E from '../src/engine';
import { autoHealer } from '../src/engine/auto';
import { runEffect } from '../src/engine/bossParts';
import { addDebuff } from '../src/engine/core';
import type { BossSkill, Fight, Unit } from '../src/engine';

// 자동 힐러가 쓴 스킬을 기록 (healer.use를 감쌈)
const calls = vi.hoisted(() => [] as { key: string; cell: number }[]);
vi.mock('../src/engine/healer', async importOriginal => {
  const m = await importOriginal<typeof import('../src/engine/healer')>();
  return { ...m, use: (f: Fight, key: Parameters<typeof m.use>[1], cell: number) => { calls.push({ key, cell }); return m.use(f, key, cell); } };
});

const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const make = (hero: HeroKey = 'priest', encounter: EncounterKey = 'warden') => { const f = E.create({ encounter, diff: '보통', seed: 1, hero, level: 40, heroLv: 40 }); quiet(f); return f; };
const dealers = (f: Fight) => f.party.filter(u => u.role === 'melee' || u.role === 'ranged');
const tanksHot = (f: Fight) => f.party.filter(u => u.role === 'tank').forEach(u => { u.hot = 9; });
const run = (f: Fight, e: SkillEffect) => runEffect(f, {} as BossSkill, e);
const add = (f: Fight, a: AddDef) => run(f, { p: 'adds', n: 1, add: a });
/** 자동 힐러 한 번: 처음 쓴 스킬과 대상 */
const act = (f: Fight): { key: string; who: Unit | null } | null => {
  calls.length = 0;
  autoHealer(f);
  const c = calls[0];
  return c ? { key: c.key, who: f.cells[c.cell]?.unit ?? null } : null;
};
const auto = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { autoHealer(f); E.step(f); f.events.length = 0; } };

describe('뒤집힌 축복 (P-INVERT)', () => {
  for (const hero of HERO_KEYS) {
    it(`${hero}: 걸린 사람은 가장 낮아도 단일·지속·광역 어느 힐도 안 들어감`, () => {
      const f = make(hero);
      for (const u of f.party) u.hp = u.max * 0.6;
      const v = dealers(f)[0];
      v.hp = v.max * 0.2;
      addDebuff(f, v, { name: '뒤집힌 축복', type: '마법', left: 30, lock: true, invert: true });
      auto(f, 10);
      expect(f.stats.inverted ?? 0).toBe(0);
      expect(v.hp).toBeCloseTo(v.max * 0.2);
      expect(f.party.filter(u => u !== v).some(u => u.hp > u.max * 0.6)).toBe(true); // 다른 사람은 채움
    });
  }
  it('지울 수 있으면 다른 해제보다 먼저 지움 (힐을 막으니까)', () => {
    const f = make();
    const [a, b] = dealers(f);
    addDebuff(f, a, { name: '병', type: '질병', left: 30 });
    addDebuff(f, b, { name: '뒤집힌 축복', type: '마법', left: 30, invert: true });
    expect(act(f)).toEqual({ key: 'purify', who: b });
  });
});

describe('차례 (P-ORDER)', () => {
  for (const hero of HERO_KEYS) {
    it(`${hero}: 위급한 사람이 없으면 번호 순서대로 단일 힐 → 성공해서 보스 멍함`, () => {
      const f = make(hero);
      run(f, { p: 'order', n: 3, sec: 12, wrong: 50, miss: 50, daze: { sec: 4, vuln: 1.2 } });
      expect(f.order?.ids).toHaveLength(3);
      while (f.order && f.t < 12) auto(f, 0.1);
      expect(f.order).toBeNull();
      expect(f.daze).not.toBeNull(); // 성공 (시간이 다 되면 멍함 없이 끝)
      expect(f.t).toBeLessThan(8);
    });
  }
});

describe('탱커처럼 계속 맞는 딜러: 끌려옴 (P-PULL) · 갇힘 (P-JAIL)', () => {
  it('끌려온 딜러에게 탱커처럼 지속 힐', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[1];
    v.hp = v.max * 0.9;
    expect(act(f)).toBeNull(); // 끌려오기 전엔 90%라 손대지 않음
    v.pulled = { until: f.t + 6, cell: v.cell, dmg: 40 };
    expect(act(f)).toEqual({ key: 'renew', who: v });
  });
  it('갇힌 딜러에게 지속 힐 (감옥은 해제가 안 되니 버티게)', () => {
    const f = make('priest', 'plague');
    quiet(f);
    tanksHot(f);
    run(f, { p: 'jail', n: 1, name: '감옥', short: '옥', hp: 0.02, dot: 20 });
    const v = f.party.find(u => u.debuffs.some(d => d.jail))!;
    expect(v).toBeDefined();
    expect(act(f)).toEqual({ key: 'renew', who: v });
  });
});

describe('곧 크게 맞을 사람: 자폭 쫄 (P-FIXATE) · 큰 쫄 강타 (P-ELITE)', () => {
  it('자폭 쫄이 두 칸 안이면 노린 사람을 더 낮은 사람보다 먼저 채움', () => {
    const f = make();
    for (const u of f.party) u.hp = u.max * 0.7;
    add(f, { name: '자폭 쫄', short: '폭', hp: 0.01, dmg: 0, every: 2, job: { p: 'fixate', every: 2, dmg: 300, splash: 100, from: 2 } });
    const m = f.mobs.find(x => x.add?.job?.p === 'fixate')!;
    const v = f.party.find(u => u.id === m.add!.on)!;
    v.hp = v.max * 0.85;
    expect(act(f)).toEqual({ key: 'flash', who: v });
  });
  it('큰 쫄이 강타를 예고하면 맞을 부탱커를 미리 채움', () => {
    const f = make('priest', 'plague');
    quiet(f);
    add(f, { name: '큰 쫄', short: '큰', hp: 0.05, dmg: 0, every: 99, job: { p: 'smash', every: 8, warn: 3, dmg: 500 } });
    const m = f.mobs.find(x => x.add?.job?.p === 'smash')!;
    const v = f.party.find(u => u.id === m.add!.on)!;
    expect(v.role).toBe('tank');
    tanksHot(f);
    v.hp = v.max * 0.8;
    m.add!.warned = true;
    expect(act(f)).toEqual({ key: 'flash', who: v });
  });
});

describe('체력 선 (P-WOUND · P-FULL)', () => {
  it('채우면 풀리는 사람을 더 낮은 사람보다 먼저 선 위로', () => {
    const f = make();
    tanksHot(f);
    const [a, b] = dealers(f);
    a.hp = a.max * 0.85;
    b.hp = b.max * 0.65;
    addDebuff(f, a, { name: '쇠약', type: '질병', left: 20, lock: true, cureAt: 0.9, grow: { every: 3, dot: 6, max: 5 } });
    expect(act(f)).toEqual({ key: 'heal', who: a });
  });
});

describe('곧 모두가 맞음: 폭탄 (P-BOMB) · 쫄 떼 파열 (P-SWARM · P-BURST)', () => {
  it('폭탄이 3초 안에 터지면 지속 힐을 미리 깔아 둠', () => {
    const f = make();
    tanksHot(f);
    expect(act(f)).toBeNull();
    add(f, { name: '폭탄', short: '탄', hp: 0.02, dmg: 0, every: 0, job: { p: 'bomb', sec: 2.5, dmg: 200 } });
    const r = act(f);
    expect(r?.key).toBe('renew');
    expect(r?.who?.role).not.toBe('tank');
  });
  it('파열을 거는 쫄 떼가 거의 다 잡히면 지속 힐을 미리', () => {
    const f = make();
    tanksHot(f);
    add(f, { name: '해골', short: '해', hp: 0.02, dmg: 0, every: 0, cleave: true, down: { p: 'burst', debuff: { name: '파열', type: '물리', left: 6, dot: 10, stackMax: 5 } } });
    expect(act(f)).toBeNull();
    const m = f.mobs.find(x => x.add?.cleave)!;
    m.hp = m.max * 0.2;
    expect(act(f)?.key).toBe('renew');
  });
});

describe('보호막 수정 (P-PYLON) · 판 위 적이 있을 때 해제 순서', () => {
  it('보호막 수정이 서 있으면 마나를 아껴 80%는 그냥 둠', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[0];
    v.hp = v.max * 0.8;
    expect(act(f)).toEqual({ key: 'heal', who: v });
    f.cast = null; f.gcd = 0;
    add(f, { name: '보호막 수정', short: '수', hp: 0.05, dmg: 0, every: 0, job: { p: 'pylon', cut: 0.9 } });
    expect(act(f)).toBeNull();
  });
  it('판에 적이 있으면 딜러의 딜 0 디버프(침묵)를 먼저 지움, 없으면 순서대로', () => {
    const pick = (adds: boolean) => {
      const f = make();
      const [a, b] = dealers(f);
      addDebuff(f, a, { name: '마력 화상', type: '마법', left: 30 });
      addDebuff(f, b, { name: '침묵', type: '마법', left: 30, noDps: true });
      if (adds) add(f, { name: '치유 쫄', short: '치', hp: 0.05, dmg: 0, every: 0, job: { p: 'mend', every: 5, pct: 0.02 } });
      const r = act(f);
      return r?.key === 'purify' ? (r.who === a ? 'a' : r.who === b ? 'b' : '?') : r?.key;
    };
    expect(pick(false)).toBe('a');
    expect(pick(true)).toBe('b');
  });
});
