/**
 * 주간 도전 「모래시계 시련」 (13 3-2·3-3 → 110). 처음 수치 (2026-10-07): 녹슨 요새 하나, 체력 +2% · 피해 +4%, 제한시간 7분 + 8초.
 * 110 1차 (2026-10-22 Lim 「주간도전 화면을 점검하자」): 피해 +10%/단계 · 8분 + 10초 · 단계 보너스.
 * 110 2차 (같은 날 Lim 「주간도전은 경험치 및 골드 수급처가 되어선 안된다 … 주간 던전은 주 마다 변경하고 기존의 던전들을 재활용하여 레벨에 맞춰서
 * 재활용하자 (단 현재 캐릭터 레벨보다 상위 던전은 나오지 않게)」): 던전은 주마다 내 레벨 이하 던전 가운데 하나 (game/runmode chalContent), 적 레벨 = 내 레벨.
 * 던전마다 세기가 달라 (녹슨 요새는 Lv 100에서 보통의 3배 피해도 깸, 늦은 던전은 1.2배에서 막힘) 던전 · 레벨마다 「깨기 반 배율」 (chal-dungeons)을 재어
 * 단계 피해 = 깨기 반 배율 × dmgRate^(단계 − pivot): 어느 던전 · 레벨이든 pivot단계에서 익숙한 사람이 반쯤 깸. 제한시간도 던전마다 (1단계 가운데 시간 기준)
 */
import type { AffixKey } from './affixes';
import { CHAL_DUN } from './chal-dungeons';
import type { ContentKey } from './content';
import type { DiffName } from './difficulty';

export const CHAL = {
  name: '모래시계 시련',
  /** 해금 레벨 (13 3장) */
  lv: 20,
  /** 단계 1~20 */
  max: 20,
  diff: '보통' as DiffName,
  /** 단계마다 적 체력 +2% */
  hpStep: 0.02,
  /** 단계마다 적 피해 × dmgRate, pivot단계 = 깨기 반 배율 (110 2차: 익숙한 사람 90% → 10%가 피해 1.6배 사이라 10단계 ≈ 90 · 20단계 ≈ 10%) */
  dmgRate: 1.045,
  pivot: 15,
  /** 제한시간 = 던전 1단계 가운데 시간 × (timeSlack + timeGrow × (단계 − 1)), 5초 단위 */
  timeSlack: 1.2,
  timeGrow: 0.03,
  /** 축제 주간 경험치 (v16: 골드를 없애 골드 +20% → 경험치 +20%) */
  festivalXp: 1.2,
  /** 풍요 주간 골드 (110) */
  bountyGold: 1.3,
  /** 단계 보너스 (110): 클리어 골드 · 경험치 × (1 + rewardStep × (단계 − 1)). 10단계 ×1.27 · 20단계 ×1.57 */
  rewardStep: 0.03,
  /** 클리어 골드 · 경험치 · 월요일 상자 골드 × rewardCut (110 2차 Lim 「경험치 및 골드 지급은 반으로」): 보통 던전 한 판의 반 (단계 보너스는 그 위에) */
  rewardCut: 0.5,
};
/** 단계 보너스 배율 (골드 · 경험치, rewardCut 전) */
export const chalReward = (stage: number) => 1 + CHAL.rewardStep * (Math.max(1, stage) - 1);

/**
 * 클리어마다 장비 1개의 등급 표 (2026-10-13 Lim 「추천대로」): 1~9단계 보통 표 (고급까지), 10~14단계 어려움 표 (희귀까지), 15단계부터 악몽 표 (영웅까지).
 * 예전: 이번 주 던전 난이도 (보통) 표, 보스마다 1개 (녹슨 요새 2개)
 */
export const chalDropDiff = (stage: number): DiffName => (stage >= 15 ? '악몽' : stage >= 10 ? '어려움' : '보통');

/** 던전 · 내 레벨의 깨기 반 배율 (chal-dungeons 점 사이 로그 직선, 처음 점 아래 · 끝 점 위는 그 점 값, 표 없는 던전은 1) */
export function chalHalf(key: ContentKey, lv: number): number {
  const p = CHAL_DUN[key]?.p;
  if (!p?.length) return 1;
  if (lv <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [l0, m0] = p[i - 1], [l1, m1] = p[i];
    if (lv <= l1) return Math.exp(Math.log(m0) + ((Math.log(m1) - Math.log(m0)) * (lv - l0)) / (l1 - l0));
  }
  return p[p.length - 1][1];
}
/** 단계의 적 체력 · 피해 배율 (보스 배율 bossMult) */
export const chalMult = (stage: number, key: ContentKey, lv: number) => ({
  hp: 1 + CHAL.hpStep * (stage - 1),
  dmg: chalHalf(key, lv) * CHAL.dmgRate ** (stage - CHAL.pivot),
});
/** 화면에 보이는 단계 세기: 1단계보다 적 체력 · 피해 +몇 % (던전마다 바탕 세기는 표 안에) */
export const chalShown = (stage: number) => ({ hp: CHAL.hpStep * (stage - 1), dmg: CHAL.dmgRate ** (stage - 1) - 1 });
/** 제한시간 (휴식 뺀 전투 시간 합, 초): 던전 1단계 가운데 시간 × (1.2 + 0.03 × (단계 − 1)), 5초 단위. 표 없는 던전은 8분 기준 */
export function chalLimit(stage: number, key: ContentKey): number {
  const t1 = CHAL_DUN[key]?.t ?? 400;
  return Math.round((t1 * (CHAL.timeSlack + CHAL.timeGrow * (stage - 1))) / 5) * 5;
}

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
