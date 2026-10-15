// 스킬 이펙트 굽기 (Lim 2026-10-16 「스킬이펙트가 너무 허술한게 많다. 퀄리티 있게 모두 다시」): scripts/vfx/<직업>.mjs의 그리기 함수를
// Playwright 크로미움 캔버스로 프레임마다 그려 src/art/fx-skill-<이름>.webp (224px 프레임 격자, 한 줄 ⌈√frames⌉장)로 저장한다.
// 사용: node scripts/vfx-bake.mjs <이름|직업|all> [--review <폴더> --bg <판 배경 폴더>]
//   --review: 실제 전투 판 사진 (bg 폴더의 board5.png · board20.png · boards.json, 화면 테스트로 찍은 것) 위에 게임 크기로 올린 검수 시트
import { chromium } from 'playwright';
import { build } from 'rolldown';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FX, FX_SIZE, HERO_FX } from './vfx/index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const want = args[0];
if (!want) { console.error('사용: node scripts/vfx-bake.mjs <이름|직업|all> [--review 폴더 --bg 폴더]'); process.exit(1); }
const names = want === 'all' ? Object.keys(FX) : HERO_FX[want] ?? want.split(',');
for (const n of names) if (!FX[n]) { console.error(`없는 이펙트: ${n}`); process.exit(1); }
const review = opt('review'), bgDir = opt('bg');

// 그리기 코드를 브라우저용 한 덩어리로
const bundle = await build({ input: join(ROOT, 'scripts/vfx/index.mjs'), write: false, output: { format: 'iife', name: 'VFX' } });
const code = bundle.output[0].code;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
await page.addScriptTag({ content: code });
const bg = review && bgDir ? {
  meta: JSON.parse(readFileSync(join(bgDir, 'boards.json'), 'utf8')),
  b5: `data:image/png;base64,${readFileSync(join(bgDir, 'board5.png')).toString('base64')}`,
  b20: `data:image/png;base64,${readFileSync(join(bgDir, 'board20.png')).toString('base64')}`,
} : null;
if (review) mkdirSync(review, { recursive: true });

for (const name of names) {
  const r = await page.evaluate(async ({ name, S, bg }) => {
    const { FX, lib } = window.VFX, fx = FX[name], cols = Math.ceil(Math.sqrt(fx.frames)), rows = Math.ceil(fx.frames / cols);
    const one = document.createElement('canvas'); one.width = one.height = S;
    const g1 = one.getContext('2d');
    const sheet = document.createElement('canvas'); sheet.width = S * cols; sheet.height = S * rows;
    const gs = sheet.getContext('2d');
    const peak = [];
    let edge = 0;
    const frames = [];
    for (let i = 0; i < fx.frames; i++) {
      if (i < fx.frames - 1) lib.drawFrame(g1, fx, i, S); else g1.clearRect(0, 0, S, S); // 마지막 프레임은 비움 (끝나면 사라짐)
      const d = g1.getImageData(0, 0, S, S).data;
      let a = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > a) a = d[k];
      peak.push(a);
      // 프레임 가장자리 (2px 띠)에 그림이 닿으면 게임에서 네모 테두리로 잘려 보임
      for (let y = 0; y < S; y++) for (const x of y < 2 || y >= S - 2 ? [...Array(S).keys()] : [0, 1, S - 2, S - 1]) { const v = d[(y * S + x) * 4 + 3]; if (v > edge) edge = v; }
      gs.drawImage(one, (i % cols) * S, Math.floor(i / cols) * S);
      const keep = document.createElement('canvas'); keep.width = keep.height = S; keep.getContext('2d').drawImage(one, 0, 0); frames.push(keep);
    }
    const webp = sheet.toDataURL('image/webp', 0.9).split(',')[1];
    let rev = null;
    if (bg) {
      const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });
      const [b5, b20] = await Promise.all([load(bg.b5), load(bg.b20)]);
      const DPR = 3, m5 = bg.meta[5], m20 = bg.meta[20];
      // 게임과 같은 크기: 칸 반지름 r = cellScale × 0.93, 그림 지름 = 2r × logical / 62 (battle/pxf.ts pxfDrawSize)
      const put = (g, im, m, cells, f) => {
        g.drawImage(im, 0, 0);
        const r = m.s * 0.93, D = 2 * r * fx.logical / 62 * DPR;
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        for (const c of cells) g.drawImage(frames[f], (c.x - m.crop.x) * DPR - D / 2, (c.y - m.crop.y) * DPR - D / 2, D, D);
      };
      const near = (m, id, k) => { const c0 = m.cells.find(c => c.id === id), r = m.s * 0.93 * 2.05; return m.cells.filter(c => Math.hypot(c.x - c0.x, c.y - c0.y) <= r * k + 1); };
      // 대상 칸 (탱커, 회청색) 프레임마다 6열 격자 + 밝은 칸 (나, 크림색) 네 장
      const step = fx.frames > 18 ? 2 : 1, show = []; for (let i = 0; i < fx.frames - 1; i += step) show.push(i);
      const COLS = 6, CW = 330, key = [0, 2, Math.round(fx.frames * 0.35), Math.round(fx.frames * 0.65)];
      const tiles = [...show.map(f => [1, f]), ...key.map(f => [5, f])], gridRows = Math.ceil(show.length / COLS) + 1;
      const boardW = 660, boardH = Math.round(b5.height * boardW / b5.width), extra = fx.scope === 'target' ? 0 : 2;
      const W = Math.max(CW * COLS, boardW * (extra ? 3 : 1)), y0 = 24 + gridRows * CW + 4;
      const H = y0 + boardH + (extra ? 0 : 0) + 10;
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      const go = out.getContext('2d'); go.fillStyle = '#16141a'; go.fillRect(0, 0, W, H);
      go.fillStyle = '#ddd'; go.font = '20px sans-serif'; go.fillText(`${name} · ${fx.frames}f · logical ${fx.logical} · ${fx.scope}`, 8, 20);
      const big = document.createElement('canvas'); big.width = b5.width; big.height = b5.height; const gb = big.getContext('2d');
      tiles.forEach(([id, f], k) => {
        const c = m5.cells.find(x => x.id === id), half = m5.s * 0.93 * 1.45 * DPR;
        const row = k < show.length ? Math.floor(k / COLS) : gridRows - 1, col = k < show.length ? k % COLS : k - show.length;
        put(gb, b5, m5, [c], f);
        go.drawImage(big, (c.x - m5.crop.x) * DPR - half, (c.y - m5.crop.y) * DPR - half, half * 2, half * 2, col * CW, 24 + row * CW, CW - 4, CW - 4);
        go.fillStyle = '#fff'; go.font = '16px sans-serif'; go.fillText(String(f), col * CW + 5, 24 + row * CW + 18);
      });
      // 판 전체: 대상 칸만 (target) · 범위 / 파티 칸마다 (area · party, 20인 판도)
      const fMid = Math.min(fx.frames - 2, Math.round(fx.frames * 0.3));
      const cells5 = fx.scope === 'party' ? m5.cells : fx.scope === 'area' ? near(m5, 1, 1) : [m5.cells.find(c => c.id === 1)];
      put(gb, b5, m5, cells5, 2); go.drawImage(big, 0, y0, boardW, boardH);
      if (extra) {
        put(gb, b5, m5, cells5, fMid); go.drawImage(big, boardW, y0, boardW, boardH);
        const big2 = document.createElement('canvas'); big2.width = b20.width; big2.height = b20.height; const g2 = big2.getContext('2d');
        const cells20 = fx.scope === 'party' ? m20.cells : near(m20, 18, 1);
        put(g2, b20, m20, cells20, fMid); const h20 = Math.round(b20.height * boardW / b20.width);
        go.drawImage(big2, boardW * 2, y0, boardW, h20);
      }
      rev = out.toDataURL('image/png').split(',')[1];
      // 한눈에 보기 줄: 고르게 8장 (탱커 칸) + 밝은 칸 1장
      const pick = [...Array(8)].map((_, k) => Math.round((k * (fx.frames - 2)) / 7)), RW = 200;
      const row = document.createElement('canvas'); row.width = RW * 9 + 220; row.height = RW;
      const gr = row.getContext('2d'); gr.fillStyle = '#16141a'; gr.fillRect(0, 0, row.width, RW);
      gr.fillStyle = '#eee'; gr.font = '18px sans-serif'; gr.fillText(name, 6, 24); gr.font = '14px sans-serif'; gr.fillStyle = '#aaa'; gr.fillText(`${fx.frames}f · ${fx.scope}`, 6, 46);
      [...pick.map(f => [1, f]), [5, Math.round(fx.frames * 0.3)]].forEach(([id, f], k) => {
        const c = m5.cells.find(x => x.id === id), half = m5.s * 0.93 * 1.45 * DPR;
        put(gb, b5, m5, [c], f);
        gr.drawImage(big, (c.x - m5.crop.x) * DPR - half, (c.y - m5.crop.y) * DPR - half, half * 2, half * 2, 220 + k * RW, 0, RW - 3, RW - 3);
      });
      window.__rows = [...(window.__rows || []), row];
    }
    return { webp, peak, cols, rows, rev, edge };
  }, { name, S: FX_SIZE, bg });
  const fx = FX[name], file = join(ROOT, 'src/art', `fx-skill-${name}.webp`);
  writeFileSync(file, Buffer.from(r.webp, 'base64'));
  if (r.rev) writeFileSync(join(review, `${name}.png`), Buffer.from(r.rev, 'base64'));
  const p = r.peak, kb = (Buffer.from(r.webp, 'base64').length / 1024).toFixed(0);
  const warn = (r.edge > 6 ? ` · 경고: 프레임 가장자리에 닿음 (${r.edge})` : '');
  console.log(`✓ ${name}: ${fx.frames}장 ${r.cols}×${r.rows} · ${kb}KB · 진하기 ${p.slice(0, 3).join('/')}…${p.slice(-3).join('/')}${warn}`);
}
const contact = opt('contact');
if (contact && review) {
  const png = await page.evaluate(() => {
    const rows = window.__rows || [], W = rows[0].width, out = document.createElement('canvas'); out.width = W; out.height = rows.length * rows[0].height;
    const g = out.getContext('2d'); rows.forEach((r, i) => g.drawImage(r, 0, i * r.height));
    return out.toDataURL('image/png').split(',')[1];
  });
  writeFileSync(contact, Buffer.from(png, 'base64'));
  console.log(`한눈에 보기: ${contact}`);
}
await browser.close();
