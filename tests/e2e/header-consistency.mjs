import { chromium } from 'playwright';
import { pastTitle, toParty } from './nav.mjs';
import { DEPARTURE_DEVICES } from './adventure-no-scroll.mjs';

async function headerGeometry(page, screen) {
  return page.locator(`${screen} .topbar`).evaluate(header=>{
    if(!header.getClientRects().length)return {hidden:true};
    const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const visible=el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
    const within=(a,b)=>a.left>=b.left-1 && a.top>=b.top-1 && a.right<=b.right+1 && a.bottom<=b.bottom+1;
    const apart=(a,b)=>a.right<=b.left+1 || a.left>=b.right-1 || a.bottom<=b.top+1 || a.top>=b.bottom-1;
    const rect=box(header),viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
    const mmo=header.classList.contains('tb-mmo');
    const selectors=mmo?'.tb-pf,.tb-nm,.tb-wal,.tb-set':'.tb-back,.tb-title,.tb-set,.f-em,.f-tb,.f-gbtn';
    const parts=[...header.querySelectorAll(selectors)].filter(visible).map(el=>({selector:el.className,rect:box(el)}));
    const outside=parts.filter(p=>!within(p.rect,rect) || !within(p.rect,viewport));
    const overlaps=parts.flatMap((p,i)=>parts.slice(i+1).filter(q=>!apart(p.rect,q.rect)).map(q=>`${p.selector}/${q.selector}`));
    const glyphs=[];
    for(const el of header.querySelectorAll('.tb-cls,.tb-lv,.tb-cur b,.tb-title,.f-ttl,.f-hcap')) {
      if(!visible(el))continue;
      const range=document.createRange();range.selectNodeContents(el);
      if([...range.getClientRects()].some(r=>r.width && r.height && !within(r,rect)))glyphs.push(el.textContent);
    }
    const controls=[...header.querySelectorAll('button')].filter(visible).map(el=>{
      const r=box(el),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      return {selector:el.className,rect:r,hit:!!hit && el.contains(hit)};
    });
    const portrait=header.querySelector('.tb-pf');
    return {hidden:false,rect,portrait:portrait?box(portrait):null,parts,outside,overlaps,glyphs,controls,
      inside:within(rect,viewport),background:getComputedStyle(header,mmo?'::before':null).backgroundImage};
  });
}

/** 모든 탭 루트는 전투 출전 높이·초상 크기를 공유한다. 커버에서는 상세 뒤로 가기만 44px로 남긴다. */
export default async function headerConsistency(url,shots) {
  const browser=await chromium.launch();let fails=0;const errs=[];
  const ok=(value,message,detail)=>{console.log(`${value?'PASS':'FAIL'} ${message}`);if(!value){fails++;if(detail)console.log(JSON.stringify(detail));}};
  try {
    for(const[id,name,width,height]of DEPARTURE_DEVICES) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      try {
        const page=await context.newPage(),tag=`${name} ${width}×${height}`,short=height<=520;
        const expectedHeight=short?44:height<=700?54:height<=800?64:80;
        const expectedPortrait=height<=700?44:height<=800?50:width<359?54:70;
        page.on('pageerror',e=>errs.push(`${id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errs.push(`${id}: ${m.text()}`);});
        await page.clock.install();await page.goto(url);await page.clock.runFor(300);
        await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.tut=99;s.player.level=100;s.stamina={n:140,at:Date.now(),day:'',ads:0};s.bought=['noads'];s.settings.devUnlock=false;localStorage.setItem('healer.save',JSON.stringify(s));});
        await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.evaluate(()=>document.fonts.ready);
        const headers=[];
        for(const[tab,screen,label]of[['lobby','#s-lobby','로비'],['battle','#s-content','전투'],['char','#s-char','캐릭터'],['guild','#s-guild','길드']]) {
          await page.click(`#tabs [data-tab="${tab}"]`);await page.clock.runFor(80);
          const g=await headerGeometry(page,screen);headers.push(g);
          const valid=short?g.hidden:!g.hidden && Math.abs(g.rect.height-expectedHeight)<=1 && Math.abs(g.portrait.height-expectedPortrait)<=1
            && Math.abs((g.portrait.top+g.portrait.bottom)/2-(g.rect.top+g.rect.bottom)/2)<=1
            && g.inside && !g.outside.length && !g.overlaps.length && !g.glyphs.length && g.controls.every(c=>c.hit);
          ok(valid,`${tag} ${label}: ${short?'MMO 헤더 공통 숨김':`공통 높이 ${expectedHeight}·초상 ${expectedPortrait} 중앙·정보와 설정 안전 경계`}`,g);
          await page.screenshot({path:`${shots}/header-${id}-${tab}-${width}x${height}.png`});
        }
        ok(short?headers.every(h=>h.hidden):headers.every(h=>h.rect.height===headers[1].rect.height && h.portrait.height===headers[1].portrait.height
          && Math.abs(h.portrait.top-h.rect.top-(headers[1].portrait.top-headers[1].rect.top))<=1 && h.background===headers[1].background),
          `${tag}: 로비·전투·캐릭터·길드 헤더와 초상 위치 일치`,headers);

        // 커버에서는 펼친 상태로 연 설정을 접어도 뒤로 가기가 남아야 한다.
        if(short){await page.setViewportSize({width,height:780});await page.clock.runFor(80);}
        await page.click('#s-guild .tb-set');await page.clock.runFor(80);
        if(short){await page.setViewportSize({width,height});await page.clock.runFor(80);}
        let detail=await headerGeometry(page,'#s-settings');
        ok(!detail.hidden && Math.abs(detail.rect.height-expectedHeight)<=1 && detail.inside && !detail.outside.length && !detail.overlaps.length
          && !detail.glyphs.length && detail.controls.every(c=>c.hit && c.rect.width>=44 && c.rect.height>=44),
          `${tag}: 설정 상세 헤더 ${expectedHeight}px·44px 뒤로 가기 유지`,detail);
        await page.click('#s-settings .tb-back');
        ok(await page.locator('#s-guild').isVisible(),`${tag}: 상세 뒤로 가기로 길드 복귀`); // #231: 상점이 탭에서 빠져 마지막 탭 = 길드

        await toParty(page,{content:'rustfort',tab:'dungeon',diff:'쉬움'});
        detail=await headerGeometry(page,'#s-party');
        ok(!detail.hidden && Math.abs(detail.rect.height-expectedHeight)<=1 && detail.inside && !detail.outside.length && !detail.overlaps.length
          && !detail.glyphs.length && detail.controls.every(c=>c.hit && c.rect.height>=44),
          `${tag}: 편성 헤더 ${expectedHeight}px·뒤로 가기와 제목 경계`,detail);
        await page.screenshot({path:`${shots}/header-${id}-party-${width}x${height}.png`});
        await page.click('#s-party .tb-back');
        ok(await page.locator('#s-content').isVisible(),`${tag}: 편성 뒤로 가기로 출전 복귀`);
      }catch(e){fails++;errs.push(`${id}: ${e.stack||e.message}`);console.log(`FAIL ${name}: ${e.message}`);}
      finally{await context.close();}
    }
  }finally{await browser.close();}
  return {fails,errs};
}
