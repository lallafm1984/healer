-- 계정 이동 · 복원 안정성 점검 보완. 이미 배포한 마이그레이션은 바꾸지 않는다.
-- 전역 PUBLIC EXECUTE는 schema 단위 revoke로 없어지지 않음.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

create table public.save_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  install uuid,
  session_id uuid,
  active_at timestamptz not null default now()
);
insert into public.save_devices(user_id, install, active_at)
  select user_id, active_install, coalesce(active_at, updated_at) from public.saves;
alter table public.save_devices enable row level security;
revoke all on public.save_devices from public, anon, authenticated;
-- 예전 열도 노출하지 않는다. 앱은 download_save RPC를 쓴다.
revoke select on public.saves from authenticated;
grant select(user_id, rev, last_upload_id, v, level, gold, wins, data, app_version, client_at, updated_at) on public.saves to authenticated;

create table public.rpc_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  last_at timestamptz not null default now(),
  primary key(user_id, action)
);
alter table public.rpc_limits enable row level security;
revoke all on public.rpc_limits from public, anon, authenticated;
create index account_merges_user on public.account_merges(user_id);
create index audit_flags_user on public.audit_flags(user_id);
insert into public.server_settings(key, value, note) values
  ('save_interval_seconds', '10', '새 백업 최소 간격. 같은 upload_id 재시도는 제한하지 않음'),
  ('choose_interval_seconds', '2', '진행 선택 최소 간격'),
  ('login_interval_seconds', '5', '같은 로그인 이벤트 최소 간격'),
  ('stats_versions', coalesce((select jsonb_agg(version) from (
    select distinct version from public.boot_stats where version between 1 and 100000 and day >= current_date - 60 order by version desc limit 50
  ) v), '[]'::jsonb), '버전별 집계 허용 목록 (최대 50개). 나머지는 0으로 합침. min/latest도 자동 허용');

create function public._session_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare sid uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
begin
  if sid is null then raise exception 'session required' using errcode='28000'; end if;
  return sid;
end $$;

-- 첫 저장이 아직 없어도 같은 사용자 요청을 순서대로 처리함.
create function public._lock_save(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rpc_limits(user_id, action) values(p_user, 'lock') on conflict do nothing;
  perform 1 from public.rpc_limits where user_id=p_user and action='lock' for update;
end $$;

create function public._allow_request(p_user uuid, p_action text, p_seconds bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rpc_limits as r(user_id, action, last_at) values(p_user, p_action, now())
    on conflict(user_id, action) do update set last_at=excluded.last_at
    where r.last_at <= now() - make_interval(secs=>greatest(0, p_seconds)::double precision);
  return found;
end $$;

create function public._backup_paused() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.app_config where maintenance)
    or exists(select 1 from public.app_config where platform='android' and flags->'backup'='false'::jsonb)
$$;

create function public._save_duplicate(p_user uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok',true,'duplicate',true,'rev',d.rev,'latest_rev',s.rev,'now',public._epoch_ms(now()))
  from public.saves s cross join lateral (
    select s.rev where s.last_upload_id=p_id
    union all select h.rev from public.save_history h where h.user_id=p_user and h.upload_id=p_id
  ) d where s.user_id=p_user limit 1
$$;

alter function public._store_save(uuid,jsonb,integer,uuid,integer,bigint,text,boolean) rename to _store_save_v1;
create function public._store_save(p_user uuid, p_data jsonb, p_base_rev integer, p_upload_id uuid,
  p_app_version integer, p_client_at bigint, p_reason text, p_force boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_data) is distinct from 'object'
    or jsonb_typeof(p_data->'v') is distinct from 'number'
    or jsonb_typeof(p_data->'player') is distinct from 'object'
    or jsonb_typeof(p_data#>'{player,level}') is distinct from 'number'
    or jsonb_typeof(p_data#>'{player,gold}') is distinct from 'number'
    or jsonb_typeof(p_data->'gear') is distinct from 'object'
    or jsonb_typeof(p_data#>'{gear,equipped}') is distinct from 'object'
    or jsonb_typeof(p_data#>'{gear,bag}') is distinct from 'array' then
    return jsonb_build_object('ok',false,'reason','bad_save');
  end if;
  if p_reason <> 'admin' and exists(select 1 from public.saves where user_id=p_user and v > (p_data->>'v')::numeric) then
    return jsonb_build_object('ok',false,'reason','newer_save');
  end if;
  return public._store_save_v1(p_user,p_data,p_base_rev,p_upload_id,p_app_version,p_client_at,p_reason,p_force);
end $$;

create or replace function public.device_status(p_install uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=public._me(); sid uuid:=public._session_id(); cur public.save_devices%rowtype; r integer;
begin
  if p_install is null then raise exception 'install required' using errcode='22023'; end if;
  perform public._lock_save(uid);
  select rev into r from public.saves where user_id=uid;
  if not found then return jsonb_build_object('exists',false,'active',false); end if;
  select * into cur from public.save_devices where user_id=uid;
  if (cur.session_id is null or cur.session_id=sid) and (cur.install is null or cur.install=p_install) then
    insert into public.save_devices(user_id,install,session_id) values(uid,p_install,sid)
      on conflict(user_id) do update set install=excluded.install,session_id=excluded.session_id;
    return jsonb_build_object('exists',true,'active',true,'claimed',cur.install is null,'rev',r);
  end if;
  return jsonb_build_object('exists',true,'active',false,'rev',r);
end $$;

create or replace function public.upload_save(p_data jsonb,p_base_rev integer,p_upload_id uuid,p_app_version integer default null,
  p_client_at bigint default null,p_install uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=public._me(); sid uuid:=public._session_id(); cur public.save_devices%rowtype; res jsonb;
begin
  perform public._lock_save(uid);
  select * into cur from public.save_devices where user_id=uid;
  if (cur.install is not null and cur.install is distinct from p_install) or (cur.session_id is not null and cur.session_id<>sid) then
    return jsonb_build_object('ok',false,'reason','moved');
  end if;
  res:=public._save_duplicate(uid,p_upload_id);
  if res is not null then return res; end if;
  if public._backup_paused() then return jsonb_build_object('ok',false,'reason','paused'); end if;
  -- 오래된 base_rev는 속도 제한보다 먼저 돌려줘서 충돌 복구가 미뤄지지 않게 함.
  if exists(select 1 from public.saves where user_id=uid and rev is distinct from p_base_rev) then
    return public._store_save(uid,p_data,p_base_rev,p_upload_id,p_app_version,p_client_at,'replaced',false);
  end if;
  if not public._allow_request(uid,'save',public._setting_int('save_interval_seconds',10)) then
    return jsonb_build_object('ok',false,'reason','rate_limited');
  end if;
  res:=public._store_save(uid,p_data,p_base_rev,p_upload_id,p_app_version,p_client_at,'replaced',false);
  if (res->>'ok')::boolean then
    insert into public.save_devices(user_id,install,session_id) values(uid,p_install,sid)
      on conflict(user_id) do update set install=coalesce(public.save_devices.install,excluded.install),session_id=excluded.session_id;
  end if;
  return res;
end $$;

create or replace function public.choose_progress(p_keep text,p_account_rev integer,p_data jsonb default null,p_upload_id uuid default null,
  p_app_version integer default null,p_client_at bigint default null,p_install uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=public._me(); sid uuid:=public._session_id(); cur public.saves%rowtype; res jsonb;
begin
  if p_keep is null or p_keep not in ('account','device') then raise exception 'keep must be account or device' using errcode='22023'; end if;
  perform public._lock_save(uid);
  if public._backup_paused() then return jsonb_build_object('ok',false,'reason','paused'); end if;
  if p_keep='device' and exists(select 1 from public.save_devices where user_id=uid and session_id=sid and install is not distinct from p_install) then
    res:=public._save_duplicate(uid,p_upload_id);
    if res is not null then return res; end if;
  end if;
  select * into cur from public.saves where user_id=uid for update;
  if (found and p_account_rev is distinct from cur.rev) or (not found and (p_keep='account' or coalesce(p_account_rev,0)<>0)) then
    return jsonb_build_object('ok',false,'reason','conflict','rev',cur.rev,'now',public._epoch_ms(now()));
  end if;
  if not public._allow_request(uid,'choose',public._setting_int('choose_interval_seconds',2)) then
    return jsonb_build_object('ok',false,'reason','rate_limited');
  end if;
  if p_keep='account' then
    res:=jsonb_build_object('ok',true,'rev',cur.rev,'now',public._epoch_ms(now()));
  else
    if not public._allow_request(uid,'save',public._setting_int('save_interval_seconds',10)) then
      return jsonb_build_object('ok',false,'reason','rate_limited');
    end if;
    res:=public._store_save(uid,p_data,cur.rev,p_upload_id,p_app_version,p_client_at,'merge',true);
  end if;
  if (res->>'ok')::boolean then
    insert into public.account_merges(user_id,kept,account_rev,account_level,device_level,new_rev)
      values(uid,p_keep,cur.rev,cur.level,public._num(p_data,'{player,level}')::integer,(res->>'rev')::integer);
    insert into public.save_devices(user_id,install,session_id) values(uid,p_install,sid)
      on conflict(user_id) do update set install=excluded.install,session_id=excluded.session_id,active_at=now();
  end if;
  return res;
end $$;

-- 기존 로그의 60일 정리는 유지하고 같은 이벤트의 반복 호출만 합친다.
alter function public.log_login(text,text,integer) rename to _log_login_v1;
revoke execute on function public._log_login_v1(text,text,integer) from public,anon,authenticated;
create function public.log_login(p_event text,p_platform text default null,p_version integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=public._uid();
begin
  if p_event is null or p_event not in ('anon_start','link','sign_in','open','sign_out') then raise exception 'unknown login event' using errcode='22023'; end if;
  if not public._allow_request(uid,'login:'||p_event,public._setting_int('login_interval_seconds',5)) then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;
  return public._log_login_v1(p_event,p_platform,p_version);
end $$;
grant execute on function public.log_login(text,text,integer) to authenticated;

create or replace function public.app_boot(p_platform text,p_version integer,p_count boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare plat text:=case when p_platform in ('android','ios','web') then p_platform else '' end;
  ver integer:=greatest(0,coalesce(p_version,0)); bucket integer:=0; cfg public.app_config%rowtype; list jsonb;
begin
  select * into cfg from public.app_config where platform=plat;
  if ver>0 and (ver in (cfg.min_version,cfg.latest_version) or exists(
    select 1 from jsonb_array_elements((select value from public.server_settings where key='stats_versions')) with ordinality a(v,n)
    where a.n<=50 and a.v=to_jsonb(ver))) then bucket:=ver; end if;
  if p_count and plat<>'' then
    insert into public.boot_stats as b(day,platform,version,n) values((now() at time zone 'utc')::date,plat,bucket,1)
      on conflict(day,platform,version) do update set n=b.n+1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'popup',n.popup,'starts_at',public._epoch_ms(n.starts_at)) order by n.sort desc,n.id desc),'[]'::jsonb)
    into list from public.notices n where n.active and n.starts_at<=now() and (n.ends_at is null or n.ends_at>now())
    and (n.platform is null or n.platform=plat) and (n.min_version is null or ver>=n.min_version) and (n.max_version is null or ver<=n.max_version);
  return jsonb_build_object('now',public._epoch_ms(now()),'config',case when cfg.platform is null then null else
    jsonb_build_object('min_version',cfg.min_version,'latest_version',cfg.latest_version,'store_url',cfg.store_url,'update_message',cfg.update_message,
      'maintenance',cfg.maintenance,'maintenance_message',cfg.maintenance_message,'flags',cfg.flags) end,'notices',list);
end $$;
