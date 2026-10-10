// 장소마다 화면 흐름 (38 0-8): 전투 탭 → 편성 → 출발 → 구간마다 적을 지워 넘김 (휴식 → 계속) → 결과 화면.
// 만든 장소를 화면에서 모두 찾아 돌고, 셋에 하나는 마지막 구간에서 포기해 진 결과로. 대상 폰 크기 (S25 · 울트라 · 플립)를 돌아가며 첫 전투 · 결과 캡처
import { chromium } from 'playwright';
import { killEnemies, pastTitle, toParty } from './nav.mjs';
import { DEVICES } from './devices.mjs';

const TABS = ['explore', 'dungeon', 'raid10', 'raid20'];
const PHONES = DEVICES.filter(([name]) => !/WQHD/.test(name));
const BAD = /NaN|undefined|Infinity/;

export default async function places(url, shots) {
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

  // 만든 장소 찾기: 분류마다 장소 칸을 눌러 「출전」이 눌리는 곳 (개발 빌드는 레벨 잠금 없이 열림)
  const list = [];
  {
    const { page } = pages[0];
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
    for (const tab of TABS) {
      await page.click(`#s-content [data-ctab="${tab}"]`); await page.clock.runFor(50);
      const keys = await page.evaluate(() => [...document.querySelectorAll('#s-content [data-content]')].map(b => b.dataset.content));
      for (const key of keys) {
        await page.click(`#s-content [data-content="${key}"]`); await page.clock.runFor(50);
        if (await page.isEnabled('#contentGo') && !/준비 중/.test(await page.textContent('#s-content .b-gate'))) list.push({ key, tab });
      }
    }
  }
  ok(list.filter(p => p.tab === 'explore').length >= 8 && list.filter(p => p.tab === 'dungeon').length >= 7, `만든 장소를 전투 탭에서 찾음 (${list.length}곳: ${list.map(p => p.key).join(' · ')})`);

  for (const [i, p] of list.entries()) {
    const { page, tag, size } = pages[i % pages.length];
    const lose = i % 3 === 2;
    await page.reload(); await page.clock.runFor(300);
    await pastTitle(page);
    await toParty(page, { content: p.key, tab: p.tab });
    ok(await page.isVisible('#s-party') && await page.isEnabled('#depart'), `${p.key} (${tag}): 편성 화면, 출발 가능`);
    await page.click('#depart'); await page.clock.runFor(3100 + 500);
    const run = await page.evaluate(() => { const R = window.__proto.dungeon, F = window.__proto.F; return { segs: R.segs.slice(), enc: F.enc.key, name: F.enc.name }; });
    // 보스 한 마리는 이름 줄에, 무리 구간은 위치 줄 앞에 이름
    const top = `${await page.textContent('#encounterLabel')} ${await page.textContent('#bossName')}`;
    ok(run.enc === run.segs[0] && top.includes(run.name), `${p.key}: 첫 구간 ${run.name} 시작 (${run.segs.length}구간)`);
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
