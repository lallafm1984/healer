import {chromium} from 'playwright';
import {departGo,patchSave,toParty} from './nav.mjs';
export default async function classControls(url,shots){
 const b=await chromium.launch(),errs=[];let fails=0;
 const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
 for(const [width,height] of [[320,640],[360,780],[390,844]]){
  for(const hero of ['priest','druid','paladin','shaman','monk','astrologer','warder']){
   const ctx=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),p=await ctx.newPage();
   p.on('pageerror',e=>errs.push(e.message));await p.clock.install();await p.goto(url);await p.clock.runFor(300);
   await patchSave(p,{player:{level:100},items:['mana','life'],bag:{mana:9,life:9},settings:{devUnlock:true,devStamina:true}});
   await p.evaluate(hero=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.hero=hero;s.bought??={};s.bought['job_'+hero]=true;if(hero==='priest'&&innerWidth===320){s.heroes.priest??={};s.heroes.priest.talents=[null,null,null,null,0,null,1,null,null,0];}localStorage.setItem('healer.save',JSON.stringify(s));},hero);
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
     const items=[...document.querySelectorAll('#items .item')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});
     const compact=c.classList.contains('compact-controls'),host=document.querySelector('#gauges').getBoundingClientRect();
     return {job:g.dataset.job,background:getComputedStyle(compact?frame:c).backgroundImage,frame:getComputedStyle(document.querySelector('#items .item')).backgroundImage,
      oldFrameGone:!compact||getComputedStyle(frame,'::before').content==='none',
      aligned:Math.abs((gr.left+gr.right)-(host.left+host.right))<1&&Math.abs((gr.top+gr.bottom)-(host.top+host.bottom))<1,
      twoSlots:items.length===2&&Math.abs(items[0].top-items[1].top)<1,
      itemsFit:items.every(r=>r.bottom<=cr.bottom-19*scale&&r.top>=gr.bottom+7*scale&&r.left>=cr.left&&r.right<=cr.right),gaugeSize:[gr.width,gr.height],items,
      hitMin:+c.dataset.effectiveTouchMin,hitOverlap:c.dataset.hitAreasOverlap,bottom:cr.bottom,images:[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)};
    });
    const label=hero+' '+width+' '+(compact?'compact':'normal');
    ok(check.job===hero&&check.background.includes('ui-class-'+hero+'-background')&&check.frame.includes('ui-class-'+hero+'-item-frame')&&check.oldFrameGone,label+' class materials');
    ok(check.twoSlots&&check.itemsFit&&check.aligned&&check.images&&check.gaugeSize[1]>=50&&check.hitMin>=43.9&&check.hitOverlap==='false',label+' aligned gauge/items safe insets '+JSON.stringify(check));
    await p.locator('#controlsFrame').screenshot({path:shots+'/class-controls-'+hero+'-'+width+'-'+(compact?'compact':'normal')+'.png'});
   }
   if(hero==='shaman'){
    const aura=await p.locator('.totem-aura').evaluateAll(es=>es.map(e=>!e.hidden));ok(aura.every(Boolean),'both active totem auras');
    await p.evaluate(()=>{window.__proto.F.totems=[];});await p.clock.runFor(80);
    ok(await p.locator('.totem-aura').evaluateAll(es=>es.every(e=>e.hidden)),'expired totem auras off');
   }
   if(hero==='astrologer'||hero==='monk'){
    await p.evaluate(hero=>{const f=window.__proto.F;f.tx.on[hero==='monk'?'sevenBeat':'fifthStar']=true;if(hero==='monk'){f.beat=7;f.beatUntil=f.t+3;}else f.shards=4;},hero);
    await p.clock.runFor(80);
    ok(await p.locator('.variant-segment').count()===(hero==='monk'?7:4),hero+' talent slots visible');
    await p.locator('#controls').screenshot({path:shots+'/class-controls-'+hero+'-talent-'+width+'.png'});
   }
   await ctx.close();
  }
 }
 await b.close();return{fails,errs};
}
