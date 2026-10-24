/** 일반 · 정예 구간 초상 교대 (2026-10-25 Lim C안): 모든 구간 적 이름에 초상 · 얼굴 그림이 있음 */
import { describe, expect, it } from 'vitest';
import { mobArt } from '../src/battle/art';
import { ENCOUNTERS } from '../src/data/encounters';

describe('구간 적 그림', () => {
  it('일반 · 정예 구간의 모든 적 이름이 그림을 가짐', () => {
    const names = new Set(Object.values(ENCOUNTERS).flatMap(e => (e.mobs ?? []).map(m => m.name)));
    const missing = [...names].filter(n => !mobArt(n));
    expect(missing).toEqual([]);
    expect(names.size).toBeGreaterThan(50);
  });
});
