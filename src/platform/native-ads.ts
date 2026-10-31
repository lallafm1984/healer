/** Android 광고 요청·캐시·동의·화면 수명. 메뉴와 저장은 광고 요청의 원인이 되지 않는다. */
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';
import { AdRuntime } from './ad-runtime';
import { serverReady } from './startup';

export const NATIVE_ADS = Capacitor.getPlatform() === 'android';
export const TEST_ADS = import.meta.env.DEV || import.meta.env.VITE_ADMOB_TESTING === 'true';
export const AD_UNITS = {
  banner: 'ca-app-pub-9163944262143117/6740817449',
  rewarded: 'ca-app-pub-9163944262143117/7886378150',
  interstitial: 'ca-app-pub-9163944262143117/1081296656',
} as const;
export const AD_TIMING = { retry: 30000, retryMax: 300000, loadWait: 8000, cache: 55 * 60000 };
type Kind = 'rewarded' | 'interstitial';
export interface AdResult { status: 'closed' | 'failed' | 'not-ready' | 'busy' | 'cancelled'; shown: boolean; rewarded: boolean }
interface Gate { failures: number; at: number }
interface Cache { readyAt: number | null; wallAt: number; id: string; pending: Promise<boolean> | null; gate: Gate }
const time = (): number => performance.now();
const gate = (): Gate => ({ failures: 0, at: 0 });
const initGate = gate(), bannerGate = gate();
const caches: Record<Kind, Cache> = Object.fromEntries(['rewarded', 'interstitial'].map(k => [k, { readyAt: null, wallAt: 0, id: '', pending: null, gate: gate() }])) as Record<Kind, Cache>;
const blocked = (g: Gate): boolean => time() < g.at;
function failed(g: Gate): void { g.at = time() + Math.min(AD_TIMING.retryMax, AD_TIMING.retry * 2 ** Math.min(g.failures++, 4)); }
function passed(g: Gate): void { g.failures = 0; g.at = 0; }
const result = (status: AdResult['status'], shown = false, rewarded = false): AdResult => ({ status, shown, rewarded });

let testAds = TEST_ADS, runtimeKnown = false;
let consentAllowed = false, consentBlocked = false, sdkReady = false;
let initWork: Promise<boolean> | null = null, consentWork: ReturnType<typeof AdMob.requestConsentInfo> | null = null, sdkWork: Promise<void> | null = null;
let mounted = false, noAds = false, fullscreenBusy = false, nativeActive = true, lastForeground = true;
let epoch = 0, privacyRequired = false;
let banner: 'idle' | 'loading' | 'created' | 'ready' = 'idle';
let bannerWork: Promise<void> | null = null, visibilityWork: Promise<void> | null = null, bannerRemoval: Promise<void> | null = null;
let visibilityDirty = false;
let bannerVisible = true, bannerTimer: ReturnType<typeof setTimeout> | undefined;
let listenersReady = false;
const privacyListeners = new Set<() => void>();
const counts = { consentRequests: 0, sdkInitializations: 0, bannerRequests: 0, bannerLoaded: 0, bannerImpressions: 0, rewardedRequests: 0, interstitialRequests: 0, fullscreenShown: 0, rewards: 0 };
export const adDiagnostics = () => ({ testAds, consentAllowed, consentBlocked, banner, fullscreenBusy, ...counts });
export const nativeAdBusy = (): boolean => fullscreenBusy;
const foreground = (): boolean => nativeActive && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
const mayShow = (check: () => boolean): boolean => foreground() && serverReady() && check();
export const adPrivacyRequired = (): boolean => NATIVE_ADS && privacyRequired;
export function onAdPrivacyChange(fn: () => void): void { privacyListeners.add(fn); }
function setPrivacy(required: boolean): void { if (privacyRequired !== required) { privacyRequired = required; privacyListeners.forEach(fn => fn()); } }

class AdWaitTimeout extends Error {}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AdWaitTimeout('AdMob load timed out')), AD_TIMING.loadWait); })]); }
  finally { clearTimeout(timer); }
}

async function initialize(): Promise<boolean> {
  if (!NATIVE_ADS || consentBlocked) return false;
  if (sdkReady && consentAllowed) return true;
  if (initWork) return initWork;
  if (blocked(initGate) || !foreground()) return false;
  initWork = (async () => {
    try {
      if (!runtimeKnown) {
        const info = await bounded(AdRuntime.getInfo());
        testAds = TEST_ADS || info.debuggable;
        runtimeKnown = true;
        if (testAds && typeof window !== 'undefined') (window as unknown as { __adDiagnostics: typeof adDiagnostics }).__adDiagnostics = adDiagnostics;
      }
      if (testAds) consentAllowed = true;
      else if (!consentAllowed) {
        try {
          if (!consentWork) {
            counts.consentRequests++;
            consentWork = AdMob.requestConsentInfo().finally(() => { consentWork = null; });
          }
          let consent = await bounded(consentWork);
          if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
            if (!foreground()) return false;
            consent = await AdMob.showConsentForm();
          }
          setPrivacy(consent.privacyOptionsRequirementStatus === 'REQUIRED');
          consentAllowed = consent.canRequestAds;
          consentBlocked = !consentAllowed;
        } catch (error) {
          // Google 권장: 갱신 실패에도 이전에 얻은 유효 동의가 있으면 사용한다. 첫 실행 오류는 그대로 막는다.
          const previous = await bounded(AdRuntime.getInfo());
          setPrivacy(previous.privacyOptionsRequired);
          if (!previous.canRequestAds) throw error;
          consentAllowed = true;
        }
      }
      if (!consentAllowed || !foreground()) return false;
      if (!sdkReady) {
        if (!sdkWork) {
          counts.sdkInitializations++;
          sdkWork = AdMob.initialize({ initializeForTesting: testAds }).then(() => { sdkReady = true; }).finally(() => { sdkWork = null; });
        }
        await bounded(sdkWork);
      }
      passed(initGate);
      return true;
    } catch (error) { failed(initGate); console.warn('AdMob initialization unavailable', error); return false; }
  })();
  try { return await initWork; } finally { initWork = null; }
}

function scheduleBanner(): void {
  clearTimeout(bannerTimer); bannerTimer = undefined;
  if (!mounted || noAds || bannerRemoval || !foreground() || consentBlocked || fullscreenBusy || banner !== 'idle') return;
  const delay = Math.max(0, initGate.at - time(), bannerGate.at - time());
  bannerTimer = setTimeout(() => { bannerTimer = undefined; void ensureBanner(); }, delay);
}

async function syncBannerVisibility(): Promise<void> {
  visibilityDirty = true;
  if (visibilityWork) return visibilityWork;
  visibilityWork = (async () => {
    while (visibilityDirty) {
      visibilityDirty = false;
      if (banner !== 'created' && banner !== 'ready') break;
      const show = foreground() && !fullscreenBusy && !noAds && !bannerRemoval;
      if (bannerVisible === show) continue;
      if (show) await AdMob.resumeBanner(); else await AdMob.hideBanner();
      bannerVisible = show;
    }
  })().catch(error => { visibilityDirty = false; console.warn('AdMob banner visibility unavailable', error); });
  try { await visibilityWork; } finally { visibilityWork = null; if (visibilityDirty) void syncBannerVisibility(); }
}

async function listenBanner(): Promise<void> {
  if (listenersReady) return;
  const handles: PluginListenerHandle[] = [];
  try {
    handles.push(await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
      if (noAds || bannerRemoval) return;
      banner = 'ready'; counts.bannerLoaded++; passed(bannerGate); void syncBannerVisibility();
    }));
    handles.push(await AdMob.addListener(BannerAdPluginEvents.AdImpression, () => { counts.bannerImpressions++; }));
    handles.push(await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      // 이 플러그인은 실패한 AdView를 제거한다. 없어진 뷰를 표시 중으로 기억하지 않는다.
      banner = 'idle'; failed(bannerGate); scheduleBanner();
    }));
    listenersReady = true;
  } catch (error) { await Promise.allSettled(handles.map(h => h.remove())); throw error; }
}

async function ensureBanner(): Promise<void> {
  if (!mounted || noAds || bannerRemoval || !foreground() || fullscreenBusy || consentBlocked || banner !== 'idle') return;
  if (bannerWork) return bannerWork;
  if (blocked(initGate) || blocked(bannerGate)) { scheduleBanner(); return; }
  bannerWork = (async () => {
    try {
      await listenBanner();
      if (!await initialize() || noAds || bannerRemoval || !foreground() || fullscreenBusy) return;
      banner = 'loading'; counts.bannerRequests++;
      await AdMob.showBanner({ adId: AD_UNITS.banner, adSize: BannerAdSize.BANNER, position: BannerAdPosition.TOP_CENTER, margin: 0, isTesting: testAds });
      if (banner === 'loading') banner = 'created';
      bannerVisible = true;
      await syncBannerVisibility();
    } catch (error) { banner = 'idle'; failed(bannerGate); console.warn('AdMob banner unavailable', error); }
  })();
  try { await bannerWork; } finally { bannerWork = null; scheduleBanner(); }
}

/** 생성 중 구매해도 네이티브 뷰 생성이 끝난 뒤 제거한다. 같은 구매·복원 신호는 한 번으로 합친다. */
async function removePurchasedBanner(): Promise<void> {
  clearTimeout(bannerTimer); bannerTimer = undefined;
  if (bannerRemoval) return bannerRemoval;
  bannerRemoval = (async () => {
    if (bannerWork) await bannerWork;
    if (visibilityWork) await visibilityWork;
    if (banner === 'idle') return;
    await AdMob.removeBanner();
    banner = 'idle'; bannerVisible = false;
  })().catch(error => { console.warn('AdMob banner removal unavailable', error); });
  try { await bannerRemoval; }
  finally { bannerRemoval = null; void syncBannerVisibility(); scheduleBanner(); }
}

/** 저장·메뉴 이동은 요청을 만들지 않는다. 구매·복원하면 배너를 제거하고 재요청도 막는다. */
export function syncNativeBanner(adsFree: boolean): Promise<void> {
  const changed = noAds !== adsFree;
  noAds = adsFree;
  if (noAds) caches.interstitial.readyAt = null;
  if (!NATIVE_ADS) return Promise.resolve();
  if (noAds) return removePurchasedBanner();
  if (changed) scheduleBanner();
  return Promise.resolve();
}

export async function mountNativeAds(adsFree: boolean): Promise<void> {
  await syncNativeBanner(adsFree);
  if (!NATIVE_ADS || mounted) return;
  mounted = true; lastForeground = foreground();
  document.documentElement.classList.add('native-ads');
  const changed = () => {
    const active = foreground(), resumed = active && !lastForeground;
    lastForeground = active;
    void syncBannerVisibility();
    if (!active) { clearTimeout(bannerTimer); bannerTimer = undefined; }
    else if (resumed) scheduleBanner();
  };
  document.addEventListener('visibilitychange', changed);
  void App.addListener('appStateChange', state => { nativeActive = state.isActive; changed(); }).catch(error => console.warn('AdMob app state unavailable', error));
  await ensureBanner();
}

export function nativeAdReady(kind: Kind): boolean {
  const c = caches[kind];
  // performance가 깊은 잠을 덜 세는 기기도 있으므로 벽시계는 오래된 캐시를 버리는 용도로만 함께 확인한다.
  const wallAge = Date.now() - c.wallAt;
  return c.readyAt != null && time() - c.readyAt < AD_TIMING.cache && wallAge >= 0 && wallAge < AD_TIMING.cache && !blocked(c.gate) && !(kind === 'interstitial' && noAds);
}

/** 형식마다 한 개만 준비한다. 시간 초과 뒤에도 실제 로드가 끝나기 전에는 다음 요청을 만들지 않는다. */
export async function prepareNativeAd(kind: Kind): Promise<boolean> {
  if (!NATIVE_ADS || !foreground() || fullscreenBusy || kind === 'interstitial' && noAds) return false;
  const c = caches[kind];
  if (nativeAdReady(kind)) return true;
  if (blocked(c.gate)) return false;
  if (c.pending) return c.pending;
  const generation = epoch;
  c.pending = (async () => {
    try {
      if (!await initialize() || !foreground() || kind === 'interstitial' && noAds) return false;
      counts[kind === 'rewarded' ? 'rewardedRequests' : 'interstitialRequests']++;
      const options = { adId: AD_UNITS[kind], isTesting: testAds, immersiveMode: true };
      const info = await (kind === 'rewarded' ? AdMob.prepareRewardVideoAd(options) : AdMob.prepareInterstitial(options));
      if (generation !== epoch || kind === 'interstitial' && noAds) return false;
      c.id = info.adUnitId;
      c.readyAt = time(); c.wallAt = Date.now(); passed(c.gate);
      return true;
    } catch (error) { c.readyAt = null; failed(c.gate); console.warn('AdMob load unavailable', error); return false; }
  })();
  try { return await c.pending; } finally { c.pending = null; }
}

/** 전면은 준비된 것만. 보상형은 명시적 요청 때만 로드하고 표시 직전에 화면·혜택 조건을 다시 확인한다. */
export async function showNativeAd(kind: Kind, canShow: () => boolean = () => true): Promise<AdResult> {
  if (!NATIVE_ADS) return result('not-ready');
  if (fullscreenBusy) return result('busy');
  if (!mayShow(canShow) || kind === 'interstitial' && noAds) return result('cancelled');
  if (kind === 'interstitial' && !nativeAdReady(kind)) return result('not-ready');
  // 보상형 로드를 시작한 뒤에도 다른 전면 광고가 끼어들지 못하게 먼저 잠근다.
  let prepared: Promise<boolean> | null = null;
  if (kind === 'rewarded') prepared = prepareNativeAd(kind);
  fullscreenBusy = true;
  void syncBannerVisibility();
  const handles: PluginListenerHandle[] = [];
  const c = caches[kind];
  let shown = false, earned = false;
  try {
    if (prepared && !await bounded(prepared)) return result('not-ready');
    if (!mayShow(canShow) || !nativeAdReady(kind)) return result('cancelled');
    let finish!: (value: AdResult) => void, settled = false;
    const done = new Promise<AdResult>(resolve => { finish = value => { if (!settled) { settled = true; resolve(value); } }; });
    const onShown = () => { if (!settled && !shown) { shown = true; counts.fullscreenShown++; } };
    const onReward = () => { if (!settled && !earned) { earned = true; counts.rewards++; } };
    const onClosed = () => { if (!settled) { onShown(); finish(result('closed', true, earned)); } };
    const onFailed = () => { if (!settled) { failed(c.gate); finish(result('failed', shown)); } };
    if (kind === 'rewarded') {
      handles.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, onReward));
      handles.push(await AdMob.addListener(RewardAdPluginEvents.Showed, onShown));
      handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, onClosed));
      handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, onFailed));
    } else {
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Showed, onShown));
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, onClosed));
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, onFailed));
    }
    if (!mayShow(canShow) || kind === 'interstitial' && noAds) return result('cancelled');
    c.readyAt = null;
    const showing = kind === 'rewarded' ? AdMob.showRewardVideoAd({ adId: c.id }) : AdMob.showInterstitial({ adId: c.id });
    void showing.catch(onFailed);
    return await done;
  } catch (error) {
    // 표시 대기 시간 초과와 같은 물리 요청의 최종 실패를 두 번의 실패로 세지 않는다.
    if (error instanceof AdWaitTimeout && c.pending) c.gate.at = Math.max(c.gate.at, time() + AD_TIMING.retry);
    else failed(c.gate);
    console.warn('AdMob fullscreen unavailable', error); return result('failed', shown);
  }
  finally { await Promise.allSettled(handles.map(h => h.remove())); fullscreenBusy = false; void syncBannerVisibility(); scheduleBanner(); }
}

export async function showAdPrivacyOptions(): Promise<boolean> {
  if (!adPrivacyRequired() || fullscreenBusy || !foreground()) return false;
  fullscreenBusy = true; void syncBannerVisibility();
  try {
    await AdMob.showPrivacyOptionsForm();
    epoch++; Object.values(caches).forEach(c => { c.readyAt = null; });
    if (bannerWork) await bannerWork;
    if (bannerRemoval) await bannerRemoval;
    if (banner !== 'idle') await AdMob.removeBanner();
    banner = 'idle';
    const info = await bounded(AdRuntime.getInfo());
    consentAllowed = info.canRequestAds; consentBlocked = !info.canRequestAds;
    setPrivacy(info.privacyOptionsRequired); passed(initGate); passed(bannerGate);
    return true;
  } catch (error) { console.warn('AdMob privacy options unavailable', error); return false; }
  finally { fullscreenBusy = false; void syncBannerVisibility(); scheduleBanner(); }
}
