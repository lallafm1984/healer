// 128px PXF 원본 그래프 → 64px 조각 그래프 4개 (pxf-tiles.mjs가 쓰고, tests/pxf.test.ts가 조각 파일이 원본과 맞는지 확인).
// 나누는 규칙은 pxf-tiles.mjs 머리말.
export const S = 128, T = 64;
export const TILE_KEYS = /** @type {const} */ (['tl', 'tr', 'bl', 'br']);
export const OFF = { tl: [0, 0], tr: [T, 0], bl: [0, T], br: [T, T] };

/** 위치 파라미터와 조각 안에서 허용 범위 */
const POS = {
  Shape: { pts: [['x', 'y']], min: 0, max: 1 },
  Particles: { pts: [['x', 'y']], min: 0, max: 1 },
  Lightning: { pts: [['x0', 'y0'], ['x1', 'y1']], min: 0, max: 1 },
  Spike: { pts: [['x0', 'y0'], ['x1', 'y1']], min: 0, max: 1 },
  Stroke: { pts: [['x0', 'y0'], ['x1', 'y1'], ['x2', 'y2'], ['x3', 'y3']], min: -1, max: 2 },
};
/** 픽셀마다 따로 계산돼 조각으로 나눠도 같은 노드 (Glow · Outline은 조각 경계 1–2px만 다를 수 있음) */
const PER_PIXEL = new Set(['Blend', 'Palette', 'Outline', 'Tint', 'Output', 'Levels', 'Quantize', 'Mask', 'Glow']);

const values = v => (v && typeof v === 'object' ? ('k' in v ? v.k.map(k => k[1]) : [v.a, v.b]) : [v]);
const mapNum = (v, fn) => (v && typeof v === 'object'
  ? ('k' in v ? { ...v, k: v.k.map(k => [k[0], fn(k[1]), ...k.slice(2)]) } : { ...v, a: fn(v.a), b: fn(v.b) })
  : fn(v));
const round = v => Math.round(v * 1e6) / 1e6;

/**
 * 생성 노드가 조각 사각형 안으로 얼마나 (px) 들어올 수 있는지 대강 (경고용, 넉넉하게).
 * 원본 128px 좌표에서 모양을 원 몇 개로 덮고 (번개는 가운데가 가장 많이 꺾이고 양끝은 거의 직선), 원이 사각형 안으로 들어간 깊이
 */
function reach(n, frames, rx, ry) {
  const p = n.params, num = (k, d) => Math.max(...values(p[k] ?? d));
  const pts = k => values(p[k] ?? 0.5).map(v => v * S);
  const depth = (x, y, r) => r - Math.hypot(Math.max(rx - x, 0, x - (rx + T)), Math.max(ry - y, 0, y - (ry + T)));
  const discs = [];
  if (n.type === 'Shape') {
    const r = num('size', 12) * Math.max(1, num('aspect', 1)) + num('stroke', 0);
    for (const x of pts('x')) for (const y of pts('y')) discs.push([x, y, r]);
  } else if (n.type === 'Particles') {
    const life = num('life', 0.5) * frames * (1 + num('lifeVar', 0.3));
    const v = num('speed', 1) * (1 + num('speedVar', 0.5)), g = Math.abs(num('gravity', 0));
    const travel = Math.max(v * life - 0.5 * g * life * life, (v * v) / (2 * Math.max(g, 1e-6)) > v * life ? v * life : (v * v) / (2 * Math.max(g, 1e-6)), 0) + num('turb', 0) * 2;
    const area = (p.area ?? 'point') === 'point' ? 0 : Math.max(num('aw', 8), num('ah', 8)) / 2;
    for (const x of pts('x')) for (const y of pts('y')) discs.push([x, y, area + travel + num('sizeA', 2)]);
  } else {
    const [x0, y0, x1, y1] = ['x0', 'y0', 'x1', 'y1'].map(k => Math.max(...pts(k)));
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, bend = n.type === 'Spike' ? 0 : len * (0.5 * num('jag', 0.35) + (num('branch', 0.25) > 0 ? 0.5 * num('branchLen', 0.35) : 0)) * 4 * t * (1 - t);
      discs.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, bend + (n.type === 'Spike' ? num('width', 10) : num('thick', 1))]);
    }
  }
  return Math.max(0, ...discs.map(([x, y, r]) => depth(x, y, r)));
}

/** 원본 그래프 → 조각 그래프 (그릴 게 없으면 null) · 경고 */
export function splitGraph(g) {
  if (g.settings.size !== S) throw new Error(`원본은 size ${S} (지금 ${g.settings.size})`);
  const bad = g.nodes.filter(n => !POS[n.type] && !PER_PIXEL.has(n.type));
  if (bad.length) throw new Error(`조각으로 못 나누는 노드: ${bad.map(n => `${n.id}(${n.type})`).join(', ')}`);
  const warns = [], tiles = {};
  for (const n of g.nodes) {
    const P = POS[n.type];
    if (P) for (const [kx, ky] of P.pts) for (const k of [kx, ky]) {
      const vs = values(n.params[k] ?? 0.5);
      if (vs.some(v => v < 0 || v > 1)) throw new Error(`${n.id}.${k}: 원본 위치는 0–1 안이어야 함 (${vs.join(', ')})`);
    }
    if (n.type === 'Particles' && (n.params.ground ?? 0) > 0) throw new Error(`${n.id}: ground (바닥 y px)는 조각마다 달라져 쓰지 않음`);
  }
  for (const q of TILE_KEYS) {
    const [ox, oy] = OFF[q], keep = new Set(), nodes = [];
    for (const n of g.nodes) {
      const P = POS[n.type];
      if (!P) { keep.add(n.id); nodes.push(structuredClone(n)); continue; }
      const params = { ...n.params };
      let ok = true;
      for (const [kx, ky] of P.pts) {
        params[kx] = mapNum(n.params[kx] ?? 0.5, v => round((v * S - ox) / T));
        params[ky] = mapNum(n.params[ky] ?? 0.5, v => round((v * S - oy) / T));
        for (const k of [kx, ky]) if (values(params[k]).some(v => v < P.min - 1e-9 || v > P.max + 1e-9)) ok = false;
      }
      if (ok) { keep.add(n.id); nodes.push({ ...n, params }); continue; }
      const d = reach(n, g.settings.frames, ox, oy);
      if (d >= 2) warns.push(`${q}: ${n.id}(${n.type}) 기준점이 이 조각 밖인데 모양이 ${Math.round(d)}px 정도 넘어올 수 있음 (넘어온 부분은 잘림)`);
    }
    // 빠진 입력 정리: Blend는 남은 쪽을 그대로 넘기고, 입력이 다 빠진 노드는 뺌
    let links = g.links.map(l => ({ ...l }));
    for (let changed = true; changed;) {
      changed = false;
      for (const n of nodes) {
        if (!keep.has(n.id) || POS[n.type]) continue;
        const ins = links.filter(l => l.t === n.id && keep.has(l.f));
        const need = n.type === 'Output' || n.type === 'Palette' || n.type === 'Outline' || n.type === 'Tint' || n.type === 'Glow' || n.type === 'Levels' || n.type === 'Quantize' || n.type === 'Mask' ? ins.some(l => l.p === 0) : ins.length > 0;
        if (!need) { keep.delete(n.id); changed = true; continue; }
        if (n.type === 'Blend' && ins.length === 1) {
          const src = ins[0].f;
          links = links.filter(l => l.t !== n.id).map(l => (l.f === n.id ? { ...l, f: src } : l));
          keep.delete(n.id); changed = true;
        }
      }
      links = links.filter(l => keep.has(l.f) && keep.has(l.t));
    }
    if (![...keep].some(id => POS[g.nodes.find(n => n.id === id).type])) { tiles[q] = null; continue; }
    tiles[q] = {
      format: g.format, name: `${g.name} ${q}`.slice(0, 60),
      settings: { ...g.settings, size: T },
      nodes: nodes.filter(n => keep.has(n.id)), links,
      ...(g.game ? { game: g.game } : {}),
    };
  }
  return { tiles, warns };
}
