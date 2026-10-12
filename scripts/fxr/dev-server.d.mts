// scripts/fxr/dev-server.mjs 타입 (vite.config.ts · tests가 씀)
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { PxfGraph } from './render.mjs';

export interface GraphEntry { name: string; title: string; size: number; frames: number; timeline: boolean; strip: boolean }
export const NAME: RegExp;
export function bakeLayout(graph: PxfGraph): { size: number; grid: boolean };
export function listGraphs(dir?: string, artDir?: string): GraphEntry[];
export function saveGraph(name: string, graph: PxfGraph, dir?: string): { file: string; warns: string[] };
export function bakeGraph(name: string, graph: PxfGraph, artDir?: string): { file: string; w: number; h: number; size: number; frames: number; cols: number; ms: number };
export function handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
export function fxLabPlugin(): Plugin;
