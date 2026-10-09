/** 던전 ⑦ 무너진 망루 (39 3장, 새): 돌무더기 계단 → 망루 파수꾼 (끌어당김 × 받침) → 검은 틈 → 금 간 공명 수정 (진동 × 옮겨붙음) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES, type DebuffDef } from '../src/data/bosses';
import * as E from '../src/engine';
import { applyDebuff } from '../src/engine/bossParts';
import { hexDist } from '../src/engine/board';
import { doDispel } from '../src/engine/heroes';

const until = (f: E.Fight, sec: number, done: () => boolean) => { while (!f.over && f.t < sec && !done()) { E.step(f); f.events.length = 0; } };
const only = (f: E.Fight, key: string, at = f.t) => { f.skills.forEach(s => { s.next = s.key === key ? at : Infinity; }); };
const echo = (BOSSES.crystal.skills.find(s => s.key === 'echo')!.effect as { p: 'debuff'; debuff: DebuffDef }).debuff;
/** u 옆 칸에 v를 세우고 나머지는 u에게서 떨어뜨림 */
const pair = (f: E.Fight, u: E.Unit, v: E.Unit | null) => {
  const free = (c: E.Fight['cells'][number]) => !c.block && !f.party.some(w => w.cell === c.i);
  for (const w of f.party) if (w !== u && w !== v && hexDist(f.cells[w.cell], f.cells[u.cell]) <= 1) {
    const far = f.cells.find(c => free(c) && hexDist(c, f.cells[u.cell]) >= 3)!;
    f.cells[w.cell].unit = null; w.cell = w.home = far.i; far.unit = w;
  }
  if (v && hexDist(f.cells[v.cell], f.cells[u.cell]) !== 1) {
    const c = f.cells.find(x => free(x) && hexDist(x, f.cells[u.cell]) === 1)!;
    f.cells[v.cell].unit = null; v.cell = v.home = c.i; c.unit = v;
  }
};

describe('무너진 망루', () => {
  it('Lv 35 던전 5인: 일반 → 파수꾼 → 정예 → 공명 수정', () => {
    const c = contentOf('watchtower');
    expect(c.unlockLv).toBe(35);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['rubblestair', 'sentinel', 'blackrift', 'crystal']);
  });

  it('파수꾼 갈고리 사슬: 끌려온 칸에 금빛 받침, 6초 끝에 그 사람이 맞음', () => {
    const f = E.create({ encounter: 'sentinel', diff: '보통', seed: 2, level: 35 });
    only(f, 'chain');
    until(f, 3, () => f.tels.some(t => t.ring));
    const ring = f.tels.find(t => t.ring)!;
    const u = E.living(f).find(x => x.id === ring.units[0])!;
    expect(u.pulled).toBeTruthy();
    expect([...ring.safe!]).toEqual([u.pulled!.cell]);
    const others = f.party.filter(x => x !== u).map(x => [x, x.hp] as const);
    u.hp = u.max;
    const hp = u.hp;
    until(f, ring.impact + 0.1, () => false);
    expect(u.hp).toBeLessThan(hp);
    expect(f.tels.some(t => t.ring)).toBe(false);
    // 받침 위 사람만 맞음 (평타는 탱커가 맞으니 탱커 빼고 봄)
    expect(others.filter(([x]) => x.role !== 'tank').every(([x, h]) => x.hp >= h - 1)).toBe(true);
  });

  it('파수꾼: 끌려온 사람이 받침을 벗어나면 빈 받침 = 전원 피해', () => {
    const f = E.create({ encounter: 'sentinel', diff: '보통', seed: 2, level: 35 });
    only(f, 'chain');
    until(f, 3, () => f.tels.some(t => t.ring));
    const ring = f.tels.find(t => t.ring)!;
    const u = f.party.find(x => x.id === ring.units[0])!;
    until(f, ring.start + 0.5, () => false);
    const away = f.cells.find(c => !c.block && !f.party.some(w => w.cell === c.i) && !ring.cells.has(c.i))!;
    f.cells[u.cell].unit = null; u.moving = null; u.cell = away.i; away.unit = u;
    const hp = f.party.map(x => x.hp);
    until(f, ring.impact + 0.05, () => false);
    expect(f.party.filter((x, i) => x.role !== 'tank' && x.hp < hp[i]).length).toBeGreaterThanOrEqual(3);
  });

  it('파수꾼: 악몽은 끌기 2명 · 50% 아래 끌기 20초', () => {
    expect(BOSSES.sentinel.skills.find(s => s.key === 'chain')!.target).toEqual({ p: 'back', n: 1, nMythic: 2 });
    const f = E.create({ encounter: 'sentinel', diff: '보통', seed: 2, level: 35 });
    until(f, 5, () => false);
    f.bossHp = f.bossMax * 0.45;
    until(f, 8, () => f.bs.chain.period === 20);
    expect(f.bs.chain.period).toBe(20);
  });

  it('공명 수정 메아리: 진동이 울리면 이웃 1명에게 옮겨붙고 +50%, 남은 시간 그대로', () => {
    const f = E.create({ encounter: 'crystal', diff: '보통', seed: 2, level: 35 });
    const [u, v] = f.party.filter(x => x.role === 'ranged');
    pair(f, u, v);
    only(f, 'quake', f.t + 2);
    applyDebuff(f, u, echo);
    const d0 = u.debuffs.find(d => d.name === '메아리')!;
    until(f, 6, () => !u.debuffs.includes(d0));
    const d1 = v.debuffs.find(d => d.name === '메아리')!;
    expect(d1).toBeTruthy();
    expect(d1.dot).toBeCloseTo(d0.dot! * 1.5);
    expect(d1.left).toBeLessThan(echo.left);
    expect(u.debuffs.some(d => d.name === '메아리')).toBe(false);
  });

  it('공명 수정 메아리: 옆에 아무도 없으면 진동에 사라지고, 지우면 옮겨붙지 않음', () => {
    const f = E.create({ encounter: 'crystal', diff: '보통', seed: 2, level: 35, hero: 'druid' });
    const [u, v] = f.party.filter(x => x.role === 'ranged');
    pair(f, u, null);
    only(f, 'quake', f.t + 2);
    applyDebuff(f, u, echo);
    until(f, 6, () => !u.debuffs.some(d => d.name === '메아리'));
    expect(f.party.some(x => x.debuffs.some(d => d.name === '메아리'))).toBe(false);
    // 지우기: 이웃이 있어도 그냥 사라짐
    pair(f, u, v);
    applyDebuff(f, u, echo);
    doDispel(f, u);
    E.step(f);
    expect(f.party.some(x => x.debuffs.some(d => d.name === '메아리'))).toBe(false);
  });

  it('공명 수정: 악몽은 메아리가 이웃 2명까지 갈라짐 · 40% 아래 진동 11초, 메아리 2명', () => {
    expect(echo.end).toMatchObject({ p: 'jump', on: 'quake', mult: 1.5, nMythic: 2 });
    const f = E.create({ encounter: 'crystal', diff: '보통', seed: 2, level: 35 });
    until(f, 5, () => false);
    f.bossHp = f.bossMax * 0.38;
    until(f, 8, () => f.phase === 2);
    expect(f.bs.quake.period).toBe(11);
    expect(f.bs.echo2.next).toBeLessThan(Infinity);
  });

  it('Lv 35 자동 힐러, 보통이면 대부분 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'watchtower', diff: '보통', seed: s, level: 35, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(18);
  });
});
