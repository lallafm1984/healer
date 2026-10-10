// 장비 (27 4-2·4-3, 09 S10·S11, 31 시안): 받침대 좌우 장비 칸, 상세 시트(비교·강화·잠금), 가방 시트(필터·정렬·분해 고르기, 두 번 눌러 분해), 추천 장착. 세트 없음 (옛 저장의 세트 장비도 보통 장비로)
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
  ok(/장비 점수\s*85/.test(await text('#s-char .c7-plq')) && (await page.locator('#s-char .c7-stat').count()) === 6, '받침대 이름표 장비 점수 85 (희귀 32 · 희귀 32 · 고급 21: 등급 + 옛 장비 이전 때 굴린 추가 옵션 · 특수능력), 능력치 판 6칸');

  // ---- 받침대 좌우 장비 칸 ----
  const t101 = await text('#s-char .gtile[data-gitem="101"]');
  ok((await page.locator('#s-char .gtile').count()) === 6 && /희/.test(await text('#s-char .gtile[data-gitem="101"] .c7-gl')) && /머리/.test(t101) && /두건/.test(t101), '장비 칸 6개: 장비 그림(없으면 부위 아이콘) + 등급 글자 칩 + 부위 · 종류 (옛 장비 = 부위 첫 종류)');
  ok(/가방에 1개/.test(await text('#s-char .gtile[data-gslot="hands"]')) && (await page.locator('#s-char .gtile[data-gslot="hands"] .c7-better').count()) === 1 && await page.isVisible('#s-char [data-csub="gear"] .rdot'), '빈칸 = 가방 개수 + 초록 ↑, 장비 탭 빨간 점');
  ok(/가방\s*3/.test(await text('#s-char [data-bag]')) && (await text('#s-char [data-bag] .g-badge')).trim() === '3', '「가방」 팻말 = 개수 + 빨간 숫자 (더 좋은 장비 부위 3)');

  // ---- 가방 시트 ----
  await page.click('#s-char [data-bag]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-bsheet') && /강화석 8/.test(await text('#s-char .gmats')), '「가방」 = 가방 시트, 재료 표시');
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
  ok(await page.isVisible('#s-char .c7-bsheet') && !(await page.isVisible('#s-char .c7-codex')), '도감을 닫으면 가방으로');
  await closeSheet();

  // ---- 상세 시트 · 강화 ----
  await page.click('#s-char .gtile[data-gitem="101"]'); await page.clock.runFor(50);
  let sh = await text('#s-char .c7-gsheet');
  ok(await page.isVisible('#s-char .c7-gsheet') && /\+0 → \+1/.test(sh) && /골드 10/.test(sh) && /가진 것 8/.test(sh) && /성공 100%/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '강화', '착용 장비 누르면 아래 시트: 강화 비용·가진 강화석·성공 확률, 주 버튼 「강화」');
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
  await page.click('#s-char [data-bag]'); await page.clock.runFor(50);
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  sh = await text('#s-char .c7-gsheet');
  ok(/지금 장비와 비교/.test(sh) && /빈칸/.test(sh) && !/세트/.test(sh) && /새로 얻음/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '장착', '가방 장비 = 비교 ▲ · 새로 얻음 (세트 줄 없음), 주 버튼 「장착」');
  ok((await page.locator('#s-char .c7-gsheet .c7-up').count()) >= 3, '빈칸과 비교하면 모두 ▲');
  await page.click('#s-char [data-lock="203"]'); await page.clock.runFor(50);
  ok((await save()).gear.bag.find(x => x.id === 203).lock === true && await page.getAttribute('#s-char [data-lock="203"]', 'aria-pressed') === 'true' && await page.isDisabled('#s-char [data-salv1="203"]'), '잠금 → 저장, 분해 버튼 꺼짐');
  await closeSheet();
  ok(await page.isVisible('#s-char .c7-bsheet') && (await page.locator('#s-char .c7-bag[data-gitem="203"] .lk').count()) === 1, '가방에서 연 상세를 닫으면 가방으로, 가방 칸에 자물쇠');

  // ---- 분해 ----
  await page.click('#s-char [data-salvon]'); await page.clock.runFor(50);
  await page.click('#s-char [data-salvall]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag.on').count()) === 2, '「일반·고급 모두」 = 2개 고름');
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag.on').count()) === 2 && /잠긴 장비/.test(await text('#s-char .c7-msg')), '잠긴 장비는 고를 수 없음');
  await page.click('#s-char .c7-bag[data-gitem="201"]'); await page.clock.runFor(50);
  await page.click('#s-char .c7-bag[data-gitem="201"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag.on').count()) === 2, '눌러서 고르기·풀기');
  await page.click('#s-char [data-salvgo]'); await page.clock.runFor(50);
  ok(/한 번 더/.test(await text('#s-char [data-salvgo]')) && (await save()).gear.bag.length === 3, '첫 누름 = 확인만');
  await page.locator('#s-char .c7-bagsec').screenshot({ path: `${shots}/gear_salvage.png` });
  await page.click('#s-char [data-salvgo]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 1 && sv.gear.bag[0].id === 203 && sv.player.gold === 820 + 20 && sv.mats.stone === 0 + 2, `두 번째 = 분해: 골드 +20, 강화석 +2 (34 6-8 절반) (${sv.player.gold}, ${sv.mats.stone})`);
  ok(/2개 분해/.test(await text('#s-char')), '분해 결과 안내');
  await closeSheet();
  await page.click('#s-char [data-salvbag]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-bsheet .c7-bags.picking') && await page.isVisible('#s-char [data-salvgo]'), '아래 「분해」 팻말 = 가방 시트를 분해 고르기로 엶');
  await closeSheet();

  // ---- 추천 장착 ----
  await page.click('#s-char [data-rec]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-rsheet') && /목걸이/.test(await text('#s-char .c7-rsheet')) && /87 → 119/.test(await text('#s-char .c7-rsheet')), '추천 장착 = 바뀌는 칸을 먼저 보여 줌 (장비 점수 → 바꾼 뒤)');
  await page.click('#s-char [data-recgo]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.equipped.neck?.id === 203 && sv.gear.bag.length === 0, '「바꾸기」 = 목걸이 장착');
  ok(await page.isDisabled('#s-char [data-rec]') && !(await page.isVisible('#s-char [data-csub="gear"] .rdot')), '바꿀 것 없으면 추천 장착 꺼짐, 빨간 점 없음');

  // ---- 장비 도감 보상 (10칸마다) ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.gear.dex = [...s.gear.dex, 'k:mace', 'k:helm', 'k:crown', 'k:wand', 'l:fairy:jade', 'u:guardianHelm'];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.click('#s-char [data-bag]'); await page.clock.runFor(50);
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

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
