// 새 브라우저 컨텍스트의 시험 저장만 사용한다. viewport 검증이며 실기기/자연 플레이 검증은 아니다.
// 상태 주입은 기존 __proto.F 훅과 독립 저장을 사용하며 각 fixture에 목적을 명시한다.
import { chromium } from 'playwright';
import { pastTitle, patchSave, toParty } from './nav.mjs';

const VIEWPORTS = [[320, 640], [360, 780], [412, 915], [360, 880]];
const PARTIES = [
  { n: 3, tab: 'explore', content: 'plateau' },
  { n: 5, tab: 'dungeon', content: 'rustfort' },
  { n: 10, tab: 'raid10', content: 'abyss1' },
  { n: 20, tab: 'raid20', content: 'cathedral1' },
];

const geometry = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const cv = document.querySelector('#board');
  const controls = document.querySelector('#controls');
  const cast = document.querySelector('#castbar'), style = getComputedStyle(cast), track = document.querySelector('#castTrack');
  const layoutParts = [...controls.querySelectorAll('#wheel,#side,#core,#items,#aux,#gauges,#wheel button,#items [data-item],#aux button')]
    .filter(visible).map(el => ({ key: el.id || el.dataset.slot || el.dataset.item || el.dataset.tal || `lock:${el.dataset.lock}`,
      tag: el.tagName, parent: el.parentElement.id, dir: el.dataset.dir || '',
      art: [...el.querySelectorAll('img.sic')].map(img => img.getAttribute('src')).join('|'),
      fonts: [...el.querySelectorAll('.nm,.ct,.cds')].map(part => getComputedStyle(part).fontSize).join('|'), ...box(el) }));
  return {
    board: box(cv), controls: box(controls), frame: box(document.querySelector('#controlsFrame')), cast: box(cast),
    scale: Number(controls.dataset.uiScale), baseHeight: Number(controls.dataset.baseControlHeight),
    effectiveTouchMin: Number(controls.dataset.effectiveTouchMin), layoutParts,
    minSkillText: Math.min(...[...controls.querySelectorAll('.slot .nm,.slot .ct,.slot.cooling .cds')]
      .filter(visible).map(el => parseFloat(getComputedStyle(el).fontSize) * Number(controls.dataset.uiScale))),
    directToggles: document.querySelectorAll('#compactToggle,#compactReturn').length,
    castState: { parent: cast.parentElement.id, position: style.position, pointerEvents: style.pointerEvents,
      visible: visible(cast), active: cast.classList.contains('is-casting'), track: box(track), trackVisible: visible(track) },
    stage: box(document.querySelector('#stage')),
    targetsGone: !document.querySelector('#targetsBtn,#partyTargets,#partyActions'),
    targetUiNodes: document.querySelectorAll('#targetsBtn,#partyTargets,#targetList,#targetsClose').length,
    toolbarButtons: document.querySelectorAll('#partyActions button,#castbar button').length,
    slots: [...document.querySelectorAll('#wheel button')].filter(visible).map(el => ({ ...box(el),
      hitW: Number(el.dataset.hitWidth), hitH: Number(el.dataset.hitHeight) })),
    cellW: Number(cv.dataset.cellWidth), cellH: Number(cv.dataset.cellHeight),
    hp: Number(cv.dataset.hpFontSize), nick: Number(cv.dataset.nickFontSize),
    hpTextGap: cv.dataset.hpTextMinNeighborGap === '' ? null : Number(cv.dataset.hpTextMinNeighborGap),
    hpTextBounds: JSON.parse(cv.dataset.hpTextBounds || '[]'),
    paintBottom: Number(cv.dataset.boardSafeBottom),
    compact: document.querySelector('#controls').classList.contains('compact-controls'),
    party: window.__proto.F.party.length, width: innerWidth, height: innerHeight,
  };
});

const savedCompact = page => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')).settings.compactSkills);
const time = page => page.evaluate(() => window.__proto.F.t);
const mode = page => page.locator('#controls').evaluate(el => el.classList.contains('compact-controls'));
// 전투판의 크기 버튼 대신 기존 일시정지 설정을 사용하며 원래 pause 상태를 복구한다.
async function toggleMode(page) {
  const paused = await page.isVisible('#pause');
  if (!paused) await page.click('#pauseBtn');
  await page.setChecked('#pauseCompact', !await mode(page));
  if (!paused) await page.click('#resumeBtn');
}
const inViewport = (r, g) => r.w > 0 && r.h > 0 && r.x >= -1 && r.right <= g.width + 1 && r.y >= 70 - 1 && r.bottom <= g.height + 1;
const readable = g => g.cellW > 0 && g.cellH > 0 && g.hp >= 12 && g.nick >= 11;
const hpBoundsValid = g => g.hpTextBounds.length === g.party
  && (g.hpTextGap === null || (Number.isFinite(g.hpTextGap) && g.hpTextGap >= 0))
  && g.hpTextBounds.every((a, i) => a.w > 0 && a.h > 0 && g.hpTextBounds.slice(i + 1).every(b =>
    Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2));
const apart = (a, b) => a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1;
const toolbarValid = g => g.directToggles === 0 && g.targetsGone && g.targetUiNodes === 0 && g.toolbarButtons === 0;
// 배율은 터치 44px을 지키기 위해 1일 수 있다. 순서·방향·부모·상대좌표는 같은 기본 배치여야 한다.
const uniformLayout = (normal, compact) => {
  const k = compact.scale, near = (a, b) => Math.abs(a - b) <= 1;
  return normal.scale === 1 && k >= .9 && k <= 1 && compact.effectiveTouchMin >= 44 - .1
    && normal.minSkillText >= 11.4 && compact.minSkillText >= 11.4
    && near(compact.controls.w, normal.controls.w * k) && near(compact.controls.h, normal.controls.h * k)
    && near(compact.frame.h, compact.baseHeight * k) && near(compact.baseHeight, normal.baseHeight)
    && normal.layoutParts.length === compact.layoutParts.length
    && normal.layoutParts.every((a, i) => {
      const b = compact.layoutParts[i];
      // 같은 구조/좌표를 축소하되 보조 글자는 실효 최소 크기로 읽기 가능하게 유지한다.
      return a.key === b.key && a.tag === b.tag && a.parent === b.parent && a.dir === b.dir && a.art === b.art
        && near(b.w, a.w * k) && near(b.h, a.h * k)
        && near(b.x - compact.controls.x, (a.x - normal.controls.x) * k)
        && near(b.y - compact.controls.y, (a.y - normal.controls.y) * k);
    });
};
const castSpaceValid = g => g.cast.h === (g.compact ? 26 : 44) && g.castState.track.h === (g.compact ? 24 : 32)
  && g.castState.parent === 'battle' && g.castState.position === 'relative' && g.castState.visible
  && g.board.bottom <= g.cast.y + 1 && g.cast.bottom <= g.frame.y + 1
  && Math.abs(g.board.h - g.paintBottom - 2) <= .1
  && (!g.compact || g.castState.pointerEvents === 'none') && g.castState.trackVisible === g.castState.active;

// 원화와 그 위의 작은 SVG 배지를 구분한다. decode 완료를 확인해 이미지 로딩 중을 시각 실패로 오인하지 않는다.
const skillVisuals = page => page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.querySelectorAll('#wheel img.sic')].map(img => img.decode().catch(() => undefined)));
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
    && Number(getComputedStyle(el).opacity) > 0;
  const contained = (el, parent) => {
    if (!el) return false;
    const a = box(el), b = box(parent);
    return a.w > 0 && a.h > 0 && a.x >= b.x - 1 && a.right <= b.right + 1 && a.y >= b.y - 1 && a.bottom <= b.bottom + 1;
  };
  // 버튼의 사각 bounds 안이어도 원의 모서리에서 글자가 잘릴 수 있다.
  // Range의 높이는 폰트의 빈 leading까지 포함한다(Noto Sans KR 11px의 Range는 16px).
  // Range는 가로 시작 위치에만 쓰고, 실제 baseline과 Canvas glyph metrics로 잉크를 측정한다.
  const inkContext = document.createElement('canvas').getContext('2d');
  const inkBox = el => {
    if (!el) return null;
    if (el.tagName.toLowerCase() === 'svg') return box(el);
    const style = getComputedStyle(el), text = el.textContent;
    const range = document.createRange(); range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    inkContext.font = style.font;
    inkContext.textBaseline = 'alphabetic';
    inkContext.textAlign = 'left';
    inkContext.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    inkContext.wordSpacing = style.wordSpacing === 'normal' ? '0px' : style.wordSpacing;
    inkContext.fontKerning = style.fontKerning;
    const metrics = inkContext.measureText(text);
    if (!metrics.width) return { x: r.x, y: r.y, w: 0, h: 0, right: r.x, bottom: r.y };
    const probe = document.createElement('span');
    probe.style.cssText = 'all:initial;display:inline-block;width:0;height:0;padding:0;border:0;margin:0;font-size:0;line-height:0;vertical-align:baseline;';
    el.append(probe);
    const baseline = probe.getBoundingClientRect().top;
    probe.remove();
    // 폰트의 실제 advance와 DOM Range의 비율은 compact/aim의 가로 transform을 포함한다.
    const scaleX = r.width / metrics.width;
    let scaleY = 1;
    for (let part = el; part; part = part.parentElement) {
      const transform = getComputedStyle(part).transform;
      if (transform !== 'none') { const m = new DOMMatrixReadOnly(transform); scaleY *= Math.hypot(m.c, m.d); }
    }
    const x = r.x - metrics.actualBoundingBoxLeft * scaleX;
    const right = r.x + metrics.actualBoundingBoxRight * scaleX;
    const y = baseline - metrics.actualBoundingBoxAscent * scaleY;
    const bottom = baseline + metrics.actualBoundingBoxDescent * scaleY;
    return { x, y, w: right - x, h: bottom - y, right, bottom };
  };
  const separated = (a, b) => {
    if (!a || !b) return false;
    const first = inkBox(a), second = inkBox(b);
    return first.right <= second.x + .5 || second.right <= first.x + .5
      || first.bottom <= second.y + .5 || second.bottom <= first.y + .5;
  };
  const inCircle = (r, circle) => !!r && !!circle && r.w > 0 && r.h > 0
    && [[r.x, r.y], [r.right, r.y], [r.x, r.bottom], [r.right, r.bottom]].every(([x, y]) =>
      Math.hypot(x - circle.cx, y - circle.cy) <= circle.radius + 1);
  const paintWeight = (el, slot) => {
    let weight = 1;
    for (let part = el; part; part = part.parentElement) {
      const s = getComputedStyle(part); weight *= Number(s.opacity);
      for (const match of s.filter.matchAll(/brightness\(([\d.]+)(%)?\)/g)) weight *= Number(match[1]) / (match[2] ? 100 : 1);
      if (part === slot) break;
    }
    return weight;
  };
  return [...document.querySelectorAll('#wheel button[data-slot],#wheel button[data-lock]')].map(el => {
    const img = el.querySelector('img.sic'), mark = el.querySelector('.skill-mark'), name = el.querySelector('.nm');
    const cost = el.querySelector('.ct'), timer = el.querySelector('.cds'), lock = el.querySelector('.slot-lock .lk');
    const inner = el.querySelector('.in'), ib = inner && box(inner), innerStyle = inner && getComputedStyle(inner);
    const circle = ib && { cx: ib.x + ib.w / 2, cy: ib.y + ib.h / 2, radius: Math.min(ib.w, ib.h) / 2 };
    const imageBox = img && box(img), imageStyle = img && getComputedStyle(img);
    const roundClipped = !!innerStyle && (innerStyle.clipPath.startsWith('circle(')
      || ['hidden', 'clip'].includes(innerStyle.overflowX) && ['hidden', 'clip'].includes(innerStyle.overflowY)
        && [innerStyle.borderTopLeftRadius, innerStyle.borderTopRightRadius, innerStyle.borderBottomLeftRadius, innerStyle.borderBottomRightRadius]
          .every(r => r === '50%' || !r.includes('%') && parseFloat(r) >= inner.clientWidth / 2 - 1));
    const textParts = [name, cost, ...(visible(timer) && timer.textContent.trim() ? [timer] : []), ...(visible(lock) ? [lock] : [])]
      .filter(Boolean).map(part => ({ part: part.classList.contains('lk') ? 'lock' : part.className,
        ink: inkBox(part), insideCircle: inCircle(inkBox(part), circle) }));
    const cooling = el.classList.contains('cooling'), locked = !!el.dataset.lock;
    return {
      slot: el.dataset.slot || el.dataset.lock, locked, cooling, label: el.getAttribute('aria-label'),
      resourceLow: el.classList.contains('resource-low'), circle, roundClipped, textParts,
      textInsideCircle: textParts.length >= 2 && textParts.every(part => part.insideCircle),
      costColor: cost && getComputedStyle(cost).color,
      artCount: el.querySelectorAll('img.sic').length, markCount: el.querySelectorAll('.skill-mark').length,
      art: img ? { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 && img.naturalHeight > 0,
        // cover 원화의 원래 사각형은 커도 된다. 실제 보이는 원형 마스크가 버튼 안이어야 한다.
        naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, visible: visible(img), inside: roundClipped && contained(inner, el),
        opacity: Number(imageStyle.opacity), paintWeight: paintWeight(img, el), filter: imageStyle.filter,
        cover: imageStyle.objectFit === 'cover', fillsInner: !!ib && imageBox.x <= ib.x + 1 && imageBox.y <= ib.y + 1
          && imageBox.right >= ib.right - 1 && imageBox.bottom >= ib.bottom - 1 } : null,
      fallback: !!mark && mark.tagName.toLowerCase() === 'svg' && visible(mark) && contained(mark, el),
      name: name?.textContent || '', cost: cost?.textContent || '', seconds: timer?.textContent || '',
      nameVisible: visible(name) && contained(name, el), lowerVisible: visible(cost) && contained(cost, el),
      // 상태에 따라 행 순서는 달라도 이름·비용·초·잠금의 실제 글자가 서로 가리면 안 된다.
      distinctRows: separated(name, cost),
      timerVisible: visible(timer) && contained(timer, el),
      timerDistinct: separated(timer, name) && separated(timer, cost),
      timerPaintWeight: timer ? paintWeight(timer, el) : 0,
      lockVisible: visible(lock) && contained(lock, el),
      lockDistinct: separated(lock, name) && separated(lock, cost),
    };
  });
});
// 현재 제공된 25개 스킬은 모두 원화가 있다. 누락 원화의 fallback 분기는 소스 보존으로 별도 확인한다.
const learnedArtValid = rows => rows.length > 0 && rows.every(r => !r.locked && r.artCount === 1 && r.markCount === 0
  && r.art?.loaded && r.art.visible && r.art.inside && r.art.cover && r.art.fillsInner && r.roundClipped && r.textInsideCircle
  && r.name.trim() && r.nameVisible && r.lowerVisible && r.distinctRows
  && /^(?:\d+(?:\.\d+)?%|힘\d\+?)$/.test(r.cost)
  && (!r.cooling || r.timerVisible && r.timerDistinct && /^\d+초$/.test(r.seconds) && /재사용 대기/.test(r.label)));
const lockedArtValid = rows => rows.length > 0 && rows.every(r => r.locked && r.artCount === 1 && r.markCount === 0
  && r.art?.loaded && r.art.visible && r.art.inside && r.art.opacity > 0 && r.art.opacity < 1
  && r.art.cover && r.art.fillsInner && r.roundClipped && r.textInsideCircle
  && r.name.trim() && r.nameVisible && r.lowerVisible && r.distinctRows && r.lockVisible && r.lockDistinct
  && /Lv \d+/.test(r.cost) && /잠김.*Lv \d+/.test(r.label));

async function enter(page, party, level = 100, compactSkills = false) {
  await patchSave(page, { player: { level }, settings: { compactSkills, auto: false, allSkills: false, devUnlock: true, sound: false, vibrate: false } });
  await pastTitle(page);
  await toParty(page, { ...party, diff: '쉬움' });
  await page.click('#depart');
  await page.clock.runFor(3400);
}

async function leave(page) {
  await page.click('#pauseBtn');
  await page.click('#quitBtn');
  await page.click('#confirmApply');
  await page.clock.runFor(100);
  await page.click('#s-settle [data-go="s-lobby"]');
  await page.clock.runFor(50);
}

// 같은 JS 이벤트 안에서 전환 전후를 비교해 프레임 경과에 따른 HP/마나 변화를 리셋으로 오인하지 않는다.
const toggleWithoutReset = page => page.evaluate(() => {
  const f = window.__proto.F;
  const snapshot = () => JSON.stringify({
    t: f.t, mana: f.mana, hp: f.party.map(u => [u.id, u.hp, u.alive]), cd: f.cd,
    gcd: f.gcd, cast: f.cast, queued: f.queued, bossHp: f.bossHp, stats: f.stats,
  });
  const before = snapshot();
  const paused = !document.querySelector('#pause').hidden;
  if (!paused) document.querySelector('#pauseBtn').click();
  const control = document.querySelector('#pauseCompact');
  control.click();
  if (!paused) document.querySelector('#resumeBtn').click();
  return { sameFight: window.__proto.F === f, sameState: before === snapshot(), compact: document.querySelector('#controls').classList.contains('compact-controls'), control: control.id };
});

// 휠은 pointerdown/up을 쓴다. 실제 touch API를 사용하여 축소 모드에서도 같은 입력 경로를 탄다.
async function tapSlot(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const r = await page.locator(selector).boundingBox();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.clock.runFor(40);
}

export default async function compactUi(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  const measurements = [];
  const variants = [];
  let fails = 0;
  const ok = (value, message, detail) => {
    console.log(`${value ? 'PASS' : 'FAIL'} ${message}`);
    if (!value) { fails++; if (detail) console.log(JSON.stringify(detail)); }
  };
  try {
    for (const [width, height] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.setDefaultTimeout(7000);
      page.on('pageerror', e => errs.push(`${width}×${height}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') errs.push(`${width}×${height}: ${m.text()}`); });
      try {
        await page.clock.install();
        await page.goto(url); await page.clock.runFor(300); await pastTitle(page);
        if (width === 320) variants.push(...await heroVariants(page, ok, shots));
        for (const party of PARTIES) {
          const tag = `${width}×${height} ${party.n}인`;
          await enter(page, party);
          const normal = await geometry(page);
          const normalControls = await controlGeometry(page);
          const normalArt = await skillVisuals(page);
          ok(!normal.compact && normal.party === party.n && readable(normal)
            && inViewport(normal.stage, normal) && inViewport(normal.board, normal) && inViewport(normal.controls, normal)
            && normal.board.bottom <= normal.cast.y + 1 && normal.cast.bottom <= normal.controls.y + 1
            && toolbarValid(normal) && castSpaceValid(normal) && usableControls(normalControls),
          `${tag}: 일반 모드 광고·판/HUD 경계·HP 12px/이름 11px·대상 버튼 없이 시전행 예약`, normal);

          const takeShot = party.n === 20 || (width === 360 && height === 780 && party.n === 5);
          if (takeShot) await page.screenshot({ path: `${shots}/compact_normal_${width}x${height}_${party.n}.png` });
          const switched = await toggleWithoutReset(page);
          await page.clock.runFor(40);
          ok(switched.sameFight && switched.sameState && switched.compact && await savedCompact(page) === true
            && await page.isChecked('#pauseCompact') && await page.locator('#compactToggle,#compactReturn').count() === 0,
          `${tag}: 축소 전환은 같은 전투·시간·HP·마나·쿨을 보존하고 저장`, switched);

          const compact = await geometry(page);
          const compactControls = await controlGeometry(page);
          const compactArt = await skillVisuals(page);
          measurements.push({ viewport: { width, height }, party: party.n, normal, compact, normalControls, compactControls, normalArt, compactArt });
          ok(compact.compact && readable(compact) && compact.controls.h <= normal.controls.h
            && compact.board.h > normal.board.h && compact.cellW >= normal.cellW - 0.1 && compact.cellH >= normal.cellH - 0.1
            && inViewport(compact.board, compact) && inViewport(compact.controls, compact)
            && compact.board.bottom <= compact.frame.y + 1 && uniformLayout(normal, compact)
            && castSpaceValid(compact) && toolbarValid(compact) && usableControls(compactControls)
            && compact.slots.every(r => r.hitW >= 44 - .1 && r.hitH >= 44 - .1 && inViewport(r, compact)),
          `${tag}: 같은 기본 배치/원화/글자 스타일의 균등 축소·44px 실제 hit·판 확장·시전 공간 유지`, { normal, compact, compactControls });
          ok(hpBoundsValid(normal) && hpBoundsValid(compact),
            `${tag}: 일반/축소 실제 HP 글자 bounds 비겹침·인접 간격 0px 이상`, { normal: normal.hpTextGap, compact: compact.hpTextGap });
          ok(learnedArtValid(normalArt) && learnedArtValid(compactArt)
            && usableControls(normalControls) && usableControls(compactControls),
          `${tag}: 일반/축소 원화 로드·영역 유지, 원화 위 기능 배지 없음·이름/비용 구분·버튼 hit 유지`,
          { normal: normalArt, compact: compactArt });
          if (takeShot) await page.screenshot({ path: `${shots}/compact_small_${width}x${height}_${party.n}.png` });

          // 대상 전용 UI는 제거되어야 한다. 상태만 준비하고 실제 board touch로 기본 치유 경로를 검사한다.
          const target = await page.evaluate(() => {
            const f = window.__proto.F, u = f.party.find(x => !x.me && x.alive);
            f.cast = null; f.queued = null; f.gcd = 0; f.g.p = 0; f.mana = 75;
            u.hp = u.max * 0.55;
            window.__directTargetFight = f;
            return { id: u.id, cell: u.cell, nick: u.nick, taps: f.stats.taps,
              point: window.__proto.center(u.cell), t: f.t };
          });
          ok(normal.targetUiNodes === 0 && compact.targetUiNodes === 0
            && normal.toolbarButtons === 0 && compact.toolbarButtons === 0,
          `${tag}: 일반/축소 대상 버튼·목록 없음, 빈자리에 대체 버튼 없음`);
          const board = await page.locator('#board').boundingBox();
          await page.touchscreen.tap(board.x + target.point.x, board.y + target.point.y);
          await page.clock.runFor(80);
          const chosen = await page.evaluate(t => ({
            sameFight: window.__proto.F === window.__directTargetFight,
            selected: window.__proto.F.cast?.key === 'heal' && window.__proto.F.cast?.uid === t.id,
            taps: window.__proto.F.stats.taps, t: window.__proto.F.t,
            noModal: !document.querySelector('dialog:modal'), pauseHidden: document.querySelector('#pause').hidden,
          }), target);
          ok(chosen.sameFight && chosen.selected && chosen.taps === target.taps + 1
            && chosen.t > target.t && chosen.noModal && chosen.pauseHidden,
          `${tag}: 보드 실제 탭 한 번이 같은 전투의 선택 대상에게 기본 치유 1회 시전`, chosen);

          // 대표 크기에서 상태·취소·재진입을 추가 검사. 행렬 전체를 불필요하게 반복하지 않는다.
          if (width === 360 && height === 780 && party.n === 5) {
            await featureCases(page, ok);
            await pauseModeReparenting(page, ok);
            await castSpaceCases(page, ok);
            await gestureCases(page, ok, shots);
            await reducedEffectsCase(page, ok, shots);
          }
          if (party.n === 20) await skillCircleStates(page, ok, shots);
          if (party.n === 20 && height !== 880) await noticeCases(page, ok);
          await leave(page);
        }
        if (width === 360 && height === 780) {
          await extraInputCases(page, ok);
          await persistenceAndLocks(page, ok);
        }
      } catch (e) {
        errs.push(`${width}×${height}: ${e.stack || e.message}`);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  return { fails, errs, geometry: measurements, variants };
}

// 원형 경계의 최솟값과 세 자리 CD를 실제 모바일 크기의 두 모드에서 검사한다.
// 준비/대기/부족/잠김은 독립 테스트 전투 상태 주입이며 자연 플레이로 주장하지 않는다.
async function skillCircleStates(page, ok, shots) {
  const originalMode = await mode(page);
  const saved = await page.evaluate(() => ({ level: window.__proto.F.level, width: innerWidth, height: innerHeight }));
  const fixture = async state => {
    await page.evaluate(state => {
      const f = window.__proto.F;
      f.cast = null; f.queued = null; f.channel = 0; f.gcd = 0; f.g.p = 0; f.g.s = 0;
      f.mana = state === 'low' ? 0 : 100;
      f.cd.purify = state === 'cooling' ? 6 : 0;
      f.cd.guardian = state === 'cooling' ? 90 : 0;
      f.cd.hymn = state === 'cooling' ? 180 : 0;
    }, state);
    await page.clock.runFor(120);
  };
  for (const compact of [false, true]) {
    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    const tag = `${saved.width}×${saved.height} ${compact ? '축소' : '일반'}`;
    await fixture('ready');
    const ready = await skillVisuals(page);
    ok(learnedArtValid(ready) && ready.every(r => !r.cooling && !r.resourceLow),
      `${tag}: 준비 스킬 원화는 내부 원 전체 cover·원형 마스크·모든 글자 실제 bounds 원 안`, ready);

    await fixture('cooling');
    const cooling = await skillVisuals(page), coolingRows = cooling.filter(r => r.cooling);
    const dimmed = coolingRows.length === 3 && coolingRows.every(r => {
      const before = ready.find(b => b.slot === r.slot);
      return before && r.art.src === before.art.src && r.art.paintWeight <= before.art.paintWeight * .55
        && r.timerPaintWeight >= .9 && r.timerVisible && r.timerDistinct;
    });
    ok(learnedArtValid(cooling) && dimmed && coolingRows.some(r => /^\d{3}초$/.test(r.seconds)),
      `${tag}: 1/2/3자리 쿨다운은 같은 원화가 준비보다 45% 이상 어둡고 초·이름·비용은 겹치거나 원 밖 잘림 없음`,
      { ready, cooling });
    await page.screenshot({ path: `${shots}/skill_circle_cooling_${saved.width}x${saved.height}_${compact ? 'small' : 'normal'}.png` });

    await fixture('low');
    const low = await skillVisuals(page), lowRows = low.filter(r => r.resourceLow);
    ok(learnedArtValid(low) && lowRows.length > 0 && lowRows.every(r => !r.cooling && !r.seconds
      && /마나 부족/.test(r.label) && r.costColor !== ready.find(b => b.slot === r.slot)?.costColor),
      `${tag}: 마나 부족은 비용 색·접근성 이름으로 구분, 쿨다운 숫자 없음·원화/필수 글자 원 안`, low);

    await page.evaluate(() => { window.__proto.F.level = 1; window.dispatchEvent(new Event('resize')); });
    await fixture('locked');
    const locked = await skillVisuals(page);
    ok(learnedArtValid(locked.filter(r => !r.locked)) && lockedArtValid(locked.filter(r => r.locked)),
      `${tag}: 잠김 원화/자물쇠/이름/Lv 전체가 원 안·자물쇠와 글자 비겹침`, locked);
    await page.screenshot({ path: `${shots}/skill_circle_locked_${saved.width}x${saved.height}_${compact ? 'small' : 'normal'}.png` });
    await page.evaluate(level => { window.__proto.F.level = level; window.dispatchEvent(new Event('resize')); }, saved.level);
    await fixture('ready');
  }
  if (await mode(page) !== originalMode) { await toggleMode(page); await page.clock.runFor(40); }
}

async function noticeCases(page, ok) {
  // 기존 msg 사건만 주입한다. 알림 DOM/수명은 실제 handleEvents → toast 경로가 만든다.
  // 최신 main은 파티 요약 줄을 제거하고 boardWrap 위의 비차단 알림을 유지한다.
  // 자연 전투 사건이 수명 검사를 대체하지 않도록 만료 구간만 기존 일시정지 UI를 사용한다.
  const originalMode = await mode(page);
  const noticeGeometry = () => page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
    const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
      && Number(getComputedStyle(el).opacity) > 0;
    const host = document.querySelector('#toast'), board = document.querySelector('#board');
    return {
      width: innerWidth, height: innerHeight, compact: document.querySelector('#controls').classList.contains('compact-controls'),
      board: box(board), cast: box(document.querySelector('#castbar')), frame: box(document.querySelector('#controlsFrame')),
      summaryNodes: document.querySelectorAll('#partyStatus,#partyAlive,#partyCondition,.board-instruction').length,
      host: { ...box(host), parent: host.parentElement.id, live: host.getAttribute('aria-live'),
        atomic: host.getAttribute('aria-atomic'), role: host.getAttribute('role'), pointerEvents: getComputedStyle(host).pointerEvents },
      notices: [...host.children].map(el => {
        const rect = box(el), point = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        return { ...rect, text: el.textContent, title: el.title, visible: visible(el),
          font: parseFloat(getComputedStyle(el).fontSize), pointerEvents: getComputedStyle(el).pointerEvents,
          point, boardReceivesPoint: document.elementFromPoint(point.x, point.y) === board };
      }),
    };
  });
  const nearBox = (a, b) => ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) <= .1);
  const inside = (r, bounds) => r.x >= bounds.x - .1 && r.right <= bounds.right + .1
    && r.y >= bounds.y - .1 && r.bottom <= bounds.bottom + .1;
  for (const compact of [false, true]) {
    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    await page.click('#pauseBtn');
    await page.clock.runFor(2301);
    const before = await noticeGeometry();
    await page.click('#resumeBtn');
    const fullText = '어둠의 집행자: 탱커에게 12345 피해 · 강력한 연속 공격에 대비하여 체력을 회복하세요';
    await page.evaluate(text => {
      window.__noticeFight = window.__proto.F;
      window.__proto.F.events.push({ type: 'msg', text: '첫 번째 알림' }, { type: 'msg', text: '두 번째 알림' }, { type: 'msg', text });
    }, fullText);
    await page.waitForFunction(text => window.__proto.F === window.__noticeFight
      && document.querySelector('#toast .toast:last-child')?.textContent === text,
    fullText, { polling: 'raf', timeout: 8000 });
    const shown = await noticeGeometry(), notices = shown.notices;
    const stable = ['board', 'cast', 'frame'].every(key => nearBox(before[key], shown[key]));
    ok(before.notices.length === 0 && shown.summaryNodes === 0 && stable
      && shown.host.parent === 'boardWrap' && shown.host.live === 'polite' && shown.host.atomic === 'true' && shown.host.role === 'status'
      && shown.host.pointerEvents === 'none' && notices.length === 2
      && notices[0].text === '두 번째 알림' && notices[1].text === fullText
      && notices.every(n => n.visible && n.title === n.text && n.font >= 12 && n.font <= 13
        && n.pointerEvents === 'none' && n.boardReceivesPoint && inside(n, shown.board)
        && inside(n, { x: 0, y: 70, right: shown.width, bottom: shown.height }))
      && notices[0].bottom <= notices[1].y + .1,
    `${shown.width}: ${compact ? '축소' : '일반'} 최신 알림 2개·전체 문구/접근성 유지·판/화면 안 비차단 겹침·배치 고정`, { before, shown });

    // 알림 중앙의 실제 touch가 가려진 canvas까지 전달되는지 확인한다.
    await page.evaluate(() => {
      const board = document.querySelector('#board');
      window.__noticeBoardInput = { down: 0, up: 0 };
      board.addEventListener('pointerdown', () => { window.__noticeBoardInput.down++; }, { capture: true, once: true });
      board.addEventListener('pointerup', () => { window.__noticeBoardInput.up++; }, { capture: true, once: true });
    });
    const point = notices.at(-1).point;
    await page.touchscreen.tap(point.x, point.y); await page.clock.runFor(40);
    const input = await page.evaluate(() => window.__noticeBoardInput);
    ok(input.down === 1 && input.up === 1,
      `${shown.width}: ${compact ? '축소' : '일반'} 알림 중앙 touch는 전투판에 down/up 각 1회 전달`, input);
    await page.click('#pauseBtn');
    await page.clock.runFor(2301);
    const after = await noticeGeometry();
    ok(after.notices.length === 0 && after.summaryNodes === 0
      && ['board', 'cast', 'frame'].every(key => nearBox(before[key], after[key])),
    `${shown.width}: ${compact ? '축소' : '일반'} 알림 2.3초 만료 뒤 전투판/시전/하단 위치 유지`, { before, after });
    await page.click('#resumeBtn');
  }
  if (await mode(page) !== originalMode) { await toggleMode(page); await page.clock.runFor(40); }
}

async function reducedEffectsCase(page, ok, shots) {
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('healer.save')).settings;
    window.__battle.settings({ ...settings, compactSkills: true, reducedEffects: true });
    // 자연 보스 페이즈를 기다리지 않고 같은 phase 이벤트 소비 경로로 핵심 경고를 검증한다.
    window.__proto.F.events.push({ type: 'phase', text: '광폭화' });
  });
  await page.clock.runFor(40);
  const banner = await page.locator('#banner').evaluate(el => ({
    show: el.classList.contains('show'), opacity: Number(getComputedStyle(el).opacity),
    text: el.textContent, reduced: document.querySelector('#battle').classList.contains('reduced-effects'),
  }));
  await page.screenshot({ path: `${shots}/compact_reduced_warning_360x780.png` });
  await page.clock.runFor(2700);
  const hidden = await page.locator('#banner').evaluate(el => !el.classList.contains('show') && Number(getComputedStyle(el).opacity) === 0);
  ok(banner.reduced && banner.show && banner.opacity === 1 && banner.text === '광폭화' && hidden,
    '360: 효과 줄이기에서도 광폭화 경고가 정적으로 보이고 2.6초 뒤 종료', { banner, hidden });
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('healer.save')).settings;
    window.__battle.settings({ ...settings, compactSkills: true });
  });
}

async function gestureCases(page, ok, shots) {
  // legacy-ui는 일반 모드 longpress, tutorial은 기본 ← 소생을 검사한다.
  // 여기서는 두 배치 사이의 동일 입력 계약과 전환 도중 취소를 비교한다.
  for (const compact of [false, true]) {
    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    await page.evaluate(() => { const f = window.__proto.F; f.cast = null; f.queued = null; f.gcd = 0; f.mana = 80; f.g.p = 0; });
    const name = compact ? '축소' : '일반', selector = '#wheel [data-slot="heal"]';
    const casts = await page.evaluate(() => JSON.stringify(window.__proto.F.stats.casts));
    const r = await page.locator(selector).boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
    await page.clock.runFor(600);
    const tip = await page.locator('#tip').evaluate(el => {
      const r = el.getBoundingClientRect(); return { shown: !el.hidden, text: el.textContent,
        inside: r.x >= 0 && r.right <= innerWidth + 1 && r.y >= 0 && r.bottom <= innerHeight + 1 };
    });
    await page.screenshot({ path: `${shots}/compact_tip_360x780_${compact ? 'small' : 'normal'}.png` });
    await page.mouse.up(); await page.clock.runFor(40);
    ok(tip.shown && tip.inside && /치유/.test(tip.text) && /마나/.test(tip.text)
      && await page.evaluate(b => JSON.stringify(window.__proto.F.stats.casts) === b && !window.__proto.F.cast && !window.__proto.F.queued, casts),
    `360: ${name} 모드 실제 길게 누르기는 화면 안 설명만 표시, 시전 없음`, tip);

    const pointer = { pointerId: 71, pointerType: 'touch', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    await page.dispatchEvent(selector, 'pointerdown', pointer);
    await page.dispatchEvent(selector, 'pointercancel', pointer); await page.clock.runFor(40);
    const cancelled = await page.getAttribute(selector, 'aria-pressed') === 'false';
    await page.dispatchEvent(selector, 'pointerdown', pointer);
    await toggleMode(page);
    await page.dispatchEvent('#wheel', 'pointerup', pointer); await page.clock.runFor(40);
    const safe = await page.evaluate(b => JSON.stringify(window.__proto.F.stats.casts) === b && !window.__proto.F.cast && !window.__proto.F.queued, casts);
    ok(cancelled && safe && await page.getAttribute(selector, 'aria-pressed') === 'false',
      `360: ${name} pointercancel 및 누른 채 모드 전환은 스킬 장전·오발동 없음`);

    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    const before = await page.evaluate(() => {
      const f = window.__proto.F, u = f.party.find(x => x.role === 'tank' && x.alive);
      f.cast = null; f.queued = null; f.gcd = 0; f.mana = 80; u.hot = 0;
      return { ...window.__proto.center(u.cell), id: u.id, count: f.stats.casts.renew || 0 };
    });
    const b = await page.locator('#board').boundingBox();
    await page.mouse.move(b.x + before.x, b.y + before.y); await page.mouse.down(); await page.clock.runFor(30);
    await page.mouse.move(b.x + before.x - 60, b.y + before.y, { steps: 5 }); await page.clock.runFor(30);
    await page.mouse.up(); await page.clock.runFor(40);
    const swipe = await page.evaluate(t => ({ count: window.__proto.F.stats.casts.renew || 0,
      hot: window.__proto.F.party.find(u => u.id === t.id).hot,
      direction: document.querySelector('#wheel [data-slot="renew"]').dataset.dir }), before);
    ok(swipe.hot > 0 && swipe.count === before.count + 1 && swipe.direction === 'W',
      `360: ${name} 모드도 같은 ← 쓸기로 소생 1회, 방향 유지`, swipe);
  }
}

const controlGeometry = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const root = document.querySelector('#controls');
  const parts = [...root.querySelectorAll('#wheel button, #items [data-item], #aux button, #core[role="button"], #giveUp')]
    .filter(visible)
    .map(el => {
      const r = box(el), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const hitW = Number(el.dataset.hitWidth) || r.w, hitH = Number(el.dataset.hitHeight) || r.h;
      const hit = { x: cx - hitW / 2, y: cy - hitH / 2, right: cx + hitW / 2, bottom: cy + hitH / 2 };
      const hits = [[cx, cy], [cx - 21.75, cy], [cx + 21.75, cy], [cx, cy - 21.75], [cx, cy + 21.75]]
        .every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
      return { id: el.id || el.dataset.slot || el.dataset.item || el.dataset.tal, ...r, hitW, hitH, hit, hits };
    });
  return { controls: box(root), parts, gauges: box(document.querySelector('#gauges')),
    gaugeVisible: visible(document.querySelector('#gauges')), tankDown: root.classList.contains('tank-down'),
    frame: box(document.querySelector('#controlsFrame')), scale: Number(root.dataset.uiScale),
    wheel: box(document.querySelector('#wheel')), side: box(document.querySelector('#side')),
    gaugeText: document.querySelector('#gauges').textContent,
    gaugeLabel: document.querySelector('#gauges').getAttribute('aria-label') || '',
    aux: root.querySelectorAll('#aux button').length,
    left: root.classList.contains('wheel-left'), giveUp: !document.querySelector('#giveUp').hidden,
    giveUpVisible: visible(document.querySelector('#giveUp')), toolsVisible: visible(document.querySelector('#compactToolsBtn')),
    visibleItems: [...root.querySelectorAll('#items > *')].filter(visible).length,
    visibleAux: [...root.querySelectorAll('#aux button')].filter(visible).length,
    extraItemsVisible: [...root.querySelectorAll('#items > :nth-child(n+3)')].some(visible) };
});

function usableControls(g, gaugeVisible = true) {
  const inside = r => r.x >= g.controls.x - 1 && r.right <= g.controls.right + 1
    && r.y >= g.controls.y - 1 && r.bottom <= g.controls.bottom + 1;
  const apart = (a, b) => a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1;
  const gaugeValid = g.gaugeVisible === gaugeVisible && (gaugeVisible ? inside(g.gauges)
    : g.tankDown && g.giveUpVisible && g.gauges.w === 0 && g.gauges.h === 0);
  return g.parts.every(r => r.hitW >= 44 - .1 && r.hitH >= 44 - .1 && r.hits && inside(r)) && gaugeValid
    && g.parts.every((a, i) => g.parts.slice(i + 1).every(b => apart(a, b)))
    && g.parts.every((a, i) => g.parts.slice(i + 1).every(b => apart(a.hit, b.hit)))
    && (!gaugeVisible || g.parts.every(r => apart(r, g.gauges)));
}

// 축소에서도 원래 버튼 전체가 같은 footer 안에 남아 있어야 한다. 별도 보조 창으로 숨기지 않는다.
async function inspectDirectControls(page, ok, label, expectGiveUp = false) {
  const g = await page.evaluate(() => {
    const f = window.__proto.F, root = document.querySelector('#controls');
    const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const buttons = [...root.querySelectorAll('#items [data-item],#aux [data-tal],#giveUp')].filter(visible);
    return {
      items: buttons.filter(b => b.dataset.item).map(b => b.dataset.item), expectedItems: Object.keys(f.items),
      talents: buttons.filter(b => b.dataset.tal).map(b => b.dataset.tal), expectedTalents: Object.keys(f.tx.act),
      giveUp: visible(document.querySelector('#giveUp')), toolsVisible: visible(document.querySelector('#compactToolsBtn')),
      sizes: buttons.map(b => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height,
        hitW: Number(b.dataset.hitWidth) || r.width, hitH: Number(b.dataset.hitHeight) || r.height,
        within: r.x >= 0 && r.right <= innerWidth + 1 && r.y >= 70 && r.bottom <= innerHeight + 1 }; }),
    };
  });
  ok(g.items.join() === g.expectedItems.join() && g.talents.join() === g.expectedTalents.join()
    && g.giveUp === expectGiveUp && !g.toolsVisible && g.sizes.every(r => r.hitW >= 44 - .1 && r.hitH >= 44 - .1 && r.within),
  label + ': 기존 패널에서 모든 아이템/특성/포기 직접 접근·44px hit·화면 내부 유지', g);
  await page.locator('#pauseBtn').focus(); await page.keyboard.press('Enter');
  const stopped = await time(page);
  await page.clock.runFor(120);
  const paused = await time(page) === stopped;
  await page.keyboard.press('Escape'); await page.clock.runFor(120);
  const restored = await page.evaluate(() => ({ time: window.__proto.F.t, focus: document.activeElement?.id,
    pauseHidden: document.querySelector('#pause').hidden }));
  ok(paused && restored.pauseHidden && restored.time > stopped && restored.focus === 'pauseBtn',
  label + ': 일시정지 설정 Escape는 시간·호출 버튼 초점 복구', { stopped, ...restored });
  return g;
}

async function heroVariants(page, ok, shots) {
  const out = [];
  const cases = [{ hero: 'priest' }, { hero: 'druid' }, { hero: 'paladin' }, { hero: 'paladin', synthetic: true }];
  for (const c of cases) {
    await page.evaluate(c => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.hero = c.synthetic ? 'priest' : c.hero;
      s.settings.hand = 'right';
      s.heroes.priest ||= { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0 };
      s.heroes.priest.talents = [null, null, null, null, 0, null, 1, null, null, 0];
      localStorage.setItem('healer.save', JSON.stringify(s));
    }, c);
    await enter(page, PARTIES[1], 100, false);
    // 엔진상 성기사에는 사제 보조 특성이 없다. 이 조합은 최대 부품 배치 압박용이며 자연 플레이로 주장하지 않는다.
    if (c.synthetic) {
      await page.evaluate(() => { window.__proto.F.hero = 'paladin'; window.dispatchEvent(new Event('resize')); });
      await page.clock.runFor(40);
    }
    const normal = await controlGeometry(page);
    const normalLayout = await geometry(page);
    const normalArt = await skillVisuals(page);
    await toggleMode(page); await page.clock.runFor(40);
    const compact = await controlGeometry(page);
    const compactLayout = await geometry(page);
    const compactArt = await skillVisuals(page);
    await page.screenshot({ path: `${shots}/compact_hero_${c.hero}${c.synthetic ? '_synthetic' : ''}_320x640.png` });
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('healer.save')).settings;
      window.__battle.settings({ ...settings, compactSkills: true, hand: 'left', hero: window.__proto.F.hero });
      window.dispatchEvent(new Event('resize'));
    });
    await page.clock.runFor(40);
    const left = await controlGeometry(page);
    await page.evaluate(() => {
      for (const u of window.__proto.F.party.filter(u => u.role === 'tank')) { u.hp = 0; u.alive = false; u.guardian = 0; }
    });
    await page.clock.runFor(80);
    const down = await controlGeometry(page);
    await page.screenshot({ path: `${shots}/compact_hero_${c.hero}${c.synthetic ? '_synthetic' : ''}_down_320x640.png` });
    // 기존 일반 UI는 탱커 전멸 시 게이지 자리에 포기를 표시한다. 같은 전멸 상태끼리 비교한다.
    await toggleMode(page); await page.clock.runFor(40);
    const normalDown = await controlGeometry(page);
    await toggleMode(page); await page.clock.runFor(40);
    const label = c.synthetic ? '성기사+3보조 synthetic' : { priest: '사제', druid: '드루이드', paladin: '성기사' }[c.hero];
    const tools = await inspectDirectControls(page, ok, `320: ${label} 탱커 전멸`, true);
    const g = { ...c, normal, compact, left, down, normalDown, tools, normalLayout, compactLayout, normalArt, compactArt };
    out.push(g);
    const gauge = c.synthetic || (c.hero === 'priest' ? /평온/.test(compact.gaugeText) && /신성화/.test(compact.gaugeText)
      : c.hero === 'druid' ? /새싹/.test(compact.gaugeText)
        : /힘/.test(compact.gaugeText) && /봉화/.test(compact.gaugeText) && /신성한 힘/.test(compact.gaugeLabel) && /봉화/.test(compact.gaugeLabel));
    const directControls = [compact, left, down].every(v => v.visibleItems === normal.visibleItems
      && v.visibleAux === normal.visibleAux && !v.toolsVisible);
    ok(compact.controls.h <= normal.controls.h && usableControls(normal) && usableControls(compact)
      && usableControls(left) && usableControls(normalDown, false) && usableControls(down, false)
      && normalDown.gaugeVisible === down.gaugeVisible && normalDown.giveUpVisible === down.giveUpVisible
      && gauge && left.left && left.wheel.x < left.side.x
      && down.giveUp && down.giveUpVisible && directControls && uniformLayout(normalLayout, compactLayout),
    `320: ${label} 같은 배치 균등 축소·왼손·탱커전멸 44px hit/비겹침/자원·직접 버튼 유지`, g);
    ok(learnedArtValid(normalArt) && learnedArtValid(compactArt),
      `320: ${label} 일반/축소 최소 스킬도 원화 전체 채움·모든 이름/비용 원형 내부 유지`, { normalArt, compactArt });
    await leave(page);
  }
  // 다음 fixture에 영향을 주지 않는다.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.hero = 'priest'; s.settings.hand = 'right'; s.heroes.priest.talents = [];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  return out;
}

async function featureCases(page, ok) {
  // 남아 있는 일시정지 설정은 keyboard 진입·취소 뒤 같은 전투와 초점을 복구한다.
  await page.locator('#pauseBtn').focus();
  await page.keyboard.press('Enter');
  const opened = await page.evaluate(() => {
    window.__escapePauseFight = window.__proto.F;
    const pause = document.querySelector('#pause');
    return { t: window.__proto.F.t, open: !pause.hidden,
      modal: pause.getAttribute('role') === 'dialog' && pause.getAttribute('aria-modal') === 'true' };
  });
  const t0 = opened.t;
  await page.clock.runFor(120);
  const stopped = await time(page);
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => ({ closed: document.querySelector('#pause').hidden,
    focus: document.activeElement?.id, sameFight: window.__proto.F === window.__escapePauseFight,
    t: window.__proto.F.t }));
  // 가상 시간 경과를 앱 tick 완료로 취급하지 않는다. 같은 판이 실제로 진행한 뒤 재개를 판정한다.
  const resumeError = await page.waitForFunction(t => window.__proto.F === window.__escapePauseFight
    && window.__proto.F.t > t, t0, { polling: 'raf', timeout: 8000 }).then(() => null, error => error.message);
  const resumedTime = await time(page);
  ok(opened.open && opened.modal && stopped === t0 && closed.closed && closed.sameFight
    && closed.focus === 'pauseBtn' && resumeError === null && resumedTime > t0,
  '360: 일시정지 Escape 취소는 동일 전투 재개·호출 버튼 초점 복구',
  { opened, stopped, closed, resumedTime, resumeError });

  await page.click('#pauseBtn');
  await page.click('#restartBtn');
  const nativeOpen = await page.locator('#battleConfirm').evaluate(el => el.open && el.matches(':modal'));
  await page.evaluate(() => {
    // 이 독립 페이지에서만 백그라운드 진입 이벤트를 만든 뒤 document.hidden 원래 getter를 즉시 복원한다.
    const original = Object.getOwnPropertyDescriptor(document, 'hidden');
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      if (original) Object.defineProperty(document, 'hidden', original);
      else delete document.hidden;
    }
  });
  const backgroundTime = await time(page);
  await page.clock.runFor(200);
  const backgroundPaused = await page.locator('#battleConfirm').evaluate(el => !el.open)
    && await page.isVisible('#pause') && await time(page) === backgroundTime;
  await page.click('#resumeBtn'); await page.clock.runFor(80);
  ok(nativeOpen && backgroundPaused && await time(page) > backgroundTime,
    '360: 재시작 확인 중 백그라운드 진입은 native 창 닫기·일시정지 유지, 계속에서만 시간 재개');

  await page.evaluate(() => { const f = window.__proto.F; f.cast = null; f.queued = null; f.gcd = 0; f.mana = 80; f.g.p = 0; });
  await tapSlot(page, '#wheel [data-slot="heal"]');
  const armed = await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'true';
  const off = await toggleWithoutReset(page); await page.clock.runFor(40);
  const kept = await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'true';
  await tapSlot(page, '#wheel [data-slot="heal"]');
  const cancelled = await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'false';
  ok(armed && kept && off.sameFight && off.sameState && !off.compact
    && cancelled,
  '360: 선택한 스킬은 모드 변경 뒤에도 유지, 같은 스킬 재탭으로 취소', { armed, kept, off, cancelled });
  await page.locator('#wheel [data-slot="heal"]').focus();
  await page.keyboard.press('Enter'); await page.clock.runFor(40);
  const keyboardArmed = await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'true';
  await page.keyboard.press('Space'); await page.clock.runFor(40);
  ok(keyboardArmed && await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'false',
    '360: 키보드 Enter로 치유 선택, Space로 한 번만 취소');

  // 재사용 대기와 자원 부족은 각 모드에서 서로 다른 상태로 표시되어야 한다.
  for (const compact of [false, true]) {
    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    await page.evaluate(() => { const f = window.__proto.F; f.cast = null; f.queued = null; f.gcd = 0; f.cd.purify = 6; f.mana = 0; f.g.p = 0; });
    await page.clock.runFor(40);
    const states = await page.evaluate(() => {
      const cd = document.querySelector('#wheel [data-slot="purify"]'), low = document.querySelector('#wheel [data-slot="flash"]');
      const timer = cd.querySelector('.cds');
      return {
        cooldown: cd.classList.contains('cooling') && /\d+초/.test(timer.textContent)
          && timer.getClientRects().length > 0 && getComputedStyle(timer).visibility !== 'hidden' && /재사용 대기/.test(cd.getAttribute('aria-label')),
        low: low.classList.contains('resource-low') && !low.classList.contains('cooling') && /마나 부족/.test(low.getAttribute('aria-label'))
          && /\d+(?:\.\d+)?%/.test(low.querySelector('.ct').textContent),
      };
    });
    ok(states.cooldown && states.low, `360: ${compact ? '축소' : '일반'} 모드에서 쿨다운 초·마나 부족 상태 구별`, states);
    const visuals = await skillVisuals(page), cooldown = visuals.filter(r => r.slot === 'purify');
    ok(cooldown.length === 1 && cooldown[0].cooling && learnedArtValid(visuals)
      && /^\d+초$/.test(cooldown[0].seconds),
    `360: ${compact ? '축소' : '일반'} 쿨다운 원화·이름·남은 초 유지, 작은 기능 배지는 없음`, visuals);
  }

  // 재시작/포기 확인은 취소에 초점을 두고, 취소 중 전투를 초기화하거나 종료하지 않는다.
  await page.click('#pauseBtn');
  for (const action of ['restartBtn', 'quitBtn']) {
    const before = await page.evaluate(() => {
      window.__compactConfirmFight = window.__proto.F;
      const f = window.__proto.F;
      return JSON.stringify({ t: f.t, mana: f.mana, hp: f.party.map(u => u.hp) });
    });
    await page.click(`#${action}`); await page.clock.runFor(120);
    const prompt = await page.locator('#battleConfirm').evaluate(el => ({
      native: el instanceof HTMLDialogElement, modal: el.matches(':modal'), focused: document.activeElement?.id,
    }));
    if (action === 'restartBtn') await page.keyboard.press('Escape');
    else await page.click('#confirmCancel');
    const cancelled = await page.evaluate(b => {
      const f = window.__proto.F;
      return f === window.__compactConfirmFight && !document.querySelector('#battleConfirm').open
        && !document.querySelector('#pause').hidden && !f.over
        && b === JSON.stringify({ t: f.t, mana: f.mana, hp: f.party.map(u => u.hp) });
    }, before);
    ok(prompt.native && prompt.modal && prompt.focused === 'confirmCancel' && cancelled,
      `360: ${action === 'restartBtn' ? '재시작 Escape' : '포기 취소'}는 취소 기본 초점·전투 상태 보존`, prompt);
  }
  const was = await savedCompact(page);
  await page.setChecked('#pauseCompact', !was); await page.clock.runFor(40);
  ok(await savedCompact(page) === !was && await mode(page) === !was
    && await page.isChecked('#pauseCompact') === !was && await page.locator('#compactToggle,#compactReturn').count() === 0,
  '360: 일시정지 checkbox·저장 설정이 함께 바뀌고 전투판 크기 버튼은 없음');
  await page.click('#resumeBtn'); await page.clock.runFor(40);
}

async function pauseModeReparenting(page, ok) {
  if (await mode(page)) { await toggleMode(page); await page.clock.runFor(40); }
  for (const compact of [true, false]) {
    await page.click('#pauseBtn');
    await page.locator('#pauseCompact').focus();
    await page.evaluate(() => {
      window.__pauseModeFight = window.__proto.F;
      window.__pauseModeSnapshot = () => {
        const f = window.__proto.F;
        return JSON.stringify({ t: f.t, hp: f.party.map(u => [u.id, u.hp, u.alive]), mana: f.mana,
          cast: f.cast, queued: f.queued, cd: f.cd, gcd: f.gcd, bossHp: f.bossHp, stats: f.stats });
      };
      window.__pauseModeBefore = window.__pauseModeSnapshot();
    });
    await page.keyboard.press('Space'); await page.clock.runFor(80);
    const changed = await page.evaluate(() => {
      const cast = document.querySelector('#castbar'), skill = document.querySelector('#wheel [data-slot="heal"]');
      const before = document.activeElement?.id;
      skill.focus(); // 일시정지 중 직접 focus도 배경으로 빠져나갈 수 없다.
      return { compact: document.querySelector('#controls').classList.contains('compact-controls'), before,
        after: document.activeElement?.id, paused: !document.querySelector('#pause').hidden,
        castParent: cast.parentElement.id, castInert: !!cast.closest('[inert]'),
        controlsInert: !!document.querySelector('#controls').closest('[inert]'),
        sameFight: window.__proto.F === window.__pauseModeFight,
        sameState: window.__pauseModeBefore === window.__pauseModeSnapshot() };
    });
    await page.keyboard.press('Tab');
    const trapped = await page.evaluate(() => document.querySelector('#pause').contains(document.activeElement));
    ok(changed.compact === compact && changed.paused && changed.before === 'pauseCompact' && changed.after === 'pauseCompact'
      && changed.castParent === 'battle' && changed.castInert && changed.controlsInert
      && changed.sameFight && changed.sameState && trapped && await savedCompact(page) === compact,
    '360: 설정 ' + (compact ? '축소' : '일반') + ' 전환은 동일 전투·시전·자원·checkbox 초점·행/패널 inert 유지', changed);
    await page.keyboard.press('Escape'); await page.clock.runFor(80);
    const resumed = await page.evaluate(() => ({
      castInert: !!document.querySelector('#castbar').closest('[inert]'),
      controlsInert: !!document.querySelector('#controls').closest('[inert]'),
      focus: document.activeElement?.id, paused: !document.querySelector('#pause').hidden,
      directToggles: document.querySelectorAll('#compactToggle,#compactReturn').length,
    }));
    await page.evaluate(() => { const f = window.__proto.F; f.cast = null; f.queued = null; f.gcd = 0; f.mana = 80; f.g.p = 0; });
    await page.locator('#wheel [data-slot="heal"]').focus();
    await page.keyboard.press('Enter'); await page.clock.runFor(40);
    const armed = await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'true';
    await page.keyboard.press('Space'); await page.clock.runFor(40);
    const cancelled = await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'false';
    ok(!resumed.castInert && !resumed.controlsInert && !resumed.paused && resumed.focus === 'pauseBtn'
      && resumed.directToggles === 0 && armed && cancelled
      && await page.locator('#targetsBtn,#partyTargets,#targetList,#targetsClose').count() === 0,
    '360: ' + (compact ? '축소' : '일반') + ' 복귀 뒤 inert 해제·스킬 키보드 장전/취소·대상 UI 없음', { ...resumed, armed, cancelled });
  }
}

async function castSpaceCases(page, ok) {
  // 렌더 상태 fixture: 시작/연속 시전·취소 상태를 주입하고 완료만 엔진 tick으로 진행한다.
  // 자연 플레이의 시전 취소 조작을 재현했다고 주장하지 않는다.
  const nearBox = (a, b) => ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) <= .1);
  for (const compact of [false, true]) {
    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('#wheel [aria-pressed="true"]')) el.click();
      const f = window.__proto.F; f.cast = null; f.queued = null; f.channel = 0; f.gcd = 0; f.mana = 100;
    });
    await page.clock.runFor(120);
    const baseline = await geometry(page), samples = [];
    for (const phase of ['idle', 'start', 'complete', 'start-again', 'cancel', 'repeat-heal', 'repeat-flash', 'gcd']) {
      await page.evaluate(phase => {
        const f = window.__proto.F, u = f.party.find(x => x.alive && !x.me);
        f.queued = null; f.channel = 0; f.gcd = phase === 'gcd' ? .7 : 0;
        if (['idle', 'cancel', 'gcd'].includes(phase)) f.cast = null;
        else f.cast = { key: phase === 'repeat-flash' ? 'flash' : 'heal', uid: u.id, cell: u.cell,
          left: phase === 'complete' ? .001 : 1, total: 1 };
      }, phase);
      await page.clock.runFor(120);
      const g = await geometry(page);
      const active = !['idle', 'complete', 'cancel', 'gcd'].includes(phase);
      const footerClear = g.layoutParts.every(r => apart(r, g.cast));
      const reserved = castSpaceValid(g);
      const stable = ['board', 'controls', 'frame', 'cast'].every(k => nearBox(baseline[k], g[k]));
      samples.push({ phase, active: g.castState.active, rowVisible: g.castState.visible, trackVisible: g.castState.trackVisible,
        board: g.board, controls: g.controls, cast: g.cast, reserved, footerClear, stable });
      ok(stable && reserved && footerClear && g.castState.active === active
        && g.castState.visible && g.castState.trackVisible === active,
      `360: ${compact ? '축소' : '일반'} ${phase} 시전 공간·판/패널 위치 고정·자원/버튼 침범 없음`, samples.at(-1));
    }
    await page.evaluate(() => { const f = window.__proto.F; f.cast = null; f.queued = null; f.channel = 0; f.gcd = 0; });
    await tapSlot(page, '#wheel [data-slot="heal"]');
    const armed = await geometry(page);
    ok(await page.getAttribute('#wheel [data-slot="heal"]', 'aria-pressed') === 'true'
      && !armed.castState.active && !armed.castState.trackVisible && castSpaceValid(armed)
      && ['board', 'controls', 'frame', 'cast'].every(k => nearBox(baseline[k], armed[k]))
      && armed.layoutParts.every(r => apart(r, armed.cast)),
    `360: ${compact ? '축소' : '일반'} 스킬 장전만으로 시전 막대가 나타나거나 예약 공간이 움직이지 않음`, armed.castState);
    await tapSlot(page, '#wheel [data-slot="heal"]');
  }
}

async function extraInputCases(page, ok) {
  // 실제 게임 저장과 분리된 fixture: Lv 100의 쉼터·정점, 아이템 네 개로 접근·단일 touch 처리 검증.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.heroes.priest.talents = [null, null, null, null, null, null, 1, null, null, 0];
    s.items = ['mana', 'life', 'cleanse', 'shield'];
    s.bag = { ...s.bag, mana: 10, life: 10, cleanse: 10, shield: 10 };
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await enter(page, PARTIES[1], 100, true);
  const tools = await inspectDirectControls(page, ok, '360: 네 아이템·보조 특성');
  ok(tools.items.join() === 'mana,life,cleanse,shield'
    && await page.isVisible('#items [data-item="cleanse"]') && await page.isVisible('#items [data-item="shield"]'),
  '360: 세 번째·네 번째 아이템도 원래 패널에서 직접 접근 가능');
  const potionBefore = await page.evaluate(() => {
    const f = window.__proto.F; f.mana = 20; f.items.mana = 2; f.potCd = 0;
    return f.itemLog.filter(x => x.key === 'mana').length;
  });
  await tapSlot(page, '#items [data-item="mana"]');
  const potion = await page.evaluate(() => {
    const f = window.__proto.F;
    return { uses: f.itemLog.filter(x => x.key === 'mana').length, left: f.items.mana, mana: f.mana,
      toast: document.querySelector('#toast').textContent };
  });
  ok(potion.uses === potionBefore + 1 && potion.left === 1 && potion.mana >= 50 && potion.mana < 52
    && !/재사용 대기/.test(potion.toast), '360: 물약 실제 touch 한 번은 사용 기록 +1·수량 −1, 후속 click 중복 없음', potion);

  const cleanseBefore = await page.evaluate(() => {
    const f = window.__proto.F, u = f.party.find(x => x.alive && !x.me);
    u.debuffs = [{ id: 8501, name: '축소 버튼 검증 독', type: '독', left: 12 }];
    return f.itemLog.filter(x => x.key === 'cleanse').length;
  });
  await tapSlot(page, '#items [data-item="cleanse"]');
  const cleanse = await page.evaluate(() => ({ count: window.__proto.F.itemLog.filter(x => x.key === 'cleanse').length,
    left: window.__proto.F.items.cleanse, debuff: window.__proto.F.party.some(u => u.debuffs.some(d => d.id === 8501)),
    closed: !document.querySelector('#compactToolsDialog')?.open }));
  ok(cleanse.count === cleanseBefore + 1 && cleanse.left === 0 && !cleanse.debuff && cleanse.closed,
    '360: 세 번째 아이템 직접 touch 한 번으로 해제·수량 차감 1회', cleanse);
  await tapSlot(page, '#items [data-item="shield"]');
  const shieldArmed = await page.locator('#items [data-item="shield"]').evaluate(el => el.classList.contains('armed'));
  await tapSlot(page, '#items [data-item="shield"]');
  ok(shieldArmed && await page.locator('#items [data-item="shield"]').evaluate(el => !el.classList.contains('armed'))
    && !await page.isVisible('#compactToolsDialog'),
    '360: 네 번째 대상형 아이템도 직접 선택·재탭 취소 가능');

  // 보조 기술에는 별도 영구 사용 로그가 없어, 프레임이 소비하기 전 성공 msg 이벤트를 참조별로 센다.
  // 이벤트를 읽기만 하고 게임의 큐·함수는 바꾸지 않는다.
  await page.evaluate(() => {
    const seen = new Set();
    window.__compactTalentUses = 0;
    const capture = () => {
      for (const event of window.__proto.F.events) {
        if (event.type === 'msg' && event.text.startsWith('기도의 정점:') && !seen.has(event)) {
          seen.add(event); window.__compactTalentUses++;
        }
      }
    };
    for (const id of ['aux']) {
      document.getElementById(id).addEventListener('pointerup', capture);
      document.getElementById(id).addEventListener('click', capture);
    }
  });
  await tapSlot(page, '#aux [data-tal="zenith"]');
  const aux = await page.evaluate(() => ({ uses: window.__compactTalentUses, state: window.__proto.F.tx.act.zenith,
    toast: document.querySelector('#toast').textContent }));
  ok(aux.uses === 1 && aux.state.used && aux.state.left > 19 && aux.state.cd > 179
    && !await page.isVisible('#compactToolsDialog')
    && !/재사용 대기|효과 중/.test(aux.toast), '360: 보조 기술 실제 touch 한 번은 성공 이벤트 1회·활성 상태 유지', aux);
  await tapSlot(page, '#aux [data-tal="shelter"]');
  const shelterArmed = await page.locator('#aux [data-tal="shelter"]').evaluate(el => el.classList.contains('armed'));
  await tapSlot(page, '#aux [data-tal="shelter"]');
  ok(shelterArmed && await page.locator('#aux [data-tal="shelter"]').evaluate(el => !el.classList.contains('armed'))
    && !await page.isVisible('#compactToolsDialog'),
    '360: 대상형 보조 기술도 직접 touch 한 번으로 장전, 재탭 한 번으로 취소');
  await leave(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.items = ['mana', 'life'];
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
}

async function persistenceAndLocks(page, ok) {
  await enter(page, PARTIES[1], 1, true);
  ok(await mode(page) && await savedCompact(page) === true
    && await page.locator('#wheel [data-lock="purify"]').count() === 1,
  '360: 새 전투 재진입 시 축소 설정 복원, Lv 1의 미학습 스킬 잠금 유지');
  for (const compact of [false, true]) {
    if (await mode(page) !== compact) { await toggleMode(page); await page.clock.runFor(40); }
    const visuals = await skillVisuals(page), g = await geometry(page);
    ok(learnedArtValid(visuals.filter(r => !r.locked)) && lockedArtValid(visuals.filter(r => r.locked))
      && g.slots.every(r => r.hitW >= 44 - .1 && r.hitH >= 44 - .1 && inViewport(r, g)),
    `360: ${compact ? '축소' : '일반'} Lv 1 잠긴 칸도 흐린 원화 1개 로드·영역 유지, 기능 배지 없이 이름/자물쇠/Lv·44px hit 유지`, visuals);
  }
  const before = await page.evaluate(() => { const f = window.__proto.F; return { mana: f.mana, casts: JSON.stringify(f.stats.casts) }; });
  await tapSlot(page, '#wheel [data-lock="purify"]');
  const locked = await page.evaluate(() => ({ text: document.querySelector('#toast').textContent,
    cast: window.__proto.F.cast, casts: JSON.stringify(window.__proto.F.stats.casts) }));
  ok(/Lv 3/.test(locked.text) && !locked.cast && locked.casts === before.casts,
    '360: 축소 모드의 잠긴 스킬 탭은 해금 레벨 안내만 표시하고 시전하지 않음', locked);

  await page.click('#pauseBtn'); await page.click('#restartBtn');
  await page.evaluate(() => { window.__compactRestartFight = window.__proto.F; });
  await page.click('#confirmApply'); await page.clock.runFor(80);
  ok(await page.evaluate(() => window.__proto.F !== window.__compactRestartFight && window.__proto.F.t < 0.2
      && window.__proto.pullLeft > 0 && !document.querySelector('#battleConfirm').open)
    && await mode(page) && await savedCompact(page) === true,
  '360: 재시작 확인을 눌렀을 때만 새 전투·카운트다운 시작, 축소 설정 유지');
  await page.clock.runFor(3400);
  await leave(page);
  await page.click('#s-lobby .tb-set');
  ok(await page.isChecked('#s-settings [data-tog="compactSkills"]'), '360: 전투 밖 설정에서도 축소 상태가 표시됨');
  await page.setChecked('#s-settings [data-tog="compactSkills"]', false);
  ok(!await savedCompact(page) && !await page.isChecked('#s-settings [data-tog="compactSkills"]'),
    '360: 일반 설정에서 해제하면 같은 저장키에 즉시 저장');
  await page.setChecked('#s-settings [data-tog="compactSkills"]', true);
  ok(await savedCompact(page) && await page.isChecked('#s-settings [data-tog="compactSkills"]'),
    '360: 일반 설정에서 축소를 다시 켜면 즉시 저장');
  await page.reload(); await page.clock.runFor(300); await pastTitle(page);
  await toParty(page, { content: 'rustfort', diff: '쉬움' });
  await page.click('#depart'); await page.clock.runFor(3400);
  ok(await savedCompact(page) === true && await mode(page)
    && await page.isChecked('#pauseCompact') && await page.locator('#compactToggle,#compactReturn').count() === 0,
  '360: 페이지 reload 뒤에도 저장된 축소 모드로 전투 시작');
}
