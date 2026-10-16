/**
 * 테스트용 프리셋 세기 장비 (91 디아2식): 6부위 그 부위 첫 종류, 무작위 옵션 줄을 다 채우고 모든 옵션 굴림 = mult × margin ÷ 아이템 레벨 배율.
 * 아이템 레벨 = 내 레벨이라 점수 (itemScore)가 시뮬 프리셋 (고급 × 1 · 희귀 × 1.4 = 예전 +0 · +5)과 같은 세기 이상 (margin 5%: 첫 종류와 종류 평균의 차이)
 */
import { fixedLines, ilvBonus, kindsOf, randomLines, SLOTS, STAT_KEYS, takenStats, type Equipped, type GearItem, type ItemGrade } from '../../src/data/equipment';

export function presetGear(grade: ItemGrade, mult: number, level: number, margin = 1.05, firstId = 9000): Equipped {
  const roll = Math.round(((mult * margin) / ilvBonus(level)) * 1e4) / 1e4;
  let id = firstId;
  return Object.fromEntries(SLOTS.map(s => {
    const k = kindsOf(s.key)[0], n = randomLines(k, grade), free = STAT_KEYS.filter(x => !takenStats(k).includes(x));
    const it: GearItem = { id: id++, slot: s.key, kind: k.key, grade, name: 'x', lv: level, lines: free.slice(0, n).map(stat => ({ stat, roll })), specs: [] };
    it.fixedRolls = Array(fixedLines(it)).fill(roll);
    return [s.key, it];
  }));
}
