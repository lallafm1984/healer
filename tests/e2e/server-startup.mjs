// 실제 main.ts · Capacitor SDK · HTTP 경로. Android 브리지와 모든 외부 HTTP만 모형이며 실기기 QA가 아니다.
import { chromium } from 'playwright';

const uid = '20000000-0000-4000-8000-000000000001';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'startup@example.invalid',
  app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: {}, is_anonymous: false, created_at: '2026-10-31T00:00:00Z' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const normal = () => ({ now: Date.now(), config: { min_version: 0, latest_version: 0, store_url: 'https://store.example.invalid/healer',
  update_message: null, maintenance: false, maintenance_message: null, flags: {} }, notices: [] });
const notice = (id, popup = true) => ({ id, title: '공지사항', body: '새로운 모험이 준비되었습니다.\n확인 후 게임을 시작할 수 있습니다.', popup, starts_at: Date.now() });
const forced = () => { const b = normal(); b.config.min_version = 652; b.config.latest_version = 652; b.config.maintenance = true; b.notices = [notice(901)]; return b; };

async function bridge(ctx) {
  await ctx.addInitScript(() => {
    window.__serverTest = localStorage.getItem('startup-server-fixture') === '1';
    window.__nativeCalls = []; window.__nativeListeners = {};
    window.CapacitorCustomPlatform = { name: 'android' };
    const origin = Number(localStorage.getItem('fixture-boot-origin')) || Date.now() - 60_000;
    localStorage.setItem('fixture-boot-origin', String(origin));
    const methods = (names, callback = []) => names.map(name => ({ name, rtype: callback.includes(name) ? 'callback' : 'promise' }));
    window.Capacitor = {
      PluginHeaders: [
        { name: 'App', methods: methods(['getInfo', 'exitApp', 'addListener', 'removeListener'], ['addListener']) },
        { name: 'ElapsedClock', methods: methods(['now']) }, { name: 'DeviceKey', methods: methods(['key']) },
        { name: 'SystemBars', methods: methods(['hide']) },
      ],
      nativePromise: async (plugin, method, options) => {
        window.__nativeCalls.push({ plugin, method, options });
        if (plugin === 'App' && method === 'getInfo') return { build: '651', version: '0.1.651', id: 'com.solohealer.game', name: 'Healer' };
        if (plugin === 'ElapsedClock') return { elapsed: Date.now() - origin, boot: 'startup-fixture' };
        if (plugin === 'DeviceKey') return { key: 'startup-fixture' };
        return {};
      },
      nativeCallback: async (plugin, method, options, cb) => {
        if (plugin === 'App' && method === 'addListener') (window.__nativeListeners[options.eventName] ||= []).push(cb);
        return 'fixture-listener';
      },
    };
    localStorage.setItem('healer.lang', 'ko');
  });
}

async function start(browser, url, errs, { width = 360, height = 780, boot = normal(), hold = false, account = false, conflict = true, corruptSeen = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'ko-KR', isMobile: true, hasTouch: true });
  await bridge(ctx);
  const state = { boot, hold, started: deferred(), release: deferred(), downloadStarted: deferred(), downloadRelease: deferred(),
    downloadDone: deferred(), deviceDone: deferred(), holdDownload: false, requests: [], cloud: null, store: [] };
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === new URL(url).origin) return route.continue();
    if (u.hostname === 'store.example.invalid') { state.store.push(req.url()); return route.fulfill({ contentType: 'text/html', body: '<title>Test store</title>' }); }
    if (!u.hostname.endsWith('.supabase.co')) { errs.push(`unexpected external request ${u.hostname}`); return route.abort(); }
    const body = req.postDataJSON(); state.requests.push({ path: u.pathname, body });
    try {
      if (u.pathname.endsWith('/app_boot')) {
        const snapshot = structuredClone(state.boot), wait = state.hold ? state.release.promise : null;
        state.started.resolve(body); if (wait) await wait;
        return await route.fulfill({ json: snapshot });
      }
      if (u.pathname.endsWith('/signup')) return await route.fulfill({ status: 400, json: { message: 'Anonymous signup disabled in fixture' } });
      if (u.pathname.endsWith('/user')) return await route.fulfill({ json: user });
      if (u.pathname.endsWith('/device_status')) {
        await route.fulfill({ json: { exists: true, active: true, rev: 1 } }); state.deviceDone.resolve(); return;
      }
      if (u.pathname.endsWith('/download_save')) {
        state.downloadStarted.resolve(); if (state.holdDownload) await state.downloadRelease.promise;
        await route.fulfill({ json: { exists: true, rev: 1, level: 5, data: state.cloud, updated_at: Date.now() } }); state.downloadDone.resolve(); return;
      }
      if (u.pathname.endsWith('/log_login')) return await route.fulfill({ json: { ok: true } });
      errs.push(`unexpected RPC ${u.pathname}`); return await route.fulfill({ status: 500, json: { message: 'Unexpected RPC' } });
    } catch (e) { if (!req.failure() && !ctx.pages().every(p => p.isClosed())) throw e; }
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(`${width}: ${e.message}`));
  await page.clock.install();
  // 서버가 꺼진 첫 페이지에서 저장만 준비한다. 재시작부터 실제 서버 시작 흐름을 검사한다.
  await page.goto(url); await page.waitForSelector('#titleStart');
  const seed = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.tut = 3; s.player.level = 9; return s; });
  state.cloud = structuredClone(seed); state.cloud.player.level = 5;
  const b64 = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, session_id: uid, exp: Math.floor(Date.now() / 1000) + 3600 })}.not-a-real-signature`;
  await page.evaluate(({ seed, account, user, jwt, conflict, corruptSeen }) => {
    localStorage.setItem('startup-server-fixture', '1'); localStorage.setItem('healer.save', JSON.stringify(seed));
    if (corruptSeen) localStorage.setItem('healer.notices.seen', '{}');
    if (account) {
      localStorage.setItem('healer.auth', JSON.stringify({ access_token: jwt, refresh_token: 'fake-only', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }));
      localStorage.setItem('healer.backup', JSON.stringify({ uid: user.id, rev: 1, hash: 'old', at: 1, conflict }));
    }
  }, { seed, account, user, jwt, conflict, corruptSeen });
  await page.reload({ waitUntil: 'domcontentloaded' }); await state.started.promise; await page.waitForSelector('#titleStart');
  return { page, state, close: async () => { state.release.resolve(); state.downloadRelease.resolve(); await ctx.close(); } };
}

const title = page => page.locator('#s-title').isVisible();
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function fits(page) {
  return page.locator('.admodal').last().evaluate(box => {
    const panel = box.querySelector('.panel'), r = panel.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.top >= 70 && r.bottom <= innerHeight
      && [...panel.querySelectorAll('button')].every(b => { const p = b.getBoundingClientRect(); return p.width >= 44 && p.height >= 44 && p.bottom <= r.bottom; });
  });
}

export default async function serverStartup(url, shots) {
  const browser = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (v, label) => { console.log(`${v ? 'PASS' : 'FAIL'} ${label}`); if (!v) fails++; };
  try {
    for (const width of [360, 320]) {
      const h = width === 360 ? 780 : 640;
      const x = await start(browser, url, errs, { width, height: h, boot: forced(), hold: true, account: true });
      try {
        const { page: p, state: s } = x;
        ok(await p.locator('#titleStart').isDisabled() && await title(p), `${width}: 서버 확인 전 시작 잠금·타이틀 유지`);
        s.release.resolve(); await p.locator('.admodal.block').waitFor(); await painted(p);
        ok(await title(p) && await p.locator('.admodal').count() === 1, `${width}: 강제 업데이트가 공지·점검·계정 복원보다 먼저 하나만 표시`);
        ok(!await p.evaluate(() => localStorage.getItem('healer.notices.seen')) && !s.requests.some(r => /device_status|download_save|log_login/.test(r.path)), `${width}: 강제 업데이트 중 공지 읽음·계정 요청 없음`);
        ok(await p.evaluate(() => !window.__nativeCalls.some(c => c.plugin === 'DeviceKey')), `${width}: 강제 업데이트 중 계정 초기화 미시작`);
        ok(s.requests[0].body.p_platform === 'android' && s.requests[0].body.p_version === 651, `${width}: 실제 SDK의 App.getInfo로 Android 버전 651 전달`);
        ok(await fits(p), `${width}: 강제 업데이트 창·44px 버튼이 화면 안`);
        for (let i = 0; i < 5; i++) { await p.keyboard.press('Tab'); ok(await p.evaluate(() => !!document.activeElement?.closest('.admodal.block')), `${width}: 업데이트 창 안에서 Tab 순환 ${i + 1}`); }
        await p.keyboard.press('Escape'); ok(await p.locator('.admodal.block').count() === 1, `${width}: Escape로 강제 업데이트 우회 불가`);
        await p.screenshot({ path: `${shots}/startup-force-${width}x${h}.png` });
        await p.evaluate(() => window.__back());
        ok(await p.locator('.admodal').count() === 2, `${width}: 뒤로가기는 업데이트를 닫지 않고 종료 확인`);
        await p.evaluate(() => window.__back());
        ok(await p.locator('.admodal').count() === 1, `${width}: 종료 확인에서 다시 뒤로는 취소 (팝업 중복 없음)`);
        await p.click('[data-upd="exit"]');
        ok(await p.evaluate(() => window.__nativeCalls.some(c => c.plugin === 'App' && c.method === 'exitApp')), `${width}: 종료 버튼은 App.exitApp 호출`);
        await p.click('[data-upd="store"]'); await p.waitForURL('https://store.example.invalid/healer');
        ok(s.store.length === 1, `${width}: 업데이트 버튼이 설정된 주소로 이동 (스토어 HTTP 모형)`);
      } finally { await x.close(); }

      const b = normal(); b.notices = [notice(901), notice(902, false)];
      const y = await start(browser, url, errs, { width, height: h, boot: b, hold: true, corruptSeen: true });
      try {
        const { page: p, state: s } = y;
        const enabled = await p.locator('#titleStart').isEnabled(); if (enabled) await p.click('#titleStart');
        ok(!enabled && await title(p), `${width}: 늦은 공지 응답 전에도 로비 진입 불가`);
        s.release.resolve(); await p.locator('.admodal.notice').waitFor();
        ok(await title(p) && await p.locator('.admodal').count() === 1 && await p.locator('.admodal h3').innerText() === '공지사항', `${width}: 공지는 실제 타이틀 위에 표시 (깨진 읽음 기록도 복구)`);
        ok(await fits(p), `${width}: 공지 창·확인 버튼이 화면 안`);
        ok(await p.evaluate(() => !window.__nativeCalls.some(c => c.plugin === 'DeviceKey')), `${width}: 공지를 닫기 전 계정 초기화 대기`);
        await p.screenshot({ path: `${shots}/startup-notice-${width}x${h}.png` });
        await p.click('.admodal [data-ask="close"]'); await p.waitForFunction(() => !document.querySelector('#titleStart').disabled);
        await p.waitForFunction(() => window.__nativeCalls.some(c => c.plugin === 'DeviceKey'));
        ok(await p.evaluate(() => { const ids = JSON.parse(localStorage.getItem('healer.notices.seen')); return ids.includes(901) && !ids.includes(902); }), `${width}: 팝업 공지만 읽음, 목록 전용 공지는 자동 팝업 제외`);
        s.hold = false; await p.reload(); await p.waitForFunction(() => document.querySelector('#titleStart') && !document.querySelector('#titleStart').disabled);
        ok(await p.locator('.admodal').count() === 0, `${width}: 확인한 공지는 재실행 때 반복 없음`);
        await p.click('#titleStart'); await p.locator('#s-lobby').waitFor({ state: 'visible' });
        s.boot = normal(); s.boot.notices = [notice(903)]; s.started = deferred();
        await p.clock.fastForward(600_001); await p.evaluate(() => window.__nativeListeners.resume.forEach(fn => fn())); await s.started.promise;
        await p.waitForFunction(() => JSON.parse(localStorage.getItem('healer.notices') || '[]').some(n => n.id === 903));
        ok(await p.locator('.admodal').count() === 0 && !await title(p), `${width}: 게임 복귀 중 새 공지는 게임 화면을 가리지 않음`);
        ok(await p.evaluate(() => !JSON.parse(localStorage.getItem('healer.notices.seen')).includes(903)), `${width}: 미룬 공지를 읽음 처리하지 않음`);
        await p.reload(); await p.locator('.admodal.notice').waitFor();
        ok(await title(p), `${width}: 미룬 공지는 다음 실행의 타이틀에서 표시`);
      } finally { await y.close(); }
    }

    const offline = await start(browser, url, errs, { hold: true });
    try {
      const p = offline.page; await p.clock.fastForward(8100); await p.waitForFunction(() => !document.querySelector('#titleStart').disabled);
      ok(await p.locator('.admodal').count() === 0, '서버 8초 제한 시간 뒤 팝업 없이 오프라인 시작 허용');
      await p.click('#titleStart'); await p.locator('#s-lobby').waitFor({ state: 'visible' }); ok(true, '서버 무응답 뒤 실제 로비 진입');
    } finally { await offline.close(); }

    const late = await start(browser, url, errs, { account: true, conflict: false });
    try {
      const { page: p, state: s } = late; await s.deviceDone.promise; await painted(p);
      await p.click('#titleStart'); await p.locator('#s-lobby').waitFor({ state: 'visible' }); await p.clock.fastForward(600_001);
      s.holdDownload = true;
      // 이미 진행 중인 계정 요청이 강제 업데이트보다 늦게 끝나는 순서를 재현한다.
      await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('healer.backup')); st.conflict = true; localStorage.setItem('healer.backup', JSON.stringify(st)); window.__nativeListeners.resume.at(-1)(); });
      await s.downloadStarted.promise;
      s.boot = forced(); s.started = deferred();
      await p.evaluate(() => window.__nativeListeners.resume[0]()); await s.started.promise; await p.locator('.admodal.block').waitFor();
      s.downloadRelease.resolve(); await s.downloadDone.promise; await painted(p);
      ok(await p.locator('.admodal').count() === 1 && await p.locator('.admodal.block').count() === 1, '계정 다운로드가 뒤늦게 끝나도 강제 업데이트 위에 복원 창 없음');
      ok(await p.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).player.level === 9 && JSON.parse(localStorage.getItem('healer.backup')).conflict), '강제 업데이트 중 원래 진행과 미해결 백업 상태 보존');
    } finally { await late.close(); }
  } catch (e) { errs.push(e.stack || String(e)); }
  finally { await browser.close(); }
  return { fails, errs };
}
