import type { EncounterKey } from './encounters';

/** 5인 던전 (11 4장, 23). 구간을 차례로 이어서 하고, 구간 사이에 휴식 (09 S07) */
export type DungeonKey = 'rustfort' | 'plateau' | 'cemetery' | 'marsh' | 'crypt' | 'lily' | 'swamp' | 'snowpass' | 'manor' | 'hillpath' | 'frost' | 'pilgrim' | 'temple' | 'abyssedge' | 'watchtower'
  | 'bookfield' | 'rosemaze' | 'sewer' | 'archive' | 'ossuary' | 'shellbeach' | 'wreck'
  | 'lampway' | 'emberfoot' | 'teaparty' | 'mossroot' | 'rainbow'
  | 'ashpass' | 'hotspring' | 'forge' | 'lakeshore'
  | 'deepstairs' | 'hourglass' | 'caravan' | 'pinwheel' | 'observatory' | 'ranch' | 'windmill' | 'station' | 'school' | 'carriage' | 'ballroom' | 'lantern' | 'dawn' | 'heartcrack'
  | 'scrapheap' | 'mine' | 'alley' | 'greenhouse' | 'frogpond' | 'reedvillage' | 'fountain' | 'perfumery' | 'icefish' | 'snowlab' | 'harvest'
  | 'granary' | 'scarefield' | 'smuggler' | 'reef' | 'frostgarden' | 'dorm' | 'cultcamp' | 'apothecary' | 'rooftop' | 'bakery' | 'dewhill' | 'mushmarsh' | 'lilypalace'
  | 'quarry' | 'smithy' | 'ferry' | 'turtlecave' | 'mistplaza' | 'coralgarden' | 'oasis' | 'sandlibrary' | 'sundialroad'
  | 'cloudbridge' | 'flightyard' | 'stormmeadow' | 'cloudlibrary' | 'broomrace' | 'sunkrose' | 'lotusway' | 'waterglow' | 'barracks' | 'outpost' | 'starcave' | 'sunrisehill'
  // 113 초반 보충 장소
  | 'brasspress' | 'coolant' | 'repairbay' | 'gravefirefly' | 'wailhill' | 'washyard' | 'ashalley'
  | 'waxseal' | 'censerstore' | 'sproutworks' | 'pollenstore' | 'splitgate' | 'gratedrain' | 'bandagetent' | 'herbcart'
  | 'stitchroom' | 'twindistill' | 'roofgutter' | 'flagroad' | 'mistlamp' | 'lightbasin' | 'reedwatch' | 'smallferry'
  | 'mirrorpond' | 'olddam' | 'reedwell' | 'drumhall' | 'silkwalk' | 'dewrest' | 'sporetrack' | 'lilydrill' | 'lilygate';

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
  // 묶음 G1 (59 1-1 · 1-2)
  carriage: { key: 'carriage', name: '유령 마차길', segments: ['carriagetrash', 'serena92'] },
  ballroom: { key: 'ballroom', name: '가라앉은 무도회장', segments: ['ballhall', 'serena', 'balcony', 'valen'] },
  // 묶음 G2 (59 1-1)
  lantern: { key: 'lantern', name: '어둠물 등불길', segments: ['lanterntrash', 'nokseul96'] },
  // 묶음 G3 (59 1-1 · 1-2)
  dawn: { key: 'dawn', name: '새벽 호숫길', segments: ['dawntrash', 'heartshard100'] },
  heartcrack: { key: 'heartcrack', name: '멈춘 심장 속', segments: ['cracktrash', 'nokseul', 'coolroot', 'lastshade'] },
  hotspring: { key: 'hotspring', name: '용암 온천장', segments: ['steamroom', 'mungsil', 'lavabath', 'bulttung'] },
  forge: { key: 'forge', name: '용암 대장간', segments: ['coldhearth', 'huggeun', 'anvilbridge', 'ttangttang'] },
  emberfoot: { key: 'emberfoot', name: '불꽃 봉우리 기슭', segments: ['hotgravel', 'kobold60'] },
  teaparty: { key: 'teaparty', name: '끝없는 다과회', segments: ['sugarstair', 'sippy', 'cuptower', 'hatter'] },
  mossroot: { key: 'mossroot', name: '이끼 뿌리 사원', segments: ['wetstair', 'uga', 'turtlebridge', 'shellgod'] },
  // 묶음 H1 (62 2-1): 탐험 = 일반 → 보스, 던전 = 일반 → 보스 ① → 정예 → 보스 ②
  scrapheap: { key: 'scrapheap', name: '고철 더미 언덕', segments: ['heaptrash', 'kongkong5'] },
  mine: { key: 'mine', name: '녹슨 광산', segments: ['shaft', 'kongkong', 'railway', 'gurit'] },
  alley: { key: 'alley', name: '잿빛 뒷골목', segments: ['alleytrash', 'molly10'] },
  greenhouse: { key: 'greenhouse', name: '역병 약초 온실', segments: ['pothall', 'molly', 'mushbed', 'chingching'] },
  frogpond: { key: 'frogpond', name: '개구리 연못', segments: ['lilypads', 'kara15'] },
  reedvillage: { key: 'reedvillage', name: '갈대 오두막 마을', segments: ['reedfence', 'kara', 'mudpath', 'cheolbeok'] },
  fountain: { key: 'fountain', name: '분수 정원', segments: ['fountainwalk', 'lavender20'] },
  perfumery: { key: 'perfumery', name: '백합 향수 공방', segments: ['bottlehall', 'lavender', 'stillroom', 'rose'] },
  icefish: { key: 'icefish', name: '얼음 호수 낚시터', segments: ['iceholes', 'ppodeuk25'] },
  snowlab: { key: 'snowlab', name: '눈꽃 연구소', segments: ['toolstore', 'ppodeuk', 'coldstore', 'icia'] },
  harvest: { key: 'harvest', name: '해바라기 수확밭', segments: ['sheaves', 'jipdan30'] },
  // 묶음 H2 (62): 탐험 = 일반 → 보스, 던전 = 일반 → 보스 ① → 정예 → 보스 ②
  granary: { key: 'granary', name: '황금 이삭 곡물창고', segments: ['sacks', 'jipdan', 'millwheel', 'nadal'] },
  scarefield: { key: 'scarefield', name: '허수아비 들판', segments: ['crowfield', 'nadal34'] },
  smuggler: { key: 'smuggler', name: '산호 동굴 밀수굴', segments: ['wetcave', 'peg', 'powder', 'pado'] },
  reef: { key: 'reef', name: '산호초 얕은 물', segments: ['reefpool', 'peg38'] },
  frostgarden: { key: 'frostgarden', name: '서리 마탑 정원', segments: ['iceflowers', 'jiji42'] },
  dorm: { key: 'dorm', name: '마도사 기숙사', segments: ['messhall', 'jiji', 'lounge', 'eomgyeok'] },
  cultcamp: { key: 'cultcamp', name: '교단 숲속 야영지', segments: ['campfire', 'geopum46'] },
  apothecary: { key: 'apothecary', name: '교단 약품 제조실', segments: ['shelves', 'geopum', 'cauldron', 'malos'] },
  rooftop: { key: 'rooftop', name: '왕도 지붕길', segments: ['tiles', 'malos50'] },
  bakery: { key: 'bakery', name: '반딧불 빵집', segments: ['flourstore', 'polpol', 'oven', 'monggeul'] },
  dewhill: { key: 'dewhill', name: '이슬 버섯 언덕', segments: ['dewpath', 'polpol54'] },
  mushmarsh: { key: 'mushmarsh', name: '버섯숲 늪가', segments: ['mushpath', 'poljjak58'] },
  lilypalace: { key: 'lilypalace', name: '두꺼비 왕국 수련궁', segments: ['lilybridge', 'poljjak', 'tadpond', 'umulluk'] },
  // 묶음 H3 (62): 탐험 = 일반 → 보스, 던전 = 일반 → 보스 ① → 정예 → 보스 ②
  quarry: { key: 'quarry', name: '용 비늘 채석장', segments: ['scalepile', 'ttemjil62'] },
  smithy: { key: 'smithy', name: '코볼트 불꽃 공방', segments: ['charcoal', 'ttemjil', 'bellowway', 'hwalhwal'] },
  ferry: { key: 'ferry', name: '용암 강 나룻터', segments: ['hotdock', 'jigeul66'] },
  turtlecave: { key: 'turtlecave', name: '용암 거북 동굴', segments: ['steamcave', 'jigeul', 'gemvein', 'garnet'] },
  mistplaza: { key: 'mistplaza', name: '물안개 광장', segments: ['miststeps', 'malmijal70'] },
  coralgarden: { key: 'coralgarden', name: '물밑 산호 정원', segments: ['kelphall', 'malmijal', 'pearlpond', 'chalrang'] },
  oasis: { key: 'oasis', name: '모래 언덕 오아시스', segments: ['palmshade', 'baseurak74'] },
  sandlibrary: { key: 'sandlibrary', name: '모래 서기관 도서관', segments: ['sandshelf', 'baseurak', 'sealedstack', 'gitpen'] },
  sundialroad: { key: 'sundialroad', name: '노을 해시계 길', segments: ['obelisks', 'gitpen78'] },
  // 묶음 H4 (62): 탐험 = 일반 → 보스, 던전 = 일반 → 보스 ① → 정예 → 보스 ②
  cloudbridge: { key: 'cloudbridge', name: '구름 다리', segments: ['swaybridge', 'hwiparam82'] },
  flightyard: { key: 'flightyard', name: '깃털단 비행 훈련장', segments: ['glideyard', 'hwiparam', 'windtunnel', 'hoeori'] },
  stormmeadow: { key: 'stormmeadow', name: '번개 구름 목초지', segments: ['zapgrass', 'hoeori86'] },
  cloudlibrary: { key: 'cloudlibrary', name: '구름 도서관 탑', segments: ['floatshelf', 'peoleok', 'forbidstair', 'swit'] },
  broomrace: { key: 'broomrace', name: '빗자루 경주로', segments: ['startline', 'swit90'] },
  sunkrose: { key: 'sunkrose', name: '가라앉은 장미 정원', segments: ['drownhall', 'gawison', 'thornmaze', 'rosalin'] },
  lotusway: { key: 'lotusway', name: '호수 밑 연꽃길', segments: ['lotusstep', 'gawison94'] },
  waterglow: { key: 'waterglow', name: '물빛 정원', segments: ['glowpond', 'lastecho97'] },
  barracks: { key: 'barracks', name: '심연 정예 병영', segments: ['drillyard', 'kalnal', 'weaponrack', 'heukbaek'] },
  outpost: { key: 'outpost', name: '그림자 초소', segments: ['palisade', 'kalnal98'] },
  starcave: { key: 'starcave', name: '별빛 수정 동굴', segments: ['crystalstair', 'banjjak', 'echohall', 'lastecho'] },
  sunrisehill: { key: 'sunrisehill', name: '아침 햇살 언덕', segments: ['sunpath', 'banjjak99'] },
  // 113 초반 보충 장소 1차 (Lv 5~8): 던전 = 일반 → 정예 → 일반 → 보스, 탐험 = 일반 → 보스
  brasspress: { key: 'brasspress', name: '황동 압착장', segments: ['pressgate', 'pressguard', 'pressway', 'kkuksoe'] },
  coolant: { key: 'coolant', name: '냉각수 배관실', segments: ['leakhall', 'pipefixer', 'coolway', 'chiik'] },
  repairbay: { key: 'repairbay', name: '버려진 정비동', segments: ['partshelf', 'cutter', 'workbench', 'deolkeok'] },
  gravefirefly: { key: 'gravefirefly', name: '반딧불 묘지길', segments: ['darkpath', 'huuk'] },
  wailhill: { key: 'wailhill', name: '묘지 곡소리 언덕', segments: ['wailpath', 'heuneuk'] },
  washyard: { key: 'washyard', name: '오염된 빨래터', segments: ['soakalley', 'eolluk'] },
  ashalley: { key: 'ashalley', name: '잿바람 골목', segments: ['ashpile', 'puseokash'] },
  // 113 2차 (Lv 9~12)
  waxseal: { key: 'waxseal', name: '밀랍 봉인실', segments: ['waxhall', 'waxdoll', 'sealstore', 'chorereu'] },
  censerstore: { key: 'censerstore', name: '검은 향로 보관실', segments: ['incensepass', 'censerguard', 'brokencase', 'huljjeok'] },
  sproutworks: { key: 'sproutworks', name: '새싹 급수장', segments: ['drycanal', 'vineguard', 'seedbench', 'mallim'] },
  pollenstore: { key: 'pollenstore', name: '꽃가루 저장실', segments: ['pollenshelf', 'thornporter', 'sackstore', 'kkaseul'] },
  splitgate: { key: 'splitgate', name: '갈라진 수문', segments: ['floodhall', 'gateshield', 'drainway', 'multeok'] },
  gratedrain: { key: 'gratedrain', name: '철창 배수실', segments: ['sievehall', 'clawguard', 'cagepass', 'kkwakjip'] },
  bandagetent: { key: 'bandagetent', name: '붕대 보급천막', segments: ['bandageroad', 'charye'] },
  herbcart: { key: 'herbcart', name: '야간 약초수레길', segments: ['cartroad', 'humchim'] },
  // 113 3차 (Lv 13~16)
  stitchroom: { key: 'stitchroom', name: '응급 봉합실', segments: ['tornhall', 'stitchdoll', 'triagebed', 'ttakkeum'] },
  twindistill: { key: 'twindistill', name: '쌍둥이 증류실', segments: ['tubehall', 'frother', 'stillway', 'dubangul'] },
  roofgutter: { key: 'roofgutter', name: '빗물받이 지붕', segments: ['wettiles', 'chalbak'] },
  flagroad: { key: 'flagroad', name: '낡은 깃발길', segments: ['flagwalk', 'gotge'] },
  mistlamp: { key: 'mistlamp', name: '안개등 징검길', segments: ['foggystones', 'heurit'] },
  lightbasin: { key: 'lightbasin', name: '빛고임 수초밭', segments: ['glowweeds', 'ttorong'] },
  reedwatch: { key: 'reedwatch', name: '갈대 감시초소', segments: ['reedarrows', 'hwingnun'] },
  smallferry: { key: 'smallferry', name: '작은 나룻터', segments: ['ferrypath', 'danggim'] },
  // 113 4차 (Lv 17~20)
  mirrorpond: { key: 'mirrorpond', name: '물그림자 관측소', segments: ['mirrorgate', 'shadowguard', 'shallowway', 'bichim'] },
  olddam: { key: 'olddam', name: '오래된 둑 보루', segments: ['undamway', 'mudshield', 'brokenfort', 'mukjik'] },
  reedwell: { key: 'reedwell', name: '갈대 우물집', segments: ['wellyard', 'bucketguard', 'wellstair', 'durae'] },
  drumhall: { key: 'drumhall', name: '북소리 회당', segments: ['woodhall', 'drumguard', 'lowstage', 'dungtak'] },
  silkwalk: { key: 'silkwalk', name: '잠든 누에길', segments: ['silkpath', 'mongsil'] },
  dewrest: { key: 'dewrest', name: '이슬꽃 쉼터', segments: ['dewpath2', 'kkumul'] },
  sporetrack: { key: 'sporetrack', name: '포자 굴림길', segments: ['puffslope', 'ttoreureu'] },
  lilydrill: { key: 'lilydrill', name: '수련 근위 훈련장', segments: ['drillyard2', 'spearguard', 'bandagelane', 'tuktuk'] },
  lilygate: { key: 'lilygate', name: '수련 수문 회랑', segments: ['lotuswater', 'gatespear', 'lowcorridor', 'yeongap'] },
};

/** 휴식: 초당 마나 회복 (%). 「계속」은 언제든 누를 수 있음 */
export const REST_MANA_PER_SEC = 10;
