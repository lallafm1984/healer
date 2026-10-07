/**
 * 전투가 끝난 뒤 정산(09 S08)·보상(S09)을 계산하고 저장에 반영한다. 화면과 분리된 순수 계산 (난수는 받아서 씀).
 */
import { ALL_DIFFS, contentOf, raidSize, stageOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { HEROES, type HeroKey } from '../data/heroes';
import { rollItem, type GearItem } from '../data/equipment';
import type { PersName } from '../data/personalities';
import type { MeterRow } from './meter';
import { addXp, clearGold, clearXp, gradeOf, starsOf, type Grade } from '../data/progression';
import { heroSaveOf, type SaveData } from '../platform/storage';
import { advanceTutorial, TUT } from './tutorial';

/** 전투 화면이 끝날 때 넘겨주는 결과 (던전이면 구간 전체 합) */
export interface BattleResult {
  content: ContentKey;
  diff: DiffName;
  win: boolean;
  /** 일시정지에서 포기 */
  quit: boolean;
  reason: string;
  /** 진 구간 (0부터) · 전체 구간 수 */
  segIdx: number;
  segN: number;
  /** 전투 시간 합 (휴식 뺌, 초) */
  time: number;
  restSec: number;
  deaths: number;
  healed: number;
  overheal: number;
  dispels: number;
  dispellable: number;
  endMana: number;
  minMana: number;
  auto: boolean;
  party: { nick: string; pers: PersName | null; role: string; alive: boolean }[];
  /** 자세히 보기 (프로토타입 결과표) */
  detail: [string, string][];
  /** 딜미터기 (구간 전체 합) */
  meter?: MeterRow[];
}

export interface Settlement {
  grade: Grade | null;
  stars: boolean[];
  overhealPct: number;
  dispelPct: number | null;
  gold: number;
  xp: number;
  levelBefore: number;
  levelUps: number[];
  item: GearItem | null;
  /** 이 콘텐츠·난이도 첫 클리어 */
  first: boolean;
  /** 최고 기록 경신 */
  best: boolean;
  /** 직업 퀘스트 진행 (25 5-4): 그 판으로 퀘스트가 오른 직업, 다 채우면 unlocked */
  heroQuest: { hero: HeroKey; n: number; need: number; unlocked: boolean } | null;
}

/** 이긴 판을 지금 직업 기록에 더하고 (숙련도, 25 4-3), 직업 퀘스트 조건에 맞으면 한 칸 채움. 다 채우면 해금 */
export function heroWin(save: SaveData, kind: string, content: string, diff: DiffName): Settlement['heroQuest'] {
  if (save.tut < TUT.done) return null;
  const h = save.hero, hs = heroSaveOf(save, h), q = HEROES[h].unlock.quest;
  hs.wins++;
  if (!q || hs.unlocked || kind !== 'dungeon') return null;
  if (q.content && q.content !== content) return null;
  if (q.minDiff && ALL_DIFFS.indexOf(diff) < ALL_DIFFS.indexOf(q.minDiff)) return null;
  hs.quest = Math.min(q.need, hs.quest + 1);
  if (hs.quest >= q.need) hs.unlocked = true;
  return { hero: h, n: hs.quest, need: q.need, unlocked: hs.unlocked };
}

export function settle(save: SaveData, r: BattleResult, rng: () => number): Settlement {
  const c = contentOf(r.content);
  const p = save.player;
  const tot = r.healed + r.overheal;
  const overheal = tot ? r.overheal / tot : 0;
  const grade = r.win ? gradeOf(r.deaths) : null;
  const stars = starsOf({ win: r.win, deaths: r.deaths, overheal });
  // 따로 잠긴 난이도(10인 악몽 Lv 50 등)는 그 레벨이 단계 (26 3장)
  const raid = raidSize(c), stage = stageOf(c, r.diff);
  const gold = r.win ? clearGold(stage, r.diff, grade!, raid) : 0;
  const xp = r.quit ? 0 : clearXp(p.level, stage, r.diff, grade, { raid, win: r.win });
  const levelBefore = p.level;
  p.gold += gold;
  const levelUps = addXp(p, xp);

  let item: GearItem | null = null;
  if (r.win) {
    item = rollItem(rng, r.diff, grade!, levelBefore, save.nextId++);
    save.gear.bag.push(item);
  }

  let first = false, best = false;
  if (r.win) {
    const byDiff = (save.clears[r.content] ||= {});
    const prev = byDiff[r.diff];
    const n = stars.filter(Boolean).length;
    first = !prev;
    best = !!prev && r.time < prev.best;
    byDiff[r.diff] = {
      stars: Math.max(prev?.stars ?? 0, n),
      grade: prev && 'SABC'.indexOf(prev.grade) < 'SABC'.indexOf(grade!) ? prev.grade : grade!,
      best: prev ? Math.min(prev.best, r.time) : r.time,
      n: (prev?.n ?? 0) + 1,
    };
  }

  const heroQuest = r.win ? heroWin(save, c.kind, c.key, r.diff) : null;

  // 파티원 한마디는 넣지 않음 (Lim: 결과 채팅 연출 뺌)
  if (!r.quit) save.last = { content: r.content, diff: r.diff, win: r.win, grade };
  advanceTutorial(save, r.content, r.win && !r.quit);

  return {
    grade, stars, overhealPct: Math.round(overheal * 100), dispelPct: r.dispellable ? Math.round((r.dispels / r.dispellable) * 100) : null,
    gold, xp, levelBefore, levelUps, item, first, best, heroQuest,
  };
}
