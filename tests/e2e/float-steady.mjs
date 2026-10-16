// 2026-10-12 Lim 「전투씬에서 힐 수치 및 다른 숫자 표시 위치가 흔들린다」 (빌드 131).
// 떠오르는 숫자 (치유 · 피해 · 아군 치유 · 능력 이름)는 처음 잡은 자리에서 비킨 만큼을 지키며 올라감: 프레임마다 옆 · 위로 튀거나 두 자리 사이를 오가지 않음.
// 예전엔 프레임마다 판 전체에서 빈자리를 새로 찾아 S25 5인에서 숫자 82개 중 76개가 한 번 이상 튀었다 (최대 80px).
// 자동 힐러로 전투를 돌리며 파티원 체력을 깎아 숫자를 많이 띄우고, 프레임마다 판 기록(decorationBounds)의 숫자 자리를 그 사람 칸 움직임과 견줌
import { chromium } from 'playwright';
import { departGo, patchSave, toParty } from './nav.mjs';

const BOARDS = {
  3: { n: 3, tab: 'explore', content: 'plateau' },
  5: { n: 5, tab: 'dungeon', content: 'rustfort' },
  // 10 · 20인은 5인 던전 모양 (2026-10-16 Lim 기본)
  10: { n: 10, tab: 'raid10', content: 'abyss1' },
  20: { n: 20, tab: 'raid20', content: 'cathedral1' },
};
/** 폰마다 판 (S25는 전부, 울트라 · 플립은 판 둘씩) */
const RUNS = [
  ['S25', 360, 780, [3, 5, 10, 20]],
  ['S25 울트라', 384, 824, [5, 20]],
  ['Z 플립 펼침', 360, 880, [10, 20]],
];
/** 한 프레임에 이만큼 넘게 자기 칸과 따로 움직이면 튐 (올라가는 속도는 프레임당 1px 안팎) */
const JUMP = 3;

export default async function floatSteady(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg, info) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (c || !info ? '' : ` ${JSON.stringify(info).slice(0, 1500)}`)); if (!c) fails++; };
  for (const [name, width, height, boards] of RUNS) for (const key of boards) {
    const board = BOARDS[key];
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.clock.install({ time: new Date(2026, 9, 12, 12) });
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 60 }, settings: { auto: true, sound: false, vibrate: false, reducedEffects: false } });
    await toParty(page, { tab: board.tab, content: board.content, diff: '보통' });
    await departGo(page); await page.clock.runFor(3100 + 300);
    const tag = `${name} ${width}×${height} ${board.n}인`;
    // 판을 새로 그린 프레임마다 숫자 자리 · 그 사람 칸 자리를 적음 (가짜 시계는 프레임 순서가 가끔 뒤바뀌어 나중에 시각으로 정렬)
    await page.evaluate(() => {
      window.__floatTrace = [];
      let last = '';
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => raf(t => {
        cb(t);
        const raw = document.querySelector('#board')?.dataset.decorationBounds;
        if (!raw || raw === last) return;
        last = raw;
        const all = JSON.parse(raw), body = {};
        for (const b of all) if (b.kind === 'body') body[b.key.slice(4)] = [b.x, b.y];
        window.__floatTrace.push({ t: performance.now(), body, f: all.filter(b => b.kind === 'float').map(b => ({ key: b.key, x: b.x, y: b.y, uid: b.uid })) });
      });
    });
    for (let i = 0; i < 30; i++) {
      // 파티원 셋의 체력을 깎아 자동 힐러가 쉬지 않고 치유하게 (숫자를 많이 띄움)
      await page.evaluate(i => {
        const F = window.__proto.F, alive = F.party.filter(u => u.alive);
        for (let j = 0; j < 3; j++) { const u = alive[(i * 7 + j * 5) % alive.length]; u.hp = Math.max(1, Math.min(u.hp, u.max * (0.4 + 0.1 * j))); }
        F.mana = Math.max(F.mana, 80);
      }, i);
      await page.clock.runFor(200);
      if (i === 12 && name === 'S25') await page.screenshot({ path: `${shots}/float_steady_${key}.png` });
    }
    const trace = (await page.evaluate(() => window.__floatTrace)).sort((a, b) => a.t - b.t);
    const tracks = new Map();
    for (const fr of trace) for (const f of fr.f) {
      if (!tracks.has(f.key)) tracks.set(f.key, []);
      const own = fr.body[f.uid];
      tracks.get(f.key).push({ t: fr.t, x: f.x, y: f.y, bx: own?.[0], by: own?.[1] });
    }
    const cell = await page.evaluate(() => Number(document.querySelector('#board').dataset.cellScale));
    const jumpy = [];
    for (const [k, pts] of tracks) {
      const jumps = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (b.t - a.t > 40 || a.bx == null || b.bx == null) continue;
        if (Math.hypot(b.bx - a.bx, b.by - a.by) > 0.5) continue; // 그 사람이 걸어가거나 흔들리는 중 (숫자도 따라감)
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.hypot(dx, dy) > JUMP) jumps.push({ t: Math.round(b.t), dx: +dx.toFixed(1), dy: +dy.toFixed(1) });
      }
      // 오감 = 튄 다음 반대쪽으로 다시 튐 (두 자리 사이를 오가는 흔들림)
      const back = jumps.some((j, i) => i > 0 && j.dx * jumps[i - 1].dx + j.dy * jumps[i - 1].dy < 0);
      if (jumps.length) jumpy.push({ float: k, jumps: jumps.slice(0, 3), n: jumps.length, back, far: Math.max(...jumps.map(j => Math.hypot(j.dx, j.dy))) });
    }
    const total = tracks.size, back = jumpy.filter(j => j.back), far = jumpy.filter(j => j.far > cell * 0.4);
    ok(total >= 8, `${tag}: 떠오르는 숫자 ${total}개를 봄`, { total });
    // 자리가 가려지면 (다른 사람이 걸어와 더 가까워짐 · 체력 글자가 넓어짐) 0.35칸 안으로 한 번 비킴. 그런 숫자는 드묾
    ok(jumpy.length <= Math.max(1, total * 0.08) && back.length === 0 && far.length === 0,
      `${tag}: 숫자가 자리를 지키며 올라감 (비킨 숫자 ${jumpy.length}/${total}, 오간 숫자 ${back.length}, 0.4칸 넘게 튄 숫자 ${far.length})`, jumpy.slice(0, 5));
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
