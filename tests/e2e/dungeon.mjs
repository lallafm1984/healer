// 던전 흐름 (23·24): 로비 → 콘텐츠 → 난이도 → 편성 → 잡몹 구간 → 휴식 → … → 정산 → 보상 → 레벨 업. 구간은 적 체력을 깎아 빨리 넘긴다
import { chromium } from 'playwright';
import { killEnemies, pastTitle, pickedItems, toEntry } from './nav.mjs';

export default async function dungeon(url, shots) {
  const browser = await chromium.launch();
  const errs = [];
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('healer.save')));
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(300);

  // ---- 캐릭터 → 스킬: Lv 1에선 안 배운 스킬 잠금 표시 ----
  await pastTitle(page);
  await page.click('#tabs [data-tab="char"]'); await page.clock.runFor(100);
  await page.click('#s-char [data-csub="skill"]'); await page.clock.runFor(50);
  ok(await page.isDisabled('#s-char [data-tap="renew"]') && await page.isEnabled('#s-char [data-tap="flash"]'), '캐릭터 Lv 1: 칸 탭 「소생」 잠금, 「순간 치유」는 고를 수 있음');
  ok((await page.locator('#s-char .lslot.locked').count()) === 5, '캐릭터 Lv 1: 스킬 휠 5칸 잠금 표시');
  await page.click('#tabs [data-tab="battle"]'); await page.clock.runFor(100);

  // ---- 콘텐츠 선택 ----
  await page.click('#lobbyStart'); await page.clock.runFor(100);
  ok(await page.getAttribute('#s-content [data-ctab="dungeon"]', 'aria-selected') === 'true', '콘텐츠 기본 탭 = 던전 5인');
  ok(await page.getAttribute('#s-content [data-content="rustfort"]', 'aria-disabled') === null, '녹슨 요새는 열림');
  ok(await page.getAttribute('#s-content [data-content="crypt"]', 'aria-disabled') === 'true' && /준비 중/.test(await page.textContent('#s-content [data-content="crypt"]')), '안 만든 던전 = 준비 중 (못 누름)');
  await page.click('#s-content [data-content="crypt"]', { force: true }); await page.clock.runFor(50);
  ok(await page.isVisible('#s-content'), '준비 중 카드는 눌러도 그대로');

  // ---- 난이도·입장 ----
  await toEntry(page);
  ok(await page.getAttribute('#s-entry [data-diff="보통"]', 'aria-checked') === 'true', '난이도 기본 = 보통');
  ok((await page.locator('#s-entry .segs li').count()) === 4, '진행 4구간');
  const g = await page.textContent('#s-entry .gdet:first-child');
  ok(/무너진 정문/.test(g) && /고철 졸개 ×3/.test(g), '첫 공략 = 무너진 정문 잡몹 (잡는 순서)');
  ok(!/Infinity|NaN|undefined/.test(await page.textContent('#s-entry')), '입장 화면에 Infinity·NaN 없음');
  await page.click('#s-entry [data-diff="어려움"]'); await page.clock.runFor(50);
  ok(/권장 장비\(고급\)보다 낮음/.test(await page.textContent('#s-entry .warnbox')), '어려움 + 장비 없음 = 경고만');
  ok(await page.isEnabled('#entryGo'), '경고여도 입장 가능');
  await page.click('#s-entry [data-diff="보통"]'); await page.clock.runFor(50);
  await page.screenshot({ path: `${shots}/dungeon_entry.png` });

  // ---- 편성 ----
  await page.click('#entryGo'); await page.clock.runFor(100);
  ok((await page.locator('#s-party .pcard').count()) === 4, '5인 파티 (나 빼고 4명)');
  const cls0 = await page.evaluate(() => [...document.querySelectorAll('#s-party .pcard')].map(c => c.dataset.cls));
  ok(cls0.every(Boolean) && new Set(cls0).size === 4, `파티원마다 직업, 5인은 같은 직업 없음 (${cls0})`);
  ok(/단단한 몸|신성한 갑옷/.test(await page.textContent('#s-party .pcard:first-child')), '탱커 카드에 직업 패시브');
  ok(/단축칸 2칸/.test(await page.textContent('#s-party')) && await pickedItems(page) === 'mana,life', 'Lv 1 = 단축칸 2칸, 마나·생명');
  await page.click('#s-party [data-item="cleanse"]');
  ok(/가득 참/.test(await page.textContent('#s-party .note.warn')), '3번째는 안 들어감');
  const nicks = () => page.evaluate(() => [...document.querySelectorAll('#s-party .pcard .pnick')].map(b => b.textContent).join());
  const before = await nicks();
  ok(/무료/.test(await page.textContent('#reroll')), '첫 다시 뽑기 = 무료');
  await page.click('#reroll'); await page.clock.runFor(50);
  ok(/10/.test(await page.textContent('#reroll')), `다시 뽑으면 다음은 10골드 (${(await page.textContent('#reroll')).trim()})`);
  await page.click('#reroll'); await page.clock.runFor(50);
  ok(/골드 부족/.test(await page.textContent('#s-party .note.warn')), '골드 0이면 못 뽑음');
  const party0 = await nicks();
  ok(party0.split(',').length === 4 && party0 !== before, `다시 뽑으면 다른 파티 (${before} → ${party0})`);
  await page.screenshot({ path: `${shots}/dungeon_party.png` });

  // ---- 전투: 구간 → 휴식 → 구간 ----
  await page.click('#depart'); await page.clock.runFor(3100 + 4000);
  ok(/무너진 정문 · 고철 졸개/.test(await page.textContent('#bossName')), '전투 위쪽 = 구간 이름 · 지금 잡는 잡몹');
  ok(/녹슨 요새 1\/4 · 남은 적 4/.test(await page.textContent('#phase')), '진행 줄 = 1/4 · 남은 적');
  ok(await page.evaluate(() => window.__proto.F.party.filter(u => !u.me).map(u => u.nick).join()) === party0, '편성 화면의 파티 그대로');
  const clsNow = await page.evaluate(() => [...document.querySelectorAll('#s-party .pcard')].map(c => c.dataset.cls).join());
  ok(await page.evaluate(() => window.__proto.F.party.filter(u => !u.me).map(u => u.cls).join()) === clsNow, `전투 파티원 직업 = 편성 화면 (${clsNow})`);
  // 칸을 길게 누르면 직업·패시브
  const bb = await page.locator('#board').boundingBox();
  const tankAt = await page.evaluate(() => { const ui = window.__proto; const t = ui.F.party.find(u => u.role === 'tank'); return ui.center(t.cell); });
  await page.mouse.move(bb.x + tankAt.x, bb.y + tankAt.y); await page.mouse.down(); await page.clock.runFor(600);
  const pv = await page.textContent('#preview');
  await page.mouse.up(); await page.clock.runFor(50);
  ok(/(전사|수호기사) · 탱커/.test(pv) && /(단단한 몸|신성한 갑옷)/.test(pv), `길게 누르면 직업·패시브 (${pv.slice(0, 40)})`);
  // Lv 1 = 치유·순간 치유만 (06 7장). 나머지 휠 칸은 잠금, 성언 게이지 숨김
  const locked = await page.evaluate(() => [...document.querySelectorAll('#wheel .slot.locked')].map(b => b.dataset.lock).sort().join());
  ok(locked === 'guardian,hymn,poh,purify,renew', `Lv 1 휠: 안 배운 스킬 잠금 (${locked})`);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('gauges')).visibility === 'hidden'), 'Lv 1: 성언 게이지 숨김');
  await page.dispatchEvent('#wheel .slot[data-lock="renew"]', 'pointerdown'); await page.dispatchEvent('#wheel .slot[data-lock="renew"]', 'pointerup');
  await page.clock.runFor(50);
  ok(/소생: Lv 2에 배움/.test(await page.textContent('#toast')), '잠긴 칸을 누르면 「Lv 2에 배움」');
  // 파티원 공격은 한 방씩 숫자로 (2026-10-07 Lim), 보스 체력 띠도 그만큼
  await page.clock.runFor(2500);
  const dmg = await page.evaluate(() => [...document.querySelectorAll('#dmgNums span.go')].map(s => s.textContent));
  ok(dmg.length >= 2 && dmg.every(t => /^\d+$/.test(t)), `파티원 공격 숫자가 한 방씩 뜸 (${dmg.join(',')})`);
  ok(await page.evaluate(() => { const F = window.__proto.F; return F.party.some(u => u.dealt > 0) && F.bossHp < F.bossMax; }), '때린 만큼 적 체력이 줄고 딜미터기에 쌓임');
  ok((await page.locator('#bossName .grade').textContent()) === '일반', '적 등급 표시 = 일반 (잡몹 대신)');
  // 휠 칸을 누르면 설명 팝업: 이름 → 정보 줄 → 금색 설명 (~니다)
  await page.dispatchEvent('#wheel .slot[data-slot="flash"]', 'pointerdown'); await page.clock.runFor(500);
  await page.dispatchEvent('#wheel .slot[data-slot="flash"]', 'pointerup'); await page.clock.runFor(30);
  const tip = await page.evaluate(() => { const t = document.getElementById('tip'); return t.hidden ? null : { name: t.querySelector('.tt-name b')?.textContent, rows: [...t.querySelectorAll('.tt-row')].map(r => r.textContent), desc: t.querySelector('.tt-desc')?.textContent }; });
  ok(tip && tip.name === '순간 치유' && tip.rows.some(r => /1초 시전/.test(r)) && /니다\.$/.test(tip.desc || ''), `스킬 설명 팝업 = 첨부 형식 (${JSON.stringify(tip)})`);
  await page.screenshot({ path: `${shots}/dungeon_trash.png` });

  const segs = ['고철 경비병', '증기 보일러실', '녹슨 문지기'];
  for (let i = 0; i < segs.length; i++) {
    await page.evaluate(() => { const F = window.__proto.F; F.mana = 37; F.g.p = 55; });
    await killEnemies(page);
    await page.clock.runFor(1500);
    ok(await page.isVisible('#rest'), `${i + 1}구간 끝 → 휴식 화면`);
    const rest = await page.textContent('#restBody');
    ok(rest.includes(segs[i]) && /계속/.test(await page.textContent('#restGo')), `휴식에서 다음 구간 미리보기: ${segs[i]}`);
    const pct = async () => parseInt(await page.textContent('#restPct'), 10);
    const m0 = await pct();
    ok(m0 >= 37 && m0 <= 41, `휴식 시작 마나 = 끝난 마나에서 이어서 (${m0}%)`);
    await page.clock.runFor(3000);
    const m1 = await pct();
    ok(Math.abs(m1 - m0 - 30) <= 1, `3초 쉬면 +30% (${m0} → ${m1})`);
    if (i === 0) {
      const rows = await page.locator('#restMeter .meter li').count();
      ok(rows === 4 && /딜미터기/.test(await page.textContent('#restMeter')), `휴식 화면 딜미터기 (${rows}명)`);
      await page.screenshot({ path: `${shots}/dungeon_rest.png` });
    }
    if (i === 1) {
      ok((await page.locator('#bossName .grade.elite').count()) === 0, '보일러실 첫 적은 일반');
    }
    await page.click('#restGo'); await page.clock.runFor(3100 + 500);
    const st = await page.evaluate(() => { const F = window.__proto.F, R = window.__proto.dungeon; return { name: F.enc.name, mana: F.mana, carry: R.carry.mana, p: F.g.p, party: F.party.filter(u => !u.me).map(u => u.nick).join(), idx: R.idx }; });
    ok(st.name === segs[i] && st.idx === i + 1, `계속 → ${segs[i]} 시작`);
    // 「계속」을 누른 순간까지 쉰 만큼 (테스트 시계도 실제로 조금 흐름), 전투 0.5초 동안 자연 회복이 더해짐
    // Lv 1은 성언 게이지가 없어서 이어받아도 0 (Lv 6부터, 단위 테스트에서 확인)
    ok(st.carry >= m1 && st.mana >= st.carry && st.mana < st.carry + 2 && st.p === 0, `마나 이어받음, Lv 1이라 성언 게이지는 0 (휴식 ${m1}% → 계속 ${st.carry.toFixed(1)} → ${st.mana.toFixed(1)}, 평온 ${st.p})`);
    ok(st.party === party0, '같은 파티');
  }
  await page.screenshot({ path: `${shots}/dungeon_boss.png` });

  // ---- 정산 → 보상 → 레벨 업 ----
  await killEnemies(page);
  await page.clock.runFor(1500);
  ok(await page.isVisible('#s-settle') && (await page.textContent('#s-settle h1')) === '던전 클리어!', '마지막 보스 → 던전 클리어 정산');
  const res = await page.textContent('#s-settle');
  ok(/[SABC]/.test(await page.textContent('#s-settle .grade')) && /첫 클리어/.test(res) && /클리어 시간/.test(res), '정산 = 등급·별·첫 클리어·시간');
  ok((await page.locator('#s-settle .starlist li').count()) === 3, '별 조건 3개');
  ok((await page.locator('#s-settle .meter li').count()) === 4 && /던전 전체/.test(await page.textContent('#s-settle .meter h3')), '정산 화면 딜미터기 (던전 전체)');
  await page.screenshot({ path: `${shots}/dungeon_settle.png` });
  await page.click('#toReward'); await page.clock.runFor(200);
  ok(await page.isVisible('#s-reward') && await page.isVisible('#s-reward .lvpop'), '보상 화면 + 레벨 업 팝업 (첫 클리어로 Lv 2)');
  const pop = await page.textContent('#s-reward .lvpop');
  ok(/Lv 1 → 2/.test(pop) && /소생/.test(pop) && !/준비 중/.test(pop), '팝업: Lv 1 → 2, 스킬 「소생」 열림');
  ok(/힐량·체력 ×1\.00 → ×1\.08/.test(pop), '팝업: 힐량·체력 ×1.00 → ×1.08');
  await page.screenshot({ path: `${shots}/dungeon_levelup.png` });
  await page.click('#s-reward .lvpop button'); await page.clock.runFor(50);
  let sv = await save();
  ok(sv.player.level === 2 && sv.player.gold > 0 && sv.gear.bag.length === 1, `저장: Lv 2, 골드 ${sv.player.gold}, 가방에 장비 1개`);
  ok(sv.clears.rustfort['보통'].n === 1 && sv.last.win, '저장: 녹슨 요새 보통 클리어 기록');
  await page.click('#equipNow'); await page.clock.runFor(50);
  sv = await save();
  ok(sv.gear.bag.length === 0 && Object.keys(sv.gear.equipped).length === 1, '장착 → 가방에서 장착칸으로');
  await page.screenshot({ path: `${shots}/dungeon_reward.png` });

  // ---- 잡몹 구간에서 지면 던전 실패 → 경험치 20%만 ----
  const xp0 = sv.player.xp, gold0 = sv.player.gold;
  await page.click('#again'); await page.clock.runFor(100);
  ok(await page.isVisible('#s-party'), '다시 도전 = 새 파티 편성');
  await page.click('#depart'); await page.clock.runFor(3100 + 500);
  ok(await page.evaluate(() => window.__proto.dungeon.idx === 0 && window.__proto.F.enc.key === 'gate'), '던전 처음부터');
  const lvm = await page.evaluate(() => { const F = window.__proto.F; return { power: F.power, scale: F.scale, me: Math.round(F.me.max) }; });
  ok(Math.abs(lvm.power - 1.08) < 1e-9 && lvm.scale === 1 && lvm.me === 594, `Lv 2 전투: 힐량·내 체력 ×1.08, 단계 Lv 1 그대로 ${JSON.stringify(lvm)}`);
  // 탱커가 쓰러져도 전투는 계속, 아래에 포기 버튼 (2026-10-07 Lim)
  ok(await page.isHidden('#giveUp'), '탱커가 살아 있으면 포기 버튼 없음');
  await page.evaluate(() => { const F = window.__proto.F; F.party.filter(u => u.role === 'tank').forEach(u => { u.hp = 1; u.guardian = 0; }); F.party.forEach(u => { if (!u.me) u.hot = 0; }); });
  await page.clock.runFor(3000);
  const td = await page.evaluate(() => { const F = window.__proto.F; return { over: F.over, tank: F.party.some(u => u.role === 'tank' && u.alive), alive: F.party.filter(u => u.alive && !u.me).length }; });
  ok(td.over === null && !td.tank && td.alive > 0, `탱커가 모두 쓰러져도 전투 계속 ${JSON.stringify(td)}`);
  ok(await page.isVisible('#giveUp') && await page.isHidden('#hint'), '탱커 전멸 → 아래에 포기 버튼');
  const gb = await page.evaluate(() => { const r = document.getElementById('giveUp').getBoundingClientRect(), c = document.getElementById('controls').getBoundingClientRect(), w = document.getElementById('wheel').getBoundingClientRect(); return { inside: r.top >= c.top && r.bottom <= c.bottom, overlap: !(r.right <= w.left || r.left >= w.right) }; });
  ok(gb.inside && !gb.overlap, `포기 버튼은 하단, 휠과 안 겹침 ${JSON.stringify(gb)}`);
  await page.screenshot({ path: `${shots}/battle_tankdown.png` });
  await page.click('#giveUp'); await page.clock.runFor(300);
  ok(await page.isVisible('#s-settle') && (await page.textContent('#s-settle h1')) === '전멸' && /0 \/ 4 구간/.test(await page.textContent('#s-settle')), '포기 버튼 = 전멸과 같은 던전 실패');
  sv = await save();
  ok(sv.player.gold === gold0 && sv.player.xp > xp0 && sv.gear.bag.length === 0, `지면 골드·장비 없음, 경험치 조금 (${xp0} → ${sv.player.xp})`);
  ok(await page.isVisible('#retry'), '실패 정산에 다시 도전');
  await page.screenshot({ path: `${shots}/dungeon_lose.png` });
  await ctx.close();
  await browser.close();
  return { fails, errs };
}
