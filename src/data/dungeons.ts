import type { EncounterKey } from './encounters';

/** 5인 던전 (11 4장, 23). 구간을 차례로 이어서 하고, 구간 사이에 휴식 (09 S07) */
export type DungeonKey = 'rustfort';

export interface Dungeon {
  key: DungeonKey;
  name: string;
  /** 차례대로. 잡몹 구간과 보스 */
  segments: EncounterKey[];
}

export const DUNGEONS: Record<DungeonKey, Dungeon> = {
  rustfort: { key: 'rustfort', name: '녹슨 요새', segments: ['gate', 'scrap', 'boiler', 'warden'] },
};

/** 휴식: 초당 마나 회복 (%). 「계속」은 언제든 누를 수 있음 */
export const REST_MANA_PER_SEC = 10;
