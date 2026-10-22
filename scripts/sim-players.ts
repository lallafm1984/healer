/**
 * 가상 사용자 QA (src/sim/players.ts, 2026-10-22 Lim 「처음 사용자 및 신규 사용자 입장에서의 시뮬레이션 qa 테스터」).
 * 실행: npm run sim:players -- [--types normal,casual] [--seeds 3] [--seed-from 1] [--part 1/8] [--max-lv 100] [--max-days 400] [--out .sim/players]
 * 타입 × 시드마다 새 저장 → 튜토리얼 → Lv 100을 돌려 사람마다 JSON 한 파일 (out/<타입>-<시드>.json)을 쓰고 한 줄 요약을 찍는다.
 * --part i/k = 사람 목록을 k몫으로 나눈 i번째만 (여러 프로세스로 나눠 돌릴 때). 보고서는 scripts/players-report.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { livePlayer, PLAYER_TYPES, playerType } from '../src/sim/players';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const types = (opt('--types')?.split(',') ?? PLAYER_TYPES.map(t => t.key)).map(k => { const t = playerType(k); if (!t) throw new Error(`없는 타입 ${k}`); return t; });
const seeds = Number(opt('--seeds') || 3), seed0 = Number(opt('--seed-from') || 1), maxLv = Number(opt('--max-lv') || 100), maxDays = Number(opt('--max-days') || 400);
const [pi, pk] = (opt('--part') ?? '1/1').split('/').map(Number);
const out = opt('--out') || '.sim/players';
mkdirSync(out, { recursive: true });
const who = types.flatMap(t => Array.from({ length: seeds }, (_, i) => ({ t, seed: seed0 + i }))).filter((_, i) => i % pk === pi - 1);
for (const { t, seed } of who) {
  const t0 = Date.now();
  let shown = 0;
  const log = livePlayer(t, seed, { maxLv, maxDays, onDay: d => { if (d.lv >= shown + 10) { shown = d.lv - (d.lv % 10); console.log(`  ${t.name} #${seed}: ${d.day}일 Lv ${d.lv} (${((Date.now() - t0) / 1000).toFixed(0)}초)`); } } });
  writeFileSync(`${out}/${t.key}-${seed}.json`, JSON.stringify(log));
  const at = (lv: number) => log.levelDay[lv] ?? '-', loss = log.runs.filter(r => !r.win).length;
  console.log(`${t.name} #${seed}: Lv ${log.days.at(-1)?.lv ?? 1} · ${log.days.length}일 · 판 ${log.totalRuns} (진 판 ${loss}, ${((100 * loss) / Math.max(1, log.totalRuns)).toFixed(1)}%) · Lv 10/20/50/100 = ${at(10)}/${at(20)}/${at(50)}/${at(100)}일 · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}
