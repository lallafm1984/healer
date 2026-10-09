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
import { talentReady, useTalent } from './talents';
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
  return f.armor && f.me.alive && !inverted(f.me) && pct(f.me) < 0.6 && pct(f.me) < pct(low) + 0.15 ? f.me : low;
}

// ---------- 기믹 부품 대응 (38 0-5): 35 3장 표의 「힐러 판단」을 세 직업이 같이 봄 ----------
/** 뒤집힌 축복 (P-INVERT): 힐이 피해가 되는 사람 */
const inverted = (u: Unit) => u.debuffs.some(d => d.invert);

/** 이번 판단에서 보는 기믹 신호 */
interface Gim {
  /** 차례 (P-ORDER): 다음 번호. 위급한 사람이 없으면 바로 즉시 단일 힐 */
  order: Unit | null;
  /** 탱커처럼 계속 맞는 딜러: 끌려와 평타를 나눠 맞음 (P-PULL), 쫄이 때림 (P-ADD 5인), 갇힘 (P-JAIL) → 지속 힐을 탱커처럼 */
  hit: Unit[];
  /** 곧 크게 맞을 사람: 자폭 쫄이 두 칸 안 (P-FIXATE), 큰 쫄 강타 예고 (P-ELITE) → 버스터처럼 미리 가득 */
  pre: Unit | null;
  /** 체력 선 (P-WOUND 쇠약 · P-FULL 완치 표식): 선 아래라 채우면 풀리는 사람, 모자란 양이 적은 사람부터 */
  cure: Unit | null;
  /** 곧 모두가 맞음: 폭탄이 3초 안에 터짐 (P-BOMB), 쓰러질 때 파열을 거는 쫄 떼가 거의 다 잡힘 (P-SWARM·P-BURST) → 광역 예고처럼 지속 힐을 미리 */
  aoe: boolean;
  /** 보호막 수정 (P-PYLON)이 서 있음: 깨는 동안 광폭 시계가 흐르니 마나를 아낌 */
  save: boolean;
  /** 판에 적이 있음 (P-ADD): 딜러가 일점사로 빨리 잡아야 하니 딜러의 딜 0 디버프(침묵·얼림)를 먼저 지움 */
  adds: boolean;
}

function gim(f: Fight): Gim {
  let order: Unit | null = null;
  if (f.order) { const u = unitById(f, f.order.ids[f.order.i]); if (u && u.alive && !inverted(u)) order = u; }
  const adds = f.mobs.filter(m => m.alive && m.add);
  const hit = f.party.filter(u => u.alive && u.role !== 'tank' && !inverted(u)
    && (u.pulled || u.debuffs.some(d => d.jail) || adds.some(m => m.add!.dmg > 0 && m.add!.on === u.id)));
  let pre: Unit | null = null;
  for (const m of adds) {
    const a = m.add!, u = unitById(f, a.on);
    if (!u || !u.alive || inverted(u) || u.hp >= u.max * 0.95) continue;
    if ((a.job?.p === 'fixate' && hexDist(f.cells[a.cell!], cellOf(f, u)) <= 2) || (a.job?.p === 'smash' && a.warned)) { pre = u; break; }
  }
  const gap = (u: Unit) => Math.max(...u.debuffs.filter(d => d.cureAt != null).map(d => d.cureAt! * u.max - u.hp));
  const cure = f.party.filter(u => u.alive && !inverted(u) && gap(u) > 0).sort((a, b) => gap(a) - gap(b))[0] ?? null;
  return {
    order, hit, pre, cure,
    aoe: adds.some(m => (m.add!.job?.p === 'bomb' && m.add!.jobAt! - f.t < 3) || (m.add!.down?.p === 'burst' && m.hp < m.max * 0.25)),
    save: adds.some(m => m.add!.job?.p === 'pylon'),
    adds: adds.length > 0,
  };
}

/** 해제 순서 (35 3-D·3-I): 뒤집힌 축복(힐을 막음) → 판에 적이 있으면 딜러의 딜 0 → 그 밖. 같은 순위는 넘겨받은 순서 그대로 */
function byDispel(g: Gim, cands: Unit[], ok: (d: Debuff) => boolean): Unit[] {
  const rank = (u: Unit) => (u.debuffs.some(d => ok(d) && d.invert) ? 0 : g.adds && (u.role === 'melee' || u.role === 'ranged') && u.debuffs.some(d => ok(d) && d.noDps) ? 1 : 2);
  return cands.map((u, i) => ({ u, i, r: rank(u) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.u);
}

/** 자동 힐러 (밸런스 시뮬레이션·구경 모드용, sim decide() 이식). 아직 안 배운 스킬은 건너뜀 */
export function autoHealer(f: Fight): void {
  if (f.hero === 'druid') { autoDruid(f); return; }
  if (f.hero === 'paladin') { autoPaladin(f); return; }
  autoTalents(f);
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return;
  const all = living(f), live = all.filter(u => !inverted(u)), g = gim(f);
  if (!live.length) return;
  const pct = (u: Unit) => u.hp / u.max;
  const low = lowest(f, live, pct);
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3.5);
  const cellIdx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  // 찬가는 모두를 채우니 뒤집힌 축복이 걸린 사람이 있으면 안 씀
  if (knows(f, 'hymn') && (f.cd.hymn ?? 0) <= 0 && live.length === all.length && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && f.mana >= 15) { use(f, 'hymn', 0); return; }
  for (const t of f.tels) if (t.kind === 'buster' && knows(f, 'guardian') && (f.cd.guardian ?? 0) <= 0 && f.mana >= 2) {
    const tk = unitById(f, t.units[0]);
    if (tk && tk.alive && pct(tk) < 0.75) { use(f, 'guardian', cellIdx(tk)); return; }
  }
  const bs = busterShort(f);
  if (bs && !inverted(bs.u) && f.mana > 6) { use(f, bs.soon || !knows(f, 'heal') ? 'flash' : 'heal', cellIdx(bs.u)); return; }
  if (g.pre && f.mana > 6) { use(f, 'flash', cellIdx(g.pre)); return; }
  // 차례: 위급한 사람이 없으면 다음 번호에 즉시 단일 힐 (소생, 없으면 순간 치유)
  if (g.order && pct(low) > 0.3) {
    const k = knows(f, 'renew') && f.mana >= SKILLS.renew.cost ? 'renew' : f.mana >= SKILLS.flash.cost ? 'flash' : null;
    if (k) { use(f, k, cellIdx(g.order)); return; }
  }
  const thrifty = f.mana < 25 || g.save; // 마나가 바닥나거나 아껴야 하면 무료 성언을 아끼지 않는다
  if (f.g.p >= 100 && pct(low) < (thrifty ? 0.7 : 0.45)) { use(f, 'serenity', cellIdx(low)); return; }
  // 광역 힐 판단 기준은 힐 크기에 맞춤 (레벨 배율 f.power, 07 4장). 뒤집힌 축복이 걸린 사람이 범위에 들면 그 자리는 안 씀
  const hp = f.power;
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let s = 0;
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s = inverted(v) ? -Infinity : s + Math.min(180 * hp, v.max - v.hp);
    if (s > score) { best = c; score = s; }
  }
  if (f.g.s >= 100 && score > (thrifty ? 450 : 900) * hp) { use(f, 'sanctify', cellIdx(best!)); return; }
  if (pct(low) < 0.35 && f.mana > 8) { use(f, 'flash', cellIdx(low)); return; }
  if (score > 600 * hp && f.mana > 12 && knows(f, 'poh')) { use(f, 'poh', cellIdx(best!)); return; }
  if (knows(f, 'purify') && (f.cd.purify ?? 0) <= 0 && f.mana >= 4) {
    const ok = (d: Debuff) => !!DISPELLABLE[d.type] && !d.trap && !d.lock;
    const c = byDispel(g, all.filter(u => u.debuffs.some(ok)), ok);
    if (c.length) { use(f, 'purify', cellIdx(c[0])); return; }
  }
  // 체력 선: 채우면 풀리는 사람을 선 위로
  if (g.cure && pct(low) > 0.4 && f.mana > 3) { use(f, pct(g.cure) < 0.5 || !knows(f, 'heal') ? 'flash' : 'heal', cellIdx(g.cure)); return; }
  const tanks = live.filter(u => u.role === 'tank' && u.hot <= 1).concat(g.hit.filter(u => u.hot <= 1));
  if (tanks.length && f.mana > 5 && knows(f, 'renew')) { use(f, 'renew', cellIdx(tanks[0])); return; }
  if (aoeSoon && f.mana > 20 && knows(f, 'renew')) { const n = live.find(u => u.hot <= 0); if (n) { use(f, 'renew', cellIdx(n)); return; } }
  if (pct(low) < (g.save ? 0.7 : 0.85) && f.mana > 3) use(f, 'heal', cellIdx(low));
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
  const all = living(f), live = all.filter(u => !inverted(u));
  if (!live.length) return null;
  const pct = (u: Unit) => u.hp / u.max;
  const low = lowest(f, live, pct);
  const idx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  const ready = (k: SkillKey) => knows(f, k) && (f.cd[k] ?? 0) <= 0 && !f.lock[k] && f.mana >= SKILLS[k].cost;
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let s = 0;
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s = inverted(v) ? -Infinity : s + Math.min(amt * f.power, v.max - v.hp);
    if (s > score) { best = c; score = s; }
  }
  const bt = f.tels.find(t => t.kind === 'buster');
  const on = bt ? unitById(f, bt.units[0]) || null : null;
  return { live, all, g: gim(f), pct, low, idx, ready, cluster: { best, score }, busterOn: on && !inverted(on) ? on : null };
}
const tryUse = (f: Fight, k: SkillKey, u: Unit | null, idx: (u: Unit) => number): boolean => {
  const cell = u ? idx(u) : 0;
  if (!canTarget(f, k, cell).ok) return false;
  return use(f, k, cell).ok;
};
/** 지울 디버프가 있는 파티원: 해제 순서(byDispel) 다음, 곧 터지는 것 (독창 등 남은 시간이 짧은 것)부터 */
const cleansable = (f: Fight, c: Ctx) => {
  const ok = (d: Debuff) => HEROES[f.hero].dispel.includes(d.type) && !d.trap && !d.lock;
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
  { const bs = busterShort(f); if (bs && !inverted(bs.u) && f.mana > 4 && tryUse(f, 'growth', bs.u, idx)) return; }
  if (g.pre && ((!sprouted(g.pre) && tryUse(f, 'sprout', g.pre, idx)) || (f.mana > 4 && tryUse(f, 'growth', g.pre, idx)))) return;
  // 차례: 위급한 사람이 없으면 다음 번호에 새싹 (즉시)
  if (g.order && pct(low) > 0.3 && tryUse(f, 'sprout', g.order, idx)) return;
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
  const tank = live.find(u => u.role === 'tank' && !sprouted(u)) ?? g.hit.find(u => !sprouted(u));
  if (tank && f.mana > 2 && tryUse(f, 'sprout', tank, idx)) return;
  if (ready('wildflower') && c.cluster.best && c.cluster.score > 500 * f.power && tryUse(f, 'wildflower', c.cluster.best, idx)) return;
  // 새싹은 미리 깔아 둠: 다친 사람부터, 마나가 넉넉하면 멀쩡한 사람에게도 (광역 피해 대비)
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 6);
  const bare = live.filter(u => !sprouted(u) && (pct(u) < 0.9 || (aoeSoon && f.mana > 30))).sort((a, b) => pct(a) - pct(b))[0];
  if (bare && f.mana > 2 && tryUse(f, 'sprout', bare, idx)) return;
  // 새싹을 다 깔았으면 남는 시간엔 생장 (마나가 넉넉할수록 일찍, 보호막 수정이 서 있으면 아낌)
  const cut = f.mana > 60 && !g.save ? 0.85 : f.mana > 30 ? 0.7 : 0.55;
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
  { const bs = busterShort(f); if (bs && !inverted(bs.u) && ((ready('holyStrike') && tryUse(f, 'holyStrike', bs.u, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', bs.u, idx)))) return; }
  if (g.pre && ((ready('holyStrike') && tryUse(f, 'holyStrike', g.pre, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', g.pre, idx)))) return;
  // 차례: 위급한 사람이 없으면 다음 번호에 즉시 단일 힐 (빛 일격 → 빛의 서약 → 빛의 손길)
  if (g.order && pct(low) > 0.3 && ((ready('holyStrike') && tryUse(f, 'holyStrike', g.order, idx)) || (knows(f, 'oath') && f.power3 >= 1 && tryUse(f, 'oath', g.order, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', g.order, idx)))) return;
  if (f.power3 >= 3) {
    if (knows(f, 'lightWave') && c.cluster.best && c.cluster.score > 600 * f.power && tryUse(f, 'lightWave', c.cluster.best, idx)) return;
    const oathless = (u: Unit) => !u.hots.some(h => h.key === 'oath');
    const tank = live.find(u => u.role === 'tank' && oathless(u)) ?? g.hit.find(oathless);
    if (knows(f, 'oath') && tryUse(f, 'oath', tank || low, idx)) return;
  }
  if (ready('handCleanse')) { const d = cleansable(f, c); if (d && tryUse(f, 'handCleanse', d, idx)) return; }
  if (g.cure && pct(low) > 0.4 && ((ready('holyStrike') && tryUse(f, 'holyStrike', g.cure, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', g.cure, idx)))) return;
  if (pct(low) < 0.5 && ready('holyStrike') && tryUse(f, 'holyStrike', low, idx)) return;
  if (ready('holyStrike') && pct(low) < 0.92 && tryUse(f, 'holyStrike', low, idx)) return;
  if (pct(low) < (g.save ? 0.7 : 0.85) && f.mana > 3) tryUse(f, 'holyLight', low, idx);
}

/** 자동 힐러로 한 판 끝까지 */
export function simulate(cfg: FightConfig, maxT = 700): Fight {
  const f = create(cfg);
  while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
  return f;
}
