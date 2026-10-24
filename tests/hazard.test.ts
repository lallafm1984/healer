/**
 * 장판 · 탱커 강타 피해 배율 (2026-10-18 Lim 「장판 피해는 너무 약하고 탱커를 치는 강타 계열은 너무 세다」, data/rules HAZARD).
 * 피할 수 있는 장판 (맞는 순간 · 요정 고리 · 졸개 오라)만 × zone (맞는 순간은 상한까지), 남는 장판 초당은 × linger (상한까지, 2026-10-24 C안), 탱커 강타만 × buster.
 * 못 피하는 줄 피해 · 어둠물 밀물 · 지목 공격은 그대로, 프로토타입 규칙 (parity)도 그대로
 */
import { describe, expect, it } from 'vitest';
import { BOSSES, type SkillDef } from '../src/data/bosses';
import { HAZARD, lingerDps, PROTO_RULES, RULES, zoneHit } from '../src/data/rules';
import * as E from '../src/engine';
import { fromDef } from '../src/engine/bosses';

const all = Object.values(BOSSES).flatMap(b => b.skills);
const pick = (f: (d: SkillDef) => boolean) => all.find(f)!;
const made = (d: SkillDef, proto = false) => {
  const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, ...(proto ? { proto: true, armor: false } : {}) });
  return fromDef(f, d);
};

describe('장판 · 탱커 강타 배율', () => {
  it('탱커 강타 피해 × buster, 지목 공격은 그대로', () => {
    const b = pick(d => d.kind === 'buster' && d.dmg != null && d.target === 'tank');
    expect(made(b).dmg).toBeCloseTo(b.dmg! * HAZARD.buster, 6);
    const greed = pick(d => d.kind === 'buster' && d.effect?.p === 'greed');
    expect(made(greed).greed).toBe((greed.effect as { dmg: number }).dmg);
  });
  it('피할 수 있는 장판: 남는 장판 초당 × linger (상한까지), 맞는 순간은 × zone (상한까지, 원래 더 크면 그대로)', () => {
    const z = pick(d => d.kind === 'zone' && !d.fixed && d.cells?.p !== 'tide' && d.dps != null && d.hitDmg != null && !d.dpsMythic);
    const s = made(z);
    expect(s.dps).toBeCloseTo(Math.max(z.dps! * HAZARD.zone, Math.min(z.dps! * HAZARD.linger, HAZARD.lingerCap)), 6);
    expect(lingerDps(RULES, 24)).toBe(24 * HAZARD.linger); // 남는 장판 ×3 (2026-10-24 C안)
    expect(lingerDps(RULES, 60)).toBe(HAZARD.lingerCap);
    expect(lingerDps(RULES, HAZARD.lingerCap)).toBe(HAZARD.lingerCap * HAZARD.zone);
    expect(s.hitDmg).toBeCloseTo(Math.min(z.hitDmg! * HAZARD.zone, HAZARD.zoneHitCap), 6);
    expect(zoneHit(RULES, HAZARD.zoneHitCap * 0.9)).toBe(HAZARD.zoneHitCap);
    expect(zoneHit(RULES, HAZARD.zoneHitCap * 1.2)).toBe(HAZARD.zoneHitCap * 1.2);
  });
  it('못 피하는 줄 피해 · 어둠물 밀물은 그대로', () => {
    const row = pick(d => d.kind === 'zone' && !!d.fixed && d.hitDmg != null);
    expect(made(row).hitDmg).toBe(row.hitDmg);
    const tide = pick(d => d.kind === 'zone' && d.cells?.p === 'tide' && d.dps != null && !d.dpsMythic);
    expect(made(tide).dps).toBe(tide.dps);
  });
  it('프로토타입 규칙에는 배율 없음 (parity)', () => {
    expect(PROTO_RULES.hazard).toBeUndefined();
    const b = pick(d => d.kind === 'buster' && d.dmg != null && d.target === 'tank');
    expect(made(b, true).dmg).toBe(b.dmg);
  });
});
