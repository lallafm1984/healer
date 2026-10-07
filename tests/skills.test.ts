/** 레벨별 스킬 해금 (06 7장): Lv 1 치유·순간 치유 → 소생 2 → 정화 3 → 은총 4 → 기원 5 → 성언 6 → 수호 8 → 상징 10 → 찬가 12 */
import { describe, expect, it } from 'vitest';
import { SKILL_LEVEL } from '../src/data/skills';
import * as E from '../src/engine';

const fightAt = (level?: number) => E.create({ encounter: 'warden', diff: '보통', seed: 7, level });
const targetIdx = (f: ReturnType<typeof fightAt>) => f.party.find(u => u.role === 'tank')!.cell;

describe('레벨별 스킬 해금', () => {
  it('레벨을 안 주면 전부 배운 상태 (시뮬·옛 화면 그대로)', () => {
    const f = fightAt();
    expect(f.level).toBe(100);
    for (const k of Object.keys(SKILL_LEVEL) as (keyof typeof SKILL_LEVEL)[]) expect(E.knows(f, k)).toBe(true);
  });

  it('Lv 1은 치유·순간 치유만, 안 배운 스킬은 못 씀', () => {
    const f = fightAt(1);
    expect(E.knows(f, 'heal') && E.knows(f, 'flash')).toBe(true);
    expect(['renew', 'purify', 'poh', 'guardian', 'hymn'].filter(k => E.knows(f, k as never))).toEqual([]);
    const r = E.use(f, 'renew', targetIdx(f));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('소생은(는) Lv 2에 배워요');
    expect(E.use(f, 'heal', targetIdx(f)).ok).toBe(true);
  });

  it('레벨이 오르면 차례로 열림', () => {
    expect(E.knows(fightAt(2), 'renew')).toBe(true);
    expect(E.knows(fightAt(4), 'poh')).toBe(false);
    expect(E.knows(fightAt(5), 'poh')).toBe(true);
    expect(E.knows(fightAt(11), 'hymn')).toBe(false);
    expect(E.knows(fightAt(12), 'hymn')).toBe(true);
  });

  it('성언 게이지는 Lv 6부터 차고, 그 전엔 이어받은 게이지도 0', () => {
    const lo = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 5, carry: { mana: 80, g: { p: 60, s: 40 } } });
    expect(lo.g).toEqual({ p: 0, s: 0 });
    const hi = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 6, carry: { mana: 80, g: { p: 60, s: 40 } } });
    expect(hi.g).toEqual({ p: 60, s: 40 });
    for (const [lv, filled] of [[5, false], [6, true]] as const) {
      const f = fightAt(lv);
      E.use(f, 'heal', targetIdx(f));
      while (f.cast || f.t < 3) { E.step(f); f.events.length = 0; }
      expect(f.g.p > 0).toBe(filled);
    }
  });

  it('자동 힐러는 안 배운 스킬을 안 씀', () => {
    const f = fightAt(1);
    const used = new Set<string>();
    while (!f.over && f.t < 200) {
      E.autoHealer(f);
      if (f.cast) used.add(f.cast.key);
      E.step(f); f.events.length = 0;
    }
    expect([...used].filter(k => k !== 'heal' && k !== 'flash')).toEqual([]);
  });
});
