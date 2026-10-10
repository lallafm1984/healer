/** 성장·보상 (24 문서): 경험치 곡선, 골드, 장비 드롭, 장비 능력치, 정산 */
import { describe, expect, it } from 'vitest';
import { contentOf, stageOf } from '../src/data/content';
import { avgScore, DROP_TABLE, gearStatsOf, ITEM_GRADES, rollItem, SLOTS, type Equipped } from '../src/data/equipment';
import { gearStats } from '../src/data/gear';
import { RULES } from '../src/data/rules';
import { addXp, clearGold, clearXp, gradeOf, itemSlots, lvPower, lvPowerProto, starsOf, xpToNext } from '../src/data/progression';
import * as E from '../src/engine';
import { heal } from '../src/engine/core';
import { rngFrom } from '../src/engine';
import { settle, type BattleResult } from '../src/game/settle';
import { newSave } from '../src/platform/storage';
import { TUT } from '../src/game/tutorial';

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
  it('녹슨 요새 보통 A 클리어 1번 ≈ 한 레벨 조금 넘게, 적이 늘 내 레벨이라 넘침 감소 없음 (32)', () => {
    const at1 = clearXp(1, '보통', 'A', { win: true });
    expect(at1 / xpToNext(1)).toBeCloseTo(1.1, 2);
    expect(clearXp(15, '보통', 'A', { win: true }) / xpToNext(15)).toBeCloseTo(1.1 * 0.85 * 14 * 15 ** -1.1, 2);
    expect(clearXp(1, '보통', null, { win: false })).toBe(Math.round(at1 / 1.1 * 0.2));
    expect(clearXp(40, '보통', 'A', { raid: 10, win: true }) / clearXp(40, '보통', 'A', { win: true })).toBeCloseTo(1.2, 2);
  });
  it('Lv 1 → 100 도달 시점이 18 1장과 맞음 (하루 8판, 그 레벨에서 가장 좋은 콘텐츠, 보통 A)', () => {
    // 적 = 내 레벨 (32): 던전, 10인 레이드 Lv 35부터 (×1.2), 20인 레이드 Lv 70부터 (×1.4)
    const best = (lv: number) => {
      const opts: (0 | 10 | 20)[] = [0];
      if (lv >= 35) opts.push(10);
      if (lv >= 70) opts.push(20);
      return Math.max(...opts.map(raid => clearXp(lv, '보통', 'A', { raid, win: true })));
    };
    const p = { level: 1, xp: 0 }, day: Record<number, number> = {};
    for (let run = 1; p.level < 100 && run < 5000; run++) { for (const u of addXp(p, best(p.level))) day[u] = run / 8; }
    expect(day[15]).toBeLessThan(3);
    expect(day[35]).toBeGreaterThan(6); expect(day[35]).toBeLessThan(14);
    expect(day[70]).toBeGreaterThan(25); expect(day[70]).toBeLessThan(45);
    expect(day[100]).toBeGreaterThan(70); expect(day[100]).toBeLessThan(110);
  });
  it('Lv 1 → 15를 녹슨 요새·레이드 보통 A로 대략 12~25판 (18 1장: 하루 30~40분 1~2일)', () => {
    const p = { level: 1, xp: 0 };
    let runs = 0;
    while (p.level < 15 && runs < 200) { addXp(p, clearXp(p.level, '보통', 'A', { win: true })); runs++; }
    expect(runs).toBeGreaterThanOrEqual(12);
    expect(runs).toBeLessThanOrEqual(25);
  });
  it('골드 = (50 + 10 × 단계) × 난이도 × 등급, 레이드 보스 10인 ×1.5 · 20인 ×2.2 (12 3-1, 32 3장)', () => {
    expect(clearGold(23, '보통', 'A')).toBe(308);
    expect(clearGold(1, '보통', 'B')).toBe(60);
    expect(clearGold(35, '어려움', 'S', 10)).toBe(Math.round(400 * 1.3 * 1.2 * 1.5));
    expect(clearGold(70, '보통', 'A', 20)).toBe(Math.round(750 * 1.1 * 2.2));
  });
  it('등급·별·단축칸', () => {
    expect([0, 1, 2, 3, 4].map(gradeOf)).toEqual(['S', 'A', 'B', 'B', 'C']);
    expect(starsOf({ win: true, deaths: 0, overheal: 0.3 })).toEqual([true, true, true]);
    expect(starsOf({ win: true, deaths: 2, overheal: 0.5 })).toEqual([true, false, false]);
    expect(starsOf({ win: false, deaths: 0, overheal: 0 })).toEqual([false, false, false]);
    expect([1, 14, 15, 29, 30].map(itemSlots)).toEqual([2, 2, 3, 3, 4]);
  });
});

describe('레벨 배율 (07 4장, 18 2-1)', () => {
  it('Lv 1 = 1, 레벨마다 +0.08, Lv 100 ≈ 8.9배', () => {
    // 34 1-2: Lv 1 = 0.4 (숫자 ÷2.5), 레벨마다 Lv 1 값의 +22% → Lv 100 ≈ 9.1
    expect(lvPower(1)).toBeCloseTo(0.4);
    expect(lvPower(2)).toBeCloseTo(0.488);
    expect(lvPower(100) / lvPower(1)).toBeCloseTo(22.78);
    expect(lvPower(0)).toBeCloseTo(0.4);
    expect(lvPower(150)).toBeCloseTo(lvPower(100));
    expect(lvPowerProto(1)).toBe(1);
    expect(lvPowerProto(100)).toBeCloseTo(8.92);
  });

  it('10인 악몽 단계 = Lv 50, 20인 = Lv 70 (악몽 80), 나머지는 콘텐츠 단계 (26)', () => {
    expect(stageOf(contentOf('abyss1'), '악몽')).toBe(50);
    expect(stageOf(contentOf('abyss1'), '보통')).toBe(35);
    expect(stageOf(contentOf('cathedral1'), '보통')).toBe(70);
    expect(stageOf(contentOf('cathedral1'), '악몽')).toBe(80);
    expect(stageOf(contentOf('rustfort'), '어려움')).toBe(5);
    expect(stageOf(contentOf('cemetery'), '보통')).toBe(3);
  });

  const cfg = { encounter: 'warden' as const, diff: '보통' as const, seed: 3 };
  it('레벨을 안 주면 Lv 1: 숫자 ÷2.5, 적·파티원은 내 세기 × 0.95, 적 피해 × 0.85 (34 1-2 · 1-4)', () => {
    const f = E.create({ ...cfg, tune: {} }); // 난이도 보정 (data/tune) 없이
    expect(f.power).toBeCloseTo(0.4);
    expect(f.scale).toBeCloseTo(0.4 * 0.95);
    expect(f.dmgMult).toBeCloseTo(0.4 * 0.95 * 0.85);
    expect(f.me.max).toBeCloseTo(220);
    const p = E.create({ ...cfg, proto: true });
    expect([p.scale, p.power, p.dmgMult]).toEqual([1, 1, 1]);
  });

  it('단계 Lv 11 = 파티원·보스 체력·딜·피해 ×3.2, 같은 레벨 힐러도 ×3.2', () => {
    const a = E.create(cfg), b = E.create({ ...cfg, stageLv: 11, heroLv: 11 });
    expect(b.scale / a.scale).toBeCloseTo(3.2);
    expect(b.power / a.power).toBeCloseTo(3.2);
    expect(b.bossMax).toBeCloseTo(a.bossMax * 3.2);
    expect(b.dmgMult).toBeCloseTo(a.dmgMult * 3.2);
    b.party.forEach((u, i) => {
      expect(u.max).toBeCloseTo(a.party[i].max * 3.2);
      expect(u.dps).toBeCloseTo(a.party[i].dps * 3.2);
    });
    expect(E.partyDps(b)).toBeCloseTo(E.partyDps(a) * 3.2);
  });

  it('단계보다 높은 레벨만큼 힐량·내 체력만 커짐', () => {
    const a = E.create({ ...cfg, stageLv: 1, heroLv: 1 }), b = E.create({ ...cfg, stageLv: 1, heroLv: 6 });
    expect(b.power / a.power).toBeCloseTo(2.1);
    expect(b.me.max).toBeCloseTo(a.me.max * 2.1);
    const tank = b.party.find(u => u.role === 'tank')!;
    expect(tank.max).toBeCloseTo(a.party.find(u => u.role === 'tank')!.max);
    tank.hp = 1; b.gear = { ...b.gear, crit: 0 };
    heal(b, tank, 100, false);
    expect(tank.hp).toBeCloseTo(1 + 100 * b.gear.heal * b.power);
  });

  it('단계보다 낮은 레벨은 단계로 봄 (개발 빌드 잠금 무시로 들어가도 힐이 줄지 않음)', () => {
    const f = E.create({ ...cfg, stageLv: 35, heroLv: 3 });
    expect(f.power * 0.95).toBeCloseTo(f.scale);
  });

  it('자동 힐러: 단계와 레벨이 같으면 클리어율 차이 없음 (녹슨 요새 보통, 20판)', () => {
    const wins = (lv: number) => Array.from({ length: 20 }, (_, i) => E.simulateDungeon({ dungeon: 'rustfort', diff: '보통', gear: 'adv0', seed: i + 1, items: ['mana', 'life'], level: 12, heroLv: lv, stageLv: lv }).win).filter(Boolean).length;
    expect(Math.abs(wins(1) - wins(30))).toBeLessThanOrEqual(3);
  });
});

describe('장비 (02 10장)', () => {
  it('장비 없음 = 프리셋 none, 평균 점수 = 등급 + 강화/10 (추가 옵션 굴림 없을 때)', () => {
    const all = (grade: '고급' | '희귀' | '영웅', plus: number): Equipped => Object.fromEntries(SLOTS.map((s, i) => [s.key, { id: i, slot: s.key, kind: '', grade, plus, name: '', lines: [] }]));
    expect(gearStatsOf({})).toEqual(gearStats('none'));
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
    const st = gearStatsOf({ weapon: { id: 1, slot: 'weapon', kind: 'staff', grade: '영웅', plus: 0, name: '', lines: [{ stat: 'hp', roll: 1 }] } });
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, gearStats: st });
    expect(f.gear).toEqual({ ...st, heal: st.heal * RULES.heal }); // 지능에는 치유 배율이 곱해짐 (34 1-6)
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
    expect(x.items.length).toBe(1); // 튜토리얼 중엔 1개
    expect(s.gear.bag).toEqual(x.items);
    expect(s.nextId).toBe(2);
    expect(s.clears.rustfort!['보통']).toEqual({ stars: 2, grade: 'A', best: 360, n: 1 });
    expect(x.first).toBe(true);
    expect(s.last).toEqual({ content: 'rustfort', diff: '보통', win: true, grade: 'A' });
  });
  it('튜토리얼 뒤 던전은 보스마다 장비 1개, 탐험은 1개 · 고급까지 (34 6-7)', () => {
    const s = newSave(1);
    s.tut = TUT.done;
    const x = settle(s, result(), rngFrom(1));
    expect(x.items.length).toBe(contentOf('rustfort').bosses.length);
    expect(s.gear.bag).toEqual(x.items);
    for (let i = 0; i < 40; i++) {
      const e = settle(s, result({ content: 'plateau', diff: '악몽', deaths: 0 }), rngFrom(i));
      expect(e.items.length).toBe(1);
      expect(['일반', '고급']).toContain(e.items[0].grade);
    }
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
    expect([x.grade, x.gold, x.items]).toEqual([null, 0, []]);
    expect(x.xp).toBe(clearXp(1, '보통', null, { win: false }));
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
