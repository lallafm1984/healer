import type { TelKind } from '../engine/types';
import type { BoardId } from './boards';
import type { AddDown, DebuffDef, SkillEffect } from './bosses';
import type { DiffName } from './difficulty';

/** 보스 전투 (05)와 던전 일반·정예 구간 (23). 보스 기술 스크립트는 engine/bosses.ts */
export type EncounterKey = 'warden' | 'plague' | 'choir' | 'scrap' | 'gate' | 'boiler' | 'duo' | 'field' | 'patrol'
  | 'ashyard' | 'collector3' | 'reedbank' | 'shaman8' | 'bonepass' | 'collector' | 'censerhall' | 'malchor'
  | 'flowerbed' | 'butler13' | 'rotbridge' | 'shaman' | 'toad' | 'toadnest' | 'seres' | 'snowslope' | 'golem18'
  | 'parlor' | 'butler' | 'lady' | 'kennel' | 'belmore' | 'restyard' | 'guardian23'
  | 'icehall' | 'frostgolem' | 'mage' | 'frostlab' | 'shadow' | 'brokenbridge' | 'keeper28' | 'templeyard' | 'guardian' | 'nave' | 'keeper' | 'riftground' | 'plague33' | 'rubblestair' | 'sentinel' | 'blackrift' | 'crystal'
  | 'hydra' | 'twins' | 'orben' | 'abysslord'
  | 'leakyway' | 'ratking' | 'sludgegrate' | 'carrier' | 'iceread' | 'librarian' | 'forbidden' | 'scholar'
  | 'petalstair' | 'priestess' | 'keeperhall' | 'sleeper' | 'pagedrift' | 'librarian40' | 'rosetunnel' | 'priestess48'
  | 'gullsand' | 'crab36' | 'wreckage' | 'goldbeard44' | 'crab' | 'cook' | 'morel' | 'gunner' | 'octo' | 'seawitch' | 'mimic' | 'parrot' | 'goldbeard'
  | 'capway' | 'sippy52' | 'hotgravel' | 'kobold60' | 'sugarstair' | 'sippy' | 'cuptower' | 'hatter' | 'wetstair' | 'uga' | 'turtlebridge' | 'shellgod'
  | 'pollenfield' | 'queen56' | 'songi' | 'pililli' | 'ponga' | 'mungge' | 'gaegul' | 'morak' | 'bungbung' | 'ppyong' | 'amanita'
  | 'warmash' | 'mungsil64' | 'steamroom' | 'mungsil' | 'lavabath' | 'bulttung' | 'coldhearth' | 'huggeun' | 'anvilbridge' | 'ttangttang' | 'kkojil' | 'deolkeong' | 'beonjjeok'
  | 'whelps' | 'dandani' | 'rubina' | 'shoretrash' | 'knights68' | 'knights' | 'uwoong' | 'ormal'
  | 'kkubeok' | 'hokdol' | 'nyanx' | 'stairtrash' | 'heumul72' | 'heumul' | 'bichumi' | 'gipeun' | 'sandhall' | 'degul' | 'backgarden' | 'dooldool'
  | 'solsol' | 'eonggeum' | 'sarasha' | 'dunetrash' | 'pokshin76' | 'ttubeok' | 'toktok' | 'kungkung'
  | 'pokshin' | 'jjaekkak' | 'hapum' | 'ttakttak' | 'jjirit' | 'doeul' | 'windtrash' | 'hwirik' | 'startrash' | 'stargazer' | 'sundialyard' | 'geuneul'
  | 'chulleong' | 'puseok' | 'huu' | 'hwirik83' | 'kkongkkong' | 'buri' | 'sheeptrash' | 'boksul84' | 'millstairs' | 'boksul' | 'millhouse' | 'dolgae'
  | 'gulgul' | 'pingping' | 'bitgallae' | 'dungdung' | 'ssaengssaeng' | 'ureureung'
  | 'platform' | 'pongpong88' | 'upsidehall' | 'pongpong' | 'boltlab' | 'dwijuk' | 'kwangkwang' | 'syungsyung' | 'eodugi'
  | 'geumeum' | 'silta' | 'bamgeuneul' | 'jilpung' | 'ureobal' | 'chilheuk' | 'carriagetrash' | 'serena92' | 'ballhall' | 'serena' | 'balcony' | 'valen'
  | 'janmul' | 'hwigami' | 'geomeun' | 'lanterntrash' | 'nokseul96'
  | 'eongkim' | 'revlord' | 'abyssheart' | 'dawntrash' | 'heartshard100' | 'cracktrash' | 'nokseul' | 'coolroot' | 'lastshade'
  | 'heaptrash' | 'kongkong5' | 'shaft' | 'kongkong' | 'railway' | 'gurit' | 'alleytrash' | 'molly10' | 'pothall' | 'molly' | 'mushbed' | 'chingching' | 'lilypads' | 'kara15' | 'reedfence' | 'kara' | 'mudpath' | 'cheolbeok' | 'fountainwalk' | 'lavender20' | 'bottlehall' | 'lavender' | 'stillroom' | 'rose' | 'iceholes' | 'ppodeuk25' | 'toolstore' | 'ppodeuk' | 'coldstore' | 'icia' | 'sheaves' | 'jipdan30'
  | 'sacks' | 'jipdan' | 'millwheel' | 'nadal' | 'crowfield' | 'nadal34' | 'wetcave' | 'peg' | 'powder' | 'pado' | 'reefpool' | 'peg38' | 'iceflowers' | 'jiji42' | 'messhall' | 'jiji' | 'lounge' | 'eomgyeok' | 'campfire' | 'geopum46' | 'shelves' | 'geopum' | 'cauldron' | 'malos' | 'tiles' | 'malos50' | 'flourstore' | 'polpol' | 'oven' | 'monggeul' | 'dewpath' | 'polpol54' | 'mushpath' | 'poljjak58' | 'lilybridge' | 'poljjak' | 'tadpond' | 'umulluk'
  | 'scalepile' | 'ttemjil62' | 'charcoal' | 'ttemjil' | 'bellowway' | 'hwalhwal' | 'hotdock' | 'jigeul66' | 'steamcave' | 'jigeul' | 'gemvein' | 'garnet' | 'miststeps' | 'malmijal70' | 'kelphall' | 'malmijal' | 'pearlpond' | 'chalrang' | 'palmshade' | 'baseurak74' | 'sandshelf' | 'baseurak' | 'sealedstack' | 'gitpen' | 'obelisks' | 'gitpen78'
  | 'swaybridge' | 'hwiparam82' | 'glideyard' | 'hwiparam' | 'windtunnel' | 'hoeori' | 'zapgrass' | 'hoeori86' | 'floatshelf' | 'peoleok' | 'forbidstair' | 'swit' | 'startline' | 'swit90' | 'drownhall' | 'gawison' | 'thornmaze' | 'rosalin' | 'lotusstep' | 'gawison94' | 'glowpond' | 'lastecho97' | 'drillyard' | 'kalnal' | 'weaponrack' | 'heukbaek' | 'palisade' | 'kalnal98' | 'crystalstair' | 'banjjak' | 'echohall' | 'lastecho' | 'sunpath' | 'banjjak99'
  // 113 초반 보충 장소 1차 (Lv 5~8)
  | 'pressgate' | 'pressguard' | 'pressway' | 'kkuksoe' | 'leakhall' | 'pipefixer' | 'coolway' | 'chiik' | 'partshelf' | 'cutter' | 'workbench' | 'deolkeok'
  | 'darkpath' | 'huuk' | 'wailpath' | 'heuneuk' | 'soakalley' | 'eolluk' | 'ashpile' | 'puseokash'
  // 113 2차 (Lv 9~12)
  | 'waxhall' | 'waxdoll' | 'sealstore' | 'chorereu' | 'incensepass' | 'censerguard' | 'brokencase' | 'huljjeok' | 'drycanal' | 'vineguard' | 'seedbench' | 'mallim'
  | 'pollenshelf' | 'thornporter' | 'sackstore' | 'kkaseul' | 'floodhall' | 'gateshield' | 'drainway' | 'multeok' | 'sievehall' | 'clawguard' | 'cagepass' | 'kkwakjip'
  | 'bandageroad' | 'charye' | 'cartroad' | 'humchim';
export type ScriptKey = 'warden' | 'plague' | 'choir' | 'scrap' | 'trash' | 'collector3' | 'shaman8' | 'collector' | 'malchor' | 'butler13'
  | 'shaman' | 'toad' | 'seres' | 'golem18' | 'butler' | 'lady' | 'belmore' | 'guardian23'
  | 'frostgolem' | 'mage' | 'shadow' | 'keeper28' | 'guardian' | 'keeper' | 'plague33' | 'sentinel' | 'crystal'
  | 'hydra' | 'twins' | 'orben' | 'abysslord'
  | 'ratking' | 'carrier' | 'librarian' | 'scholar' | 'priestess' | 'sleeper' | 'librarian40' | 'priestess48'
  | 'crab36' | 'goldbeard44' | 'crab' | 'cook' | 'morel' | 'gunner' | 'octo' | 'seawitch' | 'mimic' | 'parrot' | 'goldbeard'
  | 'sippy52' | 'kobold60' | 'sippy' | 'hatter' | 'uga' | 'shellgod'
  | 'queen56' | 'songi' | 'pililli' | 'ponga' | 'mungge' | 'gaegul' | 'morak' | 'bungbung' | 'ppyong' | 'amanita'
  | 'mungsil64' | 'mungsil' | 'bulttung' | 'huggeun' | 'ttangttang' | 'kkojil' | 'deolkeong' | 'beonjjeok'
  | 'whelps' | 'dandani' | 'rubina' | 'knights68' | 'knights' | 'uwoong' | 'ormal'
  | 'kkubeok' | 'hokdol' | 'nyanx' | 'heumul72' | 'heumul' | 'bichumi' | 'gipeun' | 'degul' | 'dooldool'
  | 'solsol' | 'eonggeum' | 'sarasha' | 'pokshin76' | 'ttubeok' | 'toktok' | 'kungkung'
  | 'pokshin' | 'jjaekkak' | 'hapum' | 'ttakttak' | 'jjirit' | 'doeul' | 'hwirik' | 'stargazer' | 'geuneul'
  | 'chulleong' | 'puseok' | 'huu' | 'hwirik83' | 'kkongkkong' | 'buri' | 'boksul84' | 'boksul' | 'dolgae'
  | 'gulgul' | 'pingping' | 'bitgallae' | 'dungdung' | 'ssaengssaeng' | 'ureureung'
  | 'pongpong88' | 'pongpong' | 'dwijuk' | 'kwangkwang' | 'syungsyung' | 'eodugi'
  | 'geumeum' | 'silta' | 'bamgeuneul' | 'jilpung' | 'ureobal' | 'chilheuk' | 'serena92' | 'serena' | 'valen'
  | 'janmul' | 'hwigami' | 'geomeun' | 'nokseul96'
  | 'eongkim' | 'revlord' | 'abyssheart' | 'heartshard100' | 'nokseul' | 'lastshade'
  | 'kongkong5' | 'kongkong' | 'gurit' | 'molly10' | 'molly' | 'chingching' | 'kara15' | 'kara' | 'cheolbeok' | 'lavender20' | 'lavender' | 'rose' | 'ppodeuk25' | 'ppodeuk' | 'icia' | 'jipdan30'
  | 'jipdan' | 'nadal' | 'nadal34' | 'peg' | 'pado' | 'peg38' | 'jiji42' | 'jiji' | 'eomgyeok' | 'geopum46' | 'geopum' | 'malos' | 'malos50' | 'polpol' | 'monggeul' | 'polpol54' | 'poljjak58' | 'poljjak' | 'umulluk'
  | 'ttemjil62' | 'ttemjil' | 'hwalhwal' | 'jigeul66' | 'jigeul' | 'garnet' | 'malmijal70' | 'malmijal' | 'chalrang' | 'baseurak74' | 'baseurak' | 'gitpen' | 'gitpen78'
  | 'hwiparam82' | 'hwiparam' | 'hoeori' | 'hoeori86' | 'peoleok' | 'swit' | 'swit90' | 'gawison' | 'rosalin' | 'gawison94' | 'lastecho97' | 'kalnal' | 'heukbaek' | 'kalnal98' | 'banjjak' | 'lastecho' | 'banjjak99'
  // 113 초반 보충 장소 1차 (Lv 5~8)
  | 'kkuksoe' | 'chiik' | 'cutter' | 'deolkeok' | 'huuk' | 'heuneuk' | 'eolluk' | 'puseokash'
  // 113 2차 (Lv 9~12)
  | 'chorereu' | 'huljjeok' | 'vineguard' | 'mallim' | 'kkaseul' | 'multeok' | 'clawguard' | 'kkwakjip' | 'charye' | 'humchim';

/** 적 공격 (23 2장). to: tank = 탱커, other = 탱커 아닌 무작위 1명, all = 전원 */
export interface MobAttack {
  key: string;
  name?: string;
  icon?: string;
  kind?: TelKind;
  to: 'tank' | 'other' | 'all';
  dmg: number;
  /** ± 흔들림 (0.3 = ±30%) */
  jitter?: number;
  first: number;
  period: number;
  cast: number;
  /** 끊기 가능 ✋ (17 7장) */
  cut?: boolean;
  /** 맞을 때 하는 일 (보스 부품, data/bosses). 있으면 dmg 대신 이것: 세력 졸개 ③의 디버프 (39 2장) */
  effect?: SkillEffect;
}

/** 보스가 아닌 적 한 종류. 파티는 목록 순서대로 잡는다 (앞쪽부터). 화면에는 「잡몹」 대신 일반·정예 (2026-10-07 Lim) */
export interface MobDef {
  name: string;
  /** 정예: 체력이 많고 큰 기술을 씀 */
  elite?: boolean;
  hp: number;
  count: number;
  attacks: MobAttack[];
  /** 쓰러질 때 (판 위 적의 down과 같은 부품, 46 5장): 먼지 유령이 쓰러질 때마다 살아 있는 모두에게 먼지 파열 */
  down?: AddDown;
}

export interface Encounter {
  key: EncounterKey;
  name: string;
  tier: string;
  board: BoardId;
  /** 힐러를 뺀 파티 구성 */
  comp: { tank: number; melee: number; ranged: number };
  hp: number;
  /** 광폭화 시각 (초). 일반·정예 구간은 없음 */
  enrage: number;
  /** 마나 재생 배율 */
  manaCoef: number;
  diffs: DiffName[];
  script: ScriptKey;
  /** 저레벨 던전: 탱커는 ★ 성격만, ★★★ 파티당 최대 1명 (04 6-F) */
  lowLevel?: boolean;
  /** 20인 */
  big?: boolean;
  /** 화면 보스 그림 단계 구분용 */
  stage: number;
  /** 일반·정예 구간이면 적 목록 (hp = 합계) */
  mobs?: MobDef[];
  /** 거는 해제 가능 디버프 종류 (전투 탭 해제 칩·편성 경고 줄에서 지금 직업이 지울 수 있는지 표시) */
  debuffs?: string[];
}

const ALL: DiffName[] = ['쉬움', '보통', '어려움', '악몽'];
const PARTY5 = { tank: 1, melee: 1, ranged: 2 };

const CHAFF: MobDef = { name: '고철 졸개', hp: 400, count: 0, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] };

/** 적 등급 이름 (보스 전투 안의 보스 몸통은 보스) */
export const mobGrade = (m: { elite?: boolean; boss?: boolean }) => (m.boss ? '보스' : m.elite ? '정예' : '일반');
/** 구간 등급: 정예가 하나라도 있으면 정예 구간 */
export const segGrade = (e: Encounter) => (e.mobs ? (e.mobs.some(m => m.elite) ? '정예' : '일반') : '보스');

function trash(key: EncounterKey, name: string, mobs: MobDef[], o: Partial<Encounter> = {}): Encounter {
  return {
    key, name, tier: `던전 · ${mobs.some(m => m.elite) ? '정예' : '일반'}`, board: 'b10', comp: PARTY5, lowLevel: true,
    hp: mobs.reduce((s, m) => s + m.hp * m.count, 0), enrage: Infinity, manaCoef: 1.0, diffs: ALL, script: 'trash', stage: 0.25, mobs, ...o,
  };
}

/** 튜토리얼 2인 (탱 1 + 나), 탐험 3인 (탱 1 · 딜 1 + 나) — 02 11장 */
const DUO = { tank: 1, melee: 0, ranged: 0 };
const TRIO = { tank: 1, melee: 0, ranged: 1 };
/** 10인 레이드 (탱 2 · 근접 3 · 원거리 4 + 나, 26 3장) */
const RAID10 = { tank: 2, melee: 3, ranged: 4 };
/** 코볼트 연기 주술사 (51 2장): 독 → 마법 차례로 (작게) */
const KOBOLD_SMOKE: DebuffDef[] = [
  { name: '독 연기', type: '독', left: 10, dot: 12 },
  { name: '불티', type: '마법', left: 8, dot: 15 },
];
/**
 * 네 가지 청소약 (신전지기 유령, 35 4-5): 질병 → 독 → 저주 → 마법 차례로, 유형마다 대표 효과를 작게 (02 5-4).
 * 피해는 딜체 비율 (600 = bosses U.dps 기준, bosses가 이 파일을 읽으므로 여기 둠). x = 피해 배율 (탐험 0.7)
 */
export const soaps = (x = 1): DebuffDef[] => [
  { name: '황토 청소약', type: '질병', left: 12, maxCut: 0.1, end: { p: 'restoreMax' } },
  { name: '초록 청소약', type: '독', left: 12, dot: Math.round(600 * 0.02 * x) },
  { name: '보라 청소약', type: '저주', left: 10, healCut: 0.5 },
  { name: '파랑 청소약', type: '마법', left: 8, dot: Math.round(600 * 0.03 * x) },
];
/** 붕대 시종 (54 2장, 모래 왕국 ③): 질병 (초당 딜체 2%) → 저주 (받는 치유 −30%) 차례로 (작게) */
const SAND_WRAP: DebuffDef[] = [
  { name: '모래 먼지', type: '질병', left: 10, dot: 12 },
  { name: '옮은 졸음', type: '저주', left: 10, healCut: 0.3 },
];
/** 폭풍 점술사 (54 2장, 폭풍 깃털단 ③ · 묶음 F): 저주 (받는 치유 −30%) → 마법 (초당 딜체 2%) 차례로 (작게) */
const STORM_HEX: DebuffDef[] = [
  { name: '깃털 저주', type: '저주', left: 10, healCut: 0.3 },
  { name: '찌릿 구름', type: '마법', left: 10, dot: 12 },
];
/** 재채기 버섯 (48 2장, 버섯 요정단 ③): 질병 (초당 딜체 2%) → 마법 (받는 치유 −30%) 차례로. x = 피해 배율 (탐험 0.7) */
export const sneeze = (x = 1): DebuffDef[] => [
  { name: '포자 기침', type: '질병', left: 10, dot: Math.round(600 * 0.02 * x) },
  { name: '요정 장난', type: '마법', left: 10, healCut: 0.3 },
];
/**
 * 함정 술사 (59 2장, 심연의 정예 ③): 질병 → 독 → 함정 → 저주 → 마법 → 함정 차례로. 네 유형은 10초 초당 딜체 2%,
 * 함정 (그림자 덫)은 지우면 주변 칸 딜체 15%, 두면 8초 뒤 그 사람 딜체 25%. x = 피해 배율 (탐험 0.7)
 */
export const trapHex = (x = 1): DebuffDef[] => {
  const dot = Math.round(600 * 0.02 * x);
  const trap: DebuffDef = { name: '그림자 덫', type: '마법', left: 8, trap: true, end: { p: 'trapHit', dmg: Math.round(600 * 0.25 * x), burst: Math.round(600 * 0.15 * x) } };
  return [
    { name: '그림자 열병', type: '질병', left: 10, dot }, { name: '그림자 독', type: '독', left: 10, dot }, trap,
    { name: '그림자 저주', type: '저주', left: 10, dot }, { name: '그림자 봉인', type: '마법', left: 10, dot }, trap,
  ];
};
/** 네 가지 청소약을 거는 곳: 해제 4유형 모두 (신전지기 유령) */
const HEAL4 = ['질병', '독', '저주', '마법'];

export const ENCOUNTERS: Record<EncounterKey, Encounter> = {
  warden: { key: 'warden', lowLevel: true, name: '녹슨 문지기', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'warden', stage: 0.25 },
  // 10인 레이드 「심연의 탑」 1층 (05 2장). 악몽 = 공통 악몽 규칙 + 전용 패턴 (26 3-1)
  plague: { key: 'plague', name: '역병 군주', tier: '레이드 · 10인', board: 'b25', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 22000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'plague', stage: 0.18, debuffs: ['질병', '독'] },
  // 심연의 탑 2층 ~ 꼭대기 (05 3~6장, 35 5장 보강). 광폭화는 05 공통 표, 체력은 판 위 적 · 딜 0 기믹으로 늘어난 시간만큼 05 표에서 낮춤 (2층 24,000 · 4층 27,000 · 꼭대기 34,000). 꼭대기는 가장 길어서 마나 회복 1.5
  hydra: { key: 'hydra', name: '늪의 어머니 히드라', tier: '레이드 · 10인', board: 'b25', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 21000, enrage: 420, manaCoef: 1.3, diffs: ALL, script: 'hydra', stage: 0.18, debuffs: ['독'] },
  twins: { key: 'twins', name: '쌍둥이 여군주', tier: '레이드 · 10인', board: 'b25', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 26000, enrage: 450, manaCoef: 1.3, diffs: ALL, script: 'twins', stage: 0.18, debuffs: ['저주'] },
  orben: { key: 'orben', name: '대마도사 오르벤', tier: '레이드 · 10인', board: 'b25', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 20000, enrage: 450, manaCoef: 1.3, diffs: ALL, script: 'orben', stage: 0.18, debuffs: ['마법'] },
  abysslord: { key: 'abysslord', name: '심연의 군주', tier: '레이드 · 10인', board: 'b25', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 28000, enrage: 510, manaCoef: 1.5, diffs: ALL, script: 'abysslord', stage: 0.18, debuffs: ['질병', '독', '저주', '마법'] },
  // 20인 레이드 「가라앉은 대성당」 1구역 (26 4-3): 성가대원 4,000 × 3 + 지휘자 30,000
  choir: { key: 'choir', name: '유령 성가대', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 42000, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'choir', big: true, stage: 0.13, debuffs: ['마법'] },
  // 녹슨 요새 (23). 첫 보스 = 문지기를 순하게 줄인 판
  scrap: { key: 'scrap', lowLevel: true, name: '고철 경비병', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 2500, enrage: 150, manaCoef: 1.0, diffs: ALL, script: 'scrap', stage: 0.25 },
  gate: trash('gate', '무너진 정문', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  boiler: trash('boiler', '증기 보일러실', [
    { ...CHAFF, count: 2 },
    {
      name: '보일러 골렘', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '증기 폭발', icon: '증기', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ]),
  // 첫 전투 (2인): 졸개 둘이 탱커만 때림. 힐 없이는 탱커가 쓰러지지만 치유 몇 번이면 버팀
  duo: trash('duo', '녹슨 고원 입구', [{ ...CHAFF, hp: 100, count: 2 }], { tier: '튜토리얼 · 2인', board: 'b7', comp: DUO, stage: 0.3 }),
  // 탐험 「녹슨 고원」 3인: 일반 → 고철 순찰병 (경비병 기술을 작게)
  field: trash('field', '고원 길목', [
    { ...CHAFF, hp: 150, count: 2 },
    { name: '잔해 투척병', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 70, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  patrol: { key: 'patrol', lowLevel: true, name: '고철 순찰병', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1500, enrage: 150, manaCoef: 1.0, diffs: ALL, script: 'scrap', stage: 0.3 },
  // 탐험 ② 「잿빛 공동묘지」 (39 1-1, Lv 3): 되살아난 뼈 ×2 + 교단 신도 (부패, 첫 해제) → 뼈다귀 수집가 (끌어당김 예습, 35 4-8)
  ashyard: trash('ashyard', '잿빛 묘역', [
    { name: '되살아난 뼈', hp: 150, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병'] }),
  collector3: { key: 'collector3', lowLevel: true, name: '뼈다귀 수집가', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1700, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'collector3', stage: 0.3 },
  // 탐험 ③ 「늪지 어귀」 (39 1-1, Lv 8): 늪 창병 ×2 + 진흙 투석꾼 → 늪 주술사 (완치 표식 예습, 35 4-8). 독은 사제가 못 지움 → 힐로 버팀
  reedbank: trash('reedbank', '갈대 물가', [
    { name: '늪 창병', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '진흙 투석꾼', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 85, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  shaman8: { key: 'shaman8', lowLevel: true, name: '늪 주술사', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1800, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'shaman8', stage: 0.3, debuffs: ['독'] },
  // 탐험 ④ 「백합 정원」 (39 1-1, Lv 13): 빈 갑옷 시종 ×2 + 검은 베일 조문객 (받는 치유 −50% 저주) → 집사 유령 (차례 예습, 35 4-8)
  flowerbed: trash('flowerbed', '시든 화단', [
    { name: '빈 갑옷 시종', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 베일 조문객', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '검은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '검은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['저주'] }),
  butler13: { key: 'butler13', lowLevel: true, name: '집사 유령', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2000, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'butler13', stage: 0.3 },
  // 던전 ② 「역병 지하묘지」 (39 1-2, Lv 10, 35 4-1): 일반 뼈 쌓인 통로 → 뼈다귀 수집가 → 정예 향로 예배실 → 역병 사제 말코어
  bonepass: trash('bonepass', '뼈 쌓인 통로', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  collector: { key: 'collector', lowLevel: true, name: '뼈다귀 수집가', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 3400, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'collector', stage: 0.25, debuffs: ['질병'] },
  censerhall: trash('censerhall', '향로 예배실', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
    {
      name: '부리 가면 집행자', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'shout', name: '병든 외침', icon: '외침', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병'] }),
  malchor: { key: 'malchor', lowLevel: true, name: '역병 사제 말코어', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5900, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'malchor', stage: 0.25, debuffs: ['질병'] },
  // 탐험 ⑤ 「눈보라 고개」 (39 1-1, Lv 18): 얼음 룬 인형 ×2 + 떠도는 주술서 (침묵, 딜 0 마법) → 마력 골렘 (진동 예습, 35 4-8)
  snowslope: trash('snowslope', '눈 덮인 비탈', [
    { name: '얼음 룬 인형', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['마법'] }),
  golem18: { key: 'golem18', lowLevel: true, name: '마력 골렘', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2200, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'golem18', stage: 0.3 },
  // 탐험 ⑥ 「해바라기 언덕길」 (39 1-1, Lv 23): 돌 수도사 ×2 + 다락 박쥐 떼 → 신전 수호상 (무력화 예습, 게이지는 3인 딜로, 35 4-8)
  restyard: trash('restyard', '순례자 쉼터', [
    { name: '돌 수도사', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '다락 박쥐 떼', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  guardian23: { key: 'guardian23', lowLevel: true, name: '신전 수호상', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2400, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'guardian23', stage: 0.3, debuffs: ['마법'] },
  // 던전 ③ 「독안개 늪」 (39 1-2, Lv 15, 35 4-2): 일반 썩은 나무다리 → 늪 주술사 → 거대 두꺼비 부글이 → 정예 독 혹 둥지 → 늪 족장 세레스
  rotbridge: trash('rotbridge', '썩은 나무다리', [
    { name: '늪 창병', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '진흙 투석꾼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  shaman: { key: 'shaman', lowLevel: true, name: '늪 주술사', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 3400, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'shaman', stage: 0.25, debuffs: ['독'] },
  toad: { key: 'toad', lowLevel: true, name: '거대 두꺼비 부글이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5100, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'toad', stage: 0.25, debuffs: ['독'] },
  toadnest: trash('toadnest', '독 혹 둥지', [
    { name: '늪 창병', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '독침 사냥꾼', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sting', name: '독침', icon: '독침', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 10, dot: 9, stackMax: 3 } } },
    ] },
    {
      name: '독 혹 두꺼비', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '독 혹 터뜨리기', icon: '독혹', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독'] }),
  seres: { key: 'seres', lowLevel: true, name: '늪 족장 세레스', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'seres', stage: 0.25, debuffs: ['독'] },
  // 던전 ④ 「저주받은 장원」 (39 1-2, Lv 20, 35 4-3): 일반 먼지 낀 응접실 → 집사 유령 → 초상화 속 귀부인 → 정예 사냥개 우리 → 장원 주인 벨모어 경
  parlor: trash('parlor', '먼지 낀 응접실', [
    { name: '빈 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  butler: { key: 'butler', lowLevel: true, name: '집사 유령', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4700, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'butler', stage: 0.25, debuffs: ['저주'] },
  lady: { key: 'lady', lowLevel: true, name: '초상화 속 귀부인', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4300, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'lady', stage: 0.25, debuffs: ['저주'] },
  kennel: trash('kennel', '사냥개 우리', [
    { name: '빈 갑옷 시종', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 베일 조문객', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '검은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '검은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
    {
      name: '유령 사냥개', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'howl', name: '울부짖음', icon: '울부', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['저주'] }),
  belmore: { key: 'belmore', lowLevel: true, name: '장원 주인 벨모어 경', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'belmore', stage: 0.25, debuffs: ['저주'] },
  // 던전 ⑤ 「서리 마탑」 (39 1-2, Lv 25, 35 4-4): 일반 얼음 복도 → 마력 골렘 → 불안정한 마법사 → 정예 서리 실험실 → 탑주의 그림자
  icehall: trash('icehall', '얼음 복도', [
    { name: '얼음 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  frostgolem: { key: 'frostgolem', lowLevel: true, name: '마력 골렘', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4800, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'frostgolem', stage: 0.25, debuffs: ['마법'] },
  mage: { key: 'mage', lowLevel: true, name: '불안정한 마법사', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5300, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'mage', stage: 0.25, debuffs: ['마법'] },
  frostlab: trash('frostlab', '서리 실험실', [
    { name: '얼음 룬 인형', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
    {
      name: '서리 정령', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '서리 폭발', icon: '서리', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  shadow: { key: 'shadow', lowLevel: true, name: '탑주의 그림자', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6200, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'shadow', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ⑦ 「무너진 순례길」 (39 1-1, Lv 28): 돌 수도사 ×2 + 길 잃은 순례자 (청소약을 차례로) → 신전지기 유령 (발판 1곳 · 네 가지 청소약, 35 4-8)
  brokenbridge: trash('brokenbridge', '끊어진 돌다리', [
    { name: '돌 수도사', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '길 잃은 순례자', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'soap', name: '엉뚱한 물약', icon: '물약', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: soaps(0.7) } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: HEAL4 }),
  keeper28: { key: 'keeper28', lowLevel: true, name: '신전지기 유령', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2300, enrage: 200, manaCoef: 1.0, diffs: ALL, script: 'keeper28', stage: 0.3, debuffs: HEAL4 },
  // 던전 ⑥ 「깨진 신전」 (39 1-2, Lv 30, 35 4-5): 일반 신전 앞뜰 → 신전 수호상 → 정예 금 간 본당 → 신전지기 유령
  templeyard: trash('templeyard', '신전 앞뜰', [
    { name: '돌 수도사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '다락 박쥐 떼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  guardian: { key: 'guardian', lowLevel: true, name: '신전 수호상', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'guardian', stage: 0.25, debuffs: ['마법'] },
  nave: trash('nave', '금 간 본당', [
    { name: '돌 수도사', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '길 잃은 순례자', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'soap', name: '엉뚱한 물약', icon: '물약', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: soaps() } },
    ] },
    {
      name: '신전 돌거인', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'pound', name: '땅 울림', icon: '울림', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: HEAL4 }),
  // 탐험 ⑧ 「심연 가장자리」 (39 1-1, Lv 33): 공허의 종복 ×2 + 검은 눈 → 역병 군주 (질병 · 독 · 전염, 10인 1층 예습, 35 4-8)
  riftground: trash('riftground', '갈라진 땅', [
    { name: '공허의 종복', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 눈', hp: 150, count: 1, attacks: [{ key: 'ray', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  plague33: { key: 'plague33', lowLevel: true, name: '역병 군주', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'plague33', stage: 0.3, debuffs: ['질병', '독'] },
  // 던전 ⑦ 「무너진 망루」 (39 3장, Lv 35, 새): 일반 돌무더기 계단 → 망루 파수꾼 → 정예 검은 틈 (심연 졸개, 함정) → 금 간 공명 수정
  rubblestair: trash('rubblestair', '돌무더기 계단', [
    { name: '돌 수도사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '다락 박쥐 떼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  sentinel: { key: 'sentinel', lowLevel: true, name: '망루 파수꾼', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'sentinel', stage: 0.25 },
  blackrift: trash('blackrift', '검은 틈', [
    { name: '공허의 종복', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '심연 전령', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'seal', name: '심연 봉인', icon: '봉인', to: 'other', dmg: 0, first: 5, period: 14, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '심연 봉인', type: '마법', left: 8, trap: true, end: { p: 'blast', dmg: 150 } } } },
    ] },
    {
      name: '탑 감시자', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'gaze', name: '침묵의 시선', icon: '시선', kind: 'aoe', to: 'all', dmg: 0, first: 8, period: 12, cast: 3, cut: true,
          effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '침묵의 시선', type: '마법', left: 6, noDps: true } } },
      ],
    },
  ], { debuffs: ['마법'] }),
  crystal: { key: 'crystal', lowLevel: true, name: '금 간 공명 수정', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'crystal', stage: 0.25, debuffs: ['저주', '마법'] },
  keeper: { key: 'keeper', lowLevel: true, name: '신전지기 유령', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7000, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'keeper', stage: 0.25, debuffs: HEAL4 },
  // ---------- 묶음 B 옛 세력 (46 1장 · 2장): 구간 졸개는 그 세력 4종 (39 2장) 그대로 ----------
  // 탐험 ⑩ 「책갈피 설원」 (46 1-1, Lv 40): 얼음 룬 인형 ×2 + 견습 마법사 → 서고 사서 (마나 갈취 예습, 던전 ⑨)
  pagedrift: trash('pagedrift', '흩날린 책장', [
    { name: '얼음 룬 인형', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  librarian40: { key: 'librarian40', lowLevel: true, name: '서고 사서', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'librarian40', stage: 0.3 },
  // 탐험 ⑫ 「장미 울타리 미로」 (46 1-1, Lv 48): 빈 갑옷 시종 ×2 + 검은 베일 조문객 → 백합 여사제 (넘치는 빛 예습, 던전 ⑩)
  rosetunnel: trash('rosetunnel', '장미 터널', [
    { name: '빈 갑옷 시종', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 베일 조문객', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '검은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '검은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['저주'] }),
  priestess48: { key: 'priestess48', lowLevel: true, name: '백합 여사제', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 215, manaCoef: 1.0, diffs: ALL, script: 'priestess48', stage: 0.3, debuffs: ['저주'] },
  // 던전 ⑧ 「역병 수로」 (46 1-2 · 3-1, Lv 40): 일반 물 새는 수로 → 수로 쥐왕 → 정예 오물 거름망 → 역병 운반자
  leakyway: trash('leakyway', '물 새는 수로', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  ratking: { key: 'ratking', lowLevel: true, name: '수로 쥐왕', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4900, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'ratking', stage: 0.25, debuffs: ['질병'] },
  sludgegrate: trash('sludgegrate', '오물 거름망', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
    {
      name: '부리 가면 집행자', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'shout', name: '병든 외침', icon: '외침', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병'] }),
  carrier: { key: 'carrier', lowLevel: true, name: '역병 운반자', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'carrier', stage: 0.25, debuffs: ['질병'] },
  // 던전 ⑨ 「얼음 서고」 (46 1-2 · 3-2, Lv 45): 일반 얼음 열람실 → 서고 사서 → 정예 금서 보관소 → 얼어붙은 대학자
  iceread: trash('iceread', '얼음 열람실', [
    { name: '얼음 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  librarian: { key: 'librarian', lowLevel: true, name: '서고 사서', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5600, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'librarian', stage: 0.25, debuffs: ['마법'] },
  forbidden: trash('forbidden', '금서 보관소', [
    { name: '얼음 룬 인형', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
    {
      name: '서리 정령', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '서리 폭발', icon: '서리', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  scholar: { key: 'scholar', lowLevel: true, name: '얼어붙은 대학자', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6900, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'scholar', stage: 0.25, debuffs: ['마법'] },
  // 던전 ⑩ 「백합 납골당」 (46 1-2 · 3-3, Lv 50): 일반 꽃잎 계단 → 백합 여사제 → 정예 관리인 회랑 (납골당 관리인 + 먼지 유령 무리) → 잠든 가주
  petalstair: trash('petalstair', '꽃잎 계단', [
    { name: '빈 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  priestess: { key: 'priestess', lowLevel: true, name: '백합 여사제', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'priestess', stage: 0.25, debuffs: ['저주'] },
  // 먼지 유령: 체력이 일반 ①의 30%라 거의 함께 쓰러지고, 쓰러질 때마다 살아 있는 모두에게 먼지 파열 1중첩 (쫄 떼 파열 본판, 46 2장)
  keeperhall: trash('keeperhall', '관리인 회랑', [
    { name: '빈 갑옷 시종', hp: 400, count: 1, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '먼지 유령', hp: 120, count: 5, attacks: [{ key: 'hit', to: 'other', dmg: 25, jitter: 0.2, first: 2.5, period: 3, cast: 0 }],
      down: { p: 'burst', debuff: { name: '먼지 파열', type: '저주', left: 4, dot: 6, stackMax: 5 } } },
    {
      name: '납골당 관리인', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'dust', name: '먼지 털기', icon: '먼지', kind: 'aoe', to: 'all', dmg: 120, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['저주'] }),
  sleeper: { key: 'sleeper', lowLevel: true, name: '잠든 가주', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7200, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'sleeper', stage: 0.25, debuffs: ['저주'] },
  // ---------- 묶음 B 짠물 해적단 (46 2장 · 4장): 졸개 ① 갑판 청소부 · ② 새총 꼬마 해적 · ③ 해파리 점쟁이 (독 → 저주) · ④ 닻 든 거한 ----------
  // 탐험 ⑨ 「조개껍데기 해변」 (46 1-1, Lv 36): 갈매기 모래밭 → 집게발 갑판장 (부풀기 쉬운 판, 10인 ② 예습)
  gullsand: trash('gullsand', '갈매기 모래밭', [
    { name: '갑판 청소부', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '해파리 점쟁이', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'fortune', name: '해파리 점괘', icon: '점괘', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'cycle', n: 1, debuffs: [
          { name: '해파리 독', type: '독', left: 10, dot: 12 },
          { name: '나쁜 점괘', type: '저주', left: 10, healCut: 0.3 },
        ] } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['독', '저주'] }),
  crab36: { key: 'crab36', lowLevel: true, name: '집게발 갑판장', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2400, enrage: 205, manaCoef: 1.0, diffs: ALL, script: 'crab36', stage: 0.3, debuffs: ['독'] },
  // 탐험 ⑪ 「난파선 모래톱」 (46 1-1, Lv 44): 난파선 잔해 → 해적 선장 금빛수염 (뒤집힘 저주 쉬운 판, 10인 ④ 예습)
  wreckage: trash('wreckage', '난파선 잔해', [
    { name: '갑판 청소부', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '새총 꼬마 해적', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  goldbeard44: { key: 'goldbeard44', lowLevel: true, name: '해적 선장 금빛수염', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'goldbeard44', stage: 0.3, debuffs: ['저주'] },
  // 10인 ② 갈매기 항구 (Lv 39) · ③ 짠물 여왕호 (Lv 43) · ④ 보물섬 요새 (Lv 47): 체력은 자동 힐러 시뮬로 목표 시간에 쓰러지게 맞춤 (쫄 · 감옥이 많은 보스는 낮음)
  crab: { key: 'crab', name: '집게발 갑판장', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 22000, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'crab', stage: 0.18, debuffs: ['독'] },
  cook: { key: 'cook', name: '해적 요리사 왕솥', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 19000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'cook', stage: 0.18, debuffs: ['독'] },
  morel: { key: 'morel', name: '부선장 갈고리 모렐', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23500, enrage: 420, manaCoef: 1.3, diffs: ALL, script: 'morel', stage: 0.18, debuffs: ['독'] },
  gunner: { key: 'gunner', name: '포수장 쾅쾅', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 17000, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'gunner', stage: 0.18, debuffs: ['저주'] },
  octo: { key: 'octo', name: '문어 꾸물이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 16500, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'octo', stage: 0.18, debuffs: ['독'] },
  seawitch: { key: 'seawitch', name: '바다 마녀 미역 할멈', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 27000, enrage: 435, manaCoef: 1.3, diffs: ALL, script: 'seawitch', stage: 0.18, debuffs: ['저주'] },
  mimic: { key: 'mimic', name: '보물 상자 덥석이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 18600, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'mimic', stage: 0.18 },
  parrot: { key: 'parrot', name: '앵무새 대장 깍깍', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 26000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'parrot', stage: 0.18, debuffs: ['저주'] },
  goldbeard: { key: 'goldbeard', name: '해적 선장 금빛수염', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 22600, enrage: 450, manaCoef: 1.5, diffs: ALL, script: 'goldbeard', stage: 0.18, debuffs: ['저주'] },
  // ---------- 묶음 C 버섯 요정단 (48 2장): 졸개 ① 버섯 꼬마 경비 · ② 꽃가루 요정 · ③ 재채기 버섯 (질병 → 마법) · ④ 큰 갓 버섯 거인 ----------
  // 탐험 ⑬ 「꼬마등 오솔길」 (48 1-1, Lv 52): 버섯 우산 길 → 찻잔 요정 홀짝이 (넘어가는 포자 쉬운 판, 던전 ⑪ 예습)
  capway: trash('capway', '버섯 우산 길', [
    { name: '버섯 꼬마 경비', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '재채기 버섯', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sneeze', name: '에취!', icon: '에취', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: sneeze(0.7) } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병', '마법'] }),
  sippy52: { key: 'sippy52', lowLevel: true, name: '찻잔 요정 홀짝이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 215, manaCoef: 1.0, diffs: ALL, script: 'sippy52', stage: 0.3, debuffs: ['질병'] },
  // 던전 ⑪ 「끝없는 다과회」 (48 1-2 · 3-1, Lv 55): 일반 각설탕 계단 → 찻잔 요정 홀짝이 → 정예 찻잔 탑 → 모자 장수 해롱
  sugarstair: trash('sugarstair', '각설탕 계단', [
    { name: '버섯 꼬마 경비', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '꽃가루 요정', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  sippy: { key: 'sippy', lowLevel: true, name: '찻잔 요정 홀짝이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5100, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'sippy', stage: 0.25, debuffs: ['질병'] },
  cuptower: trash('cuptower', '찻잔 탑', [
    { name: '버섯 꼬마 경비', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '재채기 버섯', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sneeze', name: '에취!', icon: '에취', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: sneeze() } },
    ] },
    {
      name: '큰 갓 버섯 거인', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'cap', name: '갓 내려찍기', icon: '갓', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병', '마법'] }),
  hatter: { key: 'hatter', lowLevel: true, name: '모자 장수 해롱', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6800, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'hatter', stage: 0.25, debuffs: ['마법'] },
  // 던전 ⑫ 「이끼 뿌리 사원」 (48 1-2 · 3-2, Lv 60, 늪의 부족 졸개 그대로): 일반 젖은 계단 → 버섯 가면 주술사 우가 → 정예 거북 등 다리 → 늪 거북 신 등딱지
  wetstair: trash('wetstair', '젖은 계단', [
    { name: '늪 창병', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '진흙 투석꾼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  uga: { key: 'uga', lowLevel: true, name: '버섯 가면 주술사 우가', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5400, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'uga', stage: 0.25, debuffs: ['독'] },
  turtlebridge: trash('turtlebridge', '거북 등 다리', [
    { name: '늪 창병', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '독침 사냥꾼', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sting', name: '독침', icon: '독침', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 10, dot: 9, stackMax: 3 } } },
    ] },
    {
      name: '독 혹 두꺼비', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '독 혹 터뜨리기', icon: '독혹', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독'] }),
  shellgod: { key: 'shellgod', lowLevel: true, name: '늪 거북 신 등딱지', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7300, enrage: 280, manaCoef: 1.0, diffs: ALL, script: 'shellgod', stage: 0.25, debuffs: ['독'] },
  // 탐험 ⑭ 「무지개 버섯밭」 (48 1-1, Lv 56): 꽃가루 들판 → 버섯 여왕 아마니타 (사람 칸 쉬운 판, 10인 ⑦ 왕좌 예습)
  pollenfield: trash('pollenfield', '꽃가루 들판', [
    { name: '버섯 꼬마 경비', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '꽃가루 요정', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  queen56: { key: 'queen56', lowLevel: true, name: '버섯 여왕 아마니타', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2650, enrage: 215, manaCoef: 1.0, diffs: ALL, script: 'queen56', stage: 0.3, debuffs: ['질병'] },
  // 10인 ⑤ 요정 축제 마당 (Lv 51) · ⑥ 포자 동굴 정원 (Lv 55) · ⑦ 버섯 여왕의 궁전 (Lv 59): 체력은 자동 힐러 시뮬로 목표 시간에 쓰러지게 맞춤
  songi: { key: 'songi', name: '버섯 경비대장 송이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23000, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'songi', stage: 0.18, debuffs: ['질병'] },
  pililli: { key: 'pililli', name: '요정 악단장 삘릴리', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 19000, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'pililli', stage: 0.18, debuffs: ['마법'] },
  ponga: { key: 'ponga', name: '축제 대장 퐁가', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 17800, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'ponga', stage: 0.18 },
  mungge: { key: 'mungge', name: '이끼 골렘 뭉게', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 25500, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'mungge', stage: 0.18, debuffs: ['질병'] },
  gaegul: { key: 'gaegul', name: '개구리 사공 개굴', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23000, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'gaegul', stage: 0.18 },
  morak: { key: 'morak', name: '포자 정원사 모락 할멈', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 16500, enrage: 405, manaCoef: 1.3, diffs: ALL, script: 'morak', stage: 0.18, debuffs: ['질병'] },
  bungbung: { key: 'bungbung', name: '꿀벌 근위대장 붕붕', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 22500, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'bungbung', stage: 0.18 },
  ppyong: { key: 'ppyong', name: '요정 마술사 뿅뿅', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 25000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'ppyong', stage: 0.18, debuffs: ['마법'] },
  amanita: { key: 'amanita', name: '버섯 여왕 아마니타', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 28500, enrage: 450, manaCoef: 1.5, diffs: ALL, script: 'amanita', stage: 0.18, debuffs: ['질병', '마법'] },
  // ---------- 묶음 C 붉은 용 일가 (48 2장, 첫 등장): 졸개 ① 코볼트 곡괭이꾼 · ② 불씨 꼬마 용 · ③ 코볼트 연기 주술사 (독 → 마법) · ④ 용 비늘 경비병 ----------
  // 탐험 ⑮ 「불꽃 봉우리 기슭」 (48 1-1, Lv 60): 뜨거운 자갈길 → 코볼트 보물 지킴이 꼬질 (자폭 쫄 × 독, 10인 ⑧ 예습)
  hotgravel: trash('hotgravel', '뜨거운 자갈길', [
    { name: '코볼트 곡괭이꾼', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '코볼트 연기 주술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'smoke', name: '매캐한 연기', icon: '연기', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'cycle', n: 1, debuffs: [
          { name: '독 연기', type: '독', left: 10, dot: 12 },
          { name: '불티', type: '마법', left: 8, dot: 15 },
        ] } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['독', '마법'] }),
  kobold60: { key: 'kobold60', lowLevel: true, name: '코볼트 보물 지킴이 꼬질', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2700, enrage: 220, manaCoef: 1.0, diffs: ALL, script: 'kobold60', stage: 0.3, debuffs: ['독'] },
  // ---------- 묶음 D1 (51 1장 · 2장): 붉은 용 일가 졸개 ① 코볼트 곡괭이꾼 · ② 불씨 꼬마 용 (구간에서는 원거리, 자폭 안 함) · ③ 코볼트 연기 주술사 · ④ 용 비늘 경비병 ----------
  // 탐험 ⑯ 「화산재 고갯길」 (51 1-1, Lv 64): 뜨끈한 재 언덕 → 온천지기 코볼트 뭉실 (녹는 보호막 쉬운 판, 던전 ⑬ 예습)
  warmash: trash('warmash', '뜨끈한 재 언덕', [
    { name: '코볼트 곡괭이꾼', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '코볼트 연기 주술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'smoke', name: '매캐한 연기', icon: '연기', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: KOBOLD_SMOKE } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['독', '마법'] }),
  mungsil64: { key: 'mungsil64', lowLevel: true, name: '온천지기 코볼트 뭉실', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2700, enrage: 220, manaCoef: 1.0, diffs: ALL, script: 'mungsil64', stage: 0.3, debuffs: ['독'] },
  // 던전 ⑬ 「용암 온천장」 (51 1-2 · 3-1, Lv 65): 일반 김 서린 탈의실 → 온천지기 코볼트 뭉실 → 정예 용암 탕 → 사춘기 용 불퉁이
  steamroom: trash('steamroom', '김 서린 탈의실', [
    { name: '코볼트 곡괭이꾼', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '불씨 꼬마 용', hp: 300, count: 1, attacks: [{ key: 'spit', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  mungsil: { key: 'mungsil', lowLevel: true, name: '온천지기 코볼트 뭉실', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5300, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'mungsil', stage: 0.25, debuffs: ['독'] },
  lavabath: trash('lavabath', '용암 탕', [
    { name: '코볼트 곡괭이꾼', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '코볼트 연기 주술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'smoke', name: '매캐한 연기', icon: '연기', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: KOBOLD_SMOKE } },
    ] },
    {
      name: '용 비늘 경비병', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'tail', name: '꼬리 휩쓸기', icon: '꼬리', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독', '마법'] }),
  bulttung: { key: 'bulttung', lowLevel: true, name: '사춘기 용 불퉁이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'bulttung', stage: 0.25, debuffs: ['마법'] },
  // 던전 ⑭ 「용암 대장간」 (51 1-2 · 3-2, Lv 70, 버려진 골렘 졸개 그대로 · 해제 없음): 일반 식은 화로 → 풀무 골렘 후끈이 → 정예 모루 다리 → 모루 골렘 땅땅
  coldhearth: trash('coldhearth', '식은 화로', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  huggeun: { key: 'huggeun', lowLevel: true, name: '풀무 골렘 후끈이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5500, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'huggeun', stage: 0.25 },
  anvilbridge: trash('anvilbridge', '모루 다리', [
    { ...CHAFF, count: 3 },
    {
      name: '보일러 골렘', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '증기 분출', icon: '증기', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ]),
  ttangttang: { key: 'ttangttang', lowLevel: true, name: '모루 골렘 땅땅', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7600, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'ttangttang', stage: 0.25 },
  // 10인 ⑧ 코볼트 보물 굴 (51 4-1, Lv 63 · 악몽 78): 체력은 자동 힐러 시뮬로 목표 시간에 쓰러지게 맞춤
  kkojil: { key: 'kkojil', name: '코볼트 보물 지킴이 꼬질', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 18500, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'kkojil', stage: 0.18, debuffs: ['독'] },
  deolkeong: { key: 'deolkeong', name: '코볼트 수레꾼 덜컹이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23000, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'deolkeong', stage: 0.18, debuffs: ['마법'] },
  beonjjeok: { key: 'beonjjeok', name: '코볼트 대장 번쩍이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 21500, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'beonjjeok', stage: 0.18 },
  // ---------- 묶음 D2 (51 1장 · 4-2 · 4-3) ----------
  // 10인 ⑨ 어미 용의 둥지 (Lv 67 · 악몽 82). 삼남매 몸통 체력 = hp ÷ 3 (bosses WHELP_HP)
  whelps: { key: 'whelps', name: '새끼 용 삼남매', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23400, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'whelps', stage: 0.18, debuffs: ['마법'] },
  dandani: { key: 'dandani', name: '용 비늘 경비대장 단단이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 25000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'dandani', stage: 0.18, debuffs: ['마법'] },
  rubina: { key: 'rubina', name: '어미 용 루비나', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23000, enrage: 480, manaCoef: 1.5, diffs: ALL, script: 'rubina', stage: 0.18, debuffs: ['독', '마법'] },
  // 탐험 ⑰ 「잠긴 호숫가」 (51 1-1, Lv 68, 심연 졸개): 물이 빠진 호숫가 → 물그림자 기사 셋 (생명 사슬 균형형 쉬운 판, 20인 대성당 회랑 예습)
  shoretrash: trash('shoretrash', '물이 빠진 호숫가', [
    { name: '공허의 종복', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 눈', hp: 150, count: 1, attacks: [{ key: 'ray', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  knights68: { key: 'knights68', lowLevel: true, name: '물그림자 기사 셋', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2900, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'knights68', stage: 0.3 },
  // 20인 ① 가라앉은 대성당 2 · 3 · 4구역 (Lv 70 · 악몽 80): 1구역 유령 성가대 수치 (마나 1.6 · 단계 0.13)에 맞춤. 기사 몸통 체력 = hp ÷ 3 (bosses KNIGHT_HP)
  knights: { key: 'knights', name: '물그림자 기사 셋', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 49500, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'knights', big: true, stage: 0.13 },
  uwoong: { key: 'uwoong', name: '물오르간 정령 우웅이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 60000, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'uwoong', big: true, stage: 0.13, debuffs: ['마법'] },
  ormal: { key: 'ormal', name: '문지기 그림자 오르말', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 70000, enrage: 480, manaCoef: 1.6, diffs: ALL, script: 'ormal', big: true, stage: 0.13, debuffs: ['질병', '독', '저주', '마법'] },
  // ---------- 묶음 E1 (54 1장 · 2장 · 3-1 · 4-1 · 4-4): 모래 왕국 졸개 ① 모래 병정 · ② 풍뎅이 투석병 · ③ 붕대 시종 (질병 → 저주) · ④ 스핑크스 석상 ----------
  // 10인 ⑩ 노을 시장 (Lv 71 · 악몽 86). 꾸벅 · 끄덕 몸통 체력 = hp ÷ 2 (bosses GUARD_HP)
  kkubeok: { key: 'kkubeok', name: '졸린 모래 병정 꾸벅 · 끄덕', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 24000, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'kkubeok', stage: 0.18, debuffs: ['질병'] },
  hokdol: { key: 'hokdol', name: '향신료 낙타 상인 혹돌이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 22400, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'hokdol', stage: 0.18, debuffs: ['질병', '저주'] },
  nyanx: { key: 'nyanx', name: '수수께끼 고양이 냥크스', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 26000, enrage: 390, manaCoef: 1.5, diffs: ALL, script: 'nyanx', stage: 0.18, debuffs: ['저주'] },
  // 탐험 ⑱ 「물밑 계단」 (54 1-1, Lv 72, 심연 졸개): 대성당 아래 계단 → 해파리 정원사 흐물이 (요정 고리 × 진동 쉬운 판, 20인 물밑 수도원 연못 예습)
  stairtrash: trash('stairtrash', '대성당 아래 계단', [
    { name: '공허의 종복', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 눈', hp: 150, count: 1, attacks: [{ key: 'ray', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  heumul72: { key: 'heumul72', lowLevel: true, name: '해파리 정원사 흐물이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2900, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'heumul72', stage: 0.3 },
  // 20인 ② 물밑 수도원 (Lv 73 · 악몽 83): 20인 ① 대성당 수치 (마나 1.6 · 단계 0.13)에 맞춤
  heumul: { key: 'heumul', name: '해파리 정원사 흐물이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 52000, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'heumul', big: true, stage: 0.13, debuffs: ['마법'] },
  bichumi: { key: 'bichumi', name: '거울 사서 비추미', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 56000, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'bichumi', big: true, stage: 0.13, debuffs: ['질병', '저주'] },
  gipeun: { key: 'gipeun', name: '심연 수도원장 깊은잠', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 64000, enrage: 480, manaCoef: 1.8, diffs: ALL, script: 'gipeun', big: true, stage: 0.13, debuffs: HEAL4 },
  // 던전 ⑮ 「모래시계 궁전」 (54 1-2 · 3-1, Lv 75): 일반 모래 흐르는 복도 → 시간지기 풍뎅이 데굴이 → 정예 거꾸로 정원 → 붕대 집사 둘둘이
  sandhall: trash('sandhall', '모래 흐르는 복도', [
    { name: '모래 병정', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '풍뎅이 투석병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  degul: { key: 'degul', lowLevel: true, name: '시간지기 풍뎅이 데굴이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5500, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'degul', stage: 0.25, debuffs: ['질병'] },
  backgarden: trash('backgarden', '거꾸로 정원', [
    { name: '모래 병정', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '붕대 시종', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'wrap', name: '하품 붕대', icon: '붕대', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: SAND_WRAP } },
    ] },
    {
      name: '스핑크스 석상', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'storm', name: '모래 폭풍', icon: '폭풍', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병', '저주'] }),
  dooldool: { key: 'dooldool', lowLevel: true, name: '붕대 집사 둘둘이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7200, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'dooldool', stage: 0.25, debuffs: ['저주'] },
  // ---------- 묶음 E2 (54 1장 · 4-2 · 4-5) ----------
  // 10인 ⑪ 노을 궁전 (Lv 75 · 악몽 90). 솔솔 · 살살 몸통 체력 = hp ÷ 2 (bosses SPRITE_HP와 같게 맞출 것)
  solsol: { key: 'solsol', name: '모래 정령 솔솔 · 살살', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23300, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'solsol', stage: 0.18, debuffs: ['질병'] },
  eonggeum: { key: 'eonggeum', name: '보물고 거북 엉금이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 24000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'eonggeum', stage: 0.18, debuffs: ['저주'] },
  sarasha: { key: 'sarasha', name: '노을 여왕 사라샤', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 23500, enrage: 480, manaCoef: 1.5, diffs: ALL, script: 'sarasha', stage: 0.18, debuffs: ['질병', '저주'] },
  // 탐험 ⑲ 「낙타 대상로」 (54 1-1, Lv 76, 모래 왕국 졸개 · 질병만): 모래 언덕 길 → 베개 골렘 폭신이 (신기루 × 진동, 10인 낮잠 피라미드 복도 예습)
  dunetrash: trash('dunetrash', '모래 언덕 길', [
    { name: '모래 병정', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '붕대 시종', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'wrap', name: '하품 붕대', icon: '붕대', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: [SAND_WRAP[0]] } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병'] }),
  pokshin76: { key: 'pokshin76', lowLevel: true, name: '베개 골렘 폭신이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3000, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'pokshin76', stage: 0.3 },
  // 20인 ③ 빛뿌리 숲 (Lv 76 · 악몽 86)
  ttubeok: { key: 'ttubeok', name: '뿌리 거인 뚜벅이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 48400, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'ttubeok', big: true, stage: 0.13 },
  toktok: { key: 'toktok', name: '씨앗 할머니 톡톡', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 47300, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'toktok', big: true, stage: 0.13, debuffs: ['질병'] },
  kungkung: { key: 'kungkung', name: '심장의 뿌리 쿵쿵', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 49000, enrage: 480, manaCoef: 1.6, diffs: ALL, script: 'kungkung', big: true, stage: 0.13, debuffs: ['저주', '마법'] },
  // ---------- 묶음 E3 (54 1장 · 2장 · 3-2 · 4-3 · 4-6) ----------
  // 10인 ⑫ 낮잠 피라미드 (Lv 79 · 악몽 94)
  pokshin: { key: 'pokshin', name: '베개 골렘 폭신이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 24000, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'pokshin', stage: 0.18, debuffs: ['질병'] },
  jjaekkak: { key: 'jjaekkak', name: '모래시계 사제 째깍이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 25300, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'jjaekkak', stage: 0.18, debuffs: ['저주'] },
  hapum: { key: 'hapum', name: '모래 왕 하품호텝', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 29400, enrage: 480, manaCoef: 1.5, diffs: ALL, script: 'hapum', stage: 0.18, debuffs: ['질병', '저주'] },
  // 20인 ④ 별빛 저수지 (Lv 79 · 악몽 89)
  ttakttak: { key: 'ttakttak', name: '수문지기 집게 딱딱이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 44500, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'ttakttak', big: true, stage: 0.13 },
  jjirit: { key: 'jjirit', name: '별빛 장어 찌릿', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 56600, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'jjirit', big: true, stage: 0.13, debuffs: ['마법'] },
  doeul: { key: 'doeul', name: '심연의 메아리 되울림', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 69700, enrage: 480, manaCoef: 1.6, diffs: ALL, script: 'doeul', big: true, stage: 0.13, debuffs: HEAL4 },
  // 탐험 ⑳ 「바람개비 언덕」 (54 1-1, Lv 80, 폭풍 깃털단 첫 등장 · 저주 + 마법): 바람 부는 언덕 → 하피 우체부 휘리릭
  windtrash: trash('windtrash', '바람 부는 언덕', [
    { name: '깃털 창병 하피', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '폭풍 점술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '폭풍 점괘', icon: '점괘', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: STORM_HEX } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['저주', '마법'] }),
  hwirik: { key: 'hwirik', lowLevel: true, name: '하피 우체부 휘리릭', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3100, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'hwirik', stage: 0.3, debuffs: ['저주', '마법'] },
  // 던전 ⑯ 「해시계 천문대」 (54 1-2 · 3-2, Lv 80, 해바라기 언덕 · 모든 유형): 일반 별 지도 회랑 → 천문대 수호상 별바라기 → 정예 해시계 마당 → 해시계 관리인 유령 그늘지기
  startrash: trash('startrash', '별 지도 회랑', [
    { name: '돌 수도사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '다락 박쥐 떼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  stargazer: { key: 'stargazer', lowLevel: true, name: '천문대 수호상 별바라기', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'stargazer', stage: 0.25, debuffs: HEAL4 },
  sundialyard: trash('sundialyard', '해시계 마당', [
    { name: '돌 수도사', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '길 잃은 순례자', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'soap', name: '엉뚱한 물약', icon: '물약', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: soaps() } },
    ] },
    {
      name: '신전 돌거인', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'pound', name: '땅 울림', icon: '울림', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: HEAL4 }),
  geuneul: { key: 'geuneul', lowLevel: true, name: '해시계 관리인 유령 그늘지기', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7600, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'geuneul', stage: 0.25, debuffs: HEAL4 },
  // ---------- 묶음 F1 (56 1장 · 2장 · 3-1 · 4-1 · 4-3): 구름 위 섬 · 폭풍 깃털단 ① 깃털 창병 하피 · ② 바람 요정 · ③ 폭풍 점술사 · ④ 천둥 숫양 ----------
  // 20인 ⑤ 숨결 우물 (Lv 82 · 악몽 92 · 심연 · 모든 유형)
  chulleong: { key: 'chulleong', name: '두레박 정령 출렁이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 51000, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'chulleong', big: true, stage: 0.13 },
  puseok: { key: 'puseok', name: '이끼 수호자 푸석이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 56500, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'puseok', big: true, stage: 0.13, debuffs: ['질병', '마법'] },
  huu: { key: 'huu', name: '심장의 숨 후우', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 69000, enrage: 480, manaCoef: 1.8, diffs: ALL, script: 'huu', big: true, stage: 0.13, debuffs: HEAL4 },
  // 10인 ⑬ 구름 우체국 (Lv 83 · 악몽 98)
  hwirik83: { key: 'hwirik83', name: '하피 우체부 휘리릭', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 21600, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'hwirik83', stage: 0.18, debuffs: ['저주', '마법'] },
  kkongkkong: { key: 'kkongkkong', name: '소포 요정 꽁꽁이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 20700, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'kkongkkong', stage: 0.18, debuffs: ['저주'] },
  buri: { key: 'buri', name: '우체국장 하피 부리부리', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 27000, enrage: 480, manaCoef: 1.5, diffs: ALL, script: 'buri', stage: 0.18, debuffs: ['저주'] },
  // 탐험 ㉑ 「구름 양 목장」 (56 1-1, Lv 84 · 마법): 솜구름 목초지 → 번개 양 복슬이 (연쇄 번개 쉬운 판, 던전 ⑰ 예습)
  sheeptrash: trash('sheeptrash', '솜구름 목초지', [
    { name: '깃털 창병 하피', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '바람 요정', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  boksul84: { key: 'boksul84', lowLevel: true, name: '번개 양 복슬이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3100, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'boksul84', stage: 0.3, debuffs: ['마법'] },
  // 던전 ⑰ 「천둥 풍차」 (56 1-2 · 3-1, Lv 85 · 저주 + 마법): 일반 바람 날개 계단 → 번개 양 복슬이 → 정예 번개 방앗간 → 풍차지기 하피 돌개
  millstairs: trash('millstairs', '바람 날개 계단', [
    { name: '깃털 창병 하피', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '바람 요정', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  boksul: { key: 'boksul', lowLevel: true, name: '번개 양 복슬이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'boksul', stage: 0.25, debuffs: ['마법'] },
  millhouse: trash('millhouse', '번개 방앗간', [
    { name: '깃털 창병 하피', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '폭풍 점술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '폭풍 점괘', icon: '점괘', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: STORM_HEX } },
    ] },
    {
      name: '천둥 숫양', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'ram', name: '천둥 박치기', icon: '박치', kind: 'aoe', to: 'all', dmg: 160, first: 8, period: 12, cast: 2.5, cut: true },
      ],
    },
  ], { debuffs: ['저주', '마법'] }),
  dolgae: { key: 'dolgae', lowLevel: true, name: '풍차지기 하피 돌개', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7600, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'dolgae', stage: 0.25, debuffs: ['저주'] },
  // ---------- 묶음 F2 (56 4-2 · 4-4) ----------
  // 20인 ⑥ 수정 뿌리굴 (Lv 85 · 악몽 95 · 심연 · 모든 유형)
  gulgul: { key: 'gulgul', name: '수정 두더지 굴굴이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 50500, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'gulgul', big: true, stage: 0.13, debuffs: HEAL4 },
  pingping: { key: 'pingping', name: '바람개비 정령 핑핑이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 50000, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'pingping', big: true, stage: 0.13 },
  bitgallae: { key: 'bitgallae', name: '수정 마녀 빛갈래', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 69400, enrage: 480, manaCoef: 1.6, diffs: ALL, script: 'bitgallae', big: true, stage: 0.13, debuffs: HEAL4 },
  // 10인 ⑭ 폭풍 성채 (Lv 87 · 악몽 100 · 폭풍 깃털단 · 저주 + 마법)
  dungdung: { key: 'dungdung', name: '천둥 북 거인 둥둥이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 22900, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'dungdung', stage: 0.18, debuffs: ['마법'] },
  ssaengssaeng: { key: 'ssaengssaeng', name: '하피 기사 쌩쌩이', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 21500, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'ssaengssaeng', stage: 0.18, debuffs: ['저주'] },
  ureureung: { key: 'ureureung', name: '폭풍 거인 우르릉', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 28600, enrage: 480, manaCoef: 1.5, diffs: ALL, script: 'ureureung', stage: 0.18, debuffs: ['저주', '마법'] },
  // ---------- 묶음 F3 (56 1장 · 2장 · 3-2 · 4-5): 폭주한 마도사 졸개는 39 2장 그대로 (이름에 구름 · 빗자루, 그림은 서리 마탑 것을 빌림) ----------
  // 탐험 ㉒ 「빗자루 정류장」 (56 1-1, Lv 88 · 마법): 구름 정류장 승강장 → 실험 조교 퐁퐁이 (넘치는 빛 × 연쇄 번개, 던전 ⑱ 예습)
  platform: trash('platform', '구름 정류장 승강장', [
    { name: '구름 룬 인형', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['마법'] }),
  pongpong88: { key: 'pongpong88', lowLevel: true, name: '실험 조교 퐁퐁이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3200, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'pongpong88', stage: 0.3, debuffs: ['마법'] },
  // 던전 ⑱ 「구름 마법학교」 (56 1-2 · 3-2, Lv 90 · 마법): 일반 거꾸로 복도 → 실험 조교 퐁퐁이 → 정예 번개 실습실 → 엉뚱 교장 뒤죽박죽
  upsidehall: trash('upsidehall', '거꾸로 복도', [
    { name: '구름 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '빗자루 견습생', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  pongpong: { key: 'pongpong', lowLevel: true, name: '실험 조교 퐁퐁이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6200, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'pongpong', stage: 0.25, debuffs: ['마법'] },
  boltlab: trash('boltlab', '번개 실습실', [
    { name: '구름 룬 인형', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
    {
      name: '번개 실험 정령', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '번개 폭발', icon: '번개', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  dwijuk: { key: 'dwijuk', lowLevel: true, name: '엉뚱 교장 뒤죽박죽', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'dwijuk', stage: 0.25, debuffs: ['마법'] },
  // 20인 ⑦ 그림자 성벽 (Lv 88 · 악몽 98 · 심연 · 모든 유형)
  kwangkwang: { key: 'kwangkwang', name: '그림자 망치 거인 쾅쾅이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 50600, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'kwangkwang', big: true, stage: 0.13, debuffs: HEAL4 },
  syungsyung: { key: 'syungsyung', name: '그림자 궁수대장 슝슝이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 51400, enrage: 390, manaCoef: 1.6, diffs: ALL, script: 'syungsyung', big: true, stage: 0.13 },
  eodugi: { key: 'eodugi', name: '그림자 장군 어둑이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 67300, enrage: 480, manaCoef: 1.8, diffs: ALL, script: 'eodugi', big: true, stage: 0.13, debuffs: HEAL4 },
  // ---------- 묶음 G1 (59 1장 · 3-1 · 4-1 · 4-2) ----------
  // 10인 ⑮ 그림자 미궁 (Lv 91 · 악몽 100 · 심연의 정예 · 전 유형, 칸마다 주로 거는 유형)
  geumeum: { key: 'geumeum', name: '미궁 파수꾼 그믐', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 21600, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'geumeum', stage: 0.18, debuffs: ['독', '마법'] },
  silta: { key: 'silta', name: '함정 거미 실타래', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 20700, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'silta', stage: 0.18, debuffs: ['질병', '저주'] },
  bamgeuneul: { key: 'bamgeuneul', name: '미궁의 주인 밤그늘', tier: '레이드 · 10인', board: 'b25', comp: RAID10, hp: 27000, enrage: 480, manaCoef: 1.5, diffs: ALL, script: 'bamgeuneul', stage: 0.18, debuffs: HEAL4 },
  // 20인 ⑧ 그림자 진영 (Lv 91 · 악몽 100 · 심연의 정예 · 전 유형)
  jilpung: { key: 'jilpung', name: '그림자 기병대장 질풍', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 50600, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'jilpung', big: true, stage: 0.13, debuffs: ['독', '질병'] },
  ureobal: { key: 'ureobal', name: '심연 거수 우레발', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 51400, enrage: 380, manaCoef: 1.6, diffs: ALL, script: 'ureobal', big: true, stage: 0.13, debuffs: ['저주', '마법'] },
  chilheuk: { key: 'chilheuk', name: '심연 기사단장 칠흑', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 67300, enrage: 480, manaCoef: 1.8, diffs: ALL, script: 'chilheuk', big: true, stage: 0.13, debuffs: HEAL4 },
  // 탐험 ㉓ 「유령 마차길」 (59 1-1, Lv 92 · 몰락한 귀족가 · 저주): 가라앉은 가로수길 → 유령 악단장 세레나 (어둠물 밀물 쉬운 판, 던전 ⑲ 예습). 졸개는 39 2장 귀족가에 「물에 젖은」 · 「가라앉은」만
  carriagetrash: trash('carriagetrash', '가라앉은 가로수길', [
    { name: '물에 젖은 갑옷 시종', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '물에 젖은 조문객', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '젖은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '젖은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['저주'] }),
  serena92: { key: 'serena92', lowLevel: true, name: '유령 악단장 세레나', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3200, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'serena92', stage: 0.3, debuffs: ['저주'] },
  // 던전 ⑲ 「가라앉은 무도회장」 (59 1-2 · 3-1, Lv 95 · 몰락한 귀족가 · 저주): 일반 물에 잠긴 연회장 → 유령 악단장 세레나 → 정예 무너진 발코니 → 몰락한 대공 발렌
  ballhall: trash('ballhall', '물에 잠긴 연회장', [
    { name: '물에 젖은 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '가라앉은 유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { debuffs: ['저주'] }),
  serena: { key: 'serena', lowLevel: true, name: '유령 악단장 세레나', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'serena', stage: 0.25, debuffs: ['저주'] },
  balcony: trash('balcony', '무너진 발코니', [
    { name: '물에 젖은 갑옷 시종', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '물에 젖은 조문객', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '젖은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '젖은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
    {
      name: '가라앉은 사냥개', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'howl', name: '물속 울부짖음', icon: '울부', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['저주'] }),
  valen: { key: 'valen', lowLevel: true, name: '몰락한 대공 발렌', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7600, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'valen', stage: 0.25, debuffs: ['저주'] },
  // ---------- 묶음 G2 (59 1장 · 2장 · 4-3) ----------
  // 20인 ⑨ 어둠물 해안 (Lv 94 · 악몽 100 · 심연의 정예 · 전 유형)
  janmul: { key: 'janmul', name: '어둠물 뱃사공 잔물결', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 50600, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'janmul', big: true, stage: 0.13, debuffs: ['독', '마법'] },
  hwigami: { key: 'hwigami', name: '심연 장어왕 휘감이', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 51400, enrage: 380, manaCoef: 1.6, diffs: ALL, script: 'hwigami', big: true, stage: 0.13, debuffs: ['질병', '저주'] },
  geomeun: { key: 'geomeun', name: '어둠물 여왕 검은물결', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 67300, enrage: 480, manaCoef: 1.8, diffs: ALL, script: 'geomeun', big: true, stage: 0.13, debuffs: HEAL4 },
  // 탐험 ㉔ 「어둠물 등불길」 (59 1-1, Lv 96 · 심연의 정예): 꺼진 등불 길 (심연의 정예 ① ×2 ③) → 그림자 대여상 녹슬음 (빌린 생명 쉬운 판, 던전 ⑳ 예습)
  lanterntrash: trash('lanterntrash', '꺼진 등불 길', [
    { name: '그림자 기사', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '함정 술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '그림자 주문', icon: '주문', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: trapHex(0.7) } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: HEAL4 }),
  nokseul96: { key: 'nokseul96', lowLevel: true, name: '그림자 대여상 녹슬음', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3200, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'nokseul96', stage: 0.3, debuffs: ['독', '질병'] },
  // ---------- 묶음 G3 (59 1장 · 3-2 · 4-4) ----------
  // 20인 ⑩ 심연의 심장 (Lv 97 · 악몽 100 · 심연의 정예 · 전 유형, 최종 레이드)
  eongkim: { key: 'eongkim', name: '뿌리 수호자 얽힘', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 50600, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'eongkim', big: true, stage: 0.13, debuffs: ['저주', '마법'] },
  revlord: { key: 'revlord', name: '되살아난 심연의 군주', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 67300, enrage: 480, manaCoef: 1.8, diffs: ALL, script: 'revlord', big: true, stage: 0.13, debuffs: HEAL4 },
  abyssheart: { key: 'abyssheart', name: '심연의 심장', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 78700, enrage: 525, manaCoef: 2.1, diffs: ALL, script: 'abyssheart', big: true, stage: 0.13, debuffs: HEAL4 },
  // 탐험 ㉕ 「새벽 호숫길」 (59 1-1, Lv 100 · 심연의 정예): 무너지는 뿌리길 (심연의 정예 ① ×2 ④) → 심장 조각 (20인 ⑩ 심장 빌림, 심장 기믹 다시 보기)
  dawntrash: trash('dawntrash', '무너지는 뿌리길', [
    { name: '그림자 기사', hp: 170, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    {
      name: '심연 거수', elite: true, hp: 350, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'root', name: '뿌리 내려찍기', icon: '뿌리', kind: 'aoe', to: 'all', dmg: 120, first: 8, period: 12, cast: 2.5, cut: true },
      ],
    },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  heartshard100: { key: 'heartshard100', lowLevel: true, name: '심장 조각', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 3400, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'heartshard100', stage: 0.3 },
  // 던전 ⑳ 「멈춘 심장 속」 (59 3-2, Lv 100 · 심연의 정예 · 전 유형): 갈라진 심실 → 녹슬음 → 식어 가는 뿌리 → 마지막 그림자
  cracktrash: trash('cracktrash', '갈라진 심실', [
    { name: '그림자 기사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '그림자 석궁수', hp: 300, count: 1, attacks: [{ key: 'shot', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { debuffs: HEAL4 }),
  nokseul: { key: 'nokseul', lowLevel: true, name: '그림자 대여상 녹슬음', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'nokseul', stage: 0.25, debuffs: ['독', '질병'] },
  coolroot: trash('coolroot', '식어 가는 뿌리', [
    { name: '그림자 기사', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '함정 술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '그림자 주문', icon: '주문', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: trapHex(1) } },
    ] },
    {
      name: '심연 거수', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'root', name: '뿌리 내려찍기', icon: '뿌리', kind: 'aoe', to: 'all', dmg: 180, first: 8, period: 12, cast: 2.5, cut: true },
      ],
    },
  ], { debuffs: HEAL4 }),
  lastshade: { key: 'lastshade', lowLevel: true, name: '마지막 그림자', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7600, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'lastshade', stage: 0.25, debuffs: ['마법', '저주', '질병'] },
  // ---------- 묶음 H1 (62 2-1 · 3-1, Lv 5~30): 졸개는 그 세력 옛 졸개, 보스 체력 · 광폭화는 같은 레벨대 던전 줄 ----------
  // 탐험 ㉖ 고철 더미 언덕 (Lv 5): 고철 졸개 ×2 + 잔해 투척병 → 곡괭이 골렘 콩콩이 (진동 맛보기)
  heaptrash: trash('heaptrash', '고철 더미', [
    { ...CHAFF, hp: 150, count: 2 },
    { name: '잔해 투척병', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 70, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  kongkong5: { key: 'kongkong5', lowLevel: true, name: '곡괭이 골렘 콩콩이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1600, enrage: 160, manaCoef: 1.0, diffs: ALL, script: 'kongkong5', stage: 0.3 },
  // 던전 ㉑ 녹슨 광산 (Lv 8): 일반 무너진 갱도 입구 → 콩콩이 → 정예 광차 선로 → 광산 감독관 구릿빛
  shaft: trash('shaft', '무너진 갱도 입구', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  kongkong: { key: 'kongkong', lowLevel: true, name: '곡괭이 골렘 콩콩이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 3000, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'kongkong', stage: 0.25 },
  railway: trash('railway', '광차 선로', [
    { ...CHAFF, count: 2 },
    {
      name: '광차 골렘', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'rush', name: '광차 들이받기', icon: '광차', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ]),
  gurit: { key: 'gurit', lowLevel: true, name: '광산 감독관 구릿빛', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'gurit', stage: 0.25 },
  // 탐험 ㉗ 잿빛 뒷골목 (Lv 10): 교단 신도 ×2 (부패) + 묘지 쥐떼 → 약초꾼 수도사 몰리 (질병 해제)
  alleytrash: trash('alleytrash', '쓰레기 더미 골목', [
    { name: '교단 신도', hp: 150, count: 2, attacks: [
      { key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 6, period: 14, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
    { name: '묘지 쥐떼', hp: 150, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병'] }),
  molly10: { key: 'molly10', lowLevel: true, name: '약초꾼 수도사 몰리', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1900, enrage: 170, manaCoef: 1.0, diffs: ALL, script: 'molly10', stage: 0.3, debuffs: ['질병'] },
  // 던전 ㉒ 역병 약초 온실 (Lv 13): 일반 곰팡이 화분 복도 → 몰리 → 정예 버섯 묘판 → 온실지기 덩굴 골렘 칭칭이
  pothall: trash('pothall', '곰팡이 화분 복도', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  molly: { key: 'molly', lowLevel: true, name: '약초꾼 수도사 몰리', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 3600, enrage: 170, manaCoef: 1.0, diffs: ALL, script: 'molly', stage: 0.25, debuffs: ['질병'] },
  mushbed: trash('mushbed', '버섯 묘판', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
    {
      name: '부리 가면 집행자', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'shout', name: '포자 외침', icon: '포자', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병'] }),
  chingching: { key: 'chingching', lowLevel: true, name: '온실지기 덩굴 골렘 칭칭이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6200, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'chingching', stage: 0.25, debuffs: ['질병'] },
  // 탐험 ㉘ 개구리 연못 (Lv 15): 늪 창병 ×2 + 독침 사냥꾼 → 늪 사냥꾼 카라 (독침)
  lilypads: trash('lilypads', '연잎 징검다리', [
    { name: '늪 창병', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '독침 사냥꾼', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sting', name: '독침', icon: '독침', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 10, dot: 9, stackMax: 3 } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['독'] }),
  kara15: { key: 'kara15', lowLevel: true, name: '늪 사냥꾼 카라', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2000, enrage: 175, manaCoef: 1.0, diffs: ALL, script: 'kara15', stage: 0.3, debuffs: ['독'] },
  // 던전 ㉓ 갈대 오두막 마을 (Lv 18): 일반 갈대 울타리 → 카라 → 정예 진흙 웅덩이 길 → 진흙 정령 철벅이
  reedfence: trash('reedfence', '갈대 울타리', [
    { name: '늪 창병', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '진흙 투석꾼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  kara: { key: 'kara', lowLevel: true, name: '늪 사냥꾼 카라', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4000, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'kara', stage: 0.25, debuffs: ['독'] },
  mudpath: trash('mudpath', '진흙 웅덩이 길', [
    { name: '늪 창병', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '독침 사냥꾼', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sting', name: '독침', icon: '독침', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 10, dot: 9, stackMax: 3 } } },
    ] },
    {
      name: '독 혹 두꺼비', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '진흙 혹 터뜨리기', icon: '독혹', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독'] }),
  cheolbeok: { key: 'cheolbeok', lowLevel: true, name: '진흙 정령 철벅이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'cheolbeok', stage: 0.25, debuffs: ['독'] },
  // 탐험 ㉙ 분수 정원 (Lv 20): 빈 갑옷 시종 ×2 + 유령 하녀 → 향수 조향사 라벤더 (받는 치유 −50% 저주)
  fountainwalk: trash('fountainwalk', '분수대 산책로', [
    { name: '빈 갑옷 시종', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '유령 하녀', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  lavender20: { key: 'lavender20', lowLevel: true, name: '향수 조향사 라벤더', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2300, enrage: 185, manaCoef: 1.0, diffs: ALL, script: 'lavender20', stage: 0.3, debuffs: ['저주'] },
  // 던전 ㉔ 백합 향수 공방 (Lv 23): 일반 향수병 진열실 → 라벤더 → 정예 꽃잎 증류실 → 공방 주인 마담 로즈
  bottlehall: trash('bottlehall', '향수병 진열실', [
    { name: '빈 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  lavender: { key: 'lavender', lowLevel: true, name: '향수 조향사 라벤더', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4500, enrage: 190, manaCoef: 1.0, diffs: ALL, script: 'lavender', stage: 0.25, debuffs: ['저주'] },
  stillroom: trash('stillroom', '꽃잎 증류실', [
    { name: '빈 갑옷 시종', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 베일 조문객', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '검은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '검은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
    {
      name: '유령 사냥개', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'howl', name: '울부짖음', icon: '울부', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['저주'] }),
  rose: { key: 'rose', lowLevel: true, name: '공방 주인 마담 로즈', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'rose', stage: 0.25, debuffs: ['저주'] },
  // 탐험 ㉚ 얼음 호수 낚시터 (Lv 25): 얼음 룬 인형 ×2 + 견습 마법사 → 눈사람 조수 뽀득이 (줄 피해)
  iceholes: trash('iceholes', '얼음 구멍 줄', [
    { name: '얼음 룬 인형', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  ppodeuk25: { key: 'ppodeuk25', lowLevel: true, name: '눈사람 조수 뽀득이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2400, enrage: 190, manaCoef: 1.0, diffs: ALL, script: 'ppodeuk25', stage: 0.3, debuffs: ['마법'] },
  // 던전 ㉕ 눈꽃 연구소 (Lv 28): 일반 실험 도구 창고 → 뽀득이 → 정예 냉동 보관실 → 서리 연구원 아이시아
  toolstore: trash('toolstore', '실험 도구 창고', [
    { name: '얼음 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  ppodeuk: { key: 'ppodeuk', lowLevel: true, name: '눈사람 조수 뽀득이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4800, enrage: 190, manaCoef: 1.0, diffs: ALL, script: 'ppodeuk', stage: 0.25, debuffs: ['마법'] },
  coldstore: trash('coldstore', '냉동 보관실', [
    { name: '얼음 룬 인형', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
    {
      name: '서리 정령', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '냉기 폭발', icon: '냉기', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  icia: { key: 'icia', lowLevel: true, name: '서리 연구원 아이시아', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6400, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'icia', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㉛ 해바라기 수확밭 (Lv 30): 돌 수도사 ×2 + 길 잃은 순례자 (청소약) → 허수아비 기사 짚단 (보호막 분신)
  sheaves: trash('sheaves', '이삭 더미 길', [
    { name: '돌 수도사', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '길 잃은 순례자', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'soap', name: '엉뚱한 물약', icon: '물약', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: soaps(0.7) } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: HEAL4 }),
  jipdan30: { key: 'jipdan30', lowLevel: true, name: '허수아비 기사 짚단', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1900, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'jipdan30', stage: 0.3, debuffs: HEAL4 },
  // ---------- 묶음 H2 (62 2-2 · 3-2, Lv 33~58): 졸개는 그 세력 옛 졸개, 보스 체력 · 광폭화는 같은 레벨대 던전 줄 ----------
  // 던전 ㉖ 황금 이삭 곡물창고 (Lv 33): 일반 곡물 자루 창고 → 허수아비 기사 짚단 → 정예 방앗간 바퀴 → 곡물창고 수호상 낟알
  sacks: trash('sacks', '곡물 자루 창고', [
    { name: '돌 수도사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '다락 박쥐 떼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  jipdan: { key: 'jipdan', lowLevel: true, name: '허수아비 기사 짚단', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4400, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'jipdan', stage: 0.25, debuffs: ['질병'] },
  millwheel: trash('millwheel', '방앗간 바퀴', [
    { name: '돌 수도사', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '길 잃은 순례자', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'soap', name: '엉뚱한 물약', icon: '물약', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: soaps() } },
    ] },
    {
      name: '신전 돌거인', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'wheel', name: '방앗간 바퀴 굴리기', icon: '바퀴', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: HEAL4 }),
  nadal: { key: 'nadal', lowLevel: true, name: '곡물창고 수호상 낟알', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'nadal', stage: 0.25, debuffs: HEAL4 },
  // 탐험 ㉜ 허수아비 들판 (Lv 34): 돌 수도사 ×2 + 신전 돌거인 (정예 아님) → 곡물창고 수호상 낟알 (탐험판)
  crowfield: trash('crowfield', '까마귀 밭', [
    { name: '돌 수도사', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '신전 돌거인', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  nadal34: { key: 'nadal34', lowLevel: true, name: '곡물창고 수호상 낟알', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2300, enrage: 205, manaCoef: 1.0, diffs: ALL, script: 'nadal34', stage: 0.3, debuffs: HEAL4 },
  // 던전 ㉗ 산호 동굴 밀수굴 (Lv 38): 일반 젖은 동굴 입구 → 밀수꾼 두목 외눈 페그 → 정예 화약 창고 → 동굴 해마 기사 파도
  wetcave: trash('wetcave', '젖은 동굴 입구', [
    { name: '갑판 청소부', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '새총 꼬마 해적', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  peg: { key: 'peg', lowLevel: true, name: '밀수꾼 두목 외눈 페그', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4600, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'peg', stage: 0.25, debuffs: ['독'] },
  powder: trash('powder', '화약 창고', [
    { name: '갑판 청소부', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '해파리 점쟁이', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'fortune', name: '해파리 점괘', icon: '점괘', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'cycle', n: 1, debuffs: [
          { name: '해파리 독', type: '독', left: 10, dot: 12 },
          { name: '나쁜 점괘', type: '저주', left: 10, healCut: 0.3 },
        ] } },
    ] },
    {
      name: '화약 창고지기', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'keg', name: '화약통 굴리기', icon: '화약', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독', '저주'] }),
  pado: { key: 'pado', lowLevel: true, name: '동굴 해마 기사 파도', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'pado', stage: 0.25, debuffs: ['저주'] },
  // 탐험 ㉝ 산호초 얕은 물 (Lv 38): 갑판 청소부 ×2 + 새총 꼬마 해적 → 외눈 페그 (탐험판)
  reefpool: trash('reefpool', '산호 웅덩이', [
    { name: '갑판 청소부', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '새총 꼬마 해적', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  peg38: { key: 'peg38', lowLevel: true, name: '밀수꾼 두목 외눈 페그', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2300, enrage: 205, manaCoef: 1.0, diffs: ALL, script: 'peg38', stage: 0.3, debuffs: ['독'] },
  // 탐험 ㉞ 서리 마탑 정원 (Lv 42): 얼음 룬 인형 ×2 + 견습 마법사 → 견습생 쌍둥이 지지 · 직직 (탐험판, 몸 둘 = 체력 반씩)
  iceflowers: trash('iceflowers', '얼음 꽃밭', [
    { name: '얼음 룬 인형', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  jiji42: { key: 'jiji42', lowLevel: true, name: '견습생 쌍둥이 지지 · 직직', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'jiji42', stage: 0.3, debuffs: ['마법'] },
  // 던전 ㉘ 마도사 기숙사 (Lv 43): 일반 어질러진 복도 → 지지 · 직직 → 정예 금지된 휴게실 → 사감 마도사 엄격이
  messhall: trash('messhall', '어질러진 복도', [
    { name: '얼음 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  jiji: { key: 'jiji', lowLevel: true, name: '견습생 쌍둥이 지지 · 직직', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5600, enrage: 235, manaCoef: 1.0, diffs: ALL, script: 'jiji', stage: 0.25, debuffs: ['마법'] },
  lounge: trash('lounge', '금지된 휴게실', [
    { name: '얼음 룬 인형', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
    {
      name: '서리 정령', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '냉기 폭발', icon: '냉기', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  eomgyeok: { key: 'eomgyeok', lowLevel: true, name: '사감 마도사 엄격이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'eomgyeok', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㉟ 교단 숲속 야영지 (Lv 46): 교단 신도 ×2 + 부리 가면 집행자 (부패) → 약품 수도사 거품이 (탐험판)
  campfire: trash('campfire', '모닥불 야영지', [
    { name: '교단 신도', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '부리 가면 집행자', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병'] }),
  // 체력 2026-10-27 Lim 「교단숲속야영지의 탐험이 너무 지루하다」: 2400 → 1700 (보통 226 → 약 160초)
  geopum46: { key: 'geopum46', lowLevel: true, name: '약품 수도사 거품이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1700, enrage: 205, manaCoef: 1.0, diffs: ALL, script: 'geopum46', stage: 0.3, debuffs: ['질병'] },
  // 던전 ㉙ 교단 약품 제조실 (Lv 48): 일반 약병 선반 복도 → 거품이 → 정예 끓는 솥 방 → 역병 대사제 말로스
  shelves: trash('shelves', '약병 선반 복도', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  geopum: { key: 'geopum', lowLevel: true, name: '약품 수도사 거품이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5000, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'geopum', stage: 0.25, debuffs: ['질병'] },
  cauldron: trash('cauldron', '끓는 솥 방', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'rot', name: '부패', icon: '부패', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } },
    ] },
    {
      name: '부리 가면 집행자', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'pour', name: '끓는 솥 엎기', icon: '솥', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병'] }),
  malos: { key: 'malos', lowLevel: true, name: '역병 대사제 말로스', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6800, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'malos', stage: 0.25, debuffs: ['질병'] },
  // 탐험 ㊱ 왕도 지붕길 (Lv 50): 교단 신도 ×2 + 다락 박쥐 떼 → 역병 대사제 말로스 (탐험판)
  tiles: trash('tiles', '기와 지붕', [
    { name: '교단 신도', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '다락 박쥐 떼', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병'] }),
  // 체력 2026-10-27 Lim 「지붕길」 (교단 숲속 야영지처럼 지루함): 2400 → 1500
  malos50: { key: 'malos50', lowLevel: true, name: '역병 대사제 말로스', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'malos50', stage: 0.3, debuffs: ['질병'] },
  // 던전 ㉚ 반딧불 빵집 (Lv 53): 일반 밀가루 창고 → 밀가루 요정 폴폴 → 정예 오븐 앞 → 케이크 골렘 몽글이
  flourstore: trash('flourstore', '밀가루 창고', [
    { name: '버섯 꼬마 경비', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '꽃가루 요정', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  polpol: { key: 'polpol', lowLevel: true, name: '밀가루 요정 폴폴', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5000, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'polpol', stage: 0.25, debuffs: ['질병', '마법'] },
  oven: trash('oven', '오븐 앞', [
    { name: '버섯 꼬마 경비', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '재채기 버섯', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sneeze', name: '에취!', icon: '에취', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: sneeze() } },
    ] },
    {
      name: '큰 갓 버섯 거인', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'heat', name: '오븐 열기', icon: '열기', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병', '마법'] }),
  monggeul: { key: 'monggeul', lowLevel: true, name: '케이크 골렘 몽글이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6400, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'monggeul', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㊲ 이슬 버섯 언덕 (Lv 54): 버섯 꼬마 경비 ×2 + 꽃가루 요정 → 밀가루 요정 폴폴 (탐험판)
  dewpath: trash('dewpath', '이슬 버섯길', [
    { name: '버섯 꼬마 경비', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '꽃가루 요정', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  polpol54: { key: 'polpol54', lowLevel: true, name: '밀가루 요정 폴폴', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2400, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'polpol54', stage: 0.3, debuffs: ['질병', '마법'] },
  // 탐험 ㊳ 버섯숲 늪가 (Lv 58): 늪 창병 ×2 + 독침 사냥꾼 → 개구리 근위대장 폴짝 (탐험판)
  mushpath: trash('mushpath', '버섯 늪 길', [
    { name: '늪 창병', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '독침 사냥꾼', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sting', name: '독침', icon: '독침', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 10, dot: 9, stackMax: 3 } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['독'] }),
  poljjak58: { key: 'poljjak58', lowLevel: true, name: '개구리 근위대장 폴짝', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'poljjak58', stage: 0.3, debuffs: ['독'] },
  // 던전 ㉛ 두꺼비 왕국 수련궁 (Lv 58): 일반 수련 다리 → 폴짝 → 정예 올챙이 연못 → 두꺼비 왕 우물룩
  lilybridge: trash('lilybridge', '수련 다리', [
    { name: '늪 창병', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '진흙 투석꾼', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  poljjak: { key: 'poljjak', lowLevel: true, name: '개구리 근위대장 폴짝', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5100, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'poljjak', stage: 0.25, debuffs: ['독'] },
  tadpond: trash('tadpond', '올챙이 연못', [
    { name: '늪 창병', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '독침 사냥꾼', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'sting', name: '독침', icon: '독침', to: 'other', dmg: 0, first: 5, period: 10, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 10, dot: 9, stackMax: 3 } } },
    ] },
    {
      name: '독 혹 두꺼비', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '독 혹 터뜨리기', icon: '독혹', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독'] }),
  umulluk: { key: 'umulluk', lowLevel: true, name: '두꺼비 왕 우물룩', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6400, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'umulluk', stage: 0.25 },
  // ---------- 묶음 H3 (62 2-3 · 3-3, Lv 62~78): 졸개는 그 세력 옛 졸개, 보스 체력 · 광폭화는 같은 레벨대 던전 줄 (무적 · 감옥처럼 딜 시간을 먹는 보스는 낮춤) ----------
  // 탐험 ㊴ 용 비늘 채석장 (Lv 62): 코볼트 곡괭이꾼 ×2 + 불씨 꼬마 용 → 코볼트 대장장이 땜질이 (탐험판)
  scalepile: trash('scalepile', '비늘 돌 더미', [
    { name: '코볼트 곡괭이꾼', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '불씨 꼬마 용', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  ttemjil62: { key: 'ttemjil62', lowLevel: true, name: '코볼트 대장장이 땜질이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'ttemjil62', stage: 0.3, debuffs: ['마법'] },
  // 던전 ㉜ 코볼트 불꽃 공방 (Lv 63): 일반 숯 창고 → 코볼트 대장장이 땜질이 → 정예 풀무 통로 → 불도마뱀 조련사 활활
  charcoal: trash('charcoal', '숯 창고', [
    { name: '코볼트 곡괭이꾼', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '불씨 꼬마 용', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  ttemjil: { key: 'ttemjil', lowLevel: true, name: '코볼트 대장장이 땜질이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5300, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'ttemjil', stage: 0.25, debuffs: ['독', '마법'] },
  bellowway: trash('bellowway', '풀무 통로', [
    { name: '코볼트 곡괭이꾼', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '코볼트 연기 주술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'smoke', name: '매캐한 연기', icon: '연기', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: KOBOLD_SMOKE } },
    ] },
    {
      name: '용 비늘 경비병', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'flame', name: '풀무 불길', icon: '불길', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독', '마법'] }),
  hwalhwal: { key: 'hwalhwal', lowLevel: true, name: '불도마뱀 조련사 활활', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6800, enrage: 280, manaCoef: 1.0, diffs: ALL, script: 'hwalhwal', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㊵ 용암 강 나룻터 (Lv 66): 용 비늘 경비병 ×2 + 코볼트 연기 주술사 → 용암 거북 지글이 (탐험판)
  hotdock: trash('hotdock', '뜨거운 나루', [
    { name: '용 비늘 경비병', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '코볼트 연기 주술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'smoke', name: '매캐한 연기', icon: '연기', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: KOBOLD_SMOKE } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['독', '마법'] }),
  jigeul66: { key: 'jigeul66', lowLevel: true, name: '용암 거북 지글이', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'jigeul66', stage: 0.3, debuffs: ['독'] },
  // 던전 ㉝ 용암 거북 동굴 (Lv 68): 일반 김 나는 굴 → 용암 거북 지글이 (등껍질 무적 12초만큼 체력 낮춤) → 정예 보석 광맥 → 붉은 용 큰언니 가넷
  steamcave: trash('steamcave', '김 나는 굴', [
    { name: '용 비늘 경비병', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '불씨 꼬마 용', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  jigeul: { key: 'jigeul', lowLevel: true, name: '용암 거북 지글이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4700, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'jigeul', stage: 0.25, debuffs: ['독'] },
  gemvein: trash('gemvein', '보석 광맥', [
    { name: '코볼트 곡괭이꾼', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '코볼트 연기 주술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'smoke', name: '매캐한 연기', icon: '연기', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: KOBOLD_SMOKE } },
    ] },
    {
      name: '용 비늘 경비병', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'shards', name: '보석 파편 튀기기', icon: '보석', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['독', '마법'] }),
  garnet: { key: 'garnet', lowLevel: true, name: '붉은 용 큰언니 가넷', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7000, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'garnet', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㊶ 물안개 광장 (Lv 70): 공허의 종복 ×2 + 심연 전령 (봉인) → 산호 정원사 말미잘 (탐험판)
  miststeps: trash('miststeps', '물안개 계단', [
    { name: '공허의 종복', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '심연 전령', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'seal', name: '심연 봉인', icon: '봉인', to: 'other', dmg: 0, first: 5, period: 14, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '심연 봉인', type: '마법', left: 8, trap: true, end: { p: 'blast', dmg: 110 } } } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['마법'] }),
  malmijal70: { key: 'malmijal70', lowLevel: true, name: '산호 정원사 말미잘', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'malmijal70', stage: 0.3, debuffs: ['독'] },
  // 던전 ㉞ 물밑 산호 정원 (Lv 73): 일반 해초 회랑 → 산호 정원사 말미잘 (감옥) → 정예 진주 연못 → 해파리 기사 찰랑 (감옥 · 4유형)
  kelphall: trash('kelphall', '해초 회랑', [
    { name: '공허의 종복', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '검은 눈', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  malmijal: { key: 'malmijal', lowLevel: true, name: '산호 정원사 말미잘', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4400, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'malmijal', stage: 0.25, debuffs: ['독'] },
  pearlpond: trash('pearlpond', '진주 연못', [
    { name: '공허의 종복', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '심연 전령', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'seal', name: '심연 봉인', icon: '봉인', to: 'other', dmg: 0, first: 5, period: 14, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '심연 봉인', type: '마법', left: 8, trap: true, end: { p: 'blast', dmg: 150 } } } },
    ] },
    {
      name: '탑 감시자', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'pearl', name: '진주 물결', icon: '물결', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  chalrang: { key: 'chalrang', lowLevel: true, name: '해파리 기사 찰랑', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6500, enrage: 280, manaCoef: 1.0, diffs: ALL, script: 'chalrang', stage: 0.25, debuffs: HEAL4 },
  // 탐험 ㊷ 모래 언덕 오아시스 (Lv 74): 모래 병정 ×2 + 풍뎅이 투석병 → 두루마리 미라 사서 바스락 (탐험판)
  palmshade: trash('palmshade', '야자 그늘', [
    { name: '모래 병정', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '풍뎅이 투석병', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  baseurak74: { key: 'baseurak74', lowLevel: true, name: '두루마리 미라 사서 바스락', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 215, manaCoef: 1.0, diffs: ALL, script: 'baseurak74', stage: 0.3, debuffs: ['질병', '저주'] },
  // 던전 ㉟ 모래 서기관 도서관 (Lv 78): 일반 모래 덮인 서가 → 두루마리 미라 사서 바스락 → 정예 봉인 서고 → 모래 서기관 깃펜
  sandshelf: trash('sandshelf', '모래 덮인 서가', [
    { name: '모래 병정', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '풍뎅이 투석병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  baseurak: { key: 'baseurak', lowLevel: true, name: '두루마리 미라 사서 바스락', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5400, enrage: 235, manaCoef: 1.0, diffs: ALL, script: 'baseurak', stage: 0.25, debuffs: ['질병', '저주'] },
  sealedstack: trash('sealedstack', '봉인 서고', [
    { name: '모래 병정', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '붕대 시종', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'wrap', name: '하품 붕대', icon: '붕대', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: SAND_WRAP } },
    ] },
    {
      name: '스핑크스 석상', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'storm', name: '봉인 모래바람', icon: '모래', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['질병', '저주'] }),
  gitpen: { key: 'gitpen', lowLevel: true, name: '모래 서기관 깃펜', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7000, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'gitpen', stage: 0.25, debuffs: ['저주'] },
  // 탐험 ㊸ 노을 해시계 길 (Lv 78): 붕대 시종 ×2 + 스핑크스 석상 (수수께끼 모래 = 붕대 시종의 질병 → 저주) → 모래 서기관 깃펜 (탐험판)
  obelisks: trash('obelisks', '해시계 기둥 길', [
    { name: '붕대 시종', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '스핑크스 석상', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'riddle', name: '수수께끼 모래', icon: '모래', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: SAND_WRAP } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['질병', '저주'] }),
  gitpen78: { key: 'gitpen78', lowLevel: true, name: '모래 서기관 깃펜', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 215, manaCoef: 1.0, diffs: ALL, script: 'gitpen78', stage: 0.3, debuffs: ['저주'] },
  // ---------- 묶음 H4 (62 2-4 · 3-4, Lv 82~100): 졸개는 그 세력 옛 졸개, 보스 체력 · 광폭화는 같은 레벨대 던전 줄 (① 5,800 · 4:00, ② 7,200 · 5:00, 탐험판 3,000~3,300) ----------
  // 탐험 ㊹ 구름 다리 (Lv 82): 깃털 창병 하피 ×2 + 폭풍 점술사 → 하피 교관 휘파람 (탐험판)
  swaybridge: trash('swaybridge', '흔들 구름 다리', [
    { name: '깃털 창병 하피', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '폭풍 점술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '폭풍 점괘', icon: '점괘', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: STORM_HEX } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: ['저주', '마법'] }),
  hwiparam82: { key: 'hwiparam82', lowLevel: true, name: '하피 교관 휘파람', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'hwiparam82', stage: 0.3, debuffs: ['저주'] },
  // 던전 ㊱ 깃털단 비행 훈련장 (Lv 83): 일반 활공 연습장 → 하피 교관 휘파람 → 정예 바람 터널 → 바람 정령 회오리
  glideyard: trash('glideyard', '활공 연습장', [
    { name: '깃털 창병 하피', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '바람 요정', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  hwiparam: { key: 'hwiparam', lowLevel: true, name: '하피 교관 휘파람', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'hwiparam', stage: 0.25, debuffs: ['저주'] },
  windtunnel: trash('windtunnel', '바람 터널', [
    { name: '깃털 창병 하피', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '폭풍 점술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '폭풍 점괘', icon: '점괘', to: 'other', dmg: 0, first: 5, period: 12, cast: 0, effect: { p: 'cycle', n: 1, debuffs: STORM_HEX } },
    ] },
    {
      name: '천둥 숫양', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'ram', name: '터널 돌진', icon: '박치', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['저주', '마법'] }),
  hoeori: { key: 'hoeori', lowLevel: true, name: '바람 정령 회오리', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7200, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'hoeori', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㊺ 번개 구름 목초지 (Lv 86): 바람 요정 ×2 + 천둥 숫양 (정예 아님) → 바람 정령 회오리 (탐험판)
  zapgrass: trash('zapgrass', '찌릿 풀밭', [
    { name: '바람 요정', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '천둥 숫양', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  hoeori86: { key: 'hoeori86', lowLevel: true, name: '바람 정령 회오리', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'hoeori86', stage: 0.3, debuffs: ['마법'] },
  // 던전 ㊲ 구름 도서관 탑 (Lv 88): 일반 떠다니는 서가 → 날아다니는 책 펄럭이 (쫄 떼라 체력 −10%) → 정예 금서 계단 → 사서 유령 쉿
  floatshelf: trash('floatshelf', '떠다니는 서가', [
    { name: '구름 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '빗자루 견습생', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  peoleok: { key: 'peoleok', lowLevel: true, name: '날아다니는 책 펄럭이', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5200, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'peoleok', stage: 0.25, debuffs: ['마법'] },
  forbidstair: trash('forbidstair', '금서 계단', [
    { name: '구름 룬 인형', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '떠도는 주술서', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'silence', name: '침묵', icon: '침묵', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '침묵', type: '마법', left: 6, noDps: true } } },
    ] },
    {
      name: '번개 실험 정령', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '금서 번개', icon: '번개', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['마법'] }),
  swit: { key: 'swit', lowLevel: true, name: '사서 유령 쉿', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7200, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'swit', stage: 0.25, debuffs: ['마법'] },
  // 탐험 ㊻ 빗자루 경주로 (Lv 90): 빗자루 견습생 ×2 + 구름 룬 인형 → 사서 유령 쉿 (탐험판)
  startline: trash('startline', '경주 출발선', [
    { name: '빗자루 견습생', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '구름 룬 인형', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  swit90: { key: 'swit90', lowLevel: true, name: '사서 유령 쉿', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2500, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'swit90', stage: 0.3, debuffs: ['마법'] },
  // 던전 ㊳ 가라앉은 장미 정원 (Lv 93): 일반 물에 잠긴 회랑 → 정원사 유령 가위손 → 정예 장미 미로 → 대공비 유령 로살린
  drownhall: trash('drownhall', '물에 잠긴 회랑', [
    { name: '물에 젖은 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '가라앉은 유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  gawison: { key: 'gawison', lowLevel: true, name: '정원사 유령 가위손', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'gawison', stage: 0.25, debuffs: ['저주'] },
  thornmaze: trash('thornmaze', '장미 미로', [
    { name: '물에 젖은 갑옷 시종', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '물에 젖은 조문객', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'veil', name: '젖은 베일', icon: '베일', to: 'other', dmg: 0, first: 5, period: 12, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '젖은 베일', type: '저주', left: 12, healCut: 0.5 } } },
    ] },
    {
      name: '가라앉은 사냥개', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'howl', name: '가시 울부짖음', icon: '울부', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: ['저주'] }),
  rosalin: { key: 'rosalin', lowLevel: true, name: '대공비 유령 로살린', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7200, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'rosalin', stage: 0.25, debuffs: ['저주'] },
  // 탐험 ㊼ 호수 밑 연꽃길 (Lv 94): 물에 젖은 갑옷 시종 ×2 + 가라앉은 유령 하녀 → 정원사 유령 가위손 (탐험판)
  lotusstep: trash('lotusstep', '연꽃 징검다리', [
    { name: '물에 젖은 갑옷 시종', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '가라앉은 유령 하녀', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  gawison94: { key: 'gawison94', lowLevel: true, name: '정원사 유령 가위손', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'gawison94', stage: 0.3, debuffs: ['저주'] },
  // 탐험 ㊿ 물빛 정원 (Lv 97): 그림자 기사 ×2 + 함정 술사 → 마지막 메아리 (탐험판)
  glowpond: trash('glowpond', '물빛 연못', [
    { name: '그림자 기사', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '함정 술사', hp: 150, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '그림자 주문', icon: '주문', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: trapHex(0.7) } },
    ] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3, debuffs: HEAL4 }),
  lastecho97: { key: 'lastecho97', lowLevel: true, name: '마지막 메아리', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'lastecho97', stage: 0.3 },
  // 던전 ㊴ 심연 정예 병영 (Lv 98): 일반 훈련 마당 → 그림자 훈련교관 칼날 → 정예 무기 창고 → 심연 쌍둥이 기사 흑 · 백 (몸 둘 = 3,600 × 2)
  drillyard: trash('drillyard', '훈련 마당', [
    { name: '그림자 기사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '그림자 석궁수', hp: 300, count: 1, attacks: [{ key: 'shot', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  kalnal: { key: 'kalnal', lowLevel: true, name: '그림자 훈련교관 칼날', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'kalnal', stage: 0.25, debuffs: ['독', '질병', '마법'] },
  weaponrack: trash('weaponrack', '무기 창고', [
    { name: '그림자 기사', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '함정 술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '그림자 주문', icon: '주문', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: trapHex(1) } },
    ] },
    {
      name: '심연 거수', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'root', name: '무기 더미 내려찍기', icon: '뿌리', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: HEAL4 }),
  heukbaek: { key: 'heukbaek', lowLevel: true, name: '심연 쌍둥이 기사 흑 · 백', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7200, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'heukbaek', stage: 0.25, debuffs: HEAL4 },
  // 탐험 ㊽ 그림자 초소 (Lv 98): 그림자 기사 + 그림자 석궁수 ×2 → 그림자 훈련교관 칼날 (탐험판)
  palisade: trash('palisade', '초소 울타리', [
    { name: '그림자 기사', hp: 160, count: 1, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '그림자 석궁수', hp: 150, count: 2, attacks: [{ key: 'shot', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  kalnal98: { key: 'kalnal98', lowLevel: true, name: '그림자 훈련교관 칼날', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'kalnal98', stage: 0.3, debuffs: ['마법'] },
  // 던전 ㊵ 별빛 수정 동굴 (Lv 99): 일반 수정 계단 → 수정 거인 반짝돌 → 정예 메아리 회랑 → 마지막 메아리
  crystalstair: trash('crystalstair', '수정 계단', [
    { name: '그림자 기사', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '그림자 석궁수', hp: 300, count: 1, attacks: [{ key: 'shot', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  banjjak: { key: 'banjjak', lowLevel: true, name: '수정 거인 반짝돌', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'banjjak', stage: 0.25, debuffs: HEAL4 },
  echohall: trash('echohall', '메아리 회랑', [
    { name: '그림자 기사', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '함정 술사', hp: 300, count: 1, attacks: [
      { key: 'hit', to: 'other', dmg: 50, jitter: 0.2, first: 3, period: 3, cast: 0 },
      { key: 'hex', name: '그림자 주문', icon: '주문', to: 'other', dmg: 0, first: 5, period: 10, cast: 0, effect: { p: 'cycle', n: 1, debuffs: trapHex(1) } },
    ] },
    {
      name: '심연 거수', elite: true, hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'root', name: '메아리 내려찍기', icon: '뿌리', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3, cut: true },
      ],
    },
  ], { debuffs: HEAL4 }),
  lastecho: { key: 'lastecho', lowLevel: true, name: '마지막 메아리', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6800, enrage: 300, manaCoef: 1.0, diffs: ALL, script: 'lastecho', stage: 0.25, debuffs: HEAL4 },
  // 탐험 ㊾ 아침 햇살 언덕 (Lv 99): 돌 수도사 ×2 + 신전 돌거인 (정예 아님) → 수정 거인 반짝돌 (탐험판)
  sunpath: trash('sunpath', '햇살 언덕길', [
    { name: '돌 수도사', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '신전 돌거인', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 80, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  banjjak99: { key: 'banjjak99', lowLevel: true, name: '수정 거인 반짝돌', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 2600, enrage: 230, manaCoef: 1.0, diffs: ALL, script: 'banjjak99', stage: 0.3, debuffs: HEAL4 },
  // ---------- 113 초반 보충 장소 1차 (Lv 5~8): 원본 반복판을 대신하는 새 장소. 던전 = 일반 → 정예 (최종 보스 판단 예습) → 일반 → 보스, 탐험 = 일반 → 보스 ----------
  // 체력 · 광폭화는 원본 장소 줄 (녹슨 요새 · 녹슨 광산 · 잿빛 공동묘지 · 잿빛 뒷골목), 클리어율은 밸런스 단계에서 맞춤
  // S01 황동 압착장 (Lv 5 · 녹슨 요새): 연속 강타 사이 회복
  pressgate: trash('pressgate', '휘어진 철문', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  pressguard: trash('pressguard', '고철 망치병', [
    { ...CHAFF, count: 2 },
    {
      name: '고철 망치병', elite: true, hp: 800, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        // 최종 보스 연속 압착의 예습: 망치 두 번 (7초 사이)
        { key: 'ham1', name: '망치 내려찍기', icon: '망치', kind: 'buster', to: 'tank', dmg: 150, first: 8, period: 20, cast: 3 },
        { key: 'ham2', name: '망치 내려찍기', icon: '망치', kind: 'buster', to: 'tank', dmg: 150, first: 15, period: 20, cast: 3 },
      ],
    },
  ]),
  pressway: trash('pressway', '압착기 통로', [
    { ...CHAFF, count: 2 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  kkuksoe: { key: 'kkuksoe', lowLevel: true, name: '압착 골렘 꾹쇠', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'kkuksoe', stage: 0.25 },
  // S02 냉각수 배관실 (Lv 6 · 녹슨 광산): 진동 전후 시전 배분
  leakhall: trash('leakhall', '물 샌 복도', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  pipefixer: trash('pipefixer', '배관 수리병', [
    { ...CHAFF, count: 2 },
    {
      name: '배관 수리병', elite: true, hp: 800, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        // 최종 보스 진동의 예습: 약한 렌치 진동 (시전 1초 잠김)
        { key: 'quake', name: '렌치 진동', icon: '진동', kind: 'aoe', to: 'all', dmg: 0, first: 9, period: 18, cast: 4, effect: { p: 'quake', dmg: 40, lock: 1 } },
      ],
    },
  ]),
  coolway: trash('coolway', '냉각 통로', [
    { ...CHAFF, count: 2 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  chiik: { key: 'chiik', lowLevel: true, name: '밸브지기 치익', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'chiik', stage: 0.25 },
  // S03 버려진 정비동 (Lv 6 · 녹슨 광산): 아군과 보조 대상 사이 선택. 정예 (보스 ①)는 영혼 (수리 정령) 매 틱 갱신이 있어 보스 스크립트
  partshelf: trash('partshelf', '부품 선반', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  cutter: { key: 'cutter', lowLevel: true, name: '고장 난 절삭기', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 2600, enrage: 150, manaCoef: 1.0, diffs: ALL, script: 'cutter', stage: 0.25 },
  workbench: trash('workbench', '정비 작업대', [
    { ...CHAFF, count: 2 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  deolkeok: { key: 'deolkeok', lowLevel: true, name: '고철 감독관 덜컥', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 4800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'deolkeok', stage: 0.25 },
  // S04 반딧불 묘지길 (Lv 7 · 잿빛 공동묘지): 전투를 단축하는 구조
  darkpath: trash('darkpath', '꺼진 묘지길', [
    { name: '되살아난 뼈', hp: 150, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 150, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  huuk: { key: 'huuk', lowLevel: true, name: '등불 도둑 후욱', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1700, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'huuk', stage: 0.3 },
  // S05 묘지 곡소리 언덕 (Lv 7 · 잿빛 공동묘지): 광역 피해 사이 회복 (113 원안 「종지기」는 종 금지 (58 1-2)라 곡쟁이로)
  wailpath: trash('wailpath', '울음 언덕길', [
    { name: '되살아난 뼈', hp: 150, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 150, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 70, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  heuneuk: { key: 'heuneuk', lowLevel: true, name: '곡쟁이 흐느낌', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1700, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'heuneuk', stage: 0.3 },
  // S06 오염된 빨래터 (Lv 8 · 잿빛 뒷골목): 해제 우선순위
  soakalley: trash('soakalley', '축축한 골목', [
    { name: '교단 신도', hp: 150, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 150, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  eolluk: { key: 'eolluk', lowLevel: true, name: '빨래지기 얼룩', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1900, enrage: 170, manaCoef: 1.0, diffs: ALL, script: 'eolluk', stage: 0.3, debuffs: ['질병'] },
  // S07 잿바람 골목 (Lv 8 · 잿빛 뒷골목): 맞을 사람 미리 회복 (못 피하는 줄 피해 + 피하는 먼지)
  ashpile: trash('ashpile', '재 쌓인 골목', [
    { name: '교단 신도', hp: 150, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '잔해 투척병', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 75, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  puseokash: { key: 'puseokash', lowLevel: true, name: '굴뚝 청소꾼 푸석', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1800, enrage: 170, manaCoef: 1.0, diffs: ALL, script: 'puseokash', stage: 0.3 },
  // ---------- 113 초반 보충 장소 2차 (Lv 9~12): 역병 지하묘지 · 역병 약초 온실 · 역병 수로 · 교단 숲속 야영지 반복판 대신 ----------
  // 정예 구간: 매 틱 갱신이 필요한 기믹 (영혼 · 감옥)은 보스 스크립트 하나 (보스 ①), 나머지는 일반 구간 정예 공격으로 예습 (113 5장)
  // S08 밀랍 봉인실 (Lv 9 · 역병 지하묘지): 치유로 딜러 복귀
  waxhall: trash('waxhall', '초 녹인 복도', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  waxdoll: trash('waxdoll', '밀랍 인형', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    {
      name: '밀랍 인형', elite: true, hp: 800, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        // 최종 보스 밀랍 굳음의 예습: 딜러 한 명이 굳음 (체력 75%까지 채우면 풀림)
        { key: 'wax', name: '밀랍 튀기기', icon: '밀랍', to: 'other', dmg: 0, first: 8, period: 20, cast: 0,
          effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '밀랍 굳음', type: '물리', left: 10, lock: true, noDps: true, cureAt: 0.75, dropPct: 0.3 } } },
      ],
    },
  ]),
  sealstore: trash('sealstore', '봉인 창고', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  chorereu: { key: 'chorereu', lowLevel: true, name: '봉인사 초르르', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5600, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'chorereu', stage: 0.25 },
  // S09 검은 향로 보관실 (Lv 9 · 역병 지하묘지): 쫄 처리 중 마나 관리
  incensepass: trash('incensepass', '향 가루 통로', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  censerguard: trash('censerguard', '검은 향로병', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    {
      name: '검은 향로병', elite: true, hp: 800, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        // 최종 보스 향로의 예습: 검은 연기가 내 마나를 조금씩 빼앗음 (해제 안 됨, 짧게)
        { key: 'smoke', name: '검은 연기', icon: '연기', to: 'other', dmg: 0, first: 8, period: 20, cast: 0,
          effect: { p: 'debuff', n: 1, pick: 'me', debuff: { name: '검은 연기', type: '물리', left: 8, lock: true, drain: 0.4 } } },
      ],
    },
  ]),
  brokencase: trash('brokencase', '부서진 진열장', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  huljjeok: { key: 'huljjeok', lowLevel: true, name: '향로지기 훌쩍', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5600, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'huljjeok', stage: 0.25, debuffs: ['질병'] },
  // S10 새싹 급수장 (Lv 10 · 역병 약초 온실): 별도 치유를 파티 회복으로 전환 (꽃의 파티 회복, 113 6.1)
  drycanal: trash('drycanal', '마른 수로', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  vineguard: { key: 'vineguard', lowLevel: true, name: '급수 경비덩굴', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 3000, enrage: 170, manaCoef: 1.0, diffs: ALL, script: 'vineguard', stage: 0.25 },
  seedbench: trash('seedbench', '씨앗 작업대', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  mallim: { key: 'mallim', lowLevel: true, name: '마른 덩굴 말림', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'mallim', stage: 0.25 },
  // S11 꽃가루 저장실 (Lv 10 · 역병 약초 온실): 피해가 옮겨 갈 때 치유 배분 (가시 갑옷)
  pollenshelf: trash('pollenshelf', '꽃가루 선반', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  thornporter: trash('thornporter', '가시 운반병', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    {
      name: '가시 운반병', elite: true, hp: 800, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        // 최종 보스 가시 외피의 예습: 짧은 가시 (때리는 딜러가 조금씩 아픔)
        { key: 'thorns', name: '가시 자루', icon: '가시', kind: 'aoe', to: 'all', dmg: 0, first: 9, period: 20, cast: 2, effect: { p: 'thorns', sec: 4, dmg: 12, tank: 0.5 } },
      ],
    },
  ]),
  sackstore: trash('sackstore', '자루 저장고', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  kkaseul: { key: 'kkaseul', lowLevel: true, name: '가시 자루 까슬', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'kkaseul', stage: 0.25 },
  // S12 갈라진 수문 (Lv 11 · 역병 수로): 강타 뒤 약한 사람 수습 (사냥), 이 보스엔 장판 없음
  floodhall: trash('floodhall', '물 터진 복도', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  gateshield: trash('gateshield', '수문 방패병', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    {
      name: '수문 방패병', elite: true, hp: 800, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        // 최종 보스 물살의 예습: 체력 비율이 가장 낮은 (탱커 아닌) 사람에게 물 튀기기
        { key: 'splash', name: '물 튀기기', icon: '물살', to: 'other', dmg: 0, first: 9, period: 18, cast: 2, effect: { p: 'hunt', dmg: 90 } },
      ],
    },
  ]),
  drainway: trash('drainway', '배수 통로', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  multeok: { key: 'multeok', lowLevel: true, name: '수문 파수꾼 물턱', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6200, enrage: 260, manaCoef: 1.0, diffs: ALL, script: 'multeok', stage: 0.25 },
  // S13 철창 배수실 (Lv 11 · 역병 수로): 갇힌 사람 버티게 하기 (감옥). 정예 (보스 ①)는 감옥 갱신이 있어 보스 스크립트
  sievehall: trash('sievehall', '거름망 복도', [
    { name: '되살아난 뼈', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '묘지 쥐떼', hp: 300, count: 1, attacks: [{ key: 'bite', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  clawguard: { key: 'clawguard', lowLevel: true, name: '집게 경비병', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 3200, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'clawguard', stage: 0.25 },
  cagepass: trash('cagepass', '철창 통로', [
    { name: '되살아난 뼈', hp: 400, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '교단 신도', hp: 300, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  kkwakjip: { key: 'kkwakjip', lowLevel: true, name: '철창 집게 꽉집', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 6000, enrage: 260, manaCoef: 1.0, diffs: ALL, script: 'kkwakjip', stage: 0.25 },
  // S14 붕대 보급천막 (Lv 12 · 교단 숲속 야영지): 치유 순서 바꾸기 (차례 ①②)
  bandageroad: trash('bandageroad', '흩어진 붕대길', [
    { name: '교단 신도', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '부리 가면 집행자', hp: 150, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  charye: { key: 'charye', lowLevel: true, name: '번호표 관리인 차례', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1700, enrage: 205, manaCoef: 1.0, diffs: ALL, script: 'charye', stage: 0.3 },
  // S15 야간 약초수레길 (Lv 12 · 교단 숲속 야영지): 정화와 집단 치료 중 선택 (약초 정령: 채우면 질병 하나씩)
  cartroad: trash('cartroad', '버려진 약초수레', [
    { name: '교단 신도', hp: 160, count: 2, attacks: [{ key: 'hit', to: 'tank', dmg: 70, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '부리 가면 집행자', hp: 150, count: 1, attacks: [{ key: 'hit', to: 'other', dmg: 60, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 일반', board: 'b7', comp: TRIO, stage: 0.3 }),
  humchim: { key: 'humchim', lowLevel: true, name: '약초 도둑 훔침', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1700, enrage: 205, manaCoef: 1.0, diffs: ALL, script: 'humchim', stage: 0.3, debuffs: ['질병'] },
};

/**
 * 광폭화 시간 배율 (2026-10-19 Lim 「광폭화 시간을 전체적으로 늘려주고」, 기획 102): 위 표의 광폭화 (초)에 한꺼번에 곱하고 5초 단위로 반올림.
 * 엔진 (bosses.ts enrageAt) · 전투 화면 · 공략 시트 · 자동 밸런스 목표 시간 (광폭화 ÷ 1.35)이 모두 이 값을 읽는다. 위 표의 숫자는 곱하기 전 값이다
 */
export const ENRAGE_MULT = 1.25;
for (const e of Object.values(ENCOUNTERS)) if (Number.isFinite(e.enrage)) e.enrage = Math.round((e.enrage * ENRAGE_MULT) / 5) * 5;

/** 프로토타입 엔진에도 있는 보스 (일치 테스트 대상) */
export const PROTO_ENCOUNTERS: EncounterKey[] = ['warden', 'plague'];
