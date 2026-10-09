/** 던전 ③ 독안개 늪 (39 1-2, 35 4-2): 썩은 나무다리 → 늪 주술사 → 거대 두꺼비 부글이 → 독 혹 둥지 → 늪 족장 세레스 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import * as E from '../src/engine';
import { runEffect } from '../src/engine/bossParts';
import type { BossSkill } from '../src/engine';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };
const has = (u: E.Unit, name: string) => u.debuffs.some(d => d.name === name);

describe('독안개 늪', () => {
  it('Lv 15 던전 5인 보스 셋: 일반 → 1 → 2 → 정예 → 최종, 독', () => {
    const c = contentOf('swamp');
    expect(c.kind).toBe('dungeon');
    expect(c.unlockLv).toBe(15);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['rotbridge', 'shaman', 'toad', 'toadnest', 'seres']);
    expect(c.bosses).toEqual(['늪 주술사', '거대 두꺼비 부글이', '늪 족장 세레스']);
  });

  it('늪 주술사: 진흙 토템이 판에 나오고, 거머리는 악몽에 2명', () => {
    const f = E.create({ encounter: 'shaman', diff: '보통', seed: 5, level: 15 });
    until(f, 30, () => f.mobs.some(m => m.add));
    expect(f.mobs.find(m => m.add)?.name).toBe('진흙 토템');
    const leech = BOSSES.shaman.skills.find(s => s.key === 'leech')!;
    expect(leech.effect).toMatchObject({ p: 'debuff', nMythic: 2, pick: 'lowest' });
  });

  it('부글이 삼키기: 혀가 가리킨 원거리가 삼켜짐 (딜 0 · 판 기술 안 맞음), 보스를 4% 깎으면 나옴', () => {
    const f = E.create({ encounter: 'toad', diff: '보통', seed: 5, level: 15 });
    const tel = () => f.tels.find(t => t.skill.key === 'swallow');
    until(f, 30, () => !!tel());
    const target = f.party.find(u => u.id === tel()!.units[0])!;
    expect(target.role).toBe('ranged');
    until(f, 30, () => has(target, '삼키기'));
    const d = target.debuffs.find(x => x.name === '삼키기')!;
    expect(d.noDps && d.hide && d.lock).toBe(true);
    f.bossHp -= f.bossMax * 0.05;
    E.step(f);
    expect(has(target, '삼키기')).toBe(false);
  });

  it('세레스 사냥 창: 맞는 순간 체력 비율이 가장 낮은 탱커 아닌 1명', () => {
    const f = E.create({ encounter: 'seres', diff: '보통', seed: 5, level: 15 });
    f.skills.forEach(s => { s.next = Infinity; });
    const low = f.party.find(u => u.role === 'ranged')!;
    for (const u of f.party) u.hp = u.max * 0.9;
    low.hp = low.max * 0.5;
    f.party.find(u => u.role === 'tank')!.hp = 1;
    const before = low.hp;
    runEffect(f, { name: '사냥 창' } as BossSkill, { p: 'hunt', dmg: 270 });
    expect(low.hp).toBeLessThan(before);
    expect(f.party.filter(u => u !== low && u.role !== 'tank').every(u => u.hp === u.max * 0.9)).toBe(true);
  });

  it('세레스: 정령 (악몽 둘), 50% 아래에서 가라앉는 섬', () => {
    const sp = BOSSES.seres.skills.filter(s => s.effect?.p === 'soul');
    expect(sp.map(s => s.when?.mythic)).toEqual([undefined, true]);
    const f = E.create({ encounter: 'seres', diff: '보통', seed: 5, level: 15 });
    until(f, 10, () => false);
    f.bossHp = f.bossMax * 0.45;
    expect(f.bs.sink.next).toBe(Infinity);
    until(f, 20, () => f.bs.sink.next < Infinity);
    expect(f.bs.sink.next).toBeLessThan(Infinity);
  });

  it('Lv 15 자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'swamp', diff: '보통', seed: s, level: 15, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
