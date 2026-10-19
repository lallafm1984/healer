// 길드 업데이트 묶음 (93 4-4 · 6-3 · 8장, 2026-10-19 사슬 7번): 시설 셋 (연회장 · 작전실 · 모집소) · 부탁 쪽지 · 주간 원정 · 스토리 동료 합류 카드 · 초대 대기
// → S25 · 울트라 · 플립에서 현황 · 영입 가로 넘침 없음. 길드 핵심 흐름은 guild.mjs.
import { chromium } from 'playwright';
import { pastTitle } from './nav.mjs';

const USERS = { 불꽃남자: 9, 메테오: 7, 회피의신: 6, 방패든양: 20 };

export default async function guildExt(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  const text = sel => page.textContent(sel);
  const patch = async (fn, arg) => { await page.evaluate(fn, arg); await page.reload(); await page.clock.runFor(300); await pastTitle(page); };
  await page.clock.install({ time: new Date(2026, 9, 7, 12) });
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // 결성된 길드 · 길드 Lv 7 (명성 480) · Lv 50 · 골드 넉넉히 · 정원 가득 직전
  await patch(users => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.level = 50; s.player.gold = 500000;
    for (const [nick, pt] of Object.entries(users)) s.users[nick] = { pt, met: 3, wins: 2, saved: 0, mvp: 0 };
    localStorage.setItem('healer.save', JSON.stringify(s));
  }, USERS);
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  await page.click('#found'); await page.clock.runFor(50);
  await page.click('#storyOk'); await page.clock.runFor(50);
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.guild.fame = 480; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);

  // ---- 부탁 쪽지 · 주간 원정 (93 8장) ----
  let sv = await save();
  ok(sv.guild.reqs.list.length === 2 && (await page.locator('#s-guild .g-job').count()) === 2, `부탁 쪽지 2장 (${sv.guild.reqs.list.map(q => `${q.nick} ${q.content} ${q.diff}`)})`);
  ok(sv.guild.exped.list.length >= 1 && (await page.locator('#s-guild .g-exrow').count()) === sv.guild.exped.list.length && /주간 원정/.test(await text('#s-guild .g-exped')), `주간 원정 ${sv.guild.exped.list.length}곳`);
  ok(await page.isVisible('#tabs [data-tab="guild"] .rdot'), '안 끝낸 부탁 = 길드 탭 빨간 점');

  // ---- 시설 (93 6-3): 길드 Lv 7 = 셋 다 열림, 골드로 단계 ----
  await page.click('#s-guild [data-csel="fac"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-fac').count()) === 3 && (await page.locator('#s-guild [data-fac]').count()) === 3, '시설 셋 (연회장 · 작전실 · 모집소), 모두 올리기 버튼');
  const g0 = sv.player.gold;
  await page.click('#s-guild [data-fac="feast"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.fac.feast === 1 && sv.player.gold === g0 - 5000 && /연회장 1단계/.test(await text('#s-guild .warnbox')), '연회장 1단계 = 골드 5,000');
  for (let i = 0; i < 4; i++) { await page.click('#s-guild [data-fac="war"]'); await page.clock.runFor(30); }
  await page.click('#s-guild [data-fac="post"]'); await page.clock.runFor(30);
  sv = await save();
  ok(sv.guild.fac.war === 4 && sv.guild.fac.post === 1 && (await page.locator('#s-guild .guild-hero .gh-prop').count()) === 2, `시설 합 6 = 길드 홀 머리 소품 2개 (${await page.locator('#s-guild .guild-hero .gh-prop').count()})`);
  await page.screenshot({ path: `${shots}/guild_ext_home.png`, fullPage: false });

  // ---- 스토리 동료 (93 4-4): 합류 카드 · 정원 가득이면 초대 대기 ----
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.storyCard = 'isle'; s.guild.storyWait = ['isle'];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok(/이슬/.test(await text('#s-guild .g-arrive')) && /응급 처치/.test(await text('#s-guild .g-arrive')) && /기다림/.test(await text('#s-guild .g-arrive')), '합류 카드: 이슬 · 고유 스킬 응급 처치 · 정원이 차면 기다림');
  await page.click('#arriveOk'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-arrive').count()) === 0 && (await save()).guild.storyCard === null, '확인 = 카드 닫힘');
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild [data-istory="isle"]').count()) === 1 && /초대 대기/.test(await text('#s-guild .g-recruit')), '친구 초대 줄 맨 위에 이슬 「초대 대기」');
  await page.click('#s-guild [data-istory="isle"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members.some(m => m.story === 'isle' && m.ab === 'archer.mend') && sv.guild.storyWait.length === 0, '초대 = 이슬 합류 (응급 처치)');

  // 시설 모두 5단계 = 소품 5개, 머리 글을 가리지 않음
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.guild.fac = { feast: 5, war: 5, post: 5 }; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  const over = await page.locator('#s-guild .guild-hero').evaluate(h => {
    const props = [...h.querySelectorAll('.gh-prop')].map(e => e.getBoundingClientRect());
    const texts = [...h.querySelectorAll('.ah-copy h2, .ah-copy .eyebrow')].flatMap(e => { const r = document.createRange(); r.selectNodeContents(e); return [...r.getClientRects()]; })
      .concat([...h.querySelectorAll('.gh-stats > span')].map(e => e.getBoundingClientRect())); // 글자 자리 (블록 전체 말고)
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    return { n: props.length, hits: props.filter(p => texts.some(t => hit(p, t))).length };
  });
  ok(over.n === 5 && over.hits === 0, `시설 15단계 = 소품 5개, 머리 글과 안 겹침 ${JSON.stringify(over)}`);
  await page.locator('#s-guild .guild-hero').screenshot({ path: `${shots}/guild_ext_props.png` });

  // ---- UI가 실제 모집소 할인/인원과 같은 견적을 보여 주고, 후보 교체는 확인 뒤 소비 ----
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.fac.post = 3; s.guild.post = null; s.player.gold = 1200;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-sub="recruit"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-csel="post"]'); await page.clock.runFor(50);
  ok(/1,200/.test(await text('#s-guild [data-post="normal"]')) && !await page.isDisabled('#s-guild [data-post="normal"]') && /4명/.test(await text('#s-guild .g-facts')), '모집소 3: 실제 할인 비용 1,200만 있어도 모집 가능 · 지원자 4명 표시');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === 0 && sv.guild.post.cands.length === 4, '표시 견적과 실제 결제/지원자 수 일치');
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.gold = 10000; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-sub="recruit"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-csel="post"]'); await page.clock.runFor(50);
  const beforePost = JSON.stringify((await save()).guild.post);
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  ok((await save()).player.gold === 10000 && JSON.stringify((await save()).guild.post) === beforePost && await page.isVisible('#cancelPost'), '새 공고 첫 누름: 지원자와 골드 유지 · 교체 확인');
  await page.click('#cancelPost'); await page.clock.runFor(50);
  ok(JSON.stringify((await save()).guild.post) === beforePost && !(await page.locator('[data-confirm-post]').count()), '교체 취소: 기존 지원자 유지');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-confirm-post="normal"]'); await page.clock.runFor(50);
  ok((await save()).player.gold === 8800 && (await save()).guild.post.cands.length === 4, '교체 확인 후 1회만 1,200 소비');

  // 길드원 역할 선택과 정렬은 편성을 건드리지 않고 포커스를 유지.
  const picksBefore = JSON.stringify((await save()).guild.picks);
  await page.click('#s-guild [data-sub="members"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-mrole="tank"]'); await page.clock.runFor(50);
  const shown = await page.locator('#s-guild [data-mem]').evaluateAll(els => els.map(e => Number(e.dataset.mem)));
  sv = await save();
  ok(shown.length > 0 && shown.every(id => ['warrior', 'paladin'].includes(sv.guild.members.find(m => m.id === id).cls)), '탱커 필터는 탱커만 표시');
  ok(await page.evaluate(() => document.activeElement?.getAttribute('data-mrole')) === 'tank', '역할 필터를 누른 뒤 포커스 유지');
  await page.click('#s-guild [data-mrole="any"]'); await page.clock.runFor(50);
  await page.selectOption('#guildSort', 'bond'); await page.clock.runFor(50);
  ok(JSON.stringify((await save()).guild.picks) === picksBefore, '길드원 보기/정렬은 저장된 편성 유지');

  // 부탁에서 정확한 장소/난이도를 골라 두고, 전투는 출전 버튼을 누를 때 진행.
  await page.click('#s-guild [data-sub="home"]'); await page.clock.runFor(50);
  const req = (await save()).guild.reqs.list.find(q => !q.done);
  if (req) {
    await page.locator('#s-guild .g-job [data-goto]').first().click(); await page.clock.runFor(50);
    ok(await page.isVisible('#s-content') && !await page.isVisible('#battle') && (await text('#contentGo')).includes(req.diff), '부탁 장소 보기 = 해당 모험 선택, 전투 자동 시작 없음');
    await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  }
  await page.click('#s-guild [data-csel="fac"]'); await page.clock.runFor(50);
  ok(/다음/.test(await text('#s-guild .g-facs')) && !await page.isVisible('#guildGo'), '시설: 효과를 바로 읽고 관리할 수 있는 본문 공간');

  // ---- S25 · 울트라 · 플립: 가로 넘침 없음 ----
  for (const [w, h, name] of [[360, 780, 's25'], [384, 824, 'ultra'], [412, 915, 'ultra-wide'], [360, 880, 'flip'], [768, 920, 'fold']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
    const fit = () => page.locator('#s-guild .ns-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    const out = sel => page.locator(sel).evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(), p = e.closest('.g-card')?.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 || (p && (r.right > p.right + 1 || r.left < p.left - 1)); }).length);
    const cut1 = await out('#s-guild .g-job .g-rs, #s-guild .g-exped .g-rs, #s-guild .g-goal .g-rs, #s-guild .g-place');
    await page.click('#s-guild [data-csel="fac"]'); await page.clock.runFor(50);
    const cut2 = await out('#s-guild .g-fac, #s-guild .g-fac > .btn, #s-guild .g-fac .g-lockt');
    const hub = await page.locator('#s-guild .g-hubt').evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1).length);
    ok(await fit() && !cut1 && !cut2 && !hub, `${name} ${w}×${h}: 현황 (칸 셋 · 부탁 · 원정 · 시설) 가로 넘침 없음 ${JSON.stringify({ cut1, cut2, hub })}`);
    await page.screenshot({ path: `${shots}/guild_ext_${name}.png`, fullPage: true });
    await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
    ok(await fit(), `${name}: 영입 가로 넘침 없음`);
    await page.click('#s-guild [data-csel="post"]'); await page.clock.runFor(50);
    const noOverlap = await page.locator('#s-guild .g-recruit').evaluate(el => {
      const hub = el.querySelector('.g-hub').getBoundingClientRect(), panel = el.querySelector('.g-card').getBoundingClientRect();
      const tabs = [...el.querySelectorAll('.g-hubt')].map(e => e.getBoundingClientRect());
      return panel.top >= Math.max(hub.bottom, ...tabs.map(t => t.bottom)) && el.scrollWidth <= el.clientWidth + 1;
    });
    ok(noOverlap, `${name}: 긴 공고 지원자 목록에서도 메뉴와 본문 겹침 없음`);

  }

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
