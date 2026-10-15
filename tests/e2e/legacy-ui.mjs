// 임시 전투 화면(프로토타입 v11 UI) 확인: 편성의 단축칸 고르기·공략·카운트다운·아이템·정산·20인 판·왼손. prototype/tests/items.js에서 옮김
import { chromium } from 'playwright';
import { departGo, entryGo, patchSave, pickedItems, toParty } from './nav.mjs';

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
  // 이전 네 칸 저장에서도 활성 두 칸만 표시하고 나머지는 보존한다.
  await patchSave(page, { player: { level: 40 }, items: ['mana', 'life', 'cleanse', 'feather'] });

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

  // ---- 편성: 소비 아이템 ----
  const chips = await ev(() => [...document.querySelectorAll('#s-party .f-slots .f-item')].map(b => [b.dataset.slot, b.dataset.slotItem, b.disabled]));
  ok(chips.length === 2 && chips.map(c => c[1]).join() === 'mana,life', `두 단축칸에 저장된 순서대로 아이템 표시 ${JSON.stringify(chips)}`);
  ok(chips.every(c => !c[2]) && await page.locator('#s-party .f-slots').getAttribute('aria-label') === '소비 아이템 단축칸 2칸', 'Lv 40에도 두 칸 유지');
  // 정확한 2번 칸을 고른다. 전체 선택 개수가 아니라 해당 칸만 교체한다.
  await page.click('#s-party [data-slots="1"]'); await page.clock.runFor(50);
  await page.click('#s-party .f-isheet [data-item="medit"]'); await page.clock.runFor(50);
  ok(await pickedItems(page) === 'mana,medit' && await page.isVisible('#s-party .f-isheet[data-edit-slot="1"]'), '2번 칸만 명상으로 교체하고 시트에서 선택 결과 확인');
  await page.click('#s-party .f-isheet [data-item="shield"]');
  ok(/탱커 강타/.test(await page.textContent('#s-party .f-isheet .f-ih')), '단축칸 시트에도 녹슨 문지기 아이템 힌트');
  await page.click('#s-party .f-isheet [data-shut]'); await page.clock.runFor(50);
  const sel = await pickedItems(page);
  ok(sel === 'mana,shield', `생명 빼고 보호 넣기 → ${sel}`);
  await page.reload(); await page.clock.runFor(300);
  await toParty(page);
  const sel2 = await pickedItems(page);
  ok(sel2 === 'mana,shield', `다시 열어도 기억 (${sel2})`);
  await page.click('#s-party [data-slots="1"]'); await page.clock.runFor(50);
  await page.locator('#s-party .f-isheet [data-item="shield"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/v6_party_items.png` });
  await page.click('#s-party .f-isheet [data-shut]'); await page.clock.runFor(50);

  await page.click('#s-party [data-slots="0"]');
  await page.click('#s-party .f-isheet [data-item="cleanse"]');
  await page.click('#s-party .f-isheet [data-shut]');

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

  // ---- 단축칸 ----
  ok(await page.locator('#healerImg').count() === 0, '하단 왼쪽 힐러 그림 없음');
  const slots = await ev(() => [...document.querySelectorAll('#items .item')].map(b => b.dataset.item || 'empty').join());
  ok(slots === 'cleanse,shield', `단축칸 2칸 = ${slots}`);
  const boxes = await ev(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    return { items: [...document.querySelectorAll('#items .item')].map(r), wheel: r(document.getElementById('wheel')), controls: r(document.getElementById('controls')), vw: innerWidth };
  });
  const inside = boxes.items.every(b => b.y >= boxes.controls.y - 1 && b.b <= boxes.controls.b + 1 && b.x >= 0 && b.r <= boxes.vw);
  const noOverlap = boxes.items.every(b => b.r <= boxes.wheel.x + 1 || b.x >= boxes.wheel.x + boxes.wheel.w - 1);
  ok(inside && noOverlap && boxes.items[0].w >= 44, `단축칸이 하단 안, 휠과 안 겹침, 칸 ${Math.round(boxes.items[0].w)}px`);

  // 물약·공용 쿨·중복 touch는 compact-ui의 두 물약 조합에서 검증한다.

  // 길게 누르기 = 설명, 사용 안 함
  await page.dispatchEvent('#items [data-item="cleanse"]', 'pointerdown'); await page.clock.runFor(600);
  const tipTxt = await page.textContent('#tip');
  ok(await page.isVisible('#tip') && /해제 두루마리/.test(tipTxt) && /독/.test(tipTxt), '길게 누르면 설명 팝업');
  await page.screenshot({ path: `${shots}/v6_item_tip.png` });
  await page.dispatchEvent('#items [data-item="cleanse"]', 'pointerup'); await page.clock.runFor(60);
  ok(await ev(() => window.__proto.F.items.cleanse === 1), '길게 누르기는 쓰지 않음');
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

  // 해제 두루마리: 독 포함, 함정 제외. 장판·토스트를 먼저 정리하고, 시계가 실제로 흐르므로 디버프 걸기와 누르기는 한 번에 (사이에 파티원 독소 정화가 독을 먼저 지우면 두루마리를 안 씀)
  await page.clock.runFor(1500);
  const cl = await ev(() => {
    const F = window.__proto.F, alive = F.party.filter(u => u.alive && !u.me);
    alive[0].debuffs.push({ id: 900, name: '독침', type: '독', left: 12, dot: 15 });
    alive[1].debuffs.push({ id: 901, name: '전염', type: '질병', left: 8, trap: true });
    const b = document.querySelector('#items [data-item="cleanse"]');
    for (const type of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1 }));
    return alive.slice(0, 2).map(u => u.id);
  });
  await page.clock.runFor(60);
  const cr = await ev(ids => { const F = window.__proto.F; return ids.map(id => F.party.find(u => u.id === id).debuffs.map(d => d.name).join('+') || '-'); }, cl);
  ok(!/독침/.test(cr[0]) && /전염/.test(cr[1]), `해제: 독 지움, 전염(함정)은 남김 ${JSON.stringify(cr)}`);

  // 보호 두루마리: 장전 → 칸 탭
  await page.dispatchEvent('#items [data-item="shield"]', 'pointerdown'); await page.dispatchEvent('#items [data-item="shield"]', 'pointerup'); await page.clock.runFor(60);
  ok(await ev(() => document.querySelector('#items [data-item="shield"]').classList.contains('armed')), '보호 두루마리 장전');
  const tk2 = await ev(() => { const F = window.__proto.F; const u = F.party.find(x => x.role === 'tank' && x.alive); return Object.assign(window.__proto.center(u.cell), { id: u.id }); });
  await page.touchscreen.tap(bb.x + tk2.x, bb.y + tk2.y); await page.clock.runFor(60);
  const sh = await ev(id => ({ sh: window.__proto.F.party.find(u => u.id === id).shield, left: window.__proto.F.items.shield, cast: !!window.__proto.F.cast }), tk2.id);
  ok(sh.sh > 7 && sh.left === 0 && !sh.cast, `탱커에게 보호 8초, 힐은 안 나감 ${JSON.stringify(sh)}`);
  await page.screenshot({ path: `${shots}/v6_shield.png` });

  // 기록
  const run = await ev(() => window.__proto.run());
  ok(run.items.join() === 'cleanse,shield' && run.itemLog.map(x => x.key).join() === 'cleanse,shield' && run.itemTips === 1, `runData items/itemLog/itemTips ${JSON.stringify({ items: run.items, log: run.itemLog, tips: run.itemTips })}`);

  // 일시정지: 자리 비움
  await page.click('#pauseBtn'); await page.clock.runFor(100);
  ok(!/자리 비움|기다려/.test(await page.textContent('#pause')), '일시정지: 기다림 문구 없음');
  await page.click('#resumeBtn'); await page.clock.runFor(100);

  // 포기 → 정산 (파티 채팅 없음, 쓴 아이템은 자세히에)
  await page.click('#pauseBtn'); await page.clock.runFor(100);
  ok(/포기/.test(await page.textContent('#quitBtn')), '일시정지 버튼 = 포기하고 나가기');
  await page.click('#quitBtn');
  await page.locator('#battleConfirm').waitFor({ state: 'visible' });
  ok(await page.isVisible('#battle') && await page.isHidden('#s-settle'), '포기는 확인창에서 확정 전까지 전투 유지');
  await page.click('#confirmApply'); await page.clock.runFor(200);
  ok(await page.isVisible('#s-settle') && (await page.textContent('#s-settle h1')) === '포기', '포기 → 정산');
  ok(await page.locator('#s-settle .chat, #s-settle .plines').count() === 0, '정산에 파티 채팅·한마디 없음');
  ok(/소비 아이템\s*해제 \d/.test(await page.textContent('#s-settle details.r-rec')) && /보상 없음/.test(await page.textContent('#s-settle .r-why')), '포기: 「보상 없음」, 전투 기록에 쓴 아이템');
  ok(/경험치/.test(await page.textContent('#s-settle')) === false, '포기하면 경험치 없음');
  await page.screenshot({ path: `${shots}/v6_result.png` });

  // ---- 깃털 + 20인 판 ----
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
  await page.click('#s-party [data-slots="1"]'); await page.clock.runFor(50);
  await page.click('#s-party .f-isheet [data-item="feather"]');
  await page.click('#s-party .f-isheet [data-shut]'); await page.clock.runFor(50);
  await departGo(page); await page.clock.runFor(3300);
  const b20 = await ev(() => ({ board: window.__proto.F.board, cells: window.__proto.F.cells.length }));
  ok(b20.board === 'b36' && b20.cells === 36, `20인 = 6열 × 6줄 b36 ${JSON.stringify(b20)}`);
  // 파티 요약 줄 「파티 20/20 · 모두 생존」은 뺐다 (2026-10-09 Lim). 판이 보스 무대 바로 아래에서 시작
  const top20 = await ev(() => ({ gone: !document.querySelector('#partyStatus,#partyAlive,#partyCondition'), stage: document.getElementById('stage').getBoundingClientRect().bottom, board: document.getElementById('boardWrap').getBoundingClientRect().top }));
  ok(top20.gone && Math.abs(top20.board - top20.stage) <= 1, `파티 요약 줄 없음, 판이 무대 바로 아래 ${JSON.stringify(top20)}`);
  const boxes20 = await ev(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, r: b.right, b: b.bottom }; };
    return { items: [...document.querySelectorAll('#items .item')].map(r), wheel: r(document.getElementById('wheel')), controls: r(document.getElementById('controls')) };
  });
  ok(boxes20.items.every(b => b.y >= boxes20.controls.y - 1 && b.b <= boxes20.controls.b + 1 && (b.r <= boxes20.wheel.x + 1 || b.x >= boxes20.wheel.r - 1)), '20인에서도 단축칸이 하단 안');
  // 쓰러뜨리기·깃털·체력 읽기를 한 번에 (시계가 실제로 흐르므로 사이에 다른 치유가 들어가면 30%가 아니게 됨)
  const rv = await ev(() => {
    const F = window.__proto.F, u = F.party.find(x => x.role === 'ranged' && x.alive);
    F.cells[u.cell].unit = null; u.alive = false; u.hp = 0; u.diedAt = F.t; u.debuffs = [];
    const b = document.querySelector('#items [data-item="feather"]');
    for (const type of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1 }));
    return { alive: u.alive, pct: Math.round((u.hp / u.max) * 100), inCell: F.cells[u.cell].unit === u };
  });
  ok(rv.alive && rv.pct >= 28 && rv.pct <= 31 && rv.inCell, `부활 깃털: 30%로 칸에 복귀 ${JSON.stringify(rv)}`);
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
  const lh = await ev(() => { const w = document.getElementById('wheel').getBoundingClientRect(), i = document.getElementById('items').getBoundingClientRect(); return { wheelX: w.x, itemsX: i.x }; });
  ok(lh.wheelX < lh.itemsX, `왼손 모드: 휠 왼쪽, 단축칸 오른쪽 ${JSON.stringify(lh)}`);
  await page.screenshot({ path: `${shots}/v6_lefthand.png` });

  await browser.close();
  return { fails, errs };
}
