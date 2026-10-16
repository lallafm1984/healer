/** 조작판 특성 칸 (2026-10-16 Lim 「레벨이 안 돼서 못 쓰는 것도 기존 UI를 보여 주고 어둡게」): 버튼 특성 단마다 한 칸 */
import { describe, expect, it } from 'vitest';
import { ALL_HERO_KEYS, type HeroKey } from '../src/data/heroes';
import { TALENT_TREES } from '../src/data/talents';
import * as E from '../src/engine';

const fight = (hero: HeroKey, level: number, talents: (number | null)[] = Array(10).fill(null)) =>
  E.create({ encounter: 'warden', diff: '보통', seed: 1, hero, level, heroLv: level, talents });

describe('특성 칸', () => {
  it('일곱 직업 모두 버튼 특성 단마다 한 칸: 사제 · 수도사 3칸, 나머지 2칸', () => {
    for (const h of ALL_HERO_KEYS) expect(E.talentSlots(fight(h, 100)).length, h).toBe(['priest', 'monk'].includes(h) ? 3 : 2);
  });
  it('레벨이 모자란 단은 잠김 (배우는 레벨), 열렸지만 버튼 특성을 안 고르면 빈 칸, 고르면 그 특성', () => {
    expect(E.talentSlots(fight('priest', 1))).toEqual([{ kind: 'lock', lv: 25 }, { kind: 'lock', lv: 35 }, { kind: 'lock', lv: 50 }]);
    const picks = Array(10).fill(null); picks[4] = 0; picks[6] = 0; // 기적 · 고요한 찬가 (버튼 아님)
    expect(E.talentSlots(fight('priest', 40, picks))).toEqual([{ kind: 'tal', key: 'miracle' }, { kind: 'empty', lv: 35 }, { kind: 'lock', lv: 50 }]);
  });
  it('칸 순서 = 단 순서, 버튼 특성은 엔진의 쓸 수 있는 특성 (tx.act)과 같음', () => {
    for (const h of ALL_HERO_KEYS) {
      const tree = TALENT_TREES[h], picks = tree.map(t => { const j = t.picks.findIndex(p => p.active); return j >= 0 ? j : null; });
      const f = fight(h, 100, picks), slots = E.talentSlots(f);
      expect(slots.map(s => (s.kind === 'tal' ? s.key : s.kind)), h).toEqual(Object.keys(f.tx.act));
    }
  });
});
