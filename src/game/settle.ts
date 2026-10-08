/**
 * 전투가 끝난 뒤 정산(09 S08)·보상(S09)을 계산하고 저장에 반영한다. 화면과 분리된 순수 계산 (난수는 받아서 씀).
 */
import { ALL_DIFFS, contentOf, raidSize, stageOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { HEROES, type HeroKey } from '../data/heroes';
import { clearMats, rollItem, type GearItem } from '../data/equipment';
import type { ItemKey } from '../data/items';
import type { PersName } from '../data/personalities';
import type { MeterRow } from './meter';
import { addXp, clearGold, clearXp, EXPLORE_REWARD, gradeOf, starsOf, type Grade } from '../data/progression';
import { heroSaveOf, type SaveData } from '../platform/storage';
import { advanceTutorial, TUT } from './tutorial';
import { guildAfter, type GuildAfter } from './guild';
import { bonusDiff, lootKey, meritFor, onRun, raidLootOpen, rollover } from './economy';
import { FIRST_CLEAR_CRYSTAL } from '../data/economy';
import { PUB_BONUS } from '../data/missions';
import { CHAL } from '../data/challenge';
import type { RosterEntry } from '../engine/types';
import type { AffixKey } from '../data/affixes';

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
  /** got = 내 힐로 회복한 양 (인연 스카우트), gid = 길드원 id */
  party: { nick: string; pers: PersName | null; role: string; alive: boolean; got?: number; gid?: number }[];
  /** 자세히 보기 (프로토타입 결과표) */
  detail: [string, string][];
  /** 딜미터기 (구간 전체 합) */
  meter?: MeterRow[];
  /** 쓴 소비 아이템 (가방에서 뺌, 19 11장) */
  itemsUsed?: Partial<Record<ItemKey, number>>;
  /** 적 레벨 (= 내 레벨, 32·주간 도전). 없으면 콘텐츠 기본 */
  stage?: number;
  affixes?: AffixKey[];
  /** 주간 도전 단계 · 제한시간 (초) */
  chal?: number;
  limit?: number;
  /** 광고 이어하기 횟수 (등급 최대 B) */
  cont?: number;
  /** 탱커 전멸 뒤 포기 버튼으로 끝냄 (이어하기 안 물어봄) */
  giveUp?: boolean;
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
  /** 받은 강화 재료 (12 1장) */
  mats: { stone: number; refined: number };
  /** 이 콘텐츠·난이도 첫 클리어 */
  first: boolean;
  /** 최고 기록 경신 */
  best: boolean;
  /** 직업 퀘스트 진행 (25 5-4): 그 판으로 퀘스트가 오른 직업, 다 채우면 unlocked */
  heroQuest: { hero: HeroKey; n: number; need: number; unlocked: boolean } | null;
  /** 길드원 경험치·인연 스카우트 (02 9장) */
  guild: GuildAfter | null;
  /** 레이드 공훈 (12 3-5) · 첫 클리어 크리스탈 */
  merit: number;
  crystal: number;
  /** 이번 주 이 레이드 보스·난이도 장비를 이미 받아서 장비 없음 (13 3-4) */
  lootLocked: boolean;
  /** 공개모집 일일 보너스 판 (13 2-2): 골드 ×2, 장비 등급 한 단계 위. n = 오늘 몇 번째 */
  pubBonus: number;
  /** 이 판으로 다 채운 임무 */
  missions: string[];
  /** 주간 도전 결과 (13 3-2): 제한시간 안에 깼는지, 다음 단계가 열렸는지 */
  chal: { stage: number; inTime: boolean; time: number; limit: number; opened: boolean; best: number } | null;
  /** 광고 이어하기 횟수 (등급 최대 B) */
  cont: number;
}

/** 광고로 이어 한 판은 등급 최대 B (15 4장) */
const capB = (g: Grade): Grade => (g === 'S' || g === 'A' ? 'B' : g);

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

/** roster = 전투에 넘긴 편성 (길드원 경험치·인연 스카우트). 없으면 길드 정산 안 함 */
export function settle(save: SaveData, r: BattleResult, rng: () => number, roster: RosterEntry[] = [], now = Date.now()): Settlement {
  const c = contentOf(r.content);
  // 튜토리얼이 끝난 뒤부터 재화·임무 (자동 힐러로 구경한 판은 임무에 안 셈)
  const play = save.tut >= TUT.done;
  if (play) rollover(save, now, rng);
  const p = save.player;
  const tot = r.healed + r.overheal;
  const overheal = tot ? r.overheal / tot : 0;
  const cont = r.cont || 0;
  const grade = r.win ? (cont ? capB(gradeOf(r.deaths)) : gradeOf(r.deaths)) : null;
  const stars = starsOf({ win: r.win, deaths: r.deaths, overheal });
  // 따로 잠긴 난이도(10인 악몽 Lv 50 등)는 그 레벨이 단계 (26 3장)
  // 적 레벨은 전투가 넘겨준 값 (내 레벨, 32·13 3-2)
  const raid = raidSize(c), stage = r.stage ?? stageOf(c, r.diff);
  // 공개모집 일일 보너스: 오늘 첫 3번 (이긴 판만 셈, 13 2-2)
  const pub = !roster.some(e => e.gid != null);
  const pubBonus = play && r.win && pub && (c.kind === 'dungeon' || c.kind === 'raid') && save.daily.pub < PUB_BONUS.runs ? ++save.daily.pub : 0;
  const festival = r.affixes?.includes('festival') ? CHAL.festivalGold : 1;
  // 탐험은 짧고 쉬워서 골드·경험치를 줄임 (튜토리얼이 끝난 뒤, 32 3-3)
  const kind = play && c.kind === 'explore' ? EXPLORE_REWARD : 1;
  const gold = r.win ? Math.round(clearGold(stage, r.diff, grade!, raid) * kind * (pubBonus ? PUB_BONUS.gold : 1) * festival) : 0;
  const xp = r.quit ? 0 : Math.max(r.win ? 1 : 0, Math.round(clearXp(p.level, r.diff, grade, { raid, win: r.win }) * kind));
  const levelBefore = p.level;
  p.gold += gold;
  const levelUps = addXp(p, xp);

  let item: GearItem | null = null;
  const mats = r.win ? clearMats(r.diff, raid) : { stone: 0, refined: 0 };
  // 레이드 장비는 보스마다 난이도별 주 1회 (13 3-4). 그 뒤엔 골드·공훈만
  const lootLocked = play && r.win && !!raid && !raidLootOpen(save, c.key, r.diff);
  let merit = 0;
  if (r.win) {
    if (!lootLocked) {
      item = rollItem(rng, pubBonus ? bonusDiff(r.diff) : r.diff, grade!, levelBefore, save.nextId++);
      save.gear.bag.push(item);
      if (play && raid) save.weekly.loot.push(lootKey(c.key, r.diff));
    }
    save.mats.stone += mats.stone; save.mats.refined += mats.refined;
    if (play && raid) { merit = meritFor(save, raid, r.diff); save.weekly.merit[raid] += merit; save.wallet.merit += merit; }
  }
  // 쓴 소비 아이템은 가방에서 뺌 (튜토리얼은 그대로)
  if (save.tut >= TUT.done) for (const [k, n] of Object.entries(r.itemsUsed || {}) as [ItemKey, number][]) save.bag[k] = Math.max(0, (save.bag[k] || 0) - n);

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

  const crystal = first && play ? FIRST_CLEAR_CRYSTAL : 0;
  save.wallet.crystal += crystal;

  const heroQuest = r.win ? heroWin(save, c.kind, c.key, r.diff) : null;
  const guild = roster.length && save.tut >= TUT.done ? guildAfter(save, rng, { win: r.win, quit: r.quit, grade, diff: r.diff, stage, raid, content: c.name, party: r.party, roster }) : null;

  // 주간 도전: 제한시간 안에 깨면 기록·다음 단계 (실패해도 단계 유지)
  let chal: Settlement['chal'] = null;
  if (r.chal && play) {
    const limit = r.limit ?? Infinity, inTime = r.win && !r.quit && r.time <= limit;
    const opened = inTime && r.chal >= save.chalOpen && r.chal < CHAL.max;
    if (inTime) {
      save.weekly.chalBest = Math.max(save.weekly.chalBest, r.chal);
      save.chalOpen = Math.max(save.chalOpen, Math.min(CHAL.max, r.chal + 1));
    }
    chal = { stage: r.chal, inTime, time: r.time, limit, opened, best: save.weekly.chalBest };
  }

  const tot2 = r.healed + r.overheal;
  const missions = play && !r.quit && !r.auto ? onRun(save, {
    win: r.win, dungeon: c.kind === 'dungeon' || c.kind === 'raid', raid, pub, diffIdx: ALL_DIFFS.indexOf(r.diff), deaths: r.deaths,
    overhealPct: tot2 ? Math.round((r.overheal / tot2) * 100) : 0, endManaPct: r.endMana, dispels: r.dispels,
    pers: r.party.map(p => p.pers || '').filter(Boolean), chal: chal?.inTime ? chal.stage : 0,
  }) : [];

  // 파티원 한마디는 넣지 않음 (Lim: 결과 채팅 연출 뺌)
  if (!r.quit) save.last = { content: r.content, diff: r.diff, win: r.win, grade };
  advanceTutorial(save, r.content, r.win && !r.quit);

  return {
    grade, stars, overhealPct: Math.round(overheal * 100), dispelPct: r.dispellable ? Math.round((r.dispels / r.dispellable) * 100) : null,
    gold, xp, levelBefore, levelUps, item, mats, first, best, heroQuest, guild, merit, crystal, lootLocked, pubBonus, missions, chal, cont,
  };
}
