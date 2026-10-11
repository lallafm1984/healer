// 사제 치유 PXF 이펙트 (Lim 2026-10-11 시험): 칸을 눌러 치유가 들어가면 그 칸 가운데에 「치유 초록 반짝이 가루」 프레임이 재생되고
// 기본 치유 빛은 안 나옴. 보통 섞기 · 판 맨 위 층 (Lim 2026-10-11). 크기 = 칸 지름 × 64/62 (판 가장자리에선 줄어듦), 약 0.9초 뒤 사라짐. 대상 폰 크기 (S25 · 울트라 · 플립) × 5인 · 20인 판
import { chromium } from 'playwright';
import { DEVICES } from './devices.mjs';
import { patchSave, toParty } from './nav.mjs';

const BOARDS = [{ n: 5, tab: 'dungeon', content: 'rustfort' }, { n: 20, tab: 'raid20', content: 'cathedral1' }];

export default async function pxfHeal(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, detail) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) { fails++; if (detail) console.log(JSON.stringify(detail)); } };
  try {
    for (const [name, width, height] of DEVICES) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push(`${name}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
      await page.clock.install({ time: new Date(2026, 9, 11, 12) });
      await page.goto(url); await page.clock.runFor(300);
      await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: false, vibrate: false, reducedEffects: false, zoom: false } });
      for (const b of BOARDS) {
        const tag = `${name} ${width}×${height} ${b.n}인`;
        await toParty(page, { tab: b.tab, content: b.content, diff: '쉬움' });
        await page.click('#depart'); await page.clock.runFor(6500);
        // 보스 기술은 끄고, 가운데에 가까운 파티원 칸을 눌러 치유 (기본 탭 스킬). 상태 조작과 누르기는 한 번에
        const t = await page.evaluate(() => {
          const F = window.__proto.F, el = document.querySelector('#board'), r = el.getBoundingClientRect();
          F.skills.forEach(k => { k.next = Infinity; });
          const mid = { x: r.width / 2, y: r.height / 2 }, dist = u => { const p = window.__proto.center(u.cell); return Math.hypot(p.x - mid.x, p.y - mid.y); };
          const u = F.party.filter(x => x.alive && x.id !== F.me.id).sort((a, b) => dist(a) - dist(b))[0];
          u.hp = u.max * 0.5; F.mana = 100; F.gcd = 0; F.cast = null; F.queued = null;
          const p = window.__proto.center(u.cell);
          for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch',
            pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.x + p.x, clientY: r.y + p.y }));
          return { id: u.id, center: p, board: { x: r.x, y: r.y }, s: Number(el.dataset.cellScale), cast: F.cast && { key: F.cast.key, uid: F.cast.uid, left: F.cast.left } };
        });
        ok(t.cast?.key === 'heal' && t.cast.uid === t.id, `${tag}: 칸을 누르면 치유 시전`, t);
        if (!t.cast) continue;
        // 들어가기 직전까지 → 0.1초씩 보며 PXF 프레임 · 기본 치유 빛을 모음
        await page.clock.runFor(Math.max(0, t.cast.left * 1000 - 150));
        const seen = [], plain = [];
        let landed = false, shot = false;
        for (let i = 0; i < 16; i++) {
          await page.clock.runFor(i < 4 ? 50 : 100);
          const g = await page.evaluate(id => {
            const d = JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]'), F = window.__proto.F;
            const body = d.find(b => b.key === `body${id}`); // 대상 칸 (옮겨 가는 중이면 그리는 자리)
            return { pxf: d.filter(b => b.key.startsWith(`heal-pxf${id}-`)).map(b => ({ ...b, dx: b.x - body.x, dy: b.y - body.y })), plain: d.filter(b => b.key.startsWith(`heal${id}-`) || b.key.startsWith(`heal-glow${id}-`)),
              healed: F.stats.casts.heal >= 1 && !F.cast };
          }, t.id);
          landed ||= g.healed;
          seen.push(...g.pxf); plain.push(...g.plain);
          if (!shot && g.pxf.some(x => x.frame >= 4)) {
            shot = true;
            const key = `${name.replace(/[^\w가-힣]+/g, '_')}_${b.n}`;
            await page.screenshot({ path: `${shots}/pxf_heal_${key}.png` });
            const half = Math.max(48, t.s * 1.6);
            await page.screenshot({ path: `${shots}/pxf_heal_${key}_zoom.png`, clip: { x: t.board.x + t.center.x - half, y: t.board.y + t.center.y - half, width: half * 2, height: half * 2 } });
          }
        }
        const frames = [...new Set(seen.map(x => x.frame))].sort((a, c) => a - c);
        const want = 2 * t.s * 0.93 * 64 / 62;
        // 시계가 실제로도 흘러서 (느린 화면은 0.1초 사이에 여러 프레임) 본 프레임 수는 기기마다 다름: 맞는 순간 근처에서 시작해 넘어가기만 보면 됨
        ok(landed && frames.length >= 2 && frames[0] <= 4, `${tag}: 치유가 들어가면 반짝이 가루 재생 (본 프레임 ${frames.join(',')})`, { frames });
        // 피하는 중인 칸은 1px 안팎으로 떨리고 (fleeing) 이펙트는 칸 자리 그대로
        ok(seen.every(x => Math.abs(x.dx) < 1.5 && Math.abs(x.dy) < 1.5 && Math.abs(x.w - x.h) < 0.01),
          `${tag}: 대상 칸 가운데 정사각`, seen.slice(0, 2));
        ok(seen.every(x => Math.abs(x.requestedDiameter - want) < 0.5 && x.diameter <= x.requestedDiameter + 0.01),
          `${tag}: 크기 = 칸 지름 × 64/62 (${want.toFixed(1)}px, 판 가장자리면 줄어듦)`, seen.slice(0, 2));
        ok(plain.length === 0, `${tag}: 이 치유엔 기본 치유 빛 없음`, plain.slice(0, 2));
        await page.clock.runFor(600);
        const left = await page.evaluate(id => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]').filter(b => b.key.startsWith(`heal-pxf${id}-`)).length, t.id);
        ok(left === 0, `${tag}: 약 0.9초 뒤 사라짐`);
        await page.click('#pauseBtn'); await page.click('#quitBtn'); await page.click('#confirmApply');
        await page.clock.runFor(120); await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(80);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return { fails, errs };
}
