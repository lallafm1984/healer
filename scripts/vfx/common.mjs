// 전투 공통 효과 · 파티원 능력 (Lim 2026-10-16 「몬스터 공격 및 다른 기타 이펙트도 손그림 이펙트로 (도트를 모두 제거)」).
// 여러 칸에 자주 · 한꺼번에 뜨므로 작고 짧게 (192px). gray = 회색 단계로 그려 게임이 종류 색을 곱함 (치유 = 힐러 문장 색 · 쓰러짐 = 역할 색 · 디버프 = 종류 색 · 장비 발동 = 묶음 색).
// 모양은 src/art/pxf/requests.md 모양 표 그대로.
import { bell, bez, bloom, C, comet, E, energy, glint, glow, glowOval, lerp, lightStroke, particles, path, rad, ringGlow, rng, seg, solid, speck, taper, TAU } from './lib.mjs';

const GR = { rim: '#262626', dark: '#5c5c5c', mid: '#9c9c9c', light: '#d4d4d4', white: '#ffffff' };
const SMALL = 192;

/** 지그재그 번개 줄 (점 목록을 이은 빛 획) */
function zigzag(g, pts, w, k, col) {
  if (k <= 0) return;
  const segs = pts.length - 1, P = s => { const x = Math.min(segs - 1e-6, s * segs), i = Math.floor(x), f = x - i; return { x: lerp(pts[i][0], pts[i + 1][0], f), y: lerp(pts[i][1], pts[i + 1][1], f) }; };
  lightStroke(g, P, 0, k, u => w * (1 - 0.5 * u), { rim: col.rim, body: col.body, core: col.core, rimW: 0.018, coreW: 0.45, glowCol: col.glow, glowA: 0.6, a: col.a ?? 1 });
}
/** 영혼 불꽃 (아래 둥글고 위 뾰족, 높이 1 · 폭 w) */
function flamePath(g, w = 0.42, lean = 0) {
  g.beginPath(); g.moveTo(lean, -1);
  g.bezierCurveTo(w * 0.4 + lean * 0.5, -0.6, w * 1.1, -0.2, w, 0.12);
  g.arc(0, 0.12, w, 0, Math.PI);
  g.bezierCurveTo(-w * 1.1, -0.2, -w * 0.3 + lean * 0.5, -0.55, lean, -1);
  g.closePath();
}
/** 십자 (+, 팔 반폭 0.32) */
function plusPath(g, w = 0.32) { g.beginPath(); for (const [x, y] of [[-w, -1], [w, -1], [w, -w], [1, -w], [1, w], [w, w], [w, 1], [-w, 1], [-w, w], [-1, w], [-1, -w], [-w, -w]]) g.lineTo(x, y); g.closePath(); }
/** 얼룩 덩이 (7각 울퉁불퉁) */
function blotPath(g, seed) { const r = rng(seed); g.beginPath(); for (let j = 0; j < 8; j++) { const a = (j * TAU) / 8, rr = 0.75 + 0.3 * r(); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }

export default {
  /** 피격 (큰 피해를 받은 순간): 비스듬한 붉은 할퀸 자국 셋이 번쩍 그어지고 작은 파편이 튀며 바로 사라짐 */
  'common-hit': {
    frames: 11, logical: 74, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const draw = E.out4(seg(t, 0, 0.3)), fade = 1 - E.in2(seg(t, 0.3, 1));
      glow(g, 0, 0, 0.75, '#ff5a2a', 0.6 * (1 - E.out2(seg(t, 0, 0.5))));
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * 0.26, P = bez([0.62 + o, -0.62 + o * 0.3], [0.25 + o, -0.2 + o * 0.3], [-0.1 + o, 0.15 + o * 0.3], [-0.55 + o, 0.6 + o * 0.3]);
        const k = Math.min(1, draw * 1.2 - i * 0.08);
        if (k > 0) lightStroke(g, P, Math.max(0, k - 0.9), k, taper(i === 1 ? 0.14 : 0.1, 0.2, 0.7), { rim: '#3a0806', body: '#ff5a2a', core: '#fff0d0', a: fade, rimW: 0.02, coreW: 0.4, glowCol: '#ff3a1a', glowA: 0.5 });
      }
      particles(g, t, 4, 8, r => ({ t0: 0.05, life: 0.6 + r() * 0.3, a: r() * TAU, sp: 0.4 + r() * 0.5, sz: 0.035 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const d = 0.15 + p.sp * E.out2(age);
        gg.save(); gg.translate(Math.cos(p.a) * d, Math.sin(p.a) * d + 0.2 * age * age); gg.rotate(p.rot + age * 6); gg.scale(p.sz, p.sz * 1.6);
        solid(gg, h => path.diamond(h, 0.5), { hi: '#ffd0a0', lo: '#c83a14', rim: '#3a0806', rimW: 0.2, a: 1 - age, shine: 0.3 }); gg.restore();
      });
    },
  },

  /** 치명타 치유 별: 칸 오른쪽 위에서 작은 금빛 네 갈래 별이 톡 튀어 커졌다가 반짝이며 줄어듦 */
  'common-crit': {
    frames: 12, logical: 66, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const x = 0.46, y = -0.46, pop = t < 0.3 ? E.back(t / 0.3, 2.2) : 1 - E.in2(seg(t, 0.3, 1)) * 0.75, fade = 1 - E.in2(seg(t, 0.55, 1));
      glow(g, x, y, 0.55 * pop, '#ffc84a', 0.7 * fade);
      g.save(); g.translate(x, y); g.rotate(t * 1.5); g.scale(0.3 * pop, 0.3 * pop);
      solid(g, h => path.star(h, 4, 0.36), { hi: '#fffbe0', lo: '#e8a020', rim: '#3a2408', rimW: 0.12, a: fade, shine: 0.7 });
      g.restore();
      glint(g, x, y, 0.42 * bell(t, 0, 0.12, 0.5), '#ffd56b', 1, rad(45), 0.12);
      for (let i = 0; i < 3; i++) { const a = rad(-30 + i * 120) + t, d = 0.2 + 0.25 * E.out2(t); speck(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 0.02, '#ffe08a', fade); }
    },
  },

  /** 치유 빛 (지속 힐 틱 · 아이템 · 이펙트가 없는 치유, 아주 자주 뜸, 회색 → 힐러 문장 색): 칸 가운데 아래에서 작은 십자 하나와 빛 점 몇 개가 살짝 떠오르며 사라짐 */
  'common-heal': {
    frames: 14, logical: 64, scope: 'target', size: SMALL, gray: true, sample: '#f2c84b',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.45, 1)), y = lerp(0.35, -0.05, E.out2(t)), pop = E.back(seg(t, 0, 0.25), 2);
      glow(g, 0, 0.3, 0.6, GR.white, 0.45 * (1 - E.out2(seg(t, 0, 0.6))));
      glow(g, 0, y, 0.32 * pop, GR.white, 0.6 * fade);
      g.save(); g.translate(0, y); g.scale(0.17 * pop, 0.17 * pop);
      solid(g, plusPath, { hi: GR.white, lo: GR.light, rim: GR.rim, rimW: 0.12, a: fade, shine: 0.4 });
      g.restore();
      particles(g, t, 9, 6, r => ({ t0: r() * 0.3, life: 0.55, x: (r() - 0.5) * 0.8, y: 0.45 - r() * 0.2, sz: 0.022 + r() * 0.015 }), (gg, p, age) => speck(gg, p.x, p.y - 0.55 * E.out2(age), p.sz, GR.white, (1 - age) * fade));
    },
  },

  /** 해제 (이펙트가 없는 해제 · 전염 폭발): 청록 고리가 칸 가운데에서 바깥으로 한 번 쓸고, 어두운 얼룩 조각이 밖으로 튕겨 나감 */
  'common-dispel': {
    frames: 14, logical: 76, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const R = lerp(0.15, 0.95, E.out3(seg(t, 0, 0.55))), fade = 1 - E.in2(seg(t, 0.3, 1));
      glow(g, 0, 0, 0.7, '#3fe0c8', 0.55 * (1 - E.out2(seg(t, 0, 0.5))));
      ringGlow(g, 0, 0, R, 0.14, '#3fe0c8', 0.8 * fade, 0.8);
      g.save(); g.scale(1, 0.8); g.globalAlpha = fade; g.beginPath(); g.arc(0, 0, R, 0, TAU);
      g.lineWidth = 0.1; g.strokeStyle = C('#0b4a44', 0.9); g.stroke(); g.lineWidth = 0.06; g.strokeStyle = '#3fe0c8'; g.stroke(); g.lineWidth = 0.022; g.strokeStyle = '#e8fffb'; g.stroke(); g.restore();
      particles(g, t, 5, 4, (r, i) => ({ t0: 0.04, life: 0.75, a: rad(45 + i * 90 + r() * 25), sz: 0.08 + r() * 0.03, rot: r() * 6, sd: i + 3 }), (gg, p, age) => {
        const d = 0.25 + 0.75 * E.out2(age), x = Math.cos(p.a) * d, y = Math.sin(p.a) * d * 0.85, k = 1 - E.in2(age);
        bloom(gg, h => { h.beginPath(); h.arc(x, y, p.sz * 1.3, 0, TAU); }, '#6a3a90', 0.35 * k, 4);
        gg.save(); gg.translate(x, y); gg.rotate(p.rot + age * 4); gg.scale(p.sz * (1 - age * 0.5), p.sz * (1 - age * 0.5));
        solid(gg, h => blotPath(h, p.sd), { hi: '#9a6ac0', lo: '#2d1b4a', rim: '#14081e', rimW: 0.16, a: k, shine: 0.25 }); gg.restore();
      });
    },
  },

  /** 부활 · 봉화 지정: 칸 가운데 아래에서 흰 금빛 영혼 불꽃이 피어올라 두 번 일렁이고, 불티가 위로 날아가며 작아져 꺼짐 */
  'common-revive': {
    frames: 20, logical: 84, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const grow = E.back(seg(t, 0, 0.25), 1.5), shrink = E.in2(seg(t, 0.6, 1)), s = 0.62 * grow * (1 - shrink), fade = 1 - E.in2(seg(t, 0.75, 1));
      const sway = Math.sin(t * 22) * 0.12 * (1 - shrink), by = 0.5;
      glowOval(g, 0, by, 0.8, 0.35, '#ffb84a', 0.75 * (1 - E.out2(seg(t, 0, 0.7))));
      glow(g, 0, by - s * 0.5, s * 1.4, '#ffc84a', 0.6 * fade);
      if (s > 0.01) {
        g.save(); g.translate(0, by); g.scale(s, s * 1.15);
        bloom(g, h => flamePath(h, 0.45, sway), '#ffb84a', 0.6 * fade, 6);
        solid(g, h => flamePath(h, 0.45, sway), { hi: '#fff0a0', lo: '#ff8a2a', rim: '#3a1a06', rimW: 0.06, a: fade, shine: 0.4, y0: -1, y1: 0.5 });
        g.save(); g.translate(0, 0.08); g.scale(0.55, 0.6); flamePath(g, 0.45, sway * 0.6); g.fillStyle = C('#fffde8', 0.95 * fade); g.fill(); g.restore();
        g.restore();
      }
      particles(g, t, 7, 8, r => ({ t0: 0.15 + r() * 0.5, life: 0.4, x: (r() - 0.5) * 0.5, sz: 0.025 + r() * 0.015 }), (gg, p, age) => speck(gg, p.x + Math.sin(age * 8 + p.x * 9) * 0.06, by - 0.5 - 0.7 * age, p.sz, '#ffc84a', (1 - age) * fade));
    },
  },

  /** 쓰러짐 (회색 → 역할 색): 칸 가운데의 둥근 연기 덩어리가 아래로 털썩 꺼지듯 납작해지며 옆으로 번지고, 각진 파편이 떨어져 한 번 튀고 사라짐 */
  'common-death': {
    frames: 18, logical: 80, scope: 'target', size: SMALL, gray: true, sample: '#5b8fd9',
    draw(g, { t }) {
      const fall = E.in2(seg(t, 0, 0.35)), spread = E.out2(seg(t, 0.25, 1)), fade = 1 - E.in2(seg(t, 0.5, 1));
      const cy = lerp(-0.05, 0.42, fall), sx = lerp(0.42, 0.95, spread), sy = lerp(0.42, 0.16, fall);
      // 연기 덩이 (아래 진한 그늘 + 위 밝은 덩이)
      const R = rng(5), blobs = [...Array(5)].map((_, i) => [(i - 2) * 0.32, (R() - 0.5) * 0.4, 0.55 + R() * 0.3]);
      const soft = (x, y, rx, ry, col, al) => { g.save(); g.translate(x, y); g.scale(rx, ry); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, C(col, al)); gr.addColorStop(0.6, C(col, al * 0.75)); gr.addColorStop(1, C(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
      for (const [dx, dy, r] of blobs) soft(dx * sx, cy + dy * sy + 0.06, sx * r * 0.62, sy * r * 0.95, GR.rim, 0.7 * fade);
      for (const [dx, dy, r] of blobs) soft(dx * sx, cy + dy * sy - 0.02, sx * r * 0.55, sy * r * 0.85, GR.light, 0.95 * fade);
      for (const [dx, dy, r] of blobs) soft(dx * sx - 0.04, cy + dy * sy - 0.08, sx * r * 0.32, sy * r * 0.5, GR.white, 0.95 * fade);
      // 떨어져 튀는 각진 파편
      particles(g, t, 3, 5, (r, i) => ({ t0: 0.08 + i * 0.03, life: 0.8, x: (i - 2) * 0.28 + (r() - 0.5) * 0.1, sz: 0.06 + r() * 0.03, rot: r() * 6 }), (gg, p, age) => {
        const fallY = age < 0.55 ? lerp(-0.2, 0.62, E.in2(age / 0.55)) : 0.62 - Math.sin(Math.PI * seg(age, 0.55, 1)) * 0.12, k = 1 - E.in2(seg(age, 0.6, 1));
        gg.save(); gg.translate(p.x * (1 + 0.3 * age), fallY); gg.rotate(p.rot + age * 3); gg.scale(p.sz, p.sz);
        solid(gg, h => path.poly(h, 4, p.rot), { hi: GR.light, lo: GR.dark, rim: GR.rim, rimW: 0.2, a: k, shine: 0.3 }); gg.restore();
      });
    },
  },

  /** 디버프 걸림 (회색 → 종류 색): 위에서 작은 소용돌이 얼룩이 내려와 칸 둘레를 반 바퀴 돌며 방울 두세 개를 떨어뜨리고 스며들 듯 사라짐 */
  'common-debuff': {
    frames: 16, logical: 76, scope: 'target', size: SMALL, gray: true, sample: '#7bd34a',
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.55, 1)), run = E.inOut(seg(t, 0, 0.7));
      const P = s => { const a = rad(-100) + s * Math.PI * 1.1, r = lerp(0.2, 0.62, Math.min(1, s * 2)); return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75 - 0.15 * (1 - s) + 0.05 }; };
      comet(g, P, Math.max(0, run - 0.45), Math.max(0.02, run), { w: 0.13, rim: GR.rim, body: GR.light, core: GR.white, glowCol: GR.mid, a: fade, head: 0 });
      const h = P(run);
      g.save(); g.translate(h.x, h.y); g.rotate(t * 8); g.scale(0.15 * (1 - 0.4 * seg(t, 0.5, 1)), 0.15 * (1 - 0.4 * seg(t, 0.5, 1)));
      energy(g, gg => blotPath(gg, 2), { rim: GR.rim, body: GR.mid, core: GR.white, rimW: 0.15, a: fade, coreScale: 0.45 }); g.restore();
      particles(g, t, 6, 3, (r, i) => ({ t0: 0.2 + i * 0.15, life: 0.45, s: 0.25 + i * 0.25 }), (gg, p, age) => {
        const q = P(p.s), y = q.y + 0.5 * E.in2(age);
        gg.save(); gg.translate(q.x, y); gg.scale(0.06 * (1 - 0.3 * age), 0.09 * (1 - 0.3 * age)); energy(gg, path.drop, { rim: GR.rim, body: GR.light, core: GR.white, rimW: 0.18, a: (1 - age) * fade }); gg.restore();
      });
      glowOval(g, 0, 0.35, 0.6, 0.4, GR.mid, 0.5 * bell(t, 0.4, 0.7, 1));
    },
  },

  /** 장비 특수능력 발동 (회색 → 묶음 색): 칸 오른쪽 위 · 왼쪽 위에서 짧은 지그재그 전기 불꽃이 탁 튀고 끝에서 작은 네모 불티가 깜빡이며 사라짐 */
  'common-proc': {
    frames: 12, logical: 70, scope: 'target', size: SMALL, gray: true, sample: '#c08af0',
    draw(g, { t }) {
      const k = E.out4(seg(t, 0, 0.25)), fade = 1 - E.in2(seg(t, 0.3, 1)), col = { rim: GR.rim, body: GR.light, core: GR.white, glow: GR.white, a: fade };
      const bolts = [[[0.25, -0.25], [0.42, -0.42], [0.35, -0.52], [0.6, -0.72]], [[-0.22, -0.28], [-0.4, -0.38], [-0.33, -0.52], [-0.58, -0.66]], [[0.2, -0.05], [0.42, -0.02], [0.4, 0.1], [0.66, 0.08]]];
      bolts.forEach((pts, i) => {
        zigzag(g, pts, 0.085, Math.min(1, k * 1.3 - i * 0.12), col);
        const e = pts[pts.length - 1], b = bell(t, 0.15 + i * 0.05, 0.25 + i * 0.05, 0.75);
        glint(g, e[0], e[1], 0.13 * b, GR.white, b, rad(20), 0.16, GR.white);
        g.save(); g.translate(e[0], e[1]); g.rotate(rad(45) + t * 6); g.scale(0.028 * b + 0.001, 0.028 * b + 0.001); solid(g, h => h.rect(-1, -1, 2, 2), { hi: GR.white, lo: GR.light, rim: GR.rim, rimW: 0.4, a: b, shine: 0.3 }); g.restore();
      });
      glow(g, 0, -0.25, 0.45, GR.white, 0.5 * (1 - E.out2(seg(t, 0, 0.45))));
    },
  },

  // ── 파티원 능력 (능력 종류마다, 내 힐 스킬과 헷갈리지 않게 종류 색을 분명히) ──

  /** 방어 🛡: 칸 앞에 하늘색 · 강철빛 둥근 방패가 번쩍 나타나 단단하게 한 번 울리고 (테두리 고리가 퍼짐) 흐려짐 */
  'ally-def': {
    frames: 16, logical: 80, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const pop = E.back(seg(t, 0, 0.22), 2), fade = 1 - E.in2(seg(t, 0.35, 0.9)), ring = seg(t, 0.12, 0.7);
      glow(g, 0, 0.05, 0.75, '#7ab8ff', 0.55 * fade);
      ringGlow(g, 0, 0.05, lerp(0.35, 0.95, E.out3(ring)), 0.1, '#9fd0ff', 0.8 * (1 - ring), 1);
      g.save(); g.translate(0, 0.05); g.scale(0.36 * pop, 0.36 * pop);
      solid(g, h => { h.beginPath(); h.arc(0, 0, 1, 0, TAU); }, { hi: '#e8f4ff', lo: '#4a78b0', rim: '#14243e', rimW: 0.08, a: fade * 0.82, shine: 0.7 });
      g.globalAlpha = fade * 0.82; g.beginPath(); g.arc(0, 0, 0.72, 0, TAU); g.lineWidth = 0.08; g.strokeStyle = '#14243e'; g.stroke();
      g.beginPath(); g.arc(0, 0, 0.2, 0, TAU); g.fillStyle = '#c8dcf0'; g.fill(); g.lineWidth = 0.07; g.stroke();
      g.restore();
      glint(g, -0.2, -0.18, 0.3 * bell(t, 0.1, 0.22, 0.5), '#9fd0ff', 1, rad(20), 0.12);
    },
  },

  /** 방해 ✋: 칸 위쪽에서 보라 사슬 고리 · 작은 별이 원을 그리며 휘감았다가 바깥으로 튕겨 나감 */
  'ally-ctl': {
    frames: 16, logical: 80, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.55, 1)), spin = t * TAU * 0.8, fling = E.in2(seg(t, 0.5, 1)), cy = -0.35;
      glowOval(g, 0, cy, 0.8, 0.5, '#a070f0', 0.55 * fade);
      for (let i = 0; i < 6; i++) {
        const a = spin + (i * TAU) / 6, r = 0.58 + 0.6 * fling, z = Math.sin(a), x = Math.cos(a) * r, y = cy + z * r * 0.38;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.globalAlpha = fade * (z > 0 ? 1 : 0.6);
        const face = Math.abs(Math.cos(a * 2));
        g.beginPath(); g.ellipse(0, 0, 0.13 * (0.35 + 0.65 * face), 0.1, 0, 0, TAU);
        g.lineWidth = 0.075; g.strokeStyle = '#1e0e3a'; g.stroke(); g.lineWidth = 0.045; g.strokeStyle = '#a070f0'; g.stroke(); g.lineWidth = 0.015; g.strokeStyle = '#e8d8ff'; g.stroke();
        g.restore();
      }
      for (let i = 0; i < 3; i++) { const a = -spin * 1.3 + (i * TAU) / 3, r = 0.35 + 0.5 * fling; glint(g, Math.cos(a) * r, cy + Math.sin(a) * r * 0.4, 0.15 * fade, '#c8a8ff', fade, a, 0.15, '#ffffff'); }
    },
  },

  /** 지원 ⚑: 칸 아래에서 금빛 위쪽 화살표 (∧) 셋이 차례로 솟아오르고 깃발 같은 빛 띠가 펄럭이며 사라짐 */
  'ally-sup': {
    frames: 16, logical: 78, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const fade = 1 - E.in2(seg(t, 0.6, 1));
      glowOval(g, 0, 0.4, 0.75, 0.4, '#ffc84a', 0.55 * (1 - E.out2(seg(t, 0, 0.7))));
      for (let i = 0; i < 3; i++) {
        const u = seg(t, i * 0.12, i * 0.12 + 0.6), y = lerp(0.62, -0.55 + i * 0.05, E.out2(u)), a = bell(u, 0, 0.12, 1) * fade, w = 0.32 - i * 0.04;
        if (a <= 0) continue;
        const pts = [[-w, y + w * 0.75], [0, y], [w, y + w * 0.75]];
        lightStroke(g, s => (s < 0.5 ? { x: lerp(pts[0][0], pts[1][0], s * 2), y: lerp(pts[0][1], pts[1][1], s * 2) } : { x: lerp(pts[1][0], pts[2][0], (s - 0.5) * 2), y: lerp(pts[1][1], pts[2][1], (s - 0.5) * 2) }), 0, 1, () => 0.1, { rim: '#3a2408', body: '#ffd56b', core: '#fffbe0', a, rimW: 0.022, coreW: 0.45, glowCol: '#ffc84a', glowA: 0.6 });
      }
      // 펄럭이는 빛 띠
      const r = seg(t, 0.1, 0.8);
      lightStroke(g, s => ({ x: lerp(-0.55, 0.55, s), y: -0.7 + Math.sin(s * 7 - t * 14) * 0.07 }), 0.5 - r / 2, 0.5 + r / 2, u => 0.07 * Math.sin(Math.PI * u), { rim: '#3a2408', body: '#ffe08a', core: '#ffffff', a: fade * 0.9, rimW: 0.016 });
    },
  },

  /** 회복 ✚: 칸 아래에서 민트빛 둥근 물거품이 흔들리며 떠올라 하나씩 톡 터져 사라짐 */
  'ally-heal': {
    frames: 16, logical: 76, scope: 'target', size: SMALL,
    draw(g, { t }) {
      particles(g, t, 8, 6, (r, i) => ({ t0: i * 0.06, life: 0.55 + r() * 0.25, x: (r() - 0.5) * 0.9, sz: 0.08 + r() * 0.07, ph: r() * 6 }), (gg, p, age) => {
        const x = p.x + Math.sin(age * 9 + p.ph) * 0.06, y = 0.55 - 1.0 * E.out2(age);
        if (age < 0.82) {
          const s = p.sz * (0.6 + 0.4 * E.out2(Math.min(1, age * 4)));
          glow(gg, x, y, s * 2.2, '#7ae8c8', 0.4);
          gg.save(); gg.globalAlpha = 1;
          gg.beginPath(); gg.arc(x, y, s, 0, TAU); gg.fillStyle = C('#a8f5dc', 0.4); gg.fill();
          gg.lineWidth = s * 0.28; gg.strokeStyle = C('#0f4a3c', 0.85); gg.stroke(); gg.lineWidth = s * 0.14; gg.strokeStyle = '#7ae8c8'; gg.stroke();
          gg.beginPath(); gg.arc(x - s * 0.35, y - s * 0.35, s * 0.25, 0, TAU); gg.fillStyle = '#ffffff'; gg.fill();
          gg.restore();
        } else {
          const k = seg(age, 0.82, 1);
          ringGlow(gg, x, y, p.sz * (1 + k), p.sz * 0.3, '#a8f5dc', 1 - k, 1);
          for (let j = 0; j < 4; j++) { const a = (j * TAU) / 4 + p.ph; speck(gg, x + Math.cos(a) * p.sz * (1 + 1.5 * k), y + Math.sin(a) * p.sz * (1 + 1.5 * k), 0.015, '#a8f5dc', 1 - k); }
        }
      });
      glowOval(g, 0, 0.5, 0.6, 0.35, '#7ae8c8', 0.4 * (1 - E.out2(seg(t, 0, 0.6))));
    },
  },

  /** 공격 ⚔: 칸 바깥 세 방향 (왼쪽 위 · 오른쪽 위 · 아래)에서 주황 · 흰빛 창끝이 가운데로 빠르게 꽂히고, 만나는 순간 주황 불꽃 조각이 튐 */
  'ally-atk': {
    frames: 14, logical: 82, scope: 'target', size: SMALL,
    draw(g, { t }) {
      const hit = 0.18, fade = 1 - E.in2(seg(t, 0.4, 1));
      for (const ang of [rad(-135), rad(-45), rad(90)]) {
        const d = t < hit ? lerp(1.05, 0.2, E.in2(t / hit)) : 0.2 + 0.1 * E.out2(seg(t, hit, 0.5)), x = Math.cos(ang) * d, y = Math.sin(ang) * d, a = t < hit ? 1 : fade;
        comet(g, s => ({ x: Math.cos(ang) * lerp(d + 0.6, d + 0.15, s), y: Math.sin(ang) * lerp(d + 0.6, d + 0.15, s) }), 0, 1, { w: 0.08, rim: '#3a1006', body: '#ff9a3a', core: '#fff0d0', glowCol: '#ff7a2a', a: a * (t < hit ? 1 : 1 - seg(t, hit, 0.4)), head: 0 });
        g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); g.scale(0.1, 0.2);
        solid(g, h => { h.beginPath(); h.moveTo(0, 1); h.lineTo(0.7, -0.6); h.lineTo(0, -0.25); h.lineTo(-0.7, -0.6); h.closePath(); }, { hi: '#fff0d0', lo: '#e86a1a', rim: '#3a1006', rimW: 0.1, a, shine: 0.6 }); g.restore();
      }
      const b = bell(t, hit - 0.04, hit + 0.02, hit + 0.4);
      glow(g, 0, 0, 0.6, '#ff7a2a', 0.85 * b);
      glow(g, 0, 0, 0.3, '#ffffff', b);
      if (t > hit) particles(g, seg(t, hit, 1), 3, 9, r => ({ t0: 0, life: 0.6 + r() * 0.3, a: r() * TAU, sp: 0.4 + r() * 0.5, sz: 0.022 + r() * 0.02 }), (gg, p, age) => {
        const dd = p.sp * E.out2(age); speck(gg, Math.cos(p.a) * dd, Math.sin(p.a) * dd + 0.15 * age * age, p.sz, '#ffb04a', 1 - age);
      });
    },
  },
};
