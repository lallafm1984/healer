// 도트 캐릭터 (healer.char@1) 고치기: 기본 캐릭터 · 기본 모션 · 부품 픽셀 · 뼈대 키 · 프레임 손질 (화면 없이, tests/fxlab-char.test.ts).
// 형식 설명 · 그리기는 scripts/fxr/char.mjs.
import type { Channel, CharAnim, CharDoc, CharMotion, CharPart } from '../../../scripts/fxr/char.mjs';
import { decodePixel, encodePixel } from '../../../scripts/fxr/char.mjs';
import type { Keyframe } from '../../../scripts/fxr/render.mjs';
import { paramAt } from '../../../scripts/fxr/render.mjs';
import { addKey, paramMode } from '../graph-edit';

export type { Channel, CharAnim, CharDoc, CharMotion, CharPart };
type KeyAnim = { k: Keyframe[] };
const ID = /^[A-Za-z0-9_-]{1,32}$/;

/** 기본 캐릭터 「견습 사제」: 48px 칸 (키 26px, 지팡이 휘두르기 · 들기 자리), 오른쪽을 봄. 몸이 뿌리, 머리 · 팔 · 다리는 몸에, 지팡이는 앞팔에 붙음 */
export function newChar(name = '견습 사제'): CharDoc {
  const doc: CharDoc = {
    format: 'healer.char@1', name, size: 48,
    palette: ['#1b1420', '#f2c9a0', '#d49a72', '#6b3e26', '#a8642f', '#f4f1e6', '#c9c2b0', '#e3b341', '#3a5ba0', '#28407a', '#8a5a2b', '#5c3a1c', '#7fe0ff', '#ffffff', '#4a3428', '#b8862a'],
    parts: [
      { id: 'body', name: '몸', w: 10, h: 12, pivot: [5, 12], parent: null, at: [24, 36], z: 1, pixels: [
        '..000000..', '.05557550.', '0555575550', '0655575550', '0655575550', '0667777760',
        '0655575550', '0655575550', '0665575560', '0665575560', '0777777770', '.00000000.'] },
      { id: 'head', name: '머리', w: 10, h: 10, pivot: [5, 10], parent: 'body', at: [5, 1], z: 3, pixels: [
        '..000000..', '.03344440.', '0344444440', '0344411110', '0344110110',
        '0331111120', '0331111110', '.032111120', '..0022220.', '...0000...'] },
      { id: 'armL', name: '뒷팔', w: 4, h: 9, pivot: [2, 1], parent: 'body', at: [3, 2], z: 0, pixels: ['.00.', '0660', '0660', '0660', '0660', '0ff0', '0220', '0220', '.00.'] },
      { id: 'armR', name: '앞팔', w: 4, h: 9, pivot: [2, 1], parent: 'body', at: [7, 2], rot: -25, z: 4, pixels: ['.00.', '0550', '0560', '0560', '0560', '0770', '0110', '0120', '.00.'] },
      { id: 'legL', name: '뒷다리', w: 5, h: 6, pivot: [2, 0], parent: 'body', at: [3, 11], z: -1, pixels: ['099..', '099..', '099..', '0ee0.', '0eee0', '00000'] },
      { id: 'legR', name: '앞다리', w: 5, h: 6, pivot: [2, 0], parent: 'body', at: [6, 11], z: 0, pixels: ['089..', '089..', '089..', '0ee0.', '0eee0', '00000'] },
      { id: 'weapon', name: '지팡이', w: 3, h: 22, pivot: [1.5, 16], parent: 'armR', at: [2, 7], rot: 25, z: 2, pixels: [
        '000', '0c0', '0d0', '0c0', '070', '0f0', '0a0', '0b0', '0a0', '0a0', '0b0', '0a0', '0a0', '0b0', '0a0', '0a0', '0b0', '0a0', '0a0', '0b0', '0a0', '000'] },
    ],
    motions: [],
  };
  for (const k of ['idle', 'walk', 'attack', 'cast', 'hit'] as const) doc.motions.push(presetMotion(doc, k));
  return doc;
}

/** 기본 모션 (부품 id가 body · head · armL · armR · legL · legR · weapon인 캐릭터 기준, 없는 부품은 건너뜀) */
export const PRESETS = { idle: '서기', walk: '걷기', attack: '공격', cast: '시전', hit: '피격', empty: '빈 모션' } as const;
export type PresetKey = keyof typeof PRESETS;
export function presetMotion(doc: CharDoc, kind: PresetKey, id: string = kind): CharMotion {
  const has = new Set(doc.parts.map(p => p.id));
  const m = (frames: number, fps: number, loop: boolean, tracks: CharMotion['tracks']): CharMotion => ({
    id, name: PRESETS[kind], frames, fps, loop,
    tracks: Object.fromEntries(Object.entries(tracks).filter(([pid]) => has.has(pid))),
  });
  switch (kind) {
    case 'idle': return m(8, 8, true, {
      body: { y: { a: 0, b: 1, e: 'pulse' } }, legL: { y: { a: 0, b: -1, e: 'pulse' } }, legR: { y: { a: 0, b: -1, e: 'pulse' } },
      armL: { rot: { a: 0, b: 5, e: 'pulse' } }, armR: { rot: { a: 0, b: -4, e: 'pulse' } },
    });
    case 'walk': return m(8, 10, true, {
      body: { y: { k: [[0, 1, 'inout'], [2, 0, 'inout'], [4, 1, 'inout'], [6, 0, 'inout'], [7, 0.5]] } },
      legL: { rot: { a: 28, b: -28, e: 'wave' } }, legR: { rot: { a: -28, b: 28, e: 'wave' } },
      armL: { rot: { a: -22, b: 22, e: 'wave' } }, armR: { rot: { a: 12, b: -12, e: 'wave' } },
    });
    case 'attack': return m(10, 14, false, {
      body: { rot: { k: [[0, 0, 'in'], [3, -5, 'in'], [5, 7, 'out'], [9, 0]] }, x: { k: [[0, 0, 'in'], [3, -1, 'in'], [5, 2, 'out'], [9, 0]] } },
      legL: { rot: { k: [[0, 0, 'in'], [3, 5, 'in'], [5, -7, 'out'], [9, 0]] } }, legR: { rot: { k: [[0, 0, 'in'], [3, 5, 'in'], [5, -7, 'out'], [9, 0]] } },
      armL: { rot: { k: [[0, 0, 'in'], [3, -20, 'in'], [5, 20, 'out'], [9, 0]] } },
      armR: { rot: { k: [[0, 0, 'out'], [3, 150, 'in'], [5, -60, 'out'], [8, -30, 'inout'], [9, 0]] } },
      weapon: { rot: { k: [[0, 0, 'out'], [3, 160, 'in'], [5, 200, 'out'], [8, 170, 'inout'], [9, 0]] } },
    });
    case 'cast': return m(12, 10, false, {
      body: { y: { k: [[0, 0, 'out'], [3, -1], [9, -1, 'in'], [11, 0]] } },
      legL: { y: { k: [[0, 0, 'out'], [3, 1], [9, 1, 'in'], [11, 0]] } }, legR: { y: { k: [[0, 0, 'out'], [3, 1], [9, 1, 'in'], [11, 0]] } },
      armL: { rot: { k: [[0, 0, 'out'], [3, -70, 'inout'], [9, -70, 'in'], [11, 0]] } },
      armR: { rot: { k: [[0, 0, 'out'], [3, -150, 'inout'], [9, -150, 'in'], [11, 0]] } },
      weapon: { rot: { k: [[0, 0, 'out'], [3, 180, 'inout'], [9, 180, 'in'], [11, 0]] } },
    });
    case 'hit': return m(6, 12, false, {
      body: { rot: { k: [[0, 0, 'out'], [1, -12, 'out'], [5, 0]] }, x: { k: [[0, 0, 'out'], [1, -2, 'out'], [5, 0]] } },
      legL: { rot: { k: [[0, 0, 'out'], [1, 12, 'out'], [5, 0]] } }, legR: { rot: { k: [[0, 0, 'out'], [1, 12, 'out'], [5, 0]] } },
      head: { rot: { k: [[0, 0, 'out'], [1, -10, 'out'], [5, 0]] } },
      armL: { rot: { k: [[0, 0, 'out'], [1, 30, 'out'], [5, 0]] } }, armR: { rot: { k: [[0, 0, 'out'], [1, 20, 'out'], [5, 0]] } },
    });
    case 'empty': return m(8, 10, true, {});
  }
}

const used = (list: { id: string }[]) => new Set(list.map(x => x.id));
export function nextCharId(list: { id: string }[], base: string): string {
  const u = used(list);
  if (!u.has(base)) return base;
  for (let i = 2; ; i++) if (!u.has(`${base}${i}`)) return `${base}${i}`;
}

// ── 부품 그림 ──────────────────────────────────────────
export const pixelOf = (p: CharPart, x: number, y: number): number => decodePixel(p.pixels[y]?.[x]);
export function setPixel(p: CharPart, x: number, y: number, c: number): boolean {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h || pixelOf(p, x, y) === c) return false;
  const row = p.pixels[y];
  p.pixels[y] = row.slice(0, x) + encodePixel(c) + row.slice(x + 1);
  return true;
}
/** 같은 색으로 이어진 칸 채우기 (상하좌우) */
export function fillPart(p: CharPart, x: number, y: number, c: number): number {
  const from = pixelOf(p, x, y);
  if (from === c || x < 0 || y < 0 || x >= p.w || y >= p.h) return 0;
  let n = 0;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= p.w || cy >= p.h || pixelOf(p, cx, cy) !== from) continue;
    setPixel(p, cx, cy, c); n++;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return n;
}
/** 그림 크기 바꾸기 (왼쪽 위 기준, 늘어난 곳은 투명) */
export function resizePart(p: CharPart, w: number, h: number): void {
  p.pixels = Array.from({ length: h }, (_, y) => (p.pixels[y] ?? '').padEnd(w, '.').slice(0, w));
  p.w = w; p.h = h;
}
/** 부품 더하기 (부모 가운데에 붙는 빈 8×8) */
export function addPart(doc: CharDoc, parent: string | null): string {
  const par = parent ? doc.parts.find(p => p.id === parent) : undefined, id = nextCharId(doc.parts, 'part');
  doc.parts.push({
    id, name: '새 부품', w: 8, h: 8, pixels: Array.from({ length: 8 }, () => '........'), pivot: [4, 4], parent: par ? par.id : null,
    at: par ? [Math.round(par.w / 2), Math.round(par.h / 2)] : [doc.size / 2, doc.size / 2], z: Math.max(0, ...doc.parts.map(p => p.z)) + 1,
  });
  return id;
}
export function duplicatePart(doc: CharDoc, id: string): string | null {
  const p = doc.parts.find(x => x.id === id);
  if (!p) return null;
  const nid = nextCharId(doc.parts, p.id.replace(/\d+$/, ''));
  doc.parts.push({ ...structuredClone(p), id: nid, name: `${p.name} 사본`, at: [p.at[0] + 2, p.at[1]] });
  return nid;
}
/** 부품 지우기: 자식은 지운 부품의 부모에 붙임 (붙는 자리는 회전 없이 옮김), 모션 움직임도 뺌 */
export function removePart(doc: CharDoc, id: string): void {
  const p = doc.parts.find(x => x.id === id);
  if (!p) return;
  for (const c of doc.parts) if (c.parent === id) {
    c.parent = p.parent;
    c.at = [p.at[0] + c.at[0] - p.pivot[0], p.at[1] + c.at[1] - p.pivot[1]];
  }
  doc.parts = doc.parts.filter(x => x !== p);
  for (const m of doc.motions) delete m.tracks[id];
}
export function renamePart(doc: CharDoc, from: string, to: string): string | null {
  if (from === to) return null;
  if (!ID.test(to)) return 'id는 영문 · 숫자 · _ · - 1–32자';
  if (doc.parts.some(p => p.id === to)) return '이미 있는 id';
  const p = doc.parts.find(x => x.id === from);
  if (!p) return '없는 부품';
  p.id = to;
  for (const c of doc.parts) if (c.parent === from) c.parent = to;
  for (const m of doc.motions) if (m.tracks[from]) { m.tracks[to] = m.tracks[from]; delete m.tracks[from]; }
  return null;
}
/** 부모로 고를 수 있는 부품 (자기 · 자손 빼고) */
export function parentCandidates(doc: CharDoc, id: string): CharPart[] {
  const desc = new Set([id]);
  for (let grew = true; grew;) { grew = false; for (const p of doc.parts) if (p.parent && desc.has(p.parent) && !desc.has(p.id)) { desc.add(p.id); grew = true; } }
  return doc.parts.filter(p => !desc.has(p.id));
}
/** 팔레트 색 빼기: 그 색 픽셀은 투명, 뒤 번호는 하나씩 당김 */
export function removeColor(doc: CharDoc, i: number): void {
  if (doc.palette.length <= 1) return;
  doc.palette.splice(i, 1);
  const map = (c: number) => (c === i ? -1 : c > i ? c - 1 : c);
  for (const p of doc.parts) p.pixels = p.pixels.map(row => [...row].map(ch => encodePixel(map(decodePixel(ch)))).join(''));
  for (const m of doc.motions) for (const list of Object.values(m.edits ?? {})) for (const e of list) e[2] = e[2] < 0 ? -1 : map(e[2]);
}

// ── 모션 ──────────────────────────────────────────────
export const valueAt = (m: CharMotion, pid: string, ch: Channel, frame: number): number => {
  const v = m.tracks[pid]?.[ch];
  return v === undefined ? 0 : Number(paramAt(v, frame, m.frames)) || 0;
};
/** 지금 프레임에 값 넣기 (자동 키): 키프레임이면 키 하나 더하고, 없거나 고정 · 구간이면 처음 · 끝 프레임은 예전 값으로 두고 이 프레임에 키 */
export function setTrackKey(m: CharMotion, pid: string, ch: Channel, frame: number, value: number): void {
  const tr = (m.tracks[pid] ??= {}), v = tr[ch], r = (x: number) => Math.round(x * 100) / 100, val = r(value);
  if (v !== undefined && paramMode(v) === 'keys') { tr[ch] = addKey(v as KeyAnim, frame, val); return; }
  const last = m.frames - 1, old = (f: number) => r(v === undefined ? 0 : Number(paramAt(v, f, m.frames)));
  const keys: Keyframe[] = [];
  if (frame > 0) keys.push([0, old(0), 'linear']);
  keys.push([frame, val, 'linear']);
  if (frame < last) keys.push([last, old(last), 'linear']);
  tr[ch] = { k: keys.map((k, i) => (i === keys.length - 1 ? [k[0], k[1]] : k)) as Keyframe[] };
}
export function clearTrack(m: CharMotion, pid: string, ch: Channel): void {
  const tr = m.tracks[pid];
  if (!tr) return;
  delete tr[ch];
  if (!Object.keys(tr).length) delete m.tracks[pid];
}
/** 프레임 손질 한 칸: c = 팔레트 번호 · -1 (투명) · null (손질 빼기) */
export function setEdit(m: CharMotion, frame: number, x: number, y: number, c: number | null): boolean {
  const key = String(frame), list = (m.edits ??= {})[key] ?? [], i = list.findIndex(e => e[0] === x && e[1] === y);
  if (c === null) {
    if (i < 0) return false;
    list.splice(i, 1);
  } else if (i >= 0) {
    if (list[i][2] === c) return false;
    list[i] = [x, y, c];
  } else list.push([x, y, c]);
  if (list.length) m.edits[key] = list; else delete m.edits[key];
  if (!Object.keys(m.edits).length) delete m.edits;
  return true;
}
export const editCount = (m: CharMotion, frame?: number): number => (frame === undefined
  ? Object.values(m.edits ?? {}).reduce((s, l) => s + l.length, 0) : m.edits?.[String(frame)]?.length ?? 0);
/** 장 수 바꾸기: 키프레임은 같은 비율로, 손질은 같은 프레임 번호 그대로 (넘치면 버림) */
export function retimeMotion(m: CharMotion, frames: number): void {
  const old = m.frames, s = (frames - 1) / Math.max(1, old - 1);
  m.frames = frames;
  for (const tr of Object.values(m.tracks)) for (const ch of Object.keys(tr) as Channel[]) {
    const v = tr[ch];
    if (paramMode(v) !== 'keys') continue;
    const out: Keyframe[] = [];
    for (const e of (v as KeyAnim).k) {
      const f = Math.min(frames - 1, Math.round(e[0] * s * 100) / 100), k = [f, e[1], ...e.slice(2)] as Keyframe;
      if (out.length && out[out.length - 1][0] >= f) out[out.length - 1] = k; else out.push(k);
    }
    tr[ch] = { k: out };
  }
  if (m.edits) for (const f of Object.keys(m.edits)) if (Number(f) >= frames) delete m.edits[f];
  if (m.edits && !Object.keys(m.edits).length) delete m.edits;
}

/** 캔버스 크기 바꾸기: 뿌리 부품 · 손질을 가운데로 같이 옮김 (넘친 손질은 버림) */
export function resizeCanvas(doc: CharDoc, size: number): void {
  const d = Math.round((size - doc.size) / 2);
  doc.size = size;
  if (!d) return;
  for (const p of doc.parts) if (!p.parent) p.at = [p.at[0] + d, p.at[1] + d];
  for (const m of doc.motions) {
    for (const [f, list] of Object.entries(m.edits ?? {})) {
      const moved = list.map(([x, y, c]) => [x + d, y + d, c] as [number, number, number]).filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size);
      if (moved.length) m.edits![f] = moved; else delete m.edits![f];
    }
    if (m.edits && !Object.keys(m.edits).length) delete m.edits;
  }
}
/** 부품 그림 좌우 뒤집기 (기준점 · 붙는 자리도) */
export function mirrorPart(doc: CharDoc, id: string): void {
  const p = doc.parts.find(x => x.id === id);
  if (!p) return;
  p.pixels = p.pixels.map(r => [...r].reverse().join(''));
  p.pivot = [p.w - p.pivot[0], p.pivot[1]];
  for (const c of doc.parts) if (c.parent === id) c.at = [p.w - c.at[0], c.at[1]];
}
/** 부품 트리 순서 (뿌리부터, 목록 순서) · 깊이 */
export function partTree(doc: CharDoc): { p: CharPart; depth: number }[] {
  const out: { p: CharPart; depth: number }[] = [], seen = new Set<string>(), ids = new Set(doc.parts.map(p => p.id));
  const walk = (p: CharPart, depth: number) => {
    if (seen.has(p.id)) return;
    seen.add(p.id); out.push({ p, depth });
    for (const c of doc.parts) if (c.parent === p.id) walk(c, depth + 1);
  };
  for (const p of doc.parts) if (!p.parent || !ids.has(p.parent)) walk(p, 0);
  for (const p of doc.parts) if (!seen.has(p.id)) walk(p, 0);
  return out;
}
/** 빈 캐릭터: 몸 하나 (모션 없음) */
export function blankChar(name = '새 캐릭터', size = 32): CharDoc {
  return {
    format: 'healer.char@1', name, size, palette: ['#1b1420', '#ffffff', '#c9c2b0', '#e3b341'],
    parts: [{ id: 'body', name: '몸', w: 8, h: 8, pixels: Array.from({ length: 8 }, (_, y) => (y === 0 || y === 7 ? '00000000' : '01111110')), pivot: [4, 8], parent: null, at: [size / 2, size - 4], z: 0 }],
    motions: [],
  };
}
