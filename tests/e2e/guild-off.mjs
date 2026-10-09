// 출시판 길드 빼 둠 (Lim 2026-10-09, src/data/features.ts): Lv 30 · 옛 저장에 길드원·길드파티 편성·길드 임무가 있어도
// 탭·로비 길드 회관·편성 「길드파티」·레이드 문 길드원 줄·임무 길드 주간 목표가 안 보이고, 편성은 공개모집 그대로
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function guildOff(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const text = sel => page.textContent(sel);
  await page.clock.install({ time: new Date(2026, 9, 7, 12) });
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);
  // 옛 저장: 길드원 2명 + 지난 길드파티 편성 + 오늘 일일 임무에 「길드파티로 클리어」. 개발 빌드 「레벨 잠금 무시」도 켠 채로
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.level = 30; s.player.gold = 20000; s.settings.devUnlock = true;
    const m = (id, nick, cls) => ({ id, nick, cls, pers: '신중파', traits: [], lv: 28, xp: 0, apt0: [3, 3, 3], aptUp: [0, 0, 0], ab: 'warrior.shieldBlock', star: 0, runs: 3 });
    s.guild.members = [m(1, '옛길드탱커', 'warrior'), m(2, '옛길드딜러', 'warrior')];
    s.guild.pick = [1, 2]; s.guild.nextId = 3;
    if (s.daily.missions[4]) s.daily.missions[4] = { key: 'guild2', n: 0, got: false };
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);

  // ---- 탭 · 로비 ----
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#tabs button')].map(b => b.dataset.tab).join());
  ok(tabs === 'lobby,battle,char,shop', `하단 탭 4개, 길드 없음 (${tabs})`);
  const tw = await page.locator('#tabs button').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  ok(tw.every(w => Math.abs(w - tw[0]) <= 1) && tw.reduce((a, b) => a + b, 0) >= 356, `탭 4개가 화면 너비를 똑같이 나눔 ${JSON.stringify(tw)}`);
  ok(await page.isVisible('#s-lobby') && (await page.locator('#s-lobby .lb-guild').count()) === 0 && !/길드/.test(await text('#s-lobby')), '로비: 길드 회관 이름표 없음, 「길드」 글자 없음');
  await page.screenshot({ path: `${shots}/guild_off_lobby.png` });

  // ---- 임무: 길드 임무 없음 ----
  await page.click('#s-lobby .lb-missions .lb-rmain'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-missions') && (await page.locator('#s-missions .mlist').first().locator('.mrow').count()) === 5, '임무 화면: 일일 5개');
  ok(!/길드/.test(await text('#s-missions')), '임무: 「길드파티로 클리어」·길드 주간 목표 없음');
  const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  ok(!sv.daily.missions.some(m => m.key === 'guild2') && !sv.daily.swapped, '옛 저장의 길드 임무는 교체 횟수 없이 다른 임무로 바뀜');

  // ---- 편성: 공개모집만 ----
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await toParty(page);
  ok(await page.isVisible('#s-party') && (await page.locator('#s-party .subtabs').count()) === 0, '편성: 공개모집·길드파티 폴더 탭 없음');
  const pty = await text('#s-party');
  ok(!/길드/.test(pty) && !/옛길드/.test(pty), '편성: 지난 길드파티 편성이 있어도 공개모집 파티 그대로 (길드원 안 들어옴)');
  await page.screenshot({ path: `${shots}/guild_off_party.png` });

  // ---- 레이드 문 (Lv 25~34): 길드원 줄 없음 ----
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 25; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  const gate = await text('#s-lobby .gate');
  ok(/심연의 탑/.test(gate) && !/길드원/.test(gate) && (await page.locator('#s-lobby .gate .obj').count()) === 2, `레이드 문 목표 = 레벨·장비 2줄 (${gate.replace(/\s+/g, ' ').trim()})`);

  await browser.close();
  return { fails, errs };
}
