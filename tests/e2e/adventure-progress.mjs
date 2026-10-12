import { chromium } from 'playwright';
import { chooseContent, pastTitle } from './nav.mjs';
import { DEPARTURE_DEVICES, departureLayout, layoutIssues } from './adventure-no-scroll.mjs';

const DIFFS=['쉬움','보통','어려움','악몽'];
async function openCurrent(page) {
  const current=page.locator('[data-current-places]');
  if(await current.isVisible())await current.click();else await page.locator('.b-region.on').click();
}

/** 장소 선택 카드: 난이도별 클리어 유무와 별 수를 서로 독립적으로 표시한다. */
export default async function adventureProgress(url,shots) {
  const browser=await chromium.launch();let fails=0;const errs=[];
  const ok=(value,message,detail)=>{console.log(`${value?'PASS':'FAIL'} ${message}`);if(!value){fails++;if(detail)console.log(JSON.stringify(detail));}};
  const priority=['small','s25','flip-cover'];
  const devices=[...DEPARTURE_DEVICES].sort((a,b)=>(priority.includes(a[0])?priority.indexOf(a[0]):3)-(priority.includes(b[0])?priority.indexOf(b[0]):3));
  try {
    for(const [id,name,width,height]of devices) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      try {
        const page=await context.newPage(),tag=`${name} ${width}×${height}`;
        page.on('pageerror',e=>errs.push(`${id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errs.push(`${id}: ${m.text()}`);});
        await page.clock.install();await page.goto(url);await page.clock.runFor(300);
        await page.evaluate(diffs=>{
          const s=JSON.parse(localStorage.getItem('healer.save'));
          s.tut=99;s.player.level=100;s.settings.devUnlock=false;
          s.clears.rustfort=Object.fromEntries(diffs.map((diff,stars)=>[diff,{stars,grade:'A',best:30,n:stars===0?0:1}]));
          delete s.clears.sewer;
          localStorage.setItem('healer.save',JSON.stringify(s));
        },DIFFS);
        await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.click('#tabs [data-tab="battle"]');
        await page.click('[data-ctab="dungeon"]');await chooseContent(page,'rustfort');await openCurrent(page);
        const card=page.locator('[data-content="rustfort"]');
        const progress=await card.locator('.b-place-result').evaluateAll(els=>els.map(el=>({diff:el.dataset.clearDiff,cleared:el.dataset.cleared,stars:Number(el.dataset.stars),aria:el.getAttribute('aria-label'),text:el.querySelector('.b-place-result-stars')?.textContent})));
        ok(progress.length===4 && progress.every((p,i)=>p.diff===DIFFS[i] && p.cleared==='true' && p.stars===i && p.aria===`${DIFFS[i]} 클리어 · 별 ${i}개`
          && (i===0?/✓\s*0/.test(p.text):p.text==='★'.repeat(i)+'☆'.repeat(3-i))),`${tag}: 네 난이도 클리어와 별 0·1·2·3개를 정확히 표시`,progress);
        const label=await card.getAttribute('aria-label');
        ok(DIFFS.every((d,i)=>label.includes(`${d} 클리어 · 별 ${i}개`)),`${tag}: 장소 버튼 이름에 모든 난이도 진행도 포함`,label);
        let issues=layoutIssues(await departureLayout(page));
        ok(!issues.length,`${tag}: 진행도 카드·난이도별 텍스트가 팝업 안에 보이고 세로 스크롤 없음`,issues);
        await page.evaluate(()=>document.fonts.ready);
        await page.locator('.b-place-modal img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
        await page.screenshot({path:`${shots}/departure-place-progress-${id}-${width}x${height}.png`});
        await page.keyboard.press('Escape');
        await chooseContent(page,'sewer');await openCurrent(page);
        const unfinished=await page.locator('[data-content="sewer"] .b-place-result').evaluateAll(els=>els.map(el=>({diff:el.dataset.clearDiff,cleared:el.dataset.cleared,stars:el.dataset.stars,aria:el.getAttribute('aria-label'),text:el.querySelector('.b-place-result-stars')?.textContent})));
        ok(unfinished.length===4 && unfinished.every((p,i)=>p.diff===DIFFS[i] && p.cleared==='false' && p.stars==='0' && p.aria===`${DIFFS[i]} 미클리어` && p.text==='미완료'),
          `${tag}: 다른 장소 미클리어 상태는 클리어 0별과 구별`,unfinished);
        issues=layoutIssues(await departureLayout(page));
        ok(!issues.length,`${tag}: 미완료 카드도 난이도별 글자 잘림 없음`,issues);
        await page.locator('[data-content="sewer"]').click();
        ok(await page.locator('.b-place-modal').count()===0 && await page.locator('#s-content').getAttribute('data-selected-content')==='sewer',`${tag}: 진행도가 있는 장소 카드도 선택 즉시 적용·닫힘`);
      }catch(e){fails++;errs.push(`${id}: ${e.stack||e.message}`);console.log(`FAIL ${name}: ${e.message}`);}
      finally{await context.close();}
    }
  }finally{await browser.close();}
  return {fails,errs};
}
