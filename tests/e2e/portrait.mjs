// 세로 UI 회귀: 그림 로드 (캐릭터 그림 없음, 장소·메뉴 그림은 28), 고정 출발 버튼, 좁은 메뉴, 20인/특성/전멸 배치.
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function portrait(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (value, message) => { console.log(`${value ? 'PASS' : 'FAIL'} ${message}`); if (!value) fails++; };
  for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
    const villageTime = () => page.locator('#s-lobby .lb-village').evaluate(el => Number(el.dataset.t || 'NaN'));
    // 전투 Sunforged 부품 (코덱스 로비 시안): 소켓·패널·출전 그림과 가죽·소켓 재질이 실제로 읽히는지
    const lobbyIcons = '#s-lobby .lb-sock .g-ic, #s-lobby .lb-plate > .g-ic, #s-lobby .lb-cta > .g-ic';
    const iconsLoaded = await loaded(lobbyIcons) && await page.locator(lobbyIcons).evaluateAll(imgs =>
      ['icon-mission', 'icon-challenge', 'icon-chest', 'icon-raid', 'tab-shop', 'tab-battle'].every(name => imgs.some(i => i.src.includes(name))));
    ok(iconsLoaded, `${width}: 로비 소켓·패널·출전 그림 (임무·주간 도전·일일 상자·첨탑·잡화점·출전) decode`);
    ok(await bgLoaded('#s-lobby .lb-sock') && await bgLoaded('#s-lobby .lb-journey') && await bgLoaded('#s-lobby .topbar', '::before') && await bgLoaded('#tabs .tab-sock'),
      `${width}: 원형 소켓 · 가죽 패널 · 위 정보창 · 하단 탭 소켓 재질 로드`);

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
      // 소켓 3개 (임무·주간 도전·일일 상자) + 패널 2개 (첨탑·잡화점). 길드 회관은 길드를 빼 두어 없음, 「다시」는 지난 판이 없어 없음
      ok(items.length === 5 && !outside.length && inside(g.journey), `${label}: 소켓 3개·패널 2개·목표 패널 모두 잘림 없이 장면 안`);
      ok(items.length === 5 && !overJourney.length && !overEach.length, `${label}: 소켓·패널끼리, 목표·출전 패널과 겹침 없음`);
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
      // 임무 받기로 로비를 다시 그려도 같은 캔버스를 옮겨 붙여 움직임이 이어짐 (처음 장면으로 점프 없음)
      await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('healer.save'));
        save.daily.missions[0].n = 999;
        save.daily.missions[0].got = false;
        localStorage.setItem('healer.save', JSON.stringify(save));
      });
      await page.reload(); await page.clock.runFor(300); await pastTitle(page);
      await villageReady(); await page.clock.runFor(2000);
      await page.locator('#s-lobby .lb-village canvas').evaluate(c => { window.__villageCanvas = c; });
      const before = await villageTime();
      await page.click('#lbClaim'); await page.clock.runFor(200);
      const same = await page.locator('#s-lobby .lb-village canvas').evaluate(c => c === window.__villageCanvas);
      const after = await villageTime();
      ok(same && after >= before, `390: 임무 보상 수령 후 같은 마을 캔버스, 장면 시간 이어짐 (${before} → ${after})`);
      await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(80);
    }
    ok(await page.locator('#s-char .c7-stage .c7-bigem .emblem').count() === 1 && await noOverflow('#s-char .ns-body'), `${width}: 캐릭터 장비 받침대 직업 문장·능력치 화면 안`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_character_${width}.png` });
    await page.click('#s-char nav [data-csub="hero"]'); await page.clock.runFor(80);
    ok(await page.locator('#s-char [data-hcard] .emblem').count() === 3 && await noHeroArt(), `${width}: 구현된 세 직업 = 직업 문장`);
    await page.click('#s-char nav [data-csub="skill"]'); await page.clock.runFor(80);
    ok(await noOverflow('#s-char .ns-body'), `${width}: 스킬 휠 편집 가로 넘침 없음`);
    await page.click('#tabs [data-tab="shop"]'); await page.clock.runFor(80);
    ok(await noOverflow('#s-shop .ns-body'), `${width}: 상점 가로 넘침 없음`);
    ok(await bgLoaded('#s-shop .shop-hero', '::before'), `${width}: 상점 선반 그림`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_shop_${width}.png` });
    await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(80);
    ok(await loaded('#s-content .b-gate img') && await page.locator('#s-content .b-places .fmark').count() >= 6 && await noOverflow('#s-content .b-body'), `${width}: 전투 탭 관문 장소 그림 + 장소 문양 6곳, 가로 넘침 없음`);
    // 로비 첨탑 이름표 → 전투 탭 10인 레이드
    await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(80);
    await page.click('#s-lobby .lb-raid'); await page.clock.runFor(80);
    ok(await page.getAttribute('#s-content [data-ctab="raid10"]', 'aria-selected') === 'true', `${width}: 로비 첨탑 → 10인 레이드 탭`);
    // 분류 = 탐험 · 던전 · 10인 레이드 · 20인 레이드 (2026-10-09 이벤트 탭 뺌). 레이드 탭엔 그 인원 레이드만
    const cats = await page.evaluate(() => [...document.querySelectorAll('#s-content [data-ctab]')].map(b => `${b.dataset.ctab}:${b.getAttribute('aria-label')}`).join());
    ok(/^explore:탐험[^,]*,dungeon:던전[^,]*,raid10:10인 레이드[^,]*,raid20:20인 레이드[^,]*$/.test(cats) && !/이벤트/.test(await page.textContent('#s-content .b-cats')), `${width}: 분류 4칸 = 탐험·던전·10인 레이드·20인 레이드, 이벤트 없음 (${cats})`);
    // 관문은 분류가 바뀌어도 같은 자리·같은 크기 (주간 도전은 관문 위 띠가 아니라 장소 줄 맨 앞 칸)
    const gates = [], raids = {};
    for (const t of ['explore', 'raid10', 'raid20', 'dungeon']) {
      await page.click(`#s-content [data-ctab="${t}"]`); await page.clock.runFor(60);
      const b = await page.locator('#s-content .b-gate').boundingBox();
      gates.push(`${Math.round(b.y)}/${Math.round(b.height)}`);
      if (t.startsWith('raid')) raids[t] = await page.evaluate(() => [...document.querySelectorAll('#s-content .b-pl[data-content]')].map(b => b.dataset.content).join());
    }
    ok(new Set(gates).size === 1, `${width}: 관문 자리·크기가 탐험·10인·20인 레이드·던전 모두 같음 (${gates.join(' ')})`);
    ok(/^abyss1(,abyss\d)*(,gull\d)*(,queen\d)*(,isle\d)*(,fest\d)*(,cave\d)*(,palace\d)*(,den\d)*(,nest\d)*(,bazaar\d)*(,dusk\d)*(,pyramid\d)*(,post\d)*(,fort\d)*(,maze\d)*$/.test(raids.raid10) && /^cathedral1(,cathedral\d)*(,abbey\d)*(,rootwood\d)*(,reservoir\d)*(,well\d)*(,crystal\d)*(,shadow\d)*(,camp\d)*(,coast\d)*(,heart\d)*$/.test(raids.raid20), `${width}: 10인 탭 = 탑 (1층부터) · 항구 · 여왕호 · 요새 · 축제 마당 · 동굴 정원 · 궁전 · 보물 굴 · 둥지 · 노을 시장 · 노을 궁전 · 낮잠 피라미드 · 구름 우체국 · 폭풍 성채 · 그림자 미궁 순, 20인 탭 = 대성당 (1구역부터) · 물밑 수도원 · 빛뿌리 숲 · 별빛 저수지 · 숨결 우물 · 수정 뿌리굴 · 그림자 성벽 · 그림자 진영 · 어둠물 해안 · 심연의 심장 ${JSON.stringify(raids)}`);
    const row = await page.evaluate(() => {
      const sc = document.querySelector('#s-content .b-plr'), r = sc.getBoundingClientRect();
      const cut = [...sc.querySelectorAll('.b-pl')].some(b => { const x = b.getBoundingClientRect(); return x.left < r.right - 8 && x.right > r.right + 8; });
      return { chal: !!document.querySelector('#s-content .b-places > .b-chal'), over: sc.scrollWidth > sc.clientWidth + 1, cut, more: sc.parentElement.dataset.more };
    });
    ok(row.chal && row.over && row.cut && row.more === 'r', `${width}: 던전 장소 줄 = 맨 앞 주간 도전 고정 칸 + 넘치면 가로로 넘김 (반 칸 걸침, 오른쪽만 흐림)`);
    if (width === 390) {
      for (let i = 0; i < 4; i++) { await page.click('#s-content [aria-label="다음 장소"]'); await page.clock.runFor(600); }
      const mid = await page.evaluate(() => {
        const sc = document.querySelector('#s-content .b-plr'), r = sc.getBoundingClientRect(), b = sc.querySelector('.b-pl.on').getBoundingClientRect();
        return Math.abs((b.left - r.left) - (r.right - b.right));
      });
      ok(mid <= 3, `${width}: ›로 넘기면 고른 장소가 줄 가운데로`);
      await page.click('#s-content [data-content="rustfort"]'); await page.clock.runFor(600);
    }
    const go = await page.locator('#contentGo').boundingBox(), tb = await page.locator('#tabs').boundingBox();
    ok(go.y + go.height <= tb.y + 1 && go.height >= 44, `${width}: 출전 버튼 항상 탭 위, 44px 이상`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_content_${width}.png` });
    // 출전 = 바로 편성 (입장 화면 합침): 가로 넘침 없음, 공략·단축칸·출발 44px 이상, 파티원 4줄이 첫 화면에서 시작
    await page.click('#contentGo'); await page.clock.runFor(100);
    const pty = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect();
      const foot = r(document.querySelector('#s-party .f-foot2')), rows = [...document.querySelectorAll('#s-party .pcard')].map(r);
      const taps = [...document.querySelectorAll('#guideOpen, #s-party .f-item, #reroll, #depart, #s-party .tb-back')].map(e => Math.round(Math.min(r(e).height, r(e).width)));
      return { taps, rows: rows.length, lastTop: Math.round(rows[rows.length - 1].top), foot: Math.round(foot.top), ttl: document.querySelector('#s-party .f-ttl').scrollWidth <= document.querySelector('#s-party .f-ttl').clientWidth };
    });
    ok(await noOverflow('#s-party .f-pty') && await noOverflow('#s-party .f-foot2') && await noOverflow('#s-party .topbar') && pty.ttl, `${width}: 편성 가로 넘침·제목 잘림 없음`);
    ok(pty.taps.every(x => x >= 44), `${width}: 편성 공략·단축칸·다시 뽑기·출발·뒤로 44px 이상 (${pty.taps.join(',')})`);
    ok(pty.rows === 4 && pty.lastTop < pty.foot, `${width}: 5인 편성 = 파티원 4줄이 첫 화면에서 보이기 시작 (마지막 줄 ${pty.lastTop} < 아래 ${pty.foot})`);
    if (width === 320 || width === 390) await page.screenshot({ path: `${shots}/portrait_party_${width}.png` });

    // 최고 레벨의 최대 보조 버튼 3개 + 소비 아이템 4칸 조건을 만든다.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.player.level = 100;
      s.heroes.priest ||= { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0 };
      s.heroes.priest.talents = [null, null, null, null, 0, null, 1, null, null, 0];
      s.items = ['mana', 'life', 'cleanse', 'shield'];
      s.settings.devSkills = true;
      localStorage.setItem('healer.save', JSON.stringify(s));
    });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await toParty(page, { content: 'cathedral1', tab: 'raid20' });
    await page.click('#depart'); await page.clock.runFor(3400);
    const geometry = () => page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      return {
        stage: rect(document.querySelector('#stage')), board: rect(document.querySelector('#boardWrap')), controls: rect(document.querySelector('#controls')),
        buttons: [...document.querySelectorAll('#items button, #aux button, #pauseBtn')].filter(el => el.getClientRects().length).map(rect),
        wheel: rect(document.querySelector('#wheel')),
      };
    });
    const g = await geometry();
    ok(await page.evaluate(() => document.getElementById('battle').dataset.place) === 'cathedral' && await bgLoaded('#boardWrap'), `${width}: 20인 판 뒤 대성당 바닥 그림`);
    ok(g.stage.y >= 70 && g.controls.bottom <= height + 1 && g.board.h >= 120, `${width}: 20인 무대·판·조작 화면 안 (판 ${Math.round(g.board.h)}px)`);
    ok(g.buttons.every(r => r.w >= 44 && r.h >= 44 && r.x >= 0 && r.right <= width + 1 && r.bottom <= height + 1), `${width}: 최대 특성·아이템 버튼 44px 및 화면 경계`);
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
