// 재화·임무·상점 (12, 13, 15, 81, 90, 09 S18·S22): 로비 임무 카드 → 임무 받기·교체·완료 상자 → 상점 상품 → 입장 확인 (휴식). 시즌 패스 · 공훈은 2026-10-20 없앰
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
  // 새 저장은 Lv 1에 일일 임무 4개 (Lv 1~4, 103 QA)를 뽑아 둠 → 날 · 주를 비워 Lv 40으로 다시 뽑음 (5개 · 주간 3개)
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 40; s.player.gold = 2000; s.daily.day = ''; s.weekly.week = ''; localStorage.setItem('healer.save', JSON.stringify(s)); });

  // ---- 로비 → 임무 ----
  // 오른쪽 팻말 = 상점 · 행상인 (2026-10-21 Lim 「레이드, 대장간 제거, 잡화점은 상점으로」). 휴식은 입장 비용이 아니라 적지 않는다 (90)
  const shopLabel = await page.locator('#s-lobby .lb-shop').innerText();
  ok(/일일 0\/5/.test(await text('#s-lobby .lb-missions')) && shopLabel.trim() === '상점'
    && await page.locator('#s-lobby .lb-raid, #s-lobby .lb-forge').count() === 0, '로비 이름표: 임무 일일 0/5 · 상점 팻말은 이름만 (광고 제거 · 새 직업 줄 · 레이드 · 대장간 팻말 없음)');
  await page.click('#s-lobby .lb-missions .lb-main'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-missions') && (await page.locator('#s-missions .mlist').first().locator('.mrow').count()) === 5, '임무 화면: 일일 5개');
  ok((await page.locator('#s-missions .mlist').nth(1).locator('.mrow').count()) === 3, 'Lv 40 = 주간 임무 3개');
  ok((await page.locator('#s-missions [data-swap], #s-missions .g-info, #s-missions .m-left').count()) === 0, '임무: 교체 버튼 · ⓘ · 「새 임무」 알약 없음 (2026-10-24 Lim)');
  let sv;
  // 임무를 다 채운 상태로 만들고 받기
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.daily.missions.forEach(m => { m.n = 99; }); s.weekly.missions[0].n = 99; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  ok(await page.locator('#s-lobby .lb-missions .g-qm, #lbClaim').count() === 0 && (await text('#s-lobby .lb-missions .g-badge')) === '6', '로비 게시판: 받을 것 있음 = 빨간 숫자 6 (노란 「!」 없음, 2026-10-24 Lim)');
  await page.click('#s-lobby .lb-missions .lb-main'); await page.clock.runFor(100);
  ok((await page.locator('#s-missions [data-claim]').count()) === 6, '받을 임무 6개 (일일 5 + 주간 1)');
  const d0 = (await save()).player.gold;
  for (let i = 0; i < 5; i++) { await page.click('#s-missions [data-claim="daily"]'); await page.clock.runFor(30); }
  sv = await save();
  ok(sv.daily.missions.every(m => m.got) && sv.player.gold === d0 + 5 * 173 && !('mats' in sv) && !('pass' in sv), `일일 5개 받기: 골드 +${sv.player.gold - d0} (Lv 40 클리어 골드 495의 35% × 5, 2026-10-22 B안), 패스 없음`);
  await page.click('#s-missions #chest'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.daily.chest && !(await page.locator('#s-missions .warnbox').count()) && !/패스/.test(await text('#s-missions')), '완료 상자 열기: 띠 없음 (받은 것은 보상 창, 화면 검사에서는 끔) · 패스 글 없음');
  await page.click('#s-missions #chest2'); await page.clock.runFor(50);
  ok(await page.isVisible('.admodal') && /광고 자리/.test(await text('.admodal')), '광고 보고 한 번 더 = 광고 자리 창');
  await page.click('.admodal [data-ad="ok"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.daily.chest2 && sv.daily.ads.chest === 1, '광고 끝 → 한 번 더 받음');
  const w0 = await save();
  await page.click('#mission-tab-weekly'); await page.clock.runFor(50);
  await page.click('#s-missions [data-claim="weekly"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === w0.player.gold + 866 && !('wallet' in sv), '주간 임무 = 클리어 골드 1.75판 (495 × 1.75, 2026-10-22 B안, 악몽 열쇠 · 공훈 없음)');
  await page.screenshot({ path: `${shots}/shop_missions.png`, fullPage: true });

  // ---- 상점: 골드 탭 (소비 아이템)은 2026-10-16 없앰. 첫 탭 = 상품 ----
  // 상점은 하단 탭이 아니라 로비 「잡화점」에서 (2026-10-18 Lim), 뒤로 = 로비
  await page.click('#s-missions .tb-back'); await page.clock.runFor(50);
  ok(await page.locator('#tabs [data-tab="shop"]').count() === 0, '하단 탭에 상점 없음');
  await page.click('#s-lobby .lb-shop'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-shop .tb-back') && await page.isHidden('#tabs'), '잡화점 → 상점 (탭 막대 없이 ← 상점)');
  ok(await page.isVisible('#s-shop [data-prod="noads"]') && (await page.locator('#s-shop .subtabs, #s-shop [data-sub], #s-shop [data-buy], #s-shop [data-ex], #s-shop [data-pass], #s-shop .shop-wallet').count()) === 0
    && !/악몽 열쇠|소비 아이템|공훈|시즌 패스/.test(await text('#s-shop')), '상점 = 상품 한 쪽 (하위 탭 · 골드 탭 · 소비 아이템 · 공훈 · 시즌 패스 없음, 2026-10-20)');
  await page.screenshot({ path: `${shots}/shop_first.png` });

  // ---- 상품 (81): 광고 제거 패키지 5,500원 · 직업 4종 2,200원 (개발 빌드는 누르면 바로) ----
  ok(/5,500원/.test(await text('#s-shop [data-prod="noads"]')) && (await page.locator('#s-shop [data-prod^="job_"]').count()) === 4
    && (await page.locator('#s-shop [data-prod^="job_"] .cash-buy').allInnerTexts()).every(t => /2,200원/.test(t))
    && (await page.locator('#s-shop [data-prod^="job_"] .cash-gold').allInnerTexts()).filter(t => /50,000/.test(t)).length === 4, '상품: 광고 제거 5,500원 · 직업 4종 2,200원 또는 골드 50,000');
  await page.click('#s-shop [data-iap="noads"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.bought.includes('noads') && await page.evaluate(() => document.body.classList.contains('noads')) && /\/150/.test(await text('#s-shop .cash-meter')), '광고 제거: 배너 숨김 · 휴식 최대 150');
  await page.click('#s-shop [data-iap="job_monk"]'); await page.clock.runFor(50);
  ok((await save()).bought.includes('job_monk') && /보유/.test(await text('#s-shop [data-prod="job_monk"]')) && (await page.locator('#s-shop [data-prod="job_monk"] .cash-gold').count()) === 0, '직업 구매: 수도사 보유 (골드 버튼도 사라짐)');
  await page.screenshot({ path: `${shots}/shop_cash.png` });
  // ---- 직업 골드 구매 (2026-10-28 Lim 「레벨 제한없이 5만 및 2200원으로 하자」): 모자라면 안내만, 있으면 확인 창 → 보유 · 골드 −50,000 ----
  const goldTo = async n => {
    await page.evaluate(n => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.gold = n; localStorage.setItem('healer.save', JSON.stringify(s)); }, n);
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await page.click('#s-lobby .lb-shop'); await page.clock.runFor(100);
  };
  await goldTo(30000);
  await page.click('#s-shop [data-gold-job="job_shaman"]'); await page.clock.runFor(50);
  ok(/골드가 모자랍니다/.test(await text('#s-shop .warnbox')) && !(await page.isVisible('.admodal.ask')) && !(await save()).bought.includes('job_shaman'), '골드 모자람: 확인 창 없이 안내 · 안 삼');
  await goldTo(80000);
  await page.click('#s-shop [data-gold-job="job_shaman"]'); await page.clock.runFor(50);
  ok(await page.isVisible('.admodal.ask') && /주술사 해금/.test(await text('.admodal.ask')) && /50,000/.test(await text('.admodal.ask')), '골드 버튼 = 확인 창 (주술사 해금 · 골드 50,000)');
  await page.screenshot({ path: `${shots}/shop_job_gold_confirm.png` });
  await page.click('.admodal.ask [data-ask="ok"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.bought.includes('job_shaman') && sv.player.gold === 30000 && /보유/.test(await text('#s-shop [data-prod="job_shaman"]')), `골드로 사기: 주술사 보유 · 골드 80,000 → ${sv.player.gold}`);
  await page.screenshot({ path: `${shots}/shop_job_gold.png` });

  // ---- 출전 (90 · 2026-10-17 Lim 「출전전 휴식 팝업은 제거」): 입장 확인 팝업 없이 바로 편성 → 출발 = 바로 전투.
  // 전투 전에는 휴식 표시 없음 (출전 · 출발 버튼에 휴식 숫자 없음), 휴식은 클리어할 때 씀. 충전은 위 휴식 칸 · 로비 소켓 · 상점 ----
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
  ok(!/휴식|10/.test(await text('#contentGo')) && (await page.locator('#contentGo .currency-icon').count()) === 0, '출전 버튼: 휴식 숫자 없음');
  await page.click('#contentGo'); await page.clock.runFor(100);
  ok(!(await page.isVisible('.st-modal')) && await page.isVisible('#s-party') && (await save()).stamina.n === 12, '출전 = 입장 확인 팝업 없이 바로 편성 (휴식 그대로 12)');
  ok(!/10/.test(await text('#depart')) && (await page.locator('#depart .currency-icon').count()) === 0, '편성 출발 버튼: 휴식 숫자 없음');
  await page.click('#depart'); await page.clock.runFor(3100 + 300);
  ok(await page.isVisible('#battle') && !(await page.isVisible('.st-modal')) && (await save()).stamina.n === 12, '편성 출발 = 팝업 없이 바로 전투 (휴식은 클리어할 때)');
  await toGate(0);
  await page.click('#contentGo'); await page.clock.runFor(100);
  ok(!(await page.isVisible('.st-modal')) && await page.isVisible('#s-party'), '휴식 0이어도 출전 = 바로 편성');
  // 휴식 충전은 위 휴식 칸의 휴식 창에서 (광고 제거 패키지 = 광고 없이 바로)
  await page.click('#s-party .tb-back'); await page.clock.runFor(100);
  await page.click('#s-content [data-stamina-open]'); await page.clock.runFor(50);
  ok(await page.isVisible('.st-modal .st-info') && /모자라면 있는 만큼 쓰고 보너스도 그만큼/.test(await text('.st-modal .note')) && !/1\/3|줄어|감소/.test(await text('.st-modal')), '휴식 창: 휴식 보너스 · 비례 안내 (깎임 말 없음)');
  await page.screenshot({ path: `${shots}/shop_rest_window.png` });
  await page.click('.st-modal [data-st="ad"]'); await page.clock.runFor(50);
  sv = await save();
  ok(!(await page.isVisible('.admodal [data-ad]')) && sv.stamina.n === 30 && sv.stamina.ads === 1, '광고 충전: 0 → 30, 오늘 1번 (광고 제거 패키지 = 광고 없이 바로)');
  await page.click('.st-modal [data-st="no"]'); await page.clock.runFor(50);
  await page.click('#contentGo'); await page.clock.runFor(100);
  ok(!(await page.isVisible('.st-modal')) && await page.isVisible('#s-party') && (await save()).stamina.n === 30, '충전 뒤 다시 출전 = 바로 편성, 휴식 그대로 30');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
