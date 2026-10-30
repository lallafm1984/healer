// 화면 테스트: dist를 vite preview로 띄우고 tests/e2e/*.mjs를 차례로 돌린다 (목록 tests/e2e/suites.mjs). 먼저 `npm run build`
// E2E_SHARD=2/6: 걸린 시간으로 고르게 6몫으로 나눠 2번째 몫만 (CI는 러너 6대에서 동시에)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { plan } from '../tests/e2e/suites.mjs';

/** E2E_ONLY=장소,던전 처럼 이름 일부로 몇 묶음만 */
const only = process.env.E2E_ONLY?.split(',').filter(Boolean);
const todo = plan(process.env.E2E_SHARD).filter(p => !only || only.some(o => p.name.includes(o)));
if (only && !todo.length) { console.error(`E2E_ONLY=${process.env.E2E_ONLY}: 맞는 묶음이 없습니다 (묶음 이름 일부, tests/e2e/suites.mjs). 아무것도 돌리지 않고 통과로 보이지 않게 멈춥니다.`); process.exit(1); }
if (process.env.E2E_SHARD) console.log(`몫 ${process.env.E2E_SHARD}: ${todo.map(p => p.name).join(' · ')} (CI 기준 약 ${Math.round(todo.reduce((t, p) => t + p.sec, 0))}초)`);

const PORT = Number(process.env.E2E_PORT ?? 4179);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('E2E_PORT는 1~65535 사이 포트 번호여야 합니다.');
const host = '127.0.0.1';
const url = `http://${host}:${PORT}/`;
const shots = 'tests/e2e/shots';
mkdirSync(shots, { recursive: true });

// 다른 체크아웃의 기존 서버를 테스트하지 않도록 시작 전 포트를 확인한다.
const probe = createServer();
try {
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(PORT, host, () => probe.close(resolve));
  });
} catch (error) {
  console.error(`E2E preview 포트 ${PORT}를 사용할 수 없습니다 (${error.code ?? error.message}). E2E_PORT로 빈 포트를 지정하세요.`);
  process.exit(1);
}
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--host', host, '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
let serverError;
server.once('error', error => { serverError = error; });
let up = false;
for (let i = 0; i < 50 && !up; i++) {
  if (serverError || server.exitCode !== null || server.signalCode !== null) break;
  try { up = (await fetch(url)).ok; } catch { /* preview 준비 중 */ }
  if (!up) await sleep(200);
}
if (!up || serverError || server.exitCode !== null || server.signalCode !== null) {
  server.kill(); console.error(`preview 서버가 안 떴어요${serverError ? `: ${serverError.message}` : ''}`); process.exit(1);
}

let fails = 0, errors = 0;
try {
  for (const { name, run, part } of todo) {
    console.log(`\n== ${name} ==`);
    const r = await run(url, shots, part);
    fails += r.fails; errors += r.errs.length;
    r.errs.slice(0, 5).forEach(e => console.log('ERROR ' + e));
  }
} finally {
  server.kill();
}
console.log(`\nFAILS ${fails} · ERRORS ${errors}`);
process.exit(fails || errors ? 1 : 0);
