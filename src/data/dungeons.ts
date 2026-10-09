import type { EncounterKey } from './encounters';

/** 5인 던전 (11 4장, 23). 구간을 차례로 이어서 하고, 구간 사이에 휴식 (09 S07) */
export type DungeonKey = 'rustfort' | 'plateau' | 'cemetery' | 'marsh' | 'crypt' | 'lily' | 'swamp' | 'snowpass' | 'manor' | 'hillpath' | 'frost' | 'pilgrim' | 'temple' | 'abyssedge' | 'watchtower';

export interface Dungeon {
  key: DungeonKey;
  name: string;
  /** 차례대로. 일반·정예 구간과 보스 */
  segments: EncounterKey[];
}

export const DUNGEONS: Record<DungeonKey, Dungeon> = {
  rustfort: { key: 'rustfort', name: '녹슨 요새', segments: ['gate', 'scrap', 'boiler', 'warden'] },
  // 탐험 3인 (02 11장 2번): 적 → 고철 순찰병
  plateau: { key: 'plateau', name: '녹슨 고원', segments: ['field', 'patrol'] },
  // 탐험 ② (39 1-1): 잿빛 묘역 → 뼈다귀 수집가
  cemetery: { key: 'cemetery', name: '잿빛 공동묘지', segments: ['ashyard', 'collector3'] },
  marsh: { key: 'marsh', name: '늪지 어귀', segments: ['reedbank', 'shaman8'] },
  lily: { key: 'lily', name: '백합 정원', segments: ['flowerbed', 'butler13'] },
  snowpass: { key: 'snowpass', name: '눈보라 고개', segments: ['snowslope', 'golem18'] },
  frost: { key: 'frost', name: '서리 마탑', segments: ['icehall', 'frostgolem', 'mage', 'frostlab', 'shadow'] },
  hillpath: { key: 'hillpath', name: '해바라기 언덕길', segments: ['restyard', 'guardian23'] },
  pilgrim: { key: 'pilgrim', name: '무너진 순례길', segments: ['brokenbridge', 'keeper28'] },
  watchtower: { key: 'watchtower', name: '무너진 망루', segments: ['rubblestair', 'sentinel', 'blackrift', 'crystal'] },
  abyssedge: { key: 'abyssedge', name: '심연 가장자리', segments: ['riftground', 'plague33'] },
  temple: { key: 'temple', name: '깨진 신전', segments: ['templeyard', 'guardian', 'nave', 'keeper'] },
  manor: { key: 'manor', name: '저주받은 장원', segments: ['parlor', 'butler', 'lady', 'kennel', 'belmore'] },
  swamp: { key: 'swamp', name: '독안개 늪', segments: ['rotbridge', 'shaman', 'toad', 'toadnest', 'seres'] },
  crypt: { key: 'crypt', name: '역병 지하묘지', segments: ['bonepass', 'collector', 'censerhall', 'malchor'] },
};

/** 휴식: 초당 마나 회복 (%). 「계속」은 언제든 누를 수 있음 */
export const REST_MANA_PER_SEC = 10;
