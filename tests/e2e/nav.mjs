// 새 화면 흐름 도우미: 타이틀 → 로비 → 콘텐츠 → 난이도·입장 → 편성 (09 S01~S05)

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

export async function toEntry(page, { content = 'rustfort', tab = 'dungeon', diff } = {}) {
  if (await page.isVisible('#s-title')) { await page.click('#s-title'); await page.clock.runFor(100); }
  if (!(await page.isVisible('#s-content'))) { await page.click('#lobbyStart'); await page.clock.runFor(100); }
  await page.click(`#s-content [data-ctab="${tab}"]`); await page.clock.runFor(50);
  await page.click(`#s-content [data-content="${content}"]`); await page.clock.runFor(100);
  if (diff) { await page.click(`#s-entry [data-diff="${diff}"]`); await page.clock.runFor(50); }
}

export async function toParty(page, opts) {
  await toEntry(page, opts);
  await page.click('#entryGo'); await page.clock.runFor(100);
}

/** 편성 화면에서 고른 소비 아이템 */
export const pickedItems = page => page.evaluate(() => [...document.querySelectorAll('#s-party [data-item][aria-pressed="true"]')].map(b => b.dataset.item).join());

/** 전투 중 남은 적 체력을 거의 0으로 → 다음 틱에 구간 끝 */
export const killEnemies = page => page.evaluate(() => { const F = window.__proto.F; if (F.mobs.length) F.mobs.forEach(m => { m.hp = 0.01; }); F.bossHp = 0.01; });
