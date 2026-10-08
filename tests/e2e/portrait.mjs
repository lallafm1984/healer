// 세로 UI 회귀: 그림 로드 (캐릭터 그림 없음, 장소·메뉴 그림은 28), 고정 출발 버튼, 좁은 메뉴, 20인/특성/전멸 배치.
import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';

export default async function portrait(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  let lobbyAnchorBaseline;
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
    const sceneImages = '#s-lobby img.lb-layer';
    const cloudImages = '#s-lobby .lb-cloud-track img';
    const layerCanvas = await loaded(sceneImages) && await page.locator(sceneImages).evaluateAll(imgs =>
      imgs.length === 2 && imgs.every(i => i.naturalWidth === 1024 && i.naturalHeight === 1536)
      && ['landscape', 'foreground'].every(layer => imgs.some(i => i.classList.contains(`lb-layer-${layer}`) && i.src.includes(`scene-lobby-${layer}-v2`))));
    const cloudCanvas = await loaded(cloudImages) && await page.locator(cloudImages).evaluateAll(imgs =>
      imgs.length === 2 && imgs[0].currentSrc === imgs[1].currentSrc
      && imgs.every(i => i.naturalWidth === 2160 && i.naturalHeight === 720));
    ok(layerCanvas && cloudCanvas && await page.locator('#s-lobby div.lb-layer-sky .lb-cloud-track').count() === 1,
      `${width}: 원경·전경 1024×1536 및 하늘 wrapper 안 구름 strip 2160×720 두 장 decode`);
    const lobbyProps = '#s-lobby .lb-art .lb-prop-v3';
    const propsLoaded = await loaded(lobbyProps) && await page.locator(lobbyProps).evaluateAll(imgs =>
      imgs.length === 3 && ['board', 'hourglass', 'chest'].every(name => imgs.some(i => i.src.includes(`obj-${name}-v3`))));
    ok(propsLoaded, `${width}: 새 게시판·모래시계·상자 v3 3장 decode`);

    // 화면 대신 실제 전경 그림 좌표로 발밑 위치를 측정한다. 이미지 alpha 여백은 포함한 .lb-art bottom center가 계약이다.
    const lobbyGeometry = () => page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      const background = document.querySelector('#s-lobby .lb-layer-foreground');
      const canvas = document.querySelector('#s-lobby .lb-canvas');
      const world = document.querySelector('#s-lobby .lb-world');
      const cta = document.querySelector('#lobbyStart');
      if (!background || !canvas || !world || !cta) return null;
      const bg = rect(background);
      const props = ['board', 'chal', 'chest'].map(name => {
        const el = document.querySelector(`#s-lobby .lb-${name} .lb-art`);
        if (!el) return null;
        const r = rect(el);
        return { name, rect: r, x: (r.x + r.w / 2 - bg.x) / bg.w, y: (r.bottom - bg.y) / bg.h };
      });
      return { background: bg, canvas: rect(canvas), world: rect(world), cta: rect(cta), props,
        dock: [...document.querySelectorAll('#s-lobby #lobbyStart, #s-lobby .lb-pass, #s-lobby .lb-again')].map(rect),
        labels: [...document.querySelectorAll('#s-lobby .lb-stage .g-plate')].map(el => ({ name: el.textContent.trim(), rect: rect(el) })),
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
    const anchorDrift = (baseline, g) => {
      if (!baseline || baseline.some(p => !p) || !g || g.props.some(p => !p)) return Infinity;
      return Math.max(...g.props.map(p => {
        const old = baseline.find(b => b.name === p.name);
        return old ? Math.max(Math.abs(p.x - old.x), Math.abs(p.y - old.y)) : Infinity;
      }));
    };
    const checkLobbyBounds = (g, label) => {
      const inside = r => r.w > 0 && r.h > 0 && r.x >= Math.max(0, g.world.x) - 1 && r.y >= Math.max(0, g.world.y) - 1
        && r.right <= Math.min(g.viewport.w, g.world.right) + 1 && r.bottom <= Math.min(g.viewport.h, g.world.bottom) + 1;
      const separate = r => g.dock.every(d => r.right <= d.x + 1 || r.x >= d.right - 1 || r.bottom <= d.y + 1 || r.y >= d.bottom - 1);
      const boxes = g && g.props.every(Boolean) ? [...g.props, ...g.labels] : [];
      const outside = boxes.filter(b => !inside(b.rect)), overlaps = boxes.filter(b => !separate(b.rect));
      ok(boxes.length === 9 && !outside.length, `${label}: 소품 3개·이름표 6개 모두 잘림 없이 광장 안`);
      ok(boxes.length === 9 && !overlaps.length, `${label}: 소품·이름표와 출전·패스·다시 버튼 겹침 없음`);
      if (outside.length || overlaps.length) console.log(JSON.stringify({ label, outside, overlaps, world: g.world, cta: g.cta }));
    };
    const initialLobby = await settleLobby();
    ok(initialLobby.stable, `${width}: 로비 이미지·글꼴 로드 후 배치 안정`);
    const initialGeometry = initialLobby.geometry;
    if (!lobbyAnchorBaseline && initialGeometry?.props.every(Boolean)) lobbyAnchorBaseline = initialGeometry.props;
    const sizeDrift = anchorDrift(lobbyAnchorBaseline, initialGeometry);
    ok(sizeDrift <= 0.001, `${width}×${height}: 배경 대비 소품 바닥 고정 (최대 차이 ${sizeDrift.toFixed(5)})`);
    checkLobbyBounds(initialGeometry, `${width}×${height}`);
    const button = await page.locator('#lobbyStart').boundingBox(), tabs = await page.locator('#tabs').boundingBox();
    ok(button.y + button.height <= tabs.y + 1 && button.height >= 44, `${width}: 바로 출전 버튼 항상 탭 위, 44px 이상`);
    ok(await noOverflow('#s-lobby .ns-body'), `${width}: 로비 가로 넘침 없음`);
    await page.screenshot({ path: `${shots}/portrait_lobby_${width}.png` });

    // page.clock과 실제 CSS 타임라인의 경과 차이를 피하고, 적용된 동작 상태를 직접 확인한다.
    const lobbyMotion = () => page.locator('#s-lobby .lb-cloud-track, #s-lobby .lb-layer-landscape, #s-lobby .lb-star').evaluateAll(imgs => imgs.map(i => {
      const style = getComputedStyle(i);
      return { type: i.classList.contains('lb-cloud-track') ? 'cloud' : i.classList.contains('lb-star') ? 'star' : 'landscape',
        name: style.animationName, state: style.animationPlayState, opacity: Number(style.opacity),
        duration: style.animationDuration, timing: style.animationTimingFunction, direction: style.animationDirection, iterations: style.animationIterationCount };
    }));
    const allMotionTypes = motions => ['cloud', 'landscape', 'star'].every(type => motions.some(a => a.type === type));
    if (width === 390) {
      // 높이는 고정하고 폭만 바꿔, viewport에 놓인 소품이 배경 위를 미끄러지는 회귀를 잡는다.
      for (const resizedWidth of [320, 360, 390, 430, 390]) {
        await page.setViewportSize({ width: resizedWidth, height: 844 });
        const settled = await settleLobby();
        const drift = anchorDrift(initialGeometry?.props, settled.geometry);
        ok(settled.stable && drift <= 0.001, `${resizedWidth}×844 resize: 소품의 배경 좌표 유지 (최대 차이 ${drift.toFixed(5)})`);
        checkLobbyBounds(settled.geometry, `${resizedWidth}×844 resize`);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reduced = await lobbyMotion();
      ok(allMotionTypes(reduced) && reduced.every(a => a.name === 'none') && reduced.filter(a => a.type === 'star').every(a => a.opacity > 0),
        '390: 동작 줄이기에서 구름·원경·별 애니메이션 없음, 별은 정적으로 표시');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const running = await lobbyMotion();
      ok(allMotionTypes(running) && running.every(a => a.name !== 'none' && a.state === 'running'), '390: 일반 설정에서 구름·원경·별 애니메이션 실행');
      const starField = await page.locator('#s-lobby .lb-layer-sky').evaluate(sky => {
        const field = sky.querySelector(':scope > .lb-stars'), clouds = sky.querySelector(':scope > .lb-cloud-track');
        const stars = [...sky.querySelectorAll('.lb-stars > .lb-star')];
        if (!field || !clouds || stars.length < 2) return null;
        const z = el => Number(getComputedStyle(el).zIndex) || 0;
        const behind = z(field) < z(clouds) || (z(field) === z(clouds) && Boolean(field.compareDocumentPosition(clouds) & Node.DOCUMENT_POSITION_FOLLOWING));
        const decorative = Boolean(field.closest('[aria-hidden="true"]'))
          && [field, ...stars].every(el => el.tabIndex < 0 && getComputedStyle(el).pointerEvents === 'none');
        const effects = stars.map(star => {
          const animation = star.getAnimations()[0];
          if (!animation?.effect) return null;
          const timing = animation.effect.getTiming(), duration = Number(timing.duration);
          if (!duration) return null;
          const previous = animation.currentTime, phase = animation.effect.getComputedTiming().progress;
          const origin = star.getBoundingClientRect();
          try {
            const samples = [0, 0.25, 0.5, 0.75].map(fraction => {
              animation.currentTime = timing.delay + duration * (1 + fraction);
              const r = star.getBoundingClientRect();
              return { opacity: Number(getComputedStyle(star).opacity), drift: Math.max(Math.abs(r.x - origin.x), Math.abs(r.y - origin.y), Math.abs(r.width - origin.width), Math.abs(r.height - origin.height)) };
            });
            return { phase, range: Math.max(...samples.map(s => s.opacity)) - Math.min(...samples.map(s => s.opacity)), stationary: samples.every(s => s.drift < 0.1) };
          } finally { animation.currentTime = previous; }
        });
        return { behind, decorative, effects };
      });
      ok(starField?.behind && starField.decorative, '390: 별은 하늘 안에서 구름 뒤의 비상호작용 장식');
      ok(starField?.effects.every(e => e && e.range > 0.1 && e.stationary), '390: 별은 실제 주기 중 밝기가 변하고 위치·크기는 고정');
      ok(starField && new Set(starField.effects.filter(e => e?.phase != null).map(e => Math.round(e.phase * 10))).size >= 3,
        '390: 별이 서로 다른 위상으로 깜박이며 동시에 점멸하지 않음');
      const cloud = running.find(a => a.type === 'cloud');
      ok(cloud?.duration === '225s' && cloud.timing === 'linear' && cloud.direction === 'normal' && cloud.iterations === 'infinite',
        '390: 구름 track은 225초 linear 한 방향 무한 이동');
      // CSS 타임라인을 기다리지 않고 진행률만 샘플링한다. normal 방향이라도 중간에 왕복하는 keyframe은 실패해야 한다.
      const cloudPath = await page.locator('#s-lobby .lb-cloud-track').evaluateAll(tracks => {
        if (tracks.length !== 1) return null;
        const track = tracks[0], name = getComputedStyle(track).animationName;
        const animation = track.getAnimations().find(a => a.animationName === name);
        if (!animation?.effect) return null;
        const previous = animation.currentTime, duration = Number(animation.effect.getTiming().duration);
        const width = track.getBoundingClientRect().width;
        if (!duration || !width) return null;
        try {
          return [0, 0.25, 0.5, 0.75, 0.999].map(fraction => {
            animation.currentTime = duration * fraction;
            const style = getComputedStyle(track);
            return style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m41 / width;
          });
        } finally { animation.currentTime = previous; }
      });
      ok(cloudPath?.every((x, i) => Math.abs(x + [0, 0.125, 0.25, 0.375, 0.4995][i]) <= 0.001),
        '390: 구름 track 0→-50% 진행, 도중 역방향 복귀 없음');
    }
    await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(80);
    if (width === 390) {
      const paused = await lobbyMotion();
      ok(await page.locator('#s-lobby').evaluate(el => el.hidden) && allMotionTypes(paused) && paused.every(a => a.state === 'paused'),
        '390: 캐릭터 탭 이동 후 숨겨진 로비 구름·원경·별 애니메이션 일시정지');
      // 임무를 받을 때 발생하는 로비 재렌더가 구름을 시작점으로 되돌리지 않아야 한다.
      await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('healer.save'));
        save.daily.missions[0].n = 999;
        save.daily.missions[0].got = false;
        localStorage.setItem('healer.save', JSON.stringify(save));
      });
      await page.reload(); await page.clock.runFor(300); await pastTitle(page);
      const cloudTime = await page.locator('#s-lobby .lb-cloud-track').evaluate(el => {
        const animation = el.getAnimations()[0];
        animation.currentTime = 45000;
        return animation.currentTime;
      });
      await page.click('#lbClaim'); await page.clock.runFor(80);
      const restoredTime = await page.locator('#s-lobby .lb-cloud-track').evaluate(el => el.getAnimations()[0]?.currentTime);
      ok(typeof restoredTime === 'number' && Math.abs(restoredTime - cloudTime) < 1500, '390: 임무 보상 수령 후 구름 진행 시간 유지, 처음 위치로 점프 없음');
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
    const go = await page.locator('#contentGo').boundingBox(), tb = await page.locator('#tabs').boundingBox();
    ok(go.y + go.height <= tb.y + 1 && go.height >= 44, `${width}: 출전 버튼 항상 탭 위, 44px 이상`);
    if (width === 390) await page.screenshot({ path: `${shots}/portrait_content_${width}.png` });

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
    await toParty(page, { content: 'cathedral1', tab: 'raid' });
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
    // 31 스킬 그림(img.sic)이 들어가도 그림·이름·마나 % 가 둥근 칸(테두리 안) 밖으로 잘리지 않음. 글자는 위아래 1/4 지점의 원 폭으로 잼
    const wheelFit = await page.evaluate(() => [...document.querySelectorAll('#wheel .slot[data-slot]')].map(s => {
      const r = s.getBoundingClientRect(), R = r.width / 2 - 3, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const bad = [...s.querySelectorAll('.sic, .nm, .ct')].filter(e => e.getClientRects().length && e.textContent !== '' || e.tagName === 'IMG').filter(e => {
        const rg = document.createRange(); rg.selectNodeContents(e);
        const b = e.tagName === 'IMG' ? e.getBoundingClientRect() : rg.getBoundingClientRect();
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
    await page.screenshot({ path: `${shots}/portrait_tankdown_${width}.png` });
    await ctx.close();
  }
  await browser.close();
  return { fails, errs };
}
