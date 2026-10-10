/**
 * 전투 판 그리기 (PixiJS, WebGL → 안 되면 Canvas). 20 4-1: 전투 화면은 캔버스에만 그리고 매 프레임 HTML은 안 고침.
 * 칸 = 체력 물통 · 역할 아이콘 · 닉네임 · 체력 숫자 · 디버프 테두리 (16 9장 2번: 파티원 그림 없음). 「나」 칸은 역할 아이콘 대신 직업 문장 (27 3-4).
 * 이펙트 (16 4-6): 힐 = 부드러운 빛 + 별 반짝이(사제 금·흰), 치명타 = 반짝이 2배 + 큰 별, 큰 피격 = 날카로운 빨간 자국.
 * 칸 위 이펙트는 0.4초 안에 사라지고 체력 숫자·디버프 테두리 아래에 그림.
 * 그림 (37 v0.2): 판 위 적·영혼 칸 그림(mob-), 칸 무늬(fx-cell-), 사슬 띠(fx-link-), 이펙트(fx-)가 src/art에 있으면 그 그림을, 없으면 지금 벡터 그림을 씀.
 */
import { Application, BitmapFont, BitmapText, Container, Graphics, Matrix, NineSliceSprite, Rectangle, RenderTexture, Sprite, Text, Texture, TilingSprite, type TextStyleFontWeight } from 'pixi.js';
import { art } from '../art';
import { armorFactor } from '../data/armor';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import { NAMED, SPECS, type SpecGroup } from '../data/specials';
import { aggroTarget, areaRadius, focusOrder, hexDist, ORDER_NUM, slotKey, type Telegraph, type TelKind, type Unit } from '../engine';
import { emblemColor } from '../screens/art';
import { FACTIONS, type FactionKey } from '../data/places';
import { addArtName, emblemSrc, holeArtName, ringArtName, soulArtName, zoneArtName } from './art';
import { $, B, DEB, dirSlot, DIR_DEG, ROLE, S, SEL, ui } from './core';
import { cellTypography, debuffDisplay, fitPartyName, healthDisplay, primaryDebuff } from './party-display';
import { CELL_RADIUS, fitBoard } from './board-layout';

// ---------- 색 ----------
const hex = (c: string) => parseInt(c.slice(1, 7), 16);
// 테마 「길드 홀」 (2026-10-08): 돌색 빈칸, 청동 안쪽 테두리, 물통 빈 부분 = 돌 3. 디버프·위험 색은 그대로
/** 요정 고리 · 넘어가는 포자 색 (48 5장, 버섯 요정단 연분홍) */
const RING = 0xf29cb7, RING_HI = 0xd9577f;
/** 녹는 보호막 (P-MELT, 51 5장): 열기 동안 판이 주황빛으로 일렁이고 보호막 · 외부 생존기 테두리가 주황 */
const MELT = 0xff8a3d;
/** 모래시계 되돌림 선 (모래 왕국 금모래, 54 0장) */
const SAND = 0xe9c46a;
/** 묶음 F (56 5장): 띄워 올리기 하늘색 · 연쇄 번개 노랑 */
const SKY = 0x9fd8f5, BOLT = 0xffe066;
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
const frameL = new Container();
const overG = new Graphics();
const labelsL = new Container();
/** 디버프 배지 바탕·글자: 이름·체력 글자보다 위 (2026-10-10 Lim: 이름이 배지 위로 보여 배지가 안 읽힘) */
const badgeG = new Graphics();
const badgeL = new Container();
const topG = new Graphics();
const topL = new Container();
const lensL = new Container();
const emblemL = new Container();
/** 칸 무늬 · 판 위 적 그림 (칸 채움 위, 파티원 칸 아래) · 그림 이펙트 (파티원 칸 위, 테두리·글자 아래) */
const decalL = new Container();
const fxArtL = new Container();
/** 말풍선 그림 (43 5장): 틀 뒤 이펙트 띠 · 틀 9조각 · 꼬리·감정 아이콘·앞 이펙트 띠. 대사 글자(topL)는 그 위 */
const bubbleL = new Container(), bubbleBackL = new Container(), sliceL = new Container(), bubbleFrontL = new Container();
bubbleL.addChild(bubbleBackL, sliceL, bubbleFrontL);
root.addChild(cellsG, decalL, unitsG, glowL, fxG, fxArtL, frameL, overG, emblemL, labelsL, badgeG, badgeL, topG, bubbleL, topL, lensL);

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
  const frameReady = loadHexFrame();
  await a.init({
    canvas: cv, width: Math.max(1, cv.clientWidth), height: Math.max(1, cv.clientHeight), resolution: Math.min(3, window.devicePixelRatio || 1),
    autoDensity: false, antialias: true, backgroundAlpha: 0, preference, autoStart: false, sharedTicker: false,
    eventFeatures: { click: false, move: false, globalMove: false, wheel: false },
  });
  a.stage.addChild(root);
  app = a;
  ready = true;
  glowTex = makeGlow();
  // 말풍선 틀 · 꼬리 · 대사 이펙트 띠는 미리 읽어 둠 (첫 말풍선이 앱 그림으로 잠깐 보였다 바뀌지 않게, 43 5장)
  for (const k of ['talk', 'call', 'alert', 'chat']) { artTexture(`ui-bubble-${k}`); artTexture(`ui-bubble-tail-${k}`); }
  for (const n of Object.keys(TALK_FX)) artTexture(`fx-talk-${n}`);
  if (B.F) resizeBoard();
  await document.fonts?.ready;
  await frameReady;
  installNumFont();
}
export const boardRenderer = () => (app ? app.renderer.name : '');

// 같은 투명 래스터를 Pixi의 WebGL/Canvas 양쪽에서 사용한다. 읽기 실패 시 기존 선 테두리를 유지한다.
let hexFrameTexture: Texture | null = null;
const hexFrames: Sprite[] = [];
let hexFramesUsed = 0;
async function loadHexFrame(): Promise<void> {
  const url = art('ui-sunforged-hex-frame');
  cv.dataset.hexFrameReady = 'false';
  if (!url) return;
  const img = new Image();
  img.decoding = 'async'; img.src = url;
  try {
    await img.decode();
    hexFrameTexture = Texture.from(img);
    cv.dataset.hexFrameReady = 'true';
  } catch { /* 원화 로드 실패가 전투판 초기화를 막지 않게 한다. */ }
}
function hexFrame(id: number, x: number, y: number, r: number, strokeWidth: number): void {
  if (!hexFrameTexture) return;
  let sprite = hexFrames[hexFramesUsed];
  if (!sprite) {
    sprite = new Sprite(hexFrameTexture); sprite.anchor.set(0.5); sprite.eventMode = 'none';
    hexFrames.push(sprite); frameL.addChild(sprite);
  }
  hexFramesUsed++;
  // 기존 위험 빨간 외곽선 안쪽에만 올린다. 바깥 크기·히트 영역·두 축 비율은 바꾸지 않는다.
  const radius = Math.max(0, r - strokeWidth * 0.65);
  const scale = Math.min(radius * Math.sqrt(3) / hexFrameTexture.width, radius * 2 / hexFrameTexture.height);
  sprite.scale.set(scale); sprite.position.set(x, y); sprite.visible = true;
  recordBound(`frame${id}`, 'frame', 'hex', x, y, sprite.width, sprite.height);
}

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

// ---------- 그림 (37 v0.2): 파일이 있으면 텍스처로 한 번 읽어 둠. 없거나 읽는 중이면 null → 벡터 그림 ----------
const artTex = new Map<string, Texture | null>();
function artTexture(name: string): Texture | null {
  if (!name) return null;
  if (artTex.has(name)) return artTex.get(name)!;
  artTex.set(name, null);
  const src = art(name);
  if (!src) return null;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    // 말풍선 틀 · 꼬리는 불투명 영역 (틀 여백 · 꼬리 자르기), 흔들림 띠는 가운데 빈 곳 (말풍선 자리)을 한 번 재 둠
    try {
      if (name.startsWith('ui-bubble-')) artBoxes.set(name, opaqueBox(g, c.width, c.height));
      else if (name === 'fx-talk-shake') artBoxes.set(name, holeBox(g, c.height * TALK_FX.shake.fw, c.height));
    } catch { /* 픽셀을 못 읽으면 그림 전체 크기로 */ }
    artTex.set(name, Texture.from(c));
  };
  img.src = src;
  return null;
}
interface ArtBox { x: number; y: number; w: number; h: number }
const artBoxes = new Map<string, ArtBox>();
const solid = (d: Uint8ClampedArray, i: number) => d[i * 4 + 3] > 24;
/** 그림에서 불투명한 부분 (알파 > 24) */
function opaqueBox(g: CanvasRenderingContext2D, w: number, h: number): ArtBox {
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(d, y * w + x)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** 첫 프레임 가운데에서 가로·세로로 처음 그림이 나오는 곳까지 (안 나오면 프레임의 60% · 50%) */
function holeBox(g: CanvasRenderingContext2D, fw: number, h: number): ArtBox {
  const d = g.getImageData(0, 0, fw, h).data, cx = fw >> 1, cy = h >> 1;
  let l = cx, t = cy;
  while (l > 0 && !solid(d, cy * fw + l)) l--;
  while (t > 0 && !solid(d, t * fw + cx)) t--;
  const hw = l > 0 ? cx - l : fw * 0.3, hh = t > 0 ? cy - t : h * 0.25;
  return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
}
/** 그림의 한 부분 (띠의 한 프레임 · 잘라 낸 꼬리) */
const subTex = new Map<string, Texture>();
function partTex(name: string, tex: Texture, x: number, y: number, w: number, h: number): Texture {
  const key = `${name}#${x},${y},${w},${h}`;
  let t = subTex.get(key);
  if (!t) { t = new Texture({ source: tex.source, frame: new Rectangle(x, y, w, h) }); subTex.set(key, t); }
  return t;
}
/** 가로 띠 그림의 k (0~1) 때 프레임. fw = 프레임 너비 ÷ 높이 */
function stripFrame(name: string, fw: number, k: number): Texture | null {
  const tex = artTexture(name);
  if (!tex) return null;
  const w = tex.height * fw, n = Math.max(1, Math.floor(tex.width / w + 0.01)), i = Math.max(0, Math.min(n - 1, Math.floor(k * n)));
  return partTex(name, tex, i * w, 0, w, tex.height);
}
/** 프레임마다 다시 쓰는 그림 칸 (안 쓴 것은 숨김) */
class SpritePool {
  private list: Sprite[] = [];
  private used = 0;
  constructor(private layer: Container) {}
  begin(): void { this.used = 0; }
  put(tex: Texture, x: number, y: number, w: number, h: number, alpha = 1, tint = 0xffffff, rot = 0): void {
    let sp = this.list[this.used];
    if (!sp) { sp = new Sprite(); sp.anchor.set(0.5); this.list.push(sp); this.layer.addChild(sp); }
    this.used++;
    sp.texture = tex; sp.visible = true; sp.position.set(x, y); sp.scale.set(w / tex.width, h / tex.height);
    sp.rotation = rot; sp.alpha = alpha; sp.tint = tint;
  }
  end(): void { for (let i = this.used; i < this.list.length; i++) this.list[i].visible = false; }
}
const decals = new SpritePool(decalL), fxArt = new SpritePool(fxArtL), bubbleBack = new SpritePool(bubbleBackL), bubbleFront = new SpritePool(bubbleFrontL);
/** 생명 사슬 띠 (fx-link-*): 가로로 이어 붙이는 그림을 두 칸 사이에 깔아 돌림 */
const strips: TilingSprite[] = [];
let stripUsed = 0;
function strip(tex: Texture, ax: number, ay: number, bx: number, by: number, h: number, alpha: number): void {
  let sp = strips[stripUsed];
  if (!sp) { sp = new TilingSprite({ texture: tex, width: 1, height: 1 }); sp.anchor.set(0.5); strips.push(sp); fxArtL.addChild(sp); }
  stripUsed++;
  const len = Math.hypot(bx - ax, by - ay), k = h / tex.height;
  sp.texture = tex; sp.visible = true; sp.position.set((ax + bx) / 2, (ay + by) / 2); sp.rotation = Math.atan2(by - ay, bx - ax);
  sp.width = len; sp.height = h; sp.tileScale.set(k, k); sp.tilePosition.set(len / 2, 0); sp.alpha = alpha;
}
/** 지금 장소의 세력 (칸 무늬 고르기) */
let boardFaction: FactionKey | null = null;
export function setBoardFaction(f: FactionKey | null): void { boardFaction = f; }

/** 큰 별 (치명타 힐, 16 4-6): 검은 테 금별 + 가운데 흰 별 */
function critStar(g: Graphics, x: number, y: number, k: number, alpha: number): void {
  const r = k * 0.62, w = r * 0.32;
  g.moveTo(x, y - r).quadraticCurveTo(x + w * 0.3, y - w * 0.3, x + r, y).quadraticCurveTo(x + w * 0.3, y + w * 0.3, x, y + r)
    .quadraticCurveTo(x - w * 0.3, y + w * 0.3, x - r, y).quadraticCurveTo(x - w * 0.3, y - w * 0.3, x, y - r).closePath()
    .fill({ color: C.gold, alpha }).stroke({ width: Math.max(1.2, k * 0.08), color: C.line, alpha });
  star(g, x, y, r * 0.45, C.white, alpha);
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
const badgeLabels = new Labels(badgeL);
const tops = new Labels(topL);
// 웹 글꼴이 늦게 오면 글자·숫자 글꼴을 다시 만듦
document.fonts?.addEventListener?.('loadingdone', () => { labels.clear(); badgeLabels.clear(); tops.clear(); if (ready) installNumFont(); });

const mctx = document.createElement('canvas').getContext('2d')!;
function measure(text: string, size: number, font = FONT, weight = W_TEXT): number { mctx.font = `${weight} ${size}px ${font}`; return mctx.measureText(text).width; }

const COS30 = Math.sqrt(3) / 2;
interface DecorationBound {
  key: string; kind: string; shape: string; x: number; y: number; w: number; h: number;
  left: number; right: number; top: number; bottom: number;
  radius?: number; requestedRadius?: number; diameter?: number; requestedDiameter?: number;
  /** 떠오르는 숫자가 가리키는 파티원 */
  uid?: number;
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
/**
 * 보조 연출만 실제 글자/상태 bounds를 피한다. 빈 자리가 없으면 해당 프레임에서 생략한다.
 * near = 받아 줄 자리 (떠오르는 숫자는 자기 칸 근처만: 멀리 밀려나면 다른 사람 숫자로 읽힘)
 */
function transientSpot(box: PillBox, occupied: readonly PillBox[], near?: (x: number, y: number) => boolean): PillBox | null {
  const { w, h } = box;
  if (w > L.right - L.left || h > L.bottom - L.top) return null;
  const origin = fitCenter(box.x, box.y, w / 2, h / 2);
  const clear = (x: number, y: number) => occupied.every(b =>
    Math.abs(x - b.x) >= (w + b.w) / 2 + 1 || Math.abs(y - b.y) >= (h + b.h) / 2 + 1);
  if ((!near || near(origin.x, origin.y)) && clear(origin.x, origin.y)) return { ...origin, w, h };
  let best: PillBox | null = null, distance = Infinity;
  const consider = (x: number, y: number) => {
    const p = fitCenter(x, y, w / 2, h / 2);
    const d = (p.x - origin.x) ** 2 + (p.y - origin.y) ** 2;
    if (d < distance && (!near || near(p.x, p.y)) && clear(p.x, p.y)) { best = { ...p, w, h }; distance = d; }
  };
  // 글자 외곽의 네 면/모서리와 캔버스 경계에서 가장 가까운 안전 후보를 고른다.
  for (const b of occupied) {
    const left = b.x - (b.w + w) / 2 - 1, right = b.x + (b.w + w) / 2 + 1;
    const top = b.y - (b.h + h) / 2 - 1, bottom = b.y + (b.h + h) / 2 + 1;
    consider(left, origin.y); consider(right, origin.y); consider(origin.x, top); consider(origin.x, bottom);
    consider(left, top); consider(left, bottom); consider(right, top); consider(right, bottom);
  }
  consider(L.left, origin.y); consider(L.right, origin.y); consider(origin.x, L.top); consider(origin.x, L.bottom);
  return best;
}
function pill(g: Graphics, lb: Labels, key: string, x: number, y: number, text: string, bg: number, fg: number, fs: number, alpha = 1): PillBox {
  const kind = key.startsWith('deb') ? 'debuff' : key === 'swipe' ? 'swipe' : 'pill';
  const content = fitPartyName(text, Math.max(1, L.right - L.left - fs * 0.7 - 1.5), value => measure(value, fs));
  const label = lb.put(key, content, { size: fs, fill: fg }, x, y, alpha);
  // 높이는 글자 줄 상자(약 1.45em)가 아니라 실제 글자 높이에 맞춤: 작은 칸에서 배지가 이름·위 칸 체력에 닿지 않게 (2026-10-10)
  const tw = Math.max(measure(content, fs), label.width), w = tw + fs * 0.7, h = fs * 1.32;
  const p = fitCenter(x, y, w / 2 + 0.75, h / 2 + 0.75);
  g.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2).fill({ color: bg, alpha }).stroke({ width: 1.5, color: C.line, alpha });
  label.position.set(p.x, p.y);
  recordBound(`${key}-text`, kind, 'text', p.x, p.y, tw, fs);
  recordBound(key, kind, 'pill', p.x, p.y, w + 1.5, h + 1.5);
  return { ...p, w: w + 1.5, h: h + 1.5 };
}
/** 지속 힐 원 (디버프 배지가 없을 때 오른쪽 위). 배지가 있으면 배지 줄 오른쪽 (hotSpot) */
function hotCenter(x: number, y: number, radius: number, lower: number): { x: number; y: number } {
  const p = fitCenter(x, y, radius);
  p.y = clamp(p.y, L.top + radius, L.bottom - lower);
  return p;
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
interface Fx {
  kind: 'heal' | 'hit' | 'dispel' | 'death' | 'revive' | 'art'; id: number; t0: number; crit?: boolean; color?: number; seeds?: number[]; x?: number; y?: number;
  /** 기믹 연출 (kind 'art'): 그림 fx-<name>, 칸 · 날아갈 사람 · 판 전체 · 길이(ms) */
  name?: string; cell?: number; to?: number; wide?: boolean; dur?: number;
}
/** id = 숫자가 가리키는 파티원 (그 칸 근처에만 뜸) */
interface Float { x: number; y: number; text: string; crit: boolean; over: boolean; t0: number; n: number; fill?: number; label?: boolean; id?: number }
/** 말풍선 종류 (41·43 문서): talk 반응·잡담 · call 기믹·신호 (금테) · alert 위기 (붉은 테, 흔들림) · chat 쓰러진 사람의 파티 채팅 (회색) */
export type BubbleKind = 'talk' | 'call' | 'alert' | 'chat';
/** emote = 왼쪽 감정 아이콘 emote-<이름> (43 4장 B) · cheer = 승리 한마디 (fx-talk-cheer) */
interface Bubble { id: number; text: string; t0: number; life: number; kind: BubbleKind; emote?: string | null; cheer?: boolean }
const BUBBLE: Record<BubbleKind, { fill: number; fillA: number; line: number; lw: number }> = {
  talk: { fill: C.ink, fillA: 1, line: C.line, lw: 2 },
  call: { fill: C.ink, fillA: 1, line: C.gold, lw: 2.5 },
  alert: { fill: C.ink, fillA: 1, line: C.danger, lw: 2.5 },
  chat: { fill: C.dead, fillA: 0.85, line: C.line, lw: 2 },
};
/** 감정 아이콘 자리 (43 5장: 말풍선 너비 = 아이콘 16px + 글자 + 여백) */
const EMOTE_W = 16;
/**
 * 대사 이펙트 띠 (43 4장 C, fx-talk-<이름>): 길이(ms) · 프레임 너비 ÷ 높이.
 * pop 말풍선이 뜰 때 · shake 위기 말풍선 둘레 · cheer 승리 한마디 · sweat 실수 신호 칸 위
 */
const TALK_FX = { pop: { ms: 200, fw: 1 }, shake: { ms: 300, fw: 2 }, cheer: { ms: 600, fw: 1 }, sweat: { ms: 600, fw: 1 } } as const;
/** 말풍선 틀 9조각 (43 2장: 장식은 384×192 기준 네 모서리 48px 안, 네 변·가운데는 단색) */
const slices: NineSliceSprite[] = [];
let sliceUsed = 0;
/** 틀 그림의 불투명 부분이 (x, y, w, h)에 맞게. 384×192 → 0.25배 (테두리 약 2px, 위아래 모서리 합이 높이 22px 안) */
function bubbleFrame(tex: Texture, box: ArtBox, x: number, y: number, w: number, h: number, alpha: number): number {
  const e = (48 * tex.height) / 192, mL = box.x, mR = tex.width - box.x - box.w, mT = box.y, mB = tex.height - box.y - box.h;
  const k = Math.min(48 / tex.height, h / Math.max(1, 2 * e - mT - mB));
  let sp = slices[sliceUsed];
  if (!sp) { sp = new NineSliceSprite({ texture: tex, leftWidth: e, rightWidth: e, topHeight: e, bottomHeight: e }); slices.push(sp); sliceL.addChild(sp); }
  sliceUsed++;
  if (sp.texture !== tex) { sp.texture = tex; sp.leftWidth = sp.rightWidth = sp.topHeight = sp.bottomHeight = e; }
  sp.setSize(w / k + mL + mR, h / k + mT + mB);
  sp.scale.set(k); sp.position.set(x - mL * k, y - mT * k); sp.alpha = alpha; sp.visible = true;
  return k;
}
/** 꼬리 그림의 불투명 부분만 (윗변이 열린 아래쪽 삼각형) */
function bubbleTail(kind: BubbleKind): Texture | null {
  const name = `ui-bubble-tail-${kind}`, tex = artTexture(name), b = artBoxes.get(name);
  return tex && b ? partTex(name, tex, b.x, b.y, b.w, b.h) : null;
}
/** 대사 이펙트 띠 한 프레임 (판 밖으로 안 나가게 줄이고 옮김) */
function talkFx(pool: SpritePool, name: keyof typeof TALK_FX, age: number, x: number, y: number, w: number, h: number, key: string, alpha = 1): void {
  // 흔들림은 프레임을 0.12초마다 되풀이 (2프레임 = 0.06초씩), 나머지는 길이 동안 한 번
  const fx = TALK_FX[name], tex = age >= 0 && age < fx.ms ? stripFrame(`fx-talk-${name}`, fx.fw, name === 'shake' ? (age % 120) / 120 : age / fx.ms) : null;
  if (!tex) return;
  const sc = Math.min(1, (L.right - L.left) / w, (L.bottom - L.top) / h), p = fitCenter(x, y, (w * sc) / 2, (h * sc) / 2);
  pool.put(tex, p.x, p.y, w * sc, h * sc, alpha);
  recordBound(key, 'fx', 'rect', p.x, p.y, w * sc, h * sc);
}
const FX_MS = 400;
const B2 = {
  floats: [] as Float[], bubbles: [] as Bubble[], fx: [] as Fx[], disp: {} as Record<number, number>, hitFx: {} as Record<number, number>, shake: {} as Record<number, number>,
  lastFlash: {} as Record<number, number>, lens: null as { idx: number; t0: number } | null, lastRender: 0, n: 0,
};
export function resetBoardFx(): void {
  B2.floats = []; B2.bubbles = []; B2.fx = []; B2.disp = {}; B2.hitFx = {}; B2.shake = {}; B2.lastFlash = {}; B2.lens = null; seenZones.clear();
  telsSeen = []; telsDone.clear();
}
/**
 * 기믹 연출 (37 4장 F-1): 칸 반지름 배 크기 · 그림이 없을 때 빛 색 · 길이(ms).
 * tint = 흰 그림을 이 색으로 칠함 (사건마다 색이 다르면 그 색), fly = to에게 날아감 (top = 판 위쪽 보스 자리에서), up = 칸 위로 띄움,
 * wide = 판 가운데 크게 한 번 (all이어도), rot = 돌림 (라디안), art = 그림 이름이 fx-<이름>과 다를 때
 */
const FX_LOOK: Record<string, { size: number; color: number; ms?: number; tint?: boolean; fly?: boolean; top?: boolean; up?: number; wide?: boolean; rot?: number; art?: string }> = {
  spawn: { size: 1.7, color: 0xb06bff, ms: 500 },
  poof: { size: 1.6, color: 0xd8d0c0 },
  explode: { size: 2.6, color: 0xff8a3d, ms: 600 },
  slam: { size: 1.9, color: 0xffd166 },
  warn: { size: 0.8, color: 0xff5a3d, ms: 700, up: 0.95 },
  shockwave: { size: 2.6, color: 0xd9a66b, ms: 600, wide: true },
  crumble: { size: 1.7, color: 0x9a8f80, ms: 500 },
  'soul-purify': { size: 2.1, color: 0x8fe3e0, ms: 600 },
  splash: { size: 1.9, color: 0x9a7fc4, tint: true },
  'link-snap': { size: 1.5, color: 0xc04ad8, ms: 500 },
  bubble: { size: 1.9, color: 0xffe08a, ms: 600, tint: true },
  overflow: { size: 1.3, color: 0xffe08a },
  'fireball-green': { size: 0.8, color: 0x7dff6a, ms: 450, fly: true },
  hearts: { size: 1.3, color: 0xd08bff, ms: 600, up: 0.4 },
  hook: { size: 0.9, color: 0xc98b5a, ms: 350, fly: true, top: true },
  recoil: { size: 1.7, color: 0x7fc8ff },
  'zone-burst': { size: 1.6, color: 0xff5a3d },
  'jail-break': { size: 1.8, color: 0xd8c7a8, ms: 500 },
  'mana-drop': { size: 1.0, color: 0x5aa8ff, ms: 600, up: 0.6 },
  // 심연의 탑 2~5층 (그림 요청 44 H): 피의 서약 분담 · 탱커 교대 · 깨진 시간 · 치유 흡수 막 · 전투의 함성
  soak: { size: 2.4, color: 0xd8475a, ms: 600 },
  swap: { size: 0.9, color: 0xc9a2ff, ms: 450, fly: true },
  slow: { size: 1.6, color: 0x8fd3ff, ms: 700 },
  absorb: { size: 1.5, color: 0xb48be8, ms: 600 },
  cheer: { size: 1.4, color: 0xffd166, ms: 700, up: 0.4 },
  // 묶음 B (46 5장, 그림 37 G · 47 E): 부풀기 지워서 퐁 · 치유 상한 먹물 · 뒤집힘 금화
  'swell-pop': { size: 2.2, color: 0x7ee36a, ms: 550 },
  'ink-splat': { size: 1.4, color: 0x3a3550, ms: 600 },
  'coin-flip': { size: 1.2, color: 0xffd166, ms: 650, up: 0.5 },
  // 묶음 C (48 5장, 그림 49): 요정 고리가 깔리거나 자라며 버섯이 퐁퐁 · 넘어가는 포자 솜뭉치가 날아감
  'ring-grow': { size: 2.2, color: 0xf29cb7, ms: 600 },
  'spore-pass': { size: 0.9, color: 0xfbe4ee, ms: 500, fly: true },
  // 묶음 A 이펙트 (44 E): 디버프 걸림 (종류 색) · 외침·울부짖음·함성 (세력 색, 보스 쪽 위에서 아래로 퍼짐) · 등불 흔들기
  debuff: { size: 1.3, color: 0xe5433d, tint: true },
  shout: { size: 1, color: 0xf1e4c8, ms: 600, tint: true, wide: true, rot: Math.PI / 2 },
  lantern: { size: 1, color: 0xffb347, ms: 600, wide: true },
  // 아직 안 온 그림 (44 E-4~10): 그림이 있을 때만 부름 (메아리 · 받침 울림 · 서리 폭발 · 침묵의 시선 · 침묵 · 떨어지는 돌)
  echo: { size: 0.8, color: 0xb06bff, ms: 450, fly: true },
  'tower-ring': { size: 1.8, color: 0xffd166, ms: 500 },
  'frost-burst': { size: 1.7, color: 0x8fd3ff },
  gaze: { size: 0.9, color: 0xd04ad8, ms: 400, fly: true, top: true },
  silence: { size: 1.2, color: 0x9dbde6 },
  rockfall: { size: 1.6, color: 0xc9a35c },
  // 장비 특수능력 (36 J): 발동 (묶음 색) · 튀는 빛 (옆 칸으로 날아감) · 마지막 숨 (금빛 날개)
  proc: { size: 1.5, color: 0xffd166, ms: 500, tint: true },
  bounce: { size: 0.7, color: 0xffd166, ms: 400, fly: true },
  endure: { size: 1.9, color: 0xffd166, ms: 700 },
  // 묶음 C2 (48 4장, 그림 49 E): 모자가 씌워짐 · 춤바람 음표 · 꿀벌이 쏨 · 숲 할아버지가 깨어남 (판 전체)
  'hat-drop': { size: 1.0, color: 0xc9a2ff, ms: 500 },
  dance: { size: 1.3, color: 0xf29cb7, ms: 700, up: 0.4 },
  'bee-sting': { size: 0.8, color: 0xffc94a, ms: 400 },
  'tree-wake': { size: 3.2, color: 0x8fd36a, ms: 900 },
  // 묶음 D (51 5장, 그림 52 E): 보물 욕심 금화가 떨어짐 · 녹는 보호막 열기 (판 전체) · 알이 깨짐
  'greed-coin': { size: 1.2, color: 0xffd166, ms: 600, up: 0.5 },
  'melt-heat': { size: 3.2, color: 0xff8a3d, ms: 900, wide: true },
  'egg-hatch': { size: 1.8, color: 0xffb25b, ms: 600 },
  // 묶음 D2: 용의 숨결이 줄을 지나감 (줄 가운데 칸에서 크게) · 성소 문이 한 칸 열림 (판 전체)
  'dragon-breath': { size: 2.8, color: 0xff9a3d, ms: 600 },
  'door-open': { size: 3.2, color: 0xb06bff, ms: 900, wide: true },
  // 묶음 E (54 5장, 그림 55 E): 신기루가 걷힘 (가짜 칸 위, 작게) · 체력이 되감김 (칸마다) · 모래 폭풍 (판 전체, 오른쪽으로) · 하품 (칸 위로) · 심장 박동 (판 전체)
  'mirage-shimmer': { size: 1.5, color: 0xffe3a3, ms: 600 },
  'sand-rewind': { size: 1.5, color: 0xe9c46a, ms: 700 },
  sandstorm: { size: 3.2, color: 0xe9c46a, ms: 900, wide: true },
  yawn: { size: 1.0, color: 0xf4e3b5, ms: 700, up: 0.5 },
  heartbeat: { size: 3.2, color: 0xa66bff, ms: 800, wide: true },
  // 묶음 F (56 5장, 그림 57 E): 회오리가 띄워 올림 · 구름에서 내려앉음 · 번개가 하늘에서 떨어짐 · 이웃으로 튐 (그림이 없으면 번개 줄) · 피뢰침에서 땅으로
  'lift-swirl': { size: 1.8, color: SKY, ms: 700, up: 0.3 },
  'land-puff': { size: 1.6, color: 0xf2f7ff, ms: 500 },
  'chain-strike': { size: 0.9, color: BOLT, ms: 300, fly: true, top: true },
  'chain-bolt': { size: 0.8, color: BOLT, ms: 350, fly: true },
  'chain-rod': { size: 1.4, color: BOLT, ms: 500 },
};
/** 이미 터뜨린 장판 (새 장판이 깔리는 순간 한 번 zone-burst) */
const seenZones = new Set<number>();
/**
 * 기믹 연출 하나 (엔진 fx 사건 · 쫄 처치 · 새 장판). all = 살아 있는 모두 (wide 연출은 판 가운데 크게 한 번), color = 흰 그림 칠할 색
 */
export function fxGim(name: string, now: number, at: { cell?: number; id?: number; to?: number; all?: boolean; color?: number }): void {
  const F = B.F;
  if (!F || !L.ok || S.reducedEffects || B2.fx.length >= 90) return;
  // 메아리 (44 E-4): 진동에 옮겨붙은 디버프면 fx-echo (그림이 없으면 옮겨붙음 그대로)
  if (name === 'fireball-green' && at.to != null && art('fx-echo') && F.party.find(u => u.id === at.to)?.debuffs.some(d => d.end?.p === 'jump' && d.end.on === 'quake')) name = 'echo';
  const look = FX_LOOK[name], dur = look?.ms ?? FX_MS;
  if (at.all && !look?.wide) { for (const u of F.party) if (u.alive) B2.fx.push({ kind: 'art', name, id: u.id, t0: now, dur, color: at.color }); return; }
  B2.fx.push({ kind: 'art', name, id: at.id ?? -1, cell: at.cell, to: at.to, t0: now, dur, wide: at.all || look?.wide, color: at.color });
}
/** 디버프가 걸림 (44 E-1 fx-debuff, 종류 색으로 칠함: 질병 황토 · 독 초록 · 저주 보라 · 마법 파랑). 딜 0 (침묵)은 fx-silence가 있으면 그것 (E-8) */
export function fxDebuff(u: Unit, dtype: string, now: number): void {
  const d = u.debuffs.reduce<Unit['debuffs'][number] | undefined>((a, x) => (!a || x.id > a.id ? x : a), undefined);
  const silence = !!d?.noDps && d.untilBossLoss == null && !!art('fx-silence');
  fxGim(silence ? 'silence' : 'debuff', now, { id: u.id, color: hex(DEB[dtype] || '#E5433D') });
}
/** 특수능력 묶음 색 (42 2장, 캐릭터 화면 char31.css와 같음) */
const SPEC_TINT: Record<SpecGroup | 'named', number> = {
  heal: 0x8bea9c, proc: 0xffb86b, guard: 0x9cc8ff, mana: 0x7fb2ff, dispel: 0xc9a2ff, cd: 0xffe07a, ally: 0xff9db0, gimmick: 0x8fe3d9, hero: 0xf2c46b, named: 0xff8a3d,
};
/** 특수능력 이름 → 열쇠 (spec 사건은 이름만 실어 옴) */
let specKeys: Map<string, string> | null = null;
/** 장비 특수능력이 켜짐 (42 · 36 J): 칸 위 금색 이름 + fx-proc (묶음 색). 마지막 숨은 fx-endure (금빛 날개) */
export function fxSpec(u: Unit, name: string, now: number): void {
  fxAbility(u, name, now);
  if (!specKeys) { specKeys = new Map(Object.values(SPECS).map(d => [d.name, d.key] as const)); for (const n of NAMED) specKeys.set(n.name, n.key); }
  const key = specKeys.get(name) ?? '';
  if (key === 'lastBreath') fxGim('endure', now, { id: u.id });
  else fxGim('proc', now, { id: u.id, color: SPEC_TINT[SPECS[key]?.group ?? 'named'] });
}
/** 지난 프레임 보스 예고 (impact 사건에는 어느 기술인지 없어서 사라진 예고로 찾음) */
let telsSeen: Telegraph[] = [];
const telsDone = new Set<number>();
/**
 * 보스·정예 기술이 떨어짐 (44 E): 외침·울부짖음·함성 = fx-shout (세력 색), 등불 흔들기 = fx-lantern,
 * 그림이 있을 때만 서리 폭발 = fx-frost-burst (모두의 칸), 침묵의 시선 = fx-gaze (걸린 사람에게 날아감), 받침 울림 = fx-tower-ring
 */
export function fxImpact(kind: TelKind | undefined, now: number): void {
  const F = B.F;
  if (!F || S.reducedEffects) return;
  for (const tl of telsSeen) {
    if (tl.kind !== kind || telsDone.has(tl.id) || tl.impact > F.t + 1e-6) continue;
    telsDone.add(tl.id);
    const sk = tl.skill, nm = sk.name ?? '';
    if (tl.ring || sk.pads) { if (art('fx-tower-ring')) for (const i of tl.cells) fxGim('tower-ring', now, { cell: i }); }
    else if (kind !== 'aoe') continue;
    else if (sk.key === 'shout' || sk.key === 'howl' || /외침|울부짖|함성/.test(nm)) fxGim('shout', now, { all: true, color: boardFaction ? hex(FACTIONS[boardFaction].color) : undefined });
    else if (nm.includes('등불')) fxGim('lantern', now, { all: true });
    else if (nm.includes('서리 폭발') && art('fx-frost-burst')) fxGim('frost-burst', now, { all: true });
    else if (sk.key === 'gaze' && art('fx-gaze')) for (const u of F.party) if (u.alive && u.debuffs.some(d => d.name === nm)) fxGim('gaze', now, { id: u.id });
  }
}
const rnd = () => Math.random();
export function fxHeal(u: Unit, eff: number, amt: number, crit: boolean, now: number): void {
  if (!L.ok || S.reducedEffects) return;
  const p = unitPos(u);
  const over = eff < amt * 0.25; // 거의 다 넘친 힐은 회색으로 작게
  if (B2.floats.length < 40) B2.floats.push({ x: p.x + (rnd() - 0.5) * L.s * 0.5, y: p.y - L.s * 0.3, text: `+${eff}`, crit: crit && !over, over, t0: now, n: B2.n++, id: u.id });
  B2.hitFx[u.id] = now;
  if (B2.fx.length < 60 && !over) B2.fx.push({ kind: 'heal', id: u.id, t0: now, crit, seeds: Array.from({ length: crit ? 8 : 4 }, rnd) });
}
export function fxRevive(u: Unit, now: number, label = '부활'): void {
  if (!L.ok) return;
  if (S.reducedEffects) { addBubble(u.id, label, now); return; }
  const p = unitPos(u);
  B2.floats.push({ x: p.x, y: p.y - L.s * 0.3, text: label, crit: true, over: false, t0: now, n: B2.n++, id: u.id });
  B2.hitFx[u.id] = now;
  B2.fx.push({ kind: 'revive', id: u.id, t0: now });
}
/** 뒤집힌 축복 (35 8장 「치유 반전」): 이 칸에 들어간 치유가 빨간 피해 숫자로 */
export function fxHurt(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1 || B2.floats.length >= 40) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x + (rnd() - 0.5) * L.s * 0.5, y: p.y - L.s * 0.3, text: `-${amt}`, crit: false, over: false, t0: now, n: B2.n++, fill: 0xff5a3d, id: u.id });
}
/** 실수 방지로 힐이 안 나감: 칸만 흔들림 */
export function fxShake(u: Unit, now: number): void {
  B2.shake[u.id] = now;
}
/** 파티원 능력 회복: 연두색 + 작은 십자 (내 힐과 구분, 17 7장) */
export function fxAllyHeal(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1 || B2.floats.length >= 40) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x + L.s * 0.25, y: p.y - L.s * 0.1, text: `✚${amt}`, crit: false, over: false, t0: now, n: B2.n++, fill: 0xc8f07a, id: u.id });
}
/** 파티원 능력 사용: 칸 위에 능력 이름 (17 7장) */
export function fxAbility(u: Unit, name: string, now: number): void {
  if (S.reducedEffects) { addBubble(u.id, name, now); return; }
  if (!L.ok || B2.floats.length >= 40) return;
  const p = unitPos(u);
  B2.floats.push({ x: p.x, y: p.y - L.s * 0.55, text: name, crit: false, over: false, t0: now, n: B2.n++, fill: C.gold, label: true, id: u.id });
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
/** 말풍선. life = 보이는 시간 (ms, 긴 대사는 조금 더 오래, battle/talk.ts) · kind = 테두리 종류 · look = 감정 아이콘 · 승리 이펙트 (43 4장) */
export function addBubble(id: number, text: string, now: number, life = 1700, kind: BubbleKind = 'talk', look: { emote?: string | null; cheer?: boolean } = {}): void {
  B2.bubbles = B2.bubbles.filter(b => b.id !== id);
  B2.bubbles.push({ id, text, t0: now, life, kind, emote: look.emote, cheer: look.cheer });
  if (look.emote) artTexture(`emote-${look.emote}`); // 감정 아이콘을 바로 읽기 시작
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

/** 그림 이펙트 한 장: 판 밖으로 안 나가게 크기를 줄여 그림 */
function spriteFx(tex: Texture, key: string, x: number, y: number, size: number, alpha: number, tint = 0xffffff, rot = 0): void {
  const half = safeRadius(x, y, size / 2, 'circle');
  if (half <= 0 || alpha <= 0) return;
  fxArt.put(tex, x, y, half * 2, half * 2, alpha, tint, rot);
  recordBound(key, 'fx', 'circle', x, y, half * 2, half * 2, { diameter: half * 2, requestedDiameter: size });
}
const fxPos = (F: NonNullable<typeof B.F>, id: number): { x: number; y: number } | null => {
  const u = F.party.find(x => x.id === id) ?? F.souls.find(x => x.id === id);
  return u ? unitPos(u) : null;
};
/** 기믹 연출 한 프레임 (37 4장 F-1): 그림 fx-<이름>, 없으면 그 색의 빛과 고리 */
function artFx(F: NonNullable<typeof B.F>, e: Fx, now: number, r: number, s: number): void {
  const look = FX_LOOK[e.name!] ?? { size: 1.4, color: C.white };
  const k = Math.min(1, (now - e.t0) / (e.dur ?? FX_MS)), key = `fx-${e.name}-${e.t0}-${e.id}-${e.cell ?? ''}`;
  let p = e.wide ? { x: (L.left + L.right) / 2, y: (L.top + L.bottom) / 2 } : e.cell != null ? center(e.cell) : fxPos(F, e.id);
  if (!p) return;
  let rot = look.rot ?? 0;
  if (look.fly) {
    const from = look.top ? { x: p.x, y: L.top } : p, to = look.top ? p : e.to != null ? fxPos(F, e.to) : null;
    if (!to) return;
    if (e.name!.startsWith('chain-') && !artTexture(look.art ?? `fx-${e.name}`)) { bolt(from, to, Math.max(2, s * 0.07), 1 - k, `${key}-bolt`); return; } // 연쇄 번개 줄 (그림 57이 오기 전)
    const kk = k * k * (3 - 2 * k);
    rot = Math.atan2(to.y - from.y, to.x - from.x);
    p = { x: from.x + (to.x - from.x) * kk, y: from.y + (to.y - from.y) * kk };
  } else if (e.to != null) {
    const q = fxPos(F, e.to); // 두 사람 사이 (사슬 끊어짐)
    if (q) p = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }
  if (look.up) p = { x: p.x, y: p.y - r * look.up * (0.7 + 0.3 * k) };
  const size = e.wide ? Math.min(L.right - L.left, L.bottom - L.top) * (0.45 + 0.55 * k) : r * look.size * (look.fly ? 1 : 0.7 + 0.4 * Math.sin((k * Math.PI) / 2));
  const alpha = look.fly ? (k < 0.85 ? 1 : (1 - k) / 0.15) : 1 - k * k;
  const tex = artTexture(look.art ?? `fx-${e.name}`), color = e.color ?? look.color;
  if (tex) { spriteFx(tex, key, p.x, p.y, size, alpha, look.tint ? color : 0xffffff, rot); return; }
  if (look.fly) {
    const half = safeRadius(p.x, p.y, r * 0.22, 'circle');
    fxG.circle(p.x, p.y, half).fill({ color, alpha });
    recordBound(key, 'fx', 'circle', p.x, p.y, half * 2, half * 2);
    return;
  }
  glow(p.x, p.y, size, color, 0.45 * alpha, `${key}-glow`);
  const w = Math.max(2, s * 0.07) * (1 - k);
  if (w > 0.2) fxG.circle(p.x, p.y, ringRadius(key, 'circle', p.x, p.y, size * 0.42, w, 'fx')).stroke({ width: w, color, alpha });
}

/** 번개 줄 (연쇄 번개, 56 5장 화면): 두 점 사이 지그재그 노란 선 */
function bolt(a: { x: number; y: number }, b: { x: number; y: number }, width: number, alpha: number, key: string): void {
  if (alpha <= 0) return;
  const n = 6, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  fxG.moveTo(a.x, a.y);
  for (let i = 1; i < n; i++) { const j = (i % 2 ? 1 : -1) * len * 0.07; fxG.lineTo(a.x + (dx * i) / n + nx * j, a.y + (dy * i) / n + ny * j); }
  fxG.lineTo(b.x, b.y).stroke({ width, color: BOLT, alpha, cap: 'round', join: 'round' });
  recordBound(key, 'fx', 'line', (a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(dx) + width, Math.abs(dy) + width);
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
  for (const g of [cellsG, unitsG, fxG, overG, badgeG, topG]) g.clear();
  labels.begin(); badgeLabels.begin(); tops.begin(); glowUsed = 0; hexFramesUsed = 0; decorationBounds.length = 0; decals.begin(); fxArt.begin(); stripUsed = 0;
  bubbleBack.begin(); bubbleFront.begin(); sliceUsed = 0;
  telsSeen = F.tels.slice(); // 다음 impact 사건이 어느 기술인지 (fxImpact)
  const fs = (k: number, min: number) => Math.max(min, s * k);

  // 영역 (장판 예고·활성 장판)
  const zoneSet = new Set<number>(), telSet = new Set<number>();
  for (const z of F.zones) z.cells.forEach(i => zoneSet.add(i));
  const ringSet = new Set<number>(); for (const z of F.zones) if (z.ring) z.cells.forEach(i => ringSet.add(i)); // 요정 고리 (P-GROW, 48 5장)
  for (const tl of F.tels) if (tl.kind === 'zone') tl.cells.forEach(i => telSet.add(i));
  const safeSet = new Set<number>(); for (const tl of F.tels) tl.safe?.forEach(i => safeSet.add(i)); // 피난처 (35 3-E)
  const padSet = new Set<number>(); for (const tl of F.tels) if (tl.skill.pads || tl.ring) tl.cells.forEach(i => padSet.add(i)); // 받침 발판 (35 4-5) · 끌려온 칸 받침 (39 3-1)
  // 새로 깔린 장판: 칸마다 한 번 터지는 연출 (쫄 오라처럼 끝나지 않는 장판은 빼고). 해바라기 언덕은 떨어지는 돌 (44 E-10, 그림이 있을 때)
  const burst = boardFaction === 'hill' && art('fx-rockfall') ? 'rockfall' : 'zone-burst';
  for (const z of F.zones) if (!seenZones.has(z.id)) { seenZones.add(z.id); if (isFinite(z.end)) z.cells.forEach(i => fxGim(burst, now, { cell: i })); }
  // 칸 무늬 그림 (37 4장 B). 없으면 아래 벡터 그림
  const zoneTex = artTexture(zoneArtName(boardFaction)), warnTex = artTexture('fx-cell-zone-warn'), holeTex = artTexture(holeArtName(boardFaction));
  const safeTex = artTexture('fx-cell-safe'), padTex = artTexture('fx-cell-tower'), ringTex = artTexture(ringArtName(boardFaction)), cellArt = r * 1.96;
  const melting = !!F.melt && F.t < F.melt.until;
  F.cells.forEach((c, i) => {
    const p = center(i);
    hexPoly(cellsG, p.x, p.y, r).fill({ color: C.cell, alpha: 0.5 }).stroke({ width: 2, color: C.bronze, alpha: 0.75 }); // 빈칸은 비쳐서 장소 바닥이 보임, 진형 선은 청동 (28 5장)
    // 무너진 바닥 (P-HOLE): 검은 칸, 테두리만 남음
    if (c.block === 'hole') {
      if (holeTex) decals.put(holeTex, p.x, p.y, cellArt, cellArt);
      else hexPoly(cellsG, p.x, p.y, r * 0.94).fill({ color: 0x07070b, alpha: 0.9 });
      return;
    }
    // 피난처 안전 칸: 금빛 바닥 + 안쪽 테 (맞는 칸은 아래 예고 빨강). 받침 발판도 금빛
    if (safeSet.has(i)) {
      const t = padSet.has(i) ? padTex : safeTex;
      if (t) decals.put(t, p.x, p.y, cellArt, cellArt, 0.75 + 0.25 * pulse);
      else {
        hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: 0.2 + 0.16 * pulse });
        hexPoly(cellsG, p.x, p.y, r * 0.86).stroke({ width: Math.max(2, s * 0.05), color: C.gold, alpha: 0.85 });
      }
    }
    // 장판: 바닥 그림(28 5장)에 묻히지 않게 밝은 빨강 + 빗금 + 안쪽 테. 예고 = 깜빡이는 빨강 + 점선 테
    if (ringSet.has(i)) {
      // 요정 고리: 분홍 바닥 + 버섯 동그라미 (그림 49 fx-cell-ring). 자라면 칸이 늘어남
      if (ringTex) decals.put(ringTex, p.x, p.y, cellArt, cellArt, 0.82 + 0.18 * zpulse);
      else {
        hexPoly(cellsG, p.x, p.y, r).fill({ color: RING, alpha: 0.38 + 0.12 * zpulse });
        cellsG.circle(p.x, p.y, r * 0.66).stroke({ width: Math.max(2, s * 0.06), color: RING_HI, alpha: 0.95 });
        for (let k = 0; k < 6; k++) { const a = (k * 60 + 30) * Math.PI / 180; cellsG.circle(p.x + Math.cos(a) * r * 0.66, p.y + Math.sin(a) * r * 0.66, Math.max(2, s * 0.07)).fill({ color: 0xfff1f5 }).stroke({ width: 1.5, color: RING_HI }); }
      }
    } else if (zoneSet.has(i)) {
      if (zoneTex) decals.put(zoneTex, p.x, p.y, cellArt, cellArt, 0.82 + 0.18 * zpulse);
      else {
        hexPoly(cellsG, p.x, p.y, r).fill({ color: C.zone, alpha: 0.5 + 0.12 * zpulse });
        hatchHex(cellsG, p.x, p.y, r * 0.96, Math.max(7, s * 0.2)).stroke({ width: Math.max(2, s * 0.05), color: C.zoneHi, alpha: 0.6 });
        hexPoly(cellsG, p.x, p.y, r * 0.9).stroke({ width: Math.max(2, s * 0.06), color: C.zoneHi, alpha: 0.95 });
      }
    } else if (telSet.has(i)) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.tel, alpha: 0.14 + 0.24 * pulse });
      if (warnTex) decals.put(warnTex, p.x, p.y, cellArt, cellArt, 0.5 + 0.5 * pulse);
      else dashPoly(cellsG, hexPts(p.x, p.y, r * 0.9), 6, 4, Math.max(2, s * 0.05), C.zoneHi, 0.5 + 0.5 * pulse);
    }
    // 녹는 보호막: 열기 동안 칸마다 주황 아지랑이 (그림 52가 오면 fx)
    if (melting) hexPoly(cellsG, p.x, p.y, r).fill({ color: MELT, alpha: 0.07 + 0.08 * zpulse });
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

  // 연쇄 번개 예고 (56 5장 화면): 번개 구름 옆 칸 테두리가 옅게 번쩍 (튈 수 있는 곳)
  for (const tl of F.tels) if (tl.skill.chain && !tl.fake) for (const id of tl.units) {
    const v = F.party.find(x => x.id === id);
    if (!v?.alive) continue;
    const c0 = F.cells[v.cell];
    F.cells.forEach((c, i) => { if (hexDist(c, c0) === 1 && !c.block) { const p = center(i); dashPoly(cellsG, hexPts(p.x, p.y, r * 0.96), 5, 4, Math.max(2, s * 0.05), BOLT, 0.25 + 0.45 * pulse); } });
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
    // 띄워 올리기 (56 5장 화면): 칸에는 그림자, 카드는 위로 떠올라 구름 위에
    if (u.lift) {
      cellsG.ellipse(x, y + r * 0.55, r * 0.55, r * 0.17).fill({ color: 0x000000, alpha: 0.28 });
      y -= r * (0.3 + (S.reducedEffects ? 0 : 0.05 * Math.sin(t * 3)));
    }
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
    if (u.debuffs.some(d => d.charm)) hexPoly(unitsG, x, y, r).fill({ color: 0x9a6bd1, alpha: 0.45 }); // 매혹: 보라 칸 (적이 됨)
    // 묶음 B 새 부품 (46 5장 화면): 치유 상한 = 상한 위를 먹물로 · 부풀기 = 중첩만큼 커지는 초록 거품 · 뒤집힘 = 금빛, 끝나기 1초 전 깜빡임
    const cap = u.debuffs.find(d => d.cap != null);
    if (cap && cap.cap! < 1) {
      const ly = bot - 2 * r * cap.cap!;
      fillBand(unitsG, x, y, r, top, ly, 0x2c2a44, 0.55);
      fillBand(unitsG, x, y, r, ly - Math.max(1, s * 0.025), ly + Math.max(1, s * 0.025), 0x15131f, 0.95);
    }
    // 모래시계 (P-GLASS, 54 5장): 창이 끝나면 돌아갈 체력 = 금빛 모래 선, 끝나기 1초 전 깜빡임
    for (const g of F.glass) {
      const g0 = g.rec.get(u.id);
      if (g0 == null) continue;
      const ly = bot - 2 * r * Math.max(0.02, Math.min(1, g0)), th = Math.max(1.5, s * 0.035);
      fillBand(unitsG, x, y, r, ly - th, ly + th, SAND, g.until - F.t < 1 ? 0.55 + 0.45 * pulse : 0.95);
    }
    const swell = u.debuffs.find(d => d.swell);
    if (swell) unitsG.circle(x, y + r * 0.1, r * Math.min(0.85, 0.3 + 0.12 * (swell.stack ?? 1))).fill({ color: 0x7ee36a, alpha: 0.16 }).stroke({ width: Math.max(1.5, s * 0.04), color: 0x7ee36a, alpha: 0.75 });
    const flip = u.debuffs.find(d => d.end?.p === 'flip');
    if (flip) hexPoly(unitsG, x, y, r).fill({ color: 0xffd166, alpha: flip.left < 1 ? 0.15 + 0.3 * pulse : 0.15 });
    // 묶음 C (48 5장 화면): 넘어가는 포자 = 칸 아래쪽 솜뭉치 (남은 막이 적을수록 작게), 끝나기 2초 전 깜빡임
    const puff = u.debuffs.find(d => d.end?.p === 'pass');
    if (puff) {
      const k = Math.max(0.45, Math.min(1, (puff.absorbLeft ?? 0) / Math.max(1, (puff.absorb ?? 1) * F.dmgMult)));
      const pr = r * 0.2 * k, py = y + r * 0.42, a = puff.left < 2 ? 0.55 + 0.4 * pulse : 0.9;
      for (const [dx, dy] of [[-1.1, 0.2], [0, -0.35], [1.1, 0.2], [0, 0.45]]) unitsG.circle(x + dx * pr, py + dy * pr, pr).fill({ color: 0xfbe4ee, alpha: a }).stroke({ width: 1.2, color: RING_HI, alpha: a * 0.8 });
    }
    // 모자 뽑기 (48 5장): 칸 위에 모자 그림 (뒤집힘 실크해트 · 상한 고깔모자 · 완치 왕관 모자)
    const hat = u.debuffs.find(d => d.art), hatTex = hat ? artTexture(hat.art!) : null;
    if (hatTex) fxArt.put(hatTex, x, y - r * 0.6, r * 0.95, r * 0.95);
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
    // 실수 신호 땀방울 (43 4장 C fx-talk-sweat): 칸 흔들림 0.6초 동안 칸 위쪽에 3프레임
    if (!S.reducedEffects && F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) {
      const st = stripFrame('fx-talk-sweat', TALK_FX.sweat.fw, 1 - (u.mistakeUntil - F.t) / 0.6);
      if (st) spriteFx(st, `sweat${u.id}`, x, y - r * 0.45, r * 1.5, 1);
    }
    // 테두리
    if (u.moving) dashPoly(unitsG, hexPts(x, y, r), 4, 4, Math.max(2.5, s * 0.07), 0xd8d3c0);
    else {
      // 바깥 = 검은 외곽선 (30% 아래면 위험 빨강), 안쪽 = 청동 테 (나는 금테)
      const bw = Math.max(2.5, s * 0.07);
      hexPoly(unitsG, x, y, r).stroke({ width: bw, color: low ? C.danger : C.line });
      hexPoly(unitsG, x, y, r - bw * 0.85).stroke({ width: Math.max(1.2, s * 0.035), color: low ? C.line : u.role === 'healer' ? C.frame : C.bronze });
      hexFrame(u.id, x, y, r, bw);
    }
    if (u.lift) { // 떠 있는 구름 (그림 57 E가 오면 fx-cloud-ride)
      const ct = artTexture('fx-cloud-ride');
      if (ct) fxArt.put(ct, x, y + r * 0.8, r * 1.9, r * 0.95);
      else for (const [dx, dy, k] of [[-0.5, 0.88, 0.3], [0, 0.8, 0.38], [0.5, 0.88, 0.3]]) unitsG.circle(x + dx * r, y + dy * r, r * k).fill({ color: 0xf6fbff, alpha: 0.92 });
    }
    over.push({ u, x, y, deb: undefined });
  }

  // 효과 (칸 채움 위, 글자·테두리 아래)
  B2.fx = S.reducedEffects ? [] : B2.fx.filter(e => now - e.t0 < (e.dur ?? FX_MS));
  for (const e of B2.fx) {
    if (e.kind === 'art') { artFx(F, e, now, r, s); continue; }
    const k = (now - e.t0) / FX_MS;
    const u = F.party.find(x => x.id === e.id);
    const p = e.x != null ? { x: e.x, y: e.y! } : u ? unitPos(u) : null;
    if (!p) continue;
    // 공용 이펙트 그림 (37 4장 F-2)이 있으면 그 그림, 없으면 벡터
    const tex = artTexture(e.kind === 'heal' ? 'fx-heal' : e.kind === 'death' ? 'fx-down' : `fx-${e.kind}`);
    if (e.kind === 'heal') {
      if (tex) spriteFx(tex, `heal${e.id}-${e.t0}`, p.x, p.y - r * 0.25 * k, r * (1.5 + 0.4 * k), 1 - k * k, hex(emblemColor(F.hero)));
      else {
        glow(p.x, p.y, r * (1.6 + 0.6 * k), e.crit ? 0xfff1b8 : 0xfff8e6, 0.55 * (1 - k), `heal-glow${e.id}-${e.t0}`);
        e.seeds!.forEach((sd, i) => {
          const a = sd * Math.PI * 2, dist = r * (0.25 + 0.45 * k) * (0.6 + 0.4 * ((i * 0.37) % 1));
          const sr = r * (0.09 + 0.05 * ((i * 0.61) % 1)) * (1 - 0.3 * k);
          const sp = fitCenter(p.x + Math.cos(a) * dist * 0.9, p.y + Math.sin(a) * dist * 0.6 - r * 0.5 * k, sr);
          star(fxG, sp.x, sp.y, sr, i % 2 ? C.white : C.gold, 1 - k * k);
          recordBound(`heal-star${e.id}-${e.t0}-${i}`, 'fx', 'star', sp.x, sp.y, sr * 2, sr * 2);
        });
      }
      if (e.crit) {
        const size = r * 0.3, half = size * 0.65 + 1, ct = artTexture('fx-crit');
        const bp = fitCenter(p.x + r * 0.5, p.y - r * (0.42 + 0.3 * k), ct ? half * 1.6 : half);
        if (ct) spriteFx(ct, `heal-crit${e.id}-${e.t0}`, bp.x, bp.y, half * 3.2, 1 - k);
        else {
          critStar(fxG, bp.x, bp.y, size, 1 - k); // 직업 아이콘을 안 가리게 오른쪽 위
          recordBound(`heal-crit${e.id}-${e.t0}`, 'fx', 'star', bp.x, bp.y, half * 2, half * 2);
        }
      }
    } else if (tex) {
      // 맞음 · 해제 · 부활 · 쓰러짐
      const kk = e.kind === 'hit' ? Math.min(1, k * 1.6) : k;
      if (kk < 1) spriteFx(tex, `${e.kind}${e.id}-${e.t0}`, p.x, p.y, r * (e.kind === 'hit' ? 1 + 0.4 * kk : 1.2 + 0.8 * kk), 1 - kk * kk);
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
    // 이름 · 체력 %는 파티원 칸과 같은 자리 (이웃한 적 칸끼리 글자가 겹치지 않게 알약 대신 글자만). 칸 그림(37 4장 E)이 있으면 이름 대신 그림
    const mt = artTexture(addArtName(m));
    if (mt) decals.put(mt, p.x, p.y - r * (compact ? 0.26 : 0.18), r * (compact ? 0.85 : 1.15), r * (compact ? 0.85 : 1.15));
    else labels.put(`tot${m.id}`, a.short, { size: typography.nick, fill: 0xf3cfc6, strokeW: typography.nick < 11 ? 1.5 : 2 }, p.x, p.y + r * (compact ? -0.29 : 0.13));
    labels.put(`totp${m.id}`, `${Math.ceil((m.hp / m.max) * 100)}%`, { size: typography.hp, fill: C.white, weight: W_NUM, strokeW: compact ? 1.5 : 2.5 }, p.x, p.y + r * (compact ? 0.25 : 0.6));
    const j = a.job;
    // 남은 초: 폭탄 = 터질 때까지 (부화하는 알 = 깨질 때까지), 걸어오는 쫄 = 보스에게 닿을 때까지, 큰 쫄 = 강타 예고
    const left = (j?.p === 'bomb' || j?.p === 'hatch' || j?.p === 'hoard') && isFinite(a.jobAt!) ? a.jobAt! - F.t : j?.p === 'march' ? (a.steps! - 1) * j.every + a.jobAt! - F.t : j?.p === 'smash' && a.warned ? a.jobAt! - F.t : null;
    if (left != null) pill(overG, labels, `bomb${m.id}`, p.x, p.y - r * (compact ? 0.85 : 0.8), `${Math.max(0, Math.ceil(left))}`, j!.p === 'bomb' || j!.p === 'hatch' ? C.danger : j!.p === 'hoard' ? 0xffd24a : 0xffb25b, j!.p === 'bomb' || j!.p === 'hatch' ? C.white : C.dark, fs(0.26, 11));
    // 자폭 쫄: 노린 사람까지 붉은 줄
    const prey = j?.p === 'fixate' ? F.party.find(u => u.id === a.on && u.alive) : undefined;
    if (prey) { const q = unitPos(prey); overG.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: Math.max(2, s * 0.05), color: C.danger, alpha: 0.45 + 0.4 * pulse }); }
  }

  // 헤매는 영혼 (P-SOUL, 35 8장): 반투명 칸 + 체력 물통 + 남은 초. 파티원 칸처럼 탭하면 힐
  for (const u of F.souls) {
    const p = center(u.cell), frac = Math.max(0, Math.min(1, u.hp / u.max)), rr = r * 0.92;
    hexPoly(cellsG, p.x, p.y, rr).fill({ color: 0x8fd8e0, alpha: 0.16 + 0.1 * pulse });
    fillBand(cellsG, p.x, p.y, rr, p.y + rr - 2 * rr * frac, p.y + rr, 0xbff3f0, 0.5);
    dashPoly(cellsG, hexPts(p.x, p.y, rr), 5, 4, Math.max(2, s * 0.06), 0xd8fbff, 0.9);
    if (castTarget === u.id) hexPoly(overG, p.x, p.y, r * 1.04).stroke({ width: 3, color: hex(SEL) });
    const st = artTexture(soulArtName(u));
    if (st) decals.put(st, p.x, p.y - r * (compact ? 0.26 : 0.18), r * (compact ? 0.85 : 1.15), r * (compact ? 0.85 : 1.15), 0.7 + 0.15 * pulse);
    else labels.put(`soul${u.id}`, u.soul!.short, { size: typography.nick, fill: 0xe6fbff, strokeW: typography.nick < 11 ? 1.5 : 2 }, p.x, p.y + r * (compact ? -0.29 : 0.13));
    labels.put(`soulp${u.id}`, `${Math.floor(frac * 100)}%`, { size: typography.hp, fill: C.white, weight: W_NUM, strokeW: compact ? 1.5 : 2.5 }, p.x, p.y + r * (compact ? 0.25 : 0.6));
    pill(overG, labels, `soult${u.id}`, p.x, p.y - r * (compact ? 0.85 : 0.8), `${Math.max(0, Math.ceil(u.soul!.until - F.t))}`, 0x8fd8e0, C.dark, fs(0.26, 11));
  }

  // 생명 사슬 (P-LINK, 35 8장): 두 칸 가운데를 잇는 선. 균형형 = 보라 실 (끊어지기 직전 빨갛게 깜빡), 나눔형 = 금 사슬 (끊긴 선)
  for (const l of F.links) {
    const a = F.party.find(x => x.id === l.a), b = F.party.find(x => x.id === l.b);
    if (!a?.alive || !b?.alive) continue;
    const pa = unitPos(a), pb = unitPos(b), w = Math.max(2.5, s * 0.07);
    const near = l.kind === 'balance' && Math.abs(a.hp / a.max - b.hp / b.max) > l.gap * 0.75;
    const lt = artTexture(l.kind === 'share' ? 'fx-link-chain' : 'fx-link-thread');
    if (lt) { strip(lt, pa.x, pa.y, pb.x, pb.y, w * 3, near ? 0.5 + 0.5 * pulse : 0.95); if (!near) continue; }
    if (l.kind === 'share') {
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y), n = Math.max(1, Math.floor(len / (w * 3)));
      for (let i = 0; i < n; i += 2) {
        const t0 = i / n, t1 = Math.min(1, (i + 1) / n);
        fxG.moveTo(pa.x + (pb.x - pa.x) * t0, pa.y + (pb.y - pa.y) * t0).lineTo(pa.x + (pb.x - pa.x) * t1, pa.y + (pb.y - pa.y) * t1);
      }
      fxG.stroke({ width: w, color: C.gold, alpha: 0.9 });
      continue;
    }
    fxG.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y).stroke({ width: w, color: near ? C.danger : 0xb48be8, alpha: near ? 0.5 + 0.5 * pulse : 0.85 });
  }

  // 테두리 표시 · 배지
  // 바깥 테두리 (1.02~1.22r)는 이웃 칸까지 닿으니 모두 먼저 그리고, 칸 안쪽 디버프 테두리 (0.88r)는 그 위에 따로 그린다.
  // 한 번에 그리면 파티 순서에 따라 이웃의 보호막·봉화·수호 테두리가 디버프 테두리를 덮기도 했다 (2026-10-10 검수)
  for (const o of over) {
    const { u, x, y } = o;
    o.deb = primaryDebuff(u.debuffs);
    if (zoneSet.has(u.cell) || telSet.has(u.cell)) { const w = Math.max(2.5, s * 0.09); hexPoly(overG, x, y, ringRadius(`zone${u.id}`, 'hex', x, y, r * 1.02, w)).stroke({ width: w, color: 0xff5a3d, alpha: zoneSet.has(u.cell) ? 1 : 0.4 + 0.6 * pulse }); }
    if (u.guardian > 0) dashCircle(overG, x, y, ringRadius(`guardian${u.id}`, 'circle', x, y, r * 1.1, 3), 2, 4, 3, melting ? MELT : C.ink, 0.9);
    // 버팀목 (특성): 금색 두꺼운 테두리, 끝나기 2초 전 깜빡임
    if (u.bulwark > 0) { const w = Math.max(3, s * 0.09); hexPoly(overG, x, y, ringRadius(`bulwark${u.id}`, 'hex', x, y, r * 1.1, w)).stroke({ width: w, color: C.gold, alpha: u.bulwark < 2 ? 0.35 + 0.6 * pulse : 0.95 }); }
    // 보호 두루마리: 흰 이중 테두리 (황토 질병·빨간 탱커 표시와 구분), 끝나기 2초 전 깜빡임
    if (u.shield > 0) {
      const a = u.shield < 2 ? 0.35 + 0.6 * pulse : 0.95;
      const outer = ringRadius(`shield-outer${u.id}`, 'hex', x, y, r * 1.2, 2);
      const inner = ringRadius(`shield-inner${u.id}`, 'hex', x, y, r * 1.12, 2, 'ring', outer - r * 0.08);
      hexPoly(overG, x, y, inner).stroke({ width: 2, color: melting ? MELT : 0xedeff7, alpha: a });
      hexPoly(overG, x, y, outer).stroke({ width: 2, color: melting ? MELT : 0xedeff7, alpha: a });
    }
    // 직업 스킬 표시 (25 3장): 피해 감소(나무껍질·성역) 초록 테두리, 희생 금색 점선, 보호의 손 흰 두꺼운 테두리, 봉화 금색 점선 원
    if (u.immune > 0) { const w = Math.max(3, s * 0.1); hexPoly(overG, x, y, ringRadius(`immune${u.id}`, 'hex', x, y, r * 1.14, w)).stroke({ width: w, color: 0xffffff, alpha: u.immune < 2 ? 0.35 + 0.6 * pulse : 0.95 }); }
    else if (u.redu > 0) hexPoly(overG, x, y, ringRadius(`reduction${u.id}`, 'hex', x, y, r * 1.1, 2.5)).stroke({ width: 2.5, color: melting && u.redu > 0.5 ? MELT : HOT_COLOR.sprout, alpha: u.redu < 2 ? 0.35 + 0.6 * pulse : 0.9 });
    if (u.sacr > 0) dashPoly(overG, hexPts(x, y, ringRadius(`sacrifice${u.id}`, 'hex', x, y, r * 1.16, 2)), 5, 4, 2, melting ? MELT : C.gold);
    if (F.beacon === u.id) dashCircle(overG, x, y, ringRadius(`beacon${u.id}`, 'circle', x, y, r * 1.22, 2.5), 3, 5, 2.5, C.gold, 0.95);
    if (castTarget === u.id) hexPoly(overG, x, y, ringRadius(`cast${u.id}`, 'hex', x, y, r * 1.12, 3)).stroke({ width: 3, color: hex(SEL) });
    if (ui.selectedUnitId === u.id) {
      hexPoly(overG, x, y, ringRadius(`selected${u.id}`, 'hex', x, y, r * 1.04, 2.5)).stroke({ width: 2.5, color: C.white });
      const p = fitCenter(x, y + r + 1.5, 4, 2.5);
      overG.poly([p.x - 4, p.y + 2.5, p.x + 4, p.y + 2.5, p.x, p.y - 2.5], true).fill({ color: C.white });
      recordBound(`selected-marker${u.id}`, 'ring', 'triangle', p.x, p.y, 8, 5);
    }
  }
  for (const { u, x, y, deb } of over) if (deb) {
    const w = Math.max(3, s * 0.13), col = hex(DEB[deb.type] || '#E5433D');
    const dr = ringRadius(`debuff-ring${u.id}`, 'hex', x, y, r * 0.88, w, 'debuff');
    if (deb.trap) dashPoly(overG, hexPts(x, y, dr), 6, 4, w, col); else hexPoly(overG, x, y, dr).stroke({ width: w, color: col });
  }
  let meShown = false;
  const hotR = Math.max(7, s * 0.19);
  // 보통 칸 배지 글자: 가장 긴 「×저주 12」와 지속 힐 원이 칸 폭 한 줄에 안 들어가는 판은 전부 짧은 글자 「×저12」 (작은 칸과 같음)
  const shortBadge = compact || measure('×저주 12', typography.debuff) + typography.debuff * 0.7 + 1.5 > r * COS30 * 2 - 2 * (hotR + 0.75) - 1;
  const hpBounds: { id: number; cell: number; text: string; x: number; y: number; w: number; h: number; sx: number }[] = [];
  const smallHots: { id: number; x: number; y: number }[] = [];
  for (const { u, x, y, deb } of over) {
    let debBadge: ReturnType<typeof pill> | undefined;
    // 칸 = 직업 아이콘 · 닉네임 · 체력 (2026-10-07 Lim: 성격 배지는 칸에서 빼고 길게 누르기 정보에만). 「나」 = 직업 문장 (27 3-4)
    const em = u.me ? emblemTexture(F.hero) : null;
    // 위쪽 한 줄은 직업 아이콘 또는 디버프 배지 (디버프가 있으면 배지가 그 자리를 씀, 칸 색이 직업을 보여 줌)
    if (em && !deb) {
      const d = Math.max(14, s * 0.5);
      if (meEmblem.texture !== em) meEmblem.texture = em;
      meEmblem.width = meEmblem.height = d;
      const ep = fitCenter(x, y - r * (compact ? 0.79 : 0.4), d / 2);
      meEmblem.position.set(ep.x, ep.y);
      recordBound(`role${u.id}`, 'role', 'circle', ep.x, ep.y, d, d);
      meShown = true;
    } else if (!deb) {
      const k = s * 0.34, half = k * 0.6 + Math.max(1.5, k * 0.12) / 2;
      const ep = fitCenter(x, y - r * (compact ? 0.79 : 0.38), half);
      roleIcon(overG, u.role, ep.x, ep.y, k);
      recordBound(`role${u.id}`, 'role', 'icon', ep.x, ep.y, half * 2, half * 2);
    }
    // 작은 칸: 배지 · 이름 · 체력 세 줄이 서로와 위 칸 체력에 닿지 않게 (배지 0.81 · 이름 0.24, 2026-10-10)
    nick(u, x, y + r * (compact ? -0.24 : 0.13), r);
    const health = healthDisplay(u.hp, u.max);
    const hasHot = u.hot > 0 || u.hots.length > 0;
    // 영원한 저녁 (05 6-G): 숫자 없이 채움 색만
    const hpText = F.dark ? '?' : `${health.critical ? '!' : ''}${compact ? `${health.percent}%` : Math.ceil(u.hp)}`;
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
    // 양쪽 패널 모두 숫자 HP와 육각형 내부 채움만 사용하고 중복 HP 눈금은 그리지 않는다.
    if (compact && hasHot) {
      // 지속 치유 +의 정확한 종류/잔여 초는 길게 누르기 정보에 보존한다.
      // 양쪽 패널 모두 중앙 하단에 둔다. 오른쪽 아래는 다음 행 디버프 배지가 덮을 수 있다.
      // 기존 눈금 없는 배치를 사용해 HP의 실제 높이 아래 간격을 유지한다.
      const hp = fitCenter(x, Math.max(y + r * 0.68, hpBox.y + hpBox.h / 2 + 4.25), 3.25);
      smallHots.push({ id: u.id, x: hp.x, y: hp.y });
    }
    let hotSpot: { x: number; y: number } | null = null;
    if (deb) {
      const jail = deb.jail ? F.mobs.find(m => m.alive && m.add?.hold === deb.id) : undefined;
      // 다른 종류 디버프도 함께 걸려 있으면 배지 글자 끝에 + (종류는 길게 누르기 정보에). 배지 밖에 따로 그리면 작은 칸에서 위 칸 체력 숫자에 닿는다
      const more = u.debuffs.some(d => d !== deb && d.type !== deb.type) ? '+' : '';
      const badgeText = (short: boolean) => (jail ? `${jail.add!.short} ${Math.ceil((jail.hp / jail.max) * 100)}%` : debuffDisplay(deb, F.hero, short).text) + more;
      const color = deb.jail ? 0xd8c7a8 : deb.trap ? 0xf6e7b0 : hex(DEB[deb.type] || '#E5433D'), fsD = typography.debuff;
      if (compact) debBadge = pill(badgeG, badgeLabels, `deb${u.id}`, x, y - r * 0.81, badgeText(true), color, C.dark, fsD);
      else {
        // 보통 칸 (2026-10-10): 배지를 직업 아이콘 자리 (윗줄)에. 꼭짓점에 두면 위 칸 체력 숫자와 겹친다 (10인 울트라·플립은 거의 다 가림).
        // 윗변은 위 칸 체력 숫자 아래 (글자 상자의 위아래 여백 2px는 겹쳐도 안 보임)
        const h = fsD * 1.32 + 1.5, below = hpBox.y + hpBox.h / 2 - 1.5 * s - 1 + h / 2;
        const hr = hasHot ? hotR + 0.75 : 0, half = r * COS30;
        let text = badgeText(shortBadge), w = measure(text, fsD) + fsD * 0.7 + 1.5;
        if (w > half * 2 - (hr ? hr * 2 + 1 : 0)) { text = badgeText(true); w = measure(text, fsD) + fsD * 0.7 + 1.5; }
        const hx = Math.min(x + r * 0.56, x + half - hr);
        debBadge = pill(badgeG, badgeLabels, `deb${u.id}`, hr ? Math.min(x, hx - hr - 1 - w / 2) : x, Math.max(y - r * 0.4, below), text, color, C.dark, fsD);
        // 지속 힐 원은 배지 오른쪽 같은 줄
        if (hr) hotSpot = fitCenter(Math.max(hx, debBadge.x + debBadge.w / 2 + 1 + hr), debBadge.y, hr);
      }
    }
    if (!compact && u.hot > 0) {
      const hr = Math.max(7, s * 0.19), hp = hotSpot ?? hotCenter(x + r * 0.56, y - r * 0.44, hr + 0.75, hr + 0.75);
      const hx = hp.x, hy = hp.y;
      overG.circle(hx, hy, hr).fill({ color: C.teal }).stroke({ width: 1.5, color: C.line });
      fitLabel(labels.put(`hot${u.id}`, String(Math.ceil(u.hot)), { size: hr * 1.05, fill: C.line }, hx, hy + 0.5), `hot-text${u.id}`, 'hot');
      recordBound(`hot${u.id}`, 'hot', 'circle', hx, hy, hr * 2 + 1.5, hr * 2 + 1.5);
    } else if (!compact && u.hots.length) {
      // 드루이드·성기사 지속 힐: 오른쪽 위 원 (색 = 가장 오래 남은 지속 힐, 숫자 = 남은 초).
      // 보조 지속 힐은 원의 위쪽 테두리 두 구간에 표시한다. 숫자와 원 밖의 이름을 가리지 않는다.
      const hs = u.hots.slice().sort((a, b) => b.left - a.left), h0 = hs[0];
      const hr = Math.max(7, s * 0.19), dots = hs.slice(1, 3);
      const { x: hx, y: hy } = hotSpot ?? hotCenter(x + r * 0.56, y - r * 0.44, hr + 0.75, hr + 0.75);
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
    // 보스가 때리는 사람: 테두리 대신 칸 위 조준 표식 (테두리는 디버프 몫). 작은 칸은 디버프 이름표 왼쪽, 보통 칸은 윗줄 배지 위 꼭짓점
    const aimR = Math.max(7, s * 0.2), aimW = Math.max(1.5, aimR * 0.22);
    /** 보통 칸 배지 위 꼭짓점 줄 (조준 표식 · 차례 번호표) */
    const peakY = debBadge && !compact ? Math.min(y - r * 0.98, debBadge.y - debBadge.h / 2 - 1 - aimR - aimW / 2) : 0;
    if (tank === u) {
      const br = aimR, bw = aimW;
      let bx = x, by = y - r * 0.98;
      if (debBadge && !compact) by = peakY;
      else if (debBadge) {
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
      const w = Math.max(2.5, s * 0.07), jt = artTexture(addArtName(jail));
      if (jt) fxArt.put(jt, x, y, r * 1.9, r * 1.9); // 감옥 그림 (37 4장 E-14): 가운데가 비어 파티원 칸이 보임
      else {
        hexPoly(overG, x, y, r * 0.96).fill({ color: 0x4a3f33, alpha: 0.45 });
        for (let k = -2; k <= 2; k++) { const h = k === -2 || k === 2 ? 0.5 : 0.84; overG.moveTo(x + k * r * 0.3, y - r * h).lineTo(x + k * r * 0.3, y + r * h); }
        overG.stroke({ width: w, color: 0xd8c7a8, alpha: 0.75 });
      }
      hexPoly(overG, x, y, r * 0.96).stroke({ width: w * 1.3, color: 0xd8c7a8, alpha: 0.95 });
      if (jail === focusOrder(F)[0]) overG.circle(x, y, r * 0.8).stroke({ width: Math.max(2.5, s * 0.06), color: C.gold, alpha: 0.6 + 0.4 * pulse });
    }
    const bt = F.tels.find(tl => tl.kind === 'buster' && tl.units.includes(u.id));
    const bd = bt ? bt.skill.dmg ?? (bt.skill.greed != null ? bt.skill.greed * (F.armor ? armorFactor(u.role, 'party') : 1) : 0) : 0; // 보물 욕심은 원거리 기준 값 × 직업군 방어력
    if (bt && bd) {
      const sh = u.shield > bt.impact - F.t ? 0.6 : 1; // 맞을 때까지 보호 두루마리가 남아 있으면 -40%
      const dmg = Math.round(bd * F.dmgMult * sh), lethal = dmg >= u.hp + (u.guardian > 0 ? 1e9 : 0);
      pill(overG, labels, `bus${u.id}`, x, y + r * 0.2, `${bt.skill.greed != null ? '금화 ' : ''}-${dmg}`, lethal ? C.danger : bt.skill.greed != null ? C.gold : 0xffb25b, C.dark, fs(0.3, 11));
    }
    // 띄워 올리기 · 연쇄 번개 예고 (56 5장 화면): 칸 아래 회오리 · 위 번개 구름 + 남은 초
    const lc = F.tels.find(tl => (tl.skill.lift || tl.skill.chain) && !tl.fake && tl.units.includes(u.id));
    if (lc) {
      const col = lc.skill.lift ? SKY : BOLT, left = Math.max(0, Math.ceil(lc.impact - F.t));
      const gt = artTexture(lc.skill.lift ? 'fx-lift-warn' : 'fx-chain-cloud');
      if (gt) fxArt.put(gt, x, lc.skill.lift ? y + r * 0.55 : y - r * 0.75, r * 1.3, r * 0.9, 0.75 + 0.25 * pulse);
      else if (lc.skill.lift) dashCircle(overG, x, y + r * 0.5, r * 0.5, 5, 4, Math.max(2, s * 0.06), col, 0.6 + 0.4 * pulse);
      else overG.ellipse(x, y - r * 0.8, r * 0.42, r * 0.18).fill({ color: 0x4a4e66, alpha: 0.85 }).stroke({ width: 2, color: col, alpha: 0.6 + 0.4 * pulse });
      pill(overG, labels, `lc${u.id}`, x, y + r * 0.2, `${lc.skill.lift ? '돌풍' : '번개'} ${left}`, col, C.dark, fs(0.26, 11));
    }
    if (busterIds.has(u.id)) {
      // 중앙 십자선은 이름과 HP를 지나지 않는다. 상단 타깃 표식과 바깥 위험 링으로 예고한다.
      const mark = ringRadius(`buster${u.id}`, 'hex', x, y, r * 1.02, 3);
      hexPoly(overG, x, y, mark).stroke({ width: 3, color: C.tel, alpha: 0.6 + 0.4 * pulse });
    }
    // 차례 (P-ORDER): 은쟁반 번호표, 받은 번호는 꺼지고 다음 번호는 금빛. 직업 그림 왼쪽 (이름을 안 가리게)
    // 신기루 숫자 (54 4-1): 걷히기 전까지 진짜 번호와 똑같이 보임
    const ok = F.order ? (F.order.fake && F.order.fake.id === u.id && F.t < F.order.fake.until ? F.order.fake.num : F.order.ids.indexOf(u.id)) : -1;
    // 보통 칸에 배지가 있으면 윗줄 왼쪽이 배지 자리라 꼭짓점 줄로 (조준 표식이 있으면 그 왼쪽)
    const markAt = (text: string, size: number) => !peakY ? { x: x - r * 0.55, y: y - r * 0.42 }
      : { x: tank === u ? x - aimR - aimW / 2 - 1 - (measure(text, size) + size * 0.7) / 2 : x, y: peakY };
    if (F.order && ok >= F.order.i) { const m = markAt(ORDER_NUM[ok], fs(0.3, 12)); pill(overG, labels, `ord${u.id}`, m.x, m.y, ORDER_NUM[ok], ok === F.order.i ? C.gold : 0xd9dde6, C.dark, fs(0.3, 12), ok === F.order.i ? 0.75 + 0.25 * pulse : 1); }
    else if (u.debuffs.some(d => d.invert)) { const m = markAt('✕', fs(0.28, 11)); pill(overG, labels, `inv${u.id}`, m.x, m.y, '✕', 0x7fa88c, C.dark, fs(0.28, 11)); }
    if (F.t < u.wrongUntil && F.t > u.wrongUntil - 0.6) pill(overG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '?', C.gold, C.dark, fs(0.28, 11));
    else if (F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) pill(overG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '!', 0xff5a3d, C.dark, fs(0.28, 11));
    const st = u.lift ? ([`하늘 ${Math.max(0, Math.ceil(u.lift.until - F.t))}`, '#9FD8F5'] as const) : u.bulwark > 0 ? ([`버팀 ${Math.ceil(u.bulwark)}`, '#F0C46A'] as const) : u.pulled ? ([`끌림 ${Math.ceil(u.pulled.until - F.t)}`, '#C98B5A'] as const) : u.fleeing ? (['도망', '#DB9B57'] as const) : u.sulking ? (['삐짐', '#D68FA6'] as const) : null;
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

  // 실제 최종 HP·이름·상태 표시를 먼저 보호한다. 일시 연출은 다른 연출과도 겹치지 않는다.
  const transientOccupied: PillBox[] = decorationBounds.filter(b => ['hp', 'nick', 'hot', 'debuff', 'role', 'aggro', 'pill'].includes(b.kind));
  // 떠오르는 숫자
  B2.floats = B2.floats.filter(fl => now - fl.t0 < 900 && (!S.reducedEffects || fl.label));
  // 자기 칸 근처 = 원래 자리에서 0.9r 안 + 다른 파티원 칸보다 자기 칸에 가까움. 10·20인 작은 칸은 칸 안이 이름·체력으로 차서
  // 예전에는 숫자가 판 아래 빈칸이나 다른 사람 칸 옆까지 밀려났다 (2026-10-10 검수, 20인 S25 최대 12.8r)
  const partyAt = F.party.filter(u => u.alive).map(u => ({ id: u.id, ...unitPos(u) }));
  for (const fl of B2.floats) {
    const k = (now - fl.t0) / 900;
    const size = fl.label ? fs(0.22, 10) : fl.crit ? fs(0.36, 14) : fl.over || fl.fill ? fs(0.22, 10) : fs(0.27, 11);
    const label = tops.put(`fl${fl.n}`, fl.text, { size, fill: fl.fill ?? (fl.crit ? C.crit : fl.over ? C.over : C.heal), strokeW: 3, num: !fl.fill }, fl.x, S.reducedEffects ? fl.y : fl.y - k * s * (fl.label ? 0.3 : 0.6), S.reducedEffects ? 1 : 1 - k * k, 1);
    const b = label.getBounds(), x = (b.minX + b.maxX) / 2, y = (b.minY + b.maxY) / 2;
    const own = partyAt.find(q => q.id === fl.id), others = own ? partyAt.filter(q => q !== own && Math.hypot(q.x - own.x, q.y - own.y) < s * 4) : [];
    const near = own ? (px: number, py: number) => {
      if ((px - x) ** 2 + (py - y) ** 2 > (r * 0.9) ** 2) return false;
      const d = (px - own.x) ** 2 + (py - own.y) ** 2;
      return others.every(q => (px - q.x) ** 2 + (py - q.y) ** 2 > d);
    } : undefined;
    const box = { x, y, w: b.maxX - b.minX, h: b.maxY - b.minY };
    // 자리가 없으면 자기 직업 아이콘 위는 덮어도 됨 (칸 색이 직업을 보여 줌). 작은 칸 가운데 사람은 이 자리뿐
    const p = transientSpot(box, transientOccupied, near)
      ?? (own ? transientSpot(box, transientOccupied.filter(o => (o as DecorationBound).key !== `role${own.id}`), near) : null);
    if (!p) { label.visible = false; continue; }
    label.position.set(label.x + p.x - x, label.y + p.y - y);
    recordBound(`float${fl.n}`, 'float', 'text', p.x, p.y, p.w, p.h, fl.id != null ? { uid: fl.id } : {});
    transientOccupied.push(p);
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
  // 말풍선 (동시에 최대 3개, 04 10장). 그림 (43 5장): 틀 9조각 ui-bubble-<종류> · 꼬리 ui-bubble-tail-<종류> · 왼쪽 감정 아이콘 · 이펙트 띠.
  // 그림이 없으면 앱이 그린 둥근 네모 + 꼬리
  B2.bubbles = B2.bubbles.filter(b => now - b.t0 < b.life);
  for (const b of B2.bubbles) {
    const u = F.party.find(x => x.id === b.id); if (!u) continue;
    const p = unitPos(u);
    // 감정 아이콘 자리는 그림 파일이 있으면 처음부터 잡아 둠 (읽는 동안 너비가 바뀌지 않게)
    const emote = b.emote ? `emote-${b.emote}` : '', iw = emote && art(emote) ? EMOTE_W : 0;
    const text = fitPartyName(b.text, Math.max(1, L.right - L.left - 16 - iw), value => measure(value, 12, FONT, '500'));
    const age = now - b.t0, st = BUBBLE[b.kind];
    const a = S.reducedEffects ? 1 : Math.max(0, Math.min(1, (b.life - age) / 300));
    const label = tops.put(`bb${b.id}`, text, { size: 12, fill: C.dark, weight: '500' }, 0, 0, a);
    const textBounds = label.getBounds();
    const w = Math.max(measure(text, 12, FONT, '500'), label.width) + 14 + iw, h = Math.max(22, label.height + 3);
    let by = p.y - r - h - 6;
    if (by < L.top + 1) by = p.y + r + 6;
    // 몸체뿐 아니라 꼬리·stroke와 위기 흔들림의 전체 이동 폭을 먼저 확보한다.
    // 꼬리는 회피로 옮겨진 최종 위치에서 화자 쪽을 향하므로 위·아래 양쪽 여유를 둔다.
    const tail = 5, strokePad = st.lw, shakeRange = b.kind === 'alert' && !S.reducedEffects && age < 300 ? 1.5 : 0;
    const bp = transientSpot({ x: p.x, y: by + h / 2,
      w: w + 2 * (strokePad + shakeRange), h: h + 2 * (tail + strokePad) }, transientOccupied);
    if (!bp) { label.visible = false; continue; }
    const shake = shakeRange ? Math.sin(age / 25) * shakeRange : 0;
    const bx = bp.x - w / 2 + shake;
    by = bp.y - h / 2;
    const frame = artTexture(`ui-bubble-${b.kind}`), box = artBoxes.get(`ui-bubble-${b.kind}`);
    const k = frame && box ? bubbleFrame(frame, box, bx, by, w, h, a) : 0;
    if (!k) topG.roundRect(bx, by, w, h, 8).fill({ color: st.fill, alpha: a * st.fillA }).stroke({ width: st.lw, color: st.line, alpha: a });
    // 말한 사람 칸 쪽 꼬리. strokePad는 V 꼭짓점의 miter와 끝점까지 포함한다.
    const below = bp.y >= p.y, tt = k ? bubbleTail(b.kind) : null;
    const tx = Math.max(bx + (tt ? 11 : 9), Math.min(bx + w - (tt ? 11 : 9), p.x)), ty = below ? by : by + h, td = below ? -tail : tail;
    if (tt) {
      // 꼬리 그림: 너비 10px, 열린 윗변을 틀 테두리(약 2px)에 겹쳐 붙임 → 틀 밖으로는 tail 안쪽만. 칸 아래에 뜨면 위아래 뒤집음
      const lip = Math.max(1.5, 9 * k), th = Math.min((10 * tt.height) / tt.width, tail + lip), tw = (th * tt.width) / tt.height;
      bubbleFront.put(tt, tx, below ? ty + lip - th / 2 : ty - lip + th / 2, tw, below ? -th : th, a);
    } else {
      topG.poly([tx - 4.5, ty, tx + 4.5, ty, tx, ty + td]).fill({ color: st.fill, alpha: a * st.fillA });
      topG.moveTo(tx - 4.5, ty).lineTo(tx, ty + td).lineTo(tx + 4.5, ty).stroke({ width: st.lw, color: st.line, alpha: a });
    }
    // 감정 아이콘 (43 4장 B): 말풍선 왼쪽 안 16px, 글자는 그만큼 오른쪽으로
    const et = iw ? artTexture(emote) : null;
    if (et) bubbleFront.put(et, bx + 5 + iw / 2, bp.y, iw, iw, a);
    label.position.set(bp.x + shake + iw / 2 - (textBounds.minX + textBounds.maxX) / 2, bp.y + 0.5 - (textBounds.minY + textBounds.maxY) / 2);
    recordBound(`bubble-text${b.id}`, 'bubble', 'text', bp.x + shake + iw / 2, bp.y + 0.5, textBounds.maxX - textBounds.minX, textBounds.maxY - textBounds.minY);
    recordBound(`bubble${b.id}`, 'bubble', 'rect', bp.x + shake, bp.y + td / 2, w + 2 * strokePad, h + tail + 2 * strokePad);
    transientOccupied.push(bp);
    // 이펙트 띠 (43 4장 C, 효과 줄이기면 안 씀): 뜰 때 퐁 (가운데, 글자 아래) · 위기 둘레 흔들림 (가운데 빈 곳 = 말풍선) · 승리 한마디 꽃가루 (틀 뒤)
    if (!S.reducedEffects) {
      talkFx(bubbleFront, 'pop', age, bp.x + shake, bp.y, h * 2, h * 2, `bubble-pop${b.id}`, a);
      const sk = b.kind === 'alert' ? artTexture('fx-talk-shake') : null;
      if (sk) {
        const fw = sk.height * TALK_FX.shake.fw, hole = artBoxes.get('fx-talk-shake') ?? { w: fw * 0.6, h: sk.height * 0.5 };
        talkFx(bubbleFront, 'shake', age, bp.x + shake, bp.y, (fw * (w + 4)) / hole.w, (sk.height * (h + 4)) / hole.h, `bubble-shake${b.id}`, a);
      }
      if (b.cheer) talkFx(bubbleBack, 'cheer', age, bp.x, bp.y - h * 0.3, h * 3, h * 3, `bubble-cheer${b.id}`, a);
    }
  }

  for (let i = glowUsed; i < glows.length; i++) glows[i].visible = false;
  for (let i = hexFramesUsed; i < hexFrames.length; i++) hexFrames[i].visible = false;
  for (let i = sliceUsed; i < slices.length; i++) slices[i].visible = false;
  labels.end(); badgeLabels.end(); tops.end(); decals.end(); fxArt.end(); bubbleBack.end(); bubbleFront.end();
  for (let i = stripUsed; i < strips.length; i++) strips[i].visible = false;
  lensL.visible = false;
  app.renderer.render(app.stage);
  // 20인 탭 확대 미리보기 0.3초 (02 3-1): 손가락에 가리지 않게 칸 위쪽에 1.8배로
  if (B2.lens && now - B2.lens.t0 < 300) drawLens(now); else B2.lens = null;
  // Canvas-local CSS px. 실제 표시 위치/크기만 기록하며 전투·입력 상태를 수정하지 않는다.
  const metrics = JSON.stringify(decorationBounds.map(b => Object.fromEntries(Object.entries(b).map(([key, value]) => [key, typeof value === 'number' ? +value.toFixed(3) : value]))));
  if (cv.dataset.decorationBounds !== metrics) cv.dataset.decorationBounds = metrics;
}

function nick(u: Unit, x: number, y: number, r: number): { x: number; y: number; w: number; h: number } {
  // 글자 크기는 칸 크기를 따름 (cellTypography, 9px 이상). 넘치면 말줄임, 전체 이름은 길게 누르기 정보에도 남는다.
  const maxW = r * 1.45;
  const size = cellTypography(L.s).nick;
  const text = fitPartyName(u.nick, maxW, text => measure(text, size));
  return fitLabel(labels.put(`nk${u.id}`, text, { size, fill: C.ink, strokeW: size < 11 ? 1.5 : 2 }, x, y), `nick${u.id}`, 'nick');
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
