import { describe, expect, it } from 'vitest';
import { sfxTiming } from '../src/sfx/timing';

describe('effect playback duration', () => {
  it('keeps a short effect and its requested pitch unchanged', () => {
    expect(sfxTiming(.85, 1)).toEqual({ rate: 1, seconds: .85, fadeAt: null });
    expect(sfxTiming(1.25, .89).seconds).toBeCloseTo(1.404494);
    expect(sfxTiming(1.25, .89).fadeAt).toBeNull();
  });
  it('fades out and ends a slowed or accidentally long effect by 1.5 seconds', () => {
    for (const [duration, rate] of [[1.45, .89], [2, 1], [1, .5]]) {
      expect(sfxTiming(duration, rate)).toEqual({ rate, seconds: 1.5, fadeAt: 1.46 });
    }
  });
  it('does not let invalid rates create an unbounded source', () => {
    for (const rate of [0, -1, NaN, Infinity]) expect(sfxTiming(2, rate)).toEqual({ rate: 1, seconds: 1.5, fadeAt: 1.46 });
  });
});
