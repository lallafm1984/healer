// 수도사: 비취 · 흰 안개. 흐르는 안개 리본 · 붓 획 같은 기 줄 · 기 구슬 (드루이드 풀빛 · 사제 소생 초록과 다른 푸른 비취 + 흰빛).
// 2026-10-19 Lim 「수도사 · 점성술사 · 결계사도 퀄리티 및 파티클 보강, 전면 개편」: 모양은 Codex 그림 (scripts/vfx/assets/monk-*), 움직임 · 빛 · 비취 반짝이 가루는 코드
import { asset, bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, rng, seg, solid, speck, taper, TAU } from './lib.mjs';

const J = { rim: '#0d3329', deep: '#1d6b55', mid: '#3fae8c', light: '#6fd0b0', pale: '#bff0dc', white: '#f2fff9', glow: '#5fd8b0' };

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
/** 비취 반짝이 가루 소용돌이 (치유 공통): 발밑 (y0)에서 태어나 돌며 떠오름 */
function jadeSwirl(g, t, seed, n, { y0 = 0.6, rise = 1.1, rr = 0.75, t0 = 0, span = 0.45, a = 1 } = {}) {
  const cols = [J.pale, J.light, J.white];
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.25, rise: rise * (0.7 + r() * 0.6), sz: 0.012 + r() * 0.022, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, c: Math.floor(r() * 3) }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.rise * E.out2(age) + Math.sin(ang) * rad2 * 0.22;
    speck(gg, x, y, p.sz, cols[p.c], bell(age, 0, 0.12, 1) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 사방으로 터지는 비취 불똥 */
function jadeBurst(g, t, seed, n, { x = 0, y = 0, sp = 0.9, sq = 0.7, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const d = p.v * E.out3(age);
    speck(gg, x + Math.cos(p.ang) * d, y + Math.sin(p.ang) * d * sq + grav * age * age, p.sz * (1 - 0.4 * age), age < 0.4 ? J.white : J.pale, (1 - E.in2(age)) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 차례로 톡톡 켜지는 큰 반짝임 */
function glints(g, t, seed, n, { t0 = 0.1, step = 0.07, w = 1.2, y0 = -0.3, h = 0.8, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.08, 0.17 * Math.sin(Math.PI * age), J.glow, a, p.rot, 0.13, J.white));
}
/** 흘러가며 옅어지는 안개 알갱이 (방향 dx, dy) */
function mistMotes(g, t, seed, n, { x0 = 0, y0 = 0.5, w = 1.2, h = 0.4, dx = 0.4, dy = -0.2, t0 = 0, span = 0.6, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.4 + r() * 0.3, x: x0 + (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, sz: 0.014 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
    const x = p.x + dx * E.out2(age) + Math.sin(age * 7 + p.ph) * 0.04, y = p.y + dy * E.out2(age);
    glow(gg, x, y, p.sz * 5, J.glow, 0.35 * bell(age, 0, 0.2, 1) * a);
    speck(gg, x, y, p.sz, J.pale, bell(age, 0, 0.15, 1) * a, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
  });
}
/** 아래로 가는 원뿔 모양이 아니라, y0 ~ y1 사이를 위에서부터 드러내는 세로 가림 */
function clipRows(g, y0, y1) { g.beginPath(); g.rect(-3, y0, 6, y1 - y0); g.clip(); }
const frac = v => v - Math.floor(v);

export default {
  /** 생기 손바닥 (1초마다 연타 → 짧고 가볍게): Codex 비취 기 구슬 (monk-orb, 안에서 기가 소용돌이 · 붓 고리)이 손바닥으로 친 듯 톡 부풀며 돌았다 작아지고,
   *  위아래 박자 붓 획이 밖으로 밀려나며 비취 불똥이 사방으로 튀고 반짝이 가루가 떠오름 */
  'monk-palm': {
    frames: 14, logical: 86, size: 256, scope: 'target',
    draw(g, { t }) {
      const pop = t < 0.16 ? E.back(t / 0.16, 1.8) : 1 - E.in2(seg(t, 0.16, 0.72)), fade = 1 - E.in2(seg(t, 0.35, 1));
      glow(g, 0, 0, 0.85, J.glow, 0.65 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, 0, 0.45, '#ffffff', 0.6 * (1 - E.out3(seg(t, 0, 0.25))));
      ringGlow(g, 0, 0, lerp(0.25, 1.0, E.out3(seg(t, 0, 0.5))), 0.07, J.light, 0.7 * (1 - seg(t, 0.05, 0.55)), 0.9);
      if (pop > 0.01 && !pic(g, 'monk-orb', 0, 0, 1.0 * pop, Math.min(1, fade * 1.2), { rot: t * 6, add: 0.3 * (1 - seg(t, 0, 0.3)) })) {
        g.save(); g.scale(0.48 * pop, 0.48 * pop); energy(g, gg => { gg.beginPath(); gg.arc(0, 0, 1, 0, TAU); }, { rim: J.rim, body: J.light, core: J.white }); g.restore();
      }
      // 위아래 박자 획 (밖으로 밀려남)
      const d = 0.5 + 0.4 * E.out3(seg(t, 0, 0.5));
      for (const sgn of [-1, 1]) { const y = sgn * d, L = 0.5 * (1 - 0.3 * seg(t, 0.3, 1)); brush(g, s => ({ x: lerp(-L, L, s), y: y + Math.sin(s * Math.PI) * sgn * 0.06 }), 0, 1, 0.13, fade); }
      jadeBurst(g, t, 3, 20, { sp: 0.95, sq: 0.85, a: fade, grav: 0.1 });
      jadeSwirl(g, t, 5, 14, { y0: 0.5, rise: 0.8, rr: 0.6, t0: 0.15, span: 0.3, a: fade });
    },
  },

  /** 안개 감싸기: Codex 안개 고리 (monk-mist-ring, 비스듬한 타원 안개 리본)가 몸을 한 바퀴 휘감듯 앞에서부터 그려지며 위로 올라가고,
   *  다 감으면 리본이 살짝 조여들며 빛나고 안개 알갱이 · 반짝이 가루가 피어오름 */
  'monk-wrap': {
    frames: 22, logical: 92, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.62, 1)), wrap = E.inOut(seg(t, 0, 0.5)), y = lerp(0.45, 0.0, E.inOut(seg(t, 0, 0.7))), squeeze = 1 - 0.12 * E.inOut(seg(t, 0.45, 0.75));
      glow(g, 0, 0.05, 0.95, J.glow, 0.55 * (1 - E.out2(seg(t, 0, 0.7))));
      glow(g, 0, 0.1, 0.45, '#ffffff', 0.4 * (1 - E.out3(seg(t, 0, 0.3))));
      // 고리 (앞 아래쪽에서 시작해 한 바퀴 그려짐: 가운데에서 부채꼴로 가림)
      if (wrap > 0.01) {
        g.save(); g.translate(0, y); g.rotate(rad(-14));
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 3, Math.PI / 2, Math.PI / 2 + TAU * wrap); g.closePath(); g.clip();
        pic(g, 'monk-mist-ring', 0, 0, 2.3 * squeeze, fade, { sy: 1.1, add: 0.35 * bell(t, 0.35, 0.5, 0.75) });
        g.restore();
        // 그려지는 끝의 안개 머리
        const a = Math.PI / 2 + TAU * wrap, hx = Math.cos(a) * 1.05, hy = y + Math.sin(a) * 0.38;
        if (wrap < 1) { glow(g, hx, hy, 0.3, J.glow, 0.7 * fade); speck(g, hx, hy, 0.03, J.white, fade); }
      }
      mistMotes(g, t, 7, 26, { y0: 0.1, w: 1.7, h: 0.6, dx: 0, dy: -0.55, t0: 0.15, span: 0.55, a: fade });
      jadeSwirl(g, t, 9, 26, { y0: 0.55, rise: 1.1, rr: 0.75, t0: 0.3, span: 0.4, a: fade });
      glints(g, t, 11, 5, { t0: 0.4, step: 0.06, w: 1.6, y0: 0, h: 0.8, a: fade });
    },
  },

  /** 떠도는 안개 (대상 · 옮겨 간 칸): 발 높이에 Codex 안개 구름 (monk-cloud) 셋이 차례로 피어나 오른쪽으로 흘러가며 옅어지고,
   *  몸을 비취빛이 감싸며 안개 알갱이가 함께 흘러가고 반짝이 가루가 피어오름 */
  'monk-mist': {
    frames: 24, logical: 90, size: 320, scope: 'target',
    draw(g, { t }) {
      const by = 0.55, fade = 1 - E.in2(seg(t, 0.7, 1));
      glowOval(g, 0, by, 0.95, 0.35, J.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.7))));
      glow(g, 0, 0.1, 0.95, J.glow, 0.35 * bell(t, 0, 0.2, 0.9));
      for (let i = 0; i < 3; i++) {
        const u = seg(t, i * 0.1, i * 0.1 + 0.85), a = Math.min(1, u * 6 + (i ? 0 : 0.6)) * (1 - E.in2(seg(u, 0.5, 1))), x = lerp(-0.6 + i * 0.35, 0.1 + i * 0.35, E.out2(u)), y = by - 0.2 * i + Math.sin(u * 6 + i) * 0.04;
        if (!pic(g, 'monk-cloud', x, y, (1.4 - i * 0.15) * (0.75 + 0.25 * E.out2(u)), a, { sy: 1.05, add: 0.15 })) puff(g, x, y, 0.5 - i * 0.06, a, 7 + i * 13, 0.62);
      }
      mistMotes(g, t, 7, 30, { x0: -0.2, y0: by - 0.15, w: 1.4, h: 0.5, dx: 0.6, dy: -0.1, span: 0.6, a: fade });
      jadeSwirl(g, t, 9, 22, { y0: 0.55, rise: 1.0, rr: 0.7, t0: 0.1, span: 0.45, a: fade });
    },
  },

  /** 안개 숨결 (범위 칸마다): 가운데에서 Codex 안개 구름 (monk-cloud)이 훅 뿜어져 커지며 좌우로 갈라져 밀려나고, 흰 빛이 번쩍이며
   *  안개 알갱이 · 비취 불똥이 옆으로 흩날림. 여러 칸이라 적당히 */
  'monk-breath': {
    frames: 20, logical: 80, size: 288, scope: 'area',
    draw(g, { t }) {
      const u = E.out3(seg(t, 0, 0.6)), fade = 1 - E.in2(seg(t, 0.5, 1));
      glow(g, 0, 0.1, 0.9, J.glow, 0.7 * (1 - E.out2(seg(t, 0, 0.5))));
      glow(g, 0, 0.1, 0.45, '#ffffff', 0.55 * (1 - E.out3(seg(t, 0, 0.25))));
      // 가운데 훅 뿜는 안개 (커졌다 옅어짐)
      pic(g, 'monk-cloud', 0, 0.12, lerp(0.6, 1.3, u), (1 - E.out2(seg(t, 0.05, 0.55))), { sy: lerp(1.2, 0.8, u) });
      for (const sgn of [-1, 1]) {
        if (!pic(g, 'monk-cloud', sgn * lerp(0.15, 0.72, u), 0.15, lerp(0.6, 0.95, u), fade, { sx: sgn })) puff(g, sgn * lerp(0.15, 0.7, u), 0.12, 0.4, fade, sgn > 0 ? 11 : 17, 0.6);
      }
      particles(g, t, 8, 22, r => ({ t0: r() * 0.15, life: 0.5 + r() * 0.2, dir: r() < 0.5 ? -1 : 1, sp: 0.6 + r() * 0.6, y: (r() - 0.5) * 0.5 }), (gg, p, age) => speck(gg, p.dir * (0.15 + p.sp * E.out2(age)), 0.1 + p.y - 0.12 * age, 0.018, J.pale, (1 - age) * fade, age * 3));
      jadeBurst(g, t, 3, 12, { y: 0.1, sp: 0.8, sq: 0.5, a: fade });
      jadeSwirl(g, t, 5, 12, { y0: 0.5, rise: 0.8, rr: 0.6, t0: 0.15, span: 0.3, a: fade });
    },
  },

  /** 맑은 기운 (해제): Codex 비취 붓 획 (monk-brush-stroke) 셋이 머리 위에서 발밑까지 차례로 휙 그어지고 (위에서부터 드러남),
   *  어두운 기운이 아래로 씻겨 내려가 비취 불똥으로 부서지고, 획이 위부터 걷히며 반짝이 가루가 떠오름 */
  'monk-clear': {
    frames: 18, logical: 90, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1)), top = -1.1, bot = 1.05;
      glow(g, 0, 0, 0.9, J.glow, 0.5 * (1 - E.out2(seg(t, 0, 0.6))));
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.45, d = i === 1 ? 0 : 0.08 + 0.04 * i, down = E.out3(seg(t, d, d + 0.3)), up = E.in2(seg(t, d + 0.35, d + 0.75));
        const y0 = lerp(top, bot, up), y1 = lerp(top, bot, down);
        if (y1 > y0 + 0.01) {
          g.save(); clipRows(g, y0, y1);
          if (!pic(g, 'monk-brush-stroke', x, top, i === 1 ? 1.1 : 0.95, fade, { anchorY: 0, sx: 0.6, sy: (bot - top) / ((i === 1 ? 1.1 : 0.95) * 2), rot: (i - 1) * 0.04 })) brush(g, s => ({ x, y: lerp(top, bot, s) }), 0, 1, 0.14, fade);
          g.restore();
        }
        if (down < 1) { glow(g, x, y1, 0.25, J.glow, 0.8 * fade); speck(g, x, y1, 0.03, J.white, fade); }
      }
      // 아래로 씻겨 나가는 어두운 기운 → 비취 불똥
      particles(g, t, 3, 7, (r, i) => ({ t0: 0.12 + i * 0.05, life: 0.55, x: (r() - 0.5) * 1.1, sz: 0.06 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const y = 0.1 + 0.85 * E.out2(age), x = p.x * (1 + 0.6 * age), k = 1 - E.in2(seg(age, 0.4, 1));
        if (k > 0) { bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.4, 0, TAU); }, '#6a3a90', 0.35 * k, 4); gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 3); gg.scale(p.sz * k, p.sz * k); solid(gg, h => { h.beginPath(); for (let j = 0; j < 7; j++) { const aa = (j * TAU) / 7, rr = 0.75 + 0.3 * Math.sin(j * 2.3 + p.rot); h.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } h.closePath(); }, { hi: '#9a6ac0', lo: '#2d1b4a', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore(); }
        if (age > 0.4) for (let j = 0; j < 5; j++) { const q = seg(age, 0.4, 1), b2 = p.rot + j * 1.25; speck(gg, x + Math.cos(b2) * 0.14 * q, y + Math.sin(b2) * 0.14 * q, 0.015, J.pale, (1 - q) * fade); }
      });
      jadeBurst(g, t, 5, 18, { y: 0.0, sp: 0.9, sq: 0.9, t0: 0.05, a: fade });
      jadeSwirl(g, t, 7, 22, { y0: 0.6, rise: 1.0, rr: 0.7, t0: 0.3, span: 0.35, a: fade });
    },
  },

  /** 누그러뜨림 (받는 피해 감소): Codex 비취 물결 획 (monk-wave-stroke) 둘이 머리 위 · 발밑 (이름 · 체력 줄을 가로지르지 않게)에서 크게 출렁이다
   *  점점 잦아들어 거의 곧게 펴지고, 몸을 고요한 비취빛이 감싸며 작은 빛 점이 천천히 가라앉고 반짝임이 톡톡 켜짐 */
  'monk-soothe': {
    frames: 24, logical: 92, size: 320, scope: 'target',
    draw(g, { t }) {
      const calm = E.inOut(seg(t, 0.05, 0.75)), fade = 1 - E.in2(seg(t, 0.65, 1)), run = E.out3(seg(t, 0, 0.25));
      glowOval(g, 0, 0.05, 1.05, 0.9, J.glow, 0.5 * bell(t, 0, 0.3, 1));
      glow(g, 0, 0.05, 0.45, '#ffffff', 0.35 * (1 - E.out3(seg(t, 0, 0.3))));
      for (const [y, w, k, ph] of [[-0.68, 2.1, 1, 0], [0.88, 1.9, 0.8, 1.6]]) {
        const sy = lerp(1.1, 0.12, calm) * (0.92 + 0.08 * Math.sin(t * 14 + ph)), a = fade * k;
        g.save(); g.beginPath(); g.rect(-w / 2 * run, y - 0.6, w * run, 1.2); g.clip();
        if (!pic(g, 'monk-wave-stroke', 0, y, w, a, { sy, add: 0.25 * (1 - calm) })) brush(g, s => ({ x: lerp(-1, 1, s), y: y + Math.sin(s * 9) * 0.15 * (1 - calm) }), 0, 1, 0.1, a);
        g.restore();
      }
      // 가라앉는 빛 점
      particles(g, t, 4, 30, r => ({ t0: 0.1 + r() * 0.55, life: 0.45, x: (r() - 0.5) * 1.8, y: -0.7 + r() * 0.5, sz: 0.012 + r() * 0.018, ph: r() * 9 }), (gg, p, age) => speck(gg, p.x, p.y + 0.55 * E.out2(age), p.sz, J.pale, bell(age, 0, 0.2, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 12)));
      glints(g, t, 6, 6, { t0: 0.45, step: 0.06, w: 1.6, y0: 0.1, h: 0.9, a: fade });
    },
  },

  /** 되살림 바람 (파티 전원): Codex 비취 바람 (monk-wind, 끝이 말리는 붓 바람 줄기)이 왼쪽 아래에서 오른쪽 위로 쓸어 올라가며 드러나고,
   *  Codex 꽃잎 (monk-petal)이 바람을 타고 날며 반짝이 가루가 소용돌이침. 파티 전원 칸이라 가볍게 */
  'monk-wind': {
    frames: 20, logical: 80, size: 288, scope: 'party',
    draw(g, { t }) {
      const run = E.out2(seg(t, 0, 0.5)), fade = 1 - E.in2(seg(t, 0.55, 1));
      glow(g, 0, 0, 0.75, J.glow, 0.45 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, 0.05, 0.35, '#ffffff', 0.35 * (1 - E.out3(seg(t, 0, 0.25))));
      // 바람 (왼쪽 아래 → 오른쪽 위로 드러남: 대각선 가림)
      g.save(); g.beginPath(); const k = lerp(-1.6, 1.8, run); g.moveTo(-3, -3); g.lineTo(k - 1.3, -3); g.lineTo(k + 1.3, 3); g.lineTo(-3, 3); g.closePath(); g.clip();
      if (!pic(g, 'monk-wind', 0, 0, 1.75, fade, { add: 0.25 * (1 - seg(t, 0.1, 0.5)) })) brush(g, s => ({ x: lerp(-0.9, 0.6, s), y: lerp(0.7, -0.6, s) }), 0, 1, 0.14, fade);
      g.restore();
      // 꽃잎
      particles(g, t, 2, 6, (r, i) => ({ t0: 0.04 + i * 0.06, life: 0.7, x0: -0.8 + r() * 0.3, y0: 0.6 - r() * 0.25, rot: r() * 6, sz: 0.18 + r() * 0.08 }), (gg, p, age) => {
        const x = p.x0 + 1.45 * E.out2(age), y = p.y0 - 1.25 * E.out2(age) + Math.sin(age * 8 + p.rot) * 0.08;
        if (!pic(gg, 'monk-petal', x, y, p.sz, (1 - E.in2(age)) * fade, { rot: p.rot + age * 6 })) speck(gg, x, y, 0.03, '#ffffff', (1 - age) * fade);
      });
      jadeSwirl(g, t, 5, 14, { y0: 0.5, rise: 0.9, rr: 0.6, t0: 0.15, span: 0.35, a: fade });
      glints(g, t, 7, 3, { t0: 0.3, step: 0.08, w: 1.2, y0: -0.2, h: 0.8, a: fade });
    },
  },

  /** 차 한 잔 (내 칸, 마나 · 기 리듬): 발밑 쪽에 Codex 비취 찻잔 (monk-teacup)이 톡 놓이고, 찻김 두 줄이 S자로 피어올라 위에서 흩어지며
   *  하늘빛 마나 알갱이 · 비취 반짝이가 김을 타고 오르고 몸이 은은히 빛남 */
  'monk-tea': {
    frames: 24, logical: 88, size: 320, scope: 'target',
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.2), 1.6), fade = 1 - E.in2(seg(t, 0.7, 1)), cy = 0.55;
      glowOval(g, 0, cy + 0.15, 0.8, 0.4, J.glow, 0.65 * fade);
      glow(g, 0, 0.05, 0.9, J.glow, 0.38 * bell(t, 0, 0.2, 0.85));
      // 김 (S자 두 줄 + 흐린 덩이)
      for (const [x0, ph, d] of [[-0.1, 0, 0.1], [0.12, 2.2, 0.18]]) {
        const u = seg(t, d, d + 0.65), P = s => ({ x: x0 + Math.sin(s * 5.5 + ph + t * 4) * 0.12, y: lerp(cy - 0.2, cy - 1.3, s) });
        if (u > 0) {
          lightStroke(g, P, Math.max(0, u - 0.6), u, w0 => 0.1 * Math.sin(Math.PI * w0), { rim: '#7aa898', body: J.white, core: '#ffffff', a: fade * 0.9 * (1 - seg(u, 0.7, 1)), rimW: 0.015, glowCol: J.glow, glowA: 0.4 });
          const q = P(u); bloom(g, h => { h.beginPath(); h.arc(q.x, q.y, 0.14, 0, TAU); }, J.pale, 0.3 * fade * (1 - seg(u, 0.7, 1)), 5);
        }
      }
      // 찻잔 (받침 바닥 = 그림 92%)
      if (pop > 0 && !pic(g, 'monk-teacup', 0, cy + 0.35, 0.8 * pop, fade, { anchorY: 0.92, add: 0.2 * bell(t, 0.05, 0.15, 0.4) })) {
        g.save(); g.translate(0, cy); g.scale(0.4 * pop, 0.4 * pop); solid(g, h => path.rect(h, 1.5, 0.9, 0.3), { hi: J.pale, lo: J.deep, rim: J.rim, a: fade }); g.restore();
      }
      // 김을 타고 오르는 마나 (하늘빛) · 비취 알갱이
      particles(g, t, 9, 26, r => ({ t0: 0.15 + r() * 0.5, life: 0.45 + r() * 0.2, x: (r() - 0.5) * 0.5, sz: 0.012 + r() * 0.018, ph: r() * 9, mana: r() < 0.45 }), (gg, p, age) => {
        const x = p.x + Math.sin(age * 6 + p.ph) * 0.1, y = cy - 0.15 - 1.1 * E.out2(age);
        glow(gg, x, y, p.sz * 5, p.mana ? '#7ab8ff' : J.glow, 0.4 * bell(age, 0, 0.15, 1) * fade);
        speck(gg, x, y, p.sz, p.mana ? '#d8ecff' : J.pale, bell(age, 0, 0.15, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 16));
      });
      glint(g, -0.15, cy - 0.12, 0.2 * bell(t, 0.15, 0.25, 0.45), J.glow, 1, 0.3, 0.14, J.white);
    },
  },
};
