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
