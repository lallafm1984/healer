/**
 * 파티원 직업 (17 2장). P1은 공개모집 Lv 1 직업 8종만. 능력 1개(17 5장)는 길드원 영입과 함께 P2.
 * hp = 최대 체력 (탱커 1000 / 딜러 600 기준), dps = 딜러 평균 1.0 배율 (엔진에서 ×10)
 */
import type { Role } from '../engine/types';

export type ClassKey = 'warrior' | 'paladin' | 'rogue' | 'berserker' | 'swordsman' | 'mage' | 'archer' | 'hunter';

export interface ClassDef {
  key: ClassKey;
  name: string;
  /** 편성 미리보기 칸에 쓰는 두 글자 */
  short: string;
  role: Exclude<Role, 'healer'>;
  /** 한 줄 소개 */
  line: string;
  hp: number;
  dps: number;
  passive: string;
  passiveDesc: string;
}

export const CLASSES: Record<ClassKey, ClassDef> = {
  warrior: { key: 'warrior', name: '전사', short: '전사', role: 'tank', line: '정석 탱커', hp: 1000, dps: 0.55, passive: '단단한 몸', passiveDesc: '보스 평타 피해의 흔들림이 ±30%에서 ±15%로 줄어듭니다.' },
  paladin: { key: 'paladin', name: '수호기사', short: '수호', role: 'tank', line: '파티를 지키는 탱커', hp: 950, dps: 0.45, passive: '신성한 갑옷', passiveDesc: '받는 마법 피해(광역·장판·지속 피해)가 10% 줄어듭니다.' },
  rogue: { key: 'rogue', name: '도적', short: '도적', role: 'melee', line: '꾸준한 고딜, 잘 피함', hp: 580, dps: 1.10, passive: '날렵함', passiveDesc: '장판 회피가 8%p 늘고, 이동 시간이 25% 줄어듭니다.' },
  berserker: { key: 'berserker', name: '광전사', short: '광전', role: 'melee', line: '아플수록 강함', hp: 650, dps: 1.0, passive: '분노', passiveDesc: '체력이 낮을수록 딜이 늘어납니다. 체력 100%면 ×0.9, 50%면 ×1.2, 30% 이하면 ×1.4입니다.' },
  swordsman: { key: 'swordsman', name: '검사', short: '검사', role: 'melee', line: '맞으면 더 세지는 안정형', hp: 640, dps: 1.0, passive: '흐름', passiveDesc: '피해를 받으면 3초 동안 딜이 15% 늘어납니다.' },
  mage: { key: 'mage', name: '마법사', short: '마법', role: 'ranged', line: '최고 폭딜, 멈춰서 쏨', hp: 520, dps: 1.20, passive: '집중 시전', passiveDesc: '이동 중에는 딜을 하지 못하고, 장판 반응이 0.2초 늦습니다.' },
  archer: { key: 'archer', name: '궁수', short: '궁수', role: 'ranged', line: '오래 서 있을수록 강함', hp: 560, dps: 1.05, passive: '조준', passiveDesc: '움직이지 않으면 5초마다 딜이 5%씩, 최대 25%까지 늘어납니다.' },
  hunter: { key: 'hunter', name: '사냥꾼', short: '사냥', role: 'ranged', line: '움직이며 쏨', hp: 580, dps: 0.95, passive: '이동 사격', passiveDesc: '이동 중에도 딜을 60% 넣습니다.' },
};

/** 공개모집에 나오는 직업 (17 2장 「공개모집 등장」 Lv 1) */
export const RECRUIT_CLASSES: ClassKey[] = ['warrior', 'paladin', 'rogue', 'berserker', 'swordsman', 'mage', 'archer', 'hunter'];

/** 공개모집 같은 직업 최대 인원 (17 2-1): 5인 1, 10인 2, 20인 3 */
export function sameClassMax(partySize: number): number {
  return partySize <= 5 ? 1 : partySize <= 10 ? 2 : 3;
}

/** 광전사 분노: 체력 비율 → 딜 배율 (구간 사이는 직선) */
export function rageMult(hpRatio: number): number {
  if (hpRatio >= 0.5) return 0.9 + ((1 - hpRatio) / 0.5) * 0.3;
  if (hpRatio > 0.3) return 1.2 + ((0.5 - hpRatio) / 0.2) * 0.2;
  return 1.4;
}

/** 궁수 조준: 서 있은 시간 → 딜 배율 */
export const aimMult = (still: number) => 1 + 0.05 * Math.min(5, Math.floor(still / 5));
