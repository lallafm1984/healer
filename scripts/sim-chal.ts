/**
 * 주간 도전 던전 맞추기 · 검사 (src/sim/chal.ts, 110 2장 · 2026-10-22 Lim 「주간 던전은 주마다 변경하고 기존의 던전들을 재활용하여 레벨에 맞춰서」).
 * 맞추기: npm run sim:chal -- --tune [--keys a,b] [--n 12] [--part 1/8] [--json 파일], 그다음 --mid (같은 옵션)
 *   던전마다 「깨기 반 배율」 (15단계 체력에서 익숙한 사람이 반을 깨는 적 피해 배율)을 들어가는 레벨 (max(Lv 20, 장소 Lv))과 Lv 100에서 찾고, 1단계 가운데 시간을 잼.
 *   --mid는 들어가는 레벨이 Lv 55 아래인 던전만 Lv 60 점을 더함. --json에 한 줄씩 쌓고, --write 파일들 로 src/data/chal-dungeons.ts를 씀
 * 검사: npm run sim:chal -- --check [--keys …] [--lv 30,60,100] [--stages 1,5,10,15,20] [--n 8] [--affix a,b]
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import type { AffixKey } from '../src/data/affixes';
import { CHAL, chalLimit, chalMult } from '../src/data/challenge';
import { CHAL_DUN } from '../src/data/chal-dungeons';
import { CONTENT, contentOf, type ContentKey } from '../src/data/content';
import { chalMeasure } from '../src/sim/chal';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const N = Number(opt('--n') || 12);
const [pi, pk] = (opt('--part') ?? '1/1').split('/').map(Number);
const all = CONTENT.filter(c => c.kind === 'dungeon' && c.ready).map(c => c.key as ContentKey);
const keys = ((opt('--keys')?.split(',') as ContentKey[] | undefined) ?? all).filter((_, i) => i % pk === pi - 1);
const hp15 = 1 + CHAL.hpStep * (CHAL.pivot - 1);
const lvIn = (k: ContentKey) => Math.max(CHAL.lv, contentOf(k).stageLv);
/** 가운데 점: 들어가는 레벨이 MID − 5 아래인 던전은 Lv MID에서도 잼 (초반 던전은 레벨에 따라 곧게 안 늘어남) */
const MID = 60;

/** 깨기 반 배율: 이긴 판이 반이 되는 적 피해 배율 (로그 이분, 8번). 위 끝 15 (2026-10-26 능력치 끝값 뒤 초반 던전 Lv 100이 6을 넘음) */
function half(k: ContentKey, lv: number): number {
  let lo = Math.log(0.3), hi = Math.log(15);
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2, w = chalMeasure(k, lv, { hp: hp15, dmg: Math.exp(mid) }, N).win;
    if (w >= 50) lo = mid; else hi = mid;
  }
  return Math.round(Math.exp((lo + hi) / 2) * 100) / 100;
}

if (args.includes('--write')) {
  const files = args.slice(args.indexOf('--write') + 1).filter(a => !a.startsWith('--'));
  const rows: Record<string, { l1: number; m1: number; m2: number; t1: number; m60?: number }> = {};
  for (const f of files) for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const d = JSON.parse(l); rows[d.key] = { ...rows[d.key], ...d }; }
  const pts = (r: (typeof rows)[string]) => [[r.l1, r.m1], ...(r.m60 != null ? [[MID, r.m60]] : []), ...(r.l1 < 100 ? [[100, r.m2]] : [])].map(([a, b]) => `[${a}, ${b}]`).join(', ');
  const body = all.filter(k => rows[k]?.m1).map(k => `  ${k}: { p: [${pts(rows[k])}], t: ${rows[k].t1} }, // ${contentOf(k).name} (장소 Lv ${contentOf(k).stageLv})`).join('\n');
  writeFileSync('src/data/chal-dungeons.ts', `/**
 * 주간 도전 던전 표 (110 2장, npm run sim:chal -- --tune 이 씀, 손으로 고치지 않음).
 * p = [레벨, 깨기 반 배율] 점 (들어가는 레벨 max(Lv ${CHAL.lv}, 장소 Lv) · Lv ${MID} (들어가는 레벨이 ${MID - 5} 아래면) · Lv 100), t = 1단계 가운데 시간 (초).
 * 깨기 반 배율 = ${CHAL.pivot}단계 체력 (× ${hp15.toFixed(2)})에서 익숙한 사람 (그 레벨 · 6부위 희귀 · 어픽스 없음)이 반을 깨는 적 피해 배율. 점 사이는 로그 직선
 */
export const CHAL_DUN: Record<string, { p: [number, number][]; t: number }> = {
${body}
};
`);
  console.log(`src/data/chal-dungeons.ts ${Object.keys(rows).length}곳`);
} else if (args.includes('--mid')) {
  const json = opt('--json');
  for (const k of keys.filter(k => lvIn(k) < MID - 5)) {
    const row = { key: k, m60: half(k, MID) };
    console.log(JSON.stringify(row));
    if (json) appendFileSync(json, JSON.stringify(row) + '\n');
  }
} else if (args.includes('--tune')) {
  const json = opt('--json');
  for (const k of keys) {
    const l1 = lvIn(k), m1 = half(k, l1), m2 = l1 >= 100 ? m1 : half(k, 100);
    const lo = (m: number) => ({ hp: 1, dmg: m * CHAL.dmgRate ** (1 - CHAL.pivot) });
    const t1 = Math.round(Math.max(chalMeasure(k, l1, lo(m1), N).med, l1 >= 100 ? 0 : chalMeasure(k, 100, lo(m2), N).med));
    const row = { key: k, name: contentOf(k).name, l1, m1, m2, t1 };
    console.log(JSON.stringify(row));
    if (json) appendFileSync(json, JSON.stringify(row) + '\n');
  }
} else {
  const lvs = (opt('--lv') ?? '30,60,100').split(',').map(Number), stages = (opt('--stages') ?? '1,5,10,15,20').split(',').map(Number);
  const aff = (opt('--affix')?.split(',') as AffixKey[] | undefined) ?? [];
  for (const k of keys) {
    if (!CHAL_DUN[k]) continue;
    for (const lv of lvs) {
      if (lv < contentOf(k).unlockLv) continue;
      const row = stages.map(s => { const m = chalMeasure(k, lv, chalMult(s, k, lv), Math.ceil(N / 1.5), aff, chalLimit(s, k)); return `${s}:${Math.round(m.inTime)}`; });
      console.log(JSON.stringify({ key: k, lv, row: row.join(' ') }));
    }
  }
}
