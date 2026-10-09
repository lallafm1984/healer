/** 탐험 ⑧ 심연 가장자리 (39 1-1, 묶음 A): 갈라진 땅 → 역병 군주 (질병 · 독 · 전염, 10인 1층 예습) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import { artPlaces } from '../src/data/places';
import * as E from '../src/engine';
import { applyDebuff } from '../src/engine/bossParts';
import { hexDist } from '../src/engine/board';

describe('심연 가장자리', () => {
  it('Lv 33 탐험 3인: 갈라진 땅 → 역병 군주, 그림은 심연을 빌림', () => {
    const c = contentOf('abyssedge');
    expect(c.unlockLv).toBe(33);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['riftground', 'plague33']);
    expect(artPlaces('abyssedge')).toEqual(['abyssedge', 'abyss']);
  });

  it('전염: 함정, 끝나면 이웃 칸 사람에게 독침이 퍼짐', () => {
    const def = BOSSES.plague33.skills.find(s => s.key === 'contagion')!.effect as { p: 'debuff'; debuff: Parameters<typeof applyDebuff>[2] };
    expect(def.debuff).toMatchObject({ trap: true, end: { p: 'spread' } });
    const f = E.create({ encounter: 'plague33', diff: '보통', seed: 2, level: 33 });
    f.skills.forEach(s => { s.next = Infinity; });
    const u = f.party.find(x => x.role === 'ranged')!, tank = f.party.find(x => x.role === 'tank')!;
    const free = f.cells.find(c => !c.block && hexDist(c, f.cells[u.cell]) === 1 && !f.party.some(v => v.cell === c.i))!;
    tank.cell = free.i;
    applyDebuff(f, u, def.debuff);
    const end = f.t + 10;
    while (f.t < end && u.debuffs.some(d => d.name === '전염')) E.step(f);
    expect(u.debuffs.some(d => d.name === '전염')).toBe(false);
    expect(tank.debuffs.some(d => d.name === '독침')).toBe(true);
  });

  it('Lv 33 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'abyssedge', diff: '보통', seed: s, level: 33, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
