// UI-only regression fixtures: separate browser storage, never a player's save.
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function dialogs(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (condition, message) => { console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`); if (!condition) fails++; };
  try {
    for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 780 }, { width: 360, height: 880 }, { width: 412, height: 915 }]) {
      const label = `${viewport.width}×${viewport.height}`;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on('pageerror', e => errs.push(`${label}: ${e.message}`));
      await page.clock.install();
      await page.goto(url); await page.clock.runFor(300); await pastTitle(page);
      await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('healer.save'));
        const item = (id, slot) => ({ id, slot, grade: '희귀', plus: 0, name: `검수 ${slot}` });
        saved.player.level = 80; saved.player.gold = 1000;
        saved.mats = { stone: 10, refined: 0 };
        saved.gear.equipped = { head: item(901, 'head') };
        saved.gear.bag = [item(902, 'ring'), item(903, 'neck')];
        saved.settings.devUnlock = true;
        localStorage.setItem('healer.save', JSON.stringify(saved));
      });
      await page.reload(); await page.clock.runFor(300); await pastTitle(page);
      await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(50);

      const inside = () => page.evaluate(() => !!document.activeElement?.closest('#s-char .sheet, #s-party .sheet'));
      const charOpen = '#s-char .gtile[data-gitem="901"]';
      await page.click(charOpen); await page.clock.runFor(50);
      ok(await page.getAttribute('#s-char .c7-gsheet', 'aria-modal') === 'true' && await page.locator('#gearSheetTitle').textContent() === '장비 상세' && await inside(), `${label} 장비 상세: 제목·모달 의미·초기 포커스`);
      ok(await page.evaluate(() => document.querySelector('#tabs').inert && document.querySelector('#s-char .topbar').inert), `${label} 모달 배경과 하단 내비게이션 inert`);
      for (const key of ['Shift+Tab', 'Tab', 'Tab', 'Shift+Tab']) { await page.keyboard.press(key); ok(await inside(), `${label} ${key} 포커스가 시트 안에 유지`); }
      await page.evaluate(() => document.querySelector('#s-char .topbar button').focus());
      ok(await inside(), `${label} 배경 프로그램 포커스 차단`);

      await page.click('#s-char [data-lock="901"]'); await page.clock.runFor(50);
      ok(await page.evaluate(() => document.activeElement?.matches('[data-lock="901"]')), `${label} 잠금 즉시 저장 재렌더 뒤 같은 버튼 포커스`);
      const lockedGear = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('healer.save')).gear));
      await page.keyboard.press('Escape'); await page.clock.runFor(50);
      ok(await page.evaluate(() => document.activeElement?.matches('.gtile[data-gitem="901"]') && !document.querySelector('#tabs').inert), `${label} Escape → 착용칸 포커스 복귀·배경 해제`);
      ok(lockedGear === await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('healer.save')).gear)), `${label} 닫기는 저장된 장비 상태를 되돌리지 않음`);

      await page.click(charOpen); await page.clock.runFor(50);
      await page.locator('#s-char .c7-gsheet').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const closeRect = await page.locator('#s-char .c7-dialog-close').boundingBox();
      ok(closeRect && closeRect.y >= 70 && closeRect.y + closeRect.height <= viewport.height && closeRect.height >= 44, `${label} 스크롤 후에도 44px 닫기 노출`);
      await page.screenshot({ path: `${shots}/dialog-gear-${viewport.width}x${viewport.height}.png`, animations: 'disabled' });
      await page.click('#s-char .c7-dialog-close'); await page.clock.runFor(50);
      ok(!(await page.locator('#s-char .c7-gsheet').count()), `${label} 명시 닫기`);
      await page.click(charOpen); await page.clock.runFor(50);
      await page.click('#s-char .sheet-dim', { position: { x: 4, y: 75 } }); await page.clock.runFor(50);
      ok(await page.evaluate(() => document.activeElement?.matches('.gtile[data-gitem="901"]')), `${label} 배경 탭 → 원래 장비칸`);

      await page.click('#s-char [data-bag]'); await page.clock.runFor(50);
      await page.click('#s-char .c7-bag[data-gitem="903"]'); await page.clock.runFor(50);
      await page.click('#s-char .c7-dialog-close'); await page.clock.runFor(50);
      ok(await page.isVisible('#s-char .c7-bsheet') && await page.evaluate(() => document.activeElement?.matches('.c7-bag[data-gitem="903"]')), `${label} 상세 닫기 → 가방과 원래 가방 칸 복귀`);
      await page.keyboard.press('Escape'); await page.clock.runFor(50);
      ok(await page.evaluate(() => document.activeElement?.matches('[data-bag]') && !document.querySelector('#tabs').inert), `${label} 가방 닫기 → 가방 열기 버튼`);

      const shell = () => page.evaluate(() => ({ top: document.querySelector('#s-party .topbar').getBoundingClientRect().top, app: document.querySelector('#app').scrollTop, viewport: document.querySelector('#viewport').scrollTop }));
      for (let attempt = 0; attempt < 2; attempt++) {
        await toParty(page, { tab: 'raid', content: 'cathedral1', diff: '쉬움' });
        let state = await shell();
        ok(state.top >= 70 && state.app === 0 && state.viewport === 0, `${label} 20인 편성 진입${attempt + 1}: 헤더와 상위 스크롤 정상`);
        await page.click('#guideOpen'); await page.clock.runFor(50);
        ok(await page.getAttribute('#s-party .f-gsheet', 'aria-modal') === 'true' && await inside(), `${label} 공략 시트 모달 포커스`);
        await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
        ok(await inside(), `${label} 공략 Tab 순환`);
        await page.keyboard.press('Escape'); await page.clock.runFor(50);
        ok(await page.evaluate(() => document.activeElement?.id === 'guideOpen'), `${label} 공략 닫기 포커스 복귀`);
        const last = page.locator('#s-party [data-prow]').last();
        await last.scrollIntoViewIfNeeded();
        const row = await last.getAttribute('data-prow');
        const scrollBefore = await page.locator('#s-party .ns-body').evaluate(el => el.scrollTop);
        await last.click(); await page.clock.runFor(50);
        await page.keyboard.press('Escape'); await page.clock.runFor(50);
        state = await shell();
        ok(await page.evaluate(i => document.activeElement?.getAttribute('data-prow') === i, row) && await page.locator('#s-party .ns-body').evaluate(el => el.scrollTop) === scrollBefore, `${label} 마지막 멤버 상세 복귀: 포커스·목록 스크롤 유지`);
        ok(state.top >= 70 && state.app === 0 && state.viewport === 0, `${label} 시트 복귀 뒤 광고 아래 헤더 전체 유지`);
        await page.click('#s-party .tb-back'); await page.clock.runFor(50);
      }
      await toParty(page, { tab: 'raid', content: 'cathedral1', diff: '쉬움' });
      await page.screenshot({ path: `${shots}/dialog-party-${viewport.width}x${viewport.height}.png`, animations: 'disabled' });
      await context.close();
    }
  } finally { await browser.close(); }
  return { fails, errs };
}
