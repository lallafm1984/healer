// 로비 연출 수명·입력 회귀. 가상 시간/가시성으로 검증하며 실제 기기 FPS를 측정하지 않는다.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { entryGo, pastTitle } from './nav.mjs';

const village = '#s-lobby .lb-village';
const software = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const time = page => page.locator(village).evaluate(el => Number(el.dataset.t));
const geometry = page => page.evaluate(() => [...document.querySelectorAll('#s-lobby .topbar, #s-lobby .lb-main, #s-lobby .lb-plate, #s-lobby .lb-journey, #lobbyStart, #tabs')].map(el => {
  const r = el.getBoundingClientRect();
  return { name: el.id || el.className, x: r.x, y: r.y, w: r.width, h: r.height };
}));

async function start(ctx, url, errors, options = {}) {
  if (options.motion) await ctx.addInitScript(() => { window.__villageMotion = true; });
  if (options.noWebGL) await ctx.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (/webgl|webgpu/i.test(kind)) return null;
      return getContext.call(this, kind, ...args);
    };
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.clock.install();
  // 로드/검사 실제 시간이 가상 4 FPS 장수 측정에 섞이지 않도록 정지한다.
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);
  await page.locator(`${village} .lb-village-base`).evaluate(img => img.decode());
  if (!options.noWebGL) await page.locator(`${village}.live canvas`).waitFor({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.clock.runFor(300);
  return page;
}

async function probe(page) {
  await page.locator(village).evaluate(el => {
    window.__lobbyProbe = { canvas: el.querySelector('canvas'), renders: 0, rafs: new Set(), intervals: new Set() };
    // 초기 로드 이후에 생기는 예약만 관찰한다. 반복 복귀 전후의 같은 안정 구간을 비교한다.
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = callback => {
      const id = request(t => { window.__lobbyProbe.rafs.delete(id); callback(t); });
      window.__lobbyProbe.rafs.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { window.__lobbyProbe.rafs.delete(id); cancel(id); };
    const interval = window.setInterval, clear = window.clearInterval;
    window.setInterval = (callback, delay, ...args) => {
      const id = interval(callback, delay, ...args); window.__lobbyProbe.intervals.add(id); return id;
    };
    window.clearInterval = id => { window.__lobbyProbe.intervals.delete(id); clear(id); };
    new MutationObserver(records => { window.__lobbyProbe.renders += records.length; })
      .observe(el, { attributes: true, attributeFilter: ['data-t'] });
  });
}
const sample = page => page.locator(village).evaluate(el => ({
  time: Number(el.dataset.t), renders: window.__lobbyProbe.renders,
  count: el.querySelectorAll('canvas').length,
  same: el.querySelector('canvas') === window.__lobbyProbe.canvas,
  pendingRafs: window.__lobbyProbe.rafs.size, intervals: window.__lobbyProbe.intervals.size,
}));

export default async function lobbyLiving(url, shots) {
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const errs = [], evidence = { method: 'Playwright virtual clock; document.hidden simulation; not device FPS', checks: [], widths: [], lifecycle: [], fallbacks: {} };
  let fails = 0;
  const ok = (pass, message, details) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${message}`);
    evidence.checks.push({ pass: !!pass, message, ...(details === undefined ? {} : { details }) });
    if (!pass) fails++;
  };
  const context = (width = 390, height = 844) => browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try {
    for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932]]) {
      const ctx = await context(width, height);
      try {
        const page = await start(ctx, url, errs, { motion: true });
        await probe(page);
        const initial = await geometry(page), t0 = await sample(page);
        await page.clock.runFor(3000);
        const at3 = await geometry(page);
        await page.clock.runFor(6000);
        const at9 = await geometry(page), t9 = await sample(page);
        const gpu = await page.locator(village).getAttribute('data-gl');
        ok(JSON.stringify(initial) === JSON.stringify(at3) && JSON.stringify(at3) === JSON.stringify(at9), `${width}: 연출 0·3·9초 동안 메뉴 위치·크기 고정`);
        ok(t9.time > t0.time && t9.same && t9.count === 1, `${width}: 한 캔버스로 연출 시간 진행`);
        if (software.test(gpu || '')) ok(t9.renders - t0.renders >= 30 && t9.renders - t0.renders <= 37, `${width}: 소프트웨어 테스트 경로는 9초 동안 최대 4 FPS`, { gpu, renders: t9.renders - t0.renders });
        const hit = await page.evaluate(() => {
          const cta = document.querySelector('#lobbyStart');
          const c = cta.getBoundingClientRect();
          const at = (button, x, y) => document.elementFromPoint(x, y)?.closest('button') === button;
          // A2 승인으로 패스 바로가기는 제거. DOM 사각형과 실제 출전 하단 hit test를 함께 확인한다.
          return { cta: c.toJSON(), passAbsent: !document.querySelector('#s-lobby .lb-pass, #s-lobby [data-arg="pass"]'),
            ctaBottom: at(cta, c.x + c.width / 2, c.bottom - 2),
            ctaCenter: at(cta, c.x + c.width / 2, c.y + c.height / 2) };
        });
        ok(hit.cta.width >= 44 && hit.cta.height >= 44 && hit.passAbsent && hit.ctaBottom && hit.ctaCenter,
          `${width}: 패스 바로가기 제거, 출전 44px 터치 영역·하단 hit test 정상`, hit);
        await page.screenshot({ path: `${shots}/lobby_living_${width}.png` });
        await page.touchscreen.tap(hit.cta.x + hit.cta.width / 2, hit.cta.bottom - 2); await page.clock.runFor(100);
        // 로비 출전 = 장소가 골라진 모험 선택 (#217) → 「출전」 = 바로 편성 (2026-10-17 Lim 「출전전 휴식 팝업은 제거」)
        const atContent = await page.isVisible('#s-content');
        await page.locator('#contentGo').tap(); await entryGo(page); await page.clock.runFor(100);
        ok(atContent && !(await page.isVisible('.st-modal')) && await page.isVisible('#s-party'), `${width}: 출전 버튼 하단 실제 터치 → 모험 선택 → 출전 → 바로 편성 (입장 확인 팝업 없음)`);
        await page.locator('#s-party .tb-back').tap(); await page.clock.runFor(100);
        await page.locator('#tabs [data-tab="lobby"]').tap(); await page.clock.runFor(100);
        await page.locator('#s-lobby .lb-shop').tap(); await page.clock.runFor(100);
        ok(await page.isVisible('#s-shop') && await page.isVisible('#s-shop .srow'), `${width}: 잡화점 실제 터치 → 상점 상품`);
        await page.locator('#tabs [data-tab="lobby"]').tap(); await page.clock.runFor(300);
        evidence.widths.push({ width, height, initial, at3, at9, t0, t9, gpu, hit });

        if (width === 390) {
          // 이동 반복 뒤 RAF 중복이 생기면 장면 시간이 과속하거나 렌더 수가 증가한다.
          const baseline = await sample(page); await page.clock.runFor(2000); const baselineEnd = await sample(page);
          const baselineRenders = baselineEnd.renders - baseline.renders;
          for (let cycle = 1; cycle <= 3; cycle++) {
            for (const tab of ['char', 'shop', 'party']) {
              if (tab === 'party') { await page.locator('#lobbyStart').tap(); await page.clock.runFor(100); await page.locator('#contentGo').tap(); await entryGo(page); }
              else await page.locator(`#tabs [data-tab="${tab}"]`).tap();
              await page.clock.runFor(100);
              const hidden = await sample(page); await page.clock.runFor(1000); const hiddenEnd = await sample(page);
              ok(hidden.time === hiddenEnd.time && hidden.renders === hiddenEnd.renders, `${cycle}회 ${tab}: 숨은 로비 렌더·시간 정지`);
              if (tab === 'party') { await page.locator('#s-party .tb-back').tap(); await page.clock.runFor(100); }
              await page.locator('#tabs [data-tab="lobby"]').tap(); await page.clock.runFor(300);
              const resumed = await sample(page); await page.clock.runFor(2000); const resumedEnd = await sample(page);
              const renders = resumedEnd.renders - resumed.renders;
              ok(resumedEnd.same && resumedEnd.count === 1 && resumedEnd.time > resumed.time && Math.abs(renders - baselineRenders) <= 1,
                `${cycle}회 ${tab} 복귀: 같은 캔버스 1개·시간 재개·렌더 루프 누적 없음`, { baselineRenders, renders });
              ok(resumedEnd.pendingRafs <= baselineEnd.pendingRafs && resumedEnd.intervals <= baselineEnd.intervals,
                `${cycle}회 ${tab} 복귀: RAF·반복 타이머 예약 누적 없음`, { baselineEnd, resumedEnd });
              evidence.lifecycle.push({ cycle, tab, hidden, hiddenEnd, resumed, resumedEnd });
            }
          }
          await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.runFor(100);
          const reduce0 = await sample(page); await page.clock.runFor(2000); const reduce1 = await sample(page);
          ok(reduce0.time === reduce1.time && reduce0.renders === reduce1.renders, '동작 줄이기 켜기: 시간·렌더 정지');
          await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.clock.runFor(1000);
          ok(await time(page) > reduce1.time, '동작 줄이기 끄기: 시간 재개');
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
          });
          const hidden0 = await sample(page); await page.clock.runFor(2000); const hidden1 = await sample(page);
          ok(hidden0.time === hidden1.time && hidden0.renders === hidden1.renders, 'document.hidden 시뮬레이션: 비활성 문서 시간·렌더 정지');
          await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
          await page.clock.runFor(1000);
          ok(await time(page) > hidden1.time, 'document.hidden 시뮬레이션 해제: 시간 재개');
          evidence.lifecycle.push({ reducedMotion: { reduce0, reduce1 }, documentHiddenSimulation: { hidden0, hidden1 } });
        }
      } catch (e) { errs.push(`${width}: ${e.stack || e.message}`); }
      finally { await ctx.close(); }
    }

    // GPU 환경에서도 기본 정적 계약을 검증하도록 renderer 이름만 software로 분류한다.
    const staticCtx = await context();
    try {
      await staticCtx.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const getParameter = proto.getParameter;
          proto.getParameter = function (name) { return name === 37446 ? 'software E2E classification fixture' : getParameter.call(this, name); };
        }
      });
      const page = await start(staticCtx, url, errs);
      await probe(page);
      const before = await sample(page); await page.clock.runFor(3000); const after = await sample(page);
      ok(before.time === after.time && after.renders === before.renders && after.count === 1,
        'software renderer 분류 시 기본값: 정적 한 장, 애니메이션 렌더 없음');
      await page.locator('#tabs [data-tab="char"]').tap(); await page.clock.runFor(100);
      ok(await page.isVisible('#s-char'), 'software 정적 fallback에서 메뉴 터치 가능');
      evidence.fallbacks.softwareClassificationFixture = { before, after };
    } catch (e) { errs.push(`software fallback: ${e.stack || e.message}`); }
    finally { await staticCtx.close(); }

    const failCtx = await context(), expectedDiagnostics = [];
    evidence.fallbacks.noWebGL = { diagnostics: expectedDiagnostics };
    try {
      const page = await start(failCtx, url, expectedDiagnostics, { noWebGL: true });
      await page.clock.runFor(1000);
      const fallback = await page.locator(village).evaluate(el => {
        const img = el.querySelector('.lb-village-base');
        return { live: el.classList.contains('live'), canvas: el.querySelectorAll('canvas').length,
          image: !!img && img.complete && img.naturalWidth === 853 && getComputedStyle(img).opacity !== '0' };
      });
      ok(!fallback.live && fallback.canvas === 0 && fallback.image, 'WebGL 초기화 실패 시 853px 바탕 이미지 표시', fallback);
      await page.screenshot({ path: `${shots}/lobby_living_no_webgl.png` });
      await page.locator('#s-lobby .lb-shop').tap(); await page.clock.runFor(100);
      ok(await page.isVisible('#s-shop') && await page.isVisible('#s-shop .srow'), 'WebGL 실패 fallback에서도 잡화점 실제 터치 가능');
      // 지원하지 않는 렌더러도 조용히 고정 바탕으로 전환해야 한다. 예외를 키워드로 숨기지 않는다.
      errs.push(...expectedDiagnostics.map(s => `WebGL failure fixture: ${s}`));
      evidence.fallbacks.noWebGL.fallback = fallback;
    } catch (e) { errs.push(`WebGL fallback: ${e.stack || e.message}`); }
    finally { await failCtx.close(); }
  } finally {
    await browser.close();
    writeFileSync(`${shots}/lobby-living-report.json`, JSON.stringify({ ...evidence, fails, errs }, null, 2) + '\n');
  }
  return { fails, errs };
}
