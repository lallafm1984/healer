/** 레이드 10인·20인 분리 (26): 콘텐츠 카드, 10인 악몽 전용 기술, 20인 무음 성가대 */
import { describe, expect, it } from 'vitest';
import { armorFactor } from '../src/data/armor';
import { ALL_DIFFS, contentOf, raidSize } from '../src/data/content';
import { MYTHIC } from '../src/data/difficulty';
import * as E from '../src/engine';
import { bossSkill, CHOIR, type SkillEffect } from '../src/data/bosses';
import { addDebuff } from '../src/engine/core';
import { doDispel } from '../src/engine/heroes';

type F = ReturnType<typeof E.create>;
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };

describe('콘텐츠', () => {
  it('10인 심연의 종탑: 난이도 4개 모두 10인 역병 군주, 악몽 Lv 50', () => {
    const c = contentOf('abyss1');
    for (const d of ALL_DIFFS) { expect(c.size(d)).toBe(10); expect(c.fights(d)).toEqual(['plague']); }
    expect(c.diffUnlock).toEqual({ '악몽': 50 });
    expect(raidSize(c)).toBe(10);
  });
  it('20인 가라앉은 대성당: 따로 된 레이드, Lv 70 (악몽 80)', () => {
    const c = contentOf('cathedral1');
    for (const d of ALL_DIFFS) { expect(c.size(d)).toBe(20); expect(c.fights(d)).toEqual(['choir']); }
    expect([c.unlockLv, c.diffUnlock!['악몽']]).toEqual([70, 80]);
    expect(raidSize(c)).toBe(20);
    expect(raidSize(contentOf('rustfort'))).toBe(0);
  });
  it('악몽 보스 체력 ×1.3은 10인·20인도 같음', () => {
    for (const enc of ['plague', 'choir'] as const) {
      const a = E.create({ encounter: enc, diff: '보통', seed: 1 }), b = E.create({ encounter: enc, diff: '악몽', seed: 1 });
      expect(b.bossMax / a.bossMax).toBeCloseTo(MYTHIC.bossHp, 5);
    }
  });
});

describe('10인 역병 군주 악몽 (26 3-1)', () => {
  it('2페이즈 전염은 악몽만 2명', () => {
    for (const [diff, n] of [['어려움', 1], ['악몽', 2]] as const) {
      const f = E.create({ encounter: 'plague', diff, seed: 3 });
      f.phase = 2;
      f.bs.contagion.fire!(f);
      const hit = f.party.filter(u => u.debuffs.some(d => d.name === '전염')).length;
      // 두 대상이 붙어 있으면 걸리자마자 터져서 남는 사람이 없음
      const popped = f.events.some(e => /바로 터짐/.test((e as { text?: string }).text || ''));
      expect(popped ? 2 : hit).toBe(n);
    }
  });
  it('역병 폭풍은 악몽 30% 아래에서만, 판 바깥 1열 (줄마다 1칸)을 좌우 번갈아', () => {
    const hard = E.create({ encounter: 'plague', diff: '어려움', seed: 1 });
    hard.phase = 2; hard.bossHp = hard.bossMax * 0.2; steps(hard, 0.1);
    expect(hard.phase).toBe(2);
    const f = E.create({ encounter: 'plague', diff: '악몽', seed: 1 });
    f.phase = 2; f.bossHp = f.bossMax * 0.2; steps(f, 0.1);
    expect(f.phase).toBe(3);
    const a = f.bs.storm.cellsFor!(f), b = f.bs.storm.cellsFor!(f);
    expect(a.size).toBe(f.rows);
    expect(b.size).toBe(f.rows);
    expect([...a].some(i => b.has(i))).toBe(false);
    const px = (s: Set<number>) => [...s].map(i => f.cells[i].px);
    expect(Math.max(...px(a)) < Math.min(...px(b)) || Math.max(...px(b)) < Math.min(...px(a))).toBe(true);
  });
});

describe('20인 무음 성가대 (26 4-3)', () => {
  const fight = (diff: '보통' | '악몽' = '보통') => E.create({ encounter: 'choir', diff, seed: 5 });
  it('성가대원 3 + 지휘자, 파티 딜은 왼쪽 성부부터 (지휘자는 마지막)', () => {
    const f = fight();
    expect(f.mobs.map(m => m.name)).toEqual([...CHOIR.voices, '지휘자']);
    expect(f.mobs[3].boss).toBe(true);
    expect(f.board).toBe('b30');
    expect(f.party.length).toBe(20);
    steps(f, 20);
    expect(f.mobs[0].hp).toBeLessThan(f.mobs[0].max);
    expect(f.mobs[3].hp).toBe(f.mobs[3].max);
  });
  it('노래: 살아 있는 성가대원의 2열에 선 사람만 피해', () => {
    const f = fight();
    f.mobs[0].alive = false; f.mobs[0].hp = 0; f.mobs[1].alive = false; f.mobs[1].hp = 0;
    f.skills.forEach(s => { s.next = Infinity; }); // 다른 기술은 끔
    for (const u of f.party) u.hp = u.max;
    steps(f, 2);
    const hurt = f.party.filter(u => u.hp < u.max);
    expect(hurt.length).toBeGreaterThan(0);
    expect(hurt.every(u => f.cells[u.cell].col >= 4)).toBe(true);
  });
  it('크레센도는 성부 하나의 2열 (10칸), 악몽 불협화음은 두 성부 4열 (20칸)', () => {
    const f = fight(), cr = f.skills.find(s => s.key === 'crescendo')!;
    const a = cr.cellsFor!(f), b = cr.cellsFor!(f);
    expect(a.size).toBe(10);
    expect(new Set([...a].map(i => f.cells[i].col))).toEqual(new Set([0, 1]));
    expect(new Set([...b].map(i => f.cells[i].col))).toEqual(new Set([2, 3]));
    const m = fight('악몽'), mc = m.skills.find(s => s.key === 'crescendo')!;
    expect(mc.cellsFor!(m).size).toBe(20);
    expect(mc.dps).toBeCloseTo(CHOIR.crescDps * CHOIR.discord, 5);
  });
  it('성가대원을 다 잡으면 2페이즈 (포르테·독창)', () => {
    const f = fight();
    for (let i = 0; i < 3; i++) { f.mobs[i].alive = false; f.mobs[i].hp = 0; }
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.forte.next).toBeLessThan(Infinity);
    expect(f.bs.solo.next).toBeLessThan(Infinity);
  });
  it('독창: 지우면 그냥 사라지고, 끝나면 그 사람이 선 열 전체 피해', () => {
    const f = fight();
    const u = f.party.find(x => !x.me && x.role !== 'tank')!;
    const col = f.cells[u.cell].col;
    const same = f.party.filter(v => f.cells[v.cell].col === col);
    for (const v of f.party) v.hp = v.max;
    const solo = (bossSkill('choir', 'solo').effect as Extract<SkillEffect, { p: 'debuff' }>).debuff;
    addDebuff(f, u, { ...solo, left: 0.01 });
    doDispel(f, u);
    expect(same.every(v => v.hp === v.max)).toBe(true);
    f.skills.forEach(s => { s.next = Infinity; });
    f.mobs.forEach(m => { m.alive = m.boss!; if (!m.boss) m.hp = 0; }); // 노래 끔
    f.phase = 2;
    addDebuff(f, u, { ...solo, left: 0.01 });
    steps(f, 0.1);
    expect(same.every(v => v.max - v.hp >= 200 * f.dmgMult * armorFactor(v.role, 'party') - 1e-6)).toBe(true);
  });
  it('보통 자동 힐러 (영웅 장비)로 깰 수 있음', () => {
    let win = 0;
    for (let s = 1; s <= 5; s++) if (E.simulate({ encounter: 'choir', diff: '보통', gear: 'epic5', seed: s, items: ['mana', 'life'] }).over === 'win') win++;
    expect(win).toBeGreaterThanOrEqual(3);
  });
});
