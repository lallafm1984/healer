// 사제 특성 (06 6장, 27 4-5): 칸 → 아래 시트에서 고르기·풀기·저장, 프리셋 1·2·3, 전투 보조 버튼 (정점 바로 / 쉼터 장전 → 빈 칸)
import { chromium } from 'playwright';
import { departGo, pastTitle, patchSave, toParty } from './nav.mjs';

export default async function talents(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const mine = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).heroes?.priest?.talents || []);
  const text = sel => page.textContent(sel);
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  /** 칸을 눌러 시트를 열고 「고르기」(고른 칸이면 「풀기」) */
  const pick = async (tier, j) => {
    await page.click(`#s-char [data-tcell="${tier}:${j}"]`); await page.clock.runFor(50);
    await page.click(`#s-char .c7-tsheet [data-talent="${tier}:${j}"]`); await page.clock.runFor(50);
  };
  /** 전투 판에서 그 칸 탭 */
  const tapCell = async i => {
    const bb = await page.locator('#board').boundingBox();
    const at = await page.evaluate(i => window.__proto.center(i), i);
    await page.mouse.move(bb.x + at.x, bb.y + at.y); await page.mouse.down(); await page.clock.runFor(60); await page.mouse.up(); await page.clock.runFor(60);
  };
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // ---- 고르기 ----
  await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.click('#s-char nav [data-csub="talent"]'); await page.clock.runFor(50);
  ok(/10단 열림 · 0개 고름 · 10개 남음/.test(await text('#s-char .c7-tsum')) && (await page.locator('#s-char .c7-tier.pending').count()) === 10, 'Lv 100: 10단 열림, 아무것도 안 고름 (줄마다 금테)');
  await pick(0, 0);
  ok((await mine())[0] === 0 && await page.getAttribute('#s-char [data-tcell="0:0"]', 'aria-pressed') === 'true' && /✓\s*긴 숨결/.test(await text('#s-char .c7-tier:first-child')) && !(await page.isVisible('#s-char .c7-tsheet')), '1단 긴 숨결 고름 → 저장, ✓ 표시, 시트 닫힘');
  ok((await page.locator('#s-char .c7-tpath').count()) === 0, '특성 사이 연결선 없음');
  await pick(0, 1);
  ok((await mine())[0] === 1 && await page.getAttribute('#s-char [data-tcell="0:0"]', 'aria-pressed') === 'false', '같은 단 다른 특성 = 바꿈 (무료)');
  await page.click('#s-char [data-tcell="0:1"]'); await page.clock.runFor(50);
  ok(/풀기/.test(await text('#s-char .c7-tsheet [data-talent="0:1"]')), '고른 특성의 시트 = 「풀기」');
  await page.click('#s-char .c7-tsheet [data-talent="0:1"]'); await page.clock.runFor(50);
  ok((await mine())[0] === null, '고른 특성을 다시 누르면 해제');
  await pick(6, 1); // 쉼터
  await pick(9, 0); // 기도의 정점
  ok((await mine())[6] === 1 && (await mine())[9] === 0, '쉼터 · 기도의 정점 고름');
  await page.click('#s-char [data-tcell="9:0"]'); await page.clock.runFor(50);
  ok(/보조 버튼/.test(await text('#s-char .c7-tsheet')), '보조 버튼 특성 표시 (시트)');
  await page.screenshot({ path: `${shots}/talent_pick.png`, animations: 'disabled' });
  await page.click('#s-char .c7-tsum'); await page.clock.runFor(50);

  // ---- 프리셋 ----
  await page.click('#s-char [data-preset="1"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.heroes.priest.preset === 1 && (sv.heroes.priest.talents || []).every(x => x == null) && sv.heroes.priest.presets[0][6] === 1 && /0개 고름/.test(await text('#s-char .c7-tsum')), '프리셋 2 = 빈 특성, 프리셋 1은 넣어 둠');
  await pick(0, 2);
  await page.click('#s-char [data-preset="0"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.heroes.priest.preset === 0 && (await mine())[6] === 1 && (await mine())[9] === 0 && sv.heroes.priest.presets[1][0] === 2 && await page.getAttribute('#s-char [data-preset="0"]', 'aria-pressed') === 'true', '프리셋 1로 돌아오면 쉼터·정점 그대로, 프리셋 2 고름도 저장');

  // ---- 전투: 보조 버튼 ----
  await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(100);
  await toParty(page, { content: 'rustfort' });
  await departGo(page); await page.clock.runFor(3100 + 1000);
  ok(await page.evaluate(() => { const on = window.__proto.F.tx.on; return on.shelter && on.zenith && Object.keys(on).length === 2; }), '전투 = 고른 특성 2개만 켜짐');
  ok(await page.isVisible('#aux') && (await page.locator('#aux [data-tal]').count()) === 2, '왼쪽 아래 특성 버튼 2개');
  await page.dispatchEvent('#aux [data-tal="zenith"]', 'pointerdown'); await page.dispatchEvent('#aux [data-tal="zenith"]', 'pointerup'); await page.clock.runFor(100);
  ok(await page.evaluate(() => window.__proto.F.tx.act.zenith.left > 0) && await page.isVisible('#aux [data-tal].on[data-tal="zenith"]'), '정점 = 바로 켜짐');
  await page.dispatchEvent('#aux [data-tal="shelter"]', 'pointerdown'); await page.dispatchEvent('#aux [data-tal="shelter"]', 'pointerup'); await page.clock.runFor(50);
  ok(await page.isVisible('#aux [data-tal].armed[data-tal="shelter"]') && /빈 칸 선택/.test(await text('#toast')), '쉼터 = 장전, 빈 칸 안내');
  const empty = await page.evaluate(() => window.__proto.F.cells.findIndex(c => !c.unit));
  await tapCell(empty);
  ok(await page.evaluate(i => window.__proto.F.tx.shelter === i, empty) && !(await page.isVisible('#aux [data-tal].armed')), '빈 칸 탭 = 그 칸이 쉼터');
  await page.screenshot({ path: `${shots}/talent_battle.png` });

  await ctx.close();

  // 특성 재설계: 잠금·선택 규칙은 같고, 작은 화면에서도 시트 조작과 마지막 단에 도달해야 한다.
  for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
    const mobile = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await mobile.newPage();
    p.on('pageerror', e => errs.push(`${width}: pageerror: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') errs.push(`${width}: console: ${m.text()}`); });
    await p.clock.install();
    await p.goto(url); await p.clock.runFor(300); await pastTitle(p);
    for (const level of [1, 25, 50]) {
      await patchSave(p, { player: { level } }); await pastTitle(p);
      await p.click('#tabs [data-tab="char"]'); await p.clock.runFor(100);
      await p.click('#s-char [data-csub="talent"]'); await p.clock.runFor(50);
      await p.screenshot({ path: `${shots}/talent_lv${level}_${width}.png`, animations: 'disabled' });
      const open = Math.min(10, Math.floor(level / 5));
      ok(await p.locator('#s-char .c7-tier.locked').count() === 10 - open && await p.locator('#s-char [data-tcell]').count() === open * 3, `${width} Lv ${level}: 열린 단만 3택1 버튼, 잠긴 단 비활성`);
      const fits = await p.evaluate(() => {
        const body = document.querySelector('#s-char .ns-body');
        return body.scrollWidth <= body.clientWidth + 1 && [...document.querySelectorAll('#s-char .c7-tier')].every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
      });
      ok(fits, `${width} Lv ${level}: 특성 목록 수평 넘침 없음`);
    }
    // 긴 설명(은혜 갚기)·보조 버튼(쉼터)·마지막 단의 시트와 하단 탭 경계.
    for (const [cell, label] of [['5:0', 'long'], ['6:1', 'active'], ['9:0', 'last']]) {
      await p.click(`#s-char [data-tcell="${cell}"]`); await p.clock.runFor(50);
      await p.screenshot({ path: `${shots}/talent_${label}_${width}.png`, animations: 'disabled' });
      const safe = await p.evaluate(() => {
        const sh = document.querySelector('#s-char .c7-tsheet'), r = sh.getBoundingClientRect();
        const tab = document.querySelector('#tabs').getBoundingClientRect();
        const controls = [...sh.querySelectorAll('button')].map(el => ({ el, r: el.getBoundingClientRect() }));
        return r.left >= 0 && r.right <= innerWidth && r.bottom <= tab.top && controls.every(({ el, r: b }) => b.width >= 44 && b.height >= 44 && b.top >= r.top && b.bottom <= r.bottom && el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)));
      });
      ok(safe, `${width} ${label}: 설명 닫기·CTA 44px 이상, 시트 안에 표시되고 탭바와 겹치지 않음`);
      if (label === 'last') {
        // 2026-10-16 Lim: 시트가 목록에 여백을 붙이지 않음 (스크롤 범위 그대로), 누른 단을 가리면 시트가 위로
        const lastSeen = await p.evaluate(() => {
          const c = document.querySelector('#s-char [data-tier="9"] .c7-tnodes').getBoundingClientRect(), sh = document.querySelector('#s-char .c7-tsheet').getBoundingClientRect();
          return c.bottom <= sh.top || c.top >= sh.bottom;
        });
        ok(lastSeen, `${width}: 시트가 누른 최하단 단을 가리지 않음`);
      }
      await p.getByRole('button', { name: '특성 설명 닫기', exact: true }).click();
      ok(!(await p.isVisible('#s-char .c7-tsheet')), `${width} ${label}: 명시적 닫기 버튼`);
    }
    // native 키보드 활성화와 재렌더 뒤 CTA/원래 노드/프리셋으로의 포커스 복원.
    await p.locator('#s-char [data-tcell="0:0"]').focus(); await p.keyboard.press('Enter');
    ok(await p.isVisible('#s-char .c7-tsheet'), `${width}: Enter로 특성 설명 열기`);
    ok(await p.evaluate(() => document.activeElement?.matches('#s-char [data-talent="0:0"]')), `${width}: 설명을 열면 CTA로 키보드 포커스 이동`);
    await p.keyboard.press('Shift+Tab');
    const closeReachable = await p.evaluate(() => document.activeElement?.matches('#s-char .c7-tclose'));
    ok(closeReachable, `${width}: Shift+Tab으로 설명 닫기 접근 가능`);
    if (closeReachable) await p.keyboard.press('Space');
    ok(!(await p.isVisible('#s-char .c7-tsheet')) && await p.evaluate(() => document.activeElement?.matches('#s-char [data-tcell="0:0"]')), `${width}: Space로 설명 닫고 원래 노드 포커스 복원`);
    await p.locator('#s-char [data-tcell="0:0"]').focus(); await p.keyboard.press('Space');
    await p.keyboard.press('Escape');
    ok(!(await p.isVisible('#s-char .c7-tsheet')) && await p.evaluate(() => document.activeElement?.matches('#s-char [data-tcell="0:0"]')), `${width}: Escape로 닫고 원래 노드 포커스 복원`);
    await p.locator('#s-char [data-tcell="0:0"]').focus(); await p.keyboard.press('Enter');
    await p.locator('#s-char [data-talent="0:0"]').focus(); await p.keyboard.press('Enter');
    ok(await p.getAttribute('#s-char [data-tcell="0:0"]', 'aria-pressed') === 'true' && await p.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).heroes.priest.talents[0]) === 0, `${width}: 키보드 CTA 선택과 저장 일치`);
    ok(await p.evaluate(() => document.activeElement?.matches('#s-char [data-tcell="0:0"]')), `${width}: 선택 뒤 원래 노드 포커스 복원`);
    await p.locator('#s-char [data-preset="1"]').focus(); await p.keyboard.press('Enter');
    ok(await p.evaluate(() => document.activeElement?.matches('#s-char [data-preset="1"][aria-pressed="true"]')), `${width}: 프리셋 전환 뒤 선택한 프리셋 포커스 복원`);
    // 상단 컬러 탭과 장비 바로 아래 상시 인벤토리를 함께 캡처한다.
    await p.click('#s-char [data-csub="gear"]');
    await p.locator('#s-char .ns-body').evaluate(el => { el.scrollTop = 0; });
    await p.screenshot({ path: `${shots}/character_controls_${width}.png`, animations: 'disabled' });
    await mobile.close();
  }
  await browser.close();
  return { fails, errs };
}
