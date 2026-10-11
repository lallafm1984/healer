// PXF 타임라인 그림 → 투명 프레임 띠 굽기 (pxf-strip.mjs · pxf-tiles.mjs가 같이 씀).
// 공방 render_pxf의 timeline PNG (64px 프레임을 줄마다 여러 칸 · 줄 높이 76px · 8px 체커 배경)에서 체커를 걷어 내고,
// 픽셀마다 C = a·P + (1 − a)·배경 을 팔레트 색 P마다 풀어 가장 잘 맞는 (P, a)로 되살린다 (Palette bands 출력이라 색은 팔레트 색 중 하나).
// pieces = 띠 한 칸 (size × size) 안에 놓을 타임라인들: 하나면 그대로, 조각 4개면 128px 한 칸을 64px 네 조각으로 잇는다.
import { chromium } from 'playwright';

/** 그래프의 Palette 색 + Outline 색 (타임라인 픽셀이 이 색들로만 설명돼야 함) */
export const graphPalette = graph => [
  ...graph.nodes.filter(n => n.type === 'Palette').flatMap(n => n.params.colors ?? []),
  ...graph.nodes.filter(n => n.type === 'Outline').map(n => n.params.color ?? '#10142e'),
];

/**
 * @param {{ size: number, frames: number, pieces: { timeline: string | null, palette: string[], dx: number, dy: number }[] }} job
 *   size = 띠 한 칸 크기, timeline = base64 PNG (null = 빈 조각), dx/dy = 칸 안에서 조각 자리 (조각은 64px)
 * @returns {Promise<{ png: Buffer, worst: number }>}
 */
export async function bakeStrip(job) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const out = await page.evaluate(async ({ size, frames, pieces }) => {
      const T = 64, CHECK = [[29, 32, 36], [42, 45, 49]], rowH = T + 12;
      const dst = new OffscreenCanvas(size * frames, size), dg = dst.getContext('2d'), img = dg.createImageData(size * frames, size);
      let worst = 0;
      for (const pc of pieces) {
        if (!pc.timeline) continue;
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${pc.timeline}`)).blob());
        const src = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
        src.drawImage(bmp, 0, 0);
        const px = src.getImageData(0, 0, bmp.width, bmp.height).data;
        const P = pc.palette.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
        const cols = Math.floor(bmp.width / T);
        for (let f = 0; f < frames; f++) {
          const ox = (f % cols) * T, oy = Math.floor(f / cols) * rowH;
          for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
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
            const di = ((pc.dy + y) * size * frames + f * size + pc.dx + x) * 4;
            img.data.set([...best.p, Math.round(best.a * 255)], di);
          }
        }
      }
      dg.putImageData(img, 0, 0);
      const buf = new Uint8Array(await (await dst.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), worst };
    }, job);
    return { png: Buffer.from(out.b64, 'base64'), worst: out.worst };
  } finally {
    await browser.close();
  }
}
