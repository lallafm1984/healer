/**
 * 탐험 · 던전 보스 빠르기 (2026-10-27 Lim 「탐험 · 던전 보스 체력을 반으로 줄이고, 보스 기술 간격과 광폭화 시간도 줄여 밀도를 높여. 레이드는 그대로 두고 …
 * 체력은 완전히 50% 줄이는게 아닌 플레이 시간을 지루하지 않게 만들어보자. 초반 테스트중인데 지루하다」): 보스 체력 × hp · 광폭화 시각 × enrage (encounters.ts),
 * 보스 기술 주기 × skill (평타 빼고, 흐름의 「주기 바꾸기」도, bosses.ts). 첫 시각 (first · start.in)은 그대로라 기술끼리 · 지속 시간과 맞춘 사이가 깨지지 않음. 잡몹 구간 · 레이드 · 튜토리얼은 그대로.
 * 곱하기 전 표는 RAW_ENCOUNTERS · RAW_BOSSES (프로토타입 일치 테스트 cfg.proto만 씀). 예전 보통 (중급자): 보스 한 마리 163 ~ 219초 · 보스 기술 분당 4 ~ 5.5번
 */
export const PACE = { hp: 0.55, skill: 0.7, enrage: 0.55 } as const;
/**
 * 쉬움 · 보통은 보스 체력을 더 (같은 날 Lim 「특히 쉬움, 보통 난이도가 그렇다」): 위 체력에 한 번 더 곱함 (엔진 fight.ts create, 탐험 · 던전 보스만).
 * 쉬움 0.55 × 0.85 ≈ 0.47 · 보통 0.55 × 0.9 ≈ 0.5 (= 예전의 반쯤), 어려움 · 악몽 0.55
 */
export const PACE_DIFF_HP: Partial<Record<'쉬움' | '보통' | '어려움' | '악몽', number>> = { '쉬움': 0.85, '보통': 0.9 };

/** 이 구간이 빨라지나: 탐험 · 던전 보스 (잡몹 구간 · 레이드 · 튜토리얼 아님) */
export const pacedTier = (tier: string, script: string): boolean => script !== 'trash' && /^(탐험|던전) ·/.test(tier);

/** 보스 체력 (50 단위) · 광폭화 (5초 단위) */
export const paceHp = (hp: number): number => Math.max(50, Math.round((hp * PACE.hp) / 50) * 50);
export const paceEnrage = (sec: number): number => (Number.isFinite(sec) ? Math.round((sec * PACE.enrage) / 5) * 5 : sec);
/**
 * 기술 주기 (틱 0.05초 단위, 반올림): 데이터는 0.5초 단위라 × 0.7은 0.35초의 배수로 딱 떨어져 주기끼리의 비 (돌가루 22.5초 · 무력화 45초 = 두 배)가 그대로.
 * 주기는 시전 + 1초보다 짧아지지 않게 (예전부터 짧았으면 그대로)
 */
export const paceTime = (sec: number): number => (Number.isFinite(sec) && sec > 0 ? Math.max(0.5, Math.round(sec * PACE.skill * 20) / 20) : sec);
export const pacePeriod = (sec: number, cast = 0): number => (Number.isFinite(sec) && sec > 0 ? Math.max(paceTime(sec), Math.min(sec, cast + 1)) : sec);
