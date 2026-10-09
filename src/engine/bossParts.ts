/**
 * 보스 기믹 부품 (38 0-4): data/bosses.ts에 이름(p)으로 적은 부품이 실제로 하는 일.
 * 새 기믹은 여기에 부품 하나를 더하고, 보스 데이터에서 이름과 값으로 부른다.
 */
import type { FlowDo, FlowIf, FlowStep, SkillEffect, SkillWhen, ZoneCells } from '../data/bosses';
import { hexDist } from './board';
import { addDebuff, cellOf, damage, DT, emit, living, randomTargets, spread, unitById } from './core';
import type { BossSkill, Fight, Telegraph, Unit } from './types';

/**
 * 보스가 때릴 사람: 살아 있는 탱커. 탱커가 모두 쓰러지면 대신 막는 사람
 * (버팀목 특성 → 근접 → 원거리 → 나, 2026-10-07 Lim)
 */
export function aggroTarget(f: Fight): Unit | null {
  const alive = f.party.filter(u => u.alive);
  return alive.find(u => u.role === 'tank') || alive.find(u => u.traits.includes('bulwark')) || alive.find(u => u.role === 'melee') || alive.find(u => u.role === 'ranged') || alive.find(u => u.me) || null;
}

/** 보스 평타 ±30% (전사 「단단한 몸」은 ±15%, 17) */
export function autoHit(f: Fight, tk: Unit, base: number): void {
  const r = f.rng();
  damage(f, tk, base * (tk.cls === 'warrior' ? 0.85 + 0.3 * r : 0.7 + 0.6 * r), false, 'tank');
}

/** 기술이 도는 조건 */
export function whenFn(w: SkillWhen | undefined): BossSkill['active'] {
  if (!w) return () => true;
  return f => (!w.phase || w.phase.includes(f.phase))
    && (w.hpBelow == null || f.bossHp <= f.bossMax * w.hpBelow)
    && (!w.bodyAlive || w.bodyAlive.some(i => f.mobs[i]?.alive));
}

/** 기술이 맞을 때 (예고 없는 기술은 tel 없음) */
export function runEffect(f: Fight, s: BossSkill, e: SkillEffect, tel?: Telegraph): void {
  switch (e.p) {
    case 'auto': { const tk = aggroTarget(f); if (tk) autoHit(f, tk, e.dmg); return; }
    case 'tank':
      for (const id of tel?.units ?? []) { const u = unitById(f, id); if (u) damage(f, u, s.dmg!, false, 'tank'); }
      return;
    case 'all': {
      const dmg = e.phaseDmg?.[f.phase] ?? e.dmg;
      for (const u of living(f)) damage(f, u, dmg, true);
      return;
    }
    case 'debuff': {
      const d = e.debuff;
      const ts = randomTargets(f, f.mythic && e.nMythic ? e.nMythic : e.n, u => !u.debuffs.some(x => x.name === d.name));
      for (const u of ts) addDebuff(f, u, { ...d });
      // 전염 (26 3-1): 두 대상이 붙어 서 있으면 걸리자마자 둘 다 터짐
      if (e.burstAdjacent && ts.length === 2 && hexDist(cellOf(f, ts[0]), cellOf(f, ts[1])) === 1) {
        emit(f, { type: 'msg', text: `${d.name} 대상이 붙어 있어 바로 터짐` });
        for (const u of ts) { const x = u.debuffs.find(y => y.name === d.name); if (x) { u.debuffs = u.debuffs.filter(y => y !== x); spread(f, u); } }
      }
      return;
    }
    case 'rot':
      for (const u of randomTargets(f, e.n)) {
        let d = u.debuffs.find(x => x.name === e.debuff.name);
        if (!d) d = addDebuff(f, u, { ...e.debuff, stack: 0 });
        d.stack = Math.min(e.max, (d.stack || 0) + 1); d.left = e.debuff.left;
        u.max = u.base * (1 - e.pct * d.stack); u.hp = Math.min(u.hp, u.max);
      }
      return;
  }
}

/** 장판 칸 고르기 */
export function zoneCells(f: Fight, s: BossSkill, z: ZoneCells): Set<number> {
  switch (z.p) {
    case 'around': {
      const ok = randomTargets(f, 99).map(u => {
        const center = f.cells[u.cell];
        const set = new Set(f.cells.filter(x => hexDist(x, center) <= 1).map(x => x.i));
        const inside = living(f).filter(v => set.has(v.cell)).length;
        const free = f.cells.filter(x => !x.unit && !set.has(x.i)).length;
        return free >= inside ? set : null;
      }).filter((x): x is Set<number> => !!x);
      if (ok.length) return ok[0];
      const c = randomTargets(f, 1)[0];
      return c ? new Set([c.cell]) : new Set<number>();
    }
    case 'edge': {
      // 26 3-1: 판 절반이면 19칸에 10명이 피할 칸이 모자라 바깥 1열, 좌우 번갈아
      const side = s.st.side = !s.st.side;
      const out = new Set<number>();
      for (let r = 0; r < f.rows; r++) {
        const row = f.cells.filter(c => c.row === r);
        if (row.length) out.add(row.reduce((a, b) => ((side ? b.px < a.px : b.px > a.px) ? b : a)).i);
      }
      return out;
    }
    case 'bodyCols': {
      const turn = (s.st.turn as number | undefined) ?? 0;
      const alive = Array.from({ length: z.bodies }, (_, i) => i).filter(i => f.mobs[i].alive);
      const order = alive.filter(i => i >= turn).concat(alive.filter(i => i < turn));
      const pick = order.slice(0, f.mythic ? z.nMythic : 1);
      s.st.turn = (pick[pick.length - 1] + 1) % z.bodies;
      const cols = new Set(pick.flatMap(i => Array.from({ length: z.per }, (_, k) => i * z.per + k)));
      return new Set(f.cells.filter(c => cols.has(c.col)).map(c => c.i));
    }
  }
}

const flowIf = (f: Fight, c: FlowIf): boolean =>
  (c.phase == null || f.phase === c.phase)
  && (c.mythic == null || f.mythic === c.mythic)
  && (c.idle == null || f.bs[c.idle].next === Infinity)
  && (c.hpBelow == null || f.bossHp / f.bossMax <= c.hpBelow)
  && (!c.interOver || f.t >= f.interEnd!)
  && (!c.bodiesDead || c.bodiesDead.every(i => !f.mobs[i].alive));

function flowDo(f: Fight, d: FlowDo): void {
  switch (d.p) {
    case 'phase': f.phase = d.n; f.phaseName = d.name; return;
    case 'text': emit(f, { type: 'phase', text: d.text }); return;
    case 'start': f.bs[d.skill].next = f.t + d.in; return;
    case 'period': f.bs[d.skill].period = d.sec; return;
    case 'inter': f.invuln = true; f.interEnd = f.t + d.sec; return;
    case 'interEnd': f.invuln = false; f.rats = []; return;
    case 'rats': {
      const ranged = living(f).filter(u => u.role === 'ranged').sort((a, b) => cellOf(f, b).row - cellOf(f, a).row);
      f.rats = ranged.slice(0, d.n).map(u => u.id);
      return;
    }
    case 'debuffDebuffed':
      for (const u of living(f)) if (u.debuffs.length) addDebuff(f, u, { ...d.debuff });
      return;
  }
}

/** 매 틱 보스 쪽 흐름 (페이즈 전환·쥐떼·노래) */
export function runFlow(f: Fight, steps: FlowStep[]): void {
  for (const st of steps) {
    switch (st.p) {
      case 'when': if (flowIf(f, st.if)) for (const d of st.do) flowDo(f, d); break;
      case 'rats':
        if (f.phase === st.phase) for (const id of f.rats) { const u = unitById(f, id); if (u) damage(f, u, st.dps * DT); }
        break;
      case 'song': {
        if (f.phase !== st.phase) break;
        const cols = new Set(Array.from({ length: st.bodies }, (_, i) => i).filter(i => f.mobs[i].alive).flatMap(i => Array.from({ length: st.per }, (_, k) => i * st.per + k)));
        for (const u of living(f)) if (cols.has(cellOf(f, u).col)) damage(f, u, st.dps * DT, true);
        break;
      }
    }
  }
}
