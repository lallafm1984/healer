/**
 * 파티원 직업 (17 2장). P1은 공개모집 Lv 1 직업 8종만. 능력 1개(17 5장)는 길드원 영입과 함께 P2.
 * hp = 최대 체력 (탱커 1000 / 딜러 600 기준), dps = 딜러 평균 1.0 배율 (엔진에서 ×10)
 * 2026-10-12 Lim 「신성한 갑옷 · 날렵함 같은 능력은 빼고 성격과 직업 스킬만」: 직업 패시브를 모두 뺌.
 * 패시브가 딜에 주던 평균 몫 (168곳 시뮬로 잼: 궁수 조준 ×1.18 · 광전사 분노 ×0.95 · 검사 흐름 ×1.035 · 사냥꾼 이동 사격 ×1.01)은 dps에 넣어 둠 (69 문서)
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
}

export const CLASSES: Record<ClassKey, ClassDef> = {
  warrior: { key: 'warrior', name: '전사', short: '전사', role: 'tank', line: '정석 탱커', hp: 1000, dps: 0.55 },
  paladin: { key: 'paladin', name: '수호기사', short: '수호', role: 'tank', line: '파티를 지키는 탱커', hp: 950, dps: 0.45 },
  rogue: { key: 'rogue', name: '도적', short: '도적', role: 'melee', line: '꾸준한 고딜', hp: 580, dps: 1.10 },
  berserker: { key: 'berserker', name: '광전사', short: '광전', role: 'melee', line: '거칠게 몰아치는 근접 딜러', hp: 650, dps: 0.95 },
  swordsman: { key: 'swordsman', name: '검사', short: '검사', role: 'melee', line: '안정적인 근접 딜러', hp: 640, dps: 1.03 },
  mage: { key: 'mage', name: '마법사', short: '마법', role: 'ranged', line: '한 방이 센 원거리 딜러', hp: 520, dps: 1.20 },
  archer: { key: 'archer', name: '궁수', short: '궁수', role: 'ranged', line: '꾸준한 원거리 고딜', hp: 560, dps: 1.23 },
  hunter: { key: 'hunter', name: '사냥꾼', short: '사냥', role: 'ranged', line: '동물 동료와 함께 싸움', hp: 580, dps: 0.96 },
};

/** 공개모집에 나오는 직업 (17 2장 「공개모집 등장」 Lv 1) */
export const RECRUIT_CLASSES: ClassKey[] = ['warrior', 'paladin', 'rogue', 'berserker', 'swordsman', 'mage', 'archer', 'hunter'];

/** 공개모집 같은 직업 최대 인원 (17 2-1): 5인 1, 10인 2, 20인 3 */
export function sameClassMax(partySize: number): number {
  return partySize <= 5 ? 1 : partySize <= 10 ? 2 : 3;
}
