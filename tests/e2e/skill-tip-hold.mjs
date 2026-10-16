// 스킬 · 특성 버튼 설명 팝업 (2026-10-16 Lim): 누르는 동안 유지, 손을 떼고 3초 뒤 또는 아무 곳이나 누르면 닫힘.
// S25 · 울트라 · 플립 크기에서 휠 스킬 칸과 특성 버튼 (소비 아이템 자리)을 같은 규칙으로 확인한다
import { chromium } from 'playwright';
import { departGo, patchSave, toParty } from './nav.mjs';
import { DEVICES } from './devices.mjs';

const TALENTS = [null, null, null, null, 0, null, 1, null, null, 0]; // 사제 특성 버튼 셋 (class-controls와 같은 고르기)

export default async function skillTipHold(url, shots) {
  const b = await chromium.launch(), errs = [];
  let fails = 0;
  const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || d === undefined ? '' : ' ' + JSON.stringify(d))); if (!c) fails++; };
  for (const [dev, width, height] of DEVICES) {
    const ctx = await b.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.clock.install(); await p.goto(url); await p.clock.runFor(300);
    await patchSave(p, { player: { level: 100 }, settings: { devUnlock: true, devStamina: true, auto: false } });
    await p.evaluate(picks => { const s = JSON.parse(localStorage.getItem('healer.save')); s.hero = 'priest'; s.heroes ??= {}; s.heroes.priest ??= {}; s.heroes.priest.talents = picks; localStorage.setItem('healer.save', JSON.stringify(s)); }, TALENTS);
    await p.reload(); await p.clock.runFor(300);
    await toParty(p, { tab: 'dungeon', content: 'rustfort', diff: '보통' }); await departGo(p); await p.clock.runFor(3400);
    await p.evaluate(() => {
      const f = window.__proto.F; f.skills.forEach(k => { k.next = Infinity; });
      // 손가락 하나로 누르고 있기 · 끌어 나가기 · 떼기
      window.__hold = (sel, type, dx = 0) => {
        const el = document.querySelector(sel), r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0,
          buttons: type === 'pointerup' ? 0 : 1, clientX: r.x + r.width / 2 + dx, clientY: r.y + r.height / 2 }));
      };
    });
    await p.clock.runFor(80);
    const shown = () => p.isVisible('#tip');
    const hold = (sel, type, dx) => p.evaluate(([sel, type, dx]) => window.__hold(sel, type, dx), [sel, type, dx]);
    const used = () => p.evaluate(() => { const f = window.__proto.F; return JSON.stringify([f.stats.casts, f.queued, f.cast, Object.values(f.tx.act).map(a => a.used || a.left > 0)]); });
    for (const [what, sel, re] of [['스킬', '#wheel .slot[data-slot="flash"]', /순간 치유/], ['특성', '#aux [data-tal]', /특성/]]) {
      const label = `${dev} ${width}x${height} ${what}`;
      ok(await p.locator(sel).count() > 0, `${label} 버튼 있음`);
      const before = await used();
      // 1) 누르는 동안: 예전 4초 자동 닫힘을 지나도 그대로
      await hold(sel, 'pointerdown'); await p.clock.runFor(500);
      ok(await shown() && re.test(await p.textContent('#tip')), `${label} 길게 누르면 설명 팝업`);
      await p.clock.runFor(5500);
      ok(await shown(), `${label} 6초 동안 누르고 있어도 팝업 유지`);
      await p.screenshot({ path: `${shots}/skill-tip-hold-${what === '스킬' ? 'skill' : 'talent'}-${width}x${height}.png` });
      // 2) 손을 떼면 3초 뒤 닫힘
      await hold(sel, 'pointerup'); await p.clock.runFor(2700);
      ok(await shown(), `${label} 손을 떼고 2.7초: 아직 떠 있음`);
      await p.clock.runFor(450);
      ok(!await shown(), `${label} 손을 떼고 3초 지나면 닫힘`);
      ok(await used() === before, `${label} 길게 누르기는 사용 안 함`);
      // 3) 손을 뗀 뒤 아무 곳이나 누르면 바로 닫힘
      await hold(sel, 'pointerdown'); await p.clock.runFor(500); await hold(sel, 'pointerup'); await p.clock.runFor(500);
      ok(await shown(), `${label} 다시 길게 눌렀다 뗌: 떠 있음`);
      const boss = await p.locator('#bossName').boundingBox();
      await p.touchscreen.tap(boss.x + boss.width / 2, boss.y + boss.height / 2); await p.clock.runFor(40);
      ok(!await shown(), `${label} 화면 다른 곳을 누르면 바로 닫힘`);
      // 4) 누른 채 손가락이 버튼 밖으로 나가도 그때부터 3초
      await hold(sel, 'pointerdown'); await p.clock.runFor(500); await hold(sel, 'pointermove', -400); await p.clock.runFor(2700);
      ok(await shown(), `${label} 끌어 나간 뒤 2.7초: 아직 떠 있음`);
      await hold(sel, 'pointerup', -400); await p.clock.runFor(450);
      ok(!await shown(), `${label} 끌어 나간 뒤 3초 지나면 닫힘`);
      ok(await used() === before, `${label} 끌어 나가도 사용 안 함`);
    }
    await ctx.close();
  }
  await b.close();
  return { fails, errs };
}
