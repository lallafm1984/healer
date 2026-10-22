/** 기획 111 4-4 새 부품: 단단한 껍질 (P-SHELL) · 충전 (P-CHARGE), 자동 힐러 대응 */
import { describe, expect, it } from 'vitest';
import type { DebuffDef } from '../src/data/bosses';
import { BOSSES } from '../src/data/bosses';
import * as E from '../src/engine';
import { autoHealer } from '../src/engine/auto';
import { hexDist } from '../src/engine/board';
import { applyDebuff } from '../src/engine/bossParts';
import { cellOf, heal } from '../src/engine/core';
import type { Fight, FightEvent } from '../src/engine';

const steps = (f: Fight, sec: number, ev?: FightEvent[]) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); ev?.push(...f.events); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const fight = (hero: 'priest' | 'druid' = 'priest') => { const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, hero, level: 100 }); quiet(f); return f; };
const others = (f: Fight) => f.party.filter(u => u.role !== 'tank' && !u.me);
const SHELL: DebuffDef = { name: '얼음 껍질', type: '마법', left: 10, shell: 300, shellMin: 0.25, end: { p: 'crack' } };
const CHARGE: DebuffDef = { name: '충전 깃털', type: '마법', left: 12, charge: { max: 4, self: 120, near: 60 } };

describe('단단한 껍질 (P-SHELL)', () => {
  it('작은 직접 힐 · 지속 틱은 튕기고, 최대 체력 25% 넘는 직접 힐만 막을 깎으며 다 깎으면 사라짐', () => {
    const f = fight();
    const u = others(f)[0];
    u.hp = u.max * 0.5;
    const d = applyDebuff(f, u, SHELL)!;
    expect(d.shellLeft).toBeCloseTo(300 * f.dmgMult, 6);
    d.shellLeft = u.max * 0.5;
    const hp0 = u.hp;
    expect(heal(f, u, u.max * 0.1, true, true)).toBe(0); // 작은 직접 힐: 튕김
    expect(heal(f, u, u.max * 0.1, false, true)).toBe(0); // 지속 틱: 튕김
    expect(u.hp).toBe(hp0);
    expect(d.shellLeft).toBeCloseTo(u.max * 0.5, 6);
    heal(f, u, u.max * 0.3, true, true); // 큰 힐: 막만 깎임
    expect(u.hp).toBe(hp0);
    expect(d.shellLeft).toBeCloseTo(u.max * 0.2, 6);
    heal(f, u, u.max * 0.3, true, true); // 막을 다 깎고 남은 몫은 체력으로
    expect(u.debuffs.includes(d)).toBe(false);
    expect(u.hp).toBeCloseTo(hp0 + u.max * 0.1, 6);
  });

  it('두면 끝날 때 남은 막만큼 피해, 지우면 그냥 사라짐', () => {
    const f = fight();
    const [a, b] = others(f);
    const da = applyDebuff(f, a, SHELL)!, db = applyDebuff(f, b, SHELL)!;
    da.left = 0.2; db.left = 5;
    const ha = a.hp;
    steps(f, 0.4);
    expect(a.debuffs.includes(da)).toBe(false);
    expect(a.hp).toBeLessThan(ha);
    const hb = b.hp;
    expect(E.use(f, 'purify', b.cell).ok).toBe(true);
    steps(f, 0.2);
    expect(b.debuffs.includes(db)).toBe(false);
    expect(b.hp).toBe(hb);
  });

  it('자동 힐러 (사제): 껍질이 있는 사람에게 소생을 걸지 않는다', () => {
    const f = fight();
    const u = others(f)[0];
    u.hp = u.max * 0.6;
    applyDebuff(f, u, { ...SHELL, left: 30 });
    f.party.filter(v => v !== u).forEach(v => { v.hp = v.max; });
    f.mana = 100;
    for (let i = 0; i < 200 && u.debuffs.some(d => d.shellLeft); i++) { autoHealer(f); E.step(f); f.events.length = 0; }
    expect(u.hot).toBeLessThanOrEqual(0);
  });
});

describe('충전 (P-CHARGE)', () => {
  it('직접 힐 4번째에 방전: 본인 · 이웃 칸 피해, 중첩은 0부터. 지속 틱은 안 셈', () => {
    const f = fight();
    const u = others(f)[0];
    const d = applyDebuff(f, u, CHARGE)!;
    expect(d.stack).toBe(0);
    for (let i = 0; i < 3; i++) heal(f, u, 10, false, true);
    expect(d.stack).toBe(0);
    for (let i = 0; i < 3; i++) heal(f, u, 10, true, true);
    expect(d.stack).toBe(3);
    let near = f.party.filter(v => v !== u && v.alive && hexDist(cellOf(f, v), cellOf(f, u)) === 1);
    if (!near.length) { // 25칸 판은 이웃이 비어 있을 수 있어 한 명을 옆 칸으로
      const v = others(f)[1], c = f.cells.find(x => hexDist(x, cellOf(f, u)) === 1 && !f.party.some(w => w.cell === x.i))!;
      v.cell = c.i; near = [v];
    }
    u.hp = u.max; near.forEach(v => { v.hp = v.max; });
    const far = f.party.find(v => v !== u && !near.includes(v))!;
    far.hp = far.max;
    heal(f, u, 10, true, true);
    expect(d.stack).toBe(0);
    expect(u.hp).toBeLessThan(u.max);
    for (const v of near) expect(v.hp).toBeLessThan(v.max);
    expect(far.hp).toBe(far.max);
  });

  it('자동 힐러 (사제): 3중첩이고 체력이 넉넉한 사람에게 직접 힐을 넣지 않는다', () => {
    const f = fight();
    const u = others(f)[0];
    const d = applyDebuff(f, u, { ...CHARGE, left: 30 })!;
    d.stack = 3;
    u.hp = u.max * 0.7;
    f.party.filter(v => v !== u).forEach(v => { v.hp = v.max; });
    f.mana = 100;
    for (let i = 0; i < 100; i++) { autoHealer(f); E.step(f); f.events.length = 0; }
    expect(d.stack).toBe(3);
    expect(u.hp).toBeLessThanOrEqual(u.max * 0.7 + 1e-6);
  });
});

describe('111 데이터', () => {
  it('뒤죽박죽 · 쾅쾅이는 껍질, 돌개 · 둥둥이는 충전을 걸고, 모두 마법 (해제 지름길)', () => {
    for (const [script, key] of [['dwijuk', 'shell'], ['kwangkwang', 'shell'], ['dolgae', 'charge'], ['dungdung', 'charge']] as const) {
      const s = BOSSES[script].skills.find(x => x.key === key)!;
      expect(s.effect?.p).toBe('debuff');
      const d = (s.effect as { debuff: DebuffDef }).debuff;
      expect(d.type).toBe('마법');
      if (key === 'shell') { expect(d.shell).toBeGreaterThan(0); expect(d.end).toEqual({ p: 'crack' }); } else expect(d.charge?.max).toBe(4);
    }
  });
});
