import {chromium} from 'playwright';
import {departGo,patchSave,toParty} from './nav.mjs';
export default async function paladinWave(url,shots){
 const b=await chromium.launch(),errs=[];let fails=0;
 const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)fails++;};
 try{for(const width of [320,360,390])for(const aux of [false,true]){
  const p=await b.newPage({viewport:{width,height:780},isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));await p.clock.install();await p.goto(url);await p.clock.runFor(300);
  await patchSave(p,{player:{level:100},items:['mana','life'],settings:{devUnlock:true,devStamina:true,auto:false,reducedEffects:false}});
  await p.evaluate(aux=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.hero='paladin';s.heroes.paladin??={};s.heroes.paladin.talents=aux?[null,null,null,null,0,null,null,null,null,0]:Array(10).fill(null);localStorage.setItem('healer.save',JSON.stringify(s));},aux);
  await p.reload();await p.clock.runFor(300);await toParty(p,{tab:'dungeon',content:'rustfort',diff:'보통'});await departGo(p);await p.clock.runFor(3400);
  const fixture=async o=>{await p.evaluate(o=>{
   const f=window.__proto.F;f.skills.forEach(k=>k.next=Infinity);f.party.forEach(u=>{u.dps=0;u.alive=true;u.hp=u.max;u.lift=null;});
   f.cast=null;f.gcd=o.gcd||0;f.channel=0;f.power3=o.power??3;f.mana=o.mana??100;f.level=o.level??100;
   delete f.tx.on.endlessLight;delete f.tx.on.freeWave;delete f.lock.lightWave;f.tx.any=!!o.free;
   if(o.endless)f.tx.on.endlessLight=true;if(o.free)f.tx.on.freeWave=true;if(o.lock)f.lock.lightWave={left:10,total:10};
   if(o.lift)f.party.forEach(u=>u.lift={until:f.t+100,fall:1,aim:'party'});
  },o);await p.clock.runFor(40);};
  const snap=()=>p.evaluate(()=>{
   const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect(),a=q('.paladin-wave-aura'),g=q('.job-gauge'),ar=r(a),gr=r(g),wr=r(q('#wheel')),it=r(q('#items'));
   return {on:!a.hidden&&g.dataset.waveReady==='true',count:g.querySelectorAll('.paladin-wave-aura').length,registeredLayer:+getComputedStyle(a).zIndex>+getComputedStyle(g.querySelector('.gauge-base')).zIndex&&+getComputedStyle(a).zIndex<+getComputedStyle(g.querySelector('.gauge-number')).zIndex,
    passive:[a,...a.children].every(e=>getComputedStyle(e).pointerEvents==='none'),contained:a.hidden||(ar.left>=gr.left&&ar.right<=gr.right&&ar.top>=gr.top&&ar.bottom<=gr.bottom&&ar.right<wr.left&&ar.bottom<it.top),
    touch:[...document.querySelectorAll('#controls button')].filter(e=>r(e).width>0).every(e=>{const x=r(e),hit=document.elementFromPoint(x.x+x.width/2,x.y+x.height/2);return hit===e||e.contains(hit);}),
    wheelOff:q('#wheel [data-slot=poh]').classList.contains('resource-low'),wheelText:q('#wheel [data-slot=poh] .ct').textContent,
    shieldProportion:Math.abs(r(q('.paladin-shield')).width-r(q('.paladin-shield')).height)<.2&&getComputedStyle(q('.shield-base')).objectFit==='contain',
    shieldLit:[...g.querySelectorAll('.shield-segment')].filter(e=>!e.hidden).length,power:window.__proto.F.power3,
    shapeRegistered:(()=>{const source=q('.paladin-wave-source'),base=g.querySelector('.gauge-base');if(!source)return false;const x=r(source),y=r(base);return source.src===base.src&&['x','y','width','height'].every(k=>Math.abs(x[k]-y[k])<.1);})(),
    noDecorativeDisc:!g.querySelector('.paladin-wave-spark')&&getComputedStyle(q('.paladin-wave-halo')).backgroundImage==='none',
    animations:a.getAnimations({subtree:true}).filter(x=>x.playState==='running').length,haloAnim:getComputedStyle(q('.paladin-wave-halo')).animationName,
    positions:['#controlsFrame','.job-gauge','#items','#wheel'].map(s=>{const b=r(q(s));return[b.x,b.y,b.width,b.height];}),aux:document.querySelectorAll('#aux .aux').length};
  });
  await fixture({power:0});const baseline=(await snap()).positions;
  for(const [name,o,expected]of [['off',{power:2},false],['ready',{power:3},true],['spent',{power:0},false],['recharged',{power:3},true],['endless',{power:2,endless:true},true],['endless-short',{power:1,endless:true},false],['mana-low',{mana:0},false],['free',{mana:0,free:true},true],['locked',{lock:true},false],['gcd',{gcd:1},false],['level',{level:4},false],['unreachable',{lift:true},false],['restored',{},true]]){
   await fixture(o);const s=await snap();ok(s.on===expected,`${width} ${aux?'aux':'base'} ${name}`);
   if(expected)ok(s.shapeRegistered&&s.noDecorativeDisc,`${width} ${name} 원화 윤곽 등록·별도 원판/별 장식 없음`);
   ok(s.count===1&&s.registeredLayer&&s.passive&&s.contained&&s.touch&&s.shieldProportion&&s.shieldLit===s.power&&s.positions.every((v,i)=>v.every((x,j)=>Math.abs(x-baseline[i][j])<.2)),`${width} ${name} 위치·비율·채움·윤곽 레이어·터치 유지`);
   if(name==='endless')ok(!s.wheelOff&&s.wheelText==='힘2',`${width} 끝없는 빛 휠 표시 일치`);
   if(!aux&&['off','ready','endless'].includes(name)){await p.locator('#controls img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await p.locator('#controlsFrame').screenshot({path:`${shots}/paladin-wave-${width}-${name}.png`});}
  }
  await fixture({});await p.emulateMedia({reducedMotion:'reduce'});ok((await snap()).haloAnim==='none'&&(await snap()).on,`${width} 동작 줄이기 정적 후광`);await p.emulateMedia({reducedMotion:'no-preference'});
  await fixture({power:0});ok((await snap()).animations===0,`${width} 소모 후 애니메이션 중지`);
  ok((await snap()).aux===(aux?2:0),`${width} 보조 특성 ${aux}`);
  for(const [name,expected] of [['이슬','이슬'],['빛방패','빛방패'],['끝까지지킴','끝까지지킴'],['말없는수호기사','말없는수호'],['Alexander','Alexa'],['힐러A12호','힐러A12'],[null,'미지정']]){
   await p.evaluate(name=>{const f=window.__proto.F;f.beacon=name===null?null:f.party[0].id;if(name!==null)f.party[0].nick=name;},name);await p.clock.runFor(40);
   const label=await p.evaluate(()=>{
    const q=s=>document.querySelector(s),e=q('.paladin-beacon-name'),r=e.getBoundingClientRect(),a=q('.resource-art').getBoundingClientRect(),i=q('#items').getBoundingClientRect(),w=q('#wheel').getBoundingClientRect();const range=document.createRange();range.selectNodeContents(e);
    return {text:e.textContent,title:e.title,description:q('.job-gauge').getAttribute('aria-label'),safe:r.bottom<i.top&&r.right<w.left&&[...document.querySelectorAll('#aux .aux')].every(b=>{const x=b.getBoundingClientRect();return r.bottom<=x.top||r.right<=x.left||r.left>=x.right;})&&r.top>=a.top+a.height*440/464&&range.getBoundingClientRect().width<=r.width,
     registered:Math.abs((r.left+r.width/2)-(a.left+a.width*375/542))<.1&&Math.abs(r.top-(a.top+a.height*440/464+1.4))<.1,
     hit:!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),gap:i.top-r.bottom};
   });
   ok(label.text===expected&&label.title===(name||'봉화 대상 없음')&&label.description.includes(name||'미지정')&&label.safe&&label.registered&&label.hit,`${width} ${aux?'aux':'base'} 봉화 ${name??'없음'}: 5자·전체 이름·시안 좌표·겹침 없음 ${JSON.stringify(label)}`);
   if(!aux&&name==='끝까지지킴'){await fixture({power:3});await p.locator('#controlsFrame').screenshot({path:`${shots}/paladin-beacon-${width}.png`});}
  }
  await p.close();
 }}catch(e){errs.push(e.stack||String(e));}finally{await b.close();}return {fails,errs};
}
