import { ABILITIES } from '../data/abilities';
import { armorFactor } from '../data/armor';
import { HEROES } from '../data/heroes';
import { DISPELLABLE, SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { aggroTarget } from './bosses';
import { cellOf, living, unitById } from './core';
import { create, step } from './fight';
import { canTarget, knows, use } from './healer';
import { setBeacon } from './heroes';
import { reviveTarget } from './items';
import { dangerAt } from './movement';
import { castOf, talentReady, useTalent } from './talents';
import type { Debuff, Fight, FightConfig, Unit } from './types';

/**
 * 버스터를 맞을 사람이 버틸 만큼 차 있지 않으면 그 사람 (직업군 방어력이 있을 때만).
 * 방어력이 생기면 광역이 탱커를 덜 깎아서 탱커가 「가장 낮은 사람」에서 밀리기 쉬움 → 버스터 전에 먼저 채움.
 * 예고가 짧아서(2초) 예고가 뜨기 4초 전부터 본다 (대기열에 다음 기술이 보이는 것과 같음)
 */
function busterShort(f: Fight): { u: Unit; soon: boolean } | null {
  if (!f.armor) return null;
  const short = (u: Unit | null | undefined, dmg: number) => !!u && u.alive && u.guardian <= 0 && u.hp < Math.min(u.max * 0.95, dmg * f.dmgMult * armorFactor(u.role, 'tank') * 1.1 + u.max * 0.15); // 그 사이 평타 한두 대 여유. 가득 차도 못 버티는 버스터면 거의 가득까지만
  for (const t of f.tels) {
    if (t.kind !== 'buster' || !t.skill.dmg) continue;
    const u = unitById(f, t.units[0]);
    if (short(u, t.skill.dmg)) return { u: u!, soon: t.impact - f.t < 2 };
  }
  for (const s of f.skills) {
    if (s.kind !== 'buster' || !s.dmg || s.mob != null || s.next - f.t > 4 || !s.active(f)) continue;
    const u = aggroTarget(f);
    if (short(u, s.dmg)) return { u: u!, soon: false };
  }
  return null;
}

/**
 * 가장 낮은 사람. 직업군 방어력이 있으면 힐러(나)가 가장 약한 쪽이라, 나도 거의 같이 낮으면 나부터 (내가 쓰러지면 끝)
 */
function lowest(f: Fight, live: Unit[], pct: (u: Unit) => number): Unit {
  const low = live.reduce((a, b) => (pct(b) < pct(a) ? b : a));
  return f.armor && f.me.alive && !off(f, f.me) && pct(f.me) < 0.6 && pct(f.me) < pct(low) + 0.15 ? f.me : low;
}

// ---------- 기믹 부품 대응 (38 0-5): 35 3장 표의 「힐러 판단」을 세 직업이 같이 봄 ----------
/**
 * 힐하면 손해인 사람: 뒤집힌 축복 (P-INVERT, 힐이 피해), 매혹 (P-CHARM, 힐하면 지배가 길어짐 → 그 사람은 두고 주변을),
 * 과부하 표식 (P-OVER)인데 모자란 양이 힐 한 번보다 적음 (넘친 치유가 이웃을 때림 → 정확히 채우기)
 */
const off = (f: Fight, u: Unit) => u.debuffs.length > 0 && u.debuffs.some(d => d.invert || d.charm || (!!d.over && u.max - u.hp < OVER_GAP * f.power));
/** 과부하 표식에 힐을 넣어도 되는 모자란 양 (힐 한 번 크기쯤, 레벨 배율 전) */
const OVER_GAP = 250;
/** 시전 또는 채널에 걸리는 초 (진동 판단) */
const busy = (f: Fight, k: SkillKey) => castOf(f, k) || SKILLS[k].channel || 0;
/** 진동 (P-QUAKE): 다음 울림까지 남은 초 (예고 중이거나 곧 예고할 진동 기술). 없으면 Infinity */
function calmOf(f: Fight): number {
  let t = Infinity;
  for (const x of f.tels) if (x.skill.quake) t = Math.min(t, x.impact - f.t);
  for (const s of f.skills) if (s.quake && s.active(f)) t = Math.min(t, s.next + s.cast - f.t);
  return t - 0.2;
}
/** 이 스킬을 지금 시작해도 되는지: 진동으로 잠기지 않았고, 다음 진동 전에 시전이 끝남 */
const calmFor = (f: Fight, k: SkillKey, calm: number) => !f.lock[k] && busy(f, k) < calm;
/** 끊기 ✋ 능력이 있는 파티원 (반격 틈 P-COUNTER) */
const cutter = (u: Unit) => !!u.ab && ABILITIES[u.ab.key]?.fx.e === 'interrupt';

/** 이번 판단에서 보는 기믹 신호 */
interface Gim {
  /** 차례 (P-ORDER): 다음 번호. 위급한 사람이 없으면 바로 즉시 단일 힐 */
  order: Unit | null;
  /** 탱커처럼 계속 맞는 사람: 끌려와 평타를 나눠 맞음 (P-PULL), 쫄이 때림 (P-ADD 5인), 갇힘 (P-JAIL), 주시로 보스가 나를 노림 (P-AGGRO) → 지속 힐을 탱커처럼 */
  hit: Unit[];
  /** 곧 크게 맞을 사람: 자폭 쫄이 두 칸 안 (P-FIXATE), 큰 쫄 강타 예고 (P-ELITE), 받침에 들어감 (P-TOWER) → 버스터처럼 미리 가득 */
  pre: Unit | null;
  /** 체력 선 (P-WOUND 쇠약 · P-FULL 완치 표식 · P-STAGGER 무력화 중 딜 선): 선 아래라 채우면 되는 사람, 모자란 양이 적은 사람부터 */
  cure: Unit | null;
  /** 곧 모두가 맞음: 폭탄이 3초 안에 터짐 (P-BOMB), 쓰러질 때 파열을 거는 쫄 떼가 거의 다 잡힘 (P-SWARM·P-BURST) → 광역 예고처럼 지속 힐을 미리 */
  aoe: boolean;
  /** 마나·치유를 아낌: 보호막 수정 (P-PYLON)이 서 있음 (깨는 동안 광폭 시계가 흐름), 주시 게이지가 거의 참 (P-AGGRO, 넘친 치유 줄이기) */
  save: boolean;
  /** 판에 적이 있음 (P-ADD): 딜러가 일점사로 빨리 잡아야 하니 딜러의 딜 0 디버프(침묵·얼림)를 먼저 지움 */
  adds: boolean;
  /** 헤매는 영혼 (P-SOUL): 시간이 가장 적게 남은 영혼 칸. 위급한 사람이 없으면 해제 또는 단일 힐을 영혼에 */
  soul: Unit | null;
  /** 생명 사슬 균형형 (P-LINK): 두 사람 체력 비율 차이가 끊기는 선의 절반을 넘으면 낮은 쪽. near = 3/4을 넘어 곧 끊어짐 */
  link: { u: Unit; near: boolean } | null;
  /** 넘치는 빛 그릇 (P-OVER): 넘친 치유가 보호막이 되니 가득 찬 사람에게도 채우기 힐 */
  spill: boolean;
  /** 마력 역류 (P-RECOIL)가 나에게: 스킬마다 중첩이 쌓이니 큰 힐 몇 번만 (지속 힐 미리 깔기·채우기 힐을 줄임) */
  few: boolean;
  /** 진동 (P-QUAKE): 다음 울림까지 남은 초. 이보다 긴 시전은 시작하지 않음 (끊기고 잠김) */
  calm: number;
  /** 반격 틈 (P-COUNTER) 기술이 있음: 끊기 능력자의 딜 0 디버프를 먼저 지움 */
  counter: boolean;
  /** 지금 지우지 않을 디버프: 옮겨붙음 (P-JUMP)인데 이웃 칸에 아군이 있음 (지우면 옮겨붙어 더 세짐, 혼자일 때 지움) */
  hold: Set<Debuff>;
}

function gim(f: Fight): Gim {
  let order: Unit | null = null;
  if (f.order) { const u = unitById(f, f.order.ids[f.order.i]); if (u && u.alive && !off(f, u)) order = u; }
  const adds = f.mobs.filter(m => m.alive && m.add);
  const watched = !!f.watch && f.t < f.watch.until;
  const hit = f.party.filter(u => u.alive && u.role !== 'tank' && !off(f, u)
    && (u.pulled || u.debuffs.some(d => d.jail) || adds.some(m => m.add!.dmg > 0 && m.add!.on === u.id) || (u.me && watched)));
  let pre: Unit | null = null;
  for (const m of adds) {
    const a = m.add!, u = unitById(f, a.on);
    if (!u || !u.alive || off(f, u) || u.hp >= u.max * 0.95) continue;
    if ((a.job?.p === 'fixate' && hexDist(f.cells[a.cell!], cellOf(f, u)) <= 2) || (a.job?.p === 'smash' && a.warned)) { pre = u; break; }
  }
  if (!pre) pre = f.party.filter(u => u.alive && u.padUntil != null && u.padUntil > f.t && !off(f, u) && u.hp < u.max * 0.95).sort((a, b) => a.hp / a.max - b.hp / b.max)[0] ?? null;
  // 무력화 중에는 선보다 조금 위까지 (선에 딱 걸치면 한 대에 다시 내려감)
  const st = f.stagger;
  const gap = (u: Unit) => Math.max(st && !u.me ? (st.hp + 0.03) * u.max - u.hp : -Infinity, ...u.debuffs.filter(d => d.cureAt != null).map(d => d.cureAt! * u.max - u.hp));
  const cure = f.party.filter(u => u.alive && !off(f, u) && gap(u) > 0).sort((a, b) => gap(a) - gap(b))[0] ?? null;
  let link: Gim['link'] = null;
  for (const l of f.links) {
    const a = unitById(f, l.a), b = unitById(f, l.b);
    if (l.kind !== 'balance' || !a?.alive || !b?.alive) continue;
    const d = a.hp / a.max - b.hp / b.max, lo = d < 0 ? a : b, near = Math.abs(d) > l.gap * 0.75;
    if (Math.abs(d) > l.gap * 0.5 && !off(f, lo) && (!link || (near && !link.near))) link = { u: lo, near };
  }
  const hold = new Set<Debuff>();
  for (const u of f.party) for (const d of u.debuffs) {
    if (d.end?.p === 'jump' && d.end.on !== 'quake' && u.alive && f.party.some(v => v !== u && v.alive && hexDist(cellOf(f, v), cellOf(f, u)) === 1)) hold.add(d);
  }
  return {
    order, hit, pre, cure,
    aoe: adds.some(m => (m.add!.job?.p === 'bomb' && m.add!.jobAt! - f.t < 3) || (m.add!.down?.p === 'burst' && m.hp < m.max * 0.25)),
    save: adds.some(m => m.add!.job?.p === 'pylon') || (!!f.watch && !watched && f.watch.fill > f.watch.max * 0.8),
    adds: adds.length > 0,
    soul: f.souls.filter(u => u.alive).sort((a, b) => a.soul!.until - b.soul!.until)[0] ?? null,
    link,
    spill: !!f.vessel && f.t < f.vessel.until,
    few: f.me.debuffs.some(d => d.count),
    calm: calmOf(f),
    counter: f.abOn && f.skills.some(s => s.stunOnCut),
    hold,
  };
}

/** 채우기 힐을 넣는 체력 선: 그릇이 있으면 가득 찬 사람에게도 (넘치게), 역류 중이면 낮게, 아낄 때 0.7 */
const topUp = (f: Fight, g: Gim, base: number) => (g.spill && f.mana > 30 ? 1.01 : g.few ? 0.6 : g.save ? 0.7 : base);

/**
 * 해제 순서 (35 3-D·3-I·3장 표): 뒤집힌 축복(힐을 막음)·나의 마력 역류(일찍 지울수록 적게 터짐) → 매혹·마나 갈취 표식·메아리 (진동에 옮겨붙음),
 * 판에 적이 있으면 딜러의 딜 0, 반격 틈이 있으면 끊기 능력자의 딜 0 → 그 밖. 같은 순위는 넘겨받은 순서 그대로
 */
function byDispel(g: Gim, cands: Unit[], ok: (d: Debuff) => boolean): Unit[] {
  const rank = (u: Unit) => {
    const ds = u.debuffs.filter(ok);
    if (ds.some(d => d.invert || d.count)) return 0;
    if (ds.some(d => d.charm || d.drain || (d.end?.p === 'jump' && d.end.on === 'quake'))) return 1;
    if (ds.some(d => d.noDps) && ((g.adds && (u.role === 'melee' || u.role === 'ranged')) || (g.counter && cutter(u)))) return 1;
    return 2;
  };
  return cands.map((u, i) => ({ u, i, r: rank(u) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.u);
}

/** 시전 중 대상에게 뒤집힌 축복이 걸리면 그 힐을 취소 (사람이 다른 칸을 눌러 끊는 것과 같음, GCD는 돌려받음) */
function dropInverted(f: Fight): void {
  const bad = (uid: number | null) => uid != null && !!unitById(f, uid)?.debuffs.some(d => d.invert);
  if (f.cast && bad(f.cast.uid)) { f.cast = null; f.stats.cancels++; f.gcd = 0; }
  if (f.queued && bad(f.queued.uid)) f.queued = null;
}

/** 자동 힐러 (밸런스 시뮬레이션·구경 모드용, sim decide() 이식). 아직 안 배운 스킬은 건너뜀 */
export function autoHealer(f: Fight): void {
  dropInverted(f);
  if (f.hero === 'druid') { autoDruid(f); return; }
  if (f.hero === 'paladin') { autoPaladin(f); return; }
  autoTalents(f);
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return;
  const all = living(f), live = all.filter(u => !off(f, u)), g = gim(f);
  if (!live.length) return;
  const pct = (u: Unit) => u.hp / u.max;
  const low = lowest(f, live, pct);
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3.5);
  const cellIdx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  /** 배웠고 진동에 안 걸림 (잠김 · 울리기 전에 시전이 안 끝남) */
  const can = (k: SkillKey) => knows(f, k) && calmFor(f, k, g.calm);
  /** 큰 단일 힐: 급하거나 치유를 못 쓰면 순간 치유 */
  const big = (hurry: boolean): SkillKey | null => (hurry || !can('heal') ? (can('flash') ? 'flash' : null) : 'heal');
  // 찬가는 모두를 채우니 힐하면 손해인 사람이 있으면 안 씀
  if (can('hymn') && (f.cd.hymn ?? 0) <= 0 && live.length === all.length && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && f.mana >= 15) { use(f, 'hymn', 0); return; }
  for (const t of f.tels) if (t.kind === 'buster' && knows(f, 'guardian') && (f.cd.guardian ?? 0) <= 0 && f.mana >= 2) {
    const tk = unitById(f, t.units[0]);
    if (tk && tk.alive && pct(tk) < 0.75) { use(f, 'guardian', cellIdx(tk)); return; }
  }
  const bs = busterShort(f), bk = bs && big(bs.soon);
  if (bs && bk && !off(f, bs.u) && f.mana > 6) { use(f, bk, cellIdx(bs.u)); return; }
  if (g.pre && f.mana > 6 && can('flash')) { use(f, 'flash', cellIdx(g.pre)); return; }
  // 차례: 위급한 사람이 없으면 다음 번호에 즉시 단일 힐 (소생, 없으면 순간 치유)
  if (g.order && pct(low) > 0.3) {
    const k = can('renew') && f.mana >= SKILLS.renew.cost ? 'renew' : can('flash') && f.mana >= SKILLS.flash.cost ? 'flash' : null;
    if (k) { use(f, k, cellIdx(g.order)); return; }
  }
  // 생명 사슬이 곧 끊어지면 낮은 쪽부터
  if (g.link?.near && f.mana > 6) { const k = big(pct(g.link.u) < 0.5); if (k) { use(f, k, cellIdx(g.link.u)); return; } }
  const thrifty = f.mana < 25 || g.save; // 마나가 바닥나거나 아껴야 하면 무료 성언을 아끼지 않는다
  if (f.g.p >= 100 && pct(low) < (thrifty ? 0.7 : 0.45)) { use(f, 'serenity', cellIdx(low)); return; }
  // 광역 힐 판단 기준은 힐 크기에 맞춤 (레벨 배율 f.power, 07 4장). 힐하면 손해인 사람이 범위에 들면 그 자리는 안 씀
  const hp = f.power;
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let s = 0;
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s = off(f, v) ? -Infinity : s + Math.min(180 * hp, v.max - v.hp);
    if (s > score) { best = c; score = s; }
  }
  if (f.g.s >= 100 && score > (thrifty ? 450 : 900) * hp) { use(f, 'sanctify', cellIdx(best!)); return; }
  if (pct(low) < 0.35 && f.mana > 8 && can('flash')) { use(f, 'flash', cellIdx(low)); return; }
  if (score > 600 * hp && f.mana > 12 && can('poh')) { use(f, 'poh', cellIdx(best!)); return; }
  const purifyOk = can('purify') && (f.cd.purify ?? 0) <= 0 && f.mana >= 4;
  if (purifyOk) {
    const ok = (d: Debuff) => !!DISPELLABLE[d.type] && !d.trap && !d.lock && !g.hold.has(d);
    const c = byDispel(g, all.filter(u => u.debuffs.some(ok)), ok);
    if (c.length) { use(f, 'purify', cellIdx(c[0])); return; }
  }
  // 체력 선: 채우면 풀리는 사람을 선 위로
  if (g.cure && pct(low) > 0.4 && f.mana > 3) { const k = big(pct(g.cure) < 0.5); if (k) { use(f, k, cellIdx(g.cure)); return; } }
  // 헤매는 영혼: 위급한 사람이 없으면 해제로 바로, 아니면 소생을 깔고 단일 힐 (시간이 모자라면 순간 치유)
  if (g.soul && pct(low) > 0.5 && f.mana > 10) {
    const sl = g.soul, left = sl.soul!.until - f.t;
    if (purifyOk && canTarget(f, 'purify', sl.cell).ok) { use(f, 'purify', sl.cell); return; }
    if (sl.hot <= 0 && can('renew')) { use(f, 'renew', sl.cell); return; }
    const k = big(left < castOf(f, 'heal') + 1);
    if (k) { use(f, k, sl.cell); return; }
  }
  if (g.link && pct(low) > 0.4 && f.mana > 3) { const k = big(false); if (k) { use(f, k, cellIdx(g.link.u)); return; } }
  // 역류 중에는 지속 힐도 중첩이 되니 탱커가 꽤 다쳤을 때만
  const tanks = live.filter(u => u.role === 'tank' && u.hot <= 1 && (!g.few || pct(u) < 0.7)).concat(g.hit.filter(u => u.hot <= 1));
  if (tanks.length && f.mana > 5 && can('renew')) { use(f, 'renew', cellIdx(tanks[0])); return; }
  if (aoeSoon && !g.few && f.mana > 20 && can('renew')) { const n = live.find(u => u.hot <= 0); if (n) { use(f, 'renew', cellIdx(n)); return; } }
  if (pct(low) < topUp(f, g, 0.85) && f.mana > 3) {
    if (can('heal')) use(f, 'heal', cellIdx(low));
    else if (low.hot <= 0 && can('renew')) use(f, 'renew', cellIdx(low)); // 진동 직전: 시전 대신 즉시 지속 힐
  }
}

/** 사제 보조 버튼 특성 (GCD 밖): 여럿이 다치면 정점·흩빛, 위급하면 기적, 도망가는 파티원이 있으면 뒤쪽 빈 칸에 쉼터 */
function autoTalents(f: Fight): void {
  const act = f.tx.act;
  if (!act.miracle && !act.zenith && !act.scatter && !act.shelter) return;
  const live = living(f);
  if (!live.length) return;
  const pct = (u: Unit) => u.hp / u.max;
  const hurt = live.filter(u => pct(u) < 0.6).length;
  const many = hurt >= Math.max(2, Math.ceil(live.length * 0.3));
  if (act.miracle && talentReady(f, 'miracle').ok && f.g.p < 100 && (many || live.some(u => pct(u) < 0.3))) useTalent(f, 'miracle');
  if (act.zenith && many && talentReady(f, 'zenith').ok) useTalent(f, 'zenith');
  if (act.scatter && many && talentReady(f, 'scatter').ok) useTalent(f, 'scatter');
  if (act.shelter && talentReady(f, 'shelter').ok && live.some(u => u.p.flee && pct(u) < u.p.flee + 0.1)) {
    const c = f.cells.filter(x => !x.unit && !dangerAt(f, x.i)).sort((a, b) => b.row - a.row)[0];
    if (c) useTalent(f, 'shelter', c.i);
  }
}

// ---------- 드루이드·성기사 자동 힐러 (25 3장의 손맛대로: 드루이드는 미리 깔고, 성기사는 모았다가 씀) ----------
interface Ctx { live: Unit[]; all: Unit[]; g: Gim; pct: (u: Unit) => number; low: Unit; idx: (u: Unit) => number; ready: (k: SkillKey) => boolean; cluster: { best: Unit | null; score: number }; busterOn: Unit | null }
/** live = 힐해도 되는 사람 (뒤집힌 축복이 걸린 사람 뺌), all = 살아 있는 모두 */
function ctx(f: Fight, amt: number): Ctx | null {
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return null;
  const all = living(f), live = all.filter(u => !off(f, u));
  if (!live.length) return null;
  const pct = (u: Unit) => u.hp / u.max;
  const low = lowest(f, live, pct);
  const idx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  const ready = (k: SkillKey) => knows(f, k) && (f.cd[k] ?? 0) <= 0 && !f.lock[k] && f.mana >= SKILLS[k].cost;
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let s = 0;
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s = off(f, v) ? -Infinity : s + Math.min(amt * f.power, v.max - v.hp);
    if (s > score) { best = c; score = s; }
  }
  const bt = f.tels.find(t => t.kind === 'buster');
  const on = bt ? unitById(f, bt.units[0]) || null : null;
  return { live, all, g: gim(f), pct, low, idx, ready, cluster: { best, score }, busterOn: on && !off(f, on) ? on : null };
}
const tryUse = (f: Fight, k: SkillKey, u: Unit | null, idx: (u: Unit) => number): boolean => {
  const cell = u ? idx(u) : 0;
  if (!canTarget(f, k, cell).ok) return false;
  if (busy(f, k) > 0 && busy(f, k) >= calmOf(f)) return false; // 진동 전에 시전이 안 끝남 → 다음 후보 (즉시 스킬)
  return use(f, k, cell).ok;
};
/** 지울 디버프가 있는 파티원: 해제 순서(byDispel) 다음, 곧 터지는 것 (독창 등 남은 시간이 짧은 것)부터 */
const cleansable = (f: Fight, c: Ctx) => {
  const ok = (d: Debuff) => HEROES[f.hero].dispel.includes(d.type) && !d.trap && !d.lock && !c.g.hold.has(d);
  const left = (u: Unit) => Math.min(...u.debuffs.filter(ok).map(d => d.left));
  return byDispel(c.g, c.all.filter(u => left(u) < Infinity).sort((a, b) => left(a) - left(b)), ok)[0] || null;
};

function autoDruid(f: Fight): void {
  const c = ctx(f, 160);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  const sprouted = (u: Unit) => u.hots.some(h => h.key === 'sprout' && h.left > 2);
  if (ready('quietwood') && live.length === c.all.length && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2))) { use(f, 'quietwood', 0); return; }
  if (ready('rebirth') && !f.rebirthUsed && reviveTarget(f) && tryUse(f, 'rebirth', null, idx)) return;
  if (c.busterOn && ready('bark') && pct(c.busterOn) < 0.8 && tryUse(f, 'bark', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && f.mana > 4 && tryUse(f, 'growth', bs.u, idx)) return; }
  if (g.pre && ((!sprouted(g.pre) && tryUse(f, 'sprout', g.pre, idx)) || (f.mana > 4 && tryUse(f, 'growth', g.pre, idx)))) return;
  // 차례: 위급한 사람이 없으면 다음 번호에 새싹 (즉시)
  if (g.order && pct(low) > 0.3 && tryUse(f, 'sprout', g.order, idx)) return;
  // 생명 사슬이 곧 끊어지면 낮은 쪽부터
  if (g.link?.near && ((!sprouted(g.link.u) && tryUse(f, 'sprout', g.link.u, idx)) || (f.mana > 4 && tryUse(f, 'growth', g.link.u, idx)))) return;
  // 여럿이 크게 다쳤으면 들꽃 군락부터 (20인에서 한 명씩만 살리다 밀리지 않게)
  if (ready('wildflower') && c.cluster.best && c.cluster.score > 800 * f.power && tryUse(f, 'wildflower', c.cluster.best, idx)) return;
  // 위급: 거둘 지속 힐이 있으면 피워 내기, 없으면 생장
  if (pct(low) < 0.5) {
    if (ready('bloom') && low.hots.length && tryUse(f, 'bloom', low, idx)) return;
    if (!sprouted(low) && f.mana > 2 && tryUse(f, 'sprout', low, idx)) return;
    if (f.mana > 4 && tryUse(f, 'growth', low, idx)) return;
  }
  if (ready('natureCleanse')) { const d = cleansable(f, c); if (d && tryUse(f, 'natureCleanse', d, idx)) return; }
  if (g.cure && pct(low) > 0.4 && f.mana > 4 && tryUse(f, 'growth', g.cure, idx)) return;
  // 헤매는 영혼: 위급한 사람이 없으면 해제로 바로, 아니면 새싹을 깔고 생장
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('natureCleanse') && tryUse(f, 'natureCleanse', g.soul, idx)) || (!sprouted(g.soul) && tryUse(f, 'sprout', g.soul, idx)) || tryUse(f, 'growth', g.soul, idx))) return;
  if (g.link && pct(low) > 0.4 && f.mana > 4 && ((!sprouted(g.link.u) && tryUse(f, 'sprout', g.link.u, idx)) || tryUse(f, 'growth', g.link.u, idx))) return;
  const tank = live.find(u => u.role === 'tank' && !sprouted(u)) ?? g.hit.find(u => !sprouted(u));
  if (tank && f.mana > 2 && tryUse(f, 'sprout', tank, idx)) return;
  if (ready('wildflower') && c.cluster.best && c.cluster.score > 500 * f.power && tryUse(f, 'wildflower', c.cluster.best, idx)) return;
  // 새싹은 미리 깔아 둠: 다친 사람부터, 마나가 넉넉하면 멀쩡한 사람에게도 (광역 피해 대비)
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 6);
  // 역류 중에는 미리 깔기를 쉼 (스킬마다 중첩)
  const bare = g.few ? undefined : live.filter(u => !sprouted(u) && (pct(u) < 0.9 || (aoeSoon && f.mana > 30))).sort((a, b) => pct(a) - pct(b))[0];
  if (bare && f.mana > 2 && tryUse(f, 'sprout', bare, idx)) return;
  // 새싹을 다 깔았으면 남는 시간엔 생장 (마나가 넉넉할수록 일찍, 보호막 수정이 서 있으면 아낌, 그릇이 있으면 넘치게)
  const cut = g.spill || g.few ? topUp(f, g, 0.55) : f.mana > 60 && !g.save ? 0.85 : f.mana > 30 ? 0.7 : 0.55;
  if (pct(low) < cut && f.mana > 6 && tryUse(f, 'growth', low, idx)) return;
}

function autoPaladin(f: Fight): void {
  // 봉화는 첫 탱커에게 (배운 뒤 한 번)
  if (f.beacon == null && f.level >= HEROES.paladin.system.lv) { const t = living(f).find(u => u.role === 'tank'); if (t) setBeacon(f, t); }
  const c = ctx(f, 260);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  if (ready('sanctuary') && c.cluster.best && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && tryUse(f, 'sanctuary', c.cluster.best, idx)) return;
  if (c.busterOn && ready('sacrifice') && tryUse(f, 'sacrifice', c.busterOn, idx)) return;
  if (c.busterOn && ready('handGuard') && pct(c.busterOn) < 0.35 && c.busterOn.role !== 'tank' && tryUse(f, 'handGuard', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && ((ready('holyStrike') && tryUse(f, 'holyStrike', bs.u, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', bs.u, idx)))) return; }
  if (g.pre && ((ready('holyStrike') && tryUse(f, 'holyStrike', g.pre, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', g.pre, idx)))) return;
  // 차례: 위급한 사람이 없으면 다음 번호에 즉시 단일 힐 (빛 일격 → 빛의 서약 → 빛의 손길)
  if (g.order && pct(low) > 0.3 && ((ready('holyStrike') && tryUse(f, 'holyStrike', g.order, idx)) || (knows(f, 'oath') && f.power3 >= 1 && tryUse(f, 'oath', g.order, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', g.order, idx)))) return;
  /** 단일 힐 하나: 빛 일격 → 빛의 손길 */
  const one = (u: Unit) => (ready('holyStrike') && tryUse(f, 'holyStrike', u, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', u, idx));
  // 생명 사슬이 곧 끊어지면 낮은 쪽부터
  if (g.link?.near && one(g.link.u)) return;
  if (f.power3 >= 3) {
    if (knows(f, 'lightWave') && c.cluster.best && c.cluster.score > 600 * f.power && tryUse(f, 'lightWave', c.cluster.best, idx)) return;
    const oathless = (u: Unit) => !u.hots.some(h => h.key === 'oath');
    const tank = live.find(u => u.role === 'tank' && oathless(u)) ?? g.hit.find(oathless);
    if (knows(f, 'oath') && tryUse(f, 'oath', tank || low, idx)) return;
  }
  if (ready('handCleanse')) { const d = cleansable(f, c); if (d && tryUse(f, 'handCleanse', d, idx)) return; }
  if (g.cure && pct(low) > 0.4 && one(g.cure)) return;
  // 헤매는 영혼: 위급한 사람이 없으면 해제로 바로, 아니면 단일 힐
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('handCleanse') && tryUse(f, 'handCleanse', g.soul, idx)) || one(g.soul))) return;
  if (g.link && pct(low) > 0.4 && one(g.link.u)) return;
  if (pct(low) < 0.5 && ready('holyStrike') && tryUse(f, 'holyStrike', low, idx)) return;
  if (ready('holyStrike') && pct(low) < (g.few ? 0.6 : 0.92) && tryUse(f, 'holyStrike', low, idx)) return;
  if (pct(low) < topUp(f, g, 0.85) && f.mana > 3) tryUse(f, 'holyLight', low, idx);
}

/** 자동 힐러로 한 판 끝까지 */
export function simulate(cfg: FightConfig, maxT = 700): Fight {
  const f = create(cfg);
  while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
  return f;
}
