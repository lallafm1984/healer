/**
 * 힐러 직업 비교 시뮬 (25 9장: 사제와 클리어율 맞추기). 실행: npm run sim:heroes [판수]
 * 녹슨 요새(던전 전체)와 역병 군주(10인)를 직업 × 난이도 × 장비로 돌려 클리어율만 표로
 */
import type { DiffName } from '../src/data/difficulty';
import type { GearId } from '../src/data/gear';
import { HERO_KEYS } from '../src/data/heroes';
import type { ItemKey } from '../src/data/items';
import { simulate, simulateDungeon } from '../src/engine';

const N = Number(process.argv[2] || 30);
const items: ItemKey[] = ['mana', 'life'];
const GEARS: GearId[] = ['none', 'adv0', 'rare5', 'epic5'];
const rows: [string, DiffName[], (hero: typeof HERO_KEYS[number], diff: DiffName, gear: GearId, seed: number) => boolean][] = [
  ['녹슨 요새', ['보통', '어려움', '악몽'], (hero, diff, gear, seed) => simulateDungeon({ dungeon: 'rustfort', diff, gear, seed, items, hero }).win],
  ['녹슨 문지기', ['보통', '어려움'], (hero, diff, gear, seed) => simulate({ encounter: 'warden', diff, gear, seed, items, hero }).over === 'win'],
  ['역병 군주 10인', ['쉬움', '보통', '어려움'], (hero, diff, gear, seed) => simulate({ encounter: 'plague', diff, gear, seed, items, hero }).over === 'win'],
];
for (const [name, diffs, run] of rows) {
  console.log(`\n${name} (${N}판, 장비 ${GEARS.join('/')})`);
  for (const diff of diffs) {
    const line = HERO_KEYS.map(h => `${h} ${GEARS.map(g => { let w = 0; for (let s = 1; s <= N; s++) if (run(h, diff, g, s)) w++; return String(Math.round((w / N) * 100)).padStart(3); }).join('/')}`);
    console.log(`${diff.padEnd(4)} ${line.join(' | ')}`);
  }
}
