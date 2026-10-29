/**
 * 리셋 시각 (2026-10-29 Lim 「리셋 시간대는 utc기준 00:00 으로」, 기획 120 9-3): 매일 UTC 00:00 (한국 오전 9시), 주간은 월요일 UTC 00:00.
 * 시각은 게임 시각 now() (서버 시각 + 경과 시계, platform/time). 기기 시계 · 기기 시간대와 상관없음 (예전: 기기 시간대 오전 6시)
 */
import { now as gameNow } from '../platform/time';
import { t } from '../i18n';

/** 리셋 시 (UTC) */
export const RESET_HOUR = 0;
const H = 3600e3, D = 24 * H;
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** 리셋 시보다 이르면 어제로 침 (UTC 날짜) */
const shifted = (t: number) => new Date(t - RESET_HOUR * H);

export const dayKey = (now = gameNow()) => key(shifted(now));
export function weekKey(now = gameNow()): string {
  const d = shifted(now), dow = (d.getUTCDay() + 6) % 7;
  return key(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)));
}
/** 날짜 키 사이 일 수 (b - a) */
export const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / D);

/** 다음 일일 리셋까지 남은 시간 (ms) */
export function untilReset(now = gameNow()): number {
  return parse(dayKey(now)) + D + RESET_HOUR * H - now;
}
export const hhmm = (ms: number) => { const m = Math.max(0, Math.ceil(ms / 60e3)); return t('{h}시간 {m}분', { h: Math.floor(m / 60), m: m % 60 }); };

/** 다음 주간 리셋까지 (월요일 UTC 00:00) */
export function untilWeekReset(now = gameNow()): number {
  return parse(weekKey(now)) + 7 * D + RESET_HOUR * H - now;
}

/** 로비·목록에서 공유하는 마감 표현. 남은 전체 일/시간을 내림하며, 1분 미만을 0분으로 쓰지 않는다. */
export function remainingTime(ms: number): string {
  if (ms <= 0) return t('마감');
  if (ms >= D) return t('{n}일', { n: Math.floor(ms / D) });
  if (ms >= H) return t('{n}시간', { n: Math.floor(ms / H) });
  if (ms >= 60e3) return t('{n}분', { n: Math.floor(ms / 60e3) });
  return t('1분 미만');
}

export const weekRemaining = (now = gameNow()) => remainingTime(untilWeekReset(now));
