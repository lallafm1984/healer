// 결계사: 노란 발광 빛 (Lim 2026-10-16 「흰색이라서 퀄리티가 더 떨어져보인다. 노란 발광의 빛이나게」).
// 막 · 장막 · 결계는 둥글게, 스킬 이름에서 모양을 따옴 (Lim 2026-10-16 「결계사의 막, 빛의장막, 결계 이펙트를 각지게 하지말고 이름을 따와서」). 인장 (X · 마름모) · 결계 정화 (깨지는 유리)는 그대로.
// 성기사 금빛 (주황 기운) · 점성술사 호박과 다르게 맑은 레몬 노랑 + 강한 빛 번짐, 어두운 호박 갈색 테.
// 2026-10-19 Lim 「결계사도 퀄리티 및 파티클 보강, 전면 개편」: 모양은 Codex 그림 (scripts/vfx/assets/warder-*), 움직임 · 빛 · 노란 빛가루는 코드
import { asset, bell, bloom, C, comet, E, energy, frac, glint, glow, glowOval, lerp, lightStroke, loopGlints, loopRise, particles, path, rad, ringGlow, seg, solid, speck, TAU, wave } from './lib.mjs';

const Y = { rim: '#3d2a00', deep: '#c99600', body: '#ffd51f', light: '#fff06a', core: '#fffde8', glow: '#ffe23a' };

/** 빛 선 (곧은 막대): (x0, y0) → (x1, y1), 두께 w, 진행 k (0–1) */
function beam(g, x0, y0, x1, y1, w, a = 1, k = 1, glowA = 0.6) {
  if (k <= 0 || a <= 0) return;
  lightStroke(g, s => ({ x: lerp(x0, x1, s), y: lerp(y0, y1, s) }), 0, k, () => w, { rim: Y.rim, body: Y.body, core: Y.core, a, rimW: 0.022, coreW: 0.42, glowCol: Y.glow, glowA });
}
/** 네모 테 (가운데 (x, y), 폭 w · 높이 h, 선 두께 lw): 어두운 테 → 노란 몸 → 흰 심 + 빛 번짐 */
function frame(g, x, y, w, h, lw, a = 1, rot = 0, glowA = 0.6) {
  if (a <= 0 || w <= 0 || h <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a; g.lineJoin = 'miter';
  bloom(g, gg => { gg.beginPath(); gg.rect(-w / 2 - lw, -h / 2 - lw, w + lw * 2, h + lw * 2); gg.rect(w / 2 - lw, -h / 2 + lw, -(w - lw * 2), h - lw * 2); }, Y.glow, glowA, 5);
  g.beginPath(); g.rect(-w / 2, -h / 2, w, h);
  g.lineWidth = lw + 0.05; g.strokeStyle = C(Y.rim, 0.92); g.stroke();
  g.lineWidth = lw; g.strokeStyle = Y.body; g.stroke();
  g.lineWidth = lw * 0.38; g.strokeStyle = Y.core; g.stroke();
  g.restore();
}
/** 네모 반짝임 (모서리 십자) */
const cornerGlint = (g, x, y, s, a) => glint(g, x, y, s, Y.glow, a, 0, 0.12, Y.core);

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
/** 노란 빛가루 소용돌이 (회복 · 보호 공통): 발밑에서 돌며 떠오름 */
function lightSwirl(g, t, seed, n, { y0 = 0.6, rise = 1.1, rr = 0.75, t0 = 0, span = 0.45, a = 1 } = {}) {
  const cols = [Y.light, Y.core, Y.glow];
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.012 + r() * 0.022, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: Math.floor(r() * 3) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22;
    speck(gg, x, y, p.sz, cols[p.c], bell(age, 0, 0.12, 1) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 사방으로 터지는 노란 빛가루 */
function lightBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.9, sq = 0.8, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const d = p.v * E.out3(age);
    speck(gg, x + Math.cos(p.ang) * d, y + Math.sin(p.ang) * d * sq + grav * age * age, p.sz * (1 - 0.4 * age), age < 0.4 ? Y.core : Y.light, (1 - E.in2(age)) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 위에서 몸으로 떨어져 스미는 빛 방울 */
function lightRain(g, t, seed, n, { w = 0.9, y0 = -0.6, y1 = 0.5, t0 = 0, span = 0.45, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.3 + r() * 0.25, x: (r() - 0.5) * w, sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const y = lerp(y0, y1, E.in2(age) * 0.5 + age * 0.5), al = bell(age, 0, 0.15, 1) * a;
    glow(gg, p.x, y, p.sz * 5, Y.glow, 0.4 * al);
    speck(gg, p.x, y, p.sz, age < 0.5 ? Y.core : Y.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 차례로 켜지는 반짝임 */
function glints(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.3, h = 0.8, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.08, 0.17 * Math.sin(Math.PI * age), Y.glow, a, p.rot, 0.13, Y.core));
}

export default {
  /** 인장 치유: 머리 위에 Codex X자 인장 (warder-xseal)이 도장 찍듯 크게 내려와 쾅 맞물리며 번쩍이고, 노란 빛 고리가 퍼지며
   *  빛 방울이 몸으로 떨어져 스미고 빛가루가 소용돌이치며 떠오름 */
  'warder-seal': {
    frames: 20, logical: 92, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), sy = -0.55, stamp = E.in2(seg(t, 0, 0.16)), hit = bell(t, 0.13, 0.18, 0.45), s = lerp(1.5, 0.85, stamp) * (1 + 0.06 * hit);
      glow(g, 0, sy, 0.75, Y.glow, (0.3 + 0.5 * hit) * fade);
      glow(g, 0, sy, 0.3, '#ffffff', 0.8 * hit);
      ringGlow(g, 0, sy, lerp(0.2, 1.0, E.out3(seg(t, 0.15, 0.55))), 0.07, Y.light, 0.8 * (1 - seg(t, 0.2, 0.6)), 0.85);
      if (!pic(g, 'warder-xseal', 0, sy, s, Math.min(1, t * 8) * fade, { add: 0.5 * hit })) { beam(g, -0.4, sy - 0.4, 0.4, sy + 0.4, 0.1, fade); beam(g, 0.4, sy - 0.4, -0.4, sy + 0.4, 0.1, fade); }
      lightBurst(g, t, 3, 22, { y: sy, sp: 0.8, sq: 0.8, t0: 0.14, a: fade, grav: 0.2 });
      lightRain(g, t, 4, 26, { w: 0.8, y0: sy + 0.15, y1: 0.55, t0: 0.2, span: 0.45, a: fade });
      lightSwirl(g, t, 5, 24, { y0: 0.55, rise: 1.0, rr: 0.7, t0: 0.3, span: 0.4, a: fade });
    },
  },

  /** 결계 정화 (해제, 2026-10-19 Lim 「사각형 각진것을 둥글게 다시 표현」): 몸을 Codex 노란 빛 방울 (warder-bubble, 안에 어두운 기운이 갇힘)이 톡 감싸 숨 쉬듯 흔들리며
   *  금이 번지다 퐁 터지고, 둥근 충격파 고리 둘 · Codex 둥근 빛 구슬 터짐 (warder-burst)이 퍼지며 어두운 티끌이 노란 빛가루로 타 사라지고 둥근 빛 구슬이 사방으로 튐 (모서리 · 직선 없음) */
  'warder-cleanse': {
    frames: 18, logical: 94, size: 320, scope: 'target',
    draw(g, { t }) {
      const brk = 0.32, fade = 1 - E.in2(seg(t, 0.6, 1)), appear = E.back(seg(t, 0, 0.16), 1.6), tense = seg(t, 0.16, brk), wob = Math.sin(t * 70) * 0.035 * tense;
      glow(g, 0, 0.05, 0.95, Y.glow, 0.45 * fade);
      // 빛 방울: 터지기 직전 조금 부풀고 (가로 · 세로 엇갈려 흔들림), 터지는 순간 커지며 사라짐
      const pop = seg(t, brk, brk + 0.12), bw = 1.15 * appear * (1 + 0.06 * tense + 0.35 * E.out2(pop));
      if (pop < 1 && !pic(g, 'warder-bubble', 0, 0.05, bw, 0.95 * (1 - pop), { sx: 1 + wob, sy: 1 - wob, add: 0.25 + 0.45 * tense })) {
        glow(g, 0, 0.05, bw * 0.5, Y.glow, 0.6 * (1 - pop)); ringGlow(g, 0, 0.05, bw * 0.45, 0.06, Y.light, 0.9 * (1 - pop));
      }
      const b = bell(t, brk - 0.03, brk + 0.02, brk + 0.3);
      glow(g, 0, 0.05, 0.65, '#ffffff', 0.9 * b);
      if (t >= brk) {
        const u = seg(t, brk, 1);
        for (const [d, w, al] of [[0, 0.08, 0.9], [0.08, 0.05, 0.6]]) { const q = seg(u, d, d + 0.5); if (q > 0 && q < 1) ringGlow(g, 0, 0.05, lerp(0.35, 1.25, E.out3(q)), w, Y.light, al * (1 - q) * fade); }
        pic(g, 'warder-burst', 0, 0.05, lerp(0.8, 1.9, E.out3(u)), (1 - seg(u, 0.15, 0.75)) * fade, { rot: u * 0.6, add: 0.35 * (1 - u) });
        // 어두운 티끌 → 노란 빛가루
        particles(g, u, 7, 14, r => ({ t0: 0, life: 0.5 + r() * 0.3, a: r() * TAU, v: 0.5 + r() * 0.7, sz: 0.03 + r() * 0.03 }), (gg, p, age) => {
          const d = p.v * E.out3(age), x = Math.cos(p.a) * d, y = 0.05 + Math.sin(p.a) * d * 0.85, burn = seg(age, 0.3, 1);
          bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * (1 - burn), 0, TAU); }, '#3a1a50', 0.6 * (1 - burn) * fade, 3);
          if (burn > 0) speck(gg, x, y - 0.1 * burn, 0.015, Y.light, (1 - burn) * fade);
        });
        lightBurst(g, u, 9, 40, { y: 0.05, sp: 1.15, sq: 0.9, a: fade, grav: 0.25 });
        glints(g, u, 11, 6, { t0: 0.02, step: 0.05, w: 1.4, y0: 0, h: 1.0, a: fade });
        lightSwirl(g, u, 13, 18, { y0: 0.6, rise: 1.0, rr: 0.7, t0: 0.15, span: 0.3, a: fade });
      }
    },
  },

  /** 심판 (인장 터뜨리기, 회복한 인장 칸마다 · 공격 아님): 몸 위에 Codex 마름모 인장 (warder-diamond)이 떠올라 빛나다가 네 갈래 빛줄기로 풀려 위로 퍼지고,
   *  풀려난 빛가루가 몸으로 스며듦 */
  'warder-judgment': {
    frames: 18, logical: 88, size: 288, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), pop = E.back(seg(t, 0, 0.2), 1.7), open = seg(t, 0.35, 0.7), cy = -0.25;
      glow(g, 0, cy, 0.8, Y.glow, 0.45 * fade);
      glow(g, 0, cy, 0.3, '#ffffff', 0.7 * bell(t, 0.25, 0.35, 0.55));
      if (open < 1 && !pic(g, 'warder-diamond', 0, cy, 0.85 * pop * (1 + 0.2 * open), (1 - E.in2(open)) * fade, { add: 0.4 * bell(t, 0.2, 0.35, 0.5) })) frame(g, 0, cy, 0.5, 0.5, 0.06, 1 - open, Math.PI / 4);
      // 네 갈래 빛줄기 (위 · 좌우 위로 풀림)
      if (open > 0) for (let i = 0; i < 4; i++) {
        const a = rad(-90 + (i - 1.5) * 28), L = 1.1 * E.out3(open), w = 0.08 * (1 - seg(t, 0.6, 1));
        lightStroke(g, s2 => ({ x: Math.cos(a) * lerp(0.15, L, s2), y: cy + Math.sin(a) * lerp(0.15, L, s2) }), Math.max(0, E.out2(open) - 0.6), 1, uu => w * (1 - uu * 0.6), { rim: Y.rim, body: Y.body, core: Y.core, a: fade, rimW: 0.018, glowCol: Y.glow, glowA: 0.6 });
      }
      lightBurst(g, t, 3, 20, { y: cy, sp: 0.8, sq: 0.7, t0: 0.38, a: fade, grav: 0.4 });
      lightRain(g, t, 4, 20, { w: 0.8, y0: cy, y1: 0.55, t0: 0.4, span: 0.35, a: fade });
      lightSwirl(g, t, 5, 18, { y0: 0.55, rise: 0.9, rr: 0.6, t0: 0.4, span: 0.3, a: fade });
    },
  },

  /** 빛의 막 (보호막, 둥글게): 몸 앞에 Codex 둥근 빛 막 (warder-membrane)이 가운데에서 옆으로 펼쳐지며 씌워지고, 윤이 한 번 미끄러지며
   *  막 위로 빛가루가 흐르다 막 테두리에서 반짝이가 켜지고 빛가루로 걷힘 */
  'warder-barrier': {
    frames: 22, logical: 96, size: 320, scope: 'target',
    draw(g, { t }) {
      const unfold = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.62, 1)), R = 0.9;
      glow(g, 0, 0.05, 0.95, Y.glow, 0.4 * fade);
      glow(g, 0, 0.05, 0.4, '#ffffff', 0.4 * (1 - E.out3(seg(t, 0, 0.3))));
      if (!pic(g, 'warder-membrane', 0, 0.05, 2 * R, 0.5 * fade, { sx: lerp(0.15, 1, unfold), add: 0.2 * bell(t, 0.2, 0.35, 0.6) })) { g.save(); g.globalAlpha = 0.4 * fade; g.beginPath(); g.ellipse(0, 0.05, R * unfold, R, 0, 0, TAU); g.fillStyle = C(Y.glow, 0.3); g.fill(); g.restore(); }
      // 윤 (비스듬히 미끄러지는 빛 띠)
      const sw = seg(t, 0.3, 0.6);
      if (sw > 0 && sw < 1) { g.save(); g.beginPath(); g.ellipse(0, 0.05, R * 0.95, R * 0.95, 0, 0, TAU); g.clip(); g.globalCompositeOperation = 'lighter'; const x = lerp(-1.2, 1.2, sw); const gr = g.createLinearGradient(x - 0.25, 0, x + 0.25, 0); gr.addColorStop(0, C(Y.light, 0)); gr.addColorStop(0.5, C(Y.core, 0.55 * fade)); gr.addColorStop(1, C(Y.light, 0)); g.fillStyle = gr; g.translate(x, 0); g.rotate(0.35); g.fillRect(-0.25, -1.5, 0.5, 3); g.restore(); }
      // 테두리 반짝임 · 막 위 흐르는 빛가루
      for (let i = 0; i < 6; i++) { const a = rad(-120 + i * 48), b = bell(t, 0.25 + i * 0.04, 0.32 + i * 0.04, 0.55 + i * 0.04); glint(g, Math.cos(a) * R * unfold, 0.05 + Math.sin(a) * R, 0.14 * b, Y.glow, b * fade, a, 0.14, Y.core); }
      particles(g, t, 3, 30, r => ({ t0: 0.15 + r() * 0.5, life: 0.4, a: r() * TAU, rr: r() * 0.85, sz: 0.012 + r() * 0.015 }), (gg, p, age) => speck(gg, Math.cos(p.a + age) * p.rr * unfold, 0.05 + Math.sin(p.a + age) * p.rr, p.sz, Y.light, bell(age, 0, 0.2, 1) * fade, age * 4));
      lightSwirl(g, t, 5, 20, { y0: 0.55, rise: 1.0, rr: 0.75, t0: 0.5, span: 0.3, a: fade });
    },
  },

  /** 결계 원 (범위 칸마다): 빛 점 하나가 발밑에 Codex 빛 원 문양 (warder-circle, 여섯 꽃잎 호)을 그리며 닫고, 원이 은은히 빛나다
   *  빛 점들이 원에서 떠오름. 여러 칸이라 적당히 */
  'warder-circle': {
    frames: 20, logical: 82, size: 288, scope: 'target',
    draw(g, { t }) {
      const draw = E.inOut(seg(t, 0, 0.4)), fade = 1 - E.in2(seg(t, 0.62, 1)), by = 0.55, W = 1.75;
      glowOval(g, 0, by, 0.95, 0.3, Y.glow, 0.5 * fade);
      if (draw > 0.01) {
        g.save(); g.translate(0, by); g.scale(1, 0.34); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 3, Math.PI / 2, Math.PI / 2 + TAU * draw); g.closePath(); g.restore(); g.save(); g.clip();
        if (!pic(g, 'warder-circle', 0, by, W, fade, { add: 0.35 * bell(t, 0.35, 0.45, 0.7) })) ringGlow(g, 0, by, 0.8, 0.06, Y.light, fade, 0.34);
        g.restore();
        const a = Math.PI / 2 + TAU * draw, hx = Math.cos(a) * W * 0.47, hy = by + Math.sin(a) * W * 0.47 * 0.36;
        if (draw < 1) { glow(g, hx, hy, 0.22, Y.glow, 0.9 * fade); speck(g, hx, hy, 0.028, Y.core, fade); }
      }
      particles(g, t, 3, 22, r => ({ t0: 0.4 + r() * 0.35, life: 0.4, a: r() * TAU, sz: 0.012 + r() * 0.016, ph: r() * 9 }), (gg, p, age) => speck(gg, Math.cos(p.a) * W * 0.45, by + Math.sin(p.a) * W * 0.16 - 0.9 * E.out2(age), p.sz, Y.light, bell(age, 0, 0.2, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 16)));
      glints(g, t, 5, 4, { t0: 0.4, step: 0.06, w: 1.5, y0: by - 0.05, h: 0.3, a: fade });
    },
  },

  /** 수호 결계 (큰 보호막): 몸 둘레에 Codex 빛 띠 지구본 (warder-globe)이 작게 맺혔다 크게 펼쳐지며 천천히 돌고, 띠를 따라 빛 구슬이 돌며
   *  결계가 한 번 번쩍인 뒤 빛가루로 옅어짐 */
  'warder-guard': {
    frames: 22, logical: 96, size: 320, scope: 'target',
    draw(g, { t }) {
      const grow = E.back(seg(t, 0, 0.3), 1.4), fade = 1 - E.in2(seg(t, 0.62, 1)), R = 0.92, flash = bell(t, 0.3, 0.38, 0.6);
      glow(g, 0, 0.05, 1.0, Y.glow, (0.35 + 0.35 * flash) * fade);
      glow(g, 0, 0.05, 0.4, '#ffffff', 0.5 * flash);
      if (!pic(g, 'warder-globe', 0, 0.05, 2 * R * grow, 0.7 * fade, { sx: 1 + 0.04 * Math.sin(t * 9), add: 0.35 * flash })) ringGlow(g, 0, 0.05, R * grow, 0.06, Y.light, fade);
      // 띠를 도는 빛 구슬 (가로 띠 · 세로 띠)
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + (i * TAU) / 3; glow(g, Math.cos(a) * R * grow, 0.05 + Math.sin(a) * R * 0.18 * grow, 0.1, Y.glow, 0.7 * fade); speck(g, Math.cos(a) * R * grow, 0.05 + Math.sin(a) * R * 0.18 * grow, 0.026, Y.core, fade);
        const b2 = t * 6 + (i * TAU) / 3 + 1; speck(g, Math.cos(b2) * R * 0.4 * grow, 0.05 + Math.sin(b2) * R * grow, 0.022, Y.core, 0.9 * fade);
      }
      lightBurst(g, t, 3, 26, { y: 0.05, sp: 1.0, sq: 0.9, t0: 0.32, a: fade, grav: 0.1 });
      glints(g, t, 5, 6, { t0: 0.3, step: 0.05, w: 1.6, y0: 0.05, h: 1.4, a: fade });
      lightSwirl(g, t, 7, 22, { y0: 0.6, rise: 1.1, rr: 0.8, t0: 0.4, span: 0.35, a: fade });
    },
  },

  /** 빛의 장막 (장막 칸마다): 발밑에서 Codex 주름진 빛 장막 (warder-veil)이 물결치며 위로 솟아올랐다가 위부터 빛가루로 풀려 흩날림. 여러 칸이라 적당히 */
  'warder-veil': {
    frames: 24, logical: 82, size: 288, scope: 'target',
    draw(g, { t }) {
      const rise = E.out3(seg(t, 0, 0.35)), melt = E.in2(seg(t, 0.5, 0.95)), fade = 1 - E.in2(seg(t, 0.7, 1)), foot = 0.85, H = 1.65, W = 1.7;
      glowOval(g, 0, foot - 0.05, 0.95, 0.3, Y.glow, 0.5 * fade);
      const top = foot - H * rise, cut = lerp(top, foot, melt);
      if (cut < foot - 0.02) {
        g.save(); g.beginPath(); g.rect(-2, cut, 4, foot - cut + 0.1); g.clip();
        if (!pic(g, 'warder-veil', Math.sin(t * 9) * 0.02, foot, W, 0.6, { anchorY: 0.96, sy: (H / (W * 468 / 512)) * rise, add: 0.2 * (0.5 + 0.5 * Math.sin(t * 12)) })) { g.globalAlpha = 0.4; g.fillStyle = C(Y.glow, 0.4); g.fillRect(-0.8, top, 1.6, foot - top); }
        g.restore();
      }
      // 풀려 흩날리는 빛가루 (장막 윗선에서)
      particles(g, t, 3, 34, r => ({ t0: 0.45 + r() * 0.45, life: 0.35 + r() * 0.2, x: (r() - 0.5) * 1.5, sz: 0.012 + r() * 0.018, ph: r() * 9 }), (gg, p, age) => {
        const y0 = lerp(foot - H, foot, E.in2(seg(p.t0, 0.5, 0.95))), x = p.x + Math.sin(age * 6 + p.ph) * 0.06, y = y0 - 0.4 * E.out2(age);
        speck(gg, x, y, p.sz, age < 0.4 ? Y.core : Y.light, (1 - age) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      glints(g, t, 5, 4, { t0: 0.25, step: 0.07, w: 1.4, y0: 0, h: 1.2, a: fade });
    },
  },

  /** 결계 굳히기 (늘린 보호막마다): 몸 둘레 둥근 빛 막 (warder-membrane) 위로 크게 둘러진 두 번째 막이 조여 덮여 두꺼워지고, 네 곳에 Codex 빛 매듭 (warder-knot)이
   *  톡 맺히며 빛실로 이어진 뒤 빛가루가 막 위로 흐름 */
  'warder-hold': {
    frames: 20, logical: 92, size: 320, scope: 'target',
    draw(g, { t }) {
      const close = E.inOut(seg(t, 0, 0.35)), fade = 1 - E.in2(seg(t, 0.65, 1)), R = 0.82, R2 = lerp(1.35, R * 1.04, close), lock = bell(t, 0.32, 0.4, 0.65);
      glow(g, 0, 0.05, 0.95, Y.glow, (0.35 + 0.35 * lock) * fade);
      pic(g, 'warder-membrane', 0, 0.05, 2 * R, 0.5 * fade, {});
      if (!pic(g, 'warder-membrane', 0, 0.05, 2 * R2, (0.25 + 0.35 * close) * fade, { rot: (1 - close) * 1.2, add: 0.4 * lock })) ringGlow(g, 0, 0.05, R2, 0.06, Y.light, fade);
      // 네 매듭 + 빛실
      const knots = [0, 1, 2, 3].map(i => { const a = rad(-90 + i * 90); return [Math.cos(a) * R, 0.05 + Math.sin(a) * R]; });
      const kn = E.back(seg(t, 0.35, 0.5), 2);
      if (kn > 0) {
        for (let i = 0; i < 4; i++) {
          const [ax, ay] = knots[i], [bx, by] = knots[(i + 1) % 4], a0 = rad(-90 + i * 90), u = E.out2(seg(t, 0.42 + i * 0.03, 0.6 + i * 0.03));
          if (u > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = C(Y.light, 0.75 * fade); g.lineWidth = 0.03; g.beginPath(); g.arc(0, 0.05, R, a0, a0 + rad(90) * u); g.stroke(); g.restore(); }
        }
        knots.forEach(([x, y], i) => { if (!pic(g, 'warder-knot', x, y, 0.42 * kn, fade, { rot: i * 0.6 + t * 2, add: 0.3 })) glint(g, x, y, 0.15 * kn, Y.glow, fade, 0, 0.14, Y.core); });
      }
      lightBurst(g, t, 3, 24, { y: 0.05, sp: 0.95, sq: 0.9, t0: 0.34, a: fade, grav: 0.1 });
      lightSwirl(g, t, 5, 20, { y0: 0.6, rise: 1.0, rr: 0.75, t0: 0.4, span: 0.35, a: fade });
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 결계사 성채 (board-citadel, 바닥 그림): 창 · 성문이 노랗게 숨 쉬듯 빛나고, 성 아래에 노란 결계 고리가 퍼지며, 노란 빛 가루가 떠오르고 첨탑 끝이 차례로 반짝임 */
  'warder-citadel-loop': {
    frames: 36, fps: 12, loop: true, logical: 84, size: 256, scope: 'target',
    draw(g, { t }) {
      [[0, 0.44, 0.3], [0, -0.3, 0.2], [-0.5, -0.1, 0.16], [0.56, -0.1, 0.16]].forEach(([x, y, r], i) => { glow(g, x, y, r, Y.glow, 0.2 + 0.3 * wave(t, 2, i * 0.25)); glow(g, x, y, r * 0.4, Y.core, 0.15 + 0.3 * wave(t, 2, i * 0.25)); });
      for (const k of [0, 0.5]) { const a = frac(t * 2 + k); ringGlow(g, 0, 0.72, lerp(0.35, 0.95, E.out2(a)), 0.05, Y.glow, 0.4 * (1 - a) * seg(a, 0, 0.1), 0.3); }
      loopRise(g, t, 16, { x0: -0.8, x1: 0.8, y0: 0.7, y1: -0.9, per: 1, sz: 0.035, col: Y.core, glowCol: Y.glow, sway: 0.05, seed: 31 });
      loopGlints(g, t, [[0, -0.96], [-0.6, -0.6], [0.64, -0.6], [-0.3, -0.75], [0.32, -0.72]], { size: 0.255, col: Y.core, glowCol: Y.glow });
    },
  },
};
