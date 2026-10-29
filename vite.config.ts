import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // 앱을 만든 시각 (기획 120 9-3): 서버 시각을 한 번도 못 받은 기기의 게임 시각 출발점 (기기 시계를 쓰지 않음)
  define: { __BUILD_TIME__: JSON.stringify(Date.now()) },
  // 소리 파일은 작아도 (4KB 밑, Opus로 줄인 뒤 보스 기술음 6개) 늘 파일로: JS 안 base64로 들어가면 첫 화면 JS가 커지고, 화면 검사가 빌드에서 소리를 못 찾았음 (2026-10-29 QA)
  build: { outDir: 'dist', target: 'es2022', assetsInlineLimit: (file: string) => (/\.(ogg|mp3|m4a|wav)$/.test(file) ? false : undefined) },
  // 시뮬 한 판을 여러 번 도는 검사는 CI 러너에서 6~9초 (기본 5초 넘어 시간 초과로 빨갰음, 2026-10-20 QA)
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
