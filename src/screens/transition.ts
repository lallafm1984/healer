/**
 * 화면 전환 연출 (2026-10-24 Lim, A안 「햇빛 번짐」): 메뉴 화면이 바뀔 때 한 곳.
 * - 타이틀 → 로비 (0.8초): 해 문장에서 옅은 반투명 햇빛이 번져 화면에 퍼지고 (`titleBloom`), 빛이 걷히며 새 화면이 살짝 다가온다.
 * - 아래 메뉴 탭끼리 (0.18초): 위 정보창 · 아래 메뉴는 그대로, 가운데 내용만 누른 탭 쪽에서 미끄러져 떠오르고 고른 탭 소켓에 금빛 한 번.
 * - 하위 화면 (상점 · 행상인 · 임무 · 주간 도전 · 편성 · 설정, 0.22초): 화면째 오른쪽에서, 「←」로 돌아가면 왼쪽에서.
 * 위치 (transform) · 투명도만 움직여 폰이 화면을 다시 그리지 않는다. 전투 · 정비 · 결과 · 이야기 · 튜토리얼은 그대로.
 * 「시각 효과 줄이기」 · 기기 「동작 줄이기」면 0.12초 옅어지기만 (타이틀 금빛 없음).
 * Playwright (navigator.webdriver)는 연출 없음 (화면 테스트가 위치 · 투명도를 바로 잼), 검사는 `window.__screenFx = true`.
 */
import { setShiftHandler } from './kit';
import { TABS } from './tabs';

const SUB = new Set(['s-shop', 's-merchant', 's-missions', 's-entry', 's-party', 's-settings']);
const ROOTS = TABS.map(t => t.root);
const MENU = new Set([...ROOTS, ...SUB]);
const EASE = 'cubic-bezier(.2,.7,.2,1)';
/** 타이틀 금빛이 덮는 시간 · 걷히는 시간 · 새 화면이 다가오는 시간 (ms) */
const BLOOM_IN = 320, BLOOM_OUT = 460, SETTLE = 560;
const TAB_MS = 180, TAB_SHIFT = 18, SUB_MS = 220, SUB_SHIFT = 36, CALM_MS = 120, GLINT_MS = 340;

let calm: () => boolean = () => false;
let running: Animation[] = [];

const off = (): boolean => navigator.webdriver && !(window as unknown as { __screenFx?: boolean }).__screenFx;
const motionOk = (): boolean => typeof Element.prototype.animate === 'function' && !off();

export function mountScreenFx(isCalm: () => boolean): void {
  calm = isCalm;
  setShiftHandler(shift);
}

/** kit.go가 새 화면을 보인 뒤 부름 (from = 바로 앞 화면, back = 머리 「←」) */
function shift(from: string, to: string, back: boolean): void {
  if (!from || from === to || !motionOk()) return;
  running.forEach(a => a.cancel());
  running = [];
  const el = document.getElementById(to);
  if (!el) return;
  if (from === 's-title') { settle(el); return; }
  if (!MENU.has(from) || !MENU.has(to)) return;
  const a = ROOTS.indexOf(from), b = ROOTS.indexOf(to);
  if (a >= 0 && b >= 0) tab(el, Math.sign(b - a));
  else push(el, back ? -1 : 1);
}

const play = (node: Element, frames: Keyframe[], duration: number, easing = EASE): Animation => {
  const anim = node.animate(frames, { duration, easing });
  running.push(anim);
  anim.onfinish = anim.oncancel = () => { running = running.filter(x => x !== anim); };
  return anim;
};
const fadeIn: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

/** 탭끼리: 머리 (.topbar)를 뺀 내용만 */
function tab(el: HTMLElement, dir: number): void {
  const parts = [...el.children].filter(c => !c.classList.contains('topbar'));
  if (calm()) { parts.forEach(p => play(p, fadeIn, CALM_MS, 'linear')); return; }
  const frames: Keyframe[] = [{ transform: `translateX(${dir * TAB_SHIFT}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }];
  parts.forEach(p => play(p, frames, TAB_MS));
  glint();
}

/** 하위 화면: 화면째, 들어갈 때 오른쪽 · 돌아갈 때 왼쪽에서 */
function push(el: HTMLElement, dir: number): void {
  if (calm()) { play(el, fadeIn, CALM_MS, 'linear'); return; }
  play(el, [{ transform: `translateX(${dir * SUB_SHIFT}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], SUB_MS);
}

/** 타이틀 금빛 뒤 새 화면이 살짝 다가옴 */
function settle(el: HTMLElement): void {
  if (calm()) { play(el, fadeIn, CALM_MS, 'linear'); return; }
  play(el, [{ transform: 'scale(1.045)' }, { transform: 'none' }], SETTLE);
}

/** 고른 탭 소켓에 금빛 한 번 (#tabs 자식: 화면 enter가 탭을 다시 그려도 남음) */
function glint(): void {
  const nav = document.getElementById('tabs'), sock = nav?.querySelector('button[aria-current="page"] .tab-sock');
  if (!nav || !sock) return;
  const n = nav.getBoundingClientRect(), r = sock.getBoundingClientRect();
  const g = nav.appendChild(document.createElement('i'));
  g.className = 'xf-glint';
  g.setAttribute('aria-hidden', 'true');
  g.style.left = `${r.left + r.width / 2 - n.left}px`;
  g.style.top = `${r.top + r.height / 2 - n.top}px`;
  const anim = g.animate([
    { transform: 'scale(.5)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1, offset: 0.35 },
    { transform: 'scale(1.25)', opacity: 0 },
  ], { duration: GLINT_MS, easing: 'ease-out' });
  anim.onfinish = anim.oncancel = () => g.remove();
}

/**
 * 타이틀을 누름: 해 문장에서 햇빛이 번져 화면에 다 퍼진 뒤 `done` (로비 · 이야기로 감), 그다음 빛이 걷힘. 빛은 다 퍼져도 반투명 (색은 transition.css).
 * 연출이 없으면 (동작 줄이기 · 화면 테스트) 바로 `done`. 빛이 다 덮기 전에 다시 눌러도 한 번만.
 */
export function titleBloom(emblem: Element | null, done: () => void): void {
  const host = document.getElementById('viewport');
  if (!motionOk() || calm() || !host) { done(); return; }
  const vr = host.getBoundingClientRect(), er = emblem?.getBoundingClientRect();
  const x = er && er.width ? er.left + er.width / 2 - vr.left : vr.width / 2;
  const y = er && er.height ? er.top + er.height / 2 - vr.top : vr.height * 0.15;
  const layer = host.appendChild(document.createElement('div'));
  layer.className = 'xf-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('--xf-x', `${x}px`);
  layer.style.setProperty('--xf-y', `${y}px`);
  layer.innerHTML = '<i class="xf-veil"></i><i class="xf-glow"></i>';
  const [veil, glow] = [...layer.children];
  let fired = false;
  const peak = () => {
    if (fired) return;
    fired = true;
    done();
    const out = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BLOOM_OUT, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    out.onfinish = out.oncancel = () => layer.remove();
  };
  glow.animate([
    { transform: 'scale(.25)', opacity: 0 },
    { transform: 'scale(1.6)', opacity: 1, offset: 0.5 },
    { transform: 'scale(2.6)', opacity: 1 },
  ], { duration: BLOOM_IN, easing: 'cubic-bezier(.4,0,.8,.5)', fill: 'forwards' });
  const veilIn = veil.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 1 }], { duration: BLOOM_IN, easing: 'cubic-bezier(.55,0,.85,.45)', fill: 'forwards' });
  veilIn.onfinish = veilIn.oncancel = peak;
  setTimeout(peak, BLOOM_IN + 400); // 앱이 뒤로 가 애니메이션이 멈춰도 타이틀에 갇히지 않게
}
