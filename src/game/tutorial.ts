/**
 * 첫 5분 튜토리얼 (02 11장, 09 4장): 2인 첫 전투 → 3인 탐험 → 로비 → 녹슨 요새 첫 클리어.
 * 단계는 저장(save.tut)에 남아서 앱을 껐다 켜도 이어서 한다.
 */
import type { RosterEntry } from '../engine';
import type { SaveData } from '../platform/storage';

export const TUT = {
  /** 이야기 → 2인 첫 전투 */
  intro: 0,
  /** 3인 탐험 「녹슨 고원」 */
  explore: 1,
  /** 로비 → 녹슨 요새 첫 클리어 */
  dungeon: 2,
  done: 3,
} as const;

/** 전투 중 안내 묶음 (legacy/protoUi.js COACH) */
export type CoachKey = 'duo' | 'explore' | 'dungeon';

/** 첫 전투 파티: 탱커 1명. 성격은 가장 순한 신중파 */
export const DUO_PARTY: RosterEntry[] = [{ role: 'tank', pers: '신중파', nick: '방패든양', cls: 'warrior' }];

/** 정산 때 튜토리얼 단계 넘기기: 탐험 클리어 → 던전 안내, 녹슨 요새 클리어 → 끝 */
export function advanceTutorial(save: SaveData, content: string, win: boolean): void {
  if (!win) return;
  if (save.tut === TUT.explore && content === 'plateau') save.tut = TUT.dungeon;
  else if (save.tut === TUT.dungeon && content === 'rustfort') save.tut = TUT.done;
}
