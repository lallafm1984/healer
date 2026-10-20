/**
 * 길드 v2 (기획 `93` · FM `97`, Lim 10-18 「fm과 함께 길드 v2를 모두 적용하자」, 사슬 4번). 수치는 초안 (길드 밸런스는 5번 PR).
 * - 길드원 = 1000명 가운데 한 사람 그대로 (닉네임 · 직업 · 성격 · 직업 스킬 · 능력치 · 학습력 · 꾸준함), 자기 레벨로 싸움
 * - 크는 길 = 출전 경험뿐 (레벨 경험치 · 능력치 경험), 훈련 · 육성 포인트 · 자질 · 전투력 숫자는 없앰
 * - 길드원 레벨이 스킬 레벨을 올림, 명성이 길드 Lv · 정원을 올림
 */
import type { ClassKey } from './classes';
import { growWeights, lerp3, LV_PTS, STAT_KEYS, type StatKey, type Stats } from './fm';
import type { PersName } from './personalities';

/** 길드원 Lv 1 · 20 · 40 · 60 · 80에서 스킬 LV 1~5. 과거에 얻은 스킬 레벨은 유지한다. */
export const SKILL_LEVELS = [1, 20, 40, 60, 80] as const;
export const memberSkillLevel = (m: Pick<GuildMember, 'lv' | 'skillFloor'>): number => Math.max(
  Math.min(5, Math.max(1, m.skillFloor ?? 1)), SKILL_LEVELS.filter(at => m.lv >= at).length,
);

// ---------- 길드 Lv · 정원 · 명성 (93 6-1 · 6-2 → 2026-10-19 Lim 「명성 탐험 1 · 던전 2 · 10인 4 · 20인 6, 정원 길드 Lv 1에 2명부터 Lv 30까지」 · 「명성을 길드레벨의 경험치 개념으로」, 103) ----------
/** 길드 Lv 1 ~ 30. 명성 = 길드 경험치: 저장은 쌓인 명성 하나, Lv 30 뒤에도 계속 쌓임 */
export const GUILD_MAX = 30;
/**
 * 레벨마다 다음 레벨까지 필요 명성 (Lv 1 → 2가 [0], Lv 29 → 30이 [28]), 줄지 않게. 하루 1.5시간 · 길잡이 1순위 시뮬 (103 「길드 Lv 30」): 길드 Lv 8 = 내 Lv 41 안팎 · 18 = 내 Lv 75 안팎 · 30 = 내 Lv 100 뒤 4~5주.
 * (목표 「내 Lv 45 ≈ 8 · 70 ≈ 18」은 초반에 첫 처치로 명성이 빨라서 줄지 않는 필요량으로는 둘 다 못 맞춤, 가운데로)
 */
export const GUILD_NEED: readonly number[] = [55, 55, 55, 60, 60, 65, 65, 70, 75, 80, 85, 90, 100, 105, 115, 125, 130, 140, 150, 165, 175, 185, 200, 215, 230, 245, 260, 275, 290];
/** 그 레벨이 되는 데 쌓인 명성 (Lv 1 = 0) */
export const GUILD_STEPS: readonly number[] = GUILD_NEED.reduce<number[]>((a, n) => [...a, a[a.length - 1] + n], [0]);
/** 정원 = 길드 Lv + 1 (Lv 1에 2명 · Lv 30에 31명) */
export const guildCap = (lv: number) => lv + 1;
/** 길드 Lv · 정원 · 다음 레벨 문턱 (쌓인 명성), have = 이 레벨에서 쌓인 명성, need = 이 레벨 필요량 (Lv 30이면 null) */
export function guildLvOf(fame: number): { lv: number; cap: number; next: number | null; have: number; need: number | null } {
  let i = 0;
  for (let k = 1; k < GUILD_STEPS.length; k++) if (fame >= GUILD_STEPS[k]) i = k;
  const lv = i + 1, need = lv < GUILD_MAX ? GUILD_NEED[i] : null;
  return { lv, cap: guildCap(lv), next: need == null ? null : GUILD_STEPS[i + 1], have: fame - GUILD_STEPS[i], need };
}
/** 명성 (길드파티로 이김 = 파티원 자리 절반 이상이 길드원): 탐험 1 · 던전 2 · 10인 4 · 20인 6, 길드 첫 처치 (던전 · 레이드, 장소 · 난이도마다 한 번) +6 */
export const FAME = { explore: 1, dungeon: 2, raid10: 4, raid20: 6, first: 6 };
/**
 * 낮은 장소 (2026-10-20 Lim 카드 「넷 다」, 103 다른 문제점): 그 판 적 레벨이 내 Lv − 이것보다 낮으면 이긴 판 명성 · 길드 첫 처치 없음 (첫 처치 기록도 안 남김).
 * 레이드 적은 max(내 Lv, 레이드 Lv)라 늘 받음. 첫 처치 칸 472개를 쓸어 담는 것 (4,648명성 > 길드 Lv 30 3,920) · 지난 던전 반복을 막음
 */
export const FAME_LOW_GAP = 10;

// ---------- 영입 (93 4-2) ----------
/** 모집 공고 하나: 전 직업 무작위 3명 · 내 Lv × 30 골드. 희귀 성격 또는 희귀 스킬 보유자는 지원자당 3%. */
export const POST = { name: '모집 공고', per: 30, cands: 3, rareChance: 0.03 };
export const postGold = (myLv: number) => POST.per * myLv;
/** 공고 지원자는 내 Lv − 5 이상인 사람 (바로 쓸 사람, 13-1). 명성 지원자 (길드 Lv에 따라 하루 1~3명)는 2026-10-20 Lim 「길드원 모집은 새공고만 있게, 명성에따른 지원은 없다」로 없앰 */
export const POST_LV_GAP = 5;
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
  /** 직전 레벨업 판에서 두 배 (LV_DOUBLE)가 나온 레벨 수 (0이면 없음) · 마지막 두 배 레벨에 오른 칸 (서로 다른 칸) */
  lastDouble?: number;
  lastDoubleStats?: StatKey[];
  learn: number;
  steady: number;
  /** 쌓인 능력치 점수 (레벨업마다 학습력만큼, 20% 두 배, 1점 = 한 칸 +1) · 최근 5판의 「한 일」 표 */
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
 * 능력치는 레벨업할 때 오름 (Lim 10-18 「능력치는 레벨업시 오르게 하자」 → 104 「레벨업마다 1점」): 레벨 하나에 학습력만큼 점수 (1 → 0.9 · 10 → 1 · 20 → 1.1, 소수는 쌓아 둠),
 * 1점 = 오를 칸 (`statWeights`) 하나 +1. 출전 · 후원 · 쉬는 판 어디서 오른 레벨이든 같음. 공개모집 (레벨마다 1점, fm LV_PTS)과 같은 크기, 학습력만큼 빠르거나 느림,
 * 레벨 하나가 LV_DOUBLE 확률로 두 배 (평균 1.2배)
 */
export const statPerLevel = (learn: number) => lerp3(learn, 0.9, 1, 1.1) * LV_PTS;
/**
 * 길드원 레벨업 한 번이 두 배 (2점 × 학습력)일 확률 (2026-10-20 Lim 「레벨업시 20프로 확률로 2업」, 103): 다 키운 길드가 공개모집 (레벨마다 1점)보다 앞서게.
 * 두 점은 서로 다른 칸에 1점씩 (Lim 「한 능력에 2업이 아니고 각각 다른 능력치 랜덤 업」, 한 레벨 안에서는 같은 칸을 두 번 안 뽑음)
 */
export const LV_DOUBLE = 0.2;

/** 최근 「한 일」 표 1장이 그 칸 무게에 더하는 몫 (×(1 + 이것 × 표 수)) */
export const VOTE_W = 0.5;
/**
 * 오를 칸 고르기 무게 (97 「그 판에서 한 일」 · 103 성장 결): 공개모집과 같은 성장 결 무게 (역할 핵심 · 성격 결 · 재능 · 약점 · 크는 모양) × 최근 표, 20인 칸은 0
 */
export function statWeights(m: Pick<GuildMember, 'nick' | 'pers' | 'stats' | 'votes'>, role: 'tank' | 'melee' | 'ranged'): Record<StatKey, number> {
  const w = growWeights(m.nick, m.pers, role), out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) out[k] = m.stats[k] >= 20 ? 0 : w[k] * (1 + VOTE_W * m.votes.filter(v => v.includes(k)).length);
  return out;
}

/** 모아 두는 점수 (오를 칸이 없을 때, 레벨 상한이 오르면 씀) */
export const SXP_BANK = 3;
/** 쌓인 점수 (m.sxp)를 1점씩 오를 칸에 (성장 결 무게), skip · 이번에 오른 칸은 다시 안 뽑음 (다른 칸이 없으면 같은 칸도). 오를 칸이 없으면 3점까지 모아 둠 */
export function spendPoints(m: Pick<GuildMember, 'nick' | 'pers' | 'stats' | 'votes' | 'sxp'>, role: 'tank' | 'melee' | 'ranged', r: () => number, skip: readonly StatKey[]): StatKey[] {
  const got: StatKey[] = [];
  while (m.sxp + 1e-9 >= 1) {
    const w = statWeights(m, role), used = new Set([...skip, ...got]);
    const fresh = Object.fromEntries(STAT_KEYS.map(k => [k, used.has(k) ? 0 : w[k]])) as Record<StatKey, number>;
    const pool = STAT_KEYS.some(k => fresh[k] > 0) ? fresh : w, tot = STAT_KEYS.reduce((a, k) => a + pool[k], 0);
    if (tot <= 0) { m.sxp = Math.min(m.sxp, SXP_BANK); break; }
    let x = r() * tot, k = STAT_KEYS.filter(s => pool[s] > 0).at(-1)!;
    for (const s of STAT_KEYS) { if (pool[s] <= 0) continue; x -= pool[s]; if (x <= 0) { k = s; break; } }
    m.sxp = Math.round((m.sxp - 1) * 1000) / 1000; m.stats[k]++;
    got.push(k);
  }
  return got;
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
/** 주간 원정: 내 레벨에 맞는 3곳 (5인 · 10인 · 20인, 안 열렸거나 길드원이 그 길드파티 인원보다 적으면 던전), 길드파티로 보통 이상. 칸마다 명성 +10, 셋 다 = 원정 상자 (클리어 골드 5판 + 장비 1) */
export const EXPED = { n: 3, fame: 10, chestGold: 5 };

/** 버릇 = 침착 · 판단 (97 · 93 13-1): 두 칸 평균 1 → 단점 ×1.2 · 10 → ×1 · 20 → ×1/3 (길드원만, 공개모집은 그대로) */
export const habitOf = (st: Stats) => lerp3((st.composure + st.judgment) / 2, 1.2, 1, 1 / 3);

// ---------- 스토리 동료 (93 4-4, 이번엔 말없는탱만 · 이슬 · 칼날은 업데이트 묶음) ----------
export const STORY: Record<StoryKey, { nick: string; cls: ClassKey; pers: PersName; ab: string; boost: Partial<Stats> }> = {
  // 고유 스킬 (93 4-4, data/abilities STORY_ROWS): 끝까지 곁에 · 응급 처치 · 일섬 연격. 자질 ●5 → 그 칸 높게
  // boost = Lv 1 바탕 (1~10 칸, 104 · 예전 평균 10 칸 16 · 15 · 13 · 12 → 10 · 10 · 9 · 8)
  tank: { nick: '말없는탱', cls: 'warrior', pers: '고집불통', ab: 'warrior.holdFast', boost: { tough: 10, armor: 10, position: 9, judgment: 8 } },
  isle: { nick: '이슬', cls: 'archer', pers: '신중파', ab: 'archer.mend', boost: { react: 10, evade: 9 } },
  blade: { nick: '칼날', cls: 'swordsman', pers: '딜 욕심쟁이', ab: 'swordsman.flurry', boost: { atk: 10, agility: 9 } },
};

/** 길드 이름 (93 결성 이야기) */
export const GUILD_NAME = '해바라기 원정대';
