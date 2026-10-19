// 사제: 흰빛 · 크림 · 연금색 + 하늘빛 강조 (치유 · 소생만 초록, 치유는 Lim이 만든 「초록 반짝이 가루 구름」을 그대로 다시 그림)
import { asset, bell, bez, bloom, C, comet, E, energy, frac, glint, glow, glowOval, lerp, lightStroke, loopGlints, loopRise, particles, path, rad, ribbonPath, ringGlow, seg, solid, speck, talentFx, taper, TAU, wave } from './lib.mjs';

const GOLD = { rim: '#5a3c0c', body: '#ffd56b', core: '#fffbe8', glow: '#ffcf6a' };
const SKY = '#8fd6ff', SKY_DEEP = '#2e6fb8', NAVY = '#1d2a4a';
const YEL = { glow: '#ffd23f', amber: '#ffb020' };
const GREEN = { rim: '#0f3b2e', deep: '#1f8f63', mid: '#4fd39a', pale: '#b8f5d8', white: '#f4fff8' };

/** 음표 (8분 음표: 기운 둥근 머리 + 기둥 + 깃발). 머리 가운데 (0,0), 크기 1 = 머리 폭 */
function notePath(g) {
  g.beginPath();
  g.ellipse(0, 0, 0.55, 0.38, rad(-25), 0, TAU);
  g.moveTo(0.46, -0.12); g.lineTo(0.46, -1.7); g.lineTo(0.62, -1.7);
  g.bezierCurveTo(0.7, -1.3, 1.25, -1.15, 1.05, -0.55); g.bezierCurveTo(1.0, -0.95, 0.75, -1.1, 0.62, -1.05);
  g.lineTo(0.62, -0.12); g.closePath();
}
/** 깃털 하나 (밑동 (0,0) → 끝 (0,−1)), 끝이 둥글고 한쪽이 넓음 */
function featherPath(g, w = 0.2) {
  g.beginPath(); g.moveTo(0, 0.04);
  g.bezierCurveTo(w * 1.3, -0.15, w * 1.2, -0.8, 0.02, -1);
  g.bezierCurveTo(-w * 0.6, -0.85, -w * 0.8, -0.2, 0, 0.04); g.closePath();
}
/** 날개 한 장: 어깨 (sx, sy)에서 큰 깃 7 + 작은 깃 5를 부채로. open 1 = 활짝 · 0 = 몸을 감쌈. side = −1 왼쪽 · 1 오른쪽 */
function wing(g, sx, sy, side, open, a, len = 1) {
  const row = (n, from, to, Lmax, Lmin, w, hi, lo) => {
    for (let j = n - 1; j >= 0; j--) {
      const u = j / (n - 1), ang = side * lerp(lerp(from[0], from[1], open), lerp(to[0], to[1], open), u), L = len * lerp(Lmax, Lmin, u) * lerp(0.82, 1, open);
      g.save(); g.translate(sx, sy); g.rotate(rad(ang)); g.scale(L * (side < 0 ? -1 : 1), L);
      solid(g, gg => featherPath(gg, w), { hi, lo, rim: '#4a300a', rimW: 0.03 / L, a, shine: 0.55, y0: -1, y1: 0 });
      g.restore();
    }
  };
  row(7, [20, 55], [70, 140], 1.0, 0.55, 0.2, '#fffdf4', '#f2b445');
  row(5, [30, 65], [70, 125], 0.55, 0.36, 0.28, '#ffffff', '#ffd77a');
}

export default {
  /** 치유: 초록 반짝이 가루 구름 (Lim의 heal-dust를 다시 그림). 발밑에서 피어나 소용돌이치며 떠오르는 초록 빛가루 */
  'priest-heal': {
    frames: 22, logical: 80, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.55, 1));
      glow(g, 0, 0.3, 1.0, GREEN.mid, 0.6 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, 0.35, 0.55, GREEN.white, 0.7 * (1 - E.out3(seg(t, 0, 0.3))));
      // 가루 구름 (흐린 덩어리 넷이 돌며 떠오름)
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + t * 3, rr = 0.25 + 0.35 * E.out2(t), y = lerp(0.45, -0.35, E.out2(t)) + Math.sin(a) * 0.12;
        bloom(g, gg => { gg.beginPath(); gg.arc(Math.cos(a) * rr, y, 0.3 + 0.1 * Math.sin(i + t * 4), 0, TAU); }, i % 2 ? GREEN.mid : GREEN.deep, 0.42 * fade, 7);
      }
      // 반짝이 가루 (소용돌이)
      particles(g, t, 11, 46, r => ({ t0: r() * 0.35, life: 0.5 + r() * 0.35, a0: r() * TAU, rr: 0.2 + r() * 0.7, y0: 0.6 + r() * 0.3, rise: 0.9 + r() * 0.7, sz: 0.012 + r() * 0.022, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9 }), (gg, p, age) => {
        const ang = p.a0 + p.spin * age * 2.4, rr = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rr, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rr * 0.22;
        speck(gg, x, y, p.sz, Math.sin(ang) > 0 ? GREEN.pale : GREEN.mid, bell(age, 0, 0.12, 1), 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      // 큰 반짝임 (차례로 톡톡)
      particles(g, t, 5, 7, (r, i) => ({ t0: 0.04 + i * 0.08 + r() * 0.04, life: 0.3, x: (r() - 0.5) * 1.3, y: 0.4 - r() * 0.9, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.15, 0.2 * Math.sin(Math.PI * age), GREEN.mid, 1, p.rot, 0.13, GREEN.white));
    },
  },

  /** 순간 치유 (Lim 2026-10-17 「순간 힐도 디테일을 올려줘」): Codex로 그린 섬광 그림 (scripts/vfx/assets/priest-flash: 흰 금빛 가로 빛줄기 + 하늘빛 겹줄 +
   *  가운데 네 갈래 별 · 마름모 반짝이)이 가운데에서 좌우로 번쩍 펼쳐지고, 위아래로 얇아지며 바깥 끝부터 사라짐. 이름 글자 위 (아이콘과 이름 사이)를 지나 이름에 줄을 긋지 않음 */
  'priest-flash': {
    frames: 14, logical: 92, scope: 'target',
    draw(g, { t }) {
      const cy = -0.25, grow = E.out4(seg(t, 0, 0.26)), fade = 1 - E.in2(seg(t, 0.32, 1)), thin = lerp(1, 0.35, E.in2(seg(t, 0.2, 1)));
      glowOval(g, 0, cy, 1.4 * grow + 0.3, 0.28, GOLD.glow, 0.75 * fade);
      glowOval(g, 0, cy, 0.6, 1, '#ffffff', 0.9 * (1 - E.out3(seg(t, 0, 0.32))));
      glowOval(g, 0, cy, 0.75, 1.5, SKY, 0.35 * (1 - E.out2(seg(t, 0, 0.4))), true, 0);
      const img = asset('priest-flash');
      if (img) {
        // 그림 = 프레임 너비만큼 (가운데가 칸 가운데), 가로로 펼쳐지고 세로로 얇아짐. 끝에는 바깥 끝부터 지워지게 가로로 조금 줄며 옅어짐
        const W = 2.85, sx = lerp(0.12, 1, grow) * lerp(1, 0.86, seg(t, 0.5, 1)), sy = thin;
        g.save(); g.translate(0, cy); g.scale(sx, sy); g.globalAlpha = fade;
        g.drawImage(img, -W / 2, -W / 2, W, W);
        // 처음 두세 장은 더 밝게 (흰빛을 한 번 더 더함)
        const flash = 1 - E.out2(seg(t, 0, 0.3));
        if (flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = fade * 0.7 * flash; g.drawImage(img, -W / 2, -W / 2, W, W); }
        g.restore();
      }
      // 옆으로 튀는 빛 조각 (그림의 반짝이와 함께)
      particles(g, t, 3, 14, r => ({ t0: r() * 0.18, life: 0.4 + r() * 0.35, y: (r() - 0.5) * 0.4, dir: r() < 0.5 ? -1 : 1, sp: 0.9 + r() * 0.7, sz: 0.02 + r() * 0.018 }), (gg, p, age) => {
        const x = p.dir * (0.25 + p.sp * E.out2(age)), y = cy + p.y * (1 + age) - 0.12 * age, a = (1 - age) * fade;
        gg.save(); gg.globalCompositeOperation = 'lighter'; gg.strokeStyle = C(age < 0.4 ? '#ffffff' : SKY, a); gg.lineWidth = p.sz;
        gg.beginPath(); gg.moveTo(x - p.dir * 0.2 * (1 - age), y + 0.02); gg.lineTo(x, y); gg.stroke(); gg.restore();
        speck(gg, x, y, p.sz * 0.6, SKY, a);
      });
    },
  },
  /** 소생 (초록): 감아 오르는 이중 나선. 에메랄드 · 민트 빛 꼬리 두 줄이 엇갈리며 칸 아래에서 위로, 꼭대기에서 반짝이며 흩어짐 */
  'priest-renew': {
    frames: 24, logical: 84, scope: 'target',
    draw(g, { t }) {
      const run = lerp(0.2, 1, E.inOut(seg(t, 0, 0.72))), fade = 1 - E.in2(seg(t, 0.62, 1));
      glowOval(g, 0, 0.75, 0.95, 0.4, GREEN.mid, 0.85 * (1 - E.out2(seg(t, 0, 0.5))));
      glowOval(g, 0, 0.75, 0.45, 0.5, GREEN.white, 0.8 * (1 - E.out3(seg(t, 0, 0.3))));
      for (let i = 0; i < 4; i++) { const a = rad(-160 + i * 47), d = 0.3 + 0.35 * E.out2(seg(t, 0, 0.35)), b = 1 - seg(t, 0, 0.35); glint(g, Math.cos(a) * d, 0.75 + Math.sin(a) * d * 0.5, 0.18 * b, GREEN.mid, b, a, 0.14, GREEN.white); }
      const helix = ph => s => { const y = lerp(0.95, -1.05, s), a = ph + s * 9.5; return { x: Math.cos(a) * 0.62 * (1 - 0.25 * s), y: y + Math.sin(a) * 0.08, z: Math.sin(a) }; };
      // 뒤를 먼저 (z<0이면 옅게)
      for (const side of [0, 1]) {
        const P = helix(side * Math.PI), s1 = run, s0 = Math.max(0, run - 0.45);
        comet(g, P, s0, s1, { w: 0.13, rim: GREEN.rim, body: side ? GREEN.mid : GREEN.pale, core: GREEN.white, glowCol: GREEN.mid, a: fade, head: 1.1 * (1 - seg(t, 0.72, 0.85)) });
      }
      // 꼬리에서 떨어지는 반짝이
      particles(g, t, 8, 24, r => ({ t0: r() * 0.7, life: 0.3 + r() * 0.2, side: r() < 0.5 ? 0 : Math.PI, dx: (r() - 0.5) * 0.3 }), (gg, p, age) => {
        const s = Math.max(0, E.inOut(seg(p.t0, 0, 0.72)) - 0.05), q = helix(p.side)(s);
        speck(gg, q.x + p.dx * age, q.y + 0.25 * age, 0.02, GREEN.pale, (1 - age) * fade);
      });
      // 꼭대기에서 터지는 반짝임
      const b = bell(t, 0.68, 0.76, 1);
      glow(g, 0, -0.95, 0.55, GREEN.mid, 0.7 * b);
      for (let i = 0; i < 5; i++) { const a = rad(-90 + (i - 2) * 38), d = 0.15 + 0.4 * E.out2(seg(t, 0.7, 1)); glint(g, Math.cos(a) * d, -0.95 + Math.sin(a) * d * 0.7, 0.2 * b * (i % 2 ? 0.7 : 1), GREEN.mid, b, a, 0.14, GREEN.white); }
    },
  },

  /** 치유의 기원 (범위 칸마다): 퍼지는 금빛 고리 (스킬 중 고리는 이것만) + 고리 안에서 솟는 연두 · 금빛 반짝임 */
  'priest-poh': {
    frames: 20, logical: 74, scope: 'area',
    draw(g, { t }) {
      const R = lerp(0.2, 1.0, E.out3(seg(t, 0, 0.5))), fade = 1 - E.in2(seg(t, 0.3, 0.95)), sy = 0.58, cy = 0.22;
      glow(g, 0, cy, 0.9, GOLD.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.45))));
      glow(g, 0, cy, 0.4, '#ffffff', 0.9 * (1 - E.out3(seg(t, 0, 0.25))));
      // 고리 안쪽 옅은 빛 바닥
      g.save(); g.translate(0, cy); g.scale(1, sy); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, C(GOLD.glow, 0)); gr.addColorStop(0.75, C(GOLD.glow, 0.18 * fade)); gr.addColorStop(1, C('#ffffff', 0.45 * fade));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.restore();
      ringGlow(g, 0, cy, R, 0.2, GOLD.glow, 0.8 * fade, sy);
      g.save(); g.translate(0, cy); g.scale(1, sy); g.globalAlpha = fade;
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.lineWidth = 0.13; g.strokeStyle = C(GOLD.rim, 0.9); g.stroke();
      g.lineWidth = 0.085; g.strokeStyle = GOLD.body; g.stroke(); g.lineWidth = 0.03; g.strokeStyle = '#ffffff'; g.stroke();
      // 두 번째 가는 고리 (뒤따름)
      const R2 = lerp(0.05, 0.72, E.out3(seg(t, 0.12, 0.65))), f2 = bell(t, 0.12, 0.3, 0.85);
      g.globalAlpha = f2; g.beginPath(); g.arc(0, 0, R2, 0, TAU); g.lineWidth = 0.07; g.strokeStyle = C(GOLD.rim, 0.7); g.stroke(); g.lineWidth = 0.035; g.strokeStyle = '#fff3c0'; g.stroke();
      g.restore();
      particles(g, t, 7, 16, r => ({ t0: 0.05 + r() * 0.4, life: 0.4 + r() * 0.2, a: r() * TAU, d: r() * 0.8, sz: 0.018 + r() * 0.016, c: r() < 0.5 }), (gg, p, age) => {
        const x = Math.cos(p.a) * p.d, y = cy + Math.sin(p.a) * p.d * sy - 0.85 * E.out2(age);
        speck(gg, x, y, p.sz, p.c ? '#c8ff7a' : GOLD.glow, 1 - age);
        if (p.c) glint(gg, x, y, 0.1 * (1 - age), p.c ? '#c8ff7a' : GOLD.glow, 1 - age, 0, 0.18);
      });
    },
  },

  /** 정화: 떨어진 물방울의 왕관 물보라. 하늘빛 정화 물방울이 떨어져 튀고, 보라 얼룩 조각이 밀려 날아가 흩어짐 */
  'priest-purify': {
    frames: 18, logical: 86, scope: 'target',
    draw(g, { t }) {
      const hit = 0.16, yHit = 0.25;
      if (t < hit) {
        const u = E.in2(t / hit), y = lerp(-1.1, yHit - 0.1, u), P = s => ({ x: 0, y: lerp(y - 0.6, y, s) });
        comet(g, P, 0, 1, { w: 0.1, rim: SKY_DEEP, body: SKY, core: '#ffffff', glowCol: SKY, head: 0 });
        g.save(); g.translate(0, y); g.scale(0.2, 0.3);
        energy(g, path.drop, { rim: SKY_DEEP, body: SKY, core: '#ffffff', rimW: 0.1, glowCol: SKY, glowR: 0.5 }); g.restore();
      }
      const s = seg(t, hit, 1), sp = E.out3(s), fade = 1 - E.in2(seg(t, hit + 0.25, 1));
      if (t < hit) return;
      glowOval(g, 0, yHit, 0.95, 0.5, SKY, 0.8 * (1 - E.out2(seg(t, hit, 0.65))));
      glow(g, 0, yHit, 0.45, '#ffffff', 1 - E.out3(seg(t, hit, hit + 0.3)));
      // 납작한 물 바닥
      g.save(); g.translate(0, yHit + 0.05); g.scale(lerp(0.3, 0.68, sp), lerp(0.09, 0.14, sp)); g.globalAlpha = fade * 0.95;
      g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = C(SKY, 0.85); g.fill(); g.lineWidth = 0.22; g.strokeStyle = C(SKY_DEEP, 0.9); g.stroke();
      g.beginPath(); g.arc(-0.2, -0.25, 0.45, 0, TAU); g.fillStyle = C('#ffffff', 0.6); g.fill(); g.restore();
      // 왕관 물줄기 7개
      for (let i = 0; i < 7; i++) {
        const k = i - 3, a = rad(-90 + k * 22), len = (0.62 + 0.18 * Math.cos(i * 1.9)) * sp, bx = k * 0.1;
        const P = bez([bx, yHit], [bx + Math.cos(a) * len * 0.3, yHit + Math.sin(a) * len * 0.5], [bx + Math.cos(a) * len * 0.8, yHit + Math.sin(a) * len * 0.95], [bx + Math.cos(a) * len * 1.05, yHit + Math.sin(a) * len * 0.9 + 0.3 * s * s]);
        lightStroke(g, P, 0, 1, u => 0.11 * (1 - u * 0.7) * (1 - s * 0.45), { rim: SKY_DEEP, body: SKY, core: '#ffffff', a: fade, rimW: 0.022, glowCol: SKY, glowA: 0.4 });
        const tip = P(1);
        g.save(); g.translate(tip.x, tip.y - 0.05 + 0.5 * s * s); g.scale(0.06 * fade, 0.08 * fade); energy(g, path.drop, { rim: SKY_DEEP, body: '#dff4ff', core: '#ffffff', rimW: 0.2, a: fade }); g.restore();
      }
      // 보라 얼룩이 밀려 날아가 보라 가루로 흩어짐
      particles(g, s, 9, 5, (r, i) => ({ t0: 0, life: 0.8 + r() * 0.15, a: rad(-170 + i * 40 + r() * 15), d: 0.8 + r() * 0.3, sz: 0.09 + r() * 0.04, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.25 + p.d * E.out2(age), x = Math.cos(p.a) * d, y = yHit + Math.sin(p.a) * d * 0.75 + 0.25 * age * age, k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.4, 0, TAU); }, '#7a3ca8', 0.35 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 3); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#a46ad0', lo: '#3d1b5a', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
        for (let j = 0; j < 3; j++) speck(gg, x - Math.cos(p.a) * 0.12 * (j + 1) * age, y - Math.sin(p.a) * 0.1 * (j + 1) * age, 0.014, '#c08af0', k * 0.8);
      });
    },
  },

  /** 수호 영혼 (Lim 2026-10-17 「수호 이펙트 날개 디테일을 올려줘」): Codex로 그린 깃털 날개 그림 (scripts/vfx/assets/guardian-wing, 깃털 세 겹 · 깃대 · 금빛 테)을
   *  양 어깨에 붙여, 크게 펼쳐졌다가 몸을 감싸듯 접혀 들어오고, 빛이 깃털을 한 번 훑은 뒤 머리 위 후광과 함께 위로 걷히며 빛 깃털로 흩어짐 */
  'priest-guardian': {
    frames: 24, logical: 98, scope: 'target',
    draw(g, { t }) {
      const open = 1 - E.inOut(seg(t, 0.02, 0.4)), a = 1 - E.in2(seg(t, 0.64, 0.96)), lift = -0.14 * E.inOut(seg(t, 0.5, 1));
      glow(g, 0, -0.05, 1.35, GOLD.glow, 0.6 * (1 - E.in2(seg(t, 0, 0.92))));
      glow(g, 0, 0, 0.6, '#ffffff', 0.85 * (1 - E.out3(seg(t, 0, 0.3))));
      const img = asset('guardian-wing');
      g.save(); g.translate(0, lift);
      for (const side of [-1, 1]) {
        if (img) {
          // 그림의 날개 뿌리 (왼쪽 아래 0.06, 0.86)를 어깨에: 펼침 = 위 바깥으로 솟음, 접힘 = 몸 앞쪽으로 감쌈
          // 펼침: 뿌리는 몸 뒤 가운데, 끝은 양옆 위로 (39°) / 접힘: 뿌리가 칸 양옆으로 가 날개가 거의 곧게 서서 칸을 감쌈 (가운데 이름 · 체력은 비움)
          const L = lerp(1.18, 1.0, 1 - open), rot = rad(lerp(32, -6, open)), sx = lerp(0.8, 1, open);
          g.save(); g.translate(side * lerp(0.36, 0.12, open), lerp(-0.02, -0.14, open)); g.scale(side, 1); g.rotate(-rot);
          g.globalAlpha = a; g.scale(sx, 1);
          bloom(g, gg => { gg.beginPath(); gg.ellipse(L * 0.5, -L * 0.45, L * 0.5, L * 0.3, rad(-40), 0, TAU); }, GOLD.glow, 0.4, 9);
          g.drawImage(img, -L * 0.06, -L * 0.86, L, L);
          // 깃털을 한 번 훑는 빛 (날개 그림 위에만)
          const sw = seg(t, 0.32, 0.62);
          if (sw > 0 && sw < 1) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.55 * Math.sin(Math.PI * sw); g.drawImage(img, -L * 0.06, -L * 0.86, L, L); }
          g.restore();
        } else wing(g, side * 0.16, -0.08, side, open, a, 1.08); // 그림이 없으면 예전 도형 깃털
      }
      g.restore();
      // 후광
      const h = bell(t, 0.1, 0.35, 0.95), hy = -0.98 + lift;
      ringGlow(g, 0, hy, 0.32, 0.09, GOLD.glow, h, 0.3);
      g.save(); g.translate(0, hy); g.scale(1, 0.3); g.globalAlpha = h; g.beginPath(); g.arc(0, 0, 0.32, 0, TAU);
      g.lineWidth = 0.15; g.strokeStyle = C(GOLD.rim, 0.85); g.stroke(); g.lineWidth = 0.09; g.strokeStyle = GOLD.body; g.stroke(); g.lineWidth = 0.035; g.strokeStyle = '#fff'; g.stroke(); g.restore();
      // 빛 깃털 · 반짝이로 흩어짐
      particles(g, t, 21, 18, r => ({ t0: 0.5 + r() * 0.2, life: 0.38 + r() * 0.1, x: (r() - 0.5) * 1.9, y: -0.7 + r() * 1.0, rot: r() * 6, big: r() < 0.4 }), (gg, p, age) => {
        const x = p.x * (1 + 0.25 * age), y = p.y - 0.35 * age;
        if (p.big) {
          gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 2); gg.scale(0.13 * (1 - 0.4 * age), 0.13 * (1 - 0.4 * age));
          solid(gg, h2 => featherPath(h2, 0.24), { hi: '#fffdf2', lo: '#f0b648', rim: '#4a300a', rimW: 0.2, a: (1 - age) * 0.95, shine: 0.5, y0: -1, y1: 0 }); gg.restore();
        } else speck(gg, x, y, 0.022, GOLD.glow, 1 - age);
      });
    },
  },
  /** 천상의 찬가 (파티 전원 · 1초마다 다시): 좌우로 살랑이며 떠오르는 금빛 음표 셋 + 반짝이 */
  'priest-hymn': {
    frames: 20, logical: 70, scope: 'party',
    draw(g, { t }) {
      glow(g, 0, 0.35, 0.7, GOLD.glow, 0.35 * (1 - E.out2(seg(t, 0, 0.5))));
      const notes = [[-0.45, 0.45, 0, 1], [0.42, 0.55, 0.12, 0.85], [0.0, 0.75, 0.22, 0.75]];
      for (const [x0, y0, d, k] of notes) {
        const u = seg(t, d * 0.5, d * 0.5 + 0.88), a = Math.min(1, u * 8) * (1 - E.in2(seg(u, 0.55, 1)));
        if (a <= 0) continue;
        const x = x0 + Math.sin(u * 5 + x0 * 3) * 0.12, y = y0 - 1.0 * E.out2(u), sc = 0.2 * k * (0.75 + 0.25 * E.back(seg(u, 0, 0.3)));
        // 지나온 자리에 반짝이
        speck(g, x - Math.sin(u * 5 + x0 * 3) * 0.05, y + 0.2, 0.018, GOLD.glow, a * 0.8);
        speck(g, x + 0.04, y + 0.38, 0.012, GOLD.glow, a * 0.5);
        glow(g, x + 0.05, y - 0.12, 0.38 * k, GOLD.glow, 0.55 * a);
        g.save(); g.translate(x, y); g.rotate(Math.sin(u * 6) * 0.2); g.scale(sc, sc);
        solid(g, notePath, { hi: '#fffbe0', lo: '#e6a632', rim: '#3a240a', rimW: 0.16, a, shine: 0.7, y0: -1.7, y1: 0.4 });
        g.restore();
      }
    },
  },

  /** 성언: 평온 (가장 강한 치유, Lim 2026-10-17 「치유처럼 파티클이 많이 들어간 노란색 화려한 치유 강화판」): 치유의 반짝이 가루 구름을 금빛으로 키운 것.
   *  흰 금빛이 펑 터지며 금빛 가루가 사방으로 퍼졌다가 두 갈래 소용돌이로 몸을 감아 솟고, 큰 네 갈래 반짝임이 차례로 톡톡 터지며 위로 빛가루 분수가 흩날림 */
  'priest-serenity': {
    frames: 24, logical: 100, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.58, 1)), burst = 1 - E.out3(seg(t, 0, 0.32));
      // 터지는 금빛 (첫 장부터 크게) · 몸 둘레 따뜻한 빛
      glow(g, 0, 0.05, 1.45, YEL.glow, 0.55 * fade);
      glow(g, 0, 0.05, 0.9, '#ffffff', 0.9 * burst);
      glow(g, 0, 0.3, 0.7, YEL.amber, 0.25 * fade);
      // 가루 구름 (흐린 금빛 덩이 여섯이 돌며 떠오름)
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + t * 3.2, rr = 0.3 + 0.45 * E.out2(t), y = lerp(0.4, -0.45, E.out2(t)) + Math.sin(a) * 0.14;
        bloom(g, gg => { gg.beginPath(); gg.arc(Math.cos(a) * rr, y, 0.32 + 0.1 * Math.sin(i + t * 4), 0, TAU); }, i % 2 ? YEL.glow : YEL.amber, 0.2 * fade, 9);
      }
      // 사방으로 터져 퍼지는 금빛 가루 (처음 한 번)
      particles(g, t, 31, 40, r => ({ t0: r() * 0.06, life: 0.42 + r() * 0.3, a: r() * TAU, sp: 0.7 + r() * 0.8, sz: 0.014 + r() * 0.022, ph: r() * 9 }), (gg, p, age) => {
        const d = 0.1 + p.sp * E.out3(age);
        speck(gg, Math.cos(p.a) * d, 0.05 + Math.sin(p.a) * d * 0.85 - 0.25 * age * age, p.sz, age < 0.4 ? '#fff6c8' : YEL.glow, (1 - age) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
      });
      // 두 갈래 소용돌이 금빛 가루 (몸을 감아 솟음, 치유보다 많고 크게)
      particles(g, t, 11, 76, r => ({ t0: 0.05 + r() * 0.4, life: 0.48 + r() * 0.35, a0: r() * TAU, rr: 0.25 + r() * 0.75, y0: 0.65 + r() * 0.3, rise: 1.0 + r() * 0.8, sz: 0.013 + r() * 0.026, spin: (r() < 0.5 ? -1 : 1) * (1.4 + r()), ph: r() * 9 }), (gg, p, age) => {
        const ang = p.a0 + p.spin * age * 2.6, rr = p.rr * (1 - 0.35 * age), x = Math.cos(ang) * rr, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rr * 0.24;
        speck(gg, x, y, p.sz, Math.sin(ang) > 0 ? '#fff3b0' : YEL.glow, bell(age, 0, 0.12, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      // 위로 흩날리는 빛가루 분수
      particles(g, t, 17, 22, r => ({ t0: 0.15 + r() * 0.45, life: 0.4 + r() * 0.2, x: (r() - 0.5) * 0.5, vx: (r() - 0.5) * 1.1, vy: 1.3 + r() * 0.6, sz: 0.016 + r() * 0.014 }), (gg, p, age) => {
        speck(gg, p.x + p.vx * age, -0.2 - p.vy * age + 1.1 * age * age, p.sz, '#fff8d8', (1 - age) * fade);
      });
      // 큰 네 갈래 반짝임 (차례로 톡톡, 치유보다 크고 많이)
      particles(g, t, 5, 12, (r, i) => ({ t0: 0.02 + i * 0.05 + r() * 0.03, life: 0.3, x: (r() - 0.5) * 1.5, y: 0.45 - r() * 1.15, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.2, 0.3 * Math.sin(Math.PI * age), YEL.glow, fade, p.rot, 0.12, '#ffffff'));
      // 가운데 큰 별 반짝임 (터질 때)
      glint(g, 0, 0.0, 0.95 * burst, YEL.amber, 1, rad(45) * t, 0.1, '#ffffff');
      glint(g, 0, 0.0, 0.6 * burst, YEL.glow, 1, rad(45) + rad(45) * t, 0.13, '#ffffff');
    },
  },
  /** 빛의 전이: 왼쪽 위에서 포물선으로 날아와 칸 아래에서 통 튀는 꼬리 별 (빛 구슬 + 꼬리), 튈 때 반짝임 셋, 두 번 깜빡이다 작아짐 */
  'priest-relay': {
    frames: 20, logical: 92, scope: 'target',
    draw(g, { t }) {
      const land = 0.36, P = bez([-1.1, -0.85], [-0.9, -1.3], [-0.2, -0.95], [0, 0.3]);
      const fade = 1 - E.in2(seg(t, 0.72, 1));
      let x, y;
      if (t <= land) {
        const s = E.in2(seg(t, 0, land) * 0.75 + 0.25); ({ x, y } = P(s));
        comet(g, P, Math.max(0, s - 0.55), s, { w: 0.26, rim: NAVY, body: GOLD.body, core: '#ffffff', glowCol: SKY, head: 0 });
      } else {
        const u = seg(t, land, 1), h = Math.sin(Math.PI * Math.min(1, u * 1.7)) * 0.42;
        x = 0.28 * E.out2(Math.min(1, u * 1.7)); y = 0.3 - h;
        const tail = s => ({ x: lerp(0, x, s), y: 0.3 - Math.sin(Math.PI * Math.min(1, u * 1.7) * s) * 0.42 });
        if (u < 0.6) comet(g, tail, 0, 1, { w: 0.13, rim: NAVY, body: GOLD.body, core: '#ffffff', glowCol: SKY, head: 0, a: 1 - u / 0.6 });
      }
      // 튈 때 바닥 빛 + 반짝임 셋
      const b = bell(t, land - 0.02, land + 0.04, land + 0.45);
      glowOval(g, 0.02, 0.36, 0.7, 0.35, GOLD.glow, 0.85 * b);
      glow(g, 0, 0.3, 0.35, '#ffffff', b);
      for (let i = 0; i < 3; i++) { const a = rad(-150 + i * 60), d = 0.25 + 0.55 * E.out2(seg(t, land, land + 0.4)); glint(g, Math.cos(a) * d, 0.3 + Math.sin(a) * d * 0.9, 0.34 * b, SKY, b, a, 0.15); }
      // 구슬 (별 모양 빛, 두 번 깜빡이다 작아짐)
      const blink = t > 0.55 ? 0.65 + 0.35 * Math.cos((t - 0.55) * 42) : 1, rr = 0.34 * fade * (t > land ? 1 - 0.45 * seg(t, 0.55, 1) : 1);
      glow(g, x, y, rr * 4, SKY, 0.65 * fade * blink);
      glow(g, x, y, rr * 2.2, '#ffffff', 0.7 * fade * blink);
      g.save(); g.translate(x, y); g.scale(rr, rr); energy(g, gg => path.star(gg, 4, 0.45, rad(-90 + t * 220)), { rim: NAVY, body: GOLD.body, core: '#ffffff', a: fade * blink, rimW: 0.12 }); g.restore();
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 사제 쉼터 천막 (board-shelter): 입구 별빛이 숨 쉬듯 빛나고, 천막 바닥에서 금빛 가루가 피어올라 천막 위로 흩어지며 꼭대기 · 기둥 끝이 차례로 반짝임 */
  'priest-shelter-loop': {
    frames: 36, fps: 12, loop: true, logical: 87, size: 256, scope: 'target',
    draw(g, { t }) {
      glowOval(g, 0, 0.12, 0.8, 0.85, GOLD.glow, 0.07 + 0.08 * wave(t, 1));
      glow(g, 0, 0.36, 0.5, YEL.amber, 0.3 + 0.35 * wave(t, 2));
      glow(g, 0, 0.36, 0.16, '#ffffff', 0.2 + 0.35 * wave(t, 2));
      for (const k of [0, 0.5]) { const a = frac(t * 2 + k); ringGlow(g, 0, 0.62, lerp(0.25, 0.8, E.out2(a)), 0.05, GOLD.glow, 0.3 * (1 - a) * seg(a, 0, 0.1), 0.3); }
      loopRise(g, t, 24, { x0: -0.6, x1: 0.6, y0: 0.6, y1: -1.15, per: 1, sz: 0.035, col: '#ffffff', glowCol: YEL.amber, sway: 0.07, seed: 3 });
      loopGlints(g, t, [[0, -0.86], [-0.62, -0.22], [0.62, -0.22], [0, 0.36]], { size: 0.3, col: GOLD.core, glowCol: GOLD.glow });
    },
  },
  /** 특성 버튼 발동 (2026-10-19 Lim 「특성에 달린 버튼들을 눌렀을때 이펙트 … 필요」): lib talentFx 'halo' (코드 빛 띠 · 충격파 · 파티클, 칸 가득) */
  'priest-talent': talentFx({ rim: '#5a3c0c', body: '#ffd56b', light: '#fff1b0', core: '#fffbe8', glow: '#ffcf6a', acc: '#d8f0ff', accGlow: '#9fd4ff' }, 'halo'),
};
