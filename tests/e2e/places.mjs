// 장소마다 화면 흐름 (38 0-8): 전투 탭 → 편성 → 출발 → 구간마다 적을 지워 넘김 (휴식 → 계속) → 결과 화면.
// 만든 장소를 화면에서 모두 찾아 돌고, 셋에 하나는 마지막 구간에서 포기해 진 결과로. 대상 폰 크기 (S25 · 울트라 · 플립)를 돌아가며 첫 전투 · 결과 캡처
// 나눠 돌릴 때 (part = { k, n }) 찾은 장소 중 n개마다 k번째만 (폰 크기 · 포기 순서는 통째로 돌 때와 같음)
import { chromium } from 'playwright';
import { chooseContent, departGo, killEnemies, pastTitle, rowContentKeys, toParty } from './nav.mjs';
import { DEVICES } from './devices.mjs';

const TABS = ['explore', 'dungeon', 'raid10', 'raid20'];
const PHONES = DEVICES.filter(([name]) => !/WQHD/.test(name));
const BAD = /NaN|undefined|Infinity/;

export default async function places(url, shots, part) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const pages = [];
  for (const [name, width, height] of PHONES) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(`pageerror (${name}): ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`console (${name}): ${m.text()}`); });
    await page.clock.install();
    await page.goto(url);
    await page.clock.runFor(300);
    await pastTitle(page);
    pages.push({ page, tag: `${name} ${width}×${height}`, size: `${width}x${height}` });
  }

  // 만든 장소 찾기: 분류 → 장소 줄. 개발 빌드는 레벨 잠금 없이 열려서 전부 보임.
  const list = [];
  {
    const { page } = pages[0];
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
    for (const tab of TABS) {
      await page.click(`#s-content [data-ctab="${tab}"]`); await page.clock.runFor(50);
      for (const key of await rowContentKeys(page)) {
        await chooseContent(page,key);
        if (await page.isEnabled('#contentGo') && !/준비 중/.test(await page.textContent('#s-content .b-gate'))) list.push({ key, tab });
      }
    }
  }
  ok(new Set(list.map(p => p.key)).size === list.length, '장소 줄 목록에 중복 없음');
  ok(list.filter(p => p.tab === 'explore').length >= 8 && list.filter(p => p.tab === 'dungeon').length >= 7, `만든 장소를 전투 탭에서 찾음 (${list.length}곳: ${list.map(p => p.key).join(' · ')})`);

  for (const [i, p] of list.entries()) {
    if (part && i % part.n !== part.k) continue;
    const { page, tag, size } = pages[i % pages.length];
    const lose = i % 3 === 2;
    await page.reload(); await page.clock.runFor(300);
    await pastTitle(page);
    await toParty(page, { content: p.key, tab: p.tab });
    ok(await page.isVisible('#s-party') && await page.isEnabled('#depart'), `${p.key} (${tag}): 편성 화면, 출발 가능`);
    await departGo(page); await page.clock.runFor(3100 + 500);
    const run = await page.evaluate(() => { const R = window.__proto.dungeon, F = window.__proto.F; return { segs: R.segs.slice(), enc: F.enc.key, name: F.enc.name, place: R.name, diff: F.cfg.diff }; });
    // 위치 줄 = 「장소 · 난이도」만 (2026-10-16 Lim), 줄 안에 다 들어감
    const loc = await page.evaluate(() => { const el = document.querySelector('#battle .stage-loc'); return { phase: document.getElementById('phase').textContent, label: document.getElementById('encounterLabel').textContent, fits: el.scrollWidth <= el.clientWidth + .5 }; });
    ok(run.enc === run.segs[0] && loc.phase === `${run.place} · ${run.diff}` && !loc.label && loc.fits, `${p.key}: 첫 구간 ${run.name} 시작 (${run.segs.length}구간) · 위치 줄 「${loc.phase}」`, loc);
    ok(!BAD.test(await page.textContent('#battle')), `${p.key}: 전투 화면에 NaN · undefined 없음`);
    await page.screenshot({ path: `${shots}/place_${p.key}_battle_${size}.png` });

    let stuck = '';
    for (let s = 0; s < run.segs.length && !stuck; s++) {
      if (lose && s === run.segs.length - 1) break;
      let done = false;
      for (let k = 0; k < 6 && !done; k++) {
        await killEnemies(page); await page.clock.runFor(1500);
        done = await page.isVisible('#rest') || await page.isVisible('#s-settle');
      }
      if (!done) { stuck = run.segs[s]; break; }
      if (s < run.segs.length - 1) {
        await page.click('#restGo'); await page.clock.runFor(3100 + 500);
        const now = await page.evaluate(() => window.__proto.F.enc.key);
        if (now !== run.segs[s + 1]) stuck = `${run.segs[s]} → ${now}`;
      }
    }
    ok(!stuck, `${p.key}: 구간마다 넘어감${stuck ? ` (막힘: ${stuck})` : ''}`);
    if (lose) {
      await page.click('#pauseBtn'); await page.clock.runFor(50);
      await page.click('#quitBtn');
      await page.locator('#battleConfirm').waitFor({ state: 'visible' });
      await page.click('#confirmApply'); await page.clock.runFor(300);
    }
    const h1 = (await page.isVisible('#s-settle')) ? await page.textContent('#s-settle h1') : '';
    ok(!!h1 && (lose ? /포기|전멸/.test(h1) : /클리어/.test(h1)), `${p.key}: ${lose ? '포기 → 진 결과' : '마지막 보스 → 이긴 결과'} (${h1})`);
    ok(!BAD.test(await page.textContent('#s-settle')), `${p.key}: 결과 화면에 NaN · undefined 없음`);
    const foot = await page.evaluate(() => { const f = document.querySelector('#s-settle .ns-foot')?.getBoundingClientRect(); return f ? Math.round(f.bottom) : 1e9; });
    ok(foot <= page.viewportSize().height + 1, `${p.key} (${tag}): 결과 아래 버튼이 화면 안 (${foot})`);
    await page.screenshot({ path: `${shots}/place_${p.key}_result_${size}.png` });
  }
  for (const { page } of pages) await page.context().close();
  await browser.close();
  return { fails, errs };
}
