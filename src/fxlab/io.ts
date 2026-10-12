// 개발용 이펙트 공방: 개발 서버 창구 (/__fx) 읽기 · 쓰기, 확인 창, 내려받기
import { h } from './dom';

export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}
export async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `${r.status}`);
  return j;
}
/** 확인 창 (버튼 값, 닫으면 null) */
export function ask(title: string, body: (Node | string)[], buttons: { label: string; value: string; kind?: string }[]): Promise<string | null> {
  return new Promise(ok => {
    const d = h('dialog', { class: 'fx-dialog', 'aria-labelledby': 'fxDlgTitle' },
      h('form', { method: 'dialog' }, h('h2', { id: 'fxDlgTitle' }, title), h('div', { class: 'fx-dlg-body' }, ...body),
        h('div', { class: 'fx-dlg-btns' }, h('button', { class: 'fx-btn', value: '' }, '취소'), ...buttons.map(b => h('button', { class: `fx-btn ${b.kind ?? ''}`, value: b.value }, b.label)))));
    d.addEventListener('close', () => { ok(d.returnValue || null); d.remove(); });
    document.body.append(d);
    d.showModal();
  });
}
export function download(name: string, blob: Blob): void {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
