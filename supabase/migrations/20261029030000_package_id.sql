-- 앱 ID를 com.solohealer.game으로 (2026-10-29 Lim, 영문 제목 Solo Healer, 예전 com.lallafm.healer): 강제 업데이트 창의 스토어 주소
update public.app_config
  set store_url = 'https://play.google.com/store/apps/details?id=com.solohealer.game', updated_at = now()
  where platform = 'android' and store_url = 'https://play.google.com/store/apps/details?id=com.lallafm.healer';
