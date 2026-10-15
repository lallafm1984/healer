// 점성술사: 호박 별빛 + 밤하늘 남보라 (성기사 금빛과 다르게 별 둘레에 보랏빛 밤 기운). 별 · 별자리 · 초승달 · 시계 바늘
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, seg, solid, speck, TAU } from './lib.mjs';

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

export default {
  /** 별빛 치유: 머리 위에 호박빛 오각 별이 떠서 천천히 돌며 작아지고, 아래로 작은 마름모 빛 방울이 떨어짐 */
  'astro-star': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const pop = lerp(0.5, 1, E.back(seg(t, 0, 0.2), 1.8)), fade = 1 - E.in2(seg(t, 0.6, 1)), sy = -0.6;
      glowOval(g, 0, 0, 0.95, 0.9, NIGHT.glow, 0.35 * (1 - E.out2(seg(t, 0, 0.7))));
      glow(g, 0, sy, 0.55, '#ffffff', 0.6 * (1 - E.out3(seg(t, 0, 0.3))));
      star5(g, 0, sy, 0.38 * pop * (1 - 0.35 * seg(t, 0.3, 1)), t * 2.4, fade);
      // 떨어지는 마름모 빛 방울
      particles(g, t, 3, 9, (r, i) => ({ t0: 0.08 + i * 0.06, life: 0.45, x: (r() - 0.5) * 0.7, sz: 0.05 + r() * 0.03 }), (gg, p, age) => {
        const y = sy + 0.2 + 1.0 * E.in2(age), k = (1 - age) * fade;
        glow(gg, p.x, y, p.sz * 3, AM.glow, 0.5 * k);
        gg.save(); gg.translate(p.x, y); gg.scale(p.sz * 0.6, p.sz); energy(gg, h => path.diamond(h, 0.6), { rim: AM.rim, body: AM.light, core: '#ffffff', rimW: 0.2, a: k }); gg.restore();
      });
      for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1, b = bell(t, 0.1 + i * 0.1, 0.25 + i * 0.1, 0.6 + i * 0.1); twinkle(g, Math.cos(a) * 0.5, sy + Math.sin(a) * 0.2, 0.14 * b, b, a); }
    },
  },

  /** 반짝임: 위 · 왼쪽 아래 · 오른쪽 아래에 작은 네 갈래 별이 차례로 반짝 켜졌다 꺼짐 (삼각형) */
  'astro-twinkle': {
    frames: 16, logical: 86, scope: 'target',
    draw(g, { t }) {
      glow(g, 0, 0, 0.9, NIGHT.glow, 0.4 * (1 - E.out2(seg(t, 0, 0.7))));
      const pts = [[0, -0.62], [-0.55, 0.42], [0.55, 0.42]];
      // 세 별을 잇는 옅은 삼각 빛
      const tri = bell(t, 0.25, 0.45, 0.9);
      g.save(); g.globalAlpha = tri * 0.6; g.beginPath(); pts.forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.lineWidth = 0.05; g.strokeStyle = C(NIGHT.mid, 0.9); g.stroke(); g.lineWidth = 0.02; g.strokeStyle = AM.light; g.stroke(); g.restore();
      pts.forEach(([x, y], i) => {
        const b = i === 0 ? 1 - E.in2(seg(t, 0.05, 0.55)) : bell(t, i * 0.14, i * 0.14 + 0.1, i * 0.14 + 0.55);
        twinkle(g, x, y, 0.55 * b, b, rad(i * 15));
        speck(g, x, y, 0.035 * b, '#ffffff', b);
      });
      particles(g, t, 5, 10, r => ({ t0: 0.1 + r() * 0.5, life: 0.35, x: (r() - 0.5) * 1.2, y: (r() - 0.5) * 1.1 }), (gg, p, age) => speck(gg, p.x, p.y, 0.018, AM.light, Math.sin(Math.PI * age)));
    },
  },

  /** 별자리 표식: 머리 위 세 점이 차례로 켜지며 가는 선으로 이어지는 작은 별자리, 둘레에 옅은 밤빛 */
  'astro-mark': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), pts = [[-0.58, -0.45], [0.02, -0.88], [0.6, -0.4]];
      glowOval(g, 0, -0.65, 0.85, 0.5, NIGHT.glow, 0.55 * bell(t, 0, 0.2, 1));
      glowOval(g, 0, -0.65, 0.55, 0.45, NIGHT.mid, 0.4 * bell(t, 0, 0.2, 1), false);
      for (let i = 0; i < 2; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], k = E.out2(seg(t, 0.12 + i * 0.16, 0.3 + i * 0.16));
        if (k > 0) lightStroke(g, s => ({ x: lerp(x0, x1, s), y: lerp(y0, y1, s) }), 0, k, () => 0.07, { rim: NIGHT.rim, body: AM.light, core: '#ffffff', a: fade, rimW: 0.018, glowCol: AM.glow, glowA: 0.5 });
      }
      pts.forEach(([x, y], i) => {
        const on = E.back(seg(t, i * 0.16, i * 0.16 + 0.15), 2);
        if (on <= 0) return;
        star5(g, x, y, 0.19 * on, rad(i * 20), fade, 0.8);
        twinkle(g, x, y, 0.3 * bell(t, i * 0.16, i * 0.16 + 0.06, i * 0.16 + 0.3), 1);
      });
      // 별자리에서 대상에게 내리는 빛 가루
      particles(g, t, 8, 10, r => ({ t0: 0.3 + r() * 0.3, life: 0.4, x: (r() - 0.5) * 0.9 }), (gg, p, age) => speck(gg, p.x, -0.55 + 0.9 * age, 0.02, AM.light, (1 - age) * fade));
    },
  },

  /** 맑은 별빛 (해제): 별가루가 위아래에서 몸 가운데로 빨려 들어와 육각 별로 터지고 어두운 조각이 흩어짐 */
  'astro-clear': {
    frames: 18, logical: 92, scope: 'target',
    draw(g, { t }) {
      const burst = 0.32, fade = 1 - E.in2(seg(t, 0.55, 1));
      glow(g, 0, 0, 0.9, NIGHT.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.8))));
      // 빨려 드는 별가루 (위 · 아래)
      particles(g, t, 2, 22, r => ({ t0: r() * 0.12, life: burst, x: (r() - 0.5) * 1.1, y: (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.35) }), (gg, p, age) => {
        const k = E.in2(age); speck(gg, p.x * (1 - k), p.y * (1 - k), 0.025, AM.light, 1);
      });
      const b = seg(t, burst - 0.04, 1), pop = E.back(seg(b, 0, 0.25), 2) * (1 - E.in2(seg(b, 0.45, 1)));
      glow(g, 0, 0, 0.6, '#ffffff', bell(t, burst - 0.05, burst, burst + 0.3));
      if (pop > 0.01) {
        g.save(); g.rotate(b * 1.2); g.scale(0.62 * pop, 0.62 * pop);
        bloom(g, gg => path.star(gg, 6, 0.5), AM.glow, 0.6, 7);
        solid(g, gg => path.star(gg, 6, 0.5), { hi: AM.core, lo: AM.body, rim: AM.rim, rimW: 0.06, a: fade, shine: 0.6 });
        g.save(); g.scale(0.45, 0.45); path.star(g, 6, 0.5); g.fillStyle = C('#ffffff', 0.9 * fade); g.fill(); g.restore();
        g.restore();
      }
      // 흩어지는 어두운 조각
      if (t > burst) particles(g, seg(t, burst, 1), 9, 6, (r, i) => ({ t0: 0, life: 0.75, a: rad(i * 60 + r() * 25), sz: 0.07 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.4 + 0.75 * E.out2(age), x = Math.cos(p.a) * d, y = Math.sin(p.a) * d * 0.85, k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.3, 0, TAU); }, '#4a2a7a', 0.35 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => path.poly(h, 3, p.rot), { hi: '#7a5aa8', lo: '#24123e', rim: '#0c0618', rimW: 0.18, a: k, shine: 0.25 }); gg.restore();
      });
    },
  },

  /** 별비 (회복한 칸마다): 왼쪽 위에서 오각 별 셋이 차례로 비스듬히 떨어져 발밑에서 불티로 튐 */
  'astro-fall': {
    frames: 20, logical: 90, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.65, 1)), by = 0.55;
      glowOval(g, 0, by, 0.95, 0.35, NIGHT.glow, 0.45 * (1 - E.out2(seg(t, 0, 0.8))));
      for (let i = 0; i < 3; i++) {
        const d = i * 0.12, hit = d + 0.28, x1 = (i - 1) * 0.42, P = s => ({ x: lerp(x1 - 0.9, x1, s), y: lerp(by - 1.55, by, s) });
        if (t < hit) {
          const s = E.in2(seg(t, d, hit));
          if (t >= d) { comet(g, P, Math.max(0, s - 0.45), s, { w: 0.14, rim: NIGHT.rim, body: AM.light, core: '#ffffff', glowCol: AM.glow, head: 0 }); const p = P(s); star5(g, p.x, p.y, 0.21, t * 9 + i, 1); }
        } else {
          const u = seg(t, hit, hit + 0.45);
          glowOval(g, x1, by, 0.4, 0.4, AM.glow, 0.9 * (1 - u));
          for (let k = 0; k < 5; k++) { const a = rad(-160 + k * 35), r = 0.1 + 0.32 * E.out2(u); speck(g, x1 + Math.cos(a) * r, by + Math.sin(a) * r * 0.9 + 0.3 * u * u, 0.025, AM.light, (1 - u) * fade); }
          twinkle(g, x1, by - 0.05, 0.3 * (1 - E.out2(u)), 1 - u);
        }
      }
    },
  },

  /** 별의 잠: 몸을 감싸는 세로로 긴 별빛 고치가 은은히 빛나고, 오른쪽 위에 초승달이 뜸 */
  'astro-sleep': {
    frames: 24, logical: 92, scope: 'target',
    draw(g, { t }) {
      const grow = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.7, 1)), breathe = 1 + 0.03 * Math.sin(t * 14);
      // 고치 (세로 타원, 남보라 안개 + 호박 테)
      g.save(); g.scale(breathe, breathe); g.globalAlpha = fade;
      const rx = 0.62 * grow, ry = 1.0 * grow;
      g.save(); const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry); gr.addColorStop(0, C(NIGHT.mid, 0.1)); gr.addColorStop(0.7, C(NIGHT.mid, 0.32)); gr.addColorStop(1, C(NIGHT.glow, 0.55));
      g.scale(rx / ry, 1); g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fillStyle = gr; g.fill(); g.restore();
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.lineWidth = 0.1; g.strokeStyle = C(NIGHT.rim, 0.8); g.stroke(); g.lineWidth = 0.055; g.strokeStyle = AM.light; g.stroke(); g.lineWidth = 0.02; g.strokeStyle = '#ffffff'; g.stroke();
      g.restore();
      // 고치 안에서 깜빡이는 별
      for (let i = 0; i < 6; i++) { const x = Math.sin(i * 2.4) * 0.38, y = Math.cos(i * 1.7) * 0.7, b = Math.max(0, Math.sin(t * 9 + i * 1.3)) * fade * grow; speck(g, x, y, 0.025, NIGHT.star, b); }
      // 초승달
      const m = E.back(seg(t, 0.12, 0.4), 1.6);
      if (m > 0) { g.save(); g.translate(0.62, -0.78); g.rotate(rad(-20)); g.scale(0.24 * m, 0.24 * m); glow(g, 0, 0, 2, AM.glow, 0.6 * fade); solid(g, gg => path.crescent(gg, 0.7), { hi: AM.core, lo: AM.body, rim: AM.rim, rimW: 0.1, a: fade, shine: 0.6 }); g.restore(); }
      glint(g, -0.45, -0.85, 0.16 * bell(t, 0.3, 0.42, 0.7), NIGHT.glow, 1, 0.3, 0.14, NIGHT.star);
    },
  },

  /** 별의 기억 (파티 전원): 가운데 축에서 뻗은 바늘이 끝에 별을 달고 한 바퀴 돌며 옅은 궤적을 남기고, 다 돌면 별이 한 번 커짐 */
  'astro-memory': {
    frames: 22, logical: 80, scope: 'party',
    draw(g, { t }) {
      const turn = E.inOut(seg(t, 0, 0.62)), fade = 1 - E.in2(seg(t, 0.7, 1)), L = 0.72, a = rad(-90) + turn * TAU;
      glow(g, 0, 0, 0.85, NIGHT.glow, 0.45 * fade);
      // 지나간 자리 (부채꼴 옅은 빛, 테두리 선 없음)
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 * fade;
      const fan = g.createRadialGradient(0, 0, 0, 0, 0, L); fan.addColorStop(0, C(NIGHT.glow, 0)); fan.addColorStop(1, C(AM.glow, 0.7));
      g.fillStyle = fan; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, L, Math.max(rad(-90), a - 1.6), a); g.closePath(); g.fill(); g.restore();
      // 바늘
      for (let q = 0; q < 4; q++) { const qa = rad(-90 + q * 90), on = turn * 4 >= q ? 1 : 0.35; speck(g, Math.cos(qa) * L * 1.12, Math.sin(qa) * L * 1.12, 0.035, AM.light, on * fade); }
      lightStroke(g, s => ({ x: Math.cos(a) * L * s, y: Math.sin(a) * L * s }), 0, 1, u => 0.12 * (1 - 0.5 * u), { rim: NIGHT.rim, body: AM.body, core: AM.core, a: fade, rimW: 0.022 });
      g.save(); g.scale(0.09, 0.09); energy(g, gg => { gg.beginPath(); gg.arc(0, 0, 1, 0, TAU); }, { rim: NIGHT.rim, body: AM.light, core: '#ffffff', rimW: 0.3, a: fade }); g.restore();
      const big = bell(t, 0.6, 0.7, 0.95);
      star5(g, Math.cos(a) * L, Math.sin(a) * L, 0.13 + 0.12 * big, t * 6, fade);
      twinkle(g, Math.cos(a) * L, Math.sin(a) * L, 0.4 * big, big);
    },
  },

  /** 북극성: 큰 네 갈래 별이 위에서 내려와 몸 위에서 크게 빛난 뒤 작은 별 조각으로 흩어짐 */
  'astro-polaris': {
    frames: 22, logical: 100, scope: 'target',
    draw(g, { t }) {
      const land = 0.25, y = lerp(-1.2, -0.15, E.out3(seg(t, 0, land))), grow = t < land ? 0.55 : lerp(0.55, 1.1, E.out2(seg(t, land, 0.45))), shatter = seg(t, 0.5, 1);
      glow(g, 0, y, 1.3, NIGHT.glow, 0.5 * (1 - E.in2(shatter)));
      if (t < land) comet(g, s => ({ x: 0, y: lerp(-1.6, y, s) }), 0.3, 1, { w: 0.14, rim: NIGHT.rim, body: AM.light, core: '#ffffff', glowCol: AM.glow, head: 0 });
      if (shatter < 1) {
        const k = (1 - E.in2(shatter)) * grow;
        glow(g, 0, y, 0.95 * k, AM.glow, 0.85);
        g.save(); g.translate(0, y); g.rotate(rad(45) * shatter); g.scale(0.85 * k, 0.85 * k);
        bloom(g, gg => path.star(gg, 4, 0.22), AM.glow, 0.7, 8);
        solid(g, gg => path.star(gg, 4, 0.22), { hi: AM.core, lo: AM.body, rim: AM.rim, rimW: 0.035, a: 1, shine: 0.7 });
        g.save(); g.scale(0.5, 0.5); path.star(g, 4, 0.3); g.fillStyle = '#ffffff'; g.fill(); g.restore();
        g.restore();
        glint(g, 0, y, 0.7 * k, NIGHT.glow, 0.6, rad(45), 0.08, NIGHT.star);
      }
      if (shatter > 0) particles(g, shatter, 4, 10, (r, i) => ({ t0: 0, life: 0.85 + r() * 0.15, a: (i * TAU) / 10 + r() * 0.3, sp: 0.6 + r() * 0.5, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.2 + p.sp * E.out2(age);
        star5(gg, Math.cos(p.a) * d, y + Math.sin(p.a) * d * 0.9 + 0.2 * age * age, 0.09 * (1 - 0.5 * age), p.rot + age * 5, 1 - E.in2(age), 0.5);
      });
    },
  },
};
