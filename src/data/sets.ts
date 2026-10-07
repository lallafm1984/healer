/**
 * 세트 장비 (02 10-3): 콘텐츠마다 고유 세트 1종, 4부위, 2세트·4세트 효과.
 * 효과 숫자는 엔진이 SetFx로 받아서 씀 (없으면 0 → 결과 그대로). 지금 만든 콘텐츠의 세트 3종만
 */
import type { ContentKey } from './content';
import type { SlotKey } from './equipment';

export type SetKey = 'dawn' | 'belfry' | 'cathedral';

/** 전투에 들어가는 세트 효과 합 */
export interface SetFx {
  /** 지속 힐 회복량 +비율 */
  hotAmt: number;
  /** 지속 힐이 끝까지 가면 그 총량의 이 비율만큼 바로 회복 */
  hotEnd: number;
  /** 범위 힐 회복량 +비율 */
  aoeHeal: number;
  /** 공대 쿨기 재사용 대기 -초 */
  raidCd: number;
  /** 마나 재생 +비율 */
  regen: number;
  /** 범위 힐이 6명 이상을 치유하면 마나 +% */
  aoeMana: number;
}

export const NO_SET_FX: SetFx = { hotAmt: 0, hotEnd: 0, aoeHeal: 0, raidCd: 0, regen: 0, aoeMana: 0 };

export interface SetDef {
  key: SetKey;
  name: string;
  /** 드롭 콘텐츠 */
  from: ContentKey;
  /** 이 등급부터 세트로 나옴 (던전 희귀, 레이드 영웅) */
  minGrade: '희귀' | '영웅';
  /** 세트 4부위 */
  slots: [SlotKey, SlotKey, SlotKey, SlotKey];
  style: string;
  two: { desc: string; fx: Partial<SetFx> };
  four: { desc: string; fx: Partial<SetFx> };
}

export const SETS: Record<SetKey, SetDef> = {
  dawn: {
    key: 'dawn', name: '새벽 순례자', from: 'rustfort', minGrade: '희귀', slots: ['head', 'chest', 'hands', 'neck'], style: '지속 힐',
    two: { desc: '지속 힐 회복량이 15% 늘어납니다.', fx: { hotAmt: 0.15 } },
    four: { desc: '지속 힐이 끝까지 가면 그 총량의 30%를 바로 회복합니다.', fx: { hotEnd: 0.3 } },
  },
  belfry: {
    key: 'belfry', name: '종탑 순례자', from: 'abyss1', minGrade: '영웅', slots: ['weapon', 'head', 'chest', 'ring'], style: '위기 대응',
    two: { desc: '범위 힐 회복량이 10% 늘어납니다.', fx: { aoeHeal: 0.1 } },
    four: { desc: '공대 쿨기 재사용 대기시간이 40초 줄어듭니다.', fx: { raidCd: 40 } },
  },
  cathedral: {
    key: 'cathedral', name: '대성당의 빛', from: 'cathedral1', minGrade: '영웅', slots: ['weapon', 'chest', 'hands', 'neck'], style: '대규모 마나',
    two: { desc: '마나 재생이 10% 늘어납니다.', fx: { regen: 0.1 } },
    four: { desc: '범위 힐이 6명 이상을 치유하면 마나 2%를 돌려받습니다.', fx: { aoeMana: 2 } },
  },
};
export const SET_KEYS = Object.keys(SETS) as SetKey[];

/** 그 콘텐츠의 세트 */
export const setOf = (content: string): SetDef | null => SET_KEYS.map(k => SETS[k]).find(s => s.from === content) ?? null;

/** 착용 장비의 세트별 개수 (세트 부위만 셈) */
export function setCounts(items: ({ set?: SetKey; slot: SlotKey } | undefined)[]): Partial<Record<SetKey, number>> {
  const n: Partial<Record<SetKey, number>> = {};
  for (const it of items) if (it?.set && SETS[it.set] && SETS[it.set].slots.includes(it.slot)) n[it.set] = (n[it.set] || 0) + 1;
  return n;
}

/** 착용 장비 → 전투 세트 효과 합 */
export function setFxOf(items: ({ set?: SetKey; slot: SlotKey } | undefined)[]): SetFx {
  const fx = { ...NO_SET_FX };
  const add = (p: Partial<SetFx>) => { for (const k in p) fx[k as keyof SetFx] += p[k as keyof SetFx]!; };
  const n = setCounts(items);
  for (const k of Object.keys(n) as SetKey[]) {
    if (n[k]! >= 2) add(SETS[k].two.fx);
    if (n[k]! >= 4) add(SETS[k].four.fx);
  }
  return fx;
}
