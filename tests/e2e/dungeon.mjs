// 던전 흐름 (23): 메뉴 → 공략 → 잡몹 구간 → 휴식 → 다음 구간 … → 정산. 구간은 잡몹·보스 체력을 깎아 빨리 넘긴다
import { chromium } from 'playwright';

export default async function dungeon(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  ok(await page.getAttribute('[data-enc="rustfort"]', 'aria-pressed') === 'true', '메뉴 기본 = 녹슨 요새');
  ok(!(await page.locator('[data-enc="gate"], [data-enc="scrap"], [data-enc="boiler"]').count()), '던전 안 구간은 메뉴에 따로 없음');
  ok((await page.locator('#partyList .member').count()) === 4, '5인 파티 (나 빼고 4명)');
  await page.click('#startBtn'); await page.clock.runFor(300);
  const g = await page.textContent('#guideBody');
  ok(/무너진 정문/.test(g) && /고철 졸개 ×3/.test(g) && /녹슨 요새 1\/4/.test(g), '첫 공략 = 무너진 정문 잡몹 (잡는 순서)');
  ok(!/광폭화 Infinity|NaN/.test(g), '잡몹 공략에 광폭화·NaN 없음');
  await page.screenshot({ path: `${shots}/dungeon_guide.png` });
  await page.click('#guideGo'); await page.clock.runFor(3100 + 4000);
  ok(/무너진 정문 · 고철 졸개/.test(await page.textContent('#bossName')), '전투 위쪽 = 구간 이름 · 지금 잡는 잡몹');
  ok(/녹슨 요새 1\/4 · 남은 잡몹 4/.test(await page.textContent('#phase')), '진행 줄 = 1/4 · 남은 잡몹');
  await page.screenshot({ path: `${shots}/dungeon_trash.png` });
  const party0 = await page.evaluate(() => window.__proto.F.party.map(u => u.nick).join());

  const segs = ['고철 경비병', '증기 보일러실', '녹슨 문지기'];
  for (let i = 0; i < segs.length; i++) {
    // 남은 적 체력을 거의 0으로 → 다음 틱에 구간 끝
    await page.evaluate(() => { const F = window.__proto.F; F.mana = 37; F.g.p = 55; if (F.mobs.length) F.mobs.forEach(m => { m.hp = 0.01; }); F.bossHp = 0.01; });
    await page.clock.runFor(1500);
    ok(await page.isVisible('#rest'), `${i + 1}구간 끝 → 휴식 화면`);
    const rest = await page.textContent('#restBody');
    ok(rest.includes(segs[i]) && /계속/.test(await page.textContent('#restGo')), `휴식에서 다음 구간 미리보기: ${segs[i]}`);
    const pct = async () => parseInt(await page.textContent('#restPct'), 10);
    const m0 = await pct();
    ok(m0 >= 37 && m0 <= 41, `휴식 시작 마나 = 끝난 마나에서 이어서 (${m0}%)`);
    await page.clock.runFor(3000);
    const m1 = await pct();
    ok(Math.abs(m1 - m0 - 30) <= 1, `3초 쉬면 +30% (${m0} → ${m1})`);
    if (i === 0) await page.screenshot({ path: `${shots}/dungeon_rest.png` });
    await page.click('#restGo'); await page.clock.runFor(3100 + 500);
    const st = await page.evaluate(() => { const F = window.__proto.F; return { name: F.enc.name, mana: F.mana, p: F.g.p, party: F.party.map(u => u.nick).join(), full: F.party.every(u => u.alive && u.hp === u.max || u.me), idx: window.__proto.dungeon.idx }; });
    ok(st.name === segs[i] && st.idx === i + 1, `계속 → ${segs[i]} 시작`);
    ok(Math.abs(st.mana - m1) < 3 && st.p === 55, `마나·성언 게이지 이어받음 (휴식 ${m1}% → ${st.mana.toFixed(1)}, 평온 ${st.p})`);
    ok(st.party === party0, '같은 파티');
  }
  await page.screenshot({ path: `${shots}/dungeon_boss.png` });
  await page.evaluate(() => { window.__proto.F.bossHp = 0.01; });
  await page.clock.runFor(1500);
  ok(await page.isVisible('#result') && (await page.textContent('#resTitle')) === '던전 클리어!', '마지막 보스 → 던전 클리어 정산');
  const res = await page.textContent('#resStats');
  ok(/4 \/ 4 구간/.test(res) && /던전 전체 시간/.test(res), '정산에 던전 진행·전체 시간');
  await page.screenshot({ path: `${shots}/dungeon_result.png` });

  // 잡몹 구간에서 지면 던전 실패
  await page.click('#againBtn'); await page.clock.runFor(3100 + 500);
  ok(await page.evaluate(() => window.__proto.dungeon.idx === 0 && window.__proto.F.enc.key === 'gate'), '다시 도전 = 던전 처음부터');
  await page.evaluate(() => { const F = window.__proto.F; F.party.filter(u => u.role === 'tank').forEach(u => { u.hp = 1; u.guardian = 0; }); F.party.forEach(u => { if (!u.me) u.hot = 0; }); });
  await page.clock.runFor(8000);
  ok(await page.isVisible('#result') && (await page.textContent('#resTitle')) === '전멸' && /0 \/ 4 구간/.test(await page.textContent('#resStats')), '잡몹 구간에서 탱커가 쓰러지면 던전 실패');
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
