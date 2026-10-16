/**
 * 재화 (12)·상점 (15 6장, 19 11장)·시즌 패스 (15 4장)·스테미너와 앱 결제 상품 (81) 수치.
 * 81 (2026-10-15 Lim): 크리스탈 · 악몽 열쇠 · 모집권 · 월정액 · 프리미엄 패스를 없앰. 돈으로 사는 것은 광고 제거 패키지와 직업 4종뿐이고,
 * 골드·재료·장비·공훈·경험치·스테미너 (광고 충전 빼고)는 돈으로 사지 않는다.
 */
import type { DiffName } from './difficulty';
import type { HeroKey } from './heroes';

// ---------- 스테미너 (81 2장): 입장할 때 씀 ----------
/**
 * 최대 100 (광고 제거 패키지 +50). 8분마다 1씩 차고, 최대치에서 멈춤 (넘는 만큼 쌓아 두지 않음).
 * 광고 충전 = +50, 하루 3번 (오전 6시 리셋), 최대치를 넘어도 들어감
 */
export const STAMINA = { max: 100, bonus: 50, regenMs: 8 * 60e3, ad: 50, adDaily: 3 };
/** 입장 비용: 탐험 5 · 던전 10 · 주간 도전 10 · 10인 레이드 15 · 20인 레이드 20 */
export const STAMINA_COST = { explore: 5, dungeon: 10, chal: 10, raid10: 15, raid20: 20 };

// ---------- 앱 결제 상품 (81 3장) ----------
export interface Product { id: string; name: string; price: string }
/** 광고 제거 패키지: 배너 · 전면 광고 없음, 광고 충전도 광고 없이 바로, 스테미너 최대치 +50 (한 번 사면 계정 영구) */
export const NOADS: Product = { id: 'noads', name: '광고 제거 패키지', price: '5,500원' };
/** 상점에서 파는 직업 (사면 레벨 조건 없이 열림). 사제 처음부터 · 드루이드 Lv 20 · 성기사 Lv 30은 무료 */
export const PAID_HEROES: HeroKey[] = ['shaman', 'monk', 'astrologer', 'warder'];
export const JOB_PRICE = '2,200원';
export const jobProductId = (h: HeroKey) => `job_${h}`;

// ---------- 공훈 (12 3-5, 26 6장): 레이드 보스 처치마다, 레이드마다 주 150 상한 ----------
export const MERIT: Record<10 | 20, Record<DiffName, number>> = {
  10: { '쉬움': 5, '보통': 10, '어려움': 15, '악몽': 20 },
  20: { '쉬움': 10, '보통': 15, '어려움': 20, '악몽': 30 },
};
export const MERIT_WEEK_CAP = 150;
/** 원하는 부위 영웅 장비 1개 */
export const MERIT_GEAR_COST = 100;

// ---------- 캐릭터 칸 (68 2장): 칸 하나에 캐릭터 하나. Lim 2026-10-12 「둘 다」 = 골드로 모아 사거나 앱 결제로 바로 ----------
/**
 * 처음 1칸, 최대 6칸. 골드는 사는 캐릭터 것이고 그 캐릭터 Lv 10부터. gold[i] = (i + 2)번째 칸 값 (넘으면 끝 값).
 * 앱 결제는 레벨 조건 없이 (튜토리얼 뒤) 바로
 */
export const CHAR_SLOT = { max: 6, lv: 10, gold: [2000, 5000, 10000], iap: { id: 'charslot', name: '캐릭터 칸', price: '2,200원' } };
/** 칸을 have개 가졌을 때 다음 칸 골드 값 */
export const slotGold = (have: number): number => CHAR_SLOT.gold[Math.min(Math.max(0, have - 1), CHAR_SLOT.gold.length - 1)];

// ---------- 시즌 패스 (15 4장) ----------
export const PASS_LEVELS = 50;
export const PASS_XP = 1000;
/** 시즌 1 「해바라기 원정」: 2026-10-05 (월) 오전 6시부터 13주. 마지막 3주는 패스 경험치 +50% */
export const SEASON = { n: 1, name: '해바라기 원정', start: '2026-10-05', weeks: 13, catchUpWeeks: 3 };
/** 패스 경험치 (15 4-2) */
export const PASS_GAIN = { daily: 60, chest: 100, weekly: 800, challenge: 400 };

export type PassReward = { gold?: number; stone?: number; refined?: number; title?: string; deco?: string };
/**
 * 보상 한 줄 (81: 프리미엄 라인 없앰). 표의 단계는 그대로, 나머지 단계는 강화석·골드 조금. gold는 「던전 N판」 → 판 수 (받을 때 레벨로 골드 계산).
 * 예전 크리스탈 60 칸은 골드 2판, 모집권은 빼고 같은 칸 골드 1판
 */
export function passFree(lv: number): PassReward {
  const fixed: Record<number, PassReward> = {
    1: { stone: 5 }, 5: { gold: 3 }, 10: { gold: 2 }, 15: { refined: 2, gold: 1 }, 20: { gold: 2 },
    25: { deco: '시즌 테두리' }, 30: { gold: 3 }, 35: { refined: 3 }, 40: { gold: 2 },
    45: { gold: 4 }, 50: { gold: 2, title: '모두의 힐러' },
  };
  return fixed[lv] || (lv % 2 ? { stone: 3 } : { gold: 1 });
}

// ---------- 보상형 광고 (15 7장): 하루 상한. 스테미너 충전은 STAMINA.adDaily ----------
export const AD_LIMIT = { cont: 3, chest: 1, reroll: 2 };
