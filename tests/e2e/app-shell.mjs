// 앱 틀 확인: 상단 배너 영역 70dp, 타이틀 → 로비, 하단 탭, 작은 화면에서도 전투 화면이 배너 아래에 들어가는지 (09 1장·5장)
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

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
    const rect = sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
    const banner = await rect('#adBanner');
    ok(banner.top === 0 && banner.height === 70, `${w}: 배너 영역 = 맨 위 70 ${JSON.stringify({ top: banner.top, h: banner.height })}`);
    ok(await page.isVisible('#s-title') && await page.isHidden('#tabs'), `${w}: 처음 = 타이틀, 탭 숨김`);
    await page.click('#s-title'); await page.clock.runFor(100);
    ok(await page.isVisible('#s-story'), `${w}: 새 저장은 화면을 누르면 튜토리얼 이야기`);
    await pastTitle(page);
    ok(await page.isVisible('#s-lobby'), `${w}: 튜토리얼 건너뛰기 → 로비`);
    const top = await rect('#s-lobby .topbar');
    ok(top.top >= 70, `${w}: 로비 위쪽 줄은 배너 아래 (top ${top.top})`);
    ok(await page.isVisible('#tabs') && (await page.locator('#tabs button').count()) === 4, `${w}: 하단 탭 4개 (전투·캐릭터·길드·상점)`);
    const start = await rect('#lobbyStart'), tabs = await rect('#tabs');
    ok(start.bottom <= tabs.top + 0.5, `${w}: 「전투 시작」이 탭에 안 가림 (${Math.round(start.bottom)} ≤ ${Math.round(tabs.top)})`);
    await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(50);
    ok(await page.isVisible('#s-char') && (await page.locator('#s-char .gtile').count()) === 6, `${w}: 캐릭터 탭 = 장비 6부위부터`);
    await page.click('#s-char [data-csub="talent"]'); await page.clock.runFor(50);
    ok(/Lv 10에 열림/.test(await page.textContent('#s-char')), `${w}: 캐릭터 → 특성 = Lv 10 잠금 안내`);
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(50);
    ok(await page.isVisible('#s-lobby'), `${w}: 전투 탭 = 로비로 돌아옴`);
    await page.screenshot({ path: `${shots}/shell_lobby_${w}.png` });

    // 레이드 악몽 20인: Lv 1이어도 개발 빌드는 열림 (설정 「레벨 잠금 무시」 기본 켬)
    await toParty(page, { content: 'abyss1', tab: 'raid', diff: '악몽' });
    ok(await page.isHidden('#tabs') && (await page.locator('#s-party .pcard').count()) === 19, `${w}: 20인 편성 = 나 빼고 19명, 탭 숨김`);
    await page.screenshot({ path: `${shots}/shell_party20_${w}.png` });
    await page.click('#depart'); await page.clock.runFor(3100 + 5000);
    ok(await page.isHidden('#tabs') && await page.isVisible('#battle'), `${w}: 전투 중엔 탭 숨김`);
    const stage = await rect('#stage');
    const ctrl = await rect('#controls');
    ok(stage.top >= 70 && ctrl.bottom <= h + 0.5, `${w}: 전투 화면이 배너 아래~화면 안 ${JSON.stringify({ stageTop: stage.top, ctrlBottom: ctrl.bottom })}`);
    const t = await page.evaluate(() => window.__proto.F.t);
    ok(t > 4, `${w}: 20인 전투 진행 (t=${t.toFixed(1)})`);
    await page.screenshot({ path: `${shots}/shell_battle20_${w}.png` });
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
