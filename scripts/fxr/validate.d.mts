// scripts/fxr/validate.mjs 타입
import type { Contract } from './render.mjs';
export function validateGraph(graph: unknown, contract: Contract): { errors: string[]; warnings: string[] };
