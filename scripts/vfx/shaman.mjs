// 주술사: 깊은 물빛 (청록 · 파랑 + 흰 물거품) · 흙빛 돌 · 영혼 남빛. 사제 정화의 하늘빛보다 진하고 물결 · 물줄기 · 돌처럼 무게 있는 모양
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ribbonPath, ringGlow, seg, solid, speck, TAU } from './lib.mjs';

const W = { rim: '#08304f', deep: '#1677b8', body: '#3fb0e8', light: '#a8e6ff', foam: '#f0fbff', glow: '#4cc0f0' };
const STONE = { rim: '#1f160c', dark: '#6b5636', mid: '#9a8358', light: '#d2c08e' };
const SPIRIT = { rim: '#141238', deep: '#3b3a9a', body: '#7a7ff0', light: '#c8ccff', glow: '#8a8ff8' };

/** 물방울 하나 (위가 뾰족한 눈물, 가운데 (x, y), 크기 s) */
function drop(g, x, y, s, a = 1, sq = 1) {
  if (s <= 0 || a <= 0) return;
  g.save(); g.translate(x, y); g.scale(s / sq, s * sq);
  energy(g, path.drop, { rim: W.rim, body: W.body, core: W.light, rimW: 0.09, glowCol: W.glow, glowR: 0.5, a, coreScale: 0.55 });
  g.beginPath(); g.ellipse(-0.18, 0.05, 0.12, 0.2, -0.4, 0, TAU); g.fillStyle = C('#ffffff', 0.85 * a); g.fill();
  g.restore();
}
/** 납작한 물결 고리 (위에서 본 수면) */
function ripple(g, x, y, r, a, w = 0.07) {
  if (r <= 0 || a <= 0) return;
  ringGlow(g, x, y, r, w * 1.6, W.glow, 0.6 * a, 0.32);
  g.save(); g.translate(x, y); g.scale(1, 0.32); g.globalAlpha = a; g.beginPath(); g.arc(0, 0, r, 0, TAU);
  g.lineWidth = w * 1.8; g.strokeStyle = C(W.rim, 0.85); g.stroke(); g.lineWidth = w; g.strokeStyle = W.body; g.stroke(); g.lineWidth = w * 0.4; g.strokeStyle = W.foam; g.stroke(); g.restore();
}
/** 튀는 물방울 입자 (포물선) */
function spray(g, t, seed, n, x0, y0, { up = 1, spread = 1, a = 1, size = 0.035 } = {}) {
  particles(g, t, seed, n, r => ({ t0: r() * 0.08, life: 0.55 + r() * 0.3, vx: (r() - 0.5) * 1.3 * spread, vy: (0.7 + r() * 0.7) * up, sz: size * (0.6 + r() * 0.7) }), (gg, p, age) => {
    const x = x0 + p.vx * age, y = y0 - p.vy * age + 1.5 * age * age;
    drop(gg, x, y, p.sz * (1 - 0.4 * age), (1 - age) * a);
  });
}

/** 물살 띠 (깊은 물빛 몸 → 밝은 물빛 → 한쪽 가장자리 흰 거품): 곡선 P의 s0–s1, 두께 w(u) */
function waterRibbon(g, P, s0, s1, w, a = 1, foamSide = 1) {
  if (s1 <= s0 || a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.save(); g.globalCompositeOperation = 'lighter'; g.filter = 'blur(4px)'; ribbonPath(g, P, s0, s1, u => w(u) * 2 + 0.05); g.fillStyle = C(W.glow, 0.35); g.fill(); g.restore();
  ribbonPath(g, P, s0, s1, u => w(u) + 0.045); g.fillStyle = C(W.rim, 0.92); g.fill();
  ribbonPath(g, P, s0, s1, w); g.fillStyle = C(W.deep, 0.95); g.fill();
  // 안쪽 밝은 물살 (한쪽으로 치우침)
  const off = (s, k) => { const p = P(s), q = P(Math.min(1, s + 0.003)), q0 = P(Math.max(0, s - 0.003)); let dx = q.x - q0.x, dy = q.y - q0.y; const l = Math.hypot(dx, dy) || 1; return { x: p.x - (dy / l) * k, y: p.y + (dx / l) * k }; };
  const span = s1 - s0;
  ribbonPath(g, s => off(s, 0), s0, s1, u => w(u) * 0.62); g.fillStyle = C(W.body, 0.95); g.fill();
  ribbonPath(g, s => off(s, 0), s0, s1, u => w(u) * 0.24); g.fillStyle = C(W.light, 0.9); g.fill();
  // 거품 가장자리 (끊긴 흰 점선)
  for (let i = 0; i < 18; i++) {
    const s = s0 + span * ((i + 0.5) / 18), u = (s - s0) / span, ww = w(u);
    if (ww < 0.02 || i % 3 === 2) continue;
    const p = off(s, foamSide * ww * 0.42);
    g.beginPath(); g.ellipse(p.x, p.y, ww * 0.16, ww * 0.1, 0, 0, TAU); g.fillStyle = C(W.foam, 0.95); g.fill();
  }
  g.restore();
}
/** 물거품 방울 (투명 몸 + 테 + 흰 점) */
function bubble(g, x, y, r, a = 1) {
  if (r <= 0 || a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = C(W.light, 0.35); g.fill();
  g.lineWidth = r * 0.3; g.strokeStyle = C(W.rim, 0.75); g.stroke(); g.lineWidth = r * 0.15; g.strokeStyle = C(W.foam, 0.9); g.stroke();
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
  g.restore();
}

export default {
  /** 잔물결: 발밑에 물방울이 톡 떨어진 자리에서 위에서 본 납작한 물결 두 겹이 차례로 퍼지고 작은 물방울이 튐 */
  'shaman-ripple': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const by = 0.6, fade = 1 - E.in2(seg(t, 0.55, 1));
      glowOval(g, 0, by, 1.0, 0.35, W.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.6))));
      glowOval(g, 0, by, 0.4, 0.4, '#ffffff', 0.8 * (1 - E.out3(seg(t, 0, 0.25))));
      // 사제 치유처럼 몸통에도 물빛 (QA 2026-10-16 Lim 「이펙트 퀄리티는 사제 기준」: 발밑 고리만이라 맞은 칸이 잘 안 보였음)
      glow(g, 0, 0.15, 1.0, W.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, 0.2, 0.45, '#ffffff', 0.6 * (1 - E.out3(seg(t, 0, 0.25))));
      ripple(g, 0, by, lerp(0.15, 1.0, E.out3(seg(t, 0, 0.7))), fade * (1 - seg(t, 0.4, 0.9)), 0.1);
      ripple(g, 0, by, lerp(0.05, 0.65, E.out3(seg(t, 0.15, 0.85))), fade * bell(t, 0.12, 0.25, 1), 0.075);
      // 가운데 물기둥 (톡 튀었다 가라앉음)
      const col = Math.sin(Math.PI * seg(t, 0, 0.45)) * 0.7;
      if (col > 0.01) lightStroke(g, s => ({ x: 0, y: lerp(by, by - col, s) }), 0, 1, u => 0.15 * (1 - u * 0.6), { rim: W.rim, body: W.body, core: W.foam, a: fade, rimW: 0.024 });
      if (col > 0.05) drop(g, 0, by - col - 0.1, 0.12, fade);
      spray(g, t, 3, 14, 0, by, { up: 1.1, spread: 1.3, size: 0.05 });
    },
  },

  /** 물방울 (지속): 머리 위에서 큰 물방울 하나가 떨어져 닿는 순간 납작하게 퍼지고, 작은 물방울이 튀고 반짝이가 스며듦 */
  'shaman-droplet': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const hit = 0.2, yHit = -0.3, fade = 1 - E.in2(seg(t, 0.55, 1));
      if (t < hit) {
        const u = E.in2(seg(t, 0, hit)), y = lerp(-1.15, yHit, u);
        comet(g, s => ({ x: 0, y: lerp(y - 0.5, y - 0.15, s) }), 0, 1, { w: 0.12, rim: W.rim, body: W.body, core: W.foam, glowCol: W.glow, head: 0, a: 0.8 });
        drop(g, 0, y, 0.24, 1, 1 + 0.15 * u);
        return;
      }
      const u = seg(t, hit, 1);
      glowOval(g, 0, yHit + 0.1, 0.9, 0.55, W.glow, 0.85 * (1 - E.out2(u)));
      glow(g, 0, 0.15, 0.95, W.glow, 0.45 * (1 - E.out2(seg(u, 0, 0.7)))); // 몸통까지 스미는 물빛 (사제 기준)
      glow(g, 0, yHit + 0.05, 0.4, '#ffffff', 1 - E.out3(seg(u, 0, 0.35)));
      // 왕관처럼 튀는 짧은 물줄기 + 옅게 퍼지는 물막 (점점 몸에 스며 옅어짐)
      const sq = E.out3(seg(u, 0, 0.3));
      g.save(); g.translate(0, yHit + 0.12); g.scale(lerp(0.22, 0.62, sq), lerp(0.09, 0.13, sq)); g.globalAlpha = fade * (1 - seg(u, 0.25, 0.8));
      g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = C(W.body, 0.75); g.fill(); g.lineWidth = 0.2; g.strokeStyle = C(W.rim, 0.8); g.stroke(); g.restore();
      for (let i = 0; i < 6; i++) {
        const a = rad(-90 + (i - 2.5) * 30), L = 0.58 * E.out3(seg(u, 0, 0.35)) * (i % 2 ? 0.75 : 1);
        lightStroke(g, s2 => ({ x: Math.cos(a) * lerp(0.08, L, s2) * 1.1, y: yHit + 0.12 + Math.sin(a) * lerp(0.05, L, s2) + 0.25 * u * u * s2 }), 0, 1, uu => 0.1 * (1 - uu * 0.6) * (1 - u), { rim: W.rim, body: W.light, core: W.foam, a: fade, rimW: 0.02 });
      }
      spray(g, u, 7, 12, 0, yHit + 0.05, { up: 1.2, spread: 1.6, size: 0.06, a: fade });
      // 몸으로 스며드는 반짝이
      particles(g, u, 9, 10, r => ({ t0: 0.15 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 0.9, y: yHit + 0.1 + r() * 0.1 }), (gg, p, age) => speck(gg, p.x * (1 - age * 0.5), p.y + 0.55 * age, 0.02, W.light, (1 - age) * fade));
    },
  },

  /** 씻김 (해제, Lim 2026-10-16 「정화 이펙트를 좀더 퀄리티 높게」): 발밑 양옆에서 거품 머금은 굵은 물살 두 가닥이 몸을 감싸며 솟아 머리 위에서 만나고,
   *  어두운 얼룩이 물살에 휩쓸려 올라가 거품으로 부서진 뒤, 머리 위에서 물보라가 왕관처럼 터져 맑은 물방울이 떨어짐 */
  'shaman-washing': {
    frames: 22, logical: 96, scope: 'target',
    draw(g, { t }) {
      const run = E.out2(seg(t, 0, 0.48)), fade = 1 - E.in2(seg(t, 0.62, 1)), by = 0.7, top = -0.95;
      glowOval(g, 0, by, 0.95, 0.35, W.glow, 0.8 * (1 - E.out2(seg(t, 0, 0.6))));
      ripple(g, 0, by, lerp(0.3, 0.9, E.out3(seg(t, 0, 0.5))), (1 - seg(t, 0.2, 0.7)) * fade, 0.06);
      // 양옆에서 몸을 감싸듯 바깥으로 부풀었다 머리 위에서 만나는 물살 (서로 엇갈리지 않음: 이중 나선은 사제 소생)
      for (const [sgn, w, foam, back] of [[1, 0.19, 1, true], [-1, 0.23, -1, false]]) {
        const B = bez([sgn * 0.15, by + 0.02], [sgn * 0.78, by - 0.2], [sgn * 0.72, top + 0.35], [sgn * 0.02, top]), P = s2 => { const p = B(s2), wv = Math.sin(s2 * 9 - t * 18) * 0.05 * Math.sin(Math.PI * s2); return { x: p.x + sgn * wv, y: p.y }; };
        const tail = Math.max(0, run - 0.5 + 0.25 * seg(t, 0.45, 0.85)), thin = 1 - 0.55 * seg(t, 0.55, 1);
        waterRibbon(g, P, tail, Math.max(tail + 0.01, run), u => w * thin * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1))), fade * (back ? 0.7 : 1), foam);
        if (run < 0.97) { const p = P(run); drop(g, p.x, p.y - 0.05, 0.08, fade); }
        // 물살 속 거품
        for (let i = 0; i < 4; i++) { const s2 = Math.max(0, run - 0.1 - i * 0.16); if (s2 <= tail) continue; const p = P(s2); bubble(g, p.x + Math.sin(i * 2 + t * 9) * 0.04, p.y, 0.035 + 0.012 * (i % 2), fade * (back ? 0.6 : 1)); }
      }
      // 휩쓸려 올라가는 어두운 얼룩 → 거품으로 부서짐
      particles(g, t, 12, 4, (r, i) => ({ t0: 0.08 + i * 0.06, life: 0.5, a: r() * TAU, sz: 0.085 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const a = p.a + age * 5, rr = 0.45 * (1 - 0.3 * age), x = Math.cos(a) * rr, y = lerp(0.35, -0.75, E.inOut(age)), pop = seg(age, 0.65, 1), k = 1 - pop;
        if (k > 0) {
          bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.3, 0, TAU); }, '#6a3a90', 0.3 * k, 4);
          gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * k, p.sz * k);
          solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, r2 = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * r2, Math.sin(aa) * r2); } h.closePath(); }, { hi: '#a46ad0', lo: '#3d1b5a', rim: '#14081e', rimW: 0.16, a: 1, shine: 0.25 }); gg.restore();
        }
        if (pop > 0) for (let j = 0; j < 4; j++) { const b = (j * TAU) / 4 + p.rot; bubble(gg, x + Math.cos(b) * 0.1 * pop, y + Math.sin(b) * 0.1 * pop - 0.05 * pop, 0.03 * (1 - pop * 0.5), (1 - pop) * fade); }
      });
      // 머리 위 왕관 물보라 + 맑은 물방울
      const crown = seg(t, 0.42, 0.85);
      if (crown > 0) {
        glow(g, 0, top + 0.05, 0.55, W.glow, 0.7 * (1 - crown));
        for (let i = 0; i < 7; i++) {
          const a = rad(-90 + (i - 3) * 24), L = 0.42 * E.out3(crown) * (i % 2 ? 0.75 : 1);
          lightStroke(g, s2 => ({ x: Math.cos(a) * L * s2 * 1.1, y: top + 0.1 + Math.sin(a) * L * s2 + 0.3 * crown * crown * s2 }), 0, 1, u => 0.07 * (1 - u * 0.6) * (1 - crown), { rim: W.rim, body: W.light, core: W.foam, a: fade, rimW: 0.016 });
        }
        spray(g, crown, 6, 10, 0, top + 0.05, { up: 0.8, spread: 1.8, size: 0.05, a: fade });
      }
    },
  },
  /** 연쇄 치유 (튄 칸마다, Lim 2026-10-16 「순차적으로」): 앞 사람 쪽에서 거품 물살이 휘어 날아와 닿으며 물보라 · 물결이 터짐.
   *  그림은 왼쪽에서 들어오고, 게임이 앞 사람 (첫 대상은 나) 쪽으로 돌려 그리며 튄 순서대로 0.16초씩 늦춤 (battle/index.ts) */
  'shaman-chain': {
    frames: 16, logical: 100, scope: 'target',
    draw(g, { t }) {
      const hit = 0.26, fade = 1 - E.in2(seg(t, 0.45, 1));
      const P = bez([-1.5, 0.05], [-1.1, -0.55], [-0.45, -0.5], [0, 0.02]);
      const s = lerp(0.3, 1, E.in2(seg(t, 0, hit)));
      if (t < hit + 0.12) waterRibbon(g, P, Math.max(0, s - 0.65), Math.max(0.02, s), u => 0.24 * u ** 0.6, 1 - seg(t, hit, hit + 0.12), 1);
      if (t < hit) { const p = P(s); drop(g, p.x, p.y, 0.14, 1); }
      const b = bell(t, hit - 0.04, hit + 0.02, hit + 0.42);
      glow(g, 0, 0.02, 1.05, W.glow, 0.95 * b);
      glow(g, 0, 0.02, 0.5, '#ffffff', b);
      if (t >= hit) {
        const u = seg(t, hit, 1);
        ripple(g, 0, 0.08, lerp(0.25, 0.95, E.out3(u)), (1 - u) * fade, 0.095);
        // 물보라 (사방으로 짧은 물줄기, 들어온 쪽 반대로 더 길게)
        for (let i = 0; i < 9; i++) {
          const a = (i * TAU) / 9 + 0.2, L = (0.55 + 0.3 * Math.max(0, Math.cos(a))) * E.out3(seg(u, 0, 0.4));
          lightStroke(g, s2 => ({ x: Math.cos(a) * lerp(0.1, L, s2), y: 0.02 + Math.sin(a) * lerp(0.1, L, s2) * 0.8 + 0.2 * u * u * s2 }), 0, 1, uu => 0.14 * (1 - uu) * (1 - u), { rim: W.rim, body: W.light, core: W.foam, a: fade, rimW: 0.022 });
        }
        spray(g, u, 2, 14, 0, 0.02, { up: 0.9, spread: 1.7, size: 0.055, a: fade });
        for (let i = 0; i < 5; i++) { const a = rad(-140 + i * 55), d = 0.25 + 0.4 * E.out2(u); bubble(g, Math.cos(a) * d, 0.02 + Math.sin(a) * d * 0.7 - 0.25 * u, 0.04, (1 - u) * fade); }
      }
    },
  },
  /** 대지 토템: 발밑에서 흙빛 돌 가시 셋이 차례로 솟고, 면에 물빛 빛줄기가 한 번 훑고 지나간 뒤 다시 가라앉음. 흙먼지가 조금 튐 */
  'shaman-earth': {
    frames: 22, logical: 94, scope: 'target',
    draw(g, { t }) {
      const by = 0.72, sink = E.in2(seg(t, 0.7, 1)), fade = 1 - E.in2(seg(t, 0.75, 1));
      glowOval(g, 0, by, 1.0, 0.3, '#c9a060', 0.5 * (1 - E.out2(seg(t, 0, 0.6))));
      // 갈라진 땅
      g.save(); g.translate(0, by); g.scale(1, 0.3); g.globalAlpha = fade;
      g.beginPath(); g.arc(0, 0, 0.75, 0, TAU); const gd = g.createRadialGradient(0, 0, 0, 0, 0, 0.75); gd.addColorStop(0, C(STONE.dark, 0.85)); gd.addColorStop(1, C(STONE.dark, 0)); g.fillStyle = gd; g.fill(); g.restore();
      const spikes = [[-0.45, 0.68, -14, 0.0], [0.45, 0.74, 15, 0.07], [0, 1.08, 0, 0.14]];
      for (const [x, h, tilt, d] of spikes) {
        const grow = E.back(seg(t, d, d + 0.2), 1.3) * (1 - sink), H = h * grow;
        if (H <= 0.01) continue;
        g.save(); g.translate(x, by); g.rotate(rad(tilt));
        const w = 0.2 + 0.08 * h;
        const left = gg => { gg.beginPath(); gg.moveTo(-w, 0); gg.lineTo(-w * 0.5, -H * 0.55); gg.lineTo(0, -H); gg.lineTo(w * 0.08, 0); gg.closePath(); };
        const right = gg => { gg.beginPath(); gg.moveTo(w * 0.08, 0); gg.lineTo(0, -H); gg.lineTo(w * 0.5, -H * 0.5); gg.lineTo(w, 0); gg.closePath(); };
        const all = gg => { gg.beginPath(); gg.moveTo(-w, 0); gg.lineTo(-w * 0.5, -H * 0.55); gg.lineTo(0, -H); gg.lineTo(w * 0.5, -H * 0.5); gg.lineTo(w, 0); gg.closePath(); };
        g.globalAlpha = fade;
        glow(g, 0, -H * 0.5, H * 0.7, W.glow, 0.35);
        all(g); g.lineWidth = 0.07; g.strokeStyle = STONE.rim; g.lineJoin = 'round'; g.stroke();
        left(g); { const gr = g.createLinearGradient(-w, -H, 0, 0); gr.addColorStop(0, '#efe0b0'); gr.addColorStop(1, STONE.mid); g.fillStyle = gr; } g.fill();
        right(g); { const gr = g.createLinearGradient(0, -H, w, 0); gr.addColorStop(0, STONE.mid); gr.addColorStop(1, '#4a3a22'); g.fillStyle = gr; } g.fill();
        // 물빛 금 (돌에 새겨진 빛 줄)
        const rune = bell(t, 0.2 + d, 0.35 + d, 0.8);
        lightStroke(g, s2 => ({ x: lerp(-w * 0.35, -w * 0.12, s2) + Math.sin(s2 * 9) * 0.02, y: lerp(-H * 0.15, -H * 0.75, s2) }), 0, 1, () => 0.04, { rim: W.rim, body: W.body, core: W.foam, a: rune, rimW: 0.012, glowCol: W.glow, glowA: 0.8 });
        g.strokeStyle = C(STONE.rim, 0.6); g.lineWidth = 0.02; g.beginPath(); g.moveTo(0, -H); g.lineTo(w * 0.08, 0); g.stroke();
        // 물빛 빛줄기 (아래에서 위로 한 번 훑음)
        const sw = seg(t, 0.3 + d, 0.55 + d);
        if (sw > 0 && sw < 1) { g.save(); all(g); g.clip(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(Math.PI * sw); const yy = lerp(0, -H, sw); const gr = g.createLinearGradient(0, yy + 0.14, 0, yy - 0.14); gr.addColorStop(0, C(W.glow, 0)); gr.addColorStop(0.5, C(W.light, 0.95)); gr.addColorStop(1, C(W.glow, 0)); g.fillStyle = gr; g.fillRect(-1, yy - 0.15, 2, 0.3); g.restore(); }
        g.restore();
      }
      // 흙먼지 · 돌 조각
      particles(g, t, 4, 12, r => ({ t0: r() * 0.2, life: 0.45 + r() * 0.2, x: (r() - 0.5) * 1.0, vx: (r() - 0.5) * 1.2, vy: 0.5 + r() * 0.6, sz: 0.03 + r() * 0.03, rock: r() < 0.4 }), (gg, p, age) => {
        const x = p.x + p.vx * age, y = by - p.vy * age + 1.4 * age * age;
        if (p.rock) { gg.save(); gg.translate(x, y); gg.rotate(age * 6); gg.scale(p.sz, p.sz); solid(gg, h => path.poly(h, 5), { hi: STONE.light, lo: STONE.dark, rim: STONE.rim, rimW: 0.25, a: 1 - age, shine: 0.2 }); gg.restore(); }
        else bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 2, 0, TAU); }, '#c9a878', 0.4 * (1 - age), 3);
      });
    },
  },

  /** 비구름 토템 (파티 전원 · 2초마다, Lim 2026-10-16 「비구름 이펙트를 좀더 퀄리티 높게」): 머리 위에 몽실한 비구름이 부풀어 떠서 그늘진 아래에서
   *  물방울 비가 비스듬히 내리고, 발밑에 작은 물결 · 물보라가 톡톡 튐. 여러 칸이 2초마다 다시 뜨므로 작고 가볍게 */
  'shaman-rain': {
    frames: 22, logical: 76, scope: 'party',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.22), 1.6), fade = 1 - E.in2(seg(t, 0.62, 1)), cy = -0.66, drift = Math.sin(t * 4) * 0.03, by = 0.62;
      // 비 (구름 아래에서 비스듬히, 물방울 머리 + 꼬리)
      particles(g, t, 6, 16, (r, i) => ({ t0: 0.1 + (i / 16) * 0.55 + r() * 0.04, life: 0.2 + r() * 0.05, x: (r() - 0.5) * 0.85, sz: 0.026 + r() * 0.012 }), (gg, p, age) => {
        const y = lerp(cy + 0.18, by, age), x = p.x - 0.12 * age, a = fade * (age < 0.15 ? age / 0.15 : 1);
        gg.save(); gg.globalAlpha = a; gg.lineCap = 'round';
        gg.strokeStyle = C(W.rim, 0.55); gg.lineWidth = p.sz * 1.4; gg.beginPath(); gg.moveTo(x + 0.04, y - 0.16); gg.lineTo(x, y); gg.stroke();
        gg.strokeStyle = C(W.light, 0.95); gg.lineWidth = p.sz * 0.7; gg.stroke(); gg.restore();
        drop(gg, x, y, p.sz * 1.3, a, 1.1);
      });
      // 발밑에 떨어진 자리 (작은 물결 · 물보라)
      particles(g, t, 6, 16, (r, i) => ({ t0: 0.1 + (i / 16) * 0.55 + 0.21, life: 0.18, x: (r() - 0.5) * 0.85 - 0.12 }), (gg, p, age) => {
        ripple(gg, p.x, by, 0.06 + 0.12 * age, (1 - age) * fade * 0.9, 0.025);
        for (const d of [-1, 1]) speck(gg, p.x + d * 0.05 * age * 2, by - 0.08 * Math.sin(Math.PI * age), 0.012, W.light, (1 - age) * fade);
      });
      // 구름 (그늘 · 몸 · 하이라이트 세 겹 덩이, 아래는 평평하게)
      if (pop > 0) {
        g.save(); g.translate(drift, cy); g.scale(0.5 * pop, 0.5 * pop);
        const puffs = [[-0.62, 0.12, 0.38], [-0.25, -0.12, 0.5], [0.22, -0.2, 0.55], [0.62, 0.05, 0.42], [0, 0.12, 0.45]];
        const body = h => { h.beginPath(); for (const [x, y, r] of puffs) { h.moveTo(x + r, y); h.arc(x, y, r, 0, TAU); } h.rect(-0.95, 0.05, 1.9, 0.38); };
        glow(g, 0, 0.1, 1.3, '#8fb4d8', 0.35 * fade);
        g.globalAlpha = fade;
        // 그림자 아래 (진한 회청) → 몸 (연한 하늘 회색) → 하이라이트 (흰 덩이)
        body(g); g.lineWidth = 0.12; g.strokeStyle = '#22324a'; g.stroke(); g.fillStyle = '#7d98b8'; g.fill();
        g.save(); g.translate(-0.04, -0.07); g.scale(0.94, 0.9); body(g); const gb = g.createLinearGradient(0, -0.7, 0, 0.45); gb.addColorStop(0, '#f4f9ff'); gb.addColorStop(0.6, '#c6d8ec'); gb.addColorStop(1, '#9fb8d4'); g.fillStyle = gb; g.fill(); g.restore();
        for (const [x, y, r] of puffs.slice(0, 4)) { g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.42, 0, TAU); g.fillStyle = C('#ffffff', 0.85); g.fill(); }
        // 구름 속 물빛 (토템의 영혼)
        glow(g, 0.05, 0.15, 0.55, W.glow, 0.35);
        g.restore();
      }
    },
  },
  /** 영혼 잇기 (붙은 칸마다): 칸을 가로지르는 남빛 영혼 끈 두 줄이 엇갈려 출렁이고 가운데에 마름모 매듭이 빛남 */
  'shaman-link': {
    frames: 22, logical: 84, scope: 'area',
    draw(g, { t }) {
      const run = E.out3(seg(t, 0, 0.35)), fade = 1 - E.in2(seg(t, 0.6, 1)), amp = 0.22 * (1 - 0.5 * seg(t, 0.4, 1));
      glow(g, 0, 0, 0.8, SPIRIT.glow, 0.45 * fade);
      for (const [ph, body] of [[0, SPIRIT.body], [Math.PI, SPIRIT.light]]) {
        const P = s => ({ x: lerp(-1.25, 1.25, s), y: Math.sin(ph + s * TAU * 1.0 + t * 7) * amp * Math.sin(Math.PI * s) + 0.05 });
        lightStroke(g, P, 0.5 - run / 2, 0.5 + run / 2, u => 0.1 * Math.sin(Math.PI * u) ** 0.4, { rim: SPIRIT.rim, body, core: '#ffffff', a: fade, rimW: 0.022, coreW: 0.35, glowCol: SPIRIT.glow, glowA: 0.55 });
      }
      // 마름모 매듭
      const k = E.back(seg(t, 0.1, 0.35), 2);
      g.save(); g.translate(0, 0.05); g.rotate(t * 1.5); g.scale(0.17 * k, 0.24 * k);
      energy(g, gg => path.diamond(gg, 0.7), { rim: SPIRIT.rim, body: SPIRIT.body, core: '#ffffff', rimW: 0.12, glowCol: SPIRIT.glow, glowR: 0.6, a: fade }); g.restore();
      glint(g, 0, 0.05, 0.35 * bell(t, 0.25, 0.35, 0.6), SPIRIT.glow, 1, 0, 0.12);
      particles(g, t, 2, 10, r => ({ t0: 0.2 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 2.0 }), (gg, p, age) => speck(gg, p.x, 0.05 - 0.4 * age, 0.018, SPIRIT.light, (1 - age) * fade));
    },
  },
  /** 샘 토템 (세운 칸, 사람이 없으면 칸에만): 바닥에 납작한 샘이 생기고 가는 물줄기가 솟아 위에서 물방울이 양옆으로 포물선을 그리며 흩뿌려짐 */
  'shaman-spring': {
    frames: 24, logical: 92, scope: 'target',
    draw(g, { t }) {
      const by = 0.62, pool = E.out3(seg(t, 0, 0.25)), fade = 1 - E.in2(seg(t, 0.65, 1)), col = Math.sin(Math.PI * seg(t, 0.05, 0.75)), H = 1.25 * E.out2(Math.min(1, col * 1.4));
      glowOval(g, 0, by, 0.95, 0.35, W.glow, 0.7 * fade);
      // 바닥 샘 (위에서 본 납작한 물웅덩이 + 물결)
      g.save(); g.translate(0, by); g.scale(0.62 * pool, 0.17 * pool); g.globalAlpha = fade;
      g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = C(W.deep, 0.85); g.fill(); g.lineWidth = 0.16; g.strokeStyle = C(W.rim, 0.9); g.stroke();
      g.beginPath(); g.arc(0, -0.1, 0.7, 0, TAU); g.fillStyle = C(W.body, 0.9); g.fill();
      g.beginPath(); g.ellipse(-0.3, -0.35, 0.3, 0.18, 0, 0, TAU); g.fillStyle = C(W.foam, 0.8); g.fill(); g.restore();
      ripple(g, 0, by, lerp(0.3, 0.9, (t * 2.5) % 1), fade * 0.7, 0.05);
      // 가는 물줄기 (솟았다 가라앉음)
      if (H > 0.02) lightStroke(g, s2 => ({ x: Math.sin(s2 * 6 + t * 10) * 0.02, y: lerp(by, by - H, s2) }), 0, 1, u => 0.13 * (1 - 0.5 * u), { rim: W.rim, body: W.body, core: W.foam, a: fade, rimW: 0.022, coreW: 0.4, glowCol: W.glow, glowA: 0.5 });
      if (H > 0.1) { glow(g, 0, by - H, 0.25, W.light, 0.8 * fade); drop(g, 0, by - H - 0.04, 0.08, fade); }
      // 양옆으로 포물선을 그리는 물방울
      particles(g, t, 9, 14, (r, i) => ({ t0: 0.12 + (i / 14) * 0.45, life: 0.42, dir: i % 2 ? 1 : -1, vx: 0.5 + r() * 0.5, vy: 1.0 + r() * 0.4, sz: 0.04 + r() * 0.03 }), (gg, p, age) => {
        const x = p.dir * p.vx * age, y = by - 1.2 - p.vy * age * 0.6 + 2.3 * age * age;
        drop(gg, x, Math.min(y, by), p.sz * (1 - 0.3 * age), (1 - E.in2(age)) * fade);
      });
    },
  },
};
