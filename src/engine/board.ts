import type { Cell } from './types';

const SQ3 = Math.sqrt(3);

export function makeCells(def: number[][]): Cell[] {
  const cells: Cell[] = [];
  def.forEach((cols, row) => cols.forEach(col => {
    const q = col - (row - (row & 1)) / 2;
    cells.push({ i: cells.length, col, row, q, r: row, px: SQ3 * (col + 0.5 * (row & 1)), py: 1.5 * row, unit: null });
  }));
  return cells;
}

export const hexDist = (a: Cell, b: Cell): number => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
