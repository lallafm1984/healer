// 장비 (27 4-2·4-3, 09 S10·S11, 31 시안 · A2 테마): 좌우 장비 칸 + 가운데 능력치 판, 바로 아래 인벤토리(필터·정렬·▲▼·3줄 내부 스크롤), 상세 시트(옵션 줄마다 지금 장비와 차이·강화·잠금·개별 분해·장착). 세트 없음 (옛 저장의 세트 장비도 보통 장비로)
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
  const closeSheet = async () => {
    const dim = await page.locator('#s-char .sheet-dim').boundingBox();
    const sheet = await page.locator('#s-char .sheet').boundingBox();
    // 장비 상세 높이가 늘어나도 실제로 노출된 바탕을 누른다. 강제 클릭은 사용하지 않는다.
    if (!dim || !sheet || sheet.y <= dim.y) throw new Error('시트 바깥 닫기 영역이 없음');
    await page.mouse.click(dim.x + dim.width / 2, (dim.y + sheet.y) / 2);
    await page.clock.runFor(50);
  };
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
    ok(layout.valuesFit && layout.labelsSeparate && layout.detailsVisible, `${width}: 능력치 합계·상세 보기·칸 아래 장비 이름 겹침·잘림 없음 (${JSON.stringify(layout)})`);
    await page.screenshot({ path: `${shots}/gear_compact_${width}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.clock.runFor(100);

  // ---- 받침대 좌우 장비 칸 ----
  const t101 = await text('#s-char .gtile[data-gitem="101"]');
  ok((await page.locator('#s-char .gtile').count()) === 6 && (await page.locator('#s-char .gtile .c7-gl').count()) === 0 && /희귀/.test(await page.getAttribute('#s-char .gtile[data-gitem="101"]', 'aria-label')) && /머리/.test(t101) && /두건/.test(await page.getAttribute('#s-char .gtile[data-gitem="101"]', 'aria-label')) && (await page.locator('#s-char .c7-slot > small').count()) === 0, '장비 칸 6개: 그림·부위 이름, 등급은 칸 바탕 색 (글자 칩 없음)과 접근 가능한 이름, 종류도 접근 가능한 이름에 유지하고 보조문구 없음');
  ok(/가방에 1개/.test(await page.getAttribute('#s-char .gtile[data-gslot="hands"]', 'aria-label')) && (await page.locator('#s-char .gtile[data-gslot="hands"] .c7-better').count()) === 1 && await page.isVisible('#s-char [data-csub="gear"] .rdot'), '빈칸: 가방 개수는 접근 가능한 이름, 초록 ↑·장비 탭 빨간 점 유지');
  ok(/3개/.test(await text('#s-char .c7-inventory-count')) && (await page.locator('#s-char .c7-acts, #s-char [data-bag], #s-char [data-rec], #s-char [data-salvbag]').count()) === 0, '인벤토리 개수 3개, 별도 가방·추천·분해 버튼 없음');

  // ---- 장비 아래 인벤토리 ----
  ok((await page.locator('#s-char .gmats .currency-icon img').count()) === 2 && !/강화석/.test(await text('#s-char .gmats')), '강화석 두 종류는 실제 아이콘과 수량만 표시, 이름은 접근성 정보로 유지');
  ok(await page.isVisible('#s-char .c7-inventory') && !(await page.locator('#s-char .sheet').count()) && (await page.getAttribute('#s-char .gmats .currency-amount:first-child', 'aria-label')) === '강화석 8', '장비 진입 즉시 인벤토리·재료 표시, 가방 모달 없음');
  ok((await page.locator('#s-char .c7-bag').count()) === 3 && (await page.locator('#s-char .c7-bag .nw').count()) === 3 && (await page.locator('#s-char .c7-bag .up').count()) === 3 && (await page.locator('#s-char .c7-bag .dn').count()) === 0 && /지금 장비보다 좋음/.test(await page.getAttribute('#s-char .c7-bag[data-gitem="201"]', 'aria-label')), '인벤토리 5열 격자: 새것 점 · 빈칸보다 좋으니 모두 ▲');
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
  ok((await page.locator('#s-char .c7-inventory [data-dex]').count()) === 0, '인벤토리에 도감 버튼 없음');

  // 분류에서 보이지 않은 장비도 장비 화면을 나가면 확인 처리. 비교 화살표는 남는다.
  ok((await save()).gear.seen === 0, '장비 화면을 보는 동안에는 새 장비 확인 상태를 저장하지 않음');
  await page.click('#s-char [data-bfilter="weapon"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await save()).gear.seen === 203 && !(await page.isVisible('#s-char [data-csub="gear"] .rdot')), '비어 있는 분류에서도 장비 화면을 나가면 전체 확인 처리');
  ok(!/새 장비/.test(await page.getAttribute('#s-char .tb-pf', 'aria-label')), '새 장비에 관한 상단 알림 제거');
  await page.click('#s-char [data-csub="gear"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-bfilter="all"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag .nw').count()) === 0 && (await page.locator('#s-char .c7-bag .up').count()) === 3, '재진입하면 빨간 새것 점은 사라지고 비교 화살표는 유지');

  ok(!(await text('#s-char .c7-stat:nth-child(5) b')).startsWith('+'), '정신력 합계 앞에 + 없음');
  ok((await page.locator('#s-char .c7-stat b').allTextContents()).slice(2).every(value => /^[+]?\d+\.\d%$/.test(value)), '퍼센트 능력치는 소수 한 자리 고정 표시');

  // ---- 상세 시트 · 강화 ----
  await page.click('#s-char .gtile[data-gitem="101"]'); await page.clock.runFor(50);
  let sh = await text('#s-char .c7-gsheet');
  ok((await page.locator('#s-char [data-autoopen], #s-char [data-autogo], #s-char .c7-auto').count()) === 0 && !/목표까지|목표 강화/.test(sh), '목표 강화 없이 확인 후 한 번 강화만 제공');
  ok(await page.isVisible('#s-char .c7-gsheet') && (await page.locator('#s-char .c7-gsheet :is(.c7-enh-materials, .c7-enh-cost, .c7-rate)').count()) === 0 && !/성공률/.test(sh) && (await text('#s-char .c7-gsheet .c7-enh-section')).trim() === '강화' && await page.isDisabled('#s-char [data-equip="101"]'), '착용 장비 누르면 아래 시트: 강화 칸은 강화 버튼만 (비용·확률은 팝업, Lim 2026-10-14)과 착용 중 표시');
  ok((await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp').count()) === 3 && /착용 중/.test(await text('#s-char .c7-gsheet .c7-gname')) && (await page.locator('#s-char .c7-gsheet .c7-opts :is(.c7-up, .c7-dn, .c7-roll)').count()) === 0 && !/주 능력치|고정|줄 추가/.test(sh), '착용 장비 옵션: 희귀 = 3줄 (주 · 종류 · 무작위), 오른쪽은 비움 (착용 중), 「주 능력치」 · 「고정」 · 「2줄 추가」 없음 (Lim 2026-10-11)');
  ok(await page.isDisabled('#s-char [data-salv1="101"]') && /착용 중/.test(await text('#s-char [data-salv1="101"]')), '착용 중인 장비는 개별 분해 불가');
  const migratedSpec = (await save()).gear.equipped.head.specs;
  ok(migratedSpec.length === 1 && (await page.locator('#s-char .c7-gsheet .c7-spec').count()) === 1
    && /특수능력/.test(sh) && await page.isVisible('#s-char .c7-gsheet .c7-spec .c7-spg')
    && (await text('#s-char .c7-gsheet .c7-spec .c7-spt b')).trim().length > 0
    && (await text('#s-char .c7-gsheet .c7-spec .c7-spt .cap')).trim().length > 0,
  '옛 희귀 장비 = 특수능력 1줄 (후보 추가와 무관하게 저장·묶음 표식·이름·효과 표시)');
  // 확률 강화 (34 6-5): 굴림을 고정해서 누름 (0 = 성공, 0.99 = 실패). pop = 연출이 끝난 뒤 팝업 글자 (다음 강화 비용·확률)
  let pop = '';
  const enh = async r => {
    await page.evaluate(v => { window.__rnd = Math.random; Math.random = () => v; }, r);
    await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
    await page.click('#s-char [data-confirmgo]'); await page.clock.runFor(50);
    const saved = JSON.stringify(await save());
    ok(await page.getAttribute('#gearEnhanceFx [data-enhance-fx]', 'data-enhance-fx') === (r < .9 ? 'success' : 'failure'), '강화 결과에 맞는 화면 전면 이펙트');
    ok(await page.isVisible('#s-char .c7-confirm') && await page.isDisabled('#s-char [data-confirmgo]'), '강화 실행 후 팝업 유지·연출 중 재시도 차단');
    await page.clock.runFor(4000);
    ok(!(await page.locator('#gearEnhanceFx [data-enhance-fx]').count()), '화면 전면 연출 종료 후 레이어 제거');
    ok(await page.isVisible('#s-char .c7-confirm') && (await page.isVisible('#s-char .c7-enh-result')) === (r < .9) && JSON.stringify(await save()) === saved, '연출 종료 후 팝업 유지·성공만 결과 표시·자동 추가 강화 없음');
    pop = await text('#s-char .c7-confirm');
    if (r === 0.99) {
      ok((await text('#s-char .c7-confirm-rate')).trim() === '성공률 90%' && (await page.locator('#s-char .c7-confirm .c7-enh-result').count()) === 0 && !/강화 실패/.test(pop), '실패 결과 항목 제거: 성공률·다음 비용만 표시하고 실패·하락·유지 설명 없음');
      await page.locator('#s-char .c7-confirm').screenshot({ path: `${shots}/gear_failure_no_drop.png` });
    }
    await page.evaluate(() => { Math.random = window.__rnd; });
    await page.click('#s-char .c7-confirm [data-confirmcancel]'); await page.clock.runFor(50);
  };
  const beforeEnh = JSON.stringify(await save());
  await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-confirm') && JSON.stringify(await save()) === beforeEnh, '강화 확인 전에는 재화와 장비 유지');
  pop = await text('#s-char .c7-confirm');
  ok(/\+0 → \+1/.test(pop) && (await text('#s-char .c7-confirm [data-material="gold"] [data-cost]')).trim() === '10' && (await text('#s-char .c7-confirm [data-material="stone"] [data-have]')).trim() === '8' && /성공률 100%/.test(pop), '강화 팝업: 다음 단계·공통 비용 아이콘·보유 강화석·성공 확률');
  await page.click('#s-char .c7-confirm [data-confirmcancel]'); await page.clock.runFor(50);
  ok(JSON.stringify(await save()) === beforeEnh && await page.isVisible('#s-char .c7-gsheet'), '강화 취소는 상세로 복귀하며 비용 없음');
  await enh(0);
  let sv = await save();
  ok(sv.gear.equipped.head.plus === 1 && sv.player.gold === 990 && sv.mats.stone === 7, '강화 +1: 골드 10·강화석 1 씀');
  await enh(0);
  sv = await save();
  ok(sv.gear.equipped.head.plus === 2 && sv.player.gold === 950 && /성공률 90%/.test(pop) && !/실패 시|실패해도|하락|유지/.test(pop), '+2 (골드 40·강화석 2), 팝업은 성공률 90%만 표시, 실패 안내 문구 없음');
  await enh(0.99);
  sv = await save();
  ok(sv.gear.equipped.head.plus === 2 && sv.player.gold === 860 && sv.mats.stone === 2 && !/강화 실패/.test(await text('#s-char .c7-gsheet')) && !/하락|유지|그대로/.test(pop), '+3 실패: 현재 +2와 능력치는 유지하고 재료만 소비, 하락·유지 설명 없음');
  ok(!(await page.isDisabled('#s-char [data-enh="101"]')), '재료가 모자라도 상세의 강화 버튼은 팝업을 엶');
  await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-char [data-confirmgo]') && /강화석 부족/.test(await text('#s-char [data-confirmgo]')) && (await page.locator('#s-char .c7-confirm [data-material="stone"].short').count()) === 1, '강화석이 모자라면 팝업에서 모자란 재료 빨간 표시 + 강화 버튼 꺼짐과 이유');
  await page.click('#s-char .c7-confirm [data-confirmcancel]'); await page.clock.runFor(50);
  await page.locator('#s-char .c7-gsheet').screenshot({ path: `${shots}/gear_detail.png` });
  await closeSheet();
  ok(!(await page.isVisible('#s-char .sheet')), '시트 바깥을 누르면 닫힘');

  // ---- 가방 장비: 비교 · 잠금 ----
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  sh = await text('#s-char .c7-gsheet');
  ok(/빈 장비칸 대비/.test(sh) && !/세트/.test(sh) && !/지금 장비와 비교/.test(sh) && /미장착/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '장착', '가방 장비 = 옵션 오른쪽에 지금 장비와 차이 (따로 비교 칸 없음) · 미장착, 주 버튼 「장착」');
  ok((await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp').count()) === 3 && (await page.locator('#s-char .c7-gsheet .c7-opts .c7-up').count()) === 3, '빈칸과 비교하면 옵션 3줄 모두 ▲');
  await page.click('#s-char [data-lock="203"]'); await page.clock.runFor(50);
  ok((await save()).gear.bag.find(x => x.id === 203).lock === true && await page.getAttribute('#s-char [data-lock="203"]', 'aria-pressed') === 'true' && await page.isDisabled('#s-char [data-salv1="203"]'), '잠금 → 저장, 분해 버튼 꺼짐');
  await closeSheet();
  ok(await page.isVisible('#s-char .c7-inventory') && !(await page.locator('#s-char .sheet').count()) && (await page.locator('#s-char .c7-bag[data-gitem="203"] .lk').count()) === 1, '상세 닫기 → 상시 인벤토리, 잠긴 아이템에 자물쇠');

  // ---- 아이템을 눌러 개별 분해 ----
  await page.click('#s-char .c7-bag[data-gitem="201"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-gsheet') && !(await page.isDisabled('#s-char [data-salv1="201"]')) && (await page.locator('#s-char [data-salv1="201"] [aria-label="강화석 1"]').count()) === 1, '인벤토리 아이템 탭 → 개별 분해 버튼과 받을 재료');
  await page.locator('#s-char .c7-gsheet').screenshot({ path: `${shots}/gear_salvage.png` });
  const beforeSalvage = JSON.stringify(await save());
  await page.click('#s-char [data-salv1="201"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-confirm') && JSON.stringify(await save()) === beforeSalvage, '분해 확인 전에는 장비와 재화 유지');
  await page.click('#s-char .c7-confirm [data-confirmcancel]'); await page.clock.runFor(50);
  ok(JSON.stringify(await save()) === beforeSalvage, '분해 취소는 장비와 재화 유지');
  await page.click('#s-char [data-salv1="201"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-confirmgo]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 2 && !sv.gear.bag.some(x => x.id === 201) && sv.gear.bag.some(x => x.id === 202) && sv.gear.bag.some(x => x.id === 203) && sv.player.gold === 865 && sv.mats.stone === 3, '개별 분해는 고른 일반 장비만 제거, 골드 +5 · 강화석 +1');
  ok(!(await page.locator('#s-char .sheet').count()) && /2개/.test(await text('#s-char .c7-inventory-count')) && (await page.getAttribute('#s-char .gmats .currency-amount:first-child', 'aria-label')) === '강화석 3' && /분해: 골드 \+5/.test(await text('#s-char')), '분해 직후 인벤토리 복귀, 개수·재료·결과 안내 갱신');
  await page.click('#s-char .c7-bag[data-gitem="202"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-salv1="202"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-confirmgo]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 1 && sv.gear.bag[0].id === 203 && sv.gear.bag[0].lock && sv.player.gold === 880 && sv.mats.stone === 4, `고급 장비 개별 분해 뒤 잠긴 장비 유지, 골드 +15 · 강화석 +1 (${sv.player.gold}, ${sv.mats.stone})`);
  ok(/1개/.test(await text('#s-char .c7-inventory-count')) && (await page.locator('#s-char .c7-bag').count()) === 1 && (await page.getAttribute('#s-char .gmats .currency-amount:first-child', 'aria-label')) === '강화석 4', '남은 인벤토리 1개·강화석 4 표시');

  // ---- 인벤토리 상세에서 수동 장착 ----
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-char [data-salv1="203"]'), '남겨 둔 잠긴 아이템의 분해 보호 유지');
  await page.click('#s-char [data-equip="203"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.equipped.neck?.id === 203 && sv.gear.equipped.neck.lock && sv.gear.bag.length === 0, '상세 「장착」 → 목걸이 착용, 잠금 상태 유지');
  ok(await page.isDisabled('#s-char [data-salv1="203"]'), '방금 장착한 장비도 개별 분해 불가');
  await closeSheet();
  ok(await page.evaluate(() => document.activeElement?.id === 'gearInventoryTitle'), '마지막 아이템 장착 뒤 상세 닫기 → 빈 인벤토리 제목 포커스 복귀');
  ok(/0개/.test(await text('#s-char .c7-inventory-count')) && (await page.locator('#s-char .c7-bag').count()) === 0 && !(await page.isVisible('#s-char [data-csub="gear"] .rdot')), '빈 인벤토리 개수 0, 새 장비 빨간 점 사라짐');
  const emptyRows = await page.evaluate(() => {
    const list = document.querySelector('#s-char .c7-bags'), note = list.querySelector('.c7-inventory-empty');
    return { note: note?.textContent, empties: list.querySelectorAll('.c7-bag-empty').length, rows: Math.round(list.clientHeight / 60 * 10) / 10 };
  });
  ok(!emptyRows.note && emptyRows.empties >= 15 && emptyRows.empties % 5 === 0, `장비가 없으면 안내 문구 없이 빈칸만 3줄 이상 유지 (${JSON.stringify(emptyRows)})`);

  // ---- 가방 ▲▼ · 옵션 차이 · 빠지는 옵션 · 전설 고유 능력 (Lim 2026-10-11) ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    const it = (id, slot, kind, grade, lines, specs = []) => ({ id, slot, kind, grade, plus: 0, name: '', lines, specs });
    s.gear.bag = [it(301, 'head', 'hood', '일반', []), it(302, 'head', 'plume', '영웅', [{ stat: 'haste', roll: 1 }]), it(303, 'chest', 'mail', '전설', [{ stat: 'int', roll: 0.9 }, { stat: 'crit', roll: 0.8 }], [{ key: 'sturdyBack', roll: 1, legend: true }])];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok((await page.locator('#s-char .c7-bag[data-gitem="301"] .dn').count()) === 1 && (await page.locator('#s-char .c7-bag[data-gitem="302"] .up').count()) === 1 && /지금 장비보다 나쁨/.test(await page.getAttribute('#s-char .c7-bag[data-gitem="301"]', 'aria-label')), '인벤토리: 착용 두건보다 점수가 낮은 일반 두건 = 빨간 ▼, 높은 영웅 모자 = 초록 ▲');
  await page.locator('#s-char .c7-inventory').screenshot({ path: `${shots}/gear_bag_arrows.png` });
  await page.click('#s-char .c7-bag[data-gitem="301"]'); await page.clock.runFor(50);
  sh = await text('#s-char .c7-gsheet .c7-opts');
  ok((await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp').count()) === 1 && (await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp .c7-dn').count()) === 1 && /착용 장비 대비/.test(sh) && /빠지는 옵션/.test(sh) && /정신력\s*▼/.test(sh) && (await page.locator('#s-char .c7-gsheet .c7-spec').count()) === 0, '일반 두건 = 옵션 1줄 (특수능력 없음), 지능 ▼, 지금 장비에만 있는 정신력은 「빠지는 옵션」 ▼');
  await closeSheet();
  await page.click('#s-char .c7-bag[data-gitem="302"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp').count()) === 4 && (await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp .c7-up').count()) >= 3, '영웅 모자 = 옵션 4줄 (주 지능 · 종류 치명타 · 인내 · 무작위 가속), 차이 ▲');
  await closeSheet();
  await page.click('#s-char .c7-bag[data-gitem="303"]'); await page.clock.runFor(50);
  sh = await text('#s-char .c7-gsheet');
  ok((await page.locator('#s-char .c7-gsheet .c7-opts .c7-cmp').count()) === 4 && /고유 능력/.test(sh) && /든든한 등 \(고유\)/.test(sh) && (await page.locator('#s-char .c7-gsheet .c7-legend .c7-spec').count()) === 1, '전설 = 옵션 4줄 + 고유 능력 1줄 (특수능력 칸 이름이 「고유 능력」)');
  await page.locator('#s-char .c7-gsheet').screenshot({ path: `${shots}/gear_legend.png` });
  await closeSheet();

  // ---- 많은 아이템: 위쪽 고정 · 목록 창은 하단 메뉴 위까지 (최소 3줄) · 내부 스크롤 · 상세 복귀 ----
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
      top: el.scrollTop, max: el.scrollHeight - el.clientHeight, bodyTop: body.scrollTop, bodyMax: body.scrollHeight - body.clientHeight,
      firstFifteenFit: cells.length >= 15 && cells.slice(0, 15).every(visible),
      threeRows: new Set(cells.slice(0, 15).map(cell => Math.round(cell.top))).size === 3,
      rows: Math.round((el.clientHeight * 10) / (cells[5].top - cells[0].top)) / 10,
      fillsToMenu: tabs.top - r.bottom,
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
    // 낮은 화면(320×640)만 장비 화면을 올려 인벤토리에 접근한다. 보통 높이는 화면이 안 움직이고 첫 진입부터 3줄 이상이 보여야 한다.
    if (height < 700) await grid.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const start = await scrollState();
    ok(start.firstFifteenFit && start.threeRows && start.rows >= 3 && start.max > 0 && start.noHorizontalOverflow, `${width}: 첫 15개가 목록 창에 온전히 표시되고 나머지는 아래로 스크롤 (${JSON.stringify(start)})`);
    ok(start.onScreen, `${width}: 인벤토리 목록 창 전체가 상단 영역과 하단 메뉴 사이에 표시`);
    if (height >= 700) ok(start.bodyMax <= 1 && start.fillsToMenu <= 24, `${width}: 위쪽(장비·능력치)은 스크롤 없음, 목록 창이 하단 메뉴 바로 위까지 (${start.bodyMax} · 메뉴까지 ${Math.round(start.fillsToMenu)}px)`);
    if (height >= 900) ok(start.rows > 3.5, `${width}: 키 큰 화면은 3줄보다 더 보임 (${start.rows}줄)`);
    await page.screenshot({ path: `${shots}/gear_inventory_rows_${width}.png`, animations: 'disabled' });
    await grid.evaluate(el => el.focus({ preventScroll: true }));
    await page.keyboard.press('End'); await page.clock.runFor(400);
    // Chromium의 기본 키보드 스크롤은 가상 페이지 시계와 별도로 진행된다.
    // 실제 끝 위치와 마지막 아이템 노출을 기다린 뒤 결과를 검증한다.
    let end = await scrollState();
    // End 키의 부드러운 스크롤을 복귀 위치 비교와 같은 1px 기준까지 기다린다.
    for (let attempt = 0; attempt < 80 && (Math.abs(end.top - end.max) > 1 || !end.lastVisible); attempt++) {
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

  // ---- 아이템·빈칸 위에서 끌어도 스크롤 (Lim 2026-10-11): 손가락으로 끌면 목록만 움직이고 (2026-10-12 위쪽 고정) 상세는 안 열림, 짧게 누르면 상세 ----
  await page.click('#s-char [data-bfilter="all"]'); await page.clock.runFor(50);
  const cdp = await ctx.newCDPSession(page);
  /** 손가락으로 sel의 i번째 칸 가운데를 잡고 위로 dist만큼 (음수면 아래로) 끌기 */
  const swipe = async (sel, i, dist, steps = 12) => {
    // i = null이면 지금 목록 창 안에 온전히 보이는 칸 중 가운데 것 (목록 밖으로 밀려난 칸을 잡으면 다른 곳을 끄는 셈)
    if (i == null) i = await page.evaluate(sel => {
      const list = document.querySelector('#s-char .c7-bags').getBoundingClientRect(), tabs = document.querySelector('#tabs').getBoundingClientRect();
      const seen = [...document.querySelectorAll(`#s-char ${sel}`)].map((el, k) => [k, el.getBoundingClientRect()]).filter(([, r]) => r.top >= list.top && r.bottom <= Math.min(list.bottom, tabs.top)).map(([k]) => k);
      return seen[Math.floor(seen.length / 2)];
    }, sel);
    const box = await page.locator(`#s-char ${sel}`).nth(i).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let k = 1; k <= steps; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dist * k / steps }] }); await new Promise(r => setTimeout(r, 16)); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.clock.runFor(1500);
  };
  const where = () => page.evaluate(() => {
    const list = document.querySelector('#s-char .c7-bags'), body = document.querySelector('#s-char .ns-body'), tabs = document.querySelector('#tabs').getBoundingClientRect();
    return { list: Math.round(list.scrollTop), body: Math.round(body.scrollTop), bodyMax: body.scrollHeight - body.clientHeight, listMax: list.scrollHeight - list.clientHeight, shown: list.getBoundingClientRect().bottom <= tabs.top + 1, sheet: !!document.querySelector('#s-char .sheet') };
  });
  const reset = () => page.evaluate(() => { document.querySelector('#s-char .c7-bags').scrollTop = 0; document.querySelector('#s-char .ns-body').scrollTop = 0; });
  for (const [name, width, height] of [['S25', 360, 780], ['S25 울트라', 384, 824], ['Z 플립 펼침', 360, 880]]) {
    await page.setViewportSize({ width, height }); await page.clock.runFor(100); await reset();
    // 첫 줄 아이템을 잡고 위로: 목록 창이 처음부터 다 보이니 화면은 그대로, 목록만
    ok((await where()).shown && (await where()).bodyMax <= 1, `${name}: 첫 화면부터 목록 창 전체가 하단 메뉴 위에 보이고 바깥 화면은 스크롤 없음`);
    await swipe('.c7-bag', 1, 140);
    let w = await where();
    ok(w.list > 0 && w.body === 0 && w.shown && !w.sheet, `${name}: 아이템을 잡고 위로 끌면 목록만 스크롤 (위쪽 고정), 상세는 안 열림 (${JSON.stringify(w)})`);
    await swipe('.c7-bag', null, 1200, 24);
    w = await where();
    ok(Math.abs(w.list - w.listMax) <= 1 && w.body === 0 && w.shown && !w.sheet, `${name}: 길게 끌면 목록 끝까지, 위쪽은 그대로 (${JSON.stringify(w)})`);
    await swipe('.c7-bag', null, -1600, 24);
    w = await where();
    ok(w.list === 0 && w.body === 0 && !w.sheet, `${name}: 아래로 끌면 목록 맨 위 → 화면 맨 위 (${JSON.stringify(w)})`);
    // 빠르게 끈 바로 뒤(실제 시간)의 누름은 Chromium이 click을 안 만들 때가 있음 (main에서도 가끔): 잠깐 쉬고 누름
    await new Promise(r => setTimeout(r, 400));
    await page.locator('#s-char .c7-bag').nth(1).tap(); await page.clock.runFor(50);
    ok((await where()).sheet, `${name}: 짧게 누르면 그대로 상세`);
    await closeSheet();
  }
  await page.screenshot({ path: `${shots}/gear_inventory_drag.png`, animations: 'disabled' });
  // 마우스로 끌어도 같음, 끈 다음 누름은 다시 상세
  await page.setViewportSize({ width: 390, height: 844 }); await page.clock.runFor(100); await reset();
  const mb = await page.locator('#s-char .c7-bag').nth(2).boundingBox();
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2); await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2 - k * 12);
  await page.mouse.up(); await page.clock.runFor(100);
  let w = await where();
  ok(w.list > 0 && !w.sheet, `마우스로 아이템을 끌어도 목록 스크롤, 상세 안 열림 (${JSON.stringify(w)})`);
  await page.locator('#s-char .c7-bag').nth(5).click(); await page.clock.runFor(50);
  ok((await where()).sheet, '끈 다음 클릭은 다시 상세를 엶');
  await closeSheet();
  // 아이템이 적어 목록이 안 넘칠 때: 셋째 줄 빈칸까지 첫 화면에 보이고, 빈칸을 끌어도 아무것도 안 움직임
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.gear.bag = s.gear.bag.slice(0, 7);
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.setViewportSize({ width: 360, height: 780 }); await page.clock.runFor(100); await reset();
  w = await where();
  ok(w.shown && w.bodyMax <= 1 && w.listMax === 0 && (await page.locator('#s-char .c7-bag-empty').count()) === 8, `S25 첫 화면: 아이템 7개 + 빈칸 8개 = 3줄이 하단 메뉴 위에 다 보임 (${JSON.stringify(w)})`);
  await swipe('.c7-bag-empty', 0, 160);
  w = await where();
  ok(w.body === 0 && w.list === 0 && w.shown && !w.sheet, `S25: 빈칸을 잡고 위로 끌어도 화면 · 목록 그대로 (${JSON.stringify(w)})`);
  // Z 플립 펼침: 목록 창이 3줄보다 길면 보이는 줄 끝까지 빈칸으로 채움 (창 아래가 비지 않게), 창 크기가 바뀌면 다시 맞춤
  await page.setViewportSize({ width: 360, height: 880 }); await page.clock.runFor(100);
  const tall = await page.evaluate(() => {
    const list = document.querySelector('#s-char .c7-bags'), r = list.getBoundingClientRect(), cells = [...list.children].map(c => c.getBoundingClientRect());
    return { cells: cells.length, coversWindow: cells[cells.length - 1].bottom >= r.bottom - 7, max: list.scrollHeight - list.clientHeight };
  });
  ok(tall.cells === 20 && tall.coversWindow && tall.max < 60, `Z 플립 펼침: 3줄보다 긴 창은 빈칸이 창 끝까지 (${JSON.stringify(tall)})`);

  // 개발 옵션: 실제 설정 입력 → 새로 고침 → 잔액 0 강화/구매 → 옵션 해제.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.gold = 0; s.mats = { stone: 0, refined: 0 };
    s.settings.devGold = false; s.settings.devStones = false;
    s.gear.equipped.head = { id: 901, slot: 'head', kind: 'hood', grade: '영웅', plus: 2, top: 3, lv: 30,
      lines: [{ stat: 'crit', roll: 0.8, up: 0.02 }, { stat: 'haste', roll: 0.8 }], specs: [], name: '' };
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#s-lobby [data-go="s-settings"]'); await page.clock.runFor(100);
  await page.locator('[data-tog="devGold"]').check();
  await page.locator('[data-tog="devStones"]').check();
  await page.clock.runFor(100);
  ok((await save()).settings.devGold && (await save()).settings.devStones, '설정에서 골드·강화석 무제한을 각각 켜고 저장');
  ok((await text('#s-settings .tb-gold b')).trim() === '∞', '설정의 골드 보유량도 ∞');
  await page.locator('#s-settings .group.dev').screenshot({ path: `${shots}/resources_unlimited_settings.png` });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok((await text('#s-char .tb-gold b')).trim() === '∞' && (await page.locator('#s-char .gmats b').allTextContents()).every(v => v === '∞'), '새로 켜도 무한 설정 유지: 상단 골드·인벤토리 두 재료 ∞');
  await page.click('#s-char [data-gitem="901"]'); await page.clock.runFor(50);
  ok(!/각성/.test(await text('#s-char .c7-gsheet')) && !(await save()).gear.equipped.head.lines.some(l => 'up' in l), '이전 각성 추가값과 각성 표시 제거');
  const oldLines = JSON.stringify((await save()).gear.equipped.head.lines);
  await page.click('#s-char [data-enh="901"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-confirm [data-have]').allTextContents()).every(v => v === '∞') && !(await page.isDisabled('#s-char [data-confirmgo]')), '실제 잔액 0이어도 팝업의 골드·강화석 ∞, 강화 가능');
  await page.locator('#s-char .c7-confirm').screenshot({ path: `${shots}/resources_unlimited_enhance.png` });
  await page.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0; });
  await page.click('#s-char [data-confirmgo]'); await page.clock.runFor(50);
  ok(await page.isVisible('#gearEnhanceFx [data-enhance-fx="success"]') && !/각성/.test(await text('#gearEnhanceFx')), '+3 성공 연출 유지, 각성 연출·문구 없음');
  await page.clock.runFor(4000);
  await page.evaluate(() => { Math.random = window.__rnd; });
  let unlimitedSave = await save();
  ok(unlimitedSave.gear.equipped.head.plus === 3 && JSON.stringify(unlimitedSave.gear.equipped.head.lines) === oldLines && unlimitedSave.player.gold === 0 && unlimitedSave.mats.stone === 0, '무한 강화 후 단계만 상승하고 무작위 옵션·실제 재화는 그대로');
  ok(await page.isVisible('#s-char .c7-confirm') && !/각성/.test(await text('#s-char .c7-confirm')), '결과 팝업 유지 및 각성 문구 제거');
  await page.click('#s-char .c7-confirm [data-confirmcancel]'); await page.clock.runFor(50);
  await page.click('#s-char .c7-gsheet button[data-sheetx]'); await page.clock.runFor(50);
  // 상점 골드 탭 (소비 아이템)은 2026-10-16 없앰: 설정에서 무한 재화를 끄고 실제 잔액만 확인
  await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(100);
  await page.click('#s-shop [data-go="s-settings"]'); await page.clock.runFor(100);
  await page.locator('[data-tog="devGold"]').uncheck();
  await page.locator('[data-tog="devStones"]').uncheck();
  await page.click('#s-settings .tb-back'); await page.clock.runFor(100);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok((await text('#s-char .tb-gold b')).trim() === '0' && (await page.locator('#s-char .gmats b').allTextContents()).every(v => v === '0'), '설정 해제 후 실제 골드·강화석 0 표시');
  await page.click('#s-char [data-gitem="901"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-enh="901"]'); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-char [data-confirmgo]') && /골드 부족/.test(await text('#s-char .c7-confirm')), '설정 해제 시 비용 부족으로 강화 차단');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
