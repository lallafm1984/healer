// 세로 UI 회귀: 그림 로드 (캐릭터 그림 없음, 장소·메뉴 그림은 28), 고정 출발 버튼, 좁은 메뉴, 20인/특성/전멸 배치.
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function portrait(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (value, message) => { console.log(`${value ? 'PASS' : 'FAIL'} ${message}`); if (!value) fails++; };
  for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install();
    await page.goto(url);
    await page.clock.runFor(300);
    const loaded = selector => page.locator(selector).evaluateAll(async imgs => {
      await Promise.all(imgs.map(i => i.decode().catch(() => {})));
      return imgs.length > 0 && imgs.every(i => i.naturalWidth > 0 && i.complete);
    });
    const noOverflow = selector => page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    // CSS 배경 그림 (pseudo = '::before' 등)이 실제로 읽히는지
    const bgLoaded = (selector, pseudo = null) => page.locator(selector).first().evaluate(async (el, ps) => {
      const urls = [...getComputedStyle(el, ps).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)].map(m => m[1]);
      if (!urls.length) return false;
      const ok = await Promise.all(urls.map(u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; })));
      return ok.every(Boolean);
    }, pseudo);
    const noHeroArt = () => page.evaluate(() => !document.querySelector('.healer-illustration') && ![...document.images].some(i => /healer-/.test(i.src)));
    ok(await bgLoaded('#s-title') && await noHeroArt(), `${width}: 타이틀 마을 그림, 힐러 그림 없음`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_title_${width}.png` });
    await pastTitle(page);
    ok(await bgLoaded('#s-lobby .lobby-scene') && await page.locator('#s-lobby .lobby-scene .hero-art .emblem').count() === 1 && await noHeroArt(), `${width}: 로비 마을 그림 + 직업 문장 (힐러 그림 없음)`);
    const button = await page.locator('#lobbyStart').boundingBox(), tabs = await page.locator('#tabs').boundingBox();
    ok(button.y + button.height <= tabs.y + 1 && button.height >= 44, `${width}: 전투 시작 버튼 항상 탭 위, 44px 이상`);
    ok(await noOverflow('#s-lobby .ns-body'), `${width}: 로비 가로 넘침 없음`);
    await page.screenshot({ path: `${shots}/portrait_lobby_${width}.png` });

    await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(80);
    ok(await page.locator('#s-char .chero .emblem').count() === 1 && await bgLoaded('#s-char .chero .chero-art') && await noOverflow('#s-char .ns-body'), `${width}: 캐릭터 문장·장비실 그림·능력치 화면 안`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_character_${width}.png` });
    await page.click('#s-char nav [data-csub="hero"]'); await page.clock.runFor(80);
    ok(await page.locator('#s-char .hc-portrait .emblem').count() === 3 && await noHeroArt(), `${width}: 구현된 세 직업 = 직업 문장`);
    await page.click('#s-char nav [data-csub="skill"]'); await page.clock.runFor(80);
    ok(await noOverflow('#s-char .ns-body'), `${width}: 스킬 휠 편집 가로 넘침 없음`);
    await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(80);
    ok(await noOverflow('#s-shop .ns-body'), `${width}: 상점 가로 넘침 없음`);
    ok(await bgLoaded('#s-shop .shop-hero', '::before'), `${width}: 상점 선반 그림`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_shop_${width}.png` });
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(80);
    await page.click('#lobbyStart'); await page.clock.runFor(80);
    ok(await loaded('#s-content img') && await page.locator('#s-content .ccard .fmark').count() >= 6, `${width}: 던전 카드 장소 그림 + 세력 문양`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_content_${width}.png` });

    // 최고 레벨의 최대 보조 버튼 3개 + 소비 아이템 4칸 조건을 만든다.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.player.level = 100;
      s.heroes.priest ||= { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0 };
      s.heroes.priest.talents = [null, null, null, null, 0, null, 1, null, null, 0];
      s.items = ['mana', 'life', 'cleanse', 'shield'];
      s.settings.devSkills = true;
      localStorage.setItem('healer.save', JSON.stringify(s));
    });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await toParty(page, { content: 'cathedral1', tab: 'raid' });
    await page.click('#depart'); await page.clock.runFor(3400);
    const geometry = () => page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      return {
        stage: rect(document.querySelector('#stage')), board: rect(document.querySelector('#boardWrap')), controls: rect(document.querySelector('#controls')),
        buttons: [...document.querySelectorAll('#items button, #aux button, #pauseBtn')].filter(el => el.getClientRects().length).map(rect),
        wheel: rect(document.querySelector('#wheel')),
      };
    });
    const g = await geometry();
    ok(await page.evaluate(() => document.getElementById('battle').dataset.place) === 'cathedral' && await bgLoaded('#boardWrap'), `${width}: 20인 판 뒤 대성당 바닥 그림`);
    ok(g.stage.y >= 70 && g.controls.bottom <= height + 1 && g.board.h >= 120, `${width}: 20인 무대·판·조작 화면 안 (판 ${Math.round(g.board.h)}px)`);
    ok(g.buttons.every(r => r.w >= 44 && r.h >= 44 && r.x >= 0 && r.right <= width + 1 && r.bottom <= height + 1), `${width}: 최대 특성·아이템 버튼 44px 및 화면 경계`);
    ok(g.buttons.filter(r => r.y >= g.controls.y).every(r => r.right <= g.wheel.x + 1 || r.x >= g.wheel.right - 1), `${width}: 특성·아이템과 휠 겹침 없음`);
    await page.screenshot({ path: `${shots}/portrait_battle20_${width}.png` });
    if (await page.locator('#queue .q').count()) {
      const first = await page.locator('#queue .q').first().elementHandle();
      await first.focus();
      await page.clock.runFor(300);
      ok(await first.evaluate(el => el.isConnected && document.activeElement === el), `${width}: 카운트다운 중 기술 버튼 DOM·초점 유지`);
    }
    await page.evaluate(() => { for (const u of window.__proto.F.party.filter(u => u.role === 'tank')) { u.hp = 0; u.alive = false; } });
    await page.clock.runFor(100);
    const down = await geometry(), giveUp = await page.locator('#giveUp').boundingBox();
    ok(giveUp && giveUp.y + giveUp.height <= height + 1 && down.board.h >= 120, `${width}: 탱커 전멸 포기 버튼 및 판 유지 (${Math.round(down.board.h)}px)`);
    await page.screenshot({ path: `${shots}/portrait_tankdown_${width}.png` });
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
