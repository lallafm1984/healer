-- 익명 로그인 → 구글 연동 (2026-10-29 Lim 「일단 첫 사용자는 수파베이스에 익명로그인으로 되며, 구글계정 활성화하면 연동되는 방식으로 하자」)
-- 앱을 처음 켜면 Supabase 익명 계정이 생기고, 설정에서 구글을 연결하면 같은 사용자 ID 그대로 구글 계정이 된다 (linkIdentity).
-- 백업 (upload_save · download_save · choose_progress)은 그대로 구글 계정만 (_me: 익명은 다시 로그인할 길이 없어 백업해도 되살릴 수 없음).
-- 로그인 기록 · 계정 삭제는 익명도 (_uid). 오래 안 쓴 익명 계정은 관리자 함수로 정리.

-- 로그인한 사용자 (익명 포함)
create function public._uid() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'login required' using errcode = '28000'; end if;
  return uid;
end $$;

create function public._is_anonymous() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- 로그인 기록: anon_start = 첫 익명 로그인 · link = 익명 계정에 구글 연결 · sign_in = 이미 있던 구글 계정으로 로그인 · open · sign_out
alter table public.login_logs drop constraint login_logs_event_check;
alter table public.login_logs add constraint login_logs_event_check check (event in ('anon_start', 'link', 'sign_in', 'open', 'sign_out'));
alter table public.login_logs add column anonymous boolean not null default false;
comment on column public.login_logs.anonymous is '적을 때 익명 계정이었나';

create or replace function public.log_login(p_event text, p_platform text default null, p_version integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._uid();
  keep bigint := public._setting_int('login_keep_days', 60);
begin
  if p_event not in ('anon_start', 'link', 'sign_in', 'open', 'sign_out') then raise exception 'unknown login event' using errcode = '22023'; end if;
  insert into public.login_logs (user_id, event, platform, app_version, anonymous)
    values (uid, p_event, left(p_platform, 16), greatest(0, least(coalesce(p_version, 0), 1000000000)), public._is_anonymous());
  delete from public.login_logs l where l.id in (
    select x.id from public.login_logs x where x.created_at < now() - make_interval(days => keep::integer) order by x.id limit 1000);
  return jsonb_build_object('ok', true, 'now', public._epoch_ms(now()));
end $$;

-- 계정 삭제: 익명 · 구글 모두 (Auth 사용자를 지우면 저장 · 사본 · 기록이 함께 지워짐)
create or replace function public.delete_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._uid();
begin
  delete from auth.users u where u.id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- 관리자 (대시보드 · 선택 pg_cron): 마지막 로그인 기록 (없으면 만든 때)이 login_keep_days (60)일보다 오래된 익명 계정을 지움. 지운 수
insert into public.server_settings (key, value, note) values
  ('anon_keep_days', '60', '이만큼 안 쓴 익명 계정은 admin_cleanup_anonymous가 지움 (구글을 연결한 계정은 안 지움)');
create function public.admin_cleanup_anonymous() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  keep bigint := public._setting_int('anon_keep_days', 60);
  n integer;
begin
  with gone as (
    delete from auth.users u
    where u.is_anonymous
      and coalesce((select max(l.created_at) from public.login_logs l where l.user_id = u.id), u.created_at) < now() - make_interval(days => keep::integer)
    returning 1)
  select count(*) into n from gone;
  return n;
end $$;

revoke execute on function public._uid() from public, anon, authenticated;
revoke execute on function public._is_anonymous() from public, anon, authenticated;
revoke execute on function public.admin_cleanup_anonymous() from public, anon, authenticated;
grant execute on function public.log_login(text, text, integer) to authenticated;
grant execute on function public.delete_account() to authenticated;
