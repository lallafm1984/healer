-- 설정 언어로 공지·업데이트·점검 문구를 받는다. 기존 3인자 app_boot와 기본 한국어 열은 유지한다.
begin;

create table public.notice_translations (
  notice_id bigint not null references public.notices(id) on delete cascade,
  lang text not null check (lang in ('ko', 'en', 'ja')),
  title text not null check (length(btrim(title)) > 0),
  body text not null default '',
  primary key (notice_id, lang)
);
create table public.app_config_translations (
  platform text not null references public.app_config(platform) on delete cascade,
  lang text not null check (lang in ('ko', 'en', 'ja')),
  update_message text,
  maintenance_message text,
  primary key (platform, lang)
);
comment on table public.notice_translations is '공지 번역. 선택 언어 → 영어 → notices의 기존 한국어. 제목·본문은 한 언어 묶음으로 선택';
comment on table public.app_config_translations is '플랫폼별 업데이트·점검 문구 번역. 비어 있는 문구는 영어 → 기존 한국어 → 앱 기본 문구';
alter table public.notice_translations enable row level security;
alter table public.app_config_translations enable row level security;
revoke all on public.notice_translations, public.app_config_translations from public, anon, authenticated;
grant all on public.notice_translations, public.app_config_translations to service_role;

-- 마지막 인자는 필수: 기본값을 두면 이전 2/3인자 호출과 PostgREST 오버로드가 모호해진다.
create function public.app_boot(p_platform text, p_version integer, p_count boolean, p_lang text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  requested text := split_part(replace(lower(btrim(coalesce(p_lang, ''))), '_', '-'), '-', 1);
  b jsonb;
  translated jsonb;
  msg text;
  maint text;
begin
  if requested not in ('ko', 'en', 'ja') then requested := 'en'; end if;
  -- 대상·기간·버전 필터와 제한된 통계 집계는 기존 함수 한 번에 맡긴다.
  b := public.app_boot(p_platform, p_version, p_count);
  if b->'config' <> 'null'::jsonb then
    select coalesce(nullif(btrim(wanted.update_message), ''), nullif(btrim(english.update_message), ''), b->'config'->>'update_message'),
           coalesce(nullif(btrim(wanted.maintenance_message), ''), nullif(btrim(english.maintenance_message), ''), b->'config'->>'maintenance_message')
      into msg, maint
      from (select 1) one
      left join public.app_config_translations wanted on wanted.platform=p_platform and wanted.lang=requested
      left join public.app_config_translations english on english.platform=p_platform and english.lang='en' and requested<>'ko';
    b := jsonb_set(b, '{config}', b->'config' || jsonb_build_object('update_message', msg, 'maintenance_message', maint));
  end if;
  select coalesce(jsonb_agg(n.item || jsonb_build_object('title', coalesce(tr.title, n.item->>'title'),
      'body', coalesce(tr.body, n.item->>'body'), 'language', coalesce(tr.lang, 'ko')) order by n.ord), '[]'::jsonb)
    into translated
    from jsonb_array_elements(b->'notices') with ordinality n(item, ord)
    left join lateral (
      select t.title, t.body, t.lang from public.notice_translations t
      where t.notice_id=(n.item->>'id')::bigint and (t.lang=requested or (requested<>'ko' and t.lang='en'))
      order by (t.lang=requested) desc limit 1
    ) tr on true;
  return b || jsonb_build_object('language', requested, 'notices', translated);
end $$;
revoke all on function public.app_boot(text, integer, boolean, text) from public;
grant execute on function public.app_boot(text, integer, boolean, text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
