/**
 * 파티원 능력치 FM식 (97 문서, Lim 2026-10-18 「fm과 함께 길드 v2를 모두 적용하자」): 능력치 12개 (1~20, 10 = 예전 값) + 숨은 학습력 · 꾸준함,
 * 공개모집 1000명의 자기 레벨 (내 Lv × 빠르기). 사람마다 닉네임에서 고정 씨앗을 만들어 계산하고 저장하지 않는다.
 * 능력치 하나는 전투 엔진 값 하나만 바꾼다 (보이기만 하는 숫자 없음). 효과 범위는 97 표의 1 → 20, 10은 예전 값.
 */
import type { PersName } from './personalities';
import type { Role } from '../engine/types';

/** 능력치 12칸. 예전 쫄 처리 (`adds`)는 2026-10-19 Lim 「협동」으로 바꿈 (`coop`, 저장된 길드원 값은 그대로 옮김, storage memberOf) */
export const STAT_KEYS = ['atk', 'tough', 'armor', 'agility', 'evade', 'position', 'coop', 'skill', 'react', 'composure', 'judgment', 'focus'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export const STAT_NAMES: Record<StatKey, string> = {
  atk: '공격', tough: '맷집', armor: '방어', agility: '발놀림', evade: '회피', position: '위치 잡기',
  coop: '협동', skill: '기술 숙련', react: '반응', composure: '침착', judgment: '판단', focus: '집중',
};
/** 묶음 (상세 세 칸 × 네 줄) */
export const STAT_GROUPS: { name: string; keys: StatKey[] }[] = [
  { name: '신체', keys: ['atk', 'tough', 'armor', 'agility'] },
  { name: '기술', keys: ['evade', 'position', 'coop', 'skill'] },
  { name: '정신', keys: ['react', 'composure', 'judgment', 'focus'] },
];
/** 역할 핵심 넷 (굵게 · 능력 ★ 무게) */
export const ROLE_CORE: Record<Exclude<Role, 'healer'>, StatKey[]> = {
  tank: ['tough', 'armor', 'position', 'judgment'],
  melee: ['atk', 'evade', 'agility', 'react'],
  ranged: ['atk', 'react', 'coop', 'skill'],
};

export type Stats = Record<StatKey, number>;
/** 한 사람: 능력치 12 · 학습력 · 꾸준함 (1~20) · 빠르기 (레벨 = 내 Lv × 빠르기) */
export interface FmProfile { stats: Stats; learn: number; steady: number; speed: number }

/** 성격 결 (97 「1000명 표의 능력치 결」): 높게 · 낮게 나오기 쉬운 칸 (평균 ±GRAIN). 협동 (예전 쫄 처리): 함께하는 성격 (사교형 · 감사형 · 짝꿍 · 양보왕 · 대타 · 칭찬왕 · 보은형)은 높게, 혼자 노는 성격 (딜 욕심쟁이 · 외톨이 · 이기주의자 · 몰입형 · 외골수)은 낮게 */
export const GRAIN = 2;
const G = (hi: StatKey[], lo: StatKey[]) => ({ hi, lo });
export const PERS_GRAIN: Record<PersName, { hi: StatKey[]; lo: StatKey[] }> = {
  '신중파': G(['judgment', 'react'], []), '딜 욕심쟁이': G(['atk'], ['react', 'composure', 'coop']), '고집불통': G(['tough', 'armor'], ['react']),
  '덜렁이': G(['agility'], ['evade', 'judgment']), '허세꾼': G(['tough', 'focus'], ['judgment']), '외톨이': G(['focus', 'position'], ['coop']),
  '사교형': G(['position', 'composure', 'coop'], ['focus']), '관심종자': G(['atk'], ['composure', 'judgment']), '감사형': G(['composure', 'position', 'coop'], []),
  '겁쟁이': G(['evade', 'agility'], ['composure', 'focus']), '눈치백단': G(['react', 'evade'], ['atk']), '느림보': G(['tough', 'composure'], ['agility', 'react']),
  '따라쟁이': G(['position'], ['judgment']), '방랑자': G(['agility'], ['position']), '미신쟁이': G(['focus'], ['judgment']),
  '영웅': G(['tough', 'armor'], ['evade']), '이기주의자': G(['evade'], ['position', 'coop']), '응원단장': G(['composure'], ['atk']),
  '경쟁심': G(['atk', 'focus'], ['composure']), '다혈질': G(['atk'], ['composure', 'judgment']), '침착함': G(['composure', 'judgment'], ['agility']),
  '낙천가': G(['composure'], ['judgment']), '비관론자': G(['judgment'], ['focus']), '소심이': G(['evade'], ['composure', 'focus']),
  '승부사': G(['focus', 'atk'], ['composure']), '용두사미': G(['atk'], ['focus']), '대기만성': G(['focus', 'tough'], ['react']),
  '몰입형': G(['focus'], ['position', 'coop']), '완벽주의자': G(['skill', 'judgment'], ['composure']), '뉴비': G(['agility'], ['judgment', 'react']),
  '쿨 아끼미': G(['judgment', 'skill'], ['atk']), '스킬 난사': G(['skill', 'atk'], ['judgment']), '끊기 욕심': G(['skill', 'react'], ['evade']),
  '쫄 사냥꾼': G(['atk'], ['focus']), '외골수': G(['atk', 'focus'], ['coop']), '미리미리': G(['judgment', 'armor'], ['focus']),
  '아슬아슬': G(['react', 'focus'], ['composure']), '쫄 모으기': G(['tough', 'position'], ['armor']), '어그로 흘림': G(['atk'], ['position', 'judgment']),
  '든든이': G(['tough', 'armor'], ['agility']), '자급자족': G(['tough', 'composure'], ['position']), '보호막 애호가': G(['atk'], ['tough']),
  '지속힐 체질': G(['tough'], ['react']), '큰 힐 체질': G(['atk'], ['tough']), '자립형': G(['composure', 'tough'], ['position']),
  '예언가': G(['react', 'judgment'], ['composure']), '점프광': G(['agility', 'evade'], ['atk']), '참을성': G(['tough', 'composure'], ['evade']),
  '모서리파': G(['evade'], ['position']), '얼음땡': G(['agility'], ['composure', 'react']), '앞장이': G(['atk', 'tough'], ['evade']),
  '뒷줄파': G(['evade'], ['atk']), '짝꿍': G(['position', 'composure', 'coop'], ['focus']), '양보왕': G(['judgment', 'coop'], ['atk']),
  '집돌이': G(['position'], ['agility']), '대타': G(['tough', 'armor', 'coop'], ['atk']), '큰형': G(['composure', 'judgment'], ['agility']),
  '분위기메이커': G(['composure'], ['focus']), '칭찬왕': G(['judgment', 'coop'], []), '보은형': G(['evade', 'coop'], []),
  '샘쟁이': G(['atk'], ['composure']), '울보': G(['evade'], ['composure']), '오뚝이': G(['tough', 'composure'], ['react']),
  '예민형': G(['react'], ['composure']), '신바람': G(['evade', 'agility'], ['judgment']), '화풀이': G(['atk', 'tough'], ['composure']),
  '폭주기관차': G(['atk'], ['judgment', 'evade']), '쉬엄쉬엄': G(['composure'], ['focus']), '타이밍 장인': G(['focus', 'judgment'], ['agility']),
  '끈기형': G(['focus', 'composure'], ['atk']),
};

/** 닉네임 → 고정 씨앗 (FNV-1a) */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 대략 정규분포 (세 번 더함), 평균 0 · 표준편차 약 1 */
const normal = (r: () => number) => (r() + r() + r() - 1.5) * 2;
const clampStat = (x: number) => Math.max(1, Math.min(20, Math.round(x)));

/** 능력치 표준편차 (평균 10, 대부분 8~13 · 97) */
export const STAT_SD = 1.8;
/** 빠르기 (97 「A를 고르면 붙는 규칙」 2번): 40%는 함께 크는 사람 0.95~1.1배, 60%는 천천히 크는 사람 0.02~0.95배 */
export const SPEED = { fastShare: 0.4, fast: [0.95, 1.1], slow: [0.02, 0.95] } as const;

/** 1000명 한 사람의 고정 능력치 (닉네임 씨앗 + 성격 결) */
export function profileOf(nick: string, pers: PersName): FmProfile {
  const r = rngOf(seedOf(`fm:${nick}`));
  const grain = PERS_GRAIN[pers];
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    const lean = grain?.hi.includes(k) ? GRAIN : grain?.lo.includes(k) ? -GRAIN : 0;
    stats[k] = clampStat(10 + lean + normal(r) * STAT_SD);
  }
  const learn = clampStat(1 + r() * 19.999 - 0.5);
  const steady = clampStat(10 + normal(r) * 4);
  const fast = r() < SPEED.fastShare, u = r();
  const speed = fast ? SPEED.fast[0] + u * (SPEED.fast[1] - SPEED.fast[0]) : SPEED.slow[0] + u * (SPEED.slow[1] - SPEED.slow[0]);
  return { stats, learn, steady, speed };
}

/** 공개모집 파티원 레벨: 내 Lv × 빠르기 (반올림, 1~100) */
export const memberLevel = (speed: number, myLv: number): number => Math.max(1, Math.min(100, Math.round(myLv * speed)));
/** 칸 레벨 ±이만큼인 사람만 모집에 나옴, 모자라면 넓힘 */
export const LV_BAND = [1, 3] as const;

/** 능력 ★ (½ 단위, ★½ ~ ★★★★★): 역할 핵심 넷 60% + 나머지 여덟 40% */
export function abilityStars(stats: Stats, role: Exclude<Role, 'healer'>): number {
  const core = ROLE_CORE[role];
  const c = core.reduce((a, k) => a + stats[k], 0) / core.length;
  const o = STAT_KEYS.filter(k => !core.includes(k)).reduce((a, k) => a + stats[k], 0) / (STAT_KEYS.length - core.length);
  const score = c * 0.6 + o * 0.4;
  return Math.max(0.5, Math.min(5, Math.round(score - 5.8) / 2)); // 평균 10 → ★★, 방패든양 예 (핵심 14 · 나머지 10.6) → ★★★½
}
/** ★ 글자 (★★★½) */
export const starText = (n: number): string => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');

/** 꾸준함 (97 숨은 능력치): 판마다 능력치 전체가 ±amp 안에서 함께 오르내림. 꾸준함 1 = ±2.5, 20 = 0. 판 시드 · 닉네임으로 한 번 굴림 */
export function dayOffset(steady: number, fightSeed: number, nick: string): number {
  const amp = 2.5 * (20 - Math.max(1, Math.min(20, steady))) / 19;
  const r = rngOf(seedOf(`day:${fightSeed}:${nick}`));
  return (r() * 2 - 1) * amp;
}

/**
 * 능력치 기반 행동 (99) 기준점 = 15 (2026-10-19 Lim 「움직임은 평균 15정도에서 지금처럼 움직여지게 해보자. 지금의 움직임이 너무좋다」):
 * 새 행동 층 (반응 흔들림 · 못 피한 모양 · 탱커 머뭇거림 · 빗나감 · 스킬 실수 …)은 15 이상이면 예전 그대로, 낮을수록 서툼 (1 = 가장 서툼). 예전 효과 (fmFx, 10 = 예전 값)는 그대로
 */
export const ACT_PAR = 15;
/** 15에서 0 · 1에서 1 (15 넘으면 0) */
export const clumsy = (s: number): number => Math.max(0, Math.min(1, (ACT_PAR - s) / (ACT_PAR - 1)));
/** 15에서 0 · 20에서 1 (15 밑이면 0): 15 넘으면 조금 더 잘 */
export const sharp = (s: number): number => Math.max(0, Math.min(1, (s - ACT_PAR) / (20 - ACT_PAR)));
/** 순간 흔들림 폭 (99): 꾸준함 15 이상 0 · 10 0.57 · 1 1.6 (판마다 흔들림 dayOffset과 따로) */
export const wobOf = (steady: number): number => 1.6 * clumsy(steady);

/** 1 → 10 → 20 사이를 직선으로 (10 = 예전 값) */
export function lerp3(s: number, at1: number, at10: number, at20: number): number {
  const x = Math.max(1, Math.min(20, s));
  return x <= 10 ? at1 + (at10 - at1) * (x - 1) / 9 : at10 + (at20 - at10) * (x - 10) / 10;
}

/** 능력치 → 전투 엔진 값 (97 표). 칸 하나 = 값 하나 */
export interface FmFx {
  /** 공격: 딜 배율 */ dps: number;
  /** 맷집: 최대 체력 배율 */ hp: number;
  /** 방어: 받는 피해 배율 */ taken: number;
  /** 발놀림: 한 칸 옮기는 시간 배율 */ move: number;
  /** 회피: 장판 피하기 확률 (더함) */ dodge: number;
  /** 위치 잡기: 피한 뒤 제자리로 돌아오기까지 기다림 (초) */ homeWait: number;
  /** 기술 숙련: 직업 스킬 재사용 배율 · 끊기 성공률 (더함) */ cd: number; cut: number;
  /** 반응: 예고를 보고 움직이기까지 시간 배율 */ react: number;
  /** 침착: 못 피한 뒤 다시 움직이기까지 배율 · 겁쟁이 도망 체력 · 소심이 당황 시간 배율 */ retry: number; flee: number; panic: number;
  /** 판단: 생존 능력 체력 기준 (더함) · 낙천가 · 비관론자 치우침을 남기는 몫 */ guard: number; bias: number;
  /** 집중: 악몽 · 레이드 · 보스 30% 아래에서 반응 · 회피 보너스 (낮아도 빼지 않음) */ focus: number;
}
/**
 * 능력치 한 칸의 효과 크기 (97 「다 키운 길드 목표에 맞춰 sim으로 정한다」): 아래 표의 1 · 20 끝값을 10 값 쪽으로 이만큼만 씀.
 * 1이면 표 그대로. 다 키운 길드 (93 7-3)가 악몽 85% 안팎이 되게 맞춤 (sim이 바꿔 볼 수 있게 객체)
 */
export const FM_FX = { scale: 1 };
export function fmFx(st: Stats, off = 0): FmFx {
  const s = (k: StatKey) => st[k] + off, S = FM_FX.scale;
  const f = (k: StatKey, a1: number, a10: number, a20: number) => lerp3(s(k), a10 + (a1 - a10) * S, a10, a10 + (a20 - a10) * S);
  return {
    dps: f('atk', 0.85, 1, 1.15),
    hp: f('tough', 0.9, 1, 1.1),
    taken: f('armor', 1.05, 1, 0.92),
    move: f('agility', 1.15, 1, 0.8),
    dodge: f('evade', -0.05, 0, 0.05),
    homeWait: f('position', 1.5, 1, 0.4),
    cd: f('skill', 1.05, 1, 0.85), cut: f('skill', -0.05, 0, 0.1),
    react: f('react', 1.2, 1, 0.8),
    retry: f('composure', 1.3, 1, 0.6), flee: f('composure', 1.1, 1, 0.8), panic: f('composure', 1.15, 1, 0.7),
    guard: f('judgment', -0.045, 0, 0.05), bias: f('judgment', 1.3, 1, 0.4),
    focus: f('focus', 0, 0, 0.1),
  };
}
