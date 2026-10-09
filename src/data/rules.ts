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
}

export const RULES: Rules = { lv: lvPower, apex: apexOf, enemy: 0.95, enemyDmg: 0.85, gcd: 1.5, hasteCap: 0.5, baseCrit: 0, regen: 0.7 };

/** 34 이전 값: 숫자 ×2.5 · 레벨마다 +0.08, 적 = 내 레벨과 같은 세기, GCD 1.0, 기본 치명 5%, 마나 재생 1%, 시전이 짧음 */
export const PROTO_RULES: Rules = {
  lv: lvPowerProto, apex: () => 1, enemy: 1, enemyDmg: 1, gcd: 1.0, hasteCap: Infinity, baseCrit: 0.05, regen: 1.0,
  cast: { heal: 1.8, flash: 1.0, poh: 2.0, growth: 1.5, wildflower: 1.5, rebirth: 2.0, holyLight: 1.5 },
};

/** 지능 1 = 치유 회복량 (34 1-2): 스킬 회복량은 지능의 비율 (예전 수치 ÷ 300) */
export const INT_BASE = 300;
