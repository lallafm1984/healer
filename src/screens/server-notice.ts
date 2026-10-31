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
import { beginServerCheck, serverReady } from '../platform/startup';

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
const readSeen = (): number[] => {
  const stored = readJson<unknown>(SEEN_KEY, []);
  return Array.isArray(stored) ? stored.filter(n => Number.isInteger(n)) as number[] : [];
};

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
  // 업데이트 창 밖의 화면은 키보드·접근성 입력으로도 조작하지 못한다.
  for (const child of Array.from(box.parentElement!.children)) {
    if (child instanceof HTMLElement && child !== box) child.inert = true;
  }
  document.addEventListener('keydown', e => {
    const boxes = document.querySelectorAll('.admodal');
    if (!box.isConnected || boxes[boxes.length - 1] !== box) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key !== 'Tab') return;
    const controls = Array.from(box.querySelectorAll<HTMLButtonElement>('button'));
    const first = controls[0], last = controls[controls.length - 1], active = document.activeElement;
    if (!box.contains(active) || e.shiftKey && active === first || !e.shiftKey && active === last) {
      e.preventDefault(); (e.shiftKey ? last : first)?.focus({ preventScroll: true });
    }
  }, true);
  box.querySelector<HTMLElement>('[data-upd="store"]')?.focus({ preventScroll: true });
}

let maintShown = false;
/** app_boot 결과로 창을 차례로 띄움 (앱이 켜질 때 · 앞으로 올 때) */
export async function showBoot(b: Boot, version: number): Promise<void> {
  if (document.querySelector('.admodal.block')) return;
  const seen = readSeen();
  const a = bootActions(b, version, seen, readJson<number>(UPDATE_KEY, 0));
  const c = b.config;
  if (a.block) { blockModal(c?.update_message?.trim() || t(BLOCK_TEXT), c?.store_url ?? null); return; }
  // 앞으로 온 게임 화면은 공지로 가리지 않는다. 읽음 처리하지 않아 다음 타이틀에서 뜬다.
  const title = document.getElementById('s-title');
  if (!title || title.hidden) return;
  if (a.maintenance && !maintShown) { maintShown = true; await noticeModal(t('서버 점검'), noticeBody(t(a.maintenance))); }
  if (a.update && c) {
    writeJson(UPDATE_KEY, c.latest_version);
    if (await askModal(t('새 버전'), noticeBody(c.update_message?.trim() || t(UPDATE_TEXT)), t('나중에'), t('업데이트'))) openStore(c.store_url);
  }
  for (const n of a.popups) {
    writeJson(SEEN_KEY, [...readSeen(), n.id].slice(-200));
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
let running: Promise<boolean> | null = null;
function titleChecking(): void {
  const start = document.getElementById('titleStart') as HTMLButtonElement | null;
  if (!start) return;
  start.disabled = !serverReady();
  if (start.disabled) start.setAttribute('aria-busy', 'true'); else start.removeAttribute('aria-busy');
}
function boot(count: boolean): Promise<boolean> {
  if (running) return running;
  const finish = beginServerCheck();
  titleChecking();
  lastBootAt = performance.now();
  running = (async () => {
    try {
      const b = await appBoot(count);
      if (b) {
        refreshDay(); // 서버 시각으로 맞춘 뒤 날 · 주가 바뀌었으면 새로
        await showBoot(b, await appVersion());
      }
    } catch {
      // 서버 표시 실패는 오프라인 진행을 막지 않음. 이미 뜬 강제 업데이트 창은 유지한다.
    } finally {
      finish(!document.querySelector('.admodal.block'));
      titleChecking();
      running = null;
    }
    return serverReady();
  })();
  return running;
}

/** 앱이 켜질 때 (main.ts, 타이틀을 띄운 뒤): app_boot · 창, 앞으로 올 때 10분마다 다시 */
export function mountServer(): Promise<boolean> {
  if (!serverOn()) return Promise.resolve(true);
  const resume = () => { if (performance.now() - lastBootAt > RESUME_MS) void boot(false); };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resume();
  });
  // 계정의 resume 리스너보다 먼저 확인을 시작한다. visibilitychange와 겹치면 같은 요청을 기다린다.
  if (Capacitor.isNativePlatform()) void App.addListener('resume', resume);
  return boot(true);
}
