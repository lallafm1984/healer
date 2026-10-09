/**
 * 콘텐츠 선택 화면(09 S03)에 나오는 탐험·던전·레이드. 열림 레벨은 34 5-2 (출시 70곳, 탐험 ①~⑧ · 던전 5레벨마다 · 10인 Lv 35부터),
 * 장소 · 보스는 묶음 A 장소표 (39). 만든 곳 (ready)만 들어가고, 나머지는 잠긴 카드로 보여 준다.
 */
import type { DiffName } from './difficulty';
import { DUNGEONS } from './dungeons';
import { ENCOUNTERS, type EncounterKey } from './encounters';
import { CONTENT_PLACE, FACTIONS, PLACES } from './places';

export type ContentKind = 'explore' | 'dungeon' | 'raid';
export type ContentKey = 'tutorial' | 'plateau' | 'rustfort' | 'abyss1' | 'cathedral1' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple'
  | 'watchtower' | 'archive' | 'ossuary' | 'sewer'
  | 'cemetery' | 'marsh' | 'lily' | 'snowpass' | 'hillpath' | 'pilgrim' | 'abyssedge';

export const ALL_DIFFS: DiffName[] = ['쉬움', '보통', '어려움', '악몽'];

export interface ContentDef {
  key: ContentKey;
  kind: ContentKind;
  name: string;
  /** 지역 · 세력 (11 4장) */
  place: string;
  /** 최소 적 레벨 (= 열림 레벨). 들어가면 적은 내 레벨로 맞춰짐 (32), 이건 개발 빌드로 레벨 전에 들어갈 때·튜토리얼 판만 씀 */
  stageLv: number;
  /** 이 레벨부터 열림 */
  unlockLv: number;
  /** 아직 만들지 않은 콘텐츠 (카드만) */
  ready: boolean;
  /** 보스 (마지막 = 최종 보스, 11 4장) */
  bosses: string[];
  /** 난이도별 이어서 하는 전투 목록 */
  fights: (d: DiffName) => EncounterKey[];
  /** 난이도별 인원 (나 포함) */
  size: (d: DiffName) => number;
  /** 이 난이도만 따로 잠금 (10인 악몽 Lv 50, 20인 악몽 Lv 80) */
  diffUnlock?: Partial<Record<DiffName, number>>;
  /** 콘텐츠 목록에 안 보임 (튜토리얼 첫 전투) */
  hidden?: boolean;
}

const none = () => [] as EncounterKey[];
const three = () => 3;
const five = () => 5;

export const CONTENT: ContentDef[] = [
  // 첫 전투 2인 (02 11장 1번). 튜토리얼에서만
  { key: 'tutorial', kind: 'explore', name: '첫 전투', place: '녹슨 고원 입구', stageLv: 1, unlockLv: 1, ready: true, bosses: [], fights: () => ['duo'], size: () => 2, hidden: true },
  // 탐험 ①~⑧ (3인, 39 1-1): 같은 세력 던전 보스를 줄여 빌려 다음 던전의 새 기믹을 먼저 보여 줌 (35 4-8)
  {
    key: 'plateau', kind: 'explore', name: '녹슨 고원', place: '녹슨 고원 · 골렘', stageLv: 1, unlockLv: 1, ready: true, bosses: ['고철 순찰병'],
    fights: () => DUNGEONS.plateau.segments, size: three,
  },
  {
    key: 'cemetery', kind: 'explore', name: '잿빛 공동묘지', place: '왕도 변두리 · 역병 교단', stageLv: 3, unlockLv: 3, ready: true, bosses: ['뼈다귀 수집가'],
    fights: () => DUNGEONS.cemetery.segments, size: three,
  },
  {
    key: 'marsh', kind: 'explore', name: '늪지 어귀', place: '늪지 · 늪의 부족', stageLv: 8, unlockLv: 8, ready: true, bosses: ['늪 주술사'],
    fights: () => DUNGEONS.marsh.segments, size: three,
  },
  { key: 'lily', kind: 'explore', name: '백합 정원', place: '백합 영지 · 귀족가', stageLv: 13, unlockLv: 13, ready: false, bosses: ['집사 유령'], fights: none, size: three },
  { key: 'snowpass', kind: 'explore', name: '눈보라 고개', place: '설원 · 마도사', stageLv: 18, unlockLv: 18, ready: false, bosses: ['마력 골렘'], fights: none, size: three },
  { key: 'hillpath', kind: 'explore', name: '해바라기 언덕길', place: '해바라기 언덕 · 혼합', stageLv: 23, unlockLv: 23, ready: false, bosses: ['신전 수호상'], fights: none, size: three },
  { key: 'pilgrim', kind: 'explore', name: '무너진 순례길', place: '해바라기 언덕 · 혼합', stageLv: 28, unlockLv: 28, ready: false, bosses: ['신전지기 유령'], fights: none, size: three },
  { key: 'abyssedge', kind: 'explore', name: '심연 가장자리', place: '심연의 탑 아래 · 심연', stageLv: 33, unlockLv: 33, ready: false, bosses: ['역병 군주'], fights: none, size: three },
  // 던전 ①~⑩ (5인, 5레벨마다). ⑧~⑩은 묶음 B
  {
    key: 'rustfort', bosses: ['고철 경비병', '녹슨 문지기'], kind: 'dungeon', name: '녹슨 요새', place: '녹슨 고원 · 골렘', stageLv: 5, unlockLv: 5, ready: true,
    fights: () => DUNGEONS.rustfort.segments, size: five,
  },
  {
    key: 'crypt', bosses: ['뼈다귀 수집가', '역병 사제 말코어'], kind: 'dungeon', name: '역병 지하묘지', place: '왕도 지하 · 역병 교단', stageLv: 10, unlockLv: 10, ready: true,
    fights: () => DUNGEONS.crypt.segments, size: five,
  },
  { key: 'swamp', bosses: ['늪 주술사', '거대 두꺼비 부글이', '늪 족장 세레스'], kind: 'dungeon', name: '독안개 늪', place: '늪지 · 늪의 부족', stageLv: 15, unlockLv: 15, ready: false, fights: none, size: five },
  { key: 'manor', bosses: ['집사 유령', '초상화 속 귀부인', '장원 주인 벨모어 경'], kind: 'dungeon', name: '저주받은 장원', place: '백합 영지 · 귀족가', stageLv: 20, unlockLv: 20, ready: false, fights: none, size: five },
  { key: 'frost', bosses: ['마력 골렘', '불안정한 마법사', '탑주의 그림자'], kind: 'dungeon', name: '서리 마탑', place: '설원 · 마도사', stageLv: 25, unlockLv: 25, ready: false, fights: none, size: five },
  { key: 'temple', bosses: ['신전 수호상', '신전지기 유령'], kind: 'dungeon', name: '깨진 신전', place: '해바라기 언덕 · 혼합', stageLv: 30, unlockLv: 30, ready: false, fights: none, size: five },
  { key: 'watchtower', bosses: ['망루 파수꾼', '금 간 공명 수정'], kind: 'dungeon', name: '무너진 망루', place: '해바라기 언덕 · 혼합', stageLv: 35, unlockLv: 35, ready: false, fights: none, size: five },
  { key: 'sewer', bosses: ['수로 쥐왕', '역병 운반자'], kind: 'dungeon', name: '역병 수로', place: '왕도 지하 · 역병 교단', stageLv: 40, unlockLv: 40, ready: false, fights: none, size: five },
  { key: 'archive', bosses: ['서고 사서', '얼어붙은 대학자'], kind: 'dungeon', name: '얼음 서고', place: '설원 · 마도사', stageLv: 45, unlockLv: 45, ready: false, fights: none, size: five },
  { key: 'ossuary', bosses: ['백합 여사제', '잠든 가주'], kind: 'dungeon', name: '백합 납골당', place: '백합 영지 · 귀족가', stageLv: 50, unlockLv: 50, ready: false, fights: none, size: five },
  {
    // 10인 레이드 (26 3장): 난이도 4개 모두 10인
    key: 'abyss1', bosses: ['역병 군주'], kind: 'raid', name: '심연의 탑 1층', place: '납골당 · 역병 군주', stageLv: 35, unlockLv: 35, ready: true,
    fights: () => ['plague'], size: () => 10, diffUnlock: { '악몽': 50 },
  },
  {
    // 20인 레이드 (26 4장): 따로 된 레이드, 난이도 4개 모두 20인
    key: 'cathedral1', bosses: ['유령 성가대'], kind: 'raid', name: '가라앉은 대성당 1구역', place: '해바라기 언덕 아래 · 호수 밑', stageLv: 70, unlockLv: 70, ready: true,
    fights: () => ['choir'], size: () => 20, diffUnlock: { '악몽': 80 },
  },
];

export const contentOf = (k: ContentKey) => CONTENT.find(c => c.key === k)!;

/** 콘텐츠 최소 레벨 = 열림 레벨 (난이도만 따로 잠긴 건 그 레벨). 실제 적 레벨은 내 레벨과 이것 중 큰 쪽 (runmode, 32) */
export const stageOf = (c: ContentDef, d: DiffName) => c.diffUnlock?.[d] ?? c.stageLv;

/** 레이드는 보스 1마리 처치마다 보상 (12 3-1) → 1층 = 보스 1 */
export const isRaid = (c: ContentDef) => c.kind === 'raid';

/** 레이드 인원 (보상 배율용): 던전·탐험 0, 10인 10, 20인 20 */
export const raidSize = (c: ContentDef): 0 | 10 | 20 => (c.kind !== 'raid' ? 0 : c.size('보통') >= 20 ? 20 : 10);

/**
 * 이 콘텐츠에 나오는 해제 유형 (27 3-1 모험 카드 해제 칩). 만든 전투는 그 전투들이 거는 디버프 (난이도 모두),
 * 아직 전투가 없는 던전은 세력의 대표 디버프 (11 3장: 세력 = 해제 유형). 빈 배열 = 물리만
 */
export function dispelsOf(c: ContentDef): string[] {
  const segs = ALL_DIFFS.flatMap(d => c.fights(d));
  if (segs.length) return [...new Set(segs.flatMap(k => ENCOUNTERS[k].debuffs || []))];
  return FACTIONS[PLACES[CONTENT_PLACE[c.key]].faction].dispel.slice();
}
