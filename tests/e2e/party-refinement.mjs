import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';
import { DEPARTURE_DEVICES } from './adventure-no-scroll.mjs';

export default async function partyRefinement(url, shots) {
  const browser = await chromium.launch(); let fails = 0; const errs = [];
  const ok = (v, label, detail) => { console.log(`${v ? 'PASS' : 'FAIL'} ${label}`); if (!v) { fails++; if (detail) console.log(JSON.stringify(detail)); } };
  try {
    for (const [id, name, width, height] of DEPARTURE_DEVICES) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      try {
        const page = await context.newPage(), tag = `${name} ${width}×${height}`;
        page.on('pageerror', e => errs.push(`${id}: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error') errs.push(`${id}: ${m.text()}`); });
        await page.clock.install(); await page.goto(url); await page.clock.runFor(300);
        await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.tut = 99; s.settings.devUnlock = false; s.player.level = 10; s.clears.rustfort = { '쉬움': { stars: 3, grade: 'S', best: 100, n: 1 } }; localStorage.setItem('healer.save', JSON.stringify(s)); });
        await page.reload(); await page.clock.runFor(300); await pastTitle(page); await toParty(page);
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const root = document.querySelector('#s-party'), rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          const within = r => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
          const slots = root.querySelectorAll('.f-slots .f-item').length;
          const foot = rect(root.querySelector('.f-foot2')), go = rect(root.querySelector('#depart'));
          const classes = [...root.querySelectorAll('.pcard[data-cls]')].every(el => el.querySelector('[data-class-icon]')?.dataset.classIcon === el.dataset.cls);
          const personalities = [...root.querySelectorAll('.pcard .f-ps')].every(el => !el.querySelector('i,em') && el.innerText.trim().length > 1 && el.scrollWidth <= el.clientWidth + 1);
          const buttons = ['.tb-back', '#guideOpen'].map(sel => { const el = root.querySelector(sel); return { r: rect(el), bg: getComputedStyle(el).backgroundImage }; });
          return { slots, go, foot, classes, personalities, buttons, safe: within(go), horizontal: root.scrollWidth <= root.clientWidth + 1, center: Math.abs((go.left + go.right) / 2 - (foot.left + foot.right) / 2) };
        });
        ok(layout.slots === 0, `${tag}: 소비 아이템 단축칸 없음 (2026-10-16)`, layout);
        ok(layout.safe && layout.horizontal && layout.center <= 1 && layout.go.width >= Math.min(layout.foot.width - 40, 550) && layout.go.height >= 44, `${tag}: 중앙 출발이 화면 안`, layout);
        ok(layout.classes && layout.personalities && !(await page.locator('#s-party #reroll,#s-party #adReroll,#s-party .f-board figcaption').count()), `${tag}: 직업별 아이콘·전체 성격명·불필요한 표기 제거`, layout);
        ok(layout.buttons.every(b => /party-(back|guide)-v1/.test(b.bg) && b.r.height >= 44), `${tag}: 생성한 버튼 이미지·44px 터치 영역`, layout.buttons);
        await page.screenshot({ path: `${shots}/party-${id}-locked.png` });

      } catch (e) { fails++; errs.push(`${id}: ${e.stack || e.message}`); console.log(`FAIL ${name}: ${e.message}`); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
  return { fails, errs };
}
