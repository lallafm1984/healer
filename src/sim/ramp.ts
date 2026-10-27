/**
 * 순차 레벨링 구간 (70) 어려움 · 악몽의 자동 밸런스 기준 플레이어 (2026-10-13 Lim 「Lv 1 어려움이 자동 힐로 안 깨짐」).
 * 권장 장비 (어려움 고급 · 악몽 희귀 × 1.4, 6부위)와 적 레벨로 재면 녹슨 고원 어려움이 80%인데, 실제로 어려움이 열린 Lv 3 플레이어는
 * 장비가 1~2개 (거의 일반)뿐이고 치유의 기원 · 특성도 아직 없어 3%였음. 그래서 장소 Lv RAMP_LV까지는
 * 「그 난이도가 처음 열린 플레이어」로 잼: 튜토리얼 뒤 장소를 레벨 순으로 길 (rampDiffs: 장소 Lv 1~9 쉬움 → 보통, 10~20 쉬움 → 보통 → 어려움, 70 · 90 ·
 * 2026-10-20 악몽을 길에서 뺌)대로 깨며 받은 장비를 부위마다 점수 높은 것으로 끼고, 어려움은 그 장소 보통을 깬 뒤, 악몽은 그 장소 어려움을 깬 뒤의 레벨 · 장비
 * (장소 Lv 1~9는 어려움이 길에 없어서 한 번 더 깬 셈, 10~20은 길 끝). 장비는 시드마다 드롭 굴림 (A 등급, 아이템 레벨 = 그 판 적 레벨), 강화 없음
 */
import { CONTENT, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { itemScore, rollItem, type Equipped } from '../data/equipment';
import type { HeroKey } from '../data/heroes';
import { addXp, rampDiffs, rampFour, rampMain, rampPlace, rampXp, xpToNext } from '../data/progression';
import { rngFrom } from '../engine/rng';

/** 이 기준을 쓰는 칸: 장소 Lv RAMP_LV까지의 탐험 · 던전 어려움 · 악몽 */
export const usesRamp = (c: ContentDef, d: DiffName) => rampPlace(c) && (d === '어려움' || d === '악몽');

/** 구간 장소 (레벨 순) */
const rampPlaces = () => CONTENT.filter(c => rampMain(c) && c.ready).sort((a, b) => a.stageLv - b.stageLv);

export interface RampPlayer { lv: number; eq: Equipped }
type Flow = Map<ContentKey, Partial<Record<DiffName, RampPlayer>>>;
const flows = new Map<string, Flow>();

/** 직업 · 시드 하나의 흐름 (장소마다 어려움 · 악몽이 열린 때의 레벨 · 장비) */
function flowOf(hero: HeroKey, seed: number): Flow {
  const key = `${hero}:${seed}`;
  let out = flows.get(key);
  if (out) return out;
  out = new Map();
  const r = rngFrom(Math.imul(seed, 2654435761) ^ 0x5bd1e995);
  const p = { level: 1, xp: 0 }, eq: Equipped = {};
  let id = 1;
  /** 한 판 이김: 장비 1개 (클리어마다 1개, 2026-10-13) + 첫 클리어 경험치 */
  const win = (c: ContentDef, d: DiffName, gear: Equipped, pl: { level: number; xp: number }) => {
    const it = rollItem(r, d, 'A', pl.level, id++, { hero, classLoot: true, place: c.key, lv: stageOf(c, d), tierLv: c.stageLv }); // 정산 드롭과 같게 (직업 전용 70%, 72)
    if (itemScore(it, pl.level) > itemScore(gear[it.slot], pl.level)) gear[it.slot] = it;
    addXp(pl, rampXp(c, d, { first: true, grade: 'A', win: true }));
  };
  addXp(p, xpToNext(1)); // 튜토리얼 첫 전투 → Lv 2, 장비 없음 (screens/tutorial)
  for (const c of rampPlaces()) {
    const at: Partial<Record<DiffName, RampPlayer>> = {};
    for (const d of rampDiffs(c)) {
      at[d] = { lv: p.level, eq: { ...eq } }; // 길의 칸에 처음 들어갈 때 (쉬움 · 보통은 초보 검사 sim/novice가 씀)
      win(c, d, eq, p);
    }
    if (rampFour(c)) at['악몽'] = { lv: p.level, eq: { ...eq } }; // 길 끝 (어려움을 깬 뒤)
    else {
      // 장소 Lv 1~9: 어려움은 길에 없음 → 보통 뒤 그대로, 악몽은 어려움을 한 번 더 깬 셈 (길은 그대로 이어감)
      at['어려움'] = { lv: p.level, eq: { ...eq } };
      const eq2 = { ...eq }, p2 = { ...p };
      win(c, '어려움', eq2, p2);
      at['악몽'] = { lv: p2.level, eq: eq2 };
    }
    out.set(c.key, at);
  }
  flows.set(key, out);
  return out;
}

/** 그 칸의 기준 플레이어 (어려움 · 악몽 = 자동 밸런스 usesRamp, 쉬움 · 보통 = 그 칸에 처음 들어갈 때 · 초보 검사 sim/novice) */
export function rampPlayer(c: ContentDef, d: DiffName, hero: HeroKey, seed: number): RampPlayer {
  const p = flowOf(hero, seed).get(c.anchor ?? c.key)?.[d]; // 보충 장소 (113) = 원본 칸에 들어가는 사람 (원본을 다시 돌 차례)
  if (!p) throw new Error(`순차 레벨링 기준 없음: ${c.key} ${d}`);
  return p;
}

/** 그 칸의 기준 레벨 (시드와 상관없음: 첫 클리어 경험치는 정한 양) */
export const rampLevel = (c: ContentDef, d: DiffName) => rampPlayer(c, d, 'priest', 1).lv;
