/**
 * 전투 판 그리기 (PixiJS, WebGL → 안 되면 Canvas). 20 4-1: 전투 화면은 캔버스에만 그리고 매 프레임 HTML은 안 고침.
 * 칸 = 체력 물통 · 역할 아이콘 · 닉네임 · 체력 숫자 · 디버프 테두리 (16 9장 2번: 파티원 그림 없음).
 * 이펙트 (16 4-6): 힐 = 부드러운 빛 + 별 반짝이(사제 금·흰), 치명타 = 반짝이 2배 + 작은 종, 큰 피격 = 날카로운 빨간 자국.
 * 칸 위 이펙트는 0.4초 안에 사라지고 체력 숫자·디버프 테두리 아래에 그림.
 */
import { Application, BitmapFont, BitmapText, Container, Graphics, Matrix, RenderTexture, Sprite, Text, Texture } from 'pixi.js';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import { aggroTarget, hexDist, slotKey, type Unit } from '../engine';
import { $, B, DEB, dirSlot, DIR_DEG, ROLE, SEL, ui } from './core';

// ---------- 색 ----------
const hex = (c: string) => parseInt(c.slice(1, 7), 16);
const C = {
  cell: 0x1a1b2e, cellLine: 0x2b2d4a, line: 0x0b0b12, ink: 0xf6f0e0, dead: 0x8a8ba0, gold: 0xf0c46a, white: 0xffffff,
  zone: 0xd6483a, tel: 0xff4a3d, danger: 0xff3b30, tankMark: 0xd9342b, teal: 0x51c6c0, heal: 0x8cf29c, crit: 0xffe08a, over: 0x9c9db8,
};
const FONT = '"Jua", "Gowun Dodum", sans-serif';

// ---------- Pixi 준비 ----------
let app: Application | null = null;
let ready = false;
const cv = $('board') as HTMLCanvasElement;
const root = new Container();
const cellsG = new Graphics();
const unitsG = new Graphics();
const glowL = new Container();
const fxG = new Graphics();
const overG = new Graphics();
const labelsL = new Container();
const topG = new Graphics();
const topL = new Container();
const lensL = new Container();
root.addChild(cellsG, unitsG, glowL, fxG, overG, labelsL, topG, topL, lensL);

let dpr = 1;
export const L = { s: 40, W: 0, H: 0, ox: 0, oy: 0, ok: false };

/**
 * 처음 한 번. WebGL을 먼저 쓰고, 안 되는 기기는 Canvas로 (같은 그림).
 * 자동 화면 테스트(navigator.webdriver)는 소프트웨어 WebGL이 느려 Canvas. 주소에 ?renderer=webgl|canvas로 고를 수 있음
 */
export async function initBoard(): Promise<void> {
  const want = new URLSearchParams(location.search).get('renderer');
  const preference: ('webgl' | 'canvas')[] = want === 'webgl' || want === 'canvas' ? [want] : navigator.webdriver ? ['canvas'] : ['webgl', 'canvas'];
  const a = new Application();
  await a.init({
    canvas: cv, width: Math.max(1, cv.clientWidth), height: Math.max(1, cv.clientHeight), resolution: Math.min(3, window.devicePixelRatio || 1),
    autoDensity: false, antialias: true, backgroundAlpha: 0, preference, autoStart: false, sharedTicker: false,
    eventFeatures: { click: false, move: false, globalMove: false, wheel: false },
  });
  a.stage.addChild(root);
  app = a;
  ready = true;
  glowTex = makeGlow();
  if (B.F) resizeBoard();
  await document.fonts?.ready;
  installNumFont();
}
export const boardRenderer = () => (app ? app.renderer.name : '');

export function resizeBoard(): void {
  const r = $('boardWrap').getBoundingClientRect();
  dpr = Math.min(3, window.devicePixelRatio || 1);
  if (app) app.renderer.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), dpr);
  const F = B.F;
  if (!F) return;
  const W = r.width, H = r.height;
  const xs = F.cells.map(c => c.px), ys = F.cells.map(c => c.py);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
  const s = Math.min((W - 16) / (maxX - minX + Math.sqrt(3)), (H - 16) / (maxY + 2));
  Object.assign(L, { s, W, H, ox: (W - (maxX - minX) * s) / 2 - minX * s, oy: (H - maxY * s) / 2, ok: true });
  sizeKey++;
}
let sizeKey = 0;

export const center = (i: number) => { const c = B.F!.cells[i]; return { x: L.ox + c.px * L.s, y: L.oy + c.py * L.s }; };
export function unitPos(u: Unit): { x: number; y: number } {
  if (u.moving) {
    const a = center(u.moving.from), b = center(u.moving.to);
    let p = 1 - u.moving.left / u.moving.total; p = p * p * (3 - 2 * p);
    return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
  }
  return center(u.cell);
}
/** 터치 판정은 칸보다 10% 크게 (기획서 3-1) */
export function hit(x: number, y: number): number {
  const F = B.F;
  if (!F || !L.ok) return -1;
  let best = -1, bd = Infinity;
  F.cells.forEach((_, i) => { const p = center(i); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
  return bd <= L.s * 1.1 ? best : -1;
}

// ---------- 도형 ----------
type Pt = [number, number];
function hexPts(x: number, y: number, r: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < 6; k++) { const a = (Math.PI / 180) * (60 * k - 30); out.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  return out;
}
const flat = (pts: Pt[]) => pts.flatMap(p => p);
function hexPoly(g: Graphics, x: number, y: number, r: number): Graphics { return g.poly(flat(hexPts(x, y, r)), true); }
/** 볼록 다각형을 y 범위로 자름 (체력 물통 채우기 = 칸 모양 그대로) */
function clipY(pts: Pt[], yMin: number, yMax: number): Pt[] {
  const cut = (poly: Pt[], keep: (p: Pt) => boolean, edge: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ia = keep(a), ib = keep(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (edge - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, edge]); }
    }
    return out;
  };
  return cut(cut(pts, p => p[1] >= yMin, yMin), p => p[1] <= yMax, yMax);
}
function fillBand(g: Graphics, x: number, y: number, r: number, yMin: number, yMax: number, color: number, alpha = 1): void {
  const pts = clipY(hexPts(x, y, r), yMin, yMax);
  if (pts.length >= 3) g.poly(flat(pts), true).fill({ color, alpha });
}
/** 점선 (Pixi에는 점선이 없어 직접 나눔) */
function dashPoly(g: Graphics, pts: Pt[], dash: number, gap: number, width: number, color: number, alpha = 1): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash);
      g.moveTo(a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len).lineTo(a[0] + ((b[0] - a[0]) * e) / len, a[1] + ((b[1] - a[1]) * e) / len);
    }
  }
  g.stroke({ width, color, alpha, cap: 'butt' });
}
function dashCircle(g: Graphics, x: number, y: number, r: number, dash: number, gap: number, width: number, color: number, alpha = 1): void {
  const n = Math.max(6, Math.floor((2 * Math.PI * r) / (dash + gap)));
  const step = (2 * Math.PI) / n, da = step * (dash / (dash + gap));
  for (let k = 0; k < n; k++) { const a0 = k * step; g.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0)).arc(x, y, r, a0, a0 + da); }
  g.stroke({ width, color, alpha, cap: 'round' });
}

/** 역할 아이콘 (프로토타입과 같은 모양) */
function roleIcon(g: Graphics, role: Unit['role'], x: number, y: number, k: number): void {
  const ink = { width: 0, color: C.line };
  if (role === 'tank') {
    g.moveTo(x - k * 0.45, y - k * 0.5).lineTo(x + k * 0.45, y - k * 0.5).lineTo(x + k * 0.45, y - k * 0.02)
      .quadraticCurveTo(x + k * 0.4, y + k * 0.4, x, y + k * 0.58).quadraticCurveTo(x - k * 0.4, y + k * 0.4, x - k * 0.45, y - k * 0.02).closePath()
      .fill({ color: C.ink, alpha: 0.92 }).stroke({ ...ink, width: Math.max(1.5, k * 0.12), join: 'round' });
  } else if (role === 'melee') {
    const path = () => g.moveTo(x - k * 0.42, y + k * 0.42).lineTo(x + k * 0.42, y - k * 0.42).moveTo(x - k * 0.4, y + k * 0.05).lineTo(x - k * 0.05, y + k * 0.4);
    path().stroke({ ...ink, width: Math.max(3, k * 0.2), cap: 'round' });
    path().stroke({ width: Math.max(1.5, k * 0.1), color: C.ink, alpha: 0.95, cap: 'round' });
  } else if (role === 'ranged') {
    const path = () => g.arc(x - k * 0.1, y, k * 0.5, -Math.PI / 2.4, Math.PI / 2.4).moveTo(x + k * 0.03, y - k * 0.47).lineTo(x + k * 0.03, y + k * 0.47).moveTo(x - k * 0.45, y).lineTo(x + k * 0.5, y);
    g.moveTo(x - k * 0.1 + k * 0.5 * Math.cos(-Math.PI / 2.4), y + k * 0.5 * Math.sin(-Math.PI / 2.4));
    path().stroke({ ...ink, width: Math.max(3, k * 0.18), cap: 'round' });
    g.moveTo(x - k * 0.1 + k * 0.5 * Math.cos(-Math.PI / 2.4), y + k * 0.5 * Math.sin(-Math.PI / 2.4));
    path().stroke({ width: Math.max(1.4, k * 0.09), color: C.ink, alpha: 0.95, cap: 'round' });
  } else {
    const t = k * 0.17;
    g.rect(x - t, y - k * 0.5, t * 2, k).rect(x - k * 0.5, y - t, k, t * 2).fill({ color: C.gold }).stroke({ ...ink, width: Math.max(1.5, k * 0.12) });
    g.rect(x - t + 1, y - t + 1, t * 2 - 2, t * 2 - 2).fill({ color: C.gold });
  }
}
/** 작은 종 (치명타 힐, 16 4-6) */
function bellShape(g: Graphics, x: number, y: number, k: number, alpha: number): void {
  g.moveTo(x - k * 0.5, y + k * 0.35).quadraticCurveTo(x - k * 0.42, y - k * 0.45, x, y - k * 0.5).quadraticCurveTo(x + k * 0.42, y - k * 0.45, x + k * 0.5, y + k * 0.35).closePath()
    .fill({ color: C.gold, alpha }).stroke({ width: Math.max(1.2, k * 0.1), color: C.line, alpha });
  g.circle(x, y + k * 0.45, k * 0.12).fill({ color: C.gold, alpha }).stroke({ width: 1, color: C.line, alpha });
}
/** 손그림 느낌 4각 별 */
function star(g: Graphics, x: number, y: number, k: number, color: number, alpha: number): void {
  const w = k * 0.32;
  g.moveTo(x, y - k).quadraticCurveTo(x + w * 0.3, y - w * 0.3, x + k, y).quadraticCurveTo(x + w * 0.3, y + w * 0.3, x, y + k)
    .quadraticCurveTo(x - w * 0.3, y + w * 0.3, x - k, y).quadraticCurveTo(x - w * 0.3, y - w * 0.3, x, y - k).closePath().fill({ color, alpha });
}

// ---------- 글자 (같은 열쇠 = 같은 글자 객체, 바뀔 때만 다시 그림) ----------
// 자주 바뀌는 숫자(체력·힐 숫자·소생 초)는 비트맵 글꼴: 글자를 매번 새로 그려 올리지 않아 폰에서 가벼움
const NUM = 'healer-num';
let numFont = false;
function installNumFont(): void {
  if (numFont) { try { BitmapFont.uninstall(NUM); } catch { /* 이미 없음 */ } }
  BitmapFont.install({ name: NUM, style: { fontFamily: FONT, fontSize: 40, fill: 0xffffff, stroke: { color: C.line, width: 8, join: 'round' } }, chars: '0123456789+-', resolution: Math.min(2, window.devicePixelRatio || 1), padding: 4 });
  numFont = true;
}
const isNum = (t: string) => /^[+\-0-9]+$/.test(t);
interface LabelStyle { size: number; fill: number; stroke?: number; strokeW?: number; font?: string; num?: boolean }
type Label = Text | BitmapText;
class Labels {
  private map = new Map<string, { t: Label; used: boolean; sig: string }>();
  constructor(private parent: Container) {}
  begin(): void { for (const v of this.map.values()) v.used = false; }
  put(key: string, text: string, st: LabelStyle, x: number, y: number, alpha = 1, anchorY = 0.5): Label {
    const bmp = !!st.num && numFont && isNum(text);
    const sig = bmp ? `b|${st.size.toFixed(1)}` : `${st.size.toFixed(1)}|${st.fill}|${st.stroke ?? ''}|${st.strokeW ?? 0}|${st.font ?? FONT}`;
    let e = this.map.get(key);
    if (!e || e.sig !== sig) {
      if (e) e.t.destroy();
      const t: Label = bmp
        ? new BitmapText({ text, style: { fontFamily: NUM, fontSize: st.size } })
        : new Text({
          text, resolution: dpr,
          style: { fontFamily: st.font ?? FONT, fontSize: st.size, fill: st.fill, ...(st.strokeW ? { stroke: { color: st.stroke ?? C.line, width: st.strokeW, join: 'round' as const } } : {}) },
        });
      t.anchor.set(0.5, anchorY);
      this.parent.addChild(t);
      e = { t, used: true, sig };
      this.map.set(key, e);
    }
    if (e.t.text !== text) e.t.text = text;
    if (bmp) e.t.tint = st.fill;
    e.t.position.set(x, y); e.t.alpha = alpha; e.t.visible = true; e.used = true;
    return e.t;
  }
  end(): void { for (const [k, v] of this.map) if (!v.used) { v.t.destroy(); this.map.delete(k); } }
  clear(): void { for (const v of this.map.values()) v.t.destroy(); this.map.clear(); }
}
const labels = new Labels(labelsL);
const tops = new Labels(topL);
// 웹 글꼴이 늦게 오면 글자·숫자 글꼴을 다시 만듦
document.fonts?.addEventListener?.('loadingdone', () => { labels.clear(); tops.clear(); if (ready) installNumFont(); });

const mctx = document.createElement('canvas').getContext('2d')!;
function measure(text: string, size: number, font = FONT): number { mctx.font = `${size}px ${font}`; return mctx.measureText(text).width; }

function pill(g: Graphics, lb: Labels, key: string, x: number, y: number, text: string, bg: number, fg: number, fs: number, alpha = 1): void {
  const w = measure(text, fs) + fs * 0.7, h = fs * 1.35;
  g.roundRect(x - w / 2, y - h / 2, w, h, h / 2).fill({ color: bg, alpha }).stroke({ width: 1.5, color: C.line, alpha });
  lb.put(key, text, { size: fs, fill: fg }, x, y + 0.5, alpha);
}

// ---------- 빛 텍스처 (한 번 만들어 둠) ----------
let glowTex: Texture | null = null;
function makeGlow(): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}
const glows: Sprite[] = [];
let glowUsed = 0;
function glow(x: number, y: number, size: number, tint: number, alpha: number): void {
  if (!glowTex) return;
  let sp = glows[glowUsed];
  // 더하기 섞기(add)는 Canvas 렌더러에서 뒤에 그리는 것까지 번져서 보통 섞기로
  if (!sp) { sp = new Sprite(glowTex); sp.anchor.set(0.5); glows.push(sp); glowL.addChild(sp); }
  glowUsed++;
  sp.visible = true; sp.position.set(x, y); sp.width = sp.height = size; sp.tint = tint; sp.alpha = alpha;
}

// ---------- 판 위 효과 ----------
interface Fx { kind: 'heal' | 'hit' | 'dispel' | 'death' | 'revive'; id: number; t0: number; crit?: boolean; color?: number; seeds?: number[]; x?: number; y?: number }
interface Float { x: number; y: number; text: string; crit: boolean; over: boolean; t0: number; n: number }
interface Bubble { id: number; text: string; t0: number }
const FX_MS = 400;
const B2 = {
  floats: [] as Float[], bubbles: [] as Bubble[], fx: [] as Fx[], disp: {} as Record<number, number>, hitFx: {} as Record<number, number>,
  lastFlash: {} as Record<number, number>, lens: null as { idx: number; t0: number } | null, lastRender: 0, n: 0,
};
export function resetBoardFx(): void {
  B2.floats = []; B2.bubbles = []; B2.fx = []; B2.disp = {}; B2.hitFx = {}; B2.lastFlash = {}; B2.lens = null;
}
const rnd = () => Math.random();
export function fxHeal(u: Unit, eff: number, amt: number, crit: boolean, now: number): void {
  if (!L.ok) return;
  const p = unitPos(u);
  const over = eff < amt * 0.25; // 거의 다 넘친 힐은 회색으로 작게
  if (B2.floats.length < 40) B2.floats.push({ x: p.x + (rnd() - 0.5) * L.s * 0.5, y: p.y - L.s * 0.3, text: `+${eff}`, crit: crit && !over, over, t0: now, n: B2.n++ });
  B2.hitFx[u.id] = now;
  if (B2.fx.length < 60 && !over) B2.fx.push({ kind: 'heal', id: u.id, t0: now, crit, seeds: Array.from({ length: crit ? 8 : 4 }, rnd) });
}
export function fxRevive(u: Unit, now: number): void {
  if (!L.ok) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x, y: p.y - L.s * 0.3, text: '부활', crit: true, over: false, t0: now, n: B2.n++ });
  B2.hitFx[u.id] = now;
  B2.fx.push({ kind: 'revive', id: u.id, t0: now });
}
export function fxDispel(u: Unit, now: number): void { B2.fx.push({ kind: 'dispel', id: u.id, t0: now }); }
export function fxDeath(u: Unit, now: number): void { if (!L.ok) return; const p = unitPos(u); B2.fx.push({ kind: 'death', id: u.id, t0: now, color: hex(ROLE[u.role].color), x: p.x, y: p.y }); }
export function addBubble(id: number, text: string, now: number): void {
  B2.bubbles = B2.bubbles.filter(b => b.id !== id);
  B2.bubbles.push({ id, text, t0: now });
  if (B2.bubbles.length > 3) B2.bubbles.shift();
}
/** 20인 탭 확대 미리보기 0.3초 (02 3-1) */
export function lensAt(idx: number, now: number): void { B2.lens = { idx, t0: now }; }

/** 지속 힐 색: 새싹 초록 · 생장 연두 · 들꽃 분홍 · 빛의 서약 금색 */
const HOT_COLOR: Record<string, number> = { sprout: 0x7bc67e, growth: 0xb7e07a, wildflower: 0xe59ac0, oath: 0xf0c46a };

function predictedHeal(u: Unit): number {
  const F = B.F!;
  if (!F.cast) return 0;
  const sk = SKILLS[F.cast.key];
  const tgt = F.party.find(x => x.id === F.cast!.uid);
  if (!tgt) return 0;
  if (sk.target === 'area') return hexDist(F.cells[u.cell], F.cells[tgt.cell]) <= 1 ? sk.amt! * F.gear.heal * F.power : 0;
  return u === tgt ? sk.amt! * F.gear.heal * F.power * (u.hot > 0 ? 1.1 : 1) : 0;
}

// ---------- 한 프레임 ----------
export function render(now: number): void {
  const F = B.F;
  if (!ready || !app || !F || !L.ok) return;
  const t = now / 1000, s = L.s, r = s * 0.93;
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const rdt = Math.min(0.1, Math.max(0, (now - (B2.lastRender || now)) / 1000)); B2.lastRender = now;
  for (const g of [cellsG, unitsG, fxG, overG, topG]) g.clear();
  labels.begin(); tops.begin(); glowUsed = 0;
  const fs = (k: number, min: number) => Math.max(min, s * k);

  // 영역 (장판 예고·활성 장판)
  const zoneSet = new Set<number>(), telSet = new Set<number>();
  for (const z of F.zones) z.cells.forEach(i => zoneSet.add(i));
  for (const tl of F.tels) if (tl.kind === 'zone') tl.cells.forEach(i => telSet.add(i));
  F.cells.forEach((_, i) => {
    const p = center(i);
    hexPoly(cellsG, p.x, p.y, r).fill({ color: C.cell }).stroke({ width: 2, color: C.cellLine });
    if (zoneSet.has(i)) hexPoly(cellsG, p.x, p.y, r).fill({ color: C.zone, alpha: 0.55 });
    else if (telSet.has(i)) hexPoly(cellsG, p.x, p.y, r).fill({ color: C.tel, alpha: 0.12 + 0.2 * pulse });
    // 성기사 빛의 성역: 금빛 바닥, 끝나기 2초 전 깜빡임
    if (F.sanctuary && F.sanctuary.cells.has(i)) hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: F.sanctuary.end - F.t < 2 ? 0.08 + 0.14 * pulse : 0.2 });
  });
  // 장전된 범위 미리보기
  const armedKey = B.armed ? slotKey(F, B.armed) : null;
  const areaArmed = !!armedKey && SKILLS[armedKey].target === 'area';
  const areaCenter = areaArmed && ui.pointer ? hit(ui.pointer.x, ui.pointer.y) : -1;
  // 전염 범위 점선
  for (const u of F.party) {
    if (!u.alive) continue;
    if (!u.debuffs.some(x => x.trap)) continue;
    const c0 = F.cells[u.cell];
    F.cells.forEach((c, i) => { if (hexDist(c, c0) === 1) { const p = center(i); dashPoly(cellsG, hexPts(p.x, p.y, r * 0.98), 3, 4, 2.5, hex(DEB['질병'])); } });
  }

  // 파티원
  const busterIds = new Set<number>(); for (const tl of F.tels) if (tl.kind === 'buster') tl.units.forEach(id => busterIds.add(id));
  const castTarget = F.cast ? F.cast.uid : -1;
  const tank = aggroTarget(F); // 보스가 때리는 사람 (탱커가 모두 쓰러지면 대신 막는 사람)
  const over: { u: Unit; x: number; y: number; deb: Unit['debuffs'][number] | undefined }[] = []; // 배지·글자는 칸을 다 그린 뒤 위에
  for (const u of F.party) {
    if (!u.alive) {
      if (F.cells[u.cell].unit) continue;
      const p0 = center(u.cell);
      unitsG.moveTo(p0.x - r * 0.22, p0.y - r * 0.22).lineTo(p0.x + r * 0.22, p0.y + r * 0.22).moveTo(p0.x + r * 0.22, p0.y - r * 0.22).lineTo(p0.x - r * 0.22, p0.y + r * 0.22)
        .stroke({ width: Math.max(2, s * 0.06), color: C.dead, alpha: 0.35 });
      continue;
    }
    let { x, y } = unitPos(u);
    if (F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) x += Math.sin(t * 70) * s * 0.07;
    if (u.fleeing) x += Math.sin(t * 40) * s * 0.03;
    const shown = B2.disp[u.id] == null ? u.hp : B2.disp[u.id] + (u.hp - B2.disp[u.id]) * Math.min(1, rdt * 14);
    B2.disp[u.id] = shown;
    const frac = Math.max(0, Math.min(1, shown / u.max));
    const top = y - r, bot = y + r;
    hexPoly(unitsG, x, y, r).fill({ color: 0x20212f });
    const pred = predictedHeal(u);
    if (pred > 0) { const pf = Math.min(1, (u.hp + pred) / u.max); fillBand(unitsG, x, y, r, bot - 2 * r * pf, bot, 0xa0ffaa, 0.35); }
    fillBand(unitsG, x, y, r, bot - 2 * r * frac, bot, hex(ROLE[u.role].color));
    if (u.max < u.base) { // 최대 체력 감소분 = 칸 위쪽 회색 (채울 수 없는 영역)
      const hh = 2 * r * (1 - u.max / u.base);
      fillBand(unitsG, x, y, r, top, top + hh, 0x4a4b57);
      for (let k = -2 * r; k < 2 * r; k += 7) unitsG.moveTo(Math.max(x - r * 0.86, x - r + k), top + Math.max(0, x - r * 0.86 - (x - r + k))).lineTo(Math.min(x + r * 0.86, x - r + k + hh), top + Math.min(hh, x + r * 0.86 - (x - r + k)));
      unitsG.stroke({ width: 2, color: C.white, alpha: 0.12 });
    }
    if (frac < 0.3) hexPoly(unitsG, x, y, r).fill({ color: C.danger, alpha: 0.15 + 0.3 * pulse });
    if (u.flash > 0) hexPoly(unitsG, x, y, r).fill({ color: 0xff503c, alpha: Math.min(1, u.flash * 1.4) });
    const hk = (now - (B2.hitFx[u.id] ?? -1e9)) / 300;
    if (hk >= 0 && hk < 1) hexPoly(unitsG, x, y, r).fill({ color: 0xfff8d6, alpha: 0.4 * (1 - hk) });
    fillBand(unitsG, x, y, r, top, y, C.white, 0.06); // 윗면 광택
    // 큰 피격: 깜빡임이 새로 켜진 순간 = 날카로운 자국 (16 4-6)
    if (u.flash > (B2.lastFlash[u.id] ?? 0) + 0.05) B2.fx.push({ kind: 'hit', id: u.id, t0: now, seeds: [rnd()] });
    B2.lastFlash[u.id] = u.flash;
    // 테두리
    if (u.moving) dashPoly(unitsG, hexPts(x, y, r), 4, 4, Math.max(2.5, s * 0.07), 0xd8d3c0);
    else hexPoly(unitsG, x, y, r).stroke({ width: Math.max(2.5, s * 0.07), color: C.line });
    over.push({ u, x, y, deb: undefined });
  }

  // 효과 (칸 채움 위, 글자·테두리 아래)
  B2.fx = B2.fx.filter(e => now - e.t0 < FX_MS);
  for (const e of B2.fx) {
    const k = (now - e.t0) / FX_MS;
    const u = F.party.find(x => x.id === e.id);
    const p = e.x != null ? { x: e.x, y: e.y! } : u ? unitPos(u) : null;
    if (!p) continue;
    if (e.kind === 'heal') {
      glow(p.x, p.y, r * (1.6 + 0.6 * k), e.crit ? 0xfff1b8 : 0xfff8e6, 0.55 * (1 - k));
      e.seeds!.forEach((sd, i) => {
        const a = sd * Math.PI * 2, dist = r * (0.25 + 0.45 * k) * (0.6 + 0.4 * ((i * 0.37) % 1));
        const sx = p.x + Math.cos(a) * dist * 0.9, sy = p.y + Math.sin(a) * dist * 0.6 - r * 0.5 * k;
        star(fxG, sx, sy, r * (0.09 + 0.05 * ((i * 0.61) % 1)) * (1 - 0.3 * k), i % 2 ? C.white : C.gold, 1 - k * k);
      });
      if (e.crit) bellShape(fxG, p.x + r * 0.5, p.y - r * (0.42 + 0.3 * k), r * 0.3, 1 - k); // 직업 아이콘을 안 가리게 오른쪽 위
    } else if (e.kind === 'hit') {
      const kk = Math.min(1, k * 1.6), a = 1 - kk;
      if (a > 0) {
        const ang = -0.6 + e.seeds![0] * 0.3, len = r * (0.5 + 0.5 * kk);
        for (const off of [-0.18, 0.18]) {
          const cx = p.x + Math.sin(ang) * r * off, cy = p.y + Math.cos(ang) * r * off;
          fxG.moveTo(cx - Math.cos(ang) * len, cy + Math.sin(ang) * len).lineTo(cx + Math.cos(ang) * len, cy - Math.sin(ang) * len);
        }
        fxG.stroke({ width: Math.max(2, s * 0.08) * (1 - 0.5 * kk), color: 0xff5a3d, alpha: a, cap: 'round' });
      }
    } else if (e.kind === 'dispel') {
      fxG.circle(p.x, p.y, r * (0.5 + 0.7 * k)).stroke({ width: Math.max(2, s * 0.08) * (1 - k), color: C.teal, alpha: 1 - k });
    } else if (e.kind === 'revive') {
      glow(p.x, p.y, r * (1.4 + 1.2 * k), 0xfff1b8, 0.7 * (1 - k));
      fxG.circle(p.x, p.y, r * (0.6 + 0.8 * k)).stroke({ width: 3 * (1 - k), color: C.gold, alpha: 1 - k });
    } else if (e.kind === 'death') {
      hexPoly(fxG, p.x, p.y, r * (1 - 0.4 * k)).fill({ color: e.color!, alpha: 0.6 * (1 - k) });
    }
  }

  // 테두리 표시 · 배지
  for (const o of over) {
    const { u, x, y } = o;
    const deb = u.debuffs.slice().sort((a, b) => (b.trap ? 2 : DEB[b.type] && b.type !== '독' ? 1 : 0) - (a.trap ? 2 : DEB[a.type] && a.type !== '독' ? 1 : 0))[0];
    o.deb = deb;
    if (deb) {
      const w = Math.max(3, s * 0.13), col = hex(DEB[deb.type] || '#E5433D');
      if (deb.trap) dashPoly(overG, hexPts(x, y, r * 0.88), 6, 4, w, col); else hexPoly(overG, x, y, r * 0.88).stroke({ width: w, color: col });
    }
    if (tank === u) hexPoly(overG, x, y, r * 1.06).stroke({ width: Math.max(2, s * 0.06), color: C.tankMark });
    if (zoneSet.has(u.cell) || telSet.has(u.cell)) hexPoly(overG, x, y, r * 1.02).stroke({ width: Math.max(2.5, s * 0.09), color: 0xff5a3d, alpha: zoneSet.has(u.cell) ? 1 : 0.4 + 0.6 * pulse });
    if (u.guardian > 0) dashCircle(overG, x, y, r * 1.1, 2, 4, 3, C.ink, 0.9);
    // 버팀목 (특성): 금색 두꺼운 테두리, 끝나기 2초 전 깜빡임
    if (u.bulwark > 0) hexPoly(overG, x, y, r * 1.1).stroke({ width: Math.max(3, s * 0.09), color: C.gold, alpha: u.bulwark < 2 ? 0.35 + 0.6 * pulse : 0.95 });
    // 보호 두루마리: 흰 이중 테두리 (황토 질병·빨간 탱커 표시와 구분), 끝나기 2초 전 깜빡임
    if (u.shield > 0) { const a = u.shield < 2 ? 0.35 + 0.6 * pulse : 0.95; hexPoly(overG, x, y, r * 1.12).stroke({ width: 2, color: 0xedeff7, alpha: a }); hexPoly(overG, x, y, r * 1.2).stroke({ width: 2, color: 0xedeff7, alpha: a }); }
    // 직업 스킬 표시 (25 3장): 피해 감소(나무껍질·성역) 초록 테두리, 희생 금색 점선, 보호의 손 흰 두꺼운 테두리, 봉화 금색 점선 원
    if (u.immune > 0) hexPoly(overG, x, y, r * 1.14).stroke({ width: Math.max(3, s * 0.1), color: 0xffffff, alpha: u.immune < 2 ? 0.35 + 0.6 * pulse : 0.95 });
    else if (u.redu > 0) hexPoly(overG, x, y, r * 1.1).stroke({ width: 2.5, color: HOT_COLOR.sprout, alpha: u.redu < 2 ? 0.35 + 0.6 * pulse : 0.9 });
    if (u.sacr > 0) dashPoly(overG, hexPts(x, y, r * 1.16), 5, 4, 2, C.gold);
    if (F.beacon === u.id) dashCircle(overG, x, y, r * 1.22, 3, 5, 2.5, C.gold, 0.95);
    if (castTarget === u.id) hexPoly(overG, x, y, r * 1.12).stroke({ width: 3, color: hex(SEL) });
  }
  for (const { u, x, y, deb } of over) {
    // 칸 = 직업 아이콘 · 닉네임 · 체력 (2026-10-07 Lim: 성격 배지는 칸에서 빼고 길게 누르기 정보에만)
    roleIcon(overG, u.role, x, y - r * 0.38, s * 0.34);
    nick(u, x, y + r * 0.13, r);
    labels.put(`hp${u.id}`, String(Math.ceil(u.hp)), { size: fs(0.28, 10), fill: C.white, strokeW: 3, num: true }, x, y + r * 0.6);
    if (u.hot > 0) {
      const hx = x + r * 0.56, hy = y - r * 0.44, hr = Math.max(7, s * 0.19);
      overG.circle(hx, hy, hr).fill({ color: C.teal }).stroke({ width: 1.5, color: C.line });
      labels.put(`hot${u.id}`, String(Math.ceil(u.hot)), { size: hr * 1.05, fill: C.line }, hx, hy + 0.5);
    } else if (u.hots.length) {
      // 드루이드·성기사 지속 힐: 오른쪽 위 원 (색 = 가장 오래 남은 지속 힐, 숫자 = 남은 초), 여럿이면 아래로 작은 점
      const hs = u.hots.slice().sort((a, b) => b.left - a.left), h0 = hs[0];
      const hx = x + r * 0.56, hy = y - r * 0.44, hr = Math.max(7, s * 0.19);
      overG.circle(hx, hy, hr).fill({ color: HOT_COLOR[h0.key] ?? C.teal }).stroke({ width: 1.5, color: C.line });
      labels.put(`hot${u.id}`, String(Math.ceil(h0.left)), { size: hr * 1.05, fill: C.line }, hx, hy + 0.5);
      hs.slice(1, 3).forEach((h, k) => overG.circle(hx, hy + hr + 3 + k * (hr * 0.9), hr * 0.42).fill({ color: HOT_COLOR[h.key] ?? C.teal }).stroke({ width: 1, color: C.line }));
    }
    if (deb) {
      const d2 = deb.name === '썩은 숨결' ? `숨결${deb.stack}` : deb.trap ? `⚠전염 ${Math.ceil(deb.left)}` : deb.name;
      pill(overG, labels, `deb${u.id}`, x, y - r * 0.8, d2, deb.trap ? 0xf6e7b0 : hex(DEB[deb.type] || '#E5433D'), 0x12131f, fs(0.2, 9));
      // 다른 종류 디버프도 함께 걸려 있으면 왼쪽 위에 색 점으로 (질병+독이면 둘 다 보이게)
      const others = [...new Set(u.debuffs.filter(d => d !== deb && d.type !== deb.type).map(d => d.type))];
      others.forEach((ty, k) => overG.circle(x - r * 0.56 + k * r * 0.3, y - r * 0.44, Math.max(4, s * 0.12)).fill({ color: hex(DEB[ty] || '#E5433D') }).stroke({ width: 1.5, color: C.line }));
    }
    if (F.rats && F.rats.includes(u.id)) pill(overG, labels, `rat${u.id}`, x - r * 0.05, y + r * 0.95, '쥐떼', 0xb9a38a, 0x12131f, fs(0.18, 9));
    const bt = F.tels.find(tl => tl.kind === 'buster' && tl.units.includes(u.id));
    if (bt && bt.skill.dmg) {
      const sh = u.shield > bt.impact - F.t ? 0.6 : 1; // 맞을 때까지 보호 두루마리가 남아 있으면 -40%
      const dmg = Math.round(bt.skill.dmg * F.dmgMult * sh), lethal = dmg >= u.hp + (u.guardian > 0 ? 1e9 : 0);
      pill(overG, labels, `bus${u.id}`, x, y + r * 0.2, `-${dmg}`, lethal ? C.danger : 0xffb25b, 0x12131f, fs(0.3, 11));
    }
    if (busterIds.has(u.id)) {
      overG.circle(x, y, r * 0.75).moveTo(x - r, y).lineTo(x - r * 0.4, y).moveTo(x + r * 0.4, y).lineTo(x + r, y).moveTo(x, y - r).lineTo(x, y - r * 0.4)
        .stroke({ width: 3, color: C.tel, alpha: 0.6 + 0.4 * pulse });
    }
    if (F.t < u.wrongUntil && F.t > u.wrongUntil - 0.6) pill(overG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '?', C.gold, 0x12131f, fs(0.28, 11));
    else if (F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) pill(overG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '!', 0xff5a3d, 0x12131f, fs(0.28, 11));
    const st = u.bulwark > 0 ? ([`버팀 ${Math.ceil(u.bulwark)}`, '#F0C46A'] as const) : u.fleeing ? (['도망', '#DB9B57'] as const) : u.sulking ? (['삐짐', '#D68FA6'] as const) : null;
    if (st && s >= 40) pill(overG, labels, `st${u.id}`, x, y + r * 0.95, st[0], hex(st[1]), 0x12131f, fs(0.18, 9));
    else if (st) hexPoly(overG, x, y, r * 0.95).stroke({ width: 3, color: hex(st[1]), alpha: 0.5 + 0.5 * pulse });
  }
  // 장전 하이라이트
  if (armedKey) {
    if (areaArmed && areaCenter >= 0) {
      const c0 = F.cells[areaCenter];
      F.cells.forEach((c, i) => { if (hexDist(c, c0) <= 1) { const p = center(i); hexPoly(overG, p.x, p.y, r * 1.04).fill({ color: C.white, alpha: 0.14 }).stroke({ width: 3, color: hex(SEL) }); } });
    } else for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPoly(overG, p.x, p.y, r * 1.04).stroke({ width: 2, color: C.white, alpha: 0.3 + 0.4 * pulse }); }
  }
  if (!armedKey && ui.itemArmed) for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPoly(overG, p.x, p.y, r * 1.04).stroke({ width: 2.5, color: C.gold, alpha: 0.35 + 0.5 * pulse }); }
  // 튜토리얼 안내가 짚는 칸
  if (ui.coach && ui.coach.uid != null) {
    const cu = F.party.find(u => u.id === ui.coach!.uid);
    if (cu && cu.alive) { const p = unitPos(cu); hexPoly(overG, p.x, p.y, r * (1.18 + 0.06 * pulse)).stroke({ width: 4, color: C.gold, alpha: 0.55 + 0.45 * pulse }); }
  }

  // 떠오르는 숫자
  B2.floats = B2.floats.filter(fl => now - fl.t0 < 900);
  for (const fl of B2.floats) {
    const k = (now - fl.t0) / 900;
    const size = fl.crit ? fs(0.36, 14) : fl.over ? fs(0.22, 10) : fs(0.27, 11);
    tops.put(`fl${fl.n}`, fl.text, { size, fill: fl.crit ? C.crit : fl.over ? C.over : C.heal, strokeW: 3, num: true }, fl.x, fl.y - k * s * 0.6, 1 - k * k, 1);
  }
  // 쓸기 방향 미리보기
  if (ui.pointer && ui.pointer.dir && ui.pointer.idx >= 0) {
    const P = ui.pointer, it = dirSlot(P.dir!), c = center(P.idx);
    const ang = (DIR_DEG[P.dir!] * Math.PI) / 180;
    const ex = c.x + Math.cos(ang) * s * 1.1, ey = c.y - Math.sin(ang) * s * 1.1;
    topG.moveTo(c.x, c.y).lineTo(ex, ey).stroke({ width: 4, color: hex(SEL), cap: 'round' });
    topG.circle(ex, ey, 5).fill({ color: hex(SEL) });
    const label = it && it.key ? SKILLS[slotKey(F, it.key)].name : '비어 있음';
    pill(topG, tops, 'swipe', Math.max(40, Math.min(L.W - 40, ex)), Math.max(14, ey - s * 0.45), label, it && it.key ? C.ink : 0x5a5b70, 0x12131f, fs(0.28, 12));
  }
  // 말풍선 (동시에 최대 3개, 04 10장)
  B2.bubbles = B2.bubbles.filter(b => now - b.t0 < 1700);
  for (const b of B2.bubbles) {
    const u = F.party.find(x => x.id === b.id); if (!u) continue;
    const p = unitPos(u);
    const w = Math.min(L.W - 8, measure(b.text, 12, '"Gowun Dodum", sans-serif') + 14), h = 22;
    const bx = Math.max(4, Math.min(L.W - w - 4, p.x - w / 2));
    let by = p.y - r - h - 6;
    if (by < 2) by = p.y + r + 6;
    const a = Math.min(1, (1700 - (now - b.t0)) / 300);
    topG.roundRect(bx, by, w, h, 8).fill({ color: C.ink, alpha: a }).stroke({ width: 2, color: C.line, alpha: a });
    tops.put(`bb${b.id}`, b.text, { size: 12, fill: 0x12131f, font: '"Gowun Dodum", sans-serif' }, bx + w / 2, by + h / 2 + 0.5, a);
  }

  for (let i = glowUsed; i < glows.length; i++) glows[i].visible = false;
  labels.end(); tops.end();
  lensL.visible = false;
  app.renderer.render(app.stage);
  // 20인 탭 확대 미리보기 0.3초 (02 3-1): 손가락에 가리지 않게 칸 위쪽에 1.8배로
  if (B2.lens && now - B2.lens.t0 < 300) drawLens(now); else B2.lens = null;
}

function nick(u: Unit, x: number, y: number, r: number): void {
  // 닉네임: 칸 폭(약 1.45r)에 맞춰 글자를 줄이고, 그래도 길면 끝을 … 로
  const maxW = r * 1.45;
  let size = Math.max(9, L.s * 0.24), t = u.nick;
  while (measure(t, size) > maxW && size > 8.5) size -= 0.5;
  while (measure(t, size) > maxW && t.length > 2) t = t.slice(0, t.endsWith('…') ? -2 : -1) + '…';
  labels.put(`nk${u.id}`, t, { size, fill: C.ink, strokeW: 2.5 }, x, y);
}

let lensRT: RenderTexture | null = null;
const lensSprite = new Sprite();
const lensMask = new Graphics();
const lensRing = new Graphics();
lensL.addChild(lensSprite, lensMask, lensRing);
lensSprite.mask = lensMask;
function drawLens(now: number): void {
  if (!app || !B2.lens) return;
  const s = L.s, p = center(B2.lens.idx), src = s * 1.15, k = 1.8, R2 = src * k;
  const cx = Math.max(R2 + 2, Math.min(L.W - R2 - 2, p.x)), cy = Math.max(R2 + 2, p.y - s * 1.2 - R2);
  const size = Math.ceil(src * 2);
  if (!lensRT || lensRT.width !== size) { lensRT?.destroy(true); lensRT = RenderTexture.create({ width: size, height: size, resolution: dpr }); lensSprite.texture = lensRT; }
  app.renderer.render({ container: root, target: lensRT, clear: true, transform: new Matrix().translate(-(p.x - src), -(p.y - src)) });
  lensSprite.position.set(cx - R2, cy - R2); lensSprite.width = lensSprite.height = R2 * 2;
  lensMask.clear().circle(cx, cy, R2).fill({ color: 0x12131f });
  lensRing.clear().circle(cx, cy, R2).stroke({ width: 3, color: hex(SEL) });
  lensL.alpha = Math.min(1, (300 - (now - B2.lens.t0)) / 80);
  lensL.visible = true;
  app.renderer.render(app.stage);
}

/** 길게 누르기 정보창에 쓰는 직업 이름 (판 그림과 같은 출처) */
export const className = (u: Unit) => (u.cls ? CLASSES[u.cls].name : '');
void sizeKey;
