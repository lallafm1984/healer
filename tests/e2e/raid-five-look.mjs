// 레이드 판을 5인 던전 모양으로 (2026-10-11 Lim 비교용): 설정 → 전투 화면 · 레이드 일시정지 스위치, 기본 꺼짐.
// 켜면 10 · 20인 칸을 그 화면의 5인 던전 칸 크기로 그리고 판 전체를 칸 크기 비율만큼 줄임 → 칸 안 자리 · 글자 크기가 5인 칸 × 배율.
// 끄면 예전 그대로. 터치 · 칸 자리 (화면 좌표)는 그대로 맞음. 대상 폰 크기 (S25 · 울트라 · 플립) × 5인 · 10인 · 20인
import { chromium } from 'playwright';
import { DEVICES } from './devices.mjs';
import { departGo, pastTitle, patchSave, toParty } from './nav.mjs';

const BOARDS = [{ n: 5, tab: 'dungeon', content: 'rustfort' }, { n: 10, tab: 'raid10', content: 'abyss1' }, { n: 20, tab: 'raid20', content: 'cathedral1' }];
const near = (a, b, eps) => Math.abs(a - b) <= eps;

/** 판 크기 · 글자 크기 · 칸 안 자리 (칸 가운데에서 이름 · 체력까지 ÷ 칸 크기) */
const look = page => page.evaluate(() => {
  const el = document.querySelector('#board'), d = el.dataset, F = window.__proto.F, r = el.getBoundingClientRect();
  const deco = JSON.parse(d.decorationBounds || '[]'), hp = JSON.parse(d.hpTextBounds || '[]'), s = Number(d.cellScale);
  const at = key => deco.find(b => b.key === key);
  const cells = F.party.filter(u => u.alive && !u.moving).map(u => {
    const c = window.__proto.center(u.cell), body = at(`body${u.id}`), nick = at(`nick${u.id}`), h = hp.find(b => b.id === u.id);
    return { id: u.id, c, body, nick: nick && (nick.y - body.y) / s, hp: h && (h.y - body.y) / s, hpText: h?.text, inside: [nick, h].every(b => b && b.x - b.w / 2 >= -0.5 && b.x + b.w / 2 <= r.width + 0.5 && b.y - b.h / 2 >= -0.5 && b.y + b.h / 2 <= r.height + 0.5) };
  });
  return { s, k: Number(d.drawScale), look: d.cellLook, nick: Number(d.nickFontSize), hp: Number(d.hpFontSize), compact: d.compactCells, cells };
});
/** 일시정지에서 켜고 끔 → 계속 */
async function setFive(page, on) {
  await page.click('#pauseBtn'); await page.clock.runFor(50);
  const shown = await page.isVisible('#pauseFive');
  if (shown && await page.isChecked('#pauseFive') !== on) await page.click('#pauseFive');
  await page.click('#resumeBtn'); await page.clock.runFor(150);
  return shown;
}

export default async function raidFiveLook(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, detail) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) { fails++; if (detail) console.log(JSON.stringify(detail).slice(0, 1500)); } };
  try {
    for (const [name, width, height] of DEVICES) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push(`${name}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
      await page.clock.install({ time: new Date(2026, 9, 11, 12) });
      await page.goto(url); await page.clock.runFor(300);
      if (name === DEVICES[0][0]) {
        // 설정 화면: 전투 화면 묶음에 있고 처음엔 꺼짐. 켜면 저장됨
        await pastTitle(page);
        await page.click('#s-lobby .tb-set'); await page.clock.runFor(100);
        const box = '#s-settings [data-tog="raidFiveLook"]';
        const seen = await page.isVisible(box);
        ok(seen && !(await page.isChecked(box)), `${name}: 설정 → 전투 화면에 「레이드 판을 5인 던전 모양으로」, 처음엔 꺼짐`);
        if (seen) {
          await page.click(box); await page.clock.runFor(50);
          const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).settings.raidFiveLook);
          ok(saved === true, `${name}: 켜면 저장`, { saved });
          await page.click(box); await page.clock.runFor(50);
        }
      }
      await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: false, vibrate: false, reducedEffects: false, zoom: false, raidFiveLook: false } });
      let five = null;
      for (const b of BOARDS) {
        const tag = `${name} ${width}×${height} ${b.n}인`;
        await toParty(page, { tab: b.tab, content: b.content, diff: '쉬움' });
        await departGo(page); await page.clock.runFor(6500);
        await page.evaluate(() => { const F = window.__proto.F; F.skills.forEach(k => { k.next = Infinity; }); F.party.forEach(u => { u.hp = u.max * 0.62; }); });
        await page.clock.runFor(100);
        const own = await look(page);
        ok(own.look === 'own' && own.k === 1, `${tag}: 꺼져 있으면 예전 그대로`, own);
        const shown = await setFive(page, true);
        const on = await look(page);
        if (b.n === 5) {
          five = own;
          ok(!shown, `${tag}: 5인 판 일시정지엔 스위치 없음`);
          ok(on.look === 'own' && on.k === 1 && on.s === own.s, `${tag}: 켜도 5인 판은 그대로`, on);
        } else {
          ok(shown, `${tag}: 레이드 일시정지에 스위치`);
          const k = own.s / five.s;
          ok(on.look === 'five' && near(on.k, k, 0.002) && on.s === own.s, `${tag}: 켜면 판 크기는 그대로, 배율 = 레이드 칸 ÷ 5인 칸 (${on.k} ≈ ${k.toFixed(4)})`, { on, own: own.s, five: five.s });
          ok(on.compact === 'false' && near(on.nick, five.nick * on.k, 0.02) && near(on.hp, five.hp * on.k, 0.02),
            `${tag}: 글자 크기 = 5인 칸 글자 × 배율 (이름 ${on.nick} · 체력 ${on.hp})`, { on, five: { nick: five.nick, hp: five.hp } });
          // 칸 안 자리 (칸 크기로 나눔)가 5인 칸과 같음 · 체력은 5인처럼 숫자 · 칸 자리는 화면 좌표 그대로 · 글자는 판 안
          const ref = five.cells.find(c => c.nick != null && c.hp != null);
          const bad = on.cells.filter(c => !c.body || Math.hypot(c.body.x - c.c.x, c.body.y - c.c.y) > 1.5 || !near(c.nick, ref.nick, 0.03) || !near(c.hp, ref.hp, 0.03) || !/^!?\d+$/.test(c.hpText) || !c.inside);
          ok(on.cells.length >= b.n - 2 && !bad.length, `${tag}: 칸마다 이름 · 체력 자리가 5인 칸과 같은 비율, 체력은 숫자, 칸 자리 = 화면 좌표`, { bad: bad.slice(0, 3), ref });
          // 터치: 화면 좌표의 칸 가운데를 누르면 그 사람에게 치유
          const t = await page.evaluate(() => {
            const F = window.__proto.F, el = document.querySelector('#board'), r = el.getBoundingClientRect();
            const u = F.party.filter(x => x.alive && !x.me && !x.moving)[3];
            u.hp = u.max * 0.5; F.mana = 100; F.gcd = 0; F.cast = null; F.queued = null;
            const p = window.__proto.center(u.cell), q = { x: p.x + 0.55 * Number(el.dataset.cellScale), y: p.y };
            for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch',
              pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.x + q.x, clientY: r.y + q.y }));
            return { id: u.id, cast: F.cast && { key: F.cast.key, uid: F.cast.uid } };
          });
          ok(t.cast?.uid === t.id, `${tag}: 줄여 그린 칸을 눌러도 그 사람에게 치유`, t);
          // 길게 누르기 상세창은 누른 칸 위쪽 · 말풍선 꼬리는 말한 사람 칸에 (둘 다 화면 좌표로 맞춤)
          const cv = await page.locator('#board').boundingBox();
          const p = await page.evaluate(() => { const F = window.__proto.F; const u = F.party.filter(x => x.alive && !x.moving).reduce((a, b) => (b.cell > a.cell ? b : a)); u.hp = u.max; return { id: u.id, ...window.__proto.center(u.cell) }; });
          await page.mouse.move(cv.x + p.x, cv.y + p.y); await page.mouse.down(); await page.clock.runFor(600);
          const pv = await page.evaluate(() => { const el = document.querySelector('#preview'), r = el.getBoundingClientRect(); return { hidden: el.hidden, bottom: r.bottom, noarrow: el.classList.contains('noarrow'), ax: parseFloat(el.style.getPropertyValue('--ax')), left: r.left, r: Number(document.querySelector('#board').dataset.cellScale) * 0.93 }; });
          const cellTop = cv.y + p.y - pv.r;
          ok(!pv.hidden && pv.bottom <= cellTop + .5 && pv.bottom >= cellTop - 40 && !pv.noarrow && Math.abs(pv.left + pv.ax - (cv.x + p.x)) <= 2,
            `${tag}: 켠 판에서 길게 누르면 상세창 꼬리가 누른 칸 위 (아래 끝 ${Math.round(pv.bottom)} · 칸 위 ${Math.round(cellTop)})`, { pv, p, cv });
          await page.mouse.up(); await page.mouse.move(cv.x + 4, cv.y + 4); await page.mouse.down(); await page.mouse.up(); await page.clock.runFor(50);
          await page.evaluate(id => window.__proto.say(id, '여기 좀 봐 주세요', 'talk', 1500), p.id);
          await page.clock.runFor(250);
          const bb = await page.evaluate(id => {
            const cv = document.querySelector('#board'), all = JSON.parse(cv.dataset.decorationBounds || '[]'), F = window.__proto.F, u = F.party.find(x => x.id === id);
            const c = window.__proto.center(u.cell), r = Number(cv.dataset.cellScale) * 0.93, b = all.find(x => x.key === `bubble${id}`);
            if (!b) return null;
            const above = b.bottom <= c.y;
            return { gap: above ? (c.y - r) - b.bottom : b.top - (c.y + r), tailIn: c.x >= b.left && c.x <= b.right, moving: !!u.moving };
          }, p.id);
          ok(!bb || bb.moving || (Math.abs(bb.gap) <= 2 && bb.tailIn), `${tag}: 켠 판에서 말풍선이 말한 사람 칸에 붙음`, bb);
          if (name === DEVICES[0][0]) await page.screenshot({ path: `${shots}/raid_five_${b.n}.png` });
          const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).settings.raidFiveLook);
          ok(saved === true, `${tag}: 일시정지에서 켠 것도 설정에 저장`, { saved });
          await setFive(page, false);
          const off = await look(page);
          ok(off.look === 'own' && off.k === 1 && off.s === own.s && off.compact === own.compact, `${tag}: 다시 끄면 예전 그대로`, off);
        }
        await page.goto(url); await page.clock.runFor(300);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return { fails, errs };
}
