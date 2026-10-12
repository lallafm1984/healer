// 개발용 이펙트 화면 (fx.html)의 그래프 고치기 (화면 없이 그래프만 다룸, tests/fxlab.test.ts).
// 그래프는 공방 형식 pxf.graph@1 그대로: 여기서 고친 그래프는 공방에 붙여 넣어도, scripts/fxr.mjs로 구워도 같다.
import type { Animated, Contract, Keyframe, ParamSpec, PxfGraph, PxfNode } from '../../scripts/fxr/render.mjs';
import { INT_PARAMS, paramAt, PIXEL_PARAMS } from '../../scripts/fxr/render.mjs';

export const SIZES = [32, 48, 64, 96, 128] as const;
export const EASES = ['linear', 'in', 'out', 'inout', 'in3', 'out3', 'pulse', 'wave', 'step'] as const;
export const EASE_LABEL: Record<string, string> = {
  linear: '고르게', in: '천천히 시작', out: '천천히 멈춤', inout: '천천히 시작 · 멈춤', in3: '아주 천천히 시작', out3: '아주 천천히 멈춤',
  pulse: '올랐다 돌아옴', wave: '출렁임', step: '뚝 바뀜',
};
/** 노드 더하기 목록 (공방 노드 29종) */
export const CATEGORIES: { label: string; types: string[] }[] = [
  { label: '그리기', types: ['Shape', 'Stroke', 'Arc', 'Particles', 'Lightning', 'Spike', 'Noise', 'Gradient', 'Checker', 'Grid'] },
  { label: '움직이기 · 바꾸기', types: ['Transform', 'Repeat', 'Echo', 'Displace', 'Polar', 'Pixelate', 'Revolve', 'AuraShell'] },
  { label: '합치기 · 다듬기', types: ['Blend', 'Mask', 'Blur', 'Glow', 'Levels', 'Dither'] },
  { label: '색', types: ['Palette', 'Tint', 'Outline', 'Quantize'] },
  { label: '출력', types: ['Output'] },
];
const ID = /^[A-Za-z0-9_-]+$/;

export type ParamMode = 'fixed' | 'keys' | 'range';
type KeyAnim = { k: Keyframe[] };
type RangeAnim = { a: number; b: number; e?: string; t0?: number; t1?: number };

export const clone = <T>(v: T): T => structuredClone(v);
export const isAnimated = (v: unknown): v is Animated => !!v && typeof v === 'object' && !Array.isArray(v);
export const paramMode = (v: unknown): ParamMode => (!isAnimated(v) ? 'fixed' : 'k' in v ? 'keys' : 'range');
const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

/** 새 그래프: 커지며 사라지는 동그라미 하나 (도형 → 팔레트 → 출력) */
export function newGraph(name = '새 이펙트'): PxfGraph {
  return {
    format: 'pxf.graph@1', name,
    settings: { size: 64, frames: 16, fps: 24, loop: false },
    nodes: [
      { id: 'orb', type: 'Shape', x: 40, y: 40, params: { shape: 'ring', size: { k: [[0, 4, 'out'], [12, 26]] }, falloff: 0.4, intensity: { k: [[0, 1], [9, 1, 'in'], [15, 0]] } } },
      { id: 'pal', type: 'Palette', x: 270, y: 40, params: { colors: ['#26304a', '#6cc4f0', '#f0b840', '#fff0b8', '#ffffff'], cutoff: 0.06 } },
      { id: 'out', type: 'Output', x: 500, y: 40, params: {} },
    ],
    links: [{ f: 'orb', t: 'pal', p: 0 }, { f: 'pal', t: 'out', p: 0 }],
    game: { pivot: [0.5, 0.5], logicalSize: 64, blend: 'normal', impactFrame: 1, referenceCell: 62 },
  };
}

/** 노드 종류에서 새 id (shape, shape2 …) */
export function nextId(g: PxfGraph, type: string): string {
  const base = type.charAt(0).toLowerCase() + type.slice(1), used = new Set(g.nodes.map(n => n.id));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}
/** (x, y)에서 아래로 내려가며 다른 노드와 안 겹치는 자리 (노드 그림 168×90 기준) */
export function freeSpot(g: PxfGraph, x: number, y: number): { x: number; y: number } {
  let yy = Math.round(y / 10) * 10;
  const xx = Math.round(x / 10) * 10;
  while (g.nodes.some(n => Math.abs(n.x - xx) < 176 && Math.abs(n.y - yy) < 96)) yy += 40;
  return { x: xx, y: yy };
}
export function addNode(g: PxfGraph, type: string, at: { x: number; y: number }): string {
  const id = nextId(g, type), p = freeSpot(g, at.x, at.y);
  g.nodes.push({ id, type, x: p.x, y: p.y, params: {} });
  return id;
}
export function removeNode(g: PxfGraph, id: string): void {
  g.nodes = g.nodes.filter(n => n.id !== id);
  g.links = g.links.filter(l => l.f !== id && l.t !== id);
}
export function duplicateNode(g: PxfGraph, id: string): string | null {
  const n = g.nodes.find(x => x.id === id);
  if (!n) return null;
  const nid = nextId(g, n.type);
  g.nodes.push({ ...clone(n), id: nid, x: n.x + 30, y: n.y + 30 });
  return nid;
}
/** 이름 바꾸기 (연결도 같이). 틀리면 이유 */
export function renameNode(g: PxfGraph, from: string, to: string): string | null {
  if (from === to) return null;
  if (!ID.test(to)) return 'id는 영문 · 숫자 · _ · -만';
  if (g.nodes.some(n => n.id === to)) return '이미 있는 id';
  const n = g.nodes.find(x => x.id === from);
  if (!n) return '없는 노드';
  n.id = to;
  for (const l of g.links) { if (l.f === from) l.f = to; if (l.t === from) l.t = to; }
  return null;
}

/** id에서 나가는 연결을 따라 닿는 노드들 */
export function downstream(g: PxfGraph, id: string): Set<string> {
  const seen = new Set<string>(), stack = [id];
  while (stack.length) { const c = stack.pop()!; for (const l of g.links) if (l.f === c && !seen.has(l.t)) { seen.add(l.t); stack.push(l.t); } }
  return seen;
}
/** id로 들어오는 연결을 거슬러 닿는 노드들 */
export function upstream(g: PxfGraph, id: string): Set<string> {
  const seen = new Set<string>(), stack = [id];
  while (stack.length) { const c = stack.pop()!; for (const l of g.links) if (l.t === c && !seen.has(l.f)) { seen.add(l.f); stack.push(l.f); } }
  return seen;
}
/** from → to 입력 port 연결 (그 입력의 예전 연결은 뺌). 순환이 생기면 false */
export function connect(g: PxfGraph, from: string, to: string, port: number): boolean {
  if (from === to || downstream(g, to).has(from)) return false;
  g.links = g.links.filter(l => !(l.t === to && l.p === port));
  g.links.push({ f: from, t: to, p: port });
  return true;
}
export function disconnect(g: PxfGraph, to: string, port: number): void {
  g.links = g.links.filter(l => !(l.t === to && l.p === port));
}

/** 값 하나 바꾸기 (undefined = 지워서 계약 기본값) */
export function setParam(g: PxfGraph, id: string, key: string, value: unknown): void {
  const n = g.nodes.find(x => x.id === id);
  if (!n) return;
  if (value === undefined) delete n.params[key];
  else n.params[key] = value;
}

const fit = (spec: ParamSpec, v: number) => {
  let x = Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, v));
  if (spec.type === 'int') x = Math.round(x);
  return round(x);
};
/** 고정 · 키프레임 · 구간 바꾸기. 고정으로 돌아갈 땐 지금 프레임 값 */
export function toMode(v: unknown, mode: ParamMode, spec: ParamSpec, frames: number, frame: number): unknown {
  const cur = mode === paramMode(v) ? v : undefined;
  if (cur !== undefined) return cur;
  const now = Number(paramAt(v ?? spec.default, frame, frames));
  if (mode === 'fixed') return fit(spec, now);
  const last = Math.max(0, frames - 1);
  if (mode === 'keys') {
    if (paramMode(v) === 'range') {
      const r = v as RangeAnim, f0 = round((r.t0 ?? 0) * frames, 2), f1 = Math.min(last, round((r.t1 ?? 1) * frames, 2));
      return f1 > f0 ? { k: [[f0, r.a, r.e ?? 'linear'], [f1, r.b]] } : { k: [[f0, r.a]] };
    }
    return { k: last > 0 ? [[0, now, 'linear'], [last, now]] : [[0, now]] };
  }
  if (paramMode(v) === 'keys') {
    const k = (v as KeyAnim).k, a = k[0], b = k[k.length - 1];
    return { a: a[1], b: b[1], e: a[2] ?? 'linear', t0: round(a[0] / frames), t1: round(Math.min(1, b[0] / frames)) };
  }
  return { a: now, b: now, e: 'linear', t0: 0, t1: 1 };
}
/** 키프레임 더하기 (같은 프레임이면 값만 바꿈) */
export function addKey(v: KeyAnim, frame: number, value: number, ease = 'linear'): KeyAnim {
  const k = v.k.filter(e => e[0] !== frame);
  k.push([frame, value, ease]);
  k.sort((a, b) => a[0] - b[0]);
  return { k: k.map((e, i) => (i === k.length - 1 ? [e[0], e[1]] : e)) as Keyframe[] };
}
/** 키프레임 하나 빼기 (마지막 하나면 그 값으로 고정) */
export function removeKey(v: KeyAnim, i: number): unknown {
  const k = v.k.filter((_, j) => j !== i);
  return k.length ? { k } : v.k[0][1];
}
/** 키프레임 한 줄 고치기 (프레임 순서는 다시 맞춤) */
export function setKey(v: KeyAnim, i: number, key: Keyframe): KeyAnim {
  const k = v.k.map((e, j) => (j === i ? key : e));
  k.sort((a, b) => a[0] - b[0]);
  return { k };
}

/** 프레임 수 바꾸기: 키프레임 · 맞는 순간도 같은 비율로 (keys = false면 그대로) */
export function retime(g: PxfGraph, frames: number, keys = true): void {
  const old = g.settings.frames;
  g.settings.frames = frames;
  if (g.game?.impactFrame !== undefined) g.game.impactFrame = Math.min(frames - 1, Math.round((g.game.impactFrame * Math.max(1, frames - 1)) / Math.max(1, old - 1)));
  if (!keys || old === frames) return;
  const s = (frames - 1) / Math.max(1, old - 1);
  for (const n of g.nodes) for (const [key, v] of Object.entries(n.params)) {
    if (paramMode(v) !== 'keys') continue;
    const out: Keyframe[] = [];
    for (const e of (v as KeyAnim).k) {
      const f = Math.min(frames - 1, round(e[0] * s, 2));
      if (out.length && out[out.length - 1][0] >= f) out[out.length - 1] = [f, e[1], ...e.slice(2)] as Keyframe;
      else out.push([f, e[1], ...e.slice(2)] as Keyframe);
    }
    n.params[key] = { k: out };
  }
}

/** 캔버스 크기 바꾸기: 픽셀 단위 값을 같은 비율로 (scalePx = false면 그대로). 범위 밖이라 잘린 값 목록 */
export function resize(g: PxfGraph, size: number, contract: Contract, scalePx = true): string[] {
  const k = size / g.settings.size, clipped: string[] = [];
  g.settings.size = size;
  if (!scalePx || k === 1) return clipped;
  for (const n of g.nodes) {
    const spec = contract.nodes[n.type]?.params ?? {};
    for (const key of PIXEL_PARAMS[n.type] ?? []) {
      const ps = spec[key];
      if (!ps) continue;
      const isInt = INT_PARAMS.has(`${n.type}.${key}`) || ps.type === 'int';
      const f = (x: number) => {
        let y = x * k;
        if (isInt) y = Math.max(1, Math.round(y));
        const z = fit(ps, y);
        if (Math.abs(z - y) > 1e-6) clipped.push(`${n.id}.${key}`);
        return z;
      };
      const v = n.params[key] ?? ps.default;
      n.params[key] = paramMode(v) === 'keys' ? { k: (v as KeyAnim).k.map(e => [e[0], f(e[1]), ...e.slice(2)]) }
        : paramMode(v) === 'range' ? { ...(v as RangeAnim), a: f((v as RangeAnim).a), b: f((v as RangeAnim).b) } : f(Number(v));
    }
  }
  return [...new Set(clipped)];
}

/** 노드 하나만 보기: 그 노드까지 거슬러 가는 노드 + 부드러운 출력 */
export function previewGraph(g: PxfGraph, id: string): PxfGraph {
  const keep = upstream(g, id);
  keep.add(id);
  const node = g.nodes.find(n => n.id === id);
  if (node?.type === 'Output') return g;
  const out = '__preview';
  return {
    ...g,
    nodes: [...g.nodes.filter(n => keep.has(n.id)), { id: out, type: 'Output', x: 0, y: 0, params: { alpha: 'soft', threshold: 0.02 } }],
    links: [...g.links.filter(l => keep.has(l.f) && keep.has(l.t)), { f: id, t: out, p: 0 }],
  };
}

/** 자리 (x · y)가 없거나 겹친 그래프를 출력까지 거리로 줄 세움 */
export function autoLayout(g: PxfGraph): void {
  const out = g.nodes.find(n => n.type === 'Output');
  const depth = new Map<string, number>();
  const walk = (id: string, d: number) => {
    if ((depth.get(id) ?? -1) >= d || d > g.nodes.length) return;
    depth.set(id, d);
    for (const l of g.links) if (l.t === id) walk(l.f, d + 1);
  };
  if (out) walk(out.id, 0);
  // 출력이 맨 오른쪽, 출력에 안 닿는 노드는 맨 왼쪽 줄
  const max = Math.max(0, ...depth.values()), rows = new Map<number, number>();
  for (const n of g.nodes) {
    const d = depth.get(n.id), col = d === undefined ? 0 : max - d, r = rows.get(col) ?? 0;
    rows.set(col, r + 1);
    n.x = 40 + col * 230;
    n.y = 40 + r * 170;
  }
}
export const needsLayout = (g: PxfGraph): boolean => {
  const seen = new Set<string>();
  for (const n of g.nodes) {
    if (typeof n.x !== 'number' || typeof n.y !== 'number') return true;
    const key = `${Math.round(n.x / 20)},${Math.round(n.y / 20)}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};

export interface Check { level: 'warn' | 'info'; text: string }
/** 그린 프레임 살펴보기: 끝에 남는 그림 · 가장자리 잘림 (edges, 판 전체 공격은 원래 닿음) · 맞는 순간 빈 프레임 · 색 수 */
export function renderChecks(frames: Uint8ClampedArray[], size: number, g: PxfGraph, edges = true): Check[] {
  const out: Check[] = [], edge: number[] = [], empty: number[] = [], colors = new Set<number>();
  frames.forEach((fr, f) => {
    let any = false, touch = false;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!fr[i + 3]) continue;
      any = true;
      if (colors.size < 4096) colors.add((fr[i] << 16) | (fr[i + 1] << 8) | fr[i + 2]);
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) touch = true;
    }
    if (!any) empty.push(f);
    if (touch) edge.push(f);
  });
  const list = (a: number[]) => (a.length > 6 ? `${a.slice(0, 6).join(', ')} …` : a.join(', '));
  if (empty.length === frames.length) out.push({ level: 'warn', text: '그림이 하나도 없음' });
  else {
    if (!g.settings.loop && !empty.includes(frames.length - 1)) out.push({ level: 'warn', text: '마지막 프레임에 그림이 남음: 반복 안 하는 이펙트는 끝에서 뚝 끊겨 보임' });
    const imp = g.game?.impactFrame;
    if (imp !== undefined && empty.includes(imp)) out.push({ level: 'warn', text: `맞는 순간 프레임 (${imp})이 비어 있음` });
    if (edges && edge.length) out.push({ level: 'warn', text: `가장자리에 닿음 (프레임 ${list(edge)}): 게임 칸에서 잘려 보일 수 있음` });
  }
  out.push({ level: 'info', text: `색 ${colors.size >= 4096 ? '4096+' : colors.size}가지 · 빈 프레임 ${empty.length}장` });
  return out;
}

/** 노드 이름 (계약 한국어 이름) */
export const nodeLabel = (contract: Contract, type: string): string => contract.nodes[type]?.label ?? type;
export type { PxfGraph, PxfNode };

/** 고른 노드 뒤에 새 노드 끼우기: 고른 노드 → 새 노드 (입력 0) → 고른 노드가 가던 곳 */
export function insertAfter(g: PxfGraph, after: string, id: string, inputs: number): void {
  if (!inputs || after === id) return;
  const outs = g.links.filter(l => l.f === after);
  g.links = g.links.filter(l => l.f !== after);
  g.links.push({ f: after, t: id, p: 0 });
  for (const l of outs) g.links.push({ f: id, t: l.t, p: l.p });
}
