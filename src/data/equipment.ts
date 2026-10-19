/**
 * 힐러 장비 아이템 (02 10장, 34 6장 v0.3). 6부위, 부위마다 종류 5개 (종류마다 고정 옵션 1~2개, 34 6-10), 등급 5단계, 클리어 때 랜덤 1개.
 * 장소에서 나온 장비는 그 장소 세력의 생김새 (이름 · 그림, 성능 같음), 고유 무기 · 방어구 (data/uniques) · 이름 있는 장신구는 전설만.
 * 한 장비 = 옵션 (능력치 줄) 일반 1 · 고급 2 · 희귀 3 · 영웅 4 · 전설 4줄 (Lim 2026-10-11): 주 옵션 (무기 · 머리 · 손 지능, 몸통 체력) → 종류 옵션 → 무작위 옵션.
 * 디아2식 (91, 2026-10-16 Lim 「디아2식으로 하고, 보석 · 홈 · 천장 · 공훈 지정 모두 빼자」): 강화 없음. 주 · 종류 · 무작위 옵션 모두 50~160% 굴림 (rollOpt),
 * 예전 강화 몫은 아이템 레벨 배율 (ilvBonus)로. 특수능력은 옵션과 따로: 영웅 1줄, 전설은 고유 능력 (1.3~1.7배 굴림, 또는 이름 있는 장신구 효과) + 1줄 (88).
 * 판매 (골드, 예전 분해 자리) · 재설정 (골드). 옵션 굴림 평균이 높은 희귀 이상은 「정교한」 · 「완벽한」 (qualityOf, 성능은 굴림 그대로).
 * 아이템 레벨 (2026-10-13 Lim 「장소 레벨 기준으로 장비의 성능을 달리 하자」 · 「아이템 수치를 퍼센트가 아닌 수치로 하여 레벨별 아이템으로」):
 * 떨어진 곳의 적 레벨. 지능 · 체력 옵션은 수치 (아이템 레벨이 높을수록 크고 장비마다 고정, STAT_POINT · toPoints),
 * 치명타 · 가속 · 정신력 · 인내는 고정 % (레벨업해도 안 바뀜, Lim 「10%가 9%로 떨어지면 헷갈림」). 특수능력은 그대로.
 */
import { contentOf, RAID10_LV, type ContentDef } from './content';
import type { DiffName } from './difficulty';
import type { GearStats, GradeName } from './gear';
import type { HeroKey } from './heroes';
import { CONTENT_PLACE, PLACES, type FactionKey } from './places';
import { apexOf, lvPower, MAX_LEVEL, RAMP_LV, rampPlace } from './progression';
import { INT_BASE, RULES } from './rules';
import { FEATURED, namedOf, namedsFor, SPEC_KEYS, SPECS, specTotals, specUseful, specValue, type SpecLine, type SpecOn } from './specials';
import { UNIQUE_MULT, uniqueOf, uniquesFor, uniqueValue } from './uniques';

export type SlotKey = 'weapon' | 'head' | 'chest' | 'hands' | 'ring' | 'neck';

/** 부위 묶음 (34 6-1): 무기 · 방어구 (머리·몸통·손) · 장신구 (목걸이·반지) */
export type SlotGroup = 'weapon' | 'armor' | 'acc';
export const SLOTS: { key: SlotKey; name: string; group: SlotGroup }[] = [
  { key: 'weapon', name: '무기', group: 'weapon' },
  { key: 'head', name: '머리', group: 'armor' },
  { key: 'chest', name: '몸통', group: 'armor' },
  { key: 'hands', name: '손', group: 'armor' },
  { key: 'ring', name: '반지', group: 'acc' },
  { key: 'neck', name: '목걸이', group: 'acc' },
];

export type ItemGrade = Exclude<GradeName, '없음'>;
export const ITEM_GRADES: ItemGrade[] = ['일반', '고급', '희귀', '영웅', '전설'];

/** 등급 색 (02 10-1, 88: 전설 노랑) + 글자 표시 (색만으로 구분하지 않기, 09 5장) */
export const GRADE_STYLE: Record<ItemGrade, { color: string; word: string }> = {
  '일반': { color: '#C8C8C8', word: '낡은' },
  '고급': { color: '#3FD85A', word: '튼튼한' },
  '희귀': { color: '#4A9BFF', word: '축복받은' },
  '영웅': { color: '#BE6EFF', word: '성스러운' },
  '전설': { color: '#FFD23F', word: '전설의' },
};

// ---------- 능력치 · 종류 · 옵션 (34 6-2 ~ 6-5) ----------
/** 장비 능력치 6가지: 지능 (치유 회복량) · 체력 (내 최대 체력) · 치명타 · 가속 · 정신력 (마나 재생) · 인내 (내가 받는 피해 감소) */
export type StatKey = 'int' | 'hp' | 'crit' | 'haste' | 'spirit' | 'endure';
export const STAT_KEYS: StatKey[] = ['int', 'hp', 'crit', 'haste', 'spirit', 'endure'];
/** 추가 옵션 한 줄의 영웅 최대값 (34 6-4) · 합 상한 */
export const STATS: Record<StatKey, { name: string; max: number; cap?: number }> = {
  int: { name: '지능', max: 0.05 },
  hp: { name: '체력', max: 0.045 }, // 103 ③: 0.07 → 0.045 (힐러 체력이 탱커를 넘지 않게)
  crit: { name: '치명타', max: 0.04, cap: 0.5 },
  haste: { name: '가속', max: 0.05, cap: 0.5 },
  spirit: { name: '정신력', max: 0.08 },
  endure: { name: '인내', max: 0.03, cap: 0.3 },
};
/** 특수능력 등급 배율 (34 6-3, data/specials specValue) */
export const GRADE_MULT: Record<ItemGrade, number> = { '일반': 0.4, '고급': 0.6, '희귀': 0.8, '영웅': 1, '전설': 1.2 };
/** 등급별 옵션 줄 수 (Lim 2026-10-11 「일반 1 · 고급 2 · 희귀 3 · 영웅 4 · 전설 4 + 고유 능력」, 88: 전설 5): 종류 옵션 + 무작위 옵션 */
export const OPTION_LINES: Record<ItemGrade, number> = { '일반': 1, '고급': 2, '희귀': 3, '영웅': 4, '전설': 5 };
/**
 * 옵션 한 줄 등급 배율: 등급마다 줄이 늘어서 한 줄 값은 조금씩만 오름 (시뮬 프리셋 adv0 · rare5).
 * 88 (특수능력은 영웅부터): 고급 0.8 → 0.95 · 희귀 0.85 → 1.15로 빠진 특수능력 몫을 채움 (밸런스 기준 클리어율 그대로, 시뮬로 맞춤),
 * 줄 값이 등급 순서를 지키게 영웅 1 → 1.25 · 전설 1.2 → 1.5
 */
export const LINE_MULT: Record<ItemGrade, number> = { '일반': 0.7, '고급': 0.95, '희귀': 1.15, '영웅': 1.25, '전설': 1.5 };
/**
 * 주 옵션 (예전 주 능력치, 34 6-5): 무기 · 머리 · 손 = 지능, 몸통 = 체력, 장신구는 없음. 옵션 첫 줄, 기준값 = 영웅 (× 등급 배율) × 굴림.
 * 예전 방어구 칸마다 지능 + 체력을 머리 · 손 지능, 몸통 체력으로 나눔
 */
/** 몸통 체력 0.18 → 0.12 (2026-10-19 Lim 「Lv 100 영웅 몸통 … 힐러 체력이 탱커보다 높아짐」, 103 ③) */
export const MAIN_OPT: Partial<Record<SlotKey, { stat: StatKey; v: number }>> = { weapon: { stat: 'int', v: 0.12 }, head: { stat: 'int', v: 0.1 }, hands: { stat: 'int', v: 0.1 }, chest: { stat: 'hp', v: 0.12 } };
/** 종류 · 무작위 옵션 한 줄 부위 배율: 무기 · 방어구는 줄 수가 주 옵션만큼 적어서 한 줄이 큼 (영웅 장비 부위 세기는 예전과 같게) */
export const SLOT_MULT: Record<SlotGroup, number> = { weapon: 1.3, armor: 1.3, acc: 1 };
/** 특수능력 굴림: 그 특수능력 최대값의 ROLL_MIN ~ 100% (91: 옵션은 넓은 굴림 rollOpt, 특수능력은 그대로) */
export const ROLL_MIN = 0.6;

/**
 * 옵션 굴림 (91 디아2식): 주 · 종류 · 무작위 옵션 모두 r = OPT_ROLL.lo + OPT_ROLL.span × u^OPT_ROLL.pow (u = 0~1 고르게) → 50~160%, 평균 100%
 * (120% 넘는 줄 31%, 145% 넘는 줄 12%). 값 = 기준값 × r. 기준값 = 주 · 종류 옵션은 예전 고정값, 무작위 옵션은 그 줄 최대값의 RANDOM_BASE (예전 60~100% 굴림의 평균)
 */
export const OPT_ROLL = { lo: 0.5, span: 1.1, pow: 1.2 };
export const OPT_ROLL_MAX = OPT_ROLL.lo + OPT_ROLL.span;
export const RANDOM_BASE = 0.8;
/** 옵션 한 줄 굴림 (소수 둘째 자리) */
export const rollOpt = (r: () => number) => Math.round((OPT_ROLL.lo + OPT_ROLL.span * r() ** OPT_ROLL.pow) * 100) / 100;
/** 옵션 굴림 막대 채움 (0~1): 50% = 0, 160% = 1 */
export const optFill = (roll: number) => Math.max(0, Math.min(1, (roll - OPT_ROLL.lo) / OPT_ROLL.span));

/**
 * 아이템 레벨 몫 (91, 예전 강화 몫): 옵션 값에 1 + ILV_STEP × P(아이템 레벨). 특수능력은 그대로.
 * P = 예전 그 레벨 플레이어의 평균 강화 단계를 매끈하게 한 값 (클라우드 시뮬), 표 사이는 직선. Lv 100부터 엔드게임 몫 (예전 엔드게임 +10까지)
 * → 배율 Lv 1 ×1 · 10 ×1.14 · 20 ×1.18 · 40 ×1.40 · 60 ×1.42 · 70 ×1.46 · 85 · 99 ×1.54 · 100 ×1.68
 */
export const ILV_STEP = 0.08;
export const ILV_P: readonly (readonly [number, number])[] = [[1, 0], [10, 1.8], [20, 2.3], [40, 5.0], [60, 5.2], [70, 5.8], [85, 6.7], [99, 6.8], [100, 8.5]];
export function ilvP(ilv: number | undefined): number {
  if (ilv == null) return 0;
  if (ilv >= ILV_P[ILV_P.length - 1][0]) return ILV_P[ILV_P.length - 1][1];
  for (let i = 1; i < ILV_P.length; i++) {
    const [l1, p1] = ILV_P[i - 1], [l2, p2] = ILV_P[i];
    if (ilv <= l2) return ilv <= l1 ? p1 : p1 + ((p2 - p1) * (ilv - l1)) / (l2 - l1);
  }
  return 0;
}
/** 아이템 레벨 옵션 배율. 아이템 레벨이 없으면 1 */
export const ilvBonus = (ilv: number | undefined) => 1 + ILV_STEP * ilvP(ilv);

/**
 * 장비 종류 (34 6-2 · 6-10): 부위마다 5종. fixed = 종류 옵션 (주 옵션 다음 줄부터, 주 옵션과 같은 능력치는 빼고, 줄 수가 모자라면 앞 것만).
 * 부위의 첫 종류 = 옛 장비가 받는 종류. 그림 = item-<부위>-<종류> (첫 종류는 item-<부위>)
 */
export interface KindDef { key: string; slot: SlotKey; name: string; fixed: readonly StatKey[] }
export const KINDS: KindDef[] = [
  { key: 'staff', slot: 'weapon', name: '지팡이', fixed: ['haste'] },
  { key: 'scepter', slot: 'weapon', name: '홀', fixed: ['crit'] },
  { key: 'mace', slot: 'weapon', name: '메이스', fixed: ['endure'] },
  { key: 'wand', slot: 'weapon', name: '완드', fixed: ['haste', 'spirit'] },
  { key: 'relic', slot: 'weapon', name: '성물', fixed: ['int', 'crit'] },
  { key: 'hood', slot: 'head', name: '두건', fixed: ['spirit'] },
  { key: 'crown', slot: 'head', name: '관', fixed: ['crit'] },
  { key: 'helm', slot: 'head', name: '투구', fixed: ['endure'] },
  { key: 'wreath', slot: 'head', name: '화관', fixed: ['spirit', 'haste'] },
  { key: 'plume', slot: 'head', name: '깃털 모자', fixed: ['crit', 'endure'] },
  { key: 'robe', slot: 'chest', name: '로브', fixed: ['spirit'] },
  { key: 'vestment', slot: 'chest', name: '법복', fixed: ['int'] },
  { key: 'mail', slot: 'chest', name: '사슬 조끼', fixed: ['endure'] },
  { key: 'habit', slot: 'chest', name: '수도복', fixed: ['spirit', 'endure'] },
  { key: 'coat', slot: 'chest', name: '외투', fixed: ['haste', 'crit'] },
  { key: 'gloves', slot: 'hands', name: '장갑', fixed: ['haste'] },
  { key: 'wraps', slot: 'hands', name: '손싸개', fixed: ['crit'] },
  { key: 'gauntlet', slot: 'hands', name: '건틀릿', fixed: ['endure'] },
  { key: 'bracer', slot: 'hands', name: '팔찌', fixed: ['int', 'haste'] },
  { key: 'sleeve', slot: 'hands', name: '토시', fixed: ['crit', 'spirit'] },
  { key: 'ring', slot: 'ring', name: '반지', fixed: ['crit'] },
  { key: 'signet', slot: 'ring', name: '인장 반지', fixed: ['haste'] },
  { key: 'jade', slot: 'ring', name: '옥 반지', fixed: ['spirit'] },
  { key: 'twin', slot: 'ring', name: '쌍가락지', fixed: ['crit', 'haste'] },
  { key: 'stone', slot: 'ring', name: '돌 반지', fixed: ['endure', 'int'] },
  { key: 'beads', slot: 'neck', name: '구슬 목걸이', fixed: ['spirit'] },
  { key: 'pendant', slot: 'neck', name: '펜던트', fixed: ['int'] },
  { key: 'medal', slot: 'neck', name: '메달', fixed: ['crit'] },
  { key: 'amulet', slot: 'neck', name: '부적', fixed: ['endure', 'spirit'] },
  { key: 'starneck', slot: 'neck', name: '별 목걸이', fixed: ['int', 'haste'] },
];
export const kindsOf = (slot: SlotKey) => KINDS.filter(k => k.slot === slot);
/** 종류 정의 (모르는 종류면 그 부위 첫 종류) */
export const kindOf = (it: { slot: SlotKey; kind?: string }): KindDef => KINDS.find(k => k.key === it.kind && k.slot === it.slot) ?? kindsOf(it.slot)[0];
export const groupOf = (slot: SlotKey): SlotGroup => SLOTS.find(s => s.key === slot)!.group;

/** 무작위 옵션 한 줄. roll = 기준값 (그 줄 최대값 × RANDOM_BASE) 대비 굴림 (0.5~1.6, 91. v16까지는 최대값 대비 0.6~1) */
export interface GearLine { stat: StatKey; roll: number }
/** 종류 옵션 능력치 (주 옵션과 같은 것은 뺌: 성물 · 팔찌의 지능) */
export const kindStats = (k: KindDef): StatKey[] => k.fixed.filter(x => x !== MAIN_OPT[k.slot]?.stat);
/** 주 옵션 줄 수 (무기 · 방어구 1, 장신구 0) */
const mainLines = (slot: SlotKey) => (MAIN_OPT[slot] ? 1 : 0);
/** 종류 옵션 줄 수 (옵션 줄 수가 모자라면 종류의 앞 능력치만) */
export const kindLines = (k: KindDef, grade: ItemGrade) => Math.min(kindStats(k).length, OPTION_LINES[grade] - mainLines(k.slot));
/** 무작위 옵션 줄 수 = 옵션 줄 수 − 주 옵션 − 종류 옵션 */
export const randomLines = (k: KindDef, grade: ItemGrade) => OPTION_LINES[grade] - mainLines(k.slot) - kindLines(k, grade);
/** 무작위 옵션에 안 나오는 능력치: 주 옵션 · 종류 옵션 (둘 다) */
export const takenStats = (k: KindDef): StatKey[] => [...(MAIN_OPT[k.slot] ? [MAIN_OPT[k.slot]!.stat] : []), ...k.fixed];
/** 종류 · 무작위 옵션 한 줄 최대값 (예전 굴림 1. 91: 종류 옵션 기준값, 무작위 옵션은 × RANDOM_BASE): 능력치 기준값 × 부위 배율 × 등급 배율 */
export const lineMax = (stat: StatKey, slot: SlotKey, grade: ItemGrade) => STATS[stat].max * SLOT_MULT[groupOf(slot)] * LINE_MULT[grade];

/**
 * 바탕 등급 확률 (61 3장 → 88, 2026-10-16 Lim). 순서 = ITEM_GRADES, 일반 ~ 희귀만. 영웅 · 전설은 heroChance · legendChance로 따로 (dropOdds).
 * Lim 07:25 「초반에는 희귀까지만」 · 07:49 「일반이 제일 높고, 고급, 희귀 순으로 낮아야 정상」 · 09:36 「칸마다 난이도 및 레벨에 따라서 최소 등급」:
 * 칸 (콘텐츠 · 난이도 · 레벨대)마다 최소 등급 (minGrade = 표에서 나오는 가장 낮은 등급)이 있고, 그 등급부터 차례로 줄어듦.
 * 0 = 레벨링 (탐험 · 던전, 장소 Lv 1~20), 10 · 20 = 레이드 인원 (적 = 내 레벨이라 레벨대 없음)
 *
 * 최소 등급         쉬움   보통   어려움  악몽
 *   장소 Lv 1~20    일반   일반   고급    고급
 *   장소 Lv 21~44   일반   고급   고급    희귀
 *   장소 Lv 45~69   고급   고급   희귀    희귀
 *   장소 Lv 70~     고급   희귀   희귀    희귀
 *   10인 레이드     고급   희귀   희귀    희귀
 *   20인 레이드     희귀   희귀   희귀    희귀
 */
export const DROP_TABLES: Record<0 | 10 | 20, Record<DiffName, number[]>> = {
  0: {
    '쉬움': [1, 0, 0, 0, 0],
    '보통': [0.7, 0.3, 0, 0, 0],
    '어려움': [0, 0.8, 0.2, 0, 0],
    '악몽': [0, 0.65, 0.35, 0, 0],
  },
  10: {
    '쉬움': [0, 0.6, 0.4, 0, 0],
    '보통': [0, 0, 1, 0, 0],
    '어려움': [0, 0, 1, 0, 0],
    '악몽': [0, 0, 1, 0, 0],
  },
  20: {
    '쉬움': [0, 0, 1, 0, 0],
    '보통': [0, 0, 1, 0, 0],
    '어려움': [0, 0, 1, 0, 0],
    '악몽': [0, 0, 1, 0, 0],
  },
};
/**
 * 탐험 · 던전 바탕 표의 레벨대 (86 · 88): 장소 레벨로 최소 등급이 오름. 0 = 장소 Lv 1~20 (위 DROP_TABLES[0]), 1 = Lv 21~44,
 * 2 = Lv 45~69 (10인 레이드가 열리는 레벨), 3 = Lv 70~ (20인 레이드가 열리는 레벨).
 * 같은 난이도에서 어느 등급 이상 확률도 앞 레벨대보다 줄지 않고, 같은 난이도 10인 레이드보다 위가 아님. 표마다 최소 등급부터 차례로 줄어듦
 */
export const LOOT_TIER_LV = [1, RAMP_LV + 1, RAID10_LV, contentOf('cathedral1').unlockLv] as const;
export const LEVELING_TIERS: Record<DiffName, number[]>[] = [
  DROP_TABLES[0],
  {
    '쉬움': [0.7, 0.3, 0, 0, 0],
    '보통': [0, 0.7, 0.3, 0, 0],
    '어려움': [0, 0.6, 0.4, 0, 0],
    '악몽': [0, 0, 1, 0, 0],
  },
  {
    '쉬움': [0, 0.7, 0.3, 0, 0],
    '보통': [0, 0.6, 0.4, 0, 0],
    '어려움': [0, 0, 1, 0, 0],
    '악몽': [0, 0, 1, 0, 0],
  },
  {
    '쉬움': [0, 0.6, 0.4, 0, 0],
    '보통': [0, 0, 1, 0, 0],
    '어려움': [0, 0, 1, 0, 0],
    '악몽': [0, 0, 1, 0, 0],
  },
];
/** 장소 레벨 → 레벨대 (0 · 1 · 2 · 3) */
export const lootTier = (placeLv: number) => LOOT_TIER_LV.reduce((t, lv, i) => (placeLv >= lv ? i : t), 0);
/**
 * 그 콘텐츠 · 난이도 바탕 표 (raid = 레이드 인원, 0 = 탐험 · 던전). tierLv = 탐험 · 던전 등급대를 정하는 레벨
 * (장소 레벨, 주간 도전 · 일일 상자는 내 레벨). 없으면 첫 등급대 (61 표)
 */
export const dropTable = (diff: DiffName, raid: 0 | 10 | 20 = 0, tierLv = 1): number[] => (raid ? DROP_TABLES[raid][diff] : LEVELING_TIERS[lootTier(tierLv)][diff]);
/** 확률에서 나올 수 있는 가장 높은 등급 (상한) */
export const topGrade = (table: number[]): ItemGrade => ITEM_GRADES[table.reduce((m, p, i) => (p > 0 ? i : m), 0)];
/** 최소 등급 (88 v0.2): 확률에서 나오는 가장 낮은 등급 */
export const minGrade = (table: number[]): ItemGrade => ITEM_GRADES[Math.max(0, table.findIndex(p => p > 0))];

/**
 * 영웅 확률 (88, Lim 「점점 레벨이 중반부터 희박하게 영웅」): 난이도 · 콘텐츠마다 Lv 100 최대값 × 레벨 오름 (heroRamp).
 * Lv 44까지 0 (초반은 희귀까지), Lv 45 (10인 레이드가 열리는 레벨)에 최대값의 1/56부터 레벨마다 같은 만큼 올라 Lv 100에 최대값.
 * 레벨 = 탐험 · 던전은 장소 레벨, 레이드는 그 판 적 레벨 (= 내 레벨), 주간 도전 · 일일 상자는 내 레벨. 레벨링 < 10인 < 20인
 */
export const HERO_FROM = RAID10_LV;
export const HERO_MAX: Record<0 | 10 | 20, Record<DiffName, number>> = {
  0: { '쉬움': 0, '보통': 0.04, '어려움': 0.1, '악몽': 0.2 },
  10: { '쉬움': 0.02, '보통': 0.05, '어려움': 0.15, '악몽': 0.25 },
  20: { '쉬움': 0.04, '보통': 0.08, '어려움': 0.2, '악몽': 0.3 },
};
export const heroRamp = (lv: number) => Math.max(0, Math.min(1, (lv - (HERO_FROM - 1)) / (MAX_LEVEL - (HERO_FROM - 1))));
/** 전설 (88, Lim 「노란색은 100레벨부터」): 내 레벨 100부터 20인 레이드 어려움 · 악몽에서만. 고유 장비 · 이름 있는 장신구 (그 구역 것) */
export const LEGEND_LEVEL = MAX_LEVEL;
export const LEGEND_CHANCE: Partial<Record<DiffName, number>> = { '어려움': 0.02, '악몽': 0.05 };
/**
 * 레이드 다시 깬 판 (2026-10-19 Lim 카드 「주 첫 판만 크게」): 칸 (보스 × 난이도)마다 주 첫 클리어는 레이드 표 그대로, 그 주에 다시 깨면 같은 레벨 던전 표
 * (바탕 표 · 영웅 확률 = 던전) + 20인 · 내 레벨 100 어려움 · 악몽 전설 이만큼
 */
export const REPEAT_LEGEND: Partial<Record<DiffName, number>> = { '어려움': 0.01, '악몽': 0.01 };

/** 클리어 등급이 높을수록 바탕 표에서 상위 등급 확률 소폭↑ (02 10-4): 굴린 값을 이만큼 위로 민다 (바탕 표 상한까지) */
export const GRADE_BONUS: Record<'S' | 'A' | 'B' | 'C', number> = { S: 0.05, A: 0.02, B: 0, C: 0 };
/** 공개모집 일일 보너스 판 (13 2-2): 굴린 값을 이만큼 더 위로 (그 바탕 표 상한은 그대로, 61 3-3) */
export const PUB_GRADE_BONUS = 0.25;
/** 영웅 · 전설 확률 배율 (88): 클리어 등급 · 공개모집 보너스 판. 밀기 대신 곱해서 희박함을 지킴 */
export const TOP_GRADE_MULT: Record<'S' | 'A' | 'B' | 'C', number> = { S: 1.2, A: 1.1, B: 1, C: 1 };
export const PUB_TOP_MULT = 1.5;

/**
 * 드롭 등급을 정하는 맥락: tierLv = 등급대 · 영웅 레벨 (장소 레벨 · 레이드 레벨 · 내 레벨), level = 내 레벨 (전설), pub = 공개모집 보너스 판,
 * repeat = 그 주에 레이드 칸 첫 보상을 이미 받은 다시 깬 판 (던전 표, REPEAT_LEGEND)
 */
export interface OddsCtx { diff: DiffName; raid?: 0 | 10 | 20; tierLv: number; level: number; grade?: 'S' | 'A' | 'B' | 'C'; pub?: boolean; repeat?: boolean }
/** 바탕 표 · 영웅 확률을 고르는 콘텐츠 크기 (레이드 다시 깬 판은 던전 = 0) */
const tableOf = (o: OddsCtx): 0 | 10 | 20 => (o.repeat ? 0 : o.raid ?? 0);
/** 영웅 확률 (클리어 등급 · 보너스 배율 포함) */
export const heroChance = (o: OddsCtx) => HERO_MAX[tableOf(o)][o.diff] * heroRamp(o.tierLv) * TOP_GRADE_MULT[o.grade ?? 'A'] * (o.pub ? PUB_TOP_MULT : 1);
/** 전설 확률: 20인 레이드 · 내 레벨 100부터 (다시 깬 판은 REPEAT_LEGEND) */
export const legendChance = (o: OddsCtx) => (o.raid === 20 && o.level >= LEGEND_LEVEL ? ((o.repeat ? REPEAT_LEGEND : LEGEND_CHANCE)[o.diff] ?? 0) * TOP_GRADE_MULT[o.grade ?? 'A'] * (o.pub ? PUB_TOP_MULT : 1) : 0);
/** 최종 등급 확률 (ITEM_GRADES 순): 바탕 표를 보너스만큼 밀고 (상한 그대로), 영웅 · 전설 확률만큼 덜어 냄 */
export function dropOdds(o: OddsCtx): number[] {
  const base = dropTable(o.diff, tableOf(o), o.tierLv), top = ITEM_GRADES.indexOf(topGrade(base));
  const shift = GRADE_BONUS[o.grade ?? 'A'] + (o.pub ? PUB_GRADE_BONUS : 0);
  // 누적 확률을 shift만큼 당김: 굴린 값 x → min(x + shift, 1) (예전 rollGrade와 같음)
  const out = ITEM_GRADES.map(() => 0);
  let cum = 0, prev = 0;
  for (let i = 0; i <= top; i++) {
    cum += base[i];
    const edge = i === top ? 1 : Math.max(0, Math.min(1, cum - shift));
    out[i] = Math.max(0, edge - prev);
    prev = Math.max(prev, edge);
  }
  const hero = heroChance(o), legend = legendChance(o), rest = Math.max(0, 1 - hero - legend);
  const res = out.map(p => p * rest);
  res[ITEM_GRADES.indexOf('영웅')] += hero;
  res[ITEM_GRADES.indexOf('전설')] += legend;
  return descending(res);
}
/**
 * 바닥 (나오는 가장 낮은 등급)부터 높은 등급으로 확률이 줄어들게 (88, Lim 「등급에 따라 순차적으로」): 보너스 (S 등급 · 공개모집)로 위 등급이
 * 아래 등급보다 커지면 그 둘을 고르게 나눔 (합 그대로, 이웃끼리 평균). 바닥 아래 · 나올 수 없는 위 등급은 0 그대로
 */
export function descending(p: number[]): number[] {
  const lo = p.findIndex(x => x > 0), hi = p.reduce((m, x, i) => (x > 0 ? i : m), -1);
  if (lo < 0) return p;
  const blocks: { sum: number; n: number }[] = [];
  for (let i = lo; i <= hi; i++) {
    blocks.push({ sum: p[i], n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n > blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n) {
      const b = blocks.pop()!; blocks[blocks.length - 1].sum += b.sum; blocks[blocks.length - 1].n += b.n;
    }
  }
  const out = p.slice();
  let i = lo;
  for (const b of blocks) for (let k = 0; k < b.n; k++) out[i++] = b.sum / b.n;
  return out;
}
/** 등급 굴림: 최종 확률 (dropOdds)에서 하나 */
export function rollGrade(r: () => number, odds: number[]): ItemGrade {
  let x = r(), i = 0;
  for (; i < odds.length - 1; i++) {
    if (x < odds[i]) break;
    x -= odds[i];
  }
  // 부동소수 끝자리로 확률 0 등급에 떨어지지 않게 (가장 높은 확률 있는 등급까지)
  return ITEM_GRADES[Math.min(i, ITEM_GRADES.indexOf(topGrade(odds)))];
}

export interface GearItem {
  id: number;
  slot: SlotKey;
  /** 종류 키 (KINDS). 옛 저장엔 없음 → migrate가 그 부위 첫 종류로 */
  kind: string;
  grade: ItemGrade;
  name: string;
  /** 주 · 종류 옵션 굴림 (91, 보이는 순서 = fixedOf). 옛 저장엔 없음 = 1 (예전 고정값 그대로) */
  fixedRolls?: number[];
  /** 무작위 옵션 (옵션 줄 수 − 종류 옵션, 종류 옵션 · 서로 겹치지 않음) */
  lines: GearLine[];
  /** 전설 고유 능력 배율 (91, UNIQUE_ROLL 1.3~1.7 굴림): 고유 장비 고정 특수능력 · 고유 능력 줄. 옛 저장엔 없음 = UNIQUE_MULT (1.5). 이름 있는 장신구 효과는 값 고정 */
  uniqueMult?: number;
  /** 특수능력 줄 (42): 일반 0 · 고급 0~1 · 희귀 1 · 영웅 1 · 전설 = 고유 능력 1 (legend). 옛 저장엔 없음 → migrate가 굴림 */
  specs?: SpecLine[];
  /** 이름 있는 장신구 (42 3장, 전설만): 고유 효과 키 = 고유 능력. 이름도 그 장신구 이름 */
  named?: string;
  /** 고유 무기 · 방어구 (34 6-10 ③, data/uniques, 전설만): 키. 이름도 그 장비 이름, 고정 특수능력 1.5배 = 고유 능력 */
  unique?: string;
  /** 세력 생김새 (34 6-10 ②): 떨어진 장소의 세력. 이름에 세력 말이 붙고 그림이 다름 (성능 같음). 옛 저장 · 상점 · 임무 장비는 없음 */
  look?: FactionKey;
  /** 잠금 (27 4-3): 판매에서 빠짐. 옛 저장엔 없음 = 안 잠김 */
  lock?: boolean;
  /** 이 장비에서 재설정한 횟수 (34 6-8, 할수록 비쌈). 옛 저장엔 없음 = 0 */
  rr?: number;
  /** 아이템 레벨 = 떨어진 곳의 적 레벨 (탐험 · 던전 = 장소 Lv + 난이도, 레이드 = 그 판 적 레벨, 상자 · 상점 · 공훈 = 받을 때 내 레벨). 옛 저장은 migrate가 그 직업 레벨로 */
  lv?: number;
}

/** 레벨 세기: 레벨 배율 × 정점 수련 (힐러 지능 · 체력에 곱하는 것과 같음, 34 1-2 · 2-2) */
const lvStrength = (l: number) => lvPower(l) * apexOf(l);
/** 아이템 레벨 배율: 아이템 레벨 세기 ÷ 내 레벨 세기. 아이템 레벨이 없으면 1 */
export const ilvMult = (ilv: number | undefined, level: number): number => (ilv == null ? 1 : lvStrength(ilv) / lvStrength(level));

/**
 * 수치 능력치 (2026-10-13 Lim 「아이템 수치를 퍼센트가 아닌 수치로 하여 레벨별 아이템으로」): 지능 · 체력 옵션은 % 대신 수치.
 * 수치 = 비율 (6-3 ~ 6-5 표) × 수치 단위 × 레벨 배율(아이템 Lv) → 장비마다 고정이고 아이템 레벨이 높을수록 큼. 능력치 판의 지능 · 체력 합계에 그대로 더해지는 숫자
 * (지능 단위 = INT_BASE × 치유 배율 = 힐러 기본 지능 눈금, 체력 = 힐러 기본 체력 HEALER_HP). 내 능력치로는 수치 ÷ (단위 × 레벨 세기(내 Lv)) = 비율 (ilvMult와 같은 셈).
 * 레벨 세기 = 레벨 배율 × 정점 수련 (Lv 51부터)이라 능력치 판 「장비 +N」이 장비 수치 합과 같음 (지능 무른 상한 전)
 * 치명타 · 가속 · 정신력 · 인내는 여기 없음: 장비에 고정 %로 붙고 내 레벨과 상관없음 (Lim 「지능 10%가 레벨업하며 9%로 떨어지면 헷갈림」).
 * 2026-10-16부터 아이템 레벨에 따라 75~125% (pctLvMult, 떨어질 때 정해져 그 장비에서는 안 바뀜)
 */
export const STAT_POINT: Partial<Record<StatKey, number>> = { int: INT_BASE * RULES.heal, hp: 550 };
/** 수치로 보이는 능력치인지 (지능 · 체력) */
export const isPointStat = (stat: StatKey) => STAT_POINT[stat] != null;
/**
 * % 옵션 (치명타 · 가속 · 정신력 · 인내)의 아이템 레벨 배율 (2026-10-16 Lim 「장비 옵션에서 레벨별로 모든 수치가 레벨에 맞게」):
 * 아이템 Lv 1 75% → Lv 50 100% → Lv 100 125%. 아이템 레벨로만 정해져 레벨업해도 그 장비의 %는 그대로 (Lim 2026-10-13 「10%가 9%로 떨어지면 헷갈림」)
 */
export const PCT_LV = { lo: 0.75, hi: 1.25 };
export const pctLvMult = (ilv: number | undefined): number => (ilv == null ? 1 : PCT_LV.lo + (PCT_LV.hi - PCT_LV.lo) * (Math.min(100, Math.max(1, ilv)) - 1) / 99);
/** 그 능력치 옵션의 아이템 레벨 배율: 지능 · 체력은 ilvMult (내 레벨 기준 수치), % 옵션은 pctLvMult (아이템 레벨만) */
export const statMult = (stat: StatKey, ilv: number | undefined, level: number) => (isPointStat(stat) ? ilvMult(ilv, level) : pctLvMult(ilv));
/** 내 레벨 기준 비율 → 수치 (지능 · 체력. optionsOf · itemStats의 v에 쓰면 그 장비 옵션 수치) */
export const toPoints = (stat: StatKey, frac: number, level: number) => frac * (STAT_POINT[stat] ?? 0) * lvStrength(level);

export type Equipped = Partial<Record<SlotKey, GearItem>>;

export const slotName = (k: SlotKey) => SLOTS.find(s => s.key === k)!.name;

// ---------- 세력 생김새 (34 6-10 ②) ----------
/** 세력 말: 이름 = 등급 말 + 세력 말 + 종류 (「축복받은 산호 로브」) */
export const LOOK_WORD: Record<FactionKey, string> = {
  golem: '톱니', plague: '잿빛', swamp: '이끼', noble: '백합', mage: '서리', hill: '해바라기', abyss: '별밤', pirate: '산호', fairy: '버섯', dragon: '불꽃', sand: '노을', storm: '깃털', deep: '자수정',
};
/** 그 장소 (콘텐츠 키)의 세력. 장소가 없으면 없음 */
export const lookOf = (place: string | undefined): FactionKey | undefined => {
  const p = place ? CONTENT_PLACE[place as keyof typeof CONTENT_PLACE] : undefined;
  return p ? PLACES[p].faction : undefined;
};

/** 이름: 등급 말 + (세력 말) + 종류 (「축복받은 두건」 · 「축복받은 산호 두건」). 이름 있는 장신구 · 고유 장비는 그 이름 (「녹슨 톱니」) */
export const itemName = (it: { slot: SlotKey; kind?: string; grade: ItemGrade; named?: string; unique?: string; look?: FactionKey }) =>
  namedOf(it.named)?.name ?? uniqueOf(it.unique)?.name ?? [GRADE_STYLE[it.grade].word, it.look ? LOOK_WORD[it.look] : '', kindOf(it).name].filter(Boolean).join(' ');

/** 무작위 옵션 n줄: 주 옵션 · 종류 옵션과 다른 능력치에서 서로 다르게 (fixed = 안 나오는 능력치, takenStats), 값은 옵션 굴림 (rollOpt, 50~160%) */
export function rollLines(r: () => number, n: number, fixed: readonly StatKey[]): GearLine[] {
  const pool = STAT_KEYS.filter(k => !fixed.includes(k)), out: GearLine[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const stat = pool.splice(Math.floor(r() * pool.length), 1)[0];
    out.push({ stat, roll: rollOpt(r) });
  }
  return out;
}
/** 주 · 종류 옵션 줄 수 (fixedOf 줄 수) */
export const fixedLines = (it: { slot: SlotKey; kind?: string; grade: ItemGrade }) => { const k = kindOf(it); return mainLines(k.slot) + kindLines(k, it.grade); };
/** 주 · 종류 옵션 굴림 (91) */
export const rollFixed = (r: () => number, it: { slot: SlotKey; kind?: string; grade: ItemGrade }): number[] => Array.from({ length: fixedLines(it) }, () => rollOpt(r));

// ---------- 특수능력 줄 (42 1장) ----------
/**
 * 등급마다 특수능력 줄 수 (42 1-1 → 88, 2026-10-16 Lim 「아이템의 특수 능력은 영웅등급 이상에서 붙게」): 일반 · 고급 · 희귀 0 · 영웅 1 ·
 * 전설 1 + 고유 능력 (고유 장비 · 이름 있는 장신구, makeLegend). 예전 고급 20% · 희귀 1줄이 빠진 만큼 고급 · 희귀 옵션 줄 배율을 올림 (LINE_MULT)
 */
export const SPEC_LINES: Record<ItemGrade, number> = { '일반': 0, '고급': 0, '희귀': 0, '영웅': 1, '전설': 1 };
/** 장소마다 자주 나오는 특수능력은 이만큼 잘 나옴 (42 1-4) */
export const FEATURED_WEIGHT = 4;
export const LEGEND: ItemGrade = '전설';
/** 고유 능력 배율 굴림 (91): 예전 UNIQUE_MULT 1.5 고정 → 1.3~1.7 고르게 (평균 1.5) */
export const UNIQUE_ROLL = { lo: 1.3, hi: 1.7 };
export const rollUnique = (r: () => number) => Math.round((UNIQUE_ROLL.lo + (UNIQUE_ROLL.hi - UNIQUE_ROLL.lo) * r()) * 100) / 100;
/** 전설 고유 능력 값: 그 등급 최대 굴림 × 고유 능력 배율 (91: 1.3~1.7 굴림, 없으면 UNIQUE_MULT, 고유 장비와 같음). 값 고정 특수능력은 그대로 */
export const legendValue = (key: string, grade: ItemGrade, mult = UNIQUE_MULT) => (SPECS[key]?.fixed ? SPECS[key].val : specValue(key, grade, 1) * mult);

/**
 * 장소마다 잘 나오는 장비 종류 (39 4장, 34 6-10 ①에서 30종으로 다시 나눔): 던전 3 · 탐험 2 · 레이드 칸마다 1. 목록에 없는 종류도 나오지만 목록이 KIND_WEIGHT배.
 * 같은 레벨대 (열림 ±5)에서 조합이 겹치지 않게. 세력 장소들의 목록을 합친 것이 그 세력의 생김새 (LOOKS). 아직 없는 장소는 만들 때 더함
 */
export const PLACE_KINDS: Record<string, readonly string[]> = {
  // 버려진 골렘: 인내
  plateau: ['mace', 'plume'],
  rustfort: ['helm', 'gauntlet', 'stone'],
  // 역병 교단: 정신력
  cemetery: ['hood', 'habit'],
  crypt: ['robe', 'beads', 'amulet'],
  sewer: ['hood', 'pendant', 'habit'],
  // 늪의 부족: 가속
  marsh: ['gloves', 'wand'],
  swamp: ['staff', 'signet', 'bracer'],
  mossroot: ['helm', 'mail', 'wand'],
  // 몰락한 귀족가: 치명타
  lily: ['crown', 'relic'],
  manor: ['scepter', 'wraps', 'sleeve'],
  rosemaze: ['scepter', 'sleeve'],
  ossuary: ['ring', 'beads', 'relic'],
  // 폭주한 마도사: 지능 · 가속
  snowpass: ['staff', 'starneck'],
  frost: ['vestment', 'pendant', 'starneck'],
  bookfield: ['signet', 'bracer'],
  archive: ['staff', 'vestment', 'bracer'],
  // 해바라기 언덕: 고루
  hillpath: ['ring', 'wreath'],
  pilgrim: ['helm', 'medal'],
  temple: ['beads', 'wraps', 'medal'],
  watchtower: ['mail', 'gauntlet', 'wreath'],
  // 심연
  abyssedge: ['vestment', 'stone'],
  abyss1: ['vestment'], abyss2: ['coat'], abyss3: ['wraps'], abyss4: ['stone'], abyss5: ['pendant'],
  // 짠물 해적단 (46 6장)
  shellbeach: ['gloves', 'coat'],
  wreck: ['wraps', 'twin'],
  gull1: ['signet'], gull2: ['twin'], gull3: ['robe'],
  queen1: ['relic'], queen2: ['beads'], queen3: ['hood'],
  isle1: ['staff'], isle2: ['crown'], isle3: ['medal'],
  // 버섯 요정단 (48 6장): 정신력 · 지능
  lampway: ['hood', 'jade'],
  rainbow: ['beads', 'wreath'],
  teaparty: ['robe', 'pendant', 'amulet'],
  fest1: ['wreath'], fest2: ['pendant'], fest3: ['jade'],
  cave1: ['gloves'], cave2: ['amulet'], cave3: ['scepter'],
  palace1: ['mail'], palace2: ['crown'], palace3: ['wand'],
  // 붉은 용 일가: 인내 (기슭) · 치명타 · 가속 (51 6장)
  emberfoot: ['gauntlet', 'plume'],
  ashpass: ['plume', 'medal'],
  hotspring: ['coat', 'wraps', 'starneck'],
  den1: ['coat'], den2: ['twin'], den3: ['scepter'],
  nest1: ['wreath'], nest2: ['gauntlet'], nest3: ['relic'],
  // 용암 대장간 (51 6장): 버려진 골렘 인내
  forge: ['mail', 'helm', 'stone'],
  // 심연 (51 6장): 잠긴 호숫가 지능 · 정신력, 대성당 2~4구역 칸마다 1
  lakeshore: ['vestment', 'amulet'],
  cathedral2: ['mail'], cathedral3: ['crown'], cathedral4: ['staff'],
  // 묶음 E1 (54 6장): 모래 왕국 정신력 · 가속, 심연 지능 · 정신력
  bazaar1: ['helm'], bazaar2: ['wraps'], bazaar3: ['signet'],
  deepstairs: ['hood', 'pendant'],
  abbey1: ['vestment'], abbey2: ['wand'], abbey3: ['amulet'],
  hourglass: ['robe', 'gloves', 'beads'],
  // 묶음 E2 (54 6장)
  dusk1: ['wreath'], dusk2: ['medal'], dusk3: ['relic'],
  caravan: ['coat', 'twin'],
  rootwood1: ['gauntlet'], rootwood2: ['stone'], rootwood3: ['mace'],
  // 묶음 E3 (54 6장): 폭풍 깃털단 가속 · 치명타 (바람개비 언덕 하나), 해바라기 언덕 치명타 · 인내
  pyramid1: ['habit'], pyramid2: ['bracer'], pyramid3: ['staff'],
  reservoir1: ['mail'], reservoir2: ['twin'], reservoir3: ['scepter'],
  pinwheel: ['plume', 'starneck'],
  observatory: ['crown', 'sleeve', 'jade'],
  // 묶음 F1 (56 6장): 심연 지능 · 정신력 (숨결 우물 칸마다 1, 이끼벽 수도복은 낮잠 피라미드 복도와 겹쳐 로브로), 폭풍 깃털단 가속 · 치명타
  well1: ['hood'], well2: ['robe'], well3: ['pendant'],
  post1: ['plume'], post2: ['gloves'], post3: ['signet'],
  ranch: ['coat', 'ring'],
  windmill: ['scepter', 'sleeve', 'medal'],
  // 묶음 F2 (56 6장): 심연 지능 · 정신력 (수정 뿌리굴 칸마다 1), 폭풍 깃털단 가속 · 치명타 (폭풍 성채 칸마다 1)
  crystal1: ['stone'], crystal2: ['wand'], crystal3: ['crown'],
  fort1: ['helm'], fort2: ['wraps'], fort3: ['staff'],
  // 묶음 F3 (56 6장): 폭주한 마도사 지능 · 가속, 심연 지능 · 정신력 (그림자 성벽 칸마다 1)
  station: ['starneck', 'bracer'],
  shadow1: ['mail'], shadow2: ['amulet'], shadow3: ['relic'],
  school: ['vestment', 'gloves', 'beads'],
  // 묶음 G1 (59 6장): 심연의 정예 지능 · 정신력 · 가속 (레이드 칸마다 1, 미궁 입구는 폭풍 성채 성문 투구와 겹쳐 관), 몰락한 귀족가 지능 · 치명타
  maze1: ['crown'], maze2: ['gloves'], maze3: ['ring'],
  camp1: ['plume'], camp2: ['sleeve'], camp3: ['medal'],
  carriage: ['coat', 'ring'],
  ballroom: ['scepter', 'gloves', 'medal'],
  // 묶음 G2 (59 6장): 어둠물 해안 칸마다 1 (소용돌이는 미궁 입구 관과 겹쳐 화관), 등불길은 가속
  coast1: ['staff'], coast2: ['mail'], coast3: ['wreath'],
  lantern: ['starneck', 'bracer'],
  // 묶음 G3 (59 6장): 심연의 심장 칸마다 1 (뿌리다리 장화는 신발 칸이 없어 건틀릿), 새벽 호숫길 반지 · 외투 (정신력), 멈춘 심장 속 가속 · 로브 · 목걸이
  heart1: ['gauntlet'], heart2: ['crown'], heart3: ['relic'],
  dawn: ['jade', 'robe'],
  heartcrack: ['wand', 'habit', 'amulet'],
  // 묶음 H1 (62 2-1): 그 세력 생김새 (LOOKS) 안의 종류만 골라 새 생김새 그림이 안 늘게. 열림 ±5 안에서 같은 조합 없음
  scrapheap: ['mace', 'gauntlet'], mine: ['helm', 'mail', 'plume'], alley: ['hood', 'pendant'], greenhouse: ['robe', 'habit', 'amulet'], frogpond: ['wand', 'bracer'], reedvillage: ['mail', 'gloves', 'signet'], fountain: ['crown', 'ring'], perfumery: ['coat', 'gloves', 'medal'], icefish: ['staff', 'signet'], snowlab: ['gloves', 'bracer', 'beads'], harvest: ['jade', 'sleeve'],
  // 묶음 H2 (62): 그 세력 생김새 (LOOKS) 안의 종류만 골라 새 생김새 그림이 안 늘게. 열림 ±5 안에서 같은 조합 없음
  granary: ['helm', 'wraps', 'medal'], scarefield: ['crown', 'jade'], smuggler: ['coat', 'signet', 'twin'], reef: ['relic', 'wraps'], frostgarden: ['staff', 'pendant'], dorm: ['vestment', 'signet', 'starneck'], cultcamp: ['hood', 'beads'], apothecary: ['habit', 'pendant', 'amulet'], rooftop: ['robe', 'amulet'], bakery: ['robe', 'gloves', 'beads'], dewhill: ['wreath', 'jade'], mushmarsh: ['staff', 'gloves'], lilypalace: ['helm', 'mail', 'signet'],
  // 묶음 H3 (62): 그 세력 생김새 (LOOKS) 안의 종류만 골라 새 생김새 그림이 안 늘게. 열림 ±5 안에서 같은 조합 없음
  quarry: ['scepter', 'wraps'], smithy: ['gauntlet', 'twin', 'medal'], ferry: ['relic', 'wraps'], turtlecave: ['plume', 'twin', 'coat'], mistplaza: ['crown', 'pendant'], coralgarden: ['robe', 'twin', 'wand'], oasis: ['staff', 'bracer'], sandlibrary: ['habit', 'medal', 'relic'], sundialroad: ['staff', 'beads'],
  // 묶음 H4 (62): 그 세력 생김새 (LOOKS) 안의 종류만 골라 새 생김새 그림이 안 늘게. 열림 ±5 안에서 같은 조합 없음
  cloudbridge: ['gloves', 'signet'], flightyard: ['coat', 'helm', 'starneck'], stormmeadow: ['scepter', 'sleeve'], cloudlibrary: ['vestment', 'bracer', 'pendant'], broomrace: ['staff', 'signet'], sunkrose: ['crown', 'sleeve', 'ring'], lotusway: ['scepter', 'wraps'], waterglow: ['robe', 'bracer'], barracks: ['mail', 'gauntlet', 'medal'], outpost: ['plume', 'ring'], starcave: ['crown', 'gloves', 'starneck'], sunrisehill: ['wreath', 'beads'],
};
export const KIND_WEIGHT = 3;

/** 세력 생김새 (34 6-10 ② · 도감): 세력 장소들에서 잘 나오는 종류. 이 종류만 세력 그림이 따로 있고, 나머지는 종류 그림 + 세력 색 테두리 */
export const LOOKS: Record<FactionKey, string[]> = (() => {
  const out = Object.fromEntries(Object.keys(LOOK_WORD).map(f => [f, [] as string[]])) as Record<FactionKey, string[]>;
  for (const [place, ks] of Object.entries(PLACE_KINDS)) {
    const f = lookOf(place);
    if (f) for (const k of ks) if (!out[f].includes(k)) out[f].push(k);
  }
  for (const f of Object.keys(out) as FactionKey[]) out[f].sort((a, b) => KINDS.findIndex(k => k.key === a) - KINDS.findIndex(k => k.key === b));
  return out;
})();
/** 이 장비가 세력 그림이 따로 있는 생김새인지 (아니면 종류 그림 + 세력 색 테두리) */
export const hasLookArt = (it: { kind?: string; look?: FactionKey }) => !!it.look && !!it.kind && LOOKS[it.look].includes(it.kind);

/** 장소 목록이 있으면 30종류 중에서 (목록 KIND_WEIGHT배) 부위 · 종류를 함께 고름 */
export function pickKind(r: () => number, place: string): KindDef {
  const list = PLACE_KINDS[place] ?? [], w = KINDS.map(k => (list.includes(k.key) ? KIND_WEIGHT : 1));
  let x = r() * w.reduce((a, b) => a + b, 0), j = 0;
  while (j < KINDS.length - 1 && x >= w[j]) { x -= w[j]; j++; }
  return KINDS[j];
}

/**
 * 드롭 맥락: 지금 직업 (직업 전용은 그 직업 것만, 42 1-4) · 장소 (잘 나오는 종류 · 자주 나오는 특수능력 · 이름 있는 장신구) ·
 * 레이드 인원 (등급 표, 61 3장. 없으면 탐험 · 던전 표) · 공개모집 보너스 판 · 등급 상한 (따로 줄 때만) · 아이템 레벨
 */
/** 효과 1줄 계약을 유지하며 전용 빌드와 기존 공용 빌드를 함께 제공 */
export const CLASS_LOOT_CHANCE = 0.7;
export interface DropCtx { hero?: HeroKey; /** 클리어 보상: 효과가 붙는 장비는 전용 70% / 공용 30% (고유 전설 제외) */ classLoot?: boolean; place?: string; raid?: 0 | 10 | 20; bonus?: boolean; cap?: ItemGrade; /** 아이템 레벨 (떨어진 곳의 적 레벨) */ lv?: number; /** 탐험 · 던전 등급대 레벨 (장소 레벨, 86 · dropTable) */ tierLv?: number; /** 레이드 다시 깬 판 (OddsCtx.repeat) */ repeat?: boolean }

/**
 * 특수능력 n줄 굴림: 그 부위 · 최소 등급 이하 · (직업 전용은 그 직업) 중에서, 장소의 자주 나오는 3개는 4배.
 * 한 장비에 같은 묶음은 한 번만 (같은 특수능력 · 직업 전용 2줄도 안 나옴). 값 고정이면 굴림 1
 */
export function rollSpecs(r: () => number, slot: SlotKey, grade: ItemGrade, n: number, o: DropCtx = {}, taken: string[] = []): SpecLine[] {
  const gi = ITEM_GRADES.indexOf(grade), feat = (o.place && FEATURED[o.place]) || [];
  const out: SpecLine[] = [], groups = new Set(taken.map(k => SPECS[k]?.group));
  for (let i = 0; i < n; i++) {
    let pool = SPEC_KEYS.filter(k => {
      const d = SPECS[k];
      return d.slots.includes(slot) && ITEM_GRADES.indexOf(d.min) <= gi && (!d.hero || d.hero === o.hero) && specUseful(k, o.hero) && !groups.has(d.group); // 그 직업에 효과 없는 공통 특수능력은 빼고 (NO_EFFECT)
    });
    if (o.classLoot && o.hero && !groups.has('hero')) {
      const jobPool = pool.filter(k => SPECS[k].hero === o.hero);
      if (jobPool.length) {
        const sharedPool = pool.filter(k => !SPECS[k].hero);
        pool = !sharedPool.length || r() < CLASS_LOOT_CHANCE ? jobPool : sharedPool;
      }
    }
    if (!pool.length) break;
    const w = pool.map(k => (feat.includes(k) ? FEATURED_WEIGHT : 1));
    let x = r() * w.reduce((a, b) => a + b, 0), j = 0;
    while (j < pool.length - 1 && x >= w[j]) { x -= w[j]; j++; }
    const d = SPECS[pool[j]];
    groups.add(d.group);
    out.push({ key: d.key, roll: d.fixed ? 1 : Math.round((ROLL_MIN + (1 - ROLL_MIN) * r()) * 100) / 100 });
  }
  return out;
}

/** 등급만큼 특수능력 줄 수 (r은 예전 고급 확률 굴림 자리, 호출 모양 유지) */
export const specCount = (_r: () => number, grade: ItemGrade): number => SPEC_LINES[grade];

/**
 * 부위 · 등급이 정해진 장비 1개 (종류 · 무작위 옵션 · 특수능력 굴림). kind를 주면 그 종류. o = 드롭 맥락 (직업 · 장소).
 * 장소 세력 생김새. 전설을 여기로 만들면 (장소에 고유 장비 · 이름 있는 장신구가 없을 때) 특수능력 하나가 고유 능력 (1.5배) + 특수능력 1줄
 */
export function makeItem(r: () => number, slot: SlotKey, grade: ItemGrade, id: number, kind?: string, o: DropCtx = {}): GearItem {
  const legend = grade === LEGEND;
  const ks = kindsOf(slot), k = ks.find(x => x.key === kind) ?? ks[Math.floor(r() * ks.length)];
  const it: GearItem = { id, slot, kind: k.key, grade, name: '', lines: rollLines(r, randomLines(k, grade), takenStats(k)), specs: [] };
  it.fixedRolls = rollFixed(r, it);
  if (o.lv != null) it.lv = o.lv;
  if (legend) {
    const lg = rollSpecs(r, slot, grade, 1, o).map(l => ({ key: l.key, roll: 1, legend: true as const }));
    it.specs = [...lg, ...rollSpecs(r, slot, grade, SPEC_LINES[grade], o, lg.map(l => l.key))];
    if (lg.length) it.uniqueMult = rollUnique(r);
  } else it.specs = rollSpecs(r, slot, grade, specCount(r, grade), o);
  const look = lookOf(o.place);
  if (look) it.look = look;
  it.name = itemName(it);
  return it;
}

/**
 * 전설 (88, 노란색): 그 장소 (20인 레이드 구역, 61 3-4)의 고유 장비 · 이름 있는 장신구 가운데 하나. 그림 · 이름 · 고유 능력이 정해져 있고,
 * 부위는 고른 것이 정함. 특수능력 1줄 (전설 배율) 더. 그 직업에 효과 없는 고유 장비는 빼고, 하나도 없으면 null (makeItem으로)
 */
export function makeLegend(r: () => number, id: number, o: DropCtx = {}): GearItem | null {
  if (!o.place) return null;
  const pool: ({ unique: string; slot: SlotKey; kind: string } | { named: string; slot: SlotKey })[] = [];
  for (const s of SLOTS) {
    for (const u of uniquesFor(o.place, s.key)) if (specUseful(u.spec, o.hero)) pool.push({ unique: u.key, slot: s.key, kind: u.kind });
    for (const n of namedsFor(o.place, s.key)) pool.push({ named: n.key, slot: s.key });
  }
  if (!pool.length) return null;
  const pick = pool[Math.floor(r() * pool.length)], slot = pick.slot;
  const ks = kindsOf(slot), k = ('kind' in pick ? ks.find(x => x.key === pick.kind) : undefined) ?? ks[Math.floor(r() * ks.length)];
  const it: GearItem = { id, slot, kind: k.key, grade: LEGEND, name: '', lines: rollLines(r, randomLines(k, LEGEND), takenStats(k)), specs: [] };
  it.fixedRolls = rollFixed(r, it);
  if (o.lv != null) it.lv = o.lv;
  if ('unique' in pick) it.unique = pick.unique; else it.named = pick.named;
  const taken = 'unique' in pick ? [uniqueOf(pick.unique)!.spec] : [];
  it.specs = rollSpecs(r, slot, LEGEND, SPEC_LINES[LEGEND], o, taken);
  if (it.unique) it.uniqueMult = rollUnique(r);
  it.name = itemName(it);
  return it;
}

/** 특수능력 한 줄 값 (전설 고유 능력은 그 장비 고유 능력 배율, 91) */
export const specLineValue = (it: GearItem, l: SpecLine) => (l.legend ? legendValue(l.key, it.grade, it.uniqueMult) : specValue(l.key, it.grade, l.roll));

/** 장비 한 개의 특수능력 값 (이름 있는 장신구 고유 효과 · 고유 장비 고정 특수능력 + 줄마다 값) */
export function itemSpecs(it: GearItem | null | undefined): SpecOn[] {
  if (!it) return [];
  const out: SpecOn[] = [];
  const nm = namedOf(it.named), un = uniqueOf(it.unique);
  if (nm) out.push({ key: nm.key, v: nm.val });
  if (un) out.push({ key: un.spec, v: uniqueValue(un, it.grade, it.uniqueMult) });
  for (const l of it.specs ?? []) out.push({ key: l.key, v: specLineValue(it, l) });
  return out;
}

/** 장비 한 개의 특수능력 · 이름 있는 장신구 키 (도감용, 고유 장비는 고정 특수능력) */
export const specKeysOf = (it: GearItem): string[] => [...(it.named ? [it.named] : []), ...(uniqueOf(it.unique) ? [uniqueOf(it.unique)!.spec] : []), ...(it.specs ?? []).map(l => l.key)];

/** 착용 장비 → 전투에서 켜지는 특수능력 값 (42 1-3 · 1-5) */
export const specsOf = (eq: Equipped, hero: HeroKey): Record<string, number> => specTotals(SLOTS.flatMap(s => itemSpecs(eq[s.key])), hero);

/**
 * 장비 1개 뽑기 (등급 → 부위 · 종류 → 옵션 · 특수능력, 장소에 잘 나오는 종류가 있으면 부위 · 종류 함께). r = 0~1 난수 함수,
 * o = 드롭 맥락 (직업 · 장소 · 레이드 인원 · 공개모집 보너스 · 등급대 레벨, 없으면 내 레벨). 전설은 그 장소의 고유 장비 · 이름 있는 장신구 중 하나 (makeLegend)
 */
export function rollItem(r: () => number, diff: DiffName, grade: 'S' | 'A' | 'B' | 'C', level: number, id: number, o: DropCtx = {}): GearItem {
  let g = rollGrade(r, dropOdds({ diff, raid: o.raid ?? 0, tierLv: o.tierLv ?? level, level, grade, pub: o.bonus, repeat: o.repeat }));
  if (o.cap && ITEM_GRADES.indexOf(g) > ITEM_GRADES.indexOf(o.cap)) g = o.cap;
  if (g === LEGEND) { const lg = makeLegend(r, id, o); if (lg) return lg; }
  const k = o.place && PLACE_KINDS[o.place] ? pickKind(r, o.place) : undefined;
  const slot = k ? k.slot : SLOTS[Math.floor(r() * SLOTS.length)].key;
  return makeItem(r, slot, g, id, k?.key, o);
}

// ---------- 재설정 (34 6-8 · 42 1-6) ----------
/** 재설정이 열리는 레벨 (계정 최고 직업 레벨, 91: Lv 50 → 20, 강화 대신 장비를 다듬는 길), 후보 2개 중 고르기 */
export const REROLL_LEVEL = 20;
export const REROLL_PICK_LEVEL = 60;
/** 특수능력 재설정은 골드 3배 (42 1-6) */
export const SPEC_REROLL_MULT = 3;
/** 옵션 한 줄 재설정 골드의 등급 값 (#172 전 값, 91에서 되살림) */
export const REROLL_GOLD: Record<ItemGrade, number> = { '일반': 75, '고급': 125, '희귀': 250, '영웅': 500, '전설': 1000 };
/** 재설정 한 번 골드 = 등급 값 × (1 + 아이템 레벨 ÷ 10) × (1 + 이 장비에서 한 횟수 rr) (특수능력 3배) */
export function rerollCost(it: GearItem, spec: boolean): { gold: number } {
  return { gold: Math.round(REROLL_GOLD[it.grade] * (1 + (it.lv ?? 1) / 10) * (1 + (it.rr ?? 0)) * (spec ? SPEC_REROLL_MULT : 1)) };
}
/** 무작위 옵션 i번 줄 다시 굴림: 종류 옵션 (둘 다) · 다른 줄과 다른 능력치 (지금 능력치도 나올 수 있음), 값은 같은 옵션 굴림 (rollOpt) */
export function rerollLine(r: () => number, it: GearItem, i: number): GearLine {
  const fx = takenStats(kindOf(it)), others = it.lines.filter((_, j) => j !== i).map(l => l.stat);
  const pool = STAT_KEYS.filter(k => !fx.includes(k) && !others.includes(k));
  return { stat: pool[Math.floor(r() * pool.length)], roll: rollOpt(r) };
}
/** 특수능력 i번 줄 다시 굴림: 같은 묶음 · 그 부위 · 등급 안에서 (직업 전용은 같은 직업), 다른 줄과 겹치지 않게. 지금 특수능력도 나올 수 있음 (값만 바뀜). 고유 능력은 고유 능력 그대로 (배율 uniqueMult 그대로) */
export function rerollSpec(r: () => number, it: GearItem, i: number, hero?: HeroKey): SpecLine {
  if (it.specs![i].legend) {
    const k = rerollSpec(r, { ...it, specs: it.specs!.map((l, j) => (j === i ? { key: l.key, roll: l.roll } : l)) }, i, hero).key;
    return { key: k, roll: 1, legend: true };
  }
  const cur = SPECS[it.specs![i].key], gi = ITEM_GRADES.indexOf(it.grade), others = it.specs!.filter((_, j) => j !== i).map(l => l.key);
  const pool = SPEC_KEYS.filter(k => {
    const d = SPECS[k];
    return d.group === cur.group && d.hero === cur.hero && d.slots.includes(it.slot) && ITEM_GRADES.indexOf(d.min) <= gi && !others.includes(k);
  });
  const useful = pool.filter(k => specUseful(k, hero)); // 지금 직업에 효과 없는 공통 특수능력은 빼고 (NO_EFFECT, 남는 게 없으면 그대로)
  const from = useful.length ? useful : pool;
  const d = SPECS[from[Math.floor(r() * from.length)]];
  return { key: d.key, roll: d.fixed ? 1 : Math.round((ROLL_MIN + (1 - ROLL_MIN) * r()) * 100) / 100 };
}

/** 능력치 6가지 (비율) */
export type StatSet = Record<StatKey, number>;
export const noStats = (): StatSet => ({ int: 0, hp: 0, crit: 0, haste: 0, spirit: 0, endure: 0 });

/**
 * 옵션 줄마다 능력치 · 기준값 (굴림 · 아이템 레벨 배율 전) · 굴림, 보이는 순서 (주 → 종류 → 무작위). line = it.lines 번호 (주 · 종류 옵션은 null).
 * 기준값 (91): 주 옵션 = 부위 값 × 등급 배율, 종류 옵션 = 그 줄 최대값, 무작위 옵션 = 그 줄 최대값 × RANDOM_BASE. 주 · 종류 굴림이 없는 옛 장비는 1
 */
function optionBase(it: GearItem): { stat: StatKey; base: number; roll: number; line: number | null }[] {
  const k = kindOf(it), main = MAIN_OPT[it.slot], rs = it.fixedRolls ?? [];
  const fx: { stat: StatKey; base: number }[] = main ? [{ stat: main.stat, base: main.v * LINE_MULT[it.grade] }] : [];
  for (const stat of kindStats(k).slice(0, kindLines(k, it.grade))) fx.push({ stat, base: lineMax(stat, it.slot, it.grade) });
  return [
    ...fx.map((x, i) => ({ ...x, roll: rs[i] ?? 1, line: null })),
    ...(it.lines ?? []).map((l, i) => ({ stat: l.stat, base: RANDOM_BASE * lineMax(l.stat, it.slot, it.grade), roll: l.roll, line: i })),
  ];
}
/** 장비 옵션 한 줄 (보이는 값): v = 지금 값, lo · hi = 이 장비에서 그 줄의 범위 (굴림 50% · 160%, 상세 창 범위 글자), roll = 굴림 */
export interface OptionRow { stat: StatKey; v: number; line: number | null; roll: number; lo: number; hi: number }
/**
 * 장비 옵션 줄 (보이는 순서): 주 옵션 → 종류 옵션 → 무작위 옵션. 값 = 기준값 × 굴림 × 아이템 레벨 배율 (ilvBonus, 91: 예전 강화 배율 자리, 특수능력 제외)
 * × 능력치 레벨 배율 (statMult: 지능 · 체력은 내 레벨 기준 수치, % 옵션은 아이템 레벨). level = 내 레벨
 */
export function optionsOf(it: GearItem, level: number): OptionRow[] {
  const up = ilvBonus(it.lv);
  return optionBase(it).map(o => {
    const x = o.base * (o.stat === 'hp' ? 1 : up) * statMult(o.stat, it.lv, level); // 체력은 예전 강화 몫 (ilvBonus)을 안 곱함 (103 ③)
    return { stat: o.stat, line: o.line, roll: o.roll, v: x * o.roll, lo: x * OPT_ROLL.lo, hi: x * OPT_ROLL_MAX };
  });
}
/** 주 옵션 · 종류 옵션 값 (optionsOf의 앞줄) */
export const fixedOf = (it: GearItem, level: number) => optionsOf(it, level).filter(o => o.line == null);
/** 무작위 옵션 한 줄의 값 (아이템 레벨 배율 포함, 재설정 후보 글자) */
export const lineValue = (it: GearItem, l: GearLine, level: number) => RANDOM_BASE * lineMax(l.stat, it.slot, it.grade) * l.roll * statMult(l.stat, it.lv, level) * (l.stat === 'hp' ? 1 : ilvBonus(it.lv));
/** 굴림 막대 채움 (0~1): 특수능력 굴림 (최소 굴림 = 0, 최대 = 1). 옵션 줄은 optFill */
export const rollFill = (roll: number) => Math.max(0, Math.min(1, (roll - ROLL_MIN) / (1 - ROLL_MIN)));

/** 장비 한 개가 보태는 능력치 (옵션 줄 합, 내 레벨 기준). 없으면 모두 0 */
export function itemStats(it: GearItem | null | undefined, level: number): StatSet {
  const s = noStats();
  if (!it) return s;
  for (const x of optionsOf(it, level)) s[x.stat] += x.v;
  return s;
}

/**
 * 지능 무른 상한 (2026-10-12 Lim 「장비를 끼면 힐량이 높은 느낌」): 장비 지능 합이 INT_SOFT를 넘는 몫은 INT_OVER배만 셈.
 * 악몽 권장 장비 (희귀 평균 굴림 × 1.4 = 예전 희귀 +5, 지능 약 45%)까지는 그대로라 자동 밸런스 기준이 안 바뀜
 */
export const INT_SOFT = 0.45;
export const INT_OVER = 0.5;
export const intEff = (x: number) => (x <= INT_SOFT ? x : INT_SOFT + (x - INT_SOFT) * INT_OVER);

/** 능력치 합 → 전투 능력치 (치명타 · 가속 · 인내는 합 상한까지, 34 6-4 · 지능은 무른 상한 intEff) */
export function statsToGear(s: StatSet): GearStats {
  const cap = (k: StatKey) => Math.min(s[k], STATS[k].cap ?? Infinity);
  return { heal: 1 + intEff(s.int), regen: 1 + s.spirit, haste: cap('haste'), crit: cap('crit'), hp: s.hp, endure: cap('endure') };
}

/** 착용 장비 능력치 합 (상한 전, 내 레벨 기준) */
export function equippedStats(eq: Equipped, level: number): StatSet {
  const s = noStats();
  for (const x of SLOTS) { const v = itemStats(eq[x.key], level); for (const k of STAT_KEYS) s[k] += v[k]; }
  return s;
}

/** 착용 장비 → 전투 능력치 (level = 내 레벨) */
export const gearStatsOf = (eq: Equipped, level: number): GearStats => statsToGear(equippedStats(eq, level));

/**
 * 시뮬 장비 프리셋 (data/gear GEARS)의 능력치: 6부위 모두 그 등급의 「기댓값」 장비 × 프리셋 배율 mult
 * (91: 예전 강화 배율 자리. 고급 1 · 희귀 · 영웅 1.4 = 예전 +0 · +5 · +5라 시뮬 세기 그대로).
 * 종류는 부위의 종류를 고르게, 무작위 옵션은 주 · 종류 옵션이 아닌 능력치에 고르게, 굴림은 평균 (100% = 무작위 옵션 최대값의 RANDOM_BASE, 예전 60~100% 굴림의 가운데).
 * ilv = 아이템 레벨 (그 장소 적 레벨, % 옵션 배율 pctLvMult). 지능 · 체력은 내 레벨과 같은 아이템 레벨이라 배율 1
 */
export function presetStats(grade: ItemGrade, mult: number, ilv?: number): StatSet {
  const s = noStats(), upOf = (k: StatKey) => (k === 'hp' ? 1 : mult); // 체력은 예전 강화 몫 (mult = ilvBonus 자리)을 안 곱함 (103 ③, 실제 장비와 같게)
  const m = (k: StatKey) => (isPointStat(k) ? 1 : pctLvMult(ilv)) * upOf(k);
  for (const x of SLOTS) {
    const ks = kindsOf(x.key), w = 1 / ks.length, main = MAIN_OPT[x.key];
    if (main) s[main.stat] += main.v * LINE_MULT[grade] * upOf(main.stat);
    for (const kd of ks) {
      for (const f of kindStats(kd).slice(0, kindLines(kd, grade))) s[f] += w * lineMax(f, x.key, grade) * m(f);
      const others = STAT_KEYS.filter(k => !takenStats(kd).includes(k)), n = randomLines(kd, grade);
      for (const k of others) s[k] += (w * n * lineMax(k, x.key, grade) * RANDOM_BASE * m(k)) / others.length;
    }
  }
  return s;
}

// ---------- 판매 (91, 예전 분해 자리) ----------
/** 판매 골드의 등급 값 (#172 전 분해 골드) */
export const SELL_GOLD: Record<ItemGrade, number> = { '일반': 5, '고급': 15, '희귀': 40, '영웅': 100, '전설': 250 };
/** 판매 골드 = 등급 값 × (1 + 아이템 레벨 ÷ 10) */
/** 판매가 배율 (2026-10-20 Lim 카드 「넷 다」, 103): Lv 100 악몽 판마다 판매 기대값이 약 585골드로 엔드게임 골드의 31~73%라 절반 (등급 값은 그대로) */
export const SELL_MULT = 0.5;
export const sellGold = (it: GearItem) => Math.round(SELL_GOLD[it.grade] * (1 + (it.lv ?? 1) / 10) * SELL_MULT);

// ---------- 품질 (91) ----------
export type Quality = '정교한' | '완벽한';
/** 희귀 이상, 옵션 굴림 평균 (주 · 종류 · 무작위 모든 줄)이 min 이상이면 이름 앞 작은 말 + 결과 카드 빛. 성능은 굴림 그대로 (말만 붙음) */
export const QUALITY: readonly { name: Quality; min: number }[] = [{ name: '완벽한', min: 1.45 }, { name: '정교한', min: 1.3 }];
export const QUALITY_FROM: ItemGrade = '희귀';
/** 옵션 굴림 평균 (모든 옵션 줄) */
export function rollAvg(it: GearItem): number {
  const rs = optionBase(it).map(o => o.roll);
  return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
}
export function qualityOf(it: GearItem): Quality | null {
  if (ITEM_GRADES.indexOf(it.grade) < ITEM_GRADES.indexOf(QUALITY_FROM)) return null;
  const avg = rollAvg(it);
  return QUALITY.find(q => avg >= q.min - 1e-9)?.name ?? null;
}

// ---------- 장비 점수 ----------
/**
 * 장비 점수 (34 6-7 → 91 「장비 점수 = 실제 옵션 값」): 옵션 값 ÷ 그 능력치 한 줄 기준 (STATS.max) 합 + 특수능력 줄마다 SPEC_SCORE
 * (전설 고유 능력 · 이름 있는 장신구 효과는 × 고유 능력 배율), × 아이템 레벨 배율 (내 레벨 기준, 2026-10-13 그대로).
 * 옵션 값은 그 장비의 아이템 레벨 그대로 (굴림 × ilvBonus, % 옵션의 pctLvMult는 빼고 레벨 차이는 ilvMult 하나로) → 같은 장비면 레벨과 상관없이 같은 점수라
 * 권장 장비 점수 (presetScore)가 고정. 91 전에는 등급 순위 + 강화 + 굴림이라 Lv 45 뒤 가방 ▲의 76~89%가 실제로는 약했음.
 * 권장 장비 비교 · 더 좋은 장비 · 가방 화살표 · 추천 장착 · 길잡이
 */
export const SPEC_SCORE = 1.3;
export function itemScore(it: GearItem | undefined, level: number): number {
  if (!it) return 0;
  const up = ilvBonus(it.lv), uq = it.uniqueMult ?? UNIQUE_MULT;
  const opts = optionBase(it).reduce((a, o) => a + (o.base * o.roll * (o.stat === 'hp' ? 1 : up)) / STATS[o.stat].max, 0); // 체력은 실제 값처럼 ilvBonus 없이 (103 ③)
  const specs = (it.specs ?? []).reduce((a, l) => a + SPEC_SCORE * (l.legend ? uq : 1), 0) + (it.unique ? SPEC_SCORE * uq : 0) + (it.named ? SPEC_SCORE * UNIQUE_MULT : 0);
  return (opts + specs) * ilvMult(it.lv, level);
}
export const avgScore = (eq: Equipped, level: number) => SLOTS.reduce((a, s) => a + itemScore(eq[s.key], level), 0) / SLOTS.length;
/** 프리셋 장비 (presetStats와 같은 기댓값 장비, 아이템 레벨 = 내 레벨)의 부위 평균 점수. specLines = 부위마다 특수능력 줄 수 */
export function presetScore(grade: ItemGrade, mult: number, specLines = 0): number {
  let sum = 0;
  for (const x of SLOTS) {
    // 체력 줄은 mult (예전 강화 몫 = ilvBonus 자리)를 안 곱함 (103 ③, itemScore · 실제 장비와 같게)
    let vm = 0, v1 = 0;
    const add = (stat: StatKey, val: number) => { if (stat === 'hp') v1 += val; else vm += val; };
    const ks = kindsOf(x.key), main = MAIN_OPT[x.key];
    if (main) add(main.stat, (main.v * LINE_MULT[grade]) / STATS[main.stat].max);
    for (const kd of ks) {
      for (const f of kindStats(kd).slice(0, kindLines(kd, grade))) add(f, lineMax(f, x.key, grade) / STATS[f].max / ks.length);
      const others = STAT_KEYS.filter(k => !takenStats(kd).includes(k)), n = randomLines(kd, grade);
      for (const k of others) add(k, (n * RANDOM_BASE * lineMax(k, x.key, grade)) / STATS[k].max / others.length / ks.length);
    }
    sum += vm * mult + v1 + specLines * SPEC_SCORE;
  }
  return sum / SLOTS.length;
}

/**
 * 권장 장비 (02 2-2, 13): 어려움 = 고급, 악몽 = 희귀 (91: 예전 「희귀 +5」 = 희귀 평균 굴림 × 1.4, 시뮬 프리셋 data/gear GEARS rare5와 같은 세기).
 * score = 그 프리셋 장비 점수 (presetScore, 같은 장비 상태면 예전과 같은 판정). 미달이면 경고만 (입장은 허용)
 */
export const RECOMMENDED: Record<DiffName, { label: string; score: number } | null> = {
  '쉬움': null,
  '보통': null,
  '어려움': { label: '고급', score: presetScore('고급', 1) },
  '악몽': { label: '희귀', score: presetScore('희귀', 1.4) },
};
/**
 * 그 장소 · 난이도의 권장 장비. 순차 레벨링 구간 (70, 장소 Lv 20까지 탐험 · 던전)은 없음: 어려움 · 악몽을 그 난이도가 처음 열린
 * 플레이어의 드롭 장비로 맞춤 (sim/ramp, 2026-10-13 Lim 「Lv 1 어려움이 자동 힐로 안 깨짐」)
 */
export const recommendedFor = (c: ContentDef, d: DiffName) => (rampPlace(c) ? null : RECOMMENDED[d]);
