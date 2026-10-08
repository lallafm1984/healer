// 사제 특성 (06 6장, 27 4-5): 칸 → 아래 시트에서 고르기·풀기·저장, 프리셋 1·2·3, 전투 보조 버튼 (정점 바로 / 쉼터 장전 → 빈 칸)
import { chromium } from 'playwright';
import { pastTitle, patchSave, toParty } from './nav.mjs';

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
  ok((await page.locator('#s-char .c7-tpath path.d').count()) === 1 && (await page.locator('#s-char .c7-tpath path.s').count()) === 0, '고른 메달에서 다음 고를 단 메달로 점선 (고른 길 SVG)');
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
  await page.screenshot({ path: `${shots}/talent_pick.png` });
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
  await page.click('#depart'); await page.clock.runFor(3100 + 1000);
  ok(await page.evaluate(() => { const on = window.__proto.F.tx.on; return on.shelter && on.zenith && Object.keys(on).length === 2; }), '전투 = 고른 특성 2개만 켜짐');
  ok(await page.isVisible('#aux') && (await page.locator('#aux .aux').count()) === 2, '단축칸 위 보조 버튼 2개');
  await page.dispatchEvent('#aux [data-tal="zenith"]', 'pointerdown'); await page.dispatchEvent('#aux [data-tal="zenith"]', 'pointerup'); await page.clock.runFor(100);
  ok(await page.evaluate(() => window.__proto.F.tx.act.zenith.left > 0) && await page.isVisible('#aux .aux.on[data-tal="zenith"]'), '정점 = 바로 켜짐');
  await page.dispatchEvent('#aux [data-tal="shelter"]', 'pointerdown'); await page.dispatchEvent('#aux [data-tal="shelter"]', 'pointerup'); await page.clock.runFor(50);
  ok(await page.isVisible('#aux .aux.armed[data-tal="shelter"]') && /빈 칸 선택/.test(await text('#toast')), '쉼터 = 장전, 빈 칸 안내');
  const empty = await page.evaluate(() => window.__proto.F.cells.findIndex(c => !c.unit));
  await tapCell(empty);
  ok(await page.evaluate(i => window.__proto.F.tx.shelter === i, empty) && !(await page.isVisible('#aux .aux.armed')), '빈 칸 탭 = 그 칸이 쉼터');
  await page.screenshot({ path: `${shots}/talent_battle.png` });

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
