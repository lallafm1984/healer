// 세로 UI 회귀: 그림 로드 (캐릭터 그림 없음, 장소·메뉴 그림은 28), 고정 출발 버튼, 좁은 메뉴, 20인/특성/전멸 배치.
import { chromium } from 'playwright';
import { chooseContent, departGo, entryGo, pastTitle, rowContentKeys, toParty } from './nav.mjs';
import { equipmentLayout } from './character.mjs';

export default async function portrait(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (value, message) => { console.log(`${value ? 'PASS' : 'FAIL'} ${message}`); if (!value) fails++; };
  for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // CI처럼 GPU가 없는 환경에서도 마을 움직임을 확인 (앱은 원래 한 장면만 그림)
    await ctx.addInitScript(() => { window.__villageMotion = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install();
    await page.goto(url);
    await page.clock.runFor(300);
    const loaded = selector => page.locator(selector).evaluateAll(async imgs => {
      const decoded = await Promise.all(imgs.map(async i => {
        try { await i.decode(); return i.naturalWidth > 0 && i.complete; } catch { return false; }
      }));
      return decoded.length > 0 && decoded.every(Boolean);
    });
    const noOverflow = selector => page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    // CSS 배경 그림 (pseudo = '::before' 등)이 실제로 읽히는지
    const bgLoaded = (selector, pseudo = null) => page.locator(selector).first().evaluate(async (el, ps) => {
      const urls = [...getComputedStyle(el, ps).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)].map(m => m[1]);
      if (!urls.length) return false;
      const ok = await Promise.all(urls.map(u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; })));
      return ok.every(Boolean);
    }, pseudo);
    const noHeroArt = () => page.evaluate(() => !document.querySelector('.healer-illustration') && ![...document.images].some(i => /healer-/.test(i.src)));
    ok(await bgLoaded('#s-title') && await noHeroArt(), `${width}: 타이틀 마을 그림, 힐러 그림 없음`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_title_${width}.png` });
    await pastTitle(page);
    ok(await page.locator('#s-lobby .topbar .tb-pf .emblem').count() === 1 && await noHeroArt(), `${width}: 로비 위 줄 캐릭터 칸 = 직업 문장 (힐러 그림 없음)`);
    // 살아 있는 마을 (코덱스 시안): 853×1844 캔버스가 그려지고, 그리기 전 바탕 그림도 읽힘
    const villageReady = async () => {
      for (let i = 0; i < 40 && !(await page.locator('#s-lobby .lb-village.live canvas').count()); i++) await page.waitForTimeout(100);
      return page.locator('#s-lobby .lb-village').evaluate(el => {
        const c = el.querySelector('canvas'), img = el.querySelector('img.lb-village-base');
        return { live: el.classList.contains('live'), w: c?.width, h: c?.height, base: !!img && img.complete && img.naturalWidth === 853 };
      });
    };
    const vill = await villageReady();
    ok(vill.live && vill.w === 853 && vill.h === 1844 && vill.base, `${width}: 살아 있는 마을 캔버스 853×1844 · 바탕 그림 로드`);
    if (width === 320) console.log(`INFO 마을 그래픽: ${await page.locator('#s-lobby .lb-village').evaluate(el => el.dataset.gl)}`);
    const villageTime = () => page.locator('#s-lobby .lb-village').evaluate(el => Number(el.dataset.t || 'NaN'));
    // A2 목재·리넨 부품: 의미별 메뉴 아이콘과 독립 목표/출전 재질이 실제로 읽히는지.
    const lobbyIcons = '#s-lobby .lb-sock .g-ic, #s-lobby .lb-plate > .g-ic, #s-lobby .lb-cta > .g-ic';
    const iconsLoaded = await loaded(lobbyIcons) && (await Promise.all([
      '.lb-missions .g-ic', '.lb-chal .g-ic', '.lb-shop > .g-ic', '.lb-merchant > .g-ic', '.lb-cta > .g-ic',
    ].map(selector => loaded(`#s-lobby ${selector}`)))).every(Boolean);
    ok(iconsLoaded, `${width}: 로비 소켓·패널·출전 그림 (임무·주간 도전·상점·행상인·출전) decode`);
    ok(await bgLoaded('#s-lobby .lb-main') && await bgLoaded('#s-lobby .lb-trk') && await bgLoaded('#lobbyStart')
      && await bgLoaded('#s-lobby .topbar', '::before') && await bgLoaded('#tabs button[aria-current="page"]') && await bgLoaded('#tabs button:not([aria-current])'),
      `${width}: A2 소켓·독립 목표·붉은 출전·위 정보창·하단 탭 재질 로드`);

    // 메뉴 (소켓·패널)는 장면 안, 아래 목표·출전 패널과 서로 겹치지 않음
    const lobbyGeometry = () => page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      const world = document.querySelector('#s-lobby .lb-world');
      const journey = document.querySelector('#s-lobby .lb-journey');
      const cta = document.querySelector('#lobbyStart');
      if (!world || !journey || !cta) return null;
      return { world: rect(world), journey: rect(journey), cta: rect(cta),
        items: [...document.querySelectorAll('#s-lobby .lb-sc, #s-lobby .lb-plate')].map(el => ({ name: el.textContent.trim().replace(/\s+/g, ' '), rect: rect(el) })),
        viewport: { w: innerWidth, h: innerHeight } };
    });
    const settleLobby = async () => {
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.clock.runFor(80);
      let previous = await lobbyGeometry();
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.clock.runFor(32);
        const current = await lobbyGeometry();
        if (current && JSON.stringify(current) === JSON.stringify(previous)) return { geometry: current, stable: true };
        previous = current;
      }
      return { geometry: previous, stable: false };
    };
    const checkLobbyBounds = (g, label) => {
      const inside = r => r.w > 0 && r.h > 0 && r.x >= Math.max(0, g.world.x) - 1 && r.y >= Math.max(0, g.world.y) - 1
        && r.right <= Math.min(g.viewport.w, g.world.right) + 1 && r.bottom <= Math.min(g.viewport.h, g.world.bottom) + 1;
      const apart = (a, b) => a.right <= b.x + 1 || a.x >= b.right - 1 || a.bottom <= b.y + 1 || a.y >= b.bottom - 1;
      const items = g ? g.items : [];
      const outside = items.filter(b => !inside(b.rect)), overJourney = items.filter(b => !apart(b.rect, g.journey));
      const overEach = items.filter((b, i) => items.some((o, j) => j !== i && !apart(b.rect, o.rect)));
      // 소켓 2개 (임무·주간 도전, 휴식이 가득이라 휴식 충전 없음) + 패널 2개 (상점·행상인, 2026-10-21 Lim 레이드·대장간 뺌). 길드는 하단 탭 (#231), 「다시」 소켓은 없음 (2026-10-12)
      ok(items.length === 4 && !outside.length && inside(g.journey), `${label}: 소켓 2개·패널 2개·목표 패널 모두 잘림 없이 장면 안`);
      ok(items.length === 4 && !overJourney.length && !overEach.length, `${label}: 소켓·패널끼리, 목표·출전 패널과 겹침 없음`);
      if (outside.length || overJourney.length || overEach.length) console.log(JSON.stringify({ label, outside, overJourney, overEach, world: g.world, journey: g.journey }));
    };
    const initialLobby = await settleLobby();
    ok(initialLobby.stable, `${width}: 로비 이미지·글꼴 로드 후 배치 안정`);
    const initialGeometry = initialLobby.geometry;
    checkLobbyBounds(initialGeometry, `${width}×${height}`);
    const button = await page.locator('#lobbyStart').boundingBox(), tabs = await page.locator('#tabs').boundingBox();
    ok(button.y + button.height <= tabs.y + 1 && button.height >= 44, `${width}: 바로 출전 버튼 항상 탭 위, 44px 이상`);
    ok(await noOverflow('#s-lobby .ns-body'), `${width}: 로비 가로 넘침 없음`);
    await page.screenshot({ path: `${shots}/portrait_lobby_${width}.png` });

    // 장면 시간 = 마을이 실제로 그려진 시간. 보이는 동안 흐르고, 다른 탭·동작 줄이기에서는 멈춤
    const t0 = await villageTime(); await page.clock.runFor(1500); const t1 = await villageTime();
    // CI의 소프트웨어 그래픽에서는 그리는 장 수가 적어 흐른 양은 보지 않고 흐르는지만 본다
    ok(t1 > t0, `${width}: 로비에서 마을이 움직임 (장면 시간 ${t0} → ${t1})`);
    if (width === 390) {
      // 높이는 고정하고 폭만 바꿔도 메뉴가 장면 안에서 서로 겹치지 않는다.
      for (const resizedWidth of [320, 360, 390, 430, 390]) {
        await page.setViewportSize({ width: resizedWidth, height: 844 });
        const settled = await settleLobby();
        ok(settled.stable, `${resizedWidth}×844 resize: 배치 안정`);
        checkLobbyBounds(settled.geometry, `${resizedWidth}×844 resize`);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const r0 = await villageTime(); await page.clock.runFor(1500); const r1 = await villageTime();
      ok(r0 === r1, `390: 동작 줄이기에서 마을이 멈춘 한 장면 (${r0} → ${r1})`);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(80);
    if (width === 390) {
      const h0 = await villageTime(); await page.clock.runFor(1500); const h1 = await villageTime();
      ok(await page.locator('#s-lobby').evaluate(el => el.hidden) && h0 === h1, `390: 캐릭터 탭으로 가면 숨은 로비 마을 멈춤 (${h0} → ${h1})`);
      // 주간 도전 상자 받기로 로비를 다시 그려도 같은 캔버스를 옮겨 붙여 움직임이 이어짐 (처음 장면으로 점프 없음)
      await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('healer.save'));
        save.chalChest = 1;
        localStorage.setItem('healer.save', JSON.stringify(save));
      });
      await page.reload(); await page.clock.runFor(300); await pastTitle(page);
      await villageReady(); await page.clock.runFor(2000);
      await page.locator('#s-lobby .lb-village canvas').evaluate(c => { window.__villageCanvas = c; });
      const before = await villageTime();
      await page.click('#lbChal'); await page.clock.runFor(200);
      const same = await page.locator('#s-lobby .lb-village canvas').evaluate(c => c === window.__villageCanvas);
      const after = await villageTime();
      ok(same && after >= before, `390: 주간 도전 상자 수령 후 같은 마을 캔버스, 장면 시간 이어짐 (${before} → ${after})`);
      await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(80);
    }
    ok(await page.locator('#s-char .c7-mid .c7-stat').count() === 6 && await noOverflow('#s-char .ns-body'), `${width}: 캐릭터 장비 중앙 능력치 6줄 화면 안`);
    const equipment = await equipmentLayout(page);
    ok(equipment.centered && equipment.viewport && equipment.valuesFit, `${width}: 중앙 능력치 6줄이 좌우 슬롯 사이·액션행 위, 텍스트 겹침·화면 클립 없음 (${JSON.stringify(equipment)})`);
    await page.screenshot({ path: `${shots}/portrait_character_${width}.png`, animations: 'disabled' });
    await page.click('#s-char nav [data-csub="hero"]'); await page.clock.runFor(80);
    ok(await page.locator('#s-char [data-hcard] .emblem').count() === 7 && await noHeroArt(), `${width}: 일곱 직업 = 직업 문장 (79 직업 4종이 들어와 7)`);
    await page.click('#s-char nav [data-csub="skill"]'); await page.clock.runFor(80);
    ok(await noOverflow('#s-char .ns-body'), `${width}: 스킬 휠 편집 가로 넘침 없음`);
    // 상점은 하단 탭이 아니라 로비 잡화점에서 (2026-10-18), 뒤로 = 로비
    await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(80);
    await page.click('#s-lobby .lb-shop'); await page.clock.runFor(80);
    ok(await noOverflow('#s-shop .ns-body'), `${width}: 상점 가로 넘침 없음`);
    ok(await bgLoaded('#s-shop .shop-hero', '::before'), `${width}: 상점 선반 그림`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_shop_${width}.png` });
    await page.click('#s-shop .tb-back'); await page.clock.runFor(80);
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(80);
    ok(await loaded('#s-content .b-gate img') && await page.locator('#s-content .b-region').count() >= 2 && await noOverflow('#s-content .b-body'), `${width}: 전투 탭 풍경 미리보기 + 장소 카드, 가로 넘침 없음`);
    // 2026-10-16: 분류 탭은 나무결 그림 대신 길드 홀 돌색 + 황동 테 (::before border-image)
    const catFrame = sel => page.locator(sel).first().evaluate(async el => {
      const u = getComputedStyle(el, '::before').borderImageSource.match(/url\("?([^")]+)"?\)/)?.[1];
      return !!u && !/url\(/.test(getComputedStyle(el).backgroundImage) && await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; });
    });
    ok(await catFrame('#s-content .b-cat[aria-selected="true"]') && await catFrame('#s-content .b-cat[aria-selected="false"]'), `${width}: 활성·비활성 분류 탭 = 돌색 + 황동 테 로드`);
    // 레이드는 전투 탭 분류에서 (로비 레이드 팻말은 2026-10-21 Lim이 뺌)
    await page.click('#s-content [data-ctab="raid10"]'); await page.clock.runFor(80);
    ok(await page.getAttribute('#s-content [data-ctab="raid10"]', 'aria-selected') === 'true', `${width}: 전투 탭 10인 레이드 분류`);
    // 분류 = 탐험 · 던전 · 10인 레이드 · 20인 레이드 (2026-10-09 이벤트 탭 뺌). 레이드 탭엔 그 인원 레이드만
    const cats = await page.evaluate(() => [...document.querySelectorAll('#s-content [data-ctab]')].map(b => `${b.dataset.ctab}:${b.getAttribute('aria-label')}`).join());
    ok(/^explore:탐험[^,]*,dungeon:던전[^,]*,raid10:10인 레이드[^,]*,raid20:20인 레이드[^,]*$/.test(cats) && !/이벤트/.test(await page.textContent('#s-content .b-cats')), `${width}: 분류 4칸 = 탐험·던전·10인 레이드·20인 레이드, 이벤트 없음 (${cats})`);
    // 관문은 분류가 바뀌어도 같은 자리·같은 크기. 레이드 장소는 장소 줄에서 확인한다 (개발 빌드라 레벨 잠금 없이 전부).
    const gates = [], raids = {};
    for (const t of ['explore', 'raid10', 'raid20', 'dungeon']) {
      await page.click(`#s-content [data-ctab="${t}"]`); await page.clock.runFor(60);
      await page.locator('#s-content .b-body').evaluate(el => { el.scrollTop = 0; });
      const b = await page.locator('#s-content .b-gate').boundingBox();
      gates.push(b);
      if (t.startsWith('raid')) raids[t] = await rowContentKeys(page);
    }
    ok(gates.every(b=>b && b.height>0 && b.y>=0 && b.y+b.height<=height), `${width}: 네 분류 모두 풍경이 화면 안에 표시`);
    const sections = prefixes => prefixes.flatMap(prefix => [1, 2, 3].map(n => `${prefix}${n}`));
    const expectedRaids = {
      raid10: [...[1, 2, 3, 4, 5].map(n => `abyss${n}`), ...sections(['gull', 'queen', 'isle', 'fest', 'cave', 'palace', 'den', 'nest', 'bazaar', 'dusk', 'pyramid', 'post', 'fort', 'maze'])],
      raid20: [...[1, 2, 3, 4].map(n => `cathedral${n}`), ...sections(['abbey', 'rootwood', 'reservoir', 'well', 'crystal', 'shadow', 'camp', 'coast', 'heart'])],
    };
    ok(Object.keys(expectedRaids).every(tab=>JSON.stringify([...raids[tab]].sort())===JSON.stringify([...expectedRaids[tab]].sort())), `${width}: 장소 줄에 10인 47곳·20인 31곳이 빠짐없이 표시`);
    await chooseContent(page, 'rustfort');
    const selection = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const row = document.querySelector('#s-content .b-regions'), cards = [...row.querySelectorAll('.b-region')];
      const gate = document.querySelector('#s-content .b-gate'), level = gate.querySelector('.b-level'), name = gate.querySelector('.b-gt');
      return {
        row: rect(row), cards: cards.map(rect), selected: row.querySelector('.b-region.on')?.dataset.content,
        places: cards.map(c => c.dataset.content), lvs: cards.map(c => Number(c.querySelector('small').textContent.replace(/\D/g, ''))),
        modal: !!document.querySelector('#s-content .b-place-modal, #s-content [data-current-places], #s-content [data-region]'),
        gate: rect(gate), level: rect(level), name: rect(name),
        levelLabel: level.getAttribute('aria-label'), levelFont: parseFloat(getComputedStyle(level.querySelector('strong')).fontSize),
        arrow: getComputedStyle(document.querySelector('#s-content .b-cat[aria-selected="true"]'), '::after').content,
        chal: !!document.querySelector('#s-content > .b-body > .b-chal'),
      };
    });
    ok(selection.selected === 'rustfort' && selection.places.slice(0, 2).join() === 'rustfort,mine' && !selection.modal
      && selection.lvs.every((lv, i) => i === 0 || selection.lvs[i - 1] <= lv)
      && selection.cards.every(r => r.width >= 44 && r.height >= 44) && selection.row.left >= 0 && selection.row.right <= width + 1,
      `${width}: 던전 장소 줄 = 녹슨 요새·광산부터 레벨 순, 팝업·지역 단계 없음, 카드 터치 영역과 가로 경계 정상`);
    const levelApart = selection.level.left >= selection.name.right || selection.level.right <= selection.name.left
      || selection.level.bottom <= selection.name.top || selection.level.top >= selection.name.bottom;
    ok(selection.levelLabel === '권장 레벨 5' && selection.levelFont >= (height <= 760 ? 22 : 24) && selection.gate.height > 0
      && levelApart && selection.level.right <= selection.gate.right && selection.level.top >= selection.gate.top && selection.level.bottom <= selection.gate.bottom,
      `${width}: 작은 풍경 안 권장 레벨을 크게 표시, 장소명과 겹침 없음`);
    ok(['none', 'normal', '""'].includes(selection.arrow) && selection.chal, `${width}: 탭 선택 화살표 제거, 던전 주간 도전 버튼 유지`);
    ok(await loaded('#s-content .b-region.on img'), `${width}: 고른 장소 카드 풍경 로드`);
    await page.locator('#s-content .b-body').evaluate(el => { el.scrollTop = 0; });
    const go = await page.locator('#contentGo').boundingBox(), tb = await page.locator('#tabs').boundingBox();
    ok(go.y + go.height <= tb.y + 1 && go.height >= 44, `${width}: 출전 버튼 항상 탭 위, 44px 이상`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_content_${width}.png` });
    // 출전 = 바로 편성 (입장 화면 합침): 가로 넘침 없음, 공략·단축칸·출발 44px 이상, 파티원 4줄이 첫 화면에서 시작
    await page.click('#contentGo'); await page.clock.runFor(100); await entryGo(page);
    const pty = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect();
      const foot = r(document.querySelector('#s-party .f-foot2')), rows = [...document.querySelectorAll('#s-party .pcard')].map(r);
      const taps = [...document.querySelectorAll('#guideOpen, #s-party .f-item, #depart, #s-party .tb-back')].map(e => Math.round(Math.min(r(e).height, r(e).width)));
      return { taps, rows: rows.length, lastTop: Math.round(rows[rows.length - 1].top), foot: Math.round(foot.top), ttl: document.querySelector('#s-party .f-ttl').scrollWidth <= document.querySelector('#s-party .f-ttl').clientWidth };
    });
    ok(await noOverflow('#s-party .f-pty') && await noOverflow('#s-party .f-foot2') && await noOverflow('#s-party .topbar') && pty.ttl, `${width}: 편성 가로 넘침·제목 잘림 없음`);
    ok(pty.taps.every(x => x >= 44), `${width}: 편성 공략·단축칸 2개·출발·뒤로 44px 이상 (${pty.taps.join(',')})`);
    ok(pty.rows === 4 && pty.lastTop < pty.foot, `${width}: 5인 편성 = 파티원 4줄이 첫 화면에서 보이기 시작 (마지막 줄 ${pty.lastTop} < 아래 ${pty.foot})`);
    if (width === 320 || width === 390) await page.screenshot({ path: `${shots}/portrait_party_${width}.png` });

    // 최고 레벨의 최대 특성 버튼 3개 조건을 만든다 (소비 아이템은 2026-10-16 없앰).
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.player.level = 100;
      s.heroes.priest ||= { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0 };
      s.heroes.priest.talents = [null, null, null, null, 0, null, 1, null, null, 0];
      s.settings.devSkills = true;
      localStorage.setItem('healer.save', JSON.stringify(s));
    });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await toParty(page, { content: 'cathedral1', tab: 'raid20' });
    await departGo(page); await page.clock.runFor(3400);
    const geometry = () => page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      return {
        stage: rect(document.querySelector('#stage')), board: rect(document.querySelector('#boardWrap')), controls: rect(document.querySelector('#controls')),
        // 조작판 버튼은 겉 크기가 축소 0.9로 41px여도 투명 터치 영역 (data-hit-width, compact.css ::before)이 44px (battle/index.ts layoutBattle)
        buttons: [...document.querySelectorAll('#aux button, #pauseBtn')].filter(el => el.getClientRects().length).map(el => ({ ...rect(el), hw: Math.max(el.getBoundingClientRect().width, Number(el.dataset.hitWidth) || 0), hh: Math.max(el.getBoundingClientRect().height, Number(el.dataset.hitHeight) || 0) })),
        wheel: rect(document.querySelector('#wheel')),
      };
    });
    const g = await geometry();
    ok(await page.evaluate(() => document.getElementById('battle').dataset.place) === 'cathedral' && await bgLoaded('#boardWrap'), `${width}: 20인 판 뒤 대성당 바닥 그림`);
    ok(g.stage.y >= 70 && g.controls.bottom <= height + 1 && g.board.h >= 120, `${width}: 20인 무대·판·조작 화면 안 (판 ${Math.round(g.board.h)}px)`);
    ok(g.buttons.length >= 4 && g.buttons.every(r => r.hw >= 44 && r.hh >= 44 && r.x >= 0 && r.right <= width + 1 && r.bottom <= height + 1), `${width}: 최대 특성 버튼 3개 · 일시정지 터치 44px 및 화면 경계 ${JSON.stringify(g.buttons.map(r => [Math.round(r.x), Math.round(r.w), Math.round(r.hw), Math.round(r.right), Math.round(r.bottom)]))}`);
    ok(g.buttons.filter(r => r.y >= g.controls.y).every(r => r.right <= g.wheel.x + 1 || r.x >= g.wheel.right - 1), `${width}: 특성·아이템과 휠 겹침 없음`);
    // 원화는 내부 원을 가득 채워 크롭한다. 그림의 사각형 전체를 원 안에 요구하지 않고
    // 실제 원형 마스크와 cover를 확인한다. 글자는 위아래 1/4 지점의 원 폭으로 잼.
    const wheelFit = await page.evaluate(() => [...document.querySelectorAll('#wheel .slot[data-slot]')].map(s => {
      const r = s.getBoundingClientRect(), R = r.width / 2 - 3, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const bad = [...s.querySelectorAll('.sic, .nm, .ct')].filter(e => e.getClientRects().length && e.textContent !== '' || e.tagName === 'IMG').filter(e => {
        if (e.tagName === 'IMG') {
          const inner = e.closest('.in'), a = e.getBoundingClientRect(), b = inner?.getBoundingClientRect();
          const style = inner && getComputedStyle(inner);
          return !b || !style.clipPath.startsWith('circle(') || style.overflow !== 'hidden'
            || getComputedStyle(e).objectFit !== 'cover' || !e.complete || e.naturalWidth <= 0
            || a.left > b.left + 1 || a.top > b.top + 1 || a.right < b.right - 1 || a.bottom < b.bottom - 1;
        }
        const rg = document.createRange(); rg.selectNodeContents(e);
        const b = rg.getBoundingClientRect();
        const y = Math.max(Math.abs(b.top + b.height / 4 - cy), Math.abs(b.bottom - b.height / 4 - cy)), half = Math.sqrt(Math.max(0, R * R - y * y));
        return b.left < cx - half - 1 || b.right > cx + half + 1;
      });
      return { art: !!s.querySelector('img.sic'), bad: bad.map(e => e.className || e.tagName) };
    }));
    ok(wheelFit.length >= 7 && wheelFit.every(x => x.art) && wheelFit.every(x => !x.bad.length), `${width}: 전투 휠 칸마다 스킬 그림, 그림·이름·마나 % 가 둥근 칸 안 (${JSON.stringify(wheelFit.filter(x => x.bad.length))})`);
    await page.screenshot({ path: `${shots}/portrait_battle20_${width}.png` });
    if (await page.locator('#queue .q').count()) {
      const first = await page.locator('#queue .q').first().elementHandle();
      await first.focus();
      await page.clock.runFor(300);
      ok(await first.evaluate(el => el.isConnected && document.activeElement === el), `${width}: 카운트다운 중 기술 버튼 DOM·초점 유지`);
    }
    await page.evaluate(() => { for (const u of window.__proto.F.party.filter(u => u.role === 'tank')) { u.hp = 0; u.alive = false; } });
    await page.clock.runFor(100);
    const down = await geometry(), giveUp = await page.locator('#giveUp').boundingBox();
    ok(giveUp && giveUp.y + giveUp.height <= height + 1 && down.board.h >= 120, `${width}: 탱커 전멸 포기 버튼 및 판 유지 (${Math.round(down.board.h)}px)`);
    const timerTxt = await page.locator('#timer').textContent();
    ok(/탱커 없음 · 광폭까지 0:1\d/.test(timerTxt || ''), `${width}: 20인 탱커 전멸 뒤 시간 줄에 광폭화 카운트다운 (${timerTxt})`);
    for (const elapsed of [0, 150, 300]) {
      if (elapsed) await page.clock.runFor(150);
      const feedback = await page.evaluate(() => {
        const bounds = JSON.parse(document.querySelector('#board').dataset.decorationBounds || '[]');
        const text = bounds.filter(b => ['hp', 'nick'].includes(b.kind));
        const effects = bounds.filter(b => ['float', 'bubble'].includes(b.kind));
        const separate = (a, b) => a.x + a.w / 2 <= b.x - b.w / 2 + .05 || b.x + b.w / 2 <= a.x - a.w / 2 + .05
          || a.y + a.h / 2 <= b.y - b.h / 2 + .05 || b.y + b.h / 2 <= a.y - a.h / 2 + .05;
        return { textCount: text.length, effectCount: effects.length,
          collisions: effects.flatMap(effect => text.filter(t => !separate(effect, t)).map(t => ({ effect: effect.key, text: t.key }))) };
      });
      ok(feedback.textCount > 0 && feedback.collisions.length === 0,
        `${width}: 전멸 후 ${100 + elapsed}ms 부유 문구·말풍선과 HP/이름 비겹침 (${JSON.stringify(feedback)})`);
    }
    await page.screenshot({ path: `${shots}/portrait_tankdown_${width}.png` });
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
