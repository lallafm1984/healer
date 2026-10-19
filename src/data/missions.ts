/**
 * 일일·주간 임무 (13 2-1·3-1). 임무 풀에서 레벨에 맞는 것만 뽑는다. 수치는 초안.
 * 「수호 영혼으로 탱커 살리기」는 직업마다 위기 기술이 달라서 뺌 (사제만 할 수 있음).
 */
import { RAID10_LV } from './content';
import { FEATURES } from './features';
import { HEROES, type HeroKey } from './heroes';
import { SKILL_LEVEL } from './skills';

/** 판 하나가 끝났을 때 임무가 보는 값 */
export interface RunEvent {
  win: boolean;
  /** 던전·레이드 (탐험·튜토리얼은 아님) */
  dungeon: boolean;
  /** 탐험 (옛 기록 · 테스트에는 없을 수 있음) */
  explore?: boolean;
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
  /** 직업마다 다른 시작 레벨 (있으면 lv 대신) */
  heroLv?: (h: HeroKey) => number;
  /** 판 하나가 몇 칸 채우는지 */
  run?: (e: RunEvent) => number;
  /** 다른 행동 (장비 판매 · 완료 상자) */
  act?: 'sell' | 'chest';
  /** 길드가 있어야 함 (길드를 빼 두면 안 뽑힘, features.ts) */
  guild?: true;
}

const won = (e: RunEvent) => e.win && e.dungeon;

/**
 * 디버프 종류마다 지울 수 있는 디버프가 처음 나오는 장소 레벨 (2026-10-18 해금 레벨 검토, 자동 힐러 sim).
 * 그 아래 장소의 같은 종류는 잠김 (lock) · 덫 (trap)뿐 (교단 약품 제조실 · 왕도 지붕길의 「역병 사슬」은 잠긴 마법)
 */
export const DEBUFF_FROM: Record<string, number> = { 질병: 7, 독: 13, 마법: 22, 저주: 22 };
/** 「해제 성공」 시작 레벨: 해제 스킬을 배우고 그 직업이 지울 디버프가 나오는 레벨 (사제 · 수도사 · 성기사 7, 드루이드 · 점성술사 13, 주술사 · 결계사 22) */
export const dispelFrom = (h: HeroKey) => Math.max(SKILL_LEVEL[HEROES[h].slots.dispel!], Math.min(...HEROES[h].dispel.map(t => DEBUFF_FROM[t] ?? 1)));
/** 이 직업이 이 레벨에 받을 수 있는 임무인가 (길드를 빼 두면 길드 임무는 안 됨) */
export const missionOpen = (m: MissionDef, lv: number, h: HeroKey) => (m.heroLv?.(h) ?? m.lv) <= lv && (!m.guild || FEATURES.guild);

export const DAILY: MissionDef[] = [
  { key: 'clear3', text: '던전 클리어', need: 3, lv: 1, run: e => (won(e) ? 1 : 0) },
  // 길드를 빼 두면 모든 판이 공개모집이라 「던전 클리어」와 겹침 → 그동안은 「탐험 클리어」 (2026-10-17 Lim 「추천대로」, 보상 그대로). 길드를 켜면 예전 임무
  { key: 'pub2', get text() { return FEATURES.guild ? '공개모집으로 클리어' : '탐험 클리어'; }, need: 2, lv: 1, run: e => (FEATURES.guild ? (won(e) && e.pub ? 1 : 0) : (e.win && e.explore ? 1 : 0)) },
  { key: 'dispel10', text: '해제 성공', need: 10, lv: 7, heroLv: dispelFrom, run: e => e.dispels },
  { key: 'overheal', text: '오버힐 30% 이하로 클리어', need: 1, lv: 10, run: e => (won(e) && e.overhealPct <= 30 ? 1 : 0) },
  { key: 'nodeath', text: '사망자 0명으로 클리어', need: 1, lv: 1, run: e => (won(e) && e.deaths === 0 ? 1 : 0) },
  { key: 'mana20', text: '남은 마나 20% 이상으로 클리어', need: 1, lv: 1, run: e => (won(e) && e.endManaPct >= 20 ? 1 : 0) },
  { key: 'clumsy', text: '「덜렁이」·「허세꾼」이 있는 파티로 클리어', need: 1, lv: 15, run: e => (won(e) && e.pers.some(p => p === '덜렁이' || p === '허세꾼') ? 1 : 0) },
  // 91: 강화를 없애 「장비 강화」 → 「장비 판매」 (옛 저장의 enhance2는 migrate가 sell2로)
  { key: 'sell2', text: '장비 판매', need: 2, lv: 1, act: 'sell' },
  { key: 'guild2', text: '길드파티로 클리어', need: 2, lv: 15, guild: true, run: e => (won(e) && !e.pub ? 1 : 0) },
];
/** 한 판 수만 세는 기본 임무는 2개까지 (13 2-1) */
export const DAILY_BASIC = ['clear3', 'pub2'];
export const DAILY_N = 5;

/** 주간 임무 3개 (하나마다 골드 3판. 81에서 악몽 열쇠 1개 → 골드 3판, v16 강화석 5, 91 다시 골드 3판). 10인 레이드가 열리기 전 (RAID10_LV)에는 레이드 대신 던전 임무 (13 3-1) */
export const WEEKLY: MissionDef[] = [
  { key: 'w_raid3', text: '레이드 보스 처치', need: 3, lv: RAID10_LV, run: e => (e.win && e.raid ? 1 : 0) },
  { key: 'w_hard5', text: '어려움 이상 던전 클리어', need: 5, lv: 10, run: e => (won(e) && !e.raid && e.diffIdx >= 2 ? 1 : 0) },
  { key: 'w_dclear15', text: '던전 클리어', need: 15, lv: 10, run: e => (won(e) && !e.raid ? 1 : 0) },
  { key: 'w_chal5', text: '주간 도전 5단계 이상 클리어', need: 1, lv: 20, run: e => (e.chal >= 5 ? 1 : 0) },
  { key: 'w_chest5', text: '일일 임무 완료 상자 받기', need: 5, lv: 10, act: 'chest' },
];
export const WEEKLY_N = 3;
export const WEEKLY_LV = 10;

/** 길드 주간 목표 (13 3장): 길드파티로 클리어 → 명성 + 길드원 전원 훈련 경험치 */
export const GUILD_GOAL = { need: 10, fame: 10 };

/**
 * 임무 보상 (13 2-1): 1개 = 클리어 골드의 20%, 완료 상자 = 클리어 골드 1판 + 장비 1개. 클리어 골드 1판 = 그 레벨 보통 A (economy runGold).
 * v16에서 골드 몫을 강화석으로 바꿨다가 91 (디아2식, 강화석 없앰)에서 #172 전 골드 값으로
 */
export const MISSION_REWARD = { goldShare: 0.2 };
/** 주간 임무 하나 (81): 골드 = 이 레벨 클리어 골드 × runs */
export const WEEKLY_REWARD = { runs: 3 };
export const CHEST_REWARD = { runs: 1 };
/** 놓친 날 완료 상자는 2일까지 (13 7장) */
export const CHEST_BANK = 2;
/** 공개모집 일일 보너스 (13 2-2): 첫 3판 좋은 장비 등급 확률 ↑ (그 난이도 상한 안에서, 61 3-3). 예전 골드 ×2는 v16에서 없앰 */
export const PUB_BONUS = { runs: 3 };
