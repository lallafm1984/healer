/**
 * 새 직업 간격 검사 (79 1-5): 기준 직업 (BASE_HEROES = 사제 · 드루이드 · 성기사) 평균과 새 직업 클리어율을 난이도 × 콘텐츠 (탐험 · 던전 · 10인 · 20인)마다 비교.
 * 장소 보정 (tune.ts)은 그대로 두고 그 직업 수치만 고친다. 시뮬은 그 직업이 열리는 레벨 이상의 장소만 (장소 기준 레벨 ≥ 열림 레벨).
 * 실행: npm run gap -- --hero shaman [--n 20] [--diff 어려움,악몽] [--specs class] [--shard 0/10] [--out .sim/gap-0.json] [--base .sim/base.json]
 *   --specs class = 장비 대표 특수능력 줄을 그 직업 전용 특수능력으로 (전용장비 밸런스: 직업마다 class − common 이득 폭을 비교)
 *   --base = 기준 직업 결과를 이 파일에 모아 두고 다시 씀 (직업 수치만 바꿔 다시 잴 때 기준 직업은 안 돌림)
 *   --base-only = 기준 직업만 돌려 --base 파일을 채움 (나눠 돌리면 조각마다 다른 --base 파일)
 *   --merge a.json b.json … = 나눠 돌린 결과를 합쳐 표만 출력
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ALL_DIFFS, CONTENT, stageOf, type ContentDef } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { HEROES, type HeroKey } from '../src/data/heroes';
import { balanceable, BASE_HEROES, GAP_LIMIT, runOnce, type SpecMode } from '../src/sim/balance';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const hero = (opt('--hero') || 'shaman') as HeroKey;
const N = Number(opt('--n') || 20);
const diffs = (opt('--diff')?.split(',') as DiffName[] | undefined) ?? ALL_DIFFS;
const specs = (opt('--specs') || 'common') as SpecMode;
const [si, sn] = (opt('--shard') || '0/1').split('/').map(Number);
const out = opt('--out'), basePath = opt('--base');
const only = opt('--places')?.split(',');
/** 기준 직업만 돌려 --base 파일을 채움 (새 직업은 안 돌림) */
const baseOnly = args.includes('--base-only');

/** 한 칸 결과: 장소 · 난이도 · 콘텐츠 · 직업마다 이긴 판 수 (n판 중) */
interface Cell { key: string; diff: DiffName; kind: string; n: number; wins: Partial<Record<HeroKey, number>> }
const kindOf = (c: ContentDef) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind === 'dungeon' ? '던전' : '탐험');
const KINDS = ['탐험', '던전', '10인', '20인'];

function table(cells: Cell[]): string {
  const lines: string[] = [];
  const avg = (cs: Cell[], h: HeroKey) => cs.length ? (100 * cs.reduce((a, c) => a + (c.wins[h] ?? 0), 0)) / cs.reduce((a, c) => a + c.n, 0) : NaN;
  lines.push(`${HEROES[hero].name} (${hero}) 간격 · ${specs === 'class' ? '전용 특수능력 장비' : '대표 특수능력 장비'} · 기준 = ${BASE_HEROES.map(h => HEROES[h].name).join(' · ')} 평균 · 한계 ±${GAP_LIMIT}%p`);
  lines.push('| 난이도 | 콘텐츠 | 칸 | 기준 평균 | 사제 · 드루 · 성기 | 새 직업 | 간격 |', '|---|---|---|---|---|---|---|');
  let bad = 0;
  for (const d of ALL_DIFFS) for (const k of KINDS) {
    const cs = cells.filter(c => c.diff === d && c.kind === k);
    if (!cs.length) continue;
    const base = BASE_HEROES.map(h => avg(cs, h)), b = base.reduce((a, x) => a + x, 0) / base.length, me = avg(cs, hero), gap = me - b;
    const off = Math.abs(gap) > GAP_LIMIT;
    if (off) bad++;
    lines.push(`| ${d} | ${k} | ${cs.length} | ${b.toFixed(1)} | ${base.map(x => x.toFixed(0)).join(' · ')} | ${me.toFixed(1)} | ${gap >= 0 ? '+' : ''}${gap.toFixed(1)}${off ? ' ✗' : ''} |`);
  }
  // 간격이 큰 장소 (새 직업 − 기준 평균, 칸마다)
  const worst = cells.map(c => ({ c, g: (100 * (c.wins[hero] ?? 0)) / c.n - BASE_HEROES.reduce((a, h) => a + (100 * (c.wins[h] ?? 0)) / c.n, 0) / BASE_HEROES.length }))
    .sort((a, b) => Math.abs(b.g) - Math.abs(a.g)).slice(0, 12);
  lines.push('', `한계 밖 ${bad}칸 (난이도 × 콘텐츠). 간격이 큰 장소: ${worst.map(w => `${w.c.key} ${w.c.diff} ${w.g >= 0 ? '+' : ''}${w.g.toFixed(0)}`).join(' · ')}`);
  return lines.join('\n');
}

if (args.includes('--merge')) {
  const files = args.slice(args.indexOf('--merge') + 1).filter(a => !a.startsWith('--'));
  const cells: Cell[] = files.flatMap(f => JSON.parse(readFileSync(f, 'utf8')) as Cell[]);
  console.log(table(cells));
  process.exit(0);
}

const lv = HEROES[hero].unlock.lv;
const places = CONTENT.filter(c => balanceable(c) && (!only || only.includes(c.key)));
const base: Record<string, Partial<Record<HeroKey, number>>> = basePath && existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : {};
const cells: Cell[] = [];
let idx = 0;
const t0 = Date.now();
for (const c of places) for (const d of diffs) {
  if (stageOf(c, d) < lv) continue;
  if (idx++ % sn !== si) continue;
  const id = `${c.key}|${d}|${specs}|${N}`;
  const wins: Partial<Record<HeroKey, number>> = { ...(base[id] ?? {}) };
  for (const h of [...BASE_HEROES, ...(baseOnly ? [] : [hero])]) {
    if (h !== hero && wins[h] != null) continue;
    let w = 0;
    for (let s = 1; s <= N; s++) if (runOnce(c, d, h, s, undefined, specs).win) w++;
    wins[h] = w;
  }
  base[id] = Object.fromEntries(BASE_HEROES.map(h => [h, wins[h]!]));
  cells.push({ key: c.key, diff: d, kind: kindOf(c), n: N, wins });
  console.log(`${c.key.padEnd(14)} ${d} ${kindOf(c)} ${[...BASE_HEROES, ...(baseOnly ? [] : [hero])].map(h => `${h} ${Math.round((100 * wins[h]!) / N)}`).join(' · ')} (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
}
if (basePath) writeFileSync(basePath, JSON.stringify(base));
if (out) writeFileSync(out, JSON.stringify(cells));
if (sn === 1) console.log('\n' + table(cells));
