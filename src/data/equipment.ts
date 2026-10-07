/**
 * 힐러 장비 아이템 (02 10장). 6부위, 등급 5단계, 클리어 때 랜덤 1개.
 * P1: 강화(+1~+10)·세트 효과·분해는 아직 없음 (P2, 09 S10·S11). 떨어지는 장비는 모두 +0.
 */
import type { DiffName } from './difficulty';
import { GRADE, type GearStats, type GradeName } from './gear';

export type SlotKey = 'weapon' | 'head' | 'chest' | 'hands' | 'ring' | 'neck';

export const SLOTS: { key: SlotKey; name: string; base: string }[] = [
  { key: 'weapon', name: '무기', base: '지팡이' },
  { key: 'head', name: '머리', base: '두건' },
  { key: 'chest', name: '몸통', base: '로브' },
  { key: 'hands', name: '손', base: '장갑' },
  { key: 'ring', name: '반지', base: '반지' },
  { key: 'neck', name: '목걸이', base: '목걸이' },
];

export type ItemGrade = Exclude<GradeName, '없음'>;
export const ITEM_GRADES: ItemGrade[] = ['일반', '고급', '희귀', '영웅', '전설'];

/** 등급 색 (02 10-1) + 글자 표시 (색만으로 구분하지 않기, 09 5장) */
export const GRADE_STYLE: Record<ItemGrade, { color: string; word: string }> = {
  '일반': { color: '#E8E4D8', word: '낡은' },
  '고급': { color: '#6CCB6A', word: '튼튼한' },
  '희귀': { color: '#4C9BFF', word: '축복받은' },
  '영웅': { color: '#B07CF0', word: '성스러운' },
  '전설': { color: '#FF9F43', word: '전설의' },
};

/** 난이도별 등급 확률 (02 10-4 초안). 순서 = ITEM_GRADES */
export const DROP_TABLE: Record<DiffName, number[]> = {
  '쉬움': [0.5, 0.4, 0.1, 0, 0],
  '보통': [0.2, 0.5, 0.25, 0.05, 0],
  '어려움': [0, 0.3, 0.5, 0.18, 0.02],
  '악몽': [0, 0, 0.5, 0.42, 0.08],
};

/** 클리어 등급이 높을수록 상위 등급 확률 소폭↑ (02 10-4): 굴린 값을 이만큼 위로 민다 */
export const GRADE_BONUS: Record<'S' | 'A' | 'B' | 'C', number> = { S: 0.05, A: 0.02, B: 0, C: 0 };

/** 전설은 Lv 50부터 드롭 (02 10-1) */
export const LEGEND_LEVEL = 50;

export interface GearItem {
  id: number;
  slot: SlotKey;
  grade: ItemGrade;
  /** 강화 단계 (P1은 늘 0) */
  plus: number;
  name: string;
}

export type Equipped = Partial<Record<SlotKey, GearItem>>;

export const slotName = (k: SlotKey) => SLOTS.find(s => s.key === k)!.name;
export const itemName = (slot: SlotKey, grade: ItemGrade) => `${GRADE_STYLE[grade].word} ${SLOTS.find(s => s.key === slot)!.base}`;

/** 장비 1개 뽑기. r = 0~1 난수 함수 */
export function rollItem(r: () => number, diff: DiffName, grade: 'S' | 'A' | 'B' | 'C', level: number, id: number): GearItem {
  const slot = SLOTS[Math.floor(r() * SLOTS.length)].key;
  const table = DROP_TABLE[diff];
  let x = Math.min(0.999999, r() + GRADE_BONUS[grade]);
  let gi = 0;
  for (; gi < table.length - 1; gi++) {
    if (x < table[gi]) break;
    x -= table[gi];
  }
  // 확률 0인 등급으로 밀려 올라가지 않게: 표에 있는 가장 높은 등급까지만
  const top = table.reduce((m, p, i) => (p > 0 ? i : m), 0);
  gi = Math.min(gi, top);
  let g = ITEM_GRADES[gi];
  if (g === '전설' && level < LEGEND_LEVEL) g = '영웅';
  return { id, slot, grade: g, plus: 0, name: itemName(slot, g) };
}

/**
 * 착용 장비 → 전투 능력치. data/gear의 프리셋 계산(6부위 같은 등급)을 부위별로 나눈 것이라,
 * 6부위가 모두 같으면 gearStats(프리셋)과 같은 값이 나온다.
 */
export function gearStatsOf(eq: Equipped): GearStats {
  let heal = 0, sub = 0, any = false;
  for (const s of SLOTS) {
    const it = eq[s.key];
    if (!it) continue;
    any = true;
    const [h, n] = GRADE[it.grade];
    heal += h + 0.005 * it.plus;
    sub += n;
  }
  const n = sub / 3;
  return { heal: any ? 1 + heal : 1, regen: 1 + 0.03 * n, haste: 0.02 * n, crit: 0.05 + 0.02 * n };
}

/** 장비 점수 (등급 순위 + 강화/10). 권장 장비 비교·더 좋은 장비 표시용 */
export const itemScore = (it: GearItem | undefined) => (it ? ITEM_GRADES.indexOf(it.grade) + 1 + it.plus / 10 : 0);
export const avgScore = (eq: Equipped) => SLOTS.reduce((a, s) => a + itemScore(eq[s.key]), 0) / SLOTS.length;

/** 권장 장비 (02 2-2, 13): 어려움 = 고급, 악몽 = 희귀 +5. 미달이면 경고만 (입장은 허용) */
export const RECOMMENDED: Record<DiffName, { label: string; score: number } | null> = {
  '쉬움': null,
  '보통': null,
  '어려움': { label: '고급', score: 2 },
  '악몽': { label: '희귀 +5', score: 3.5 },
};

/** 지금 장비를 한 줄로 (예: "고급 3 · 일반 2 · 빈칸 1") */
export function gearSummary(eq: Equipped): string {
  const cnt = new Map<string, number>();
  for (const s of SLOTS) {
    const k = eq[s.key]?.grade ?? '빈칸';
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const order = [...[...ITEM_GRADES].reverse(), '빈칸'];
  return order.filter(k => cnt.has(k)).map(k => `${k} ${cnt.get(k)}`).join(' · ');
}
