// scripts/fxr/char.mjs 타입 (개발용 이펙트 공방 캐릭터 화면 src/fxlab/char · 저장 창구 · 테스트)
import type { Animated } from './render.mjs';

export type CharAnim = number | Animated;
export type Channel = 'rot' | 'x' | 'y';
export interface CharPart {
  id: string;
  name: string;
  w: number;
  h: number;
  /** h줄, 줄마다 w글자: '.' = 투명, 0–9 a–v = 팔레트 번호 */
  pixels: string[];
  /** 부품 그림 안 기준점 (픽셀 모서리 좌표) */
  pivot: [number, number];
  parent: string | null;
  /** 부모 그림 안 붙는 자리 (부모가 없으면 캔버스 자리) */
  at: [number, number];
  /** 쉬는 자세 각도 (도, 시계 방향 +) */
  rot?: number;
  z: number;
}
export interface CharMotion {
  id: string;
  name: string;
  frames: number;
  fps: number;
  loop: boolean;
  tracks: Record<string, Partial<Record<Channel, CharAnim>>>;
  /** 프레임 → [x, y, 팔레트 번호 (-1 = 투명)] */
  edits?: Record<string, [number, number, number][]>;
}
export interface CharDoc { format: 'healer.char@1'; name: string; size: number; palette: string[]; parts: CharPart[]; motions: CharMotion[] }
export interface SheetMeta { format: string; name: string; size: number; motions: { id: string; name: string; row: number; frames: number; fps: number; loop: boolean }[] }

export const CHAR_FORMAT: 'healer.char@1';
export const CHAR_LIMITS: { size: [number, number]; palette: number; parts: number; part: number; motions: number; frames: number; fps: number; keyframes: number; edits: number };
export const CHANNELS: Channel[];
export function decodePixel(ch: string | undefined): number;
export function encodePixel(c: number): string;
export function drawOrder(doc: CharDoc): CharPart[];
export function channelAt(motion: CharMotion | null, partId: string, ch: Channel, frame: number): number;
export function poseAt(doc: CharDoc, motion: CharMotion | null, frame: number): Map<string, { x: number; y: number; rot: number }>;
export function renderCharFrame(doc: CharDoc, motion: CharMotion | null, frame: number, opts?: { edits?: boolean; hide?: string[] }): { idx: Int16Array; owner: Int16Array };
export function charRgba(doc: CharDoc, idx: Int16Array): Uint8ClampedArray;
export function renderCharSheet(doc: CharDoc): { w: number; h: number; rgba: Uint8ClampedArray; meta: SheetMeta };
export function validateChar(doc: unknown): { errors: string[]; warnings: string[] };
/** 저장용 JSON (숫자 배열은 한 줄로) */
export function charJson(doc: CharDoc): string;
