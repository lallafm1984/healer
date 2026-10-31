import { beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({G:{save:undefined as any},storage:new Map<string,string>(),fail:new Set<string>(),
  download:vi.fn(),choose:vi.fn(),upload:vi.fn(),connect:vi.fn(),me:vi.fn(),signOut:vi.fn(),
  reload:vi.fn(),markActive:vi.fn(),notify:vi.fn(),notice:vi.fn(),ask:vi.fn(),reset:vi.fn(),paused:false,
  user:{id:'user-a',email:'audit@example.invalid',anonymous:false}}));
vi.mock('../src/platform/account',()=>({chooseProgress:h.choose,downloadSave:h.download,uploadSave:h.upload,
  googleReady:()=>true,connectGoogle:h.connect,logLogin:vi.fn(),me:h.me,signOut:h.signOut,
  startAnonymous:vi.fn(),deleteAccount:vi.fn(),deviceStatus:vi.fn(),watchAccount:vi.fn()}));
vi.mock('../src/platform/ads',()=>({askModal:h.ask,noticeModal:h.notice}));
vi.mock('../src/platform/install',()=>({initInstall:vi.fn(),markActive:h.markActive,renewInstall:vi.fn(),wasActive:()=>false}));
vi.mock('../src/platform/server',()=>({lastBoot:()=>null,remoteFlag:()=>!h.paused}));
vi.mock('../src/platform/server-config',()=>({serverOn:()=>true}));
vi.mock('../src/platform/time',()=>({now:()=>1793400000000}));
vi.mock('../src/game/state',()=>({G:h.G,resetSave:h.reset}));
vi.mock('../src/screens/toast',()=>({notify:h.notify}));
vi.mock('../src/i18n',()=>({t:(s:string)=>s}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false},registerPlugin:()=>({})}));
vi.mock('@capacitor/app',()=>({App:{addListener:vi.fn()}}));

beforeEach(async()=>{
  vi.resetModules();vi.resetAllMocks();h.storage.clear();h.fail.clear();h.paused=false;
  vi.stubGlobal('localStorage',{getItem:(k:string)=>h.storage.get(k)??null,
    setItem:(k:string,v:string)=>{if(h.fail.has(k))throw Error('quota');h.storage.set(k,v);},removeItem:(k:string)=>h.storage.delete(k)});
  vi.stubGlobal('location',{reload:h.reload});
  const {newSave}=await import('../src/platform/storage');
  h.G.save=newSave(1);h.G.save.player.level=9;h.storage.set('healer.save',JSON.stringify(h.G.save));
  const server=newSave(1);server.player.level=5;
  h.me.mockResolvedValue(h.user);h.connect.mockResolvedValue({user:h.user,mode:'sign_in'});
  h.download.mockResolvedValue({exists:true,rev:1,level:5,data:server,updated_at:1});
  h.choose.mockResolvedValue({ok:true,rev:1});h.upload.mockResolvedValue({ok:true,rev:2});h.ask.mockResolvedValue(true);
});

it('계정 진행 성공 뒤 원래 진행 사본과 서버 rev를 남기고 다시 켬',async()=>{
  const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.reload).toHaveBeenCalledOnce();expect(JSON.parse(h.storage.get('healer.save')!).player.level).toBe(5);
  expect(JSON.parse(h.storage.get('healer.save.pre-merge')!).player.level).toBe(9);
  expect(JSON.parse(h.storage.get('healer.backup')!).rev).toBe(1);
  expect(h.storage.has('healer.restorePending')).toBe(false);
  expect(h.G.save.player.level).toBe(5);expect(h.upload).not.toHaveBeenCalled();
});

it.each([false,true])('진행 선택 충돌 때 기기 진행을 보존하고 다음 업로드도 차단 (복구=%s)',async restore=>{
  if(restore)h.storage.set('healer.restorePending','1');
  h.choose.mockResolvedValue({ok:false,reason:'conflict',rev:2});
  const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.reload).not.toHaveBeenCalled();expect(h.markActive).not.toHaveBeenCalled();expect(h.notify).not.toHaveBeenCalled();
  expect(JSON.parse(h.storage.get('healer.save')!).player.level).toBe(9);expect(h.upload).not.toHaveBeenCalled();
});

it('성공 응답이라도 선택한 rev와 다르면 적용하지 않음',async()=>{
  h.choose.mockResolvedValue({ok:true,rev:2});const {linkGoogle}=await import('../src/screens/account');await linkGoogle();
  expect(h.reload).not.toHaveBeenCalled();expect(JSON.parse(h.storage.get('healer.save')!).player.level).toBe(9);
});

it.each(['healer.save','healer.save.pre-merge'])('기기 저장 실패 %s 뒤 복원 대기를 유지하고 자동 업로드하지 않음',async key=>{
  h.fail.add(key);const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.reload).not.toHaveBeenCalled();expect(h.storage.get('healer.restorePending')).toBe('1');
  expect(h.upload).not.toHaveBeenCalled();expect(JSON.parse(h.storage.get('healer.save')!).player.level).toBe(9);
});

it('복원 데이터는 썼어도 백업 상태 쓰기가 실패하면 복원 완료로 처리하지 않음',async()=>{
  h.choose.mockImplementation(async()=>{h.fail.add('healer.backup');return {ok:true,rev:1};});
  const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.reload).not.toHaveBeenCalled();expect(h.storage.get('healer.restorePending')).toBe('1');expect(h.upload).not.toHaveBeenCalled();
});

it('첫 업로드 거절 때 복구 대기를 지우거나 연결 성공으로 안내하지 않음',async()=>{
  h.download.mockResolvedValue({exists:false});h.upload.mockResolvedValue({ok:false,reason:'paused'});h.storage.set('healer.restorePending','1');
  const {linkGoogle}=await import('../src/screens/account');await linkGoogle();
  expect(h.notify).not.toHaveBeenCalled();expect(h.storage.get('healer.restorePending')).toBe('1');
});

it('점검 중이면 구글 연결도 시작하지 않음',async()=>{
  h.paused=true;const {linkGoogle}=await import('../src/screens/account');await linkGoogle();expect(h.connect).not.toHaveBeenCalled();
});

it('서버의 높은 버전 저장을 선택하거나 덮어쓰지 않음',async()=>{
  const {newSave,SAVE_VERSION}=await import('../src/platform/storage');h.download.mockResolvedValue({exists:true,rev:1,data:{...newSave(1),v:SAVE_VERSION+1}});
  const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.choose).not.toHaveBeenCalled();expect(h.upload).not.toHaveBeenCalled();expect(h.reload).not.toHaveBeenCalled();
});

it.each(['null','{}','[]','42',''])('깨진 저장 %s를 새 정상 진행으로 업로드하지 않음',async malformed=>{
  h.storage.set('healer.save',malformed);const {load}=await import('../src/platform/storage');h.G.save=load();
  const {backupOnPause}=await import('../src/screens/account');h.storage.set('healer.backup',JSON.stringify({uid:h.user.id,rev:1,hash:'old',at:1}));
  await backupOnPause();expect(h.storage.get('healer.restorePending')).toBe('1');expect(h.upload).not.toHaveBeenCalled();
});

it('기기 미래 버전 원본을 시작 때의 저장과 서버 백업에서 보존',async()=>{
  const {load,save,newSave,SAVE_VERSION}=await import('../src/platform/storage');
  const original=JSON.stringify({...newSave(1),v:SAVE_VERSION+1});h.storage.set('healer.save',original);h.G.save=load();
  expect(save(h.G.save)).toBe(false);
  const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.connect).not.toHaveBeenCalled();expect(h.upload).not.toHaveBeenCalled();expect(h.storage.get('healer.save')).toBe(original);
});

it('업로드 응답을 잃으면 같은 내용과 upload_id로 재시도',async()=>{
  h.storage.set('healer.backup',JSON.stringify({uid:h.user.id,rev:1,hash:'old',at:1}));h.upload.mockRejectedValueOnce(Error('network'));
  const {backupOnPause}=await import('../src/screens/account');await backupOnPause();await backupOnPause();
  expect(h.upload).toHaveBeenCalledTimes(2);expect(h.upload.mock.calls[0][2]).toBe(h.upload.mock.calls[1][2]);
});

it('전송 중 게임 상태가 바뀌어도 보낸 스냅샷과 저장 지문은 일치',async()=>{
  h.storage.set('healer.backup',JSON.stringify({uid:h.user.id,rev:1,hash:'old',at:1}));
  h.upload.mockImplementationOnce(async()=>{h.G.save.player.level=10;return {ok:true,rev:2};});
  const {backupOnPause}=await import('../src/screens/account');await backupOnPause();await backupOnPause();
  expect(h.upload.mock.calls[0][0].player.level).toBe(9);expect(h.upload.mock.calls[1][0].player.level).toBe(10);
  expect(h.upload.mock.calls[1][1]).toBe(2);
});

it('로그아웃 인증 실패 때 기기 진행을 지우지 않음',async()=>{
  const {fnv,signOutFlow}=await import('../src/screens/account');h.storage.set('healer.backup',JSON.stringify({uid:h.user.id,rev:1,hash:fnv(JSON.stringify(h.G.save)),at:1}));
  h.signOut.mockRejectedValue(Error('network'));await signOutFlow();expect(h.reset).not.toHaveBeenCalled();expect(h.reload).not.toHaveBeenCalled();
});

it('세션이 사라져도 백업한 진행을 다른 계정에 복사하지 않음',async()=>{
  h.storage.set('healer.backup',JSON.stringify({uid:'original-owner',rev:4,hash:'previous',at:1}));
  const {linkGoogle,backupOnPause}=await import('../src/screens/account');await linkGoogle();await backupOnPause();
  expect(h.signOut).toHaveBeenCalledOnce();expect(h.download).not.toHaveBeenCalled();expect(h.upload).not.toHaveBeenCalled();
  expect(JSON.parse(h.storage.get('healer.backup')!).uid).toBe('original-owner');expect(h.reset).not.toHaveBeenCalled();
});
