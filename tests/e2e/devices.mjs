// 대상 폰 크기 (2026-10-08 Lim): 갤럭시 S25 · S25 울트라 · Z 플립 펼침. 전투 탭 → 편성 → 시트 · 주간 도전 입장 · 결과 화면이 첫 화면에 다 들어오는지
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

/** CSS px (Chrome 보고 값). 울트라는 화면 배율 설정에 따라 두 가지 */
export const DEVICES = [['S25', 360, 780], ['S25 울트라', 384, 824], ['S25 울트라 (WQHD+)', 412, 915], ['Z 플립 펼침', 360, 880]];

export default async function devices(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (value, message) => { console.log(`${value ? 'PASS' : 'FAIL'} ${message}`); if (!value) fails++; };
  for (const [name, width, height] of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 7, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await pastTitle(page);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 40; s.chalOpen = 4; localStorage.setItem('healer.save', JSON.stringify(s)); });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    const tag = `${name} ${width}×${height}`;
    const box = sel => page.locator(sel).first().evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; });
    const noOverflow = sel => page.locator(sel).evaluate(el => el.scrollWidth <= el.clientWidth + 1);

    // 전투 탭: 분류 · 관문 · 장소 · 난이도 · 출전이 스크롤 없이
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
    await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
    await page.click('#s-content [data-content="rustfort"]'); await page.clock.runFor(50);
    const diffRow = await box('#s-content [data-diff="악몽"]'), go = await box('#contentGo'), tabs = await box('#tabs');
    ok(await noOverflow('#s-content .b-body') && diffRow.bottom <= go.top && go.bottom <= tabs.top + 1 && go.h >= 44, `${tag}: 전투 탭 난이도 줄·출전이 첫 화면에 (난이도 아래 ${Math.round(diffRow.bottom)} ≤ 출전 ${Math.round(go.top)})`);
    await page.screenshot({ path: `${shots}/device_battle_${width}x${height}.png` });

    // 편성 (5인): 파티원 4줄 전부 + 단축칸 · 출발이 첫 화면에
    await page.click('#contentGo'); await page.clock.runFor(150);
    const rows = await page.locator('#s-party .pcard').evaluateAll(els => els.map(e => e.getBoundingClientRect().bottom));
    const foot = await box('#s-party .f-foot2'), board = await box('#s-party .f-hexes');
    ok(await noOverflow('#s-party .f-pty') && await noOverflow('#s-party .topbar') && rows.length === 4 && Math.max(...rows) <= foot.top + 1, `${tag}: 편성 파티원 4줄이 다 보임 (마지막 줄 끝 ${Math.round(Math.max(...rows))} ≤ 아래 ${Math.round(foot.top)})`);
    ok(board.h >= 140 && foot.bottom <= height + 1, `${tag}: 위치판 높이 ${Math.round(board.h)}px (140 이상) · 아래 버튼 화면 안`);
    await page.screenshot({ path: `${shots}/device_party_${width}x${height}.png` });

    // 공략 시트: 닫기가 화면 안
    await page.click('#guideOpen'); await page.clock.runFor(400);
    const shut = await box('#s-party .f-gsheet .f-shut');
    ok(shut.bottom <= height + 1 && shut.h >= 44, `${tag}: 공략 시트 닫기가 화면 안 (${Math.round(shut.bottom)})`);
    await page.keyboard.press('Escape'); await page.clock.runFor(80);

    // 레이드 10인: 파티원 첫 줄이 첫 화면에
    await page.click('#s-party .tb-back'); await page.clock.runFor(80);
    await toParty(page, { tab: 'raid10', content: 'abyss1', diff: '보통' });
    const r0 = await box('#s-party .pcard'), foot2 = await box('#s-party .f-foot2');
    ok(await noOverflow('#s-party .f-pty') && r0.bottom <= foot2.top, `${tag}: 레이드 10인 편성 첫 파티원 줄이 첫 화면에`);
    await page.click('#s-party .tb-back'); await page.clock.runFor(80);

    // 주간 도전 입장: 보상까지 스크롤 없이, 「편성으로」 화면 안
    await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
    await page.click('#s-content [data-chal]'); await page.clock.runFor(150);
    const rw = await box('#s-entry .f-rw'), eg = await box('#entryGo');
    ok(rw.bottom <= eg.top && eg.bottom <= height + 1, `${tag}: 주간 도전 입장 보상까지 첫 화면, 편성으로 화면 안`);

    // 결과 (정산 + 보상 한 화면): 등급·별 · 받은 것이 첫 화면에, 가로 넘침 없음
    await page.click('#s-entry .tb-back'); await page.clock.runFor(80);
    await toParty(page, { tab: 'dungeon', content: 'rustfort', diff: '어려움' });
    await page.click('#depart'); await page.clock.runFor(3100 + 300);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => { const f = window.__proto.F; f.mobs.forEach(m => { m.hp = 0; m.alive = false; }); f.bossHp = 0; });
      await page.clock.runFor(1500);
      if (!(await page.isVisible('#rest'))) break;
      await page.click('#restGo'); await page.clock.runFor(3100 + 300);
    }
    const loot = await box('#s-settle .r-loot'), rfoot = await box('#s-settle .ns-foot'), rec = await box('#s-settle .r-rec');
    ok(await noOverflow('#s-settle .res') && loot.bottom <= rfoot.top && rfoot.bottom <= height + 1, `${tag}: 결과 화면 받은 것까지 첫 화면 (${Math.round(loot.bottom)} ≤ ${Math.round(rfoot.top)})`);
    ok(rec.top < rfoot.top, `${tag}: 결과 화면 「전투 기록」 줄이 보임 (${Math.round(rec.top)})`);
    await page.screenshot({ path: `${shots}/device_result_${width}x${height}.png` });
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
