import { HEROES } from '../data/heroes';
import { DISPELLABLE, SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { cellOf, living, unitById } from './core';
import { create, step } from './fight';
import { canTarget, knows, use } from './healer';
import { setBeacon } from './heroes';
import { reviveTarget } from './items';
import type { Fight, FightConfig, Unit } from './types';

/** 자동 힐러 (밸런스 시뮬레이션·구경 모드용, sim decide() 이식). 아직 안 배운 스킬은 건너뜀 */
export function autoHealer(f: Fight): void {
  if (f.hero === 'druid') { autoDruid(f); return; }
  if (f.hero === 'paladin') { autoPaladin(f); return; }
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return;
  const live = living(f);
  if (!live.length) return;
  const pct = (u: Unit) => u.hp / u.max;
  const low = live.reduce((a, b) => (pct(b) < pct(a) ? b : a));
  const aoeSoon = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3.5);
  const cellIdx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  if (knows(f, 'hymn') && (f.cd.hymn ?? 0) <= 0 && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && f.mana >= 15) { use(f, 'hymn', 0); return; }
  for (const t of f.tels) if (t.kind === 'buster' && knows(f, 'guardian') && (f.cd.guardian ?? 0) <= 0 && f.mana >= 2) {
    const tk = unitById(f, t.units[0]);
    if (tk && tk.alive && pct(tk) < 0.75) { use(f, 'guardian', cellIdx(tk)); return; }
  }
  const thrifty = f.mana < 25; // 마나가 바닥나면 무료 성언을 아끼지 않는다
  if (f.g.p >= 100 && pct(low) < (thrifty ? 0.7 : 0.45)) { use(f, 'serenity', cellIdx(low)); return; }
  // 광역 힐 판단 기준은 힐 크기에 맞춤 (레벨 배율 f.power, 07 4장)
  const hp = f.power;
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let s = 0; for (const v of live) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s += Math.min(180 * hp, v.max - v.hp);
    if (s > score) { best = c; score = s; }
  }
  if (f.g.s >= 100 && score > (thrifty ? 450 : 900) * hp) { use(f, 'sanctify', cellIdx(best!)); return; }
  if (pct(low) < 0.35 && f.mana > 8) { use(f, 'flash', cellIdx(low)); return; }
  if (score > 600 * hp && f.mana > 12 && knows(f, 'poh')) { use(f, 'poh', cellIdx(best!)); return; }
  if (knows(f, 'purify') && (f.cd.purify ?? 0) <= 0 && f.mana >= 4) {
    const c = live.filter(u => u.debuffs.some(d => DISPELLABLE[d.type] && !d.trap));
    if (c.length) { use(f, 'purify', cellIdx(c[0])); return; }
  }
  const tanks = live.filter(u => u.role === 'tank' && u.hot <= 1);
  if (tanks.length && f.mana > 5 && knows(f, 'renew')) { use(f, 'renew', cellIdx(tanks[0])); return; }
  if (aoeSoon && f.mana > 20 && knows(f, 'renew')) { const n = live.find(u => u.hot <= 0); if (n) { use(f, 'renew', cellIdx(n)); return; } }
  if (pct(low) < 0.85 && f.mana > 3) use(f, 'heal', cellIdx(low));
}

// ---------- 드루이드·성기사 자동 힐러 (25 3장의 손맛대로: 드루이드는 미리 깔고, 성기사는 모았다가 씀) ----------
interface Ctx { live: Unit[]; pct: (u: Unit) => number; low: Unit; idx: (u: Unit) => number; ready: (k: SkillKey) => boolean; cluster: { best: Unit | null; score: number }; busterOn: Unit | null }
function ctx(f: Fight, amt: number): Ctx | null {
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return null;
  const live = living(f);
  if (!live.length) return null;
  const pct = (u: Unit) => u.hp / u.max;
  const low = live.reduce((a, b) => (pct(b) < pct(a) ? b : a));
  const idx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  const ready = (k: SkillKey) => knows(f, k) && (f.cd[k] ?? 0) <= 0 && f.mana >= SKILLS[k].cost;
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let s = 0; for (const v of live) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s += Math.min(amt * f.power, v.max - v.hp);
    if (s > score) { best = c; score = s; }
  }
  const bt = f.tels.find(t => t.kind === 'buster');
  const busterOn = bt ? unitById(f, bt.units[0]) || null : null;
  return { live, pct, low, idx, ready, cluster: { best, score }, busterOn };
}
const tryUse = (f: Fight, k: SkillKey, u: Unit | null, idx: (u: Unit) => number): boolean => {
  const cell = u ? idx(u) : 0;
  if (!canTarget(f, k, cell).ok) return false;
  return use(f, k, cell).ok;
};
const cleansable = (f: Fight, live: Unit[]) => live.find(u => u.debuffs.some(d => HEROES[f.hero].dispel.includes(d.type) && !d.trap)) || null;

function autoDruid(f: Fight): void {
  const c = ctx(f, 160);
  if (!c) return;
  const { live, pct, low, idx, ready } = c;
  const sprouted = (u: Unit) => u.hots.some(h => h.key === 'sprout' && h.left > 2);
  if (ready('quietwood') && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2))) { use(f, 'quietwood', 0); return; }
  if (ready('rebirth') && !f.rebirthUsed && reviveTarget(f) && tryUse(f, 'rebirth', null, idx)) return;
  if (c.busterOn && ready('bark') && pct(c.busterOn) < 0.8 && tryUse(f, 'bark', c.busterOn, idx)) return;
  // 위급: 거둘 지속 힐이 있으면 피워 내기, 없으면 생장
  if (pct(low) < 0.5) {
    if (ready('bloom') && low.hots.length && tryUse(f, 'bloom', low, idx)) return;
    if (!sprouted(low) && f.mana > 2 && tryUse(f, 'sprout', low, idx)) return;
    if (f.mana > 4 && tryUse(f, 'growth', low, idx)) return;
  }
  if (ready('natureCleanse')) { const d = cleansable(f, live); if (d && tryUse(f, 'natureCleanse', d, idx)) return; }
  const tank = live.find(u => u.role === 'tank' && !sprouted(u));
  if (tank && f.mana > 2 && tryUse(f, 'sprout', tank, idx)) return;
  if (ready('wildflower') && c.cluster.best && c.cluster.score > 500 * f.power && tryUse(f, 'wildflower', c.cluster.best, idx)) return;
  // 새싹은 미리 깔아 둠: 다친 사람부터, 마나가 넉넉하면 멀쩡한 사람에게도 (광역 피해 대비)
  const aoeSoon = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 6);
  const bare = live.filter(u => !sprouted(u) && (pct(u) < 0.9 || (aoeSoon && f.mana > 30))).sort((a, b) => pct(a) - pct(b))[0];
  if (bare && f.mana > 2 && tryUse(f, 'sprout', bare, idx)) return;
  // 새싹을 다 깔았으면 남는 시간엔 생장 (마나가 넉넉할수록 일찍)
  const cut = f.mana > 60 ? 0.85 : f.mana > 30 ? 0.7 : 0.55;
  if (pct(low) < cut && f.mana > 6 && tryUse(f, 'growth', low, idx)) return;
}

function autoPaladin(f: Fight): void {
  // 봉화는 첫 탱커에게 (배운 뒤 한 번)
  if (f.beacon == null && f.level >= HEROES.paladin.system.lv) { const t = living(f).find(u => u.role === 'tank'); if (t) setBeacon(f, t); }
  const c = ctx(f, 260);
  if (!c) return;
  const { live, pct, low, idx, ready } = c;
  if (ready('sanctuary') && c.cluster.best && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && tryUse(f, 'sanctuary', c.cluster.best, idx)) return;
  if (c.busterOn && ready('sacrifice') && tryUse(f, 'sacrifice', c.busterOn, idx)) return;
  if (c.busterOn && ready('handGuard') && pct(c.busterOn) < 0.35 && c.busterOn.role !== 'tank' && tryUse(f, 'handGuard', c.busterOn, idx)) return;
  if (f.power3 >= 3) {
    if (knows(f, 'lightWave') && c.cluster.best && c.cluster.score > 600 * f.power && tryUse(f, 'lightWave', c.cluster.best, idx)) return;
    const tank = live.find(u => u.role === 'tank' && !u.hots.some(h => h.key === 'oath'));
    if (knows(f, 'oath') && tryUse(f, 'oath', tank || low, idx)) return;
  }
  if (ready('handCleanse')) { const d = cleansable(f, live); if (d && tryUse(f, 'handCleanse', d, idx)) return; }
  if (pct(low) < 0.5 && ready('holyStrike') && tryUse(f, 'holyStrike', low, idx)) return;
  if (ready('holyStrike') && pct(low) < 0.92 && tryUse(f, 'holyStrike', low, idx)) return;
  if (pct(low) < 0.85 && f.mana > 3) tryUse(f, 'holyLight', low, idx);
}

/** 자동 힐러로 한 판 끝까지 */
export function simulate(cfg: FightConfig, maxT = 700): Fight {
  const f = create(cfg);
  while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
  return f;
}
