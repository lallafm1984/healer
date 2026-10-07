/**
 * 길드 (02 9장, 12 3-3, 17 8장): 영입(골드 모집·인연 스카우트), 육성(훈련·육성 포인트·능력 다시 뽑기), 길드파티 편성, 판 뒤 경험치.
 * 화면과 분리된 규칙. 난수는 받아서 씀 (테스트에서 고정).
 */
import { AB_ODDS, rollAbility } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES } from '../data/classes';
import type { DiffName } from '../data/difficulty';
import type { Encounter } from '../data/encounters';
import {
  aptOf, guildCap, memberPower, POST_CANDS, POSTS, pointCost, pointsAt, pointsUsed, REROLL_GOLD, RESET_GOLD, rollApt, SCOUT_GOLD, SCOUT_MAX, trainCost,
  type GuildMember, type PostTier,
} from '../data/guild';
import { NICKS, PERS, PERS_NAMES, type PersName } from '../data/personalities';
import { addXp, clearXp, GUILD_LEVEL, MAX_LEVEL, type Grade } from '../data/progression';
import { TRAIT_CHANCE, TRAITS, type TraitKey } from '../data/traits';
import type { RosterEntry } from '../engine/types';
import type { SaveData, Scout } from '../platform/storage';
import { TUT } from './tutorial';

/** 길드가 열렸는지 (Lv 15, 튜토리얼 뒤). dev = 개발 빌드 「레벨 잠금 무시」로 열림 */
export function guildOpen(save: SaveData): { ok: boolean; dev: boolean; why: string } {
  if (save.tut < TUT.done) return { ok: false, dev: false, why: '튜토리얼을 마치면 열림' };
  const under = save.player.level < GUILD_LEVEL;
  if (under && !save.settings.devUnlock) return { ok: false, dev: false, why: `Lv ${GUILD_LEVEL}에 열림` };
  return { ok: true, dev: under, why: '' };
}

export const capOf = (save: SaveData) => guildCap(save.player.level);
export const powerOf = (m: GuildMember) => memberPower({ ...m, apt: aptOf(m) });

/** 길드원 닉네임: 공개모집 닉네임 중 길드에 없는 것, 다 쓰면 뒤에 숫자 */
function freshNick(save: SaveData, r: () => number, taken: Set<string>): string {
  const used = new Set([...save.guild.members.map(m => m.nick), ...taken]);
  const free = NICKS.filter(n => !used.has(n));
  if (free.length) return free[Math.floor(r() * free.length)];
  const base = NICKS[Math.floor(r() * NICKS.length)];
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

/** 지원자 1명 (17 2-1·3장·9-1): 직업 8종 중 무작위, 성격·특성·자질·능력. 레벨은 공고 등급마다 (내 레벨 위로는 안 감) */
export function makeCandidate(save: SaveData, r: () => number, tier: PostTier, taken = new Set<string>()): GuildMember {
  const cls = RECRUIT_CLASSES[Math.floor(r() * RECRUIT_CLASSES.length)];
  const role = CLASSES[cls].role;
  const pool = PERS_NAMES.filter(p => !(role === 'tank' && 'noTank' in PERS[p]));
  const pers: PersName = pool[Math.floor(r() * pool.length)];
  const tr = (Object.keys(TRAITS) as TraitKey[]).filter(k => TRAITS[k].roles.includes(role));
  const chance = tier === 'best' ? 0.6 : tier === 'better' ? 0.45 : TRAIT_CHANCE;
  const traits = tr.length && r() < chance ? [tr[Math.floor(r() * tr.length)]] : [];
  const [lo, hi] = POSTS[tier].lv;
  const P = save.player.level;
  const lv = Math.max(1, Math.min(P, P + lo + Math.floor(r() * (hi - lo + 1))));
  const best = tier === 'best';
  const apt0: [number, number, number] = [rollApt(r, best), rollApt(r, best), rollApt(r, best)];
  const nick = freshNick(save, r, taken);
  return { id: 0, nick, cls, pers, traits, lv, xp: 0, apt0, aptUp: [0, 0, 0], ab: rollAbility(cls, r, AB_ODDS[tier]), star: 0, runs: 0 };
}

/** 골드 모집 공고 (12 3-3). 실패하면 이유 */
export function postRecruit(save: SaveData, tier: PostTier, r: () => number): string {
  const g = save.guild, p = POSTS[tier];
  if (g.members.length >= capOf(save).cap) return `정원 ${capOf(save).cap}명이 다 참`;
  if (save.player.gold < p.gold) return `골드 부족 (${p.gold.toLocaleString()} 필요)`;
  save.player.gold -= p.gold;
  const taken = new Set<string>();
  const cands: GuildMember[] = [];
  for (let i = 0; i < POST_CANDS; i++) { const c = makeCandidate(save, r, tier, taken); taken.add(c.nick); cands.push(c); }
  g.post = { tier, cands };
  return '';
}

function join(save: SaveData, m: Omit<GuildMember, 'id'>): GuildMember {
  const g = save.guild;
  const nm: GuildMember = { ...m, id: g.nextId++ };
  if (g.members.some(x => x.nick === nm.nick)) nm.nick = freshNick(save, Math.random, new Set());
  g.members.push(nm);
  return nm;
}

/** 공고 지원자 중 1명 영입. 나머지 지원자는 돌아감 */
export function hire(save: SaveData, i: number): string {
  const g = save.guild, c = g.post?.cands[i];
  if (!c) return '지원자 없음';
  if (g.members.length >= capOf(save).cap) return `정원 ${capOf(save).cap}명이 다 참`;
  join(save, c);
  g.post = null;
  return '';
}

/** 인연 스카우트 (12 3-3: 300 골드) */
export function scoutHire(save: SaveData, i: number): string {
  const g = save.guild, s = g.scouts[i];
  if (!s) return '후보 없음';
  if (g.members.length >= capOf(save).cap) return `정원 ${capOf(save).cap}명이 다 참`;
  if (save.player.gold < SCOUT_GOLD) return `골드 부족 (${SCOUT_GOLD} 필요)`;
  save.player.gold -= SCOUT_GOLD;
  const { from: _f, ...rest } = s;
  join(save, { ...rest, xp: 0, aptUp: [0, 0, 0], star: 0, runs: 0 });
  g.scouts.splice(i, 1);
  return '';
}

const memberOf = (save: SaveData, id: number) => save.guild.members.find(m => m.id === id) || null;

/** 훈련 1레벨 (12 3-3: 길드원 레벨 × 30). 길드원 레벨 상한 = 내 레벨 */
export function train(save: SaveData, id: number): string {
  const m = memberOf(save, id);
  if (!m) return '길드원 없음';
  if (m.lv >= save.player.level) return '내 레벨까지만';
  const c = trainCost(m.lv);
  if (save.player.gold < c) return `골드 부족 (${c.toLocaleString()} 필요)`;
  save.player.gold -= c; m.lv++; m.xp = 0;
  return '';
}

/** 육성 포인트 1점 (17 8-1): 자질 1칸(●5까지) 또는 능력 ★1단계(★5까지). 골드 = 레벨 × 100 */
export function spendPoint(save: SaveData, id: number, what: 0 | 1 | 2 | 'star'): string {
  const m = memberOf(save, id);
  if (!m) return '길드원 없음';
  if (pointsUsed(m) >= pointsAt(m.lv)) return '남은 육성 포인트 없음';
  if (what === 'star' ? m.star >= 5 : m.apt0[what] + m.aptUp[what] >= 5) return '이미 최대';
  const c = pointCost(m.lv);
  if (save.player.gold < c) return `골드 부족 (${c.toLocaleString()} 필요)`;
  save.player.gold -= c;
  if (what === 'star') m.star++; else m.aptUp[what]++;
  return '';
}

/** 육성 포인트 초기화 (5,000) */
export function resetPoints(save: SaveData, id: number): string {
  const m = memberOf(save, id);
  if (!m) return '길드원 없음';
  if (!pointsUsed(m)) return '쓴 포인트 없음';
  if (save.player.gold < RESET_GOLD) return `골드 부족 (${RESET_GOLD.toLocaleString()} 필요)`;
  save.player.gold -= RESET_GOLD; m.aptUp = [0, 0, 0]; m.star = 0;
  return '';
}

/** 능력 다시 뽑기 (3,000). 같은 직업 10개 중 무작위, ★은 유지 */
export function rerollAbility(save: SaveData, id: number, r: () => number): string {
  const m = memberOf(save, id);
  if (!m) return '길드원 없음';
  if (save.player.gold < REROLL_GOLD) return `골드 부족 (${REROLL_GOLD.toLocaleString()} 필요)`;
  save.player.gold -= REROLL_GOLD;
  m.ab = rollAbility(m.cls, r);
  return '';
}

export function release(save: SaveData, id: number): boolean {
  const g = save.guild, n = g.members.length;
  g.members = g.members.filter(m => m.id !== id);
  g.pick = g.pick.filter(x => x !== id);
  return g.members.length < n;
}

// ---------- 길드파티 편성 ----------
/** 전투에 넘기는 길드원 */
export function memberEntry(m: GuildMember): RosterEntry {
  return { role: CLASSES[m.cls].role, pers: m.pers, nick: m.nick, cls: m.cls, traits: m.traits.slice(), ab: m.ab, star: m.star, lv: m.lv, apt: aptOf(m), gid: m.id, runs: m.runs };
}

/** 자리: 탱커 수와 딜러 수 (근접·원거리 섞어도 됨) */
export const slotsOf = (enc: Encounter) => ({ tank: enc.comp.tank, dps: enc.comp.melee + enc.comp.ranged });

/** 처음 편성: 지난 편성 중 남아 있는 사람 + 빈자리는 전투력 높은 순 */
export function autoPick(save: SaveData, enc: Encounter): number[] {
  const sl = slotsOf(enc), ms = save.guild.members;
  const pick: number[] = [];
  const fits = (m: GuildMember) => {
    const tank = CLASSES[m.cls].role === 'tank';
    const n = pick.filter(id => CLASSES[ms.find(x => x.id === id)!.cls].role === 'tank').length;
    return tank ? n < sl.tank : pick.length - n < sl.dps;
  };
  for (const id of save.guild.pick) { const m = ms.find(x => x.id === id); if (m && fits(m)) pick.push(id); }
  for (const m of ms.slice().sort((a, b) => powerOf(b) - powerOf(a))) if (!pick.includes(m.id) && fits(m)) pick.push(m.id);
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

/**
 * 길드파티: 고른 길드원 + 빈자리는 공개모집 파티(같은 시드)에서 채움 (02 9-2: 길드원이 모자라도 입장 가능, 18 4장).
 * 공개모집 쪽은 역할이 맞는 사람부터 순서대로
 */
export function guildRoster(save: SaveData, pick: number[], publicParty: RosterEntry[], enc: Encounter): RosterEntry[] {
  const ms = pick.map(id => save.guild.members.find(m => m.id === id)).filter((m): m is GuildMember => !!m).map(memberEntry);
  const sl = slotsOf(enc);
  const needTank = sl.tank - ms.filter(m => m.role === 'tank').length;
  const needDps = sl.dps - ms.filter(m => m.role !== 'tank').length;
  const names = new Set(ms.map(m => m.nick));
  const fill = (list: RosterEntry[], n: number) => list.filter(p => !names.has(p.nick)).slice(0, Math.max(0, n));
  const tanks = fill(publicParty.filter(p => p.role === 'tank'), needTank);
  const dps = fill(publicParty.filter(p => p.role !== 'tank'), needDps);
  return [...ms.filter(m => m.role === 'tank'), ...tanks, ...ms.filter(m => m.role !== 'tank'), ...dps];
}

// ---------- 판 뒤 ----------
export interface GuildAfter {
  /** 길드원 경험치·레벨 */
  members: { nick: string; xp: number; ups: number[] }[];
  /** 인연: 호감도가 가득 찬 공개모집 파티원 (스카우트 목록에 들어감) */
  scout: Scout | null;
  fame: number;
}

/** 길드원 경험치 (02 9-2): 같은 식, 길드 평균보다 낮으면 보충 2배, 레벨 상한 = 내 레벨 */
export function addMemberXp(m: GuildMember, amt: number, cap: number): number[] {
  if (m.lv >= cap) { m.xp = 0; return []; }
  const p = { level: m.lv, xp: m.xp };
  const ups = addXp(p, amt);
  m.lv = Math.min(cap, p.level); m.xp = m.lv >= cap || m.lv >= MAX_LEVEL ? 0 : p.xp;
  return ups.filter(l => l <= cap);
}

/**
 * 판 뒤 길드 정산. party = 전투가 끝날 때 파티원 (got = 내 힐로 회복한 양), roster = 전투에 넘긴 편성.
 * 인연 스카우트 (02 9-1·9-3 ②): 이긴 판(S·A)에서 살아남은 공개모집 파티원 중 내 힐을 가장 많이 받은 1명 = 호감도 최대
 */
export function guildAfter(
  save: SaveData, r: () => number,
  o: { win: boolean; quit: boolean; grade: Grade | null; diff: DiffName; stage: number; raid: 0 | 10 | 20; content: string; party: { nick: string; alive: boolean; got?: number; gid?: number }[]; roster: RosterEntry[] },
): GuildAfter {
  const g = save.guild, out: GuildAfter = { members: [], scout: null, fame: 0 };
  if (o.quit) return out;
  const avg = g.members.length ? g.members.reduce((s, m) => s + m.lv, 0) / g.members.length : 0;
  for (const e of o.roster) {
    const m = e.gid != null ? g.members.find(x => x.id === e.gid) : null;
    if (!m) continue;
    m.runs++;
    const xp = Math.round(clearXp(m.lv, o.stage, o.diff, o.grade, { raid: o.raid, win: o.win }) * (m.lv < avg ? 2 : 1));
    const ups = addMemberXp(m, xp, save.player.level);
    out.members.push({ nick: m.nick, xp, ups });
  }
  if (o.win && out.members.length) { out.fame = o.raid === 20 ? 3 : o.raid ? 2 : 1; g.fame += out.fame; }
  if (o.win && (o.grade === 'S' || o.grade === 'A')) {
    const pub = o.party.filter(p => p.alive && p.gid == null && (p.got || 0) > 0).sort((a, b) => (b.got || 0) - (a.got || 0))[0];
    const e = pub && o.roster.find(x => x.nick === pub.nick && x.gid == null && x.cls);
    if (e && !g.scouts.some(s => s.nick === e.nick && s.cls === e.cls) && !g.members.some(m => m.nick === e.nick)) {
      const lv = Math.max(1, Math.min(save.player.level, o.stage));
      const s: Scout = { nick: e.nick, cls: e.cls!, pers: e.pers, traits: (e.traits || []).slice(), lv, apt0: [rollApt(r), rollApt(r), rollApt(r)], ab: e.ab || rollAbility(e.cls!, r), from: o.content };
      g.scouts.unshift(s);
      g.scouts = g.scouts.slice(0, SCOUT_MAX);
      out.scout = s;
    }
  }
  return out;
}
