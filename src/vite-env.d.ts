/// <reference types="vite/client" />
declare module '*.js';
/** 앱을 만든 시각 (ms, vite.config define) */
declare const __BUILD_TIME__: number;
interface ImportMetaEnv {
  /** Supabase 주소 · 공개 (anon) 키 (기획 120). 비우면 서버 없이 지금처럼 (기기 시계) */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
