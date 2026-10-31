import { chromium } from 'playwright';
import { chooseContent, pastTitle, shownImagesReady } from './nav.mjs';
import { DEPARTURE_DEVICES, departureLayout, layoutIssues } from './adventure-no-scroll.mjs';

// 실제 A 클리어 확률 (88): 바탕 표 (일반 ~ 희귀)에 +0.02를 밀고, 영웅 · 전설은 따로 (Lv 100: 최대값 × 1.1). 공개모집 보정은 제외.
// 녹슨 요새는 장소 Lv 5 (첫 레벨대, 영웅 없음), 레이드는 그 레이드 레벨 (#296 · 103: 심연의 탑 1층 45 · 악몽 60, 대성당 1구역 70 · 악몽 80), 전설은 최소 Lv 70 이상이며 각 난이도 입장 레벨부터. 칸마다 최소 등급부터 차례로 줄어듦 (Lim 07:49 · 09:36)
// RAID_AGAIN = 그 주에 주 첫 보상을 받은 칸을 다시 깬 판 (2026-10-19 Lim 「주 첫 판만 크게」): 같은 레벨 던전 표 + 20인 어려움 · 악몽 전설 1% × 1.1
const GRADES=['일반','고급','희귀','영웅','전설'];
const GRADE_COLORS=['#C8C8C8','#3FD85A','#4A9BFF','#BE6EFF','#FFD23F'];
const TABLES={
  dungeon:{쉬움:[100,0,0,0,0],보통:[68,32,0,0,0],어려움:[0,78,22,0,0],악몽:[0,63,37,0,0]},
  // 10인 어려움 · 악몽 전설 = 20인의 절반 1% · 2.5% × A 등급 1.1 (#395). 어려움은 전설 1.1%가 영웅 0.29%보다 커서 둘을 고르게 나눔 (descending)
  raid10:{쉬움:[0,57.977214285714,41.9835,0.039285714285714,0],보통:[0,0,99.901785714286,0.098214285714286,0],어려움:[0,0,98.605357142857,0.69732142857143,0.69732142857143],악몽:[0,0,89.392857142857,7.8571428571429,2.75]},
  raid20:{쉬움:[0,0,97.957142857143,2.0428571428571,0],보통:[0,0,95.914285714286,4.0857142857143,0],어려움:[0,0,87.585714285714,10.214285714286,2.2],악몽:[0,0,73.285714285714,21.214285714286,5.5]},
};
const RAID_AGAIN={raid20:{악몽:[0,0,84.757142857143,14.142857142857,1.1]}};
// Lv 70 전의 10인: 레이드 Lv 45 어려움 · Lv 60 악몽의 영웅 확률은 그대로, 전설은 0%.
const RAID10_BEFORE_LEGEND={
  어려움:[0,0,100-15/56*1.1,15/56*1.1,0],
  악몽:[0,0,100-25*16/56*1.1,25*16/56*1.1,0],
};

async function seed(page,{level=100,devUnlock=false,loot=[],cleared=false}={}) {
  await page.evaluate(({level,devUnlock,loot,cleared})=>{
    const s=JSON.parse(localStorage.getItem('healer.save'));
    s.tut=99;s.player.level=level;s.settings.devUnlock=devUnlock;
    // 현재 v10 저장에는 직업을 포함한 키를 넣는다. 구형 키 이관은 별도 storage 단위 테스트의 범위다.
    s.weekly.loot=loot.map(key=>key.split('|').length===2?`${s.hero}|${key}`:key);
    s.clears.rustfort={쉬움:{stars:3,grade:'S',best:30,n:1},보통:{stars:3,grade:'S',best:30,n:1},어려움:{stars:3,grade:'S',best:30,n:1}};
    if(cleared)s.clears.cathedral1={악몽:{stars:3,grade:'S',best:30,n:1}};
    localStorage.setItem('healer.save',JSON.stringify(s));
  },{level,devUnlock,loot,cleared});
  await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.click('#tabs [data-tab="battle"]');
}

async function probabilityBounds(page) {
  return page.locator('.b-reward-chance').evaluate(el=>{
    const r=el.getBoundingClientRect(),close=el.querySelector('[data-reward-close]')?.getBoundingClientRect();
    const inside=(a,b)=>a.left>=b.left-1 && a.top>=b.top-1 && a.right<=b.right+1 && a.bottom<=b.bottom+1;
    const tabs=document.querySelector('#tabs').getBoundingClientRect();
    const viewport={left:0,top:0,right:innerWidth,bottom:Math.min(innerHeight,tabs.top)};
    const clipped=[],occluded=[];
    for(const text of el.querySelectorAll(':scope > b,[data-grade],dt,dd,small,.b-reward-amount b')) {
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
      scroll:el.scrollHeight>el.clientHeight+1 || el.scrollWidth>el.clientWidth+1,clipped,occluded,width:r.width,height:r.height,bottom:r.bottom,tabsTop:tabs.top};
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
    && v.text.includes(v.grade) && [...v.text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].some(m=>Math.abs(Number(m[1])-v.p)<0.0051)); // 화면은 소수 둘째 자리까지
  const icon=icons.length===1 && !oldCount && icons[0].max===highest && icons[0].color===color && icons[0].border===rgb
    && icons[0].p===(expectedSum?1:0) && !icons[0].label.trim() && (expectedSum?icons[0].name.includes(highest):/수령 완료/.test(icons[0].name));
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
          // 장비 · 골드. 강화석은 91 (#192), 레이드 공훈은 2026-10-20에 없앰 → 모든 장소 둘
          ok(rewards.length===2 && rewards.some(r=>r.key==='gear') && rewards.some(r=>r.key==='gold') && !rewards.some(r=>r.key==='stone'||r.key==='merit')
            && rewards.every(r=>r.name && Number.isFinite(r.p) && r.p>=0 && r.p<=1)
            && await page.locator('.b-pop,[data-drops]').count()===0,`${tag} ${tab}: 이름 있는 보상 아이콘 (장비 · 골드)·상세 팝업 제거`,rewards);
          const mainText=await page.locator('#s-content').innerText();
          ok(!/A\s*평가|보너스 제외|좌우로?\s*넘겨/.test(mainText),`${tag} ${tab}: 보상 기준·지역 넘기기 보조문구를 메인에서 제거`);
          // 누름 연출의 일시적인 scale을 제외하고 클릭 대상의 레이아웃 크기를 잰다.
          ok(await page.locator('.b-scene-reward').evaluateAll(els=>els.every(el=>!el.textContent.trim() && !el.querySelector('small')
            && el.offsetWidth>=44 && el.offsetHeight>=44)),`${tag} ${tab}: 보상은 아이콘만 · 누르는 영역 44px 이상`);
          const selected=await page.locator('#contentGo').getAttribute('aria-label'),bad=[];
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
              || (reward.key==='gear' ? state.width>204.1 : state.width>172.1 || percentages.length))bad.push({key:reward.key,p:reward.p,state});
            if(reward.key==='gold') {
              const gold=await pop.locator('.b-reward-amount').evaluate(el=>({amount:Number(el.dataset.amount),text:el.querySelector('b').textContent,
                icon:el.querySelector('.currency-icon')?.dataset.currency}));
              if(!(gold.amount>0) || gold.text!==gold.amount.toLocaleString('ko-KR') || gold.icon!=='gold' || !state.text.includes('골드') || /클리어 시|A 평가/.test(state.text))
                bad.push({key:reward.key,issue:'gold amount/icon instead of probability',gold});
            }
            if(reward.key==='gear') {
              const grades=await inspectProbabilities(page,TABLES[tab][diff],{keepOpen:true});
              if(!grades.ok || /장비 1개|보너스 제외|최소|장비는 판마다/.test(state.text))bad.push({key:reward.key,issue:'grade probability table or basis line',grades,text:state.text});
            }
            if(reward.key==='gear' || (tab==='dungeon' && reward.key==='gold'))
              await page.screenshot({path:`${shots}/departure-reward-chance-${reward.key}-${tab}-${id}-${width}x${height}.png`});
            await page.keyboard.press('Escape');await page.clock.runFor(20);
            if(await pop.count() || !await button.evaluate(el=>document.activeElement===el))bad.push({key:reward.key,issue:'Escape or return focus failed'});
          }
          ok(!bad.length && await page.locator('#contentGo').getAttribute('aria-label')===selected,`${tag} ${tab}: 보상 아이콘 직접 접근·장비 확률·골드 금액·작은 팝오버·Esc 복귀`,bad);
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
          ok(await page.locator('.b-reward-chance').count()===0 && await page.locator('#contentGo').getAttribute('aria-label')===selected,`${tag} ${tab}: 팝오버 바깥 클릭 닫힘·출전 선택 유지`);
          await page.locator('.b-scene-reward-list').evaluate(el=>{el.scrollLeft=0;});
          await page.screenshot({path:`${shots}/departure-rewards-${tab}-${id}-${width}x${height}.png`});
        }
        // 서로 다른 장소가 있는 왕도에서 양방향 버튼의 실제 선택 변경을 확인.
        await page.click('[data-ctab="dungeon"]');await chooseContent(page,'crypt');
        const arrowState=await page.locator('.b-arw').evaluateAll(els=>els.map(el=>({step:el.dataset.step,hasImage:!!el.querySelector('img') || /url\(/.test(getComputedStyle(el).backgroundImage),visible:!!el.getClientRects().length})));
        ok(arrowState.length===2 && arrowState.every(a=>a.visible && a.hasImage),`${tag}: 좌우 화살표를 이미지 버튼으로 표시`,arrowState);
        await page.click('[data-step="1"]');await page.clock.runFor(50);
        ok(await page.locator('#s-content').getAttribute('data-selected-content')==='waxseal',`${tag}: 다음 화살표로 밀랍 봉인실 선택 (같은 레벨 보충 장소, 113)`);
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
          const claimed=await inspectProbabilities(page,RAID_AGAIN.raid20.악몽,{maxGrade:'전설'});
          ok(claimed.ok && /다시 깬 판/.test(claimed.geometry.text) && await page.locator('[data-reward="crystal"]').count()===0,
            '이번 주 첫 보상 받음: 다시 깬 판 등급 표 (던전 표 · 전설 1.1%)·안내·크리스탈 반복 없음',claimed);
          for(const trigger of ['render','icon']) {
            await seed(page,{loot:['cathedral1|악몽'],cleared:true});
            await page.click('[data-ctab="raid20"]');await chooseContent(page,'cathedral1');await page.click('[data-diff="악몽"]');
            const nextWeek=await page.evaluate(()=>{
              const [y,m,d]=JSON.parse(localStorage.getItem('healer.save')).weekly.week.split('-').map(Number);
              return Date.UTC(y,m-1,d+7,0,0,0,1); // 주간 리셋 = 월요일 UTC 00:00 (#528). 기계 시간대 (맥 한국 시각)와 상관없게
            });
            await page.clock.setSystemTime(new Date(nextWeek));
            if(trigger==='render')await page.click('[data-diff="악몽"]');else await page.click('[data-reward="gear"]');
            const reset=await inspectProbabilities(page,TABLES.raid20.악몽,{keepOpen:true});
            ok(reset.ok && await page.locator('[data-reward="merit"], [data-reward="crystal"]').count()===0,
            `월요일 리셋 (UTC 0시)을 지난 뒤 ${trigger==='render'?'난이도 재표시':'장비 아이콘 클릭'}: 장비 갱신 (공훈 없음), 첫클리어 상태 유지`,reset);
            ok(Math.abs(Number(await page.locator('.b-reward-chance [data-grade="전설"]').getAttribute('data-probability'))-.055)<1e-6
              && /5\.5%/.test(await page.locator('.b-reward-chance [data-grade="전설"]').innerText()),`주간 경계 ${trigger}: 확률 표도 새 주 전설 5.5%`);
            await page.keyboard.press('Escape');
          }
          for(const [tab,content,diff,level] of [
            ['raid10','abyss1','어려움',45],['raid10','abyss1','악몽',60],
            ['raid10','abyss1','어려움',69],['raid10','abyss1','악몽',69],
            ['raid10','abyss1','어려움',70],['raid10','abyss1','악몽',70],
            ['raid20','cathedral1','어려움',70],['raid20','cathedral1','악몽',80],
            ['raid20','cathedral1','악몽',99],['raid20','cathedral1','악몽',100],
          ]) {
            await seed(page,{level});await page.click(`[data-ctab="${tab}"]`);await chooseContent(page,content);await page.click(`[data-diff="${diff}"]`);
            const expected=tab==='raid10' && level<70 ? RAID10_BEFORE_LEGEND[diff] : TABLES[tab][diff];
            const state=await inspectProbabilities(page,expected,{keepOpen:true});
            ok(state.ok,`Lv${level} ${tab}/${diff}: 공통 최소 Lv70 · 난이도 입장 레벨에 맞는 최고등급·확률 표시`,state);
            if(level<100)await page.screenshot({path:`${shots}/departure-legend-${tab}-${diff}-lv${level}-${id}.png`});
            await page.keyboard.press('Escape');
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
