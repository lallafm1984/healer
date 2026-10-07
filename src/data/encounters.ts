import type { TelKind } from '../engine/types';
import type { BoardId } from './boards';
import type { DiffName } from './difficulty';

/** 보스 전투 (05)와 던전 잡몹 구간 (23). 보스 기술 스크립트는 engine/bosses.ts */
export type EncounterKey = 'warden' | 'plague' | 'plague20' | 'scrap' | 'gate' | 'boiler' | 'duo' | 'field' | 'patrol';
export type ScriptKey = 'warden' | 'plague' | 'scrap' | 'trash';

/** 잡몹 공격 (23 2장). to: tank = 탱커, other = 탱커 아닌 무작위 1명, all = 전원 */
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
}

/** 잡몹 한 종류. 파티는 목록 순서대로 잡는다 (앞쪽부터) */
export interface MobDef {
  name: string;
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
  /** 광폭화 시각 (초). 잡몹 구간은 없음 */
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
  /** 잡몹 구간이면 잡몹 목록 (hp = 합계) */
  mobs?: MobDef[];
}

const ALL: DiffName[] = ['쉬움', '보통', '어려움', '악몽'];
const PARTY5 = { tank: 1, melee: 1, ranged: 2 };

const CHAFF: MobDef = { name: '고철 졸개', hp: 400, count: 0, attacks: [{ key: 'hit', to: 'tank', dmg: 55, jitter: 0.3, first: 1.5, period: 2, cast: 0 }] };

function trash(key: EncounterKey, name: string, mobs: MobDef[], o: Partial<Encounter> = {}): Encounter {
  return {
    key, name, tier: '던전 · 잡몹', board: 'b10', comp: PARTY5, lowLevel: true,
    hp: mobs.reduce((s, m) => s + m.hp * m.count, 0), enrage: Infinity, manaCoef: 1.0, diffs: ALL, script: 'trash', stage: 0.25, mobs, ...o,
  };
}

/** 튜토리얼 2인 (탱 1 + 나), 탐험 3인 (탱 1 · 딜 1 + 나) — 02 11장 */
const DUO = { tank: 1, melee: 0, ranged: 0 };
const TRIO = { tank: 1, melee: 0, ranged: 1 };

export const ENCOUNTERS: Record<EncounterKey, Encounter> = {
  warden: { key: 'warden', lowLevel: true, name: '녹슨 문지기', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ALL, script: 'warden', stage: 0.25 },
  plague: { key: 'plague', name: '역병 군주', tier: '레이드 · 10인', board: 'b19', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 22000, enrage: 390, manaCoef: 1.3, diffs: ['쉬움', '보통', '어려움'], script: 'plague', stage: 0.18 },
  plague20: { key: 'plague20', name: '역병 군주', tier: '레이드 악몽 · 20인', board: 'b30', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 48000, enrage: 450, manaCoef: 1.6, diffs: ['악몽'], script: 'plague', big: true, stage: 0.13 },
  // 녹슨 요새 (23). 첫 보스 = 문지기를 순하게 줄인 판
  scrap: { key: 'scrap', lowLevel: true, name: '고철 경비병', tier: '던전 · 5인', board: 'b10', comp: PARTY5, hp: 2500, enrage: 150, manaCoef: 1.0, diffs: ALL, script: 'scrap', stage: 0.25 },
  gate: trash('gate', '무너진 정문', [
    { ...CHAFF, count: 3 },
    { name: '잔해 투척병', hp: 300, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 90, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ]),
  boiler: trash('boiler', '증기 보일러실', [
    { ...CHAFF, count: 2 },
    {
      name: '보일러 골렘', hp: 700, count: 1, attacks: [
        { key: 'slam', to: 'tank', dmg: 55, jitter: 0.3, first: 2, period: 2.5, cast: 0 },
        { key: 'burst', name: '증기 폭발', icon: '증기', kind: 'aoe', to: 'all', dmg: 150, first: 8, period: 12, cast: 3 },
      ],
    },
  ]),
  // 첫 전투 (2인): 졸개 둘이 탱커만 때림. 힐 없이는 탱커가 쓰러지지만 치유 몇 번이면 버팀
  duo: trash('duo', '녹슨 고원 입구', [{ ...CHAFF, hp: 100, count: 2 }], { tier: '튜토리얼 · 2인', board: 'b7', comp: DUO, stage: 0.3 }),
  // 탐험 「녹슨 고원」 3인: 잡몹 → 고철 순찰병 (경비병 기술을 작게)
  field: trash('field', '고원 길목', [
    { ...CHAFF, hp: 150, count: 2 },
    { name: '잔해 투척병', hp: 150, count: 1, attacks: [{ key: 'throw', to: 'other', dmg: 70, jitter: 0.2, first: 3, period: 3, cast: 0 }] },
  ], { tier: '탐험 · 잡몹', board: 'b7', comp: TRIO, stage: 0.3 }),
  patrol: { key: 'patrol', lowLevel: true, name: '고철 순찰병', tier: '탐험 · 3인', board: 'b7', comp: TRIO, hp: 1500, enrage: 150, manaCoef: 1.0, diffs: ALL, script: 'scrap', stage: 0.3 },
};

/** 프로토타입 엔진에도 있는 보스 (일치 테스트 대상) */
export const PROTO_ENCOUNTERS: EncounterKey[] = ['warden', 'plague', 'plague20'];
