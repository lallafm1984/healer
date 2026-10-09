/**
 * 주간 도전 「모래시계 시련」 (13 3-2·3-3). 수치는 초안 (시뮬 2026-10-07).
 * 문서는 단계마다 보스 체력·피해 +8%였지만 시뮬에서 5단계부터 거의 못 깸 (체력이 늘면 광폭화에 걸림).
 * 그래서 체력 +2%, 피해 +4%로 낮춤: 자동 힐러(희귀 +5)가 5단계 약 90%, 10단계 약 30%, 15단계 0%.
 */
import type { AffixKey } from './affixes';
import type { ContentKey } from './content';
import type { DiffName } from './difficulty';

export const CHAL = {
  name: '모래시계 시련',
  /** 해금 레벨 (13 3장) */
  lv: 20,
  /** 단계 1~20 */
  max: 20,
  /** 이번 주 지정 던전 (던전이 늘면 주마다 돌림) */
  content: 'rustfort' as ContentKey,
  diff: '보통' as DiffName,
  hpStep: 0.02,
  dmgStep: 0.04,
  /** 제한시간 (휴식 뺀 전투 시간 합, 초): 1단계 7분, 단계마다 +8초 */
  time0: 420,
  timeStep: 8,
  /** 축제 주간 골드 */
  festivalGold: 1.2,
};

export const chalMult = (stage: number) => ({ hp: 1 + CHAL.hpStep * (stage - 1), dmg: 1 + CHAL.dmgStep * (stage - 1) });
export const chalLimit = (stage: number) => CHAL.time0 + CHAL.timeStep * (stage - 1);

/**
 * 주간 어픽스 순환 (8주). 같은 조합이 이어서 안 나오고, 4주마다 축제 주간.
 * 메마름 + 서두름, 불안정 + 서두름은 시뮬에서 너무 어려워서 같이 안 나오게 함. 불안정은 레벨 단계가 없어지며 들어옴 (32, 5·7주차)
 */
export const CHAL_ROTA: AffixKey[][] = [
  ['dry', 'contagion'],
  ['haste', 'echo'],
  ['chaos', 'panic'],
  ['festival', 'frenzy'],
  ['unstable', 'chaos'],
  ['echo', 'dry'],
  ['frenzy', 'unstable'],
  ['festival', 'panic'],
];
