/**
 * 콘텐츠 선택 화면(09 S03)에 나오는 던전·레이드. 던전 목록·해금 레벨은 11 4장, 18 2-2.
 * 지금 할 수 있는 건 녹슨 요새(5인), 10인 레이드 심연의 종탑 1층 역병 군주, 20인 레이드 가라앉은 대성당 1구역 무음 성가대 (26). 나머지는 잠긴 카드로만 보여 준다.
 * 깨진 신전 뒤 던전 4곳(sample)은 기획에 없는 자리 표시 예시: 던전 줄이 한 줄을 넘을 때 화면을 보려고 넣음. 실제 던전이 정해지면 바꾸거나 지운다.
 */
import type { DiffName } from './difficulty';
import { DUNGEONS } from './dungeons';
import { ENCOUNTERS, type EncounterKey } from './encounters';
import { CONTENT_PLACE, FACTIONS, PLACES } from './places';

export type ContentKind = 'explore' | 'dungeon' | 'raid';
export type ContentKey = 'tutorial' | 'plateau' | 'rustfort' | 'abyss1' | 'cathedral1' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple'
  | 'belfry' | 'archive' | 'ossuary' | 'sewer';

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
  /** 기획에 없는 자리 표시 예시 (늘 준비 중, 보상·밸런스와 무관) */
  sample?: boolean;
}

const none = () => [] as EncounterKey[];
const five = () => 5;

export const CONTENT: ContentDef[] = [
  // 첫 전투 2인 (02 11장 1번). 튜토리얼에서만
  { key: 'tutorial', kind: 'explore', name: '첫 전투', place: '녹슨 고원 입구', stageLv: 1, unlockLv: 1, ready: true, bosses: [], fights: () => ['duo'], size: () => 2, hidden: true },
  {
    key: 'plateau', kind: 'explore', name: '녹슨 고원', place: '녹슨 고원 · 골렘', stageLv: 1, unlockLv: 1, ready: true, bosses: ['고철 순찰병'],
    fights: () => DUNGEONS.plateau.segments, size: () => 3,
  },
  {
    key: 'rustfort', bosses: ['고철 경비병', '녹슨 문지기'], kind: 'dungeon', name: '녹슨 요새', place: '녹슨 고원 · 골렘', stageLv: 1, unlockLv: 1, ready: true,
    fights: () => DUNGEONS.rustfort.segments, size: five,
  },
  { key: 'crypt', bosses: ['시체 수집가', '역병 사제 말코어'], kind: 'dungeon', name: '역병 지하묘지', place: '왕도 지하 · 역병 교단', stageLv: 5, unlockLv: 5, ready: false, fights: none, size: five },
  { key: 'swamp', bosses: ['늪 주술사', '거대 두꺼비 부글이', '늪 족장 세레스'], kind: 'dungeon', name: '독안개 늪', place: '늪지 · 늪의 부족', stageLv: 10, unlockLv: 10, ready: false, fights: none, size: five },
  { key: 'manor', bosses: ['집사 유령', '초상화 속 귀부인', '장원 주인 벨모어 경'], kind: 'dungeon', name: '저주받은 장원', place: '백합 영지 · 귀족가', stageLv: 15, unlockLv: 15, ready: false, fights: none, size: five },
  { key: 'frost', bosses: ['마력 골렘', '불안정한 마법사', '탑주의 그림자'], kind: 'dungeon', name: '서리 마탑', place: '설원 · 마도사', stageLv: 20, unlockLv: 20, ready: false, fights: none, size: five },
  { key: 'temple', bosses: ['침묵의 수호자', '종지기의 망령'], kind: 'dungeon', name: '깨진 신전', place: '종의 언덕 · 혼합', stageLv: 28, unlockLv: 28, ready: false, fights: none, size: five },
  // 자리 표시 예시 (sample): 이름·보스·레벨은 임시, 그림은 같은 세력 장소 것을 빌려 씀
  { key: 'belfry', bosses: ['종루 파수꾼', '금 간 종의 메아리'], kind: 'dungeon', name: '무너진 종루', place: '종의 언덕 · 혼합', stageLv: 32, unlockLv: 32, ready: false, fights: none, size: five, sample: true },
  { key: 'archive', bosses: ['서고 사서', '얼어붙은 대학자'], kind: 'dungeon', name: '얼음 서고', place: '설원 · 마도사', stageLv: 38, unlockLv: 38, ready: false, fights: none, size: five, sample: true },
  { key: 'ossuary', bosses: ['납골당 관리인', '백합 여사제', '잠든 가주'], kind: 'dungeon', name: '백합 납골당', place: '백합 영지 · 귀족가', stageLv: 44, unlockLv: 44, ready: false, fights: none, size: five, sample: true },
  { key: 'sewer', bosses: ['수로 쥐왕', '역병 운반자'], kind: 'dungeon', name: '역병 수로', place: '왕도 지하 · 역병 교단', stageLv: 50, unlockLv: 50, ready: false, fights: none, size: five, sample: true },
  {
    // 10인 레이드 (26 3장): 난이도 4개 모두 10인
    key: 'abyss1', bosses: ['역병 군주'], kind: 'raid', name: '심연의 종탑 1층', place: '납골당 · 역병 군주', stageLv: 35, unlockLv: 35, ready: true,
    fights: () => ['plague'], size: () => 10, diffUnlock: { '악몽': 50 },
  },
  {
    // 20인 레이드 (26 4장): 따로 된 레이드, 난이도 4개 모두 20인
    key: 'cathedral1', bosses: ['무음 성가대'], kind: 'raid', name: '가라앉은 대성당 1구역', place: '종의 언덕 아래 · 검은 종', stageLv: 70, unlockLv: 70, ready: true,
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
