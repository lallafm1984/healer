// 직업별 스킬 PXF 이펙트 (Lim 2026-10-11): 휠 스킬이 들어간 순간 (엔진 Fight.used)마다 그 스킬의 프레임 띠가
// 대상 칸 · 범위 안 아군 칸마다 · 파티 전원 칸마다 재생되고 (크기 = 칸 지름 × logicalSize/62, 판 가장자리면 줄어듦), 끝나면 사라짐.
// 엔진이 언제 남기는지는 tests/pxf.test.ts, 실제 탭 → 치유 시전은 pxf-heal.mjs. 여기선 기록을 직접 넣어 모든 스킬의 그림 · 칸 수를 봄. S25 × 5인 · 20인 판
import { chromium } from 'playwright';
import { departGo, patchSave, toParty } from './nav.mjs';

const BOARDS = [{ n: 5, tab: 'dungeon', content: 'rustfort' }, { n: 20, tab: 'raid20', content: 'cathedral1' }];

export default async function skillPxf(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, detail) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) { fails++; if (detail) console.log(JSON.stringify(detail)); } };
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 11, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: false, vibrate: false, reducedEffects: false, zoom: false } });
    for (const b of BOARDS) {
      await toParty(page, { tab: b.tab, content: b.content, diff: '쉬움' });
      await departGo(page); await page.clock.runFor(6500);
      const skills = await page.evaluate(() => { window.__proto.F.skills.forEach(k => { k.next = Infinity; }); return Object.entries(window.__proto.pxf.skills); });
      ok(skills.length >= 25, `${b.n}인: PXF 이펙트가 붙은 휠 스킬 ${skills.length}개`);
      // 손그림풍 스킬 이펙트는 지금 직업 것만 미리 읽음 (resetBoardFx): 여기선 모든 직업 스킬을 보므로 띠를 다 읽어 둠 (ready가 읽기 시작)
      for (let i = 0; i < 60 && !(await page.evaluate(list => list.every(([, s]) => window.__proto.pxf.ready(s.fx)), skills)); i++) { await page.clock.runFor(100); await page.waitForTimeout(50); }
      // 5인은 모든 스킬, 20인은 범위 · 파티 스킬만 (칸 수가 다름)
      for (const [key, { fx, scope }] of skills) {
        if (b.n === 20 && scope === 'target') continue;
        const t = await page.evaluate(([key]) => {
          const F = window.__proto.F, el = document.querySelector('#board'), r = el.getBoundingClientRect();
          // 이펙트만 보는 동안 판이 끝나지 않게 (몇십 초 흐름): 파티 · 적 체력을 채워 둠
          F.bossHp = F.bossMax; for (const x of [...F.party, ...F.mobs]) if (x.alive !== false) x.hp = x.max;
          const mid = { x: r.width / 2, y: r.height / 2 }, dist = u => { const p = window.__proto.center(u.cell); return Math.hypot(p.x - mid.x, p.y - mid.y); };
          const u = F.party.filter(x => x.alive).sort((a, c) => dist(a) - dist(c))[0];
          (F.used ??= []).push({ key, uid: u.id });
          return { uid: u.id, want: window.__proto.pxf.targets(key, u.id), s: Number(el.dataset.cellScale), logical: window.__proto.pxf.clip(window.__proto.pxf.skills[key].fx).logicalSize };
        }, [key]);
        await page.clock.runFor(120);
        const g = await page.evaluate(fx => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').filter(d => d.key.startsWith('pxf') && d.key.includes(`-${fx}-`)), fx);
        const ids = [...new Set(g.map(d => Number(d.key.slice(3, d.key.indexOf('-')))))].sort((a, c) => a - c);
        const size = 2 * t.s * 0.93 * t.logical / 62;
        ok(JSON.stringify(ids) === JSON.stringify([...t.want].sort((a, c) => a - c)) && ids.length >= 1,
          `${b.n}인 ${key} (${scope}): ${fx} 이펙트가 ${ids.length}칸에`, { ids, want: t.want });
        ok(g.every(d => Math.abs(d.requestedDiameter - size) < 0.5 && d.diameter <= d.requestedDiameter + 0.01 && d.frame >= 0), `${b.n}인 ${key}: 크기 칸 지름 × ${t.logical}/62 (${size.toFixed(1)}px)`, g.slice(0, 2));
        if (b.n === 5) {
          const half = Math.max(48, t.s * 1.6), p = await page.evaluate(uid => { const F = window.__proto.F, u = F.party.find(x => x.id === uid), r = document.querySelector('#board').getBoundingClientRect(), c = window.__proto.center(u.cell); return { x: r.x + c.x, y: r.y + c.y }; }, t.uid);
          await page.screenshot({ path: `${shots}/skill_pxf_${key}.png`, clip: { x: p.x - half, y: p.y - half, width: half * 2, height: half * 2 } });
        }
        await page.clock.runFor(1300);
        const left = await page.evaluate(fx => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').filter(d => d.key.startsWith('pxf') && d.key.includes(`-${fx}-`)).length, fx);
        ok(left === 0, `${b.n}인 ${key}: 끝나면 사라짐`);
      }
      await page.click('#pauseBtn'); await page.click('#quitBtn'); await page.click('#confirmApply');
      await page.clock.runFor(120); await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(80);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  return { fails, errs };
}
