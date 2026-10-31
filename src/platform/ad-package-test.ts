/** 광고 시험 빌드와 자동 화면 검사에서만 패키지 구매 상태를 덮어쓴다. 출시판은 실제 구매 기록을 따른다. */
export const adPackageTestAvailable = (): boolean => import.meta.env.DEV || import.meta.env.VITE_ADMOB_TESTING === 'true'
  || typeof navigator !== 'undefined' && navigator.webdriver === true;
