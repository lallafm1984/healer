/** 직업군 기본 방어력 (34 9-2) + 레이드 탱커 공백 (35 6-4), Lim 2026-10-09 */
import { describe, expect, it } from 'vitest';
import { ARMOR, armorFactor, NO_TANK_SEC } from '../src/data/armor';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import type { Fight, Unit } from '../src/engine';

const steps = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end) { E.step(f); f.events.length = 0; } };
const msgs = (f: Fight, sec: number) => {
  const out: string[] = []; const end = f.t + sec;
  while (!f.over && f.t < end) { E.step(f); for (const ev of f.events) if (ev.type === 'msg' || ev.type === 'phase') out.push(ev.text); f.events.length = 0; }
  return out;
};
const kill = (u: Unit) => { u.alive = false; u.hp = 0; };
const quiet = (f: Fight) => f.skills.forEach(s => { s.next = Infinity; });

describe('직업군 방어력', () => {
  it('탱커 90 · 근접 50 · 원거리·힐러 30', () => {
    expect(ARMOR).toEqual({ tank: 0.9, melee: 0.5, ranged: 0.3, healer: 0.3 });
  });

  it('수치는 기준 대상이 실제로 받는 양: 탱커 공격은 탱커가, 광역은 원거리·힐러가 지금과 같게 받음', () => {
    expect(armorFactor('tank', 'tank')).toBe(1);
    expect(armorFactor('ranged', 'party')).toBe(1);
    expect(armorFactor('healer', 'party')).toBe(1);
    // 탱커 공격이 다른 사람에게 가면: 근접 5배, 원거리·힐러 7배
    expect(armorFactor('melee', 'tank')).toBeCloseTo(5);
    expect(armorFactor('ranged', 'tank')).toBeCloseTo(7);
    expect(armorFactor('healer', 'tank')).toBeCloseTo(7);
    // 광역은 근접 71%, 탱커 14%
    expect(armorFactor('melee', 'party')).toBeCloseTo(0.5 / 0.7);
    expect(armorFactor('tank', 'party')).toBeCloseTo(0.1 / 0.7);
    // 고정 피해는 누구나 같음
    for (const r of ['tank', 'melee', 'ranged', 'healer'] as const) expect(armorFactor(r, 'fixed')).toBe(1);
  });

  it('같은 탱커용 피해가 탱커에게는 그대로, 근접에게는 5배', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1 });
    quiet(f);
    const tank = f.party.find(u => u.role === 'tank')!;
    const melee = f.party.find(u => u.role === 'melee')!;
    let hp = tank.hp; damage(f, tank, 10, false, 'tank'); expect(hp - tank.hp).toBeCloseTo(10 * f.dmgMult);
    hp = melee.hp; damage(f, melee, 10, false, 'tank'); expect(hp - melee.hp).toBeCloseTo(50 * f.dmgMult);
  });

  it('armor: false면 방어력 없음 (프로토타입과 같음)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, armor: false });
    const melee = f.party.find(u => u.role === 'melee')!;
    const hp = melee.hp; damage(f, melee, 10, false, 'tank');
    expect(hp - melee.hp).toBeCloseTo(10 * f.dmgMult);
  });
});

describe('레이드 탱커 공백: 「탱커 없음」 카운트다운 → 광폭화 (35 6-4)', () => {
  it('10인에서 탱커가 모두 쓰러지면 12초 뒤 보스가 광폭화', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 3 });
    steps(f, 1);
    for (const u of f.party) if (u.role === 'tank') kill(u);
    const before = msgs(f, 0.1);
    expect(f.noTankAt).not.toBeNull();
    expect(before.some(m => m.includes('탱커 없음'))).toBe(true);
    expect(f.enraged).toBe(false);
    msgs(f, NO_TANK_SEC - 0.5);
    expect(f.enraged).toBe(false);
    const after = msgs(f, 1);
    expect(f.enraged).toBe(true);
    expect(after).toContain('광폭화');
    expect(f.t).toBeLessThan(f.enc.enrage);
  });

  it('카운트다운 중에 탱커를 일으키면 멈추고 광폭화 안 함', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 3, items: ['feather'] });
    steps(f, 1);
    for (const u of f.party) if (u.role === 'tank') kill(u);
    steps(f, 4);
    expect(f.noTankAt).not.toBeNull();
    expect(E.useItem(f, 'feather', 0).ok).toBe(true);
    steps(f, 0.1);
    expect(f.noTankAt).toBeNull();
    steps(f, NO_TANK_SEC);
    expect(f.enraged).toBe(false);
  });

  it('5인은 카운트다운 없음 (방어력만)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 3 });
    steps(f, 1);
    for (const u of f.party) if (u.role === 'tank') kill(u);
    steps(f, NO_TANK_SEC + 1);
    expect(f.noTankAt).toBeNull();
    expect(f.t < f.enc.enrage && f.enraged).toBe(false);
  });

  it('탱커가 없으면 레이드는 오래 못 버팀 (자동 힐러, 25초에 탱커 전멸)', () => {
    for (const seed of [1, 2, 3]) {
      const f = E.create({ encounter: 'plague', diff: '보통', seed, gear: 'rare5', level: 40, heroLv: 40, stageLv: 40 });
      while (!f.over && f.t < 25) { E.autoHealer(f); E.step(f); f.events.length = 0; }
      for (const u of f.party) if (u.role === 'tank') kill(u);
      while (!f.over && f.t < 700) { E.autoHealer(f); E.step(f); f.events.length = 0; }
      expect(f.over).toBe('lose');
      expect(f.t - 25).toBeLessThan(60);
    }
  });
});
