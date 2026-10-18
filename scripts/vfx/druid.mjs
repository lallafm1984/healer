// 드루이드: 풀빛 초록 · 나무 갈색 · 들꽃 분홍 · 노랑. 잎 · 꽃 · 씨앗 · 나무껍질 (단단한 것은 굵은 어두운 테)
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, leafAt, lerp, lightStroke, loopGlints, loopRise, particles, path, rad, ringGlow, rng, seg, solid, speck, TAU, wave } from './lib.mjs';

const G = { rim: '#123d14', deep: '#2f8a3a', mid: '#6cc04a', light: '#b6e86a', pale: '#e6ffb8', glow: '#8fe05a' };
const WOOD = { rim: '#1e1006', dark: '#5a3418', mid: '#8a5a2b', light: '#c08a4a' };
const PINK = { rim: '#4a0f2a', deep: '#d8457a', mid: '#f48fb1', light: '#ffd0e0' };
const YEL = '#ffd54a', TEAL = '#4fd1c0', TEAL_DEEP = '#0f5a52';

/** 꽃 한 송이 (꽃잎 n장, 크기 size, 피어남 open 0–1) */
function flower(g, x, y, size, open, rot, { n = 5, hi = PINK.light, lo = PINK.deep, rim = PINK.rim, center = YEL, a = 1 } = {}) {
  if (size <= 0 || a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot);
  for (let i = 0; i < n; i++) {
    g.save(); g.rotate((i * TAU) / n); const s = size * (0.35 + 0.65 * open); g.scale(s * lerp(0.6, 1, open), s);
    solid(g, gg => path.petal(gg, 0.62), { hi, lo, rim, rimW: 0.05 / Math.max(0.3, open), a, shine: 0.4, y0: -1, y1: 0 }); g.restore();
  }
  g.beginPath(); g.arc(0, 0, size * 0.28, 0, TAU); g.fillStyle = rim; g.globalAlpha = a; g.fill();
  g.beginPath(); g.arc(0, 0, size * 0.22, 0, TAU); g.fillStyle = center; g.fill();
  g.beginPath(); g.arc(-size * 0.06, -size * 0.06, size * 0.08, 0, TAU); g.fillStyle = '#fff8d0'; g.fill();
  g.restore();
}
/** 나무껍질 판 (육각 고리의 한 조각, 안 반지름 r0 · 바깥 r1, 각 a0–a1) */
function barkPlate(g, r0, r1, a0, a1, a) {
  const mk = gg => { gg.beginPath(); gg.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); gg.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1); gg.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); gg.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); gg.closePath(); };
  solid(g, mk, { hi: WOOD.light, lo: WOOD.dark, rim: WOOD.rim, rimW: 0.035, a, shine: 0.35, y0: -r1, y1: r1 });
  // 나뭇결
  g.save(); g.globalAlpha = a * 0.7; g.strokeStyle = WOOD.rim; g.lineWidth = 0.018;
  for (let k = 1; k < 3; k++) { const r = lerp(r0, r1, k / 3) + 0.02 * Math.sin(k * 3 + a0 * 5); g.beginPath(); g.moveTo(Math.cos(a0 + 0.06) * r, Math.sin(a0 + 0.06) * r); g.lineTo(Math.cos(a1 - 0.06) * r, Math.sin(a1 - 0.06) * r); g.stroke(); }
  g.restore();
}

export default {
  /** 새싹: 칸 아래 흙에서 새싹이 쏙 돋아 잎 두 장을 펴고, 초록 빛가루가 떠오른 뒤 흐려짐 */
  'druid-sprout': {
    frames: 20, logical: 80, scope: 'target',
    draw(g, { t }) {
      const grow = E.back(seg(t, 0, 0.35), 1.4), fade = 1 - E.in2(seg(t, 0.6, 1)), by = 0.62;
      glowOval(g, 0, by, 0.85, 0.4, G.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.5))));
      glow(g, 0, by - 0.2, 0.45, G.pale, 0.7 * (1 - E.out3(seg(t, 0, 0.3))));
      // 흙 둔덕
      g.save(); g.translate(0, by + 0.05); g.scale(0.5, 0.15); solid(g, gg => { gg.beginPath(); gg.arc(0, 0.3, 1, Math.PI, 0); gg.closePath(); }, { hi: WOOD.light, lo: WOOD.dark, rim: WOOD.rim, rimW: 0.12, a: fade, shine: 0.3 }); g.restore();
      // 줄기 + 잎 둘
      const h = 0.95 * grow, sw = Math.sin(t * 9) * 0.05 * (1 - t);
      glow(g, 0, by - h * 0.7, 0.6, G.glow, 0.5 * fade);
      const P = bez([0, by], [0.02, by - h * 0.4], [-0.08 + sw, by - h * 0.75], [sw, by - h]);
      lightStroke(g, P, 0, 1, u => 0.12 * (1 - 0.4 * u), { rim: G.rim, body: G.mid, core: G.pale, a: fade, rimW: 0.028, coreW: 0.3 });
      const tip = P(1), L = 0.56 * E.back(seg(t, 0.12, 0.45), 1.6);
      leafAt(g, tip.x - 0.22, tip.y + 0.03, L, rad(-58) + sw, { a: fade });
      leafAt(g, tip.x + 0.22, tip.y + 0.05, L * 0.9, rad(60) + sw, { a: fade });
      particles(g, t, 4, 16, r => ({ t0: 0.08 + r() * 0.45, life: 0.4, x: (r() - 0.5) * 0.9, y: by - r() * 0.5, sz: 0.018 + r() * 0.012 }), (gg, p, age) => speck(gg, p.x + Math.sin(age * 6 + p.x * 9) * 0.06, p.y - 0.55 * age, p.sz, G.light, (1 - age) * fade));
      glint(g, tip.x + 0.04, tip.y - 0.06, 0.2 * bell(t, 0.2, 0.32, 0.55), G.glow, 1, 0.3, 0.14, G.pale);
    },
  },

  /** 생장: 가운데에서 연두 구슬이 부풀어 터지고 잎사귀 여섯 장이 나선으로 돌며 퍼져 천천히 떨어짐 */
  'druid-growth': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const burst = seg(t, 0.12, 1), fade = 1 - E.in2(seg(t, 0.55, 1));
      // 구슬 (처음에 부풀었다 터짐)
      const orb = t < 0.15 ? lerp(0.32, 0.42, E.out2(t / 0.15)) : 0.42 * (1 - E.out3(seg(t, 0.15, 0.3)));
      glow(g, 0, 0, 1.0, G.glow, 0.8 * (1 - E.out2(seg(t, 0, 0.55))));
      if (orb > 0.01) { g.save(); g.scale(orb, orb); energy(g, gg => { gg.beginPath(); gg.arc(0, 0, 1, 0, TAU); }, { rim: G.rim, body: G.light, core: G.pale, rimW: 0.08, glowCol: G.glow, glowR: 0.5 }); g.restore(); }
      ringGlow(g, 0, 0, lerp(0.3, 1.0, E.out3(seg(t, 0.12, 0.45))), 0.12, G.pale, 0.7 * bell(t, 0.12, 0.18, 0.45), 1);
      for (let i = 0; i < 6; i++) {
        const a0 = (i * TAU) / 6, a = a0 + E.out2(burst) * 2.2, d = lerp(0.15, 0.88, E.out3(burst)), y = Math.sin(a) * d * 0.75 + 0.25 * E.in2(seg(t, 0.4, 1));
        leafAt(g, Math.cos(a) * d, y, 0.34 * (t < 0.12 ? 0 : 1), a + rad(90) + Math.sin(t * 10 + i) * 0.3, { a: fade });
      }
      particles(g, t, 6, 14, r => ({ t0: 0.12 + r() * 0.1, life: 0.5 + r() * 0.3, a: r() * TAU, sp: 0.6 + r() * 0.6, sz: 0.02 + r() * 0.015 }), (gg, p, age) => speck(gg, Math.cos(p.a) * p.sp * E.out2(age), Math.sin(p.a) * p.sp * E.out2(age) * 0.8 - 0.2 * age, p.sz, G.light, 1 - age));
    },
  },

  /** 피워 내기: 가운데에서 분홍 꽃 한 송이가 활짝 피고 노란 꽃가루가 터진 뒤 꽃잎이 흩어짐 */
  'druid-bloom': {
    frames: 18, logical: 90, scope: 'target',
    draw(g, { t }) {
      const open = E.back(seg(t, 0, 0.3), 1.8), scatter = seg(t, 0.5, 1), fade = 1 - E.in2(seg(t, 0.55, 1));
      glow(g, 0, 0, 1.1, PINK.mid, 0.6 * (1 - E.out2(seg(t, 0, 0.7))));
      glow(g, 0, 0, 0.5, '#ffffff', 0.7 * (1 - E.out3(seg(t, 0, 0.3))));
      if (t < 0.5) flower(g, 0, -0.02, 0.62, Math.min(1, open), rad(10) + t * 0.6, { a: 1 });
      else for (let i = 0; i < 5; i++) { // 꽃잎이 떨어져 나감
        const a = rad(10) + 0.3 + (i * TAU) / 5, d = 0.62 * 0.5 + 0.7 * E.out2(scatter), s = 0.62 * (1 - 0.35 * scatter);
        g.save(); g.translate(Math.cos(a - Math.PI / 2) * d * 0.6, Math.sin(a - Math.PI / 2) * d * 0.6 + 0.3 * scatter * scatter); g.rotate(a + scatter * 2 * (i % 2 ? 1 : -1)); g.scale(s * 0.85, s);
        solid(g, gg => path.petal(gg, 0.62), { hi: PINK.light, lo: PINK.deep, rim: PINK.rim, rimW: 0.06, a: fade, shine: 0.4, y0: -1, y1: 0 }); g.restore();
      }
      // 꽃가루 터짐
      particles(g, t, 2, 22, r => ({ t0: 0.18 + r() * 0.12, life: 0.45 + r() * 0.3, a: r() * TAU, sp: 0.5 + r() * 0.7, sz: 0.018 + r() * 0.018 }), (gg, p, age) => {
        const d = p.sp * E.out2(age); speck(gg, Math.cos(p.a) * d, Math.sin(p.a) * d * 0.85 + 0.15 * age * age, p.sz, YEL, 1 - age);
      });
      glint(g, 0, -0.02, 0.6 * bell(t, 0.2, 0.28, 0.5), YEL, 1, 0.3, 0.12);
    },
  },

  /** 들꽃 군락 (범위 칸마다): 칸 바닥에 작은 들꽃 넷이 차례로 톡톡 피고 풀잎이 살랑이다 흐려짐 */
  'druid-wildflower': {
    frames: 24, logical: 72, scope: 'area',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), by = 0.55;
      glowOval(g, 0, by, 0.9, 0.3, G.glow, 0.6 * (1 - E.out2(seg(t, 0, 0.6))));
      // 풀잎
      for (let i = 0; i < 9; i++) {
        const x = -0.72 + i * 0.18, h = (0.2 + 0.12 * ((i * 7) % 3)) * E.out3(seg(t, i * 0.015, 0.25 + i * 0.015)), sw = Math.sin(t * 8 + i) * 0.05;
        lightStroke(g, bez([x, by + 0.08], [x, by - h * 0.4], [x + sw, by - h * 0.7], [x + sw * 2 + 0.04, by - h]), 0, 1, u => 0.06 * (1 - u), { rim: G.rim, body: i % 2 ? G.mid : G.deep, core: G.light, a: fade, rimW: 0.018, coreW: 0.3 });
      }
      const fl = [[-0.5, 0.42, 0, YEL, '#c98a10'], [-0.12, 0.38, 0.08, PINK.mid, PINK.deep], [0.22, 0.44, 0.16, '#ffffff', '#c0b8d8'], [0.55, 0.4, 0.24, PINK.light, PINK.deep]];
      for (const [x, y, d, hi, lo] of fl) {
        const o = E.back(seg(t, d, d + 0.18), 2);
        flower(g, x, y, 0.17 * o, Math.min(1, o), x * 3 + t, { hi, lo, rim: '#3a1a10', center: hi === YEL ? '#ff9a3a' : YEL, a: fade });
        glint(g, x, y - 0.05, 0.16 * bell(t, d + 0.05, d + 0.12, d + 0.3), '#ffffff', 1, 0, 0.16);
      }
      particles(g, t, 9, 8, r => ({ t0: 0.1 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 1.3, sz: 0.016 }), (gg, p, age) => speck(gg, p.x, by - 0.1 - 0.45 * age, p.sz, G.light, (1 - age) * fade));
    },
  },

  /** 자연 정화: 청록 바람 두 줄기가 칸을 한 바퀴 휘감으며 보라 얼룩을 털어 내고, 작은 잎 몇 장이 남았다 사라짐 */
  'druid-cleanse': {
    frames: 18, logical: 90, scope: 'target',
    draw(g, { t }) {
      const run = E.out2(seg(t, 0, 0.75)), fade = 1 - E.in2(seg(t, 0.6, 1));
      glow(g, 0, 0, 0.9, TEAL, 0.55 * (1 - E.out2(seg(t, 0, 0.6))));
      // 바람 줄기 넷 (반지름 · 높이가 다른 가는 호가 빠르게 칸을 휘감음)
      for (const [ph, rr, y0, w, sp] of [[0, 0.9, 0.05, 0.11, 1], [2.1, 0.72, -0.25, 0.08, 1.2], [4.0, 0.8, 0.3, 0.09, 0.9], [1.0, 0.55, -0.05, 0.06, 1.4]]) {
        const P = s2 => { const a = ph + s2 * TAU * 1.3 * sp; return { x: Math.cos(a) * rr, y: y0 + Math.sin(a) * rr * 0.42 }; };
        const head = run * 0.95 + 0.05;
        comet(g, P, Math.max(0, head - 0.32), head, { w, rim: TEAL_DEEP, body: TEAL, core: '#e8fffb', glowCol: TEAL, a: fade, head: 0 });
      }
      // 털려 나가는 보라 얼룩
      particles(g, t, 12, 5, (r, i) => ({ t0: 0.15 + i * 0.06, life: 0.55, a: rad(i * 72 + r() * 30), sz: 0.08 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.3 + 0.8 * E.out2(age), x = Math.cos(p.a) * d, y = Math.sin(p.a) * d * 0.8, k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.3, 0, TAU); }, '#7a3ca8', 0.3 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#a46ad0', lo: '#3d1b5a', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
      });
      // 바람에 실려 남는 잎
      for (let i = 0; i < 3; i++) { const u = seg(t, 0.25 + i * 0.08, 1), a = i * 2.1 + u * 3; leafAt(g, Math.cos(a) * 0.65, Math.sin(a) * 0.4 - 0.2 * u, 0.2, a * 2, { hi: '#b8f0d0', lo: '#2a9a7a', rim: TEAL_DEEP, a: bell(u, 0, 0.15, 1) }); }
    },
  },

  /** 나무껍질: 갈색 나무껍질 판 여섯 조각이 칸 둘레에서 모여 육각 껍질로 맞물리고, 이음새에 연두 빛이 한 번 흐른 뒤 흐려짐 */
  'druid-bark': {
    frames: 24, logical: 92, scope: 'target',
    draw(g, { t }) {
      const come = E.back(seg(t, 0, 0.32), 1.2), fade = 1 - E.in2(seg(t, 0.65, 1)), rot = rad(-30);
      glow(g, 0, 0, 1.1, '#d8a050', 0.4 * (1 - E.out2(seg(t, 0, 0.6))));
      for (let i = 0; i < 6; i++) {
        const a0 = rot + (i * TAU) / 6 + 0.04, a1 = rot + ((i + 1) * TAU) / 6 - 0.04, mid = (a0 + a1) / 2, off = 0.55 * (1 - come);
        g.save(); g.translate(Math.cos(mid) * off, Math.sin(mid) * off); barkPlate(g, 0.86, 1.08, a0, a1, fade * Math.min(1, t * 8 + 0.3)); g.restore();
      }
      // 이음새를 따라 흐르는 연두 빛
      const flow = seg(t, 0.3, 0.6), fb = bell(t, 0.3, 0.4, 0.7);
      for (let i = 0; i < 6; i++) {
        const a = rot + (i * TAU) / 6;
        lightStroke(g, s => ({ x: Math.cos(a) * lerp(0.84, 1.1, s), y: Math.sin(a) * lerp(0.84, 1.1, s) }), 0, Math.max(0.01, flow), () => 0.06, { rim: G.rim, body: G.light, core: G.pale, a: fb, rimW: 0.015, glowCol: G.glow, glowA: 0.8 });
        glint(g, Math.cos(a) * 0.97, Math.sin(a) * 0.97, 0.18 * fb, G.glow, 1, a, 0.15, G.pale);
      }
      ringGlow(g, 0, 0, 0.97, 0.12, G.glow, 0.5 * fb);
    },
  },

  /** 고요한 숲 (파티 전원): 연두 잎사귀가 위에서 천천히 흔들리며 떨어지고 칸 바닥에 옅은 초록 안개가 깔림 */
  'druid-quietwood': {
    frames: 24, logical: 72, scope: 'party',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.65, 1));
      // 바닥 안개
      for (let i = 0; i < 3; i++) bloom(g, gg => { gg.beginPath(); gg.ellipse(-0.45 + i * 0.45 + Math.sin(t * 3 + i) * 0.08, 0.6, 0.38, 0.13, 0, 0, TAU); }, i === 1 ? G.light : G.mid, 0.45 * bell(t, 0, 0.25, 1), 6);
      const leaves = [[-0.45, 0, 1], [0.35, 0.1, -1], [0.0, 0.22, 1], [-0.15, 0.32, -1]];
      for (const [x0, d, dir] of leaves) {
        const u = seg(t, d * 0.6, d * 0.6 + 0.75), a = bell(u, 0, 0.12, 1) * fade, y = lerp(-0.95, 0.5, E.inOut(u)), x = x0 + Math.sin(u * 7 + x0 * 4) * 0.22 * dir;
        if (a > 0) leafAt(g, x, y, 0.27, rad(70) * Math.sin(u * 7 + x0 * 4) * dir + rad(20), { a });
      }
      particles(g, t, 3, 8, r => ({ t0: r() * 0.6, life: 0.35, x: (r() - 0.5) * 1.2, y: 0.6 - r() * 0.3 }), (gg, p, age) => speck(gg, p.x, p.y - 0.3 * age, 0.016, G.light, (1 - age) * fade));
    },
  },

  /** 환생 (부활): 칸 바닥의 금빛 씨앗이 터지며 초록 · 금빛 빛 기둥 (기둥은 이것만)이 솟고, 둘레로 잎과 빛 알갱이가 소용돌이치며 올라감 */
  'druid-rebirth': {
    frames: 24, logical: 98, scope: 'target',
    draw(g, { t }) {
      const by = 0.62, burst = seg(t, 0.08, 1), fade = 1 - E.in2(seg(t, 0.62, 1)), H = 1.55 * E.out3(seg(t, 0.08, 0.35));
      // 씨앗 (처음 몇 장)
      const seed = 1 - seg(t, 0, 0.12);
      if (seed > 0) { g.save(); g.translate(0, by); g.scale(0.17 * (1 + 0.3 * (1 - seed)), 0.22); energy(g, gg => { gg.beginPath(); gg.ellipse(0, 0, 0.8, 1, 0, 0, TAU); }, { rim: '#4a3008', body: '#ffd56b', core: '#ffffff', rimW: 0.12, glowCol: '#ffcf6a', glowR: 0.6, a: seed }); g.restore(); }
      glowOval(g, 0, by, 1.0, 0.4, '#ffd56b', 0.85 * bell(t, 0, 0.1, 0.7));
      // 빛 기둥
      if (H > 0) {
        const w = 0.42 * (1 - 0.5 * seg(t, 0.5, 1));
        g.save(); g.globalAlpha = fade;
        bloom(g, gg => gg.rect(-w * 1.4, by - H, w * 2.8, H), G.glow, 0.6, 9);
        const gr = g.createLinearGradient(0, by, 0, by - H); gr.addColorStop(0, C('#fff6c0', 0.95)); gr.addColorStop(0.5, C(G.light, 0.75)); gr.addColorStop(1, C(G.glow, 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(-w, by); g.lineTo(-w * 0.75, by - H); g.lineTo(w * 0.75, by - H); g.lineTo(w, by); g.closePath(); g.fill();
        const gc = g.createLinearGradient(0, by, 0, by - H); gc.addColorStop(0, C('#ffffff', 1)); gc.addColorStop(1, C('#ffffff', 0));
        g.fillStyle = gc; g.fillRect(-w * 0.25, by - H, w * 0.5, H);
        g.restore();
      }
      // 소용돌이치며 오르는 잎 · 빛 알갱이
      for (let i = 0; i < 6; i++) {
        const u = seg(burst, i * 0.06, 0.6 + i * 0.06), a = i * 1.05 + u * 7, r = 0.6 - 0.15 * u, y = by - 1.5 * E.out2(u);
        const z = Math.sin(a), k = bell(u, 0, 0.1, 1) * fade;
        if (i % 2) leafAt(g, Math.cos(a) * r, y, 0.24 * (0.8 + 0.2 * z), a, { a: k * (z > 0 ? 1 : 0.6) });
        else { glint(g, Math.cos(a) * r, y, 0.17, '#ffd56b', k, a, 0.15); }
      }
      particles(g, t, 8, 22, r => ({ t0: 0.08 + r() * 0.5, life: 0.4, x: (r() - 0.5) * 0.9, sz: 0.018 + r() * 0.015 }), (gg, p, age) => speck(gg, p.x * (1 - age * 0.3), by - 1.4 * E.out2(age), p.sz, age < 0.5 ? '#ffe08a' : G.light, (1 - age) * fade));
      glint(g, 0, by - H, 0.35 * bell(t, 0.25, 0.35, 0.7), '#ffd56b', 1, 0, 0.12);
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 드루이드 이끼 자리 (board-moss, 그림 아래쪽에 낮게 깔림): 이끼가 초록빛으로 숨 쉬고, 반딧불 같은 연두 포자가 이끼에서 흔들리며 떠오르고 꽃 · 새싹이 차례로 반짝임 */
  'druid-moss-loop': {
    frames: 36, fps: 12, loop: true, logical: 87, size: 256, scope: 'target',
    draw(g, { t }) {
      glowOval(g, 0, 0.22, 0.95, 0.34, G.glow, 0.1 + 0.12 * wave(t, 1));
      loopRise(g, t, 16, { x0: -0.78, x1: 0.78, y0: 0.2, y1: -0.95, per: 1, sz: 0.038, col: G.pale, glowCol: G.glow, sway: 0.13, seed: 5 });
      loopRise(g, t, 6, { x0: -0.6, x1: 0.6, y0: 0.25, y1: -0.4, per: 2, sz: 0.029, col: YEL, glowCol: YEL, sway: 0.08, seed: 9 });
      loopGlints(g, t, [[-0.34, 0.2], [0.16, -0.14], [0.2, 0.32], [0.56, 0.36], [-0.1, -0.02]], { size: 0.225, col: '#ffffff', glowCol: G.glow, per: 1 });
    },
  },
};
