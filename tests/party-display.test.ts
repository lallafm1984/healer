import { describe, expect, it } from 'vitest';
import { cellTypography, debuffDisplay, fitPartyName, healthDisplay, primaryDebuff } from '../src/battle/party-display';
import type { Debuff } from '../src/engine/types';

const debuff = (extra: Partial<Debuff> = {}): Debuff => ({ id: 1, name: '부패', type: '질병', left: 4.1, ...extra });

describe('작은 전투 칸 표시', () => {
  it('작은 20인 칸도 HP 12px 아래로 줄이지 않고, 이름은 칸 크기를 따라 9px까지 줄인다', () => {
    for (const scale of [20.75, 27, 30, 35.9]) {
      const fonts = cellTypography(scale);
      expect(fonts.compact).toBe(true);
      expect(fonts.hp).toBeGreaterThanOrEqual(12);
      expect(fonts.hp).toBeLessThanOrEqual(14);
      expect(fonts.nick).toBeGreaterThanOrEqual(9);
      expect(fonts.nick).toBeLessThan(11);
    }
    expect(cellTypography(36).compact).toBe(false);
  });
  it('이름 글자는 칸이 작을수록 작고, 큰 칸은 예전 크기 (0.24배, 11px 이상)', () => {
    const scales = [20, 29, 32.3, 34.5, 36.4, 38.4, 43.1, 51.8, 59.3, 77.7];
    const nicks = scales.map(scale => cellTypography(scale).nick);
    nicks.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(nicks[i]));
    expect(cellTypography(29).nick).toBeCloseTo(9, 5);
    expect(cellTypography(51.8).nick).toBeCloseTo(51.8 * 0.24, 5);
    expect(cellTypography(43.1).nick).toBe(11);
  });
  it('칸 확대 중 절대 HP 표시 경계에서도 글자가 작아지지 않는다', () => {
    expect(cellTypography(36).hp).toBeGreaterThanOrEqual(cellTypography(35.9).hp);
    expect(cellTypography(40).hp).toBeGreaterThanOrEqual(cellTypography(36).hp);
  });
  it('살아 있는 극소 HP와 아직 덜 찬 HP를 0%/100%로 표시하지 않는다', () => {
    expect(healthDisplay(0.01, 1000)).toEqual({ ratio: 0.00001, percent: 1, critical: true });
    expect(healthDisplay(999.9, 1000).percent).toBe(99);
    expect(healthDisplay(1000, 1000).percent).toBe(100);
    expect(healthDisplay(0, 1000)).toEqual({ ratio: 0, percent: 0, critical: false });
    expect(healthDisplay(100, 0).ratio).toBe(0);
    expect(healthDisplay(300, 1000).critical).toBe(false);
    expect(healthDisplay(299, 1000).critical).toBe(true);
  });
  it('닉네임을 축소하지 않고 유니코드 문자를 보존해 말줄임한다', () => {
    const measure = (text: string) => Array.from(text).length * 11;
    expect(fitPartyName('민아', 33, measure)).toBe('민아');
    expect(fitPartyName('별빛치유사', 33, measure)).toBe('별빛…');
    expect(fitPartyName('🌿치유사', 22, measure)).toBe('🌿…');
    expect(fitPartyName('별빛', 11, measure)).toBe('…');
  });
});

describe('디버프 요약', () => {
  it('종류와 올림한 잔여 초를 함께 표시한다', () => {
    expect(debuffDisplay(debuff(), 'priest', true).text).toBe('질5');
    expect(debuffDisplay(debuff({ left: -0.1 }), 'priest').seconds).toBe(0);
  });
  it('직업별 해제 불가와 해제하면 터지는 함정을 서로 다르게 표시한다', () => {
    const poison = debuff({ type: '독' });
    expect(debuffDisplay(poison, 'priest', true)).toMatchObject({ text: '×독5', state: 'unavailable' });
    expect(debuffDisplay(poison, 'druid', true)).toMatchObject({ text: '독5', state: 'available' });
    expect(debuffDisplay(debuff({ trap: true }), 'priest', true)).toMatchObject({ text: '!질5', state: 'dangerous' });
    expect(debuffDisplay(debuff({ trap: true }), 'priest').detail).toContain('해제 시 전염 폭발');
  });
  it('중첩과 원래 이름은 상세 요약에 보존한다', () => {
    expect(debuffDisplay(debuff({ name: '썩은 숨결', stack: 3 }), 'priest').detail).toBe('썩은 숨결 · 질병 · 5초, 3중첩 · 해제 가능');
  });
  it('표시할 대표 디버프를 고르면서 입력 순서나 내용을 바꾸지 않는다', () => {
    const poison = debuff({ id: 2, type: '독' }), disease = debuff(), trap = debuff({ id: 3, trap: true });
    const all = [poison, disease, trap];
    expect(primaryDebuff(all)).toBe(trap);
    expect(primaryDebuff([poison, disease])).toBe(disease);
    expect(primaryDebuff([])).toBeUndefined();
    expect(all).toEqual([poison, disease, trap]);
  });
});
