/** 탐험 ② 잿빛 공동묘지 (39 1-1, 묶음 A): 교단 신도 「부패」 (첫 해제) → 뼈다귀 수집가 (끌어당김 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

describe('잿빛 공동묘지', () => {
  it('Lv 3 탐험 3인: 잿빛 묘역 → 뼈다귀 수집가, 그림은 역병 지하묘지를 빌림', () => {
    const c = contentOf('cemetery');
    expect(c.kind).toBe('explore');
    expect(c.unlockLv).toBe(3);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(3);
    expect(c.fights('보통')).toEqual(['ashyard', 'collector3']);
    expect(ENCOUNTERS.collector3.board).toBe('b7');
    expect(PLACES.cemetery.borrow).toBe('crypt');
    expect(artPlaces('cemetery')).toEqual(['cemetery', 'crypt']);
  });

  it('교단 신도 「부패」: 질병, 최대 체력 −10%, 지우면 돌아옴', () => {
    const f = E.create({ encounter: 'ashyard', diff: '보통', seed: 3, level: 3 });
    let hit: E.Unit | undefined;
    while (!f.over && f.t < 30 && !hit) { E.step(f); f.events.length = 0; hit = f.party.find(u => u.debuffs.some(d => d.name === '부패')); }
    expect(hit).toBeDefined();
    const d = hit!.debuffs.find(x => x.name === '부패')!;
    expect(d.type).toBe('질병');
    expect(hit!.max).toBeCloseTo(hit!.base * 0.9);
    f.gcd = 0; f.mana = 100;
    expect(E.use(f, 'purify', hit!.cell).ok).toBe(true);
    for (let i = 0; i < 10 && hit!.debuffs.includes(d); i++) E.step(f);
    expect(hit!.debuffs).not.toContain(d);
    expect(hit!.max).toBe(hit!.base);
  });

  it('Lv 3 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'cemetery', diff: '보통', seed: s, level: 3, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
