// 점성술사: 호박 별빛 + 밤하늘 남보라 (성기사 금빛과 다르게 별 둘레에 보랏빛 밤 기운). 별 · 별자리 · 초승달 · 시계 바늘.
// 2026-10-19 Lim 「점성술사도 퀄리티 및 파티클 보강, 전면 개편」: 모양은 Codex 그림 (scripts/vfx/assets/astro-*), 움직임 · 빛 · 별가루는 코드
// 2026-10-19 Lim 「기억 스킬을 제외하고 나머지 스킬을 점성술사 색상에 맞춰서 크고 화려하게, 잠처럼 이미지 한 장이 유지되는 경우는 피하자」:
// 주인공이 칸 지름만큼, 맞는 순간 흰 섬광 + 호박 · 밤빛 보라 고리, 별가루마다 빛 번짐 · 1.5배, 그림은 늘 움직이고 (돌기 · 날기 · 터지기) 한자리에 머물지 않음
import { asset, bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, loopGlints, loopOrbit, loopRise, particles, path, rad, ringGlow, seg, solid, speck, TAU, wave } from './lib.mjs';

const AM = { rim: '#3a2108', deep: '#b8741e', body: '#e8b04a', light: '#ffe08a', core: '#fff8e0', glow: '#ffc85a' };
const NIGHT = { rim: '#120e30', deep: '#2a2470', mid: '#5a4fc0', glow: '#7a6af0', star: '#e8f0ff' };

/** 오각 별 (호박, 굵은 테) */
function star5(g, x, y, s, rot, a = 1, glowA = 0.6) {
  if (s <= 0 || a <= 0) return;
  glow(g, x, y, s * 2.4, NIGHT.glow, 0.45 * glowA * a);
  glow(g, x, y, s * 1.6, AM.glow, 0.6 * glowA * a);
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  solid(g, gg => path.star(gg, 5, 0.46), { hi: AM.core, lo: AM.deep, rim: AM.rim, rimW: 0.1, a, shine: 0.7 });
  g.restore();
}
/** 별빛 반짝임 (흰 심 + 호박 · 보랏빛 번짐) */
const twinkle = (g, x, y, s, a, rot = 0) => { glow(g, x, y, s * 1.8, NIGHT.glow, 0.5 * a); glint(g, x, y, s, AM.glow, a, rot, 0.13, AM.core); };

/** 그림 한 장 (가운데 (x, y), 폭 w, 비율 그대로). 없으면 false (도형으로 대신) */
function pic(g, name, x, y, w, a = 1, { sx = 1, sy = 1, rot = 0, add = 0, anchorY = 0.5, anchorX = 0.5 } = {}) {
  const img = asset(name);
  if (!img || a <= 0 || w <= 0) return !!img;
  const h = (w * img.height) / img.width;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.globalAlpha = a;
  g.drawImage(img, -w * anchorX, -h * anchorY, w, h);
  if (add > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * add; g.drawImage(img, -w * anchorX, -h * anchorY, w, h); }
  g.restore();
  return true;
}
/** 별가루 소용돌이 (호박 · 별빛 흰 · 보랏빛, 치유 공통): 발밑에서 돌며 떠오름 */
function starSwirl(g, t, seed, n, { y0 = 0.6, rise = 1.1, rr = 0.75, t0 = 0, span = 0.45, a = 1 } = {}) {
  const cols = [AM.light, NIGHT.star, AM.core, '#c8b8ff'];
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.016 + r() * 0.028, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: Math.floor(r() * 4) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22, al = bell(age, 0, 0.12, 1) * a;
    glow(gg, x, y, p.sz * 4.5, p.c === 3 || p.c === 1 ? NIGHT.glow : AM.glow, 0.4 * al);
    speck(gg, x, y, p.sz, cols[p.c], al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 사방으로 터지는 별가루 */
function starBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.9, sq = 0.8, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.016 + r() * 0.026, ph: r() * 9, v2: r() < 0.35 }), (gg, p, age) => {
    const d = p.v * E.out3(age), px = x + Math.cos(p.ang) * d, py = y + Math.sin(p.ang) * d * sq + grav * age * age, al = (1 - E.in2(age)) * a;
    glow(gg, px, py, p.sz * 4, p.v2 ? NIGHT.glow : AM.glow, 0.4 * al);
    speck(gg, px, py, p.sz * (1 - 0.4 * age), p.v2 ? '#c8b8ff' : age < 0.4 ? AM.core : AM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 위에서 내려앉는 별빛 방울 (마름모 빛) */
function starRain(g, t, seed, n, { x = 0, w = 0.9, y0 = -0.6, y1 = 0.55, t0 = 0, span = 0.45, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.3 + r() * 0.25, x: x + (r() - 0.5) * w, sz: 0.016 + r() * 0.026, ph: r() * 9 }), (gg, p, age) => {
    const y = lerp(y0, y1, E.in2(age) * 0.5 + age * 0.5), al = bell(age, 0, 0.15, 1) * a;
    glow(gg, p.x, y, p.sz * 5, NIGHT.glow, 0.35 * al);
    speck(gg, p.x, y, p.sz, age < 0.5 ? AM.core : AM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 차례로 톡톡 켜지는 작은 별 반짝임 */
function twinkles(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.3, h = 0.8, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r() }), (gg, p, age) => twinkle(gg, p.x, p.y - age * 0.08, 0.24 * Math.sin(Math.PI * age), a, p.rot));
}
/** 맞는 순간: 흰 섬광 + 호박 번짐 + 퍼지는 호박 고리 · 밤빛 보라 고리 (sy = 고리 납작함) */
function impact(g, t, { x = 0, y = 0, t0 = 0, r = 1.15, sy = 0.9, a = 1 } = {}) {
  const u = seg(t, t0, t0 + 0.45);
  glow(g, x, y, r * 1.05, NIGHT.glow, 0.5 * (1 - E.out2(seg(t, t0, t0 + 0.6))) * a);
  glow(g, x, y, r * 0.75, AM.glow, 0.5 * (1 - E.out2(seg(t, t0, t0 + 0.5))) * a);
  glow(g, x, y, r * 0.45, '#ffffff', 0.85 * bell(t, t0 - 0.02, t0 + 0.03, t0 + 0.28) * a);
  if (u > 0 && u < 1) { ringGlow(g, x, y, lerp(0.25, r * 1.2, E.out3(u)), 0.08, AM.light, 0.8 * (1 - u) * a, sy); ringGlow(g, x, y, lerp(0.15, r * 0.95, E.out3(seg(t, t0 + 0.06, t0 + 0.5))), 0.06, '#b8a8ff', 0.7 * (1 - u) * a, sy); }
}
const frac = v => v - Math.floor(v);

export default {
  /** 별빛 치유: 칸 위쪽에 Codex 호박 오각 별 (astro-pentastar)이 크게 톡 튀어나와 돌며 번쩍이고, 밤빛 기운이 감싼 가운데 별빛 방울이 몸으로 쏟아지며
   *  별이 작은 별가루로 퐁 터져 흩어지고 소용돌이치며 떠오름 (별은 계속 돌다 터짐, 한자리에 머물지 않음) */
  'astro-star': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.8), brk = seg(t, 0.5, 0.62), fade = 1 - E.in2(seg(t, 0.6, 1)), sy = -0.25, sz = 1.45 * pop * (1 + 0.25 * E.out2(brk));
      glow(g, 0, sy, 1.1, NIGHT.glow, 0.5 * fade);
      impact(g, t, { y: sy, t0: 0.08, r: 1.1 });
      if (brk < 1 && !pic(g, 'astro-pentastar', 0, sy, sz, (1 - brk) * fade, { rot: t * 4, add: 0.35 * (1 - seg(t, 0, 0.3)) + 0.5 * brk })) star5(g, 0, sy, 0.55 * pop, t * 4, (1 - brk) * fade);
      impact(g, t, { y: sy, t0: 0.52, r: 1.0 });
      for (let i = 0; i < 7; i++) { const q = seg(t, 0.52, 0.95), an = (i * TAU) / 7 + 0.4, dd = 0.2 + 1.0 * E.out3(q); if (q > 0 && q < 1) star5(g, Math.cos(an) * dd, sy + Math.sin(an) * dd * 0.85, 0.11 * (1 - q), an + t * 6, (1 - q) * fade, 0.8); }
      starRain(g, t, 3, 44, { w: 1.5, y0: sy, y1: 0.8, t0: 0.1, span: 0.45, a: fade });
      starBurst(g, t, 4, 36, { y: sy, sp: 1.2, sq: 0.85, t0: 0.52, a: fade });
      twinkles(g, t, 6, 7, { t0: 0.15, step: 0.06, w: 2.0, y0: 0, h: 1.8, a: fade });
      starSwirl(g, t, 5, 38, { y0: 0.75, rise: 1.35, rr: 0.95, t0: 0.2, span: 0.4, a: fade });
    },
  },

  /** 반짝임 (즉시): 칸 위 · 왼쪽 아래 · 오른쪽 아래에 Codex 네 갈래 별 (astro-sparkle4)이 크게 차례로 번쩍 켜지며 돌고, 굵은 별빛 선이 삼각형으로 잇고,
   *  별마다 별가루가 튀며 가운데에서 호박 · 보랏빛 고리가 퍼짐 */
  'astro-twinkle': {
    frames: 16, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.55, 1)), pts = [[0, -0.85], [-0.82, 0.55], [0.82, 0.55]];
      glow(g, 0, 0, 1.2, NIGHT.glow, 0.4 * fade);
      impact(g, t, { y: 0.05, t0: 0.32, r: 1.1 });
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 3], u = E.out2(seg(t, 0.1 + i * 0.1, 0.3 + i * 0.1));
        if (u > 0) lightStroke(g, s2 => ({ x: lerp(ax, bx, s2), y: lerp(ay, by, s2) }), 0, u, () => 0.035, { rim: NIGHT.rim, body: AM.light, core: AM.core, a: 0.8 * fade, rimW: 0.008, glowCol: NIGHT.glow, glowA: 0.6 });
        if (u > 0) for (let k = 0; k < 4; k++) { const s3 = frac(t * 3 + k / 4 + i * 0.3) * u; speck(g, lerp(ax, bx, s3), lerp(ay, by, s3), 0.02, k % 2 ? '#c8b8ff' : AM.core, 0.9 * fade, k * 0.3); }
      }
      pts.forEach(([x, y], i) => {
        const b = bell(t, i * 0.1, 0.12 + i * 0.1, 0.55 + i * 0.1);
        glow(g, x, y, 0.55, NIGHT.glow, 0.55 * b); glow(g, x, y, 0.3, AM.glow, 0.6 * b);
        if (!pic(g, 'astro-sparkle4', x, y, 1.15 * b, b, { rot: i * 0.3 + t * 4, add: 0.35 })) twinkle(g, x, y, 0.45 * b, b);
        starBurst(g, t, 7 + i, 16, { x, y, sp: 0.7, t0: i * 0.1, a: fade, grav: 0.15 });
      });
      starSwirl(g, t, 9, 30, { y0: 0.75, rise: 1.25, rr: 0.95, t0: 0.15, span: 0.35, a: fade });
    },
  },

  /** 별자리 표식 (지속 · 표식): 칸 위쪽에 Codex 네 갈래 별 (astro-sparkle4) 셋이 크게 차례로 켜지며 굵은 별빛 선으로 이어지는 별자리, 둘레에 밤빛 구름이 감돌고
   *  별가루가 선을 따라 흐르다 별자리가 몸으로 내려앉으며 작아져 사라지고 별빛 방울이 쏟아짐 */
  'astro-mark': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), sink = E.in2(seg(t, 0.55, 0.95)), base = [[-0.8, -0.32], [0, -0.92], [0.8, -0.38]];
      const pts = base.map(([x, y]) => [x * (1 - 0.5 * sink), lerp(y, 0.15, sink)]);
      glowOval(g, 0, lerp(-0.5, 0.15, sink), 1.3, 0.65, NIGHT.glow, 0.5 * fade);
      glowOval(g, 0, lerp(-0.55, 0.15, sink), 0.8, 0.45, NIGHT.mid, 0.35 * fade);
      impact(g, t, { y: -0.55, t0: 0.34, r: 1.05, sy: 0.6 });
      for (let i = 0; i < 2; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], u = E.out2(seg(t, 0.12 + i * 0.12, 0.32 + i * 0.12));
        if (u > 0) {
          lightStroke(g, s2 => ({ x: lerp(ax, bx, s2), y: lerp(ay, by, s2) }), 0, u, () => 0.04, { rim: NIGHT.rim, body: AM.light, core: AM.core, a: 0.9 * fade, rimW: 0.01, glowCol: NIGHT.glow, glowA: 0.65 });
          for (let k = 0; k < 6; k++) { const s3 = frac(t * 2 + k / 6 + i * 0.3) * u; speck(g, lerp(ax, bx, s3), lerp(ay, by, s3), 0.02, k % 2 ? '#c8b8ff' : AM.core, 0.85 * fade, k * 0.3); }
        }
      }
      pts.forEach(([x, y], i) => {
        const b = E.back(seg(t, i * 0.12, 0.15 + i * 0.12), 1.8) * (1 - 0.45 * sink);
        glow(g, x, y, 0.4, NIGHT.glow, 0.5 * fade);
        if (!pic(g, 'astro-sparkle4', x, y, 0.95 * b, fade, { rot: t * 3 + i, add: 0.3 })) twinkle(g, x, y, 0.36 * b, fade);
      });
      starRain(g, t, 3, 38, { w: 1.6, y0: -0.6, y1: 0.8, t0: 0.3, span: 0.45, a: fade });
      twinkles(g, t, 6, 6, { t0: 0.3, step: 0.06, w: 2.0, y0: -0.2, h: 1.4, a: fade });
      starSwirl(g, t, 5, 30, { y0: 0.75, rise: 1.25, rr: 0.95, t0: 0.3, span: 0.35, a: fade });
    },
  },

  /** 맑은 별빛 (해제): 별가루가 위아래 · 양옆에서 몸 가운데로 빨려 들어와, Codex 여섯 갈래 별 (astro-hexstar)로 칸만 하게 번쩍 터지며 돌고 어두운 조각을 튕겨 내고
   *  조각은 별가루로 부서짐. 호박 · 보랏빛 고리가 퍼지고 별가루가 사방으로 흩날림 */
  'astro-clear': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const hit = 0.3, fade = 1 - E.in2(seg(t, 0.6, 1));
      glow(g, 0, 0.05, 1.15, NIGHT.glow, 0.45 * fade);
      particles(g, t, 3, 54, r => ({ t0: r() * 0.15, life: hit - 0.02, a: r() * TAU, d: 1.0 + r() * 0.5, sz: 0.016 + r() * 0.022, v2: r() < 0.45 }), (gg, p, age) => {
        const k = E.in2(age), x = Math.cos(p.a) * p.d * (1 - k), y = 0.05 + Math.sin(p.a) * p.d * 0.9 * (1 - k), al = bell(age, 0, 0.2, 1);
        glow(gg, x, y, p.sz * 4, p.v2 ? NIGHT.glow : AM.glow, 0.4 * al); speck(gg, x, y, p.sz, p.v2 ? '#c8b8ff' : AM.light, al);
      });
      const b = bell(t, hit - 0.05, hit + 0.05, hit + 0.5);
      impact(g, t, { y: 0.05, t0: hit, r: 1.25 });
      if (b > 0.01 && !pic(g, 'astro-hexstar', 0, 0.05, 2.1 * E.back(seg(t, hit - 0.06, hit + 0.12), 1.5) * (1 - 0.3 * seg(t, hit + 0.2, 1)), b, { rot: t * 3, add: 0.4 })) twinkle(g, 0, 0.05, 0.8 * b, b);
      particles(g, t, 4, 8, (r, i) => ({ t0: hit, life: 0.55, a: rad(-170 + i * 45 + r() * 20), sz: 0.08 + r() * 0.04, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.35 + 1.0 * E.out3(age), x = Math.cos(p.a) * d, y = 0.05 + Math.sin(p.a) * d * 0.85, k = 1 - E.in2(seg(age, 0.35, 1));
        if (k > 0) { gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * k, p.sz * k); solid(gg, h => { h.beginPath(); for (let j = 0; j < 6; j++) { const aa = (j * TAU) / 6, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#6a5ab0', lo: '#1a1440', rim: '#08061a', rimW: 0.16, a: k, shine: 0.25 }); gg.restore(); }
        if (age > 0.35) for (let j = 0; j < 5; j++) { const q = seg(age, 0.35, 1), b2 = p.rot + j * 1.3; speck(gg, x + Math.cos(b2) * 0.18 * q, y + Math.sin(b2) * 0.18 * q, 0.02, AM.light, (1 - q) * fade); }
      });
      starBurst(g, t, 7, 56, { y: 0.05, sp: 1.45, sq: 0.9, t0: hit, a: fade, grav: 0.25 });
      twinkles(g, t, 9, 9, { t0: hit + 0.05, step: 0.05, w: 2.0, y0: 0, h: 1.7, a: fade });
      starSwirl(g, t, 11, 26, { y0: 0.75, rise: 1.25, rr: 0.95, t0: hit + 0.1, span: 0.3, a: fade });
    },
  },

  /** 별비 (회복한 칸마다): 왼쪽 위에서 Codex 꼬리별 (astro-comet) 넷이 차례로 크게 비스듬히 떨어져 칸 곳곳에 꽂히며, 닿는 자리마다 별빛이 번쩍 튀고
   *  호박 · 보랏빛 물결이 퍼지며 별가루가 흩날림 */
  'astro-fall': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), spots = [[-0.55, 0.62], [0.55, 0.48], [0.0, 0.75], [-0.15, 0.2]];
      glow(g, 0, 0.2, 1.15, NIGHT.glow, 0.4 * fade);
      spots.forEach(([tx, ty], i) => {
        const d = i * 0.09, u = seg(t, d, d + 0.18), x = lerp(tx - 1.3, tx, E.in2(u)), y = lerp(ty - 1.5, ty, E.in2(u));
        if (u > 0 && u < 1 && !pic(g, 'astro-comet', x, y, 1.9, 1, { anchorX: 0.86, anchorY: 0.86, add: 0.3 })) comet(g, s2 => ({ x: lerp(x - 0.7, x, s2), y: lerp(y - 0.8, y, s2) }), 0, 1, { w: 0.14, rim: AM.rim, body: AM.body, core: AM.core, glowCol: AM.glow });
        const hit = seg(t, d + 0.18, d + 0.6);
        if (hit > 0 && hit < 1) {
          glow(g, tx, ty, 0.6 * (1 - hit), AM.glow, 0.9 * (1 - hit));
          glow(g, tx, ty, 0.35 * (1 - hit), '#ffffff', 0.8 * (1 - E.out2(hit)));
          twinkle(g, tx, ty - 0.05, 0.4 * Math.sin(Math.PI * Math.min(1, hit * 1.5)), 1 - hit, i);
          ringGlow(g, tx, ty, lerp(0.1, 0.75, E.out3(hit)), 0.05, AM.light, 0.75 * (1 - hit), 0.34);
          ringGlow(g, tx, ty, lerp(0.05, 0.55, E.out3(seg(hit, 0.1, 1))), 0.04, '#b8a8ff', 0.7 * (1 - hit), 0.34);
        }
        starBurst(g, t, 11 + i, 18, { x: tx, y: ty, sp: 0.8, sq: 0.55, t0: d + 0.18, a: fade, grav: 0.35 });
      });
      twinkles(g, t, 6, 6, { t0: 0.25, step: 0.06, w: 2.0, y0: 0, h: 1.6, a: fade });
      starSwirl(g, t, 5, 34, { y0: 0.75, rise: 1.3, rr: 0.95, t0: 0.3, span: 0.4, a: fade });
    },
  },

  /** 별의 잠 (2026-10-19 Lim 「잠처럼 이미지 한 장이 유지되는 경우는 피하자」: 예전 별빛 고치 그림 한 장을 없앰): 밤빛 별가루 띠 둘이 발밑에서 몸을 휘감아 올라
   *  머리 위에서 만나며 번쩍 닫히고, Codex 초승달 (astro-moon)이 흔들리며 떠올라 돌다 사라지고, 작은 별들이 몸 둘레를 돌며 보랏빛 별가루가 천천히 내려앉음 */
  'astro-sleep': {
    frames: 24, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const wind = E.inOut(seg(t, 0, 0.45)), fade = 1 - E.in2(seg(t, 0.7, 1)), moon = E.back(seg(t, 0.2, 0.42), 1.6) * (1 - E.in2(seg(t, 0.62, 0.9))), close = bell(t, 0.4, 0.47, 0.75);
      glowOval(g, 0, 0.05, 0.95, 1.25, NIGHT.glow, (0.4 + 0.25 * close) * fade);
      glowOval(g, 0, 0.05, 0.65, 0.95, NIGHT.mid, 0.25 * fade);
      // 휘감아 오르는 별가루 띠 둘 (나선, 앞쪽은 진하게)
      for (const side of [0, Math.PI]) {
        const P = s2 => { const an = side + s2 * TAU * 1.25; return { x: Math.cos(an) * 0.72 * (1 - 0.25 * s2), y: lerp(0.95, -0.95, s2) }; };
        const head = wind, tail = Math.max(0, head - 0.55) + E.in2(seg(t, 0.55, 0.95)) * 0.45;
        if (head > tail + 0.01) lightStroke(g, P, tail, head, w0 => 0.07 * Math.sin(Math.PI * w0), { rim: NIGHT.rim, body: NIGHT.mid, core: '#d8d0ff', a: 0.85 * fade, rimW: 0.012, glowCol: NIGHT.glow, glowA: 0.7 });
        for (let k = 0; k < 10; k++) { const s3 = lerp(tail, head, frac(k / 10 + t * 1.5)), q = P(s3); speck(g, q.x, q.y, 0.022, k % 3 ? NIGHT.star : AM.light, 0.9 * fade, k * 0.4); }
        if (head < 1) { const q = P(head); glow(g, q.x, q.y, 0.3, NIGHT.glow, 0.8 * fade); glow(g, q.x, q.y, 0.12, '#ffffff', 0.8 * fade); }
      }
      impact(g, t, { y: -0.85, t0: 0.45, r: 0.8, sy: 0.7 });
      if (moon > 0.01 && !pic(g, 'astro-moon', 0.55, -0.62, 0.95 * moon, fade, { rot: -0.3 + 0.25 * Math.sin(t * 7), add: 0.3 * close })) { g.save(); g.translate(0.55, -0.62); g.scale(0.35 * moon, 0.35 * moon); solid(g, h => path.crescent(h), { hi: AM.core, lo: AM.deep, rim: AM.rim, a: fade }); g.restore(); }
      for (let i = 0; i < 7; i++) { const a = t * 4 + (i * TAU) / 7, x = Math.cos(a) * 0.85, y = 0.05 + Math.sin(a) * 1.05, front = Math.sin(a) > -0.2; twinkle(g, x, y, 0.13 * (0.6 + 0.4 * Math.sin(t * 20 + i)) * wind, fade * (front ? 1 : 0.55), a); }
      particles(g, t, 3, 40, r => ({ t0: r() * 0.7, life: 0.4 + r() * 0.3, x: (r() - 0.5) * 1.8, y: -0.95 + r() * 1.7, sz: 0.015 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => { const x = p.x + Math.sin(age * 4 + p.ph) * 0.05, y = p.y + 0.25 * age, al = bell(age, 0, 0.3, 1) * fade; glow(gg, x, y, p.sz * 4, NIGHT.glow, 0.4 * al); speck(gg, x, y, p.sz, p.ph > 4.5 ? NIGHT.star : '#c8b8ff', al, 0.5 + 0.5 * Math.sin(p.ph + age * 10)); });
    },
  },

  /** 별의 기억 (파티 전원 · 되감기): 칸 가운데 축에서 Codex 금빛 시계 바늘 (astro-hand, 끝에 별)이 한 바퀴 거꾸로 돌며 별가루 궤적을 남기고,
   *  다 돌면 끝 별이 크게 번쩍이며 별가루가 몸으로 쏟아짐. 파티 전원 칸이라 가볍게 */
  'astro-memory': {
    frames: 22, logical: 84, size: 288, scope: 'party',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.65, 1)), turn = E.inOut(seg(t, 0.05, 0.6)), ang = -TAU * turn, pop = E.back(seg(t, 0, 0.15), 1.6), L = 0.72, cy = 0.1;
      glow(g, 0, cy, 0.85, NIGHT.glow, 0.4 * fade);
      ringGlow(g, 0, cy, L * 0.98, 0.05, NIGHT.glow, 0.6 * fade * pop);
      glow(g, 0, cy, 0.12, AM.glow, 0.7 * fade * pop);
      // 궤적 (지나간 자리 호)
      if (turn > 0.01) {
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (let k = 0; k < 18; k++) { const s0 = k / 18 * turn, a0 = -Math.PI / 2 - TAU * s0; const al = (0.25 + 0.6 * (k / 18)) * fade; g.strokeStyle = C(AM.light, al * 0.75); g.lineWidth = 0.06; g.beginPath(); g.arc(0, cy, L * 0.9, a0, a0 - TAU * turn / 18, true); g.stroke(); }
        g.restore();
        for (let k = 0; k < 10; k++) { const s0 = frac(k * 0.13 + t) * turn, a0 = -Math.PI / 2 - TAU * s0; speck(g, Math.cos(a0) * L * 0.9, cy + Math.sin(a0) * L * 0.9, 0.013, AM.core, 0.8 * fade, k * 0.4); }
      }
      if (!pic(g, 'astro-hand', 0, cy, 0.86 * pop, fade, { anchorY: 0.93, rot: ang, sx: 1.7, add: 0.25 })) lightStroke(g, s2 => ({ x: Math.sin(-ang) * L * s2 * -1, y: cy - Math.cos(ang) * L * s2 }), 0, 1, () => 0.04, { rim: AM.rim, body: AM.body, core: AM.core, a: fade });
      const flash = bell(t, 0.58, 0.64, 0.85), tipx = Math.sin(-ang) * -L, tipy = cy - Math.cos(ang) * L;
      if (flash > 0) { glow(g, tipx, tipy, 0.4, AM.glow, 0.9 * flash); twinkle(g, tipx, tipy, 0.3 * flash, flash); }
      starRain(g, t, 3, 18, { w: 0.9, y0: -0.6, y1: 0.55, t0: 0.6, span: 0.25, a: fade });
      starSwirl(g, t, 5, 12, { y0: 0.55, rise: 0.8, rr: 0.6, t0: 0.6, span: 0.25, a: fade });
    },
  },

  /** 북극성 (한 명 큰 회복): Codex 큰 네 갈래 별 (astro-polaris)이 머리 위에서 내려와 몸 위에서 칸보다 크게 빛나며 돌고, 빛살이 뻗은 뒤
   *  작은 별 (astro-sparkle4) 여럿으로 터져 흩어지며 호박 · 보랏빛 고리가 퍼지고 별가루가 쏟아짐 */
  'astro-polaris': {
    frames: 22, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const down = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.62, 1)), y = lerp(-1.1, -0.05, down), burst = seg(t, 0.55, 0.8), grow = lerp(1.0, 1.95, E.out2(seg(t, 0.15, 0.5))) * (1 - 0.6 * E.in2(burst));
      glow(g, 0, y, 1.2, NIGHT.glow, 0.55 * fade);
      glow(g, 0, y, 0.55, '#ffffff', 0.42 * bell(t, 0.25, 0.45, 0.65));
      impact(g, t, { y: -0.05, t0: 0.3, r: 1.2, a: 0.8 });
      if (burst < 1 && !pic(g, 'astro-polaris', 0, y, grow, (1 - E.in2(burst)) * fade, { rot: t * 1.6, add: 0.4 * bell(t, 0.3, 0.5, 0.7) })) twinkle(g, 0, y, 0.8 * grow, 1 - burst);
      impact(g, t, { y: -0.05, t0: 0.56, r: 1.3 });
      for (let i = 0; i < 10; i++) {
        const a = (i * TAU) / 10 + 0.3, d = 0.2 + 1.1 * E.out3(burst), x = Math.cos(a) * d, yy = y + Math.sin(a) * d * 0.85, s = 0.48 * Math.sin(Math.PI * Math.min(1, burst * 1.3));
        if (burst > 0 && s > 0.01 && !pic(g, 'astro-sparkle4', x, yy, s, fade, { rot: a + t * 3, add: 0.3 })) twinkle(g, x, yy, s * 0.4, fade);
      }
      starBurst(g, t, 3, 60, { y, sp: 1.45, sq: 0.9, t0: 0.55, a: fade, grav: 0.3 });
      starRain(g, t, 5, 40, { w: 1.6, y0: y, y1: 0.8, t0: 0.4, span: 0.35, a: fade });
      twinkles(g, t, 6, 8, { t0: 0.35, step: 0.05, w: 2.1, y0: 0, h: 1.8, a: fade });
      starSwirl(g, t, 7, 40, { y0: 0.75, rise: 1.35, rr: 1.0, t0: 0.5, span: 0.35, a: fade });
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 점성술사 초신성 (board-supernova, 바닥 그림): 가운데 별 보석이 크게 숨 쉬고, 빛살 넷이 천천히 돌며, 작은 별빛이 둘레를 돌고 호박 · 보랏빛 가루가 떠오름 */
  'astro-nova-loop': {
    frames: 36, fps: 12, loop: true, logical: 84, size: 256, scope: 'target',
    draw(g, { t }) {
      const cy = -0.1;
      glow(g, 0, cy, 0.7, NIGHT.glow, 0.12 + 0.12 * wave(t, 1));
      glow(g, 0, cy, 0.45, AM.glow, 0.2 + 0.25 * wave(t, 2));
      glow(g, 0, cy, 0.16, '#ffffff', 0.25 + 0.35 * wave(t, 2));
      for (let i = 0; i < 4; i++) glint(g, 0, cy, 0.62 + 0.08 * wave(t, 2, i * 0.25), AM.glow, 0.35 + 0.2 * wave(t, 2, i * 0.25), TAU * (t / 4 + i / 8), 0.06, AM.core);
      loopOrbit(g, t, { y: cy, rx: 0.62, ry: 0.5, m: 3, per: 1, col: NIGHT.star, glowCol: NIGHT.glow, sz: 0.048, tail: 0.8, back: 0.5 });
      loopRise(g, t, 14, { x0: -0.6, x1: 0.6, y0: 0.5, y1: -0.9, per: 1, sz: 0.032, col: AM.core, glowCol: AM.glow, sway: 0.06, seed: 41 });
      loopGlints(g, t, [[-0.55, -0.35], [0.5, -0.4], [0, -0.75], [0.45, 0.25]], { size: 0.21, col: AM.core, glowCol: AM.glow });
    },
  },
  /** 별의 잠에 든 사람 (2026-10-19 Lim 「이미지 한장이 유지되는 경우는 피하자」: 고치 그림 없이 이 루프만): 몸을 밤빛 보라가 숨 쉬듯 감싸고, 흰 별빛 셋이 꼬리를 끌며 몸 둘레를 돌고
   *  작은 별이 반대로 돌며, 머리 위 초승달 자리에 호박 반짝임이 켜지고 보랏빛 별가루가 느리게 떠오름. 좌표 1 = 칸 지름 × 1.03의 반 (board.ts r × 2.06) */
  'astro-sleep-loop': {
    frames: 36, fps: 12, loop: true, logical: 74, size: 256, scope: 'target',
    draw(g, { t }) {
      glowOval(g, 0, 0, 0.6, 0.85, NIGHT.glow, 0.1 + 0.1 * wave(t, 1));
      glowOval(g, 0, 0, 0.42, 0.62, NIGHT.mid, 0.08 + 0.08 * wave(t, 1, 0.5));
      loopOrbit(g, t, { rx: 0.55, ry: 0.82, m: 3, per: 1, col: '#ffffff', glowCol: '#c8c0ff', sz: 0.06, tail: 1.0, back: 0.6 });
      loopOrbit(g, t, { rx: 0.42, ry: 0.62, m: 2, per: -1, col: AM.core, glowCol: AM.glow, sz: 0.045, tail: 0.7, back: 0.5, ph: 0.25 });
      loopRise(g, t, 14, { x0: -0.5, x1: 0.5, y0: 0.75, y1: -0.85, per: 1, sz: 0.03, col: NIGHT.star, glowCol: NIGHT.glow, sway: 0.08, seed: 43 });
      loopGlints(g, t, [[0.34, -0.7], [-0.5, -0.35], [0.5, 0.35], [-0.3, 0.6], [0.05, -0.2]], { size: 0.22, col: AM.core, glowCol: AM.glow });
    },
  },
};
