// 장비 (27 4-2·4-3, 09 S10·S11, 31 시안): 받침대 좌우 장비 칸, 세트 깃발·시트, 상세 시트(비교·강화·잠금), 가방 시트(필터·정렬·분해 고르기, 두 번 눌러 분해), 추천 장착
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
    const it = (id, slot, grade, set, plus = 0) => ({ id, slot, grade, plus, name: set ? `새벽 순례자의 ${slot}` : `${grade} ${slot}`, ...(set ? { set: 'dawn' } : {}) });
    s.player.level = 30; s.player.gold = 1000; s.mats = { stone: 3, refined: 0 };
    s.gear.equipped = { head: it(101, 'head', '희귀', true), chest: it(102, 'chest', '희귀', true), weapon: it(103, 'weapon', '고급', false) };
    s.gear.bag = [it(201, 'hands', '일반', false), it(202, 'ring', '고급', false), it(203, 'neck', '희귀', true)];
    s.gear.seen = 0;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  const set = await text('#s-char .c7-set');
  ok(/새벽 순례자/.test(set) && /2\/4/.test(set) && /2세트 · 지속 힐 \+15%/.test(set) && (await page.locator('#s-char .c7-boxes i.on').count()) === 2, '세트 깃발 2/4 (칸 2개 켜짐) + 켜진 효과 짧게');
  await page.click('#s-char .c7-set[data-set="dawn"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-setsheet') && (await page.locator('#s-char .c7-setsheet p.on').count()) === 1 && (await page.locator('#s-char .c7-setslots .on').count()) === 2, '세트 깃발을 누르면 세트 시트: 2세트 효과 켜짐, 착용한 부위 2칸');
  await closeSheet();
  ok(/장비 점수\s*80/.test(await text('#s-char .c7-plq')) && /새벽 순례자 2\/4/.test(await text('#s-char .c7-plq')) && /새벽 2\/4/.test(await text('#s-char .c7-stats')), '받침대 이름표 장비 점수 80 (희귀 30 · 희귀 30 · 고급 20) · 세트 2/4, 능력치 판 세트 칸');

  // ---- 받침대 좌우 장비 칸 ----
  const t101 = await text('#s-char .gtile[data-gitem="101"]');
  ok((await page.locator('#s-char .gtile').count()) === 6 && /희/.test(await text('#s-char .gtile[data-gitem="101"] .c7-gl')) && /머리/.test(t101) && /힐 \+/.test(t101), '장비 칸 6개: 장비 그림(없으면 부위 아이콘) + 등급 글자 칩 + 부위 · 힐량');
  ok((await page.locator('#s-char .gtile[data-gitem="101"] .c7-setdot').count()) === 1, '세트 장비 = 세트 표시');
  ok(/가방에 1개/.test(await text('#s-char .gtile[data-gslot="hands"]')) && (await page.locator('#s-char .gtile[data-gslot="hands"] .c7-better').count()) === 1 && await page.isVisible('#s-char [data-csub="gear"] .rdot'), '빈칸 = 가방 개수 + 초록 ↑, 장비 탭 빨간 점');
  ok(/가방\s*3/.test(await text('#s-char [data-bag]')) && (await text('#s-char [data-bag] .g-badge')).trim() === '3', '「가방」 팻말 = 개수 + 빨간 숫자 (더 좋은 장비 부위 3)');

  // ---- 가방 시트 ----
  await page.click('#s-char [data-bag]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-bsheet') && /강화석 3/.test(await text('#s-char .gmats')), '「가방」 = 가방 시트, 재료 표시');
  ok((await page.locator('#s-char .c7-bag').count()) === 3 && (await page.locator('#s-char .c7-bag .nw').count()) === 3 && (await page.locator('#s-char .c7-bag .up').count()) === 3, '가방 5열 격자: 새것 점 · ↑');
  await page.click('#s-char [data-bfilter="acc"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag').count()) === 2, '필터 「장신구」 = 반지·목걸이');
  await page.click('#s-char [data-bfilter="set"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-bag').count()) === 1, '필터 「세트」');
  await page.click('#s-char [data-bfilter="all"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  ok(/등급순/.test(await text('#s-char [data-bsort]')), '정렬 버튼 = 점수 → 등급 → 새것');
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char .c7-bag:first-child', 'data-gitem') === '203', '새것순 = 최근 장비 먼저');
  await page.click('#s-char [data-bsort]'); await page.clock.runFor(50);
  await page.screenshot({ path: `${shots}/gear_list.png` });
  await closeSheet();

  // ---- 상세 시트 · 강화 ----
  await page.click('#s-char .gtile[data-gitem="101"]'); await page.clock.runFor(50);
  let sh = await text('#s-char .c7-gsheet');
  ok(await page.isVisible('#s-char .c7-gsheet') && /\+0 → \+1/.test(sh) && /골드 40/.test(sh) && /가진 것 3/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '강화', '착용 장비 누르면 아래 시트: 강화 비용·가진 강화석, 주 버튼 「강화」');
  await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.gear.equipped.head.plus === 1 && sv.player.gold === 960 && sv.mats.stone === 2, '강화 +1: 골드 40·강화석 1 씀');
  await page.click('#s-char [data-enh="101"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.equipped.head.plus === 2 && sv.player.gold === 800 && await page.isDisabled('#s-char [data-enh="101"]') && /강화석 부족/.test(await text('#s-char .c7-gsheet')), '+2 (골드 160·강화석 2), 강화석이 모자라면 버튼 꺼짐 + 이유');
  await page.locator('#s-char .c7-gsheet').screenshot({ path: `${shots}/gear_detail.png` });
  await closeSheet();
  ok(!(await page.isVisible('#s-char .sheet')), '시트 바깥을 누르면 닫힘');

  // ---- 가방 장비: 비교 · 잠금 ----
  await page.click('#s-char [data-bag]'); await page.clock.runFor(50);
  await page.click('#s-char .c7-bag[data-gitem="203"]'); await page.clock.runFor(50);
  sh = await text('#s-char .c7-gsheet');
  ok(/지금 장비와 비교/.test(sh) && /빈칸/.test(sh) && /2\/4 → 3\/4/.test(sh) && /새로 얻음/.test(sh) && (await text('#s-char .c7-gsheet .c7-cta')).trim() === '장착', '가방 장비 = 비교 ▲ · 세트 2/4 → 3/4 · 새로 얻음, 주 버튼 「장착」');
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
  ok(sv.gear.bag.length === 1 && sv.gear.bag[0].id === 203 && sv.player.gold === 800 + 40 && sv.mats.stone === 0 + 3, `두 번째 = 분해: 골드 +40, 강화석 +3 (${sv.player.gold}, ${sv.mats.stone})`);
  ok(/2개 분해/.test(await text('#s-char')), '분해 결과 안내');
  await closeSheet();
  await page.click('#s-char [data-salvbag]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-bsheet .c7-bags.picking') && await page.isVisible('#s-char [data-salvgo]'), '아래 「분해」 팻말 = 가방 시트를 분해 고르기로 엶');
  await closeSheet();

  // ---- 추천 장착 ----
  await page.click('#s-char [data-rec]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-rsheet') && /목걸이/.test(await text('#s-char .c7-rsheet')) && /80 → 112|82 → 112/.test(await text('#s-char .c7-rsheet')), '추천 장착 = 바뀌는 칸을 먼저 보여 줌 (장비 점수 → 바꾼 뒤)');
  await page.click('#s-char [data-recgo]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.equipped.neck?.id === 203 && sv.gear.bag.length === 0 && (await page.locator('#s-char .c7-boxes i.on').count()) === 3, '「바꾸기」 = 목걸이 장착, 세트 3/4');
  ok(await page.isDisabled('#s-char [data-rec]') && !(await page.isVisible('#s-char [data-csub="gear"] .rdot')), '바꿀 것 없으면 추천 장착 꺼짐, 빨간 점 없음');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
