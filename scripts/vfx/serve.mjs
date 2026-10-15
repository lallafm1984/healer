// 검수 도구용 게임 미리보기 서버: --url이 없으면 dist를 vite preview로 띄움 (먼저 npx vite build)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

/** { url, stop() }: url을 주면 그대로, 아니면 dist 미리보기 서버를 빈 포트에 띄움 */
export async function gameUrl(url) {
  if (url) return { url, stop: () => {} };
  if (!existsSync(join(ROOT, 'dist/index.html'))) throw new Error('dist가 없음: 먼저 npx vite build');
  const port = await freePort(), vite = join(ROOT, 'node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  const u = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(u)).ok) return { url: u, stop: () => child.kill() }; } catch { /* 준비 중 */ } await new Promise(r => setTimeout(r, 200)); }
  child.kill(); throw new Error('미리보기 서버가 뜨지 않음');
}
