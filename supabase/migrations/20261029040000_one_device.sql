-- 한 계정 = 한 기기 (2026-10-29 Lim 「1번으로 하여 문제없도록 만들어보자. 단순히 앱을 지우고 다시 복구시에도 문제 없도록」, 기획 120 9-2b).
-- 계정 공유 막기: 서버가 「현재 기기」 (앱 설치 번호 active_install)를 적어 두고, 다른 설치의 백업은 받지 않는다 ('moved').
-- 현재 기기가 되는 때: 그 계정의 첫 백업 · 구글 로그인 때 진행 고르기 (choose_progress) · 아직 아무도 안 잡은 계정의 device_status.
-- 옛 기기는 'moved'를 받으면 로그아웃하고 그 기기의 진행을 지운다 (앱). 앱을 지우고 다시 깔면 새 설치 번호 → 구글 연결 → 고르기로 다시 현재 기기.
-- 설치 번호를 모르는 옛 앱 (빌드 589 이하)은 아직 아무도 안 잡은 계정에만 백업할 수 있다.

alter table public.saves add column active_install uuid, add column active_at timestamptz;
comment on column public.saves.active_install is '현재 기기 (앱 설치 번호). 다른 설치의 백업은 moved로 거절';

-- 지금 기기가 이 계정의 현재 기기인가. 아직 아무도 안 잡았으면 이 기기가 잡음 (claimed)
create function public.device_status(p_install uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._me();
  cur public.saves%rowtype;
begin
  if p_install is null then raise exception 'install required' using errcode = '22023'; end if;
  select * into cur from public.saves s where s.user_id = uid for update;
  if not found then return jsonb_build_object('exists', false, 'active', false, 'now', public._epoch_ms(now())); end if;
  if cur.active_install is null then
    update public.saves s set active_install = p_install, active_at = now() where s.user_id = uid;
    return jsonb_build_object('exists', true, 'active', true, 'claimed', true, 'rev', cur.rev, 'now', public._epoch_ms(now()));
  end if;
  return jsonb_build_object('exists', true, 'active', cur.active_install = p_install, 'rev', cur.rev, 'now', public._epoch_ms(now()));
end $$;

-- 자동 백업: 현재 기기가 아니면 moved (덮지 않음). 첫 백업 · 아직 아무도 안 잡은 계정이면 이 기기가 현재 기기
drop function public.upload_save(jsonb, integer, uuid, integer, bigint);
create function public.upload_save(p_data jsonb, p_base_rev integer, p_upload_id uuid, p_app_version integer default null, p_client_at bigint default null,
  p_install uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._me();
  cfg_flags jsonb;
  holder uuid;
  res jsonb;
begin
  select c.flags into cfg_flags from public.app_config c where c.platform = 'android';
  if exists (select 1 from public.app_config c where c.maintenance) or coalesce((cfg_flags ->> 'backup')::boolean, true) = false then
    return jsonb_build_object('ok', false, 'reason', 'paused', 'now', public._epoch_ms(now()));
  end if;
  select s.active_install into holder from public.saves s where s.user_id = uid for update;
  if holder is not null and holder is distinct from p_install then
    return jsonb_build_object('ok', false, 'reason', 'moved', 'now', public._epoch_ms(now()));
  end if;
  res := public._store_save(uid, p_data, p_base_rev, p_upload_id, p_app_version, p_client_at, 'replaced', false);
  if p_install is not null and (res ->> 'ok')::boolean then
    update public.saves s set active_install = p_install, active_at = coalesce(s.active_at, now()) where s.user_id = uid and s.active_install is null;
  end if;
  return res;
end $$;

-- 구글 로그인 때 고르기: 고른 기기가 현재 기기가 됨 (다른 기기는 다음에 moved)
drop function public.choose_progress(text, integer, jsonb, uuid, integer, bigint);
create function public.choose_progress(p_keep text, p_account_rev integer, p_data jsonb default null, p_upload_id uuid default null,
  p_app_version integer default null, p_client_at bigint default null, p_install uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._me();
  cur public.saves%rowtype;
  res jsonb;
begin
  if p_keep not in ('account', 'device') then raise exception 'keep must be account or device' using errcode = '22023'; end if;
  select * into cur from public.saves s where s.user_id = uid for update;
  if found and p_account_rev is distinct from cur.rev then
    return jsonb_build_object('ok', false, 'reason', 'conflict', 'rev', cur.rev, 'now', public._epoch_ms(now()));
  end if;
  if p_keep = 'account' then
    insert into public.account_merges (user_id, kept, account_rev, account_level, device_level)
      values (uid, 'account', cur.rev, cur.level, public._num(p_data, '{player,level}')::integer);
    res := jsonb_build_object('ok', true, 'rev', cur.rev, 'now', public._epoch_ms(now()));
  else
    res := public._store_save(uid, p_data, cur.rev, p_upload_id, p_app_version, p_client_at, 'merge', true);
    if (res ->> 'ok')::boolean and not coalesce((res ->> 'duplicate')::boolean, false) then
      insert into public.account_merges (user_id, kept, account_rev, account_level, device_level, new_rev)
        values (uid, 'device', cur.rev, cur.level, public._num(p_data, '{player,level}')::integer, (res ->> 'rev')::integer);
    end if;
  end if;
  if p_install is not null and (res ->> 'ok')::boolean then
    update public.saves s set active_install = p_install, active_at = now() where s.user_id = uid;
  end if;
  return res;
end $$;

revoke execute on function public.device_status(uuid) from public, anon, authenticated;
revoke execute on function public.upload_save(jsonb, integer, uuid, integer, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.choose_progress(text, integer, jsonb, uuid, integer, bigint, uuid) from public, anon, authenticated;
grant execute on function public.device_status(uuid) to authenticated;
grant execute on function public.upload_save(jsonb, integer, uuid, integer, bigint, uuid) to authenticated;
grant execute on function public.choose_progress(text, integer, jsonb, uuid, integer, bigint, uuid) to authenticated;
