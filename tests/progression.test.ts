/** 성장·보상 (24 문서): 경험치 곡선, 골드, 장비 드롭, 장비 능력치, 정산 */
import { describe, expect, it } from 'vitest';
import { chalDropDiff } from '../src/data/challenge';
import { CLASSES } from '../src/data/classes';
import { CONTENT, contentOf, isLeveling, stageOf } from '../src/data/content';
import { avgScore, dropTable, gearStatsOf, ITEM_GRADES, rollItem, SLOTS, type Equipped } from '../src/data/equipment';
import { gearStats } from '../src/data/gear';
import { RULES } from '../src/data/rules';
import { addXp, clearXp, gradeOf, inRamp, lvPower, lvPowerProto, RAMP_FIRST, RAMP_FIRST_FOUR, RAMP_FOUR_LV, RAMP_LV, RAMP_REPEAT, rampDiffs, rampShare, rampSpan, rampXp, starsOf, xpToNext } from '../src/data/progression';
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
    expect(clearXp(1, '보통', null, { win: false })).toBe(0);
    expect(clearXp(40, '보통', 'A', { raid: 10, win: true }) / clearXp(40, '보통', 'A', { win: true })).toBeCloseTo(1.2, 2);
  });
  it('Lv 1 → 100 도달 시점이 18 1장과 맞음 (하루 8판, 그 레벨에서 가장 좋은 콘텐츠, 보통 A)', () => {
    // 적 = 내 레벨 (32): 던전, 10인 레이드 열림 (Lv 45)부터 (×1.2), 20인 레이드 Lv 70부터 (×1.4)
    const best = (lv: number) => {
      const opts: (0 | 10 | 20)[] = [0];
      if (lv >= contentOf('abyss1').unlockLv) opts.push(10);
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
  it('등급·별·단축칸', () => {
    expect([0, 1, 2, 3, 4].map(gradeOf)).toEqual(['S', 'A', 'B', 'B', 'C']);
    expect(starsOf({ win: true, deaths: 0, overheal: 0.3 })).toEqual([true, true, true]);
    expect(starsOf({ win: true, deaths: 2, overheal: 0.5 })).toEqual([true, false, false]);
    expect(starsOf({ win: false, deaths: 0, overheal: 0 })).toEqual([false, false, false]);
  });
});

describe('레벨 배율 (07 4장, 18 2-1)', () => {
  it('Lv 1 = 1, 레벨마다 +0.08, Lv 100 ≈ 8.9배', () => {
    // 34 1-2: Lv 1 = 0.4 (숫자 ÷2.5), 레벨마다 Lv 1 값의 +16% → Lv 100 ≈ 6.74 (2026-10-13 Lim 「100레벨 탱커 6천대」)
    expect(lvPower(1)).toBeCloseTo(0.4);
    expect(lvPower(2)).toBeCloseTo(0.464);
    expect(lvPower(100) / lvPower(1)).toBeCloseTo(16.84);
    expect(lvPower(0)).toBeCloseTo(0.4);
    expect(lvPower(150)).toBeCloseTo(lvPower(100));
    expect(lvPowerProto(1)).toBe(1);
    expect(lvPowerProto(100)).toBeCloseTo(8.92);
  });

  it('10인 악몽 단계 = Lv 60, 20인 = Lv 70 (악몽 80), 나머지는 콘텐츠 단계 (26)', () => {
    expect(stageOf(contentOf('abyss1'), '악몽')).toBe(60);
    expect(stageOf(contentOf('abyss1'), '보통')).toBe(45);
    expect(stageOf(contentOf('cathedral1'), '보통')).toBe(70);
    expect(stageOf(contentOf('cathedral1'), '악몽')).toBe(80);
    // 탐험 · 던전은 장소 레벨 + 난이도 (61 1-2)
    expect(stageOf(contentOf('rustfort'), '어려움')).toBe(9);
    expect(stageOf(contentOf('cemetery'), '보통')).toBe(9);
    expect(stageOf(contentOf('heartcrack'), '쉬움')).toBe(100);
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

  it('단계 Lv 11 = 파티원·보스 체력·딜·피해 ×2.6, 같은 레벨 힐러도 ×2.6', () => {
    const a = E.create(cfg), b = E.create({ ...cfg, stageLv: 11, heroLv: 11 });
    expect(b.scale / a.scale).toBeCloseTo(2.6);
    expect(b.power / a.power).toBeCloseTo(2.6);
    expect(b.bossMax).toBeCloseTo(a.bossMax * 2.6);
    expect(b.dmgMult).toBeCloseTo(a.dmgMult * 2.6);
    b.party.forEach((u, i) => {
      expect(u.max).toBeCloseTo(a.party[i].max * 2.6);
      expect(u.dps).toBeCloseTo(a.party[i].dps * 2.6);
    });
    expect(E.partyDps(b)).toBeCloseTo(E.partyDps(a) * 2.6);
  });

  it('Lv 100 탱커 체력 6천대 (2026-10-13 Lim 「100레벨 기준 탱커 6천대」): 전사 6,399 · 수호기사 6,079', () => {
    const f = E.create({ ...cfg, stageLv: 100, heroLv: 100 });
    expect(Math.round(f.party.find(u => u.role === 'tank')!.max)).toBe(6399);
    expect(Math.round(CLASSES.paladin.hp * lvPower(100) * 0.95)).toBe(6079);
  });

  it('단계보다 높은 레벨만큼 힐량·내 체력만 커짐', () => {
    const a = E.create({ ...cfg, stageLv: 1, heroLv: 1 }), b = E.create({ ...cfg, stageLv: 1, heroLv: 6 });
    expect(b.power / a.power).toBeCloseTo(1.8);
    expect(b.me.max).toBeCloseTo(a.me.max * 1.8);
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
    // 장비는 레벨과 상관없는 같은 능력치 (프리셋 % 옵션은 아이템 레벨로 바뀌어서, 2026-10-16)
    const wins = (lv: number) => Array.from({ length: 20 }, (_, i) => E.simulateDungeon({ dungeon: 'rustfort', diff: '보통', gearStats: gearStats('adv0', 50), seed: i + 1, level: 12, heroLv: lv, stageLv: lv }).win).filter(Boolean).length;
    expect(Math.abs(wins(1) - wins(30))).toBeLessThanOrEqual(3);
  });
});

describe('장비 (02 10장)', () => {
  it('장비 없음 = 프리셋 none, 평균 점수 = 등급 + 강화/10 (추가 옵션 굴림 없을 때)', () => {
    const all = (grade: '고급' | '희귀' | '영웅', plus: number): Equipped => Object.fromEntries(SLOTS.map((s, i) => [s.key, { id: i, slot: s.key, kind: '', grade, plus, name: '', lines: [] }]));
    expect(gearStatsOf({}, 1)).toEqual(gearStats('none'));
    expect(avgScore(all('희귀', 5), 30)).toBeCloseTo(3.5);
  });
  it('드롭 등급 비율이 표를 따름, 전설은 20인 · Lv 100부터 (61 3장 · 88)', () => {
    const rng = rngFrom(7);
    const count = (diff: '보통' | '악몽', level: number, raid: 0 | 10 | 20 = 0) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 4000; i++) { const it = rollItem(rng, diff, 'B', level, i, { raid }); c[it.grade] = (c[it.grade] || 0) + 1; }
      return c;
    };
    for (const raid of [0, 10, 20] as const) {
      const n = count('보통', 1, raid);
      dropTable('보통', raid).forEach((p, i) => expect((n[ITEM_GRADES[i]] || 0) / 4000).toBeCloseTo(p, 1));
    }
    expect(count('악몽', 100)['전설']).toBeUndefined();
    expect(count('악몽', 100, 10)['전설']).toBeUndefined();
    expect(count('악몽', 99, 20)['전설']).toBeUndefined(); // 88: 전설은 Lv 100부터
    expect(count('악몽', 100, 20)['전설']).toBeGreaterThan(4000 * 0.05 * 0.7);
  });
  it('S 등급이면 상위 등급이 조금 더 잘 나옴', () => {
    const avg = (g: 'S' | 'C') => { const rng = rngFrom(3); let s = 0; for (let i = 0; i < 4000; i++) s += ITEM_GRADES.indexOf(rollItem(rng, '보통', g, 1, i).grade); return s / 4000; };
    expect(avg('S')).toBeGreaterThan(avg('C') + 0.03);
  });
  it('전투에 착용 장비 능력치가 들어감', () => {
    const st = gearStatsOf({ weapon: { id: 1, slot: 'weapon', kind: 'staff', grade: '영웅', plus: 0, name: '', lines: [{ stat: 'hp', roll: 1 }] } }, 30);
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
  it('클리어: 등급·별·경험치·장비 1개, 기록 저장 (골드는 v16에 없앰)', () => {
    const s = newSave(1);
    const x = settle(s, result(), rngFrom(1));
    expect(x.grade).toBe('A');
    expect(x.stars).toEqual([true, false, true]);
    expect(x.overhealPct).toBe(30);
    expect(x.dispelPct).toBeNull();
    expect(x).not.toHaveProperty('gold');
    expect(s.player).not.toHaveProperty('gold');
    // Lv 20까지는 장소가 정한 경험치 (70): 녹슨 요새 보통 첫 클리어 = 장소 몫 60%
    expect(x.xp).toBe(rampXp(contentOf('rustfort'), '보통', { first: true, grade: 'A', win: true }));
    expect(x.levelUps).toEqual([2, 3]);
    expect(s.player.xp).toBe(x.xp - 100 - 303);
    expect(x.items.length).toBe(1); // 튜토리얼 중엔 1개
    expect(s.gear.bag).toEqual(x.items);
    expect(s.nextId).toBe(2);
    expect(s.clears.rustfort!['보통']).toEqual({ stars: 2, grade: 'A', best: 360, n: 1 });
    expect(x.first).toBe(true);
    expect(s.last).toEqual({ content: 'rustfort', diff: '보통', win: true, grade: 'A' });
  });
  it('클리어마다 장비 1개 (탐험 · 던전 · 레이드 모두, 2026-10-13 Lim: 보스 둘인 녹슨 요새도 1개) · 악몽은 고급 ~ 영웅 (34 6-7 · 61 3장)', () => {
    const s = newSave(1);
    s.tut = TUT.done;
    const x = settle(s, result(), rngFrom(1));
    expect(contentOf('rustfort').bosses.length).toBe(2);
    expect(x.items.length).toBe(1);
    expect(s.gear.bag).toEqual(x.items);
    for (let i = 0; i < 40; i++) {
      const e = settle(s, result({ content: 'plateau', diff: '악몽', deaths: 0 }), rngFrom(i));
      expect(e.items.length).toBe(1);
      expect(['일반', '고급', '희귀']).toContain(e.items[0].grade); // 88: 첫 등급대 악몽 일반 · 고급 · 희귀 (초반은 희귀까지)
    }
  });
  it('주간 도전 클리어 장비 = 단계 표 (2026-10-13 Lim: 1~9 보통 · 10~14 어려움 · 15~ 악몽), 1개', () => {
    expect([1, 9, 10, 14, 15, 20].map(chalDropDiff)).toEqual(['보통', '보통', '어려움', '어려움', '악몽', '악몽']);
    // 등급대는 내 레벨 (86): Lv 10 = 첫 등급대 (61 표), Lv 30 = 둘째 등급대 (바닥이 한 칸 위)
    const top = (stage: number, level = 10) => {
      const s = newSave(1); s.tut = TUT.done; s.player.level = level; s.daily.pub = 3;
      const seen = new Set<string>();
      for (let i = 0; i < 60; i++) {
        s.player.level = level; s.player.xp = 0; // 경험치로 레벨이 오르면 등급대가 바뀜
        const x = settle(s, result({ chal: stage, stage: level, deaths: 0 }), rngFrom(i + 1));
        expect(x.items.length).toBe(1);
        seen.add(x.items[0].grade);
      }
      return seen;
    };
    expect([...top(3)].every(g => g === '일반' || g === '고급')).toBe(true);
    expect(top(12).has('희귀')).toBe(true);
    expect(top(12).has('영웅')).toBe(false);
    expect(top(16).has('영웅')).toBe(false); // 88: 영웅은 Lv 45부터
    expect([...top(3, 30)].every(g => g !== '영웅')).toBe(true);
    expect(top(12, 30).has('영웅')).toBe(false);
    expect([...top(16, 30)].every(g => g === '고급' || g === '희귀')).toBe(true); // 둘째 등급대 악몽 바닥 고급
    expect(top(16, 100).has('영웅')).toBe(true);
  });
  it('다시 깨면 별·등급·최고 기록은 좋은 쪽을 남김', () => {
    const s = newSave(1);
    settle(s, result({ deaths: 0, overheal: 1000, time: 400 }), rngFrom(1));
    const x = settle(s, result({ deaths: 3, overheal: 5000, time: 300 }), rngFrom(2));
    expect(x.first).toBe(false);
    expect(x.best).toBe(true);
    expect(s.clears.rustfort!['보통']).toEqual({ stars: 3, grade: 'S', best: 300, n: 2 });
  });
  it('지면 (전멸) 장비·경험치 모두 없음 (2026-10-13 Lim, 예전 20%). 포기도 없음', () => {
    const s = newSave(1);
    const x = settle(s, result({ win: false, segIdx: 1 }), rngFrom(1));
    expect([x.grade, x.items, x.xp]).toEqual([null, [], 0]);
    expect(rampXp(contentOf('rustfort'), '보통', { first: true, grade: null, win: false })).toBe(0);
    expect(s.player).toMatchObject({ level: 1, xp: 0 });
    expect(s.clears).toEqual({});
    const q = settle(s, result({ win: false, quit: true }), rngFrom(1));
    expect(q.xp).toBe(0);
  });
  it('레벨 업 목록', () => {
    const s = newSave(1);
    s.player.xp = 99;
    const x = settle(s, result(), rngFrom(1));
    expect(x.levelBefore).toBe(1);
    expect(x.levelUps).toEqual([2, 3]);
    s.player.level = 3; s.player.xp = 0;
    expect(settle(s, result({ win: false }), rngFrom(1)).levelUps).toEqual([]);
  });
});

describe('초반 순차 레벨링 (70 · 90): 장소 Lv 1~9 쉬움 · 보통, 10~20 네 난이도 첫 클리어만으로 다음 장소 레벨', () => {
  const ramp = CONTENT.filter(c => isLeveling(c) && !c.hidden && c.stageLv <= RAMP_LV)
    .sort((a, b) => a.stageLv - b.stageLv || (a.kind === 'explore' ? -1 : 1));
  const play = (s: ReturnType<typeof newSave>, content: BattleResult['content'], diff: BattleResult['diff'], deaths: number, win = true) =>
    settle(s, result({ content, diff, deaths, win, segIdx: 0, segN: 1 }), rngFrom(1));

  it('장소 몫 = 다음 탐험 · 던전이 열리는 레벨까지: 녹슨 고원 1 → 3, 고철 더미 언덕 3 → 5, 그 뒤는 한 레벨씩', () => {
    expect(rampSpan(contentOf('plateau'))).toBe(xpToNext(1) + xpToNext(2));
    expect(rampSpan(contentOf('scrapheap'))).toBe(xpToNext(3) + xpToNext(4));
    expect(rampSpan(contentOf('rustfort'))).toBe(xpToNext(5));
    expect(rampSpan(contentOf('lilypalace'))).toBe(xpToNext(20));
    // 구간 장소는 Lv 1 ~ 20을 빈틈없이 덮음 (레벨이 같은 장소 둘 없음)
    expect(new Set(ramp.map(c => c.stageLv)).size).toBe(ramp.length);
    expect(ramp.reduce((a, c) => a + rampSpan(c), 0)).toBe([...Array(20).keys()].reduce((a, i) => a + xpToNext(i + 1), 0));
  });

  it.each([['C', 5], ['A', 1], ['S', 0]] as const)('튜토리얼 뒤 장소마다 길 (Lv 1~9 쉬움 → 보통, 10~20 쉬움 → 악몽)만 (등급 %s): 다시 하기 없이 다음 장소가 늘 열려 있음', (_g, deaths) => {
    const s = newSave(1);
    s.settings.devStamina = true; // 순서만 봄: 같은 시각에 여러 판이라 휴식 무제한 (휴식은 tests/stamina.test.ts, 90)
    addXp(s.player, xpToNext(1)); // 첫 전투 → Lv 2 (screens/tutorial)
    s.tut = TUT.explore;
    play(s, 'plateau', '쉬움', deaths);
    expect(s.tut).toBe(TUT.done);
    for (const c of ramp) {
      expect(s.player.level, `${c.name} (Lv ${c.unlockLv})에 들어갈 때`).toBeGreaterThanOrEqual(c.unlockLv);
      for (const d of rampDiffs(c)) if (!s.clears[c.key]?.[d] && s.player.level <= RAMP_LV) play(s, c.key, d, deaths);
    }
    // 두꺼비 왕국 수련궁 (Lv 20)에서 Lv 21 (이끼 뿌리 사원), 너무 앞서지 않음 (Lv 21부터는 길 밖)
    expect(s.player.level).toBe(21);
  });

  it('장소 Lv 10~20 (90): 쉬움 21% · 보통 25% · 어려움 30% · 악몽 34%, 합은 Lv 1~9의 쉬움 + 보통 (110%)과 같음, 다시 하기는 그 몫 × RAMP_REPEAT × 등급', () => {
    const sum = (t: Record<string, number>, ds: string[]) => Math.round(ds.reduce((a, d) => a + t[d], 0) * 100);
    expect(RAMP_FIRST_FOUR).toEqual({ '쉬움': 0.21, '보통': 0.25, '어려움': 0.3, '악몽': 0.34 });
    expect(sum(RAMP_FIRST_FOUR, ['쉬움', '보통', '어려움', '악몽'])).toBe(sum(RAMP_FIRST, ['쉬움', '보통']));
    const c = contentOf('sewer'), span = rampSpan(c);
    expect(RAMP_FOUR_LV).toBe(10);
    expect([rampDiffs(contentOf('crypt')), rampDiffs(contentOf('greenhouse')), rampDiffs(c)]).toEqual([['쉬움', '보통'], ['쉬움', '보통', '어려움', '악몽'], ['쉬움', '보통', '어려움', '악몽']]);
    expect([rampShare(contentOf('crypt'), '어려움'), rampShare(c, '어려움')]).toEqual([0.7, 0.3]);
    const s = newSave(1); s.tut = TUT.done; s.player.level = 11;
    expect(play(s, 'sewer', '악몽', 0).xp).toBe(Math.round(span * 0.34));
    expect(play(s, 'sewer', '악몽', 0).xp).toBe(Math.round(span * 0.34 * RAMP_REPEAT * 1.2));
  });

  it('첫 클리어는 등급과 상관없이 같음, 다시 깨면 RAMP_REPEAT × 등급, 지거나 포기하면 0', () => {
    const c = contentOf('cemetery'), span = rampSpan(c);
    const s = newSave(1); s.tut = TUT.done; s.player.level = 7;
    expect(play(s, 'cemetery', '보통', 5).xp).toBe(Math.round(span * RAMP_FIRST['보통']));
    const t = newSave(1); t.tut = TUT.done; t.player.level = 7;
    expect(play(t, 'cemetery', '보통', 0).xp).toBe(Math.round(span * RAMP_FIRST['보통']));
    expect(play(t, 'cemetery', '보통', 0).xp).toBe(Math.round(span * RAMP_FIRST['보통'] * RAMP_REPEAT * 1.2));
    expect(play(t, 'cemetery', '쉬움', 0, false).xp).toBe(0);
    expect(settle(t, result({ content: 'cemetery', diff: '쉬움', win: false, quit: true }), rngFrom(1)).xp).toBe(0);
    // 어려움 · 악몽은 더 많이 주지만 쉬움 + 보통만으로 충분
    expect(RAMP_FIRST['쉬움'] + RAMP_FIRST['보통']).toBeGreaterThanOrEqual(1);
    expect(RAMP_FIRST['어려움']).toBeGreaterThan(RAMP_FIRST['보통']);
  });

  it('Lv 21부터 · Lv 21 장소부터 · 주간 도전은 전과 같음 (내 레벨 기준, 장소 레벨 차이 감산 없음)', () => {
    expect(inRamp(contentOf('rustfort'), 20)).toBe(true);
    expect(inRamp(contentOf('rustfort'), 21)).toBe(false);
    expect(inRamp(contentOf('mossroot'), 20)).toBe(false);
    expect(inRamp(contentOf('abyss1'), 1)).toBe(false);
    expect(inRamp(contentOf('tutorial'), 1)).toBe(false);
    const s = newSave(1); s.tut = TUT.done; s.daily.pub = 3; s.player.level = 21;
    expect(play(s, 'rustfort', '보통', 1).xp).toBe(clearXp(21, '보통', 'A', { win: true }));
    const t = newSave(1); t.tut = TUT.done; t.daily.pub = 3; t.player.level = 20;
    expect(settle(t, result({ content: 'rustfort', diff: '보통', chal: 1, stage: 20 }), rngFrom(1)).xp).toBe(clearXp(20, '보통', 'A', { win: true }));
  });
});
