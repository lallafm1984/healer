/**
 * 주간 도전 「모래시계 시련」 (13 3-2·3-3 → 110). 처음 수치 (2026-10-07): 체력 +2% · 피해 +4%, 제한시간 7분 + 8초.
 * 110 (2026-10-22 Lim 「주간도전 화면을 점검하자」): 그 뒤 장비 · 레벨 · 능력치가 바뀌어 Lv 60 ~ 100은 20단계도 93 ~ 100%였고, Lv 30은 제한시간에만 막힘.
 * → 피해 +10%/단계, 제한시간 8분 + 10초. 익숙한 사람 (그 레벨 · 희귀 장비 · 이번 주 어픽스 둘) 제한시간 안 클리어: 1단계 100 · 5단계 94~98 · 10단계 79~92 · 15단계 31~50 · 20단계 2~27%
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
  dmgStep: 0.1,
  /** 제한시간 (휴식 뺀 전투 시간 합, 초): 1단계 8분, 단계마다 +10초 (110, 예전 7분 + 8초) */
  time0: 480,
  timeStep: 10,
  /** 축제 주간 경험치 (v16: 골드를 없애 골드 +20% → 경험치 +20%) */
  festivalXp: 1.2,
  /** 풍요 주간 골드 (110) */
  bountyGold: 1.3,
  /**
   * 단계 보너스 (110, 2026-10-22 Lim 「골드 및 경험치 검토」): 클리어 골드 · 경험치 × (1 + rewardStep × (단계 − 1)). 예전엔 단계와 상관없이 보통 던전 한 판이라
   * 20단계도 1단계와 같았음. 10단계 ×1.27 ≈ 어려움 (×1.3) · 20단계 ×1.57 ≈ 악몽 (×1.6), 장비 단계 표 (chalDropDiff)와 같은 쪽
   */
  rewardStep: 0.03,
};
/** 단계 보너스 배율 (골드 · 경험치) */
export const chalReward = (stage: number) => 1 + CHAL.rewardStep * (Math.max(1, stage) - 1);

/**
 * 클리어마다 장비 1개의 등급 표 (2026-10-13 Lim 「추천대로」): 1~9단계 보통 표 (고급까지), 10~14단계 어려움 표 (희귀까지), 15단계부터 악몽 표 (영웅까지).
 * 예전: 이번 주 던전 난이도 (보통) 표, 보스마다 1개 (녹슨 요새 2개)
 */
export const chalDropDiff = (stage: number): DiffName => (stage >= 15 ? '악몽' : stage >= 10 ? '어려움' : '보통');

export const chalMult = (stage: number) => ({ hp: 1 + CHAL.hpStep * (stage - 1), dmg: 1 + CHAL.dmgStep * (stage - 1) });
export const chalLimit = (stage: number) => CHAL.time0 + CHAL.timeStep * (stage - 1);

/** 도전 어픽스 순서의 기준 주 (월요일). 예전 시즌 1 시작 날 (시즌 패스는 2026-10-20 Lim 「시즌패스 시스템 제거」로 없앰, 순서가 안 바뀌게 같은 날) */
export const CHAL_ROTA_START = '2026-10-05';
/**
 * 주간 어픽스 순환 (16주, 110: 2026-10-22 Lim 「다양한 어픽스를 추가」, 예전 8주 · 8종). 어픽스 16종이 저마다 1~2번, 4주마다 좋은 주 (축제 · 풍요 번갈아) + 어픽스 하나.
 * 같은 조합이 이어서 안 나오고, 메마름 + 서두름 · 불안정 + 서두름 · 센 것끼리 (폭군 · 지진 · 폭주 · 혼돈)는 같이 안 나오게 함.
 * 2번 칸 (혼돈 + 동요)은 바꾸는 주 (2026-10-19 주)의 예전 순서 그대로라 주 중간에 어픽스가 안 바뀜
 */
export const CHAL_ROTA: AffixKey[][] = [
  ['grievous', 'contagion'],
  ['pulse', 'echo'],
  ['chaos', 'panic'],
  ['festival', 'tyrant'],
  ['necrotic', 'unstable'],
  ['drain', 'frenzy'],
  ['chill', 'quake'],
  ['bounty', 'spite'],
  ['dry', 'chaos'],
  ['haste', 'spite'],
  ['grievous', 'panic'],
  ['festival', 'frenzy'],
  ['tyrant', 'echo'],
  ['quake', 'drain'],
  ['necrotic', 'chill'],
  ['bounty', 'haste'],
];
