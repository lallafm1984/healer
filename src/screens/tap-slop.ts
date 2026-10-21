/**
 * 조금 움직인 탭도 누름 (2026-10-21 Lim 「메뉴 버튼을 누를 때 손가락이 조금만 움직여도 취소됨」).
 * 안드로이드 웹뷰는 손가락이 8px (약 1.5mm)만 움직여도 탭을 버린다: 스크롤로 넘어가면 pointercancel, touch-action: none 칸이면 click이 안 옴.
 * 버튼에서 시작해 조금만 움직이고 버튼 위 (테두리 바깥 8px 여유)에서 뗀 터치에 브라우저 click이 안 오면, 손 뗀 자리로 click을 한 번 대신 보낸다.
 * 스크롤은 그대로 (preventDefault 없음): 목록이 실제로 움직였으면 16px까지, 안 움직였으면 24px까지만 누름으로 본다.
 * 브라우저 click이 오면 대신 보내지 않고, 대신 보낸 뒤 늦게 온 브라우저 click은 버린다 (두 번 눌림 없음).
 * 전투 판 · 휠 · 특성 버튼 · 예고 칸은 자기 pointer 판정이라 빼고, 글자 입력칸 · 끌기 막대 · 두 손가락 · 길게 누름도 뺀다.
 */
const SEL = 'button, [role="button"], [role="tab"], a[href], summary, label';
const SKIP = 'textarea, select, input:not([type="checkbox"]):not([type="radio"]), [contenteditable], [data-notap], #board, #wheel, #aux, #queue';
/** 누름으로 보는 손가락 이동 (CSS px): 목록이 움직였을 때 · 안 움직였을 때 */
export const TAP_SLOP = { scrolled: 16, still: 24 } as const;
const EDGE = 8;
const LONG_MS = 700;
/** 브라우저 click을 기다리는 시간 (pointercancel이 없었을 때만) */
const WAIT_MS = 90;
const LATE_MS = 600;

export interface TapTrace {
  /** 누른 자리에서 손가락이 가장 멀리 간 거리 */
  moved: number;
  /** 버튼을 담은 스크롤 칸이 움직인 거리 (가장 많이 움직인 칸) */
  scroll: number;
  /** 손 뗀 자리가 버튼 위 (+ 여유) */
  inside: boolean;
  ms: number;
}

/** 브라우저가 버린 탭을 누름으로 살릴지 */
export function keepTap(t: TapTrace): boolean {
  if (!t.inside || t.ms > LONG_MS || t.scroll > TAP_SLOP.scrolled) return false;
  return t.moved <= (t.scroll >= 1 ? TAP_SLOP.scrolled : TAP_SLOP.still);
}

interface Press {
  id: number; el: HTMLElement; target: Element; x0: number; y0: number; x: number; y: number;
  moved: number; t0: number; ms: number; cancelled: boolean; scrolls: [Element, number, number][];
}

let press: Press | null = null;
let waiting: Press | null = null, waitTimer = 0, lateUntil = 0;

export function mountTapSlop(): void {
  const opt = { capture: true, passive: true } as const;
  addEventListener('touchstart', e => {
    stopWaiting(); lateUntil = 0;
    const t = e.changedTouches[0], target = e.target instanceof Element ? e.target : null;
    const el = target?.closest<HTMLElement>(SEL);
    press = e.touches.length === 1 && t && target && el && !target.closest(SKIP)
      ? { id: t.identifier, el, target, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, moved: 0, t0: e.timeStamp, ms: 0, cancelled: false, scrolls: scrollersOf(el) }
      : null;
  }, opt);
  addEventListener('touchmove', e => { const t = touchOf(e, press); if (t) follow(press!, t); }, opt);
  addEventListener('pointercancel', e => { if (press && e.pointerType === 'touch') press.cancelled = true; }, opt);
  addEventListener('touchcancel', () => { press = null; }, opt);
  addEventListener('contextmenu', () => { press = null; }, opt);
  addEventListener('touchend', e => {
    const p = press, t = touchOf(e, p);
    if (!p || !t) return;
    press = null;
    follow(p, t); p.ms = e.timeStamp - p.t0;
    // 스크롤로 넘어갔으면 (pointercancel) 브라우저 click은 오지 않으니 바로, 아니면 잠깐 기다렸다가
    if (p.cancelled) { decide(p); return; }
    waiting = p;
    waitTimer = window.setTimeout(() => { const w = waiting; stopWaiting(); if (w) decide(w); }, WAIT_MS);
  }, opt);
  addEventListener('click', e => {
    if (!e.isTrusted) return;
    if (waiting) { stopWaiting(); return; }
    if (lateUntil && e.detail > 0 && performance.now() < lateUntil) { lateUntil = 0; e.stopImmediatePropagation(); e.preventDefault(); }
  }, { capture: true });
}

function touchOf(e: TouchEvent, p: Press | null): Touch | null {
  if (!p) return null;
  for (const t of e.changedTouches) if (t.identifier === p.id) return t;
  return null;
}

function follow(p: Press, t: Touch): void {
  p.x = t.clientX; p.y = t.clientY;
  p.moved = Math.max(p.moved, Math.hypot(p.x - p.x0, p.y - p.y0));
}

function stopWaiting(): void { clearTimeout(waitTimer); waitTimer = 0; waiting = null; }

/** 버튼을 담은 칸들의 스크롤 위치 (움직였는지 비교용) */
function scrollersOf(el: Element): [Element, number, number][] {
  const out: [Element, number, number][] = [];
  for (let p: Element | null = el.parentElement; p; p = p.parentElement) {
    if (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth) out.push([p, p.scrollTop, p.scrollLeft]);
  }
  return out;
}

function decide(p: Press): void {
  const el = p.el;
  if (!el.isConnected || el.matches(':disabled')) return;
  const r = el.getBoundingClientRect();
  const inside = p.x >= r.left - EDGE && p.x <= r.right + EDGE && p.y >= r.top - EDGE && p.y <= r.bottom + EDGE;
  const scroll = Math.max(0, ...p.scrolls.map(([s, top, left]) => Math.hypot(s.scrollTop - top, s.scrollLeft - left)));
  if (!keepTap({ moved: p.moved, scroll, inside, ms: p.ms })) return;
  // 손 뗀 자리 (버튼 안으로 당김)에 버튼이 맨 위로 보일 때만: 그 사이 창 · 시트가 덮었으면 안 누름
  const inset = Math.min(6, r.width / 2, r.height / 2);
  const x = Math.min(Math.max(p.x, r.left + inset), r.right - inset), y = Math.min(Math.max(p.y, r.top + inset), r.bottom - inset);
  const hit = document.elementFromPoint(x, y);
  if (!hit || !el.contains(hit)) return;
  const target = el.contains(p.target) ? p.target : hit;
  lateUntil = performance.now() + LATE_MS;
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window, detail: 1, clientX: x, clientY: y, screenX: x, screenY: y }));
}
