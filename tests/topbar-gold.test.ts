/** 위 정보창 골드 (2026-10-22 Lim 「헤드 메뉴에 골드 표시를 넣어보자」): 좁은 칸의 줄인 수 */
import { describe, expect, it } from 'vitest';
import { shortAmount } from '../src/screens/art';

describe('위 정보창 골드 줄인 수', () => {
  it('1만 밑은 쉼표 그대로', () => {
    expect(shortAmount(0)).toBe('0');
    expect(shortAmount(980)).toBe('980');
    expect(shortAmount(9999)).toBe('9,999');
  });
  it('1만부터 만 · 억 단위, 세 자리까지', () => {
    expect(shortAmount(10000)).toBe('1만');
    expect(shortAmount(12345)).toBe('1.23만');
    expect(shortAmount(123456)).toBe('12.3만');
    expect(shortAmount(1234567)).toBe('123만');
    expect(shortAmount(123456789)).toBe('1.23억');
  });
  it('반올림하지 않고 버려 가진 것보다 크게 보이지 않음', () => {
    expect(shortAmount(19999)).toBe('1.99만');
    expect(shortAmount(99999999)).toBe('9990만');
  });
  it('개발 빌드 골드 무제한은 ∞', () => {
    expect(shortAmount(Infinity)).toBe('∞');
  });
});
