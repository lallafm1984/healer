/**
 * 힐러 성장·보상 수치 (P1 초안). 근거: 02 부록 B(경험치 곡선), 12 3-1(골드), 18 2-2(레벨 마일스톤), 19(소비 아이템 칸).
 * 경험치 지급량은 문서에 없어 새로 정함 (24 문서): Lv 15까지 하루 1~2일(18 1장)에 맞춤. 그 뒤 곡선은 P2에서 다시 본다.
 */
import type { DiffName } from './difficulty';

export const MAX_LEVEL = 100;

/** 다음 레벨까지 필요한 경험치 (02 부록 B: 100 × 레벨^1.6) */
export const xpToNext = (level: number) => (level >= MAX_LEVEL ? Infinity : Math.round(100 * level ** 1.6));

export type Grade = 'S' | 'A' | 'B' | 'C';

/** 정산 등급: 던전 전체 쓰러진 파티원 수 (프로토타입과 같음) */
export const gradeOf = (deaths: number): Grade => (deaths === 0 ? 'S' : deaths === 1 ? 'A' : deaths <= 3 ? 'B' : 'C');

/** 골드·경험치 배율 (12 3-1) */
export const REWARD_DIFF: Record<DiffName, number> = { '쉬움': 0.8, '보통': 1.0, '어려움': 1.3, '악몽': 1.6 };
export const REWARD_GRADE: Record<Grade, number> = { S: 1.2, A: 1.1, B: 1.0, C: 0.9 };

/** 클리어 골드 = (50 + 10 × 레벨 단계) × 난이도 × 등급. 레이드는 보스 1마리마다 × 2 (12 3-1) */
export function clearGold(stageLv: number, diff: DiffName, grade: Grade, raidBosses = 0): number {
  const g = (50 + 10 * stageLv) * REWARD_DIFF[diff] * REWARD_GRADE[grade];
  return Math.round(raidBosses ? g * 2 * raidBosses : g);
}

/** 클리어 경험치 = 지금 레벨에서 필요한 양의 이 비율 × 난이도 × 등급 */
export const XP_SHARE = 1.0;
/** 레벨이 콘텐츠 단계보다 이만큼 넘으면 줄기 시작 (한 레벨에 15%씩, 최저 20%) */
export const XP_OVERLEVEL = 4;
/** 레이드 한 판 = 던전 한 판의 1.5배 (전투가 더 김) */
export const XP_RAID = 1.5;
/** 지면 이만큼만 (편성·난이도 다시 고를 힘은 남게) */
export const XP_LOSE = 0.2;

export function clearXp(level: number, stageLv: number, diff: DiffName, grade: Grade | null, opts: { raid?: boolean; win: boolean }): number {
  if (level >= MAX_LEVEL) return 0;
  const over = level - stageLv - XP_OVERLEVEL;
  const fall = over > 0 ? Math.max(0.2, 1 - 0.15 * over) : 1;
  const g = opts.win && grade ? REWARD_GRADE[grade] : 1;
  const x = xpToNext(level) * XP_SHARE * REWARD_DIFF[diff] * g * fall * (opts.raid ? XP_RAID : 1) * (opts.win ? 1 : XP_LOSE);
  return Math.max(1, Math.round(x));
}

/** 경험치를 더하고 오른 레벨 목록을 돌려줌 */
export function addXp(p: { level: number; xp: number }, amt: number): number[] {
  const ups: number[] = [];
  p.xp += amt;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    ups.push(p.level);
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return ups;
}

/**
 * 별 3개 (09 S08). 조건은 P1 초안 (24 문서):
 * ① 클리어 ② 아무도 안 쓰러짐(던전 전체) ③ 오버힐 40% 이하.
 * 자동 힐러 시뮬은 오버힐 30~37%라 ③은 손으로 아껴 힐하면 받는 별.
 */
export const STAR_OVERHEAL = 0.4;
export function starsOf(r: { win: boolean; deaths: number; overheal: number }): boolean[] {
  return [r.win, r.win && r.deaths === 0, r.win && r.overheal <= STAR_OVERHEAL];
}

/** 소비 아이템 단축칸 수 (18 2-2, 19): Lv 1 = 2칸, Lv 20 = 3칸, Lv 40 = 4칸 */
export const itemSlots = (level: number) => (level >= 40 ? 4 : level >= 20 ? 3 : 2);

/** 길드 탭 해금 (09 1-1, 18) */
export const GUILD_LEVEL = 15;
/** 특성 탭 해금 */
export const TALENT_LEVEL = 10;

/**
 * 레벨업 팝업에 보여 줄 "새로 열림" (18 2-2). live = 이 빌드에서 실제로 바뀌는 것.
 * 스킬 해금·특성·길드는 아직 안 만들어서 live: false → 팝업에 「준비 중」으로 표시.
 */
export interface Milestone { text: string; live: boolean }
export const MILESTONES: Record<number, Milestone[]> = {
  2: [{ text: '스킬 「소생」', live: false }],
  3: [{ text: '스킬 「정화」', live: false }],
  5: [{ text: '스킬 「치유의 기원」', live: false }, { text: '던전 「역병 지하묘지」', live: false }],
  8: [{ text: '스킬 「수호 영혼」', live: false }],
  10: [{ text: '특성 1단', live: false }, { text: '공개모집 직업 +6종', live: false }, { text: '던전 「독안개 늪」', live: false }],
  12: [{ text: '스킬 「천상의 찬가」 (스킬 7개 완성)', live: false }],
  15: [{ text: '길드 (골드 모집·인연 스카우트)', live: false }, { text: '던전 「저주받은 장원」', live: false }],
  20: [{ text: '소비 아이템 단축칸 3칸', live: true }, { text: '특성 2단', live: false }, { text: '던전 「서리 마탑」', live: false }],
  28: [{ text: '던전 「깨진 신전」', live: false }],
  30: [{ text: '특성 3단', live: false }],
  35: [{ text: '레이드 「심연의 종탑」 10인', live: true }],
  40: [{ text: '소비 아이템 단축칸 4칸', live: true }, { text: '특성 4단', live: false }],
  50: [{ text: '전설 장비 드롭', live: true }, { text: '특성 5단', live: false }],
  60: [{ text: '특성 6단', live: false }],
  70: [{ text: '레이드 악몽 20인', live: true }, { text: '특성 7단', live: false }],
  80: [{ text: '특성 8단', live: false }],
  90: [{ text: '특성 9단', live: false }],
  100: [{ text: '특성 10단 · 칭호', live: false }],
};

/** 다음 목표 (로비 「다음 목표」 카드, 18 3-3): 지금 레벨 다음 마일스톤 */
export function nextMilestone(level: number): { level: number; items: Milestone[] } | null {
  const lv = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b).find(l => l > level);
  return lv ? { level: lv, items: MILESTONES[lv] } : null;
}
