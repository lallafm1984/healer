// 실서버 요청을 모두 가로채고 실제 Supabase SDK와 브라우저의 복원/로그아웃 경로를 검사.
import { chromium } from 'playwright';
import { pastTitle } from './nav.mjs';
const uid='10000000-0000-4000-8000-000000000001';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{provider:'google',providers:['google']},user_metadata:{},is_anonymous:false,created_at:'2026-10-31T00:00:00Z'};
const token=()=>{const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return `${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,session_id:uid,exp:Math.floor(Date.now()/1000)+3600})}.not-a-real-signature`;};
export default async function accountCloud(url,shots){
  const browser=await chromium.launch();const errs=[];let fails=0;
  const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)fails++;};
  const ctx=await browser.newContext({viewport:{width:360,height:780},locale:'ko-KR'});
  await ctx.addInitScript(()=>{window.__serverTest=localStorage.getItem('account-cloud-test')==='1';});
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));
  let uploads=0,chooseConflict=true;const requests=[];let cloud;
  await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===new URL(url).origin)return route.continue();
    if(!u.hostname.endsWith('.supabase.co'))return route.abort();
    requests.push(u.pathname+u.search);
    let r;
    if(u.pathname.endsWith('/app_boot'))r={now:Date.now(),config:{min_version:0,latest_version:0,maintenance:false,flags:{}},notices:[]};
    else if(u.pathname.endsWith('/device_status'))r={exists:true,active:true,rev:1};
    else if(u.pathname.endsWith('/download_save'))r={exists:true,rev:chooseConflict?1:2,level:cloud.player.level,data:cloud,updated_at:Date.now()};
    else if(u.pathname.endsWith('/choose_progress'))r=chooseConflict?{ok:false,reason:'conflict',rev:2}:{ok:true,rev:2};
    else if(u.pathname.endsWith('/upload_save')){uploads++;r={ok:true,rev:3,now:Date.now()};}
    else if(u.pathname.endsWith('/log_login'))r={ok:true};
    else if(u.pathname.endsWith('/logout'))return route.fulfill({status:204});
    else if(u.pathname.endsWith('/user'))r=user;
    else if(u.pathname.endsWith('/signup'))return route.fulfill({status:400,json:{message:'Anonymous signup disabled in this test'}});
    else {errs.push('unexpected external request '+u.pathname);return route.abort();}
    return route.fulfill({json:r});
  });
  try{
    await page.goto(url);await page.waitForSelector('#titleStart');
    const seed=await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')));
    seed.player.level=9;seed.tut=3;cloud=structuredClone(seed);cloud.player.level=5;
    await page.evaluate(({seed,user,jwt})=>{
      localStorage.setItem('healer.lang','ko');localStorage.setItem('account-cloud-test','1');
      localStorage.setItem('healer.save',JSON.stringify(seed));
      localStorage.setItem('healer.auth',JSON.stringify({access_token:jwt,refresh_token:'fake-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
      localStorage.setItem('healer.backup',JSON.stringify({uid:user.id,rev:1,hash:'old',at:1,conflict:true}));
    },{seed,user,jwt:token()});
    await page.reload();await page.locator('.admodal [data-ask="ok"]').waitFor();
    await page.click('.admodal [data-ask="ok"]');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('healer.backup')).error==='conflict');
    ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')).player.level))===9,'진행 충돌 뒤 브라우저의 기기 진행 보존');
    ok(uploads===0&&await page.evaluate(()=>localStorage.getItem('healer.restorePending')==='1'),'충돌 뒤 복원 대기 · 업로드 없음');
    await pastTitle(page);await page.click('#s-lobby [data-go="s-settings"]');
    await page.locator('#acctStatus').waitFor();ok(await page.locator('#acctStatus').innerText()==='백업 대기','설정에서 백업 실패 상태 확인 가능');
    await page.screenshot({path:`${shots}/account-backup-pending.png`});
    chooseConflict=false;cloud.player.level=6;
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.locator('.admodal [data-ask="ok"]').waitFor();
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('.admodal [data-ask="ok"]')]);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('healer.save')).player.level===6&&!localStorage.getItem('healer.restorePending'));
    await page.waitForSelector('#titleStart');await pastTitle(page);await page.click('#s-lobby [data-go="s-settings"]');
    ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.backup')).rev))===2,'복원 성공 뒤 서버 rev 기록');
    const statusGone=await page.locator('#acctStatus').count()===0;
    if(!statusGone)console.log('백업 상태 진단 '+JSON.stringify(await page.evaluate(()=>({backup:localStorage.getItem('healer.backup'),restore:localStorage.getItem('healer.restorePending')}))));
    ok(statusGone,'복원 성공 뒤 실패 표시 해제');
    // 기본값 global이 아닌 local 요청과 실제 SDK의 로그인 정보 제거를 브라우저에서도 확인.
    await page.click('#acctOut');await page.locator('.admodal [data-ask="ok"]').waitFor();await page.click('.admodal [data-ask="ok"]');
    await page.waitForFunction(()=>!localStorage.getItem('healer.backup'));
    ok(requests.some(x=>x.endsWith('/logout?scope=local'))&&!requests.some(x=>x.includes('scope=global')),'브라우저 SDK의 현재 세션 로그아웃');
  }catch(e){errs.push(e.stack||String(e));}finally{await browser.close();}
  return {fails,errs};
}
