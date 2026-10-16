// 재화·임무·상점 (12, 13, 15, 81, 90, 09 S18·S19·S22): 로비 임무 카드 → 임무 받기·교체·완료 상자 → 상점 상품·공훈·패스 → 입장 확인 (휴식)
import { chromium } from 'playwright';
import { chooseContent, openDiff, pastTitle } from './nav.mjs';

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
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 40; s.player.gold = 2000; localStorage.setItem('healer.save', JSON.stringify(s)); });

  // ---- 로비 → 임무 ----
  // 레이드 팻말 (예전 첨탑): 분류 + 열림 레벨. 휴식은 입장 비용이 아니라 적지 않는다 (90, 2026-10-16 A안)
  const raidLabel = await page.locator('#s-lobby .lb-raid').innerText();
  ok(/일일 0\/5/.test(await text('#s-lobby .lb-missions')) && /레이드/.test(raidLabel)
    && /10인 레이드/.test(raidLabel) && /Lv 45에 열림/.test(raidLabel) && !/휴식/.test(raidLabel), '로비 이름표: 임무 일일 0/5 · 레이드 = 10인 레이드 Lv 45에 열림');
  await page.click('#s-lobby .lb-missions .lb-main'); await page.clock.runFor(100);
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
  await page.click('#s-lobby .lb-missions .lb-main'); await page.clock.runFor(100);
  ok((await page.locator('#s-missions [data-claim]').count()) === 6, '받을 임무 6개 (일일 5 + 주간 1)');
  const d0 = (await save()).player.gold;
  for (let i = 0; i < 5; i++) { await page.click('#s-missions [data-claim="daily"]'); await page.clock.runFor(30); }
  sv = await save();
  ok(sv.daily.missions.every(m => m.got) && sv.player.gold === d0 + 5 * 99 && !('mats' in sv) && sv.pass.xp === 300, `일일 5개 받기: 골드 +${sv.player.gold - d0} (Lv 40 클리어 골드 495의 20% × 5), 패스 경험치 300 (91)`);
  await page.click('#s-missions #chest'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.daily.chest && sv.pass.xp === 400 && /완료 상자/.test(await text('#s-missions .warnbox')), '완료 상자 열기 (패스 +100)');
  await page.click('#s-missions #chest2'); await page.clock.runFor(50);
  ok(await page.isVisible('.admodal') && /광고 자리/.test(await text('.admodal')), '광고 보고 한 번 더 = 광고 자리 창');
  await page.click('.admodal [data-ad="ok"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.daily.chest2 && sv.daily.ads.chest === 1, '광고 끝 → 한 번 더 받음');
  const w0 = await save();
  await page.click('#s-missions [data-claim="weekly"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === w0.player.gold + 495 * 3 && !('shards' in sv.wallet), '주간 임무 = 클리어 골드 3판 (91, 악몽 열쇠 없음)');
  await page.screenshot({ path: `${shots}/shop_missions.png`, fullPage: true });

  // ---- 상점: 골드 탭 (소비 아이템)은 2026-10-16 없앰. 첫 탭 = 상품 ----
  await page.click('#s-missions .tb-back'); await page.clock.runFor(50);
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-shop') && await page.getAttribute('#s-shop [data-sub="cash"]', 'aria-selected') === 'true'
    && (await page.locator('#s-shop [data-sub="gold"], #s-shop [data-buy]').count()) === 0 && !/악몽 열쇠|소비 아이템/.test(await text('#s-shop')), '상점 탭: 상품이 첫 탭, 골드 탭 · 소비 아이템 없음');
  await page.screenshot({ path: `${shots}/shop_first.png` });

  // ---- 공훈 ----
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.wallet.merit = 120; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  await page.click('#s-shop [data-sub="merit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-shop .mgear [data-ex]').count()) === 6 && !/세트/.test(await text('#s-shop')), '공훈 = 영웅 장비 6부위 (세트 없음)');
  await page.click('#s-shop [data-ex="ring"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.wallet.merit === 20 && sv.gear.bag.some(i => i.slot === 'ring' && i.grade === '영웅' && /^성스러운 (반지|인장 반지|옥 반지|쌍가락지|돌 반지)$/.test(i.name) && !('set' in i)), '공훈 100 → 성스러운 반지 5종 중 하나 (영웅, 종류는 무작위)');

  // ---- 시즌 패스 ----
  await page.click('#s-shop [data-sub="pass"]'); await page.clock.runFor(50);
  ok(/패스 Lv 1\/50/.test(await text('#s-shop .passhead')) && (await page.locator('#s-shop .prow').count()) === 51, '패스 50단계 (일일 300 + 상자 100 + 주간 800 = Lv 1)');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.pass.xp = 2100; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  await page.click('#s-shop [data-sub="pass"]'); await page.clock.runFor(50);
  const st0 = (await save()).player.gold;
  await page.click('#s-shop [data-pass="1"]'); await page.clock.runFor(50);
  ok((await save()).player.gold === st0 + 500 && (await page.locator('#s-shop [data-pass="3"]').count()) === 0 && !/프리미엄/.test(await text('#s-shop')), '패스 Lv 1 = 골드 500 (예전 강화석 5), 안 오른 단계는 못 받음, 프리미엄 없음');
  await page.screenshot({ path: `${shots}/shop_pass.png` });

  // ---- 상품 (81): 광고 제거 패키지 5,500원 · 직업 4종 2,200원 (개발 빌드는 누르면 바로) ----
  await page.click('#s-shop [data-sub="cash"]'); await page.clock.runFor(50);
  ok(/5,500원/.test(await text('#s-shop [data-prod="noads"]')) && (await page.locator('#s-shop [data-prod^="job_"]').count()) === 4
    && (await page.locator('#s-shop [data-prod^="job_"] .cash-buy').allInnerTexts()).every(t => /2,200원/.test(t)), '상품: 광고 제거 5,500원 · 직업 4종 2,200원');
  await page.click('#s-shop [data-iap="noads"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.bought.includes('noads') && await page.evaluate(() => document.body.classList.contains('noads')) && /\/150/.test(await text('#s-shop .tb-st')), '광고 제거: 배너 숨김 · 휴식 최대 150');
  await page.click('#s-shop [data-iap="job_monk"]'); await page.clock.runFor(50);
  ok((await save()).bought.includes('job_monk') && /보유/.test(await text('#s-shop [data-prod="job_monk"]')), '직업 구매: 수도사 보유');
  await page.screenshot({ path: `${shots}/shop_cash.png` });

  // ---- 입장 확인 (81 · 90): 「출전」 다음 팝업 (파티원 보기 전), 언제나 「입장」, 휴식은 입장 때 안 씀 (클리어 때). 0이면 「보상 1/3」 + 광고 충전 ----
  const toGate = async n => {
    await page.evaluate(n => { const s = JSON.parse(localStorage.getItem('healer.save')); s.stamina = { n, at: Date.now(), day: '', ads: 0 }; localStorage.setItem('healer.save', JSON.stringify(s)); }, n);
    await page.reload(); await page.clock.runFor(300);
    await openDiff(page, 'rustfort', '어려움'); await pastTitle(page);
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
    await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
    await chooseContent(page, 'rustfort');
    await page.click('#s-content [data-diff="어려움"]'); await page.clock.runFor(50);
  };
  await toGate(12);
  ok(/10/.test(await text('#contentGo')), '출전 버튼: 휴식 10');
  await page.click('#contentGo'); await page.clock.runFor(50);
  ok(await page.isVisible('.st-modal .st-entry:not(.cut)') && /입장/.test(await text('.st-modal h3')) && await page.isVisible('#s-content') && !(await page.isVisible('#s-party'))
    && !(await page.isVisible('.st-modal .st-cut')), '출전 = 입장 확인 팝업 (편성 · 파티원 전, 휴식 있으면 「보상 1/3」 없음)');
  await page.click('.st-modal [data-st="go"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party') && (await save()).stamina.n === 12 && !/10/.test(await text('#depart')), '입장 = 휴식 그대로 12 (클리어 때 씀) · 편성 (출발 버튼엔 비용 없음)');
  await page.click('#depart'); await page.clock.runFor(3100 + 300);
  ok(await page.isVisible('#battle') && !(await page.isVisible('.st-modal')) && (await save()).stamina.n === 12, '편성 출발 = 팝업 없이 바로 전투');
  await toGate(0);
  await page.click('#contentGo'); await page.clock.runFor(50);
  ok(await page.isVisible('.st-modal .st-entry.cut') && /입장/.test(await text('.st-modal h3')) && /보상 1\/3/.test(await text('.st-modal .st-cut'))
    && await page.locator('.st-modal [data-st="go"]').count() === 1 && await page.locator('.st-modal [data-st="ad"]').count() === 1, '휴식 0 = 그래도 「입장」 · 「보상 1/3」 · 광고 충전');
  await page.screenshot({ path: `${shots}/shop_entry_cut.png` });
  await page.click('.st-modal [data-st="ad"]'); await page.clock.runFor(50);
  ok(!(await page.isVisible('.admodal [data-ad]')) && await page.isVisible('.st-modal .st-entry:not(.cut)'), '광고 제거 패키지 = 광고 없이 바로 +30 → 「보상 1/3」 사라짐');
  sv = await save();
  ok(sv.stamina.n === 30 && sv.stamina.ads === 1, '광고 충전: 0 → 30, 오늘 1번');
  await page.screenshot({ path: `${shots}/shop_entry.png` });
  await page.click('.st-modal [data-st="go"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party') && (await save()).stamina.n === 30, '입장 = 휴식 그대로 30 · 편성');
  await page.click('#s-party .tb-back'); await page.clock.runFor(100);
  await page.click('#contentGo'); await page.clock.runFor(50);
  ok(await page.isVisible('.st-modal [data-st="go"]'), '편성에서 나갔다 다시 출전 = 입장 확인 다시');
  await page.click('.st-modal [data-st="go"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party') && (await save()).stamina.n === 30, '다시 출전해도 휴식 그대로');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
