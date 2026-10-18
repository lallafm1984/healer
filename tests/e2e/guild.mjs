// 길드 v2 (93 · FM 97, 2026-10-18 사슬 4번, 상점 · 편성과 같은 길드 홀 돌색 #233): 잠금 → 결성 (말없는탱 + 인연 높은 딜러) → 결성 이야기 →
// 영입 탭 친구 초대 (범위 능력치) · 모집 공고 (역할) · 지원자 시트 (능력 ★만) → 영입 → 길드원 시트 (능력치 숫자 · 스킬 다시 뽑기 · 보내기)
// → 「길드파티로 출전」 = 전투 탭 → 편성이 길드파티 → 출발 → 보상에 길드원 경험치 · 명성 · 첫 처치 → S25 · 울트라 · 플립 넘침 · 성격 칩이 직업 · Lv를 안 덮음
// 꺼 두면 guild-off.mjs.
import { chromium } from 'playwright';
import { departGo, killEnemies, pastTitle, toParty } from './nav.mjs';

const RANGED = ['mage', 'archer', 'hunter'];
/** 1000명 줄 (src/data/nicknames.ts)의 사람: 딜러 넷 · 탱커 하나 (결성 · 친구 초대) */
const USERS = { 불꽃남자: 9, 메테오: 7, 회피의신: 6, 컨트롤장인: 5, 독수리눈: 4, 방패든양: 20 };

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
  ok(await page.isVisible('#s-guild') && /Lv 15에 열림/.test(await text('#s-guild .lockline')) && (await page.locator('#s-guild .g-feat').count()) === 3, 'Lv 1 = 길드 잠금 (Lv 15) · 열리면 할 것 셋');

  // ---- 결성 (93 4-1): 판 뒤 저절로, 화면에서도 「원정대 만들기」 ----
  await patch(users => {
    const s = JSON.parse(localStorage.getItem('healer.save'));
    s.player.level = 30; s.player.gold = 20000;
    for (const [nick, pt] of Object.entries(users)) s.users[nick] = { pt, met: 3, wins: 2, saved: nick === '메테오' ? 2 : 0, mvp: 0 };
    localStorage.setItem('healer.save', JSON.stringify(s));
  }, USERS);
  await page.click('#tabs [data-tab="guild"]'); await page.clock.runFor(100);
  ok(await page.isVisible('#found') && (await page.locator('#s-guild .subtabs').count()) === 0, 'Lv 30 · 결성 전 = 결성 이야기 카드 (하위 탭 없음)');
  await page.click('#found'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.guild.founded && JSON.stringify(sv.guild.members.map(m => m.nick)) === JSON.stringify(['말없는탱', '불꽃남자', '메테오', '회피의신']), `결성: 말없는탱 + 인연 높은 딜러 셋 (탱커 방패든양은 빠짐) ${sv.guild.members.map(m => m.nick)}`);
  const hero = await text('#s-guild .guild-hero');
  ok(/해바라기 원정대/.test(hero) && /길드 Lv 1/.test(hero) && /정원 4\/6/.test(hero) && /명성 0/.test(hero), '머리: 이름 · 길드 Lv 1 · 정원 4/6 · 명성 0');
  const tabs = await page.locator('#s-guild .subtabs [role="tab"]').evaluateAll(els => els.map(e => [e.dataset.sub, e.getAttribute('aria-selected')]));
  ok(JSON.stringify(tabs) === JSON.stringify([['home', 'true'], ['members', 'false'], ['recruit', 'false']]), `하위 탭 셋 (현황 고름) ${JSON.stringify(tabs)}`);
  ok(/말없는탱/.test(await text('#s-guild .g-story')), '현황 맨 위 결성 이야기 (창단 멤버 이름)');
  await page.screenshot({ path: `${shots}/guild_founded.png` });
  await page.click('#storyOk'); await page.clock.runFor(50);
  ok((await page.locator('#s-guild .g-story').count()) === 0 && (await save()).guild.storySeen, '「확인」 = 이야기 카드 닫힘 (한 번만)');
  ok((await page.locator('#s-guild .g-list [data-mem]').count()) === 4 && /0 \/ 10/.test(await text('#s-guild .g-goal')), '현황: 길드원 줄 4 · 주간 목표 0/10');
  ok((await page.locator('#s-guild .g-recs li').count()) === 5 && (await page.locator('#s-guild .g-recrow').count()) === 2, '기록 다섯 숫자 · 영입 요약 둘 (친구 초대 · 모집 공고, 명성 지원자는 길드 Lv 2)');
  ok(/길드파티로 출전/.test(await text('#guildGo')) && /주간 목표 0\/10/.test(await text('#guildGo')), '아래 버튼 「길드파티로 출전」');

  // ---- 영입: 친구 초대 (93 4-2 ①) ----
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  const friends = await page.locator('#s-guild [data-friend]').evaluateAll(els => els.map(e => e.dataset.friend));
  ok(JSON.stringify(friends) === JSON.stringify(['방패든양', '컨트롤장인', '독수리눈']), `친구 = 인연 Lv 2 이상 · 길드 밖 · 인연 순 ${friends}`);
  await page.click('#s-guild [data-friend="방패든양"] .f-mt'); await page.clock.runFor(50);
  ok(await sheetOpen() && (await page.locator('#s-guild .g-msheet .fm-grid.fog li').count()) === 12 && /~/.test(await text('#s-guild .g-msheet .fm-grid')), '친구 시트: 능력치 12칸 범위 (「11~14」)');
  await shut();
  await page.click('#s-guild [data-invite="방패든양"]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members.length === 5 && sv.player.gold === 20000 && /초대 완료/.test(await text('#s-guild .warnbox')), '초대 = 무료, 5/6');

  // ---- 모집 공고 (93 4-2 ②): 역할 고름 · 내 Lv × 30 ----
  await page.click('#s-guild [data-role="ranged"]'); await page.clock.runFor(50);
  ok(await page.getAttribute('#s-guild [data-role="ranged"]', 'aria-pressed') === 'true', '역할 칩 원거리 고름');
  ok(/명문 공고/.test(await text('#s-guild .g-recruit')) && (await page.locator('#s-guild [data-post="elite"]').count()) === 0, '명문 공고는 길드 Lv 4에 열림 (버튼 없음)');
  await page.click('#s-guild [data-post="normal"]'); await page.clock.runFor(50);
  sv = await save();
  const cands = sv.guild.post?.cands ?? [];
  ok(sv.player.gold === 20000 - 900 && cands.length === 3 && cands.every(c => RANGED.includes(c.cls) && c.lv >= 25), `공고 = 골드 900, 원거리 3명 (Lv 25 이상) ${cands.map(c => `${c.cls} ${c.lv}`)}`);
  ok(await page.isVisible('#s-guild .subtabs [data-sub="recruit"] .rdot') && (await page.locator('#s-guild [data-hire]').count()) === 3, '지원자 있으면 영입 탭 빨간 점 · 줄마다 영입');
  await page.click('#s-guild [data-cand="0"] .f-mt'); await page.clock.runFor(50);
  ok(await sheetOpen() && (await page.locator('#s-guild .g-msheet .fm-grid').count()) === 0 && /친구가 되면 능력치가 보임/.test(await text('#s-guild .g-msheet')), '처음 보는 지원자 시트: 능력 ★만');
  await shut();
  await page.screenshot({ path: `${shots}/guild_recruit.png` });
  await page.click('#s-guild [data-hire="0"]'); await page.clock.runFor(50);
  sv = await save();
  const hired = sv.guild.members.find(m => m.nick === cands[0].nick);
  ok(sv.guild.members.length === 6 && sv.guild.post === null && hired && sv.users[hired.nick].pt >= 8, `영입: ${cands[0].nick} (인연 Lv 3 = 길드원), 6/6`);
  ok(await page.isDisabled('#s-guild [data-invite="컨트롤장인"]') && await page.isDisabled('#s-guild [data-post="normal"]'), '정원 가득 = 초대 · 공고 꺼짐');

  // ---- 길드원 시트: 능력치 숫자 · 스킬 다시 뽑기 · 보내기 ----
  await page.click('#s-guild .subtabs [data-sub="members"]'); await page.clock.runFor(50);
  ok(/6\/6/.test(await text('#s-guild .subtabs [data-sub="members"]')) && (await page.locator('#s-guild [data-mem]').count()) === 6, '길드원 탭 6/6 · 줄 6');
  const tank = sv.guild.members.find(m => m.story === 'tank');
  await page.click(`#s-guild [data-mem="${tank.id}"] .f-mt`); await page.clock.runFor(50);
  ok(await sheetOpen() && (await page.locator('#s-guild .g-msheet .fm-grid:not(.fog) li').count()) === 12, '길드원 시트: 능력치 12칸 숫자');
  ok(await page.isDisabled('#s-guild [data-reroll]') && await page.isDisabled('#s-guild [data-release]') && /고유 스킬/.test(await text('#s-guild [data-reroll]')), '말없는탱: 스킬 다시 뽑기 · 보내기 없음 (스토리 동료)');
  ok(/인연/.test(await text('#s-guild .g-msheet')) && /직업 스킬 ★1\/5/.test(await text('#s-guild .g-msheet')), '인연 막대 · 직업 스킬 ★1/5 (인연 Lv 3)');
  await shut();
  await page.click(`#s-guild [data-mem="${hired.id}"] .f-mt`); await page.clock.runFor(50);
  const g0 = (await save()).player.gold;
  await page.click('#s-guild [data-reroll]'); await page.clock.runFor(50);
  ok((await save()).player.gold === g0 - 1800 && /새 스킬/.test(await text('#s-guild .g-msheet')), '스킬 다시 뽑기 = 내 Lv × 60 (1,800)');
  await page.locator('#s-guild .g-msheet').screenshot({ path: `${shots}/guild_member.png` });
  // 후원 (98): 그 길드원 Lv × 20 골드 = 5판, 내 레벨과 같으면 버튼 대신 「내 레벨과 같음」
  await shut();
  const low = (await save()).guild.members.find(m => m.nick === '불꽃남자');
  await page.click(`#s-guild [data-mem="${low.id}"] .f-mt`); await page.clock.runFor(50);
  const g1 = (await save()).player.gold;
  await page.click('#s-guild [data-sponsor]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.player.gold === g1 - low.lv * 20 && sv.guild.members.find(m => m.id === low.id).boost === 5 && /후원 5판 남음/.test(await text('#s-guild .g-msheet')), `후원: 골드 ${low.lv * 20} → 5판`);
  await shut();
  ok(/후원 5/.test(await text(`#s-guild [data-mem="${low.id}"]`)), '길드원 줄에 금빛 「후원 5」');
  await page.click(`#s-guild [data-mem="${tank.id}"] .f-mt`); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-guild [data-sponsor]') && /내 레벨과 같음/.test(await text('#s-guild [data-sponsor]')), '내 레벨과 같은 길드원 = 「내 레벨과 같음」');
  await shut();
  await page.click(`#s-guild [data-mem="${hired.id}"] .f-mt`); await page.clock.runFor(50);
  await page.click('#s-guild [data-release]'); await page.clock.runFor(50);
  ok(/한 번 더 누르면 보냄/.test(await text('#s-guild [data-release]')) && (await save()).guild.members.length === 6, '보내기 첫 누름 = 확인만');
  await page.click('#s-guild [data-release]'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.guild.members.length === 5 && sv.guild.away.some(m => m.nick === hired.nick) && /인연은 그대로/.test(await text('#s-guild .warnbox')), '보내기 = 친구 목록으로 (인연 그대로)');
  await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
  ok((await page.locator(`#s-guild [data-friend="${hired.nick}"]`).count()) === 1 && /예전 길드원/.test(await text(`#s-guild [data-friend="${hired.nick}"]`)), '보낸 사람은 친구 초대 줄에 「예전 길드원」');

  // ---- 「길드파티로 출전」 → 전투 탭 → 편성이 길드파티 → 출발 ----
  await page.click('#s-guild .subtabs [data-sub="home"]'); await page.clock.runFor(50);
  await page.click('#guildGo'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-content'), '「길드파티로 출전」 = 전투 탭 (모험 고르기)');
  await toParty(page);
  const picked = await page.locator('#s-party [data-gpick].picked').count();
  ok(await page.getAttribute('#s-party [data-mode="guild"]', 'aria-selected') === 'true' && picked === 4, `편성이 길드파티로 시작 (5인 = 길드원 4) ${picked}`);
  ok((await page.locator('#s-party [data-gpick] .bond').count()) >= 5, '편성 길드원 줄에 인연 하트');
  // 추천 편성 (93 7-1): 보스 특징에 맞는 스킬 · 숙지로 고르고 이유 칩
  ok(/추천 편성/.test(await text('#autoPick')), '버튼 「추천 편성」');
  await page.click('#autoPick'); await page.clock.runFor(50);
  const why = await page.locator('#s-party .f-why .chip').allTextContents();
  ok((await page.locator('#s-party [data-gpick].picked').count()) === 4 && why.length >= 1 && why.every(w => /→|숙지/.test(w)), `추천 편성 = 4명 + 이유 칩 ${JSON.stringify(why)}`);
  await page.screenshot({ path: `${shots}/guild_party.png` });
  await departGo(page); await page.clock.runFor(3100 + 500);
  const inFight = await page.evaluate(() => window.__proto.F.party.filter(u => u.gid != null).map(u => ({ nick: u.nick, ab: u.ab?.key, bond: u.bond, did: !!u.did })));
  ok(inFight.length === 4 && inFight.every(u => u.ab && u.bond >= 8 && u.did), `전투에 길드원 4 + 직업 스킬 · 인연 점수 · 한 일 기록 ${JSON.stringify(inFight.map(u => u.nick))}`);
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
  ok(/인연 \+\d/.test(rw), '결과: 인연 +N');
  ok(/공략 숙지 1단계: /.test(rw), '결과: 공략 숙지 1단계 (보스 이름 · 길드원)');
  sv = await save();
  ok(sv.guild.members.find(m => m.nick === '불꽃남자').boost === 5, '출전한 판은 후원 판을 안 씀');
  ok(sv.guild.fame === 4 && sv.guild.firsts.length === 1 && sv.guild.members.filter(m => m.runs === 1).length === 4 && sv.weekly.guild.n === 1, `저장: 명성 4 · 첫 처치 1 · 출전 1번 ×4 · 주간 목표 1 (${sv.guild.fame})`);
  await page.screenshot({ path: `${shots}/guild_reward.png` });

  // ---- S25 · 울트라 · 플립: 가로 넘침 없음, 출전 버튼 탭 위, 이름 안 잘림, 성격 칩이 직업 · Lv를 안 덮음 (보상 화면엔 탭 막대가 없어 다시 읽음) ----
  await patch(() => {});
  for (const [w, h, name] of [[360, 780, 's25'], [384, 824, 'ultra'], [412, 915, 'ultra-wide'], [360, 880, 'flip']]) {
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
    await page.screenshot({ path: `${shots}/guild_members_${name}.png` });
    await page.click('#s-guild .subtabs [data-sub="recruit"]'); await page.clock.runFor(50);
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
