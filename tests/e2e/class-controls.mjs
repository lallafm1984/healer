import {chromium} from 'playwright';
import {departGo,patchSave,toParty} from './nav.mjs';
export default async function classControls(url,shots){
 const b=await chromium.launch(),errs=[];let fails=0;
 const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
 for(const width of [360,390]){
  for(const hero of ['priest','druid','paladin','shaman','monk','astrologer','warder']){
   const ctx=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage();
   p.on('pageerror',e=>errs.push(e.message));await p.clock.install();await p.goto(url);await p.clock.runFor(300);
   await patchSave(p,{player:{level:100},items:{mana:9,life:9},settings:{devUnlock:true,devStamina:true}});
   await p.evaluate(hero=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.hero=hero;s.bought??={};s.bought['job_'+hero]=true;localStorage.setItem('healer.save',JSON.stringify(s));},hero);
   await p.reload();await p.clock.runFor(300);await toParty(p,{tab:'dungeon',content:'rustfort',diff:'보통'});await departGo(p);await p.clock.runFor(3400);
   await p.evaluate(()=>{
    const f=window.__proto.F;f.skills.forEach(k=>k.next=Infinity);f.g.p=75;f.power3=2;
    f.beat=3;f.beatUntil=f.t+2;f.shards=2;
    f.totems=[{kind:'spring',cell:0,until:f.t+9.9,tick:1,at:f.t},{kind:'earth',cell:1,until:f.t+10,tick:1,at:f.t}];
    f.cd.springTotem=3;
   });await p.clock.runFor(80);
   await p.locator('#controls img').evaluateAll(is=>Promise.all(is.map(i=>i.decode())));
   const check=await p.evaluate(()=>{
    const c=document.querySelector('#controls'),g=document.querySelector('.job-gauge'),cr=c.getBoundingClientRect(),gr=g.getBoundingClientRect();
    const items=[...document.querySelectorAll('#items .item')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});
    return {job:g.dataset.job,background:getComputedStyle(c).backgroundImage,frame:getComputedStyle(document.querySelector('#items .item')).backgroundImage,
     itemsFit:items.every(r=>r.bottom<=cr.bottom-10&&r.top>=gr.bottom+3&&r.left>=cr.left&&r.right<=cr.right),gaugeSize:[gr.width,gr.height],items,
     bottom:cr.bottom,images:[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)};
   });
   ok(check.job===hero&&check.background.includes('ui-class-'+hero+'-background')&&check.frame.includes('ui-class-'+hero+'-item-frame'),hero+' '+width+' class materials');
   ok(check.itemsFit&&check.images&&check.gaugeSize[1]>=50,hero+' '+width+' gauge/items safe insets '+JSON.stringify(check));
   await p.locator('#controls').screenshot({path:shots+'/class-controls-'+hero+'-'+width+'.png'});
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
