// 캐릭터 탭 (27 4장): 공통 머리 · 장비(능력치 판·목록형 6칸) · 스킬(설명·휠 배치·칸 탭·단축칸·줄 목록) · 특성
import { chromium } from 'playwright';
import { pastTitle, patchSave } from './nav.mjs';

export default async function character(url, shots) {
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
  const flat = async sel => (await text(sel)).replace(/\s/g, '');
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // ---- 공통 머리 · 장비 (기본) ----
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char [data-csub="gear"]', 'aria-selected') === 'true', '캐릭터 탭 = 장비부터');
  const head = await flat('#s-char .c7-head');
  ok(/^사제Lv1/.test(head) && /해제질병마법독저주/.test(head) && /장비점수0/.test(head), `머리 = 사제 · Lv · 해제 · 장비 점수 (${head})`);
  ok((await page.locator('#s-char .c7-head .emblem').count()) === 1 && (await page.locator('#s-char .c7-head .dsp.off').count()) === 2, '머리: 직업 문장 1개, 못 지우는 해제 2개 (독·저주)');
  const stats = await flat('#s-char .c7-stats');
  ok(/체력550/.test(stats) && /힐량×1\.00/.test(stats) && !/세트/.test(stats), `능력치 판: 체력 550, 힐량 ×1.00, 세트 칸 없음 (${stats})`);
  ok((await page.locator('#s-char .c7-stat').count()) === 5 && (await page.locator('#s-char .gtile').count()) === 6 && (await page.locator('#s-char .gtile.empty').count()) === 6, '능력치 5칸, 착용 6칸 (다 빈칸)');
  await page.screenshot({ path: `${shots}/char_gear.png` });

  // ---- 스킬: Lv 1 ----
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-sk').count()) === 9, '스킬 줄 7 + 성언 줄 + 패시브 줄');
  ok((await page.locator('#s-char .c7-sk.locked').count()) === 6 && (await page.locator('#s-char .lslot.locked').count()) === 5, 'Lv 1: 치유·순간 치유만 열림 (휠 5칸·성언 잠김)');
  ok(/Lv 2/.test(await text('#s-char .c7-sk[data-skill="renew"]')), '잠긴 스킬엔 배우는 레벨');
  ok(await page.getAttribute('#s-char [data-smode="view"]', 'aria-pressed') === 'true', '처음은 「설명 보기」');
  const h0 = await page.evaluate(() => document.querySelector('#s-char .c7-sdesc').getBoundingClientRect().height);
  await page.click('#s-char [data-ldir="NE"]'); await page.clock.runFor(50);
  const desc = await text('#s-char .c7-sdesc');
  ok(/치유/.test(desc) && /시전 1\.8초/.test(desc) && /칸 탭/.test(desc) && await page.isVisible('#s-char .c7-sk.on[data-skill="heal"]'), '휠 칸을 누르면 아래 설명 칸 + 줄 목록 표시');
  const h1 = await page.evaluate(() => document.querySelector('#s-char .c7-sdesc').getBoundingClientRect().height);
  ok(h0 === h1 && h1 >= 112, `설명 칸 높이 고정 (${h0} / ${h1})`);
  await page.click('#s-char .c7-sk[data-skill="flash"]'); await page.clock.runFor(50);
  ok(/250 회복/.test(await text('#s-char .c7-skd')) && await page.getAttribute('#s-char .c7-sk[data-skill="flash"]', 'aria-expanded') === 'true', '스킬 줄을 누르면 설명 펼침');
  await page.screenshot({ path: `${shots}/char_skill_lv1.png` });

  // ---- 스킬: 배치 바꾸기 ----
  await page.click('#s-char [data-smode="swap"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-wheel.swapping') && await page.isDisabled('#layReset'), '배치 바꾸기 모드, 기본 배치면 「기본 배치로」 꺼짐');
  await page.click('#s-char [data-ldir="NE"]'); await page.click('#s-char [data-ldir="NW"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.settings.layout && sv.settings.layout.NW === 'heal' && sv.settings.layout.NE === null, '↗ 치유 ↔ ↖ 빈자리 → 저장');
  ok(/↖/.test(await text('#s-char .c7-sk[data-skill="heal"]')), '줄 목록의 휠 방향도 바뀜');
  await page.screenshot({ path: `${shots}/char_swap.png` });
  await page.click('#layReset'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.settings.layout === null, '「기본 배치로」');
  await page.click('#s-char [data-smode="view"]'); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-char .c7-wheel.swapping')), '「설명 보기」 = 보기 모드');

  // ---- 칸 탭 기본 힐·단축칸 ----
  ok(await page.isDisabled('#s-char [data-tap="renew"]'), 'Lv 1: 칸 탭 「소생」 잠금');
  await page.click('#s-char [data-tap="flash"]'); await page.clock.runFor(50);
  ok((await save()).settings.tapKey === 'flash' && await page.getAttribute('#s-char [data-tap="flash"]', 'aria-pressed') === 'true', '칸 탭 기본 힐 = 순간 치유 저장');
  await page.click('#s-char [data-tap="heal"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-item').count()) === 2 && /마나/.test(await text('#s-char .c7-items')), '단축칸 2칸 (Lv 1)');
  await page.click('#s-char [data-islot="1"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-isheet'), '단축칸을 누르면 고르기 시트');
  await page.click('#s-char .c7-isheet [data-item="medit"]'); await page.clock.runFor(50);
  ok(/가득 참/.test(await text('#s-char .c7-isheet .note.warn')), '단축칸 2칸이 차면 안내');
  await page.click('#s-char .c7-isheet [data-item="life"]'); await page.click('#s-char .c7-isheet [data-item="medit"]'); await page.clock.runFor(50);
  ok((await save()).items.join() === 'mana,medit', '단축칸 바꾸기 저장 (생명 → 명상)');
  await page.click('#s-char .sheet-dim', { position: { x: 20, y: 120 } }); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-char .sheet')) && /명상/.test(await text('#s-char .c7-items')), '시트 바깥을 누르면 닫힘, 단축칸에 명상');

  // ---- 설정에서 캐릭터 → 스킬로 ----
  await page.click('#s-char .tb-set'); await page.clock.runFor(100);
  ok(!(await page.isVisible('#s-settings .lslot')), '설정엔 스킬 배치 없음');
  await page.click('#toSkills'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char [data-csub="skill"]', 'aria-selected') === 'true', '설정 「→ 캐릭터」 = 캐릭터 스킬');

  // ---- 특성: Lv 1 / Lv 25 ----
  await page.click('#s-char [data-csub="talent"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-tier').count()) === 10 && (await page.locator('#s-char .c7-tier.locked').count()) === 10, '특성 10단, Lv 1은 다 잠김');
  ok(/긴 숨결 · 가벼운 손끝 · 넓은 원/.test(await text('#s-char .c7-tier:first-child')) && /Lv 10에 열림/.test(await text('#s-char .c7-tsum')), '잠긴 단 = 자물쇠 + 이름 나열, Lv 10에 열림');
  await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(50);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char [data-csub="talent"]', 'aria-selected') === 'true', '다른 탭에 갔다 와도 보던 하위 탭');
  await patchSave(page, { player: { level: 25 } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.click('#s-char [data-csub="talent"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-tier.locked').count()) === 8 && /2단 열림 · 0개 고름 · 2개 남음/.test(await text('#s-char .c7-tsum')), 'Lv 25 = 2단 열림, 아직 안 고름');
  ok((await page.locator('#s-char .c7-tier.pending').count()) === 2 && (await page.locator('#s-char .c7-tier:first-child [data-tcell]').count()) === 3, '안 고른 열린 단 = 줄 금테 + 칸 3개');
  ok(await page.isVisible('#s-char [data-csub="talent"] .rdot') && (await page.locator('#s-char .c7-pre').count()) === 3, '남은 특성 = 특성 탭 빨간 점, 프리셋 3칸');
  await page.click('#s-char [data-tcell="1:0"]'); await page.clock.runFor(50);
  ok(/벼랑 끝 손길/.test(await text('#s-char .c7-tsheet')) && /Lv 20/.test(await text('#s-char .c7-tsheet')) && /고르기/.test(await text('#s-char .c7-tsheet [data-talent="1:0"]')), '칸을 누르면 아래 시트 (이름·Lv·주제·설명·고르기)');
  await page.screenshot({ path: `${shots}/char_talent.png` });
  await page.click('#s-char .c7-tsum'); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-char .c7-tsheet')), '시트 밖을 누르면 닫힘');
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-sk.locked').count()) === 0 && (await page.locator('#s-char .lslot.locked').count()) === 0, 'Lv 25 = 스킬·패시브 다 열림');
  await page.screenshot({ path: `${shots}/char_skill_lv25.png`, fullPage: false });
  await page.click('#s-char [data-csub="gear"]'); await page.clock.runFor(50);
  const st25 = await flat('#s-char .c7-stats');
  const hm = st25.match(/힐량×(\d+\.\d\d)/);
  ok(/체력1,606/.test(st25) && hm && Number(hm[1]) >= 2.92, `Lv 25 = 체력 550 × 2.92, 힐량에 레벨 배율 (${st25.slice(0, 60)})`);
  await page.click('#s-char .c7-stats'); await page.clock.runFor(50);
  const src = await text('#s-char .c7-ssheet');
  ok(/기본 550/.test(src) && /레벨 \+1,056/.test(src) && /특성/.test(src) && !/세트/.test(src), '능력치 판을 누르면 출처 시트 (기본·레벨·장비·특성)');
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
