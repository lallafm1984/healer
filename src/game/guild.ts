/**
 * 길드 v2 (93 · 97, 사슬 4번): 결성 · 영입 셋 (친구 초대 · 모집 공고 · 명성 지원자) · 보내기 · 스킬 다시 뽑기 · 규모별 편성 · 판 뒤 (레벨 경험치 · 능력치 · 명성 · 첫 처치).
 * 화면과 분리된 규칙. 난수는 받아서 씀 (테스트에서 고정).
 */
import { resourceBalance, spendResource } from './resources';
import { ABILITIES, AB_ODDS, rollAbility } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../data/classes';
import type { DiffName } from '../data/difficulty';
import type { Encounter } from '../data/encounters';
import { dayOffset, memberLevel, profileOf, STAT_KEYS, type StatKey } from '../data/fm';
import {
  APP_DAYS, appsPerDay, BOND_JOIN, bondLv, DEED_STATS, DEED_WHY, FAME, FRIEND_LV, guildLvOf, habitOf, lowStageXp, POST_LV_GAP, postGold, POSTS, REST_SHARE, rerollGold,
  starOfBond, STORY, statNeed, statWeights, SXP, VOTE_KEEP, XP_BAND, type Deed, type GuildMember, type PostKind, type StoryKey,
} from '../data/guild';
import { PARTY_POOL, STORY_NICKS, type PoolMember } from '../data/nicknames';
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

/** 인연 점수 · Lv */
export const bondPt = (save: SaveData, nick: string) => save.users[nick]?.pt ?? 0;
export const bondOf = (save: SaveData, nick: string) => bondLv(bondPt(save, nick));
const raiseBond = (save: SaveData, nick: string, pt: number) => { const u = (save.users[nick] ??= { pt: 0, met: 0, wins: 0, saved: 0, mvp: 0 }); u.pt = Math.max(u.pt, pt); };

const isIn = (save: SaveData, nick: string) => save.guild.members.some(m => m.nick === nick);
const isAway = (save: SaveData, nick: string) => save.guild.away.some(m => m.nick === nick);

/** 길드원 하나 (1000명 가운데 사람, 그 사람 지금 레벨 = 세상 레벨). 스토리 동료는 고정 능력치를 덧씀 */
export function newMember(save: SaveData, p: Pick<Person, 'nick' | 'cls' | 'pers' | 'ab'>, lv: number, story?: StoryKey): GuildMember {
  const prof = profileOf(p.nick, p.pers);
  const stats = { ...prof.stats, ...(story ? STORY[story].boost : {}) };
  return { id: 0, nick: p.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv: Math.max(1, Math.min(topLevel(save), lv)), xp: 0, stats, learn: prof.learn, steady: prof.steady, sxp: 0, votes: [], runs: 0, joined: Date.now(), ...(story ? { story } : {}) };
}
/** 그 사람의 지금 레벨 (공개모집과 같은 세상 레벨: 내 Lv × 빠르기) */
export const worldLevel = (save: SaveData, p: Pick<Person, 'fm'>) => memberLevel(p.fm.speed, topLevel(save));

function join(save: SaveData, m: GuildMember): GuildMember {
  const g = save.guild;
  const nm: GuildMember = { ...m, id: g.nextId++, joined: Date.now() };
  g.members.push(nm);
  g.away = g.away.filter(x => x.nick !== nm.nick);
  raiseBond(save, nm.nick, BOND_JOIN);
  return nm;
}

// ---------- 결성 (93 4-1) ----------
/**
 * Lv 15 결성 이야기: 스토리 동료 말없는탱 (탱커) + 인연 점수가 가장 높은 딜러 3명 (같으면 살려 준 횟수 · 함께 이긴 판 순).
 * 만난 사람이 모자라면 비워 둠 (공개모집이 채움). 이미 결성했거나 길드가 안 열렸으면 null
 */
export function foundGuild(save: SaveData): string[] | null {
  const g = save.guild;
  if (g.founded || !guildOpen(save).ok) return null;
  g.founded = true;
  const out: string[] = [];
  const st = STORY.tank;
  join(save, newMember(save, { nick: st.nick, cls: st.cls, pers: st.pers, ab: st.ab }, topLevel(save), 'tank'));
  out.push(st.nick);
  const dealers = Object.entries(save.users).map(([nick, u]) => ({ p: personOf(nick), u })).filter(x => x.p && CLASSES[x.p.cls].role !== 'tank' && x.u.pt > 0 && !isIn(save, x.p.nick))
    .sort((a, b) => b.u.pt - a.u.pt || b.u.saved - a.u.saved || b.u.wins - a.u.wins).slice(0, 3);
  for (const { p } of dealers) { join(save, newMember(save, p!, worldLevel(save, p!))); out.push(p!.nick); }
  return out;
}

// ---------- 친구 초대 (93 4-2 ①) ----------
/** 친구 (인연 Lv 2 이상, 길드에 없는 사람): 인연 순. 보낸 사람은 키운 그대로 */
export function friendsOf(save: SaveData): { nick: string; person: Person | null; away: GuildMember | null; pt: number }[] {
  return Object.entries(save.users).filter(([nick, u]) => bondLv(u.pt) >= FRIEND_LV && !isIn(save, nick) && !STORY_NICKS.includes(nick))
    .map(([nick, u]) => ({ nick, person: personOf(nick), away: save.guild.away.find(m => m.nick === nick) ?? null, pt: u.pt }))
    .filter(x => x.person || x.away).sort((a, b) => b.pt - a.pt);
}
export function inviteFriend(save: SaveData, nick: string): string {
  if (full(save)) return `정원 ${capOf(save).cap}명이 다 참`;
  if (bondOf(save, nick) < FRIEND_LV) return '친구가 아님';
  if (isIn(save, nick)) return '이미 길드원';
  const away = save.guild.away.find(m => m.nick === nick);
  if (away) { join(save, away); return ''; }
  const p = personOf(nick);
  if (!p) return '없는 사람';
  join(save, newMember(save, p, worldLevel(save, p)));
  return '';
}

// ---------- 모집 공고 · 명문 공고 (93 4-2 ②) ----------
/** 아직 길드원이 아닌 사람 가운데 (처음 보는 사람 먼저) */
function strangers(save: SaveData, ok: (p: Person) => boolean, taken: Set<string>): Person[] {
  const list = PEOPLE.filter(p => !isIn(save, p.nick) && !isAway(save, p.nick) && !taken.has(p.nick) && ok(p));
  const fresh = list.filter(p => !save.users[p.nick]);
  return fresh.length ? fresh : list;
}
function drawOne(list: Person[], r: () => number, rare2: boolean): Person | null {
  if (!list.length) return null;
  const w = (p: Person) => (rare2 && ('rare' in PERS[p.pers] || ABILITIES[p.ab]?.grade !== 'common') ? 2 : 1);
  const tot = list.reduce((a, p) => a + w(p), 0);
  let x = r() * tot;
  for (const p of list) { x -= w(p); if (x <= 0) return p; }
  return list[list.length - 1];
}
/** 공고 지원자 n명: 모집 공고 = 역할 (tank · melee · ranged · any), 명문 공고 = 직업. 내 Lv − 5 이상인 사람 */
export function makeCandidates(save: SaveData, kind: PostKind, pick: string, r: () => number): GuildMember[] {
  const my = topLevel(save), taken = new Set<string>(), out: GuildMember[] = [];
  const okRole = (p: Person) => (kind === 'elite' ? p.cls === pick : pick === 'any' || CLASSES[p.cls].role === pick);
  const okLv = (p: Person) => worldLevel(save, p) >= my - POST_LV_GAP;
  for (let i = 0; i < POSTS[kind].cands; i++) {
    let list = strangers(save, p => okRole(p) && okLv(p), taken);
    if (!list.length) list = strangers(save, okRole, taken);
    const p = drawOne(list, r, kind === 'elite');
    if (!p) break;
    taken.add(p.nick);
    out.push(newMember(save, p, worldLevel(save, p)));
  }
  return out;
}
export function postRecruit(save: SaveData, kind: PostKind, pick: string, r: () => number): string {
  const g = save.guild, p = POSTS[kind], gold = postGold(kind, topLevel(save));
  if (capOf(save).lv < p.guildLv) return `길드 Lv ${p.guildLv}에 열림`;
  if (full(save)) return `정원 ${capOf(save).cap}명이 다 참`;
  if (kind === 'elite' ? !RECRUIT_CLASSES.includes(pick as ClassKey) : !['tank', 'melee', 'ranged', 'any'].includes(pick)) return '고를 수 없음';
  if (resourceBalance(save, 'gold') < gold) return `골드 부족 (${gold.toLocaleString()} 필요)`;
  spendResource(save, 'gold', gold);
  g.post = { kind, pick, cands: makeCandidates(save, kind, pick, r) };
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
    const p = drawOne(strangers(save, x => CLASSES[x.cls].role === role, taken), r, false);
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

/** 보내기 (93 4-3): 인연 · 키운 것은 그대로 남아 친구 목록으로 (다시 부르면 그대로) */
export function release(save: SaveData, id: number): boolean {
  const g = save.guild, m = memberOf(save, id);
  if (!m) return false;
  g.members = g.members.filter(x => x.id !== id);
  if (!m.story) g.away = [...g.away.filter(x => x.nick !== m.nick), m];
  for (const k of Object.keys(g.picks) as (keyof typeof g.picks)[]) g.picks[k] = g.picks[k]!.filter(x => x !== id);
  return true;
}

// ---------- 길드파티 편성 ----------
/** 전투에 넘기는 길드원: 자기 레벨 · 능력치 (그날 꾸준함 흔들림) · 인연 ★ · 버릇 (침착 · 판단) */
export function memberEntry(save: SaveData, m: GuildMember, seed = 1): RosterEntry {
  return {
    role: CLASSES[m.cls].role, pers: m.pers, nick: m.nick, cls: m.cls, ab: m.ab, star: starOfBond(bondOf(save, m.nick)), lv: m.lv, pub: true,
    fm: { stats: { ...m.stats }, off: dayOffset(m.steady, seed, m.nick) }, habit: habitOf(m.stats), gid: m.id, bond: bondPt(save, m.nick),
  };
}

/** 자리: 탱커 수와 딜러 수 (근접·원거리 섞어도 됨) */
export const slotsOf = (enc: Encounter) => ({ tank: enc.comp.tank, dps: enc.comp.melee + enc.comp.ranged });
/** 규모 (탐험 3 · 5인 · 10 · 20인): 지난 편성을 따로 기억 */
export const sizeKey = (enc: Encounter): '3' | '5' | '10' | '20' => { const n = enc.comp.tank + enc.comp.melee + enc.comp.ranged + 1; return n <= 3 ? '3' : n <= 5 ? '5' : n <= 10 ? '10' : '20'; };
/** 편성 순서 (지난 편성 밖): 레벨 → 인연 */
const order = (save: SaveData) => save.guild.members.slice().sort((a, b) => b.lv - a.lv || bondPt(save, b.nick) - bondPt(save, a.nick));

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
  /** 출전한 길드원: 레벨 경험치 · 레벨 업 · 오른 능력치 (왜) */
  members: { nick: string; xp: number; ups: number[]; stats: { k: StatKey; to: number; why: string }[] }[];
  /** 쉬는 명단이 받은 경험치 합 */
  rest: number;
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

/** 능력치 경험을 더하고, 차는 만큼 한 칸씩 +1 (오를 칸 = 역할 핵심 · 최근 「한 일」 표 무게, 97) */
export function growStats(m: GuildMember, add: number, deed: Deed | undefined, r: () => number): { k: StatKey; to: number; why: string }[] {
  if (deed) m.votes = [...m.votes, DEED_STATS[deed]].slice(-VOTE_KEEP);
  m.sxp += add;
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged', out: { k: StatKey; to: number; why: string }[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const w = statWeights(m, role), tot = STAT_KEYS.reduce((a, k) => a + w[k], 0);
    if (tot <= 0) { m.sxp = Math.min(m.sxp, 10); break; } // 모두 상한: 경험은 조금만 모아 둠 (레벨이 오르면 상한이 열림)
    let x = r() * tot, k: StatKey = STAT_KEYS[0];
    for (const s of STAT_KEYS) { x -= w[s]; if (x <= 0) { k = s; break; } }
    const need = statNeed(m.stats[k], m.learn);
    if (m.sxp + 1e-9 < need) break;
    m.sxp -= need; m.stats[k]++;
    out.push({ k, to: m.stats[k], why: deed && DEED_STATS[deed].includes(k) ? DEED_WHY[deed] : '' });
  }
  return out;
}

/**
 * 판 뒤 길드 정산 (93 6-1 · 97). party = 전투가 끝날 때 파티원 (deed = 그 판에서 가장 두드러진 일), roster = 전투에 넘긴 편성, kind = 콘텐츠 종류.
 * 이긴 판만: 출전한 길드원 레벨 경험치 · 능력치 경험, 쉬는 명단 레벨 경험치 30%, 길드파티 (자리 절반 이상이 길드원)면 명성 · 길드 첫 처치 · 주간 목표 출전 기록
 */
export function guildAfter(
  save: SaveData, r: () => number,
  o: { win: boolean; quit: boolean; grade: Grade | null; diff: DiffName; stage: number; raid: 0 | 10 | 20; content: string; kind: string; party: { nick: string; deed?: Deed }[]; roster: RosterEntry[] },
): GuildAfter {
  const g = save.guild, out: GuildAfter = { members: [], rest: 0, fame: 0, first: false };
  if (o.quit || !o.win) return out;
  const cap = topLevel(save), went = new Set<number>();
  const firstKey = `${o.content}|${o.diff}`;
  const guildParty = isGuildParty(o.roster);
  const first = guildParty && (o.kind === 'dungeon' || o.kind === 'raid') && !g.firsts.includes(firstKey);
  for (const e of o.roster) {
    const m = e.gid != null ? g.members.find(x => x.id === e.gid) : null;
    if (!m) continue;
    went.add(m.id);
    m.runs++;
    const xp = memberXp(m, o);
    const ups = addMemberXp(m, xp, cap);
    const stats = growStats(m, SXP[o.diff] + (first ? SXP.first : 0), o.party.find(p => p.nick === m.nick)?.deed, r);
    out.members.push({ nick: m.nick, xp, ups, stats });
  }
  for (const m of g.members) if (!went.has(m.id)) { const xp = Math.round(memberXp(m, o) * REST_SHARE); addMemberXp(m, xp, cap); out.rest += xp; }
  if (guildParty) {
    g.wins++;
    out.fame = o.raid === 20 ? FAME.raid20 : o.raid === 10 ? FAME.raid10 : FAME.win;
    if (first) { g.firsts.push(firstKey); out.fame += FAME.first; out.first = true; }
    g.fame += out.fame;
    const w = save.weekly.guild;
    w.ran = [...new Set([...(w.ran ?? []), ...out.members.map(x => x.nick)])];
  }
  return out;
}

/** 길드 주간 목표 (93 6-1): 명성 + 그 주에 출전한 길드원 인연 +2 */
export const GOAL_BOND = 2;
export function goalBond(save: SaveData): void {
  for (const nick of save.weekly.guild.ran ?? []) if (isIn(save, nick)) { const u = (save.users[nick] ??= { pt: 0, met: 0, wins: 0, saved: 0, mvp: 0 }); u.pt += GOAL_BOND; }
}
