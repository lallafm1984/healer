/**
 * 전투 판 그리기 (PixiJS, WebGL → 안 되면 Canvas). 20 4-1: 전투 화면은 캔버스에만 그리고 매 프레임 HTML은 안 고침.
 * 칸 = 체력 물통 · 역할 아이콘 · 닉네임 · 체력 숫자 · 디버프 테두리 (16 9장 2번: 파티원 그림 없음). 「나」 칸은 역할 아이콘 대신 직업 문장 (27 3-4).
 * 이펙트 (16 4-6): 힐 = 부드러운 빛 + 별 반짝이(사제 금·흰), 치명타 = 반짝이 2배 + 작은 종, 큰 피격 = 날카로운 빨간 자국.
 * 칸 위 이펙트는 0.4초 안에 사라지고 체력 숫자·디버프 테두리 아래에 그림.
 */
import { Application, BitmapFont, BitmapText, Container, Graphics, Matrix, RenderTexture, Sprite, Text, Texture, type TextStyleFontWeight } from 'pixi.js';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import { aggroTarget, areaRadius, focusOrder, hexDist, ORDER_NUM, slotKey, type Unit } from '../engine';
import { emblemColor } from '../screens/art';
import { emblemSrc } from './art';
import { $, B, DEB, dirSlot, DIR_DEG, ROLE, S, SEL, ui } from './core';
import { cellTypography, debuffDisplay, fitPartyName, healthDisplay, primaryDebuff } from './party-display';
import { CELL_RADIUS, fitBoard } from './board-layout';

// ---------- 색 ----------
const hex = (c: string) => parseInt(c.slice(1, 7), 16);
// 테마 「길드 홀」 (2026-10-08): 돌색 빈칸, 청동 안쪽 테두리, 물통 빈 부분 = 돌 3. 디버프·위험 색은 그대로
const C = {
  cell: 0x15120e, cellLine: 0x2c241b, line: 0x080605, ink: 0xf1e4c8, dead: 0x8a7f6a, gold: 0xf0c46a, white: 0xffffff,
  zone: 0xe2402e, zoneHi: 0xff6a4a, tel: 0xff4a3d, danger: 0xff3b30, tankMark: 0xff6a60, teal: 0x51c6c0, heal: 0x8cf29c, crit: 0xffe08a, over: 0xa99a7e,
  empty: 0x2c241b, dangerBg: 0x3b1514, bronze: 0x5c4424, frame: 0x9c7a3c, dark: 0x12100c,
};
const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
/** 글자 굵기: 이름·배지 700, 체력 숫자 900 */
const W_TEXT: TextStyleFontWeight = '700', W_NUM: TextStyleFontWeight = '900';

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
const emblemL = new Container();
root.addChild(cellsG, unitsG, glowL, fxG, overG, emblemL, labelsL, topG, topL, lensL);

let dpr = 1;
export const L = { s: 40, W: 0, H: 0, ox: 0, oy: 0, left: 2, right: 2, top: 2, bottom: 2, ok: false };

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
  const style = getComputedStyle($('boardWrap'));
  const inset = (name: string) => Math.max(0, Number.parseFloat(style.getPropertyValue(name)) || 0);
  // 중앙 정렬된 앱 바깥에서 이미 확보된 safe area를 다시 빼지 않는다.
  const left = Math.max(0, inset('--board-safe-left') - r.left);
  const right = Math.max(0, inset('--board-safe-right') - (window.innerWidth - r.right));
  const layout = fitBoard(F.cells, r.width, r.height, { left, right });
  const { s } = layout;
  Object.assign(L, layout, { ok: true });
  // 실제 표시 크기만 노출: viewport 회귀 검수에서 CSS px 기준으로 확인한다.
  const type = cellTypography(s);
  Object.assign(cv.dataset, {
    cellScale: s.toFixed(2), cellWidth: (s * CELL_RADIUS * Math.sqrt(3)).toFixed(2), cellHeight: (s * CELL_RADIUS * 2).toFixed(2),
    hpFontSize: type.hp.toFixed(2), nickFontSize: type.nick.toFixed(2), compactCells: String(type.compact),
    boardSafeLeft: layout.left.toFixed(2), boardSafeRight: layout.right.toFixed(2),
    boardSafeTop: layout.top.toFixed(2), boardSafeBottom: layout.bottom.toFixed(2),
    boardInsetLeft: left.toFixed(2), boardInsetRight: right.toFixed(2), boardFitAxis: layout.axis,
  });
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
/** 장판 빗금 (칸 모양 안쪽만, 45°): 바닥 그림 위에서도 장판이 읽히게. 그린 뒤 .stroke() */
function hatchHex(g: Graphics, x: number, y: number, r: number, gap: number): Graphics {
  const pts = hexPts(x, y, r), u = Math.SQRT1_2;
  for (let d = -r + gap / 2; d < r; d += gap) {
    const ox = x + u * d, oy = y - u * d; // 줄 = o + s·(u, u)
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 6];
      const ex = bx - ax, ey = by - ay, den = u * ey - u * ex;
      if (Math.abs(den) < 1e-9) continue;
      const k = ((ax - ox) * u - (ay - oy) * u) / den;
      if (k < 0 || k > 1) continue;
      const sv = ((ax - ox) * ey - (ay - oy) * ex) / den;
      lo = Math.min(lo, sv); hi = Math.max(hi, sv);
    }
    if (hi > lo) g.moveTo(ox + u * lo, oy + u * lo).lineTo(ox + u * hi, oy + u * hi);
  }
  return g;
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
// ---------- 「나」 칸 직업 문장 (27 3-4·5장): 원형 금테 + 돌 바탕 + 문장. 한 번 그려 텍스처로 ----------
const emblemTex = new Map<string, Texture | null>(); // null = 그림 읽는 중 (그동안은 ✚)
const meEmblem = new Sprite();
meEmblem.anchor.set(0.5);
emblemL.addChild(meEmblem);
function emblemTexture(hero: string): Texture | null {
  if (emblemTex.has(hero)) return emblemTex.get(hero)!;
  emblemTex.set(hero, null);
  const { src, painted } = emblemSrc(hero, emblemColor(hero));
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const N = 128, m = N / 2, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d')!;
    const disc = (r: number, fill: string | CanvasGradient) => { x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); };
    disc(m, '#080605'); // 바깥 외곽선
    disc(m - 5, '#C9A35C'); // 금테
    disc(m - 14, '#0D0B09'); // 금테 안쪽 어두운 줄
    const g = x.createRadialGradient(m, m * 0.72, 0, m, m, m - 17);
    g.addColorStop(0, '#3D3125'); g.addColorStop(1, '#1A1510');
    disc(m - 17, g); // 돌 바탕
    const k = (N - 34) * (painted ? 0.86 : 0.66);
    x.save(); x.beginPath(); x.arc(m, m, m - 17, 0, Math.PI * 2); x.clip();
    x.drawImage(img, m - k / 2, m - k / 2, k, k);
    x.restore();
    emblemTex.set(hero, Texture.from(c));
  };
  img.src = src;
  return null;
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
  BitmapFont.install({ name: NUM, style: { fontFamily: FONT, fontWeight: W_NUM, fontSize: 40, fill: 0xffffff, stroke: { color: C.line, width: 8, join: 'round' } }, chars: '0123456789+-!%', resolution: Math.min(2, window.devicePixelRatio || 1), padding: 4 });
  numFont = true;
}
const isNum = (t: string) => /^[+\-!%0-9]+$/.test(t);
interface LabelStyle { size: number; fill: number; stroke?: number; strokeW?: number; font?: string; weight?: TextStyleFontWeight; num?: boolean }
type Label = Text | BitmapText;
class Labels {
  private map = new Map<string, { t: Label; used: boolean; sig: string }>();
  constructor(private parent: Container) {}
  begin(): void { for (const v of this.map.values()) v.used = false; }
  put(key: string, text: string, st: LabelStyle, x: number, y: number, alpha = 1, anchorY = 0.5): Label {
    const bmp = !!st.num && numFont && isNum(text);
    const sig = bmp ? `b|${st.size.toFixed(1)}` : `${st.size.toFixed(1)}|${st.fill}|${st.stroke ?? ''}|${st.strokeW ?? 0}|${st.font ?? FONT}|${st.weight ?? W_TEXT}`;
    let e = this.map.get(key);
    if (!e || e.sig !== sig) {
      if (e) e.t.destroy();
      const t: Label = bmp
        ? new BitmapText({ text, style: { fontFamily: NUM, fontSize: st.size } })
        : new Text({
          text, resolution: dpr,
          style: { fontFamily: st.font ?? FONT, fontWeight: st.weight ?? W_TEXT, fontSize: st.size, fill: st.fill, ...(st.strokeW ? { stroke: { color: st.stroke ?? C.line, width: st.strokeW, join: 'round' as const } } : {}) },
        });
      t.anchor.set(0.5, anchorY);
      this.parent.addChild(t);
      e = { t, used: true, sig };
      this.map.set(key, e);
    }
    if (e.t.text !== text) e.t.text = text;
    if (bmp) e.t.tint = st.fill;
    e.t.scale.set(1);
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
function measure(text: string, size: number, font = FONT, weight = W_TEXT): number { mctx.font = `${weight} ${size}px ${font}`; return mctx.measureText(text).width; }

const COS30 = Math.sqrt(3) / 2;
interface DecorationBound {
  key: string; kind: string; shape: string; x: number; y: number; w: number; h: number;
  left: number; right: number; top: number; bottom: number;
  radius?: number; requestedRadius?: number; diameter?: number; requestedDiameter?: number;
}
const decorationBounds: DecorationBound[] = [];
const clamp = (value: number, min: number, max: number) => min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value));
function fitCenter(x: number, y: number, halfW: number, halfH = halfW): { x: number; y: number } {
  return { x: clamp(x, L.left + halfW, L.right - halfW), y: clamp(y, L.top + halfH, L.bottom - halfH) };
}
function recordBound(key: string, kind: string, shape: string, x: number, y: number, w: number, h: number, extra: Partial<DecorationBound> = {}): void {
  decorationBounds.push({ key, kind, shape, x, y, w, h, left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2, ...extra });
}
/** 원은 반경 그대로, pointy hex는 가로 cos30 배. 육각 miter의 위·아래 끝은 stroke/√3만큼 확장된다. */
function safeRadius(x: number, y: number, radius: number, shape: 'circle' | 'hex', width = 0): number {
  const dx = Math.min(x - L.left, L.right - x) - width / 2;
  const dy = Math.min(y - L.top, L.bottom - y) - width / (shape === 'hex' ? Math.sqrt(3) : 2);
  return Math.max(0, Math.min(radius, dx / (shape === 'hex' ? COS30 : 1), dy));
}
function ringRadius(key: string, shape: 'circle' | 'hex', x: number, y: number, requestedRadius: number, width: number, kind = 'ring', limit = Infinity): number {
  const radius = Math.max(0, Math.min(safeRadius(x, y, requestedRadius, shape, width), limit));
  const hx = radius * (shape === 'hex' ? COS30 : 1) + width / 2;
  const hy = radius + width / (shape === 'hex' ? Math.sqrt(3) : 2);
  recordBound(key, kind, shape, x, y, hx * 2, hy * 2, { radius, requestedRadius });
  return radius;
}
/** 실제 Pixi 글자 bounds(획·anchor·가로 압축 포함)를 기준으로 위치만 안쪽으로 옮긴다. */
function fitLabel(label: Label, key: string, kind: string): { x: number; y: number; w: number; h: number } {
  let b = label.getBounds();
  const available = L.right - L.left;
  if (b.maxX - b.minX > available) { label.scale.x *= available / (b.maxX - b.minX); b = label.getBounds(); }
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const p = fitCenter(mid.x, mid.y, w / 2, h / 2);
  label.position.set(label.x + p.x - mid.x, label.y + p.y - mid.y);
  recordBound(key, kind, 'text', p.x, p.y, w, h);
  return { ...p, w, h };
}
interface PillBox { x: number; y: number; w: number; h: number }
function pill(g: Graphics, lb: Labels, key: string, x: number, y: number, text: string, bg: number, fg: number, fs: number, alpha = 1, adjust?: (box: PillBox) => PillBox): PillBox {
  const kind = key.startsWith('deb') ? 'debuff' : key === 'swipe' ? 'swipe' : 'pill';
  const content = fitPartyName(text, Math.max(1, L.right - L.left - fs * 0.7 - 1.5), value => measure(value, fs));
  const label = lb.put(key, content, { size: fs, fill: fg }, x, y + 0.5, alpha);
  const w = Math.max(measure(content, fs), label.width) + fs * 0.7, h = Math.max(fs * 1.35, label.height + 2);
  let p = fitCenter(x, y, w / 2 + 0.75, h / 2 + 0.75);
  if (adjust) { const moved = adjust({ ...p, w: w + 1.5, h: h + 1.5 }); p = fitCenter(moved.x, moved.y, w / 2 + 0.75, h / 2 + 0.75); }
  g.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2).fill({ color: bg, alpha }).stroke({ width: 1.5, color: C.line, alpha });
  label.position.set(p.x, p.y + 0.5);
  fitLabel(label, `${key}-text`, kind);
  recordBound(key, kind, 'pill', p.x, p.y, w + 1.5, h + 1.5);
  return { ...p, w: w + 1.5, h: h + 1.5 };
}
/** 캡슐의 빈 모서리는 남겨 두고, HoT 원과 실제 외곽 사이에 1px만 확보한다. */
function hotCenter(x: number, y: number, radius: number, lower: number, nameTop: number, badge?: ReturnType<typeof pill>): { x: number; y: number } {
  const p = fitCenter(x, y, radius);
  if (badge) {
    const capRadius = badge.h / 2, segmentHalf = Math.max(0, (badge.w - badge.h) / 2);
    const dx = p.x - clamp(p.x, badge.x - segmentHalf, badge.x + segmentHalf);
    const separation = capRadius + radius + 1;
    if (Math.abs(dx) < separation) p.y = Math.max(p.y, badge.y + Math.sqrt(separation ** 2 - dx ** 2));
    // 36px 표시 경계에서는 아래 이동만 하면 이름에 닿는다. 이름 위를 유지하고 원을 조금 오른쪽으로 분리한다.
    const aboveName = nameTop - radius - 1;
    if (p.y > aboveName) {
      p.y = Math.min(p.y, aboveName);
      const dy = p.y - badge.y;
      if (Math.abs(dy) < separation) p.x = Math.max(p.x, badge.x + segmentHalf + Math.sqrt(separation ** 2 - dy ** 2));
      p.x = clamp(p.x, L.left + radius, L.right - radius);
    }
  }
  p.y = clamp(p.y, L.top + radius, L.bottom - lower);
  return p;
}
/** 오른쪽 끝에서 HoT를 더 옮길 수 없으면 배지만 필요한 만큼 위로 분리한다. */
function badgeBesideHot(box: PillBox, x: number, y: number, radius: number, nameTop: number): PillBox {
  const p = hotCenter(x, y, radius, radius, nameTop, box);
  const segmentHalf = Math.max(0, (box.w - box.h) / 2);
  const dx = p.x - clamp(p.x, box.x - segmentHalf, box.x + segmentHalf);
  const separation = box.h / 2 + radius + 1;
  if (Math.abs(dx) < separation) box.y = Math.min(box.y, p.y - Math.sqrt(separation ** 2 - dx ** 2));
  return box;
}
/** 최대 HP 감소 빗금도 실제 상단 band 다각형 안의 선분만 그린다. */
function hatchReducedHp(g: Graphics, x: number, y: number, r: number, height: number): void {
  const top = y - r, pts = clipY(hexPts(x, y, r), top, top + height);
  if (pts.length < 3) return;
  for (let k = -2 * r; k < 2 * r; k += 7) {
    const ax = x - r + k, ay = top, dx = height, dy = height;
    let lo = 0, hi = 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1];
      const base = ex * (ay - a[1]) - ey * (ax - a[0]), slope = ex * dy - ey * dx;
      if (Math.abs(slope) < 1e-9) { if (base < 0) { hi = -1; break; } }
      else if (slope > 0) lo = Math.max(lo, -base / slope);
      else hi = Math.min(hi, -base / slope);
    }
    if (hi > lo) g.moveTo(ax + lo * dx, ay + lo * dy).lineTo(ax + hi * dx, ay + hi * dy);
  }
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
function glow(x: number, y: number, size: number, tint: number, alpha: number, key = `glow${glowUsed}`): void {
  if (!glowTex) return;
  let sp = glows[glowUsed];
  // 더하기 섞기(add)는 Canvas 렌더러에서 뒤에 그리는 것까지 번져서 보통 섞기로
  if (!sp) { sp = new Sprite(glowTex); sp.anchor.set(0.5); glows.push(sp); glowL.addChild(sp); }
  glowUsed++;
  const diameter = safeRadius(x, y, size / 2, 'circle') * 2;
  sp.visible = true; sp.position.set(x, y); sp.width = sp.height = diameter; sp.tint = tint; sp.alpha = alpha;
  recordBound(key, 'glow', 'circle', x, y, diameter, diameter, { diameter, requestedDiameter: size });
}

// ---------- 판 위 효과 ----------
interface Fx { kind: 'heal' | 'hit' | 'dispel' | 'death' | 'revive'; id: number; t0: number; crit?: boolean; color?: number; seeds?: number[]; x?: number; y?: number }
interface Float { x: number; y: number; text: string; crit: boolean; over: boolean; t0: number; n: number; fill?: number; label?: boolean }
interface Bubble { id: number; text: string; t0: number }
const FX_MS = 400;
const B2 = {
  floats: [] as Float[], bubbles: [] as Bubble[], fx: [] as Fx[], disp: {} as Record<number, number>, hitFx: {} as Record<number, number>, shake: {} as Record<number, number>,
  lastFlash: {} as Record<number, number>, lens: null as { idx: number; t0: number } | null, lastRender: 0, n: 0,
};
export function resetBoardFx(): void {
  B2.floats = []; B2.bubbles = []; B2.fx = []; B2.disp = {}; B2.hitFx = {}; B2.shake = {}; B2.lastFlash = {}; B2.lens = null;
}
const rnd = () => Math.random();
export function fxHeal(u: Unit, eff: number, amt: number, crit: boolean, now: number): void {
  if (!L.ok || S.reducedEffects) return;
  const p = unitPos(u);
  const over = eff < amt * 0.25; // 거의 다 넘친 힐은 회색으로 작게
  if (B2.floats.length < 40) B2.floats.push({ x: p.x + (rnd() - 0.5) * L.s * 0.5, y: p.y - L.s * 0.3, text: `+${eff}`, crit: crit && !over, over, t0: now, n: B2.n++ });
  B2.hitFx[u.id] = now;
  if (B2.fx.length < 60 && !over) B2.fx.push({ kind: 'heal', id: u.id, t0: now, crit, seeds: Array.from({ length: crit ? 8 : 4 }, rnd) });
}
export function fxRevive(u: Unit, now: number, label = '부활'): void {
  if (!L.ok) return;
  if (S.reducedEffects) { addBubble(u.id, label, now); return; }
  const p = unitPos(u);
  B2.floats.push({ x: p.x, y: p.y - L.s * 0.3, text: label, crit: true, over: false, t0: now, n: B2.n++ });
  B2.hitFx[u.id] = now;
  B2.fx.push({ kind: 'revive', id: u.id, t0: now });
}
/** 뒤집힌 축복 (35 8장 「치유 반전」): 이 칸에 들어간 치유가 빨간 피해 숫자로 */
export function fxHurt(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1 || B2.floats.length >= 40) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x + (rnd() - 0.5) * L.s * 0.5, y: p.y - L.s * 0.3, text: `-${amt}`, crit: false, over: false, t0: now, n: B2.n++, fill: 0xff5a3d });
}
/** 실수 방지로 힐이 안 나감: 칸만 흔들림 */
export function fxShake(u: Unit, now: number): void {
  B2.shake[u.id] = now;
}
/** 파티원 능력 회복: 연두색 + 작은 십자 (내 힐과 구분, 17 7장) */
export function fxAllyHeal(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1 || B2.floats.length >= 40) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x + L.s * 0.25, y: p.y - L.s * 0.1, text: `✚${amt}`, crit: false, over: false, t0: now, n: B2.n++, fill: 0xc8f07a });
}
/** 파티원 능력 사용: 칸 위에 능력 이름 (17 7장) */
export function fxAbility(u: Unit, name: string, now: number): void {
  if (S.reducedEffects) { addBubble(u.id, name, now); return; }
  if (!L.ok || B2.floats.length >= 40) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x, y: p.y - L.s * 0.55, text: name, crit: false, over: false, t0: now, n: B2.n++, fill: C.gold, label: true });
}
export function fxDispel(u: Unit, now: number, trap = false, label?: string): void {
  if (S.reducedEffects) { addBubble(u.id, label ?? (trap ? '전염 폭발' : '해제'), now); return; }
  B2.fx.push({ kind: 'dispel', id: u.id, t0: now });
}
export function fxDeath(u: Unit, now: number): void {
  if (!L.ok) return;
  if (S.reducedEffects) { addBubble(u.id, '쓰러짐', now); return; }
  const p = unitPos(u); B2.fx.push({ kind: 'death', id: u.id, t0: now, color: hex(ROLE[u.role].color), x: p.x, y: p.y });
}
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
  if (sk.target === 'area') { const r = areaRadius(F, F.cast.key); return hexDist(F.cells[u.cell], F.cells[tgt.cell]) <= r ? sk.amt! * (r > 1 && F.cast.key === 'poh' ? 0.8 : 1) * F.gear.heal * F.power : 0; }
  return u === tgt ? sk.amt! * F.gear.heal * F.power * (u.hot > 0 ? 1.1 : 1) : 0;
}

// ---------- 한 프레임 ----------
export function render(now: number): void {
  const F = B.F;
  if (!ready || !app || !F || !L.ok) return;
  const t = now / 1000, s = L.s, r = s * 0.93;
  const pulse = S.reducedEffects ? 0.65 : 0.5 + 0.5 * Math.sin(t * 8);
  const zpulse = S.reducedEffects ? 0.65 : 0.5 + 0.5 * Math.sin(t * 4); // 장판은 천천히
  const typography = cellTypography(s), compact = typography.compact;
  const rdt = Math.min(0.1, Math.max(0, (now - (B2.lastRender || now)) / 1000)); B2.lastRender = now;
  for (const g of [cellsG, unitsG, fxG, overG, topG]) g.clear();
  labels.begin(); tops.begin(); glowUsed = 0; decorationBounds.length = 0;
  const fs = (k: number, min: number) => Math.max(min, s * k);

  // 영역 (장판 예고·활성 장판)
  const zoneSet = new Set<number>(), telSet = new Set<number>();
  for (const z of F.zones) z.cells.forEach(i => zoneSet.add(i));
  for (const tl of F.tels) if (tl.kind === 'zone') tl.cells.forEach(i => telSet.add(i));
  const safeSet = new Set<number>(); for (const tl of F.tels) tl.safe?.forEach(i => safeSet.add(i)); // 피난처 (35 3-E)
  F.cells.forEach((c, i) => {
    const p = center(i);
    hexPoly(cellsG, p.x, p.y, r).fill({ color: C.cell, alpha: 0.5 }).stroke({ width: 2, color: C.bronze, alpha: 0.75 }); // 빈칸은 비쳐서 장소 바닥이 보임, 진형 선은 청동 (28 5장)
    // 무너진 바닥 (P-HOLE): 검은 칸, 테두리만 남음
    if (c.block === 'hole') { hexPoly(cellsG, p.x, p.y, r * 0.94).fill({ color: 0x07070b, alpha: 0.9 }); return; }
    // 피난처 안전 칸: 금빛 바닥 + 안쪽 테 (맞는 칸은 아래 예고 빨강)
    if (safeSet.has(i)) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: 0.2 + 0.16 * pulse });
      hexPoly(cellsG, p.x, p.y, r * 0.86).stroke({ width: Math.max(2, s * 0.05), color: C.gold, alpha: 0.85 });
    }
    // 장판: 바닥 그림(28 5장)에 묻히지 않게 밝은 빨강 + 빗금 + 안쪽 테. 예고 = 깜빡이는 빨강 + 점선 테
    if (zoneSet.has(i)) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.zone, alpha: 0.5 + 0.12 * zpulse });
      hatchHex(cellsG, p.x, p.y, r * 0.96, Math.max(7, s * 0.2)).stroke({ width: Math.max(2, s * 0.05), color: C.zoneHi, alpha: 0.6 });
      hexPoly(cellsG, p.x, p.y, r * 0.9).stroke({ width: Math.max(2, s * 0.06), color: C.zoneHi, alpha: 0.95 });
    } else if (telSet.has(i)) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.tel, alpha: 0.14 + 0.24 * pulse });
      dashPoly(cellsG, hexPts(p.x, p.y, r * 0.9), 6, 4, Math.max(2, s * 0.05), C.zoneHi, 0.5 + 0.5 * pulse);
    }
    // 성기사 빛의 성역: 금빛 바닥, 끝나기 2초 전 깜빡임
    if (F.sanctuary && F.sanctuary.cells.has(i)) hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: F.sanctuary.end - F.t < 2 ? 0.08 + 0.14 * pulse : 0.2 });
    // 사제 쉼터 (특성): 금빛 바닥 + 안쪽 테두리, 끝나기 2초 전 깜빡임
    if (F.tx.shelter === i) {
      const left = F.tx.act.shelter?.left ?? 0;
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: left < 2 ? 0.1 + 0.16 * pulse : 0.26 });
      hexPoly(cellsG, p.x, p.y, r * 0.72).stroke({ width: 2.5, color: C.gold, alpha: 0.8 });
    }
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
    if (!S.reducedEffects && F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) x += Math.sin(t * 70) * s * 0.07;
    if (!S.reducedEffects && u.fleeing) x += Math.sin(t * 40) * s * 0.03;
    const shk = (now - (B2.shake[u.id] ?? -1e9)) / 400;
    if (!S.reducedEffects && shk >= 0 && shk < 1) x += Math.sin(shk * 40) * s * 0.08 * (1 - shk);
    // 가장자리 몸체는 진동만 안쪽으로 제한한다. 육각 크기/비율과 판 좌표는 바꾸지 않는다.
    const bodyStroke = Math.max(2.5, s * 0.07);
    ({ x, y } = fitCenter(x, y, r * COS30 + bodyStroke / 2, r + bodyStroke / Math.sqrt(3)));
    recordBound(`body${u.id}`, 'body', 'hex', x, y, r * COS30 * 2 + bodyStroke, r * 2 + bodyStroke * 2 / Math.sqrt(3));
    const shown = S.reducedEffects || B2.disp[u.id] == null ? u.hp : B2.disp[u.id] + (u.hp - B2.disp[u.id]) * Math.min(1, rdt * 14);
    B2.disp[u.id] = shown;
    const frac = Math.max(0, Math.min(1, shown / u.max));
    const top = y - r, bot = y + r;
    const low = frac < 0.3;
    hexPoly(unitsG, x, y, r).fill({ color: low ? C.dangerBg : C.empty }); // 물통 빈 부분: 30% 아래면 붉게
    // 쇠약 (35 3-A, 8장 「90% 선」): 이 높이까지 채우면 사라지는 디버프 = 채울 부분을 디버프 색으로 (선 높이는 배지에 가려 띠로 보여 줌)
    const line = u.debuffs.find(d => d.cureAt != null && d.cureAt < 1);
    if (line && frac < line.cureAt!) {
      const ly = bot - 2 * r * line.cureAt!, col = hex(DEB[line.type] || '#D9A13B');
      fillBand(unitsG, x, y, r, ly, bot - 2 * r * frac, col, 0.3);
      fillBand(unitsG, x, y, r, ly, ly + Math.max(2, s * 0.05), col, 0.95);
    }
    const pred = predictedHeal(u);
    if (pred > 0) { const pf = Math.min(1, (u.hp + pred) / u.max); fillBand(unitsG, x, y, r, bot - 2 * r * pf, bot, 0xa0ffaa, 0.35); }
    fillBand(unitsG, x, y, r, bot - 2 * r * frac, bot, hex(ROLE[u.role].color));
    if (u.max < u.base) { // 최대 체력 감소분 = 칸 위쪽 회색 (채울 수 없는 영역)
      const hh = 2 * r * (1 - u.max / u.base);
      fillBand(unitsG, x, y, r, top, top + hh, 0x4a4b57);
      hatchReducedHp(unitsG, x, y, r, hh);
      unitsG.stroke({ width: 2, color: C.white, alpha: 0.12 });
    }
    if (low) hexPoly(unitsG, x, y, r).fill({ color: C.danger, alpha: 0.08 + 0.2 * pulse });
    if (u.debuffs.some(d => d.invert)) hexPoly(unitsG, x, y, r).fill({ color: 0x7fa88c, alpha: 0.45 }); // 뒤집힌 축복: 회녹색 칸 (35 8장)
    // 장판 위에 선 사람: 칸 전체에 붉은 빛 + 빗금 (체력 위험 깜빡임과 구분)
    if (zoneSet.has(u.cell)) {
      hexPoly(unitsG, x, y, r).fill({ color: C.zone, alpha: 0.2 + 0.08 * zpulse });
      hatchHex(unitsG, x, y, r * 0.94, Math.max(7, s * 0.22)).stroke({ width: Math.max(1.5, s * 0.04), color: C.zoneHi, alpha: 0.4 });
    }
    if (!S.reducedEffects && u.flash > 0) hexPoly(unitsG, x, y, r).fill({ color: 0xff503c, alpha: Math.min(1, u.flash * 1.4) });
    const hk = (now - (B2.hitFx[u.id] ?? -1e9)) / 300;
    if (!S.reducedEffects && hk >= 0 && hk < 1) hexPoly(unitsG, x, y, r).fill({ color: 0xfff8d6, alpha: 0.4 * (1 - hk) });
    fillBand(unitsG, x, y, r, top, y, C.white, 0.06); // 윗면 광택
    // 큰 피격: 깜빡임이 새로 켜진 순간 = 날카로운 자국 (16 4-6)
    if (!S.reducedEffects && u.flash > (B2.lastFlash[u.id] ?? 0) + 0.05) B2.fx.push({ kind: 'hit', id: u.id, t0: now, seeds: [rnd()] });
    B2.lastFlash[u.id] = u.flash;
    // 테두리
    if (u.moving) dashPoly(unitsG, hexPts(x, y, r), 4, 4, Math.max(2.5, s * 0.07), 0xd8d3c0);
    else {
      // 바깥 = 검은 외곽선 (30% 아래면 위험 빨강), 안쪽 = 청동 테 (나는 금테)
      const bw = Math.max(2.5, s * 0.07);
      hexPoly(unitsG, x, y, r).stroke({ width: bw, color: low ? C.danger : C.line });
      hexPoly(unitsG, x, y, r - bw * 0.85).stroke({ width: Math.max(1.2, s * 0.035), color: low ? C.line : u.role === 'healer' ? C.frame : C.bronze });
    }
    over.push({ u, x, y, deb: undefined });
  }

  // 효과 (칸 채움 위, 글자·테두리 아래)
  B2.fx = S.reducedEffects ? [] : B2.fx.filter(e => now - e.t0 < FX_MS);
  for (const e of B2.fx) {
    const k = (now - e.t0) / FX_MS;
    const u = F.party.find(x => x.id === e.id);
    const p = e.x != null ? { x: e.x, y: e.y! } : u ? unitPos(u) : null;
    if (!p) continue;
    if (e.kind === 'heal') {
      glow(p.x, p.y, r * (1.6 + 0.6 * k), e.crit ? 0xfff1b8 : 0xfff8e6, 0.55 * (1 - k), `heal-glow${e.id}-${e.t0}`);
      e.seeds!.forEach((sd, i) => {
        const a = sd * Math.PI * 2, dist = r * (0.25 + 0.45 * k) * (0.6 + 0.4 * ((i * 0.37) % 1));
        const sr = r * (0.09 + 0.05 * ((i * 0.61) % 1)) * (1 - 0.3 * k);
        const sp = fitCenter(p.x + Math.cos(a) * dist * 0.9, p.y + Math.sin(a) * dist * 0.6 - r * 0.5 * k, sr);
        star(fxG, sp.x, sp.y, sr, i % 2 ? C.white : C.gold, 1 - k * k);
        recordBound(`heal-star${e.id}-${e.t0}-${i}`, 'fx', 'star', sp.x, sp.y, sr * 2, sr * 2);
      });
      if (e.crit) {
        const size = r * 0.3, half = size * 0.65 + 1;
        const bp = fitCenter(p.x + r * 0.5, p.y - r * (0.42 + 0.3 * k), half);
        bellShape(fxG, bp.x, bp.y, size, 1 - k); // 직업 아이콘을 안 가리게 오른쪽 위
        recordBound(`heal-bell${e.id}-${e.t0}`, 'fx', 'bell', bp.x, bp.y, half * 2, half * 2);
      }
    } else if (e.kind === 'hit') {
      const kk = Math.min(1, k * 1.6), a = 1 - kk;
      if (a > 0) {
        const ang = -0.6 + e.seeds![0] * 0.3, width = Math.max(2, s * 0.08) * (1 - 0.5 * kk);
        for (const off of [-0.18, 0.18]) {
          const cx = p.x + Math.sin(ang) * r * off, cy = p.y + Math.cos(ang) * r * off;
          const len = Math.max(0, Math.min(r * (0.5 + 0.5 * kk),
            (Math.min(cx - L.left, L.right - cx) - width / 2) / Math.abs(Math.cos(ang)),
            (Math.min(cy - L.top, L.bottom - cy) - width / 2) / Math.abs(Math.sin(ang))));
          fxG.moveTo(cx - Math.cos(ang) * len, cy + Math.sin(ang) * len).lineTo(cx + Math.cos(ang) * len, cy - Math.sin(ang) * len);
          recordBound(`hit${e.id}-${e.t0}-${off}`, 'fx', 'line', cx, cy, Math.abs(Math.cos(ang) * len) * 2 + width, Math.abs(Math.sin(ang) * len) * 2 + width);
        }
        fxG.stroke({ width, color: 0xff5a3d, alpha: a, cap: 'round' });
      }
    } else if (e.kind === 'dispel') {
      const width = Math.max(2, s * 0.08) * (1 - k);
      fxG.circle(p.x, p.y, ringRadius(`dispel${e.id}-${e.t0}`, 'circle', p.x, p.y, r * (0.5 + 0.7 * k), width, 'fx')).stroke({ width, color: C.teal, alpha: 1 - k });
    } else if (e.kind === 'revive') {
      glow(p.x, p.y, r * (1.4 + 1.2 * k), 0xfff1b8, 0.7 * (1 - k), `revive-glow${e.id}-${e.t0}`);
      fxG.circle(p.x, p.y, ringRadius(`revive${e.id}-${e.t0}`, 'circle', p.x, p.y, r * (0.6 + 0.8 * k), 3 * (1 - k), 'fx')).stroke({ width: 3 * (1 - k), color: C.gold, alpha: 1 - k });
    } else if (e.kind === 'death') {
      const radius = r * (1 - 0.4 * k), dp = fitCenter(p.x, p.y, radius * COS30, radius);
      hexPoly(fxG, dp.x, dp.y, radius).fill({ color: e.color!, alpha: 0.6 * (1 - k) });
      recordBound(`death${e.id}-${e.t0}`, 'fx', 'hex', dp.x, dp.y, radius * COS30 * 2, radius * 2, { radius });
    }
  }

  // 판에 나온 적 (35 3-I): 붉은 테 칸 + 이름 · 남은 체력. 딜러가 때리는 적(일점사)에 금빛 과녁, 폭탄은 남은 초
  const focus = focusOrder(F)[0];
  for (const m of F.mobs) if (m.alive && m.add?.cell != null) {
    const a = m.add, p = center(a.cell!);
    hexPoly(cellsG, p.x, p.y, r * 0.92).fill({ color: 0x3b1514, alpha: 0.92 }).stroke({ width: Math.max(2.5, s * 0.07), color: C.danger, alpha: 0.9 });
    fillBand(cellsG, p.x, p.y, r * 0.92, p.y + r * 0.92 - 2 * r * 0.92 * (m.hp / m.max), p.y + r * 0.92, C.danger, 0.28);
    if (m === focus) {
      const ro = r * 0.98, ri = r * 0.62;
      overG.circle(p.x, p.y, r * 0.8).moveTo(p.x - ro, p.y).lineTo(p.x - ri, p.y).moveTo(p.x + ri, p.y).lineTo(p.x + ro, p.y).moveTo(p.x, p.y - ro).lineTo(p.x, p.y - ri)
        .stroke({ width: Math.max(2.5, s * 0.06), color: C.gold, alpha: 0.6 + 0.4 * pulse });
    }
    // 이름 · 체력 %는 파티원 칸과 같은 자리 (이웃한 적 칸끼리 글자가 겹치지 않게 알약 대신 글자만)
    labels.put(`tot${m.id}`, a.short, { size: typography.nick, fill: 0xf3cfc6, strokeW: 2 }, p.x, p.y + r * (compact ? -0.29 : 0.13));
    labels.put(`totp${m.id}`, `${Math.ceil((m.hp / m.max) * 100)}%`, { size: typography.hp, fill: C.white, weight: W_NUM, strokeW: compact ? 1.5 : 2.5 }, p.x, p.y + r * (compact ? 0.25 : 0.6));
    const j = a.job;
    // 남은 초: 폭탄 = 터질 때까지, 걸어오는 쫄 = 보스에게 닿을 때까지, 큰 쫄 = 강타 예고
    const left = j?.p === 'bomb' && isFinite(a.jobAt!) ? a.jobAt! - F.t : j?.p === 'march' ? (a.steps! - 1) * j.every + a.jobAt! - F.t : j?.p === 'smash' && a.warned ? a.jobAt! - F.t : null;
    if (left != null) pill(overG, labels, `bomb${m.id}`, p.x, p.y - r * (compact ? 0.85 : 0.8), `${Math.max(0, Math.ceil(left))}`, j!.p === 'bomb' ? C.danger : 0xffb25b, j!.p === 'bomb' ? C.white : C.dark, fs(0.26, 11));
    // 자폭 쫄: 노린 사람까지 붉은 줄
    const prey = j?.p === 'fixate' ? F.party.find(u => u.id === a.on && u.alive) : undefined;
    if (prey) { const q = unitPos(prey); overG.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: Math.max(2, s * 0.05), color: C.danger, alpha: 0.45 + 0.4 * pulse }); }
  }

  // 테두리 표시 · 배지
  for (const o of over) {
    const { u, x, y } = o;
    const deb = primaryDebuff(u.debuffs);
    o.deb = deb;
    if (deb) {
      const w = Math.max(3, s * 0.13), col = hex(DEB[deb.type] || '#E5433D');
      const dr = ringRadius(`debuff-ring${u.id}`, 'hex', x, y, r * 0.88, w, 'debuff');
      if (deb.trap) dashPoly(overG, hexPts(x, y, dr), 6, 4, w, col); else hexPoly(overG, x, y, dr).stroke({ width: w, color: col });
    }
    if (zoneSet.has(u.cell) || telSet.has(u.cell)) { const w = Math.max(2.5, s * 0.09); hexPoly(overG, x, y, ringRadius(`zone${u.id}`, 'hex', x, y, r * 1.02, w)).stroke({ width: w, color: 0xff5a3d, alpha: zoneSet.has(u.cell) ? 1 : 0.4 + 0.6 * pulse }); }
    if (u.guardian > 0) dashCircle(overG, x, y, ringRadius(`guardian${u.id}`, 'circle', x, y, r * 1.1, 3), 2, 4, 3, C.ink, 0.9);
    // 버팀목 (특성): 금색 두꺼운 테두리, 끝나기 2초 전 깜빡임
    if (u.bulwark > 0) { const w = Math.max(3, s * 0.09); hexPoly(overG, x, y, ringRadius(`bulwark${u.id}`, 'hex', x, y, r * 1.1, w)).stroke({ width: w, color: C.gold, alpha: u.bulwark < 2 ? 0.35 + 0.6 * pulse : 0.95 }); }
    // 보호 두루마리: 흰 이중 테두리 (황토 질병·빨간 탱커 표시와 구분), 끝나기 2초 전 깜빡임
    if (u.shield > 0) {
      const a = u.shield < 2 ? 0.35 + 0.6 * pulse : 0.95;
      const outer = ringRadius(`shield-outer${u.id}`, 'hex', x, y, r * 1.2, 2);
      const inner = ringRadius(`shield-inner${u.id}`, 'hex', x, y, r * 1.12, 2, 'ring', outer - r * 0.08);
      hexPoly(overG, x, y, inner).stroke({ width: 2, color: 0xedeff7, alpha: a });
      hexPoly(overG, x, y, outer).stroke({ width: 2, color: 0xedeff7, alpha: a });
    }
    // 직업 스킬 표시 (25 3장): 피해 감소(나무껍질·성역) 초록 테두리, 희생 금색 점선, 보호의 손 흰 두꺼운 테두리, 봉화 금색 점선 원
    if (u.immune > 0) { const w = Math.max(3, s * 0.1); hexPoly(overG, x, y, ringRadius(`immune${u.id}`, 'hex', x, y, r * 1.14, w)).stroke({ width: w, color: 0xffffff, alpha: u.immune < 2 ? 0.35 + 0.6 * pulse : 0.95 }); }
    else if (u.redu > 0) hexPoly(overG, x, y, ringRadius(`reduction${u.id}`, 'hex', x, y, r * 1.1, 2.5)).stroke({ width: 2.5, color: HOT_COLOR.sprout, alpha: u.redu < 2 ? 0.35 + 0.6 * pulse : 0.9 });
    if (u.sacr > 0) dashPoly(overG, hexPts(x, y, ringRadius(`sacrifice${u.id}`, 'hex', x, y, r * 1.16, 2)), 5, 4, 2, C.gold);
    if (F.beacon === u.id) dashCircle(overG, x, y, ringRadius(`beacon${u.id}`, 'circle', x, y, r * 1.22, 2.5), 3, 5, 2.5, C.gold, 0.95);
    if (castTarget === u.id) hexPoly(overG, x, y, ringRadius(`cast${u.id}`, 'hex', x, y, r * 1.12, 3)).stroke({ width: 3, color: hex(SEL) });
    if (ui.selectedUnitId === u.id) {
      hexPoly(overG, x, y, ringRadius(`selected${u.id}`, 'hex', x, y, r * 1.04, 2.5)).stroke({ width: 2.5, color: C.white });
      const p = fitCenter(x, y + r + 1.5, 4, 2.5);
      overG.poly([p.x - 4, p.y + 2.5, p.x + 4, p.y + 2.5, p.x, p.y - 2.5], true).fill({ color: C.white });
      recordBound(`selected-marker${u.id}`, 'ring', 'triangle', p.x, p.y, 8, 5);
    }
  }
  let meShown = false;
  const hpBounds: { id: number; cell: number; text: string; x: number; y: number; w: number; h: number; sx: number }[] = [];
  const smallHots: { id: number; x: number; y: number }[] = [];
  for (const { u, x, y, deb } of over) {
    let debBadge: ReturnType<typeof pill> | undefined;
    // 칸 = 직업 아이콘 · 닉네임 · 체력 (2026-10-07 Lim: 성격 배지는 칸에서 빼고 길게 누르기 정보에만). 「나」 = 직업 문장 (27 3-4)
    const em = u.me ? emblemTexture(F.hero) : null;
    // 작은 칸은 위쪽 한 줄을 역할/디버프에, 중앙 두 줄을 이름과 HP에 배분한다.
    if (em && !(compact && deb)) {
      const d = Math.max(14, s * 0.5);
      if (meEmblem.texture !== em) meEmblem.texture = em;
      meEmblem.width = meEmblem.height = d;
      const ep = fitCenter(x, y - r * (compact ? 0.79 : 0.4), d / 2);
      meEmblem.position.set(ep.x, ep.y);
      recordBound(`role${u.id}`, 'role', 'circle', ep.x, ep.y, d, d);
      meShown = true;
    } else if (!(compact && deb)) {
      const k = s * 0.34, half = k * 0.6 + Math.max(1.5, k * 0.12) / 2;
      const ep = fitCenter(x, y - r * (compact ? 0.79 : 0.38), half);
      roleIcon(overG, u.role, ep.x, ep.y, k);
      recordBound(`role${u.id}`, 'role', 'icon', ep.x, ep.y, half * 2, half * 2);
    }
    const nameBox = nick(u, x, y + r * (compact ? -0.29 : 0.13), r);
    const health = healthDisplay(u.hp, u.max);
    const hasHot = u.hot > 0 || u.hots.length > 0;
    const hpText = `${health.critical ? '!' : ''}${compact ? `${health.percent}%` : Math.ceil(u.hp)}`;
    const hpY = y + r * (compact ? 0.25 : 0.6);
    const hpLabel = labels.put(`hp${u.id}`, hpText, {
      size: typography.hp, fill: C.white, weight: W_NUM, strokeW: compact ? 1.5 : 2.5, num: !compact,
    }, x, hpY);
    // Bitmap atlas의 획/패딩 때문에 100%가 옆 칸까지 번지지 않게 실제 렌더 폭을 제한한다.
    // 세로 글자 크기·문자 내용은 유지하고, 필요한 경우 가로만 압축한다.
    hpLabel.scale.set(1);
    if (hpLabel.width > r * 1.56) hpLabel.scale.x = r * 1.56 / hpLabel.width;
    const hpBox = fitLabel(hpLabel, `hp${u.id}`, 'hp');
    hpBounds.push({ id: u.id, cell: u.cell, text: hpText, ...hpBox, sx: hpLabel.scale.x });
    // 작은 셀의 HP 눈금은 일반 패널에서만 표시한다. 축소 패널도 숫자와 위험 !는 유지한다.
    if (compact) {
      const gw = r * 1.08, gh = 4, gx = x - gw / 2, gy = y + r * 0.68 - gh / 2;
      const trackBottom = gy + gh + 1.5;
      const hotBelowTrack = trackBottom + 4.25;
      // 아주 낮은 칸에서는 눈금과 +를 함께 쌓을 공간이 없다. 중복 눈금 대신 HP 숫자와 HoT를 보존한다.
      const showTrack = !S.compactSkills && (!hasHot || hotBelowTrack + 3.25 <= Math.min(L.bottom, y + r + 1));
      if (showTrack) {
        overG.roundRect(gx, gy, gw, gh, 1).fill({ color: C.line }).stroke({ width: 1, color: C.ink });
        const trackW = gw - 2;
        if (health.ratio > 0) overG.rect(gx + 1, gy + 1, Math.max(1, trackW * health.ratio), gh - 2).fill({ color: health.critical ? C.white : C.heal });
        overG.moveTo(gx + 1 + trackW * 0.3, gy - 1).lineTo(gx + 1 + trackW * 0.3, gy + gh + 1).stroke({ width: 1, color: C.ink });
        recordBound(`hp-track${u.id}`, 'hp', 'track', gx + gw / 2, gy + gh / 2, gw + 1, gh + 3);
      }
      if (hasHot) {
        // 지속 치유 +는 HP 눈금과 독립적으로 유지한다. 정확한 종류/잔여 초는 길게 누르기 정보에 보존한다.
        // 양쪽 패널 모두 중앙 하단에 둔다. 오른쪽 아래는 다음 행 디버프 배지가 덮을 수 있다.
        // HP의 실제 높이 아래에 간격을 두어 숫자/위험 !를 가리지 않는다.
        const hp = fitCenter(x, Math.max(showTrack ? hotBelowTrack : gy + gh / 2, hpBox.y + hpBox.h / 2 + 4.25), 3.25);
        smallHots.push({ id: u.id, x: hp.x, y: hp.y });
      }
    }
    if (deb) {
      const summary = debuffDisplay(deb, F.hero, compact);
      if (deb.jail) { const j = F.mobs.find(m => m.alive && m.add?.hold === deb.id); if (j) summary.text = `${j.add!.short} ${Math.ceil((j.hp / j.max) * 100)}%`; }
      const adjust = !compact && hasHot ? (box: PillBox) => badgeBesideHot(box, x + r * 0.56, y - r * 0.44, Math.max(7, s * 0.19) + 0.75, nameBox.y - nameBox.h / 2) : undefined;
      debBadge = pill(overG, labels, `deb${u.id}`, x, y - r * (compact ? 0.85 : 0.8), summary.text, deb.jail ? 0xd8c7a8 : deb.trap ? 0xf6e7b0 : hex(DEB[deb.type] || '#E5433D'), C.dark, typography.debuff, 1, adjust);
    }
    if (!compact && u.hot > 0) {
      const hr = Math.max(7, s * 0.19), hp = hotCenter(x + r * 0.56, y - r * 0.44, hr + 0.75, hr + 0.75, nameBox.y - nameBox.h / 2, debBadge);
      const hx = hp.x, hy = hp.y;
      overG.circle(hx, hy, hr).fill({ color: C.teal }).stroke({ width: 1.5, color: C.line });
      fitLabel(labels.put(`hot${u.id}`, String(Math.ceil(u.hot)), { size: hr * 1.05, fill: C.line }, hx, hy + 0.5), `hot-text${u.id}`, 'hot');
      recordBound(`hot${u.id}`, 'hot', 'circle', hx, hy, hr * 2 + 1.5, hr * 2 + 1.5);
    } else if (!compact && u.hots.length) {
      // 드루이드·성기사 지속 힐: 오른쪽 위 원 (색 = 가장 오래 남은 지속 힐, 숫자 = 남은 초).
      // 보조 지속 힐은 원의 위쪽 테두리 두 구간에 표시한다. 숫자와 원 밖의 이름을 가리지 않는다.
      const hs = u.hots.slice().sort((a, b) => b.left - a.left), h0 = hs[0];
      const hr = Math.max(7, s * 0.19), dots = hs.slice(1, 3);
      const { x: hx, y: hy } = hotCenter(x + r * 0.56, y - r * 0.44, hr + 0.75, hr + 0.75, nameBox.y - nameBox.h / 2, debBadge);
      overG.circle(hx, hy, hr).fill({ color: HOT_COLOR[h0.key] ?? C.teal }).stroke({ width: 1.5, color: C.line });
      fitLabel(labels.put(`hot${u.id}`, String(Math.ceil(h0.left)), { size: hr * 1.05, fill: C.line }, hx, hy + 0.5), `hot-text${u.id}`, 'hot');
      recordBound(`hot${u.id}`, 'hot', 'circle', hx, hy, hr * 2 + 1.5, hr * 2 + 1.5);
      dots.forEach((h, k) => {
        const a = (k ? -84 : -120) * Math.PI / 180, b = (k ? -60 : -96) * Math.PI / 180, width = 1.25;
        const ax = hx + Math.cos(a) * hr, ay = hy + Math.sin(a) * hr;
        const bx = hx + Math.cos(b) * hr, by = hy + Math.sin(b) * hr;
        overG.moveTo(ax, ay).arc(hx, hy, hr, a, b).stroke({ width, color: HOT_COLOR[h.key] ?? C.teal, cap: 'round' });
        recordBound(`hot-extra${u.id}-${k}`, 'hot', 'arc', (ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) + width, Math.abs(by - ay) + width);
      });
    }
    if (deb) {
      // 다른 종류 디버프도 함께 걸려 있으면 왼쪽 위에 색 점으로 (질병+독이면 둘 다 보이게)
      const others = [...new Set(u.debuffs.filter(d => d !== deb && d.type !== deb.type).map(d => d.type))];
      if (compact && others.length) {
        // 이름 옆에 붙이면 20인 작은 칸에서 글자를 덮는다. 배지 위에 작은 +로 추가 상태를 알린다.
        const mp = fitCenter(debBadge!.x + debBadge!.w / 2 - 4, debBadge!.y - debBadge!.h / 2 - 3, 4);
        const mx = mp.x, my = mp.y;
        overG.moveTo(mx - 2.5, my).lineTo(mx + 2.5, my).moveTo(mx, my - 2.5).lineTo(mx, my + 2.5).stroke({ width: 3, color: C.line });
        overG.moveTo(mx - 2.5, my).lineTo(mx + 2.5, my).moveTo(mx, my - 2.5).lineTo(mx, my + 2.5).stroke({ width: 1.5, color: C.white });
        recordBound(`debuff-extra${u.id}`, 'debuff', 'cross', mx, my, 8, 8);
      }
      else others.forEach((ty, k) => {
        const radius = Math.max(4, s * 0.12), dp = fitCenter(x - r * 0.56 + k * r * 0.3, y - r * 0.44, radius + 0.75);
        overG.circle(dp.x, dp.y, radius).fill({ color: hex(DEB[ty] || '#E5433D') }).stroke({ width: 1.5, color: C.line });
        recordBound(`debuff-extra${u.id}-${k}`, 'debuff', 'circle', dp.x, dp.y, radius * 2 + 1.5, radius * 2 + 1.5);
      });
    }
    // 보스가 때리는 사람: 테두리 대신 칸 위 조준 표식 (테두리는 디버프 몫). 디버프 이름표가 있으면 그 왼쪽
    if (tank === u) {
      const br = Math.max(7, s * 0.2);
      const bw = Math.max(1.5, br * 0.22);
      let bx = x, by = y - r * 0.98;
      if (debBadge) {
        bx = debBadge.x - debBadge.w / 2 - br - bw / 2 - 1;
        if (bx - br - bw / 2 < L.left) bx = debBadge.x + debBadge.w / 2 + br + bw / 2 + 1;
        by = debBadge.y;
      }
      ({ x: bx, y: by } = fitCenter(bx, by, br + bw / 2));
      overG.circle(bx, by, br).fill({ color: C.cell }).stroke({ width: bw, color: C.danger });
      overG.circle(bx, by, br * 0.4).moveTo(bx, by - br * 0.8).lineTo(bx, by - br * 0.22).moveTo(bx, by + br * 0.22).lineTo(bx, by + br * 0.8)
        .moveTo(bx - br * 0.8, by).lineTo(bx - br * 0.22, by).moveTo(bx + br * 0.22, by).lineTo(bx + br * 0.8, by)
        .stroke({ width: Math.max(1.2, br * 0.18), color: C.tankMark, cap: 'round' });
      recordBound(`aggro${u.id}`, 'aggro', 'circle', bx, by, br * 2 + bw, br * 2 + bw);
    }
    if (F.rats && F.rats.includes(u.id)) pill(overG, labels, `rat${u.id}`, x - r * 0.05, y + r * 0.95, '쥐떼', 0xb9a38a, C.dark, fs(0.18, 9));
    // 판 위 적이 때리는 사람 (부탱커·딜러) · 자폭 쫄이 노리는 사람: 그 적 이름 (35 3-I)
    const add = F.mobs.find(m => m.alive && m.add && m.add.on === u.id && (m.add.dmg > 0 || m.add.job?.p === 'smash' || m.add.job?.p === 'fixate'));
    if (add) pill(overG, labels, `add${u.id}`, x - r * 0.05, y + r * 0.95, add.add!.short, add.add!.job?.p === 'fixate' ? C.danger : 0xe8b4a8, add.add!.job?.p === 'fixate' ? C.white : C.dark, fs(0.18, 9));
    // 감옥 (P-JAIL): 갇힌 사람 칸에 창살 (감옥 체력은 디버프 배지). 딜러가 깨는 중이면 금빛 과녁
    const jail = F.mobs.find(m => m.alive && m.add?.hold != null && m.add.on === u.id);
    if (jail) {
      const w = Math.max(2.5, s * 0.07);
      hexPoly(overG, x, y, r * 0.96).fill({ color: 0x4a3f33, alpha: 0.45 });
      for (let k = -2; k <= 2; k++) { const h = k === -2 || k === 2 ? 0.5 : 0.84; overG.moveTo(x + k * r * 0.3, y - r * h).lineTo(x + k * r * 0.3, y + r * h); }
      overG.stroke({ width: w, color: 0xd8c7a8, alpha: 0.75 });
      hexPoly(overG, x, y, r * 0.96).stroke({ width: w * 1.3, color: 0xd8c7a8, alpha: 0.95 });
      if (jail === focusOrder(F)[0]) overG.circle(x, y, r * 0.8).stroke({ width: Math.max(2.5, s * 0.06), color: C.gold, alpha: 0.6 + 0.4 * pulse });
    }
    const bt = F.tels.find(tl => tl.kind === 'buster' && tl.units.includes(u.id));
    if (bt && bt.skill.dmg) {
      const sh = u.shield > bt.impact - F.t ? 0.6 : 1; // 맞을 때까지 보호 두루마리가 남아 있으면 -40%
      const dmg = Math.round(bt.skill.dmg * F.dmgMult * sh), lethal = dmg >= u.hp + (u.guardian > 0 ? 1e9 : 0);
      pill(overG, labels, `bus${u.id}`, x, y + r * 0.2, `-${dmg}`, lethal ? C.danger : 0xffb25b, C.dark, fs(0.3, 11));
    }
    if (busterIds.has(u.id)) {
      const mark = safeRadius(x, y, r, 'circle', 3);
      overG.circle(x, y, mark * 0.75).moveTo(x - mark, y).lineTo(x - mark * 0.4, y).moveTo(x + mark * 0.4, y).lineTo(x + mark, y).moveTo(x, y - mark).lineTo(x, y - mark * 0.4)
        .stroke({ width: 3, color: C.tel, alpha: 0.6 + 0.4 * pulse });
      recordBound(`buster${u.id}`, 'ring', 'target', x, y, mark * 2 + 3, mark * 2 + 3);
    }
    // 차례 (P-ORDER): 은쟁반 번호표, 받은 번호는 꺼지고 다음 번호는 금빛. 직업 그림 왼쪽 (이름을 안 가리게)
    const ok = F.order ? F.order.ids.indexOf(u.id) : -1;
    if (F.order && ok >= F.order.i) pill(overG, labels, `ord${u.id}`, x - r * 0.55, y - r * 0.42, ORDER_NUM[ok], ok === F.order.i ? C.gold : 0xd9dde6, C.dark, fs(0.3, 12), ok === F.order.i ? 0.75 + 0.25 * pulse : 1);
    else if (u.debuffs.some(d => d.invert)) pill(overG, labels, `inv${u.id}`, x - r * 0.55, y - r * 0.42, '✕', 0x7fa88c, C.dark, fs(0.28, 11));
    if (F.t < u.wrongUntil && F.t > u.wrongUntil - 0.6) pill(overG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '?', C.gold, C.dark, fs(0.28, 11));
    else if (F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) pill(overG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '!', 0xff5a3d, C.dark, fs(0.28, 11));
    const st = u.bulwark > 0 ? ([`버팀 ${Math.ceil(u.bulwark)}`, '#F0C46A'] as const) : u.pulled ? ([`끌림 ${Math.ceil(u.pulled.until - F.t)}`, '#C98B5A'] as const) : u.fleeing ? (['도망', '#DB9B57'] as const) : u.sulking ? (['삐짐', '#D68FA6'] as const) : null;
    if (st && s >= 40) pill(overG, labels, `st${u.id}`, x, y + r * 0.95, st[0], hex(st[1]), C.dark, fs(0.18, 9));
    else if (st) hexPoly(overG, x, y, ringRadius(`status${u.id}`, 'hex', x, y, r * 0.95, 3)).stroke({ width: 3, color: hex(st[1]), alpha: 0.5 + 0.5 * pulse });
  }
  // 두 번째 배치: 모든 디버프 캡슐을 확인한 뒤 +를 둔다. 극소 칸의 양대각 배지 사이에서도 가로획을 보존한다.
  const badges = decorationBounds.filter(b => b.kind === 'debuff' && b.shape === 'pill');
  for (const hot of smallHots) {
    let hy = hot.y;
    for (const badge of badges) {
      const capRadius = badge.h / 2, segmentHalf = Math.max(0, (badge.w - badge.h) / 2);
      const dx = Math.max(0, Math.abs(hot.x - badge.x) - segmentHalf - 3.25);
      const separation = capRadius + 0.75;
      if (dx >= separation || hy + 3.25 < badge.y - capRadius) continue;
      const below = badge.y + Math.sqrt(separation ** 2 - dx ** 2) + 3.25;
      if (hy - 3.25 < badge.y + capRadius) hy = Math.max(hy, below);
    }
    hy = clamp(hy, L.top + 3.25, L.bottom - 3.25);
    overG.rect(hot.x - 3, hy - 3, 6, 6).fill({ color: C.line });
    overG.moveTo(hot.x - 2.5, hy).lineTo(hot.x + 2.5, hy).moveTo(hot.x, hy - 2.5).lineTo(hot.x, hy + 2.5).stroke({ width: 1.5, color: C.teal });
    recordBound(`hot${hot.id}`, 'hot', 'cross', hot.x, hy, 6.5, 6.5);
  }
  // 표시된 글자 bounds만 노출한다. 값이 바뀔 때만 기록하며 전투/입력 상태에는 관여하지 않는다.
  let neighborGap = Infinity;
  for (let i = 0; i < hpBounds.length; i++) for (let j = i + 1; j < hpBounds.length; j++) {
    const a = hpBounds[i], b = hpBounds[j];
    if (hexDist(F.cells[a.cell], F.cells[b.cell]) !== 1 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2) continue;
    neighborGap = Math.min(neighborGap, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
  }
  const hpMetrics = {
    hpTextWidthLimit: (r * 1.56).toFixed(2),
    hpTextMaxWidth: Math.max(0, ...hpBounds.map(b => b.w)).toFixed(2),
    hpTextMinHeight: hpBounds.length ? Math.min(...hpBounds.map(b => b.h)).toFixed(2) : '',
    hpTextMinScaleX: hpBounds.length ? Math.min(...hpBounds.map(b => b.sx)).toFixed(3) : '',
    hpTextMinNeighborGap: Number.isFinite(neighborGap) ? neighborGap.toFixed(2) : '',
    hpTextBounds: JSON.stringify(hpBounds.map(b => ({ ...b, x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.w.toFixed(2), h: +b.h.toFixed(2), sx: +b.sx.toFixed(3) }))),
  };
  for (const [key, value] of Object.entries(hpMetrics)) if (cv.dataset[key] !== value) cv.dataset[key] = value;
  meEmblem.visible = meShown;
  // 장전 하이라이트
  if (armedKey) {
    if (areaArmed && areaCenter >= 0) {
      const c0 = F.cells[areaCenter];
      const ar = areaRadius(F, armedKey);
      F.cells.forEach((c, i) => { if (hexDist(c, c0) <= ar) { const p = center(i); hexPoly(overG, p.x, p.y, ringRadius(`armed-area${i}`, 'hex', p.x, p.y, r * 1.04, 3)).fill({ color: C.white, alpha: 0.14 }).stroke({ width: 3, color: hex(SEL) }); } });
    } else for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPoly(overG, p.x, p.y, ringRadius(`armed${u.id}`, 'hex', p.x, p.y, r * 1.04, 2)).stroke({ width: 2, color: C.white, alpha: 0.3 + 0.4 * pulse }); }
  }
  // 쉼터 장전: 빈 칸을 금빛 테두리로
  if (ui.talArmed) F.cells.forEach((c, i) => { if (!c.unit) { const p = center(i); hexPoly(overG, p.x, p.y, ringRadius(`talent-armed${i}`, 'hex', p.x, p.y, r * 0.96, 2.5)).stroke({ width: 2.5, color: C.gold, alpha: 0.35 + 0.5 * pulse }); } });
  if (!armedKey && ui.itemArmed) for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPoly(overG, p.x, p.y, ringRadius(`item-armed${u.id}`, 'hex', p.x, p.y, r * 1.04, 2.5)).stroke({ width: 2.5, color: C.gold, alpha: 0.35 + 0.5 * pulse }); }
  // 튜토리얼 안내가 짚는 칸
  if (ui.coach && ui.coach.uid != null) {
    const cu = F.party.find(u => u.id === ui.coach!.uid);
    if (cu && cu.alive) { const p = unitPos(cu); hexPoly(overG, p.x, p.y, ringRadius(`coach${cu.id}`, 'hex', p.x, p.y, r * (1.18 + 0.06 * pulse), 4)).stroke({ width: 4, color: C.gold, alpha: 0.55 + 0.45 * pulse }); }
  }

  // 떠오르는 숫자
  B2.floats = B2.floats.filter(fl => now - fl.t0 < 900 && (!S.reducedEffects || fl.label));
  for (const fl of B2.floats) {
    const k = (now - fl.t0) / 900;
    const size = fl.label ? fs(0.22, 10) : fl.crit ? fs(0.36, 14) : fl.over || fl.fill ? fs(0.22, 10) : fs(0.27, 11);
    fitLabel(tops.put(`fl${fl.n}`, fl.text, { size, fill: fl.fill ?? (fl.crit ? C.crit : fl.over ? C.over : C.heal), strokeW: 3, num: !fl.fill }, fl.x, S.reducedEffects ? fl.y : fl.y - k * s * (fl.label ? 0.3 : 0.6), S.reducedEffects ? 1 : 1 - k * k, 1), `float${fl.n}`, 'float');
  }
  // 쓸기 방향 미리보기
  if (ui.pointer && ui.pointer.dir && ui.pointer.idx >= 0) {
    const P = ui.pointer, it = dirSlot(P.dir!), c = center(P.idx);
    const ang = (DIR_DEG[P.dir!] * Math.PI) / 180;
    const dx = Math.cos(ang), dy = -Math.sin(ang);
    const edgeX = Math.abs(dx) < 1e-9 ? Infinity : (dx > 0 ? L.right - 5 - c.x : c.x - L.left - 5) / Math.abs(dx);
    const edgeY = Math.abs(dy) < 1e-9 ? Infinity : (dy > 0 ? L.bottom - 5 - c.y : c.y - L.top - 5) / Math.abs(dy);
    const distance = Math.max(0, Math.min(s * 1.1, edgeX, edgeY));
    const ex = c.x + dx * distance, ey = c.y + dy * distance;
    topG.moveTo(c.x, c.y).lineTo(ex, ey).stroke({ width: 4, color: hex(SEL), cap: 'round' });
    topG.circle(ex, ey, 5).fill({ color: hex(SEL) });
    recordBound('swipe-line', 'swipe', 'line', (c.x + ex) / 2, (c.y + ey) / 2, Math.abs(ex - c.x) + 4, Math.abs(ey - c.y) + 4);
    recordBound('swipe-dot', 'swipe', 'circle', ex, ey, 10, 10);
    const label = it && it.key ? SKILLS[slotKey(F, it.key)].name : '비어 있음';
    pill(topG, tops, 'swipe', ex, ey - s * 0.45, label, it && it.key ? C.ink : 0x5a5b70, C.dark, fs(0.28, 12));
  }
  // 말풍선 (동시에 최대 3개, 04 10장)
  B2.bubbles = B2.bubbles.filter(b => now - b.t0 < 1700);
  for (const b of B2.bubbles) {
    const u = F.party.find(x => x.id === b.id); if (!u) continue;
    const p = unitPos(u);
    const text = fitPartyName(b.text, Math.max(1, L.right - L.left - 16), value => measure(value, 12, FONT, '500'));
    const w = measure(text, 12, FONT, '500') + 14, h = 22;
    let by = p.y - r - h - 6;
    if (by < L.top + 1) by = p.y + r + 6;
    const bp = fitCenter(p.x, by + h / 2, w / 2 + 1, h / 2 + 1), bx = bp.x - w / 2;
    by = bp.y - h / 2;
    const a = S.reducedEffects ? 1 : Math.min(1, (1700 - (now - b.t0)) / 300);
    topG.roundRect(bx, by, w, h, 8).fill({ color: C.ink, alpha: a }).stroke({ width: 2, color: C.line, alpha: a });
    fitLabel(tops.put(`bb${b.id}`, text, { size: 12, fill: C.dark, weight: '500' }, bx + w / 2, by + h / 2 + 0.5, a), `bubble-text${b.id}`, 'bubble');
    recordBound(`bubble${b.id}`, 'bubble', 'rect', bp.x, bp.y, w + 2, h + 2);
  }

  for (let i = glowUsed; i < glows.length; i++) glows[i].visible = false;
  labels.end(); tops.end();
  lensL.visible = false;
  app.renderer.render(app.stage);
  // 20인 탭 확대 미리보기 0.3초 (02 3-1): 손가락에 가리지 않게 칸 위쪽에 1.8배로
  if (B2.lens && now - B2.lens.t0 < 300) drawLens(now); else B2.lens = null;
  // Canvas-local CSS px. 실제 표시 위치/크기만 기록하며 전투·입력 상태를 수정하지 않는다.
  const metrics = JSON.stringify(decorationBounds.map(b => Object.fromEntries(Object.entries(b).map(([key, value]) => [key, typeof value === 'number' ? +value.toFixed(3) : value]))));
  if (cv.dataset.decorationBounds !== metrics) cv.dataset.decorationBounds = metrics;
}

function nick(u: Unit, x: number, y: number, r: number): { x: number; y: number; w: number; h: number } {
  // 글자 크기를 11px 아래로 축소하지 않는다. 전체 이름은 길게 누르기 정보에도 남는다.
  const maxW = r * 1.45;
  const size = cellTypography(L.s).nick;
  const text = fitPartyName(u.nick, maxW, text => measure(text, size));
  return fitLabel(labels.put(`nk${u.id}`, text, { size, fill: C.ink, strokeW: 2 }, x, y), `nick${u.id}`, 'nick');
}

let lensRT: RenderTexture | null = null;
const lensSprite = new Sprite();
const lensMask = new Graphics();
const lensRing = new Graphics();
lensL.addChild(lensSprite, lensMask, lensRing);
lensSprite.mask = lensMask;
function drawLens(now: number): void {
  if (!app || !B2.lens) return;
  const s = L.s, p = center(B2.lens.idx), src = s * 1.15, k = 1.8;
  const R2 = Math.max(0, Math.min(src * k, (L.right - L.left) / 2 - 1.5, (L.bottom - L.top) / 2 - 1.5));
  const lp = fitCenter(p.x, p.y - s * 1.2 - R2, R2 + 1.5), cx = lp.x, cy = lp.y;
  const size = Math.ceil(src * 2);
  if (!lensRT || lensRT.width !== size) { lensRT?.destroy(true); lensRT = RenderTexture.create({ width: size, height: size, resolution: dpr }); lensSprite.texture = lensRT; }
  app.renderer.render({ container: root, target: lensRT, clear: true, transform: new Matrix().translate(-(p.x - src), -(p.y - src)) });
  lensSprite.position.set(cx - R2, cy - R2); lensSprite.width = lensSprite.height = R2 * 2;
  lensMask.clear().circle(cx, cy, R2).fill({ color: C.dark });
  lensRing.clear().circle(cx, cy, R2).stroke({ width: 3, color: hex(SEL) });
  recordBound('lens', 'lens', 'circle', cx, cy, R2 * 2 + 3, R2 * 2 + 3, { radius: R2, requestedRadius: src * k });
  lensL.alpha = S.reducedEffects ? 1 : Math.min(1, (300 - (now - B2.lens.t0)) / 80);
  lensL.visible = true;
  app.renderer.render(app.stage);
}

/** 길게 누르기 정보창에 쓰는 직업 이름 (판 그림과 같은 출처) */
export const className = (u: Unit) => (u.cls ? CLASSES[u.cls].name : '');
void sizeKey;
