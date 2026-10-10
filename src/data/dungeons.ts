import type { EncounterKey } from './encounters';

/** 5인 던전 (11 4장, 23). 구간을 차례로 이어서 하고, 구간 사이에 휴식 (09 S07) */
export type DungeonKey = 'rustfort' | 'plateau' | 'cemetery' | 'marsh' | 'crypt' | 'lily' | 'swamp' | 'snowpass' | 'manor' | 'hillpath' | 'frost' | 'pilgrim' | 'temple' | 'abyssedge' | 'watchtower'
  | 'bookfield' | 'rosemaze' | 'sewer' | 'archive' | 'ossuary' | 'shellbeach' | 'wreck'
  | 'lampway' | 'emberfoot' | 'teaparty' | 'mossroot' | 'rainbow'
  | 'ashpass' | 'hotspring' | 'forge' | 'lakeshore'
  | 'deepstairs' | 'hourglass' | 'caravan' | 'pinwheel' | 'observatory' | 'ranch' | 'windmill' | 'station' | 'school';

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
  // 묶음 B (46 1장): 탐험 ⑨~⑫ · 던전 ⑧~⑩
  shellbeach: { key: 'shellbeach', name: '조개껍데기 해변', segments: ['gullsand', 'crab36'] },
  bookfield: { key: 'bookfield', name: '책갈피 설원', segments: ['pagedrift', 'librarian40'] },
  wreck: { key: 'wreck', name: '난파선 모래톱', segments: ['wreckage', 'goldbeard44'] },
  rosemaze: { key: 'rosemaze', name: '장미 울타리 미로', segments: ['rosetunnel', 'priestess48'] },
  sewer: { key: 'sewer', name: '역병 수로', segments: ['leakyway', 'ratking', 'sludgegrate', 'carrier'] },
  archive: { key: 'archive', name: '얼음 서고', segments: ['iceread', 'librarian', 'forbidden', 'scholar'] },
  ossuary: { key: 'ossuary', name: '백합 납골당', segments: ['petalstair', 'priestess', 'keeperhall', 'sleeper'] },
  // 묶음 C (48 1장): 탐험 ⑬ ⑮ · 던전 ⑪ ⑫
  lampway: { key: 'lampway', name: '꼬마등 오솔길', segments: ['capway', 'sippy52'] },
  rainbow: { key: 'rainbow', name: '무지개 버섯밭', segments: ['pollenfield', 'queen56'] },
  // 묶음 D (51 1장): 탐험 ⑯ · 던전 ⑬ ⑭
  ashpass: { key: 'ashpass', name: '화산재 고갯길', segments: ['warmash', 'mungsil64'] },
  lakeshore: { key: 'lakeshore', name: '잠긴 호숫가', segments: ['shoretrash', 'knights68'] },
  // 묶음 E1 (54 1장): 탐험 ⑱ · 던전 ⑮
  deepstairs: { key: 'deepstairs', name: '물밑 계단', segments: ['stairtrash', 'heumul72'] },
  hourglass: { key: 'hourglass', name: '모래시계 궁전', segments: ['sandhall', 'degul', 'backgarden', 'dooldool'] },
  // 묶음 E2 (54 1-1): 탐험 ⑲
  caravan: { key: 'caravan', name: '낙타 대상로', segments: ['dunetrash', 'pokshin76'] },
  // 묶음 E3 (54 1장): 탐험 ⑳ · 던전 ⑯
  pinwheel: { key: 'pinwheel', name: '바람개비 언덕', segments: ['windtrash', 'hwirik'] },
  observatory: { key: 'observatory', name: '해시계 천문대', segments: ['startrash', 'stargazer', 'sundialyard', 'geuneul'] },
  // 묶음 F1 (56 1장): 탐험 ㉑ · 던전 ⑰
  ranch: { key: 'ranch', name: '구름 양 목장', segments: ['sheeptrash', 'boksul84'] },
  windmill: { key: 'windmill', name: '천둥 풍차', segments: ['millstairs', 'boksul', 'millhouse', 'dolgae'] },
  // 묶음 F3 (56 1-1 · 1-2)
  station: { key: 'station', name: '빗자루 정류장', segments: ['platform', 'pongpong88'] },
  school: { key: 'school', name: '구름 마법학교', segments: ['upsidehall', 'pongpong', 'boltlab', 'dwijuk'] },
  hotspring: { key: 'hotspring', name: '용암 온천장', segments: ['steamroom', 'mungsil', 'lavabath', 'bulttung'] },
  forge: { key: 'forge', name: '용암 대장간', segments: ['coldhearth', 'huggeun', 'anvilbridge', 'ttangttang'] },
  emberfoot: { key: 'emberfoot', name: '불꽃 봉우리 기슭', segments: ['hotgravel', 'kobold60'] },
  teaparty: { key: 'teaparty', name: '끝없는 다과회', segments: ['sugarstair', 'sippy', 'cuptower', 'hatter'] },
  mossroot: { key: 'mossroot', name: '이끼 뿌리 사원', segments: ['wetstair', 'uga', 'turtlebridge', 'shellgod'] },
};

/** 휴식: 초당 마나 회복 (%). 「계속」은 언제든 누를 수 있음 */
export const REST_MANA_PER_SEC = 10;
