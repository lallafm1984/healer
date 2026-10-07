// 앱 틀 확인: 상단 배너 영역 70dp, 하단 탭, 작은 화면에서도 전투 화면이 배너 아래에 들어가는지 (09 5장)
import { chromium } from 'playwright';

export default async function appShell(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.clock.install();
    await page.goto(url);
    await page.clock.runFor(300);
    const rect = id => page.evaluate(i => document.getElementById(i).getBoundingClientRect().toJSON(), id);
    const banner = await rect('adBanner');
    ok(banner.top === 0 && banner.height === 70, `${w}: 배너 영역 = 맨 위 70 ${JSON.stringify({ top: banner.top, h: banner.height })}`);
    const menu = await rect('menu');
    ok(menu.top >= 70, `${w}: 메뉴는 배너 아래 (top ${menu.top})`);
    ok(await page.isVisible('#tabs') && (await page.locator('#tabs button').count()) === 5, `${w}: 하단 탭 5개`);
    await page.click('#tabs [data-tab="gear"]');
    ok(await page.isVisible('#tabPage') && /P2/.test(await page.textContent('#tabPage')), `${w}: 장비 탭 = 자리만 (P2)`);
    await page.click('#tabs [data-tab="battle"]');
    ok(await page.isHidden('#tabPage'), `${w}: 전투 탭으로 돌아옴`);
    await page.screenshot({ path: `${shots}/shell_menu_${w}.png` });

    await page.click('[data-enc="plague20"]');
    await page.click('#startBtn'); await page.clock.runFor(300);
    await page.click('#guideGo'); await page.clock.runFor(3100 + 5000);
    ok(await page.isHidden('#tabs'), `${w}: 전투 중엔 탭 숨김`);
    const stage = await rect('stage');
    const ctrl = await rect('controls');
    ok(stage.top >= 70 && ctrl.bottom <= h + 0.5, `${w}: 전투 화면이 배너 아래~화면 안 ${JSON.stringify({ stageTop: stage.top, ctrlBottom: ctrl.bottom })}`);
    const t = await page.evaluate(() => window.__proto.F.t);
    ok(t > 4, `${w}: 20인 전투 진행 (t=${t.toFixed(1)})`);
    await page.screenshot({ path: `${shots}/shell_battle20_${w}.png` });
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
