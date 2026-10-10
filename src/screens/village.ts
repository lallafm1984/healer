/**
 * 로비 「살아 있는 마을」 (2026-10-11 코덱스 village-living-background 시안을 게임으로 옮김).
 * 건물은 고정 바탕 한 장. 따로 떨어진 투명 소품 (나뭇가지·잎·꽃·덩굴·깃발·차양·구름)만 움직인다.
 * 좌표·잘라내기 다각형은 원본 그림 853×1844 기준. 가지·덩굴·깃발·차양은 본 4개 리그로 메시를 휘게 하고 (부착선은 고정, 끝으로 갈수록 크게),
 * 구름은 누적 거리로 한 방향으로 흐른다 (바람을 바꿔도 위치가 튀지 않음). 물결·등불·떠다니는 잎·먼 새는 그림 없이 그린다.
 * 승인된 모션 값 (구름 9개 · 가지·잎·꽃 ×2.4 · 덩굴 ×2.1 · 깃발 ×3 · 차양 ×1.35 · 기본 바람 35%)은 data/village.ts에 그대로 둔다. 사용자 요청 없이 약하게 바꾸지 않는다.
 * 종 그림은 쓰지 않는다 (10 4장): 시안의 종 레이어는 옮기지 않았다.
 * 로비를 다시 그려도 (보상 받기 등) 같은 캔버스를 새 자리로 옮겨 붙여 움직임이 이어진다. 로비가 안 보이거나 앱이 뒤로 가면 멈춘다.
 * 동작 줄이기 설정이면 바람 0으로 한 장면만 그린다. WebGL이 안 되면 고정 바탕 그림만 보인다.
 */
import { Application, Assets, Container, Graphics, MeshPlane, Sprite, Texture, type Buffer } from 'pixi.js';
import { art } from '../art';
import { VILLAGE, type VillageEffects, type VillageLayer } from '../data/village';

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const smoothstep = (lo: number, hi: number, v: number) => { const t = clamp((v - lo) / (hi - lo || 1)); return t * t * (3 - 2 * t); };
const mod = (v: number, n: number) => ((v % n) + n) % n;

/** 느린 공통 돌풍 + 소품마다 다른 위상 */
function windEnvelope(time: number, phase = 0): number {
  return 0.73 + 0.16 * Math.sin(time * 0.19) + 0.075 * Math.sin(time * 0.071 + 1.1) + 0.035 * Math.sin(time * 0.37 + phase);
}

type Motion = 'branch' | 'vine' | 'flag' | 'awning';
interface Bone { start: [number, number]; length: number; angle: number }
interface Rig { root: [number, number]; dir: [number, number]; length: number; width: number; height: number; bones: Bone[]; lever: number; motion: Motion; layer: Layer }
interface Pose { c: number; s: number; tx: number; ty: number; end: [number, number] }
interface Layer extends VillageLayer { width: number; height: number; x: number; y: number; phase: number; alpha: number; rotation: number }

function createRig(layer: Layer): Rig {
  const { width, height } = layer;
  const motion = (layer.motion || (layer.group === 'cloth' ? 'flag' : 'branch')) as Motion;
  const anchor = layer.anchor || (motion === 'branch' ? [0.5, 1] : [0.5, 0]);
  const root: [number, number] = [anchor[0] * width, anchor[1] * height];
  let dir: [number, number] = motion === 'branch' ? [0, -1] : [0, 1];
  if (layer.pin === 'left') dir = [1, 0];
  if (layer.pin === 'right') dir = [-1, 0];
  const extent = dir[0] ? (dir[0] > 0 ? width - root[0] : root[0]) : (dir[1] > 0 ? height - root[1] : root[1]);
  const length = Math.max(1, extent), angle = Math.atan2(dir[1], dir[0]), count = 4;
  const bones = Array.from({ length: count }, (_, i): Bone => ({
    start: [root[0] + dir[0] * length * i / count, root[1] + dir[1] * length * i / count], length: length / count, angle,
  }));
  const lever = bones.reduce((sum, _b, i) => sum + (length - length * i / count) * (0.65 + 0.35 * i / (count - 1)), 0);
  return { root, dir, length, width, height, bones, lever, motion, layer };
}

function poseRig(rig: Rig, time: number, wind: number): Pose[] {
  const layer = rig.layer, phase = layer.phase;
  const amplitude = Number.isFinite(layer.amplitude) ? layer.amplitude! : rig.motion === 'branch' ? 2.1 : rig.motion === 'awning' ? 2.3 : 3.0;
  const strength = clamp(wind, 0, 100) / 35;
  let start: [number, number] = [...rig.root], angle = rig.bones[0].angle;
  return rig.bones.map((bone, i) => {
    const wave = 0.81 * Math.sin(time * 0.89 + phase - i * 0.48) + 0.19 * Math.sin(time * 1.53 + phase * 1.7 - i * 0.81);
    angle += amplitude * strength * windEnvelope(time, phase) / rig.lever * (0.65 + 0.35 * i / 3) * wave;
    const delta = angle - bone.angle, c = Math.cos(delta), s = Math.sin(delta);
    const end: [number, number] = [start[0] + Math.cos(angle) * bone.length, start[1] + Math.sin(angle) * bone.length];
    const pose = { c, s, tx: start[0] - c * bone.start[0] + s * bone.start[1], ty: start[1] - s * bone.start[0] - c * bone.start[1], end };
    start = end;
    return pose;
  });
}

/** 메시 꼭짓점 하나: 부착 근처 15%는 고정, 그 뒤로 인접 두 본 변환을 섞음. 천은 끝으로 갈수록 작은 펄럭임 추가 */
function deformPoint(x: number, y: number, rig: Rig, poses: Pose[], time: number, wind: number, out: Float32Array, i: number): void {
  if (!wind) { out[i] = x; out[i + 1] = y; return; }
  const along = ((x - rig.root[0]) * rig.dir[0] + (y - rig.root[1]) * rig.dir[1]) / rig.length;
  const p = clamp(along), pin = smoothstep(0, 0.15, p);
  if (!pin) { out[i] = x; out[i + 1] = y; return; }
  const center = p * poses.length - 0.5;
  const a = poses[clamp(Math.floor(center), 0, poses.length - 1)], b = poses[clamp(Math.ceil(center), 0, poses.length - 1)];
  const mix = clamp(center - Math.floor(center));
  const px = (a.c * x - a.s * y + a.tx) * (1 - mix) + (b.c * x - b.s * y + b.tx) * mix;
  const py = (a.s * x + a.c * y + a.ty) * (1 - mix) + (b.s * x + b.c * y + b.ty) * mix;
  const flutter = rig.motion === 'branch' ? 0 : Math.sin(time * 1.91 - p * 4.2 + rig.layer.phase + x / rig.width * 1.3) * p * p * 0.22 * clamp(wind, 0, 100) / 35;
  out[i] = x + (px - x) * pin - rig.dir[1] * flutter;
  out[i + 1] = y + (py - y) * pin + rig.dir[0] * flutter;
}

/** 구름: 누적 거리로 x, 화면 밖에서만 되감고 가장자리에서 흐려짐 */
function cloudPose(layer: Layer, wind: number, sceneWidth: number, distance: number): { x: number; alpha: number } {
  const width = layer.width || 160, base = layer.x || 0;
  const range = sceneWidth + width + 32;
  const x = mod(base + width + 16 + distance, range) - width - 16;
  const fade = smoothstep(-width, -width + Math.min(60, width * 0.4), x) * (1 - smoothstep(sceneWidth - Math.min(60, width * 0.4), sceneWidth, x));
  return { x, alpha: fade * layer.alpha };
}
const cloudSpeed = (layer: Layer, wind: number) => (layer.speed || 0.8) * (0.55 + clamp(wind, 0, 100) / 78);

const flat = (poly: readonly (readonly [number, number])[]) => poly.flat();
function boundsOf(poly: readonly (readonly [number, number])[]) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

interface Item { layer: Layer; object: Sprite | MeshPlane; rig?: Rig; base?: Float32Array; positions?: Float32Array; buffer?: Buffer; travel: number }
interface Water { object: Graphics; config: VillageEffects['waterPaths'][number]; bounds: ReturnType<typeof boundsOf>; fall: boolean }

/** 로비 마을 장면 하나 (앱 전체에서 한 번 만들고 로비가 다시 그려지면 새 자리로 옮김) */
class Village {
  readonly host = document.createElement('div');
  private app?: Application;
  private world = new Container();
  private items: Item[] = [];
  private waters: Water[] = [];
  private lights: { object: Sprite; alpha: number; phase: number }[] = [];
  private motes?: Graphics;
  private birds?: Graphics;
  private glow?: Texture;
  private time = 0;
  private wind = VILLAGE.defaultWind;
  private raf = 0;
  private last: number | null = null;
  private ready = false;
  private failed = false;
  private readonly reduce = matchMedia('(prefers-reduced-motion: reduce)');
  /** 한 장 사이 최소 간격 (초). 폰 GPU = 약 30장, 소프트웨어 그래픽 (CI·GPU 없는 기기) = 4장 */
  private frame = 1 / 32;

  constructor() {
    this.host.className = 'lb-village';
    this.host.setAttribute('aria-hidden', 'true');
    // 그리기 전 / WebGL이 안 될 때: 고정 바탕 한 장
    const base = art(VILLAGE.background);
    if (base) this.host.innerHTML = `<img class="lb-village-base" src="${base}" width="${VILLAGE.width}" height="${VILLAGE.height}" alt="" decoding="async" draggable="false">`;
    document.addEventListener('visibilitychange', () => this.playback());
    this.reduce.addEventListener?.('change', () => { this.render(); this.playback(); });
  }

  /** 로비 무대 안에 붙임. 처음 한 번만 Pixi를 띄운다 */
  mount(slot: Element): void {
    if (this.host.parentElement !== slot) slot.appendChild(this.host);
    if (!this.app && !this.failed) this.init().catch(() => { this.failed = true; this.destroyApp(); });
    else this.playback();
  }

  private async init(): Promise<void> {
    const W = VILLAGE.width, H = VILLAGE.height;
    const app = new Application();
    this.app = app;
    await app.init({ width: W, height: H, resolution: 1, antialias: false, autoDensity: false, backgroundAlpha: 0, preference: 'webgl', autoStart: false, sharedTicker: false, eventFeatures: { click: false, move: false, globalMove: false, wheel: false } });
    this.world.sortableChildren = true;
    this.world.eventMode = 'none';
    app.stage.eventMode = 'none';
    app.stage.addChild(this.world);
    const names = [...new Set([VILLAGE.background, ...VILLAGE.layers.map(l => l.art), ...VILLAGE.occluders.map(l => l.art)])];
    const textures = new Map<string, Texture>();
    await Promise.all(names.map(async n => { const url = art(n); if (!url) throw new Error(`village art ${n}`); textures.set(n, await Assets.load<Texture>(url)); }));
    const bg = new Sprite(textures.get(VILLAGE.background)!);
    bg.width = W; bg.height = H; bg.zIndex = -1000; bg.eventMode = 'none';
    this.world.addChild(bg);
    for (const l of [...VILLAGE.layers, ...VILLAGE.occluders]) this.addLayer(l, textures.get(l.art)!);
    this.addEffects(VILLAGE.effects);
    const canvas = app.canvas;
    canvas.className = 'lb-village-canvas';
    // 그래픽 연결이 끊기면 고정 바탕으로 돌아가고, 다음에 로비를 그릴 때 다시 만든다
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.destroyApp(); });
    this.host.appendChild(canvas);
    // GPU 없이 CPU로 그리는 환경이면 장 수를 크게 줄여 다른 화면·입력을 막지 않게
    if (/swiftshader|llvmpipe|software/i.test(rendererName(app))) this.frame = 1 / 4;
    this.ready = true;
    this.render();
    this.host.classList.add('live');
    this.playback();
  }

  private addLayer(src: VillageLayer, texture: Texture): void {
    const layer: Layer = { ...src, width: src.width || texture.width, height: src.height || texture.height, x: src.x || 0, y: src.y || 0, phase: src.phase || 0, alpha: src.alpha ?? 1, rotation: src.rotation || 0 };
    const anchor = layer.anchor || [0, 0];
    let object: Sprite | MeshPlane, item: Item;
    if (layer.motion === 'branch' || layer.motion === 'vine' || layer.motion === 'flag' || layer.motion === 'awning') {
      const nx = clamp(Math.ceil(layer.width / 16) + 1, 7, 33), ny = clamp(Math.ceil(layer.height / 16) + 1, 7, 45);
      const mesh = new MeshPlane({ texture, verticesX: nx, verticesY: ny });
      mesh.autoResize = false;
      const buffer = mesh.geometry.getBuffer('aPosition'), positions = buffer.data as Float32Array;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const i = (y * nx + x) * 2; positions[i] = x * layer.width / (nx - 1); positions[i + 1] = y * layer.height / (ny - 1); }
      buffer.update();
      if (layer.flipX) { const uv = mesh.geometry.getBuffer('aUV'); const d = uv.data as Float32Array; for (let i = 0; i < d.length; i += 2) d[i] = 1 - d[i]; uv.update(); }
      mesh.pivot.set(anchor[0] * layer.width, anchor[1] * layer.height);
      mesh.position.set(layer.x + anchor[0] * layer.width, layer.y + anchor[1] * layer.height);
      object = mesh;
      item = { layer, object, rig: createRig(layer), base: positions.slice(), positions, buffer, travel: 0 };
    } else {
      const sprite = new Sprite(texture);
      sprite.width = layer.width; sprite.height = layer.height;
      sprite.anchor.set(layer.flipX ? 1 - anchor[0] : anchor[0], anchor[1]);
      sprite.position.set(layer.x + anchor[0] * layer.width, layer.y + anchor[1] * layer.height);
      if (layer.flipX) sprite.scale.x = -Math.abs(sprite.scale.x);
      object = sprite;
      item = { layer, object, travel: 0 };
    }
    object.alpha = layer.alpha; object.rotation = layer.rotation; object.eventMode = 'none'; object.zIndex = layer.z || 0;
    this.world.addChild(object);
    if (layer.clip && layer.clip.length >= 3) {
      const mask = new Graphics().poly(flat(layer.clip)).fill(0xffffff);
      mask.eventMode = 'none';
      this.world.addChild(mask);
      object.mask = mask;
    }
    this.items.push(item);
  }

  private addEffects(fx: VillageEffects): void {
    for (const [fall, list] of [[false, fx.waterPaths], [true, fx.waterfalls]] as const) for (const config of list) {
      const object = new Graphics(), mask = new Graphics().poly(flat(config.polygon)).fill(0xffffff);
      object.zIndex = 18; object.eventMode = 'none'; mask.eventMode = 'none';
      this.world.addChild(object, mask);
      object.mask = mask;
      this.waters.push({ object, config, bounds: boundsOf(config.polygon), fall });
    }
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,205,104,.8)'); grad.addColorStop(0.24, 'rgba(255,188,78,.38)'); grad.addColorStop(0.65, 'rgba(255,165,52,.09)'); grad.addColorStop(1, 'rgba(255,153,35,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      this.glow = Texture.from(c);
      fx.lights.forEach((l, i) => {
        const s = new Sprite(this.glow);
        s.anchor.set(0.5); s.position.set(l.x, l.y); s.width = s.height = (l.radius || 35) * 2;
        s.blendMode = 'add'; s.zIndex = 500; s.eventMode = 'none';
        this.world.addChild(s);
        this.lights.push({ object: s, alpha: l.alpha ?? 0.13, phase: i * 2.1 });
      });
    }
    if (fx.motes.length) { this.motes = new Graphics(); this.motes.zIndex = 700; this.motes.eventMode = 'none'; this.world.addChild(this.motes); }
    if (fx.birds) { this.birds = new Graphics(); this.birds.zIndex = 20; this.birds.eventMode = 'none'; this.world.addChild(this.birds); }
  }

  private render(): void {
    if (!this.ready || !this.app) return;
    const t = this.time, wind = this.reduce.matches ? 0 : this.wind;
    for (const it of this.items) {
      const { layer, object } = it;
      if (it.rig && it.base && it.positions && it.buffer) {
        const poses = poseRig(it.rig, t, wind);
        for (let i = 0; i < it.base.length; i += 2) deformPoint(it.base[i], it.base[i + 1], it.rig, poses, t, wind, it.positions, i);
        it.buffer.update();
      } else if (layer.motion === 'cloud') {
        const p = cloudPose(layer, wind, VILLAGE.width, it.travel);
        object.x = p.x + (layer.anchor?.[0] || 0) * layer.width;
        object.alpha = p.alpha;
      } else if (layer.motion === 'bird') {
        const cycle = mod(t + layer.phase * 5, 29), progress = (cycle - 8) / 8;
        object.visible = progress >= 0 && progress <= 1;
        object.x = -layer.width + progress * (VILLAGE.width + 2 * layer.width);
        object.y = layer.y + Math.sin(progress * Math.PI) * -15;
        const scale = layer.height / object.texture.height;
        object.scale.y = scale * (0.78 + 0.22 * Math.cos(t * 6.1 + layer.phase));
      } else if (layer.group === 'lights') {
        object.alpha = layer.alpha * (0.97 + 0.02 * Math.sin(t * 2.2 + layer.phase) + 0.01 * Math.sin(t * 4.9));
      }
    }
    for (const w of this.waters) this.drawWater(w, t);
    for (const l of this.lights) l.object.alpha = l.alpha * (0.96 + 0.026 * Math.sin(t * 2.15 + l.phase) + 0.014 * Math.sin(t * 5.13 + l.phase));
    if (this.motes) this.drawMotes(this.motes, t, wind);
    if (this.birds) this.drawBirds(this.birds, t);
    this.app.render();
    // 화면 테스트가 움직임·멈춤을 확인하는 장면 시간
    this.host.dataset.t = t.toFixed(2);
  }

  private drawWater(w: Water, t: number): void {
    const g = w.object, b = w.bounds, c = w.config;
    g.clear();
    const n = c.density || 10, phase = (t * (w.fall ? 7 : 3.4)) % (b.height + 24), dir = c.direction || [0.2, 1];
    for (let i = 0; i < n; i++) {
      const seed = mod(i * 47.371, 1), seed2 = mod(i * 19.723 + 0.31, 1);
      const y = b.y + mod(seed2 * (b.height + 24) + phase, b.height + 24) - 12;
      const x = b.x + seed * b.width + Math.sin(t * 0.46 + i) * 1.2 + dir[0] * Math.sin(t * 0.13 + i) * 1.5;
      const alpha = (w.fall ? 0.095 : 0.1) * (0.68 + 0.32 * Math.sin(t * 0.73 + i * 1.9));
      if (w.fall) g.moveTo(x, y).quadraticCurveTo(x + Math.sin(i + t * 0.35) * 0.6, y + 3, x + 0.35, y + 7).stroke({ color: 0x90d8de, width: 0.85, alpha });
      else { const len = 4 + seed * 8; g.moveTo(x - len * 0.5, y).quadraticCurveTo(x, y + 1, x + len * 0.5, y - 0.4).stroke({ color: 0xa3e0db, width: 0.8, alpha }); }
    }
  }

  private drawMotes(g: Graphics, t: number, wind: number): void {
    g.clear();
    if (!wind) return;
    VILLAGE.effects.motes.forEach((p, i) => {
      const cycle = mod(t * 0.035 + i * 0.197, 1), alpha = smoothstep(0, 0.18, cycle) * (1 - smoothstep(0.72, 1, cycle)) * 0.27 * clamp(wind / 35, 0, 1.4);
      const x = p.x + cycle * 22 * wind / 35 + Math.sin(t * 0.5 + i) * 3, y = p.y + cycle * 95;
      g.ellipse(x, y, 1.35, 0.6 + 0.45 * Math.abs(Math.sin(t * 1.7 + i))).fill({ color: i % 2 ? 0xd1bc6e : 0x849452, alpha });
    });
  }

  private drawBirds(g: Graphics, t: number): void {
    g.clear();
    const progress = (mod(t, 29) - 10) / 8;
    if (progress < 0 || progress > 1) return;
    const x = -20 + progress * (VILLAGE.width + 40), y = 68 - Math.sin(clamp(progress) * Math.PI) * 13;
    for (let i = 0; i < 2; i++) {
      const bx = x - i * 23, by = y + i * 10, flap = Math.sin(t * 5.2 + i * 0.75) * 2;
      g.moveTo(bx - 3.2, by - flap).quadraticCurveTo(bx - 1.4, by - 0.6, bx, by + 0.25).quadraticCurveTo(bx + 1.5, by - 0.6, bx + 3.2, by - flap).stroke({ color: 0x4a626c, width: 0.72, alpha: 0.45 });
    }
  }

  /** 로비 화면이 [hidden]이면 (다른 탭) 멈춤. 다시 들어오면 mount()가 다시 시작 */
  private running(): boolean {
    return this.ready && !this.failed && !document.hidden && !this.reduce.matches && this.host.isConnected && !this.host.closest('[hidden]');
  }

  /** 초당 약 30장 (폰 배터리, 소프트웨어 그래픽은 4장). 시간은 실제 경과로 진행해 움직임 속도는 같다 */
  private playback(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.last = null;
    if (!this.running()) return;
    const tick = (now: number) => {
      this.raf = 0;
      if (!this.running()) { this.last = null; return; }
      const dt = this.last === null ? 0 : (now - this.last) / 1000;
      if (this.last === null || dt >= this.frame) {
        if (this.last !== null) this.advance(clamp(dt, 0, 0.3));
        this.last = now;
        this.render();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private advance(dt: number): void {
    this.time += dt;
    for (const it of this.items) if (it.layer.motion === 'cloud') it.travel += dt * cloudSpeed(it.layer, this.wind);
  }

  private destroyApp(): void {
    this.ready = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.host.classList.remove('live');
    try { this.app?.destroy({ removeView: true }, { children: true, texture: false, textureSource: false }); } catch { /* 이미 끊긴 WebGL */ }
    this.glow?.destroy(true);
    this.app = undefined; this.glow = undefined; this.motes = undefined; this.birds = undefined;
    this.world = new Container(); this.items = []; this.waters = []; this.lights = [];
  }
}

/** WebGL 그리기 장치 이름 (확장이 없으면 일반 이름) */
function rendererName(app: Application): string {
  const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
  if (!gl) return '';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
}

let scene: Village | null = null;
/** 로비 무대 자리 (.lb-canvas)에 마을을 붙임 */
export function mountVillage(slot: Element | null): void {
  if (!slot) return;
  scene ??= new Village();
  scene.mount(slot);
}
