// 주술사: 깊은 물빛 (청록 · 파랑 + 흰 물거품) · 흙빛 돌 · 영혼 남빛. 사제 정화의 하늘빛보다 진하고 물결 · 물줄기 · 돌처럼 무게 있는 모양
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, seg, solid, speck, TAU } from './lib.mjs';

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

export default {
  /** 잔물결: 발밑에 물방울이 톡 떨어진 자리에서 위에서 본 납작한 물결 두 겹이 차례로 퍼지고 작은 물방울이 튐 */
  'shaman-ripple': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const by = 0.6, fade = 1 - E.in2(seg(t, 0.55, 1));
      glowOval(g, 0, by, 1.0, 0.35, W.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.6))));
      glowOval(g, 0, by, 0.4, 0.4, '#ffffff', 0.8 * (1 - E.out3(seg(t, 0, 0.25))));
      ripple(g, 0, by, lerp(0.15, 1.0, E.out3(seg(t, 0, 0.7))), fade * (1 - seg(t, 0.4, 0.9)), 0.08);
      ripple(g, 0, by, lerp(0.05, 0.65, E.out3(seg(t, 0.15, 0.85))), fade * bell(t, 0.12, 0.25, 1), 0.06);
      // 가운데 물기둥 (톡 튀었다 가라앉음)
      const col = Math.sin(Math.PI * seg(t, 0, 0.45)) * 0.38;
      if (col > 0.01) lightStroke(g, s => ({ x: 0, y: lerp(by, by - col, s) }), 0, 1, u => 0.11 * (1 - u * 0.6), { rim: W.rim, body: W.body, core: W.foam, a: fade, rimW: 0.022 });
      if (col > 0.05) drop(g, 0, by - col - 0.08, 0.08, fade);
      spray(g, t, 3, 9, 0, by, { up: 0.9, spread: 1.2, size: 0.04 });
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
      glow(g, 0, yHit + 0.05, 0.4, '#ffffff', 1 - E.out3(seg(u, 0, 0.35)));
      // 왕관처럼 튀는 짧은 물줄기 + 옅게 퍼지는 물막 (점점 몸에 스며 옅어짐)
      const sq = E.out3(seg(u, 0, 0.3));
      g.save(); g.translate(0, yHit + 0.12); g.scale(lerp(0.2, 0.5, sq), lerp(0.08, 0.11, sq)); g.globalAlpha = fade * (1 - seg(u, 0.25, 0.8));
      g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = C(W.body, 0.75); g.fill(); g.lineWidth = 0.2; g.strokeStyle = C(W.rim, 0.8); g.stroke(); g.restore();
      for (let i = 0; i < 6; i++) {
        const a = rad(-90 + (i - 2.5) * 30), L = 0.42 * E.out3(seg(u, 0, 0.35)) * (i % 2 ? 0.75 : 1);
        lightStroke(g, s2 => ({ x: Math.cos(a) * lerp(0.08, L, s2) * 1.1, y: yHit + 0.12 + Math.sin(a) * lerp(0.05, L, s2) + 0.25 * u * u * s2 }), 0, 1, uu => 0.07 * (1 - uu * 0.6) * (1 - u), { rim: W.rim, body: W.light, core: W.foam, a: fade, rimW: 0.018 });
      }
      spray(g, u, 7, 12, 0, yHit + 0.05, { up: 1.2, spread: 1.6, size: 0.06, a: fade });
      // 몸으로 스며드는 반짝이
      particles(g, u, 9, 10, r => ({ t0: 0.15 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 0.9, y: yHit + 0.1 + r() * 0.1 }), (gg, p, age) => speck(gg, p.x * (1 - age * 0.5), p.y + 0.55 * age, 0.02, W.light, (1 - age) * fade));
    },
  },

  /** 씻김 (해제): 발밑 양옆에서 굵은 물줄기와 가는 물줄기가 몸을 감싸며 휘어 올라 머리 위에서 만나 물보라로 흩어지고, 어두운 얼룩이 씻겨 나감 */
  'shaman-washing': {
    frames: 20, logical: 92, scope: 'target',
    draw(g, { t }) {
      const run = E.out2(seg(t, 0, 0.5)), fade = 1 - E.in2(seg(t, 0.55, 1)), by = 0.7, top = -1.0;
      glowOval(g, 0, by, 0.85, 0.35, W.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.5))));
      for (const [sgn, w, body] of [[-1, 0.17, W.body], [1, 0.13, W.light]]) {
        // 양옆 아래에서 몸을 감싸듯 휘어 올라 머리 위에서 만남 (엇갈리는 나선 아님)
        const P = bez([sgn * 0.25, by], [sgn * 1.0, by - 0.4], [sgn * 0.85, top + 0.35], [-sgn * 0.05, top]);
        const tail = Math.max(0, run - 0.7 - 0.3 * seg(t, 0.5, 1));
        lightStroke(g, P, tail, Math.max(tail + 0.01, run), u => w * (0.55 + 0.45 * Math.sin(Math.PI * u)) * (1 - 0.5 * seg(t, 0.55, 1)), { rim: W.rim, body, core: W.foam, a: fade, rimW: 0.025, coreW: 0.4, glowCol: W.glow, glowA: 0.45 });
        // 물줄기 바깥으로 튀는 작은 물결 무늬
        for (let k = 1; k < 4; k++) { const q = P(Math.max(0, run - k * 0.18)); if (run - k * 0.18 > tail) speck(g, q.x + sgn * 0.12, q.y, 0.025, W.foam, fade * 0.8); }
        const p = P(run); if (run < 0.98) drop(g, p.x, p.y - 0.04, 0.08, fade);
      }
      const b = bell(t, 0.45, 0.52, 0.9);
      glow(g, 0, top + 0.05, 0.55, W.glow, 0.7 * b);
      spray(g, seg(t, 0.47, 1), 5, 12, 0, top + 0.1, { up: 0.6, spread: 1.6, size: 0.04, a: fade });
      // 씻겨 나가는 얼룩
      particles(g, t, 12, 4, (r, i) => ({ t0: 0.1 + i * 0.07, life: 0.55, a: rad(200 + i * 45 + r() * 20), sz: 0.08 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.3 + 0.8 * E.out2(age), x = Math.cos(p.a) * d, y = Math.sin(p.a) * d * 0.7 + 0.2 + 0.3 * age, k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.3, 0, TAU); }, '#7a3ca8', 0.3 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#a46ad0', lo: '#3d1b5a', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
      });
    },
  },

  /** 연쇄 치유 (튄 칸마다): 칸 왼쪽 위에서 굵은 물줄기가 휘어 들어와 가운데에 닿으며 물보라가 터지고, 오른쪽으로 다음 사람에게 튀어 나감 */
  'shaman-chain': {
    frames: 16, logical: 96, scope: 'target',
    draw(g, { t }) {
      const hit = 0.28, fade = 1 - E.in2(seg(t, 0.45, 1));
      const P = bez([-1.35, -0.95], [-0.9, -1.2], [-0.35, -0.55], [0, 0.05]), Q = bez([0, 0.05], [0.35, -0.45], [0.8, -0.75], [1.4, -0.6]);
      const s = lerp(0.35, 1, E.in2(seg(t, 0, hit)));
      if (t < hit + 0.1) lightStroke(g, P, Math.max(0, s - 0.7), Math.max(0.02, s), u => 0.34 * u ** 0.6, { rim: W.rim, body: W.body, core: W.foam, a: 1 - seg(t, hit, hit + 0.1), rimW: 0.025, glowCol: W.glow, glowA: 0.6 });
      const b = bell(t, hit - 0.04, hit + 0.02, hit + 0.4);
      glow(g, 0, 0.05, 1.05, W.glow, 0.95 * b);
      glow(g, 0, 0.05, 0.5, '#ffffff', b);
      ripple(g, 0, 0.1, lerp(0.2, 0.8, E.out3(seg(t, hit, hit + 0.5))), b, 0.07);
      if (t >= hit) {
        const u = seg(t, hit, 1);
        // 물보라 (꽃잎처럼 사방으로 짧은 물줄기)
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + 0.3, L = (0.5 + 0.2 * (i % 2)) * E.out3(seg(u, 0, 0.4));
          lightStroke(g, s2 => ({ x: Math.cos(a) * lerp(0.1, L, s2), y: 0.05 + Math.sin(a) * lerp(0.1, L, s2) * 0.8 }), 0, 1, uu => 0.11 * (1 - uu) * (1 - u), { rim: W.rim, body: W.light, core: W.foam, a: fade, rimW: 0.02 });
        }
        // 다음 사람에게 튀어 나가는 물줄기
        const q = E.out2(seg(u, 0.05, 0.7));
        lightStroke(g, Q, Math.max(0, q - 0.55), Math.max(0.02, q), uu => 0.22 * uu ** 0.6 * (1 - 0.5 * u), { rim: W.rim, body: W.body, core: W.foam, a: fade, rimW: 0.022, glowCol: W.glow, glowA: 0.5 });
        spray(g, u, 2, 8, 0, 0.05, { up: 0.8, spread: 1.5, size: 0.035, a: fade });
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

  /** 비구름 토템 (파티 전원 · 2초마다): 머리 위에 작은 비구름이 몽실 생겨 가는 비를 뿌리다 옅어짐 */
  'shaman-rain': {
    frames: 20, logical: 72, scope: 'party',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.6), fade = 1 - E.in2(seg(t, 0.6, 1)), cy = -0.72;
      // 가는 비
      particles(g, t, 6, 16, r => ({ t0: 0.08 + r() * 0.55, life: 0.22, x: (r() - 0.5) * 0.75 }), (gg, p, age) => {
        const y = lerp(cy + 0.1, 0.55, age);
        gg.save(); gg.globalAlpha = (1 - age * 0.5) * fade; gg.lineCap = 'round';
        gg.strokeStyle = C(W.rim, 0.7); gg.lineWidth = 0.045; gg.beginPath(); gg.moveTo(p.x + 0.03, y - 0.16); gg.lineTo(p.x, y); gg.stroke();
        gg.strokeStyle = W.light; gg.lineWidth = 0.022; gg.stroke(); gg.restore();
      });
      // 구름 (동그라미 넷)
      g.save(); g.translate(0, cy); g.scale(pop * 0.42, pop * 0.42);
      const cloud = gg => { gg.beginPath(); gg.arc(-0.55, 0.1, 0.42, 0, TAU); gg.arc(0, -0.15, 0.58, 0, TAU); gg.arc(0.55, 0.08, 0.45, 0, TAU); gg.rect(-0.75, 0.05, 1.5, 0.45); };
      solid(g, gg => { cloud(gg); }, { hi: '#ffffff', lo: '#8fa8c0', rim: '#1a2638', rimW: 0.07, a: fade, shine: 0.5, y0: -0.7, y1: 0.5 });
      g.restore();
      glowOval(g, 0, cy + 0.15, 0.55, 0.4, W.glow, 0.35 * fade);
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
};
