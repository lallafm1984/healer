/**
 * 힐러 장비 아이템 (02 10장, 34 6장 v0.3). 6부위, 부위마다 종류 5개 (종류마다 고정 옵션 1~2개, 34 6-10), 등급 5단계, 클리어 때 랜덤 1개.
 * 장소에서 나온 장비는 그 장소 세력의 생김새 (이름 · 그림, 성능 같음), 고유 무기 · 방어구 (data/uniques) · 이름 있는 장신구는 전설만.
 * 한 장비 = 옵션 (능력치 줄) 일반 1 · 고급 2 · 희귀 3 · 영웅 4 · 전설 4줄 (Lim 2026-10-11): 주 옵션 (무기 · 머리 · 손 지능, 몸통 체력) → 종류 옵션 → 무작위 옵션.
 * 주 옵션 · 종류 옵션은 굴림 없음, 무작위 옵션은 60~100% 굴림. 장신구는 주 옵션이 없어 종류 옵션부터.
 * 특수능력은 옵션과 따로: 고급 가끔 · 희귀 · 영웅 1줄, 전설은 고유 능력 1줄 (특수능력 1.5배 또는 고유 장비 · 이름 있는 장신구 효과).
 * 강화 +1~+10 (확률, +2 이상에서 실패하면 1단계 떨어짐, 34 6-5 · 12 3-2) · 분해 (골드 + 강화석, 12 3-1). 떨어지는 장비는 모두 +0.
 */
import type { DiffName } from './difficulty';
import type { GearStats, GradeName } from './gear';
import type { HeroKey } from './heroes';
import { CONTENT_PLACE, FACTIONS, PLACES, type FactionKey } from './places';
import { FEATURED, namedOf, namedsFor, SPEC_KEYS, SPECS, specTotals, specValue, type SpecLine, type SpecOn } from './specials';
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

/** 등급 색 (02 10-1) + 글자 표시 (색만으로 구분하지 않기, 09 5장) */
export const GRADE_STYLE: Record<ItemGrade, { color: string; word: string }> = {
  '일반': { color: '#C8C8C8', word: '낡은' },
  '고급': { color: '#3FD85A', word: '튼튼한' },
  '희귀': { color: '#4A9BFF', word: '축복받은' },
  '영웅': { color: '#BE6EFF', word: '성스러운' },
  '전설': { color: '#FF962E', word: '전설의' },
};

// ---------- 능력치 · 종류 · 옵션 (34 6-2 ~ 6-5) ----------
/** 장비 능력치 6가지: 지능 (치유 회복량) · 체력 (내 최대 체력) · 치명타 · 가속 · 정신력 (마나 재생) · 인내 (내가 받는 피해 감소) */
export type StatKey = 'int' | 'hp' | 'crit' | 'haste' | 'spirit' | 'endure';
export const STAT_KEYS: StatKey[] = ['int', 'hp', 'crit', 'haste', 'spirit', 'endure'];
/** 추가 옵션 한 줄의 영웅 최대값 (34 6-4) · 합 상한 */
export const STATS: Record<StatKey, { name: string; max: number; cap?: number }> = {
  int: { name: '지능', max: 0.05 },
  hp: { name: '체력', max: 0.07 },
  crit: { name: '치명타', max: 0.04, cap: 0.5 },
  haste: { name: '가속', max: 0.05, cap: 0.5 },
  spirit: { name: '정신력', max: 0.08 },
  endure: { name: '인내', max: 0.03, cap: 0.3 },
};
/** 특수능력 등급 배율 (34 6-3, data/specials specValue) */
export const GRADE_MULT: Record<ItemGrade, number> = { '일반': 0.4, '고급': 0.6, '희귀': 0.8, '영웅': 1, '전설': 1.2 };
/** 등급별 옵션 줄 수 (Lim 2026-10-11 「일반 1 · 고급 2 · 희귀 3 · 영웅 4 · 전설 4 + 고유 능력」): 종류 옵션 + 무작위 옵션 */
export const OPTION_LINES: Record<ItemGrade, number> = { '일반': 1, '고급': 2, '희귀': 3, '영웅': 4, '전설': 4 };
/** 옵션 한 줄 등급 배율: 등급마다 줄이 늘어서 한 줄 값은 조금씩만 오름 (고급 · 희귀 장비 전체 세기는 예전과 비슷하게, 시뮬 프리셋 adv0 · rare5) */
export const LINE_MULT: Record<ItemGrade, number> = { '일반': 0.7, '고급': 0.8, '희귀': 0.85, '영웅': 1, '전설': 1.2 };
/**
 * 주 옵션 (예전 주 능력치, 34 6-5): 무기 · 머리 · 손 = 지능, 몸통 = 체력, 장신구는 없음. 옵션 첫 줄, 값 = 영웅 +0 (× 등급 배율), 굴림 없음.
 * 예전 방어구 칸마다 지능 + 체력을 머리 · 손 지능, 몸통 체력으로 나눔
 */
export const MAIN_OPT: Partial<Record<SlotKey, { stat: StatKey; v: number }>> = { weapon: { stat: 'int', v: 0.12 }, head: { stat: 'int', v: 0.1 }, hands: { stat: 'int', v: 0.1 }, chest: { stat: 'hp', v: 0.18 } };
/** 종류 · 무작위 옵션 한 줄 부위 배율: 무기 · 방어구는 줄 수가 주 옵션만큼 적어서 한 줄이 큼 (영웅 장비 부위 세기는 예전과 같게) */
export const SLOT_MULT: Record<SlotGroup, number> = { weapon: 1.3, armor: 1.3, acc: 1 };
/** 무작위 옵션 굴림: 그 줄 최대값의 ROLL_MIN ~ 100% */
export const ROLL_MIN = 0.6;
/** 강화 1단계마다 주 옵션 (장신구는 종류 옵션) +8% (34 6-5, +10 = ×1.8). 무작위 옵션은 각성으로 오름 */
export const PLUS_STEP = 0.08;

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

/** 무작위 옵션 한 줄. roll = 그 줄 최대값 대비 굴림 (0.6~1), up = 옵션 각성으로 더해진 값 (34 6-5, 비율) */
export interface GearLine { stat: StatKey; roll: number; up?: number }
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
/** 종류 · 무작위 옵션 한 줄 최대값 (굴림 1, 강화 · 각성 전): 능력치 기준값 × 부위 배율 × 등급 배율 */
export const lineMax = (stat: StatKey, slot: SlotKey, grade: ItemGrade) => STATS[stat].max * SLOT_MULT[groupOf(slot)] * LINE_MULT[grade];

/**
 * 등급 확률 (61 3장, 2026-10-11 Lim). 순서 = ITEM_GRADES. 0 = 레벨링 (탐험 · 던전), 10 · 20 = 레이드 인원.
 * 탐험 · 던전: 쉬움 일반 · 보통 고급까지 · 어려움 희귀까지 · 악몽 영웅까지.
 * 10인 · 20인: 쉬움 · 보통 희귀까지 · 어려움 영웅까지 · 악몽은 10인 영웅 (확률 높게) · 20인만 전설.
 */
export const DROP_TABLES: Record<0 | 10 | 20, Record<DiffName, number[]>> = {
  0: {
    '쉬움': [1, 0, 0, 0, 0],
    '보통': [0.6, 0.4, 0, 0, 0],
    '어려움': [0.15, 0.55, 0.3, 0, 0],
    '악몽': [0, 0.35, 0.5, 0.15, 0],
  },
  10: {
    '쉬움': [0, 0.6, 0.4, 0, 0],
    '보통': [0, 0.3, 0.7, 0, 0],
    '어려움': [0, 0, 0.75, 0.25, 0],
    '악몽': [0, 0, 0.5, 0.5, 0],
  },
  20: {
    '쉬움': [0, 0.5, 0.5, 0, 0],
    '보통': [0, 0.2, 0.8, 0, 0],
    '어려움': [0, 0, 0.65, 0.35, 0],
    '악몽': [0, 0, 0.35, 0.55, 0.1],
  },
};
/** 그 콘텐츠 · 난이도 등급 확률 (raid = 레이드 인원, 0 = 탐험 · 던전) */
export const dropTable = (diff: DiffName, raid: 0 | 10 | 20 = 0): number[] => DROP_TABLES[raid][diff];
/** 표에서 나올 수 있는 가장 높은 등급 (상한) */
export const topGrade = (table: number[]): ItemGrade => ITEM_GRADES[table.reduce((m, p, i) => (p > 0 ? i : m), 0)];

/** 클리어 등급이 높을수록 상위 등급 확률 소폭↑ (02 10-4): 굴린 값을 이만큼 위로 민다 */
export const GRADE_BONUS: Record<'S' | 'A' | 'B' | 'C', number> = { S: 0.05, A: 0.02, B: 0, C: 0 };
/** 공개모집 일일 보너스 판 (13 2-2): 굴린 값을 이만큼 더 위로 (그 난이도 상한은 그대로, 61 3-3) */
export const PUB_GRADE_BONUS = 0.25;

/** 전설은 Lv 50부터 드롭 (02 10-1). 20인 악몽이 Lv 80부터라 실제론 그 전에 안 나옴 (61 3장) */
export const LEGEND_LEVEL = 50;

export interface GearItem {
  id: number;
  slot: SlotKey;
  /** 종류 키 (KINDS). 옛 저장엔 없음 → migrate가 그 부위 첫 종류로 */
  kind: string;
  grade: ItemGrade;
  /** 강화 단계 (0~10) */
  plus: number;
  name: string;
  /** 무작위 옵션 (옵션 줄 수 − 종류 옵션, 종류 옵션 · 서로 겹치지 않음) */
  lines: GearLine[];
  /** 특수능력 줄 (42): 일반 0 · 고급 0~1 · 희귀 1 · 영웅 1 · 전설 = 고유 능력 1 (legend). 옛 저장엔 없음 → migrate가 굴림 */
  specs?: SpecLine[];
  /** 이름 있는 장신구 (42 3장, 전설만): 고유 효과 키 = 고유 능력. 이름도 그 장신구 이름 */
  named?: string;
  /** 고유 무기 · 방어구 (34 6-10 ③, data/uniques, 전설만): 키. 이름도 그 장비 이름, 고정 특수능력 1.5배 = 고유 능력 */
  unique?: string;
  /** 세력 생김새 (34 6-10 ②): 떨어진 장소의 세력. 이름에 세력 말이 붙고 그림이 다름 (성능 같음). 옛 저장 · 상점 · 임무 장비는 없음 */
  look?: FactionKey;
  /** 잠금 (27 4-3): 분해 고르기·일괄 분해에서 빠짐. 옛 저장엔 없음 = 안 잠김 */
  lock?: boolean;
  /** 이 장비에서 재설정한 횟수 (34 6-8, 할수록 비쌈). 옛 저장엔 없음 = 0 */
  rr?: number;
  /** 강화로 처음 닿은 가장 높은 단계 (옵션 각성은 처음 닿을 때만, 34 6-5). 옛 저장엔 없음 = 지금 단계 */
  top?: number;
}

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
/** 생김새 색 (세력 색): 그림이 없는 생김새는 종류 그림 + 이 색 테두리 */
export const lookColor = (f: FactionKey) => FACTIONS[f].color;

/** 이름: 등급 말 + (세력 말) + 종류 (「축복받은 두건」 · 「축복받은 산호 두건」). 이름 있는 장신구 · 고유 장비는 그 이름 (「녹슨 톱니」) */
export const itemName = (it: { slot: SlotKey; kind?: string; grade: ItemGrade; named?: string; unique?: string; look?: FactionKey }) =>
  namedOf(it.named)?.name ?? uniqueOf(it.unique)?.name ?? [GRADE_STYLE[it.grade].word, it.look ? LOOK_WORD[it.look] : '', kindOf(it).name].filter(Boolean).join(' ');

/** 무작위 옵션 n줄: 주 옵션 · 종류 옵션과 다른 능력치에서 서로 다르게 (fixed = 안 나오는 능력치, takenStats), 값은 ROLL_MIN~1 굴림 */
export function rollLines(r: () => number, n: number, fixed: readonly StatKey[]): GearLine[] {
  const pool = STAT_KEYS.filter(k => !fixed.includes(k)), out: GearLine[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const stat = pool.splice(Math.floor(r() * pool.length), 1)[0];
    out.push({ stat, roll: Math.round((ROLL_MIN + (1 - ROLL_MIN) * r()) * 100) / 100 });
  }
  return out;
}

// ---------- 특수능력 줄 (42 1장) ----------
/** 등급마다 특수능력 줄 수 (42 1-1). 고급은 SPEC_ADV 확률로 1줄, 전설은 고유 능력 1줄 */
export const SPEC_LINES: Record<ItemGrade, number> = { '일반': 0, '고급': 1, '희귀': 1, '영웅': 1, '전설': 1 };
export const SPEC_ADV = 0.2;
/** 장소마다 자주 나오는 특수능력은 이만큼 잘 나옴 (42 1-4) */
export const FEATURED_WEIGHT = 4;
/** 고유 능력 (Lim 2026-10-11 「전설에만 고유 능력」): 전설만. 그 장소 · 부위 고유 장비 · 이름 있는 장신구가 있으면 이 확률로 그것 (42 3장) */
export const NAMED_CHANCE = 0.25;
export const LEGEND: ItemGrade = '전설';
/** 전설 고유 능력 값: 그 등급 최대 굴림 × UNIQUE_MULT (고유 장비와 같음). 값 고정 특수능력은 그대로 */
export const legendValue = (key: string, grade: ItemGrade) => (SPECS[key]?.fixed ? SPECS[key].val : specValue(key, grade, 1) * UNIQUE_MULT);

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
  fest1: ['wreath'], fest2: ['pendant'], fest3: ['robe'],
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
 * 레이드 인원 (등급 표, 61 3장. 없으면 탐험 · 던전 표) · 공개모집 보너스 판 · 등급 상한 (따로 줄 때만)
 */
export interface DropCtx { hero?: HeroKey; place?: string; raid?: 0 | 10 | 20; bonus?: boolean; cap?: ItemGrade }

/**
 * 특수능력 n줄 굴림: 그 부위 · 최소 등급 이하 · (직업 전용은 그 직업) 중에서, 장소의 자주 나오는 3개는 4배.
 * 한 장비에 같은 묶음은 한 번만 (같은 특수능력 · 직업 전용 2줄도 안 나옴). 값 고정이면 굴림 1
 */
export function rollSpecs(r: () => number, slot: SlotKey, grade: ItemGrade, n: number, o: DropCtx = {}, taken: string[] = []): SpecLine[] {
  const gi = ITEM_GRADES.indexOf(grade), feat = (o.place && FEATURED[o.place]) || [];
  const out: SpecLine[] = [], groups = new Set(taken.map(k => SPECS[k]?.group));
  for (let i = 0; i < n; i++) {
    const pool = SPEC_KEYS.filter(k => {
      const d = SPECS[k];
      return d.slots.includes(slot) && ITEM_GRADES.indexOf(d.min) <= gi && (!d.hero || d.hero === o.hero) && !groups.has(d.group);
    });
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

/** 등급만큼 특수능력 줄 수 (고급은 확률) */
export const specCount = (r: () => number, grade: ItemGrade): number => (grade === '고급' ? (r() < SPEC_ADV ? 1 : 0) : SPEC_LINES[grade]);

/**
 * 부위 · 등급이 정해진 장비 1개 (종류 · 무작위 옵션 · 특수능력 굴림). kind를 주면 그 종류. o = 드롭 맥락 (직업 · 장소).
 * 전설은 고유 능력 1줄: 장소에 그 부위 고유 장비 · 이름 있는 장신구가 있으면 NAMED_CHANCE로 그것, 아니면 특수능력 하나를 1.5배로.
 * 고유 장비 · 이름 있는 장신구가 아니면 그 장소 세력 생김새
 */
export function makeItem(r: () => number, slot: SlotKey, grade: ItemGrade, id: number, kind?: string, o: DropCtx = {}): GearItem {
  const legend = grade === LEGEND;
  // 고유 무기 · 방어구 (34 6-10 ③): 종류가 정해져 있고, 고정 특수능력이 고유 능력
  const uns = legend && o.place ? uniquesFor(o.place, slot) : [];
  const un = uns.length && r() < NAMED_CHANCE ? uns[Math.floor(r() * uns.length)] : undefined;
  const isUnique = !!un;
  const ks = kindsOf(slot), k = (isUnique ? ks.find(x => x.key === un!.kind) : ks.find(x => x.key === kind)) ?? ks[Math.floor(r() * ks.length)];
  const it: GearItem = { id, slot, kind: k.key, grade, plus: 0, name: '', lines: rollLines(r, randomLines(k, grade), takenStats(k)), specs: [] };
  // 이름 있는 장신구 (42 3장): 고유 효과가 고유 능력
  const nms = legend && o.place ? namedsFor(o.place, slot) : [];
  if (isUnique) it.unique = un!.key;
  else if (nms.length && r() < NAMED_CHANCE) it.named = nms[Math.floor(r() * nms.length)].key;
  else {
    it.specs = legend ? rollSpecs(r, slot, grade, 1, o).map(l => ({ key: l.key, roll: 1, legend: true as const })) : rollSpecs(r, slot, grade, specCount(r, grade), o);
    const look = lookOf(o.place);
    if (look) it.look = look;
  }
  it.name = itemName(it);
  return it;
}

/** 특수능력 한 줄 값 (전설 고유 능력은 1.5배) */
export const specLineValue = (it: GearItem, l: SpecLine) => (l.legend ? legendValue(l.key, it.grade) : specValue(l.key, it.grade, l.roll));

/**
 * 출전 전 보상 팝업 (61 3-4): 그 장소에서 상한 등급 (top)까지 나올 수 있는 고유 장비 · 이름 있는 장신구. makeItem과 같은 조건으로 읽음
 * (나오는 등급 조건을 바꾸면 여기도 같이)
 */
export function placeSpecials(place: string, top: ItemGrade): { name: string; slot: SlotKey; min: ItemGrade; unique: boolean }[] {
  const ti = ITEM_GRADES.indexOf(top), out: { name: string; slot: SlotKey; min: ItemGrade; unique: boolean }[] = [];
  for (const s of SLOTS) {
    if (ti < ITEM_GRADES.indexOf(LEGEND)) continue; // 전설만 (Lim 2026-10-11 「전설에만 고유 능력」)
    for (const un of uniquesFor(place, s.key)) out.push({ name: un.name, slot: s.key, min: LEGEND, unique: true });
    for (const nm of namedsFor(place, s.key)) out.push({ name: nm.name, slot: s.key, min: LEGEND, unique: false });
  }
  return out;
}

/** 장비 한 개의 특수능력 값 (이름 있는 장신구 고유 효과 · 고유 장비 고정 특수능력 + 줄마다 값) */
export function itemSpecs(it: GearItem | null | undefined): SpecOn[] {
  if (!it) return [];
  const out: SpecOn[] = [];
  const nm = namedOf(it.named), un = uniqueOf(it.unique);
  if (nm) out.push({ key: nm.key, v: nm.val });
  if (un) out.push({ key: un.spec, v: uniqueValue(un, it.grade) });
  for (const l of it.specs ?? []) out.push({ key: l.key, v: specLineValue(it, l) });
  return out;
}

/** 장비 한 개의 특수능력 · 이름 있는 장신구 키 (도감용, 고유 장비는 고정 특수능력) */
export const specKeysOf = (it: GearItem): string[] => [...(it.named ? [it.named] : []), ...(uniqueOf(it.unique) ? [uniqueOf(it.unique)!.spec] : []), ...(it.specs ?? []).map(l => l.key)];

/** 착용 장비 → 전투에서 켜지는 특수능력 값 (42 1-3 · 1-5) */
export const specsOf = (eq: Equipped, hero: HeroKey): Record<string, number> => specTotals(SLOTS.flatMap(s => itemSpecs(eq[s.key])), hero);

/** 등급 굴림 (02 10-4 · 61 3장): 클리어 등급 (+ 공개모집 보너스)만큼 위로 밀고, 표에 있는 가장 높은 등급까지만. 전설은 Lv 50부터 */
export function rollGrade(r: () => number, table: number[], grade: 'S' | 'A' | 'B' | 'C', level: number, bonus = 0): ItemGrade {
  let x = Math.min(0.999999, r() + GRADE_BONUS[grade] + bonus);
  let gi = 0;
  for (; gi < table.length - 1; gi++) {
    if (x < table[gi]) break;
    x -= table[gi];
  }
  const top = ITEM_GRADES.indexOf(topGrade(table));
  const g = ITEM_GRADES[Math.min(gi, top)];
  return g === '전설' && level < LEGEND_LEVEL ? '영웅' : g;
}

/**
 * 장비 1개 뽑기 (부위 → 등급 → 종류 · 옵션 · 특수능력, 장소에 잘 나오는 종류가 있으면 부위 · 종류 함께). r = 0~1 난수 함수,
 * o = 드롭 맥락 (직업 · 장소 · 레이드 인원 · 공개모집 보너스)
 */
export function rollItem(r: () => number, diff: DiffName, grade: 'S' | 'A' | 'B' | 'C', level: number, id: number, o: DropCtx = {}): GearItem {
  const k = o.place && PLACE_KINDS[o.place] ? pickKind(r, o.place) : undefined;
  const slot = k ? k.slot : SLOTS[Math.floor(r() * SLOTS.length)].key;
  const g = rollGrade(r, dropTable(diff, o.raid ?? 0), grade, level, o.bonus ? PUB_GRADE_BONUS : 0);
  return makeItem(r, slot, o.cap && ITEM_GRADES.indexOf(g) > ITEM_GRADES.indexOf(o.cap) ? o.cap : g, id, k?.key, o);
}

// ---------- 재설정 (34 6-8 · 42 1-6) ----------
/** 재설정이 열리는 레벨 (계정 최고 직업 레벨), 후보 2개 중 고르기 */
export const REROLL_LEVEL = 50;
export const REROLL_PICK_LEVEL = 60;
/** 추가 옵션 한 줄 재설정 골드 (등급 기본값 = 강화 기본값 × 25). 같은 장비에서 할 때마다 기본값만큼 더 비쌈 */
export const REROLL_GOLD: Record<ItemGrade, number> = { '일반': 75, '고급': 125, '희귀': 250, '영웅': 500, '전설': 1000 };
/** 특수능력 재설정은 골드 · 정제 강화석 3배 (42 1-6) */
export const SPEC_REROLL_MULT = 3;
export function rerollCost(it: GearItem, spec: boolean): { gold: number; refined: number } {
  const m = spec ? SPEC_REROLL_MULT : 1;
  return { gold: REROLL_GOLD[it.grade] * (1 + (it.rr ?? 0)) * m, refined: m };
}
/** 무작위 옵션 i번 줄 다시 굴림: 종류 옵션 (둘 다) · 다른 줄과 다른 능력치 (지금 능력치도 나올 수 있음), 각성 값은 사라짐 */
export function rerollLine(r: () => number, it: GearItem, i: number): GearLine {
  const fx = takenStats(kindOf(it)), others = it.lines.filter((_, j) => j !== i).map(l => l.stat);
  const pool = STAT_KEYS.filter(k => !fx.includes(k) && !others.includes(k));
  return { stat: pool[Math.floor(r() * pool.length)], roll: Math.round((ROLL_MIN + (1 - ROLL_MIN) * r()) * 100) / 100 };
}
/** 특수능력 i번 줄 다시 굴림: 같은 묶음 · 그 부위 · 등급 안에서 (직업 전용은 같은 직업), 다른 줄과 겹치지 않게. 지금 특수능력도 나올 수 있음 (값만 바뀜). 고유 능력은 고유 능력 그대로 (1.5배) */
export function rerollSpec(r: () => number, it: GearItem, i: number): SpecLine {
  if (it.specs![i].legend) {
    const k = rerollSpec(r, { ...it, specs: it.specs!.map((l, j) => (j === i ? { key: l.key, roll: l.roll } : l)) }, i).key;
    return { key: k, roll: 1, legend: true };
  }
  const cur = SPECS[it.specs![i].key], gi = ITEM_GRADES.indexOf(it.grade), others = it.specs!.filter((_, j) => j !== i).map(l => l.key);
  const pool = SPEC_KEYS.filter(k => {
    const d = SPECS[k];
    return d.group === cur.group && d.hero === cur.hero && d.slots.includes(it.slot) && ITEM_GRADES.indexOf(d.min) <= gi && !others.includes(k);
  });
  const d = SPECS[pool[Math.floor(r() * pool.length)]];
  return { key: d.key, roll: d.fixed ? 1 : Math.round((ROLL_MIN + (1 - ROLL_MIN) * r()) * 100) / 100 };
}

/** 능력치 6가지 (비율) */
export type StatSet = Record<StatKey, number>;
export const noStats = (): StatSet => ({ int: 0, hp: 0, crit: 0, haste: 0, spirit: 0, endure: 0 });

/** 주 옵션 · 종류 옵션 값 (굴림 없음): 주 옵션은 부위 값 × 등급 배율, 종류 옵션은 그 줄 최대값. 강화는 주 옵션 (장신구는 종류 옵션)에 (34 6-5) */
export function fixedOf(it: GearItem): { stat: StatKey; v: number }[] {
  const k = kindOf(it), up = 1 + PLUS_STEP * it.plus, main = MAIN_OPT[it.slot];
  return [
    ...(main ? [{ stat: main.stat, v: main.v * LINE_MULT[it.grade] * up }] : []),
    ...kindStats(k).slice(0, kindLines(k, it.grade)).map(stat => ({ stat, v: lineMax(stat, it.slot, it.grade) * (main ? 1 : up) })),
  ];
}
/** 굴림 막대 채움 (0~1): 최소 굴림 = 0, 최대 = 1 */
export const rollFill = (roll: number) => Math.max(0, Math.min(1, (roll - ROLL_MIN) / (1 - ROLL_MIN)));
/** 무작위 옵션 한 줄의 값 */
export const lineValue = (it: GearItem, l: GearLine) => lineMax(l.stat, it.slot, it.grade) * l.roll + (l.up ?? 0);

/** 장비 옵션 줄 (보이는 순서): 주 옵션 → 종류 옵션 → 무작위 옵션. line = it.lines 번호 (주 · 종류 옵션은 null) */
export function optionsOf(it: GearItem): { stat: StatKey; v: number; line: number | null }[] {
  return [...fixedOf(it).map(x => ({ ...x, line: null })), ...(it.lines ?? []).map((l, i) => ({ stat: l.stat, v: lineValue(it, l), line: i }))];
}

/** 장비 한 개가 보태는 능력치 (옵션 줄 합). 없으면 모두 0 */
export function itemStats(it: GearItem | null | undefined): StatSet {
  const s = noStats();
  if (!it) return s;
  for (const x of optionsOf(it)) s[x.stat] += x.v;
  return s;
}

/** 능력치 합 → 전투 능력치 (치명타 · 가속 · 인내는 합 상한까지, 34 6-4) */
export function statsToGear(s: StatSet): GearStats {
  const cap = (k: StatKey) => Math.min(s[k], STATS[k].cap ?? Infinity);
  return { heal: 1 + s.int, regen: 1 + s.spirit, haste: cap('haste'), crit: cap('crit'), hp: s.hp, endure: cap('endure') };
}

/** 착용 장비 능력치 합 (상한 전) */
export function equippedStats(eq: Equipped): StatSet {
  const s = noStats();
  for (const x of SLOTS) { const v = itemStats(eq[x.key]); for (const k of STAT_KEYS) s[k] += v[k]; }
  return s;
}

/** 착용 장비 → 전투 능력치 */
export const gearStatsOf = (eq: Equipped): GearStats => statsToGear(equippedStats(eq));

/**
 * 시뮬 장비 프리셋 (data/gear GEARS)의 능력치: 6부위 모두 그 등급 · 강화의 「기댓값」 장비.
 * 종류는 부위의 종류를 고르게, 무작위 옵션은 주 · 종류 옵션이 아닌 능력치에 고르게, 굴림은 가운데 (0.8)
 */
export function presetStats(grade: ItemGrade, plus: number): StatSet {
  const s = noStats(), mid = (ROLL_MIN + 1) / 2;
  for (const x of SLOTS) {
    const ks = kindsOf(x.key), w = 1 / ks.length, main = MAIN_OPT[x.key], up = 1 + PLUS_STEP * plus;
    if (main) s[main.stat] += main.v * LINE_MULT[grade] * up;
    for (const kd of ks) {
      for (const f of kindStats(kd).slice(0, kindLines(kd, grade))) s[f] += w * lineMax(f, x.key, grade) * (main ? 1 : up);
      const others = STAT_KEYS.filter(k => !takenStats(kd).includes(k)), n = randomLines(kd, grade);
      for (const k of others) s[k] += (w * n * lineMax(k, x.key, grade) * mid) / others.length;
    }
  }
  return s;
}

// ---------- 강화·분해 (12 3장) ----------
export const MAX_PLUS = 10;
/** 등급 기본값: 시도 한 번의 골드 = 기본값 × 목표 단계². 확률 강화라 실패 없을 때 값(10/20/40/80/160)의 ¼ (34 6-5) */
export const ENHANCE_BASE: Record<ItemGrade, number> = { '일반': 3, '고급': 5, '희귀': 10, '영웅': 20, '전설': 40 };
/** 목표 단계별 성공 확률 (34 6-5, Lim 2026-10-09: 확률 강화 · 대성공 없음). 칸 번호 = 목표 단계 */
export const ENHANCE_RATE = [0, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35];
/** 이 단계 이상인 장비가 실패하면 1단계 떨어짐 (+1에서 실패하면 그대로) */
export const ENHANCE_DROP_FROM = 2;
export interface EnhanceCost {
  gold: number; stone: number; refined: number;
  /** 성공하면 이 단계 */
  to: number;
  /** 성공 확률 (0~1) */
  rate: number;
  /** 실패하면 이 단계 (+2 이상이면 1 낮음, 아니면 그대로) */
  fail: number;
}
/** 다음 단계 강화 한 번의 비용·확률: +1~+5 강화석 목표 단계만큼, +6~+10 정제 강화석 1개. 다 올렸으면 null */
export function enhanceCost(it: GearItem): EnhanceCost | null {
  const to = it.plus + 1;
  if (to > MAX_PLUS) return null;
  return {
    gold: ENHANCE_BASE[it.grade] * to * to, stone: to <= 5 ? to : 0, refined: to > 5 ? 1 : 0, to,
    rate: ENHANCE_RATE[to], fail: it.plus >= ENHANCE_DROP_FROM ? it.plus - 1 : it.plus,
  };
}
/** 옵션 각성 (34 6-5): 이 단계에 처음 닿으면 무작위 옵션 한 줄이 그 부위 영웅 최대값의 25%만큼 오름 (등급 최대값을 넘을 수 있음) */
export const AWAKEN_AT = [3, 6, 9] as const;
export const AWAKEN_SHARE = 0.25;
export const awakenValue = (it: GearItem, l: GearLine) => lineMax(l.stat, it.slot, '영웅') * AWAKEN_SHARE;

/**
 * 「목표까지 강화」 시작 전 예상 (34 7-3): 지금 단계에서 목표까지 평균 시도 수 · 재료 (끝까지 갈 때, 떨어지면 멈춤 없이).
 * 단계 k → k+1 기대값 T_k = (1 + 실패율 × T_{k-1}) / 성공률 (+2 이상은 실패하면 한 단계 내려가서 다시), 비용도 같은 식
 */
export function enhanceForecast(it: GearItem, target: number): { tries: number; gold: number; stone: number; refined: number } {
  const t: number[] = [], g: number[] = [], s: number[] = [], f: number[] = [];
  let tries = 0, gold = 0, stone = 0, refined = 0;
  for (let k = 0; k < Math.min(target, MAX_PLUS); k++) {
    const c = enhanceCost({ ...it, plus: k })!, p = c.rate, q = 1 - p, back = k >= ENHANCE_DROP_FROM;
    t[k] = (1 + (back ? q * t[k - 1] : 0)) / p;
    g[k] = (c.gold + (back ? q * g[k - 1] : 0)) / p;
    s[k] = (c.stone + (back ? q * s[k - 1] : 0)) / p;
    f[k] = (c.refined + (back ? q * f[k - 1] : 0)) / p;
    if (k >= it.plus) { tries += t[k]; gold += g[k]; stone += s[k]; refined += f[k]; }
  }
  return { tries, gold, stone, refined };
}

/** 클리어 재료 (12 1장): 던전은 강화석 조금, 레이드는 정제 강화석도 (보스 처치). 레이드 정제 강화석은 확률 강화 · 재설정 때문에 2배 (34 6-9) */
const DIFF_STEP: Record<DiffName, number> = { '쉬움': 0, '보통': 1, '어려움': 2, '악몽': 3 };
export function clearMats(diff: DiffName, raid: 0 | 10 | 20): { stone: number; refined: number } {
  if (!raid) return { stone: 1 + DIFF_STEP[diff], refined: 0 };
  return { stone: 2 + DIFF_STEP[diff], refined: 2 * ((raid === 20 ? 2 : 1) + (diff === '악몽' ? 1 : 0)) };
}

/** 분해: 골드 (등급값 + 강화 단계당 10%), 강화석 (등급 비례), 정제 강화석 (영웅·전설). 장비가 보스마다 나와서 골드 · 강화석은 절반 (34 6-9) */
export const SALVAGE_GOLD: Record<ItemGrade, number> = { '일반': 5, '고급': 15, '희귀': 40, '영웅': 100, '전설': 250 };
export const SALVAGE_STONE: Record<ItemGrade, number> = { '일반': 1, '고급': 1, '희귀': 2, '영웅': 3, '전설': 5 };
export const SALVAGE_REFINED: Record<ItemGrade, number> = { '일반': 0, '고급': 0, '희귀': 0, '영웅': 1, '전설': 2 };
export function salvageOf(it: GearItem): { gold: number; stone: number; refined: number } {
  return { gold: Math.round(SALVAGE_GOLD[it.grade] * (1 + 0.1 * it.plus)), stone: SALVAGE_STONE[it.grade], refined: SALVAGE_REFINED[it.grade] };
}

/**
 * 장비 점수 (34 6-7): 등급 순위 + 강화/10 + 무작위 옵션 굴림 (줄마다 최소 굴림을 넘은 만큼 ¼) + 특수능력 줄 (고유 능력 포함, 줄마다 SPEC_SCORE).
 * 권장 장비 비교 · 더 좋은 장비 · 가방 화살표 · 추천 장착용
 */
export const SPEC_SCORE = 0.15;
export const itemScore = (it: GearItem | undefined) => (it ? ITEM_GRADES.indexOf(it.grade) + 1 + it.plus / 10 + (it.lines ?? []).reduce((a, l) => a + (l.roll - ROLL_MIN) / 4, 0) + SPEC_SCORE * ((it.specs?.length ?? 0) + (it.named || it.unique ? 1 : 0)) : 0);
export const avgScore = (eq: Equipped) => SLOTS.reduce((a, s) => a + itemScore(eq[s.key]), 0) / SLOTS.length;

/** 권장 장비 (02 2-2, 13): 어려움 = 고급, 악몽 = 희귀 +5. 미달이면 경고만 (입장은 허용) */
export const RECOMMENDED: Record<DiffName, { label: string; score: number } | null> = {
  '쉬움': null,
  '보통': null,
  '어려움': { label: '고급', score: 2 },
  '악몽': { label: '희귀 +5', score: 3.5 },
};

/** 지금 장비를 한 줄로 (예: "고급 3 · 일반 2 · 빈칸 1") */
export function gearSummary(eq: Equipped): string {
  const cnt = new Map<string, number>();
  for (const s of SLOTS) {
    const k = eq[s.key]?.grade ?? '빈칸';
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const order = [...[...ITEM_GRADES].reverse(), '빈칸'];
  return order.filter(k => cnt.has(k)).map(k => `${k} ${cnt.get(k)}`).join(' · ');
}
