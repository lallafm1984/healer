import { describe, expect, it } from 'vitest';
import { manaMeter } from '../src/battle/mana-meter';

describe('마나 숫자와 원형 값 게이지', () => {
  it.each([0, 25, 50, 75, 100])('%i%%에서 같은 숫자·호 길이를 표시한다', percent => {
    expect(manaMeter(percent)).toEqual({ percent, fill: `${percent}%`, low: percent < 20 });
  });
  it('최대값이 달라져도 현재/최대로 표시한다 (게임의 최대값은 현재 100)', () => {
    expect(manaMeter(50, 200).percent).toBe(25);
    expect(manaMeter(50, 100).percent).toBe(50);
    expect(manaMeter(50, 50).percent).toBe(100);
    expect(manaMeter(210, 280).percent).toBe(75);
  });
  it('소비·회복 중 숫자와 호가 같은 1% 단위를 사용한다', () => {
    expect([100, 97, 97.3, 97.9, 98, 100].map(value => manaMeter(value).fill))
      .toEqual(['100%', '97%', '97%', '97%', '98%', '100%']);
    expect(manaMeter(19.9).low).toBe(true);
    expect(manaMeter(20).low).toBe(false);
  });
  it('음수·초과·유효하지 않은 값이 역방향 호나 잔량으로 보이지 않는다', () => {
    expect(manaMeter(-1).fill).toBe('0%');
    expect(manaMeter(110).fill).toBe('100%');
    for (const [current, maximum] of [[NaN, 100], [Infinity, 100], [50, 0], [50, -1], [50, Infinity]]) {
      expect(manaMeter(current, maximum).fill).toBe('0%');
    }
  });
});
