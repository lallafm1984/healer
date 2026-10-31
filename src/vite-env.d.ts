/// <reference types="vite/client" />
declare module '*.js';
/** 앱을 만든 시각 (ms, vite.config define) */
declare const __BUILD_TIME__: number;
interface ImportMetaEnv {
  /** 개발 APK는 Google 시험 광고, 출시 빌드는 비워서 실제 광고 ID 사용 */
  readonly VITE_ADMOB_TESTING?: string;
  /** Supabase 주소 · 공개 (anon) 키 (기획 120). 비우면 서버 없이 지금처럼 (기기 시계) */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** 구글 로그인 웹 클라이언트 ID (공개 값) */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
}
