/**
 * 전투 기본 규칙 (34 1장, 2026-10-09 Lim 확정). 작게 시작해서 크게 자라는 숫자, 느린 시전, 장비로 오르는 가속·치명타.
 * PROTO_RULES = 프로토타입 규칙 (34 이전 값). 엔진이 프로토타입과 같게 움직이는지 보는 parity 테스트에만 쓴다 (FightConfig.proto).
 */
import { apexOf, lvPower, lvPowerProto } from './progression';
import type { SkillKey } from './skills';

export interface Rules {
  /** 레벨 배율: 힐량·체력과 파티원·적 체력·피해·딜 */
  lv: (level: number) => number;
  /** 정점 수련 (34 2-2): 내 지능·체력에만 곱함 (적 배율과 따로라 레벨이 오르면 실제로 조금씩 세짐) */
  apex: (level: number) => number;
  /** 적 세기 = 내 레벨 세기 × 이 값 (적 레벨 = 내 레벨). 파티원도 콘텐츠 세기를 따름 */
  enemy: number;
  /** 적이 주는 피해 배율 (느린 시전에 맞춤, 34 1-4) */
  enemyDmg: number;
  /** 치유 배율: 지능 = INT_BASE × 레벨 배율 × 이 값 × (1 + 장비 지능). 힐 한 번이 체력바를 채우는 몫 (34 1-6) */
  heal: number;
  /** GCD (초). 가속으로 줄어듦 */
  gcd: number;
  /** 가속 상한 (GCD 1.5초 → 바닥 1.0초) */
  hasteCap: number;
  /** 기본 치명타 (장비·특성 몫 말고) */
  baseCrit: number;
  /** 마나 재생 (초당 %) */
  regen: number;
  /** 시전 시간을 바꾼 스킬 (없으면 skills.ts 값) */
  cast?: Partial<Record<SkillKey, number>>;
  /** 재사용 대기를 바꾼 스킬 (없으면 skills.ts 값) */
  cd?: Partial<Record<SkillKey, number>>;
  /** 위치 규칙 (없으면 끔) */
  pos?: PosRules;
  /** 장판 · 탱커 강타 피해 배율 (없으면 데이터 값 그대로) */
  hazard?: HazardRules;
}

/**
 * 위치 규칙 (2026-10-13 Lim). 1열 = 적에 가장 가까운 줄 (판 맨 윗줄), 판마다 줄 수가 달라도 같은 규칙.
 * 탱커가 1열에 없으면 적이 다른 파티원 (나 빼고) 중 무작위 1명을 때림. 근접 공격 (탱커 · 근접)은 1 · 2열에서만.
 * 원거리가 1 · 2열에 서면 공격력 × rangedDps, 받는 피해 × rangedTaken: 10 · 20인 레이드 판만 (탐험 · 5인 던전은 없음, 2026-10-13 Lim 「탐험 및 던전은 원거리 패널티 해제」).
 * 힐러 (나)는 공격자가 아니라 뺌
 */
export interface PosRules {
  /** 탱커가 서야 하는 줄 수 (1열) */
  tankRows: number;
  /** 근접 공격이 닿는 줄 수 (1 · 2열) */
  meleeRows: number;
  /** 원거리가 이 줄 수 안에 서면 약해짐 (1 · 2열) */
  rangedRows: number;
  /** 원거리 약해짐은 줄이 이만큼 이상인 판만 (10인 5줄 · 20인 6줄. 탐험 · 5인 던전은 3줄) */
  rangedMinRows: number;
  rangedDps: number;
  rangedTaken: number;
}
export const POS_RULES: PosRules = { tankRows: 1, meleeRows: 2, rangedRows: 2, rangedMinRows: 5, rangedDps: 0.5, rangedTaken: 1.5 };

/**
 * 장판 · 탱커 강타 피해 배율 (2026-10-18 Lim 「장판 피해는 너무 약하고 탱커를 치는 강타 계열은 너무 세다. 장판이 약해서 그 스킬이 의미가 없다」).
 * 보스 데이터 값 (data/bosses.ts)에 엔진이 곱한다 (engine/bosses.ts fromDef · 요정 고리 · 졸개 오라). 보스 공략 · 강타 예고 숫자 · 자동 힐러도 곱한 값을 읽는다.
 * 피할 수 있는 장판만: 못 피하는 줄 피해 (fixed, P-ROW) · 어둠물 밀물 (P-TIDE)은 그대로. 탱커 강타 = 탱커 기준 수치 (dmg)가 있는 강타 예고 (탱커 교대 · 비늘 방패 돌진 포함).
 * 지목 공격 (보물 욕심 · 신기루 창 · 끌기)은 그대로
 */
export interface HazardRules {
  /** 피할 수 있는 장판 피해 배율: 맞는 순간 (hitDmg) · 남는 장판 초당 (dps) · 요정 고리 · 졸개 오라 */
  zone: number;
  /** 장판 맞는 순간 피해 상한 (원거리 · 힐러 기준, 레벨 1 · 보통 값): 배율로 이보다 커지지 않음 (원래 이보다 큰 값은 그대로) */
  zoneHitCap: number;
  /** 탱커 강타 피해 배율 */
  buster: number;
}
export const HAZARD: HazardRules = { zone: 2, zoneHitCap: 480, buster: 0.7 };

/**
 * 어그로 (96 문서, engine/threat.ts). K · 여유 · 되찾기는 sim으로 맞춤 (672칸 클리어율 ±1%p, 판당 뺏기 5인 0~1 · 10인 1 · 20인 1~2번).
 * 1 → 10 → 20 칸은 능력치 (97 FM) 값
 */
export const THREAT = {
  /** 반감기 (초): 최근 10초만 남음 */
  half: 5,
  /** 탱커 위협 K: 딜러 한 사람 몫 딜의 K배 (보통 딜러 = 탱커의 1/K = 75%) */
  tank: 1 / 0.65,
  /** 내 위협 H: H × √(넣은 치유 전부 (넘친 치유 포함) ÷ 파티가 받은 피해) = 탱커 위협 대비 (치유가 받은 피해의 2배면 약 0.5) */
  heal: 0.354,
  /** 받은 피해 바닥 = 파티 최대 체력 합 × 이만큼 (반감기 합) */
  healFloor: 0.1,
  /** 뺏는 선 = 탱커 위협 × 여유 (쉬움 · 3인 탐험 1.4) */
  leeway: { '쉬움': 1.4, '보통': 1.3, '어려움': 1.2, '악몽': 1.15 } as Record<'쉬움' | '보통' | '어려움' | '악몽', number>,
  /** 선의 이만큼이면 판 위 주황 테두리 · 탱커 경고 (경고 대사는 같은 딜러에게 warnGap초에 한 번) */
  warn: 0.9, warnGap: 12,
  /** 「딜 줄임」 대사는 같은 딜러에게 easeGap초에 한 번 */
  easeGap: 15,
  /** 딜 줄이기 (판단 1 → 10 → 20: 선의 몇 %에서 시작), 줄이는 몫, 다시 올리는 때 (시작 − easeBack) */
  easeNever: 1.05, easeAt: 0.85, easeBest: 0.7, ease: 0.25, easeBack: 0.1,
  /** 탱커 기술 숙련: 쌓는 양 (1 · 20, 10 = 1) */
  skill: [0.8, 1.2] as [number, number],
  /** 탱커 집중: 이동 · 생존기 · 강타 1초 동안 쌓는 양 (1 · 10, 20 = 1) */
  focus: [0.5, 0.75] as [number, number],
  /**
   * 되찾기까지 (초): 탱커 반응 1 · 10 · 20 = 8 · 6 · 4초, 기술 숙련 1 · 20 = × 1.1 · × 0.9, 4~8초 (retakeMin · retakeMax).
   * 2026-10-19 Lim 「어그로 튀면 바로 되찾아 온다. 그래서 어그로 의미가 없어보인다」: 예전 3 · 1.7 · 0.5초 + 위협이 식으면 저절로 돌아감 → 2초 안팎이라 힐러가 대응할 틈이 없었음.
   * 그동안 보스 평타는 뺏은 사람에게 머묾 (저절로 돌아가지 않음), 판 위 주황 띠 · 조준 표식도 그 사람에게
   */
  retake: [8, 6, 4] as [number, number, number], retakeSkill: [1.1, 0.9] as [number, number], retakeMin: 4, retakeMax: 8,
  /** 되찾기 재사용 (초) · 되찾으면 탱커 위협 = 뺏은 사람 × retakeMult · 이 횟수부터 「너무 세서 못 잡겠다」 */
  retakeCd: 8, retakeMult: 1.1, levelBarkAt: 5,
  /** 딜러 침착: 뺏은 뒤 딜을 멈추기까지 (초, 1 · 10, 20 = 바로) · 멈추는 동안 (그 뒤 되찾을 때까지 1 − ease로 줄여서 침) */
  calm: [2, 1] as [number, number], stopSec: 2,
  /** 보스를 돌려준 딜러는 cool초 동안 딜을 줄이고 다시 안 뺏음 */
  cool: 8,
  /** 레벨 차이: 1레벨에 +4%, ×0.6 ~ ×2 */
  lvStep: 0.04, lvMin: 0.6, lvMax: 2,
  /** 시작 뒤 이 초까지는 뺏지 않음 (모두 0에서 출발) · 선을 이 초 동안 넘어 있어야 뺏음 */
  start: 2, dwell: 0.6,
  /** 보스가 나를 칠 때 한 대 = 내 최대 체력 × 이만큼 (주시와 같은 방식) */
  healerHit: 0.15,
};
/** 장판 초당 피해 (요정 고리 · 오라 포함) */
export const zoneDps = (R: Rules, dps: number): number => dps * (R.hazard?.zone ?? 1);
/** 장판 맞는 순간 피해 */
export const zoneHit = (R: Rules, dmg: number): number => (R.hazard ? Math.max(dmg, Math.min(dmg * R.hazard.zone, R.hazard.zoneHitCap)) : dmg);
/** 탱커 강타 피해 */
export const busterDmg = (R: Rules, dmg: number): number => dmg * (R.hazard?.buster ?? 1);

export const RULES: Rules = { lv: lvPower, apex: apexOf, enemy: 0.95, enemyDmg: 0.85, heal: 0.6, gcd: 1.5, hasteCap: 0.5, baseCrit: 0, regen: 0.7, pos: POS_RULES, hazard: HAZARD };

/** 34 이전 값: 숫자 ×2.5 · 레벨마다 +0.08, 적 = 내 레벨과 같은 세기, GCD 1.0, 기본 치명 5%, 마나 재생 1%, 시전이 짧음 */
export const PROTO_RULES: Rules = {
  lv: lvPowerProto, apex: () => 1, enemy: 1, enemyDmg: 1, heal: 1, gcd: 1.0, hasteCap: Infinity, baseCrit: 0.05, regen: 1.0,
  cast: { heal: 1.8, flash: 1.0, poh: 2.0, growth: 1.5, wildflower: 1.5, rebirth: 2.0, holyLight: 1.5 },
  cd: { purify: 8, natureCleanse: 8, handCleanse: 8 }, // 해제 8초 (2026-10-12에 4초로 줄이기 전)
};

/** 지능 1 = 치유 회복량 (34 1-2): 스킬 회복량은 지능의 비율 (예전 수치 ÷ 300) */
export const INT_BASE = 300;

/**
 * 능력치 기반 전투 행동 (99, 2026-10-19 Lim 「능력치 기반 움직임을 디테일하게」). 능력치가 있는 사람 (공개모집 · 길드원)만.
 * 능력치 10 · 꾸준함 10은 예전과 평균이 같게 (흔들림은 평균 1), 낮으면 어리버리 · 높으면 잘함. 흔들림 폭은 꾸준함 (`wobOf`).
 */
export const STAT_ACT = {
  /** (가) 예고를 보고 움직이기까지: 예고마다 × (1 ± react × 폭), 고르게 (평균 1). 가장 빨라도 minReact초, 늦어져도 터지기 lastCall초 전까지 (원래 시간이 그보다 늦으면 원래 시간) */
  react: 0.35, minReact: 0.15, lastCall: 0.1,
  /**
   * (가) 못 피한 모양 몫 (15 이상이면 0 = 예전처럼 멈칫만, 못 피할 확률은 그대로). Codex 검토 반영 1: 늦게 피함 = 반응 느림 × 판단 좋음 (late × 서툼 (반응) × (1 − 서툼 (판단))),
   * 엉뚱한 쪽 = 반응 빠름 × 판단 나쁨 (wrong × 서툼 (판단) × (1 − 서툼 (반응))), 둘 다 낮으면 멈칫 (어디로 갈지도 모르고 느림)
   */
  late: 0.5, wrong: 0.4,
  // (가) 못 피한 뒤 다시 움직이는 때는 세 모양 모두 movement.ts recoverAt (침착, 예전 멈칫 식) — Codex 검토 A
  /** (나) 탱커: 1열이 비면 다시 1열로 나가기까지 머뭇거림 (위치 잡기 · 반응 평균이 1일 때 초, 15 이상 0 = 예전처럼 바로), × (1 ± react × 폭) */
  tankBack: 1.8,
  /** (나) 머뭇거린 뒤 엉뚱한 칸 (1열 아님)에 먼저 갈 확률 (판단 1, 15 이상 0) */
  tankWrong: 0.25,
  /** (나) 전투 시작에 1열을 못 찾고 둘째 줄에서 시작할 확률 · 1열로 나가기까지 (초), 위치 잡기 1일 때 (15 이상 0) */
  tankStart: 0.45, tankStartSec: 1.8,
  /** (나) 초보 탱커 위협 쌓기: × (1 − tankThreat × 서툼 (기술 숙련)), 예전 기술 숙련 배율 (0.8 ~ 1.2)에 더해 */
  tankThreat: 0.25,
  /** (다) 한 방 빗나감 확률 (기술 숙련 1, 15 이상 0) · 세게 들어감 (공격 20, 15 이하 0) × critMult */
  miss: 0.15, crit: 0.08, critMult: 1.5,
  /**
   * (다) 공격이 15 넘는 탱커: 딜 × (1 + tankDps × 잘함), 20이면 × 1.6 (예전 공격 × 1.15에 더해) → 공격 20 전사가 보통 사냥꾼 · 서툰 딜러보다 딜이 큼 (Lim 10-19 「탱커가 딜러보다 딜 더 잘할 수도」).
   * 위협도 같은 배율 (딜 잘하는 탱커는 어그로를 단단히 쥠)
   */
  tankDps: 0.6,
  /** (마) 공격이 15 넘는 딜러의 위협 × (1 + dealerThreat × 잘함): 압도적으로 센 딜러는 괜찮은 탱커에게서도 뺏음 (탱커 위협 바탕인 딜러 평균 딜에는 안 넣음) */
  dealerThreat: 0.6,
  /**
   * (마) 뺏은 뒤 딜러, 판단 = 고르기 · 침착 = 해내기 (Codex 검토 반영 1, 예전엔 둘의 평균). 판단: 15 = 예전 (#258, 침착만큼 지나 2초 멈춤 → 되찾을 때까지 25% 줄임),
   * 15 넘으면 멈춤이 길어져 20이면 되찾을 때까지 멈춤, 15보다 낮으면 멈춤이 짧아져 8 밑은 안 멈추고 줄임도 작아져 1이면 그대로 계속 때림 · 되찾기가 × (1 + ignoreRetake × 서툼 (판단)) 늦음
   */
  ignoreRetake: 0.5,
  /**
   * (마) 침착이 15보다 낮으면 당황 (서툼 = 침착): 멈추기로 했어도 panicHit초 더 치고 (한 대 더) hesit초 동안 이동을 머뭇거림 (장판 반응이 그만큼 늦음),
   * 안 멈추는 사람 (판단 낮음)은 stealLost × 서툼 (판단) × 서툼 (침착) 확률로 딜이 breakSec초 끊기고 옆 칸으로 자리를 잃음 (칸 위 「?」, 힐러가 먼저 챙길 사람).
   * 판단 · 침착 둘 다 15 넘으면 잘함 (둘 중 작은 쪽) 확률로 방어 생존기를 켜고 버팀
   */
  panicHit: 0.8, hesit: 1.2, stealLost: 2, breakSec: 1.5,
  /** (라) 생존기 (체력 기준으로 쓰는 직업 스킬): 판단 1이면 기준 −guardLate (늦게, 15 이상 0) · 판마다 ±guardWob × 폭 (꾸준함) */
  guardLate: 0.06, guardWob: 0.03,
  /**
   * (라) 방어 = 막는 솜씨 (맷집 = 버티는 몸과 나눔, Lim 06:47): 보스 평타를 맞을 때 방어가 15 넘으면 parry × 잘함 확률로 반만 맞음 (칸 위 「막음」, 예전엔 방어 · 발놀림 평균).
   * 15보다 낮은 탱커는 나를 노리는 강타 예고마다 offGuard × 서툼 확률로 자세를 못 잡아 그 강타를 × (1 + offGuardMult) 맞음 (칸 위 「자세 놓침」, 예고 숫자도 그만큼).
   * 탱커가 아닌 사람은 강타를 받아 낼 자세가 없음 (이미 직업군 방어력만큼 더 맞음, 같이 곱하면 원거리가 한 방에 쓰러져 레이드 악몽이 늘어짐)
   */
  parry: 0.12, offGuard: 0.6, offGuardMult: 0.15,
  /** (라) 피하기 확률: 회피 1이면 −evadeLow (15 이상 0) · 20이면 +evadeHigh (예전 회피 ±5%p에 더해) */
  evadeLow: 0.08, evadeHigh: 0.03,
  /**
   * (라) 이동 시간: 발놀림 1이면 × (1 + slowMove) (15 이상 그대로, 예전 발놀림 배율에 더해).
   * 쫄 딜 새 층 (쫄 처리 15 밑 × 0.8까지)은 쫄 많은 판 (포자 동굴 정원 뿌리방 악몽)이 700초를 넘겨 뺌, 99 통합 점검 때 던전 숫자와 함께
   */
  slowMove: 0.25,
  /** (다) 직업 스킬: 쓸 때가 돼도 늦게 쓰는 평균 (초, 판단 1, 15 이상 0 = 예전처럼 0.2초 판단 주기에) · 헛씀 (기술 숙련 1, 재사용 능력만) */
  abLate: 1.2, fumble: 0.12,
  /**
   * (다) 헛씀 종류 (Codex 검토 반영 4): 헛씀이 나오면 fumbleFull 몫만 예전처럼 다 헛씀 (재사용만 돎), 나머지는 스킬 종류대로 어설프게 —
   * 방어 = 지속이 × fumbleShort (일찍 켜서 강타 직전에 꺼짐, 예고 하나만 막는 것은 터지기 0.3초 전에 꺼짐) · 공격 = 효과 × fumbleHalf (반만 들어감) · 지원 · 회복 · 방해 = 효과 × fumbleWeak.
   * 한 위기에 실수가 겹치면 (slipSec초 안 slipN번: 못 피함 · 머뭇거림 · 헛씀 · 멍 · 휘청 · 자세 놓침 · 붙어 섬 · 혼자 놂 · 당황) regroupSec초 동안 새 실수 굴림이 없음 (칸 위 「정신 차림」)
   */
  fumbleFull: 0.25, fumbleShort: 0.5, fumbleHalf: 0.5, fumbleWeak: 0.6, slipN: 3, slipSec: 8, regroupSec: 5,
  /**
   * 집중 「멍」 (99, Lim 06:47 「능력치 하나하나 모두 의미있게」): 집중이 15보다 낮으면 전투가 길어질수록 잠깐 딴생각 (칸 위 「멍」 dazeSec초).
   * 잦기 = dazeRate × 서툼 (초당), 처음 dazeFirst초는 없고 그 뒤 dazeRamp초에 걸쳐 커짐 (긴 전투일수록). 그동안 새 장판 반응 · 판단을 미루고 한 방 빗나감 + dazeMiss, 탱커는 위협 쌓기가 집중 배율로 (이동 · 강타 때처럼).
   * 15 이상은 없음. 15 넘는 쪽은 예전 큰 무대 보너스 (fmFx focus) 그대로
   */
  dazeRate: 1 / 30, dazeFirst: 20, dazeRamp: 150, dazeSec: 1.5, dazeMiss: 0.3,
  /**
   * 맷집 (99): 한 방에 최대 체력 bigHit 넘게 맞으면 (틱 피해 빼고), 맷집이 15보다 낮으면 stagger × 서툼 확률로 「휘청」 staggerSec초 (공격 · 새 이동 · 판단 멈춤, 탱커는 위협 쌓기 집중 배율).
   * 15 넘으면 휘청 없이 잘함 확률로 「버팀」: 탱커는 강타를 맞은 1초 동안에도 위협을 그대로 쌓음
   */
  bigHit: 0.25, stagger: 0.7, staggerSec: 1.2,
  /**
   * 위치 잡기 (99, 탱커가 아닌 사람, 탱커 쪽은 (나) 그대로): 15보다 낮으면 옮겨붙음 · 부풀기를 든 채 spreadMiss × 서툼 확률로 비켜 서지 않고 붙어 섬 (칸 위 「붙어 섬」, 옆 사람이 같이 맞음) ·
   * 칸을 고를 때 흔들림 2 → 2 + posNoise × 서툼 (나쁜 자리). 15 넘으면 잘함 확률로 옆 사람이 든 옮겨붙음 · 부풀기에서 먼저 떨어져 서고, 연쇄 번개 대상이면 비켜 섬
   */
  spreadMiss: 0.5, posNoise: 20,
  /**
   * 협동 (99, 예전 쫄 처리, Lim 07:04 「협동」): 동료와 맞추고 실수를 메우는 솜씨. 15 밑은 나눠 맞는 장판 (집결 분담)에 뽑혀도 soakSkip × 서툼 확률로 안 옴 (칸 위 「혼자 놂」, 그 자리는 빔).
   * 15 넘으면 잘함 확률로 (1) 끊기 실패 뒤 대신 끊기 (Codex 검토 반영 3: 알아채기 coverNotice[0] + [1] × 반응 · 판단 서툼, 진짜 재사용 대기 그대로),
   * (2) 탱커가 모두 쓰러지면 standSec초 동안 보스를 붙잡음 (받는 피해 − standCut, 대타 성격이 먼저), (3) 나눠 맞기에 먼저 나섬 (잘함 0.5 이상)
   */
  soakSkip: 0.5, coverNotice: [0.4, 1.2] as [number, number], standSec: 4, standCut: 0.25,
};
