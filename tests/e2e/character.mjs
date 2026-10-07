// 캐릭터 탭 (Lim 2026-10-07): 내 사제 능력치 · 장비 · 스킬(설명·휠 배치·칸 탭·단축칸) · 특성 미리 보기
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
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // ---- 장비 (기본) ----
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char [data-csub="gear"]', 'aria-selected') === 'true', '캐릭터 탭 = 장비부터');
  const hero = await text('#s-char .chero');
  ok(/사제정통힐러/.test(hero.replace(/\s/g, '')) && /체력550/.test(hero.replace(/\s/g, '')) && /힐량×1\.00/.test(hero.replace(/\s/g, '')), '위쪽 = 사제 이름·Lv·능력치 5개');
  ok((await page.locator('#s-char .cstats div').count()) === 5 && (await page.locator('#s-char .gtile').count()) === 6, '능력치 5칸, 장비 6부위');
  await page.screenshot({ path: `${shots}/char_gear.png` });

  // ---- 스킬: Lv 1 ----
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .sklist .skc').count()) === 13, '스킬 9 + 패시브 4 카드');
  ok((await page.locator('#s-char .skc.locked').count()) === 10 && /배운 것 2 \/ 9/.test(await text('#s-char')), 'Lv 1: 치유·순간 치유·메아리 치유만 열림');
  ok(/Lv 2/.test(await text('#s-char .skc[data-skill="renew"]')), '잠긴 스킬엔 배우는 레벨');
  await page.click('#s-char [data-ldir="NE"]'); await page.clock.runFor(50);
  ok(/치유/.test(await text('#s-char .wdet')) && /1\.8초 시전/.test(await text('#s-char .wdet')) && await page.isVisible('#s-char .skc.on[data-skill="heal"]'), '휠 자리를 누르면 설명 + 아래 카드 표시');
  await page.screenshot({ path: `${shots}/char_skill_lv1.png` });

  // ---- 스킬: 배치 바꾸기 ----
  await page.click('#laySwap'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .cwheel.swapping') && await page.isDisabled('#layReset'), '배치 바꾸기 모드, 기본 배치면 「기본 배치로」 꺼짐');
  await page.click('#s-char [data-ldir="NE"]'); await page.click('#s-char [data-ldir="NW"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.settings.layout && sv.settings.layout.NW === 'heal' && sv.settings.layout.NE === null, '↗ 치유 ↔ ↖ 빈자리 → 저장');
  ok(/↖/.test(await text('#s-char .skc[data-skill="heal"]')), '카드의 휠 방향도 바뀜');
  await page.screenshot({ path: `${shots}/char_swap.png` });
  await page.click('#layReset'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.settings.layout === null, '「기본 배치로」');
  await page.click('#laySwap'); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-char .cwheel.swapping')), '「다 바꿨어요」 = 보기 모드');

  // ---- 칸 탭 기본 힐·단축칸 ----
  await page.click('#s-char [data-tap="flash"]'); await page.clock.runFor(50);
  ok((await save()).settings.tapKey === 'flash' && await page.getAttribute('#s-char [data-tap="flash"]', 'aria-pressed') === 'true', '칸 탭 기본 힐 = 순간 치유 저장');
  await page.click('#s-char [data-tap="heal"]'); await page.clock.runFor(50);
  await page.click('#s-char [data-item="medit"]'); await page.clock.runFor(50);
  ok(/다 찼어요/.test(await text('#s-char .note.warn')), '단축칸 2칸이 차면 안내');
  await page.click('#s-char [data-item="life"]'); await page.click('#s-char [data-item="medit"]'); await page.clock.runFor(50);
  ok((await save()).items.join() === 'mana,medit', '단축칸 바꾸기 저장 (생명 → 명상)');

  // ---- 설정에서 캐릭터 → 스킬로 ----
  await page.click('#s-char .tb-set'); await page.clock.runFor(100);
  ok(!(await page.isVisible('#s-settings .lslot')), '설정엔 스킬 배치 없음');
  await page.click('#toSkills'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char [data-csub="skill"]', 'aria-selected') === 'true', '설정 「→ 캐릭터」 = 캐릭터 스킬');

  // ---- 특성: Lv 1 / Lv 25 ----
  await page.click('#s-char [data-csub="talent"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .tier').count()) === 10 && (await page.locator('#s-char .tier.locked').count()) === 10, '특성 10단, Lv 1은 다 잠김');
  ok(/긴 숨결/.test(await text('#s-char .tier:first-child')) && await page.isVisible('#s-char .tier:first-child .tpick'), '1단 펼침: 긴 숨결 · 가벼운 손끝 · 넓은 원');
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(50);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char [data-csub="talent"]', 'aria-selected') === 'true', '다른 탭에 갔다 와도 보던 하위 탭');
  await patchSave(page, { player: { level: 25 } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.click('#s-char [data-csub="talent"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .tier.locked').count()) === 8 && /2단 열림/.test(await text('#s-char')), 'Lv 25 = 2단 열림');
  ok(await page.isVisible('#s-char .tier:nth-child(3) .tpick'), '다음에 열릴 3단이 펼쳐짐');
  await page.screenshot({ path: `${shots}/char_talent.png` });
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .skc.locked').count()) === 0 && (await page.locator('#s-char .lslot.locked').count()) === 0, 'Lv 25 = 스킬·패시브 다 열림');
  await page.screenshot({ path: `${shots}/char_skill_lv25.png`, fullPage: false });
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
