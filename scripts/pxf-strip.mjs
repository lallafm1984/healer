// PXF 공방 이펙트 (pxf.graph@1) → 게임 프레임 띠 (Lim 2026-10-11 시험).
// 게임에는 PXF 엔진이 없어서, 실제 엔진이 그린 타임라인 그림(PXF 도구 render_pxf의 timeline PNG: 64px 프레임 5칸씩 · 줄 높이 76px · 8px 체커 배경)에서
// 체커 배경을 걷어 내 투명 프레임을 되살리고, 가로로 이어 붙여 src/art/fx-pxf-<이름>.png로 저장한다.
// Palette bands 출력이라 픽셀 색은 팔레트 색 (또는 Outline 색) 중 하나: C = a·P + (1 − a)·배경 을 색마다 풀어 가장 잘 맞는 (P, a)를 고른다.
// 그 색들로 설명이 안 되는 픽셀이 있으면 (다른 노드가 색을 바꾸거나 반투명 색끼리 겹친 그래프) 멈춘다.
// 사용: node scripts/pxf-strip.mjs heal-dust   (src/art/pxf/heal-dust.pxf.json + heal-dust.timeline.png → src/art/fx-pxf-heal-dust.png)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
if (!name) { console.error('사용: node scripts/pxf-strip.mjs <이름>'); process.exit(1); }
const dir = join(ROOT, 'src/art/pxf');
const graph = JSON.parse(readFileSync(join(dir, `${name}.pxf.json`), 'utf8'));
const { size, frames } = graph.settings;
if (size !== 64) { console.error(`타임라인 칸이 64px라 size 64만 됨 (지금 ${size})`); process.exit(1); }
const palette = [...graph.nodes.filter(n => n.type === 'Palette').flatMap(n => n.params.colors ?? []), ...graph.nodes.filter(n => n.type === 'Outline').map(n => n.params.color ?? '#10142e')];
if (!palette.length) { console.error('Palette 노드가 없는 그래프는 아직 못 구움'); process.exit(1); }
const timeline = readFileSync(join(dir, `${name}.timeline.png`)).toString('base64');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ timeline, size, frames, palette }) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${timeline}`)).blob());
    const src = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
    src.drawImage(bmp, 0, 0);
    const px = src.getImageData(0, 0, bmp.width, bmp.height).data;
    const P = palette.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    const CHECK = [[29, 32, 36], [42, 45, 49]], cols = Math.floor(bmp.width / size), rowH = size + 12;
    const dst = new OffscreenCanvas(size * frames, size), dg = dst.getContext('2d'), img = dg.createImageData(size * frames, size);
    let worst = 0;
    for (let f = 0; f < frames; f++) {
      const ox = (f % cols) * size, oy = Math.floor(f / cols) * rowH;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const gx = ox + x, gy = oy + y, si = (gy * bmp.width + gx) * 4;
        const bg = CHECK[(Math.floor(gx / 8) + Math.floor(gy / 8)) % 2], c = [px[si], px[si + 1], px[si + 2]];
        if (c[0] === bg[0] && c[1] === bg[1] && c[2] === bg[2]) continue;
        let best = null;
        for (const p of P) {
          const d = p.map((v, k) => v - bg[k]), dd = d.reduce((s, v) => s + v * v, 0);
          const a = Math.max(0, Math.min(1, d.reduce((s, v, k) => s + (c[k] - bg[k]) * v, 0) / dd));
          const res = Math.hypot(...c.map((v, k) => v - (a * p[k] + (1 - a) * bg[k])));
          if (!best || res < best.res) best = { res, p, a };
        }
        worst = Math.max(worst, best.res);
        const di = (y * size * frames + f * size + x) * 4;
        img.data.set([...best.p, Math.round(best.a * 255)], di);
      }
    }
    dg.putImageData(img, 0, 0);
    const buf = new Uint8Array(await (await dst.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), worst };
  }, { timeline, size, frames, palette });
  // 8비트 반올림 오차는 1 안팎. 그보다 크면 배경을 잘못 걷어 냈거나 팔레트 밖 색
  if (out.worst > 3) { console.error(`팔레트로 설명이 안 되는 픽셀 (오차 ${out.worst.toFixed(1)}): 그래프와 타임라인 그림이 맞는지 확인`); process.exit(1); }
  const file = join(ROOT, 'src/art', `fx-pxf-${name}.png`);
  writeFileSync(file, Buffer.from(out.b64, 'base64'));
  console.log(`✓ ${file}  ${size * frames}×${size} (${frames}프레임) · 최대 오차 ${out.worst.toFixed(2)}`);
} finally {
  await browser.close();
}
