/**
 * 재화 (12)·상점 (15 6장, 19 11장)·시즌 패스 (15 4장)·휴식과 앱 결제 상품 (81 · 90) 수치.
 * 81 (2026-10-15 Lim): 크리스탈 · 악몽 열쇠 · 모집권 · 월정액 · 프리미엄 패스를 없앰. 돈으로 사는 것은 광고 제거 패키지와 직업 4종뿐이고,
 * 재료·장비·공훈·경험치·휴식 (광고 충전 빼고)은 돈으로 사지 않는다.
 * v16 (2026-10-16 Lim 「소비 아이템이 없어졌으므로 골드가 필요 없게 되었다」): 골드를 없앰. 강화는 강화석 · 정제 강화석만.
 * v17 (2026-10-16 Lim, 91 디아2식 장비): 강화 · 강화석 · 정제 강화석을 없애고 골드를 되살림 (「범용적으로 사용하기 위해서 골드 재화를 다시 넣자」).
 * 쓰는 재화는 골드 (클리어 · 판매 · 임무 · 상자 · 패스 · 도감, 재설정 · 캐릭터 칸 · 앞으로 상점) + 공훈.
 */
import type { DiffName } from './difficulty';
import type { HeroKey } from './heroes';

// ---------- 휴식 보너스 (90, 2026-10-16 Lim 「그러자」): 81 2장의 입장 비용을 바꿈. 코드 · 저장 이름은 stamina 그대로 ----------
/**
 * 입장은 언제나 됨. 휴식은 최대 100 (광고 제거 패키지 +50), 15분마다 1씩 차고 (하루 96, 가득까지 25시간), 최대치에서 멈춤.
 * 광고 충전 = +30, 하루 3번 (오전 6시 리셋), 최대치를 넘어도 들어감
 */
export const STAMINA = { max: 100, bonus: 50, regenMs: 15 * 60e3, ad: 30, adDaily: 3 };
/** 클리어할 때 쓰는 휴식: 탐험 5 · 던전 10 · 주간 도전 10 · 10인 레이드 15 · 20인 레이드 20 */
export const STAMINA_COST = { explore: 5, dungeon: 10, chal: 10, raid10: 15, raid20: 20 };
/**
 * 휴식 보너스 배수 (90 · 2026-10-17 Lim 「휴식게이지가 있으면 보너스를 준다고 해야 반감을 적게」 · 「휴식 보너스는 두배로 해보자」): 휴식이 있으면 경험치 · 골드 × REST_BONUS.
 * 휴식으로 받은 판 = 휴식 판 보상, 기본 보상 (휴식 없음) = 그 1/REST_BONUS (`REST_CUT`, 반올림 1 이상). 배수를 글에 박지 말고 이 값으로 (`×${REST_BONUS}`).
 * 골드 휴식 판 = clearGold 그대로 (#192 골드 경제를 흔들지 않음), 경험치 휴식 판 = clearXp × REST_XP_SCALE (아래). 장소 경험치 (rampXp, Lv 20까지)는 그대로
 */
export const REST_BONUS = 2;
/**
 * 경험치 휴식 판 배율 (2026-10-17 Lim 「그전에 기본 경험치의 /3 값을 지금의 기본경험치라고 했을 때 휴식 보너스가 ×3에서 ×2일 때의 계산」):
 * 기본 = 예전 휴식 판의 1/3 (#221 전 휴식 0 값 그대로), 휴식 판 = 기본 × REST_BONUS = 예전의 2/3. 클리어 경험치 (clearXp) 쪽만, 장소 경험치 (rampXp)는 그대로 (첫날 1.5시간 Lv 10, Lim 10-16).
 * 클라우드 시뮬 (길잡이 1순위 · 늘 이김 · 광고 없이) Lv 100까지: 하루 1시간 121 → 177일, 1.5시간 79 → 117일, 2시간 64 → 95일, 3시간 50 → 74일, 5시간 35 → 52일, 8시간 24 → 36일. 첫날 Lv은 그대로
 */
export const REST_XP_SCALE = 2 / 3;
/** 기본 보상 몫 (휴식 없음) = 1 / REST_BONUS (91: 예전 강화석 · 정제 강화석 자리에 골드) */
export const REST_CUT = 1 / REST_BONUS;
/**
 * 전면 광고 (90): 클리어한 판의 결과 화면에서 나갈 때, 마지막 광고 뒤 앱이 화면에 떠 있던 시간이 10분을 넘었으면 한 번.
 * Lv 10부터 (튜토리얼 · 첫날 초반은 없음)
 */
export const INTERSTITIAL = { everyMs: 10 * 60e3, minLv: 10 };

// ---------- 앱 결제 상품 (81 3장) ----------
export interface Product { id: string; name: string; price: string }
/** 광고 제거 패키지: 배너 · 전면 광고 없음, 휴식 충전도 광고 없이 바로, 휴식 최대치 +50 (한 번 사면 계정 영구) */
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
 * 앱 결제는 레벨 조건 없이 (튜토리얼 뒤) 바로. v16에서 골드와 함께 뺐다가 91에서 되살림. 캐릭터 선택 화면이 지금 없어 칸을 사는 화면도 없음 (81)
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

/** runs = 클리어 골드 판 수 (받을 때 레벨로 골드 계산), gold = 정한 골드 */
export type PassReward = { runs?: number; gold?: number; title?: string; deco?: string };
/**
 * 보상 한 줄 (81: 프리미엄 라인 없앰). 「골드 N판」 칸은 #172 전 그대로 (예전 크리스탈 60 칸 = 골드 2판, 모집권 칸 = 골드 1판).
 * 91: 예전 강화석 · 정제 강화석 칸은 골드로 (강화석 1 = 100, 정제 1 = 500)
 */
export function passFree(lv: number): PassReward {
  const fixed: Record<number, PassReward> = {
    1: { gold: 500 }, 5: { runs: 3 }, 10: { runs: 2 }, 15: { gold: 1000, runs: 1 }, 20: { runs: 2 },
    25: { deco: '시즌 테두리' }, 30: { runs: 3 }, 35: { gold: 1500 }, 40: { runs: 2 },
    45: { runs: 4 }, 50: { runs: 2, title: '모두의 힐러' },
  };
  return fixed[lv] || (lv % 2 ? { gold: 300 } : { runs: 1 });
}

// ---------- 보상형 광고 (15 7장): 하루 상한. 휴식 충전은 STAMINA.adDaily ----------
export const AD_LIMIT = { cont: 3, chest: 1, reroll: 2 };
