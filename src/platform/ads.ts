/**
 * 광고 자리 (15 7장, 20 4-1: AdMob). 광고 계정을 붙이기 전이라 「광고 자리」 창을 띄움.
 * 보상형: 닫으면 보상. 광고 제거 패키지 (81)면 광고 없이 바로 보상.
 * 전면 (90): 클리어한 판의 결과 화면에서 나갈 때, 마지막 광고 뒤 앱이 화면에 떠 있던 시간이 10분을 넘었으면 한 번 (screens/result.ts).
 */
import { INTERSTITIAL } from '../data/economy';
import { t } from '../i18n';

export const ADS_READY = false;

// ---------- 광고 시계 (90): 마지막 광고 뒤 앱이 화면에 떠 있던 시간. 메모리에만 (앱을 새로 켜면 0부터) ----------
// 기기 시계 대신 performance.now와 화면 보임 (visibilitychange)으로 셈: 시계를 바꾸거나 앱을 내려 둔 시간은 안 셈
const clockNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const visibleNow = (): boolean => typeof document === 'undefined' || document.visibilityState !== 'hidden';
let shownMs = 0;
let since: number | null = visibleNow() ? clockNow() : null;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (visibleNow()) { if (since == null) since = clockNow(); }
    else if (since != null) { shownMs += clockNow() - since; since = null; }
  });
}
/** 마지막 광고 뒤 화면에 떠 있던 시간 (ms) */
export const adClockMs = (): number => shownMs + (since != null ? clockNow() - since : 0);
/** 광고를 봤음: 10분을 새로 셈 (전면 · 보상형 모두) */
export function resetAdClock(): void { shownMs = 0; since = visibleNow() ? clockNow() : null; }

/** 전면 광고를 띄울 판인지 (90). 클리어 · Lv 10 이상 · 튜토리얼 끝 · 광고 제거 안 삼 · 10분 지남 */
export function interstitialDue(o: { won: boolean; level: number; tutDone: boolean; adsFree: boolean; ms: number }): boolean {
  return o.won && o.tutDone && !o.adsFree && o.level >= INTERSTITIAL.minLv && o.ms >= INTERSTITIAL.everyMs;
}
/**
 * 화면 테스트 (Playwright = navigator.webdriver)는 전면 광고를 띄우지 않음 (시계가 빨리 가서 다른 검사를 막지 않게).
 * 전면 광고 자체 검사는 window.__interstitialTest = true
 */
export function interstitialOff(): boolean {
  if (typeof window === 'undefined') return true;
  const w = window as unknown as { __interstitialTest?: boolean };
  return !w.__interstitialTest && typeof navigator !== 'undefined' && !!navigator.webdriver;
}

/** 광고 상자 (시험 창): 버튼 data-ad를 누르면 그 값으로 닫힘 */
function adBox(cls: string, html: string): Promise<string> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = `admodal ${cls}`.trim();
    box.innerHTML = html;
    box.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ad]');
      if (!b) return;
      box.remove();
      resolve(b.dataset.ad || '');
    });
    (document.getElementById('app') || document.body).appendChild(box);
    box.querySelector<HTMLElement>('.btn.primary')?.focus({ preventScroll: true });
  });
}

/** 보상형 광고: 다 보면 true (그때 광고 시계를 새로). 지금은 시험 창 */
export async function showRewarded(label: string, adsFree: boolean): Promise<boolean> {
  if (adsFree) return true;
  const ok = (await adBox('', `<div class="panel"><h3>${t('광고 자리')}</h3><p class="note">${t('AdMob 연결 전 · 시험용. 닫으면 보상')}</p><p>${label}</p>
      <div class="row2"><button class="btn" type="button" data-ad="no">${t('취소')}</button><button class="btn primary" type="button" data-ad="ok">${t('광고 끝 · 보상 받기')}</button></div></div>`)) === 'ok';
  if (ok) resetAdClock();
  return ok;
}

/**
 * 전면 광고: 띄웠으면 (닫힌 뒤) true, 못 불러왔으면 false (그때는 시계 그대로, 다음 클리어에 다시 봄).
 * AdMob 연결 전 (ADS_READY false)이라 시험 창
 */
export async function showInterstitial(): Promise<boolean> {
  await adBox('ad-inter', `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="adInterTitle"><h3 id="adInterTitle">${t('전면 광고 자리 (시험)')}</h3><p class="note">${t('AdMob 연결 전 · 시험용')}</p>
      <div class="row1"><button class="btn primary" type="button" data-ad="close">${t('닫기')}</button></div></div>`);
  resetAdClock();
  return true;
}

/** 고르기 창 (이어하기 등). 오른쪽 버튼이면 true */
export function askModal(title: string, bodyHtml: string, no: string, ok: string): Promise<boolean> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'admodal ask';
    box.innerHTML = `<div class="panel"><h3>${title}</h3><p>${bodyHtml}</p>
      <div class="row2"><button class="btn" type="button" data-ask="no">${no}</button><button class="btn primary" type="button" data-ask="ok">${ok}</button></div></div>`;
    box.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ask]');
      if (!b) return;
      box.remove();
      resolve(b.dataset.ask === 'ok');
    });
    (document.getElementById('app') || document.body).appendChild(box);
  });
}

/**
 * 알림 창 (고르기 창과 같은 모양 · 버튼 하나): 구매 · 받기 · 영입이 안 된 까닭 (2026-10-28 Lim 「저렇게 가운데 생기는 ui는 최대한 자제」,
 * 예전 목록 위 알림 줄). 확인 · 뒤로가기로 닫힘
 */
export function noticeModal(title: string, bodyHtml: string, ok = t('확인')): Promise<void> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'admodal ask notice';
    box.innerHTML = `<div class="panel" role="alertdialog" aria-modal="true" aria-label="${title}"><h3>${title}</h3><p>${bodyHtml}</p>
      <div class="row1"><button class="btn primary" type="button" data-ask="close">${ok}</button></div></div>`;
    box.addEventListener('click', e => {
      if (!(e.target as HTMLElement).closest('[data-ask]')) return;
      box.remove();
      resolve();
    });
    (document.getElementById('app') || document.body).appendChild(box);
    box.querySelector<HTMLElement>('[data-ask]')?.focus({ preventScroll: true });
  });
}
