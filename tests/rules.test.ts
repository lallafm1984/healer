/** 전투 기본 규칙 (34 1장): 숫자 ÷2.5, 적 세기 0.95, GCD 1.5, 시전 ×1.4, 기본 치명 0%, 마나 재생 0.7%, 가속 상한 50% */
import { describe, expect, it } from 'vitest';
import { apexOf, lvPower } from '../src/data/progression';
import { PROTO_RULES, RULES } from '../src/data/rules';
import { healText, SKILLS } from '../src/data/skills';
import { gearStats } from '../src/data/gear';
import * as E from '../src/engine';
import { heal } from '../src/engine/core';
import { castOf } from '../src/engine/talents';

const cfg = { encounter: 'warden' as const, diff: '보통' as const, seed: 1 };
const idle = (f: ReturnType<typeof E.create>, sec: number) => { f.skills.forEach(s => { s.next = Infinity; }); const end = f.t + sec; while (f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };

describe('34 1-2 바꾼 값', () => {
  it('GCD 1.5초, 가속으로 줄고 가속 상한 50% (GCD 바닥 1.0초)', () => {
    expect(E.create(cfg).gcdBase).toBeCloseTo(1.5);
    const g = E.create({ ...cfg, gearStats: { heal: 1, regen: 1, haste: 0.2, crit: 0 } });
    expect(g.gcdBase).toBeCloseTo(1.5 / 1.2);
    const cap = E.create({ ...cfg, gearStats: { heal: 1, regen: 1, haste: 0.8, crit: 0 } });
    expect(cap.gear.haste).toBe(RULES.hasteCap);
    expect(cap.gcdBase).toBeCloseTo(1.0);
  });
  it('시전: 치유 2.5 · 순간 치유 1.5 · 기원 2.5, 생장 2.0 · 들꽃 2.0 · 환생 3.0, 빛의 손길 2.0. 가속으로 줄어듦', () => {
    expect([SKILLS.heal.cast, SKILLS.flash.cast, SKILLS.poh.cast]).toEqual([2.5, 1.5, 2.5]);
    expect([SKILLS.growth.cast, SKILLS.wildflower.cast, SKILLS.rebirth.cast, SKILLS.holyLight.cast]).toEqual([2.0, 2.0, 3.0, 2.0]);
    const f = E.create({ ...cfg, gearStats: { heal: 1, regen: 1, haste: 0.35, crit: 0 } });
    expect(castOf(f, 'heal')).toBeCloseTo(2.5 / 1.35); // 가속 35%면 치유 약 1.85초
  });
  it('기본 치명타 0% (치명은 장비·특성에서만), 프로토타입 규칙은 5%', () => {
    expect(E.create(cfg).gear.crit).toBe(0);
    expect(E.create({ ...cfg, gear: 'adv0' }).gear.crit).toBeCloseTo(gearStats('adv0').crit); // 장비 몫만 (34 6장 기댓값 프리셋)
    expect(E.create({ ...cfg, proto: true }).gear.crit).toBeCloseTo(0.05);
  });
  it('마나 재생 초당 0.7% (프로토타입 1%)', () => {
    const f = E.create(cfg), p = E.create({ ...cfg, proto: true });
    f.mana = p.mana = 50;
    idle(f, 1); idle(p, 1);
    expect(f.mana - 50).toBeCloseTo(RULES.regen * f.enc.manaCoef, 6);
    expect(p.mana - 50).toBeCloseTo(PROTO_RULES.regen * p.enc.manaCoef, 6);
  });
  it('같은 레벨이면 적·파티원 = 내 세기 × 0.95, 적 피해 × 0.85', () => {
    for (const lv of [1, 20, 70]) {
      const f = E.create({ ...cfg, stageLv: lv, heroLv: lv, tune: {} }); // 난이도 보정 (data/tune) 없이
      expect(f.power).toBeCloseTo(lvPower(lv) * apexOf(lv));
      expect(f.scale).toBeCloseTo(lvPower(lv) * 0.95);
      expect(f.dmgMult).toBeCloseTo(lvPower(lv) * 0.95 * 0.85);
    }
  });
  it('정점 수련: Lv 50까지 없음, Lv 51부터 레벨마다 내 지능·체력 +0.3% (Lv 70 +6%, Lv 100 +15%), 적은 그대로 (34 2-2)', () => {
    expect([apexOf(1), apexOf(50), apexOf(51), apexOf(70), apexOf(100)].map(x => +x.toFixed(3))).toEqual([1, 1, 1.003, 1.06, 1.15]);
    const f = E.create({ ...cfg, stageLv: 100, heroLv: 100 });
    expect(f.power / f.scale).toBeCloseTo(1.15 / 0.95);
    expect(E.create({ ...cfg, stageLv: 100, heroLv: 100, proto: true }).power).toBeCloseTo(PROTO_RULES.lv(100));
  });
  it('Lv 1 맨몸 힐러 체력 220 · 치유 72 (34 1-3, 치유 배율 0.6은 1-6)', () => {
    const f = E.create({ ...cfg, stageLv: 1, heroLv: 1 });
    expect(f.me.max).toBeCloseTo(220);
    const t = f.party.find(u => u.role === 'tank')!;
    t.hp = 1;
    expect(heal(f, t, SKILLS.heal.amt!, false)).toBeCloseTo(72);
  });
  it('치유 한 번이 딜러 체력의 약 1/3 · 탱커의 약 1/5 (34 1-6, Lim 2026-10-10 「일반 힐이 너무 많이 찬다」)', () => {
    const f = E.create({ ...cfg, stageLv: 1, heroLv: 1 });
    const t = f.party.find(u => u.role === 'tank')!, d = f.party.find(u => u.role === 'melee' || u.role === 'ranged')!;
    t.hp = d.hp = 1;
    expect(heal(f, d, SKILLS.heal.amt!, false) / d.max).toBeLessThan(0.37); // 마법사 (체력이 가장 적은 딜러) 36%
    expect(heal(f, t, SKILLS.heal.amt!, false) / t.max).toBeLessThan(0.22);
  });
});

describe('스킬 설명 회복량 = 지능의 비율 (34 1-2)', () => {
  it('{n}은 지능 300 기준 비율, 지금 지능을 주면 괄호로 지금 값', () => {
    expect(healText('대상의 체력을 {300} 회복합니다.')).toBe('대상의 체력을 지능의 100% 회복합니다.');
    expect(healText('{250}')).toBe('지능의 83%');
    expect(healText('{600}', 1414)).toBe('지능의 200% (2,828)');
    expect(healText('숫자 없음')).toBe('숫자 없음');
  });
});
