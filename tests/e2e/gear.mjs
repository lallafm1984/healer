// 장비 (09 S10·S11): 세트 진행, 상세·강화, 분해 선택 (두 번 눌러 분해)
import { chromium } from 'playwright';
import { pastTitle } from './nav.mjs';

export default async function gear(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  const text = sel => page.textContent(sel);
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    const it = (id, slot, grade, set, plus = 0) => ({ id, slot, grade, plus, name: set ? `새벽 순례자의 ${slot}` : `${grade} ${slot}`, ...(set ? { set: 'dawn' } : {}) });
    s.player.level = 30; s.player.gold = 1000; s.mats = { stone: 3, refined: 0 };
    s.gear.equipped = { head: it(101, 'head', '희귀', true), chest: it(102, 'chest', '희귀', true), weapon: it(103, 'weapon', '고급', false) };
    s.gear.bag = [it(201, 'hands', '일반', false), it(202, 'ring', '고급', false), it(203, 'neck', '희귀', true)];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(/새벽 순례자 2\/4/.test(await text('#s-char .gset')) && (await page.locator('#s-char .gset p.on').count()) === 1, '세트 진행 2/4, 2세트 효과 켜짐');
  ok(/강화석 3/.test(await text('#s-char .gmats')), '재료 표시');

  // ---- 상세·강화 ----
  await page.click('#s-char .gtile[data-gitem="101"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .gdetail') && /강화 \+1/.test(await text('#s-char .gdetail')) && /골드 40/.test(await text('#s-char .gdetail')), '착용 장비 누르면 상세 + 강화 비용');
  await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.gear.equipped.head.plus === 1 && sv.player.gold === 960 && sv.mats.stone === 2, '강화 +1: 골드 40·강화석 1 씀');
  await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.equipped.head.plus === 2 && sv.player.gold === 800 && await page.isDisabled('#s-char [data-enh="101"]'), '+2 (골드 160·강화석 2), 강화석이 모자라면 버튼 꺼짐');
  await page.locator('#s-char .gdetail').screenshot({ path: `${shots}/gear_detail.png` });

  // ---- 분해 ----
  await page.click('#s-char [data-salvon]'); await page.clock.runFor(50);
  await page.click('#s-char [data-salvall]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .bag li.on').count()) === 2, '「일반·고급 모두」 = 2개 고름');
  await page.click('#s-char .bag li[data-gitem="203"]'); await page.clock.runFor(50);
  await page.click('#s-char .bag li[data-gitem="203"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .bag li.on').count()) === 2, '눌러서 고르기·풀기');
  await page.click('#s-char [data-salvgo]'); await page.clock.runFor(50);
  ok(/한 번 더/.test(await text('#s-char [data-salvgo]')) && (await save()).gear.bag.length === 3, '첫 누름 = 확인만');
  await page.locator('#s-char .bag').screenshot({ path: `${shots}/gear_salvage.png` });
  await page.click('#s-char [data-salvgo]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 1 && sv.gear.bag[0].id === 203 && sv.player.gold === 800 + 40 && sv.mats.stone === 0 + 3, `두 번째 = 분해: 골드 +40, 강화석 +3 (${sv.player.gold}, ${sv.mats.stone})`);
  ok(/2개 분해/.test(await text('#s-char')), '분해 결과 안내');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
