/** 기획 111 공통 ② 어려움 변화: 보스마다 기술 하나의 양 (인원 +1 · 주기 × 0.85), 어려움 · 악몽만 */
import { describe, expect, it } from 'vitest';
import { BOSSES, hardDef, type SkillDef } from '../src/data/bosses';
import { ENCOUNTERS, PROTO_ENCOUNTERS } from '../src/data/encounters';
import * as E from '../src/engine';

const nOf = (d: SkillDef) => { const e = d.effect as { n?: number | 'all' } | undefined; return typeof e?.n === 'number' ? e.n : typeof d.target === 'object' ? d.target.n : undefined; };

describe('어려움 변화 (111 공통 ②)', () => {
  it('어려움 변화가 가리키는 기술이 있고, 악몽 전용 기술이 아니며, 실제로 값이 바뀐다', () => {
    for (const [k, def] of Object.entries(BOSSES)) {
      if (!def.hard) continue;
      const d = def.skills.find(s => s.key === def.hard!.skill);
      expect(d, k).toBeDefined();
      expect(d!.when?.mythic, k).not.toBe(true);
      const h = hardDef(d!, def.hard);
      if (def.hard.period) expect(h.period, k).toBeLessThan(d!.period);
      if (def.hard.n) expect(nOf(h) ?? (h.effect as { n?: number }).n, k).toBe((nOf(d!) ?? 1) + def.hard.n);
    }
  });

  it('프로토타입 일치 보스에는 없음', () => {
    for (const e of PROTO_ENCOUNTERS) expect(BOSSES[ENCOUNTERS[e].script as keyof typeof BOSSES].hard, e).toBeUndefined();
  });

  it('엔진: 보통은 그대로, 어려움 · 악몽은 바뀐 주기', () => {
    const [k, def] = Object.entries(BOSSES).find(([, d]) => d.hard?.period)!;
    const enc = Object.values(ENCOUNTERS).find(e => e.script === k)!.key;
    const base = def.skills.find(s => s.key === def.hard!.skill)!.period;
    expect(E.create({ encounter: enc, diff: '보통', seed: 1 }).bs[def.hard!.skill].period).toBe(base);
    for (const diff of ['어려움', '악몽'] as const) expect(E.create({ encounter: enc, diff, seed: 1 }).bs[def.hard!.skill].period).toBeLessThan(base);
  });
});
