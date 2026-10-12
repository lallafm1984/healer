/** 공개모집 직업 8종 (17 2장): 뽑기 규칙, 체력·딜. 직업 패시브는 2026-10-12에 뺌 (파티원 = 성격 + 직업 스킬) */
import { describe, expect, it } from 'vitest';
import { armorFactor } from '../src/data/armor';
import { CLASSES, type ClassKey } from '../src/data/classes';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { dodgeRate, moveTo } from '../src/engine/movement';
import { unitDps } from '../src/engine/units';
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
    const f = fightWith(roster('paladin', ['berserker', 'mage', 'hunter'])), s = f.scale; // 레벨 배율 (34 1-2)
    expect(unit(f, 'paladin').max / s).toBeCloseTo(950);
    expect(unit(f, 'mage').max / s).toBeCloseTo(520);
    expect(unit(f, 'mage').dps / s).toBeCloseTo(12);
    expect(unit(f, 'paladin').dps / s).toBeCloseTo(4.5);
  });

  it('악몽은 직업 체력·딜에도 ×1.15', () => {
    const f = E.create({ encounter: 'warden', diff: '악몽', seed: 1, party: roster('warrior') });
    expect(unit(f, 'warrior').max / f.scale).toBeCloseTo(1000 * 1.15);
    expect(unit(f, 'rogue').dps / f.scale).toBeCloseTo(11 * 1.15);
  });
});

describe('직업 패시브 없음 (2026-10-12 Lim: 성격과 직업 스킬만)', () => {
  it('직업 데이터에 패시브가 없음', () => {
    for (const c of Object.values(CLASSES)) expect(Object.keys(c).sort()).toEqual(['dps', 'hp', 'key', 'line', 'name', 'role', 'short']);
  });

  it('이동 중 딜은 모든 직업 0 (사냥꾼도)', () => {
    for (const cls of ['hunter', 'mage', 'archer'] as ClassKey[]) {
      const f = fightWith(roster('warrior', [cls]));
      for (const u of f.party) if (!u.me && u.cls !== cls) u.alive = false;
      expect(E.partyDps(f)).toBeGreaterThan(0);
      moveTo(f, unit(f, cls), f.cells.find(c => !c.unit)!);
      expect(E.partyDps(f)).toBe(0);
    }
  });

  it('궁수 · 광전사 · 검사의 딜은 서 있은 시간 · 체력 · 맞은 것과 상관없이 같음', () => {
    const f = fightWith(roster('warrior', ['archer', 'berserker', 'swordsman']));
    const dps = (cls: ClassKey) => unitDps(unit(f, cls), f);
    const before = { archer: dps('archer'), berserker: dps('berserker'), swordsman: dps('swordsman') };
    expect(before.archer / f.scale).toBeCloseTo(12.3);
    unit(f, 'berserker').hp = unit(f, 'berserker').max * 0.2;
    damage(f, unit(f, 'swordsman'), 10);
    for (let i = 0; i < 200; i++) { unit(f, 'archer').hp = unit(f, 'archer').max; E.step(f); f.events.length = 0; }
    if (!unit(f, 'archer').moving) expect(dps('archer')).toBeCloseTo(before.archer);
    expect(dps('berserker')).toBeCloseTo(before.berserker);
    expect(dps('swordsman')).toBeCloseTo(before.swordsman);
  });

  it('수호기사도 마법 피해를 다른 탱커와 똑같이 받음', () => {
    const f = fightWith(roster('paladin'));
    const p = unit(f, 'paladin');
    const a = armorFactor(p.role, 'party'); // 직업군 방어력 (34 9-2)
    damage(f, p, 100); expect(p.max - p.hp).toBeCloseTo(100 * a * f.dmgMult);
    damage(f, p, 100, true); expect(p.max - p.hp).toBeCloseTo(200 * a * f.dmgMult);
  });

  it('도적도 장판 회피 · 이동 시간이 다른 직업과 같음', () => {
    const f = fightWith(roster('warrior', ['rogue', 'archer']));
    const r = unit(f, 'rogue'), a = unit(f, 'archer');
    a.pers = r.pers; a.p = r.p;
    expect(dodgeRate(f, r)).toBeCloseTo(dodgeRate(f, a));
    moveTo(f, r, f.cells.find(c => !c.unit && E.hexDist(c, f.cells[r.cell]) === 1)!);
    expect(r.moving!.total).toBeCloseTo(0.4);
  });

  it('보스 평타 흔들림은 탱커 직업과 상관없이 ±30%', () => {
    const w = [...Array(40)].map((_, s) => {
      const f = fightWith(roster('warrior'), s + 1);
      const t = f.party.find(u => u.role === 'tank')!;
      while (f.t < 2.01) { E.step(f); f.events.length = 0; }
      return (t.max - t.hp) / (70 * f.dmgMult);
    });
    expect(Math.min(...w) < 0.85 || Math.max(...w) > 1.15).toBe(true);
  });
});
