/**
 * 내 힐러 요약 (27 2장 로비 힐러 카드 · 4-1 캐릭터 머리 · 4-2 능력치 판).
 * 장비 점수 = 장착 장비 itemScore 합 × 10 (편성 화면 권장 장비 경고와 같은 기준). 「전투력」이라는 말은 쓰지 않는다.
 */
import { avgScore, gearStatsOf, ITEM_GRADES, itemScore, SLOTS, type GearItem, type ItemGrade, type SlotKey } from '../data/equipment';
import { lvPower } from '../data/progression';
import { INT_BASE, RULES } from '../data/rules';
import { TALENTS } from '../data/talents';
import { TUT } from './tutorial';
import { G, healerLevel, heroNow, heroSave } from './state';

/** 힐러 기본 체력 (06 2장). 레벨 배율(lvPower)을 곱하기 전 값이라 Lv 1은 220 (34 1-2) */
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

/** 능력치 (레벨 배율 포함): 체력 · 지능 · 치명타 · 가속 · 정신력(마나 재생 배율) · 인내(받는 피해 감소) */
export function heroStats(): { hp: number; int: number; crit: number; haste: number; regen: number; endure: number } {
  const p = statParts();
  return { hp: p.hp.total, int: p.int.total, crit: p.crit.total, haste: p.haste.total, regen: 1 + p.spirit.total, endure: p.endure.total };
}

/**
 * 능력치 판 6칸과 출처 (34 1-2 · 10장, 27 4-2 능력치 판을 누르면): 기본 · 레벨 (정점 수련 포함) · 장비 몫. 더하면 total.
 * 지능 = 치유 회복량 (스킬 회복량은 지능의 비율), 정신력 = 마나 재생에 더하는 비율, 인내 = 받는 피해 감소 (장비 옵션, 34 6-4).
 * 특성은 상시 능력치를 바꾸지 않음 (전투 중 조건으로 켜짐) → 몫 없음. 체력은 방어구 주 능력치 · 체력 옵션으로 오름.
 */
export function statParts() {
  const lv = G.save.player.level, apex = RULES.apex(lv);
  const eq = G.save.gear.equipped, st = gearStatsOf(eq), lp = lvPower(lv) * apex, l1 = lvPower(1);
  const hpLv = Math.round(HEALER_HP * lp), hp = Math.round(HEALER_HP * lp * (1 + (st.hp ?? 0))), hp1 = Math.round(HEALER_HP * l1);
  const int = Math.round(INT_BASE * lp * st.heal), intLv = Math.round(INT_BASE * lp), int1 = Math.round(INT_BASE * l1);
  return {
    lp,
    /** 정점 수련 몫 (34 2-2, Lv 51부터 레벨마다 +0.3%). 레벨 몫에 들어 있음 */
    apex: apex - 1,
    hp: { total: hp, base: hp1, level: hpLv - hp1, gear: hp - hpLv },
    int: { total: int, base: int1, level: intLv - int1, gear: int - intLv },
    crit: { total: RULES.baseCrit + st.crit, base: RULES.baseCrit, gear: st.crit },
    haste: { total: Math.min(RULES.hasteCap, st.haste), gear: Math.min(RULES.hasteCap, st.haste), cap: RULES.hasteCap },
    /** 마나 재생 = 초당 regen% × (1 + 정신력) */
    spirit: { total: st.regen - 1, gear: st.regen - 1, regen: RULES.regen },
    endure: { total: st.endure ?? 0, gear: st.endure ?? 0 },
  };
}

