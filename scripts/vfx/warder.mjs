// 결계사: 노란 발광 빛 (Lim 2026-10-16 「흰색이라서 퀄리티가 더 떨어져보인다. 노란 발광의 빛이나게」).
// 막 · 장막 · 결계는 둥글게, 스킬 이름에서 모양을 따옴 (Lim 2026-10-16 「결계사의 막, 빛의장막, 결계 이펙트를 각지게 하지말고 이름을 따와서」). 인장 (X · 마름모) · 결계 정화 (깨지는 유리)는 그대로.
// 성기사 금빛 (주황 기운) · 점성술사 호박과 다르게 맑은 레몬 노랑 + 강한 빛 번짐, 어두운 호박 갈색 테.
// 2026-10-19 Lim 「결계사도 퀄리티 및 파티클 보강, 전면 개편」: 모양은 Codex 그림 (scripts/vfx/assets/warder-*), 움직임 · 빛 · 노란 빛가루는 코드
// 2026-10-19 Lim 「모든 스킬의 이펙트가 너무 작다. 파티원칸에 가득 차게, 너무 노란색만 말고 약간의 포인트 색상, 더 많은 파티클로 화려하게」:
// 주인공 그림이 칸 지름만큼 (반지름 1 안팎), 포인트 색은 맑은 하늘빛 (AQ: 레몬 노랑의 반대쪽 차가운 빛, 수도사 비취 · 주술사 물빛보다 옅고 밝게) 가루 · 고리 · 반짝임, 가루는 1.5배 · 빛 번짐
import { asset, bell, bloom, C, comet, E, energy, frac, glint, glow, glowOval, lerp, lightStroke, loopGlints, loopRise, particles, path, rad, ringGlow, seg, solid, speck, TAU, wave } from './lib.mjs';

const Y = { rim: '#3d2a00', deep: '#c99600', body: '#ffd51f', light: '#fff06a', core: '#fffde8', glow: '#ffe23a' };
/** 포인트 색 (2026-10-19): 맑은 하늘빛 */
const AQ = { light: '#9af0ff', core: '#ecfdff', glow: '#5fd6ff' };

/** 빛 선 (곧은 막대): (x0, y0) → (x1, y1), 두께 w, 진행 k (0–1) */
function beam(g, x0, y0, x1, y1, w, a = 1, k = 1, glowA = 0.6) {
  if (k <= 0 || a <= 0) return;
  lightStroke(g, s => ({ x: lerp(x0, x1, s), y: lerp(y0, y1, s) }), 0, k, () => w, { rim: Y.rim, body: Y.body, core: Y.core, a, rimW: 0.022, coreW: 0.42, glowCol: Y.glow, glowA });
}
/** 네모 테 (가운데 (x, y), 폭 w · 높이 h, 선 두께 lw): 어두운 테 → 노란 몸 → 흰 심 + 빛 번짐 */
function frame(g, x, y, w, h, lw, a = 1, rot = 0, glowA = 0.6) {
  if (a <= 0 || w <= 0 || h <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a; g.lineJoin = 'miter';
  bloom(g, gg => { gg.beginPath(); gg.rect(-w / 2 - lw, -h / 2 - lw, w + lw * 2, h + lw * 2); gg.rect(w / 2 - lw, -h / 2 + lw, -(w - lw * 2), h - lw * 2); }, Y.glow, glowA, 5);
  g.beginPath(); g.rect(-w / 2, -h / 2, w, h);
  g.lineWidth = lw + 0.05; g.strokeStyle = C(Y.rim, 0.92); g.stroke();
  g.lineWidth = lw; g.strokeStyle = Y.body; g.stroke();
  g.lineWidth = lw * 0.38; g.strokeStyle = Y.core; g.stroke();
  g.restore();
}
/** 네모 반짝임 (모서리 십자) */
const cornerGlint = (g, x, y, s, a) => glint(g, x, y, s, Y.glow, a, 0, 0.12, Y.core);

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
/** 노란 빛가루 소용돌이 (회복 · 보호 공통): 발밑에서 돌며 떠오름 */
function lightSwirl(g, t, seed, n, { y0 = 0.6, rise = 1.1, rr = 0.75, t0 = 0, span = 0.45, a = 1 } = {}) {
  const cols = [Y.light, Y.core, Y.glow, AQ.light], glows = [Y.glow, Y.glow, Y.glow, AQ.glow];
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.016 + r() * 0.028, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: r() < 0.3 ? 3 : Math.floor(r() * 3) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22, al = bell(age, 0, 0.12, 1) * a;
    glow(gg, x, y, p.sz * 4.5, glows[p.c], 0.4 * al);
    speck(gg, x, y, p.sz, cols[p.c], al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 사방으로 터지는 노란 빛가루 */
function lightBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.9, sq = 0.8, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.016 + r() * 0.026, ph: r() * 9, aq: r() < 0.3 }), (gg, p, age) => {
    const d = p.v * E.out3(age), px = x + Math.cos(p.ang) * d, py = y + Math.sin(p.ang) * d * sq + grav * age * age, al = (1 - E.in2(age)) * a;
    glow(gg, px, py, p.sz * 4, p.aq ? AQ.glow : Y.glow, 0.4 * al);
    speck(gg, px, py, p.sz * (1 - 0.4 * age), p.aq ? (age < 0.4 ? AQ.core : AQ.light) : age < 0.4 ? Y.core : Y.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 위에서 몸으로 떨어져 스미는 빛 방울 */
function lightRain(g, t, seed, n, { w = 0.9, y0 = -0.6, y1 = 0.5, t0 = 0, span = 0.45, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.3 + r() * 0.25, x: (r() - 0.5) * w, sz: 0.016 + r() * 0.026, ph: r() * 9, aq: r() < 0.3 }), (gg, p, age) => {
    const y = lerp(y0, y1, E.in2(age) * 0.5 + age * 0.5), al = bell(age, 0, 0.15, 1) * a;
    glow(gg, p.x, y, p.sz * 5, p.aq ? AQ.glow : Y.glow, 0.4 * al);
    speck(gg, p.x, y, p.sz, p.aq ? AQ.core : age < 0.5 ? Y.core : Y.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 차례로 켜지는 반짝임 */
function glints(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.3, h = 0.8, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r(), aq: i % 3 === 1 }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.08, 0.24 * Math.sin(Math.PI * age), p.aq ? AQ.glow : Y.glow, a, p.rot, 0.13, p.aq ? AQ.core : Y.core));
}
/** 맞는 순간: 흰 섬광 + 노란 번짐 + 퍼지는 노란 고리 · 하늘빛 고리 (sy = 고리 납작함) */
function impact(g, t, { x = 0, y = 0, t0 = 0, r = 1.1, sy = 0.9, a = 1 } = {}) {
  const u = seg(t, t0, t0 + 0.45);
  glow(g, x, y, r * 1.05, Y.glow, 0.6 * (1 - E.out2(seg(t, t0, t0 + 0.55))) * a);
  glow(g, x, y, r * 0.5, '#ffffff', 0.85 * bell(t, t0 - 0.02, t0 + 0.03, t0 + 0.28) * a);
  if (u > 0 && u < 1) { ringGlow(g, x, y, lerp(0.25, r * 1.2, E.out3(u)), 0.08, Y.light, 0.8 * (1 - u) * a, sy); ringGlow(g, x, y, lerp(0.15, r * 0.9, E.out3(seg(t, t0 + 0.06, t0 + 0.5))), 0.05, AQ.light, 0.7 * (1 - u) * a, sy); }
}

export default {
  /** 인장 치유: 머리 위에 Codex X자 인장 (warder-xseal)이 도장 찍듯 크게 내려와 쾅 맞물리며 번쩍이고, 노란 빛 고리가 퍼지며
   *  빛 방울이 몸으로 떨어져 스미고 빛가루가 소용돌이치며 떠오름 */
  'warder-seal': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), sy = -0.18, stamp = E.in2(seg(t, 0, 0.16)), hit = bell(t, 0.13, 0.18, 0.45), s = lerp(2.4, 1.5, stamp) * (1 + 0.06 * hit);
      glow(g, 0, sy, 1.05, Y.glow, (0.3 + 0.5 * hit) * fade);
      impact(g, t, { y: sy, t0: 0.15, r: 1.15, sy: 0.9 });
      if (!pic(g, 'warder-xseal', 0, sy, s, Math.min(1, t * 8) * fade, { add: 0.5 * hit })) { beam(g, -0.7, sy - 0.7, 0.7, sy + 0.7, 0.14, fade); beam(g, 0.7, sy - 0.7, -0.7, sy + 0.7, 0.14, fade); }
      lightBurst(g, t, 3, 40, { y: sy, sp: 1.2, sq: 0.85, t0: 0.14, a: fade, grav: 0.2 });
      lightRain(g, t, 4, 40, { w: 1.4, y0: -0.9, y1: 0.75, t0: 0.2, span: 0.45, a: fade });
      glints(g, t, 6, 8, { t0: 0.18, step: 0.05, w: 2.0, y0: 0, h: 1.8, a: fade });
      lightSwirl(g, t, 5, 36, { y0: 0.7, rise: 1.3, rr: 0.95, t0: 0.3, span: 0.4, a: fade });
    },
  },

  /** 결계 정화 (해제, 2026-10-19 Lim 「사각형 각진것을 둥글게 다시 표현」): 몸을 Codex 노란 빛 방울 (warder-bubble, 안에 어두운 기운이 갇힘)이 톡 감싸 숨 쉬듯 흔들리며
   *  금이 번지다 퐁 터지고, 둥근 충격파 고리 둘 · Codex 둥근 빛 구슬 터짐 (warder-burst)이 퍼지며 어두운 티끌이 노란 빛가루로 타 사라지고 둥근 빛 구슬이 사방으로 튐 (모서리 · 직선 없음) */
  'warder-cleanse': {
    frames: 18, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const brk = 0.32, fade = 1 - E.in2(seg(t, 0.6, 1)), appear = E.back(seg(t, 0, 0.16), 1.6), tense = seg(t, 0.16, brk), wob = Math.sin(t * 70) * 0.035 * tense;
      glow(g, 0, 0.05, 1.2, Y.glow, 0.45 * fade);
      // 빛 방울: 터지기 직전 조금 부풀고 (가로 · 세로 엇갈려 흔들림), 터지는 순간 커지며 사라짐
      const pop = seg(t, brk, brk + 0.12), bw = 1.95 * appear * (1 + 0.06 * tense + 0.3 * E.out2(pop));
      if (pop < 1 && !pic(g, 'warder-bubble', 0, 0.05, bw, 0.95 * (1 - pop), { sx: 1 + wob, sy: 1 - wob, add: 0.25 + 0.45 * tense })) {
        glow(g, 0, 0.05, bw * 0.5, Y.glow, 0.6 * (1 - pop)); ringGlow(g, 0, 0.05, bw * 0.45, 0.06, Y.light, 0.9 * (1 - pop));
      }
      const b = bell(t, brk - 0.03, brk + 0.02, brk + 0.3);
      glow(g, 0, 0.05, 0.95, '#ffffff', 0.9 * b);
      impact(g, t, { y: 0.05, t0: brk, r: 1.2, sy: 0.92 });
      if (t >= brk) {
        const u = seg(t, brk, 1);
        for (const [d, w, al, col] of [[0, 0.09, 0.9, Y.light], [0.08, 0.06, 0.7, AQ.light]]) { const q = seg(u, d, d + 0.5); if (q > 0 && q < 1) ringGlow(g, 0, 0.05, lerp(0.5, 1.45, E.out3(q)), w, col, al * (1 - q) * fade); }
        pic(g, 'warder-burst', 0, 0.05, lerp(1.3, 2.7, E.out3(u)), (1 - seg(u, 0.15, 0.75)) * fade, { rot: u * 0.6, add: 0.35 * (1 - u) });
        // 어두운 티끌 → 노란 빛가루
        particles(g, u, 7, 20, r => ({ t0: 0, life: 0.5 + r() * 0.3, a: r() * TAU, v: 0.65 + r() * 0.9, sz: 0.04 + r() * 0.04 }), (gg, p, age) => {
          const d = p.v * E.out3(age), x = Math.cos(p.a) * d, y = 0.05 + Math.sin(p.a) * d * 0.85, burn = seg(age, 0.3, 1);
          bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * (1 - burn), 0, TAU); }, '#3a1a50', 0.6 * (1 - burn) * fade, 3);
          if (burn > 0) speck(gg, x, y - 0.1 * burn, 0.022, Y.light, (1 - burn) * fade);
        });
        lightBurst(g, u, 9, 64, { y: 0.05, sp: 1.45, sq: 0.9, a: fade, grav: 0.25 });
        glints(g, u, 11, 9, { t0: 0.02, step: 0.05, w: 2.0, y0: 0, h: 1.6, a: fade });
        lightSwirl(g, u, 13, 30, { y0: 0.7, rise: 1.25, rr: 0.95, t0: 0.15, span: 0.3, a: fade });
      }
    },
  },

  /** 심판 (인장 터뜨리기, 회복한 인장 칸마다 · 공격 아님, 2026-10-19 Lim 「심판 이펙트도 다시 한번」): 하늘에서 굵은 노란 빛기둥이 칸으로 쾅 내리꽂히고,
   *  닿는 순간 흰 섬광 · 노란 · 하늘빛 충격파와 함께 Codex 여덟 갈래 빛살 (warder-radiant)이 칸보다 크게 터져 천천히 돌며 퍼지고, 빛살 여덟이 뻗어 나가며
   *  빛가루가 사방으로 튀고 몸으로 빛 방울이 쏟아짐 (빛살 그림은 커지며 사라짐, 한자리에 머물지 않음) */
  'warder-judgment': {
    frames: 18, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), hit = 0.22, cy = -0.05, top = -1.65, pd = E.in2(seg(t, 0, hit)), py = lerp(top + 0.4, cy, pd);
      // 내리꽂히는 빛기둥 (닿은 뒤 0.25 동안 옅어짐)
      const pa = 1 - seg(t, hit, hit + 0.28);
      if (pa > 0) {
        glowOval(g, 0, lerp(top, py, 0.5), 0.45, Math.max(0.2, (py - top) / 2), Y.glow, 0.5 * pa);
        lightStroke(g, s2 => ({ x: 0, y: lerp(top, py, s2) }), 0, 1, u => 0.3 * (0.35 + 0.65 * u) * (t < hit ? 1 : 1 + 0.6 * seg(t, hit, hit + 0.28)), { rim: Y.rim, body: Y.body, core: Y.core, a: pa, rimW: 0.025, coreW: 0.45, glowCol: Y.glow, glowA: 0.8 });
        if (t < hit) { glow(g, 0, py, 0.45, Y.glow, 0.9); glow(g, 0, py, 0.18, '#ffffff', 1); }
      }
      impact(g, t, { y: cy, t0: hit, r: 1.3, sy: 0.9, a: 0.7 });
      const pop = E.back(seg(t, hit - 0.02, hit + 0.18), 1.6), ra = (1 - E.in2(seg(t, 0.48, 0.85))) * fade;
      if (pop > 0.01 && ra > 0 && !pic(g, 'warder-radiant', 0, cy, 2.1 * pop * (1 + 0.18 * seg(t, hit, 1)), ra * 0.92, { rot: t * 1.2, add: 0.2 * bell(t, hit, hit + 0.08, hit + 0.3) })) frame(g, 0, cy, 0.85, 0.85, 0.09, ra, Math.PI / 4);
      // 뻗어 나가는 빛살 여덟 (노랑 · 하늘빛 번갈아)
      const ru = seg(t, hit, hit + 0.38);
      if (ru > 0 && ru < 1) for (let i = 0; i < 8; i++) {
        const an = (i * TAU) / 8 + 0.2, r0 = lerp(0.35, 1.1, E.out3(ru)), r1 = lerp(0.6, 1.55, E.out3(ru)), aq = i % 2 === 1;
        lightStroke(g, s2 => ({ x: Math.cos(an) * lerp(r0, r1, s2), y: cy + Math.sin(an) * lerp(r0, r1, s2) * 0.9 }), 0, 1, w0 => 0.07 * Math.sin(Math.PI * w0) * (1 - 0.5 * ru), { rim: Y.rim, body: aq ? AQ.light : Y.light, core: aq ? AQ.core : Y.core, a: (1 - E.in2(ru)) * fade, rimW: 0.012, glowCol: aq ? AQ.glow : Y.glow, glowA: 0.7 });
      }
      lightRain(g, t, 4, 30, { w: 0.6, y0: -1.4, y1: cy, t0: 0, span: 0.18, a: fade });
      lightBurst(g, t, 3, 60, { y: cy, sp: 1.45, sq: 0.9, t0: hit, a: fade, grav: 0.3 });
      lightRain(g, t, 5, 36, { w: 1.6, y0: -0.6, y1: 0.85, t0: hit + 0.1, span: 0.35, a: fade });
      glints(g, t, 6, 9, { t0: hit, step: 0.05, w: 2.1, y0: 0, h: 1.9, a: fade });
      lightSwirl(g, t, 7, 32, { y0: 0.75, rise: 1.35, rr: 1.0, t0: hit + 0.15, span: 0.35, a: fade });
    },
  },

  /** 빛의 막 (보호막, 둥글게): 몸 앞에 Codex 둥근 빛 막 (warder-membrane)이 가운데에서 옆으로 펼쳐지며 씌워지고, 윤이 한 번 미끄러지며
   *  막 위로 빛가루가 흐르다 막 테두리에서 반짝이가 켜지고 빛가루로 걷힘 */
  'warder-barrier': {
    frames: 22, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const unfold = E.out3(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.62, 1)), R = 1.08;
      glow(g, 0, 0.05, 1.15, Y.glow, 0.4 * fade);
      impact(g, t, { y: 0.05, t0: 0.22, r: 1.15, sy: 0.92 });
      if (!pic(g, 'warder-membrane', 0, 0.05, 2 * R, 0.5 * fade, { sx: lerp(0.15, 1, unfold), add: 0.2 * bell(t, 0.2, 0.35, 0.6) })) { g.save(); g.globalAlpha = 0.4 * fade; g.beginPath(); g.ellipse(0, 0.05, R * unfold, R, 0, 0, TAU); g.fillStyle = C(Y.glow, 0.3); g.fill(); g.restore(); }
      // 윤 (비스듬히 미끄러지는 빛 띠)
      const sw = seg(t, 0.3, 0.6);
      if (sw > 0 && sw < 1) { g.save(); g.beginPath(); g.ellipse(0, 0.05, R * 0.95, R * 0.95, 0, 0, TAU); g.clip(); g.globalCompositeOperation = 'lighter'; const x = lerp(-1.2, 1.2, sw); const gr = g.createLinearGradient(x - 0.25, 0, x + 0.25, 0); gr.addColorStop(0, C(Y.light, 0)); gr.addColorStop(0.5, C(Y.core, 0.55 * fade)); gr.addColorStop(1, C(Y.light, 0)); g.fillStyle = gr; g.translate(x, 0); g.rotate(0.35); g.fillRect(-0.25, -1.5, 0.5, 3); g.restore(); }
      // 테두리 반짝임 · 막 위 흐르는 빛가루
      for (let i = 0; i < 8; i++) { const a = rad(-120 + i * 36), b = bell(t, 0.25 + i * 0.035, 0.32 + i * 0.035, 0.55 + i * 0.035), aq = i % 2 === 1; glint(g, Math.cos(a) * R * unfold, 0.05 + Math.sin(a) * R, 0.2 * b, aq ? AQ.glow : Y.glow, b * fade, a, 0.14, aq ? AQ.core : Y.core); }
      particles(g, t, 3, 48, r => ({ t0: 0.15 + r() * 0.5, life: 0.4, a: r() * TAU, rr: r() * 1.0, sz: 0.016 + r() * 0.02, aq: r() < 0.3 }), (gg, p, age) => { const x = Math.cos(p.a + age) * p.rr * unfold, y = 0.05 + Math.sin(p.a + age) * p.rr, al = bell(age, 0, 0.2, 1) * fade; glow(gg, x, y, p.sz * 4, p.aq ? AQ.glow : Y.glow, 0.4 * al); speck(gg, x, y, p.sz, p.aq ? AQ.light : Y.light, al, age * 4); });
      lightBurst(g, t, 4, 30, { y: 0.05, sp: 1.2, sq: 0.9, t0: 0.24, a: fade, grav: 0.1 });
      lightSwirl(g, t, 5, 32, { y0: 0.7, rise: 1.25, rr: 0.95, t0: 0.5, span: 0.3, a: fade });
    },
  },

  /** 결계 원 (범위 칸마다): 빛 점 하나가 발밑에 Codex 빛 원 문양 (warder-circle, 여섯 꽃잎 호)을 그리며 닫고, 원이 은은히 빛나다
   *  빛 점들이 원에서 떠오름. 여러 칸이라 적당히 */
  'warder-circle': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const draw = E.inOut(seg(t, 0, 0.4)), fade = 1 - E.in2(seg(t, 0.62, 1)), by = 0.6, W = 2.4;
      glowOval(g, 0, by, 1.25, 0.4, Y.glow, 0.5 * fade);
      impact(g, t, { y: by, t0: 0.4, r: 1.15, sy: 0.34 });
      if (draw > 0.01) {
        g.save(); g.translate(0, by); g.scale(1, 0.34); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 3, Math.PI / 2, Math.PI / 2 + TAU * draw); g.closePath(); g.restore(); g.save(); g.clip();
        if (!pic(g, 'warder-circle', 0, by, W, fade, { add: 0.35 * bell(t, 0.35, 0.45, 0.7) })) ringGlow(g, 0, by, 0.8, 0.06, Y.light, fade, 0.34);
        g.restore();
        const a = Math.PI / 2 + TAU * draw, hx = Math.cos(a) * W * 0.47, hy = by + Math.sin(a) * W * 0.47 * 0.36;
        if (draw < 1) { glow(g, hx, hy, 0.3, Y.glow, 0.9 * fade); glow(g, hx, hy, 0.14, AQ.glow, 0.7 * fade); speck(g, hx, hy, 0.038, '#ffffff', fade); }
      }
      particles(g, t, 3, 40, r => ({ t0: 0.4 + r() * 0.35, life: 0.4, a: r() * TAU, sz: 0.016 + r() * 0.022, ph: r() * 9, aq: r() < 0.3 }), (gg, p, age) => { const x = Math.cos(p.a) * W * 0.45, y = by + Math.sin(p.a) * W * 0.16 - 1.2 * E.out2(age), al = bell(age, 0, 0.2, 1) * fade; glow(gg, x, y, p.sz * 4, p.aq ? AQ.glow : Y.glow, 0.4 * al); speck(gg, x, y, p.sz, p.aq ? AQ.light : Y.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 16)); });
      glints(g, t, 5, 7, { t0: 0.4, step: 0.05, w: 2.1, y0: by - 0.1, h: 0.4, a: fade });
    },
  },

  /** 수호 결계 (큰 보호막): 몸 둘레에 Codex 빛 띠 지구본 (warder-globe)이 작게 맺혔다 크게 펼쳐지며 천천히 돌고, 띠를 따라 빛 구슬이 돌며
   *  결계가 한 번 번쩍인 뒤 빛가루로 옅어짐 */
  'warder-guard': {
    frames: 22, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const grow = E.back(seg(t, 0, 0.3), 1.4), fade = 1 - E.in2(seg(t, 0.62, 1)), R = 1.1, flash = bell(t, 0.3, 0.38, 0.6);
      glow(g, 0, 0.05, 1.2, Y.glow, (0.35 + 0.35 * flash) * fade);
      impact(g, t, { y: 0.05, t0: 0.3, r: 1.2, sy: 0.92 });
      if (!pic(g, 'warder-globe', 0, 0.05, 2 * R * grow, 0.7 * fade, { sx: 1 + 0.04 * Math.sin(t * 9), add: 0.35 * flash })) ringGlow(g, 0, 0.05, R * grow, 0.06, Y.light, fade);
      // 띠를 도는 빛 구슬 (가로 띠 · 세로 띠)
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + (i * TAU) / 3; glow(g, Math.cos(a) * R * grow, 0.05 + Math.sin(a) * R * 0.18 * grow, 0.14, Y.glow, 0.7 * fade); speck(g, Math.cos(a) * R * grow, 0.05 + Math.sin(a) * R * 0.18 * grow, 0.034, Y.core, fade);
        const b2 = t * 6 + (i * TAU) / 3 + 1; glow(g, Math.cos(b2) * R * 0.4 * grow, 0.05 + Math.sin(b2) * R * grow, 0.12, AQ.glow, 0.6 * fade); speck(g, Math.cos(b2) * R * 0.4 * grow, 0.05 + Math.sin(b2) * R * grow, 0.03, AQ.core, 0.9 * fade);
      }
      lightBurst(g, t, 3, 44, { y: 0.05, sp: 1.35, sq: 0.9, t0: 0.32, a: fade, grav: 0.1 });
      glints(g, t, 5, 9, { t0: 0.3, step: 0.05, w: 2.1, y0: 0.05, h: 1.9, a: fade });
      lightSwirl(g, t, 7, 34, { y0: 0.75, rise: 1.35, rr: 1.0, t0: 0.4, span: 0.35, a: fade });
    },
  },

  /** 빛의 장막 (장막 칸마다, 2026-10-19 Lim 「장막 이미지가 어색하다, 다시 만들어보자」): Codex 노란 빛 오로라 장막 (warder-aurora)이 머리 위에서 칸 폭으로 아래로 펼쳐져 내려오며
   *  세로 주름마다 따로 물결치고 (그림을 세로 띠로 잘라 띠마다 흔듦), 빛나는 밑단이 내려와 발밑에 닿을 때 노란 · 하늘빛 충격파가 퍼지고,
   *  주름에서 빛가루가 흘러내리다 장막이 위로 걷히며 반짝이로 흩어짐 (한자리에 머물지 않음) */
  'warder-veil': {
    frames: 24, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.7, 1)), drop = E.out3(seg(t, 0, 0.35)), lift = E.in2(seg(t, 0.55, 1)), Wd = 2.55, top = -1.2 - 0.45 * lift, H = 2.2, hem = top + H * drop;
      const img = asset('warder-aurora');
      glowOval(g, 0, lerp(top, hem, 0.5), 1.25, Math.max(0.3, (hem - top) / 2), Y.glow, 0.35 * fade);
      impact(g, t, { y: 0.95, t0: 0.32, r: 1.15, sy: 0.32 });
      if (drop > 0.01) {
        g.save(); g.beginPath(); g.rect(-2, top - 0.2, 4, hem - top + 0.2); g.clip();
        const al = 0.72 * fade * (1 - 0.65 * lift), N = 22;
        if (img) {
          const sw = img.width / N;
          for (const [pass, k] of [['source-over', 0.55], ['lighter', 0.3 * (0.6 + 0.4 * Math.sin(t * 13))]]) {
            g.save(); g.globalCompositeOperation = pass; g.globalAlpha = al * k;
            for (let i = 0; i < N; i++) {
              const dx = -Wd / 2 + (i / N) * Wd + Math.sin(i * 0.55 + t * 11) * 0.04, dy = top + Math.sin(i * 0.4 + t * 7) * 0.035, dh = H * (1 + 0.035 * Math.sin(i * 0.7 + t * 9));
              const ov = 0.45; g.drawImage(img, Math.max(0, (i - ov) * sw), 0, sw * (1 + 2 * ov), img.height, dx - (Wd / N) * ov, dy, (Wd / N) * (1 + 2 * ov), dh); // 띠끼리 겹쳐 이음매가 안 보이게
            }
            g.restore();
          }
        } else { g.globalAlpha = 0.4 * al; g.fillStyle = C(Y.glow, 0.4); g.fillRect(-Wd / 2, top, Wd, H); }
        g.restore();
        // 내려오는 밑단의 빛나는 물결 선
        if (drop < 1) lightStroke(g, s2 => ({ x: lerp(-Wd / 2, Wd / 2, s2), y: hem + Math.sin(s2 * TAU * 2 + t * 12) * 0.05 }), 0, 1, w0 => 0.07 * Math.sin(Math.PI * w0) ** 0.5, { rim: Y.rim, body: Y.light, core: '#ffffff', a: fade, rimW: 0.012, glowCol: Y.glow, glowA: 0.8 });
      }
      // 주름에서 흘러내리는 빛가루 · 걷힐 때 위로 흩어지는 반짝이
      particles(g, t, 3, 50, r => ({ t0: 0.1 + r() * 0.5, life: 0.4, x: (r() - 0.5) * 2.3, y0: -0.9 + r() * 1.2, sz: 0.016 + r() * 0.022, ph: r() * 9, aq: r() < 0.3 }), (gg, p, age) => {
        const y = p.y0 + 0.6 * age, al2 = bell(age, 0, 0.2, 1) * fade; if (y > hem) return;
        glow(gg, p.x, y, p.sz * 4, p.aq ? AQ.glow : Y.glow, 0.4 * al2); speck(gg, p.x, y, p.sz, p.aq ? AQ.light : Y.light, al2, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
      });
      particles(g, t, 4, 56, r => ({ t0: 0.55 + r() * 0.35, life: 0.4, x: (r() - 0.5) * 2.3, y0: -1.0 + r() * 1.9, sz: 0.018 + r() * 0.024, ph: r() * 9, aq: r() < 0.3 }), (gg, p, age) => {
        const y = p.y0 - 0.7 * E.out2(age), x = p.x + Math.sin(age * 6 + p.ph) * 0.06, al2 = (1 - age) * fade;
        glow(gg, x, y, p.sz * 4, p.aq ? AQ.glow : Y.glow, 0.45 * al2); speck(gg, x, y, p.sz, p.aq ? AQ.light : age < 0.4 ? Y.core : Y.light, al2, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      lightSwirl(g, t, 6, 24, { y0: 0.9, rise: 1.4, rr: 1.0, t0: 0.3, span: 0.35, a: fade });
      glints(g, t, 5, 8, { t0: 0.25, step: 0.06, w: 2.2, y0: -0.1, h: 1.9, a: fade });
    },
  },

  /** 결계 굳히기 (늘린 보호막마다): 몸 둘레 둥근 빛 막 (warder-membrane) 위로 크게 둘러진 두 번째 막이 조여 덮여 두꺼워지고, 네 곳에 Codex 빛 매듭 (warder-knot)이
   *  톡 맺히며 빛실로 이어진 뒤 빛가루가 막 위로 흐름 */
  'warder-hold': {
    frames: 20, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const close = E.inOut(seg(t, 0, 0.35)), fade = 1 - E.in2(seg(t, 0.65, 1)), R = 1.0, R2 = lerp(1.5, R * 1.04, close), lock = bell(t, 0.32, 0.4, 0.65);
      glow(g, 0, 0.05, 1.15, Y.glow, (0.35 + 0.35 * lock) * fade);
      impact(g, t, { y: 0.05, t0: 0.36, r: 1.15, sy: 0.92 });
      pic(g, 'warder-membrane', 0, 0.05, 2 * R, 0.5 * fade, {});
      if (!pic(g, 'warder-membrane', 0, 0.05, 2 * R2, (0.25 + 0.35 * close) * fade, { rot: (1 - close) * 1.2, add: 0.4 * lock })) ringGlow(g, 0, 0.05, R2, 0.06, Y.light, fade);
      // 네 매듭 + 빛실
      const knots = [0, 1, 2, 3].map(i => { const a = rad(-90 + i * 90); return [Math.cos(a) * R, 0.05 + Math.sin(a) * R]; });
      const kn = E.back(seg(t, 0.35, 0.5), 2);
      if (kn > 0) {
        for (let i = 0; i < 4; i++) {
          const [ax, ay] = knots[i], [bx, by] = knots[(i + 1) % 4], a0 = rad(-90 + i * 90), u = E.out2(seg(t, 0.42 + i * 0.03, 0.6 + i * 0.03));
          if (u > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = C(i % 2 ? AQ.light : Y.light, 0.8 * fade); g.lineWidth = 0.04; g.beginPath(); g.arc(0, 0.05, R, a0, a0 + rad(90) * u); g.stroke(); g.restore(); }
        }
        knots.forEach(([x, y], i) => { glow(g, x, y, 0.22 * kn, AQ.glow, 0.5 * fade); if (!pic(g, 'warder-knot', x, y, 0.56 * kn, fade, { rot: i * 0.6 + t * 2, add: 0.3 })) glint(g, x, y, 0.2 * kn, Y.glow, fade, 0, 0.14, Y.core); });
      }
      lightBurst(g, t, 3, 42, { y: 0.05, sp: 1.3, sq: 0.9, t0: 0.34, a: fade, grav: 0.1 });
      glints(g, t, 6, 7, { t0: 0.36, step: 0.05, w: 2.0, y0: 0.05, h: 1.8, a: fade });
      lightSwirl(g, t, 5, 32, { y0: 0.75, rise: 1.3, rr: 0.95, t0: 0.4, span: 0.35, a: fade });
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 결계사 성채 (board-citadel, 바닥 그림): 창 · 성문이 노랗게 숨 쉬듯 빛나고, 성 아래에 노란 결계 고리가 퍼지며, 노란 빛 가루가 떠오르고 첨탑 끝이 차례로 반짝임 */
  'warder-citadel-loop': {
    frames: 36, fps: 12, loop: true, logical: 84, size: 256, scope: 'target',
    draw(g, { t }) {
      [[0, 0.44, 0.3], [0, -0.3, 0.2], [-0.5, -0.1, 0.16], [0.56, -0.1, 0.16]].forEach(([x, y, r], i) => { glow(g, x, y, r, Y.glow, 0.2 + 0.3 * wave(t, 2, i * 0.25)); glow(g, x, y, r * 0.4, Y.core, 0.15 + 0.3 * wave(t, 2, i * 0.25)); });
      for (const k of [0, 0.5]) { const a = frac(t * 2 + k); ringGlow(g, 0, 0.72, lerp(0.35, 0.95, E.out2(a)), 0.05, Y.glow, 0.4 * (1 - a) * seg(a, 0, 0.1), 0.3); }
      loopRise(g, t, 16, { x0: -0.8, x1: 0.8, y0: 0.7, y1: -0.9, per: 1, sz: 0.035, col: Y.core, glowCol: Y.glow, sway: 0.05, seed: 31 });
      loopGlints(g, t, [[0, -0.96], [-0.6, -0.6], [0.64, -0.6], [-0.3, -0.75], [0.32, -0.72]], { size: 0.255, col: Y.core, glowCol: Y.glow });
    },
  },
};
