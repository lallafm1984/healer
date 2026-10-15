// 전투 공통 효과 (피격 · 치유 빛 · 치명타 별 · 해제 · 부활 · 쓰러짐 · 디버프 걸림 · 장비 발동)와 파티원 능력이 손그림풍 프레임 띠로 (2026-10-16 Lim 「도트를 모두 제거」, scripts/vfx/common.mjs),
// 휠 스킬처럼 판 맨 위 층에 그려짐 (Lim 「파티원에서 최상단으로」). 크기 = 칸 지름 × logicalSize/62. 회색 그림은 종류 색을 곱함. 끝나면 사라짐.
// 판 기록 열쇠는 예전 그림과 같은 앞머리 (heal12-… · death3-…), 파티원 능력은 pxf<id>-ally-<종류>-…. S25 × 5인 판
// 끝에 찬가 정신 집중: 1초마다 회복하는 틱도 공통 치유 빛 대신 찬가 이펙트 (Lim 「스킬별로 이펙트가 달라야」)
import { chromium } from 'playwright';
import { departGo, patchSave, toParty } from './nav.mjs';

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
    await departGo(page); await page.clock.runFor(6500);
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
    // 효과마다 그림 지름 (battle/pxf.ts logicalSize)
    const logical = await page.evaluate(() => Object.fromEntries([...Object.values(window.__proto.pxf.common), 'ally-def', 'ally-ctl', 'ally-sup', 'ally-heal', 'ally-atk'].map(k => [k, window.__proto.pxf.clip(k).logicalSize])));
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
      ok(g.length === 1, `${label}: 이펙트 한 장`, g);
      const d = g[0];
      if (!d) return;
      const fx = want.fx, size = 2 * who.s * 0.93 * logical[fx] / 62;
      ok(d.frame >= 0, `${label}: 재생 (프레임 ${d.frame})`, d);
      ok(Math.abs(d.requestedDiameter - size) < 0.5 && d.diameter <= d.requestedDiameter + 0.01 && Math.abs(d.w - d.h) < 0.01, `${label}: 크기 칸 지름 × ${logical[fx]}/62 (${size.toFixed(1)}px)`, d);
      if (want.gray) ok(typeof d.tint === 'number' && d.tint !== 0xffffff, `${label}: 회색 그림에 색을 칠함 (${d.tint?.toString(16)})`, d);
      else ok(d.tint == null, `${label}: 구운 색 그대로`, d);
    };
    const gone = async (label, prefix) => {
      await page.clock.runFor(1300);
      ok((await bounds()).filter(d => d.kind === 'fx' && d.key.startsWith(prefix)).length === 0, `${label}: 끝나면 사라짐`);
    };
    const A = who.a, B = who.b;

    let g = await fire([{ type: 'heal', id: A, eff: 100, amt: 100, crit: false }], `heal${A}-`);
    check(g, '치유 빛', { gray: true, fx: 'common-heal' }); await shot('heal', A);
    ok((await bounds()).every(d => !d.key.startsWith(`heal-crit${A}-`)), '보통 치유엔 치명타 별 없음');
    await gone('치유 빛', `heal${A}-`);

    g = await fire([{ type: 'heal', id: A, eff: 300, amt: 300, crit: true }], `heal-crit${A}-`);
    check(g, '치명타 별', { fx: 'common-crit' }); await shot('crit', A);
    ok((await bounds()).some(d => d.key.startsWith(`heal${A}-`)), '치명타 치유도 치유 빛');
    await gone('치명타 별', `heal-crit${A}-`);

    g = await fire([], `hit${A}-`, { id: A, flash: 1 });
    check(g, '피격', { fx: 'common-hit' }); await shot('hit', A);
    await gone('피격', `hit${A}-`);

    g = await fire([{ type: 'dispel', id: A }], `dispel${A}-`);
    check(g, '해제', { fx: 'common-dispel' }); await shot('dispel', A);
    await gone('해제', `dispel${A}-`);

    g = await fire([{ type: 'revive', id: A }], `revive${A}-`);
    check(g, '부활', { fx: 'common-revive' }); await shot('revive', A);
    await gone('부활', `revive${A}-`);

    const tints = [];
    for (const dtype of ['독', '저주']) {
      g = await fire([{ type: 'debuff', id: A, dtype }], `debuff${A}-`);
      check(g, `디버프 걸림 (${dtype})`, { gray: true, fx: 'common-debuff' }); tints.push(g[0]?.tint);
      if (dtype === '독') await shot('debuff', A);
      await gone(`디버프 걸림 (${dtype})`, `debuff${A}-`);
    }
    ok(tints[0] !== tints[1], `디버프 종류마다 색이 다름 (${tints.map(t => t?.toString(16)).join(' · ')})`);

    g = await fire([{ type: 'spec', id: A, name: '시험 능력' }], `proc${A}-`);
    check(g, '장비 발동', { gray: true, fx: 'common-proc' }); await shot('proc', A);
    await gone('장비 발동', `proc${A}-`);

    g = await fire([{ type: 'death', id: B }], `death${B}-`);
    check(g, '쓰러짐', { gray: true, fx: 'common-death' }); await shot('death', B);
    await gone('쓰러짐', `death${B}-`);

    ok(who.ab != null && !!who.abFx, `능력이 있는 파티원 (${who.abFx})`, who);
    if (who.ab != null && who.abFx) {
      g = await fire([{ type: 'ability', id: who.ab, name: '시험 능력' }], `pxf${who.ab}-${who.abFx}-`);
      check(g, `파티원 능력 ${who.abFx}`, { fx: who.abFx }); await shot(who.abFx, who.ab);
      await gone('파티원 능력', `pxf${who.ab}-${who.abFx}-`);
    }

    // 찬가 정신 집중 (Lim 「스킬별로 이펙트가 달라야 하는데 중복되는 게 있다」): 1초마다 파티 전원 칸에 찬가 이펙트, 그 회복엔 공통 치유 빛 없음
    const alive = await page.evaluate(() => {
      const F = window.__proto.F;
      F.gear.crit = 0; F.bossHp = F.bossMax;
      for (const x of F.mobs) if (x.alive !== false) x.hp = x.max;
      for (const x of F.party) if (x.alive) x.hp = Math.round(x.max * 0.5);
      F.channel = 4; F.chTick = 0;
      return F.party.filter(x => x.alive).map(x => x.id).sort((a, b) => a - b);
    });
    await page.clock.runFor(1100);
    const hb = (await bounds()).filter(d => d.kind === 'fx');
    const hymn = [...new Set(hb.filter(d => d.key.startsWith('pxf') && d.key.includes('-priest-hymn-')).map(d => Number(d.key.slice(3, d.key.indexOf('-')))))].sort((a, b) => a - b);
    ok(JSON.stringify(hymn) === JSON.stringify(alive), `찬가 1초 틱: 파티 전원 ${alive.length}칸에 찬가 이펙트`, { hymn, alive });
    ok(hb.every(d => !/^heal\d+-/.test(d.key)), '찬가 틱 회복엔 공통 치유 빛 없음', hb.filter(d => /^heal\d+-/.test(d.key)).slice(0, 3));
    await shot('hymn_tick', A);

    await ctx.close();
  } finally {
    await browser.close();
  }
  return { fails, errs };
}
