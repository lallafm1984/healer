// 개발용 이펙트 화면 (fx.html)의 저장 · 굽기 창구 (Lim 2026-10-12 「게임 저장소 안 도구」). `npm run dev` · `npm run fx`일 때만 붙는다 (vite.config.ts, apply: 'serve').
// 브라우저는 저장소 파일을 직접 못 쓰므로 여기서 src/art/pxf/<이름>.pxf.json 저장과 src/art/fx-pxf-<이름>.png 굽기 (scripts/fxr.mjs와 같은 렌더러 · 같은 PNG)를 한다.
// 이름은 소문자 · 숫자 · - 만 받아 다른 폴더에 못 쓰게 한다.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderStrip, WIDE_SIZE } from '../fxr.mjs';
import { splitGraph, TILE_KEYS } from '../pxf-split.mjs';
import { validateGraph } from './validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PXF_DIR = join(ROOT, 'src/art/pxf');
const ART_DIR = join(ROOT, 'src/art');
const CONTRACT_FILE = join(ROOT, 'scripts/fxr/pxf-contract.json');
export const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BODY = 8 * 1024 * 1024;

/** 게임 띠 굽기 규칙 (scripts/fxr.mjs와 같음): 128px 설계 (보스 판 전체 공격) = 256px 격자, 그 밖 = 설계 크기 가로 띠 */
export const bakeLayout = graph => (graph.settings.size === 128 ? { size: WIDE_SIZE, grid: true } : { size: graph.settings.size, grid: false });

/** src/art/pxf의 그래프 목록 (조각 tiles/ 은 뺌) */
export function listGraphs(dir = PXF_DIR, artDir = ART_DIR) {
  return readdirSync(dir).filter(f => f.endsWith('.pxf.json')).sort().map(f => {
    const name = f.slice(0, -'.pxf.json'.length);
    let g = null;
    try { g = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { /* 깨진 파일도 목록엔 둠 */ }
    return {
      name, title: g?.name ?? name, size: g?.settings?.size ?? 0, frames: g?.settings?.frames ?? 0,
      timeline: existsSync(join(dir, `${name}.timeline.png`)), strip: existsSync(join(artDir, `fx-pxf-${name}.png`)),
    };
  });
}

const checked = (name, graph) => {
  if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`이름은 소문자 · 숫자 · - 만 (${name})`);
  const contract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8')), v = validateGraph(graph, contract);
  if (v.errors.length) throw new Error(`검사 오류 ${v.errors.length}개: ${v.errors[0]}`);
};
/** 보스 판 전체 공격 (boss-*, 128px 설계)은 64px 조각 그래프 (tiles/)도 같이 둔다 (tests/pxf.test.ts가 조각이 원본을 나눈 것과 같은지 봄) */
const hasTiles = (name, graph) => name.startsWith('boss-') && graph.settings.size === 128;

/** 그래프 저장 (2칸 들여쓰기 + 줄바꿈, 저장소 그래프와 같은 모양). 보스 판 전체 공격은 조각 그래프도 다시 나눔 */
export function saveGraph(name, graph, dir = PXF_DIR) {
  checked(name, graph);
  const warns = [];
  let tiles = null;
  if (hasTiles(name, graph)) {
    try {
      const sp = splitGraph(graph);
      tiles = sp.tiles; warns.push(...sp.warns);
    } catch (e) { throw new Error(`보스 판 전체 공격은 64px 조각으로 나눌 수 있어야 함 (scripts/pxf-tiles.mjs): ${e instanceof Error ? e.message : e}`); }
  }
  const file = join(dir, `${name}.pxf.json`);
  writeFileSync(file, `${JSON.stringify(graph, null, 2)}\n`);
  if (tiles) {
    const tdir = join(dir, 'tiles');
    mkdirSync(tdir, { recursive: true });
    for (const q of TILE_KEYS) {
      const f = join(tdir, `${name}.${q}.pxf.json`);
      if (!tiles[q]) { if (existsSync(f)) rmSync(f); continue; }
      const before = existsSync(f) ? readFileSync(f, 'utf8') : null, text = `${JSON.stringify(tiles[q], null, 2)}\n`;
      writeFileSync(f, text);
      if (!existsSync(join(tdir, `${name}.${q}.timeline.png`))) warns.push(`조각 ${q}의 공방 타임라인 그림이 없음 (tests/pxf.test.ts가 찾음): scripts/pxf-tiles.mjs 머리말대로 공방에서 그려 저장`);
      else if (before !== null && before !== text) warns.push(`조각 ${q}가 바뀜: tiles/${name}.${q}.timeline.png는 예전 공방 그림 (확인용, 게임 띠와는 무관)`);
    }
  }
  return { file: file.slice(ROOT.length + 1), warns };
}

/** 게임 띠 굽기: src/art/fx-pxf-<이름>.png */
export function bakeGraph(name, graph, artDir = ART_DIR) {
  checked(name, graph);
  const { size, grid } = bakeLayout(graph), t = Date.now(), r = renderStrip(graph, size, { grid }), file = join(artDir, `fx-pxf-${name}.png`);
  writeFileSync(file, r.png);
  return { file: file.slice(ROOT.length + 1), w: r.w, h: r.h, size: r.size, frames: r.frames, cols: r.cols, ms: Date.now() - t };
}

const readBody = req => new Promise((ok, fail) => {
  let n = 0; const parts = [];
  req.on('data', c => { n += c.length; if (n > MAX_BODY) { fail(new Error('너무 큼')); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch (e) { fail(e); } });
  req.on('error', fail);
});
const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.statusCode = code; res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'no-store');
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

/** /__fx/… 요청 처리 (connect 미들웨어) */
export async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://x'), name = url.searchParams.get('name') ?? '';
  try {
    if (req.method === 'GET' && url.pathname === '/contract') return send(res, 200, readFileSync(CONTRACT_FILE));
    if (req.method === 'GET' && url.pathname === '/list') return send(res, 200, listGraphs());
    if (req.method === 'GET' && ['/graph', '/timeline', '/strip'].includes(url.pathname)) {
      if (!NAME.test(name)) return send(res, 400, { error: '이름' });
      const file = url.pathname === '/graph' ? join(PXF_DIR, `${name}.pxf.json`) : url.pathname === '/timeline' ? join(PXF_DIR, `${name}.timeline.png`) : join(ART_DIR, `fx-pxf-${name}.png`);
      if (!existsSync(file)) return send(res, 404, { error: '없음' });
      return send(res, 200, readFileSync(file), url.pathname === '/graph' ? 'application/json; charset=utf-8' : 'image/png');
    }
    if (req.method === 'POST' && (url.pathname === '/save' || url.pathname === '/bake')) {
      const body = await readBody(req);
      return send(res, 200, url.pathname === '/save' ? saveGraph(body.name, body.graph) : bakeGraph(body.name, body.graph));
    }
    return send(res, 404, { error: '없는 주소' });
  } catch (e) {
    return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

/** vite 플러그인: 개발 서버에만 /__fx 창구를 붙임 (빌드 · 앱에는 없음) */
export function fxLabPlugin() {
  return {
    name: 'fx-lab',
    apply: 'serve',
    configureServer(server) { server.middlewares.use('/__fx', (req, res) => { void handle(req, res); }); },
  };
}
