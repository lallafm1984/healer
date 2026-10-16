// 결계사: 노란 발광 빛 (Lim 2026-10-16 「흰색이라서 퀄리티가 더 떨어져보인다. 노란 발광의 빛이나게」).
// 막 · 장막 · 결계는 둥글게, 스킬 이름에서 모양을 따옴 (Lim 2026-10-16 「결계사의 막, 빛의장막, 결계 이펙트를 각지게 하지말고 이름을 따와서」). 인장 (X · 마름모) · 결계 정화 (깨지는 유리)는 그대로.
// 성기사 금빛 (주황 기운) · 점성술사 호박과 다르게 맑은 레몬 노랑 + 강한 빛 번짐, 어두운 호박 갈색 테
import { bell, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, seg, solid, speck, TAU } from './lib.mjs';

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

  /** 심판 (인장 터뜨리기, 회복한 인장 칸마다 · 공격 아님): 몸 위에 마름모 인장 문양이 떠올라 빛나다가 네 갈래 빛줄기로 풀려 위로 퍼지고 빛 점이 몸으로 스밈 */
  'warder-judgment': {
    frames: 18, logical: 88, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.8), open = E.out3(seg(t, 0.3, 0.75)), fade = 1 - E.in2(seg(t, 0.55, 1)), cy = -0.05;
      glow(g, 0, cy, 0.8, Y.glow, 0.45 * fade);
      // 마름모 인장 (안에 작은 네모 · 네 점), 풀리면서 커지고 옅어짐
      const ds = 0.34 * pop * (1 + 0.35 * open), da = fade * (1 - 0.7 * open);
      if (ds > 0.01 && da > 0) {
        g.save(); g.translate(0, cy); g.rotate(rad(45)); g.globalAlpha = da;
        bloom(g, h => { h.rect(-ds, -ds, ds * 2, ds * 2); h.rect(ds * 0.7, -ds * 0.7, -ds * 1.4, ds * 1.4); }, Y.glow, 0.5, 6);
        g.beginPath(); g.rect(-ds, -ds, ds * 2, ds * 2); g.lineWidth = 0.1; g.strokeStyle = C(Y.rim, 0.9); g.stroke(); g.lineWidth = 0.06; g.strokeStyle = Y.body; g.stroke(); g.lineWidth = 0.022; g.strokeStyle = Y.core; g.stroke();
        g.beginPath(); g.rect(-ds * 0.45, -ds * 0.45, ds * 0.9, ds * 0.9); g.lineWidth = 0.05; g.strokeStyle = C(Y.rim, 0.85); g.stroke(); g.lineWidth = 0.028; g.strokeStyle = Y.light; g.stroke();
        g.restore();
        for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) speck(g, x * ds * 1.4 * 0.72, cy + y * ds * 1.4 * 0.72, 0.03, Y.core, da);
      }
      // 네 갈래 빛줄기 (위로 휘어 풀림)
      for (const [sx, k] of [[-1, 1], [1, 1], [-0.45, 0.8], [0.45, 0.8]]) {
        if (open <= 0) continue;
        const P = s => ({ x: sx * lerp(0.15, 0.75, s) * k, y: cy - lerp(0.05, 0.95, s) * k + 0.25 * s * s });
        lightStroke(g, P, Math.max(0, open - 0.6), Math.max(0.02, open), u => 0.08 * Math.sin(Math.PI * u) ** 0.6, { rim: Y.rim, body: Y.body, core: Y.core, a: fade, rimW: 0.018, glowCol: Y.glow, glowA: 0.6 });
      }
      glint(g, 0, cy, 0.5 * bell(t, 0.22, 0.3, 0.55), Y.glow, 1, 0, 0.12, Y.core);
      particles(g, t, 6, 12, r => ({ t0: 0.35 + r() * 0.3, life: 0.45, x: (r() - 0.5) * 0.9, y: -0.6 + r() * 0.3 }), (gg, p, age) => speck(gg, p.x * (1 - 0.5 * age), p.y + 0.8 * age, 0.02, Y.light, (1 - age) * fade));
    },
  },
  /** 빛의 막 (Lim 2026-10-16 「각지게 하지 말고 이름을 따와서」): 몸 앞을 둥글게 감싸며 펼쳐지는 얇은 빛 막. 물결 결이 흐르고 윤이 한 번 미끄러진 뒤 빛가루로 걷힘 */
  'warder-barrier': {
    frames: 22, logical: 96, scope: 'target',
    draw(g, { t }) {
      const open = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.6, 1)), cy = 0.12, rx = 0.92 * lerp(0.35, 1, open), ry = 0.66 * lerp(0.35, 1, open);
      glowOval(g, 0, cy, 1.0, 0.75, Y.glow, 0.45 * fade);
      // 막 몸 (가운데 투명 → 가장자리로 진해지는 얇은 막, 위아래로 살랑임)
      const wob = 0.03 * Math.sin(t * 14);
      g.save(); g.translate(0, cy); g.scale(rx, ry + wob); g.globalAlpha = fade;
      const gr = g.createRadialGradient(-0.25, -0.3, 0.05, 0, 0, 1);
      gr.addColorStop(0, C(Y.core, 0.32)); gr.addColorStop(0.55, C(Y.light, 0.14)); gr.addColorStop(0.86, C(Y.glow, 0.55)); gr.addColorStop(1, C(Y.body, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
      g.restore();
      // 물결 결 (막을 가로질러 흐르는 부드러운 곡선 셋)
      for (let i = 0; i < 3; i++) {
        const yy = cy + (i - 1) * ry * 0.45, k = Math.sqrt(Math.max(0, 1 - ((i - 1) * 0.45) ** 2)), ph = t * 9 + i * 1.7;
        lightStroke(g, s2 => ({ x: lerp(-rx * k * 0.92, rx * k * 0.92, s2), y: yy + Math.sin(s2 * TAU * 1.2 + ph) * 0.045 }), 0, 1, u => 0.035 * Math.sin(Math.PI * u) ** 0.8, { rim: Y.deep, body: Y.light, core: Y.core, a: fade * 0.75 * open, rimW: 0, coreW: 0.5 });
      }
      // 가장자리 윤 (위 왼쪽 · 아래 오른쪽 호만, 꽉 찬 고리 아님)
      for (const [a0, a1] of [[rad(195), rad(290)], [rad(15), rad(110)]]) {
        lightStroke(g, s2 => { const a = lerp(a0, a1, s2); return { x: Math.cos(a) * rx * 0.97, y: cy + Math.sin(a) * (ry + wob) * 0.97 }; }, 0, 1, u => 0.06 * Math.sin(Math.PI * u) ** 0.7, { rim: Y.rim, body: Y.body, core: Y.core, a: fade * open, rimW: 0.016, glowCol: Y.glow, glowA: 0.6 });
      }
      // 미끄러지는 윤 (비스듬한 빛 한 줄이 막을 훑음, 막 안으로만)
      const sw = seg(t, 0.25, 0.65);
      if (sw > 0 && sw < 1) {
        g.save(); g.translate(0, cy); g.scale(rx, ry); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.restore();
        g.save(); g.clip(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(Math.PI * sw) * fade;
        const x = lerp(-1.2, 1.2, sw); g.translate(x, cy); g.rotate(rad(25));
        const gl = g.createLinearGradient(-0.14, 0, 0.14, 0); gl.addColorStop(0, C(Y.glow, 0)); gl.addColorStop(0.5, C('#ffffff', 0.8)); gl.addColorStop(1, C(Y.glow, 0));
        g.fillStyle = gl; g.fillRect(-0.14, -2, 0.28, 4); g.restore();
      }
      particles(g, t, 7, 14, r => ({ t0: 0.45 + r() * 0.3, life: 0.4, a: r() * TAU }), (gg, p, age) => speck(gg, Math.cos(p.a) * rx * (0.9 + 0.2 * age), cy + Math.sin(p.a) * ry * (0.9 + 0.2 * age) - 0.2 * age, 0.02, Y.light, (1 - age) * fade));
    },
  },

  /** 결계 원 (범위 칸마다, 이름 그대로 원): 빛 점 하나가 발밑에 원을 그려 닫고, 원 안에 여섯 꽃잎 호가 피어 은은히 빛나다 빛 점이 떠오름 */
  'warder-circle': {
    frames: 20, logical: 82, scope: 'target',
    draw(g, { t }) {
      const by = 0.5, rx = 0.82, ry = 0.3, draw = E.inOut(seg(t, 0, 0.4)), bloomK = E.out3(seg(t, 0.32, 0.6)), fade = 1 - E.in2(seg(t, 0.62, 1));
      glowOval(g, 0, by, 0.95, 0.36, Y.glow, 0.5 * fade * Math.max(draw, 0.3));
      const ell = a => ({ x: Math.cos(a) * rx, y: by + Math.sin(a) * ry });
      const a0 = rad(-90);
      if (draw > 0) lightStroke(g, s2 => ell(a0 + s2 * TAU), 0, Math.min(1, draw + 0.001), () => 0.055, { rim: Y.rim, body: Y.body, core: Y.core, a: fade, rimW: 0.014, coreW: 0.45, glowCol: Y.glow, glowA: 0.55 });
      if (draw < 1) { const p = ell(a0 + draw * TAU); glow(g, p.x, p.y, 0.22, Y.glow, 0.9); speck(g, p.x, p.y, 0.035, '#ffffff', 1); }
      // 안쪽 여섯 꽃잎 호 (원 가운데에서 바깥으로 피어나는 꽃 문양)
      if (bloomK > 0) for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + t * 0.6, tip = { x: Math.cos(a) * rx * 0.72 * bloomK, y: by + Math.sin(a) * ry * 0.72 * bloomK }, side = 0.32;
        const P = s2 => { const u = s2 < 0.5 ? s2 * 2 : (1 - s2) * 2, w = (s2 < 0.5 ? 1 : -1) * side * Math.sin(Math.PI * u); const x = lerp(0, tip.x, u), y = lerp(by, tip.y, u); return { x: x - Math.sin(a) * w * rx * 0.3, y: y + Math.cos(a) * w * ry * 0.3 }; };
        lightStroke(g, P, 0, 1, () => 0.03, { rim: Y.deep, body: Y.light, core: Y.core, a: fade * 0.85, rimW: 0.008, coreW: 0.5 });
      }
      glowOval(g, 0, by, 0.3, 0.4, '#ffffff', 0.5 * bell(t, 0.32, 0.42, 0.7));
      particles(g, t, 5, 10, r => ({ t0: 0.4 + r() * 0.3, life: 0.4, a: r() * TAU, d: r() }), (gg, p, age) => speck(gg, Math.cos(p.a) * rx * p.d, by + Math.sin(p.a) * ry * p.d - 0.6 * age, 0.018, Y.light, (1 - age) * fade));
    },
  },

  /** 수호 결계 (큰 보호막): 몸 둘레에 가로 띠 하나 · 넓은 세로 띠 둘이 차례로 그려져 지구본처럼 둥근 결계를 이루고, 띠마다 빛 구슬이 돌다 함께 옅어짐 */
  'warder-guard': {
    frames: 22, logical: 96, scope: 'target',
    draw(g, { t }) {
      const cy = 0.08, R = 0.86, fade = 1 - E.in2(seg(t, 0.62, 1));
      glow(g, 0, cy, 1.05, Y.glow, 0.5 * fade);
      glow(g, 0, cy, 0.45, '#ffffff', 0.6 * bell(t, 0, 0.08, 0.35));
      // 궤도 셋 (세로로 납작하게 눌린 원을 0° · 60° · 120° 기울임). 그려지는 순서대로
      // 둥근 결계 (지구본처럼): 가로 띠 하나 + 세로 띠 둘 (천천히 도는 것처럼 폭이 바뀜)
      const spin = Math.sin(t * 5);
      const orbits = [[0, 0.3, 0, 1], [rad(90), 0.55 + 0.15 * spin, 0.08, 1], [rad(90), 0.82 - 0.1 * spin, 0.16, 0.92]];
      for (const [rot, sq, d, rr] of orbits) {
        const k = E.out3(seg(t, d, d + 0.3)), P = s2 => { const a = rad(-90) + s2 * TAU, x = Math.cos(a) * R * rr, y = Math.sin(a) * R * rr * sq; return { x: x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot) }; };
        if (k > 0) lightStroke(g, P, 0, k, () => (rot ? 0.035 : 0.045), { rim: Y.rim, body: Y.body, core: Y.core, a: fade * (rot ? 0.75 : 0.9), rimW: 0.012, coreW: 0.45, glowCol: Y.glow, glowA: 0.45 });
        // 궤도를 도는 빛 구슬
        const s0 = (t * 1.4 + d * 3) % 1, b = P(s0), on = seg(t, d + 0.15, d + 0.3);
        if (on > 0) { glow(g, b.x, b.y, 0.2, Y.glow, 0.8 * fade * on); g.save(); g.translate(b.x, b.y); g.scale(0.07 * on, 0.07 * on); g.globalAlpha = fade; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = Y.core; g.fill(); g.lineWidth = 0.4; g.strokeStyle = C(Y.rim, 0.8); g.stroke(); g.restore(); }
      }
      particles(g, t, 2, 10, r => ({ t0: 0.4 + r() * 0.3, life: 0.4, a: r() * TAU }), (gg, p, age) => speck(gg, Math.cos(p.a) * R * (1 + 0.2 * age), cy + Math.sin(p.a) * R * 0.6 * (1 + 0.2 * age), 0.02, Y.light, (1 - age) * fade));
    },
  },

  /** 빛의 장막 (장막 칸마다, 이름 그대로 장막): 발밑에서 주름진 노란 빛 장막이 물결치며 위로 솟아올랐다가 위부터 빛가루로 풀림 */
  'warder-veil': {
    frames: 24, logical: 82, scope: 'target',
    draw(g, { t }) {
      const by = 0.72, rise = E.out3(seg(t, 0, 0.45)), H = 1.55 * rise, fade = 1 - E.in2(seg(t, 0.55, 1)), W = 0.82;
      glowOval(g, 0, by, 0.9, 0.3, Y.glow, 0.6 * (1 - E.out2(seg(t, 0, 0.7))));
      if (H > 0.03) {
        const top = x => by - H + Math.sin(x * 5 + t * 12) * 0.06 * rise, edge = s2 => lerp(-W, W, s2);
        // 장막 천 (아래 진하고 위로 옅어짐, 윗단은 물결)
        g.save(); g.globalAlpha = fade;
        g.beginPath(); g.moveTo(-W, by);
        for (let i = 0; i <= 24; i++) { const x = edge(i / 24); g.lineTo(x + Math.sin(i * 0.9 + t * 8) * 0.02, top(x)); }
        g.lineTo(W, by); g.closePath();
        const gr = g.createLinearGradient(0, by, 0, by - H); gr.addColorStop(0, C(Y.glow, 0.3)); gr.addColorStop(0.55, C(Y.light, 0.1)); gr.addColorStop(1, C(Y.core, 0.02));
        g.fillStyle = gr; g.fill(); g.restore();
        // 주름 (세로로 출렁이는 밝은 결 다섯)
        for (let i = 0; i < 5; i++) {
          const x0 = lerp(-W * 0.8, W * 0.8, i / 4), sway = s2 => Math.sin(s2 * 4 + t * 10 + i * 1.3) * 0.05 * s2;
          lightStroke(g, s2 => ({ x: x0 + sway(s2), y: lerp(by, top(x0) + 0.05, s2) }), 0, 1, u => 0.04 * Math.sin(Math.PI * Math.min(1, u * 1.3)) ** 0.6, { rim: Y.deep, body: Y.light, core: Y.core, a: fade * 0.8, rimW: 0, coreW: 0.5 });
        }
        // 물결치는 윗단 (밝은 테)
        lightStroke(g, s2 => { const x = edge(s2); return { x, y: top(x) }; }, 0, 1, u => 0.05 * Math.sin(Math.PI * u) ** 0.5, { rim: Y.rim, body: Y.body, core: Y.core, a: fade, rimW: 0.012, glowCol: Y.glow, glowA: 0.6 });
      }
      particles(g, t, 4, 14, r => ({ t0: 0.35 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 1.6 }), (gg, p, age) => speck(gg, p.x, by - H - 0.05 - 0.35 * age, 0.02, Y.light, (1 - age) * fade));
    },
  },

  /** 결계 굳히기 (늘린 보호막마다): 몸 둘레 둥근 빛 막 위로 두 번째 막이 조여 덮여 두꺼워지고, 네 곳에 빛 매듭이 맺혀 빛실로 이어짐 */
  'warder-hold': {
    frames: 20, logical: 92, scope: 'target',
    draw(g, { t }) {
      const cy = 0.08, R = 0.78, squeeze = E.in3(seg(t, 0, 0.32)), knot = E.back(seg(t, 0.3, 0.45), 2), fade = 1 - E.in2(seg(t, 0.6, 1));
      const film = (r, a, w) => { g.save(); g.translate(0, cy); g.scale(r, r * 0.92); g.globalAlpha = a; const gr = g.createRadialGradient(0, 0, 0.2, 0, 0, 1); gr.addColorStop(0, C(Y.light, 0.06)); gr.addColorStop(0.8, C(Y.glow, 0.28 * w)); gr.addColorStop(0.97, C(Y.core, 0.6 * w)); gr.addColorStop(1, C(Y.glow, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
      glow(g, 0, cy, 1.0, Y.glow, 0.45 * fade);
      film(R, fade, lerp(0.8, 1.4, seg(t, 0.3, 0.45)));
      // 바깥 막이 조여 듦
      if (t < 0.36) film(lerp(1.22, R + 0.03, squeeze), 0.85, 1.1);
      glow(g, 0, cy, 0.55, '#ffffff', 0.55 * bell(t, 0.28, 0.33, 0.55));
      // 빛 매듭 넷과 이어 주는 빛실 (둥근 호)
      const pts = [45, 135, 225, 315].map(d => ({ x: Math.cos(rad(d)) * R * 0.98, y: cy + Math.sin(rad(d)) * R * 0.9 }));
      const thread = seg(t, 0.36, 0.6);
      if (thread > 0) for (let i = 0; i < 4; i++) {
        const a0 = rad(45 + i * 90), P = s2 => { const a = a0 + s2 * rad(90); return { x: Math.cos(a) * R * 0.98, y: cy + Math.sin(a) * R * 0.9 }; };
        lightStroke(g, P, 0, thread, () => 0.03, { rim: Y.deep, body: Y.body, core: Y.core, a: fade * 0.85, rimW: 0.01, coreW: 0.5 });
      }
      if (knot > 0) for (const p of pts) {
        g.save(); g.translate(p.x, p.y); g.rotate(t * 3); g.scale(0.1 * knot, 0.1 * knot);
        glow(g, 0, 0, 2.2, Y.glow, 0.7 * fade);
        energy(g, h => path.star(h, 4, 0.55, 0), { rim: Y.rim, body: Y.body, core: Y.core, rimW: 0.18, a: fade, coreScale: 0.5 });
        g.restore();
      }
      particles(g, t, 4, 10, r => ({ t0: 0.35 + r() * 0.3, life: 0.4, a: r() * TAU }), (gg, p, age) => speck(gg, Math.cos(p.a) * R * (1 - 0.3 * age), cy + Math.sin(p.a) * R * 0.9 * (1 - 0.3 * age), 0.018, Y.light, (1 - age) * fade));
    },
  },
};
