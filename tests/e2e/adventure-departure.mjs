import { chromium } from 'playwright';
import { chooseContent, entryGo, pastTitle, rowContentKeys, shownImagesReady } from './nav.mjs';

/** 장소 줄에서 바로 고르기 (팝업 없음), 레벨/난이도, 보상 dialog·출전 복귀의 실제 사용자 흐름. */
export default async function adventureDeparture(url, shots) {
  const browser = await chromium.launch();
  let fails = 0;
  const errs = [];
  const ok = (value, message) => { console.log(`${value ? 'PASS' : 'FAIL'} ${message}`); if (!value) fails++; };
  for (const [width, height] of [[320,640], [360,740], [390,844], [430,932]]) {
    const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    const page = await context.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install();
    await page.goto(url);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('healer.save'));
      s.tut = 99; s.player.level = 14; s.settings.devUnlock = false;
      s.clears.plateau = { '쉬움':{stars:3,grade:'S',best:30,n:1} };
      localStorage.setItem('healer.save',JSON.stringify(s));
    });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await page.click('#tabs [data-tab="battle"]');
    await page.click('[data-ctab="explore"]');
    await chooseContent(page,'plateau');
    await page.click('[data-diff="쉬움"]');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.b-body').evaluate(el => { el.scrollTop = 0; });
    await page.clock.runFor(100);
    const shape = await page.evaluate(() => {
      const q = s => document.querySelector(`#s-content ${s}`), r = s => q(s).getBoundingClientRect();
      return { level:q('.b-level').textContent, gate:r('.b-gate').height,
        levelFont:parseFloat(getComputedStyle(q('.b-level strong')).fontSize),
        gateInBody:r('.b-gate').top >= r('.b-body').top-1 && r('.b-gate').bottom <= r('.b-body').bottom+1
          && r('.b-gate').left >= r('.b-body').left-1 && r('.b-gate').right <= r('.b-body').right+1,
        arrow:getComputedStyle(q('.b-cat[aria-selected="true"]'),'::after').content,
        overflow:q('.b-body').scrollWidth > q('.b-body').clientWidth+1,
        inlineList:!!q('.b-body .b-place-section'),
        ctaBottom:r('#contentGo').bottom, tabsTop:document.querySelector('#tabs').getBoundingClientRect().top,
        info:!!q('.b-inf, .b-gb, .dsp'), xp:q('.b-body').textContent.includes('레벨이 높아 경험치') };
    });
    ok(shape.gate > 0 && shape.gateInBody && shape.levelFont >= (height<=760?22:24) && /Lv\.\s*1/.test(shape.level), `${width}: 화면 안 풍경 / 큰 권장 Lv.1`);
    ok(!shape.info && !shape.xp && ['none','normal'].includes(shape.arrow), `${width}: 선택 마름모·중복 정보·경험치 감산 안내 제거`);
    ok(!shape.overflow && !shape.inlineList && shape.ctaBottom <= shape.tabsTop+1, `${width}: 본문 하위목록 없음·가로 넘침 없음·출전 고정`);
    const art = await page.evaluate(async () => {
      const q = s => document.querySelector(s);
      // 2026-10-16 전투 흐름 손질: 나무결 탭 그림 → 길드 홀 돌색 (그림 없음) + 전투 머리판과 같은 황동 테 (::before border-image)
      const flat = ['.b-cats','.b-cat[aria-selected="true"]','.b-cat[aria-selected="false"]'].every(s=>!/url\(/.test(getComputedStyle(q(s)).backgroundImage));
      const urls=['.b-cat[aria-selected="true"]','.b-cat[aria-selected="false"]'].flatMap(s=>[...getComputedStyle(q(s),'::before').borderImageSource.matchAll(/url\("?([^\")]+)"?\)/g)].map(m=>m[1]));
      return flat && urls.length===2 && (await Promise.all(urls.map(src=>new Promise(res=>{const i=new Image();i.onload=()=>res(i.naturalWidth>0);i.onerror=()=>res(false);i.src=src;})))).every(Boolean);
    });
    ok(art, `${width}: 분류 탭 = 돌색 (나무결 그림 없음) + 황동 테 실제 로드`);
    // 2026-10-16 Lim 「선택 배경이 테두리보다 삐져나온다」 · 「난이도는 코덱스 그림으로 탭과 다른 버튼」
    const look = await page.evaluate(async () => {
      const q = s => document.querySelector(`#s-content ${s}`);
      const tab = getComputedStyle(q('.b-cat[aria-selected="true"]'));
      const dcs = [...document.querySelectorAll('#s-content .b-dc')].map(el => {
        const cs = getComputedStyle(el), b = getComputedStyle(el, '::before');
        return { diff: el.dataset.diff, on: el.classList.contains('on'), src: b.borderImageSource, filter: b.filter, inset: b.inset,
          plain: cs.backgroundImage === 'none' && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.boxShadow === 'none' };
      });
      const want = { '쉬움': 'easy', '보통': 'normal', '어려움': 'hard', '악몽': 'nightmare' };
      const loaded = await Promise.all(dcs.map(d => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = d.src.replace(/^url\("?|"?\)$/g, ''); })));
      return { tabInside: /calc\(100% - 6px\)/.test(tab.backgroundSize) && tab.boxShadow === 'none' && tab.backgroundColor === 'rgba(0, 0, 0, 0)',
        plates: dcs.length === 4 && dcs.every((d, i) => d.src.includes(`ui-diff-${want[d.diff]}`) && loaded[i] && d.inset === '0px' && d.plain),
        lit: dcs.filter(d => d.on).length === 1 && dcs.every(d => d.on === (d.filter === 'none')) };
    });
    ok(look.tabInside, `${width}: 고른 분류 탭 바탕이 황동 테 안쪽에만 (바깥 빛 · 바탕색 없음)`);
    ok(look.plates && look.lit, `${width}: 난이도 = 색 법랑 명판 4종 그림 로드 · 칸 밖으로 안 나감 · 고른 칸만 밝음`);
    await shownImagesReady(page);
    await page.screenshot({path:`${shots}/departure-explore-${width}.png`});
    // Lv 14: 탐험 줄 = 열린 6곳만 레벨 순 (Lv 15 늪지 어귀부터 숨김)
    const row=await page.locator('.b-regions [data-content]').evaluateAll(els=>els.map(el=>({key:el.dataset.content,lv:Number(el.querySelector('small').textContent.replace(/\D/g,''))})));
    ok(row.length===6 && row[0].key==='plateau' && row.every((p,i)=>p.lv<=14 && (!i || row[i-1].lv<=p.lv)), `${width}: Lv 14 탐험 장소 줄 = Lv 14까지 6곳만 레벨 순`, row);
    await page.click('.b-regions [data-content="alley"]'); await page.clock.runFor(50);
    ok(await page.locator('.b-place-modal').count()===0 && await page.locator('#s-content').getAttribute('data-selected-content')==='alley'
      && await page.locator('[data-content="alley"]').getAttribute('aria-pressed')==='true' && /잿빛 뒷골목/.test(await page.locator('#contentGo').innerText())
      && await page.evaluate(()=>document.activeElement?.dataset.content==='alley'), `${width}: 장소 카드를 누르면 팝업 없이 바로 출전 장소로·포커스 유지`);
    await page.click('[data-ctab="dungeon"]'); await page.click('[data-ctab="explore"]');
    ok(await page.locator('[data-content="alley"]').getAttribute('aria-pressed')==='true', `${width}: 분류를 바꿨다 와도 고른 장소 기억`);
    // 92: 순차 구간 장소의 권장 레벨 = 길에서 그 난이도에 들어가는 레벨 (녹슨 고원 어려움 적 Lv 5 → Lv 3, 보통 적 Lv 3 → Lv 2)
    await chooseContent(page,'plateau'); await page.click('[data-diff="어려움"]');
    const lvHard=await page.locator('.b-level').innerText();
    await page.click('[data-diff="보통"]');
    ok(/Lv\.\s*3/.test(lvHard) && /Lv\.\s*2/.test(await page.locator('.b-level').innerText()), `${width}: 난이도 변경에 권장 레벨 갱신`);
    const rewardSelector='[data-reward="gear"]';
    ok(await page.locator('.b-gate [data-reward="gold"]').count()===1 && await page.locator('.b-gate [data-reward="stone"]').count()===0
      && await page.locator('.b-pop,[data-drops]').count()===0, `${width}: 장면 안 보상 아이콘·기존 상세 팝업 제거`);
    await page.click(rewardSelector);
    // 88 (#183): 낮은 등급일수록 확률이 높게 → 녹슨 고원 보통 일반 68% · 고급 32% (값은 tests/reward-preview.test.ts)
    ok(await page.locator('.b-reward-chance').isVisible() && /68%/.test(await page.locator('.b-reward-chance [data-grade="일반"]').innerText())
      && await page.locator('.b-reward-chance [data-grade]').count()===2
      && /32%/.test(await page.locator('.b-reward-chance [data-grade="고급"]').innerText())
      && await page.locator('.b-reward-chance').getAttribute('aria-modal')==='false', `${width}: 장비 아이콘은 나오는 등급 일반 68%·고급 32%만 확률 표 (88) 「${(await page.locator('.b-reward-chance').innerText()).replace(/\s+/g, ' ')}」`);
    if(width===390) {
      const ctaBeforeResize=await page.locator('#contentGo').innerText();
      for(const [rw,rh] of [[360,330],[360,360],[690,829]]) {
        await page.setViewportSize({width:rw,height:rh}); await page.clock.runFor(150);
        const rewardAfterResize=await page.evaluate(()=>{
          const pop=document.querySelector('.b-reward-chance'),close=pop?.querySelector('[data-reward-close]');
          if(!pop || !close) return {open:false};
          const r=pop.getBoundingClientRect(),x=close.getBoundingClientRect(),s=document.querySelector('#s-content').getBoundingClientRect(),tabs=document.querySelector('#tabs').getBoundingClientRect();
          return {open:!!pop.getClientRects().length,
            inside:r.left>=s.left-1 && r.top>=s.top-1 && r.right<=s.right+1 && r.bottom<=Math.min(s.bottom,tabs.top)+1,
            closeInside:x.left>=r.left-1 && x.top>=r.top-1 && x.right<=r.right+1 && x.bottom<=r.bottom+1};
        });
        ok(rewardAfterResize.open && rewardAfterResize.inside && rewardAfterResize.closeInside
          && await page.locator('#contentGo').innerText()===ctaBeforeResize,`390→${rw}×${rh}: 확률 팝오버·닫기 버튼을 화면 안에 유지`);
      }
      await page.click('[data-reward-close]');
      ok(await page.locator('.b-reward-chance').count()===0 && await page.evaluate(()=>document.activeElement.matches('[data-reward="gear"]')),
        '확률 팝오버 resize 뒤 닫기 버튼 클릭 가능·초점 복귀');
      await page.click(rewardSelector);
      await page.keyboard.press('Escape');
      ok(await page.locator('.b-reward-chance').count()===0 && await page.evaluate(()=>document.activeElement.matches('[data-reward="gear"]')
        && !document.querySelector('#tabs').closest('[inert]') && !document.querySelector('#contentGo').closest('[inert]'))
        && await page.locator('#contentGo').innerText()===ctaBeforeResize,'확률 팝오버 resize 후 닫기·배경 활성·출전 선택 유지');
      await page.setViewportSize({width,height}); await page.clock.runFor(150);
      await page.click(rewardSelector);
    }
    await page.keyboard.press('Escape');
    ok(await page.locator('.b-reward-chance').count()===0 && await page.evaluate(()=>document.activeElement.matches('[data-reward="gear"]')), `${width}: 확률 팝오버 닫기·포커스 복원`);
    await page.click('#contentGo'); await page.clock.runFor(100); await entryGo(page);
    ok(await page.locator('#s-party').isVisible(), `${width}: 선택한 장소로 실제 편성 진입`);
    await page.click('#s-party .tb-back'); await page.clock.runFor(100);
    ok(await page.locator('#s-content').getAttribute('data-selected-content')==='plateau' && await page.locator('[data-diff="보통"]').getAttribute('aria-pressed')==='true', `${width}: 편성에서 복귀 시 장소·난이도 기억`);
    await page.click('[data-ctab="raid20"]');
    ok(await page.locator('#contentGo').isDisabled() && /열림/.test(await page.locator('.b-st').innerText()), `${width}: 잠긴 레이드 열람 가능·출전 차단`);
    await shownImagesReady(page);
    await page.screenshot({path:`${shots}/departure-locked-${width}.png`});
    if (width===390) {
      await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.player.level=100;localStorage.setItem('healer.save',JSON.stringify(s));});
      await page.reload(); await page.clock.runFor(300); await pastTitle(page); await page.click('#tabs [data-tab="battle"]');
      await page.click('[data-ctab="raid10"]');
      const raidRow=await rowContentKeys(page);
      await chooseContent(page,'isle3');
      await page.click('[data-diff="어려움"]');
      ok(raidRow.length===47 && await page.locator('[data-content="isle3"]').getAttribute('aria-pressed')==='true'
        && await page.locator('#s-content').getAttribute('data-selected-diff')==='어려움', '390: 10인 장소 줄 47곳, 뒤쪽 장소·난이도 선택 유지');
      await shownImagesReady(page);
      await page.screenshot({path:`${shots}/departure-raid10-row-390.png`});
      await page.click('[data-step="1"]');
      const next=raidRow[raidRow.indexOf('isle3')+1];
      ok(await page.locator('#s-content').getAttribute('data-selected-content')===next
        && await page.locator(`.b-regions [data-content="${next}"]`).getAttribute('aria-pressed')==='true', `390: 장소 화살표는 장소 줄 순서대로 다음 (${next})`);
      await page.click('[data-step="-1"]'); await page.click('[data-step="-1"]');
      ok(await page.locator('#s-content').getAttribute('data-selected-content')===raidRow[raidRow.indexOf('isle3')-1], '390: 이전 화살표도 장소 줄 순서');
      await page.click('[data-ctab="dungeon"]'); await chooseContent(page,'crypt');
      ok(await page.locator('[data-chal]').count()===1, '390: 주간 도전 별도 진입 유지');
      await page.locator('.b-body').evaluate(el=>{el.scrollTop=0;});
      await shownImagesReady(page);
    await page.screenshot({path:`${shots}/departure-dungeon-390.png`});
    }
    await context.close();
  }
  await browser.close();
  return {fails,errs};
}
