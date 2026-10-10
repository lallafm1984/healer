/** 던전 ⑥ 깨진 신전 (39 1-2, 35 4-5): 신전 앞뜰 → 신전 수호상 → 금 간 본당 → 신전지기 유령 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import * as E from '../src/engine';
import { runOnce } from '../src/sim/balance';

const until = (f: E.Fight, sec: number, done: () => boolean, auto = false) => { while (!f.over && f.t < sec && !done()) { if (auto) E.autoHealer(f); E.step(f); f.events.length = 0; } };
const stack = (u: E.Unit | undefined, name: string) => u?.debuffs.find(d => d.name === name)?.stack ?? 0;

describe('깨진 신전', () => {
  it('Lv 30 던전 5인: 일반 → 수호상 → 정예 → 신전지기 유령', () => {
    const c = contentOf('temple');
    expect(c.unlockLv).toBe(30);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['templeyard', 'guardian', 'nave', 'keeper']);
    expect(ENCOUNTERS.nave.mobs!.some(m => m.elite)).toBe(true);
  });

  it('수호상: 돌가루는 무력화 시작 4초 전에 꼭 오고, 반격 틈은 끊기 가능', () => {
    const sk = BOSSES.guardian.skills;
    const dust = sk.find(s => s.key === 'dust')!, st = sk.find(s => s.key === 'stagger')!;
    for (let k = 0; k < 4; k++) expect(Number.isInteger((st.first! + st.period * k - 4 - dust.first!) / dust.period)).toBe(true);
    expect(sk.find(s => s.key === 'gleam')!.effect).toMatchObject({ p: 'counter', stun: 4 });
    const f = E.create({ encounter: 'guardian', diff: '보통', seed: 2, level: 30 });
    expect(f.bs.gleam.cut).toBe(true);
  });

  it('신전지기 유령: 먼지 범벅은 탱커에게 쌓이고 (해제 불가) 천장 무너짐 뒤 사라짐', () => {
    const f = E.create({ encounter: 'keeper', diff: '보통', seed: 2, level: 30 });
    const tank = () => f.party.find(u => u.role === 'tank');
    until(f, 40, () => stack(tank(), '먼지 범벅') >= 2, true);
    expect(stack(tank(), '먼지 범벅')).toBeGreaterThanOrEqual(2);
    expect(tank()!.debuffs.find(d => d.name === '먼지 범벅')!.lock).toBe(true);
    until(f, 50, () => stack(tank(), '먼지 범벅') === 0, true);
    expect(f.t).toBeGreaterThanOrEqual(47);
    expect(stack(tank(), '먼지 범벅')).toBe(0);
  });

  it('천장 무너짐: 가운데 안전 칸 5 + 탱커 칸, 악몽은 1칸 줄임', () => {
    for (const [diff, n] of [['보통', 5], ['악몽', 4]] as const) {
      const f = E.create({ encounter: 'keeper', diff, seed: 2, level: 30 });
      f.skills.forEach(s => { s.next = s.key === 'roof' ? 0 : Infinity; });
      E.step(f);
      const tel = f.tels.find(t => t.skill.key === 'roof')!;
      const tank = f.party.find(u => u.role === 'tank')!;
      expect(tel.safe!.has(tank.cell)).toBe(true);
      expect(tel.safe!.size).toBeGreaterThanOrEqual(n);
      expect(tel.safe!.size).toBeLessThanOrEqual(n + 1);
    }
  });

  it('신전지기 유령: 50% 아래에서 꼬마 오토의 기억 (영혼)', () => {
    const f = E.create({ encounter: 'keeper', diff: '보통', seed: 2, level: 30 });
    until(f, 5, () => false, true);
    expect(f.souls).toHaveLength(0);
    f.bossHp = f.bossMax * 0.48;
    until(f, 12, () => f.souls.length > 0, true);
    expect(f.souls[0]?.soul?.name).toBe('꼬마 오토의 기억');
  });

  it('Lv 30 자동 힐러, 보통이면 대부분 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (runOnce(contentOf('temple'), '보통', 'priest', s).win) wins++; // 자동 밸런스 기준: 장비 없음 · 열린 특성 · 능력 1개 · 물약, 치유 배율 0.6 (34 1-6) 뒤로 특성 없는 사제는 높은 레벨에서 많이 짐
    expect(wins).toBeGreaterThanOrEqual(18);
  }, 20_000); // 자동 밸런스 기준 20판은 CI 기본 5초를 넘을 수 있음
});
