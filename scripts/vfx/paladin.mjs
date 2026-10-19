// 성기사: 따뜻한 금빛 · 흰빛 + 호박 · 주황 강조 (사제의 하늘빛 대신), 희생은 진홍. 원뿔 빛 · 룬 · 문장처럼 굵고 단단한 모양.
// 2026-10-18 Lim 「성기사 스킬 이펙트를 전체 재생성, 퀄리티를 올려주고 힐 계열은 모두 파티클, 이펙트는 전체적으로 파티클 활용을 많이」:
// 모양은 Codex로 그린 그림 (scripts/vfx/assets/paladin-*), 움직임 · 빛 · 금빛 반짝이 가루는 코드. 봉화 대상 칸 둘레는 루프 (paladin-beacon-loop)
import { asset, bell, C, comet, E, glint, glow, glowOval, lerp, lightStroke, loopGlints, loopRise, particles, path, rad, ringGlow, seg, solid, speck, TAU } from './lib.mjs';

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
/** Codex 불꽃 (paladin-flame-b)의 그려진 부분 (그림 비율): 크기 · 밑동을 맞춰 그림 */
const FLAME_BOX = [0.209, 0.791, 0.041, 0.972];
/**
 * 손그림 불꽃 한 장 (2026-10-18 Lim 「봉화 불 이펙트 퀄리티가 낮다」 → 10-19 「불모양 이미지 퀄리티가 너무 낮다」: 두 장을 섞으면 겹쳐 번져 보여 한 장만):
 * 밑동 (x, y), 그려진 높이 h. 위아래로 늘었다 줄며 (밑동 고정) 좌우로 살짝 기울고, 밝은 심 · 빛 번짐이 깜빡임. 그림이 없으면 도형 불꽃
 */
function paintedFlame(g, x, y, h, a, ph = 0) {
  if (h <= 0 || a <= 0) return;
  const img = asset('paladin-flame-b');
  if (!img) { flame(g, x, y, h, a, ph); return; }
  const stretch = 1 + 0.06 * Math.sin(ph * 1.7 + 1), lean = 0.05 * Math.sin(ph * 0.9);
  glow(g, x, y - h * 0.35, h * 0.75, FIRE.glow, 0.35 * a);
  const [x0, x1, y0, y1] = FLAME_BOX, dh = (h * stretch) / (y1 - y0), dw = (dh * img.width) / img.height / Math.sqrt(stretch);
  g.save(); g.translate(x, y); g.transform(1, 0, -lean, 1, 0, 0); g.globalAlpha = a;
  g.drawImage(img, -dw * (x0 + x1) / 2, -dh * y1, dw, dh); g.restore();
  glow(g, x, y - h * 0.25, h * 0.3, FIRE.core, (0.3 + 0.2 * Math.sin(ph * 2.3)) * a);
}

export default {
  /** 빛의 손길 (기본 힐): 광선 없이 (Lim 2026-10-18 「광선은 제거하고 노란 파티클이 내려오도록」 → 「손길은 좀더 화려하게」)
   *  머리 위에서 별빛이 번쩍 터지며 짧은 빛살이 사방으로 튀고, 노란 빛 알갱이 · 작은 별이 꼬리를 끌며 대상에게 쏟아져 내림.
   *  닿는 순간 몸이 금빛으로 번쩍이고 발밑에 빛 물결 두 겹이 퍼지며, 반짝이 가루가 소용돌이치며 떠오름. 기본 힐이라 길이는 짧게 (16장) */
  'paladin-holy-light': {
    frames: 16, logical: 80, scope: 'target',
    draw(g, { t }) {
      const top = -1.0, bot = 0.58, fade = 1 - E.in2(seg(t, 0.62, 1)), star = 1 - E.out2(seg(t, 0, 0.45));
      // 머리 위 별빛 터짐 (큰 반짝임 + 짧은 빛살 여덟)
      glow(g, 0, top + 0.05, 0.55, AU.glow, 0.6 * star);
      glow(g, 0, top + 0.05, 0.22, '#ffffff', 0.9 * star);
      glint(g, 0, top + 0.05, 0.36 * bell(t, 0, 0.1, 0.5), AU.amber, 1, t * 2, 0.12, AU.core);
      for (let i = 0; i < 8; i++) {
        const ang = (i * TAU) / 8 + 0.2, u = E.out3(seg(t, 0, 0.32)), d0 = 0.08 + 0.3 * u, d1 = d0 + 0.18 * (1 - u) + 0.05;
        if (u < 1) lightStroke(g, s2 => ({ x: Math.cos(ang) * lerp(d0, d1, s2), y: top + 0.05 + Math.sin(ang) * lerp(d0, d1, s2) * 0.8 }), 0, 1, uu => 0.028 * (1 - uu), { rim: AU.deep, body: AU.light, core: AU.core, a: (1 - u) * 0.9, rimW: 0 });
      }
      // 쏟아져 내리는 노란 빛 알갱이 (꼬리 + 빛 번짐, 첫 장부터 일부는 내려오는 중)
      particles(g, t, 6, 84, r => ({ t0: -0.15 + r() * 0.55, life: 0.3 + r() * 0.2, x0: (r() - 0.5) * 1.3, x1: (r() - 0.5) * 0.8, y0: top - 0.12 + r() * 0.45, y1: -0.2 + r() * 0.8, sz: 0.012 + r() * 0.024, ph: r() * 9 }), (gg, p, age) => {
        const k = E.in2(age) * 0.55 + age * 0.45, x = lerp(p.x0, p.x1, age), y = lerp(p.y0, p.y1, k), al = bell(age, 0, 0.1, 1) * fade, pa = Math.max(0, age - 0.16), py = lerp(p.y0, p.y1, E.in2(pa) * 0.55 + pa * 0.45);
        gg.save(); gg.globalCompositeOperation = 'lighter'; gg.lineCap = 'round';
        const gr = gg.createLinearGradient(x, py, x, y); gr.addColorStop(0, C(AU.body, 0)); gr.addColorStop(1, C(AU.light, 0.85 * al));
        gg.strokeStyle = gr; gg.lineWidth = p.sz * 1.3; gg.beginPath(); gg.moveTo(lerp(p.x0, p.x1, pa), py); gg.lineTo(x, y); gg.stroke(); gg.restore();
        glow(gg, x, y, p.sz * 5, AU.glow, 0.5 * al);
        speck(gg, x, y, p.sz, age < 0.5 ? AU.core : AU.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
      });
      // 함께 내려오는 작은 별 (돌며 떨어짐)
      particles(g, t, 8, 12, r => ({ t0: -0.05 + r() * 0.4, life: 0.4 + r() * 0.15, x0: (r() - 0.5) * 1.1, y1: -0.1 + r() * 0.6, rot: r() * 6, sz: 0.09 + r() * 0.06 }), (gg, p, age) =>
        glint(gg, p.x0 * (1 - 0.4 * age), lerp(top, p.y1, E.in2(age) * 0.5 + age * 0.5), p.sz * Math.sin(Math.PI * Math.min(1, age * 1.4)), AU.glow, fade, p.rot + age * 5, 0.14, AU.core));
      // 닿는 순간 몸이 번쩍 + 발밑 빛 물결 두 겹
      const land = bell(t, 0.18, 0.3, 0.7);
      glow(g, 0, 0.12, 0.85, AU.glow, 0.55 * land);
      glow(g, 0, 0.1, 0.35, '#ffffff', 0.55 * bell(t, 0.2, 0.28, 0.5));
      for (const [d, k] of [[0.22, 1], [0.34, 0.7]]) ringGlow(g, 0, bot, lerp(0.15, 0.95, E.out3(seg(t, d, d + 0.45))), 0.07, AU.light, k * fade * (1 - seg(t, d + 0.1, d + 0.5)), 0.3);
      glowOval(g, 0, bot - 0.03, 0.6, 0.3, AU.glow, 0.6 * bell(t, 0.15, 0.35, 1));
      particles(g, t, 7, 12, (r, i) => ({ t0: 0.2 + i * 0.03 + r() * 0.03, life: 0.22, x: (r() - 0.5) * 0.9, y: -0.15 + r() * 0.75, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y, 0.16 * Math.sin(Math.PI * age), AU.glow, fade, p.rot, 0.13, AU.core));
      goldSwirl(g, t, 11, 40, { y0: 0.55, rise: 1.0, rr: 0.65, t0: 0.22, span: 0.35, a: fade });
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

  /** 빛의 파도 (회복한 칸마다, Lim 2026-10-18 「파도도 파티클을 좀더 과하게 하고 화려하게」): Codex 금빛 파도 마루 (paladin-crest)가 반짝이 커튼을 끌며
   *  위에서 쏟아져 내려와, 닿는 순간 큰 흰 금빛 섬광과 납작한 빛 충격파 두 겹이 터지고 물마루가 양옆으로 넓게 부서짐. 금빛 물보라 · 불똥이 위와 양옆으로
   *  잔뜩 튀고, 빛 분수가 솟았다 흩날리며, 반짝이 가루가 소용돌이치며 떠오름 */
  'paladin-light-wave': {
    frames: 20, logical: 88, scope: 'target',
    draw(g, { t }) {
      const hit = 0.2, fade = 1 - E.in2(seg(t, 0.55, 1)), fall = y => lerp(-0.85, 0.05, E.in2(seg(y, 0, hit)));
      // 쏟아지는 마루가 끄는 반짝이 커튼 (마루 위로 흩날림)
      particles(g, t, 3, 34, r => ({ t0: r() * hit * 0.9, life: 0.3 + r() * 0.25, x: (r() - 0.5) * 1.4, sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
        const y = fall(p.t0) - 0.25 - 0.3 * age;
        speck(gg, p.x + Math.sin(age * 8 + p.ph) * 0.04, y, p.sz, age < 0.4 ? AU.core : AU.light, (1 - age) * 0.95, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      if (t < hit + 0.04) {
        const u = E.in2(seg(t, 0, hit)), y = fall(t), a = 1 - seg(t, hit, hit + 0.04);
        glowOval(g, 0, y, 0.95, 0.5, AU.glow, 0.65 * a);
        if (!pic(g, 'paladin-crest', 0, y, 1.6, a, { sy: lerp(0.8, 1, u), add: 0.3 })) lightStroke(g, s2 => ({ x: lerp(-0.7, 0.7, s2), y: y - Math.sin(Math.PI * s2) * 0.4 }), 0, 1, () => 0.2, { rim: AU.rim, body: AU.body, core: '#fff', a });
      }
      // 닿는 순간: 큰 섬광 + 충격파 두 겹
      const b = bell(t, hit - 0.05, hit + 0.02, hit + 0.45);
      glowOval(g, 0, 0.3, 1.25, 0.55, AU.glow, 1 * b);
      glow(g, 0, 0.26, 0.6, '#ffffff', 0.95 * bell(t, hit - 0.03, hit + 0.02, hit + 0.25));
      glint(g, 0, 0.22, 0.45 * bell(t, hit, hit + 0.04, hit + 0.25), AU.amber, 1, 0.3, 0.1, AU.core);
      for (const [d, k] of [[hit, 1], [hit + 0.1, 0.75]]) ringGlow(g, 0, 0.42, lerp(0.2, 1.2, E.out3(seg(t, d, d + 0.45))), 0.09, AU.light, k * fade * (1 - seg(t, d + 0.12, d + 0.5)), 0.35);
      if (t >= hit) {
        const u = seg(t, hit, 1);
        pic(g, 'paladin-crest', 0, 0.12 + 0.12 * u, 1.6 * (1 + 0.6 * E.out2(u)), (1 - E.in2(seg(u, 0, 0.75))) * 0.9, { sy: lerp(0.9, 0.45, E.out2(u)), add: 0.6 * (1 - seg(u, 0, 0.3)) });
        // 물보라 (위로 · 양옆으로 포물선, 잔뜩)
        particles(g, u, 4, 72, r => ({ t0: r() * 0.1, life: 0.5 + r() * 0.4, x: (r() - 0.5) * 1.2, vx: (r() - 0.5) * 2.0, vy: 0.7 + r() * 1.1, sz: 0.014 + r() * 0.026, ph: r() * 9 }), (gg, p, age) => {
          const x = p.x + p.vx * age, y = 0.25 - p.vy * age + 1.5 * age * age, al = (1 - E.in2(age)) * fade;
          glow(gg, x, y, p.sz * 4, AU.glow, 0.4 * al);
          speck(gg, x, y, p.sz * (1 - 0.3 * age), age < 0.4 ? AU.core : AU.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
        });
        goldBurst(g, u, 9, 40, { y: 0.28, sp: 1.25, sq: 0.5, a: fade, grav: 0.25 });
        // 빛 분수 (가운데에서 솟았다 흩날림)
        particles(g, u, 10, 26, r => ({ t0: 0.02 + r() * 0.15, life: 0.45 + r() * 0.25, x: (r() - 0.5) * 0.3, vx: (r() - 0.5) * 0.7, vy: 1.4 + r() * 0.8, sz: 0.012 + r() * 0.018, ph: r() * 9 }), (gg, p, age) =>
          speck(gg, p.x + p.vx * age, 0.2 - p.vy * age + 1.6 * age * age, p.sz, AU.core, (1 - E.in2(age)) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 22)));
        glints(g, u, 12, 8, { t0: 0.02, step: 0.05, w: 1.4, y0: -0.1, h: 1.0, a: fade });
        goldSwirl(g, u, 13, 34, { y0: 0.55, rise: 1.0, rr: 0.8, span: 0.35, a: fade });
      }
    },
  },

  /** 정화의 손 (2026-10-19 Lim 「정화는 다시만들자. 손 모양 제거하고 다른 느낌으로」): 머리 위로 Codex 금빛 태양 문장 (paladin-sun)이 솟아 천천히 돌며 빛나고,
   *  몸에서 Codex 어둠 얼룩 연기 (paladin-taint)가 소용돌이치며 뽑혀 올라가 태양에 빨려 들어 금빛 불똥으로 타 사라짐 (밀어내던 예전과 반대로 빨아들여 태움).
   *  다 태우면 태양이 크게 번쩍이며 맑은 금빛 가루가 몸 위로 쏟아져 내리고, 반짝이가 소용돌이치며 떠오름. 태양은 이름 · 체력 위 (머리 위)에 떠 있음 */
  'paladin-cleanse': {
    frames: 22, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), rise = E.back(seg(t, 0, 0.22), 1.6), sy = lerp(-0.3, -0.72, E.out3(seg(t, 0, 0.25)));
      const flash = bell(t, 0.5, 0.56, 0.8), W = 0.95 * rise * (1 + 0.18 * flash);
      // 태양 뒤 빛 번짐 + 빛살 (천천히 돎)
      glow(g, 0, sy, 0.9 * rise, AU.glow, (0.45 + 0.4 * flash) * fade);
      glow(g, 0, sy, 0.35 * rise, '#ffffff', (0.35 + 0.6 * flash) * fade);
      for (let i = 0; i < 10; i++) {
        const ang = (i * TAU) / 10 + t * 1.2, L = (0.75 + 0.25 * (i % 2)) * rise * (1 + 0.3 * flash), a0 = (0.35 + 0.5 * flash) * fade;
        lightStroke(g, s2 => ({ x: Math.cos(ang) * lerp(0.25, L, s2), y: sy + Math.sin(ang) * lerp(0.25, L, s2) }), 0, 1, uu => 0.03 * (1 - uu), { rim: AU.deep, body: AU.light, core: AU.core, a: a0, rimW: 0 });
      }
      if (!pic(g, 'paladin-sun', 0, sy, W, fade, { rot: t * 1.4, add: 0.15 + 0.5 * flash })) {
        g.save(); g.translate(0, sy); g.scale(W / 2.4, W / 2.4); solid(g, h => path.star(h, 12, 0.6), { hi: AU.light, lo: AU.deep, rim: AU.rim, a: fade }); g.restore();
      }
      // 어둠 연기: 몸에서 커지며 나와 소용돌이치며 태양으로 빨려 들어가 타 사라짐
      for (let i = 0; i < 5; i++) {
        const t0 = 0.08 + i * 0.05, u = seg(t, t0, t0 + 0.38);
        if (u <= 0 || u >= 1) continue;
        const a0 = rad(-120 + i * 48), r0 = 0.45 + 0.1 * (i % 2), spin = u * 2.6, rr = r0 * (1 - E.in2(u));
        const x = Math.cos(a0 + spin) * rr, y = lerp(0.25 + Math.sin(a0) * 0.2, sy, E.in2(u)) + Math.sin(a0 + spin) * rr * 0.35;
        const burn = seg(u, 0.72, 1), sz = (0.13 + 0.05 * Math.sin(Math.PI * Math.min(1, u * 1.8))) * (1 - 0.7 * burn);
        if (!pic(g, 'paladin-taint', x, y, sz * 1.6, (1 - burn) * 0.95, { rot: spin + i })) {
          g.save(); g.translate(x, y); g.scale(sz, sz); solid(g, h => path.poly(h, 7), { hi: '#a46ad0', lo: '#3d1b5a', rim: '#14081e', rimW: 0.16, a: 1 - burn, shine: 0.25 }); g.restore();
        }
        // 연기 꼬리 (보라 → 금빛 불똥)
        for (let k = 1; k <= 3; k++) { const uk = Math.max(0, u - k * 0.06), xk = Math.cos(a0 + uk * 2.6) * r0 * (1 - E.in2(uk)), yk = lerp(0.25 + Math.sin(a0) * 0.2, sy, E.in2(uk)) + Math.sin(a0 + uk * 2.6) * r0 * (1 - E.in2(uk)) * 0.35; speck(g, xk, yk, 0.014, u > 0.5 ? FIRE.light : '#c890e8', (1 - k * 0.25) * fade); }
        if (burn > 0) { glow(g, x, y, 0.22, FIRE.glow, 0.8 * (1 - burn)); for (let j = 0; j < 6; j++) { const b2 = i * 1.3 + j * 1.05; speck(g, x + Math.cos(b2) * 0.16 * burn, y + Math.sin(b2) * 0.16 * burn, 0.016, j % 2 ? FIRE.light : AU.core, (1 - burn) * fade); } }
      }
      // 번쩍임 뒤 몸 위로 쏟아지는 맑은 금빛 가루
      particles(g, t, 19, 60, r => ({ t0: 0.52 + r() * 0.2, life: 0.3 + r() * 0.15, x0: (r() - 0.5) * 0.5, x1: (r() - 0.5) * 1.1, y1: -0.05 + r() * 0.7, sz: 0.012 + r() * 0.022, ph: r() * 9 }), (gg, p, age) => {
        const x = lerp(p.x0, p.x1, age), y = lerp(sy + 0.15, p.y1, E.in2(age) * 0.5 + age * 0.5), al = bell(age, 0, 0.12, 1) * fade;
        glow(gg, x, y, p.sz * 4.5, AU.glow, 0.45 * al);
        speck(gg, x, y, p.sz, age < 0.5 ? AU.core : AU.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
      });
      goldBurst(g, t, 7, 36, { y: sy, sp: 1.0, sq: 0.9, t0: 0.52, a: fade, grav: 0.4 });
      glints(g, t, 9, 8, { t0: 0.52, step: 0.035, w: 1.3, y0: -0.1, h: 1.0, a: fade });
      goldSwirl(g, t, 8, 30, { y0: 0.6, rise: 1.0, rr: 0.7, t0: 0.55, span: 0.3, a: fade });
    },
  },

  /** 희생: 칸 위에서 진홍 · 금빛 사슬이 내려와 Codex 진홍 방패 (paladin-shield, 금 십자 · 짧은 사슬)에 이어지고, 방패가 붉게 한 번 맥동하며
   *  진홍 · 금빛 불씨가 방패 둘레를 돌다 사슬을 타고 위로 빨려 올라감 (피해를 대신 받음) */
  'paladin-sacrifice': {
    frames: 22, logical: 96, size: 320, scope: 'target', // 큰 방패 그림이 또렷하게 320px
    draw(g, { t }) {
      const drop = E.out3(seg(t, 0, 0.28)), fade = 1 - E.in2(seg(t, 0.65, 1)), pulse = bell(t, 0.25, 0.38, 0.65), shY = 0.02;
      glow(g, 0, shY, 1.0, RED.glow, 0.3 * fade + 0.45 * pulse);
      // 사슬 (위에서 방패 위 사슬 고리까지)
      const S0 = 1.3, yEnd = lerp(-1.5, shY - S0 * 0.5, drop), n = 4; // 방패를 크게 (2026-10-19 Lim 「희생에서 방패모양을 더 크게」, 예전 0.72 → 1.3): 사슬은 방패 그림 위 사슬 끝까지
      for (let i = 0; i < n; i++) {
        const y = -1.5 + ((yEnd + 1.5) * (i + 0.5)) / n, sw = Math.sin(i * 0.8 + t * 6) * 0.02;
        link(g, sw, y, 0.16, i % 2 ? 0.15 : 1, fade * (0.55 + 0.45 * (i / n)), i % 2 ? RED : AU);
      }
      // 방패 (그림, 붉게 맥동)
      const s = S0 * (1 + 0.1 * pulse) * E.back(seg(t, 0.12, 0.32));
      glow(g, 0, shY + 0.05, 1.0, RED.glow, 0.85 * pulse);
      if (!pic(g, 'paladin-shield', 0, shY, s, fade, { add: 0.6 * pulse })) {
        g.save(); g.translate(0, shY); g.scale(s / 2, s / 2); solid(g, gg => path.rect(gg, 1.2, 1.6, 0.3), { hi: RED.light, lo: RED.deep, rim: RED.rim, a: fade }); g.restore();
      }
      ringGlow(g, 0, shY + 0.05, lerp(0.45, 1.2, seg(t, 0.28, 0.62)), 0.1, RED.glow, 0.7 * pulse);
      // 진홍 · 금빛 불씨: 방패 둘레를 돌다 사슬을 타고 위로
      particles(g, t, 13, 24, r => ({ t0: 0.25 + r() * 0.3, life: 0.45 + r() * 0.2, a0: r() * TAU, sz: 0.014 + r() * 0.02, c: r() < 0.55, ph: r() * 9 }), (gg, p, age) => {
        const orbit = seg(age, 0, 0.5), up = seg(age, 0.5, 1), ang = p.a0 + orbit * 5, rr = 0.72 * (1 - 0.6 * up);
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

  /** 봉화 (대상 지정 + 회복 + 피해 감소, 2026-10-19 Lim 「봉화에서 파티원 주변 테두리에 원형만 유지하고 (이펙트포함), 화로 같은 이미지는 제거」: 봉화 그릇 그림을 뺌):
   *  흰 섬광과 함께 금빛 고리가 크게 퍼졌다가 칸 둘레 (board.ts 봉화 고리 자리, 칸 반지름 × 1.08)로 조여들어 자리 잡고, 고리 위 꼭짓점 다섯 (맨 아래는 비움)에
   *  손그림 불꽃이 차례로 확 붙어 일렁이며, 금빛 혜성 둘이 고리를 돌고 불티 · 불똥이 고리에서 날아오르고 따뜻한 금빛 가루가 몸으로 내려와 감쌈 */
  'paladin-beacon': {
    frames: 20, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.64, 1)), R = 1.08, close = E.out3(seg(t, 0, 0.3)), rr = lerp(1.55, R, close), lock = bell(t, 0.24, 0.32, 0.6);
      glow(g, 0, 0.1, 1.05, AU.glow, 0.38 * fade);
      glowOval(g, 0, 0.1, 0.85, 1.05, AU.amber, 0.28 * bell(t, 0.15, 0.35, 1));
      glow(g, 0, 0.05, 0.5, '#ffffff', 0.7 * bell(t, 0, 0.05, 0.25));
      // 금빛 고리 (바깥 번짐 + 어두운 테 + 금빛 몸 + 흰 심), 조여들 때 번쩍
      ringGlow(g, 0, 0, rr, 0.12, AU.glow, (0.45 + 0.4 * lock) * fade);
      g.save(); g.lineCap = 'round'; g.globalAlpha = fade * Math.min(1, t * 8);
      g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.lineWidth = 0.075; g.strokeStyle = C(AU.rim, 0.7); g.stroke();
      g.lineWidth = 0.045; g.strokeStyle = C(AU.body, 0.95); g.stroke();
      g.lineWidth = 0.018; g.strokeStyle = C(AU.core, 0.85 + 0.15 * lock); g.stroke();
      g.restore();
      // 고리가 자리 잡는 순간 바깥으로 퍼지는 충격 고리
      { const u = seg(t, 0.28, 0.7); if (u > 0 && u < 1) ringGlow(g, 0, 0, lerp(R, R + 0.45, E.out3(u)), 0.06, AU.light, 0.8 * (1 - u) * fade); }
      // 꼭짓점 다섯에 차례로 붙는 불꽃 (맨 아래 꼭짓점은 비움)
      [0, 1, 2, 4, 5].forEach((i, n) => {
        const a = -Math.PI / 2 + (i * TAU) / 6, x = Math.cos(a) * R, y = Math.sin(a) * R, ig = seg(t, 0.28 + n * 0.05, 0.4 + n * 0.05);
        if (ig <= 0) return;
        const h = (0.3 + 0.12 * bell(ig, 0, 0.3, 1)) * E.back(Math.min(1, ig * 1.4), 2);
        glow(g, x, y, 0.22, FIRE.glow, (0.55 + 0.3 * bell(ig, 0, 0.2, 0.8)) * fade);
        glow(g, x, y - 0.05, 0.1, '#ffffff', 0.8 * bell(ig, 0, 0.1, 0.5) * fade);
        paintedFlame(g, x, y + 0.03, h, 0.95 * fade, t * 26 + i);
        goldBurst(g, t, 20 + i, 8, { x, y: y - 0.05, sp: 0.35, sq: 0.8, t0: 0.28 + n * 0.05, a: fade, col: FIRE.light, grav: -0.2 });
      });
      // 고리를 도는 금빛 혜성 둘
      if (t > 0.3) for (let k = 0; k < 2; k++) {
        const P = s2 => { const a = TAU * (t * 1.5 + k / 2) + (s2 - 1) * 1.0; return { x: Math.cos(a) * R, y: Math.sin(a) * R }; };
        comet(g, P, 0, 1, { w: 0.05, rim: AU.rim, body: AU.body, core: AU.core, glowCol: AU.glow, a: 0.9 * fade, head: 0.8 });
      }
      // 고리에서 날아오르는 불티
      particles(g, t, 5, 44, r => ({ t0: 0.25 + r() * 0.5, life: 0.35 + r() * 0.3, a0: r() * TAU, sz: 0.014 + r() * 0.02, sw: (r() - 0.5) * 0.25, ph: r() * 9 }), (gg, p, age) => {
        const x = Math.cos(p.a0) * R * (1 + 0.12 * age) + p.sw * age + Math.sin(age * 9 + p.ph) * 0.04, y = Math.sin(p.a0) * R - 0.55 * E.out2(age);
        glow(gg, x, y, p.sz * 4, FIRE.glow, 0.5 * (1 - age) * fade);
        speck(gg, x, y, p.sz, age < 0.4 ? FIRE.core : FIRE.light, (1 - age) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
      });
      // 고리에서 몸으로 내려오는 따뜻한 빛 가루 → 몸 둘레 반짝이 가루
      particles(g, t, 9, 26, r => ({ t0: 0.3 + r() * 0.3, life: 0.4, a0: r() * TAU, tx: (r() - 0.5) * 1.0, ty: (r() - 0.5) * 0.8, sz: 0.014 + r() * 0.016 }), (gg, p, age) =>
        speck(gg, lerp(Math.cos(p.a0) * R, p.tx, E.out2(age)), lerp(Math.sin(p.a0) * R, p.ty, E.inOut(age)), p.sz, AU.light, (1 - E.in2(age)) * fade));
      goldSwirl(g, t, 13, 30, { y0: 0.6, rise: 1.0, rr: 0.75, t0: 0.3, span: 0.4, a: fade });
      for (let i = 0; i < 4; i++) { const a = t * 6 + (i * TAU) / 4, b = bell(t, 0.3 + i * 0.04, 0.45 + i * 0.04, 0.95); glint(g, Math.cos(a) * 0.6, 0.15 + Math.sin(a) * 0.27, 0.17 * b, AU.glow, b, a, 0.15, AU.core); }
    },
  },

  /** 봉화 대상 칸 둘레 루프 (Lim 2026-10-18 「봉화대상의 동그란 이미지도 파티클로 루프되게 하여 좀더 고급스럽게」, 예전 fx-ring-beacon 그림 대신):
   *  좌표 1 = 프레임 반, 고리 반지름 RING (board.ts가 고리를 칸 둘레 원에 맞춰 그림). 은은히 숨 쉬는 금빛 고리 위로 작은 불꽃 다섯이 번갈아 일렁이고 (맨 아래 꼭짓점은 비움, 봉화 그릇 그림 없음),
   *  금빛 혜성 셋이 고리를 따라 돌며 불티가 고리에서 위로 날아오르고 반짝이가 톡톡 켜짐. 3초 한 바퀴 */
  'paladin-beacon-loop': {
    frames: 36, fps: 12, loop: true, logical: 62, size: 320, scope: 'target', // 작은 불꽃 여섯이 또렷하게 320px (10-19)
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
        if (i === 3) continue; // 맨 아래 꼭짓점은 비움 (흔들리는 불꽃 · 봉화 그릇 모두 뺌, 2026-10-19 Lim 「원형만 유지하고 (이펙트포함), 화로 같은 이미지는 제거」)
        const a = -Math.PI / 2 + (i * TAU) / 6, x = Math.cos(a) * R, y = Math.sin(a) * R, h = 0.21 + 0.06 * wave(t, 2, i / 6);
        glow(g, x, y, 0.13, FIRE.glow, 0.45);
        paintedFlame(g, x, y + 0.03, h, 0.95, TAU * (t * 3 + i * 0.37)); // 손그림 불꽃 (한 바퀴에 정수 번 일렁임)
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
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 성기사 빛의 성역 돔 (board-sanctuary): 돔 위로 빛 띠가 천천히 훑고 지나가고, 바닥 고리가 퍼지며, 금빛 가루가 돔 안에서 피어올라 꼭대기 · 선돌 끝이 차례로 반짝임 */
  'paladin-sanctuary-loop': {
    frames: 36, fps: 12, loop: true, logical: 84, size: 256, scope: 'target',
    draw(g, { t }) {
      glowOval(g, 0, 0.05, 0.85, 0.85, AU.glow, 0.06 + 0.08 * wave(t, 1));
      // 돔을 훑는 빛 띠 (돔 모양 안에서만)
      g.save(); g.beginPath(); g.ellipse(0, 0.04, 0.88, 0.86, 0, 0, TAU); g.clip();
      const bx = lerp(-1.4, 1.4, frac(t)), gr = g.createLinearGradient(bx - 0.3, 0, bx + 0.3, 0);
      gr.addColorStop(0, C(AU.light, 0)); gr.addColorStop(0.5, C(AU.core, 0.32)); gr.addColorStop(1, C(AU.light, 0));
      g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(bx - 0.3, -1, 0.6, 2.1); g.restore();
      for (const k of [0, 0.5]) { const a = frac(t * 2 + k); ringGlow(g, 0, 0.62, lerp(0.25, 0.74, E.out2(a)), 0.05, AU.glow, 0.35 * (1 - a) * seg(a, 0, 0.1), 0.3); }
      loopRise(g, t, 24, { x0: -0.7, x1: 0.7, y0: 0.6, y1: -0.85, per: 1, sz: 0.035, col: '#ffffff', glowCol: AU.amber, sway: 0.06, seed: 7 });
      loopGlints(g, t, [[0, -0.86], [-0.26, -0.2], [0.32, -0.16], [0, -0.34], [-0.4, 0.1], [0.36, 0.12]], { size: 0.255, col: AU.core, glowCol: AU.glow });
    },
  },
};
/** 봉화 루프 고리 반지름 (프레임 반 = 1). board.ts BEACON_RING과 같게 (tests/pxf.test.ts) */
export const RING = 0.72;
