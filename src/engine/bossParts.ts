/**
 * 보스 기믹 부품 (38 0-4): data/bosses.ts에 이름(p)으로 적은 부품이 실제로 하는 일.
 * 새 기믹은 여기에 부품 하나를 더하고, 보스 데이터에서 이름과 값으로 부른다.
 */
import type { AddDef, AddJob, DebuffDef, FlowDo, FlowIf, FlowStep, SkillEffect, SkillWhen, ZoneCells } from '../data/bosses';
import { hexDist } from './board';
import { addDebuff, cellOf, damage, DT, emit, living, randomTargets, setMax, spread, unitById } from './core';
import { moveTo, scheduleReactions } from './movement';
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
    case 'order': {
      // 차례 (P-ORDER, 35 4-3): 탱커 아닌 n명 (나 포함)에게 번호. 이미 차례 중이면 건너뜀
      if (f.order) return;
      const ids = randomTargets(f, f.mythic && e.nMythic ? e.nMythic : e.n, u => u.role !== 'tank').map(u => u.id);
      if (!ids.length) return;
      const name = s.name ?? '차례';
      f.order = { name, ids, i: 0, until: f.t + e.sec, wrong: e.wrong, miss: e.miss, daze: e.daze };
      emit(f, { type: 'msg', text: `${name}: ${ORDER_NUM.slice(0, ids.length).split('').join(' → ')} 차례로 힐` });
      return;
    }
    case 'jail': {
      // 감옥 (P-JAIL, 35 3-I): 갇힌 사람 칸에 감옥이 겹쳐 나옴 (칸은 안 차지). 딜러가 깨면 풀림
      const ts = randomTargets(f, f.mythic && e.nMythic ? e.nMythic : e.n, u => u.role !== 'tank' && !u.me && !u.debuffs.some(d => d.name === e.name));
      const got: Unit[] = [];
      for (const u of ts) {
        const d = applyDebuff(f, u, { name: e.name, type: '물리', left: 600, lock: true, noDps: true, noMove: true, dot: e.dot });
        if (!d) continue;
        d.jail = true;
        got.push(u);
        f.mobs.push({ id: f.nextId++, name: e.name, elite: false, hp: f.bossMax * e.hp, max: f.bossMax * e.hp, alive: true,
          add: { short: e.short, on: u.id, dmg: 0, every: 0, next: Infinity, job: { p: 'jail' }, jobAt: Infinity, hold: d.id } });
      }
      if (got.length) emit(f, { type: 'msg', text: `${e.name}: ${got.map(u => u.nick).join(' · ')} 갇힘` });
      return;
    }
  }
}

/** 차례 번호표 */
export const ORDER_NUM = '①②③④⑤⑥';

/** 차례 중 단일 대상 힐 (healer.ts가 스킬을 쓸 때): 다음 번호면 하나 넘어가고, 앞 번호를 건너뛰면 그 사람 피해 + 처음부터 */
export function orderHeal(f: Fight, u: Unit): void {
  const o = f.order!;
  const k = o.ids.indexOf(u.id);
  if (k < o.i) return; // 번호 없는 사람 · 이미 받은 사람
  if (k === o.i) { o.i++; if (o.i >= o.ids.length) orderDone(f, true); return; }
  if (f.cfg.diff !== '쉬움') damage(f, u, o.wrong, true); // 쉬움은 피해 없이 처음부터
  o.i = 0;
  emit(f, { type: 'msg', text: `${o.name}: 순서가 틀려 처음부터` });
}

/** 매 틱 차례: 쓰러진 번호는 건너뜀, 시간이 다 되면 아직 못 받은 사람마다 피해 */
export function orderTick(f: Fight): void {
  const o = f.order!;
  while (o.i < o.ids.length && !unitById(f, o.ids[o.i])?.alive) o.i++;
  if (o.i >= o.ids.length) { orderDone(f, true); return; }
  if (f.t + 1e-9 < o.until) return;
  for (const id of o.ids.slice(o.i)) { const u = unitById(f, id); if (u) damage(f, u, o.miss, true); }
  orderDone(f, false);
}

function orderDone(f: Fight, ok: boolean): void {
  const o = f.order!;
  f.order = null;
  if (!ok) { emit(f, { type: 'msg', text: `${o.name}: 시간이 다 됨` }); return; }
  f.daze = { until: f.t + o.daze.sec, vuln: o.daze.vuln };
  emit(f, { type: 'sound', name: 'gauge' });
  emit(f, { type: 'msg', text: `${o.name} 성공: 보스 ${o.daze.sec}초 멍함 (받는 피해 +${Math.round((o.daze.vuln - 1) * 100)}%)` });
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

/**
 * 판에 나오는 적 하나 (35 3-I): 빈 칸 하나를 차지 (빈 칸이 1개뿐이면 안 나옴). 때리는 쫄은 부탱커가 옆 칸으로 와서 끌고,
 * 부탱커가 없으면 아직 쫄이 붙지 않은 딜러를 맡음. 오라가 있으면 이웃 칸에 끝나지 않는 장판. 자폭 쫄은 노린 사람에게서 from칸 떨어져 나옴
 */
function spawnAdd(f: Fight, a: AddDef): void {
  const j = a.job;
  const prey = j?.p === 'fixate' ? fixateTarget(f) : undefined;
  if (j?.p === 'fixate' && !prey) return;
  const c = prey && j?.p === 'fixate' ? cellNear(f, prey, j.from ?? 3) : addCell(f, a.at ?? (a.dmg > 0 ? 'front' : j?.p === 'march' ? 'back' : 'random'));
  if (!c) return;
  const m: Mob = { id: f.nextId++, name: a.name, elite: false, hp: f.bossMax * a.hp, max: f.bossMax * a.hp, alive: true,
    add: { short: a.short, on: prey?.id ?? 0, dmg: a.dmg, every: a.every, next: f.t + a.every, down: a.down, cell: c.i, job: j, cleave: a.cleave } };
  const u = a.dmg > 0 || j?.p === 'smash' ? addTarget(f) : undefined;
  if (u) m.add!.on = u.id;
  c.block = 'add';
  if (a.aura) {
    const id = f.nextId++;
    f.zones.push({ id, cells: new Set(f.cells.filter(x => hexDist(x, c) === 1 && !x.block).map(x => x.i)), end: Infinity, dps: a.aura });
    m.add!.zone = id;
  }
  if (j) m.add!.jobAt = f.t + (j.p === 'bomb' ? j.sec : 'every' in j ? j.every : Infinity);
  if (j?.p === 'march') m.add!.steps = c.row + 1; // 앞줄(0)까지 걸어와서 한 번 더 걸으면 흡수
  f.mobs.push(m);
  if (u && u.role === 'tank') offTankTo(f, u, c);
}

/** 자폭 쫄이 노릴 사람: 탱커 아닌 사람 (나 포함), 아직 다른 자폭 쫄이 노리지 않는 사람부터 */
function fixateTarget(f: Fight): Unit | undefined {
  const taken = new Set(f.mobs.filter(m => m.alive && m.add?.job?.p === 'fixate').map(m => m.add!.on));
  return randomTargets(f, 1, u => u.role !== 'tank' && !taken.has(u.id))[0] || randomTargets(f, 1, u => u.role !== 'tank')[0];
}

/** u에게서 d칸에 가장 가까운 빈 칸 (자폭 쫄이 나올 곳). 빈 칸은 1개 이상 남김 */
function cellNear(f: Fight, u: Unit, d: number): Cell | null {
  const free = f.cells.filter(c => !c.unit && !c.block);
  if (free.length <= 1) return null;
  const at = f.cells[u.moving ? u.moving.to : u.cell];
  const score = (c: Cell): number => Math.abs(hexDist(c, at) - d);
  const best = Math.min(...free.map(score));
  const pick = free.filter(c => score(c) === best);
  return pick[Math.floor(f.rng() * pick.length)];
}

/** 적이 나올 빈 칸: 자리 규칙에 가장 맞는 칸들 가운데 무작위. 빈 칸은 1개 이상 남김 */
function addCell(f: Fight, at: NonNullable<AddDef['at']>): Cell | null {
  const free = f.cells.filter(c => !c.unit && !c.block);
  if (free.length <= 1) return null;
  const tk = aggroTarget(f);
  const t = tk ? f.cells[tk.moving ? tk.moving.to : tk.cell] : f.cells[0];
  const score = (c: Cell): number => at === 'front' ? hexDist(c, t) * 10 + c.row : at === 'back' ? -c.row : at === 'center' ? fromMid(f, c) : at === 'edge' ? -fromMid(f, c) : 0;
  const best = Math.min(...free.map(score));
  const pick = free.filter(c => score(c) < best + 1e-6);
  return pick[Math.floor(f.rng() * pick.length)];
}

/** 부탱커 (P-OFFTANK): 보스를 맞지 않는 살아 있는 탱커 (10인·20인). 없으면 null */
export function offTank(f: Fight): Unit | null {
  const tk = aggroTarget(f);
  return f.party.find(u => u.alive && u.role === 'tank' && u !== tk) ?? null;
}

/** 쫄이 맡을 사람: 부탱커 → 아직 쫄이 붙지 않은 딜러 → 딜러 → 나 아닌 사람 */
function addTarget(f: Fight): Unit | undefined {
  const off = offTank(f);
  if (off) return off;
  const taken = new Set(f.mobs.filter(m => m.alive && m.add).map(m => m.add!.on));
  return randomTargets(f, 1, u => (u.role === 'melee' || u.role === 'ranged') && !taken.has(u.id))[0]
    || randomTargets(f, 1, u => u.role === 'melee' || u.role === 'ranged')[0]
    || randomTargets(f, 1, u => !u.me)[0];
}

/** 부탱커가 쫄 옆 빈 칸으로 감 (이미 붙어 있으면 그대로). 그 칸이 새 제자리 */
function offTankTo(f: Fight, u: Unit, c: Cell): void {
  if (u.moving || u.pulled || hexDist(f.cells[u.cell], c) <= 1) return;
  const from = f.cells[u.cell];
  const near = f.cells.filter(x => !x.unit && !x.block && hexDist(x, c) === 1).sort((a, b) => hexDist(a, from) - hexDist(b, from))[0];
  if (!near) return;
  moveTo(f, u, near);
  u.home = near.i; u.homeAt = null;
}

/** 일점사 순서 (P-FOCUS): 치유하는 쫄 → 폭탄 → 감옥 → 보호막 수정 → 그 밖, 같으면 먼저 나온 것 */
const FOCUS: Partial<Record<AddJob['p'], number>> = { mend: 0, bomb: 1, jail: 2, pylon: 3 };
const focusRank = (m: Mob): number => (m.add!.job && FOCUS[m.add!.job.p]) ?? 9;
export function focusOrder(f: Fight): Mob[] {
  return f.mobs.filter(m => m.alive && m.add).sort((a, b) => focusRank(a) - focusRank(b) || a.id - b.id);
}

/** 보스가 받는 피해 배율: 보호막 수정 (P-PYLON) × 멍함 (차례 성공) */
export function bossTaken(f: Fight): number {
  let m = f.daze ? f.daze.vuln : 1;
  for (const x of f.mobs) if (x.alive && x.add?.job?.p === 'pylon') m *= 1 - x.add.job.cut;
  return m;
}

/** 매 틱 쫄: 맡은 사람 때리기 (그 사람이 쓰러지면 다른 딜러), 쓰러진 쫄은 한 번 down (파열), 깨진 감옥은 그 사람을 풂 */
export function addsTick(f: Fight): void {
  for (const m of f.mobs) {
    const a = m.add;
    if (!a) continue;
    if (!m.alive) {
      if (a.done) continue;
      a.done = true;
      if (a.cell != null) { f.cells[a.cell].block = undefined; f.zones = f.zones.filter(z => z.id !== a.zone); }
      if (a.hold != null) unjail(f, m);
      addDown(f, m);
      continue;
    }
    if (a.hold != null && !unitById(f, a.on)?.debuffs.some(d => d.id === a.hold)) { vanish(m); continue; } // 갇힌 사람이 쓰러짐
    if (a.job && f.t + 1e-9 >= a.jobAt!) { addJob(f, m); if (!m.alive) continue; }
    if (a.job?.p === 'smash' && !a.warned && f.t + 1e-9 >= a.jobAt! - a.job.warn) { a.warned = true; emit(f, { type: 'sound', name: 'buster' }); }
    if (a.dmg <= 0 || f.t + 1e-9 < a.next) continue;
    a.next += a.every;
    if ((m.stun || 0) > f.t) continue;
    let u = unitById(f, a.on);
    if (!u || !u.alive) { u = addTarget(f); if (!u) continue; a.on = u.id; }
    damage(f, u, a.dmg, false, 'party');
  }
}

/** 치유하는 쫄은 보스 체력 회복, 폭탄은 터지고 사라짐 (35 3-I) */
function addJob(f: Fight, m: Mob): void {
  const a = m.add!, j = a.job!;
  if (j.p === 'mend') {
    a.jobAt! += j.every;
    if (f.bodyHp || f.invuln) return;
    const amt = Math.min(f.bossMax * j.pct, f.bossMax - f.bossHp);
    if (amt > 0) { f.bossHp += amt; emit(f, { type: 'bossHeal', amt: Math.round(amt), name: m.name }); }
  } else if (j.p === 'bomb') {
    a.jobAt = Infinity;
    vanish(m);
    emit(f, { type: 'sound', name: 'burst' });
    emit(f, { type: 'msg', text: `${m.name}이(가) 터짐` });
    for (const u of living(f)) damage(f, u, j.dmg, true);
  } else if (j.p === 'smash') {
    // 큰 쫄 (P-ELITE): 예고한 강타. 맡은 사람(부탱커)이 쓰러졌으면 다음 사람
    a.jobAt! += j.every; a.warned = false;
    if ((m.stun || 0) > f.t) return;
    let u = unitById(f, a.on);
    if (!u || !u.alive) { u = addTarget(f); if (!u) return; a.on = u.id; }
    damage(f, u, j.dmg, false, 'tank');
    emit(f, { type: 'shake', id: u.id });
  } else if (j.p === 'march') {
    // 걸어오는 쫄 (P-MARCH): 한 줄 앞으로. 걸음이 다 되면 보스에게 흡수
    a.jobAt! += j.every;
    a.steps = (a.steps ?? 1) - 1;
    if (a.steps > 0) { stepTo(f, m, x => x.row === f.cells[a.cell!].row - 1); return; }
    vanish(m);
    f.dmgMult *= (1 + f.empower + j.boost) / (1 + f.empower); // 겹칠수록 +10% · +20% · … (곱하지 않고 더함)
    f.empower += j.boost;
    emit(f, { type: 'sound', name: 'aoe' });
    emit(f, { type: 'msg', text: `${m.name}이(가) 보스에게 닿음: 보스 피해 +${Math.round(f.empower * 100)}%` });
  } else if (j.p === 'fixate') {
    // 자폭 쫄 (P-FIXATE): 붙어 있으면 터지고, 아니면 한 칸 다가감. 더 다가갈 칸이 없는데 두 칸 안이면 터짐
    a.jobAt! += j.every;
    let u = unitById(f, a.on);
    if (!u || !u.alive) { u = fixateTarget(f); if (!u) return; a.on = u.id; }
    const at = f.cells[u.moving ? u.moving.to : u.cell], d0 = hexDist(f.cells[a.cell!], at);
    if (d0 > 1 && stepTo(f, m, x => hexDist(x, at) < d0, x => hexDist(x, at))) return;
    if (d0 > 2) return;
    vanish(m);
    emit(f, { type: 'sound', name: 'burst' });
    emit(f, { type: 'msg', text: `${m.name}이(가) ${u.nick} 곁에서 터짐` });
    for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), at) === 1) damage(f, v, j.splash, true);
    damage(f, u, j.dmg, true);
  }
}

/** 판 위 적이 이웃 빈 칸으로 한 칸 (ok인 칸 중 by가 가장 작은 곳, 같으면 무작위). 갈 칸이 없으면 제자리 */
function stepTo(f: Fight, m: Mob, ok: (c: Cell) => boolean, by: (c: Cell) => number = () => 0): boolean {
  const a = m.add!, from = f.cells[a.cell!];
  const near = f.cells.filter(c => !c.unit && !c.block && hexDist(c, from) === 1 && ok(c));
  if (!near.length) return false;
  const best = Math.min(...near.map(by));
  const pick = near.filter(c => by(c) === best);
  const to = pick[Math.floor(f.rng() * pick.length)];
  from.block = undefined; to.block = 'add'; a.cell = to.i;
  return true;
}

/** 칸에서 사라짐 (터짐 · 흡수 · 갇힌 사람이 쓰러진 감옥): 쓰러짐 효과 없음. 칸은 다음 틱 addsTick이 비움 */
function vanish(m: Mob): void {
  m.hp = 0; m.alive = false; m.add!.down = undefined;
}

/** 감옥이 깨짐: 갇힌 사람을 풂 */
function unjail(f: Fight, m: Mob): void {
  const u = unitById(f, m.add!.on);
  if (!u || !u.alive) return;
  const d = u.debuffs.find(x => x.id === m.add!.hold);
  if (!d) return;
  u.debuffs = u.debuffs.filter(x => x !== d);
  emit(f, { type: 'cure', id: u.id, name: d.name });
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
