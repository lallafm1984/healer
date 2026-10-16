/**
 * 강화 속도 시뮬 (87): 그 단계의 콘텐츠만 돌며 재료를 모아 장비를 목표 단계까지 강화하는 데 걸리는 판 수. 실행: npm run sim:enhance [굴림 수]
 * 판마다 클리어 재료 (clearMats) + 떨어진 장비 분해 (레이드는 주 1회 제한이라 판의 LOOT만) + 하루 고정 수입 (일일 · 주간 임무 · 완료 상자 · 패스 · 주간 도전 상자)을
 * 하루 판 수로 나눈 몫. 하루 판 수 = 자연 회복 스테미너 (하루 180)만. 장비는 낮은 것부터 돌아가며 강화 (지금 ENHANCE_RATE · 비용 · 하락 그대로).
 */
import { chalChestOf } from '../src/game/economy';
import type { DiffName } from '../src/data/difficulty';
import { clearMats, dropTable, ENHANCE_DROP_FROM, ENHANCE_RATE, enhanceCost, ITEM_GRADES, SALVAGE_REFINED, SALVAGE_STONE, type GearItem } from '../src/data/equipment';
import { passFree, PASS_GAIN, PASS_LEVELS, PASS_XP, STAMINA, STAMINA_COST } from '../src/data/economy';
import { CHEST_REWARD, DAILY_N, MISSION_REWARD, WEEKLY_N, WEEKLY_REWARD } from '../src/data/missions';

const N = Number(process.argv[2] || 2000);
const LOOT = 0.25;
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

interface Stage { name: string; explore?: boolean; raid: 0 | 10 | 20; diff: DiffName; lv: number; chal: number }
const STAGES: Stage[] = [
  { name: 'Lv 10~20 던전 보통', raid: 0, diff: '보통', lv: 15, chal: 0 },
  { name: 'Lv 10~20 탐험 보통', explore: true, raid: 0, diff: '보통', lv: 15, chal: 0 },
  { name: 'Lv 30~45 던전 악몽', raid: 0, diff: '악몽', lv: 40, chal: 8 },
  { name: 'Lv 50~70 10인 어려움', raid: 10, diff: '어려움', lv: 60, chal: 12 },
  { name: 'Lv 50~70 10인 악몽', raid: 10, diff: '악몽', lv: 65, chal: 12 },
  { name: 'Lv 90~100 20인 악몽', raid: 20, diff: '악몽', lv: 95, chal: 18 },
];
/** [단계 번호, 부위 수, 시작, 목표] */
const GOALS: [number, number, number, number][] = [[0, 1, 0, 5], [0, 6, 0, 5], [1, 6, 0, 5], [2, 6, 0, 5], [2, 1, 5, 7], [3, 1, 5, 8], [3, 6, 5, 8], [4, 6, 5, 8], [5, 1, 5, 10], [5, 6, 5, 10]];

const perDay = (st: Stage) => (STAMINA.regenMs ? (24 * 3600e3) / STAMINA.regenMs : 0) / (st.raid === 20 ? STAMINA_COST.raid20 : st.raid === 10 ? STAMINA_COST.raid10 : st.explore ? STAMINA_COST.explore : STAMINA_COST.dungeon);
function salvage(table: number[]) {
  let stone = 0, refined = 0;
  table.forEach((p, i) => { stone += p * SALVAGE_STONE[ITEM_GRADES[i]]; refined += p * SALVAGE_REFINED[ITEM_GRADES[i]]; });
  return { stone, refined };
}
/** 하루 고정 수입: 임무 5개 · 완료 상자 (+ 장비 분해) · 주간 임무 · 주간 도전 상자 · 패스 단계 평균 */
function daily(st: Stage) {
  const passPerDay = (DAILY_N * PASS_GAIN.daily + PASS_GAIN.chest + (WEEKLY_N * PASS_GAIN.weekly + PASS_GAIN.challenge) / 7) / PASS_XP;
  let ps = 0, pr = 0;
  for (let l = 1; l <= PASS_LEVELS; l++) { const f = passFree(l); ps += f.stone ?? 0; pr += f.refined ?? 0; }
  const chest = salvage(dropTable(st.lv >= 45 ? '어려움' : '보통', 0));
  return {
    stone: DAILY_N * MISSION_REWARD.stone + CHEST_REWARD.stone + chest.stone + (WEEKLY_N * WEEKLY_REWARD.stone + (st.chal ? chalChestOf(st.chal).stone : 0)) / 7 + (passPerDay * ps) / PASS_LEVELS,
    refined: chest.refined + (passPerDay * pr) / PASS_LEVELS,
  };
}
function income(st: Stage) {
  const m = clearMats(st.diff, st.raid, st.explore), sv = salvage(dropTable(st.diff, st.raid)), d = daily(st), loot = st.raid ? LOOT : 1, n = perDay(st);
  return { stone: m.stone + loot * sv.stone + d.stone / n, refined: m.refined + loot * sv.refined + d.refined / n };
}
function runsTo(st: Stage, n: number, from: number, to: number): number {
  const inc = income(st), items = Array.from({ length: n }, () => ({ plus: from }) as GearItem);
  let stone = 0, refined = 0, runs = 0;
  for (;;) {
    for (;;) {
      const it = items.filter(x => x.plus < to).sort((a, b) => a.plus - b.plus)[0];
      if (!it) return runs;
      const c = enhanceCost(it)!;
      if (stone < c.stone || refined < c.refined) break;
      stone -= c.stone; refined -= c.refined;
      it.plus = rnd() < c.rate ? c.to : c.fail;
    }
    runs++; stone += inc.stone; refined += inc.refined;
  }
}
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];

console.log(`강화 확률 ${ENHANCE_RATE.slice(1).map(r => Math.round(r * 100)).join(' · ')}% · +${ENHANCE_DROP_FROM} 이상 실패하면 1단계 하락 · ${N}번 굴림`);
for (const [si, n, from, to] of GOALS) {
  const st = STAGES[si], inc = income(st), d = perDay(st), xs = Array.from({ length: N }, () => runsTo(st, n, from, to));
  const mean = xs.reduce((a, b) => a + b, 0) / N;
  console.log(`${st.name.padEnd(16)} 판마다 강화석 ${inc.stone.toFixed(1)} · 정제 ${inc.refined.toFixed(2)} | ${n}부위 +${from}→+${to}: 평균 ${mean.toFixed(0)}판 (${(mean / d).toFixed(1)}일) · 운 나쁜 10% ${q(xs, 0.9)}판 (${(q(xs, 0.9) / d).toFixed(1)}일)`);
}
