/**
 * 버튼 터치 연출 (2026-10-20 Lim 「버튼 ui 터치시 클릭 연출 작업을 하자」): 모든 화면 · 전투 버튼이 쓰는 한 곳.
 * 누르는 순간 (pointerdown, 막지도 늦추지도 않음) 버튼이 살짝 작아지고 밝아지며 버튼 그림 모양 그대로 황동 빛이 번졌다 사라진다.
 * 빛은 filter (brightness + drop-shadow)라 그림 버튼 (출전 판 · 팻말 · 육각 탭)도 투명한 모서리 없이 그림 테두리를 따라간다.
 * 버튼 자기 filter는 앞에 그대로 두고 뒤에 붙이며, 작아짐은 CSS `scale` 속성 (transform과 따로 겹침)이라
 * 둘 다 Web Animations로 걸어 화면마다의 transition · animation · :active 규칙은 건드리지 않는다.
 * 전투 스킬 칸은 손 뗀 자리로 판정하므로 작아짐 없이 빛만. 화면 반 가까이 덮는 버튼은 누른 자리에 작은 빛 (#tapfx 층)만.
 * 「시각 효과 줄이기」 · 기기 「동작 줄이기」면 작아짐 · 번짐 없이 살짝 밝아지기만.
 */
const SEL = 'button, [role="button"], [role="tab"], a[href], summary';
const SKIP = 'input, textarea, select, [data-notap], #board';
const NO_SHRINK = '.slot, [data-noshrink]';
const HOLD_MS = 90;
const SHRINK = 0.965;
const GLOW_MS = 420;

let layer: HTMLDivElement | null = null;

export function mountTapFx(calm: () => boolean): void {
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(SEL);
    if (!el || el.closest(SKIP) || el.matches(':disabled, [aria-disabled="true"]') || typeof el.animate !== 'function') return;
    tap(el, e, calm());
  }, { capture: true, passive: true });
}

function tap(el: HTMLElement, e: PointerEvent, quiet: boolean): void {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return;
  if (r.width * r.height > 0.4 * innerWidth * innerHeight) { spot(e, quiet); return; }
  const f = getComputedStyle(el).filter, base = f && f !== 'none' ? `${f} ` : '';
  if (quiet) {
    el.animate([{ filter: `${base}brightness(1.15)` }, { filter: `${base}brightness(1)` }], { duration: 260, easing: 'ease-out' });
    return;
  }
  el.animate([
    { filter: `${base}brightness(1.32) drop-shadow(0 0 1.5px rgb(255 232 165 / 0.95)) drop-shadow(0 0 5px rgb(255 198 96 / 0.75))` },
    { filter: `${base}brightness(1.12) drop-shadow(0 0 2.5px rgb(255 232 165 / 0.6)) drop-shadow(0 0 11px rgb(255 198 96 / 0.4))`, offset: 0.35 },
    { filter: `${base}brightness(1) drop-shadow(0 0 3px rgb(255 232 165 / 0)) drop-shadow(0 0 16px rgb(255 198 96 / 0))` },
  ], { duration: GLOW_MS, easing: 'ease-out' });
  if (el.matches(NO_SHRINK)) return;
  const down = el.animate([{ scale: '1' }, { scale: String(SHRINK) }], { duration: 70, easing: 'ease-out', fill: 'forwards' });
  const t0 = performance.now();
  const up = () => {
    removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
    setTimeout(() => {
      const back = el.animate([{ scale: String(SHRINK) }, { scale: '1' }], { duration: 140, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      down.cancel(); back.onfinish = () => back.cancel();
    }, Math.max(0, HOLD_MS - (performance.now() - t0)));
  };
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
}

/** 화면을 거의 덮는 누름 칸 (타이틀 등): 누른 자리에 작은 황동 빛 하나 */
function spot(e: PointerEvent, quiet: boolean): void {
  layer ??= Object.assign(document.body.appendChild(document.createElement('div')), { id: 'tapfx' });
  const s = 84, fx = document.createElement('i');
  fx.className = `tapfx${quiet ? ' quiet' : ''}`;
  Object.assign(fx.style, { left: `${e.clientX - s / 2}px`, top: `${e.clientY - s / 2}px`, width: `${s}px`, height: `${s}px` });
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), GLOW_MS + 40);
}
