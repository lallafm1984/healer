/**
 * 익숙한 사람 검사 (src/sim/familiar.ts, 2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」).
 * 실행: npm run sim:familiar -- [--n 20] [--diff 쉬움,보통,어려움,악몽] [--part 1/8] [--json 파일]
 * 순차 구간 밖 장소마다 그 레벨 사람 (Lv 20 익숙 → 60 능숙, 길잡이 길 장비)과 숙련 자동 힐러 (기준 조건, 기준 직업 셋 평균, 같은 시드)를 나란히, 하한 목표 (FAMILIAR_TARGET)와 견줌. --part i/k = 칸을 k몫으로 나눈 i번째만 (여러 프로세스로 나눠 돌릴 때),
 * --json = 칸마다 한 줄 JSON을 파일에 (몫을 모아 구간 표를 만들 때)
 */
import { appendFileSync } from 'node:fs';
import { stageOf } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { bandOf, expertAim, familiarCells, familiarTarget, kindOf, measureFamiliar } from '../src/sim/familiar';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const N = Number(opt('--n') || 20);
const diffs = (opt('--diff')?.split(',') as DiffName[] | undefined) ?? ['쉬움', '보통', '어려움', '악몽'];
const [pi, pk] = (opt('--part') ?? '1/1').split('/').map(Number);
const json = opt('--json');
const cells = familiarCells(diffs).filter((_, i) => i % pk === pi - 1);

console.log(`익숙한 사람 검사 · 기준 직업 셋 × ${N}판 · ${cells.length}칸${pk > 1 ? ` (몫 ${pi}/${pk})` : ''}`);
console.log('| 장소 | 종류 | 난이도 | 적 Lv | 숙련 | 익숙 | 하한 목표 | 숙련 목표 | 익숙이 진 이유 |');
console.log('|---|---|---|---|---|---|---|---|---|');
const low: string[] = [];
for (const x of cells) {
  const e = measureFamiliar(x, N, 'expert'), m = measureFamiliar(x, N, 'familiar'), lv = stageOf(x.c, x.d);
  const why = Object.entries(m.fails).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(' · ');
  const t = familiarTarget(x);
  if (m.rate < t) low.push(`${x.c.name} ${x.d} ${Math.round(m.rate)}% (목표 ${t}%)`);
  console.log(`| ${x.c.name} | ${kindOf(x.c)} | ${x.d} | ${lv} | ${Math.round(e.rate)}% | ${Math.round(m.rate)}%${m.rate < t ? ' ↓' : ''} | ${t} | ${expertAim(x)} | ${why} |`);
  if (json) appendFileSync(json, JSON.stringify({ key: x.c.key, name: x.c.name, kind: kindOf(x.c), d: x.d, lv, band: bandOf(lv), aim: expertAim(x), target: t, expert: e.rate, familiar: m.rate, eh: e.byHero, fh: m.byHero, fails: m.fails }) + '\n');
}
console.log(low.length ? `\n하한 목표 아래 ${low.length}칸:\n- ${low.join('\n- ')}` : '\n모든 칸이 하한 목표 안');
