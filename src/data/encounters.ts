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
  | 'platform' | 'pongpong88' | 'upsidehall' | 'pongpong' | 'boltlab' | 'dwijuk' | 'kwangkwang' | 'syungsyung' | 'eodugi';
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
  | 'pongpong88' | 'pongpong' | 'dwijuk' | 'kwangkwang' | 'syungsyung' | 'eodugi';

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
const sneeze = (x = 1): DebuffDef[] => [
  { name: '포자 기침', type: '질병', left: 10, dot: Math.round(600 * 0.02 * x) },
  { name: '요정 장난', type: '마법', left: 10, healCut: 0.3 },
];
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
};

/** 프로토타입 엔진에도 있는 보스 (일치 테스트 대상) */
export const PROTO_ENCOUNTERS: EncounterKey[] = ['warden', 'plague'];
