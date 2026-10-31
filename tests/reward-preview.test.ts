import { describe, expect, it } from 'vitest';
import { ALL_DIFFS } from '../src/data/content';
import { descending, dropOdds, dropTable, HERO_MAX, heroRamp, ITEM_GRADES, LEGEND_CHANCE, LEGEND_CHANCE_10, minGrade, rollGrade } from '../src/data/equipment';
import { gearGradeOdds } from '../src/data/reward-preview';

describe('출전 보상 확률 (88: 바탕 표 희귀까지 + 영웅 · 전설 따로, 낮은 등급일수록 높게)', () => {
  it.each([
    // Lv 100 장소 (탐험 · 던전 넷째 레벨대), A 평가: 바탕 표를 2%p 밀고 영웅 = 최대값 × 1.1
    ['쉬움', 0, [0, .58, .42, 0, 0]],
    ['보통', 0, [0, 0, 1 - .044, .044, 0]],
    ['어려움', 0, [0, 0, 1 - .11, .11, 0]],
    ['악몽', 0, [0, 0, 1 - .22, .22, 0]],
    ['악몽', 10, [0, 0, 1 - .275 - .0275, .275, .0275]], // 10인 전설 = 20인의 절반 (2026-10-22 Lim)
    ['악몽', 20, [0, 0, 1 - .33 - .055, .33, .055]],
  ] as const)('%s · %s인 A 평가 (Lv 100)', (diff, raid, expected) => {
    const actual = gearGradeOdds(diff, raid, 100);
    ITEM_GRADES.forEach((g, i) => expect(actual[g]).toBeCloseTo(expected[i], 12));
  });

  it('Lim 09:36 「칸마다 난이도 및 레벨에 따라서 최소 등급」: 레벨대 × 난이도 · 레이드 최소 등급 표', () => {
    const DS = ['쉬움', '보통', '어려움', '악몽'] as const;
    const row = (raid: 0 | 10 | 20, lv: number) => DS.map(d => minGrade(dropTable(d, raid, lv))).join(' ');
    expect(row(0, 1)).toBe('일반 일반 고급 고급');
    expect(row(0, 30)).toBe('일반 고급 고급 희귀');
    expect(row(0, 50)).toBe('고급 고급 희귀 희귀');
    expect(row(0, 80)).toBe('고급 희귀 희귀 희귀');
    expect(row(10, 50)).toBe('고급 희귀 희귀 희귀');
    expect(row(20, 80)).toBe('희귀 희귀 희귀 희귀');
  });

  it('Lim 07:49 「일반이 제일 높고 고급 · 희귀 순으로 낮게」: 모든 콘텐츠 · 난이도 · 레벨 · 평가 · 보너스에서 최소 등급부터 차례로 줄어듦', () => {
    // 사진의 칸: Lv 4 녹슨 고원 어려움 = 최소 고급 · 고급 > 희귀 (예전 일반 13 · 고급 55 · 희귀 32)
    const shot = gearGradeOdds('어려움', 0, 4, 'A', false, 1);
    expect(shot['일반']).toBe(0);
    expect(shot['고급']).toBeGreaterThan(shot['희귀']);
    for (const raid of [0, 10, 20] as const) for (const diff of ALL_DIFFS)
      for (const level of [1, 10, 21, 30, 44, 45, 60, 80, 100]) for (const grade of ['S', 'A', 'B', 'C'] as const) for (const pub of [false, true]) {
        const o = dropOdds({ diff, raid, tierLv: level, level, grade, pub });
        const lo = o.findIndex(x => x > 0);
        for (let i = lo + 1; i < o.length; i++) expect(o[i], `${raid} ${diff} Lv ${level} ${grade} ${pub} ${ITEM_GRADES[i]}`).toBeLessThanOrEqual(o[i - 1] + 1e-12);
      }
    descending([0, 0.2, 0.5, 0.3, 0]).forEach((v, i) => expect(v).toBeCloseTo([0, 0.35, 0.35, 0.3, 0][i], 12)); // 뒤집힌 이웃만 고르게
  });

  it('영웅은 Lv 45부터 늘어 Lv 100에 최대 · 전설은 Lv 70 이상이며 해당 레이드 입장 레벨부터 어려움 · 악몽', () => {
    expect([1, 44, 45, 72, 100].map(heroRamp)).toEqual([0, 0, 1 / 56, 28 / 56, 1]);
    expect(gearGradeOdds('악몽', 0, 44, 'S', true)['영웅']).toBe(0);
    expect(gearGradeOdds('보통', 10, 45)['영웅']).toBeCloseTo(HERO_MAX[10]['보통'] * 1.1 / 56, 12);
    expect(gearGradeOdds('악몽', 20, 99)['전설']).toBeCloseTo(LEGEND_CHANCE['악몽']! * 1.1, 12);
    expect(gearGradeOdds('악몽', 20, 100)['전설']).toBeCloseTo(LEGEND_CHANCE['악몽']! * 1.1, 12);
    expect(gearGradeOdds('악몽', 10, 100)['전설']).toBeCloseTo(LEGEND_CHANCE_10['악몽']! * 1.1, 12);
    expect([gearGradeOdds('어려움', 10, 100)['전설'], gearGradeOdds('어려움', 20, 100)['전설']]).toEqual([expect.closeTo(0.011, 12), expect.closeTo(0.022, 12)]);
    for (const d of ['어려움', '악몽'] as const) expect(LEGEND_CHANCE_10[d]).toBe(LEGEND_CHANCE[d]! / 2);
    expect([gearGradeOdds('보통', 10, 100)['전설'], gearGradeOdds('악몽', 10, 59, 'A', false, 60)['전설'], gearGradeOdds('악몽', 0, 100)['전설']]).toEqual([0, 0, 0]);
    for (const level of [45, 60, 69]) for (const repeat of [false, true]) {
      expect(gearGradeOdds('어려움', 10, level, 'S', true, 45, repeat)['전설']).toBe(0);
      expect(gearGradeOdds('악몽', 10, level, 'S', true, 60, repeat)['전설']).toBe(0);
    }
    for (const repeat of [false, true]) {
      expect(gearGradeOdds('어려움', 10, 70, 'A', false, 45, repeat)['전설']).toBeGreaterThan(0);
      expect(gearGradeOdds('악몽', 10, 70, 'A', false, 60, repeat)['전설']).toBeGreaterThan(0);
    }
    // 탐험 · 던전은 장소 레벨 (tierLv): Lv 100이 장소 Lv 20 악몽을 돌면 영웅 없음
    expect(gearGradeOdds('악몽', 0, 100, 'A', false, 20)['영웅']).toBe(0);
    for (const d of ALL_DIFFS) {
      expect(HERO_MAX[0][d]).toBeLessThanOrEqual(HERO_MAX[10][d]);
      expect(HERO_MAX[10][d]).toBeLessThanOrEqual(HERO_MAX[20][d]);
    }
  });

  it('클리어 등급 · 공개모집 보너스: 바탕 표는 밀고 (차례가 뒤집히면 고르게), 영웅 · 전설은 곱함', () => {
    expect(gearGradeOdds('악몽', 20, 100, 'S')['전설']).toBeCloseTo(.05 * 1.2, 12);
    expect(gearGradeOdds('악몽', 20, 100, 'B')['전설']).toBeCloseTo(.05, 12);
    expect(gearGradeOdds('악몽', 20, 100, 'A', true)['전설']).toBeCloseTo(.05 * 1.1 * 1.5, 12);
    const pub = gearGradeOdds('보통', 0, 30, 'B', true); // 둘째 레벨대 보통 고급 70 · 희귀 30 + 25%p → 45 · 55 → 고르게
    for (const g of ['고급', '희귀'] as const) expect(pub[g]).toBeCloseTo(.5, 12);
    expect(gearGradeOdds('쉬움', 0, 10, 'S', true)['고급']).toBe(0); // 상한 일반 그대로
  });

  it('모든 표·평가·레벨·보너스 조합은 총 100%이며 실제 추첨의 균등 표본과 같다', () => {
    const n = 20000;
    for (const raid of [0, 10, 20] as const) for (const diff of ALL_DIFFS)
      for (const level of [10, 30, 50, 100]) for (const grade of ['S', 'A', 'B', 'C'] as const) for (const bonus of [false, true]) {
        const odds = gearGradeOdds(diff, raid, level, grade, bonus);
        const raw = dropOdds({ diff, raid, tierLv: level, level, grade, pub: bonus });
        const count = Object.fromEntries(ITEM_GRADES.map(g => [g, 0]));
        for (let i = 0; i < n; i++) count[rollGrade(() => (i + .5) / n, raw)]++;
        expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        for (const g of ITEM_GRADES) expect(Math.abs(odds[g] - count[g] / n)).toBeLessThan(1.5 / n);
      }
  });
});
