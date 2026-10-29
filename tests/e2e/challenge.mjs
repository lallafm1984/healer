// 성장 (61 적 레벨 = 장소 + 난이도 · 32 어픽스, 18 3-3 로비 레이드 문)·주간 도전 「모래시계 시련」 (13 3-2)·실패 자동 정산
import { chromium } from 'playwright';
import { chooseContent, departGo, entryGo, killEnemies, pastTitle } from './nav.mjs';

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
  const forceLoss = () => F(() => { const f = window.__proto.F; f.me.hp = 0; f.me.alive = false; });
  const lose = async () => { await forceLoss(); await page.clock.runFor(2200); };
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
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 36; s.settings.devUnlock = false; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);

  // ---- 로비: 레이드 문 (18 3-3, 10인 열림 Lv 45의 10레벨 전부터) ----
  const gate = await text('#s-lobby .gate');
  ok(/심연의 탑/.test(gate) && /레벨 45/.test(gate) && /길드원 9명/.test(gate) /* 길드원만으로 10인을 다 채우는 인원 (2026-10-28 길드파티는 길드원만, 예전 자리 절반 5) */ && /0 \/ 6 부위/.test(gate) && (await page.locator('#s-lobby .gate .obj.ok').count()) === 0, `로비 다음 목표 = 10인 레이드 문 (레벨 · 길드원 · 장비, 아직 다 안 됨)`);
  await page.screenshot({ path: `${shots}/growth_gate.png` });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 30; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);

  // ---- 콘텐츠: 주간 도전 카드 (던전 분류. 들어오면 길잡이 추천 분류라 던전을 누름, 86) ----
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
  const card = await text('#s-content [data-chal]');
  ok(/주간 도전/.test(card) && /모래시계 시련/.test(card) && /옮겨붙는 역병/.test(card) && /메아리/.test(card) && /전염병/.test(card), '던전 분류의 주간 도전 버튼 (이번 주 옮겨붙는 역병·메아리·전염병, 화면 읽기 글, 115)');
  // ---- 적 레벨 = 장소 레벨 + 난이도 (61, 2026-10-11), 어픽스는 그 적 레벨 (32) ----
  await chooseContent(page, 'rustfort');
  ok(!/단계 Lv/.test(await text('#s-content .b-gate')) && (await page.locator('#s-content .b-gate .b-afx').count()) === 0, '녹슨 요새 (적 Lv 5~11) = 관문에 「단계 Lv」·어픽스 없음 (Lv 30이어도 격노 없음)');
  // 눈꽃 연구소 (Lv 30) 보통을 깬 기록 → 어려움 열림 (사슬, 61 1-1)
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.clears.snowlab = { '보통': { stars: 3, grade: 'A', best: 100, n: 1 } }; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
  await chooseContent(page, 'snowlab');
  await page.click('#s-content [data-diff="어려움"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-content .b-level', 'aria-label') === '권장 레벨 34' && (await page.locator('#s-content .b-gate .b-afx').count()) === 0, '눈꽃 연구소 어려움 = 권장 레벨 34, 상세 어픽스는 편성·공략에서 확인');
  await page.click('#contentGo'); await page.clock.runFor(100); await entryGo(page);
  ok(await page.isVisible('#s-party') && (await page.locator('[data-tier]').count()) === 0, '출전 = 바로 편성, 레벨 단계 칩 없음');
  ok(/어려움/.test(await text('#s-party .topbar')) && !/단계 Lv/.test(await text('#s-party .topbar')) && /격노/.test(await text('#s-party .topbar .f-afxs')), '편성 머리 = 어려움 + 격노 (단계 Lv 없음)');
  await page.click('#guideOpen'); await page.clock.runFor(50);
  ok(/어려움 · 보스 체력 30%/.test(await text('#s-party .f-gsheet .afxlist')), '공략 시트에 난이도 어픽스 격노 설명');
  await page.screenshot({ path: `${shots}/growth_tier.png` });
  await page.click('#s-party .f-gsheet [data-shut]'); await page.clock.runFor(50);
  await departGo(page); await page.clock.runFor(3100 + 300);
  const fs = await F(() => { const f = window.__proto.F; return { stage: f.cfg.stageLv, rage: !!f.aff?.on.rage }; });
  ok(await page.isVisible('#battle') && fs.stage === 34 && fs.rage, `전투 = 적 Lv 34 (장소 30 + 어려움 4) + 격노 (Lv 30부터) (${JSON.stringify(fs)})`);

  // ---- 실패하면 2초 뒤 자동 정산 (2026-10-13 Lim) ----
  const cont0 = (await save()).daily.ads.cont;
  await forceLoss(); await page.clock.runFor(100);
  ok(await page.isVisible('#battle') && await page.isHidden('#s-settle') && !(await page.isVisible('.admodal')), '실패 직후 전투 화면 유지 · 이어하기 창 없음');
  await page.clock.runFor(1800);
  ok(await page.isVisible('#battle') && await page.isHidden('#s-settle'), '실패 후 2초가 되기 전에는 전투 화면 유지');
  await page.clock.runFor(300);
  ok(await page.isVisible('#s-settle') && !(await page.isVisible('.admodal')) && (await text('#s-settle h1')) === '전멸', '실패 후 약 2초 뒤 정산으로 자동 이동');
  await page.screenshot({ path: `${shots}/growth_failure_settle.png` });
  ok((await save()).daily.ads.cont === cont0 && !/광고로 이어 함/.test(await text('#s-settle')), '자동 정산은 이어하기 광고 횟수를 소비하지 않음');
  ok(/격노/.test(await text('#s-settle .res-head p')) && !/단계 Lv/.test(await text('#s-settle .res-head p')), '정산 머리에 어픽스 격노 (단계 Lv 없음)');

  // ---- 주간 도전 (13 3-2) ----
  await page.clock.runFor(1200); if (await page.isVisible('#s-settle .lvpop')) { await page.click('#s-settle .lvpop button'); await page.clock.runFor(50); }
  await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(100);
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
  await page.click('#s-content [data-chal]'); await page.clock.runFor(100);
  const ent = await text('#s-entry'), limit = (await text('#s-entry .f-cinfo dd')).trim(), wk = (await save()).weekly.chal;
  // 110 2차: 던전은 주마다 내 레벨 이하에서 (새 주에 무작위), 제한시간은 그 던전 1단계 시간 기준
  ok((await text('#s-entry .chalstep b')) === '1단계' && await page.isDisabled('#s-entry [data-cstep="1"]') && /^\d+:\d\d$/.test(limit) && !!wk && /옮겨붙는 역병/.test(ent) && /10단계부터/.test(ent) && (await page.locator('#s-entry .wc-afx .g-row').count()) === 3 && (await page.locator('#s-entry .wc-afx .g-row.wc-later').count()) === 1 && !/제한시간 안에 깨면|실패해도 단계 유지|광고 이어하기 없음/.test(ent), `도전 입장: 1단계 · 제한 ${limit} · 이번 주 던전 ${wk} · 이번 주 어픽스 셋 (셋째는 10단계부터 · 흐림, 115), 하단 규칙 문구 없음`);
  await page.screenshot({ path: `${shots}/challenge_entry.png`, fullPage: true });
  await page.click('#entryGo'); await page.clock.runFor(100); await entryGo(page);
  ok(/주간 도전 1단계/.test(await text('#s-party .topbar')) && (await page.locator('#reroll, #adReroll').count()) === 0, '주간 도전 편성: 다시 뽑기·광고 다시 뽑기 버튼 없음');
  const g0 = (await save()).player.gold, ads0 = (await save()).daily.ads.reroll;
  const departAt = await page.locator('#depart').boundingBox(), footAt = await page.locator('#s-party .f-foot2').boundingBox();
  ok(Math.abs(departAt.x + departAt.width / 2 - footAt.x - footAt.width / 2) <= 1, '주간 도전 출발 버튼은 하단 중앙');
  await page.click('#guideOpen'); await page.clock.runFor(50);
  await page.keyboard.press('Escape'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.daily.ads.reroll === ads0 && sv.player.gold === g0, '주간 도전 공략 확인 중 골드·광고 횟수 그대로');
  await departGo(page); await page.clock.runFor(3100 + 300);
  const cf = await F(() => { const f = window.__proto.F; return { blight: !!f.aff?.on.blight, echo: !!f.aff?.on.echo, con: !!f.aff?.on.contagion, stage: f.cfg.stageLv, enc: f.cfg.encounter }; });
  ok(cf.blight && cf.echo && !cf.con && cf.stage === 30 && cf.enc && (await text('#timer')).includes(`/ ${limit}`), `도전 전투: 1단계 = 옮겨붙는 역병·메아리 (셋째 전염병은 10단계부터, 115), 단계 레벨 = 내 레벨, 타이머 / ${limit} (${JSON.stringify(cf)})`);
  await lose();
  ok(!(await page.isVisible('.admodal')) && await page.isVisible('#s-settle') && /단계는 그대로/.test(await text('#s-settle')), '도전은 이어하기 없음 · 실패해도 단계 그대로');
  ok((await text('#again')) === '다시 도전', '실패: 다시 도전 (같은 단계)');
  await page.click('#again'); await entryGo(page); await page.clock.runFor(3100 + 300);
  await winAll();
  sv = await save();
  ok((await text('#s-settle h1')).startsWith('1단계 돌파') && /제한시간 안/.test(await text('#s-settle .r-chal')) && /2단계 열림/.test(await text('#s-settle .r-chal')) && sv.chalOpen === 2 && sv.weekly.chalBest === 1, '제한시간 안에 깸 → 「1단계 돌파」 · 2단계 열림');
  await page.screenshot({ path: `${shots}/challenge_settle.png`, fullPage: true });
  await page.clock.runFor(1200); if (await page.isVisible('#s-settle .lvpop')) { await page.click('#s-settle .lvpop button'); await page.clock.runFor(50); }
  ok((await text('#s-settle #again')) === '다시 도전' && /^2단계 도전/.test(await text('#s-settle #next')), '결과: 다시 도전 (같은 단계) · 주 버튼 「다음」 = 「2단계 도전」');
  await page.click('#s-settle #next'); await entryGo(page); await page.clock.runFor(3100 + 300);
  ok(await page.isVisible('#battle'), '「2단계 도전」을 누르면 같은 파티로 바로 출발');
  await winAll();
  ok((await text('#s-settle h1')).startsWith('2단계 돌파'), '그 판은 2단계 (결과 「2단계 돌파」)');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
