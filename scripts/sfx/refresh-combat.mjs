/**
 * Generate → screen → retry rejected sounds → publish only a complete passing pack.
 * Supply installed Agent Audio, analysis Python and the local CLAP checkpoint.
 * Raw candidates and reports are resumable in --work. Nothing calls a paid service.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { COMBAT_SOUNDS } from './combat.mjs';

const args = process.argv.slice(2);
const arg = key => args[args.indexOf(key) + 1];
for (const key of ['--agent-python', '--home', '--review-python', '--model', '--work']) {
  if (!args.includes(key) || !arg(key) || arg(key).startsWith('--')) throw new Error(`Missing ${key}`);
}
const work = resolve(arg('--work'));
mkdirSync(work, { recursive: true });
const manifest = join(work, 'manifest.json');
writeFileSync(manifest, JSON.stringify(COMBAT_SOUNDS, null, 2));
const run = (python, argv, label) => {
  console.log(label);
  const result = spawnSync(python, argv, { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed (${result.status}): ${result.error?.message ?? ''}`);
};
const rounds = args.includes('--rounds') ? Number(arg('--rounds')) : 3;
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 30) throw new Error('--rounds must be 1..30');
const start = args.includes('--start-round') ? Number(arg('--start-round')) : 1;
if (!Number.isInteger(start) || start < 1 || start > rounds) throw new Error('--start-round must be 1..rounds');
let retry = start > 1 ? JSON.parse(readFileSync(join(work, 'screening.json'), 'utf8')).retry : undefined;
if (retry?.length === 0) throw new Error('There are no rejected sounds to resume');
for (let round = start; round <= rounds; round++) {
  run(arg('--agent-python'), ['scripts/sfx/generate-combat.py', '--home', resolve(arg('--home')), '--manifest', manifest,
    '--round', String(round), ...(retry ? ['--names', ...retry] : [])], `Generation round ${round}`);
  run(arg('--review-python'), ['scripts/sfx/review-combat.py', manifest, '--model', resolve(arg('--model'))], `Screen round ${round}`);
  const report = JSON.parse(readFileSync(join(work, 'screening.json'), 'utf8'));
  retry = report.retry;
  if (!retry.length) {
    const runtimePython = join(resolve(arg('--home')), 'runtime/stable-audio-3/optimized/tflite/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    run(runtimePython, ['scripts/sfx/publish-combat.py', manifest], 'Publish complete passing pack');
    process.exit(0);
  }
  console.log(`REJECTED: ${retry.join(', ')}`);
}
throw new Error(`Screening still rejects ${retry.length} sounds; existing game files were preserved. See ${work}/screening.json`);
