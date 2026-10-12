// 새 화면 흐름 도우미: 타이틀 → 로비 → 전투 탭(모험 선택·난이도) → 편성 (09 S01~S05, 27 1장)

/** 저장을 고쳐 넣고 다시 읽음 (레벨·단축칸 등). 화면은 타이틀부터 */
export async function patchSave(page, patch) {
  await page.evaluate(p => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    Object.assign(s.player, p.player || {});
    if (p.items) s.items = p.items;
    if (p.settings) Object.assign(s.settings, p.settings);
    localStorage.setItem('healer.save', JSON.stringify(s));
  }, patch);
  await page.reload();
  await page.clock.runFor(300);
}

/** 타이틀을 누름. 새 저장이면 튜토리얼 이야기가 나오니 건너뛰기 (개발 빌드) */
export async function pastTitle(page) {
  if (await page.isVisible('#s-title')) { await page.click('#s-title'); await page.clock.runFor(100); }
  if (await page.isVisible('#s-story')) { await page.click('#tutSkip'); await page.clock.runFor(100); }
}

/**
 * 탐험 · 던전 난이도 사슬 (61 1-1): 그 장소 앞 난이도를 깬 기록을 저장에 넣고 다시 읽음 (화면은 타이틀부터).
 * 저장이 아직 없으면 (첫 화면 전) 아무것도 안 함
 */
export async function openDiff(page, content, diff) {
  const done = await page.evaluate(([k, d]) => {
    const raw = localStorage.getItem('healer.save');
    if (!raw) return false;
    const s = JSON.parse(raw), all = ['쉬움', '보통', '어려움', '악몽'];
    s.clears[k] ||= {};
    for (const x of all.slice(0, all.indexOf(d))) s.clears[k][x] ||= { stars: 1, grade: 'B', best: 999, n: 1 };
    localStorage.setItem('healer.save', JSON.stringify(s));
    return true;
  }, [content, diff]);
  if (done) { await page.reload(); await page.clock.runFor(300); }
  return done;
}

/** 장소 줄 (2026-10-12 Lim: 지역 팝업 없이 한 단계): 지금 분류에 보이는 장소 key, 줄 순서 (= 열림 레벨 순) */
export const rowContentKeys = page => page.locator('#s-content .b-regions [data-content]').evaluateAll(els => els.map(el => el.dataset.content));

/** 지금 분류의 장소 줄에서 그 장소를 바로 고른다. 모든 진입 테스트가 같은 경로를 쓴다. 레벨이 모자라 숨긴 장소면 에러 */
export async function chooseContent(page, content) {
  const card = page.locator(`#s-content .b-regions [data-content="${content}"]`);
  if (!(await card.count())) throw new Error(`지금 분류의 장소 줄에 없음 (레벨이 모자라 숨겼거나 다른 분류): ${content}`);
  await card.click(); await page.clock.runFor(50);
}

/** 화면 안에 보이는 그림만 다 그려질 때까지 기다림. 장소 줄의 화면 밖 카드는 lazy라 decode가 안 끝남 */
export const shownImagesReady = (page, selector = '#s-content img') => page.locator(selector).evaluateAll(imgs => Promise.all(imgs.filter(i => {
  const r = i.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
}).map(i => i.decode().catch(() => {}))));

/** 전투 탭: 분류 → 장소 → (난이도) → 「출전」 = 편성 화면. 난이도가 사슬로 잠겼으면 앞 난이도 기록을 넣고 다시 */
export async function toParty(page, { content = 'rustfort', tab = 'dungeon', diff } = {}, again = true) {
  await pastTitle(page);
  if (!(await page.isVisible('#s-content'))) { await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100); }
  await page.click(`#s-content [data-ctab="${tab}"]`); await page.clock.runFor(50);
  await chooseContent(page, content);
  if (diff) {
    const sel = `#s-content [data-diff="${diff}"]`;
    if (again && await page.isDisabled(sel) && /깨기/.test(await page.textContent(sel)) && await openDiff(page, content, diff)) return toParty(page, { content, tab, diff }, false);
    await page.click(sel); await page.clock.runFor(50);
  }
  await page.click('#contentGo'); await page.clock.runFor(100);
}

/** 편성의 실제 단축칸 순서대로 고른 소비 아이템 (시트 열림 여부와 무관). */
export const pickedItems = page => page.evaluate(() => [...document.querySelectorAll('#s-party .f-slots .f-item[data-slot]')]
  .sort((a, b) => Number(a.dataset.slot) - Number(b.dataset.slot)).map(b => b.dataset.slotItem).filter(Boolean).join());

/** 전투 중 남은 적 체력을 거의 0으로 → 다음 틱에 구간 끝 */
// 파티원 공격은 한 방씩이라 (최대 2초 간격) 체력을 0으로 바로 만듦. 다음 틱에 이김
export const killEnemies = page => page.evaluate(() => { const F = window.__proto.F; if (F.mobs.length) F.mobs.forEach(m => { m.hp = 0; m.alive = false; }); F.bossHp = 0; });
