// 실제 CSS 시간으로 글자 루프 · 즉시 시작 · 화면 이탈 정리 · 효과 줄이기를 확인한다.
import { chromium } from 'playwright';

export default async function titleMotion(url, shots) {
  const browser = await chromium.launch(), errs = [];
  let fails = 0;
  const ok = (value, label) => { console.log(`${value ? 'PASS' : 'FAIL'} ${label}`); if (!value) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { window.__screenFx = true; });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  const animations = () => page.locator('#s-title').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation).length);
  const changeReduced = value => page.evaluate(value => {
    const save = JSON.parse(localStorage.getItem('healer.save'));
    save.settings.reducedEffects = value;
    localStorage.setItem('healer.save', JSON.stringify(save));
  }, value);
  try {
    await page.goto(url);
    await page.locator('#s-title').click({ position: { x: 180, y: 430 } });
    await page.waitForTimeout(380);
    ok(await page.locator('#s-title').isVisible() && await page.locator('#s-story').isHidden(), '버튼 밖 배경 터치는 시작하지 않음');
    // 등장 중의 투명도는 입력을 막지 않으며, 버튼 칸은 움직이지 않아 평소대로 누를 수 있다.
    await page.getByRole('button', { name: '시작하기', exact: true }).click();
    await page.locator('#s-story').waitFor({ state: 'visible' });
    ok(await page.locator('#s-title').isHidden(), '등장 연출 중에도 시작 버튼으로 바로 진입');
    ok(await animations() === 0, '타이틀 이탈 뒤 반복 애니메이션이 남지 않음');

    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    const letters = () => page.locator('#s-title .t-letter').evaluateAll(els => els.map(el => getComputedStyle(el).transform));
    const before = await letters();
    await page.waitForTimeout(650);
    const after = await letters();
    ok(before.length === 5 && before.some((v, i) => v !== after[i]), '제목 다섯 글자가 시차를 두고 실제로 움직임');
    ok(await animations() > 0, '대기 중 제목·빛가루·버튼 연출이 계속 재생');
    await page.screenshot({ path: `${shots}/title-motion-s25.png` });

    await changeReduced(true); await page.reload();
    ok(await animations() === 0, '앱 시각 효과 줄이기: 반복·등장 연출 없음');
    ok(await page.getByRole('button', { name: '시작하기', exact: true }).isVisible(), '효과를 줄여도 시작 버튼 표시');

    await changeReduced(false);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload();
    ok(await animations() === 0, '기기 동작 줄이기: 반복·등장 연출 없음');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(120);
    ok(await animations() > 0, '기기 동작 줄이기를 해제하면 타이틀 연출 재개');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(120);
    ok(await animations() === 0, '타이틀에서 기기 동작 줄이기를 켜면 즉시 정지');
  } catch (error) { fails++; errs.push(error.stack || error.message); }
  finally { await ctx.close(); await browser.close(); }
  return { fails, errs };
}
