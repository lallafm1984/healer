/** 던전 ⑧ 역병 수로 (46 3-1, 묶음 B): 물 새는 수로 → 수로 쥐왕 → 오물 거름망 → 역병 운반자 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES, type DebuffDef } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, PLACES } from '../src/data/places';
import * as E from '../src/engine';
import { applyDebuff } from '../src/engine/bossParts';
import { damageMob } from '../src/engine/core';

const until = (f: E.Fight, sec: number, done: () => boolean, auto = false) => { while (!f.over && f.t < sec && !done()) { if (auto) E.autoHealer(f); E.step(f); f.events.length = 0; } };
const near = (f: E.Fight, u: E.Unit) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);

describe('역병 수로', () => {
  it('Lv 40 던전 5인: 일반 → 쥐왕 → 정예 → 역병 운반자, 질병, 그림은 역병 지하묘지를 빌림', () => {
    const c = contentOf('sewer');
    expect(c.kind).toBe('dungeon');
    expect(c.unlockLv).toBe(40);
    expect(c.ready).toBe(true);
    expect(c.size('보통')).toBe(5);
    expect(c.fights('보통')).toEqual(['leakyway', 'ratking', 'sludgegrate', 'carrier']);
    expect(ENCOUNTERS.sludgegrate.mobs!.some(m => m.elite)).toBe(true);
    expect(ENCOUNTERS.carrier.debuffs).toEqual(['질병']);
    expect(PLACES.sewer.borrow).toBe('crypt');
    expect(artPlaces('sewer')).toEqual(['sewer', 'crypt']);
  });

  it('쥐왕: 쥐가 쓰러질 때마다 모두에게 쥐 파열, 악몽 사냥은 가장 낮은 둘', () => {
    const f = E.create({ encounter: 'ratking', diff: '보통', seed: 2, level: 40 });
    until(f, 25, () => f.mobs.some(m => m.add && m.alive), true);
    const rats = f.mobs.filter(m => m.add && m.alive);
    expect(rats).toHaveLength(3);
    damageMob(f, rats[0], rats[0].hp + 1);
    E.step(f);
    for (const u of E.living(f)) expect(u.debuffs.find(d => d.name === '쥐 파열')?.type).toBe('질병');
    expect(BOSSES.ratking.skills.find(s => s.key === 'hunt')!.effect).toMatchObject({ p: 'hunt', nMythic: 2 });
  });

  it('운반자: 축복 배달을 든 파티원은 옆에 아무도 없는 칸으로 비켜 서고, 그때 지우면 사라짐', () => {
    const f = E.create({ encounter: 'carrier', diff: '쉬움', seed: 2, level: 40, hero: 'priest' });
    f.skills.forEach(s => { s.next = Infinity; });
    const u = f.party.find(x => x.role === 'ranged' && near(f, x).length > 0) ?? f.party.find(x => x.role === 'ranged')!;
    u.p = { ...u.p, dist: 0 };
    f.diff = { ...f.diff, dodge: 1 };
    applyDebuff(f, u, (BOSSES.carrier.skills.find(s => s.key === 'bless')!.effect as { debuff: DebuffDef }).debuff);
    until(f, 4, () => !u.moving && near(f, u).length === 0 && f.t > 0.5);
    expect(near(f, u)).toHaveLength(0);
    const e0 = f.empower;
    until(f, 6, () => !u.debuffs.some(d => d.name === '축복 배달'), true);
    expect(u.debuffs.some(d => d.name === '축복 배달')).toBe(false);
    expect(f.party.some(v => v.debuffs.some(d => d.name === '축복 배달'))).toBe(false);
    expect(f.empower).toBe(e0);
  });

  it('운반자: 축복 배달을 두면 끝날 때 보스 피해 +3%', () => {
    const f = E.create({ encounter: 'carrier', diff: '보통', seed: 2, level: 40 });
    f.skills.forEach(s => { s.next = Infinity; });
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, { name: '축복 배달', type: '질병', left: 1, dot: 1, end: { p: 'jump', sec: 10, mult: 1.5, boost: 0.03 } });
    until(f, 1.2, () => false);
    expect(f.empower).toBeCloseTo(0.03, 9);
  });

  it('Lv 40 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'sewer', diff: '보통', seed: s, level: 40, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(18);
  });
});
