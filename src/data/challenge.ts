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
  /** 셋째 어픽스가 붙는 단계 (115 나안, 2026-10-27 Lim 「나안」): 1 ~ 9단계는 이번 주 어픽스 앞 둘, 이 단계부터 셋 다 */
  third: 10,
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
 * 주간 어픽스 순환 (24주 · 주마다 셋, 115: 2026-10-27 Lim 「좋은 어픽스는 제거. 나안」). 1 ~ 9단계는 앞 둘, 10단계부터 셋째까지 (CHAL.third).
 * 24종이 칸 (첫째 · 둘째 · 셋째)마다 한 번씩 = 저마다 세 번. 이어지는 두 주에 같은 어픽스 없음, 같은 둘이 두 번 같이 안 나옴.
 * 한 주에 센 것 (폭군 · 지진 · 폭주 · 혼돈 · 결속 · 도전자의 위기) · 내 손 (고갈 · 한기 · 시간의 족쇄 · 진동) · 받는 치유 (메마름 · 괴저 · 넘침)는 하나씩,
 * 메마름 + 서두름 · 불안정 + 서두름 · 진동 + 한기 · 복수심 + 결속 · 산만함 + 동요는 같이 안 나옴 (tests/affixes.test.ts).
 * 예전 16주 (110)의 4번째 칸 (축제 + 폭군)이 바꾸는 주 (2026-10-26 주)라 그 주는 폭군을 첫째로 둠
 */
export const CHAL_ROTA: AffixKey[][] = [
  ['blight', 'echo', 'contagion'],
  ['dry', 'skittish', 'peril'],
  ['chaos', 'contagion', 'spite'],
  ['tyrant', 'tremor', 'overflow'],
  ['doom', 'drain', 'grievous'],
  ['pulse', 'spite', 'blight'],
  ['peril', 'necrotic', 'chains'],
  ['tremor', 'unstable', 'skittish'],
  ['grievous', 'chaos', 'haste'],
  ['skittish', 'frenzy', 'doom'],
  ['drain', 'haste', 'echo'],
  ['panic', 'chains', 'quake'],
  ['contagion', 'peril', 'drain'],
  ['chains', 'tyrant', 'pulse'],
  ['necrotic', 'chill', 'panic'],
  ['echo', 'bolster', 'unstable'],
  ['frenzy', 'overflow', 'chill'],
  ['bolster', 'pulse', 'tremor'],
  ['spite', 'panic', 'frenzy'],
  ['chill', 'quake', 'dry'],
  ['overflow', 'blight', 'chaos'],
  ['haste', 'doom', 'bolster'],
  ['unstable', 'dry', 'tyrant'],
  ['quake', 'grievous', 'necrotic'],
];
/** 그 단계에 붙는 어픽스 (115 나안): 1 ~ 9단계는 이번 주 어픽스 앞 둘, 10단계부터 셋 다 */
export const chalAffixes = (week: AffixKey[], stage: number): AffixKey[] => (stage >= CHAL.third ? week.slice() : week.slice(0, 2));
