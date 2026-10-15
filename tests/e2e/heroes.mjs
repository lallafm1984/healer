// 힐러 직업: 일곱 직업 목록 · 상세 시트 · 무료 전환, 편성 권장 레벨, 전투 휠·봉화
import { chromium } from 'playwright';
import { departGo, pastTitle, patchSave, toParty } from './nav.mjs';

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
  // 저장을 바로 고쳐 직업을 바꿈 (직업별 레벨이라 그 직업 레벨도 Lv 10으로, 34 3장)
  const setHero = async h => { await page.evaluate(h => { const s = JSON.parse(localStorage.getItem('healer.save')); s.hero = h; s.player.level = 10; localStorage.setItem('healer.save', JSON.stringify(s)); }, h); await page.reload(); await page.clock.runFor(300); await pastTitle(page); };
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

  // ---- 캐릭터 하나에서 Lv 10 드루이드 해금, 성기사는 Lv 20에 해금 ----
  await patchSave(page, { player: { level: 10 }, settings: { devUnlock: false } });
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  ok(/사제/.test(await text('#s-char .topbar .tb-cls')), '위 줄 = 사제');
  await page.click('#s-char nav [data-csub="hero"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-char nav [data-csub="hero"]', 'aria-selected') === 'true' && (await page.locator('#s-char .c7-hc[data-hcard]').count()) === 7 && (await page.locator('#s-char .c7-job-row .emblem').count()) === 7, '직업 하위 탭 = 선택 가능한 7종 (주술사 Lv 30 · 수도사 Lv 40 · 점성술사 Lv 50 · 결계사 Lv 60, 79), 공통 문장 7개');
  ok(await page.isVisible('#s-char .c7-hc.now[data-hcard="priest"]') && /현재 직업/.test(await text('#s-char [data-hcard="priest"]')) && (await page.locator('#s-char .c7-job-sheet').count()) === 0, '사제 현재 직업 강조, 첫 목록에는 상세가 열리지 않음');
  await page.click('#s-char [data-hcard="priest"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-job-sheet[role="dialog"]') && /치유를 쌓아/.test(await text('#s-char #jobDetailIntro')), '현재 직업 상세 = 짧은 소개와 스킬 카드');
  ok((await page.locator('#s-char .c7-job-skill').count()) === 9 && /마법·질병 해제/.test(await text('#s-char .c7-job-skill-grid')), '사제 스킬 8종과 성언: 평온 요약 (82: 신성화 없앰)');
  ok((await page.locator('#s-char .c7-job-gear, #s-char [data-hsk]').count()) === 0 && await page.isDisabled('#s-char .c7-hcta'), '장비 수집·펼치기 제거, 현재 직업은 전환 불가');
  await page.click('#s-char .c7-dialog-close'); await page.clock.runFor(50);
  ok(await page.evaluate(() => document.activeElement?.getAttribute('data-hcard') === 'priest'), '상세 닫기 → 열었던 직업 행으로 포커스 복귀');
  ok(!(await page.isVisible('#s-char .c7-hc.locked[data-hcard="druid"]')) && await page.isVisible('#s-char .c7-hc.locked[data-hcard="paladin"]') && (await page.locator('#s-char [data-hero]:not([disabled])').count()) === 0 && !/퀘스트/.test(await text('#s-char .c7-jobs')), '드루이드 해금 · 성기사 잠김 (직업 퀘스트 없음)');
  await page.click('#s-char [data-hcard="paladin"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char [data-hero="paladin"]').count()) === 0 && await page.isDisabled('#s-char .c7-hcta') && /Lv 20/.test(await text('#s-char .c7-hcta')), '성기사 상세: 바꾸기 없음, 잠긴 버튼 = Lv 20 달성');
  await page.click('#s-char .c7-dialog-close'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-jobs-upcoming').count()) === 0, '79 직업 4종을 모두 켜서 「곧 열림」 목록 없음');
  ok(await page.isVisible('#s-char .c7-hc.locked[data-hcard="shaman"]') && /Lv 30/.test(await text('#s-char [data-hcard="shaman"]')), '주술사는 Lv 30 해금 (잠김)');
  ok(await page.isVisible('#s-char .c7-hc.locked[data-hcard="monk"]') && /Lv 40/.test(await text('#s-char [data-hcard="monk"]')), '수도사는 Lv 40 해금 (잠김)');
  ok(await page.isVisible('#s-char .c7-hc.locked[data-hcard="astrologer"]') && /Lv 50/.test(await text('#s-char [data-hcard="astrologer"]')), '점성술사는 Lv 50 해금 (잠김)');
  ok(await page.isVisible('#s-char .c7-hc.locked[data-hcard="warder"]') && /Lv 60/.test(await text('#s-char [data-hcard="warder"]')), '결계사는 Lv 60 해금 (잠김)');
  await page.screenshot({ path: `${shots}/heroes_list.png` });

  // ---- 같은 캐릭터에서 드루이드로 무료 전환 ----
  const beforeSwitch = await save();
  await page.click('#s-char [data-hcard="druid"]'); await page.clock.runFor(50);
  ok(/드루이드로 전환/.test(await text('#s-char [data-hero="druid"]')), '드루이드 상세: 「드루이드로 전환」');
  ok((await save()).hero === 'priest', '직업 행 선택만으로 전환하지 않음');
  await page.screenshot({ path: `${shots}/heroes_druid_card.png` });

  // ---- 드루이드로 전환 ----
  await page.click('#s-char [data-hero="druid"]'); await page.clock.runFor(50);
  ok((await save()).hero === 'druid' && /드루이드/.test(await text('#s-char .topbar .tb-cls')) && await page.isVisible('#s-char .c7-hc.now[data-hcard="druid"]'), '드루이드로 바꿈 → 저장, 위 줄·지금 직업 깃발');
  const sv = await save();
  ok(sv.player.level === 10 && sv.player.xp === beforeSwitch.player.xp && sv.player.gold === beforeSwitch.player.gold && sv.roster.cur === beforeSwitch.roster.cur && sv.roster.chars.length === beforeSwitch.roster.chars.length, '직업 전환: 공통 레벨·경험치·골드·캐릭터 유지');
  ok(/현재 직업/.test(await text('#s-char [data-hcard="druid"]')) && /전환 가능/.test(await text('#s-char [data-hcard="priest"]')), '전환 후 현재 직업과 전환 가능 상태 갱신');
  await page.click('#s-char [data-hcard="druid"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-char .c7-job-skill').count()) === 8 && /마법·저주·독 해제/.test(await text('#s-char .c7-job-skill-grid')), '드루이드 스킬 8종 및 해제 요약');
  ok(await page.isDisabled('#s-char .c7-hcta') && /현재 직업/.test(await text('#s-char .c7-hcta')), '전환 후 현재 직업 버튼 비활성');
  await page.click('#s-char .c7-dialog-close'); await page.clock.runFor(50);
  await page.click('#s-char nav [data-csub="gear"]'); await page.clock.runFor(50);
  ok(/드루이드/.test(await page.getAttribute('#s-char .topbar .tb-em .emblem', 'aria-label')) && /드루이드/.test(await text('#s-char .topbar .tb-cls')) && (await page.locator('#s-char .c7-mid .c7-stat').count()) === 6, '장비 위 줄 직업 문장·이름 = 드루이드, 중앙 능력치 6줄 유지');
  await page.click('#s-char nav [data-csub="skill"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-char .c7-sk[data-skill="sprout"]') && (await page.locator('#s-char .c7-sk[data-skill="heal"]').count()) === 0, '스킬 탭 = 드루이드 스킬');
  ok(/새싹/.test(await text('#s-char [data-tap="heal"]')), '칸 탭 기본 힐 = 새싹');
  await page.click('#s-char nav [data-csub="talent"]'); await page.clock.runFor(50);
  ok(/드루이드 특성/.test(await text('#s-char .c7-talent-title')) && /긴 새싹/.test(await text('#s-char .c7-tiers')) && (await page.locator('#s-char .c7-tier.pending').count()) === 2, '드루이드 특성 트리 (77): Lv 10 = 2단 열림');
  await page.screenshot({ path: `${shots}/heroes_druid_skill.png` });

  // ---- 편성 안내: 해제 불가·직업 바꾸기 없이 권장 레벨만 ----
  await patchSave(page, { settings: { devUnlock: true } });
  await toParty(page, { content: 'abyss1', tab: 'raid10' });
  ok((await page.locator('#s-party .f-warns .f-warn').count()) === 1 && /권장 레벨\s*Lv 45/.test(await text('#s-party .f-warn.lv')), '편성 안내는 권장 레벨만 표시');
  ok((await page.locator('#s-party .f-warn.dispel, #s-party [data-go="s-char"]').count()) === 0 && !/해제 못 함/.test(await text('#s-party .f-pty')), '해제 불가 안내와 직업 바꾸기 버튼 제거');
  await page.screenshot({ path: `${shots}/heroes_entry.png` });
  await page.click('#s-party .tb-back'); await page.clock.runFor(100);

  // ---- 전투: 드루이드 휠 ----
  await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(100);
  await toParty(page, { content: 'rustfort' });
  await departGo(page); await page.clock.runFor(3100 + 4000);
  ok(await page.evaluate(() => window.__proto.F.hero) === 'druid', '전투 = 드루이드');
  const wheel = await page.evaluate(() => [...document.querySelectorAll('#wheel .slot')].map(b => b.textContent).join(' '));
  ok(/새싹/.test(wheel) && /환생|환/.test(wheel), `휠에 드루이드 스킬 (${wheel.replace(/\s+/g, ' ').slice(0, 60)})`);
  ok(await page.evaluate(() => {
    const slots = [...document.querySelectorAll('#wheel .slot[data-slot]')];
    return slots.length > 0 && slots.every(s => !!s.querySelector('img.sic')?.getAttribute('src'));
  }), '31 그림: 전투 휠 배운 칸마다 skill- 그림 (이름 위)');
  const tid = await tapUnit("u.role === 'tank'");
  ok(await page.evaluate(id => window.__proto.F.party.find(u => u.id === id).hots.some(h => h.key === 'sprout'), tid), '칸 탭 = 새싹 (지속 힐)');
  await page.screenshot({ path: `${shots}/heroes_druid_battle.png` });

  // ---- 전투: 성기사 봉화 ----
  await setHero('paladin');
  await toParty(page, { content: 'rustfort' });
  await departGo(page); await page.clock.runFor(3100 + 4000);
  ok(await page.evaluate(() => { const F = window.__proto.F; return F.hero === 'paladin' && F.beacon === F.party.find(u => u.role === 'tank').id; }), '성기사: 봉화는 처음에 탱커');
  await page.dispatchEvent('#core', 'pointerdown'); await page.dispatchEvent('#core', 'pointerup'); await page.clock.runFor(50);
  ok(await page.isVisible('#core.beacon'), '휠 가운데 = 봉화 지정 모드');
  const did = await tapUnit("u.role !== 'tank' && !u.me");
  ok(await page.evaluate(id => window.__proto.F.beacon === id, did) && !(await page.isVisible('#core.beacon')), '칸 탭 = 그 파티원에게 봉화');
  await page.dispatchEvent('#core', 'pointerdown'); await page.dispatchEvent('#core', 'pointerup'); await page.clock.runFor(50);
  ok(/봉화 바꾸기 대기/.test(await text('#toast')), '바로 다시 바꾸면 대기 안내');
  await page.screenshot({ path: `${shots}/heroes_paladin_battle.png` });

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
