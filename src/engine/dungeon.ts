import { DUNGEONS, REST_MANA_PER_SEC, type DungeonKey } from '../data/dungeons';
import { autoHealer } from './auto';
import { create, recruitParty, step } from './fight';
import { sv } from './specials';
import type { Carry, Fight, FightConfig } from './types';

/** 휴식 뒤 다음 구간으로 넘길 것 (23 4장): 마나는 쉰 만큼 회복, 성언 게이지는 그대로 */
export function restCarry(f: Fight, restSec: number): Carry {
  return { mana: Math.min(100, f.mana + REST_MANA_PER_SEC * restSec * (1 + sv(f, 'restTea'))), g: { ...f.g } }; // 휴식의 차 (42 마나 06)
}

export interface DungeonRunConfig extends Omit<FightConfig, 'encounter' | 'carry'> {
  dungeon: DungeonKey;
}

/** 구간 설정. 파티는 첫 구간에서 한 번 뽑아 끝까지 같은 사람들 */
export function segmentConfig(run: DungeonRunConfig, index: number, carry?: Carry): FightConfig {
  const segs = DUNGEONS[run.dungeon].segments;
  const { dungeon: _d, ...rest } = run;
  return { ...rest, encounter: segs[index], party: run.party || recruitParty(segs[0], run.seed || 1), seed: (run.seed || 1) + index * 7919, carry };
}

export interface DungeonResult {
  win: boolean;
  /** 구간별 결과 (진 구간까지) */
  fights: Fight[];
  time: number;
}

/** 자동 힐러로 던전 끝까지 (시뮬레이션용). restSec = 휴식마다 쉬는 시간 */
export function simulateDungeon(run: DungeonRunConfig, restSec = 10, maxT = 700): DungeonResult {
  const segs = DUNGEONS[run.dungeon].segments;
  const fights: Fight[] = [];
  let carry: Carry | undefined;
  for (let i = 0; i < segs.length; i++) {
    const f = create(segmentConfig(run, i, carry));
    while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
    fights.push(f);
    if (f.over !== 'win') break;
    carry = restCarry(f, restSec);
  }
  const win = fights.length === segs.length && fights[fights.length - 1].over === 'win';
  return { win, fights, time: fights.reduce((s, f) => s + f.t, 0) };
}
