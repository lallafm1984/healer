import { describe, expect, it } from 'vitest';
import { cellTypography, debuffDisplay, fitPartyName, healthDisplay, hotTimersOf, primaryDebuff } from '../src/battle/party-display';
import type { Debuff, Hot } from '../src/engine/types';

const debuff = (extra: Partial<Debuff> = {}): Debuff => ({ id: 1, name: '부패', type: '질병', left: 4.1, ...extra });
const hot = (key: Hot['key'], left: number): Hot => ({ key, left, name: key, every: 2, tick: 2, per: 10, i: 0, rest: 30 });

describe('모든 직업의 지속 치유 시간', () => {
  it('사제 소생·드루이드 지속 치유·성기사 서약을 각각 표시한다', () => {
    const timers = hotTimersOf({ hot: 6, hots: [hot('oath', 9), hot('wildflower', 4), hot('growth', 7), hot('sprout', 12)] });
    expect(timers.map(h => [h.key, h.left])).toEqual([
      ['renew', 6], ['sprout', 12], ['growth', 7], ['wildflower', 4], ['oath', 9],
    ]);
  });
  it('효과 갱신으로 입력 순서와 남은 시간이 바뀌어도 표시 순서를 유지한다', () => {
    const hots = [hot('wildflower', 20), hot('sprout', 3), hot('growth', 10)];
    const before = hots.slice();
    const keys = (hs: Hot[]) => hotTimersOf({ hot: 0, hots: hs }).map(h => h.key);
    expect(keys(hots)).toEqual(keys([hot('growth', 1), hot('sprout', 14), hot('wildflower', 2)]));
    expect(hots).toEqual(before);
  });
  it('만료된 효과만 제거하고 남아 있는 효과의 시간을 보존한다', () => {
    expect(hotTimersOf({ hot: 0, hots: [hot('sprout', 0), hot('growth', -1), hot('oath', 0.2)] })
      .map(h => [h.key, h.left])).toEqual([['oath', 0.2]]);
    expect(hotTimersOf({ hot: -1, hots: [] })).toEqual([]);
  });
});

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
  it('해제 불가·함정도 배지에 기호 없이 표시하고 상세 안내는 유지한다', () => {
    const poison = debuff({ type: '독' });
    expect(debuffDisplay(poison, 'priest', true)).toMatchObject({ text: '독5', state: 'unavailable' });
    expect(debuffDisplay(poison, 'druid', true)).toMatchObject({ text: '독5', state: 'available' });
    expect(debuffDisplay(debuff({ trap: true }), 'priest', true)).toMatchObject({ text: '질5', state: 'dangerous' });
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
