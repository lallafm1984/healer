// 성기사: 따뜻한 금빛 · 흰빛 + 호박 · 주황 강조 (사제의 하늘빛 대신), 희생은 진홍. 원뿔 빛 · 룬 · 문장처럼 굵고 단단한 모양.
// 2026-10-18 Lim 「성기사 스킬 이펙트를 전체 재생성, 퀄리티를 올려주고 힐 계열은 모두 파티클, 이펙트는 전체적으로 파티클 활용을 많이」:
// 모양은 Codex로 그린 그림 (scripts/vfx/assets/paladin-*), 움직임 · 빛 · 금빛 반짝이 가루는 코드. 봉화 대상 칸 둘레는 루프 (paladin-beacon-loop)
import { asset, bell, C, comet, E, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, seg, solid, speck, TAU } from './lib.mjs';

const AU = { rim: '#4a2a06', deep: '#c47a12', body: '#ffc94a', light: '#ffe9a0', core: '#fffaf0', glow: '#ffb84a', amber: '#ff9a2a' };
const RED = { rim: '#2a0606', deep: '#8a1020', body: '#d8283a', light: '#ff7a6a', glow: '#ff4a3a' };
const FIRE = { glow: '#ff9a2a', body: '#ffb347', light: '#ffe08a', core: '#fff8e0' };

/** 그림 한 장 (가운데 (x, y), 폭 w, 비율 그대로). 없으면 false (도형으로 대신) */
function pic(g, name, x, y, w, a = 1, { sx = 1, sy = 1, rot = 0, add = 0, anchorY = 0.5 } = {}) {
  const img = asset(name);
  if (!img || a <= 0 || w <= 0) return !!img;
  const h = (w * img.height) / img.width;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.globalAlpha = a;
  g.drawImage(img, -w / 2, -h * anchorY, w, h);
  if (add > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * add; g.drawImage(img, -w / 2, -h * anchorY, w, h); }
  g.restore();
  return true;
}
/** 금빛 반짝이 가루 소용돌이 (치유 계열 공통, 사제 치유의 결을 금빛으로): 발밑 (y0)에서 태어나 돌며 떠오름 */
function goldSwirl(g, t, seed, n, { y0 = 0.6, rise = 1.2, rr = 0.75, t0 = 0, span = 0.45, a = 1, cols = [AU.light, AU.body, AU.core] } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.012 + r() * 0.022, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: Math.floor(r() * cols.length) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22;
    speck(gg, x, y, p.sz, cols[p.c], bell(age, 0, 0.12, 1) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 위에서 내려앉는 금빛 먼지 (y0 → y1) */
function goldFall(g, t, seed, n, { x = 0, w = 0.6, y0 = -0.9, y1 = 0.5, t0 = 0, span = 0.4, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.35 + r() * 0.3, x: x + (r() - 0.5) * w, sw: (r() - 0.5) * 0.1, sz: 0.011 + r() * 0.018, ph: r() * 9 }), (gg, p, age) => {
    speck(gg, p.x + p.sw * Math.sin(age * 8 + p.ph), lerp(y0, y1, E.in2(age) * 0.6 + age * 0.4), p.sz, age < 0.5 ? AU.core : AU.body, bell(age, 0, 0.15, 1) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
  });
}
/** 사방으로 터지는 금빛 불똥 (x, y 가운데, 납작 sq) */
function goldBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.9, sq = 0.7, t0 = 0, a = 1, col = AU.light, grav = 0.5 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const d = p.v * E.out3(age);
    speck(gg, x + Math.cos(p.ang) * d, y + Math.sin(p.ang) * d * sq + grav * age * age, p.sz * (1 - 0.4 * age), col, (1 - E.in2(age)) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 순서대로 톡톡 켜지는 큰 반짝임 */
function glints(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.5, h = 0.8, a = 1, col = AU.glow } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.08, 0.19 * Math.sin(Math.PI * age), col, a, p.rot, 0.13, AU.core));
}
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
/** 불꽃 혀 하나 (밑 (x, y), 높이 h, 일렁임 ph) */
function flame(g, x, y, h, a, ph = 0) {
  if (h <= 0 || a <= 0) return;
  const sway = Math.sin(ph) * 0.12;
  const fl = hh => { hh.beginPath(); hh.moveTo(sway, -1); hh.bezierCurveTo(0.35, -0.55, 0.85, -0.2, 0.7, 0.12); hh.quadraticCurveTo(0.5, 0.45, 0, 0.42); hh.quadraticCurveTo(-0.5, 0.45, -0.7, 0.12); hh.bezierCurveTo(-0.85, -0.2, -0.35, -0.55, sway, -1); hh.closePath(); };
  g.save(); g.translate(x, y - h * 0.42); g.scale(h * 0.5, h);
  g.globalCompositeOperation = 'lighter';
  g.save(); g.filter = 'blur(3px)'; fl(g); g.fillStyle = C(FIRE.glow, 0.55 * a); g.fill(); g.restore();
  fl(g); const gr = g.createLinearGradient(0, -1, 0, 0.45); gr.addColorStop(0, C(FIRE.light, 0.85 * a)); gr.addColorStop(1, C(FIRE.glow, 0.75 * a)); g.fillStyle = gr; g.fill();
  g.save(); g.translate(0, 0.14); g.scale(0.5, 0.55); fl(g); g.fillStyle = C(FIRE.core, 0.9 * a); g.fill(); g.restore();
  g.restore();
}
const frac = v => v - Math.floor(v);
const wave = (t, k = 1, ph = 0) => 0.5 + 0.5 * Math.sin(TAU * (t * k + ph));

export default {
  /** 빛의 손길 (기본 힐, 자주 씀 → 짧게, Lim 2026-10-16 「너무 과하다」): Codex 원뿔 빛 (paladin-ray, 꼭대기 별 + 세로 빛살)이 위에서부터 내려와 칸을 비추고,
   *  원뿔 안으로 금빛 먼지가 내려앉고 발밑에서 금빛 반짝이 가루가 돌며 떠오른 뒤 (2026-10-18 「손길도 파티클」) 원뿔이 위에서부터 걷힘 */
  'paladin-holy-light': {
    frames: 16, logical: 80, scope: 'target',
    draw(g, { t }) {
      const top = -1.05, bot = 0.62, down = E.out3(seg(t, 0, 0.2)), lift = E.in2(seg(t, 0.42, 1)), fade = 1 - E.in2(seg(t, 0.55, 1));
      glowOval(g, 0, bot - 0.05, 0.6, 0.3, AU.glow, 0.65 * fade);
      glowOval(g, 0, bot - 0.05, 0.32, 0.36, '#ffffff', 0.6 * (1 - E.out2(seg(t, 0.05, 0.4))));
      const W = 1.5, yTop = lerp(top, bot, lift), yBot = lerp(top + 0.2, bot + 0.1, down);
      if (yBot > yTop + 0.02) {
        g.save(); g.beginPath(); g.rect(-2, yTop, 4, yBot - yTop); g.clip();
        if (!pic(g, 'paladin-ray', 0, top - 0.02, W, 0.72 * fade, { anchorY: 0, sx: lerp(0.55, 0.85, down), add: 0.25 * (1 - seg(t, 0, 0.3)) })) {
          g.globalCompositeOperation = 'lighter'; g.fillStyle = C(AU.light, 0.3 * fade); g.beginPath(); g.moveTo(0, top); g.lineTo(0.42, bot); g.lineTo(-0.42, bot); g.closePath(); g.fill();
        }
        g.restore();
      }
      glint(g, 0, top + 0.08, 0.26 * (1 - lift) * down, AU.amber, fade, 0, 0.13);
      goldFall(g, t, 6, 22, { w: 0.55, y0: -0.75, y1: 0.55, span: 0.4, a: fade });
      goldSwirl(g, t, 11, 28, { y0: 0.55, rise: 1.0, rr: 0.6, t0: 0.12, span: 0.35, a: fade });
      glints(g, t, 5, 4, { t0: 0.15, w: 1.0, y0: -0.2, h: 0.9, a: fade });
    },
  },

  /** 빛의 서약 (지속): 금빛 마름모 룬 셋이 꼬리를 끌며 칸 둘레를 돌고, 머리 위에 Codex 오각 서약 문장 (paladin-sigil)이 톡 떠올랐다
   *  금빛 가루로 부서져 몸에 내려앉음. 몸 둘레에 금빛 반짝이 가루가 돌며 떠오름 (지속 치유) */
  'paladin-oath': {
    frames: 24, logical: 90, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), spin = t * TAU * 0.85, sy = -0.62;
      glow(g, 0, 0.05, 1.0, AU.glow, 0.45 * (1 - E.out2(seg(t, 0, 0.7))));
      // 머리 위 서약 문장: 톡 나타나 숨 쉬다 부서짐
      const pop = E.back(seg(t, 0, 0.2), 1.8), crumble = seg(t, 0.45, 0.72), sz = 0.7 * pop * (1 - 0.25 * crumble);
      glow(g, 0, sy, 0.55, AU.glow, 0.6 * bell(t, 0, 0.2, 0.75));
      if (!pic(g, 'paladin-sigil', 0, sy, sz, (1 - E.in2(crumble)) * 0.95, { add: 0.4 * (1 - seg(t, 0.05, 0.3)) })) {
        g.save(); g.translate(0, sy); g.scale(sz / 2, sz / 2); path.poly(g, 5); g.fillStyle = C(AU.body, 0.6 * fade); g.fill(); g.restore();
      }
      glint(g, 0, sy, 0.3 * bell(t, 0.08, 0.16, 0.32), AU.amber, 1, 0, 0.12);
      // 부서진 문장 가루가 몸으로 내려앉음
      particles(g, t, 17, 26, r => ({ t0: 0.45 + r() * 0.2, life: 0.35 + r() * 0.2, x: (r() - 0.5) * 0.55, y: sy + (r() - 0.5) * 0.45, tx: (r() - 0.5) * 0.9, ty: 0.15 + r() * 0.45, sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
        const k = E.inOut(age);
        speck(gg, lerp(p.x, p.tx, k), lerp(p.y, p.ty, k), p.sz, AU.light, (1 - E.in2(age)) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      // 도는 룬 셋 (뒤에 있는 것은 작고 옅게, 꼬리 + 흩날리는 가루)
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * TAU) / 3, z = Math.sin(a), x = Math.cos(a) * 0.9, y = z * 0.32 + 0.12, s = 0.24 * (0.8 + 0.2 * z) * E.back(seg(t, i * 0.05, 0.2 + i * 0.05));
        const P = s2 => { const b = a - (1 - s2) * 1.3; return { x: Math.cos(b) * 0.9, y: Math.sin(b) * 0.32 + 0.12 }; };
        comet(g, P, 0, 1, { w: 0.07, rim: AU.rim, body: AU.body, core: AU.core, glowCol: AU.glow, a: fade * (z > 0 ? 0.9 : 0.45), head: 0 });
        rune(g, x, y, s, fade * (z > 0 ? 1 : 0.65), Math.sin(a) * 0.2);
        for (let k = 1; k <= 4; k++) { const q = P(1 - k * 0.18); speck(g, q.x, q.y + 0.03 * k, 0.014, AU.light, fade * (1 - k * 0.2) * (z > 0 ? 1 : 0.5), wave(t, 3, i * 0.3 + k * 0.2)); }
      }
      goldSwirl(g, t, 21, 36, { y0: 0.6, rise: 1.1, rr: 0.8, t0: 0.1, span: 0.5, a: fade });
    },
  },

  /** 빛의 파도 (회복한 칸마다, 네 칸 동시): Codex 금빛 파도 마루 (paladin-crest, ∩ 모양 · 끝이 말린 물마루)가 위에서 쏟아져 내려와 닿는 순간 번쩍 부서지며
   *  양옆으로 넓게 퍼져 사라지고, 금빛 물보라 · 불똥이 위와 양옆으로 튀고 반짝이 가루가 떠오름 */
  'paladin-light-wave': {
    frames: 18, logical: 88, scope: 'target',
    draw(g, { t }) {
      const hit = 0.22, fade = 1 - E.in2(seg(t, 0.5, 1));
      if (t < hit + 0.04) {
        const u = E.in2(seg(t, 0, hit)), y = lerp(-0.85, 0.05, u), a = 1 - seg(t, hit, hit + 0.04);
        glowOval(g, 0, y, 0.85, 0.45, AU.glow, 0.55 * a);
        if (!pic(g, 'paladin-crest', 0, y, 1.55, a, { sy: lerp(0.8, 1, u) })) lightStroke(g, s2 => ({ x: lerp(-0.7, 0.7, s2), y: y - Math.sin(Math.PI * s2) * 0.4 }), 0, 1, () => 0.2, { rim: AU.rim, body: AU.body, core: '#fff', a });
        goldFall(g, t, 3, 12, { w: 1.2, y0: -1.1, y1: y, span: hit * 0.8, a: 0.9 });
      }
      const b = bell(t, hit - 0.05, hit + 0.02, hit + 0.42);
      glowOval(g, 0, 0.3, 1.1, 0.5, AU.glow, 0.95 * b);
      glow(g, 0, 0.28, 0.5, '#ffffff', b);
      if (t >= hit) {
        const u = seg(t, hit, 1);
        // 부서진 물마루가 양옆으로 넓게 퍼지며 납작해짐
        pic(g, 'paladin-crest', 0, 0.12 + 0.12 * u, 1.55 * (1 + 0.55 * E.out2(u)), (1 - E.in2(seg(u, 0, 0.75))) * 0.9, { sy: lerp(0.9, 0.45, E.out2(u)), add: 0.5 * (1 - seg(u, 0, 0.3)) });
        // 물보라 (위로 · 양옆으로 포물선)
        particles(g, u, 4, 34, r => ({ t0: r() * 0.08, life: 0.5 + r() * 0.35, x: (r() - 0.5) * 1.1, vx: (r() - 0.5) * 1.6, vy: 0.7 + r() * 0.9, sz: 0.016 + r() * 0.024, ph: r() * 9 }), (gg, p, age) =>
          speck(gg, p.x + p.vx * age, 0.25 - p.vy * age + 1.4 * age * age, p.sz * (1 - 0.3 * age), age < 0.4 ? AU.core : AU.light, (1 - E.in2(age)) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 20)));
        goldBurst(g, u, 9, 16, { y: 0.28, sp: 1.0, sq: 0.45, a: fade, grav: 0.2 });
        goldSwirl(g, u, 12, 18, { y0: 0.55, rise: 0.9, rr: 0.7, span: 0.3, a: fade });
      }
    },
  },

  /** 정화의 손: Codex 해돋이 빛살 손바닥 (paladin-palm, 둥근 빛 + 다섯 빛살)이 가운데에서 펼쳐지며 검붉은 · 보라 얼룩을 밖으로 튕겨 내고,
   *  얼룩이 금빛 불똥으로 타 사라짐. 빛살 끝에서 반짝임, 손바닥에서 금빛 가루가 사방으로 퍼짐 */
  'paladin-cleanse': {
    frames: 18, logical: 92, scope: 'target',
    draw(g, { t }) {
      const open = E.back(seg(t, 0, 0.26), 1.5), fade = 1 - E.in2(seg(t, 0.5, 1)), cy = 0.32;
      glow(g, 0, cy, 1.05, AU.glow, 0.75 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, cy, 0.45, '#ffffff', 0.9 * (1 - E.out3(seg(t, 0, 0.3))));
      // 손바닥 그림: 둥근 빛 (그림 높이 70% 자리)을 칸 cy에 두고 아래에서 위로 펼침
      const W = 1.75, img = asset('paladin-palm'), oy = img ? 0.7 : 0.5;
      if (!pic(g, 'paladin-palm', 0, cy, W, fade, { anchorY: oy, sx: Math.min(1.08, 0.4 + 0.6 * open), sy: Math.min(1.08, open), add: 0.4 * (1 - seg(t, 0, 0.35)) })) {
        for (let i = 0; i < 5; i++) { const a = rad(-90 + (i - 2) * 30); lightStroke(g, s => ({ x: Math.cos(a) * s, y: cy + Math.sin(a) * s }), 0, 1, () => 0.1, { rim: AU.rim, body: AU.body, core: '#fff', a: fade }); }
      }
      // 빛살 끝 반짝임
      for (let i = 0; i < 5; i++) {
        const a = rad(-90 + (i - 2) * 33), L = (i === 2 ? 1.08 : i % 4 === 0 ? 0.72 : 0.95) * Math.min(1, open), b = bell(t, 0.16 + i * 0.03, 0.24 + i * 0.03, 0.5);
        glint(g, Math.cos(a) * L * 0.95, cy + Math.sin(a) * L * 0.95, 0.2 * b, AU.glow, b * fade, a, 0.13, AU.core);
      }
      // 튕겨 나가는 검붉은 · 보라 얼룩 → 끝에서 금빛 불똥으로 타 사라짐
      particles(g, t, 3, 6, (r, i) => ({ t0: 0.06, life: 0.62, a: rad(-180 + i * 36 + r() * 15), sz: 0.08 + r() * 0.04, rot: r() * 6, c: i % 2 }), (gg, p, age) => {
        const d = 0.35 + 0.85 * E.out3(age), x = Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.85, k = 1 - E.in2(seg(age, 0.35, 1));
        if (k > 0) {
          gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * k, p.sz * k);
          solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: p.c ? '#a46ad0' : '#c84a5a', lo: p.c ? '#3d1b5a' : '#4a0a14', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
        }
        if (age > 0.35) for (let j = 0; j < 4; j++) { const q = seg(age, 0.35, 1), b2 = p.rot + j * 1.6; speck(gg, x + Math.cos(b2) * 0.12 * q, y + Math.sin(b2) * 0.12 * q - 0.1 * q, 0.016, FIRE.light, (1 - q) * fade); }
      });
      goldBurst(g, t, 7, 30, { y: cy, sp: 1.05, sq: 0.8, t0: 0.05, a: fade, grav: 0.3 });
      goldSwirl(g, t, 8, 14, { y0: 0.6, rise: 0.9, rr: 0.6, t0: 0.2, span: 0.3, a: fade });
    },
  },

  /** 희생: 칸 위에서 진홍 · 금빛 사슬이 내려와 Codex 진홍 방패 (paladin-shield, 금 십자 · 짧은 사슬)에 이어지고, 방패가 붉게 한 번 맥동하며
   *  진홍 · 금빛 불씨가 방패 둘레를 돌다 사슬을 타고 위로 빨려 올라감 (피해를 대신 받음) */
  'paladin-sacrifice': {
    frames: 22, logical: 92, scope: 'target',
    draw(g, { t }) {
      const drop = E.out3(seg(t, 0, 0.28)), fade = 1 - E.in2(seg(t, 0.65, 1)), pulse = bell(t, 0.25, 0.38, 0.65), shY = 0.02;
      glow(g, 0, shY, 1.0, RED.glow, 0.3 * fade + 0.45 * pulse);
      // 사슬 (위에서 방패 위 사슬 고리까지)
      const yEnd = lerp(-1.45, shY - 0.42, drop), n = 6;
      for (let i = 0; i < n; i++) {
        const y = -1.45 + ((yEnd + 1.45) * (i + 0.5)) / n, sw = Math.sin(i * 0.8 + t * 6) * 0.02;
        link(g, sw, y, 0.16, i % 2 ? 0.15 : 1, fade * (0.55 + 0.45 * (i / n)), i % 2 ? RED : AU);
      }
      // 방패 (그림, 붉게 맥동)
      const s = 0.72 * (1 + 0.14 * pulse) * E.back(seg(t, 0.12, 0.32));
      glow(g, 0, shY + 0.05, 0.8, RED.glow, 0.85 * pulse);
      if (!pic(g, 'paladin-shield', 0, shY, s, fade, { add: 0.6 * pulse })) {
        g.save(); g.translate(0, shY); g.scale(s / 2, s / 2); solid(g, gg => path.rect(gg, 1.2, 1.6, 0.3), { hi: RED.light, lo: RED.deep, rim: RED.rim, a: fade }); g.restore();
      }
      ringGlow(g, 0, shY + 0.05, lerp(0.3, 1.0, seg(t, 0.28, 0.62)), 0.1, RED.glow, 0.7 * pulse);
      // 진홍 · 금빛 불씨: 방패 둘레를 돌다 사슬을 타고 위로
      particles(g, t, 13, 24, r => ({ t0: 0.25 + r() * 0.3, life: 0.45 + r() * 0.2, a0: r() * TAU, sz: 0.014 + r() * 0.02, c: r() < 0.55, ph: r() * 9 }), (gg, p, age) => {
        const orbit = seg(age, 0, 0.5), up = seg(age, 0.5, 1), ang = p.a0 + orbit * 5, rr = 0.55 * (1 - 0.6 * up);
        const x = Math.cos(ang) * rr * (1 - up), y = lerp(shY + Math.sin(ang) * rr * 0.5, -1.2, E.in2(up));
        speck(gg, x, y, p.sz, p.c ? RED.light : AU.light, bell(age, 0, 0.1, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      goldBurst(g, t, 15, 16, { y: shY, sp: 0.8, sq: 0.8, t0: 0.3, a: fade, col: RED.light, grav: 0.2 });
    },
  },

  /** 빛의 성역 (범위 칸마다): 바닥의 금빛 빛 고리 위로 Codex 반투명 금빛 돔 (paladin-dome)이 솟아오르고, 돔 안팎으로 금빛 가루가 떠오르며
   *  꼭대기에서 반짝임. 여러 칸에 같이 뜨므로 가루는 칸마다 적당히 */
  'paladin-sanctuary': {
    frames: 24, logical: 76, scope: 'area',
    draw(g, { t }) {
      const rise = E.out3(seg(t, 0.04, 0.38)), fade = 1 - E.in2(seg(t, 0.6, 1)), by = 0.58, W = 1.85;
      glowOval(g, 0, by, 1.0, 0.3, AU.glow, 0.6 * fade * Math.min(1, t * 8 + 0.3));
      ringGlow(g, 0, by, lerp(0.3, 0.88, E.out3(seg(t, 0, 0.3))), 0.07, AU.light, 0.85 * fade, 0.3);
      if (rise > 0) {
        // 돔 그림: 바닥 타원 (그림 높이 85%)을 by에 두고 위로 솟음
        if (!pic(g, 'paladin-dome', 0, by, W, 0.9 * fade, { anchorY: 0.85, sy: rise, add: 0.25 * (1 - seg(t, 0.1, 0.45)) })) {
          g.save(); g.globalAlpha = 0.4 * fade; g.beginPath(); g.ellipse(0, by, 0.85, 1.2 * rise, 0, Math.PI, TAU); g.fillStyle = C(AU.glow, 0.3); g.fill(); g.restore();
        }
        glint(g, -0.3, by - 1.3 * rise, 0.2 * bell(t, 0.3, 0.4, 0.6), AU.glow, 1, 0.2, 0.15);
      }
      particles(g, t, 5, 22, r => ({ t0: 0.1 + r() * 0.55, life: 0.4 + r() * 0.2, x: (r() - 0.5) * 1.5, sz: 0.012 + r() * 0.016, ph: r() * 9 }), (gg, p, age) =>
        speck(gg, p.x * (1 - 0.2 * age), by - 0.05 - 1.2 * E.out2(age), p.sz, age < 0.4 ? AU.core : AU.light, bell(age, 0, 0.15, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 16)));
      glints(g, t, 6, 3, { t0: 0.3, step: 0.1, w: 1.3, y0: -0.2, h: 0.8, a: fade });
    },
  },

  /** 보호의 손 (무적): 대상 둘레에 Codex 금빛 팔각 봉인 (paladin-octagram, 정사각형 둘을 45° 엇갈린 판금 테)이 탁 나타나 천천히 돌고,
   *  꼭짓점 8곳이 차례로 켜지며 불똥이 테를 따라 돌다, 끝에 안쪽으로 접히듯 작아지며 금빛 가루로 흩어짐 */
  'paladin-hand-guard': {
    frames: 24, logical: 94, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.18), 2), fold = E.in3(seg(t, 0.72, 1)), s = pop * (1 - fold), rot = rad(10) + t * 0.9, fade = 1 - E.in2(seg(t, 0.82, 1));
      glow(g, 0, 0, 1.15, AU.glow, 0.5 * fade);
      glow(g, 0, 0, 0.5, '#ffffff', 0.8 * (1 - E.out3(seg(t, 0, 0.3))));
      const W = 2.05 * s;
      if (s > 0.01 && !pic(g, 'paladin-octagram', 0, 0, W, fade, { rot, add: 0.5 * (1 - seg(t, 0.02, 0.3)) })) {
        g.save(); g.rotate(rot); g.scale(s, s); g.globalAlpha = fade;
        for (const r0 of [0, Math.PI / 4]) { g.save(); g.rotate(r0); g.beginPath(); g.rect(-0.66, -0.66, 1.32, 1.32); g.restore(); g.lineWidth = 0.1; g.strokeStyle = AU.body; g.stroke(); }
        g.restore();
      }
      if (s > 0.01) {
        const R = 0.9 * s;
        // 꼭짓점 8곳이 차례로 켜짐
        for (let i = 0; i < 8; i++) {
          const a = rot - Math.PI / 2 + (i * TAU) / 8, b = bell(t, 0.12 + i * 0.05, 0.18 + i * 0.05, 0.4 + i * 0.05);
          glint(g, Math.cos(a) * R, Math.sin(a) * R, 0.24 * b, AU.amber, b * fade, a, 0.14, AU.core);
        }
        // 테를 따라 도는 불똥 둘 (꼬리)
        for (let k = 0; k < 2; k++) {
          const P = s2 => { const a = rot * 3 + k * Math.PI + (s2 - 1) * 1.2 + t * 6; return { x: Math.cos(a) * R * 0.86, y: Math.sin(a) * R * 0.86 }; };
          comet(g, P, 0, 1, { w: 0.05, rim: AU.rim, body: AU.body, core: AU.core, glowCol: AU.glow, a: fade * bell(t, 0.1, 0.25, 0.75), head: 0.8 });
        }
      }
      goldBurst(g, t, 3, 22, { sp: 1.1, sq: 1, t0: 0.02, a: 1, grav: 0 });
      // 접히며 흩어지는 가루 (안쪽으로 빨려 들었다 위로)
      particles(g, t, 7, 20, r => ({ t0: 0.7 + r() * 0.12, life: 0.3, a: r() * TAU, sz: 0.014 + r() * 0.014 }), (gg, p, age) => speck(gg, Math.cos(p.a) * 0.9 * (1 - age), Math.sin(p.a) * 0.9 * (1 - age) - 0.3 * age, p.sz, AU.light, 1 - age));
    },
  },

  /** 봉화 (대상 지정 + 회복 + 피해 감소): 머리 위에 Codex 금빛 봉화 그릇 (paladin-brazier)이 톡 놓이며 불꽃이 확 타오르고, 불티가 많이 날아오르며
   *  따뜻한 금빛이 몸으로 내려와 감싸고 반짝이 가루가 돎. 봉화가 이어지는 동안은 칸 둘레에 paladin-beacon-loop가 돎 */
  'paladin-beacon': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.8), fire = E.out3(seg(t, 0.06, 0.28)), fade = 1 - E.in2(seg(t, 0.62, 1)), by = -0.72;
      glow(g, 0, 0.1, 1.0, AU.glow, 0.4 * fade);
      glowOval(g, 0, 0.15, 0.85, 1.1, AU.amber, 0.3 * bell(t, 0.15, 0.35, 1));
      glow(g, 0, by - 0.1, 0.6, FIRE.glow, 0.7 * fire * fade);
      // 그릇 (그림): 불꽃이 확 커지는 순간 더 밝게, 위아래로 살짝 일렁임
      const flick = 1 + 0.04 * Math.sin(t * 40);
      if (!pic(g, 'paladin-brazier', 0, by, 0.78 * pop, fade, { sy: flick, add: 0.6 * bell(t, 0.06, 0.16, 0.4) })) {
        flame(g, 0, by + 0.1, 0.5 * fire, fade, t * 24);
      }
      flame(g, 0, by - 0.05, 0.28 * fire * (1 + 0.15 * Math.sin(t * 33)), 0.45 * fade, t * 30); // 그림 불꽃 위에 일렁이는 빛
      // 불티 (많이, 흔들리며 위로)
      particles(g, t, 5, 30, r => ({ t0: 0.08 + r() * 0.55, life: 0.35 + r() * 0.25, x: (r() - 0.5) * 0.3, sz: 0.012 + r() * 0.018, sw: (r() - 0.5) * 0.25, ph: r() * 9 }), (gg, p, age) => {
        const x = p.x + p.sw * age + Math.sin(age * 9 + p.ph) * 0.05, y = by - 0.3 - 0.8 * E.out2(age);
        glow(gg, x, y, p.sz * 4, FIRE.glow, 0.5 * (1 - age) * fade);
        speck(gg, x, y, p.sz, age < 0.4 ? FIRE.core : FIRE.light, (1 - age) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
      });
      // 그릇에서 몸으로 내려오는 따뜻한 빛 가루 → 몸 둘레 반짝이 가루
      particles(g, t, 9, 20, r => ({ t0: 0.2 + r() * 0.3, life: 0.4, x: (r() - 0.5) * 0.3, tx: (r() - 0.5) * 1.0, ty: 0.1 + r() * 0.5, sz: 0.012 + r() * 0.016 }), (gg, p, age) =>
        speck(gg, lerp(p.x, p.tx, E.out2(age)), lerp(by + 0.25, p.ty, E.inOut(age)), p.sz, AU.light, (1 - E.in2(age)) * fade));
      goldSwirl(g, t, 13, 26, { y0: 0.6, rise: 1.0, rr: 0.75, t0: 0.25, span: 0.4, a: fade });
      for (let i = 0; i < 4; i++) { const a = t * 6 + (i * TAU) / 4, b = bell(t, 0.25 + i * 0.04, 0.4 + i * 0.04, 0.95); glint(g, Math.cos(a) * 0.6, 0.25 + Math.sin(a) * 0.27, 0.15 * b, AU.glow, b, a, 0.15, AU.core); }
    },
  },

  /** 봉화 대상 칸 둘레 루프 (Lim 2026-10-18 「봉화대상의 동그란 이미지도 파티클로 루프되게 하여 좀더 고급스럽게」, 예전 fx-ring-beacon 그림 대신):
   *  좌표 1 = 프레임 반, 고리 반지름 RING (board.ts가 고리를 칸 둘레 원에 맞춰 그림). 은은히 숨 쉬는 금빛 고리 위로 작은 불꽃 여섯이 번갈아 일렁이고,
   *  금빛 혜성 셋이 고리를 따라 돌며 불티가 고리에서 위로 날아오르고 반짝이가 톡톡 켜짐. 3초 한 바퀴 */
  'paladin-beacon-loop': {
    frames: 36, fps: 12, loop: true, logical: 62, scope: 'target',
    draw(g, { t }) {
      const R = RING, br = wave(t, 1);
      // 고리 (바깥 번짐 + 어두운 테 + 금빛 몸 + 흰 심)
      ringGlow(g, 0, 0, R, 0.09, AU.glow, 0.35 + 0.25 * br);
      g.save(); g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.lineWidth = 0.05; g.strokeStyle = C(AU.rim, 0.7); g.stroke();
      g.lineWidth = 0.03; g.strokeStyle = C(AU.body, 0.95); g.stroke();
      g.lineWidth = 0.012; g.strokeStyle = C(AU.core, 0.8 + 0.2 * br); g.stroke();
      g.restore();
      // 고리 위 작은 불꽃 여섯 (번갈아 커졌다 작아짐, 위쪽을 향해 타오름)
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 6, x = Math.cos(a) * R, y = Math.sin(a) * R, h = 0.14 + 0.07 * wave(t, 2, i / 6);
        glow(g, x, y, 0.13, FIRE.glow, 0.45);
        flame(g, x, y + 0.02, h, 0.95, TAU * (t * 3 + i * 0.37));
      }
      // 고리를 따라 도는 금빛 혜성 셋
      for (let k = 0; k < 3; k++) {
        const P = s2 => { const a = TAU * (t + k / 3) + (s2 - 1) * 0.9; return { x: Math.cos(a) * R, y: Math.sin(a) * R }; };
        comet(g, P, 0, 1, { w: 0.035, rim: AU.rim, body: AU.body, core: AU.core, glowCol: AU.glow, a: 0.9, head: 0.8 });
      }
      // 고리에서 날아오르는 불티 (한 바퀴에 정수 번)
      for (let i = 0; i < 30; i++) {
        const a0 = (i * TAU) / 30 + 0.2, life = frac(t * (i % 3 === 0 ? 2 : 1) + i * 0.137), x0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R;
        const x = x0 * (1 + 0.15 * life) + 0.04 * Math.sin(TAU * (life * 2 + i * 0.2)), y = y0 - 0.36 * life, sz = 0.012 + 0.007 * (i % 3), al = bell(life, 0, 0.15, 1);
        glow(g, x, y, sz * 4, i % 2 ? FIRE.glow : AU.glow, 0.45 * al);
        speck(g, x, y, sz, i % 2 ? FIRE.light : AU.light, al, wave(life, 3, i * 0.11));
      }
      // 고리를 따라 천천히 도는 금빛 알갱이 (반대 방향)
      for (let i = 0; i < 14; i++) { const a = -TAU * t + (i * TAU) / 14, rr = R + 0.05 * Math.sin(TAU * (t * 2 + i * 0.3)); speck(g, Math.cos(a) * rr, Math.sin(a) * rr, 0.01, AU.core, 0.55 + 0.45 * wave(t, 3, i / 14), wave(t, 2, i * 0.27)); }
      // 반짝이
      for (let i = 0; i < 6; i++) { const ph = frac(t * 2 + i / 6), a = i * 1.9 + 0.4; glint(g, Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08, 0.08 * bell(ph, 0, 0.12, 0.3), AU.glow, 1, a, 0.14, AU.core); }
    },
  },
};
/** 봉화 루프 고리 반지름 (프레임 반 = 1). board.ts BEACON_RING과 같게 (tests/pxf.test.ts) */
export const RING = 0.72;
