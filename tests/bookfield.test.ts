/** 탐험 ⑩ 책갈피 설원 (46 1-1, 묶음 B): 흩날린 책장 → 서고 사서 (마나 먹는 책 1권, 던전 ⑨ 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';
import { designRun } from '../src/sim/familiar';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };

describe('책갈피 설원', () => {
  it('Lv 31 탐험 3인: 흩날린 책장 → 서고 사서, 그림은 눈보라 고개를 빌림', () => {
    const c = contentOf('bookfield');
    expect(c.kind).toBe('explore');
    expect(c.unlockLv).toBe(31);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(3);
    expect(c.fights('보통')).toEqual(['pagedrift', 'librarian40']);
    expect(ENCOUNTERS.librarian40.board).toBe('b7');
    expect(PLACES.bookfield.borrow).toBe('snowpass');
    expect(artPlaces('bookfield')).toEqual(['bookfield', 'snowpass']);
  });

  it('서고 사서: 마나 먹는 책 1권이 마나를 뺌', () => {
    const f = E.create({ encounter: 'librarian40', diff: '보통', seed: 3, level: 40, tune: {} }); // 기믹만 봄 (장소 보정 없이, 레벨 디자인 보정으로 판이 일찍 끝나지 않게)
    f.party.forEach(u => { u.dps = 0; });
    until(f, 20, () => f.mobs.some(m => m.add && m.alive));
    expect(f.mobs.filter(m => m.add && m.alive)).toHaveLength(1);
    const m0 = f.mana;
    until(f, f.t + 3, () => false);
    expect(f.mana).toBeLessThan(m0);
  });

  it('Lv 31 자동 힐러, 보통이면 대부분 깸 (중간 등급 장비, 레벨 디자인 보통 띠 80 ~ 94%)', () => {
    let wins = 0;
    // 레벨 디자인 기준 (자동 밸런스와 같음): 그 레벨 공개모집 파티 · 중간 등급 장비. 예전엔 Lv 1 능력치 파티라 2026-10-26 능력치 끝값 뒤 맞지 않음
    for (let s = 1; s <= 20; s++) if (designRun(contentOf('bookfield'), '보통', 'priest', s).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(16);
  });
});
