// 재화·임무·상점 (12, 13, 15, 09 S18·S19·S22): 로비 임무 카드 → 임무 받기·교체·완료 상자 → 상점 골드·공훈·패스·크리스탈 → 악몽 종 조각
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function shop(url, shots) {
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
  const patch = async fn => { await page.evaluate(fn); await page.reload(); await page.clock.runFor(300); await pastTitle(page); };
  await page.clock.install({ time: new Date(2026, 9, 7, 12) });
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 40; s.player.gold = 50000; s.mats.stone = 20; localStorage.setItem('healer.save', JSON.stringify(s)); });

  // ---- 로비 → 임무 ----
  ok(/일일 0\/5/.test(await text('#s-lobby .lb-missions')) && /10인 레이드 · 조각 0\/5/.test(await text('#s-lobby .lb-raid')), '로비 이름표: 임무 일일 0/5 · 종탑 = 10인 레이드 종 조각 수량');
  await page.click('#s-lobby .lb-missions .lb-rmain'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-missions') && (await page.locator('#s-missions .mlist').first().locator('.mrow').count()) === 5, '임무 화면: 일일 5개');
  ok((await page.locator('#s-missions .mlist').nth(1).locator('.mrow').count()) === 3, 'Lv 40 = 주간 임무 3개');
  const keys0 = (await save()).daily.missions.map(m => m.key).join();
  await page.click('#s-missions [data-swap="0"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.daily.swapped && sv.daily.missions.map(m => m.key).join() !== keys0 && (await page.locator('#s-missions [data-swap]').count()) === 0, '하루 1번 무료 교체');
  // 임무를 다 채운 상태로 만들고 받기
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.daily.missions.forEach(m => { m.n = 99; }); s.weekly.missions[0].n = 99; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  ok(await page.isVisible('#s-lobby .lb-missions .g-qm') && await page.isVisible('#lbClaim') && (await text('#s-lobby .lb-missions .g-badge')) === '6', '로비 게시판: 받을 것 있음 = 노란 「!」 + 빨간 숫자 6');
  await page.click('#s-lobby .lb-missions .lb-rmain'); await page.clock.runFor(100);
  ok((await page.locator('#s-missions [data-claim]').count()) === 6, '받을 임무 6개 (일일 5 + 주간 1)');
  const g0 = (await save()).player.gold;
  for (let i = 0; i < 5; i++) { await page.click('#s-missions [data-claim="daily"]'); await page.clock.runFor(30); }
  sv = await save();
  ok(sv.daily.missions.every(m => m.got) && sv.player.gold > g0 && sv.pass.xp === 300, `일일 5개 받기: 골드 +${sv.player.gold - g0}, 패스 경험치 300`);
  await page.click('#s-missions #chest'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.daily.chest && sv.pass.xp === 400 && /완료 상자/.test(await text('#s-missions .warnbox')), '완료 상자 열기 (패스 +100)');
  await page.click('#s-missions #chest2'); await page.clock.runFor(50);
  ok(await page.isVisible('.admodal') && /광고 자리/.test(await text('.admodal')), '광고 보고 한 번 더 = 광고 자리 창');
  await page.click('.admodal [data-ad="ok"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.daily.chest2 && sv.daily.ads.chest === 1, '광고 끝 → 한 번 더 받음');
  await page.click('#s-missions [data-claim="weekly"]'); await page.clock.runFor(50);
  ok((await save()).wallet.shards === 1, '주간 임무 = 종 조각 1');
  await page.screenshot({ path: `${shots}/shop_missions.png`, fullPage: true });

  // ---- 상점: 골드 ----
  await page.click('#s-missions .tb-back'); await page.clock.runFor(50);
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-shop') && (await page.locator('#s-shop .srow').count()) >= 7, '상점 탭: 소비 아이템 6 + 종 조각 제작');
  const b0 = await save();
  await page.click('#s-shop [data-buy="mana"][data-n="1"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.bag.mana === b0.bag.mana + 1 && sv.player.gold === b0.player.gold - (100 + 5 * 40), '마나 물약 1개 = 100 + 5 × Lv');
  ok(await page.locator('#s-shop [data-buy="feather"]').count() === 0, '부활 깃털은 안 팖');
  await page.click('#s-shop #craft'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.wallet.shards === 2 && sv.weekly.craft === 1 && sv.mats.stone === b0.mats.stone - 5, '종 조각 제작 (골드 1,000 + 강화석 5)');
  await page.screenshot({ path: `${shots}/shop_gold.png` });

  // ---- 공훈 ----
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.wallet.merit = 120; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  await page.click('#s-shop [data-sub="merit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-shop .mgear [data-ex]').count()) === 6 && !/세트/.test(await text('#s-shop')), '공훈 = 영웅 장비 6부위 (세트 없음)');
  await page.click('#s-shop [data-ex="ring"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.wallet.merit === 20 && sv.gear.bag.some(i => i.slot === 'ring' && i.grade === '영웅' && i.name === '성스러운 반지' && !('set' in i)), '공훈 100 → 성스러운 반지 (영웅)');

  // ---- 시즌 패스 ----
  await page.click('#s-shop [data-sub="pass"]'); await page.clock.runFor(50);
  ok(/패스 Lv 1\/50/.test(await text('#s-shop .passhead')) && (await page.locator('#s-shop .prow').count()) === 51, '패스 50단계 (일일 300 + 상자 100 + 주간 800 = Lv 1)');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.pass.xp = 2100; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  await page.click('#s-shop [data-sub="pass"]'); await page.clock.runFor(50);
  const st0 = (await save()).mats.stone;
  await page.click('#s-shop [data-pass="1"][data-line="free"]'); await page.clock.runFor(50);
  ok((await save()).mats.stone === st0 + 5 && (await page.locator('#s-shop [data-pass="3"]').count()) === 0, '패스 Lv 1 무료 = 강화석 5, 안 오른 단계는 못 받음');
  await page.screenshot({ path: `${shots}/shop_pass.png` });

  // ---- 크리스탈 (개발 빌드 시험 구매) · 월정액 ----
  await page.click('#s-shop [data-sub="crystal"]'); await page.clock.runFor(50);
  await page.click('#s-shop [data-iap="c100"]'); await page.clock.runFor(50);
  ok((await save()).wallet.crystal === 200 && /첫 구매 2배/.test(await text('#s-shop .warnbox')), '시험 구매: 한 줌 100 + 첫 구매 100');
  await page.click('#s-shop [data-iap="member30"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.wallet.crystal === 500 && sv.member > Date.now() && await page.evaluate(() => document.body.classList.contains('member')), '월정액: 💎 300 · 배너 숨김');
  await page.screenshot({ path: `${shots}/shop_crystal.png` });

  // ---- 악몽 입장 = 종 조각 1개 ----
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.wallet.shards = 0; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await toParty(page, { diff: '악몽' });
  ok(await page.getAttribute('#depart', 'aria-disabled') === 'true' && /종 조각 없음/.test(await text('#depart')) && !(await page.isVisible('#s-party .f-warn.ticket')), '악몽 편성: 종 조각이 없으면 출발이 흐려짐 (경고 줄은 아직 없음)');
  await page.click('#depart', { force: true }); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party') && /종 조각이 없음/.test(await text('#s-party .f-warn.ticket')) && (await save()).wallet.shards === 0, '악몽 출발을 누르면 전투 대신 아래에 얻는 곳 + 상점');
  await page.click('#s-party .f-warn.ticket [data-go="s-shop"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-shop') && /종 조각 제작/.test(await text('#s-shop')), '「상점」 = 종 조각 제작이 있는 골드 상점');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.wallet.shards = 2; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await toParty(page, { diff: '악몽' });
  ok(/종 조각 1개 씀 · 2\/5/.test(await text('#depart')), '악몽 출발 버튼: 종 조각 1개 씀 · 2/5');
  await page.click('#depart'); await page.clock.runFor(3100 + 300);
  ok(await page.isVisible('#battle') && (await save()).wallet.shards === 1, '출발 = 종 조각 2 → 1');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
