// 우리 이펙트 렌더러 (fxr) 명령: 그래프 → 프레임 띠 PNG (Lim 2026-10-11 「공방처럼 더 고해상도로 만들 수 있는 툴」 → 「만들기」)
// 사용: node scripts/fxr.mjs <그래프.json> [--size 256] [--out 파일.png]
//   그래프는 공방 그래프 (pxf.graph@1) 그대로 읽는다. --size를 주면 그 크기로 (픽셀 단위 값은 같은 비율로 키움)
//   결과: 프레임을 가로로 이은 띠 (size·frames × size), 투명 배경
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './fxr/png.mjs';
import { renderGraph } from './fxr/render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 공방 계약 (파라미터 기본값). 저장소에 사본을 둠 */
const CONTRACT = JSON.parse(readFileSync(join(ROOT, 'scripts/fxr/pxf-contract.json'), 'utf8'));

export function renderStrip(graph, size) {
  const { size: n, frames } = renderGraph(graph, { size, contract: CONTRACT });
  const W = n * frames.length, strip = new Uint8ClampedArray(W * n * 4);
  frames.forEach((fr, f) => { for (let y = 0; y < n; y++) strip.set(fr.subarray(y * n * 4, (y + 1) * n * 4), (y * W + f * n) * 4); });
  return { png: encodePng(W, n, strip), size: n, frames: frames.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
  const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  if (!file) { console.error('사용: node scripts/fxr.mjs <그래프.json> [--size 256] [--out 파일.png]'); process.exit(1); }
  const graph = JSON.parse(readFileSync(file, 'utf8')), size = opt('size') ? Number(opt('size')) : undefined;
  const t = Date.now(), r = renderStrip(graph, size), out = opt('out') ?? file.replace(/\.json$/, `.fxr${r.size}.png`);
  writeFileSync(out, r.png);
  console.log(`✓ ${out}  ${r.size * r.frames}×${r.size} (${r.frames}프레임) · ${Date.now() - t}ms`);
}
