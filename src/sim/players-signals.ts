/**
 * 가상 사용자 QA 이상 신호 (sim/players 기록을 읽음). 사람마다 신호 목록, 타입 · 칸으로 모아 「몇 명이 겪었나」를 센다 (보고서 scripts/players-report.ts).
 * 막힘 = 같은 칸을 연달아 GIVE_UP번 짐 (그 사람이 그날 그 칸을 포기) · 진 판이 몰린 구간 · 길잡이 적정인데 절반도 못 깬 칸.
 * 너무 쉬움 = 아무도 안 쓰러지고 한가한 판 (분당 치유 수가 바쁨 하한 밑)이 길게 이어짐. 지루함 = 깬 칸 반복이 길게 이어짐.
 * 골드 = 행상인 · 모집 공고 값을 며칠씩 못 모음. 장비 = 권장 장비 밑으로 오래, 빈 부위. 흐름 = 길잡이가 추천을 못 함 · 도전 · 위험 칸 추천 · 그날 접속을 일찍 끝냄.
 * 임무 = 하루가 끝나도 못 채운 일일 임무가 자주 남음. 문턱 값은 THRESH 한 곳
 */
import { BUSY } from './balance';
import { merchantGold } from '../game/merchant';
import { MERCHANT } from '../data/economy';
import { DAILY } from '../data/missions';
import { playerType, type PlayerLog, type RunLog } from './players';

export const THRESH = {
  /** 진 판이 몰린 구간: 판 window개 가운데 진 판 몫 */
  lossy: { window: 20, share: 0.35 },
  /** 길잡이 적정 · 여유라 했는데 이 몫 밑으로 깸 (그 칸 tries판 이상) */
  guideMiss: { tries: 3, rate: 0.5 },
  /** 너무 쉬움: 아무도 안 쓰러지고 분당 치유 수가 이 밑인 이긴 판이 run판 넘게 이어짐 (튜토리얼 · 쉬움 칸 빼고) */
  easy: { run: 25, busy: BUSY['쉬움']! },
  /** 지루함: 깬 칸 반복 (첫 클리어 아님)이 이만큼 이어짐 */
  grind: 30,
  /** 골드: 행상인 · 모집 공고 한 번 값을 이만큼 날 연달아 못 모음 */
  goldDays: 5,
  /** 장비: 권장 장비 점수 밑으로 이 판 수 넘게 이어짐 */
  gearRuns: 20,
  /** 임무: 하루 끝에 못 채운 채 남은 몫 (뽑힌 날 days일 이상) */
  mission: { share: 0.5, days: 5 },
};

export type SignalKind = 'stuck' | 'lossy' | 'guideMiss' | 'easy' | 'grind' | 'gold' | 'gear' | 'flow' | 'mission';
export const SIGNAL_NAME: Record<SignalKind, string> = {
  stuck: '막힘', lossy: '진 판 몰림', guideMiss: '길잡이 어긋남', easy: '너무 쉬움', grind: '같은 칸 반복', gold: '골드', gear: '장비', flow: '흐름', mission: '임무',
};

export interface Signal {
  kind: SignalKind;
  /** 3 심함 · 2 보통 · 1 참고 */
  sev: 1 | 2 | 3;
  type: string; seed: number;
  day: number; lv: number;
  /** 모으는 열쇠 (같은 칸 · 같은 임무): 타입이 달라도 같은 것끼리 */
  key: string;
  text: string;
  /** 판 기록 번호 (log.runs, 보고서에서 펼침) */
  runs?: number[];
}

const cell = (r: RunLog) => `${r.name} ${r.diff}`;
const main = (r: RunLog) => r.why === 'guide' || r.why === 'greedy';

export function findSignals(log: PlayerLog): Signal[] {
  const out: Signal[] = [], t = playerType(log.type)!, base = { type: log.type, seed: log.seed };
  const runs = log.runs;
  // 막힘: 같은 칸 연달아 진 판 (주간 도전은 빼고)
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (r.win || r.why === 'chal') continue;
    let j = i; const idx: number[] = [];
    while (j < runs.length && !runs[j].win && cell(runs[j]) === cell(r) && runs[j].day === r.day) { idx.push(j); j++; }
    if (idx.length >= 3) {
      const reasons = [...new Set(idx.map(k => `${runs[k].reason} ${runs[k].seg + 1}/${runs[k].segs}구간`))].slice(0, 2).join(' · ');
      // 첫 클리어 칸이면 길이 막힘 (심함), 깬 칸 반복이나 도전 · 위험 칸이면 보통
      out.push({ ...base, kind: 'stuck', sev: r.first && r.fit !== '도전' && r.fit !== '위험' ? 3 : 2, day: r.day, lv: r.lv, key: cell(r), runs: idx,
        text: `${cell(r)} (적 Lv ${r.stage}, 길잡이 ${r.fit ?? '-'}, ${r.first ? '첫 클리어' : '깬 칸'})을 ${idx.length}번 연달아 짐: ${reasons}` });
    }
    i = j - 1;
  }
  // 진 판 몰림 (본 판만): 구간을 이어 붙여 한 신호
  const ms = runs.map((r, i) => ({ r, i })).filter(x => main(x.r));
  const W = THRESH.lossy.window;
  let band: { a: number; b: number } | null = null;
  const flush = () => {
    if (!band) return;
    const xs = ms.slice(band.a, band.b + 1), loss = xs.filter(x => !x.r.win).length;
    // 순차 구간 (Lv 20까지)이나 절반 가까이 지면 보통, 그 밖은 참고 (익숙한 사람 하한도 어려움 60 → 45%)
    out.push({ ...base, kind: 'lossy', sev: xs[0].r.lv <= 20 || loss / xs.length >= 0.45 ? 2 : 1, day: xs[0].r.day, lv: xs[0].r.lv, key: `Lv ${xs[0].r.lv}~${xs.at(-1)!.r.lv}`, runs: xs.filter(x => !x.r.win).map(x => x.i),
      text: `Lv ${xs[0].r.lv} ~ ${xs.at(-1)!.r.lv} (${xs[0].r.day} ~ ${xs.at(-1)!.r.day}일) ${xs.length}판 가운데 ${loss}판 짐 (${Math.round((100 * loss) / xs.length)}%)` });
    band = null;
  };
  for (let i = 0; i + W <= ms.length; i++) {
    const loss = ms.slice(i, i + W).filter(x => !x.r.win).length;
    if (loss / W >= THRESH.lossy.share) { if (band && i <= band.b) band.b = i + W - 1; else { flush(); band = { a: i, b: i + W - 1 }; } }
  }
  flush();
  // 길잡이 어긋남: 적정 · 여유 꼬리표로 한 칸 (본 판)
  const byCell = new Map<string, number[]>();
  runs.forEach((r, i) => { if (main(r) && (r.fit === '적정' || r.fit === '여유')) byCell.set(cell(r), [...(byCell.get(cell(r)) ?? []), i]); });
  for (const [k, idx] of byCell) {
    const w = idx.filter(i => runs[i].win).length;
    if (idx.length >= THRESH.guideMiss.tries && w / idx.length < THRESH.guideMiss.rate) {
      const r = runs[idx[0]];
      out.push({ ...base, kind: 'guideMiss', sev: 2, day: r.day, lv: r.lv, key: k, runs: idx, text: `${k}: 길잡이 ${r.fit}인데 ${idx.length}판 중 ${w}판만 깸` });
    }
  }
  // 너무 쉬움 · 같은 칸 반복
  let easy: number[] = [], grind: number[] = [];
  const endEasy = () => {
    if (easy.length > THRESH.easy.run) {
      const a = runs[easy[0]], b = runs[easy.at(-1)!], busy = easy.reduce((s, i) => s + runs[i].busy, 0) / easy.length;
      out.push({ ...base, kind: 'easy', sev: 1, day: a.day, lv: a.lv, key: `Lv ${a.lv}~${b.lv}`, runs: easy,
        text: `Lv ${a.lv} ~ ${b.lv} 이긴 판 ${easy.length}개가 이어서 아무도 안 쓰러지고 한가함 (분당 치유 ${busy.toFixed(1)}, 하한 ${THRESH.easy.busy})` });
    }
    easy = [];
  };
  const endGrind = () => {
    if (grind.length >= THRESH.grind) {
      const a = runs[grind[0]], b = runs[grind.at(-1)!], top = [...new Set(grind.map(i => cell(runs[i])))].slice(0, 3).join(' · ');
      out.push({ ...base, kind: 'grind', sev: 1, day: a.day, lv: a.lv, key: `Lv ${a.lv}~${b.lv}`, runs: grind,
        text: `Lv ${a.lv} ~ ${b.lv}에서 깬 칸만 ${grind.length}판 이어서 반복 (${top})` });
    }
    grind = [];
  };
  runs.forEach((r, i) => {
    if (!main(r)) return;
    if (r.win && r.deaths === 0 && r.busy < THRESH.easy.busy && r.diff !== '쉬움') easy.push(i); else endEasy();
    if (!r.first) grind.push(i); else endGrind();
  });
  endEasy(); endGrind();
  // 골드: 행상인 (행상인을 쓰는 타입) · 모집 공고 (길드를 하는 타입)
  let short: number[] = [];
  const endShort = (what: string) => {
    if (short.length >= THRESH.goldDays) {
      const a = log.days[short[0]], b = log.days[short.at(-1)!];
      out.push({ ...base, kind: 'gold', sev: 2, day: a.day, lv: a.lv, key: what, text: `${a.day} ~ ${b.day}일 (Lv ${a.lv} ~ ${b.lv}) ${short.length}일 동안 하루 끝 골드가 ${what} 한 번 값보다 적음` });
    }
    short = [];
  };
  if (t.merchant !== 'none') { log.days.forEach((d, i) => { if (d.lv >= MERCHANT.lv && d.gold < merchantGold(d.lv)) short.push(i); else endShort('행상인'); }); endShort('행상인'); }
  // 장비: 권장 장비 밑 (본 판)
  let low: number[] = [];
  const endLow = () => {
    if (low.length > THRESH.gearRuns) {
      const a = runs[low[0]], b = runs[low.at(-1)!], gap = low.reduce((s, i) => s + (runs[i].rec! - runs[i].gear), 0) / low.length;
      out.push({ ...base, kind: 'gear', sev: 2, day: a.day, lv: a.lv, key: `Lv ${a.lv}~${b.lv}`, runs: low,
        text: `Lv ${a.lv} ~ ${b.lv} ${low.length}판 동안 장비 점수가 그 칸 권장 장비보다 낮음 (평균 ${gap.toFixed(2)} 모자람)` });
    }
    low = [];
  };
  // 권장 장비가 없는 칸 (쉬움 · 보통 · 순차 구간 장소)은 건너뜀 (끊지 않음)
  runs.forEach((r, i) => { if (!main(r) || r.rec == null) return; if (r.gear < r.rec) low.push(i); else endLow(); });
  endLow();
  const emptyDays = log.days.filter(d => d.lv >= 10 && d.empty > 0);
  if (emptyDays.length >= 3) out.push({ ...base, kind: 'gear', sev: 1, day: emptyDays[0].day, lv: emptyDays[0].lv, key: '빈 부위', text: `Lv 10 뒤 ${emptyDays.length}일 동안 빈 부위가 있음 (가장 많을 때 ${Math.max(...emptyDays.map(d => d.empty))}칸)` });
  // 흐름
  for (const f of log.flows) {
    if (f.kind === 'skip') continue; // 막힘 신호와 겹침
    out.push({ ...base, kind: 'flow', sev: f.kind === 'noGuide' || f.kind === 'giveUp' || f.kind === 'noCell' ? 3 : 2, day: f.day, lv: f.lv, key: f.text, text: f.text });
  }
  // 임무: 뽑힌 날 가운데 못 채운 채 남은 몫
  const got = new Map<string, { n: number; left: number }>();
  for (const d of log.days) for (const k of d.missionKeys ?? []) { const x = got.get(k) ?? { n: 0, left: 0 }; x.n++; if (d.missionsLeft.includes(k)) x.left++; got.set(k, x); }
  for (const [k, x] of got) if (x.n >= THRESH.mission.days && x.left / x.n >= THRESH.mission.share) {
    const name = DAILY.find(m => m.key === k)?.text ?? k;
    out.push({ ...base, kind: 'mission', sev: 1, day: 1, lv: 1, key: name, text: `일일 임무 「${name}」: 뽑힌 ${x.n}일 가운데 ${x.left}일 못 채움` });
  }
  return out;
}
