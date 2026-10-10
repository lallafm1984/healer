/** 탐험 ④ 백합 정원 (39 1-1, 묶음 A): 시든 화단 (검은 베일 저주) → 집사 유령 (차례 P-ORDER 예습, 두 칸) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };

describe('백합 정원', () => {
  it('Lv 13 탐험 3인: 시든 화단 → 집사 유령, 그림은 저주받은 장원을 빌림', () => {
    const c = contentOf('lily');
    expect(c.kind).toBe('explore');
    expect(c.unlockLv).toBe(13);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(3);
    expect(c.fights('보통')).toEqual(['flowerbed', 'butler13']);
    expect(ENCOUNTERS.butler13.board).toBe('b7');
    expect(PLACES.lily.borrow).toBe('manor');
    expect(artPlaces('lily')).toEqual(['lily', 'manor']);
  });

  it('검은 베일: 저주, 받는 치유 −50%', () => {
    const f = E.create({ encounter: 'flowerbed', diff: '보통', seed: 3, level: 13 });
    until(f, 30, () => f.party.some(u => u.debuffs.some(d => d.name === '검은 베일')));
    const d = f.party.flatMap(u => u.debuffs).find(x => x.name === '검은 베일')!;
    expect(d.type).toBe('저주');
    expect(d.healCut).toBe(0.5);
  });

  it('차례대로 모시기: 탱커 아닌 두 칸 (원거리 · 나)에 번호', () => {
    const f = E.create({ encounter: 'butler13', diff: '보통', seed: 3, level: 13, tune: {} }); // 힐 없이 돌리니 난이도 보정 (data/tune) 없이
    until(f, 40, () => !!f.order);
    expect(f.order).toBeTruthy();
    const on = f.order!.ids.map(id => f.party.find(u => u.id === id)!);
    expect(on).toHaveLength(2);
    expect(on.some(u => u.me)).toBe(true);
    expect(on.every(u => u.role !== 'tank')).toBe(true);
  });

  it('Lv 13 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'lily', diff: '보통', seed: s, level: 13, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
