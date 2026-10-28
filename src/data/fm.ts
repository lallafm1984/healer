/**
 * 파티원 능력치 FM식 (97 문서, Lim 2026-10-18 「fm과 함께 길드 v2를 모두 적용하자」): 능력치 12개 (1~20, 10 = 예전 값) + 숨은 학습력 · 꾸준함,
 * 공개모집 1000명은 나오는 칸 레벨 (recruitLevel)로 나오고 그 레벨까지 레벨업 점수를 받음. 사람마다 닉네임에서 고정 씨앗을 만들어 계산하고 저장하지 않는다.
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
/** 한 사람: 능력치 12 · 학습력 · 꾸준함 (1~20). 레벨은 사람마다 없음 (나오는 칸 · 공고의 레벨, recruitLevel) */
export interface FmProfile { stats: Stats; learn: number; steady: number }

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

/** 능력치 표준편차 (v23까지의 타고난 값: 평균 10, 대부분 8~13 · 97) */
export const STAT_SD = 1.8;

/**
 * 타고난 값 = Lv 1 능력치 (2026-10-19 Lim 「파티원 능력치는 1렙 기준으로 모든능력치 1~10으로 랜덤」, 기획 104): 칸마다 1~10 고르게,
 * 역할 핵심 넷은 4~10 (탱커 맷집 · 방어 1 같은 「고장」을 막음). 성격 결은 바탕에서 빼고 레벨업 때 오를 칸 무게로만 (lvAdds). 레벨이 오르면 레벨업 점수 (LV_PTS)
 */
export const BIRTH = { lo: 1, hi: 10, coreLo: 4 } as const;
/** v25까지의 타고난 값 (평균 10 · 성격 결 ±GRAIN): 씨앗 줄을 같은 만큼 써서 학습력 · 꾸준함을 예전 그대로 둠 */
function birthOld(r: () => number, pers: PersName): Stats {
  const grain = PERS_GRAIN[pers];
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    const lean = grain?.hi.includes(k) ? GRAIN : grain?.lo.includes(k) ? -GRAIN : 0;
    stats[k] = clampStat(10 + lean + normal(r) * STAT_SD);
  }
  return stats;
}
/** v25까지의 타고난 값: 저장 v26이 길드원이 키운 몫 (저장 값 − 이것)을 옮길 때만 씀 */
export const birthV25 = (nick: string, pers: PersName): Stats => birthOld(rngOf(seedOf(`fm:${nick}`)), pers);

/** 1000명 한 사람의 고정 능력치 (닉네임 씨앗). role = 그 사람 직업의 역할 (역할 핵심 넷은 4부터) */
export function profileOf(nick: string, pers: PersName, role: Exclude<Role, 'healer'> | null): FmProfile {
  const r = rngOf(seedOf(`fm:${nick}`));
  birthOld(r, pers);
  const learn = clampStat(1 + r() * 19.999 - 0.5);
  const steady = clampStat(10 + normal(r) * 4);
  const b = rngOf(seedOf(`born:${nick}`)), core = role ? ROLE_CORE[role] : [];
  const stats = {} as Stats;
  for (const k of STAT_KEYS) { const lo = core.includes(k) ? BIRTH.coreLo : BIRTH.lo; stats[k] = lo + Math.floor(b() * (BIRTH.hi - lo + 1)); }
  return { stats, learn, steady };
}

/**
 * 공개모집 파티원 레벨 = 칸 레벨 ± LV_JITTER (1~100). 2026-10-26 Lim 「1000명을 레벨대에 고정하지 말고 공개모집 및 길드 영입시 1레벨 기준으로 시작해서
 * 해당 레벨까지 능력치 상승으로」: 누구든 Lv 1 타고난 값에서 그 레벨까지 레벨업 점수 (lvAdds)를 받은 모습으로 나옴. 예전엔 사람마다 빠르기 (내 Lv × 0.02 ~ 1.1)가 있고
 * 칸 ±1인 사람만 뽑아 높은 칸은 직업마다 10명 안팎만 후보였음 (검토 overlevel-20261026)
 */
export const LV_JITTER = 1;
export const recruitLevel = (stage: number, r: () => number): number => Math.max(1, Math.min(100, stage + Math.floor(r() * (2 * LV_JITTER + 1)) - LV_JITTER));

/**
 * 능력 ★ (½ 단위, ★½ ~ ★★★★★): 역할 핵심 넷 60% + 나머지 여덟 40%, 같은 레벨 대비 (104): lv를 주면 그 레벨까지 레벨업 점수가 ★ 점수를 평균만큼 올린 몫 (STAR.lv × 점수)을 뺌.
 * 화면 숫자 (레벨업 점수까지 든 값)와 그 사람 레벨로 부름. 1000명 평균 ★★ 근처 (Lv 1 · 40 · 100 모두)
 */
export const STAR = { base: 2.4, lv: 0.094 };
/** 능력 점수 (1 ~ 20): 역할 핵심 넷 평균 60% + 나머지 여덟 평균 40%. 레벨 빼기 없는 능력 ★ 바탕 (영입 골드 hireGold도 이 점수) */
export function abilityScore(stats: Stats, role: Exclude<Role, 'healer'>): number {
  const core = ROLE_CORE[role];
  const c = core.reduce((a, k) => a + stats[k], 0) / core.length;
  const o = STAT_KEYS.filter(k => !core.includes(k)).reduce((a, k) => a + stats[k], 0) / (STAT_KEYS.length - core.length);
  return c * 0.6 + o * 0.4;
}
export function abilityStars(stats: Stats, role: Exclude<Role, 'healer'>, lv?: number): number {
  const score = abilityScore(stats, role) - (lv ? STAR.lv * LV_PTS * (Math.max(1, Math.min(100, lv)) - 1) : 0);
  return Math.max(0.5, Math.min(5, Math.round(score - STAR.base) / 2));
}
/** ★ 글자 (★★★½) */
export const starText = (n: number): string => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');

/**
 * 레벨업 점수 (2026-10-19 Lim 「40레벨기준 16개 능력치를 39번 랜덤 상승」, 기획 104): 레벨이 하나 오를 때마다 1점 = 오를 칸 하나 +1 (Lv 40 = 39점 · Lv 100 = 99점).
 * 공개모집 (1000명)은 닉네임 씨앗으로 그 레벨까지 굴린 값 (저장 안 함, 레벨이 하나 높으면 같은 줄에서 한 번 더): 전투 (fight.ts makeParty)와 화면 숫자 (statsAt)에서 타고난 값에 더함.
 * 길드원은 합류할 때 이 값을 저장하고, 그 뒤로는 레벨업할 때 실제로 굴려 저장 (학습력 0.9~1.1배 · 20% 두 배, data/guild statPerLevel · LV_DOUBLE). 예전 레벨 몫 (102 LV_STAT, 칸 평균 +5)을 바꿈
 */
export const LV_PTS = 1;

/**
 * 성장 결 (2026-10-19 Lim 「파티원들이 고렙일경우 평균적으로 모두 높은 능력치를 갖기보다 좀더 개성있게」 → 「결 + 크는 모양」, 기획 103): 레벨업 점수가 오를 칸 · 크는 때가 사람마다 (닉네임 씨앗, 저장 안 함) 다르다.
 * - 칸 무게: 역할 핵심 넷 ×2 · 성격 결 높은 칸 ×1.5 · 낮은 칸 ×0.3 · 재능 2칸 ×3 · 약점 1칸 ×0 (안 오름), 20이면 다른 칸으로
 * - 크는 모양 (GROW_TYPES): 특화형 (재능 ×4 · 약점 2칸) · 균형형 (무게를 고르게, 약점 없음) · 대기만성 (Lv 50까지 느리고 그 뒤 빠름) · 조숙형 (그 반대). 넷 모두 Lv 100에 같은 점수
 */
export type GrowType = '특화형' | '균형형' | '대기만성' | '조숙형';
export const GROW_TYPES: { type: GrowType; share: number; desc: string }[] = [
  { type: '특화형', share: 0.3, desc: '레벨이 오를수록 재능 칸이 크게 오르고 약점 두 칸은 그대로입니다.' },
  { type: '균형형', share: 0.3, desc: '레벨이 오를수록 모든 칸이 고르게 오릅니다.' },
  { type: '대기만성', share: 0.2, desc: 'Lv 50까지는 천천히, 그 뒤로 빠르게 오릅니다.' },
  { type: '조숙형', share: 0.2, desc: 'Lv 50까지 빠르게, 그 뒤로는 천천히 오릅니다.' },
];
export const GROW = { core: 2, hi: 1.5, lo: 0.3, talent: 3, talentSpec: 4, curve: 1.7, flat: 0.35 };
export interface Growth { type: GrowType; talents: StatKey[]; weak: StatKey[] }
/** 그 사람의 성장 결 (닉네임 씨앗으로 고정) */
export function growthOf(nick: string, role: Exclude<Role, 'healer'>): Growth {
  const r = rngOf(seedOf(`grow:${nick}`));
  let x = r(), type: GrowType = '균형형';
  for (const g of GROW_TYPES) { if (x < g.share) { type = g.type; break; } x -= g.share; }
  const pick = (from: StatKey[], n: number) => { const a = [...from], out: StatKey[] = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
  const talents = pick([...STAT_KEYS], 2);
  const weak = type === '균형형' ? [] : pick(STAT_KEYS.filter(k => !talents.includes(k) && !ROLE_CORE[role].includes(k)), type === '특화형' ? 2 : 1);
  return { type, talents, weak };
}
/** 크는 모양: Lv 100 점수 가운데 지금 레벨까지 받은 몫 (0~1) */
const growCurve = (type: GrowType, t: number) => (type === '대기만성' ? t ** GROW.curve : type === '조숙형' ? 1 - (1 - t) ** GROW.curve : t);
/** 그 레벨까지 받은 레벨업 점수 (특화 · 균형 = Lv − 1, 대기만성 · 조숙형은 크는 때만 다름) */
export const lvPoints = (type: GrowType, lv?: number): number => (lv ? Math.round(LV_PTS * 99 * growCurve(type, (Math.max(1, Math.min(100, lv)) - 1) / 99)) : 0);
/** 오를 칸 무게 (성장 결, 칸마다) */
export function growWeights(nick: string, pers: PersName, role: Exclude<Role, 'healer'>): Record<StatKey, number> {
  const g = growthOf(nick, role), grain = PERS_GRAIN[pers], w = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    let x = 1;
    if (ROLE_CORE[role].includes(k)) x *= GROW.core;
    if (grain?.hi.includes(k)) x *= GROW.hi;
    if (grain?.lo.includes(k)) x *= GROW.lo;
    if (g.talents.includes(k)) x *= g.type === '특화형' ? GROW.talentSpec : GROW.talent;
    if (g.weak.includes(k)) x = 0;
    w[k] = g.type === '균형형' ? 1 + (x - 1) * GROW.flat : x; // 균형형: 무게 차이를 줄임
  }
  return w;
}
/** 무게대로 한 칸 (20인 칸 · 무게 0은 빼고), 없으면 null */
export function pickStat(w: Record<StatKey, number>, at: (k: StatKey) => number, r: () => number): StatKey | null {
  const open = STAT_KEYS.filter(k => w[k] > 0 && at(k) < 20), tot = open.reduce((a, k) => a + w[k], 0);
  if (!tot) return null;
  let x = r() * tot;
  for (const k of open) { x -= w[k]; if (x <= 0) return k; }
  return open[open.length - 1];
}
/**
 * 공개모집 레벨업 점수 (칸마다, 정수): 그 레벨까지의 점수를 1점씩 무게대로 (닉네임 씨앗 줄, 앞 레벨과 같은 순서). base = 타고난 값.
 * 길드원 (저장 값에 이미 듦)에게는 부르지 않음
 */
export function lvAdds(nick: string, pers: PersName, role: Exclude<Role, 'healer'>, lv: number | undefined, base: Stats): Stats {
  const out = Object.fromEntries(STAT_KEYS.map(k => [k, 0])) as Stats;
  if (!lv) return out;
  const w = growWeights(nick, pers, role), r = rngOf(seedOf(`lvup:${nick}`));
  for (let n = lvPoints(growthOf(nick, role).type, lv); n > 0; n--) {
    const k = pickStat(w, s => base[s] + out[s], r);
    if (!k) break;
    out[k]++;
  }
  return out;
}
/** 화면에 보이는 능력치 = 타고난 값 + 레벨업 점수 (공개모집, 1~20). who 없으면 저장 값 그대로 (길드원) */
export const statsAt = (st: Stats, who?: { nick: string; pers: PersName; role: Exclude<Role, 'healer'>; lv?: number }): Stats => {
  const add = who ? lvAdds(who.nick, who.pers, who.role, who.lv, st) : null;
  return Object.fromEntries(STAT_KEYS.map(k => [k, Math.max(1, Math.min(20, Math.round(st[k] + (add ? add[k] : 0))))])) as Stats;
};

/** 꾸준함 (97 숨은 능력치): 판마다 능력치 전체가 ±amp 안에서 함께 오르내림. 꾸준함 1 = ±2.5, 20 = 0. 판 시드 · 닉네임으로 한 번 굴림 */
export function dayOffset(steady: number, fightSeed: number, nick: string): number {
  const amp = 2.5 * (20 - Math.max(1, Math.min(20, steady))) / 19;
  const r = rngOf(seedOf(`day:${fightSeed}:${nick}`));
  return (r() * 2 - 1) * amp;
}

/**
 * 능력치 기반 행동 (99): 예전 기준점 15 (2026-10-19 Lim 「평균 15정도에서 지금처럼」, 15 이상 실수 없음 · 15 넘어야 잘함)는 2026-10-25 · 26 Lim 「능력치 20일때만 발동되게 하지말고 …
 * 능력치 1과 10이 같지 않게」로 없앴다. 실수는 lack (1 → 20 한 줄, 20에서만 0), 잘함은 gain (1에서 0 → 20 한 줄), 배율은 lerp3 (10 = 예전 값)
 */
/**
 * 1에서 1 · 20에서 0 (곧은 줄, 2026-10-25 Lim 「나머지는 0이 되지 않게」): 20이 아니면 조금이라도 남는 실수 (혼자 놂 · 스킬 헛씀 · 탱커 엉뚱한 칸 · 생존기 늦게 켬)
 */
export const lack = (s: number): number => Math.max(0, Math.min(1, (20 - s) / 19));
/**
 * 1에서 0 · 20에서 1 (곧은 줄, 2026-10-26 Lim 「능력치 20일때만 발동되게 하지말고 … 능력치 1과 10이 같지 않게」): 잘함 확률 (세게 · 막음 · 버팀 · 먼저 떨어져 섬 · 붙잡기 · 뺏은 뒤 버팀).
 * 예전엔 15 넘어야 생겼음
 */
export const gain = (s: number): number => Math.max(0, Math.min(1, (s - 1) / 19));
/** 1 → 20 곧은 줄의 10 값 (10이 예전 값이 아닌 효과를 lerp3로 쓸 때) */
export const line10 = (at1: number, at20: number): number => at1 + (at20 - at1) * 9 / 19;
/** 순간 흔들림 폭 (99): 꾸준함 1 1.6 · 10 0.84 · 15 0.42 · 20 0 (2026-10-26 20에서만 0, 예전 15부터 0 · 판마다 흔들림 dayOffset과 따로) */
export const wobOf = (steady: number): number => 1.6 * lack(steady);

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
  /** 집중: 악몽 · 레이드 · 보스 30% 아래에서 반응 · 회피 보너스 (낮으면 뺌) */ focus: number;
}
/**
 * 끝값 (2026-10-25 Lim): 공격 · 맷집 · 방어 최대 1.5배 (1 = ÷ 1.5 · 20 = × 1.5), 위치 잡기 5 → 1초 (한 줄), 기술 숙련 끊기 −50 · +10%p, 반응 × 2 · × 0.5,
 * 침착 다시 움직이기 · 겁쟁이 · 소심이 × 1.5 · × 0.5, 판단 생존기 ±10%p · 치우침 × 1.5 · × 0.5. 10은 예전 값 그대로 (위치 잡기만 한 줄)
 *
 * 능력치 한 칸의 효과 크기 (97 「다 키운 길드 목표에 맞춰 sim으로 정한다」): 아래 표의 1 · 20 끝값을 10 값 쪽으로 이만큼만 씀.
 * 1이면 표 그대로. 다 키운 길드 (93 7-3)가 악몽 85% 안팎이 되게 맞춤 (sim이 바꿔 볼 수 있게 객체)
 */
export const FM_FX = { scale: 1 };
export function fmFx(st: Stats, off = 0): FmFx {
  const s = (k: StatKey) => st[k] + off, S = FM_FX.scale;
  const f = (k: StatKey, a1: number, a10: number, a20: number) => lerp3(s(k), a10 + (a1 - a10) * S, a10, a10 + (a20 - a10) * S);
  return {
    dps: f('atk', 1 / 1.5, 1, 1.5),
    hp: f('tough', 1 / 1.5, 1, 1.5),
    taken: f('armor', 1.5, 1, 1 / 1.5),
    move: f('agility', 1.15, 1, 0.8),
    dodge: f('evade', -0.13, line10(-0.13, 0.08), 0.08), // 2026-10-26: 예전 ±5%p와 새 층 (15 밑 −8%p · 15 위 +3%p)을 한 줄로 (10 −3 · 15 +2.5%p)
    homeWait: f('position', 5, line10(5, 1), 1),
    cd: f('skill', 1.05, 1, 0.85), cut: f('skill', -0.5, 0, 0.1),
    react: f('react', 2, 1, 0.5),
    retry: f('composure', 1.5, 1, 0.5), flee: f('composure', 1.5, 1, 0.5), panic: f('composure', 1.5, 1, 0.5),
    guard: f('judgment', -0.1, 0, 0.1), bias: f('judgment', 1.5, 1, 0.5),
    focus: f('focus', -0.1, 0, 0.1), // 2026-10-26 「1과 10이 같지 않게」: 1은 큰 판에서 반응 · 회피가 더 나쁨 (예전 0 · 0 · 10%)
  };
}
