import {chromium} from 'playwright';
import {departGo,patchSave,toParty} from './nav.mjs';

// 독립 저장과 경계값 fixture를 사용한다. 실제 평온 소비는 휠·파티원 터치를 거친다.
export default async function priestAura(url,shots){
 const b=await chromium.launch(),errs=[];let fails=0;
 let pg=null;// DBG=1: 실패하면 전투 · 게이지 상태를 남김
 const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v){fails++;if(process.env.DBG&&pg)pg.evaluate(()=>{const f=window.__proto.F,g=document.querySelector('.job-gauge');return JSON.stringify({over:f.over,t:f.t,enc:f.enc.key,p:f.g.p,stage:g?.dataset.auraStage,ready:g?.dataset.ready,alive:f.party.filter(u=>u.alive).length,saved:f.tx?.on?.savedWord,cast:!!f.cast,hots:f.party.map(u=>(u.hots||[]).length+(u.hot?1:0))});}).then(x=>console.log('DBG '+x)).catch(()=>{});}};
 try{for(const width of [320,360,390]){
  const p=await b.newPage({viewport:{width,height:780},isMobile:true,hasTouch:true});pg=p;p.on('pageerror',e=>errs.push(e.message));
  await p.clock.install();await p.goto(url);await p.clock.runFor(300);
  await patchSave(p,{player:{level:100},settings:{devUnlock:true,devStamina:true,auto:false,reducedEffects:false}});
  await toParty(p,{tab:'dungeon',content:'rustfort',diff:'보통'});await departGo(p);await p.clock.runFor(3400);
  // 보스 · 잡몹 체력은 크게 (파티원 능력 딜로 잡몹이 쓰러져 구간이 끝나면 게이지가 처음으로 돌아감, 자동 밸런스 체력 배율 #453)
  const state=async(value,saved=false)=>{
   await p.evaluate(([value,saved])=>{const f=window.__proto.F;f.tx.on.savedWord=saved;f.g.p=value;f.skills.forEach(k=>k.next=Infinity);f.party.forEach(u=>{u.dps=0;u.hp=u.max*.5;});f.bossHp=1e9;f.mobs.forEach(m=>{m.hp=1e9;});f.gcd=0;f.cast=null;f.queued=null;},[value,saved]);
   // 화면 갱신 (매 장 updateWheel → 직업 게이지)이 CI 러너에서 한 장 늦을 때가 있어, 그 값의 단계 (100 밑 off · 200 이상 저장 특성 blue · 그 사이 gold)가 보일 때까지 20ms씩 (600ms까지)
   const want=value<100?'off':saved&&value>=200?'blue':'gold';
   for(let i=0;i<30;i++){await p.clock.runFor(20);if(i>=1&&await p.evaluate(w=>document.querySelector('.job-gauge')?.dataset.auraStage===w,want))break;}
  };
  const snap=()=>p.evaluate(()=>{
   const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect().toJSON(),g=q('.job-gauge'),a=q('.priest-aura'),n=q('.gauge-number'),halo=q('.priest-halo');
   const aura=r(a),number=r(n),art=r(g),wheel=r(q('#wheel')),aux=q('#aux'),items=aux&&aux.getClientRects().length?r(aux):{top:Infinity}; // 소비 아이템 줄 (#items)은 2026-10-16 특성 버튼 줄 (#aux)로
   const pieces=[halo,...g.querySelectorAll('.priest-spark')];
   return{stage:g.dataset.auraStage,sparkColor:getComputedStyle(g.querySelector('.priest-spark')).backgroundColor,lightFilter:getComputedStyle(g.querySelector('.gauge-ready')).filter,ready:g.dataset.ready==='true',value:window.__proto.F.g.p,cast:window.__proto.F.stats.casts.serenity||0,
    visible:getComputedStyle(a).display!=='none',count:document.querySelectorAll('.priest-aura').length,sparks:g.querySelectorAll('.priest-spark').length,
    passive:[a,...pieces].every(e=>getComputedStyle(e).pointerEvents==='none'),anim:getComputedStyle(halo).animationName,
    bounds:pieces.every(e=>{const b=r(e);return b.left>=art.left&&b.right<=art.right&&b.top>=art.top&&b.bottom<number.top;}),
    separate:aura.right<=wheel.left&&aura.bottom<=items.top,numberFront:+getComputedStyle(n).zIndex>+getComputedStyle(a).zIndex,
    targetsClear:[...document.querySelectorAll('#wheel button,#aux .slot')].every(e=>{const b=r(e),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return hit===e||e.contains(hit);}),
    activeAnimations:a.getAnimations({subtree:true}).length};
  });
  const cast=async()=>{
   await p.locator('#wheel [data-slot="heal"]').tap();await p.clock.runFor(30);
   const target=await p.evaluate(()=>{const f=window.__proto.F,c=window.__proto.center(f.party[0].cell),r=document.querySelector('#board').getBoundingClientRect();return{x:r.x+c.x,y:r.y+c.y};});
   await p.touchscreen.tap(target.x,target.y);await p.clock.runFor(40);
  };
  const clear=async(label)=>{const s=await snap(),pass=s.bounds&&s.separate&&s.numberFront&&s.passive&&s.targetsClear;ok(pass,width+' '+label+' 경계·수치·터치 비침범');if(!pass)console.log(JSON.stringify(s));};
  await state(99);let boundary=await snap();ok(boundary.stage==='off'&&!boundary.ready,width+' 일반 99 후광 없음');
  await state(99.999);let s=await snap();ok(!s.ready&&!s.visible&&s.activeAnimations===0,width+' 99.999 미활성');
  await state(100);await p.locator('#controls img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));s=await snap();
  ok(s.stage==='gold'&&s.sparkColor==='rgb(255, 245, 188)'&&s.lightFilter==='none'&&s.ready&&s.visible&&s.count===1&&s.sparks===5&&s.anim==='priest-halo-breathe',width+' 일반 100 금빛·후광 1개');
  for(const ms of [0,800,800]){await p.clock.runFor(ms);s=await snap();const clear=s.bounds&&s.separate&&s.numberFront&&s.passive&&s.targetsClear;ok(clear,width+' 후광/반짝임 경계·수치·터치 비침범');if(!clear)console.log(JSON.stringify(s));}
  await p.locator('#controlsFrame').screenshot({path:shots+`/priest-aura-${width}-full.png`});
  await cast();s=await snap();
  ok(s.cast===1&&s.value<100&&s.stage==='off'&&!s.ready&&!s.visible&&s.activeAnimations===0,width+' 실제 평온 소비 직후 효과 해제');
  for(const value of [99,99.999,100,199,199.999,200]){
   await state(value,true);s=await snap();const stage=value<100?'off':value<200?'gold':'blue';
   ok(s.stage===stage&&s.ready===(value>=100)&&s.visible===(value>=100),width+' 저장 특성 '+value+' '+stage);
   if(value>=100){
    ok(s.count===1&&s.sparks===5&&s.activeAnimations===6&&s.sparkColor===(stage==='blue'?'rgb(217, 245, 255)':'rgb(255, 245, 188)')&&(stage==='blue'?s.lightFilter.includes('hue-rotate'):s.lightFilter==='none'),width+' '+value+' 색상·단일 레이어');
    for(const ms of [0,800,800]){await p.clock.runFor(ms);await clear(stage);}
   }
  }
  await p.locator('#controlsFrame').screenshot({path:shots+`/priest-aura-${width}-blue.png`});
  await cast();s=await snap();
  ok(s.cast===2&&s.value>=100&&s.value<200&&s.stage==='gold'&&s.ready&&s.lightFilter==='none'&&s.sparkColor==='rgb(255, 245, 188)',width+' 실제 200 소비 후 금빛 하향 전환');
  await state(s.value,true);await cast();s=await snap();
  ok(s.cast===3&&s.value<100&&s.stage==='off'&&!s.visible&&s.activeAnimations===0,width+' 실제 연속 소비 후 100 미만 해제');
  for(let i=0;i<3;i++){await state(200,true);await state(100,true);await state(0,true);}await state(200,true);s=await snap();ok(s.stage==='blue'&&s.count===1&&s.sparks===5&&s.activeAnimations===6,width+' 재충전·하향 전환 반복 시 누적 없음');
  await p.emulateMedia({reducedMotion:'reduce'});s=await snap();ok(s.ready&&s.anim==='none',width+' OS 동작 줄이기 정적 후광');await p.emulateMedia({reducedMotion:'no-preference'});
  const reduced=await p.evaluate(()=>{const b=document.querySelector('#battle');b.classList.add('reduced-effects');const result=getComputedStyle(document.querySelector('.priest-halo')).animationName==='none'&&getComputedStyle(document.querySelector('.priest-spark')).display==='none';b.classList.remove('reduced-effects');return result;});ok(reduced,width+' 게임 효과 줄이기 반짝임 생략');
  await p.locator('#pauseBtn').click();await p.locator('#restartBtn').click();await p.locator('#confirmApply').click();await p.clock.runFor(3400);
  s=await snap();ok(s.count===1&&!s.ready&&!s.visible,width+' 전투 재진입 초기화·중복 없음');await state(200,true);s=await snap();ok(s.count===1&&s.visible&&s.stage==='blue',width+' 재진입 후 청백색 재활성');await state(100,true);s=await snap();ok(s.stage==='gold'&&s.lightFilter==='none',width+' 재진입 후 금빛 하향 전환');
  await state(75);await p.locator('#controlsFrame').screenshot({path:shots+`/priest-aura-${width}-partial.png`});
  await p.close();
 }}catch(e){errs.push(e.stack||String(e));}finally{await b.close();}return{fails,errs};
}
