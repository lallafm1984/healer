/**
 * 전투 판 그리기 (PixiJS, WebGL → 안 되면 Canvas). 20 4-1: 전투 화면은 캔버스에만 그리고 매 프레임 HTML은 안 고침.
 * 칸 = 체력 물통 · 역할 아이콘 · 닉네임 · 체력 숫자 · 디버프 테두리 (16 9장 2번: 파티원 그림 없음). 「나」 칸은 역할 아이콘 대신 직업 문장 (27 3-4).
 * 이펙트 (16 4-6): 힐 = 부드러운 빛 + 별 반짝이(사제 금·흰), 치명타 = 반짝이 2배 + 큰 별, 큰 피격 = 날카로운 빨간 자국.
 * 칸 위 이펙트는 0.4초 안에 사라지고 체력 숫자·디버프 테두리 아래에 그림.
 * 그림 (37 v0.2): 판 위 적·영혼 칸 그림(mob-), 칸 무늬(fx-cell-), 사슬 띠(fx-link-), 이펙트(fx-)가 src/art에 있으면 그 그림을, 없으면 지금 벡터 그림을 씀.
 * 스킬 · 전투 공통 이펙트 (battle/pxf.ts): 휠 스킬이 들어가면 손그림풍 프레임 띠 (fx-skill-*, 2026-10-16 도트에서 바꿈)를 대상 · 범위 · 파티 칸에서 재생 (그 칸의 치유 빛 대신). 다른 이펙트와 달리 판 맨 위 (글자·아이콘보다 위).
 * 보스 판 전체 공격 (외침 · 땅 울림 …)은 판 너비로 크게 한 번 (pxfWide).
 */
import { Application, BitmapFont, BitmapText, Container, Graphics, GraphicsPath, Matrix, NineSliceSprite, Rectangle, RenderTexture, Sprite, Text, Texture, TilingSprite, type TextStyleFontWeight } from 'pixi.js';
import { art } from '../art';
import { CLASSES, type ClassKey } from '../data/classes';
import { SKILLS } from '../data/skills';
import { TALENT_DEF } from '../data/talents';
import { NAMED, SPECS, type SpecGroup } from '../data/specials';
import { aggroTarget, areaRadius, focusOrder, hexDist, ORDER_NUM, busterOn, slotKey, type Telegraph, type TelKind, type Unit } from '../engine';
import type { TotemKind } from '../engine/types';
import type { HeroKey } from '../data/heroes';
import { absorbLeft, HEALER_SHIELD } from '../engine/abilities';
import { asleep, CONSTELLATION, starMax, starsNow } from '../engine/astro';
import { raining } from '../engine/shaman';
import { sealed } from '../engine/warder';
import { emblemColor } from '../screens/art';
import { CLASS_GLYPH, CUT, EDGE, LINE } from '../screens/class-icons';
import { FACTIONS, type FactionKey } from '../data/places';
import { addArtName, RELAY_D, emblemSrc, holeArtName, ringArtName, soulArtName, zoneArtName, bossFxArt, bossFxArts, darkArt, debuffFxArt, tideArtName, tideTail } from './art';
import { $, B, DEB, dirSlot, DIR_DEG, ROLE, S, SEL, ui } from './core';
import { cellTypography, debuffDisplay, fitPartyName, hotTimersOf, hpLabelText, primaryDebuff, shieldTimerOf } from './party-display';
import { CELL_RADIUS, fitBoard, hotTimerLayout, shieldTimerLayout } from './board-layout';
import { DEBUFF_EDGE, GIM_ICON, MARK_ART } from './board-marks';
import { BOARDS } from '../data/boards';
import { makeCells } from '../engine/board';
import { ALWAYS_FX, BOSS_PXF, bossPxfOf, COMMON_PXF, heroSkillFx, isBossPxf, PXF, pxfArtName, pxfCell, pxfCrop, pxfDrawSize, pxfFrame, pxfMs, type CommonFx, type PxfKey } from './pxf';

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
/** 묶음 G (59 5장): 어둠물 검보라 · 물결 · 빌린 생명 보라 (심연의 정예 #8A7CFF) */
// 빚 띠는 어둠물 물선과 다른 자홍빛 보라 (2026-10-16 QA: 「잠기면 빚 2배」로 함께 걸리는데 같은 색이었음)
const TIDE = 0x241a4d, TIDE_HI = 0x8a7cff, DEBT = 0xb456d6, DEBT_HI = 0xf0cdfa;
/** 묶음 H 밀물 물 색 (63 E 6 · 13, tideTail): 짠물 청록 · 독 연못 초록 */
const TIDE_TINT: Record<string, [number, number]> = { sea: [0x1f8f8b, 0x9ff3ec], poison: [0x2f5a24, 0x3cc24a] };
const C = {
  cell: 0x15120e, cellLine: 0x2c241b, line: 0x080605, ink: 0xf1e4c8, dead: 0x8a7f6a, gold: 0xf0c46a, white: 0xffffff,
  zone: 0xe2402e, zoneHi: 0xff6a4a, tel: 0xff4a3d, danger: 0xff3b30, tankMark: 0xff6a60, teal: 0x51c6c0, heal: 0x8cf29c, crit: 0x4dff7c, over: 0xa99a7e,
  /**
   * 보호막 (2026-10-16 Lim 「실드는 파란색」): 떠오르는 숫자 · 시간 원. 치유 민트 · 초록과 다른 파랑.
   * 원은 짙은 코발트 + 흰 숫자: 물방울 지속 힐 원 (밝은 하늘색 + 검은 숫자) · 마법 디버프 배지 (#3D8BFF 캡슐 + 검은 글자)와 밝기 · 글자색으로 구분
   */
  shield: 0x66a6ff, shieldFill: 0x1f55c8,
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
/** 칸 위에 선 물건 (주술사 샘 토템, 2026-10-16 Lim): 칸 가운데 고정, 파티원 칸 채움 (직업 색) 위 · 직업 아이콘 · 이름 · 체력 · 배지 · 이펙트 아래 */
const standL = new Container();
const glowL = new Container();
const fxG = new Graphics();
const frameL = new Container();
const overG = new Graphics();
const labelsL = new Container();
/** 버프·디버프 배지 바탕과 글자는 함께 이름·체력 글자보다 위에 그린다. */
const badgeG = new Graphics();
const badgeL = new Container();
const topG = new Graphics();
const topL = new Container();
const lensL = new Container();
/** PXF 이펙트 (battle/pxf.ts): Lim 2026-10-11 「모든 UI보다 위」 → 글자·아이콘·배지·숫자·말풍선·확대 미리보기보다 위, 판 맨 위 */
const pxfL = new Container();
/** 떠오르는 회복 · 보호막 · 피해 숫자만 PXF 위 (2026-10-16 Lim 「비구름 회복량이 안 보임」: 칸마다 뜨는 구름 그림이 숫자를 덮음). 능력 이름 · 부활 글자는 topL 그대로 */
const numL = new Container();
const emblemL = new Container();
/** 칸 무늬 · 판 위 적 그림 (칸 채움 위, 파티원 칸 아래) · 그림 이펙트 (파티원 칸 위, 테두리·글자 아래) */
const decalL = new Container();
const fxArtL = new Container();
/** 칸 위 작은 그림 표시 (빛의 전이): 테두리 위, 글자 아래 */
const markL = new Container();
/** 칸 테두리 그림 (2026-10-16 검수, fx-edge-* 띠 · fx-ring-* 고리): 디버프 · 힐러 표시 · 강타 예고 · 장판 위 사람. 도형 테두리 (overG) 바로 위, 작은 표시 · 글자 아래 */
const ringL = new Container();
/**
 * 칸 위 상태 그림 (걸린 동안 겹침 · 부풀기 거품 · 포자 솜뭉치 · 모자 · 떠도는 안개 · 결계 · 별의 잠 · 감옥 · 띄워 올리기 · 번개 구름):
 * 2026-10-16 Lim 「테두리는 상태 그림보다 아래」 → 칸 테두리 (도형 overG · 그림 ringL) 바로 위. 그 위에 overTopG (탱커 조준 · 칸 아래 알약 · ? !), 작은 표식 · 글자
 */
const statusArtL = new Container();
const overTopG = new Graphics();
/** 말풍선 그림 (43 5장): 틀 뒤 이펙트 띠 · 틀 9조각 · 꼬리·감정 아이콘·앞 이펙트 띠. 대사 글자(topL)는 그 위 */
const bubbleL = new Container(), bubbleBackL = new Container(), sliceL = new Container(), bubbleFrontL = new Container();
bubbleL.addChild(bubbleBackL, sliceL, bubbleFrontL);
root.addChild(cellsG, decalL, unitsG, standL, glowL, fxG, fxArtL, frameL, overG, ringL, statusArtL, overTopG, markL, emblemL, labelsL, badgeG, badgeL, topG, bubbleL, topL, lensL, pxfL, numL);

let dpr = 1;
/** 판 그림 좌표 (Pixi root 안). k = 그림 → 화면 배율: 보통 1, 「레이드 판 5인 던전 모양」이면 1보다 작음 (화면 좌표 = 그림 좌표 × k) */
export const L = { s: 40, W: 0, H: 0, ox: 0, oy: 0, left: 2, right: 2, top: 2, bottom: 2, ok: false, k: 1 };
/** 5인 던전 판 (b10) 칸 자리: 5인 던전 모양 보기에서 이 화면의 5인 칸 크기를 잴 때 */
const FIVE_CELLS = makeCells(BOARDS.b10);

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
  for (const n of MARK_ART) artTexture(n); // 칸 테두리 · 표식 그림 (2026-10-16 검수): 처음 나올 때 도형으로 잠깐 보이지 않게
  for (const k of ALWAYS_FX) artTexture(pxfArtName(k)); // 전투 공통 효과 · 파티원 능력은 첫 효과부터 보이게 (보스 판 전체 공격 · 직업 스킬 이펙트는 전투마다 resetBoardFx)
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
  // 모든 판 = 5인 던전 모양 (2026-10-11 Lim 비교용 설정 → 2026-10-16 Lim 「모든 전투에서 기본, 레이드 전용 판은 제거」):
  // 10 · 20인 칸을 이 화면의 5인 던전 칸 크기로 그리고 판 전체(root)를 칸 크기 비율만큼 줄임. 탐험 (3인) 칸은 5인보다 커서 그대로.
  // 칸 모양 (배치 · 글자 크기 · 배지 · 아이콘 · 테두리 · 이펙트)은 칸 크기 하나로만 정해지므로 5인 칸과 똑같은 모양이 비율대로 작아짐
  const five = fitBoard(FIVE_CELLS, r.width, r.height, { left, right }).s;
  const k = five > s ? s / five : 1;
  if (k !== L.k) { labels.clear(); badgeLabels.clear(); tops.clear(); nums.clear(); } // 글자 해상도를 새 배율에 맞춤
  Object.assign(L, layout, { ok: true, k });
  if (k < 1) Object.assign(L, { s: five, W: layout.W / k, H: layout.H / k, ox: layout.ox / k, oy: layout.oy / k, left: layout.left / k, right: layout.right / k, top: layout.top / k, bottom: layout.bottom / k });
  root.scale.set(k);
  // 실제 표시 크기만 노출: viewport 회귀 검수에서 CSS px 기준으로 확인한다.
  const type = cellTypography(L.s);
  Object.assign(cv.dataset, {
    cellScale: s.toFixed(2), cellWidth: (s * CELL_RADIUS * Math.sqrt(3)).toFixed(2), cellHeight: (s * CELL_RADIUS * 2).toFixed(2),
    hpFontSize: (type.hp * k).toFixed(2), nickFontSize: (type.nick * k).toFixed(2),
    cellLook: k < 1 ? 'five' : 'own', drawScale: k.toFixed(4),
    boardSafeLeft: layout.left.toFixed(2), boardSafeRight: layout.right.toFixed(2),
    boardSafeTop: layout.top.toFixed(2), boardSafeBottom: layout.bottom.toFixed(2),
    boardInsetLeft: left.toFixed(2), boardInsetRight: right.toFixed(2), boardFitAxis: layout.axis,
  });
  sizeKey++;
}
let sizeKey = 0;

export const center = (i: number) => { const c = B.F!.cells[i]; return { x: L.ox + c.px * L.s, y: L.oy + c.py * L.s }; };
/** 칸 가운데의 화면 좌표 (캔버스 CSS px). HTML을 칸에 맞출 때 · 터치 거리를 잴 때 */
export const screenCenter = (i: number) => { const p = center(i); return { x: p.x * L.k, y: p.y * L.k }; };
export function unitPos(u: Unit): { x: number; y: number } {
  if (u.moving) {
    const a = center(u.moving.from), b = center(u.moving.to);
    let p = 1 - u.moving.left / u.moving.total; p = p * p * (3 - 2 * p);
    return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
  }
  return center(u.cell);
}
/** 터치 판정은 칸보다 10% 크게 (기획서 3-1). x · y = 화면 좌표 (캔버스 CSS px) */
export function hit(x: number, y: number): number {
  const F = B.F;
  if (!F || !L.ok) return -1;
  x /= L.k; y /= L.k;
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
/** 어둠물 물결 두 줄 (칸 안, 천천히 흐름) */
function waves(g: Graphics, x: number, y: number, r: number, t: number, w: number, color: number, alpha: number): void {
  for (const k of [-0.18, 0.28]) {
    const yy = y + r * k, n = 8, x0 = x - r * 0.7, dx = (r * 1.4) / n;
    g.moveTo(x0, yy + Math.sin(t * 2 + k * 9) * r * 0.06);
    for (let q = 1; q <= n; q++) g.lineTo(x0 + dx * q, yy + Math.sin(t * 2 + k * 9 + q * 1.3) * r * 0.06);
    g.stroke({ width: w, color, alpha });
  }
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
// ---------- 파티원 직업 아이콘: 편성 화면과 같은 한 벌 (screens/class-icons.ts, 2026-10-13 Lim). SVG 길은 한 번만 읽어 둠 ----------
type GlyphPaths = { fill?: GraphicsPath; line?: GraphicsPath; cut?: GraphicsPath; w: number }[];
const glyphCache = new Map<ClassKey, GlyphPaths>();
function glyphPaths(cls: ClassKey): GlyphPaths {
  let out = glyphCache.get(cls);
  if (!out) {
    out = CLASS_GLYPH[cls].map(p => {
      const m = new Matrix().translate(-12, -12).rotate(((p.rot || 0) * Math.PI) / 180).translate(12 + (p.dx || 0), 12 + (p.dy || 0));
      const path = (d?: string) => (d ? new GraphicsPath(d).transform(m) : undefined);
      return { fill: path(p.fill), line: path(p.line), cut: path(p.cut), w: p.w ?? LINE };
    });
    glyphCache.set(cls, out);
  }
  return out;
}
/** 직업 아이콘 (가운데 x, y · size = 24칸 판 한 변 px): 조각마다 검은 테 → 크림색 → 검은 새김 */
function classGlyph(g: Graphics, cls: ClassKey, x: number, y: number, size: number): void {
  const k = size / 24;
  g.setTransform(k, 0, 0, k, x - 12 * k, y - 12 * k);
  for (const p of glyphPaths(cls)) {
    if (p.fill) g.path(p.fill).stroke({ width: EDGE * 2 * k, color: C.line, join: 'round' });
    if (p.line) g.path(p.line).stroke({ width: (p.w + EDGE * 2) * k, color: C.line, cap: 'round', join: 'round' });
    if (p.fill) g.path(p.fill).fill({ color: C.ink });
    if (p.line) g.path(p.line).stroke({ width: p.w * k, color: C.ink, cap: 'round', join: 'round' });
    if (p.cut) g.path(p.cut).stroke({ width: CUT * k, color: C.line, cap: 'round', join: 'round' });
  }
  g.resetTransform();
}
// ---------- 빛의 전이 (사제 8번째 칸): 빛이 깃든 사람 칸에 금빛 원 + 흰 빛 구슬. 그림 fx-relay (그림 요청 64)가 오면 그것 ----------
let relayTex: Texture | null = null;
function relayMark(): Texture {
  const painted = artTexture('fx-relay');
  if (painted) return painted;
  if (relayTex) return relayTex;
  const N = 96, m = N / 2;
  return (relayTex = canvasTexture(N, N, x => {
    const disc = (r: number, fill: string) => { x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); };
    disc(m, '#080605'); disc(m - 6, '#F0C46A');
    const k = (N - 30) / 24, p = new Path2D(RELAY_D);
    x.translate(15, 15); x.scale(k, k);
    x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = 4.4; x.strokeStyle = '#080605'; x.stroke(p); // 구슬 · 꼬리 줄 테두리
    x.fillStyle = x.strokeStyle = '#FFFAF0'; x.fill(p); x.lineWidth = 2; x.stroke(p);
  }));
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
    const N = 128, m = N / 2;
    emblemTex.set(hero, canvasTexture(N, N, x => {
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
    }));
  };
  img.src = src;
  return null;
}

// ---------- 그림 (37 v0.2): 파일이 있으면 텍스처로 한 번 읽어 둠. 없거나 읽는 중이면 null → 벡터 그림 ----------
// 텍스처는 그림 (img) 자체에서 만든다: 2D 캔버스에 옮겨 그린 텍스처는 폰에서 그래픽 메모리가 모자라 캔버스 내용이 지워지면
// (WebGL 다시 연결 뒤) 빈 그림으로 다시 올라가 이펙트가 안 보였음 (2026-10-11 Lim 빌드 115 「스킬 이펙트 등이 안 나온다」)
const artTex = new Map<string, Texture | null>();
/** 읽기 실패한 그림: 이름 → 다시 읽어도 되는 시각 (ms) · 횟수 */
const artRetry = new Map<string, { at: number; n: number }>();
const ART_RETRY_MAX = 4;
function artTexture(name: string): Texture | null {
  if (!name) return null;
  if (artTex.has(name)) {
    const t = artTex.get(name)!, r = artRetry.get(name);
    if (t || !r || r.n > ART_RETRY_MAX || performance.now() < r.at) return t;
    artTex.delete(name); // 실패한 그림은 잠시 뒤 다시 읽음
  }
  artTex.set(name, null);
  const src = art(name);
  if (!src) return null;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    // 말풍선 틀 · 꼬리는 불투명 영역 (틀 여백 · 꼬리 자르기), 흔들림 띠는 가운데 빈 곳 (말풍선 자리)을 한 번 재 둠 (잰 캔버스는 버림)
    if (name.startsWith('ui-bubble-') || name === 'fx-talk-shake') {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      try {
        const g = c.getContext('2d', { willReadFrequently: true });
        if (g) {
          g.drawImage(img, 0, 0);
          if (name.startsWith('ui-bubble-')) artBoxes.set(name, opaqueBox(g, c.width, c.height));
          else artBoxes.set(name, holeBox(g, c.height * TALK_FX.shake.fw, c.height));
        }
      } catch { /* 픽셀을 못 읽으면 그림 전체 크기로 */ }
      c.width = c.height = 0;
    }
    artTex.set(name, Texture.from(img));
    artRetry.delete(name);
    artLoaded.add(name);
  };
  img.onerror = () => {
    const n = (artRetry.get(name)?.n ?? 0) + 1;
    artRetry.set(name, { at: performance.now() + 500 * n, n });
    console.warn(`[board] 그림을 못 읽음 ${name} (${n}번째)`);
  };
  img.src = src;
  return null;
}
/** 읽어 둔 그림 이름 (화면 테스트 · 진단용) */
const artLoaded = new Set<string>();
/** 읽어 둔 그림을 내려 놓음 (그래픽 메모리를 돌려줌, 다시 쓰면 artTexture가 새로 읽음) */
function dropArt(name: string): void {
  const t = artTex.get(name);
  artTex.delete(name); artRetry.delete(name); artLoaded.delete(name);
  for (const [k, sub] of subTex) if (k.startsWith(`${name}#`)) { subTex.delete(k); sub.destroy(false); }
  t?.destroy(true);
}
/** 2D 캔버스로 그려 만든 텍스처. 폰에서 캔버스 내용이 지워지면 (contextrestored) 다시 그려 올림 */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const paint = (): void => { const g = c.getContext('2d'); if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); draw(g); } };
  paint();
  const tex = Texture.from(c);
  c.addEventListener('contextrestored', () => { paint(); tex.source.update(); });
  return tex;
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
  put(tex: Texture, x: number, y: number, w: number, h: number, alpha = 1, tint = 0xffffff, rot = 0, blend: 'normal' | 'add' = 'normal'): void {
    let sp = this.list[this.used];
    if (!sp) { sp = new Sprite(); sp.anchor.set(0.5); this.list.push(sp); this.layer.addChild(sp); }
    this.used++;
    sp.texture = tex; sp.visible = true; sp.position.set(x, y); sp.scale.set(w / tex.width, h / tex.height);
    sp.rotation = rot; sp.alpha = alpha; sp.tint = tint; sp.blendMode = blend;
  }
  end(): void { for (let i = this.used; i < this.list.length; i++) this.list[i].visible = false; }
}
const ringArt = new SpritePool(ringL), statusArt = new SpritePool(statusArtL);
const decals = new SpritePool(decalL), fxArt = new SpritePool(fxArtL), marks = new SpritePool(markL), stands = new SpritePool(standL), pxfArt = new SpritePool(pxfL), bubbleBack = new SpritePool(bubbleBackL), bubbleFront = new SpritePool(bubbleFrontL);
/**
 * 칸 테두리 · 표식 그림 (2026-10-16 Lim 「원형으로 표시하던 것들은 알기 쉽게 이미지화」, 89 문서 · QA · 디자이너 검수):
 * fx-edge-* = 가로 띠 그림 (위 = 칸 바깥쪽)을 육각 여섯 변에 한 장씩 → 칸 모양 그대로 맞음. fx-ring-* = 둥근 고리 한 장.
 * 그림이 아직 안 읽혔으면 앞의 도형 테두리를 그대로 그림
 */
function edgeRing(name: string, x: number, y: number, R: number, band: number, alpha = 1): boolean {
  const tex = artTexture(name);
  if (!tex) return false;
  const pts = hexPts(x, y, R);
  // 꼭짓점 이음매가 비지 않게 변 길이보다 조금 길게 (띠 끝은 그림에서 흐려짐). hexPts는 시계 방향 → 그림 아래 (+y)가 칸 안쪽을 향함
  for (let k = 0; k < 6; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % 6];
    ringArt.put(tex, (ax + bx) / 2, (ay + by) / 2, R * 1.16, band, alpha, 0xffffff, Math.atan2(by - ay, bx - ax));
  }
  return true;
}
function roundRing(name: string, x: number, y: number, R: number, alpha = 1): boolean {
  const tex = artTexture(name);
  if (!tex) return false;
  ringArt.put(tex, x, y, R * 2, R * 2, alpha);
  return true;
}
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
          text, resolution: dpr * L.k, // 줄여 그리는 판은 화면 픽셀만큼만
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
const nums = new Labels(numL);
// 웹 글꼴이 늦게 오면 글자·숫자 글꼴을 다시 만듦
document.fonts?.addEventListener?.('loadingdone', () => { labels.clear(); badgeLabels.clear(); tops.clear(); nums.clear(); if (ready) installNumFont(); });

const mctx = document.createElement('canvas').getContext('2d')!;
function measure(text: string, size: number, font = FONT, weight = W_TEXT): number { mctx.font = `${weight} ${size}px ${font}`; return mctx.measureText(text).width; }

const COS30 = Math.sqrt(3) / 2;
/** 기록 값 중 길이 (화면 px로 바꿀 것) */
const BOUND_LEN = new Set(['x', 'y', 'w', 'h', 'left', 'right', 'top', 'bottom', 'radius', 'requestedRadius', 'diameter', 'requestedDiameter']);
interface DecorationBound {
  key: string; kind: string; shape: string; x: number; y: number; w: number; h: number;
  left: number; right: number; top: number; bottom: number;
  radius?: number; requestedRadius?: number; diameter?: number; requestedDiameter?: number;
  /** 떠오르는 숫자가 가리키는 파티원 */
  uid?: number;
  /** PXF 이펙트 프레임 번호 · 회색 그림에 곱한 색 */
  frame?: number; tint?: number;
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
/** 글자 상자를 판 그림 좌표로. getBounds()는 화면 좌표라 판을 줄여 그릴 때(L.k < 1)는 배율로 나눔 */
function boundsOf(t: Container): { minX: number; maxX: number; minY: number; maxY: number } {
  const b = t.getBounds(), k = L.k;
  return { minX: b.minX / k, maxX: b.maxX / k, minY: b.minY / k, maxY: b.maxY / k };
}
/** 실제 Pixi 글자 bounds(획·anchor·가로 압축 포함)를 기준으로 위치만 안쪽으로 옮긴다. */
function fitLabel(label: Label, key: string, kind: string): { x: number; y: number; w: number; h: number } {
  let b = boundsOf(label);
  const available = L.right - L.left;
  if (b.maxX - b.minX > available) { label.scale.x *= available / (b.maxX - b.minX); b = boundsOf(label); }
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const p = fitCenter(mid.x, mid.y, w / 2, h / 2);
  label.position.set(label.x + p.x - mid.x, label.y + p.y - mid.y);
  recordBound(key, kind, 'text', p.x, p.y, w, h);
  return { ...p, w, h };
}
interface PillBox { x: number; y: number; w: number; h: number }
/** (x, y) 가운데 w × h 상자가 occupied 어느 것과도 1px 넘게 떨어져 있음 */
function clearOf(occupied: readonly PillBox[], x: number, y: number, w: number, h: number): boolean {
  return occupied.every(b => Math.abs(x - b.x) >= (w + b.w) / 2 + 1 || Math.abs(y - b.y) >= (h + b.h) / 2 + 1);
}
/**
 * 보조 연출만 실제 글자/상태 bounds를 피한다. 빈 자리가 없으면 해당 프레임에서 생략한다.
 * near = 받아 줄 자리 (떠오르는 숫자는 자기 칸 근처만: 멀리 밀려나면 다른 사람 숫자로 읽힘)
 */
function transientSpot(box: PillBox, occupied: readonly PillBox[], near?: (x: number, y: number) => boolean): PillBox | null {
  const { w, h } = box;
  if (w > L.right - L.left || h > L.bottom - L.top) return null;
  const origin = fitCenter(box.x, box.y, w / 2, h / 2);
  const clear = (x: number, y: number) => clearOf(occupied, x, y, w, h);
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
/** 겹친 넓이 ÷ b 넓이 (0~1) */
function coverOf(a: PillBox, b: PillBox): number {
  const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return ox > 0 && oy > 0 ? (ox * oy) / Math.max(1, b.w * b.h) : 0;
}
/** 말풍선이 덜 가리길 바라는 표시 (가려도 되지만 점수를 깎음): 배지 · 지속 힐 원 · 직업 아이콘 · 어그로 표식 */
const BUBBLE_SOFT: Record<string, number> = { debuff: 3, pill: 2, hot: 2, role: 1, aggro: 1 };
/** 말풍선 자리 순서: 위기 → 기믹·신호 → 반응 · 쓰러진 사람 채팅 */
const BUBBLE_RANK: Record<BubbleKind, number> = { alert: 0, call: 1, talk: 2, chat: 2 };
/** 아직 못 뜬 말풍선이 다른 말풍선이 비켜 주길 기다리는 시간 (ms). 넘으면 버림 (2026-10-11 Lim 「자리가 없으면 말풍선 생략」) */
const BUBBLE_WAIT = 1200;
/**
 * 말풍선 자리 (2026-10-11 Lim 「말풍선 위치가 올바르지 못하다」): 꼬리 끝이 말한 사람 칸의 위 또는 아래 꼭짓점에 닿는 자리만 고른다.
 * 몸통(w × h)은 꼬리가 안에 남는 만큼 좌우로 비킬 수 있음. 이름 · 체력 · 다른 일시 연출(hard)은 절대 안 가리고, 배지 · 아이콘(soft)은 덜 가리는 쪽.
 * 예전엔 판 전체에서 가장 가까운 빈 곳을 찾아 20인에서 20명 중 12~14명의 말풍선이 다른 사람 칸에 더 가깝게 떴다.
 * 돌려주는 x · y = 몸통 가운데, foot = 몸통 · 선(pad) · 말한 사람 쪽 꼬리까지 차지하는 상자. 붙일 자리가 없으면 null
 */
function bubbleSpot(p: { x: number; y: number }, r: number, w: number, h: number, pad: number, tail: number,
  hard: readonly PillBox[], soft: readonly DecorationBound[], others: readonly { x: number; y: number }[]): { x: number; y: number; foot: PillBox } | null {
  const fw = w + 2 * pad, fh = h + 2 * pad + tail;
  if (fw > L.right - L.left) return null;
  const reach = Math.max(0, w / 2 - 11); // 꼬리(몸통 끝에서 11px 안)가 말한 사람 x에 오는 만큼만 비킴
  let best: { x: number; y: number; foot: PillBox } | null = null, score = Infinity;
  for (const below of [false, true]) {
    const y = below ? p.y + r + tail + 1 + h / 2 : p.y - r - tail - 1 - h / 2;
    const fy = y + (below ? -tail / 2 : tail / 2);
    if (fy - fh / 2 < L.top - 0.01 || fy + fh / 2 > L.bottom + 0.01) continue; // 판 밖이면 꼬리가 칸에 안 닿음
    for (const k of [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1]) {
      const x = clamp(p.x + k * reach, L.left + fw / 2, L.right - fw / 2);
      if (Math.abs(x - p.x) > reach + 0.01) continue;
      const foot = { x, y: fy, w: fw, h: fh };
      if (hard.some(o => coverOf(foot, o) > 0)) continue;
      // 몸통 가운데가 다른 파티원 칸에 더 가까우면 그 사람 말로 읽히기 쉬움 → 덜 비키는 쪽
      const d = (x - p.x) ** 2 + (y - p.y) ** 2, stray = others.some(o => (x - o.x) ** 2 + (y - o.y) ** 2 < d) ? 1 : 0;
      const sc = soft.reduce((t, o) => t + (BUBBLE_SOFT[o.kind] ?? 0) * coverOf(foot, o), 0) + stray + (Math.abs(x - p.x) / Math.max(1, reach)) * 0.2 + (below ? 0.15 : 0);
      if (sc < score) { score = sc; best = { x, y, foot }; }
    }
  }
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
/** 칸 아래 꼭짓점 알약 여럿 (상태 · 때리는 적 · 쥐떼): 한 줄에 가로로 나란히, 묶음 가운데가 칸 가운데 (판 밖으로 나가면 묶음째 안쪽으로) */
function lowPills(list: { key: string; text: string; bg: number; fg: number }[], x: number, y: number, size: number): void {
  if (!list.length) return;
  const gap = 2, ws = list.map(p => measure(p.text, size) + size * 0.7 + 1.5), total = ws.reduce((a, w) => a + w, 0) + gap * (list.length - 1);
  let cx = Math.min(Math.max(x, L.left + total / 2 + 0.75), L.right - total / 2 - 0.75);
  if (L.right - L.left < total + 1.5) cx = (L.left + L.right) / 2;
  let left = cx - total / 2;
  list.forEach((p, i) => { pill(overTopG, labels, p.key, left + ws[i] / 2, y, p.text, p.bg, p.fg, size); left += ws[i] + gap; });
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
  return canvasTexture(128, 128, x => {
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  });
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
  kind: 'heal' | 'hit' | 'dispel' | 'death' | 'revive' | 'art' | 'pxf'; id: number; t0: number; crit?: boolean; color?: number; seeds?: number[]; x?: number; y?: number;
  /** PXF 이펙트 (kind 'pxf', battle/pxf.ts). tag = 판 기록 열쇠 앞머리 (전투 공통 효과는 예전 그림과 같은 heal · death …, 없으면 pxf), color = 회색 그림에 곱할 색 */
  pxf?: PxfKey; tag?: string;
  /** 이펙트를 돌려 그림 (라디안): 연쇄 치유 물줄기가 앞 사람 쪽에서 들어오게 */
  rot?: number;
  /** 치유 빛 없이 숫자 · 치명타 별만 (그 칸에 스킬 PXF 이펙트가 나올 때) */
  plain?: boolean;
  /** 기믹 연출 (kind 'art'): 그림 fx-<name>, 칸 · 날아갈 사람 · 판 전체 · 길이(ms) */
  name?: string; cell?: number; to?: number; wide?: boolean; dur?: number;
  /** 줄을 지나가는 연출 (FX_LOOK roll): 그 줄 칸들 */
  row?: number[];
}
/**
 * id = 숫자가 가리키는 파티원 (그 칸 근처에만 뜸). dx · dy = 떠오르기 시작하는 자리, 그 사람 칸 가운데에서 칸 크기 배수 (걸어가는 사람 숫자는 따라감)
 * ox · oy = 자리를 잡으며 떠오르는 길에서 비킨 만큼 (칸 크기 배수, 다음 프레임에도 같은 만큼 비켜 올라감) · at · rise = 지난 프레임에 그린 자리 · 올라간 높이
 */
/** dmg = 받은 피해 빨간 숫자 (big = 체력 1/4 이상 한 방, 회복 숫자 크기) */
interface Float { dx: number; dy: number; text: string; crit: boolean; over: boolean; t0: number; n: number; fill?: number; label?: boolean; id: number; ox?: number; oy?: number; at?: PillBox; rise?: number; shield?: boolean; num?: boolean; dmg?: boolean; big?: boolean }
/** 말풍선 종류 (41·43 문서): talk 반응·잡담 · call 기믹·신호 (금테) · alert 위기 (붉은 테, 흔들림) · chat 쓰러진 사람의 파티 채팅 (회색) */
export type BubbleKind = 'talk' | 'call' | 'alert' | 'chat';
/** emote = 왼쪽 감정 아이콘 emote-<이름> (43 4장 B) · cheer = 승리 한마디 (fx-talk-cheer) */
/** t0 = 보이기 시작한 때 (자리를 기다리는 동안 미뤄짐) · added = 들어온 때 · shown = 한 번이라도 판에 떴음 */
interface Bubble { id: number; text: string; t0: number; added: number; life: number; kind: BubbleKind; emote?: string | null; cheer?: boolean; shown?: boolean }
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
  darkAt = null;
  if (B.F) for (const a of bossFxArts(B.F.enc.script)) artTexture(a); // 묶음 H 이펙트 (63 E): 첫 번째부터 보이게
  if (B.F) for (const a of HERO_BOARD_ART[B.F.hero] ?? []) artTexture(a); // 직업별 판 위 그림
  // 보스 판 전체 공격 (Codex 손그림 256px 띠, 하나에 4–6MB): 이 전투에서 나올 수 있는 것만 읽어 두고 다른 전투 것은 내려 놓음
  const want = new Set((B.F ? bossPxfOf(B.F.enc) : []).map(pxfArtName));
  for (const k of Object.values(BOSS_PXF)) {
    const name = pxfArtName(k!);
    if (want.has(name)) artTexture(name); else if (artTex.has(name)) dropArt(name);
  }
  // 손그림풍 스킬 이펙트 (224px 격자, 하나에 2–5MB): 지금 직업 것만 (첫 스킬부터 보이게), 다른 직업 것은 내려 놓음
  const mine = new Set(B.F ? heroSkillFx(B.F.hero) : []);
  for (const k of Object.keys(PXF) as PxfKey[]) {
    if (isBossPxf(k) || ALWAYS_FX.has(k)) continue;
    const name = pxfArtName(k);
    if (mine.has(k)) artTexture(name); else if (artTex.has(name)) dropArt(name);
  }
}
/**
 * 기믹 연출 (37 4장 F-1): 칸 반지름 배 크기 · 그림이 없을 때 빛 색 · 길이(ms).
 * tint = 흰 그림을 이 색으로 칠함 (사건마다 색이 다르면 그 색), fly = to에게 날아감 (top = 판 위쪽 보스 자리에서), up = 칸 위로 띄움,
 * wide = 판 가운데 크게 한 번 (all이어도), rot = 돌림 (라디안), art = 그림 이름이 fx-<이름>과 다를 때.
 * boss = top 대신 판 위 가운데 (보스 자리)에서, 그림은 가는 쪽을 봄 (왼쪽이면 뒤집고 50°까지만 기욺) · roll = 줄 (row)을 왼쪽 → 오른쪽으로 지나감 · floor = 칸 바닥에 깔림 (파티원 칸 아래)
 */
const FX_LOOK: Record<string, { size: number; color: number; ms?: number; tint?: boolean; fly?: boolean; top?: boolean; up?: number; wide?: boolean; rot?: number; art?: string; boss?: boolean; roll?: boolean; floor?: boolean }> = {
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
  'island-tilt': { size: 3.2, color: SKY, ms: 900, wide: true }, // 묶음 F2 기우는 섬 (그림 57 E)
  // 묶음 G (59 5장, 그림 60 E): 어둠물이 차오름 · 빠짐 (칸마다) · 생명을 빌려줌 (보랏빛 손) · 빚을 갚음 (금빛 동전이 빠져나감) · 남은 빚을 거둬 감
  'tide-rise': { size: 1.5, color: TIDE_HI, ms: 700, up: 0.2 },
  'tide-ebb': { size: 1.2, color: TIDE_HI, ms: 600 },
  'debt-lend': { size: 1.6, color: DEBT, ms: 700 },
  'debt-pay': { size: 0.9, color: 0xffd166, ms: 450, up: 0.5 },
  'debt-collect': { size: 1.9, color: DEBT, ms: 700 },
  // 묶음 G2 (59 4-3, 그림 60 E): 밀물 때 마른 채 남은 물 위 섬 · 장어 꼬리가 물속으로 끌어내림
  'tide-island': { size: 1.3, color: 0xe9d9a6, ms: 800, up: 0.15 },
  'tide-drag': { size: 1.6, color: TIDE_HI, ms: 600 },
  // 묶음 G3 (59 4-4, 그림 60 E): 퍼지는 박동이 지나가는 겹 칸 · 번개 쐐기가 심장에 박힘 (판 전체)
  'pulse-ring': { size: 1.4, color: 0xa66bff, ms: 500 },
  wedge: { size: 3.2, color: BOLT, ms: 900, wide: true },
  // 사제 빛의 전이 (휠 8번째 칸, 그림 요청 64): 깃듦 · 다음 사람에게 옮겨 감 (그림은 빛 구슬이 오른쪽으로 나아감, 꼬리는 왼쪽) · 다 쓰고 사라짐
  'relay-land': { size: 1.2, color: 0xfff3c4, ms: 500 },
  'relay-fly': { size: 0.8, color: 0xfff3c4, ms: 1000, fly: true },
  'relay-gone': { size: 1.1, color: 0xfff3c4, ms: 500, up: 0.5 },
  // 묶음 H (63 E, art.ts BOSS_FX): 광차 · 눈덩이가 줄을 지나감 · 까마귀 떼 · 크림 폭발 · 조용히 (판 전체) · 거품 터짐 · 낟알이 쏟아진 칸
  'minecart-charge': { size: 2.6, color: 0xc98b5a, ms: 700, roll: true },
  'snowball-roll': { size: 2.4, color: 0xdff4ff, ms: 800, roll: true },
  'crow-swarm': { size: 1.5, color: 0x3a3330, ms: 550, fly: true, top: true, boss: true },
  'cream-burst': { size: 3.2, color: 0xf6b8c8, ms: 800, wide: true },
  hush: { size: 3.2, color: 0x9dc4ff, ms: 800, wide: true },
  'bubble-pop': { size: 1.9, color: 0xbfe8ff, ms: 450 },
  'cell-hole-grain': { size: 1, color: 0xe0b44a, ms: 2000, floor: true },
};
/** 이미 터뜨린 장판 (새 장판이 깔리는 순간 한 번 zone-burst) */
const seenZones = new Set<number>();
/**
 * 기믹 연출 하나 (엔진 fx 사건 · 쫄 처치 · 새 장판). all = 살아 있는 모두 (wide 연출은 판 가운데 크게 한 번), color = 흰 그림 칠할 색
 */
export function fxGim(name: string, now: number, at: { cell?: number; id?: number; to?: number; all?: boolean; color?: number; row?: number[] }): void {
  const F = B.F;
  if (!F || !L.ok || S.reducedEffects || B2.fx.length >= 90) return;
  // 메아리 (44 E-4): 진동에 옮겨붙은 디버프면 fx-echo (그림이 없으면 옮겨붙음 그대로)
  if (name === 'fireball-green' && at.to != null && art('fx-echo') && F.party.find(u => u.id === at.to)?.debuffs.some(d => d.end?.p === 'jump' && d.end.on === 'quake')) name = 'echo';
  const sw = bossFxArt(F.enc.script, 'swap', name); // 묶음 H (63 E): 조용히 (시전 끊기) · 거품 터짐
  if (sw) name = sw.slice(3);
  const look = FX_LOOK[name], dur = look?.ms ?? FX_MS;
  // 보스 판 전체 공격 (Lim 2026-10-11 「픽셀 크기를 늘려서」): PXF가 있으면 판 너비로 크게 한 번 (외침은 세력 색)
  const bp = BOSS_PXF[name];
  // 판 전체 공격 PXF (띠를 아직 못 읽었으면 예전 그림)
  if (bp && (at.all || look?.wide) && pxfReady(bp)) { B2.fx.push({ kind: 'pxf', id: -1, t0: now, pxf: bp, dur: pxfMs(PXF[bp]), wide: true, color: at.color ?? look?.color }); return; }
  if (at.all && !look?.wide) { for (const u of F.party) if (u.alive) B2.fx.push({ kind: 'art', name, id: u.id, t0: now, dur, color: at.color }); return; }
  B2.fx.push({ kind: 'art', name, id: at.id ?? -1, cell: at.cell, to: at.to, row: at.row, t0: now, dur, wide: at.all || look?.wide, color: at.color });
}
/** 디버프가 걸림 (44 E-1 fx-debuff, 종류 색으로 칠함: 질병 황토 · 독 초록 · 저주 보라 · 마법 파랑). 딜 0 (침묵)은 fx-silence가 있으면 그것 (E-8) */
export function fxDebuff(u: Unit, dtype: string, now: number): void {
  const d = u.debuffs.reduce<Unit['debuffs'][number] | undefined>((a, x) => (!a || x.id > a.id ? x : a), undefined);
  const silence = !!d?.noDps && d.untilBossLoss == null && !!art('fx-silence'), color = hex(DEB[dtype] || '#E5433D');
  if (silence || S.reducedEffects || !commonFx(u, 'debuff', now, { color })) fxGim(silence ? 'silence' : 'debuff', now, { id: u.id, color });
  // 묶음 H (63 E): 그 기술 디버프가 걸릴 때 까마귀 떼 (보스 자리에서 날아옴) · 크림 폭발 (판 가운데)
  const hitArt = d && B.F ? debuffFxArt(B.F.enc.script, 'hit', d.name) : '';
  if (hitArt) fxGim(hitArt.slice(3), now, { id: u.id });
}
/** 체력을 채워 사라진 디버프 (쇠약 · 완치 표식 · 치유 흡수 막). 묶음 H 얼음 갑옷 (63 E 3)이 녹으면 fx-frost-burst */
export function fxCure(u: Unit, name: string, now: number): void {
  const melt = B.F && !S.reducedEffects ? debuffFxArt(B.F.enc.script, 'cure', name) : '';
  if (melt) fxGim(melt.slice(3), now, { id: u.id });
  else fxDispel(u, now, false, `${name} 사라짐`);
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
  else {
    const color = SPEC_TINT[SPECS[key]?.group ?? 'named'];
    if (S.reducedEffects || !commonFx(u, 'proc', now, { color })) fxGim('proc', now, { id: u.id, color });
  }
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
    const land = tl.fake ? '' : bossFxArt(F.enc.script, 'land', sk.key); // 묶음 H (63 E): 광차 · 눈덩이 · 낟알 (그림이 있을 때만)
    if (land) { landFx(F, land.slice(3), tl, now); continue; }
    if (tl.ring || sk.pads) { if (art('fx-tower-ring')) for (const i of tl.cells) fxGim('tower-ring', now, { cell: i }); }
    else if (kind !== 'aoe') continue;
    else if (sk.key === 'shout' || sk.key === 'howl' || /외침|울부짖|함성/.test(nm)) fxGim('shout', now, { all: true, color: boardFaction ? hex(FACTIONS[boardFaction].color) : undefined });
    else if (nm.includes('등불')) fxGim('lantern', now, { all: true });
    else if (nm.includes('서리 폭발') && art('fx-frost-burst')) fxGim('frost-burst', now, { all: true });
    else if (sk.key === 'gaze' && art('fx-gaze')) for (const u of F.party) if (u.alive && u.debuffs.some(d => d.name === nm)) fxGim('gaze', now, { id: u.id });
  }
}
/** 묶음 H 예고가 떨어짐 (63 E): 줄 피해는 맞는 줄마다 왼쪽 → 오른쪽으로 지나감 (FX_LOOK roll), 칸 무늬는 맞은 칸마다 */
function landFx(F: NonNullable<typeof B.F>, name: string, tl: Telegraph, now: number): void {
  if (!FX_LOOK[name]?.roll) { for (const i of tl.cells) fxGim(name, now, { cell: i }); return; }
  const rows = new Map<number, number[]>();
  for (const i of tl.cells) { const k = F.cells[i].row; rows.set(k, [...(rows.get(k) ?? []), i]); }
  for (const row of rows.values()) fxGim(name, now, { row });
}
const rnd = () => Math.random();
/**
 * 회복 · 보호막 숫자는 모두 여기 (2026-10-16 Lim 「모든 직업 회복량을 같은 색 · 같은 자리」): 일곱 직업 직접 힐 · 지속 힐 틱 · 토템 · 비구름 · 봉화 나눔 · 물약 · 보호막.
 * 자리 = 그 사람 칸 가운데에서 HEAL_AT (칸 크기 배수, 흔들지 않음. 겹치면 아래 떠오르는 숫자 자리 잡기가 비킴),
 * 색 = 보통 민트 · 치명타 초록 (크게) · 거의 다 넘침 회갈색 (작게) · 보호막 파랑 · 뒤집힌 축복 빨강. 엔진 heal() · giveAbsorb()를 거치면 사건이 옴
 */
const HEAL_AT = { dx: 0, dy: -0.3 };
function healNumber(u: Unit, text: string, now: number, o: { crit?: boolean; over?: boolean; shield?: boolean; fill?: number } = {}): void {
  if (B2.floats.length >= 40) return;
  B2.floats.push({ ...HEAL_AT, text, crit: !!o.crit, over: !!o.over, shield: o.shield, fill: o.fill, t0: now, n: B2.n++, id: u.id, num: true });
}
/**
 * plain = 이 칸에 스킬 PXF 이펙트가 나와서 치유 빛은 안 그림 (숫자 · 치명타 별은 그대로). now가 지금보다 뒤면 그때 뜸 (연쇄 치유).
 * tick = 지속 · 간접 회복 (엔진 tick 사건): 숫자만 (빛 · 칸 반짝임은 그 효과 그림이 맡음)
 */
export function fxHeal(u: Unit, eff: number, amt: number, crit: boolean, now: number, plain = false, tick = false): void {
  if (!L.ok || S.reducedEffects) return;
  const over = eff < amt * 0.25; // 거의 다 넘친 힐은 회색으로 작게
  healNumber(u, `+${eff}`, now, { crit: crit && !over, over });
  if (tick) return;
  B2.hitFx[u.id] = now;
  if (B2.fx.length >= 60 || over || (plain && !crit)) return;
  // 모든 효과 PXF 1단계: 치유 빛 (힐러 문장 색) · 치명타 별. 프레임 띠를 아직 못 읽은 것만 예전 그림으로
  const glowDone = plain || commonFx(u, 'heal', now, { color: hex(emblemColor(B.F?.hero ?? 'priest')) });
  const starDone = !crit || commonFx(u, 'crit', now, { tag: 'heal-crit' });
  if (glowDone && starDone) return;
  B2.fx.push({ kind: 'heal', id: u.id, t0: now, crit: !starDone, seeds: Array.from({ length: crit ? 8 : 4 }, rnd), plain: glowDone });
}
/** 스킬 PXF 이펙트 (battle/pxf.ts): 스킬이 들어간 칸에서 맞는 순간부터 끝까지. 파티 전원 스킬은 20인이면 20개라 따로 상한 */
/** 프레임 띠를 읽어 둠 (못 읽었으면 다시 읽기 시작하고 false) */
export const pxfReady = (k: PxfKey): boolean => !!artTexture(pxfArtName(k));
/** 읽어 둔 보스 판 전체 공격 띠 (화면 테스트: 전투마다 그 전투 것만) */
export const bossPxfLoaded = (): PxfKey[] => Object.values(BOSS_PXF).filter((k): k is PxfKey => !!k && artLoaded.has(pxfArtName(k)));
/** PXF 이펙트를 재생 (프레임 띠를 아직 못 읽었으면 안 넣고 false: 부른 쪽이 예전 그림 · 공통 치유 빛을 대신 그림) */
/** 사람 없는 칸에 스킬 PXF 이펙트 (판 위 물건을 세움, 79 6-1) */
export function fxPxfCell(cell: number, pxf: PxfKey, now: number): boolean {
  if (!L.ok || S.reducedEffects || B2.fx.length >= 100 || !pxfReady(pxf) || !B.F?.cells[cell]) return false;
  const p = center(cell);
  B2.fx.push({ kind: 'pxf', id: -1, t0: now, pxf, dur: pxfMs(PXF[pxf]), x: p.x, y: p.y, tag: `cell${cell}-` });
  return true;
}
export function fxPxf(u: Unit, pxf: PxfKey, now: number, o: { color?: number; tag?: string; x?: number; y?: number; rot?: number } = {}): boolean {
  if (!L.ok || S.reducedEffects || B2.fx.length >= 100) return false;
  if (!pxfReady(pxf)) return false;
  B2.fx.push({ kind: 'pxf', id: u.id, t0: now, pxf, dur: pxfMs(PXF[pxf]), ...o });
  return true;
}
/** 전투 공통 효과를 PXF로 (그렸을 때만 true, 아니면 예전 그림): 판 기록 열쇠는 예전 그림과 같은 앞머리 (heal12-… · death3-…) */
function commonFx(u: Unit, k: CommonFx, now: number, o: { color?: number; tag?: string; x?: number; y?: number } = {}): boolean {
  const pxf = COMMON_PXF[k];
  return !!pxf && fxPxf(u, pxf, now, { tag: k, ...o });
}
/** 부활 · 봉화 지정 글자: 연한 금빛 (능력 이름처럼 사건 글자, 치명타 치유 숫자와 다른 색) */
const REVIVE_TEXT = 0xffe08a;
/** plain = 이 칸에 스킬 PXF 이펙트 (환생)가 나와서 부활 빛은 안 그림 (글자는 그대로) */
export function fxRevive(u: Unit, now: number, label = '부활', plain = false): void {
  if (!L.ok) return;
  if (S.reducedEffects) { addBubble(u.id, label, now); return; }
  B2.floats.push({ dx: 0, dy: -0.3, text: label, crit: true, over: false, t0: now, n: B2.n++, id: u.id, fill: REVIVE_TEXT });
  B2.hitFx[u.id] = now;
  if (!plain && !commonFx(u, 'revive', now)) B2.fx.push({ kind: 'revive', id: u.id, t0: now });
}
/** 받은 피해 숫자 색: 회복 (민트 · 초록 · 회갈색) · 보호막 파랑 · 파티원 능력 연두와 안 겹치는 빨강 */
const DMG_TEXT = 0xff5a3d;
/** 한꺼번에 떠 있는 피해 숫자 (떠오르는 숫자는 모두 40개까지라 회복 숫자 자리를 남김: 20인 광역 한 번 = 20개) */
const DMG_FLOATS = 24;
/**
 * 파티원이 받은 피해 (엔진 dmg 사건, 뒤집힌 축복 포함. 2026-10-16 Lim 「피해를 입으면 빨간 숫자로 피해 표시도 남기자」):
 * 회복 숫자와 같은 자리 · 같은 자리 잡기 (이름 · 체력 글자는 비키고, 자리가 없으면 안 뜸). 장판 · 지속 피해는 엔진이 1초씩 모아 옴.
 * 체력 1/4 이상 한 방은 회복 숫자 크기, 나머지는 작게 (회복 숫자가 먼저 읽히게, 자리도 회복 숫자가 먼저 잡음)
 */
export function fxDamage(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1 || B2.floats.length >= 40) return;
  let n = 0;
  for (const fl of B2.floats) if (fl.dmg) n++;
  if (n >= DMG_FLOATS) return;
  B2.floats.push({ ...HEAL_AT, text: `-${amt}`, crit: false, over: false, fill: DMG_TEXT, dmg: true, big: amt >= u.max * 0.25, t0: now, n: B2.n++, id: u.id, num: true });
}
/** 흡수 보호막 (엔진 shield 사건): 회복 숫자 자리에 파란 숫자 (더해진 양) */
export function fxShield(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1) return;
  healNumber(u, `+${amt}`, now, { shield: true });
}
/** 실수 방지로 힐이 안 나감: 칸만 흔들림 */
export function fxShake(u: Unit, now: number): void {
  B2.shake[u.id] = now;
}
/** 파티원 능력 회복: 연두색 + 작은 십자 (내 힐과 구분, 17 7장) */
export function fxAllyHeal(u: Unit, amt: number, now: number): void {
  if (!L.ok || S.reducedEffects || amt < 1 || B2.floats.length >= 40) return;
  B2.floats.push({ dx: 0.25, dy: -0.1, text: `✚${amt}`, crit: false, over: false, t0: now, n: B2.n++, fill: 0xc8f07a, id: u.id, num: true });
}
/** 파티원 능력 사용: 칸 위에 능력 이름 (17 7장) */
export function fxAbility(u: Unit, name: string, now: number): void {
  if (S.reducedEffects) { addBubble(u.id, name, now); return; }
  if (!L.ok || B2.floats.length >= 40) return;
  B2.floats.push({ dx: 0, dy: -0.55, text: name, crit: false, over: false, t0: now, n: B2.n++, fill: C.gold, label: true, id: u.id });
}
/** plain = 이 칸에 해제 스킬 PXF 이펙트가 나와서 공통 해제 빛은 안 그림 */
export function fxDispel(u: Unit, now: number, trap = false, label?: string, plain = false): void {
  if (S.reducedEffects) { addBubble(u.id, label ?? (trap ? '전염 폭발' : '해제'), now); return; }
  if (!plain && !commonFx(u, 'dispel', now)) B2.fx.push({ kind: 'dispel', id: u.id, t0: now });
}
export function fxDeath(u: Unit, now: number): void {
  if (!L.ok) return;
  if (S.reducedEffects) { addBubble(u.id, '쓰러짐', now); return; }
  const p = unitPos(u), color = hex(ROLE[u.role].color);
  if (!commonFx(u, 'death', now, { color, x: p.x, y: p.y })) B2.fx.push({ kind: 'death', id: u.id, t0: now, color, x: p.x, y: p.y });
}
/** 말풍선. life = 보이는 시간 (ms, 긴 대사는 조금 더 오래, battle/talk.ts) · kind = 테두리 종류 · look = 감정 아이콘 · 승리 이펙트 (43 4장) */
export function addBubble(id: number, text: string, now: number, life = 1700, kind: BubbleKind = 'talk', look: { emote?: string | null; cheer?: boolean } = {}): void {
  B2.bubbles = B2.bubbles.filter(b => b.id !== id);
  B2.bubbles.push({ id, text, t0: now, added: now, life, kind, emote: look.emote, cheer: look.cheer });
  if (look.emote) artTexture(`emote-${look.emote}`); // 감정 아이콘을 바로 읽기 시작
  if (B2.bubbles.length > 3) B2.bubbles.shift();
}
/** 20인 탭 확대 미리보기 0.3초 (02 3-1) */
export function lensAt(idx: number, now: number): void { B2.lens = { idx, t0: now }; }

/** 지속 힐 색: 새싹 초록 · 생장 연두 · 들꽃 분홍 · 빛의 서약 금색 · 남은 꽃 (드루이드 특성) 연분홍 · 파도의 여운 (성기사 특성) 연금색 (77) */
const HOT_COLOR: Record<string, number> = { sprout: 0x7bc67e, growth: 0xb7e07a, wildflower: 0xe59ac0, oath: 0xf0c46a, bloom: 0xf3c7d6, lightWave: 0xffe7a3, droplet: 0x7ec8f0, wanderMist: 0x6fd0b0, starMark: 0xe8b04a };
/**
 * 판 위 물건 (79 6-1, engine/totems): 칸 바닥 색 · 그림 이름 (80 5장 board-*, 오기 전엔 바닥 색 + 안쪽 테두리). 범위 = 테두리를 그릴 거리
 * stand = 바닥 무늬가 아니라 칸 위에 선 물건 (standL): 사람이 서 있어도 그 칸 가운데에 크게, 이름 · 체력 뒤. 샘 · 대지 토템 = 스킬 아이콘과 같은 그림 (2026-10-16)
 */
const TOTEM_LOOK: Record<TotemKind, { color: number; art: string; label: string; stand?: boolean }> = {
  spring: { color: 0x7ec8f0, art: 'board-totem-spring', label: '샘', stand: true },
  earth: { color: 0xc49a62, art: 'board-totem-earth', label: '대지', stand: true },
  sea: { color: 0x4fa8e0, art: 'board-sea-spring', label: '바다' },
  mist: { color: 0x6fd0b0, art: 'board-mist-pool', label: '안개' },
  citadel: { color: 0xe6d3a0, art: 'board-citadel', label: '성채' },
  nova: { color: 0xd19a5e, art: 'board-supernova', label: '별' },
};
/** 선 물건 그림 한 변 (칸 반지름 배) · 그림마다 그려진 부분 (폭 · 높이 비율, 2026-10-16 납품본을 잼): 그려진 부분이 칸 안에 꽉 차게 */
const STAND_SIZE = 1.5;
const STAND_BOX: Record<string, [number, number]> = {
  'board-totem-spring': [0.72, 0.95], 'board-totem-earth': [0.75, 0.91],
  'board-shelter': [0.84, 0.9], 'board-sanctuary': [0.94, 0.86], 'board-moss': [0.91, 0.45],
};
/** 그림마다 한 변 (칸 반지름 배, 없으면 STAND_SIZE): 넓은 성역 돔 · 납작한 이끼는 칸 폭 안에 들게 줄임. 이끼는 그림 아래쪽에 그려져 있어 칸 가운데에 두면 발밑에 깔림 */
const STAND_SCALE: Record<string, number> = { 'board-sanctuary': 1.38, 'board-moss': 1.3 };
/** 그림마다 불투명도 (없으면 1): 성역 돔은 빛 막이라 아래 직업 칸 색 (체력)이 비치게 */
const STAND_ALPHA: Record<string, number> = { 'board-sanctuary': 0.82 };
/**
 * 선 물건 하나 (토템 · 쉼터 · 빛의 성역 · 이끼 자리, 2026-10-16 Lim 「토템 위치는 고정, 이름 · 체력 뒤 직업 칸 색 위에 가운데 크게, 캐릭터가 이동해도 그 자리」):
 * 칸 가운데 (standL: 직업 칸 색 위, 아이콘 · 이름 · 체력 · 배지 아래), 세울 때 0.25초 솟아오름 (바닥 기준, at = 세운 시각), 끝나기 2초 전 깜빡임. 그림이 아직 안 읽혔으면 false
 */
function putStand(key: string, artName: string, x: number, y: number, r: number, at: number, end: boolean, pulse: number): boolean {
  const tex = artTexture(artName);
  if (!tex) return false;
  const rise = S.reducedEffects ? 1 : Math.min(1, Math.max(0, ((B.F?.t ?? 0) - at) / 0.25)), k = 0.6 + 0.4 * (1 - (1 - rise) ** 2);
  const [bw, bh] = STAND_BOX[artName] ?? [1, 1], size = r * (STAND_SCALE[artName] ?? STAND_SIZE), w = size * bw, half = (size * bh) / 2;
  const q = fitCenter(x, y, w / 2, half);
  stands.put(tex, q.x, q.y + half * (1 - k), size * k, size * k, (end ? 0.5 + 0.5 * pulse : 1) * (STAND_ALPHA[artName] ?? 1));
  recordBound(`stand-${key}`, 'stand', 'rect', q.x, q.y, w, size * bh, { diameter: size });
  return true;
}
/** 직업별 판 위 그림 (80 5장 · 사제 쉼터 · 드루이드 이끼 · 성기사 성역): 전투 시작 때 그 직업 것만 미리 읽음 (첫 토템 · 인장 · 쉼터부터 보이게) */
const HERO_BOARD_ART: Partial<Record<HeroKey, string[]>> = {
  priest: ['board-shelter'],
  druid: ['board-moss'],
  paladin: ['board-sanctuary'],
  shaman: ['board-totem-spring', 'board-totem-earth', 'board-totem-rain', 'board-sea-spring'],
  monk: ['board-mist', 'board-mist-pool'],
  astrologer: ['board-star', 'board-star-mark', 'board-star-sleep', 'board-supernova'],
  warder: ['board-seal', 'board-barrier', 'board-citadel'],
};
/**
 * 칸 위에 얹는 그림의 그려진 부분 (192px 그림 중 폭 · 높이 비율, 80 5장 납품본을 잼). 판 가장자리에서 크기를 줄일 때 씀 (비율은 그대로)
 */
const HERO_ART_BOX: Record<string, [number, number]> = {
  'board-totem-rain': [0.75, 0.92], 'board-mist': [0.98, 0.49], 'board-seal': [0.85, 0.96], 'board-barrier': [0.79, 1],
  'board-star-mark': [0.99, 0.79], 'board-star': [0.8, 0.96], 'board-star-sleep': [0.79, 1], // 결계 · 별의 잠 · 별자리 표식은 2026-10-16 굵게 다시 그림 (89)
};
/** 점성술사 모으는 별 (80 5장 board-star): 별 n개 자리 (칸 반지름 배, 대상 칸 가운데 기준). 차례로 선을 이음 */
const CHARGE_STARS: [number, number][][] = [
  [],
  [[0, -0.1]],
  [[-0.36, 0.12], [0.36, -0.22]],
  [[-0.5, 0.15], [0, -0.32], [0.5, 0.12]],
  [[-0.56, 0.2], [-0.2, -0.3], [0.2, 0.08], [0.56, -0.3]],
  [[-0.6, 0.16], [-0.3, -0.32], [0, 0.12], [0.3, -0.32], [0.6, 0.16]],
];
/**
 * 힐러 직업 4종 그림 하나 (80 5장): 가운데 (x, y) · 한 변 size. 판 밖으로 나갈 것 같으면 비율 그대로 줄임. 그렸으면 true
 * 그림이 아직 안 읽혔으면 안 그림 (다음 프레임에 그림)
 */
function heroArt(pool: SpritePool, name: string, key: string, x: number, y: number, size: number, alpha = 1, shadow = false): boolean {
  const tex = artTexture(name);
  if (!tex) return false;
  const [bw, bh] = HERO_ART_BOX[name] ?? [1, 1];
  const fit = Math.min(size, (2 * (x - L.left)) / bw, (2 * (L.right - x)) / bw, (2 * (y - L.top)) / bh, (2 * (L.bottom - y)) / bh);
  if (fit <= 0) return false;
  if (shadow) pool.put(tex, x, y + Math.max(1, fit * 0.04), fit * 1.12, fit * 1.12, alpha * 0.6, 0x000000); // 작은 금빛 표시: 밝은 칸 (딜러 칸)에서도 읽히게 검은 그림자
  pool.put(tex, x, y, fit, fit, alpha);
  recordBound(key, 'hero-art', 'rect', x, y, fit * bw, fit * bh, { requestedDiameter: size, diameter: fit });
  return true;
}

function predictedHeal(u: Unit): number {
  const F = B.F!;
  if (!F.cast) return 0;
  const sk = SKILLS[F.cast.key];
  const tgt = F.party.find(x => x.id === F.cast!.uid);
  if (!tgt) return 0;
  if (sk.target === 'area') { const r = areaRadius(F, F.cast.key); return hexDist(F.cells[u.cell], F.cells[tgt.cell]) <= r ? sk.amt! * (r > 1 && F.cast.key === 'poh' ? 0.8 : 1) * F.gear.heal * F.power : 0; }
  return u === tgt ? sk.amt! * F.gear.heal * F.power * (u.hot > 0 ? 1.1 : 1) : 0;
}

/**
 * 스킬 · 전투 공통 이펙트 한 프레임: 대상 칸 가운데, 칸 지름 2r 기준 크기 (logicalSize / referenceCell), 판 밖으로 안 나가게 줄임.
 * 층: 모두 판 맨 위 (pxfL, 이름 · 체력 · 말풍선 위, Lim 「파티원에서 최상단으로」). 회색 그림은 tint 색을 곱함.
 * 손그림풍이라 부드럽게 늘림. 더하기 섞기는 WebGL에서만 (Canvas에서는 뒤에 그리는 것까지 번져서 보통 섞기)
 */
function pxfFx(k: PxfKey, key: string, x: number, y: number, r: number, ms: number, tint = 0xffffff, rot = 0): void {
  const c = PXF[k], i = pxfFrame(c, ms), tex = i < 0 ? null : smoothFrame(k, i);
  if (!tex) return;
  if (tex.source.scaleMode !== 'linear') tex.source.scaleMode = 'linear';
  const size = pxfDrawSize(c, r * 2), half = safeRadius(x, y, size / 2, 'circle');
  if (half <= 0) return;
  pxfArt.put(tex, x, y, half * 2, half * 2, 1, c.gray ? tint : 0xffffff, rot, c.blend === 'add' && app?.renderer.name !== 'canvas' ? 'add' : 'normal');
  recordBound(key, 'fx', 'circle', x, y, half * 2, half * 2, { diameter: half * 2, requestedDiameter: size, frame: i, tint: c.gray ? tint : undefined });
}
/** 손그림풍 스킬 이펙트 (격자 띠)의 프레임 i: 부드럽게 늘리므로 옆 프레임이 번져 들지 않게 반 픽셀 안쪽만 씀 */
function smoothFrame(k: PxfKey, i: number): Texture | null {
  const c = PXF[k], name = pxfArtName(k), tex = artTexture(name);
  if (!tex) return null;
  const px = tex.width / (c.cols * c.size), at = pxfCell(c, i), e = 0.5;
  return partTex(name, tex, at.x * px + e, at.y * px + e, c.size * px - 2 * e, c.size * px - 2 * e);
}
/**
 * 보스 판 전체 공격 (pxf.ts BOSS_PXF) 한 프레임: 캔버스를 판 너비 (세로로 길면 높이)로 키워 판 가운데에, 판 밖으로 나가는 부분은 프레임을 잘라 냄.
 * 띠는 Codex 손그림 256px 프레임 격자 (66 `fx-wide-`). 층은 다른 이펙트처럼 판 맨 위. 부드럽게 늘리고, 옆 프레임이 번져 들지 않게 반 픽셀 안쪽만 씀
 */
function pxfWide(k: PxfKey, key: string, ms: number, tint = 0xffffff): void {
  const c = PXF[k], i = pxfFrame(c, ms), name = pxfArtName(k), tex = i < 0 ? null : artTexture(name);
  const w = L.right - L.left, h = L.bottom - L.top;
  if (!tex || w <= 0 || h <= 0) return;
  const e = 0.5;
  if (tex.source.scaleMode !== 'linear') tex.source.scaleMode = 'linear';
  const px = tex.width / (c.cols * c.size), at = pxfCell(c, i), cr = pxfCrop(c, w, h), x = (L.left + L.right) / 2, y = (L.top + L.bottom) / 2;
  pxfArt.put(partTex(name, tex, (at.x + cr.x) * px + e, (at.y + cr.y) * px + e, cr.w * px - 2 * e, cr.h * px - 2 * e), x, y, w, h, 1, c.gray ? tint : 0xffffff);
  recordBound(key, 'fx', 'rect', x, y, w, h, { frame: i, tint: c.gray ? tint : undefined });
}
/** 그림 이펙트 한 장: 판 밖으로 안 나가게 크기를 줄여 그림. flipX = 좌우 뒤집음 */
function spriteFx(tex: Texture, key: string, x: number, y: number, size: number, alpha: number, tint = 0xffffff, rot = 0, flipX = false): void {
  const half = safeRadius(x, y, size / 2, 'circle');
  if (half <= 0 || alpha <= 0) return;
  fxArt.put(tex, x, y, flipX ? -half * 2 : half * 2, half * 2, alpha, tint, rot);
  recordBound(key, 'fx', 'circle', x, y, half * 2, half * 2, { diameter: half * 2, requestedDiameter: size });
}
const fxPos = (F: NonNullable<typeof B.F>, id: number): { x: number; y: number } | null => {
  const u = F.party.find(x => x.id === id) ?? F.souls.find(x => x.id === id);
  return u ? unitPos(u) : null;
};
/** 묶음 H (63 E 3 · 9): 그 기술 디버프가 걸린 동안 칸 위 그림 (얼음 갑옷 · 거품). 감옥은 감옥 자리에서 */
function holdOf(script: string, u: Unit): { tex: Texture; d: Unit['debuffs'][number] } | null {
  for (const d of u.debuffs) { const t = d.jail ? null : artTexture(debuffFxArt(script, 'hold', d.name)); if (t) return { tex: t, d }; }
  return null;
}
/** 밀가루 구름 (63 E 11)이 덮이기 시작한 때 */
let darkAt: number | null = null;
/** 기믹 연출 한 프레임 (37 4장 F-1): 그림 fx-<이름>, 없으면 그 색의 빛과 고리 */
function artFx(F: NonNullable<typeof B.F>, e: Fx, now: number, r: number, s: number): void {
  const look = FX_LOOK[e.name!] ?? { size: 1.4, color: C.white };
  const k = Math.min(1, (now - e.t0) / (e.dur ?? FX_MS)), key = `fx-${e.name}-${e.t0}-${e.id}-${e.cell ?? e.row?.[0] ?? ''}`;
  if (look.roll) { // 줄 피해 (63 E 1 · 2): 맞는 줄을 왼쪽 → 오른쪽으로, 판 밖으로 안 나가게
    const tex = artTexture(look.art ?? `fx-${e.name}`), cs = (e.row ?? []).map(center);
    if (!tex || !cs.length) return;
    const half = (r * look.size) / 2, xs = cs.map(c => c.x), y = cs.reduce((v, c) => v + c.y, 0) / cs.length;
    const a = Math.max(Math.min(...xs), L.left + half), b = Math.max(a, Math.min(Math.max(...xs), L.right - half));
    spriteFx(tex, key, a + (b - a) * k, y, half * 2, Math.min(1, k / 0.12, (1 - k) / 0.15));
    return;
  }
  let p = e.wide ? { x: (L.left + L.right) / 2, y: (L.top + L.bottom) / 2 } : e.cell != null ? center(e.cell) : fxPos(F, e.id);
  if (!p) return;
  if (look.floor) { // 칸 바닥에 잠깐 남음 (63 E 5 낟알): 파티원 칸 아래
    const tex = artTexture(look.art ?? `fx-${e.name}`);
    if (tex) decals.put(tex, p.x, p.y, r * 1.96, r * 1.96, Math.min(1, k / 0.1, (1 - k) / 0.4));
    return;
  }
  let rot = look.rot ?? 0, flipX = false;
  if (look.fly) {
    const from = look.top ? { x: look.boss ? (L.left + L.right) / 2 : p.x, y: L.top } : p, to = look.top ? p : e.to != null ? fxPos(F, e.to) : null;
    if (!to) return;
    if (e.name!.startsWith('chain-') && !artTexture(look.art ?? `fx-${e.name}`)) { bolt(from, to, Math.max(2, s * 0.07), 1 - k, `${key}-bolt`); return; } // 연쇄 번개 줄 (그림 57이 오기 전)
    const kk = k * k * (3 - 2 * k);
    rot = Math.atan2(to.y - from.y, to.x - from.x);
    if (look.boss) { flipX = to.x < from.x; rot = Math.max(-0.9, Math.min(0.9, Math.atan2(to.y - from.y, Math.abs(to.x - from.x)) * (flipX ? -1 : 1))); } // 까마귀 떼: 가는 쪽을 봄
    p = { x: from.x + (to.x - from.x) * kk, y: from.y + (to.y - from.y) * kk };
  } else if (e.to != null) {
    const q = fxPos(F, e.to); // 두 사람 사이 (사슬 끊어짐)
    if (q) p = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }
  if (look.up) p = { x: p.x, y: p.y - r * look.up * (0.7 + 0.3 * k) };
  const size = e.wide ? Math.min(L.right - L.left, L.bottom - L.top) * (0.45 + 0.55 * k) : r * look.size * (look.fly ? 1 : 0.7 + 0.4 * Math.sin((k * Math.PI) / 2));
  const alpha = look.fly ? (k < 0.85 ? 1 : (1 - k) / 0.15) : 1 - k * k;
  const tex = artTexture(look.art ?? `fx-${e.name}`), color = e.color ?? look.color;
  if (tex) { spriteFx(tex, key, p.x, p.y, size, alpha, look.tint ? color : 0xffffff, rot, flipX); return; }
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
  const typography = cellTypography(s);
  const rdt = Math.min(0.1, Math.max(0, (now - (B2.lastRender || now)) / 1000)); B2.lastRender = now;
  for (const g of [cellsG, unitsG, fxG, overG, overTopG, badgeG, topG]) g.clear();
  labels.begin(); badgeLabels.begin(); tops.begin(); nums.begin(); glowUsed = 0; hexFramesUsed = 0; decorationBounds.length = 0; decals.begin(); fxArt.begin(); marks.begin(); stands.begin(); ringArt.begin(); statusArt.begin(); pxfArt.begin(); stripUsed = 0;
  bubbleBack.begin(); bubbleFront.begin(); sliceUsed = 0;
  telsSeen = F.tels.slice(); // 다음 impact 사건이 어느 기술인지 (fxImpact)
  const fs = (k: number, min: number) => Math.max(min, s * k);

  // 영역 (장판 예고·활성 장판)
  const zoneSet = new Set<number>(), telSet = new Set<number>();
  const tideSet = new Set<number>(), tideTel = new Set<number>(); // 어둠물 (P-TIDE, 59 5장 화면): 빨간 장판 대신 검보랏빛 물결
  for (const z of F.zones) z.cells.forEach(i => (z.tide ? tideSet : zoneSet).add(i));
  for (const tl of F.tels) if (tl.skill.tide && !tl.fake) tl.cells.forEach(i => tideTel.add(i));
  const ringSet = new Set<number>(); for (const z of F.zones) if (z.ring) z.cells.forEach(i => ringSet.add(i)); // 요정 고리 (P-GROW, 48 5장)
  for (const tl of F.tels) if (tl.kind === 'zone' && !tl.skill.tide) tl.cells.forEach(i => telSet.add(i));
  const safeSet = new Set<number>(); for (const tl of F.tels) tl.safe?.forEach(i => safeSet.add(i)); // 피난처 (35 3-E)
  const padSet = new Set<number>(); for (const tl of F.tels) if (tl.skill.pads || tl.ring) tl.cells.forEach(i => padSet.add(i)); // 받침 발판 (35 4-5) · 끌려온 칸 받침 (39 3-1)
  // 새로 깔린 장판: 칸마다 한 번 터지는 연출 (쫄 오라처럼 끝나지 않는 장판은 빼고). 해바라기 언덕은 떨어지는 돌 (44 E-10, 그림이 있을 때)
  const burst = boardFaction === 'hill' && art('fx-rockfall') ? 'rockfall' : 'zone-burst';
  for (const z of F.zones) if (!seenZones.has(z.id)) { seenZones.add(z.id); if (isFinite(z.end) && !z.tide) z.cells.forEach(i => fxGim(burst, now, { cell: i })); }
  // 칸 무늬 그림 (37 4장 B). 없으면 아래 벡터 그림
  const zoneTex = artTexture(zoneArtName(boardFaction)), warnTex = artTexture('fx-cell-zone-warn'), holeTex = artTexture(holeArtName(boardFaction));
  const safeTex = artTexture('fx-cell-safe'), padTex = artTexture('fx-cell-tower'), ringTex = artTexture(ringArtName(boardFaction)), cellArt = r * 1.96;
  // 밀물 칸: 짠물 해적단 · 늪 독 연못은 그 그림과 물 색 (63 E 6 · 7 · 13 · 14), 그 밖 = 어둠물
  const tideTex = artTexture(tideArtName(boardFaction)), tideWarnTex = artTexture(tideArtName(boardFaction, true));
  const [tideC, tideHi] = TIDE_TINT[tideTail(boardFaction)] ?? [TIDE, TIDE_HI];
  // 해파리 점괘 (63 E 15): 그 기술 예고 칸은 떨어질 때까지 점괘 무늬
  const omenCells = new Map<number, Texture>();
  for (const tl of F.tels) { const om = tl.fake ? null : artTexture(bossFxArt(F.enc.script, 'omen', tl.skill.key)); if (om) tl.cells.forEach(i => omenCells.set(i, om)); }
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
    } else if (tideSet.has(i)) {
      // 어둠물에 잠긴 칸: 검보랏빛 물 + 물결 두 줄 (그림 60 fx-cell-tide)
      if (tideTex) decals.put(tideTex, p.x, p.y, cellArt, cellArt, 0.85 + 0.15 * zpulse);
      else {
        hexPoly(cellsG, p.x, p.y, r).fill({ color: tideC, alpha: 0.72 });
        waves(cellsG, p.x, p.y, r, t, Math.max(2, s * 0.05), tideHi, 0.75);
      }
    } else if (tideTel.has(i)) {
      // 어둠물 예고: 아래 줄이 검게 출렁 (그림 60 fx-cell-tide-warn)
      hexPoly(cellsG, p.x, p.y, r).fill({ color: tideC, alpha: 0.2 + 0.3 * pulse });
      if (tideWarnTex) decals.put(tideWarnTex, p.x, p.y, cellArt, cellArt, 0.5 + 0.5 * pulse);
      else dashPoly(cellsG, hexPts(p.x, p.y, r * 0.9), 6, 4, Math.max(2, s * 0.05), tideHi, 0.5 + 0.5 * pulse);
    } else if (telSet.has(i)) {
      const om = omenCells.get(i); // 점괘 칸은 빨강을 옅게 + 점괘 무늬
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.tel, alpha: om ? 0.08 + 0.12 * pulse : warnTex ? 0.06 + 0.14 * pulse : 0.14 + 0.24 * pulse });
      if (om) decals.put(om, p.x, p.y, cellArt, cellArt, 0.75 + 0.25 * pulse);
      else if (warnTex) decals.put(warnTex, p.x, p.y, cellArt, cellArt, 0.5 + 0.5 * pulse);
      else dashPoly(cellsG, hexPts(p.x, p.y, r * 0.9), 6, 4, Math.max(2, s * 0.05), C.zoneHi, 0.5 + 0.5 * pulse);
    }
    // 녹는 보호막: 열기 동안 칸마다 주황 아지랑이 + 불티 그림 (fx-melt-embers, 2026-10-16 검수: 주황 칠만으로는 거의 안 보였음)
    if (melting) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: MELT, alpha: 0.05 + 0.06 * zpulse });
      const mt = artTexture('fx-melt-embers');
      if (mt) fxArt.put(mt, p.x, p.y - r * 0.1 * zpulse, r * 1.7, r * 1.7, 0.45 + 0.3 * zpulse);
    }
    // 성기사 빛의 성역: 금빛 바닥, 끝나기 2초 전 깜빡임. 가운데 칸에 성역 그림 (board-sanctuary, 선 물건)
    const sanc = F.sanctuary;
    if (sanc && sanc.cells.has(i)) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: sanc.end - F.t < 2 ? 0.08 + 0.14 * pulse : 0.2 });
      if (sanc.cell === i) putStand(`sanctuary${i}`, 'board-sanctuary', p.x, p.y, r, sanc.at ?? -Infinity, sanc.end - F.t < 2, pulse);
    }
    // 드루이드 이끼 자리 (특성 77): 이끼 초록 바닥 + 발밑 이끼 (board-moss, 선 물건이라 사람이 서 있어도 보임), 끝나기 2초 전 깜빡임
    { const mu = F.tx.moss?.get(i); if (mu != null && mu > F.t) {
      hexPoly(cellsG, p.x, p.y, r).fill({ color: HOT_COLOR.sprout, alpha: mu - F.t < 2 ? 0.06 + 0.12 * pulse : 0.16 });
      putStand(`moss${i}`, 'board-moss', p.x, p.y, r, -Infinity, mu - F.t < 2, pulse); // 새싹을 다시 걸 때마다 시간이 늘어나 솟아오름 없음
    } }
    // 판 위 물건 (79 6-1: 토템 · 샘 · 성채 · 초신성): 그림 (80 5장)이 있으면 그 그림, 없으면 바닥 색 + 안쪽 테두리. 끝나기 2초 전 깜빡임
    for (const tm of F.totems) if (tm.cell === i) {
      const look = TOTEM_LOOK[tm.kind], end = tm.until - F.t < 2, tex = artTexture(look.art);
      hexPoly(cellsG, p.x, p.y, r).fill({ color: look.color, alpha: end ? 0.08 + 0.14 * pulse : 0.22 });
      // 선 물건: 한 칸에 토템 하나 (engine/totems ONE_PER_CELL): 새로 세우면 앞 토템은 엔진에서 사라짐
      if (tex && look.stand) putStand(`${tm.kind}${i}`, look.art, p.x, p.y, r, tm.at, end, pulse);
      else if (tex) decals.put(tex, p.x, p.y, cellArt, cellArt, end ? 0.5 + 0.5 * pulse : 1);
      else hexPoly(cellsG, p.x, p.y, r * 0.62).stroke({ width: 2.5, color: look.color, alpha: 0.9 });
    }
    // 사제 쉼터 (특성): 금빛 바닥 + 쉼터 천막 (board-shelter, 선 물건: 도망 온 사람이 들어가도 이름 · 체력 뒤에 보임), 끝나기 2초 전 깜빡임. 그림이 오기 전엔 안쪽 테두리
    if (F.tx.shelter === i) {
      const left = F.tx.act.shelter?.left ?? 0, dur = TALENT_DEF.shelter.active!.dur;
      hexPoly(cellsG, p.x, p.y, r).fill({ color: C.gold, alpha: left < 2 ? 0.1 + 0.16 * pulse : 0.26 });
      if (!putStand(`shelter${i}`, 'board-shelter', p.x, p.y, r, F.t - (dur - left), left < 2, pulse)) hexPoly(cellsG, p.x, p.y, r * 0.72).stroke({ width: 2.5, color: C.gold, alpha: 0.8 });
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
    // 그림 띠는 칸 위 층이라 사람이 선 이웃 칸도 보임 (2026-10-16 QA: 점선이 카드 아래라 빈칸만 표시됐음)
    F.cells.forEach((c, i) => { if (hexDist(c, c0) === 1) { const p = c.unit ? unitPos(c.unit) : center(i); if (!edgeRing('fx-edge-disease', p.x, p.y, r * 0.95, Math.max(4, s * 0.12), 0.55 + 0.25 * zpulse)) dashPoly(cellsG, hexPts(p.x, p.y, r * 0.98), 3, 4, 2.5, hex(DEB['질병'])); } });
  }

  // 연쇄 번개 예고 (56 5장 화면): 번개 구름 옆 칸 테두리가 옅게 번쩍 (튈 수 있는 곳)
  for (const tl of F.tels) if (tl.skill.chain && !tl.fake) for (const id of tl.units) {
    const v = F.party.find(x => x.id === id);
    if (!v?.alive) continue;
    const c0 = F.cells[v.cell];
    F.cells.forEach((c, i) => { if (hexDist(c, c0) === 1 && !c.block) { const p = c.unit ? unitPos(c.unit) : center(i); if (!edgeRing('fx-edge-spark', p.x, p.y, r * 0.95, Math.max(4, s * 0.12), 0.35 + 0.55 * pulse)) dashPoly(cellsG, hexPts(p.x, p.y, r * 0.96), 5, 4, Math.max(2, s * 0.05), BOLT, 0.25 + 0.45 * pulse); } });
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
    // 빌린 생명 (P-DEBT, 59 5장 화면): 거둬 갈 빚만큼 칸 위쪽이 보랏빛 (불어나면 띠가 내려옴), 4초 아래면 깜빡임
    const debt = u.debuffs.length ? u.debuffs.find(d => (d.debtLeft ?? 0) > 0) : undefined;
    if (debt) {
      const ly = top + 2 * r * Math.min(1, debt.debtLeft! / u.max), th = Math.max(1.5, s * 0.035);
      fillBand(unitsG, x, y, r, top, ly, DEBT, debt.left < 4 ? 0.3 + 0.3 * pulse : 0.42);
      fillBand(unitsG, x, y, r, ly - th, ly + th, DEBT_HI, 0.95);
    }
    // 모래시계 (P-GLASS, 54 5장): 창이 끝나면 돌아갈 체력 = 금빛 모래 선, 끝나기 1초 전 깜빡임
    for (const g of F.glass) {
      const g0 = g.rec.get(u.id);
      if (g0 == null) continue;
      const ly = bot - 2 * r * Math.max(0.02, Math.min(1, g0)), th = Math.max(1.5, s * 0.035);
      fillBand(unitsG, x, y, r, ly - th, ly + th, SAND, g.until - F.t < 1 ? 0.55 + 0.45 * pulse : 0.95);
    }
    const hold = u.debuffs.length ? holdOf(F.enc.script, u) : null; // 묶음 H 얼음 갑옷 · 거품 (63 E 3 · 9)
    const swell = u.debuffs.find(d => d.swell);
    if (swell && hold?.d !== swell) {
      const sr = r * Math.min(0.95, 0.45 + 0.12 * (swell.stack ?? 1)), st = artTexture('fx-swell-bubble'); // 거품 그림 (2026-10-16 검수), 중첩만큼 커짐
      if (st) statusArt.put(st, x, y + r * 0.05, sr * 2, sr * 2, swell.left < 2 ? 0.55 + 0.35 * pulse : 0.9);
      else unitsG.circle(x, y + r * 0.1, r * Math.min(0.85, 0.3 + 0.12 * (swell.stack ?? 1))).fill({ color: 0x7ee36a, alpha: 0.16 }).stroke({ width: Math.max(1.5, s * 0.04), color: 0x7ee36a, alpha: 0.75 });
    }
    const flip = u.debuffs.find(d => d.end?.p === 'flip');
    if (flip) hexPoly(unitsG, x, y, r).fill({ color: 0xffd166, alpha: flip.left < 1 ? 0.15 + 0.3 * pulse : 0.15 });
    // 묶음 C (48 5장 화면): 넘어가는 포자 = 칸 아래쪽 솜뭉치 (남은 막이 적을수록 작게), 끝나기 2초 전 깜빡임
    const puff = u.debuffs.find(d => d.end?.p === 'pass');
    if (puff) {
      const k = Math.max(0.45, Math.min(1, (puff.absorbLeft ?? 0) / Math.max(1, (puff.absorb ?? 1) * F.dmgMult)));
      const pr = r * 0.2 * k, py = y + r * 0.42, a = puff.left < 2 ? 0.55 + 0.4 * pulse : 0.9, pt = artTexture('board-spore-puff');
      // 포자 솜뭉치 그림 (2026-10-16 검수): 체력 숫자 뒤가 아니라 칸 왼쪽 아래 모서리, 남은 막이 적을수록 작게
      if (pt) statusArt.put(pt, x - r * 0.5, y + r * 0.5, r * 0.78 * k, r * 0.78 * k, a);
      else for (const [dx, dy] of [[-1.1, 0.2], [0, -0.35], [1.1, 0.2], [0, 0.45]]) unitsG.circle(x + dx * pr, py + dy * pr, pr).fill({ color: 0xfbe4ee, alpha: a }).stroke({ width: 1.2, color: RING_HI, alpha: a * 0.8 });
    }
    // 모자 뽑기 (48 5장): 칸 위에 모자 그림 (뒤집힘 실크해트 · 상한 고깔모자 · 완치 왕관 모자)
    const hat = u.debuffs.find(d => d.art), hatTex = hat ? artTexture(hat.art!) : null;
    if (hatTex) statusArt.put(hatTex, x, y - r * 0.6, r * 0.95, r * 0.95);
    // 묶음 H (63 E 3 · 9): 걸린 동안 칸 위에 겹침 (가운데가 빈 그림). 얼음 갑옷은 녹을수록 옅게, 거품은 중첩만큼 커짐, 끝나기 2초 전 깜빡임
    if (hold) {
      const d = hold.d, melt = d.absorb ? Math.max(0, Math.min(1, (d.absorbLeft ?? 0) / Math.max(1, d.absorb * F.dmgMult))) : 1, k = d.swell ? Math.min(1.95, 1.35 + 0.15 * (d.stack ?? 1)) : 1.9;
      statusArt.put(hold.tex, x, y, r * k, r * k, (0.45 + 0.55 * melt) * (d.left < 2 ? 0.6 + 0.4 * pulse : 1));
    }
    // 힐러 직업 4종 (80 5장): 떠도는 안개 = 발밑 옅은 안개 고리 · 결계사 보호막 = 칸을 감싼 금빛 막 (끝나기 2초 전 깜빡임) · 별의 잠 = 칸을 덮는 별빛 고치
    const mist = u.hots.find(h => h.key === 'wanderMist' && h.left > 0);
    if (mist) heroArt(statusArt, 'board-mist', `hero-mist${u.id}`, x, y + r * 0.55, r * 1.5, mist.left < 2 ? 0.35 + 0.35 * pulse : 0.7);
    if (F.hero === 'warder' && absorbLeft(F, u) > 0) {
      const left = Math.max(0, ...u.mods.filter(m => m.k === 'absorb' && m.src === HEALER_SHIELD).map(m => m.until - F.t));
      heroArt(statusArt, 'board-barrier', `hero-barrier${u.id}`, x, y, r * 2.06, left < 2 ? 0.4 + 0.45 * pulse : 0.85);
    }
    if (asleep(F, u)) heroArt(statusArt, 'board-star-sleep', `hero-sleep${u.id}`, x, y, r * 2.06, u.sleep! - F.t < 1 ? 0.5 + 0.4 * pulse : 0.9);
    // 어둠물에 잠긴 사람: 칸 아래 40%가 물에 잠김 (물 높이가 출렁) · 받는 치유 −50%
    if (tideSet.has(u.cell)) {
      const wy = bot - 2 * r * 0.4 + (S.reducedEffects ? 0 : Math.sin(t * 3 + u.id) * s * 0.03), th = Math.max(1.5, s * 0.035);
      fillBand(unitsG, x, y, r, wy, bot, tideC, 0.55);
      fillBand(unitsG, x, y, r, wy - th, wy + th, tideHi, 0.9);
    }
    // 장판 위에 선 사람: 칸 전체에 붉은 빛 + 칸 둘레 불길 그림 (아래 테두리 단계 fx-edge-flame). 그림이 없을 때만 빗금 (2026-10-16 검수: 빗금은 폰에서 거의 안 보였음)
    if (zoneSet.has(u.cell)) {
      hexPoly(unitsG, x, y, r).fill({ color: C.zone, alpha: 0.18 + 0.08 * zpulse });
      if (!artTexture('fx-edge-flame')) hatchHex(unitsG, x, y, r * 0.94, Math.max(7, s * 0.22)).stroke({ width: Math.max(1.5, s * 0.04), color: C.zoneHi, alpha: 0.4 });
    }
    if (!S.reducedEffects && u.flash > 0) hexPoly(unitsG, x, y, r).fill({ color: 0xff503c, alpha: Math.min(1, u.flash * 1.4) });
    const hk = (now - (B2.hitFx[u.id] ?? -1e9)) / 300;
    if (!S.reducedEffects && hk >= 0 && hk < 1) hexPoly(unitsG, x, y, r).fill({ color: 0xfff8d6, alpha: 0.4 * (1 - hk) });
    fillBand(unitsG, x, y, r, top, y, C.white, 0.06); // 윗면 광택
    // 큰 피격: 깜빡임이 새로 켜진 순간 = 날카로운 자국 (16 4-6)
    if (!S.reducedEffects && u.flash > (B2.lastFlash[u.id] ?? 0) + 0.05 && !commonFx(u, 'hit', now)) B2.fx.push({ kind: 'hit', id: u.id, t0: now, seeds: [rnd()] });
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
      if (ct) statusArt.put(ct, x, y + r * 0.8, r * 1.9, r * 0.95);
      else for (const [dx, dy, k] of [[-0.5, 0.88, 0.3], [0, 0.8, 0.38], [0.5, 0.88, 0.3]]) unitsG.circle(x + dx * r, y + dy * r, r * k).fill({ color: 0xf6fbff, alpha: 0.92 });
    }
    over.push({ u, x, y, deb: undefined });
  }

  // 점성술사 별자리 시전 (80 5장 board-star, 83): 별비 · 북극성 · 별의 기억을 시전하는 동안 대상 칸 위에 별 (1 + 조각)개를 금빛 선으로 이음. 가득 찬 별자리면 모두 밝게
  const ch = F.hero === 'astrologer' && F.cast && CONSTELLATION.has(F.cast.key) ? F.cast : null;
  if (ch) {
    const stars = starsNow(F), cu = F.party.find(v => v.id === ch.uid && v.alive);
    const c0 = cu ? unitPos(cu) : center(ch.cell), pts = CHARGE_STARS[Math.min(stars, CHARGE_STARS.length - 1)];
    const perfect = stars >= starMax(F), w = Math.max(1.5, s * 0.045);
    const at = pts.map(([dx, dy]) => fitCenter(c0.x + dx * r, c0.y + (dy - 0.12) * r, r * 0.2)); // 이름 줄보다 조금 위
    if (at.length > 1) {
      for (const [width, color, alpha] of [[w + 2, C.line, 0.55], [w, C.gold, perfect ? 1 : 0.85]] as const) {
        fxG.moveTo(at[0].x, at[0].y);
        for (const p of at.slice(1)) fxG.lineTo(p.x, p.y);
        fxG.stroke({ width, color, alpha, cap: 'round', join: 'round' });
      }
    }
    at.forEach((p, i) => heroArt(fxArt, 'board-star', `hero-star${i}`, p.x, p.y, r * (i === at.length - 1 && !perfect ? 0.54 + 0.08 * pulse : 0.54), perfect ? 0.8 + 0.2 * pulse : 1, true));
  }
  // 주술사 비구름 토템 (80 5장 board-totem-rain): 비가 오는 동안 판 오른쪽 위 하늘에 떠서 천천히 흔들림
  if (raining(F)) {
    const size = Math.max(30, r * 1.5), bob = S.reducedEffects ? 0 : Math.sin(t * 1.6) * r * 0.05;
    heroArt(fxArt, 'board-totem-rain', 'hero-rain', L.right - size * 0.4, L.top + size * 0.48 + bob, size, F.sham!.rainUntil - F.t < 2 ? 0.45 + 0.4 * pulse : 0.9);
  }

  // 밀가루 구름 (63 E 11): 체력 숫자가 숨은 동안 판 전체 (가장자리가 짙은 그림). 처음 1.2초는 짙게 덮었다가 옅어짐
  const darkTex = F.dark ? artTexture(darkArt(F.enc.script)) : null;
  if (darkTex) {
    darkAt ??= now;
    const k = S.reducedEffects ? 1 : Math.min(1, (now - darkAt) / 1200), b = S.reducedEffects ? 0 : 0.02 * (1 + Math.sin(t * 0.6));
    const w = (L.right - L.left) * (1 - b), h = (L.bottom - L.top) * (1 - b), cx = (L.left + L.right) / 2, cy = (L.top + L.bottom) / 2;
    fxArt.put(darkTex, cx, cy, w, h, 0.95 - 0.4 * k);
    recordBound('fx-flour-cloud', 'fx', 'rect', cx, cy, w, h);
  }
  // 효과 (칸 채움 위, 글자·테두리 아래)
  B2.fx = S.reducedEffects ? [] : B2.fx.filter(e => now - e.t0 < (e.dur ?? FX_MS));
  for (const e of B2.fx) {
    if (e.kind === 'art') { artFx(F, e, now, r, s); continue; }
    if (e.kind === 'pxf') {
      if (e.wide) { pxfWide(e.pxf!, `pxf-${e.pxf}-${e.t0}`, now - e.t0, e.color); continue; }
      const u = F.party.find(x => x.id === e.id), p = e.x != null ? { x: e.x, y: e.y! } : u ? unitPos(u) : null;
      if (p) pxfFx(e.pxf!, e.tag ? `${e.tag}${e.id}-${e.t0}` : `pxf${e.id}-${e.pxf}-${e.t0}`, p.x, p.y, r, now - e.t0, e.color, e.rot);
      continue;
    }
    const k = (now - e.t0) / FX_MS;
    const u = F.party.find(x => x.id === e.id);
    const p = e.x != null ? { x: e.x, y: e.y! } : u ? unitPos(u) : null;
    if (!p) continue;
    // 공용 이펙트 그림 (37 4장 F-2)이 있으면 그 그림, 없으면 벡터
    const tex = artTexture(e.kind === 'heal' ? 'fx-heal' : e.kind === 'death' ? 'fx-down' : `fx-${e.kind}`);
    if (e.kind === 'heal') {
      if (e.plain) { /* 스킬 PXF 이펙트가 대신 */ } else if (tex) spriteFx(tex, `heal${e.id}-${e.t0}`, p.x, p.y - r * 0.25 * k, r * (1.5 + 0.4 * k), 1 - k * k, hex(emblemColor(F.hero)));
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
      if (e.crit && k < 1) {
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
    // 적 칸 = 그을린 무쇠 바탕 + 붉게 달아오른 테 그림 (fx-edge-ember, 2026-10-16 검수: 평면 빨간 판이 황동 파티 칸 옆에서 가장 싸 보였음)
    const ember = !!artTexture('fx-edge-ember');
    hexPoly(cellsG, p.x, p.y, r * 0.92).fill({ color: ember ? 0x2a1715 : 0x3b1514, alpha: 0.92 });
    if (!ember || !edgeRing('fx-edge-ember', p.x, p.y, r * 0.9, Math.max(5, s * 0.15))) hexPoly(cellsG, p.x, p.y, r * 0.92).stroke({ width: Math.max(2.5, s * 0.07), color: C.danger, alpha: 0.9 });
    fillBand(cellsG, p.x, p.y, r * 0.92, p.y + r * 0.92 - 2 * r * 0.92 * (m.hp / m.max), p.y + r * 0.92, C.danger, 0.28);
    if (m === focus) {
      // 일점사: 금빛 칼날 표식 (icon-gim-focus)을 칸 왼쪽 위에 (탱커 조준 표식과 다른 모양, 판 밖으로 안 뻗음)
      const ft = artTexture('icon-gim-focus'), fz = r * 0.62;
      if (ft) { const fp = fitCenter(p.x - r * 0.56, p.y - r * 0.52, fz / 2); marks.put(ft, fp.x, fp.y, fz, fz, 0.75 + 0.25 * pulse); }
      else {
        const ro = r * 0.98, ri = r * 0.62;
        overG.circle(p.x, p.y, r * 0.8).moveTo(p.x - ro, p.y).lineTo(p.x - ri, p.y).moveTo(p.x + ri, p.y).lineTo(p.x + ro, p.y).moveTo(p.x, p.y - ro).lineTo(p.x, p.y - ri)
          .stroke({ width: Math.max(2.5, s * 0.06), color: C.gold, alpha: 0.6 + 0.4 * pulse });
      }
    }
    // 이름 · 체력 %는 파티원 칸과 같은 자리 (이웃한 적 칸끼리 글자가 겹치지 않게 알약 대신 글자만). 칸 그림(37 4장 E)이 있으면 이름 대신 그림
    const mt = artTexture(addArtName(m));
    if (mt) decals.put(mt, p.x, p.y - r * 0.18, r * 1.15, r * 1.15);
    else labels.put(`tot${m.id}`, a.short, { size: typography.nick, fill: 0xf3cfc6, strokeW: typography.nick < 11 ? 1.5 : 2 }, p.x, p.y + r * 0.13);
    labels.put(`totp${m.id}`, `${Math.ceil((m.hp / m.max) * 100)}%`, { size: typography.hp, fill: C.white, weight: W_NUM, strokeW: 2.5 }, p.x, p.y + r * 0.6);
    const j = a.job;
    // 남은 초: 폭탄 = 터질 때까지 (부화하는 알 = 깨질 때까지), 걸어오는 쫄 = 보스에게 닿을 때까지, 큰 쫄 = 강타 예고
    const left = (j?.p === 'bomb' || j?.p === 'hatch' || j?.p === 'hoard') && isFinite(a.jobAt!) ? a.jobAt! - F.t : j?.p === 'march' ? (a.steps! - 1) * j.every + a.jobAt! - F.t : j?.p === 'smash' && a.warned ? a.jobAt! - F.t : null;
    if (left != null) pill(overG, labels, `bomb${m.id}`, p.x, p.y - r * 0.8, `${Math.max(0, Math.ceil(left))}`, j!.p === 'bomb' || j!.p === 'hatch' ? C.danger : j!.p === 'hoard' ? 0xffd24a : 0xffb25b, j!.p === 'bomb' || j!.p === 'hatch' ? C.white : C.dark, fs(0.26, 11));
    // 자폭 쫄: 노린 사람까지 붉은 줄
    const prey = j?.p === 'fixate' ? F.party.find(u => u.id === a.on && u.alive) : undefined;
    if (prey) { const q = unitPos(prey); overG.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: Math.max(2, s * 0.05), color: C.danger, alpha: 0.45 + 0.4 * pulse }); }
  }

  // 헤매는 영혼 (P-SOUL, 35 8장): 반투명 칸 + 체력 물통 + 남은 초. 파티원 칸처럼 탭하면 힐
  for (const u of F.souls) {
    const p = center(u.cell), frac = Math.max(0, Math.min(1, u.hp / u.max)), rr = r * 0.92;
    hexPoly(cellsG, p.x, p.y, rr).fill({ color: 0x8fd8e0, alpha: 0.16 + 0.1 * pulse });
    fillBand(cellsG, p.x, p.y, rr, p.y + rr - 2 * rr * frac, p.y + rr, 0xbff3f0, 0.5);
    if (!edgeRing('fx-edge-mist', p.x, p.y, rr * 0.98, Math.max(5, s * 0.15), 0.8 + 0.2 * pulse)) dashPoly(cellsG, hexPts(p.x, p.y, rr), 5, 4, Math.max(2, s * 0.06), 0xd8fbff, 0.9);
    if (castTarget === u.id) hexPoly(overG, p.x, p.y, r * 1.04).stroke({ width: 3, color: hex(SEL) });
    const st = artTexture(soulArtName(u));
    if (st) decals.put(st, p.x, p.y - r * 0.18, r * 1.15, r * 1.15, 0.7 + 0.15 * pulse);
    else labels.put(`soul${u.id}`, u.soul!.short, { size: typography.nick, fill: 0xe6fbff, strokeW: typography.nick < 11 ? 1.5 : 2 }, p.x, p.y + r * 0.13);
    labels.put(`soulp${u.id}`, `${Math.floor(frac * 100)}%`, { size: typography.hp, fill: C.white, weight: W_NUM, strokeW: 2.5 }, p.x, p.y + r * 0.6);
    pill(overG, labels, `soult${u.id}`, p.x, p.y - r * 0.8, `${Math.max(0, Math.ceil(u.soul!.until - F.t))}`, 0x8fd8e0, C.dark, fs(0.26, 11));
  }

  // 생명 사슬 (P-LINK, 35 8장): 두 칸 가운데를 잇는 선. 균형형 = 보라 실 (끊어지기 직전 빨갛게 깜빡), 나눔형 = 금 사슬 (끊긴 선)
  for (const l of F.links) {
    const a = F.party.find(x => x.id === l.a), b = F.party.find(x => x.id === l.b);
    if (!a?.alive || !b?.alive) continue;
    const pa = unitPos(a), pb = unitPos(b), w = Math.max(2.5, s * 0.07);
    const near = l.kind === 'balance' && Math.abs(a.hp / a.max - b.hp / b.max) > l.gap * 0.75;
    const lt = artTexture(l.kind === 'share' ? 'fx-link-chain' : 'fx-link-thread');
    // 묶인 두 칸에 사슬 고리 그림 (icon-gim-link, 2026-10-16 QA: 선이 사이 칸을 지나가 그 사람도 묶인 것처럼 보였음). 칸 오른쪽 아래
    const kt = artTexture('icon-gim-link');
    if (kt) for (const q of [pa, pb]) { const kp = fitCenter(q.x + r * 0.6, q.y + r * 0.42, r * 0.22); marks.put(kt, kp.x, kp.y, r * 0.46, r * 0.46, near ? 0.6 + 0.4 * pulse : 1); }
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
    // 장판 위 (깔림 = 늘 · 예고 = 깜빡임): 칸 둘레 불길 그림 (fx-edge-flame). 체력 위험 빨간 외곽선 · 강타 예고와 다른 모양 (2026-10-16 QA: 빨간 테 넷이 같아 보였음)
    if (zoneSet.has(u.cell) || telSet.has(u.cell)) {
      const w = Math.max(2.5, s * 0.09), R = ringRadius(`zone${u.id}`, 'hex', x, y, r * 1.02, w), a = zoneSet.has(u.cell) ? 1 : 0.4 + 0.6 * pulse;
      if (!edgeRing('fx-edge-flame', x, y, R + w * 0.3, Math.max(6, s * 0.2), a)) hexPoly(overG, x, y, R).stroke({ width: w, color: 0xff5a3d, alpha: a });
    }
    // 힐러 표시 (25 3장 → 2026-10-16 검수: 선 굵기 · 점선으로만 갈리던 여섯 표시를 모양이 다른 그림으로). 반지름 · 끝나기 2초 전 깜빡임은 그대로, 녹는 열기 동안은 그림 위에 불티 (칸마다 fx-melt-embers)
    if (u.guardian > 0) { const R = ringRadius(`guardian${u.id}`, 'circle', x, y, r * 1.1, 3); if (!roundRing('fx-ring-guardian', x, y, R + 2, 0.95)) dashCircle(overG, x, y, R, 2, 4, 3, melting ? MELT : C.ink, 0.9); } // 수호: 깃털 고리
    // 보호 (빛 그릇 보호막 등, u.shield): 빛 유리 띠 (그림 없으면 흰 이중 테두리)
    if (u.shield > 0) {
      const a = u.shield < 2 ? 0.35 + 0.6 * pulse : 0.95;
      const outer = ringRadius(`shield-outer${u.id}`, 'hex', x, y, r * 1.2, 2);
      const inner = ringRadius(`shield-inner${u.id}`, 'hex', x, y, r * 1.12, 2, 'ring', outer - r * 0.08);
      if (!edgeRing('fx-edge-glass', x, y, (inner + outer) / 2, Math.max(5, outer - inner + s * 0.08), a)) {
        hexPoly(overG, x, y, inner).stroke({ width: 2, color: melting ? MELT : 0xedeff7, alpha: a });
        hexPoly(overG, x, y, outer).stroke({ width: 2, color: melting ? MELT : 0xedeff7, alpha: a });
      }
    }
    // 보호의 손 = 판금 띠, 피해 감소 (나무껍질 · 성역) = 나무껍질 띠, 희생 = 금 사슬 띠, 봉화 = 화로 불꽃 고리
    if (u.immune > 0) { const w = Math.max(3, s * 0.1), R = ringRadius(`immune${u.id}`, 'hex', x, y, r * 1.14, w), a = u.immune < 2 ? 0.35 + 0.6 * pulse : 0.95; if (!edgeRing('fx-edge-plate', x, y, R, Math.max(6, s * 0.15), a)) hexPoly(overG, x, y, R).stroke({ width: w, color: 0xffffff, alpha: a }); }
    else if (u.redu > 0) { const R = ringRadius(`reduction${u.id}`, 'hex', x, y, r * 1.1, 2.5), a = u.redu < 2 ? 0.35 + 0.6 * pulse : 0.9; if (!edgeRing('fx-edge-bark', x, y, R, Math.max(5, s * 0.13), a)) hexPoly(overG, x, y, R).stroke({ width: 2.5, color: melting && u.redu > 0.5 ? MELT : HOT_COLOR.sprout, alpha: a }); }
    if (u.sacr > 0) { const R = ringRadius(`sacrifice${u.id}`, 'hex', x, y, r * 1.16, 2); if (!edgeRing('fx-link-chain', x, y, R, Math.max(4, s * 0.1))) dashPoly(overG, hexPts(x, y, R), 5, 4, 2, melting ? MELT : C.gold); }
    if (F.beacon === u.id) { const R = ringRadius(`beacon${u.id}`, 'circle', x, y, r * 1.22, 2.5); if (!roundRing('fx-ring-beacon', x, y, R + 3, 0.95)) dashCircle(overG, x, y, R, 3, 5, 2.5, C.gold, 0.95); }
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
    // 종류별 그림 띠 (독 진액 · 마법 서리 · 저주 가시 · 질병 포자, 2026-10-16 검수): 해제 종류 색은 그대로. 함정은 깜빡임 (그림이 없으면 점선)
    const edge = DEBUFF_EDGE[deb.type];
    if (!edge || !edgeRing(edge, x, y, dr, w * 1.9, deb.trap ? 0.55 + 0.45 * pulse : 1)) {
      if (deb.trap) dashPoly(overG, hexPts(x, y, dr), 6, 4, w, col); else hexPoly(overG, x, y, dr).stroke({ width: w, color: col });
    }
  }
  let meShown = false;
  const hotR = Math.max(7, s * 0.19);
  // 배지 글자: 가장 긴 「×저주 12」와 지속 힐 원이 칸 폭 한 줄에 안 들어가는 판은 전부 짧은 글자 「×저12」
  const shortBadge = measure('×저주 12', typography.debuff) + typography.debuff * 0.7 + 1.5 > r * COS30 * 2 - 2 * (hotR + 0.75) - 1;
  const hpBounds: { id: number; cell: number; text: string; x: number; y: number; w: number; h: number; sx: number }[] = [];
  const shieldLayout = shieldTimerLayout(s);
  for (const { u, x, y, deb } of over) {
    let debBadge: ReturnType<typeof pill> | undefined;
    const hots = hotTimersOf(u), hasHot = hots.length > 0;
    const hotLayout = hotTimerLayout(s, hots.length);
    const shieldT = shieldTimerOf(u, F.t);
    // 칸 = 직업 아이콘 · 닉네임 · 체력 (2026-10-07 Lim: 성격 배지는 칸에서 빼고 길게 누르기 정보에만). 「나」 = 직업 문장 (27 3-4)
    const em = u.me ? emblemTexture(F.hero) : null;
    // 위쪽 한 줄은 직업 아이콘 또는 디버프 배지 (디버프가 있으면 배지가 그 자리를 씀, 칸 색이 직업을 보여 줌)
    if (em && !deb) {
      const d = Math.max(14, s * 0.5);
      if (meEmblem.texture !== em) meEmblem.texture = em;
      meEmblem.width = meEmblem.height = d;
      const ep = fitCenter(x, y - r * 0.4, d / 2);
      meEmblem.position.set(ep.x, ep.y);
      recordBound(`role${u.id}`, 'role', 'circle', ep.x, ep.y, d, d);
      meShown = true;
    } else if (!deb) {
      // 직업이 있으면 편성 화면과 같은 직업 아이콘 (방패 높이가 예전 역할 방패와 같게 24칸 = 1.36k), 없으면 (보스가 붙인 동료 등) 역할 아이콘
      const k = s * 0.34, size = k * 1.36, half = u.cls ? size * 0.46 : k * 0.6 + Math.max(1.5, k * 0.12) / 2;
      const ep = fitCenter(x, y - r * 0.38, half);
      if (u.cls) classGlyph(overG, u.cls, ep.x, ep.y, size); else roleIcon(overG, u.role, ep.x, ep.y, k);
      recordBound(`role${u.id}`, 'role', 'icon', ep.x, ep.y, half * 2, half * 2);
    }
    nick(u, x, y + r * 0.13, r);
    // 영원한 저녁 (05 6-G): 숫자 없이 채움 색만
    const hpText = hpLabelText(u.hp, !!F.dark);
    const hpY = y + r * 0.6;
    // 보호막이 있는 동안 체력 숫자는 보호막 파랑 (2026-10-16 Lim, 떠오르는 파란 숫자와 같은 색)
    const hpLabel = labels.put(`hp${u.id}`, hpText, {
      size: typography.hp, fill: shieldT ? C.shield : C.white, weight: W_NUM, strokeW: 2.5, num: true,
    }, x, hpY);
    // Bitmap atlas의 획/패딩 때문에 100%가 옆 칸까지 번지지 않게 실제 렌더 폭을 제한한다.
    // 세로 글자 크기·문자 내용은 유지하고, 필요한 경우 가로만 압축한다.
    hpLabel.scale.set(1);
    if (hpLabel.width > r * 1.56) hpLabel.scale.x = r * 1.56 / hpLabel.width;
    const hpBox = fitLabel(hpLabel, `hp${u.id}`, 'hp');
    hpBounds.push({ id: u.id, cell: u.cell, text: hpText, ...hpBox, sx: hpLabel.scale.x });
    // 숫자 HP와 육각형 내부 채움만 사용하고 중복 HP 눈금은 그리지 않는다.
    const relay = F.relay && F.relay.id === u.id && F.t >= F.relay.flyUntil; // 날아가는 중에는 연출 (relay-fly)만
    let hotSpot: { x: number; y: number } | null = null, shieldSpot: { x: number; y: number } | null = null;
    if (deb) {
      const jail = deb.jail ? F.mobs.find(m => m.alive && m.add?.hold === deb.id) : undefined;
      // 다른 종류 디버프도 함께 걸려 있으면 배지 글자 끝에 + (종류는 길게 누르기 정보에). 배지 밖에 따로 그리면 작은 칸에서 위 칸 체력 숫자에 닿는다
      const more = u.debuffs.some(d => d !== deb && d.type !== deb.type) ? '+' : '';
      const badgeText = (short: boolean) => (jail ? `${jail.add!.short} ${Math.ceil((jail.hp / jail.max) * 100)}%` : debuffDisplay(deb, F.hero, short).text) + more;
      const color = deb.jail ? 0xd8c7a8 : deb.trap ? 0xf6e7b0 : deb.debt ? DEBT_HI : hex(DEB[deb.type] || '#E5433D'), fsD = typography.debuff; // 빌린 생명은 보랏빛 「빚」 배지
      // 배지는 직업 아이콘 자리 (윗줄)에 (2026-10-10). 꼭짓점에 두면 위 칸 체력 숫자와 겹친다.
      // 윗변은 위 칸 체력 숫자 아래 (글자 상자의 위아래 여백 2px는 겹쳐도 안 보임)
      const h = fsD * 1.32 + 1.5, below = hpBox.y + hpBox.h / 2 - 1.5 * s - 1 + h / 2;
      const hr = hasHot ? hotLayout.radius + 0.75 : 0, sr = shieldT ? shieldLayout.radius + 0.75 : 0, half = r * COS30;
      let text = badgeText(shortBadge), w = measure(text, fsD) + fsD * 0.7 + 1.5;
      if (w > half * 2 - (hr ? hr * 2 + 1 : 0) - (sr ? sr * 2 + 1 : 0)) { text = badgeText(true); w = measure(text, fsD) + fsD * 0.7 + 1.5; }
      const hx = Math.min(x + hotLayout.x, x + half - hr), sx = Math.max(x + shieldLayout.x, x - half + sr);
      let bx = hr ? Math.min(x, hx - hr - 1 - w / 2) : x;
      if (sr) bx = Math.max(bx, sx + sr + 1 + w / 2);
      debBadge = pill(badgeG, badgeLabels, `deb${u.id}`, bx, Math.max(y - r * 0.4, below), text, color, C.dark, fsD);
      // 지속 힐 원은 배지 오른쪽, 보호막 원은 배지 왼쪽 같은 줄
      if (hr) hotSpot = fitCenter(Math.max(hx, debBadge.x + debBadge.w / 2 + 1 + hr), debBadge.y, hr);
      if (sr) shieldSpot = fitCenter(Math.min(sx, debBadge.x - debBadge.w / 2 - 1 - sr), debBadge.y, sr);
      // 기믹 디버프는 배지 왼쪽 끝에 그 기믹 그림 (매혹 · 치유 상한 · 빚 · 부풀기 · 뒤집힘 · 포자 · 함정 · 쇠약, 2026-10-16 QA)
      const gim = GIM_ICON.find(([f]) => f(deb))?.[1], gt = gim ? artTexture(gim) : null;
      if (gt) { const z = debBadge.h * 1.5, gp = fitCenter(debBadge.x - debBadge.w / 2 - z * 0.4, debBadge.y, z / 2); marks.put(gt, gp.x, gp.y, z, z); recordBound(`gim${u.id}`, 'mark', 'icon', gp.x, gp.y, z, z); }
    }
    if (hasHot) {
      const hr = hotLayout.radius, lower = hr + 0.75 + (hots.length - 1) * hotLayout.step;
      const start = hotCenter(hotSpot?.x ?? x + hotLayout.x, hotSpot?.y ?? y + hotLayout.y, hr + 0.75, lower);
      hots.forEach((h, i) => {
        const hx = start.x, hy = start.y + i * hotLayout.step, key = `hot${u.id}-${h.key}`;
        badgeG.circle(hx, hy, hr).fill({ color: HOT_COLOR[h.key] ?? C.teal }).stroke({ width: 1.5, color: C.line });
        const label = badgeLabels.put(key, String(Math.ceil(h.left)), { size: Math.max(8, hr * 1.05), fill: C.line }, hx, hy + 0.5);
        label.scale.set(1);
        if (label.width > hr * 1.65) label.scale.x = hr * 1.65 / label.width;
        fitLabel(label, `${key}-text`, 'hot');
        recordBound(key, 'hot', 'circle', hx, hy, hr * 2 + 1.5, hr * 2 + 1.5);
      });
    }
    // 보호막 시간 (2026-10-16 Lim): 지속 힐 원을 칸 왼쪽으로 뒤집은 자리 · 같은 크기, 짙은 파란 원 + 흰 숫자. 배지가 있으면 배지 왼쪽 같은 줄.
    // 왼쪽 위 열은 보호막 원이 맨 위, 그 아래로 차례 번호표 · 빛의 전이 · 인장 · 별자리 표식 (leftY = 다음 것의 윗변)
    let leftY: number | null = null;
    if (shieldT) {
      const sr = shieldLayout.radius, p = shieldSpot ?? hotCenter(x + shieldLayout.x, y + shieldLayout.y, sr + 0.75, sr + 0.75), key = `shield${u.id}`;
      badgeG.circle(p.x, p.y, sr).fill({ color: C.shieldFill }).stroke({ width: 1.5, color: C.line });
      const label = badgeLabels.put(key, String(Math.ceil(shieldT.left)), { size: Math.max(8, sr * 1.05), fill: C.white }, p.x, p.y + 0.5);
      label.scale.set(1);
      if (label.width > sr * 1.65) label.scale.x = sr * 1.65 / label.width;
      fitLabel(label, `${key}-text`, 'shield');
      recordBound(key, 'shield', 'circle', p.x, p.y, sr * 2 + 1.5, sr * 2 + 1.5);
      leftY = p.y + sr + 0.75;
    }
    // 보스가 때리는 사람: 테두리 대신 칸 위 조준 표식 (테두리는 디버프 몫). 배지가 있으면 윗줄 배지 위 꼭짓점
    const aimR = Math.max(7, s * 0.2), aimW = Math.max(1.5, aimR * 0.22);
    /** 배지 위 꼭짓점 줄 (조준 표식 · 차례 번호표) */
    const peakY = debBadge ? Math.min(y - r * 0.98, debBadge.y - debBadge.h / 2 - 1 - aimR - aimW / 2) : 0;
    if (tank === u) {
      const br = aimR, bw = aimW;
      let bx = x, by = y - r * 0.98;
      if (debBadge) by = peakY;
      ({ x: bx, y: by } = fitCenter(bx, by, br + bw / 2));
      // 빨간 원 + 십자 (2026-10-16 #184에서 그림으로 바꿨다가 Lim 「탱커에 붙은 공격 표식 아이콘만 그전으로 원복」, 도형 그대로 둠)
      // 상태 그림보다 위 (overTopG): 모양 · 자리 · 크기는 그대로
      overTopG.circle(bx, by, br).fill({ color: C.cell }).stroke({ width: bw, color: C.danger });
      overTopG.circle(bx, by, br * 0.4).moveTo(bx, by - br * 0.8).lineTo(bx, by - br * 0.22).moveTo(bx, by + br * 0.22).lineTo(bx, by + br * 0.8)
        .moveTo(bx - br * 0.8, by).lineTo(bx - br * 0.22, by).moveTo(bx + br * 0.22, by).lineTo(bx + br * 0.8, by)
        .stroke({ width: Math.max(1.2, br * 0.18), color: C.tankMark, cap: 'round' });
      recordBound(`aggro${u.id}`, 'aggro', 'circle', bx, by, br * 2 + bw, br * 2 + bw);
    }
    // 칸 아래 꼭짓점 알약 (성격 상태 · 때리는 적 이름 · 쥐떼): 같이 걸리면 가로로 나란히 (2026-10-16 Lim 「겹치면 수평으로 나란히」, 아래 lowPills)
    const low: { key: string; text: string; bg: number; fg: number }[] = [];
    // 판 위 적이 때리는 사람 (부탱커·딜러) · 자폭 쫄이 노리는 사람: 그 적 이름 (35 3-I)
    const add = F.mobs.find(m => m.alive && m.add && m.add.on === u.id && (m.add.dmg > 0 || m.add.job?.p === 'smash' || m.add.job?.p === 'fixate'));
    if (add) low.push({ key: `add${u.id}`, text: add.add!.short, bg: add.add!.job?.p === 'fixate' ? C.danger : 0xe8b4a8, fg: add.add!.job?.p === 'fixate' ? C.white : C.dark });
    if (F.rats && F.rats.includes(u.id)) low.push({ key: `rat${u.id}`, text: '쥐떼', bg: 0xb9a38a, fg: C.dark });
    // 감옥 (P-JAIL): 갇힌 사람 칸에 창살 (감옥 체력은 디버프 배지). 딜러가 깨는 중이면 금빛 과녁
    const jail = F.mobs.find(m => m.alive && m.add?.hold != null && m.add.on === u.id);
    if (jail) {
      const w = Math.max(2.5, s * 0.07), jt = artTexture(debuffFxArt(F.enc.script, 'hold', jail.name) || addArtName(jail)); // 물거품 감옥 = fx-bubble-trap (63 E 9)
      if (jt) statusArt.put(jt, x, y, r * 1.9, r * 1.9); // 감옥 그림 (37 4장 E-14): 가운데가 비어 파티원 칸이 보임
      else {
        hexPoly(overG, x, y, r * 0.96).fill({ color: 0x4a3f33, alpha: 0.45 });
        for (let k = -2; k <= 2; k++) { const h = k === -2 || k === 2 ? 0.5 : 0.84; overG.moveTo(x + k * r * 0.3, y - r * h).lineTo(x + k * r * 0.3, y + r * h); }
        overG.stroke({ width: w, color: 0xd8c7a8, alpha: 0.75 });
      }
      if (!jt) hexPoly(overG, x, y, r * 0.96).stroke({ width: w * 1.3, color: 0xd8c7a8, alpha: 0.95 }); // 감옥 그림이 있으면 창살 그림만 (2026-10-16 디자이너 검수 17: 테가 세 겹이었음)
      if (jail === focusOrder(F)[0]) {
        // 딜러가 깨는 중: 판 위 적 일점사와 같은 금빛 칼날 표식 (금빛 과녁 원 대신)
        const ft = artTexture('icon-gim-focus'), fz = r * 0.62;
        if (ft) { const fp = fitCenter(x + r * 0.56, y - r * 0.52, fz / 2); marks.put(ft, fp.x, fp.y, fz, fz, 0.75 + 0.25 * pulse); }
        else overG.circle(x, y, r * 0.8).stroke({ width: Math.max(2.5, s * 0.06), color: C.gold, alpha: 0.6 + 0.4 * pulse });
      }
    }
    // 맞을 때 실제로 받을 양 (engine busterOn = damage()와 같은 계산): 탱커 강타가 탱커 아닌 사람에게 가면 직업군 방어력만큼 큼 (2026-10-16 Lim 「예상보다 많이 깎여 한방에 죽음」)
    const bo = busterOn(F, u);
    if (bo) {
      const dmg = Math.ceil(bo.dmg - 1e-6), lethal = bo.dmg >= u.hp + (u.guardian > 0 ? 1e9 : 0), greed = bo.tel.skill.greed != null; // 체력 글자처럼 올림 (보이는 숫자보다 더 깎이지 않게)
      // 강타 예고 숫자는 이름·체력 글자보다 위 (배지 층, 2026-10-11 Lim): 숫자 뒤 바탕이 이름에 덮여 안 읽혔음
      pill(badgeG, badgeLabels, `bus${u.id}`, x, y + r * 0.2, `${greed ? '금화 ' : ''}-${dmg}`, lethal ? C.danger : greed ? C.gold : 0xffb25b, C.dark, fs(0.3, 11));
    }
    // 띄워 올리기 · 연쇄 번개 예고 (56 5장 화면): 칸 아래 회오리 · 위 번개 구름 + 남은 초
    const lc = F.tels.find(tl => (tl.skill.lift || tl.skill.chain) && !tl.fake && tl.units.includes(u.id));
    if (lc) {
      const col = lc.skill.lift ? SKY : BOLT, left = Math.max(0, Math.ceil(lc.impact - F.t));
      const gt = artTexture(lc.skill.lift ? 'fx-lift-warn' : 'fx-chain-cloud');
      if (gt) statusArt.put(gt, x, lc.skill.lift ? y + r * 0.55 : y - r * 0.75, r * 1.3, r * 0.9, 0.75 + 0.25 * pulse);
      else if (lc.skill.lift) dashCircle(overG, x, y + r * 0.5, r * 0.5, 5, 4, Math.max(2, s * 0.06), col, 0.6 + 0.4 * pulse);
      else overG.ellipse(x, y - r * 0.8, r * 0.42, r * 0.18).fill({ color: 0x4a4e66, alpha: 0.85 }).stroke({ width: 2, color: col, alpha: 0.6 + 0.4 * pulse });
      // 남은 초도 강타 예고와 같은 자리 · 같은 층 (이름·체력 글자 위)
      pill(badgeG, badgeLabels, `lc${u.id}`, x, y + r * 0.2, `${lc.skill.lift ? '돌풍' : '번개'} ${left}`, col, C.dark, fs(0.26, 11));
    }
    if (busterIds.has(u.id)) {
      // 중앙 십자선은 이름과 HP를 지나지 않는다. 상단 타깃 표식과 바깥 위험 링으로 예고한다.
      const mark = ringRadius(`buster${u.id}`, 'hex', x, y, r * 1.02, 3);
      // 금 간 붉은 기운 + 무쇠 가시 띠 (fx-edge-buster, 2026-10-16 검수: 평면 빨간 선 한 줄이라 장판 위 · 체력 위험 테와 같아 보였음)
      if (!edgeRing('fx-edge-buster', x, y, mark + s * 0.04, Math.max(6, s * 0.21), 0.65 + 0.35 * pulse)) hexPoly(overG, x, y, mark).stroke({ width: 3, color: C.tel, alpha: 0.6 + 0.4 * pulse });
    }
    // 차례 (P-ORDER): 은쟁반 번호표, 받은 번호는 꺼지고 다음 번호는 금빛. 직업 그림 왼쪽 (이름을 안 가리게)
    // 신기루 숫자 (54 4-1): 걷히기 전까지 진짜 번호와 똑같이 보임
    const ok = F.order ? (F.order.fake && F.order.fake.id === u.id && F.t < F.order.fake.until ? F.order.fake.num : F.order.ids.indexOf(u.id)) : -1;
    // 보통 칸에 배지가 있으면 윗줄 왼쪽이 배지 자리라 꼭짓점 줄로 (조준 표식이 있으면 그 왼쪽)
    // 왼쪽 위에 보호막 원이 있으면 그 아래 (왼쪽 열)
    const markAt = (text: string, size: number) => !peakY ? { x: x - r * 0.55, y: leftY != null ? leftY + 1 + (size * 1.32 + 1.5) / 2 : y - r * 0.42 }
      : { x: tank === u ? x - aimR - aimW / 2 - 1 - (measure(text, size) + size * 0.7) / 2 : x, y: peakY };
    let markBox: PillBox | undefined;
    if (F.order && ok >= F.order.i) {
      // 은쟁반 번호패 그림 (board-order-token, 2026-10-16 Lim 「다음 그림도」) 위에 숫자, 다음 번호는 금빛으로 물들이고 깜빡임. 그림이 없으면 예전 알약
      const tt = artTexture('board-order-token'), size = fs(0.3, 12), z = size * 1.75, m = markAt(ORDER_NUM[ok], size), now1 = ok === F.order.i, a = now1 ? 0.75 + 0.25 * pulse : 1;
      if (tt) {
        const tp = fitCenter(m.x, m.y, z / 2);
        marks.put(tt, tp.x, tp.y, z, z, a, now1 ? 0xffd36a : 0xffffff);
        badgeLabels.put(`ord${u.id}`, String(ok + 1), { size: size * 0.95, fill: C.dark, weight: W_NUM }, tp.x, tp.y + size * 0.04, a);
        markBox = { x: tp.x, y: tp.y, w: z, h: z };
        recordBound(`ord${u.id}`, 'pill', 'icon', tp.x, tp.y, z, z);
      } else markBox = pill(overTopG, labels, `ord${u.id}`, m.x, m.y, ORDER_NUM[ok], now1 ? C.gold : 0xd9dde6, C.dark, size, a);
    }
    else if (u.debuffs.some(d => d.invert)) {
      // 뒤집힌 축복: 그림 (icon-gim-invert, 힐하면 피해). ✕ 알약은 「해제 불가 ×」로 읽혀 그림으로 바꿈 (2026-10-16 QA · CLAUDE.md × 금지 규칙)
      const it = artTexture('icon-gim-invert'), z = fs(0.28, 11) * 1.75, m = markAt('✕', fs(0.28, 11));
      if (it) { marks.put(it, m.x, m.y, z, z); markBox = { x: m.x, y: m.y, w: z, h: z }; recordBound(`inv${u.id}`, 'mark', 'icon', m.x, m.y, z, z); }
      else markBox = pill(overTopG, labels, `inv${u.id}`, m.x, m.y, '✕', 0x7fa88c, C.dark, fs(0.28, 11));
    }
    if (markBox && !peakY && leftY != null) leftY = markBox.y + markBox.h / 2;
    // 빛의 전이 (사제 8번째 칸): 보통 칸은 왼쪽 위 (지속 힐 원 반대편) 금빛 원 + 흰 빛 구슬.
    // 윗줄에 배지가 있거나 왼쪽 위에 차례 번호표 · ✕가 있으면 꼭짓점 줄에서 조준 표식 · 번호표 오른쪽
    if (relay) {
      const dr = Math.max(7, s * 0.19);
      let p: { x: number; y: number };
      if (!peakY && (!markBox || leftY != null)) { p = hotCenter(x - r * 0.56, leftY != null ? leftY + 1 + dr : y - r * 0.44, dr + 0.75, dr + 0.75); if (leftY != null) leftY = p.y + dr; }
      else {
        const right = Math.max(tank === u ? x + aimR + aimW / 2 : -Infinity, markBox ? markBox.x + markBox.w / 2 : -Infinity);
        p = fitCenter(isFinite(right) ? right + 1 + dr : x, peakY || y - r * 0.98, dr + 0.75);
      }
      marks.put(relayMark(), p.x, p.y, dr * 2, dr * 2);
      recordBound(`relay${u.id}`, 'relay', 'circle', p.x, p.y, dr * 2, dr * 2);
    }
    // 결계사 인장 · 점성술사 별자리 표식 (80 5장): 칸 왼쪽 위에 작게 (지속 치유 시간 원의 반대편, 보호막 원이 있으면 그 아래). 이름 · 체력 · 직업 아이콘은 그 자리 그대로, 글자 · 배지가 위에 그려짐
    const sign = F.hero === 'warder' && sealed(F, u) ? 'board-seal' : F.hero === 'astrologer' && u.hots.some(h => h.key === 'starMark' && h.left > 0) ? 'board-star-mark' : '';
    if (sign) {
      const size = r * (sign === 'board-seal' ? 0.52 : 0.57) * (leftY != null ? 0.85 : 1), half = (size * HERO_ART_BOX[sign][1]) / 2; // 보호막 원 아래로 내려가면 이름에 덜 걸리게 조금 작게
      heroArt(marks, sign, `hero-sign${u.id}`, x - r * 0.56, leftY != null ? leftY + 1 + half : y - r * 0.44, size, sign === 'board-seal' && u.seal! - F.t < 2 ? 0.5 + 0.5 * pulse : 1, true);
    }
    if (F.t < u.wrongUntil && F.t > u.wrongUntil - 0.6) pill(overTopG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '?', C.gold, C.dark, fs(0.28, 11));
    else if (F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) pill(overTopG, labels, `q${u.id}`, x + r * 0.62, y - r * 0.05, '!', 0xff5a3d, C.dark, fs(0.28, 11));
    const st = u.lift ? ([`하늘 ${Math.max(0, Math.ceil(u.lift.until - F.t))}`, '#9FD8F5'] as const) : u.pulled ? ([`끌림 ${Math.ceil(u.pulled.until - F.t)}`, '#C98B5A'] as const) : u.fleeing ? (['도망', '#DB9B57'] as const) : u.sulking ? (['삐짐', '#D68FA6'] as const)
      : u.ps?.panicUntil != null && F.t < u.ps.panicUntil ? (['당황', '#D68FA6'] as const) : u.ps?.rageUntil != null && F.t < u.ps.rageUntil ? (['분노', '#E0705A'] as const) : null; // 소심이 · 다혈질 (75)
    if (st && s >= 40) low.unshift({ key: `st${u.id}`, text: st[0], bg: hex(st[1]), fg: C.dark });
    else if (st) hexPoly(overG, x, y, ringRadius(`status${u.id}`, 'hex', x, y, r * 0.95, 3)).stroke({ width: 3, color: hex(st[1]), alpha: 0.5 + 0.5 * pulse });
    lowPills(low, x, y + r * 0.95, fs(0.18, 9));
  }
  // 표시된 글자 bounds만 노출한다. 값이 바뀔 때만 기록하며 전투/입력 상태에는 관여하지 않는다.
  let neighborGap = Infinity;
  for (let i = 0; i < hpBounds.length; i++) for (let j = i + 1; j < hpBounds.length; j++) {
    const a = hpBounds[i], b = hpBounds[j];
    if (hexDist(F.cells[a.cell], F.cells[b.cell]) !== 1 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2) continue;
    neighborGap = Math.min(neighborGap, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
  }
  const sk = L.k; // 화면 px로 (판을 줄여 그리면 k < 1)
  const hpMetrics = {
    hpTextWidthLimit: (r * 1.56 * sk).toFixed(2),
    hpTextMaxWidth: (Math.max(0, ...hpBounds.map(b => b.w)) * sk).toFixed(2),
    hpTextMinHeight: hpBounds.length ? (Math.min(...hpBounds.map(b => b.h)) * sk).toFixed(2) : '',
    hpTextMinScaleX: hpBounds.length ? Math.min(...hpBounds.map(b => b.sx)).toFixed(3) : '',
    hpTextMinNeighborGap: Number.isFinite(neighborGap) ? (neighborGap * sk).toFixed(2) : '',
    hpTextBounds: JSON.stringify(hpBounds.map(b => ({ ...b, x: +(b.x * sk).toFixed(2), y: +(b.y * sk).toFixed(2), w: +(b.w * sk).toFixed(2), h: +(b.h * sk).toFixed(2), sx: +b.sx.toFixed(3) }))),
  };
  for (const [key, value] of Object.entries(hpMetrics)) if (cv.dataset[key] !== value) cv.dataset[key] = value;
  meEmblem.visible = meShown;
  // 장전 하이라이트
  if (armedKey) {
    if (areaArmed && areaCenter >= 0) {
      const c0 = F.cells[areaCenter];
      const ar = areaRadius(F, armedKey);
      F.cells.forEach((c, i) => { if (hexDist(c, c0) <= ar) { const p = center(i); hexPoly(overG, p.x, p.y, ringRadius(`armed-area${i}`, 'hex', p.x, p.y, r * 1.04, 3)).fill({ color: C.white, alpha: 0.14 }).stroke({ width: 3, color: hex(SEL) }); } });
    } else if (SKILLS[armedKey].target === 'cell') { // 칸에 세우는 스킬 (주술사 토템): 무너진 바닥 말고 모든 칸 (빈 칸도)
      F.cells.forEach((c, i) => { if (c.block !== 'hole') { const p = center(i); hexPoly(overG, p.x, p.y, ringRadius(`armed-cell${i}`, 'hex', p.x, p.y, r * 1.04, 2)).stroke({ width: 2, color: C.white, alpha: 0.3 + 0.4 * pulse }); } });
    } else for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPoly(overG, p.x, p.y, ringRadius(`armed${u.id}`, 'hex', p.x, p.y, r * 1.04, 2)).stroke({ width: 2, color: C.white, alpha: 0.3 + 0.4 * pulse }); }
  }
  // 칸 특성 장전 (쉼터 등): 빈 칸을 금빛 테두리로
  if (ui.talArmed) F.cells.forEach((c, i) => { if (!c.unit) { const p = center(i); hexPoly(overG, p.x, p.y, ringRadius(`talent-armed${i}`, 'hex', p.x, p.y, r * 0.96, 2.5)).stroke({ width: 2.5, color: C.gold, alpha: 0.35 + 0.5 * pulse }); } });
  // 튜토리얼 안내가 짚는 칸
  if (ui.coach && ui.coach.uid != null) {
    const cu = F.party.find(u => u.id === ui.coach!.uid);
    if (cu && cu.alive) { const p = unitPos(cu); hexPoly(overG, p.x, p.y, ringRadius(`coach${cu.id}`, 'hex', p.x, p.y, r * (1.18 + 0.06 * pulse), 4)).stroke({ width: 4, color: C.gold, alpha: 0.55 + 0.45 * pulse }); }
  }

  // 실제 최종 HP·이름·상태 표시를 먼저 보호한다. 일시 연출은 다른 연출과도 겹치지 않는다.
  // 탱커 조준 표식 (aggro)은 비키지 않고 그 위에 겹쳐 뜸 (2026-10-16 Lim 「타겟 마크 때문에 숫자가 옆으로 뜸」, 숫자 층이 맨 위)
  const transientOccupied: PillBox[] = decorationBounds.filter(b => ['hp', 'nick', 'hot', 'shield', 'debuff', 'role', 'pill'].includes(b.kind));
  // 떠오르는 숫자 (2026-10-12 Lim 「힐 수치 등 숫자 위치가 흔들린다」): 처음 잡은 자리에서 비킨 만큼을 지키며 올라감.
  // 예전엔 프레임마다 빈자리를 새로 찾아, 올라가다 이름 · 체력 · 다른 숫자에 닿으면 옆 · 위 자리로 튀거나 두 자리 사이를 오갔다
  // (빌드 131, S25 5인 숫자 82개 중 76개가 한 번 이상 튐, 최대 80px).
  // 이제 ① 떠오르는 길 (+ 처음 비킨 만큼) ② 막히면 그 자리에 멈춰 흐려짐 ③ 그 자리마저 가려지면 0.35칸 안 빈자리로 ④ 그래도 없으면 그 숫자는 끝 (숨었다 다시 뜨지 않음)
  B2.floats = B2.floats.filter(fl => now - fl.t0 < 900 && (!S.reducedEffects || fl.label));
  // 자기 칸 근처 = 원래 자리에서 0.9r 안 + 다른 파티원 칸보다 자기 칸에 가까움. 10·20인 작은 칸은 칸 안이 이름·체력으로 차서
  // 예전에는 숫자가 판 아래 빈칸이나 다른 사람 칸 옆까지 밀려났다 (2026-10-10 검수, 20인 S25 최대 12.8r)
  const partyAt = F.party.filter(u => u.alive).map(u => ({ id: u.id, ...unitPos(u) }));
  // 아직 안 그린 숫자의 지난 자리도 비워 둠: 먼저 뜬 숫자가 올라가다 나중 숫자 자리를 빼앗아 밀어내지 않게
  const floatLast = new Map(B2.floats.filter(fl => fl.at).map(fl => [fl, fl.at!]));
  const floatGone = new Set<Float>();
  // 회복 · 보호막 숫자가 먼저 자리를 잡고 피해 숫자는 남은 자리 (이미 뜬 피해 숫자 자리는 floatLast가 지켜 줌)
  const order = B2.floats.some(fl => fl.dmg) ? [...B2.floats.filter(fl => !fl.dmg), ...B2.floats.filter(fl => fl.dmg)] : B2.floats;
  for (const fl of order) {
    floatLast.delete(fl);
    if (now < fl.t0) continue; // 아직 안 뜬 숫자 (연쇄 치유가 차례로 튐)
    const u = F.party.find(q => q.id === fl.id);
    if (!u) { floatGone.add(fl); continue; }
    const base = unitPos(u), k = (now - fl.t0) / 900, rise = S.reducedEffects ? 0 : k * s * (fl.label ? 0.3 : 0.6);
    const size = fl.label ? fs(0.22, 10) : fl.crit ? fs(0.36, 14) : fl.big ? fs(0.27, 11) : fl.over || fl.fill ? fs(0.22, 10) : fs(0.27, 11);
    const label = (fl.num ? nums : tops).put(`fl${fl.n}`, fl.text, { size, fill: fl.fill ?? (fl.shield ? C.shield : fl.crit ? C.crit : fl.over ? C.over : C.heal), strokeW: 3, num: !fl.fill || !!fl.dmg },
      base.x + (fl.dx + (fl.ox ?? 0)) * s, base.y + (fl.dy + (fl.oy ?? 0)) * s - rise, S.reducedEffects ? 1 : 1 - k * k, 1);
    // 치명타 치유 = 선명한 초록 (C.crit, 보통 치유 민트보다 진하고 1.3배 크게. 2026-10-10 Lim: 노랑은 치유와 안 어울리고 부활·능력 글자와 헷갈림)
    // 처음 0.15초 크게 튀었다가 제 크기로 (색만으로 구분하지 않게)
    if (fl.crit && !fl.fill && !S.reducedEffects && k < 0.17) label.scale.set(1 + 0.45 * (1 - k / 0.17));
    const b = boundsOf(label), x = (b.minX + b.maxX) / 2, y = (b.minY + b.maxY) / 2, w = b.maxX - b.minX, h = b.maxY - b.minY;
    const own = partyAt.find(q => q.id === fl.id), others = own ? partyAt.filter(q => q !== own && Math.hypot(q.x - own.x, q.y - own.y) < s * 4) : [];
    const closer = (px: number, py: number) => !own || others.every(q => (px - q.x) ** 2 + (py - q.y) ** 2 > (px - own.x) ** 2 + (py - own.y) ** 2);
    const occupied = floatLast.size ? transientOccupied.concat([...floatLast.values()]) : transientOccupied;
    // 자리가 없으면 자기 직업 아이콘 위는 덮어도 됨 (칸 색이 직업을 보여 줌). 작은 칸 가운데 사람은 이 자리뿐
    const roleFree = own ? occupied.filter(o => (o as DecorationBound).key !== `role${own.id}`) : occupied;
    // 회복 · 보호막 · 피해 숫자는 처음부터 자기 직업 아이콘 · 조준 표식 위에 겹쳐 모든 칸 같은 자리 (2026-10-16 Lim 「타겟 마크 위에 겹쳐서」).
    // 맨 윗줄 (탱커 1열)은 아이콘 위로 올라갈 자리가 판 밖이라 예전엔 옆으로 비켰음
    const open = fl.num ? roleFree : occupied;
    let p: PillBox | null;
    if (fl.at) {
      const stay = (px: number, py: number, occ: readonly PillBox[]): PillBox | null => {
        const c = fitCenter(px, py, w / 2, h / 2);
        return Math.abs(c.x - px) < 0.01 && Math.abs(c.y - py) < 0.01 && closer(px, py) && clearOf(occ, px, py, w, h) ? { x: px, y: py, w, h } : null;
      };
      // 멈춘 숫자 밑에 나중에 생긴 배지 · 지속 힐 · 아이콘은 덮고 그대로 흐려짐 (이름 · 체력 · 다른 숫자만 비킴)
      const hard = roleFree.filter(o => !(o as DecorationBound).kind || (o as DecorationBound).kind === 'hp' || (o as DecorationBound).kind === 'nick');
      const at = fl.at, hy = y + rise - (fl.rise ?? rise);
      p = stay(x, y, roleFree) ?? stay(x, hy, roleFree) ?? stay(x, hy, hard)
        ?? transientSpot({ ...at, w, h }, roleFree, (px, py) => (px - at.x) ** 2 + (py - at.y) ** 2 <= (s * 0.35) ** 2 && closer(px, py));
    } else {
      // 처음 자리: 떠오르는 길 0.9r 안. 체력 글자는 한 자리 늘어날 만큼 넓게 비켜 둠 (95% → 100%: 옆에 붙은 숫자가 밀려나지 않게), 그런 자리가 없으면 딱 맞게
      const near = (px: number, py: number) => (px - x) ** 2 + (py - y) ** 2 <= (r * 0.9) ** 2 && closer(px, py);
      const roomy = (occ: readonly PillBox[]) => occ.map(o => ((o as DecorationBound).kind === 'hp' ? { ...o, w: o.w + o.h * 0.6 } : o));
      const box = { x, y, w, h };
      p = transientSpot(box, roomy(open), near) ?? transientSpot(box, open, near)
        ?? (own ? transientSpot(box, roomy(roleFree), near) ?? transientSpot(box, roleFree, near) : null);
    }
    if (!p) {
      label.visible = false;
      // 자리를 못 잡은 숫자는 잠깐만 기다림 (늦게 뜨면 다른 숫자처럼 읽힘)
      if (fl.at || k > 0.3) floatGone.add(fl);
      continue;
    }
    label.position.set(label.x + p.x - x, label.y + p.y - y);
    fl.ox = (fl.ox ?? 0) + (p.x - x) / s; fl.oy = (fl.oy ?? 0) + (p.y - y) / s; fl.at = p; fl.rise = rise;
    recordBound(`float${fl.n}`, 'float', 'text', p.x, p.y, p.w, p.h, { uid: fl.id });
    transientOccupied.push(p);
  }
  if (floatGone.size) B2.floats = B2.floats.filter(fl => !floatGone.has(fl));
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
  // 기믹·위기 말풍선이 먼저 자리를 잡음 (같은 종류는 먼저 뜬 순서)
  for (const b of [...B2.bubbles].sort((x, y) => BUBBLE_RANK[x.kind] - BUBBLE_RANK[y.kind] || x.added - y.added)) {
    const u = F.party.find(x => x.id === b.id); if (!u) continue;
    const p = unitPos(u);
    // 감정 아이콘 자리는 그림 파일이 있으면 처음부터 잡아 둠 (읽는 동안 너비가 바뀌지 않게)
    const emote = b.emote ? `emote-${b.emote}` : '', iw = emote && art(emote) ? EMOTE_W : 0;
    const text = fitPartyName(b.text, Math.max(1, L.right - L.left - 16 - iw), value => measure(value, 12, FONT, '500'));
    const st = BUBBLE[b.kind];
    // 꼬리 끝이 말한 사람 칸 꼭짓점에 닿는 자리만 (bubbleSpot). 몸체 · 꼬리 · 선 · 위기 흔들림 폭까지 이름 · 체력 · 다른 연출을 피함
    const tail = 5, strokePad = st.lw, shakeRange = b.kind === 'alert' && !S.reducedEffects && now - b.t0 < 300 ? 1.5 : 0;
    const label = tops.put(`bb${b.id}`, text, { size: 12, fill: C.dark, weight: '500' }, 0, 0, 0);
    const w = Math.max(measure(text, 12, FONT, '500'), label.width) + 14 + iw, h = Math.max(22, label.height + 3);
    const bp = bubbleSpot(p, r, w, h, strokePad + shakeRange, tail,
      transientOccupied.filter(o => !(o as DecorationBound).kind || (o as DecorationBound).kind === 'hp' || (o as DecorationBound).kind === 'nick'),
      transientOccupied.filter((o): o is DecorationBound => !!(o as DecorationBound).kind && (o as DecorationBound).kind in BUBBLE_SOFT),
      F.party.filter(o => o !== u && o.alive).map(unitPos));
    if (!bp) {
      label.visible = false;
      if (b.shown) continue; // 떠 있던 말풍선은 이 프레임만 쉼 (사람이 움직이는 중)
      // 아직 못 뜬 말풍선: 잠깐 기다렸다가 자리가 안 나면 생략 (기믹 · 위기 대사도 다른 곳으로 옮기지 않음)
      if (now - b.added < BUBBLE_WAIT) { b.t0 = now; continue; } // 다른 말풍선이 비켜 주길 기다림 (보이는 시간은 뜰 때부터)
      B2.bubbles = B2.bubbles.filter(x => x !== b);
      continue;
    }
    b.shown = true;
    const age = now - b.t0, a = S.reducedEffects ? 1 : Math.max(0, Math.min(1, (b.life - age) / 300));
    label.alpha = a;
    const textBounds = boundsOf(label);
    const shake = shakeRange ? Math.sin(age / 25) * shakeRange : 0;
    const bx = bp.x - w / 2 + shake;
    const by = bp.y - h / 2;
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
    transientOccupied.push(bp.foot);
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
  labels.end(); badgeLabels.end(); tops.end(); nums.end(); decals.end(); fxArt.end(); marks.end(); stands.end(); ringArt.end(); statusArt.end(); pxfArt.end(); bubbleBack.end(); bubbleFront.end();
  for (let i = stripUsed; i < strips.length; i++) strips[i].visible = false;
  lensL.visible = false;
  app.renderer.render(app.stage);
  // 20인 탭 확대 미리보기 0.3초 (02 3-1): 손가락에 가리지 않게 칸 위쪽에 1.8배로
  if (B2.lens && now - B2.lens.t0 < 300) drawLens(now); else B2.lens = null;
  // Canvas-local CSS px. 실제 표시 위치/크기만 기록하며 전투·입력 상태를 수정하지 않는다.
  // 판을 줄여 그리면 (L.k < 1) 길이 값을 화면 px로
  const metrics = JSON.stringify(decorationBounds.map(b => Object.fromEntries(Object.entries(b).map(([key, value]) => [key, typeof value === 'number' ? +(BOUND_LEN.has(key) ? value * L.k : value).toFixed(3) : value]))));
  if (cv.dataset.decorationBounds !== metrics) cv.dataset.decorationBounds = metrics;
}

/** 이름이 칸보다 길 때 글자 높이는 그대로 두고 가로만 이만큼까지 좁힘 (그래도 넘치면 말줄임) */
const NICK_MIN_SX = 0.82;
function nick(u: Unit, x: number, y: number, r: number): { x: number; y: number; w: number; h: number } {
  // 글자 크기는 칸 크기를 따름 (cellTypography, 9px 이상). 넘치면 가로만 좁히고 (레이드 칸의 다섯 글자 이름, 2026-10-16), 그래도 넘치면 말줄임.
  // 전체 이름은 길게 누르기 정보에도 남는다. 밝은 칸 (사제 「나」 · 하늘색 · 청록)에서도 읽히게 테두리를 체력 숫자만큼 굵게
  const maxW = r * 1.45;
  const size = cellTypography(L.s).nick;
  const text = measure(u.nick, size) <= maxW ? u.nick : fitPartyName(u.nick, maxW / NICK_MIN_SX, text => measure(text, size));
  const label = labels.put(`nk${u.id}`, text, { size, fill: C.ink, strokeW: size < 11 ? 2.25 : 3 }, x, y);
  const w = measure(text, size);
  if (w > maxW) label.scale.x = maxW / w;
  return fitLabel(label, `nick${u.id}`, 'nick');
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
