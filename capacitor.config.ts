import type { CapacitorConfig } from '@capacitor/cli';

// 앱 ID·이름은 임시 (게임 이름은 나중에 정함, Lim 2026-10-07). 구글 플레이에 올리기 전에 확정: 올린 뒤엔 앱 ID를 못 바꾼다
const config: CapacitorConfig = {
  appId: 'com.lallafm.healer',
  appName: '힐러 개발판',
  webDir: 'dist',
  android: {
    backgroundColor: '#12131F',
  },
  plugins: {
    // 전체화면 (09 5장): 시스템 바 숨김 + 웹뷰를 화면 끝까지 (index.html viewport-fit=cover)
    SystemBars: { hidden: true, insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
