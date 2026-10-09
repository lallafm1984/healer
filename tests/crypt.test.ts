/** 던전 ② 역병 지하묘지 (39 1-2, 35 4-1): 뼈 쌓인 통로 → 뼈다귀 수집가 → 향로 예배실 → 역병 사제 말코어 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { BOSSES } from '../src/data/bosses';
import * as E from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };

describe('역병 지하묘지', () => {
  it('Lv 10 던전 5인: 일반 → 보스 → 정예 → 최종, 질병', () => {
    const c = contentOf('crypt');
    expect(c.kind).toBe('dungeon');
    expect(c.unlockLv).toBe(10);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(5);
    expect(c.fights('보통')).toEqual(['bonepass', 'collector', 'censerhall', 'malchor']);
    expect(ENCOUNTERS.censerhall.mobs!.some(m => m.elite)).toBe(true);
    expect(ENCOUNTERS.malchor.debuffs).toEqual(['질병']);
  });

  it('뼈다귀 수집가: 자루 쏟기 = 되살아난 뼈 2마리, 끌기는 악몽에 2명', () => {
    const f = E.create({ encounter: 'collector', diff: '보통', seed: 4, level: 10 });
    until(f, 30, () => f.mobs.some(m => m.add));
    expect(f.mobs.filter(m => m.add && m.alive)).toHaveLength(2);
    const pull = BOSSES.collector.skills.find(s => s.key === 'pull')!;
    expect(pull.target).toEqual({ p: 'back', n: 1, nMythic: 2 });
  });

  it('말코어: 병든 맥박은 50% 아래에서 열림, 쇠약은 해제 불가 · 90%면 사라짐', () => {
    const f = E.create({ encounter: 'malchor', diff: '보통', seed: 4, level: 10 });
    until(f, 20, () => false);
    expect(f.over).toBeFalsy();
    expect(f.party.some(u => u.debuffs.some(d => d.name === '쇠약'))).toBe(false);
    f.bossHp = f.bossMax * 0.45;
    until(f, 35, () => f.party.some(u => u.debuffs.some(d => d.name === '쇠약')));
    const u = f.party.find(x => x.debuffs.some(d => d.name === '쇠약'))!;
    const d = u.debuffs.find(x => x.name === '쇠약')!;
    expect(d.lock).toBe(true);
    u.hp = u.max;
    E.step(f);
    expect(u.debuffs).not.toContain(d);
  });

  it('말코어 썩은 축복: 보통 1명 · 악몽 2명', () => {
    const on = (s: string) => BOSSES.malchor.skills.find(x => x.key === s)!;
    expect(on('bless').when).toEqual({ mythic: false });
    expect(on('bless2').when).toEqual({ mythic: true });
    expect(on('bless2').effect).toMatchObject({ p: 'rot', n: 2, pct: 0.08, max: 4, again: 0.6 });
  });

  it('Lv 10 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'crypt', diff: '보통', seed: s, level: 10, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
