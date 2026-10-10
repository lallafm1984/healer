// 성언 준비 반짝임 (Lim 2026-10-10): 평온 · 신성화 게이지가 차서 휠 칸이 성언으로 바뀌면 칸이 반짝이고 게이지 줄도 반짝임. 대상 폰 크기 (S25 · 울트라 · 플립)
import { chromium } from 'playwright';
import { DEVICES } from './devices.mjs';
import { patchSave, toParty } from './nav.mjs';

export default async function wordReady(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  for (const [name, width, height] of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 10, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 40 } });
    await toParty(page, { tab: 'dungeon', content: 'rustfort', diff: '보통' });
    await page.click('#depart'); await page.clock.runFor(3100 + 300);
    const tag = `${name} ${width}×${height}`;
    /** 게이지를 바꾸고 화면이 몇 번 그려진 뒤 휠 칸 · 게이지 줄 상태 */
    const look = async (p, s) => {
      await page.evaluate(([p, s]) => {
        const F = window.__proto.F;
        F.skills.forEach(k => { k.next = Infinity; }); // 보스 기술은 끔 (게이지만 봄)
        F.g.p = p; F.g.s = s;
      }, [p, s]);
      await page.clock.runFor(300);
      return page.evaluate(() => {
        const one = slot => {
          const el = document.querySelector(`#wheel .slot[data-slot="${slot}"]`), cs = getComputedStyle(el), sheen = getComputedStyle(el.querySelector('.in'), '::after');
          return { holy: el.classList.contains('holy'), name: el.querySelector('.nm').textContent, anim: cs.animationName, shadow: cs.boxShadow, sheen: sheen.animationName, sheenOn: sheen.content !== 'none' };
        };
        const rows = [...document.querySelectorAll('#gauges .gr')].map(r => r.classList.contains('ready'));
        return { heal: one('heal'), poh: one('poh'), rows };
      });
    };
    await page.clock.runFor(100);
    const off = await look(40, 40);
    ok(!off.heal.holy && off.heal.name === '치유' && off.heal.anim === 'none' && off.heal.shadow === 'none' && !off.heal.sheenOn && !off.rows[0] && !off.rows[1], `${tag}: 게이지 40%면 치유 · 기원 칸 그대로 (반짝임 없음)`);
    const on = await look(100, 40);
    await page.clock.runFor(700);
    ok(on.heal.holy && on.heal.name === '평온' && /wordPop/.test(on.heal.anim) && /wordGlow/.test(on.heal.anim) && on.heal.shadow !== 'none' && on.heal.sheen === 'wordSheen' && on.rows[0] && !on.rows[1] && !on.poh.holy,
      `${tag}: 평온 100% → 치유 칸이 평온으로 바뀌고 반짝임 (금빛 테 맥동 ${on.heal.anim} · 빛줄기 ${on.heal.sheen}), 게이지 줄도`);
    const both = await look(100, 100);
    ok(both.poh.holy && both.poh.name === '신성화' && /wordGlow/.test(both.poh.anim) && both.poh.sheen === 'wordSheen' && both.rows[1], `${tag}: 신성화 100% → 기원 칸이 신성화로 바뀌고 반짝임`);
    await page.clock.runFor(600);
    await page.locator('#controls').screenshot({ path: `${shots}/word_ready_${width}x${height}.png` });
    // 효과 줄이기: 움직임은 멈추고 금빛 테만 남음
    const reduced = await page.evaluate(() => { // 화면 틀이 매 프레임 설정대로 클래스를 다시 붙이니 같은 순간에 읽음
      document.querySelector('#battle').classList.add('reduced-effects');
      const el = document.querySelector('#wheel .slot[data-slot="heal"]'), cs = getComputedStyle(el);
      const r = { anim: cs.animationName, shadow: cs.boxShadow };
      document.querySelector('#battle').classList.remove('reduced-effects');
      return r;
    });
    ok(reduced.anim === 'none' && reduced.shadow !== 'none', `${tag}: 효과 줄이기면 반짝임은 멈추고 금빛 테는 남음 (${reduced.anim} · ${reduced.shadow})`);
    const back = await look(0, 0);
    ok(!back.heal.holy && back.heal.name === '치유' && back.heal.anim === 'none' && !back.rows[0], `${tag}: 성언을 쓰면 (게이지 0) 반짝임이 꺼짐`);
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
