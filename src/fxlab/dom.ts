// 개발용 이펙트 화면 (fx.html): 작은 DOM 도우미 (화면 틀 없이 바로 만듦)
type Kid = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

/** h('button', { class: 'x', onclick: fn, title: '…' }, '글자') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k in el && k !== 'list') (el as unknown as Props)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(typeof c === 'number' ? String(c) : c);
  return el;
}
const SVG = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number | undefined> = {}, ...kids: (Node | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}
export const clear = (el: Element): void => { el.replaceChildren(); };
/** localStorage (막혀 있어도 화면은 돌게) */
export const prefs = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(`fxlab.${k}`); return v === null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown): void { try { localStorage.setItem(`fxlab.${k}`, JSON.stringify(v)); } catch { /* 저장 못 해도 됨 */ } },
  del(k: string): void { try { localStorage.removeItem(`fxlab.${k}`); } catch { /* 저장 못 해도 됨 */ } },
};
/** 잠깐 뜨는 알림 */
export function toast(text: string, kind: 'ok' | 'err' | 'info' = 'info', ms = 3200): void {
  let box = document.getElementById('fxToasts');
  if (!box) { box = h('div', { id: 'fxToasts' }); document.body.append(box); }
  const t = h('div', { class: `fx-toast ${kind}`, role: 'status' }, text);
  box.append(t);
  setTimeout(() => t.remove(), ms);
}
