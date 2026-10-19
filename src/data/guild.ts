/**
 * 길드 v2 (기획 `93` · FM `97`, Lim 10-18 「fm과 함께 길드 v2를 모두 적용하자」, 사슬 4번). 수치는 초안 (길드 밸런스는 5번 PR).
 * - 길드원 = 1000명 가운데 한 사람 그대로 (닉네임 · 직업 · 성격 · 직업 스킬 · 능력치 · 학습력 · 꾸준함), 자기 레벨로 싸움
 * - 크는 길 = 출전 경험뿐 (레벨 경험치 · 능력치 경험), 훈련 · 육성 포인트 · 자질 · 전투력 숫자는 없앰
 * - 길드원 레벨이 스킬 레벨을 올림, 명성이 길드 Lv · 정원을 올림
 */
import type { ClassKey } from './classes';
import { lerp3, ROLE_CORE, STAT_KEYS, type StatKey, type Stats } from './fm';
import type { PersName } from './personalities';

/** 길드원 Lv 1 · 20 · 40 · 60 · 80에서 스킬 LV 1~5. 과거에 얻은 스킬 레벨은 유지한다. */
export const SKILL_LEVELS = [1, 20, 40, 60, 80] as const;
export const memberSkillLevel = (m: Pick<GuildMember, 'lv' | 'skillFloor'>): number => Math.max(
  Math.min(5, Math.max(1, m.skillFloor ?? 1)), SKILL_LEVELS.filter(at => m.lv >= at).length,
);

// ---------- 길드 Lv · 정원 · 명성 (93 6-1 · 6-2) ----------
// 레벨/정원 해금 기준이며 명성의 상한이 아니다. 최고 길드 Lv 뒤에도 명성은 계속 누적한다.
export const GUILD_STEPS = [0, 20, 60, 120, 200, 320, 480, 700, 1200, 2000] as const;
export const GUILD_CAPS = [6, 7, 8, 10, 12, 14, 16, 19, 22, 25] as const;
export function guildLvOf(fame: number): { lv: number; cap: number; next: number | null } {
  let i = 0;
  for (let k = 1; k < GUILD_STEPS.length; k++) if (fame >= GUILD_STEPS[k]) i = k;
  return { lv: i + 1, cap: GUILD_CAPS[i], next: i + 1 < GUILD_STEPS.length ? GUILD_STEPS[i + 1] : null };
}
/** 명성: 길드파티로 이김 (파티원 자리 절반 이상이 길드원) · 길드 첫 처치 (던전 · 레이드, 장소 · 난이도마다 한 번) */
export const FAME = { win: 1, raid10: 2, raid20: 3, first: 3 };

// ---------- 영입 (93 4-2) ----------
/** 모집 공고 하나: 전 직업 무작위 3명 · 내 Lv × 30 골드. 희귀 성격 또는 희귀 스킬 보유자는 지원자당 3%. */
export const POST = { name: '모집 공고', per: 30, cands: 3, rareChance: 0.03 };
export const postGold = (myLv: number) => POST.per * myLv;
/** 공고 지원자는 내 Lv − 5 이상인 사람 (바로 쓸 사람, 13-1). 명성 지원자는 레벨 상관없이 (원석이 섞임) */
export const POST_LV_GAP = 5;
/** 명성 지원자: 길드 Lv 2 하루 1명 · Lv 6 2명 · Lv 9 3명, 사흘 동안 머묾 */
export const appsPerDay = (guildLv: number) => (guildLv >= 9 ? 3 : guildLv >= 6 ? 2 : guildLv >= 2 ? 1 : 0);
export const APP_DAYS = 3;
/** 스킬 다시 뽑기: 내 Lv × 60 골드 (93 5-5) */
export const rerollGold = (myLv: number) => 60 * myLv;
/**
 * 후원 (98, Lim 10-18 「훈련 대신 지원」): 그 길드원 Lv × 20 골드 = 「후원 5판」. 내가 이긴 판에 그 길드원이 쉬면 레벨 경험치를 출전만큼 (쉬는 몫 30% 대신 100%) 받고 1판씩 씀.
 * 출전한 판 · 진 판 · 내 레벨과 같아 더 못 오르는 동안은 안 씀. 남은 지원이 있으면 추가 지원 불가 (2026-10-19 Lim). 레벨이 오르면 능력치도 (레벨업 능력치)
 */
// max는 예전에 중첩 결제한 저장의 남은 횟수를 보존하기 위한 읽기 상한이다.
export const SPONSOR = { per: 20, runs: 5, max: 20 };
export const sponsorGold = (lv: number) => SPONSOR.per * lv;

// ---------- 길드원 (97 크는 길) ----------
export type StoryKey = 'tank' | 'isle' | 'blade';
export interface GuildMember {
  id: number;
  nick: string;
  cls: ClassKey;
  pers: PersName;
  /** 직업 스킬 */
  ab: string;
  /** 이전 저장에서 얻은 스킬 레벨의 하한. 새 성장은 길드원 레벨을 따른다. */
  skillFloor?: number;
  /** 자기 레벨 · 경험치 (상한 = 내 레벨) */
  lv: number;
  xp: number;
  /** 지금 능력치 (들어올 때 그 사람 능력치, 출전 경험으로 오름) */
  stats: Stats;
  /** 직전 레벨업 때 실제 오른 능력치. 과거 저장은 기록이 없으므로 표시하지 않는다. */
  lastStatGains?: StatKey[];
  learn: number;
  steady: number;
  /** 쌓인 능력치 점수 (레벨업마다 학습력만큼, 1점 = 한 칸 +1) · 최근 5판의 「한 일」 표 */
  sxp: number;
  votes: StatKey[][];
  /** 남은 후원 판 (98): 쉬는 판에 레벨 경험치를 출전만큼 */
  boost: number;
  /** 출전 수 · 들어온 때 (ms) */
  runs: number;
  joined: number;
  /** 스토리 동료 (93 4-4) */
  story?: StoryKey;
}

/** 길드원 레벨 경험치: 그 칸 경험치를 자기 레벨 기준으로. 자기 ±5 칸은 가득, 더 높은 칸도 +5 칸만큼, 더 낮은 칸은 한 레벨에 10%씩 덜 (30%까지) */
export const XP_BAND = 5;
export const lowStageXp = (gap: number) => Math.max(0.3, 1 - 0.1 * gap);
/** 쉬는 명단 (출전 안 한 길드원)도 이긴 판 경험치의 30% */
export const REST_SHARE = 0.3;

/**
 * 능력치는 레벨업할 때 오름 (Lim 10-18 「능력치는 레벨업시 오르게 하자」): 레벨 하나에 학습력만큼 점수 (1 → 0.07 · 10 → 0.1 · 20 → 0.13, 소수는 쌓아 둠),
 * 1점 = 오를 칸 (`statWeights`) 하나 +1. 출전 · 후원 · 쉬는 판 어디서 오른 레벨이든 같음.
 * 결성 (Lv 15)부터 Lv 100까지 보통 학습력이면 약 8칸 (학습력 20이면 11칸): 능력치 한 칸이 판 전체에 크게 들어서 (모두 +1이면 악몽 +11%p) 다 키운 길드가 93 7-3 목표 (어려움 90 · 악몽 85 안팎)에 맞게
 */
export const statPerLevel = (learn: number) => lerp3(learn, 0.07, 0.1, 0.13);
/** 능력치 상한 = 12 + 그 사람 레벨 ÷ 12 (Lv 24 = 14 · Lv 96 = 20). 처음부터 높게 태어난 칸은 그대로 */
export const statCap = (lv: number) => Math.min(20, 12 + Math.floor(lv / 12));
/**
 * 잠재력: 칸마다 타고난 값에서 최대 +N (학습력 1 · 10 · 20 → POT). 다 키운 길드가 약한 칸을 모두 메우면 악몽이 96%라 (93 7-3 목표 85%) 이 한도로 맞춤.
 * 타고난 값 = 1000명 줄의 그 사람 능력치 (스토리 동료는 고정 능력치를 덧씀)
 */
export const POT: number[] = [2, 4, 6];
export const statPot = (learn: number) => Math.round(lerp3(learn, POT[0], POT[1], POT[2]));
/** 이 칸이 더 오를 수 있는 끝 = min(상한, 타고난 값 + 잠재력), 처음부터 그보다 높으면 그대로 */
export const statTop = (birth: number, lv: number, learn: number) => Math.max(birth, Math.min(statCap(lv), birth + statPot(learn)));

/**
 * 오를 칸 고르기 무게 (97 「그 판에서 한 일」): 역할 핵심 넷 2 · 나머지 1, 최근 표 1장에 +1.5, 그 사람 평균보다 이미 높은 칸은 반, 20에 가까울수록 덜, 끝 (상한 · 잠재력)이면 0
 */
export function statWeights(m: Pick<GuildMember, 'stats' | 'votes' | 'lv' | 'learn'>, role: 'tank' | 'melee' | 'ranged', birth: Stats): Record<StatKey, number> {
  const avg = STAT_KEYS.reduce((a, k) => a + m.stats[k], 0) / STAT_KEYS.length;
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    const v = m.stats[k];
    if (v >= statTop(birth[k], m.lv, m.learn) || v >= 20) { out[k] = 0; continue; }
    let w = ROLE_CORE[role].includes(k) ? 2 : 1;
    for (const vote of m.votes) if (vote.includes(k)) w += 1.5;
    if (v > avg) w *= 0.5;
    w *= Math.max(0.2, (20 - v) / 10);
    out[k] = w;
  }
  return out;
}

/** 「한 일」 표 (97): 그 판에서 가장 두드러진 일 하나 → 오를 칸 */
export type Deed = 'dodge' | 'adds' | 'buster' | 'top' | 'cut' | 'move' | 'calm' | 'help';
export const DEED_STATS: Record<Deed, StatKey[]> = {
  dodge: ['evade', 'react'], adds: ['judgment'], buster: ['tough', 'armor'], top: ['atk'], cut: ['skill'], move: ['agility', 'position'], calm: ['composure', 'judgment'], help: ['coop'], // 쫄을 고르는 건 판단 · 동료를 메우는 건 협동 (99)
};
export const DEED_WHY: Record<Deed, string> = {
  dodge: '장판을 잘 피함', adds: '쫄을 많이 잡음', buster: '강타를 버팀', top: '딜 1등', cut: '기술을 끊음', move: '자리를 잘 옮김', calm: '위기를 버팀', help: '동료를 도움',
};
export const VOTE_KEEP = 5;

/** 그 판에서 가장 두드러진 일 하나 (97 「한 판에 한 표」): 판 크기와 상관없이 비슷하게 나오게 각 일을 「눈에 띄는 정도」로 바꿔 가장 큰 것, 0.5 아래면 표 없음 */
export function deedOf(x: { did: { dodge: number; move: number; cut: number; buster: number; adds: number; help?: number }; dealt: number; top: boolean; low: number; alive: boolean; role: string }): Deed | undefined {
  const d = x.did, sc: [Deed, number][] = [
    ['top', x.top ? 1 : 0],
    ['buster', x.role === 'tank' ? d.buster / 3 : 0],
    ['dodge', d.dodge / 4],
    ['adds', x.dealt > 0 ? (d.adds / x.dealt) / 0.5 : 0],
    ['cut', d.cut / 1.5],
    ['move', Math.max(0, d.move - d.dodge) / 12],
    ['calm', x.alive && x.low < 0.25 ? (0.25 - x.low) / 0.15 : 0],
    ['help', d.help ?? 0], // 99 협동: 대신 끊기 · 나눠 맞기 · 붙잡기 한 번
  ];
  const best = sc.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] >= 0.5 ? best[0] : undefined;
}

// 공략 숙지 (93 5-4)는 없앰 (2026-10-19 Lim 「없앰」, 99: 전투 행동은 능력치만 따름)

// ---------- 부탁 쪽지 · 주간 원정 (93 8장, 업데이트 묶음) ----------
/** 매일 2장: 길드원이 「○○ 어려움 같이 가자」, 그 사람을 넣고 깨면 끝. 완료한 전투에서 그 길드원의 경험치 ×2 (부탁마다 한 번). 날이 바뀌면 새로 (쌓이지 않음) */
export const REQ = { perDay: 2, xpMult: 2 };
/** 주간 원정: 내 레벨에 맞는 3곳 (5인 · 10인 · 20인, 안 열렸으면 던전), 길드파티로 보통 이상. 칸마다 명성 +5, 셋 다 = 원정 상자 (클리어 골드 5판 + 장비 1) */
export const EXPED = { n: 3, fame: 5, chestGold: 5 };

/** 버릇 = 침착 · 판단 (97 · 93 13-1): 두 칸 평균 1 → 단점 ×1.2 · 10 → ×1 · 20 → ×1/3 (길드원만, 공개모집은 그대로) */
export const habitOf = (st: Stats) => lerp3((st.composure + st.judgment) / 2, 1.2, 1, 1 / 3);

// ---------- 스토리 동료 (93 4-4, 이번엔 말없는탱만 · 이슬 · 칼날은 업데이트 묶음) ----------
export const STORY: Record<StoryKey, { nick: string; cls: ClassKey; pers: PersName; ab: string; boost: Partial<Stats> }> = {
  // 고유 스킬 (93 4-4, data/abilities STORY_ROWS): 끝까지 곁에 · 응급 처치 · 일섬 연격. 자질 ●5 → 그 칸 높게
  tank: { nick: '말없는탱', cls: 'warrior', pers: '고집불통', ab: 'warrior.holdFast', boost: { tough: 16, armor: 15, position: 13, judgment: 12 } },
  isle: { nick: '이슬', cls: 'archer', pers: '신중파', ab: 'archer.mend', boost: { react: 16, evade: 14 } },
  blade: { nick: '칼날', cls: 'swordsman', pers: '딜 욕심쟁이', ab: 'swordsman.flurry', boost: { atk: 16, agility: 13 } },
};

/** 길드 이름 (93 결성 이야기) */
export const GUILD_NAME = '해바라기 원정대';
