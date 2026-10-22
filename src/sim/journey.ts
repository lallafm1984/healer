/**
 * 길잡이 길 플레이어 (2026-10-22 Lim 「20레벨 이후는 장비를 감안해서 고치자」): 새 저장 (튜토리얼 끝)으로 길잡이 1순위 칸 (game/guide)을 늘 이기며 Lv 100까지.
 * 판마다 게임 정산 (game/settle: 경험치 · 휴식 보너스 · 골드 · 장비 드롭, 탐험 판마다 50% · 직업 전용 70%)을 그대로 쓰고, 부위마다 장비 점수가 높은 것을 낀다.
 * 레벨마다 그 레벨이 처음 됐을 때 낀 장비를 남김 (gearAt). 길잡이는 탐험 · 던전만 추천하고 레이드 · 주간 도전 · 행상인은 안 함 → 실제보다 장비가 조금 모자란 쪽.
 * 휴식은 늘 있다고 봄 (하루 1.5시간이면 거의 모든 판에 휴식 보너스, 90 1-3). sim/familiar · 자동 밸런스 초보 하한이 Lv 21 뒤 칸의 장비로 씀
 */
import { contentOf } from '../data/content';
import { itemScore, type Equipped } from '../data/equipment';
import type { HeroKey } from '../data/heroes';
import { guide } from '../game/guide';
import { runMode } from '../game/runmode';
import { settle, type BattleResult } from '../game/settle';
import { equip, G } from '../game/state';
import { TUT } from '../game/tutorial';
import { rngFrom } from '../engine/rng';
import { newSave, type SaveData } from '../platform/storage';

/** 길 판 하나의 시간 (초, 다음 날로 넘어가며 주간 · 일일이 돌게): 전투 + 준비 */
const RUN_SEC = 300;
/** 판 수 끝 (막히면 멈춤) */
const MAX_RUNS = 4000;

/** 레벨 → 그 레벨이 처음 됐을 때 낀 장비 */
export type Journey = Map<number, Equipped>;
const memo = new Map<string, Journey>();

/** 직업 · 길 시드 하나의 여정 (같은 값이면 같은 결과, 한 번만 셈) */
export function journey(hero: HeroKey, seed: number, maxLv = 100): Journey {
  const key = `${hero}:${seed}:${maxLv}`;
  let out = memo.get(key);
  if (out) return out;
  out = new Map();
  const keep = G.save, rng = rngFrom(Math.imul(seed >>> 0, 0x6c8e9cf5) ^ 0x1b873593);
  let now = new Date(2026, 9, 19, 8, 0, 0).getTime(); // 월요일 아침
  const save: SaveData = newSave(now);
  save.tut = TUT.done; save.settings.devUnlock = false; save.settings.devStamina = true;
  G.save = save;
  try {
    out.set(save.player.level, {});
    for (let i = 0; i < MAX_RUNS && save.player.level < maxLv; i++) {
      const st = guide();
      if (!st) break;
      const c = contentOf(st.content), lv0 = save.player.level;
      const r = {
        hero, content: c.key, diff: st.diff, win: true, quit: false, reason: '', segIdx: c.fights(st.diff).length - 1, segN: c.fights(st.diff).length,
        time: RUN_SEC - 30, restSec: 0, deaths: 0, healed: 1000, overheal: 100, dispels: 0, dispellable: 0, endMana: 40, minMana: 20, auto: false,
        party: [], detail: [], stage: runMode(save, c, st.diff, { chal: 0 }, now).stage,
      } as BattleResult;
      settle(save, r, rng, [], now);
      now += RUN_SEC * 1000;
      equipBest(save);
      save.gear.bag = [];
      for (let l = lv0 + 1; l <= save.player.level; l++) out.set(l, { ...save.gear.equipped });
    }
  } finally { G.save = keep; }
  memo.set(key, out);
  return out;
}

/** 가방에서 부위마다 점수가 더 높은 장비를 낌 (예전 state.equipBest, #324에서 지움) */
function equipBest(save: SaveData): void {
  const lv = save.player.level;
  for (const it of [...save.gear.bag].sort((a, b) => itemScore(b, lv) - itemScore(a, lv))) {
    const cur = save.gear.equipped[it.slot];
    if (!cur || itemScore(it, lv) > itemScore(cur, lv)) equip(it.id);
  }
}

/** 그 레벨의 장비 (여정이 거기까지 못 갔으면 마지막 레벨 것) */
export function gearAt(j: Journey, lv: number): Equipped {
  for (let l = Math.min(lv, 100); l >= 1; l--) { const e = j.get(l); if (e) return e; }
  return {};
}
