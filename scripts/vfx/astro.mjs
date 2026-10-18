// 점성술사: 호박 별빛 + 밤하늘 남보라 (성기사 금빛과 다르게 별 둘레에 보랏빛 밤 기운). 별 · 별자리 · 초승달 · 시계 바늘.
// 2026-10-19 Lim 「점성술사도 퀄리티 및 파티클 보강, 전면 개편」: 모양은 Codex 그림 (scripts/vfx/assets/astro-*), 움직임 · 빛 · 별가루는 코드
import { asset, bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, seg, solid, speck, TAU } from './lib.mjs';

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
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.012 + r() * 0.022, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: Math.floor(r() * 4) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22;
    speck(gg, x, y, p.sz, cols[p.c], bell(age, 0, 0.12, 1) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 사방으로 터지는 별가루 */
function starBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.9, sq = 0.8, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.012 + r() * 0.02, ph: r() * 9, v2: r() < 0.3 }), (gg, p, age) => {
    const d = p.v * E.out3(age);
    speck(gg, x + Math.cos(p.ang) * d, y + Math.sin(p.ang) * d * sq + grav * age * age, p.sz * (1 - 0.4 * age), p.v2 ? '#c8b8ff' : age < 0.4 ? AM.core : AM.light, (1 - E.in2(age)) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 위에서 내려앉는 별빛 방울 (마름모 빛) */
function starRain(g, t, seed, n, { x = 0, w = 0.9, y0 = -0.6, y1 = 0.55, t0 = 0, span = 0.45, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.3 + r() * 0.25, x: x + (r() - 0.5) * w, sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const y = lerp(y0, y1, E.in2(age) * 0.5 + age * 0.5), al = bell(age, 0, 0.15, 1) * a;
    glow(gg, p.x, y, p.sz * 5, NIGHT.glow, 0.35 * al);
    speck(gg, p.x, y, p.sz, age < 0.5 ? AM.core : AM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 차례로 톡톡 켜지는 작은 별 반짝임 */
function twinkles(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.3, h = 0.8, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r() }), (gg, p, age) => twinkle(gg, p.x, p.y - age * 0.08, 0.17 * Math.sin(Math.PI * age), a, p.rot));
}
const frac = v => v - Math.floor(v);

export default {
  /** 별빛 치유: 머리 위에 Codex 호박 오각 별 (astro-pentastar)이 톡 떠올라 천천히 돌며 빛나고, 밤빛 기운이 감싼 가운데 별빛 방울이 몸으로 쏟아져 내리며
   *  별이 작아질 때 별가루가 터지고 소용돌이치며 떠오름 */
  'astro-star': {
    frames: 20, logical: 88, size: 288, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.8), shrink = 1 - 0.55 * E.in2(seg(t, 0.45, 0.9)), fade = 1 - E.in2(seg(t, 0.6, 1)), sy = -0.6;
      glow(g, 0, sy, 0.75, NIGHT.glow, 0.5 * fade);
      glow(g, 0, 0.1, 0.9, AM.glow, 0.35 * bell(t, 0.1, 0.35, 0.9));
      glow(g, 0, sy, 0.3, '#ffffff', 0.6 * (1 - E.out3(seg(t, 0, 0.3))));
      if (!pic(g, 'astro-pentastar', 0, sy, 0.78 * pop * shrink, fade, { rot: t * 1.6, add: 0.3 * (1 - seg(t, 0, 0.3)) })) star5(g, 0, sy, 0.3 * pop * shrink, t * 1.6, fade);
      starRain(g, t, 3, 30, { w: 0.8, y0: sy + 0.15, y1: 0.55, t0: 0.1, span: 0.45, a: fade });
      starBurst(g, t, 4, 18, { y: sy, sp: 0.7, sq: 0.8, t0: 0.5, a: fade });
      starSwirl(g, t, 5, 26, { y0: 0.55, rise: 1.0, rr: 0.7, t0: 0.2, span: 0.4, a: fade });
    },
  },

  /** 반짝임 (즉시): 위 · 왼쪽 아래 · 오른쪽 아래에 Codex 네 갈래 별 (astro-sparkle4)이 차례로 번쩍 켜지며 가는 별빛 선이 삼각형으로 잇고, 별가루가 튐 */
  'astro-twinkle': {
    frames: 16, logical: 86, size: 256, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.55, 1)), pts = [[0, -0.62], [-0.6, 0.45], [0.6, 0.45]];
      glow(g, 0, 0, 0.9, NIGHT.glow, 0.35 * fade);
      glow(g, 0, 0, 0.4, '#ffffff', 0.45 * (1 - E.out3(seg(t, 0, 0.25))));
      // 선 (차례로 이어짐)
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 3], u = E.out2(seg(t, 0.1 + i * 0.1, 0.3 + i * 0.1));
        if (u > 0) lightStroke(g, s2 => ({ x: lerp(ax, bx, s2), y: lerp(ay, by, s2) }), 0, u, () => 0.02, { rim: NIGHT.rim, body: AM.light, core: AM.core, a: 0.7 * fade, rimW: 0.006, glowCol: NIGHT.glow, glowA: 0.5 });
      }
      pts.forEach(([x, y], i) => {
        const b = bell(t, i * 0.1, 0.1 + i * 0.1, 0.5 + i * 0.1);
        glow(g, x, y, 0.35, NIGHT.glow, 0.5 * b);
        if (!pic(g, 'astro-sparkle4', x, y, 0.75 * b, b, { rot: i * 0.3 + t * 2, add: 0.3 })) twinkle(g, x, y, 0.3 * b, b);
        starBurst(g, t, 7 + i, 8, { x, y, sp: 0.4, t0: i * 0.1, a: fade, grav: 0.15 });
      });
      starSwirl(g, t, 9, 18, { y0: 0.5, rise: 0.9, rr: 0.6, t0: 0.15, span: 0.35, a: fade });
    },
  },

  /** 별자리 표식 (지속 · 표식): 머리 위에 Codex 네 갈래 별 (astro-sparkle4) 셋이 차례로 켜지며 별빛 선으로 이어지는 작은 별자리, 둘레에 밤빛 구름이 감돌고
   *  별가루가 선을 따라 흐르며 몸 위로 내려앉음 */
  'astro-mark': {
    frames: 20, logical: 88, size: 288, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), pts = [[-0.52, -0.5], [0, -0.82], [0.52, -0.55]];
      glowOval(g, 0, -0.6, 1.0, 0.5, NIGHT.glow, 0.45 * fade);
      glowOval(g, 0, -0.62, 0.6, 0.4, NIGHT.mid, 0.3 * fade);
      for (let i = 0; i < 2; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], u = E.out2(seg(t, 0.12 + i * 0.12, 0.32 + i * 0.12));
        if (u > 0) {
          lightStroke(g, s2 => ({ x: lerp(ax, bx, s2), y: lerp(ay, by, s2) }), 0, u, () => 0.025, { rim: NIGHT.rim, body: AM.light, core: AM.core, a: 0.85 * fade, rimW: 0.008, glowCol: NIGHT.glow, glowA: 0.6 });
          for (let k = 0; k < 4; k++) { const s3 = frac(t * 2 + k / 4 + i * 0.3) * u; speck(g, lerp(ax, bx, s3), lerp(ay, by, s3), 0.014, AM.core, 0.8 * fade, k * 0.3); }
        }
      }
      pts.forEach(([x, y], i) => {
        const b = E.back(seg(t, i * 0.12, 0.15 + i * 0.12), 1.8) * (1 - 0.25 * seg(t, 0.5, 1));
        if (!pic(g, 'astro-sparkle4', x, y, 0.55 * b, fade, { rot: t * 1.2 + i, add: 0.25 })) twinkle(g, x, y, 0.22 * b, fade);
      });
      starRain(g, t, 3, 22, { w: 1.0, y0: -0.5, y1: 0.55, t0: 0.3, span: 0.45, a: fade });
      starSwirl(g, t, 5, 18, { y0: 0.55, rise: 0.9, rr: 0.6, t0: 0.3, span: 0.35, a: fade });
    },
  },

  /** 맑은 별빛 (해제): 별가루가 위아래에서 몸 가운데로 빨려 들어와, Codex 여섯 갈래 별 (astro-hexstar)로 번쩍 터지며 어두운 조각을 튕겨 내고
   *  조각은 별가루로 부서짐. 빛 고리가 퍼지고 별가루가 사방으로 흩날림 */
  'astro-clear': {
    frames: 20, logical: 92, size: 320, scope: 'target',
    draw(g, { t }) {
      const hit = 0.3, fade = 1 - E.in2(seg(t, 0.6, 1));
      glow(g, 0, 0.05, 0.9, NIGHT.glow, 0.45 * fade);
      // 빨려 드는 별가루
      particles(g, t, 3, 36, r => ({ t0: r() * 0.15, life: hit - 0.02, dir: r() < 0.5 ? -1 : 1, x: (r() - 0.5) * 1.2, sz: 0.012 + r() * 0.018 }), (gg, p, age) => {
        const k = E.in2(age), x = p.x * (1 - k), y = p.dir * 1.0 * (1 - k) + 0.05 * k;
        speck(gg, x, y, p.sz, p.dir > 0 ? AM.light : '#c8b8ff', bell(age, 0, 0.2, 1));
      });
      const b = bell(t, hit - 0.05, hit + 0.05, hit + 0.45);
      glow(g, 0, 0.05, 0.5, '#ffffff', 0.85 * bell(t, hit - 0.03, hit + 0.02, hit + 0.25));
      ringGlow(g, 0, 0.05, lerp(0.2, 1.15, E.out3(seg(t, hit, hit + 0.45))), 0.08, AM.light, 0.8 * (1 - seg(t, hit + 0.1, hit + 0.5)), 0.9);
      if (b > 0.01 && !pic(g, 'astro-hexstar', 0, 0.05, 1.25 * E.back(seg(t, hit - 0.06, hit + 0.12), 1.5) * (1 - 0.3 * seg(t, hit + 0.2, 1)), b, { rot: t * 1.5, add: 0.35 })) twinkle(g, 0, 0.05, 0.5 * b, b);
      // 튕겨 나가는 어두운 조각 → 별가루
      particles(g, t, 4, 6, (r, i) => ({ t0: hit, life: 0.55, a: rad(-160 + i * 50 + r() * 20), sz: 0.06 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.25 + 0.85 * E.out3(age), x = Math.cos(p.a) * d, y = 0.05 + Math.sin(p.a) * d * 0.85, k = 1 - E.in2(seg(age, 0.35, 1));
        if (k > 0) { gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * k, p.sz * k); solid(gg, h => { h.beginPath(); for (let j = 0; j < 6; j++) { const aa = (j * TAU) / 6, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#6a5ab0', lo: '#1a1440', rim: '#08061a', rimW: 0.16, a: k, shine: 0.25 }); gg.restore(); }
        if (age > 0.35) for (let j = 0; j < 4; j++) { const q = seg(age, 0.35, 1), b2 = p.rot + j * 1.6; speck(gg, x + Math.cos(b2) * 0.13 * q, y + Math.sin(b2) * 0.13 * q, 0.014, AM.light, (1 - q) * fade); }
      });
      starBurst(g, t, 7, 34, { y: 0.05, sp: 1.05, sq: 0.85, t0: hit, a: fade, grav: 0.25 });
      twinkles(g, t, 9, 6, { t0: hit + 0.05, step: 0.05, w: 1.4, y0: 0, h: 1.0, a: fade });
    },
  },

  /** 별비 (회복한 칸마다): 왼쪽 위에서 Codex 꼬리별 (astro-comet) 셋이 차례로 비스듬히 떨어져 발밑에 꽂히며, 닿는 자리마다 별빛이 번쩍 튀고
   *  보랏빛 물결이 퍼지며 별가루가 흩날림 */
  'astro-fall': {
    frames: 20, logical: 90, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), by = 0.55, spots = [[-0.32, by], [0.3, by - 0.12], [0.02, by + 0.05]];
      glow(g, 0, 0.1, 0.9, NIGHT.glow, 0.35 * fade);
      spots.forEach(([tx, ty], i) => {
        const d = i * 0.12, u = seg(t, d, d + 0.2), x = lerp(tx - 1.1, tx, E.in2(u)), y = lerp(ty - 1.25, ty, E.in2(u));
        if (u > 0 && u < 1 && !pic(g, 'astro-comet', x, y, 1.35, 1, { anchorX: 0.86, anchorY: 0.86, add: 0.2 })) comet(g, s2 => ({ x: lerp(x - 0.5, x, s2), y: lerp(y - 0.55, y, s2) }), 0, 1, { w: 0.1, rim: AM.rim, body: AM.body, core: AM.core, glowCol: AM.glow });
        const hit = seg(t, d + 0.2, d + 0.6);
        if (hit > 0 && hit < 1) {
          glow(g, tx, ty, 0.4 * (1 - hit), AM.glow, 0.9 * (1 - hit));
          twinkle(g, tx, ty - 0.05, 0.28 * Math.sin(Math.PI * Math.min(1, hit * 1.5)), 1 - hit, i);
          ringGlow(g, tx, ty, lerp(0.08, 0.55, E.out3(hit)), 0.04, NIGHT.glow, 0.7 * (1 - hit), 0.32);
        }
        starBurst(g, t, 11 + i, 12, { x: tx, y: ty, sp: 0.55, sq: 0.5, t0: d + 0.2, a: fade, grav: 0.35 });
      });
      starSwirl(g, t, 5, 22, { y0: 0.55, rise: 1.0, rr: 0.7, t0: 0.3, span: 0.4, a: fade });
    },
  },

  /** 별의 잠: 몸을 Codex 별빛 고치 (astro-cocoon, 남보라 반투명 고치에 금빛 별)가 위아래로 펼쳐지며 감싸고, 오른쪽 위에 Codex 초승달 (astro-moon)이 떠오름.
   *  고치 둘레로 작은 별이 반짝이고 별가루가 천천히 떠다님 */
  'astro-sleep': {
    frames: 24, logical: 92, size: 320, scope: 'target',
    draw(g, { t }) {
      const open = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.7, 1)), moon = E.back(seg(t, 0.15, 0.4), 1.6);
      glowOval(g, 0, 0.05, 0.8, 1.3, NIGHT.glow, 0.45 * fade);
      if (!pic(g, 'astro-cocoon', 0, 0.05, 1.25, 0.9 * fade, { sy: open, add: 0.15 * (0.5 + 0.5 * Math.sin(t * 9)) })) {
        g.save(); g.globalAlpha = 0.5 * fade; g.beginPath(); g.ellipse(0, 0.05, 0.6, 1.0 * open, 0, 0, TAU); g.fillStyle = C(NIGHT.mid, 0.4); g.fill(); g.restore();
      }
      if (moon > 0.01 && !pic(g, 'astro-moon', 0.62, -0.72, 0.62 * moon, fade, { rot: -0.2 + 0.08 * Math.sin(t * 5) })) { g.save(); g.translate(0.62, -0.72); g.scale(0.25 * moon, 0.25 * moon); solid(g, h => path.crescent(h), { hi: AM.core, lo: AM.deep, rim: AM.rim, a: fade }); g.restore(); }
      // 고치 둘레를 천천히 도는 작은 별
      for (let i = 0; i < 6; i++) { const a = t * 3 + (i * TAU) / 6, x = Math.cos(a) * 0.68, y = 0.05 + Math.sin(a) * 1.0, front = Math.cos(a * 0.5) > 0; twinkle(g, x, y, 0.09 * (0.6 + 0.4 * Math.sin(t * 20 + i)) * open, fade * (front ? 1 : 0.6), a); }
      particles(g, t, 3, 26, r => ({ t0: r() * 0.7, life: 0.4 + r() * 0.3, x: (r() - 0.5) * 1.4, y: -0.8 + r() * 1.6, sz: 0.011 + r() * 0.015, ph: r() * 9 }), (gg, p, age) => speck(gg, p.x + Math.sin(age * 4 + p.ph) * 0.05, p.y - 0.2 * age, p.sz, p.ph > 4.5 ? NIGHT.star : '#c8b8ff', bell(age, 0, 0.3, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 10)));
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

  /** 북극성 (한 명 큰 회복): Codex 큰 네 갈래 별 (astro-polaris)이 머리 위에서 내려와 몸 위에서 크게 빛나며 천천히 돌고, 빛살이 뻗은 뒤
   *  작은 별 (astro-sparkle4) 여럿으로 터져 흩어지며 별가루가 쏟아짐 */
  'astro-polaris': {
    frames: 22, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const down = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.62, 1)), y = lerp(-1.05, -0.05, down), burst = seg(t, 0.55, 0.8), grow = lerp(0.7, 1.35, E.out2(seg(t, 0.15, 0.5))) * (1 - 0.6 * E.in2(burst));
      glow(g, 0, y, 0.95, NIGHT.glow, 0.5 * fade);
      glow(g, 0, y, 0.5, '#ffffff', 0.6 * bell(t, 0.25, 0.45, 0.65));
      if (burst < 1 && !pic(g, 'astro-polaris', 0, y, grow, (1 - E.in2(burst)) * fade, { rot: t * 0.8, add: 0.35 * bell(t, 0.3, 0.5, 0.7) })) twinkle(g, 0, y, 0.6 * grow, 1 - burst);
      // 터지며 흩어지는 작은 별
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + 0.3, d = 0.15 + 0.85 * E.out3(burst), x = Math.cos(a) * d, yy = y + Math.sin(a) * d * 0.85, s = 0.32 * Math.sin(Math.PI * Math.min(1, burst * 1.3));
        if (burst > 0 && s > 0.01 && !pic(g, 'astro-sparkle4', x, yy, s, fade, { rot: a + t * 3 })) twinkle(g, x, yy, s * 0.4, fade);
      }
      starBurst(g, t, 3, 40, { y, sp: 1.1, sq: 0.85, t0: 0.55, a: fade, grav: 0.3 });
      starRain(g, t, 5, 26, { w: 1.0, y0: y, y1: 0.6, t0: 0.4, span: 0.35, a: fade });
      starSwirl(g, t, 7, 28, { y0: 0.55, rise: 1.0, rr: 0.75, t0: 0.5, span: 0.35, a: fade });
    },
  },
};
