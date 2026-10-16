// 수도사: 비취 · 흰 안개. 흐르는 안개 리본 · 붓 획 같은 기 줄 · 기 구슬 (드루이드 풀빛 · 사제 소생 초록과 다른 푸른 비취 + 흰빛)
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, rng, seg, solid, speck, taper, TAU } from './lib.mjs';

const J = { rim: '#0d3329', deep: '#1d6b55', mid: '#3fae8c', light: '#6fd0b0', pale: '#bff0dc', white: '#f2fff9', glow: '#5fd8b0' };

/** 안개 덩어리: 부드러운 타원 여럿 (보통 섞기, 아래쪽에 비취 그늘 → 밝은 칸에서도 보임) */
function puff(g, x, y, r, a, seed = 1, sy = 0.55) {
  if (r <= 0 || a <= 0) return;
  const R = rng(seed), blobs = [...Array(5)].map((_, i) => [(i - 2) * r * 0.32 + (R() - 0.5) * r * 0.2, (R() - 0.5) * r * 0.35 - (i % 2) * r * 0.12, r * (0.42 + R() * 0.3) * (i === 2 ? 1.3 : 1)]);
  const soft = (cx, cy, rr, col, al) => { g.save(); g.translate(cx, cy); g.scale(1, sy); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, C(col, al)); gr.addColorStop(0.55, C(col, al * 0.8)); gr.addColorStop(1, C(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill(); g.restore(); };
  for (const [dx, dy, rr] of blobs) soft(x + dx, y + dy + rr * 0.22, rr * 1.1, J.deep, 0.45 * a);
  for (const [dx, dy, rr] of blobs) soft(x + dx, y + dy, rr, J.pale, 0.85 * a);
  for (const [dx, dy, rr] of blobs) soft(x + dx - rr * 0.15, y + dy - rr * 0.2 * sy, rr * 0.55, '#ffffff', 0.9 * a);
}
/** 붓 획 (굵기가 들쭉날쭉한 비취 획) */
function brush(g, P, s0, s1, w, a, body = J.mid) {
  lightStroke(g, P, s0, s1, u => w * (0.55 + 0.45 * Math.sin(Math.PI * u)) * (1 - 0.6 * u ** 3), { rim: J.rim, body, core: J.white, a, rimW: 0.022, coreW: 0.35, glowCol: J.glow, glowA: 0.4 });
}

export default {
  /** 생기 손바닥 (1초마다 연타): 가운데 비취 기 구슬이 순간 부풀었다 작아지고, 위아래 짧은 박자 획이 바깥으로 밀려나며 작은 마름모 반짝이가 튐 */
  'monk-palm': {
    frames: 14, logical: 86, scope: 'target',
    draw(g, { t }) {
      const pop = t < 0.18 ? E.out3(t / 0.18) : 1 - E.in2(seg(t, 0.18, 0.7)), fade = 1 - E.in2(seg(t, 0.35, 1));
      glow(g, 0, 0, 0.85, J.glow, 0.7 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, 0, 0.55, '#ffffff', 0.7 * (1 - E.out3(seg(t, 0, 0.25)))); // 맞는 순간 흰 빛 (사제 기준, QA 2026-10-16)
      if (pop > 0.01) {
        g.save(); g.scale(0.48 * pop, 0.48 * pop); g.rotate(t * 8);
        glow(g, 0, 0, 1.8, J.glow, 0.7);
        const orb = gg => { gg.beginPath(); gg.arc(0, 0, 1, 0, TAU); };
        orb(g); const gr = g.createRadialGradient(-0.3, -0.3, 0.1, 0, 0, 1); gr.addColorStop(0, J.white); gr.addColorStop(0.5, J.light); gr.addColorStop(1, J.deep); g.fillStyle = gr; g.fill();
        g.lineWidth = 0.14; g.strokeStyle = J.rim; g.stroke();
        // 기 소용돌이 (안쪽 두 갈래 획)
        for (const k of [0, Math.PI]) { g.save(); g.rotate(k); lightStroke(g, s2 => { const a = s2 * 3.6, r = 0.15 + 0.7 * s2; return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }, 0, 1, u => 0.22 * Math.sin(Math.PI * u), { rim: J.deep, body: J.pale, core: '#ffffff', rimW: 0.04, coreW: 0.4 }); g.restore(); }
        g.restore();
      }
      // 위아래 박자 획 (붓으로 짧게 그은 가로 획이 밖으로 밀려남)
      const d = 0.35 + 0.45 * E.out3(seg(t, 0, 0.5));
      for (const sgn of [-1, 1]) {
        const y = sgn * d, L = 0.55 * (1 - 0.3 * seg(t, 0.3, 1));
        brush(g, s => ({ x: lerp(-L, L, s), y: y + Math.sin(s * Math.PI) * sgn * 0.06 }), 0, 1, 0.155, fade);
      }
      for (let i = 0; i < 4; i++) {
        const a = rad(45 + i * 90), r = 0.3 + 0.55 * E.out2(seg(t, 0.05, 0.6)), b = bell(t, 0.05, 0.15, 0.7);
        g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.scale(0.09 * b, 0.14 * b); energy(g, gg => path.diamond(gg, 0.6), { rim: J.rim, body: J.pale, core: '#ffffff', rimW: 0.25 }); g.restore();
      }
    },
  },

  /** 안개 감싸기: 굵은 안개 리본과 가는 리본이 비스듬한 타원으로 몸을 한 바퀴 감아 돌고 안개 알갱이가 피어오름 */
  'monk-wrap': {
    frames: 22, logical: 92, scope: 'target',
    draw(g, { t }) {
      const run = lerp(0.12, 1, E.inOut(seg(t, 0, 0.7))), fade = 1 - E.in2(seg(t, 0.6, 1)), tilt = rad(-22);
      glow(g, 0, 0, 0.9, J.glow, 0.55 * (1 - E.out2(seg(t, 0, 0.7))));
      for (const [ph, w, rr, body] of [[0, 0.2, 0.82, J.light], [Math.PI, 0.11, 0.7, J.pale]]) {
        // 몸을 비스듬히 한 바퀴 반 감아 오름 (앞을 지날 때 진하고 뒤는 옅게)
        const P = s2 => { const a = ph + s2 * TAU * 1.4, x = Math.cos(a) * rr * (1 - 0.15 * s2), y = Math.sin(a) * rr * 0.32; return { x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt) + lerp(0.55, -0.6, s2), z: Math.sin(a) }; };
        const tail = Math.max(0, run - 0.5), n = 10;
        for (let k = 0; k < n; k++) {
          const s0 = lerp(tail, run, k / n), s1 = lerp(tail, run, (k + 1) / n) + 0.004, z = P((s0 + s1) / 2).z;
          lightStroke(g, P, s0, s1, () => w * lerp(0.45, 1, (k + 0.5) / n) * (z > 0 ? 1 : 0.75), { rim: J.rim, body, core: J.white, a: fade * (z > 0 ? 1 : 0.45), rimW: 0.022, coreW: 0.35 });
        }
        const q = P(run); puff(g, q.x, q.y, 0.2 * fade, 0.7 * fade, 3 + ph);
      }
      particles(g, t, 5, 14, r => ({ t0: 0.1 + r() * 0.5, life: 0.4, x: (r() - 0.5) * 1.4, y: (r() - 0.5) * 0.6, sz: 0.018 + r() * 0.015 }), (gg, p, age) => speck(gg, p.x, p.y - 0.4 * age, p.sz, J.pale, (1 - age) * fade));
    },
  },

  /** 떠도는 안개 (대상 · 옮겨 간 칸): 발 높이에 납작한 안개 뭉치 셋이 차례로 피어나 오른쪽으로 흘러가며 옅어짐 */
  'monk-mist': {
    frames: 24, logical: 90, scope: 'target',
    draw(g, { t }) {
      const by = 0.5;
      glowOval(g, 0, by, 0.9, 0.35, J.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.7))));
      glow(g, 0, 0.1, 0.95, J.glow, 0.4 * bell(t, 0, 0.2, 0.9)); // 안개에 감싸인 몸통 (사제 기준, QA 2026-10-16)
      for (let i = 0; i < 3; i++) {
        const u = seg(t, i * 0.1, i * 0.1 + 0.85), a = Math.min(1, u * 6 + (i ? 0 : 0.6)) * (1 - E.in2(seg(u, 0.5, 1))), x = lerp(-0.65 + i * 0.4, 0.05 + i * 0.4, E.out2(u)), y = by - 0.18 * i + Math.sin(u * 6 + i) * 0.04;
        puff(g, x, y, (0.53 - i * 0.06) * (0.75 + 0.25 * E.out2(u)), a, 7 + i * 13, 0.62);
        // 안개 뒤를 따라 가는 비취 결 (흐르는 방향)
        brush(g, s => ({ x: lerp(x - 0.45, x - 0.05, s), y: y + 0.06 + Math.sin(s * 5 + t * 8) * 0.025 }), 0, 1, 0.05, a * 0.8, J.light);
      }
      particles(g, t, 7, 16, r => ({ t0: r() * 0.6, life: 0.35, x: (r() - 0.5) * 1.2, y: by - r() * 0.5 }), (gg, p, age) => speck(gg, p.x + 0.3 * age, p.y - 0.15 * age, 0.024, J.pale, 1 - age));
    },
  },

  /** 안개 숨결 (범위 칸마다): 가운데에 흰 안개가 훅 뿜어져 좌우로 납작한 안개 덩이 둘이 밀려나고 작은 안개 방울이 옆으로 흩어짐 */
  'monk-breath': {
    frames: 20, logical: 80, scope: 'area',
    draw(g, { t }) {
      const u = E.out3(seg(t, 0, 0.6)), fade = 1 - E.in2(seg(t, 0.5, 1));
      glow(g, 0, 0.1, 0.9, J.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.5))));
      glow(g, 0, 0.1, 0.45, '#ffffff', 0.55 * (1 - E.out3(seg(t, 0, 0.25)))); // 사제 기준 첫 순간 흰 빛 (QA 2026-10-16)
      puff(g, 0, 0.1, 0.55 * (1 - 0.4 * u), (1 - E.out2(seg(t, 0, 0.55))), 4, 0.8);
      for (const sgn of [-1, 1]) {
        puff(g, sgn * lerp(0.15, 0.7, u), 0.12, lerp(0.34, 0.48, u), fade, sgn > 0 ? 11 : 17, 0.6);
        brush(g, s => ({ x: sgn * lerp(0.35, lerp(0.45, 1.0, u), s), y: 0.3 + Math.sin(s * 4) * 0.03 }), 0, 1, 0.05, fade * 0.8, J.light);
      }
      particles(g, t, 8, 12, r => ({ t0: r() * 0.15, life: 0.55, dir: r() < 0.5 ? -1 : 1, sp: 0.6 + r() * 0.5, y: (r() - 0.5) * 0.4 }), (gg, p, age) => speck(gg, p.dir * (0.15 + p.sp * E.out2(age)), 0.1 + p.y - 0.1 * age, 0.02, J.pale, (1 - age) * fade));
    },
  },

  /** 맑은 기운 (해제): 머리 위에서 발밑까지 비취 기 줄 셋이 차례로 쓸어내리듯 그어졌다가 위부터 사라짐. 어두운 기운이 아래로 씻겨 흩어짐 */
  'monk-clear': {
    frames: 18, logical: 90, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1));
      glow(g, 0, 0, 0.9, J.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.6))));
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.42, d = i === 1 ? 0 : 0.08 + 0.04 * i, down = E.out3(seg(t, d, d + 0.35)), up = E.in2(seg(t, d + 0.35, d + 0.75));
        const P = s => ({ x: x + Math.sin(s * 3 + i) * 0.04, y: lerp(-1.05, 0.95, s) });
        if (down > up) brush(g, P, up, down, i === 1 ? 0.17 : 0.12, fade, i === 1 ? J.light : J.mid);
        if (down < 1) { const p = P(down); glow(g, p.x, p.y, 0.25, J.glow, 0.8); speck(g, p.x, p.y, 0.03, J.white, 1); }
      }
      // 아래로 씻겨 나가는 어두운 기운
      particles(g, t, 3, 6, (r, i) => ({ t0: 0.15 + i * 0.05, life: 0.5, x: (r() - 0.5) * 1.1, sz: 0.07 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const y = 0.2 + 0.8 * E.out2(age), x = p.x * (1 + 0.6 * age), k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.4, 0, TAU); }, '#6a3a90', 0.35 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 3); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#9a6ac0', lo: '#2d1b4a', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
      });
    },
  },

  /** 누그러뜨림: 크게 출렁이는 가로 물결선 (아래 옅은 선)이 점점 잦아들어 거의 곧은 선이 되고 작은 빛 점이 가라앉음 */
  'monk-soothe': {
    frames: 24, logical: 92, scope: 'target',
    draw(g, { t }) {
      const calm = E.inOut(seg(t, 0.05, 0.75)), amp = lerp(0.32, 0.015, calm), fade = 1 - E.in2(seg(t, 0.65, 1)), run = E.out3(seg(t, 0, 0.25));
      glowOval(g, 0, 0.05, 1.1, 0.5, J.glow, 0.55 * (1 - E.out2(seg(t, 0, 0.8))));
      const wave = (y0, k, ph) => s => ({ x: lerp(-1.2, 1.2, s), y: y0 + Math.sin(s * TAU * 1.5 + ph + t * 5) * amp * k * Math.sin(Math.PI * s) ** 0.6 });
      brush(g, wave(0.32, 0.6, 1.2), 0.5 - run / 2, 0.5 + run / 2, 0.07, fade * 0.7, J.pale);
      brush(g, wave(0.05, 1, 0), 0.5 - run / 2, 0.5 + run / 2, 0.15, fade, J.light);
      // 가라앉는 빛 점
      particles(g, t, 4, 12, r => ({ t0: 0.15 + r() * 0.5, life: 0.4, x: (r() - 0.5) * 1.8, y: -0.5 + r() * 0.3 }), (gg, p, age) => speck(gg, p.x, p.y + 0.5 * E.out2(age), 0.022, J.pale, (1 - age) * fade));
      glint(g, 0, 0.05, 0.3 * bell(t, 0.6, 0.72, 0.95), J.glow, 1, 0, 0.1, J.white);
    },
  },

  /** 되살림 바람 (파티 전원): 왼쪽 아래에서 가는 바람 선 둘이 비스듬히 쓸어 올라가 끝이 말리고, 흰 꽃잎 몇 장이 바람을 타고 날림 */
  'monk-wind': {
    frames: 20, logical: 80, scope: 'party',
    draw(g, { t }) {
      const run = E.out2(seg(t, 0, 0.55)), fade = 1 - E.in2(seg(t, 0.55, 1));
      glow(g, 0, 0, 0.75, J.glow, 0.45 * (1 - E.out2(seg(t, 0, 0.6))));
      for (const [dx, dy, w] of [[0, 0, 0.15], [0.25, 0.25, 0.1]]) {
        const P = s => { if (s < 0.75) { const k = s / 0.75; return { x: lerp(-0.95, 0.45, k) + dx, y: lerp(0.75, -0.45, k) + dy + Math.sin(k * Math.PI) * 0.15 }; } const k = (s - 0.75) / 0.25, a = rad(-40 + k * 260), r = 0.22 * (1 - 0.4 * k); return { x: 0.45 + dx + 0.13 + Math.cos(a + Math.PI) * r, y: -0.45 + dy + 0.12 + Math.sin(a + Math.PI) * r }; };
        brush(g, P, Math.max(0, run - 0.6), run, w, fade, J.light);
      }
      // 꽃잎
      particles(g, t, 2, 5, (r, i) => ({ t0: 0.05 + i * 0.06, life: 0.7, x0: -0.8 + r() * 0.3, y0: 0.6 - r() * 0.2, rot: r() * 6 }), (gg, p, age) => {
        const x = p.x0 + 1.4 * E.out2(age), y = p.y0 - 1.2 * E.out2(age) + Math.sin(age * 8 + p.rot) * 0.08;
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 6); gg.scale(0.11, 0.14);
        solid(gg, h => path.petal(h, 0.6), { hi: '#ffffff', lo: '#d8f0e8', rim: J.rim, rimW: 0.12, a: (1 - age) * fade, shine: 0.3, y0: -1, y1: 0 }); gg.restore();
      });
    },
  },

  /** 차 한 잔 (내 칸): 발밑 쪽에 손잡이 달린 비취 찻잔이 놓이고 김 두 줄이 S자로 피어올라 위에서 흩어짐 */
  'monk-tea': {
    frames: 24, logical: 88, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.6), fade = 1 - E.in2(seg(t, 0.7, 1)), cy = 0.45;
      glowOval(g, 0, cy + 0.1, 0.8, 0.4, J.glow, 0.7 * fade);
      glow(g, 0, 0.05, 0.9, J.glow, 0.4 * bell(t, 0, 0.2, 0.85)); // 찻김이 감싼 몸통 (사제 기준, QA 2026-10-16)
      // 김 (S자 두 줄)
      for (const [x0, ph, d] of [[-0.1, 0, 0.1], [0.12, 2.2, 0.18]]) {
        const u = seg(t, d, d + 0.65), P = s => ({ x: x0 + Math.sin(s * 5.5 + ph + t * 4) * 0.12, y: lerp(cy - 0.2, cy - 1.2, s) });
        if (u > 0) lightStroke(g, P, Math.max(0, u - 0.6), u, w0 => 0.1 * Math.sin(Math.PI * w0), { rim: '#7aa898', body: J.white, core: '#ffffff', a: fade * 0.9 * (1 - seg(u, 0.7, 1)), rimW: 0.015, glowCol: J.glow, glowA: 0.4 });
      }
      // 찻잔
      if (pop > 0) {
        g.save(); g.translate(0, cy); g.scale(0.46 * pop, 0.46 * pop); g.globalAlpha = fade;
        const cup = gg => { gg.beginPath(); gg.moveTo(-0.75, -0.35); gg.lineTo(0.75, -0.35); gg.quadraticCurveTo(0.72, 0.45, 0.3, 0.55); gg.lineTo(-0.3, 0.55); gg.quadraticCurveTo(-0.72, 0.45, -0.75, -0.35); gg.closePath(); };
        // 손잡이
        g.beginPath(); g.ellipse(0.82, 0.02, 0.22, 0.22, 0, 0, TAU); g.lineWidth = 0.26; g.strokeStyle = J.rim; g.stroke(); g.lineWidth = 0.13; g.strokeStyle = J.mid; g.stroke();
        solid(g, cup, { hi: J.pale, lo: J.deep, rim: J.rim, rimW: 0.08, a: 1, shine: 0.6, y0: -0.35, y1: 0.55 });
        // 찻물 · 받침
        g.beginPath(); g.ellipse(0, -0.35, 0.72, 0.16, 0, 0, TAU); g.fillStyle = '#c8e070'; g.fill(); g.lineWidth = 0.07; g.strokeStyle = J.rim; g.stroke();
        g.beginPath(); g.ellipse(0, 0.6, 0.85, 0.14, 0, 0, TAU); g.fillStyle = J.mid; g.fill(); g.stroke();
        g.restore();
      }
      glint(g, -0.15, cy - 0.12, 0.2 * bell(t, 0.15, 0.25, 0.45), J.glow, 1, 0.3, 0.14, J.white);
    },
  },
};
