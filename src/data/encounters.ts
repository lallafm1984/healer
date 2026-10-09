import type { TelKind } from '../engine/types';
import type { BoardId } from './boards';
import type { SkillEffect } from './bosses';
import type { DiffName } from './difficulty';

/** 보스 전투 (05)와 던전 일반·정예 구간 (23). 보스 기술 스크립트는 engine/bosses.ts */
export type EncounterKey = 'warden' | 'plague' | 'choir' | 'scrap' | 'gate' | 'boiler' | 'duo' | 'field' | 'patrol'
  | 'ashyard' | 'collector3' | 'reedbank' | 'shaman8';
export type ScriptKey = 'warden' | 'plague' | 'choir' | 'scrap' | 'trash' | 'collector3' | 'shaman8';

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

export const ENCOUNTERS: Record<EncounterKey, Encounter> = {
  warden: { key: 'warden', lowLevel: true, name: '녹슨 문지기', tier: '던전 · 5인', board: 'b36', comp: PARTY5, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'warden', stage: 0.25 },
  // 10인 레이드 「심연의 탑」 1층 (05 2장). 악몽 = 공통 악몽 규칙 + 전용 패턴 (26 3-1)
  plague: { key: 'plague', name: '역병 군주', tier: '레이드 · 10인', board: 'b36', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 22000, enrage: 390, manaCoef: 1.3, diffs: ALL, script: 'plague', stage: 0.18, debuffs: ['질병', '독'] },
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
};

/** 프로토타입 엔진에도 있는 보스 (일치 테스트 대상) */
export const PROTO_ENCOUNTERS: EncounterKey[] = ['warden', 'plague'];
