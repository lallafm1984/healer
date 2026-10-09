/**
 * 일일·주간 임무 (13 2-1·3-1). 임무 풀에서 레벨에 맞는 것만 뽑는다. 수치는 초안.
 * 「수호 영혼으로 탱커 살리기」는 직업마다 위기 기술이 달라서 뺌 (사제만 할 수 있음).
 */

/** 판 하나가 끝났을 때 임무가 보는 값 */
export interface RunEvent {
  win: boolean;
  /** 던전·레이드 (탐험·튜토리얼은 아님) */
  dungeon: boolean;
  raid: 0 | 10 | 20;
  /** 공개모집 (길드파티가 아님) */
  pub: boolean;
  diffIdx: number;
  deaths: number;
  overhealPct: number;
  endManaPct: number;
  dispels: number;
  pers: string[];
  /** 주간 도전 단계 (제한시간 안에 깬 판만) */
  chal: number;
}

export interface MissionDef {
  key: string;
  text: string;
  need: number;
  /** 이 레벨부터 */
  lv: number;
  /** 판 하나가 몇 칸 채우는지 */
  run?: (e: RunEvent) => number;
  /** 다른 행동 (강화 등) */
  act?: 'enhance' | 'chest';
  /** 길드가 있어야 함 (길드를 빼 두면 안 뽑힘, features.ts) */
  guild?: true;
}

const won = (e: RunEvent) => e.win && e.dungeon;

export const DAILY: MissionDef[] = [
  { key: 'clear3', text: '던전 클리어', need: 3, lv: 1, run: e => (won(e) ? 1 : 0) },
  { key: 'pub2', text: '공개모집으로 클리어', need: 2, lv: 1, run: e => (won(e) && e.pub ? 1 : 0) },
  { key: 'dispel10', text: '해제 성공', need: 10, lv: 5, run: e => e.dispels },
  { key: 'overheal', text: '오버힐 30% 이하로 클리어', need: 1, lv: 10, run: e => (won(e) && e.overhealPct <= 30 ? 1 : 0) },
  { key: 'nodeath', text: '사망자 0명으로 클리어', need: 1, lv: 1, run: e => (won(e) && e.deaths === 0 ? 1 : 0) },
  { key: 'mana20', text: '남은 마나 20% 이상으로 클리어', need: 1, lv: 1, run: e => (won(e) && e.endManaPct >= 20 ? 1 : 0) },
  { key: 'clumsy', text: '「덜렁이」·「허세꾼」이 있는 파티로 클리어', need: 1, lv: 15, run: e => (won(e) && e.pers.some(p => p === '덜렁이' || p === '허세꾼') ? 1 : 0) },
  { key: 'enhance2', text: '장비 강화', need: 2, lv: 1, act: 'enhance' },
  { key: 'guild2', text: '길드파티로 클리어', need: 2, lv: 15, guild: true, run: e => (won(e) && !e.pub ? 1 : 0) },
];
/** 한 판 수만 세는 기본 임무는 2개까지 (13 2-1) */
export const DAILY_BASIC = ['clear3', 'pub2'];
export const DAILY_N = 5;

/** 주간 임무 3개 = 악몽 열쇠 3개 (12 3-4). Lv 35 전에는 레이드 대신 던전 임무 (13 3-1) */
export const WEEKLY: MissionDef[] = [
  { key: 'w_raid3', text: '레이드 보스 처치', need: 3, lv: 35, run: e => (e.win && e.raid ? 1 : 0) },
  { key: 'w_hard5', text: '어려움 이상 던전 클리어', need: 5, lv: 10, run: e => (won(e) && !e.raid && e.diffIdx >= 2 ? 1 : 0) },
  { key: 'w_dclear15', text: '던전 클리어', need: 15, lv: 10, run: e => (won(e) && !e.raid ? 1 : 0) },
  { key: 'w_chal5', text: '주간 도전 5단계 이상 클리어', need: 1, lv: 20, run: e => (e.chal >= 5 ? 1 : 0) },
  { key: 'w_chest5', text: '일일 임무 완료 상자 받기', need: 5, lv: 10, act: 'chest' },
];
export const WEEKLY_N = 3;
export const WEEKLY_LV = 10;

/** 길드 주간 목표 (13 3장): 길드파티로 클리어 → 명성 + 길드원 전원 훈련 경험치 */
export const GUILD_GOAL = { need: 10, fame: 5, xpShare: 0.5 };

/** 임무 보상 (13 2-1): 1개 = 클리어 골드의 20% + 강화석 2, 완료 상자 = 클리어 골드 1판 + 강화석 5 + 장비 1개 */
export const MISSION_REWARD = { goldShare: 0.2, stone: 2 };
export const CHEST_REWARD = { stone: 5 };
/** 놓친 날 완료 상자는 2일까지 (13 7장) */
export const CHEST_BANK = 2;
/** 공개모집 일일 보너스 (13 2-2): 첫 3판 골드 ×2, 장비 등급 한 단계 위 */
export const PUB_BONUS = { runs: 3, gold: 2 };
