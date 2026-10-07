import { Capacitor, SystemBars } from '@capacitor/core';

/** 상단 배너 영역 높이 (노치 포함, 09 5장). 웹뷰에서 1 CSS px = 1 dp */
export const BANNER_DP = 70;

/**
 * 전체화면: 상태 표시줄·내비게이션 바를 숨기고 노치까지 그린다.
 * 앱 시작 때는 capacitor.config.ts(SystemBars.hidden)와 MainActivity가 처리하고, 여기서는 한 번 더 확인만 한다. 웹에서는 아무것도 안 함
 */
export async function enterFullscreen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SystemBars.hide();
  } catch {
    // 지원하지 않는 기기: 화면은 그대로 동작
  }
}
