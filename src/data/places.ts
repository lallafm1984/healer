/**
 * 장소 (11 4장 던전·레이드 지역)와 세력 (11 3장, 16 4-3). 그림 자리는 28 문서.
 * 장소마다 바닥 그림 floor-<장소>(전투 진형 판 뒤)와 풍경 그림 scene-<장소>(카드·입장·보스 무대). 풍경이 없으면 바닥 그림을 대신 쓴다.
 */
import type { ContentKey } from './content';
import type { EncounterKey } from './encounters';

export type FactionKey = 'golem' | 'plague' | 'swamp' | 'noble' | 'mage' | 'hill' | 'abyss' | 'pirate' | 'fairy' | 'dragon';
export type PlaceKey = 'plateau' | 'rustfort' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple' | 'abyss' | 'cathedral'
  | 'cemetery' | 'marsh' | 'lily' | 'snowpass' | 'hillpath' | 'pilgrim' | 'abyssedge' | 'watchtower'
  | 'abyss-garden' | 'abyss-gallery' | 'abyss-observatory' | 'abyss-spire'
  | 'bookfield' | 'rosemaze' | 'sewer' | 'archive' | 'ossuary'
  | 'shellbeach' | 'wreck' | 'gull' | 'gull-kitchen' | 'gull-lighthouse' | 'queen' | 'queen-hold' | 'queen-bow' | 'isle' | 'isle-lookout' | 'isle-summit'
  | 'lampway' | 'teaparty' | 'mossroot' | 'emberfoot';

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
  lampway: 'lampway', teaparty: 'teaparty', mossroot: 'mossroot', emberfoot: 'emberfoot',
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
};

export const floorArtName = (p: PlaceKey) => `floor-${p}`;
export const sceneArtName = (p: PlaceKey) => `scene-${p}`;
/** 그림을 찾을 장소 순서: 자기 장소 → 빌려 쓸 장소 */
export const artPlaces = (p: PlaceKey): PlaceKey[] => [p, ...(PLACES[p].borrow ? [PLACES[p].borrow!] : [])];
