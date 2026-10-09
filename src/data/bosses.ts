/**
 * 보스 데이터 (38 0-2): 보스 = 기술 목록 + 페이즈 흐름 + 광폭화. 엔진(engine/bosses.ts)은 이 표를 읽어 돌리기만 한다.
 * 기술이 하는 일·장판 모양·매 틱 도는 일은 이름 붙은 부품(p)으로 적는다. 새 보스는 부품을 골라 값만 적고,
 * 없는 부품만 engine/bossParts.ts에 더한다 (38 0-4).
 * 피해 수치는 맞을 대상이 실제로 받는 양 (35 1-2, 34 9-3): tank = 탱커 기준, 그 밖은 원거리·힐러 기준.
 */
import type { TelKind } from '../engine/types';
import { CLASSES } from './classes';
import type { ScriptKey } from './encounters';
import { SKILLS } from './skills';

/**
 * 수치 단위 (35 1-2, 38 0-3): 레벨 1 · 보통 기준 값. 엔진이 레벨(R.lv × R.enemy)·난이도·적 피해 배율을 곱하므로
 * 새 보스는 「탱체 50%」처럼 비율로 적으면 레벨과 상관없이 같은 느낌이 된다. 값은 엔진의 기본 파티원과 같음 (fight.ts makeParty)
 */
export const UNIT = { tank: 1000, dps: 600, me: 550, heal: SKILLS.heal.amt! };
/** 비율 → 데이터 값: U.tank(0.5) = 탱체 50% (탱커가 받는 양), U.dps(0.25) = 딜체 25% (원거리·힐러가 받는 양) */
export const U = {
  tank: (x: number) => Math.round(x * UNIT.tank),
  dps: (x: number) => Math.round(x * UNIT.dps),
  me: (x: number) => Math.round(x * UNIT.me),
  heal: (x: number) => Math.round(x * UNIT.heal),
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const roleDps = (role: 'tank' | 'melee' | 'ranged') => avg(Object.values(CLASSES).filter(c => c.role === role).map(c => c.dps * 10));
/**
 * 보스 체력 = 파티 딜 × 목표 시간 (35 1-2). 파티 딜은 레벨 1 공개모집 직업 평균 (이동·도망으로 빠지는 딜은 안 셈).
 * 시작값이고, 클리어율에 맞춘 최종값은 자동 밸런스(38 0-6)가 tune에 적는다
 */
export function bossHpFor(sec: number, comp: { tank: number; melee: number; ranged: number }): number {
  return Math.round((comp.tank * roleDps('tank') + comp.melee * roleDps('melee') + comp.ranged * roleDps('ranged')) * sec / 100) * 100;
}

/** 디버프가 끝날 때 (시간이 다 되거나 지워져서) 하는 일 */
export type DebuffEnd =
  /** 깎인 최대 체력을 되돌림 (썩은 숨결) */
  | { p: 'restoreMax' }
  /** 이웃 칸에 피해 + 독침 (전염, SPREAD) */
  | { p: 'spread' }
  /** 지우지 않고 끝나면 그 사람이 선 열 전체에 피해 (독창, 26 4-3). 지우면 그냥 사라짐 */
  | { p: 'colDmg'; dmg: number }
  /** 지우지 않고 끝나면 그 사람에게 피해 (완치 표식 P-FULL의 시간 끝) */
  | { p: 'hit'; dmg: number };

/** 걸 디버프 (02 5-5 해제 유형) */
export interface DebuffDef {
  name: string;
  type: string;
  /** 지속 (초) */
  left: number;
  /** 초당 피해 */
  dot?: number;
  /** 지우면 터지는 함정 (지울 수 없음 표시) */
  trap?: boolean;
  /** 해제로 안 지워짐 (쇠약·완치 표식). 정화 두루마리도 못 지움 */
  lock?: boolean;
  /** 체력 비율이 이 값 이상이 되면 바로 사라짐 (P-WOUND 0.9, P-FULL 1). end는 안 함 */
  cureAt?: number;
  /** 체력이 cureAt 아래인 동안 every초마다 1중첩 (최대 max), 초당 피해 = 중첩 × dot (P-WOUND) */
  grow?: { every: number; dot: number; max: number };
  end?: DebuffEnd;
}

/** 기술이 맞을 때 하는 일 */
export type SkillEffect =
  /** 평타: 보스가 때릴 사람(탱커)에게 ±30% (전사 ±15%) */
  | { p: 'auto'; dmg: number }
  /** 탱커 버스터: 예고 때 고른 사람에게 skill.dmg (탱커 기준, 물리) */
  | { p: 'tank' }
  /** 전원 광역 (마법). phaseDmg = 그 페이즈에서는 이 피해 */
  | { p: 'all'; dmg: number; phaseDmg?: Partial<Record<number, number>> }
  /**
   * n명에게 디버프 (이미 같은 디버프가 있는 사람은 뺌). n = 'all'이면 살아 있는 모두. nMythic = 악몽 인원.
   * pick: random (기본) / lowest = 체력 비율이 가장 낮은 사람부터, 탱커 빼고 (사냥 P-HUNT).
   * burstAdjacent = 걸린 둘이 붙어 서 있으면 바로 터짐 (전염)
   */
  | { p: 'debuff'; n: number | 'all'; nMythic?: number; pick?: 'random' | 'lowest'; debuff: DebuffDef; burstAdjacent?: boolean }
  /**
   * 최대 체력을 깎는 중첩 디버프 (썩은 숨결 · 썩은 축복 P-HPDOWN): 무작위 n명, 중첩마다 pct, max 중첩, 다시 걸리면 지속이 처음으로.
   * again = 이미 걸린 사람이 있으면 그 확률로 그중에서 고름 (썩은 축복 0.6). 지우면 최대 체력이 돌아옴 (end restoreMax)
   */
  | { p: 'rot'; n: number; debuff: DebuffDef; pct: number; max: number; again?: number };

/** 장판 칸 고르기 */
export type ZoneCells =
  /** 무작위 파티원 칸 둘레 1칸. 범위 밖 빈 칸이 범위 안 인원 이상 남는 곳만 (05 1-B: 던전에서 「피할 곳이 없어!」가 안 나오게) */
  | { p: 'around' }
  /** 판 바깥 1열: 줄마다 맨 왼쪽 또는 맨 오른쪽 칸, 쓸 때마다 좌우 번갈아 (역병 폭풍, 26 3-1) */
  | { p: 'edge' }
  /** 살아 있는 몸통(bodies 앞 n개)이 맡은 열 (몸통마다 per열)을 왼쪽부터 차례로. 악몽은 nMythic개 동시 (크레센도, 26 4-3) */
  | { p: 'bodyCols'; bodies: number; per: number; nMythic: number };

/** 기술이 도는 조건. 타이머는 조건과 상관없이 흐르고, 조건이 안 맞으면 그 차례는 건너뜀 */
export interface SkillWhen {
  /** 이 페이즈에서만 (0 = 인터미션) */
  phase?: number[];
  /** 보스 체력 비율이 이 값 이하 */
  hpBelow?: number;
  /** 이 몸통(bodies 순번) 중 하나라도 살아 있을 때 */
  bodyAlive?: number[];
}

export interface SkillDef {
  key: string;
  name?: string;
  /** 대기열 글자 두 개 (그림이 없을 때) */
  icon?: string;
  kind?: TelKind;
  /** 대기열에 안 보임 (평타) */
  hidden?: boolean;
  /** 첫 시각 (초). null = 페이즈 흐름의 start가 열 때까지 안 씀 */
  first: number | null;
  period: number;
  /** 예고 (초). 0이면 바로 */
  cast: number;
  /** 예고 소리 */
  warn?: string;
  /** 끊기 가능 ✋ (17 7장) */
  cut?: boolean;
  /** 버스터 피해 (탱커 기준) */
  dmg?: number;
  /** 장판 초당 피해 · 지속 */
  dps?: number;
  dur?: number;
  /** 악몽 장판 피해 배율 (불협화음 0.7) */
  dpsMythic?: number;
  when?: SkillWhen;
  /** 예고 때 맞을 사람을 고름: tank = 보스가 때릴 사람 */
  target?: 'tank';
  /** 맞을 때 (장판은 없음) */
  effect?: SkillEffect;
  /** 장판 칸 */
  cells?: ZoneCells;
}

/** 페이즈 흐름 조건 (모두 맞아야) */
export interface FlowIf {
  phase?: number;
  hpBelow?: number;
  mythic?: boolean;
  /** 이 기술이 아직 안 열렸을 때만 (한 번만 열기) */
  idle?: string;
  /** 인터미션 시간이 끝남 */
  interOver?: boolean;
  /** 이 몸통이 모두 쓰러짐 */
  bodiesDead?: number[];
}

/** 페이즈가 바뀔 때 하는 일 (적은 순서대로) */
export type FlowDo =
  | { p: 'phase'; n: number; name: string }
  /** 화면 가운데 큰 글자 */
  | { p: 'text'; text: string }
  /** 기술을 sec초 뒤부터 */
  | { p: 'start'; skill: string; in: number }
  | { p: 'period'; skill: string; sec: number }
  /** 인터미션: 보스 무적 sec초 */
  | { p: 'inter'; sec: number }
  | { p: 'interEnd' }
  /** 쥐떼가 뒷줄 원거리 n명에게 붙음 (뒤 줄부터) */
  | { p: 'rats'; n: number }
  /** 디버프가 하나라도 있는 사람 모두에게 이 디버프 */
  | { p: 'debuffDebuffed'; debuff: DebuffDef };

/** 매 틱 보스 쪽에서 도는 일 (위에서부터 차례로) */
export type FlowStep =
  | { p: 'when'; if: FlowIf; do: FlowDo[] }
  /** 쥐떼: 붙은 사람에게 초당 dps (물리) */
  | { p: 'rats'; phase: number; dps: number }
  /** 노래: 살아 있는 몸통(앞 bodies개)이 맡은 열 (몸통마다 per열)에 선 사람 초당 dps (마법) */
  | { p: 'song'; phase: number; bodies: number; per: number; dps: number };

export interface BossDef {
  /** 시작 페이즈 [번호, 이름]. 이름 '' = 페이즈 표시 없음 */
  phase: [number, string];
  /** 보스 전투 안의 적 몸통 (무음 성가대 성부·지휘자). hp는 enc.hp 기준이라 체력 배율이 그대로 붙음 */
  bodies?: { name: string; hp: number; elite?: boolean; boss?: boolean }[];
  skills: SkillDef[];
  flow?: FlowStep[];
  /** 광폭화: 시각(enc.enrage)이 되거나 레이드 탱커 공백 (35 6-4)이면 짧은 주기 전원 광역 */
  enrage: { name: string; period: number; dmg: number };
}

const AUTO = (dmg: number): SkillDef => ({ key: 'auto', hidden: true, first: 2, period: 2, cast: 0, effect: { p: 'auto', dmg } });
const BUSTER = (name: string, icon: string, first: number, period: number, dmg: number): SkillDef =>
  ({ key: 'buster', name, icon, kind: 'buster', first, period, cast: 2, warn: 'buster', dmg, target: 'tank', effect: { p: 'tank' } });

/** 무음 성가대 수치 (26 4-3, 보통 기준. 피해는 난이도·단계 배율을 곱함) */
export const CHOIR = {
  voices: ['높은 성부', '가운데 성부', '낮은 성부'], voiceHp: 4000, bossHp: 30000,
  auto: 70, baton: 600, song: 4, crescDps: 35, discord: 0.7, forte: 170, soloN: 3, soloSec: 6, soloDmg: 200,
};

/** 전염이 터질 때 (26 3-1): 이웃 칸에 피해 + 독침 */
export const SPREAD = { dmg: 150, debuff: { name: '독침', type: '독', left: 12, dot: 15 } satisfies DebuffDef };

/** 보스 기술 (05, 23, 26). 일반·정예 구간(trash)은 encounters.ts의 적 목록 */
export const BOSSES: Record<Exclude<ScriptKey, 'trash'>, BossDef> = {
  // 고철 경비병 (23 3장): 문지기를 순하게 줄인 첫 보스. 탱커 버스터 + 광역만
  scrap: {
    phase: [1, ''],
    skills: [
      AUTO(75),
      BUSTER('고철 휘두르기', '휘두', 10, 16, 450),
      { key: 'aoe', name: '쇳조각 비', icon: '쇳조', kind: 'aoe', first: 20, period: 22, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: 170 } },
    ],
    enrage: { name: '고철 폭주', period: 2, dmg: 150 },
  },
  // 녹슨 문지기 (05 1장): 40% 아래 녹물 웅덩이
  warden: {
    phase: [1, ''],
    skills: [
      AUTO(70),
      BUSTER('내려찍기', '찍기', 12, 20, 600),
      { key: 'aoe', name: '증기 분출', icon: '증기', kind: 'aoe', first: 25, period: 30, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: 220 } },
      { key: 'zone', name: '녹물 웅덩이', icon: '장판', kind: 'zone', first: null, period: 20, cast: 2.5, dps: 60, dur: 8, warn: 'zone', cut: true, when: { hpBelow: 0.4 }, cells: { p: 'around' } },
    ],
    flow: [{ p: 'when', if: { idle: 'zone', hpBelow: 0.4 }, do: [{ p: 'start', skill: 'zone', in: 3 }, { p: 'text', text: '녹이 흘러내린다' }] }],
    enrage: { name: '증기 폭주', period: 2, dmg: 220 },
  },
  // 역병 군주 (05 2장, 10인 1층). 악몽 전용 (26 3-1): 전염 2명 동시 + 30% 아래 역병 폭풍
  plague: {
    phase: [1, '1페이즈'],
    skills: [
      AUTO(60),
      { key: 'breath', name: '썩은 숨결', icon: '숨결', kind: 'instant', first: 6, period: 12, cast: 0, when: { phase: [1, 2, 3] },
        effect: { p: 'rot', n: 2, debuff: { name: '썩은 숨결', type: '질병', left: 60, end: { p: 'restoreMax' } }, pct: 0.05, max: 4 } },
      { key: 'sting', name: '독침', icon: '독침', kind: 'instant', first: 10, period: 15, cast: 0, cut: true, when: { phase: [1] },
        effect: { p: 'debuff', n: 2, debuff: { name: '독침', type: '독', left: 12, dot: 15 } } },
      { key: 'aoe', name: '역병 파동', icon: '파동', kind: 'aoe', first: 27, period: 30, cast: 3, warn: 'aoe', when: { phase: [1, 2, 3] },
        effect: { p: 'all', dmg: 180, phaseDmg: { 1: 150 } } },
      { key: 'contagion', name: '전염', icon: '전염', kind: 'instant', first: null, period: 20, cast: 0, when: { phase: [2, 3] },
        effect: { p: 'debuff', n: 1, nMythic: 2, debuff: { name: '전염', type: '질병', left: 8, trap: true, end: { p: 'spread' } }, burstAdjacent: true } },
      { key: 'storm', name: '역병 폭풍', icon: '폭풍', kind: 'zone', first: null, period: 10, cast: 2.5, dps: 40, dur: 7.5, warn: 'zone', when: { phase: [3] }, cells: { p: 'edge' } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.6 }, do: [
        { p: 'phase', n: 0, name: '인터미션' }, { p: 'inter', sec: 25 }, { p: 'text', text: '인터미션: 쥐떼가 뒷줄 공격' },
        { p: 'rats', n: 3 }, { p: 'debuffDebuffed', debuff: { name: '독침', type: '독', left: 12, dot: 15 } },
      ] },
      { p: 'rats', phase: 0, dps: 30 },
      { p: 'when', if: { phase: 0, interOver: true }, do: [
        { p: 'phase', n: 2, name: '2페이즈' }, { p: 'interEnd' },
        { p: 'start', skill: 'contagion', in: 10 }, { p: 'start', skill: 'aoe', in: 22 }, { p: 'period', skill: 'aoe', sec: 25 },
        { p: 'text', text: '2페이즈: 전염은 해제하면 바로 퍼짐' },
      ] },
      { p: 'when', if: { mythic: true, phase: 2, hpBelow: 0.3 }, do: [
        { p: 'phase', n: 3, name: '3페이즈' }, { p: 'start', skill: 'storm', in: 1 }, { p: 'text', text: '3페이즈: 역병 폭풍이 판 바깥 1열을 번갈아 덮음' },
      ] },
    ],
    enrage: { name: '역병 폭주', period: 3, dmg: 180 },
  },
  // 무음 성가대 (26 4-3): 20인 입문. 성가대원 셋이 맡은 2열에 노래, 다 잡으면 지휘자 2페이즈
  choir: {
    phase: [1, '1페이즈 · 세 성부'],
    bodies: [...CHOIR.voices.map(name => ({ name, hp: CHOIR.voiceHp, elite: true })), { name: '지휘자', hp: CHOIR.bossHp, elite: true, boss: true }],
    skills: [
      AUTO(CHOIR.auto),
      { key: 'baton', name: '지휘봉', icon: '지휘', kind: 'buster', first: 9, period: 18, cast: 2, warn: 'buster', dmg: CHOIR.baton, target: 'tank', effect: { p: 'tank' } },
      { key: 'crescendo', name: '크레센도', icon: '크레', kind: 'zone', first: 12, period: 15, cast: 3, dps: CHOIR.crescDps, dpsMythic: CHOIR.discord, dur: 5, warn: 'zone',
        when: { phase: [1], bodyAlive: [0, 1, 2] }, cells: { p: 'bodyCols', bodies: 3, per: 2, nMythic: 2 } },
      { key: 'forte', name: '포르테', icon: '포르', kind: 'aoe', first: null, period: 25, cast: 3, warn: 'aoe', when: { phase: [2] }, effect: { p: 'all', dmg: CHOIR.forte } },
      { key: 'solo', name: '독창', icon: '독창', kind: 'instant', first: null, period: 20, cast: 0, cut: true, when: { phase: [2] },
        effect: { p: 'debuff', n: CHOIR.soloN, debuff: { name: '독창', type: '마법', left: CHOIR.soloSec, end: { p: 'colDmg', dmg: CHOIR.soloDmg } } } },
    ],
    flow: [
      { p: 'song', phase: 1, bodies: 3, per: 2, dps: CHOIR.song },
      { p: 'when', if: { phase: 1, bodiesDead: [0, 1, 2] }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 마지막 악장' }, { p: 'start', skill: 'forte', in: 8 }, { p: 'start', skill: 'solo', in: 5 },
        { p: 'text', text: '2페이즈: 지휘자가 직접 지휘' },
      ] },
    ],
    enrage: { name: '대합창', period: 3, dmg: 200 },
  },
};

/** 기술 정의 찾기 (공략 화면 숫자) */
export const bossSkill = (key: Exclude<ScriptKey, 'trash'>, skill: string): SkillDef => BOSSES[key].skills.find(s => s.key === skill)!;
