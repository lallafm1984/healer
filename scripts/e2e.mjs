// 화면 테스트: dist를 vite preview로 띄우고 tests/e2e/*.mjs를 차례로 돌린다 (목록 tests/e2e/suites.mjs). 먼저 `npm run build`
// E2E_SHARD=2/6: 걸린 시간으로 고르게 6몫으로 나눠 2번째 몫만 (CI는 러너 6대에서 동시에)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { plan } from '../tests/e2e/suites.mjs';

/** E2E_ONLY=장소,던전 처럼 이름 일부로 몇 묶음만 */
const only = process.env.E2E_ONLY?.split(',').filter(Boolean);
const todo = plan(process.env.E2E_SHARD).filter(p => !only || only.some(o => p.name.includes(o)));
if (process.env.E2E_SHARD) console.log(`몫 ${process.env.E2E_SHARD}: ${todo.map(p => p.name).join(' · ')} (CI 기준 약 ${Math.round(todo.reduce((t, p) => t + p.sec, 0))}초)`);

const PORT = 4179;
const url = `http://localhost:${PORT}/`;
const shots = 'tests/e2e/shots';
mkdirSync(shots, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
let up = false;
for (let i = 0; i < 50 && !up; i++) {
  try { up = (await fetch(url)).ok; } catch { await sleep(200); }
}
if (!up) { server.kill(); console.error('preview 서버가 안 떴어요'); process.exit(1); }

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
