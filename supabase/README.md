# 나혼자 힐러 서버 (Supabase)

기획: 맥 `나혼자힐러/120_서버DB_도입_로그인_데이터범위_조작방지.md` 9장 「확정 설계」 (2026-10-29 Lim 결정). 게임은 오프라인 싱글 그대로이고, 서버는 아래만 한다.

| 하는 일 | 함수 | 누가 부르나 |
|---|---|---|
| 서버 시각 · 강제 업데이트 · 점검 · 공지 (+ 버전별 켠 수) | `app_boot(platform, version, count)` | 모두 (게스트도, 공개 키) |
| 서버 시각만 | `server_now()` | 모두 |
| 자동 백업 (앱을 끄거나 뒤로 보낼 때) | `upload_save(data, base_rev, upload_id, app_version, client_at)` | 구글 로그인 한 사람 |
| 자기 저장 받기 (로그인 고르기 · 저장 깨짐 때만) | `download_save()` | 구글 로그인 한 사람 |
| 구글 로그인 때 진행 고르기 | `choose_progress(keep, account_rev, data, upload_id, …)` | 구글 로그인 한 사람 |
| 계정 삭제 | `delete_account()` | 구글 로그인 한 사람 |
| 로그인 기록 (구글 로그인 · 로그인한 채로 켬 · 로그아웃, 60일 보관) | `log_login(event, platform, version)` | 구글 로그인 한 사람 |
| 사본 한 판 되돌리기 | `admin_restore_save(user_id, history_id)` | 대시보드만 |

표: `saves` (사용자마다 지금 판) · `save_history` (사본, `server_settings.history_keep`개) · `purchases` (PR 4 RevenueCat) · `account_merges` · `audit_flags` (조작 의심 기록, 막지 않음) · `app_config` · `notices` · `boot_stats` · `login_logs` (60일 지난 줄은 `log_login`이 지움, `server_settings.login_keep_days`) · `server_settings`.

보안: 모든 표 RLS, 앱 키로는 자기 `saves` · `purchases` 읽기만. 쓰기는 `security definer` RPC만 (`auth.uid()`로만 사용자를 정함, `search_path = ''`), 실행 권한은 위 표의 역할에만. **service_role 키는 앱 · 이 저장소 (공개)에 절대 넣지 않는다.**

## 처음 설정 (Lim)

1. [supabase.com](https://supabase.com) → New project → Free, Region **Northeast Asia (Seoul)**. DB 비밀번호는 따로 보관.
2. Project Settings → API (또는 Data API): **Project URL**과 **anon public 키**를 Claude에게. (공개 키는 앱에 들어가는 값이라 공개돼도 된다. `service_role` 키는 주지 않는다.)
3. SQL Editor → New query → `supabase/migrations/` 파일을 번호 순서대로 통째로 붙여 넣고 Run.
4. Authentication → Sign In / Providers: **Anonymous sign-ins는 끈 채로** (익명 로그인은 쓰지 않음). Google은 앱 PR 3 때 켠다 (Google Cloud OAuth 클라이언트 웹 1 · 안드로이드 1, 앱 서명 SHA-1 — 그때 순서를 따로 안내).
5. Table Editor → `app_config`의 `android` 줄이 있는지 확인.

무료 플랜은 1주 동안 아무도 안 쓰면 멈출 수 있다 (데이터는 남음, 대시보드에서 다시 켬). 앱은 서버에 못 닿아도 로컬 저장으로 그대로 돈다.

## 자주 하는 일 (SQL Editor)

```sql
-- 공지 (popup = 처음 볼 때 한 번 창, 기간 · 버전 · 플랫폼을 비우면 모두)
insert into public.notices (title, body, popup, ends_at) values ('점검 안내', '10월 30일 02:00 ~ 03:00 백업이 잠시 멈춥니다.', true, '2026-10-30 03:00+09');
update public.notices set active = false where id = 1;

-- 강제 업데이트: 이 versionCode보다 낮은 앱은 업데이트 전까지 막음 / 새 버전 알림만
update public.app_config set min_version = 600, update_message = null where platform = 'android';
update public.app_config set latest_version = 612 where platform = 'android';

-- 점검 (백업 · 로그인 멈춤, 게임은 그대로) · 백업만 끄기
update public.app_config set maintenance = true, maintenance_message = '서버 점검 중입니다.' where platform = 'android';
update public.app_config set maintenance = false, flags = '{"backup": false}' where platform = 'android';

-- 조작 의심 기록 (검토 안 한 것) · 검토 표시
select f.id, f.created_at, f.user_id, f.rule, f.severity, f.detail from public.audit_flags f where f.reviewed_at is null order by f.id desc limit 100;
update public.audit_flags set reviewed_at = now(), note = '장비 판매, 정상' where id = 123;

-- 로그인 기록 (최근 것 · 한 사람)
select l.created_at, l.user_id, l.event, l.platform, l.app_version from public.login_logs l order by l.id desc limit 100;
select l.created_at, l.event, l.app_version from public.login_logs l where l.user_id = '…' order by l.id desc;
-- 아무도 로그인하지 않아도 60일을 지키려면 (선택, Database → Extensions에서 pg_cron을 켠 뒤)
-- select cron.schedule('login-logs-keep', '0 18 * * *', $$delete from public.login_logs where created_at < now() - interval '60 days'$$);

-- 버전별 켠 수 (최근 7일)
select day, version, n from public.boot_stats where day > current_date - 7 order by day desc, version desc;

-- 사본 되돌리기: 그 사용자의 사본을 보고 한 판을 지금 판으로 (앱은 다음 백업 때 고르기 창을 띄움)
select id, rev, reason, level, gold, saved_at from public.save_history where user_id = '…' order by id desc;
select public.admin_restore_save('…', 42);

-- 서버 안쪽 값 (사본 수 · 탐지 기준)
select * from public.server_settings;
update public.server_settings set value = '3' where key = 'history_keep';
```

## 테스트

`npx vitest run tests/server-db.test.ts`: PGlite (WASM Postgres)로 마이그레이션을 그대로 돌리고, Supabase의 역할 · `auth` 스키마는 `tests/fixtures/supabase-stub.sql`이 흉내 낸다. 권한 (게스트 · 남의 저장 · 직접 쓰기), 덮어쓰기 막는 절차 (`upload_id` 재시도 · `base_rev` 거절 · 사본 수), 탐지 기록, 진행 고르기, 로그인 기록 60일, 계정 삭제를 본다. 마이그레이션을 고치면 이 테스트도 맞춘다. 실제 Supabase에 처음 적용한 뒤에는 `delete_account`가 `auth.users`를 지우는지 한 번 확인한다 (테스트는 흉내 낸 `auth`).
