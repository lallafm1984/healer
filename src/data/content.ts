/**
 * 콘텐츠 선택 화면(09 S03)에 나오는 던전·레이드. 던전 목록·해금 레벨은 11 4장, 18 2-2.
 * P1에서 실제로 할 수 있는 건 녹슨 요새(5인)와 심연의 종탑 1층 역병 군주(10인, 악몽 20인)뿐. 나머지는 잠긴 카드로만 보여 준다.
 */
import type { DiffName } from './difficulty';
import { DUNGEONS } from './dungeons';
import type { EncounterKey } from './encounters';

export type ContentKind = 'explore' | 'dungeon' | 'raid' | 'event';
export type ContentKey = 'tutorial' | 'plateau' | 'rustfort' | 'abyss1' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple';

export const ALL_DIFFS: DiffName[] = ['쉬움', '보통', '어려움', '악몽'];

export interface ContentDef {
  key: ContentKey;
  kind: ContentKind;
  name: string;
  /** 지역 · 세력 (11 4장) */
  place: string;
  /** 레벨 단계 (보상 계산·권장 레벨) */
  stageLv: number;
  /** 이 레벨부터 열림 */
  unlockLv: number;
  /** 아직 만들지 않은 콘텐츠 (카드만) */
  ready: boolean;
  /** 드롭 세트 이름 (세트 효과는 P2) */
  set?: string;
  /** 보스 (마지막 = 최종 보스, 11 4장) */
  bosses: string[];
  /** 난이도별 이어서 하는 전투 목록 */
  fights: (d: DiffName) => EncounterKey[];
  /** 난이도별 인원 (나 포함) */
  size: (d: DiffName) => number;
  /** 이 난이도만 따로 잠금 (레이드 악몽 = Lv 70) */
  diffUnlock?: Partial<Record<DiffName, number>>;
  /** 콘텐츠 목록에 안 보임 (튜토리얼 첫 전투) */
  hidden?: boolean;
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
    key: 'rustfort', bosses: ['고철 경비병', '녹슨 문지기'], kind: 'dungeon', name: '녹슨 요새', place: '녹슨 고원 · 골렘', stageLv: 1, unlockLv: 1, ready: true, set: '새벽 순례자',
    fights: () => DUNGEONS.rustfort.segments, size: five,
  },
  { key: 'crypt', bosses: ['시체 수집가', '역병 사제 말코어'], kind: 'dungeon', name: '역병 지하묘지', place: '왕도 지하 · 역병 교단', stageLv: 5, unlockLv: 5, ready: false, set: '역병 정화자', fights: none, size: five },
  { key: 'swamp', bosses: ['늪 주술사', '거대 두꺼비 부글이', '늪 족장 세레스'], kind: 'dungeon', name: '독안개 늪', place: '늪지 · 늪의 부족', stageLv: 10, unlockLv: 10, ready: false, set: '이끼 맹약', fights: none, size: five },
  { key: 'manor', bosses: ['집사 유령', '초상화 속 귀부인', '장원 주인 벨모어 경'], kind: 'dungeon', name: '저주받은 장원', place: '백합 영지 · 귀족가', stageLv: 15, unlockLv: 15, ready: false, set: '수호의 맹세', fights: none, size: five },
  { key: 'frost', bosses: ['마력 골렘', '불안정한 마법사', '탑주의 그림자'], kind: 'dungeon', name: '서리 마탑', place: '설원 · 마도사', stageLv: 20, unlockLv: 20, ready: false, set: '별빛 서약', fights: none, size: five },
  { key: 'temple', bosses: ['침묵의 수호자', '종지기의 망령'], kind: 'dungeon', name: '깨진 신전', place: '종의 언덕 · 혼합', stageLv: 28, unlockLv: 28, ready: false, set: '종소리', fights: none, size: five },
  {
    key: 'abyss1', bosses: ['역병 군주'], kind: 'raid', name: '심연의 종탑 1층', place: '납골당 · 역병 군주', stageLv: 35, unlockLv: 35, ready: true,
    fights: d => (d === '악몽' ? ['plague20'] : ['plague']), size: d => (d === '악몽' ? 20 : 10), diffUnlock: { '악몽': 70 },
  },
];

export const contentOf = (k: ContentKey) => CONTENT.find(c => c.key === k)!;

/** 난이도별 단계 레벨: 따로 잠긴 난이도(레이드 악몽 = Lv 70)는 그 레벨이 단계 */
export const stageOf = (c: ContentDef, d: DiffName) => c.diffUnlock?.[d] ?? c.stageLv;

/** 레이드는 보스 1마리 처치마다 보상 (12 3-1) → 1층 = 보스 1 */
export const isRaid = (c: ContentDef) => c.kind === 'raid';
