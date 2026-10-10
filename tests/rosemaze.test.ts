/** 탐험 ⑫ 장미 울타리 미로 (46 1-1, 묶음 B): 장미 터널 (검은 베일) → 백합 여사제 (백합 꽃병, 던전 ⑩ 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean, auto = false) => { while (!f.over && f.t < sec && !done()) { if (auto) E.autoHealer(f); E.step(f); f.events.length = 0; } };

describe('장미 울타리 미로', () => {
  it('Lv 48 탐험 3인: 장미 터널 → 백합 여사제, 그림은 백합 정원을 빌림', () => {
    const c = contentOf('rosemaze');
    expect(c.kind).toBe('explore');
    expect(c.unlockLv).toBe(48);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(3);
    expect(c.fights('보통')).toEqual(['rosetunnel', 'priestess48']);
    expect(ENCOUNTERS.priestess48.board).toBe('b7');
    expect(PLACES.rosemaze.borrow).toBe('lily');
    expect(artPlaces('rosemaze')).toEqual(['rosemaze', 'lily']);
  });

  it('백합 여사제: 꽃병을 채우면 전원 보호막', () => {
    const f = E.create({ encounter: 'priestess48', diff: '보통', seed: 3, level: 48 });
    until(f, 14, () => !!f.vessel, true);
    expect(f.vessel!.name).toBe('백합 꽃병');
    expect(f.vessel!.need).toBeCloseTo(f.party.reduce((a, u) => a + u.max, 0) * 0.25, 6);
    f.vessel!.fill = f.vessel!.need;
    E.step(f);
    expect(f.vessel).toBeNull();
    for (const u of E.living(f)) expect(u.shield).toBeGreaterThan(9);
  });

  it('Lv 48 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'rosemaze', diff: '보통', seed: s, level: 48, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
