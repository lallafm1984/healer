# 나혼자 힐러 서버 (Supabase)

기획: 맥 `나혼자힐러/120_서버DB_도입_로그인_데이터범위_조작방지.md` 9장 「확정 설계」 (2026-10-29 Lim 결정). 게임은 오프라인 싱글 그대로이고, 서버는 아래만 한다.

| 하는 일 | 함수 | 누가 부르나 |
|---|---|---|
| 서버 시각 · 강제 업데이트 · 점검 · 공지 (+ 버전별 켠 수) | `app_boot(platform, version, count, lang)` | 모두 (게스트도, 공개 키), 이전 2/3인자 호출 유지 |
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

전면 광고 조건은 `app_config`의 `android` 행 → `flags`에서 변경한다. `interstitial_interval_minutes`는 마지막 보상형/전면 광고 뒤 앱이 화면에 떠 있던 분(기본 **10**, **1~1440**), `interstitial_min_level`은 시작 레벨(기본 **10**, 1~100 정수)이다. 1분 미만·문자열·무한대 등 잘못된 값은 각 기본값을 쓴다. 앱 시작·복귀의 서버 갱신(10분 간격) 또는 설정 → 공지에서 새 값을 받으면 다음 광고 판정부터 적용한다. 튜토리얼·실패·포기·광고 제거 패키지는 값과 관계없이 제외한다. 보상형을 조기 종료했어도 실제로 표시된 광고라면 간격을 새로 센다(보상은 지급하지 않음).

```sql
-- 예: Lv 20부터 15분 간격. 다른 원격 설정은 보존한다.
update public.app_config
set flags = flags || '{"interstitial_interval_minutes":15,"interstitial_min_level":20}'::jsonb
where platform = 'android';
```

AdMob Android 앱 ID와 세 광고 단위는 앱에 등록되어 있다. `@capacitor-community/admob` 8.2.1을 사용하며, GitHub Actions 개발 APK는 `VITE_ADMOB_TESTING=true`로 Google 시험 광고를 요청한다. 개발판은 Google 데모 광고만 요청하므로 운영 앱의 UMP 메시지 등록과 관계없이 초기화한다. 출시 빌드는 이 값을 비우고 빌드하며, UMP 동의 확인 뒤에만 광고를 요청한다. 광고 개인정보 선택이 필요한 지역에서는 설정의 동의 관리 버튼을 사용한다. AdMob 콘솔의 개인정보 보호 및 메시지에서 해당 앱의 메시지도 게시되어 있어야 한다. 운영 UMP 미등록·통신 오류·요청 불가 시 출시 빌드가 시험 광고로 전환하지 않는다. 보상형은 시청 완료 신호가 있어야 보상하며, 로드 실패·조기 닫기에는 지급하지 않는다. 실제 기기 광고·콘솔 승인 상태는 별도 확인이 필요하다.

광고 제거 구매는 **배너·전면 광고**를 제외한다. 구매·복원 즉시 네이티브 배너와 상단 광고 자리를 제거하고 이후 배너 요청·재시도를 중단한다. 이미 구매한 계정은 앱 시작 때도 배너를 요청하지 않는다. 휴식 충전·완료 상자·지원자 새로 뽑기의 보상형은 시청해야 보상하며, 휴식 최대 +50 혜택은 유지한다. 미구매자의 배너는 앱 시작 때 한 번 생성하며 메뉴·화면 이동과 저장으로 새로 요청하지 않는다. 동의 변경 때는 이전 동의로 만든 배너를 새로 만들며, AdMob 콘솔의 자체 자동 새로고침은 SDK가 관리한다.

### 광고 요청 제한과 출시 확인

- 저장·메뉴 이동은 구매 상태만 동기화하며 광고를 요청하지 않는다. 배너 자동 갱신은 AdMob의 **Google 최적화** 설정을 유지한다(2026-10-31 콘솔 확인). SDK 자동 갱신과 앱의 첫 배너 요청을 중복해서 실행하지 않는다.
- 초기화·배너·각 전면 형식의 실패는 30 → 60 → 120 → 240 → 최대 300초 간격으로 재시도한다. 백그라운드에서는 로드·재시도하지 않고 같은 배너를 숨김/재개한다. 사용하는 플러그인은 배너 로드 실패 때 뷰를 제거하므로, 실패 사건을 받아 표시 상태를 비우고 위 간격으로만 다시 만든다.
- 전면은 조건을 충족한 클리어 결과에서 한 개만 미리 준비한다. 버튼을 누를 때 준비되지 않았으면 바로 이동하며, 늦게 로드된 광고를 다음 화면 위에 띄우지 않는다. 캐시 유효 시간은 55분이다. 보상형은 사용자 선택이 있을 때만 요청한다.
- 형식별 로드는 한 번에 한 개다. 8초 대기가 끝나도 실제 SDK 요청이 끝나기 전에는 중복 로드를 시작하지 않는다. 표시 직전에 화면·계정·보상 조건을 다시 확인하며, 광고 표시와 보상 완료 신호를 구분한다. 일일 횟수·보상은 지급이 성공한 경우에만 바꾼다.
- Android `debuggable` 빌드는 환경 변수와 관계없이 Google 데모 광고를 사용한다. 출시 빌드에는 `ad-config.json`의 `production` 표시가 필요하며, 시험 광고 웹 번들을 `assembleRelease`/`bundleRelease`로 내보내면 `verifyReleaseAdMode`에서 실패한다. `VITE_ADMOB_TESTING=false npm run android`로 다시 동기화한 뒤 출시 빌드한다.
- 운영 UMP 갱신이 실패해도 네이티브가 확인한 이전 유효 동의가 있을 때만 광고 요청을 허용한다. 동의 불가 상태는 반복 팝업을 띄우지 않고 유지한다. 개인정보 선택 변경 뒤에는 이전 동의로 준비한 광고를 폐기한다.
- 개발 기기에서 `window.__adDiagnostics()`로 앱 요청 수·로드·노출·보상 신호 수를 읽을 수 있다. 앱 자체 요청과 SDK 자동 갱신 횟수는 다르다. 별도 서버 전송은 하지 않는다.

참고: [배너 자동 갱신](https://developers.google.com/admob/android/banner#refresh_an_ad), [전면 사전 로드·만료](https://developers.google.com/admob/android/interstitial), [예기치 않은 전면 표시와 과도한 반복 금지](https://support.google.com/admob/answer/6201362). 코드와 시험 광고 검증은 실제 매출·게재 승인·정책 심사 결과를 보장하지 않는다. 운영에는 해당 앱의 동의 메시지 게시와 AdMob 앱 검토가 필요하다.

설정 언어는 `ko` · `en` · `ja`다. 기본 `notices.title/body`, `app_config.update_message/maintenance_message`는 기존 한국어와 이전 앱용으로 유지한다. 새 앱에는 `notice_translations`와 `app_config_translations`의 선택 언어를 우선 반환한다. `ko`가 없으면 기존 한국어, `en`/`ja`가 없으면 영어 → 기존 한국어 순이다. 안내 문구가 전부 비어 있으면 앱의 해당 언어 기본 문구를 사용한다. 공지 제목·본문은 한 번역 행으로 함께 선택하며, 비어 있는 본문은 의도한 빈 본문으로 유지한다. 자동 번역은 하지 않으므로 운영 문장은 언어별로 등록한다.

기존 앱은 언어 인자 없이 원래 한국어를 받는다. 새 앱은 설정 언어 변경과 공지 열기에서 `count=false`로 다시 받으며, 공지 캐시만 언어별로 분리한다. 읽음 번호는 공통이라 언어 변경만으로 같은 자동 팝업을 다시 띄우지 않는다. 번역 표는 RLS 및 권한 회수로 클라이언트가 직접 읽거나 쓸 수 없고 RPC만 사용한다.

```sql
-- 같은 공지 번호에 번역을 등록한다. 한국어 원문과 대상·기간은 notices 한 곳에서 관리한다.
insert into public.notice_translations(notice_id, lang, title, body) values
  (123, 'en', 'Maintenance Notice', 'Cloud saves will be unavailable during maintenance.'),
  (123, 'ja', 'メンテナンスのお知らせ', 'メンテナンス中はクラウドセーブを利用できません。')
on conflict(notice_id, lang) do update set title=excluded.title, body=excluded.body;
insert into public.app_config_translations(platform, lang, update_message, maintenance_message) values
  ('android', 'en', 'Update to the latest version to continue.', 'Server maintenance is in progress.'),
  ('android', 'ja', '最新版にアップデートして続けてください。', 'サーバーメンテナンス中です。')
on conflict(platform, lang) do update set update_message=excluded.update_message, maintenance_message=excluded.maintenance_message;
select public.app_boot('android', 652, false, 'ja');
```

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

`npx vitest run tests/server-language.test.ts tests/server-client-language.test.ts`: 실제 Postgres의 언어 선택·정규화·대체·기간/버전 필터·통계 단일 집계·권한과 클라이언트 언어 캐시·느린 응답을 검사한다. `E2E_ONLY='서버 공지' npm run e2e`는 실제 설정 칩 전환, 타이틀 공지, 강제·일반 업데이트·점검의 세 언어 표시를 검사한다. 외부 HTTP와 Android 브리지는 모형이다.

운영에는 `20261031010000_server_languages.sql`을 적용한 뒤 `supabase/tests/server-language.sql`을 SQL Editor에서 실행한다. `ko/en/ja`와 이전 호출·영어 대체·권한을 확인한 뒤 테스트 공지·번역·설정을 모두 **ROLLBACK**한다. 새 4인자 API가 준비된 뒤 앱을 배포한다.

`npx vitest run tests/server-db.test.ts tests/account-flow.test.ts tests/account-platform.test.ts`: DB 권한과 세션 인계, 호출 제한, 중복 재시도, 비동기 복원 충돌, 저장 공간 부족, 미래 저장 버전, 복원 후 reload의 pause 이벤트, 실제 SDK 로그아웃 범위를 확인한다. 전체 단위 검사와 빌드 뒤 `E2E_ONLY=계정 npm run e2e`는 실제 SDK를 쓰는 브라우저에서 충돌 → 복원 → 로그아웃을 확인한다. 이 E2E의 외부 요청은 모두 모의 응답으로 처리한다.

실제 Supabase에서는 `supabase/tests/backup-hardening.sql`을 SQL Editor에서 통째로 실행한다. `BEGIN`에서 테스트 사용자와 진행을 만들고 역할·세션·중복·간격·점검·권한을 검사한 뒤 **ROLLBACK**한다. 마지막 `passed=true`는 모든 단언이 통과하고 테스트 사용자가 남지 않았음을 뜻한다. 실제 Google OAuth와 폰 두 대의 동작 검사는 별도다.

`npx vitest run tests/server-db.test.ts`: PGlite (WASM Postgres)로 마이그레이션을 그대로 돌리고, Supabase의 역할 · `auth` 스키마는 `tests/fixtures/supabase-stub.sql`이 흉내 낸다. 권한 (게스트 · 남의 저장 · 직접 쓰기), 덮어쓰기 막는 절차 (`upload_id` 재시도 · `base_rev` 거절 · 사본 수), 탐지 기록, 진행 고르기, 로그인 기록 60일, 계정 삭제를 본다. 마이그레이션을 고치면 이 테스트도 맞춘다. 실제 Supabase에 처음 적용한 뒤에는 `delete_account`가 `auth.users`를 지우는지 한 번 확인한다 (테스트는 흉내 낸 `auth`).
