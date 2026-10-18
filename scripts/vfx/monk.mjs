// 수도사: 비취 · 흰 안개. 흐르는 안개 리본 · 붓 획 같은 기 줄 · 기 구슬 (드루이드 풀빛 · 사제 소생 초록과 다른 푸른 비취 + 흰빛).
// 2026-10-19 Lim 「수도사 · 점성술사 · 결계사도 퀄리티 및 파티클 보강, 전면 개편」 → 「수도사 스킬이펙트가 형편없다. 성기사 방식을 참고해서 전면 수정」:
// 성기사처럼 굵고 또렷한 Codex 그림이 주인공 (크게 · 맞는 순간 더해 번쩍), 흰 섬광 + 충격파 고리, 진한 비취 반짝이 가루를 많이, 384px 프레임
import { asset, bell, bloom, C, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, rng, seg, solid, speck, TAU } from './lib.mjs';

const J = { rim: '#0d3329', deep: '#1d6b55', mid: '#3fae8c', light: '#6fd0b0', pale: '#bff0dc', white: '#f2fff9', glow: '#5fd8b0' };
/** 진한 비취 (성기사 금빛처럼 또렷하게, 2026-10-19) */
const EM = { body: '#22d39a', light: '#7cf2c4', core: '#f4fff9', glow: '#2ee0a2', gold: '#ffe08a' };

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


/** 그림 한 장 (가운데 (x, y), 폭 w, 비율 그대로). 없으면 false (도형으로 대신) */
function pic(g, name, x, y, w, a = 1, { sx = 1, sy = 1, rot = 0, add = 0, anchorY = 0.5, anchorX = 0.5, tint = null } = {}) {
  const img = tint ? tinted(name, tint[0], tint[1]) : asset(name);
  if (!img || a <= 0 || w <= 0) return !!img;
  const h = (w * img.height) / img.width;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.globalAlpha = a;
  g.drawImage(img, -w * anchorX, -h * anchorY, w, h);
  if (add > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * add; g.drawImage(img, -w * anchorX, -h * anchorY, w, h); }
  g.restore();
  return true;
}
/** 그림에 색을 k만큼 입힌 사본 (흰빛이 강한 옛 그림을 비취로, 한 번 만들어 둠) */
const TINTS = {};
function tinted(name, col, k) {
  const key = `${name}|${col}|${k}`, img = asset(name);
  if (!img) return null;
  if (TINTS[key]) return TINTS[key];
  const W = img.width, H = img.height, c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : globalThis.document?.createElement('canvas');
  if (!c) return img;
  c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = k; x.fillStyle = col; x.fillRect(0, 0, W, H);
  return (TINTS[key] = c);
}
/** 그림을 세로 y0 ~ y1에 딱 맞게 늘려 그림 (가로 w, 기 칼날) */
function picSpan(g, name, x, y0, y1, w, a = 1, add = 0) {
  const img = asset(name);
  if (!img || a <= 0) return !!img;
  g.save(); g.globalAlpha = a; g.drawImage(img, x - w / 2, y0, w, y1 - y0);
  if (add > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * add; g.drawImage(img, x - w / 2, y0, w, y1 - y0); }
  g.restore();
  return true;
}
/** 비취 반짝이 가루 소용돌이 (치유 공통, 성기사 금빛 가루처럼 진하게): 발밑 (y0)에서 태어나 돌며 떠오름 */
function jadeSwirl(g, t, seed, n, { y0 = 0.6, rise = 1.15, rr = 0.8, t0 = 0, span = 0.45, a = 1 } = {}) {
  const cols = [EM.light, EM.core, EM.body, EM.gold];
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.013 + r() * 0.024, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: r() < 0.12 ? 3 : Math.floor(r() * 3) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22, al = bell(age, 0, 0.12, 1) * a;
    glow(gg, x, y, p.sz * 4.5, EM.glow, 0.4 * al);
    speck(gg, x, y, p.sz, cols[p.c], al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 사방으로 터지는 비취 불똥 */
function jadeBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.95, sq = 0.75, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.013 + r() * 0.022, ph: r() * 9 }), (gg, p, age) => {
    const d = p.v * E.out3(age), x2 = x + Math.cos(p.ang) * d, y2 = y + Math.sin(p.ang) * d * sq + grav * age * age, al = (1 - E.in2(age)) * a;
    glow(gg, x2, y2, p.sz * 4, EM.glow, 0.4 * al);
    speck(gg, x2, y2, p.sz * (1 - 0.4 * age), age < 0.4 ? EM.core : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 차례로 톡톡 켜지는 큰 반짝임 */
function glints(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.3, h = 0.8, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.08, 0.19 * Math.sin(Math.PI * age), EM.glow, a, p.rot, 0.13, EM.core));
}
/** 흘러가는 안개 알갱이 (방향 dx, dy) */
function mistMotes(g, t, seed, n, { x0 = 0, y0 = 0.5, w = 1.2, h = 0.4, dx = 0.4, dy = -0.2, t0 = 0, span = 0.6, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.4 + r() * 0.3, x: x0 + (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, sz: 0.014 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const x = p.x + dx * E.out2(age) + Math.sin(age * 7 + p.ph) * 0.04, y = p.y + dy * E.out2(age), al = bell(age, 0, 0.15, 1) * a;
    glow(gg, x, y, p.sz * 5, EM.glow, 0.4 * al);
    speck(gg, x, y, p.sz, EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
  });
}
/** 맞는 순간: 흰 섬광 + 진한 비취 번짐 + 퍼지는 충격파 고리 (sy = 고리 납작함) */
function impact(g, t, { x = 0, y = 0, t0 = 0, r = 1.0, sy = 0.85, a = 1 } = {}) {
  const u = seg(t, t0, t0 + 0.45);
  glow(g, x, y, r * 1.05, EM.glow, 0.75 * (1 - E.out2(seg(t, t0, t0 + 0.55))) * a);
  glow(g, x, y, r * 0.5, '#ffffff', 0.9 * bell(t, t0 - 0.02, t0 + 0.03, t0 + 0.28) * a);
  if (u > 0 && u < 1) { ringGlow(g, x, y, lerp(0.2, r * 1.15, E.out3(u)), 0.08, EM.light, 0.85 * (1 - u) * a, sy); ringGlow(g, x, y, lerp(0.1, r * 0.8, E.out3(seg(t, t0 + 0.06, t0 + 0.5))), 0.05, EM.core, 0.6 * (1 - u) * a, sy); }
}
/** 아래로 가는 원뿔 모양이 아니라, y0 ~ y1 사이를 위에서부터 드러내는 세로 가림 */
function clipRows(g, y0, y1) { g.beginPath(); g.rect(-3, y0, 6, y1 - y0); g.clip(); }

export default {
  /** 생기 손바닥 (1초마다 연타 → 14장): 손바닥으로 친 듯 흰 섬광 + 비취 충격파가 터지고, Codex 기 구슬 (monk-orb)이 크게 톡 부풀며 돌았다 작아짐.
   *  기 줄기 여덟 개가 사방으로 뻗어 나가고 비취 불똥이 튀며 반짝이 가루가 떠오름 */
  'monk-palm': {
    frames: 14, logical: 90, size: 384, scope: 'target',
    draw(g, { t }) {
      const pop = t < 0.15 ? E.back(t / 0.15, 1.8) : 1 - E.in2(seg(t, 0.15, 0.62)), fade = 1 - E.in2(seg(t, 0.4, 1));
      impact(g, t, { y: 0, r: 1.0, sy: 0.9 });
      const u = seg(t, 0.02, 0.4);
      if (u > 0 && u < 1) for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + 0.2, r0 = lerp(0.25, 0.95, E.out2(u)), r1 = lerp(0.45, 1.3, E.out3(u));
        lightStroke(g, s => ({ x: Math.cos(a) * lerp(r0, r1, s), y: Math.sin(a) * lerp(r0, r1, s) * 0.9 }), 0, 1, w0 => 0.075 * Math.sin(Math.PI * w0) * (1 - 0.4 * u), { rim: J.rim, body: EM.body, core: EM.core, a: 1 - E.in2(u), rimW: 0.012, glowCol: EM.glow, glowA: 0.7 });
      }
      if (pop > 0.01 && !pic(g, 'monk-orb', 0, 0, 1.25 * pop, Math.min(1, fade * 1.3), { rot: t * 7, add: 0.5 * (1 - seg(t, 0, 0.35)) })) {
        g.save(); g.scale(0.55 * pop, 0.55 * pop); energy(g, gg => { gg.beginPath(); gg.arc(0, 0, 1, 0, TAU); }, { rim: J.rim, body: EM.body, core: EM.core }); g.restore();
      }
      jadeBurst(g, t, 3, 32, { sp: 1.05, sq: 0.85, a: fade, grav: 0.1 });
      glints(g, t, 4, 4, { t0: 0.08, step: 0.05, w: 1.2, y0: 0, h: 1.0, a: fade });
      jadeSwirl(g, t, 5, 18, { y0: 0.55, rise: 0.85, rr: 0.65, t0: 0.15, span: 0.3, a: fade });
    },
  },

  /** 안개 감싸기: 발밑에서 비취 빛이 번쩍이고, Codex 굵은 비취 비단 리본 (monk-ribbon)이 몸을 한 바퀴 휘감듯 앞에서부터 그려지며 위로 올라감.
   *  리본 끝에 불똥이 따라가고, 다 감으면 리본이 조여들며 번쩍 빛나 불똥이 터지고 반짝이 가루가 소용돌이치며 떠오름 */
  'monk-wrap': {
    frames: 22, logical: 96, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.64, 1)), wrap = E.inOut(seg(t, 0, 0.48)), y = lerp(0.5, 0.02, E.inOut(seg(t, 0, 0.7))), squeeze = 1 - 0.12 * E.inOut(seg(t, 0.45, 0.72)), lock = bell(t, 0.45, 0.52, 0.75);
      impact(g, t, { y: 0.55, r: 0.9, sy: 0.32 });
      glow(g, 0, 0.05, 0.95, EM.glow, (0.35 + 0.35 * lock) * fade);
      if (wrap > 0.01) {
        // 앞에서부터 감기며 드러남: 끝 0.35 rad는 점점 옅게 (잘린 모서리가 안 보이게) + 끝에 빛나는 머리
        const A = TAU * wrap * 1.08, F = 0.35, steps = 5, s0 = Math.PI / 2;
        const draw = (a0, a1, al) => {
          if (a1 <= a0 || al <= 0) return;
          g.save(); g.translate(0, y); g.rotate(rad(-14));
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 3, a0, a1); g.closePath(); g.clip();
          if (!pic(g, 'monk-ribbon', 0, 0, 2.4 * squeeze, fade * al, { add: 0.25 + 0.5 * lock })) ringGlow(g, 0, 0, 1.05 * squeeze, 0.12, EM.body, fade * al, 0.45);
          g.restore();
        };
        // 각도 θ (0 ~ A)마다 옅기: 시작 · 끝 F만큼 점점 (다 감으면 시작 쪽은 다시 진하게), 같은 옅기 구간은 한 번에
        const done = seg(A, TAU - 0.5, TAU), end = Math.min(A, TAU), alphaAt = th => Math.min(lerp(Math.min(1, th / F), 1, done), A >= TAU + F ? 1 : Math.min(1, (A - th) / F));
        const cuts = [0, end];
        for (let k = 1; k < steps; k++) cuts.push((F * k) / steps, A - F + (F * k) / steps);
        cuts.push(F, A - F);
        const xs = [...new Set(cuts.filter(v => v >= 0 && v <= end))].sort((p, q) => p - q);
        let runA = null, runAl = 0;
        for (let k = 0; k + 1 < xs.length; k++) {
          const al = Math.round(alphaAt((xs[k] + xs[k + 1]) / 2) * 100) / 100;
          if (runA !== null && al === runAl) continue;
          if (runA !== null) draw(s0 + runA, s0 + xs[k], runAl);
          runA = xs[k]; runAl = al;
        }
        if (runA !== null) draw(s0 + runA, s0 + end, runAl);
        if (A < TAU + 0.2) {
          const ang = s0 + A - F * 0.6, rx = 1.05 * squeeze, ry = 0.47 * squeeze, r = 1 / Math.sqrt((Math.cos(ang) / rx) ** 2 + (Math.sin(ang) / ry) ** 2), px = Math.cos(ang) * r, py = Math.sin(ang) * r, c = Math.cos(rad(-14)), sn = Math.sin(rad(-14));
          const hx = px * c - py * sn, hy = y + px * sn + py * c, ha = fade * (1 - seg(A, TAU - 0.2, TAU + 0.2));
          glow(g, hx, hy, 0.38, EM.glow, 0.85 * ha); glow(g, hx, hy, 0.13, '#ffffff', 0.95 * ha); jadeBurst(g, t, 8, 8, { x: hx, y: hy, sp: 0.28, t0: t - 0.05, a: ha, grav: 0.1 });
        }
      }
      jadeBurst(g, t, 3, 30, { y: 0.05, sp: 1.0, sq: 0.6, t0: 0.47, a: fade, grav: 0.2 });
      mistMotes(g, t, 7, 22, { y0: 0.1, w: 1.8, h: 0.7, dx: 0, dy: -0.6, t0: 0.15, span: 0.55, a: fade });
      jadeSwirl(g, t, 9, 40, { y0: 0.6, rise: 1.15, rr: 0.8, t0: 0.3, span: 0.4, a: fade });
      glints(g, t, 11, 6, { t0: 0.45, step: 0.05, w: 1.6, y0: 0, h: 0.9, a: fade });
    },
  },

  /** 떠도는 안개 (대상 · 옮겨 간 칸): 머리 위에 Codex 비취 상서구름 (monk-xiangyun)이 비취 섬광과 함께 톡 피어나 천천히 흘러가며
   *  반짝이는 안개 방울을 몸 위로 흩뿌리고 (이름 · 체력 줄은 구름이 덮지 않음), 몸을 비취빛이 감싸며 반짝이 가루가 소용돌이쳐 떠오름 */
  'monk-mist': {
    frames: 24, logical: 94, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.72, 1)), cy = -0.86, pop = E.back(seg(t, 0, 0.2), 1.7), cx = lerp(-0.18, 0.18, E.inOut(seg(t, 0, 1)));
      impact(g, t, { x: cx, y: cy, r: 0.85, sy: 0.5 });
      glowOval(g, 0, 0.1, 1.0, 1.0, EM.glow, 0.4 * bell(t, 0.1, 0.35, 0.95));
      // 방울: 구름 아래에서 몸으로 흔들리며 내려앉음
      particles(g, t, 12, 60, r => ({ t0: 0.12 + r() * 0.55, life: 0.35 + r() * 0.25, x: (r() - 0.5) * 1.15, sz: 0.013 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
        const x = cx + p.x + Math.sin(age * 7 + p.ph) * 0.05, y = lerp(cy + 0.15, 0.75, E.in2(age) * 0.4 + age * 0.6), al = bell(age, 0, 0.15, 1) * fade;
        glow(gg, x, y, p.sz * 5, EM.glow, 0.45 * al);
        speck(gg, x, y, p.sz, age < 0.4 ? EM.core : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      if (pop > 0.01) {
        pic(g, 'monk-xiangyun', cx - 0.42, cy + 0.12, 0.7 * pop, 0.85 * fade, { sx: -1, add: 0.3 * (1 - seg(t, 0, 0.3)) });
        if (!pic(g, 'monk-xiangyun', cx + 0.08, cy, 1.4 * pop, fade, { add: 0.5 * (1 - seg(t, 0, 0.3)) + 0.12 * Math.sin(t * 20) ** 2 })) puff(g, cx, cy, 0.6 * pop, fade, 3);
      }
      mistMotes(g, t, 7, 22, { x0: cx, y0: cy, w: 1.6, h: 0.4, dx: 0.45, dy: -0.05, span: 0.6, a: fade });
      jadeSwirl(g, t, 9, 30, { y0: 0.65, rise: 1.0, rr: 0.8, t0: 0.3, span: 0.45, a: fade });
      glints(g, t, 11, 6, { t0: 0.2, step: 0.07, w: 1.4, y0: 0.1, h: 0.9, a: fade });
    },
  },

  /** 안개 숨결 (범위 칸마다): 발밑에서 흰 섬광과 함께 Codex 상서구름 (monk-xiangyun)이 훅 뿜어져 부풀고, 구름 둘이 좌우로 밀려나 옆 칸까지 낮게 깔리며
   *  (이름 · 체력 줄 아래) 안개 물보라가 몸을 타고 피어오르고 비취 불똥 · 반짝이 가루가 퍼짐 */
  'monk-breath': {
    frames: 20, logical: 84, size: 384, scope: 'area',
    draw(g, { t }) {
      const u = E.out3(seg(t, 0, 0.6)), fade = 1 - E.in2(seg(t, 0.55, 1)), fy = 0.88;
      impact(g, t, { y: fy - 0.05, r: 0.95, sy: 0.35 });
      glowOval(g, 0, fy - 0.1, 1.2, 0.35, EM.glow, 0.55 * bell(t, 0, 0.2, 0.9));
      pic(g, 'monk-xiangyun', 0, fy, lerp(0.7, 1.35, u), 1 - E.out2(seg(t, 0.1, 0.55)), { add: 0.5 * (1 - u) });
      for (const sgn of [-1, 1]) pic(g, 'monk-xiangyun', sgn * lerp(0.15, 0.85, u), fy - 0.02, lerp(0.7, 1.1, u), fade, { sx: sgn, add: 0.25 * (1 - u) });
      // 발밑에서 피어오르는 안개 물보라
      particles(g, t, 8, 46, r => ({ t0: r() * 0.4, life: 0.4 + r() * 0.25, x: (r() - 0.5) * 1.7, sz: 0.013 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
        const x = p.x * (1 + 0.3 * age) + Math.sin(age * 6 + p.ph) * 0.06, y = fy - 0.1 - 1.15 * E.out2(age), al = bell(age, 0, 0.15, 1) * fade;
        glow(gg, x, y, p.sz * 5, EM.glow, 0.45 * al); speck(gg, x, y, p.sz, age < 0.35 ? EM.core : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
      });
      jadeBurst(g, t, 3, 22, { y: fy - 0.1, sp: 1.0, sq: 0.35, a: fade, grav: -0.2 });
      glints(g, t, 6, 4, { t0: 0.15, step: 0.07, w: 1.4, y0: 0.2, h: 1.0, a: fade });
    },
  },

  /** 맑은 기운 (해제): Codex 비취 기 칼날 (monk-chi-blade) 셋이 머리 위에서 발밑까지 차례로 번쩍 내리그어지고 (빛나는 끝이 앞장섬),
   *  어두운 기운 (paladin-taint 그림)이 아래로 씻겨 내려가 비취 불똥으로 부서지며 흰 섬광 · 반짝이 가루가 퍼짐 */
  'monk-clear': {
    frames: 18, logical: 94, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), top = -1.15, bot = 1.1;
      impact(g, t, { y: 0.05, t0: 0.12, r: 0.95, sy: 0.9 });
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.5, d = i === 1 ? 0 : 0.07 + 0.03 * i, down = E.out3(seg(t, d, d + 0.25)), up = E.in2(seg(t, d + 0.32, d + 0.72)), W = i === 1 ? 0.62 : 0.5;
        const y0 = lerp(top, bot, up), y1 = lerp(top, bot, down);
        if (y1 > y0 + 0.01) {
          g.save(); clipRows(g, y0, y1);
          if (!picSpan(g, 'monk-chi-blade', x, top, bot, W, fade, 0.45 * (1 - seg(t, d + 0.1, d + 0.5)))) brush(g, s => ({ x, y: lerp(top, bot, s) }), 0, 1, 0.14, fade);
          g.restore();
        }
        if (down < 1) { glow(g, x, y1, 0.32, EM.glow, 0.9 * fade); glow(g, x, y1, 0.12, '#ffffff', fade); }
      }
      // 씻겨 나가는 어두운 기운 → 비취 불똥
      particles(g, t, 3, 6, (r, i) => ({ t0: 0.1 + i * 0.05, life: 0.55, x: (r() - 0.5) * 1.1, sz: 0.14 + r() * 0.06, rot: r() * 6 }), (gg, p, age) => {
        const y = 0.0 + 0.9 * E.out2(age), x = p.x * (1 + 0.6 * age), k = 1 - E.in2(seg(age, 0.4, 1));
        if (k > 0 && !pic(gg, 'paladin-taint', x, y, p.sz * 1.6 * k, k * 0.95, { rot: p.rot + age * 3 })) bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * k, 0, TAU); }, '#6a3a90', 0.5 * k, 4);
        if (age > 0.4) for (let j = 0; j < 6; j++) { const q = seg(age, 0.4, 1), b2 = p.rot + j * 1.05; speck(gg, x + Math.cos(b2) * 0.16 * q, y + Math.sin(b2) * 0.16 * q, 0.016, EM.light, (1 - q) * fade); }
      });
      jadeBurst(g, t, 5, 30, { y: 0.0, sp: 1.0, sq: 0.9, t0: 0.12, a: fade });
      glints(g, t, 6, 6, { t0: 0.15, step: 0.05, w: 1.4, y0: 0, h: 1.2, a: fade });
      jadeSwirl(g, t, 7, 26, { y0: 0.6, rise: 1.0, rr: 0.75, t0: 0.3, span: 0.35, a: fade });
    },
  },

  /** 누그러뜨림 (받는 피해 감소): 몸을 고요한 비취 기운이 감싸고, Codex 굵은 비취 물결 (monk-wave-bold) 둘이 머리 위 · 발밑 (이름 · 체력 줄을 가로지르지 않게)에서
   *  크게 출렁이다 점점 잦아들어 곧게 펴지며 빛나고, 빛 점이 천천히 가라앉고 반짝임이 톡톡 켜짐 */
  'monk-soothe': {
    frames: 24, logical: 96, size: 384, scope: 'target',
    draw(g, { t }) {
      const calm = E.inOut(seg(t, 0.05, 0.72)), fade = 1 - E.in2(seg(t, 0.66, 1)), run = E.out3(seg(t, 0, 0.22)), still = bell(t, 0.6, 0.7, 0.9);
      impact(g, t, { y: 0.05, r: 1.0, sy: 0.9 });
      glowOval(g, 0, 0.05, 1.05, 0.95, EM.glow, (0.4 + 0.2 * still) * bell(t, 0, 0.3, 1));
      for (const [y, w, k, ph] of [[-0.7, 2.2, 1, 0], [0.9, 2.0, 0.85, 1.6]]) {
        const sy = lerp(1.15, 0.18, calm) * (0.92 + 0.08 * Math.sin(t * 14 + ph)), a = fade * k;
        g.save(); g.beginPath(); g.rect(-w / 2 * run, y - 0.7, w * run, 1.4); g.clip();
        if (!pic(g, 'monk-wave-bold', 0, y, w, a, { sy, add: 0.2 + 0.4 * still })) brush(g, s2 => ({ x: lerp(-w / 2, w / 2, s2), y: y + Math.sin(s2 * TAU * 1.5) * 0.12 * sy }), 0, 1, 0.08, a);
        g.restore();
      }
      particles(g, t, 4, 40, r => ({ t0: 0.1 + r() * 0.55, life: 0.45, x: (r() - 0.5) * 1.9, y: -0.75 + r() * 0.5, sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => { const y = p.y + 0.6 * E.out2(age), al = bell(age, 0, 0.2, 1) * fade; glow(gg, p.x, y, p.sz * 4, EM.glow, 0.35 * al); speck(gg, p.x, y, p.sz, EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 12)); });
      glints(g, t, 6, 8, { t0: 0.4, step: 0.05, w: 1.7, y0: 0.1, h: 1.0, a: fade });
      jadeSwirl(g, t, 8, 20, { y0: 0.6, rise: 0.9, rr: 0.7, t0: 0.5, span: 0.3, a: fade });
    },
  },

  /** 되살림 바람 (파티 전원): 비취 섬광과 함께 비취로 물들인 Codex 붓 바람 (monk-wind)이 왼쪽 아래에서 오른쪽 위로 휙 지나가며 번쩍이고 (오래 덮지 않음),
   *  비취로 물들인 Codex 꽃잎 (monk-petal)이 바람을 타고 흩날리며 비취 불똥이 바람 방향으로 쏘아지고 반짝이 가루가 소용돌이침. 파티 전원 칸이라 적당히 */
  'monk-wind': {
    frames: 20, logical: 84, size: 384, scope: 'party',
    draw(g, { t }) {
      const run = E.inOut(seg(t, 0, 0.72)), fade = 1 - E.in2(seg(t, 0.5, 1)), wa = bell(t, 0, 0.12, 0.74);
      impact(g, t, { y: 0.05, r: 0.85, sy: 0.85 });
      const wx = lerp(-0.6, 0.55, run), wy = lerp(0.55, -0.5, run);
      glowOval(g, wx, wy, 0.95, 0.5, EM.glow, 0.6 * wa, true, rad(-40));
      if (!pic(g, 'monk-wind', wx, wy, 1.75, wa, { tint: [EM.body, 0.22], add: 0.5 * bell(t, 0.05, 0.22, 0.5) })) brush(g, s => ({ x: lerp(-0.9, 0.6, s), y: lerp(0.7, -0.6, s) }), 0, 1, 0.14, wa);
      particles(g, t, 2, 10, (r, i) => ({ t0: 0.03 + i * 0.04, life: 0.6, x0: -0.85 + r() * 0.35, y0: 0.7 - r() * 0.35, rot: r() * 6, sz: 0.2 + r() * 0.1 }), (gg, p, age) => {
        const x = p.x0 + 1.6 * E.out2(age), y = p.y0 - 1.4 * E.out2(age) + Math.sin(age * 8 + p.rot) * 0.08;
        const al = (1 - E.in2(age)) * fade; glow(gg, x, y, p.sz * 0.6, EM.glow, 0.5 * al);
        if (!pic(gg, 'monk-petal', x, y, p.sz, al, { rot: p.rot + age * 6, tint: [EM.light, 0.55], add: 0.3 })) speck(gg, x, y, 0.03, '#ffffff', al);
      });
      particles(g, t, 4, 34, r => ({ t0: r() * 0.45, life: 0.3 + r() * 0.2, x: -0.95 + r() * 0.7, y: 0.75 - r() * 0.45, sz: 0.012 + r() * 0.018, ph: r() * 9 }), (gg, p, age) => { const x = p.x + 1.5 * E.out2(age), y = p.y - 1.35 * E.out2(age), al = (1 - age) * fade; glow(gg, x, y, p.sz * 4, EM.glow, 0.45 * al); speck(gg, x, y, p.sz, age < 0.4 ? EM.core : EM.light, al, age * 4); });
      jadeSwirl(g, t, 5, 20, { y0: 0.55, rise: 0.95, rr: 0.65, t0: 0.2, span: 0.35, a: fade });
      glints(g, t, 7, 4, { t0: 0.25, step: 0.07, w: 1.3, y0: -0.2, h: 0.9, a: fade });
    },
  },

  /** 차 한 잔 (내 칸, 마나 · 기 리듬): 발밑에 Codex 비취 찻잔 (monk-teacup)이 톡 놓이며 비취빛이 번쩍이고, 굵은 찻김 세 줄이 S자로 피어올라 위에서 흩어지며
   *  하늘빛 마나 알갱이 · 비취 반짝이가 김을 타고 잔뜩 오르고 몸이 은은히 빛남 */
  'monk-tea': {
    frames: 24, logical: 92, size: 384, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.6), fade = 1 - E.in2(seg(t, 0.7, 1)), cy = 0.78;
      impact(g, t, { y: cy + 0.15, t0: 0.12, r: 0.8, sy: 0.32 });
      glow(g, 0, 0.05, 0.95, EM.glow, 0.4 * bell(t, 0, 0.2, 0.85));
      for (const [x0, ph, d] of [[-0.14, 0, 0.1], [0.04, 2.2, 0.16], [0.18, 4.1, 0.22]]) {
        const u = seg(t, d, d + 0.62), P = s => ({ x: x0 * 0.8 + Math.sin(s * 5.5 + ph + t * 4) * 0.12, y: lerp(cy - 0.15, cy - 1.55, s) });
        if (u > 0) {
          lightStroke(g, P, Math.max(0, u - 0.55), u, w0 => 0.075 * Math.sin(Math.PI * w0), { rim: '#5f9a88', body: EM.light, core: '#ffffff', a: fade * 0.8 * (1 - seg(u, 0.7, 1)), rimW: 0.01, glowCol: EM.glow, glowA: 0.7 });
          const q = P(u); bloom(g, h => { h.beginPath(); h.arc(q.x, q.y, 0.16, 0, TAU); }, J.pale, 0.35 * fade * (1 - seg(u, 0.7, 1)), 5);
        }
      }
      if (pop > 0 && !pic(g, 'monk-teacup', 0, cy + 0.36, 0.78 * pop, fade, { anchorY: 0.92, add: 0.35 * bell(t, 0.05, 0.15, 0.4) })) {
        g.save(); g.translate(0, cy); g.scale(0.45 * pop, 0.45 * pop); solid(g, h => path.rect(h, 1.5, 0.9, 0.3), { hi: J.pale, lo: J.deep, rim: J.rim, a: fade }); g.restore();
      }
      particles(g, t, 9, 40, r => ({ t0: 0.12 + r() * 0.5, life: 0.45 + r() * 0.2, x: (r() - 0.5) * 0.6, sz: 0.013 + r() * 0.02, ph: r() * 9, mana: r() < 0.45 }), (gg, p, age) => {
        const x = p.x + Math.sin(age * 6 + p.ph) * 0.12, y = cy - 0.15 - 1.2 * E.out2(age), al = bell(age, 0, 0.15, 1) * fade;
        glow(gg, x, y, p.sz * 5, p.mana ? '#6aa8ff' : EM.glow, 0.45 * al);
        speck(gg, x, y, p.sz, p.mana ? '#d8ecff' : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
      });
      glints(g, t, 11, 5, { t0: 0.18, step: 0.08, w: 1.0, y0: -0.2, h: 1.0, a: fade });
    },
  },
};
