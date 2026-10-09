// 독립 Chromium 저장/상태 fixture의 입력 회귀. viewport/DPR 에뮬레이션이며 실기기 검수가 아니다.
// 단일 버튼/대상은 touchscreen API, 쓸기/두 손가락은 Chromium touch 입력도 검사한다.
// 취소 경계는 합성 PointerEvent로 재현한다. 크기 변경은 실제 일시정지 설정 경로를 사용한다.
import { chromium } from 'playwright';
import { pastTitle, patchSave, toParty } from './nav.mjs';

const PROFILES = [
  { name: 'GalaxyS24', width: 360, height: 780, dpr: 3 },
  { name: 'GalaxyA55', width: 480, height: 1040, dpr: 2.25 },
  { name: 'FlipCustom', width: 360, height: 880, dpr: 3 },
  { name: 'Stress', width: 320, height: 640, dpr: 2 },
];

async function installFixture(page) {
  await page.evaluate(() => {
    const selectors = { heal: '#wheel [data-slot="heal"]', renew: '#wheel [data-slot="renew"]',
      flash: '#wheel [data-slot="flash"]', purify: '#wheel [data-slot="purify"]', hymn: '#wheel [data-slot="hymn"]',
      mana: '#items [data-item="mana"]', shield: '#items [data-item="shield"]',
      zenith: '#aux [data-tal="zenith"]', shelter: '#aux [data-tal="shelter"]' };
    const point = name => {
      if (name.startsWith('board:') || name === 'empty') {
        const f = window.__proto.F;
        const cell = name === 'empty' ? f.cells.find(c => !c.unit).i : f.party.filter(u => u.alive)[Number(name.split(':')[1])].cell;
        const p = window.__proto.center(cell), el = document.querySelector('#board'), r = el.getBoundingClientRect();
        return { el, x: r.x + p.x, y: r.y + p.y, cell };
      }
      const el = document.querySelector(selectors[name] || name), r = el.getBoundingClientRect();
      return { el, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const send = (name, type, id = 1, offsets = {}) => {
      const p = point(name);
      p.el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch',
        pointerId: id, isPrimary: id === 1, button: 0, buttons: type === 'pointerup' ? 0 : 1,
        clientX: p.x + (offsets.dx || 0), clientY: p.y + (offsets.dy || 0), ...offsets }));
    };
    const tap = (name, id = 1) => { send(name, 'pointerdown', id); send(name, 'pointerup', id); };
    const snap = () => {
      const f = window.__proto.F;
      return { casts: { ...f.stats.casts }, cast: f.cast ? { ...f.cast } : null, queued: f.queued ? { ...f.queued } : null,
        mana: f.mana, items: { ...f.items }, itemUses: f.itemLog.length, taps: f.stats.taps, channel: f.channel,
        manaFails: f.stats.manaFails, hot: f.party.map(u => u.hot), shields: f.party.map(u => u.shield),
        zenith: { ...f.tx.act.zenith }, talentUses: f.events.filter(e => e.type === 'msg' && e.text.startsWith('기도의 정점:')).length };
    };
    const toggleMode = () => {
      const pause = document.querySelector('#pause'), controls = document.querySelector('#controls');
      const paused = !pause.hidden, compact = controls.classList.contains('compact-controls');
      if (!paused) document.querySelector('#pauseBtn').click();
      if (pause.hidden) throw new Error('입력 fixture: 일시정지 설정이 열리지 않음');
      const setting = document.querySelector('#pauseCompact');
      setting.click();
      if (setting.checked !== !compact || controls.classList.contains('compact-controls') !== !compact) {
        throw new Error('입력 fixture: 일시정지 설정으로 스킬 패널 크기가 전환되지 않음');
      }
      if (!paused) document.querySelector('#resumeBtn').click();
      if (!pause.hidden !== paused) throw new Error('입력 fixture: 크기 전환 후 원래 일시정지 상태가 복구되지 않음');
    };
    const reset = () => {
      // 전환은 진행 중 포인터/팁만 취소한다. 장전된 대상 선택은 UI의 재탭 경로로 해제한다.
      toggleMode(); toggleMode();
      for (const el of document.querySelectorAll('#wheel [aria-pressed="true"], #items .armed, #aux .armed')) el.click();
      const f = window.__proto.F;
      f.level = 100; f.cast = null; f.queued = null; f.gcd = 0; f.channel = 0; f.mana = 80;
      f.g.p = 0; f.g.s = 0; f.cd = { purify: 0, guardian: 0, hymn: 0 };
      f.items.mana = 2; f.items.shield = 2; f.potCd = 0; f.itemLog = []; f.events = [];
      f.stats.casts = {}; f.stats.taps = 0; f.stats.manaFails = 0;
      for (const v of Object.values(f.tx.act)) { v.used = false; v.cd = 0; v.left = 0; }
      for (const u of f.party) { u.hp = u.max * 0.6; u.hot = 0; u.shield = 0; u.debuffs = []; }
      window.dispatchEvent(new Event('resize'));
    };
    window.__inputFixture = { point, send, tap, snap, reset, toggleMode };
  });
}

const reset = async page => { await page.evaluate(() => window.__inputFixture.reset()); await page.clock.runFor(40); };
const state = page => page.evaluate(() => window.__inputFixture.snap());
const unchanged = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function toggleMode(page) {
  const paused = await page.isVisible('#pause');
  const compact = await page.locator('#controls').evaluate(el => el.classList.contains('compact-controls'));
  if (!paused) await page.click('#pauseBtn');
  await page.setChecked('#pauseCompact', !compact);
  if (await page.isChecked('#pauseCompact') !== !compact
    || await page.locator('#controls').evaluate(el => el.classList.contains('compact-controls')) !== !compact) {
    throw new Error('일시정지 설정으로 스킬 패널 크기가 전환되지 않음');
  }
  if (!paused) await page.click('#resumeBtn');
  await page.clock.runFor(40);
  if (await page.isVisible('#pause') !== paused) throw new Error('크기 전환 후 원래 일시정지 상태가 복구되지 않음');
}
async function touch(page, name) {
  const p = await page.evaluate(name => { const p = window.__inputFixture.point(name); return { x: p.x, y: p.y }; }, name);
  await page.touchscreen.tap(p.x, p.y); await page.clock.runFor(40);
}

async function haloInputs(page, ok) {
  if (!await page.locator('#controls').evaluate(el => el.classList.contains('compact-controls'))) return;
  for (const name of ['renew', 'mana']) {
    await reset(page);
    if (name === 'mana') await page.evaluate(() => { window.__proto.F.mana = 20; });
    const point = await page.evaluate(name => {
      const { el, x, y } = window.__inputFixture.point(name), r = el.getBoundingClientRect();
      const w = Number(el.dataset.hitWidth), h = Number(el.dataset.hitHeight);
      const dx = w - r.width, dy = h - r.height;
      // 큰 스킬은 표시 영역 자체가 44px 이상이므로 바깥 halo가 없을 수 있다.
      if (Math.max(dx, dy) <= 0.2) return { expanded: false, visualW: r.width, visualH: r.height, w, h };
      const p = dx > dy ? { x: x - (r.width + w) / 4, y } : { x, y: y - (r.height + h) / 4 };
      const hit = document.elementFromPoint(p.x, p.y);
      return { ...p, expanded: true, visualW: r.width, visualH: r.height, w, h,
        outsideVisual: p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom,
        targetHit: hit === el || !!hit && el.contains(hit) };
    }, name);
    if (!point.expanded) {
      ok(point.visualW >= 43.9 && point.visualH >= 43.9,
        `${name} 표시 영역 자체가 44px 이상이라 별도 바깥 halo 불필요(중심 touch는 별도 검사)`, point);
      continue;
    }
    ok(point.w >= 43.9 && point.h >= 43.9 && point.outsideVisual && point.targetHit,
      `${name} 실제 touch 지점은 표시 경계 밖의 확장된 44px 영역`, point);
    await page.touchscreen.tap(point.x, point.y);
    await page.clock.runFor(40);
    await page.evaluate(name => window.__inputFixture.send(name, 'click', 1, { detail: 1 }), name);
    if (name === 'renew') {
      const armed = await page.getAttribute('#wheel [data-slot="renew"]', 'aria-pressed') === 'true';
      await touch(page, 'board:0');
      const s = await state(page);
      ok(armed && s.casts.renew === 1 && !s.casts.heal && !s.cast && !s.queued && s.hot.some(v => v > 0),
        '스킬 halo 실제 touch와 후속 click 뒤 대상 선택은 소생 1회만 적용', s);
    } else {
      const s = await state(page);
      ok(s.itemUses === 1 && s.items.mana === 1 && s.mana >= 50 && !Object.keys(s.casts).length,
        '아이템 halo 실제 touch와 후속 click은 물약 1개만 소비', s);
    }
  }
}

async function nativeTouchCases(page, ok) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const points = () => page.evaluate(() => ['board:0', 'board:1'].map((name, i) => {
    const p = window.__inputFixture.point(name);
    return { x: p.x, y: p.y, id: i + 51, radiusX: 4, radiusY: 4, force: 1 };
  }));
  try {
    await reset(page);
    let [a] = await points();
    await send('touchStart', [a]);
    for (let i = 1; i <= 4; i++) await send('touchMove', [{ ...a, x: a.x - 15 * i }]);
    await send('touchEnd', []); await page.clock.runFor(40);
    let s = await state(page);
    ok(s.casts.renew === 1 && !s.casts.heal && !s.cast && !s.queued && s.taps === 1,
      'Chromium touch 쓸기도 소생만 1회 적용, 기본 치유 중복 없음', s);

    await reset(page);
    const first = await page.evaluate(() => window.__proto.F.party.filter(u => u.alive)[0].id);
    const both = await points(); a = both[0];
    await send('touchStart', [a]); await send('touchStart', both);
    await send('touchMove', [a, { ...both[1], x: both[1].x - 60 }]);
    const waiting = await state(page);
    await send('touchEnd', []); await page.clock.runFor(40); s = await state(page);
    ok(!Object.keys(waiting.casts).length && waiting.taps === 0
      && s.casts.heal === 1 && !s.casts.renew && s.cast?.uid === first && s.taps === 1 && !s.queued,
    'Chromium 두 손가락 touch 동시 release는 먼저 누른 대상에만 1회 적용', { waiting, after: s });
  } finally { await cdp.detach(); }
}

async function inputs(page, check, label) {
  const ok = (value, message, detail) => check(value, `${label}: ${message}`, detail);
  await nativeTouchCases(page, ok);
  await haloInputs(page, ok);
  await reset(page);
  await touch(page, 'renew');
  const armed = await page.getAttribute('#wheel [data-slot="renew"]', 'aria-pressed') === 'true';
  await touch(page, 'board:0');
  let s = await state(page);
  ok(armed && s.casts.renew === 1 && !s.casts.heal && !s.cast && !s.queued && s.hot.some(v => v > 0),
    '실제 touch 스킬 버튼 장전 → 대상 탭은 소생 1회, 기본 치유/후속 click 중복 없음', s);

  await reset(page); await touch(page, 'hymn'); s = await state(page);
  ok(s.casts.hymn === 1 && s.channel > 3.8 && !s.queued && !s.cast,
    '대상 없는 찬가 버튼은 실제 touch 한 번으로 즉시 사용 1회', s);

  await reset(page);
  let r = await page.evaluate(() => {
    const q = window.__inputFixture;
    q.send('board:0', 'pointerdown'); q.send('board:0', 'pointermove', 1, { dx: -60 });
    q.send('board:0', 'pointerup', 1, { dx: -60 }); q.send('board:0', 'pointerup', 1, { dx: -60 });
    q.send('board:0', 'click', 1, { dx: -60, detail: 1 });
    return q.snap();
  });
  ok(r.casts.renew === 1 && !r.casts.heal && !r.cast && !r.queued && r.taps === 1,
    '소생 방향 쓸기 + 중복 up/click은 소생만 1회', r);

  for (const returnToStart of [false, true]) {
    await reset(page);
    r = await page.evaluate(back => {
      const q = window.__inputFixture, before = q.snap();
      q.send('board:0', 'pointerdown'); q.send('board:0', 'pointermove', 1, { dx: back ? -60 : -20 });
      if (back) q.send('board:0', 'pointermove', 1, { dx: 0 });
      q.send('board:0', 'pointerup'); return { before, after: q.snap() };
    }, returnToStart);
    ok(!Object.keys(r.after.casts).length && !r.after.cast && !r.after.queued && r.after.mana === r.before.mana,
      returnToStart ? '쓸다가 원점 복귀는 사용 취소' : '탭 허용치를 넘고 쓸기 최소 거리보다 짧으면 사용 취소', r);
  }

  await reset(page);
  r = await page.evaluate(() => {
    const q = window.__inputFixture, first = window.__proto.F.party.filter(u => u.alive)[0].id;
    q.send('board:0', 'pointerdown', 1); q.send('board:1', 'pointerdown', 2);
    q.send('board:1', 'pointermove', 2, { dx: -60 }); q.send('board:1', 'pointerup', 2);
    q.send('board:1', 'pointercancel', 2); const waiting = q.snap();
    q.send('board:0', 'pointerup', 1); q.send('board:1', 'pointerup', 2);
    return { first, waiting, after: q.snap() };
  });
  ok(!Object.keys(r.waiting.casts).length && r.after.casts.heal === 1 && !r.after.casts.renew
    && r.after.cast?.uid === r.first && r.after.taps === 1 && !r.after.queued,
  '판 두 손가락의 down/move/up/cancel 중 첫 포인터만 원래 대상에 1회 적용', r);

  await reset(page);
  r = await page.evaluate(() => {
    const q = window.__inputFixture;
    q.send('renew', 'pointerdown', 1); q.send('flash', 'pointerdown', 2);
    q.send('flash', 'pointercancel', 2); q.send('flash', 'pointerup', 2);
    q.tap('board:1', 3); const waiting = q.snap();
    q.send('renew', 'pointerup', 1); q.tap('board:0', 4);
    return { waiting, after: q.snap() };
  });
  ok(!Object.keys(r.waiting.casts).length && r.waiting.taps === 0
    && r.after.casts.renew === 1 && !r.after.casts.flash && !r.after.casts.heal && !r.after.queued,
  '다른 스킬/판의 두 번째 포인터는 첫 스킬 선택을 덮거나 조기 종료하지 않음', r);

  for (const name of ['mana', 'zenith']) {
    await reset(page);
    r = await page.evaluate(name => {
      const q = window.__inputFixture;
      window.__proto.F.mana = 20;
      q.send(name, 'pointerdown', 1); q.send(name, 'pointerdown', 2);
      q.send(name, 'pointerup', 2); q.send(name, 'pointercancel', 2);
      q.tap('renew', 3); const waiting = q.snap();
      q.send(name, 'pointerup', 1); q.send(name, 'pointerup', 2);
      q.send(name, 'click', 1, { detail: 1 }); return { waiting, after: q.snap() };
    }, name);
    ok(r.waiting.itemUses === 0 && r.waiting.talentUses === 0
      && (name === 'mana' ? r.after.itemUses === 1 && r.after.items.mana === 1 && r.after.mana === 50
        : r.after.talentUses === 1 && r.after.zenith.used),
    `${name === 'mana' ? '물약' : '보조 기술'} 멀티포인터/후속 click은 첫 포인터 사용 1회`, r);
  }

  for (const cancellation of ['pointercancel', 'lostpointercapture', 'drag-out']) {
    for (const name of ['renew', 'mana', 'zenith', 'board:0']) {
      if (cancellation === 'drag-out' && name.startsWith('board')) continue;
      await reset(page);
      r = await page.evaluate(({ name, cancellation }) => {
        const q = window.__inputFixture, before = q.snap();
        q.send(name, 'pointerdown', 1);
        if (cancellation === 'drag-out') q.send(name, 'pointermove', 1, { dx: -1000, dy: -1000 });
        else q.send(name, cancellation, 1);
        q.send(name, 'pointerup', 1); q.send(name, 'click', 1, { detail: 1 });
        return { before, after: q.snap() };
      }, { name, cancellation });
      await page.clock.runFor(500);
      const noTip = await page.isHidden('#tip') && await page.isHidden('#preview');
      const notArmed = await page.getAttribute('#wheel [data-slot="renew"]', 'aria-pressed') !== 'true';
      ok(unchanged(r.before, r.after) && noTip && notArmed, `${name} ${cancellation} 뒤 release는 사용/지연 설명 없음`, r);
    }
  }

  for (const name of ['renew', 'mana', 'zenith', 'board:0']) {
    await reset(page);
    await page.evaluate(name => window.__inputFixture.send(name, 'pointerdown'), name);
    await page.clock.runFor(500);
    const showed = await page.isVisible(name.startsWith('board') ? '#preview' : '#tip');
    r = await page.evaluate(name => {
      const q = window.__inputFixture, before = q.snap();
      q.send(name, 'pointerup'); q.send(name, 'click', 1, { detail: 1 }); return { before, after: q.snap() };
    }, name);
    ok(showed && unchanged(r.before, r.after), `${name} 길게 누른 뒤 release/click은 설명만 표시하고 사용 없음`, r);
  }

  for (const name of ['renew', 'mana', 'zenith', 'board:0']) {
    await reset(page);
    const before = await page.evaluate(name => {
      const q = window.__inputFixture, before = q.snap();
      q.send(name, 'pointerdown'); document.querySelector('#targetsBtn').click(); return before;
    }, name);
    await page.clock.runFor(500);
    const noTip = await page.isHidden('#tip') && await page.isHidden('#preview');
    const after = await page.evaluate(name => {
      document.querySelector('#targetsClose').click();
      const q = window.__inputFixture;
      q.send(name, 'pointerup'); q.send(name, 'click', 1, { detail: 1 }); return q.snap();
    }, name);
    await page.clock.runFor(40);
    const notArmed = await page.getAttribute('#wheel [data-slot="renew"]', 'aria-pressed') !== 'true';
    ok(noTip && notArmed && unchanged(before, after), `${name} 누른 채 대상 목록 열기/닫기는 타이머·늦은 release 취소`, { before, after });
  }

  for (const name of ['renew', 'mana', 'zenith', 'board:0']) {
    await reset(page);
    r = await page.evaluate(name => {
      const q = window.__inputFixture, before = q.snap();
      q.send(name, 'pointerdown'); q.toggleMode();
      q.send(name, 'pointerup'); q.send(name, 'click', 1, { detail: 1 });
      return { before, after: q.snap() };
    }, name);
    await page.clock.runFor(40);
    ok(unchanged(r.before, r.after), `${name} 누른 채 모드 전환은 진행 중 입력 취소`, r);
    await toggleMode(page);
  }

  await reset(page);
  r = await page.evaluate(() => {
    const q = window.__inputFixture, f = window.__proto.F;
    q.tap('shield');
    f.cast = { key: 'heal', uid: f.party[0].id, cell: f.party[0].cell, left: 1.2, total: 1.8 };
    f.queued = { key: 'renew', uid: f.party[1].id }; f.gcd = 0.7; f.g.p = 42; f.g.s = 24;
    f.party[0].debuffs = [{ id: 99991, name: '입력 시험 독', type: '독', left: 12, dot: 1 }];
    f.party[1].shield = 5;
    const before = JSON.stringify(f);
    q.toggleMode(); q.toggleMode();
    const same = window.__proto.F === f && JSON.stringify(f) === before;
    f.cast = null; f.queued = null; f.gcd = 0;
    q.tap('empty'); const empty = q.snap(); q.tap('board:0');
    return { same, empty, after: q.snap() };
  });
  ok(r.same && r.empty.itemUses === 0 && r.empty.items.shield === 2 && r.after.itemUses === 1
    && r.after.items.shield === 1 && !Object.keys(r.after.casts).length && r.after.shields[0] === 8,
  '모드 왕복은 시전·예약·자원·상태 전체와 보호 장전 보존, 빈 칸 후 올바른 대상에서만 소비', r);

  for (const method of ['button', 'swipe']) {
    await reset(page);
    r = await page.evaluate(method => {
      const q = window.__inputFixture, f = window.__proto.F;
      f.mana = 0;
      if (method === 'button') { q.tap('renew'); q.tap('board:0'); }
      else { q.send('board:0', 'pointerdown'); q.send('board:0', 'pointermove', 1, { dx: -60 }); q.send('board:0', 'pointerup'); }
      return { ...q.snap(), toast: document.querySelector('#toast').textContent };
    }, method);
    ok(r.mana === 0 && r.manaFails === 1 && !Object.keys(r.casts).length && !r.cast && !r.queued && /마나 부족/.test(r.toast),
      `${method} 마나 부족은 1회 안내하고 시전/예약/자원 소비 없음`, r);
  }

  await reset(page);
  r = await page.evaluate(() => {
    const q = window.__inputFixture, f = window.__proto.F;
    f.cd.purify = 6;
    f.party[0].debuffs = [{ id: 99992, name: '입력 시험 질병', type: '질병', left: 12, dot: 1 }];
    const before = f.mana; q.tap('purify'); q.tap('board:0');
    return { ...q.snap(), before, cd: f.cd.purify, debuffs: f.party[0].debuffs.length, toast: document.querySelector('#toast').textContent };
  });
  ok(r.mana === r.before && r.cd === 6 && r.debuffs === 1 && !Object.keys(r.casts).length && !r.cast && !r.queued && /재사용 대기/.test(r.toast),
    '쿨다운 중 버튼 → 대상은 효과/예약/마나 소비 없이 거절', r);

  await reset(page);
  await page.evaluate(() => { window.__proto.F.level = 1; window.dispatchEvent(new Event('resize')); });
  await page.clock.runFor(40);
  const before = await state(page);
  await touch(page, '#wheel [data-lock="purify"]'); s = await state(page);
  ok(!Object.keys(s.casts).length && !s.cast && !s.queued && s.itemUses === before.itemUses
    && /Lv 3/.test(await page.textContent('#toast')), '잠긴 버튼 실제 touch는 해금 안내만 표시', s);
  await reset(page);
}

async function beaconInputs(page, check, label) {
  // 실제 선택 직업을 성기사로 저장하고 새 전투를 시작한다. 기존 사제 Fight의 hero만 바꾸지 않는다.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.hero = 'paladin'; s.settings.compactSkills = false;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await toParty(page, { content: 'rustfort', tab: 'dungeon', diff: '쉬움' });
  await page.click('#depart'); await page.clock.runFor(3400); await installFixture(page);
  for (const compact of [false, true]) {
    if (await page.locator('#controls').evaluate(el => el.classList.contains('compact-controls')) !== compact) await toggleMode(page);
    const ok = (v, message, detail) => check(v, `${label} ${compact ? '축소' : '기본'} 봉화: ${message}`, detail);
    await reset(page);
    await page.evaluate(() => { window.__proto.F.beaconCd = 0; });
    for (const cancellation of ['pointercancel', 'drag-out']) {
      await page.evaluate(cancellation => {
        const q = window.__inputFixture;
        q.send('#core', 'pointerdown');
        if (cancellation === 'drag-out') q.send('#core', 'pointermove', 1, { dx: -1000 });
        else q.send('#core', cancellation);
        q.send('#core', 'pointerup'); q.send('#core', 'click', 1, { detail: 1 });
      }, cancellation);
      await page.clock.runFor(40);
      ok(await page.locator('#core').evaluate(el => !el.classList.contains('beacon')), `${cancellation} 뒤 release는 지정 모드 진입 없음`);
    }
    await page.evaluate(() => {
      const q = window.__inputFixture;
      q.send('#core', 'pointerdown', 1); q.send('#core', 'pointerdown', 2); q.send('#core', 'pointerup', 2);
    });
    await page.clock.runFor(40);
    const waiting = await page.locator('#core').evaluate(el => !el.classList.contains('beacon'));
    await page.evaluate(() => {
      const q = window.__inputFixture;
      q.send('#core', 'pointerup', 1); q.send('#core', 'pointerup', 2); q.send('#core', 'click', 1, { detail: 1 });
    });
    await page.clock.runFor(40);
    ok(waiting && await page.locator('#core').evaluate(el => el.classList.contains('beacon')),
      '두 번째 포인터는 조기 지정하지 않으며 첫 release만 한 번 장전');
    await toggleMode(page);
    const kept = await page.locator('#core').evaluate(el => el.classList.contains('beacon'));
    await toggleMode(page);
    ok(kept && await page.locator('#core').evaluate(el => el.classList.contains('beacon')), '모드 왕복 후 봉화 장전 유지');
    const target = await page.evaluate(() => {
      const f = window.__proto.F, alive = f.party.filter(u => u.alive);
      const idx = alive.findIndex(u => !u.me && u.id !== f.beacon);
      return { idx, id: alive[idx].id };
    });
    await touch(page, `board:${target.idx}`);
    ok(await page.evaluate(id => window.__proto.F.hero === 'paladin' && window.__proto.F.beacon === id, target.id)
      && await page.locator('#core').evaluate(el => !el.classList.contains('beacon')),
    '대상 touch로 선택 파티원에 봉화 적용 후 장전 해제');
    await page.evaluate(() => { window.__proto.F.beaconCd = 0; });
    await page.locator('#core').focus(); await page.keyboard.press('Enter'); await page.clock.runFor(40);
    const armed = await page.locator('#core').evaluate(el => el.classList.contains('beacon'));
    await page.keyboard.press('Space'); await page.clock.runFor(40);
    ok(armed && await page.locator('#core').evaluate(el => !el.classList.contains('beacon')), 'Enter 장전·Space 취소가 각 한 번만 적용');
  }
}

export default async function compactInput(url) {
  const browser = await chromium.launch();
  const errs = [], profiles = [];
  let fails = 0, checks = 0;
  const check = (value, message, detail) => {
    checks++; console.log(`${value ? 'PASS' : 'FAIL'} ${message}`);
    if (!value) { fails++; if (detail) console.log(JSON.stringify(detail)); }
  };
  try {
    for (const profile of PROFILES) {
      const { name, width, height, dpr } = profile;
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.setDefaultTimeout(7000);
      page.on('pageerror', e => errs.push(`${name}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
      try {
        await page.clock.install(); await page.goto(url); await page.clock.runFor(300); await pastTitle(page);
        await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('healer.save'));
          s.hero = 'priest'; s.heroes.priest ||= { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0 };
          s.heroes.priest.talents = [null, null, null, null, null, null, 1, null, null, 0];
          localStorage.setItem('healer.save', JSON.stringify(s));
        });
        await patchSave(page, { player: { level: 100 }, items: ['mana', 'shield'],
          settings: { compactSkills: false, auto: false, allSkills: false, devUnlock: true, sound: false, vibrate: false } });
        await pastTitle(page); await toParty(page, { content: 'rustfort', tab: 'dungeon', diff: '쉬움' });
        await page.click('#depart'); await page.clock.runFor(3400); await installFixture(page);
        profiles.push(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })));
        for (const compact of [false, true]) {
          if (await page.locator('#controls').evaluate(el => el.classList.contains('compact-controls')) !== compact) {
            await toggleMode(page);
          }
          await inputs(page, check, `${name} ${width}×${height} DPR${dpr} ${compact ? '축소' : '기본'}`);
        }
        await beaconInputs(page, check, `${name} ${width}×${height} DPR${dpr}`);
      } catch (e) {
        const context = await page.evaluate(() => ({ title: document.title, over: window.__proto?.F?.over,
          battle: !document.querySelector('#battle')?.hidden, slots: document.querySelectorAll('#wheel [data-slot]').length })).catch(() => null);
        const error = `${name}: ${e.stack || e.message}\nContext: ${JSON.stringify(context)}`;
        errs.push(error); console.log(`ERROR ${error}`);
      }
      finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  return { fails, errs, checks, profiles };
}
