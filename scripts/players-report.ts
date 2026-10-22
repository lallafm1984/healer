/**
 * 가상 사용자 QA 보고서 (scripts/sim-players.ts가 쓴 사람마다 JSON → HTML 한 장 + 요약 JSON).
 * 실행: npm run players:report -- [--in .sim/players] [--out .sim/players-report.html] [--commit 81b4855] [--firstday .sim/firstday] [--notes 요약.html]
 * 맨 위 = 타입별 레벨 날짜 줄 · 먼저 볼 것 (이상 신호를 칸 · 구간으로 모아 몇 명이 겪었는지, 심한 것부터), 그 아래 날짜별 레벨 그래프 · 레벨 구간별 진 판 표 ·
 * 처음 열린 날 · 골드 · 장비 · 휴식 표, 첫날 화면 봇 (--firstday: scripts/qa-firstday.mjs 결과, 화면 사진 · 문제), 끝에 신호 종류마다 전체 목록 (사람마다 글과 판 기록)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONTENT } from '../src/data/content';
import { RECOMMENDED } from '../src/data/equipment';
import { merchantGold } from '../src/game/merchant';
import { MAX_DAYS, PLAYER_TYPES, playerType, type PlayerLog } from '../src/sim/players';
import { findSignals, SIGNAL_NAME, THRESH, type Signal, type SignalKind } from '../src/sim/players-signals';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const dir = opt('--in') || '.sim/players', outFile = opt('--out') || '.sim/players-report.html', commit = opt('--commit') || '', fdDir = opt('--firstday');
/** 사람이 쓴 요약 (HTML 조각, 맨 위 「이번에 찾은 것」) */
const notes = opt('--notes') ? readFileSync(opt('--notes')!, 'utf8') : '';
const logs: PlayerLog[] = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const order = (k: string) => PLAYER_TYPES.findIndex(t => t.key === k);
logs.sort((a, b) => order(a.type) - order(b.type) || a.seed - b.seed);
const types = PLAYER_TYPES.filter(t => logs.some(l => l.type === t.key));
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const median = (xs: number[]) => { const s = xs.filter(x => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');
const byType = (k: string) => logs.filter(l => l.type === k);
const tname = (k: string) => playerType(k)?.name ?? k;
const SLOT_VARS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
const sv = (k: string) => `var(${SLOT_VARS[order(k) % SLOT_VARS.length]})`;

// ---------- 신호 ----------
const sigs: Signal[] = logs.flatMap(l => findSignals(l));
const BAND: SignalKind[] = ['lossy', 'easy', 'grind', 'gear'];
const groupKey = (s: Signal) => (BAND.includes(s.kind) && s.key !== '빈 부위' ? `${s.kind}|Lv ${Math.floor((s.lv - 1) / 10) * 10 + 1}~${Math.floor((s.lv - 1) / 10) * 10 + 10}` : `${s.kind}|${s.key}`);
interface Group { kind: SignalKind; label: string; sev: number; people: Set<string>; types: Set<string>; lvs: number[]; items: Signal[] }
const groups = new Map<string, Group>();
for (const s of sigs) {
  const k = groupKey(s);
  const g = groups.get(k) ?? { kind: s.kind, label: k.split('|')[1], sev: 0, people: new Set(), types: new Set(), lvs: [], items: [] };
  g.sev = Math.max(g.sev, s.sev); g.people.add(`${s.type}#${s.seed}`); g.types.add(s.type); g.lvs.push(s.lv); g.items.push(s);
  groups.set(k, g);
}
const gl = [...groups.values()].sort((a, b) => b.sev - a.sev || b.people.size - a.people.size || Math.min(...a.lvs) - Math.min(...b.lvs));
const SEV = ['', '참고', '보통', '심함'];

// ---------- 표 값 ----------
const MILESTONES = [5, 10, 15, 20, 30, 40, 50, 60, 70, 85, 100];
const dayAt = (l: PlayerLog, lv: number) => l.levelDay[lv] ?? NaN;
const lossPct = (l: PlayerLog, f = (_: PlayerLog['runs'][number]) => true) => { const rs = l.runs.filter(r => r.why !== 'tut' && f(r)); return rs.length ? (100 * rs.filter(r => !r.win).length) / rs.length : NaN; };
const BANDS = [[1, 10], [11, 20], [21, 30], [31, 45], [46, 60], [61, 70], [71, 85], [86, 99]] as const;
const OPENS = ['특성 1단', '행상인', '길드 결성', '드루이드', '주간 도전', '성기사', '드루이드로 바꿈', '성기사로 바꿈', '10인 레이드', '20인 레이드', '특성 10단'];

// ---------- 날짜별 레벨 그래프 (SVG) ----------
const maxDay = Math.max(...logs.map(l => l.days.length));
const W = 720, Hh = 300, pad = { l: 40, r: 16, t: 14, b: 32 };
const xs = (d: number) => pad.l + ((W - pad.l - pad.r) * (d - 1)) / Math.max(1, maxDay - 1);
const ys = (lv: number) => pad.t + ((Hh - pad.t - pad.b) * (100 - lv)) / 99;
const series = types.map(t => {
  const ls = byType(t.key), n = Math.max(...ls.map(l => l.days.length));
  const pts = Array.from({ length: n }, (_, i) => median(ls.map(l => l.days[i]?.lv ?? (l.done != null ? 100 : NaN))));
  const end = pts.findIndex(v => v >= 100); // 가운데값이 Lv 100에 닿은 날에서 끝 (늦은 사람이 끝날 때까지 100으로 눕지 않게)
  return { t, pts: end >= 0 ? pts.slice(0, end + 1) : pts };
});
const xTicks = [1, ...Array.from({ length: Math.floor(maxDay / 30) }, (_, i) => (i + 1) * 30)].filter(d => d <= maxDay);
const chart = `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="타입별 날짜에 따른 레벨 (시드 가운데값)">
  ${[1, 20, 40, 60, 80, 100].map(v => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${ys(v)}" y2="${ys(v)}"/><text class="tick" x="${pad.l - 6}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join('')}
  ${xTicks.map(d => `<text class="tick" x="${xs(d)}" y="${Hh - pad.b + 18}" text-anchor="middle">${d}일</text>`).join('')}
  ${series.map(s => `<polyline class="line" style="stroke:${sv(s.t.key)}" points="${s.pts.map((v, i) => (Number.isFinite(v) ? `${xs(i + 1).toFixed(1)},${ys(v).toFixed(1)}` : '')).filter(Boolean).join(' ')}"/>`).join('')}
  ${series.map(s => { const i = s.pts.length - 1; return Number.isFinite(s.pts[i]) ? `<circle class="dot" cx="${xs(i + 1).toFixed(1)}" cy="${ys(s.pts[i]).toFixed(1)}" r="4" style="fill:${sv(s.t.key)}"><title>${esc(s.t.name)} ${i + 1}일 Lv ${s.pts[i]}</title></circle>` : ''; }).join('')}
  <line class="hair" x1="0" x2="0" y1="${pad.t}" y2="${Hh - pad.b}" visibility="hidden"/>
  <rect class="hit" x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${Hh - pad.t - pad.b}"/>
</svg>`;
const chartData = { maxDay, x0: pad.l, x1: W - pad.r, W, series: series.map(s => ({ name: s.t.name, pts: s.pts.map(v => (Number.isFinite(v) ? v : null)) })) };

// ---------- 표 HTML ----------
const typeRows = types.map(t => {
  const ls = byType(t.key), runs = median(ls.map(l => l.totalRuns)), loss = median(ls.map(l => lossPct(l)));
  const cells = MILESTONES.map(lv => { const v = median(ls.map(l => dayAt(l, lv))), miss = ls.filter(l => !(lv in l.levelDay)).length; return `<td class="num">${fmt(v)}${miss ? `<small> (${miss}명 못 감)</small>` : ''}</td>`; }).join('');
  return `<tr><th scope="row"><span class="key" style="background:${sv(t.key)}"></span>${esc(t.name)}</th>${cells}<td class="num">${fmt(runs)}</td><td class="num">${fmt(loss, 1)}%</td></tr>`;
}).join('');
const heat = types.map(t => {
  const ls = byType(t.key);
  return `<tr><th scope="row">${esc(t.name)}</th>${BANDS.map(([a, b]) => {
    const v = median(ls.map(l => lossPct(l, r => (r.why === 'guide' || r.why === 'greedy') && r.lv >= a && r.lv <= b)));
    return `<td class="num heat" style="--h:${Number.isFinite(v) ? Math.min(1, v / 50).toFixed(2) : 0}">${Number.isFinite(v) ? `${fmt(v)}%` : '–'}</td>`;
  }).join('')}</tr>`;
}).join('');
const opens = types.map(t => `<tr><th scope="row">${esc(t.name)}</th>${OPENS.map(k => `<td class="num">${fmt(median(byType(t.key).map(l => l.opens[k] ?? NaN)))}</td>`).join('')}</tr>`).join('');
const econ = types.map(t => {
  const ls = byType(t.key), at = (l: PlayerLog, lv: number) => l.days.find(d => d.lv >= lv);
  const gold = (lv: number) => median(ls.map(l => at(l, lv)?.gold ?? NaN)), price = (lv: number) => merchantGold(lv);
  const gear = (lv: number) => median(ls.map(l => at(l, lv)?.gearAvg ?? NaN));
  const perDay = median(ls.map(l => median(l.days.map(d => d.goldIn))));
  const bought = median(ls.map(l => l.days.reduce((s, d) => s + d.bought, 0)));
  const full = median(ls.map(l => { const rs = l.runs.filter(r => r.share != null); return rs.length ? (100 * rs.filter(r => r.share === 1).length) / rs.length : NaN; }));
  const min = median(ls.map(l => median(l.days.map(d => d.minutes))));
  return `<tr><th scope="row">${esc(t.name)}</th>
    ${[20, 50, 100].map(lv => `<td class="num">${fmt(gold(lv))}<small> / ${fmt(price(lv))}</small></td>`).join('')}
    <td class="num">${fmt(perDay)}</td><td class="num">${fmt(bought)}</td>
    ${[20, 50, 100].map(lv => `<td class="num">${fmt(gear(lv), 2)}</td>`).join('')}
    <td class="num">${fmt(full)}%</td><td class="num">${fmt(min)}분</td></tr>`;
}).join('');

const runRow = (l: PlayerLog, i: number) => {
  const r = l.runs[i];
  return `<tr><td class="num">${r.day}일</td><td class="num">Lv ${r.lv}</td><td>${esc(r.name)} ${r.diff}${r.chal ? ` ${r.chal}단계` : ''}</td><td class="num">${r.stage}</td><td>${r.fit ?? '–'}</td><td>${r.win ? '이김' : `<b class="lose">${esc(r.reason)}</b> ${r.seg + 1}/${r.segs}`}</td><td class="num">${r.time}초</td><td class="num">${r.busy}</td><td class="num">${r.gear}${r.rec != null ? ` / ${r.rec}` : ''}</td><td>${r.hand.react}초 · ${r.hand.pick}${r.hand.queue ? ' · 대기열' : ''}${r.hand.tactics ? ' · 공략' : ''}</td></tr>`;
};
const runTable = (l: PlayerLog, idx: number[]) => `<div class="scroll"><table class="runs"><thead><tr><th>날</th><th>레벨</th><th>칸</th><th>적 Lv</th><th>길잡이</th><th>결과</th><th>시간</th><th>분당 치유</th><th>장비 / 권장</th><th>손 (반응 · 고르기)</th></tr></thead><tbody>${idx.slice(0, 12).map(i => runRow(l, i)).join('')}</tbody></table>${idx.length > 12 ? `<p class="small">… ${idx.length - 12}판 더</p>` : ''}</div>`;
const logOf = (s: Signal) => logs.find(l => l.type === s.type && l.seed === s.seed)!;
const groupHtml = (g: Group, open = false) => `<details class="sig sev${g.sev}"${open ? ' open' : ''}><summary><span class="chip k-${g.kind}">${SIGNAL_NAME[g.kind]}</span><span class="sv">${SEV[g.sev]}</span><b>${esc(g.label)}</b><span class="who">${g.people.size}명 · ${[...g.types].map(tname).join(' · ')} · Lv ${Math.min(...g.lvs)}${Math.max(...g.lvs) > Math.min(...g.lvs) ? ` ~ ${Math.max(...g.lvs)}` : ''}</span></summary>
  <ul>${g.items.slice(0, 12).map((s, i) => `<li><b>${esc(tname(s.type))} #${s.seed}</b> · ${s.day}일 · ${esc(s.text)}${i < 3 && s.runs?.length ? runTable(logOf(s), s.runs) : ''}</li>`).join('')}</ul>${g.items.length > 12 ? `<p class="small">… ${g.items.length - 12}건 더</p>` : ''}</details>`;
const top = gl.filter(g => g.sev >= 2).slice(0, 12);
const kinds = (Object.keys(SIGNAL_NAME) as SignalKind[]).filter(k => gl.some(g => g.kind === k));
const count = (k: SignalKind) => gl.filter(g => g.kind === k).length;

// ---------- 첫날 화면 봇 ----------
interface FirstDay { device: string; viewport: { width: number; height: number }; lv: number; gold: number; runs: { content: string; diff: string; win: boolean; reason?: string; steps: number; lv: number; time?: number }[]; steps: { what: string }[]; shots: { step: number; sig: string; file: string }[]; problems: { kind: string; text: string; step: number }[]; errors: { text: string; step: number }[] }
const fd: FirstDay | null = fdDir && existsSync(`${fdDir}/firstday.json`) ? JSON.parse(readFileSync(`${fdDir}/firstday.json`, 'utf8')) : null;
const SCREEN_NAME: Record<string, string> = { 's-title': '타이틀', 's-story': '이야기', 's-tut': '튜토리얼 카드', battle: '전투', rest: '정비', 's-settle': '결과', 's-lobby': '로비', 's-content': '모험 선택', 's-party': '편성', 's-missions': '임무' };
const CONTENT_NAME = (k: string) => (k === 'tutorial' ? '첫 전투' : CONTENT.find(c => c.key === k)?.name ?? k);
const sigName = (sig: string) => sig.split(' · ').map((x, i) => (i ? x : SCREEN_NAME[x] ?? x)).join(' · ');
const firstDay = fd ? `<section>
    <h2>첫날 화면 흐름 (${esc(fd.device.toUpperCase())} ${fd.viewport.width}×${fd.viewport.height})</h2>
    <p class="small">새 설치에서 실제 앱 화면을 눌러 간 기록입니다. 전투만 그리지 않고 넘겼고 (초보 자동 힐러, 판 기록은 사람이 한 판처럼), 로비에서는 「!」가 뜨면 임무를 받고 출전 (길잡이), 결과에서는 「다음」을 눌렀습니다. Lv ${fd.lv}까지 판 ${fd.runs.length}개 · 누른 수 ${fd.steps.length} · 문제 ${fd.problems.length} · 콘솔 오류 ${fd.errors.length}.</p>
    ${fd.problems.length || fd.errors.length ? `<ul class="fd-probs">${[...fd.problems.map(p => `<li><span class="chip">${esc({ tap: '바로 안 눌림', overflow: '가로 넘침', loop: '맴돎', noAction: '누를 곳 없음' }[p.kind] ?? p.kind)}</span> ${esc(p.text)} <small>(${p.step}번째 누름)</small></li>`), ...fd.errors.slice(0, 10).map(e => `<li><span class="chip">오류</span> ${esc(e.text.slice(0, 200))}</li>`)].join('')}</ul>` : '<p>문제 없음.</p>'}
    <div class="shots">${fd.shots.map(x => `<figure><img loading="lazy" alt="${esc(sigName(x.sig))}" src="data:image/jpeg;base64,${readFileSync(`${fdDir}/shots/${x.file}`).toString('base64')}"><figcaption>${x.step}. ${esc(sigName(x.sig))}</figcaption></figure>`).join('')}</div>
    <div class="strip" role="img" aria-label="판마다 결과: 이김 ${fd.runs.filter(r => r.win).length}, 짐 ${fd.runs.filter(r => !r.win).length}">${fd.runs.map((r, i) => `<span class="${r.win ? 'w' : 'l'}" title="${i + 1}판 Lv ${r.lv} ${esc(CONTENT_NAME(r.content))} ${esc(r.diff)} ${r.win ? '이김' : '짐'}"></span>`).join('')}</div>
    <p class="small">칸 하나가 한 판 (초록 이김 · 빨강 짐), 왼쪽부터 차례로.</p>
    <details class="kind"><summary><h3>판 기록 <small>${fd.runs.length}판</small></h3></summary><div class="scroll"><table><thead><tr><th>판</th><th>레벨</th><th>칸</th><th>결과</th><th class="num">전 판 뒤 누른 수</th></tr></thead><tbody>${fd.runs.map((r, i) => `<tr><td class="num">${i + 1}</td><td class="num">Lv ${r.lv}</td><td>${esc(CONTENT_NAME(r.content))} ${esc(r.diff)}</td><td>${r.win ? '이김' : `<b class="lose">${esc(r.reason ?? '짐')}</b>`}</td><td class="num">${r.steps}</td></tr>`).join('')}</tbody></table></div></details>
  </section>` : '';

const html = `<title>가상 사용자 QA 보고서</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@700;800&family=Noto+Sans+KR:wght@400;500;700&display=swap">
<style>
/* 한 줄 기둥 (본문 58rem): 머리 · 먼저 볼 것 · 그래프 · 표 · 신호 목록. 표는 저마다 가로 스크롤 */
:root {
  --bg: #f3f1ec; --panel: #fbfaf7; --ink: #23272b; --muted: #646b70; --line: #d9d4c9; --grid: #e6e1d6;
  --brass: #9a6a1f; --brass-soft: #efe2c6; --heat: 235, 104, 52;
  --bad: #b23b32; --warn: #a8661a; --info: #2f5f8a; --good: #2f7a52;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300;
  --f-head: "Hahmlet", "Noto Serif KR", serif; --f-body: "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #1b1e21; --panel: #23272b; --ink: #e9e6df; --muted: #a1a7ab; --line: #3a3f44; --grid: #30353a; --brass: #e0b25e; --brass-soft: #3b3220; --heat: 217, 89, 38;
  --bad: #ef7d73; --warn: #e3a454; --info: #84b3e0; --good: #6cc495;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #1b1e21; --panel: #23272b; --ink: #e9e6df; --muted: #a1a7ab; --line: #3a3f44; --grid: #30353a; --brass: #e0b25e; --brass-soft: #3b3220; --heat: 217, 89, 38;
  --bad: #ef7d73; --warn: #e3a454; --info: #84b3e0; --good: #6cc495;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font-family: var(--f-body); font-size: 15px; line-height: 1.6;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 56px; }
main { max-width: 58rem; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
h1, h2 { font-family: var(--f-head); margin: 0; line-height: 1.3; text-wrap: balance; }
h1 { font-size: 1.7rem; font-weight: 800; } h2 { font-size: 1.15rem; font-weight: 700; }
p { margin: 0; } section { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.eyebrow { font-size: .75rem; letter-spacing: .08em; color: var(--brass); font-weight: 700; }
.lede, .small { color: var(--muted); } .small { font-size: .8rem; }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
table { border-collapse: collapse; width: 100%; font-size: .84rem; }
th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid var(--line); vertical-align: top; white-space: nowrap; }
thead th { font-size: .74rem; color: var(--muted); font-weight: 700; letter-spacing: .02em; }
tbody tr:last-child > * { border-bottom: 0; }
.num { text-align: right; font-variant-numeric: tabular-nums; } td small { color: var(--muted); font-size: .72rem; }
.key { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: baseline; }
.heat { background: rgba(var(--heat), calc(var(--h) * .55)); }
.chartbox { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px; position: relative; overflow-x: auto; }
.chart { width: 100%; min-width: 560px; height: auto; display: block; }
.chart .grid { stroke: var(--grid); stroke-width: 1; } .chart .tick { fill: var(--muted); font-size: 11px; font-family: var(--f-body); }
.chart .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.chart .dot { stroke: var(--panel); stroke-width: 2; } .chart .end { fill: var(--ink); font-size: 12px; font-family: var(--f-body); }
.chart .hair { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; } .chart .hit { fill: transparent; cursor: crosshair; }
.tip { position: absolute; pointer-events: none; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 9px; font-size: .78rem; box-shadow: 0 2px 8px rgba(0,0,0,.12); white-space: nowrap; }
.tip b { display: block; margin-bottom: 2px; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .82rem; color: var(--muted); }
.sig { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
.sig.sev3 { border-left: 4px solid var(--bad); } .sig.sev2 { border-left: 4px solid var(--warn); } .sig.sev1 { border-left: 4px solid var(--info); }
.sig summary { cursor: pointer; padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.sig summary:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
.sig ul { margin: 0; padding: 0 14px 12px 30px; display: flex; flex-direction: column; gap: 8px; font-size: .86rem; }
.sig li { min-width: 0; } .sig .runs { font-size: .76rem; margin-top: 6px; }
.chip { font-size: .72rem; font-weight: 700; border-radius: 4px; padding: 1px 7px; background: var(--brass-soft); color: var(--brass); }
.sv { font-size: .72rem; color: var(--muted); } .who { font-size: .8rem; color: var(--muted); }
.lose { color: var(--bad); font-weight: 700; }
.list { display: flex; flex-direction: column; gap: 8px; }
.counts { display: flex; flex-wrap: wrap; gap: 6px; } .counts a { font-size: .8rem; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 99px; padding: 2px 10px; text-decoration: none; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.shots figure { margin: 0; display: flex; flex-direction: column; gap: 4px; min-width: 0; } .shots img { width: 100%; border-radius: 6px; border: 1px solid var(--line); }
.shots figcaption { font-size: .74rem; color: var(--muted); }
.fd-probs { margin: 0; padding-left: 1.1em; font-size: .86rem; display: flex; flex-direction: column; gap: 4px; }
.strip { display: flex; flex-wrap: wrap; gap: 3px; } .strip span { width: 14px; height: 14px; border-radius: 3px; } .strip .w { background: var(--good); } .strip .l { background: var(--bad); }
details.kind > summary { cursor: pointer; list-style: none; padding: 4px 0; } details.kind > summary h3 { display: inline; font-family: var(--f-head); font-size: 1rem; margin: 0; }
details.kind > summary h3 small { font-family: var(--f-body); font-size: .78rem; color: var(--muted); font-weight: 400; } details.kind > summary::before { content: '▸ '; color: var(--muted); } details.kind[open] > summary::before { content: '▾ '; }
details.kind .list { margin-top: 8px; }
.notes { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.notes ol { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 8px; } .notes li { line-height: 1.6; } .notes b { font-weight: 700; }
.method { font-size: .86rem; color: var(--muted); display: flex; flex-direction: column; gap: 6px; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
</style>
<main>
  <header style="display:flex;flex-direction:column;gap:8px">
    <span class="eyebrow">나혼자 힐러 · 가상 사용자 QA · ${new Date().toISOString().slice(0, 10)}${commit ? ` · main ${esc(commit)}` : ''}</span>
    <h1>가상 사용자 QA 보고서</h1>
    <p class="lede">새로 설치한 사람 ${logs.length}명 (${types.length}타입 × ${Math.max(...types.map(t => byType(t.key).length))}명)이 튜토리얼부터 Lv 100까지 간 기록입니다. 판마다 실제 전투 엔진으로 싸우고, 누르는 손은 초보 검사의 사람 모델, 정산 · 임무 · 행상인 · 길드는 게임 코드를 그대로 썼습니다. 숫자는 같은 타입 사람들의 가운데값입니다.</p>
  </header>

  ${notes ? `<section><h2>이번에 찾은 것</h2><div class="notes">${notes}</div></section>` : ''}

  <section>
    <h2>Lv에 닿은 날</h2>
    <div class="scroll"><table><thead><tr><th>타입</th>${MILESTONES.map(lv => `<th class="num">Lv ${lv}</th>`).join('')}<th class="num">판 수</th><th class="num">진 판</th></tr></thead><tbody>${typeRows}</tbody></table></div>
    <div class="chartbox" id="lvchart">${chart}<div class="tip" hidden></div></div>
    <div class="legend">${types.map(t => `<span><span class="key" style="background:${sv(t.key)}"></span>${esc(t.name)}</span>`).join('')}<span>· 가로 = 날, 세로 = 그날 끝 레벨</span></div>
  </section>

  <section>
    <h2>먼저 볼 것</h2>
    <p class="small">심한 신호부터, 같은 칸 · 같은 레벨 구간을 모아 몇 명이 겪었는지. 줄을 누르면 사람마다 글과 판 기록이 펼쳐집니다.</p>
    <div class="list">${top.length ? top.map(g => groupHtml(g)).join('') : '<p>심함 · 보통 신호가 없습니다.</p>'}</div>
  </section>

  ${firstDay}

  <section>
    <h2>레벨 구간별 진 판</h2>
    <p class="small">본 판 (길잡이 · 제멋대로 칸)만, 진 판 몫의 가운데값. 색이 짙을수록 많이 짐 (50% 이상이 가장 짙음).</p>
    <div class="scroll"><table><thead><tr><th>타입</th>${BANDS.map(([a, b]) => `<th class="num">Lv ${a}~${b}</th>`).join('')}</tr></thead><tbody>${heat}</tbody></table></div>
  </section>

  <section>
    <h2>처음 열린 날</h2>
    <div class="scroll"><table><thead><tr><th>타입</th>${OPENS.map(k => `<th class="num">${esc(k)}</th>`).join('')}</tr></thead><tbody>${opens}</tbody></table></div>
  </section>

  <section>
    <h2>골드 · 장비 · 휴식</h2>
    <p class="small">골드 = 그 레벨이 된 날 끝에 가진 골드 / 행상인 한 번 값. 장비 = 착용 장비 평균 점수 (권장: 어려움 ${fmt(RECOMMENDED['어려움']!.score, 2)} · 악몽 ${fmt(RECOMMENDED['악몽']!.score, 2)}). 휴식 보너스 = 이긴 판 가운데 보너스를 다 받은 몫.</p>
    <div class="scroll"><table><thead><tr><th>타입</th><th class="num">골드 Lv 20</th><th class="num">Lv 50</th><th class="num">Lv 100</th><th class="num">하루 번 골드</th><th class="num">행상인 산 수</th><th class="num">장비 Lv 20</th><th class="num">Lv 50</th><th class="num">Lv 100</th><th class="num">휴식 보너스</th><th class="num">하루 플레이</th></tr></thead><tbody>${econ}</tbody></table></div>
  </section>


  <section>
    <h2>모든 신호</h2>
    <div class="counts">${kinds.map(k => `<a href="#k-${k}">${SIGNAL_NAME[k]} ${count(k)}</a>`).join('')}</div>
    ${kinds.map(k => `<details class="kind" id="k-${k}"><summary><h3>${SIGNAL_NAME[k]} <small>${count(k)}묶음</small></h3></summary><div class="list">${gl.filter(g => g.kind === k).map(g => groupHtml(g)).join('')}</div></details>`).join('')}
  </section>

  <section class="method">
    <h2>어떻게 쟀나</h2>
    ${types.map(t => `<p><b>${esc(t.name)}</b>: ${esc(t.note)}</p>`).join('')}
    <p>모두: 월요일 0시 새 저장, 진 판은 같은 칸을 다시 (길잡이 칸은 그날 3번, 제멋대로는 2번 지면 그 칸을 빼고 다음), 특성은 열리는 대로, 판마다 준비 · 결과 화면 45초. ${MAX_DAYS}일에서 멈춤.</p>
    <p>신호 문턱: 진 판 몰림 = 본 판 ${THRESH.lossy.window}판 가운데 ${Math.round(THRESH.lossy.share * 100)}% 이상 짐 · 길잡이 어긋남 = 적정 · 여유 칸을 ${THRESH.guideMiss.tries}판 넘게 해서 ${Math.round(THRESH.guideMiss.rate * 100)}% 밑 · 너무 쉬움 = 아무도 안 쓰러지고 분당 치유 ${THRESH.easy.busy} 밑인 이긴 판이 ${THRESH.easy.run}판 넘게 이어짐 (쉬움 칸 빼고) · 같은 칸 반복 = 깬 칸만 ${THRESH.grind}판 · 골드 = ${THRESH.goldDays}일 연달아 행상인 한 번 값보다 적음 · 장비 = 권장 장비 밑으로 ${THRESH.gearRuns}판 넘게.</p>
  </section>
</main>
<script>
(() => {
  const D = ${JSON.stringify(chartData)};
  const box = document.getElementById('lvchart'), svg = box.querySelector('svg'), tip = box.querySelector('.tip'), hair = svg.querySelector('.hair'), hit = svg.querySelector('.hit');
  const move = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * D.W / r.width;
    const day = Math.max(1, Math.min(D.maxDay, Math.round(1 + (x - D.x0) / (D.x1 - D.x0) * (D.maxDay - 1))));
    const px = D.x0 + (D.x1 - D.x0) * (day - 1) / Math.max(1, D.maxDay - 1);
    hair.setAttribute('x1', px); hair.setAttribute('x2', px); hair.setAttribute('visibility', 'visible');
    tip.innerHTML = '<b>' + day + '일</b>' + D.series.map(s => s.name + ' Lv ' + (s.pts[day - 1] ?? (s.pts.length < day ? 100 : '–'))).join('<br>');
    tip.hidden = false;
    const bx = box.getBoundingClientRect(), left = e.clientX - bx.left + box.scrollLeft + 14;
    tip.style.left = Math.min(left, box.scrollWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = '16px';
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', () => { tip.hidden = true; hair.setAttribute('visibility', 'hidden'); });
})();
</script>
`;
writeFileSync(outFile, html);
writeFileSync(outFile.replace(/\.html$/, '.json'), JSON.stringify({
  people: logs.length, types: types.map(t => t.key),
  levelDays: Object.fromEntries(types.map(t => [t.key, Object.fromEntries(MILESTONES.map(lv => [lv, median(byType(t.key).map(l => dayAt(l, lv)))]))])),
  signals: gl.map(g => ({ kind: g.kind, label: g.label, sev: g.sev, people: g.people.size, types: [...g.types], lv: [Math.min(...g.lvs), Math.max(...g.lvs)], text: g.items[0].text })),
}, null, 1));
console.log(`${outFile}: ${logs.length}명 · 신호 ${sigs.length}건 (${gl.length}묶음, 심함 ${gl.filter(g => g.sev === 3).length} · 보통 ${gl.filter(g => g.sev === 2).length})`);
