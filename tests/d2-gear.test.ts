/**
 * 디아2식 장비 · 골드 (91, 2026-10-16 Lim 「디아2식으로 하고, 보석 · 홈 · 천장 · 공훈 지정 모두 빼자」 · 「골드 재화를 다시 넣자」):
 * 품질 (정교한 · 완벽한) · 고유 능력 굴림 · 장비 점수 = 실제 옵션 값 · 저장 v17 이전 (강화석 · 정제 강화석 → 골드)
 */
import { describe, expect, it } from 'vitest';
import {
  avgScore, ilvBonus, itemScore, makeItem, makeLegend, OPTION_LINES, presetScore, QUALITY, qualityOf, rollAvg, rollItem, SPEC_SCORE, UNIQUE_ROLL, type GearItem, type ItemGrade,
} from '../src/data/equipment';
import { GEARS } from '../src/data/gear';
import { UNIQUE_MULT, UNIQUES } from '../src/data/uniques';
import { rngFrom } from '../src/engine/rng';
import { MAT_GOLD, migrate, newSave, SAVE_VERSION } from '../src/platform/storage';
import { STD_GEAR } from '../src/sim/balance';

describe('품질 (91): 희귀 이상, 옵션 굴림 평균 130% 「정교한」 · 145% 「완벽한」', () => {
  const base = (grade: ItemGrade, rolls: number[]): GearItem => {
    const it = makeItem(rngFrom(1), 'weapon', grade, 1, 'staff');
    const nf = it.fixedRolls!.length;
    return { ...it, fixedRolls: rolls.slice(0, nf), lines: it.lines.map((l, i) => ({ ...l, roll: rolls[nf + i] })) };
  };
  it('평균이 130%를 넘으면 정교한, 145%면 완벽한. 일반 · 고급은 없음', () => {
    expect(QUALITY).toEqual([{ name: '완벽한', min: 1.45 }, { name: '정교한', min: 1.3 }]);
    expect(qualityOf(base('희귀', [1.3, 1.3, 1.3]))).toBe('정교한');
    expect(qualityOf(base('희귀', [1.6, 1.4, 1.35]))).toBe('완벽한');
    expect(qualityOf(base('희귀', [1.6, 1.0, 1.25]))).toBeNull();
    expect(qualityOf(base('고급', [1.6, 1.6]))).toBeNull();
    expect(rollAvg(base('영웅', [1, 1.2, 0.8, 1]))).toBeCloseTo(1);
  });
  it('나오는 비율: 정교한 희귀 약 6% · 영웅 3.5% · 전설 2%, 완벽한 0.7 · 0.2 · 0.06% (줄이 많을수록 드묾)', () => {
    const r = rngFrom(31), n = 25000;
    for (const [g, fine, perfect] of [['희귀', 0.06, 0.007], ['영웅', 0.035, 0.002], ['전설', 0.02, 0.0006]] as const) {
      let f = 0, p = 0;
      for (let i = 0; i < n; i++) {
        const q = qualityOf(makeItem(r, 'head', g, i));
        if (q) f++;
        if (q === '완벽한') p++;
      }
      expect(f / n, g).toBeGreaterThan(fine * 0.75); expect(f / n, g).toBeLessThan(fine * 1.3);
      expect(p / n, g).toBeLessThan(perfect * 2 + 0.0005);
    }
  }, 30000);
});

describe('고유 능력 굴림 (91): 1.3~1.7배 고르게, 평균 1.5', () => {
  it('고유 장비 · 고유 능력 줄 모두 uniqueMult, 이름 있는 장신구는 값 고정', () => {
    expect(UNIQUE_ROLL).toEqual({ lo: 1.3, hi: 1.7 });
    const r = rngFrom(17), place = UNIQUES[0].place, ms: number[] = [];
    for (let i = 0; i < 3000; i++) {
      const it = makeLegend(r, i, { place })!;
      if (it.unique) ms.push(it.uniqueMult!);
      else expect(it.uniqueMult).toBeUndefined();
    }
    expect(Math.min(...ms)).toBeGreaterThanOrEqual(1.3); expect(Math.max(...ms)).toBeLessThanOrEqual(1.7);
    expect(ms.reduce((a, b) => a + b, 0) / ms.length).toBeCloseTo(UNIQUE_MULT, 1);
    // 고유 장비 · 이름 있는 장신구가 없는 곳의 전설 = 특수능력 하나가 고유 능력 줄
    const lg = makeItem(r, 'ring', '전설', 1);
    expect(lg.specs![0].legend).toBe(true);
    expect(lg.uniqueMult).toBeGreaterThanOrEqual(1.3);
  });
});

describe('장비 점수 = 실제 옵션 값 (91)', () => {
  it('옵션 값 ÷ 한 줄 기준 합 + 특수능력 줄마다 1.3 (고유 능력 × 배율), × 아이템 레벨 배율 (내 레벨 기준)', () => {
    expect(SPEC_SCORE).toBe(1.3);
    const it = makeItem(rngFrom(5), 'neck', '영웅', 1, 'beads', { lv: 40 });
    const plain = { ...it, specs: [] };
    expect(itemScore(it, 40) - itemScore(plain, 40)).toBeCloseTo(SPEC_SCORE);
    expect(itemScore(it, 60)).toBeLessThan(itemScore(it, 40)); // 레벨이 오르면 옛 장비 점수가 줄어듦 (예전과 같은 ilvMult)
    const better = { ...plain, lines: plain.lines.map(l => ({ ...l, roll: l.roll + 0.2 })) };
    expect(itemScore(better, 40)).toBeGreaterThan(itemScore(plain, 40));
  });
  it('굴림이 좋은 희귀가 굴림이 나쁜 영웅보다 점수가 높을 수 있음 (예전엔 등급 순위가 먼저라 ▲가 실제와 달랐음)', () => {
    const rare = makeItem(rngFrom(2), 'weapon', '희귀', 1, 'staff', { lv: 60 }), hero = makeItem(rngFrom(2), 'weapon', '영웅', 2, 'staff', { lv: 60 });
    const good = { ...rare, fixedRolls: rare.fixedRolls!.map(() => 1.6), lines: rare.lines.map(l => ({ ...l, roll: 1.6 })), specs: [] };
    const bad = { ...hero, fixedRolls: hero.fixedRolls!.map(() => 0.5), lines: hero.lines.map(l => ({ ...l, roll: 0.5 })) };
    expect(itemScore(good, 60)).toBeGreaterThan(itemScore(bad, 60));
  });
  it('시뮬 프리셋 배율 고급 1 · 희귀 · 영웅 1.4 (= 예전 +0 · +5 · +5), 이름만 등급', () => {
    expect([GEARS.adv0, GEARS.rare5, GEARS.epic5].map(g => [g.label, g.m])).toEqual([['고급', 1], ['희귀', 1.4], ['영웅', 1.4]]);
    expect(STD_GEAR['악몽']).toBe('rare5');
    expect(presetScore('영웅', 1.4, 1)).toBeGreaterThan(presetScore('희귀', 1.4));
  });
  it('뽑은 장비 평균 점수는 등급 · 아이템 레벨이 높을수록 큼', () => {
    const r = rngFrom(8);
    const avg = (g: ItemGrade, lv: number) => { let t = 0; for (let i = 0; i < 400; i++) t += itemScore(makeItem(r, 'head', g, i, undefined, { lv }), lv); return t / 400; };
    expect(avg('희귀', 40)).toBeGreaterThan(avg('고급', 40));
    expect(avg('영웅', 40)).toBeGreaterThan(avg('희귀', 40));
    expect(avg('희귀', 60)).toBeGreaterThan(avg('희귀', 20) * (ilvBonus(60) / ilvBonus(20)) * 0.9);
    expect(avgScore({}, 30)).toBe(0);
    expect(OPTION_LINES['희귀']).toBe(3);
  });
});

describe('저장 v17 (91): 강화 없앰 · 골드 다시', () => {
  const v16 = () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    o.v = 16; delete o.player.gold;
    o.mats = { stone: 37, refined: 12 };
    o.settings.devStones = true; o.settings.quickEnhance = true;
    o.daily.missions = [{ key: 'enhance2', n: 1, got: false }, { key: 'clear3', n: 2, got: false }];
    o.gear.bag = [{ id: 1, slot: 'ring', kind: 'ring', grade: '전설', plus: 9, name: '', lv: 100, lines: [{ stat: 'int', roll: 0.6 }, { stat: 'hp', roll: 1 }], specs: [{ key: 'warmTouch', roll: 1, legend: true }] }];
    return o;
  };
  it('남은 강화석 1개 = 골드 100, 정제 강화석 1개 = 500, 골드는 0부터. 강화석 무제한 = 골드 무제한', () => {
    expect(MAT_GOLD).toEqual({ stone: 100, refined: 500 });
    const s = migrate(v16());
    expect(s.v).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(17); // v18 (인연 명부) 뒤에도 v17 옮기기는 그대로
    expect(s.player.gold).toBe(37 * 100 + 12 * 500);
    expect('mats' in s).toBe(false);
    expect(s.settings.devGold).toBe(true);
    expect(['devStones' in s.settings, 'quickEnhance' in s.settings]).toEqual([false, false]);
    expect(s.daily.missions.map(m => [m.key, m.n])).toEqual([['sell2', 1], ['clear3', 2]]);
  });
  it('장비: 강화 단계 지움, 무작위 옵션 굴림 r → r ÷ 0.8 (값 그대로), 주 · 종류 굴림 1, 고유 능력 1.5 (없음 = 기본값)', () => {
    const it = migrate(v16()).gear.bag[0];
    expect(it).not.toHaveProperty('plus');
    expect(it.lines.slice(0, 2)).toEqual([{ stat: 'int', roll: 0.75 }, { stat: 'hp', roll: 1.25 }]); // 모자란 줄은 새 굴림으로 채움
    expect(it.fixedRolls).toBeUndefined();
    expect(it.uniqueMult).toBeUndefined();
    // 다시 불러도 그대로 (v17 저장은 굴림을 또 나누지 않음)
    expect(migrate(JSON.parse(JSON.stringify(migrate(v16())))).gear.bag[0]).toEqual(it);
  });
  it('v17 저장의 골드는 그대로, 새로 뽑은 장비에는 주 · 종류 굴림이 있음', () => {
    const s = newSave(1); s.player.gold = 4321;
    expect(migrate(JSON.parse(JSON.stringify(s))).player.gold).toBe(4321);
    const it = rollItem(rngFrom(3), '보통', 'A', 30, 1, { lv: 30 });
    expect(it.fixedRolls!.length).toBeGreaterThan(0);
  });
});
