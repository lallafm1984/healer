/**
 * 전투가 끝난 뒤 정산(09 S08)·보상(S09)을 계산하고 저장에 반영한다. 화면과 분리된 순수 계산 (난수는 받아서 씀).
 */
import { ALL_DIFFS, contentOf, raidSize, stageOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { HeroKey } from '../data/heroes';
import { rollItem, type GearItem } from '../data/equipment';
import type { PersName } from '../data/personalities';
import type { MeterRow } from './meter';
import { addXp, clearGold, clearXp, EXPLORE_REWARD, gradeOf, inRamp, rampXp, restRun, starsOf, type Grade } from '../data/progression';
import { heroSaveOf, noteDex, noteSpecs, type SaveData } from '../platform/storage';
import { advanceTutorial, TUT } from './tutorial';
import { foundGuild, guildAfter, isGuildParty, storyArrive, type GuildAfter } from './guild';
import { jobsAfter, type JobsDone } from './guildjobs';
import type { StoryKey } from '../data/guild';
import { lootKey, meritFor, onRun, raidLootOpen, rollover } from './economy';
import { FEATURES } from '../data/features';
import { PUB_BONUS } from '../data/missions';
import { CHAL, chalDropDiff } from '../data/challenge';
import type { RosterEntry } from '../engine/types';
import type { AffixKey } from '../data/affixes';
import { restBase, restGain, staminaCost, useRest, type RestUse } from './stamina';

/** 전투 화면이 끝날 때 넘겨주는 결과 (던전이면 구간 전체 합) */
export interface BattleResult {
  /** 출전 직업. 정산 시 화면에서 선택한 직업에 영향을 받지 않는다. 옛 결과는 저장 직업 사용 */
  hero?: HeroKey;
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
  /** 파티원의 전투 결과와 성장에 반영할 행동 기록. */
  party: { nick: string; pers: PersName | null; role: string; alive: boolean; got?: number; gid?: number; low?: number; deed?: import('../data/guild').Deed }[];
  /** 전투 기록에 보이는 줄 (마지막 전투) */
  detail: [string, string][];
  /** 플레이 테스트 기록 (탭 · 오탭 · 쓸기 등): 레벨 잠금 무시(개발 빌드)를 켰을 때만 보여 줌 */
  dev?: [string, string][];
  /** 구간 이름 (던전 진행 점) · 진 구간 적 남은 체력 % (잡몹 구간이면 mobs) */
  segNames?: string[];
  left?: { pct: number; mobs: boolean };
  /** 딜미터기 (구간 전체 합) */
  meter?: MeterRow[];
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
  xp: number;
  levelBefore: number;
  levelUps: number[];
  /** 받은 장비 (34 6-7): 클리어마다 1개 (탐험 · 던전 · 레이드 모두, 2026-10-13 Lim) */
  items: GearItem[];
  /** 그 장비로 처음 얻은 특수능력 · 이름 있는 장신구 키 (결과 화면 「새 특수능력!」, 42 1-6) */
  newSpecs: string[];
  /** 그 장비로 처음 채운 장비 도감 칸 (34 6-10 ④, 결과 화면 「장비 도감 +n」) */
  newDex: string[];
  /** 받은 골드 (12 3-1 클리어 골드, 91에서 되살림. 휴식이 있으면 휴식 보너스 포함, 없으면 기본 보상) */
  gold: number;
  /** 이 콘텐츠·난이도 첫 클리어 */
  first: boolean;
  /** 최고 기록 경신 */
  best: boolean;
  /** 직업 퀘스트 진행 (25 5-4): 그 판으로 퀘스트가 오른 직업, 다 채우면 unlocked */
  heroQuest: { hero: HeroKey; n: number; need: number; unlocked: boolean } | null;
  /** 길드원 경험치 · 능력치 · 명성 (93 · 97) */
  guild: GuildAfter | null;
  /** 길드 결성 (93 4-1): 이 판 뒤 원정대가 생김 (창단 멤버 닉네임) */
  founded: string[] | null;
  /** 스토리 동료 합류 (93 4-4): 들어옴 · 정원이 차서 기다림 */
  story: { key: StoryKey; how: 'joined' | 'wait' } | null;
  /** 부탁 쪽지 · 주간 원정 (93 8장) */
  jobs: JobsDone | null;
  /** 레이드 공훈 (12 3-5) */
  merit: number;
  /** 이번 주 이 레이드 보스·난이도 장비를 이미 받아서 장비 없음 (13 3-4) */
  lootLocked: boolean;
  /** 공개모집 일일 보너스 판 (13 2-2): 좋은 장비 등급 확률 ↑ (그 난이도 상한 안에서, 61 3-3). n = 오늘 몇 번째 */
  pubBonus: number;
  /** 이 판으로 다 채운 임무 */
  missions: string[];
  /** 주간 도전 결과 (13 3-2): 제한시간 안에 깼는지, 다음 단계가 열렸는지 */
  chal: { stage: number; inTime: boolean; time: number; limit: number; opened: boolean; best: number } | null;
  /** 광고 이어하기 횟수 (등급 최대 B) */
  cont: number;
  /** 이 판으로 튜토리얼이 끝남 (녹슨 고원 탐험 클리어, 34 5-2) */
  tutEnd: boolean;
  /** 휴식 (90): 클리어한 판만. used = 쓴 휴식, share = 받은 휴식 보너스 몫 (비례, 0이면 기본 보상). 튜토리얼 · 진 판 · 포기는 null */
  rest: RestUse | null;
  /** 휴식 보너스 몫 (xp · gold에 들어 있음, 결과 화면 기본 → 「휴식 보너스!」 + N). 휴식 보너스를 안 받은 판은 null */
  restBonus: { xp: number; gold: number } | null;
}

/** 광고로 이어 한 판은 등급 최대 B (15 4장) */
const capB = (g: Grade): Grade => (g === 'S' || g === 'A' ? 'B' : g);

/** 이긴 판을 지금 직업 기록에 더하고 (숙련도, 25 4-3), 직업 퀘스트 조건에 맞으면 한 칸 채움. 다 채우면 해금 */
export function heroWin(save: SaveData, _kind: string, _content: string, _diff: DiffName, h: HeroKey = save.hero): Settlement['heroQuest'] {
  if (save.tut < TUT.done) return null;
  heroSaveOf(save, h).wins++;
  return null;
}

/** roster = 전투에 넘긴 편성 (길드원 경험치 · 능력치). 길드원이 없으면 길드 정산 안 함 */
export function settle(save: SaveData, r: BattleResult, rng: () => number, roster: RosterEntry[] = [], now = Date.now()): Settlement {
  const c = contentOf(r.content);
  const hero = r.hero ?? save.hero;
  // 튜토리얼이 끝난 뒤부터 재화·임무 (자동 힐러로 구경한 판은 임무에 안 셈)
  const play = save.tut >= TUT.done;
  if (play) rollover(save, now, rng);
  const p = save.player;
  const tot = r.healed + r.overheal;
  const overheal = tot ? r.overheal / tot : 0;
  const cont = r.cont || 0;
  const grade = r.win ? (cont ? capB(gradeOf(r.deaths)) : gradeOf(r.deaths)) : null;
  const stars = starsOf({ win: r.win, deaths: r.deaths, overheal });
  // 따로 잠긴 난이도(10인 악몽 = 열림 + 15 등)는 그 레벨이 단계 (26 3장)
  // 적 레벨은 전투가 넘겨준 값 (내 레벨, 32·13 3-2)
  const raid = raidSize(c), stage = r.stage ?? stageOf(c, r.diff);
  // 공개모집 일일 보너스: 오늘 첫 3번 (이긴 판만 셈, 13 2-2)
  const pub = !isGuildParty(roster);
  const pubBonus = play && r.win && pub && (c.kind === 'dungeon' || c.kind === 'raid') && save.daily.pub < PUB_BONUS.runs ? ++save.daily.pub : 0;
  // 축제 주간 (주간 도전 어픽스): 경험치 +20% (v16, 예전 골드 +20%)
  const festival = r.affixes?.includes('festival') ? CHAL.festivalXp : 1;
  // 탐험은 짧고 쉬워서 골드 · 경험치를 줄임 (튜토리얼이 끝난 뒤, 32 3-3)
  const kind = play && c.kind === 'explore' ? EXPLORE_REWARD : 1;
  // 따라잡기·장소 레벨 차이 보정 없음. 경험치는 직업 레벨·난이도·등급·콘텐츠 배율로만 정함.
  // Lv 20까지는 장소 Lv 20까지의 탐험 · 던전이 장소가 정한 경험치 (70): 쉬움 · 보통을 처음 깨면 다음 장소 레벨 (주간 도전은 빼고)
  // 진 판 (전멸 · 포기)은 경험치 없음 (2026-10-13 Lim)
  // 휴식 (90): 클리어하면 콘텐츠 몫만큼 쓰고 경험치 · 골드에 휴식 보너스 (모자라면 있는 만큼 쓰고 보너스도 그만큼, 비례). 0이면 기본 보상
  // (= 휴식 판의 1/REST_BONUS, 장비 · 공훈 · 임무 · 상자는 휴식과 상관없음). 휴식 판 = 예전 값 × REST_RUN_SCALE (restRun, 2026-10-17 Lim:
  // 기본 = 예전 휴식 판 1/3, 휴식 보너스 ×2, Lv 1부터 장소 경험치 · 골드도). 튜토리얼 판 (휴식을 안 씀)은 예전 값 그대로, 꼬리표 없음
  const rest = play && r.win && !r.quit ? useRest(save, staminaCost(c, r.chal), now) : null;
  const run = (n: number) => (play ? restRun(n) : n > 0 ? Math.max(1, Math.round(n)) : 0);
  const xp0 = !r.win || r.quit ? 0
    : run(!r.chal && inRamp(c, p.level) ? rampXp(c, r.diff, { first: !save.clears[r.content]?.[r.diff], grade, win: r.win })
      : clearXp(p.level, r.diff, grade, { raid, win: r.win }) * kind * festival);
  // 클리어 골드 (12 3-1, 91에서 되살림): 이 판 적 레벨 · 난이도 · 등급 · 레이드 배율, 탐험 × EXPLORE_REWARD
  const gold0 = r.win ? run(clearGold(stage, r.diff, grade!, raid) * kind) : 0;
  const share = rest ? rest.share : 1;
  const xp = restGain(xp0, share), gold = restGain(gold0, share);
  const restBonus = rest && rest.share > 0 && (xp > restBase(xp0) || gold > restBase(gold0)) ? { xp: xp - restBase(xp0), gold: gold - restBase(gold0) } : null;
  const levelBefore = p.level;
  p.gold += gold;
  const levelUps = addXp(p, xp);

  const items: GearItem[] = [];
  let newSpecs: string[] = [], newDex: string[] = [];
  // 레이드 장비는 보스마다 난이도별 주 1회 (13 3-4). 그 뒤엔 골드·공훈만
  const lootLocked = play && r.win && !!raid && !raidLootOpen(save, c.key, r.diff);
  let merit = 0;
  if (r.win) {
    if (!lootLocked) {
      // 클리어마다 1개 (탐험 · 던전 · 레이드 모두, 2026-10-13 Lim 「클리어시 장비는 무조건 한개」. 예전 던전은 보스마다 1개).
      // 등급은 콘텐츠 · 난이도 바탕 표 (일반 ~ 희귀) + 영웅 · 전설 확률 (88, equipment dropOdds). 주간 도전은 단계 표 (chalDropDiff: 1~9 보통 · 10~14 어려움 · 15~ 악몽).
      // 등급대 · 영웅 확률 레벨 (86 · 88): 탐험 · 던전은 장소 레벨, 레이드는 그 판 적 레벨, 주간 도전은 내 레벨. 전설은 내 레벨 100부터 20인만.
      // 직업 전용 특수능력은 지금 직업 것만, 장소마다 자주 나오는 특수능력 · 이름 있는 장신구 (42 1-4 · 3장). 아이템 레벨 = 이 판 적 레벨 (2026-10-13)
      // 2026-10-19 Lim 「70레벨의 20인 레이드 클리어시 100레벨 영웅장비가 나왔다. 던전 레벨에 맞는 장비」: 레이드 적은 내 레벨까지 오르지만 (runmode) 장비 레벨 · 등급대는 그 레이드 레벨 (stageOf). 주간 도전은 내 레벨 그대로
      const dropLv = r.chal ? stage : stageOf(c, r.diff);
      items.push(rollItem(rng, r.chal ? chalDropDiff(r.chal) : r.diff, grade!, levelBefore, save.nextId++, { hero, classLoot: true, place: c.key, raid, bonus: !!pubBonus, lv: dropLv, tierLv: r.chal ? levelBefore : raid ? dropLv : c.stageLv }));
      save.gear.bag.push(...items);
      newDex = noteDex(save, items);
      newSpecs = noteSpecs(save, items);
      if (play && raid) save.weekly.loot.push(lootKey(save.hero, c.key, r.diff));
    }
    if (play && raid) { merit = meritFor(save, raid, r.diff); save.weekly.merit[raid] += merit; save.wallet.merit += merit; }
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

  const heroQuest = r.win ? heroWin(save, c.kind, c.key, r.diff, hero) : null;
  // 길드 v2 (93 · 97): 결성 (Lv 15 · 튜토리얼 뒤 첫 판), 판 뒤 길드원 경험치 · 능력치 · 명성 · 첫 처치
  const founded = FEATURES.guild && play ? foundGuild(save) : null;
  // 업데이트 묶음 (93 4-4 · 6-3 · 8장): 첫 10 · 20인 레이드 = 이슬 · 칼날, 부탁 쪽지 · 주간 원정
  const sz = raidSize(c), story = FEATURES.guild && play && r.win && !r.quit && c.kind === 'raid' ? (sz === 10 ? storyArrive(save, 'isle') : sz === 20 ? storyArrive(save, 'blade') : null) : null;
  const storyKey: StoryKey | null = story ? (sz === 10 ? 'isle' : 'blade') : null;
  const jobs = FEATURES.guild && play ? jobsAfter(save, { win: r.win, quit: r.quit, content: c.key, diff: r.diff, roster }) : null;
  const guild = FEATURES.guild && play && roster.some(e => e.gid != null) ? guildAfter(save, rng, { win: r.win, quit: r.quit, grade, diff: r.diff, stage, raid, content: c.key, kind: c.kind, party: r.party, roster, encs: c.fights(r.diff), time: r.time, requestNicks: jobs?.reqs }) : null;

  // 주간 도전: 제한시간 안에 깨면 기록·다음 단계 (실패해도 단계 유지)
  let chal: Settlement['chal'] = null;
  if (r.chal && play) {
    const limit = r.limit ?? Infinity, inTime = r.win && !r.quit && r.time <= limit;
    const opened = inTime && r.chal >= save.chalOpen && r.chal < CHAL.max;
    if (inTime) {
      if (r.chal > save.weekly.chalBest) save.weekly.chalHero = hero; // 월요일 상자의 전용 효과 직업
      save.weekly.chalBest = Math.max(save.weekly.chalBest, r.chal);
      save.chalOpen = Math.max(save.chalOpen, Math.min(CHAL.max, r.chal + 1));
    }
    chal = { stage: r.chal, inTime, time: r.time, limit, opened, best: save.weekly.chalBest };
  }

  const tot2 = r.healed + r.overheal;
  const missions = play && !r.quit && !r.auto ? onRun(save, {
    win: r.win, dungeon: c.kind === 'dungeon' || c.kind === 'raid', explore: c.kind === 'explore', raid, pub, diffIdx: ALL_DIFFS.indexOf(r.diff), deaths: r.deaths,
    overhealPct: tot2 ? Math.round((r.overheal / tot2) * 100) : 0, endManaPct: r.endMana, dispels: r.dispels,
    pers: r.party.map(p => p.pers || '').filter(Boolean), chal: chal?.inTime ? chal.stage : 0,
  }) : [];

  // 파티원 한마디는 넣지 않음 (Lim: 결과 채팅 연출 뺌)
  if (!r.quit) save.last = { content: r.content, diff: r.diff, win: r.win, grade };
  const tutEnd = advanceTutorial(save, r.content, r.win && !r.quit);
  // 튜토리얼 끝 첫 장비는 빈 칸에 바로 장착 (2026-10-13 Lim: 결과 화면 「장착」 버튼 뺌)
  if (tutEnd) for (const it of items) {
    if (save.gear.equipped[it.slot]) continue;
    save.gear.bag = save.gear.bag.filter(b => b.id !== it.id);
    save.gear.equipped[it.slot] = it;
  }

  return {
    grade, stars, overhealPct: Math.round(overheal * 100), dispelPct: r.dispellable ? Math.round((r.dispels / r.dispellable) * 100) : null,
    xp, levelBefore, levelUps, items, newSpecs, newDex, gold, first, best, heroQuest, guild, merit, lootLocked, pubBonus, missions, chal, cont, tutEnd, rest, restBonus, founded, story: storyKey && story ? { key: storyKey, how: story } : null, jobs,
  };
}
