// 도트 캐릭터 (healer.char@1, Lim 2026-10-12 「도트 캐릭터를 만들어서 움직임 모션을 만들 수 있는 기능」 → 「둘 다」).
// 머리 · 몸 · 팔 · 다리 같은 부품을 한 번 그려 두고 (팔레트 번호 글자 줄), 뼈대 (부모 부품에 붙는 자리 · 기준점)를 키프레임으로 움직여 모션을 만든 뒤,
// 프레임마다 손으로 픽셀을 고친다 (edits). 키프레임 · 이징은 PXF 그래프와 같은 형식 (render.mjs paramAt).
// 브라우저 (개발용 이펙트 공방 캐릭터 화면, src/fxlab/char)와 node (저장 · 굽기 창구, 테스트)에서 같이 쓴다. node 모듈 없음.
//
// 형식: { format: 'healer.char@1', name, size (정사각 캔버스 px), palette ['#rrggbb' …, 최대 32],
//   parts: [{ id, name, w, h, pixels: ['..01..' 줄 h개, 글자 w개: '.' = 투명, 0–9 a–v = 팔레트 번호], pivot: [x, y] (부품 그림 안 기준점, 픽셀 모서리 좌표),
//            parent (부품 id 또는 null), at: [x, y] (부모 그림 안 붙는 자리, 부모가 없으면 캔버스 자리), rot (쉬는 자세 각도°, 시계 방향 +), z (그리는 순서, 클수록 위) }],
//   motions: [{ id, name, frames, fps, loop, tracks: { <부품 id>: { rot, x, y } } (쉬는 자세에 더하는 값: 고정 · {k} · {a, b}),
//               edits: { <프레임>: [[x, y, 팔레트 번호 또는 -1 (투명)], …] } (뼈대로 그린 뒤 덮는 손질) }] }
import { paramAt } from './render.mjs';

export const CHAR_FORMAT = 'healer.char@1';
export const CHAR_LIMITS = { size: [16, 128], palette: 32, parts: 32, part: 64, motions: 16, frames: 64, fps: 60, keyframes: 64, edits: 4096 };
const ID = /^[A-Za-z0-9_-]{1,32}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const EASES = new Set(['linear', 'in', 'out', 'inout', 'in3', 'out3', 'pulse', 'wave', 'step']);
export const CHANNELS = ['rot', 'x', 'y'];

/** 픽셀 글자 → 팔레트 번호 (-1 = 투명) */
export const decodePixel = ch => (ch === '.' || ch === undefined ? -1 : parseInt(ch, 36));
/** 팔레트 번호 → 픽셀 글자 */
export const encodePixel = c => (c < 0 ? '.' : c.toString(36));

/** 부품 그리는 순서: z, 같으면 목록 순서 */
export const drawOrder = doc => doc.parts.map((p, i) => ({ p, i })).sort((a, b) => (a.p.z ?? 0) - (b.p.z ?? 0) || a.i - b.i).map(x => x.p);

/** 모션 프레임의 부품 값 (쉬는 자세에 더할 값) */
export function channelAt(motion, partId, ch, frame) {
  const v = motion?.tracks?.[partId]?.[ch];
  return v === undefined ? 0 : Number(paramAt(v, frame, motion.frames)) || 0;
}

/**
 * 뼈대 자세: 부품마다 기준점의 캔버스 자리 (정수로 반올림해 픽셀이 흔들리지 않게) · 전체 각도
 * @returns {Map<string, { x: number, y: number, rot: number }>}
 */
export function poseAt(doc, motion, frame) {
  const byId = new Map(doc.parts.map(p => [p.id, p])), out = new Map();
  const get = (id, depth = 0) => {
    if (out.has(id)) return out.get(id);
    const p = byId.get(id);
    const dx = channelAt(motion, id, 'x', frame), dy = channelAt(motion, id, 'y', frame), rot = (p.rot ?? 0) + channelAt(motion, id, 'rot', frame);
    let r;
    const par = p.parent && byId.get(p.parent) && depth < 64 ? byId.get(p.parent) : null;
    if (!par) r = { x: Math.round(p.at[0] + dx), y: Math.round(p.at[1] + dy), rot };
    else {
      const pp = get(par.id, depth + 1), lx = p.at[0] + dx - par.pivot[0], ly = p.at[1] + dy - par.pivot[1], a = (pp.rot * Math.PI) / 180;
      r = { x: Math.round(pp.x + Math.cos(a) * lx - Math.sin(a) * ly), y: Math.round(pp.y + Math.sin(a) * lx + Math.cos(a) * ly), rot: pp.rot + rot };
    }
    out.set(id, r);
    return r;
  };
  for (const p of doc.parts) get(p.id);
  return out;
}

/**
 * 한 프레임 그리기 → 팔레트 번호 (size × size, -1 = 투명) · 픽셀마다 그린 부품 번호 (doc.parts 순서, -1 = 없음 · 손질)
 * @param motion 모션 (null이면 쉬는 자세)
 * @param opts.edits 손질 덮기 (기본 true) · opts.hide 안 그릴 부품 id들
 */
export function renderCharFrame(doc, motion, frame, opts = {}) {
  const n = doc.size, idx = new Int16Array(n * n).fill(-1), owner = new Int16Array(n * n).fill(-1);
  const pose = poseAt(doc, motion, frame), index = new Map(doc.parts.map((p, i) => [p.id, i]));
  for (const p of drawOrder(doc)) {
    if (opts.hide?.includes(p.id)) continue;
    const q = pose.get(p.id), a = (q.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    // 그림 네 모서리가 들어가는 캔버스 사각형만 훑음
    const corners = [[0, 0], [p.w, 0], [0, p.h], [p.w, p.h]].map(([u, v]) => {
      const lx = u - p.pivot[0], ly = v - p.pivot[1];
      return [q.x + c * lx - s * ly, q.y + s * lx + c * ly];
    });
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map(k => k[0])))), x1 = Math.min(n - 1, Math.ceil(Math.max(...corners.map(k => k[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map(k => k[1])))), y1 = Math.min(n - 1, Math.ceil(Math.max(...corners.map(k => k[1]))));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - q.x, dy = y + 0.5 - q.y;
      const u = Math.floor(c * dx + s * dy + p.pivot[0] + 1e-6), v = Math.floor(-s * dx + c * dy + p.pivot[1] + 1e-6);
      if (u < 0 || v < 0 || u >= p.w || v >= p.h) continue;
      const k = decodePixel(p.pixels[v]?.[u]);
      if (k < 0) continue;
      idx[y * n + x] = k;
      owner[y * n + x] = index.get(p.id);
    }
  }
  if (motion && opts.edits !== false) for (const [x, y, k] of motion.edits?.[String(frame)] ?? []) {
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    idx[y * n + x] = k;
    owner[y * n + x] = -1;
  }
  return { idx, owner };
}

/** 팔레트 번호 → RGBA */
export function charRgba(doc, idx) {
  const pal = doc.palette.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))), o = new Uint8ClampedArray(idx.length * 4);
  for (let i = 0; i < idx.length; i++) {
    const c = pal[idx[i]];
    if (!c) continue;
    o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255;
  }
  return o;
}

/**
 * 시트: 모션마다 한 줄 (프레임을 가로로), 칸 = size. 메타는 게임이 읽을 값
 * @returns {{ w: number, h: number, rgba: Uint8ClampedArray, meta: { format: string, name: string, size: number, motions: { id: string, name: string, row: number, frames: number, fps: number, loop: boolean }[] } }}
 */
export function renderCharSheet(doc) {
  const n = doc.size, cols = Math.max(1, ...doc.motions.map(m => m.frames)), rows = Math.max(1, doc.motions.length), W = n * cols, H = n * rows, rgba = new Uint8ClampedArray(W * H * 4);
  const motions = doc.motions.length ? doc.motions : [null];
  motions.forEach((m, r) => {
    for (let f = 0; f < (m?.frames ?? 1); f++) {
      const px = charRgba(doc, renderCharFrame(doc, m, f).idx);
      for (let y = 0; y < n; y++) rgba.set(px.subarray(y * n * 4, (y + 1) * n * 4), ((r * n + y) * W + f * n) * 4);
    }
  });
  return {
    w: W, h: H, rgba,
    meta: { format: 'healer.char-sheet@1', name: doc.name, size: n, motions: doc.motions.map((m, row) => ({ id: m.id, name: m.name, row, frames: m.frames, fps: m.fps, loop: m.loop })) },
  };
}

/** 캐릭터 검사: errors = 못 그리거나 틀리게 그릴 것, warnings = 그려지지만 고치는 게 좋은 것 */
export function validateChar(doc) {
  const errors = [], warnings = [], err = m => errors.push(m), warn = m => warnings.push(m), L = CHAR_LIMITS;
  const isNum = v => typeof v === 'number' && Number.isFinite(v), pt = v => Array.isArray(v) && v.length === 2 && v.every(isNum);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { errors: ['캐릭터가 JSON 객체가 아님'], warnings };
  if (doc.format !== CHAR_FORMAT) err(`format이 「${CHAR_FORMAT}」이 아님`);
  if (typeof doc.name !== 'string' || !doc.name.length || doc.name.length > 60) err('name은 1–60자');
  if (!Number.isInteger(doc.size) || doc.size < L.size[0] || doc.size > L.size[1]) err(`size는 정수 ${L.size[0]}–${L.size[1]}`);
  const pal = Array.isArray(doc.palette) ? doc.palette : (err('palette가 배열이 아님'), []);
  if (pal.length < 1 || pal.length > L.palette) err(`팔레트는 1–${L.palette}색`);
  pal.forEach((c, i) => { if (typeof c !== 'string' || !COLOR.test(c)) err(`팔레트 ${i}번: #RRGGBB가 아님`); });
  const parts = Array.isArray(doc.parts) ? doc.parts : (err('parts가 배열이 아님'), []);
  if (parts.length > L.parts) err(`부품 ${parts.length}개 (최대 ${L.parts})`);
  const ids = new Set();
  for (const p of parts) {
    const at = `부품 ${p?.id ?? '?'}`;
    if (!p || typeof p !== 'object') { err('부품이 객체가 아님'); continue; }
    if (typeof p.id !== 'string' || !ID.test(p.id)) err(`${at}: id는 영문 · 숫자 · _ · - 1–32자`);
    else if (ids.has(p.id)) err(`${at}: id가 겹침`);
    ids.add(p.id);
    if (!Number.isInteger(p.w) || !Number.isInteger(p.h) || p.w < 1 || p.h < 1 || p.w > L.part || p.h > L.part) { err(`${at}: w · h는 정수 1–${L.part}`); continue; }
    if (!Array.isArray(p.pixels) || p.pixels.length !== p.h) err(`${at}: pixels는 ${p.h}줄`);
    else p.pixels.forEach((row, y) => {
      if (typeof row !== 'string' || row.length !== p.w) { err(`${at}: pixels ${y}줄이 ${p.w}글자가 아님`); return; }
      for (const ch of row) { const k = decodePixel(ch); if (ch !== '.' && (!Number.isInteger(k) || k < 0 || k >= pal.length)) { err(`${at}: pixels ${y}줄에 팔레트 밖 글자 「${ch}」`); break; } }
    });
    if (!pt(p.pivot)) err(`${at}: pivot은 [x, y]`);
    if (!pt(p.at)) err(`${at}: at은 [x, y]`);
    if (p.rot !== undefined && !isNum(p.rot)) err(`${at}: rot은 숫자`);
    if (!isNum(p.z ?? 0)) err(`${at}: z는 숫자`);
  }
  const byId = new Map(parts.filter(p => p && typeof p === 'object').map(p => [p.id, p]));
  for (const p of byId.values()) {
    if (p.parent === null || p.parent === undefined) continue;
    if (!byId.has(p.parent)) { err(`부품 ${p.id}: 없는 부모 「${p.parent}」`); continue; }
    const seen = new Set([p.id]);
    for (let c = byId.get(p.parent); c; c = c.parent ? byId.get(c.parent) : undefined) {
      if (seen.has(c.id)) { err(`부품 ${p.id}: 부모를 따라가면 순환`); break; }
      seen.add(c.id);
    }
  }
  if (parts.length && !parts.some(p => p && (p.parent === null || p.parent === undefined))) err('부모 없는 부품 (뿌리)이 하나는 있어야 함');
  const motions = Array.isArray(doc.motions) ? doc.motions : (err('motions가 배열이 아님'), []);
  if (motions.length > L.motions) err(`모션 ${motions.length}개 (최대 ${L.motions})`);
  const mids = new Set();
  for (const m of motions) {
    const at = `모션 ${m?.id ?? '?'}`;
    if (!m || typeof m !== 'object') { err('모션이 객체가 아님'); continue; }
    if (typeof m.id !== 'string' || !ID.test(m.id)) err(`${at}: id는 영문 · 숫자 · _ · - 1–32자`);
    else if (mids.has(m.id)) err(`${at}: id가 겹침`);
    mids.add(m.id);
    if (typeof m.name !== 'string' || !m.name.length) err(`${at}: name이 없음`);
    if (!Number.isInteger(m.frames) || m.frames < 1 || m.frames > L.frames) { err(`${at}: frames는 정수 1–${L.frames}`); continue; }
    if (!isNum(m.fps) || m.fps < 1 || m.fps > L.fps) err(`${at}: fps는 1–${L.fps}`);
    if (typeof m.loop !== 'boolean') err(`${at}: loop는 true / false`);
    for (const [pid, tr] of Object.entries(m.tracks ?? {})) {
      if (!byId.has(pid)) { warn(`${at}: 없는 부품 「${pid}」의 움직임 (무시됨)`); continue; }
      for (const [ch, v] of Object.entries(tr ?? {})) {
        if (!CHANNELS.includes(ch)) { err(`${at} ${pid}: 움직임은 rot · x · y만 (「${ch}」)`); continue; }
        checkAnim(`${at} ${pid}.${ch}`, v, m.frames, err);
      }
    }
    let nEdits = 0;
    for (const [f, list] of Object.entries(m.edits ?? {})) {
      const fi = Number(f);
      if (!Number.isInteger(fi) || fi < 0 || fi >= m.frames) { err(`${at}: 손질 프레임 ${f}가 0–${m.frames - 1} 밖`); continue; }
      if (!Array.isArray(list)) { err(`${at}: 손질 ${f}가 배열이 아님`); continue; }
      nEdits += list.length;
      for (const e of list) if (!(Array.isArray(e) && e.length === 3 && e.every(Number.isInteger) && e[0] >= 0 && e[1] >= 0 && e[0] < doc.size && e[1] < doc.size && e[2] >= -1 && e[2] < pal.length)) { err(`${at}: 손질 ${f}의 [x, y, 색] ${JSON.stringify(e)}가 틀림`); break; }
    }
    if (nEdits > L.edits) err(`${at}: 손질 픽셀 ${nEdits}개 (최대 ${L.edits})`);
  }
  return { errors, warnings };
}

function checkAnim(where, v, frames, err) {
  const isNum = x => typeof x === 'number' && Number.isFinite(x);
  if (isNum(v)) return;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return err(`${where}: 숫자 · {k} · {a, b}만`);
  if ('k' in v) {
    if (!Array.isArray(v.k) || !v.k.length) return err(`${where}: k는 [프레임, 값, 이징] 목록`);
    if (v.k.length > CHAR_LIMITS.keyframes) err(`${where}: 키프레임 ${v.k.length}개 (최대 ${CHAR_LIMITS.keyframes})`);
    let last = -Infinity;
    for (const e of v.k) {
      if (!Array.isArray(e) || e.length < 2 || e.length > 3 || !isNum(e[0]) || !isNum(e[1])) { err(`${where}: 키프레임은 [프레임, 값, 이징]`); continue; }
      if (e[0] < 0 || e[0] > frames - 1) err(`${where}: 키프레임 프레임 ${e[0]}는 0–${frames - 1}`);
      else if (e[0] <= last) err(`${where}: 키프레임 프레임이 오름차순이 아님 (${e[0]})`);
      last = e[0];
      if (e[2] !== undefined && !EASES.has(e[2])) err(`${where}: 이징 「${e[2]}」 없음`);
    }
    return;
  }
  if (!isNum(v.a) || !isNum(v.b)) err(`${where}: a · b는 숫자`);
  const t0 = v.t0 ?? 0, t1 = v.t1 ?? 1;
  if (!isNum(t0) || !isNum(t1) || t0 < 0 || t1 > 1 || t0 > t1) err(`${where}: 0 ≤ t0 ≤ t1 ≤ 1`);
  if (v.e !== undefined && !EASES.has(v.e)) err(`${where}: 이징 「${v.e}」 없음`);
}

/** 저장용 JSON: 2칸 들여쓰기, 숫자 · 짧은 글자만 든 배열 ([x, y], 키프레임, 손질 한 칸)은 한 줄로 */
export function charJson(doc) {
  const leaf = /\[\n\s+((?:-?[\d.]+|"[a-z0-9]{1,8}")(?:,\n\s+(?:-?[\d.]+|"[a-z0-9]{1,8}"))*)\n\s+\]/g;
  return `${JSON.stringify(doc, null, 2).replace(leaf, (_, body) => `[${body.split(/,\n\s+/).join(', ')}]`)}\n`;
}
