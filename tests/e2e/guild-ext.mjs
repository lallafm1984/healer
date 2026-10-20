// 길드 업데이트 묶음 (93 4-4 · 6-3 · 8장, 2026-10-19 사슬 7번): 시설 제거 · 부탁 쪽지 · 주간 원정 · 스토리 동료 합류 카드 · 합류 대기
// → S25 · 울트라 · 플립에서 현황 · 영입 가로 넘침 없음. 길드 핵심 흐름은 guild.mjs.
import { chromium } from 'playwright';
import { pastTitle } from './nav.mjs';


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
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.level = 50; s.player.gold = 500000;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  await page.click('#found'); await page.clock.runFor(50);
  await page.click('#storyOk'); await page.clock.runFor(50);
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.guild.fame = 480; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);

  // ---- 부탁 쪽지 · 주간 원정 (93 8장) ----
  ok((await text('#s-guild .gh-xp')).trim() === '명성 65 / 70' && (await page.getAttribute('#s-guild .gh-xp', 'aria-label')).includes('길드 Lv 8'), '명성 막대 = 이 레벨에서 쌓인 것 / 필요량 (명성 480 = 길드 Lv 8의 65 / 70, 103)');
  let sv = await save();
  ok(sv.guild.reqs.list.length === 2 && (await page.locator('#s-guild .g-job').count()) === 2, `부탁 쪽지 2장 (${sv.guild.reqs.list.map(q => `${q.nick} ${q.content} ${q.diff}`)})`);
  ok(sv.guild.exped.list.length >= 1 && (await page.locator('#s-guild .g-exrow').count()) === sv.guild.exped.list.length && /주간 원정/.test(await text('#s-guild .g-exped')), `주간 원정 ${sv.guild.exped.list.length}곳`);
  ok(await page.isVisible('#tabs [data-tab="guild"] .rdot'), '안 끝낸 부탁 = 길드 탭 빨간 점');
  const requestRewards = await page.locator('#s-guild .g-job .g-rewards').allTextContents();
  ok(requestRewards.length === 2 && requestRewards.every(t => /경험치 ×2/.test(t) && !/명성/.test(t)), '부탁 보상: 요청한 길드원 경험치 ×2');
  await page.click('#s-guild [data-tip="todo"]'); await page.clock.runFor(50);
  ok(/완료한 전투에서 부탁한 길드원의 경험치가 2배/.test(await text('#s-guild .g-tip')) && /부탁마다 한 번/.test(await text('#s-guild .g-tip')), '부탁 설명: 대상 · 완료 전투 · 한 번 지급 안내');
  await page.screenshot({ path: `${shots}/guild_request_xp.png` });
  await page.click('#s-guild [data-tip="todo"]'); await page.clock.runFor(50);

  ok((await page.locator('#s-guild .g-hub, #s-guild .g-fac, #s-guild [data-fac]').count()) === 0 && !/시설|작전실|모집소/.test(await text('#s-guild .g-home')), '현황에는 시설 없이 할 일만 표시');
  await page.screenshot({ path: `${shots}/guild_ext_home.png`, fullPage: false });

  ok(await page.isVisible('#guild-exped-places') && (await page.locator('#s-guild .g-exped-toggle').count()) === 0, '원정 장소는 항상 표시 · 장소 보기 펼침 버튼 제거');
  ok((await page.locator('#guild-exped-places button.g-place').allTextContents()).every(t => t.trim() === '입장'), '미완료 장소마다 오른쪽 입장 버튼 표시');
  const expedition = (await save()).guild.exped.list[0];
  await page.locator('#guild-exped-places .g-place').first().click(); await page.clock.runFor(50);
  ok(await page.isVisible('#s-content') && !await page.isVisible('#battle')
    && await page.getAttribute('#s-content', 'data-selected-content') === expedition.content
    && await page.getAttribute('#s-content', 'data-selected-diff') === '보통', '원정 입장 = 해당 장소·보통 선택, 전투 자동 시작 없음');
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);

  // ---- 스토리 동료 (93 4-4): 합류 카드 · 정원 가득이면 합류 대기 ----
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.exped.list[0].done = true;
    s.guild.storyCard = 'isle'; s.guild.storyWait = ['isle'];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok((await page.locator('#guild-exped-places .g-exrow.done .g-place-complete').count()) === 1
    && (await page.locator('#guild-exped-places .g-exrow.done button, #guild-exped-places .g-exrow.done [data-goto]').count()) === 0
    && (await page.locator('#guild-exped-places button.g-place').count()) === (await save()).guild.exped.list.filter(x => !x.done).length,
    '완료 장소는 완료 표시만 · 미완료 장소만 입장 가능');
  ok(/이슬/.test(await text('#s-guild .g-arrive')) && /응급 처치/.test(await text('#s-guild .g-arrive')) && /합류 대기/.test(await text('#s-guild .g-arrive')), '합류 카드: 이슬 · 고유 스킬 응급 처치 · 정원이 차면 기다림');
  await page.click('#arriveOk'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-arrive').count()) === 0 && (await save()).guild.storyCard === null, '확인 = 카드 닫힘');
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild [data-istory="isle"]').count()) === 1 && /합류 대기/.test(await text('#s-guild .g-recruit')), '영입 화면 맨 위에 이슬 「합류 대기」');
  await page.click('#s-guild [data-istory="isle"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members.some(m => m.story === 'isle' && m.ab === 'archer.mend') && sv.guild.storyWait.length === 0, '초대 = 이슬 합류 (응급 처치)');

  // ---- 통합 공고 견적/인원 · 후보 교체 확인 ----
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.post = null; s.player.gold = 1500;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-sub="recruit"]'); await page.clock.runFor(50);
  ok(/1,500/.test(await text('#guild-post-cost')) && !await page.isDisabled('#s-guild [data-post="normal"]') && /3명/.test(await text('#s-guild [data-sec="post"]')), '통합 공고: Lv 50 비용 1,500 · 지원자 3명 표시');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === 0 && sv.guild.post.cands.length === 3, '표시 견적과 실제 결제/지원자 수 일치');
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.gold = 10000; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-sub="recruit"]'); await page.clock.runFor(50);
  const beforePost = JSON.stringify((await save()).guild.post);
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  ok((await save()).player.gold === 10000 && JSON.stringify((await save()).guild.post) === beforePost && await page.isVisible('#s-guild .g-post-confirm[role="dialog"]'), '새 공고 첫 누름: 지원자와 골드 유지 · 확인 팝업');
  ok((await text('#guildPostDesc')).includes('현재 지원자 3명이 돌아갑니다.')
    && (await text('#s-guild .g-post-confirm [data-confirm-post]')).trim() === '확인'
    && (await page.locator('#s-guild .g-confirm').count()) === 0
    && !/교체 · 3명 모집/.test(await text('#s-guild')), '팝업에 교체 안내 · 취소/확인만 표시, 기존 모집 버튼 제거');
  ok(await page.locator('#s-guild .g-post-confirm').evaluate(el => el.contains(document.activeElement))
    && await page.locator('#s-guild .ns-body').evaluate(el => el.inert), '새 공고 팝업에 포커스 · 배경 조작 잠금');
  await page.clock.runFor(300);
  await page.screenshot({ path: `${shots}/guild_post_confirm.png`, fullPage: false });
  await page.click('#cancelPost'); await page.clock.runFor(50);
  ok(JSON.stringify((await save()).guild.post) === beforePost && (await save()).player.gold === 10000 && !(await page.locator('[data-confirm-post]').count())
    && await page.locator('#s-guild [data-post="normal"]').evaluate(el => document.activeElement === el), '교체 취소: 지원자·골드 유지, 새 공고 버튼으로 포커스 복원');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  await page.keyboard.press('Escape'); await page.clock.runFor(50);
  ok(!(await page.locator('.g-post-confirm').count()) && (await save()).player.gold === 10000 && JSON.stringify((await save()).guild.post) === beforePost, 'Escape로 확인 팝업 취소 · 골드와 지원자 유지');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-confirm-post="normal"]'); await page.clock.runFor(50);
  ok((await save()).player.gold === 8500 && (await save()).guild.post.cands.length === 3, '교체 확인 후 1회만 1,500 소비');
  const allCandidates = (await save()).guild.post.cands.map(c => c.nick);
  for (let remaining = 3; remaining > 0; remaining--) {
    await page.click('#s-guild [data-cand="0"] .f-mt'); await page.clock.runFor(50);
    await page.click('#s-guild .g-hire-actions [data-hire="0"]'); await page.clock.runFor(50);
    ok(((await save()).guild.post?.cands.length ?? 0) === remaining - 1, `한 공고에서 연속 영입: 남은 지원자 ${remaining - 1}명`);
  }
  sv = await save();
  ok(allCandidates.every(nick => sv.guild.members.some(m => m.nick === nick)) && sv.guild.post === null && sv.player.gold === 8500, '지원자 세 명 모두 영입 · 공고 종료 · 추가 차감 없음');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);

  // 길드원 역할 선택과 정렬은 편성을 건드리지 않고 포커스를 유지.
  // 레벨과 능력 순서가 다른 길드원으로 실제 재정렬을 확인한다 (별은 역할별 계산 결과를 UI에서 읽음).
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.members.forEach((m, i) => {
      m.lv = [48, 46, 50][i % 3];
      Object.keys(m.stats).forEach(k => { m.stats[k] = [8, 15, 11][i % 3]; });
    });
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  const picksBefore = JSON.stringify((await save()).guild.picks);
  await page.click('#s-guild [data-sub="members"]'); await page.clock.runFor(50);
  const memberRows = () => page.locator('#guild-panel-mem [data-mem]').evaluateAll(els => els.map(e => ({
    id: Number(e.dataset.mem), nick: e.querySelector('.pnick').textContent,
    lv: Number(e.querySelector('.cap').textContent.match(/Lv (\d+)/)[1]),
    stars: Number(e.querySelector('.ability-stars').getAttribute('aria-label').match(/별 ([\d.]+)/)[1]),
  })));
  const levelRows = await memberRows();
  ok((await text('#guildMemberSort')).trim() === '레벨순' && levelRows.every((m, i) => !i || levelRows[i - 1].lv >= m.lv), '기본 정렬은 높은 레벨순');
  await page.click('#guildMemberSort'); await page.clock.runFor(50);
  const abilityRows = await memberRows();
  ok((await text('#guildMemberSort')).trim() === '능력순'
    && abilityRows.every((m, i) => !i || abilityRows[i - 1].stars >= m.stars)
    && JSON.stringify(abilityRows.map(m => m.id)) !== JSON.stringify(levelRows.map(m => m.id)), '레벨순 누름 → 표시된 능력 별이 높은 순서로 실제 재정렬');
  await page.locator('#guildMemberSort').press('Enter'); await page.clock.runFor(50);
  const nameRows = await memberRows();
  ok((await text('#guildMemberSort')).trim() === '이름순'
    && nameRows.every((m, i) => !i || nameRows[i - 1].nick.localeCompare(m.nick, 'ko') <= 0), '정렬 버튼 키보드 Enter → 한국어 이름순');
  await page.click('#s-guild [data-mrole="tank"]'); await page.clock.runFor(50);
  const shown = await page.locator('#s-guild [data-mem]').evaluateAll(els => els.map(e => Number(e.dataset.mem)));
  sv = await save();
  ok(shown.length > 0 && shown.every(id => ['warrior', 'paladin'].includes(sv.guild.members.find(m => m.id === id).cls)), '탱커 필터는 탱커만 표시');
  ok((await text('#guildMemberSort')).trim() === '이름순', '역할 필터 변경 후 정렬 기준 유지');
  ok(await page.evaluate(() => document.activeElement?.getAttribute('data-mrole')) === 'tank', '역할 필터를 누른 뒤 포커스 유지');
  await page.click('#s-guild [data-mrole="any"]'); await page.clock.runFor(50);
  await page.locator('#guildMemberSort').press('Space'); await page.clock.runFor(50);
  ok((await text('#guildMemberSort')).trim() === '레벨순' && await page.locator('#guildMemberSort').evaluate(el => document.activeElement === el), '이름순 다음은 레벨순 · 키보드 Space와 포커스 유지');
  ok(JSON.stringify((await save()).guild.picks) === picksBefore, '길드원 보기/정렬은 저장된 편성 유지');

  // 부탁에서 정확한 장소/난이도를 골라 두고, 전투는 출전 버튼을 누를 때 진행.
  await page.click('#s-guild [data-sub="home"]'); await page.clock.runFor(50);
  const req = (await save()).guild.reqs.list.find(q => !q.done);
  if (req) {
    await page.locator('#s-guild .g-job [data-goto]').first().click(); await page.clock.runFor(50);
    ok(await page.isVisible('#s-content') && !await page.isVisible('#battle')
      && await page.getAttribute('#s-content', 'data-selected-content') === req.content
      && await page.getAttribute('#s-content', 'data-selected-diff') === req.diff, '부탁 장소 보기 = 해당 모험 선택, 전투 자동 시작 없음');
    await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  }
  // ---- S25 · 울트라 · 플립: 가로 넘침 없음 ----
  for (const [w, h, name] of [[360, 780, 's25'], [384, 824, 'ultra'], [412, 915, 'ultra-wide'], [360, 880, 'flip'], [768, 920, 'fold']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
    const fit = () => page.locator('#s-guild .ns-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    const out = sel => page.locator(sel).evaluateAll(els => els.filter(e => { if (!e.getClientRects().length) return false; const r = e.getBoundingClientRect(), p = e.closest('.g-card')?.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 || (p && (r.right > p.right + 1 || r.left < p.left - 1)); }).length);
    const cut1 = await out('#s-guild .g-job .g-rs, #s-guild .g-exped .g-rs, #s-guild .g-goal .g-rs, #s-guild .g-place');
    ok(await fit() && !cut1 && await page.isVisible('#guildGo'), `${name} ${w}×${h}: 현황 할 일 가로 넘침 없음 ${JSON.stringify({ cut1 })}`);
    const todoFits = await page.locator('#s-guild .g-exped').evaluate(el => el.getBoundingClientRect().bottom <= document.querySelector('#s-guild .g-foot').getBoundingClientRect().top);
    ok(todoFits, `${name}: 주간 원정 진행까지 출전 버튼 위에 표시`);
    await page.screenshot({ path: `${shots}/guild_ext_${name}.png`, fullPage: true });
    const placeRows = await page.locator('#guild-exped-places .g-exrow').evaluateAll(els => els.every((el, i) => {
      const row = el.getBoundingClientRect(), copy = el.querySelector('.g-place-copy').getBoundingClientRect(), button = el.querySelector('.g-place').getBoundingClientRect();
      return button.height >= 44 && copy.right <= button.left && (!i || row.top >= els[i - 1].getBoundingClientRect().bottom);
    }));
    ok(await fit() && !(await out('#s-guild .g-place')) && placeRows, `${name}: 원정 장소 세로 정렬 · 이름과 입장 버튼 겹침 없음`);
    await page.locator('#guild-exped-places .g-place').last().scrollIntoViewIfNeeded();
    const lastPlaceFits = await page.locator('#guild-exped-places .g-place').last().evaluate(el => {
      const r = el.getBoundingClientRect(), body = el.closest('.ns-body').getBoundingClientRect(), footer = document.querySelector('#s-guild .g-foot').getBoundingClientRect();
      return r.top >= body.top && r.bottom <= footer.top;
    });
    ok(lastPlaceFits, `${name}: 스크롤하면 마지막 장소도 출전 버튼 위에서 누를 수 있음`);
    await page.screenshot({ path: `${shots}/guild_exped_places_${name}.png`, fullPage: false });
    const homeHero = await page.locator('#s-guild .guild-hero').boundingBox();
    const cardStyle = () => page.locator('#s-guild .g-card[data-sec]').evaluate(el => {
      const s = getComputedStyle(el);
      return JSON.stringify([s.backgroundImage, s.borderColor, s.borderRadius]);
    });
    const homeStyle = await cardStyle();
    await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
    const memberHero = await page.locator('#s-guild .guild-hero').boundingBox();
    const memberStyle = await cardStyle();
    const memberGeometry = () => page.locator('#s-guild .g-members').evaluate(el => {
      const body = el.getBoundingClientRect(), card = el.querySelector('.g-card').getBoundingClientRect();
      const chips = [...el.querySelectorAll('[data-mrole]')].map(e => e.getBoundingClientRect().width);
      return { left: card.left, width: card.width, margins: [card.left - body.left, body.right - card.right], chips,
        scrollbar: getComputedStyle(el).scrollbarWidth, overflow: getComputedStyle(el).overflowY };
    });
    const allGeometry = await memberGeometry();
    await page.screenshot({ path: `${shots}/guild_members_all_${name}.png`, fullPage: false });
    await page.click('#s-guild [data-mrole="ranged"]'); await page.clock.runFor(50);
    const rangedGeometry = await memberGeometry();
    ok(await fit() && Math.abs(allGeometry.left - rangedGeometry.left) < 1 && Math.abs(allGeometry.width - rangedGeometry.width) < 1
      && allGeometry.margins.every(n => Math.abs(n - 12) < 1) && rangedGeometry.margins.every(n => Math.abs(n - 12) < 1)
      && Math.max(...rangedGeometry.chips) - Math.min(...rangedGeometry.chips) < 1, `${name}: 전체/원거리 목록 폭 동일 · 좌우 12px · 역할 버튼 같은 폭`);
    ok(allGeometry.scrollbar === 'none' && ['auto', 'scroll'].includes(allGeometry.overflow), `${name}: 스크롤바만 숨기고 스크롤 기능 유지`);
    await page.screenshot({ path: `${shots}/guild_members_ranged_${name}.png`, fullPage: false });
    await page.click('#s-guild [data-mrole="any"]'); await page.clock.runFor(50);
    // 사람처럼 맨 끝까지 내림 (scrollIntoViewIfNeeded는 하단 메뉴에 가린 판 끝에 맞추고 멈춤: 길드원이 적으면 마지막 줄이 메뉴 뒤에서 멈춘 것처럼 보였음)
    await page.locator('#guild-panel-mem [data-mem]').last().evaluate(el => { const body = el.closest('.ns-body'); body.scrollTop = body.scrollHeight; });
    await page.clock.runFor(50);
    ok(await page.locator('#guild-panel-mem [data-mem]').last().evaluate(el => {
      const r = el.getBoundingClientRect(), body = el.closest('.ns-body').getBoundingClientRect();
      return r.top >= body.top && r.bottom <= Math.min(body.bottom, document.querySelector('#tabs').getBoundingClientRect().top);
    }), `${name}: 마지막 길드원까지 스크롤로 접근 가능`);
    await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
    const recruitHero = await page.locator('#s-guild .guild-hero').boundingBox();
    ok(homeHero.height === memberHero.height && memberHero.height === recruitHero.height, `${name}: 세 탭의 길드 이름판 높이 일치`);
    ok(await fit(), `${name}: 영입 가로 넘침 없음`);
    ok(homeStyle === memberStyle && memberStyle === await cardStyle() && !homeStyle.startsWith('["none"'), `${name}: 현황·길드원·모집 공고의 갈색 카드 배경·테두리 통일`);
    const onlyPost = await page.locator('#s-guild .g-recruit').evaluate(el => !!el.querySelector('[data-sec="post"]') && !el.querySelector('.g-hub, [data-csel], [data-sec="app"]') && el.scrollWidth <= el.clientWidth + 1);
    ok(onlyPost, `${name}: 영입 = 모집 공고 판 하나 (경로 탭 · 명성 지원자 없음, 2026-10-20) · 가로 넘침 없음`);
    await page.screenshot({ path: `${shots}/guild_recruit_${name}.png`, fullPage: true });

  }

  await page.setViewportSize({ width: 360, height: 780 });
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.fame = 1000000;
    s.guild.exped.list.forEach(x => { x.done = true; });
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  ok((await save()).guild.fame === 1000000 && (await text('#s-guild .gh-xp')).trim() === 'MAX' && /길드 Lv 30/.test(await text('#s-guild .guild-hero')), '최고 길드 레벨 (Lv 30) 뒤에도 명성은 쌓여 저장, 막대는 가득 · MAX (103)');
  await page.screenshot({ path: `${shots}/guild_fame_unlimited.png`, fullPage: false });
  ok((await page.locator('#guild-exped-places button').count()) === 0
    && (await page.locator('#guild-exped-places .g-place-complete').count()) === (await save()).guild.exped.list.length, '원정 모두 완료하면 입장 버튼 없이 완료 표시만 유지');

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
