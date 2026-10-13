// 캐릭터 탭 (27 4장, 31 시안): 하위 탭 4칸 · 장비(받침대 문장·이름표·장비 칸 6개·능력치 판) · 스킬(설명·휠 배치·칸 탭·줄 목록) · 특성(나무판)
import { chromium } from 'playwright';
import { pastTitle, patchSave } from './nav.mjs';

/** 실제 텍스트 범위와 슬롯 이름 간격을 검사한다. */
export const equipmentLayout = page => page.evaluate(() => {
  const q = s => document.querySelector(`#s-char ${s}`), rect = el => el.getBoundingClientRect();
  const panel = rect(q('.c7-mid .c7-stats')), [left, right] = [...document.querySelectorAll('#s-char .c7-col')].map(rect);
  const stage = rect(q('.c7-stage')), inventory = rect(q('.c7-inventory'));
  const bodyEl = q('.ns-body'), body = rect(bodyEl), tabs = rect(document.querySelector('#tabs'));
  const centered = panel.left >= left.right - 1 && panel.right <= right.left + 1 && panel.bottom <= inventory.top + 1;
  const viewport = [...document.querySelectorAll('#s-char .c7-slot, #s-char .c7-mid .c7-stats')].every(el => {
    const r = rect(el); return r.left >= 0 && r.right <= innerWidth && r.top >= body.top - 1 && r.bottom <= tabs.top + 1;
  }) && bodyEl.scrollWidth <= bodyEl.clientWidth + 1;
  const firstRow = q('.c7-bag') ?? q('.c7-inventory .c7-bag-empty');
  const inventoryFollows = inventory.top >= stage.bottom - 1 && inventory.top - stage.bottom <= 24;
  const inventoryVisible = rect(q('.c7-inventory-count')).bottom <= tabs.top && (!firstRow || rect(firstRow).bottom <= tabs.top + 1);
  const issues = [];
  for (const row of document.querySelectorAll('#s-char .c7-stat')) {
    const parts = [...row.querySelectorAll(':scope > small, :scope > b, :scope > i')].filter(el => el.textContent.trim()).map(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      return { el, r: range.getBoundingClientRect() };
    });
    const name = row.querySelector('small').textContent;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i].r;
      if (a.left < panel.left + 1 || a.right > panel.right - 1 || a.top < panel.top || a.bottom > panel.bottom) issues.push(`${name}: clipped ${parts[i].el.tagName}`);
      for (let j = i + 1; j < parts.length; j++) { const b = parts[j].r; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push(`${name}: overlap`); }
    }
  }
  const labelsSeparate = [...document.querySelectorAll('#s-char .c7-slot')].every(el => rect(el.querySelector('b')).top >= rect(el.querySelector('.c7-sq')).bottom + 2);
  const details = q('.c7-shint'), detailsRect = rect(details);
  const detailsVisible = getComputedStyle(details).display !== 'none' && detailsRect.bottom <= panel.bottom && /상세 보기/.test(details.textContent);
  return { centered, viewport, inventoryFollows, inventoryVisible, valuesFit: !issues.length, issues, labelsSeparate, detailsVisible };
});

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
  const layout = await equipmentLayout(page);
  ok((await page.locator('#s-char .c7-plq').count()) === 0 && layout.centered && layout.viewport && layout.inventoryFollows && layout.inventoryVisible, `장비 중앙 능력치와 바로 아래 인벤토리가 화면 안 (${JSON.stringify(layout)})`);
  ok((await page.locator('#s-char .c7-stage .c7-bigem').count()) === 0 && /사제/.test(await page.getAttribute('#s-char .topbar .tb-em .emblem', 'aria-label')) && /사제/.test(await text('#s-char .topbar .tb-cls')), '능력치 위 둥근 장식 없음, 위 줄 직업 문장·이름 = 사제');
  ok(await page.getAttribute('#s-char .c7-inventory', 'aria-label') === '인벤토리' && (await page.locator('#s-char .c7-acts, #s-char [data-bag], #s-char [data-rec], #s-char [data-salvbag]').count()) === 0, '장비 아래 인벤토리 상시 표시, 별도 가방·추천·분해 버튼 없음');
  const stats = await flat('#s-char .c7-stats');
  ok(/체력220/.test(stats) && /지능72/.test(stats) && /정신력/.test(stats) && /인내/.test(stats) && !/세트/.test(stats), `능력치 판: 체력 220 · 지능 72 (34 1-2: 숫자 ÷2.5, 1-6 치유 배율 0.6), 정신력 · 인내, 세트 칸 없음 (${stats})`);
  ok((await page.locator('#s-char .c7-stat').count()) === 6 && (await page.locator('#s-char .gtile').count()) === 6 && (await page.locator('#s-char .gtile.empty').count()) === 6, '능력치 6칸, 착용 6칸 (다 빈칸)');
  ok((await page.locator('#s-char .c7-slot > small').count()) === 0 && (await page.locator('#s-char .c7-slot > b').count()) === 6 && await page.locator('#s-char .c7-slot.empty').evaluateAll(els => els.every(el => /빈칸/.test(el.getAttribute('aria-label')))), '장비 슬롯은 그림+부위 이름만 표시, 빈칸 정보는 접근 가능한 이름에 유지');
  ok(layout.valuesFit, `중앙 능력치 이름·값 겹침 없음 (${layout.issues.join(',')})`);
  ok((await page.locator('#s-char .c7-sq img.g-ic').count()) === 6 && (await page.locator('#s-char .c7-stat .c7-si img.g-ic').count()) === 6 && (await page.locator('#s-char nav .c7-tic img.g-ic').count()) === 3, '31 그림: 장비 칸 item- 6장 (무기·목걸이는 40 다시 그린 그림), 능력치 stat- 6장 (인내 stat-stamina 포함), 하위 탭 icon-gear·skills·talent');
  await page.screenshot({ path: `${shots}/char_gear.png`, animations: 'disabled' });

  // ---- 스킬: Lv 1 ----
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-sk').count()) === 10, '스킬 줄 8 (8번째 칸 빛의 전이) + 성언 줄 + 패시브 줄');
  ok((await page.locator('#s-char .c7-wheel .c7-wh .c7-si').count()) === 8 && (await page.locator('#s-char .c7-wh.core').count()) === 1 && (await page.locator('#s-char .c7-mcircle').count()) === 1, '휠 = 메달 8개 (빈 칸 없음)에 스킬 그림(없으면 선 아이콘) + 가운데 마나 구슬 + 마법진');
  ok((await page.locator('#s-char .c7-wheel .c7-si img.g-ic').count()) === 8 && (await page.locator('#s-char .c7-mcircle img.g-ic').count()) === 1 && (await page.locator('#s-char .c7-ski img.g-ic').count()) === 9, '31 그림: 휠 메달 skill- 8장 (빛의 전이는 임시 그림, 64), 마법진 ui-magic-circle (40 다시 그린 그림), 스킬 줄 그림 (패시브 줄은 선 아이콘)');
  ok((await page.locator('#s-char .c7-sk.locked').count()) === 7 && (await page.locator('#s-char .lslot.locked').count()) === 6, 'Lv 1: 치유·순간 치유만 열림 (휠 6칸·성언 잠김)');
  ok(/Lv 2/.test(await text('#s-char .c7-sk[data-skill="renew"]')), '잠긴 스킬엔 배우는 레벨');
  ok(await page.getAttribute('#s-char [data-smode="view"]', 'aria-pressed') === 'true', '처음은 「설명 보기」');
  const h0 = await page.evaluate(() => document.querySelector('#s-char .c7-sdesc').getBoundingClientRect().height);
  await page.click('#s-char [data-ldir="NE"]'); await page.clock.runFor(50);
  const desc = await text('#s-char .c7-sdesc');
  ok(/치유/.test(desc) && /시전 2\.5초/.test(desc) && /칸 탭/.test(desc) && await page.isVisible('#s-char .c7-sk.on[data-skill="heal"]'), '휠 칸을 누르면 아래 설명 칸 + 줄 목록 표시');
  const h1 = await page.evaluate(() => document.querySelector('#s-char .c7-sdesc').getBoundingClientRect().height);
  ok(h0 === h1 && h1 >= 112, `설명 칸 높이 고정 (${h0} / ${h1})`);
  await page.click('#s-char .c7-sk[data-skill="flash"]'); await page.clock.runFor(50);
  ok(/지능의 83% \(60\) 회복/.test(await text('#s-char .c7-skd')) && await page.getAttribute('#s-char .c7-sk[data-skill="flash"]', 'aria-expanded') === 'true', '스킬 줄을 누르면 설명 펼침');
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

  // ---- 칸 탭 기본 힐 ----
  ok(await page.isDisabled('#s-char [data-tap="renew"]'), 'Lv 1: 칸 탭 「소생」 잠금');
  await page.click('#s-char [data-tap="flash"]'); await page.clock.runFor(50);
  ok((await save()).settings.tapKey === 'flash' && await page.getAttribute('#s-char [data-tap="flash"]', 'aria-pressed') === 'true', '칸 탭 기본 힐 = 순간 치유 저장');
  await page.click('#s-char [data-tap="heal"]'); await page.clock.runFor(50);

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
  ok(/벼랑 끝 손길/.test(await text('#s-char .c7-tsheet')) && /Lv 10/.test(await text('#s-char .c7-tsheet')) && /고르기/.test(await text('#s-char .c7-tsheet [data-talent="1:0"]')), '칸을 누르면 아래 시트 (이름·Lv·설명·고르기)');
  // 가짜 시계와 무관하게 CSS 등장 애니메이션의 마지막 프레임을 캡처한다.
  await page.screenshot({ path: `${shots}/char_talent.png`, animations: 'disabled' });
  await page.click('#s-char .c7-tsum'); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-char .c7-tsheet')), '시트 밖을 누르면 닫힘');
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-sk.locked').count()) === 0 && (await page.locator('#s-char .lslot.locked').count()) === 0, 'Lv 25 = 스킬·패시브 다 열림');
  await page.screenshot({ path: `${shots}/char_skill_lv25.png`, fullPage: false });
  await page.click('#s-char [data-csub="gear"]'); await page.clock.runFor(50);
  const st25 = await flat('#s-char .c7-stats');
  ok(/체력1,382/.test(st25) && /지능452/.test(st25), `Lv 25 = 체력 220 × 6.28 · 지능 72 × 6.28 (34 1-2 레벨 배율, 1-6 치유 배율) (${st25.slice(0, 60)})`);
  await page.click('#s-char .c7-stats'); await page.clock.runFor(50);
  const src = await text('#s-char .c7-ssheet');
  ok(/기본 220/.test(src) && /레벨 \+1,162/.test(src) && /지능/.test(src) && !/특성|세트|지능은 치유 회복량입니다/.test(src), '능력치 상세에는 기본·레벨·장비만 표시, 미사용 특성과 하단 설명 없음');
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
