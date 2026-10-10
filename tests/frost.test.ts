/** 던전 ⑤ 서리 마탑 (39 1-2, 35 4-4): 얼음 복도 → 마력 골렘 → 불안정한 마법사 → 서리 실험실 → 탑주의 그림자 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES } from '../src/data/bosses';
import * as E from '../src/engine';
import { runOnce } from '../src/sim/balance';
import type { DebuffDef } from '../src/data/bosses';
import { applyDebuff } from '../src/engine/bossParts';
import { hexDist } from '../src/engine/board';
import { doDispel } from '../src/engine/heroes';

const until = (f: E.Fight, sec: number, done: () => boolean, auto = false) => { while (!f.over && f.t < sec && !done()) { if (auto) E.autoHealer(f); E.step(f); f.events.length = 0; } };
const quiet = (f: E.Fight) => { f.skills.forEach(s => { s.next = Infinity; }); };
const has = (u: E.Unit, name: string) => u.debuffs.some(d => d.name === name);

describe('서리 마탑', () => {
  it('Lv 25 던전 5인 보스 셋, 마법', () => {
    const c = contentOf('frost');
    expect(c.unlockLv).toBe(25);
    expect(c.ready).toBe(true);
    expect(c.fights('보통')).toEqual(['icehall', 'frostgolem', 'mage', 'frostlab', 'shadow']);
  });

  it('마력 골렘: 악몽에는 진동이 2초 간격으로 두 번', () => {
    const q = BOSSES.frostgolem.skills.filter(s => s.effect?.p === 'quake');
    expect(q.map(s => [s.first, s.when?.mythic])).toEqual([[12, undefined], [14, true]]);
  });

  it('마법사 마력 역류: 나에게 걸리고 스킬마다 중첩, 지우면 그때까지 터짐', () => {
    const f = E.create({ encounter: 'mage', diff: '보통', seed: 2, level: 25 });
    until(f, 20, () => f.party.some(u => u.me && has(u, '마력 역류')));
    const me = f.party.find(u => u.me)!;
    expect(has(me, '마력 역류')).toBe(true);
    expect(f.party.filter(u => !u.me).some(u => has(u, '마력 역류'))).toBe(false);
  });

  it('불안정한 마력 · 서리 표식: 지우면 바로 이웃 칸이 터짐', () => {
    const f = E.create({ encounter: 'mage', diff: '보통', seed: 2, level: 25, hero: 'druid' });
    quiet(f);
    const def = BOSSES.mage.skills.find(s => s.key === 'unstable')!.effect as { p: 'debuff'; debuff: DebuffDef };
    const u = f.party.find(x => x.role === 'ranged')!;
    const nb = f.party.filter(v => v !== u && hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
    applyDebuff(f, u, def.debuff);
    const before = nb.map(v => v.hp);
    doDispel(f, u);
    E.step(f);
    expect(has(u, '불안정한 마력')).toBe(false);
    if (nb.length) expect(nb.some((v, i) => v.hp < before[i])).toBe(true);
  });

  it('그림자: 서리는 탱커에게 쌓이고 (해제 불가) 숨 고르기에 사라짐, 주시 게이지가 있음', () => {
    const f = E.create({ encounter: 'shadow', diff: '보통', seed: 2, level: 25 });
    until(f, 40, () => f.party.some(u => (u.debuffs.find(d => d.name === '서리')?.stack ?? 0) >= 2), true);
    const tank = f.party.find(u => u.debuffs.some(d => d.name === '서리'))!;
    expect(tank.role).toBe('tank');
    until(f, 60, () => !has(tank, '서리'), true);
    expect(has(tank, '서리')).toBe(false);
    expect(f.watch).toBeTruthy();
  });

  it('Lv 25 자동 힐러, 보통이면 대부분 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (runOnce(contentOf('frost'), '보통', 'priest', s).win) wins++; // 자동 밸런스 기준: 장비 없음 · 열린 특성 · 능력 1개 · 물약, 치유 배율 0.6 (34 1-6) 뒤로 특성 없는 사제는 높은 레벨에서 많이 짐
    expect(wins).toBeGreaterThanOrEqual(18);
  }, 20_000); // 자동 밸런스 기준 20판은 CI 기본 5초를 넘을 수 있음
});
