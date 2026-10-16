import { chromium } from 'playwright';
import { chooseContent, pastTitle, shownImagesReady } from './nav.mjs';
import { DEPARTURE_DEVICES, departureLayout, layoutIssues } from './adventure-no-scroll.mjs';

// 실제 A 클리어 확률: 기본표에 rollGrade의 +0.02를 적용, 공개모집 보정은 제외.
const GRADES=['일반','고급','희귀','영웅','전설'];
const GRADE_COLORS=['#C8C8C8','#3FD85A','#4A9BFF','#BE6EFF','#FF962E'];
const TABLES={
  dungeon:{쉬움:[100,0,0,0,0],보통:[58,42,0,0,0],어려움:[13,55,32,0,0],악몽:[0,33,50,17,0]},
  raid10:{쉬움:[0,58,42,0,0],보통:[0,28,72,0,0],어려움:[0,0,73,27,0],악몽:[0,0,48,52,0]},
  raid20:{쉬움:[0,48,52,0,0],보통:[0,18,82,0,0],어려움:[0,0,63,37,0],악몽:[0,0,33,55,12]},
};

async function seed(page,{level=100,devUnlock=false,loot=[],cleared=false,merit=0}={}) {
  await page.evaluate(({level,devUnlock,loot,cleared,merit})=>{
    const s=JSON.parse(localStorage.getItem('healer.save'));
    s.tut=99;s.player.level=level;s.settings.devUnlock=devUnlock;
    // 현재 v10 저장에는 직업을 포함한 키를 넣는다. 구형 키 이관은 별도 storage 단위 테스트의 범위다.
    s.weekly.loot=loot.map(key=>key.split('|').length===2?`${s.hero}|${key}`:key);s.weekly.merit={10:0,20:merit};
    s.clears.rustfort={쉬움:{stars:3,grade:'S',best:30,n:1},보통:{stars:3,grade:'S',best:30,n:1},어려움:{stars:3,grade:'S',best:30,n:1}};
    if(cleared)s.clears.cathedral1={악몽:{stars:3,grade:'S',best:30,n:1}};
    localStorage.setItem('healer.save',JSON.stringify(s));
  },{level,devUnlock,loot,cleared,merit});
  await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.click('#tabs [data-tab="battle"]');
}

async function probabilityBounds(page) {
  return page.locator('.b-reward-chance').evaluate(el=>{
    const r=el.getBoundingClientRect(),close=el.querySelector('[data-reward-close]')?.getBoundingClientRect();
    const inside=(a,b)=>a.left>=b.left-1 && a.top>=b.top-1 && a.right<=b.right+1 && a.bottom<=b.bottom+1;
    const tabs=document.querySelector('#tabs').getBoundingClientRect();
    const viewport={left:0,top:0,right:innerWidth,bottom:Math.min(innerHeight,tabs.top)};
    const clipped=[],occluded=[];
    for(const text of el.querySelectorAll('[data-grade],dt,dd,small')) {
      if(!text.getClientRects().length)continue;
      const range=document.createRange();range.selectNodeContents(text);
      if(!inside(text.getBoundingClientRect(),r) || [...range.getClientRects()].some(g=>g.width && g.height && (!inside(g,r) || !inside(g,viewport))))
        clipped.push(text.textContent);
    }
    for(const part of el.querySelectorAll('[data-grade],small,[data-reward-close]')) {
      if(!part.getClientRects().length)continue;
      const p=part.getBoundingClientRect(),hit=document.elementFromPoint(p.x+p.width/2,p.y+p.height/2);
      if(!hit || !el.contains(hit))occluded.push(part.dataset.grade || part.textContent);
    }
    return {text:el.textContent,modal:el.getAttribute('aria-modal'),inside:inside(r,viewport),closeInside:!!close && inside(close,r),
      scroll:el.scrollHeight>el.clientHeight+1 || el.scrollWidth>el.clientWidth+1,clipped,occluded,bottom:r.bottom,tabsTop:tabs.top};
  });
}

async function inspectProbabilities(page,expected,{maxGrade,keepOpen=false}={}) {
  const highest=maxGrade || GRADES[expected.findLastIndex(p=>p>0)];
  const color=GRADE_COLORS[GRADES.indexOf(highest)];
  const rgb=`rgb(${color.slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ')})`;
  const icons=await page.locator('[data-reward="gear"]').evaluateAll(els=>els.map(el=>({max:el.dataset.maxGrade,p:Number(el.dataset.probability),
    color:getComputedStyle(el).getPropertyValue('--reward-color').trim().toUpperCase(),border:getComputedStyle(el).borderTopColor,label:el.textContent,name:el.getAttribute('aria-label')})));
  const oldCount=await page.locator('[data-reward^="grade-"]').count();
  const wasOpen=await page.locator('.b-reward-chance [data-grade]').count()>0;
  if(!wasOpen) {await page.locator('[data-reward="gear"]').scrollIntoViewIfNeeded();await page.click('[data-reward="gear"]');await page.clock.runFor(20);}
  const values=await page.locator('.b-reward-chance [data-grade]').evaluateAll(els=>els.map(el=>({grade:el.dataset.grade,p:Number(el.dataset.probability)*100,text:el.textContent})));
  // 나오는 등급만 (2026-10-13 Lim: 0% 등급은 안 보임), 높은 등급부터
  const wanted=GRADES.map((grade,i)=>({grade,p:expected[i]})).reverse().filter(w=>w.p>0);
  const geometry=await probabilityBounds(page),sum=values.reduce((n,v)=>n+v.p,0),expectedSum=expected.reduce((n,p)=>n+p,0);
  const rows=values.length===wanted.length && values.every((v,i)=>v.grade===wanted[i].grade && Math.abs(v.p-wanted[i].p)<1e-6
    && v.text.includes(v.grade) && [...v.text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].some(m=>Math.abs(Number(m[1])-v.p)<1e-4));
  const icon=icons.length===1 && !oldCount && icons[0].max===highest && icons[0].color===color && icons[0].border===rgb
    && icons[0].p===(expectedSum?1:0) && (expectedSum?icons[0].name.includes(highest):/수령 완료/.test(icons[0].label));
  const ok=rows && icon && Math.abs(sum-expectedSum)<1e-6 && geometry.inside && geometry.closeInside && !geometry.scroll && !geometry.clipped.length && !geometry.occluded.length;
  if(!keepOpen && !wasOpen){await page.keyboard.press('Escape');await page.clock.runFor(20);}
  return {values,wanted,icons,oldCount,sum,geometry,ok};
}

/** 장면 보상 아이콘과 작은 확률 팝오버. 7비율에서 실제 포인터 접근과 장소 이동을 검증한다. */
export default async function adventureRewards(url,shots) {
  const browser=await chromium.launch();let fails=0;const errs=[];
  const ok=(value,message,detail)=>{console.log(`${value?'PASS':'FAIL'} ${message}`);if(!value){fails++;if(detail)console.log(JSON.stringify(detail));}};
  try {
    for(const [id,name,width,height] of DEPARTURE_DEVICES) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      try {
        const page=await context.newPage(),tag=`${name} ${width}×${height}`;
        page.on('pageerror',e=>errs.push(`${id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errs.push(`${id}: ${m.text()}`);});
        await page.clock.install();await page.goto(url);await page.clock.runFor(300);await seed(page);
        for(const [tab,content,diff] of [['dungeon','rustfort','보통'],['raid20','cathedral1','악몽']]) {
          await page.click(`[data-ctab="${tab}"]`);await chooseContent(page,content);await page.click(`[data-diff="${diff}"]`);
          await page.evaluate(()=>document.fonts.ready);
          await shownImagesReady(page);
          const issues=layoutIssues(await departureLayout(page));
          ok(!issues.length,`${tag} ${tab}/${diff}: 화면·장면 보상·중앙 화살표 경계/겹침/세로 스크롤 없음`,issues);
          if(tab==='dungeon') {
            const art=await page.evaluate(async()=>{
              const selectors=['.b-chal','.b-level','.b-current-places','.b-arw.prev','.b-arw.next'];
              return Promise.all(selectors.map(async selector=>{
                const el=document.querySelector(selector);
                if(!el?.getClientRects().length)return {selector,hidden:true,loaded:true};
                const sources=[...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]);
                sources.push(...[...el.querySelectorAll('img')].map(i=>i.src));
                const loaded=await Promise.all(sources.map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=src;})));
                return {selector,sources,loaded:!!sources.length && loaded.every(Boolean)};
              }));
            });
            ok(art.every(a=>a.loaded),`${tag}: 주간 도전·장소 변경·권장 레벨·화살표 이미지 로드`,art);
          }
          const expected=await inspectProbabilities(page,TABLES[tab][diff]);
          ok(expected.ok,`${tag} ${tab}/${diff}: 최고등급 색 장비 아이콘 1개·나오는 등급만 확률표·합 100%`,expected);
          const rewards=await page.locator('.b-scene-reward').evaluateAll(els=>els.map(el=>({key:el.dataset.reward,p:Number(el.dataset.probability),name:el.getAttribute('aria-label')})));
          ok(rewards.length>2 && rewards.every(r=>r.name && Number.isFinite(r.p) && r.p>=0 && r.p<=1)
            && await page.locator('.b-pop,[data-drops]').count()===0,`${tag} ${tab}: 이름 있는 보상 아이콘·상세 팝업 제거`,rewards);
          const mainText=await page.locator('#s-content').innerText();
          ok(!/A\s*평가|보너스 제외|좌우로?\s*넘겨/.test(mainText),`${tag} ${tab}: 보상 기준·지역 넘기기 보조문구를 메인에서 제거`);
          const selected=await page.locator('#contentGo').innerText(),bad=[];
          for(const reward of rewards) {
            const button=page.locator(`[data-reward="${reward.key}"]`);
            await button.scrollIntoViewIfNeeded();await page.clock.runFor(20);
            const hit=await button.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-reward]')===el;});
            if(!hit){bad.push({key:reward.key,issue:'center pointer blocked'});continue;}
            await button.click();await page.clock.runFor(20);
            const pop=page.locator('.b-reward-chance');
            if(!await pop.isVisible()){bad.push({key:reward.key,issue:'popover missing'});continue;}
            const state=await probabilityBounds(page);
            const percentages=[...state.text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m=>Number(m[1]));
            if(!state.inside || !state.closeInside || state.scroll || state.clipped.length || state.occluded.length || state.modal!=='false'
              || (reward.key!=='gear' && !percentages.some(p=>Math.abs(p-reward.p*100)<1e-4)))bad.push({key:reward.key,p:reward.p,state});
            if(reward.key==='gear') {
              const grades=await inspectProbabilities(page,TABLES[tab][diff],{keepOpen:true});
              if(!grades.ok || /장비 1개|보너스 제외/.test(state.text))bad.push({key:reward.key,issue:'grade probability table or basis line',grades,text:state.text});
            }
            if(reward.key==='gear' || (tab==='dungeon' && reward.key==='stone'))
              await page.screenshot({path:`${shots}/departure-reward-chance-${reward.key}-${tab}-${id}-${width}x${height}.png`});
            await page.keyboard.press('Escape');await page.clock.runFor(20);
            if(await pop.count() || !await button.evaluate(el=>document.activeElement===el))bad.push({key:reward.key,issue:'Escape or return focus failed'});
          }
          ok(!bad.length && await page.locator('#contentGo').innerText()===selected,`${tag} ${tab}: 모든 ${rewards.length}개 보상 아이콘 직접 접근·확률·화면 내 팝오버·Esc 복귀`,bad);
          await page.locator('[data-reward]').first().click();await page.click('[data-reward-close]');
          ok(await page.locator('.b-reward-chance').count()===0,`${tag} ${tab}: 확률 닫기 버튼`);
          await page.locator('[data-reward]').first().click();
          const outside=await page.evaluate(()=>{
            const root=document.querySelector('#s-content'),r=root.getBoundingClientRect();
            for(let y=r.top+3;y<r.bottom;y+=8)for(let x=r.left+3;x<r.right;x+=8){
              const el=document.elementFromPoint(x,y);
              if(el && root.contains(el) && !el.closest('.b-reward-chance,button,a,input,[role="tab"]'))return {x,y};
            }
            return null;
          });
          if(!outside)throw new Error('확률 팝오버 밖의 비조작 영역을 찾지 못함');
          await page.mouse.click(outside.x,outside.y);
          ok(await page.locator('.b-reward-chance').count()===0 && await page.locator('#contentGo').innerText()===selected,`${tag} ${tab}: 팝오버 바깥 클릭 닫힘·출전 선택 유지`);
          await page.locator('.b-scene-reward-list').evaluate(el=>{el.scrollLeft=0;});
          await page.screenshot({path:`${shots}/departure-rewards-${tab}-${id}-${width}x${height}.png`});
        }
        // 서로 다른 장소가 있는 왕도에서 양방향 버튼의 실제 선택 변경을 확인.
        await page.click('[data-ctab="dungeon"]');await chooseContent(page,'crypt');
        const arrowState=await page.locator('.b-arw').evaluateAll(els=>els.map(el=>({step:el.dataset.step,hasImage:!!el.querySelector('img') || /url\(/.test(getComputedStyle(el).backgroundImage),visible:!!el.getClientRects().length})));
        ok(arrowState.length===2 && arrowState.every(a=>a.visible && a.hasImage),`${tag}: 좌우 화살표를 이미지 버튼으로 표시`,arrowState);
        await page.click('[data-step="1"]');await page.clock.runFor(50);
        ok(await page.locator('#s-content').getAttribute('data-selected-content')==='greenhouse',`${tag}: 다음 화살표로 역병 약초 온실 선택`);
        await page.click('[data-step="-1"]');await page.clock.runFor(50);
        ok(await page.locator('#s-content').getAttribute('data-selected-content')==='crypt',`${tag}: 이전 화살표로 역병 지하묘지 복귀`);

        if(id==='s25') {
          const bad=[];
          for(const [tab,content] of [['dungeon','rustfort'],['raid10','abyss1'],['raid20','cathedral1']]) {
            await page.click(`[data-ctab="${tab}"]`);await chooseContent(page,content);
            for(const diff of Object.keys(TABLES[tab])) {
              await page.click(`[data-diff="${diff}"]`);
              const state=await inspectProbabilities(page,TABLES[tab][diff]);if(!state.ok)bad.push({tab,diff,...state});
            }
          }
          ok(!bad.length,'S25: 탐험/던전·10인·20인 12개 난이도 조합 A 등급 분포',bad);
          const opener='[data-reward="gear"]';await page.click(opener);
          for(const viewport of [{width:360,height:330},{width:360,height:360},{width:690,height:829}]) {
            await page.setViewportSize(viewport);await page.clock.runFor(150);
            const bounds=await probabilityBounds(page);
            ok(bounds.inside && bounds.closeInside && !bounds.scroll && !bounds.clipped.length && !bounds.occluded.length,
              `확률 표 resize ${viewport.width}×${viewport.height}: 5행·닫기·기준 문구를 화면 안 유지`,bounds);
          }
          await page.keyboard.press('Escape');await page.setViewportSize({width,height});await page.clock.runFor(150);
          ok(await page.locator('.b-reward-chance').count()===0,'확률 팝오버 resize 후 Esc 닫기');
          ok(await page.locator('[data-reward="crystal"]').count()===0,'첫 클리어 크리스탈 없음 (81)');
          await seed(page,{loot:['cathedral1|악몽'],cleared:true});await page.click('[data-ctab="raid20"]');await chooseContent(page,'cathedral1');await page.click('[data-diff="악몽"]');
          const claimed=await inspectProbabilities(page,[0,0,0,0,0],{maxGrade:'전설'});
          ok(claimed.ok && /이번 주 장비 수령 완료/.test(claimed.geometry.text) && await page.locator('[data-reward="crystal"]').count()===0,
            '이번 주 수령 완료: 단일 장비 아이콘·등급 줄 없음·완료 안내·크리스탈 반복 없음',claimed);
          for(const trigger of ['render','icon']) {
            await seed(page,{loot:['cathedral1|악몽'],cleared:true,merit:150});
            await page.click('[data-ctab="raid20"]');await chooseContent(page,'cathedral1');await page.click('[data-diff="악몽"]');
            const nextWeek=await page.evaluate(()=>{
              const [y,m,d]=JSON.parse(localStorage.getItem('healer.save')).weekly.week.split('-').map(Number);
              return new Date(y,m-1,d+7,6,0,0,1).getTime();
            });
            await page.clock.setSystemTime(new Date(nextWeek));
            if(trigger==='render')await page.click('[data-diff="악몽"]');else await page.click('[data-reward="gear"]');
            const reset=await inspectProbabilities(page,[0,0,33,55,12],{keepOpen:true});
            ok(reset.ok && await page.locator('[data-reward="merit"]').getAttribute('data-probability')==='1'
              && (await page.locator('[data-reward="merit"] small').innerText()).trim()==='30'
              && await page.locator('[data-reward="crystal"]').count()===0,
            `월요일 06시를 지난 뒤 ${trigger==='render'?'난이도 재표시':'장비 아이콘 클릭'}: 장비·공훈 갱신, 첫클리어 상태 유지`,reset);
            ok(Math.abs(Number(await page.locator('.b-reward-chance [data-grade="전설"]').getAttribute('data-probability'))-.12)<1e-6
              && /12%/.test(await page.locator('.b-reward-chance [data-grade="전설"]').innerText()),`주간 경계 ${trigger}: 확률 표도 새 주 전설 12%`);
            await page.keyboard.press('Escape');
          }
          for(const level of [49,50]) {
            await seed(page,{level,devUnlock:true});await page.click('[data-ctab="raid20"]');await chooseContent(page,'cathedral1');await page.click('[data-diff="악몽"]');
            const state=await inspectProbabilities(page,level<50?[0,0,33,67,0]:[0,0,33,55,12]);
            ok(state.ok,`Lv${level}: 실제 최고등급 ${level<50?'영웅·전설 0%':'전설·전설 12%'}와 등급별 확률 일치`,state);
          }
        }
        // 긴 실제 이름과 잠금 안내가 함께 나와도 중앙 제목을 줄이거나 가리지 않는다.
        for(const locked of [false,true]) {
          await seed(page,{level:locked?1:100});
          // 레벨이 모자란 장소는 장소 줄에서 숨김: 다 잠긴 분류에서 보이는 다음에 열릴 한 곳으로 잠금 안내를 확인
          const cases=locked?[['dungeon','rustfort','녹슨 요새'],['raid20','cathedral1','가라앉은 대성당 1구역']]:[['dungeon','sandlibrary','모래 서기관 도서관'],['raid20','cathedral3','가라앉은 대성당 오르간']];
          for(const [tab,content,expectedName] of cases) {
            await page.click(`[data-ctab="${tab}"]`);await chooseContent(page,content);
            await page.evaluate(()=>document.fonts.ready);
            const issues=layoutIssues(await departureLayout(page));
            const text=await page.locator('.b-gn b').innerText();
            ok(!issues.length && text===expectedName && (!locked || await page.locator('.b-st').isVisible()),
              `${tag} ${tab}/${locked?'잠김':'열림'}: 긴 장소 이름 전체 표시·화살표 사이 중앙·안내와 비겹침`,{text,issues});
            if(['small','s25','flip-cover'].includes(id)) {
              await shownImagesReady(page);
              await page.screenshot({path:`${shots}/departure-title-${tab}-${locked?'locked':'open'}-${id}-${width}x${height}.png`});
            }
          }
        }
      }catch(e){fails++;errs.push(`${id}: ${e.stack || e.message}`);console.log(`FAIL ${name}: ${e.message}`);}
      finally{await context.close();}
    }
  }finally{await browser.close();}
  return {fails,errs};
}
