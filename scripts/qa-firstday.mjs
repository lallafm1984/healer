// 첫날 화면 봇 (가상 사용자 QA, 2026-10-22 Lim 「처음 사용자 및 신규 사용자 입장에서의 시뮬레이션 qa 테스터」).
// 새 설치 (빈 저장)부터 실제 앱 화면을 S25 크기로 눌러 가며 처음 하는 사람의 첫날을 돈다: 타이틀 → 이야기 → 튜토리얼 두 판 → 로비 출전 (길잡이) → 편성 → 전투 → 결과 → …
// 전투는 그리지 않고 넘김 (window.__proto.skip: 초보 자동 힐러, 판 기록은 사람이 한 판처럼). 로비에 받을 임무 「!」가 뜨면 받으러 감.
// 화면 (머리 이름 + 열린 창)마다 처음 볼 때 사진, 콘솔 오류 · 가로로 넘친 화면 · 누를 곳이 없는 화면 · 같은 화면에서 맴돎을 기록.
// 실행: npm run build && node scripts/qa-firstday.mjs [--lv 7] [--runs 20] [--device s25|ultra|flip] [--out .sim/firstday]
// 결과: out/firstday.json (걸음 · 화면 · 문제) + out/shots/*.jpg. 보고서는 scripts/players-report.ts --firstday out
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LV = Number(opt('--lv', 7)), RUNS = Number(opt('--runs', 25)), OUT = opt('--out', '.sim/firstday');
const DEVICES = { s25: { width: 360, height: 780 }, ultra: { width: 412, height: 915 }, flip: { width: 360, height: 880 } };
const device = opt('--device', 's25'), viewport = DEVICES[device];
if (!viewport) throw new Error(`기기: ${Object.keys(DEVICES).join(' · ')}`);
mkdirSync(`${OUT}/shots`, { recursive: true });

// ---------- 서버 (scripts/e2e.mjs와 같은 vite preview) ----------
const host = '127.0.0.1';
const port = await new Promise(res => { const s = createServer(); s.listen(0, host, () => { const p = s.address().port; s.close(() => res(p)); }); });
const url = `http://${host}:${port}/`;
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--host', host, '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let up = false;
for (let i = 0; i < 50 && !up; i++) { try { up = (await fetch(url)).ok; } catch { /* 준비 중 */ } if (!up) await sleep(200); }
if (!up) { server.kill(); throw new Error('preview 서버가 안 뜸 (먼저 npm run build)'); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [], steps = [], problems = [], shots = [], runs = [];
page.on('pageerror', e => errors.push({ step: steps.length, text: `pageerror: ${e.message}` }));
page.on('console', m => { if (m.type() === 'error') errors.push({ step: steps.length, text: `console: ${m.text()}` }); });
await page.clock.install();
await page.goto(url);
await page.clock.runFor(500);

/** 지금 화면: 보이는 화면 id · 머리 제목 · 맨 위 창 · 저장 (레벨 · 튜토리얼 · 골드) */
const look = () => page.evaluate(() => {
  const vis = el => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const scr = [...document.querySelectorAll('.screen, section[id^="s-"], #battle, #rest')].filter(vis).map(el => el.id).filter(Boolean);
  const dlg = [...document.querySelectorAll('[role="dialog"], dialog[open], .sheet')].filter(vis).at(-1);
  const save = JSON.parse(localStorage.getItem('healer.save') || 'null');
  const F = window.__proto?.F;
  return {
    screens: scr, dialog: dlg ? (dlg.getAttribute('aria-label') || dlg.querySelector('h2, h3')?.textContent || dlg.className).trim().slice(0, 40) : null,
    title: document.querySelector('.screen:not([hidden]) .tb-title, .screen:not([hidden]) h1')?.textContent?.trim().slice(0, 30) ?? null,
    lv: save?.player?.level ?? 1, tut: save?.tut ?? 0, gold: save?.player?.gold ?? 0,
    fight: F ? { over: F.over || null, t: Math.round(F.t), enc: F.enc?.name } : null,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
});
const shotName = s => `${String(shots.length + 1).padStart(2, '0')}-${s.replace(/[^\w가-힣-]+/g, '_').slice(0, 40)}.jpg`;
const seen = new Set();
/** 처음 보는 화면 (화면 + 창)이면 사진 */
async function snap(sig, note = '') {
  if (seen.has(sig)) return;
  seen.add(sig);
  const file = shotName(sig);
  await page.screenshot({ path: `${OUT}/shots/${file}`, type: 'jpeg', quality: 55, scale: 'css' });
  shots.push({ step: steps.length, sig, file, note });
}
/** 보이고 눌리는 첫 요소를 누름 (없으면 false) */
async function tap(selector, what) {
  const loc = page.locator(selector).filter({ visible: true }).first();
  if (!(await loc.count()) || (await loc.isDisabled().catch(() => false))) return false;
  // 사람 손가락처럼: 다른 것이 덮고 있거나 움직이는 중이면 그 까닭을 적고 (Playwright가 알려 줌) 억지로 한 번 더
  await loc.click({ timeout: 1500 }).catch(async e => {
    const why = e.message.split('\n').map(l => l.trim()).filter(l => /intercepts pointer|not stable|not visible|outside of the viewport|disabled/.test(l)).at(-1) ?? e.message.split('\n')[0];
    problems.push({ step: steps.length, kind: 'tap', text: `${what}: 바로 눌리지 않음 (${why.slice(0, 160)})` });
    await loc.click({ timeout: 1500, force: true }).catch(() => {});
  });
  steps.push({ what, selector });
  await page.clock.runFor(250);
  return true;
}

let stuck = 0, lastSig = '', sameSig = 0, runStart = null, settleWait = false, lower = false;
/** 같은 칸을 연달아 진 수 (마지막 판부터) */
const lossStreak = () => { let n = 0; for (let i = runs.length - 1; i >= 0 && !runs[i].win && runs[i].content === runs.at(-1).content && runs[i].diff === runs.at(-1).diff; i--) n++; return n; };
for (let i = 0; i < 2000; i++) {
  const s = await look();
  const scr = s.screens.includes('battle') ? 'battle' : s.screens.includes('rest') ? 'rest' : s.screens.find(x => x.startsWith('s-')) ?? s.screens[0] ?? '?';
  const sig = `${scr}${s.dialog ? ` · ${s.dialog}` : ''}`;
  if (s.overflow > 1 && !problems.some(p => p.kind === 'overflow' && p.sig === sig)) problems.push({ step: steps.length, kind: 'overflow', sig, text: `${sig}: 화면이 가로로 ${s.overflow}px 넘침` });
  if (scr !== 'battle') await snap(sig);
  // 맴돎: 같은 화면에서 아무것도 안 바뀜 (전투는 시간이 흐르면 바뀐 것으로)
  const prog = `${sig}|${s.fight?.t ?? ''}|${s.fight?.enc ?? ''}`;
  sameSig = prog === lastSig ? sameSig + 1 : 0; lastSig = prog;
  if (sameSig > 12) { problems.push({ step: steps.length, kind: 'loop', sig, text: `${sig}에서 ${sameSig}번 맴돎` }); await snap(`${sig} 맴돎`); break; }
  if (s.lv >= LV && scr === 's-lobby' || runs.length >= RUNS) break;

  let done = false;
  // 열린 창 먼저: 레벨 업 · 새 기능 · 시트 → 확인 · 닫기
  if (s.dialog && scr !== 'battle' && scr !== 'rest') {
    done = await tap('[role="dialog"] .btn.primary, [role="dialog"] button.primary', `창 「${s.dialog}」 확인`)
      || await tap('[role="dialog"] [data-shut], [role="dialog"] .f-shut, .sheet [data-shut]', `창 「${s.dialog}」 닫기`)
      || await tap('[role="dialog"] button', `창 「${s.dialog}」 버튼`);
  }
  if (!done) switch (scr) {
    case 's-title': done = await tap('#s-title', '타이틀 누름'); break;
    case 's-story': done = await tap('#tutGo', '첫 전투 시작'); break;
    case 's-tut':
      if (runStart) { runs.push({ ...runStart, content: 'tutorial', diff: '쉬움', win: !(await page.locator('#tutRetry').count()), steps: steps.length - runStart.step }); runStart = null; }
      done = await tap('#tutNext', '탐험 출발') || await tap('#tutRetry', '튜토리얼 다시'); break;
    case 'battle': {
      if (!s.fight) { await page.clock.runFor(500); done = true; break; }
      if (!runStart) { runStart = { step: steps.length, enc: s.fight.enc, lv: s.lv }; await snap(`battle · ${s.fight.enc}`); }
      if (!s.fight.over) { await page.evaluate(() => window.__proto.skip(20)); await page.clock.runFor(300); }
      else await page.clock.runFor(1500);
      done = true; break;
    }
    case 'rest': done = await tap('#restGo', '정비 → 계속'); break;
    case 's-settle': {
      if (runStart) {
        const last = await page.evaluate(() => { const r = window.__proto?.last; return r ? { content: r.content, diff: r.diff, win: r.win, reason: r.reason, time: Math.round(r.time) } : null; });
        runs.push({ ...runStart, ...last, steps: steps.length - runStart.step }); runStart = null;
      }
      // 결과 숫자 올라가는 연출 · 레벨 업 창이 뜰 때까지 한 번 기다렸다가 다시 봄 (창이 뜨면 창 먼저)
      if (!settleWait) { settleWait = true; await page.clock.runFor(2500); done = true; break; }
      settleWait = false;
      // 사람처럼: 같은 칸을 세 번 연달아 지면 로비로 나가서 쉬운 난이도로 (sim/players GIVE_UP과 같음)
      if (lossStreak() >= 3) { lower = true; done = await tap('#s-settle [data-go="s-lobby"]', `결과 → 로비 (${runs.at(-1).content} ${runs.at(-1).diff} 3번 짐, 쉬운 난이도로)`); if (done) break; }
      done = await tap('#s-settle #next', '결과 → 다음 (길잡이)') || await tap('#s-settle [data-go="s-lobby"]', '결과 → 로비') || await tap('#s-settle #again', '결과 → 다시 도전');
      break;
    }
    case 's-lobby': done = await tap('#lbClaim', '로비 임무 보상 받기 「!」') || await tap('#lobbyStart', '로비 출전'); break;
    case 's-missions': done = await tap('#s-missions [data-claim]', '임무 보상 받기') || await tap('#s-missions #chest:not([disabled])', '일일 상자 열기') || await tap('#s-missions .tb-back', '임무 → 뒤로'); break;
    case 's-content':
      if (lower) {
        lower = false;
        const cur = await page.locator('#s-content [data-diff][aria-pressed="true"], #s-content [data-diff].on, #s-content [data-diff][aria-checked="true"]').first().getAttribute('data-diff').catch(() => null);
        const easier = ['쉬움', '보통', '어려움', '악몽'].slice(0, Math.max(0, ['쉬움', '보통', '어려움', '악몽'].indexOf(cur ?? '어려움'))).reverse();
        for (const d of easier) if (await tap(`#s-content [data-diff="${d}"]:not([disabled])`, `모험 선택 → 한 단계 쉬운 ${d}`)) break;
      }
      done = await tap('#contentGo', '모험 선택 → 출전'); break;
    case 's-party': done = await tap('#depart', '편성 → 출발'); break;
    default: done = await tap(`#${scr} .tb-back`, `${scr} 뒤로`) || await tap('#tabs [data-tab="lobby"]', '아래 탭 로비');
  }
  if (!done) {
    stuck++;
    problems.push({ step: steps.length, kind: 'noAction', sig, text: `${sig}: 봇이 누를 곳을 못 찾음` });
    await snap(`${sig} 누를 곳 없음`);
    if (stuck > 3) break;
    await page.clock.runFor(500);
  } else stuck = 0;
}
const end = await look();
writeFileSync(`${OUT}/firstday.json`, JSON.stringify({ device, viewport, lv: end.lv, gold: end.gold, runs, steps, shots, problems, errors }, null, 1));
console.log(`첫날 화면 봇 (${device}): Lv ${end.lv} · 판 ${runs.length} (진 판 ${runs.filter(r => !r.win).length}) · 누른 수 ${steps.length} · 화면 ${shots.length} · 문제 ${problems.length} · 콘솔 오류 ${errors.length}`);
for (const p of problems) console.log(`- ${p.kind}: ${p.text}`);
for (const e of errors.slice(0, 5)) console.log(`- 오류: ${e.text}`);
await browser.close();
server.kill();
