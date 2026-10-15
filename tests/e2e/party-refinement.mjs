import { chromium } from 'playwright';
import { departGo, pastTitle, patchSave, toParty } from './nav.mjs';
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
        await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.tut = 99; s.settings.devUnlock = false; s.items = ['mana', 'life']; s.player.level = 10; s.clears.rustfort = { '쉬움': { stars: 3, grade: 'S', best: 100, n: 1 } }; localStorage.setItem('healer.save', JSON.stringify(s)); });
        await page.reload(); await page.clock.runFor(300); await pastTitle(page); await toParty(page);
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const root = document.querySelector('#s-party'), rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          const within = r => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
          const slots = [...root.querySelectorAll('.f-slots .f-item')].map(el => ({ r: rect(el), disabled: el.disabled, lock: !!el.querySelector('svg'), label: el.getAttribute('aria-label') }));
          const foot = rect(root.querySelector('.f-foot2')), go = rect(root.querySelector('#depart'));
          const classes = [...root.querySelectorAll('.pcard[data-cls]')].every(el => el.querySelector('[data-class-icon]')?.dataset.classIcon === el.dataset.cls);
          const personalities = [...root.querySelectorAll('.pcard .f-ps')].every(el => !el.querySelector('i,em') && el.innerText.trim().length > 1 && el.scrollWidth <= el.clientWidth + 1);
          const buttons = ['.tb-back', '#guideOpen'].map(sel => { const el = root.querySelector(sel); return { r: rect(el), bg: getComputedStyle(el).backgroundImage }; });
          return { slots, go, foot, classes, personalities, buttons, safe: slots.every(s => within(s.r)) && within(go), horizontal: root.scrollWidth <= root.clientWidth + 1, center: Math.abs((go.left + go.right) / 2 - (foot.left + foot.right) / 2) };
        });
        ok(layout.slots.length === 4 && !layout.slots[0].disabled && !layout.slots[1].disabled && layout.slots.slice(2).every(s => s.disabled && s.lock) && /15/.test(layout.slots[2].label) && /30/.test(layout.slots[3].label), `${tag}: 4칸 표시·Lv15/30 잠금 아이콘`, layout);
        ok(layout.safe && layout.horizontal && layout.center <= 1 && layout.go.width >= Math.min(layout.foot.width - 40, 550) && layout.go.height >= 44, `${tag}: 네 칸과 중앙 출발이 화면 안`, layout);
        ok(layout.classes && layout.personalities && !(await page.locator('#s-party #reroll,#s-party #adReroll,#s-party .f-board figcaption').count()), `${tag}: 직업별 아이콘·전체 성격명·불필요한 표기 제거`, layout);
        ok(layout.buttons.every(b => /party-(back|guide)-v1/.test(b.bg) && b.r.height >= 44), `${tag}: 생성한 버튼 이미지·44px 터치 영역`, layout.buttons);
        await page.screenshot({ path: `${shots}/party-${id}-locked.png` });

        await patchSave(page, { player: { level: 15 } }); await toParty(page);
        ok(await page.locator('#s-party .f-item:disabled').count() === 1 && await page.locator('#s-party [data-slot="2"]').isEnabled(), `${tag}: Lv15에 세 번째 칸 해제`);
        await patchSave(page, { player: { level: 30 }, items: ['mana', 'life', null, null] }); await toParty(page);
        await page.click('#s-party [data-slots="3"]'); await page.clock.runFor(100);
        const popup = await page.locator('#s-party .f-isheet').evaluate(el => {
          const r = el.getBoundingClientRect(), buttons = [...el.querySelectorAll('.f-item-actions button')], list = el.querySelector('.f-item-options');
          const contentTop = document.querySelector('#viewport').getBoundingClientRect().top;
          return { slot: el.dataset.editSlot, title: el.querySelector('h2').textContent, inside: r.left >= 0 && r.right <= innerWidth && r.top >= contentTop && r.bottom <= innerHeight, overflow: el.scrollWidth > el.clientWidth + 1,
            cards: el.querySelectorAll('.f-item-option').length, cardsUncut: [...el.querySelectorAll('.f-item-option')].every(b => { const q = b.getBoundingClientRect(), copy = b.querySelector('.f-item-copy').getBoundingClientRect(); return copy.bottom <= q.bottom + 1 && copy.right <= q.right + 1 && b.scrollWidth <= b.clientWidth + 1; }),
            reachable: list.clientHeight >= 60 && buttons.every(b => { const q = b.getBoundingClientRect(), hit = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2); return q.bottom <= innerHeight && q.height >= 44 && b.contains(hit); }) };
        });
        ok(popup.slot === '3' && /4번/.test(popup.title) && popup.inside && !popup.overflow && popup.reachable && popup.cardsUncut && popup.cards === 6, `${tag}: 선택한 4번 칸 제목·전체 설명·닫기 버튼 안전 경계`, popup);
        await page.screenshot({ path: `${shots}/party-${id}-picker.png` });
        await page.click('#s-party .f-isheet [data-item="shield"]');
        let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).items);
        ok(JSON.stringify(saved) === JSON.stringify(['mana', 'life', null, 'shield']), `${tag}: 네 번째 빈칸에 정확히 지정`, saved);
        await page.keyboard.press('Escape');
        ok(await page.locator('#s-party [data-slot="3"]').evaluate(el => document.activeElement === el), `${tag}: 닫으면 누른 단축칸으로 초점 복귀`);
        await page.click('#s-party [data-slots="1"]'); await page.click('#s-party .f-isheet [data-item="shield"]'); await page.keyboard.press('Escape');
        saved = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).items);
        ok(JSON.stringify(saved) === JSON.stringify(['mana', 'shield', null, 'life']), `${tag}: 이미 지정된 아이템은 두 칸을 교환`, saved);
        await page.click('#s-party [data-slots="0"]'); await page.click('#s-party [data-item-clear]'); await page.keyboard.press('Escape');
        await page.reload(); await page.clock.runFor(300); await toParty(page);
        const after = await page.locator('#s-party .f-slots .f-item').evaluateAll(els => els.map(el => el.dataset.slotItem ?? null));
        ok(JSON.stringify(after) === JSON.stringify([null, 'shield', null, 'life']), `${tag}: 비운 자리와 배치를 재진입 후 유지`, after);
        await page.screenshot({ path: `${shots}/party-${id}-assigned.png` });
        await departGo(page); await page.clock.runFor(3400);
        const battle = await page.locator('#items > .item').evaluateAll(els => els.map(el => el.dataset.item ?? null));
        ok(JSON.stringify(battle) === JSON.stringify([null, 'shield', null, 'life']), `${tag}: 실제 전투에서도 같은 네 칸 위치`, battle);
      } catch (e) { fails++; errs.push(`${id}: ${e.stack || e.message}`); console.log(`FAIL ${name}: ${e.message}`); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
  return { fails, errs };
}
