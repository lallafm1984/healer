import { describe, expect, it } from 'vitest';
import { remainingTime, untilWeekReset, weekKey, weekRemaining } from '../src/game/clock';

const H = 3600e3;
const at = (day: number, hour: number, min = 0, sec = 0) => new Date(2026, 9, day, hour, min, sec).getTime();

describe('화면 공통 남은 시간', () => {
  it('24시간 경계를 양쪽 화면에서 같은 단위·내림 규칙으로 표현한다', () => {
    expect(remainingTime(24 * H)).toBe('1일');
    expect(remainingTime(24 * H - 1)).toBe('23시간');
    expect(remainingTime(H)).toBe('1시간');
    expect(remainingTime(H - 1)).toBe('59분');
    expect(remainingTime(60e3)).toBe('1분');
    expect(remainingTime(59e3)).toBe('1분 미만');
    expect(remainingTime(0)).toBe('마감');
    expect(remainingTime(-1)).toBe('마감');
  });

  it('주간 리셋 직전에는 1분 미만, 월요일 6시부터 새 주 7일이다', () => {
    expect(weekKey(at(12, 5, 59, 59))).toBe('2026-10-05');
    expect(untilWeekReset(at(12, 5, 59, 59))).toBe(1000);
    expect(weekRemaining(at(12, 5, 59, 59))).toBe('1분 미만');
    expect(weekKey(at(12, 6))).toBe('2026-10-12');
    expect(weekRemaining(at(12, 6))).toBe('7일');
    expect(weekRemaining(at(12, 6, 0, 1))).toBe('6일');
  });

  it('일요일 오전 6시의 24시간 경계와 검수일의 남은 날짜를 일관되게 계산한다', () => {
    expect(weekRemaining(at(11, 6))).toBe('1일');
    expect(weekRemaining(at(11, 6, 0, 1))).toBe('23시간');
    expect(weekRemaining(at(9, 12))).toBe('2일');
  });
});
