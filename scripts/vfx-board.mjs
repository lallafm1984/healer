// 스킬 이펙트 검수 배경 (scripts/vfx/README.md): 실제 전투 판 사진 (이펙트 없음, S25 · 3배)과 칸 가운데 · 반지름.
// npm run fx:board [-- --out .sim/vfx-bg --url http://…]  (url이 없으면 dist 미리보기를 띄움, 먼저 npx vite build)
// 결과: board5.png · board20.png · boards.json → node scripts/vfx-bake.mjs … --review 가 이 위에 게임 크기로 올림
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { departGo, patchSave, toParty } from '../tests/e2e/nav.mjs';
import { gameUrl } from './vfx/serve.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const dir = opt('out', '.sim/vfx-bg'), server = await gameUrl(opt('url')), url = server.url;
mkdirSync(dir, { recursive: true });
const BOARDS = [{ n: 5, tab: 'dungeon', content: 'rustfort' }, { n: 20, tab: 'raid20', content: 'cathedral1' }];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.clock.install({ time: new Date(2026, 9, 16, 12) });
await page.goto(url); await page.clock.runFor(300);
await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: false, vibrate: false, reducedEffects: false, zoom: false } });
const meta = {};
for (const b of BOARDS) {
  await toParty(page, { tab: b.tab, content: b.content, diff: '쉬움' });
  await departGo(page); await page.clock.runFor(6500);
  await page.evaluate(() => { const F = window.__proto.F; F.skills.forEach(k => { k.next = Infinity; }); F.bossHp = F.bossMax; for (const x of [...F.party, ...F.mobs]) if (x.alive !== false) x.hp = x.max; });
  await page.clock.runFor(1500);
  const m = await page.evaluate(() => {
    const F = window.__proto.F, el = document.querySelector('#board'), r = el.getBoundingClientRect();
    return { s: Number(el.dataset.cellScale), board: { x: r.x, y: r.y, w: r.width, h: r.height },
      cells: F.party.filter(u => u.alive).map(u => { const c = window.__proto.center(u.cell); return { id: u.id, name: u.name, role: u.role, x: r.x + c.x, y: r.y + c.y }; }) };
  });
  writeFileSync(`${dir}/board${b.n}.png`, await page.screenshot({ clip: { x: 0, y: m.board.y, width: 360, height: m.board.h } }));
  meta[b.n] = { ...m, crop: { x: 0, y: m.board.y } };
  await page.click('#pauseBtn'); await page.click('#quitBtn'); await page.click('#confirmApply');
  await page.clock.runFor(120); await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(80);
}
writeFileSync(`${dir}/boards.json`, JSON.stringify(meta, null, 1));
console.log(`✓ ${dir}: 5인 칸 ${meta[5].s} · 20인 칸 ${meta[20].s}`);
await browser.close();
server.stop();
