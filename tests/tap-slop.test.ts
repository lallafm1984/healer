import { describe, expect, it } from 'vitest';
import { keepTap, TAP_SLOP } from '../src/screens/tap-slop';

// 2026-10-21 Lim: 손가락이 조금 움직인 탭도 누름, 스크롤하려고 끈 것은 누름이 아님
describe('조금 움직인 탭', () => {
  const tap = { moved: 0, scroll: 0, inside: true, ms: 120 };

  it('목록이 안 움직였으면 24px까지 누름', () => {
    expect(keepTap({ ...tap, moved: 12 })).toBe(true);
    expect(keepTap({ ...tap, moved: TAP_SLOP.still })).toBe(true);
    expect(keepTap({ ...tap, moved: TAP_SLOP.still + 1 })).toBe(false);
  });

  it('목록이 움직였으면 16px까지만 누름', () => {
    expect(keepTap({ ...tap, moved: 14, scroll: 6 })).toBe(true);
    expect(keepTap({ ...tap, moved: TAP_SLOP.scrolled + 1, scroll: 9 })).toBe(false);
    expect(keepTap({ ...tap, moved: 10, scroll: TAP_SLOP.scrolled + 1 })).toBe(false);
  });

  it('버튼 밖에서 뗐거나 길게 누르면 누름이 아님', () => {
    expect(keepTap({ ...tap, moved: 10, inside: false })).toBe(false);
    expect(keepTap({ ...tap, moved: 10, ms: 900 })).toBe(false);
  });
});
