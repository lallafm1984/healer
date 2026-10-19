/**
 * 길드 v2 (93 · 97, 사슬 4번): 결성 · 모집 공고 · 명성 지원자 영입 · 보내기 · 스킬 다시 뽑기 · 규모별 편성 · 판 뒤 (레벨 경험치 · 능력치 · 명성 · 첫 처치).
 * 화면과 분리된 규칙. 난수는 받아서 씀 (테스트에서 고정).
 */
import { resourceBalance, spendResource } from './resources';
import { ABILITIES, AB_ODDS, rollAbility } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../data/classes';
import type { DiffName } from '../data/difficulty';
import type { Encounter } from '../data/encounters';
import { dayOffset, memberLevel, profileOf, STAT_KEYS, type StatKey, type Stats } from '../data/fm';
import {
  APP_DAYS, appsPerDay, SPONSOR, sponsorGold, DEED_STATS, DEED_WHY, FAME, guildLvOf, habitOf, lowStageXp, POST_LV_GAP, postGold, POST, REQ, REST_SHARE, rerollGold,
  knowGain, knowStage, memberSkillLevel, STORY, statPerLevel, statWeights, VOTE_KEEP, XP_BAND, type Deed, type GuildMember, type StoryKey,
} from '../data/guild';
import { PARTY_POOL, type PoolMember } from '../data/nicknames';
import { PERS } from '../data/personalities';
import { addXp, clearXp, GUILD_LEVEL, MAX_LEVEL, xpToNext, type Grade } from '../data/progression';
import type { RosterEntry } from '../engine/types';
import { FEATURES } from '../data/features';
import { topLevel, type SaveData } from '../platform/storage';
import { dayKey } from './clock';
import { TUT } from './tutorial';

/** 길드가 열렸는지 (Lv 15, 튜토리얼 뒤). dev = 개발 빌드 「레벨 잠금 무시」로 열림. 출시판에서 빼 두면 늘 닫힘 (features.ts) */
export function guildOpen(save: SaveData): { ok: boolean; dev: boolean; why: string } {
  if (!FEATURES.guild) return { ok: false, dev: false, why: '' };
  if (save.tut < TUT.done) return { ok: false, dev: false, why: '튜토리얼을 마치면 열림' };
  const under = topLevel(save) < GUILD_LEVEL;
  if (under && !save.settings.devUnlock) return { ok: false, dev: false, why: `Lv ${GUILD_LEVEL}에 열림` };
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

/** 길드원 하나 (1000명 가운데 사람, 그 사람 지금 레벨 = 세상 레벨). 스토리 동료는 고정 능력치를 덧씀 */
export function newMember(save: SaveData, p: Pick<Person, 'nick' | 'cls' | 'pers' | 'ab'>, lv: number, story?: StoryKey): GuildMember {
  const prof = profileOf(p.nick, p.pers);
  const stats = { ...prof.stats, ...(story ? STORY[story].boost : {}) };
  return { id: 0, nick: p.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv: Math.max(1, Math.min(topLevel(save), lv)), xp: 0, stats, lastStatGains: [], learn: prof.learn, steady: prof.steady, sxp: 0, votes: [], know: {}, boost: 0, runs: 0, joined: Date.now(), ...(story ? { story } : {}) };
}
/** 그 사람의 지금 레벨 (공개모집과 같은 세상 레벨: 내 Lv × 빠르기) */
export const worldLevel = (save: SaveData, p: Pick<Person, 'fm'>) => memberLevel(p.fm.speed, topLevel(save));

function join(save: SaveData, m: GuildMember): GuildMember {
  const g = save.guild;
  const nm: GuildMember = { ...m, id: g.nextId++, joined: Date.now() };
  g.members.push(nm);
  return nm;
}

// ---------- 스토리 동료 이슬 · 칼날 (93 4-4) ----------
const hasStory = (save: SaveData, k: StoryKey) => save.guild.members.some(m => m.story === k) || save.guild.storyWait.includes(k);
/** 첫 10인 레이드 클리어 = 이슬, 첫 20인 = 칼날. 정원이 차 있으면 영입 화면에서 「합류 대기」. 들어오면 합류 카드 한 번 */
export function storyArrive(save: SaveData, k: StoryKey): 'joined' | 'wait' | null {
  const g = save.guild;
  if (!g.founded || hasStory(save, k)) return null;
  g.storyCard = k;
  if (full(save)) { g.storyWait.push(k); return 'wait'; }
  const st = STORY[k];
  join(save, newMember(save, { nick: st.nick, cls: st.cls, pers: st.pers, ab: st.ab }, topLevel(save), k));
  return 'joined';
}
/** 기다리는 스토리 동료 초대 (무료) */
export function inviteStory(save: SaveData, k: StoryKey): string {
  const g = save.guild;
  if (!g.storyWait.includes(k)) return '기다리는 동료 아님';
  if (full(save)) return `정원 ${capOf(save).cap}명이 다 참`;
  g.storyWait = g.storyWait.filter(x => x !== k);
  const st = STORY[k];
  join(save, newMember(save, { nick: st.nick, cls: st.cls, pers: st.pers, ab: st.ab }, topLevel(save), k));
  return '';
}

// ---------- 결성 (93 4-1) ----------
/** 말없는탱과 근접 1명 · 원거리 2명으로 결성한다. */
export function foundGuild(save: SaveData): string[] | null {
  const g = save.guild;
  if (g.founded || !guildOpen(save).ok) return null;
  g.founded = true;
  const out: string[] = [];
  const st = STORY.tank;
  join(save, newMember(save, { nick: st.nick, cls: st.cls, pers: st.pers, ab: st.ab }, topLevel(save), 'tank'));
  out.push(st.nick);
  const dealers = (['rogue', 'mage', 'archer'] as const).map(cls => PEOPLE.find(p => p.cls === cls && !isIn(save, p.nick))!);
  for (const p of dealers) { join(save, newMember(save, p, worldLevel(save, p))); out.push(p.nick); }
  return out;
}

// ---------- 모집 공고: 전 직업 무작위 ----------
/** 아직 길드원이 아닌 사람 가운데 */
function strangers(save: SaveData, ok: (p: Person) => boolean, taken: Set<string>): Person[] {
  return PEOPLE.filter(p => !isIn(save, p.nick) && !taken.has(p.nick) && ok(p));
}
function drawOne(list: Person[], r: () => number): Person | null {
  return list.length ? list[Math.min(list.length - 1, Math.floor(r() * list.length))] : null;
}
/** 고급 스킬은 희귀가 아니다. 희귀 성격 또는 희귀 등급 스킬을 가진 사람을 하나의 희귀 풀로 센다. */
export const rareCandidate = (p: Pick<Person, 'pers' | 'ab'>) => 'rare' in PERS[p.pers] || ABILITIES[p.ab]?.grade === 'epic';
export const postCost = (save: SaveData) => postGold(topLevel(save));
/** 내 Lv − 5 이상, 중복 없이 3명. 희귀 여부를 먼저 굴린 뒤 해당 풀에서 직업 구분 없이 뽑는다. */
export function makeCandidates(save: SaveData, r: () => number): GuildMember[] {
  const my = topLevel(save), taken = new Set<string>(), out: GuildMember[] = [];
  for (let i = 0; i < POST.cands; i++) {
    let list = strangers(save, p => worldLevel(save, p) >= my - POST_LV_GAP, taken);
    if (!list.length) list = strangers(save, () => true, taken);
    const rare = r() < POST.rareChance;
    const pool = list.filter(p => rareCandidate(p) === rare);
    const p = drawOne(pool.length ? pool : list, r);
    if (!p) break;
    taken.add(p.nick);
    out.push(newMember(save, p, worldLevel(save, p)));
  }
  return out;
}
export function postRecruit(save: SaveData, r: () => number): string {
  const g = save.guild, gold = postCost(save);
  if (full(save)) return `정원 ${capOf(save).cap}명이 다 참`;
  if (resourceBalance(save, 'gold') < gold) return `골드 부족 (${gold.toLocaleString()} 필요)`;
  spendResource(save, 'gold', gold);
  g.post = { cands: makeCandidates(save, r) };
  return '';
}
/** 공고 지원자 중 1명 영입. 나머지는 돌아감 */
export function hire(save: SaveData, i: number): string {
  const g = save.guild, c = g.post?.cands[i];
  if (!c) return '지원자 없음';
  if (full(save)) return `정원 ${capOf(save).cap}명이 다 참`;
  join(save, c);
  g.post = null;
  return '';
}

// ---------- 명성 지원자 (93 4-2 ③) ----------
const addDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** 하루에 한 번: 떠날 날이 지난 사람은 떠나고, 길드 Lv만큼 새 지원자 (길드에 적은 역할부터, 레벨 상관없이) */
export function refreshApps(save: SaveData, r: () => number, now = Date.now()): void {
  const g = save.guild, day = dayKey(now);
  if (!g.founded) return;
  g.apps = g.apps.filter(a => a.until >= day && !isIn(save, a.m.nick));
  if (g.appsDay === day) return;
  g.appsDay = day;
  const n = appsPerDay(capOf(save).lv), taken = new Set(g.apps.map(a => a.m.nick));
  for (let i = 0; i < n; i++) {
    const count = (role: string) => g.members.filter(m => CLASSES[m.cls].role === role).length + g.apps.filter(a => CLASSES[a.m.cls].role === role).length;
    const role = (['tank', 'melee', 'ranged'] as const).slice().sort((a, b) => count(a) / want(a) - count(b) / want(b))[0];
    const p = drawOne(strangers(save, x => CLASSES[x.cls].role === role, taken), r);
    if (!p) break;
    taken.add(p.nick);
    g.apps.push({ m: newMember(save, p, worldLevel(save, p)), until: addDays(day, APP_DAYS - 1) });
  }
}
/** 역할 비율 (파티 구성 탱커 25 · 근접 30 · 원거리 45%) */
const want = (role: string) => (role === 'tank' ? 0.25 : role === 'melee' ? 0.3 : 0.45);
export function hireApp(save: SaveData, i: number): string {
  const a = save.guild.apps[i];
  if (!a) return '지원자 없음';
  if (full(save)) return `정원 ${capOf(save).cap}명이 다 참`;
  join(save, a.m);
  save.guild.apps.splice(i, 1);
  return '';
}

// ---------- 관리 ----------
const memberOf = (save: SaveData, id: number) => save.guild.members.find(m => m.id === id) || null;

/** 골드 지원: 그 길드원 Lv × 20 골드 = 5판. 남은 지원이 있거나 내 레벨과 같으면 안 됨. */
export function sponsorWhy(save: SaveData, m: GuildMember): string {
  if (m.boost > 0) return '지원 중';
  if (m.lv >= topLevel(save)) return '내 레벨과 같음';
  return '';
}
export function sponsor(save: SaveData, id: number): string {
  const m = memberOf(save, id);
  if (!m) return '길드원 없음';
  const why = sponsorWhy(save, m);
  if (why) return why;
  const c = sponsorGold(m.lv);
  if (resourceBalance(save, 'gold') < c) return `골드 부족 (${c.toLocaleString()} 필요)`;
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
  if (!ids.length) return '후원할 쉬는 길드원 없음';
  if (resourceBalance(save, 'gold') < gold) return `골드 부족 (${gold.toLocaleString()} 필요)`;
  for (const id of ids) sponsor(save, id);
  return '';
}

/** 스킬 다시 뽑기 (내 Lv × 60 골드): 같은 직업 안에서. 스토리 동료는 안 됨 (고유) */
export function rerollAbility(save: SaveData, id: number, r: () => number): string {
  const m = memberOf(save, id);
  if (!m) return '길드원 없음';
  if (m.story) return '고유 스킬은 다시 뽑지 않음';
  const c = rerollGold(topLevel(save));
  if (resourceBalance(save, 'gold') < c) return `골드 부족 (${c.toLocaleString()} 필요)`;
  spendResource(save, 'gold', c);
  m.ab = rollAbility(m.cls, r, AB_ODDS.normal);
  return '';
}

/** 길드에서 내보내고 모든 규모의 편성에서 제외한다. */
export function release(save: SaveData, id: number): boolean {
  const g = save.guild, m = memberOf(save, id);
  if (!m) return false;
  g.members = g.members.filter(x => x.id !== id);
  for (const k of Object.keys(g.picks) as (keyof typeof g.picks)[]) g.picks[k] = g.picks[k]!.filter(x => x !== id);
  return true;
}

// ---------- 길드파티 편성 ----------
/** 공략 숙지 단계 (전투 키 → 1~3, 0은 뺌) */
export function knowStages(m: Pick<GuildMember, 'know'>): Record<string, number> {
  return Object.fromEntries(Object.entries(m.know).map(([k, p]) => [k, knowStage(p)] as const).filter(([, s]) => s > 0));
}
/** 전투에 넘기는 길드원: 자기 레벨 · 능력치 (그날 꾸준함 흔들림) · 스킬 레벨 · 버릇 (침착 · 판단) */
export function memberEntry(save: SaveData, m: GuildMember, seed = 1): RosterEntry {
  return {
    role: CLASSES[m.cls].role, pers: m.pers, nick: m.nick, cls: m.cls, ab: m.ab, star: memberSkillLevel(m), lv: m.lv, pub: true,
    fm: { stats: { ...m.stats }, off: dayOffset(m.steady, seed, m.nick), steady: m.steady }, habit: habitOf(m.stats), gid: m.id, know: knowStages(m),
  };
}

/** 자리: 탱커 수와 딜러 수 (근접·원거리 섞어도 됨) */
export const slotsOf = (enc: Encounter) => ({ tank: enc.comp.tank, dps: enc.comp.melee + enc.comp.ranged });
/** 규모 (탐험 3 · 5인 · 10 · 20인): 지난 편성을 따로 기억 */
export const sizeKey = (enc: Encounter): '3' | '5' | '10' | '20' => { const n = enc.comp.tank + enc.comp.melee + enc.comp.ranged + 1; return n <= 3 ? '3' : n <= 5 ? '5' : n <= 10 ? '10' : '20'; };
/** 편성 순서 (지난 편성 밖): 레벨 → 합류 순 */
const order = (save: SaveData) => save.guild.members.slice().sort((a, b) => b.lv - a.lv || a.id - b.id);

/** 처음 편성: 그 규모의 지난 편성 중 남아 있는 사람 + 빈자리는 레벨 높은 순 */
export function autoPick(save: SaveData, enc: Encounter, fresh = false): number[] {
  const sl = slotsOf(enc), ms = save.guild.members;
  const pick: number[] = [];
  const fits = (m: GuildMember) => {
    const tank = CLASSES[m.cls].role === 'tank';
    const n = pick.filter(id => CLASSES[ms.find(x => x.id === id)!.cls].role === 'tank').length;
    return tank ? n < sl.tank : pick.length - n < sl.dps;
  };
  if (!fresh) for (const id of save.guild.picks[sizeKey(enc)] ?? []) { const m = ms.find(x => x.id === id); if (m && fits(m)) pick.push(id); }
  for (const m of order(save)) if (!pick.includes(m.id) && fits(m)) pick.push(m.id);
  return pick;
}

/** 편성에 넣고 빼기. 자리가 다 찼으면 이유 */
export function togglePick(save: SaveData, enc: Encounter, pick: number[], id: number): { pick: number[]; msg: string } {
  if (pick.includes(id)) return { pick: pick.filter(x => x !== id), msg: '' };
  const m = save.guild.members.find(x => x.id === id);
  if (!m) return { pick, msg: '' };
  const sl = slotsOf(enc), ms = save.guild.members;
  const tanks = pick.filter(x => CLASSES[ms.find(y => y.id === x)!.cls].role === 'tank').length;
  if (CLASSES[m.cls].role === 'tank' ? tanks >= sl.tank : pick.length - tanks >= sl.dps) return { pick, msg: `${CLASSES[m.cls].role === 'tank' ? '탱커' : '딜러'} 자리가 다 참` };
  return { pick: [...pick, id], msg: '' };
}
export const savePick = (save: SaveData, enc: Encounter, pick: number[]) => { save.guild.picks[sizeKey(enc)] = pick.slice(); };

/**
 * 길드파티: 고른 길드원 + 빈자리는 공개모집 파티 (같은 시드)에서 채움 (02 9-2: 길드원이 모자라도 입장 가능).
 * 공개모집 쪽은 역할이 맞는 사람부터 순서대로
 */
export function guildRoster(save: SaveData, pick: number[], publicParty: RosterEntry[], enc: Encounter, seed = 1): RosterEntry[] {
  const ms = pick.map(id => save.guild.members.find(m => m.id === id)).filter((m): m is GuildMember => !!m).map(m => memberEntry(save, m, seed));
  const sl = slotsOf(enc);
  const needTank = sl.tank - ms.filter(m => m.role === 'tank').length;
  const needDps = sl.dps - ms.filter(m => m.role !== 'tank').length;
  const names = new Set(ms.map(m => m.nick));
  const fill = (list: RosterEntry[], n: number) => list.filter(p => !names.has(p.nick)).slice(0, Math.max(0, n));
  const tanks = fill(publicParty.filter(p => p.role === 'tank'), needTank);
  const dps = fill(publicParty.filter(p => p.role !== 'tank'), needDps);
  return [...ms.filter(m => m.role === 'tank'), ...tanks, ...ms.filter(m => m.role !== 'tank'), ...dps];
}
/** 공개모집에서 빼는 사람: 길드원 (내 길드원이 파티 찾기로 들어오면 어색함, 93 7-2) */
export const guildNicks = (save: SaveData): Set<string> => new Set(save.guild.members.map(m => m.nick));

// ---------- 판 뒤 ----------
/** 길드파티 = 파티원 자리 절반 이상이 길드원 (명성 · 첫 처치 · 주간 목표 · 일일 임무 「길드파티로 클리어」 모두 이 기준) */
export const isGuildParty = (roster: readonly RosterEntry[]) => roster.some(e => e.gid != null) && roster.filter(e => e.gid != null).length * 2 >= roster.length;
export interface GuildAfter {
  /** 출전한 길드원: 레벨 경험치 · 레벨 업 · 오른 능력치 (왜) · 오른 보스 공략 숙지 단계 */
  members: { nick: string; xp: number; ups: number[]; stats: { k: StatKey; to: number; why: string }[]; know?: { enc: string; stage: number } }[];
  /** 쉬는 명단이 받은 경험치 합 · 그 가운데 후원으로 받은 사람 (경험치 · 남은 판) */
  rest: number;
  boosted: { nick: string; xp: number; left: number }[];
  fame: number;
  /** 길드 첫 처치 (장소 · 난이도) */
  first: boolean;
}

/** 레벨 경험치를 더함 (상한 = 내 레벨, 상한에서도 다음 레벨 바로 앞까지 모아 둠: 내가 레벨업하면 다음 판에 바로 따라옴) */
export function addMemberXp(m: GuildMember, amt: number, cap: number): number[] {
  const bank = (lv: number, xp: number) => (lv >= MAX_LEVEL ? 0 : Math.min(xp, xpToNext(lv) - 1));
  if (m.lv >= cap) { m.xp = bank(m.lv, m.xp + amt); return []; }
  const p = { level: m.lv, xp: m.xp };
  const ups = addXp(p, amt);
  if (p.level > cap) { m.lv = cap; m.xp = bank(cap, xpToNext(cap) - 1); } else { m.lv = p.level; m.xp = bank(m.lv, p.xp); }
  return ups.filter(l => l <= cap);
}
/** 그 칸 경험치 (자기 레벨 기준): ±5 칸 가득, 더 높은 칸도 자기 몫까지, 더 낮은 칸은 한 레벨에 10%씩 덜 (30%까지) */
export function memberXp(m: Pick<GuildMember, 'lv'>, o: { stage: number; diff: DiffName; grade: Grade | null; raid: 0 | 10 | 20; win: boolean }): number {
  const base = clearXp(m.lv, o.diff, o.grade, { raid: o.raid, win: o.win });
  const gap = m.lv - XP_BAND - o.stage;
  return Math.round(base * (gap > 0 ? lowStageXp(gap) : 1));
}

/** 타고난 능력치 (1000명 줄의 그 사람, 스토리 동료는 고정 능력치를 덧씀): 잠재력의 바탕 */
export const birthStats = (m: Pick<GuildMember, 'nick' | 'pers' | 'story'>): Stats => ({ ...profileOf(m.nick, m.pers).stats, ...(m.story ? STORY[m.story].boost : {}) });
/** 모아 두는 점수 (오를 칸이 없을 때, 레벨 상한이 오르면 씀) */
const SXP_BANK = 3;

/**
 * 능력치는 레벨업할 때 (Lim 10-18): 오른 레벨마다 학습력만큼 점수, 1점마다 오를 칸 하나 +1 (역할 핵심 · 최근 「한 일」 표 무게, 97).
 * deed = 출전한 판에서 한 일 (쉬는 판은 표 없음). 끝 (상한 · 잠재력)에 닿은 칸은 안 오르고, 오를 칸이 없으면 점수를 3점까지 모아 둠
 */
export function growStats(m: GuildMember, levels: number, deed: Deed | undefined, r: () => number): { k: StatKey; to: number; why: string }[] {
  if (deed) m.votes = [...m.votes, DEED_STATS[deed]].slice(-VOTE_KEEP);
  m.sxp = Math.round((m.sxp + levels * statPerLevel(m.learn)) * 1000) / 1000;
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged', birth = birthStats(m), out: { k: StatKey; to: number; why: string }[] = [];
  while (m.sxp + 1e-9 >= 1) {
    const w = statWeights(m, role, birth), tot = STAT_KEYS.reduce((a, k) => a + w[k], 0);
    if (tot <= 0) { m.sxp = Math.min(m.sxp, SXP_BANK); break; }
    let x = r() * tot, k: StatKey = STAT_KEYS[0];
    for (const s of STAT_KEYS) { x -= w[s]; if (x <= 0) { k = s; break; } }
    m.sxp = Math.round((m.sxp - 1) * 1000) / 1000; m.stats[k]++;
    out.push({ k, to: m.stats[k], why: deed && DEED_STATS[deed].includes(k) ? DEED_WHY[deed] : '' });
  }
  if (levels > 0) m.lastStatGains = [...new Set(out.map(x => x.k))];
  return out;
}

/**
 * 판 뒤 길드 정산 (93 6-1 · 97). party = 전투가 끝날 때 파티원 (deed = 그 판에서 가장 두드러진 일), roster = 전투에 넘긴 편성, kind = 콘텐츠 종류.
 * 이긴 판만: 출전한 길드원 레벨 경험치 (레벨업하면 능력치) · 공략 숙지, 쉬는 명단 레벨 경험치 30%, 길드파티 (자리 절반 이상이 길드원)면 명성 · 길드 첫 처치 · 주간 목표 출전 기록
 */
export function guildAfter(
  save: SaveData, r: () => number,
  o: { win: boolean; quit: boolean; grade: Grade | null; diff: DiffName; stage: number; raid: 0 | 10 | 20; content: string; kind: string; party: { nick: string; deed?: Deed }[]; roster: RosterEntry[]; encs?: readonly string[]; time?: number; requestNicks?: readonly string[] },
): GuildAfter {
  const g = save.guild, out: GuildAfter = { members: [], rest: 0, boosted: [], fame: 0, first: false };
  if (o.quit || !o.win) return out;
  const cap = topLevel(save), went = new Set<number>(), requests = new Set(o.requestNicks);
  const firstKey = `${o.content}|${o.diff}`;
  const guildParty = isGuildParty(o.roster);
  const first = guildParty && (o.kind === 'dungeon' || o.kind === 'raid') && !g.firsts.includes(firstKey);
  for (const e of o.roster) {
    const m = e.gid != null ? g.members.find(x => x.id === e.gid) : null;
    if (!m) continue;
    went.add(m.id);
    m.runs++;
    // 부탁은 완료한 이번 판의 출전 경험치에만 적용한다. 합산 후 한 번에 레벨업·능력치를 처리한다.
    const xp = memberXp(m, o) * (requests.has(m.nick) ? REQ.xpMult : 1);
    const ups = addMemberXp(m, xp, cap);
    const stats = growStats(m, ups.length, o.party.find(p => p.nick === m.nick)?.deed, r);
    // 공략 숙지 (93 5-4): 이긴 판의 전투마다 학습력만큼, 보스 (마지막 전투) 단계가 오르면 결과 줄
    const boss = o.encs?.[o.encs.length - 1], kb = boss ? knowStage(m.know[boss] ?? 0) : 0;
    for (const k of new Set(o.encs ?? [])) m.know[k] = Math.round(((m.know[k] ?? 0) + knowGain(m.learn)) * 100) / 100;
    const ka = boss ? knowStage(m.know[boss]) : 0;
    out.members.push({ nick: m.nick, xp, ups, stats, ...(boss && ka > kb ? { know: { enc: boss, stage: ka } } : {}) });
  }
  for (const m of g.members) if (!went.has(m.id)) {
    // 후원 (98): 남은 판이 있고 더 오를 수 있으면 출전만큼, 1판 씀
    const boost = m.boost > 0 && m.lv < cap;
    const xp = Math.round(memberXp(m, o) * (boost ? 1 : REST_SHARE)), ups = addMemberXp(m, xp, cap);
    if (boost) { m.boost--; out.boosted.push({ nick: m.nick, xp, left: m.boost }); }
    out.rest += xp;
    if (ups.length) growStats(m, ups.length, undefined, r); // 쉬는 판에 오른 레벨도 능력치
  }
  if (guildParty) {
    g.wins++;
    out.fame = o.raid === 20 ? FAME.raid20 : o.raid === 10 ? FAME.raid10 : FAME.win;
    if (first) {
      g.firsts.push(firstKey); out.fame += FAME.first; out.first = true;
      g.firstLog = [...g.firstLog, { key: firstKey, day: dayKey(), sec: Math.round(o.time ?? 0), nicks: out.members.map(x => x.nick) }].slice(-200);
    }
    g.fame += out.fame;
  }
  return out;
}
