/** 탐험 ③ 늪지 어귀 (39 1-1, 묶음 A): 갈대 물가 → 늪 주술사 (완치 표식 P-FULL 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

describe('늪지 어귀', () => {
  it('Lv 8 탐험 3인: 갈대 물가 → 늪 주술사, 그림은 독안개 늪을 빌림', () => {
    const c = contentOf('marsh');
    expect(c.kind).toBe('explore');
    expect(c.unlockLv).toBe(8);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(3);
    expect(c.fights('보통')).toEqual(['reedbank', 'shaman8']);
    expect(ENCOUNTERS.shaman8.board).toBe('b7');
    expect(PLACES.marsh.borrow).toBe('swamp');
    expect(artPlaces('marsh')).toEqual(['marsh', 'swamp']);
  });

  it('늪 거머리: 가장 다친 딜러·힐러에게, 해제 불가, 100% 채우면 떨어짐', () => {
    const f = E.create({ encounter: 'shaman8', diff: '보통', seed: 2, level: 8 });
    let hit: E.Unit | undefined;
    while (!f.over && f.t < 30 && !hit) { E.step(f); f.events.length = 0; hit = f.party.find(u => u.debuffs.some(d => d.name === '늪 거머리')); }
    expect(hit).toBeDefined();
    expect(hit!.role).not.toBe('tank');
    const d = hit!.debuffs.find(x => x.name === '늪 거머리')!;
    expect(d.lock).toBe(true);
    f.gcd = 0; f.mana = 100;
    expect(E.use(f, 'purify', hit!.cell).ok).toBe(false);
    hit!.hp = hit!.max;
    E.step(f);
    expect(hit!.debuffs).not.toContain(d);
  });

  it('늪 거머리를 15초 두면 끝날 때 크게 아픔', () => {
    const f = E.create({ encounter: 'shaman8', diff: '보통', seed: 2, level: 8 });
    let hit: E.Unit | undefined;
    while (!f.over && f.t < 30 && !hit) { E.step(f); f.events.length = 0; hit = f.party.find(u => u.debuffs.some(d => d.name === '늪 거머리')); }
    const d = hit!.debuffs.find(x => x.name === '늪 거머리')!;
    hit!.hp = hit!.max * 0.6;
    d.left = 0.05;
    const before = hit!.hp;
    f.events.length = 0;
    E.step(f);
    expect(hit!.debuffs).not.toContain(d);
    expect(f.events.some(e => e.type === 'msg' && e.text.startsWith('늪 거머리') && e.text.endsWith('시간 끝'))).toBe(true);
    expect(hit!.hp).toBeLessThan(before);
  });

  it('Lv 8 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'marsh', diff: '보통', seed: s, level: 8, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
