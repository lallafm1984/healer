/**
 * 길드 v2 (93 · 97, 사슬 4번): 결성 · 영입 셋 (친구 초대 · 모집 공고 · 명성 지원자) · 보내기 · 스킬 다시 뽑기 · 규모별 편성 · 판 뒤 (레벨 경험치 · 능력치 · 명성 · 첫 처치).
 * 화면과 분리된 규칙. 난수는 받아서 씀 (테스트에서 고정).
 */
import { resourceBalance, spendResource } from './resources';
import { ABILITIES, AB_ODDS, rollAbility } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../data/classes';
import type { DiffName } from '../data/difficulty';
import type { Encounter } from '../data/encounters';
import { dayOffset, memberLevel, profileOf, STAT_KEYS, type StatKey, type Stats } from '../data/fm';
import {
  APP_DAYS, appsPerDay, BOND_JOIN, FAC, FAC_GOLD, FEAST_BOND, SPONSOR, sponsorGold, type FacKey, bondLv, DEED_STATS, DEED_WHY, FAME, FRIEND_LV, guildLvOf, habitOf, lowStageXp, POST_LV_GAP, postGold, POSTS, REST_SHARE, rerollGold,
  knowGain, knowStage, starOfBond, STORY, statPerLevel, statWeights, VOTE_KEEP, XP_BAND, type Deed, type GuildMember, type PostKind, type StoryKey,
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
  return { id: 0, nick: p.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv: Math.max(1, Math.min(topLevel(save), lv)), xp: 0, stats, lastStatGains: [], learn: prof.learn, steady: prof.steady, sxp: 0, votes: [], know: {}, boost: 0, runs: 0, joined: Date.now(), ...(story ? { story } : {}) };
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

// ---------- 시설 (93 6-3) ----------
export const facLv = (save: SaveData, k: FacKey) => save.guild.fac?.[k] ?? 0;
/** 시설을 올릴 수 없는 까닭 (없으면 '') */
export function facWhy(save: SaveData, k: FacKey): string {
  if (capOf(save).lv < FAC[k].guildLv) return `길드 Lv ${FAC[k].guildLv}에 열림`;
  if (facLv(save, k) >= FAC_GOLD.length) return '최고 단계';
  return '';
}
export function buildFac(save: SaveData, k: FacKey): string {
  const why = facWhy(save, k);
  if (why) return why;
  const c = FAC_GOLD[facLv(save, k)];
  if (resourceBalance(save, 'gold') < c) return `골드 부족 (${c.toLocaleString()} 필요)`;
  spendResource(save, 'gold', c);
  save.guild.fac[k] = facLv(save, k) + 1;
  return '';
}
/** 연회장 (93 6-3): 길드파티로 이긴 판의 인연 점수 +10% × 단계 (소수는 그대로 쌓임) */
export function feastBonus(save: SaveData, gains: { nick: string; pt: number }[]): void {
  const lv = facLv(save, 'feast');
  if (!lv) return;
  for (const b of gains) { const u = save.users[b.nick]; if (u && b.pt > 0) { const add = Math.round(b.pt * FEAST_BOND * lv * 100) / 100; u.pt = Math.round((u.pt + add) * 100) / 100; b.pt = Math.round((b.pt + add) * 100) / 100; } }
}

// ---------- 스토리 동료 이슬 · 칼날 (93 4-4) ----------
const hasStory = (save: SaveData, k: StoryKey) => save.guild.members.some(m => m.story === k) || save.guild.away.some(m => m.story === k) || save.guild.storyWait.includes(k);
/** 첫 10인 레이드 클리어 = 이슬, 첫 20인 = 칼날. 정원이 차 있으면 친구 목록에서 「초대 대기」. 들어오면 합류 카드 한 번 */
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
/** 모집소 (93 6-3): 1 공고 지원자 +1 · 3 공고 골드 −20% · 5 명문 공고 지원자 +2 */
export const postCands = (save: SaveData, kind: PostKind) => POSTS[kind].cands + (kind === 'normal' && facLv(save, 'post') >= 1 ? 1 : 0) + (kind === 'elite' && facLv(save, 'post') >= 5 ? 2 : 0);
export const postCost = (save: SaveData, kind: PostKind) => Math.round(postGold(kind, topLevel(save)) * (facLv(save, 'post') >= 3 ? 0.8 : 1));
/** 공고 지원자 n명: 모집 공고 = 역할 (tank · melee · ranged · any), 명문 공고 = 직업. 내 Lv − 5 이상인 사람 */
export function makeCandidates(save: SaveData, kind: PostKind, pick: string, r: () => number): GuildMember[] {
  const my = topLevel(save), taken = new Set<string>(), out: GuildMember[] = [];
  const okRole = (p: Person) => (kind === 'elite' ? p.cls === pick : pick === 'any' || CLASSES[p.cls].role === pick);
  const okLv = (p: Person) => worldLevel(save, p) >= my - POST_LV_GAP;
  for (let i = 0; i < postCands(save, kind); i++) {
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
  const g = save.guild, p = POSTS[kind], gold = postCost(save, kind);
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
  const n = appsPerDay(capOf(save).lv) + (facLv(save, 'post') >= 4 && capOf(save).lv >= 2 ? 1 : 0), taken = new Set(g.apps.map(a => a.m.nick));
  for (let i = 0; i < n; i++) {
    const count = (role: string) => g.members.filter(m => CLASSES[m.cls].role === role).length + g.apps.filter(a => CLASSES[a.m.cls].role === role).length;
    const role = (['tank', 'melee', 'ranged'] as const).slice().sort((a, b) => count(a) / want(a) - count(b) / want(b))[0];
    const p = drawOne(strangers(save, x => CLASSES[x.cls].role === role, taken), r, false);
    if (!p) break;
    taken.add(p.nick);
    g.apps.push({ m: newMember(save, p, worldLevel(save, p)), until: addDays(day, APP_DAYS + (facLv(save, 'post') >= 2 ? 2 : 0) - 1) });
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
/** 공략 숙지 단계 (전투 키 → 1~3, 0은 뺌) */
export function knowStages(m: Pick<GuildMember, 'know'>, save?: SaveData): Record<string, number> {
  const war = save ? facLv(save, 'war') : 0;
  const out: Record<string, number> = Object.fromEntries(Object.entries(m.know).map(([k, p]) => [k, knowStage(p, war)] as const).filter(([, s]) => s > 0));
  // 작전실 5단계 공략 공유 (93 6-3): 길드에 3단계인 사람이 있는 전투는 모두 1단계부터
  if (save && war >= 5) for (const o of save.guild.members) for (const [k, p] of Object.entries(o.know)) if (knowStage(p, war) >= 3 && !out[k]) out[k] = 1;
  return out;
}
/** 전투에 넘기는 길드원: 자기 레벨 · 능력치 (그날 꾸준함 흔들림) · 인연 ★ · 버릇 (침착 · 판단) */
export function memberEntry(save: SaveData, m: GuildMember, seed = 1): RosterEntry {
  return {
    role: CLASSES[m.cls].role, pers: m.pers, nick: m.nick, cls: m.cls, ab: m.ab, star: starOfBond(bondOf(save, m.nick)), lv: m.lv, pub: true,
    fm: { stats: { ...m.stats }, off: dayOffset(m.steady, seed, m.nick) }, habit: habitOf(m.stats), gid: m.id, bond: bondPt(save, m.nick), know: knowStages(m, save),
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
  o: { win: boolean; quit: boolean; grade: Grade | null; diff: DiffName; stage: number; raid: 0 | 10 | 20; content: string; kind: string; party: { nick: string; deed?: Deed }[]; roster: RosterEntry[]; encs?: readonly string[]; time?: number },
): GuildAfter {
  const g = save.guild, out: GuildAfter = { members: [], rest: 0, boosted: [], fame: 0, first: false };
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
    const stats = growStats(m, ups.length, o.party.find(p => p.nick === m.nick)?.deed, r);
    // 공략 숙지 (93 5-4): 이긴 판의 전투마다 학습력만큼, 보스 (마지막 전투) 단계가 오르면 결과 줄
    const war = facLv(save, 'war'), boss = o.encs?.[o.encs.length - 1], kb = boss ? knowStage(m.know[boss] ?? 0, war) : 0;
    for (const k of new Set(o.encs ?? [])) m.know[k] = Math.round(((m.know[k] ?? 0) + knowGain(m.learn)) * 100) / 100;
    const ka = boss ? knowStage(m.know[boss], war) : 0;
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
