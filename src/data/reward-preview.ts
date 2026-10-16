/** 출전 전 장비 1개의 등급 확률 (88): 실제 추첨과 같은 dropOdds. 보상 수치는 바꾸지 않는다. */
import type { DiffName } from './difficulty';
import { dropOdds, ITEM_GRADES, type ItemGrade } from './equipment';
import type { Grade } from './progression';

/** tierLv = 등급대 · 영웅 확률 레벨 (탐험 · 던전 장소 레벨, 레이드는 내 레벨). 없으면 내 레벨 */
export function gearGradeOdds(diff: DiffName, raid: 0 | 10 | 20, level: number, grade: Grade = 'A', publicBonus = false, tierLv = level): Record<ItemGrade, number> {
  const odds = dropOdds({ diff, raid, tierLv, level, grade, pub: publicBonus });
  return Object.fromEntries(ITEM_GRADES.map((g, i) => [g, odds[i]])) as Record<ItemGrade, number>;
}
