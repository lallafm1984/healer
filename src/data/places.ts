/**
 * 장소 (11 4장 던전·레이드 지역)와 세력 (11 3장, 16 4-3). 그림 자리는 28 문서.
 * 장소마다 바닥 그림 floor-<장소>(전투 진형 판 뒤)와 풍경 그림 scene-<장소>(카드·입장·보스 무대). 풍경이 없으면 바닥 그림을 대신 쓴다.
 */
import type { ContentKey } from './content';
import type { EncounterKey } from './encounters';

export type FactionKey = 'golem' | 'plague' | 'swamp' | 'noble' | 'mage' | 'hill' | 'abyss';
export type PlaceKey = 'plateau' | 'rustfort' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple' | 'abyss' | 'cathedral';

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
};

export interface Place {
  key: PlaceKey;
  name: string;
  faction: FactionKey;
  /** 그림이 없을 때 바닥 색 (가운데 → 가장자리) */
  tone: [string, string];
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
};

/** 콘텐츠 → 장소 */
export const CONTENT_PLACE: Record<ContentKey, PlaceKey> = {
  tutorial: 'plateau', plateau: 'plateau', rustfort: 'rustfort', crypt: 'crypt', swamp: 'swamp',
  manor: 'manor', frost: 'frost', temple: 'temple', abyss1: 'abyss', cathedral1: 'cathedral',
  // 자리 표시 예시 던전 (content.ts sample): 같은 세력 장소 그림을 빌려 씀
  watchtower: 'temple', archive: 'frost', ossuary: 'manor', sewer: 'crypt',
};

/** 전투 → 장소 (콘텐츠 흐름 없이 바로 여는 전투도 바닥을 고르게) */
export const ENCOUNTER_PLACE: Record<EncounterKey, PlaceKey> = {
  duo: 'plateau', field: 'plateau', patrol: 'plateau',
  gate: 'rustfort', scrap: 'rustfort', boiler: 'rustfort', warden: 'rustfort',
  plague: 'abyss', choir: 'cathedral',
};

export const floorArtName = (p: PlaceKey) => `floor-${p}`;
export const sceneArtName = (p: PlaceKey) => `scene-${p}`;
