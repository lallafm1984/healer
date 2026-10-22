// 메뉴 공통 버튼: 실제 화면에서 글자 대비·이미지 예외·팝업/작은 화면 배치를 확인한다.
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function menuButtons(url, shots) {
  const browser = await chromium.launch(), errs = [];
  let fails = 0;
  const ok = (value, label, detail) => { console.log(`${value ? 'PASS' : 'FAIL'} ${label}`); if (!value) { fails++; console.log(JSON.stringify(detail)); } };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  const inspect = async (name, root) => {
    for (const [width, height] of [[360, 780], [412, 915], [768, 884]]) {
      await page.setViewportSize({ width, height }); await page.clock.runFor(300);
      const audit = await page.locator(root).evaluate(el => {
        const rgb = s => [...s.matchAll(/rgba?\(([^)]+)\)/g)].map(m => m[1].split(/[,\s]+/).slice(0, 3).map(Number));
        const lum = values => values.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
        const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
        const bad = [], red = [];
        let count = 0;
        for (const b of el.querySelectorAll('button')) {
          if (!b.getClientRects().length || b.closest('[hidden], [inert]')) continue;
          const s = getComputedStyle(b), r = b.getBoundingClientRect(), label = b.textContent.trim().slice(0, 35);
          const surfaces = [s, getComputedStyle(b, '::before'), getComputedStyle(b, '::after')];
          if (surfaces.some(s => /a2-depart/.test(s.backgroundImage + s.borderImageSource)) && !b.matches('.g-cta, #lobbyStart')) red.push(label);
          if (!s.getPropertyValue('--action-bg').trim()) continue;
          count++;
          if (r.width > innerWidth || r.left < -1 || r.right > innerWidth + 1) bad.push(`${label}: 화면 밖`);
          if (b.disabled || b.getAttribute('aria-disabled') === 'true') continue;
          const backgrounds = rgb(s.backgroundImage === 'none' ? s.backgroundColor : s.backgroundImage);
          for (const t of [b, ...b.querySelectorAll('b, small, strong')]) {
            if (!t.textContent.trim()) continue;
            const foreground = rgb(getComputedStyle(t).color)[0];
            const ratio = Math.min(...backgrounds.map(bg => contrast(foreground, bg)));
            if (ratio < 4.5) bad.push(`${label}: 대비 ${ratio.toFixed(2)}`);
          }
        }
        return { count, bad, red };
      });
      ok(audit.count > 0 && !audit.bad.length && !audit.red.length, `${name} ${width}: 버튼 글자 대비·가로 배치·출전 그림 분리`, audit);
      await page.screenshot({ path: `${shots}/buttons-${name}-${width}.png` });
    }
    await page.setViewportSize({ width: 360, height: 780 });
  };
  try {
    await page.clock.install(); await page.goto(url); await page.clock.runFor(300);
    await inspect('title', '#s-title'); await pastTitle(page);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.player.level = 50; s.player.gold = 500000; s.tut = 99; s.settings.devUnlock = false;
      s.gear.bag = [{ id: 901, slot: 'hands', grade: '희귀', name: '희귀 장갑' }];
      s.daily.missions.forEach(m => { m.n = 99; });
      localStorage.setItem('healer.save', JSON.stringify(s));
    });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await page.click('#tabs [data-tab="guild"]'); await page.click('#found'); await page.click('#storyOk');
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.guild.fame = 480; localStorage.setItem('healer.save', JSON.stringify(s)); });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await page.click('#tabs [data-tab="guild"]');
    await page.click('#s-guild [data-sub="recruit"]');
    await inspect('guild', '#s-guild');
    await page.click('#s-guild [data-post="ad"]');
    await inspect('confirm', '#s-guild .g-post-confirm'); await page.keyboard.press('Escape');
    await page.click('#s-guild [data-cand="0"]');
    await inspect('hire', '#s-guild .g-msheet'); await page.keyboard.press('Escape');
    await page.click('#tabs [data-tab="char"]');
    await page.click('#s-char [data-gitem="901"]');
    await inspect('gear', '#s-char .c7-gsheet'); await page.keyboard.press('Escape');
    await page.click('#s-char [data-csub="skill"]'); await inspect('skill', '#s-char');
    await page.click('#s-char [data-csub="talent"]');
    await page.click('#s-char [data-tcell="0:0"]');
    await inspect('talent', '#s-char .c7-tsheet'); await page.keyboard.press('Escape');
    await page.click('#s-char [data-csub="hero"]');
    await page.click('#s-char [data-hcard="druid"]');
    await inspect('job', '#s-char .c7-job-sheet'); await page.keyboard.press('Escape');
    await page.click('#tabs [data-tab="lobby"]'); await page.click('#s-lobby .lb-shop');
    await inspect('shop', '#s-shop'); await page.click('#s-shop .tb-back');
    await page.click('#s-lobby .lb-missions .lb-main');
    await inspect('missions', '#s-missions'); await page.click('#s-missions .tb-back');
    await page.click('#s-lobby .tb-set');
    await inspect('settings', '#s-settings'); await page.click('#s-settings .tb-back');
    await toParty(page); await inspect('party', '#s-party');
  } catch (e) { fails++; errs.push(e.stack || e.message); }
  finally { await ctx.close(); await browser.close(); }
  return { fails, errs };
}
