import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ show: vi.fn(), prepare: vi.fn(), busy: false }));
vi.mock('../src/platform/native-ads', () => ({ NATIVE_ADS: true, nativeAdBusy: () => h.busy, showNativeAd: h.show, prepareNativeAd: h.prepare }));
vi.mock('../src/platform/server', () => ({ lastBoot: () => null }));
vi.mock('../src/i18n', () => ({ t: (text: string) => text }));
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }); h.busy = false; h.show.mockReset(); h.prepare.mockReset();
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), createElement: vi.fn(() => { throw new Error('unexpected modal'); }) });
  vi.stubGlobal('window', {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('보상 없이 닫은 광고도 10분 시계를 새로 시작해 곧바로 전면 광고가 이어지지 않음', async () => {
  const ads = await import('../src/platform/ads'); await vi.advanceTimersByTimeAsync(600001);
  expect(ads.adClockMs()).toBe(600001);
  h.show.mockResolvedValue({ status: 'closed', shown: true, rewarded: false });
  expect(await ads.showRewarded('test')).toBe(false); expect(ads.adClockMs()).toBe(0);
});
it('화면 변경·중복 클릭 취소에는 보상·광고 시계 변경·불필요한 오류 창 없음', async () => {
  const ads = await import('../src/platform/ads'); await vi.advanceTimersByTimeAsync(1000);
  expect(await ads.showRewarded('test', () => false)).toBe(false); expect(h.show).not.toHaveBeenCalled();
  h.show.mockResolvedValue({ status: 'cancelled', shown: false, rewarded: false });
  expect(await ads.showRewarded('test')).toBe(false); expect(ads.adClockMs()).toBe(1000);
  h.busy = true; expect(await ads.showRewarded('test')).toBe(false); expect(h.show).toHaveBeenCalledOnce();
});
it('같은 보상 버튼을 연타해도 보상형 흐름은 한 개', async () => {
  let finish!: (v: unknown) => void; h.show.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const ads = await import('../src/platform/ads'); const first = ads.showRewarded('test');
  expect(await ads.showRewarded('test')).toBe(false); expect(h.show).toHaveBeenCalledOnce();
  finish({ status: 'closed', shown: true, rewarded: true }); expect(await first).toBe(true);
});
it('전면 광고 준비는 표시와 분리하고 실제로 보였을 때만 시계 초기화', async () => {
  const ads = await import('../src/platform/ads'); await vi.advanceTimersByTimeAsync(1000);
  ads.prepareInterstitial(); expect(h.prepare).toHaveBeenCalledWith('interstitial');
  h.show.mockResolvedValueOnce({ status: 'not-ready', shown: false }).mockResolvedValueOnce({ status: 'closed', shown: true });
  expect(await ads.showInterstitial()).toBe(false); expect(ads.adClockMs()).toBe(1000);
  expect(await ads.showInterstitial()).toBe(true); expect(ads.adClockMs()).toBe(0);
});
