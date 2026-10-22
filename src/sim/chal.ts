/**
 * 주간 도전 시뮬 (110 2장 · 2026-10-22 Lim 「주간 던전은 주마다 변경하고 기존의 던전들을 재활용하여 레벨에 맞춰서」).
 * 익숙한 사람 (engine/novice noviceAt: 그 레벨 사람) · 6부위 희귀 (familiar midGear) · 공개모집 · 사제 · 드루이드 · 성기사 · 특성 빌드 A · B · C 번갈아,
 * 적 레벨 = 내 레벨, 구간 사이 쉼 10초 (restCarry). 명령줄은 scripts/sim-chal.ts (npm run sim:chal)
 */
import type { AffixKey } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { contentOf, type ContentKey } from '../data/content';
import { gearStatsOf, specsOf } from '../data/equipment';
import type { HeroKey } from '../data/heroes';
import { TALENT_TREES } from '../data/talents';
import { noviceHealer } from '../engine/auto';
import { restCarry } from '../engine/dungeon';
import { create, recruitParty, step } from '../engine/fight';
import { noviceAt } from '../engine/novice';
import type { Carry } from '../engine/types';
import { midGear } from './familiar';

export const CHAL_HEROES: HeroKey[] = ['priest', 'druid', 'paladin'];

export interface ChalRun { win: boolean; time: number; why: string }

/** 한 판: key 던전 보통을 내 레벨 lv로, 적 체력 · 피해 배율 mult, 어픽스 affixes */
export function chalRun(key: ContentKey, lv: number, hero: HeroKey, seed: number, mult: { hp: number; dmg: number }, affixes: AffixKey[] = []): ChalRun {
  const c = contentOf(key), d = CHAL.diff, segs = c.fights(d);
  const stageLv = Math.max(CHAL.lv, lv), eq = midGear(lv, hero, seed);
  const party = recruitParty(segs[0], seed, { abilities: true, myLv: lv, stageLv });
  const who = noviceAt(lv, seed), talents = TALENT_TREES[hero].map(t => (t.lv <= lv ? seed % 3 : null));
  let carry: Carry | undefined, time = 0;
  for (let i = 0; i < segs.length; i++) {
    const f = create({ encounter: segs[i], diff: d, seed: seed + i * 7919, hero, level: lv, heroLv: lv, stageLv, talents, party, carry,
      affixes: affixes.length ? affixes : undefined, bossMult: mult, gearStats: gearStatsOf(eq, lv), specs: specsOf(eq, hero) });
    while (!f.over && f.t < 900) { noviceHealer(f, who); step(f); f.events.length = 0; }
    time += f.t;
    if (f.over !== 'win') return { win: false, time, why: f.over ? f.reason : '시간 초과' };
    carry = restCarry(f, 10);
  }
  return { win: true, time, why: '' };
}

/** n시드 × 세 직업: 이긴 판 % · 이긴 판 시간 (가운데 · 75%) */
export function chalMeasure(key: ContentKey, lv: number, mult: { hp: number; dmg: number }, n: number, affixes: AffixKey[] = [], limit = Infinity) {
  const times: number[] = []; let win = 0, inTime = 0, tot = 0;
  for (const h of CHAL_HEROES) for (let s = 1; s <= n; s++) {
    const r = chalRun(key, lv, h, s, mult, affixes); tot++;
    if (r.win) { win++; times.push(r.time); if (r.time <= limit) inTime++; }
  }
  times.sort((a, b) => a - b);
  const q = (p: number) => (times.length ? times[Math.min(times.length - 1, Math.floor(p * times.length))] : 0);
  return { win: (100 * win) / tot, inTime: (100 * inTime) / tot, med: q(0.5), p75: q(0.75) };
}
