// 스킬 이펙트를 실제 게임 전투 판에서 프레임마다 찍음 (scripts/vfx/README.md, 굽고 npx vite build 한 뒤).
// npm run fx:shot -- <스킬 키 · 이펙트 이름 · 직업 (priest …) 여럿 쉼표로 | all> [--sheet 파일.png] [--board 5|20] [--w 360 --h 780] [--every 2] [--out .sim/vfx-shots] [--url …]
// 결과: <out>/<tag>-<스킬>.png = 맞는 순간부터 끝까지 every장마다 이은 띠 + <스킬>-board.png (판 전체, 맞는 순간 + 3장), --sheet = 스킬마다 한 줄 시트
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { departGo, patchSave, toParty } from '../tests/e2e/nav.mjs';
import { HERO_FX } from './vfx/index.mjs';
import { gameUrl } from './vfx/serve.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const keyArg = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
if (!keyArg) { console.error('사용: npm run fx:shot -- <스킬 키 · 이펙트 이름 · 직업 | all> [--sheet 파일.png]'); process.exit(1); }
const dir = opt('out', '.sim/vfx-shots'), server = await gameUrl(opt('url')), url = server.url;
const board = Number(opt('board', 5)), W = Number(opt('w', 360)), H = Number(opt('h', 780)), every = Number(opt('every', 2)), tag = opt('tag', 'shot'), dpr = Number(opt('dpr', 3));
const hero = opt('hero', 'priest');
mkdirSync(dir, { recursive: true });
const BOARDS = { 5: { tab: 'dungeon', content: 'rustfort' }, 10: { tab: 'raid10', content: 'cathedral1' }, 20: { tab: 'raid20', content: 'cathedral1' } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.clock.install({ time: new Date(2026, 9, 16, 12) });
await page.goto(url); await page.clock.runFor(300);
await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: false, vibrate: false, reducedEffects: false, zoom: false, hero } });
const b = BOARDS[board];
await toParty(page, { tab: b.tab, content: b.content, diff: '쉬움' });
await departGo(page); await page.clock.runFor(6500);
const all = await page.evaluate(() => { window.__proto.F.skills.forEach(k => { k.next = Infinity; }); return window.__proto.pxf.skills; });
// 시계를 멈춰 프레임마다 정확히 (runFor만큼만 흐름)
{ const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 500); }
// 스킬 키 · 이펙트 이름 (fx) · 직업 이름 (그 직업 이펙트 전부) 아무거나
const keys = keyArg === 'all' ? Object.keys(all) : keyArg.split(',').flatMap(w => {
  if (all[w]) return [w];
  const fxs = HERO_FX[w] ?? [w];
  return Object.keys(all).filter(k => fxs.includes(all[k].fx));
});
if (!keys.length) { console.error(`없는 스킬: ${keyArg}`); process.exit(1); }
// 이펙트 띠를 다 읽어 둠
for (let i = 0; i < 40; i++) {
  const ok = await page.evaluate(ks => ks.every(k => window.__proto.pxf.ready(window.__proto.pxf.skills[k].fx)), keys);
  if (ok) break;
  await page.clock.runFor(100); await page.waitForTimeout(80);
}
const frameMs = 1000 / 24, rows = [];
for (const key of keys) {
  const t = await page.evaluate(([key]) => {
    const F = window.__proto.F, el = document.querySelector('#board'), r = el.getBoundingClientRect();
    F.bossHp = F.bossMax; for (const x of [...F.party, ...F.mobs]) if (x.alive !== false) x.hp = x.max;
    const mid = { x: r.width / 2, y: r.height * 0.55 }, dist = u => { const p = window.__proto.center(u.cell); return Math.hypot(p.x - mid.x, p.y - mid.y); };
    const u = F.party.filter(x => x.alive).sort((a, c) => dist(a) - dist(c))[0];
    (F.used ??= []).push({ key, uid: u.id });
    const c = window.__proto.center(u.cell);
    return { uid: u.id, s: Number(el.dataset.cellScale), x: r.x + c.x, y: r.y + c.y, board: { x: r.x, y: r.y, w: r.width, h: r.height } };
  }, [key]);
  const fx = all[key].fx;
  const half = Math.round(Math.max(40, t.s * 1.7));
  const shots = [];
  // 엔진이 기록 → 판이 재생 시작할 때까지 한 틱
  await page.clock.runFor(20);
  for (let f = 0; f < 40; f++) {
    const live = await page.evaluate(fx => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').some(d => d.key.startsWith('pxf') && d.key.includes(`-${fx}-`)), fx);
    if (!live && f > 0) break;
    if (f % every === 0) shots.push(await page.screenshot({ clip: { x: t.x - half, y: t.y - half, width: half * 2, height: half * 2 } }));
    if (f === 3) writeFileSync(`${dir}/${tag}-${key}-board.png`, await page.screenshot({ clip: { x: 0, y: t.board.y - 8, width: W, height: Math.min(H - t.board.y + 8, t.board.h + 16) } }));
    await page.clock.runFor(frameMs);
  }
  // 띠로 이어 붙임 (브라우저 캔버스)
  const strip = await page.evaluate(async list => {
    const imgs = await Promise.all(list.map(b64 => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${b64}`; })));
    const w = imgs[0].width, h = imgs[0].height, cv = document.createElement('canvas');
    cv.width = w * imgs.length + 4 * (imgs.length - 1); cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    imgs.forEach((im, i) => g.drawImage(im, i * (w + 4), 0));
    return cv.toDataURL('image/png').split(',')[1];
  }, shots.map(s => s.toString('base64')));
  writeFileSync(`${dir}/${tag}-${key}.png`, Buffer.from(strip, 'base64'));
  rows.push({ key, fx, strip });
  console.log(`✓ ${key} (${fx}) ${shots.length}장`);
  await page.clock.runFor(800);
}
const sheet = opt('sheet');
if (sheet && rows.length) {
  const png = await page.evaluate(async rows => {
    const imgs = await Promise.all(rows.map(r => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${r.strip}`; })));
    const H = 200, L = 230, scale = H / imgs[0].height, W = L + Math.max(...imgs.map(i => i.width * scale));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H * imgs.length;
    const g = cv.getContext('2d'); g.fillStyle = '#16141a'; g.fillRect(0, 0, W, cv.height);
    imgs.forEach((im, k) => { g.drawImage(im, L, k * H, im.width * scale, H - 4); g.fillStyle = '#eee'; g.font = '20px sans-serif'; g.fillText(rows[k].key, 8, k * H + 30); g.fillStyle = '#aaa'; g.font = '15px sans-serif'; g.fillText(rows[k].fx, 8, k * H + 54); });
    return cv.toDataURL('image/png').split(',')[1];
  }, rows.map(r => ({ key: r.key, fx: r.fx, strip: r.strip })));
  writeFileSync(sheet, Buffer.from(png, 'base64'));
  console.log('시트:', sheet);
}
if (errs.length) console.log('오류:', errs.join(' | '));
await browser.close();
server.stop();
