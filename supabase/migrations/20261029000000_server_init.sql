-- 나혼자 힐러 서버 첫 판 (기획 120 9장 확정 설계, 2026-10-29 Lim 결정)
--
-- 게임은 오프라인 싱글 그대로 (기기 저장이 주인). 서버가 하는 일:
--   1. 앱이 켜질 때 서버 시각 · 강제 업데이트 · 점검 · 공지를 알려 줌 (app_boot, 게스트도 공개 키로)
--   2. 구글 로그인 한 사람의 저장을 통째로 백업 (upload_save · download_save · choose_progress)
--   3. 조작 의심은 막지 않고 audit_flags에 적기만 (Lim 결정 3)
--   4. 계정 삭제 (delete_account, Google Play 정책)
--
-- 보안 (기획 120 4-2): 모든 표 RLS, 앱 키에는 자기 줄 읽기 정책만 (쓰기 정책 없음).
-- 쓰기는 security definer RPC만, RPC는 auth.uid()로만 사용자를 정함, search_path = '', 실행 권한은 필요한 역할에만.

-- ---------- 서버 안쪽 설정 (앱은 못 읽음) ----------
create table public.server_settings (
  key text primary key,
  value jsonb not null,
  note text
);
insert into public.server_settings (key, value, note) values
  ('history_keep', '2', '저장 사본을 사용자마다 몇 개 남길지 (무료 DB 500MB, 120 4-4: 보관 수는 실측 뒤 다시 정함)'),
  ('save_max_bytes', '524288', '저장 하나의 최대 크기 (바이트). 넘으면 올림 거절'),
  ('audit_gold_per_win', '20000', '이긴 판 하나에 늘 수 있다고 보는 골드 (넉넉히, 탐지 기록 기준)'),
  ('audit_gold_slack', '200000', '판 수와 상관없이 봐주는 골드 증가 (장비 판매 · 임무 · 상자)'),
  ('audit_level_slack', '5', '이긴 판 수보다 더 오를 수 있다고 보는 레벨'),
  ('audit_big_bytes', '262144', '이보다 큰 저장은 info로 적음');

-- ---------- 저장 ----------
create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rev integer not null check (rev > 0),
  last_upload_id uuid not null,
  v integer not null,
  level integer not null,
  gold bigint not null,
  wins integer not null default 0,
  data jsonb not null,
  app_version integer,
  client_at bigint,
  updated_at timestamptz not null default now()
);
comment on table public.saves is '구글 로그인 한 사람의 저장 (사용자마다 지금 판 한 줄). 앱은 RPC로만 씀';

create table public.save_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  rev integer not null,
  upload_id uuid not null,
  reason text not null check (reason in ('replaced', 'merge', 'admin')),
  level integer not null,
  gold bigint not null,
  data jsonb not null,
  saved_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index save_history_user on public.save_history (user_id, id desc);
create index save_history_upload on public.save_history (user_id, upload_id);
comment on table public.save_history is '덮이기 전 판 (되돌림용). 사용자마다 server_settings.history_keep개만 남김';

-- ---------- 구매 (결제 권한의 기록. 권한 자체는 RevenueCat 영수증, PR 4에서 웹훅이 씀) ----------
create table public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  source text not null check (source in ('store', 'gold', 'legacy', 'test')),
  store_tx text,
  status text not null default 'active' check (status in ('active', 'refunded', 'transferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, source)
);

-- ---------- 진행 고르기 기록 (구글 로그인 때 이 폰 진행 · 계정 진행) ----------
create table public.account_merges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kept text not null check (kept in ('device', 'account')),
  account_rev integer,
  account_level integer,
  device_level integer,
  new_rev integer,
  created_at timestamptz not null default now()
);

-- ---------- 탐지 · 기록 (Lim 결정 3: 막지 않고 따로 표에 적어 검토) ----------
create table public.audit_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  rev integer,
  rule text not null,
  severity text not null check (severity in ('info', 'warn', 'high')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  note text
);
create index audit_flags_open on public.audit_flags (created_at desc) where reviewed_at is null;
comment on table public.audit_flags is '조작 의심 기록. 게임은 막지 않음. 검토하면 reviewed_at · note를 적음';

-- ---------- 강제 업데이트 · 점검 · 원격 스위치 (Lim 추가 지시) ----------
create table public.app_config (
  platform text primary key,
  min_version integer not null default 0,
  latest_version integer not null default 0,
  store_url text,
  update_message text,
  maintenance boolean not null default false,
  maintenance_message text,
  flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
comment on column public.app_config.min_version is '이보다 낮은 앱 (versionCode)은 업데이트 전까지 막음';
comment on column public.app_config.latest_version is '이보다 낮으면 새 버전 알림 (닫을 수 있음)';
comment on column public.app_config.maintenance is '켜면 백업 · 로그인 같은 서버 일을 멈추고 점검 안내 (게임은 오프라인으로 그대로)';
comment on column public.app_config.flags is '원격 스위치. 예: {"backup": false}';
insert into public.app_config (platform, store_url) values
  ('android', 'https://play.google.com/store/apps/details?id=com.lallafm.healer');

-- ---------- 공지 ----------
create table public.notices (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  popup boolean not null default false,
  platform text,
  min_version integer,
  max_version integer,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index notices_live on public.notices (sort desc, id desc) where active;
comment on table public.notices is '공지. platform · min_version · max_version을 비우면 모두에게. popup이면 처음 볼 때 한 번 창';

-- ---------- 버전별 켠 수 (사람 정보 없음, 강제 업데이트 시점을 볼 근거) ----------
create table public.boot_stats (
  day date not null,
  platform text not null,
  version integer not null,
  n bigint not null default 0,
  primary key (day, platform, version)
);

-- ---------- RLS: 모든 표. 앱 키에는 자기 저장 · 자기 구매 읽기만 ----------
alter table public.server_settings enable row level security;
alter table public.saves enable row level security;
alter table public.save_history enable row level security;
alter table public.purchases enable row level security;
alter table public.account_merges enable row level security;
alter table public.audit_flags enable row level security;
alter table public.app_config enable row level security;
alter table public.notices enable row level security;
alter table public.boot_stats enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.saves to authenticated;
grant select on public.purchases to authenticated;
create policy saves_own on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy purchases_own on public.purchases for select to authenticated using (user_id = (select auth.uid()));

-- ---------- 안쪽 도우미 (앱은 못 부름) ----------
create function public._setting_int(p_key text, p_default bigint) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.value #>> '{}')::bigint from public.server_settings s where s.key = p_key), p_default)
$$;

-- 로그인한 정식 사용자 (익명 로그인은 쓰지 않음, Lim 결정 1)
create function public._me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'login required' using errcode = '28000'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous users cannot back up' using errcode = '28000';
  end if;
  return uid;
end $$;

create function public._epoch_ms(t timestamptz) returns bigint
language sql immutable set search_path = '' as $$ select (extract(epoch from t) * 1000)::bigint $$;

-- 이긴 판 수 = clears[장소][난이도].n 합 (클라이언트 저장 형식 v33)
create function public._wins(p_data jsonb) returns integer
language sql immutable set search_path = '' as $$
  select coalesce(sum(case when jsonb_typeof(d.value -> 'n') = 'number' then (d.value ->> 'n')::numeric else 0 end), 0)::integer
  from jsonb_each(case when jsonb_typeof(p_data -> 'clears') = 'object' then p_data -> 'clears' else '{}'::jsonb end) c,
       jsonb_each(case when jsonb_typeof(c.value) = 'object' then c.value else '{}'::jsonb end) d
$$;

create function public._num(p_data jsonb, p_path text[]) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_data #> p_path) = 'number' then (p_data #>> p_path)::numeric else null end
$$;

-- 탐지 규칙 (기록만). old_* 가 null이면 첫 백업
create function public._audit(p_user uuid, p_rev integer, p_old jsonb, p_new jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  lv numeric := public._num(p_new, '{player,level}');
  gold numeric := public._num(p_new, '{player,gold}');
  ver numeric := public._num(p_new, '{v}');
  nid numeric := public._num(p_new, '{nextId}');
  wins integer := public._wins(p_new);
  old_lv numeric; old_gold numeric; old_ver numeric; old_nid numeric; old_wins integer; dw integer;
  bytes integer := octet_length(p_new::text);
begin
  if lv is null or lv < 1 or lv > 100 or lv <> trunc(lv) then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'range_level', 'high', jsonb_build_object('level', p_new #> '{player,level}'));
  end if;
  if gold is null or gold < 0 then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'range_gold', 'high', jsonb_build_object('gold', p_new #> '{player,gold}'));
  end if;
  if bytes > public._setting_int('audit_big_bytes', 262144) then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'big_save', 'info', jsonb_build_object('bytes', bytes));
  end if;
  if p_old is null then
    insert into public.audit_flags (user_id, rev, rule, severity, detail)
      values (p_user, p_rev, 'first_upload', 'info', jsonb_build_object('level', lv, 'gold', gold, 'wins', wins, 'v', ver));
    return;
  end if;
  old_lv := public._num(p_old, '{player,level}');
  old_gold := public._num(p_old, '{player,gold}');
  old_ver := public._num(p_old, '{v}');
  old_nid := public._num(p_old, '{nextId}');
  old_wins := public._wins(p_old);
  dw := greatest(0, wins - old_wins);
  if gold is not null and old_gold is not null
     and gold - old_gold > dw * public._setting_int('audit_gold_per_win', 20000) + public._setting_int('audit_gold_slack', 200000) then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'jump_gold', 'warn',
      jsonb_build_object('old', old_gold, 'new', gold, 'diff', gold - old_gold, 'wins_diff', dw,
        'bag_old', jsonb_array_length(coalesce(p_old #> '{gear,bag}', '[]'::jsonb)), 'bag_new', jsonb_array_length(coalesce(p_new #> '{gear,bag}', '[]'::jsonb))));
  end if;
  if lv is not null and old_lv is not null and lv - old_lv > dw + public._setting_int('audit_level_slack', 5) then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'jump_level', 'warn',
      jsonb_build_object('old', old_lv, 'new', lv, 'wins_diff', dw));
  end if;
  if wins < old_wins then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'wins_back', 'warn',
      jsonb_build_object('old', old_wins, 'new', wins));
  end if;
  if nid is not null and old_nid is not null and nid < old_nid then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'next_id_back', 'warn',
      jsonb_build_object('old', old_nid, 'new', nid));
  end if;
  if ver is not null and old_ver is not null and ver < old_ver then
    insert into public.audit_flags (user_id, rev, rule, severity, detail) values (p_user, p_rev, 'version_back', 'warn',
      jsonb_build_object('old', old_ver, 'new', ver));
  end if;
end $$;

-- 저장 한 판을 넣음 (잠금 · 사본 · 반영 · 탐지 · 사본 정리를 한 트랜잭션에서, 기획 120 3-1)
-- 이미 처리한 upload_id면 다시 넣지 않고 그때 결과 (duplicate)
create function public._store_save(
  p_user uuid, p_data jsonb, p_base_rev integer, p_upload_id uuid, p_app_version integer, p_client_at bigint, p_reason text, p_force boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cur public.saves%rowtype;
  hist_rev integer;
  new_rev integer;
  keep bigint := public._setting_int('history_keep', 2);
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'save must be an object' using errcode = '22023'; end if;
  if p_upload_id is null then raise exception 'upload_id required' using errcode = '22023'; end if;
  if octet_length(p_data::text) > public._setting_int('save_max_bytes', 524288) then
    return jsonb_build_object('ok', false, 'reason', 'too_big', 'now', public._epoch_ms(now()));
  end if;
  if public._num(p_data, '{v}') is null or public._num(p_data, '{player,level}') is null or public._num(p_data, '{player,gold}') is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_save', 'now', public._epoch_ms(now()));
  end if;

  select * into cur from public.saves s where s.user_id = p_user for update;

  if found then
    if cur.last_upload_id = p_upload_id then
      return jsonb_build_object('ok', true, 'duplicate', true, 'rev', cur.rev, 'now', public._epoch_ms(now()));
    end if;
    select h.rev into hist_rev from public.save_history h where h.user_id = p_user and h.upload_id = p_upload_id order by h.id desc limit 1;
    if found then
      -- 응답을 못 받은 옛 올림을 다시 보냄: 이미 처리했고 그 뒤 판이 더 있음
      return jsonb_build_object('ok', true, 'duplicate', true, 'rev', hist_rev, 'latest_rev', cur.rev, 'now', public._epoch_ms(now()));
    end if;
    if not p_force and (p_base_rev is null or p_base_rev <> cur.rev) then
      return jsonb_build_object('ok', false, 'reason', 'conflict', 'rev', cur.rev, 'level', cur.level,
        'updated_at', public._epoch_ms(cur.updated_at), 'now', public._epoch_ms(now()));
    end if;
    insert into public.save_history (user_id, rev, upload_id, reason, level, gold, data, saved_at)
      values (p_user, cur.rev, cur.last_upload_id, p_reason, cur.level, cur.gold, cur.data, cur.updated_at);
    new_rev := cur.rev + 1;
    update public.saves s set rev = new_rev, last_upload_id = p_upload_id,
      v = public._num(p_data, '{v}')::integer, level = public._num(p_data, '{player,level}')::integer,
      gold = public._num(p_data, '{player,gold}')::bigint, wins = public._wins(p_data), data = p_data,
      app_version = p_app_version, client_at = p_client_at, updated_at = now()
      where s.user_id = p_user;
    perform public._audit(p_user, new_rev, cur.data, p_data);
    delete from public.save_history h where h.user_id = p_user and h.id not in (
      select h2.id from public.save_history h2 where h2.user_id = p_user order by h2.id desc limit keep);
  else
    new_rev := 1;
    insert into public.saves (user_id, rev, last_upload_id, v, level, gold, wins, data, app_version, client_at)
      values (p_user, 1, p_upload_id, public._num(p_data, '{v}')::integer, public._num(p_data, '{player,level}')::integer,
        public._num(p_data, '{player,gold}')::bigint, public._wins(p_data), p_data, p_app_version, p_client_at);
    perform public._audit(p_user, 1, null, p_data);
  end if;
  return jsonb_build_object('ok', true, 'rev', new_rev, 'now', public._epoch_ms(now()));
end $$;

-- ---------- 앱이 부르는 RPC ----------

-- 서버 시각만 (ms). 게스트도
create function public.server_now() returns bigint
language sql stable set search_path = '' as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- 앱이 켜질 때 한 번: 서버 시각 · 설정 한 줄 · 지금 보일 공지. 게스트도 (공개 키).
-- p_count = 켠 수 셈 (앱을 다시 앞으로 가져올 때는 false)
create function public.app_boot(p_platform text, p_version integer, p_count boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  plat text := left(coalesce(p_platform, ''), 16);
  ver integer := greatest(0, least(coalesce(p_version, 0), 1000000000));
  cfg public.app_config%rowtype;
  list jsonb;
begin
  if p_count and plat <> '' then
    insert into public.boot_stats as b (day, platform, version, n) values ((now() at time zone 'utc')::date, plat, ver, 1)
      on conflict (day, platform, version) do update set n = b.n + 1;
  end if;
  select * into cfg from public.app_config c where c.platform = plat;
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'popup', n.popup,
      'starts_at', public._epoch_ms(n.starts_at)) order by n.sort desc, n.id desc), '[]'::jsonb)
    into list
    from public.notices n
    where n.active and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
      and (n.platform is null or n.platform = plat)
      and (n.min_version is null or ver >= n.min_version)
      and (n.max_version is null or ver <= n.max_version);
  return jsonb_build_object(
    'now', public._epoch_ms(now()),
    'config', case when cfg.platform is null then null else jsonb_build_object(
      'min_version', cfg.min_version, 'latest_version', cfg.latest_version, 'store_url', cfg.store_url,
      'update_message', cfg.update_message, 'maintenance', cfg.maintenance, 'maintenance_message', cfg.maintenance_message,
      'flags', cfg.flags) end,
    'notices', list);
end $$;

-- 자동 백업 (앱을 끄거나 뒤로 보낼 때). base_rev = 마지막으로 서버와 맞춘 판
create function public.upload_save(p_data jsonb, p_base_rev integer, p_upload_id uuid, p_app_version integer default null, p_client_at bigint default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._me();
  cfg_flags jsonb;
begin
  select c.flags into cfg_flags from public.app_config c where c.platform = 'android';
  if exists (select 1 from public.app_config c where c.maintenance) or coalesce((cfg_flags ->> 'backup')::boolean, true) = false then
    return jsonb_build_object('ok', false, 'reason', 'paused', 'now', public._epoch_ms(now()));
  end if;
  return public._store_save(uid, p_data, p_base_rev, p_upload_id, p_app_version, p_client_at, 'replaced', false);
end $$;

-- 자기 저장 받기 (로그인할 때 고르기 · 저장이 깨졌을 때만 앱이 부름)
create function public.download_save() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public._me();
  cur public.saves%rowtype;
begin
  select * into cur from public.saves s where s.user_id = uid;
  if not found then return jsonb_build_object('exists', false, 'now', public._epoch_ms(now())); end if;
  return jsonb_build_object('exists', true, 'rev', cur.rev, 'level', cur.level, 'v', cur.v, 'data', cur.data,
    'updated_at', public._epoch_ms(cur.updated_at), 'now', public._epoch_ms(now()));
end $$;

-- 구글 로그인 때 고르기 결과. keep = 'account' (계정 진행을 받음, 기록만) · 'device' (이 폰 진행을 올림, 계정 옛 판은 사본)
-- p_account_rev = 고르기 창에 보여 준 계정 판 (그 사이 바뀌었으면 conflict)
create function public.choose_progress(p_keep text, p_account_rev integer, p_data jsonb default null, p_upload_id uuid default null,
  p_app_version integer default null, p_client_at bigint default null) returns jsonb
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
    return jsonb_build_object('ok', true, 'rev', cur.rev, 'now', public._epoch_ms(now()));
  end if;
  res := public._store_save(uid, p_data, cur.rev, p_upload_id, p_app_version, p_client_at, 'merge', true);
  if (res ->> 'ok')::boolean and not coalesce((res ->> 'duplicate')::boolean, false) then
    insert into public.account_merges (user_id, kept, account_rev, account_level, device_level, new_rev)
      values (uid, 'device', cur.rev, cur.level, public._num(p_data, '{player,level}')::integer, (res ->> 'rev')::integer);
  end if;
  return res;
end $$;

-- 계정 삭제 (설정 「계정 삭제」): Auth 사용자를 지우면 저장 · 사본 · 구매 · 기록이 함께 지워짐 (on delete cascade)
create function public.delete_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me();
begin
  delete from auth.users u where u.id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 관리자 전용 (대시보드 SQL 편집기 · 서비스 키만, 앱은 못 부름) ----------
-- 사본 한 판을 지금 판으로 되돌림. 지금 판은 사본으로 물러남. 앱은 다음 백업 때 conflict를 받고 고르기로 받음
create function public.admin_restore_save(p_user uuid, p_history_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.save_history%rowtype;
begin
  select * into h from public.save_history x where x.id = p_history_id and x.user_id = p_user;
  if not found then raise exception 'history row not found'; end if;
  return public._store_save(p_user, h.data, null, gen_random_uuid(), null, null, 'admin', true);
end $$;

-- ---------- 실행 권한: 기본으로 아무도 못 부르게 한 뒤 필요한 것만 ----------
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
grant execute on function public.server_now() to anon, authenticated;
grant execute on function public.app_boot(text, integer, boolean) to anon, authenticated;
grant execute on function public.upload_save(jsonb, integer, uuid, integer, bigint) to authenticated;
grant execute on function public.download_save() to authenticated;
grant execute on function public.choose_progress(text, integer, jsonb, uuid, integer, bigint) to authenticated;
grant execute on function public.delete_account() to authenticated;
-- 도우미 (_로 시작)와 admin_restore_save는 아무에게도 주지 않음 (definer 함수 안에서만 불림)
