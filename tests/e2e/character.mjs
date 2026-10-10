// 캐릭터 탭 (27 4장, 31 시안): 하위 탭 4칸 · 장비(받침대 문장·이름표·장비 칸 6개·능력치 판) · 스킬(설명·휠 배치·칸 탭·단축칸·줄 목록) · 특성(나무판)
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

  // ---- 하위 탭 · 장비 (기본) ----
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char [data-csub="gear"]', 'aria-selected') === 'true', '캐릭터 탭 = 장비부터');
  ok((await page.locator('#s-char nav .c7-tab .c7-tic').count()) === 4 && (await page.locator('#s-char nav [data-csub="hero"] .emblem').count()) === 1, '하위 탭 4칸 = 아이콘 + 이름 (직업 칸 = 직업 문장)');
  const plq = await flat('#s-char .c7-plq');
  ok(/장비점수0/.test(plq) && /장비없음/.test(plq), `받침대 이름표 = 장비 점수 · 평균 등급 (${plq})`);
  ok((await page.locator('#s-char .c7-stage .c7-bigem .emblem').count()) === 1 && /사제/.test(await text('#s-char .topbar .tb-cls')), '받침대 위 큰 직업 문장 1개, 위 줄 = 사제');
  const stats = await flat('#s-char .c7-stats');
  ok(/체력220/.test(stats) && /지능120/.test(stats) && /정신력/.test(stats) && /인내/.test(stats) && !/세트/.test(stats), `능력치 판: 체력 220 · 지능 120 (34 1-2: 숫자 ÷2.5), 정신력 · 인내, 세트 칸 없음 (${stats})`);
  ok((await page.locator('#s-char .c7-stat').count()) === 6 && (await page.locator('#s-char .gtile').count()) === 6 && (await page.locator('#s-char .gtile.empty').count()) === 6, '능력치 6칸, 착용 6칸 (다 빈칸)');
  ok((await page.locator('#s-char .c7-sq img.g-ic').count()) === 6 && (await page.locator('#s-char .c7-stat .c7-si img.g-ic').count()) === 6 && (await page.locator('#s-char nav .c7-tic img.g-ic').count()) === 3, '31 그림: 장비 칸 item- 6장 (무기·목걸이는 40 다시 그린 그림), 능력치 stat- 6장 (인내 stat-stamina 포함), 하위 탭 icon-gear·skills·talent');
  await page.screenshot({ path: `${shots}/char_gear.png` });

  // ---- 스킬: Lv 1 ----
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-sk').count()) === 9, '스킬 줄 7 + 성언 줄 + 패시브 줄');
  ok((await page.locator('#s-char .c7-wheel .c7-wh .c7-si').count()) === 7 && (await page.locator('#s-char .c7-wh.core').count()) === 1 && (await page.locator('#s-char .c7-mcircle').count()) === 1, '휠 = 메달 7개에 스킬 그림(없으면 선 아이콘) + 가운데 마나 구슬 + 마법진');
  ok((await page.locator('#s-char .c7-wheel .c7-si img.g-ic').count()) === 7 && (await page.locator('#s-char .c7-mcircle img.g-ic').count()) === 1 && (await page.locator('#s-char .c7-ski img.g-ic').count()) === 8, '31 그림: 휠 메달 skill- 7장, 마법진 ui-magic-circle (40 다시 그린 그림), 스킬 줄 그림 (패시브 줄은 선 아이콘)');
  ok((await page.locator('#s-char .c7-sk.locked').count()) === 6 && (await page.locator('#s-char .lslot.locked').count()) === 5, 'Lv 1: 치유·순간 치유만 열림 (휠 5칸·성언 잠김)');
  ok(/Lv 2/.test(await text('#s-char .c7-sk[data-skill="renew"]')), '잠긴 스킬엔 배우는 레벨');
  ok(await page.getAttribute('#s-char [data-smode="view"]', 'aria-pressed') === 'true', '처음은 「설명 보기」');
  const h0 = await page.evaluate(() => document.querySelector('#s-char .c7-sdesc').getBoundingClientRect().height);
  await page.click('#s-char [data-ldir="NE"]'); await page.clock.runFor(50);
  const desc = await text('#s-char .c7-sdesc');
  ok(/치유/.test(desc) && /시전 2\.5초/.test(desc) && /칸 탭/.test(desc) && await page.isVisible('#s-char .c7-sk.on[data-skill="heal"]'), '휠 칸을 누르면 아래 설명 칸 + 줄 목록 표시');
  const h1 = await page.evaluate(() => document.querySelector('#s-char .c7-sdesc').getBoundingClientRect().height);
  ok(h0 === h1 && h1 >= 112, `설명 칸 높이 고정 (${h0} / ${h1})`);
  await page.click('#s-char .c7-sk[data-skill="flash"]'); await page.clock.runFor(50);
  ok(/지능의 83% \(100\) 회복/.test(await text('#s-char .c7-skd')) && await page.getAttribute('#s-char .c7-sk[data-skill="flash"]', 'aria-expanded') === 'true', '스킬 줄을 누르면 설명 펼침');
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
  const t1 = await text('#s-char .c7-tier:first-child');
  ok(/긴 숨결/.test(t1) && /넓은 원/.test(t1) && (await page.locator('#s-char .c7-tier:first-child .c7-pk.off .ui-icon').count()) === 3 && (await page.locator('#s-char [data-tcell]').count()) === 0 && /Lv 5에 열림/.test(await text('#s-char .c7-tsum')), '잠긴 단 = 메달마다 자물쇠 + 이름 (누를 수 없음), Lv 5에 열림');
  await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(50);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char [data-csub="talent"]', 'aria-selected') === 'true', '다른 탭에 갔다 와도 보던 하위 탭');
  await patchSave(page, { player: { level: 25 } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.click('#s-char [data-csub="talent"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-tier.locked').count()) === 5 && /5단 열림 · 0개 고름 · 5개 남음/.test(await text('#s-char .c7-tsum')), 'Lv 25 = 5단 열림 (5레벨마다 한 단), 아직 안 고름');
  ok((await page.locator('#s-char .c7-tier.pending').count()) === 5 && (await page.locator('#s-char .c7-tier:first-child [data-tcell]').count()) === 3, '안 고른 열린 단 = 줄 금테 + 칸 3개');
  ok(await page.isVisible('#s-char [data-csub="talent"] .rdot') && (await page.locator('#s-char .c7-pre').count()) === 3, '남은 특성 = 특성 탭 빨간 점, 프리셋 3칸');
  await page.click('#s-char [data-tcell="1:0"]'); await page.clock.runFor(50);
  ok(/벼랑 끝 손길/.test(await text('#s-char .c7-tsheet')) && /Lv 10/.test(await text('#s-char .c7-tsheet')) && /고르기/.test(await text('#s-char .c7-tsheet [data-talent="1:0"]')), '칸을 누르면 아래 시트 (이름·Lv·주제·설명·고르기)');
  await page.screenshot({ path: `${shots}/char_talent.png` });
  await page.click('#s-char .c7-tsum'); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-char .c7-tsheet')), '시트 밖을 누르면 닫힘');
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-sk.locked').count()) === 0 && (await page.locator('#s-char .lslot.locked').count()) === 0, 'Lv 25 = 스킬·패시브 다 열림');
  await page.screenshot({ path: `${shots}/char_skill_lv25.png`, fullPage: false });
  await page.click('#s-char [data-csub="gear"]'); await page.clock.runFor(50);
  const st25 = await flat('#s-char .c7-stats');
  ok(/체력1,382/.test(st25) && /지능754/.test(st25), `Lv 25 = 체력 220 × 6.28 · 지능 120 × 6.28 (34 1-2 레벨 배율) (${st25.slice(0, 60)})`);
  await page.click('#s-char .c7-stats'); await page.clock.runFor(50);
  const src = await text('#s-char .c7-ssheet');
  ok(/기본 220/.test(src) && /레벨 \+1,162/.test(src) && /지능/.test(src) && /특성/.test(src) && !/세트/.test(src), '능력치 판을 누르면 출처 시트 (기본·레벨·장비·특성)');
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
