/**
 * 초보 자동 힐러 (2026-10-22 Lim 「테스트 자동힐시 처음사용자 시점의 조작의 테스트로 초반 난이도 체크로직이 필요하다」).
 * 자동 힐러 (auto.ts)는 거의 완벽하게 누른다: 시전 · GCD가 끝나는 틱에 바로 다음 스킬, 보스 기술 대기열을 읽고 강타 전에 미리 채움,
 * 기믹 공략을 다 알고, 큰 버튼을 한 번도 잊지 않는다. 처음 하는 사람은 그렇지 않다.
 * 그래서 판단 (무엇을 · 누구에게)은 자동 힐러 것을 그대로 쓰고, 그 위에 처음 하는 사람의 눈 · 머리 · 손 한계를 겹친다 (auto.ts noviceHealer).
 * 값은 NOVICE 한 곳. 근거가 있는 값과 가정값을 주석에 나눠 적었다.
 * 익숙함 (2026-10-22 Lim 「레벨 10까지 쉽게 하고 점점 익숙해지니까 그에 맞춰서 난이도를 올리자」): 내 레벨 10까지는 처음 하는 사람 (NOVICE),
 * Lv 20에서 익숙한 사람 (FAMILIAR), 사이는 직선 (noviceAt). noviceHealer는 판의 내 레벨로 그 사람을 씀
 */
import { SKILLS, type SkillKey } from '../data/skills';
import type { TalentKey } from '../data/talents';
import { hexDist } from './board';
import { living } from './core';
import { rngFrom } from './rng';
import type { Debuff, Fight, Unit } from './types';

export interface NoviceOpts {
  /**
   * 한가해진 것 (시전 · GCD 끝)을 보고 누르기까지 (단순 시각 반응 200 ~ 250ms). 같은 사람에게 같은 스킬을 이어 누르면 이것만
   * (손가락이 그 칸 위에 있고 고를 것이 없음, 튜토리얼 「탱커 칸을 자주 탭하기」). 숙련자는 시전 중에 다음 것을 미리 골라 GCD 동안 예약해 0
   */
  react: number;
  /**
   * 다른 사람 · 다른 스킬로 바꿀 때 고르는 시간 (Hick–Hyman 법칙: b × log2(고를 것 + 1), 고를 것 = 살아 있는 파티원, 나 포함).
   * b 0.15초/bit = 연습 안 한 사람 보통 값 (문헌 150 ~ 200ms/bit의 아래쪽)
   */
  pick: number;
  /** 다른 칸으로 엄지를 옮겨 누르는 시간 (Fitts 법칙, 폰 엄지로 2 ~ 3cm 떨어진 1cm 칸: 약 2bit) */
  tap: number;
  /** 판단마다 흔들림: 위 시간 × 로그정규 (σ). 5인 바꿀 때 가운데값 0.94초, 이어 누를 때 0.25초 */
  spread: number;
  /** 한눈팔기 (가정값): 평균 every초에 한 번 min ~ max초 동안 새로 누르지 않음 (보스 동작 · 말풍선 · 이펙트 · 설명을 봄. 운전 중 눈 돌림 0.5 ~ 2초 연구를 빌림) */
  lapse: { every: number; min: number; max: number };
  /** 체력 막대 읽기 오차 (가정값): 「가장 낮은 사람」을 고를 때 체력 비율을 표준편차만큼 틀리게 봄 */
  see: number;
  /** 옆 칸을 누름: 폰 엄지 1cm 칸 (Parhi 2006: 9.2mm 넘으면 오류가 더 줄지 않음)에서 서두를 때 */
  misTap: number;
  /** 디버프를 알아채기까지 (걸린 뒤 초, 로그정규 가운데값 · σ 0.5) */
  notice: number;
  /** 큰 버튼 (재사용 30초 이상 · 평온 성언 · 환생 · 특성 버튼)을 떠올리는 몫 (가정값). recallWin초마다 다시 굴림 */
  recall: number;
  recallWin: number;
  /** 보스 기술 대기열 (화면 위 다음 기술)을 읽음. 처음 하는 사람은 예고가 뜬 강타만 보고 대비함 */
  queue: boolean;
  /** 기믹 공략 (힐하면 손해인 사람 · 차례 · 체력 선 · 사슬 · 띄우기 …)을 앎. 모르면 가장 낮은 사람 채우기 · 보이는 디버프 지우기만 (뒤집힌 축복은 화면이 막아 줌) */
  tactics: boolean;
}

/** 처음 하는 사람 (튜토리얼 ~ 초반 순차 레벨링 구간) */
export const NOVICE: NoviceOpts = {
  react: 0.25,
  pick: 0.15,
  tap: 0.3,
  spread: 0.3,
  lapse: { every: 30, min: 1, max: 2 },
  see: 0.07,
  misTap: 0.03,
  notice: 1.5,
  recall: 0.5,
  recallWin: 4,
  queue: false,
  tactics: false,
};

/**
 * 익숙한 사람: 길잡이 길로 Lv 20쯤 (70 4장, 70판 남짓 · 8일째). 연습하면 고르는 기울기가 크게 준다 (Hick 기울기는 연습으로 수십 ms/bit까지),
 * 엄지 길도 익는다 (가정값). 대기열 · 기믹 공략은 탐험 미리보기 · 일시정지 공략으로 안다. 그래도 숙련 자동 힐러 (시간 0 · 실수 0)보다는 느리다
 */
export const FAMILIAR: NoviceOpts = {
  react: 0.2,
  pick: 0.06,
  tap: 0.2,
  spread: 0.25,
  lapse: { every: 60, min: 0.5, max: 1.5 },
  see: 0.04,
  misTap: 0.02,
  notice: 0.8,
  recall: 0.85,
  recallWin: 4,
  queue: true,
  tactics: true,
};
/** 익숙함이 붙는 내 레벨: from까지 처음 하는 사람, to부터 익숙한 사람 */
export const FAMILIAR_LV = { from: 10, to: 20 };
/**
 * 능숙한 사람 (2026-10-22 Lim 「고친다」, 익숙한 사람 검사 다음): 고르기 · 엄지 옮기기를 앞 시전 중에 끝내 한가해진 뒤 반응만 걸림.
 * 내 Lv 20 (익숙) → MASTER_LV (능숙) 사이 직선 (noviceAt)
 */
export const MASTER: NoviceOpts = { ...FAMILIAR, pick: 0, tap: 0 };
export const MASTER_LV = 60;
/** 익숙함 0 (처음) ~ 1 (익숙) */
export const familiarity = (lv: number) => Math.max(0, Math.min(1, (lv - FAMILIAR_LV.from) / (FAMILIAR_LV.to - FAMILIAR_LV.from)));
/** 그 레벨 사람: 숫자는 처음 → 익숙 (Lv 20) → 능숙 (Lv 60) 사이 직선, 대기열 · 기믹 공략은 사람마다 (seed) 익숙함 확률로 앎 */
export function noviceAt(lv: number, seed = 1): NoviceOpts {
  if (lv > FAMILIAR_LV.to) {
    const m = Math.min(1, (lv - FAMILIAR_LV.to) / (MASTER_LV - FAMILIAR_LV.to)), F = FAMILIAR, M = MASTER;
    return { ...F, pick: F.pick + (M.pick - F.pick) * m, tap: F.tap + (M.tap - F.tap) * m };
  }
  const k = familiarity(lv), N = NOVICE, F = FAMILIAR, mix = (a: number, b: number) => a + (b - a) * k;
  const r = rngFrom(Math.imul(seed >>> 0, 0x5f356495) ^ 0x2545f491), q = r(), t = r();
  return {
    react: mix(N.react, F.react), pick: mix(N.pick, F.pick), tap: mix(N.tap, F.tap), spread: mix(N.spread, F.spread),
    lapse: { every: mix(N.lapse.every, F.lapse.every), min: mix(N.lapse.min, F.lapse.min), max: mix(N.lapse.max, F.lapse.max) },
    see: mix(N.see, F.see), misTap: mix(N.misTap, F.misTap), notice: mix(N.notice, F.notice), recall: mix(N.recall, F.recall), recallWin: N.recallWin,
    queue: k > 0 && q < k, tactics: k > 0 && t < k,
  };
}

/** 미뤄 둔 행동 (자동 힐러가 고른 첫 행동) */
export type NoviceAct = { kind: 'skill'; k: SkillKey; cell: number } | { kind: 'talent'; k: TalentKey; cell?: number };

export interface Novice {
  o: NoviceOpts;
  rng: () => number;
  /** 고른 행동과 누를 시각 */
  intent: NoviceAct | null;
  due: number;
  /** 자동 힐러를 돌리는 동안 잡은 첫 행동 */
  pick: NoviceAct | null;
  /** 한눈팔기: 끝 · 다음 시작 */
  awayUntil: number;
  nextLapse: number;
  /** 디버프 id → 알아채는 시각 */
  seen: Map<number, number>;
  /** 큰 버튼 → 떠올림 창 */
  recalled: Map<string, { until: number; on: boolean }>;
  /** 이번 판단의 체력 읽기 오차 (파티원 id → 비율) */
  err: Map<number, number>;
  /** 마지막으로 누른 사람 · 스킬 (이어 누르기) */
  last: { uid: number | null; k: string } | null;
  /** 기록: 누른 수 · 옆 칸 · 한눈판 수 · 헛탭 · 바꿔 누른 수 */
  stats: { presses: number; misTaps: number; lapses: number; fails: number; switches: number };
}

const states = new WeakMap<Fight, Novice>();
/** 판마다 하나 (같은 시드면 같은 사람: 엔진 난수와 따로 굴림). 기본은 판의 내 레벨 사람 (noviceAt) */
export function noviceOf(f: Fight, opts?: Partial<NoviceOpts>): Novice {
  let n = states.get(f);
  if (n) return n;
  const o = { ...noviceAt(f.level, f.cfg.seed || 1), ...opts };
  const rng = rngFrom(Math.imul((f.cfg.seed || 1) >>> 0, 0x2c1b3c6d) ^ 0x7f4a7c15);
  n = { o, rng, intent: null, due: 0, pick: null, awayUntil: 0, nextLapse: 0, seen: new Map(), recalled: new Map(), err: new Map(), last: null, stats: { presses: 0, misTaps: 0, lapses: 0, fails: 0, switches: 0 } };
  n.nextLapse = f.t + expo(n, o.lapse.every);
  states.set(f, n);
  return n;
}

const expo = (n: Novice, mean: number) => -Math.log(1 - n.rng()) * mean;
function gauss(n: Novice): number {
  const u = Math.max(1e-9, n.rng()), v = n.rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const logn = (n: Novice, median: number, sigma: number) => median * Math.exp(sigma * gauss(n));

/** 칸에 선 사람 id (없으면 null) */
export const uidAt = (f: Fight, cell?: number) => (cell == null ? null : f.cells[cell]?.unit?.id ?? null);
/** 다음 행동까지 걸리는 시간: 반응 + (바꿀 때) 고르기 (Hick–Hyman) · 옮겨 누르기 (Fitts), 흔들림 */
export function thinkTime(f: Fight, n: Novice, a: NoviceAct): number {
  const same = !!n.last && n.last.k === a.k && n.last.uid === uidAt(f, a.cell);
  if (!same) n.stats.switches++;
  return logn(n, n.o.react + (same ? 0 : n.o.pick * Math.log2(living(f).length + 1) + n.o.tap), n.o.spread);
}

/** 한눈팔기 차례면 시작 (true = 지금 한눈팖) */
export function lapseNow(f: Fight, n: Novice): boolean {
  if (f.t < n.awayUntil) return true;
  if (f.t < n.nextLapse) return false;
  const { min, max, every } = n.o.lapse;
  n.awayUntil = f.t + min + (max - min) * n.rng();
  n.nextLapse = n.awayUntil + expo(n, every);
  n.stats.lapses++;
  return true;
}

/** 디버프를 처음 본 시각 기록 (판마다 틱마다) */
export function noteDebuffs(f: Fight, n: Novice): void {
  for (const u of f.party) for (const d of u.debuffs) if (!n.seen.has(d.id)) n.seen.set(d.id, f.t + logn(n, n.o.notice, 0.5));
}
/** 이 디버프를 알아챘는지 */
export const noticed = (f: Fight, n: Novice, d: Debuff) => (n.seen.get(d.id) ?? Infinity) <= f.t;

/** 큰 버튼: 재사용 30초 이상 · 평온 성언 (게이지) · 쓰러진 사람 살리기 */
export const bigButton = (k: SkillKey) => (SKILLS[k].cd ?? 0) >= 30 || SKILLS[k].target === 'dead' || k === 'serenity';
/** 큰 버튼 · 특성 버튼을 지금 떠올리는지 (창마다 recall 확률) */
export function recalls(f: Fight, n: Novice, key: string): boolean {
  let r = n.recalled.get(key);
  if (!r || f.t >= r.until) { r = { until: f.t + n.o.recallWin, on: n.rng() < n.o.recall }; n.recalled.set(key, r); }
  return r.on;
}

/** 이번 판단의 체력 읽기 오차를 새로 굴림 */
export function rollSight(f: Fight, n: Novice): void {
  n.err.clear();
  if (n.o.see > 0) for (const u of f.party) n.err.set(u.id, gauss(n) * n.o.see);
}
export const sightErr = (n: Novice, u: Unit) => n.err.get(u.id) ?? 0;

/** 누르는 칸: misTap 확률로 바로 옆 칸 (없는 칸 · 빈 칸일 수도 있음). 대상 없는 스킬은 그대로 */
export function tapCell(f: Fight, n: Novice, act: NoviceAct): number | undefined {
  if (act.cell == null || (act.kind === 'skill' && SKILLS[act.k].target === 'none')) return act.cell;
  if (n.rng() >= n.o.misTap) return act.cell;
  const at = f.cells[act.cell];
  if (!at) return act.cell;
  const near = f.cells.filter(c => hexDist(c, at) === 1);
  if (!near.length) return act.cell;
  n.stats.misTaps++;
  return near[Math.floor(n.rng() * near.length)].i;
}
