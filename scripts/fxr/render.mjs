// 우리 이펙트 렌더러 (fxr, Lim 2026-10-11 「공방처럼 더 고해상도로 만들 수 있는 툴」 → 「만들기」).
// PXF 공방 그래프 (pxf.graph@1)와 같은 노드 · 파라미터를 읽어 원하는 크기로 프레임을 그린다. 공방 엔진은 바깥 서버라 속을 모르므로
// 노드 뜻은 공방 계약 (파라미터 이름 · 범위 · 설명)을 따라 우리가 새로 만든 것: 무작위 (파티클 · 번개 · 노이즈) 모양은 공방과 다르게 나온다.
// 크기를 바꾸면 픽셀 단위 값 (크기 · 두께 · 속도 …)을 같은 비율로 키워 같은 그림을 더 촘촘한 픽셀로 그린다 (외곽선 두께는 1px 그대로).
// 브라우저에서도 돌도록 node 모듈을 쓰지 않는다 (PNG 쓰기는 scripts/fxr.mjs). 개발용 이펙트 화면 (fx.html, src/fxlab)도 이 렌더러로 그린다.
// 2026-10-12 계약 29종을 모두 그림 (아래 「더한 노드」). 공방 렌더와 견주는 법은 src/fxlab의 「공방 렌더와 나란히」.

/** 노드마다 픽셀 단위 파라미터 (크기를 바꿀 때 같이 키움) */
export const PIXEL_PARAMS = {
  Shape: ['size', 'stroke'], Stroke: ['width'], Particles: ['aw', 'ah', 'speed', 'gravity', 'turb', 'sizeA', 'sizeB', 'ground'],
  Lightning: ['thick'], Spike: ['width'], Transform: ['tx', 'ty'], Repeat: ['dx', 'dy'], Displace: ['amount'], Glow: ['radius'],
  Arc: ['radius', 'thick'], Checker: ['size', 'ox', 'oy'], Gradient: ['radius'], Grid: ['cellW', 'cellH', 'gap', 'ox', 'oy'], Blur: ['radius'],
  Polar: ['rIn', 'rOut'], Pixelate: ['block'], Revolve: ['rEnd', 'rMid'], AuraShell: ['radius'],
};
/** 정수 파라미터 (키운 뒤 반올림, 1 이상) */
export const INT_PARAMS = new Set(['Lightning.thick', 'Glow.radius', 'Blur.radius', 'Pixelate.block']);

// ── 시간 · 키프레임 ─────────────────────────────────────────
export const EASE = {
  linear: t => t, in: t => t * t, out: t => 1 - (1 - t) * (1 - t), inout: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  in3: t => t * t * t, out3: t => 1 - (1 - t) ** 3, pulse: t => Math.sin(Math.PI * t), wave: t => 0.5 - 0.5 * Math.cos(2 * Math.PI * t), step: () => 0,
};
/** 파라미터 값 (고정 · 키프레임 k · 구간 a/b) → 프레임 f의 값 */
export function paramAt(v, f, frames) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
  if ('k' in v) {
    const k = v.k;
    if (f <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) {
      const [f0, v0, e] = k[i], [f1, v1] = k[i + 1];
      if (f < f1) { const t = (f - f0) / (f1 - f0), ease = EASE[e ?? 'linear'] ?? EASE.linear; return v0 + (v1 - v0) * ease(t); }
    }
    return k[k.length - 1][1];
  }
  const t = f / frames, { a, b, e = 'linear', t0 = 0, t1 = 1 } = v;
  if (t <= t0) return a;
  if (t >= t1) return b;
  return a + (b - a) * (EASE[e] ?? EASE.linear)((t - t0) / Math.max(1e-9, t1 - t0));
}

// ── 난수 (시드 고정) ──────────────────────────────────────────
function rng(seed) {
  let s = (seed >>> 0) + 0x9e3779b9;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── 강도 그림 (0–1, 한 칸 한 값) · 색 그림 (RGBA 0–1) ─────────────
const intensity = n => ({ kind: 'i', n, v: new Float32Array(n * n) });
const color = n => ({ kind: 'c', n, v: new Float32Array(n * n * 4) });
/** 픽셀 가운데가 원 안이면 값을 max로 찍음. edge > 0이면 가장자리로 갈수록 그만큼 어둡게 (띠 팔레트에서 두 단 색 가장자리) */
function stamp(m, cx, cy, r, val, edge = 0) {
  const n = m.n, rr = Math.max(r, 0.5), r2 = rr * rr;
  const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(n - 1, Math.ceil(cx + rr)), y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(n - 1, Math.ceil(cy + rr));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2) { const i = y * n + x, v = edge > 0 && rr >= 1.5 ? val * (1 - edge * (d2 / r2)) : val; if (v > m.v[i]) m.v[i] = v; }
  }
}
/** 두께 있는 선분 (양끝 반지름 · 값을 이어서) */
function segment(m, ax, ay, bx, by, ra, rb, va, vb, edge = 0) {
  const len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len * 2));
  for (let i = 0; i <= steps; i++) { const t = i / steps; stamp(m, ax + (bx - ax) * t, ay + (by - ay) * t, ra + (rb - ra) * t, va + (vb - va) * t, edge); }
}
/** 획 · 번개 가장자리 어둡기 (두 단 색) */
const EDGE = 0.25;

// ── 생성 노드 ────────────────────────────────────────────────
function shapeSdf(shape, px, py, r, p) {
  // px, py: 도형 좌표 (회전 · 세로비 적용 뒤), r: 반지름. 음수 = 안
  const d = Math.hypot(px, py), a = Math.atan2(py, px);
  switch (shape) {
    case 'ring': { const t = Math.max(1, r * p.size2); return Math.abs(d - (r - t / 2)) - t / 2; }
    case 'square': return Math.max(Math.abs(px), Math.abs(py)) - r;
    case 'diamond': return (Math.abs(px) + Math.abs(py)) / Math.SQRT2 - r / Math.SQRT2;
    case 'cross': { const w = r * Math.max(0.15, p.size2); return Math.min(Math.max(Math.abs(px) - r, Math.abs(py) - w), Math.max(Math.abs(px) - w, Math.abs(py) - r)); }
    case 'shard': return Math.abs(px) / Math.max(0.15, p.size2) + Math.abs(py) - r; // 세로로 긴 마름모 조각
    case 'crescent': { const o = r * (0.25 + 0.5 * p.size2); return Math.max(d - r, r * 0.92 - Math.hypot(px - o, py + o * 0.2)); }
    case 'polygon': case 'star': {
      const k = Math.max(2, Math.round(p.points)), seg = (2 * Math.PI) / k;
      if (p.shape === 'polygon') { const aa = ((a % seg) + seg) % seg - seg / 2; return d * Math.cos(aa) - r * Math.cos(seg / 2); }
      // 별: 바깥 반지름 r, 안쪽 r·size2 사이를 잇는 선
      const half = seg / 2, aa = ((a + Math.PI / 2) % seg + seg) % seg, t = aa < half ? aa / half : (seg - aa) / half;
      return d - (r + (r * p.size2 - r) * t);
    }
    default: return d - r;
  }
}
function genShape(n, p) {
  const m = intensity(n), cx = p.x * n, cy = p.y * n, r = p.size;
  if (r <= 0 || p.intensity <= 0) return m;
  const rot = (-p.rot * Math.PI) / 180, cs = Math.cos(rot), sn = Math.sin(rot), asp = Math.max(0.1, p.aspect), ext = r * Math.max(1, asp) + p.stroke + 2;
  for (let y = Math.max(0, Math.floor(cy - ext)); y <= Math.min(n - 1, Math.ceil(cy + ext)); y++) for (let x = Math.max(0, Math.floor(cx - ext)); x <= Math.min(n - 1, Math.ceil(cx + ext)); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, qx = dx * cs - dy * sn, qy = (dx * sn + dy * cs) / asp;
    const sd = shapeSdf(p.shape, qx, qy, r, p);
    const inside = p.stroke > 0 ? Math.abs(sd) <= p.stroke / 2 : sd <= 0;
    if (!inside) continue;
    const rr = Math.min(1, Math.hypot(qx, qy) / r);
    m.v[y * n + x] = Math.max(m.v[y * n + x], p.intensity * (1 - p.falloff * rr));
  }
  return m;
}
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
function genStroke(n, p) {
  const m = intensity(n);
  if (p.intensity <= 0 || p.to <= p.from || p.width <= 0) return m;
  const X = [p.x0, p.x1, p.x2, p.x3].map(v => v * n), Y = [p.y0, p.y1, p.y2, p.y3].map(v => v * n);
  // 길이로 고르게 (호 길이 표)
  const N = 256, pts = [];
  let L = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = bez(...X, t), y = bez(...Y, t);
    if (i) L += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
    pts.push({ x, y, s: L });
  }
  if (L <= 0) return m;
  const at = s => { // 호 길이 비율 s (0–1) → 점
    const target = s * L; let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].s < target) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[hi], k = b.s > a.s ? (target - a.s) / (b.s - a.s) : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const steps = Math.max(2, Math.ceil(L * (p.to - p.from) * 2));
  // 밝기: 시작 · 가운데 · 끝 세 값을 2차로 이음
  const bright = u => { const a = p.vA, b = p.vM, c = p.vB; return a * (1 - u) * (1 - 2 * u) + 4 * b * u * (1 - u) + c * u * (2 * u - 1); };
  for (let i = 0; i <= steps; i++) {
    const s = p.from + (p.to - p.from) * (i / steps), u = p.span ? (s - p.from) / (p.to - p.from) : s;
    const w = (p.width / 2) * (1 - p.taper * (1 - Math.sin(Math.PI * Math.min(1, Math.max(0, u)))) ** 1.2);
    const q = at(s);
    stamp(m, q.x, q.y, Math.max(0.5, w), Math.max(0, Math.min(1, bright(u))) * p.intensity, EDGE);
  }
  return m;
}
function genLightning(n, p, f) {
  const m = intensity(n);
  if (p.intensity <= 0 || p.grow <= 0) return m;
  const gen = p.rate > 0 ? Math.floor(f / p.rate) : 0, r = rng(p.seed * 7919 + gen * 104729);
  const bolts = [];
  const build = (ax, ay, bx, by, depth, t0, t1) => {
    // 가운데 점 밀기 (재귀)
    let pts = [{ x: ax, y: ay, t: t0 }, { x: bx, y: by, t: t1 }];
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / (len || 1), ny = (b.x - a.x) / (len || 1);
        const off = (r() - 0.5) * 2 * p.jag * len * 0.32;
        next.push({ x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off, t: (a.t + b.t) / 2 }, b);
      }
      pts = next;
    }
    bolts.push({ pts, main: depth === Math.round(p.detail) });
    if (depth >= 2 && p.branch > 0) for (let i = 2; i < pts.length - 2; i += Math.max(1, pts.length >> 3)) {
      if (r() > p.branch) continue;
      const a = pts[i], b = pts[i + 1], dir = Math.atan2(b.y - a.y, b.x - a.x) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5);
      const len = Math.hypot(bx - ax, by - ay) * p.branchLen * (0.35 + r() * 0.45);
      build(a.x, a.y, a.x + Math.cos(dir) * len, a.y + Math.sin(dir) * len, depth - 2, a.t, a.t + (t1 - t0) * p.branchLen * 0.6);
    }
  };
  build(p.x0 * n, p.y0 * n, p.x1 * n, p.y1 * n, Math.round(p.detail), 0, 1);
  const half = Math.max(0.5, p.thick / 2);
  for (const b of bolts) for (let i = 0; i < b.pts.length - 1; i++) {
    const a = b.pts[i], c = b.pts[i + 1];
    if (a.t >= p.grow) break;
    const k = c.t > p.grow ? (p.grow - a.t) / (c.t - a.t) : 1;
    const w = b.main ? half : Math.max(0.5, half * 0.5);
    segment(m, a.x, a.y, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, w, w, p.intensity, p.intensity * (b.main ? 1 : 0.85), EDGE);
  }
  return m;
}
function genSpike(n, p) {
  const m = intensity(n);
  if (p.intensity <= 0 || p.grow <= 0) return m;
  const ax = p.x0 * n, ay = p.y0 * n, bx = p.x1 * n, by = p.y1 * n, L = Math.hypot(bx - ax, by - ay);
  if (L <= 0) return m;
  const ux = (bx - ax) / L, uy = (by - ay) / L, len = L * p.grow, w = p.width / 2;
  const ext = Math.max(len, w) + 2, cx = (ax + bx) / 2, cy = (ay + by) / 2;
  for (let y = Math.max(0, Math.floor(Math.min(ay, by) - w - 2)); y <= Math.min(n - 1, Math.ceil(Math.max(ay, by) + w + 2)); y++) for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - w - 2)); x <= Math.min(n - 1, Math.ceil(Math.max(ax, bx) + w + 2)); x++) {
    const dx = x + 0.5 - ax, dy = y + 0.5 - ay, along = dx * ux + dy * uy, side = -dx * uy + dy * ux;
    if (along < 0 || along > len) continue;
    const t = along / L, hw = w * (1 - p.taper * t ** p.taperPow);
    if (Math.abs(side) > Math.max(0.5, hw)) continue;
    let v = p.base + (p.tip - p.base) * t + p.facet * Math.sign(side || 1) * 0.5;
    if (Math.abs(side) < Math.max(0.6, hw * 0.18)) v += p.ridge;
    if (p.shine >= 0 && Math.abs(t - p.shine) < p.shineW / 2) v += p.shineAmp;
    m.v[y * n + x] = Math.max(m.v[y * n + x], Math.max(0, Math.min(1, v)) * p.intensity);
  }
  void ext; void cx; void cy;
  return m;
}
const SHAPE_FN = {
  square: (dx, dy, r) => Math.max(Math.abs(dx), Math.abs(dy)) <= r,
  diamond: (dx, dy, r) => Math.abs(dx) + Math.abs(dy) <= r,
  plus: (dx, dy, r) => (Math.abs(dx) <= r * 0.34 && Math.abs(dy) <= r) || (Math.abs(dy) <= r * 0.34 && Math.abs(dx) <= r),
  circle: (dx, dy, r) => dx * dx + dy * dy <= r * r,
  dot: (dx, dy, r) => dx * dx + dy * dy <= Math.max(0.5, r * 0.6) ** 2,
};
function genParticles(n, p, f, frames, params) {
  const m = intensity(n), r = rng(p.seed * 15485863 + 7), cx = p.x * n, cy = p.y * n;
  for (let i = 0; i < p.count; i++) {
    // 입자마다 같은 순서로 난수를 뽑아 프레임이 바뀌어도 같은 입자
    const rs = [r(), r(), r(), r(), r(), r(), r(), r(), r()];
    const t0 = p.start * frames + (p.emit === 'stream' ? p.span * frames * (i / Math.max(1, p.count)) : 0);
    const life = Math.max(1, p.life * frames * (1 + p.lifeVar * (rs[0] * 2 - 1)));
    let age = f - t0;
    if (p.loop && age >= life) age %= life;
    if (age < 0 || age >= life) continue;
    // 처음 자리
    let sx = cx, sy = cy;
    const ang0 = rs[1] * 2 * Math.PI, rad = Math.sqrt(rs[2]);
    if (p.area === 'circle') { sx += Math.cos(ang0) * rad * p.aw / 2; sy += Math.sin(ang0) * rad * p.ah / 2; }
    else if (p.area === 'ring') { sx += Math.cos(ang0) * p.aw / 2; sy += Math.sin(ang0) * p.ah / 2; }
    else if (p.area === 'box') { sx += (rs[1] - 0.5) * p.aw; sy += (rs[2] - 0.5) * p.ah; }
    else if (p.area === 'line') { sx += (rs[1] - 0.5) * p.aw; }
    // 방향 · 속도
    let dir = ((p.angle + (rs[3] - 0.5) * p.spread) * Math.PI) / 180;
    if (p.dirMode !== 'fixed' && (sx !== cx || sy !== cy)) { dir = Math.atan2(sy - cy, sx - cx) + ((rs[3] - 0.5) * p.spread * Math.PI) / 180 / 4; if (p.dirMode === 'inward') dir += Math.PI; }
    else if (p.dirMode !== 'fixed') dir = rs[3] * 2 * Math.PI;
    const sp = p.speed * (1 + p.speedVar * (rs[4] * 2 - 1));
    let vx = Math.cos(dir) * sp, vy = Math.sin(dir) * sp, x = sx, y = sy;
    if (p.dirMode === 'inward') { const k = 1 / life; vx = (cx - sx) * k; vy = (cy - sy) * k; }
    for (let s = 0; s < Math.floor(age); s++) {
      vy += p.gravity; vx *= 1 - p.drag; vy *= 1 - p.drag;
      if (p.turb > 0) { const ph = rs[5] * 6.28 + (t0 + s) * 0.7; vx += Math.sin(ph) * p.turb * 0.15; vy += Math.cos(ph * 1.3) * p.turb * 0.1; }
      x += vx; y += vy;
      if (p.ground > 0 && y > p.ground) { y = p.ground; vy = -vy * p.bounce; }
    }
    const u = age / life, size = p.sizeA + (p.sizeB - p.sizeA) * u;
    let fade = 1;
    if (p.fade === 'out') fade = 1 - u; else if (p.fade === 'inout') fade = Math.sin(Math.PI * u); else if (p.fade === 'flicker') fade = (Math.floor(f + rs[6] * 4) % 2) ? 1 : 0.45;
    const v = Math.max(0, Math.min(1, p.bright * (1 - p.brightVar * rs[7]) * (p.fade === 'out' ? 0.35 + 0.65 * fade : fade)));
    if (v <= 0 || size <= 0) continue;
    if (p.pshape === 'streak') {
      const sl = Math.hypot(vx, vy) || 1, l = size * p.stretch;
      segment(m, x - (vx / sl) * l, y - (vy / sl) * l, x, y, Math.max(0.5, size / 4), Math.max(0.5, size / 2), v * 0.7, v);
      continue;
    }
    const fn = SHAPE_FN[p.pshape] ?? SHAPE_FN.square, hr = size / 2;
    for (let yy = Math.max(0, Math.floor(y - hr - 1)); yy <= Math.min(n - 1, Math.ceil(y + hr + 1)); yy++) for (let xx = Math.max(0, Math.floor(x - hr - 1)); xx <= Math.min(n - 1, Math.ceil(x + hr + 1)); xx++) {
      if (!fn(xx + 0.5 - x, yy + 0.5 - y, Math.max(0.5, hr))) continue;
      const k = yy * n + xx; if (v > m.v[k]) m.v[k] = v;
    }
  }
  void params;
  return m;
}
// 값 노이즈 (부드러운 칸 보간 · 옥타브)
function genNoise(n, p, f, frames) {
  const m = intensity(n), seed = p.seed * 2654435761;
  const h = (x, y, o) => { let k = Math.imul(x * 374761393 + y * 668265263 + o * 2147483647 + seed, 1274126177); k ^= k >>> 13; k = Math.imul(k, 1103515245); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t), t = f / frames;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < p.octaves; o++) {
      const sxs = p.scaleX * 2 ** o, sys = p.scaleY * 2 ** o;
      const u = ((x + 0.5) / n + p.scrollX * t) * sxs, v = ((y + 0.5) / n + p.scrollY * t) * sys;
      const ix = Math.floor(u), iy = Math.floor(v), fx = sm(u - ix), fy = sm(v - iy), w = k => ((k % sxs) + sxs) % sxs, wy = k => ((k % sys) + sys) % sys;
      const a = h(w(ix), wy(iy), o), b = h(w(ix + 1), wy(iy), o), c = h(w(ix), wy(iy + 1), o), d = h(w(ix + 1), wy(iy + 1), o);
      let val = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      if (p.type === 'ridged') val = 1 - Math.abs(val * 2 - 1);
      sum += val * amp; norm += amp; amp *= 0.5;
    }
    m.v[y * n + x] = Math.max(0, Math.min(1, (sum / norm - 0.5) * p.contrast + 0.5 + p.bias));
  }
  return m;
}

// ── 합치기 · 색 · 마무리 ─────────────────────────────────────
function blend(a, b, p) {
  const n = a.n, op = p.opacity;
  if (a.kind === 'i' && b.kind === 'i') {
    const o = intensity(n);
    for (let i = 0; i < n * n; i++) {
      const x = a.v[i], y = b.v[i] * op;
      o.v[i] = Math.max(0, Math.min(1, p.mode === 'add' ? x + y : p.mode === 'screen' ? 1 - (1 - x) * (1 - y) : p.mode === 'multiply' ? x * (1 - op + op * b.v[i]) : p.mode === 'subtract' ? x - y : p.mode === 'max' ? Math.max(x, y) : y + x * (1 - y)));
    }
    return o;
  }
  const A = toColor(a), B = toColor(b), o = color(n);
  for (let i = 0; i < n * n; i++) {
    const ba = B.v[i * 4 + 3] * op, aa = A.v[i * 4 + 3], oa = ba + aa * (1 - ba);
    for (let c = 0; c < 3; c++) {
      const x = A.v[i * 4 + c], y = B.v[i * 4 + c];
      const mix = p.mode === 'add' ? Math.min(1, x + y) : p.mode === 'screen' ? 1 - (1 - x) * (1 - y) : p.mode === 'multiply' ? x * y : p.mode === 'subtract' ? Math.max(0, x - y) : p.mode === 'max' ? Math.max(x, y) : y;
      o.v[i * 4 + c] = oa > 0 ? (mix * ba + x * aa * (1 - ba)) / oa : 0;
    }
    o.v[i * 4 + 3] = oa;
  }
  return o;
}
function toColor(m) {
  if (m.kind === 'c') return m;
  const o = color(m.n);
  for (let i = 0; i < m.n * m.n; i++) o.v.set([1, 1, 1, m.v[i]], i * 4);
  return o;
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
function palette(m, p) {
  const n = m.n, o = color(n), cols = (p.colors ?? []).map(hex), k = cols.length;
  if (!k) return o;
  for (let i = 0; i < n * n; i++) {
    let v = m.kind === 'i' ? m.v[i] : (p.key === 'luma' ? (m.v[i * 4] * 0.3 + m.v[i * 4 + 1] * 0.59 + m.v[i * 4 + 2] * 0.11) * m.v[i * 4 + 3] : m.v[i * 4 + 3]);
    if (v < p.cutoff || v <= 0) continue;
    const u = Math.max(0, Math.min(0.99999, (v - p.cutoff) / Math.max(1e-6, 1 - p.cutoff) + p.shift));
    let c;
    if (p.mode === 'smooth' && k > 1) { const x = u * (k - 1), j = Math.floor(x), t = x - j; c = cols[j].map((q, z) => q + (cols[Math.min(k - 1, j + 1)][z] - q) * t); }
    else c = cols[Math.min(k - 1, Math.floor(u * k))];
    o.v.set([c[0], c[1], c[2], p.opacity], i * 4);
  }
  return o;
}
function outline(img, p, mask) {
  const m = toColor(img), n = m.n, o = color(n), col = hex(p.color ?? '#10142e');
  o.v.set(m.v);
  const solid = i => m.v[i * 4 + 3] >= p.threshold;
  const W = Math.max(1, Math.round(p.width));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    if (mask && mask.v[i] <= 0) continue;
    if (p.mode === 'inner') {
      if (!solid(i)) continue;
      let edge = false;
      for (let d = 1; d <= W && !edge; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], ...(p.corners ? [[d, d], [-d, d], [d, -d], [-d, -d]] : [])]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= n || yy >= n || !solid(yy * n + xx)) { edge = true; break; }
      }
      if (edge) o.v.set([...col, 1], i * 4);
      continue;
    }
    if (m.v[i * 4 + 3] > 0.001) continue;
    let near = false;
    for (let d = 1; d <= W && !near; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], ...(p.corners ? [[d, d], [-d, d], [d, -d], [-d, -d]] : [])]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < n && yy < n && solid(yy * n + xx)) { near = true; break; }
    }
    if (near) o.v.set([...col, 1], i * 4);
  }
  return o;
}
function tint(img, p, mask) {
  const m = toColor(img), n = m.n, o = color(n), col = hex(p.color ?? '#ffffff');
  for (let i = 0; i < n * n; i++) {
    const on = !mask || mask.v[i] > 0.5, a = p.amount * (on ? 1 : 0);
    for (let c = 0; c < 3; c++) o.v[i * 4 + c] = Math.min(1, (m.v[i * 4 + c] * (1 - a) + col[c] * a) * (on ? p.bright : 1));
    o.v[i * 4 + 3] = m.v[i * 4 + 3] * (on ? p.opacity : 1);
  }
  return o;
}
function glow(img, p) {
  const n = img.n, r = Math.max(1, Math.round(p.radius));
  const alphaOf = i => (img.kind === 'i' ? img.v[i] : img.v[i * 4 + 3]);
  const tmp = new Float32Array(n * n), bl = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let k = -r; k <= r; k++) s += alphaOf(y * n + Math.min(n - 1, Math.max(0, x + k))); tmp[y * n + x] = s / (2 * r + 1); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(n - 1, Math.max(0, y + k)) * n + x]; bl[y * n + x] = s / (2 * r + 1); }
  if (img.kind === 'i') { const o = intensity(n); for (let i = 0; i < n * n; i++) o.v[i] = Math.min(1, Math.max(img.v[i], bl[i] * p.strength * 0.6)); return o; }
  const o = color(n); o.v.set(img.v);
  for (let i = 0; i < n * n; i++) if (o.v[i * 4 + 3] < bl[i] * p.strength * 0.6) o.v[i * 4 + 3] = bl[i] * p.strength * 0.6;
  return o;
}
function transform(img, p) {
  const n = img.n, ch = img.kind === 'i' ? 1 : 4, o = img.kind === 'i' ? intensity(n) : color(n);
  const rot = (p.rot * Math.PI) / 180, cs = Math.cos(rot), sn = Math.sin(rot), px = p.px * n, py = p.py * n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // 뒤로 따라가 원래 자리 (가장 가까운 픽셀)
    const dx = x + 0.5 - px - p.tx, dy = y + 0.5 - py - p.ty, rx = (dx * cs + dy * sn) / (p.sx || 1e-6), ry = (-dx * sn + dy * cs) / (p.sy || 1e-6);
    const sx = Math.floor(rx + px), sy = Math.floor(ry + py);
    if (sx < 0 || sy < 0 || sx >= n || sy >= n) continue;
    for (let c = 0; c < ch; c++) o.v[(y * n + x) * ch + c] = img.v[(sy * n + sx) * ch + c];
  }
  return o;
}
function displace(img, map, p) {
  const n = img.n, ch = img.kind === 'i' ? 1 : 4, o = img.kind === 'i' ? intensity(n) : color(n), ang = (p.angle * Math.PI) / 180;
  const mv = i => (map.kind === 'i' ? map.v[i] : map.v[i * 4 + 3]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = (mv(y * n + x) - p.center) * p.amount;
    let ox = Math.cos(ang) * d, oy = Math.sin(ang) * d;
    if (p.mode !== 'dir') { const vx = x + 0.5 - p.cx * n, vy = y + 0.5 - p.cy * n, l = Math.hypot(vx, vy) || 1; [ox, oy] = p.mode === 'radial' ? [(vx / l) * d, (vy / l) * d] : [(-vy / l) * d, (vx / l) * d]; }
    const sx = Math.round(x - ox), sy = Math.round(y - oy);
    if (sx < 0 || sy < 0 || sx >= n || sy >= n) continue;
    for (let c = 0; c < ch; c++) o.v[(y * n + x) * ch + c] = img.v[(sy * n + sx) * ch + c];
  }
  return o;
}
function output(img, p) {
  const m = toColor(img), n = m.n, o = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    let a = m.v[i * 4 + 3];
    if (p.alpha !== 'soft') a = a >= p.threshold ? 1 : 0; else if (a < 0.02) a = 0;
    if (a <= 0) continue;
    o[i * 4] = Math.round(m.v[i * 4] * 255); o[i * 4 + 1] = Math.round(m.v[i * 4 + 1] * 255); o[i * 4 + 2] = Math.round(m.v[i * 4 + 2] * 255); o[i * 4 + 3] = Math.round(a * 255);
  }
  return o;
}

// ── 2026-10-12 더한 노드 (Lim 「게임 저장소 안 이펙트 도구」): 계약 29종을 모두 그림 ─────────
// 우리 게임 그래프 50개의 공방 타임라인 그림과 나란히 보며 맞춤 (Repeat · Mask · Arc · Echo · Levels · Blur · Checker · Dither).
// 게임 그래프에 없는 노드 (Gradient · Grid · Polar · Pixelate · Quantize · AuraShell · Revolve)는 계약 설명만 보고 만든 것이라 공방과 더 다를 수 있음.
const alphaAt = (m, i) => (m.kind === 'i' ? m.v[i] : m.v[i * 4 + 3]);
const blankLike = m => (m.kind === 'i' ? intensity(m.n) : color(m.n));
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 그림 m의 픽셀마다 값 (강도 또는 알파)에 k를 곱한 사본 */
function scaleAlpha(m, k) {
  const o = blankLike(m);
  if (m.kind === 'i') { for (let i = 0; i < m.v.length; i++) o.v[i] = m.v[i] * (typeof k === 'function' ? k(i) : k); return o; }
  o.v.set(m.v);
  for (let i = 0; i < m.n * m.n; i++) o.v[i * 4 + 3] *= typeof k === 'function' ? k(i) : k;
  return o;
}
/** 여러 장 합치기: add (더하기) · max (큰 값) · over (뒤 장이 위) */
function stack(list, mode, n, kind) {
  const o = kind === 'i' ? intensity(n) : color(n);
  for (const m0 of list) {
    const m = kind === 'c' ? toColor(m0) : m0;
    if (kind === 'i') { for (let i = 0; i < n * n; i++) { const a = o.v[i], b = m.v[i]; o.v[i] = mode === 'add' ? Math.min(1, a + b) : mode === 'over' ? b + a * (1 - b) : Math.max(a, b); } continue; }
    for (let i = 0; i < n * n; i++) {
      const ba = m.v[i * 4 + 3], aa = o.v[i * 4 + 3];
      if (ba <= 0) continue;
      if (mode === 'max') { if (ba > aa) o.v.set(m.v.subarray(i * 4, i * 4 + 4), i * 4); continue; }
      if (mode === 'add') { for (let c = 0; c < 3; c++) o.v[i * 4 + c] = Math.min(1, (o.v[i * 4 + c] * aa + m.v[i * 4 + c] * ba) / Math.max(1e-6, Math.min(1, aa + ba))); o.v[i * 4 + 3] = Math.min(1, aa + ba); continue; }
      const oa = ba + aa * (1 - ba);
      for (let c = 0; c < 3; c++) o.v[i * 4 + c] = (m.v[i * 4 + c] * ba + o.v[i * 4 + c] * aa * (1 - ba)) / oa;
      o.v[i * 4 + 3] = oa;
    }
  }
  return o;
}
/** 그림을 옮겨 찍기: 원래 그림의 점 (px, py)가 (qx, qy)로 가고 그 둘레로 rot° 돌리고 sx · sy배 (가장 가까운 픽셀) */
function place(img, px, py, qx, qy, rot, sx, sy, gain) {
  const n = img.n, ch = img.kind === 'i' ? 1 : 4, o = blankLike(img), r = (rot * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  if (Math.abs(sx) < 1e-6 || Math.abs(sy) < 1e-6 || gain <= 0) return o;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x + 0.5 - qx, dy = y + 0.5 - qy, rx = (dx * cs + dy * sn) / sx, ry = (-dx * sn + dy * cs) / sy;
    const ix = Math.floor(rx + px), iy = Math.floor(ry + py);
    if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;
    const si = (iy * n + ix) * ch, di = (y * n + x) * ch;
    for (let c = 0; c < ch; c++) o.v[di + c] = img.v[si + c];
    o.v[di + ch - 1] *= gain;
  }
  return o;
}
const bezier = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
/**
 * 반복 배치: 입력 그림을 count장 찍음. i번째 장은 delay·i 프레임 늦은 입력 그림 (그 시각의 반복 값으로) — 시작 전 (프레임 < 0)인 장은 안 찍음.
 * step: 피벗 (첫 위치) 둘레로 angle0 + angleStep·j 돌리고 (dx, dy)·j 옮김 (centered면 j가 가운데 0 기준 대칭), 크기 1 − scaleStep·|j|, 강도 1 − fadeStep·|j|.
 * bezier: 곡선 (bx0, by0)…(bx3, by3) 위에 (i / (count − 1))^dist 자리로, 배율 scale0 → scale1 (scalePow 곡선).
 */
function repeatNode(n, count, copyAt) {
  const list = [];
  let kind = 'i', mode = 'add';
  for (let i = 0; i < count; i++) {
    const c = copyAt(i);
    if (!c) continue;
    const { img, p } = c;
    mode = p.mode; if (img.kind === 'c') kind = 'c';
    const j = p.centered ? i - (count - 1) / 2 : i, k = Math.abs(j), r = rng(p.seed * 31 + i * 977 + 5);
    const rr = [r(), r()], px = p.px * n, py = p.py * n;
    let qx = p.posX >= 0 ? p.posX * n : px, qy = p.posY >= 0 ? p.posY * n : py, s;
    if (p.layout === 'bezier') {
      const t = count > 1 ? (i / (count - 1)) ** p.dist : 0;
      qx = bezier(p.bx0, p.bx1, p.bx2, p.bx3, t) * n; qy = bezier(p.by0, p.by1, p.by2, p.by3, t) * n;
      s = p.scale0 + (p.scale1 - p.scale0) * t ** p.scalePow;
    } else { qx += p.dx * j; qy += p.dy * j; s = p.scale0 * Math.max(0, 1 - p.scaleStep * k); }
    s *= 1 - p.jitter * rr[0];
    const rot = p.angle0 + p.angleStep * j + (p.rotMin + (p.rotMax - p.rotMin) * rr[1]);
    list.push(place(img, px, py, qx, qy, rot, s * p.sx, s * p.sy, Math.max(0, 1 - p.fadeStep * k)));
  }
  return stack(list, mode, n, kind);
}
/** 잔상: copies장 앞선 프레임 (step 간격)의 입력을 decay^k로 옅게 깔고 지금 그림을 맨 위에 */
function echoNode(n, p, inputAt, ff) {
  const list = [];
  let kind = 'i';
  for (let k = Math.round(p.copies); k >= 0; k--) {
    const fk = ff - k * p.step;
    if (fk < 0) continue;
    const img = inputAt(fk);
    if (!img) continue;
    if (img.kind === 'c') kind = 'c';
    list.push(k ? scaleAlpha(img, p.decay ** k) : img);
  }
  return stack(list, kind === 'i' ? 'max' : 'over', n, kind);
}
/** 마스크: multiply = 마스크 값만큼 남김, cutout = 마스크 값만큼 지움 (값 = 강도 또는 알파) */
function maskNode(img, mask, p) {
  if (!mask) return img;
  return scaleAlpha(img, i => { const mv = clamp01(alphaAt(mask, i)); return p.mode === 'cutout' ? 1 - p.strength * mv : 1 - p.strength * (1 - mv); });
}
/** 레벨: (값 − lo) / (hi − lo)를 감마로 휘고 steps단으로 나눔 (색 그림이면 알파에) */
function levelsNode(img, p) {
  const f = v => {
    if (v <= 0) return 0;
    let t = clamp01((v - p.lo) / Math.max(1e-6, p.hi - p.lo));
    t = t ** (1 / Math.max(0.01, p.gamma));
    const s = Math.round(p.steps);
    if (s >= 2) t = Math.round(t * (s - 1)) / (s - 1); else if (s === 1) t = t > 0 ? 1 : 0;
    return t;
  };
  const o = blankLike(img);
  if (img.kind === 'i') { for (let i = 0; i < img.v.length; i++) o.v[i] = f(img.v[i]); return o; }
  o.v.set(img.v);
  for (let i = 0; i < img.n * img.n; i++) o.v[i * 4 + 3] = f(img.v[i * 4 + 3]);
  return o;
}
/** 상자 블러 (가로 · 세로) passes번. 색 그림은 알파를 곱한 색으로 */
function blurNode(img, p) {
  const n = img.n, r = Math.max(0, Math.round(p.radius)), ch = img.kind === 'i' ? 1 : 4;
  if (r === 0) return img;
  let cur = new Float32Array(img.v);
  if (ch === 4) for (let i = 0; i < n * n; i++) for (let c = 0; c < 3; c++) cur[i * 4 + c] *= cur[i * 4 + 3];
  const pass = (src, horiz) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let c = 0; c < ch; c++) {
      let s = 0;
      for (let k = -r; k <= r; k++) { const xx = horiz ? x + k : x, yy = horiz ? y : y + k; if (xx >= 0 && yy >= 0 && xx < n && yy < n) s += src[(yy * n + xx) * ch + c]; }
      out[(y * n + x) * ch + c] = s / (2 * r + 1);
    }
    return out;
  };
  for (let k = 0; k < Math.max(1, Math.round(p.passes)); k++) cur = pass(pass(cur, true), false);
  const o = blankLike(img);
  if (ch === 1) { o.v.set(cur); return o; }
  for (let i = 0; i < n * n; i++) { const a = cur[i * 4 + 3]; o.v[i * 4 + 3] = a; for (let c = 0; c < 3; c++) o.v[i * 4 + c] = a > 1e-6 ? Math.min(1, cur[i * 4 + c] / a) : 0; }
  return o;
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16), BAYER2 = [0, 2, 3, 1].map(v => (v + 0.5) / 4);
/** 디더: 값을 levels단으로 나누되 단 사이는 바이어 무늬로 섞음 (strength 0이면 반올림) */
function ditherNode(img, p) {
  const n = img.n, L = Math.max(2, Math.round(p.levels)), b4 = p.pattern !== 'bayer2';
  const f = (v, x, y) => {
    if (v <= 0) return 0;
    const th = (b4 ? BAYER4[(y & 3) * 4 + (x & 3)] : BAYER2[(y & 1) * 2 + (x & 1)]) * p.strength + (1 - p.strength) * 0.5;
    return clamp01(Math.floor(v * (L - 1) + th) / (L - 1));
  };
  const o = blankLike(img);
  if (img.kind === 'c') o.v.set(img.v);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * n + x; if (img.kind === 'i') o.v[i] = f(img.v[i], x, y); else o.v[i * 4 + 3] = f(img.v[i * 4 + 3], x, y); }
  return o;
}
/** 호 / 참격: 중심 둘레 반지름 radius의 띠. start°에서 sweep° 쪽으로, 앞머리 head (호 길이 비율)부터 뒤로 tail 길이만큼. 꼬리로 갈수록 가늘고 (taper) 어두움 */
function genArc(n, p) {
  const m = intensity(n);
  if (p.intensity <= 0 || p.thick <= 0 || p.sweep === 0 || p.tail <= 0) return m;
  const cx = p.x * n, cy = p.y * n, rot = (-p.rot * Math.PI) / 180, cs = Math.cos(rot), sn = Math.sin(rot), asp = Math.max(0.05, p.aspect);
  const W = Math.abs(p.sweep), dirS = Math.sign(p.sweep), lo = Math.max(0, p.head - p.tail), hi = Math.min(1, p.head);
  if (hi <= lo) return m;
  const ext = p.radius + p.thick + 2;
  for (let y = Math.max(0, Math.floor(cy - ext)); y <= Math.min(n - 1, Math.ceil(cy + ext)); y++) for (let x = Math.max(0, Math.floor(cx - ext)); x <= Math.min(n - 1, Math.ceil(cx + ext)); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, qx = dx * cs - dy * sn, qy = (dx * sn + dy * cs) / asp;
    const r = Math.hypot(qx, qy), th = (Math.atan2(qy, qx) * 180) / Math.PI;
    const s = ((((th - p.start) * dirS) % 360) + 360) % 360 / W;
    if (s < lo || s > hi) continue;
    // 앞머리는 두께만큼 뾰족하게 (앞머리가 호 끝을 지나면 끝에서 잘림)
    const u = (p.head - s) / p.tail, dh = (p.head - s) * ((W * Math.PI) / 180) * p.radius;
    const w = (p.thick / 2) * Math.max(0, 1 - u) ** p.taper * (p.head <= 1 ? Math.min(1, dh / Math.max(1, p.thick)) ** 0.5 : 1);
    const off = Math.abs(r - p.radius);
    if (off > Math.max(0.5, w)) continue;
    const v = p.intensity * (1 - 0.5 * u) * (1 - 0.55 * (off / Math.max(0.5, w)) ** 2);
    const i = y * n + x; if (v > m.v[i]) m.v[i] = v;
  }
  return m;
}
/** 체커: size px 칸을 a · b 강도로 번갈아 (iso = 마름모 칸, dots = 칸마다 점) */
function genChecker(n, p) {
  const m = intensity(n), c = Math.max(0.5, p.size);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const X = x + 0.5 - p.ox, Y = y + 0.5 - p.oy;
    let u = X / c, v = Y / c;
    if (p.iso) { const a = X / (2 * c) + Y / c, b = Y / c - X / (2 * c); u = a; v = b; }
    const iu = Math.floor(u), iv = Math.floor(v);
    if (p.pattern === 'dots') { const du = u - iu - 0.5, dv = v - iv - 0.5; m.v[y * n + x] = Math.hypot(du, dv) <= p.dot ? p.a : p.b; }
    else m.v[y * n + x] = (iu + iv) & 1 ? p.a : p.b;
  }
  return m;
}
/** 그라디언트: linear (angle° 쪽으로 반경 2배 폭에 0 → 1) · radial · angular · diamond, offset만큼 밀고 repeat이면 되풀이 */
function genGradient(n, p) {
  const m = intensity(n), cx = p.x * n, cy = p.y * n, a = (p.angle * Math.PI) / 180, R = Math.max(1, p.radius), asp = Math.max(0.1, p.aspect);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / asp;
    let t;
    if (p.type === 'radial') t = Math.hypot(dx, dy) / R;
    else if (p.type === 'angular') t = (((Math.atan2(dy, dx) - a) / (2 * Math.PI)) % 1 + 1) % 1;
    else if (p.type === 'diamond') t = (Math.abs(dx) + Math.abs(dy)) / R;
    else t = (dx * Math.cos(a) + dy * Math.sin(a)) / (2 * R) + 0.5;
    t += p.offset;
    t = p.repeat ? ((t % 1) + 1) % 1 : clamp01(t);
    m.v[y * n + x] = p.invert ? 1 - t : t;
  }
  return m;
}
/** 그리드 / 판자: cellW × cellH 칸마다 lo–hi 사이 무작위 강도 (시드), 틈은 gapV */
function genGrid(n, p) {
  const m = intensity(n), W = Math.max(1, p.cellW), H = Math.max(1, p.cellH), g = Math.max(0, p.gap);
  const h = (i, j) => { let k = Math.imul(i * 73856093 ^ j * 19349663 ^ p.seed * 83492791, 1274126177); k ^= k >>> 15; return ((k >>> 0) % 10007) / 10007; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const X = x + 0.5 - p.ox, Y = y + 0.5 - p.oy, i = Math.floor(X / W), j = Math.floor(Y / H), fx = X - i * W, fy = Y - j * H;
    m.v[y * n + x] = fx < g || fy < g ? p.gapV : p.lo + (p.hi - p.lo) * h(i, j);
  }
  return m;
}
/** 극좌표: 입력의 가로 = 둘레 (spin°만큼 돌림), 세로 = 반경 rIn → rOut (invert면 입력 아래가 바깥) */
function polarNode(img, p) {
  const n = img.n, ch = img.kind === 'i' ? 1 : 4, o = blankLike(img), cx = p.cx * n, cy = p.cy * n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    if (r < p.rIn || r > p.rOut || p.rOut <= p.rIn) continue;
    const ang = (((Math.atan2(dy, dx) * 180) / Math.PI - p.spin) % 360 + 360) % 360, t = (r - p.rIn) / (p.rOut - p.rIn);
    const sx = Math.min(n - 1, Math.floor((ang / 360) * n)), sy = Math.min(n - 1, Math.floor((p.invert ? t : 1 - t) * n));
    for (let c = 0; c < ch; c++) o.v[(y * n + x) * ch + c] = img.v[(sy * n + sx) * ch + c];
  }
  return o;
}
/** 픽셀화: block × block 칸을 그 칸 가운데 픽셀 값으로 */
function pixelateNode(img, p) {
  const n = img.n, b = Math.max(1, Math.round(p.block)), ch = img.kind === 'i' ? 1 : 4, o = blankLike(img);
  if (b === 1) return img;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const sx = Math.min(n - 1, Math.floor(x / b) * b + (b >> 1)), sy = Math.min(n - 1, Math.floor(y / b) * b + (b >> 1));
    for (let c = 0; c < ch; c++) o.v[(y * n + x) * ch + c] = img.v[(sy * n + sx) * ch + c];
  }
  return o;
}
/** 팔레트 고정: 색마다 허용 색 중 가장 가까운 색 (alpha hard면 threshold로 0 / 1) */
function quantizeNode(img, p) {
  const m = toColor(img), n = m.n, o = color(n), P = (p.colors ?? []).map(hex);
  for (let i = 0; i < n * n; i++) {
    let a = m.v[i * 4 + 3];
    if (p.alpha === 'hard') a = a >= p.threshold ? 1 : 0;
    if (a <= 0) continue;
    const c = [m.v[i * 4], m.v[i * 4 + 1], m.v[i * 4 + 2]];
    let best = c, bd = Infinity;
    for (const q of P) { const d = (q[0] - c[0]) ** 2 * 0.3 + (q[1] - c[1]) ** 2 * 0.59 + (q[2] - c[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = q; } }
    o.v.set([best[0], best[1], best[2], a], i * 4);
  }
  return o;
}
/** 텍스처 그림 (강도 또는 색)에서 (u, v) (0–1, 가로 되풀이) 값 → [r, g, b, a] */
function texAt(tex, u, v) {
  if (!tex) return [1, 1, 1, 1];
  const n = tex.n, x = Math.min(n - 1, Math.floor((((u % 1) + 1) % 1) * n)), y = Math.min(n - 1, Math.max(0, Math.floor(v * n))), i = y * n + x;
  return tex.kind === 'i' ? [1, 1, 1, tex.v[i]] : [tex.v[i * 4], tex.v[i * 4 + 1], tex.v[i * 4 + 2], tex.v[i * 4 + 3]];
}
/** 점 찍기 (뒤 → 앞 순서로 부르면 앞이 덮음) */
function splat(o, x, y, c, a) {
  const n = o.n, ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= n || iy >= n || a <= 0) return;
  const i = (iy * n + ix) * 4, aa = o.v[i + 3], oa = a + aa * (1 - a);
  for (let k = 0; k < 3; k++) o.v[i + k] = (c[k] * a + o.v[i + k] * aa * (1 - a)) / oa;
  o.v[i + 3] = oa;
}
/**
 * 회전체 (술통 · 기둥): 세로축 cx, 위 yTop ~ 아래 yBot. 반경은 끝 rEnd · 가운데 rMid (bulgePow 곡선), 단면은 가로 r · 세로 r·ratio 타원.
 * 옆면 = 입력 0을 둘레로 uvX번 감고 spin (한 바퀴 재생에) 만큼 돌림, 뚜껑 = 입력 1. 음영은 가장자리로 갈수록 (light로 좌우 치우침).
 */
function revolveNode(n, side, cap, p, t) {
  const o = color(n), cx = p.cx * n, y0 = p.yTop * n, y1 = p.yBot * n, H = Math.max(1, y1 - y0);
  const rad = v => (p.rEnd + (p.rMid - p.rEnd) * (1 - Math.abs(2 * v - 1) ** p.bulgePow)) * p.scale;
  const shadeAt = (sx) => 1 - p.shade * Math.min(1, Math.abs(sx - p.light * 0.6)) ** p.shadePow;
  const drawCap = (yc, r, front) => {
    if (!front) return;
    const ry = Math.max(0.5, r * p.ratio);
    for (let yy = Math.floor(yc - ry); yy <= Math.ceil(yc + ry); yy++) for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = (xx + 0.5 - cx) / Math.max(0.5, r), dy = (yy + 0.5 - yc) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const c = texAt(cap, (Math.atan2(dy, dx) / (2 * Math.PI)) + 0.5, Math.hypot(dx, dy));
      splat(o, xx + 0.5, yy + 0.5, c, c[3]);
    }
  };
  const ring = back => {
    const steps = Math.ceil(H * 2);
    for (let k = 0; k <= steps; k++) {
      const v = k / steps, r = rad(v), yc = y0 + v * H, na = Math.max(16, Math.ceil(r * 8));
      for (let a = 0; a < na; a++) {
        const ph = (a / na) * 2 * Math.PI, z = Math.cos(ph);
        if (back ? z >= 0 : z < 0) continue;
        const sx = Math.sin(ph), c = texAt(side, (ph / (2 * Math.PI)) * p.uvX + p.spin * t, v), sh = back ? 0.55 : shadeAt(sx);
        splat(o, cx + sx * r, yc + z * r * p.ratio * 0.5, [c[0] * sh, c[1] * sh, c[2] * sh], c[3]);
      }
    }
  };
  if (p.range === 'full') ring(true);
  if (p.cap === 'top') drawCap(y0, rad(0), true);
  ring(false);
  if (p.cap === 'bottom') drawCap(y1, rad(1), true);
  return o;
}
/**
 * 반구 · 상승 막: 입구 (lipY, 반경 radius, 깊이 tilt 타원) 아래로 바닥 baseY까지 반구 (입력 0), 입구에서 tipY까지 오르는 막 (입력 1, riseAlpha).
 * 막은 flare만큼 퍼지고 twist만큼 비틀리며 텍스처를 stretch배 늘림. 위쪽은 텍스처 값이 riseCutoff를 넘는 데서 끊김. range = 그릴 깊이 (full · front · rear).
 */
function auraShellNode(n, bowl, rise, p, t) {
  const o = color(n), cx = p.cx * n, lip = p.lipY * n, base = p.baseY * n, tip = p.tipY * n, R = p.radius, ry = Math.max(0.5, R * p.tilt);
  const layer = back => {
    if ((back && p.range === 'front') || (!back && p.range === 'rear')) return;
    const fade = back ? p.rearAlpha : 1;
    // 반구 (입구 아래)
    const hb = Math.max(1, base - lip), na = Math.max(24, Math.ceil(R * 8));
    for (let k = 0; k <= Math.ceil(hb * 2); k++) {
      const v = k / Math.ceil(hb * 2), r = R * Math.sqrt(Math.max(0, 1 - v * v)), yc = lip + v * hb;
      for (let a = 0; a < na; a++) {
        const ph = (a / na) * 2 * Math.PI, z = Math.cos(ph);
        if (back ? z >= 0 : z < 0) continue;
        const sx = Math.sin(ph), c = texAt(bowl, (ph / (2 * Math.PI)) * p.uvX + p.spin * t, v), sh = 1 - p.shade * Math.abs(sx);
        splat(o, cx + sx * r, yc + z * r * p.tilt, [c[0] * sh, c[1] * sh, c[2] * sh], c[3] * fade);
      }
    }
    // 상승 막 (입구 위)
    const hr = Math.max(1, lip - tip);
    for (let k = 0; k <= Math.ceil(hr * 2); k++) {
      const v = k / Math.ceil(hr * 2), r = R * (1 + p.flare * v * 4), yc = lip - v * hr;
      for (let a = 0; a < na; a++) {
        const ph = (a / na) * 2 * Math.PI, z = Math.cos(ph);
        if (back ? z >= 0 : z < 0) continue;
        const sx = Math.sin(ph), u = (ph / (2 * Math.PI)) * p.uvX + p.spin * t + p.twist * v, c = texAt(rise, u, (v * p.riseUV * p.stretch) % 1);
        if (v > 0.2 && c[3] * (1 + v) > p.riseCutoff * 1.2) continue;
        const sh = 1 - p.shade * Math.abs(sx);
        splat(o, cx + sx * r, yc + z * ry, [c[0] * sh, c[1] * sh, c[2] * sh], c[3] * p.riseAlpha * fade * (1 - v * 0.5));
      }
    }
  };
  layer(true); layer(false);
  return o;
}

// ── 그래프 ───────────────────────────────────────────────────
/** 계약의 기본값 (생략한 파라미터) */
export function withDefaults(type, params, contract) {
  const spec = contract?.nodes?.[type]?.params ?? {};
  const out = {};
  for (const [k, s] of Object.entries(spec)) out[k] = s.default;
  return Object.assign(out, params);
}
/** 픽셀 단위 값을 k배 (키프레임 값 포함) */
function scaleParams(type, params, k) {
  if (k === 1) return params;
  const out = { ...params };
  for (const key of PIXEL_PARAMS[type] ?? []) {
    if (!(key in out)) continue;
    const isInt = INT_PARAMS.has(`${type}.${key}`), f = v => (isInt ? Math.max(1, Math.round(v * k)) : v * k), v = out[key];
    out[key] = v && typeof v === 'object' ? ('k' in v ? { ...v, k: v.k.map(e => [e[0], f(e[1]), ...e.slice(2)]) } : { ...v, a: f(v.a), b: f(v.b) }) : f(v);
  }
  return out;
}

/**
 * 그래프 → 프레임들 (RGBA 8비트, size × size)
 * @param graph pxf.graph@1 그래프 (공방 그래프 그대로 또는 우리 그래프)
 * @param opts.size 그릴 크기 (없으면 settings.size). 픽셀 단위 값은 size / settings.size 배
 * @param opts.contract 공방 계약 JSON (생략한 파라미터의 기본값)
 */
export function renderGraph(graph, opts = {}) {
  const base = graph.settings.size, n = opts.size ?? base, k = n / base, frames = graph.settings.frames;
  const nodes = new Map(graph.nodes.map(nd => [nd.id, { ...nd, params: scaleParams(nd.type, withDefaults(nd.type, nd.params, opts.contract), k) }]));
  const inputs = id => { const r = []; for (const l of graph.links) if (l.t === id) r[l.p] = l.f; return r; };
  const out = graph.nodes.find(nd => nd.type === 'Output');
  if (!out) throw new Error('Output 노드가 없음');
  const result = [];
  for (let f = 0; f < frames; f++) {
    const memo = new Map();
    const evalNode = (id, ff = f) => {
      const key = `${id}@${ff}`;
      if (memo.has(key)) return memo.get(key);
      const nd = nodes.get(id), ins = inputs(id), P = {};
      for (const [kk, v] of Object.entries(nd.params)) P[kk] = paramAt(v, ff, frames);
      const get = i => (ins[i] ? evalNode(ins[i], ff) : null);
      let r;
      switch (nd.type) {
        case 'Shape': r = genShape(n, P); break;
        case 'Stroke': r = genStroke(n, P); break;
        case 'Lightning': r = genLightning(n, P, ff); break;
        case 'Spike': r = genSpike(n, P); break;
        case 'Particles': r = genParticles(n, P, ff, frames, nd.params); break;
        case 'Noise': r = genNoise(n, P, ff, frames); break;
        case 'Blend': { const a = get(0), b = get(1); r = a && b ? blend(a, b, P) : a ?? b ?? intensity(n); break; }
        case 'Palette': r = palette(get(0) ?? intensity(n), P); break;
        case 'Outline': r = outline(get(0) ?? intensity(n), P, get(1)); break;
        case 'Tint': r = tint(get(0) ?? intensity(n), P, get(1)); break;
        case 'Glow': r = glow(get(0) ?? intensity(n), P); break;
        case 'Transform': r = transform(get(0) ?? intensity(n), P); break;
        case 'Displace': r = displace(get(0) ?? intensity(n), get(1) ?? intensity(n), P); break;
        case 'Arc': r = genArc(n, P); break;
        case 'Checker': r = genChecker(n, P); break;
        case 'Gradient': r = genGradient(n, P); break;
        case 'Grid': r = genGrid(n, P); break;
        case 'Repeat': {
          // i번째 장 = delay·i 프레임 늦은 입력 (반복 값도 그 시각으로)
          const cnt = Math.max(1, Math.round(P.count));
          r = ins[0] ? repeatNode(n, cnt, i => {
            const fi = ff - i * P.delay;
            if (fi < 0) return null;
            const pi = {};
            for (const [kk, v] of Object.entries(nd.params)) pi[kk] = paramAt(v, fi, frames);
            return { img: evalNode(ins[0], fi), p: pi };
          }) : intensity(n);
          break;
        }
        case 'Echo': r = ins[0] ? echoNode(n, P, fk => evalNode(ins[0], fk), ff) : intensity(n); break;
        case 'Mask': r = maskNode(get(0) ?? intensity(n), get(1), P); break;
        case 'Levels': r = levelsNode(get(0) ?? intensity(n), P); break;
        case 'Blur': r = blurNode(get(0) ?? intensity(n), P); break;
        case 'Dither': r = ditherNode(get(0) ?? intensity(n), P); break;
        case 'Polar': r = polarNode(get(0) ?? intensity(n), P); break;
        case 'Pixelate': r = pixelateNode(get(0) ?? intensity(n), P); break;
        case 'Quantize': r = quantizeNode(get(0) ?? intensity(n), P); break;
        case 'Revolve': r = revolveNode(n, get(0), get(1), P, ff / frames); break;
        case 'AuraShell': r = auraShellNode(n, get(0), get(1), P, ff / frames); break;
        case 'Output': r = get(0) ?? intensity(n); break;
        default: throw new Error(`아직 못 그리는 노드: ${nd.type} (${id})`);
      }
      memo.set(key, r);
      return r;
    };
    const P = {};
    for (const [kk, v] of Object.entries(nodes.get(out.id).params)) P[kk] = paramAt(v, f, frames);
    result.push(output(evalNode(out.id), P));
  }
  return { size: n, frames: result };
}
