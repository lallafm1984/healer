/**
 * 파티원 직업 아이콘 한 벌 (편성 칸·줄 · 전투 칸이 같이 씀).
 * 2026-10-13 Lim 「직업별 모양을 인게임에서도 동일하게 사용하고, 인게임 디자인의 모양으로 직업별로 다시 만들어보자」:
 * 전투 칸 역할 아이콘 (방패 · 칼 · 활)처럼 크림색 몸 + 검은 테. 24칸 판에 그린 SVG 길 하나를 화면 (SVG)과 전투판 (Pixi)이 같이 읽는다.
 * 조각마다 검은 테 → 크림색 → 검은 새김 순서로 그려, 뒤 조각 위에 앞 조각의 테가 보인다.
 */
import type { ClassKey } from '../data/classes';

export interface GlyphPart {
  /** 크림색으로 채우는 모양 (둘레에 검은 테) */
  fill?: string;
  /** 크림색 선 (둘레에 검은 테) */
  line?: string;
  /** 크림색 위에 새기는 검은 선 */
  cut?: string;
  /** 선 굵기 (기본 LINE) */
  w?: number;
  /** 가운데 (12, 12) 기준 시계 방향 회전 (도), 그 뒤 dx · dy 만큼 옮김 */
  rot?: number;
  dx?: number;
  dy?: number;
}

/** 전투판 색 (board.ts C.ink · C.line) */
export const GLYPH_INK = '#F1E4C8';
export const GLYPH_EDGE = '#080605';
/** 24칸 판 기준 굵기: 테 (모양 밖으로 보이는 두께) · 선 · 새김 */
export const EDGE = 1.25;
export const LINE = 2.4;
export const CUT = 1.7;

/** 원 = 3차 곡선 넷. 호 (A)는 쓰지 않는다: Pixi는 돌린 호의 반지름을 틀리게 옮김 (GraphicsPath.transform) */
const circ = (x: number, y: number, r: number) => {
  const k = r * 0.5523, n = (v: number) => +v.toFixed(2);
  return `M${n(x - r)} ${y}C${n(x - r)} ${n(y - k)} ${n(x - k)} ${n(y - r)} ${x} ${n(y - r)}C${n(x + k)} ${n(y - r)} ${n(x + r)} ${n(y - k)} ${n(x + r)} ${y}`
    + `C${n(x + r)} ${n(y + k)} ${n(x + k)} ${n(y + r)} ${x} ${n(y + r)}C${n(x - k)} ${n(y + r)} ${n(x - r)} ${n(y + k)} ${n(x - r)} ${y}Z`;
};

/** 전투 칸 탱커 방패와 같은 모양 (위 평평 · 아래 뾰족) */
const shield = (cx: number, top: number, hw: number, h: number) => {
  const side = top + h * 0.44, bot = top + h, cy = top + h * 0.83;
  return `M${cx - hw} ${top}H${cx + hw}V${side}Q${cx + hw * 0.89} ${cy} ${cx} ${bot}Q${cx - hw * 0.89} ${cy} ${cx - hw} ${side}Z`;
};

/** 세운 칼 (끝이 위, x = 12): 칼날 · 코등이 · 손잡이 · 머리. 회전해서 씀 */
const sword = (tip: number, base: number, hw: number, guard: number, grip: number, pommel: number): GlyphPart => ({
  fill: `M12 ${tip}L${12 + hw} ${tip + hw * 1.6}V${base}H${12 - hw}V${tip + hw * 1.6}Z${circ(12, grip + pommel * 0.75, pommel)}`,
  line: `M${12 - guard} ${base + 0.4}H${12 + guard}M12 ${base + 0.4}V${grip}`,
});

/** 세운 단검 (끝이 위, 좁은 세모 칼날): 칼날 가운데가 (12, 12) 근처에 오게 아래로 내려 그림 → 돌려도 칼날끼리 엇갈림 */
const dagger: GlyphPart = {
  fill: `M12 3.2L13.35 6.17V16.4H10.65V6.17Z${circ(12, 21.1, 1.1)}`,
  line: 'M9 16.8H15M12 16.8V19.8',
};

export const CLASS_GLYPH: Record<ClassKey, GlyphPart[]> = {
  // 전사: 전투 칸 방패 + 새긴 칼 (전투 칸 근접 칼처럼 비스듬히)
  warrior: [{ fill: shield(12, 2.6, 8, 19.4), cut: 'M9.4 13.6L16.4 6.6M7.7 11.9L11.1 15.3M9.4 13.6L7.4 15.6' }],
  // 수호기사: 전투 칸 방패 + 새긴 십자
  paladin: [{ fill: shield(12, 2.6, 8, 19.4), cut: 'M12 6.6V16.4M7.9 10.3H16.1' }],
  // 도적: 칼날 가운데서 엇갈린 단검 둘 (손잡이는 아래 양쪽)
  rogue: [-1, 1].map(side => ({ ...dagger, rot: 45 * side, dy: -0.8 })),
  // 광전사: 양날 도끼
  berserker: [{
    line: 'M12 2.6V21.4',
    fill: 'M12.6 5L19.6 2.6C21.7 6.1 21.7 10.9 19.6 14.4L12.6 12ZM11.4 5L4.4 2.6C2.3 6.1 2.3 10.9 4.4 14.4L11.4 12Z',
  }],
  // 검사: 넓은 칼 하나 (전투 칸 근접 칼처럼 비스듬히), 가운데 홈
  swordsman: [{ ...sword(0.6, 16.4, 2.1, 4.2, 20.2, 1.35), cut: 'M12 5.2V14.6', rot: 45 }],
  // 마법사: 구슬 지팡이 + 반짝임
  mage: [
    { line: 'M4.4 20.4L13.4 11.4' },
    { fill: `${circ(16, 8.6, 4.3)}M5.8 2.4L6.9 5 9.5 6.1 6.9 7.2 5.8 9.8 4.7 7.2 2.1 6.1 4.7 5Z`, cut: 'M14.2 11Q12.6 9.2 13.6 7.1' },
  ],
  // 궁수: 활 + 화살 (전투 칸 원거리 활 모양에 화살촉 · 깃)
  archer: [
    { line: 'M11.6 3.6V20.4', w: 1.3, rot: -45 },
    { line: 'M11.6 3.6C19 6 19 18 11.6 20.4M2.8 12H19.4M2.8 12L1.2 9.8M2.8 12L1.2 14.2', fill: 'M23.2 12L18.6 9.3V14.7Z', rot: -45 },
  ],
  // 사냥꾼: 동물 발자국
  hunter: [{
    fill: `M12 11.4C8.3 11.4 5.6 14.5 5.6 17.3C5.6 19.6 7.5 20.9 9.4 20.3C10.6 19.9 11.2 19.6 12 19.6C12.8 19.6 13.4 19.9 14.6 20.3C16.5 20.9 18.4 19.6 18.4 17.3C18.4 14.5 15.7 11.4 12 11.4Z${circ(4.5, 10.2, 2.1)}${circ(8.7, 5.4, 2.25)}${circ(15.3, 5.4, 2.25)}${circ(19.5, 10.2, 2.1)}`,
  }],
};

/** SVG 한 장 (편성 칸 · 줄) */
export function glyphSvg(parts: GlyphPart[]): string {
  const body = parts.map(p => {
    const t = p.rot || p.dx || p.dy ? ` transform="translate(${p.dx || 0} ${p.dy || 0}) rotate(${p.rot || 0} 12 12)"` : '';
    const w = p.w ?? LINE;
    return `<g${t}>${p.fill ? `<path d="${p.fill}" fill="none" stroke="${GLYPH_EDGE}" stroke-width="${EDGE * 2}"/>` : ''}`
      + `${p.line ? `<path d="${p.line}" fill="none" stroke="${GLYPH_EDGE}" stroke-width="${w + EDGE * 2}"/>` : ''}`
      + `${p.fill ? `<path d="${p.fill}" fill="${GLYPH_INK}"/>` : ''}`
      + `${p.line ? `<path d="${p.line}" fill="none" stroke="${GLYPH_INK}" stroke-width="${w}"/>` : ''}`
      + `${p.cut ? `<path d="${p.cut}" fill="none" stroke="${GLYPH_EDGE}" stroke-width="${CUT}"/>` : ''}</g>`;
  }).join('');
  return `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const classGlyphSvg = (cls: ClassKey) => glyphSvg(CLASS_GLYPH[cls]);
