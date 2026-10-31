import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/platform/server-config',()=>({serverOn:()=>true,SUPABASE_URL:'https://account-test.invalid',SUPABASE_KEY:'test-public',GOOGLE_WEB_CLIENT_ID:''}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'},registerPlugin:()=>({})}));
vi.mock('@capgo/capacitor-social-login',()=>({SocialLogin:{logout:vi.fn()}}));
const user={id:'10000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-10-31T00:00:00Z'};
const token=()=>{
  const b64=(o:object)=>Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.not-a-real-signature`;
};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
it('실제 설치된 SDK로 현재 세션만 로그아웃하고 인증 변경을 알림',async()=>{
  vi.resetModules();const urls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);urls.push(url);return url.includes('/logout')?new Response(null,{status:204}):new Response(JSON.stringify(user),{status:200,headers:{'Content-Type':'application/json'}});
  }));
  const {client,signOut,watchAccount}=await import('../src/platform/account');
  const c=client()!;const users:(string|null)[]=[];const stop=watchAccount(u=>users.push(u?.id??null));
  expect((await c.auth.setSession({access_token:token(),refresh_token:'fake-only'})).error).toBeNull();await signOut();stop();
  expect(urls.filter(u=>u.includes('/logout'))).toEqual(['https://account-test.invalid/auth/v1/logout?scope=local']);
  expect((await c.auth.getSession()).data.session).toBeNull();expect(users).toContain(user.id);expect(users.at(-1)).toBeNull();
});
it('SDK가 오류 때 세션을 지워도 오류를 호출부에 전달해 진행 삭제를 막음',async()=>{
  vi.resetModules();vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).includes('/logout')
    ?new Response(JSON.stringify({message:'unavailable'}),{status:503,headers:{'Content-Type':'application/json'}})
    :new Response(JSON.stringify(user),{status:200,headers:{'Content-Type':'application/json'}})));
  const {client,signOut}=await import('../src/platform/account');const c=client()!;await c.auth.setSession({access_token:token(),refresh_token:'fake-only'});
  await expect(signOut()).rejects.toThrow();expect((await c.auth.getSession()).data.session).toBeNull();
  // 테스트의 자동 갱신 타이머 정리
  c.auth.stopAutoRefresh();
});
it('계정 통신 제한 시간과 호출자의 취소 신호를 모두 적용',async()=>{
  vi.useFakeTimers();
  vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{const ctl=new AbortController();setTimeout(()=>ctl.abort(new DOMException('Timed out','TimeoutError')),ms);return ctl.signal;});
  vi.stubGlobal('fetch',vi.fn((_input:unknown,init:RequestInit)=>new Promise((_resolve,reject)=>{
    if(init.signal!.aborted)reject(init.signal!.reason);else init.signal!.addEventListener('abort',()=>reject(init.signal!.reason));
  })));
  const {accountFetch,ACCOUNT_TIMEOUT_MS}=await import('../src/platform/network');
  const result=expect(accountFetch('https://account-test.invalid')).rejects.toThrow('Timed out');await vi.advanceTimersByTimeAsync(ACCOUNT_TIMEOUT_MS);await result;
  const caller=new AbortController();const canceled=expect(accountFetch('https://account-test.invalid',{signal:caller.signal})).rejects.toThrow();caller.abort();await canceled;
});
