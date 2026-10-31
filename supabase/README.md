# 나혼자 힐러 서버 (Supabase)

기획: 맥 `나혼자힐러/120_서버DB_도입_로그인_데이터범위_조작방지.md` 9장 「확정 설계」 (2026-10-29 Lim 결정). 게임은 오프라인 싱글 그대로이고, 서버는 아래만 한다.

| 하는 일 | 함수 | 누가 부르나 |
|---|---|---|
| 서버 시각 · 강제 업데이트 · 점검 · 공지 (+ 버전별 켠 수) | `app_boot(platform, version, count)` | 모두 (게스트도, 공개 키) |
| 서버 시각만 | `server_now()` | 모두 |
| 자동 백업 (앱을 끄거나 뒤로 보낼 때) | `upload_save(data, base_rev, upload_id, app_version, client_at)` | 구글 로그인 한 사람 |
| 자기 저장 받기 (로그인 고르기 · 저장 깨짐 때만) | `download_save()` | 구글 로그인 한 사람 |
| 구글 로그인 때 진행 고르기 | `choose_progress(keep, account_rev, data, upload_id, …)` | 구글 로그인 한 사람 |
| 계정 삭제 | `delete_account()` | 로그인한 사람 (익명 포함) |
| 로그인 기록 (첫 익명 · 구글 연동 · 구글 로그인 · 켬 · 로그아웃, 60일 보관) | `log_login(event, platform, version)` | 로그인한 사람 (익명 포함) |
| 오래 안 쓴 익명 계정 정리 (마지막 기록이 `anon_keep_days` 60일보다 오래) | `admin_cleanup_anonymous()` | 대시보드만 |
| 사본 한 판 되돌리기 | `admin_restore_save(user_id, history_id)` | 대시보드만 |

표: `saves` (사용자마다 지금 판) · `save_history` (사본, `server_settings.history_keep`개) · `purchases` (PR 4 RevenueCat) · `account_merges` · `audit_flags` (조작 의심 기록, 막지 않음) · `app_config` · `notices` · `boot_stats` · `login_logs` (60일 지난 줄은 `log_login`이 지움, `server_settings.login_keep_days`) · `server_settings`.

2026-10-31 보완: `save_devices`는 설치 번호와 서명된 JWT의 `session_id`를 묶으며 앱은 읽지 못한다. 같은 계정이어도 다른 세션은 현재 설치 번호를 재사용해 백업할 수 없다. 기존 계정은 현재 설치가 처음 확인될 때 세션을 연결한다. 세션 만료 뒤에는 원래 백업 계정에 다시 연결하며, 기존 진행을 다른 계정으로 복사하지 않는다. 같은 세션 토큰 자체의 탈취와 계속 오프라인인 기기는 별도 범위다.

`rpc_limits`는 사용자별 요청을 순서대로 처리하고 새 저장 10초, 진행 선택 2초, 같은 로그인 이벤트 5초 간격을 적용한다. 설정은 `server_settings`의 `save_interval_seconds`, `choose_interval_seconds`, `login_interval_seconds`. **같은 `upload_id` 재시도는 저장 간격과 무관하게 기존 결과를 돌려준다.** 점검과 `backup=false`는 진행 선택에도 적용한다. 더 높은 저장 버전을 옛 앱이 덮는 요청은 `newer_save`로 거절한다.

`app_boot`는 `android` · `ios` · `web`만 집계한다. `stats_versions`의 최근 50개와 `app_config.min_version/latest_version`에 없는 버전은 **버전 0**으로 합친다. 출시 빌드를 버전별로 보려면 `stats_versions` 목록에도 등록한다. 임의 문자열과 버전마다 새 통계 행을 만드는 것을 막기 위한 제한이며, 공개 API의 호출 자체를 차단하는 방화벽은 아니다.

보안: 모든 표 RLS, 앱 키로는 자기 `saves` · `purchases` 읽기만. 쓰기는 `security definer` RPC만 (`auth.uid()`로만 사용자를 정함, `search_path = ''`), 실행 권한은 위 표의 역할에만. **service_role 키는 앱 · 이 저장소 (공개)에 절대 넣지 않는다.**

## 적용 기록

| 날짜 | 프로젝트 | 마이그레이션 | 방법 |
|---|---|---|---|
| 2026-10-29 | `pdnffebscgldelfqjdan` 「Healer Project」 (lallafm0001@gmail.com 계정, 서울) | `20261029000000_server_init.sql` | Management API (`/database/query`), 공개 키로 `app_boot` · 권한 거절 확인 |
| 2026-10-29 | 같음 | `20261029020000_anonymous_login.sql` (익명 로그인 → 구글 연동) | Management API, 새 함수 권한 거절 확인 |
| 2026-10-31 | 같음 | `20261031000000_backup_hardening.sql` | 브라우저 SQL Editor, 운영 함수 6개 지문 대조 후 적용. 권한 5항목 및 `supabase/tests/backup-hardening.sql` 기능 검사 통과 (테스트 데이터·설정 롤백) |

다른 계정의 Lotto · nullplaying 프로젝트에는 적용하지 않는다 (이 마이그레이션은 `public` 스키마의 공개 권한을 거둬서 다른 앱이 깨짐).
Supabase 보안 점검 (Advisors)의 「RLS는 켜졌는데 정책 없음」 · 「anon/authenticated가 security definer 함수를 부를 수 있음」은 의도한 모양이다 (표는 함수로만, 함수는 `auth.uid()`로만).

## 처음 설정 (Lim)

1. [supabase.com](https://supabase.com) → New project → Free, Region **Northeast Asia (Seoul)**. DB 비밀번호는 따로 보관.
2. Project Settings → API (또는 Data API): **Project URL**과 **anon public 키**를 Claude에게. (공개 키는 앱에 들어가는 값이라 공개돼도 된다. `service_role` 키는 주지 않는다.)
3. SQL Editor → New query → `supabase/migrations/` 파일을 번호 순서대로 통째로 붙여 넣고 Run.
4. Authentication → Sign In / Providers: **Allow anonymous sign-ins 켬** (처음 켜면 익명 계정, 2026-10-29 Lim) · **Allow manual linking 켬** (구글 연동 `linkIdentity`) · **Email 끔** (구글만) · **Google 켬** (Client IDs = 웹 클라이언트 ID, Client Secret = 웹 보안 비밀).
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

-- 오래 안 쓴 익명 계정 정리 (지운 수). 하루 한 번 돌리려면 (선택, pg_cron):
select public.admin_cleanup_anonymous();
-- select cron.schedule('anon-cleanup', '30 18 * * *', $$select public.admin_cleanup_anonymous()$$);

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

`npx vitest run tests/server-db.test.ts tests/account-flow.test.ts tests/account-platform.test.ts`: DB 권한과 세션 인계, 호출 제한, 중복 재시도, 비동기 복원 충돌, 저장 공간 부족, 미래 저장 버전, 복원 후 reload의 pause 이벤트, 실제 SDK 로그아웃 범위를 확인한다. 전체 단위 검사와 빌드 뒤 `E2E_ONLY=계정 npm run e2e`는 실제 SDK를 쓰는 브라우저에서 충돌 → 복원 → 로그아웃을 확인한다. 이 E2E의 외부 요청은 모두 모의 응답으로 처리한다.

실제 Supabase에서는 `supabase/tests/backup-hardening.sql`을 SQL Editor에서 통째로 실행한다. `BEGIN`에서 테스트 사용자와 진행을 만들고 역할·세션·중복·간격·점검·권한을 검사한 뒤 **ROLLBACK**한다. 마지막 `passed=true`는 모든 단언이 통과하고 테스트 사용자가 남지 않았음을 뜻한다. 실제 Google OAuth와 폰 두 대의 동작 검사는 별도다.

`npx vitest run tests/server-db.test.ts`: PGlite (WASM Postgres)로 마이그레이션을 그대로 돌리고, Supabase의 역할 · `auth` 스키마는 `tests/fixtures/supabase-stub.sql`이 흉내 낸다. 권한 (게스트 · 남의 저장 · 직접 쓰기), 덮어쓰기 막는 절차 (`upload_id` 재시도 · `base_rev` 거절 · 사본 수), 탐지 기록, 진행 고르기, 로그인 기록 60일, 계정 삭제를 본다. 마이그레이션을 고치면 이 테스트도 맞춘다. 실제 Supabase에 처음 적용한 뒤에는 `delete_account`가 `auth.users`를 지우는지 한 번 확인한다 (테스트는 흉내 낸 `auth`).
