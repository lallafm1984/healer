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

/** 판 위 상자 (가운데 · 너비 · 높이) */
export interface BoardBox { x: number; y: number; w: number; h: number }
/** 1px 띄우고 겹치지 않음. 바로 옆에 붙여 고른 자리 (떠오르는 숫자 후보)가 부동소수 오차로 「겹침」이 되지 않게 아주 조금 봐줌 */
export function clearOf(occupied: readonly BoardBox[], x: number, y: number, w: number, h: number): boolean {
  return occupied.every(b => Math.abs(x - b.x) >= (w + b.w) / 2 + 1 - 1e-6 || Math.abs(y - b.y) >= (h + b.h) / 2 + 1 - 1e-6);
}
/** 떠오르는 숫자 (회복 · 보호막 · 피해 · 능력 이름)가 비키는 판 기록 종류: 이름 · 체력 · 지속 힐 원 · 보호막 원 · 방어 생존기 원 · 디버프 배지 · 직업 아이콘 · 알약 */
const FLOAT_AVOID = new Set(['hp', 'nick', 'hot', 'shield', 'guard', 'seal', 'starmark', 'talent', 'debuff', 'role', 'pill']); // 왼쪽 열 원 (보호막 · 방어 생존기 · 인장 · 별자리 표식 · 특성 지속 효과)도 떠오르는 숫자가 비킴
/**
 * 떠오르는 숫자가 비킬 판 기록. 칸만 한 육각 테두리 (디버프 테 debuff-ring)는 빼고: 피하면 칸 전체가 막혀 디버프가 걸린 사람 숫자가
 * 판 맨 위 (윗줄)로만 밀려나고 다른 줄은 아예 못 떴다 (2026-10-17 Lim 「포자 솜뭉치의 피해 표시가 최상단만 뜨고 다른 데는 안 됨」)
 */
export const floatBlocks = (b: { kind: string; shape: string }): boolean => FLOAT_AVOID.has(b.kind) && b.shape !== 'hex';

/**
 * 칸 왼쪽 시간 원 (보호막 2026-10-16 · 방어 생존기 2026-10-18): 지속 힐 원 열을 칸 왼쪽으로 뒤집음 (x는 칸 가운데에서 왼쪽으로 음수).
 * count = 보호막 원 + 방어 생존기 원 수, 위에서 아래로 step씩 (여러 개면 지속 힐 원 여러 개와 같은 크기)
 */
export function shieldTimerLayout(scale: number, count = 1) {
  const hot = hotTimerLayout(scale, count);
  return { radius: hot.radius, step: hot.step, x: -hot.x, y: hot.y };
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
