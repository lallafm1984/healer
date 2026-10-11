// 보스 판 전체 공격 PXF (Lim 2026-10-11 「보스의 판 전체 공격 이펙트를 … 이펙트 공방으로 픽셀 크기를 늘려서」):
// 외침 · 등불 · 땅 울림 · 심장 박동 · 모래 폭풍 · 열기 · 크림 · 조용히 · 문 열림 · 기우는 섬 · 번개 쐐기가 예전 그림 대신 판 너비로 키운 PXF 한 장.
// 판 사각형 그대로 (판 밖은 프레임을 잘라 냄), 외침은 세력 색을 곱함, 끝나면 사라짐. S25 × 5인 · 20인 판
import { chromium } from 'playwright';
import { patchSave, toParty } from './nav.mjs';

const BOARDS = [{ n: 5, tab: 'dungeon', content: 'rustfort' }, { n: 20, tab: 'raid20', content: 'cathedral1' }];

export default async function bossPxf(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, detail) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) { fails++; if (detail) console.log(JSON.stringify(detail)); } };
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 11, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: false, vibrate: false, reducedEffects: false, zoom: false } });
    for (const b of BOARDS) {
      await toParty(page, { tab: b.tab, content: b.content, diff: '쉬움' });
      await page.click('#depart'); await page.clock.runFor(6500);
      const boss = await page.evaluate(() => { window.__proto.F.skills.forEach(k => { k.next = Infinity; }); return Object.entries(window.__proto.pxf.boss); });
      ok(boss.length === 11, `${b.n}인: 보스 판 전체 공격 PXF ${boss.length}가지`);
      for (const [name, fx] of boss) {
        const rect = await page.evaluate(name => {
          const F = window.__proto.F;
          F.bossHp = F.bossMax; for (const x of [...F.party, ...F.mobs]) if (x.alive !== false) x.hp = x.max;
          F.events.push({ type: 'fx', name, all: true });
          return window.__proto.pxf.rect();
        }, name);
        await page.clock.runFor(200);
        const g = await page.evaluate(fx => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').filter(d => d.key.startsWith(`pxf-${fx}-`)), fx);
        const d = g[0], w = rect.right - rect.left, h = rect.bottom - rect.top;
        ok(g.length === 1 && d.frame >= 0, `${b.n}인 ${name}: ${fx} 한 장 재생 (프레임 ${d?.frame})`, g);
        ok(!!d && Math.abs(d.w - w) < 0.5 && Math.abs(d.h - h) < 0.5 && Math.abs(d.left - rect.left) < 0.5 && Math.abs(d.top - rect.top) < 0.5, `${b.n}인 ${name}: 판 사각형 그대로 (${w.toFixed(0)}×${h.toFixed(0)})`, { d, rect });
        if (fx === 'boss-shout') ok(typeof d?.tint === 'number' && d.tint !== 0xffffff, `${b.n}인 외침: 회색 그림에 색을 곱함 (${d?.tint?.toString(16)})`, d);
        else ok(d?.tint == null, `${b.n}인 ${name}: 구운 색 그대로`, d);
        if (b.n === 5 || fx === 'boss-shout') await page.locator('#board').screenshot({ path: `${shots}/boss_pxf_${b.n}_${name}.png` });
        await page.clock.runFor(1200);
        const left = await page.evaluate(fx => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').filter(d => d.key.startsWith(`pxf-${fx}-`)).length, fx);
        ok(left === 0, `${b.n}인 ${name}: 끝나면 사라짐`);
      }
      await page.click('#pauseBtn'); await page.click('#quitBtn'); await page.click('#confirmApply');
      await page.clock.runFor(120); await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(80);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  return { fails, errs };
}
