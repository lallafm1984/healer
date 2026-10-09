// 전투판 여백·균등 확대 회귀. 독립 저장과 명시적 엔진 fixture만 사용한다.
// 모든 좌표는 CSS px다. viewport/DPR 에뮬레이션이며 실기기 검사가 아니다.
// 가로 화면 자체 UX의 통과를 주장하지 않고 세로 복귀와 전투 상태 보존만 검사한다.
import { chromium } from 'playwright';
import { pastTitle, patchSave, toParty } from './nav.mjs';

const PROFILES = [
  { name: 'S24', width: 360, height: 780, dpr: 3 },
  { name: 'A55', width: 480, height: 1040, dpr: 2.25 },
  { name: 'Flip', width: 360, height: 880, dpr: 3 },
  { name: 'Stress', width: 320, height: 640, dpr: 2 },
  { name: 'Threshold412', width: 412, height: 915, dpr: 3 },
];
const PARTIES = [
  { n: 3, tab: 'explore', content: 'plateau' },
  { n: 5, tab: 'dungeon', content: 'rustfort' },
  { n: 10, tab: 'raid', content: 'abyss1' },
  { n: 20, tab: 'raid', content: 'cathedral1' },
];
const EPS = 0.16;
const finite = (...values) => values.every(Number.isFinite);
const separated = (a, b) => a.right <= b.left + .05 || b.right <= a.left + .05 || a.bottom <= b.top + .05 || b.bottom <= a.top + .05;
const rectOf = r => ({ ...r, left: r.left ?? r.x - r.w / 2, right: r.right ?? r.x + r.w / 2,
  top: r.top ?? r.y - r.h / 2, bottom: r.bottom ?? r.y + r.h / 2 });
// circle/pill은 사각 AABB의 빈 모서리를 paint로 오인하지 않는다. 텍스트·십자는 보수적인 AABB를 유지한다.
function filledOverlap(a, b) {
  if (separated(a, b)) return false;
  const capsule = b => {
    if (b.shape !== 'circle' && b.shape !== 'pill') return null;
    const r = Math.min(b.w, b.h) / 2;
    return { left: b.left + r, right: b.right - r, top: b.top + r, bottom: b.bottom - r, r };
  };
  const ac = capsule(a), bc = capsule(b);
  if (!ac && !bc) return true;
  const aa = ac || a, bb = bc || b;
  const dx = Math.max(0, aa.left - bb.right, bb.left - aa.right), dy = Math.max(0, aa.top - bb.bottom, bb.top - aa.bottom);
  return Math.hypot(dx, dy) < (ac?.r || 0) + (bc?.r || 0) - .05;
}

async function toggle(page) {
  await page.click('#pauseBtn');
  await page.locator('#pauseCompact').setChecked(!await page.isChecked('#pauseCompact'));
  await page.click('#resumeBtn');
  await page.clock.runFor(32);
}

async function enter(page, party) {
  await patchSave(page, { player: { level: 100 }, settings: { compactSkills: false, auto: false,
    allSkills: false, devUnlock: true, sound: false, vibrate: false, reducedEffects: true, zoom: false } });
  await pastTitle(page); await toParty(page, { ...party, diff: '쉬움' });
  await page.click('#depart'); await page.clock.runFor(6500);
  await page.evaluate(() => {
    // 가장자리 hit를 자연 파티 편성의 우연에 의존하지 않게 세 명을 양끝/마지막 행에 배치한다.
    const f = window.__proto.F, cells = f.cells;
    const byX = [...cells].sort((a, b) => a.px - b.px || a.py - b.py);
    const left = byX[0], right = byX.at(-1), bottom = [...cells].sort((a, b) => b.py - a.py || Math.abs(a.px - (left.px + right.px) / 2) - Math.abs(b.px - (left.px + right.px) / 2))[0];
    const targetCells = [...new Set([left.i, right.i, bottom.i])];
    const rest = cells.map(c => c.i).filter(i => !targetCells.includes(i));
    for (const c of cells) c.unit = null;
    f.party.forEach((u, i) => {
      u.cell = [...targetCells, ...rest][i]; cells[u.cell].unit = u;
      // 임시 극단 배치가 원래 home으로 되돌아가는 AI 이동과 혼동되지 않도록 fixture 위치를 home으로 삼는다.
      u.home = u.cell; u.homeAt = null; u.p = { ...u.p, flee: 0 };
    });
    window.__edgeTargets = { left: cells[left.i].unit.id, right: cells[right.i].unit.id, bottom: cells[bottom.i].unit.id };
    window.__edgeTopology = JSON.stringify(cells.map(c => [c.i, c.q, c.r, c.px, c.py, c.unit?.id ?? null]));
  });
  await resetAction(page);
  await page.clock.runFor(1800); // 전투 시작 배너/기존 부유 효과 종료.
  await resetAction(page);
}

async function resetAction(page) {
  await page.evaluate(() => {
    const f = window.__proto.F;
    Object.assign(f, { cast: null, queued: null, gcd: 0, channel: 0, mana: 90, events: [], tels: [], zones: [], abOn: false, dmgMult: 0, beacon: null });
    f.g.p = 0; f.g.s = 0; f.cd = {};
    for (const u of f.party) Object.assign(u, { hp: u.max * .6, alive: true, moving: null, react: null, fleeing: false,
      home: u.cell, homeAt: null, hot: 0, hots: [], debuffs: [],
      dps: 0, acc: 0, flash: 0, wrongUntil: 0, mistakeUntil: 0, shield: 0, immune: 0, redu: 0, guardian: 0, bulwark: 0, sacr: 0 });
  });
  await page.clock.runFor(32);
}

async function geometry(page) {
  return page.evaluate(() => {
    const f = window.__proto.F, canvas = document.querySelector('#board'), r = canvas.getBoundingClientRect(), d = canvas.dataset;
    const cells = f.cells.map(c => ({ i: c.i, q: c.q, r: c.r, px: c.px, py: c.py, ...window.__proto.center(c.i) }));
    const a = cells[0], bx = cells.find(b => b.px !== a.px), by = cells.find(b => b.py !== a.py);
    const sx = (bx.x - a.x) / (bx.px - a.px), sy = (by.y - a.y) / (by.py - a.py);
    const cast = document.querySelector('#castbar'), cr = cast.getBoundingClientRect();
    return { viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, canvas: { x: r.x, y: r.y, w: r.width, h: r.height,
      pixelW: canvas.width, pixelH: canvas.height }, cells, sx, sy, ox: a.x - a.px * sx, oy: a.y - a.py * sy,
      s: Number(d.cellScale), cellW: Number(d.cellWidth), cellH: Number(d.cellHeight), hp: Number(d.hpFontSize), nick: Number(d.nickFontSize),
      smallCells: d.compactCells === 'true', compact: document.querySelector('#controls').classList.contains('compact-controls'),
      safe: { left: Number(d.boardSafeLeft), right: Number(d.boardSafeRight), top: Number(d.boardSafeTop), bottom: Number(d.boardSafeBottom) },
      insets: { left: Number(d.boardInsetLeft), right: Number(d.boardInsetRight) }, fitAxis: d.boardFitAxis,
      hpBounds: JSON.parse(d.hpTextBounds || '[]'), decorations: JSON.parse(d.decorationBounds || '[]'),
      cast: { left: cr.x - r.x, right: cr.right - r.x, top: cr.y - r.y, bottom: cr.bottom - r.y,
        visible: getComputedStyle(cast).visibility !== 'hidden', pointer: getComputedStyle(cast).pointerEvents,
        parent: cast.parentElement.id, casting: cast.classList.contains('is-casting'),
        trackVisible: getComputedStyle(document.querySelector('#castTrack')).visibility !== 'hidden' },
      topologyStable: window.__edgeTopology === JSON.stringify(f.cells.map(c => [c.i, c.q, c.r, c.px, c.py, c.unit?.id ?? null])),
      renderer: window.__proto.renderer, party: f.party.length,
    };
  });
}

function checkGeometry(g, ok, label) {
  const radius = g.sx * .93, strokeWidth = Math.max(2.5, g.sx * .07);
  // 수직 모서리는 반 선폭, 위·아래 120° 꼭짓점은 miter 길이까지 실제 paint에 포함된다.
  const strokeX = strokeWidth / 2, strokeY = strokeWidth / Math.sqrt(3);
  const body = { left: Math.min(...g.cells.map(c => c.x)) - radius * Math.sqrt(3) / 2 - strokeX,
    right: Math.max(...g.cells.map(c => c.x)) + radius * Math.sqrt(3) / 2 + strokeX,
    top: Math.min(...g.cells.map(c => c.y)) - radius - strokeY,
    bottom: Math.max(...g.cells.map(c => c.y)) + radius + strokeY };
  const margins = { left: body.left - g.safe.left, right: g.safe.right - body.right, top: body.top - g.safe.top, bottom: g.safe.bottom - body.bottom };
  const uniform = finite(g.sx, g.sy) && Math.abs(g.sx - g.sy) < 1e-5 && g.sx > 0
    && g.cells.every(c => Math.abs(c.x - g.ox - c.px * g.sx) < 1e-5 && Math.abs(c.y - g.oy - c.py * g.sy) < 1e-5);
  ok(uniform && g.topologyStable && Math.abs(g.cellW / g.cellH - Math.sqrt(3) / 2) < .002,
    `${label}: 모든 셀 동일 XY 배율·육각 비율·엔진 좌표/인접관계 유지`, { sx: g.sx, sy: g.sy, topologyStable: g.topologyStable });
  const bodyFits = finite(...Object.values(g.safe), ...Object.values(margins)) && Object.values(margins).every(x => x >= -EPS);
  const centered = Math.abs((body.left + body.right) / 2 - (g.safe.left + g.safe.right) / 2) < EPS;
  const axisFits = g.fitAxis === 'horizontal' ? Math.abs(margins.left) < EPS && Math.abs(margins.right) < EPS : g.fitAxis === 'vertical';
  ok(bodyFits && centered && axisFits && g.safe.left >= 2 - EPS && g.canvas.w - g.safe.right >= 2 - EPS
    && g.hp >= 12 && g.nick >= 11,
  `${label}: 실제 body 외곽선 허용 경계·중앙 배치·제약축 준수`, { safe: g.safe, margins, fitAxis: g.fitAxis, hp: g.hp, smallCells: g.smallCells });
  const dpr = Math.min(3, g.viewport.dpr);
  ok(Math.abs(g.canvas.pixelW - Math.round(g.canvas.w) * dpr) <= 1 && Math.abs(g.canvas.pixelH - Math.round(g.canvas.h) * dpr) <= 1,
    `${label}: CSS 좌표와 캔버스 backing DPR 크기 일치`, g.canvas);
  const hp = g.hpBounds.map(rectOf);
  ok(hp.length === g.party && hp.every((a, i) => hp.slice(i + 1).every(b => separated(a, b))),
    `${label}: 표시 방식 경계 포함 실제 HP 글자 bounds 비겹침`, { hp: g.hp, smallCells: g.smallCells, labels: hp.map(x => x.text) });
  return { body, margins };
}

function checkDecorations(g, ok, label, risk = false) {
  const bounds = g.decorations.map(rectOf);
  const outside = bounds.filter(b => !finite(b.left, b.right, b.top, b.bottom) || b.left < g.safe.left - EPS
    || b.right > g.safe.right + EPS || b.top < g.safe.top - EPS || b.bottom > g.safe.bottom + EPS);
  ok(bounds.length >= g.party && bounds.some(b => b.kind === 'hp') && outside.length === 0,
    `${label}: 실제 글자·아이콘·표식 paint bounds가 safe canvas 안`, { count: bounds.length, outside });
  const circles = bounds.filter(b => b.kind === 'ring' && b.shape === 'circle');
  ok(circles.every(b => Math.abs(b.w - b.h) < EPS), `${label}: 원형 링의 가로·세로 배율 유지`, circles);
  if (!risk) return;
  // 빈 육각 디버프 테두리의 AABB는 내부 HOT를 감싼다. 가림은 채운 배지와 실제 글자로 검사한다.
  const hots = bounds.filter(b => b.kind === 'hot'), debuffs = bounds.filter(b => b.kind === 'debuff' && /^(deb\d|debuff-extra)/.test(b.key));
  const collisions = hots.flatMap(h => debuffs.filter(d => filledOverlap(h, d)).map(d => ({ hot: h, debuff: d })));
  ok(hots.length > 0 && debuffs.length > 0 && circles.length > 0 && collisions.length === 0,
    `${label}: HOT·양대각 디버프·원형 효과 존재, HOT/디버프 가림 없음`, { hots, collisions, circles: circles.length });
  const essential = bounds.filter(b => ['hp', 'hot', 'debuff', 'nick'].includes(b.kind) || b.kind === 'ring' && /selected/.test(b.key));
  ok(g.cast.visible && g.cast.trackVisible && g.cast.casting && g.cast.parent === 'battle'
    && g.cast.top >= g.canvas.h - EPS && (!g.compact || g.cast.pointer === 'none')
    && essential.every(b => separated(b, g.cast)),
    `${label}: 마지막 행 상태와 활성 시전막대 비겹침·입력 통과`, { cast: g.cast, overlap: essential.filter(b => !separated(b, g.cast)) });
}

async function targetPoint(page, key) {
  return page.evaluate(k => {
    const f = window.__proto.F, id = window.__edgeTargets[k], u = f.party.find(v => v.id === id);
    const p = window.__proto.center(u.cell), r = document.querySelector('#board').getBoundingClientRect();
    return { id, cell: u.cell, x: r.x + p.x, y: r.y + p.y, radius: Number(document.querySelector('#board').dataset.cellHeight) / 2,
      viewportW: innerWidth, viewportH: innerHeight };
  }, key);
}

async function touchSwipe(page, cdp, from, to) {
  if (![from, to].every(p => p.x >= 1 && p.x <= from.viewportW - 1 && p.y >= 1 && p.y <= from.viewportH - 1)) throw new Error('화면 밖 좌표로 가장자리 swipe를 가장할 수 없음');
  const point = p => ({ x: p.x, y: p.y, id: 1, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from)] });
  for (let n = 1; n <= 5; n++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point({ x: from.x + (to.x - from.x) * n / 5, y: from.y + (to.y - from.y) * n / 5 })] });
    await page.clock.runFor(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.clock.runFor(32);
}

async function edgeInput(page, cdp, ok, label) {
  for (const side of ['left', 'right']) {
    await resetAction(page);
    const p = await targetPoint(page, side), inward = side === 'left' ? 1 : -1;
    // 실제 육각 내부의 바깥쪽 점. nearest-cell hit 의미를 바꾸지 않고 변환 오류를 잡는다.
    await page.touchscreen.tap(p.x - inward * p.radius * .65, p.y);
    await page.clock.runFor(16);
    const tap = await page.evaluate(id => ({ target: window.__proto.F.cast?.uid, key: window.__proto.F.cast?.key, expected: id }), p.id);
    ok(tap.target === p.id && tap.key === 'heal', `${label}: ${side} 끝열 바깥쪽 내부 탭은 해당 셀 치유`, tap);

    for (const direction of ['W', 'E']) {
      await resetAction(page);
      const q = await targetPoint(page, side), outward = direction === (side === 'left' ? 'W' : 'E');
      const from = { ...q, x: q.x + (outward ? inward * q.radius * .68 : 0) };
      const to = { x: outward ? (side === 'left' ? 2 : q.viewportW - 2) : from.x + (direction === 'W' ? -60 : 60), y: from.y };
      const distance = Math.abs(to.x - from.x), key = direction === 'W' ? 'renew' : 'flash';
      ok(distance >= 26 && from.x >= 1 && to.x >= 1 && to.x < q.viewportW,
        `${label}: ${side} ${direction} 쓸기는 화면 안에서 최소 26px 확보`, { from, to, distance });
      if (distance < 26) continue;
      const before = await page.evaluate(k => window.__proto.F.stats.casts[k] || 0, key);
      await touchSwipe(page, cdp, from, to);
      const result = await page.evaluate(({ id, key }) => ({ key: window.__proto.F.cast?.key, target: window.__proto.F.cast?.uid,
        count: window.__proto.F.stats.casts[key] || 0, hot: window.__proto.F.party.find(u => u.id === id).hot }), { id: q.id, key });
      ok(key === 'renew' ? result.hot > 0 && result.count === before + 1 : result.key === 'flash' && result.target === q.id,
        `${label}: ${side} ${direction} 실제 touch 쓸기 1회·시작 대상 유지`, result);
    }
  }
}

async function riskState(page) {
  await resetAction(page);
  const bottom = await targetPoint(page, 'bottom');
  await page.touchscreen.tap(bottom.x, bottom.y); await page.clock.runFor(16);
  const injected = await page.evaluate(() => {
    const f = window.__proto.F, units = f.party;
    const deb = (id, type, left, trap = false) => ({ id, name: `가장자리 검증 ${type}`, type, left, trap });
    const ids = window.__edgeTargets;
    const left = units.find(u => u.id === ids.left), right = units.find(u => u.id === ids.right), last = units.find(u => u.id === ids.bottom);
    left.hot = 8; left.hp = left.max * .18; left.guardian = 10;
    left.debuffs = [deb(9001, '질병', 9, true), deb(9002, '독', 12)];
    right.hp = right.max * .29; right.shield = 10; right.debuffs = [deb(9003, '저주', 6)];
    last.hot = 8; last.hp = last.max * .29; last.debuffs = [deb(9004, '마법', 7)];
    f.beacon = right.id; // 원형 봉화 링: 표시 스트레스 fixture이며 사제 자연 능력으로 주장하지 않는다.
    if (units.length >= 10) {
      const dist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
      const pivot = f.cells.find(c => {
        const below = f.cells.filter(v => v.py > c.py && dist(c, v) === 1);
        return c.py > 0 && c.py < Math.max(...f.cells.map(v => v.py)) && below.length === 2
          && [c, ...below].every(v => !v.unit || !Object.values(ids).includes(v.unit.id));
      });
      if (!pivot) throw new Error('가장자리 대상을 옮기지 않는 양대각 디버프 fixture 자리가 없음');
      const below = f.cells.filter(c => c.py > pivot.py && dist(pivot, c) === 1);
      const moving = units.filter(u => !Object.values(ids).includes(u.id)).slice(0, 3);
      for (const [u, c] of moving.map((u, i) => [u, [pivot, ...below][i]])) {
        const old = f.cells[u.cell], other = c.unit;
        if (other && other !== u) { other.cell = old.i; old.unit = other; } else old.unit = null;
        c.unit = u; u.cell = c.i;
      }
      moving[0].hot = 8; moving[0].hp = moving[0].max * .18;
      moving[1].debuffs = [deb(9005, '질병', 11), deb(9006, '독', 9)];
      moving[2].debuffs = [deb(9007, '마법', 13), deb(9008, '저주', 8)];
      for (const u of units) { u.home = u.cell; u.homeAt = null; }
    }
    // 배치 변경은 fixture 작성 단계에만 허용. 이후 resize/모드 변경은 이 topology를 보존해야 한다.
    window.__edgeTopology = JSON.stringify(f.cells.map(c => [c.i, c.q, c.r, c.px, c.py, c.unit?.id ?? null]));
    window.__edgeRiskFight = f;
    return { t: f.t, paint: document.querySelector('#board').dataset.decorationBounds };
  });
  // 가상 시간 16ms 경과는 앱 RAF/paint 완료를 보장하지 않는다.
  // 주입 후 같은 전투의 step과 실제 render가 끝나 새 계측을 게시한 뒤 읽는다.
  // HOT/디버프/링의 존재·겹침 여부는 이 준비 조건에 넣지 않고 아래 assertion으로 그대로 검증한다.
  await page.waitForFunction(({ t, paint }) => window.__proto.F === window.__edgeRiskFight
    && window.__proto.F.t > t && document.querySelector('#board').dataset.decorationBounds !== paint,
  injected, { polling: 'raf', timeout: 8000 });
}

async function liveResize(page, profile, ok, label) {
  await page.click('#pauseBtn');
  await page.evaluate(() => {
    const f = window.__proto.F;
    window.__edgeFight = f;
    window.__edgeSnapshot = () => JSON.stringify({ t: f.t, mana: f.mana, cast: f.cast, queued: f.queued, gcd: f.gcd,
      party: f.party.map(u => [u.id, u.cell, u.hp, u.alive, u.hot, u.debuffs]), cd: f.cd, items: f.items, stats: f.stats });
    window.__edgeBeforeResize = window.__edgeSnapshot();
  });
  const states = [];
  for (const [width, height] of [[320, 640], [412, 915], [915, 412], [360, 880], [profile.width, profile.height]]) {
    await page.setViewportSize({ width, height }); await page.clock.runFor(120);
    const stable = await page.evaluate(() => window.__proto.F === window.__edgeFight && window.__edgeSnapshot() === window.__edgeBeforeResize);
    states.push({ width, height, stable });
    if (height > width) checkGeometry(await geometry(page), ok, `${label} resize ${width}×${height}`);
  }
  ok(states.every(s => s.stable), `${label}: live resize 왕복·가로 경유 후 세로 복귀에서 같은 전투 상태 보존(가로 UX 제외)`, states);
  await page.click('#resumeBtn'); await page.clock.runFor(120);
  await resetAction(page);
  const p = await targetPoint(page, 'right');
  await page.touchscreen.tap(p.x, p.y); await page.clock.runFor(16);
  ok(await page.evaluate(id => window.__proto.F.cast?.uid === id, p.id), `${label}: resize 복귀 뒤 새 canvas 좌표로 끝열 탭 가능`);
}

async function animatedEdges(page, ok, label, shots, shotKey) {
  // install()만으로는 실제 시간이 계속 흐른다. screenshot 저장 시간도 FX400ms에 더해지는 것을 방지한다.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('healer.save')).settings;
    window.__battle.settings({ ...settings, compactSkills: document.querySelector('#controls').classList.contains('compact-controls'), reducedEffects: false });
  });
  ok(await page.locator('#battle').evaluate(el => !el.classList.contains('reduced-effects')),
    `${label}: 가장자리 애니메이션 fixture는 효과 줄이기 꺼짐`);
  const samples = [];
  for (const deathSide of ['left', 'right']) {
    await resetAction(page); await page.clock.runFor(500); await resetAction(page);
    // pauseAt 직후 예약되어 있던 앱 RAF가 clock 시각보다 늦게 재개되는 경우를 먼저 동기화한다.
    // Date/performance의 증가만으로 통과시키지 않고 실제 엔진 한 틱을 요구한다. FX 주입·측정 기준은 그대로다.
    const beforeTick = await page.evaluate(() => window.__proto.F.t);
    let appTick = false;
    for (let attempt = 0; attempt < 20 && !appTick; attempt++) {
      await page.clock.runFor(100);
      appTick = await page.evaluate(t => window.__proto.F.t > t, beforeTick);
    }
    ok(appTick, `${label}: ${deathSide} FX 주입 전에 실제 앱 RAF·전투 한 틱 진행 확인`);
    if (!appTick) throw new Error(`${label}: 앱 RAF가 재개되지 않아 FX를 유효하게 주입할 수 없음`);
    const ids = await page.evaluate(side => {
      const f = window.__proto.F, ids = window.__edgeTargets;
      const dead = f.party.find(u => u.id === ids[side]);
      const healed = f.party.find(u => u.id === ids[side === 'left' ? 'right' : 'left']);
      // 기존 사건 소비 경로로 시각 효과를 재현하는 명시적 fixture. 자연 전투 사망/치유가 아니다.
      dead.alive = false; dead.hp = 0;
      healed.shield = 1.5; healed.guardian = 10;
      f.events.push({ type: 'heal', id: healed.id, eff: 123, amt: 123, crit: true }, { type: 'death', id: dead.id });
      return { dead: dead.id, healed: healed.id };
    }, deathSide);
    let elapsed = 0;
    for (const delta of [16, 128, 160]) {
      await page.clock.runFor(delta); elapsed += delta;
      const g = await geometry(page), bounds = g.decorations;
      checkDecorations(g, ok, `${label} ${deathSide} 사망 ${elapsed}ms`);
      const glow = bounds.filter(b => b.kind === 'glow' && b.key.startsWith(`heal-glow${ids.healed}-`));
      const death = bounds.filter(b => b.kind === 'fx' && b.key.startsWith(`death${ids.dead}-`));
      const shield = bounds.filter(b => b.key === `shield-inner${ids.healed}` || b.key === `shield-outer${ids.healed}`);
      ok(glow.length > 0 && death.length > 0 && shield.length === 2 && glow.every(b => Math.abs(b.w - b.h) < EPS),
        `${label}: ${deathSide} 끝열 사망·반대 끝열 발광/이중 보호막 실제 렌더 ${elapsed}ms`,
        { ids, glow, death, shield });
      samples.push({ deathSide, elapsed, ids, geometry: g });
      if (elapsed === 144) await page.screenshot({ path: `${shots}/board_edges_fx_${shotKey}_${deathSide}.png` });
    }
  }
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('healer.save')).settings;
    window.__battle.settings({ ...settings, compactSkills: document.querySelector('#controls').classList.contains('compact-controls'), reducedEffects: true });
  });
  await resetAction(page);
  await page.clock.resume();
  return samples;
}

async function leave(page) {
  await page.click('#pauseBtn'); await page.click('#quitBtn'); await page.click('#confirmApply');
  await page.clock.runFor(120); await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(80);
}

export default async function boardEdges(url, shots) {
  const browser = await chromium.launch(), errs = [], measurements = [];
  let fails = 0;
  const ok = (value, message, detail) => { console.log(`${value ? 'PASS' : 'FAIL'} ${message}`); if (!value) { fails++; if (detail) console.log(JSON.stringify(detail)); } };
  try {
    for (const profile of PROFILES) {
      const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, isMobile: true, hasTouch: true });
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      page.setDefaultTimeout(8000);
      page.on('pageerror', e => errs.push(`${profile.name}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') errs.push(`${profile.name}: ${m.text()}`); });
      try {
        await page.clock.install(); await page.goto(url); await page.clock.runFor(300); await pastTitle(page);
        for (const party of PARTIES) {
          await enter(page, party);
          for (const compact of [false, true]) {
            if (await page.locator('#controls').evaluate(el => el.classList.contains('compact-controls')) !== compact) await toggle(page);
            await resetAction(page);
            const label = `${profile.name} ${party.n}인 ${compact ? '축소' : '일반'}`;
            const g = await geometry(page), fits = checkGeometry(g, ok, label);
            checkDecorations(g, ok, label);
            await edgeInput(page, cdp, ok, label);
            await riskState(page);
            const risk = await geometry(page);
            checkDecorations(risk, ok, `${label} 위험 fixture`, true);
            const measurement = { profile, party: party.n, compact, geometry: g, fits, risk,
              fixture: '독립 저장. 극단 셀에 unit 배치, 18/29% HP·HOT·양대각 디버프·guardian/shield/beacon·마지막행 선택과 실제 치유 시전. 자연 플레이 아님.' };
            measurements.push(measurement);
            if (party.n === 20 || profile.name === 'Stress' && party.n === 3 || profile.name === 'Flip' && party.n === 10) await page.screenshot({ path: `${shots}/board_edges_${profile.name}_${party.n}_${compact ? 'compact' : 'normal'}.png` });
            if (profile.name === 'S24') await liveResize(page, profile, ok, label);
            if (party.n === 20 && ['S24', 'Stress'].includes(profile.name)) {
              measurement.animated = await animatedEdges(page, ok, label, shots, `${profile.name}_${compact ? 'compact' : 'normal'}`);
              measurement.animatedFixture = '효과 줄이기 끔. 양끝 사망/치유 사건·1.5초 보호막을 명시적으로 주입하고 16/144/304ms 실제 렌더 bounds 검사. 자연 플레이 아님.';
            }
          }
          await leave(page);
        }
      } catch (e) { errs.push(`${profile.name}: ${e.stack || e.message}`); }
      finally { await cdp.detach(); await context.close(); }
    }
  } finally { await browser.close(); }
  return { fails, errs, geometry: measurements, scope: '40 portrait combinations; landscape is recovery-only; all injected state isolated from personal saves.' };
}
