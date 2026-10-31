-- 운영에서도 번역·설정·공지 테스트는 한 트랜잭션에서만 보이며 모두 되돌린다. 실제 계정은 사용하지 않는다.
begin;
insert into public.notices(id,title,body,popup,platform,min_version,max_version)
  overriding system value values (-2026103101,'한국어 검사 공지','한국어 검사 본문',false,'android',652,652);
insert into public.notice_translations(notice_id,lang,title,body) values
  (-2026103101,'en','English test notice','English test body'),
  (-2026103101,'ja','日本語の確認','日本語の本文');
update public.app_config set update_message='한국어 검사 업데이트', maintenance_message='한국어 검사 점검' where platform='android';
insert into public.app_config_translations(platform,lang,update_message,maintenance_message) values
  ('android','en','English test update','English test maintenance'),
  ('android','ja','日本語の更新','日本語のメンテナンス')
  on conflict(platform,lang) do update set update_message=excluded.update_message,maintenance_message=excluded.maintenance_message;
set local role anon;
do $$
declare b jsonb; n jsonb; row record;
begin
  for row in select * from (values
    ('ko','한국어 검사 공지','한국어 검사 본문','한국어 검사 업데이트','한국어 검사 점검'),
    ('en','English test notice','English test body','English test update','English test maintenance'),
    ('ja','日本語の確認','日本語の本文','日本語の更新','日本語のメンテナンス')) v(lang,title,body,upd,maint)
  loop
    b:=public.app_boot('android',652,false,row.lang);
    select a into n from jsonb_array_elements(b->'notices') a where a->>'id'='-2026103101';
    if n->>'title' is distinct from row.title or n->>'body' is distinct from row.body
      or b->'config'->>'update_message' is distinct from row.upd
      or b->'config'->>'maintenance_message' is distinct from row.maint then raise exception 'language mismatch: % %',row.lang,b; end if;
  end loop;
  b:=public.app_boot('android',652,false);
  select a into n from jsonb_array_elements(b->'notices') a where a->>'id'='-2026103101';
  if n->>'title' is distinct from '한국어 검사 공지' then raise exception 'legacy response changed'; end if;
  for row in select unnest(array['notice_translations','app_config_translations']) as name loop
    if has_table_privilege('anon','public.'||row.name,'SELECT') or has_table_privilege('anon','public.'||row.name,'INSERT')
      or has_table_privilege('authenticated','public.'||row.name,'SELECT') or has_table_privilege('authenticated','public.'||row.name,'UPDATE')
      then raise exception 'translations exposed: %',row.name; end if;
  end loop;
end $$;
reset role;
-- 영어 대체도 실제 함수로 확인한다. 공지 제목·본문은 한 언어로 함께 선택한다.
delete from public.notice_translations where notice_id=-2026103101 and lang='ja';
set local role authenticated;
do $$ declare b jsonb; n jsonb; begin
  b:=public.app_boot('android',652,false,'ja-JP');
  select a into n from jsonb_array_elements(b->'notices') a where a->>'id'='-2026103101';
  if n->>'title' is distinct from 'English test notice' or n->>'body' is distinct from 'English test body'
    or n->>'language' is distinct from 'en' then raise exception 'English fallback failed'; end if;
end $$;
reset role;
rollback;
select 'server_languages_live_smoke' as check_name,
  not exists(select 1 from public.notices where id=-2026103101) as passed,
  'ko/en/ja, legacy, fallback and permissions passed; all test data/settings rolled back' as result;
