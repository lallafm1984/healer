/**
 * 내 힐러 요약 (27 2장 로비 힐러 카드 · 4-1 캐릭터 머리 · 4-2 능력치 판).
 * 장비 점수 = 장착 장비 itemScore 합 × 10 (입장 화면 권장 장비와 같은 기준). 「전투력」이라는 말은 쓰지 않는다.
 */
import { avgScore, gearStatsOf, ITEM_GRADES, itemScore, SLOTS, type GearItem, type ItemGrade, type SlotKey } from '../data/equipment';
import { lvPower } from '../data/progression';
import { TALENTS } from '../data/talents';
import { TUT } from './tutorial';
import { G, healerLevel, heroNow, heroSave } from './state';

/** 힐러 기본 체력 (06 2장) */
export const HEALER_HP = 550;

/** 장비 한 개 점수 (보여 주는 값) */
export const scoreOf = (it?: GearItem | null) => Math.round(itemScore(it ?? undefined) * 10);
/** 장착 장비 점수 합 */
export const gearScore = () => SLOTS.reduce((a, s) => a + scoreOf(G.save.gear.equipped[s.key]), 0);

/** 장착 평균 등급·강화 (빈칸은 0점으로 셈): 희귀 +3 → { grade: '희귀', plus: 3 } */
export function gearAvg(): { grade: ItemGrade | null; plus: number } {
  const avg = avgScore(G.save.gear.equipped);
  if (avg < 1) return { grade: null, plus: 0 };
  const gi = Math.min(ITEM_GRADES.length - 1, Math.floor(avg) - 1);
  return { grade: ITEM_GRADES[gi], plus: Math.round((avg - Math.floor(avg)) * 10) };
}

/** 가방에 지금 장비보다 점수가 높은 장비가 있는 부위 */
export function betterSlots(): SlotKey[] {
  const eq = G.save.gear.equipped;
  return SLOTS.filter(s => G.save.gear.bag.some(it => it.slot === s.key && itemScore(it) > itemScore(eq[s.key]))).map(s => s.key);
}
/** 이 장비가 같은 부위의 착용 장비보다 좋은가 */
export const isBetter = (it: GearItem) => itemScore(it) > itemScore(G.save.gear.equipped[it.slot]);

/** 열렸는데 아직 안 고른 특성 단 수 (특성 트리는 사제만, 튜토리얼 중엔 0) */
export function talentsLeft(): number {
  if (G.save.tut < TUT.done || heroNow() !== 'priest') return 0;
  const picks = heroSave('priest').talents || [];
  return TALENTS.filter((t, i) => t.lv <= healerLevel() && picks[i] == null).length;
}

/** 능력치 (레벨 배율 포함) */
export function heroStats(): { hp: number; heal: number; crit: number; haste: number; regen: number } {
  const p = statParts();
  return { hp: p.hp.total, heal: p.heal.total, crit: p.crit.total, haste: p.haste.total, regen: p.regen.total };
}

/**
 * 능력치 출처 (27 4-2 능력치 판을 누르면): 기본 · 레벨 · 장비 몫. 더하면 total.
 * 특성은 상시 능력치를 바꾸지 않음 (전투 중 조건으로 켜짐) → 몫 없음.
 * 체력은 장비로 오르지 않음 (gearStatsOf에 체력 없음).
 */
export function statParts() {
  const eq = G.save.gear.equipped, st = gearStatsOf(eq), lp = lvPower(G.save.player.level);
  const hp = Math.round(HEALER_HP * lp);
  return {
    lp,
    hp: { total: hp, base: HEALER_HP, level: hp - HEALER_HP },
    heal: { total: st.heal * lp, base: 1, level: lp - 1, gear: (st.heal - 1) * lp },
    crit: { total: st.crit, base: 0.05, gear: st.crit - 0.05 },
    haste: { total: st.haste, gear: st.haste },
    regen: { total: st.regen, base: 1, gear: st.regen - 1 },
  };
}

