-- 전면 광고 설정. 기존 flags의 다른 값과 이미 운영자가 정한 광고 값은 보존한다.
update public.app_config
set flags = jsonb_build_object(
  'interstitial_interval_minutes', 10,
  'interstitial_min_level', 10
) || flags
where platform = 'android';

comment on column public.app_config.flags is
  '원격 설정. backup: boolean, interstitial_interval_minutes: 0 초과 1440 이하 분(기본 10), interstitial_min_level: 1~100 정수(기본 10). app_boot 응답으로 앱 시작·복귀·설정 공지 갱신 때 적용';
