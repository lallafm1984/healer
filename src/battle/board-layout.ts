/** 표시된 육각형과 외곽선을 기준으로 같은 배율을 두 축에 적용한다. */
export const CELL_RADIUS = 0.93;
const EDGE = 2;
const TOP_MARK_SPACE = 6;
export interface BoardPoint { px: number; py: number }
export interface BoardInsets { left?: number; right?: number; footer?: number }

/** 지속 치유 시간은 오른쪽 위에서 아래로 배치하며, 전체 열을 칸 중앙 높이 안에 둡니다. */
export function hotTimerLayout(scale: number, count: number) {
  const r = scale * CELL_RADIUS, multi = count > 1;
  const radius = multi ? Math.min(Math.max(7, scale * 0.17), (r * 0.88 / (count - 1) - 2) / 2) : Math.max(7, scale * 0.19);
  return { radius, step: radius * 2 + 2, x: r * (multi ? 0.62 : 0.56), y: -r * 0.44 };
}

export function fitBoard(cells: readonly BoardPoint[], width: number, height: number, insets: BoardInsets = {}) {
  const W = Math.max(1, width), H = Math.max(1, height);
  const requestedLeft = Math.max(0, insets.left || 0) + EDGE;
  const requestedRight = W - Math.max(0, insets.right || 0) - EDGE;
  const hasWidth = requestedRight - requestedLeft >= 1;
  const left = hasWidth ? requestedLeft : (W - 1) / 2;
  const right = hasWidth ? requestedRight : left + 1;
  const top = EDGE, bottom = Math.max(top + 1, H - Math.max(0, insets.footer || 0) - EDGE);
  const gridTop = Math.min(bottom - 1, top + TOP_MARK_SPACE);
  const xs = cells.map(c => c.px), ys = cells.map(c => c.py);
  const minX = Math.min(...xs, ...(cells.length ? [] : [0])), maxX = Math.max(...xs, ...(cells.length ? [] : [0]));
  const minY = Math.min(...ys, ...(cells.length ? [] : [0])), maxY = Math.max(...ys, ...(cells.length ? [] : [0]));
  // 기본 외곽선은 max(2.5, s*.07). 두 경우의 상한을 모두 지켜 크기가 커져도 끝이 잘리지 않는다.
  const limit = (space: number, span: number, strokeFactor = 1) => Math.max(0.1, Math.min((space - 2.5 * strokeFactor) / span, space / (span + 0.07 * strokeFactor)));
  const sx = limit(right - left, maxX - minX + CELL_RADIUS * Math.sqrt(3));
  // 위아래 꼭짓점의 miter는 외곽선 반폭보다 2/√3배 더 뻗는다.
  const sy = limit(bottom - gridTop, maxY - minY + CELL_RADIUS * 2, 2 / Math.sqrt(3));
  const s = Math.min(sx, sy);
  return {
    s, W, H, left, right, top, bottom,
    ox: (left + right - (minX + maxX) * s) / 2,
    oy: (gridTop + bottom - (minY + maxY) * s) / 2,
    axis: sx <= sy ? 'horizontal' : 'vertical',
  };
}
