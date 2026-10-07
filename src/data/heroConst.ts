/** 직업 고유 수치 (25 3장). 엔진과 설명 화면이 같이 씀 */
/** 드루이드 나무껍질: 받는 피해 감소, 그동안 내 지속 힐 강화 */
export const BARK = { cut: 0.2, hot: 0.2, sec: 12 };
/** 성기사 빛의 성역: 받는 피해 감소·초당 회복·지속 */
export const SANCTUARY = { cut: 0.2, hps: 40, sec: 10 };
/** 성기사 봉화: 다른 사람에게 한 직접 힐이 봉화 대상에게도 들어가는 비율, 바꾸기 대기 */
export const BEACON = { share: 0.4, cd: 10 };
/** 성기사 보호의 손 지속 */
export const HAND_GUARD = { sec: 6 };
/** 드루이드 환생: 살아나는 체력 비율 */
export const REBIRTH = { hp: 0.4 };

/**
 * 특성 트리가 아직 없는 직업의 임시 보정 (2026-10-07 Lim: 레이드를 특성 포함 기준으로 맞춤).
 * 사제는 특성 30개가 있어서, 드루이드·성기사는 열린 특성 단마다 힐량 +2%, 마나 소모 -4%, 내가 받는 피해 -1%로 비슷하게 맞춤. 직업별 특성 트리를 만들면 뺌
 */
export const TALENT_STANDIN: { heal: number; mana: number; guard: number; heroes: string[] } = { heal: 0.02, mana: 0.04, guard: 0.01, heroes: ['druid', 'paladin'] };

/** 드루이드 20인 레이드 보정 (26 9-1, 2026-10-07 Lim): 들꽃 군락이 닿는 거리 (평소 1칸), 군락 보너스 붙은 칸 하나마다 (평소 10%, 최대 3칸). 20인에서는 들꽃 군락에도 군락 보너스 */
export const DRUID_BIG = { wildRange: 2, colonyStep: 0.3 };
