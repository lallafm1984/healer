/**
 * 장소 (11 4장 던전·레이드 지역)와 세력 (11 3장, 16 4-3). 그림 자리는 28 문서.
 * 장소마다 바닥 그림 floor-<장소>(전투 진형 판 뒤)와 풍경 그림 scene-<장소>(카드·입장·보스 무대). 풍경이 없으면 바닥 그림을 대신 쓴다.
 */
import type { ContentKey } from './content';
import type { EncounterKey } from './encounters';

export type FactionKey = 'golem' | 'plague' | 'swamp' | 'noble' | 'mage' | 'hill' | 'abyss' | 'pirate' | 'fairy' | 'dragon' | 'sand' | 'storm' | 'deep';
export type PlaceKey = 'plateau' | 'rustfort' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple' | 'abyss' | 'cathedral'
  | 'cemetery' | 'marsh' | 'lily' | 'snowpass' | 'hillpath' | 'pilgrim' | 'abyssedge' | 'watchtower'
  | 'abyss-garden' | 'abyss-gallery' | 'abyss-observatory' | 'abyss-spire'
  | 'bookfield' | 'rosemaze' | 'sewer' | 'archive' | 'ossuary'
  | 'shellbeach' | 'wreck' | 'gull' | 'gull-kitchen' | 'gull-lighthouse' | 'queen' | 'queen-hold' | 'queen-bow' | 'isle' | 'isle-lookout' | 'isle-summit'
  | 'lampway' | 'teaparty' | 'mossroot' | 'emberfoot' | 'rainbow'
  | 'fest' | 'fest-stage' | 'fest-bonfire' | 'sporecave' | 'sporecave-pond' | 'sporecave-root' | 'palace' | 'palace-hall' | 'palace-throne'
  | 'ashpass' | 'hotspring' | 'forge' | 'den' | 'den-cart' | 'den-vault'
  | 'nest' | 'nest-bridge' | 'nest-hoard' | 'lakeshore' | 'cathedral-hall' | 'cathedral-organ' | 'cathedral-sanctum'
  | 'bazaar' | 'bazaar-alley' | 'bazaar-gate' | 'deepstairs' | 'abbey' | 'abbey-library' | 'abbey-altar' | 'hourglass'
  | 'dusk' | 'dusk-vault' | 'dusk-throne' | 'caravan' | 'rootwood' | 'rootwood-greenhouse' | 'rootwood-heart'
  | 'pyramid' | 'pyramid-clock' | 'pyramid-bed' | 'reservoir' | 'reservoir-bridge' | 'reservoir-mirror' | 'pinwheel' | 'observatory'
  | 'well' | 'well-moss' | 'well-floor' | 'post' | 'post-sort' | 'post-roof' | 'ranch' | 'windmill'
  | 'crystal' | 'crystal-field' | 'crystal-mirror' | 'fort' | 'fort-armory' | 'fort-top' | 'station' | 'shadow' | 'shadow-wall' | 'shadow-tower' | 'school'
  | 'maze' | 'maze-hall' | 'maze-core' | 'camp' | 'camp-yard' | 'camp-command' | 'carriage' | 'ballroom';

export interface Faction {
  name: string;
  /** 세력 색 = 해제 유형 색 (16 4-3) */
  color: string;
  /** 문양 테두리·선 색 (27 시안 Parts27 「세력 문양 · 모험 카드」). dark = 검은 바탕 (심연) */
  mark: { rim: string; glyph: string; dark?: boolean };
  /** 이 세력이 거는 해제 유형 (11 3장 대표 디버프). 골렘 = 물리·녹이라 없음, 해바라기 언덕 = 혼합 (11 4장 깨진 신전), 심연 = 전 유형 */
  dispel: string[];
}

const ALL_DISPEL = ['질병', '독', '저주', '마법'];

export const FACTIONS: Record<FactionKey, Faction> = {
  golem: { name: '버려진 골렘', color: '#C47A45', mark: { rim: '#C9763A', glyph: '#E39A5C' }, dispel: [] },
  plague: { name: '역병 교단', color: '#D9A13B', mark: { rim: '#A8963E', glyph: '#C9B45A' }, dispel: ['질병'] },
  swamp: { name: '늪의 부족', color: '#3CC24A', mark: { rim: '#6E9A3C', glyph: '#8FBF57' }, dispel: ['독'] },
  noble: { name: '몰락한 귀족가', color: '#A050E0', mark: { rim: '#8C6FA8', glyph: '#B79AD3' }, dispel: ['저주'] },
  mage: { name: '폭주한 마도사', color: '#3D8BFF', mark: { rim: '#6F95C9', glyph: '#9DBDE6' }, dispel: ['마법'] },
  // 해바라기 언덕은 시안에 없어서 테마 금테 색
  hill: { name: '해바라기 언덕', color: '#C9A35C', mark: { rim: '#9C7A3C', glyph: '#D9B26A' }, dispel: ALL_DISPEL },
  abyss: { name: '심연', color: '#E6D3A0', mark: { rim: '#E6E0D0', glyph: '#E6E0D0', dark: true }, dispel: ALL_DISPEL },
  // 묶음 B 새 세력 (46 0-2): 산호 해안의 짠물 해적단, 바다 청록
  pirate: { name: '짠물 해적단', color: '#2BB5B0', mark: { rim: '#3A9C98', glyph: '#6FD0C8' }, dispel: ['독', '저주'] },
  // 묶음 C (48 0장): 반딧불 버섯숲의 버섯 요정단 (연분홍) · 다음 지역 불꽃 봉우리의 붉은 용 일가 (탐험 ⑮에서 첫 등장, D에서 계속)
  fairy: { name: '버섯 요정단', color: '#F29CB7', mark: { rim: '#C9718F', glyph: '#F8C4D5' }, dispel: ['질병', '마법'] },
  dragon: { name: '붉은 용 일가', color: '#E0673C', mark: { rim: '#B5502E', glyph: '#F29466' }, dispel: ['독', '마법'] },
  // 묶음 E (54 0장): 노을 사막의 모래 왕국. 금모래 (역병 교단 호박색보다 밝고 노랗게), 문양 = 반쯤 뜬 해 + 모래시계
  sand: { name: '모래 왕국', color: '#E9C46A', mark: { rim: '#B8913E', glyph: '#F2D58A' }, dispel: ['질병', '저주'] },
  // 묶음 E 탐험 ⑳ (54 2장): 다음 지역 구름 위 섬의 폭풍 깃털단 (묶음 F에서 계속). 하늘색, 문양 = 깃털 + 바람 소용돌이
  storm: { name: '폭풍 깃털단', color: '#6EC3F0', mark: { rim: '#4C93BD', glyph: '#A8DDF7' }, dispel: ['저주', '마법'] },
  // 묶음 G (59 0장): 심연의 바닥의 심연의 정예 (심장이 빚은 마지막 그림자 군대). 푸른 보라 (몰락한 귀족가 자주 · 옛 심연 금빛과 다르게), 문양 = 뛰는 심장 + 뿌리 고리
  deep: { name: '심연의 정예', color: '#8A7CFF', mark: { rim: '#6A5CC9', glyph: '#B3A8FF' }, dispel: ALL_DISPEL },
};

export interface Place {
  key: PlaceKey;
  name: string;
  faction: FactionKey;
  /** 그림이 없을 때 바닥 색 (가운데 → 가장자리) */
  tone: [string, string];
  /** 이 장소 그림이 아직 없으면 빌려 쓸 같은 세력 장소 (묶음 A 새 장소, 그림 요청 44) */
  borrow?: PlaceKey;
}

export const PLACES: Record<PlaceKey, Place> = {
  plateau: { key: 'plateau', name: '녹슨 고원', faction: 'golem', tone: ['#3A3226', '#18130E'] },
  rustfort: { key: 'rustfort', name: '녹슨 요새', faction: 'golem', tone: ['#34302E', '#151210'] },
  crypt: { key: 'crypt', name: '역병 지하묘지', faction: 'plague', tone: ['#353124', '#14120C'] },
  swamp: { key: 'swamp', name: '독안개 늪', faction: 'swamp', tone: ['#26331F', '#0F140C'] },
  manor: { key: 'manor', name: '저주받은 장원', faction: 'noble', tone: ['#30263A', '#130F16'] },
  frost: { key: 'frost', name: '서리 마탑', faction: 'mage', tone: ['#24334A', '#0E131C'] },
  temple: { key: 'temple', name: '깨진 신전', faction: 'hill', tone: ['#3A3322', '#16130C'] },
  abyss: { key: 'abyss', name: '심연의 탑', faction: 'abyss', tone: ['#262A22', '#0C0D0B'] },
  cathedral: { key: 'cathedral', name: '가라앉은 대성당', faction: 'abyss', tone: ['#1F2A33', '#0B0F13'] },
  // 묶음 A 탐험 ②~⑧ · 던전 ⑦ (39 1장)
  cemetery: { key: 'cemetery', name: '잿빛 공동묘지', faction: 'plague', tone: ['#34322A', '#13120E'], borrow: 'crypt' },
  marsh: { key: 'marsh', name: '늪지 어귀', faction: 'swamp', tone: ['#28331F', '#0F140C'], borrow: 'swamp' },
  lily: { key: 'lily', name: '백합 정원', faction: 'noble', tone: ['#322A38', '#130F16'], borrow: 'manor' },
  snowpass: { key: 'snowpass', name: '눈보라 고개', faction: 'mage', tone: ['#2A3646', '#0E131C'], borrow: 'frost' },
  hillpath: { key: 'hillpath', name: '해바라기 언덕길', faction: 'hill', tone: ['#3A3524', '#16130C'], borrow: 'temple' },
  pilgrim: { key: 'pilgrim', name: '무너진 순례길', faction: 'hill', tone: ['#36311F', '#16130C'], borrow: 'temple' },
  abyssedge: { key: 'abyssedge', name: '심연 가장자리', faction: 'abyss', tone: ['#262A22', '#0C0D0B'], borrow: 'abyss' },
  watchtower: { key: 'watchtower', name: '무너진 망루', faction: 'hill', tone: ['#383222', '#16130C'], borrow: 'temple' },
  // 심연의 탑 2층 ~ 꼭대기 (39 1-3, 그림 요청 44 A 17~24): 그림이 올 때까지 1층 그림
  'abyss-garden': { key: 'abyss-garden', name: '늪의 정원', faction: 'abyss', tone: ['#22302A', '#0B100D'], borrow: 'abyss' },
  'abyss-gallery': { key: 'abyss-gallery', name: '백합 회랑', faction: 'abyss', tone: ['#2C2433', '#100D13'], borrow: 'abyss' },
  'abyss-observatory': { key: 'abyss-observatory', name: '서리 전망대', faction: 'abyss', tone: ['#222C3C', '#0B0F16'], borrow: 'abyss' },
  'abyss-spire': { key: 'abyss-spire', name: '꼭대기 첨탑', faction: 'abyss', tone: ['#2E2236', '#100B13'], borrow: 'abyss' },
  // 묶음 B 옛 세력 (46 1장, 그림 요청 47): 그림이 올 때까지 같은 세력 장소 그림
  bookfield: { key: 'bookfield', name: '책갈피 설원', faction: 'mage', tone: ['#2C3848', '#0E131C'], borrow: 'snowpass' },
  rosemaze: { key: 'rosemaze', name: '장미 울타리 미로', faction: 'noble', tone: ['#36283A', '#130F16'], borrow: 'lily' },
  sewer: { key: 'sewer', name: '역병 수로', faction: 'plague', tone: ['#2E3326', '#12140E'], borrow: 'crypt' },
  archive: { key: 'archive', name: '얼음 서고', faction: 'mage', tone: ['#26344A', '#0E131C'], borrow: 'frost' },
  ossuary: { key: 'ossuary', name: '백합 납골당', faction: 'noble', tone: ['#2E2838', '#120F16'], borrow: 'manor' },
  // 묶음 B 짠물 해적단 (46 1장, 그림 요청 47): 레이드 칸은 그 레이드 첫 칸 그림을, 난파선 모래톱은 조개껍데기 해변 그림을 빌림
  shellbeach: { key: 'shellbeach', name: '조개껍데기 해변', faction: 'pirate', tone: ['#24383A', '#0C1617'] },
  wreck: { key: 'wreck', name: '난파선 모래톱', faction: 'pirate', tone: ['#2E3634', '#111614'], borrow: 'shellbeach' },
  gull: { key: 'gull', name: '갈매기 항구', faction: 'pirate', tone: ['#22343A', '#0B1417'] },
  'gull-kitchen': { key: 'gull-kitchen', name: '생선 시장 주방', faction: 'pirate', tone: ['#36302A', '#15120F'], borrow: 'gull' },
  'gull-lighthouse': { key: 'gull-lighthouse', name: '등대 아래 부두', faction: 'pirate', tone: ['#26323E', '#0D1218'], borrow: 'gull' },
  queen: { key: 'queen', name: '짠물 여왕호', faction: 'pirate', tone: ['#30302C', '#121210'] },
  'queen-hold': { key: 'queen-hold', name: '갑판 밑 창고', faction: 'pirate', tone: ['#2A2632', '#100E13'], borrow: 'queen' },
  'queen-bow': { key: 'queen-bow', name: '뱃머리', faction: 'pirate', tone: ['#203440', '#0B1418'], borrow: 'queen' },
  isle: { key: 'isle', name: '보물섬 요새', faction: 'pirate', tone: ['#2E3226', '#12140E'] },
  'isle-lookout': { key: 'isle-lookout', name: '앵무새 망루', faction: 'pirate', tone: ['#28362C', '#0E1510'], borrow: 'isle' },
  'isle-summit': { key: 'isle-summit', name: '꼭대기 보물 더미', faction: 'pirate', tone: ['#3A3424', '#16130C'], borrow: 'isle' },
  // 묶음 C (48 1장, 그림 요청 49): 끝없는 다과회는 꼬마등 오솔길 그림을, 이끼 뿌리 사원은 독안개 늪 그림을 빌림
  lampway: { key: 'lampway', name: '꼬마등 오솔길', faction: 'fairy', tone: ['#2E2A3A', '#110F16'] },
  teaparty: { key: 'teaparty', name: '끝없는 다과회', faction: 'fairy', tone: ['#3A2C34', '#161014'], borrow: 'lampway' },
  mossroot: { key: 'mossroot', name: '이끼 뿌리 사원', faction: 'swamp', tone: ['#24332A', '#0D140F'], borrow: 'swamp' },
  emberfoot: { key: 'emberfoot', name: '불꽃 봉우리 기슭', faction: 'dragon', tone: ['#3A2A22', '#160F0B'] },
  // 묶음 C2: 무지개 버섯밭은 꼬마등 오솔길 그림을 빌림, 10인 레이드 칸은 레이드 첫 칸 그림을 빌림
  rainbow: { key: 'rainbow', name: '무지개 버섯밭', faction: 'fairy', tone: ['#2C3036', '#101214'], borrow: 'lampway' },
  fest: { key: 'fest', name: '요정 축제 마당', faction: 'fairy', tone: ['#3A2A36', '#150F14'] },
  'fest-stage': { key: 'fest-stage', name: '축제 무대', faction: 'fairy', tone: ['#36283A', '#130E16'], borrow: 'fest' },
  'fest-bonfire': { key: 'fest-bonfire', name: '축제 모닥불', faction: 'fairy', tone: ['#3A2C26', '#16100D'], borrow: 'fest' },
  sporecave: { key: 'sporecave', name: '포자 동굴 정원', faction: 'fairy', tone: ['#26303A', '#0E1216'] },
  'sporecave-pond': { key: 'sporecave-pond', name: '포자 연못', faction: 'fairy', tone: ['#22343A', '#0C1417'], borrow: 'sporecave' },
  'sporecave-root': { key: 'sporecave-root', name: '뿌리 방', faction: 'fairy', tone: ['#30302A', '#121210'], borrow: 'sporecave' },
  palace: { key: 'palace', name: '버섯 여왕의 궁전', faction: 'fairy', tone: ['#3A2A2E', '#160F11'] },
  'palace-hall': { key: 'palace-hall', name: '궁전 연회장', faction: 'fairy', tone: ['#382A3A', '#140F16'], borrow: 'palace' },
  'palace-throne': { key: 'palace-throne', name: '광대버섯 왕좌', faction: 'fairy', tone: ['#3E2626', '#170E0E'], borrow: 'palace' },
  // 묶음 D1 (51 1장, 그림 요청 52): 용암 대장간은 옛 골렘 대장간 (버려진 골렘, 녹슨 요새를 빌림), 용 일가는 불꽃 봉우리 기슭, 10인 레이드 칸은 첫 칸 그림을 빌림
  ashpass: { key: 'ashpass', name: '화산재 고갯길', faction: 'dragon', tone: ['#3A2C26', '#16100D'], borrow: 'emberfoot' },
  hotspring: { key: 'hotspring', name: '용암 온천장', faction: 'dragon', tone: ['#3E2A26', '#170F0D'], borrow: 'emberfoot' },
  forge: { key: 'forge', name: '용암 대장간', faction: 'golem', tone: ['#382A22', '#150F0B'], borrow: 'rustfort' },
  den: { key: 'den', name: '코볼트 보물 굴', faction: 'dragon', tone: ['#36302A', '#141210'], borrow: 'emberfoot' },
  'den-cart': { key: 'den-cart', name: '수레길', faction: 'dragon', tone: ['#382E26', '#15110D'], borrow: 'den' },
  'den-vault': { key: 'den-vault', name: '보물방', faction: 'dragon', tone: ['#3E3424', '#17130C'], borrow: 'den' },
  // 묶음 D2 (51 1장, 그림 요청 52): 둥지는 기슭 그림, 호숫가 · 대성당 칸은 대성당 1구역 그림을 빌림
  nest: { key: 'nest', name: '어미 용의 둥지', faction: 'dragon', tone: ['#3E2A24', '#170F0C'], borrow: 'emberfoot' },
  'nest-bridge': { key: 'nest-bridge', name: '용암 다리', faction: 'dragon', tone: ['#402822', '#180E0B'], borrow: 'nest' },
  'nest-hoard': { key: 'nest-hoard', name: '보물 더미', faction: 'dragon', tone: ['#40342A', '#18130F'], borrow: 'nest' },
  lakeshore: { key: 'lakeshore', name: '잠긴 호숫가', faction: 'abyss', tone: ['#1F2C33', '#0B1013'], borrow: 'cathedral' },
  'cathedral-hall': { key: 'cathedral-hall', name: '회랑', faction: 'abyss', tone: ['#1F2833', '#0B0E13'], borrow: 'cathedral' },
  'cathedral-organ': { key: 'cathedral-organ', name: '물오르간', faction: 'abyss', tone: ['#1F2E36', '#0B1114'], borrow: 'cathedral' },
  'cathedral-sanctum': { key: 'cathedral-sanctum', name: '성소', faction: 'abyss', tone: ['#26223A', '#0E0C16'], borrow: 'cathedral' },
  // 묶음 E1 (54 1장, 그림 요청 55): 모래 왕국 그림이 아직 없어 노을 시장 · 모래시계 궁전은 색 배경 (골목 · 성문은 입구 그림을 빌림),
  // 물밑 계단 · 수도원 칸은 대성당 1구역 그림을 빌림 (잠긴 호숫가 그림도 아직 없음)
  bazaar: { key: 'bazaar', name: '노을 시장', faction: 'sand', tone: ['#3E3226', '#18130D'] },
  'bazaar-alley': { key: 'bazaar-alley', name: '향신료 골목', faction: 'sand', tone: ['#3E2E26', '#18110D'], borrow: 'bazaar' },
  'bazaar-gate': { key: 'bazaar-gate', name: '시장 성문', faction: 'sand', tone: ['#3A3428', '#16130E'], borrow: 'bazaar' },
  deepstairs: { key: 'deepstairs', name: '물밑 계단', faction: 'abyss', tone: ['#1F2A36', '#0B0F14'], borrow: 'cathedral' },
  abbey: { key: 'abbey', name: '물밑 수도원', faction: 'abyss', tone: ['#1F2E36', '#0B1114'], borrow: 'cathedral' },
  'abbey-library': { key: 'abbey-library', name: '거울 서고', faction: 'abyss', tone: ['#222A38', '#0C0F15'], borrow: 'cathedral' },
  'abbey-altar': { key: 'abbey-altar', name: '잠의 제단', faction: 'abyss', tone: ['#26223A', '#0E0C16'], borrow: 'cathedral' },
  hourglass: { key: 'hourglass', name: '모래시계 궁전', faction: 'sand', tone: ['#3A3226', '#16130D'] },
  // 묶음 E2 (54 1장, 그림 요청 55): 노을 궁전 · 낙타 대상로는 색 배경 (보물고 · 옥좌는 분수 그림을 빌림), 빛뿌리 숲 칸은 대성당 1구역 그림을 빌림
  dusk: { key: 'dusk', name: '노을 궁전', faction: 'sand', tone: ['#40322A', '#19130F'] },
  'dusk-vault': { key: 'dusk-vault', name: '보물고', faction: 'sand', tone: ['#3C3324', '#17130C'], borrow: 'dusk' },
  'dusk-throne': { key: 'dusk-throne', name: '옥좌', faction: 'sand', tone: ['#422E2C', '#1A1110'], borrow: 'dusk' },
  caravan: { key: 'caravan', name: '낙타 대상로', faction: 'sand', tone: ['#3E3428', '#18140E'] },
  rootwood: { key: 'rootwood', name: '빛뿌리 숲', faction: 'abyss', tone: ['#1E2E30', '#0B1213'], borrow: 'cathedral' },
  'rootwood-greenhouse': { key: 'rootwood-greenhouse', name: '온실', faction: 'abyss', tone: ['#20302A', '#0C1310'], borrow: 'cathedral' },
  'rootwood-heart': { key: 'rootwood-heart', name: '심장뿌리', faction: 'abyss', tone: ['#2A2236', '#100D15'], borrow: 'cathedral' },
  // 묶음 E3 (54 1장, 그림 요청 55): 피라미드 · 바람개비 언덕 · 천문대는 색 배경 (시계방 · 침실은 복도 그림을 빌림), 별빛 저수지 칸은 대성당 1구역 그림을 빌림
  pyramid: { key: 'pyramid', name: '낮잠 피라미드', faction: 'sand', tone: ['#3E3324', '#18130D'] },
  'pyramid-clock': { key: 'pyramid-clock', name: '시계방', faction: 'sand', tone: ['#36322A', '#15130F'], borrow: 'pyramid' },
  'pyramid-bed': { key: 'pyramid-bed', name: '왕의 침실', faction: 'sand', tone: ['#42342A', '#1A140F'], borrow: 'pyramid' },
  reservoir: { key: 'reservoir', name: '별빛 저수지', faction: 'abyss', tone: ['#1C2638', '#0A0E15'], borrow: 'cathedral' },
  'reservoir-bridge': { key: 'reservoir-bridge', name: '별빛 다리', faction: 'abyss', tone: ['#202838', '#0C0F15'], borrow: 'cathedral' },
  'reservoir-mirror': { key: 'reservoir-mirror', name: '거울호수', faction: 'abyss', tone: ['#1E2236', '#0B0C15'], borrow: 'cathedral' },
  pinwheel: { key: 'pinwheel', name: '바람개비 언덕', faction: 'storm', tone: ['#2A3A3A', '#101616'] },
  observatory: { key: 'observatory', name: '해시계 천문대', faction: 'hill', tone: ['#3A3424', '#16130C'], borrow: 'temple' },
  // 묶음 F1 (56 1장, 그림 요청 57): 숨결 우물 칸은 대성당 1구역 그림을 빌림, 구름 우체국 · 목장 · 풍차는 색 배경 (분류실 · 옥상은 접수대 그림을 빌림)
  well: { key: 'well', name: '숨결 우물', faction: 'abyss', tone: ['#1A2430', '#090D12'], borrow: 'cathedral' },
  'well-moss': { key: 'well-moss', name: '이끼벽', faction: 'abyss', tone: ['#1C2A26', '#0A100E'], borrow: 'cathedral' },
  'well-floor': { key: 'well-floor', name: '우물 바닥', faction: 'abyss', tone: ['#221E34', '#0C0A14'], borrow: 'cathedral' },
  post: { key: 'post', name: '구름 우체국', faction: 'storm', tone: ['#2C3C4A', '#11181E'] },
  'post-sort': { key: 'post-sort', name: '소포 분류실', faction: 'storm', tone: ['#30384A', '#12161E'], borrow: 'post' },
  'post-roof': { key: 'post-roof', name: '우체국 옥상', faction: 'storm', tone: ['#2A4050', '#101A20'], borrow: 'post' },
  ranch: { key: 'ranch', name: '구름 양 목장', faction: 'storm', tone: ['#2E3E3C', '#121818'] },
  windmill: { key: 'windmill', name: '천둥 풍차', faction: 'storm', tone: ['#323A46', '#13161C'] },
  // 묶음 F2 (56 1장, 그림 요청 57): 수정 뿌리굴 칸은 대성당 1구역 그림을 빌림, 폭풍 성채는 색 배경 (무기고 · 꼭대기는 성문 그림을 빌림)
  crystal: { key: 'crystal', name: '수정 갈림길', faction: 'abyss', tone: ['#1E2236', '#0B0C16'], borrow: 'cathedral' },
  'crystal-field': { key: 'crystal-field', name: '수정밭', faction: 'abyss', tone: ['#1A2A34', '#0A1014'], borrow: 'cathedral' },
  'crystal-mirror': { key: 'crystal-mirror', name: '거울방', faction: 'abyss', tone: ['#26203A', '#0E0B16'], borrow: 'cathedral' },
  fort: { key: 'fort', name: '폭풍 성채', faction: 'storm', tone: ['#2A3444', '#10141C'] },
  'fort-armory': { key: 'fort-armory', name: '성채 무기고', faction: 'storm', tone: ['#30343E', '#121418'], borrow: 'fort' },
  'fort-top': { key: 'fort-top', name: '성채 꼭대기', faction: 'storm', tone: ['#283A4E', '#0F161E'], borrow: 'fort' },
  // 묶음 F3 (56 1장, 그림 요청 57): 빗자루 정류장 · 구름 마법학교는 옛 세력 폭주한 마도사 (서리 마탑 그림을 빌림), 그림자 성벽 칸은 대성당 1구역 그림을 빌림
  station: { key: 'station', name: '빗자루 정류장', faction: 'mage', tone: ['#28344A', '#10141E'], borrow: 'frost' },
  shadow: { key: 'shadow', name: '그림자 성문', faction: 'abyss', tone: ['#1C1A2C', '#0A0912'], borrow: 'cathedral' },
  'shadow-wall': { key: 'shadow-wall', name: '성벽길', faction: 'abyss', tone: ['#201C30', '#0C0A14'], borrow: 'cathedral' },
  'shadow-tower': { key: 'shadow-tower', name: '망루', faction: 'abyss', tone: ['#241A34', '#0E0A16'], borrow: 'cathedral' },
  school: { key: 'school', name: '구름 마법학교', faction: 'mage', tone: ['#2A3050', '#10121E'], borrow: 'frost' },
  // 묶음 G1 (59 1장, 그림 요청 60): 그림자 미궁 · 그림자 진영 칸은 대성당 1구역 그림을 빌림, 유령 마차길 · 가라앉은 무도회장은 옛 세력 몰락한 귀족가 (장원 그림을 빌림)
  maze: { key: 'maze', name: '미궁 입구', faction: 'deep', tone: ['#1E1C34', '#0B0A16'], borrow: 'cathedral' },
  'maze-hall': { key: 'maze-hall', name: '함정 회랑', faction: 'deep', tone: ['#221E3A', '#0C0B18'], borrow: 'cathedral' },
  'maze-core': { key: 'maze-core', name: '미궁 중심', faction: 'deep', tone: ['#26204A', '#0E0B1C'], borrow: 'cathedral' },
  camp: { key: 'camp', name: '그림자 막사', faction: 'deep', tone: ['#1C1E30', '#0A0B14'], borrow: 'cathedral' },
  'camp-yard': { key: 'camp-yard', name: '훈련장', faction: 'deep', tone: ['#20223A', '#0B0C16'], borrow: 'cathedral' },
  'camp-command': { key: 'camp-command', name: '지휘소', faction: 'deep', tone: ['#241E40', '#0D0A18'], borrow: 'cathedral' },
  carriage: { key: 'carriage', name: '유령 마차길', faction: 'noble', tone: ['#2A2438', '#110E16'], borrow: 'manor' },
  ballroom: { key: 'ballroom', name: '가라앉은 무도회장', faction: 'noble', tone: ['#2C2240', '#120E1A'], borrow: 'manor' },
};

/** 콘텐츠 → 장소 */
export const CONTENT_PLACE: Record<ContentKey, PlaceKey> = {
  tutorial: 'plateau', plateau: 'plateau', rustfort: 'rustfort', crypt: 'crypt', swamp: 'swamp',
  manor: 'manor', frost: 'frost', temple: 'temple', abyss1: 'abyss', cathedral1: 'cathedral',
  cemetery: 'cemetery', marsh: 'marsh', lily: 'lily', snowpass: 'snowpass', hillpath: 'hillpath', pilgrim: 'pilgrim', abyssedge: 'abyssedge', watchtower: 'watchtower',
  abyss2: 'abyss-garden', abyss3: 'abyss-gallery', abyss4: 'abyss-observatory', abyss5: 'abyss-spire',
  bookfield: 'bookfield', rosemaze: 'rosemaze', archive: 'archive', ossuary: 'ossuary', sewer: 'sewer',
  shellbeach: 'shellbeach', wreck: 'wreck', gull1: 'gull', gull2: 'gull-kitchen', gull3: 'gull-lighthouse',
  queen1: 'queen', queen2: 'queen-hold', queen3: 'queen-bow', isle1: 'isle', isle2: 'isle-lookout', isle3: 'isle-summit',
  lampway: 'lampway', teaparty: 'teaparty', mossroot: 'mossroot', emberfoot: 'emberfoot', rainbow: 'rainbow',
  fest1: 'fest', fest2: 'fest-stage', fest3: 'fest-bonfire', cave1: 'sporecave', cave2: 'sporecave-pond', cave3: 'sporecave-root',
  palace1: 'palace', palace2: 'palace-hall', palace3: 'palace-throne',
  ashpass: 'ashpass', hotspring: 'hotspring', forge: 'forge', den1: 'den', den2: 'den-cart', den3: 'den-vault',
  lakeshore: 'lakeshore', nest1: 'nest', nest2: 'nest-bridge', nest3: 'nest-hoard', cathedral2: 'cathedral-hall', cathedral3: 'cathedral-organ', cathedral4: 'cathedral-sanctum',
  bazaar1: 'bazaar', bazaar2: 'bazaar-alley', bazaar3: 'bazaar-gate', deepstairs: 'deepstairs', abbey1: 'abbey', abbey2: 'abbey-library', abbey3: 'abbey-altar', hourglass: 'hourglass',
  dusk1: 'dusk', dusk2: 'dusk-vault', dusk3: 'dusk-throne', caravan: 'caravan', rootwood1: 'rootwood', rootwood2: 'rootwood-greenhouse', rootwood3: 'rootwood-heart',
  pyramid1: 'pyramid', pyramid2: 'pyramid-clock', pyramid3: 'pyramid-bed', reservoir1: 'reservoir', reservoir2: 'reservoir-bridge', reservoir3: 'reservoir-mirror',
  pinwheel: 'pinwheel', observatory: 'observatory',
  well1: 'well', well2: 'well-moss', well3: 'well-floor', post1: 'post', post2: 'post-sort', post3: 'post-roof', ranch: 'ranch', windmill: 'windmill',
  crystal1: 'crystal', crystal2: 'crystal-field', crystal3: 'crystal-mirror', fort1: 'fort', fort2: 'fort-armory', fort3: 'fort-top',
  station: 'station', shadow1: 'shadow', shadow2: 'shadow-wall', shadow3: 'shadow-tower', school: 'school',
  maze1: 'maze', maze2: 'maze-hall', maze3: 'maze-core', camp1: 'camp', camp2: 'camp-yard', camp3: 'camp-command', carriage: 'carriage', ballroom: 'ballroom',
};

/** 전투 → 장소 (콘텐츠 흐름 없이 바로 여는 전투도 바닥을 고르게) */
export const ENCOUNTER_PLACE: Record<EncounterKey, PlaceKey> = {
  duo: 'plateau', field: 'plateau', patrol: 'plateau',
  gate: 'rustfort', scrap: 'rustfort', boiler: 'rustfort', warden: 'rustfort',
  plague: 'abyss', choir: 'cathedral',
  ashyard: 'cemetery', collector3: 'cemetery', reedbank: 'marsh', shaman8: 'marsh',
  bonepass: 'crypt', collector: 'crypt', censerhall: 'crypt', malchor: 'crypt', flowerbed: 'lily', butler13: 'lily',
  rotbridge: 'swamp', shaman: 'swamp', toad: 'swamp', toadnest: 'swamp', seres: 'swamp', snowslope: 'snowpass', golem18: 'snowpass',
  parlor: 'manor', butler: 'manor', lady: 'manor', kennel: 'manor', belmore: 'manor', restyard: 'hillpath', guardian23: 'hillpath',
  icehall: 'frost', frostgolem: 'frost', mage: 'frost', frostlab: 'frost', shadow: 'frost', brokenbridge: 'pilgrim', keeper28: 'pilgrim',
  templeyard: 'temple', guardian: 'temple', nave: 'temple', keeper: 'temple', riftground: 'abyssedge', plague33: 'abyssedge',
  rubblestair: 'watchtower', sentinel: 'watchtower', blackrift: 'watchtower', crystal: 'watchtower',
  hydra: 'abyss-garden', twins: 'abyss-gallery', orben: 'abyss-observatory', abysslord: 'abyss-spire',
  pagedrift: 'bookfield', librarian40: 'bookfield', rosetunnel: 'rosemaze', priestess48: 'rosemaze',
  leakyway: 'sewer', ratking: 'sewer', sludgegrate: 'sewer', carrier: 'sewer',
  iceread: 'archive', librarian: 'archive', forbidden: 'archive', scholar: 'archive',
  petalstair: 'ossuary', priestess: 'ossuary', keeperhall: 'ossuary', sleeper: 'ossuary',
  gullsand: 'shellbeach', crab36: 'shellbeach', wreckage: 'wreck', goldbeard44: 'wreck',
  crab: 'gull', cook: 'gull-kitchen', morel: 'gull-lighthouse', gunner: 'queen', octo: 'queen-hold', seawitch: 'queen-bow',
  mimic: 'isle', parrot: 'isle-lookout', goldbeard: 'isle-summit',
  capway: 'lampway', sippy52: 'lampway', hotgravel: 'emberfoot', kobold60: 'emberfoot',
  sugarstair: 'teaparty', sippy: 'teaparty', cuptower: 'teaparty', hatter: 'teaparty',
  wetstair: 'mossroot', uga: 'mossroot', turtlebridge: 'mossroot', shellgod: 'mossroot',
  pollenfield: 'rainbow', queen56: 'rainbow', songi: 'fest', pililli: 'fest-stage', ponga: 'fest-bonfire',
  mungge: 'sporecave', gaegul: 'sporecave-pond', morak: 'sporecave-root', bungbung: 'palace', ppyong: 'palace-hall', amanita: 'palace-throne',
  warmash: 'ashpass', mungsil64: 'ashpass', steamroom: 'hotspring', mungsil: 'hotspring', lavabath: 'hotspring', bulttung: 'hotspring',
  coldhearth: 'forge', huggeun: 'forge', anvilbridge: 'forge', ttangttang: 'forge', kkojil: 'den', deolkeong: 'den-cart', beonjjeok: 'den-vault',
  whelps: 'nest', dandani: 'nest-bridge', rubina: 'nest-hoard', shoretrash: 'lakeshore', knights68: 'lakeshore', knights: 'cathedral-hall', uwoong: 'cathedral-organ', ormal: 'cathedral-sanctum',
  kkubeok: 'bazaar', hokdol: 'bazaar-alley', nyanx: 'bazaar-gate', stairtrash: 'deepstairs', heumul72: 'deepstairs',
  heumul: 'abbey', bichumi: 'abbey-library', gipeun: 'abbey-altar',
  sandhall: 'hourglass', degul: 'hourglass', backgarden: 'hourglass', dooldool: 'hourglass',
  solsol: 'dusk', eonggeum: 'dusk-vault', sarasha: 'dusk-throne', dunetrash: 'caravan', pokshin76: 'caravan',
  ttubeok: 'rootwood', toktok: 'rootwood-greenhouse', kungkung: 'rootwood-heart',
  pokshin: 'pyramid', jjaekkak: 'pyramid-clock', hapum: 'pyramid-bed', ttakttak: 'reservoir', jjirit: 'reservoir-bridge', doeul: 'reservoir-mirror',
  windtrash: 'pinwheel', hwirik: 'pinwheel', startrash: 'observatory', stargazer: 'observatory', sundialyard: 'observatory', geuneul: 'observatory',
  chulleong: 'well', puseok: 'well-moss', huu: 'well-floor', hwirik83: 'post', kkongkkong: 'post-sort', buri: 'post-roof',
  sheeptrash: 'ranch', boksul84: 'ranch', millstairs: 'windmill', boksul: 'windmill', millhouse: 'windmill', dolgae: 'windmill',
  gulgul: 'crystal', pingping: 'crystal-field', bitgallae: 'crystal-mirror', dungdung: 'fort', ssaengssaeng: 'fort-armory', ureureung: 'fort-top',
  platform: 'station', pongpong88: 'station', kwangkwang: 'shadow', syungsyung: 'shadow-wall', eodugi: 'shadow-tower',
  upsidehall: 'school', pongpong: 'school', boltlab: 'school', dwijuk: 'school',
  geumeum: 'maze', silta: 'maze-hall', bamgeuneul: 'maze-core', jilpung: 'camp', ureobal: 'camp-yard', chilheuk: 'camp-command',
  carriagetrash: 'carriage', serena92: 'carriage', ballhall: 'ballroom', serena: 'ballroom', balcony: 'ballroom', valen: 'ballroom',
};

export const floorArtName = (p: PlaceKey) => `floor-${p}`;
export const sceneArtName = (p: PlaceKey) => `scene-${p}`;
/** 그림을 찾을 장소 순서: 자기 장소 → 빌려 쓸 장소 */
export const artPlaces = (p: PlaceKey): PlaceKey[] => [p, ...(PLACES[p].borrow ? [PLACES[p].borrow!] : [])];
