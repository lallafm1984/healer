// 2026-10-11 Lim 「말풍선 위치가 올바르지 못하다」 · 「꾹 누르면 상세창이 손가락에 가려진다」 · 「전투 메시지가 20인에서 파티원을 가린다」.
// 판 크기 넷 (탐험 7칸 · 5인 10칸 · 10인 25칸 · 20인 36칸) × 대상 폰 크기에서:
// - 말풍선은 꼬리 끝이 말한 사람 칸 꼭짓점에 닿고 (위 또는 아래), 몸통이 꼬리를 품고, 이름 · 체력을 안 가림. 붙일 자리가 없으면 생략
// - 길게 누르기 상세창은 누른 칸 위쪽 (손가락보다 위), 손을 떼도 남았다가 다음 터치에 닫힘
// - 전투 메시지는 판 밖 (시전 막대 자리 안)
import { chromium } from 'playwright';
import { DEVICES } from './devices.mjs';
import { patchSave, toParty } from './nav.mjs';

const BOARDS = [
  { n: 3, tab: 'explore', content: 'plateau' },
  { n: 5, tab: 'dungeon', content: 'rustfort' },
  { n: 10, tab: 'raid10', content: 'abyss1' },
  { n: 20, tab: 'raid20', content: 'cathedral1' },
  // 「레이드 판 5인 던전 모양」 설정 (판을 줄여 그림: 화면 좌표 = 그림 좌표 × k)
  { n: 10, tab: 'raid10', content: 'abyss1', five: true },
  { n: 20, tab: 'raid20', content: 'cathedral1', five: true },
];
const LINES = ['좋아, 가자!', '힐 좀 부탁해요~', '조심해! 크게 온다', '고마워요 힐러님'];

export default async function battleNotes(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, info) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (c || !info ? '' : ` ${JSON.stringify(info).slice(0, 1500)}`)); if (!c) fails++; };
  for (const [name, width, height] of DEVICES) for (const board of BOARDS) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 11, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 60 }, settings: { auto: false, sound: false, vibrate: false, raidFiveLook: !!board.five } });
    await toParty(page, { tab: board.tab, content: board.content, diff: '쉬움' });
    await page.click('#depart'); await page.clock.runFor(3100 + 300);
    const tag = `${name} ${width}×${height} ${board.n}인${board.five ? ' (5인 모양)' : ''}`;
    if (board.five) ok(await page.evaluate(() => document.querySelector('#board').dataset.cellLook === 'five'), `${tag}: 5인 던전 모양으로 줄여 그림`);
    // 판 위 사람이 죽거나 움직이지 않게 체력을 채우며 진행
    const fill = () => page.evaluate(() => { const F = window.__proto.F; F.party.forEach(u => { if (u.alive) u.hp = u.max; }); });

    // ---- 길게 누르기 상세창: 맨 윗줄 · 맨 아랫줄 ----
    const cv = await page.locator('#board').boundingBox();
    const people = await page.evaluate(() => window.__proto.F.party.filter(u => u.alive).map(u => ({ id: u.id, ...window.__proto.center(u.cell) })));
    const top = people.reduce((a, b) => (b.y < a.y ? b : a)), bottom = people.reduce((a, b) => (b.y > a.y ? b : a));
    for (const [where, p] of [['맨 윗줄', top], ['맨 아랫줄', bottom]]) {
      await fill();
      await page.mouse.move(cv.x + p.x, cv.y + p.y); await page.mouse.down();
      await page.clock.runFor(600);
      const g = await page.evaluate(() => {
        const el = document.querySelector('#preview'), r = el.getBoundingClientRect(), cv = document.querySelector('#board');
        return { hidden: el.hidden, top: r.top, bottom: r.bottom, left: r.left, right: r.right, brief: el.classList.contains('brief'), noarrow: el.classList.contains('noarrow'),
          r: Number(cv.dataset.cellScale) * 0.93, text: el.textContent };
      });
      const cellTop = cv.y + p.y - g.r;
      if (name === 'S25') await page.screenshot({ path: `${shots}/notes_preview_${board.n}${board.five ? 'f' : ''}_${where === '맨 윗줄' ? 'top' : 'bottom'}.png` });
      ok(!g.hidden && g.bottom <= cellTop + .5 && g.top >= 70 - .5 && g.left >= 0 && g.right <= width + .5 && !g.noarrow && /체력|쓰러짐/.test(g.text),
        `${tag}: ${where} 칸을 길게 누르면 상세창이 그 칸 위쪽 (아래 끝 ${Math.round(g.bottom)} ≤ 칸 위 ${Math.round(cellTop)}${g.brief ? ', 설명 접음' : ''})`, g);
      await page.mouse.up(); await page.clock.runFor(1000);
      const kept = await page.isVisible('#preview');
      await page.mouse.move(cv.x + 4, cv.y + 4); await page.mouse.down(); await page.mouse.up(); await page.clock.runFor(50);
      const closed = await page.isHidden('#preview');
      ok(kept && closed, `${tag}: ${where} 손을 떼도 1초 뒤 상세창이 남고, 다음 터치에 닫힘`, { kept, closed });
    }

    // ---- 전투 메시지: 판 밖 (시전 막대 자리 안) ----
    await page.evaluate(() => window.__proto.F.events.push({ type: 'msg', text: '바닥이 무너짐' }));
    // 앞서 온 메시지가 있으면 차례를 기다림 (한 번에 하나씩)
    for (let i = 0; i < 40 && await page.evaluate(() => document.querySelector('#toast .toast.on')?.textContent !== '바닥이 무너짐'); i++) await page.clock.runFor(200);
    const note = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      const on = document.querySelector('#toast .toast.on');
      return { on: on ? { ...box(on), text: on.textContent } : null, board: box(document.querySelector('#board')), cast: box(document.querySelector('#castbar')) };
    });
    ok(!!note.on && note.on.text === '바닥이 무너짐' && note.on.top >= note.board.bottom - .1 && note.on.top >= note.cast.top - .1 && note.on.bottom <= note.cast.bottom + .1,
      `${tag}: 전투 메시지는 판 아래 시전 막대 자리 안 (파티원을 안 가림)`, note);
    // ---- 말풍선: 한 사람씩 ----
    const ids = await page.evaluate(() => window.__proto.F.party.filter(u => u.alive).map(u => u.id));
    const placed = [], stray = [];
    for (const id of ids) {
      await fill();
      await page.evaluate(([id, text]) => window.__proto.say(id, text, 'talk', 900), [id, LINES[id % LINES.length]]);
      await page.clock.runFor(250);
      const m = await page.evaluate(id => {
        const cv = document.querySelector('#board'), all = JSON.parse(cv.dataset.decorationBounds || '[]');
        const F = window.__proto.F, u = F.party.find(x => x.id === id), p = window.__proto.center(u.cell), r = Number(cv.dataset.cellScale) * 0.93;
        const b = all.find(x => x.key === `bubble${id}`);
        if (!b || u.moving) return null; // 걸어가는 중이면 말풍선은 걷는 자리를 따라감 (칸 가운데와 다름)
        const sep = (a, c) => a.right <= c.left + .05 || c.right <= a.left + .05 || a.bottom <= c.top + .05 || c.bottom <= a.top + .05;
        const covers = all.filter(x => (x.kind === 'hp' || x.kind === 'nick') && !sep(b, x)).map(x => x.key);
        const above = b.bottom <= p.y;
        const gap = above ? (p.y - r) - b.bottom : b.top - (p.y + r);
        const k = Number(cv.dataset.drawScale || 1); // 꼬리 여백 9px는 판 그림 좌표 (줄여 그리면 화면에선 9k)
        return { id, gap: +gap.toFixed(2), tailIn: p.x >= b.left + 9 * k - .05 && p.x <= b.right - 9 * k + .05, covers };
      }, id);
      if (m) { placed.push(m); if (Math.abs(m.gap) > 2 || !m.tailIn || m.covers.length) stray.push(m); }
      await page.clock.runFor(800);
    }
    ok(stray.length === 0 && placed.length >= Math.min(ids.length, board.n <= 5 ? 2 : 3),
      `${tag}: 말풍선 ${placed.length}/${ids.length}개가 말한 사람 칸 꼭짓점에 꼬리로 붙음 · 이름 · 체력 안 가림`, { stray, placed: placed.length });
    if (board.n >= 10) {
      // 붙일 자리가 없는 사람의 기믹 말풍선은 생략 (2026-10-11 Lim 「자리가 없으면 말풍선 생략」): 판에도, 전투 메시지에도 안 뜸
      let skipped = null;
      await page.clock.runFor(1500); // 앞 검사의 말풍선이 모두 사라진 뒤 (다른 말풍선 때문에 기다리는 경우와 구분)
      for (const id of ids) {
        await fill();
        const nick = await page.evaluate(id => { window.__proto.say(id, '폭탄! 다들 흩어져!', 'call', 1500); return window.__proto.F.party.find(u => u.id === id).nick; }, id);
        const look = () => page.evaluate(id => ({ toast: document.querySelector('#toast').textContent,
          onBoard: JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').some(b => b.key === `bubble${id}`) }), id);
        // 기다리는 시간(1.2초) 동안 한 번도 못 뜨면 버림. 그 사이 자리가 나서 뜨면 (전투가 실제 시간으로 흘러 사람이 움직임) 다음 사람으로
        const seen = [];
        let shown = false;
        for (let t = 0; t < 15 && !shown; t++) { await page.clock.runFor(100); const g = await look(); seen.push(g.toast); shown = g.onBoard; }
        if (shown) { await page.clock.runFor(1500); continue; }
        await page.clock.runFor(300);
        const later = await look();
        skipped = { id, nick, later, toasts: [...new Set([...seen, later.toast])] };
        break;
      }
      // 5인 모양 판은 칸 사이가 넓어 모두 자리가 있을 수 있음
      ok(skipped ? !skipped.later.onBoard && !skipped.toasts.some(t => t.includes('폭탄! 다들 흩어져!')) : !!board.five,
        `${tag}: 판에 붙일 자리가 없는 기믹 말풍선은 생략 (전투 메시지로도 안 넘김)${skipped ? '' : ' · 모두 자리 있음'}`, skipped);
    }
    if (name === 'S25') await page.screenshot({ path: `${shots}/notes_bubbles_${board.n}${board.five ? 'f' : ''}.png` });

    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
