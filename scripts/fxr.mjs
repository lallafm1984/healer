// 우리 이펙트 렌더러 (fxr) 명령: 그래프 → 프레임 띠 PNG (Lim 2026-10-11 「공방처럼 더 고해상도로 만들 수 있는 툴」 → 「만들기」)
// 사용: node scripts/fxr.mjs <그래프.json> [--size 256] [--grid] [--out 파일.png]
//   그래프는 공방 그래프 (pxf.graph@1) 그대로 읽는다. --size를 주면 그 크기로 (픽셀 단위 값은 같은 비율로 키움)
//   결과: 프레임을 가로로 이은 띠 (size·frames × size), 투명 배경. --grid면 거의 정사각형 격자 (한 줄 ⌈√frames⌉장, battle/pxf.ts cols)
//       node scripts/fxr.mjs --wide <이름|all>
//   보스 판 전체 공격 (Lim 「256px」): src/art/pxf/<이름>.pxf.json (128px 설계) → src/art/fx-pxf-<이름>.png (256px 격자). all = boss-* 모두
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './fxr/png.mjs';
import { renderGraph } from './fxr/render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 공방 계약 (파라미터 기본값). 저장소에 사본을 둠 */
const CONTRACT = JSON.parse(readFileSync(join(ROOT, 'scripts/fxr/pxf-contract.json'), 'utf8'));
/** 보스 판 전체 공격 띠의 프레임 크기 (battle/pxf.ts wide) */
export const WIDE_SIZE = 256;

/** 띠 한 줄의 프레임 수 (grid = 거의 정사각형 격자) */
export const stripCols = (frames, grid) => (grid ? Math.ceil(Math.sqrt(frames)) : frames);

/** 그래프 → 띠 픽셀 (RGBA): 프레임 f는 (f % cols, ⌊f / cols⌋) 칸 */
export function renderStripRgba(graph, size, { grid = false } = {}) {
  const { size: n, frames } = renderGraph(graph, { size, contract: CONTRACT });
  const cols = stripCols(frames.length, grid), rows = Math.ceil(frames.length / cols), W = n * cols, H = n * rows, rgba = new Uint8ClampedArray(W * H * 4);
  frames.forEach((fr, f) => {
    const ox = (f % cols) * n, oy = Math.floor(f / cols) * n;
    for (let y = 0; y < n; y++) rgba.set(fr.subarray(y * n * 4, (y + 1) * n * 4), ((oy + y) * W + ox) * 4);
  });
  return { rgba, w: W, h: H, size: n, frames: frames.length, cols };
}
export function renderStrip(graph, size, opts) {
  const r = renderStripRgba(graph, size, opts);
  return { ...r, png: encodePng(r.w, r.h, r.rgba) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const wide = opt('wide');
  const jobs = wide
    ? (wide === 'all' ? readdirSync(join(ROOT, 'src/art/pxf')).filter(f => /^boss-.*\.pxf\.json$/.test(f)).map(f => f.replace('.pxf.json', '')) : [wide])
      .map(name => ({ file: join(ROOT, `src/art/pxf/${name}.pxf.json`), size: WIDE_SIZE, grid: true, out: join(ROOT, `src/art/fx-pxf-${name}.png`) }))
    : [{ file: args.find((a, i) => !a.startsWith('--') && !['--size', '--out'].includes(args[i - 1])), size: opt('size') ? Number(opt('size')) : undefined, grid: args.includes('--grid'), out: opt('out') }];
  if (!jobs[0]?.file) { console.error('사용: node scripts/fxr.mjs <그래프.json> [--size 256] [--grid] [--out 파일.png] | --wide <이름|all>'); process.exit(1); }
  for (const j of jobs) {
    const graph = JSON.parse(readFileSync(j.file, 'utf8')), t = Date.now(), r = renderStrip(graph, j.size, { grid: j.grid }), out = j.out ?? j.file.replace(/\.json$/, `.fxr${r.size}.png`);
    writeFileSync(out, r.png);
    console.log(`✓ ${out}  ${r.w}×${r.h} (${r.size}px ${r.frames}프레임, 한 줄 ${r.cols}장) · ${Date.now() - t}ms`);
  }
}
