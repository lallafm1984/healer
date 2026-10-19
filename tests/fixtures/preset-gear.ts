/**
 * 테스트용 프리셋 세기 장비 (91 디아2식): 6부위 그 부위 첫 종류, 무작위 옵션 줄을 다 채우고 모든 옵션 굴림 = mult × margin ÷ 아이템 레벨 배율.
 * 아이템 레벨 = 내 레벨이라 점수 (itemScore)가 시뮬 프리셋 (고급 × 1 · 희귀 × 1.4 = 예전 +0 · +5)과 같은 세기 이상 (margin 5%: 첫 종류와 종류 평균의 차이).
 * 체력 줄은 예전 강화 몫 (ilvBonus · mult)을 안 받아 (103 ③) 굴림 = margin
 */
import { ilvBonus, kindLines, kindsOf, kindStats, MAIN_OPT, randomLines, SLOTS, STAT_KEYS, takenStats, type Equipped, type GearItem, type ItemGrade, type StatKey } from '../../src/data/equipment';

export function presetGear(grade: ItemGrade, mult: number, level: number, margin = 1.05, firstId = 9000): Equipped {
  const roll = Math.round(((mult * margin) / ilvBonus(level)) * 1e4) / 1e4, rollOf = (stat: StatKey) => (stat === 'hp' ? margin : roll);
  let id = firstId;
  return Object.fromEntries(SLOTS.map(s => {
    const k = kindsOf(s.key)[0], n = randomLines(k, grade), free = STAT_KEYS.filter(x => !takenStats(k).includes(x)).sort((a, b) => Number(a === 'hp') - Number(b === 'hp')); // 체력 줄은 맨 뒤 (프리셋 평균보다 체력 몫이 많지 않게)
    const it: GearItem = { id: id++, slot: s.key, kind: k.key, grade, name: 'x', lv: level, lines: free.slice(0, n).map(stat => ({ stat, roll: rollOf(stat) })), specs: [] };
    const fixed = [...(MAIN_OPT[s.key] ? [MAIN_OPT[s.key]!.stat] : []), ...kindStats(k).slice(0, kindLines(k, grade))];
    it.fixedRolls = fixed.map(rollOf);
    return [s.key, it];
  }));
}
