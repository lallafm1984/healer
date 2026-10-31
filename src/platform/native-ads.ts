/** Android AdMob. 출시 광고는 동의 확인 뒤 시작하고 개발판은 Google 데모 광고만 요청한다. */
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob, AdmobConsentStatus, BannerAdPosition, BannerAdSize,
  InterstitialAdPluginEvents, RewardAdPluginEvents,
} from '@capacitor-community/admob';

export const NATIVE_ADS = Capacitor.getPlatform() === 'android';
export const TEST_ADS = import.meta.env.DEV || import.meta.env.VITE_ADMOB_TESTING === 'true';
export const AD_UNITS = {
  banner: 'ca-app-pub-9163944262143117/6740817449',
  rewarded: 'ca-app-pub-9163944262143117/7886378150',
  interstitial: 'ca-app-pub-9163944262143117/1081296656',
} as const;

let initialized = false;
let initializing: Promise<boolean> | null = null;
let mounted = false;
let noAds = false;
let bannerShown = false;
let bannerQueue: Promise<void> = Promise.resolve();
let fullscreenBusy = false;
let privacyRequired = false;
const privacyListeners = new Set<() => void>();
export const adPrivacyRequired = (): boolean => NATIVE_ADS && privacyRequired;
export function onAdPrivacyChange(fn: () => void): void { privacyListeners.add(fn); }

async function initialize(): Promise<boolean> {
  if (!NATIVE_ADS) return false;
  if (initialized) return true;
  if (initializing) return initializing;
  initializing = (async () => {
    try {
      // isTesting은 Google 데모 광고 단위만 사용한다. 개발판까지 운영 앱의 UMP 메시지 등록에 묶지 않는다.
      // 출시 빌드는 반드시 동의를 확인한다. UMP 오류·요청 불가를 시험 광고 경로로 우회하지 않는다.
      if (!TEST_ADS) {
        let consent = await loadAd(AdMob.requestConsentInfo());
        if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
          consent = await AdMob.showConsentForm();
        }
        privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
        privacyListeners.forEach(fn => fn());
        if (!consent.canRequestAds) return false;
      }
      await AdMob.initialize({ initializeForTesting: TEST_ADS });
      initialized = true;
      return true;
    } catch (error) {
      console.warn('AdMob initialization unavailable', error);
      return false;
    }
  })();
  try { return await initializing; } finally { initializing = null; }
}

async function updateBanner(): Promise<void> {
  // 배너는 구매 여부와 관계없이 앱 전체에서 한 뷰를 유지한다. 화면·메뉴 이동은 다시 요청하지 않는다.
  if (bannerShown || !await initialize()) return;
  // 320×50 배너. 플러그인이 노치 높이를 더하므로 웹도 같은 안전 영역만큼 비운다.
  await AdMob.showBanner({
    adId: AD_UNITS.banner, adSize: BannerAdSize.BANNER,
    position: BannerAdPosition.TOP_CENTER, margin: 0, isTesting: TEST_ADS,
  });
  bannerShown = true;
}

/** 패키지는 전면 광고만 제외한다. 저장·메뉴 이동 때 부르더라도 기존 배너를 새로 불러오지 않는다. */
export function syncNativeBanner(adsFree: boolean): Promise<void> {
  noAds = adsFree;
  if (!NATIVE_ADS || !mounted) return Promise.resolve();
  bannerQueue = bannerQueue.then(updateBanner).catch(error => console.warn('AdMob banner unavailable', error));
  return bannerQueue;
}

/** 강제 업데이트·공지 처리가 끝난 다음 시작한다. 광고 실패가 게임 시작을 막지 않는다. */
export async function mountNativeAds(adsFree: boolean): Promise<void> {
  if (!NATIVE_ADS || mounted) return;
  mounted = true;
  document.documentElement.classList.add('native-ads');
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !fullscreenBusy) syncNativeBanner(noAds);
  });
  syncNativeBanner(adsFree);
  await bannerQueue;
}

/** 필요한 지역에서만 설정에 표시하는 UMP 동의 변경 창. */
export async function showAdPrivacyOptions(): Promise<boolean> {
  if (!adPrivacyRequired() || fullscreenBusy) return false;
  fullscreenBusy = true;
  try {
    await AdMob.showPrivacyOptionsForm();
    // 이전 동의로 요청한 배너를 버리고 새 동의로 다시 요청한다.
    await bannerQueue;
    if (bannerShown) { await AdMob.removeBanner(); bannerShown = false; }
    initialized = false;
    return true;
  } catch (error) {
    console.warn('AdMob privacy options unavailable', error);
    return false;
  } finally { fullscreenBusy = false; syncNativeBanner(noAds); }
}

/** 광고 로드가 끝없이 결과 화면을 붙잡지 않게 한다. 광고를 실제로 보는 동안에는 시간 제한이 없다. */
async function loadAd<T>(load: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([load, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AdMob load timed out')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

/** 닫힌 뒤 완료. 보상형은 Rewarded 신호가 있어야 true, 조기 닫기·로드/표시 실패는 false. */
export async function showNativeAd(kind: 'rewarded' | 'interstitial'): Promise<boolean> {
  if (!NATIVE_ADS || fullscreenBusy || kind === 'interstitial' && noAds) return false;
  fullscreenBusy = true;
  const handles: PluginListenerHandle[] = [];
  try {
    if (!await initialize() || kind === 'interstitial' && noAds) return false;
    let earned = false;
    let settled = false;
    let finish!: (ok: boolean) => void;
    const done = new Promise<boolean>(resolve => {
      finish = ok => { if (!settled) { settled = true; resolve(ok); } };
    });
    if (kind === 'rewarded') {
      handles.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }));
      handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(earned)));
      handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)));
    } else {
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish(true)));
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => finish(false)));
    }
    const options = { adId: AD_UNITS[kind], isTesting: TEST_ADS, immersiveMode: true };
    await loadAd(kind === 'rewarded' ? AdMob.prepareRewardVideoAd(options) : AdMob.prepareInterstitial(options));
    if (kind === 'interstitial' && noAds) return false;
    // 보상형 show의 Promise는 조기 닫기 때 끝나지 않는다. Dismissed 사건으로 완료를 결정한다.
    const showing = kind === 'rewarded' ? AdMob.showRewardVideoAd() : AdMob.showInterstitial();
    void showing.catch(() => finish(false));
    return await done;
  } catch (error) {
    console.warn('AdMob fullscreen unavailable', error);
    return false;
  } finally {
    await Promise.allSettled(handles.map(handle => handle.remove()));
    fullscreenBusy = false;
  }
}
