// 수도사: 비취 · 흰 안개. 흐르는 안개 리본 · 붓 획 같은 기 줄 · 기 구슬 (드루이드 풀빛 · 사제 소생 초록과 다른 푸른 비취 + 흰빛).
// 2026-10-19 Lim 「수도사 · 점성술사 · 결계사도 퀄리티 및 파티클 보강, 전면 개편」 → 「수도사 스킬이펙트가 형편없다. 성기사 방식을 참고해서 전면 수정」:
// 성기사처럼 굵고 또렷한 Codex 그림이 주인공 (크게 · 맞는 순간 더해 번쩍), 흰 섬광 + 충격파 고리, 진한 비취 반짝이 가루를 많이, 384px 프레임
// → 2026-10-19 Lim 「수도사도 이미지를 사용하지 말고 이펙트로 손바닥을 제외한 모든 스킬을 재생성」: 손바닥 (기 구슬 그림)만 그림, 나머지는 코드로 그린 빛 띠 · 안개 · 충격파 · 파티클만, 칸 가득
import { asset, bell, bez, bloom, C, E, energy, glint, glow, glowOval, lerp, lightStroke, loopGlints, loopOrbit, loopRise, particles, path, rad, ringGlow, rng, seg, solid, speck, TAU, wave } from './lib.mjs';

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
function pic(g, name, x, y, w, a = 1, { sx = 1, sy = 1, rot = 0, add = 0, anchorY = 0.5, anchorX = 0.5 } = {}) {
  const img = asset(name);
  if (!img || a <= 0 || w <= 0) return !!img;
  const h = (w * img.height) / img.width;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.globalAlpha = a;
  g.drawImage(img, -w * anchorX, -h * anchorY, w, h);
  if (add > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * add; g.drawImage(img, -w * anchorX, -h * anchorY, w, h); }
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
/** 기 띠 (굵은 비취 빛 띠, 양끝 가늘게): 경로 P의 s0 ~ s1 */
function chi(g, P, s0, s1, w, a = 1, body = EM.body) {
  if (s1 <= s0 + 1e-3 || a <= 0) return;
  lightStroke(g, P, s0, s1, u => w * Math.sin(Math.PI * u) ** 0.7, { rim: J.rim, body, core: EM.core, a, rimW: 0.018, coreW: 0.42, glowCol: EM.glow, glowA: 0.75 });
}
/** 빛나는 머리 (띠 끝) */
function head(g, x, y, a = 1, r = 0.3) { glow(g, x, y, r, EM.glow, 0.85 * a); glow(g, x, y, r * 0.4, '#ffffff', 0.9 * a); }

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

  /** 안개 감싸기 (2026-10-19 그림 없이): 발밑 비취 섬광과 함께 굵은 기 띠 둘이 나선으로 몸을 휘감아 오르며 (빛나는 머리 · 띠를 따라 안개 뭉치가 피어남),
   *  다 감으면 조여들며 번쩍 · 충격파 고리가 퍼지고 불똥이 터지며 반짝이 가루가 소용돌이쳐 떠오름 */
  'monk-wrap': {
    frames: 22, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.66, 1)), hd = E.inOut(seg(t, 0, 0.55)), tl = Math.max(0, hd - 0.62) + 0.38 * E.in2(seg(t, 0.55, 0.95)), lock = bell(t, 0.5, 0.58, 0.8), sq = 1 - 0.14 * E.inOut(seg(t, 0.5, 0.7));
      impact(g, t, { y: 0.85, r: 1.0, sy: 0.32 });
      glowOval(g, 0, 0.05, 1.0, 1.1, EM.glow, (0.25 + 0.35 * lock) * fade);
      for (const side of [0, Math.PI]) {
        const P = s2 => { const an = side + s2 * TAU * 1.4; return { x: Math.cos(an) * 0.95 * sq, y: lerp(0.95, -0.9, s2) + Math.sin(an) * 0.24 }; };
        for (let k = 0; k < 6; k++) { const q = P(lerp(tl, hd, (k + 0.5) / 6)); puff(g, q.x, q.y, 0.24, 0.32 * fade, k + (side ? 10 : 0)); }
        chi(g, P, tl, hd, 0.14, 0.95 * fade);
        if (hd < 1) { const q = P(hd); head(g, q.x, q.y, fade, 0.34); jadeBurst(g, t, side ? 21 : 22, 6, { x: q.x, y: q.y, sp: 0.3, t0: t - 0.05, a: fade, grav: 0.1 }); }
      }
      impact(g, t, { y: 0, t0: 0.55, r: 1.2, sy: 0.9 });
      jadeBurst(g, t, 3, 44, { y: 0.05, sp: 1.35, sq: 0.8, t0: 0.55, a: fade, grav: 0.2 });
      mistMotes(g, t, 7, 30, { y0: 0.1, w: 2.0, h: 1.0, dx: 0, dy: -0.7, t0: 0.15, span: 0.55, a: fade });
      jadeSwirl(g, t, 9, 44, { y0: 0.75, rise: 1.4, rr: 1.0, t0: 0.3, span: 0.4, a: fade });
      glints(g, t, 11, 8, { t0: 0.5, step: 0.05, w: 2.0, y0: 0, h: 1.8, a: fade });
    },
  },

  /** 떠도는 안개 (대상 · 옮겨 간 칸, 그림 없이): 머리 위에 비취빛 안개 뭉치 다섯이 차례로 톡톡 피어나 칸만 한 구름이 되어 흘러가며 반짝이는 안개 방울을 몸 위로 쏟고,
   *  구름 밑이 비취로 빛나고 몸을 비취빛이 감싸며 반짝이 가루가 소용돌이쳐 떠오름 (이름 · 체력 줄은 구름이 안 덮음) */
  'monk-mist': {
    frames: 24, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.72, 1)), cy = -0.88, drift = lerp(-0.12, 0.16, E.inOut(t));
      impact(g, t, { x: drift, y: cy, r: 1.0, sy: 0.45 });
      glowOval(g, drift, cy + 0.12, 1.05, 0.32, EM.glow, 0.5 * bell(t, 0.05, 0.3, 0.9));
      glowOval(g, 0, 0.1, 1.0, 1.0, EM.glow, 0.35 * bell(t, 0.1, 0.35, 0.95));
      particles(g, t, 12, 70, r => ({ t0: 0.12 + r() * 0.55, life: 0.35 + r() * 0.25, x: (r() - 0.5) * 1.7, sz: 0.016 + r() * 0.024, ph: r() * 9 }), (gg, p, age) => {
        const x = drift + p.x + Math.sin(age * 7 + p.ph) * 0.05, y = lerp(cy + 0.2, 0.85, E.in2(age) * 0.4 + age * 0.6), al = bell(age, 0, 0.15, 1) * fade;
        glow(gg, x, y, p.sz * 5, EM.glow, 0.45 * al);
        speck(gg, x, y, p.sz, age < 0.4 ? EM.core : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      [[-0.68, 0.06, 0.32], [-0.3, -0.06, 0.42], [0.1, 0.02, 0.46], [0.48, -0.04, 0.4], [0.8, 0.08, 0.3]].forEach(([dx, dy, r0], i) => {
        const pop = E.back(seg(t, i * 0.05, i * 0.05 + 0.18), 1.8) * (1 - E.in2(seg(t, 0.62 + i * 0.03, 0.95)));
        if (pop > 0.01) { glow(g, drift + dx, cy + dy, r0 * 1.3, EM.glow, 0.35 * pop); puff(g, drift + dx, cy + dy + Math.sin(t * 6 + i) * 0.03, r0 * pop, 0.9 * fade, i + 3, 0.6); }
      });
      mistMotes(g, t, 7, 30, { x0: drift, y0: cy, w: 2.0, h: 0.5, dx: 0.5, dy: -0.05, span: 0.6, a: fade });
      jadeSwirl(g, t, 9, 40, { y0: 0.75, rise: 1.3, rr: 1.0, t0: 0.3, span: 0.45, a: fade });
      glints(g, t, 11, 8, { t0: 0.2, step: 0.06, w: 2.0, y0: 0, h: 1.6, a: fade });
    },
  },

  /** 안개 숨결 (범위 칸마다, 그림 없이): 발밑에서 흰 섬광과 함께 안개가 훅 뿜어져 크게 부풀고, 안개 뭉치들이 좌우로 밀려나 옆 칸까지 낮게 깔리며 (이름 · 체력 줄 아래)
   *  안개 물보라가 몸을 타고 피어오르고 비취 불똥 · 반짝이 가루가 퍼짐 */
  'monk-breath': {
    frames: 20, logical: 84, size: 384, scope: 'area',
    draw(g, { t }) {
      const u = E.out3(seg(t, 0, 0.6)), fade = 1 - E.in2(seg(t, 0.55, 1)), fy = 0.88;
      impact(g, t, { y: fy - 0.05, r: 0.95, sy: 0.32 });
      glowOval(g, 0, fy - 0.1, 1.2, 0.35, EM.glow, 0.55 * bell(t, 0, 0.2, 0.9));
      puff(g, 0, fy - 0.05, lerp(0.3, 0.75, u), (1 - E.out2(seg(t, 0.15, 0.6))) * 0.95, 2, 0.5);
      for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) { const d = lerp(0.1, 0.45 + 0.28 * k, u); puff(g, sgn * d, fy - 0.02 - 0.05 * k, lerp(0.2, 0.42 - 0.06 * k, u), fade * (0.9 - 0.15 * k), 5 + k + (sgn > 0 ? 4 : 0), 0.5); }
      particles(g, t, 8, 54, r => ({ t0: r() * 0.4, life: 0.4 + r() * 0.25, x: (r() - 0.5) * 1.7, sz: 0.016 + r() * 0.024, ph: r() * 9 }), (gg, p, age) => {
        const x = p.x * (1 + 0.3 * age) + Math.sin(age * 6 + p.ph) * 0.06, y = fy - 0.1 - 1.2 * E.out2(age), al = bell(age, 0, 0.15, 1) * fade;
        glow(gg, x, y, p.sz * 5, EM.glow, 0.45 * al); speck(gg, x, y, p.sz, age < 0.35 ? EM.core : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
      });
      jadeBurst(g, t, 3, 28, { y: fy - 0.1, sp: 1.0, sq: 0.35, a: fade, grav: -0.2 });
      glints(g, t, 6, 5, { t0: 0.15, step: 0.07, w: 1.6, y0: 0.2, h: 1.1, a: fade });
    },
  },

  /** 맑은 기운 (해제, 그림 없이): 비취 기 칼날 셋이 머리 위에서 발밑까지 빛나는 끝을 앞세워 차례로 번쩍 내리그어지고 위부터 사라지며,
   *  어두운 기운 덩이들이 튕겨 나가 비취 불똥으로 부서지고 흰 섬광 · 충격파 · 반짝이 가루가 퍼짐 */
  'monk-clear': {
    frames: 18, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), top = -1.2, bot = 1.12;
      impact(g, t, { y: 0.05, t0: 0.12, r: 1.15, sy: 0.9 });
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.55, d = i === 1 ? 0 : 0.07 + 0.03 * i, down = E.out3(seg(t, d, d + 0.25)), up = E.in2(seg(t, d + 0.32, d + 0.72)), w = i === 1 ? 0.22 : 0.17;
        const P = s2 => ({ x: x + Math.sin(s2 * Math.PI) * 0.06 * (i - 1), y: lerp(top, bot, s2) });
        chi(g, P, up, down, w, fade);
        if (down < 1) { const q = P(down); head(g, q.x, q.y, fade, 0.36); }
      }
      particles(g, t, 3, 7, (r, i) => ({ t0: 0.1 + i * 0.04, life: 0.6, a: rad(-170 + i * 52 + r() * 20), sz: 0.1 + r() * 0.05, ph: r() * 9 }), (gg, p, age) => {
        const dd = 0.2 + 1.0 * E.out3(age), x = Math.cos(p.a) * dd, y = 0.05 + Math.sin(p.a) * dd * 0.85 + 0.3 * age * age, k = 1 - E.in2(seg(age, 0.35, 1));
        if (k > 0) { bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * k, 0, TAU); }, '#4a2a70', 0.75 * k * fade, 5); bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 0.55 * k, 0, TAU); }, '#1a0e2a', 0.8 * k * fade, 2); }
        if (age > 0.35) for (let j = 0; j < 6; j++) { const q = seg(age, 0.35, 1), b2 = p.ph + j * 1.05; speck(gg, x + Math.cos(b2) * 0.2 * q, y + Math.sin(b2) * 0.2 * q, 0.022, EM.light, (1 - q) * fade); }
      });
      jadeBurst(g, t, 5, 44, { y: 0.05, sp: 1.35, sq: 0.9, t0: 0.12, a: fade });
      glints(g, t, 6, 9, { t0: 0.15, step: 0.05, w: 2.0, y0: 0, h: 1.9, a: fade });
      jadeSwirl(g, t, 7, 36, { y0: 0.75, rise: 1.3, rr: 1.0, t0: 0.3, span: 0.35, a: fade });
    },
  },

  /** 누그러뜨림 (받는 피해 감소, 그림 없이): 몸을 고요한 비취 기운이 감싸고, 머리 위 · 발밑 (이름 · 체력 줄을 가로지르지 않게)에 굵은 비취 물결 띠가 칸 폭으로 그어져
   *  크게 출렁이다 점점 잦아들어 곧게 펴지며 번쩍 빛나고, 빛 점이 천천히 가라앉고 반짝임이 톡톡 켜짐 */
  'monk-soothe': {
    frames: 24, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const calm = E.inOut(seg(t, 0.05, 0.72)), fade = 1 - E.in2(seg(t, 0.66, 1)), run = E.out3(seg(t, 0, 0.25)), still = bell(t, 0.6, 0.7, 0.9);
      impact(g, t, { y: 0.05, r: 1.15, sy: 0.9 });
      glowOval(g, 0, 0.05, 1.1, 1.0, EM.glow, (0.35 + 0.25 * still) * bell(t, 0, 0.3, 1));
      for (const [y0, k, ph] of [[-0.82, 1, 0], [0.95, 0.9, 1.7]]) {
        const amp = lerp(0.24, 0.015, calm), P = s2 => ({ x: lerp(-1.1, 1.1, s2), y: y0 + Math.sin(s2 * TAU * 2 + ph + t * 9) * amp * Math.sin(Math.PI * s2) });
        glowOval(g, 0, y0, 1.1, 0.18, EM.glow, 0.35 * still * fade);
        chi(g, P, 0, run, 0.13 + 0.03 * still, k * fade, still > 0.3 ? EM.light : EM.body);
        chi(g, s2 => ({ x: P(s2).x, y: P(s2).y + 0.11 }), 0, run * 0.9, 0.06, 0.6 * k * fade, J.mid);
        if (run < 1) { const q = P(run); head(g, q.x, q.y, fade, 0.28); }
      }
      particles(g, t, 4, 54, r => ({ t0: 0.1 + r() * 0.55, life: 0.45, x: (r() - 0.5) * 2.0, y: -0.8 + r() * 0.5, sz: 0.016 + r() * 0.024, ph: r() * 9 }), (gg, p, age) => { const y = p.y + 0.7 * E.out2(age), al = bell(age, 0, 0.2, 1) * fade; glow(gg, p.x, y, p.sz * 4, EM.glow, 0.4 * al); speck(gg, p.x, y, p.sz, EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 12)); });
      glints(g, t, 6, 9, { t0: 0.4, step: 0.05, w: 2.0, y0: 0.05, h: 1.7, a: fade });
      jadeSwirl(g, t, 8, 30, { y0: 0.75, rise: 1.2, rr: 0.95, t0: 0.5, span: 0.3, a: fade });
    },
  },

  /** 되살림 바람 (파티 전원, 그림 없이): 비취 섬광과 함께 굵은 바람 띠 셋이 왼쪽 아래에서 오른쪽 위로 휙 쓸어 올라가며 끝이 둥글게 말리고 (빛나는 머리),
   *  비취 꽃잎 빛 · 불똥이 바람을 타고 날리며 반짝이 가루가 소용돌이침. 파티 전원 칸이라 적당히 */
  'monk-wind': {
    frames: 20, logical: 84, size: 384, scope: 'party',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.5, 1));
      impact(g, t, { y: 0.05, r: 0.9, sy: 0.85 });
      [[0, 0.95, 0.12], [-0.22, 0.6, 0.09], [0.24, 0.6, 0.08]].forEach(([off, sc, w], i) => {
        const d = i * 0.06, hd = E.out2(seg(t, d, d + 0.5)), tl = E.in2(seg(t, d + 0.22, d + 0.75));
        const base = bez([-0.95 + off, 0.75 + off * 0.5], [-0.3 + off, 0.5], [0.15 + off, -0.4], [0.6 + off * 0.5, -0.55]);
        const P = s2 => { if (s2 < 0.8) return base(s2 / 0.8); const c = base(1), q = (s2 - 0.8) / 0.2, an = -Math.PI / 2 + q * TAU * 0.8, rr = 0.22 * sc * (1 - 0.5 * q); return { x: c.x + Math.cos(an) * rr, y: c.y - rr + Math.sin(an) * rr + rr }; };
        chi(g, P, tl, hd, w, fade, i ? EM.light : EM.body);
        if (hd > tl + 0.02 && hd < 1) { const q = P(hd); head(g, q.x, q.y, fade, 0.26); }
      });
      particles(g, t, 2, 14, (r, i) => ({ t0: 0.03 + i * 0.03, life: 0.6, x0: -0.9 + r() * 0.4, y0: 0.75 - r() * 0.35, rot: r() * 6, sz: 0.06 + r() * 0.04 }), (gg, p, age) => {
        const x = p.x0 + 1.6 * E.out2(age), y = p.y0 - 1.4 * E.out2(age) + Math.sin(age * 8 + p.rot) * 0.08, al = (1 - E.in2(age)) * fade;
        glow(gg, x, y, p.sz * 2.5, EM.glow, 0.5 * al);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 7); gg.scale(p.sz, p.sz); solid(gg, h => path.petal(h), { hi: EM.core, lo: EM.body, rim: J.rim, rimW: 0.1, a: al, shine: 0.6 }); gg.restore();
      });
      particles(g, t, 4, 40, r => ({ t0: r() * 0.45, life: 0.3 + r() * 0.2, x: -0.95 + r() * 0.7, y: 0.75 - r() * 0.45, sz: 0.016 + r() * 0.022, ph: r() * 9 }), (gg, p, age) => { const x = p.x + 1.5 * E.out2(age), y = p.y - 1.35 * E.out2(age), al = (1 - age) * fade; glow(gg, x, y, p.sz * 4, EM.glow, 0.45 * al); speck(gg, x, y, p.sz, age < 0.4 ? EM.core : EM.light, al, age * 4); });
      jadeSwirl(g, t, 5, 26, { y0: 0.6, rise: 1.05, rr: 0.75, t0: 0.2, span: 0.35, a: fade });
      glints(g, t, 7, 5, { t0: 0.25, step: 0.07, w: 1.6, y0: -0.2, h: 1.2, a: fade });
    },
  },

  /** 차 한 잔 (내 칸, 마나 · 기 리듬, 그림 없이): 발밑에 비취 찻잔 테 (두 겹 빛 고리)와 찻물 빛이 톡 맺히며 번쩍이고, 굵은 찻김 세 줄이 S자로 크게 피어올라 위에서 안개로 흩어지며
   *  하늘빛 마나 알갱이 · 비취 반짝이가 김을 타고 잔뜩 오르고 몸이 은은히 빛남 */
  'monk-tea': {
    frames: 24, logical: 100, size: 384, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.6), fade = 1 - E.in2(seg(t, 0.7, 1)), cy = 0.88;
      impact(g, t, { y: cy, t0: 0.08, r: 0.9, sy: 0.32 });
      glowOval(g, 0, 0.05, 1.0, 1.0, EM.glow, 0.35 * bell(t, 0, 0.2, 0.85));
      glowOval(g, 0, cy, 0.62 * pop, 0.2 * pop, '#c8f0a0', 0.7 * fade);
      ringGlow(g, 0, cy, 0.62 * pop, 0.07, EM.light, 0.95 * fade, 0.32);
      ringGlow(g, 0, cy, 0.45 * pop, 0.04, EM.gold, 0.8 * fade, 0.32);
      for (const [x0, ph, d] of [[-0.26, 0, 0.08], [0.02, 2.2, 0.14], [0.28, 4.1, 0.2]]) {
        const u = seg(t, d, d + 0.62), P = s2 => ({ x: x0 + Math.sin(s2 * 5.5 + ph + t * 4) * 0.16, y: lerp(cy - 0.05, cy - 2.05, s2) });
        if (u > 0) {
          chi(g, P, Math.max(0, u - 0.55), u, 0.12, fade * 0.9 * (1 - seg(u, 0.75, 1)), J.pale);
          const q = P(u); puff(g, q.x, q.y, 0.2 + 0.15 * u, 0.45 * fade * (1 - seg(u, 0.7, 1)), Math.round(ph * 3), 0.6);
        }
      }
      particles(g, t, 9, 54, r => ({ t0: 0.12 + r() * 0.5, life: 0.45 + r() * 0.2, x: (r() - 0.5) * 0.9, sz: 0.016 + r() * 0.024, ph: r() * 9, mana: r() < 0.45 }), (gg, p, age) => {
        const x = p.x + Math.sin(age * 6 + p.ph) * 0.14, y = cy - 0.1 - 1.8 * E.out2(age), al = bell(age, 0, 0.15, 1) * fade;
        glow(gg, x, y, p.sz * 5, p.mana ? '#6aa8ff' : EM.glow, 0.45 * al);
        speck(gg, x, y, p.sz, p.mana ? '#d8ecff' : EM.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
      });
      jadeBurst(g, t, 3, 26, { y: cy, sp: 0.9, sq: 0.35, t0: 0.08, a: fade, grav: -0.3 });
      glints(g, t, 11, 7, { t0: 0.18, step: 0.07, w: 1.6, y0: -0.3, h: 1.6, a: fade });
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 수도사 안개 장판 (board-mist-pool, 바닥 그림): 고인 안개 둘레를 비취빛 덩이가 천천히 돌고, 오른쪽 · 왼쪽 안개 끝에서 안개 알갱이가 피어오르며 반짝이 가루가 떠오름 */
  'monk-pool-loop': {
    frames: 36, fps: 12, loop: true, logical: 84, size: 256, scope: 'target',
    draw(g, { t }) {
      glowOval(g, 0, 0.24, 0.85, 0.3, EM.glow, 0.1 + 0.1 * wave(t, 1));
      loopOrbit(g, t, { y: 0.24, rx: 0.72, ry: 0.22, m: 3, per: 1, col: EM.core, glowCol: EM.glow, sz: 0.056, tail: 1.2, back: 0.35 });
      loopRise(g, t, 8, { x0: -0.62, x1: -0.38, y0: -0.1, y1: -0.85, per: 1, sz: 0.038, col: EM.light, glowCol: EM.glow, sway: 0.1, seed: 11 });
      loopRise(g, t, 8, { x0: 0.32, x1: 0.56, y0: -0.25, y1: -0.95, per: 1, sz: 0.038, col: EM.light, glowCol: EM.glow, sway: 0.1, seed: 12 });
      loopRise(g, t, 10, { x0: -0.7, x1: 0.7, y0: 0.35, y1: -0.5, per: 1, sz: 0.032, col: EM.core, glowCol: EM.glow, sway: 0.06, seed: 13 });
      loopGlints(g, t, [[-0.5, -0.25], [0.44, -0.42], [0.1, 0.2]], { size: 0.225, col: EM.core, glowCol: EM.glow });
    },
  },
  /** 떠도는 안개가 걸린 사람 발밑 (그림 없이 이 루프만, 2026-10-19): 고리를 따라 비취빛 덩이 둘이 돌고 (뒤쪽은 옅게), 안개 끝에서 알갱이가 흘러 오르며 고리가 숨 쉬듯 빛남 */
  'monk-mist-loop': {
    frames: 36, fps: 12, loop: true, logical: 80, size: 256, scope: 'target',
    draw(g, { t }) {
      glowOval(g, 0, 0.1, 0.9, 0.32, EM.glow, 0.16 + 0.14 * wave(t, 1));
      glowOval(g, 0, 0.1, 0.55, 0.18, EM.light, 0.1 + 0.1 * wave(t, 1, 0.5));
      loopOrbit(g, t, { y: 0.1, rx: 0.78, ry: 0.26, m: 2, per: 1, col: EM.core, glowCol: EM.glow, sz: 0.064, tail: 1.3, back: 0.3 });
      loopRise(g, t, 6, { x0: -0.85, x1: -0.6, y0: 0, y1: -0.6, per: 1, sz: 0.035, col: EM.light, glowCol: EM.glow, sway: 0.08, seed: 21 });
      loopRise(g, t, 6, { x0: 0.6, x1: 0.85, y0: 0, y1: -0.6, per: 1, sz: 0.035, col: EM.light, glowCol: EM.glow, sway: 0.08, seed: 22 });
      loopGlints(g, t, [[-0.72, -0.1], [0.7, -0.16]], { size: 0.195, col: EM.core, glowCol: EM.glow });
    },
  },
};
