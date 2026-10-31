/** 출전 전 장비 1개의 등급 확률 (88): 실제 추첨과 같은 dropOdds. 보상 수치는 바꾸지 않는다. */
import type { DiffName } from './difficulty';
import { dropOdds, ITEM_GRADES, type ItemGrade } from './equipment';
import type { Grade } from './progression';

/** tierLv = 등급대 · 영웅 확률 레벨 (탐험 · 던전 장소 레벨, 레이드는 그 난이도 입장 레벨이며 전설도 이때부터). 없으면 내 레벨. repeat = 레이드 다시 깬 판 (그 주 첫 보상을 받은 칸) */
export function gearGradeOdds(diff: DiffName, raid: 0 | 10 | 20, level: number, grade: Grade = 'A', publicBonus = false, tierLv = level, repeat = false): Record<ItemGrade, number> {
  const odds = dropOdds({ diff, raid, tierLv, level, grade, pub: publicBonus, repeat });
  return Object.fromEntries(ITEM_GRADES.map((g, i) => [g, odds[i]])) as Record<ItemGrade, number>;
}
