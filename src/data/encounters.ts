import type { BoardId } from './boards';
import type { DiffName } from './difficulty';

/** 보스 전투 (05). 기술 스크립트는 engine/bosses.ts */
export type EncounterKey = 'warden' | 'plague' | 'plague20';
export type ScriptKey = 'warden' | 'plague';

export interface Encounter {
  key: EncounterKey;
  name: string;
  tier: string;
  board: BoardId;
  /** 힐러를 뺀 파티 구성 */
  comp: { tank: number; melee: number; ranged: number };
  hp: number;
  /** 광폭화 시각 (초) */
  enrage: number;
  /** 마나 재생 배율 */
  manaCoef: number;
  diffs: DiffName[];
  script: ScriptKey;
  /** 저레벨 던전: 탱커는 ★ 성격만, ★★★ 파티당 최대 1명 (04 6-F) */
  lowLevel?: boolean;
  /** 20인 */
  big?: boolean;
  /** 화면 보스 그림 단계 구분용 */
  stage: number;
}

export const ENCOUNTERS: Record<EncounterKey, Encounter> = {
  warden: { key: 'warden', lowLevel: true, name: '녹슨 문지기', tier: '던전 · 5인', board: 'b10', comp: { tank: 1, melee: 1, ranged: 2 }, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ['쉬움', '보통', '어려움', '악몽'], script: 'warden', stage: 0.25 },
  plague: { key: 'plague', name: '역병 군주', tier: '레이드 · 10인', board: 'b19', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 22000, enrage: 390, manaCoef: 1.3, diffs: ['쉬움', '보통', '어려움'], script: 'plague', stage: 0.18 },
  plague20: { key: 'plague20', name: '역병 군주', tier: '레이드 악몽 · 20인', board: 'b30', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 48000, enrage: 450, manaCoef: 1.6, diffs: ['악몽'], script: 'plague', big: true, stage: 0.13 },
};
