import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
  // 시뮬 한 판을 여러 번 도는 검사는 CI 러너에서 6~9초 (기본 5초 넘어 시간 초과로 빨갰음, 2026-10-20 QA)
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
