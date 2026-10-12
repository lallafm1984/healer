// 개발용 이펙트 공방: 숫자 값 하나를 고정 · 키프레임 · 구간으로 고치는 칸 (이펙트 노드 값 · 캐릭터 뼈대 움직임이 같이 씀)
import type { Keyframe, ParamSpec } from '../../scripts/fxr/render.mjs';
import { paramAt } from '../../scripts/fxr/render.mjs';
import { h, toast } from './dom';
import { addKey, EASE_LABEL, EASES, paramMode, type ParamMode, removeKey, setKey, toMode } from './graph-edit';

type KeyAnim = { k: Keyframe[] };
type RangeAnim = { a: number; b: number; e?: string; t0?: number; t1?: number };
export type Setter = (x: unknown, live?: boolean) => void;
export interface AnimCtx {
  frames: number;
  frame: () => number;
  setFrame: (f: number) => void;
  /** 곡선에 금색 세로줄 (맞는 순간) */
  mark?: number;
  /** 프레임이 바뀌면 다시 그릴 것들 (곡선 위 지금 자리 · 지금 값) */
  cursors: (() => void)[];
  /** 고친 값이 틀려 칸을 되돌릴 때 */
  rerender: () => void;
}

export const stepOf = (ps: ParamSpec): number => {
  if (ps.type === 'int' || ps.type === 'seed') return 1;
  const span = (ps.max ?? 1) - (ps.min ?? 0);
  return span <= 2 ? 0.01 : span <= 20 ? 0.05 : span <= 200 ? 0.5 : 1;
};
export const fmt = (v: number): string => String(Math.round(v * 1000) / 1000);

export function numInput(ps: ParamSpec, value: number, onChange: (x: number) => void, label: string, range?: { min: number; max: number; step: number }): HTMLInputElement {
  const el = h('input', { type: 'number', step: 'any', value: fmt(value), min: range?.min ?? ps.min, max: range?.max ?? ps.max, 'aria-label': label });
  el.addEventListener('change', () => {
    const x = Number(el.value);
    if (!Number.isFinite(x)) { el.value = fmt(value); return; }
    const lo = range?.min ?? ps.min ?? -Infinity, hi = range?.max ?? ps.max ?? Infinity;
    let y = Math.min(hi, Math.max(lo, x));
    if (ps.type === 'int' && !range) y = Math.round(y);
    el.value = fmt(y);
    onChange(y);
  });
  return el;
}

/** [고정 | 키 | 구간] */
export function modeSeg(v: unknown, ps: ParamSpec, key: string, ctx: AnimCtx, set: Setter): HTMLElement {
  const mode = paramMode(v);
  return h('div', { class: 'fx-seg', role: 'group', 'aria-label': `${key} 방식` }, ...(['fixed', 'keys', 'range'] as ParamMode[]).map(m =>
    h('button', { type: 'button', class: m === mode ? 'on' : '', title: m === 'fixed' ? '고정값' : m === 'keys' ? '키프레임: 프레임마다 값' : '구간: 시간 t0–t1 동안 a→b',
      onclick: () => { if (m !== mode) set(toMode(v, m, ps, ctx.frames, ctx.frame())); } }, m === 'fixed' ? '고정' : m === 'keys' ? '키' : '구간')));
}

/** 숫자 값 칸: 방식에 따라 슬라이더 · 키프레임 목록 · 구간 */
export function numericBody(v: unknown, ps: ParamSpec, key: string, ctx: AnimCtx, set: Setter): HTMLElement {
  const mode = paramMode(v);
  if (mode === 'keys') return keysEditor(key, ps, v as KeyAnim, ctx, set);
  if (mode === 'range') return rangeEditor(key, ps, v as RangeAnim, ctx, set);
  const x = Number(v), rng = h('input', { type: 'range', min: ps.min, max: ps.max, step: stepOf(ps), value: x, 'aria-label': key });
  const num = numInput(ps, x, y => { rng.value = String(y); set(y); }, key);
  rng.addEventListener('input', () => { num.value = rng.value; set(Number(rng.value), true); });
  return h('div', { class: 'prm-body num' }, rng, num);
}

/** 프레임마다 값 곡선 (눌러서 그 프레임으로) */
export function curve(v: unknown, keys: number[], ctx: AnimCtx): HTMLElement {
  const frames = ctx.frames, cv = h('canvas', { class: 'prm-curve', width: 300, height: 52, title: '눌러서 그 프레임으로' });
  const now = h('span', { class: 'prm-now' });
  const samples = Array.from({ length: frames * 4 + 1 }, (_, i) => Number(paramAt(v, i / 4, frames)));
  let lo = Math.min(...samples), hi = Math.max(...samples);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const X = (f: number) => 6 + (f / Math.max(1, frames - 1)) * 288, Y = (x: number) => 46 - ((x - lo) / (hi - lo)) * 40;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, 300, 52);
    g.strokeStyle = '#3a404c'; g.lineWidth = 1;
    for (let f = 0; f < frames; f++) { g.beginPath(); g.moveTo(X(f) + 0.5, 4); g.lineTo(X(f) + 0.5, 48); g.stroke(); }
    if (ctx.mark !== undefined) { g.strokeStyle = '#8a6a24'; g.beginPath(); g.moveTo(X(ctx.mark) + 0.5, 2); g.lineTo(X(ctx.mark) + 0.5, 50); g.stroke(); }
    g.strokeStyle = '#6cc4f0'; g.lineWidth = 2; g.beginPath();
    samples.forEach((s, i) => { const x = X(i / 4), y = Y(s); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = '#f0b840';
    for (const f of keys) { g.beginPath(); g.arc(X(f), Y(Number(paramAt(v, f, frames))), 3.5, 0, Math.PI * 2); g.fill(); }
    const f = ctx.frame();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(f) + 0.5, 0); g.lineTo(X(f) + 0.5, 52); g.stroke();
    now.textContent = `지금 (프레임 ${f}): ${fmt(Number(paramAt(v, f, frames)))}`;
  };
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 300;
    ctx.setFrame(Math.round(((x - 6) / 288) * (frames - 1)));
  });
  draw();
  ctx.cursors.push(draw);
  return h('div', { class: 'prm-curve-wrap' }, cv, h('div', { class: 'prm-range' }, h('span', {}, `${fmt(lo)} – ${fmt(hi)}`), now));
}

export function keysEditor(key: string, ps: ParamSpec, v: KeyAnim, ctx: AnimCtx, set: Setter): HTMLElement {
  const frames = ctx.frames;
  const rows = v.k.map((e, i) => {
    const last = i === v.k.length - 1;
    const fIn = numInput(ps, e[0], f => {
      if (v.k.some((o, j) => j !== i && o[0] === f)) { toast(`프레임 ${f}에 이미 키가 있음`, 'err'); ctx.rerender(); return; }
      set(setKey(v, i, [f, e[1], ...e.slice(2)] as Keyframe));
    }, `${key} ${i + 1}번째 키 프레임`, { min: 0, max: frames - 1, step: 1 });
    const vIn = numInput(ps, e[1], x => set(setKey(v, i, [e[0], x, ...e.slice(2)] as Keyframe)), `${key} ${i + 1}번째 키 값`);
    const ease = last ? h('span', { class: 'fx-muted small' }, '끝') : h('select', { 'aria-label': `${key} ${i + 1}번째 키 이징`, title: '다음 키까지 바뀌는 모양' },
      ...EASES.map(x => h('option', { value: x, selected: (e[2] ?? 'linear') === x }, EASE_LABEL[x])));
    if (ease instanceof HTMLSelectElement) ease.addEventListener('change', () => set(setKey(v, i, [e[0], e[1], ease.value])));
    return h('div', { class: 'key-row' }, h('button', { type: 'button', class: 'key-go', title: '이 프레임으로', onclick: () => ctx.setFrame(Math.round(e[0])) }, '◆'), fIn, vIn, ease,
      h('button', { class: 'fx-btn tiny', type: 'button', title: '이 키 빼기', onclick: () => set(removeKey(v, i)) }, '×'));
  });
  const label = () => `+ 지금 프레임 (${ctx.frame()})에 키`;
  const at = h('button', { class: 'fx-btn', type: 'button', onclick: () => {
    const cur = Number(paramAt(v, ctx.frame(), frames));
    set(addKey(v, ctx.frame(), ps.type === 'int' ? Math.round(cur) : Math.round(cur * 1000) / 1000));
  } }, label());
  ctx.cursors.push(() => { at.textContent = label(); });
  return h('div', { class: 'prm-body keys' }, curve(v, v.k.map(e => e[0]), ctx),
    h('div', { class: 'key-head' }, h('span', {}, ''), h('span', {}, '프레임'), h('span', {}, '값'), h('span', {}, '다음까지'), h('span', {}, '')), ...rows, at);
}

export function rangeEditor(key: string, ps: ParamSpec, v: RangeAnim, ctx: AnimCtx, set: Setter): HTMLElement {
  const put = (patch: Partial<RangeAnim>) => set({ ...v, ...patch });
  const t = { min: 0, max: 1, step: 0.01 };
  const ease = h('select', { 'aria-label': `${key} 이징` }, ...EASES.map(x => h('option', { value: x, selected: (v.e ?? 'linear') === x }, EASE_LABEL[x])));
  ease.addEventListener('change', () => put({ e: ease.value }));
  return h('div', { class: 'prm-body range' }, curve(v, [], ctx),
    h('div', { class: 'range-grid' },
      h('label', {}, h('span', {}, '처음 a'), numInput(ps, v.a, a => put({ a }), `${key} a`)),
      h('label', {}, h('span', {}, '끝 b'), numInput(ps, v.b, b => put({ b }), `${key} b`)),
      h('label', {}, h('span', {}, '시작 t0'), numInput(ps, v.t0 ?? 0, t0 => put({ t0 }), `${key} t0`, t)),
      h('label', {}, h('span', {}, '끝 t1'), numInput(ps, v.t1 ?? 1, t1 => put({ t1 }), `${key} t1`, t)),
      h('label', { class: 'span2' }, h('span', {}, '바뀌는 모양'), ease)),
    h('p', { class: 'fx-muted small' }, `t = 프레임 ÷ ${ctx.frames} (장 수)`));
}
