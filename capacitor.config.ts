import type { CapacitorConfig } from '@capacitor/cli';

// 앱 ID: 영문 제목 Solo Healer (2026-10-29 Lim, 예전 com.lallafm.healer). 구글 플레이에 올린 뒤엔 못 바꾼다. 아이폰 번들 ID도 같게. 앱 이름은 아직 임시
const config: CapacitorConfig = {
  appId: 'com.solohealer.game',
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
