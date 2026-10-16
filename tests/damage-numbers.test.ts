/**
 * 받은 피해 숫자 사건 (2026-10-16 Lim 「피해를 입으면 빨간 숫자로 피해 표시도 남기자」).
 * 한 방은 dmg 사건 하나 (체력이 실제로 준 양), 장판 · 지속 피해처럼 틱마다 드는 피해 (dripDamage)는 FLOW_SEC씩 모아 하나. 화면은 battle/board.ts fxDamage
 */
import { describe, expect, it } from 'vitest';
import * as E from '../src/engine';
import { damage, FLOW_SEC } from '../src/engine/core';
import type { FightEvent } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const fight = () => {
  const f = E.create({ encounter: 'plague', diff: '보통', seed: 7, level: 100 });
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.p = { ...u.p, flee: 0 }; u.ab = null; }
  return f;
};
const run = (f: F, sec: number): FightEvent[] => {
  const out: FightEvent[] = [], end = f.t + sec;
  while (f.t < end - 1e-9 && !f.over) { E.step(f); out.push(...f.events); f.events.length = 0; }
  return out;
};
const dmgs = (evs: FightEvent[], id: number) => evs.filter((e): e is Extract<FightEvent, { type: 'dmg' }> => e.type === 'dmg' && e.id === id);
const other = (f: F) => f.party.find(u => !u.me && u.role === 'melee')!;

describe('받은 피해 숫자 사건', () => {
  it('한 방: 체력이 실제로 준 양 (방어력 · 보호까지 들어간 값) 하나', () => {
    const f = fight(), u = other(f), hp = u.hp;
    u.shield = 5;
    damage(f, u, 100, false, 'tank');
    const ev = dmgs(f.events, u.id);
    expect(ev.length).toBe(1);
    expect(ev[0].amt).toBe(Math.round(hp - u.hp));
  });

  it('흡수 보호막이 다 막으면 숫자 없음', () => {
    const f = fight(), u = other(f), hp = u.hp;
    u.mods.push({ k: 'absorb', v: 1e6, until: f.t + 10, src: 'test' });
    damage(f, u, 100, true);
    expect(u.hp).toBe(hp);
    expect(dmgs(f.events, u.id)).toEqual([]);
  });

  it('지속 피해 · 장판은 틱마다가 아니라 FLOW_SEC씩 모아 하나, 합 = 깎인 체력', () => {
    const f = fight(), u = other(f);
    u.max = u.base = u.hp = 1e5;
    u.debuffs.push({ id: f.nextId++, name: '시험 독', type: '독', left: 30, dot: 40 });
    f.zones.push({ id: 9999, cells: new Set([u.cell]), end: Infinity, dps: 60 });
    u.p = { ...u.p, flee: 0 }; u.ignoreZone = 9999; // 장판에서 안 비킴
    const hp0 = u.hp, evs = run(f, 3 * FLOW_SEC + 0.01), ev = dmgs(evs, u.id);
    expect(ev.length).toBe(3);
    expect(ev.reduce((a, e) => a + e.amt, 0)).toBeCloseTo(hp0 - u.hp, -1);
  });

  it('지속 피해로 쓰러지면 모아 둔 피해를 쓰러짐 전에 바로', () => {
    const f = fight(), u = other(f);
    u.hp = 1; u.guardian = 0;
    u.debuffs.push({ id: f.nextId++, name: '시험 독', type: '독', left: 30, dot: 200 });
    const evs = run(f, 0.9);
    const i = evs.findIndex(e => e.type === 'dmg' && e.id === u.id), j = evs.findIndex(e => e.type === 'death' && e.id === u.id);
    expect(u.alive).toBe(false);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(j);
  });

  it('20인 판 광역 한 번 = 사람마다 숫자 하나', () => {
    const f = E.create({ encounter: 'choir', diff: '보통', seed: 1, level: 100 });
    f.skills.forEach(s => { s.next = Infinity; });
    for (const u of f.party) damage(f, u, 50, true);
    const ids = f.events.filter(e => e.type === 'dmg').map(e => (e as { id: number }).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(f.party.filter(u => u.alive).length);
  });
});
