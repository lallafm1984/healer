import { chromium } from 'playwright';
import { chooseContent, pastTitle } from './nav.mjs';
import { DEPARTURE_DEVICES, departureLayout, layoutIssues } from './adventure-no-scroll.mjs';

/** 주간 도전 위치 변경 회귀: main의 경계·진입·복귀와 지역 스크롤 독립성. */
export default async function adventureWeekly(url, shots) {
  const browser=await chromium.launch();
  let fails=0;
  const errs=[];
  const ok=(value,message,detail)=>{console.log(`${value?'PASS':'FAIL'} ${message}`);if(!value){fails++;if(detail)console.log(JSON.stringify(detail));}};
  // 디자인 검수에 필요한 대표 화면을 먼저 남긴다.
  const priority=['s25','flip-cover','fold-open'];
  const devices=[...DEPARTURE_DEVICES].sort((a,b)=>(priority.includes(a[0])?priority.indexOf(a[0]):3)-(priority.includes(b[0])?priority.indexOf(b[0]):3));
  try {
    for(const [id,name,width,height] of devices) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      try {
        const page=await context.newPage(),tag=`${name} ${width}×${height}`;
        page.on('pageerror',e=>errs.push(`${id}: ${e.message}`));
        page.on('console',m=>{if(m.type()==='error')errs.push(`${id}: ${m.text()}`);});
        await page.clock.install();
        await page.goto(url);await page.clock.runFor(300);
        await page.evaluate(()=>{
          const s=JSON.parse(localStorage.getItem('healer.save'));
          s.tut=99;s.player.level=100;s.settings.devUnlock=false;
          s.clears.rustfort={'쉬움':{stars:3,grade:'S',best:30,n:1}};
          localStorage.setItem('healer.save',JSON.stringify(s));
        });
        await page.reload();await page.clock.runFor(300);await pastTitle(page);
        await page.click('#tabs [data-tab="battle"]');
        const tabRows=[];
        for(const tab of ['explore','dungeon','raid10','raid20']) {
          await page.click(`[data-ctab="${tab}"]`);await page.clock.runFor(30);
          tabRows.push(await page.locator('.b-cats').evaluate((el,tab)=>({tab,row:el.getBoundingClientRect().height,
            heights:[...el.querySelectorAll('[data-ctab]')].map(b=>b.getBoundingClientRect().height)}),tab));
        }
        ok(tabRows.every(r=>r.heights.length===4 && Math.max(...r.heights)-Math.min(...r.heights)<=1)
          && Math.max(...tabRows.map(r=>r.row))-Math.min(...tabRows.map(r=>r.row))<=1,
        `${tag}: 선택·미선택 탭 높이 동일·분류 전환 시 탭 행 높이 유지`,tabRows);
        await page.click('[data-ctab="dungeon"]');
        await chooseContent(page,'rustfort');await page.click('[data-diff="보통"]');
        await page.evaluate(()=>document.fonts.ready);
        await page.locator('#s-content img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
        await page.screenshot({path:`${shots}/departure-weekly-${id}-${width}x${height}.png`});
        console.log(`SHOT ${shots}/departure-weekly-${id}-${width}x${height}.png`);
        let issues=layoutIssues(await departureLayout(page));
        ok(!issues.length,`${tag}: 던전 첫 화면 세로 스크롤·잘림·겹침 없음`,issues);
        const weekly=await page.evaluate(()=>{
          const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
          const chal=r('.b-chal'),cats=r('.b-cats'),gate=r('.b-gate'),regions=r('.b-region-section');
          const hit=document.elementFromPoint((chal.left+chal.right)/2,(chal.top+chal.bottom)/2)?.closest('[data-chal]');
          return {chal,cats,gate,regions,hit:!!hit};
        });
        ok(Math.abs(weekly.chal.height-44)<=1 && weekly.chal.width>=44 && weekly.hit,
          `${tag}: 주간 도전 44px 터치 영역·실제 클릭 위치 확보`,weekly);
        ok(height<=520
          ? Math.abs(weekly.chal.width-104)<=1 && weekly.regions.left>=weekly.chal.right-1 && Math.abs(weekly.chal.top-weekly.regions.top)<=1
          : weekly.cats.bottom<=weekly.chal.top+1 && weekly.chal.bottom<=weekly.gate.top+1,
        `${tag}: 주간 도전은 ${height<=520?'지역 목록 왼쪽 고정':'분류 탭 바로 아래'}에 배치`,weekly);
        const selection=await page.locator('#contentGo').innerText();
        const scroll=await page.locator('.b-regions').evaluate(el=>{el.scrollLeft=el.scrollWidth;return {left:el.scrollLeft,max:el.scrollWidth-el.clientWidth};});
        await page.clock.runFor(80);
        const afterScroll=await page.locator('.b-chal').boundingBox();
        ok(scroll.max>0 && scroll.left>0 && Math.abs(afterScroll.x-weekly.chal.left)<=1 && Math.abs(afterScroll.y-weekly.chal.top)<=1
          && await page.locator('#contentGo').innerText()===selection,`${tag}: 지역을 가로로 넘겨도 주간 도전 위치·출전 선택 유지`,{scroll,afterScroll});
        await page.click('[data-chal]');await page.clock.runFor(100);
        ok(await page.locator('#s-entry').isVisible(),`${tag}: 주간 도전 진입`);
        await page.click('#s-entry .tb-back');await page.clock.runFor(100);
        issues=layoutIssues(await departureLayout(page));
        ok(await page.locator('#s-content').isVisible() && await page.locator('#contentGo').innerText()===selection
          && await page.locator('#s-content').getAttribute('data-selected-content')==='rustfort'
          && await page.locator('#s-content').getAttribute('data-selected-diff')==='보통' && !issues.length,
        `${tag}: 도전 닫기 후 던전·난이도·화면 경계 유지`,issues);

        // 전수 페이지 검사를 반복하지 않고 대표 팝업과 펼침 크기 변경만 확인한다.
        if(priority.includes(id)) {
          const current=page.locator('[data-current-places]');
          if(await current.isVisible())await current.click();else await page.locator('.b-region.on').click();
          issues=layoutIssues(await departureLayout(page));
          ok(!issues.length && await page.locator('[data-content="rustfort"]').getAttribute('aria-pressed')==='true',`${tag}: 대표 장소 팝업 경계·텍스트·현재 선택 정상`,issues);
          await page.locator('.b-place-modal img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
          await page.screenshot({path:`${shots}/departure-weekly-modal-${id}-${width}x${height}.png`});
          const alternate=height<=520?{width:690,height:829}:{width:360,height:360};
          await page.setViewportSize(alternate);await page.clock.runFor(150);
          issues=layoutIssues(await departureLayout(page));
          await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
          ok(!issues.length && await page.evaluate(()=>!!document.activeElement.closest('.b-place-modal'))
            && await page.locator('[data-content="rustfort"]').getAttribute('aria-pressed')==='true',`${tag}: 팝업을 연 채 ${alternate.width}×${alternate.height}로 변경해도 경계·선택·포커스 유지`,issues);
          await page.keyboard.press('Escape');await page.clock.runFor(100);
          ok(await page.locator('.b-place-modal').count()===0 && await page.locator('#contentGo').innerText()===selection,`${tag}: 팝업 resize 뒤 닫기·출전 선택 유지`);
        }
      } catch(e) {fails++;errs.push(`${id}: ${e.stack || e.message}`);console.log(`FAIL ${name}: ${e.message}`);}
      finally {await context.close();}
    }
  } finally {await browser.close();}
  return {fails,errs};
}
