/**
 * 회복 · 보호막 숫자 사건 (2026-10-16 Lim 「비구름 회복량이 안 보임」 · 「모든 직업 회복량을 같은 색 · 같은 자리」 · 「실드는 파란색」).
 * 직접 힐은 heal 사건 그대로, 지속 · 간접 회복 (지속 힐 틱 · 토템 · 비구름 …)은 tick 사건, 흡수 보호막은 shield 사건. 화면은 battle/board.ts healNumber 한 곳
 */
import { describe, expect, it } from 'vitest';
import { SKILLS } from '../src/data/skills';
import * as E from '../src/engine';
import { giveAbsorb, HEALER_SHIELD } from '../src/engine/abilities';
import { FLOW_SEC } from '../src/engine/core';
import { putHot } from '../src/engine/heroes';
import type { FightEvent } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const fight = (hero: 'shaman' | 'druid' | 'warder' | 'priest') => {
  const f = E.create({ encounter: 'plague', diff: '보통', seed: 7, level: 100, hero });
  f.gear.crit = 0; f.power = 1; f.dmgMult = 1; f.gear.heal = 1;
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.p = { ...u.p, flee: 0 }; u.ab = null; }
  return f;
};
/** sec초 동안 나온 사건 */
const run = (f: F, sec: number): FightEvent[] => {
  const out: FightEvent[] = [], end = f.t + sec;
  while (f.t < end - 1e-9 && !f.over) { E.step(f); out.push(...f.events); f.events.length = 0; }
  return out;
};
const of = <T extends FightEvent['type']>(evs: FightEvent[], type: T) => evs.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);

describe('지속 · 간접 회복도 숫자 사건', () => {
  it('주술사 비구름: 다친 사람마다 틱마다 tick 사건 (회복량 = 실제로 찬 양), 체력이 다 찬 사람은 없음', () => {
    const f = fight('shaman'), [a, b] = f.party.filter(u => !u.me);
    for (const u of f.party) u.hp = u.max;
    a.hp = a.max * 0.3;
    expect(E.use(f, 'rainTotem', 0).ok).toBe(true);
    const evs = run(f, 4.1), ticks = of(evs, 'tick');
    const onA = ticks.filter(e => e.id === a.id);
    expect(onA.length).toBe(2); // 2초마다
    expect(onA[0].eff).toBe(Math.round(SKILLS.rainTotem.amt!));
    expect(ticks.some(e => e.id === b.id)).toBe(false);
    expect(of(evs, 'heal').some(e => e.id === a.id)).toBe(false); // 직접 힐 사건 (빛 · 소리 · 성격 반응)은 그대로 없음
  });
  it('드루이드 지속 힐 틱도 tick 사건', () => {
    const f = fight('druid'), u = f.party.find(v => !v.me)!;
    u.hp = u.max * 0.3;
    putHot(u, 'sprout', { sec: 4, every: 1, total: 400 });
    const ticks = of(run(f, 2.05), 'tick').filter(e => e.id === u.id);
    expect(ticks.length).toBe(2);
    expect(ticks[0].eff).toBeGreaterThan(0);
  });
  it('초마다 조금씩 차는 회복 (메아리)은 FLOW_SEC씩 모아 숫자 하나', () => {
    const f = fight('priest'), u = f.party.find(v => !v.me)!;
    u.hp = u.max * 0.2;
    u.echo.push({ left: 3, rate: 40 });
    const ticks = of(run(f, 3.2), 'tick').filter(e => e.id === u.id);
    expect(FLOW_SEC).toBe(1);
    expect(ticks.length).toBe(3); // 틱 (0.05초)마다 60개가 아니라 1초에 하나
    expect(ticks.reduce((a, e) => a + e.eff, 0)).toBeCloseTo(120, -1);
  });
});

describe('흡수 보호막 숫자 사건', () => {
  it('보호막을 씌우면 더해진 양만큼 shield 사건, 상한에 걸리면 더해진 몫만 · 하나도 안 더해지면 없음', () => {
    const f = fight('warder'), u = f.party.find(v => !v.me)!;
    giveAbsorb(f, u, 200, 6, 0.6);
    giveAbsorb(f, u, u.max, 6, 0.6);
    giveAbsorb(f, u, 100, 6, 0.6);
    const sh = of(f.events, 'shield');
    expect(sh.map(e => e.amt)).toEqual([200, Math.round(u.max * 0.6 - 200)]);
    expect(sh.every(e => e.id === u.id)).toBe(true);
    expect(u.mods.find(m => m.k === 'absorb' && m.src === HEALER_SHIELD)!.v).toBeCloseTo(u.max * 0.6);
  });
  it('결계사 빛의 막 스킬도 shield 사건', () => {
    const f = fight('warder'), u = f.party.find(v => !v.me)!;
    const r = E.use(f, 'lightBarrier', u.cell);
    expect(r.ok, r.reason).toBe(true);
    const evs = [...f.events, ...run(f, 2)];
    expect(of(evs, 'shield').some(e => e.id === u.id && e.amt > 0)).toBe(true);
  });
});
