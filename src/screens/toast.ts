/**
 * 짧은 알림 (2026-10-28 Lim 「저렇게 가운데 생기는 ui는 최대한 자제」): 끝난 일 (해금 · 영입 · 후원 · 휴식 충전)과 가벼운 경고 (자리가 다 참)는
 * 목록 위에 줄을 끼우지 않고 아래 메뉴 위에 잠깐 떴다 사라짐 (화면이 밀리지 않음, 누름은 지나감).
 * 하나씩: 새 알림이 오면 앞의 것을 바로 바꿈. 시각 효과 줄이기 · 기기 동작 줄이기면 움직임 없이
 */
import { G } from '../game/state';
import './toast.css';

/** 떠 있는 시간 (초) */
const SHOW = 2.2;

let el: HTMLElement | null = null, timer = 0;

export function notify(text: string): void {
  if (typeof document === 'undefined' || !text) return;
  if (!el?.isConnected) {
    el = document.createElement('p');
    el.className = 'toast-note';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    (document.getElementById('app') || document.body).appendChild(el);
  }
  const calm = G.save.settings.reducedEffects || matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.classList.toggle('calm', calm);
  el.textContent = text;
  // 같은 알림이 이어 와도 처음부터 다시 떠오름
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove('on'), SHOW * 1000);
}
