// 화면 테스트: dist를 vite preview로 띄우고 tests/e2e/*.mjs를 차례로 돌린다. 먼저 `npm run build`
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import appShell from '../tests/e2e/app-shell.mjs';
import character from '../tests/e2e/character.mjs';
import devauto from '../tests/e2e/devauto.mjs';
import dungeon from '../tests/e2e/dungeon.mjs';
import gear from '../tests/e2e/gear.mjs';
import guild from '../tests/e2e/guild.mjs';
import shop from '../tests/e2e/shop.mjs';
import challenge from '../tests/e2e/challenge.mjs';
import heroes from '../tests/e2e/heroes.mjs';
import legacyUi from '../tests/e2e/legacy-ui.mjs';
import talents from '../tests/e2e/talents.mjs';
import tutorial from '../tests/e2e/tutorial.mjs';
import portrait from '../tests/e2e/portrait.mjs';
import devices from '../tests/e2e/devices.mjs';

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
  for (const [name, run] of [['세로 UI·이미지', portrait], ['대상 폰 크기 (S25·울트라·플립)', devices], ['앱 틀', appShell], ['임시 전투 화면', legacyUi], ['던전 흐름', dungeon], ['첫 5분 튜토리얼', tutorial], ['캐릭터 탭', character], ['장비 강화·분해', gear], ['힐러 직업', heroes], ['사제 특성', talents], ['길드·영입', guild], ['재화·임무·상점', shop], ['성장·주간 도전·이어하기', challenge], ['자동 치유 (개발)', devauto]]) {
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
