// 성장 (07 3장 던전 레벨 단계·어픽스, 18 3-3 로비 레이드 문)·주간 도전 「침묵의 시계」 (13 3-2)·광고 이어하기·광고 다시 뽑기 (15 7장)
import { chromium } from 'playwright';
import { killEnemies, pastTitle } from './nav.mjs';

export default async function challenge(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  const text = sel => page.textContent(sel);
  const F = fn => page.evaluate(fn);
  const lose = async () => { await F(() => { const f = window.__proto.F; f.me.hp = 0; f.me.alive = false; }); await page.clock.runFor(1500); };
  /** 남은 구간을 다 이김 (휴식 → 계속) */
  const winAll = async () => {
    for (let i = 0; i < 6; i++) {
      await killEnemies(page); await page.clock.runFor(1500);
      if (!(await page.isVisible('#rest'))) break;
      await page.click('#restGo'); await page.clock.runFor(3100 + 300);
    }
  };
  await page.clock.install({ time: new Date(2026, 9, 7, 12) });
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 30; s.player.gold = 50000; s.settings.devUnlock = false; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);

  // ---- 로비: 레이드 문 (18 3-3) ----
  const gate = await text('#s-lobby .gate');
  ok(/심연의 종탑/.test(gate) && /레벨 35/.test(gate) && /0 \/ 6/.test(gate) && /0 \/ 6 부위/.test(gate) && (await page.locator('#s-lobby .gate .obj.ok').count()) === 0, `로비 다음 목표 = 10인 레이드 문 (레벨·길드원·장비, 아직 다 안 됨)`);
  await page.screenshot({ path: `${shots}/growth_gate.png` });

  // ---- 콘텐츠: 주간 도전 카드 ----
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  const card = await text('#s-content [data-chal]');
  ok(/주간 도전/.test(card) && /침묵의 시계/.test(card) && /메마름/.test(card) && /전염병/.test(card), '던전 장소 줄 맨 앞 = 주간 도전 칸 (이번 주 메마름·전염병, 화면 읽기 글)');
  ok(/단계 Lv 30/.test(await text('#s-content .b-gate')) && /격노/.test(await text('#s-content .b-gate .b-afx')), 'Lv 30 = 녹슨 요새 관문이 자동으로 단계 Lv 30 + 격노 (고르는 칩 없음)');

  // ---- 던전 레벨 단계 (07 3장): 내 레벨로 자동 (2026-10-08) ----
  await page.click('#s-content [data-content="rustfort"]'); await page.clock.runFor(50);
  await page.click('#contentGo'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party') && (await page.locator('[data-tier]').count()) === 0, '출전 = 바로 편성, 레벨 단계 칩 없음');
  ok(/단계 Lv 30/.test(await text('#s-party .topbar')) && /격노/.test(await text('#s-party .topbar .f-afxs')), '편성 머리 = 단계 Lv 30 + 격노');
  await page.click('#guideOpen'); await page.clock.runFor(50);
  ok(/격노/.test(await text('#s-party .f-gsheet .afxlist')), '공략 시트에 단계 어픽스 격노 설명');
  await page.screenshot({ path: `${shots}/growth_tier.png` });
  await page.click('#s-party .f-gsheet [data-shut]'); await page.clock.runFor(50);
  await page.click('#depart'); await page.clock.runFor(3100 + 300);
  const fs = await F(() => { const f = window.__proto.F; return { stage: f.cfg.stageLv, rage: !!f.aff?.on.rage }; });
  ok(await page.isVisible('#battle') && fs.stage === 30 && fs.rage, `전투 = 단계 Lv 30 + 격노 (${JSON.stringify(fs)})`);

  // ---- 광고 이어하기 (15 7장) ----
  await lose();
  ok(await page.isVisible('.admodal.ask') && /오늘 3번/.test(await text('.admodal.ask')) && /등급 최대 B/.test(await text('.admodal.ask')), '지면 이어하기 창 (오늘 3번 · 등급 최대 B)');
  await page.screenshot({ path: `${shots}/growth_continue.png` });
  await page.click('.admodal.ask [data-ask="ok"]'); await page.clock.runFor(50);
  ok(await page.isVisible('.admodal') && /광고 자리/.test(await text('.admodal')), '광고 자리 창');
  await page.click('.admodal [data-ad="ok"]'); await page.clock.runFor(3100 + 300);
  const rs = await F(() => ({ over: window.__proto.F.over, cont: window.__proto.dungeon.cont, idx: window.__proto.dungeon.idx }));
  ok(await page.isVisible('#battle') && !rs.over && rs.cont === 1 && rs.idx === 0 && (await save()).daily.ads.cont === 1, `진 구간부터 다시 (${JSON.stringify(rs)})`);
  await winAll();
  ok(await page.isVisible('#s-settle') && /광고로 이어 함 1번/.test(await text('#s-settle')) && (await text('#s-settle .grade')) === 'B', '이어서 깬 판 = 등급 B');
  ok(/Lv 30/.test(await text('#s-settle .res-head p')), '정산에 Lv 30 단계');

  // ---- 주간 도전 (13 3-2) ----
  await page.click('#toReward'); await page.clock.runFor(100);
  await page.click('#s-reward [data-go="s-lobby"]'); await page.clock.runFor(100);
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  await page.click('#s-content [data-chal]'); await page.clock.runFor(100);
  const ent = await text('#s-entry');
  ok((await text('#s-entry .chalstep b')) === '1단계' && await page.isDisabled('#s-entry [data-cstep="1"]') && /7:00/.test(ent) && /메마름/.test(ent) && /광고 이어하기 없음/.test(ent), '도전 입장: 1단계 · 제한 7:00 · 이번 주 어픽스 · 규칙');
  await page.screenshot({ path: `${shots}/challenge_entry.png`, fullPage: true });
  await page.click('#entryGo'); await page.clock.runFor(100);
  ok(/주간 도전 1단계/.test(await text('#s-party .topbar')) && (await page.locator('#adReroll').count()) === 0, '편성: 첫 다시 뽑기는 무료라 광고 버튼 없음');
  await page.click('#reroll'); await page.clock.runFor(50);
  ok(/오늘 2번/.test(await text('#adReroll')), '두 번째부터 광고 보고 무료로 다시 뽑기 (오늘 2번)');
  const g0 = (await save()).player.gold;
  await page.click('#adReroll'); await page.clock.runFor(50);
  await page.click('.admodal [data-ad="ok"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.daily.ads.reroll === 1 && sv.player.gold === g0 && /오늘 1번/.test(await text('#adReroll')), '광고 다시 뽑기: 골드 그대로, 오늘 1번 남음');
  await page.click('#depart'); await page.clock.runFor(3100 + 300);
  const cf = await F(() => { const f = window.__proto.F; return { dry: !!f.aff?.on.dry, con: !!f.aff?.on.contagion, stage: f.cfg.stageLv }; });
  ok(cf.dry && cf.con && cf.stage === 30 && /\/ 7:00/.test(await text('#timer')), `도전 전투: 메마름·전염병, 단계 레벨 = 내 레벨, 타이머 / 7:00 (${JSON.stringify(cf)})`);
  await lose();
  ok(!(await page.isVisible('.admodal')) && await page.isVisible('#s-settle') && /단계는 그대로/.test(await text('#s-settle')), '도전은 이어하기 없음 · 실패해도 단계 그대로');
  await page.click('#retry'); await page.clock.runFor(3100 + 300);
  await winAll();
  sv = await save();
  ok(/제한시간 안/.test(await text('#s-settle')) && /2단계 열림/.test(await text('#s-settle')) && sv.chalOpen === 2 && sv.weekly.chalBest === 1, '제한시간 안에 깸 → 2단계 열림, 이번 주 최고 1단계');
  await page.screenshot({ path: `${shots}/challenge_settle.png`, fullPage: true });
  await page.click('#toReward'); await page.clock.runFor(100);
  ok((await text('#s-reward #again')) === '2단계 도전', '보상: 「2단계 도전」 버튼');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
