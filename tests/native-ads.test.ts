import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerAdPluginEvents as Banner, InterstitialAdPluginEvents as Inter, RewardAdPluginEvents as Reward } from '@capacitor-community/admob';
const h = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(), docEvents: new Map<string, () => void>(), appState: null as null | ((s: { isActive: boolean }) => void),
  platform: 'android', runtime: vi.fn(), appListener: vi.fn(),
  sdk: Object.fromEntries(['requestConsentInfo', 'showConsentForm', 'initialize', 'showBanner', 'removeBanner', 'hideBanner', 'resumeBanner', 'addListener', 'prepareRewardVideoAd', 'showRewardVideoAd', 'prepareInterstitial', 'showInterstitial', 'showPrivacyOptionsForm'].map(k => [k, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock('@capacitor/core', async original => ({ ...await original<object>(), Capacitor: { getPlatform: () => h.platform } }));
vi.mock('@capacitor-community/admob', async original => ({ ...await original<object>(), AdMob: h.sdk }));
vi.mock('@capacitor/app', () => ({ App: { addListener: h.appListener } }));
vi.mock('../src/platform/ad-runtime', () => ({ AdRuntime: { getInfo: h.runtime } }));
vi.mock('../src/platform/startup', () => ({ serverReady: () => true }));
const consent = { canRequestAds: true, status: 'NOT_REQUIRED', privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
const emit = (event: string) => h.handlers.get(event)?.();
const flush = () => vi.advanceTimersByTimeAsync(0);
const deferred = <T>() => { let resolve!: (v: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let doc: { visibilityState: string; documentElement: { classList: { add: ReturnType<typeof vi.fn> } }; addEventListener: ReturnType<typeof vi.fn> };
function visible(on: boolean): void { doc.visibilityState = on ? 'visible' : 'hidden'; h.docEvents.get('visibilitychange')?.(); }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_ADMOB_TESTING', 'false');
  h.handlers.clear(); h.docEvents.clear(); h.platform = 'android'; h.appState = null;
  Object.values(h.sdk).forEach(fn => fn.mockReset().mockResolvedValue(undefined));
  h.runtime.mockReset().mockResolvedValue({ debuggable: false, canRequestAds: false, privacyOptionsRequired: false });
  h.sdk.requestConsentInfo.mockResolvedValue(consent);
  h.sdk.prepareRewardVideoAd.mockImplementation(async (o: any) => ({ adUnitId: o.adId }));
  h.sdk.prepareInterstitial.mockImplementation(async (o: any) => ({ adUnitId: o.adId }));
  h.sdk.addListener.mockImplementation(async (event: string, fn: () => void) => { h.handlers.set(event, fn); return { remove: vi.fn(async () => { h.handlers.delete(event); }) }; });
  h.appListener.mockReset().mockImplementation(async (_e, fn) => { h.appState = fn; return { remove: vi.fn() }; });
  doc = { visibilityState: 'visible', documentElement: { classList: { add: vi.fn() } }, addEventListener: vi.fn((name, fn) => h.docEvents.set(name, fn)) };
  vi.stubGlobal('document', doc); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('빌드와 동의', () => {
  it.each(['vite', 'env', 'native'] as const)('개발판(%s)은 환경 변수를 빠뜨려도 데모 광고만 사용', async mode => {
    if (mode === 'vite') vi.stubEnv('DEV', true);
    if (mode === 'env') vi.stubEnv('VITE_ADMOB_TESTING', 'true');
    if (mode === 'native') h.runtime.mockResolvedValue({ debuggable: true });
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false);
    expect(h.sdk.requestConsentInfo).not.toHaveBeenCalled();
    expect(h.sdk.initialize).toHaveBeenCalledWith({ initializeForTesting: true });
    expect(h.sdk.showBanner).toHaveBeenCalledWith(expect.objectContaining({ isTesting: true }));
  });
  it('출시 광고는 동의 창 → SDK → 배너 순서', async () => {
    h.sdk.requestConsentInfo.mockResolvedValue({ ...consent, canRequestAds: false, status: 'REQUIRED', isConsentFormAvailable: true });
    h.sdk.showConsentForm.mockResolvedValue(consent);
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false);
    expect(h.sdk.showConsentForm.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.initialize.mock.invocationCallOrder[0]);
    expect(h.sdk.initialize.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.showBanner.mock.invocationCallOrder[0]);
    expect(h.sdk.showBanner).toHaveBeenCalledWith(expect.objectContaining({ isTesting: false }));
  });
  it('UMP 미등록·통신 실패에 저장 100회도 추가 요청 없음, 재시도는 30→60초', async () => {
    h.sdk.requestConsentInfo.mockRejectedValue(new Error('no forms'));
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false);
    for (let i = 0; i < 100; i++) { await ads.syncNativeBanner(false); await ads.prepareNativeAd('rewarded'); }
    expect(h.sdk.requestConsentInfo).toHaveBeenCalledOnce(); expect(h.sdk.initialize).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(29999); expect(h.sdk.requestConsentInfo).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1); expect(h.sdk.requestConsentInfo).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(59999); expect(h.sdk.requestConsentInfo).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); expect(h.sdk.requestConsentInfo).toHaveBeenCalledTimes(3);
  });
  it('갱신 실패에도 네이티브가 확인한 이전 유효 동의만 사용', async () => {
    h.sdk.requestConsentInfo.mockRejectedValue(new Error('offline'));
    h.runtime.mockResolvedValue({ debuggable: false, canRequestAds: true, privacyOptionsRequired: true });
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false);
    expect(h.sdk.showBanner).toHaveBeenCalledOnce(); expect(ads.adPrivacyRequired()).toBe(true);
  });
  it('동의 요청 불가는 반복 팝업이나 재요청 없이 막고 시험 광고로 전환하지 않음', async () => {
    h.sdk.requestConsentInfo.mockResolvedValue({ ...consent, canRequestAds: false });
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false);
    await vi.advanceTimersByTimeAsync(3600000);
    await ads.prepareNativeAd('rewarded');
    expect(h.sdk.requestConsentInfo).toHaveBeenCalledOnce(); expect(h.sdk.showBanner).not.toHaveBeenCalled();
  });
});

describe('배너 수명과 요청 제한', () => {
  it('화면·저장·구매 동기화 100회와 SDK 자체 새로고침에도 앱 요청은 한 번', async () => {
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false); emit(Banner.Loaded);
    await Promise.all(Array.from({ length: 100 }, (_, i) => ads.syncNativeBanner(i % 2 === 0)));
    emit(Banner.Loaded); emit(Banner.AdImpression); await ads.mountNativeAds(false);
    expect(h.sdk.showBanner).toHaveBeenCalledOnce(); expect(h.sdk.removeBanner).not.toHaveBeenCalled();
    expect(ads.adDiagnostics()).toMatchObject({ bannerRequests: 1, bannerLoaded: 2, bannerImpressions: 1 });
  });
  it('SDK가 실패한 뷰를 제거하면 30초 뒤에만 새로 요청', async () => {
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false); emit(Banner.FailedToLoad);
    for (let i = 0; i < 100; i++) await ads.syncNativeBanner(false);
    await vi.advanceTimersByTimeAsync(29999); expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1); expect(h.sdk.showBanner).toHaveBeenCalledTimes(2);
    emit(Banner.Loaded); expect(ads.adDiagnostics().banner).toBe('ready');
  });
  it('백그라운드에서는 실패 재시도 없음, 복귀 때도 중복 이벤트가 한 요청으로 합쳐짐', async () => {
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false); emit(Banner.FailedToLoad);
    visible(false); h.appState?.({ isActive: false }); await vi.advanceTimersByTimeAsync(3600000);
    expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    visible(true); await flush(); expect(h.sdk.showBanner).toHaveBeenCalledOnce();
    h.appState?.({ isActive: true }); h.docEvents.get('visibilitychange')?.(); await flush();
    expect(h.sdk.showBanner).toHaveBeenCalledTimes(2);
  });
  it('백그라운드와 복귀는 같은 배너를 숨김·재개하며 새 광고 요청을 만들지 않음', async () => {
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false); emit(Banner.Loaded);
    visible(false); h.appState?.({ isActive: false }); await flush();
    expect(h.sdk.hideBanner).toHaveBeenCalledOnce();
    visible(true); h.appState?.({ isActive: true }); await flush();
    expect(h.sdk.resumeBanner).toHaveBeenCalledOnce(); expect(h.sdk.showBanner).toHaveBeenCalledOnce();
  });
});

describe('전면·보상형 로드와 표시', () => {
  it('준비 안 된 전면은 화면을 붙잡거나 광고를 새로 요청하지 않음', async () => {
    const ads = await import('../src/platform/native-ads');
    expect((await ads.showNativeAd('interstitial')).status).toBe('not-ready');
    expect(h.sdk.prepareInterstitial).not.toHaveBeenCalled(); expect(h.sdk.initialize).not.toHaveBeenCalled();
  });
  it('전면 준비를 여러 번 불러도 하나만 캐시, 한 번 사용 뒤 재표시 없음', async () => {
    const ads = await import('../src/platform/native-ads');
    await Promise.all(Array.from({ length: 100 }, () => ads.prepareNativeAd('interstitial')));
    expect(h.sdk.prepareInterstitial).toHaveBeenCalledOnce();
    const shown = ads.showNativeAd('interstitial'); await flush(); emit(Inter.Showed); emit(Inter.Dismissed);
    expect(await shown).toEqual({ status: 'closed', shown: true, rewarded: false });
    expect((await ads.showNativeAd('interstitial')).status).toBe('not-ready');
    expect(h.sdk.showInterstitial).toHaveBeenCalledOnce();
  });
  it('55분 지난 캐시는 다시 준비, 같은 캐시는 반복 준비하지 않음', async () => {
    const ads = await import('../src/platform/native-ads'); await ads.prepareNativeAd('interstitial');
    await vi.advanceTimersByTimeAsync(ads.AD_TIMING.cache); expect(ads.nativeAdReady('interstitial')).toBe(false);
    await ads.prepareNativeAd('interstitial'); expect(h.sdk.prepareInterstitial).toHaveBeenCalledTimes(2);
  });
  it('깊은 잠 뒤 performance가 멈췄거나 기기 시계를 되돌렸어도 오래된 캐시를 표시하지 않음', async () => {
    const wall = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const ads = await import('../src/platform/native-ads'); await ads.prepareNativeAd('interstitial');
    wall.mockReturnValue(100000 + ads.AD_TIMING.cache); expect(ads.nativeAdReady('interstitial')).toBe(false);
    await ads.prepareNativeAd('interstitial'); wall.mockReturnValue(1);
    expect(ads.nativeAdReady('interstitial')).toBe(false); expect(h.sdk.showInterstitial).not.toHaveBeenCalled();
  });
  it('보상형은 완료 신호와 닫힘 후 한 번만 보상, 중복 탭은 추가 로드 없음', async () => {
    const ads = await import('../src/platform/native-ads'); const reward = ads.showNativeAd('rewarded'); await flush();
    expect((await ads.showNativeAd('rewarded')).status).toBe('busy');
    emit(Reward.Showed); emit(Reward.Rewarded); emit(Reward.Rewarded);
    let ended = false; void reward.then(() => { ended = true; }); await flush(); expect(ended).toBe(false);
    emit(Reward.Dismissed);
    expect(await reward).toEqual({ status: 'closed', shown: true, rewarded: true });
    expect(h.sdk.prepareRewardVideoAd).toHaveBeenCalledOnce(); expect(ads.adDiagnostics().rewards).toBe(1);
    expect(h.handlers.size).toBe(0);
  });
  it('보상 없이 조기 닫았어도 실제 표시한 광고로 구분', async () => {
    const ads = await import('../src/platform/native-ads'); const reward = ads.showNativeAd('rewarded'); await flush(); emit(Reward.Dismissed);
    expect(await reward).toEqual({ status: 'closed', shown: true, rewarded: false });
  });
  it('화면·계정·혜택 조건이 로드 중 바뀌면 늦게 뜨지 않음', async () => {
    const load = deferred<{ adUnitId: string }>(); h.sdk.prepareRewardVideoAd.mockReturnValue(load.promise);
    const ads = await import('../src/platform/native-ads'); let valid = true;
    const reward = ads.showNativeAd('rewarded', () => valid); await flush(); valid = false;
    load.resolve({ adUnitId: 'late' }); await flush();
    expect((await reward).status).toBe('cancelled'); expect(h.sdk.showRewardVideoAd).not.toHaveBeenCalled();
  });
  it('시간 초과 뒤 늦게 로드돼도 자동 표시 없음, 물리적 중복 요청 없음', async () => {
    const load = deferred<{ adUnitId: string }>(); h.sdk.prepareRewardVideoAd.mockReturnValue(load.promise);
    const ads = await import('../src/platform/native-ads'); const reward = ads.showNativeAd('rewarded'); await flush();
    await vi.advanceTimersByTimeAsync(ads.AD_TIMING.loadWait); expect((await reward).status).toBe('failed');
    for (let i = 0; i < 100; i++) expect(await ads.prepareNativeAd('rewarded')).toBe(false);
    expect(h.sdk.prepareRewardVideoAd).toHaveBeenCalledOnce();
    load.resolve({ adUnitId: 'late' }); await flush(); expect(h.sdk.showRewardVideoAd).not.toHaveBeenCalled();
    expect(ads.nativeAdReady('rewarded')).toBe(true);
  });
  it.each(['load', 'show', 'promise'] as const)('실패(%s)는 보상 없이 잠금·리스너를 해제하고 재시도 간격 적용', async mode => {
    if (mode === 'load') h.sdk.prepareRewardVideoAd.mockRejectedValue(new Error('no fill'));
    if (mode === 'promise') h.sdk.showRewardVideoAd.mockRejectedValue(new Error('show failed'));
    const ads = await import('../src/platform/native-ads'); const reward = ads.showNativeAd('rewarded'); await flush();
    if (mode === 'show') emit(Reward.FailedToShow);
    expect((await reward).rewarded).toBe(false); expect(ads.nativeAdBusy()).toBe(false); expect(h.handlers.size).toBe(0);
    await ads.prepareNativeAd('rewarded'); expect(h.sdk.prepareRewardVideoAd).toHaveBeenCalledOnce();
  });
  it('광고 제거 구매 후 배너·보상형 유지, 전면만 제외', async () => {
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(true); await ads.prepareNativeAd('interstitial');
    expect(h.sdk.showBanner).toHaveBeenCalledOnce(); expect(h.sdk.prepareInterstitial).not.toHaveBeenCalled();
    expect((await ads.showNativeAd('interstitial')).status).toBe('cancelled');
    const reward = ads.showNativeAd('rewarded'); await flush(); emit(Reward.Dismissed); expect((await reward).shown).toBe(true);
  });
  it('표시 실패 사건과 Promise 거절이 함께 와도 실패 간격은 한 번만 증가', async () => {
    const nativeShow = deferred<unknown>(); h.sdk.showRewardVideoAd.mockReturnValue(nativeShow.promise);
    const ads = await import('../src/platform/native-ads'); const reward = ads.showNativeAd('rewarded'); await flush();
    emit(Reward.FailedToShow); nativeShow.reject(new Error('same failure'));
    expect((await reward).status).toBe('failed'); await flush();
    await vi.advanceTimersByTimeAsync(ads.AD_TIMING.retry);
    await ads.prepareNativeAd('rewarded'); expect(h.sdk.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
  });
  it('개인정보 변경 뒤 과거 동의로 준비한 광고를 버리고 SDK는 재초기화하지 않음', async () => {
    h.sdk.requestConsentInfo.mockResolvedValue({ ...consent, privacyOptionsRequirementStatus: 'REQUIRED' });
    const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false); await ads.prepareNativeAd('interstitial');
    h.runtime.mockResolvedValue({ debuggable: false, canRequestAds: true, privacyOptionsRequired: true });
    expect(await ads.showAdPrivacyOptions()).toBe(true); await flush();
    expect(ads.nativeAdReady('interstitial')).toBe(false); expect(h.sdk.removeBanner).toHaveBeenCalledOnce();
    expect(h.sdk.showBanner).toHaveBeenCalledTimes(2); expect(h.sdk.initialize).toHaveBeenCalledOnce();
  });
  it('웹에서는 Android 광고를 부르지 않음', async () => {
    h.platform = 'web'; const ads = await import('../src/platform/native-ads'); await ads.mountNativeAds(false);
    expect((await ads.showNativeAd('rewarded')).shown).toBe(false); expect(h.sdk.initialize).not.toHaveBeenCalled();
  });
});
