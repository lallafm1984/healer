import { describe, expect, it } from 'vitest';
import { ALL_DIFFS } from '../src/data/content';
import { dropTable, ITEM_GRADES, PUB_GRADE_BONUS, rollGrade } from '../src/data/equipment';
import { gearGradeOdds } from '../src/data/reward-preview';

describe('출전 보상 확률', () => {
  it.each([
    ['쉬움', 0, [1, 0, 0, 0, 0]],
    ['보통', 0, [.58, .42, 0, 0, 0]],
    ['어려움', 0, [.13, .55, .32, 0, 0]],
    ['악몽', 0, [0, .33, .5, .17, 0]],
    ['악몽', 10, [0, 0, .48, .52, 0]],
    ['악몽', 20, [0, 0, .33, .55, .12]],
  ] as const)('%s · %s인 A 평가는 원시 표가 아닌 보정 후 확률', (diff, raid, expected) => {
    const actual = gearGradeOdds(diff, raid, 80);
    ITEM_GRADES.forEach((g, i) => expect(actual[g]).toBeCloseTo(expected[i], 12));
  });

  it('Lv 50 전에는 전설 확률이 영웅에 합쳐진다', () => {
    const low = gearGradeOdds('악몽', 20, 49), unlocked = gearGradeOdds('악몽', 20, 50);
    expect(low['전설']).toBe(0);
    expect(low['영웅']).toBeCloseTo(.67, 12);
    expect(low['희귀']).toBeCloseTo(.33, 12);
    expect(unlocked['전설']).toBeCloseTo(.12, 12);
  });

  it('전투 평가와 공개모집 보너스가 바뀌면 실제 추첨처럼 달라진다', () => {
    expect(gearGradeOdds('악몽', 20, 80, 'S')['전설']).toBeCloseTo(.15, 12);
    expect(gearGradeOdds('악몽', 20, 80, 'B')['전설']).toBeCloseTo(.1, 12);
    expect(gearGradeOdds('악몽', 20, 80, 'A', true)['전설']).toBeCloseTo(.37, 12);
  });

  it('모든 표·평가·레벨·보너스 조합은 총 100%이며 실제 추첨의 균등 표본과 같다', () => {
    // 현재 추첨 경계는 1% 단위이므로 10,000개 중간점 표본은 각 구간을 정확히 센다.
    const n = 10000;
    for (const raid of [0, 10, 20] as const) for (const diff of ALL_DIFFS)
      for (const level of [49, 50]) for (const grade of ['S', 'A', 'B', 'C'] as const) for (const bonus of [false, true]) {
        const odds = gearGradeOdds(diff, raid, level, grade, bonus);
        const count = Object.fromEntries(ITEM_GRADES.map(g => [g, 0]));
        for (let i = 0; i < n; i++) count[rollGrade(() => (i + .5) / n, dropTable(diff, raid), grade, level, bonus ? PUB_GRADE_BONUS : 0)]++;
        expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        for (const g of ITEM_GRADES) expect(odds[g]).toBeCloseTo(count[g] / n, 12);
      }
  });
});
