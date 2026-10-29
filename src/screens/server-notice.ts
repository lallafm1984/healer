/**
 * 강제 업데이트 · 새 버전 · 점검 · 공지 창 (기획 120 9-5, 2026-10-29 Lim 「시작시 강제 업데이트 설정 및 공지사항 등록도 테이블로 관리」).
 * 앱이 켜질 때 app_boot (서버 app_config · notices 표)를 받아 차례로: 막음 (업데이트 전까지) → 점검 → 새 버전 → 팝업 공지 (공지마다 한 번).
 * 서버에 못 닿으면 아무 창도 없이 그대로. 설정 「공지」 줄은 noticesHtml
 */
import { App } from '@capacitor/app';
import { t } from '../i18n';
import { Capacitor } from '@capacitor/core';
import { askModal, noticeModal } from '../platform/ads';
import { appBoot, appVersion, type Boot, type Notice } from '../platform/server';
import { serverOn } from '../platform/server-config';
import { refreshDay } from '../game/state';

/** kit.ts esc와 같음 (이 파일은 화면 모듈 없이 단위 테스트에서도 읽힘) */
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const SEEN_KEY = 'healer.notices.seen';
const UPDATE_KEY = 'healer.update.seen';

export interface BootActions {
  /** 업데이트 전까지 막음 */
  block: boolean;
  /** 새 버전 알림 (닫을 수 있음) */
  update: boolean;
  /** 점검 안내 글 (아니면 null) */
  maintenance: string | null;
  /** 처음 보는 팝업 공지 */
  popups: Notice[];
}

export const BLOCK_TEXT = '새 버전이 나왔습니다. 업데이트한 뒤 계속할 수 있습니다.';
export const UPDATE_TEXT = '새 버전이 나왔습니다. 스토어에서 업데이트할 수 있습니다.';
export const MAINT_TEXT = '서버 점검 중입니다. 게임은 그대로 할 수 있습니다.';

/** 받은 app_boot로 무엇을 띄울지. version 0 (웹 · 개발 서버)은 업데이트 창 없음. updateSeen = 알림을 이미 본 최신 버전 */
export function bootActions(b: Boot, version: number, seen: readonly number[], updateSeen: number): BootActions {
  const c = b.config;
  const block = !!c && version > 0 && version < c.min_version;
  return {
    block,
    update: !block && !!c && version > 0 && version < c.latest_version && updateSeen < c.latest_version,
    maintenance: !block && c?.maintenance ? (c.maintenance_message?.trim() || MAINT_TEXT) : null,
    popups: block ? [] : b.notices.filter(n => n.popup && !seen.includes(n.id)),
  };
}

const readJson = <T>(k: string, d: T): T => { try { return (JSON.parse(globalThis.localStorage?.getItem(k) || 'null') as T) ?? d; } catch { return d; } };
const writeJson = (k: string, v: unknown): void => { try { globalThis.localStorage?.setItem(k, JSON.stringify(v)); } catch { /* 그만 */ } };

/** 공지 본문: 글만 (HTML 아님), 줄바꿈은 줄로 */
export const noticeBody = (s: string): string => esc(s).replace(/\r?\n/g, '<br>');

/** 스토어 열기: 앱에서는 이 주소로 넘기면 Capacitor가 플레이 스토어 앱으로 보냄 */
function openStore(url: string | null): void {
  if (!url) return;
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

/** 업데이트 전까지 막는 창. 닫는 버튼 없음 (뒤로가기는 게임 종료 확인, back.ts) */
function blockModal(text: string, storeUrl: string | null): void {
  const box = document.createElement('div');
  box.className = 'admodal ask notice block';
  box.innerHTML = `<div class="panel" role="alertdialog" aria-modal="true" aria-label="${t('업데이트 필요')}"><h3>${t('업데이트 필요')}</h3><p>${noticeBody(text)}</p>
    <div class="row2"><button class="btn" type="button" data-upd="exit">${t('종료')}</button><button class="btn primary" type="button" data-upd="store">${t('업데이트')}</button></div></div>`;
  box.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-upd]');
    if (!b) return;
    if (b.dataset.upd === 'store') openStore(storeUrl);
    else if (Capacitor.isNativePlatform()) void App.exitApp();
  });
  (document.getElementById('app') || document.body).appendChild(box);
  box.querySelector<HTMLElement>('[data-upd="store"]')?.focus({ preventScroll: true });
}

let maintShown = false;
/** app_boot 결과로 창을 차례로 띄움 (앱이 켜질 때 · 앞으로 올 때) */
export async function showBoot(b: Boot, version: number): Promise<void> {
  if (document.querySelector('.admodal.block')) return;
  const seen = readJson<number[]>(SEEN_KEY, []);
  const a = bootActions(b, version, seen, readJson<number>(UPDATE_KEY, 0));
  const c = b.config;
  if (a.block) { blockModal(c?.update_message?.trim() || t(BLOCK_TEXT), c?.store_url ?? null); return; }
  if (a.maintenance && !maintShown) { maintShown = true; await noticeModal(t('서버 점검'), noticeBody(t(a.maintenance))); }
  if (a.update && c) {
    writeJson(UPDATE_KEY, c.latest_version);
    if (await askModal(t('새 버전'), noticeBody(c.update_message?.trim() || t(UPDATE_TEXT)), t('나중에'), t('업데이트'))) openStore(c.store_url);
  }
  for (const n of a.popups) {
    writeJson(SEEN_KEY, [...readJson<number[]>(SEEN_KEY, []), n.id].slice(-200));
    await noticeModal(esc(n.title), noticeBody(n.body));
  }
}

/** 설정 「공지」 목록 창 */
export function noticesHtml(list: readonly Notice[]): string {
  if (!list.length) return `<span class="st-notice-empty">${t('지금 공지가 없습니다.')}</span>`;
  return `<span class="st-notices">${list.map(n => `<span class="st-notice"><b>${esc(n.title)}</b>${n.body ? `<span>${noticeBody(n.body)}</span>` : ''}</span>`).join('')}</span>`;
}

/** 앞으로 올 때 다시 받는 간격 (시각 맞춤 · 새 공지) */
const RESUME_MS = 10 * 60e3;
let lastBootAt = -Infinity;
async function boot(count: boolean): Promise<void> {
  lastBootAt = performance.now();
  const b = await appBoot(count);
  if (!b) return;
  refreshDay(); // 서버 시각으로 맞춘 뒤 날 · 주가 바뀌었으면 새로
  await showBoot(b, await appVersion());
}

/** 앱이 켜질 때 (main.ts, 타이틀을 띄운 뒤): app_boot · 창, 앞으로 올 때 10분마다 다시 */
export function mountServer(): void {
  if (!serverOn()) return;
  void boot(true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && performance.now() - lastBootAt > RESUME_MS) void boot(false);
  });
}
