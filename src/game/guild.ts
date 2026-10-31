/**
 * 길드 v2 (93 · 97, 사슬 4번): 결성 · 모집 공고 영입 (명성 지원자는 2026-10-20 없앰) · 보내기 · 규모별 편성 · 판 뒤 (레벨 경험치 · 능력치 · 명성 · 첫 처치).
 * 화면과 분리된 규칙. 난수는 받아서 씀 (테스트에서 고정).
 */
import { resourceBalance, spendResource } from './resources';
import { t } from '../i18n';
import { ABILITIES } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../data/classes';
import { CONTENT } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { Encounter } from '../data/encounters';
import { dayOffset, lvAdds, profileOf, STAT_KEYS, type StatKey, type Stats } from '../data/fm';
import {
  SPONSOR, sponsorGold, DEED_STATS, DEED_WHY, FAME, FAME_LOW_GAP, guildLvOf, habitOf, highStageCap, hireGold, lowStageXp, POST, REQ, REST_SHARE,
  memberSkillLevel, LV_DOUBLE, spendPoints, statPerLevel, VOTE_KEEP, XP_BAND, type Deed, type GuildMember,
} from '../data/guild';
import { PARTY_POOL, type PoolMember } from '../data/nicknames';
import { PERS } from '../data/personalities';
import { addXp, clearXp, GUILD_LEVEL, MAX_LEVEL, xpToNext, type Grade } from '../data/progression';
import type { RosterEntry } from '../engine/types';
import { FEATURES } from '../data/features';
import { topLevel, type SaveData } from '../platform/storage';
import { dayKey } from './clock';
import { TUT } from './tutorial';
import { now as gameNow } from '../platform/time';

/** 길드가 열렸는지 (GUILD_LEVEL = Lv 30, 튜토리얼 뒤). dev = 개발 빌드 「레벨 잠금 무시」로 열림. 출시판에서 빼 두면 늘 닫힘 (features.ts) */
export function guildOpen(save: SaveData): { ok: boolean; dev: boolean; why: string } {
  if (!FEATURES.guild) return { ok: false, dev: false, why: '' };
  if (save.tut < TUT.done) return { ok: false, dev: false, why: t('튜토리얼을 마치면 열림') };
  // 이미 만든 길드는 레벨과 상관없이 열림 (2026-10-29 Lim 「A」: Lv 15에 열리던 때 만든 길드가 #498 Lv 30 뒤로 잠겨 길드원 · 명성 · 부탁이 멈췄음)
  const under = topLevel(save) < GUILD_LEVEL && !save.guild.founded;
  if (under && !save.settings.devUnlock) return { ok: false, dev: false, why: t('Lv {n}에 열림', { n: GUILD_LEVEL }) };
  return { ok: true, dev: under, why: '' };
}

/** 길드 Lv · 정원 (명성) */
export const capOf = (save: SaveData) => guildLvOf(save.guild.fame);
export const full = (save: SaveData) => save.guild.members.length >= capOf(save).cap;

// ---------- 사람 ----------
/** 1000명 가운데 한 사람 (직업 포함) */
export type Person = PoolMember & { cls: ClassKey };
const PEOPLE: Person[] = RECRUIT_CLASSES.flatMap(cls => PARTY_POOL[cls].map(p => ({ ...p, cls })));
const BY_NICK = new Map(PEOPLE.map(p => [p.nick, p]));
export const personOf = (nick: string): Person | null => BY_NICK.get(nick) ?? null;

const isIn = (save: SaveData, nick: string) => save.guild.members.some(m => m.nick === nick);

/**
 * 길드원 하나 (1000명 가운데 사람, 그 사람 지금 레벨 = 세상 레벨).
 * 능력치 = 타고난 값 + 그 레벨까지 레벨업 점수 (공개모집과 같은 굴림, 104)를 저장, 그 뒤로는 레벨업할 때 (growStats)
 */
export function newMember(save: SaveData, p: Pick<Person, 'nick' | 'cls' | 'pers' | 'ab'>, lv: number): GuildMember {
  const role = CLASSES[p.cls].role as 'tank' | 'melee' | 'ranged', prof = profileOf(p.nick, p.pers, role), at = Math.max(1, Math.min(topLevel(save), lv));
  const birth = prof.stats, add = lvAdds(p.nick, p.pers, role, at, birth);
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, birth[k] + add[k]])) as Stats;
  return { id: 0, nick: p.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv: at, xp: 0, stats, lastStatGains: [], learn: prof.learn, steady: prof.steady, sxp: 0, votes: [], boost: 0, runs: 0, joined: gameNow() };
}

function join(save: SaveData, m: GuildMember): GuildMember {
  const g = save.guild;
  const nm: GuildMember = { ...m, id: g.nextId++, joined: gameNow() };
  g.members.push(nm);
  // 합류한 사람만 공고 지원자에서 빼고 나머지 지원자는 다음 갱신까지 유지한다 (다 데려가도 그날 공고는 남음: 같은 날 다시 3명이 오지 않게)
  if (g.post) g.post.cands = g.post.cands.filter(c => c.nick !== m.nick);
  return nm;
}

// ---------- 결성 (93 4-1) ----------
/**
 * 길드원 없이 결성한다 (Lim 10-21 「길드에서 스토리 동료 제거, 자동 영입 제거」): 영입은 모집 공고로만.
 * 예전엔 말없는탱 (스토리 동료) + 도적 1명이 저절로 들어왔음 (정원 2, 103).
 */
export function foundGuild(save: SaveData, r: () => number = Math.random, now = gameNow()): boolean {
  const g = save.guild;
  if (g.founded || !guildOpen(save).ok) return false;
  g.founded = true;
  refreshPost(save, r, now); // 결성 직후에도 그날 지원자 3명 (2026-10-22)
  return true;
}

// ---------- 모집 공고: 전 직업 무작위 ----------
/** 아직 길드원이 아닌 사람 가운데 */
function strangers(save: SaveData, ok: (p: Person) => boolean, taken: Set<string>): Person[] {
  return PEOPLE.filter(p => !isIn(save, p.nick) && !taken.has(p.nick) && ok(p));
}
function drawOne(list: Person[], r: () => number): Person | null {
  return list.length ? list[Math.min(list.length - 1, Math.floor(r() * list.length))] : null;
}
/** 고급 스킬은 희귀가 아니다. 희귀 성격 또는 희귀 등급 스킬을 가진 사람을 하나의 희귀 풀로 센다 (안쪽 굴림만, 화면에는 등급 표시 없음, 2026-10-22). */
export const rareCandidate = (p: Pick<Person, 'pers' | 'ab'>) => 'rare' in PERS[p.pers] || ABILITIES[p.ab]?.grade === 'epic';
/**
 * 지원자 n명 (중복 없이, 길드원이 아닌 사람): 희귀 여부를 먼저 굴린 뒤 (POST.rareChance, 그 풀에서), 레벨을 Lv 1 ~ 내 레벨에서 고르게 하나 뽑고
 * (2026-10-22 Lim 「1레벨 부터 캐릭터 레벨까지 랜덤」), 그 풀의 아무나 그 레벨로 데려옴 (2026-10-26 Lim 「1000명을 레벨대에 고정하지 말고 … 1레벨 기준으로 시작해서
 * 해당 레벨까지 능력치 상승으로」, 예전엔 빠르기로 그 레벨에 맞는 사람만 찾아 목표 레벨마다 몇 사람만 나왔음). 능력치는 그 레벨까지 공개모집과 같은 레벨업 굴림 (newMember)
 */
export function makeCandidates(save: SaveData, r: () => number, n: number = POST.cands): GuildMember[] {
  const my = topLevel(save), taken = new Set<string>(), out: GuildMember[] = [];
  for (let i = 0; i < n; i++) {
    const all = strangers(save, () => true, taken);
    const rare = r() < POST.rareChance;
    const pool = all.filter(p => rareCandidate(p) === rare);
    const target = 1 + Math.min(my - 1, Math.floor(r() * my));
    const p = drawOne(pool.length ? pool : all, r);
    if (!p) break;
    taken.add(p.nick);
    out.push(newMember(save, p, target));
  }
  return out;
}
/** 매일 공고 (오전 6시, dayKey): 결성한 길드에 그날 공고가 없으면 지원자 POST.cands명. 시계를 뒤로 돌린 날은 그대로. 새로 왔으면 true */
export function refreshPost(save: SaveData, r: () => number, now = gameNow()): boolean {
  const g = save.guild, day = dayKey(now);
  if (!g.founded || (g.post && g.post.day >= day)) return false;
  g.post = { day, cands: makeCandidates(save, r, POST.cands), seen: false };
  return true;
}
/** 새 지원자가 왔거나 올 것 (길드 탭 · 영입 탭 빨간 점): 정원이 남았고 그날 공고를 아직 안 봤거나 날이 바뀜 */
export function postNew(save: SaveData, now = gameNow()): boolean {
  const g = save.guild, p = g.post;
  return g.founded && !full(save) && (!p || p.day < dayKey(now) || (!p.seen && p.cands.length > 0));
}
/** 광고로 새로 뽑기까지 남은 시간 (ms, 0 = 지금 됨). 실제 시간 1시간 (시계를 뒤로 돌렸으면 바로) */
export function postAdWait(save: SaveData, now = gameNow()): number {
  const at = save.guild.postAdAt ?? 0;
  return at > now ? 0 : Math.max(0, at + POST.adCooldownMs - now);
}
/** 보상형 광고를 본 뒤: 지원자를 POST.adCands명으로 새로. 성공 = 빈 문자열 */
export function adRefreshPost(save: SaveData, r: () => number, now = gameNow()): string {
  const g = save.guild;
  if (!g.founded) return t('길드 결성 전');
  if (postAdWait(save, now) > 0) return t('아직 쿨타임');
  g.post = { day: dayKey(now), cands: makeCandidates(save, r, POST.adCands), seen: true };
  g.postAdAt = now;
  return '';
}
/** 고른 공고 지원자를 영입한다 (골드 = 레벨 × 능력 배율 hireGold). 남은 지원자도 정원 안에서 모두 영입할 수 있다. */
export function hire(save: SaveData, i: number): string {
  const g = save.guild, c = g.post?.cands[i];
  if (!c) return t('지원자 없음');
  if (full(save)) return t('정원 {n}명이 다 참', { n: capOf(save).cap });
  const gold = hireGold(c);
  if (resourceBalance(save, 'gold') < gold) return t('골드 부족 ({n} 필요)', { n: gold.toLocaleString() });
  spendResource(save, 'gold', gold);
  join(save, c);
  return '';
}

// ---------- 관리 ----------
const memberOf = (save: SaveData, id: number) => save.guild.members.find(m => m.id === id) || null;

/** 골드 지원: 그 길드원 Lv × SPONSOR.per (50) 골드 = SPONSOR.runs판 (3). 남은 지원이 있거나 내 레벨과 같으면 안 됨. */
export function sponsorWhy(save: SaveData, m: GuildMember): string {
  if (m.boost > 0) return t('지원 중');
  if (m.lv >= topLevel(save)) return t('내 레벨과 같음');
  return '';
}
export function sponsor(save: SaveData, id: number): string {
  const m = memberOf(save, id);
  if (!m) return t('길드원 없음');
  const why = sponsorWhy(save, m);
  if (why) return why;
  const c = sponsorGold(m.lv);
  if (resourceBalance(save, 'gold') < c) return t('골드 부족 ({n} 필요)', { n: c.toLocaleString() });
  spendResource(save, 'gold', c);
  m.boost += SPONSOR.runs;
  return '';
}
/** 쉬는 길드원 (어느 규모 편성에도 없는 사람) 가운데 후원할 수 있는 사람과 합계 골드 */
export function restSponsor(save: SaveData): { ids: number[]; gold: number } {
  const picked = new Set(Object.values(save.guild.picks).flat());
  const ids = save.guild.members.filter(m => !picked.has(m.id) && !sponsorWhy(save, m)).map(m => m.id);
  return { ids, gold: ids.reduce((t, id) => t + sponsorGold(memberOf(save, id)!.lv), 0) };
}
/** 쉬는 길드원 모두 후원 (골드가 모자라면 아무도 안 함) */
export function sponsorRest(save: SaveData): string {
  const { ids, gold } = restSponsor(save);
  if (!ids.length) return t('후원할 쉬는 길드원 없음');
  if (resourceBalance(save, 'gold') < gold) return t('골드 부족 ({n} 필요)', { n: gold.toLocaleString() });
  for (const id of ids) sponsor(save, id);
  return '';
}

/** 길드에서 내보내고 모든 규모의 편성에서 제외한다. */
export function release(save: SaveData, id: number): boolean {
  const g = save.guild, m = memberOf(save, id);
  if (!m) return false;
  g.members = g.members.filter(x => x.id !== id);
  for (const k of Object.keys(g.picks) as (keyof typeof g.picks)[]) g.picks[k] = g.picks[k]!.filter(x => x !== id);
  g.reqs.list = g.reqs.list.filter(q => q.nick !== m.nick); // 내보낸 사람의 부탁도 (105 QA 2: 「할 일 n개 남음」이 다음 날까지)
  return true;
}

// ---------- 길드파티 편성 ----------
/** 전투에 넘기는 길드원: 자기 레벨 · 능력치 (그날 꾸준함 흔들림) · 스킬 레벨 · 버릇 (침착 · 판단) */
export function memberEntry(save: SaveData, m: GuildMember, seed = 1): RosterEntry {
  return {
    role: CLASSES[m.cls].role, pers: m.pers, nick: m.nick, cls: m.cls, ab: m.ab, star: memberSkillLevel(m), lv: m.lv, pub: true,
    fm: { stats: { ...m.stats }, off: dayOffset(m.steady, seed, m.nick), steady: m.steady }, habit: habitOf(m.stats), gid: m.id,
  };
}

/** 자리: 탱커 수와 딜러 수 (근접·원거리 섞어도 됨) */
export const slotsOf = (enc: Encounter) => ({ tank: enc.comp.tank, dps: enc.comp.melee + enc.comp.ranged });
/** 규모 (탐험 3 · 5인 · 10 · 20인): 지난 편성을 따로 기억 */
export const sizeKey = (enc: Encounter): '3' | '5' | '10' | '20' => { const n = enc.comp.tank + enc.comp.melee + enc.comp.ranged + 1; return n <= 3 ? '3' : n <= 5 ? '5' : n <= 10 ? '10' : '20'; };
/** 편성 순서 (지난 편성 밖): 레벨 → 합류 순 */
const order = (save: SaveData) => save.guild.members.slice().sort((a, b) => b.lv - a.lv || a.id - b.id);

/** 길드파티 자리 수 (나 빼고): 탐험 2 · 5인 4 · 10인 9 · 20인 19 */
export const seatsOf = (enc: Encounter) => { const sl = slotsOf(enc); return sl.tank + sl.dps; };
/**
 * 역할 자리 모양 (탱커 자리 · 딜러 자리)대로 고른 뒤 남은 자리는 남은 길드원 (역할 상관없이) 차례로.
 * 길드파티는 역할 자리 제한 없이 마음대로 꾸림 (2026-10-28 Lim): 처음 편성 · 추천 편성만 이 모양으로 채움
 */
export function shapePick<T>(list: readonly T[], isTank: (x: T) => boolean, enc: Encounter, start: readonly T[] = []): T[] {
  const sl = slotsOf(enc), seats = seatsOf(enc), pick = start.slice(0, seats);
  for (const x of list) {
    if (pick.length >= seats || pick.includes(x)) continue;
    const n = pick.filter(isTank).length;
    if (isTank(x) ? n < sl.tank : pick.length - n < sl.dps) pick.push(x);
  }
  for (const x of list) if (pick.length < seats && !pick.includes(x)) pick.push(x);
  return pick;
}

/** 처음 편성: 그 규모의 지난 편성 중 남아 있는 사람 + 빈자리는 레벨 높은 순 (역할 자리 모양 먼저) */
export function autoPick(save: SaveData, enc: Encounter, fresh = false): number[] {
  const ms = save.guild.members, tank = (id: number) => CLASSES[ms.find(x => x.id === id)!.cls].role === 'tank';
  const last = fresh ? [] : (save.guild.picks[sizeKey(enc)] ?? []).filter(id => ms.some(x => x.id === id));
  return shapePick(order(save).map(m => m.id), tank, enc, last);
}

/** 편성에 넣고 빼기 (역할 자리 제한 없음, 2026-10-28 Lim). 자리가 다 찼으면 이유 */
export function togglePick(save: SaveData, enc: Encounter, pick: number[], id: number): { pick: number[]; msg: string } {
  if (pick.includes(id)) return { pick: pick.filter(x => x !== id), msg: '' };
  if (!save.guild.members.some(x => x.id === id)) return { pick, msg: '' };
  if (pick.length >= seatsOf(enc)) return { pick, msg: t('자리가 다 참') };
  return { pick: [...pick, id], msg: '' };
}
export const savePick = (save: SaveData, enc: Encounter, pick: number[]) => { save.guild.picks[sizeKey(enc)] = pick.slice(); };

/**
 * 길드파티: 고른 길드원만 (2026-10-28 Lim 「공개모집의 멤버랑 같이 하지 않고 길드멤버끼리만」). 길드원이 자리보다 적으면 빈 칸으로 출발.
 * 탱커가 앞 (전투 배치 차례와 같게)
 */
export function guildRoster(save: SaveData, pick: readonly number[], seed = 1): RosterEntry[] {
  const ms = pick.map(id => save.guild.members.find(m => m.id === id)).filter((m): m is GuildMember => !!m).map(m => memberEntry(save, m, seed));
  return [...ms.filter(m => m.role === 'tank'), ...ms.filter(m => m.role !== 'tank')];
}
/** 공개모집에서 빼는 사람: 길드원 (내 길드원이 파티 찾기로 들어오면 어색함, 93 7-2) */
export const guildNicks = (save: SaveData): Set<string> => new Set(save.guild.members.map(m => m.nick));
/** 공개모집에서 빼는 사람: 길드원 + 지금 공고에 떠 있는 지원자 (Lim 10-22 「맞추고 빼기」: 같은 사람이 영입 탭과 공개모집에 동시에 안 보이게) */
export const recruitExclude = (save: SaveData): Set<string> => new Set([...guildNicks(save), ...(save.guild.post?.cands ?? []).map(c => c.nick)]);

// ---------- 판 뒤 ----------
/** 길드파티 = 파티원 자리 절반 이상이 길드원 (명성 · 첫 처치 · 주간 목표 · 일일 임무 「길드파티로 클리어」 모두 이 기준). 편성 길드파티 탭은 길드원만이라 늘 길드파티, 공개모집은 길드원이 안 나와 아님 */
export const isGuildParty = (roster: readonly RosterEntry[]) => roster.some(e => e.gid != null) && roster.filter(e => e.gid != null).length * 2 >= roster.length;
/** 길드원으로 다 채운 길드파티 인원 (나 빼고): 탐험 2 · 5인 4 · 10인 9 · 20인 19 (2026-10-28 길드원만 출전, 예전 자리 절반) */
export const guildPartyNeed = (size: number) => Math.max(1, size - 1);
/** 지금 길드원으로 이 판 길드파티를 빈 칸 없이 꾸릴 수 있나: 역할 자리로 셈 (105 QA: 탱커 3 + 딜러 7이면 20인은 탱커 자리 2 · 딜러 7뿐) */
export function guildPartyFits(save: SaveData, enc: Encounter): boolean {
  return guildSeatCount(save, enc) >= seatsOf(enc);
}
/** 길드원으로 채울 수 있는 자리 수 (역할 자리로 셈) */
export function guildSeatCount(save: SaveData, enc: Encounter): number {
  const sl = slotsOf(enc), ms = save.guild.members, tanks = ms.filter(m => CLASSES[m.cls].role === 'tank').length;
  return Math.min(tanks, sl.tank) + Math.min(ms.length - tanks, sl.dps);
}
export interface GuildAfter {
  /** 출전한 길드원: 레벨 경험치 · 레벨 업 · 오른 능력치 (왜) */
  members: { nick: string; xp: number; ups: number[]; stats: { k: StatKey; to: number; why: string; shown?: number }[]; lv?: number; /** 두 배 (LV_DOUBLE)가 나온 레벨 수 · 마지막 두 배 레벨에 오른 칸 */ dbl?: number; dblStats?: StatKey[] }[];
  /** 쉬는 명단이 받은 경험치 합 · 그 가운데 후원으로 받은 사람 (경험치 · 남은 판) */
  rest: number;
  boosted: { nick: string; xp: number; left: number }[];
  fame: number;
  /** 길드 첫 처치 (장소 · 난이도) */
  first: boolean;
  /** 길드파티로 이겼지만 낮은 장소 (적 레벨 < 내 Lv − FAME_LOW_GAP)라 명성 · 첫 처치 없음 */
  low: boolean;
}

/** 레벨 경험치를 더함 (상한 = 내 레벨, 상한에서도 다음 레벨 바로 앞까지 모아 둠: 내가 레벨업하면 다음 판에 바로 따라옴) */
/** 실제로 오른 경험치 (레벨 · 쌓인 경험치 앞뒤로 셈, 레벨 상한 · 모아 두기 뒤): 결과창 숫자 (105 QA 2: 상한 전 값을 보여 줬음) */
export function gainedXp(lv0: number, x0: number, lv1: number, x1: number): number {
  if (lv1 === lv0) return Math.max(0, x1 - x0);
  let n = xpToNext(lv0) - x0;
  for (let l = lv0 + 1; l < lv1; l++) n += xpToNext(l);
  return n + x1;
}
export function addMemberXp(m: GuildMember, amt: number, cap: number): number[] {
  const bank = (lv: number, xp: number) => (lv >= MAX_LEVEL ? 0 : Math.min(xp, xpToNext(lv) - 1));
  if (m.lv >= cap) { m.xp = bank(m.lv, m.xp + amt); return []; }
  const p = { level: m.lv, xp: m.xp };
  const ups = addXp(p, amt);
  if (p.level > cap) { m.lv = cap; m.xp = bank(cap, xpToNext(cap) - 1); } else { m.lv = p.level; m.xp = bank(m.lv, p.xp); }
  return ups.filter(l => l <= cap);
}
/**
 * 그 칸 경험치 (자기 레벨 기준): ±5 칸 가득, 더 낮은 칸은 한 레벨에 10%씩 덜 (30%까지),
 * 더 높은 칸은 자기 몫이되 한 판에 다음 레벨 필요량 × highStageCap까지 (6레벨 높은 칸 90% → 30%, 2026-10-28 Lim)
 */
export function memberXp(m: Pick<GuildMember, 'lv'>, o: { stage: number; diff: DiffName; grade: Grade | null; raid: 0 | 10 | 20; win: boolean }): number {
  const base = clearXp(m.lv, o.diff, o.grade, { raid: o.raid, win: o.win });
  const low = m.lv - XP_BAND - o.stage, high = o.stage - XP_BAND - m.lv;
  if (low > 0) return Math.round(base * lowStageXp(low));
  return high > 0 ? Math.min(base, Math.round(xpToNext(m.lv) * highStageCap(high))) : base;
}

/** 타고난 능력치 = Lv 1 바탕 (1000명 줄의 그 사람) */
export const birthStats = (m: Pick<GuildMember, 'nick' | 'pers' | 'cls'>): Stats => ({ ...profileOf(m.nick, m.pers, CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged').stats });

/**
 * 능력치는 레벨업할 때 (Lim 10-18 · 104): 오른 레벨마다 학습력만큼 점수 (0.9~1.1), 레벨 하나가 20% 확률로 두 배 (LV_DOUBLE, Lim 10-20 · 103),
 * 1점마다 오를 칸 하나 +1 (성장 결 무게 × 최근 「한 일」 표, 97 · 103). 레벨마다 차례로: 한 레벨에서 오르는 칸은 서로 다름 (두 배 = 다른 두 칸, Lim 10-20).
 * deed = 출전한 판에서 한 일 (쉬는 판은 표 없음). 20인 칸은 안 오르고, 오를 칸이 없으면 점수를 3점까지 모아 둠
 */
export function growStats(m: GuildMember, levels: number, deed: Deed | undefined, r: () => number): { k: StatKey; to: number; why: string }[] {
  if (deed) m.votes = [...m.votes, DEED_STATS[deed]].slice(-VOTE_KEEP);
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged', out: { k: StatKey; to: number; why: string }[] = [];
  const per = statPerLevel(m.learn);
  let dbl = 0, dblStats: StatKey[] = [];
  for (let i = 0; i < levels; i++) {
    const two = r() < LV_DOUBLE;
    if (two) dbl++;
    m.sxp = Math.round((m.sxp + (two ? 2 : 1) * per) * 1000) / 1000;
    const got = spendPoints(m, role, r, []);
    for (const k of got) out.push({ k, to: m.stats[k], why: deed && DEED_STATS[deed].includes(k) ? DEED_WHY[deed] : '' });
    if (two) dblStats = got;
  }
  if (levels > 0) {
    m.lastStatGains = [...new Set(out.map(x => x.k))];
    if (dbl) { m.lastDouble = dbl; m.lastDoubleStats = dblStats; } else { delete m.lastDouble; delete m.lastDoubleStats; }
  }
  return out;
}
/**
 * 판 뒤 길드 정산 (93 6-1 · 97). party = 전투가 끝날 때 파티원 (deed = 그 판에서 가장 두드러진 일), roster = 전투에 넘긴 편성, kind = 콘텐츠 종류.
 * 이긴 판만: 출전한 길드원 레벨 경험치 (레벨업하면 능력치), 쉬는 명단 레벨 경험치 30%, 길드파티 (자리 절반 이상이 길드원)면 명성 · 길드 첫 처치 · 주간 목표 출전 기록
 */
export function guildAfter(
  save: SaveData, r: () => number,
  o: { win: boolean; quit: boolean; grade: Grade | null; diff: DiffName; stage: number; raid: 0 | 10 | 20; content: string; kind: string; party: { nick: string; deed?: Deed }[]; roster: RosterEntry[]; encs?: readonly string[]; time?: number; requestNicks?: readonly string[]; /** 판 전 내 레벨 (낮은 장소 판정, 105 QA: 판 뒤 레벨이면 레벨업한 판이 낮은 장소가 됨) */ myLv?: number; /** 주간 도전 판 (길드 첫 처치 없음) */ chal?: boolean },
): GuildAfter {
  const g = save.guild, out: GuildAfter = { members: [], rest: 0, boosted: [], fame: 0, first: false, low: false };
  if (o.quit || !o.win) return out;
  const cap = topLevel(save), went = new Set<number>(), requests = new Set(o.requestNicks);
  const firstKey = `${o.content}|${o.diff}`;
  const guildParty = isGuildParty(o.roster), low = guildParty && o.stage < (o.myLv ?? cap) - FAME_LOW_GAP; // 낮은 장소: 명성 · 첫 처치 없음 (103), 판 전 레벨로
  // 주간 도전은 첫 처치 아님 (105 QA), 보충 장소 (113 4-3)도 아님: 새 장소 수만큼 길드 성장이 빨라지지 않게
  const first = guildParty && !low && !o.chal && (o.kind === 'dungeon' || o.kind === 'raid') && !CONTENT.find(c => c.key === o.content)?.anchor && !g.firsts.includes(firstKey);
  for (const e of o.roster) {
    const m = e.gid != null ? g.members.find(x => x.id === e.gid) : null;
    if (!m) continue;
    went.add(m.id);
    m.runs++;
    // 부탁은 완료한 이번 판의 출전 경험치에만 적용한다. 합산 후 한 번에 레벨업·능력치를 처리한다.
    const lv0 = m.lv, x0 = m.xp, ups = addMemberXp(m, memberXp(m, o) * (requests.has(m.nick) ? REQ.xpMult : 1), cap);
    const xp = gainedXp(lv0, x0, m.lv, m.xp); // 실제로 오른 값 (내 레벨 상한이면 0)
    const stats = growStats(m, ups.length, o.party.find(p => p.nick === m.nick)?.deed, r);
    out.members.push({ nick: m.nick, xp, ups, stats: stats.map(x => ({ ...x, shown: x.to })), lv: m.lv, ...(ups.length && m.lastDouble ? { dbl: m.lastDouble, dblStats: m.lastDoubleStats ?? [] } : {}) }); // 저장 값 = 화면 숫자 (레벨업 점수까지 듦, 104)
  }
  for (const m of g.members) if (!went.has(m.id)) {
    // 후원 (98): 남은 판이 있고 더 오를 수 있으면 출전만큼, 1판 씀
    const boost = m.boost > 0 && m.lv < cap;
    const lv0 = m.lv, x0 = m.xp, ups = addMemberXp(m, Math.round(memberXp(m, o) * (boost ? 1 : REST_SHARE)), cap), xp = gainedXp(lv0, x0, m.lv, m.xp);
    if (boost) { m.boost--; out.boosted.push({ nick: m.nick, xp, left: m.boost }); }
    out.rest += xp;
    if (ups.length) growStats(m, ups.length, undefined, r); // 쉬는 판에 오른 레벨도 능력치
  }
  out.low = low;
  if (guildParty) {
    g.wins++;
    out.fame = low ? 0 : o.raid === 20 ? FAME.raid20 : o.raid === 10 ? FAME.raid10 : o.kind === 'explore' ? FAME.explore : FAME.dungeon;
    if (first) {
      g.firsts.push(firstKey); out.fame += FAME.first; out.first = true;
      g.firstLog = [...g.firstLog, { key: firstKey, day: dayKey(), sec: Math.round(o.time ?? 0), nicks: out.members.map(x => x.nick) }].slice(-200);
    }
    g.fame += out.fame;
  }
  return out;
}
