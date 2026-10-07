import { DISPELLABLE } from '../data/skills';
import { hexDist } from './board';
import { cellOf, living, unitById } from './core';
import { create, step } from './fight';
import { knows, use } from './healer';
import type { Fight, FightConfig, Unit } from './types';

/** 자동 힐러 (밸런스 시뮬레이션·구경 모드용, sim decide() 이식). 아직 안 배운 스킬은 건너뜀 */
export function autoHealer(f: Fight): void {
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

/** 자동 힐러로 한 판 끝까지 */
export function simulate(cfg: FightConfig, maxT = 700): Fight {
  const f = create(cfg);
  while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
  return f;
}
