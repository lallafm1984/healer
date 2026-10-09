import { describe, expect, it } from 'vitest';
import { fitBoard, type BoardInsets, type BoardPoint } from '../src/battle/board-layout';
import { BOARDS } from '../src/data/boards';
import { ENCOUNTERS } from '../src/data/encounters';
import { makeCells } from '../src/engine/board';

type Layout = ReturnType<typeof fitBoard>;
const EPS = 1e-7;
const boards = Object.entries(BOARDS).map(([name, rows]) => ({ name, cells: makeCells(rows) }));

// 기존 concept4 매트릭스의 보드 영역 크기. 실기기 viewport나 전체 화면 높이가 아니다.
const frames = [
  { name: '320×640 일반', width: 320, height: 169.21875, footer: 0 },
  { name: '320×640 축소', width: 320, height: 255.21875, footer: 26 },
  { name: '360×780 일반', width: 360, height: 246.625, footer: 0 },
  { name: '360×780 축소', width: 360, height: 371.625, footer: 26 },
  { name: '412×915 일반', width: 412, height: 356.625, footer: 0 },
  { name: '412×915 축소', width: 412, height: 506.625, footer: 26 },
  { name: '360×880 일반', width: 360, height: 321.625, footer: 0 },
  { name: '360×880 축소', width: 360, height: 471.625, footer: 26 },
];

/** fit 수식을 반복하지 않고 실제 정육각형 꼭짓점과 외곽선 폭으로 그려질 영역을 계산한다. */
function renderedBounds(cells: readonly BoardPoint[], layout: Layout, scale = layout.s) {
  const halfStroke = Math.max(2.5, 0.07 * scale) / 2;
  const points = cells.flatMap(cell => {
    const vertices = Array.from({ length: 6 }, (_, i) => {
      const angle = (i * 60 - 30) * Math.PI / 180;
      return {
        x: layout.ox + cell.px * scale + Math.cos(angle) * 0.93 * scale,
        y: layout.oy + cell.py * scale + Math.sin(angle) * 0.93 * scale,
      };
    });
    // 기본 miter join: 양쪽 변의 바깥 법선을 합친 이등분선으로 선 두께만큼 확장한다.
    const normals = vertices.map((a, i) => {
      const b = vertices[(i + 1) % vertices.length], dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      return { x: dy / length, y: -dx / length };
    });
    return vertices.map((p, i) => {
      const previous = normals[(i + normals.length - 1) % normals.length], next = normals[i];
      const mx = previous.x + next.x, my = previous.y + next.y, length = Math.hypot(mx, my);
      const nx = mx / length, ny = my / length;
      const distance = halfStroke / (nx * previous.x + ny * previous.y);
      return { x: p.x + nx * distance, y: p.y + ny * distance };
    });
  });
  const left = Math.min(...points.map(p => p.x));
  const right = Math.max(...points.map(p => p.x));
  const top = Math.min(...points.map(p => p.y));
  const bottom = Math.max(...points.map(p => p.y));
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function expectContained(cells: readonly BoardPoint[], layout: Layout) {
  const bounds = renderedBounds(cells, layout);
  expect(bounds.left).toBeGreaterThanOrEqual(layout.left - EPS);
  expect(bounds.right).toBeLessThanOrEqual(layout.right + EPS);
  expect(bounds.top).toBeGreaterThanOrEqual(layout.top + 6 - EPS);
  expect(bounds.bottom).toBeLessThanOrEqual(layout.bottom + EPS);
  expect((bounds.left + bounds.right) / 2).toBeCloseTo((layout.left + layout.right) / 2, 8);
  expect((bounds.top + bounds.bottom) / 2).toBeCloseTo((layout.top + 6 + layout.bottom) / 2, 8);
  return bounds;
}

describe('전투판의 같은 비율 확대와 표시 경계', () => {
  for (const board of boards) {
    it.each(frames)(`${board.name} · $name: 외곽선과 위 안내·아래 시전 영역을 침범하지 않는다`, frame => {
      const layout = fitBoard(board.cells, frame.width, frame.height, { footer: frame.footer });
      expect(layout.s).toBeGreaterThan(0);
      expect(layout.left).toBe(2);
      expect(layout.right).toBe(frame.width - 2);
      expect(layout.top).toBe(2);
      expect(layout.bottom).toBe(frame.height - frame.footer - 2);
      const bounds = expectContained(board.cells, layout);

      // 더 키우면 적어도 한 축의 표시 영역을 넘는다. 양 축이 모두 남는 과도한 여백도 잡는다.
      const larger = renderedBounds(board.cells, layout, layout.s + 0.001);
      expect(larger.width > layout.right - layout.left || larger.height > layout.bottom - layout.top - 6).toBe(true);
      if (layout.axis === 'horizontal') expect(bounds.width).toBeCloseTo(layout.right - layout.left, 7);
      else expect(bounds.height).toBeCloseTo(layout.bottom - layout.top - 6, 7);

      const a = board.cells[0], b = board.cells.find(c => c.px !== a.px && c.py !== a.py)!;
      const ax = layout.ox + a.px * layout.s, ay = layout.oy + a.py * layout.s;
      const bx = layout.ox + b.px * layout.s, by = layout.oy + b.py * layout.s;
      expect(Math.hypot(bx - ax, by - ay) / Math.hypot(b.px - a.px, b.py - a.py)).toBeCloseTo(layout.s, 9);
      expect((bx - ax) / (b.px - a.px)).toBeCloseTo((by - ay) / (b.py - a.py), 9);
    });
  }

  it('짧은 320×640 일반 영역은 세로, 충분히 높은 360 폭 20인 판은 가로가 제한한다', () => {
    for (const board of boards) expect(fitBoard(board.cells, 320, 169.21875).axis).toBe('vertical');
    expect(fitBoard(makeCells(BOARDS.b36), 360, 471.625, { footer: 26 }).axis).toBe('horizontal');
  });

  it('작은 판의 최소 2.5px 선과 큰 판의 배율 비례 선 모두를 포함한다', () => {
    const cells = makeCells(BOARDS.b7);
    const small = fitBoard(cells, 140, 130), large = fitBoard(cells, 1400, 1300);
    expect(small.s * 0.07).toBeLessThan(2.5);
    expect(large.s * 0.07).toBeGreaterThan(2.5);
    expectContained(cells, small);
    expectContained(cells, large);
  });
});

describe('safe inset과 좌표계 변경', () => {
  it.each([
    { name: '왼쪽', left: 24, right: 0, footer: 26 },
    { name: '오른쪽', left: 0, right: 32, footer: 26 },
    { name: '양쪽 비대칭', left: 19.5, right: 41.25, footer: 26 },
    { name: '절반보다 큰 왼쪽 inset', left: 170, right: 5, footer: 26 },
  ])('$name: 절대 경계와 남은 영역의 중심을 보존한다', insets => {
    const cells = makeCells(BOARDS.b36), layout = fitBoard(cells, 320, 390, insets);
    expect(layout.left).toBe(insets.left + 2);
    expect(layout.right).toBe(320 - insets.right - 2);
    expect(layout.bottom).toBe(390 - insets.footer - 2);
    expectContained(cells, layout);
  });

  it('음수 inset은 예약 영역을 늘리지 않는다', () => {
    const cells = makeCells(BOARDS.b19);
    expect(fitBoard(cells, 360, 360, { left: -7, right: -9, footer: -26 })).toEqual(fitBoard(cells, 360, 360));
  });

  it.each(boards)('$name: grid를 평행이동해도 화면상 셀 중심과 배율이 같다', ({ cells }) => {
    const insets = { left: 21, right: 7, footer: 26 };
    const original = fitBoard(cells, 360, 371.625, insets);
    for (const offset of [{ x: 15.25, y: -33.5 }, { x: -40, y: 77 }]) {
      const movedCells = cells.map(c => ({ px: c.px + offset.x, py: c.py + offset.y }));
      const moved = fitBoard(movedCells, 360, 371.625, insets);
      expect(moved.s).toBeCloseTo(original.s, 10);
      expect(moved.axis).toBe(original.axis);
      cells.forEach((c, i) => {
        expect(moved.ox + movedCells[i].px * moved.s).toBeCloseTo(original.ox + c.px * original.s, 8);
        expect(moved.oy + movedCells[i].py * moved.s).toBeCloseTo(original.oy + c.py * original.s, 8);
      });
      expectContained(movedCells, moved);
    }
  });

  it('입력 순서를 뒤집어도 배치가 같다', () => {
    const cells = makeCells(BOARDS.b36);
    expect(fitBoard(cells, 360, 371.625)).toEqual(fitBoard([...cells].reverse(), 360, 371.625));
  });

  it('리사이즈·모드 왕복 뒤 첫 배치가 정확히 복구되고 입력도 바뀌지 않는다', () => {
    const cells = Object.freeze(makeCells(BOARDS.b36).map(c => Object.freeze({ px: c.px, py: c.py })));
    const insets = Object.freeze({ left: 13, right: 7, footer: 26 });
    const before = JSON.stringify(cells), first = fitBoard(cells, 360, 371.625, insets);
    for (let pass = 0; pass < 3; pass++) {
      for (const frame of frames) fitBoard(cells, frame.width, frame.height, { footer: frame.footer });
    }
    expect(fitBoard(cells, 360, 371.625, insets)).toEqual(first);
    expect(JSON.stringify(cells)).toBe(before);
    expect(insets).toEqual({ left: 13, right: 7, footer: 26 });
  });
});

describe('초기화·극소 영역의 수치 안정성', () => {
  // 선 자체보다 좁은 영역은 온전한 도형을 담을 수 없다. 이 경우에는 유한한 계산만 요구한다.
  const cases: { width: number; height: number; insets?: BoardInsets }[] = [
    { width: 0, height: 0 }, { width: -40, height: -20 }, { width: 0.01, height: 0.01 },
    { width: 1, height: 1 }, { width: 2, height: 2, insets: { footer: 26 } },
    { width: 16, height: 12, insets: { left: 30, right: 30, footer: 26 } },
  ];
  it.each(cases)('$width×$height: 빈 판과 실제 판 모두 NaN/Infinity를 만들지 않는다', ({ width, height, insets }) => {
    for (const cells of [[], [{ px: -100, py: 80 }], makeCells(BOARDS.b36)]) {
      const layout = fitBoard(cells, width, height, insets);
      for (const [key, value] of Object.entries(layout)) {
        if (key !== 'axis') expect(Number.isFinite(value), key).toBe(true);
      }
      expect(layout.s).toBeGreaterThan(0);
      expect(layout.right).toBeGreaterThan(layout.left);
      expect(layout.bottom).toBeGreaterThan(layout.top);
    }
  });
});

describe('보스전 판 (Lim 2026-10-09: 모든 보스전 6줄로 일정하게)', () => {
  it('던전 5인 · 10인 · 20인은 같은 6열 × 6줄 판, 탐험·튜토리얼은 7칸', () => {
    for (const enc of Object.values(ENCOUNTERS)) {
      const rows = BOARDS[enc.board];
      if (enc.board === 'b7') expect(enc.comp.tank + enc.comp.melee + enc.comp.ranged, enc.key).toBeLessThanOrEqual(2);
      else {
        expect(enc.board, enc.key).toBe('b36');
        expect(rows).toHaveLength(6);
        expect(rows.every(r => r.join() === '0,1,2,3,4,5'), enc.key).toBe(true);
      }
    }
  });
});
