import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dayKey, untilReset, untilWeekReset, weekKey } from '../src/game/clock';

// 리셋은 UTC 0시 (기획 120 9-3, 2026-10-29 Lim 「리셋 시간대는 utc기준 00:00」): 기기 시간대 · 서머타임과 상관없다.
// 예전 (기기 시간대 오전 6시)에는 서머타임 날 리셋이 1시간 어긋나지 않게 벽시계로 셌다.
const H = 3600e3;
let tz: string | undefined;
beforeAll(() => { tz = process.env.TZ; process.env.TZ = 'America/New_York'; });
afterAll(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });
const utc = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h, min);

describe('UTC 0시 리셋은 기기 시간대 · 서머타임과 상관없음 (뉴욕 시간대로 실행)', () => {
  it('시간대가 뉴욕으로 바뀌어 있음', () => {
    expect(new Date(2027, 2, 14, 12).getTimezoneOffset()).toBe(240);
    expect(new Date(2027, 2, 13, 12).getTimezoneOffset()).toBe(300);
  });

  it('서머타임이 시작하는 날 (2027-03-14)도 UTC 0시에 하루가 바뀌고 하루는 24시간', () => {
    expect(dayKey(utc(2027, 3, 13, 23, 59))).toBe('2027-03-13');
    expect(dayKey(utc(2027, 3, 14, 0))).toBe('2027-03-14');
    expect(untilReset(utc(2027, 3, 13, 23, 59))).toBe(60e3);
    expect(untilReset(utc(2027, 3, 14, 0))).toBe(24 * H);
    expect(untilReset(utc(2027, 3, 14, 6, 30))).toBe(17.5 * H);
  });

  it('서머타임이 끝나는 날 (2026-11-01)도 같음', () => {
    expect(dayKey(utc(2026, 10, 31, 23, 59))).toBe('2026-10-31');
    expect(dayKey(utc(2026, 11, 1, 0))).toBe('2026-11-01');
    expect(untilReset(utc(2026, 10, 31, 0))).toBe(24 * H);
  });

  it('주간 키 · 주간 리셋은 월요일 UTC 0시', () => {
    expect(weekKey(utc(2027, 3, 14, 12))).toBe('2027-03-08');
    expect(weekKey(utc(2027, 3, 14, 23, 59))).toBe('2027-03-08');
    expect(weekKey(utc(2027, 3, 15, 0))).toBe('2027-03-15');
    expect(untilWeekReset(utc(2027, 3, 14, 23, 59))).toBe(60e3);
    expect(untilWeekReset(utc(2027, 3, 15, 0))).toBe(7 * 24 * H);
    expect(weekKey(utc(2026, 11, 1, 23, 59))).toBe('2026-10-26');
    expect(weekKey(utc(2026, 11, 2, 0))).toBe('2026-11-02');
  });

  it('한국 시간으로는 매일 오전 9시', () => {
    // 2026-10-29 08:59 KST = 10-28 23:59 UTC, 09:00 KST = 10-29 00:00 UTC
    expect(dayKey(utc(2026, 10, 28, 23, 59))).toBe('2026-10-28');
    expect(dayKey(utc(2026, 10, 29, 0))).toBe('2026-10-29');
  });
});
