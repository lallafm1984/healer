/**
 * 로비 마을의 공기 (2026-10-12 Lim 「동적인 요소가 있어도 여전히 정적」). 새 그림 없이 코드로 만든 결로만 그린다.
 * 폰 화면에선 853px 마을이 약 0.42배로 줄어 소품 흔들림이 1~2px였고, 마을·강·광장 같은 큰 면은 전혀 안 움직였다.
 * 그래서 큰 면이 천천히 바뀌는 것 (구름 그림자 · 햇살 줄기 · 햇무리)과 눈에 띄는 작은 사건 (물 반짝임 · 금빛 먼지 · 굴뚝 연기 · 돌풍에 날리는 잎)을 더한다.
 * 돌풍 세기 gustAt()은 village.ts의 가지·덩굴·깃발도 같이 쓴다 (왼쪽에서 오른쪽으로 물결처럼 지나감).
 * 시간·위치는 village.ts가 넘기는 장면 시간으로만 계산하고, 난수는 씨앗 고정이라 같은 시간이면 같은 장면이다.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import { VILLAGE, type VillageGust } from '../data/village';

/** 마을 움직임 공용 셈 (village.ts도 씀) */
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export const smoothstep = (lo: number, hi: number, v: number) => { const t = clamp((v - lo) / (hi - lo || 1)); return t * t * (3 - 2 * t); };
export const mod = (v: number, n: number) => ((v % n) + n) % n;
/** 정수 → 0~1 (돌풍 시각·잎 자리처럼 순서마다 같은 값이 필요할 때) */
const hash = (n: number) => mod(Math.sin(n * 127.1 + 311.7) * 43758.5453, 1);
/** 씨앗 고정 난수 (mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** k번째 돌풍이 장면 왼쪽 끝에 닿는 시각 */
const gustStart = (k: number, g: VillageGust) => g.first + k * g.every + g.jitter * hash(k + 1);
/** 장면 x 자리의 돌풍 세기 0~1. 왼쪽에서 오른쪽으로 travel초에 걸쳐 지나가고 한 자리엔 hold초 (sin² 모양) */
export function gustAt(t: number, x: number, g: VillageGust = VILLAGE.ambience.gust): number {
  const local = t - clamp(x / VILLAGE.width) * g.travel;
  const k = Math.floor((local - g.first) / g.every);
  let s = 0;
  for (const j of [k - 1, k]) {
    if (j < 0) continue;
    const u = (local - gustStart(j, g)) / g.hold;
    if (u > 0 && u < 1) s = Math.max(s, Math.sin(Math.PI * u) ** 2);
  }
  return s;
}

/** 캔버스 2D로 그린 작은 결 (부드러운 원 · 구름 덩어리 · 햇살 줄기 · 반짝임 별) */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture | null {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  draw(g);
  return Texture.from(c);
}
const radial = (g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) => {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) grad.addColorStop(o, c);
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
};

/** 구름 그림자 한 덩어리: 겹친 부드러운 원 여러 개 (씨앗마다 모양이 다름). 색은 곱하기용 푸른 회색 */
const shadowTexture = (seed: number) => canvasTexture(256, 160, g => {
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = 128 + Math.cos(a) * d * 70, y = 80 + Math.sin(a) * d * 34, rad = 34 + r() * 30;
    radial(g, x, y, rad, [[0, 'rgba(52,66,104,.42)'], [0.55, 'rgba(52,66,104,.26)'], [1, 'rgba(52,66,104,0)']]);
  }
});
/** 햇살 줄기: 가로는 가운데가 밝고, 세로는 위에서 짙고 아래로 갈수록 사라짐 */
const shaftTexture = () => canvasTexture(64, 512, g => {
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(255,224,150,0)'); across.addColorStop(0.5, 'rgba(255,230,165,1)'); across.addColorStop(1, 'rgba(255,224,150,0)');
  g.fillStyle = across; g.fillRect(0, 0, 64, 512);
  g.globalCompositeOperation = 'destination-in';
  const down = g.createLinearGradient(0, 0, 0, 512);
  down.addColorStop(0, 'rgba(0,0,0,0)'); down.addColorStop(0.12, 'rgba(0,0,0,.9)'); down.addColorStop(0.45, 'rgba(0,0,0,.55)'); down.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = down; g.fillRect(0, 0, 64, 512);
});
/** 부드러운 원 (햇무리 · 연기 · 먼지) */
const softTexture = (color: string) => canvasTexture(128, 128, g => radial(g, 64, 64, 64, [[0, `rgba(${color},1)`], [0.35, `rgba(${color},.55)`], [0.7, `rgba(${color},.14)`], [1, `rgba(${color},0)`]]));
/** 물 반짝임: 가운데 빛 + 가로 · 세로 가는 빛살 */
const glintTexture = () => canvasTexture(64, 64, g => {
  radial(g, 32, 32, 14, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(230,250,255,.6)'], [1, 'rgba(200,240,255,0)']]);
  for (const [w, h] of [[64, 3], [3, 40]]) {
    const grad = w > h ? g.createLinearGradient(0, 0, 64, 0) : g.createLinearGradient(0, 12, 0, 52);
    grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(32 - w / 2, 32 - h / 2, w, h);
  }
});

interface Mote { object: Sprite; x: number; y: number; rise: number; drift: number; size: number; rate: number; phase: number }
interface Glint { object: Sprite; i: number; t0: number; life: number; size: number }
interface Puff { object: Sprite; x: number; y: number; age: number; seed: number }
interface GustLeaf { object: Sprite; scale: number }

/** 마을 공기 한 벌. village.ts의 world 컨테이너에 붙고, 장면 시간에 맞춰 advance → pose */
export class VillageAir {
  private textures: Texture[] = [];
  private shadows: { object: Sprite; cfg: (typeof VILLAGE.ambience.shadows)[number] }[] = [];
  private shafts: { object: Sprite; cfg: (typeof VILLAGE.ambience.shafts)[number] }[] = [];
  private sun?: Sprite;
  private motes: Mote[] = [];
  private glints: Glint[] = [];
  private puffs: Puff[] = [];
  private gustLeaves: GustLeaf[] = [];
  private nextPuff = 0;
  private readonly random = rng(20261012);
  /** 지금 화면에 보이는 장면 아래 끝 (그림 y). 폰마다 마을 아래쪽이 잘리는 만큼 다르다 */
  bottom = VILLAGE.height;

  constructor(world: Container, leafTexture: Texture, leafContentWidth: number) {
    const A = VILLAGE.ambience;
    const keep = (t: Texture | null) => { if (t) this.textures.push(t); return t; };
    const soft = keep(softTexture('255,214,128')), smoke = keep(softTexture('246,240,230')), glint = keep(glintTexture()), shaft = keep(shaftTexture());
    const shades = [keep(shadowTexture(7)), keep(shadowTexture(19)), keep(shadowTexture(43))];
    const add = (s: Sprite, z: number) => { s.eventMode = 'none'; s.zIndex = z; world.addChild(s); return s; };

    if (soft) {
      // 왼쪽 위 햇무리: 황금빛 서사 (58) 쪽 빛. 천천히 숨쉬듯
      this.sun = add(new Sprite(soft), 480);
      this.sun.anchor.set(0.5); this.sun.position.set(A.sun.x, A.sun.y);
      this.sun.width = this.sun.height = A.sun.radius * 2; this.sun.blendMode = 'screen';
    }
    if (shaft) for (const cfg of A.shafts) {
      const s = add(new Sprite(shaft), 470);
      s.anchor.set(0.5, 0); s.rotation = A.shaftAngle; s.width = cfg.width; s.height = 1500; s.blendMode = 'add';
      this.shafts.push({ object: s, cfg });
    }
    A.shadows.forEach((cfg, i) => {
      const t = shades[i % shades.length];
      if (!t) return;
      const s = add(new Sprite(t), 450);
      s.anchor.set(0.5); s.width = cfg.width; s.height = cfg.height; s.blendMode = 'multiply';
      this.shadows.push({ object: s, cfg });
    });
    if (smoke) for (const c of A.chimneys) for (let i = 0; i < 8; i++) {
      const s = add(new Sprite(smoke), 300);
      s.anchor.set(0.5); s.visible = false;
      this.puffs.push({ object: s, x: c.x, y: c.y, age: -1, seed: i * 1.7 + c.x * 0.01 });
    }
    if (soft) for (let i = 0; i < A.motes; i++) {
      const s = add(new Sprite(soft), 650);
      s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xfff1c4;
      const r = this.random;
      this.motes.push({ object: s, x: r() * VILLAGE.width, y: 170 + r() * 1400, rise: 6 + r() * 12, drift: 3 + r() * 8, size: 11 + r() * 13, rate: 0.6 + r() * 1.6, phase: r() * 10 });
    }
    if (glint) for (let i = 0; i < A.glintLive; i++) {
      const s = add(new Sprite(glint), 460);
      s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xf2fdff; s.visible = false;
      const g: Glint = { object: s, i: 0, t0: 0, life: 1, size: 10 };
      this.respawnGlint(g, -this.random() * 1.2);
      this.glints.push(g);
    }
    for (let i = 0; i < A.gust.leaves; i++) {
      const s = add(new Sprite(leafTexture), 720);
      s.anchor.set(0.5); s.visible = false;
      this.gustLeaves.push({ object: s, scale: (22 + hash(i + 40) * 14) / leafContentWidth });
    }
  }

  /** 반짝임 하나를 보이는 물 위 새 자리로. t0 = 시작 시각 */
  private respawnGlint(g: Glint, t0: number): void {
    const pts = VILLAGE.ambience.glints, n = pts.length / 2;
    let i = Math.floor(this.random() * n);
    // 보이는 곳 (폰마다 아래가 잘림)에서 고른다. 몇 번 시도해도 없으면 먼 강
    for (let k = 0; k < 6 && pts[i * 2 + 1] > this.bottom - 8; k++) i = Math.floor(this.random() * n);
    if (pts[i * 2 + 1] > this.bottom - 8) i = Math.floor(this.random() * Math.min(n, 30));
    const y = pts[i * 2 + 1];
    g.i = i; g.t0 = t0; g.life = 0.7 + this.random() * 0.8;
    // 먼 강은 작게, 가까운 물은 크게
    g.size = y < 320 ? 14 + this.random() * 6 : y < 700 ? 19 + this.random() * 8 : 24 + this.random() * 10;
  }

  /** 장면 시간 dt초 진행 (먼지 · 연기는 바람에 실려 쌓이는 자리라 적분) */
  advance(dt: number, t: number, wind: number): void {
    const strength = clamp(wind / 35, 0, 1.4), A = VILLAGE.ambience;
    for (const m of this.motes) {
      const g = gustAt(t, m.x);
      m.x += (m.drift * strength + 10 * strength * g * A.gust.boost) * dt + Math.sin(t * 0.5 + m.phase) * 4 * dt;
      m.y -= m.rise * dt * (1 + 0.6 * g);
      if (m.y < 160 || m.x > VILLAGE.width + 20 || m.y > this.bottom + 20) {
        // 다시 아래 (보이는 곳)에서: 사라질 땐 alpha 0이라 튀지 않음
        m.y = Math.min(this.bottom, 1560) - this.random() * 120; m.x = -10 + this.random() * (VILLAGE.width + 10);
      }
    }
    for (const c of A.chimneys) {
      this.nextPuff -= dt;
      if (this.nextPuff <= 0) {
        const p = this.puffs.find(p => p.age < 0);
        if (p) { p.age = 0; p.x = c.x + (this.random() - 0.5) * 4; p.y = c.y; }
        this.nextPuff = 0.62 + this.random() * 0.3;
      }
    }
    for (const p of this.puffs) {
      if (p.age < 0) continue;
      p.age += dt;
      if (p.age > 6) { p.age = -1; continue; }
      p.x += (5 + 16 * strength * (1 + A.gust.boost * gustAt(t, p.x))) * dt;
      p.y -= (16 / (1 + p.age * 0.35)) * dt;
    }
    for (const g of this.glints) if (t - g.t0 > g.life) this.respawnGlint(g, t + this.random() * 0.7);
  }

  /** 장면 시간 t의 모습. wind = 0 (동작 줄이기)이면 공기는 모두 숨김 → 바탕 그림 그대로 */
  pose(t: number, wind: number): void {
    const on = wind > 0, A = VILLAGE.ambience, W = VILLAGE.width, strength = clamp(wind / 35, 0, 1.4);
    for (const { object: s, cfg } of this.shadows) {
      s.visible = on;
      if (!on) continue;
      const range = W + cfg.width * 1.1, x = mod(cfg.offset * range + t * cfg.speed, range) - cfg.width * 0.55;
      s.position.set(x, cfg.y + (x / W) * 70);
      // 들어오고 나갈 때 가장자리에서 서서히
      s.alpha = cfg.alpha * smoothstep(-cfg.width * 0.55, -cfg.width * 0.2, x) * (1 - smoothstep(W + cfg.width * 0.2, W + cfg.width * 0.55, x));
    }
    for (const { object: s, cfg } of this.shafts) {
      s.visible = on;
      if (!on) continue;
      const breath = 0.5 + 0.5 * Math.sin((t / cfg.period) * Math.PI * 2 + cfg.phase);
      s.alpha = cfg.alpha * (0.35 + 0.65 * breath * breath);
      s.position.set(cfg.x + Math.sin(t * 0.07 + cfg.phase) * 18, -40);
    }
    if (this.sun) {
      this.sun.visible = on;
      this.sun.alpha = A.sun.alpha * (0.85 + 0.15 * Math.sin(t * 0.21));
    }
    for (const m of this.motes) {
      const s = m.object;
      s.visible = on;
      if (!on) continue;
      const tw = Math.max(0, Math.sin(t * m.rate + m.phase));
      const edge = smoothstep(160, 260, m.y) * (1 - smoothstep(this.bottom - 140, this.bottom - 20, m.y)) * smoothstep(-10, 30, m.x) * (1 - smoothstep(W - 20, W + 15, m.x));
      s.alpha = (0.38 + 0.62 * tw * tw * tw) * edge;
      s.width = s.height = m.size * (0.85 + 0.45 * tw);
      s.position.set(m.x, m.y);
    }
    const pts = A.glints;
    for (const g of this.glints) {
      const s = g.object, u = (t - g.t0) / g.life;
      s.visible = on && u > 0 && u < 1;
      if (!s.visible) continue;
      const env = Math.sin(Math.PI * u);
      s.position.set(pts[g.i * 2], pts[g.i * 2 + 1]);
      s.alpha = env * env * 0.95;
      s.width = s.height = g.size * (0.55 + 0.45 * env);
      s.rotation = (g.i % 2) * 0.12;
    }
    for (const p of this.puffs) {
      const s = p.object;
      s.visible = on && p.age >= 0;
      if (!s.visible) continue;
      const life = p.age / 6;
      s.position.set(p.x + Math.sin(p.age * 1.3 + p.seed) * 3, p.y);
      s.width = s.height = 18 + p.age * 12;
      s.alpha = 0.6 * smoothstep(0, 0.12, life) * Math.pow(1 - life, 1.3);
    }
    this.poseGustLeaves(t, on, strength);
  }

  /** 돌풍이 지나갈 때만: 왼쪽 나무에서 잎이 우르르 오른쪽으로 날아감 */
  private poseGustLeaves(t: number, on: boolean, strength: number): void {
    const g = VILLAGE.ambience.gust, k = Math.floor((t - g.first) / g.every);
    for (let i = 0; i < this.gustLeaves.length; i++) {
      const { object: s, scale } = this.gustLeaves[i];
      s.visible = false;
      if (!on || k < 0) continue;
      for (const j of [k, k - 1]) {
        if (j < 0) continue;
        const seed = j * 31 + i, age = t - gustStart(j, g) - i * 0.24 - hash(seed) * 0.3, dur = 3.6 + hash(seed + 7) * 1.4;
        if (age < 0 || age > dur) continue;
        const u = age / dur, speed = (VILLAGE.width + 80) / dur;
        s.visible = true;
        s.position.set(-30 + age * speed, 240 + hash(seed + 3) * Math.max(200, Math.min(this.bottom, 1500) - 340) + age * 34 + Math.sin(age * 3.1 + i) * 16);
        s.rotation = age * (2.4 + hash(seed + 5) * 2) * (i % 2 ? 1 : -1);
        s.scale.set(scale * (0.45 + 0.55 * Math.abs(Math.cos(age * 4.2 + i))), scale);
        s.alpha = 0.95 * Math.min(1, strength) * smoothstep(0, 0.06, u) * (1 - smoothstep(0.85, 1, u));
        break;
      }
    }
  }

  destroy(): void {
    for (const t of this.textures) t.destroy(true);
    this.textures = [];
  }
}
