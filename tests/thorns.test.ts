/** 기획 111 4-3 새 부품: 가시 갑옷 (P-THORNS) */
import { describe, expect, it } from 'vitest';
import { BOSSES, type SkillEffect } from '../src/data/bosses';
import * as E from '../src/engine';
import { runEffect } from '../src/engine/bossParts';
import type { BossSkill, Fight } from '../src/engine';

const steps = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); };
const skill = { name: '가시 돋친 상자', st: {} } as unknown as BossSkill;
const THORNS: SkillEffect = { p: 'thorns', sec: 8, dmg: 60, tank: 0.5 };

describe('가시 갑옷 (P-THORNS)', () => {
  it('동안 보스를 때리는 딜러 · 탱커가 한 대마다 아프고, 끝나면 멈춤. 나 (힐러)는 안 맞음', () => {
    const f = E.create({ encounter: 'mimic', diff: '보통', seed: 1, level: 100 }); quiet(f);
    f.mobs.forEach(m => { m.alive = false; });
    runEffect(f, skill, THORNS);
    expect(f.thorns?.until).toBeCloseTo(f.t + 8, 6);
    const me = f.party.find(u => u.me)!, dps = f.party.filter(u => u.role === 'melee' || u.role === 'ranged'), tank = f.party.find(u => u.role === 'tank')!;
    f.party.forEach(u => { u.hp = u.max; });
    steps(f, 3);
    expect(dps.filter(u => u.hp < u.max).length).toBeGreaterThan(dps.length / 2);
    expect(me.hp).toBe(me.max);
    const tankLoss = tank.max - tank.hp;
    steps(f, 6);
    f.party.forEach(u => { u.hp = u.max; });
    steps(f, 3);
    expect(dps.every(u => u.hp === u.max)).toBe(true);
    expect(tankLoss).toBeGreaterThanOrEqual(0);
  });

  it('덥석이 · 번쩍이가 가시 갑옷을 씀 (예고 있는 광역 모양)', () => {
    for (const k of ['mimic', 'beonjjeok'] as const) {
      const s = BOSSES[k].skills.find(x => x.key === 'thorns')!;
      expect(s.effect?.p).toBe('thorns');
      expect(s.kind).toBe('aoe');
      expect(s.cast).toBeGreaterThan(0);
    }
  });
});
