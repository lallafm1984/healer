/**
 * 첫 5분 튜토리얼 (02 11장, 09 4장): 2인 첫 전투 → 3인 탐험 「녹슨 고원」 → 끝 (34 5-2).
 * 첫 던전 안내는 Lv 5에 녹슨 요새가 열려 처음 들어갈 때 (firstDungeon). 단계는 저장(save.tut)에 남아서 앱을 껐다 켜도 이어서 한다.
 */
import type { RosterEntry } from '../engine';
import type { SaveData } from '../platform/storage';

export const TUT = {
  /** 이야기 → 2인 첫 전투 */
  intro: 0,
  /** 3인 탐험 「녹슨 고원」 */
  explore: 1,
  /** 끝. 2는 예전 「로비 → 녹슨 요새 첫 클리어」 단계 (옛 저장은 끝으로 읽음) */
  done: 3,
} as const;

/** 전투 중 안내 묶음 (battle/hud.ts COACH) */
export type CoachKey = 'duo' | 'explore' | 'dungeon';

/** 첫 전투 파티: 탱커 1명. 성격은 가장 순한 신중파 */
export const DUO_PARTY: RosterEntry[] = [{ role: 'tank', pers: '신중파', nick: '방패든양', cls: 'warrior' }];

/** 정산 때 튜토리얼 단계 넘기기: 탐험 클리어 → 끝. 넘겼으면 true */
export function advanceTutorial(save: SaveData, content: string, win: boolean): boolean {
  if (!win || save.tut !== TUT.explore || content !== 'plateau') return false;
  save.tut = TUT.done;
  return true;
}

/** 첫 던전 안내 차례: 튜토리얼 뒤, 녹슨 요새 (Lv 5) 레벨이 됐는데 아직 못 깸 */
export const firstDungeonDue = (save: SaveData, open: boolean) => save.tut >= TUT.done && open && !save.clears.rustfort;
