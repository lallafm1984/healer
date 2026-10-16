/**
 * 휴식 보너스 (90, 2026-10-16 Lim): 입장은 언제나 됨. 휴식은 최대 100 (광고 제거 패키지 +50), 15분마다 1, 최대치에서 멈춤 (넘는 만큼 쌓아 두지 않음).
 * 클리어할 때 (진 판 · 포기 아님) 휴식이 1 이상이면 콘텐츠 몫만큼 쓰고 (0 아래로 안 감) 보상 그대로, 0이면 경험치 · 강화석 · 정제 강화석이 1/3 (정산 settle.ts).
 * 광고 충전 +30은 하루 3번 (오전 6시 리셋)이고 최대치를 넘어도 들어감.
 * 코드 · 저장 이름은 81 때 그대로 stamina (save.stamina = n · at · day · ads). 저장 형식은 바뀌지 않음.
 * 기기 시계 기준이라 시계를 앞당겼다 되돌리면 그 시각이 다시 올 때까지 차지 않음. 화면과 분리된 순수 계산 (시각은 받아서 씀)
 */
import { raidSize, type ContentDef } from '../data/content';
import { NOADS, REST_CUT, STAMINA, STAMINA_COST } from '../data/economy';
import type { SaveData } from '../platform/storage';
import { dayKey } from './clock';

/** 광고 제거 패키지를 삼 (배너 · 전면 광고 없음, 휴식 충전은 광고 없이 바로) */
export const adsFree = (save: SaveData): boolean => save.bought.includes(NOADS.id);
/** 최대치 (자연 회복이 멈추는 값) */
export const staminaMax = (save: SaveData): number => STAMINA.max + (adsFree(save) ? STAMINA.bonus : 0);
/** 화면 테스트는 window.__staminaFree = true면 휴식 무제한 (window.__villageMotion처럼, 휴식 자체 검사는 e2e shop) */
const testFree = (): boolean => typeof window !== 'undefined' && !!(window as unknown as { __staminaFree?: boolean }).__staminaFree;
/** 개발 빌드 「휴식 무제한」: 클리어해도 줄지 않고 보상은 늘 그대로 (실제 값은 그대로 두고 표시만 ∞) */
export const unlimitedStamina = (save: SaveData): boolean => !!save.settings.devStamina || testFree();

/** 클리어할 때 쓰는 휴식: 탐험 5 · 던전 10 · 주간 도전 10 · 10인 레이드 15 · 20인 레이드 20 */
export function staminaCost(c: ContentDef, chal = 0): number {
  if (chal) return STAMINA_COST.chal;
  if (c.kind === 'raid') return raidSize(c) === 20 ? STAMINA_COST.raid20 : STAMINA_COST.raid10;
  return c.kind === 'dungeon' ? STAMINA_COST.dungeon : STAMINA_COST.explore;
}

/** 지금 시각까지 찬 만큼 더하고, 날이 바뀌었으면 광고 횟수를 새로. 바뀐 게 있으면 true (저장은 부른 쪽이) */
export function syncStamina(save: SaveData, now: number): boolean {
  const s = save.stamina, max = staminaMax(save), day = dayKey(now);
  let changed = false;
  if (s.day !== day) { s.day = day; s.ads = 0; changed = true; }
  if (s.n >= max) {
    // 가득 찼으면 시계를 멈춰 둠: 쓰고 나서 15분을 처음부터 셈. 시계를 되돌렸으면 at은 그대로 (그 시각까지 안 참)
    if (now > s.at) { s.at = now; changed = true; }
    return changed;
  }
  if (now <= s.at) return changed;
  const got = Math.floor((now - s.at) / STAMINA.regenMs);
  if (got <= 0) return changed;
  s.n = Math.min(max, s.n + got);
  s.at = s.n >= max ? now : s.at + got * STAMINA.regenMs;
  return true;
}

export interface StaminaView {
  n: number; max: number;
  /** 다음 1이 찰 때까지 (ms). 가득이면 0 */
  next: number;
  /** 최대치까지 (ms). 가득이면 0 */
  full: number;
  /** 오늘 남은 광고 충전 */
  adsLeft: number;
  unlimited: boolean;
}

export function staminaView(save: SaveData, now: number): StaminaView {
  syncStamina(save, now);
  const s = save.stamina, max = staminaMax(save);
  const lack = Math.max(0, max - s.n);
  // 시계를 되돌렸으면 (now < at) 그만큼 더 기다림
  const next = lack ? Math.max(0, s.at + STAMINA.regenMs - now) : 0;
  return { n: s.n, max, next, full: lack ? next + (lack - 1) * STAMINA.regenMs : 0, adsLeft: Math.max(0, STAMINA.adDaily - s.ads), unlimited: unlimitedStamina(save) };
}

/** 휴식으로 받은 판 (보상 그대로) · 휴식 없이 받은 판 (경험치 · 강화석 · 정제 강화석 1/3) */
export interface RestUse { used: number; cut: boolean }

/**
 * 클리어할 때 (90): 휴식이 1 이상이면 cost만큼 쓰고 (0 아래로 안 감) 보상 그대로, 0이면 쓰지 않고 보상 1/3.
 * 무제한 (개발 빌드 · 화면 테스트)이면 쓰지 않고 그대로
 */
export function useRest(save: SaveData, cost: number, now: number): RestUse {
  syncStamina(save, now);
  if (unlimitedStamina(save)) return { used: 0, cut: false };
  const s = save.stamina, max = staminaMax(save);
  if (s.n < 1) return { used: 0, cut: true };
  // 가득 차 있었으면 지금부터 15분을 셈 (최대치에서는 시계가 멈춰 있음)
  if (s.n >= max) s.at = Math.max(s.at, now);
  const used = Math.min(s.n, cost);
  s.n -= used;
  return { used, cut: false };
}

/** 휴식 없는 판의 몫 (1/3). 경험치처럼 큰 수는 반올림 (1 이상), 강화석처럼 작은 수는 기댓값이 1/3이 되게 확률로 올림 */
export const restCutXp = (xp: number): number => (xp > 0 ? Math.max(1, Math.round(xp * REST_CUT)) : 0);
export function restCutMat(n: number, rng: () => number): number {
  const v = n * REST_CUT, lo = Math.floor(v + 1e-9), f = v - lo;
  return lo + (f > 1e-9 && rng() < f ? 1 : 0);
}

/** 광고 충전 한 번 (+30, 최대치를 넘어도 들어감). 광고는 부른 쪽이 먼저 보여 줌. 성공 = 빈 문자열 */
export function adCharge(save: SaveData, now: number): string {
  syncStamina(save, now);
  const s = save.stamina;
  if (s.ads >= STAMINA.adDaily) return `오늘 광고 충전 ${STAMINA.adDaily}번을 다 씀`;
  const max = staminaMax(save);
  // 최대치를 넘기면 시계를 멈춤 (넘은 동안은 안 참)
  s.ads++;
  s.n += STAMINA.ad;
  if (s.n >= max) s.at = Math.max(s.at, now);
  return '';
}

/** 남은 시간 글 (m:ss, 1시간 넘으면 h:mm:ss) */
export function staminaClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
