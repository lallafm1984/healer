import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dayKey, untilReset, untilWeekReset, weekKey } from '../src/game/clock';

// 서머타임이 바뀌는 날도 리셋은 벽시계 오전 6시 (QA 4바퀴: 절대 시간 − 6시간이면 1시간 어긋남)
const H = 3600e3;
let tz: string | undefined;
beforeAll(() => { tz = process.env.TZ; process.env.TZ = 'America/New_York'; });
afterAll(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('서머타임 날 일일 · 주간 리셋 (뉴욕)', () => {
  it('시간대가 뉴욕으로 바뀌어 있음', () => {
    expect(new Date(2027, 2, 14, 12).getTimezoneOffset()).toBe(240);
    expect(new Date(2027, 2, 13, 12).getTimezoneOffset()).toBe(300);
  });

  it('2027-03-14 (시계가 1시간 앞으로): 06:00에 리셋, 그 전 5:59는 어제', () => {
    expect(dayKey(at(2027, 3, 14, 5, 59))).toBe('2027-03-13');
    expect(dayKey(at(2027, 3, 14, 6))).toBe('2027-03-14');
    expect(dayKey(at(2027, 3, 14, 6, 30))).toBe('2027-03-14');
    expect(untilReset(at(2027, 3, 14, 5, 59))).toBe(60e3);
    expect(untilReset(at(2027, 3, 14, 6, 30))).toBe(23.5 * H);
    // 전날 6시부터 이날 6시까지 = 23시간 (시계가 1시간 빠짐)
    expect(untilReset(at(2027, 3, 13, 6))).toBe(23 * H);
  });

  it('2026-11-01 (시계가 1시간 뒤로): 05:00이 아니라 06:00에 리셋', () => {
    expect(dayKey(at(2026, 11, 1, 5))).toBe('2026-10-31');
    expect(dayKey(at(2026, 11, 1, 5, 59))).toBe('2026-10-31');
    expect(dayKey(at(2026, 11, 1, 6))).toBe('2026-11-01');
    expect(untilReset(at(2026, 11, 1, 5))).toBe(H);
    expect(untilReset(at(2026, 10, 31, 6))).toBe(25 * H);
  });

  it('주간 키 · 주간 리셋도 같은 벽시계 (월요일 6시)', () => {
    expect(weekKey(at(2027, 3, 14, 6, 30))).toBe('2027-03-08');
    expect(weekKey(at(2027, 3, 15, 5, 59))).toBe('2027-03-08');
    expect(weekKey(at(2027, 3, 15, 6))).toBe('2027-03-15');
    expect(untilWeekReset(at(2027, 3, 15, 5, 59))).toBe(60e3);
    expect(weekKey(at(2026, 11, 2, 5, 59))).toBe('2026-10-26');
    expect(weekKey(at(2026, 11, 2, 6))).toBe('2026-11-02');
  });
});
