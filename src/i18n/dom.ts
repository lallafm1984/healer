/**
 * index.html의 정적 한국어 글 (전투 · 정비 화면 · 배너 자리)을 지금 언어로 (기획 121 2장). 원문은 WeakMap에 두고 (DOM에 data-* 속성을 더하지 않음:
 * 한국어 스냅샷이 HTML을 그대로 비교) 언어가 바뀌면 원문에서 다시. 한국어면 같은 글이라 DOM을 건드리지 않는다.
 * 화면 모듈이 다시 쓰는 글 (textContent · innerHTML)은 그 모듈이 t()를 쓴다.
 */
import { onLangChange, t } from './index';

const H = /[가-힣]/;
const ATTRS = ['aria-label', 'title', 'placeholder'] as const;
const textKo = new WeakMap<Text, string>();
const attrKo = new WeakMap<Element, Partial<Record<(typeof ATTRS)[number], string>>>();

export function translateStatic(root: ParentNode): void {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    let ko = textKo.get(n);
    if (ko == null) { if (!H.test(n.data)) continue; ko = n.data; textKo.set(n, ko); }
    // 앞뒤 공백 · 줄바꿈은 두고 글만
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(ko)!;
    const next = m[1] + t(m[2]) + m[3];
    if (n.data !== next) n.data = next;
  }
  for (const el of (root as Element).querySelectorAll(ATTRS.map(a => `[${a}]`).join(','))) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null) continue;
      let rec = attrKo.get(el);
      let ko = rec?.[a];
      if (ko == null) { if (!H.test(v)) continue; ko = v; rec = rec ?? {}; rec[a] = ko; attrKo.set(el, rec); }
      const next = t(ko);
      if (v !== next) el.setAttribute(a, next);
    }
  }
}

/** 앱 시작 (main.ts): 정적 글을 지금 언어로, 언어가 바뀌면 다시 */
export function mountI18n(): void {
  const run = () => ['adBanner', 'rest', 'battle'].forEach(id => { const el = document.getElementById(id); if (el) translateStatic(el); });
  run();
  onLangChange(run);
}
