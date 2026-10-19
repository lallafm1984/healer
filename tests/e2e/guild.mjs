// 길드 v2 (93 · FM 97, 2026-10-18 사슬 4번, 상점 · 편성과 같은 길드 홀 돌색 #233): 잠금 → 결성 (말없는탱 + 인연 높은 딜러) → 결성 이야기 →
// 영입 탭 친구 초대 (범위 능력치) · 모집 공고 (역할) · 지원자 시트 (능력 ★만) → 영입 → 길드원 시트 (능력치 숫자 · 후원 · 보내기)
// → 「길드파티로 출전」 = 전투 탭 → 편성이 길드파티 → 출발 → 보상에 길드원 경험치 · 명성 · 첫 처치 → S25 · 울트라 · 플립 넘침 · 성격 칩이 직업 · Lv를 안 덮음
// 꺼 두면 guild-off.mjs.
import { chromium } from 'playwright';
import { departGo, killEnemies, pastTitle, toParty } from './nav.mjs';

const RANGED = ['mage', 'archer', 'hunter'];
/** 1000명 줄 (src/data/nicknames.ts)의 사람: 딜러 넷 · 탱커 하나 (결성 · 친구 초대) */

export default async function guild(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  const text = sel => page.textContent(sel);
  const patch = async (fn, arg) => { await page.evaluate(fn, arg); await page.reload(); await page.clock.runFor(300); await pastTitle(page); };
  const sheetOpen = () => page.isVisible('#s-guild .g-msheet');
  const shut = async () => { await page.click('#s-guild .g-msheet .f-shut'); await page.clock.runFor(50); };
  await page.clock.install({ time: new Date(2026, 9, 7, 12) });
  await page.goto(url);
  await page.clock.runFor(300);
  await pastTitle(page);

  // ---- 잠금: Lv 15 (개발 빌드 「레벨 잠금 무시」를 끄면) ----
  await patch(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.settings.devUnlock = false; localStorage.setItem('healer.save', JSON.stringify(s)); });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-guild') && /Lv 15에 열림/.test(await text('#s-guild .lockline')) && (await page.locator('#s-guild .g-feat').count()) === 2, 'Lv 1 = 길드 잠금 (Lv 15) · 영입과 길드파티 안내');

  // ---- 결성 (93 4-1): 판 뒤 저절로, 화면에서도 「원정대 만들기」 ----
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.level = 30; s.player.gold = 20000;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#found') && (await page.locator('#s-guild .subtabs').count()) === 0, 'Lv 30 · 결성 전 = 결성 이야기 카드 (하위 탭 없음)');
  await page.click('#found'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.guild.founded && JSON.stringify(sv.guild.members.map(m => m.nick)) === JSON.stringify(['말없는탱', '감자도적', '불꽃남자', '딜미터1등']), `결성: 말없는탱 + 근접 1명 · 원거리 2명 ${sv.guild.members.map(m => m.nick)}`);
  const hero = await text('#s-guild .guild-hero');
  ok(/해바라기 원정대/.test(hero) && /길드 Lv 1/.test(hero) && /정원 4\/6/.test(hero) && /명성 0/.test(hero), '머리: 이름 · 길드 Lv 1 · 정원 4/6 · 명성 0');
  const tabs = await page.locator('#s-guild .subtabs [role="tab"]').evaluateAll(els => els.map(e => [e.dataset.sub, e.getAttribute('aria-selected')]));
  ok(JSON.stringify(tabs) === JSON.stringify([['home', 'true'], ['members', 'false'], ['recruit', 'false']]), `하위 탭 셋 (현황 고름) ${JSON.stringify(tabs)}`);
  ok(/말없는탱/.test(await text('#s-guild .g-story')), '현황 맨 위 결성 이야기 (창단 멤버 이름)');
  await page.screenshot({ path: `${shots}/guild_founded.png` });
  await page.click('#storyOk'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-story').count()) === 0 && (await save()).guild.storySeen, '「확인」 = 이야기 카드 닫힘 (한 번만)');
  // 현황 = 그림 칸 둘 (할 일 · 시설, 기록 제거), 처음엔 할 일. 길드원 줄은 길드원 탭에만
  const hubs = await page.locator('#s-guild .g-hub [data-csel]').evaluateAll(els => els.map(e => [e.dataset.csel, e.getAttribute('aria-selected')]));
  ok(JSON.stringify(hubs) === JSON.stringify([['todo', 'true'], ['fac', 'false']]) && (await page.locator('#s-guild [data-mem]').count()) === 0 && /0 \/ 10/.test(await text('#s-guild .g-goal')), `현황: 칸 둘 (할 일 고름) · 길드원 줄 없음 · 주간 목표 0 / 10 ${JSON.stringify(hubs)}`);
  ok((await page.locator('#s-guild [data-csel="rec"], .g-firsts').count()) === 0, '현황 기록 메뉴 제거');
  await page.click('#s-guild .g-card[data-sec="todo"] .g-info'); await page.clock.runFor(50);
  ok(/주간 목표/.test(await text('#s-guild .g-tip')) && await page.getAttribute('#s-guild .g-card[data-sec="todo"] .g-info', 'aria-expanded') === 'true', 'ⓘ = 설명 펼침');
  await page.click('#s-guild .g-card[data-sec="todo"] .g-info'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-tip').count()) === 0, 'ⓘ 다시 = 접힘');
  ok(/길드파티로 출전/.test(await text('#guildGo')) && /주간 목표 0 \/ 10/.test(await text('#guildGo')), '아래 버튼 「길드파티로 출전」');

  // 영입은 공고와 명성 지원자만. 친구·명부·인연 안내가 없다.
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild [data-csel="friend"], #s-guild [data-csel="roster"], #s-guild [data-friend]').count()) === 0 && !/친구|인연|명부/.test(await text('#s-guild .g-recruit')), '친구 초대 · 명부 · 인연 안내 제거');
  const compactPost = await page.locator('#s-guild .g-hub.n1').evaluate(el => {
    const box = el.getBoundingClientRect(), tile = el.querySelector('button').getBoundingClientRect();
    return Math.abs(box.width - tile.width) < 2 && tile.height >= 44 && tile.height <= 64;
  });
  ok(compactPost, '길드 Lv 1 공고 메뉴: 빈 칸 없이 한 줄 · 터치 영역 확보');

  // ---- 모집 공고 (93 4-2 ②): 역할 고름 · 내 Lv × 30 ----
  await page.click('#s-guild [data-csel="post"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-role="ranged"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-guild [data-role="ranged"]', 'aria-pressed') === 'true', '역할 칩 원거리 고름');
  ok(/명문 공고/.test(await text('#s-guild .g-recruit')) && await page.isDisabled('#s-guild [data-pkind="elite"]') && (await page.locator('#s-guild [data-post="elite"]').count()) === 0, '명문 공고는 길드 Lv 4에 열림 (고르는 칸 잠김 · 버튼 없음)');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  sv = await save();
  const cands = sv.guild.post?.cands ?? [];
  ok(sv.player.gold === 20000 - 900 && cands.length === 3 && cands.every(c => RANGED.includes(c.cls) && c.lv >= 25), `공고 = 골드 900, 원거리 3명 (Lv 25 이상) ${cands.map(c => `${c.cls} ${c.lv}`)}`);
  ok(await page.isVisible('#s-guild .subtabs [data-sub="recruit"] .rdot') && (await page.locator('#s-guild [data-hire]').count()) === 3, '지원자 있으면 영입 탭 빨간 점 · 줄마다 영입');
  await page.click('#s-guild [data-cand="0"] .f-mt'); await page.clock.runFor(50);
  ok(await sheetOpen() && (await page.locator('#s-guild .g-msheet .fm-grid li').count()) === 12 && !/친구|인연/.test(await text('#s-guild .g-msheet')), '지원자의 정확한 능력치 12칸을 영입 전에 확인');
  await shut();
  await page.screenshot({ path: `${shots}/guild_recruit.png` });
  await page.click('#s-guild [data-hire="0"]'); await page.clock.runFor(50);
  sv = await save();
  const hired = sv.guild.members.find(m => m.nick === cands[0].nick);
  ok(sv.guild.members.length === 5 && sv.guild.post === null && hired && !sv.users, `영입: ${cands[0].nick} (추가 비용 없음), 5/6`);
  await page.click('#s-guild [data-role="tank"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-hire="0"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members.length === 6 && await page.isDisabled('#s-guild [data-post="normal"]'), '정원 가득 = 공고 잠금');
  // ---- 길드원 시트: 능력치 숫자 · 후원 · 보내기 ----
  await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
  ok(/정원 6\/6/.test(await text('#s-guild .guild-hero')) && (await page.locator('#s-guild [data-mem]').count()) === 6, '길드원 탭 줄 6 · 머리 정원 6/6');
  const tank = sv.guild.members.find(m => m.story === 'tank');
  await page.click(`#s-guild [data-mem="${tank.id}"] .f-mt`); await page.clock.runFor(50);
  ok(await sheetOpen() && (await page.locator('#s-guild .g-msheet .fm-grid:not(.fog) li').count()) === 12, '길드원 시트: 능력치 12칸 숫자');
  ok((await page.locator('#s-guild [data-reroll]').count()) === 0 && await page.isDisabled('#s-guild [data-release]'), '스킬 뽑기 제거 · 스토리 동료 보내기 금지 유지');
  ok((await page.locator('#s-guild .g-msheet .g-meter').count()) === 1 && !/직업 스킬 LV/.test(await text('#s-guild .g-msheet')), '레벨 경험치 막대 하나, 규칙 글은 ⓘ 전엔 안 보임');
  await page.click('#s-guild .g-msheet [data-tip="msheet"]'); await page.clock.runFor(50);
  ok(/직업 스킬 LV 2 \/ 5/.test(await text('#s-guild .g-msheet .g-tip')), 'ⓘ: 직업 스킬 LV 2 / 5 (길드원 Lv 30)');
  await shut();
  await page.click(`#s-guild [data-mem="${hired.id}"] .f-mt`); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-acts > button').count()) === 2 && (await page.locator('#s-guild .g-msheet .g-tiles').count()) === 0, '길드원 상세: 후원 · 보내기 두 버튼, 기록 통계 제거');
  ok((await text('#s-guild .g-msheet .pab .skill-level')) === 'LV 2' && !/★/.test(await text('#s-guild .g-msheet .pab')), '직업 스킬: 별 대신 LV 2 표시');
  await page.locator('#s-guild .g-msheet').screenshot({ path: `${shots}/guild_member.png` });
  // 후원 (98): 그 길드원 Lv × 20 골드 = 5판, 내 레벨과 같으면 버튼 대신 「내 레벨과 같음」
  await shut();
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.guild.members.find(m => m.nick === '불꽃남자').lv = 25;
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-sub="members"]'); await page.clock.runFor(50);
  const low = (await save()).guild.members.find(m => m.nick === '불꽃남자');
  await page.click(`#s-guild [data-mem="${low.id}"] .f-mt`); await page.clock.runFor(50);
  const g1 = (await save()).player.gold;
  ok((await text('#s-guild [data-sponsor] b')) === '골드 지원' && (await text('#s-guild [data-release] b')) === '내보내기', '길드원 작업 버튼: 골드 지원 · 내보내기');
  ok((await text('#s-guild [data-release] small')) === '길드에서 제외' && !/친구 목록/.test(await text('#s-guild .g-msheet')), '내보내기 버튼에 친구 목록 대신 길드에서 제외 표시');
  await page.click('#s-guild [data-sponsor]'); await page.clock.runFor(50);
  ok((await text('#guildConfirmDesc')) === '전투에 참여하지 않아도 경험치를 소량 획득합니다. 후원하시겠습니까?' && (await save()).player.gold === g1 && (await save()).guild.members.find(m => m.id === low.id).boost === 0, '골드 지원 첫 누름: 요청 문구의 확인 팝업만, 골드·후원 유지');
  ok(await page.locator('#s-guild .g-msheet').evaluate(el => el.inert) && await page.locator('#s-guild .g-action-confirm').evaluate(el => el.contains(document.activeElement)), '확인창을 여는 동안 상세 비활성화 · 팝업에 포커스');
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  ok(await page.locator('#s-guild [data-gconfirm]').evaluate(el => el === document.activeElement), '확인 팝업 안에서 Tab 포커스 순환');
  await page.clock.runFor(200);
  await page.screenshot({ path: `${shots}/guild_sponsor_confirm.png` });
  await page.click('#s-guild .g-action-buttons [data-shut]'); await page.clock.runFor(50);
  ok(!(await page.locator('#s-guild .g-action-confirm').count()) && (await save()).player.gold === g1 && (await save()).guild.members.find(m => m.id === low.id).boost === 0 && await page.locator('#s-guild [data-sponsor]').evaluate(el => el === document.activeElement), '지원 취소: 소비 없음 · 상세와 버튼 포커스 복귀');
  await page.click('#s-guild [data-sponsor]'); await page.clock.runFor(50);
  await page.keyboard.press('Escape'); await page.clock.runFor(50);
  ok(!(await page.locator('#s-guild .g-action-confirm').count()) && await page.isVisible('#s-guild .g-msheet') && (await save()).player.gold === g1, 'Escape는 확인 팝업만 닫고 지원하지 않음');
  await page.click('#s-guild [data-sponsor]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-gconfirm]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === g1 - low.lv * 20 && sv.guild.members.find(m => m.id === low.id).boost === 5 && /5판 남음/.test(await text('#s-guild [data-sponsor]')) && !(await page.locator('#s-guild .g-action-confirm').count()), `지원 확인: 골드 ${low.lv * 20} 한 번만 소비 → 5판`);
  ok(await page.isDisabled('#s-guild [data-sponsor]') && (await text('#s-guild [data-sponsor] b')) === '지원 중', '횟수가 남아 있으면 지원 중으로 버튼 잠금 · 중첩 불가');
  await shut();
  ok(/5판 후원/.test(await text(`#s-guild [data-mem="${low.id}"] .f-tag.gold`)), '길드원 줄에 금빛 후원 주머니 + 5');
  await page.click(`#s-guild [data-mem="${tank.id}"] .f-mt`); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-guild [data-sponsor]') && /내 레벨과 같음/.test(await text('#s-guild [data-sponsor]')), '내 레벨과 같은 길드원 = 「내 레벨과 같음」');
  await shut();
  await page.click(`#s-guild [data-mem="${hired.id}"] .f-mt`); await page.clock.runFor(50);
  await page.click('#s-guild [data-release]'); await page.clock.runFor(50);
  ok((await text('#guildConfirmDesc')) === '길드에서 내보냅니다.' && (await text('#guildConfirmTitle')) === '내보내기' && (await save()).guild.members.length === 6, '내보내기 첫 누름: 요청 문구의 확인 팝업만, 길드원 유지');
  ok(!/친구 목록|인연과 성장/.test(await text('#s-guild .g-action-confirm')), '내보내기 확인창의 친구 목록 · 인연과 성장 안내 제거');
  await page.clock.runFor(200);
  await page.screenshot({ path: `${shots}/guild_release_confirm.png` });
  await page.click('#s-guild .g-action-buttons [data-shut]'); await page.clock.runFor(50);
  ok((await save()).guild.members.length === 6 && await page.locator('#s-guild [data-release]').evaluate(el => el === document.activeElement), '내보내기 취소: 길드원 유지 · 버튼 포커스 복귀');
  await page.click('#s-guild [data-release]'); await page.clock.runFor(50);
  await page.click('#s-guild .g-action-dim', { position: { x: 8, y: 8 } }); await page.clock.runFor(50);
  ok(!(await page.locator('#s-guild .g-action-confirm').count()) && await page.isVisible('#s-guild .g-msheet') && (await save()).guild.members.length === 6, '팝업 바깥 누름: 내보내기 취소 · 상세 유지');
  await page.click('#s-guild [data-release]'); await page.clock.runFor(50);
  await page.click('#s-guild [data-gconfirm]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members.length === 5 && !sv.guild.members.some(m => m.nick === hired.nick) && !sv.guild.away && /길드에서 내보냈습니다/.test(await text('#s-guild .warnbox')), '내보내기 = 길드에서 제외, 완료 안내');
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild [data-friend]').count()) === 0, '내보낸 사람의 친구 초대 목록 없음');

  // ---- 「길드파티로 출전」 → 전투 탭 → 편성이 길드파티 → 출발 ----
  await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
  await page.click('#guildGo'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-content'), '「길드파티로 출전」 = 전투 탭 (모험 고르기)');
  await toParty(page);
  const picked = await page.locator('#s-party [data-gpick].picked').count();
  ok(await page.getAttribute('#s-party [data-mode="guild"]', 'aria-selected') === 'true' && picked === 4, `편성이 길드파티로 시작 (5인 = 길드원 4) ${picked}`);
  ok((await page.locator('#s-party .bond').count()) === 0, '편성 길드원 줄에도 인연 표시 없음');
  // 추천 편성 (93 7-1): 보스 특징에 맞는 스킬 · 숙지로 고르고 이유 칩
  ok(/추천 편성/.test(await text('#autoPick')), '버튼 「추천 편성」');
  await page.click('#autoPick'); await page.clock.runFor(50);
  const why = await page.locator('#s-party .f-why .chip').allTextContents();
  ok((await page.locator('#s-party [data-gpick].picked').count()) === 4 && why.length >= 1 && why.every(w => /→|숙지/.test(w)), `추천 편성 = 4명 + 이유 칩 ${JSON.stringify(why)}`);
  await page.screenshot({ path: `${shots}/guild_party.png` });
  await departGo(page); await page.clock.runFor(3100 + 500);
  const inFight = await page.evaluate(() => window.__proto.F.party.filter(u => u.gid != null).map(u => ({ nick: u.nick, ab: u.ab?.key, bond: u.bond, did: !!u.did })));
  ok(inFight.length === 4 && inFight.every(u => u.ab && u.bond == null && u.did), `전투에 길드원 4 + 직업 스킬 · 한 일 기록 (인연 없음) ${JSON.stringify(inFight.map(u => u.nick))}`);
  ok(((await save()).guild.picks['5'] ?? []).length === 4, '5인 편성 저장 (규모마다 따로)');

  // ---- 구간 빨리 넘기고 보상: 길드원 경험치 · 명성 (+ 첫 처치) ----
  for (let i = 0; i < 3; i++) {
    await killEnemies(page); await page.clock.runFor(1500);
    await page.click('#restGo'); await page.clock.runFor(3100 + 500);
  }
  await killEnemies(page); await page.clock.runFor(1500);
  ok(await page.isVisible('#s-settle'), '던전 클리어');
  await page.clock.runFor(1200); if (await page.isVisible('#s-settle .lvpop')) { await page.click('#s-settle .lvpop button'); await page.clock.runFor(50); }
  const rw = await text('#s-settle .r-notes');
  ok(/길드원 경험치 \+\d/.test(rw) && /명성 \+4/.test(rw) && /길드 첫 처치/.test(rw), '결과: 길드원 경험치 · 명성 +4 · 길드 첫 처치');
  ok(!/인연|새 친구/.test(rw) && !(await save()).users, '결과와 저장에 인연 보상 없음');
  ok(/공략 숙지 1단계: /.test(rw), '결과: 공략 숙지 1단계 (보스 이름 · 길드원)');
  sv = await save();
  ok(sv.guild.members.find(m => m.nick === '불꽃남자').boost === (inFight.some(m => m.nick === '불꽃남자') ? 5 : 4), '출전 여부에 따른 후원 횟수 차감');
  ok(sv.guild.fame === 4 && sv.guild.firsts.length === 1 && sv.guild.members.filter(m => m.runs === 1).length === 4 && sv.weekly.guild.n === 1, `저장: 명성 4 · 첫 처치 1 · 출전 1번 ×4 · 주간 목표 1 (${sv.guild.fame})`);
  await page.screenshot({ path: `${shots}/guild_reward.png` });

  // ---- 기록 · 명부 제거 유지 ----
  await patch(() => {});
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok((await page.locator('#s-guild [data-csel="rec"]').count()) === 0, '클리어 후에도 기록 메뉴 없음');
  const mem1 = (await save()).guild.members[1];
  await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
  await page.click(`#s-guild [data-mem="${mem1.id}"] .f-mt`); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-msheet .g-tiles').count()) === 0 && !/함께 이김|살려 줌|딜 1등/.test(await text('#s-guild .g-msheet')), '길드원 상세 기록 통계 제거');
  await shut();
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild [data-csel="roster"]').count()) === 0, '클리어 후에도 명부 없음');

  // ---- 반별 · 높은 스킬 상태를 포함한 반응형 검수 ----
  await page.emulateMedia({ reducedMotion: 'reduce' }); // 시트 애니메이션의 중간 프레임 없이 실제 배치 검수
  await patch(() => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.gold = 100000;
    s.guild.members.forEach((m, i) => {
      for (const k of Object.keys(m.stats)) m.stats[k] = i === 0 ? 13 : 20;
      m.lastStatGains = i === 0 ? ['atk', 'skill', 'judgment'] : [];
      m.lv = i === 0 ? 15 : 80;
    });
    localStorage.setItem('healer.save', JSON.stringify(s));
  });
  for (const [w, h, name] of [[360, 780, 's25'], [384, 824, 'ultra'], [412, 915, 'ultra-wide'], [360, 880, 'flip'], [768, 920, 'fold']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
    const fit = () => page.locator('#s-guild .ns-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    const cta = await page.locator('#guildGo').boundingBox(), tabsBox = await page.locator('#tabs').boundingBox();
    ok(await fit() && cta.y + cta.height <= tabsBox.y + 1 && cta.height >= 44, `${name} ${w}×${h}: 현황 가로 넘침 없음, 출전 버튼 탭 위`);
    await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
    const rows = await page.locator('#s-guild .g-list .pcard').evaluateAll(els => els.map(el => {
      const cap = el.querySelector('.f-l1 > .cap'), ps = el.querySelector('.f-l1 > .f-ps'), nick = el.querySelector('.pnick'), mt = el.querySelector('.f-mt');
      const a = cap.getBoundingClientRect(), b = ps.getBoundingClientRect(), t = mt.getBoundingClientRect();
      return { nick: nick.textContent, nickCut: nick.scrollWidth > nick.clientWidth + 1, capCut: cap.scrollWidth > cap.clientWidth + 1, overlap: a.right > b.left + 0.5 || b.right > t.right + 1, cap: cap.textContent };
    }));
    const bad = rows.filter(r => r.capCut || r.overlap || r.nickCut);
    ok(await fit() && !bad.length, `${name}: 길드원 줄 가로 넘침 없음 · 이름 · 직업 · Lv 안 잘림 · 성격 칩 안 겹침 ${JSON.stringify(bad)}`);
    const rating = await page.locator(`#s-guild [data-mem="${tank.id}"] .ability-stars`).getAttribute('aria-label');
    ok(rating === '별 3.5 / 5' && (await page.locator('#s-guild [data-mem] .rating-star.half').count()) === 1 && !/½|★/.test(await text('#s-guild .g-list')), `${name}: 3.5 능력 반별 그림, 목록의 별 문자 제거`);
    ok((await page.locator(`#s-guild [data-mem="${tank.id}"] .skill-level`).textContent()) === 'LV 1' && (await page.locator('#s-guild [data-mem] .bond').count()) === 0 && (await page.locator('#s-guild [data-mem] .skill-level').allTextContents()).includes('LV 5'), `${name}: 스킬 LV 1~5 · 인연 아이콘 없음`);
    const indicators = await page.locator('#s-guild [data-mem] .f-l2').evaluateAll(els => els.every(el => {
      const skill = el.querySelector('.f-ab').getBoundingClientRect(), rating = el.querySelector('.f-fm').getBoundingClientRect(), level = el.querySelector('.skill-level').getBoundingClientRect();
      return skill.right <= rating.left + 1 && level.left >= skill.left - 1 && level.right <= skill.right + 1 && el.scrollWidth <= el.clientWidth + 1;
    }));
    ok(indicators, `${name}: 스킬과 능력 별이 겹치거나 넘치지 않음`);
    await page.screenshot({ path: `${shots}/guild_members_${name}.png` });
    await page.click(`#s-guild [data-mem="${tank.id}"] .f-mt`); await page.clock.runFor(250);
    const grown = await page.locator('#s-guild .fm-grid li:has(.fm-up)').allTextContents();
    ok(grown.length === 3 && ['공격', '기술 숙련', '판단'].every(k => grown.some(x => x.includes(k))), `${name}: 저장을 다시 읽어도 직전 상승 항목 세 곳에만 화살표`);
    const growthFit = await page.locator('#s-guild .fm-grid li').evaluateAll(els => els.every(el => {
      const label = el.querySelector(':scope > span'), value = el.querySelector('b');
      return label.scrollWidth <= label.clientWidth + 1 && label.getBoundingClientRect().right <= value.getBoundingClientRect().left && el.scrollWidth <= el.clientWidth + 1;
    }));
    ok(growthFit, `${name}: 능력치 이름 · 수치 · 상승 화살표 겹침이나 잘림 없음`);
    await page.screenshot({ path: `${shots}/guild_growth_${name}.png` });
    await shut();
    await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
    if (!(await save()).guild.post) { await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50); }
    const rrows = await page.locator('#s-guild .g-list .pcard').evaluateAll(els => els.filter(el => {
      const cap = el.querySelector('.f-l1 > .cap'), ps = el.querySelector('.f-l1 > .f-ps'), mt = el.querySelector('.f-mt');
      const a = cap.getBoundingClientRect(), b = ps.getBoundingClientRect(), t = mt.getBoundingClientRect();
      return cap.scrollWidth > cap.clientWidth + 1 || a.right > b.left + 0.5 || b.right > t.right + 1 || el.querySelector('.f-l2').scrollWidth > el.querySelector('.f-l2').clientWidth + 1;
    }).map(el => el.querySelector('.pnick').textContent));
    ok(await fit() && !rrows.length, `${name}: 영입 화면 가로 넘침 없음 · 줄 직업 · Lv 안 가림 ${JSON.stringify(rrows)}`);
    await page.screenshot({ path: `${shots}/guild_recruit_${name}.png` });
    await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
  }

  await ctx.close();
  await browser.close();
  return { fails, errs };
}
