// 장비: 좌우 장비 칸·중앙 능력치, 바로 아래 인벤토리(필터·정렬), 아이템 상세(비교·강화·잠금·개별 분해·장착). 세트 없음.
import { chromium } from 'playwright';
import { pastTitle } from './nav.mjs';
import { equipmentLayout } from './character.mjs';

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
  /** 아래 시트 닫기 (어두운 바탕의 위쪽을 누름) */
  const closeSheet = async () => { await page.click('#s-char .sheet-dim', { position: { x: 20, y: 120 } }); await page.clock.runFor(50); };
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    // set = 옛 저장의 세트 장비 (세트를 없앤 뒤엔 불러올 때 보통 장비로 바뀜)
    const it = (id, slot, grade, set, plus = 0) => ({ id, slot, grade, plus, name: set ? `새벽 순례자의 ${slot}` : `${grade} ${slot}`, ...(set ? { set: 'dawn' } : {}) });
    s.player.level = 30; s.player.gold = 1000; s.mats = { stone: 8, refined: 0 };
    s.gear.equipped = { head: it(101, 'head', '희귀', true), chest: it(102, 'chest', '희귀', true), weapon: it(103, 'weapon', '고급', false) };
    s.gear.bag = [it(201, 'hands', '일반', false), it(202, 'ring', '고급', false), it(203, 'neck', '희귀', true)];
    s.gear.seen = 0;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok((await page.locator('#s-char .c7-set, #s-char .c7-setdot, #s-char .c7-boxes, #s-char .c7-noset').count()) === 0 && !/세트|순례자/.test(await text('#s-char')), '세트 없음: 세트 깃발·세트 표시 없음, 옛 세트 장비 이름도 안 보임');
  ok(/축복받은 두건/.test(await page.getAttribute('#s-char .gtile[data-gitem="101"]', 'aria-label')) && !('set' in (await save()).gear.equipped.head), '옛 세트 장비 = 등급 이름 장비 (저장에서도 세트 표시 빠짐)');
  ok((await page.locator('#s-char .c7-plq').count()) === 0 && (await page.locator('#s-char .c7-mid .c7-stat').count()) === 6, '장비 점수 이름표 대신 중앙 능력치 판 6줄');
  for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height }); await page.clock.runFor(100);
    const layout = await equipmentLayout(page);
    ok(layout.centered && layout.viewport && layout.inventoryFollows && layout.inventoryVisible, `${width}: 중앙 능력치와 바로 아래 인벤토리 첫 줄이 화면 안 (${JSON.stringify(layout)})`);
    ok(layout.valuesFit && layout.bonusCount > 0 && layout.bonusGreen, `${width}: 착용 능력치와 초록 장비 증가량 겹침·잘림 없음 (${JSON.stringify(layout)})`);
    await page.screenshot({ path: `${shots}/gear_compact_${width}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.clock.runFor(100);

  // ---- 받침대 좌우 장비 칸 ----
  const t101 = await text('#s-char .gtile[data-gitem="101"]');
  ok((await page.locator('#s-char .gtile').count()) === 6 && /희/.test(await text('#s-char .gtile[data-gitem="101"] .c7-gl')) && /머리/.test(t101) && /두건/.test(await page.getAttribute('#s-char .gtile[data-gitem="101"]', 'aria-label')) && (await page.locator('#s-char .c7-slot > small').count()) === 0, '장비 칸 6개: 그림·등급·부위 이름, 종류는 접근 가능한 이름에 유지하고 보조문구 없음');
  ok(/가방에 1개/.test(await page.getAttribute('#s-char .gtile[data-gslot="hands"]', 'aria-label')) && (await page.locator('#s-char .gtile[data-gslot="hands"] .c7-better').count()) === 1 && await page.isVisible('#s-char [data-csub="gear"] .rdot'), '빈칸: 가방 개수는 접근 가능한 이름, 초록 ↑·장비 탭 빨간 점 유지');
  ok(/3개/.test(await text('#s-char .c7-inventory-count')) && (await page.locator('#s-char .c7-acts, #s-char [data-bag], #s-char [data-rec], #s-char [data-salvbag]').count()) === 0, '인벤토리 개수 3개, 별도 가방·추천·분해 버튼 없음');

  // ---- 장비 아래 인벤토리 ----
  ok(await page.isVisible('#s-char .c7-inventory') && !(await page.locator('#s-char .sheet').count()) && /강화석 8/.test(await text('#s-char .gmats')), '장비 진입 즉시 인벤토리·재료 표시, 가방 모달 없음');
  ok((await page.locator('#s-char .c7-bag').count()) === 3 && (await page.locator('#s-char .c7-bag .nw').count()) === 3 && (await page.locator('#s-char .c7-bag .up').count()) === 3, '가방 5열 격자: 새것 점 · ↑');
  await page.click('#s-char [data-bfilter="acc"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag').count()) === 2, '필터 「장신구」 = 반지·목걸이');
  ok((await page.locator('#s-char [data-bfilter]').count()) === 4 && (await page.locator('#s-char [data-bfilter="set"]').count()) === 0, '필터 4개 (「세트」 없음)');
  await page.click('#s-char [data-bfilter="all"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  ok(/등급순/.test(await text('#s-char [data-bsort]')), '정렬 버튼 = 점수 → 등급 → 새것');
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char .c7-bag:first-child', 'data-gitem') === '203', '새것순 = 최근 장비 먼저');
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  await page.screenshot({ path: `${shots}/gear_list.png` });
  // ---- 장비 도감 (34 6-10 ④) → 특수능력 도감 (42 1-6) ----
  ok(/도감/.test(await text('#s-char [data-dex]')) && (await page.locator('#s-char [data-dex] .g-badge').count()) === 0, '가방 아래 「도감」 (받을 보상 없음)');
  await page.click('#s-char [data-dex]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-dex') && (await page.locator('#s-char [data-dext]').count()) === 4 && (await page.locator('#s-char .c7-dex .c7-spec').count()) === 30, '장비 도감 = 묶음 칩 4개 (종류 · 세력 · 장신구 · 고유), 종류 30칸');
  ok((await page.locator('#s-char .c7-dex .c7-spec:not(.unk)').count()) === 6 && /6\/316/.test(await text('#s-char .c7-dex .c7-row')) && /10칸을 채우면/.test(await text('#s-char .c7-dexr')), '가진 장비 종류 6칸이 채워짐 (옛 장비 = 부위 첫 종류), 10칸마다 보상 안내');
  await page.click('#s-char [data-dext="look"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-dex .c7-spec.unk').count()) === 143 && /버섯 요정단/.test(await text('#s-char .c7-dex')), '세력 묶음 143칸 (못 얻은 칸 = 「?」 + 세력 · 나오는 곳)');
  await page.screenshot({ path: `${shots}/gear_dex.png` });
  ok(/특수능력 3\/118/.test(await text('#s-char .c7-dex [data-codex]')), '장비 도감 아래 「특수능력 3/118」 (옛 장비 이전 때 굴린 특수능력 3개)');
  await page.click('#s-char .c7-dex [data-codex]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-codex') && (await page.locator('#s-char [data-codexg]').count()) === 10 && (await page.locator('#s-char .c7-codex .c7-spec').count()) === 16, '특수능력 도감 = 묶음 칩 10개 (9묶음 + 고유), 치유 16칸');
  ok((await page.locator('#s-char .c7-codex .c7-spec.unk').count()) === 16 && /다 모으면 칭호/.test(await text('#s-char .c7-codex')), '못 얻은 칸 = 「?」 + 나오는 곳, 칭호 안내');
  await page.click('#s-char [data-codexg="dispel"]'); await page.clock.runFor(50);
  ok(/해독초/.test(await text('#s-char .c7-codex')) && (await page.locator('#s-char .c7-codex .c7-spec:not(.unk)').count()) === 1, '해제 묶음: 얻은 「해독초」는 이름 · 효과');
  await page.screenshot({ path: `${shots}/gear_codex.png` });
  await closeSheet();
  ok(await page.isVisible('#s-char .c7-dex') && !(await page.isVisible('#s-char .c7-codex:not(.c7-dex)')), '특수능력 도감을 닫으면 장비 도감으로');
  await closeSheet();
  ok(await page.isVisible('#s-char .c7-inventory') && !(await page.locator('#s-char .sheet').count()), '장비 도감을 닫으면 상시 인벤토리로');

  // ---- 상세 시트 · 강화 ----
  await page.click('#s-char .gtile[data-gitem="101"]'); await page.clock.runFor(50);
  let sh = await text('#s-char .c7-gsheet');
  ok(await page.isVisible('#s-char .c7-gsheet') && /\+0 → \+1/.test(sh) && /골드 10/.test(sh) && /가진 것 8/.test(sh) && /성공 100%/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '강화', '착용 장비 누르면 아래 시트: 강화 비용·가진 강화석·성공 확률, 주 버튼 「강화」');
  ok(await page.isDisabled('#s-char [data-salv1="101"]') && /착용 중/.test(await text('#s-char [data-salv1="101"]')), '착용 중인 장비는 개별 분해 불가');
  ok(/주 능력치/.test(sh) && /두건 고정/.test(sh) && (await page.locator('#s-char .c7-gsheet .c7-cmp .c7-roll').count()) === 2, '상세 시트 옵션: 주 능력치 · 종류 고정 옵션 · 추가 옵션 2줄 (굴림 막대)');
  ok((await page.locator('#s-char .c7-gsheet .c7-spec').count()) === 1 && /특수능력/.test(sh) && /해독초/.test(sh), '옛 희귀 장비 = 특수능력 1줄 (옛 장비 이전 때 굴림, 42 1-1): 묶음 표식 · 이름 · 효과');
  // 확률 강화 (34 6-5): 굴림을 고정해서 누름 (0 = 성공, 0.99 = 실패)
  const enh = async r => { await page.evaluate(v => { window.__rnd = Math.random; Math.random = () => v; }, r); await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50); await page.evaluate(() => { Math.random = window.__rnd; }); };
  await enh(0);
  let sv = await save();
  ok(sv.gear.equipped.head.plus === 1 && sv.player.gold === 990 && sv.mats.stone === 7, '강화 +1: 골드 10·강화석 1 씀');
  await enh(0);
  sv = await save(); sh = await text('#s-char .c7-gsheet');
  ok(sv.gear.equipped.head.plus === 2 && sv.player.gold === 950 && /성공 90%/.test(sh) && /실패하면 \+1로 떨어짐/.test(sh), '+2 (골드 40·강화석 2), 다음 단계 성공 90% · 실패하면 떨어진다는 경고');
  await enh(0.99);
  sv = await save();
  ok(sv.gear.equipped.head.plus === 1 && sv.player.gold === 860 && sv.mats.stone === 2 && /강화 실패 · \+2 → \+1/.test(await text('#s-char .c7-gsheet')), '+3 실패: +2 → +1로 떨어지고 재료는 씀');
  await enh(0);
  sv = await save();
  ok(sv.gear.equipped.head.plus === 2 && sv.player.gold === 820 && await page.isDisabled('#s-char [data-enh="101"]') && /강화석 부족/.test(await text('#s-char .c7-gsheet')), '다시 +2, 강화석이 모자라면 버튼 꺼짐 + 이유');
  await page.locator('#s-char .c7-gsheet').screenshot({ path: `${shots}/gear_detail.png` });
  await closeSheet();
  ok(!(await page.isVisible('#s-char .sheet')), '시트 바깥을 누르면 닫힘');

  // ---- 가방 장비: 비교 · 잠금 ----
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  sh = await text('#s-char .c7-gsheet');
  ok(/지금 장비와 비교/.test(sh) && /빈칸/.test(sh) && !/세트/.test(sh) && /새로 얻음/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '장착', '가방 장비 = 비교 ▲ · 새로 얻음 (세트 줄 없음), 주 버튼 「장착」');
  ok((await page.locator('#s-char .c7-gsheet .c7-up').count()) >= 3, '빈칸과 비교하면 모두 ▲');
  await page.click('#s-char [data-lock="203"]'); await page.clock.runFor(50);
  ok((await save()).gear.bag.find(x => x.id === 203).lock === true && await page.getAttribute('#s-char [data-lock="203"]', 'aria-pressed') === 'true' && await page.isDisabled('#s-char [data-salv1="203"]'), '잠금 → 저장, 분해 버튼 꺼짐');
  await closeSheet();
  ok(await page.isVisible('#s-char .c7-inventory') && !(await page.locator('#s-char .sheet').count()) && (await page.locator('#s-char .c7-bag[data-gitem="203"] .lk').count()) === 1, '상세 닫기 → 상시 인벤토리, 잠긴 아이템에 자물쇠');

  // ---- 아이템을 눌러 개별 분해 ----
  await page.click('#s-char .c7-bag[data-gitem="201"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-gsheet') && !(await page.isDisabled('#s-char [data-salv1="201"]')) && /강화석 \+1/.test(await text('#s-char [data-salv1="201"]')), '인벤토리 아이템 탭 → 개별 분해 버튼과 받을 재료');
  await page.locator('#s-char .c7-gsheet').screenshot({ path: `${shots}/gear_salvage.png` });
  await page.click('#s-char [data-salv1="201"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 2 && !sv.gear.bag.some(x => x.id === 201) && sv.gear.bag.some(x => x.id === 202) && sv.gear.bag.some(x => x.id === 203) && sv.player.gold === 825 && sv.mats.stone === 1, '개별 분해는 고른 일반 장비만 제거, 골드 +5 · 강화석 +1');
  ok(!(await page.locator('#s-char .sheet').count()) && /2개/.test(await text('#s-char .c7-inventory-count')) && /강화석 1/.test(await text('#s-char .gmats')) && /분해: 골드 \+5/.test(await text('#s-char')), '분해 직후 인벤토리 복귀, 개수·재료·결과 안내 갱신');
  await page.click('#s-char .c7-bag[data-gitem="202"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-salv1="202"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 1 && sv.gear.bag[0].id === 203 && sv.gear.bag[0].lock && sv.player.gold === 840 && sv.mats.stone === 2, `고급 장비 개별 분해 뒤 잠긴 장비 유지, 골드 +15 · 강화석 +1 (${sv.player.gold}, ${sv.mats.stone})`);
  ok(/1개/.test(await text('#s-char .c7-inventory-count')) && (await page.locator('#s-char .c7-bag').count()) === 1 && /강화석 2/.test(await text('#s-char .gmats')), '남은 인벤토리 1개·강화석 2 표시');

  // ---- 인벤토리 상세에서 수동 장착 ----
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-char [data-salv1="203"]'), '남겨 둔 잠긴 아이템의 분해 보호 유지');
  await page.click('#s-char [data-equip="203"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.equipped.neck?.id === 203 && sv.gear.equipped.neck.lock && sv.gear.bag.length === 0, '상세 「장착」 → 목걸이 착용, 잠금 상태 유지');
  ok(await page.isDisabled('#s-char [data-salv1="203"]'), '방금 장착한 장비도 개별 분해 불가');
  await closeSheet();
  ok(await page.evaluate(() => document.activeElement?.id === 'gearInventoryTitle'), '마지막 아이템 장착 뒤 상세 닫기 → 빈 인벤토리 제목 포커스 복귀');
  ok(/0개/.test(await text('#s-char .c7-inventory-count')) && (await page.locator('#s-char .c7-bag').count()) === 0 && !(await page.isVisible('#s-char [data-csub="gear"] .rdot')), '빈 인벤토리 개수 0, 더 좋은 장비 빨간 점 사라짐');
  ok((await page.locator('#s-char .c7-bag-empty').count()) === 15, '장비가 없어도 인벤토리 빈칸 3줄 유지');

  // ---- 장비 도감 보상 (10칸마다) ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.gear.dex = [...s.gear.dex, 'k:mace', 'k:helm', 'k:crown', 'k:wand', 'l:fairy:jade', 'u:guardianHelm'];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok((await page.locator('#s-char [data-dex] .g-badge').count()) === 1, '10칸을 넘기면 「도감」에 받을 보상 표시');
  await page.click('#s-char [data-dex]'); await page.clock.runFor(50);
  const g0 = (await save()).player.gold, s0 = (await save()).mats.stone;
  ok(/보상 받기 · 골드 600 · 강화석 5/.test(await text('#s-char .c7-dexr')), '보상 받기 버튼 = 골드 600 · 강화석 5');
  await page.click('#s-char [data-dexclaim]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === g0 + 600 && sv.mats.stone === s0 + 5 && sv.gear.dexPaid === 1 && /20칸을 채우면/.test(await text('#s-char .c7-dexr')), `보상을 받으면 골드 · 강화석이 들어오고 다음 보상 안내 (${sv.player.gold - g0}, ${sv.mats.stone - s0})`);
  await page.click('#s-char [data-dext="unique"]'); await page.clock.runFor(50);
  ok(/신전 수호상 투구/.test(await text('#s-char .c7-dex')) && (await page.locator('#s-char .c7-dex .c7-spec').count()) === 72, '고유 묶음 72칸: 얻은 「신전 수호상 투구」는 이름 · 고유 특수능력');
  await closeSheet();

  // ---- 많은 아이템: 3줄 창 · 내부 스크롤 · 상세 복귀 ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    const slots = ['weapon', 'head', 'chest', 'hands', 'ring', 'neck'];
    const grades = ['일반', '고급', '희귀'];
    s.gear.bag = Array.from({ length: 40 }, (_, i) => ({
      id: 1001 + i, slot: slots[i % slots.length], grade: grades[i % grades.length],
      plus: i % 4, name: `스크롤 장비 ${i + 1}`,
    }));
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  const grid = page.locator('#s-char .c7-bags');
  const scrollState = () => grid.evaluate(el => {
    const r = el.getBoundingClientRect();
    const cells = [...el.querySelectorAll('.c7-bag')].map(cell => cell.getBoundingClientRect());
    const body = document.querySelector('#s-char .ns-body');
    const tabs = document.querySelector('#tabs').getBoundingClientRect();
    const visible = cell => cell.top >= r.top - 1 && cell.bottom <= r.bottom + 1;
    return {
      top: el.scrollTop, max: el.scrollHeight - el.clientHeight, bodyTop: body.scrollTop,
      firstFifteenFit: cells.length >= 15 && cells.slice(0, 15).every(visible),
      threeRows: new Set(cells.slice(0, 15).map(cell => Math.round(cell.top))).size === 3,
      fourthBelow: cells.length > 15 && cells[15].top >= r.bottom - 1,
      onScreen: r.top >= body.getBoundingClientRect().top - 1 && r.bottom <= tabs.top + 1,
      lastVisible: visible(cells[cells.length - 1]),
      noHorizontalOverflow: el.scrollWidth <= el.clientWidth + 1,
    };
  });
  ok(await grid.getAttribute('role') === 'region' && await grid.getAttribute('aria-label') === '인벤토리 아이템' && await grid.getAttribute('tabindex') === '0', '인벤토리 스크롤 영역에 이름과 키보드 진입점 제공');
  for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      document.querySelector('#s-char .ns-body').scrollTop = 0;
      document.querySelector('#s-char .c7-bags').scrollTop = 0;
    });
    await page.clock.runFor(100);
    // 낮은 화면은 장비 화면을 올려 인벤토리에 접근한다. 보통 높이는 첫 진입부터 3줄이 보여야 한다.
    if (height < 700) await grid.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const start = await scrollState();
    ok(start.firstFifteenFit && start.threeRows && start.fourthBelow && start.max > 0 && start.noHorizontalOverflow, `${width}: 첫 15개가 3줄 창에 온전히 표시되고 나머지는 아래로 스크롤 (${JSON.stringify(start)})`);
    ok(start.onScreen, `${width}: 인벤토리 3줄 전체가 상단 영역과 하단 메뉴 사이에 표시`);
    await page.screenshot({ path: `${shots}/gear_inventory_rows_${width}.png`, animations: 'disabled' });
    await grid.evaluate(el => el.focus({ preventScroll: true }));
    await page.keyboard.press('End'); await page.clock.runFor(400);
    // Chromium의 기본 키보드 스크롤은 가상 페이지 시계와 별도로 진행된다.
    // 실제 끝 위치와 마지막 아이템 노출을 기다린 뒤 결과를 검증한다.
    let end = await scrollState();
    for (let attempt = 0; attempt < 80 && (Math.abs(end.top - end.max) > 2 || !end.lastVisible); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 25));
      end = await scrollState();
    }
    ok(end.top > 0 && Math.abs(end.top - end.max) <= 2 && end.lastVisible && Math.abs(end.bodyTop - start.bodyTop) <= 1, `${width}: 인벤토리에서 End 키로 마지막 아이템 접근, 바깥 화면 위치 유지 (${JSON.stringify(end)})`);
    const lastId = await page.locator('#s-char .c7-bag').last().getAttribute('data-gitem');
    const opening = await scrollState();
    await page.locator('#s-char .c7-bag').last().click(); await page.clock.runFor(50);
    ok(await page.isVisible('#s-char .c7-gsheet') && (await page.locator(`#s-char [data-salv1="${lastId}"]`).count()) === 1, `${width}: 마지막 줄 아이템도 상세·개별 분해에 접근`);
    await closeSheet();
    const returned = await scrollState();
    ok(Math.abs(returned.top - opening.top) <= 1 && returned.lastVisible, `${width}: 상세를 닫으면 같은 인벤토리 스크롤 위치로 복귀 (${returned.top} / ${opening.top})`);
    await page.screenshot({ path: `${shots}/gear_inventory_end_${width}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.clock.runFor(100);
  await page.click('#s-char [data-bfilter="armor"]'); await page.clock.runFor(50);
  let filtered = await scrollState();
  ok(filtered.top === 0 && filtered.max > 0 && filtered.firstFifteenFit && (await page.locator('#s-char .c7-bag').count()) > 15, '내부 스크롤이 남는 방어구 분류로 변경해도 첫 줄부터 표시');
  await grid.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  filtered = await scrollState();
  ok(filtered.top === 0 && filtered.max > 0 && filtered.firstFifteenFit, '정렬 변경 뒤 인벤토리 첫 줄로 돌아옴');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
