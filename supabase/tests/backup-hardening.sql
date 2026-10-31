-- 실제 Supabase에서도 테스트 계정/진행/설정/함수를 전부 롤백한다. 실제 OAuth나 폰 QA를 대신하지 않는다.
begin;
insert into auth.users(id,email,is_anonymous,created_at)
  values('fa000000-0000-4000-8000-000000000001','backup-test@example.invalid',false,now());
update public.server_settings set value='10' where key='save_interval_seconds';
update public.server_settings set value='2' where key='choose_interval_seconds';
update public.server_settings set value='5' where key='login_interval_seconds';
select set_config('request.jwt.claims','{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fb000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
set local role authenticated;
do $$
declare d jsonb:='{"v":33,"nextId":1,"player":{"level":6,"xp":0,"gold":1000},"clears":{},"gear":{"equipped":{},"bag":[]}}'; r jsonb;
  inst uuid:='fc000000-0000-4000-8000-000000000001'; upload_id uuid:='fd000000-0000-4000-8000-000000000001';
begin
  r:=public.upload_save(d,0,upload_id,600,1,inst);
  if r->>'ok' is distinct from 'true' or r->>'rev'<>'1' then raise exception 'first upload failed: %',r; end if;
  r:=public.upload_save(d,0,upload_id,600,1,inst);
  if r->>'duplicate' is distinct from 'true' then raise exception 'dedupe failed: %',r; end if;
  r:=public.upload_save(d,1,gen_random_uuid(),600,1,inst);
  if r->>'reason' is distinct from 'rate_limited' then raise exception 'rate limit failed: %',r; end if;
  perform set_config('request.jwt.claims','{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fb000000-0000-4000-8000-000000000002","is_anonymous":false}',true);
  r:=public.upload_save(d,1,gen_random_uuid(),600,1,inst);
  if r->>'reason' is distinct from 'moved' then raise exception 'session binding failed: %',r; end if;
  r:=public.device_status(inst);
  if r->>'active' is distinct from 'false' then raise exception 'device status failed: %',r; end if;
  r:=public.choose_progress('account',1,d,null,600,1,inst);
  if r->>'ok' is distinct from 'true' then raise exception 'handover failed: %',r; end if;
  perform set_config('request.jwt.claims','{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fb000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
  r:=public.upload_save(d,1,gen_random_uuid(),600,1,inst);
  if r->>'reason' is distinct from 'moved' then raise exception 'former session failed: %',r; end if;
  perform public.log_login('open','android',600);
  r:=public.log_login('open','android',600);
  if r->>'duplicate' is distinct from 'true' then raise exception 'login rate failed: %',r; end if;
end $$;
reset role;
update public.app_config set flags=jsonb_set(flags,'{backup}','false') where platform='android';
set local role authenticated;
do $$ declare r jsonb; k text; begin
  foreach k in array array['account','device'] loop
    r:=public.choose_progress(k,1,'{"player":{"level":6}}',gen_random_uuid(),600,1,'fc000000-0000-4000-8000-000000000001');
    if r->>'reason' is distinct from 'paused' then raise exception 'pause bypass: %',r; end if;
  end loop;
end $$;
reset role;
create function public.audit_hardening_probe() returns boolean language sql security definer set search_path='' as $$select true$$;
do $$ begin
  if has_function_privilege('anon','public.audit_hardening_probe()','EXECUTE') then raise exception 'default PUBLIC execute still granted'; end if;
  if has_table_privilege('authenticated','public.save_devices','SELECT')
    or has_column_privilege('authenticated','public.saves','active_install','SELECT')
    or has_function_privilege('authenticated','public._log_login_v1(text,text,integer)','EXECUTE') then raise exception 'private state exposed'; end if;
end $$;
rollback;
select 'backup_hardening_live_smoke' as check_name,
  not exists(select 1 from auth.users where id='fa000000-0000-4000-8000-000000000001') as passed,
  'all assertions passed; test data and settings rolled back' as result;
