/** 출전 전 장비 1개의 등급 확률. 실제 추첨 함수의 구간을 적분하며 보상 수치는 바꾸지 않는다. */
import type { DiffName } from './difficulty';
import { dropTable, GRADE_BONUS, ITEM_GRADES, PUB_GRADE_BONUS, rollGrade, type ItemGrade } from './equipment';
import type { Grade } from './progression';

export function gearGradeOdds(diff: DiffName, raid: 0 | 10 | 20, level: number, grade: Grade = 'A', publicBonus = false, tierLv = 1): Record<ItemGrade, number> {
  const table = dropTable(diff, raid, tierLv), bonus = publicBonus ? PUB_GRADE_BONUS : 0;
  const shift = GRADE_BONUS[grade] + bonus;
  const edges = new Set([0, 1]);
  let sum = 0;
  for (const p of table) {
    sum += p;
    const edge = sum - shift;
    if (edge > 0 && edge < 1) edges.add(edge);
  }
  const points = [...edges].sort((a, b) => a - b);
  const odds = Object.fromEntries(ITEM_GRADES.map(g => [g, 0])) as Record<ItemGrade, number>;
  for (let i = 1; i < points.length; i++) {
    const lo = points[i - 1], hi = points[i];
    // rollGrade가 적용하는 상한과 Lv 50 이전 전설→영웅 전환도 그대로 반영한다.
    const result = rollGrade(() => (lo + hi) / 2, table, grade, level, bonus);
    odds[result] += hi - lo;
  }
  return odds;
}
