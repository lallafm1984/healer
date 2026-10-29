// 한국어 스냅샷 (기획 121 2장, 2026-10-29 Lim 「지금 한국어 UI는 1px도 깨지지 않게」): 난수 · 시계를 고정하고 화면마다 #app HTML의 SHA-256을
// tests/e2e/snapshots/ko-ui.json과 비교한다 (#viewport = 보이는 화면 + 하단 탭 + 팝업, 숨긴 화면의 묵은 내용은 뺌). 기준은 다국어 전 main (#531) 빌드에서 뜬 것 (설정은 언어 판을 더한 1단계 PR). 모든 PR이 통과해야 한다.
// 한국어 글을 일부러 바꾼 PR만 I18N_SNAPSHOT=write E2E_ONLY=한국어 node scripts/e2e.mjs 로 기준을 다시 뜨고 PR에 까닭을 적는다.
// 틀리면 실제 HTML을 tests/e2e/shots/i18n-<화면>.html에 둔다 (기준 HTML은 기준 빌드에서 같은 명령으로 다시 뜸).
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chooseContent, departGo, killEnemies, openDiff } from './nav.mjs';

const FILE = fileURLToPath(new URL('./snapshots/ko-ui.json', import.meta.url));

/** 화면마다 달라질 수 있는 것만 지움: 전환 연출 클래스 (xf-*), 누르는 연출 (tapfx), 진행 중 애니메이션 inline style은 두지 않음 */
function tidy(html) {
  return html
    .replace(/https?:\/\/127\.0\.0\.1:\d+\//g, '/') // 미리보기 서버 포트 (E2E_PORT)가 그림 주소에 들어감
    .replace(/ ?\bxf-[a-z0-9-]+/g, '')
    .replace(/<div id="tapfx"[^>]*>.*?<\/div>/gs, '')
    .replace(/ class=""/g, '');
}

export default async function i18nKo(url, shots) {
  const write = process.env.I18N_SNAPSHOT === 'write';
  const base = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  const got = {};
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  // 난수 고정 (mulberry32): 공개모집 · 행상인 · 구간 적 · 마을이 매번 같게
  await ctx.addInitScript(() => {
    let a = 0x9e3779b9;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.__villageMotion = false;
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const snap = async name => {
    const html = tidy(await page.evaluate(() => {
      const v = document.getElementById('viewport').cloneNode(true);
      v.querySelectorAll('.screen[hidden]').forEach(s => { s.innerHTML = ''; }); // 숨긴 화면에 남은 지난 내용은 보지 않음
      return v.innerHTML;
    }));
    const hash = createHash('sha256').update(html).digest('hex');
    got[name] = { hash, len: html.length };
    if (write) { ok(true, `${name}: ${html.length}자 ${hash.slice(0, 12)}`); return; }
    const b = base[name];
    const same = b && b.hash === hash;
    if (!same) writeFileSync(`${shots}/i18n-${name}.html`, html);
    ok(same, `${name}: 한국어 HTML ${b ? (same ? '같음' : `다름 (기준 ${b.len}자 → ${html.length}자, ${shots}/i18n-${name}.html)`) : '기준 없음'}`);
  };
  const click = async (sel, ms = 100) => { await page.click(sel); await page.clock.runFor(ms); };
  const save = fn => page.evaluate(fn);
  const reload = async () => { await page.reload(); await page.clock.runFor(300); if (await page.isVisible('#s-title')) await click('#titleStart'); if (await page.isVisible('#s-story')) await click('#tutSkip'); };

  await page.clock.install({ time: new Date(2026, 9, 7, 12) });
  await page.goto(url); await page.clock.runFor(300);
  await snap('title');
  await click('#titleStart');
  await snap('story');
  await click('#tutSkip');
  await snap('lobby-new');

  // Lv 40 · 골드 · 장비 · 길드 (길드원 넷, Lv 5) · 주간 도전 열림 · 임무 진행
  await save(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.level = 40; s.player.xp = 1234; s.player.gold = 123456; s.chalOpen = 4;
    const it = (id, slot, grade, name) => ({ id, slot, grade, name, ilv: 38, lines: [] });
    s.gear.equipped = { head: it(101, 'head', '희귀', '희귀 머리'), chest: it(102, 'chest', '희귀', '희귀 가슴'), weapon: it(103, 'weapon', '고급', '고급 무기') };
    s.gear.bag = [it(201, 'hands', '일반', '일반 손'), it(202, 'ring', '고급', '고급 반지'), it(203, 'neck', '희귀', '희귀 목걸이'), it(204, 'weapon', '영웅', '영웅 무기')];
    s.gear.seen = 202;
    s.guild.founded = true; s.guild.storySeen = true; s.guild.fame = 225; s.guild.nextId ||= 1; s.guild.members ||= [];
    for (const [nick, cls, pers, ab] of [['든든방패', 'warrior', '고집불통', 'warrior.intervene'], ['뒤통수전문', 'rogue', '신중파', 'rogue.kick'], ['불꽃남자', 'mage', '신중파', 'mage.blink'], ['딜미터1등', 'archer', '신중파', 'archer.snipe']])
      s.guild.members.push({ id: s.guild.nextId++, nick, cls, pers, ab, lv: 30, xp: 0, stats: {}, lastStatGains: [], learn: 10, steady: 10, sxp: 0, votes: [], boost: 0, runs: 0, joined: 0 });
    s.daily.day = ''; s.weekly.week = '';
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await reload();
  await save(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.daily.missions.forEach((m, i) => { m.n = i < 2 ? 99 : 1; }); localStorage.setItem('healer.save', JSON.stringify(s)); });
  await reload();
  await snap('lobby');

  // 전투 탭 셋 + 출전 창 · 편성 둘 · 전투 · 정비 · 결과
  await click('#tabs [data-tab="battle"]');
  await snap('content-explore');
  await click('#s-content [data-ctab="dungeon"]', 50);
  await chooseContent(page, 'rustfort');
  await snap('content-dungeon');
  await click('#s-content [data-ctab="raid10"]', 50);
  await snap('content-raid10');
  await click('#s-content [data-ctab="raid20"]', 50);
  await snap('content-raid20');
  await click('#s-content [data-ctab="dungeon"]', 50);
  await chooseContent(page, 'rustfort');
  await click('#contentGo');
  await snap('party-public');
  await click('#s-party [data-mode="guild"]');
  await snap('party-guild');
  await click('#s-party [data-mode="public"]');
  await departGo(page);
  await page.clock.runFor(1500);
  await snap('battle');
  // 구간마다 적 체력을 0으로 → 정비 (첫 번만 스냅샷) → 「계속」 → … → 결과. 정비 → 전투 사이에는 __proto.F가 아직 없을 수 있어 있을 때만
  for (let i = 0; i < 30 && !(await page.isVisible('#s-settle')); i++) {
    if (await page.isVisible('#rest')) { if (!got.rest) await snap('rest'); await click('#restGo', 3500); continue; }
    if (await page.evaluate(() => !!window.__proto?.F)) await killEnemies(page);
    await page.clock.runFor(1500);
  }
  ok(await page.isVisible('#s-settle'), '전투 → 결과 화면');
  await page.clock.runFor(3000);
  await snap('result');

  // 로비 → 주간 도전 · 임무 · 상점 · 행상인 · 설정
  await reload();
  await click('#s-lobby .lb-chal');
  await snap('entry');
  await click('#s-entry .tb-back');
  await click('#s-lobby .lb-missions .lb-main');
  await snap('missions-daily');
  await click('#s-missions [data-mission-tab="weekly"]', 50);
  await snap('missions-weekly');
  await click('#s-missions .tb-back');
  await click('#s-lobby .lb-shop');
  await snap('shop');
  await click('#s-shop .tb-back');
  await click('#s-lobby .lb-merchant');
  await snap('merchant');
  await click('#s-merchant .tb-back');
  await click('#s-lobby .tb-set');
  await snap('settings');
  await click('#s-settings .tb-back');

  // 캐릭터 넷 + 장비 상세 · 길드 셋
  await click('#tabs [data-tab="char"]');
  await snap('char-gear');
  await click('#s-char [data-gitem="203"]', 50);
  await snap('char-gear-detail');
  await page.keyboard.press('Escape'); await page.clock.runFor(50);
  await click('#s-char [data-csub="skill"]', 50);
  await snap('char-skill');
  await click('#s-char [data-csub="talent"]', 50);
  await snap('char-talent');
  await click('#s-char [data-csub="hero"]', 50);
  await snap('char-hero');
  await click('#tabs [data-tab="guild"]');
  await snap('guild-home');
  await click('#s-guild .subtabs [data-sub="members"]', 50);
  await snap('guild-members');
  await click('#s-guild .subtabs [data-sub="recruit"]', 50);
  await snap('guild-recruit');

  if (write) { writeFileSync(FILE, JSON.stringify(got, null, 1) + '\n'); console.log(`기준 ${Object.keys(got).length}장 → ${FILE}`); }
  await browser.close();
  return { fails, errs };
}
