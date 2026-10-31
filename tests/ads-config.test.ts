import { describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ flags: {} as Record<string, unknown> }));
vi.mock('../src/platform/server', () => ({ lastBoot: () => ({ config: { flags: h.flags } }) }));
import { interstitialConfig, interstitialDue } from '../src/platform/ads';

describe('전면 광고 원격 설정', () => {
  it('설정 없음 · 오류 값은 10분 · Lv 10', () => {
    expect(interstitialConfig({})).toEqual({ everyMs: 600000, minLv: 10 });
    for (const value of [null, '20', false, 0, -1, NaN, Infinity, 1441]) {
      expect(interstitialConfig({ interstitial_interval_minutes: value }).everyMs).toBe(600000);
    }
    for (const value of [null, '20', false, 0, -1, 10.5, 101, NaN]) {
      expect(interstitialConfig({ interstitial_min_level: value }).minLv).toBe(10);
    }
  });
  it('서버 변경을 다음 판정에 적용하되 실패·튜토리얼·광고 제거 예외 유지', () => {
    const run = { won: true, level: 10, tutDone: true, adsFree: false, ms: 600000 };
    h.flags = {};
    expect(interstitialDue(run)).toBe(true);
    h.flags = { interstitial_interval_minutes: 15, interstitial_min_level: 20 };
    expect(interstitialDue({ ...run, ms: 900000 })).toBe(false);
    expect(interstitialDue({ ...run, level: 20, ms: 899999 })).toBe(false);
    expect(interstitialDue({ ...run, level: 20, ms: 900000 })).toBe(true);
    const ready = { ...run, level: 20, ms: 900000 };
    expect(interstitialDue({ ...ready, won: false })).toBe(false);
    expect(interstitialDue({ ...ready, tutDone: false })).toBe(false);
    expect(interstitialDue({ ...ready, adsFree: true })).toBe(false);
    h.flags = { interstitial_interval_minutes: 0.5, interstitial_min_level: 1 };
    expect(interstitialDue({ ...run, level: 1, ms: 30000 })).toBe(true);
    h.flags = {};
  });
});
