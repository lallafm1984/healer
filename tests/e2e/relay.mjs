// 사제 빛의 전이 (휠 8번째 칸, Lim 2026-10-11 「슬롯 한자리가 빈다」): 휠에 빈 칸 없음 · 빛이 깃든 사람 칸 왼쪽 원 (2026-10-20 Lim 「이미지빼고 왼쪽에 지속시간으로」)이 판 안, 이름·체력·배지와 안 겹침. 대상 폰 크기
import { chromium } from 'playwright';
import { DEVICES } from './devices.mjs';
import { departGo, patchSave, toParty } from './nav.mjs';

const PARTIES = [{ n: 5, tab: 'dungeon', content: 'rustfort' }, { n: 20, tab: 'raid20', content: 'cathedral1' }];

export default async function relay(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, info) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (c || !info ? '' : ` ${JSON.stringify(info)}`)); if (!c) fails++; };
  for (const [name, width, height] of DEVICES) for (const party of PARTIES) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 11, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 100 }, settings: { auto: false, devUnlock: true, sound: false, vibrate: false } });
    await toParty(page, { tab: party.tab, content: party.content, diff: '보통' });
    await departGo(page); await page.clock.runFor(3100 + 300);
    const tag = `${name} ${width}×${height} ${party.n}인`;

    const wheel = await page.evaluate(() => ({
      empty: document.querySelectorAll('#wheel .slot.empty').length,
      slots: document.querySelectorAll('#wheel button.slot').length,
      relay: document.querySelector('#wheel .slot[data-slot="unique"] .nm')?.textContent ?? null,
    }));
    ok(wheel.empty === 0 && wheel.slots === 8 && wheel.relay === '전이', `${tag}: 휠 8칸 모두 스킬 (빈 칸 없음, 8번째 칸 전이)`, wheel);

    /** 빛을 깃들게 하고 (보스 피해 0 · 기술 끔: 빛이 옮겨 가지 않게) 몇 프레임 뒤 판 표시 */
    const look = async ({ deb = false, hot = false, flying = false } = {}) => {
      await page.evaluate(([deb, hot, flying]) => {
        const F = window.__proto.F;
        F.skills.forEach(k => { k.next = Infinity; });
        F.dmgMult = 0;
        const tk = F.party.find(u => u.role === 'tank' && u.alive);
        tk.debuffs = deb ? [{ id: 9001, name: '독 화살', type: '독', left: 12, dot: 0 }] : [];
        tk.hot = hot ? 9 : 0;
        F.relay = { id: tk.id, left: 5, until: F.t + 999, flyUntil: flying ? F.t + 999 : F.t };
      }, [deb, hot, flying]);
      await page.clock.runFor(300);
      return page.evaluate(() => {
        const F = window.__proto.F, cv = document.querySelector('#board'), d = cv.dataset;
        const bounds = JSON.parse(d.decorationBounds || '[]'), id = F.relay?.id;
        const mark = bounds.find(b => b.key === `relay${id}`);
        const safe = { left: Number(d.boardSafeLeft), right: Number(d.boardSafeRight), top: Number(d.boardSafeTop), bottom: Number(d.boardSafeBottom) };
        const sep = (a, b) => a.right <= b.left + 0.05 || b.right <= a.left + 0.05 || a.bottom <= b.top + 0.05 || b.bottom <= a.top + 0.05;
        const others = bounds.filter(b => ['hp', 'nick', 'hot', 'role', 'aggro', 'pill'].includes(b.kind) || b.kind === 'debuff' && b.shape === 'pill');
        return {
          mark,
          inside: !!mark && mark.left >= safe.left - 0.05 && mark.right <= safe.right + 0.05 && mark.top >= safe.top - 0.05 && mark.bottom <= safe.bottom + 0.05,
          hits: mark ? others.filter(b => !sep(mark, b)).map(b => b.key) : [],
        };
      });
    };
    const plain = await look();
    ok(!!plain.mark && plain.inside && plain.hits.length === 0 && plain.mark.shape === 'circle', `${tag}: 탱커 칸 빛의 전이 남은 시간 원이 판 안, 다른 표시와 안 겹침 (칸 왼쪽 열)`, plain);
    await page.locator('#board').screenshot({ path: `${shots}/relay_${party.n}_${width}x${height}.png` });
    const busy = await look({ deb: true, hot: true });
    ok(!!busy.mark && busy.inside && busy.hits.length === 0, `${tag}: 디버프 배지 · 지속 힐이 함께 있어도 빛의 전이 표시가 안 겹침`, busy);
    await page.locator('#board').screenshot({ path: `${shots}/relay_busy_${party.n}_${width}x${height}.png` });
    const fly = await look({ flying: true });
    ok(!!fly.mark, `${tag}: 옮겨 가는 중에도 새 칸에 남은 시간 원 (옮겨 가는 그림은 없음)`, fly);
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
