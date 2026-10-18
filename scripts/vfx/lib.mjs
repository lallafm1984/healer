// 스킬 이펙트 그리기 도구 (Lim 2026-10-16 「스킬이펙트가 너무 허술한게 많다. 퀄리티 있게 모두 다시」).
// 64px 도트 (PXF)를 칸 크기로 네 배 가까이 늘려 그리던 것을, 브라우저 캔버스로 직접 그린 부드러운 손그림풍 프레임 (224px)으로 바꿈.
// 좌표: 칸 가운데가 (0, 0), 1 = 칸 반지름 (육각 칸 꼭짓점까지, 위 = −y). 프레임은 ±logical/62 (그리기 전에 맞춰 줌).
// 이름 · 체력 글자는 칸 가운데 (y −0.1 ~ 0.6)라 가운데를 오래 덮지 않게 그린다. 이 파일은 브라우저 · node 모두에서 읽힘 (DOM은 그릴 때만).

// ── 수 · 시간 ─────────────────────────────────────────────
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** t를 [a, b] 구간 진행도 0–1로 */
export const seg = (t, a, b) => clamp((t - a) / (b - a));
/** a에서 b까지 차오르고 b에서 c까지 사라지는 0–1 (매끄럽게) */
export const bell = (t, a, b, c) => (t <= a || t >= c ? 0 : t < b ? E.smooth(seg(t, a, b)) : 1 - E.smooth(seg(t, b, c)));
export const E = {
  lin: t => t, in2: t => t * t, in3: t => t * t * t, out2: t => 1 - (1 - t) ** 2, out3: t => 1 - (1 - t) ** 3, out4: t => 1 - (1 - t) ** 4,
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2), smooth: t => t * t * (3 - 2 * t),
  back: (t, s = 1.7) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  elastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
/** 시드 고정 난수 (같은 시드 = 프레임마다 같은 입자) */
export function rng(seed) {
  let s = (seed >>> 0) + 0x9e3779b9;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const TAU = Math.PI * 2;
export const rad = d => (d * Math.PI) / 180;

// ── 색 ────────────────────────────────────────────────────
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** '#rrggbb' + 불투명도 → CSS 색 */
export const C = (h, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
/** 두 색 사이 */
export const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };

// ── 빛 ────────────────────────────────────────────────────
/** 둥근 빛 번짐 (가운데 진하고 바깥으로 사라짐). add면 빛끼리 더해 밝아짐 */
export function glow(g, x, y, r, col, a = 1, add = true, core = 0.25) {
  if (r <= 0 || a <= 0) return;
  g.save(); if (add) g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, C(col, a)); gr.addColorStop(core, C(col, a * 0.55)); gr.addColorStop(0.6, C(col, a * 0.16)); gr.addColorStop(1, C(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
}
/** 가로 · 세로 비가 다른 빛 번짐 (sy < 1 이면 납작) */
export function glowOval(g, x, y, r, sy, col, a = 1, add = true, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, sy); glow(g, 0, 0, r, col, a, add); g.restore();
}
/** 네 갈래 반짝임 (가는 마름모 두 개 + 가운데 빛). size = 갈래 길이 */
export function glint(g, x, y, size, col, a = 1, rot = 0, thin = 0.16, core = '#ffffff') {
  if (size <= 0 || a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalCompositeOperation = 'lighter';
  glow(g, 0, 0, size * 0.9, col, a * 0.55, true);
  for (const [sx, sy] of [[1, thin], [thin, 1]]) {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, size);
    gr.addColorStop(0, C(core, a)); gr.addColorStop(0.35, C(col, a * 0.9)); gr.addColorStop(1, C(col, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(-size * sx, 0); g.lineTo(0, -size * sy); g.lineTo(size * sx, 0); g.lineTo(0, size * sy); g.closePath(); g.fill();
  }
  g.restore();
}
/** 둥근 고리 빛 (두께 w, 가장자리 부드럽게) */
export function ringGlow(g, x, y, r, w, col, a = 1, sy = 1, add = true) {
  if (r <= 0 || a <= 0) return;
  g.save(); g.translate(x, y); g.scale(1, sy); if (add) g.globalCompositeOperation = 'lighter';
  const r0 = Math.max(0, r - w), r1 = r + w, gr = g.createRadialGradient(0, 0, r0, 0, 0, r1);
  gr.addColorStop(0, C(col, 0)); gr.addColorStop(0.5, C(col, a)); gr.addColorStop(1, C(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r1, 0, TAU); g.arc(0, 0, r0, 0, TAU, true); g.fill(); g.restore();
}

// ── 곡선 · 띠 ─────────────────────────────────────────────
/** 3차 베지어 곡선 s (0–1) → 점 */
export const bez = (p0, p1, p2, p3) => s => { const u = 1 - s; return { x: u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0], y: u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1] }; };
/** 곡선 P의 s0–s1 구간을 두께 w(u) (u = 구간 안 0–1)인 띠 모양 경로로 */
export function ribbonPath(g, P, s0, s1, w, steps = 48) {
  const L = [], Rr = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, s = lerp(s0, s1, u), p = P(s), q = P(Math.min(1, s + 0.002)), q0 = P(Math.max(0, s - 0.002));
    let dx = q.x - q0.x, dy = q.y - q0.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const hw = Math.max(0, w(u)) / 2;
    L.push([p.x - dy * hw, p.y + dx * hw]); Rr.push([p.x + dy * hw, p.y - dx * hw]);
  }
  g.beginPath(); g.moveTo(L[0][0], L[0][1]);
  for (const p of L.slice(1)) g.lineTo(p[0], p[1]);
  for (const p of Rr.reverse()) g.lineTo(p[0], p[1]);
  g.closePath();
}
/** 가운데가 굵고 끝이 가는 두께 (뾰족한 붓 획) */
export const taper = (w, head = 0.25, tail = 0.6) => u => w * Math.min(1, u / Math.max(1e-3, head)) ** 0.6 * Math.min(1, (1 - u) / Math.max(1e-3, tail)) ** 0.8;
/** 빛 획: 어두운 테 → 색 몸통 → 흰 심 (세 겹 띠). 밝은 칸에서도 테가 윤곽을 잡음 */
export function lightStroke(g, P, s0, s1, w, { rim = '#3a2a10', body = '#ffd36a', core = '#ffffff', a = 1, rimW = 0.035, coreW = 0.38, glowCol = null, glowA = 0.5 } = {}) {
  if (s1 <= s0 || a <= 0) return;
  g.save();
  if (glowCol) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * glowA; g.filter = 'blur(3px)'; ribbonPath(g, P, s0, s1, u => w(u) * 2.2 + 0.04); g.fillStyle = C(glowCol, 1); g.fill(); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; }
  g.globalAlpha = a;
  ribbonPath(g, P, s0, s1, u => (w(u) > 0.001 ? w(u) + rimW * 2 : 0)); g.fillStyle = C(rim, 0.9); g.fill();
  ribbonPath(g, P, s0, s1, w); g.fillStyle = C(body, 1); g.fill();
  ribbonPath(g, P, s0, s1, u => w(u) * coreW); g.fillStyle = C(core, 0.95); g.fill();
  g.restore();
}

/**
 * 꼬리 빛 (혜성): 곡선 P 위 머리 s1에서 뒤로 s0까지. 꼬리로 갈수록 가늘고 옅어짐. 머리에 빛 구슬.
 * 빛 번짐 (흐림 + 더하기) → 어두운 테 → 색 몸통 → 흰 심 순서
 */
export function comet(g, P, s0, s1, { w = 0.12, rim = '#202838', body = '#ffd56b', core = '#ffffff', glowCol = body, a = 1, head = 1, rimW = 0.025, blur = 4 } = {}) {
  if (s1 <= s0 || a <= 0) return;
  const W = u => w * u ** 1.4;
  g.save(); g.globalAlpha = a;
  g.save(); g.globalCompositeOperation = 'lighter'; g.filter = `blur(${blur}px)`; ribbonPath(g, P, s0, s1, u => W(u) * 2.6 + 0.05); g.fillStyle = C(glowCol, 0.55); g.fill(); g.restore();
  const n = 14;
  for (let k = 0; k < n; k++) { // 꼬리 쪽은 옅게: 조각마다 불투명도
    const a0 = lerp(s0, s1, k / n), a1 = lerp(s0, s1, (k + 1) / n), u0 = k / n, u1 = (k + 1) / n, al = ((u0 + u1) / 2) ** 0.8;
    g.globalAlpha = a * al;
    ribbonPath(g, P, a0, Math.min(s1, a1 + 0.004), u => (W(lerp(u0, u1, u)) > 0.002 ? W(lerp(u0, u1, u)) + rimW * 2 : 0), 6); g.fillStyle = rim; g.fill();
  }
  for (let k = 0; k < n; k++) {
    const a0 = lerp(s0, s1, k / n), a1 = lerp(s0, s1, (k + 1) / n), u0 = k / n, u1 = (k + 1) / n, al = ((u0 + u1) / 2) ** 0.7;
    g.globalAlpha = a * al;
    ribbonPath(g, P, a0, Math.min(s1, a1 + 0.004), u => W(lerp(u0, u1, u)), 6); g.fillStyle = body; g.fill();
    ribbonPath(g, P, a0, Math.min(s1, a1 + 0.004), u => W(lerp(u0, u1, u)) * 0.4, 6); g.fillStyle = core; g.fill();
  }
  g.globalAlpha = a;
  if (head > 0) { const p = P(s1); glow(g, p.x, p.y, w * 2.8 * head, glowCol, 0.85, true); glow(g, p.x, p.y, w * 1.1 * head, core, 0.95, true, 0.5); }
  g.restore();
}
/** 경로 mk를 흐리게 더해 빛 번짐으로 (blur = 프레임 px) */
export function bloom(g, mk, col, a = 0.7, blur = 6) {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.filter = `blur(${blur}px)`; g.beginPath(); mk(g); g.fillStyle = C(col, a); g.fill(); g.restore();
}
/** 반짝이 가루 하나: 아주 작은 빛점 + 빛 번짐, phase로 깜빡임 */
export function speck(g, x, y, r, col, a = 1, tw = 0) {
  const k = a * (1 - 0.6 * tw);
  if (k <= 0 || r <= 0) return;
  glow(g, x, y, r * 5, col, 0.6 * k, true);
  g.save(); g.globalCompositeOperation = 'lighter'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = C('#ffffff', k); g.fill(); g.restore();
}

// ── 모양 경로 (가운데 (0,0), 크기 1 기준. 그리기 전에 translate · scale) ─────────
export const path = {
  /** n갈래 별: 바깥 1, 안쪽 inner */
  star(g, n = 5, inner = 0.45, rot = -Math.PI / 2) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? inner : 1, a = rot + (i * Math.PI) / n; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); },
  /** 정다각형 */
  poly(g, n = 6, rot = -Math.PI / 2) { g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + (i * TAU) / n; g.lineTo(Math.cos(a), Math.sin(a)); } g.closePath(); },
  /** 잎 (위로 뾰족, 길이 1 · 폭 w): 밑동 (0, 0.5) → 끝 (0, −0.5) */
  leaf(g, w = 0.42) { g.beginPath(); g.moveTo(0, 0.5); g.bezierCurveTo(w, 0.25, w * 0.8, -0.25, 0, -0.5); g.bezierCurveTo(-w * 0.8, -0.25, -w, 0.25, 0, 0.5); g.closePath(); },
  /** 꽃잎 (밑동 (0,0) → 끝 (0,−1), 끝이 둥긂) */
  petal(g, w = 0.55) { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(w, -0.25, w * 0.9, -0.95, 0, -1); g.bezierCurveTo(-w * 0.9, -0.95, -w, -0.25, 0, 0); g.closePath(); },
  /** 물방울 (위가 뾰족, 아래 둥긂. 높이 −1 ~ 0.55) */
  drop(g) { g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(0.18, -0.6, 0.55, -0.25, 0.55, 0.1); g.arc(0, 0.1, 0.55, 0, Math.PI); g.bezierCurveTo(-0.55, -0.25, -0.18, -0.6, 0, -1); g.closePath(); },
  /** 초승달 (오른쪽이 열림) */
  crescent(g, k = 0.62) { g.beginPath(); g.arc(0, 0, 1, rad(-110), rad(110), true); g.arc(k * 0.55, -0.05, k * 1.02, rad(115), rad(-115), false); g.closePath(); },
  /** 둥근 모서리 사각형 (가운데 기준 폭 w 높이 h) */
  rect(g, w, h, r = 0) { const x = -w / 2, y = -h / 2; g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); },
  /** 마름모 (가로 반폭 w, 세로 반높이 1) */
  diamond(g, w = 0.6) { g.beginPath(); g.moveTo(0, -1); g.lineTo(w, 0); g.lineTo(0, 1); g.lineTo(-w, 0); g.closePath(); },
};
/**
 * 굵은 윤곽 물체 (58 「황금빛 서사」: 단단한 물체는 거의 검은 굵은 외곽선): mk(g)가 경로를 만들면
 * 바깥 테 (rim, rimW) → 몸통 그라데이션 (위 밝음 hi → 아래 lo) → 왼쪽 위 하이라이트 획
 */
export function solid(g, mk, { hi = '#fff3c0', lo = '#c08020', rim = '#0e0e15', rimW = 0.06, a = 1, shine = 0.5, y0 = -1, y1 = 1 } = {}) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.lineJoin = 'round';
  g.beginPath(); mk(g); g.lineWidth = rimW * 2; g.strokeStyle = rim; g.stroke();
  const gr = g.createLinearGradient(-0.3, y0, 0.3, y1); gr.addColorStop(0, hi); gr.addColorStop(1, lo);
  g.fillStyle = gr; g.fill();
  if (shine > 0) { g.save(); g.beginPath(); mk(g); g.clip(); g.globalCompositeOperation = 'lighter'; const sh = g.createLinearGradient(-1, -1, 0.2, 0.2); sh.addColorStop(0, C('#ffffff', 0.55 * shine)); sh.addColorStop(0.45, C('#ffffff', 0)); g.fillStyle = sh; g.fillRect(-2, -2, 4, 4); g.restore(); }
  g.restore();
}
/** 빛 덩어리 모양 (외곽선 대신 자기 어두운 테 + 흰 심 + 빛 번짐) */
export function energy(g, mk, { rim = '#5a3a08', body = '#ffcf5a', core = '#ffffff', a = 1, rimW = 0.05, glowCol = null, glowR = 0.5, coreScale = 0.55 } = {}) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.lineJoin = 'round';
  if (glowCol) { g.save(); g.globalCompositeOperation = 'lighter'; g.filter = `blur(${Math.max(1, glowR * 10)}px)`; g.beginPath(); mk(g); g.fillStyle = C(glowCol, 0.7); g.fill(); g.restore(); }
  g.beginPath(); mk(g); g.lineWidth = rimW * 2; g.strokeStyle = C(rim, 0.95); g.stroke();
  g.fillStyle = body; g.fill();
  g.save(); g.scale(coreScale, coreScale); g.beginPath(); mk(g); g.fillStyle = C(core, 0.9); g.fill(); g.restore();
  g.restore();
}

// ── 입자 ─────────────────────────────────────────────────
/**
 * 입자 n개 (시드 고정): each(p, i, r)로 그림. p = { t0: 태어난 진행도, life, x0, y0, vx, vy, … } 은 make(r, i)가 정함.
 * age (0–1, 수명 안 진행도)가 0–1 사이인 입자만 그림
 */
export function particles(g, t, seed, n, make, draw) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const p = make(r, i), age = (t - p.t0) / p.life;
    if (age < 0 || age > 1) continue;
    draw(g, p, age, i);
  }
}
/** 둥근 빛 알갱이 (테 + 몸 + 흰 점) */
export function mote(g, x, y, r, col, a = 1, rim = null) {
  if (r <= 0 || a <= 0) return;
  g.save(); g.globalAlpha = a;
  glow(g, x, y, r * 3, col, 0.45 * a, true);
  if (rim) { g.beginPath(); g.arc(x, y, r * 1.35, 0, TAU); g.fillStyle = C(rim, 0.8); g.fill(); }
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill();
  g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
  g.restore();
}

/** 잎 하나 (가운데 (x, y), 길이 size, rot 라디안): 그라데이션 몸 + 어두운 테 + 밝은 잎맥 */
export function leafAt(g, x, y, size, rot, { hi = '#c8f07a', lo = '#2f8a3a', rim = '#123d14', vein = '#eaffc0', a = 1, w = 0.42 } = {}) {
  if (size <= 0 || a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(size, size);
  solid(g, gg => path.leaf(gg, w), { hi, lo, rim, rimW: 0.045, a, shine: 0.45, y0: -0.5, y1: 0.5 });
  g.globalAlpha = a * 0.8; g.strokeStyle = vein; g.lineWidth = 0.04; g.beginPath(); g.moveTo(0, 0.45); g.quadraticCurveTo(0.04, 0, 0, -0.42); g.stroke();
  g.restore();
}

// ── 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」) ─────
// 루프 t = 장 / 장 수 (0 ~ 1 앞)라 frac(t × 정수 + 어긋남)으로 만든 움직임은 마지막 장 다음이 첫 장으로 이어짐
/** 소수 부분 */
export const frac = v => v - Math.floor(v);
/** 0 ~ 1 물결 (한 바퀴에 k번) */
export const wave = (t, k = 1, ph = 0) => 0.5 + 0.5 * Math.sin(TAU * (t * k + ph));
/** 떠오르는 반짝이 가루: n개가 엇갈려 x0 ~ x1, y0에서 y1로 오르며 흔들리고 깜빡임 (한 바퀴에 per번) */
export function loopRise(g, t, n, { x0 = -0.6, x1 = 0.6, y0 = 0.5, y1 = -0.8, per = 1, sz = 0.022, col = '#ffffff', glowCol = col, a = 1, sway = 0.05, seed = 1 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const u = R(), ph = R(), s0 = R(), k = frac(t * per + i / n + ph * 0.13);
    const x = lerp(x0, x1, u) + sway * Math.sin(TAU * (k * 2 + ph)), y = lerp(y0, y1, k), al = bell(k, 0, 0.2, 1) * a, s = sz * (0.6 + 0.8 * s0);
    glow(g, x, y, s * 4.5, glowCol, 0.4 * al);
    speck(g, x, y, s, col, al, 0.5 + 0.5 * Math.sin(TAU * (k * 3 + ph)));
  }
}
/** 정한 자리마다 톡 켜졌다 꺼지는 반짝임 (자리마다 엇갈림, 한 바퀴에 per번) */
export function loopGlints(g, t, pts, { size = 0.16, col = '#ffffff', glowCol = col, per = 1, a = 1 } = {}) {
  pts.forEach(([x, y], i) => { const k = frac(t * per + i / pts.length + 0.05); glint(g, x, y, size * Math.sin(Math.PI * seg(k, 0, 0.3)), glowCol, a, 0.3 + i * 0.7, 0.13, col); });
}
/** 타원 (가운데 x, y · 반지름 rx, ry) 둘레를 도는 빛 점 m개 + 꼬리 (한 바퀴에 per바퀴, 뒤쪽 반은 옅게) */
export function loopOrbit(g, t, { x = 0, y = 0, rx = 0.6, ry = 0.9, m = 2, per = 1, col = '#ffffff', glowCol = col, sz = 0.05, tail = 0.6, a = 1, back = 1, ph = 0 } = {}) {
  for (let j = 0; j < m; j++) for (let q = 7; q >= 0; q--) {
    const ang = TAU * (t * per + j / m + ph) - (q / 7) * tail, px = x + Math.cos(ang) * rx, py = y + Math.sin(ang) * ry, k = 1 - q / 8, depth = lerp(back, 1, 0.5 + 0.5 * Math.sin(ang));
    glow(g, px, py, sz * (q ? 2.6 : 5) * k, glowCol, (q ? 0.35 : 0.8) * k * a * depth);
    if (!q) speck(g, px, py, sz, col, a * depth, 1);
  }
}

// ── 손그림 그림 (scripts/vfx/assets, 굽기가 읽어 둠) ─────────────
/** 그림 이름 → Image (굽기 페이지에서만 있음, 없으면 null: 그리기 함수가 도형으로 대신) */
export const asset = name => globalThis.VFX_ASSETS?.[name] ?? null;

// ── 프레임 그리기 (굽기 · 검수 공통) ───────────────────────
/** 이펙트 하나의 프레임 i를 S×S 캔버스 g에 (투명 배경에서 시작) */
export function drawFrame(g, fx, i, S) {
  g.save(); g.clearRect(0, 0, S, S);
  const half = fx.logical / 62, k = S / 2 / half;
  g.translate(S / 2, S / 2); g.scale(k, k);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 루프 (loop: 판 위에 서 있는 동안 계속 도는 그림): t = i / 장 수라 마지막 장 다음이 첫 장으로 이어짐. 한 번 재생은 0–1 끝까지
  const t = fx.loop ? i / fx.frames : fx.frames > 1 ? i / (fx.frames - 1) : 0;
  fx.draw(g, { t, f: i, n: fx.frames, px: 1 / k, sec: i / (fx.fps ?? 24) });
  // 가장자리를 둥글게 지움: 프레임 밖으로 나가는 빛이 게임에서 네모 테두리로 잘려 보이지 않게 (바깥 14%에서 사라짐)
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(0, 0, half * 0.84, 0, 0, half * 0.99);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(-half, -half, half * 2, half * 2);
  g.restore();
}
