// scripts/fxr/render.mjs 타입 (개발용 이펙트 화면 src/fxlab이 씀)
export type ParamType = 'num' | 'int' | 'sel' | 'bool' | 'color' | 'palette' | 'seed';
export interface ParamSpec { type: ParamType; default: unknown; min?: number; max?: number; options?: string[]; label?: string }
export interface NodeSpec { label?: string; inputs: { p: number; label?: string }[]; params: Record<string, ParamSpec> }
export interface Contract { format: string; limits: { bytes: number; nodes: number; links: number; keyframes: number; frames: number; maxSize: number }; nodes: Record<string, NodeSpec> }
/** 키프레임 [프레임, 값, 이징?] · 구간 {a, b, e, t0, t1} · 고정값 */
export type Keyframe = [number, number] | [number, number, string];
export type Animated = { k: Keyframe[] } | { a: number; b: number; e?: string; t0?: number; t1?: number };
export interface PxfNode { id: string; type: string; x: number; y: number; params: Record<string, unknown> }
export interface PxfLink { f: string; t: string; p: number }
export interface PxfGame { pivot?: [number, number]; logicalSize?: number; blend?: 'normal' | 'add'; impactFrame?: number; referenceCell?: number; [k: string]: unknown }
export interface PxfGraph {
  format: string;
  name: string;
  settings: { size: number; frames: number; fps: number; loop: boolean };
  nodes: PxfNode[];
  links: PxfLink[];
  game?: PxfGame;
}
export const EASE: Record<string, (t: number) => number>;
/** 노드마다 픽셀 단위 파라미터 (크기를 바꾸면 같은 비율로) · 그중 정수 (「노드.값」) */
export const PIXEL_PARAMS: Record<string, string[]>;
export const INT_PARAMS: Set<string>;
export function paramAt(v: unknown, f: number, frames: number): unknown;
export function withDefaults(type: string, params: Record<string, unknown>, contract?: Contract): Record<string, unknown>;
/** 그래프 → 프레임들 (RGBA 8비트, size × size) */
export function renderGraph(graph: PxfGraph, opts?: { size?: number; contract?: Contract }): { size: number; frames: Uint8ClampedArray[] };
