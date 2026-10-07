/**
 * 파티원 특성 (02 5-2-1, 04 7장). 영입 때 붙는 작은 버릇·능력.
 * 지금 엔진에 들어간 특성은 「버팀목」 하나 (2026-10-07 Lim). 나머지 목록은 문서에만 있음.
 */
import type { Role } from '../engine/types';

export type TraitKey = 'bulwark';

export interface TraitDef {
  key: TraitKey;
  name: string;
  /** 주로 붙는 역할 (공개모집에서 이 역할에만 붙임) */
  roles: Exclude<Role, 'healer'>[];
  desc: string;
}

/** 버팀목: 탱커가 모두 쓰러지면 보스 공격을 대신 받고 잠깐 버팀 (전투당 1회) */
export const BULWARK = { sec: 10, cut: 0.5 };

export const TRAITS: Record<TraitKey, TraitDef> = {
  bulwark: { key: 'bulwark', name: '버팀목', roles: ['melee'], desc: `탱커가 모두 쓰러지면 보스 공격을 대신 받습니다. ${BULWARK.sec}초 동안 받는 피해가 ${BULWARK.cut * 100}% 줄어듭니다. 전투당 1회 발동합니다.` },
};

/** 공개모집에서 그 역할 파티원이 특성을 가질 확률 */
export const TRAIT_CHANCE = 0.35;
