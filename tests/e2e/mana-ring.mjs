// 독립 저장/상태 fixture. 화면·입력 회귀이며 실기기나 자연 성장 플레이 검수가 아니다.
import { chromium } from 'playwright';
import { pastTitle, patchSave, toParty } from './nav.mjs';

const snap = page => page.evaluate(() => {
  const f = window.__proto.F, core = document.querySelector('#core'), meter = core.querySelector('.mana-meter');
  return { mana: f.mana, text: document.querySelector('#manaNum').firstChild.textContent,
    fill: core.style.getPropertyValue('--m'), aria: meter.getAttribute('aria-valuenow'),
    low: core.classList.contains('low'), empty: core.classList.contains('mana-empty'), full: core.classList.contains('mana-full'),
    paint: getComputedStyle(meter, '::after').backgroundImage, opacity: getComputedStyle(meter, '::after').opacity,
    casts: f.stats.casts.renew || 0, potions: f.items.mana, potionUses: f.itemLog.length };
});
const aligned = s => s.text === String(Math.floor(s.mana)) && s.fill === `${s.text}%` && s.aria === s.text;
const prepare = async (page, mana) => {
  // 이전 0마나 실패에서 선택 상태가 유지될 수 있다. 같은 버튼 재탭으로 취소한 뒤 독립 사례를 시작한다.
  for (const selected of await page.locator('#wheel [data-slot][aria-pressed="true"]').all()) await selected.tap();
  await page.clock.runFor(50);
  await page.evaluate(mana => {
    const f = window.__proto.F;
    Object.assign(f, { mana, cast: null, queued: null, channel: 0, gcd: 0, potCd: 0,
      events: [], tels: [], zones: [], dmgMult: 0, symbol: 0, symbolUsed: true, medit: 0 });
    f.gear.regen = 0; f.bossHp = f.bossMax;
    for (const k in f.cd) f.cd[k] = 0;
    f.skills.forEach(s => { s.next = 9999; });
    f.party.forEach(u => Object.assign(u, { hp: u.max * .5, alive: true, hots: [], hot: 0, debuffs: [], moving: null, dps: 0, acc: 0 }));
  }, mana);
  await page.clock.runFor(100);
};
const renew = async page => {
  await page.locator('#wheel [data-slot="renew"]').tap();
  await page.clock.runFor(50);
  const at = await page.evaluate(() => {
    const f = window.__proto.F, p = window.__proto.center(f.party.find(u => u.role === 'tank').cell);
    const r = document.querySelector('#board').getBoundingClientRect(); return { x: r.x + p.x, y: r.y + p.y };
  });
  await page.touchscreen.tap(at.x, at.y); await page.clock.runFor(100);
};

export default async function run(url, shots) {
  const browser = await chromium.launch(), errs = []; let fails = 0;
  const check = (name, pass, data) => { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' ' + JSON.stringify(data)}`); if (!pass) fails++; };
  try {
    for (const [width, height] of [[360, 780], [320, 640]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage(); page.on('pageerror', e => errs.push(String(e)));
      await page.clock.install(); await page.clock.pauseAt(Date.now() + 100);
      await page.goto(url + '?renderer=canvas'); await page.clock.runFor(300); await pastTitle(page);
      await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, allSkills: false, compactSkills: false, sound: false, vibrate: false, reducedEffects: true } });
      await pastTitle(page); await toParty(page, { tab: 'raid20', content: 'cathedral1', diff: '쉬움' });
      await page.click('#depart'); await page.clock.runFor(6500);
      for (const mode of ['normal', 'compact']) {
        if (mode === 'compact') { await page.click('#pauseBtn'); await page.setChecked('#pauseCompact', true); await page.click('#resumeBtn'); }
        const key = `${width} ${mode}`;
        for (const value of [0, 25, 50, 75, 100, 19.9, 20, 99.9]) {
          await prepare(page, value); const s = await snap(page);
          check(`${key} 마나 ${value} 숫자·호·접근성 값 일치`, aligned(s) && s.low === (value < 20), s);
          if (value === 0) check(`${key} 0 채움 잔상 없음`, s.empty && s.opacity === '0', s);
          if (value === 100) check(`${key} 100 시작점 이음새 없는 단색 채움`, s.full && s.paint === 'none', s);
          if (value === 99.9) check(`${key} 99.9는 가득 참으로 올리지 않음`, !s.full && s.text === '99', s);
        }
        await prepare(page, 50); const before = await snap(page); await renew(page); const spent = await snap(page);
        check(`${key} 실제 소생 터치 1회 소비와 호 감소`, spent.casts === before.casts + 1 && spent.mana === 47 && aligned(spent), spent);
        await page.evaluate(() => { window.__proto.F.gear.regen = 1; }); await page.clock.runFor(2000); const recovered = await snap(page);
        check(`${key} 자연 회복과 호 증가`, recovered.mana > spent.mana && aligned(recovered), recovered);
        await prepare(page, 21); await renew(page); const low = await snap(page);
        check(`${key} 소비로 저마나 경계 진입`, low.mana === 18 && low.low && aligned(low), low);
        await page.evaluate(() => { window.__proto.F.gear.regen = 1; }); await page.clock.runFor(5000); const safe = await snap(page);
        check(`${key} 회복으로 저마나 색 해제`, safe.mana >= 20 && !safe.low && aligned(safe), safe);
        await prepare(page, 90); await page.evaluate(() => { window.__proto.F.items.mana = 2; }); await page.clock.runFor(100);
        const potionBefore = await snap(page); await page.locator('#items [data-item="mana"]').tap(); await page.clock.runFor(100); const potionAfter = await snap(page);
        check(`${key} 물약 1회 소비·100 상한·호 가득`, potionAfter.potions === potionBefore.potions - 1 && potionAfter.potionUses === potionBefore.potionUses + 1 && potionAfter.mana === 100 && potionAfter.full && aligned(potionAfter), potionAfter);
        await prepare(page, 0); const zeroBefore = await snap(page); await renew(page); const zeroAfter = await snap(page);
        check(`${key} 0에서 유료 스킬 실패 후 음수·잔상 없음`, zeroAfter.mana === 0 && zeroAfter.casts === zeroBefore.casts && zeroAfter.opacity === '0' && aligned(zeroAfter), zeroAfter);
        await page.screenshot({ path: `${shots}/mana-ring-${width}-${mode}.png` });
      }
      await ctx.close();
    }
  } catch (e) { errs.push(e.stack || String(e)); }
  finally { await browser.close(); }
  return { fails, errs };
}
