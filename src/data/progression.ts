/**
 * 힐러 성장·보상 수치 (P1 초안). 근거: 02 부록 B(경험치 곡선), 12 3-1(골드), 18 2-2(레벨 마일스톤), 19(소비 아이템 칸).
 * 경험치 지급량은 문서에 없어 새로 정함 (24 문서). Lv 1~100 곡선은 18 1장 도달 시점에 맞춤 (xpShare, 2026-10-07).
 */
import type { DiffName } from './difficulty';
import { FEATURES } from './features';

export const MAX_LEVEL = 100;

const lvClamp = (level: number) => Math.max(1, Math.min(MAX_LEVEL, level));

/**
 * 레벨 배율 (34 1-2): 숫자를 작게 시작해서 크게 키움. Lv 1 = 0.4 (예전 숫자 ÷2.5: 힐러 체력 220 · 치유 120),
 * 레벨마다 Lv 1 값의 +22% → Lv 100 ≈ 9.1 (예전 Lv 100 숫자와 비슷).
 * 힐러 힐량·체력과 파티원·적 체력·피해·딜 모두 이 배율로 곱한다. 세기 차이는 적 세기 0.95 (rules.ts) · 장비 · 특성 · 난이도.
 * 마나는 % 체계라 레벨로 늘지 않음 (18 2-1).
 */
export const NUM_SCALE = 0.4;
export const LV_GROWTH = 0.22;
export const lvPower = (level: number) => NUM_SCALE * (1 + LV_GROWTH * (lvClamp(level) - 1));
/** 프로토타입 레벨 배율 (34 이전, parity 테스트): Lv 1 = 1.0, 레벨마다 +0.08 */
export const lvPowerProto = (level: number) => 1 + 0.08 * (lvClamp(level) - 1);

/** 다음 레벨까지 필요한 경험치 (02 부록 B: 100 × 레벨^1.6) */
export const xpToNext = (level: number) => (level >= MAX_LEVEL ? Infinity : Math.round(100 * level ** 1.6));

export type Grade = 'S' | 'A' | 'B' | 'C';

/** 정산 등급: 던전 전체 쓰러진 파티원 수 (프로토타입과 같음) */
export const gradeOf = (deaths: number): Grade => (deaths === 0 ? 'S' : deaths === 1 ? 'A' : deaths <= 3 ? 'B' : 'C');

/** 골드·경험치 배율 (12 3-1) */
export const REWARD_DIFF: Record<DiffName, number> = { '쉬움': 0.8, '보통': 1.0, '어려움': 1.3, '악몽': 1.6 };
export const REWARD_GRADE: Record<Grade, number> = { S: 1.2, A: 1.1, B: 1.0, C: 0.9 };

/** 레이드 보스 1마리 골드 배율 (26 6장): 10인 ×1.5, 20인 ×2.2 (레벨 맞춤으로 2·3에서 낮춤, 32 3-2) */
export const RAID_GOLD = { 10: 1.5, 20: 2.2 } as const;
/** 탐험 골드·경험치 배율 (32 3-3): 구간 1개라 짧고 쉬움. 적 레벨이 내 레벨이 되며 던전보다 나은 파밍 자리가 되지 않게 */
export const EXPLORE_REWARD = 0.35;

/** 클리어 골드 = (50 + 10 × 적 레벨) × 난이도 × 등급. 레이드는 보스 1마리마다 × RAID_GOLD (12 3-1). raid = 레이드 인원 (0 = 던전·탐험) */
export function clearGold(stageLv: number, diff: DiffName, grade: Grade, raid: 0 | 10 | 20 = 0): number {
  const g = (50 + 10 * stageLv) * REWARD_DIFF[diff] * REWARD_GRADE[grade];
  return Math.round(raid ? g * RAID_GOLD[raid] : g);
}

/**
 * 클리어 경험치 = 지금 레벨에서 필요한 양의 이 비율 × 난이도 × 등급 (18 1장 도달 시점에 맞춤).
 * 낮은 레벨은 1판 ≈ 1레벨, 높을수록 판 수가 늘어남. Lv 15부터 ×0.85, Lv 70부터는 절반 (20인 레이드가 있어서).
 * 적이 늘 내 레벨이라 (32) 넘침 감소 없음. 시뮬 (하루 8판, 보통 A, 가장 좋은 콘텐츠): Lv 15 약 2일 · 35 약 8일 · 70 약 4주 · 100 약 12주
 */
export const xpShare = (level: number) => Math.min(1, 14 * level ** -1.1) * (level >= 15 ? 0.85 : 1) * (level >= 70 ? 0.5 : 1);
/** 레이드 한 판 = 던전 한 판의 10인 1.2배, 20인 1.4배 (전투가 더 김, 26 6장. 레벨 맞춤으로 1.5·2에서 낮춤, 32 3-1) */
export const XP_RAID = { 10: 1.2, 20: 1.4 } as const;
/** 지면 이만큼만 (편성·난이도 다시 고를 힘은 남게) */
export const XP_LOSE = 0.2;
/** 따라잡기 (34 3-2): 지금 직업 레벨이 가장 높은 직업 레벨보다 낮으면 경험치 ×3. 따라잡으면 끝 */
export const CATCH_UP_XP = 3;

export function clearXp(level: number, diff: DiffName, grade: Grade | null, opts: { raid?: 0 | 10 | 20; win: boolean }): number {
  if (level >= MAX_LEVEL) return 0;
  const g = opts.win && grade ? REWARD_GRADE[grade] : 1;
  const x = xpToNext(level) * xpShare(level) * REWARD_DIFF[diff] * g * (opts.raid ? XP_RAID[opts.raid] : 1) * (opts.win ? 1 : XP_LOSE);
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
/** 특성 탭 해금 (특성 1단, 34 2-1) */
export const TALENT_LEVEL = 5;
/** 정점 수련 (34 2-2): 특성이 끝난 Lv 51부터 레벨마다 지능·체력 +0.3% (Lv 100 = +15%). 고르는 것 없음 */
export const APEX_FROM = 50;
export const APEX_STEP = 0.003;
export const apexOf = (level: number) => 1 + APEX_STEP * Math.max(0, lvClamp(level) - APEX_FROM);

/**
 * 레벨업 팝업에 보여 줄 "새로 열림" (18 2-2). live = 이 빌드에서 실제로 바뀌는 것.
 * 아직 안 만든 것(다른 던전, 공개모집 직업 단계 해금)은 live: false → 팝업에 「준비 중」으로 표시.
 */
export interface Milestone { text: string; live: boolean }
export const MILESTONES: Record<number, Milestone[]> = {
  2: [{ text: '스킬 「소생」', live: true }],
  3: [{ text: '스킬 「정화」', live: true }],
  4: [{ text: '패시브 「빛의 은총」 (소생 걸린 대상 치유 +10%)', live: true }],
  5: [{ text: '스킬 「치유의 기원」', live: true }, { text: '특성 1단 (사제)', live: true }, { text: '던전 「역병 지하묘지」', live: false }],
  6: [{ text: '성언 게이지 (평온·신성화)', live: true }],
  8: [{ text: '스킬 「수호 영혼」', live: true }],
  10: [{ text: '패시브 「상징」 (마나 30% 아래서 회복 4배)', live: true }, { text: '특성 2단', live: true }, { text: '직업 바꾸기 · 드루이드 퀘스트 「숲의 부름」', live: true }, { text: '주간 임무 (악몽 열쇠)', live: true }, { text: '공개모집 직업 +6종', live: false }, { text: '던전 「독안개 늪」', live: false }],
  12: [{ text: '공대 쿨기 (사제 「천상의 찬가」, 스킬 7개 완성)', live: true }],
  15: [{ text: '8번째 칸 고유 스킬 (드루이드·성기사)', live: true }, { text: '특성 3단', live: true }, ...(FEATURES.guild ? [{ text: '길드 (골드 모집·인연 스카우트)', live: true }] : []), { text: '던전 「저주받은 장원」', live: false }],
  20: [{ text: '소비 아이템 단축칸 3칸', live: true }, { text: '성기사 퀘스트 「첫 맹세」', live: true }, { text: '특성 4단', live: true }, { text: '주간 도전 「모래시계 시련」', live: true }, { text: '던전 「서리 마탑」', live: false }],
  25: [{ text: '특성 5단', live: true }],
  28: [{ text: '던전 「깨진 신전」', live: false }],
  30: [{ text: '특성 6단', live: true }, { text: '어려움·악몽 던전에 어픽스 「격노」', live: true }],
  35: [{ text: '10인 레이드 「심연의 탑」', live: true }, { text: '특성 7단', live: true }],
  40: [{ text: '소비 아이템 단축칸 4칸', live: true }, { text: '특성 8단', live: true }],
  45: [{ text: '특성 9단', live: true }],
  50: [{ text: '특성 10단 (완성)', live: true }, { text: '전설 장비 드롭', live: true }, { text: '10인 레이드 악몽', live: true }, { text: '악몽 던전에 어픽스 「역병」', live: true }, { text: '직업 칭호', live: false }],
  51: [{ text: '정점 수련 (레벨마다 지능·체력 +0.3%)', live: true }],
  60: [{ text: '장신구 둘째 칸', live: false }],
  70: [{ text: '20인 레이드 「가라앉은 대성당」', live: true }],
  80: [{ text: '20인 레이드 악몽', live: true }],
  100: [{ text: '직업 색 힐 이펙트 · 칭호', live: false }],
};

/** 다음 목표 (로비 「다음 목표」 카드, 18 3-3): 지금 레벨 다음 마일스톤 */
export function nextMilestone(level: number): { level: number; items: Milestone[] } | null {
  const lv = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b).find(l => l > level);
  return lv ? { level: lv, items: MILESTONES[lv] } : null;
}
