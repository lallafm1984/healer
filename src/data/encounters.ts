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
  | 'gullsand' | 'crab36' | 'wreckage' | 'goldbeard44' | 'crab' | 'cook' | 'morel' | 'gunner' | 'octo' | 'seawitch' | 'mimic' | 'parrot' | 'goldbeard';
export type ScriptKey = 'warden' | 'plague' | 'choir' | 'scrap' | 'trash' | 'collector3' | 'shaman8' | 'collector' | 'malchor' | 'butler13'
  | 'shaman' | 'toad' | 'seres' | 'golem18' | 'butler' | 'lady' | 'belmore' | 'guardian23'
  | 'frostgolem' | 'mage' | 'shadow' | 'keeper28' | 'guardian' | 'keeper' | 'plague33' | 'sentinel' | 'crystal'
  | 'hydra' | 'twins' | 'orben' | 'abysslord'
  | 'ratking' | 'carrier' | 'librarian' | 'scholar' | 'priestess' | 'sleeper' | 'librarian40' | 'priestess48'
  | 'crab36' | 'goldbeard44' | 'crab' | 'cook' | 'morel' | 'gunner' | 'octo' | 'seawitch' | 'mimic' | 'parrot' | 'goldbeard';

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
    key, name, tier: `던전 · ${mobs.some(m => m.elite) ? '정예' : '일반'}`, board: 'b36', comp: PARTY5, lowLevel: true,
    hp: mobs.reduce((s, m) => s + m.hp * m.count, 0), enrage: Infinity, manaCoef: 1.0, diffs: ALL, script: 'trash', stage: 0.25, mobs, ...o,
  };
}

/** 튜토리얼 2인 (탱 1 + 나), 탐험 3인 (탱 1 · 딜 1 + 나) — 02 11장 */
const DUO = { tank: 1, melee: 0, ranged: 0 };
const TRIO = { tank: 1, melee: 0, ranged: 1 };
/** 10인 레이드 (탱 2 · 근접 3 · 원거리 4 + 나, 26 3장) */
const RAID10 = { tank: 2, melee: 3, ranged: 4 };
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
/** 네 가지 청소약을 거는 곳: 해제 4유형 모두 (신전지기 유령) */
const HEAL4 = ['질병', '독', '저주', '마법'];

export const ENCOUNTERS: Record<EncounterKey, Encounter> = {
  warden: { key: 'warden', lowLevel: true, name: '녹슨 문지기', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'warden', stage: 0.25 },
  // 10인 레이드 「심연의 탑」 1층 (05 2장). 악몽 = 공통 악몽 규칙 + 전용 패턴 (26 3-1)
  plague: { key: 'plague', name: '역병 군주', tier: '레이드 · 10인', board: 'b36', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 22000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'plague', stage: 0.18, debuffs: ['질병', '독'] },
  // 심연의 탑 2층 ~ 꼭대기 (05 3~6장, 35 5장 보강). 광폭화는 05 공통 표, 체력은 판 위 적 · 딜 0 기믹으로 늘어난 시간만큼 05 표에서 낮춤 (2층 24,000 · 4층 27,000 · 꼭대기 34,000). 꼭대기는 가장 길어서 마나 회복 1.5
  hydra: { key: 'hydra', name: '늪의 어머니 히드라', tier: '레이드 · 10인', board: 'b36', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 21000, enrage: 420, manaCoef: 1.3, diffs: ALL, script: 'hydra', stage: 0.18, debuffs: ['독'] },
  twins: { key: 'twins', name: '쌍둥이 여군주', tier: '레이드 · 10인', board: 'b36', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 26000, enrage: 450, manaCoef: 1.3, diffs: ALL, script: 'twins', stage: 0.18, debuffs: ['저주'] },
  orben: { key: 'orben', name: '대마도사 오르벤', tier: '레이드 · 10인', board: 'b36', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 20000, enrage: 450, manaCoef: 1.3, diffs: ALL, script: 'orben', stage: 0.18, debuffs: ['마법'] },
  abysslord: { key: 'abysslord', name: '심연의 군주', tier: '레이드 · 10인', board: 'b36', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 28000, enrage: 510, manaCoef: 1.5, diffs: ALL, script: 'abysslord', stage: 0.18, debuffs: ['질병', '독', '저주', '마법'] },
  // 20인 레이드 「가라앉은 대성당」 1구역 (26 4-3): 성가대원 4,000 × 3 + 지휘자 30,000
  choir: { key: 'choir', name: '유령 성가대', tier: '대규모 레이드 · 20인', board: 'b36', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 42000, enrage: 360, manaCoef: 1.6, diffs: ALL, script: 'choir', big: true, stage: 0.13, debuffs: ['마법'] },
  // 녹슨 요새 (23). 첫 보스 = 문지기를 순하게 줄인 판
  scrap: { key: 'scrap', lowLevel: true, name: '고철 경비병', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 2500, enrage: 150, manaCoef: 1.0, diffs: ALL, script: 'scrap', stage: 0.25 },
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
  collector: { key: 'collector', lowLevel: true, name: '뼈다귀 수집가', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 3400, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'collector', stage: 0.25, debuffs: ['질병'] },
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
  malchor: { key: 'malchor', lowLevel: true, name: '역병 사제 말코어', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 5900, enrage: 210, manaCoef: 1.0, diffs: ALL, script: 'malchor', stage: 0.25, debuffs: ['질병'] },
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
  shaman: { key: 'shaman', lowLevel: true, name: '늪 주술사', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 3400, enrage: 165, manaCoef: 1.0, diffs: ALL, script: 'shaman', stage: 0.25, debuffs: ['독'] },
  toad: { key: 'toad', lowLevel: true, name: '거대 두꺼비 부글이', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 5100, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'toad', stage: 0.25, debuffs: ['독'] },
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
  seres: { key: 'seres', lowLevel: true, name: '늪 족장 세레스', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6600, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'seres', stage: 0.25, debuffs: ['독'] },
  // 던전 ④ 「저주받은 장원」 (39 1-2, Lv 20, 35 4-3): 일반 먼지 낀 응접실 → 집사 유령 → 초상화 속 귀부인 → 정예 사냥개 우리 → 장원 주인 벨모어 경
  parlor: trash('parlor', '먼지 낀 응접실', [
    { name: '빈 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  butler: { key: 'butler', lowLevel: true, name: '집사 유령', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 4700, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'butler', stage: 0.25, debuffs: ['저주'] },
  lady: { key: 'lady', lowLevel: true, name: '초상화 속 귀부인', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 4300, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'lady', stage: 0.25, debuffs: ['저주'] },
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
  belmore: { key: 'belmore', lowLevel: true, name: '장원 주인 벨모어 경', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 5800, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'belmore', stage: 0.25, debuffs: ['저주'] },
  // 던전 ⑤ 「서리 마탑」 (39 1-2, Lv 25, 35 4-4): 일반 얼음 복도 → 마력 골렘 → 불안정한 마법사 → 정예 서리 실험실 → 탑주의 그림자
  icehall: trash('icehall', '얼음 복도', [
    { name: '얼음 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  frostgolem: { key: 'frostgolem', lowLevel: true, name: '마력 골렘', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 4800, enrage: 180, manaCoef: 1.0, diffs: ALL, script: 'frostgolem', stage: 0.25, debuffs: ['마법'] },
  mage: { key: 'mage', lowLevel: true, name: '불안정한 마법사', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 5300, enrage: 195, manaCoef: 1.0, diffs: ALL, script: 'mage', stage: 0.25, debuffs: ['마법'] },
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
  shadow: { key: 'shadow', lowLevel: true, name: '탑주의 그림자', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6200, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'shadow', stage: 0.25, debuffs: ['마법'] },
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
  guardian: { key: 'guardian', lowLevel: true, name: '신전 수호상', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6000, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'guardian', stage: 0.25, debuffs: ['마법'] },
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
  sentinel: { key: 'sentinel', lowLevel: true, name: '망루 파수꾼', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 5800, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'sentinel', stage: 0.25 },
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
  crystal: { key: 'crystal', lowLevel: true, name: '금 간 공명 수정', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'crystal', stage: 0.25, debuffs: ['저주', '마법'] },
  keeper: { key: 'keeper', lowLevel: true, name: '신전지기 유령', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 7000, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'keeper', stage: 0.25, debuffs: HEAL4 },
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
  ratking: { key: 'ratking', lowLevel: true, name: '수로 쥐왕', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 4900, enrage: 225, manaCoef: 1.0, diffs: ALL, script: 'ratking', stage: 0.25, debuffs: ['질병'] },
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
  carrier: { key: 'carrier', lowLevel: true, name: '역병 운반자', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6600, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'carrier', stage: 0.25, debuffs: ['질병'] },
  // 던전 ⑨ 「얼음 서고」 (46 1-2 · 3-2, Lv 45): 일반 얼음 열람실 → 서고 사서 → 정예 금서 보관소 → 얼어붙은 대학자
  iceread: trash('iceread', '얼음 열람실', [
    { name: '얼음 룬 인형', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '견습 마법사', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  librarian: { key: 'librarian', lowLevel: true, name: '서고 사서', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 5600, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'librarian', stage: 0.25, debuffs: ['마법'] },
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
  scholar: { key: 'scholar', lowLevel: true, name: '얼어붙은 대학자', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6900, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'scholar', stage: 0.25, debuffs: ['마법'] },
  // 던전 ⑩ 「백합 납골당」 (46 1-2 · 3-3, Lv 50): 일반 꽃잎 계단 → 백합 여사제 → 정예 관리인 회랑 (납골당 관리인 + 먼지 유령 무리) → 잠든 가주
  petalstair: trash('petalstair', '꽃잎 계단', [
    { name: '빈 갑옷 시종', hp: 400, count: 3, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] },
    { name: '유령 하녀', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  priestess: { key: 'priestess', lowLevel: true, name: '백합 여사제', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 6000, enrage: 240, manaCoef: 1.0, diffs: ALL, script: 'priestess', stage: 0.25, debuffs: ['저주'] },
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
  sleeper: { key: 'sleeper', lowLevel: true, name: '잠든 가주', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 7200, enrage: 285, manaCoef: 1.0, diffs: ALL, script: 'sleeper', stage: 0.25, debuffs: ['저주'] },
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
  crab: { key: 'crab', name: '집게발 갑판장', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 22000, enrage: 360, manaCoef: 1.3, diffs: ALL, script: 'crab', stage: 0.18, debuffs: ['독'] },
  cook: { key: 'cook', name: '해적 요리사 왕솥', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 19000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'cook', stage: 0.18, debuffs: ['독'] },
  morel: { key: 'morel', name: '부선장 갈고리 모렐', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 23500, enrage: 420, manaCoef: 1.3, diffs: ALL, script: 'morel', stage: 0.18, debuffs: ['독'] },
  gunner: { key: 'gunner', name: '포수장 쾅쾅', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 17000, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'gunner', stage: 0.18, debuffs: ['저주'] },
  octo: { key: 'octo', name: '문어 꾸물이', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 16500, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'octo', stage: 0.18, debuffs: ['독'] },
  seawitch: { key: 'seawitch', name: '바다 마녀 미역 할멈', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 27000, enrage: 435, manaCoef: 1.3, diffs: ALL, script: 'seawitch', stage: 0.18, debuffs: ['저주'] },
  mimic: { key: 'mimic', name: '보물 상자 덥석이', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 18600, enrage: 375, manaCoef: 1.3, diffs: ALL, script: 'mimic', stage: 0.18 },
  parrot: { key: 'parrot', name: '앵무새 대장 깍깍', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 26000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'parrot', stage: 0.18, debuffs: ['저주'] },
  goldbeard: { key: 'goldbeard', name: '해적 선장 금빛수염', tier: '레이드 · 10인', board: 'b36', comp: RAID10, hp: 22600, enrage: 450, manaCoef: 1.5, diffs: ALL, script: 'goldbeard', stage: 0.18, debuffs: ['저주'] },
};

/** 프로토타입 엔진에도 있는 보스 (일치 테스트 대상) */
export const PROTO_ENCOUNTERS: EncounterKey[] = ['warden', 'plague'];
