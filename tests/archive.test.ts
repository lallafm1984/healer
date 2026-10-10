/** 던전 ⑨ 얼음 서고 (46 3-2, 묶음 B): 얼음 열람실 → 서고 사서 → 금서 보관소 → 얼어붙은 대학자 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACES } from '../src/data/places';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean, auto = false) => { while (!f.over && f.t < sec && !done()) { if (auto) E.autoHealer(f); E.step(f); f.events.length = 0; } };

describe('얼음 서고', () => {
  it('Lv 45 던전 5인: 일반 → 사서 → 정예 → 대학자, 마법, 그림은 서리 마탑을 빌림', () => {
    const c = contentOf('archive');
    expect(c.kind).toBe('dungeon');
    expect(c.unlockLv).toBe(45);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['iceread', 'librarian', 'forbidden', 'scholar']);
    expect(ENCOUNTERS.forbidden.mobs!.some(m => m.elite)).toBe(true);
    expect(ENCOUNTERS.scholar.debuffs).toEqual(['마법']);
    expect(PLACES.archive.borrow).toBe('frost');
  });

  it('사서: 마나 먹는 책이 살아 있는 동안 마나가 샘, 40% 아래 3권', () => {
    const f = E.create({ encounter: 'librarian', diff: '보통', seed: 2, level: 45 });
    f.party.forEach(u => { u.dps = 0; });
    until(f, 20, () => f.mobs.some(m => m.add && m.alive));
    expect(f.mobs.filter(m => m.add && m.alive)).toHaveLength(2);
    const m0 = f.mana;
    until(f, f.t + 3, () => false);
    expect(f.mana).toBeLessThan(m0);
    expect(BOSSES.librarian.skills.find(s => s.key === 'books2')!.effect).toMatchObject({ p: 'adds', n: 3 });
  });

  it('사서: 제자리에 꽂기는 탱커 아닌 셋 (악몽 넷)에 번호', () => {
    const f = E.create({ encounter: 'librarian', diff: '보통', seed: 2, level: 45 });
    f.skills.forEach(s => { s.next = s.key === 'order' ? 0 : Infinity; });
    until(f, 5, () => !!f.order);
    expect(f.order!.ids).toHaveLength(3);
    expect(BOSSES.librarian.skills.find(s => s.key === 'order')!.effect).toMatchObject({ nMythic: 4 });
  });

  it('대학자: 역류는 내 스킬마다 쌓이고 끝날 때 중첩만큼 피해, 마나 얼음은 마나를 뺌', () => {
    const f = E.create({ encounter: 'scholar', diff: '보통', seed: 2, level: 45 });
    until(f, 10, () => f.me.debuffs.some(x => x.name === '마나 얼음'));
    expect(f.me.debuffs.find(x => x.name === '마나 얼음')!.drain).toBeGreaterThan(0);
    until(f, 16, () => f.me.debuffs.some(d => d.name === '강의: 역류'));
    const d = f.me.debuffs.find(x => x.name === '강의: 역류')!;
    expect(d.count).toBe(true);
    expect(d.end).toMatchObject({ p: 'stackHit' });
  });

  it('Lv 45 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'archive', diff: '보통', seed: s, level: 45, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
