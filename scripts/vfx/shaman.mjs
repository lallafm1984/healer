// 주술사: 깊은 물빛 (청록 · 파랑 + 흰 물거품) · 흙빛 돌 · 영혼 남빛. 사제 정화의 하늘빛보다 진하고 물결 · 물줄기 · 돌처럼 무게 있는 모양
// 2026-10-19 Lim 「주술사의 정화, 연쇄, 잇기, 방울 이펙트도 똑같이 개선」 (결계사 · 점성술사처럼): 칸 가득, 맞는 순간 흰 섬광 + 물빛 · 영혼 남빛 고리, 빛 번짐 물빛 가루 (영혼 남빛 포인트) 1.5배
// → 같은 날 「방울이 떨어질때의 모양이 퀄리티가 낮다. 모범사례는 수도사이다. 비슷한 형식으로 잇기, 방울, 연쇄, 정화를 개선」: 만화 물방울 · 물살 도형 대신 수도사처럼 빛 띠 (wchi) · 빛나는 머리 (whead) · 물안개 (foam) · 파티클만
import { asset, bell, bez, bloom, C, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, rng, seg, solid, speck, talentFx, TAU } from './lib.mjs';

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

/** 물거품 방울 (투명 몸 + 테 + 흰 점) */
function bubble(g, x, y, r, a = 1) {
  if (r <= 0 || a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = C(W.light, 0.35); g.fill();
  g.lineWidth = r * 0.3; g.strokeStyle = C(W.rim, 0.75); g.stroke(); g.lineWidth = r * 0.15; g.strokeStyle = C(W.foam, 0.9); g.stroke();
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
  g.restore();
}

/** 위로 떠오르는 물빛 알갱이 (흰 심 + 물빛 번짐, 반짝임): 잔물결 · 토템 루프 공통 */
function rise(g, x, y, sz, a, tw, col = W.light) {
  if (a <= 0) return;
  glow(g, x, y, sz * 4.5, W.glow, 0.5 * a, true);
  speck(g, x, y, sz, col, a, tw);
}
/** 0–1이 한 바퀴인 루프 시간의 소수부 · 사인 (k = 한 바퀴에 몇 번, 정수여야 이음매 없음) */
const frac = v => v - Math.floor(v);
const wave = (t, k = 1, ph = 0) => 0.5 + 0.5 * Math.sin(TAU * (t * k + ph));
/**
 * 판 위 토템 (board-totem-spring · earth = 주술사 자원 그림의 토템을 잘라 낸 것)과 같은 자리 · 크기: 토템 그림 한 변 = 칸 반지름 × TOTEM (battle/pxf.ts TOTEM_STAND),
 * 자른 네모 한 변 = 게이지 원화 (1355 좌표) 470. 토템 가운데 기준 원화 좌표 → 칸 반지름 단위
 */
export const TOTEM = 1.1;
const tp = (x, y) => ({ x: (x * TOTEM) / 470, y: (y * TOTEM) / 470 });
/** 작은 돌 조각 (대지 토템 루프): 다섯 · 여섯 모 돌, 거의 검은 테 */
function pebble(g, x, y, sz, rot, a, n = 6) {
  if (a <= 0 || sz <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sz, sz * 0.85);
  solid(g, h => { h.beginPath(); for (let j = 0; j < n; j++) { const aa = (j * TAU) / n, r2 = 0.8 + 0.25 * Math.sin(j * 2.7 + n); h.lineTo(Math.cos(aa) * r2, Math.sin(aa) * r2); } h.closePath(); }, { hi: STONE.light, lo: STONE.dark, rim: STONE.rim, rimW: 0.2, a, shine: 0.35 });
  g.restore();
}
const AMBER = { rim: '#5a2a06', body: '#f0a03a', light: '#ffd27a', glow: '#ffb347' };
/** 맞는 순간: 흰 섬광 + 물빛 번짐 + 퍼지는 물빛 고리 · 영혼 남빛 고리 (sy = 고리 납작함) */
function impact(g, t, { x = 0, y = 0, t0 = 0, r = 1.15, sy = 0.9, a = 1 } = {}) {
  const u = seg(t, t0, t0 + 0.45);
  glow(g, x, y, r * 1.05, W.glow, 0.6 * (1 - E.out2(seg(t, t0, t0 + 0.55))) * a);
  glow(g, x, y, r * 0.45, '#ffffff', 0.85 * bell(t, t0 - 0.02, t0 + 0.03, t0 + 0.28) * a);
  if (u > 0 && u < 1) { ringGlow(g, x, y, lerp(0.25, r * 1.2, E.out3(u)), 0.08, W.light, 0.8 * (1 - u) * a, sy); ringGlow(g, x, y, lerp(0.15, r * 0.9, E.out3(seg(t, t0 + 0.06, t0 + 0.5))), 0.06, SPIRIT.light, 0.65 * (1 - u) * a, sy); }
}
/** 사방으로 튀는 물빛 가루 (30%는 영혼 남빛) */
function waterBurst(g, t, seed, n, { x = 0, y = 0, sp = 1.0, sq = 0.8, t0 = 0, a = 1, grav = 0.3 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * 0.06, life: 0.35 + r() * 0.3, ang: r() * TAU, v: sp * (0.5 + r() * 0.7), sz: 0.018 + r() * 0.026, ph: r() * 9, sp2: r() < 0.3 }), (gg, p, age) => {
    const d = p.v * E.out3(age), px = x + Math.cos(p.ang) * d, py = y + Math.sin(p.ang) * d * sq + grav * age * age, al = (1 - E.in2(age)) * a;
    glow(gg, px, py, p.sz * 4, p.sp2 ? SPIRIT.glow : W.glow, 0.45 * al);
    speck(gg, px, py, p.sz * (1 - 0.4 * age), p.sp2 ? SPIRIT.light : age < 0.4 ? W.foam : W.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 20));
  });
}
/** 발밑에서 돌며 떠오르는 물빛 가루 */
function waterSwirl(g, t, seed, n, { y0 = 0.75, rise: up = 1.3, rr = 0.95, t0 = 0, span = 0.4, a = 1 } = {}) {
  particles(g, t, seed, n, r => ({ t0: t0 + r() * span, life: 0.45 + r() * 0.35, a0: r() * TAU, rr: 0.15 + r() * rr, y0: y0 + r() * 0.2, up: up * (0.7 + r() * 0.6), sz: 0.016 + r() * 0.026, spin: (r() < 0.5 ? -1 : 1) * (1.2 + r()), ph: r() * 9, sp2: r() < 0.3 }), (gg, p, age) => {
    const ang = p.a0 + p.spin * age * 2.4, rad2 = p.rr * (1 - 0.3 * age), x = Math.cos(ang) * rad2, y = p.y0 - p.up * E.out2(age) + Math.sin(ang) * rad2 * 0.22, al = bell(age, 0, 0.12, 1) * a;
    glow(gg, x, y, p.sz * 4.5, p.sp2 ? SPIRIT.glow : W.glow, 0.4 * al);
    speck(gg, x, y, p.sz, p.sp2 ? SPIRIT.light : W.light, al, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
  });
}
/** 차례로 켜지는 물빛 반짝임 (셋 중 하나는 영혼 남빛) */
function wglints(g, t, seed, n, { t0 = 0.1, step = 0.06, w = 2.0, y0 = 0, h = 1.6, a = 1 } = {}) {
  particles(g, t, seed, n, (r, i) => ({ t0: t0 + i * step + r() * 0.03, life: 0.28, x: (r() - 0.5) * w, y: y0 + (r() - 0.5) * h, rot: r(), sp2: i % 3 === 1 }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.08, 0.24 * Math.sin(Math.PI * age), p.sp2 ? SPIRIT.glow : W.glow, a, p.rot, 0.13, W.foam));
}
/** 물빛 띠 (수도사 기 띠처럼 굵고 양끝 가는 빛 띠, 2026-10-19): 경로 P의 s0 ~ s1 */
function wchi(g, P, s0, s1, w, a = 1, body = W.body, glowCol = W.glow) {
  if (s1 <= s0 + 1e-3 || a <= 0) return;
  lightStroke(g, P, s0, s1, u => w * Math.sin(Math.PI * u) ** 0.7, { rim: W.rim, body, core: W.foam, a, rimW: 0.018, coreW: 0.42, glowCol, glowA: 0.75 });
}
/** 빛나는 물빛 머리 (띠 끝 · 떨어지는 방울) */
function whead(g, x, y, a = 1, r = 0.3, col = W.glow) { glow(g, x, y, r, col, 0.85 * a); glow(g, x, y, r * 0.55, W.light, 0.7 * a); glow(g, x, y, r * 0.3, '#ffffff', 0.95 * a); }
/** 물안개 · 물보라 뭉치 (부드러운 타원 여럿: 아래 깊은 물빛 그늘 → 밝은 물빛 → 흰 심) */
function foam(g, x, y, r, a, seed = 1, sy = 0.55) {
  if (r <= 0 || a <= 0) return;
  const R2 = rng(seed), blobs = [...Array(5)].map((_, i) => [(i - 2) * r * 0.32 + (R2() - 0.5) * r * 0.2, (R2() - 0.5) * r * 0.35 - (i % 2) * r * 0.12, r * (0.42 + R2() * 0.3) * (i === 2 ? 1.3 : 1)]);
  const soft = (cx, cy, rr, col, al) => { g.save(); g.translate(cx, cy); g.scale(1, sy); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, C(col, al)); gr.addColorStop(0.55, C(col, al * 0.8)); gr.addColorStop(1, C(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill(); g.restore(); };
  for (const [dx, dy, rr] of blobs) soft(x + dx, y + dy + rr * 0.22, rr * 1.1, W.deep, 0.45 * a);
  for (const [dx, dy, rr] of blobs) soft(x + dx, y + dy, rr, W.light, 0.8 * a);
  for (const [dx, dy, rr] of blobs) soft(x + dx - rr * 0.15, y + dy - rr * 0.2 * sy, rr * 0.55, '#ffffff', 0.85 * a);
}

export default {
  /** 잔물결: 발밑에 물방울이 톡 떨어진 자리에서 위에서 본 납작한 물결 두 겹이 차례로 퍼지고 작은 물방울이 튐.
   *  퍼지는 물결 자리에서 파란 빛 알갱이 · 물거품 · 짧은 빛줄기가 몸을 따라 위로 떠오름 (Lim 2026-10-18 「물결 이펙트가 덜 화려함, 위로 파란 파티클이 올라가게」) */
  'shaman-ripple': {
    frames: 24, logical: 88, scope: 'target',
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
      // 위로 떠오르는 물빛: 몸을 감싸는 옅은 기둥 + 흐린 물빛 덩이 + 물결 고리에서 태어나 흔들리며 오르는 파란 알갱이 · 물거품 · 가는 빛줄기, 꼭대기에서 반짝
      glowOval(g, 0, -0.05, 0.66, 1.7, W.glow, 0.38 * bell(t, 0.05, 0.3, 0.85));
      for (let i = 0; i < 3; i++) {
        const u = seg(t, 0.08 + i * 0.08, 0.75 + i * 0.06), a = i * 2.1 + t * 4, x = Math.cos(a) * 0.32, y = lerp(0.5, -0.55, E.out2(u));
        if (u > 0 && u < 1) bloom(g, h => { h.beginPath(); h.arc(x, y, 0.24 + 0.06 * Math.sin(i + t * 5), 0, TAU); }, i % 2 ? W.glow : W.deep, 0.32 * Math.sin(Math.PI * u), 7);
      }
      particles(g, t, 21, 58, r => ({ t0: 0.03 + r() * 0.5, life: 0.42 + r() * 0.32, a: r() * TAU, rr: 0.2 + r() * 0.8, rise: 1.0 + r() * 0.75, sz: 0.016 + r() * 0.028, sway: (r() - 0.5) * 0.2, ph: r() * 9 }), (gg, p, age) => {
        const x = Math.cos(p.a) * p.rr * (1 - 0.3 * age) + p.sway * Math.sin(age * 7 + p.ph), y = by + Math.sin(p.a) * p.rr * 0.32 - p.rise * E.out2(age);
        rise(gg, x, y, p.sz * (1 - 0.35 * age), bell(age, 0, 0.12, 1), 0.5 + 0.5 * Math.sin(p.ph + age * 20), Math.sin(p.ph) > 0 ? W.light : W.foam);
      });
      particles(g, t, 23, 10, r => ({ t0: 0.06 + r() * 0.4, life: 0.5 + r() * 0.2, x: (r() - 0.5) * 1.2, sz: 0.035 + r() * 0.025, ph: r() * 9 }), (gg, p, age) =>
        bubble(gg, p.x + Math.sin(age * 9 + p.ph) * 0.05, by - 0.05 - 1.25 * E.out2(age), p.sz * (1 - 0.3 * age), bell(age, 0, 0.15, 1) * 0.95));
      // 가는 빛줄기 (아래 → 위로 솟는 짧은 물빛 선, 꼬리는 흐리게)
      particles(g, t, 25, 9, r => ({ t0: 0.05 + r() * 0.35, life: 0.3 + r() * 0.12, x: (r() - 0.5) * 1.25, len: 0.2 + r() * 0.16 }), (gg, p, age) => {
        const y = by - 0.15 - 1.3 * E.out2(age);
        lightStroke(gg, s2 => ({ x: p.x, y: lerp(y + p.len, y, s2) }), 0, 1, u => 0.03 * u, { rim: W.rim, body: W.body, core: W.foam, a: bell(age, 0, 0.2, 1) * 0.9, rimW: 0.008, glowCol: W.glow, glowA: 0.6 });
      });
      particles(g, t, 27, 7, (r, i) => ({ t0: 0.22 + i * 0.07 + r() * 0.04, life: 0.28, x: (r() - 0.5) * 1.15, y: -0.35 - r() * 0.45, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y - age * 0.1, 0.19 * Math.sin(Math.PI * age), W.glow, 1, p.rot, 0.13, W.foam));
    },
  },

  /** 물방울 (지속, 2026-10-19 Lim 「방울이 떨어질때의 모양이 퀄리티가 낮다 … 수도사처럼」): 머리 위에서 빛나는 물빛 구슬이 굵은 빛 꼬리를 끌며 떨어지고 (꼬리에서 물빛 가루가 흩날림),
   *  닿는 순간 흰 섬광 · 물빛 · 영혼 남빛 충격파와 함께 물보라 뭉치가 피어나고 빛 띠 왕관이 사방으로 휘어 튀며, 물빛 가루가 퍼지고 몸으로 스며들며 소용돌이쳐 떠오름 */
  'shaman-droplet': {
    frames: 22, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const hit = 0.24, yHit = -0.2, fade = 1 - E.in2(seg(t, 0.55, 1)), fy = v => lerp(-1.4, yHit, E.in2(seg(v, 0, hit)));
      particles(g, t, 31, 44, (r, i) => ({ t0: (i / 44) * hit * 0.95, life: 0.32 + r() * 0.26, dx: (r() - 0.5) * 0.9, dy: (r() - 0.6) * 0.35, sz: 0.018 + r() * 0.026, ph: r() * 9 }), (gg, p, age) => {
        const x = p.dx * E.out2(age), y = fy(p.t0) - 0.1 + p.dy * age + 0.14 * age * age;
        rise(gg, x, y, p.sz * (1 - 0.3 * age), (1 - E.in2(age)) * 0.95, 0.5 + 0.5 * Math.sin(p.ph + age * 16), p.ph > 6.5 ? SPIRIT.light : W.light);
      });
      if (t < hit) {
        const y = fy(t), sp = seg(t, 0, hit);
        wchi(g, s2 => ({ x: Math.sin(s2 * 4 + t * 10) * 0.03 * (1 - s2), y: lerp(y - 0.95 * (0.4 + sp), y, s2) }), 0, 1, 0.26, 0.95);
        whead(g, 0, y, 1, 0.42);
        return;
      }
      const u = seg(t, hit, 1);
      impact(g, u, { y: yHit + 0.1, r: 1.25, sy: 0.55 });
      glowOval(g, 0, 0.15, 1.15, 1.05, W.glow, 0.45 * (1 - E.out2(seg(u, 0, 0.7))));
      // 물보라 뭉치 (가운데 크게 + 양옆)
      const bloomK = E.out3(seg(u, 0, 0.35)), fadeF = (1 - E.in2(seg(u, 0.3, 0.85))) * fade;
      foam(g, 0, yHit + 0.08, 0.5 * bloomK, 0.85 * fadeF, 3, 0.55);
      for (const sgn of [-1, 1]) foam(g, sgn * 0.55 * bloomK, yHit + 0.2, 0.3 * bloomK, 0.7 * fadeF, sgn > 0 ? 5 : 6, 0.5);
      // 빛 띠 왕관 (위 · 옆으로 휘어 튀었다 떨어짐)
      for (let i = 0; i < 7; i++) {
        const an = rad(-90 + (i - 3) * 27), L = (i % 2 ? 0.8 : 1.15) * E.out3(seg(u, 0, 0.4)), d = seg(u, 0.25, 0.75);
        const P = s2 => ({ x: Math.cos(an) * L * s2 * 1.05, y: yHit + 0.08 + Math.sin(an) * L * s2 + 0.55 * s2 * s2 * (0.2 + u) });
        wchi(g, P, d, 1, 0.12, fade * (1 - seg(u, 0.55, 0.9)), i % 3 === 1 ? SPIRIT.light : W.light, i % 3 === 1 ? SPIRIT.glow : W.glow);
        if (u < 0.6) { const q = P(1); whead(g, q.x, q.y, fade * (1 - seg(u, 0.4, 0.6)), 0.14); }
      }
      waterBurst(g, u, 33, 70, { y: yHit + 0.1, sp: 1.45, sq: 0.6, a: fade, grav: 0.45 });
      wglints(g, u, 35, 8, { t0: 0.03, step: 0.05, a: fade });
      particles(g, u, 9, 18, r => ({ t0: 0.15 + r() * 0.4, life: 0.4, x: (r() - 0.5) * 1.4, y: yHit + 0.1 + r() * 0.1 }), (gg, p, age) => rise(gg, p.x * (1 - age * 0.5), p.y + 0.75 * age, 0.026, (1 - age) * fade, age * 3));
      waterSwirl(g, u, 11, 34, { t0: 0.2, a: fade });
    },
  },

  /** 씻김 (해제, 2026-10-19 수도사처럼): 발밑에서 흰 섬광 · 물빛 충격파와 함께 굵은 물빛 띠 둘이 나선으로 몸을 휘감아 오르고 (빛나는 머리 · 띠를 따라 물안개가 피어남),
   *  어두운 기운 덩이가 휩쓸려 튕겨 나가 물빛 가루로 부서지며, 머리 위에서 띠가 만나 물보라 뭉치와 빛 띠 왕관이 터지고 물빛 가루가 쏟아짐 */
  'shaman-washing': {
    frames: 22, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.64, 1)), hd = E.inOut(seg(t, 0, 0.5)), tl = Math.max(0, hd - 0.6) + 0.4 * E.in2(seg(t, 0.5, 0.92)), by = 0.95, top = -1.1;
      impact(g, t, { y: by, r: 1.1, sy: 0.32 });
      glowOval(g, 0, 0, 1.05, 1.15, W.glow, 0.3 * fade);
      for (const side of [0, Math.PI]) {
        const P = s2 => { const an = side + s2 * TAU * 1.3; return { x: Math.cos(an) * 0.95 * (1 - 0.35 * s2 * s2), y: lerp(by, top, s2) + Math.sin(an) * 0.2 * (1 - s2) }; };
        for (let k = 0; k < 6; k++) { const q = P(lerp(tl, hd, (k + 0.5) / 6)); foam(g, q.x, q.y, 0.22, 0.3 * fade, k + (side ? 10 : 0)); }
        wchi(g, P, tl, hd, 0.16, 0.95 * fade, side ? W.light : W.body);
        if (hd < 1) { const q = P(hd); whead(g, q.x, q.y, fade, 0.34); waterBurst(g, t, side ? 21 : 22, 6, { x: q.x, y: q.y, sp: 0.3, t0: t - 0.05, a: fade, grav: 0.1 }); }
      }
      // 휩쓸려 튕겨 나가는 어두운 기운 → 물빛 가루
      particles(g, t, 12, 6, (r, i) => ({ t0: 0.12 + i * 0.05, life: 0.6, a: rad(-170 + i * 50 + r() * 20), sz: 0.1 + r() * 0.05, ph: r() * 9 }), (gg, p, age) => {
        const d = 0.25 + 1.0 * E.out3(age), x = Math.cos(p.a) * d, y = 0.05 + Math.sin(p.a) * d * 0.85 + 0.3 * age * age, k = 1 - E.in2(seg(age, 0.35, 1));
        if (k > 0) { bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * k, 0, TAU); }, '#4a2a70', 0.75 * k * fade, 5); bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 0.55 * k, 0, TAU); }, '#1a0e2a', 0.8 * k * fade, 2); }
        if (age > 0.35) for (let j = 0; j < 6; j++) { const q = seg(age, 0.35, 1), b2 = p.ph + j * 1.05; speck(gg, x + Math.cos(b2) * 0.2 * q, y + Math.sin(b2) * 0.2 * q, 0.022, W.light, (1 - q) * fade); }
      });
      // 머리 위 물보라 + 빛 띠 왕관
      const crown = seg(t, 0.46, 0.9);
      if (crown > 0) {
        impact(g, crown, { y: top + 0.05, r: 0.95, sy: 0.6 });
        foam(g, 0, top + 0.05, 0.42 * E.out3(Math.min(1, crown * 2.5)), 0.85 * (1 - E.in2(crown)) * fade, 7, 0.55);
        for (let i = 0; i < 7; i++) {
          const an = rad(-90 + (i - 3) * 26), L = 0.7 * E.out3(Math.min(1, crown * 2)) * (i % 2 ? 0.75 : 1);
          wchi(g, s2 => ({ x: Math.cos(an) * L * s2 * 1.1, y: top + 0.08 + Math.sin(an) * L * s2 + 0.4 * crown * s2 * s2 }), seg(crown, 0.3, 0.8), 1, 0.1, fade * (1 - seg(crown, 0.6, 1)), W.light);
        }
        waterBurst(g, crown, 8, 40, { y: top + 0.1, sp: 1.25, sq: 0.8, a: fade, grav: 0.6 });
      }
      waterSwirl(g, t, 13, 34, { t0: 0.35, a: fade });
      wglints(g, t, 14, 8, { t0: 0.3, a: fade });
    },
  },
  /** 연쇄 치유 (튄 칸마다, 2026-10-19 수도사처럼): 앞 사람 쪽에서 굵은 물빛 띠가 빛나는 머리를 앞세워 휘어 날아와 닿고, 흰 섬광 · 물빛 · 영혼 남빛 충격파와 함께
   *  물보라 뭉치가 피어나며 빛 띠 아홉이 사방으로 튀고 물빛 가루가 퍼짐.
   *  그림은 왼쪽에서 들어오고, 게임이 앞 사람 (첫 대상은 나) 쪽으로 돌려 그리며 튄 순서대로 0.16초씩 늦춤 (battle/index.ts) */
  'shaman-chain': {
    frames: 16, logical: 100, size: 320, scope: 'target',
    draw(g, { t }) {
      const hit = 0.26, fade = 1 - E.in2(seg(t, 0.45, 1));
      const P = bez([-1.5, 0.05], [-1.1, -0.6], [-0.45, -0.55], [0, 0.02]);
      const hd = lerp(0.25, 1, E.in2(seg(t, 0, hit))), tl = Math.max(0, hd - 0.7) + 0.3 * seg(t, hit, hit + 0.15);
      if (t < hit + 0.15) wchi(g, P, tl, hd, 0.24, 1 - seg(t, hit, hit + 0.15));
      if (t < hit) { const q = P(hd); whead(g, q.x, q.y, 1, 0.34); }
      particles(g, t, 7, 24, (r, i) => ({ t0: (i / 24) * hit, life: 0.3 + r() * 0.2, dx: (r() - 0.5) * 0.3, dy: (r() - 0.5) * 0.3, sz: 0.018 + r() * 0.022, s0: r() }), (gg, p, age) => { const q = P(lerp(0.25, 1, E.in2(p.t0 / hit))); rise(gg, q.x + p.dx * age, q.y + p.dy * age + 0.2 * age * age, p.sz * (1 - 0.3 * age), 1 - age, age * 3); });
      impact(g, t, { y: 0.05, t0: hit, r: 1.25, sy: 0.85 });
      if (t >= hit) {
        const u = seg(t, hit, 1), k = E.out3(seg(u, 0, 0.35)), ff = (1 - E.in2(seg(u, 0.3, 0.85))) * fade;
        foam(g, 0, 0.05, 0.48 * k, 0.85 * ff, 4, 0.6);
        for (let i = 0; i < 9; i++) {
          const an = (i * TAU) / 9 + 0.2, L = (0.85 + 0.4 * Math.max(0, Math.cos(an))) * E.out3(seg(u, 0, 0.4));
          const Q = s2 => ({ x: Math.cos(an) * lerp(0.15, L, s2), y: 0.05 + Math.sin(an) * lerp(0.15, L, s2) * 0.8 + 0.3 * u * s2 * s2 });
          wchi(g, Q, seg(u, 0.2, 0.7), 1, 0.13, fade * (1 - seg(u, 0.5, 0.9)), i % 3 === 1 ? SPIRIT.light : W.light, i % 3 === 1 ? SPIRIT.glow : W.glow);
          if (u < 0.55) { const q = Q(1); whead(g, q.x, q.y, fade * (1 - seg(u, 0.35, 0.55)), 0.13); }
        }
        waterBurst(g, u, 4, 60, { y: 0.05, sp: 1.45, sq: 0.85, a: fade });
        wglints(g, u, 5, 8, { t0: 0.04, a: fade });
        waterSwirl(g, u, 6, 22, { t0: 0.2, a: fade });
      }
    },
  },
  /** 대지 토템 (Lim 2026-10-18 「토템 스킬 발동 이펙트를 고퀄리티로」): 쿵 하고 땅이 갈라지며 호박빛 금이 사방으로 번지고, Codex로 그린 돌 가시 셋
   *  (scripts/vfx/assets/shaman-spikes, 대지 토템 왕관과 같은 돌 · 구리 띠 · 호박 보석)이 땅에서 솟구쳐 흙먼지 · 돌 조각이 튄 뒤 다시 가라앉음. 호박빛 불티가 떠오름 */
  'shaman-earth': {
    frames: 22, logical: 94, scope: 'target',
    draw(g, { t }) {
      const by = 0.7, fade = 1 - E.in2(seg(t, 0.72, 1)), hit = 1 - E.out2(seg(t, 0, 0.35));
      // 쿵: 발밑 호박빛 번쩍임 + 납작한 충격파 두 겹
      glowOval(g, 0, by, 1.05, 0.32, AMBER.glow, 0.8 * hit);
      glowOval(g, 0, by, 0.45, 0.4, '#fff4d8', 0.9 * (1 - E.out3(seg(t, 0, 0.2))));
      ringGlow(g, 0, by, lerp(0.2, 1.1, E.out3(seg(t, 0, 0.45))), 0.08, AMBER.glow, 0.75 * (1 - seg(t, 0.05, 0.5)), 0.3);
      ringGlow(g, 0, by, lerp(0.1, 0.75, E.out3(seg(t, 0.08, 0.55))), 0.05, '#c9a060', 0.6 * (1 - seg(t, 0.12, 0.6)), 0.3);
      // 갈라진 땅: 가운데에서 사방으로 뻗는 금 (어두운 금 + 호박빛 속)
      const crack = E.out3(seg(t, 0, 0.22)), cf = fade * (1 - seg(t, 0.55, 0.9));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.35, L = (0.55 + 0.3 * ((i * 5) % 3) / 2) * crack;
        const P = s2 => ({ x: Math.cos(a) * L * s2 + Math.sin(s2 * 9 + i) * 0.03, y: by + Math.sin(a) * L * s2 * 0.3 });
        lightStroke(g, P, 0, 1, u => 0.035 * (1 - u * 0.7), { rim: STONE.rim, body: AMBER.body, core: '#fff4d8', a: cf, rimW: 0.018, glowCol: AMBER.glow, glowA: 0.7 });
      }
      // 돌 가시 (그림): 땅 선 아래는 가려지고, 튀어 오르듯 솟았다가 끝에 다시 가라앉음
      const img = asset('shaman-spikes');
      const grow = Math.min(1.04, E.back(seg(t, 0.02, 0.24), 1.5)), sink = E.in2(seg(t, 0.42, 0.8)), up = grow * (1 - sink), W = 1.35;
      if (img && up > 0.01) {
        g.save(); g.beginPath(); g.rect(-2, -2, 4, by + 2.02); g.clip();
        g.globalAlpha = fade; g.drawImage(img, -W / 2, by - W * up, W, W);
        const flash = 1 - E.out2(seg(t, 0.05, 0.3));
        if (flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * flash; g.drawImage(img, -W / 2, by - W * up, W, W); }
        g.restore();
      }
      // 흙먼지 구름 (발밑에서 옆으로 퍼지며 옅어짐)
      for (let i = 0; i < 5; i++) {
        const u = seg(t, 0.04 + i * 0.03, 0.75), side = i % 2 ? 1 : -1, x = side * lerp(0.1, 0.55 + 0.1 * i, E.out2(u)) * (i === 4 ? 0 : 1), y = by - 0.05 - 0.18 * E.out2(u);
        if (u > 0 && u < 1) bloom(g, h => { h.beginPath(); h.arc(x, y, 0.16 + 0.14 * u, 0, TAU); }, i % 2 ? '#c9a878' : '#a8875a', 0.5 * Math.sin(Math.PI * u) * fade, 6);
      }
      // 돌 조각 · 흙덩이 (포물선)
      particles(g, t, 4, 16, r => ({ t0: 0.03 + r() * 0.12, life: 0.45 + r() * 0.25, x: (r() - 0.5) * 0.7, vx: (r() - 0.5) * 1.8, vy: 0.9 + r() * 0.9, sz: 0.035 + r() * 0.04, rot: r() * 6, n: 5 + Math.floor(r() * 2) }), (gg, p, age) => {
        const x = p.x + p.vx * age, y = by - 0.05 - p.vy * age + 2.2 * age * age;
        if (y < by + 0.1) pebble(gg, x, y, p.sz, p.rot + age * 7, (1 - E.in2(age)) * fade, p.n);
      });
      // 호박빛 불티 · 큰 반짝임
      particles(g, t, 8, 30, r => ({ t0: 0.08 + r() * 0.45, life: 0.4 + r() * 0.3, x: (r() - 0.5) * 1.3, rise: 0.7 + r() * 0.8, sz: 0.012 + r() * 0.02, ph: r() * 9 }), (gg, p, age) => {
        const x = p.x + 0.05 * Math.sin(age * 8 + p.ph), y = by - 0.1 - p.rise * E.out2(age);
        glow(gg, x, y, p.sz * 4.5, AMBER.glow, 0.5 * bell(age, 0, 0.15, 1) * fade);
        speck(gg, x, y, p.sz, AMBER.light, bell(age, 0, 0.15, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 18));
      });
      particles(g, t, 9, 5, (r, i) => ({ t0: 0.12 + i * 0.07, life: 0.28, x: (r() - 0.5) * 1.1, y: by - 0.4 - r() * 0.7, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y, 0.17 * Math.sin(Math.PI * age), AMBER.glow, fade, p.rot, 0.13, '#fff4d8'));
    },
  },

  /** 비구름 토템 (파티 전원 · 2초마다, Lim 2026-10-18 「토템 발동 이펙트 고퀄리티」): Codex로 그린 몽실한 비구름 (scripts/vfx/assets/shaman-raincloud, 판 위 비구름 토템과 같은 구름)이
   *  머리 위에 톡 부풀어 떠서, 그늘진 배에서 물빛 빗줄기가 비스듬히 내리고 발밑에 작은 물결 · 물보라 · 반짝이가 튐. 몸에 물빛이 살짝 스밈. 여러 칸이 2초마다 다시 뜨므로 작고 가볍게 */
  'shaman-rain': {
    frames: 22, logical: 76, scope: 'party',
    draw(g, { t }) {
      const pop = E.back(seg(t, -0.08, 0.22), 1.6), fade = 1 - E.in2(seg(t, 0.62, 1)), cy = -0.64, drift = Math.sin(t * 4) * 0.03, by = 0.62;
      glow(g, 0, 0.1, 0.8, W.glow, 0.28 * bell(t, 0.15, 0.4, 0.9)); // 몸에 스미는 물빛
      // 비 (구름 배에서 비스듬히, 물방울 머리 + 꼬리)
      particles(g, t, 6, 18, (r, i) => ({ t0: 0.1 + (i / 18) * 0.55 + r() * 0.04, life: 0.2 + r() * 0.05, x: (r() - 0.5) * 0.85, sz: 0.024 + r() * 0.012 }), (gg, p, age) => {
        const y = lerp(cy + 0.2, by, age), x = p.x - 0.12 * age, a = fade * (age < 0.15 ? age / 0.15 : 1);
        gg.save(); gg.globalAlpha = a; gg.lineCap = 'round';
        gg.strokeStyle = C(W.rim, 0.55); gg.lineWidth = p.sz * 1.4; gg.beginPath(); gg.moveTo(x + 0.04, y - 0.18); gg.lineTo(x, y); gg.stroke();
        gg.strokeStyle = C(W.light, 0.95); gg.lineWidth = p.sz * 0.7; gg.stroke(); gg.restore();
        glow(gg, x, y, p.sz * 3, W.glow, 0.35 * a);
        drop(gg, x, y, p.sz * 1.3, a, 1.1);
      });
      // 발밑에 떨어진 자리 (작은 물결 · 물보라 · 반짝이)
      particles(g, t, 6, 18, (r, i) => ({ t0: 0.1 + (i / 18) * 0.55 + 0.21, life: 0.2, x: (r() - 0.5) * 0.85 - 0.12 }), (gg, p, age) => {
        ripple(gg, p.x, by, 0.06 + 0.13 * age, (1 - age) * fade * 0.9, 0.025);
        for (const d of [-1, 1]) speck(gg, p.x + d * 0.06 * age * 2, by - 0.1 * Math.sin(Math.PI * age), 0.013, W.light, (1 - age) * fade);
      });
      // 구름 (그림, 없으면 도형)
      const img = asset('shaman-raincloud');
      if (pop > 0 && img) {
        // 그림 위쪽 60%가 구름 (아래 비 줄기는 움직이는 비로 대신하므로 잘라 냄)
        const Wd = 1.2 * pop, top = cy - Wd * 0.36;
        glow(g, drift, cy, 0.75 * pop, '#8fb4d8', 0.3 * fade);
        g.save(); g.globalAlpha = fade; g.beginPath(); g.rect(-2, top - 1, 4, Wd * 0.6 + 1); g.clip();
        g.drawImage(img, drift - Wd / 2, top - Wd * 0.04, Wd, Wd); g.restore();
        glow(g, drift + 0.05, cy + 0.08, 0.35 * pop, W.glow, (0.25 + 0.2 * Math.sin(t * 20)) * fade);
      } else if (pop > 0) {
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
  /** 영혼 잇기 (붙은 칸마다, 2026-10-19 수도사처럼): 가운데에서 흰 섬광과 함께 영혼 남빛 빛 띠 두 줄이 빛나는 머리를 앞세워 양옆으로 엇갈려 출렁이며 뻗어 나가고,
   *  띠 위로 빛 알갱이가 흐르며 가운데에 영혼 빛 구슬 (도는 고리 둘)이 맺혀 빛나고, 영혼 남빛 · 물빛 가루가 피어오름 */
  'shaman-link': {
    frames: 22, logical: 84, size: 320, scope: 'area',
    draw(g, { t }) {
      const run = E.out3(seg(t, 0, 0.38)), fade = 1 - E.in2(seg(t, 0.6, 1)), amp = 0.3 * (1 - 0.5 * seg(t, 0.4, 1));
      glowOval(g, 0, 0.05, 1.2, 0.55, SPIRIT.glow, 0.45 * fade);
      impact(g, t, { y: 0.05, t0: 0.02, r: 1.0, sy: 0.7 });
      for (const [ph, body] of [[0, SPIRIT.body], [Math.PI, SPIRIT.light]]) {
        const P = s2 => ({ x: lerp(-1.3, 1.3, s2), y: Math.sin(ph + s2 * TAU + t * 7) * amp * Math.sin(Math.PI * s2) + 0.05 });
        wchi(g, P, 0.5 - run / 2, 0.5 + run / 2, 0.14, fade, body, SPIRIT.glow);
        for (let k = 0; k < 8; k++) { const q = P(0.5 + (frac(k / 8 + t * 1.6) - 0.5) * run); glow(g, q.x, q.y, 0.1, k % 2 ? W.glow : SPIRIT.glow, 0.6 * fade); speck(g, q.x, q.y, 0.026, k % 2 ? W.foam : '#ffffff', 0.95 * fade, k * 0.4); }
        if (run < 1) for (const e of [0.5 - run / 2, 0.5 + run / 2]) { const q = P(e); whead(g, q.x, q.y, fade, 0.26, SPIRIT.glow); }
      }
      // 가운데 영혼 빛 구슬 + 도는 고리 둘
      const k = E.back(seg(t, 0.08, 0.32), 1.8);
      if (k > 0.01) {
        whead(g, 0, 0.05, fade, 0.45 * k, SPIRIT.glow);
        ringGlow(g, 0, 0.05, 0.3 * k, 0.04, SPIRIT.light, 0.85 * fade, 0.45 + 0.4 * Math.sin(t * 9));
        ringGlow(g, 0, 0.05, 0.36 * k, 0.03, W.light, 0.7 * fade, 0.45 + 0.4 * Math.cos(t * 9));
        glint(g, 0, 0.05, 0.5 * bell(t, 0.2, 0.32, 0.6), SPIRIT.glow, fade, 0, 0.12);
      }
      particles(g, t, 2, 40, r => ({ t0: 0.12 + r() * 0.45, life: 0.4, x: (r() - 0.5) * 2.3, sz: 0.018 + r() * 0.022, w2: r() < 0.35 }), (gg, p, age) => { const y = 0.05 - 0.65 * age, al = (1 - age) * fade; glow(gg, p.x, y, p.sz * 4, p.w2 ? W.glow : SPIRIT.glow, 0.45 * al); speck(gg, p.x, y, p.sz, p.w2 ? W.light : SPIRIT.light, al); });
      waterBurst(g, t, 3, 30, { y: 0.05, sp: 1.05, sq: 0.6, t0: 0.25, a: fade, grav: 0.1 });
    },
  },
  /** 샘 토템 (세운 칸, Lim 2026-10-18 「토템 발동 이펙트 고퀄리티」): 발밑에서 물빛이 번쩍이며 물결이 퍼지고, Codex로 그린 물기둥 (scripts/vfx/assets/shaman-geyser,
   *  꼬인 물줄기 + 왕관 물보라)이 솟구쳤다 가라앉음. 왕관에서 물방울이 양옆으로 포물선을 그리며 떨어지고 파란 빛 알갱이가 떠오름 */
  'shaman-spring': {
    frames: 24, logical: 92, scope: 'target',
    draw(g, { t }) {
      const by = 0.62, fade = 1 - E.in2(seg(t, 0.68, 1)), hit = 1 - E.out2(seg(t, 0, 0.4));
      glowOval(g, 0, by, 1.05, 0.34, W.glow, 0.85 * hit);
      glowOval(g, 0, by, 0.45, 0.42, '#ffffff', 0.9 * (1 - E.out3(seg(t, 0, 0.2))));
      for (const [d, k] of [[0, 1], [0.18, 0.8], [0.36, 0.6]]) ripple(g, 0, by, lerp(0.15, 1.05, E.out3(seg(t, d, d + 0.55))), k * fade * (1 - seg(t, d + 0.15, d + 0.6)), 0.06);
      // 물기둥 (그림): 바닥에서 솟구쳐 (세로로 늘어나며) 잠깐 서 있다가 위에서부터 줄어들며 사라짐
      const img = asset('shaman-geyser');
      const grow = E.out3(seg(t, 0.02, 0.26)), sink = E.in2(seg(t, 0.45, 0.85)), H = 1.65 * grow * (1 - 0.8 * sink), Wd = 1.5 * lerp(0.55, 1, grow) * (1 + 0.03 * Math.sin(t * 40));
      if (img && H > 0.02) {
        g.save(); g.globalAlpha = Math.min(1, fade * (1 - seg(t, 0.6, 0.9)) * 1.1);
        g.drawImage(img, -Wd / 2, by + 0.06 - H, Wd, H);
        const flash = 1 - E.out2(seg(t, 0.04, 0.3));
        if (flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.4 * flash; g.drawImage(img, -Wd / 2, by + 0.06 - H, Wd, H); }
        g.restore();
      }
      const crown = by + 0.06 - 1.65 * grow * 0.86;
      glow(g, 0, crown, 0.55, W.glow, 0.5 * bell(t, 0.1, 0.3, 0.7));
      // 왕관에서 양옆으로 포물선을 그리며 떨어지는 물방울
      particles(g, t, 9, 20, (r, i) => ({ t0: 0.16 + (i / 20) * 0.35, life: 0.42 + r() * 0.12, dir: i % 2 ? 1 : -1, vx: 0.45 + r() * 0.65, vy: 0.5 + r() * 0.5, sz: 0.035 + r() * 0.03 }), (gg, p, age) => {
        const x = p.dir * (0.25 + p.vx * age), y = crown - p.vy * age + 2.6 * age * age;
        if (y < by) drop(gg, x, y, p.sz * (1 - 0.3 * age), (1 - E.in2(age)) * fade);
      });
      // 떠오르는 파란 빛 알갱이 · 물거품
      particles(g, t, 11, 40, r => ({ t0: 0.05 + r() * 0.5, life: 0.4 + r() * 0.3, a: r() * TAU, rr: 0.15 + r() * 0.7, rise: 0.9 + r() * 0.8, sz: 0.014 + r() * 0.022, ph: r() * 9 }), (gg, p, age) => {
        const x = Math.cos(p.a) * p.rr + 0.05 * Math.sin(age * 8 + p.ph), y = by + Math.sin(p.a) * p.rr * 0.3 - p.rise * E.out2(age);
        rise(gg, x, y, p.sz * (1 - 0.3 * age), bell(age, 0, 0.12, 1) * fade, 0.5 + 0.5 * Math.sin(p.ph + age * 20), Math.sin(p.ph) > 0 ? W.light : W.foam);
      });
      particles(g, t, 13, 6, r => ({ t0: 0.12 + r() * 0.4, life: 0.45, x: (r() - 0.5) * 1.0, sz: 0.03 + r() * 0.025, ph: r() * 9 }), (gg, p, age) =>
        bubble(gg, p.x + Math.sin(age * 9 + p.ph) * 0.05, by - 0.1 - 1.1 * E.out2(age), p.sz, bell(age, 0, 0.15, 1) * 0.9 * fade));
      particles(g, t, 15, 6, (r, i) => ({ t0: 0.18 + i * 0.07, life: 0.28, x: (r() - 0.5) * 1.2, y: -0.4 - r() * 0.5, rot: r() }), (gg, p, age) => glint(gg, p.x, p.y, 0.18 * Math.sin(Math.PI * age), W.glow, fade, p.rot, 0.13, W.foam));
    },
  },
  /** 샘 토템이 서 있는 동안 도는 루프 (Lim 2026-10-18 「판 위 토템을 자원 그림의 토템과 같은 디자인으로, 이펙트가 루프로 돌게」): 토템 그림 위에 겹침.
   *  꼭대기 물방울 보석이 숨 쉬듯 빛나고, 보석 끝에서 작은 물방울이 분수처럼 솟아 양옆으로 떨어지며, 물빛 알갱이가 천천히 떠오름. 3초 한 바퀴 */
  'shaman-spring-loop': {
    frames: 36, fps: 12, loop: true, logical: 64, scope: 'target',
    draw(g, { t }) {
      const gem = tp(0, -112), top = tp(0, -205), base = tp(0, 200);
      glow(g, gem.x, gem.y, 0.36, W.glow, 0.2 + 0.22 * wave(t, 2));
      glow(g, gem.x, gem.y - 0.02, 0.16, '#ffffff', 0.08 + 0.14 * wave(t, 2));
      glint(g, gem.x - 0.06, gem.y - 0.06, 0.15 * bell(frac(t * 2 + 0.6), 0, 0.12, 0.3), W.glow, 1, 0.3, 0.13, W.foam);
      // 발밑 잔물결 (한 바퀴에 두 번, 옅게)
      for (const k of [0, 0.5]) { const a = frac(t * 2 + k); ripple(g, 0, base.y + 0.02, lerp(0.18, 0.62, E.out2(a)), 0.38 * (1 - a) * seg(a, 0, 0.1), 0.045); }
      // 분수: 보석 끝에서 솟아 양옆으로 포물선을 그리며 떨어지는 물방울 (한 바퀴에 두 번씩, 엇갈려)
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1, spread = 0.75 + 0.35 * ((i * 7) % 5) / 4, a = frac(t * 2 + i / 8);
        const x = side * lerp(0.03, 0.52, a) * spread, y = top.y - 0.95 * a + 1.95 * a * a;
        drop(g, x, y, 0.042 + 0.012 * (i % 3), seg(a, 0, 0.06) * (1 - seg(a, 0.72, 1)) * 0.95);
      }
      // 떠오르는 물빛 알갱이
      for (let i = 0; i < 14; i++) {
        const a = frac(t + i / 14), x0 = ((i * 37) % 13) / 12 - 0.5;
        rise(g, x0 * 1.25 + 0.05 * Math.sin(TAU * (a * 2 + i * 0.3)), lerp(base.y, -0.82, a), 0.012 + 0.008 * (i % 3), bell(a, 0, 0.2, 1) * 0.85, wave(a, 3, i * 0.17));
      }
    },
  },
  /** 비구름 토템이 떠 있는 동안 도는 루프 (Lim 2026-10-18 「비구름도 다른 토템처럼 효과 이펙트를」 → 「물방울은 이미지에서 제거하고 구름만, 이펙트로 비를 표현」):
   *  판 오른쪽 위 비구름 그림 (board-totem-rain, 구름만) 위에 겹침. 좌표: 1 = 비구름 그림 한 변의 반, 프레임 가운데 = 그림 가운데보다 1 아래
   *  (비가 구름 밑으로 내리게, board.ts가 그림 한 변 × 75/62로 그림). 구름 속 소용돌이 · 배가 숨 쉬듯 물빛으로 빛나고, 구름 배 전체에서 빗줄기가 비스듬히 내리며
   *  물빛 알갱이가 천천히 떨어짐. 3초 한 바퀴 */
  'shaman-rain-loop': {
    frames: 36, fps: 12, loop: true, logical: 75, scope: 'target',
    draw(g, { t }) {
      const at = (fx, fy) => ({ x: (fx - 0.5) * 2, y: (fy - 0.5) * 2 - 1 }); // 그림 비율 좌표 → 프레임
      const belly = at(0.55, 0.66), sw = [at(0.33, 0.57), at(0.63, 0.56)], under = x => at(0.5, 0.8).y - 0.18 * x * x; // 구름 배 아랫선 (가운데가 가장 낮음)
      glowOval(g, belly.x, belly.y, 0.85, 0.36, W.glow, 0.1 + 0.14 * wave(t, 1));
      sw.forEach((p, i) => glow(g, p.x, p.y, 0.3, W.glow, 0.12 + 0.2 * wave(t, 2, i * 0.5)));
      glint(g, sw[1].x + 0.05, sw[1].y + 0.08, 0.16 * bell(frac(t * 2 + 0.2), 0, 0.12, 0.3), W.glow, 1, 0.3, 0.13, W.foam);
      glint(g, sw[0].x + 0.1, sw[0].y + 0.1, 0.13 * bell(frac(t * 2 + 0.7), 0, 0.12, 0.3), W.glow, 1, 0.5, 0.13, W.foam);
      // 빗줄기 (구름 배 전체에서, 한 바퀴에 세 번씩)
      for (let i = 0; i < 20; i++) {
        const x0 = (((i * 7) % 20) / 19 - 0.5) * 1.7, a = frac(t * 3 + i / 20 + ((i * 3) % 5) * 0.03), top = under(x0);
        const y = lerp(top, 1.15, a), x = x0 - 0.12 * a, al = seg(a, 0, 0.08) * (1 - seg(a, 0.72, 1)) * 0.9, sz = 0.03 + 0.008 * (i % 3);
        g.save(); g.globalAlpha = al; g.lineCap = 'round';
        g.strokeStyle = C(W.rim, 0.55); g.lineWidth = sz * 1.4; g.beginPath(); g.moveTo(x + 0.05, Math.max(top, y - 0.22)); g.lineTo(x, y); g.stroke();
        g.strokeStyle = C(W.light, 0.95); g.lineWidth = sz * 0.7; g.stroke(); g.restore();
        drop(g, x, y, sz * 1.3, al, 1.1);
      }
      // 천천히 떨어지는 물빛 알갱이
      for (let i = 0; i < 10; i++) {
        const a = frac(t + i / 10), x = (((i * 37) % 11) / 10 - 0.5) * 1.6 + 0.05 * Math.sin(TAU * (a * 2 + i * 0.3));
        rise(g, x, lerp(under(x), 1.05, a), 0.012 + 0.006 * (i % 3), bell(a, 0, 0.2, 1) * 0.8, wave(a, 3, i * 0.17));
      }
    },
  },
  /** 대지 토템이 서 있는 동안 도는 루프: 가운데 호박 보석 · 돌 왕관이 번갈아 은은하게 빛나고, 작은 돌 조각 셋이 왕관 둘레를 천천히 돌며 (뒤로 갈 때는 왕관 뒤로 숨음)
   *  호박빛 흙먼지가 발밑에서 떠오름. 3초 한 바퀴 */
  'shaman-earth-loop': {
    frames: 36, fps: 12, loop: true, logical: 64, scope: 'target',
    draw(g, { t }) {
      const gem = tp(0, 56), crown = tp(0, -150), base = tp(0, 200);
      glow(g, gem.x, gem.y, 0.3, AMBER.glow, 0.16 + 0.2 * wave(t, 2));
      glow(g, crown.x, crown.y, 0.42, AMBER.glow, 0.1 + 0.14 * wave(t, 2, 0.5));
      glint(g, gem.x + 0.05, gem.y - 0.05, 0.14 * bell(frac(t * 2 + 0.25), 0, 0.12, 0.3), AMBER.glow, 1, 0.4, 0.13, '#fff4d8');
      glowOval(g, 0, base.y + 0.04, 0.62, 0.28, AMBER.glow, 0.12 + 0.12 * wave(t, 1));
      // 왕관 둘레를 도는 돌 조각 (한 바퀴 3초): 앞쪽 (sin > 0)은 크고 진하게, 뒤쪽은 작고 옅게 + 왕관에 가려지는 가운데에선 사라짐
      for (let i = 0; i < 3; i++) {
        const ang = TAU * (t + i / 3), x = Math.cos(ang) * 0.5, y = crown.y + 0.1 + Math.sin(ang) * 0.12 + 0.03 * Math.sin(TAU * (t * 2 + i / 3)), front = Math.sin(ang) > 0;
        const hide = front ? 1 : seg(Math.abs(x), 0.22, 0.42), a = (front ? 1 : 0.6) * hide;
        glow(g, x, y, 0.12, AMBER.glow, 0.35 * a);
        pebble(g, x, y, (front ? 0.07 : 0.055) + 0.008 * i, ang * 0.5 + i, a, 5 + (i % 2));
      }
      // 떠오르는 호박빛 흙먼지
      for (let i = 0; i < 14; i++) {
        const a = frac(t + i / 14), x0 = ((i * 41) % 13) / 12 - 0.5;
        const x = x0 * 1.25 + 0.06 * Math.sin(TAU * (a * 2 + i * 0.21)), y = lerp(base.y + 0.02, -0.8, E.out2(a));
        glow(g, x, y, 0.06, AMBER.glow, 0.45 * bell(a, 0, 0.2, 1));
        speck(g, x, y, 0.011 + 0.007 * (i % 3), i % 2 ? AMBER.light : AMBER.body, bell(a, 0, 0.2, 1) * 0.85, wave(a, 3, i * 0.13));
      }
    },
  },
  // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」): 그림 위에 겹쳐 그림이 서 있는 동안 계속 돎.
  // 좌표: 프레임 가운데 = 그림 가운데, 1 = 그림 한 변의 반 (board.ts putArtLoop가 그림 한 변 × logical / 62로 그림). 3초 한 바퀴
  /** 주술사 바다 샘 (board-sea-spring, 바닥 그림): 물기둥 끝에서 물방울이 양옆으로 솟았다 떨어지고, 샘 둘레에 잔물결이 퍼지며 물빛 알갱이가 떠오르고 물보라가 반짝임 */
  'shaman-sea-loop': {
    frames: 36, fps: 12, loop: true, logical: 84, size: 256, scope: 'target',
    draw(g, { t }) {
      glow(g, 0, -0.3, 0.55, W.glow, 0.12 + 0.14 * wave(t, 2));
      for (const k of [0, 0.33, 0.67]) { const a = frac(t * 3 + k); ripple(g, 0, 0.5, lerp(0.3, 0.85, E.out2(a)), 0.4 * (1 - a) * seg(a, 0, 0.1), 0.045); }
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1, spread = 0.7 + 0.4 * ((i * 7) % 5) / 4, a = frac(t * 2 + i / 10);
        drop(g, side * lerp(0.05, 0.62, a) * spread, -0.75 - 0.7 * a + 1.75 * a * a, 0.065 + 0.015 * (i % 3), seg(a, 0, 0.06) * (1 - seg(a, 0.75, 1)) * 0.95);
      }
      for (let i = 0; i < 12; i++) { const a = frac(t + i / 12), x0 = ((i * 37) % 13) / 12 - 0.5; rise(g, x0 * 1.4, lerp(0.55, -0.95, a), 0.022 + 0.01 * (i % 3), bell(a, 0, 0.2, 1) * 0.85, wave(a, 3, i * 0.17)); }
      glint(g, -0.12, -0.62, 0.17 * bell(frac(t * 2 + 0.3), 0, 0.12, 0.3), W.glow, 1, 0.3, 0.13, W.foam);
      glint(g, 0.2, -0.2, 0.14 * bell(frac(t * 2 + 0.8), 0, 0.12, 0.3), W.glow, 1, 0.6, 0.13, W.foam);
    },
  },
  /** 특성 버튼 발동 (2026-10-19 Lim 「특성에 달린 버튼들을 눌렀을때 이펙트 … 필요」): lib talentFx 'geyser' (코드 빛 띠 · 충격파 · 파티클, 칸 가득) */
  'shaman-talent': talentFx({ rim: '#08304f', body: '#3fb0e8', light: '#a8e6ff', core: '#f0fbff', glow: '#4cc0f0', acc: '#c8ccff', accGlow: '#8a8ff8' }, 'geyser'),
};
