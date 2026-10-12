import { defineConfig } from 'vitest/config';
// 개발용 이펙트 화면 (fx.html, `npm run fx`)의 저장 · 굽기 창구: 개발 서버에만 붙고 빌드에는 없음
import { fxLabPlugin } from './scripts/fxr/dev-server.mjs';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
  plugins: [fxLabPlugin()],
  test: { include: ['tests/**/*.test.ts'] },
});
