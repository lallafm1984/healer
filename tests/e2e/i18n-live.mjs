// 번역 사전만 있어도 표시 경로에서 t()를 빠뜨리면 한국어가 남는다. 실제 언어 전환 · 장소 그림 · 전투 상세 · HP 단계선을 확인한다.
import { chromium } from 'playwright';
import { departGo, killEnemies, pastTitle, patchSave, toParty } from './nav.mjs';

export default async function i18nLive(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (value, message, info) => {
    console.log(`${value ? 'PASS' : 'FAIL'} ${message}${value || info === undefined ? '' : ` ${JSON.stringify(info)}`}`);
    if (!value) fails++;
  };
  for (const lang of ['en', 'ja']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul' });
    await ctx.addInitScript(l => localStorage.setItem('healer.lang', l), lang);
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install({ time: new Date('2026-10-07T03:00:00Z') });
    await page.goto(url); await page.clock.runFor(300); await pastTitle(page);
    await patchSave(page, { player: { level: 40, gold: 123456 }, settings: { auto: false, sound: false, vibrate: false } });
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.guild.founded = true; s.guild.storySeen = true; s.guild.fame = 225;
      for (const [nick, cls, ab] of [['방패든양', 'warrior', 'warrior.shieldBlock'], ['뒤통수전문', 'rogue', 'rogue.kick'], ['불꽃남자', 'mage', 'mage.blink'], ['딜미터1등', 'archer', 'archer.snipe']])
        s.guild.members.push({ id: s.guild.nextId++, nick, cls, pers: '신중파', ab, lv: 30, xp: 0, stats: {}, lastStatGains: [], learn: 10, steady: 10, sxp: 0, votes: [], boost: 0, runs: 0, joined: 0 });
      localStorage.setItem('healer.save', JSON.stringify(s));
    });
    await page.reload(); await page.clock.runFor(300);
    await pastTitle(page);
    const koAttrs = () => page.locator('[aria-label],[title],[placeholder],[alt]').evaluateAll(els => els.flatMap(el => {
      if (!el.getClientRects().length) return [];
      return ['aria-label', 'title', 'placeholder', 'alt'].flatMap(a => /[가-힣]/.test(el.getAttribute(a) || '') ? [`${el.id || el.className}: ${a}=${el.getAttribute(a)}`] : []);
    }));
    const lobbyAttrs = await koAttrs();
    ok(lobbyAttrs.length === 0, `${lang}: 로비 · 공통 탭 · 광고 자리의 접근성 이름 번역`, lobbyAttrs);
    const embark = await page.locator('#lobbyStart .lb-cta-copy > b').evaluate(el => {
      const r = document.createRange(); r.selectNodeContents(el);
      const ink = [...r.getClientRects()], box = el.closest('button').getBoundingClientRect();
      return { text: el.textContent, lines: ink.length, fits: ink.every(r => r.left >= box.left + 8 && r.right <= box.right - 8) };
    });
    ok(embark.lines === 1 && embark.fits, `${lang}: 출전 버튼 글자 전체가 한 줄로 표시`, embark);
    const goal = await page.locator('#s-lobby .lb-trk.gate').evaluate(card => {
      const title = card.querySelector('.trk-t'), r = document.createRange(); r.selectNodeContents(title);
      const box = card.getBoundingClientRect(), level = card.querySelector('.trk-tl small').getBoundingClientRect();
      const row = card.querySelector('.obj').getBoundingClientRect();
      return { text: title.textContent, ellipsis: getComputedStyle(title).textOverflow,
        fits: [...r.getClientRects()].every(t => t.left >= box.left && t.right <= level.left + 1 && t.bottom <= row.top + 1) };
    });
    ok(goal.ellipsis !== 'ellipsis' && goal.fits, `${lang}: 긴 다음 목표 이름 전체 표시 · 레벨·조건과 비겹침`, goal);

    // 다시 시작하지 않고 세 언어를 오가도 등록된 모든 화면의 접근성 이름이 현재 언어를 따른다.
    await page.click('#s-lobby .tb-set'); await page.clock.runFor(100);
    for (const next of [lang === 'en' ? 'ja' : 'en', 'ko', lang]) {
      await page.click(`#s-settings [data-lang="${next}"]`); await page.clock.runFor(100);
      const labels = await page.locator('#app > .screen[aria-label],#adBanner,#tabs').evaluateAll(els => els.map(el => el.getAttribute('aria-label') || ''));
      ok(await page.locator('html').getAttribute('lang') === next && labels.every(s => next === 'ko' ? /[가-힣]/.test(s) : !/[가-힣]/.test(s)), `${lang} → ${next}: 화면 이름이 새 언어로 전환`, labels);
    }
    await page.click('#s-settings .tb-back'); await page.clock.runFor(100);
    await page.click('#s-lobby .lb-merchant'); await page.clock.runFor(100);
    const titles = await page.locator('#s-merchant .mc-buy .g-hd h3').evaluateAll(els => els.map(el => {
      const r = document.createRange(); r.selectNodeContents(el);
      const text = r.getBoundingClientRect(), box = el.getBoundingClientRect();
      return { name: el.textContent, fits: text.right <= box.right + 1 && text.left >= box.left - 1 && el.scrollWidth <= el.clientWidth + 1 };
    }));
    ok(titles.length > 0 && titles.every(t => t.fits), `${lang}: 행상인 상품 이름 전체 표시`, titles);
    await page.screenshot({ path: `${shots}/i18n-${lang}-merchant.png` });
    await page.click('#s-merchant .tb-back'); await page.clock.runFor(100);

    await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
    const guildAttrs = await koAttrs();
    ok(await page.locator('#s-guild [data-gneed]').count() > 0 && guildAttrs.length === 0, `${lang}: 길드 부탁 버튼도 현지 닉네임을 읽음`, guildAttrs);

    await toParty(page, { content: 'rustfort', tab: 'dungeon' });
    const partyAttrs = await koAttrs();
    ok(partyAttrs.length === 0, `${lang}: 편성 직업 문장과 파티원 정보의 접근성 이름 번역`, partyAttrs);
    await page.click('#s-party .tb-back'); await page.clock.runFor(100);
    const placeAlt = await page.locator('#s-content .b-gate img.b-art').getAttribute('alt');
    ok(!!placeAlt && !/[가-힣]/.test(placeAlt), `${lang}: 장소 그림의 대체 텍스트 번역`, placeAlt);
    await page.click('#s-content [data-reward="gold"]'); await page.clock.runFor(50);
    const gold = await page.locator('#bRewardChance').innerText();
    const previewGold = Number(await page.locator('#bRewardChance [data-amount]').getAttribute('data-amount'));
    const walletBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).player.gold);
    ok(!/[가-힣%]/.test(gold) && /\d/.test(gold), `${lang}: 골드 팝업은 번역된 획득량 표시`, gold);
    await page.screenshot({ path: `${shots}/i18n-${lang}-gold-reward.png` });
    await page.keyboard.press('Escape');
    await toParty(page, { content: 'rustfort', tab: 'dungeon' });
    await departGo(page); await page.clock.runFor(4000);
    for (let i = 0; i < 30 && !(await page.isVisible('#s-settle')); i++) {
      if (await page.isVisible('#rest')) { await page.click('#restGo'); await page.clock.runFor(3500); }
      else { await killEnemies(page); await page.clock.runFor(1500); }
    }
    const paid = await page.locator('#s-settle .r-cur:has([data-currency="gold"])').evaluate(el => {
      const amount = el.querySelector('.r-cv > b'), counter = amount.querySelector('[data-rc-to]');
      const total = counter ? Number(counter.dataset.rcTo) : Number(amount.textContent.replace(/[^0-9]/g, ''));
      const bonus = Number((el.querySelector('.r-rest-tag')?.textContent ?? '').replace(/[^0-9]/g, ''));
      return { total, base: total - bonus };
    });
    const walletAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).player.gold);
    ok(paid.base === previewGold && walletAfter - walletBefore === paid.total,
      `${lang}: 표시한 기본 골드 = 결과 기본액 · 별도 휴식 보너스 포함 총액이 실제 잔액에 반영`, { previewGold, paid, walletBefore, walletAfter });
    const nextLabel = await page.locator('#s-settle #next b').innerText();
    ok(lang === 'en' ? nextLabel === 'Next Battle' : nextLabel.startsWith('次の'), `${lang}: 결과의 다음 전투 버튼 문구`, nextLabel);
    await page.screenshot({ path: `${shots}/i18n-${lang}-next-battle.png` });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await toParty(page, { content: 'rustfort', tab: 'dungeon' }); await departGo(page); await page.clock.runFor(200);
    // 동일한 경비대장 보통 전투: 한국어 글을 정규식으로 읽던 HP 단계선이 다른 언어에서도 40%에 나타난다.
    await page.evaluate(() => {
      const old = window.__proto.F;
      window.__battle.start({ diff: '보통', content: 'rustfort', name: '녹슨 요새', segs: ['warden'], party: old.cfg.roster, level: 40, heroLv: 40, stageLv: 5, seed: 3, hero: 'priest' });
    });
    await page.clock.runFor(4000);
    const ticks = await page.locator('#bossTicks i').evaluateAll(els => els.map(el => el.style.left));
    ok(ticks.length === 1 && ticks[0] === '40%', `${lang}: 보스 HP 40% 단계선`, ticks);
    await page.evaluate(() => {
      const f = window.__proto.F;
      f.bossHp = f.bossMax = 10000000;
      for (const u of f.party) u.hp = u.max;
      const u = f.party.find(u => u.role === 'tank');
      u.debuffs = [
        { id: 912, name: '부패', type: '질병', left: 60, dot: 0 },
        { id: 913, name: '별빛 어지럼', type: '물리', left: 3, noDps: true, noMove: true, lock: true },
      ];
    });
    const bb = await page.locator('#board').boundingBox();
    const at = await page.evaluate(() => window.__proto.center(window.__proto.F.party.find(u => u.role === 'tank').cell));
    await page.mouse.move(bb.x + at.x, bb.y + at.y); await page.mouse.down();
    await page.clock.runFor(600); await page.mouse.up(); await page.clock.runFor(50);
    const preview = await page.locator('#preview').innerText();
    ok(!/[가-힣]/.test(preview) && preview.includes(lang === 'en' ? 'Starlight Daze' : '星光のめまい'), `${lang}: 길게 누른 실제 상태 효과 이름 번역`, preview);
    await page.screenshot({ path: `${shots}/i18n-${lang}-debuff.png` });
    await statusFeedback(page, lang, shots, ok);
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}

/** 독립 전투 fixture: 번역 배지 폭이 달라도 칸 중앙과 좌우 시간 열을 지킨다. */
export async function statusFeedback(page, lang, shots, ok) {
  const roster = await page.evaluate(() => window.__proto.F.party.filter(u => !u.me)
    .map(u => ({ nick: u.nick, role: u.role, cls: u.cls, pers: '신중파' })));
  for (const count of [3, 5, 10, 20]) {
    await page.evaluate(({ roster, count }) => {
      const encounter = { 3: 'golem18', 5: 'warden', 10: 'plague', 20: 'choir' }[count];
      window.__battle.start({ content: 'snowpass', diff: '쉬움', name: 'Blizzard Pass', segs: [encounter], hero: 'druid', level: 100, heroLv: 100,
        party: Array.from({ length: count - 1 }, (_, i) => ({ ...roster[i % roster.length],
          role: i < (count >= 10 ? 2 : 1) ? 'tank' : i % 2 ? 'ranged' : 'melee', cls: undefined })), seed: 3 });
    }, { roster, count });
    await page.clock.runFor(6500);
    // 보스 행동은 멈추고 실제 판 렌더만 검사한다. 정지 팝업은 fixture에서만 숨긴다.
    await page.click('#pauseBtn');
    await page.locator('#pause').evaluate(el => { el.hidden = true; });
    const bad = [];
    const actualCount = await page.evaluate(() => window.__proto.F.party.length);
    if (actualCount !== count) bad.push({ issue: 'party size', actualCount, count });
    for (const many of [false, true]) for (const type of ['독', '마법', '질병', '저주']) {
      const uid = await page.evaluate(({ many, type }) => {
        const f = window.__proto.F; f.dmgMult = 0; f.bossHp = f.bossMax = 10000000;
        f.events = []; f.tels = []; f.zones = [];
        for (const u of f.party) { u.alive = true; u.hp = u.max; u.moving = null; }
        const u = f.party.find(u => !u.me); u.hot = 11; u.redu = 8;
        u.guardian = many ? 9 : 0;
        u.mods = many ? [{ k: 'absorb', v: 300, until: f.t + 12, src: 'healer' }] : [];
        u.hots = many ? ['sprout', 'growth'].map(key => ({ key, name: key, left: 10, tick: 99, every: 3, per: 0, i: 0, rest: 0 })) : [];
        u.debuffs = [{ id: 9001, name: '서리 손길', type, left: 4, dot: 0 }];
        return u.id;
      }, { many, type });
      await page.clock.runFor(32);
      const issues = await page.locator('#board').evaluate((cv, uid) => {
        const bounds = JSON.parse(cv.dataset.decorationBounds), own = key => bounds.find(b => b.key === key);
        const body = own(`body${uid}`), badge = own(`deb${uid}`), nick = own(`nick${uid}`), text = own(`deb${uid}-text`);
        const timers = bounds.filter(b => b.shape === 'circle' && new RegExp(`^(hot${uid}-|guard${uid}-|shield${uid}$)`).test(b.key));
        const bad = [];
        if (!body || !badge || !text || timers.length < 2) return ['missing fixture bounds'];
        if (Math.abs(badge.x - body.x) > .2 || Math.abs(nick.x - body.x) > .2) bad.push('badge or name shifted from cell center');
        if (text.w > badge.w + .2) bad.push('translated label outside badge');
        for (const t of timers) {
          if (t.x - t.w / 2 < body.x - body.w / 2 - .2 || t.x + t.w / 2 > body.x + body.w / 2 + .2) bad.push(`${t.key} outside cell`);
          if (Math.abs(t.y - badge.y) < (t.h + badge.h) / 2 - .1 && Math.abs(t.x - badge.x) < (t.w + badge.w) / 2 - .1) bad.push(`${t.key} overlaps badge`);
        }
        return bad;
      }, uid);
      if (issues.length) bad.push({ many, type, issues });
      if (!many && type === '마법' && count === 3) await page.screenshot({ path: `${shots}/i18n-${lang}-status-centered.png` });
    }
    ok(!bad.length, `${lang}: ${count}인 독·마법·질병·저주 + 지속 힐·방어 시간은 칸 중앙·테두리 안·비겹침`, bad);
    if (count === 3) {
      await page.locator('#resumeBtn').evaluate(el => el.click());
      await page.locator('#wheel [data-slot="unique"]').click(); await page.clock.runFor(32);
      const reason = await page.locator('#toast .toast').last().textContent();
      ok(reason === (lang === 'en' ? 'No fallen party members' : '倒れたパーティメンバーなし'), `${lang}: 환생 실패 알림의 실제 표시 번역`, reason);
      await page.screenshot({ path: `${shots}/i18n-${lang}-action-failure.png` });
    }
  }
}
