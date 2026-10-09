/**
 * 재화 (12)·상점 (15 6장, 19 11장)·시즌 패스 (15 4장) 수치. 전부 초안.
 * 원칙 (12, 15 1장): 유료 재화로 골드·재료·장비·악몽 열쇠·공훈·경험치를 사지 않는다.
 */
import type { DiffName } from './difficulty';
import { FEATURES } from './features';
import type { ItemKey } from './items';

// ---------- 악몽 열쇠 (12 3-4): 악몽 입장권, 입장할 때 1개 소모 ----------
export const SHARD_MAX = 5;
/** 제작 = 골드 1,000 + 강화석 5, 주 5회 */
export const SHARD_CRAFT = { gold: 1000, stone: 5, weekly: 5 };

// ---------- 공훈 (12 3-5, 26 6장): 레이드 보스 처치마다, 레이드마다 주 150 상한 ----------
export const MERIT: Record<10 | 20, Record<DiffName, number>> = {
  10: { '쉬움': 5, '보통': 10, '어려움': 15, '악몽': 20 },
  20: { '쉬움': 10, '보통': 15, '어려움': 20, '악몽': 30 },
};
export const MERIT_WEEK_CAP = 150;
/** 원하는 부위 영웅 장비 1개 */
export const MERIT_GEAR_COST = 100;

// ---------- 소비 아이템 (19 11장): 골드로 사고 가방에 쌓음 ----------
/** 한 종류 최대 */
export const BAG_MAX = 20;
/** 레벨 비례 가격. 부활 깃털은 상점에 없음 (레이드 드롭·주간 보상만) */
export const ITEM_PRICE: Partial<Record<ItemKey, [number, number]>> = {
  mana: [100, 5], medit: [120, 6], life: [80, 4], cleanse: [200, 8], shield: [180, 7],
};
export const itemPrice = (k: ItemKey, lv: number): number | null => (ITEM_PRICE[k] ? ITEM_PRICE[k]![0] + ITEM_PRICE[k]![1] * lv : null);
/** 처음 가방 (새 저장·옛 저장 고칠 때) */
export const STARTER_BAG: Record<ItemKey, number> = { mana: 5, medit: 3, life: 5, cleanse: 3, shield: 3, feather: 1 };

// ---------- 크리스탈 (15 3장) ----------
export interface CrystalPack { id: string; name: string; price: string; crystal: number }
export const CRYSTAL_PACKS: CrystalPack[] = [
  { id: 'c100', name: '한 줌', price: '1,200원', crystal: 100 },
  { id: 'c500', name: '주머니', price: '5,900원', crystal: 500 },
  { id: 'c1050', name: '상자', price: '12,000원', crystal: 1050 },
  { id: 'c3000', name: '궤짝', price: '33,000원', crystal: 3000 },
  { id: 'c5500', name: '금고', price: '59,000원', crystal: 5500 },
  { id: 'c9500', name: '보물고', price: '99,000원', crystal: 9500 },
];
/** 월정액 「프리미엄 회원」 (15 5장) */
export const MEMBER = { id: 'member30', price: '5,900원', days: 30, now: 300, daily: 30 };
/** 첫 클리어마다 크리스탈 조금 (15 3장 무료 획득 「업적·첫 클리어 약 500」) */
export const FIRST_CLEAR_CRYSTAL = 10;

// ---------- 시즌 패스 (15 4장) ----------
export const PASS_LEVELS = 50;
export const PASS_XP = 1000;
/** 시즌 1 「해바라기 원정」: 2026-10-05 (월) 오전 6시부터 13주. 마지막 3주는 패스 경험치 +50% */
export const SEASON = { n: 1, name: '해바라기 원정', start: '2026-10-05', weeks: 13, catchUpWeeks: 3 };
export const PASS_PREMIUM_CRYSTAL = 1000;
/** 패스 경험치 (15 4-2) */
export const PASS_GAIN = { daily: 60, chest: 100, weekly: 800, challenge: 400 };

export type PassReward = { gold?: number; stone?: number; refined?: number; crystal?: number; ticket?: number; title?: string; deco?: string };
/** 무료 라인: 표의 단계는 그대로, 나머지 단계는 강화석·골드 조금. gold는 「던전 N판」 → 판 수 (받을 때 레벨로 골드 계산) */
export function passFree(lv: number): PassReward {
  const fixed: Record<number, PassReward> = {
    1: { stone: 5 }, 5: { gold: 3 }, 10: { crystal: 60 }, 15: { refined: 2, ticket: 1 }, 20: { crystal: 60 },
    25: { deco: '시즌 테두리 (무료형)' }, 30: { crystal: 60, ticket: 1 }, 35: { refined: 3 }, 40: { crystal: 60 },
    45: { gold: 3, ticket: 1 }, 50: { crystal: 60, title: '모두의 힐러' },
  };
  return fixed[lv] || (lv % 2 ? { stone: 3 } : { gold: 1 });
}
/** 프리미엄 라인 = 꾸미기만 (그림은 원화 작업 때). 이름만 */
export function passPremium(lv: number): string {
  const fixed: Record<number, string> = {
    1: '시즌 애드온 (기본형)', 5: '프로필 아이콘', 10: '시즌 힐 이펙트', 15: '닉네임 프레임', 20: '파티 채팅 이모트 팩',
    25: FEATURES.guild ? '길드 휘장 장식' : '프로필 휘장 장식', 30: '시즌 힐러 의상', 35: '시즌 힐 사운드팩', 40: '정산 미터기 스킨', 45: '의상 색 변형', 50: '시즌 애드온 (완성형) · 금색 칭호',
  };
  return fixed[lv] || (lv % 2 ? '이모트 단품' : '프로필 꾸미기');
}

// ---------- 보상형 광고 (15 7장): 하루 상한 ----------
export const AD_LIMIT = { cont: 3, chest: 1, reroll: 2 };
