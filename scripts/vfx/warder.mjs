// 결계사: 노란 발광 빛 (Lim 2026-10-16 「흰색이라서 퀄리티가 더 떨어져보인다. 노란 발광의 빛이나게」). 둥근 것 없이 네모 · 곧은 선 · 유리판.
// 성기사 금빛 (주황 기운) · 점성술사 호박과 다르게 맑은 레몬 노랑 + 강한 빛 번짐, 어두운 호박 갈색 테
import { bell, bloom, C, comet, E, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, seg, solid, speck, TAU } from './lib.mjs';

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
/** 노란 유리판 (반투명 몸 + 가는 격자) */
function pane(g, x, y, w, h, a, rot = 0) {
  if (a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, C(Y.light, 0.42)); gr.addColorStop(0.5, C(Y.glow, 0.2)); gr.addColorStop(1, C(Y.body, 0.38));
  g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = C(Y.light, 0.35); g.lineWidth = 0.018;
  for (let i = 1; i < 3; i++) { const xx = -w / 2 + (w * i) / 3; g.beginPath(); g.moveTo(xx, -h / 2); g.lineTo(xx, h / 2); g.stroke(); }
  for (let i = 1; i < 4; i++) { const yy = -h / 2 + (h * i) / 4; g.beginPath(); g.moveTo(-w / 2, yy); g.lineTo(w / 2, yy); g.stroke(); }
  g.restore();
}
/** 네모 반짝임 (모서리 십자) */
const cornerGlint = (g, x, y, s, a) => glint(g, x, y, s, Y.glow, a, 0, 0.12, Y.core);

export default {
  /** 인장 치유: 머리 위에 굵은 노란 빛 두 획이 차례로 엇갈려 그어지고 (X), 네모 인장 테가 둘리고 가운데 마름모가 번쩍인 뒤 빛 점이 몸으로 떨어짐 */
  'warder-seal': {
    frames: 20, logical: 92, scope: 'target',
    draw(g, { t }) {
      const cy = -0.42, s1 = E.out3(seg(t, 0, 0.18)), s2 = E.out3(seg(t, 0.1, 0.28)), fade = 1 - E.in2(seg(t, 0.55, 1)), drop = E.in2(seg(t, 0.5, 1));
      const y = cy + 0.25 * drop, sc = 1 - 0.35 * drop;
      glow(g, 0, y, 0.95, Y.glow, 0.7 * fade);
      glow(g, 0, y, 0.45, '#ffffff', 0.8 * (1 - E.out3(seg(t, 0, 0.35))));
      const L = 0.36 * sc;
      // 네 모서리 꺾쇠 (인장 테두리: 막힌 네모는 상자처럼 보여서 모서리만)
      const br = bell(t, 0.1, 0.28, 1) * fade, R = L * 1.35, c = 0.32 * L;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        lightStroke(g, s => (s < 0.5 ? { x: sx * R, y: y + sy * lerp(R - c * 1.6, R, s * 2) } : { x: sx * lerp(R, R - c * 1.6, (s - 0.5) * 2), y: y + sy * R }), 0, 1, () => 0.05, { rim: Y.rim, body: Y.body, core: Y.core, a: br, rimW: 0.018 });
      }
      beam(g, -L, y - L, L, y + L, 0.13 * sc, fade, s1, 0.8);
      beam(g, L, y - L, -L, y + L, 0.13 * sc, fade, s2, 0.8);
      const d = bell(t, 0.25, 0.32, 0.7);
      g.save(); g.translate(0, y); g.scale(0.13 * d + 0.001, 0.2 * d + 0.001); solid(g, gg => path.diamond(gg, 0.62), { hi: Y.core, lo: Y.body, rim: Y.rim, rimW: 0.14, shine: 0.6 }); g.restore();
      glint(g, 0, y, 0.55 * d, Y.glow, d, rad(45), 0.12, Y.core);
      particles(g, t, 3, 12, r => ({ t0: 0.32 + r() * 0.3, life: 0.4, x: (r() - 0.5) * 0.8, sz: 0.02 + r() * 0.015 }), (gg, p, age) => speck(gg, p.x * (1 - age * 0.4), y + 0.15 + 0.85 * E.in2(age), p.sz, Y.glow, (1 - age) * fade));
    },
  },

  /** 빛의 막 (보호막): 몸 앞에 세로로 긴 노란 유리판이 아래에서 펼쳐져 세워지고, 비스듬한 반사광이 판을 훑고 네 모서리에 반짝임 */
  'warder-barrier': {
    frames: 22, logical: 96, scope: 'target',
    draw(g, { t }) {
      const open = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.6, 1)), W = 1.12, H = 1.62 * open, cy = 0.78 - H / 2;
      glowOval(g, 0, 0.78, 0.9, 0.3, Y.glow, 0.8 * (1 - E.out2(seg(t, 0, 0.6))));
      if (H > 0.02) {
        pane(g, 0, cy, W, H, fade);
        // 반사광 (비스듬한 띠가 왼쪽 아래 → 오른쪽 위로)
        const sw = seg(t, 0.25, 0.6);
        if (sw > 0 && sw < 1) {
          g.save(); g.beginPath(); g.rect(-W / 2, cy - H / 2, W, H); g.clip(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(Math.PI * sw) * fade;
          const x = lerp(-W, W, sw); g.translate(x, cy); g.rotate(rad(30));
          const gr = g.createLinearGradient(-0.16, 0, 0.16, 0); gr.addColorStop(0, C(Y.glow, 0)); gr.addColorStop(0.5, C('#ffffff', 0.95)); gr.addColorStop(1, C(Y.glow, 0));
          g.fillStyle = gr; g.fillRect(-0.16, -2, 0.32, 4); g.fillRect(0.2, -2, 0.07, 4); g.restore();
        }
        frame(g, 0, cy, W, H, 0.075, fade, 0, 0.75);
        const c = bell(t, 0.2, 0.32, 0.7);
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cornerGlint(g, sx * W / 2, cy + sy * H / 2, 0.28 * c, c);
      }
      particles(g, t, 7, 10, r => ({ t0: 0.1 + r() * 0.4, life: 0.4, x: (r() - 0.5) * W, y: 0.7 - r() * 1.4 }), (gg, p, age) => speck(gg, p.x, p.y - 0.25 * age, 0.018, Y.light, (1 - age) * fade));
    },
  },

  /** 결계 원 (범위 칸마다): 칸 네 모서리에서 노란 빛 말뚝이 차례로 솟고, 그 사이 바닥이 네모로 은은히 빛남 */
  'warder-circle': {
    frames: 20, logical: 82, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), floor = E.out3(seg(t, 0.05, 0.35));
      // 바닥 네모 (위에서 비스듬히 본 마름모꼴)
      const P = [[-0.72, 0.42], [0.72, 0.42], [0.55, -0.05], [-0.55, -0.05]];
      g.save(); g.globalAlpha = fade * floor;
      g.beginPath(); P.forEach(([x, y]) => g.lineTo(x, y)); g.closePath();
      const gr = g.createLinearGradient(0, -0.05, 0, 0.42); gr.addColorStop(0, C(Y.glow, 0.08)); gr.addColorStop(1, C(Y.light, 0.22)); g.fillStyle = gr; g.fill();
      g.lineWidth = 0.065; g.strokeStyle = C(Y.rim, 0.85); g.stroke(); g.lineWidth = 0.035; g.strokeStyle = Y.body; g.stroke(); g.lineWidth = 0.014; g.strokeStyle = Y.core; g.stroke();
      g.restore();
      // 말뚝 넷 (뒤 둘 먼저, 앞 둘 나중)
      [[2, 0.0], [3, 0.05], [0, 0.1], [1, 0.15]].forEach(([i, d]) => {
        const [x, y] = P[i], h = (i < 2 ? 0.75 : 0.6) * E.back(seg(t, d, d + 0.2), 1.6);
        if (h <= 0.01) return;
        beam(g, x, y, x, y - h, i < 2 ? 0.085 : 0.07, fade, 1, 0.5);
        g.save(); g.translate(x, y - h); g.scale(0.07, 0.11); solid(g, gg => path.diamond(gg, 0.7), { hi: Y.core, lo: Y.body, rim: Y.rim, rimW: 0.2, a: fade, shine: 0.5 }); g.restore();
        glint(g, x, y - h, 0.2 * bell(t, d + 0.12, d + 0.2, d + 0.5), Y.glow, 1, 0, 0.13, Y.core);
      });
      particles(g, t, 5, 10, r => ({ t0: 0.15 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 1.1, y: 0.35 - r() * 0.35 }), (gg, p, age) => speck(gg, p.x, p.y - 0.45 * age, 0.018, Y.light, (1 - age) * fade));
    },
  },

  /** 결계 정화 (해제): 어두운 얼룩이 갇힌 노란 유리판이 잠깐 보였다 깨져, 날카로운 유리 조각이 돌며 사방으로 흩어지고 어두운 티끌이 튐 */
  'warder-cleanse': {
    frames: 18, logical: 94, scope: 'target',
    draw(g, { t }) {
      const brk = 0.2, W = 0.95, H = 1.15, fade = 1 - E.in2(seg(t, 0.5, 1));
      glow(g, 0, 0, 1.0, Y.glow, 0.7 * (1 - E.out2(seg(t, 0, 0.6))));
      if (t < brk) {
        const k = E.back(seg(t, 0, brk * 0.6), 1.5);
        pane(g, 0, 0, W * k, H * k, 1);
        g.save(); g.filter = 'blur(3px)'; g.beginPath(); g.arc(0.05, 0.05, 0.22 * k, 0, TAU); g.fillStyle = C('#3a1660', 0.85); g.fill(); g.restore();
        frame(g, 0, 0, W * k, H * k, 0.07, 1, 0, 0.7);
        // 금이 감
        const c = seg(t, brk * 0.5, brk);
        if (c > 0) { g.save(); g.globalAlpha = c; g.strokeStyle = Y.core; g.lineWidth = 0.03; g.beginPath(); for (const a of [0.3, 1.5, 2.6, 3.8, 5.0]) { g.moveTo(0, 0); g.lineTo(Math.cos(a) * 0.5, Math.sin(a) * 0.6); } g.stroke(); g.restore(); }
        return;
      }
      const u = seg(t, brk, 1);
      glow(g, 0, 0, 0.55, '#ffffff', 1 - E.out3(seg(u, 0, 0.3)));
      // 유리 조각 (삼각 · 사각)
      particles(g, u, 6, 8, (r, i) => ({ t0: 0, life: 0.8 + r() * 0.2, a: (i * TAU) / 8 + r() * 0.4, sp: 0.8 + r() * 0.5, sz: 0.14 + r() * 0.08, rot: r() * 6, spin: (r() - 0.5) * 10, n: r() < 0.5 ? 3 : 4 }), (gg, p, age) => {
        const d = 0.15 + p.sp * E.out2(age), x = Math.cos(p.a) * d, y = Math.sin(p.a) * d * 0.9 + 0.3 * age * age, k = 1 - E.in2(age);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + p.spin * age); gg.scale(p.sz, p.sz * 1.3);
        glow(gg, 0, 0, 1.6, Y.glow, 0.5 * k);
        gg.globalAlpha = k; path.poly(gg, p.n, p.rot); gg.fillStyle = C(Y.light, 0.5); gg.fill(); gg.lineWidth = 0.16; gg.strokeStyle = C(Y.rim, 0.9); gg.stroke(); gg.lineWidth = 0.08; gg.strokeStyle = Y.body; gg.stroke();
        gg.beginPath(); gg.moveTo(-0.4, -0.2); gg.lineTo(0.2, -0.5); gg.strokeStyle = '#ffffff'; gg.lineWidth = 0.08; gg.stroke();
        gg.restore();
      });
      // 어두운 티끌
      particles(g, u, 9, 6, (r, i) => ({ t0: 0, life: 0.6, a: rad(i * 60 + 30 + r() * 20), sz: 0.06 + r() * 0.03 }), (gg, p, age) => {
        const d = 0.1 + 0.7 * E.out2(age), x = Math.cos(p.a) * d, y = Math.sin(p.a) * d;
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.4, 0, TAU); }, '#4a2070', 0.45 * (1 - age), 3);
        gg.save(); gg.globalAlpha = 1 - age; gg.beginPath(); gg.arc(x, y, p.sz * (1 - age * 0.5), 0, TAU); gg.fillStyle = '#2a1040'; gg.fill(); gg.restore();
      });
      void fade;
    },
  },

  /** 수호 결계 (큰 보호막): 가운데 네모 테가 한 번 번쩍 퍼지고, 작은 네모 방패 셋이 몸 둘레를 납작한 타원으로 돔 */
  'warder-guard': {
    frames: 22, logical: 96, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), flash = seg(t, 0, 0.4);
      glow(g, 0, 0, 1.1, Y.glow, 0.65 * fade);
      const fs = lerp(0.5, 1.6, E.out3(flash));
      frame(g, 0, 0.05, fs, fs, 0.09 * (1 - flash) + 0.02, (1 - E.in2(flash)), 0, 0.8);
      pane(g, 0, 0.05, fs, fs, 0.5 * (1 - flash));
      for (let i = 0; i < 3; i++) {
        const a = t * TAU * 0.9 + (i * TAU) / 3, z = Math.sin(a), x = Math.cos(a) * 0.82, y = 0.1 + z * 0.3, k = E.back(seg(t, 0.05 + i * 0.04, 0.25 + i * 0.04), 1.8);
        const s = 0.25 * (0.78 + 0.22 * z) * k, al = fade * (z > 0 ? 1 : 0.6);
        const P = s2 => { const b = a - (1 - s2) * 1.0; return { x: Math.cos(b) * 0.82, y: 0.1 + Math.sin(b) * 0.3 }; };
        comet(g, P, 0, 1, { w: 0.08, rim: Y.rim, body: Y.body, core: Y.core, glowCol: Y.glow, a: al * 0.8, head: 0 });
        if (s <= 0.01) continue;
        g.save(); g.translate(x, y); g.scale(s, s);
        glow(g, 0, 0, 1.6, Y.glow, 0.6 * al);
        const sh = gg => { gg.beginPath(); gg.moveTo(-0.7, -0.8); gg.lineTo(0.7, -0.8); gg.lineTo(0.7, 0.35); gg.lineTo(0, 0.9); gg.lineTo(-0.7, 0.35); gg.closePath(); };
        solid(g, sh, { hi: Y.core, lo: Y.body, rim: Y.rim, rimW: 0.13, a: al, shine: 0.7 });
        g.globalAlpha = al; g.strokeStyle = C(Y.rim, 0.8); g.lineWidth = 0.1; g.beginPath(); g.rect(-0.35, -0.45, 0.7, 0.7); g.stroke();
        g.restore();
      }
    },
  },

  /** 빛의 장막 (장막 칸마다): 가로로 긴 노란 빛 띠 셋이 아래에서 위로 차례로 펼쳐져 쌓이고 사이로 빛 점이 천천히 떠오름 */
  'warder-veil': {
    frames: 24, logical: 82, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1));
      glowOval(g, 0, 0.75, 0.95, 0.35, Y.glow, 0.6 * (1 - E.out2(seg(t, 0, 0.7))));
      [[0.84, 0], [0.38, 0.1], [-0.12, 0.2]].forEach(([y, d], i) => {
        const k = E.out3(seg(t, d, d + 0.25)), w = (0.95 - i * 0.12) * k, h = 0.15 - i * 0.02;
        if (w <= 0.01) return;
        g.save(); g.globalAlpha = fade;
        bloom(g, gg => gg.rect(-w, y - h * 0.6, w * 2, h * 1.2), Y.glow, 0.35, 6);
        g.restore();
        beam(g, -w, y, w, y, 0.07 - i * 0.008, fade, 1, 0.5);
        glint(g, w, y, 0.2 * bell(t, d + 0.15, d + 0.25, d + 0.5), Y.glow, 1, 0, 0.13, Y.core);
        glint(g, -w, y, 0.2 * bell(t, d + 0.15, d + 0.25, d + 0.5), Y.glow, 1, 0, 0.13, Y.core);
      });
      particles(g, t, 4, 14, r => ({ t0: 0.15 + r() * 0.45, life: 0.45, x: (r() - 0.5) * 1.6, y: 0.5 - r() * 0.6 }), (gg, p, age) => speck(gg, p.x, p.y - 0.4 * age, 0.02, Y.light, (1 - age) * fade));
    },
  },
};
