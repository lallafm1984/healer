/** 던전 ④ 저주받은 장원 (39 1-2, 35 4-3): 먼지 낀 응접실 → 집사 유령 → 초상화 속 귀부인 → 사냥개 우리 → 장원 주인 벨모어 경 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import * as E from '../src/engine';
import { applyDebuff, zoneCells } from '../src/engine/bossParts';
import { zoneOf } from '../src/engine/movement';
import { hexDist } from '../src/engine/board';
import { doDispel } from '../src/engine/heroes';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };
const quiet = (f: E.Fight) => { f.skills.forEach(s => { s.next = Infinity; }); };

describe('저주받은 장원', () => {
  it('Lv 20 던전 5인 보스 셋: 일반 → 1 → 2 → 정예 → 최종, 저주', () => {
    const c = contentOf('manor');
    expect(c.unlockLv).toBe(20);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['parlor', 'butler', 'lady', 'kennel', 'belmore']);
  });

  it('집사 유령: 차례는 3명 (악몽 4), 등 뒤 인사는 뒷줄 칸만', () => {
    expect(BOSSES.butler.skills.find(s => s.key === 'order')!.effect).toMatchObject({ p: 'order', n: 3, nMythic: 4, sec: 8 });
    const f = E.create({ encounter: 'butler', diff: '보통', seed: 2, level: 20 });
    const cells = zoneCells(f, f.bs.bow, { p: 'line', at: 'back' });
    expect(cells.size).toBeGreaterThan(0);
    expect([...cells].every(i => zoneOf(f, f.cells[i].row) === 'back')).toBe(true);
  });

  it('귀부인: 50% 아래에서 액자로 (무적 인터미션 + 빈 액자 2개), 끝나면 돌아옴', () => {
    const f = E.create({ encounter: 'lady', diff: '보통', seed: 2, level: 20 });
    until(f, 5, () => false);
    f.bossHp = f.bossMax * 0.48;
    until(f, 10, () => f.mobs.filter(m => m.add && m.name === '빈 액자').length === 2);
    expect(f.phase).toBe(0);
    expect(f.mobs.filter(m => m.add && m.alive && m.name === '빈 액자')).toHaveLength(2);
    until(f, 25, () => f.phase === 2);
    expect(f.phase).toBe(2);
  });

  it('벨모어 가문의 반지: 지우면 이웃 칸이 터짐, 두면 그 사람만', () => {
    const f = E.create({ encounter: 'belmore', diff: '보통', seed: 2, level: 20, hero: 'druid' });
    quiet(f);
    const u = f.party.find(x => x.role === 'ranged')!;
    const nb = f.party.filter(v => v !== u && hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
    const ring = BOSSES.belmore.skills.find(s => s.key === 'ring')!.effect as Extract<NonNullable<typeof BOSSES.belmore.skills[0]['effect']>, { p: 'debuff' }>;
    applyDebuff(f, u, ring.debuff);
    const before = nb.map(v => v.hp), self = u.hp;
    doDispel(f, u);
    E.step(f);
    if (nb.length) expect(nb.some((v, i) => v.hp < before[i])).toBe(true);
    expect(u.hp).toBeGreaterThanOrEqual(self - 1);
  });

  it('벨모어 젊음의 갈망: 빨아들인 만큼 보스 회복', () => {
    const f = E.create({ encounter: 'belmore', diff: '보통', seed: 2, level: 20 });
    quiet(f);
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.5;
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, { name: '젊음의 갈망', type: '물리', left: 4, dot: 48, lock: true, feed: 0.5 });
    const hp0 = u.hp, boss0 = f.bossHp;
    for (let i = 0; i < 20; i++) E.step(f);
    expect(u.hp).toBeLessThan(hp0);
    expect(f.bossHp - boss0).toBeCloseTo((hp0 - u.hp) * 0.5, 0);
  });

  it('벨모어: 30% 아래에서 뒤집힌 축복 2명', () => {
    const f = E.create({ encounter: 'belmore', diff: '보통', seed: 2, level: 20 });
    until(f, 5, () => false);
    f.bossHp = f.bossMax * 0.28;
    until(f, 12, () => f.phase === 2);
    expect(f.phase).toBe(2);
    expect(f.bs.invert2.next).toBeLessThan(Infinity);
  });

  it('Lv 20 자동 힐러, 보통이면 대부분 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'manor', diff: '보통', seed: s, level: 20, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(18);
  });
});
