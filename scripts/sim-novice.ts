/**
 * 초보 검사 (src/sim/novice.ts, 2026-10-22 Lim 「처음사용자 시점의 조작의 테스트로 초반 난이도 체크」).
 * 실행: npm run sim:novice -- [--n 40] [--hero priest] [--diff 쉬움,보통,어려움] [--expert] [--tactics] [--strict] [--supps]
 * 튜토리얼 ~ 장소 Lv 20 길의 칸마다 처음 하는 사람 (engine/novice)의 클리어율과 목표 (NOVICE_TARGET)를 비교한다.
 * --expert = 같은 조건으로 지금 자동 힐러도 재서 나란히 (조작 몫 · 레벨 · 장비 몫), --tactics = 기믹 공략을 아는 초보,
 * --strict = 목표 아래 칸이 있으면 종료 코드 1, --supps = 보충 장소 (113)도 (어려움 목표 SUPP_HARD). 기본 시드 1 ~ n (같은 시드 = 같은 결과)
 */
import { stageOf } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import type { HeroKey } from '../src/data/heroes';
import { FAMILIAR, FAMILIAR_LV, NOVICE } from '../src/engine/novice';
import { cellLabel, EARLY_LV, measureNovice, noviceCells, noviceTarget, NOVICE_TARGET, NOVICE_TARGET_EARLY, TUT_TARGET, type NoviceMeasure } from '../src/sim/novice';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const N = Number(opt('--n') || 40);
const hero = (opt('--hero') || 'priest') as HeroKey;
const diffs = (opt('--diff')?.split(',') as DiffName[] | undefined) ?? ['쉬움', '보통', '어려움'];
const expert = args.includes('--expert'), strict = args.includes('--strict'), supps = args.includes('--supps');
const opts = args.includes('--tactics') ? { tactics: true } : undefined;

const why = (m: NoviceMeasure) => Object.entries(m.fails).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => `${k} ${n}`).join(' · ');
const pct = (r: number) => `${String(Math.round(r)).padStart(3)}%`;
const tg = (t: typeof NOVICE_TARGET) => Object.entries(t).filter(([d]) => diffs.includes(d as DiffName)).map(([d, v]) => `${d} ${v}%`).join(' · ');
console.log(`초보 검사 · ${hero} · 칸마다 ${N}판 · 목표 튜토리얼 ${TUT_TARGET}% / 장소 Lv ${EARLY_LV}까지 ${tg(NOVICE_TARGET_EARLY)} / 그 뒤 ${tg(NOVICE_TARGET)}`);
const who = (o: typeof NOVICE) => `반응 ${o.react}초 · 바꿀 때 고르기 ${o.pick}초/bit + 누르기 ${o.tap}초 · 한눈팔기 ${o.lapse.every}초마다 ${o.lapse.min}~${o.lapse.max}초 · 체력 읽기 ±${Math.round(o.see * 100)}%p · 옆 칸 ${Math.round(o.misTap * 100)}% · 디버프 ${o.notice}초 · 큰 버튼 ${Math.round(o.recall * 100)}% · 대기열 ${o.queue ? '읽음' : '안 읽음'} · 기믹 공략 ${o.tactics ? '앎' : '모름'}`;
console.log(`내 Lv ${FAMILIAR_LV.from}까지 처음 하는 사람: ${who(NOVICE)}`);
console.log(`내 Lv ${FAMILIAR_LV.to}부터 익숙한 사람 (중급자): ${who(FAMILIAR)} (대기열 · 공략 앎)${opts?.tactics ? ' · --tactics: 모두 공략 앎' : ''}`);
console.log('');
console.log(`| 칸 | 적 Lv | 내 Lv | 장비 | 초보 | 목표 | ${expert ? '숙련 | ' : ''}진 이유 (초보) |`);
console.log(`|---|---|---|---|---|---|${expert ? '---|' : ''}---|`);
const low: string[] = [];
for (const x of noviceCells(diffs, supps)) {
  const m = measureNovice(x, hero, N, 'novice', opts);
  const t = noviceTarget(x), bad = t != null && m.rate < t;
  if (bad) low.push(`${cellLabel(x)} ${Math.round(m.rate)}% (목표 ${t}%)`);
  const e = expert ? `${pct(measureNovice(x, hero, N, 'expert').rate)} | ` : '';
  console.log(`| ${cellLabel(x)} | ${stageOf(x.c, x.d)} | ${m.lv.toFixed(0)} | ${m.gear.toFixed(1)} | ${pct(m.rate)}${bad ? ' ↓' : ''} | ${t ?? '-'} | ${e}${why(m)} |`);
}
console.log('');
console.log(low.length ? `목표 아래 ${low.length}칸:\n- ${low.join('\n- ')}` : '모든 칸이 목표 안');
if (strict && low.length) process.exit(1);
