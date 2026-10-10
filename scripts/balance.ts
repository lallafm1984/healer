/**
 * 자동 밸런스 (38 0-6, src/sim/balance.ts). 실행: npm run balance -- [장소 키 …] [--diff 어려움,악몽] [--n 40] [--check] [--write] [--report 파일.md]
 * 장소를 안 주면 만든 장소 모두. --check = 재기만 (배율을 찾지 않음), --write = 찾은 값을 src/data/tune.ts에 씀,
 * --report = 장소 × 난이도 시뮬 보고서 한 장 (38 0-7)을 마크다운 표로 씀
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_DIFFS, CONTENT } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { ENCOUNTERS } from '../src/data/encounters';
import { HERO_KEYS } from '../src/data/heroes';
import { TUNE, type Tune } from '../src/data/tune';
import { applyRows, balanceable, balanceOne, renderTune, rewriteTuneFile, TARGET, verdictOf, type Measure, type Row } from '../src/sim/balance';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const N = Number(opt('--n') || 40);
const diffs = (opt('--diff')?.split(',') as DiffName[] | undefined) ?? ALL_DIFFS;
const keys = args.filter((a, i) => !a.startsWith('--') && !['--n', '--diff', '--report'].includes(args[i - 1]));
const report = opt('--report');
const check = args.includes('--check'), write = args.includes('--write');
const places = CONTENT.filter(c => balanceable(c) && (!keys.length || keys.includes(c.key)));
if (!places.length) { console.log(`맞출 장소가 없음 (${keys.join(', ')})`); process.exit(1); }

const fmtT = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
const tuneTxt = (t: Tune | null) => (t === null ? '구간마다 다름' : `dmg ${t.dmg ?? 1}${t.hp != null ? ` · hp ${t.hp}` : ''}`);
const short: Record<string, string> = { priest: '사제', druid: '드루', paladin: '성기' };
const mTxt = (m: Measure) => `${String(Math.round(m.rate)).padStart(3)}% (${HERO_KEYS.map(h => `${short[h]} ${m.byHero[h]}`).join(' · ')}) ${m.time ? fmtT(m.time) : '-'}`;
const why = (m: Measure) => Object.entries(m.fails).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(' · ');
const mark = { ok: '✓', easy: '쉬움 ↑', hard: '어려움 ↓' };

console.log(`자동 밸런스 (38 0-6) · 직업마다 ${N}판 · 목표 ${diffs.map(d => `${d} ${TARGET[d].min}~${TARGET[d].max}%`).join(' / ')}${check ? ' · 재기만' : ''}`);
const rows: Row[] = [];
for (const c of places) {
  const segs = c.fights('보통');
  // 목표 시간 = 광폭화 ÷ 1.35 (35 1-2). 모든 구간에 광폭화가 있을 때만
  const enr = segs.map(k => ENCOUNTERS[k].enrage);
  const goal = enr.every(Number.isFinite) ? ` · 목표 시간 ${fmtT(enr.reduce((a, b) => a + b, 0) / 1.35)}` : '';
  console.log(`\n${c.name} (${c.key}) · ${segs.map(k => ENCOUNTERS[k].name).join(' → ')}${goal}`);
  for (const d of diffs) {
    const r = balanceOne(TUNE, c, d, N, !check);
    rows.push(r);
    const f = why(r.now);
    console.log(`  ${d.padEnd(3)} Lv ${String(r.std.lv).padStart(3)} [${r.std.gear}${r.std.affixes.length ? ` · ${r.std.affixes.join('+')}` : ''}] ${tuneTxt(r.cur)} → ${mTxt(r.now)} ${mark[r.verdict]}${f ? ` | 실패: ${f}` : ''}`);
    if (r.next) console.log(`      → dmg ${r.next.dmg} = ${mTxt(r.next.m)}`);
  }
}

if (report) {
  const kind = (c: (typeof places)[number]) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind === 'dungeon' ? '던전' : '탐험');
  const lines = [
    `# 시뮬 보고서 (38 0-7)`, '',
    `${new Date().toISOString().slice(0, 10)} · 만든 장소 ${places.length}곳 × ${diffs.length}난이도 · 직업마다 ${N}판 (자동 힐러, 기준 레벨 · 권장 장비 · 던전 어픽스) · 목표 ${diffs.map(d => `${d} ${TARGET[d].min}~${TARGET[d].max}%`).join(' / ')}`, '',
    '| 장소 | 종류 | 난이도 | 기준 | 보정 | 클리어율 | 사제 · 드루 · 성기 | 이긴 판 시간 | 판정 | 진 이유 (많은 순) |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const c = places.find(x => x.key === r.key)!, m = r.next?.m ?? r.now;
    lines.push(`| ${c.name} | ${kind(c)} | ${r.diff} | Lv ${r.std.lv} · ${r.std.gear}${r.std.affixes.length ? ` · ${r.std.affixes.join('+')}` : ''} | ${tuneTxt(r.next ? { ...(r.cur ?? {}), dmg: r.next.dmg } : r.cur)} | ${Math.round(m.rate)}% | ${HERO_KEYS.map(h => m.byHero[h]).join(' · ')} | ${m.time ? fmtT(m.time) : '-'} | ${mark[verdictOf(r.diff, m.rate)]} | ${why(m) || '-'} |`);
  }
  const off = rows.filter(r => verdictOf(r.diff, (r.next?.m ?? r.now).rate) !== 'ok');
  lines.push('', off.length ? `목표 밖 ${off.length}칸: ${off.map(r => `${r.name} ${r.diff}`).join(' · ')}` : '모든 칸이 목표 안.', '');
  writeFileSync(report, lines.join('\n'));
  console.log(`\n보고서: ${report}`);
}

const out = applyRows(TUNE, rows);
const changed = renderTune(out) !== renderTune(TUNE);
console.log(`\n${changed ? '바꿀 값 있음' : '바꿀 값 없음'}${changed && !write ? ' (--write로 src/data/tune.ts에 씀)' : ''}`);
if (changed && write) {
  const p = 'src/data/tune.ts';
  writeFileSync(p, rewriteTuneFile(readFileSync(p, 'utf8'), out));
  console.log(`${p}에 씀. 위 설명에 날짜와 이유 한 줄을 더할 것`);
}
