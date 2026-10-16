import {chromium} from 'playwright';
import {departGo,patchSave,toParty} from './nav.mjs';
export default async function classControls(url,shots){
 const b=await chromium.launch(),errs=[],baseline={};let fails=0;
 const auxPicks={priest:[null,null,null,null,0,null,1,null,null,0],druid:[null,null,null,null,0,null,null,null,null,0],paladin:[null,null,null,null,0,null,null,null,null,0],shaman:[null,null,null,null,1,null,null,null,null,0],monk:[null,null,null,null,1,null,null,2,null,0],astrologer:[null,null,null,null,1,null,null,null,null,0],warder:[null,null,null,null,0,null,null,null,null,0]};
 const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
 for(const [width,height] of [[320,640],[360,780],[390,844]]){
  for(const hero of ['priest','druid','paladin','shaman','monk','astrologer','warder']){for(const hasAux of [false,true]){
   const ctx=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),p=await ctx.newPage();
   p.on('pageerror',e=>errs.push(e.message));await p.clock.install();await p.goto(url);await p.clock.runFor(300);
   await patchSave(p,{player:{level:100},items:['mana','life'],bag:{mana:9,life:9},settings:{devUnlock:true,devStamina:true,auto:false}});
   await p.evaluate(([hero,picks])=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.hero=hero;s.bought??={};s.bought['job_'+hero]=true;s.heroes[hero]??={};s.heroes[hero].talents=picks;localStorage.setItem('healer.save',JSON.stringify(s));},[hero,hasAux?auxPicks[hero]:Array(10).fill(null)]);
   await p.reload();await p.clock.runFor(300);await toParty(p,{tab:'dungeon',content:'rustfort',diff:'보통'});await departGo(p);await p.clock.runFor(3400);
   await p.evaluate(()=>{
    const f=window.__proto.F;f.skills.forEach(k=>k.next=Infinity);f.g.p=75;f.power3=2;
    f.beat=3;f.beatUntil=f.t+2;f.shards=2;
    f.totems=[{kind:'spring',cell:0,until:f.t+9.9,tick:1,at:f.t},{kind:'earth',cell:1,until:f.t+10,tick:1,at:f.t}];
    f.cd.springTotem=3;
   });await p.clock.runFor(80);
   await p.locator('#controls img').evaluateAll(is=>Promise.all(is.map(i=>i.decode())));
   for(const compact of [true]){
    ok(await p.locator('#pauseCompact').count()===0&&await p.locator('#controls').evaluate(e=>e.classList.contains('compact-controls')),hero+' fixed compact without size toggle');
    const check=await p.evaluate(()=>{
     const c=document.querySelector('#controls'),g=document.querySelector('.job-gauge'),frame=document.querySelector('#controlsFrame'),cr=c.getBoundingClientRect(),gr=g.getBoundingClientRect(),scale=+c.dataset.uiScale;
     const items=[...document.querySelectorAll('#items .item')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};});
     const compact=c.classList.contains('compact-controls'),host=document.querySelector('#gauges').getBoundingClientRect(),wheel=document.querySelector('#wheel').getBoundingClientRect();
     const fr=frame.getBoundingClientRect(),rel=e=>{const r=e.getBoundingClientRect();return[r.x-fr.x,r.y-fr.y,r.width,r.height];},aux=document.querySelector('#aux').getBoundingClientRect(),cast=document.querySelector('#castbar').getBoundingClientRect();
     return {job:g.dataset.job,background:getComputedStyle(compact?frame:c).backgroundImage+' '+getComputedStyle(frame).borderImageSource,
      positions:[rel(g),rel(document.querySelector('#wheel')),...[...document.querySelectorAll('#items .item,#wheel .slot,#core')].map(rel)],
      auxCount:document.querySelectorAll('#aux .aux').length,auxFit:aux.height===0||(aux.top>=gr.bottom&&aux.bottom<=Math.min(...items.map(r=>r.top))&&aux.left>=fr.left+(innerWidth<360?6:12)&&aux.right<=wheel.left&&aux.top>fr.top),
      board:document.querySelector('#boardWrap').getBoundingClientRect().height,frameTop:fr.top,
      timersFit:[...g.querySelectorAll('.gauge-number,.gauge-extra')].filter(e=>e.textContent).every(e=>{const r=e.getBoundingClientRect();return r.left>=gr.left-1&&r.right<=gr.right+1&&r.top>=gr.top-1&&r.bottom<=gr.bottom+1;}),
      touchClear:[...c.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);}),frame:getComputedStyle(document.querySelector('#items .item')).backgroundImage,
      oldFrameGone:!compact||getComputedStyle(frame,'::before').content==='none',
      aligned:Math.abs((gr.left+gr.right)-(host.left+host.right))<1&&Math.abs((gr.top+gr.bottom)-(host.top+host.bottom))<1,
      twoSlots:items.length===2&&Math.abs(items[0].top-items[1].top)<1&&items.every(r=>Math.abs(r.width-r.height)<1&&r.width>=44),
      itemsFit:items.every(r=>r.bottom<=cr.bottom-20&&r.top>=gr.bottom+7*scale&&r.left>=cr.left+12&&r.right<=cr.right-12),
      wheelFit:wheel.bottom<=cr.bottom-14&&wheel.top>=cr.top+8&&wheel.right<=cr.right-16,
      gaugeSize:[gr.width,gr.height],items,
      hitMin:+c.dataset.effectiveTouchMin,hitOverlap:c.dataset.hitAreasOverlap,bottom:cr.bottom,images:[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)};
    });
    const label=hero+' '+width+' '+(hasAux?'aux':'base');
    if(hero==='priest'&&!hasAux)baseline[width]={positions:check.positions,board:check.board,frameTop:check.frameTop};
    // 보조 특성 버튼 (2026-10-16): 왼쪽 묶음 안 아이템 줄 위. 전투판 · 조작판 크기와 휠 · 아이템 좌표는 그대로, 자원 그림만 줄어듦
    ok(check.positions.every((r,i)=>(hasAux&&i===0)||r.every((v,k)=>Math.abs(v-baseline[width].positions[i][k])<.35))&&Math.abs(check.board-baseline[width].board)<.5&&Math.abs(check.frameTop-baseline[width].frameTop)<.5,label+' 사제 B안 공통 좌표 · 전투판 크기 그대로');
    ok(check.auxCount===(hasAux?auxPicks[hero].filter(x=>x!==null).length:0)&&check.auxFit&&check.timersFit&&check.touchClear,label+' 보조 행·타이머·터치 비침범 '+JSON.stringify(check));
    ok(check.job===hero&&check.background.includes('ui-class-'+hero+'-background')&&check.frame.includes('ui-class-'+hero+'-item-frame')&&check.oldFrameGone,label+' class materials');
    ok(check.twoSlots&&check.itemsFit&&check.wheelFit&&check.aligned&&check.images&&check.gaugeSize[1]>=50&&check.hitMin>=43.9&&check.hitOverlap==='false',label+' aligned gauge/items safe insets '+JSON.stringify(check));
    await p.locator('#controlsFrame').screenshot({path:shots+'/class-controls-'+hero+'-'+width+'-'+(hasAux?'aux':'base')+'.png'});
   }
   if(hasAux&&width===320)await p.screenshot({path:shots+'/class-controls-'+hero+'-'+width+'-aux-screen.png'});
   if(hero==='shaman'){
    const aura=await p.locator('.totem-aura').evaluateAll(es=>es.map(e=>!e.hidden));ok(aura.every(Boolean),'both active totem auras');
    await p.evaluate(()=>{window.__proto.F.totems=[];});await p.clock.runFor(80);
    ok(await p.locator('.totem-aura').evaluateAll(es=>es.every(e=>e.hidden)),'expired totem auras off');
   }
   if(hero==='astrologer'||hero==='monk'){
    await p.evaluate(hero=>{const f=window.__proto.F;f.tx.on[hero==='monk'?'sevenBeat':'fifthStar']=true;if(hero==='monk'){f.beat=7;f.beatUntil=f.t+3;}else f.shards=4;},hero);
    await p.clock.runFor(80);
    ok(await p.locator('.variant-segment').count()===(hero==='monk'?7:4),hero+' talent slots visible');
    await p.locator('#controls').screenshot({path:shots+'/class-controls-'+hero+'-talent-'+width+'-'+(hasAux?'aux':'base')+'.png'});
   }
   // 배경 프레임 수정 후에도 빈 자원·최대 자원·시간 숫자의 슬롯과 터치를 보존한다.
   for(const full of [false,true]){
    await p.evaluate(full=>{const f=window.__proto.F;f.g.p=full?100:0;f.power3=full?3:0;f.beat=full?(f.tx.on.sevenBeat?7:5):0;f.beatUntil=f.t+9.9;f.shards=full?(f.tx.on.fifthStar?4:3):0;
     f.party.forEach(u=>{u.alive=true;u.hp=u.max;u.dps=0;u.hots=full?[{key:'sprout',name:'새싹',left:99,every:999,tick:999,per:1,i:0,rest:100}]:[];u.seal=full?f.t+99:0;});
     f.totems=full?[{kind:'spring',cell:0,until:f.t+20,tick:999,at:f.t},{kind:'earth',cell:1,until:f.t+20,tick:999,at:f.t}]:[];f.cd.springTotem=full?24:0;
    },full);await p.clock.runFor(160);
    const state=await p.evaluate(()=>{const g=document.querySelector('.job-gauge'),r=g.getBoundingClientRect(),c=document.querySelector('#controls'),frame=document.querySelector('#controlsFrame');return{ready:g.dataset.ready==='true',value:+g.dataset.value,frameVersion:frame.dataset.panelVersion,
     numbers:[...g.querySelectorAll('.gauge-number,.gauge-extra')].filter(e=>e.textContent).every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1;}),
     touch:[...c.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width).every(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return hit===e||e.contains(hit);})};});
    ok(state.ready===full&&state.numbers&&state.touch&&state.frameVersion===(hero==='priest'?'original':hero==='paladin'?'b4':'b3'),hero+' '+width+' '+(hasAux?'aux':'base')+' '+(full?'full':'empty')+' 자원·숫자·프레임·터치 '+JSON.stringify(state));
    if(width===360)await p.locator('#controlsFrame').screenshot({path:shots+'/class-controls-'+hero+'-360-'+(hasAux?'aux':'base')+'-'+(full?'full':'empty')+'.png'});
   }
   await ctx.close();
  }}
 }
 // 채택 B안의 폭별 위치와 resize 복귀. 저장을 주입한 독립 브라우저에서만 확인한다.
 const p=await b.newPage({viewport:{width:320,height:780},isMobile:true,hasTouch:true});
 p.on('pageerror',e=>errs.push(e.message));await p.clock.install();await p.goto(url);await p.clock.runFor(300);
 await patchSave(p,{player:{level:100},items:[],settings:{devUnlock:true,devStamina:true,auto:false}});
 await toParty(p,{tab:'dungeon',content:'rustfort',diff:'보통'});await departGo(p);await p.clock.runFor(3400);
 await p.evaluate(()=>{const f=window.__proto.F;f.skills.forEach(k=>k.next=Infinity);f.g.p=100;});await p.clock.runFor(80);
 for(const hand of ['right','left']){
  await p.evaluate(hand=>window.__battle.settings({...JSON.parse(localStorage.getItem('healer.save')).settings,hand,hero:'priest'}),hand);
  for(const [width,inset,wheelInset] of [[320,27.6,17],[360,37.7,17],[390,51.6,29],[320,27.6,17]]){
   await p.setViewportSize({width,height:780});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));await p.clock.runFor(40);
   await p.locator('#controls img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));
   const g=await p.evaluate(()=>{
    const r=e=>e.getBoundingClientRect().toJSON(),c=document.getElementById('controls');
    return{frame:r(document.getElementById('controlsFrame')),gauge:r(document.querySelector('.job-gauge')),wheel:r(document.getElementById('wheel')),
     items:[...document.querySelectorAll('#items .item')].map(r),overlap:c.dataset.hitAreasOverlap,scale:+c.dataset.uiScale};
   });
   const sideInset=hand==='right'?g.items[0].left:g.frame.right-g.items[1].right;
   const skillInset=hand==='right'?g.frame.right-g.wheel.right:g.wheel.left;
   ok(Math.abs(sideInset-inset)<.3&&Math.abs(skillInset-wheelInset)<.3&&Math.abs(g.gauge.height-117)<.3
    &&Math.abs(g.items[0].top-g.frame.top-139.5)<.3&&g.items.every(r=>Math.abs(r.width-45)<.3&&Math.abs(r.height-45)<.3)
    &&g.overlap==='false',`B안 ${width} ${hand}: 폭별 위치·정사각형·resize 복귀 `+JSON.stringify(g));
   await p.locator('#controlsFrame').screenshot({path:shots+`/panel-b-${width}-${hand}.png`});
  }
 }
 await p.close();await b.close();return{fails,errs};
}
