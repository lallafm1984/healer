/**
 * 안드로이드 뒤로가기 (2026-10-22 Lim 「뒤로가기시 앱이 닫히지 않게」): 앱을 바로 닫지 않고 게임 안에서 처리한다.
 * 차례: 전투 · 정비 (battle().back: 확인 창 취소 · 정비 공략 시트 닫기 · 일시정지 ↔ 계속) → 맨 위 팝업 닫기
 * (광고 · 고르기 창은 취소 · 닫기 버튼, 시트 · 휴식 창 · 보상 확률 창 · 레벨 업은 키보드 Esc와 같은 길) → 머리 「←」가 있으면 그것 →
 * 결과 화면은 「나가기」 (로비) → 탭 루트 (전투 · 캐릭터 · 길드)는 로비 탭 → 로비 · 타이틀은 「게임 종료」 확인 창.
 * 이야기 · 튜토리얼 카드는 아무것도 안 함. 화면 테스트는 window.__back()
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { askModal } from '../platform/ads';
import { battle, current, go } from './kit';

/** 맨 위 팝업을 닫았으면 true */
function closePopup(): boolean {
  // 광고 시험 창 · 고르기 창 (게임 종료 확인 포함) · 알림 창은 맨 위에 붙음: 취소 · 닫기 · 확인 버튼
  const boxes = document.querySelectorAll<HTMLElement>('.admodal:not(.st-modal)');
  const cancel = boxes[boxes.length - 1]?.querySelector<HTMLElement>('[data-ask="no"], [data-ask="close"], [data-ad="no"], [data-ad="close"]');
  if (cancel) { cancel.click(); return true; }
  // 그 밖의 팝업은 저마다 Esc를 받아 닫고 preventDefault로 알림. 화면 안 keydown도 받게 초점 자리 (없으면 지금 화면)에서 보냄
  const a = document.activeElement;
  const at = a instanceof HTMLElement && a !== document.body && a.isConnected && !a.closest('[hidden]') ? a : document.getElementById(current) || document.body;
  const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  at.dispatchEvent(ev);
  return ev.defaultPrevented;
}

async function askExit(): Promise<void> {
  if (!(await askModal('게임 종료', '게임을 종료하시겠습니까?', '취소', '종료'))) return;
  if (Capacitor.isNativePlatform()) await App.exitApp();
}

export function handleBack(): void {
  if (document.querySelector('.admodal.block')) { void askExit(); return; } // 업데이트 전까지 막는 창 (server-notice): 닫지 않고 종료 확인
  if (battle().back() || closePopup()) return;
  const scr = document.getElementById(current);
  const back = scr?.querySelector<HTMLElement>('.tb-back');
  if (back && !back.closest('[hidden]')) { back.click(); return; } // 설정 · 상점 · 편성 · 주간 도전 · 임무 · 행상인: 「←」와 같게
  if (current === 's-settle') { scr?.querySelector<HTMLElement>('.ns-foot [data-go="s-lobby"]')?.click(); return; } // 전면 광고도 「나가기」와 같게
  if (current === 's-content' || current === 's-char' || current === 's-guild') {
    const tab = document.querySelector<HTMLElement>('#tabs button[data-tab="lobby"]');
    if (tab) tab.click(); else go('s-lobby');
    return;
  }
  if (current === 's-lobby' || current === 's-title') void askExit();
}

export function mountBack(): void {
  (window as unknown as { __back?: () => void }).__back = handleBack;
  if (Capacitor.isNativePlatform()) void App.addListener('backButton', () => handleBack());
}
