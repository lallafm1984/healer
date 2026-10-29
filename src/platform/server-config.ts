/**
 * 서버 (Supabase, 기획 120) 주소 · 공개 키. 빌드 환경 값 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY (공개 키는 앱에 들어가는 값이라 공개돼도 됨,
 * service_role 키는 앱 · 저장소에 넣지 않음). 비어 있으면 서버 없이 지금처럼 (기기 시계 · 공지 없음).
 * 화면 테스트 (Playwright = navigator.webdriver)는 실제 서버를 부르지 않음 (서버 쪽 검사는 window.__serverTest = true)
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function serverOn(): boolean {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    return typeof window !== 'undefined' && !!(window as unknown as { __serverTest?: boolean }).__serverTest;
  }
  return true;
}
