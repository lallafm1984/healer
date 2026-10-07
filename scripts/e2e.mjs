// 화면 테스트: dist를 vite preview로 띄우고 tests/e2e/*.mjs를 차례로 돌린다. 먼저 `npm run build`
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import appShell from '../tests/e2e/app-shell.mjs';
import character from '../tests/e2e/character.mjs';
import devauto from '../tests/e2e/devauto.mjs';
import dungeon from '../tests/e2e/dungeon.mjs';
import legacyUi from '../tests/e2e/legacy-ui.mjs';
import tutorial from '../tests/e2e/tutorial.mjs';

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
  for (const [name, run] of [['앱 틀', appShell], ['임시 전투 화면', legacyUi], ['던전 흐름', dungeon], ['첫 5분 튜토리얼', tutorial], ['캐릭터 탭', character], ['자동 치유 (개발)', devauto]]) {
    console.log(`\n== ${name} ==`);
    const r = await run(url, shots);
    fails += r.fails; errors += r.errs.length;
    r.errs.slice(0, 5).forEach(e => console.log('ERROR ' + e));
  }
} finally {
  server.kill();
}
console.log(`\nFAILS ${fails} · ERRORS ${errors}`);
process.exit(fails || errors ? 1 : 0);
