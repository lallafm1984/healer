/** 성장·보상 (24 문서): 경험치 곡선, 골드, 장비 드롭, 장비 능력치, 정산 */
import { describe, expect, it } from 'vitest';
import { contentOf, stageOf } from '../src/data/content';
import { avgScore, DROP_TABLE, gearStatsOf, ITEM_GRADES, rollItem, SLOTS, type Equipped } from '../src/data/equipment';
import { gearStats } from '../src/data/gear';
import { addXp, clearGold, clearXp, gradeOf, itemSlots, lvPower, starsOf, xpToNext } from '../src/data/progression';
import * as E from '../src/engine';
import { heal } from '../src/engine/core';
import { rngFrom } from '../src/engine';
import { settle, type BattleResult } from '../src/game/settle';
import { newSave } from '../src/platform/storage';

describe('경험치·레벨 (02 부록 B)', () => {
  it('필요 경험치 = 100 × 레벨^1.6', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(303);
    expect(xpToNext(10)).toBe(3981);
    expect(xpToNext(100)).toBe(Infinity);
  });
  it('경험치를 넘치게 받으면 여러 레벨이 한 번에 오름', () => {
    const p = { level: 1, xp: 0 };
    expect(addXp(p, 100 + 303 + 5)).toEqual([2, 3]);
    expect(p).toEqual({ level: 3, xp: 5 });
  });
  it('녹슨 요새 보통 A 클리어 1번 ≈ 한 레벨 조금 넘게, 단계보다 많이 높으면 줄어듦', () => {
    const at1 = clearXp(1, 1, '보통', 'A', { win: true });
    expect(at1 / xpToNext(1)).toBeCloseTo(1.1, 2);
    expect(clearXp(10, 1, '보통', 'A', { win: true }) / xpToNext(10)).toBeLessThan(0.3);
    expect(clearXp(1, 1, '보통', null, { win: false })).toBe(Math.round(at1 / 1.1 * 0.2));
  });
  it('Lv 1 → 15를 녹슨 요새·레이드 보통 A로 대략 12~25판 (18 1장: 하루 30~40분 1~2일)', () => {
    const p = { level: 1, xp: 0 };
    let runs = 0;
    while (p.level < 15 && runs < 200) { addXp(p, clearXp(p.level, p.level <= 5 ? 1 : p.level - 4, '보통', 'A', { win: true })); runs++; }
    expect(runs).toBeGreaterThanOrEqual(12);
    expect(runs).toBeLessThanOrEqual(25);
  });
  it('골드 = (50 + 10 × 단계) × 난이도 × 등급, 레이드 보스 ×2 (12 3-1)', () => {
    expect(clearGold(23, '보통', 'A')).toBe(308);
    expect(clearGold(1, '보통', 'B')).toBe(60);
    expect(clearGold(35, '어려움', 'S', 1)).toBe(Math.round(400 * 1.3 * 1.2 * 2));
  });
  it('등급·별·단축칸', () => {
    expect([0, 1, 2, 3, 4].map(gradeOf)).toEqual(['S', 'A', 'B', 'B', 'C']);
    expect(starsOf({ win: true, deaths: 0, overheal: 0.3 })).toEqual([true, true, true]);
    expect(starsOf({ win: true, deaths: 2, overheal: 0.5 })).toEqual([true, false, false]);
    expect(starsOf({ win: false, deaths: 0, overheal: 0 })).toEqual([false, false, false]);
    expect([1, 19, 20, 39, 40].map(itemSlots)).toEqual([2, 2, 3, 3, 4]);
  });
});

describe('레벨 배율 (07 4장, 18 2-1)', () => {
  it('Lv 1 = 1, 레벨마다 +0.08, Lv 100 ≈ 8.9배', () => {
    expect(lvPower(1)).toBe(1);
    expect(lvPower(2)).toBeCloseTo(1.08);
    expect(lvPower(100)).toBeCloseTo(8.92);
    expect(lvPower(0)).toBe(1);
    expect(lvPower(150)).toBeCloseTo(8.92);
  });

  it('레이드 악몽 단계 = Lv 70, 나머지는 콘텐츠 단계', () => {
    expect(stageOf(contentOf('abyss1'), '악몽')).toBe(70);
    expect(stageOf(contentOf('abyss1'), '보통')).toBe(35);
    expect(stageOf(contentOf('rustfort'), '어려움')).toBe(1);
  });

  const cfg = { encounter: 'warden' as const, diff: '보통' as const, seed: 3 };
  it('레벨을 안 주면 예전 그대로 (배율 1)', () => {
    const f = E.create(cfg);
    expect(f.scale).toBe(1);
    expect(f.power).toBe(1);
    expect(f.dmgMult).toBe(1);
  });

  it('단계 Lv 11 = 파티원·보스 체력·딜·피해 ×1.8, 같은 레벨 힐러도 ×1.8', () => {
    const a = E.create(cfg), b = E.create({ ...cfg, stageLv: 11, heroLv: 11 });
    expect(b.scale).toBeCloseTo(1.8);
    expect(b.power).toBeCloseTo(1.8);
    expect(b.bossMax).toBeCloseTo(a.bossMax * 1.8);
    expect(b.dmgMult).toBeCloseTo(1.8);
    b.party.forEach((u, i) => {
      expect(u.max).toBeCloseTo(a.party[i].max * 1.8);
      expect(u.dps).toBeCloseTo(a.party[i].dps * 1.8);
    });
    expect(E.partyDps(b)).toBeCloseTo(E.partyDps(a) * 1.8);
  });

  it('단계보다 높은 레벨만큼 힐량·내 체력만 커짐', () => {
    const a = E.create({ ...cfg, stageLv: 1, heroLv: 1 }), b = E.create({ ...cfg, stageLv: 1, heroLv: 6 });
    expect(b.power).toBeCloseTo(1.4);
    expect(b.me.max).toBeCloseTo(a.me.max * 1.4);
    const tank = b.party.find(u => u.role === 'tank')!;
    expect(tank.max).toBeCloseTo(a.party.find(u => u.role === 'tank')!.max);
    tank.hp = 1; b.gear = { ...b.gear, crit: 0 };
    heal(b, tank, 100, false);
    expect(tank.hp).toBeCloseTo(1 + 100 * b.gear.heal * 1.4);
  });

  it('단계보다 낮은 레벨은 단계로 봄 (개발 빌드 잠금 무시로 들어가도 힐이 줄지 않음)', () => {
    const f = E.create({ ...cfg, stageLv: 35, heroLv: 3 });
    expect(f.power).toBeCloseTo(f.scale);
  });

  it('자동 힐러: 단계와 레벨이 같으면 클리어율 차이 없음 (녹슨 요새 보통, 20판)', () => {
    const wins = (lv: number) => Array.from({ length: 20 }, (_, i) => E.simulateDungeon({ dungeon: 'rustfort', diff: '보통', gear: 'adv0', seed: i + 1, items: ['mana', 'life'], level: 12, heroLv: lv, stageLv: lv }).win).filter(Boolean).length;
    expect(Math.abs(wins(1) - wins(30))).toBeLessThanOrEqual(3);
  });
});

describe('장비 (02 10장)', () => {
  it('6부위가 같은 등급이면 프리셋 계산과 같은 능력치', () => {
    const all = (grade: '고급' | '희귀' | '영웅', plus: number): Equipped => Object.fromEntries(SLOTS.map((s, i) => [s.key, { id: i, slot: s.key, grade, plus, name: '' }]));
    expect(gearStatsOf({})).toEqual(gearStats('none'));
    expect(gearStatsOf(all('고급', 0))).toEqual(gearStats('adv0'));
    const r5 = gearStatsOf(all('희귀', 5)), p5 = gearStats('rare5');
    for (const k of ['heal', 'regen', 'haste', 'crit'] as const) expect(r5[k]).toBeCloseTo(p5[k], 10);
    expect(avgScore(all('희귀', 5))).toBeCloseTo(3.5);
  });
  it('드롭 등급 비율이 표를 따름, 전설은 Lv 50부터', () => {
    const rng = rngFrom(7);
    const count = (diff: '보통' | '악몽', level: number) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 4000; i++) { const it = rollItem(rng, diff, 'B', level, i); c[it.grade] = (c[it.grade] || 0) + 1; }
      return c;
    };
    const n = count('보통', 1);
    DROP_TABLE['보통'].forEach((p, i) => expect((n[ITEM_GRADES[i]] || 0) / 4000).toBeCloseTo(p, 1));
    expect(count('악몽', 10)['전설']).toBeUndefined();
    expect(count('악몽', 50)['전설']).toBeGreaterThan(200);
  });
  it('S 등급이면 상위 등급이 조금 더 잘 나옴', () => {
    const avg = (g: 'S' | 'C') => { const rng = rngFrom(3); let s = 0; for (let i = 0; i < 4000; i++) s += ITEM_GRADES.indexOf(rollItem(rng, '보통', g, 1, i).grade); return s / 4000; };
    expect(avg('S')).toBeGreaterThan(avg('C') + 0.03);
  });
  it('전투에 착용 장비 능력치가 들어감', () => {
    const st = gearStatsOf({ weapon: { id: 1, slot: 'weapon', grade: '영웅', plus: 0, name: '' } });
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, gearStats: st });
    expect(f.gear).toEqual(st);
  });
});

const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 1,
  healed: 7000, overheal: 3000, dispels: 0, dispellable: 0, endMana: 20, minMana: 5, auto: false,
  party: [{ nick: '가', pers: '덜렁이', role: 'melee', alive: true }, { nick: '나', pers: '신중파', role: 'tank', alive: true }, { nick: '다', pers: '감사형', role: 'ranged', alive: false }],
  detail: [], ...o,
});

describe('정산 (09 S08·S09)', () => {
  it('클리어: 등급·별·골드·경험치·장비 1개, 기록 저장', () => {
    const s = newSave(1);
    const x = settle(s, result(), rngFrom(1));
    expect(x.grade).toBe('A');
    expect(x.stars).toEqual([true, false, true]);
    expect(x.overhealPct).toBe(30);
    expect(x.dispelPct).toBeNull();
    expect(x.gold).toBe(clearGold(contentOf('rustfort').stageLv, '보통', 'A'));
    expect(s.player.gold).toBe(x.gold);
    expect(x.levelUps).toEqual([2]); // 첫 클리어로 Lv 2
    expect(s.player.xp).toBe(x.xp - 100);
    expect(x.item).not.toBeNull();
    expect(s.gear.bag).toEqual([x.item]);
    expect(s.nextId).toBe(2);
    expect(s.clears.rustfort!['보통']).toEqual({ stars: 2, grade: 'A', best: 360, n: 1 });
    expect(x.first).toBe(true);
    expect(s.last).toEqual({ content: 'rustfort', diff: '보통', win: true, grade: 'A' });
  });
  it('다시 깨면 별·등급·최고 기록은 좋은 쪽을 남김', () => {
    const s = newSave(1);
    settle(s, result({ deaths: 0, overheal: 1000, time: 400 }), rngFrom(1));
    const x = settle(s, result({ deaths: 3, overheal: 5000, time: 300 }), rngFrom(2));
    expect(x.first).toBe(false);
    expect(x.best).toBe(true);
    expect(s.clears.rustfort!['보통']).toEqual({ stars: 3, grade: 'S', best: 300, n: 2 });
  });
  it('지면 골드·장비 없음, 경험치 20%. 포기하면 경험치도 없음', () => {
    const s = newSave(1);
    const x = settle(s, result({ win: false, segIdx: 1 }), rngFrom(1));
    expect([x.grade, x.gold, x.item]).toEqual([null, 0, null]);
    expect(x.xp).toBe(clearXp(1, 1, '보통', null, { win: false }));
    expect(s.clears).toEqual({});
    const q = settle(s, result({ win: false, quit: true }), rngFrom(1));
    expect(q.xp).toBe(0);
  });
  it('레벨 업 목록', () => {
    const s = newSave(1);
    s.player.xp = 99;
    const x = settle(s, result(), rngFrom(1));
    expect(x.levelBefore).toBe(1);
    expect(x.levelUps).toEqual([2]);
    s.player.level = 3; s.player.xp = 0;
    expect(settle(s, result({ win: false }), rngFrom(1)).levelUps).toEqual([]);
  });
});
