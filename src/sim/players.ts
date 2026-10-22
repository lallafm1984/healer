/**
 * 가상 사용자 QA (2026-10-22 Lim 「처음 사용자 및 신규 사용자 입장에서의 시뮬레이션 qa 테스터를 만들어보자. 설치하고 초반부터 100레벨까지」).
 * 새 저장에서 튜토리얼 두 판부터 Lv 100까지, 타입마다 정한 하루 접속 시간만큼 판을 하는 가상 사용자 (PLAYER_TYPES).
 * - 판마다 실제 전투 엔진으로 싸운다 (지기도 함). 누르는 손은 초보 검사의 사람 모델 (engine/novice noviceAt: 처음 → 익숙 → 능숙)을
 *   타입마다 익는 레벨 (hand)로 늘이거나 줄여 씀. 편성은 게임 party.ts와 같음 (공개모집 · 길드파티), 특성은 열리는 대로 찍음.
 * - 정산 · 휴식 보너스 · 장비 드롭 · 임무 · 일일 상자 · 주간 도전 · 월요일 상자 · 행상인 · 길드 (결성 · 모집 공고 · 원정 · 부탁)는 게임 코드를 그대로 부름.
 * - 어디로 가나는 길잡이 1순위 (game/guide), 또는 제멋대로 (열린 칸 가운데 적 레벨이 가장 높은 곳). 같은 칸을 몇 번 지면 그날은 그 칸을 빼고 다음 칸.
 * 기록 (판 · 날)은 sim/players-signals가 이상 신호 (막힘 · 너무 쉬움 · 골드 · 장비 · 흐름)로 읽는다. 명령줄은 scripts/sim-players.ts (npm run sim:players)
 */
import { CHAL } from '../data/challenge';
import { ALL_DIFFS, CONTENT, contentOf, isLeveling, raidSize, RAID10_LV, RAID20_LV, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ENCOUNTERS } from '../data/encounters';
import { avgScore, gearStatsOf, itemScore, recommendedFor, SLOTS, specsOf, type ItemGrade } from '../data/equipment';
import { MERCHANT } from '../data/economy';
import { FEATURES } from '../data/features';
import { guildLvOf, hireGold } from '../data/guild';
import { HEROES, type HeroKey } from '../data/heroes';
import { addXp, MAX_LEVEL, xpToNext } from '../data/progression';
import { SKILLS } from '../data/skills';
import { TALENT_TREES } from '../data/talents';
import { noviceHealer } from '../engine/auto';
import { restCarry } from '../engine/dungeon';
import { create, recruitParty, step } from '../engine/fight';
import { noviceAt, noviceOf, type NoviceOpts } from '../engine/novice';
import { rngFrom } from '../engine/rng';
import type { Carry, Fight, RosterEntry } from '../engine/types';
import { chestState, claimChalChest, claimChest, claimExped, claimGuildGoal, claimMission, missionReady } from '../game/economy';
import { fitNow, rankStages, guideCtx, realOpen, type Fit } from '../game/guide';
import { capOf, full, guildPartyFits, guildRoster, hire, recruitExclude, refreshPost } from '../game/guild';
import { recommendPick } from '../game/recommend';
import { refreshExped, refreshReqs } from '../game/guildjobs';
import { buyUnknown, merchantGold } from '../game/merchant';
import { runMode } from '../game/runmode';
import { settle, type BattleResult } from '../game/settle';
import { adCharge, syncStamina } from '../game/stamina';
import { equip, G, sell, switchHero } from '../game/state';
import { DUO_PARTY, TUT } from '../game/tutorial';
import { deedOf } from '../data/guild';
import { heroSaveOf, newSave, type SaveData } from '../platform/storage';

/** 가상 사용자 타입 */
export interface PlayerType {
  key: string;
  name: string;
  /** 한 줄 설명 (보고서) */
  note: string;
  /** 손이 익는 내 레벨: [처음 하는 사람이 끝나는 레벨, 익숙해지는 레벨, 능숙해지는 레벨] (기본 사람 = 10 · 20 · 60, engine/novice) */
  hand: [number, number, number];
  /** 하루 접속: [시작 시각 (시), 분] */
  sessions: [number, number][];
  /** 하루 광고 휴식 충전 (휴식이 30 밑일 때) */
  ads: number;
  /** 어디로 가나: 길잡이 1순위 · 제멋대로 (열린 칸 가운데 적 레벨이 가장 높은 곳, 악몽 포함) */
  route: 'guide' | 'greedy';
  /** 장비: 부위마다 가장 좋은 것 · 새 장비가 더 좋을 때만 바꿈 · 가방이 lazyBag개 차야 한 번 정리 · 안 바꿈 (튜토리얼 끝 장비 그대로, 장비 차이를 보는 기준) */
  gear: 'best' | 'peek' | 'lazy' | 'none';
  /** 남는 장비를 팜 (정리할 때) */
  sell: boolean;
  /** 임무 · 일일 상자 보상을 받음 */
  missions: boolean;
  /** 주간 도전 (Lv 20부터, 주마다 깨지는 데까지) */
  chal: boolean;
  /** 행상인: 안 씀 · 골드가 값의 3배 넘으면 · 값만큼 있으면 다 */
  merchant: 'none' | 'spare' | 'all';
  /** 길드 (Lv 15 결성, 모집 공고로 채움, 길드파티 · 원정) */
  guild: boolean;
  /** 레이드 주 첫 판 (열린 레이드 칸 가운데 적합도가 도전 · 위험이 아닌 것) */
  raids: boolean;
  /** 직업 바꾸기: 그 레벨이 되면 그 직업으로 */
  jobs: { lv: number; hero: HeroKey }[];
}

/** 직업을 바꾼 뒤 손이 다시 서툰 판 수 (손 레벨 −10에서 시작해 이만큼 판을 하면 원래대로) */
export const RELEARN_RUNS = 20;
/** 지면 다시 하는 횟수: 같은 칸을 연달아 이만큼 지면 그날은 그 칸을 빼고 다음 칸 (제멋대로는 2) */
export const GIVE_UP = { guide: 3, greedy: 2 };
/** 판 하나의 준비 · 결과 화면 시간 (초): 편성 · 출발 · 결과 · 장비 확인 */
export const RUN_OVERHEAD = 45;
/** 던전 구간 사이 휴식 (초, sim/balance와 같음) · 한 구간 끝 (광폭화까지) */
const REST = 10, MAX_T = 700 * 1.25;
/** 장비 귀찮음: 가방이 이만큼 차면 한 번 정리 */
const LAZY_BAG = 10;
/** 끝 날 (막혀서 Lv 100을 못 가면 여기서 멈춤) */
export const MAX_DAYS = 400;

const H = (h: number, m: number): [number, number] => [h, m];
export const PLAYER_TYPES: PlayerType[] = [
  { key: 'casual', name: '가벼운 사람', note: '하루 30분, 손이 느리게 익음 (Lv 30에 익숙), 길잡이대로, 새 장비가 더 좋을 때만 바꾸고 팔지 않음, 임무 보상만',
    hand: [20, 30, 90], sessions: [H(21, 30)], ads: 0, route: 'guide', gear: 'peek', sell: false, missions: true, chal: false, merchant: 'none', guild: false, raids: false, jobs: [] },
  { key: 'normal', name: '보통 사람', note: '하루 1.5시간 (점심 30분 · 저녁 1시간), 기본 손 (Lv 10 → 20 → 60), 길잡이대로, 가장 좋은 장비 · 판매, 임무 · 상자 · 주간 도전 · 행상인 · 길드',
    hand: [10, 20, 60], sessions: [H(12, 30), H(20, 60)], ads: 0, route: 'guide', gear: 'best', sell: true, missions: true, chal: true, merchant: 'spare', guild: true, raids: false, jobs: [] },
  { key: 'hardcore', name: '열심인 사람', note: '하루 5시간 · 광고 휴식 3번, 손이 빨리 익음 (Lv 15에 익숙), 길잡이 + 레이드 주 첫 판, 전부 하고 골드는 행상인에 다 씀',
    hand: [8, 15, 40], sessions: [H(9, 60), H(13, 90), H(20, 150)], ads: 3, route: 'guide', gear: 'best', sell: true, missions: true, chal: true, merchant: 'all', guild: true, raids: true, jobs: [] },
  { key: 'greedy', name: '제멋대로', note: '하루 1.5시간, 기본 손, 길잡이를 안 보고 열린 칸 가운데 가장 높은 곳 (악몽 포함), 두 번 지면 그 칸을 빼고 다음, 가장 좋은 장비 · 판매, 임무',
    hand: [10, 20, 60], sessions: [H(12, 30), H(20, 60)], ads: 0, route: 'greedy', gear: 'best', sell: true, missions: true, chal: false, merchant: 'none', guild: false, raids: false, jobs: [] },
  { key: 'lazy', name: '장비 귀찮음', note: `하루 1.5시간, 기본 손, 길잡이대로, 가방이 ${LAZY_BAG}개 차야 한 번 정리 (그때 낌 · 팜), 임무`,
    hand: [10, 20, 60], sessions: [H(12, 30), H(20, 60)], ads: 0, route: 'guide', gear: 'lazy', sell: true, missions: true, chal: false, merchant: 'none', guild: false, raids: false, jobs: [] },
  { key: 'switcher', name: '직업 바꾸기', note: `하루 1.5시간, 기본 손, 길잡이대로, Lv 20 드루이드 · Lv 30 성기사로 바꿈 (바꾼 뒤 ${RELEARN_RUNS}판은 손이 다시 서툼), 가장 좋은 장비 · 판매, 임무`,
    hand: [10, 20, 60], sessions: [H(12, 30), H(20, 60)], ads: 0, route: 'guide', gear: 'best', sell: true, missions: true, chal: false, merchant: 'none', guild: false, raids: false, jobs: [{ lv: 20, hero: 'druid' }, { lv: 30, hero: 'paladin' }] },
];
/** 견주기용 (기본 묶음엔 없음, --types로): 장비를 한 번도 안 바꾸는 보통 사람 = 장비 차이가 진행에 얼마나 드는지 */
export const EXTRA_TYPES: PlayerType[] = [
  { ...PLAYER_TYPES[1], key: 'nogear', name: '장비 안 바꿈', note: '보통 사람과 같은데 장비를 한 번도 안 바꿈 (튜토리얼 끝 장비 그대로). 장비 차이가 진행에 얼마나 드는지 보는 기준', gear: 'none', sell: false, merchant: 'none' },
];
export const playerType = (key: string) => [...PLAYER_TYPES, ...EXTRA_TYPES].find(t => t.key === key);

/** 판 기록 하나 (보고서 · 신호) */
export interface RunLog {
  /** 날 (1부터) · 그날 몇 번째 접속 · 판 전 레벨 · 직업 */
  day: number; ses: number; lv: number; hero: HeroKey;
  content: ContentKey; name: string; kind: string; diff: DiffName;
  /** 적 레벨 · 길잡이 적합도 (판 전) · 첫 클리어 칸 · 무엇으로 골랐나 */
  stage: number; fit: Fit | null; first: boolean; why: 'tut' | 'guide' | 'greedy' | 'chal' | 'raid' | 'exped';
  /** 주간 도전 단계 */
  chal?: number;
  win: boolean; reason: string;
  /** 진 구간 (0부터) · 구간 수 · 전투 시간 (초) · 쓰러진 수 */
  seg: number; segs: number; time: number; deaths: number;
  /** 파티가 받은 피해 ÷ 치유 한 번, 분당 (바쁨) · 분당 누른 수 */
  busy: number; apm: number;
  /** 착용 장비 평균 점수 (판 전) · 그 칸 권장 장비 점수 (없으면 null) · 빈 부위 수 */
  gear: number; rec: number | null; empty: number;
  /** 휴식 (판 전) · 받은 휴식 보너스 몫 (0 ~ 1, 진 판 null) */
  rest: number; share: number | null;
  /** 받은 경험치 · 골드 · 장비 등급 · 판 뒤 골드 · 길드파티 */
  xp: number; gold: number; item: ItemGrade | null; goldAfter: number; guild: boolean;
  /** 손: 그 판 사람의 반응 · 고르기 (초), 대기열 · 공략 앎 */
  hand: { react: number; pick: number; queue: boolean; tactics: boolean };
}

/** 날 기록 (그날 끝) */
export interface DayLog {
  day: number; lv: number; xpPct: number; hero: HeroKey;
  runs: number; wins: number; minutes: number;
  gold: number; gearAvg: number; empty: number; bag: number;
  /** 그날 받은 골드 (판 · 임무 · 상자 · 판매) · 쓴 골드 (행상인 · 모집 공고) */
  goldIn: number; goldOut: number;
  /** 행상인으로 산 수 · 받은 임무 보상 수 · 상자 · 남은 일일 임무 (못 채운 키) */
  bought: number; missions: number; chest: boolean; missionKeys: string[]; missionsLeft: string[];
  /** 휴식: 그날 처음 · 끝 · 휴식 보너스를 다 받은 판 몫 */
  restStart: number; restEnd: number; fullBonus: number;
  /** 길드: 길드원 · 정원 · 길드 Lv */
  members: number; cap: number; guildLv: number;
  /** 주간 도전 이번 주 최고 단계 */
  chalBest: number;
}

/** 흐름 기록: 길잡이가 추천을 못 함 · 위험 칸 추천 · 잠긴 칸 · 막혀서 그날 접속을 일찍 끝냄 */
export interface FlowLog { day: number; lv: number; kind: 'noGuide' | 'riskyGuide' | 'skip' | 'giveUp' | 'noCell'; text: string }

export interface PlayerLog {
  type: string; seed: number;
  runs: RunLog[]; days: DayLog[]; flows: FlowLog[];
  /** Lv → 처음 그 레벨이 된 날 */
  levelDay: Record<number, number>;
  /** 처음 열린 날: 이름 → 날 */
  opens: Record<string, number>;
  /** Lv 100이 된 날 (못 가면 null) · 판 수 */
  done: number | null; totalRuns: number;
}

/** 타입의 손 레벨 곡선을 기본 사람 곡선 (10 · 20 · 60)으로 옮긴 레벨: noviceAt에 넣음 */
export function handLevel(t: Pick<PlayerType, 'hand'>, lv: number): number {
  const [a, b, c] = t.hand, xs = [0, a, b, c], ys = [0, 10, 20, 60];
  for (let i = 1; i < xs.length; i++) if (lv <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (lv - xs[i - 1])) / (xs[i] - xs[i - 1]);
  return 60 + (lv - c);
}

/** 길잡이와 같이 추천에 쓰는 장소 (탐험 · 던전, 준비된 것) */
const LEVELING = CONTENT.filter(c => isLeveling(c) && !c.hidden && c.ready);
const RAIDS = CONTENT.filter(c => c.kind === 'raid' && !c.hidden && c.ready);
const kindOf = (c: ContentDef) => (c.kind === 'raid' ? `${raidSize(c)}인` : c.kind === 'dungeon' ? '던전' : c.key === 'tutorial' ? '첫 전투' : '탐험');
const cellKey = (c: string, d: DiffName) => `${c}|${d}`;

interface FightOut { r: BattleResult; roster: RosterEntry[]; busy: number; apm: number; who: NoviceOpts }

/**
 * 한 판 (게임 screens/party.ts depart · battle/index.ts와 같은 값): 공개모집 (또는 길드파티), 그 레벨 · 장비 · 특성 · 어픽스 · 주간 도전 배율로 구간을 차례로.
 * who = 누르는 사람 (판 내내 같은 사람)
 */
function fightOnce(save: SaveData, c: ContentDef, d: DiffName, o: { chal: number; seed: number; who: NoviceOpts; guild: boolean }, now: number): FightOut {
  const m = runMode(save, c, d, { chal: o.chal }, now), segs = c.fights(d), enc = ENCOUNTERS[segs[0]];
  const tut = save.tut < TUT.done, hero: HeroKey = tut ? 'priest' : save.hero, lv = save.player.level;
  let roster: RosterEntry[];
  if (c.key === 'tutorial') roster = DUO_PARTY;
  else {
    const pub = recruitParty(segs[0], o.seed, { abilities: !tut, myLv: lv, stageLv: m.stage, exclude: recruitExclude(save) }); // 길드원 · 공고 지원자는 빠짐 (게임과 같음)
    // 길드파티는 「추천 편성」 (game/recommend: 보스 특징에 맞는 능력 · 레벨)으로 (autoPick = 레벨 순은 끊기 · 쫄 처리가 빠져 Lv 86 뒤 특정 칸을 0%로 졌음, 2026-10-22)
    roster = o.guild && save.guild.founded && save.guild.members.length && guildPartyFits(save, enc) ? guildRoster(save, recommendPick(save, enc, segs, m.stage).pick, pub, enc, o.seed) : pub;
  }
  const talents = tut ? undefined : heroSaveOf(save, hero).talents;
  const gearStats = gearStatsOf(save.gear.equipped, lv), specs = specsOf(save.gear.equipped, hero);
  const st = { healed: 0, overheal: 0, dispels: 0, dispellable: 0, deaths: 0, time: 0, rest: 0, presses: 0, busy: 0 };
  const ps: Record<string, { got: number; low: number; dealt: number; did?: Record<string, number> }> = {};
  let carry: Carry | undefined, f: Fight | null = null, idx = 0;
  for (; idx < segs.length; idx++) {
    f = create({
      encounter: segs[idx], diff: d, seed: o.seed + idx * 7919, hero, level: lv, heroLv: lv, stageLv: m.stage, talents, party: roster, carry,
      affixes: m.affixes.length ? m.affixes : undefined, bossMult: m.bossMult, gearStats, specs,
    });
    const hp0 = f.party.reduce((a, u) => a + u.hp, 0);
    while (!f.over && f.t < MAX_T) { noviceHealer(f, o.who); step(f); f.events.length = 0; }
    st.time += f.t; st.deaths += f.stats.deaths; st.healed += f.stats.healed; st.overheal += f.stats.overheal; st.dispels += f.stats.dispels; st.dispellable += f.stats.dispellable;
    st.presses += noviceOf(f).stats.presses;
    st.busy += (f.stats.healed + hp0 - f.party.reduce((a, u) => a + Math.max(0, u.hp), 0)) / (SKILLS.heal.amt! * f.gear.heal * f.power);
    for (const u of f.party) {
      if (u.me || u.role === 'healer') continue;
      const x = (ps[u.nick] ??= { got: 0, low: 1, dealt: 0 });
      x.got += u.got; x.dealt += u.dealt; x.low = Math.min(x.low, u.low ?? 1);
      if (u.did) { const dd = (x.did ??= {}); for (const k of Object.keys(u.did) as (keyof typeof u.did)[]) dd[k] = (dd[k] ?? 0) + (u.did[k] ?? 0); }
    }
    if (f.over !== 'win') break;
    carry = restCarry(f, REST);
    if (idx < segs.length - 1) st.rest += REST;
  }
  const win = !!f && f.over === 'win' && idx >= segs.length;
  const last = f!, people = last.party.filter(u => !u.me);
  const topNick = people.filter(u => u.role !== 'tank').reduce<{ nick: string; d: number } | null>((a, u) => { const dd = ps[u.nick]?.dealt ?? u.dealt; return !a || dd > a.d ? { nick: u.nick, d: dd } : a; }, null)?.nick;
  const party = people.map(u => {
    const b = ps[u.nick], low = b?.low ?? 1;
    const deed = b?.did ? deedOf({ did: b.did as never, dealt: b.dealt, top: u.nick === topNick, low, alive: u.alive, role: u.role }) : undefined;
    return { nick: u.nick, pers: u.pers, role: u.role, alive: u.alive, got: Math.round(b?.got ?? 0), gid: u.gid, low: Math.round(low * 1000) / 1000, ...(deed ? { deed } : {}) };
  });
  const r = {
    hero, content: c.key, diff: d, win, quit: false, reason: win ? '' : last.over ? last.reason : '시간 초과',
    segIdx: Math.min(idx, segs.length - 1), segN: segs.length, time: st.time, restSec: st.rest, deaths: st.deaths,
    healed: st.healed, overheal: st.overheal, dispels: st.dispels, dispellable: st.dispellable, endMana: Math.floor(last.mana), minMana: Math.floor(last.stats.minMana), auto: false,
    party, detail: [], stage: m.stage, affixes: m.affixes.slice(), chal: m.chal || undefined, limit: m.limit,
  } as BattleResult;
  const min = Math.max(1 / 60, st.time / 60);
  return { r, roster, busy: st.busy / min, apm: st.presses / min, who: o.who };
}

/** 부위마다 점수가 더 높은 장비를 낌 (journey equipBest와 같음) */
function equipBest(save: SaveData): void {
  const lv = save.player.level;
  for (const it of [...save.gear.bag].sort((a, b) => itemScore(b, lv) - itemScore(a, lv))) {
    const cur = save.gear.equipped[it.slot];
    if (!cur || itemScore(it, lv) > itemScore(cur, lv)) equip(it.id);
  }
}
/** 잠기지 않은 가방 장비를 모두 팜 */
const sellAll = (save: SaveData) => sell(save.gear.bag.filter(x => !x.lock).map(x => x.id)).gold;
const emptySlots = (save: SaveData) => SLOTS.filter(s => !save.gear.equipped[s.key]).length;

/** 열린 특성 단을 모두 찍음 (빌드 b = 0 · 1 · 2 칸, 비어 있는 단만) */
function pickTalents(save: SaveData, hero: HeroKey, b: number): void {
  const hs = heroSaveOf(save, hero), tiers = TALENT_TREES[hero], lv = save.player.level;
  const a = (hs.talents ||= []);
  tiers.forEach((t, i) => { if (t.lv <= lv && a[i] == null) a[i] = Math.min(b, t.picks.length - 1); });
}

/** 가상 사용자 하나: 새 저장 → 튜토리얼 → Lv 100 (또는 maxDays) */
export function livePlayer(t: PlayerType, seed: number, o: { maxDays?: number; maxLv?: number; /** 날마다 (진행 표시) */ onDay?: (d: DayLog) => void } = {}): PlayerLog {
  const maxDays = o.maxDays ?? MAX_DAYS, maxLv = o.maxLv ?? MAX_LEVEL;
  const rng = rngFrom(Math.imul(seed >>> 0, 0x6c8e9cf5) ^ Math.imul(t.key.length + 7, 0x1b873593) ^ t.key.charCodeAt(0));
  const day0 = new Date(2026, 9, 19, 0, 0, 0); // 월요일
  const save = newSave(day0.getTime() + 8 * 3600e3);
  save.settings.devUnlock = false; save.settings.devStamina = false;
  const keep = G.save, guildOn = FEATURES.guild;
  G.save = save;
  const log: PlayerLog = { type: t.key, seed, runs: [], days: [], flows: [], levelDay: { 1: 1 }, opens: {}, done: null, totalRuns: 0 };
  const build = seed % 3;
  let runSeed = (seed * 1000003) >>> 0, sinceSwitch = Infinity;
  let chalDoneWeek = '', raidWeek = '';
  const nextSeed = () => (runSeed = (Math.imul(runSeed, 1664525) + 1013904223) >>> 0);
  const open = (k: string, day: number) => { if (!(k in log.opens)) log.opens[k] = day; };
  try {
    for (let day = 1; day <= maxDays && save.player.level < maxLv; day++) {
      const dayStart = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + day - 1).getTime();
      let goldIn = 0, goldOut = 0, bought = 0, claimed = 0, chest = false, runs = 0, wins = 0, minutes = 0, fullBonus = 0, restStart = -1;
      const avoid = new Map<string, number>(), flowSeen = new Set<string>();
      /** 흐름 기록은 그날 같은 글 한 번만 */
      const flow = (kind: FlowLog['kind'], text: string) => { if (!flowSeen.has(kind + text)) { flowSeen.add(kind + text); log.flows.push({ day, lv: save.player.level, kind, text }); } };
      for (let si = 0; si < t.sessions.length && save.player.level < maxLv; si++) {
        let now = dayStart + t.sessions[si][0] * 3600e3;
        const end = now + t.sessions[si][1] * 60e3;
        syncStamina(save, now);
        if (restStart < 0) restStart = save.stamina.n;
        const gold = (f: () => void) => { const g0 = save.player.gold; f(); const dg = save.player.gold - g0; if (dg > 0) goldIn += dg; else goldOut -= dg; };
        const ads = () => { for (let i = 0; i < t.ads && save.stamina.n < 30; i++) if (adCharge(save, now)) break; };
        /** 판 뒤 할 일: 장비 · 임무 · 상자 · 특성 · 직업 · 행상인 · 길드 */
        const after = () => {
          const lv = save.player.level, hero = save.hero;
          if (save.tut < TUT.done) return;
          pickTalents(save, hero, build);
          const job = t.jobs.filter(x => lv >= x.lv).pop();
          if (job && save.hero !== job.hero && switchHero(job.hero, now)) { sinceSwitch = 0; open(`${HEROES[job.hero].name}로 바꿈`, day); pickTalents(save, job.hero, build); }
          if (t.gear === 'none') { /* 장비 안 바꿈 */ }
          else if (t.gear === 'best') { equipBest(save); if (t.sell) gold(() => sellAll(save)); }
          else if (t.gear === 'peek') { for (const it of [...save.gear.bag]) { const cur = save.gear.equipped[it.slot]; if (!cur || itemScore(it, lv) > itemScore(cur, lv)) equip(it.id); } }
          else if (save.gear.bag.length >= LAZY_BAG || emptySlots(save) && save.gear.bag.some(it => !save.gear.equipped[it.slot])) {
            if (save.gear.bag.length >= LAZY_BAG) { equipBest(save); if (t.sell) gold(() => sellAll(save)); }
            else for (const it of [...save.gear.bag]) if (!save.gear.equipped[it.slot]) equip(it.id); // 빈 부위는 바로 낌
          }
          if (t.missions) gold(() => {
            for (const kind of ['daily', 'weekly'] as const) (kind === 'daily' ? save.daily : save.weekly).missions.forEach((m, i) => { if (missionReady(m) && typeof claimMission(save, kind, i) !== 'string') claimed++; });
            const cs = chestState(save);
            if ((cs.today || cs.banked) && typeof claimChest(save, rng) !== 'string') { chest = true; if (t.gear === 'best' || t.gear === 'peek') equipBest(save); }
            if (save.chalChest && typeof claimChalChest(save, rng) !== 'string' && (t.gear === 'best' || t.gear === 'peek')) equipBest(save);
            if (save.guild.founded) { claimGuildGoal(save); if (typeof claimExped(save, rng) !== 'string' && (t.gear === 'best' || t.gear === 'peek')) equipBest(save); }
          });
          if (lv >= MERCHANT.lv) {
            open('행상인', day);
            if (t.merchant !== 'none') gold(() => {
              for (let n = 0; n < 20; n++) {
                const price = merchantGold(save.player.level), keep = t.merchant === 'spare' ? price * 3 : price;
                if (save.player.gold < keep + (t.guild && save.guild.founded && !full(save) ? hireGold(save.player.level) : 0)) break;
                const slot = [...SLOTS].sort((a, b) => itemScore(save.gear.equipped[a.key], lv) - itemScore(save.gear.equipped[b.key], lv))[0].key;
                if (typeof buyUnknown(save, slot, rng) === 'string') break;
                bought++;
                equipBest(save); if (t.sell) sellAll(save);
              }
            });
          }
          if (t.guild && save.guild.founded) gold(() => {
            // 매일 공고 (2026-10-22): 그날 지원자 3명 가운데 레벨 높은 사람부터, 영입 골드 (지원자 Lv × 30)가 있으면
            refreshPost(save, rng, now);
            const nicks = [...(save.guild.post?.cands ?? [])].sort((a, b) => b.lv - a.lv).map(c => c.nick);
            for (const nick of nicks) {
              if (full(save)) break;
              const i = save.guild.post?.cands.findIndex(c => c.nick === nick) ?? -1;
              if (i >= 0) hire(save, i);
            }
          });
        };
        /** 한 판 하고 기록 */
        const play = (c: ContentDef, d: DiffName, why: RunLog['why'], chal = 0) => {
          const lv0 = save.player.level, hero0 = save.tut < TUT.done ? 'priest' : save.hero;
          const effLv = Math.max(1, handLevel(t, lv0) - (sinceSwitch < RELEARN_RUNS ? 10 * (1 - sinceSwitch / RELEARN_RUNS) : 0));
          const who = noviceAt(effLv, seed * 31 + 7);
          const fit = save.tut < TUT.done || chal ? null : fitNow(c, d), first = !save.clears[c.key]?.[d], rec = recommendedFor(c, d)?.score ?? null;
          const gear0 = avgScore(save.gear.equipped, lv0), empty = emptySlots(save), rest0 = save.stamina.n;
          const fo = fightOnce(save, c, d, { chal, seed: nextSeed(), who, guild: t.guild }, now);
          let xp = 0, goldGot = 0, item: ItemGrade | null = null, share: number | null = null;
          if (c.key === 'tutorial') {
            if (fo.r.win) { const p = save.player; if (p.level < 2) { xp = xpToNext(1) - p.xp; addXp(p, xp); } if (save.tut === TUT.intro) save.tut = TUT.explore; }
          } else {
            const s = settle(save, fo.r, rng, fo.roster, now);
            xp = s.xp; goldGot = s.gold; item = s.items[0]?.grade ?? null; share = s.rest ? s.rest.share : null;
            goldIn += s.gold;
            if (s.founded) open('길드 결성', day);
          }
          if (share === 1) fullBonus++;
          now += (fo.r.time + fo.r.restSec + RUN_OVERHEAD) * 1000;
          minutes += (fo.r.time + fo.r.restSec + RUN_OVERHEAD) / 60;
          runs++; if (fo.r.win) wins++; log.totalRuns++; sinceSwitch++;
          const k = cellKey(c.key, d);
          if (fo.r.win) avoid.delete(k); else avoid.set(k, (avoid.get(k) ?? 0) + 1);
          log.runs.push({
            day, ses: si, lv: lv0, hero: hero0, content: c.key, name: c.name, kind: kindOf(c), diff: d, stage: fo.r.stage ?? stageOf(c, d), fit, first, why, chal: chal || undefined,
            win: fo.r.win, reason: fo.r.reason, seg: fo.r.segIdx, segs: fo.r.segN, time: Math.round(fo.r.time), deaths: fo.r.deaths,
            busy: Math.round(fo.busy * 10) / 10, apm: Math.round(fo.apm), gear: Math.round(gear0 * 100) / 100, rec: rec == null ? null : Math.round(rec * 100) / 100, empty,
            rest: rest0, share, xp, gold: goldGot, item, goldAfter: save.player.gold, guild: fo.roster.some(e => e.gid != null),
            hand: { react: Math.round(who.react * 1000) / 1000, pick: Math.round(who.pick * 1000) / 1000, queue: who.queue, tactics: who.tactics },
          });
          for (let l = lv0 + 1; l <= save.player.level; l++) log.levelDay[l] = day;
          after();
          if (save.player.level >= maxLv && log.done == null) log.done = day;
          return fo.r.win;
        };
        // 튜토리얼: 첫 전투 → 녹슨 고원 쉬움 (지면 다시)
        for (let n = 0; save.tut < TUT.done && n < 10 && now < end; n++) save.tut === TUT.intro ? play(contentOf('tutorial'), '쉬움', 'tut') : play(contentOf('plateau'), '쉬움', 'tut');
        if (save.tut < TUT.done) continue;
        ads();
        if (t.missions) after();
        // 주간 도전 (주마다 한 번, 깨지는 데까지)
        const week = save.weekly.week;
        if (t.chal && save.player.level >= CHAL.lv && chalDoneWeek !== week && !save.weekly.chalBest) {
          chalDoneWeek = week; open('주간 도전', day);
          for (let st = save.chalOpen || 1; st <= CHAL.max && now < end; st++) {
            const ok = play(contentOf(CHAL.content), CHAL.diff, 'chal', st);
            if (!ok || !(save.weekly.chalBest >= st)) break;
          }
        }
        // 길드 원정 (주마다, 보통)
        if (t.guild && save.guild.founded) {
          refreshExped(save, realOpen, now); refreshReqs(save, rankStages(guideCtx()), rng, now);
          for (const x of save.guild.exped.list) if (!x.done && now < end && save.guild.members.length >= 2) play(contentOf(x.content as ContentKey), '보통', 'exped');
        }
        // 레이드 주 첫 판
        if (t.raids && raidWeek !== week && save.player.level >= RAID10_LV) {
          raidWeek = week;
          for (const c of RAIDS) for (const d of ALL_DIFFS) {
            if (now >= end || !realOpen(c, d) || save.weekly.loot.some(k => k.endsWith(cellKey(c.key, d)))) continue;
            const fit = fitNow(c, d);
            if (fit === '도전' || fit === '위험') continue;
            play(c, d, 'raid');
          }
        }
        // 본 판: 길잡이 · 제멋대로
        while (now < end && save.player.level < maxLv) {
          if (save.stamina.n < 10) ads();
          const giveUp = GIVE_UP[t.route];
          let pickC: ContentDef | null = null, pickD: DiffName | null = null;
          if (t.route === 'guide') {
            const list = rankStages(guideCtx());
            if (!list.length) { flow('noGuide', '길잡이 추천 칸 없음'); break; }
            const top = list[0], topFit = fitNow(contentOf(top.content), top.diff);
            if (topFit === '위험' || topFit === '도전') flow('riskyGuide', `길잡이 1순위가 ${topFit}: ${contentOf(top.content).name} ${top.diff}`);
            const ok = list.find(s => (avoid.get(cellKey(s.content, s.diff)) ?? 0) < giveUp);
            if (!ok) { flow('giveUp', '추천 칸을 모두 져서 그날 그만둠'); break; }
            if (ok !== top) flow('skip', `${contentOf(top.content).name} ${top.diff}: ${giveUp}번 져서 다음 추천 칸으로`);
            pickC = contentOf(ok.content); pickD = ok.diff;
          } else {
            const cand = LEVELING.flatMap(c => ALL_DIFFS.map(d => ({ c, d }))).filter(x => realOpen(x.c, x.d) && (avoid.get(cellKey(x.c.key, x.d)) ?? 0) < giveUp)
              .sort((a, b) => stageOf(b.c, b.d) - stageOf(a.c, a.d) || ALL_DIFFS.indexOf(b.d) - ALL_DIFFS.indexOf(a.d));
            if (!cand.length) { flow('noCell', '열린 칸을 모두 져서 그날 그만둠'); break; }
            pickC = cand[0].c; pickD = cand[0].d;
          }
          play(pickC, pickD, t.route === 'guide' ? 'guide' : 'greedy');
        }
      }
      for (const [k, lv] of [['10인 레이드', RAID10_LV], ['20인 레이드', RAID20_LV], ['드루이드', HEROES.druid.unlock.lv], ['성기사', HEROES.paladin.unlock.lv]] as const) if (save.player.level >= lv) open(k, day);
      TALENT_TREES[save.hero].forEach((x, i) => { if (save.player.level >= x.lv) open(`특성 ${i + 1}단`, day); });
      const xpNeed = xpToNext(save.player.level);
      log.days.push({
        day, lv: save.player.level, xpPct: xpNeed ? Math.round((100 * save.player.xp) / xpNeed) : 100, hero: save.hero,
        runs, wins, minutes: Math.round(minutes), gold: save.player.gold, gearAvg: Math.round(avgScore(save.gear.equipped, save.player.level) * 100) / 100, empty: emptySlots(save), bag: save.gear.bag.length,
        goldIn, goldOut, bought, missions: claimed, chest, missionKeys: save.daily.missions.map(m => m.key), missionsLeft: save.daily.missions.filter(m => !m.got && !missionReady(m)).map(m => m.key),
        restStart: Math.max(0, restStart), restEnd: save.stamina.n, fullBonus: runs ? Math.round((100 * fullBonus) / runs) : 0,
        members: save.guild.members.length, cap: save.guild.founded ? capOf(save).cap : 0, guildLv: save.guild.founded ? guildLvOf(save.guild.fame).lv : 0, chalBest: save.weekly.chalBest,
      });
      o.onDay?.(log.days.at(-1)!);
    }
  } finally { G.save = keep; FEATURES.guild = guildOn; }
  return log;
}
