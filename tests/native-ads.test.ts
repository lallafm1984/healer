import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';

const h = vi.hoisted(() => ({
  handlers: new Map<string, () => void>(),
  platform: 'android',
  sdk: {
    requestConsentInfo: vi.fn(), showConsentForm: vi.fn(), initialize: vi.fn(),
    showBanner: vi.fn(), removeBanner: vi.fn(), addListener: vi.fn(),
    prepareRewardVideoAd: vi.fn(), showRewardVideoAd: vi.fn(),
    prepareInterstitial: vi.fn(), showInterstitial: vi.fn(), showPrivacyOptionsForm: vi.fn(),
  },
}));
vi.mock('@capacitor/core', async original => ({ ...await original<object>(), Capacitor: { getPlatform: () => h.platform } }));
vi.mock('@capacitor-community/admob', async original => ({ ...await original<object>(), AdMob: h.sdk }));

const consent = { canRequestAds: true, status: 'NOT_REQUIRED', privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
const emit = (event: string) => h.handlers.get(event)?.();

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  h.handlers.clear();
  h.platform = 'android';
  Object.values(h.sdk).forEach(fn => fn.mockReset().mockResolvedValue(undefined));
  h.sdk.requestConsentInfo.mockResolvedValue(consent);
  h.sdk.addListener.mockImplementation(async (event: string, fn: () => void) => {
    h.handlers.set(event, fn);
    return { remove: vi.fn(async () => { h.handlers.delete(event); }) };
  });
  vi.stubGlobal('document', { documentElement: { classList: { add: vi.fn() } }, addEventListener: vi.fn(), hidden: false });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Android AdMob', () => {
  it('동의가 필요하면 동의 창 → SDK → 지정한 배너 순서', async () => {
    h.sdk.requestConsentInfo.mockResolvedValue({ ...consent, canRequestAds: false, status: 'REQUIRED', isConsentFormAvailable: true });
    h.sdk.showConsentForm.mockResolvedValue(consent);
    const ads = await import('../src/platform/native-ads');
    await ads.mountNativeAds(false);
    expect(h.sdk.showConsentForm).toHaveBeenCalledOnce();
    expect(h.sdk.showConsentForm.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.initialize.mock.invocationCallOrder[0]);
    expect(h.sdk.initialize.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.showBanner.mock.invocationCallOrder[0]);
    expect(h.sdk.showBanner).toHaveBeenCalledWith(expect.objectContaining({ adId: ads.AD_UNITS.banner, adSize: 'BANNER', position: 'TOP_CENTER', isTesting: true }));
  });

  it('광고 요청 불가·오프라인이면 SDK·광고를 시작하지 않고 다음 요청에서 재시도', async () => {
    h.sdk.requestConsentInfo.mockResolvedValueOnce({ ...consent, canRequestAds: false }).mockRejectedValueOnce(new Error('offline'));
    const ads = await import('../src/platform/native-ads');
    expect(await ads.showNativeAd('rewarded')).toBe(false);
    expect(await ads.showNativeAd('interstitial')).toBe(false);
    expect(h.sdk.initialize).not.toHaveBeenCalled();
    expect(h.sdk.prepareRewardVideoAd).not.toHaveBeenCalled();
    await ads.mountNativeAds(false);
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
  });

  it('보상형은 완료 신호 뒤 닫혀야 성공하며 중복 요청은 광고를 더 띄우지 않음', async () => {
    const ads = await import('../src/platform/native-ads');
    const result = ads.showNativeAd('rewarded');
    await vi.waitFor(() => expect(h.sdk.showRewardVideoAd).toHaveBeenCalledOnce());
    expect(await ads.showNativeAd('rewarded')).toBe(false);
    let finished = false;
    void result.then(() => { finished = true; });
    emit(RewardAdPluginEvents.Rewarded);
    await Promise.resolve();
    expect(finished).toBe(false);
    emit(RewardAdPluginEvents.Dismissed);
    expect(await result).toBe(true);
    expect(h.handlers.size).toBe(0);
    expect(h.sdk.prepareRewardVideoAd).toHaveBeenCalledWith(expect.objectContaining({ adId: ads.AD_UNITS.rewarded, immersiveMode: true }));
  });

  it.each(['dismiss', 'fail', 'reject', 'load'] as const)('보상형 조기 닫기·표시 실패·로드 실패(%s)는 보상 없음 · 리스너 정리', async mode => {
    if (mode === 'reject') h.sdk.showRewardVideoAd.mockRejectedValue(new Error('show failed'));
    if (mode === 'load') h.sdk.prepareRewardVideoAd.mockRejectedValue(new Error('no fill'));
    const ads = await import('../src/platform/native-ads');
    const result = ads.showNativeAd('rewarded');
    if (mode === 'dismiss' || mode === 'fail') {
      await vi.waitFor(() => expect(h.sdk.showRewardVideoAd).toHaveBeenCalledOnce());
      emit(mode === 'dismiss' ? RewardAdPluginEvents.Dismissed : RewardAdPluginEvents.FailedToShow);
    }
    expect(await result).toBe(false);
    expect(h.handlers.size).toBe(0);
  });

  it('전면 광고는 닫히기 전까지 대기, 표시 실패 시 false', async () => {
    const ads = await import('../src/platform/native-ads');
    const result = ads.showNativeAd('interstitial');
    await vi.waitFor(() => expect(h.sdk.showInterstitial).toHaveBeenCalledOnce());
    emit(InterstitialAdPluginEvents.Dismissed);
    expect(await result).toBe(true);
    expect(h.sdk.prepareInterstitial).toHaveBeenCalledWith(expect.objectContaining({ adId: ads.AD_UNITS.interstitial }));
    const failed = ads.showNativeAd('interstitial');
    await vi.waitFor(() => expect(h.sdk.showInterstitial).toHaveBeenCalledTimes(2));
    emit(InterstitialAdPluginEvents.FailedToShow);
    expect(await failed).toBe(false);
    expect(h.handlers.size).toBe(0);
  });

  it('로드 시간 초과도 잠금을 풀고 다음에 재시도', async () => {
    vi.useFakeTimers();
    h.sdk.prepareInterstitial.mockImplementationOnce(() => new Promise(() => {}));
    const ads = await import('../src/platform/native-ads');
    const result = ads.showNativeAd('interstitial');
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toBe(false);
    expect(h.sdk.showInterstitial).not.toHaveBeenCalled();
    expect(h.handlers.size).toBe(0);
    const retry = ads.showNativeAd('rewarded');
    await vi.advanceTimersByTimeAsync(0);
    emit(RewardAdPluginEvents.Dismissed);
    expect(await retry).toBe(false);
  });

  it('광고 제거 구매 후에도 배너 유지 · 전면만 제외 · 보상형은 시청 필요', async () => {
    const ads = await import('../src/platform/native-ads');
    await ads.mountNativeAds(true);
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    await ads.syncNativeBanner(false);
    await ads.syncNativeBanner(true);
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    expect(h.sdk.removeBanner).not.toHaveBeenCalled();
    expect(await ads.showNativeAd('interstitial')).toBe(false);
    expect(h.sdk.prepareInterstitial).not.toHaveBeenCalled();
    const reward = ads.showNativeAd('rewarded');
    await vi.waitFor(() => expect(h.sdk.showRewardVideoAd).toHaveBeenCalledOnce());
    emit(RewardAdPluginEvents.Dismissed);
    expect(await reward).toBe(false);
  });

  it('화면·메뉴 이동과 저장 동기화 100회에도 배너 생성·요청은 한 번', async () => {
    const ads = await import('../src/platform/native-ads');
    await ads.mountNativeAds(false);
    await Promise.all(Array.from({ length: 100 }, (_, i) => ads.syncNativeBanner(i % 2 === 0)));
    await ads.mountNativeAds(false);
    expect(h.sdk.requestConsentInfo).toHaveBeenCalledOnce();
    expect(h.sdk.initialize).toHaveBeenCalledOnce();
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    expect(h.sdk.removeBanner).not.toHaveBeenCalled();
  });

  it('개인정보 선택이 필요한 사용자에게 동의 변경 진입점 제공', async () => {
    h.sdk.requestConsentInfo.mockResolvedValue({ ...consent, privacyOptionsRequirementStatus: 'REQUIRED' });
    const ads = await import('../src/platform/native-ads');
    const changed = vi.fn(); ads.onAdPrivacyChange(changed);
    await ads.mountNativeAds(false);
    expect(ads.adPrivacyRequired()).toBe(true);
    expect(changed).toHaveBeenCalled();
    expect(await ads.showAdPrivacyOptions()).toBe(true);
    expect(h.sdk.showPrivacyOptionsForm).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(h.sdk.showBanner).toHaveBeenCalledTimes(2));
  });

  it('웹·iOS는 Android SDK와 광고 ID를 요청하지 않음', async () => {
    h.platform = 'web';
    const ads = await import('../src/platform/native-ads');
    await ads.mountNativeAds(false);
    expect(await ads.showNativeAd('rewarded')).toBe(false);
    expect(h.sdk.initialize).not.toHaveBeenCalled();
  });
});
