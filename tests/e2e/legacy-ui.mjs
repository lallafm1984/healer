// 임시 전투 화면(프로토타입 v11 UI) 확인: 편성 공략·카운트다운·길게 누르기 설명·정산·20인 판·왼손. prototype/tests/items.js에서 옮김 (소비 아이템은 2026-10-16 없앰)
import { chromium } from 'playwright';
import { departGo, entryGo, patchSave, toParty } from './nav.mjs';

export default async function legacyUi(url, shots) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await patchSave(page, { player: { level: 40 } });

  // ---- 편성 「공략」 시트 ----
  await toParty(page);
  ok(await page.locator('.mmobar, #ping, #brandImg, #shout, .chat').count() === 0, '서버 바·레퍼런스 그림·외침·채팅 없음');
  await page.click('#guideOpen'); await page.clock.runFor(50);
  const top = await ev(() => { const b = document.querySelector('#s-party .f-gsheet .guides'); return { n: b.querySelectorAll('.gpane').length, shown: b.querySelectorAll('.gpane:not([hidden])').length, tabs: document.querySelectorAll('#s-party .f-gsheet .f-route [role="tab"]').length, chat: b.querySelectorAll('.chat').length, first: b.querySelector('.gd > *').className, note: b.querySelectorAll('.gd-note').length }; });
  ok(top.n === 4 && top.shown === 1 && top.tabs === 4 && top.chat === 0 && top.first === 'gd-top' && top.note === 0, `구간마다 공략 (구간 탭 4, 보이는 판 1), 맨 위 = 이름, 채팅·평타 메모 없음 ${JSON.stringify(top)}`);
  ok(/녹슨 문지기/.test(await page.textContent('#s-party .f-gsheet .gpane:not([hidden])')) && await page.getAttribute('#s-party .f-gsheet [data-gseg="3"]', 'aria-selected') === 'true', '처음 보이는 공략 = 마지막 구간 녹슨 문지기');
  // Lim 2026-10-12 13:33: 난이도 수치 칸 · 위쪽 안내 글 · 대처 줄 · 아이템 힌트 빼고, 닫기는 나무결 없이 시트 색
  const trim = await ev(() => { const g = document.querySelector('#s-party .f-gsheet'), shut = g.querySelector('.f-sheet-actions > .f-shut'); return { stats: g.querySelectorAll('.f-dstats').length, ih: g.querySelectorAll('.f-ih').length, how: g.querySelectorAll('.gs-how').length, hint: g.querySelectorAll('.gd-h small').length, wood: /wood/.test(getComputedStyle(shut).backgroundImage) }; });
  ok(trim.stats === 0 && trim.ih === 0 && trim.how === 0 && trim.hint === 0 && !trim.wood, `공략 시트: 수치 칸 · 안내 글 · 대처 줄 · 힌트 없음, 닫기 나무결 없음 ${JSON.stringify(trim)}`);
  await page.screenshot({ path: `${shots}/v9_guide_top.png` });
  await page.click('#s-party .f-gsheet [data-shut]'); await page.clock.runFor(50);

  ok(await page.locator('#s-party .f-slots, #s-party .f-isheet').count() === 0, '편성에 소비 아이템 단축칸 없음 (2026-10-16)');

  // ---- 출발 → 카운트다운 ----
  await departGo(page); await page.clock.runFor(100);
  ok(await page.isVisible('#pull') && (await page.textContent('#pullNum')).trim() === '3', '3초 카운트다운 보임');
  ok(await page.locator('#pullChat').count() === 0 && /^3$/.test((await page.textContent('#pull')).replace(/\s/g, '')), '카운트다운은 숫자만');
  await page.screenshot({ path: `${shots}/v6_pull.png` });
  const bb = await page.locator('#board').boundingBox();
  const tk = await ev(() => { const F = window.__proto.F; const u = F.party.find(x => x.role === 'tank'); return window.__proto.center(u.cell); });
  await page.touchscreen.tap(bb.x + tk.x, bb.y + tk.y); await page.clock.runFor(1500);
  const mid = await ev(() => ({ t: window.__proto.F.t, cast: !!window.__proto.F.cast, taps: window.__proto.F.stats.taps }));
  ok(mid.t === 0 && !mid.cast && mid.taps === 0, `풀링 중엔 시간 멈춤·입력 안 받음 ${JSON.stringify(mid)}`);
  await page.clock.runFor(1700);
  const after = await ev(() => window.__proto.F.t);
  ok(await page.isHidden('#pull') && after > 0, `3초 뒤 전투 시작 (t=${after.toFixed(2)})`);

  // ---- 소비 아이템 단축칸 없음 (2026-10-16) ----
  ok(await page.locator('#healerImg').count() === 0, '하단 왼쪽 힐러 그림 없음');
  ok(await page.locator('#items, #battle .item[data-item]').count() === 0, '전투 하단에 소비 아이템 칸 없음');
  const inView = () => ev(() => { const r = document.querySelector('#tip').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });

  // 스킬 칸도 길게 누르면 설명 팝업, 화면 안, 시전 안 함
  const casts0 = await ev(() => JSON.stringify(window.__proto.F.stats.casts || {}));
  const slotSel = '#wheel .slot[data-slot]';
  await page.dispatchEvent(slotSel, 'pointerdown'); await page.clock.runFor(600);
  const sTip = await page.textContent('#tip');
  ok(await page.isVisible('#tip') && /회복|제거|보호|마나/.test(sTip) && /쿨|즉시|시전/.test(sTip), `스킬 길게 누르면 설명 팝업 (${sTip.replace(/\s+/g, ' ').slice(0, 40)})`);
  ok(await inView(), '스킬 설명이 화면 안');
  await page.screenshot({ path: `${shots}/v6_skill_tip.png` });
  await page.dispatchEvent(slotSel, 'pointerup'); await page.clock.runFor(60);
  ok(await ev(c => JSON.stringify(window.__proto.F.stats.casts || {}) === c && !window.__proto.F.queued, casts0), '길게 누르기는 시전 안 함');

  // 일시정지: 자리 비움
  await page.click('#pauseBtn'); await page.clock.runFor(100);
  ok(!/자리 비움|기다려/.test(await page.textContent('#pause')), '일시정지: 기다림 문구 없음');
  await page.click('#resumeBtn'); await page.clock.runFor(100);

  // 포기 → 정산 (파티 채팅 없음)
  await page.click('#pauseBtn'); await page.clock.runFor(100);
  ok(/포기/.test(await page.textContent('#quitBtn')), '일시정지 버튼 = 포기하고 나가기');
  await page.click('#quitBtn');
  await page.locator('#battleConfirm').waitFor({ state: 'visible' });
  ok(await page.isVisible('#battle') && await page.isHidden('#s-settle'), '포기는 확인창에서 확정 전까지 전투 유지');
  await page.click('#confirmApply'); await page.clock.runFor(200);
  ok(await page.isVisible('#s-settle') && (await page.textContent('#s-settle h1')) === '포기', '포기 → 정산');
  ok(await page.locator('#s-settle .chat, #s-settle .plines').count() === 0, '정산에 파티 채팅·한마디 없음');
  ok(!/소비 아이템/.test(await page.textContent('#s-settle details.r-rec')) && /보상 없음/.test(await page.textContent('#s-settle .r-why')), '포기: 「보상 없음」, 전투 기록에 소비 아이템 줄 없음');
  ok(/경험치/.test(await page.textContent('#s-settle')) === false, '포기하면 경험치 없음');
  await page.screenshot({ path: `${shots}/v6_result.png` });

  // ---- 20인 판 ----
  await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(100);
  await toParty(page, { content: 'cathedral1', tab: 'raid20', diff: '악몽' });
  ok(await page.locator('#s-content').getAttribute('data-selected-content') === 'cathedral1'
    && await page.locator('#s-content [data-ctab="raid20"]').getAttribute('aria-selected') === 'true'
    && await page.locator('#s-content .b-place-modal').count() === 0, '20인 장소 대성당 선택이 편성까지 유지·장소 팝업 없음');
  await page.click('#guideOpen'); await page.clock.runFor(50);
  ok(/20인/.test(await page.textContent('#s-party .f-gsheet .f-gh')) && /악몽 전용 기술/.test(await page.textContent('#s-party .f-gsheet .f-dnote')), '20인 악몽: 공략 시트에 인원 20, 악몽 안내');
  await page.click('#s-party .f-gsheet [data-shut]'); await page.clock.runFor(50);
  await page.click('#s-party .tb-back'); await page.clock.runFor(50);
  await page.click('#s-content [data-diff="보통"]'); await page.clock.runFor(50);
  await page.click('#contentGo'); await page.clock.runFor(100); await entryGo(page);
  await page.click('#guideOpen'); await page.clock.runFor(50);
  const ent = await page.textContent('#s-party .f-gsheet');
  ok(/20인/.test(ent) && /유령 성가대/.test(ent) && /노래/.test(ent), '20인 보통: 유령 성가대 공략');
  await page.click('#s-party .f-gsheet [data-shut]'); await page.clock.runFor(50);
  await departGo(page); await page.clock.runFor(3300);
  const b20 = await ev(() => ({ board: window.__proto.F.board, cells: window.__proto.F.cells.length }));
  ok(b20.board === 'b36' && b20.cells === 36, `20인 = 6열 × 6줄 b36 ${JSON.stringify(b20)}`);
  // 파티 요약 줄 「파티 20/20 · 모두 생존」은 뺐다 (2026-10-09 Lim). 판이 보스 무대 바로 아래에서 시작
  const top20 = await ev(() => ({ gone: !document.querySelector('#partyStatus,#partyAlive,#partyCondition'), stage: document.getElementById('stage').getBoundingClientRect().bottom, board: document.getElementById('boardWrap').getBoundingClientRect().top }));
  ok(top20.gone && Math.abs(top20.board - top20.stage) <= 1, `파티 요약 줄 없음, 판이 무대 바로 아래 ${JSON.stringify(top20)}`);
  await page.clock.runFor(60);
  await page.screenshot({ path: `${shots}/v6_raid20_items.png` });
  // 20인 탭 = 확대 미리보기 0.3초 (02 3-1). 판(PixiJS)이 그 순간에도 멀쩡히 그려지는지
  const bb20 = await page.locator('#board').boundingBox();
  const c20 = await ev(() => { const F = window.__proto.F, u = F.party.find(x => x.role === 'ranged' && x.alive); return window.__proto.center(u.cell); });
  await page.touchscreen.tap(bb20.x + c20.x, bb20.y + c20.y); await page.clock.runFor(120);
  await page.screenshot({ path: `${shots}/battle_raid20_lens.png` });
  ok(await ev(() => window.__proto.renderer === 'canvas'), '자동 테스트 판 = Canvas 렌더러');

  // 왼손 모드 (설정)
  await page.click('#pauseBtn'); await page.click('#quitBtn');
  await page.locator('#battleConfirm').waitFor({ state: 'visible' });
  await page.click('#confirmApply'); await page.clock.runFor(100);
  await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(100);
  await page.click('#s-lobby .tb-set'); await page.clock.runFor(100);
  await page.click('#s-settings [data-set="hand"][data-val="left"]'); await page.clock.runFor(50);
  ok(await ev(() => JSON.parse(localStorage.getItem('healer.save')).settings.hand) === 'left', '왼손 설정 저장');
  await page.click('#s-settings .tb-back'); await page.clock.runFor(100);
  await toParty(page);
  await departGo(page); await page.clock.runFor(3300);
  const lh = await ev(() => { const w = document.getElementById('wheel').getBoundingClientRect(), i = document.getElementById('side').getBoundingClientRect(); return { wheelX: w.x, itemsX: i.x }; });
  ok(lh.wheelX < lh.itemsX, `왼손 모드: 휠 왼쪽, 자원 · 특성 묶음 오른쪽 ${JSON.stringify(lh)}`);
  await page.screenshot({ path: `${shots}/v6_lefthand.png` });

  await browser.close();
  return { fails, errs };
}
