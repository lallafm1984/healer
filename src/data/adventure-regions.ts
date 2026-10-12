/**
 * 출전 화면의 지역 → 장소 탐색. 11 세계 지도와 46·51·56·59·62 장소표의 지리를 따른다.
 * 분류·지역은 목록만 나눈다. 원본 콘텐츠의 key, 레벨, 난이도·튜토리얼 진입 조건은 그대로 쓴다.
 */
import { CONTENT, contentOf, raidSize, type ContentDef, type ContentKey } from './content';
import { CONTENT_PLACE, FACTIONS, PLACES, type FactionKey } from './places';

export type AdventureTab = 'explore' | 'dungeon' | 'raid10' | 'raid20';
export type AdventureRegionKey = 'rust' | 'capital' | 'swamp' | 'lily' | 'frost' | 'sunflower' | 'tower'
  | 'coral' | 'mushroom' | 'flame' | 'lake' | 'desert' | 'cloud' | 'depths'
  | 'cathedral' | 'abbey' | 'rootwood' | 'reservoir' | 'well' | 'crystal' | 'shadow' | 'camp' | 'coast' | 'heart';

export interface AdventureRegion {
  readonly key: AdventureRegionKey;
  readonly name: string;
  readonly shortName: string;
  /** 지역 카드에 쓸 풍경. placeArt(representative)로 기존 장소 그림을 찾는다. */
  readonly representative: ContentKey;
  /** 문양·강조색의 대표 세력. 실제 장소의 세력·해제 유형은 원본 장소를 따른다. */
  readonly faction: FactionKey;
  readonly color: string;
}

const region = (key: AdventureRegionKey, name: string, shortName: string, representative: ContentKey, faction: FactionKey): AdventureRegion =>
  ({ key, name, shortName, representative, faction, color: FACTIONS[faction].color });

/** 첫 방문 흐름 순. 각 탭에서는 실제 장소가 있는 지역만 표시한다. */
export const ADVENTURE_REGIONS: readonly AdventureRegion[] = [
  region('rust', '녹슨 고원', '녹슨 고원', 'plateau', 'golem'),
  region('capital', '왕도', '왕도', 'cemetery', 'plague'),
  region('swamp', '독안개 늪지', '독안개 늪', 'marsh', 'swamp'),
  region('lily', '백합 영지', '백합 영지', 'lily', 'noble'),
  region('frost', '서리 설원', '서리 설원', 'snowpass', 'mage'),
  region('sunflower', '해바라기 언덕', '해바라기', 'hillpath', 'hill'),
  region('tower', '심연의 탑', '심연의 탑', 'abyss1', 'abyss'),
  region('coral', '산호 해안', '산호 해안', 'shellbeach', 'pirate'),
  region('mushroom', '반딧불 버섯숲', '반딧불숲', 'lampway', 'fairy'),
  region('flame', '불꽃 봉우리', '불꽃 봉우리', 'emberfoot', 'dragon'),
  region('lake', '가라앉은 호수', '가라앉은 호수', 'lakeshore', 'abyss'),
  // 20인 레이드는 한 시설의 3~4구역을 한 지역으로 고른다. 탐험·던전의 호수 분류는 유지한다.
  region('cathedral', '가라앉은 대성당', '가라앉은 대성당', 'cathedral1', 'abyss'),
  region('abbey', '물밑 수도원', '물밑 수도원', 'abbey1', 'abyss'),
  region('rootwood', '빛뿌리 숲', '빛뿌리 숲', 'rootwood1', 'abyss'),
  region('reservoir', '별빛 저수지', '별빛 저수지', 'reservoir1', 'abyss'),
  region('well', '숨결 우물', '숨결 우물', 'well1', 'abyss'),
  region('crystal', '수정 뿌리굴', '수정 뿌리굴', 'crystal1', 'abyss'),
  region('shadow', '그림자 성벽', '그림자 성벽', 'shadow1', 'abyss'),
  region('desert', '노을 사막', '노을 사막', 'caravan', 'sand'),
  region('cloud', '구름 위 섬', '구름 위 섬', 'pinwheel', 'storm'),
  region('depths', '심연의 바닥', '심연의 바닥', 'lantern', 'deep'),
  region('camp', '그림자 진영', '그림자 진영', 'camp1', 'deep'),
  region('coast', '어둠물 해안', '어둠물 해안', 'coast1', 'deep'),
  region('heart', '심연의 심장', '심연의 심장', 'heart1', 'deep'),
];

/** 대다수 세력은 한 지역에 거주한다. 이동한 세력·탑 내부는 아래 지리 예외를 우선한다. */
const FACTION_REGION: Record<FactionKey, AdventureRegionKey> = {
  golem: 'rust', plague: 'capital', swamp: 'swamp', noble: 'lily', mage: 'frost', hill: 'sunflower',
  abyss: 'lake', pirate: 'coral', fairy: 'mushroom', dragon: 'flame', sand: 'desert', storm: 'cloud', deep: 'depths',
};

const GEOGRAPHIC_REGION: Partial<Record<ContentKey, AdventureRegionKey>> = {
  // 11 5장: 탑은 각 세력 수장이 모인 한 지역. 호수 밑 대성당 줄과 분리한다.
  abyssedge: 'tower', abyss1: 'tower', abyss2: 'tower', abyss3: 'tower', abyss4: 'tower', abyss5: 'tower',
  // 51: 용암 대장간은 골렘 세력이지만 불꽃 봉우리 안에 있다.
  forge: 'flame',
  // 56·62: 옛 마도사 세력도 구름 섬의 학교·정류장·도서관을 쓴다.
  station: 'cloud', school: 'cloud', cloudlibrary: 'cloud', broomrace: 'cloud',
  // 59·62: 귀족가의 옛 영지가 가라앉은 곳은 심연의 바닥이다.
  carriage: 'depths', ballroom: 'depths', sunkrose: 'depths', lotusway: 'depths',
  // 51·54·56·59: 20인 레이드는 원본 시설 이름으로 세분하고 구역 순서·진입 조건은 그대로 둔다.
  cathedral1: 'cathedral', cathedral2: 'cathedral', cathedral3: 'cathedral', cathedral4: 'cathedral',
  abbey1: 'abbey', abbey2: 'abbey', abbey3: 'abbey',
  rootwood1: 'rootwood', rootwood2: 'rootwood', rootwood3: 'rootwood',
  reservoir1: 'reservoir', reservoir2: 'reservoir', reservoir3: 'reservoir',
  well1: 'well', well2: 'well', well3: 'well',
  crystal1: 'crystal', crystal2: 'crystal', crystal3: 'crystal',
  shadow1: 'shadow', shadow2: 'shadow', shadow3: 'shadow',
  camp1: 'camp', camp2: 'camp', camp3: 'camp',
  coast1: 'coast', coast2: 'coast', coast3: 'coast',
  heart1: 'heart', heart2: 'heart', heart3: 'heart',
};

export const adventureTabOf = (c: ContentDef): AdventureTab =>
  c.kind === 'raid' ? (raidSize(c) === 20 ? 'raid20' : 'raid10') : c.kind;

export function adventureRegionOf(content: ContentDef | ContentKey): AdventureRegion {
  const c = typeof content === 'string' ? contentOf(content) : content;
  const key = GEOGRAPHIC_REGION[c.key] ?? FACTION_REGION[PLACES[CONTENT_PLACE[c.key]].faction];
  return ADVENTURE_REGIONS.find(r => r.key === key)!;
}

/** 현재 분류·지역의 모든 장소. 잠긴 장소도 고를 수 있게 유지하고 원본 객체를 반환한다. */
export function adventureContents(tab: AdventureTab, regionKey?: AdventureRegionKey): ContentDef[] {
  return CONTENT.filter(c => !c.hidden && adventureTabOf(c) === tab && (!regionKey || adventureRegionOf(c).key === regionKey))
    .sort((a, b) => a.unlockLv - b.unlockLv);
}

/** 지역이 비어 있는 탭은 숨김. 실제 장소의 레벨 잠금은 기존 lockOf에서 판단한다. */
export function adventureRegions(tab: AdventureTab): AdventureRegion[] {
  const keys = new Set(adventureContents(tab).map(c => adventureRegionOf(c).key));
  return ADVENTURE_REGIONS.filter(r => keys.has(r.key));
}
