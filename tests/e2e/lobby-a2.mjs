// A2 목재·리넨 로비: 실제 DOM 입력/상태/반응형 회귀. 시안과의 픽셀 동일성을 주장하는 테스트는 아니다.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pastTitle } from './nav.mjs';

const lobby = '#s-lobby';
const village = `${lobby} .lb-village`;
const tick = page => page.clock.runFor(100);
const readSave = page => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
const goLobby = async page => { await page.locator('#tabs [data-tab="lobby"]').tap(); await tick(page); };

async function settle(page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.locator(`${village} .lb-village-base`).evaluate(img => img.decode());
  await tick(page);
}

async function patch(page, fn) {
  await page.evaluate(fn);
  await page.reload(); await page.clock.runFor(300); await pastTitle(page); await settle(page);
}

const layout = page => page.evaluate(() => {
  const rect = el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const buttons = [...document.querySelectorAll('#s-lobby button, #tabs button')].filter(visible).map(el => {
    const r = rect(el), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const at = (x, y) => document.elementFromPoint(x, y)?.closest('button') === el;
    return { name: el.id || el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' '), rect: r,
      center: at(cx, cy), edges: [at(cx, r.y + 2), at(cx, r.bottom - 2), at(r.x + 2, cy), at(r.right - 2, cy)] };
  });
  const overlaps = [];
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
    const a = buttons[i].rect, b = buttons[j].rect;
    if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1)
      overlaps.push([buttons[i].name, buttons[j].name]);
  }
  const text = [...document.querySelectorAll('#s-lobby .lb-caption > b, #s-lobby .lb-caption > small, #s-lobby .lb-pt > b, #s-lobby .lb-pt > span > span, #s-lobby .trk-t, #s-lobby .trk-sub, #s-lobby .obj > span, #lobbyStart .lb-cta-copy > b, #lobbyStart .lb-cta-copy > small')]
    .filter(visible).map(el => {
      const r = rect(el), box = rect(el.closest('.lb-main, .lb-plate, .lb-trk, .lb-cta'));
      const range = document.createRange(); range.selectNodeContents(el);
      const ink = [...range.getClientRects()].map(r => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom }));
      const progress = el.parentElement.classList.contains('obj') && el.nextElementSibling ? rect(el.nextElementSibling) : null;
      const overlapsProgress = progress && ink.some(t => Math.min(t.right, progress.right) > Math.max(t.x, progress.x)
        && Math.min(t.bottom, progress.bottom) > Math.max(t.y, progress.y));
      return { text: el.textContent.trim(), width: el.clientWidth, scrollWidth: el.scrollWidth,
        rect: r, container: box, ink, progress,
        // visible 글꼴의 끝 글자 overhang은 scrollWidth를 키울 수 있다. 실제 clip과 옆 진행 숫자 침범을 구별한다.
        clipped: getComputedStyle(el).overflowX !== 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1,
        overlapsProgress: !!overlapsProgress,
        outside: r.x < box.x - 1 || r.y < box.y - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1 };
    });
  return { viewport: { width: innerWidth, height: innerHeight }, buttons, overlaps, text,
    cta: rect(document.querySelector('#lobbyStart')), goal: rect(document.querySelector('#s-lobby .lb-trk')),
    tabs: rect(document.querySelector('#tabs')), header: rect(document.querySelector('#s-lobby .topbar')),
    world: rect(document.querySelector('#s-lobby .lb-world')),
    bodyWidth: document.documentElement.scrollWidth,
    passAbsent: !document.querySelector('#s-lobby .lb-pass, #s-lobby [data-arg="pass"]') && !/패스/.test(document.querySelector('#s-lobby').textContent),
    nav: [...document.querySelectorAll('#tabs [data-tab]')].map(el => el.dataset.tab),
  };
});

export default async function lobbyA2(url, shots) {
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const errs = [], report = { method: 'Playwright DOM geometry and actual touch; CSS env safe-area through Chromium CDP; no pixel-identity claim', checks: [], widths: [], states: [] };
  let fails = 0;
  const ok = (pass, message, details) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${message}`);
    report.checks.push({ pass: !!pass, message, ...(details === undefined ? {} : { details }) });
    if (!pass) fails++;
  };
  const checkLayout = (g, name, safeBottom = 0, safeTop = 0) => {
    ok(g.passAbsent, `${name}: 패스 버튼·아이콘 컨테이너·문구 없음`);
    ok(Math.abs(g.cta.bottom - g.goal.bottom) <= 1, `${name}: 출전·다음 목표 바깥 하단 정렬 1px 이내`, { cta: g.cta.bottom, goal: g.goal.bottom });
    const small = g.buttons.filter(b => b.rect.width < 43.99 || b.rect.height < 43.99);
    ok(!small.length, `${name}: 표시 버튼 모두 최소 44×44 CSS px`, small);
    const hidden = g.buttons.filter(b => !b.center || !b.edges.every(Boolean));
    ok(!hidden.length && !g.overlaps.length, `${name}: 버튼 중심·네 변 실제 hit test와 버튼 간 겹침 없음`, { hidden, overlaps: g.overlaps });
    const outside = g.buttons.filter(b => b.rect.x < -1 || b.rect.right > g.viewport.width + 1 || b.rect.y < safeTop - 1 || b.rect.bottom > g.viewport.height - safeBottom + 1);
    ok(!outside.length && g.bodyWidth <= g.viewport.width + 1 && g.cta.bottom <= g.tabs.y + 1 && g.goal.bottom <= g.tabs.y + 1,
      `${name}: 화면·안전영역 안, 목표·출전은 하단 메뉴 위`, outside);
    ok(Math.abs(g.tabs.bottom - (g.viewport.height - safeBottom)) <= 1, `${name}: 하단 메뉴 safe-area ${safeBottom}px 확보`, g.tabs);
    ok(Math.abs(g.header.y - 70) <= 1 && Math.abs(g.header.height - 80) <= 1 && Math.abs(g.world.y - 150) <= 1
      && Math.abs(g.world.width - g.viewport.width) <= 1 && Math.abs(g.world.height - (g.viewport.height - 218 - safeBottom)) <= 1,
      `${name}: 기존 배너 70·정보창 80·탭 68px와 동적 배경 표시 영역 보존`, { header: g.header, world: g.world });
    ok(JSON.stringify(g.nav) === JSON.stringify(['lobby', 'battle', 'char', 'shop']), `${name}: 기존 하단 메뉴 4개 유지`, g.nav);
    const clipped = g.text.filter(t => t.clipped);
    ok(!clipped.length && !g.text.some(t => t.overlapsProgress), `${name}: 메뉴·목표·출전 한글 잘림과 진행 숫자 침범 없음`, g.text.filter(t => t.clipped || t.overlapsProgress));
    ok(g.text.every(t => !t.outside), `${name}: 실시간 한글 줄은 각 버튼/목표표 안에 배치`, g.text.filter(t => t.outside));
  };
  try {
    for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      try {
        const page = await ctx.newPage();
        page.setDefaultTimeout(15000);
        page.on('pageerror', e => errs.push(`${width}: pageerror: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error') errs.push(`${width}: console: ${m.text()}`); });
        await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
        await page.goto(url); await page.clock.runFor(300); await pastTitle(page); await settle(page);
        const initial = await layout(page);
        checkLayout(initial, `${width}×${height}`);
        ok(/녹슨 고원/.test(await page.textContent(`${lobby} .lb-trk`)) && /0\/1/.test(await page.textContent(`${lobby} .lb-trk`))
          && /1\/2/.test(await page.textContent(`${lobby} .lb-trk`)), `${width}: 다음 목표 실제 장소·클리어·레벨 진행 텍스트 유지`);
        await page.screenshot({ path: `${shots}/lobby_a2_${width}.png` });

        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, topMax: 47, bottom: 34, bottomMax: 34, left: 0, right: 0 } });
        await tick(page);
        const safe = await layout(page);
        checkLayout(safe, `${width} safe-area 47/34`, 34, 47);
        await page.screenshot({ path: `${shots}/lobby_a2_safe_${width}.png` });
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } });
        await cdp.detach(); await tick(page);

        const c = (await layout(page)).cta;
        await page.touchscreen.tap(c.x + c.width / 2, c.bottom - 2); await tick(page);
        ok(await page.isVisible('#s-party') && /녹슨 고원/.test(await page.textContent('#s-party .topbar')), `${width}: 출전 하단 터치 → 실제 목적지 편성`);
        await page.locator('#s-party .tb-back').tap(); await tick(page); await goLobby(page);
        await page.locator(`${lobby} .lb-trk`).tap(); await tick(page);
        ok(await page.isVisible('#s-party') && /녹슨 고원/.test(await page.textContent('#s-party .topbar')), `${width}: 다음 목표 터치 → 목표 편성`);
        await page.locator('#s-party .tb-back').tap(); await tick(page); await goLobby(page);

        await page.locator(`${lobby} .lb-raid`).tap(); await tick(page);
        ok(await page.isVisible('#s-content') && await page.getAttribute('#s-content [data-ctab="raid10"]', 'aria-selected') === 'true', `${width}: 첨탑 → 10인 레이드 기능 유지`);
        await goLobby(page); await page.locator(`${lobby} .lb-shop`).tap(); await tick(page);
        ok(await page.isVisible('#s-shop') && await page.locator('#s-shop .srow').count() >= 7, `${width}: 잡화점 → 골드 상점`);
        await goLobby(page); await page.locator(`${lobby} .lb-missions .lb-main`).tap(); await tick(page);
        ok(await page.isVisible('#s-missions'), `${width}: 임무 → 임무 화면`);
        await page.locator('#s-missions .tb-back').tap(); await tick(page);
        ok(await page.isVisible(lobby), `${width}: 임무 닫기 → 로비`);
        await page.locator(`${lobby} .lb-chest .lb-main`).tap(); await tick(page);
        ok(await page.isVisible('#s-missions'), `${width}: 닫힌 일일 상자 → 임무 진행 화면`);
        await page.locator('#s-missions .tb-back').tap(); await tick(page);
        await page.locator(`${lobby} .lb-chal .lb-main`).tap(); await tick(page);
        ok(await page.isVisible('#s-content') && await page.getAttribute('#s-content [data-ctab="dungeon"]', 'aria-selected') === 'true', `${width}: 주간 도전 → 던전 선택 화면`);
        await goLobby(page); await page.locator(`${lobby} .tb-set`).tap(); await tick(page);
        ok(await page.isVisible('#s-settings'), `${width}: 설정 열기`);
        await page.locator('#s-settings .tb-back').tap(); await tick(page);
        ok(await page.isVisible(lobby), `${width}: 설정 닫기 → 로비`);
        for (const [tab, screen] of [['battle', '#s-content'], ['char', '#s-char'], ['shop', '#s-shop']]) {
          await page.locator(`#tabs [data-tab="${tab}"]`).tap(); await tick(page);
          ok(await page.isVisible(screen), `${width}: 하단 ${tab} 메뉴 실행`);
          await goLobby(page);
        }
        report.widths.push({ width, height, initial, safe });

        if (width === 390) {
          // 다음 목표와 지난 판 출전은 독립된 목적지다. 화면에 박힌 정적 글/링크로 바꾸면 실패해야 한다.
          await patch(page, () => {
            const s = JSON.parse(localStorage.getItem('healer.save'));
            s.player.level = 8; s.settings.devUnlock = false;
            // 난이도 사슬 (61): 쉬움을 깨기 전엔 보통이 잠겨 있으니 지난 판도 열린 쉬움으로
            s.last = { content: 'cemetery', diff: '쉬움', win: false, grade: null };
            localStorage.setItem('healer.save', JSON.stringify(s));
          });
          ok(/녹슨 요새/.test(await page.getAttribute('#lobbyStart', 'aria-label')) && await page.isVisible(`${lobby} .lb-coach`),
            'Lv 8 첫 던전 안내: 출전은 녹슨 요새 우선, 안내 문구 유지');
          checkLayout(await layout(page), '390 첫 던전 안내');
          await page.screenshot({ path: `${shots}/lobby_a2_first_dungeon.png` });
          await patch(page, () => {
            const s = JSON.parse(localStorage.getItem('healer.save'));
            s.player.level = 12; localStorage.setItem('healer.save', JSON.stringify(s));
          });
          ok(/녹슨 고원/.test(await page.textContent(`${lobby} .lb-trk`)) && /잿빛 공동묘지/.test(await page.getAttribute('#lobbyStart', 'aria-label')),
            '지난 판 있음: 다음 목표와 출전 목적지를 각각 계산');
          checkLayout(await layout(page), '390 지난 판 있음');
          await page.screenshot({ path: `${shots}/lobby_a2_last_run.png` });
          // 「다시」 소켓은 뺐다 (Lim 2026-10-12): 지난 판이 있어도 없고, 지난 판은 「출전」이 이어 간다
          ok(await page.locator('#lbAgain, #s-lobby .lb-again').count() === 0, '지난 판 있어도 「다시」 소켓 없음 (출전이 지난 판으로)');
          for (const [level, title, target] of [[40, '심연의 탑', '45'], [60, '가라앉은 대성당', '70']]) {
            await patch(page, () => {
              const s = JSON.parse(localStorage.getItem('healer.save'));
              s.last = null; localStorage.setItem('healer.save', JSON.stringify(s));
            });
            await page.evaluate(lv => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = lv; localStorage.setItem('healer.save', JSON.stringify(s)); }, level);
            await page.reload(); await page.clock.runFor(300); await pastTitle(page); await settle(page);
            const gate = await page.textContent(`${lobby} .lb-trk.gate`);
            ok(gate.includes(title) && gate.includes(`레벨 ${target}`) && /0 \/ 6 부위/.test(gate), `Lv ${level}: 레이드 목표 실시간 조건 목록 유지`, gate);
            const g = await layout(page); checkLayout(g, `390 Lv ${level} 목표`);
            await page.screenshot({ path: `${shots}/lobby_a2_gate_${level}.png` });
            await page.locator(`${lobby} .lb-trk.gate`).tap(); await tick(page);
            ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char nav [data-csub="gear"]', 'aria-selected') === 'true', `Lv ${level}: 미완료 장비 목표 → 캐릭터 장비`);
            await goLobby(page); report.states.push({ level, gate, geometry: g });
          }
          await patch(page, () => {
            const s = JSON.parse(localStorage.getItem('healer.save'));
            s.daily.missions.forEach(m => { m.n = 999; m.got = false; });
            s.daily.chest = false; s.chalChest = 1;
            localStorage.setItem('healer.save', JSON.stringify(s));
          });
          ok(await page.isVisible('#lbClaim') && await page.isVisible('#lbChal'), '받을 임무·주간 도전 상자 상태를 실제 저장에서 표시');
          const rewardLayout = await layout(page);
          checkLayout(rewardLayout, '390 받을 보상 있음');
          const before = await readSave(page);
          await page.locator('#lbClaim').tap(); await tick(page);
          const after = await readSave(page);
          ok(after.daily.missions.every(m => m.got) && after.player.gold > before.player.gold && /일일 5\/5/.test(await page.textContent(`${lobby} .lb-missions`)), '임무 일괄 수령 후 골드·진행 즉시 갱신');
          await page.locator('#lbChest').tap(); await tick(page);
          ok((await readSave(page)).daily.chest && /내일 다시/.test(await page.textContent(`${lobby} .lb-chest`)), '일일 상자 열기 후 상태 즉시 갱신');
          await page.locator('#lbChal').tap(); await tick(page);
          ok((await readSave(page)).chalChest === 0 && await page.locator('#lbChal').count() === 0, '주간 도전 상자 수령 후 기본 바로가기 복구');
        }
        if (width === 320 || width === 390) {
          await patch(page, () => {
            const s = JSON.parse(localStorage.getItem('healer.save'));
            s.player.gold = 1234567; s.stamina = { n: 140, at: Date.now(), day: '', ads: 0 }; s.bought = ['noads'];
            localStorage.setItem('healer.save', JSON.stringify(s));
          });
          const wallet = await page.evaluate(() => {
            const h = document.querySelector('#s-lobby .topbar').getBoundingClientRect();
            return [['.tb-gold', 1234567], ['.tb-st', 140]].map(([selector, amount]) => {
              const el = document.querySelector(`#s-lobby ${selector}`), label = el.querySelector('b'), r = el.getBoundingClientRect();
              const full = amount.toLocaleString('ko-KR');
              const exposed = [el.getAttribute('aria-label'), el.title, label.getAttribute('aria-label'), label.title].filter(Boolean);
              return { selector, amount, displayed: label.textContent, full, exposed, client: label.clientWidth, scroll: label.scrollWidth,
                fullValueAvailable: exposed.some(t => t.includes(full)),
                inside: r.left >= h.left - 1 && r.right <= h.right + 1 && r.top >= h.top - 1 && r.bottom <= h.bottom + 1 };
            });
          });
          ok(wallet.every(v => v.fullValueAvailable && /\d/.test(v.displayed)), `${width}: 큰 골드·스테미너 (140/150) 실제 값과 축약 시 전체 수치 접근성 보존`, wallet);
          const g = await layout(page), headerButtons = g.buttons.filter(b => b.rect.y < g.header.bottom);
          ok(wallet.every(v => v.inside) && headerButtons.every(b => b.rect.width >= 43.99 && b.rect.height >= 43.99 && b.center && b.edges.every(Boolean))
            && !g.overlaps.length, `${width}: 큰 재화에서도 헤더 안 배치·캐릭터/설정 44px 실제 hit 유지`, { wallet, headerButtons });
          await page.screenshot({ path: `${shots}/lobby_a2_large_wallet_${width}.png` });
          report.states.push({ width, wallet });
        }
      } catch (e) { errs.push(`${width}: ${e.stack || e.message}`); }
      finally { await ctx.close(); }
    }
  } finally {
    await browser.close();
    writeFileSync(`${shots}/lobby-a2-report.json`, JSON.stringify({ ...report, fails, errs }, null, 2) + '\n');
  }
  return { fails, errs };
}
