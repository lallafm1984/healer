/**
 * 자동 밸런스 (38 0-6, src/sim/balance.ts). 실행: npm run balance -- [장소 키 …] [--diff 어려움,악몽] [--n 40] [--check] [--write] [--report 파일.md]
 * 장소를 안 주면 만든 장소 모두. --check = 재기만 (배율을 찾지 않음), --write = 찾은 값을 src/data/tune.ts에 씀,
 * --report = 장소 × 난이도 시뮬 보고서 한 장 (38 0-7)을 마크다운 표로 씀.
 * 장소 Lv 20까지 쉬움 · 보통은 초보 하한도 봄 (처음 하는 사람 사제 NOVICE_N판, sim/novice 목표 아래로 가는 배율은 안 씀)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_DIFFS, CONTENT } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { ENCOUNTERS } from '../src/data/encounters';
import { TUNE, type Tune } from '../src/data/tune';
import { applyRows, balanceable, balanceOne, BASE_HEROES, BUSY, NOVICE_N, renderTune, rewriteTuneFile, stdLabel, TARGET, tooIdle, verdictOf, type Measure, type Row } from '../src/sim/balance';

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
/** 직업 격차 (가장 높은 직업 − 가장 낮은 직업, %p). 20 이상이면 원인을 따로 봄 (2026-10-14 직업 밸런스 검토: 평균만 보면 한 직업 49%가 가려짐) */
const gapOf = (m: Measure) => Math.max(...BASE_HEROES.map(h => m.byHero[h] ?? 0)) - Math.min(...BASE_HEROES.map(h => m.byHero[h] ?? 0));
const GAP = 20;
const mTxt = (m: Measure) => `${String(Math.round(m.rate)).padStart(3)}% (${BASE_HEROES.map(h => `${short[h]} ${m.byHero[h]}`).join(' · ')}${gapOf(m) >= GAP ? ` · 격차 ${gapOf(m)}` : ''}) ${m.time ? fmtT(m.time) : '-'} · 바쁨 ${m.busy.toFixed(1)}/분`;
const why = (m: Measure) => Object.entries(m.fails).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(' · ');
const mark = { ok: '✓', easy: '쉬움 ↑', hard: '어려움 ↓' };
const markOf = (d: (typeof diffs)[number], m: Measure, c?: (typeof places)[number]) => (tooIdle(d, m, c) ? '한가함 ↑' : mark[verdictOf(d, m.rate, c)]);

console.log(`자동 밸런스 (38 0-6) · 직업마다 ${N}판 · 목표 ${diffs.map(d => `${d} ${TARGET[d].min}~${TARGET[d].max}%${BUSY[d] ? ` · 바쁨 ${BUSY[d]}/분 이상` : ''}`).join(' / ')}${check ? ' · 재기만' : ''}`);
const rows: Row[] = [];
for (const c of places) {
  const segs = c.fights('보통');
  // 목표 시간 = 광폭화 ÷ 1.35 (35 1-2). 모든 구간에 광폭화가 있을 때만
  const enr = segs.map(k => ENCOUNTERS[k].enrage);
  const goal = enr.every(Number.isFinite) ? ` · 목표 시간 ${fmtT(enr.reduce((a, b) => a + b, 0) / 1.35)}` : '';
  console.log(`\n${c.name} (${c.key}) · ${segs.map(k => ENCOUNTERS[k].name).join(' → ')}${goal}`);
  for (const d of diffs) {
    const r = balanceOne(TUNE, c, d, N, !check, true); // 명령줄 보고는 숙련 값도
    rows.push(r);
    const f = why(r.now);
    console.log(`  ${d.padEnd(3)} ${stdLabel(r.std)} ${tuneTxt(r.cur)} → ${mTxt(r.now)} ${markOf(d, r.now, c)}${f ? ` | 실패: ${f}` : ''}`);
    if (r.next) console.log(`      → dmg ${r.next.dmg} = ${mTxt(r.next.m)}`);
    if (r.design) console.log(`      그 레벨 사람 · 중간 등급 장비 ${Math.round(r.design.before)}% → ${Math.round(r.design.after)}% · 띠 ${r.design.min} ~ ${r.design.max}% (겨눔 ${r.design.aim})${r.design.busy ? ` · 바쁨 ${r.design.busy.before.toFixed(1)} → ${r.design.busy.after.toFixed(1)}/분 (하한 ${r.design.busy.floor})` : ''}`);
    if (r.novice) console.log(`      초보 (사제 ${NOVICE_N}판) ${Math.round(r.novice.before)}% → ${Math.round(r.novice.after)}% · 목표 ${r.novice.target}%${r.novice.capped ? ' · 초보 하한으로 내림' : ''}`);
  }
}

if (report) {
  const kind = (c: (typeof places)[number]) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind === 'dungeon' ? '던전' : '탐험');
  const lines = [
    `# 시뮬 보고서 (38 0-7)`, '',
    `${new Date().toISOString().slice(0, 10)} · 만든 장소 ${places.length}곳 × ${diffs.length}난이도 · 직업마다 ${N}판 (자동 힐러, 기준 레벨 · 권장 장비 · 던전 어픽스, 장소 Lv 20까지 어려움 · 악몽은 그 난이도가 열린 때 레벨 · 드롭 장비) · 목표 ${diffs.map(d => `${d} ${TARGET[d].min}~${TARGET[d].max}%`).join(' / ')}`, '',
    '| 장소 | 종류 | 난이도 | 기준 | 보정 | 클리어율 | 사제 · 드루 · 성기 | 이긴 판 시간 | 바쁨 (치유/분) | 판정 | 진 이유 (많은 순) |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const c = places.find(x => x.key === r.key)!, m = r.next?.m ?? r.now;
    lines.push(`| ${c.name} | ${kind(c)} | ${r.diff} | Lv ${r.std.lv}${r.std.heroLv != null ? ` (내 Lv ${r.std.heroLv})` : ''} · ${r.std.gear === 'ramp' ? '드롭 장비' : r.std.gear}${r.std.affixes.length ? ` · ${r.std.affixes.join('+')}` : ''} | ${tuneTxt(r.next ? { ...(r.cur ?? {}), dmg: r.next.dmg } : r.cur)} | ${Math.round(m.rate)}% | ${BASE_HEROES.map(h => m.byHero[h] ?? 0).join(' · ')} | ${m.time ? fmtT(m.time) : '-'} | ${m.busy.toFixed(1)} | ${markOf(r.diff, m, c)} | ${why(m) || '-'} |`);
  }
  const off = rows.filter(r => { const c = places.find(x => x.key === r.key); return verdictOf(r.diff, (r.next?.m ?? r.now).rate, c) !== 'ok' || tooIdle(r.diff, r.next?.m ?? r.now, c); });
  const gaps = rows.filter(r => gapOf(r.next?.m ?? r.now) >= GAP);
  lines.push('', off.length ? `목표 밖 ${off.length}칸: ${off.map(r => `${r.name} ${r.diff}`).join(' · ')}` : '모든 칸이 목표 안.', '');
  lines.push(gaps.length ? `직업 격차 ${GAP}%p 이상 ${gaps.length}칸 (원인을 따로 봄): ${gaps.map(r => `${r.name} ${r.diff} ${BASE_HEROES.map(h => (r.next?.m ?? r.now).byHero[h] ?? 0).join('/')}`).join(' · ')}` : `직업 격차 ${GAP}%p 이상 없음.`, '');
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
