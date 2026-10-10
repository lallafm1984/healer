/** 탐험 ⑥ 해바라기 언덕길 (39 1-1, 묶음 A): 순례자 쉼터 → 신전 수호상 (무력화 P-STAGGER 예습, 게이지 3인) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };

describe('해바라기 언덕길', () => {
  it('Lv 23 탐험 3인: 순례자 쉼터 → 신전 수호상, 그림은 깨진 신전을 빌림', () => {
    const c = contentOf('hillpath');
    expect(c.unlockLv).toBe(23);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['restyard', 'guardian23']);
    expect(PLACES.hillpath.borrow).toBe('temple');
    expect(artPlaces('hillpath')).toEqual(['hillpath', 'temple']);
  });

  it('돌가루는 무력화 시작 4초 전에 한 번 옴', () => {
    const sk = BOSSES.guardian23.skills;
    const dust = sk.find(s => s.key === 'dust')!, st = sk.find(s => s.key === 'stagger')!;
    for (let k = 0; k < 3; k++) {
      const at = st.first! + st.period * k - 4;
      expect(Number.isInteger((at - dust.first!) / dust.period)).toBe(true);
    }
  });

  it('우르릉 힘 모으기: 전원 70% 위면 3인 딜로 10초 안에 채움 → 무방비', () => {
    const f = E.create({ encounter: 'guardian23', diff: '보통', seed: 3, level: 23, tune: {} }); // 힐 없이 돌리니 난이도 보정 (data/tune) 없이
    until(f, 25, () => !!f.stagger);
    expect(f.stagger).toBeTruthy();
    // 전원을 가득 채워 두면 3인 딜로 10초 안에 채워 무방비
    while (f.stagger && !f.over) { for (const u of f.party) if (u.alive) u.hp = u.max; E.step(f); f.events.length = 0; }
    expect(f.daze?.name).toBe('무방비');
  });

  it('Lv 23 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'hillpath', diff: '보통', seed: s, level: 23, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
