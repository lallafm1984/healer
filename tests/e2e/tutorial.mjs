// 첫 5분 튜토리얼 (02 11장, 09 4장): 이야기 → 2인 첫 전투(탭 힐 안내) → Lv 2 소생 → 3인 탐험(소생·순간 치유 안내) → 첫 장비
// → 로비 → 녹슨 요새 쉬움 → 끝. 탭은 튜토리얼 동안 잠금. 구간은 적 체력을 깎아 빨리 넘긴다
import { chromium } from 'playwright';
import { killEnemies } from './nav.mjs';

export default async function tutorial(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  const coach = () => page.evaluate(() => { const c = window.__proto.coach; return c ? { need: c.need || null, freeze: c.freeze, text: document.getElementById('coach').textContent } : null; });
  const t = () => page.evaluate(() => window.__proto.F.t);
  /** 파티원 칸을 탭 (pick = 'tank' | 'lowest') */
  const tap = async pick => {
    const bb = await page.locator('#board').boundingBox();
    const at = await page.evaluate(k => {
      const ui = window.__proto, F = ui.F;
      const u = k === 'tank' ? F.party.find(x => x.role === 'tank') : F.party.filter(x => x.alive).reduce((a, b) => (b.hp / b.max < a.hp / a.max ? b : a));
      return ui.center(u.cell);
    }, pick);
    await page.mouse.move(bb.x + at.x, bb.y + at.y); await page.mouse.down(); await page.clock.runFor(30); await page.mouse.up();
    await page.clock.runFor(50);
  };
  const slot = async k => { await page.dispatchEvent(`#wheel .slot[data-slot="${k}"]`, 'pointerdown'); await page.dispatchEvent(`#wheel .slot[data-slot="${k}"]`, 'pointerup'); await page.clock.runFor(30); };
  /** 파티원 칸을 누른 채 쓸기 (dx, dy = 판 좌표) */
  const swipe = async (pick, dx, dy) => {
    const bb = await page.locator('#board').boundingBox();
    const at = await page.evaluate(k => { const ui = window.__proto, F = ui.F; const u = k === 'tank' ? F.party.find(x => x.role === 'tank') : F.party.filter(x => x.alive).reduce((a, b) => (b.hp / b.max < a.hp / a.max ? b : a)); return ui.center(u.cell); }, pick);
    await page.mouse.move(bb.x + at.x, bb.y + at.y); await page.mouse.down(); await page.clock.runFor(30);
    await page.mouse.move(bb.x + at.x + dx, bb.y + at.y + dy, { steps: 5 }); await page.clock.runFor(30); await page.mouse.up();
    await page.clock.runFor(50);
  };
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);

  // ---- 이야기 ----
  await page.click('#s-title'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-story') && /라스트 온라인/.test(await page.textContent('#s-story')), '새 저장: 타이틀 → 짧은 이야기');
  await page.screenshot({ path: `${shots}/tut_story.png` });

  // ---- 2인 첫 전투: 탱커 칸을 탭하라는 안내에서 멈춤 ----
  await page.click('#tutGo'); await page.clock.runFor(3100 + 6200);
  ok(await page.evaluate(() => window.__proto.F.party.length === 2 && window.__proto.F.cells.length === 7), '첫 전투 = 탱커 + 나, 7칸 판');
  let c = await coach();
  ok(c && c.need === 'heal' && c.freeze && /탱커 칸을 탭/.test(c.text), `안내: 「탱커 칸을 탭」 (${c && c.text.slice(0, 20)})`);
  ok(await page.evaluate(() => { const T = window.__proto.F.party.find(u => u.role === 'tank'); return T.hp < T.max; }), '안내는 탱커가 맞기 시작한 뒤에');
  const t0 = await t();
  await page.clock.runFor(1500);
  ok(await t() === t0, `안내가 떠 있는 동안 전투 멈춤 (t=${t0.toFixed(1)})`);
  ok(await page.isVisible('#coach') && !(await page.isVisible('#coach [data-coach-ok]')), '할 일이 있는 안내엔 「확인」 버튼 없음');
  await page.screenshot({ path: `${shots}/tut_duo_coach.png` });
  await tap('tank');
  ok(await coach() === null && await page.evaluate(() => !!window.__proto.F.cast), '탱커 칸을 탭하면 치유 시전 + 안내 닫힘');
  await page.clock.runFor(1000);
  ok(await t() > t0 + 0.5, '전투 다시 흐름');

  // 지면: 다시 하기 안내
  await page.evaluate(() => { const T = window.__proto.F.party.find(u => u.role === 'tank'); T.hp = 1; T.hot = 0; window.__proto.F.cast = null; });
  await page.clock.runFor(4000);
  ok(await page.isVisible('#s-tut') && await page.isVisible('#tutRetry') && /탱커 칸을 자주 탭/.test(await page.textContent('#s-tut')), '지면 = 요령 + 「다시 하기」');
  ok((await save()).tut === 0, '지면 튜토리얼 단계 그대로');
  await page.click('#tutRetry'); await page.clock.runFor(3100 + 6200);
  ok((await coach())?.need === 'heal', '다시 하기 = 처음 안내부터');
  await tap('tank');
  await killEnemies(page); await page.clock.runFor(2000);
  ok(await page.isVisible('#s-tut') && await page.isVisible('#tutNext'), '이기면 = 다음 단계 카드');
  ok(/Lv 2/.test(await page.textContent('#s-tut')) && /소생/.test(await page.textContent('#s-tut')), '카드: Lv 2, 새 스킬 소생');
  let sv = await save();
  ok(sv.player.level === 2 && sv.tut === 1, `저장: Lv 2, 튜토리얼 탐험 단계 (Lv ${sv.player.level}, tut ${sv.tut})`);
  await page.screenshot({ path: `${shots}/tut_card.png` });

  // 앱을 껐다 켜도 이어서
  await page.reload(); await page.clock.runFor(300);
  await page.click('#s-title'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-tut') && await page.isVisible('#tutNext'), '다시 켜면 탐험 카드부터');

  // ---- 3인 탐험: 소생 안내 → 휴식 → 순찰병 → 순간 치유 안내 ----
  await page.click('#tutNext'); await page.clock.runFor(3100 + 1200);
  ok(await page.evaluate(() => window.__proto.F.party.length === 3 && window.__proto.dungeon.segs.join() === 'field,patrol'), '탐험 = 3인, 잡몹 → 순찰병');
  c = await coach();
  ok(c?.need === 'swipe:renew' && /← 쪽으로 쓸기/.test(c.text) && await page.isVisible('#wheel .slot.coach-hi[data-slot="renew"]'), '안내: 소생은 칸에서 ← 쪽으로 쓸기 (휠 소생 칸 반짝임)');
  ok(await page.isVisible('#swipeHint .sw'), '탱커 칸에 쓸 방향 화살표');
  await page.screenshot({ path: `${shots}/tut_explore_coach.png` });
  await slot('renew'); await tap('tank');
  ok((await coach())?.need === 'swipe:renew', '휠로 걸어도 쓸기 안내는 그대로 (쓸기를 꼭 해 봄)');
  // 멈춘 동안이라 공통 재사용 대기가 안 줄어듦 → 비우고, 소생도 지워 둠
  await page.evaluate(() => { const F = window.__proto.F; F.gcd = 0; F.queued = null; F.party.find(u => u.role === 'tank').hot = 0; });
  await swipe('tank', -60, 0);
  ok(await coach() === null && await page.evaluate(() => window.__proto.F.party.find(u => u.role === 'tank').hot > 0), '탱커 칸에서 ← 로 쓸면 소생 + 안내 닫힘');
  ok(await page.isHidden('#swipeHint'), '화살표도 사라짐');
  ok((await page.locator('#wheel .coach-hi').count()) === 0, '휠 반짝임도 꺼짐');
  await page.evaluate(() => window.__proto.F.party.forEach(u => { u.hp = u.max; }));
  await killEnemies(page); await page.clock.runFor(1500);
  ok(await page.isVisible('#rest'), '잡몹 구간 끝 → 휴식');
  await page.click('#restGo'); await page.clock.runFor(3100 + 500);
  ok(await page.evaluate(() => window.__proto.F.enc.key === 'patrol'), '계속 → 고철 순찰병');
  await page.evaluate(() => { const u = window.__proto.F.party.find(x => x.role === 'ranged'); u.hp = u.max * 0.4; });
  await page.clock.runFor(200);
  c = await coach();
  ok(c?.need === 'flash' && /순간 치유/.test(c.text), '체력 50% 아래 → 순간 치유 안내');
  await slot('flash'); await tap('lowest');
  ok(await coach() === null, '순간 치유를 쓰면 안내 닫힘');
  await page.evaluate(() => window.__proto.F.party.forEach(u => { u.hp = u.max; }));
  await killEnemies(page); await page.clock.runFor(1500);
  ok(await page.isVisible('#s-settle'), '탐험 끝 → 정산');
  sv = await save();
  ok(sv.tut === 2 && sv.clears.plateau, `저장: 탐험 클리어, 튜토리얼 던전 단계 (tut ${sv.tut})`);
  await page.clock.runFor(1200); if (await page.isVisible('#s-settle .lvpop')) { await page.click('#s-settle .lvpop button'); await page.clock.runFor(50); }
  ok(/첫 장비/.test(await page.textContent('#s-settle .coachtip')) && await page.isVisible('#equipNow.hi-pulse') && (await page.locator('#s-settle .ns-foot .btn').count()) === 1, '결과: 첫 장비 안내 + 「장착」 반짝임, 튜토리얼 중엔 로비 버튼 하나');
  await page.screenshot({ path: `${shots}/tut_reward.png` });
  await page.click('#equipNow'); await page.clock.runFor(50);
  await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(100);

  // ---- 로비: 녹슨 요새로 안내, 탭은 로비·전투·캐릭터만 (27 1장) ----
  ok(await page.isVisible('#s-lobby .coachtip') && await page.isVisible('#lobbyStart.hi-pulse'), '로비: 첫 던전 안내 + 「출전」 반짝임');
  const locks = await page.evaluate(() => [...document.querySelectorAll('#tabs button.tlock')].map(b => b.dataset.tab).join());
  ok(locks === 'shop', `튜토리얼 중 탭 잠금: 상점 (캐릭터는 첫 장비로 열림, 길드는 빼 둠) (${locks})`);
  await page.click('#tabs [data-tab="shop"]', { force: true }); await page.clock.runFor(50);
  ok(await page.isVisible('#s-lobby'), '잠긴 탭은 눌러도 그대로');
  await page.screenshot({ path: `${shots}/tut_lobby.png` });
  // 전투 탭(모험 선택)에서도 녹슨 요새를 짚어 줌
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);
  ok(await page.getAttribute('#s-content [data-ctab="dungeon"]', 'aria-selected') === 'true' && await page.getAttribute('#s-content [data-content="rustfort"]', 'aria-pressed') === 'true'
    && await page.getAttribute('#s-content [data-diff="쉬움"]', 'aria-pressed') === 'true' && await page.isVisible('#contentGo.hi-pulse') && /녹슨 요새/.test(await page.textContent('#s-content .coachtip')), '전투 탭: 던전 5인 · 녹슨 요새 · 쉬움이 골라져 있고 안내 + 「출전」 반짝임');
  await page.click('#s-content [data-ctab="explore"]'); await page.clock.runFor(50);
  ok(await page.isVisible('#s-content [data-content="plateau"]') && !(await page.isVisible('#s-content [data-content="tutorial"]')), '탐험 탭: 녹슨 고원 (첫 전투는 안 보임)');
  await page.click('#s-content [data-ctab="dungeon"]'); await page.clock.runFor(50);
  // 로비 「바로 출전」 = 녹슨 요새 편성으로 바로 (모험 선택 건너뜀, 입장 화면 없음)
  await page.click('#tabs [data-tab="lobby"]'); await page.clock.runFor(100);
  await page.click('#lobbyStart'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party') && /녹슨 요새/.test(await page.textContent('#s-party .topbar')) && /쉬움/.test(await page.textContent('#s-party .topbar')), '바로 출전 = 녹슨 요새 쉬움 편성');
  ok(/다시 뽑기/.test(await page.textContent('#s-party .coachtip')) && /공략/.test(await page.textContent('#s-party .coachtip')), '편성: 파티 찾기·다시 뽑기·공략 안내');
  await page.screenshot({ path: `${shots}/tut_party.png` });

  // ---- 녹슨 요새 쉬움: 멈추지 않는 안내 → 4구간 → 끝 ----
  await page.click('#depart'); await page.clock.runFor(3100 + 1200);
  c = await coach();
  ok(c && !c.freeze && /일반·정예 구간과 보스/.test(c.text), '던전 첫 안내는 전투를 멈추지 않음');
  const t1 = await t();
  await page.clock.runFor(4500);
  ok(await t() > t1 + 3 && await coach() === null, '4초 뒤 저절로 사라짐');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__proto.F.party.forEach(u => { u.hp = u.max; }));
    if ((await coach())?.freeze) await page.click('#coach [data-coach-ok]');
    await killEnemies(page); await page.clock.runFor(1500);
    if (i < 3) { await page.click('#restGo'); await page.clock.runFor(3100 + 500); }
  }
  ok(await page.isVisible('#s-settle') && (await page.textContent('#s-settle h1')).startsWith('던전 클리어!'), '녹슨 요새 쉬움 클리어');
  sv = await save();
  ok(sv.tut === 3, `저장: 튜토리얼 끝 (tut ${sv.tut})`);
  await page.clock.runFor(1200); if (await page.isVisible('#s-settle .lvpop')) { await page.click('#s-settle .lvpop button'); await page.clock.runFor(50); }
  ok(/튜토리얼은 여기까지/.test(await page.textContent('#s-settle .coachtip')), '결과: 튜토리얼 끝 안내');
  await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(100);
  ok((await page.locator('#tabs button.tlock').count()) === 0 && !(await page.isVisible('#s-lobby .coachtip')), '로비: 탭 잠금·안내 없음');
  await page.reload(); await page.clock.runFor(300);
  await page.click('#s-title'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-lobby'), '다시 켜면 타이틀 → 바로 로비');
  // 개발 빌드: 설정에서 다시 보기 (레벨·장비는 그대로)
  await page.click('#s-lobby .tb-set'); await page.clock.runFor(100);
  await page.click('#tutAgain'); await page.clock.runFor(100);
  sv = await save();
  ok(await page.isVisible('#s-story') && sv.tut === 0 && sv.player.level >= 2, '설정 「튜토리얼 다시 보기」 = 이야기부터, 레벨 그대로');
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
