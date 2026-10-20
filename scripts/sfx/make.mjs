/**
 * 효과음 만들기 (기획 107): scripts/sfx/sounds.mjs 문장 → agent-audio (Stable Audio 3 Medium, 내 컴퓨터) WAV → 다듬어 src/sfx/<이름>.ogg
 *
 *   node scripts/sfx/make.mjs                 모두 (이미 생성한 WAV는 건너뜀)
 *   node scripts/sfx/make.mjs ui-tap heal-*   이름 · 별표 묶음만
 *   node scripts/sfx/make.mjs --again ui-tap  그 WAV를 지우고 다시 생성
 *   node scripts/sfx/make.mjs --process       생성 없이 다듬기만
 *   node scripts/sfx/make.mjs --takes 3 ui-*  소리마다 생성본 3개 (<이름>.wav, <이름>~2.wav, <이름>~3.wav), 다듬을 때 하나를 고름 (process.py)
 *   node scripts/sfx/make.mjs --first16       108 4장의 시안 16종만
 *
 * agent-audio 체크아웃 = 환경 변수 AGENT_AUDIO_DIR (없으면 ~/agent-audio). 생성 WAV는 .sfx-raw/ (git 밖).
 * 다듬기는 uv로 numpy · soundfile을 잠깐 받아 scripts/sfx/process.py를 돌림.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIRST16, SOUNDS } from './sounds.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const raw = join(root, '.sfx-raw'), out = join(root, 'src/sfx');
const agent = process.env.AGENT_AUDIO_DIR || join(homedir(), 'agent-audio');
const args = process.argv.slice(2);
const again = args.includes('--again'), only = args.includes('--process');
const takesAt = args.indexOf('--takes');
const takes = takesAt >= 0 ? Math.max(1, Number(args[takesAt + 1]) || 1) : 1;
const pats = args.filter((a, i) => !a.startsWith('--') && i !== takesAt + 1).map(p => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`));
const pick = args.includes('--first16') ? SOUNDS.filter(s => FIRST16.includes(s.name)) : pats.length ? SOUNDS.filter(s => pats.some(r => r.test(s.name))) : SOUNDS;
if (!pick.length) { console.error('고른 소리 없음'); process.exit(1); }
mkdirSync(raw, { recursive: true });

if (!only) {
  if (!existsSync(join(agent, 'pyproject.toml'))) { console.error(`agent-audio 체크아웃이 없음: ${agent} (AGENT_AUDIO_DIR)`); process.exit(1); }
  let n = 0;
  const jobs = pick.flatMap(s => Array.from({ length: takes }, (_, i) => ({ s, wav: join(raw, i ? `${s.name}~${i + 1}.wav` : `${s.name}.wav`) })));
  if (again) for (const s of pick) for (const f of readdirSync(raw)) if (f === `${s.name}.wav` || f.startsWith(`${s.name}~`)) rmSync(join(raw, f));
  for (const { s, wav } of jobs) {
    n++;
    if (existsSync(wav)) continue;
    const t = Date.now();
    process.stdout.write(`[${n}/${jobs.length}] ${basename(wav, '.wav')} (${s.gen}초) … `);
    const r = spawnSync('uv', ['run', '--frozen', 'agent-audio', 'generate', s.prompt, '--seconds', String(s.gen), '--out', wav], { cwd: agent, encoding: 'utf8' });
    if (r.status !== 0) { console.log('실패'); console.error((r.stderr || r.stdout || '').slice(-2000)); process.exit(1); }
    console.log(`${((Date.now() - t) / 1000).toFixed(0)}초`);
  }
}

const params = join(raw, 'params.json');
writeFileSync(params, JSON.stringify(pick.map(s => ({ name: s.name, keep: s.keep, loop: !!s.loop }))));
const p = spawnSync('uv', ['run', '--no-project', '--with', 'numpy', '--with', 'soundfile', 'python', join(root, 'scripts/sfx/process.py'), raw, out, params], { cwd: root, stdio: 'inherit' });
process.exit(p.status ?? 1);
