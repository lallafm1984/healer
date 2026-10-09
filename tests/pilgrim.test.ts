/** 탐험 ⑦ 무너진 순례길 (39 1-1, 묶음 A): 끊어진 돌다리 → 신전지기 유령 (받침 1곳 · 네 가지 청소약 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };

describe('무너진 순례길', () => {
  it('Lv 28 탐험 3인: 끊어진 돌다리 → 신전지기 유령, 그림은 깨진 신전을 빌림, 해제 4유형', () => {
    const c = contentOf('pilgrim');
    expect(c.unlockLv).toBe(28);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['brokenbridge', 'keeper28']);
    expect(PLACES.pilgrim.borrow).toBe('temple');
    expect(artPlaces('pilgrim')).toEqual(['pilgrim', 'temple']);
    expect(ENCOUNTERS.keeper28.debuffs).toEqual(['질병', '독', '저주', '마법']);
  });

  it('네 가지 청소약: 질병 → 독 → 저주 → 마법 차례로 한 명씩', () => {
    const f = E.create({ encounter: 'keeper28', diff: '보통', seed: 3, level: 28 });
    f.skills.forEach(s => { if (s.key !== 'soap') s.next = Infinity; });
    const got: string[] = [];
    for (let k = 0; k < 4; k++) {
      until(f, 60, () => f.party.some(u => u.debuffs.some(d => d.name.endsWith('청소약'))));
      const u = f.party.find(x => x.debuffs.some(d => d.name.endsWith('청소약')))!;
      const d = u.debuffs.find(x => x.name.endsWith('청소약'))!;
      got.push(d.type);
      u.debuffs = u.debuffs.filter(x => x !== d);
      if (d.maxCut) E.step(f);
    }
    expect(got).toEqual(['질병', '독', '저주', '마법']);
  });

  it('제단 발판 1곳: 원거리가 들어가 맞음', () => {
    expect(BOSSES.keeper28.skills.find(s => s.key === 'pads')!.effect).toMatchObject({ p: 'tower', n: 1 });
    const f = E.create({ encounter: 'keeper28', diff: '보통', seed: 3, level: 28 });
    until(f, 30, () => f.tels.some(t => t.skill.key === 'pads'));
    const tel = f.tels.find(t => t.skill.key === 'pads')!;
    expect(tel.cells.size).toBe(1);
    const go = f.party.filter(u => u.padUntil != null);
    expect(go.every(u => u.role === 'ranged')).toBe(true);
  });

  it('Lv 28 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'pilgrim', diff: '보통', seed: s, level: 28, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
