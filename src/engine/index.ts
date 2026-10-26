/** 나혼자 힐러 전투 엔진. 화면과 분리된 순수 로직 (같은 시드 = 같은 결과) */
export { autoHealer, noviceHealer, simulate } from './auto';
export { NOVICE, noviceOf, type NoviceOpts } from './novice';
export { hexDist } from './board';
export { aggroTarget, bossTick, queue, type QueueEntry } from './bosses';
export { bossTaken, busterOn, CHAIN_GROW, focusOrder, isRod, ORDER_NUM, ROD_HP, telDmg } from './bossParts';
export { submerged, TIDE_CUT } from './core';
export { DT, living } from './core';
export { create, recruitParty, rollParty, step, thornsHit } from './fight';
export { canTarget, knows, knowsPassive, skillUsesSpent, SLOT_OF, slotKey, use } from './healer';
export { beaconShare, heroPassive, heroRing, hotCount, setBeacon } from './heroes';
export { reviveTarget } from './revive';
export { bossTarget } from './threat';
export { rngFrom } from './rng';
export { activeOn, areaRadius, cdMax, costOf, talentReady, talentSlots, talentUsesSpent, useTalent, type TalentSlot } from './talents';
export { partyDps, unitDps } from './units';
export type * from './types';
export { restCarry, segmentConfig, simulateDungeon, type DungeonResult, type DungeonRunConfig } from './dungeon';
