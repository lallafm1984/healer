// 개발 빌드 자동 치유 (Lim 2026-10-07): 설정과 전투 일시정지에서 켜고 끄고, 바꾸면 저장
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function devauto(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const auto = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).settings.auto);
  // 내 스킬 시전 수 (파티원 흡혈 같은 회복은 빼고 보려고)
  const casts = () => page.evaluate(() => Object.values(window.__proto.F.stats.casts).reduce((a, b) => a + b, 0));
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // 설정: 개발 빌드 「자동 치유」 (꺼짐)
  await page.click('#s-lobby .tb-set'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-settings [data-tog="auto"]') && /자동 치유/.test(await page.textContent('#s-settings .group.dev')), '설정 개발 빌드에 「자동 치유」');
  ok(!(await page.isChecked('#s-settings [data-tog="auto"]')), '처음엔 꺼짐');
  await page.click('#s-settings .tb-back'); await page.clock.runFor(100);

  // 전투 일시정지에서 켬 → 저장, 손대지 않아도 힐이 들어감
  await toParty(page, { content: 'rustfort' });
  await page.click('#depart'); await page.clock.runFor(3100 + 500);
  await page.click('#pauseBtn'); await page.clock.runFor(50);
  ok(await page.isVisible('#pauseAuto') && !(await page.isChecked('#pauseAuto')), '일시정지에 「자동 치유」 (꺼짐)');
  await page.screenshot({ path: `${shots}/devauto_pause.png` });
  await page.check('#pauseAuto'); await page.clock.runFor(50);
  ok(await auto() === true, '일시정지에서 켜면 설정에 저장');
  const c0 = await casts();
  await page.click('#resumeBtn'); await page.clock.runFor(8000);
  ok(await casts() > c0, `켜면 자동 힐러가 스킬을 씀 (시전 ${c0} → ${await casts()})`);

  // 다시 끔 → 손을 안 대면 힐이 안 들어감
  await page.click('#pauseBtn'); await page.clock.runFor(50);
  ok(await page.isChecked('#pauseAuto'), '다시 열면 켜짐 표시');
  await page.uncheck('#pauseAuto'); await page.clock.runFor(50);
  ok(await auto() === false, '끄면 설정에 저장');
  await page.click('#resumeBtn'); await page.clock.runFor(2500); // 시전 중이던 힐이 끝나게
  const c1 = await casts();
  await page.clock.runFor(6000);
  ok(await casts() === c1, `끄면 자동 힐러가 스킬을 안 씀 (시전 ${c1} → ${await casts()})`);

  // 한 번이라도 켠 판은 자동 힐러 판
  await page.click('#pauseBtn'); await page.clock.runFor(50);
  await page.click('#quitBtn'); await page.clock.runFor(300);
  ok(await page.evaluate(() => window.__proto.last.auto) === true, '켰던 판은 결과에 자동 힐러 표시');
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
