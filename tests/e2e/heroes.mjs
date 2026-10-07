// 힐러 직업 (25): 직업 목록·바꾸기, 입장 화면 해제 ✓/✕, 전투 휠·봉화
import { chromium } from 'playwright';
import { pastTitle, patchSave, toEntry, toParty } from './nav.mjs';

export default async function heroes(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  const text = sel => page.textContent(sel);
  const setHero = async h => { await page.evaluate(h => { const s = JSON.parse(localStorage.getItem('healer.save')); s.hero = h; localStorage.setItem('healer.save', JSON.stringify(s)); }, h); await page.reload(); await page.clock.runFor(300); await pastTitle(page); };
  /** 전투 판에서 그 파티원 칸 탭 */
  const tapUnit = async pick => {
    const bb = await page.locator('#board').boundingBox();
    const at = await page.evaluate(pick => { const ui = window.__proto; const u = ui.F.party.find(new Function('u', `return ${pick}`)); return { ...ui.center(u.cell), id: u.id }; }, pick);
    await page.mouse.move(bb.x + at.x, bb.y + at.y); await page.mouse.down(); await page.clock.runFor(60); await page.mouse.up(); await page.clock.runFor(60);
    return at.id;
  };
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // ---- Lv 9: 잠김 ----
  await patchSave(page, { player: { level: 9 }, settings: { devUnlock: false } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(await page.isDisabled('#s-char .chero [data-csub="hero"]') && /Lv 10에 열림/.test(await text('#s-char .chero')), 'Lv 9: 직업 바꾸기 잠김');

  // ---- Lv 10: 직업 목록 ----
  await patchSave(page, { player: { level: 10 }, settings: { devUnlock: false } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(/사제/.test(await text('#s-char .chero b')) && (await page.locator('#s-char .chero .ddot:not(.off)').count()) === 2, '직업 카드 = 사제, 해제 점 2개 (마법·질병)');
  await page.click('#s-char .chero [data-csub="hero"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char nav [data-csub="hero"]', 'aria-selected') === 'true' && (await page.locator('#s-char .hcard[data-hcard]').count()) === 3, '「직업 바꾸기」 = 직업 하위 탭, 직업 3종');
  ok(await page.isVisible('#s-char .hcard.now[data-hcard="priest"]'), '지금 직업 = 사제 표시');
  ok(/숲의 부름/.test(await text('#s-char [data-hcard="druid"] .hq')) && /0 \/ 1/.test(await text('#s-char [data-hcard="druid"] .hq')), '드루이드: 직업 퀘스트 0 / 1');
  ok(await page.isVisible('#s-char .hcard.locked[data-hcard="paladin"]') && /Lv 20/.test(await text('#s-char [data-hcard="paladin"]')), '성기사: Lv 20 잠김');
  ok(/업데이트 직업/.test(await text('#s-char')) && /주술사/.test(await text('#s-char')), '업데이트 직업 4종 안내');
  await page.screenshot({ path: `${shots}/heroes_list.png` });

  // ---- 드루이드로 바꾸기 ----
  await page.click('#s-char [data-hero="druid"]'); await page.clock.runFor(50);
  ok((await save()).hero === 'druid' && /드루이드/.test(await text('#s-char .chero b')), '드루이드로 바꿈 → 저장, 직업 카드');
  ok((await page.locator('#s-char .chero .ddot:not(.off)').count()) === 3, '드루이드 해제 점 3개 (마법·저주·독)');
  await page.click('#s-char nav [data-csub="skill"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .skc[data-skill="sprout"]') && (await page.locator('#s-char .skc[data-skill="heal"]').count()) === 0, '스킬 탭 = 드루이드 스킬');
  ok(/새싹/.test(await text('#s-char [data-tap="heal"]')), '칸 탭 기본 힐 = 새싹');
  await page.click('#s-char nav [data-csub="talent"]'); await page.clock.runFor(50);
  ok(/준비 중/.test(await text('#s-char .ns-body')), '드루이드 특성 = 준비 중');
  await page.screenshot({ path: `${shots}/heroes_druid_skill.png` });

  // ---- 입장 화면: 해제 ✓/✕ ----
  await patchSave(page, { settings: { devUnlock: true } });
  await toEntry(page, { content: 'abyss1', tab: 'raid' });
  const dis = await text('#s-entry .dispel');
  ok(/드루이드/.test(dis) && /질병 ✕/.test(dis) && /독 ✓/.test(dis), `역병 군주: 드루이드는 질병 ✕ · 독 ✓ (${dis.replace(/\s+/g, ' ').trim()})`);
  await page.screenshot({ path: `${shots}/heroes_entry.png` });
  await page.click('#s-entry .dispel [data-go="s-char"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-char') && await page.getAttribute('#s-char nav [data-csub="hero"]', 'aria-selected') === 'true', '입장 화면 「직업 바꾸기」 = 캐릭터 → 직업');

  // ---- 전투: 드루이드 휠 ----
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  await toParty(page, { content: 'rustfort' });
  await page.click('#depart'); await page.clock.runFor(3100 + 4000);
  ok(await page.evaluate(() => window.__proto.F.hero) === 'druid', '전투 = 드루이드');
  const wheel = await page.evaluate(() => [...document.querySelectorAll('#wheel .slot')].map(b => b.textContent).join(' '));
  ok(/새싹/.test(wheel) && /환생|환/.test(wheel), `휠에 드루이드 스킬 (${wheel.replace(/\s+/g, ' ').slice(0, 60)})`);
  const tid = await tapUnit("u.role === 'tank'");
  ok(await page.evaluate(id => window.__proto.F.party.find(u => u.id === id).hots.some(h => h.key === 'sprout'), tid), '칸 탭 = 새싹 (지속 힐)');
  await page.screenshot({ path: `${shots}/heroes_druid_battle.png` });

  // ---- 전투: 성기사 봉화 ----
  await setHero('paladin');
  await toParty(page, { content: 'rustfort' });
  await page.click('#depart'); await page.clock.runFor(3100 + 4000);
  ok(await page.evaluate(() => { const F = window.__proto.F; return F.hero === 'paladin' && F.beacon === F.party.find(u => u.role === 'tank').id; }), '성기사: 봉화는 처음에 탱커');
  await page.dispatchEvent('#core', 'pointerdown'); await page.clock.runFor(50);
  ok(await page.isVisible('#core.beacon'), '휠 가운데 = 봉화 지정 모드');
  const did = await tapUnit("u.role !== 'tank' && !u.me");
  ok(await page.evaluate(id => window.__proto.F.beacon === id, did) && !(await page.isVisible('#core.beacon')), '칸 탭 = 그 파티원에게 봉화');
  await page.dispatchEvent('#core', 'pointerdown'); await page.clock.runFor(50);
  ok(/봉화 바꾸기 대기/.test(await text('#toast')), '바로 다시 바꾸면 대기 안내');
  await page.screenshot({ path: `${shots}/heroes_paladin_battle.png` });

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
