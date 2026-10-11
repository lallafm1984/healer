// 화면 테스트: dist를 vite preview로 띄우고 tests/e2e/*.mjs를 차례로 돌린다. 먼저 `npm run build`
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import appShell from '../tests/e2e/app-shell.mjs';
import character from '../tests/e2e/character.mjs';
import devauto from '../tests/e2e/devauto.mjs';
import dungeon from '../tests/e2e/dungeon.mjs';
import gear from '../tests/e2e/gear.mjs';
import guildOff from '../tests/e2e/guild-off.mjs';
import shop from '../tests/e2e/shop.mjs';
import challenge from '../tests/e2e/challenge.mjs';
import heroes from '../tests/e2e/heroes.mjs';
import legacyUi from '../tests/e2e/legacy-ui.mjs';
import talents from '../tests/e2e/talents.mjs';
import tutorial from '../tests/e2e/tutorial.mjs';
import portrait from '../tests/e2e/portrait.mjs';
import lobbyLiving from '../tests/e2e/lobby-living.mjs';
import lobbyA2 from '../tests/e2e/lobby-a2.mjs';
import devices from '../tests/e2e/devices.mjs';
import compactUi from '../tests/e2e/compact-ui.mjs';
import compactInput from '../tests/e2e/compact-input.mjs';
import boardEdges from '../tests/e2e/board-edges.mjs';
import dialogs from '../tests/e2e/dialogs.mjs';
import manaRing from '../tests/e2e/mana-ring.mjs';
import places from '../tests/e2e/places.mjs';
import wordReady from '../tests/e2e/word-ready.mjs';

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
/** E2E_ONLY=장소,던전 처럼 이름 일부로 몇 묶음만 */
const only = process.env.E2E_ONLY?.split(',').filter(Boolean);
try {
  for (const [name, run] of [['세로 UI·이미지', portrait], ['로비 생동감·입력·수명', lobbyLiving], ['A2 로비 UI·기능·안전영역', lobbyA2], ['대상 폰 크기 (S25·울트라·플립)', devices], ['마나량 외곽 링·소비·회복', manaRing], ['축소 전투·취소 복구', compactUi], ['탭·스와이프 입력 소유권', compactInput], ['전투판 가장자리·균등 확대·resize 복구', boardEdges], ['상세 시트·포커스 복구', dialogs], ['앱 틀', appShell], ['임시 전투 화면', legacyUi], ['던전 흐름', dungeon], ['첫 5분 튜토리얼', tutorial], ['캐릭터 탭', character], ['장비 강화·분해', gear], ['힐러 직업', heroes], ['사제 특성', talents], ['성언 준비 반짝임', wordReady], ['길드 빼 둠', guildOff], ['재화·임무·상점', shop], ['성장·주간 도전·이어하기', challenge], ['자동 치유 (개발)', devauto], ['장소마다 입장 → 결과', places]]) {
    if (only && !only.some(o => name.includes(o))) continue;
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
