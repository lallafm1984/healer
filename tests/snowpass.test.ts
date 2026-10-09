/** 탐험 ⑤ 눈보라 고개 (39 1-1, 묶음 A): 눈 덮인 비탈 (떠도는 주술서 침묵) → 마력 골렘 (진동 P-QUAKE 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };

describe('눈보라 고개', () => {
  it('Lv 18 탐험 3인: 눈 덮인 비탈 → 마력 골렘, 그림은 서리 마탑을 빌림', () => {
    const c = contentOf('snowpass');
    expect(c.kind).toBe('explore');
    expect(c.unlockLv).toBe(18);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['snowslope', 'golem18']);
    expect(ENCOUNTERS.golem18.board).toBe('b7');
    expect(PLACES.snowpass.borrow).toBe('frost');
    expect(artPlaces('snowpass')).toEqual(['snowpass', 'frost']);
  });

  it('떠도는 주술서 침묵: 마법, 딜 0', () => {
    const f = E.create({ encounter: 'snowslope', diff: '보통', seed: 3, level: 18 });
    until(f, 30, () => f.party.some(u => u.debuffs.some(d => d.name === '침묵')));
    const d = f.party.flatMap(u => u.debuffs).find(x => x.name === '침묵')!;
    expect(d.type).toBe('마법');
    expect(d.noDps).toBe(true);
  });

  it('룬 진동: 울리는 순간 시전 중인 힐이 끊기고 3초 잠김', () => {
    const f = E.create({ encounter: 'golem18', diff: '보통', seed: 3, level: 18 });
    until(f, 30, () => f.tels.some(t => t.skill.key === 'quake'));
    const tel = f.tels.find(t => t.skill.key === 'quake')!;
    while (f.t < tel.impact - 1.5) { E.step(f); f.events.length = 0; }
    f.gcd = 0; f.cast = null; f.mana = 100;
    const ally = f.party.find(u => !u.me && u.role !== 'tank')!;
    expect(E.use(f, 'heal', ally.cell).ok).toBe(true);
    until(f, tel.impact + 0.2, () => false);
    expect(f.cast).toBeNull();
    expect(f.lock.heal).toBeDefined();
  });

  it('Lv 18 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'snowpass', diff: '보통', seed: s, level: 18, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
