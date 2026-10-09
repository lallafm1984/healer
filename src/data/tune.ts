import type { DiffName } from './difficulty';
import type { EncounterKey } from './encounters';

/** 난이도 하나의 보정: 보스·적 피해 배율, 체력 배율 (없으면 1) */
export interface Tune { dmg?: number; hp?: number }
export type TuneTable = Partial<Record<EncounterKey, Partial<Record<DiffName, Tune>>>>;

/**
 * 난이도별 보스·적 보정 (38 0-6 자동 밸런스가 적는 표). `npm run balance -- --write`가 아래 TUNE을 다시 쓰고, 이 위 설명은 그대로 둠.
 * 기준 = 열림 레벨 · 그 레벨에서 열린 특성 · 공개모집 능력 1개 · 권장 장비로 자동 힐러 세 직업 평균 (src/sim/balance.ts, `26` 9-2).
 * 던전·탐험은 장소 하나에 값 하나: 그 장소의 모든 구간에 같은 값.
 * - 2026-10-08 레이드 재조정 (Lim: 특성·능력 포함 기준): 어려움 약 85%, 악몽 약 75%.
 * - 2026-10-09 직업군 방어력(34 9장)과 34 1장 숫자·시전·GCD로 다시 맞춤, 특성 Lv 50 완성(34 2-1) 뒤 성가대 악몽만 1.12 → 1.16 (세 직업 평균, 30판).
 * - 2026-10-09 보스전 판 6×6 (36칸): 역병 군주 악몽은 칸이 넓어져 전염·역병 폭풍을 피하기 쉬워져서 1.17 → 1.34 (세 직업 평균 약 80%, 60~90판).
 * - 2026-10-09 자동 밸런스 첫 실행 (38 0-6, 직업마다 40판): 역병 군주 어려움이 6×6 판 뒤 95%로 쉬워져서 1.38 → 1.65 (85%). 나머지 레이드는 목표 안이라 그대로.
 */
export const TUNE: TuneTable = {
  plague: { '어려움': { dmg: 1.65 }, '악몽': { dmg: 1.34 } },
  choir: { '어려움': { dmg: 1.09 }, '악몽': { dmg: 1.16 } },
};
