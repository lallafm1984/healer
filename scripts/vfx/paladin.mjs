// 성기사: 따뜻한 금빛 · 흰빛 + 호박 · 주황 강조 (사제의 하늘빛 대신), 희생은 진홍. 원뿔 빛 · 룬 · 문장처럼 굵고 단단한 모양
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, seg, solid, speck, taper, TAU } from './lib.mjs';

const AU = { rim: '#4a2a06', deep: '#c47a12', body: '#ffc94a', light: '#ffe9a0', core: '#fffaf0', glow: '#ffb84a', amber: '#ff9a2a' };
const RED = { rim: '#2a0606', deep: '#8a1020', body: '#d8283a', light: '#ff7a6a', glow: '#ff4a3a' };

/** 마름모 룬 (가운데 세로 획이 새겨진 금빛 마름모) */
function rune(g, x, y, s, a, rot = 0) {
  if (s <= 0 || a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  glow(g, 0, 0, 1.6, AU.glow, 0.55 * a);
  solid(g, gg => path.diamond(gg, 0.62), { hi: AU.light, lo: AU.deep, rim: AU.rim, rimW: 0.12, a, shine: 0.6 });
  g.globalAlpha = a; g.strokeStyle = AU.core; g.lineWidth = 0.14; g.beginPath(); g.moveTo(0, -0.55); g.lineTo(0, 0.55); g.moveTo(-0.25, -0.1); g.lineTo(0.25, -0.1); g.stroke();
  g.restore();
}
/** 사슬 고리 하나 (가운데 (x, y), 세로로 긴 타원, face 1 = 정면 · 0 = 옆) */
function link(g, x, y, s, face, a, col = AU) {
  g.save(); g.translate(x, y); g.globalAlpha = a; g.lineCap = 'round';
  const w = s * lerp(0.12, 0.42, face), h = s * 0.62;
  g.beginPath(); g.ellipse(0, 0, Math.max(0.01, w), h, 0, 0, TAU);
  g.lineWidth = s * 0.3; g.strokeStyle = col.rim; g.stroke();
  g.lineWidth = s * 0.19; g.strokeStyle = col.body; g.stroke();
  g.lineWidth = s * 0.07; g.strokeStyle = col.light; g.stroke();
  g.restore();
}

export default {
  /** 빛의 손길 (기본 힐, 자주 씀 → 가볍게, Lim 2026-10-16 「너무 과하다. 기본힐인데 그에 맞게」): 칸 위쪽 한 점에서 아래로 좁게 내려오는 금빛 원뿔 빛 + 빛살 셋 + 금빛 먼지 몇 개, 위에서부터 빨리 걷힘 */
  'paladin-holy-light': {
    frames: 16, logical: 80, scope: 'target',
    draw(g, { t }) {
      const top = -0.95, bot = 0.55, open = lerp(0.55, 1, E.out3(seg(t, 0, 0.18))), lift = E.in2(seg(t, 0.4, 1)), fade = 1 - E.in2(seg(t, 0.55, 1));
      const y0 = lerp(top, bot, lift), w = 0.5 * open;
      if (y0 < bot - 0.05) {
        const wAt = y => lerp(0.04, w, (y - top) / (bot - top));
        g.save(); g.globalAlpha = fade * 0.85;
        bloom(g, gg => { gg.beginPath(); gg.moveTo(-wAt(y0), y0); gg.lineTo(wAt(y0), y0); gg.lineTo(w, bot); gg.lineTo(-w, bot); gg.closePath(); }, AU.glow, 0.25, 7);
        const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, C(AU.core, 0.6)); gr.addColorStop(0.55, C(AU.light, 0.18)); gr.addColorStop(1, C(AU.body, 0.04));
        g.globalCompositeOperation = 'lighter'; g.fillStyle = gr;
        g.beginPath(); g.moveTo(-wAt(y0), y0); g.lineTo(wAt(y0), y0); g.lineTo(w, bot); g.lineTo(-w, bot); g.closePath(); g.fill();
        for (let i = -1; i <= 1; i++) {
          const k = i / 1.8, sh = 0.5 + 0.5 * Math.sin(t * 16 + i * 2);
          lightStroke(g, s2 => ({ x: lerp(k * wAt(y0) * 0.9, k * w * 0.9, s2), y: lerp(y0, bot, s2) }), 0, 1, u => 0.035 * Math.sin(Math.PI * u), { rim: AU.deep, body: AU.light, core: '#ffffff', a: 0.5 + 0.3 * sh, rimW: 0, coreW: 0.5 });
        }
        g.restore();
        for (const sgn of [-1, 1]) lightStroke(g, s2 => ({ x: sgn * lerp(wAt(y0), w, s2), y: lerp(y0, bot, s2) }), 0, 1, u => 0.022 * Math.sin(Math.PI * u) ** 0.5, { rim: AU.rim, body: AU.body, core: AU.core, a: fade * 0.75, rimW: 0.008 });
      }
      glowOval(g, 0, bot, 0.55, 0.3, AU.glow, 0.6 * open * fade);
      glowOval(g, 0, bot, 0.3, 0.35, '#ffffff', 0.55 * (1 - E.out2(seg(t, 0, 0.35))));
      glint(g, 0, top + 0.03, 0.22 * (1 - lift) * open, AU.amber, fade, 0, 0.14);
      particles(g, t, 6, 8, r => ({ t0: r() * 0.4, life: 0.45, x: (r() - 0.5) * 0.7, y: -0.4 + r() * 0.5, sz: 0.014 + r() * 0.012 }), (gg, p, age) => speck(gg, p.x, p.y + 0.4 * age, p.sz, AU.body, (1 - age) * fade));
    },
  },

  /** 빛의 서약 (지속): 칸 둘레를 금빛 마름모 룬 셋이 돌고, 가운데에 오각 서약 문양이 떠올랐다 흐려짐 */
  'paladin-oath': {
    frames: 24, logical: 90, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), em = bell(t, 0, 0.18, 0.75), spin = t * TAU * 0.85;
      glow(g, 0, 0, 1.0, AU.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.7))));
      // 가운데 오각 문양 (가는 금 테 + 별)
      g.save(); g.rotate(rad(-90 / 5) + t * 0.4); const es = 0.5 * (0.85 + 0.15 * E.back(seg(t, 0, 0.3)));
      g.globalAlpha = em; g.scale(es, es);
      bloom(g, gg => path.poly(gg, 5), AU.glow, 0.55, 6);
      path.poly(g, 5); { const gf = g.createRadialGradient(0, 0, 0, 0, 0, 1); gf.addColorStop(0, C(AU.light, 0.5)); gf.addColorStop(1, C(AU.body, 0.25)); g.fillStyle = gf; g.fill(); }
      path.poly(g, 5); g.lineWidth = 0.16; g.strokeStyle = C(AU.rim, 0.85); g.stroke(); g.lineWidth = 0.09; g.strokeStyle = AU.body; g.stroke(); g.lineWidth = 0.035; g.strokeStyle = AU.core; g.stroke();
      g.save(); g.scale(0.62, 0.62); path.star(g, 5, 0.42); g.restore(); g.fillStyle = C(AU.core, 0.85); g.fill(); g.lineWidth = 0.08; g.strokeStyle = C(AU.rim, 0.8); g.stroke();
      g.restore();
      // 도는 룬 셋 (뒤에 있는 것은 작고 옅게, 꼬리)
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * TAU) / 3, z = Math.sin(a), x = Math.cos(a) * 0.9, y = z * 0.32 + 0.05, s = 0.27 * (0.8 + 0.2 * z) * E.back(seg(t, i * 0.05, 0.2 + i * 0.05));
        const P = s2 => { const b = a - (1 - s2) * 1.1; return { x: Math.cos(b) * 0.9, y: Math.sin(b) * 0.32 + 0.05 }; };
        comet(g, P, 0, 1, { w: 0.07, rim: AU.rim, body: AU.body, core: AU.core, glowCol: AU.glow, a: fade * (z > 0 ? 0.9 : 0.5), head: 0 });
        rune(g, x, y, s, fade * (z > 0 ? 1 : 0.7), Math.sin(a) * 0.2);
      }
    },
  },

  /** 빛의 파도 (회복한 칸마다): 금빛 파도 마루가 위에서 쏟아져 내려와 부서지고, 물마루 둘이 양옆으로 말려 굴러가며 흩어짐 */
  'paladin-light-wave': {
    frames: 18, logical: 88, scope: 'target',
    draw(g, { t }) {
      const hit = 0.2, fade = 1 - E.in2(seg(t, 0.5, 1));
      /** 파도 마루 (∩ 띠, 가운데 높이 y, 반폭 w, 두께 th) */
      const crest = (y, w, th, a) => {
        const P = bez([-w, y + w * 0.55], [-w * 0.7, y - w * 0.45], [w * 0.7, y - w * 0.45], [w, y + w * 0.55]);
        lightStroke(g, P, 0, 1, u => th * Math.sin(Math.PI * u) ** 0.5, { rim: AU.rim, body: AU.body, core: '#ffffff', a, rimW: 0.025, coreW: 0.4, glowCol: AU.glow, glowA: 0.7 });
        // 마루 위 거품 방울
        for (let k = 0; k < 5; k++) { const p = P(0.2 + k * 0.15); speck(g, p.x, p.y - th * 0.55, 0.03, '#ffffff', a * 0.9); }
      };
      if (t < hit + 0.08) {
        const u = E.in2(seg(t, 0, hit)), y = lerp(-0.75, 0.15, u), a = 1 - seg(t, hit, hit + 0.08);
        glowOval(g, 0, y - 0.1, 0.8, 0.45, AU.glow, 0.6 * a);
        crest(y, 0.72, 0.3, a);
        for (let i = -3; i <= 3; i++) lightStroke(g, s2 => ({ x: i * 0.17, y: lerp(y - 0.75, y - 0.25, s2) }), 0, 1, uu => 0.045 * uu, { rim: AU.deep, body: AU.light, core: '#ffffff', a: 0.6 * a, rimW: 0 });
      }
      const b = bell(t, hit - 0.06, hit + 0.02, hit + 0.4);
      glowOval(g, 0, 0.3, 1.05, 0.5, AU.glow, 0.95 * b);
      glow(g, 0, 0.28, 0.5, '#ffffff', b);
      if (t >= hit) {
        const u = seg(t, hit, 1), d = 0.25 + 0.75 * E.out2(u);
        for (const sgn of [-1, 1]) { // 양옆으로 말려 굴러가는 물마루 (나선처럼 감김)
          const cx = sgn * d, cy = 0.32, r = 0.42 * (1 - 0.35 * u);
          const P = s2 => { const a = rad(sgn > 0 ? lerp(190, -150, s2) : lerp(-10, 330, s2)), rr = r * lerp(1, 0.35, s2); return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.85 }; };
          lightStroke(g, P, 0, Math.min(1, 0.35 + u * 1.3), uu => 0.17 * (1 - uu * 0.7) * (1 - 0.45 * u), { rim: AU.rim, body: AU.body, core: '#ffffff', a: fade, rimW: 0.024, glowCol: AU.glow, glowA: 0.5 });
        }
        particles(g, u, 4, 18, r => ({ t0: 0, life: 0.55 + r() * 0.35, x: (r() - 0.5) * 0.9, vx: (r() - 0.5) * 1.2, vy: 0.8 + r() * 0.8, sz: 0.022 + r() * 0.022 }), (gg, p, age) => speck(gg, p.x + p.vx * age, 0.25 - p.vy * age + 1.3 * age * age, p.sz, AU.light, (1 - age) * fade));
      }
    },
  },

  /** 정화의 손: 가운데 둥근 빛에서 다섯 빛살이 해돋이처럼 펼쳐지며 검붉은 · 보라 얼룩을 밖으로 튕겨 냄 */
  'paladin-cleanse': {
    frames: 18, logical: 92, scope: 'target',
    draw(g, { t }) {
      const open = E.back(seg(t, 0, 0.28), 1.5), fade = 1 - E.in2(seg(t, 0.5, 1)), cy = 0.25;
      glow(g, 0, cy, 1.0, AU.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.6))));
      // 빛살 다섯 (손가락처럼 위로 부채)
      for (let i = 0; i < 5; i++) {
        const a = rad(-90 + (i - 2) * 30), L = (i === 2 ? 1.05 : i % 4 === 0 ? 0.7 : 0.92) * Math.min(1.1, open);
        lightStroke(g, s => ({ x: Math.cos(a) * lerp(0.28, L, s), y: cy + Math.sin(a) * lerp(0.28, L, s) }), 0, 1, taper(0.17, 0.15, 0.8), { rim: AU.rim, body: AU.body, core: '#ffffff', a: fade, rimW: 0.022, coreW: 0.45, glowCol: AU.glow, glowA: 0.5 });
      }
      // 손바닥 (둥근 빛)
      g.save(); g.translate(0, cy); const ps = 0.32 * Math.min(1, open); g.scale(ps, ps * 0.9);
      energy(g, gg => { gg.beginPath(); gg.arc(0, 0, 1, 0, TAU); }, { rim: AU.rim, body: AU.body, core: AU.core, rimW: 0.08, glowCol: AU.glow, glowR: 0.6, a: fade }); g.restore();
      // 튕겨 나가는 검붉은 · 보라 얼룩
      particles(g, t, 3, 5, (r, i) => ({ t0: 0.08, life: 0.6, a: rad(-180 + i * 45 + r() * 15), sz: 0.08 + r() * 0.04, rot: r() * 6, c: i % 2 }), (gg, p, age) => {
        const d = 0.35 + 0.85 * E.out3(age), x = Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.85, k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.3, 0, TAU); }, p.c ? '#7a3ca8' : '#8a1a2a', 0.35 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: p.c ? '#a46ad0' : '#c84a5a', lo: p.c ? '#3d1b5a' : '#4a0a14', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
      });
    },
  },

  /** 희생: 칸 위에서 진홍 · 금빛 사슬이 내려와 대상과 이어지고, 가운데 작은 금빛 방패가 붉게 한 번 맥동한 뒤 흐려짐 */
  'paladin-sacrifice': {
    frames: 22, logical: 92, scope: 'target',
    draw(g, { t }) {
      const drop = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.65, 1)), pulse = bell(t, 0.25, 0.38, 0.65);
      glow(g, 0, 0, 1.0, RED.glow, 0.35 * fade + 0.4 * pulse);
      // 사슬 (위에서 방패까지)
      const yEnd = lerp(-1.45, -0.15, drop), n = 7;
      for (let i = 0; i < n; i++) {
        const y = -1.45 + ((yEnd + 1.45) * (i + 0.5)) / n, sw = Math.sin(i * 0.8 + t * 6) * 0.02;
        link(g, sw, y, 0.18, i % 2 ? 0.15 : 1, fade * (0.55 + 0.45 * (i / n)), i % 2 ? RED : AU);
      }
      bloom(g, gg => gg.rect(-0.12, -1.45, 0.24, yEnd + 1.45), RED.glow, 0.3 * fade, 5);
      // 방패 (붉게 맥동)
      const s = 0.36 * (1 + 0.18 * pulse) * E.back(seg(t, 0.15, 0.35));
      g.save(); g.translate(0, 0.08); g.scale(s, s);
      glow(g, 0, 0, 2.2, RED.glow, 0.8 * pulse);
      const shield = gg => { gg.beginPath(); gg.moveTo(0, -0.95); gg.quadraticCurveTo(0.55, -0.85, 0.8, -0.7); gg.quadraticCurveTo(0.82, 0.35, 0, 1); gg.quadraticCurveTo(-0.82, 0.35, -0.8, -0.7); gg.quadraticCurveTo(-0.55, -0.85, 0, -0.95); gg.closePath(); };
      solid(g, shield, { hi: pulse > 0.3 ? RED.light : AU.light, lo: pulse > 0.3 ? RED.deep : AU.deep, rim: RED.rim, rimW: 0.1, a: fade, shine: 0.6 });
      g.globalAlpha = fade; g.strokeStyle = AU.core; g.lineWidth = 0.1; g.beginPath(); g.moveTo(0, -0.6); g.lineTo(0, 0.6); g.moveTo(-0.4, -0.2); g.lineTo(0.4, -0.2); g.stroke();
      g.restore();
      ringGlow(g, 0, 0.08, lerp(0.3, 0.95, seg(t, 0.28, 0.6)), 0.1, RED.glow, 0.7 * pulse);
    },
  },

  /** 빛의 성역 (범위 칸마다): 칸 바닥의 금빛 고리 위로 반투명한 금빛 반구 막이 솟아오르고 위로 빛 알갱이가 올라감 */
  'paladin-sanctuary': {
    frames: 24, logical: 76, scope: 'area',
    draw(g, { t }) {
      const rise = E.out3(seg(t, 0.05, 0.4)), fade = 1 - E.in2(seg(t, 0.6, 1)), by = 0.55, R = 0.85;
      // 바닥 고리
      g.save(); g.translate(0, by); g.scale(1, 0.32); g.globalAlpha = fade * Math.min(1, t * 10 + 0.4);
      glow(g, 0, 0, R * 1.2, AU.glow, 0.5);
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.lineWidth = 0.14; g.strokeStyle = C(AU.rim, 0.85); g.stroke(); g.lineWidth = 0.08; g.strokeStyle = AU.body; g.stroke(); g.lineWidth = 0.03; g.strokeStyle = AU.core; g.stroke();
      g.restore();
      // 반구 막
      if (rise > 0) {
        const H = 1.25 * rise;
        g.save(); g.globalAlpha = fade;
        const dome = gg => { gg.beginPath(); gg.ellipse(0, by, R, H, 0, Math.PI, TAU); gg.ellipse(0, by, R, R * 0.32, 0, 0, Math.PI); gg.closePath(); };
        g.save(); g.globalCompositeOperation = 'lighter'; dome(g);
        const gr = g.createRadialGradient(0, by, R * 0.2, 0, by, Math.max(R, H)); gr.addColorStop(0, C(AU.glow, 0.05)); gr.addColorStop(0.75, C(AU.glow, 0.22)); gr.addColorStop(1, C(AU.light, 0.6));
        g.fillStyle = gr; g.fill(); g.restore();
        g.beginPath(); g.ellipse(0, by, R, H, 0, Math.PI, TAU); g.lineWidth = 0.1; g.strokeStyle = C(AU.rim, 0.6); g.stroke(); g.lineWidth = 0.05; g.strokeStyle = C(AU.light, 0.95); g.stroke();
        // 막 위 빛 무늬 (세로 갈비)
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(0, by, Math.abs(i) * R * 0.32 + 0.001, H, 0, Math.PI, TAU); g.lineWidth = 0.025; g.strokeStyle = C(AU.light, 0.45); g.stroke(); }
        g.restore();
        glint(g, -R * 0.35, by - H * 0.85, 0.2 * bell(t, 0.3, 0.4, 0.6), AU.glow, 1, 0.2, 0.15);
      }
      particles(g, t, 5, 12, r => ({ t0: 0.15 + r() * 0.45, life: 0.4, x: (r() - 0.5) * 1.3, sz: 0.018 }), (gg, p, age) => speck(gg, p.x * 0.8, by - 0.1 - 1.1 * age, p.sz, AU.light, (1 - age) * fade));
    },
  },

  /** 보호의 손 (무적): 대상 둘레에 금빛 팔각 봉인 문양 (정사각형 둘을 45° 엇갈림)이 탁 나타나 돌고, 꼭짓점이 차례로 켜졌다가 안으로 접히며 사라짐 */
  'paladin-hand-guard': {
    frames: 24, logical: 94, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.18), 2), fold = E.in3(seg(t, 0.72, 1)), s = 1.0 * pop * (1 - fold), rot = rad(10) + t * 0.9, fade = 1 - E.in2(seg(t, 0.8, 1));
      glow(g, 0, 0, 1.15, AU.glow, 0.55 * fade);
      glow(g, 0, 0, 0.5, '#ffffff', 0.8 * (1 - E.out3(seg(t, 0, 0.3))));
      if (s > 0.01) {
        g.save(); g.rotate(rot); g.scale(s, s); g.globalAlpha = fade;
        const sq = (r0) => { g.save(); g.rotate(r0); g.beginPath(); g.rect(-0.66, -0.66, 1.32, 1.32); g.restore(); };
        bloom(g, gg => { gg.save(); gg.lineWidth = 0.2; gg.restore(); sq(0); sq(Math.PI / 4); }, AU.glow, 0.25, 8);
        for (const r0 of [0, Math.PI / 4]) { sq(r0); g.lineWidth = 0.17; g.strokeStyle = C(AU.rim, 0.9); g.stroke(); g.lineWidth = 0.1; g.strokeStyle = AU.body; g.stroke(); g.lineWidth = 0.035; g.strokeStyle = AU.core; g.stroke(); }
        // 안쪽 원 문양 (가는 선)
        g.beginPath(); g.arc(0, 0, 0.5, 0, TAU); g.lineWidth = 0.05; g.strokeStyle = C(AU.light, 0.7); g.stroke();
        g.restore();
        // 꼭짓점 8곳이 차례로 켜짐
        for (let i = 0; i < 8; i++) {
          const a = rot + rad(45) + (i * TAU) / 8, d = 0.66 * Math.SQRT2 * s, b = bell(t, 0.12 + i * 0.05, 0.18 + i * 0.05, 0.4 + i * 0.05);
          glint(g, Math.cos(a) * d, Math.sin(a) * d, 0.24 * b, AU.amber, b * fade, a, 0.14);
        }
      }
      particles(g, t, 7, 10, r => ({ t0: 0.7 + r() * 0.1, life: 0.3, a: r() * TAU }), (gg, p, age) => speck(gg, Math.cos(p.a) * 0.9 * (1 - age), Math.sin(p.a) * 0.9 * (1 - age), 0.02, AU.light, 1 - age));
    },
  },
  /** 봉화 (대상 지정 + 회복 + 피해 감소): 머리 위에 작은 금빛 봉화 그릇이 놓여 불꽃이 확 타오르고, 불티가 오르며 몸 둘레로 따뜻한 금빛이 한 번 감쌌다 남음 */
  'paladin-beacon': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.8), fire = E.out3(seg(t, 0.08, 0.3)), fade = 1 - E.in2(seg(t, 0.62, 1)), by = -0.55;
      glow(g, 0, 0.1, 1.0, AU.glow, 0.45 * fade);
      glowOval(g, 0, 0.1, 0.85, 1.1, AU.amber, 0.3 * bell(t, 0.15, 0.35, 1));
      // 불꽃 (그릇 위, 일렁임)
      const fh = 0.5 * fire * (1 + 0.12 * Math.sin(t * 30)), sway = Math.sin(t * 24) * 0.05;
      if (fh > 0.02) {
        g.save(); g.translate(0, by - 0.02); g.scale(fh * 0.55, fh);
        const fl = h => { h.beginPath(); h.moveTo(sway * 2, -1); h.bezierCurveTo(0.35, -0.55, 0.9, -0.2, 0.75, 0.12); h.quadraticCurveTo(0.55, 0.45, 0, 0.42); h.quadraticCurveTo(-0.55, 0.45, -0.75, 0.12); h.bezierCurveTo(-0.9, -0.2, -0.35, -0.55, sway * 2, -1); h.closePath(); };
        bloom(g, fl, AU.amber, 0.7 * fade, 5);
        solid(g, fl, { hi: '#fff3b0', lo: '#ff8a2a', rim: '#3a1a06', rimW: 0.07, a: fade, shine: 0.3, y0: -1, y1: 0.4 });
        g.save(); g.translate(0, 0.12); g.scale(0.5, 0.55); fl(g); g.fillStyle = C('#fffde8', 0.95 * fade); g.fill(); g.restore();
        g.restore();
      }
      // 봉화 그릇 (받침 달린 금빛 사발)
      g.save(); g.translate(0, by + 0.12); g.scale(0.3 * pop, 0.3 * pop);
      const bowl = h => { h.beginPath(); h.moveTo(-0.9, -0.25); h.lineTo(0.9, -0.25); h.quadraticCurveTo(0.8, 0.45, 0.25, 0.5); h.lineTo(0.18, 0.78); h.lineTo(0.5, 0.95); h.lineTo(-0.5, 0.95); h.lineTo(-0.18, 0.78); h.lineTo(-0.25, 0.5); h.quadraticCurveTo(-0.8, 0.45, -0.9, -0.25); h.closePath(); };
      solid(g, bowl, { hi: AU.light, lo: AU.deep, rim: AU.rim, rimW: 0.08, a: fade, shine: 0.6, y0: -0.25, y1: 0.95 });
      g.globalAlpha = fade; g.strokeStyle = C(AU.rim, 0.8); g.lineWidth = 0.08; g.beginPath(); g.moveTo(-0.7, 0.05); g.lineTo(0.7, 0.05); g.stroke();
      g.restore();
      // 불티
      particles(g, t, 5, 12, r => ({ t0: 0.12 + r() * 0.5, life: 0.4, x: (r() - 0.5) * 0.3, sz: 0.022 + r() * 0.015 }), (gg, p, age) => speck(gg, p.x + Math.sin(age * 9 + p.x * 20) * 0.08, by - 0.4 - 0.6 * age, p.sz, AU.body, (1 - age) * fade));
      // 몸 둘레 따뜻한 빛 (피해 감소) 빛 점 몇 개가 돌며 내려옴
      for (let i = 0; i < 4; i++) { const a = t * 6 + (i * TAU) / 4, d = 0.55, b = bell(t, 0.25 + i * 0.04, 0.4 + i * 0.04, 0.95); glint(g, Math.cos(a) * d, 0.2 + Math.sin(a) * d * 0.45, 0.14 * b, AU.glow, b, a, 0.15); }
    },
  },
};
