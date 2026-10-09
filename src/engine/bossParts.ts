/**
 * 보스 기믹 부품 (38 0-4): data/bosses.ts에 이름(p)으로 적은 부품이 실제로 하는 일.
 * 새 기믹은 여기에 부품 하나를 더하고, 보스 데이터에서 이름과 값으로 부른다.
 */
import type { AddDef, DebuffDef, FlowDo, FlowIf, FlowStep, SkillEffect, SkillWhen, ZoneCells } from '../data/bosses';
import { hexDist } from './board';
import { addDebuff, cellOf, damage, DT, emit, living, randomTargets, setMax, spread, unitById } from './core';
import { scheduleReactions } from './movement';
import type { BossSkill, Cell, Debuff, Fight, Mob, Telegraph, Unit } from './types';

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
    && (w.mythic == null || f.mythic === w.mythic)
    && (w.hpBelow == null || f.bossHp <= f.bossMax * w.hpBelow)
    && (!w.bodyAlive || w.bodyAlive.some(i => f.mobs[i]?.alive));
}

/** 기술이 맞을 때 (예고 없는 기술은 tel 없음) */
export function runEffect(f: Fight, s: BossSkill, e: SkillEffect, tel?: Telegraph): void {
  switch (e.p) {
    case 'auto': {
      const tk = aggroTarget(f);
      // 끌려온 사람이 있으면 탱커와 번갈아 맞음 (P-PULL)
      const pulled = f.party.filter(u => u.alive && u.pulled && u !== tk);
      if (pulled.length) {
        const i = ((s.st.alt as number | undefined) ?? 0) % (pulled.length + (tk ? 1 : 0));
        s.st.alt = i + 1;
        const u = tk ? (i === 0 ? null : pulled[i - 1]) : pulled[i];
        if (u) { damage(f, u, u.pulled!.dmg, false, 'party'); return; }
      }
      if (tk) autoHit(f, tk, e.dmg);
      return;
    }
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
      const n = f.mythic && e.nMythic ? e.nMythic : e.n === 'all' ? Infinity : e.n;
      const free = (u: Unit) => !u.debuffs.some(x => x.name === d.name);
      const ts = e.pick === 'lowest' ? lowestTargets(f, n, u => free(u) && u.role !== 'tank') : randomTargets(f, n, free);
      for (const u of ts) applyDebuff(f, u, d);
      // 전염 (26 3-1): 두 대상이 붙어 서 있으면 걸리자마자 둘 다 터짐
      if (e.burstAdjacent && ts.length === 2 && hexDist(cellOf(f, ts[0]), cellOf(f, ts[1])) === 1) {
        emit(f, { type: 'msg', text: `${d.name} 대상이 붙어 있어 바로 터짐` });
        for (const u of ts) { const x = u.debuffs.find(y => y.name === d.name); if (x) { u.debuffs = u.debuffs.filter(y => y !== x); spread(f, u); } }
      }
      return;
    }
    case 'rot':
      for (const u of rotTargets(f, e)) {
        let d = u.debuffs.find(x => x.name === e.debuff.name);
        if (!d) d = addDebuff(f, u, { ...e.debuff, stack: 0 });
        d.stack = Math.min(e.max, (d.stack || 0) + 1); d.left = e.debuff.left;
        d.maxCut = e.pct * d.stack; setMax(u);
      }
      return;
    case 'pull':
      for (const id of tel?.units ?? []) { const u = unitById(f, id); if (u) pull(f, u, e.sec, e.dmg); }
      return;
    case 'adds': {
      const n = f.mythic && e.nMythic ? e.nMythic : e.n;
      for (let i = 0; i < n; i++) spawnAdd(f, e.add);
      emit(f, { type: 'msg', text: `${e.add.name} ${n}마리 등장` });
      return;
    }
    case 'hole': {
      // 무너지는 바닥 (P-HOLE): 판 가운데에서 먼 빈 칸부터. 빈 칸은 늘 1개 이상 남김 (35 1-1 원칙 6)
      for (let i = 0; i < e.n && f.cells.filter(c => c.block === 'hole').length < e.max; i++) {
        const free = f.cells.filter(c => !c.unit && !c.block);
        if (free.length <= 1) break;
        const far = Math.max(...free.map(c => fromMid(f, c)));
        const pick = free.filter(c => fromMid(f, c) > far - 1e-6);
        pick[Math.floor(f.rng() * pick.length)].block = 'hole';
        emit(f, { type: 'msg', text: '바닥이 무너짐' });
      }
      return;
    }
  }
}

/** 디버프 걸기: 중첩 디버프(stackMax)는 이미 있으면 1중첩 더함, 최대 체력 깎는 디버프(maxCut)는 바로 반영 */
export function applyDebuff(f: Fight, u: Unit, def: DebuffDef): Debuff | null {
  if (def.stackMax) {
    const old = u.debuffs.find(x => x.name === def.name);
    if (old) { old.stack = Math.min(def.stackMax, (old.stack ?? 1) + 1); old.left = def.left; return old; }
  }
  const d = addDebuff(f, u, { ...def, stack: def.stackMax ? 1 : undefined });
  if (!u.debuffs.includes(d)) return null; // 주문 반사 등으로 안 걸림
  if (d.maxCut) setMax(u);
  if (d.untilBossLoss != null) d.bossAt = f.bossHp;
  return d;
}

/** 판 가운데에서 떨어진 거리 (피난처·구멍) */
function fromMid(f: Fight, c: Cell): number {
  const n = f.cells.length;
  const mx = f.cells.reduce((s, x) => s + x.px, 0) / n, my = f.cells.reduce((s, x) => s + x.py, 0) / n;
  return Math.hypot(c.px - mx, c.py - my);
}

/** 뒷줄부터 n명 (탱커·나·이미 끌려온 사람 빼고). 같은 줄이면 무작위 */
export function backTargets(f: Fight, n: number): Unit[] {
  const c = randomTargets(f, 99, u => u.role !== 'tank' && !u.me && !u.pulled);
  return c.sort((a, b) => cellOf(f, b).row - cellOf(f, a).row).slice(0, n);
}

/** 끌어당김 (P-PULL): 탱커(보스가 때릴 사람) 옆 빈 칸, 없으면 앞줄에 가까운 빈 칸으로 바로 끌어옴 */
function pull(f: Fight, u: Unit, sec: number, dmg: number): void {
  if (!u.alive) return;
  const tk = aggroTarget(f);
  const at = tk ? cellOf(f, tk) : null;
  const free = f.cells.filter(c => !c.unit && !c.block);
  const c = free.sort((a, b) => (at ? hexDist(a, at) - hexDist(b, at) : 0) || a.row - b.row)[0];
  if (u.moving) { const to = f.cells[u.moving.to]; if (to.unit === u) to.unit = null; u.moving = null; }
  u.react = null; u.fleeing = false; u.homeAt = null;
  if (c && c.row <= cellOf(f, u).row) {
    c.unit = u;
    u.moving = { from: u.cell, to: c.i, left: 0.3, total: 0.3 };
  }
  u.pulled = { until: f.t + sec, cell: c && u.moving ? c.i : u.cell, dmg };
  emit(f, { type: 'msg', text: `${u.nick} 끌려옴` });
}

/** 끌려온 사람: 시간이 다 되거나 끌려온 칸을 벗어나면 (도망·장판 피하기) 끝. 끝나면 units.ts가 제자리로 돌려보냄 */
export function pullTick(f: Fight, u: Unit): void {
  const p = u.pulled!;
  const there = u.moving ? u.moving.to === p.cell : u.cell === p.cell;
  if (f.t >= p.until || !there) u.pulled = null;
}

/** 쫄 하나: 아직 쫄이 붙지 않은 딜러를 맡음. 칸을 차지하는 쫄(토템)은 빈 칸 하나를 막고 이웃 칸에 오라 */
function spawnAdd(f: Fight, a: AddDef): void {
  const m: Mob = { id: f.nextId++, name: a.name, elite: false, hp: f.bossMax * a.hp, max: f.bossMax * a.hp, alive: true,
    add: { short: a.short, on: 0, dmg: a.dmg, every: a.every, next: f.t + a.every, down: a.down } };
  if (a.dmg > 0) m.add!.on = addTarget(f)?.id ?? 0;
  if (a.cell) {
    const free = f.cells.filter(c => !c.unit && !c.block);
    if (free.length <= 1) return; // 설 칸을 남김
    const c = free[Math.floor(f.rng() * free.length)];
    c.block = 'add'; m.add!.cell = c.i;
    if (a.cell.aura) {
      const id = f.nextId++;
      f.zones.push({ id, cells: new Set(f.cells.filter(x => hexDist(x, c) === 1 && !x.block).map(x => x.i)), end: Infinity, dps: a.cell.aura });
      m.add!.zone = id;
    }
  }
  f.mobs.push(m);
}

function addTarget(f: Fight): Unit | undefined {
  const taken = new Set(f.mobs.filter(m => m.alive && m.add).map(m => m.add!.on));
  return randomTargets(f, 1, u => (u.role === 'melee' || u.role === 'ranged') && !taken.has(u.id))[0]
    || randomTargets(f, 1, u => u.role === 'melee' || u.role === 'ranged')[0]
    || randomTargets(f, 1, u => !u.me)[0];
}

/** 매 틱 쫄: 맡은 사람 때리기 (그 사람이 쓰러지면 다른 딜러), 쓰러진 쫄은 한 번 down (파열) */
export function addsTick(f: Fight): void {
  for (const m of f.mobs) {
    const a = m.add;
    if (!a) continue;
    if (!m.alive) {
      if (a.done) continue;
      a.done = true;
      if (a.cell != null) { f.cells[a.cell].block = undefined; f.zones = f.zones.filter(z => z.id !== a.zone); }
      addDown(f, m);
      continue;
    }
    if (a.dmg <= 0 || f.t + 1e-9 < a.next) continue;
    a.next += a.every;
    if ((m.stun || 0) > f.t) continue;
    let u = unitById(f, a.on);
    if (!u || !u.alive) { u = addTarget(f); if (!u) continue; a.on = u.id; }
    damage(f, u, a.dmg, false, 'party');
  }
}

function addDown(f: Fight, m: Mob): void {
  const d = m.add!.down;
  if (!d) return;
  if (d.p === 'burst') { for (const u of living(f)) applyDebuff(f, u, d.debuff); return; }
  const on = unitById(f, m.add!.on);
  const u = on && on.alive ? on : randomTargets(f, 1)[0];
  if (u) applyDebuff(f, u, d.debuff);
}

/** 흐르는 장판: 이 열이 맞을 때 다음 열을 예고 (예고 = every초, 파티원이 미리 비킴) */
export function flowNext(f: Fight, tel: Telegraph): void {
  const { col, dir, every } = tel.flow!;
  const cells = new Set(f.cells.filter(c => c.col === col + dir).map(c => c.i));
  if (!cells.size) return;
  const next: Telegraph = { id: f.nextId++, skill: tel.skill, kind: 'zone', start: f.t, impact: f.t + every, units: [], cells, dps: tel.dps, dur: tel.dur, flow: { col: col + dir, dir, every } };
  f.tels.push(next);
  scheduleReactions(f, next);
}

/** 체력 비율이 가장 낮은 사람부터 n명 (사냥 P-HUNT, 35 9-1 「대상 고르기」). 같으면 먼저 선 사람 */
export function lowestTargets(f: Fight, n: number, filter: (u: Unit) => boolean = () => true): Unit[] {
  return living(f).filter(filter).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, n);
}

/** 최대 체력 깎기 대상: again 확률로 이미 걸린 사람 중에서 (썩은 축복), 아니면 무작위 */
function rotTargets(f: Fight, e: Extract<SkillEffect, { p: 'rot' }>): Unit[] {
  if (e.again == null) return randomTargets(f, e.n);
  const out: Unit[] = [];
  for (let i = 0; i < e.n; i++) {
    const has = (u: Unit) => u.debuffs.some(x => x.name === e.debuff.name) && !out.includes(u);
    const pool = f.rng() < e.again && living(f).some(has) ? has : (u: Unit) => !out.includes(u);
    const u = randomTargets(f, 1, pool)[0];
    if (u) out.push(u);
  }
  return out;
}

/** 장판 칸 고르기 */
export function zoneCells(f: Fight, s: BossSkill, z: ZoneCells): Set<number> {
  switch (z.p) {
    case 'safe': {
      // 안전 칸 n개: edge = 가운데에서 먼 칸부터, center = 가까운 칸부터 (+ 탱커 칸). 나머지가 맞는 칸
      const open = f.cells.filter(c => !c.block);
      const n = f.mythic && z.nMythic ? z.nMythic : z.n;
      const order = open.slice().sort((a, b) => (z.at === 'edge' ? fromMid(f, b) - fromMid(f, a) : fromMid(f, a) - fromMid(f, b)));
      const safe = new Set(order.slice(0, n).map(c => c.i));
      if (z.tank) { const tk = aggroTarget(f); if (tk) safe.add(tk.moving ? tk.moving.to : tk.cell); }
      return new Set(open.filter(c => !safe.has(c.i)).map(c => c.i));
    }
    case 'flow': {
      // 흐르는 장판의 첫 열: 맨 왼쪽(또는 오른쪽) 열. 방향은 s.st.dir (bossTick이 예고에 flow로 붙임)
      const left = z.from === 'right' ? false : z.from === 'alt' ? !(s.st.left as boolean | undefined) : true;
      if (z.from === 'alt') s.st.left = left;
      const cols = f.cells.map(c => c.col);
      const col = left ? Math.min(...cols) : Math.max(...cols);
      s.st.dir = left ? 1 : -1;
      return new Set(f.cells.filter(c => c.col === col).map(c => c.i));
    }
    case 'around': {
      const ok = randomTargets(f, 99).map(u => {
        const center = f.cells[u.cell];
        const set = new Set(f.cells.filter(x => hexDist(x, center) <= 1).map(x => x.i));
        const inside = living(f).filter(v => set.has(v.cell)).length;
        const free = f.cells.filter(x => !x.unit && !x.block && !set.has(x.i)).length;
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
