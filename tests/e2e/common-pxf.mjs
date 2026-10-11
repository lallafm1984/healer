// 모든 효과 PXF 1단계 (Lim 2026-10-11 「모든 효과를 이렇게 할지 검토」): 전투 공통 효과 (피격 · 치유 빛 · 치명타 별 · 해제 · 부활 · 쓰러짐 · 디버프 걸림 · 장비 발동)와
// 파티원 능력이 예전 그림 대신 PXF 프레임 띠로, 이름 · 체력 글자 아래 층에 그려짐. 회색 그림은 종류 색을 곱함. 끝나면 사라짐.
// 판 기록 열쇠는 예전 그림과 같은 앞머리 (heal12-… · death3-…), 파티원 능력은 pxf<id>-ally-<종류>-…. S25 × 5인 판
import { chromium } from 'playwright';
import { patchSave, toParty } from './nav.mjs';

export default async function commonPxf(url, shots) {
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
    await toParty(page, { tab: 'dungeon', content: 'rustfort', diff: '쉬움' });
    await page.click('#depart'); await page.clock.runFor(6500);
    const common = await page.evaluate(() => { window.__proto.F.skills.forEach(k => { k.next = Infinity; }); return window.__proto.pxf.common; });
    ok(Object.keys(common).length === 8, `전투 공통 PXF 효과 ${Object.keys(common).length}종`, common);
    // 판 가운데에 가까운 두 사람 (A = 대부분, B = 쓰러짐), 능력이 있는 파티원
    const who = await page.evaluate(() => {
      const F = window.__proto.F, el = document.querySelector('#board'), r = el.getBoundingClientRect();
      const mid = { x: r.width / 2, y: r.height / 2 }, dist = u => { const p = window.__proto.center(u.cell); return Math.hypot(p.x - mid.x, p.y - mid.y); };
      const [a, b] = F.party.filter(x => x.alive && !x.me && x.role !== 'tank').sort((p, q) => dist(p) - dist(q));
      const ab = F.party.find(x => x.alive && x.ab);
      return { a: a.id, b: b.id, roleA: a.role, roleB: b.role, ab: ab?.id ?? null, abFx: ab ? window.__proto.pxf.ally(ab.id) : null, s: Number(el.dataset.cellScale) };
    });
    const size = 2 * who.s * 0.93 * 64 / 62;
    const bounds = () => page.evaluate(() => JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]'));
    /** 사건을 넣고 (판이 끝나지 않게 체력을 채움) 0.1초 뒤 그 열쇠로 그려진 것 */
    const fire = async (events, prefix, setup) => {
      await page.evaluate(([events, setup]) => {
        const F = window.__proto.F;
        F.bossHp = F.bossMax; for (const x of [...F.party, ...F.mobs]) if (x.alive !== false) x.hp = x.max;
        if (setup) F.party.find(u => u.id === setup.id).flash = setup.flash;
        F.events.push(...events);
      }, [events, setup ?? null]);
      await page.clock.runFor(100);
      return (await bounds()).filter(d => d.kind === 'fx' && d.key.startsWith(prefix));
    };
    const shot = async (name, id) => {
      const half = Math.max(48, who.s * 1.6), p = await page.evaluate(uid => { const F = window.__proto.F, u = F.party.find(x => x.id === uid), r = document.querySelector('#board').getBoundingClientRect(), c = window.__proto.center(u.cell); return { x: r.x + c.x, y: r.y + c.y }; }, id);
      await page.screenshot({ path: `${shots}/common_pxf_${name}.png`, clip: { x: p.x - half, y: p.y - half, width: half * 2, height: half * 2 } });
    };
    const check = (g, label, want = {}) => {
      ok(g.length === 1, `${label}: PXF 한 장`, g);
      const d = g[0];
      if (!d) return;
      ok(d.layer === 'under' && d.frame >= 0, `${label}: 이름 · 체력 글자 아래 층`, d);
      ok(Math.abs(d.requestedDiameter - size) < 0.5 && d.diameter <= d.requestedDiameter + 0.01 && Math.abs(d.w - d.h) < 0.01, `${label}: 크기 칸 지름 × 64/62 (${size.toFixed(1)}px)`, d);
      if (want.gray) ok(typeof d.tint === 'number' && d.tint !== 0xffffff, `${label}: 회색 그림에 색을 칠함 (${d.tint?.toString(16)})`, d);
      else ok(d.tint == null, `${label}: 구운 색 그대로`, d);
    };
    const gone = async (label, prefix) => {
      await page.clock.runFor(1300);
      ok((await bounds()).filter(d => d.kind === 'fx' && d.key.startsWith(prefix)).length === 0, `${label}: 끝나면 사라짐`);
    };
    const A = who.a, B = who.b;

    let g = await fire([{ type: 'heal', id: A, eff: 100, amt: 100, crit: false }], `heal${A}-`);
    check(g, '치유 빛', { gray: true }); await shot('heal', A);
    ok((await bounds()).every(d => !d.key.startsWith(`heal-crit${A}-`)), '보통 치유엔 치명타 별 없음');
    await gone('치유 빛', `heal${A}-`);

    g = await fire([{ type: 'heal', id: A, eff: 300, amt: 300, crit: true }], `heal-crit${A}-`);
    check(g, '치명타 별'); await shot('crit', A);
    ok((await bounds()).some(d => d.key.startsWith(`heal${A}-`)), '치명타 치유도 치유 빛');
    await gone('치명타 별', `heal-crit${A}-`);

    g = await fire([], `hit${A}-`, { id: A, flash: 1 });
    check(g, '피격'); await shot('hit', A);
    await gone('피격', `hit${A}-`);

    g = await fire([{ type: 'dispel', id: A }], `dispel${A}-`);
    check(g, '해제'); await shot('dispel', A);
    await gone('해제', `dispel${A}-`);

    g = await fire([{ type: 'revive', id: A }], `revive${A}-`);
    check(g, '부활'); await shot('revive', A);
    await gone('부활', `revive${A}-`);

    const tints = [];
    for (const dtype of ['독', '저주']) {
      g = await fire([{ type: 'debuff', id: A, dtype }], `debuff${A}-`);
      check(g, `디버프 걸림 (${dtype})`, { gray: true }); tints.push(g[0]?.tint);
      if (dtype === '독') await shot('debuff', A);
      await gone(`디버프 걸림 (${dtype})`, `debuff${A}-`);
    }
    ok(tints[0] !== tints[1], `디버프 종류마다 색이 다름 (${tints.map(t => t?.toString(16)).join(' · ')})`);

    g = await fire([{ type: 'spec', id: A, name: '시험 능력' }], `proc${A}-`);
    check(g, '장비 발동', { gray: true }); await shot('proc', A);
    await gone('장비 발동', `proc${A}-`);

    g = await fire([{ type: 'death', id: B }], `death${B}-`);
    check(g, '쓰러짐', { gray: true }); await shot('death', B);
    await gone('쓰러짐', `death${B}-`);

    ok(who.ab != null && !!who.abFx, `능력이 있는 파티원 (${who.abFx})`, who);
    if (who.ab != null && who.abFx) {
      g = await fire([{ type: 'ability', id: who.ab, name: '시험 능력' }], `pxf${who.ab}-${who.abFx}-`);
      check(g, `파티원 능력 ${who.abFx}`); await shot(who.abFx, who.ab);
      await gone('파티원 능력', `pxf${who.ab}-${who.abFx}-`);
    }

    // 휠 스킬 PXF는 그대로 판 맨 위 층
    await page.evaluate(id => { (window.__proto.F.used ??= []).push({ key: 'flash', uid: id }); }, A);
    await page.clock.runFor(100);
    const top = (await bounds()).filter(d => d.key.startsWith(`pxf${A}-priest-flash-`));
    ok(top.length === 1 && top[0].layer === 'top', '휠 스킬 PXF는 판 맨 위 층', top);
    await ctx.close();
  } finally {
    await browser.close();
  }
  return { fails, errs };
}
