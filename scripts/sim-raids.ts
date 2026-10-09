/**
 * 레이드 클리어율 시뮬 (02 오픈 이슈 8, 2026-10-08 Lim: 특성·능력 포함 기준으로 맞춤). 실행: npm run sim:raids [판수]
 * 실제 게임처럼: 그 레벨에서 열린 특성 단 (사제, 판마다 빌드 A·B·C 돌아가며), 공개모집 파티원 능력 1개, 단계 레벨 = 내 레벨.
 */
import { HERO_KEYS, type HeroKey } from '../src/data/heroes';
import type { DiffName } from '../src/data/difficulty';
import type { EncounterKey } from '../src/data/encounters';
import { presetSpecs, type GearId } from '../src/data/gear';
import type { ItemKey } from '../src/data/items';
import { TALENTS } from '../src/data/talents';
import { recruitParty, simulate } from '../src/engine';

const N = Number(process.argv[2] || 20);
const only = process.argv[3];
const items: ItemKey[] = ['mana', 'life'];
/** 레이드 · 난이도마다 들어가는 레벨 (10인 Lv 35 / 악몽 50, 20인 Lv 70 / 악몽 80) */
const RAIDS: { name: string; enc: EncounterKey; lv: Partial<Record<DiffName, number>> }[] = [
  { name: '역병 군주 10인', enc: 'plague', lv: { '보통': 35, '어려움': 35, '악몽': 50 } },
  { name: '무음 성가대 20인', enc: 'choir', lv: { '보통': 70, '어려움': 70, '악몽': 80 } },
];
/** 난이도마다 권장 장비 (13, data/equipment RECOMMENDED)와 한 단계 위 */
const GEARS: Partial<Record<DiffName, GearId[]>> = { '보통': ['none', 'adv0'], '어려움': ['adv0', 'rare5'], '악몽': ['rare5', 'epic5'] };

/** 열린 단만 고른 특성 (빌드 b = 0·1·2 칸) */
const build = (lv: number, b: number) => TALENTS.map(t => (t.lv <= lv ? b : null));

export function winRate(enc: EncounterKey, diff: DiffName, lv: number, gear: GearId, hero: HeroKey, n = N): number {
  let w = 0;
  for (let s = 1; s <= n; s++) {
    const f = simulate({
      encounter: enc, diff, gear, seed: s, items, hero, level: lv, heroLv: lv, stageLv: lv,
      talents: hero === 'priest' ? build(lv, s % 3) : undefined,
      party: recruitParty(enc, s, { abilities: true }),
      specs: presetSpecs(gear, hero),
    });
    if (f.over === 'win') w++;
  }
  return Math.round((w / n) * 100);
}

for (const r of RAIDS) {
  if (only && r.enc !== only) continue;
  console.log(`\n${r.name} (${N}판, 특성·능력 포함)`);
  for (const [diff, lv] of Object.entries(r.lv) as [DiffName, number][]) {
    const gs = GEARS[diff]!;
    const line = HERO_KEYS.map(h => `${h} ${gs.map(g => String(winRate(r.enc, diff, lv, g, h)).padStart(3)).join('/')}`);
    console.log(`${diff.padEnd(4)} Lv ${lv} [${gs.join('/')}]  ${line.join(' | ')}`);
  }
}
