import { chromium } from 'playwright';
import { pastTitle, chooseContent } from './nav.mjs';

/** 지역 → 장소 페이지 탐색, 레벨/난이도, 보상 dialog·출전 복귀의 실제 사용자 흐름. */
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
      const backgrounds = ['.b-cats','.b-cat[aria-selected="true"]','.b-cat[aria-selected="false"]'].map(s=>getComputedStyle(q(s)).backgroundImage);
      const urls=backgrounds.flatMap(s=>[...s.matchAll(/url\("?([^\")]+)"?\)/g)].map(m=>m[1]));
      return urls.length===3 && (await Promise.all(urls.map(src=>new Promise(res=>{const i=new Image();i.onload=()=>res(i.naturalWidth>0);i.onerror=()=>res(false);i.src=src;})))).every(Boolean);
    });
    ok(art, `${width}: 생성한 탭 2종·배경 실제 로드`);
    await page.locator('#s-content img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
    await page.screenshot({path:`${shots}/departure-explore-${width}.png`});
    const selectedBeforePreview=await page.locator('#contentGo').innerText();
    await page.click('[data-region="capital"]');
    ok(await page.locator('[data-content="cemetery"]').count()===1 && await page.locator('[data-content="plateau"]').count()===0, `${width}: 왕도 선택 시 왕도 장소만 표시`);
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await page.evaluate(()=>!!document.activeElement.closest('.b-place-modal')), `${width}: 장소 팝업 포커스 제한`);
    await page.keyboard.press('Escape');
    ok(await page.locator('#contentGo').innerText()===selectedBeforePreview && await page.evaluate(()=>document.activeElement.matches('[data-region="capital"]')), `${width}: 지역 미리보기 취소 시 선택 유지·지역 버튼 포커스 복귀`);
    await chooseContent(page,'alley');
    ok(await page.locator('.b-place-modal').count()===0 && await page.locator('#s-content').getAttribute('data-selected-content')==='alley', `${width}: 장소 선택 후 적용·팝업 자동닫힘`);
    await page.click('[data-region="rust"]'); await page.keyboard.press('Escape'); await page.click('[data-region="capital"]');
    ok(await page.locator('[data-content="alley"]').getAttribute('aria-pressed')==='true', `${width}: 지역별 마지막 장소 기억`);
    await page.keyboard.press('Escape');
    await chooseContent(page,'plateau'); await page.click('[data-diff="보통"]');
    ok(/Lv\.\s*3/.test(await page.locator('.b-level').innerText()), `${width}: 난이도 변경에 권장 레벨 갱신`);
    const rewardSelector='[data-reward="gear"]';
    ok(await page.locator('.b-gate [data-reward="gold"]').count()===1
      && await page.locator('.b-pop,[data-drops]').count()===0, `${width}: 장면 안 보상 아이콘·기존 상세 팝업 제거`);
    await page.click(rewardSelector);
    ok(await page.locator('.b-reward-chance').isVisible() && /58%/.test(await page.locator('.b-reward-chance').innerText())
      && await page.locator('.b-reward-chance [data-grade]').count()===5
      && /42%/.test(await page.locator('.b-reward-chance [data-grade="고급"]').innerText())
      && await page.locator('.b-reward-chance').getAttribute('aria-modal')==='false', `${width}: 장비 아이콘은 일반 58%·고급 42%와 0% 등급을 포함한 확률 표`);
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
    await page.click('#contentGo'); await page.clock.runFor(100);
    ok(await page.locator('#s-party').isVisible(), `${width}: 선택한 장소로 실제 편성 진입`);
    await page.click('#s-party .tb-back'); await page.clock.runFor(100);
    ok(await page.locator('#s-content').getAttribute('data-selected-content')==='plateau' && await page.locator('[data-diff="보통"]').getAttribute('aria-pressed')==='true', `${width}: 편성에서 복귀 시 장소·난이도 기억`);
    await page.click('[data-ctab="raid20"]');
    ok(await page.locator('#contentGo').isDisabled() && /열림/.test(await page.locator('.b-st').innerText()), `${width}: 잠긴 레이드 열람 가능·출전 차단`);
    await page.locator('#s-content img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
    await page.screenshot({path:`${shots}/departure-locked-${width}.png`});
    if (width===390) {
      await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.player.level=100;localStorage.setItem('healer.save',JSON.stringify(s));});
      await page.reload(); await page.clock.runFor(300); await pastTitle(page); await page.click('#tabs [data-tab="battle"]');
      await page.click('[data-ctab="raid10"]');
      await chooseContent(page,'isle3');
      await page.click('[data-current-places]');
      const selectedPage = await page.locator('.b-place-section').getAttribute('data-page');
      const selectedCards = await page.locator('.b-pl[data-content]').evaluateAll(els=>els.map(el=>el.dataset.content));
      await page.keyboard.press('Escape');
      await page.click('[data-diff="어려움"]');
      await page.click('[data-current-places]');
      const afterPage = await page.locator('.b-place-section').getAttribute('data-page');
      const afterCards = await page.locator('.b-pl[data-content]').evaluateAll(els=>els.map(el=>el.dataset.content));
      ok(Number(selectedPage)>1 && selectedPage===afterPage && selectedCards.join()===afterCards.join()
        && await page.locator('[data-content="isle3"]').getAttribute('aria-pressed')==='true', '390: 마지막 장소 페이지·선택을 난이도 변경 뒤에도 유지');
      const selectedCta=await page.locator('#contentGo').innerText();
      await page.click('[data-place-page="-1"]');
      ok(await page.locator('#contentGo').innerText()===selectedCta, '390: 목록 페이지만 넘기면 현재 출전 장소·난이도 유지');
      await page.click('[data-place-page="1"]');
      ok(await page.locator('[data-content="isle3"]').getAttribute('aria-pressed')==='true', '390: 원래 페이지로 돌아오면 선택 장소 표시');
      await page.locator('.b-place-modal img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
      await page.screenshot({path:`${shots}/departure-raid10-modal-390.png`});
      await page.keyboard.press('Escape');
      await page.click('[data-step="1"]');
      ok(await page.locator('#s-content').getAttribute('data-selected-content')==='gull1', '390: 장소 화살표는 현재 지역 안에서 순환');
      await page.click('[data-current-places]');
      ok(await page.locator('[data-content="gull1"]').getAttribute('aria-pressed')==='true'
        && await page.locator('.b-place-section').getAttribute('data-page')==='1', '390: 순환 뒤 장소 팝업을 다시 열면 선택 페이지 노출');
      await page.keyboard.press('Escape');
      await page.click('[data-ctab="dungeon"]'); await chooseContent(page,'crypt');
      ok(await page.locator('[data-chal]').count()===1, '390: 주간 도전 별도 진입 유지');
      await page.locator('.b-body').evaluate(el=>{el.scrollTop=0;});
      await page.locator('#s-content img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
    await page.screenshot({path:`${shots}/departure-dungeon-390.png`});
    }
    await context.close();
  }
  await browser.close();
  return {fails,errs};
}
