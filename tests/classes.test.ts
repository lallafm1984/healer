/** 공개모집 직업 8종 (17 2장): 뽑기 규칙, 체력·딜, 패시브 */
import { describe, expect, it } from 'vitest';
import { aimMult, CLASSES, rageMult, type ClassKey } from '../src/data/classes';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { dodgeRate, moveTo } from '../src/engine/movement';
import type { RosterEntry } from '../src/engine';

const roster = (tank: ClassKey, others: ClassKey[] = ['rogue', 'mage', 'archer']): RosterEntry[] => [
  { role: 'tank', pers: '신중파', nick: '탱', cls: tank },
  ...others.map((c, i) => ({ role: CLASSES[c].role, pers: '사교형' as const, nick: `딜${i}`, cls: c })),
];
const fightWith = (party: RosterEntry[], seed = 1) => E.create({ encounter: 'warden', diff: '보통', seed, party });
const unit = (f: ReturnType<typeof fightWith>, cls: ClassKey) => f.party.find(u => u.cls === cls)!;

describe('공개모집 직업 뽑기', () => {
  it('닉네임·성격은 rollParty 그대로, 역할에 맞는 Lv 1 직업이 붙음', () => {
    for (let s = 1; s <= 50; s++) {
      const a = E.rollParty('warden', s), b = E.recruitParty('warden', s);
      expect(b.map(m => [m.role, m.pers, m.nick])).toEqual(a.map(m => [m.role, m.pers, m.nick]));
      for (const m of b) expect(CLASSES[m.cls!].role).toBe(m.role);
    }
  });

  it('같은 직업은 5인 1명 · 10인 2명 · 20인 3명까지 (자리가 모자라면 고르게)', () => {
    const cases: [EncounterKey, number][] = [['warden', 1], ['plague', 2], ['choir', 3]];
    for (const [enc, max] of cases) for (let s = 1; s <= 40; s++) {
      const count: Record<string, number> = {};
      for (const m of E.recruitParty(enc, s)) count[m.cls!] = (count[m.cls!] || 0) + 1;
      // 20인 원거리 10명은 원거리 직업 3종 × 3명보다 많아서 한 직업이 4명
      const comp = ENCOUNTERS[enc].comp;
      for (const [k, n] of Object.entries(count)) {
        const role = CLASSES[k as ClassKey].role;
        const kinds = Object.values(CLASSES).filter(c => c.role === role).length;
        expect(n).toBeLessThanOrEqual(Math.max(max, Math.ceil(comp[role] / kinds)));
      }
    }
  });

  it('같은 시드면 같은 직업', () => {
    expect(E.recruitParty('warden', 77)).toEqual(E.recruitParty('warden', 77));
  });
});

describe('직업 체력·딜', () => {
  it('직업 체력, 딜 = 직업 배율 × 10', () => {
    const f = fightWith(roster('paladin', ['berserker', 'mage', 'hunter']));
    expect(unit(f, 'paladin').max).toBe(950);
    expect(unit(f, 'mage').max).toBe(520);
    expect(unit(f, 'mage').dps).toBeCloseTo(12);
    expect(unit(f, 'paladin').dps).toBeCloseTo(4.5);
  });

  it('악몽은 직업 체력·딜에도 ×1.15', () => {
    const f = E.create({ encounter: 'warden', diff: '악몽', seed: 1, party: roster('warrior') });
    expect(unit(f, 'warrior').max).toBeCloseTo(1000 * 1.15);
    expect(unit(f, 'rogue').dps).toBeCloseTo(11 * 1.15);
  });
});

describe('직업 패시브', () => {
  it('광전사 분노: 체력 100% ×0.9 → 50% ×1.2 → 30% 이하 ×1.4', () => {
    expect(rageMult(1)).toBeCloseTo(0.9);
    expect(rageMult(0.75)).toBeCloseTo(1.05);
    expect(rageMult(0.5)).toBeCloseTo(1.2);
    expect(rageMult(0.3)).toBeCloseTo(1.4);
    expect(rageMult(0.1)).toBeCloseTo(1.4);
  });

  it('궁수 조준: 5초마다 +5%, 최대 +25%, 움직이면 처음부터', () => {
    expect(aimMult(4.9)).toBe(1);
    expect(aimMult(5)).toBeCloseTo(1.05);
    expect(aimMult(60)).toBeCloseTo(1.25);
    const f = fightWith(roster('warrior', ['archer']));
    const a = unit(f, 'archer');
    while (f.t < 10.01) { E.step(f); f.events.length = 0; }
    expect(a.aim).toBeGreaterThan(10);
    moveTo(f, a, f.cells.find(c => !c.unit)!);
    E.step(f);
    expect(a.aim).toBe(0);
  });

  it('이동 중 딜: 사냥꾼 60%, 마법사 0', () => {
    const f = fightWith(roster('warrior', ['hunter', 'mage']));
    const only = (cls: ClassKey) => { for (const u of f.party) if (!u.me && u.cls !== cls) u.alive = false; };
    only('hunter');
    const h = unit(f, 'hunter');
    const still = E.partyDps(f);
    moveTo(f, h, f.cells.find(c => !c.unit)!);
    expect(E.partyDps(f)).toBeCloseTo(still * 0.6);
    const g = fightWith(roster('warrior', ['mage']));
    for (const u of g.party) if (!u.me && u.cls !== 'mage') u.alive = false;
    moveTo(g, unit(g, 'mage'), g.cells.find(c => !c.unit)!);
    expect(E.partyDps(g)).toBe(0);
  });

  it('수호기사: 마법 피해(광역·장판·지속)만 -10%', () => {
    const f = fightWith(roster('paladin'));
    const p = unit(f, 'paladin');
    damage(f, p, 100); expect(p.max - p.hp).toBeCloseTo(100);
    damage(f, p, 100, true); expect(p.max - p.hp).toBeCloseTo(190);
  });

  it('검사: 맞으면 3초간 딜 +15%', () => {
    const f = fightWith(roster('warrior', ['swordsman']));
    for (const u of f.party) if (!u.me && u.cls !== 'swordsman') u.alive = false;
    const s = unit(f, 'swordsman');
    const base = E.partyDps(f);
    damage(f, s, 10);
    expect(E.partyDps(f)).toBeCloseTo(base * 1.15);
    expect(s.flow).toBe(3);
    s.flow = 0;
    expect(E.partyDps(f)).toBeCloseTo(base);
  });

  it('도적: 장판 회피 +8%p, 이동 시간 -25%', () => {
    const f = fightWith(roster('warrior', ['rogue', 'archer']));
    const r = unit(f, 'rogue'), a = unit(f, 'archer');
    a.pers = r.pers; a.p = r.p;
    expect(dodgeRate(f, r) - dodgeRate(f, a)).toBeCloseTo(0.08);
    moveTo(f, r, f.cells.find(c => !c.unit && E.hexDist(c, f.cells[r.cell]) === 1)!);
    expect(r.moving!.total).toBeCloseTo(0.3);
  });

  it('전사: 보스 평타 흔들림 ±15% (다른 탱커는 ±30%)', () => {
    const hits = (tank: ClassKey) => [...Array(40)].map((_, s) => {
      const f = fightWith(roster(tank), s + 1);
      const t = f.party.find(u => u.role === 'tank')!;
      while (f.t < 2.01) { E.step(f); f.events.length = 0; }
      return (t.max - t.hp) / 70;
    });
    const w = hits('warrior'), p = hits('paladin');
    expect(Math.min(...w)).toBeGreaterThanOrEqual(0.85 - 1e-9);
    expect(Math.max(...w)).toBeLessThanOrEqual(1.15 + 1e-9);
    expect(Math.min(...p) < 0.85 || Math.max(...p) > 1.15).toBe(true);
  });
});
