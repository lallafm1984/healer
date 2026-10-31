import { registerPlugin } from '@capacitor/core';

export interface AdRuntimeInfo {
  debuggable: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
}

/** 빌드 환경 변수만으로 개발 APK가 실제 광고를 요청하지 않도록 네이티브 빌드도 확인한다. */
export const AdRuntime = registerPlugin<{ getInfo(): Promise<AdRuntimeInfo> }>('AdRuntime');
