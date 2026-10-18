/**
 * 길드 v2 (기획 `93` · FM `97`, Lim 10-18 「fm과 함께 길드 v2를 모두 적용하자」, 사슬 4번). 수치는 초안 (길드 밸런스는 5번 PR).
 * - 길드원 = 1000명 가운데 한 사람 그대로 (닉네임 · 직업 · 성격 · 직업 스킬 · 능력치 · 학습력 · 꾸준함), 자기 레벨로 싸움
 * - 크는 길 = 출전 경험뿐 (레벨 경험치 · 능력치 경험), 훈련 · 육성 포인트 · 자질 · 전투력 숫자는 없앰
 * - 인연 Lv (save.users 점수)가 스킬 ★를 저절로 올림, 명성이 길드 Lv · 정원을 올림
 */
import type { ClassKey } from './classes';
import { lerp3, ROLE_CORE, STAT_KEYS, type StatKey, type Stats } from './fm';
import type { PersName } from './personalities';
import type { DiffName } from './difficulty';

// ---------- 인연 Lv (93 3-3) ----------
/** 누적 점수 → 인연 Lv 0~12 (0 처음 · 1 아는 사이 · 2 친구 · 3~11 길드원 · 12 단짝) */
export const BOND_STEPS = [0, 1, 4, 8, 20, 35, 55, 80, 110, 150, 200, 260, 330] as const;
export function bondLv(pt: number): number {
  let lv = 0;
  for (let i = 1; i < BOND_STEPS.length; i++) if (pt >= BOND_STEPS[i]) lv = i;
  return lv;
}
export const bondName = (lv: number) => (lv >= 12 ? '단짝' : lv >= 3 ? '길드원' : lv === 2 ? '친구' : lv === 1 ? '아는 사이' : '처음');
/** 길드에 들어오면 적어도 이 점수 (인연 Lv 3) */
export const BOND_JOIN = 8;
/** 친구 (길드 초대 · 능력치 범위) */
export const FRIEND_LV = 2;
/** 직업 스킬 ★: 길드원 (인연 Lv 3) ★1, 인연 Lv 4 · 6 · 8 · 10에서 ★2 · ★3 · ★4 · ★5 (육성 포인트가 없어져 새로 정한 기본값, 13-1). 공개모집 · 친구는 ★ 없음 */
export const starOfBond = (lv: number) => (lv >= 10 ? 5 : lv >= 8 ? 4 : lv >= 6 ? 3 : lv >= 4 ? 2 : lv >= 3 ? 1 : 0);

// ---------- 길드 Lv · 정원 · 명성 (93 6-1 · 6-2) ----------
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
export type PostKind = 'normal' | 'elite';
export type PostRole = 'tank' | 'melee' | 'ranged' | 'any';
/** 모집 공고: 역할 고름 · 지원자 3명 · 내 Lv × 30 골드, 명문 공고 (길드 Lv 4): 직업 고름 · 지원자 5명 · 희귀 성격 · 희귀 스킬 2배 · 내 Lv × 150 골드 */
export const POSTS: Record<PostKind, { name: string; per: number; cands: number; guildLv: number }> = {
  normal: { name: '모집 공고', per: 30, cands: 3, guildLv: 1 },
  elite: { name: '명문 공고', per: 150, cands: 5, guildLv: 4 },
};
export const postGold = (kind: PostKind, myLv: number) => POSTS[kind].per * myLv;
/** 공고 지원자는 내 Lv − 5 이상인 사람 (바로 쓸 사람, 13-1). 명성 지원자는 레벨 상관없이 (원석이 섞임) */
export const POST_LV_GAP = 5;
/** 명성 지원자: 길드 Lv 2 하루 1명 · Lv 6 2명 · Lv 9 3명, 사흘 동안 머묾 */
export const appsPerDay = (guildLv: number) => (guildLv >= 9 ? 3 : guildLv >= 6 ? 2 : guildLv >= 2 ? 1 : 0);
export const APP_DAYS = 3;
/** 스킬 다시 뽑기: 내 Lv × 60 골드 (93 5-5) */
export const rerollGold = (myLv: number) => 60 * myLv;

// ---------- 길드원 (97 크는 길) ----------
export type StoryKey = 'tank' | 'isle' | 'blade';
export interface GuildMember {
  id: number;
  nick: string;
  cls: ClassKey;
  pers: PersName;
  /** 직업 스킬 (★는 인연 Lv로) */
  ab: string;
  /** 자기 레벨 · 경험치 (상한 = 내 레벨) */
  lv: number;
  xp: number;
  /** 지금 능력치 (들어올 때 그 사람 능력치, 출전 경험으로 오름) */
  stats: Stats;
  learn: number;
  steady: number;
  /** 능력치 경험 (차면 한 칸 +1) · 최근 5판의 「한 일」 표 */
  sxp: number;
  votes: StatKey[][];
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

/** 능력치 경험: 이긴 판 +1 · 어려움 +2 · 악몽 +3, 첫 처치 +3 (같은 판에 나간 사람은 모두 같은 양) */
export const SXP: Record<DiffName, number> & { first: number } = { '쉬움': 1, '보통': 1, '어려움': 2, '악몽': 3, first: 3 };
/** 한 칸 +1에 드는 경험: 높을수록 많이 (20에 가까울수록 느림), 학습력 1 → ×1.6 · 10 → ×1 · 20 → ×0.6 */
export const statNeed = (v: number, learn: number) => Math.round((2 + 0.5 * Math.max(0, v - 8)) * lerp3(learn, 1.6, 1, 0.6) * 10) / 10;
/** 능력치 상한 = 12 + 그 사람 레벨 ÷ 12 (Lv 24 = 14 · Lv 96 = 20). 처음부터 높게 태어난 칸은 그대로 */
export const statCap = (lv: number) => Math.min(20, 12 + Math.floor(lv / 12));

/**
 * 오를 칸 고르기 무게 (97 「그 판에서 한 일」): 역할 핵심 넷 2 · 나머지 1, 최근 표 1장에 +1.5, 그 사람 평균보다 이미 높은 칸은 반, 20에 가까울수록 덜, 상한이면 0
 */
export function statWeights(m: Pick<GuildMember, 'stats' | 'votes' | 'lv'>, role: 'tank' | 'melee' | 'ranged'): Record<StatKey, number> {
  const cap = statCap(m.lv), avg = STAT_KEYS.reduce((a, k) => a + m.stats[k], 0) / STAT_KEYS.length;
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    const v = m.stats[k];
    if (v >= cap || v >= 20) { out[k] = 0; continue; }
    let w = ROLE_CORE[role].includes(k) ? 2 : 1;
    for (const vote of m.votes) if (vote.includes(k)) w += 1.5;
    if (v > avg) w *= 0.5;
    w *= Math.max(0.2, (20 - v) / 10);
    out[k] = w;
  }
  return out;
}

/** 「한 일」 표 (97): 그 판에서 가장 두드러진 일 하나 → 오를 칸 */
export type Deed = 'dodge' | 'adds' | 'buster' | 'top' | 'cut' | 'move' | 'calm';
export const DEED_STATS: Record<Deed, StatKey[]> = {
  dodge: ['evade', 'react'], adds: ['adds'], buster: ['tough', 'armor'], top: ['atk'], cut: ['skill'], move: ['agility', 'position'], calm: ['composure', 'judgment'],
};
export const DEED_WHY: Record<Deed, string> = {
  dodge: '장판을 잘 피함', adds: '쫄을 많이 잡음', buster: '강타를 버팀', top: '딜 1등', cut: '기술을 끊음', move: '자리를 잘 옮김', calm: '위기를 버팀',
};
export const VOTE_KEEP = 5;

/** 그 판에서 가장 두드러진 일 하나 (97 「한 판에 한 표」): 판 크기와 상관없이 비슷하게 나오게 각 일을 「눈에 띄는 정도」로 바꿔 가장 큰 것, 0.5 아래면 표 없음 */
export function deedOf(x: { did: { dodge: number; move: number; cut: number; buster: number; adds: number }; dealt: number; top: boolean; low: number; alive: boolean; role: string }): Deed | undefined {
  const d = x.did, sc: [Deed, number][] = [
    ['top', x.top ? 1 : 0],
    ['buster', x.role === 'tank' ? d.buster / 3 : 0],
    ['dodge', d.dodge / 4],
    ['adds', x.dealt > 0 ? (d.adds / x.dealt) / 0.5 : 0],
    ['cut', d.cut / 1.5],
    ['move', Math.max(0, d.move - d.dodge) / 12],
    ['calm', x.alive && x.low < 0.25 ? (0.25 - x.low) / 0.15 : 0],
  ];
  const best = sc.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] >= 0.5 ? best[0] : undefined;
}

/** 버릇 = 침착 · 판단 (97 · 93 13-1): 두 칸 평균 1 → 단점 ×1.2 · 10 → ×1 · 20 → ×1/3 (길드원만, 공개모집은 그대로) */
export const habitOf = (st: Stats) => lerp3((st.composure + st.judgment) / 2, 1.2, 1, 1 / 3);

// ---------- 스토리 동료 (93 4-4, 이번엔 말없는탱만 · 이슬 · 칼날은 업데이트 묶음) ----------
export const STORY: Record<StoryKey, { nick: string; cls: ClassKey; pers: PersName; ab: string; boost: Partial<Stats> }> = {
  // 「끝까지 지킴」 고유 스킬은 업데이트 묶음에서. 지금은 「대신 맞기」 (전사), 맷집 ●5 → 맷집 · 방어 높게
  tank: { nick: '말없는탱', cls: 'warrior', pers: '고집불통', ab: 'warrior.intervene', boost: { tough: 16, armor: 15, position: 13, judgment: 12 } },
  isle: { nick: '이슬', cls: 'archer', pers: '신중파', ab: 'archer.survivor', boost: { react: 16, evade: 14 } },
  blade: { nick: '칼날', cls: 'swordsman', pers: '딜 욕심쟁이', ab: 'swordsman.draw', boost: { atk: 16, agility: 13 } },
};

/** 길드 이름 (93 결성 이야기) */
export const GUILD_NAME = '해바라기 원정대';
