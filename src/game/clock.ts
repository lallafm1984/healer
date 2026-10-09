/** 리셋 시각 (13 1장): 매일 오전 6시, 주간은 월요일 오전 6시. 기기 시간 기준 (서버 시간은 서버를 붙일 때) */
import { SEASON } from '../data/economy';

export const RESET_HOUR = 6;
const H = 3600e3, D = 24 * H;
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
/** 오전 6시 전이면 어제로 침 */
const shifted = (now: number) => new Date(now - RESET_HOUR * H);

export const dayKey = (now = Date.now()) => key(shifted(now));
export function weekKey(now = Date.now()): string {
  const d = shifted(now), dow = (d.getDay() + 6) % 7;
  return key(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow));
}
/** 날짜 키 사이 일 수 (b - a) */
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / D);

/** 다음 일일 리셋까지 남은 시간 (ms) */
export function untilReset(now = Date.now()): number {
  const d = shifted(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, RESET_HOUR).getTime();
  return next - now;
}
export const hhmm = (ms: number) => { const m = Math.max(0, Math.ceil(ms / 60e3)); return `${Math.floor(m / 60)}시간 ${m % 60}분`; };

/** 다음 주간 리셋까지. 날짜 연산으로 월요일 오전 6시를 보존한다. */
export function untilWeekReset(now = Date.now()): number {
  const start = parse(weekKey(now));
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, RESET_HOUR).getTime() - now;
}

/** 로비·목록에서 공유하는 마감 표현. 남은 전체 일/시간을 내림하며, 1분 미만을 0분으로 쓰지 않는다. */
export function remainingTime(ms: number): string {
  if (ms <= 0) return '마감';
  if (ms >= D) return `${Math.floor(ms / D)}일`;
  if (ms >= H) return `${Math.floor(ms / H)}시간`;
  if (ms >= 60e3) return `${Math.floor(ms / 60e3)}분`;
  return '1분 미만';
}

export const weekRemaining = (now = Date.now()) => remainingTime(untilWeekReset(now));

/** 시즌 번호와 시즌 안 몇째 주 (0부터). 시즌 1 시작 전이면 시즌 1의 0주 */
export function seasonOf(now = Date.now()): { n: number; week: number; catchUp: boolean } {
  const weeks = Math.max(0, Math.floor(daysBetween(SEASON.start, weekKey(now)) / 7));
  const n = SEASON.n + Math.floor(weeks / SEASON.weeks), week = weeks % SEASON.weeks;
  return { n, week, catchUp: week >= SEASON.weeks - SEASON.catchUpWeeks };
}
