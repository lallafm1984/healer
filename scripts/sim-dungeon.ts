/**
 * 던전 밸런스 시뮬레이션 (자동 힐러). 실행: npm run sim:dungeon
 * 난이도 × 장비마다 시드 여러 개로 던전 끝까지 돌려 클리어율·시간·구간별 사망·남은 마나를 출력한다.
 * 인자: 던전 판수 [힐러 레벨] — 레벨을 주면 그 레벨까지 배운 스킬만 쓰고, 힐량·체력도 그 레벨 배율 (06 7장, 24 10장)
 * 단계 레벨은 콘텐츠 표(content.ts)를 따름
 */
import { CONTENT } from '../src/data/content';
import { DUNGEONS, type DungeonKey } from '../src/data/dungeons';
import { lvPower } from '../src/data/progression';
import type { DiffName } from '../src/data/difficulty';
import { ENCOUNTERS } from '../src/data/encounters';
import type { GearId } from '../src/data/gear';
import type { ItemKey } from '../src/data/items';
import { simulateDungeon } from '../src/engine';

const dungeon = (process.argv[2] || 'rustfort') as DungeonKey;
const N = Number(process.argv[3] || 100);
const level = process.argv[4] ? Number(process.argv[4]) : undefined;
const DIFFS: DiffName[] = ['쉬움', '보통', '어려움', '악몽'];
const GEARS: GearId[] = ['none', 'adv0', 'rare5', 'epic5'];
const items: ItemKey[] = ['mana', 'life'];
const segs = DUNGEONS[dungeon].segments;
const stageLv = CONTENT.find(c => c.key === dungeon)?.stageLv ?? 1;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

console.log(`${DUNGEONS[dungeon].name} · ${N}판씩 · 단축칸 ${items.join(',')} · 휴식 10초 · 힐러 ${level ? `Lv ${level} (힐량 ×${(lvPower(Math.max(level, stageLv)) / lvPower(stageLv)).toFixed(2)})` : '스킬 전부'} · 단계 Lv ${stageLv}`);
console.log(`구간: ${segs.map(k => ENCOUNTERS[k].name).join(' → ')}`);
for (const diff of DIFFS) for (const gear of GEARS) {
  let wins = 0, time = 0;
  const lost: Record<string, number> = {};
  const per = segs.map(() => ({ n: 0, win: 0, t: 0, deaths: 0, mana: 0, minMana: 0 }));
  for (let seed = 1; seed <= N; seed++) {
    const r = simulateDungeon({ dungeon, diff, gear, seed, items, level, heroLv: level, stageLv });
    if (r.win) { wins++; time += r.time; }
    else { const f = r.fights[r.fights.length - 1]; const why = f.over ? f.reason : '시간 초과'; lost[why] = (lost[why] || 0) + 1; }
    r.fights.forEach((f, i) => {
      const p = per[i]; p.n++;
      if (f.over === 'win') { p.win++; p.t += f.t; p.deaths += f.stats.deaths; p.mana += f.mana; p.minMana += f.stats.minMana; }
    });
  }
  const cells = per.map(p => p.n ? `${Math.round((100 * p.win) / p.n)}% ${fmt(p.t / Math.max(1, p.win))} 사망${(p.deaths / Math.max(1, p.win)).toFixed(1)} 끝마나${Math.round(p.mana / Math.max(1, p.win))} 최저${Math.round(p.minMana / Math.max(1, p.win))}` : '-');
  const why = Object.entries(lost).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
  console.log(`${diff} ${gear.padEnd(5)} 클리어 ${String(Math.round((100 * wins) / N)).padStart(3)}% ${wins ? fmt(time / wins) : '-'} | ${cells.join(' | ')}${why ? ` | 실패: ${why}` : ''}`);
}
