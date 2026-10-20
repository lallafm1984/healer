/**
 * 로비 「살아 있는 마을」 (2026-10-11 코덱스 village-living-background 시안을 게임으로 옮김).
 * 건물은 고정 바탕 한 장. 따로 떨어진 투명 소품 (나뭇가지·잎·꽃·덩굴·깃발·차양·구름)만 움직인다.
 * 좌표·잘라내기 다각형은 원본 그림 853×1844 기준. 가지·덩굴·깃발·차양은 본 4개 리그로 메시를 휘게 하고 (부착선은 고정, 끝으로 갈수록 크게),
 * 구름은 누적 거리로 한 방향으로 흐른다 (바람을 바꿔도 위치가 튀지 않음). 새·낙엽은 실제 투명 그림, 물결·등불만 코드로 그린다.
 * 승인된 가지·덩굴·깃발·차양 진폭과 가림은 유지. 추가 요청한 구름 3종/속도 ×1.65 · 새 무리 · 낙엽은 data/village.ts에 둔다.
 * 종 그림은 쓰지 않는다 (10 4장): 시안의 종 레이어는 옮기지 않았다.
 * 로비를 다시 그려도 (보상 받기 등) 같은 캔버스를 새 자리로 옮겨 붙여 움직임이 이어진다. 로비가 안 보이거나 앱이 뒤로 가면 멈춘다.
 * 동작 줄이기 설정이면 바람 0으로 한 장면만 그린다. WebGL이 안 되면 고정 바탕 그림만 보인다.
 * 2026-10-12: 구름 그림자 · 햇살 · 금빛 먼지 · 물 반짝임 · 굴뚝 연기 · 돌풍 잎은 village-air.ts. 돌풍은 가지 · 덩굴 · 깃발도 오른쪽으로 밀었다 놓는다.
 * 설정 「시각 효과 줄이기」면 이 공기는 끄고 소품 흔들림만 남긴다.
 */
import { Application, Assets, Container, Graphics, MeshPlane, Sprite, Texture, type Buffer } from 'pixi.js';
import { art } from '../art';
import { VILLAGE, type VillageEffects, type VillageLayer } from '../data/village';
import { G } from '../game/state';
import { clamp, gustAt, mod, smoothstep, VillageAir } from './village-air';


/** 느린 공통 돌풍 + 소품마다 다른 위상 */
function windEnvelope(time: number, phase = 0): number {
  return 0.73 + 0.16 * Math.sin(time * 0.19) + 0.075 * Math.sin(time * 0.071 + 1.1) + 0.035 * Math.sin(time * 0.37 + phase);
}

type Motion = 'branch' | 'vine' | 'flag' | 'awning';
interface MotionProfile { sway: number; secondary: number; secondaryWeight: number; lag: number; gust: number; flutter: number; flutterRate: number; flutterWaves: number }
/** 승인된 진폭은 그대로 두고 재질마다 주기·본 사이 지연만 구분한다. */
const MOTION: Record<Motion, MotionProfile> = {
  branch: { sway: 0.79, secondary: 1.43, secondaryWeight: 0.18, lag: 0.38, gust: 0.94, flutter: 0, flutterRate: 0, flutterWaves: 0 },
  vine: { sway: 0.63, secondary: 1.17, secondaryWeight: 0.19, lag: 0.67, gust: 1.02, flutter: 0.16, flutterRate: 1.47, flutterWaves: 4.2 },
  flag: { sway: 1.14, secondary: 2.19, secondaryWeight: 0.24, lag: 0.56, gust: 1.16, flutter: 0.55, flutterRate: 4.73, flutterWaves: 6.4 },
  awning: { sway: 0.87, secondary: 1.69, secondaryWeight: 0.15, lag: 0.33, gust: 0.82, flutter: 0.23, flutterRate: 2.63, flutterWaves: 4.8 },
};
interface Bone { start: [number, number]; length: number; angle: number }
interface Rig { root: [number, number]; dir: [number, number]; length: number; width: number; height: number; bones: Bone[]; lever: number; motion: Motion; layer: Layer; profile: MotionProfile; rate: number; gustDelay: number; flutter?: Float32Array }
interface Pose { c: number; s: number; tx: number; ty: number; end: [number, number] }
interface RigPose { bones: Pose[]; flutterSin: number; flutterCos: number }
interface Layer extends VillageLayer { width: number; height: number; x: number; y: number; phase: number; alpha: number; rotation: number }

function createRig(layer: Layer, vertices: Float32Array): Rig {
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
  const profile = MOTION[motion];
  // 같은 소품도 약 ±9% 다른 주기. 큰 나무는 작은 잎보다 천천히 반응한다.
  const rate = (1 + Math.sin(layer.phase * 1.73 + 0.4) * 0.09) * (motion === 'branch' ? 1 - clamp((length - 100) / 260) * 0.12 : 1);
  const gustDelay = clamp(layer.x / VILLAGE.width) * 1.4 + (motion === 'vine' ? 0.65 : motion === 'branch' ? 0.3 : 0);
  // sin(시간 + 위치)를 전개: 공간 성분은 한 번만 계산해 천 꼭짓점마다 매 프레임 sin을 부르지 않는다.
  const flutter = profile.flutter ? new Float32Array(vertices.length) : undefined;
  if (flutter) for (let i = 0; i < vertices.length; i += 2) {
    const x = vertices[i], y = vertices[i + 1];
    const p = clamp(((x - root[0]) * dir[0] + (y - root[1]) * dir[1]) / length);
    const wave = -p * profile.flutterWaves + x / width * 1.3;
    flutter[i] = Math.sin(wave) * p * p; flutter[i + 1] = Math.cos(wave) * p * p;
  }
  return { root, dir, length, width, height, bones, lever, motion, layer, profile, rate, gustDelay, flutter };
}

/** gust = 그 자리 돌풍 세기 0~1: 흔들림이 커지고 바람 쪽 (오른쪽)으로 기울었다가 돌아온다 */
function poseRig(rig: Rig, time: number, wind: number, gust = 0): RigPose {
  const layer = rig.layer, phase = layer.phase, profile = rig.profile, air = VILLAGE.ambience;
  const amplitude = Number.isFinite(layer.amplitude) ? layer.amplitude! : rig.motion === 'branch' ? 2.1 : rig.motion === 'awning' ? 2.3 : 3.0;
  const strength = clamp(wind, 0, 100) / 35 * air.sway * (1 + air.gust.boost * gust * profile.gust);
  const envelope = clamp(0.73 + (windEnvelope(time - rig.gustDelay, phase) - 0.73) * profile.gust);
  const bend = amplitude * strength * envelope / rig.lever, clock = time * rig.rate;
  // 위로 선 가지는 +각이 오른쪽, 매달린 덩굴 · 깃발은 -각이 오른쪽
  const lean = air.gust.lean * gust * (rig.dir[1] < 0 ? 1 : rig.dir[1] > 0 ? -1 : 0);
  let start: [number, number] = [...rig.root], angle = rig.bones[0].angle;
  const bones = rig.bones.map((bone, i) => {
    const wave = (1 - profile.secondaryWeight) * Math.sin(clock * profile.sway + phase - i * profile.lag)
      + profile.secondaryWeight * Math.sin(clock * profile.secondary + phase * 1.7 - i * profile.lag * 1.69);
    angle += bend * (0.65 + 0.35 * i / 3) * (wave + lean);
    const delta = angle - bone.angle, c = Math.cos(delta), s = Math.sin(delta);
    const end: [number, number] = [start[0] + Math.cos(angle) * bone.length, start[1] + Math.sin(angle) * bone.length];
    const pose = { c, s, tx: start[0] - c * bone.start[0] + s * bone.start[1], ty: start[1] - s * bone.start[0] - c * bone.start[1], end };
    start = end;
    return pose;
  });
  const flutterTime = clock * profile.flutterRate + phase;
  const flutterStrength = profile.flutter * strength * (0.7 + envelope * 0.3);
  return { bones, flutterSin: rig.flutter ? Math.sin(flutterTime) * flutterStrength : 0, flutterCos: rig.flutter ? Math.cos(flutterTime) * flutterStrength : 0 };
}

/** 부착점은 고정하고 첫 15%에서 변형을 부드럽게 풀어 준다. 천 끝의 잔물결도 같은 고정점을 따른다. */
function deformPoint(x: number, y: number, rig: Rig, pose: RigPose, out: Float32Array, i: number): void {
  const poses = pose.bones;
  const along = ((x - rig.root[0]) * rig.dir[0] + (y - rig.root[1]) * rig.dir[1]) / rig.length;
  const p = clamp(along), pin = smoothstep(0, 0.15, p);
  if (!pin) { out[i] = x; out[i + 1] = y; return; }
  const center = p * poses.length - 0.5;
  const a = poses[clamp(Math.floor(center), 0, poses.length - 1)], b = poses[clamp(Math.ceil(center), 0, poses.length - 1)];
  const mix = clamp(center - Math.floor(center));
  const px = (a.c * x - a.s * y + a.tx) * (1 - mix) + (b.c * x - b.s * y + b.tx) * mix;
  const py = (a.s * x + a.c * y + a.ty) * (1 - mix) + (b.s * x + b.c * y + b.ty) * mix;
  const flutter = rig.flutter ? pose.flutterSin * rig.flutter[i + 1] + pose.flutterCos * rig.flutter[i] : 0;
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
const cloudSpeed = (layer: Layer, wind: number, time: number) => VILLAGE.cloudSpeedScale * (layer.speed || 0.8) * (0.55 + clamp(wind, 0, 100) / 78)
  * (1 + 0.08 * Math.sin(time * 0.17 + layer.phase * 0.18));

const flat = (poly: readonly (readonly [number, number])[]) => poly.flat();
function boundsOf(poly: readonly (readonly [number, number])[]) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

interface Item { layer: Layer; object: Sprite | MeshPlane; rig?: Rig; base?: Float32Array; positions?: Float32Array; buffer?: Buffer; travel: number }
interface Water { object: Graphics; config: VillageEffects['waterPaths'][number]; bounds: ReturnType<typeof boundsOf>; fall: boolean }
interface Leaf { object: Sprite; config: VillageEffects['motes'][number]; scale: number }

/** 로비 마을 장면 하나 (앱 전체에서 한 번 만들고 로비가 다시 그려지면 새 자리로 옮김) */
class Village {
  readonly host = document.createElement('div');
  private app?: Application;
  private world = new Container();
  private items: Item[] = [];
  private waters: Water[] = [];
  private lights: { object: Sprite; alpha: number; phase: number; size: number; rate: number }[] = [];
  private leaves: Leaf[] = [];
  private birdFrames: Texture[] = [];
  private glow?: Texture;
  private air?: VillageAir;
  private time = 0;
  private wind = VILLAGE.defaultWind;
  private raf = 0;
  private last: number | null = null;
  private ready = false;
  private failed = false;
  private readonly reduce = matchMedia('(prefers-reduced-motion: reduce)');
  /** 한 장 사이 최소 간격 (초). 폰 GPU = 약 30장 */
  private frame = 1 / 32;
  /** GPU 없이 CPU로 그리는 환경 (CI · GPU 가속이 없는 기기): 움직이지 않는 한 장면만 (동작 줄이기처럼).
   * 화면 테스트는 window.__villageMotion = true로 초당 4장 움직임을 켤 수 있다. */
  private still = false;

  constructor() {
    this.host.className = 'lb-village';
    this.host.setAttribute('aria-hidden', 'true');
    this.host.style.pointerEvents = 'none';
    // 그리기 전 / WebGL이 안 될 때: 고정 바탕 한 장
    const base = art(VILLAGE.background);
    if (base) this.host.innerHTML = `<img class="lb-village-base" src="${base}" width="${VILLAGE.width}" height="${VILLAGE.height}" alt="" decoding="async" draggable="false">`;
    document.addEventListener('visibilitychange', () => this.playback());
    addEventListener('resize', () => this.measure());
    this.reduce.addEventListener?.('change', () => { this.render(); this.playback(); });
  }

  /** 로비 무대 안에 붙임. 처음 한 번만 Pixi를 띄운다 */
  mount(slot: Element): void {
    if (this.host.parentElement !== slot) slot.appendChild(this.host);
    this.measure();
    if (!this.app && !this.failed) this.start();
    else this.playback();
  }

  /**
   * 로비를 열기 전에 Pixi와 마을 그림을 미리 준비 (타이틀 화면에서). 예전엔 로비를 처음 열 때 읽기 시작해
   * 바탕 그림만 먼저 보이고 나무 · 집 · 구름이 뒤에 나타났음 (2026-10-17 Lim 「첫 로비 화면에서 나무 등 살짝 늦게 나옴」)
   */
  prepare(): void {
    if (!this.app && !this.failed) this.start();
  }

  private start(): void {
    this.init().catch(() => { this.failed = true; this.destroyApp(); });
  }

  private async init(): Promise<void> {
    const W = VILLAGE.width, H = VILLAGE.height;
    const app = new Application();
    this.app = app;
    // 문자열 선호도는 CanvasRenderer까지 자동 대체한다. 메시를 지원하는 WebGL만 요청하고, 실패하면 바탕 그림을 유지한다.
    await app.init({ width: W, height: H, resolution: 1, antialias: false, autoDensity: false, backgroundAlpha: 0, preference: ['webgl'], autoStart: false, sharedTicker: false, eventFeatures: { click: false, move: false, globalMove: false, wheel: false } });
    this.world.sortableChildren = true;
    this.world.eventMode = 'none';
    app.stage.eventMode = 'none';
    app.stage.addChild(this.world);
    const names = [...new Set([VILLAGE.background, VILLAGE.effects.leafArt, ...VILLAGE.birdFrames, ...VILLAGE.layers.map(l => l.art), ...VILLAGE.occluders.map(l => l.art)])];
    const textures = new Map<string, Texture>();
    await Promise.all(names.map(async n => { const url = art(n); if (!url) throw new Error(`village art ${n}`); textures.set(n, await Assets.load<Texture>(url)); }));
    this.birdFrames = VILLAGE.birdFrames.map(n => textures.get(n)!);
    const bg = new Sprite(textures.get(VILLAGE.background)!);
    bg.width = W; bg.height = H; bg.zIndex = -1000; bg.eventMode = 'none';
    this.world.addChild(bg);
    for (const l of [...VILLAGE.layers, ...VILLAGE.occluders]) this.addLayer(l, textures.get(l.art)!);
    this.addEffects(VILLAGE.effects, textures.get(VILLAGE.effects.leafArt)!);
    this.air = new VillageAir(this.world, textures.get(VILLAGE.effects.leafArt)!, VILLAGE.effects.leafContentWidth);
    this.measure();
    this.host.dataset.clouds = String(this.items.filter(it => it.layer.motion === 'cloud').length);
    this.host.dataset.birds = String(this.items.filter(it => it.layer.motion === 'bird').length);
    this.host.dataset.leaves = String(this.leaves.length);
    this.host.dataset.cloudSpeedScale = String(VILLAGE.cloudSpeedScale);
    const canvas = app.canvas;
    canvas.className = 'lb-village-canvas';
    // 그래픽 연결이 끊기면 고정 바탕으로 돌아가고, 다음에 로비를 그릴 때 다시 만든다
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.destroyApp(); });
    this.host.appendChild(canvas);
    // GPU 없이 CPU로 그리는 환경이면 한 장면만 (853×1844를 계속 그리면 다른 화면 · 입력까지 막힘)
    const gpu = rendererName(app);
    this.host.dataset.gl = gpu;
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) {
      if ((globalThis as { __villageMotion?: boolean }).__villageMotion) this.frame = 1 / 4;
      else this.still = true;
    }
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
      item = { layer, object, rig: createRig(layer, positions), base: positions.slice(), positions, buffer, travel: 0 };
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

  private addEffects(fx: VillageEffects, leafTexture: Texture): void {
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
        this.lights.push({ object: s, alpha: l.alpha ?? 0.13, phase: i * 2.1, size: s.width, rate: 0.76 + i * 0.11 });
      });
    }
    for (const config of fx.motes) {
      const object = new Sprite(leafTexture), scale = config.size / fx.leafContentWidth;
      object.anchor.set(0.5);
      object.scale.set(scale);
      object.eventMode = 'none'; object.zIndex = 700;
      this.world.addChild(object);
      this.leaves.push({ object, config, scale });
    }
  }

  private render(): void {
    if (!this.ready || !this.app) return;
    const t = this.time, wind = this.reduce.matches ? 0 : this.wind;
    for (const it of this.items) {
      const { layer, object } = it;
      if (it.rig && it.base && it.positions && it.buffer) {
        if (!wind) it.positions.set(it.base);
        else {
          const pose = poseRig(it.rig, t, wind, gustAt(t, layer.x + layer.width / 2));
          for (let i = 0; i < it.base.length; i += 2) deformPoint(it.base[i], it.base[i + 1], it.rig, pose, it.positions, i);
        }
        it.buffer.update();
      } else if (layer.motion === 'cloud') {
        const p = cloudPose(layer, wind, VILLAGE.width, it.travel);
        // p.x는 좌측 경계. 음수 scale에서는 실제 anchor의 반대쪽이 좌측이 된다.
        const anchorX = object instanceof Sprite ? object.anchor.x : (layer.anchor?.[0] || 0);
        object.x = p.x + (object.scale.x < 0 ? 1 - anchorX : anchorX) * layer.width;
        object.alpha = p.alpha;
      } else if (layer.motion === 'bird' && object instanceof Sprite) {
        this.poseBird(object, layer, t);
      } else if (layer.group === 'lights') {
        object.alpha = layer.alpha * (0.97 + 0.02 * Math.sin(t * 2.2 + layer.phase) + 0.01 * Math.sin(t * 4.9));
      }
    }
    for (const w of this.waters) this.drawWater(w, t);
    for (const l of this.lights) {
      // 두 등불만 서로 다른 호흡. 빛의 범위는 2% 안에서 변해 건물·메뉴는 움직이지 않는다.
      const breath = Math.sin(t * l.rate + l.phase);
      l.object.alpha = l.alpha * (1 + 0.14 * breath + 0.035 * Math.sin(t * 2.17 + l.phase * 1.3));
      l.object.width = l.object.height = l.size * (1 + 0.018 * breath);
    }
    for (const leaf of this.leaves) this.poseLeaf(leaf, t, wind);
    this.air?.pose(t, this.calm() ? 0 : wind);
    this.app.render();
    // 화면 테스트가 움직임·멈춤을 확인하는 장면 시간
    this.host.dataset.t = t.toFixed(2);
    this.host.dataset.visibleBirds = String(this.items.filter(it => it.layer.motion === 'bird' && it.object.visible && it.object.alpha > 0.02).length);
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

  /** 먼 새 한 마리가 birdCross초에 하늘을 횡단하고 birdCycle초마다 다시. 다음 순환에서는 반대 방향으로 조금 더 높고 작게 (더 먼 하늘).
   *  예전 먼 계곡 경로는 이 크기에선 마을 그림에 묻혀 안 보여 하늘만 쓴다. */
  private poseBird(object: Sprite, layer: Layer, t: number): void {
    const elapsed = t + 6 - (layer.flightDelay || 0), pass = Math.floor(elapsed / VILLAGE.birdCycle);
    const progress = mod(elapsed, VILLAGE.birdCycle) / VILLAGE.birdCross, back = mod(pass, 2) === 1;
    object.visible = progress <= 1;
    if (!object.visible) return;
    // 날갯짓: flaps번 치는 동안 조금 오르고, 날개 편 채 미끄러지며 천천히 내려온다.
    // 한 번 칠 때 올림 (up) → 펼침 (mid) → 내림 (mid를 납작하게) → 펼침. 두 장을 쉬지 않고 번갈면 깜빡이듯 어색했다 (Lim 2026-10-12).
    const beat = VILLAGE.birdFlap, flapTime = beat.flaps / beat.rate, local = mod(t + layer.phase, beat.period);
    const flapping = local < flapTime, stroke = flapping ? mod(local * beat.rate, 1) : 0;
    const up = flapping && stroke < 0.32, down = flapping && stroke >= 0.56 && stroke < 0.84;
    const lift = flapping ? smoothstep(0, 1, local / flapTime) : 1 - smoothstep(0, 1, (local - flapTime) / (beat.period - flapTime));
    const direction = back ? -1 : 1, across = -40 + progress * (VILLAGE.width + 80), far = back ? 0.85 : 1;
    object.x = back ? VILLAGE.width - across : across;
    object.y = layer.y - (back ? 16 : 0) - Math.sin(progress * Math.PI) * (back ? 10 : 16)
      + Math.sin(progress * Math.PI * 2 + layer.phase) * 3 - lift * 2.4 * far;
    object.alpha = layer.alpha * (back ? 0.92 : 1) * smoothstep(0, 0.06, progress) * (1 - smoothstep(0.92, 1, progress));
    const texture = this.birdFrames[up ? 1 : 0];
    if (object.texture !== texture) object.texture = texture;
    // 원본 전체 텍스처 사용: alpha 여백을 포함해 배율만 보정하고 두 자세의 몸통을 같은 점에 둔다.
    const scale = layer.width * far / (up ? 207 : 225);
    object.anchor.set(0.47, up ? 0.7 : 0.62);
    object.scale.set(-direction * scale, scale * (down ? 0.62 : flapping ? 1 : 0.9));
    // 칠 때는 머리를 살짝 들고, 활공하며 내려올 때는 살짝 숙임 (치기 시작·끝에서 0이라 끊기지 않음)
    const tilt = flapping ? -0.04 * Math.sin(Math.PI * local / flapTime) : 0.06 * Math.sin(Math.PI * (local - flapTime) / (beat.period - flapTime));
    object.rotation = direction * tilt;
  }

  /** 측면 나무에서 나온 잎. 반복 위치는 alpha=0에서만 되감아 나타남/사라짐이 튀지 않는다. */
  private poseLeaf({ object, config: p, scale }: Leaf, t: number, wind: number): void {
    object.visible = wind > 0;
    if (!object.visible) return;
    const progress = mod(t / p.duration + p.phase, 1), strength = clamp(wind / 35, 0, 1.4);
    const flutter = Math.sin(t * 1.05 + p.phase * 9);
    object.position.set(p.x + progress * p.drift[0] * strength + Math.sin(t * 0.82 + p.phase * 8) * 7,
      p.y + progress * p.drift[1] + flutter * 4);
    object.alpha = 0.58 * strength * smoothstep(0, 0.16, progress) * (1 - smoothstep(0.72, 1, progress));
    object.rotation = p.rotation + t * (p.drift[0] > 0 ? 0.31 : -0.27) + flutter * 0.46;
    object.scale.set(scale * (0.48 + 0.52 * Math.abs(Math.cos(t * 1.22 + p.phase * 7))), scale);
  }

  /** 로비 화면이 [hidden]이면 (다른 탭) 멈춤. 다시 들어오면 mount()가 다시 시작 */
  private running(): boolean {
    return this.ready && !this.failed && !this.still && !document.hidden && !this.reduce.matches && this.host.isConnected && !this.host.closest('[hidden]');
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
    for (const it of this.items) if (it.layer.motion === 'cloud') it.travel += dt * cloudSpeed(it.layer, this.wind, this.time);
    if (!this.calm()) this.air?.advance(dt, this.time, this.wind);
  }

  /** 설정 「시각 효과 줄이기」: 마을 공기 (그림자 · 햇살 · 먼지 · 반짝임 · 연기 · 돌풍 잎)는 끔 */
  private calm(): boolean {
    return !!G.save.settings.reducedEffects;
  }

  /** 지금 보이는 장면 아래 끝 (그림 y). 마을은 폭에 맞추고 아래가 잘리므로 폰마다 다르다 */
  private measure(): void {
    const world = this.host.closest('.lb-world'), w = this.host.clientWidth;
    if (this.air && world && w > 0) this.air.bottom = Math.min(VILLAGE.height, world.clientHeight / w * VILLAGE.width);
  }

  private destroyApp(): void {
    this.ready = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.host.classList.remove('live');
    try { this.app?.destroy({ removeView: true }, { children: true, texture: false, textureSource: false }); } catch { /* 이미 끊긴 WebGL */ }
    this.glow?.destroy(true);
    this.air?.destroy();
    this.app = undefined; this.glow = undefined; this.air = undefined;
    this.world = new Container(); this.items = []; this.waters = []; this.lights = []; this.leaves = []; this.birdFrames = [];
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
/** 로비를 열기 전에 마을을 미리 준비 (타이틀이 뜬 뒤) */
export function prepareVillage(): void {
  scene ??= new Village();
  scene.prepare();
}
/** 로비 무대 자리 (.lb-canvas)에 마을을 붙임 */
export function mountVillage(slot: Element | null): void {
  if (!slot) return;
  scene ??= new Village();
  scene.mount(slot);
}
