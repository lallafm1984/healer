// 2026-10-09 빼 두었던 길드를 2026-10-18 다시 켬 (Lim 「메뉴의 상점을 빼고 길드를 넣자」, features.ts). 꺼 두면 guild-off.mjs.
// 길드 (2026-10-18 상점 · 편성과 같은 길드 홀 돌색, 09 S12~S14, 02 9장, 17): 잠금 → 현황 → 영입 탭 골드 모집 → 지원자 시트 → 영입 → 길드원 탭 육성 시트 (훈련·육성 포인트·방출 확인)
// → 현황 「길드파티로 출전」 = 전투 탭 → 입장 → 편성이 길드파티 → 편성 「길드파티」 → 출발 → 보상에 길드원 경험치 → 좁은·넓은 화면 넘침
import { chromium } from 'playwright';
import { departGo, killEnemies, pastTitle, toParty } from './nav.mjs';

export default async function guild(url, shots) {
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
  const patch = async fn => { await page.evaluate(fn); await page.reload(); await page.clock.runFor(300); await pastTitle(page); };
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // ---- 잠금: Lv 15 (개발 빌드 「레벨 잠금 무시」를 끄면) ----
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.settings.devUnlock = false; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-guild') && /Lv 15에 열림/.test(await text('#s-guild .lockline')) && (await page.locator('#s-guild .g-feat').count()) === 3, 'Lv 1 = 길드 잠금 (Lv 15) · 열리면 할 것 셋');

  // ---- 2026-10-18 상점 · 편성과 같은 길드 홀 돌색: 하위 탭 · 길드 홀 머리 · 카드 ----
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 30; s.player.gold = 20000; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  const hero = await text('#s-guild .guild-hero');
  ok(/새벽의 손/.test(hero) && /정원 0\/6/.test(hero) && /명성 0/.test(hero), 'Lv 30 = 길드 열림, 머리에 이름 · 정원 0/6 · 명성');
  const tabs = await page.locator('#s-guild .subtabs [role="tab"]').evaluateAll(els => els.map(e => [e.dataset.sub, e.getAttribute('aria-selected')]));
  ok(JSON.stringify(tabs) === JSON.stringify([['home', 'true'], ['members', 'false'], ['recruit', 'false']]), `하위 탭 셋 (현황 고름) ${JSON.stringify(tabs)}`);
  ok(await page.locator('#s-guild .g-board, #s-guild .g-note, #s-guild .g-sign').count() === 0, '나무 게시판 · 쪽지 · 팻말 없음');
  ok(/아직 길드원 없음/.test(await text('#s-guild .g-empty')), '빈 길드 안내 카드');
  ok(/0 \/ 10/.test(await text('#s-guild .g-goal')), '주간 목표 카드 0/10');
  ok(/영입하러 가기/.test(await text('#guildGo')), '길드원 0명 = 아래 버튼 「영입하러 가기」');
  ok((await page.locator('#s-guild .g-recrow').count()) === 2, '영입 요약 줄 둘 (모집 공고 · 인연 스카우트)');

  // ---- 골드 모집 → 영입 ----
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild [data-post]').count()) === 3, '모집 공고 3단계 (상점 줄 모양)');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.player.gold === 19500 && sv.guild.post?.cands.length === 3, `일반 공고 = 골드 500, 지원자 3명 (${sv.player.gold})`);
  ok((await page.locator('#s-guild .g-list [data-hire]').count()) === 3 && (await page.locator('#s-guild .g-list .f-ps').count()) === 3, '지원자 줄 = 편성과 같은 줄 (성격 칩) + 영입 버튼');
  ok(await page.isVisible('#s-guild .subtabs [data-sub="recruit"] .rdot') && /돌아갑니다/.test(await text('#s-guild .g-status')), '지원자 있으면 영입 탭 빨간 점 · 새 공고를 내면 지금 지원자는 돌아간다는 안내');
  await page.click('#s-guild [data-cand="0"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-guild .g-msheet') && (await page.locator('#s-guild .g-msheet .f-det').count()) === 1, '지원자 줄 누르면 아래 시트 (능력 · 자질 · 성격)');
  await page.click('#s-guild .g-msheet .f-shut'); await page.clock.runFor(50);
  await page.screenshot({ path: `${shots}/guild_recruit.png` });
  const cand = sv.guild.post.cands[0];
  await page.click('#s-guild .g-list [data-hire="0"]'); await page.clock.runFor(50);
  sv = await save();
  const m0 = sv.guild.members[0];
  ok(sv.guild.members.length === 1 && sv.guild.post === null && m0.nick === cand.nick && m0.lv >= 24 && m0.lv <= 27, `영입: ${m0.nick} Lv ${m0.lv} (내 레벨 -6~-3)`);
  ok(/영입 완료/.test(await text('#s-guild .warnbox')), '영입 완료 안내');

  // ---- 육성 시트: 훈련 · 육성 포인트 · 방출 확인 ----
  await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
  await page.click(`#s-guild [data-mem="${m0.id}"]`); await page.clock.runFor(50);
  ok(await page.isVisible('#s-guild .g-msheet') && /남은 1점/.test(await text('#s-guild .g-msheet')), `시트 열림, Lv ${m0.lv} = 육성 포인트 1점`);
  const g0 = sv.player.gold;
  await page.click('#s-guild [data-train]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members[0].lv === m0.lv + 1 && sv.player.gold === g0 - m0.lv * 30, `훈련 +1 Lv: 골드 ${m0.lv * 30}`);
  const lv1 = sv.guild.members[0].lv, g1 = sv.player.gold;
  await page.click('#s-guild [data-pt="star"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members[0].star === 1 && sv.player.gold === g1 - lv1 * 100, `능력 ★+1: 골드 ${lv1 * 100}`);
  ok(await page.isDisabled('#s-guild [data-pt="star"]') && await page.isDisabled('#s-guild [data-pt="0"]'), '포인트 다 쓰면 버튼 꺼짐');
  ok(/★1\/5/.test(await text('#s-guild .g-msheet')), '시트에 ★1/5');
  await page.click('#s-guild [data-release]'); await page.clock.runFor(50);
  ok(/한 번 더 누르면 방출/.test(await text('#s-guild [data-release]')) && (await save()).guild.members.length === 1, '방출 첫 누름 = 확인만');
  await page.locator('#s-guild .g-msheet').screenshot({ path: `${shots}/guild_member.png` });
  await page.click('#s-guild .g-msheet .f-shut'); await page.clock.runFor(50);
  ok(!(await page.isVisible('#s-guild .g-msheet')), '닫기 = 시트 닫힘');

  // ---- 현황: 길드원 줄 · 「길드파티로 출전」 → 전투 탭 → 출전 → 편성이 길드파티 ----
  await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
  ok(new RegExp(m0.nick).test(await text('#s-guild .g-list')) && /1\/6/.test(await text('#s-guild .subtabs [data-sub="members"]')), `현황 길드원 줄에 ${m0.nick}, 길드원 탭 1/6`);
  ok(/길드파티로 출전/.test(await text('#guildGo')) && /주간 목표 0\/10/.test(await text('#guildGo')), '아래 버튼 「길드파티로 출전」 · 주간 목표 0/10');
  await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok(await page.getAttribute('#s-guild .subtabs [data-sub="home"]', 'aria-selected') === 'true', '길드 탭을 다시 누르면 현황');
  await page.click('#guildGo'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-content'), '「길드파티로 출전」 = 전투 탭 (모험 고르기)');
  await toParty(page);
  ok(await page.getAttribute('#s-party [data-mode="guild"]', 'aria-selected') === 'true' && (await page.locator(`#s-party [data-gpick="${m0.id}"].picked`).count()) === 1, '출전 → 편성이 길드파티로 시작 (길드원 들어감)');

  // 뒤로 → 전투 탭 (출발 안 했으니 길드 편성은 저장 안 됨)
  await page.click('#s-party .tb-back'); await page.clock.runFor(50);

  // ---- 편성: 길드파티 ----
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  await toParty(page);
  ok(await page.getAttribute('#s-party [data-mode="public"]', 'aria-selected') === 'true', '처음엔 공개모집 (지난 길드 편성 없음)');
  await page.click('#s-party [data-mode="guild"]'); await page.clock.runFor(50);
  ok((await page.locator(`#s-party [data-gpick="${m0.id}"].picked`).count()) === 1, '길드파티 = 자동 편성으로 길드원 들어감');
  ok((await page.locator('#s-party .pcard.fill').count()) === 3 && /빈자리 3 = 공개모집/.test(await text('#s-party .pickhead')), '빈자리 3 = 공개모집 보충');
  await page.click(`#s-party [data-gpick="${m0.id}"]`); await page.clock.runFor(50);
  ok((await page.locator('#s-party .picked').count()) === 0 && (await page.locator('#s-party .pcard.fill').count()) === 4, '누르면 빠짐 → 4명 모두 공개모집');
  await page.click(`#s-party [data-gpick="${m0.id}"]`); await page.clock.runFor(50);
  ok((await page.locator('#s-party .picked').count()) === 1, '다시 누르면 들어감');
  await page.screenshot({ path: `${shots}/guild_party.png` });
  await departGo(page); await page.clock.runFor(3100 + 500);
  const inFight = await page.evaluate(id => { const u = window.__proto.F.party.find(x => x.gid === id); return u ? { nick: u.nick, ab: u.ab?.key } : null; }, m0.id);
  ok(inFight && inFight.nick === m0.nick && inFight.ab === m0.ab, `전투에 길드원 + 능력 (${JSON.stringify(inFight)})`);
  ok((await save()).guild.pick.join() === String(m0.id), '길드 편성 저장');

  // ---- 구간 빨리 넘기고 보상: 길드원 경험치 ----
  for (let i = 0; i < 3; i++) {
    await killEnemies(page); await page.clock.runFor(1500);
    await page.click('#restGo'); await page.clock.runFor(3100 + 500);
  }
  await killEnemies(page); await page.clock.runFor(1500);
  ok(await page.isVisible('#s-settle'), '던전 클리어');
  await page.clock.runFor(1200); if (await page.isVisible('#s-settle .lvpop')) { await page.click('#s-settle .lvpop button'); await page.clock.runFor(50); }
  const rw = await text('#s-settle .r-notes');
  ok(/길드원 경험치 \+\d/.test(rw) && /명성 \+1/.test(rw), '결과 화면: 길드원 경험치 · 명성 +1 (한 줄)');
  sv = await save();
  ok(sv.guild.members[0].runs === 1 && sv.guild.fame === 1, `저장: 출전 1번, 명성 1`);
  await page.screenshot({ path: `${shots}/guild_reward.png` });

  // ---- 좁은·넓은 화면: 가로 넘침 없음, 출전 버튼 탭 위, 줄 이름 · 직업이 잘리지 않음 (보상 화면엔 탭 막대가 없어 다시 읽음) ----
  await patch(() => {});
  for (const [w, h] of [[320, 640], [360, 780], [360, 880], [430, 932]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
    const fit = () => page.locator('#s-guild .ns-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    const cta = await page.locator('#guildGo').boundingBox(), tabsBox = await page.locator('#tabs').boundingBox();
    ok(await fit() && cta.y + cta.height <= tabsBox.y + 1 && cta.height >= 44, `${w}×${h}: 현황 가로 넘침 없음, 출전 버튼 탭 위`);
    if (w === 320) await page.screenshot({ path: `${shots}/guild_home_320.png` });
    await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
    const clip = await page.locator('#s-guild .g-list .pnick').evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
    ok(await fit() && !clip.length, `${w}×${h}: 길드원 줄 가로 넘침 · 이름 잘림 없음 ${JSON.stringify(clip)}`);
    await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
    ok(await fit(), `${w}×${h}: 영입 화면 가로 넘침 없음`);
    await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
  }

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
