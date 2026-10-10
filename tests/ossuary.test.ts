/** 던전 ⑩ 백합 납골당 (46 3-3, 묶음 B): 꽃잎 계단 → 백합 여사제 → 관리인 회랑 → 잠든 가주 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACES } from '../src/data/places';
import * as E from '../src/engine';
import { damageMob } from '../src/engine/core';

const until = (f: E.Fight, sec: number, done: () => boolean, auto = false) => { while (!f.over && f.t < sec && !done()) { if (auto) E.autoHealer(f); E.step(f); f.events.length = 0; } };
const stack = (u: E.Unit, name: string) => u.debuffs.find(d => d.name === name)?.stack ?? 0;

describe('백합 납골당', () => {
  it('Lv 50 던전 5인: 일반 → 여사제 → 정예 관리인 회랑 → 잠든 가주, 저주, 그림은 저주받은 장원을 빌림', () => {
    const c = contentOf('ossuary');
    expect(c.kind).toBe('dungeon');
    expect(c.unlockLv).toBe(50);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['petalstair', 'priestess', 'keeperhall', 'sleeper']);
    expect(ENCOUNTERS.keeperhall.mobs!.find(m => m.elite)!.name).toBe('납골당 관리인');
    expect(ENCOUNTERS.sleeper.debuffs).toEqual(['저주']);
    expect(PLACES.ossuary.borrow).toBe('manor');
  });

  it('관리인 회랑: 먼지 유령이 쓰러질 때마다 살아 있는 모두에게 먼지 파열 1중첩 (최대 5)', () => {
    const f = E.create({ encounter: 'keeperhall', diff: '보통', seed: 2, level: 50 });
    f.skills.forEach(s => { s.next = Infinity; });
    const ghosts = f.mobs.filter(m => m.name === '먼지 유령');
    expect(ghosts).toHaveLength(5);
    for (const g of ghosts.slice(0, 3)) damageMob(f, g, g.hp + 1);
    E.step(f);
    for (const u of E.living(f)) expect(stack(u, '먼지 파열')).toBe(3);
    for (const g of ghosts.slice(3)) damageMob(f, g, g.hp + 1);
    E.step(f);
    for (const u of E.living(f)) expect(stack(u, '먼지 파열')).toBe(5);
  });

  it('여사제: 백합 꽃병 (악몽은 30%), 시든 백합은 받는 치유 −50%', () => {
    const f = E.create({ encounter: 'priestess', diff: '보통', seed: 2, level: 50 });
    until(f, 15, () => !!f.vessel, true);
    expect(f.vessel!.name).toBe('백합 꽃병');
    expect(f.vessel!.need).toBeCloseTo(f.party.reduce((a, u) => a + u.max, 0) * 0.25, 6);
    expect(BOSSES.priestess.skills.find(s => s.key === 'vessel2')!.effect).toMatchObject({ need: 0.3 });
    const wilt = f.party.flatMap(u => u.debuffs).find(d => d.name === '시든 백합')!;
    expect(wilt.healCut).toBe(0.5);
  });

  it('잠든 가주: 백 년 서약으로 묶인 짝에게 잠꼬대 저주 (받는 치유가 피해로)', () => {
    const f = E.create({ encounter: 'sleeper', diff: '보통', seed: 2, level: 50 });
    until(f, 16, () => f.party.some(u => u.debuffs.some(d => d.name === '잠꼬대 저주')));
    const tied = f.party.filter(u => u.debuffs.some(d => d.link));
    expect(tied).toHaveLength(2);
    const cursed = f.party.find(u => u.debuffs.some(d => d.name === '잠꼬대 저주'))!;
    expect(tied).toContain(cursed);
    expect(cursed.debuffs.find(d => d.name === '잠꼬대 저주')!.invert).toBe(true);
  });

  it('Lv 50 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'ossuary', diff: '보통', seed: s, level: 50, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
