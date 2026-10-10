/**
 * 보스 기믹 부품 (38 0-4): data/bosses.ts에 이름(p)으로 적은 부품이 실제로 하는 일.
 * 새 기믹은 여기에 부품 하나를 더하고, 보스 데이터에서 이름과 값으로 부른다.
 */
import { ABILITIES } from '../data/abilities';
import type { AddDef, AddDown, AddJob, BossDef, DebuffDef, DebuffEnd, FlowDo, FlowIf, FlowStep, SkillEffect, SkillWhen, ZoneCells } from '../data/bosses';
import { HEROES } from '../data/heroes';
import type { PersName } from '../data/personalities';
import { SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { addDebuff, bark, cellOf, damage, DT, emit, empowerBoss, hasAbsorb, heal, living, onDebuffEnd, randomTargets, setMax, spread, unitById } from './core';
import { dangerAt, finishMove, moveTo, scheduleReaction, scheduleReactions, zoneOf } from './movement';
import { hotTick, stepAway } from './units';
import { during, immune, specBroken, specLand, specPhase, specRod, specVessel, specQuake, specReveal, specRewind, sv } from './specials';
import type { BossSkill, Cell, Debuff, Fight, Mob, Telegraph, Unit } from './types';

/**
 * 보스가 때릴 사람: 5인 대신 맞는 사람 (DebuffDef.sub), 보스를 잡은 탱커 (탱커 교대 P-SWAP), 없으면 줄 앞 살아 있는 탱커. 탱커가 모두 쓰러지면 대신 막는 사람
 * (버팀목 특성 → 근접 → 원거리 → 나, 2026-10-07 Lim)
 */
export function aggroTarget(f: Fight): Unit | null {
  const alive = living(f); // 띄워 올려진 탱커는 못 때림 → 다른 탱커 (탱커 띄우기, 56 5장)
  const sub = f.sub && f.t < f.sub.until ? alive.find(u => u.id === f.sub!.id) : undefined;
  const held = f.hold != null ? alive.find(u => u.id === f.hold && u.role === 'tank') : undefined;
  return sub || held || alive.find(u => u.role === 'tank') || alive.find(u => u.traits.includes('bulwark')) || alive.find(u => u.role === 'melee') || alive.find(u => u.role === 'ranged') || alive.find(u => u.me) || null;
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
      for (const id of tel?.units ?? []) {
        const u = unitById(f, id);
        if (!u) continue;
        damage(f, u, s.dmg!, false, 'tank');
        if (e.debuff && u.alive) applyDebuff(f, u, e.debuff); // 물어뜯기 독 · 공허 중첩
      }
      return;
    case 'hunt':
      for (const u of lowestTargets(f, f.mythic && e.nMythic ? e.nMythic : (e.n ?? 1), x => x.role !== 'tank')) {
        emit(f, { type: 'msg', text: `${s.name ?? '사냥'}: ${u.nick}` }); emit(f, { type: 'fx', name: 'slam', on: u.id }); damage(f, u, e.dmg, false, 'party');
      }
      return;
    case 'greed':
      // 보물 욕심 (P-GREED): 예고 때 고른 사람 (가장 건강한 사람)에게 금화
      for (const id of tel?.units ?? []) {
        const u = unitById(f, id);
        if (!u || !u.alive) continue;
        emit(f, { type: 'fx', name: 'greed-coin', on: u.id });
        damage(f, u, e.dmg, false, 'party');
        if (e.debuff && u.alive) applyDebuff(f, u, e.debuff);
      }
      if (tel?.units.length) emit(f, { type: 'msg', text: `${s.name ?? '보물 욕심'}: ${tel.units.map(id => unitById(f, id)?.nick).filter(Boolean).join(' · ')}` });
      return;
    case 'melt': {
      // 녹는 보호막 (P-MELT, 51 5장): 열기 동안 흡수 보호막이 녹고 보호막 · 외부 생존기가 빨리 끝남 (units.ts unitTick)
      const name = s.name ?? '열기';
      f.melt = { name, until: Math.max(f.melt && f.t < f.melt.until ? f.melt.until : 0, f.t + e.sec), rate: e.rate };
      emit(f, { type: 'fx', name: 'melt-heat', all: true });
      emit(f, { type: 'msg', text: `${name}: ${e.sec}초 동안 보호막이 녹음` });
      return;
    }
    case 'all': {
      let dmg = e.phaseDmg?.[f.phase] ?? e.dmg;
      if (e.grow) { const n = (s.st.n as number | undefined) ?? 0; dmg += e.grow * n; s.st.n = n + 1; } // 커지는 광역 (수정 핵 과열)
      for (const u of living(f)) damage(f, u, dmg, true);
      if (e.debuff) for (const u of living(f)) applyDebuff(f, u, e.debuff); // 독안개 분출 · 그림자 파동 메아리
      return;
    }
    case 'debuff': {
      const d = e.debuff;
      const n = f.mythic && e.nMythic ? e.nMythic : e.n === 'all' ? Infinity : e.n;
      const free = (u: Unit) => !u.debuffs.some(x => x.name === d.name);
      const one = (u: Unit | null | undefined) => (u && u.alive && (free(u) || d.stackMax) ? [u] : []);
      const ts = e.pick === 'me' ? one(f.party.find(u => u.me)) : e.pick === 'tank' ? one(aggroTarget(f))
        : e.pick === 'tel' ? (tel?.units ?? []).map(id => unitById(f, id)).filter((u): u is Unit => !!u && u.alive && free(u)).slice(0, n)
        : e.pick === 'lowest' ? lowestTargets(f, n, u => free(u) && u.role !== 'tank')
        : e.pick === 'linked' ? linkedTargets(f, n, free)
        : e.pick === 'order' ? orderTargets(f, n, free)
        : e.prefer ? preferTargets(f, n, free, e.prefer)
        : randomTargets(f, n, e.pick === 'others' ? u => free(u) && u.role !== 'tank' && !u.me : free);
      for (const u of ts) applyDebuff(f, u, d);
      // 전염 (26 3-1) · 불안정한 마력 둘 (05 5-C): 두 대상이 붙어 서 있으면 걸리자마자 둘 다 터짐
      if (e.burstAdjacent && ts.length === 2 && hexDist(cellOf(f, ts[0]), cellOf(f, ts[1])) === 1) {
        emit(f, { type: 'msg', text: `${d.name} 대상이 붙어 있어 바로 터짐` });
        for (const u of ts) {
          const x = u.debuffs.find(y => y.name === d.name);
          if (!x) continue;
          u.debuffs = u.debuffs.filter(y => y !== x);
          if (d.end?.p === 'spread' || !d.end) spread(f, u); else onDebuffEnd(f, u, x, false);
        }
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
      if (tel?.ring) { padHit(f, tel.cells, e.pad!.dmg, e.pad!.empty); return; }
      for (const id of tel?.units ?? []) {
        const u = unitById(f, id);
        if (!u) continue;
        pull(f, u, e.sec, e.dmg);
        // 연잎 사슬 (48 4-2): 끌려온 사람과 보스를 맞는 탱커 (이미 묶였으면 부탱커)를 나눔형 사슬로
        const tk = [aggroTarget(f), offTank(f)].find(t => t && t !== u && !t.debuffs.some(d => d.link));
        if (e.link && u.pulled && tk) linkPair(f, u, tk, { kind: 'share', name: e.link.name, sec: e.sec, vuln: f.mythic ? e.link.vulnMythic : undefined });
        // 끌려온 칸에 받침: sec초 뒤 울림 (화면은 그 칸이 금빛)
        if (e.pad && u.pulled) {
          const cells = new Set([u.pulled.cell]);
          f.tels.push({ id: f.nextId++, skill: s, kind: 'aoe', start: f.t, impact: f.t + e.sec, units: [u.id], cells, safe: cells, ring: true });
        }
      }
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
        const c = pick[Math.floor(f.rng() * pick.length)];
        c.block = 'hole';
        emit(f, { type: 'fx', name: 'crumble', cell: c.i });
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
      f.order = { name, ids, i: 0, until: f.t + e.sec, wrong: e.wrong, miss: e.miss, daze: e.daze, wrongAll: f.mythic ? e.wrongAll : undefined };
      // 신기루 숫자 (54 4-1): 번호 없는 사람 하나에 ① 아닌 번호를 하나 더 (걷히기 전에 ①부터 시작할 수 있게)
      const fk = e.fake && ids.length > 1 ? randomTargets(f, 1, u => u.role !== 'tank' && !ids.includes(u.id))[0] : undefined;
      if (fk) f.order.fake = { id: fk.id, num: 1 + Math.floor(f.rng() * (ids.length - 1)), until: f.t + e.fake!.at };
      emit(f, { type: 'msg', text: `${name}: ${ORDER_NUM.slice(0, ids.length).split('').join(' → ')} 차례로 힐${fk ? ' (하나는 신기루 숫자)' : ''}` });
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
        emit(f, { type: 'fx', name: 'spawn', on: u.id });
        const hp = f.bossMax * e.hp * (1 - sv(f, 'chainBreaker')); // 사슬 끊는 손 (42 기믹 03)
        f.mobs.push({ id: f.nextId++, name: e.name, elite: false, hp, max: hp, alive: true,
          add: { short: e.short, art: e.art, on: u.id, dmg: 0, every: 0, next: Infinity, job: { p: 'jail' }, jobAt: Infinity, hold: d.id } });
      }
      if (got.length) emit(f, { type: 'msg', text: `${e.name}: ${got.map(u => u.nick).join(' · ')} 갇힘` });
      return;
    }
    case 'quake': quake(f, e); return;
    case 'rest': {
      // 숨 고르기 (35 4-4): 보스가 쉬는 동안 그 이름의 디버프가 모두 사라짐 (서리 중첩)
      f.daze = { until: f.t + e.sec, vuln: 1, name: s.name ?? '숨 고르기' };
      if (e.clear) clearNamed(f, e.clear);
      emit(f, { type: 'msg', text: `${f.daze.name}: 보스가 ${e.sec}초 쉼` });
      return;
    }
    case 'clear': clearNamed(f, e.name); return;
    case 'stagger': {
      // 무력화 (P-STAGGER, 35 4-5): 게이지 끝 = 조건을 채운 파티 전원이 need초 때린 양 (탱커는 tank배)
      if (f.stagger) return;
      const hp = f.mythic && e.hpMythic != null ? e.hpMythic : e.hp;
      const rate = f.party.reduce((a, u) => a + (u.alive && !u.me ? u.dps * (u.p.dps || 1) * (u.role === 'tank' ? e.tank : 1) : 0), 0);
      const name = s.name ?? '힘 모으기';
      f.stagger = { name, until: f.t + e.sec, fill: 0, need: rate * e.need, hp, tank: e.tank, win: e.win, fail: e.fail };
      emit(f, { type: 'msg', text: `${name}: ${e.sec}초 안에 체력 ${Math.round(hp * 100)}% 이상인 파티원 딜로 게이지를 채움` });
      return;
    }
    case 'counter':
      // 반격 틈 (P-COUNTER): 못 끊었으면 앞줄에 선 사람 모두 (all = 전원, 별똥비)
      for (const u of living(f)) if (e.all) damage(f, u, e.dmg, true); else if (zoneOf(f, cellOf(f, u).row) === 'front') damage(f, u, e.dmg, false);
      return;
    case 'tower': {
      // 받침 (P-TOWER): 발판 위 사람은 dmg, 빈 발판마다 전원 empty
      padHit(f, tel?.cells ?? new Set(), e.dmg, e.empty);
      for (const u of f.party) u.padUntil = undefined;
      return;
    }
    case 'cycle': {
      // 네 가지 청소약: 쓸 때마다 다음 디버프. each = 한 번에 n명이 하나씩 다른 디버프 (네 가지 메아리)
      if (e.random) { // 모자 뽑기 (48 5장): 탱커 · 나 아닌 사람마다 목록에서 무작위 하나
        const free = (x: Unit) => x.role !== 'tank' && !x.me && !e.debuffs.some(d => x.debuffs.some(y => y.name === d.name));
        for (const u of randomTargets(f, f.mythic && e.nMythic ? e.nMythic : e.n, free)) applyDebuff(f, u, e.debuffs[Math.floor(f.rng() * e.debuffs.length)]);
        return;
      }
      const k = (s.st.k as number | undefined) ?? 0;
      s.st.k = k + 1;
      if (e.each) {
        const ts = randomTargets(f, e.n, x => !e.debuffs.some(d => x.debuffs.some(y => y.name === d.name)));
        ts.forEach((u, i) => applyDebuff(f, u, e.debuffs[(k + i) % e.debuffs.length]));
        return;
      }
      const d = e.debuffs[k % e.debuffs.length];
      for (const u of randomTargets(f, e.n, x => !x.debuffs.some(y => y.name === d.name))) applyDebuff(f, u, d);
      return;
    }
    case 'soul': spawnSoul(f, e); return;
    case 'ring': spawnRing(f, s, e); return;
    case 'link': linkUp(f, e); return;
    case 'vessel':
      // 넘치는 빛 그릇형 (P-OVER): 끝 = 파티 최대 체력 합 × need
      if (f.vessel) return;
      f.vessel = { name: e.name, fill: 0, need: f.party.reduce((a, u) => a + u.max, 0) * e.need, until: f.t + e.sec, shield: e.shield };
      emit(f, { type: 'msg', text: `${e.name}: ${e.sec}초 안에 넘친 치유로 채우면 전원 보호막` });
      return;
    case 'share':
      // 집결 분담 (P-SOAK): 대상과 이웃 칸 아군이 나눠 받음. 혼자면 그대로
      for (const id of tel?.units ?? []) {
        const u = unitById(f, id);
        if (!u?.alive) continue;
        const at = f.cells[u.moving ? u.moving.to : u.cell];
        const group = [u, ...living(f).filter(v => v !== u && hexDist(f.cells[v.moving ? v.moving.to : v.cell], at) === 1)];
        emit(f, { type: 'fx', name: 'soak', cell: at.i });
        emit(f, { type: 'msg', text: `${s.name ?? '분담'}: ${group.length}명이 나눠 받음` });
        for (const v of group) damage(f, v, e.dmg / group.length, true);
      }
      return;
    case 'trade': {
      // 뒤바뀐 자매: 두 탱커의 중첩 디버프를 맞바꿈
      const [a, b] = living(f).filter(u => u.role === 'tank');
      if (!a || !b) return;
      const da = a.debuffs.filter(d => d.name === e.name), db = b.debuffs.filter(d => d.name === e.name);
      a.debuffs = a.debuffs.filter(d => !da.includes(d)).concat(db);
      b.debuffs = b.debuffs.filter(d => !db.includes(d)).concat(da);
      emit(f, { type: 'fx', name: 'swap', on: a.id, to: b.id });
      emit(f, { type: 'msg', text: `${s.name ?? '맞바꿈'}: ${e.name} 중첩이 상대 탱커에게` });
      const tk = aggroTarget(f), d = tk?.debuffs.find(x => x.name === e.name);
      if (tk && d?.swap && (d.stack ?? 1) >= d.swap) swapTank(f, tk);
      return;
    }
    case 'slow':
      // 깨진 시간 (05 5-E): 그동안 시작하는 내 시전이 느려짐
      f.slow = { until: f.t + e.sec, mult: e.mult };
      emit(f, { type: 'fx', name: 'slow', on: f.me.id });
      emit(f, { type: 'msg', text: `${s.name ?? '느려짐'}: ${e.sec}초 동안 시전 시간 ×${e.mult}` });
      return;
    case 'empower': empowerBoss(f, e.boost, s.name ?? '분노'); return;
    case 'strike':
      // 신기루 창 · 거울 책장 (54 4장): 예고 때 고른 사람에게
      for (const id of tel?.units ?? []) {
        const u = unitById(f, id);
        if (!u?.alive) continue;
        emit(f, { type: 'fx', name: 'slam', on: u.id });
        damage(f, u, e.dmg, false, 'party');
        if (e.debuff && u.alive) applyDebuff(f, u, e.debuff);
      }
      return;
    case 'glass': {
      // 모래시계 (P-GLASS, 54 5장): 지금 체력 비율을 적어 두고 sec초 뒤 되돌림. 창 안 기술은 then으로 엶
      const rec = new Map(f.party.filter(u => u.alive).map(u => [u.id, u.hp / u.max] as const)); // 떠 있는 사람도 적어 둠 (그림자 돌풍, 56 4-5)
      const name = s.name ?? '모래시계';
      f.glass.push({ name, at: f.t, until: f.t + e.sec, rec, absorbHit: e.absorbHit, lowHit: f.mythic ? e.lowHitMythic : undefined });
      for (const x of e.then ?? []) if (f.bs[x.skill]) f.bs[x.skill].next = f.t + x.in;
      emit(f, { type: 'sound', name: 'gauge' });
      emit(f, { type: 'fx', name: 'hourglass-flip' });
      emit(f, { type: 'msg', text: `${name}: ${e.sec}초 뒤 모두 지금 체력으로 돌아감` });
      return;
    }
    case 'lift': liftUp(f, s, e, tel); return;
    case 'chain':
      // 연쇄 번개 (P-CHAIN, 56 5장): 예고 때 고른 사람마다 번개가 떨어져 이웃으로 튐
      for (const id of tel?.units ?? []) {
        const u = unitById(f, id);
        if (u?.alive && !u.lift) chainFrom(f, u, e.dmg, f.mythic && e.jumpsMythic ? e.jumpsMythic : e.jumps, e.grow ?? CHAIN_GROW, s.name ?? '연쇄 번개');
      }
      return;
  }
}

// ---------- 묶음 F 새 부품 (56 5장): 띄워 올리기 · 연쇄 번개 ----------
/** 연쇄 번개가 튈 때마다 세지는 비율 */
export const CHAIN_GROW = 0.25;
/** 이 체력 비율 이상이거나 보호막 (흡수 막 · 넘치는 빛 보호막)이 있으면 피뢰침: 절반만 받고 번개가 멈춤 */
export const ROD_HP = 0.9;
export const isRod = (f: Fight, u: Unit): boolean => u.hp / u.max >= ROD_HP - 1e-9 || u.shield > 0 || hasAbsorb(f, u);

/**
 * 연쇄 번개 (P-CHAIN): u에게 dmg (마법), 그다음 아직 안 맞은 이웃 칸 아군 가운데 체력 비율이 가장 낮은 사람에게 튀며 +grow씩, jumps번까지.
 * 튈 곳이 피뢰침이면 절반만 받고 멈춤, 이웃이 없어도 멈춤. 내려오며 번개 (P-LIFT chain)도 여기로
 */
export function chainFrom(f: Fight, u: Unit, dmg: number, jumps: number, grow: number, name: string): void {
  const hit = new Set<number>([u.id]);
  let cur = u, x = dmg;
  emit(f, { type: 'fx', name: 'chain-strike', on: u.id });
  damage(f, u, x, true);
  for (let j = 0; j < jumps; j++) {
    const c = cellOf(f, cur);
    const v = living(f).filter(w => !hit.has(w.id) && hexDist(cellOf(f, w), c) === 1).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (!v) return;
    hit.add(v.id); x *= 1 + grow;
    emit(f, { type: 'fx', name: 'chain-bolt', on: cur.id, to: v.id });
    if (isRod(f, v)) {
      emit(f, { type: 'fx', name: 'chain-rod', on: v.id });
      emit(f, { type: 'msg', text: `${name}: ${v.nick}에게서 멈춤 (피뢰침)` });
      damage(f, v, x / 2, true);
      if (f.sp) specRod(f, v);
      return;
    }
    damage(f, v, x, true);
    cur = v;
  }
}

/** 연쇄 번개 예고: 번개 구름 아래 신중파는 이웃이 적은 칸으로 한 칸 비킴 (56 5장 성격) */
export function chainWarn(f: Fight, tel: Telegraph): void {
  for (const id of tel.units) {
    const u = unitById(f, id);
    if (u?.alive && !u.me && !u.lift && u.pers === '신중파' && !u.moving) stepAway(f, u, tel.impact - f.t);
  }
}

/** 띄워 올리기 예고: pre 디버프 (돌풍에 깃털이 먼저 붙음), 겁쟁이는 겁먹음 (말풍선) */
export function liftWarn(f: Fight, tel: Telegraph): void {
  for (const id of tel.units) {
    const u = unitById(f, id);
    if (!u?.alive || u.lift) continue;
    if (tel.skill.lift?.pre) applyDebuff(f, u, tel.skill.lift.pre);
    if (u.pers === '겁쟁이') bark(f, u, null, false, 'noEscape');
  }
}

/**
 * 띄워 올리기 (P-LIFT): 예고 때 고른 사람이 sec초 동안 하늘로. 걸던 힐은 멈춤 (마나 안 씀). land free · random이면 칸을 비우고,
 * 받침 위에서 떠오르면 (land가 없어도) 칸을 비워 빈 받침에 다른 사람이 대신 들어감 (받침 위 반송, 56 4-1)
 */
function liftUp(f: Fight, s: BossSkill, e: Extract<SkillEffect, { p: 'lift' }>, tel?: Telegraph): void {
  const fall = f.mythic && e.fallMythic != null ? e.fallMythic : e.fall;
  const us = (tel?.units ?? []).map(id => unitById(f, id)).filter((u): u is Unit => !!u && u.alive && !u.lift && !u.soul);
  if (!us.length) return;
  const name = s.name ?? '띄워 올리기';
  for (const u of us) {
    if (u.moving) finishMove(f, u);
    const pad = u.padUntil != null && u.padUntil > f.t ? u.padUntil : null;
    u.react = null; u.padUntil = undefined; u.homeAt = null;
    const land = e.land ?? (pad != null ? 'free' : undefined); // 받침 위에서 떠오르면 받침이 빔 (다른 사람이 대신 들어감)
    if (land) f.cells[u.cell].unit = null;
    const tk = u.role === 'tank' && e.tankFall != null;
    u.lift = { until: f.t + e.sec, fall: tk ? e.tankFall! : fall, aim: tk ? 'tank' : 'party', land,
      chain: e.chain ? { ...e.chain, grow: CHAIN_GROW, name } : undefined };
    if (f.cast?.uid === u.id) { f.cast = null; f.gcd = 0; } // 떠오른 사람에게 걸던 힐은 멈춤
    if (f.queued?.uid === u.id) f.queued = null;
    emit(f, { type: 'fx', name: 'lift-swirl', on: u.id });
    if (pad != null) padTake(f, f.cells[u.cell], new Set(living(f).filter(v => v.padUntil != null && v.padUntil > f.t)), pad);
  }
  emit(f, { type: 'sound', name: 'aoe' });
  emit(f, { type: 'msg', text: `${name}: ${us.map(u => u.nick).join(' · ')} 하늘로 (${e.sec}초 동안 힐이 안 닿음)` });
}

/** 띄워 올려진 사람이 내려옴: 제자리 (비웠으면 비어 있을 때, 아니면 가장 가까운 빈 칸) · 무작위 빈 칸 (기우는 섬: 장판 위일 수도, 그러면 그때 피함). 낙하 피해 → 내려오며 번개 */
export function land(f: Fight, u: Unit): void {
  const l = u.lift!;
  u.lift = null;
  if (l.land) {
    const own = f.cells[u.cell];
    const open = (c: Cell) => !c.block && (!c.unit || c.unit === u);
    const free = f.cells.filter(c => open(c) && !dangerAt(f, c.i));
    const any = free.length ? free : f.cells.filter(open);
    let to: Cell | undefined;
    if (l.land === 'random') {
      const all = f.cells.filter(open); // 바람에 밀려 아무 빈 칸 (기우는 섬의 낮은 쪽일 수도)
      to = all[Math.floor(f.rng() * all.length)];
    } else to = open(own) ? own : any.sort((a, b) => hexDist(a, own) - hexDist(b, own))[0];
    if (to) { to.unit = u; u.cell = to.i; }
    const tel = f.tels.find(t => t.cells.has(u.cell) && t.impact > f.t && !t.fake);
    if (tel) scheduleReaction(f, tel, u); // 장판 위에 내려앉으면 그제야 피함
  }
  emit(f, { type: 'fx', name: 'land-puff', on: u.id });
  if (f.sp) specLand(f, u);
  if (l.fall) damage(f, u, l.fall, false, l.aim);
  if (u.alive && l.chain) chainFrom(f, u, l.chain.dmg, l.chain.jumps, l.chain.grow, l.chain.name);
}

/** 매 틱 모래시계: 시간이 된 기록마다 살아 있는 사람의 체력을 그 비율로 (쓰러진 사람 · 그때 없던 사람은 그대로, 보호막 · 디버프는 안 건드림) */
export function glassTick(f: Fight): void {
  for (const g of f.glass.filter(x => f.t + 1e-9 >= x.until)) {
    f.glass = f.glass.filter(x => x !== g);
    emit(f, { type: 'sound', name: 'gauge' });
    emit(f, { type: 'msg', text: `${g.name}: 체력이 되돌아감` });
    for (const u of f.party.filter(x => x.alive)) { // 떠 있어도 되돌아감
      const r = g.rec.get(u.id);
      if (r == null) continue;
      u.hp = Math.max(1, Math.min(u.max, r * u.max));
      emit(f, { type: 'fx', name: 'sand-rewind', on: u.id });
    }
    if (g.absorbHit) for (const u of living(f)) if (u.debuffs.some(d => (d.absorbLeft ?? 0) > 0)) damage(f, u, g.absorbHit, true); // 악몽 둘둘이: 붕대가 남은 사람
    if (g.lowHit) for (const u of living(f)) if (u.hp / u.max < g.lowHit.below) damage(f, u, g.lowHit.dmg, true); // 악몽 째깍이: 낮은 채로 되돌아간 사람
    if (f.sp) specRewind(f);
  }
}

/** 신기루가 걷히는 시각 (맞기 reveal초 전) */
export const MIRAGE_REVEAL = 1;

/**
 * 가짜 반격 틈 (54 3-2): 틈 두 번 중 첫 번째에 어느 쪽이 신기루인지 정하고 다음 틈을 gap초 뒤로, 두 번째 틈 뒤에는 원래 주기로.
 * 이번 틈이 신기루면 true
 */
export function decoyOpen(f: Fight, s: BossSkill): boolean {
  const gap = s.decoy!.gap;
  if (!s.st.second) {
    s.st.second = true; s.st.fakeFirst = f.rng() < 0.5;
    s.next = f.t + gap;
    return s.st.fakeFirst;
  }
  s.st.second = false;
  s.next = f.t - gap + s.period;
  return !s.st.fakeFirst;
}
/**
 * 신기루 (P-MIRAGE, 54 5장): 진짜 예고 옆에 가짜 예고. 사람을 고르는 기술은 가짜 n명을 한 예고에 (탱커 기술이면 다른 탱커),
 * 장판은 가짜 칸 묶음 n개 (진짜와 가장 덜 겹치게). chance면 예고 자체가 그 확률로 가짜. 가짜 장판도 파티원이 비킴 (모름)
 */
export function mirageUp(f: Fight, tel: Telegraph): void {
  const m = tel.skill.mirage!;
  tel.veil = tel.impact - (m.reveal ?? MIRAGE_REVEAL);
  if (m.chance != null) { if (f.rng() < m.chance) tel.fake = true; return; }
  const n = f.mythic && m.nMythic ? m.nMythic : m.n ?? 1;
  if (tel.units.length) {
    const tanky = tel.units.every(id => unitById(f, id)?.role === 'tank');
    const pick = randomTargets(f, n, u => !tel.units.includes(u.id) && (tanky ? u.role === 'tank' : u.role !== 'tank' && !u.me));
    if (pick.length) f.tels.push({ ...tel, id: f.nextId++, units: pick.map(u => u.id), cells: new Set(), fake: true });
    return;
  }
  if (tel.safe && tel.skill.mirrorCells) {
    // 신기루 피난처 (54 4-3): 반대쪽 끝에 가짜 안전 칸 묶음. 파티원은 걷히기 전 둘 중 가까운 쪽으로 가고 (movement dangerAt), 걷히면 진짜로 다시 옮김 (mirageTick)
    const cells = tel.skill.mirrorCells(f);
    f.tels.push({ ...tel, id: f.nextId++, units: [], cells, safe: new Set(f.cells.filter(c => !c.block && !cells.has(c.i)).map(c => c.i)), fake: true });
    return;
  }
  if (!tel.cells.size || !tel.skill.cellsFor) return;
  const seen = new Set(tel.cells);
  for (let i = 0; i < n; i++) {
    let best: Set<number> | null = null, over = Infinity;
    for (let k = 0; k < 6 && over > 0; k++) {
      const c = tel.skill.cellsFor(f), o = [...c].filter(x => seen.has(x)).length;
      if (c.size && o < over) { best = c; over = o; }
    }
    if (!best) continue;
    best.forEach(x => seen.add(x));
    const fk: Telegraph = { ...tel, id: f.nextId++, units: [], cells: best, fake: true };
    if (tel.safe) fk.safe = new Set(f.cells.filter(c => !c.block && !best!.has(c.i)).map(c => c.i));
    f.tels.push(fk);
    if (fk.kind === 'zone' && !tel.skill.fixed) scheduleReactions(f, fk);
  }
}

/** 매 틱 신기루: 걷힐 때가 된 가짜 예고를 지움 (일렁이며 흩어짐). 진짜는 그대로 */
export function mirageTick(f: Fight): void {
  const gone = f.tels.filter(t => t.fake && f.t + 1e-9 >= t.veil!);
  if (!gone.length) return;
  f.tels = f.tels.filter(t => !gone.includes(t));
  for (const t of gone) {
    if (t.units.length) for (const id of t.units) emit(f, { type: 'fx', name: 'mirage-shimmer', on: id });
    else if (t.kind === 'aoe' || !t.cells.size) emit(f, { type: 'fx', name: 'mirage-shimmer', all: true });
    else for (const i of t.skill.safe && t.safe ? t.safe : t.cells) emit(f, { type: 'fx', name: 'mirage-shimmer', cell: i }); // 피난처는 가짜 안전 칸이 일렁임
    emit(f, { type: 'msg', text: `${t.skill.name ?? '예고'}: ${t.kind === 'aoe' ? '신기루였음' : t.skill.safe ? '가짜 안전 칸이 걷힘' : '신기루가 걷힘'}` });
    if (t.skill.safe) { const real = f.tels.find(o => o.skill === t.skill && !o.fake && o.veil === t.veil); if (real) scheduleReactions(f, real); } // 가짜 안전 칸에 선 사람이 진짜로 옮김
  }
  if (f.sp) specReveal(f);
}

/**
 * 탱커 교대 (P-SWAP): 지금 보스를 맞는 탱커(from)에게서 다른 살아 있는 탱커가 보스를 가져감.
 * 탱커가 하나뿐이고 sub가 있으면 (5인 달군 쇠) 근접 딜러 (없으면 원거리)가 sub초 대신 맞고 탱커의 그 디버프가 풀림
 */
function swapTank(f: Fight, from: Unit, d?: Debuff, sub?: number): void {
  if (aggroTarget(f) !== from) return;
  const to = living(f).find(u => u.role === 'tank' && u !== from);
  if (to) {
    f.hold = to.id;
    emit(f, { type: 'fx', name: 'swap', on: from.id, to: to.id });
    emit(f, { type: 'msg', text: `탱커 교대: ${to.nick}이(가) 보스를 받음` });
    return;
  }
  if (!sub || !d || from.role !== 'tank') return;
  const st = living(f).find(u => u.role === 'melee' && !u.me) ?? living(f).find(u => u.role === 'ranged' && !u.me);
  if (!st) return;
  f.sub = { id: st.id, until: f.t + sub };
  from.debuffs = from.debuffs.filter(x => x !== d);
  emit(f, { type: 'cure', id: from.id, name: d.name });
  emit(f, { type: 'fx', name: 'swap', on: from.id, to: st.id });
  emit(f, { type: 'msg', text: `${d.name} 가득: ${st.nick}이(가) ${sub}초 보스를 대신 받음` });
}

/** 모이러 안 가는 성격 (외톨이 · 겁쟁이) · 먼저 가는 성격 (사교형) */
const SOAK_SKIP: PersName[] = ['외톨이', '겁쟁이'];
const SOAK_EAGER: PersName[] = ['사교형'];
/** 집결 분담 예고: 대상마다 가까운 파티원 (탱커 · 나 · 다른 대상 빼고) 최대 3명이 대상 옆 빈 칸으로 가서 맞을 때까지 머묾 */
export function soakGo(f: Fight, tel: Telegraph): void {
  const used = new Set<Unit>(tel.units.map(id => unitById(f, id)).filter((u): u is Unit => !!u));
  for (const id of tel.units) {
    const t = unitById(f, id);
    if (!t?.alive) continue;
    const at = f.cells[t.moving ? t.moving.to : t.cell];
    const ok = living(f).filter(u => u.role !== 'tank' && !u.me && !used.has(u) && !(u.pers && SOAK_SKIP.includes(u.pers)) && !u.moving && !u.pulled && !u.fleeing
      && !u.debuffs.some(d => d.noMove) && hexDist(cellOf(f, u), at) <= 3);
    const eager = (u: Unit) => (u.pers && SOAK_EAGER.includes(u.pers) ? 0 : 1);
    ok.sort((a, b) => eager(a) - eager(b) || hexDist(cellOf(f, a), at) - hexDist(cellOf(f, b), at));
    for (const u of ok.slice(0, 3)) {
      used.add(u);
      if (hexDist(cellOf(f, u), at) === 1) { u.padUntil = tel.impact + 0.2; continue; } // 이미 옆
      const c = f.cells.filter(x => !x.unit && !x.block && hexDist(x, at) === 1).sort((a, b) => hexDist(a, cellOf(f, u)) - hexDist(b, cellOf(f, u)))[0];
      if (!c) break;
      moveTo(f, u, c);
      u.padUntil = tel.impact + 0.2; u.homeAt = null;
    }
  }
}

/** 요정 고리 (P-GROW, 48 5장): 탱커 · 나 아닌 n명이 선 칸 (옮겨 가는 중이면 가는 칸)에 고리 장판. 자라는 일은 core.ts heal (ringFeed) */
function spawnRing(f: Fight, s: BossSkill, e: Extract<SkillEffect, { p: 'ring' }>): void {
  const ringed = (u: Unit) => f.zones.some(z => z.ring && z.cells.has(u.moving ? u.moving.to : u.cell));
  const ts = randomTargets(f, f.mythic && e.nMythic ? e.nMythic : e.n, u => u.role !== 'tank' && !u.me && !ringed(u));
  const name = s.name ?? '요정 고리', max = f.mythic && e.maxMythic != null ? e.maxMythic : e.max;
  for (const u of ts) {
    const c = u.moving ? u.moving.to : u.cell;
    f.zones.push({ id: f.nextId++, cells: new Set([c]), end: f.t + e.sec, dps: e.dps, ring: { center: c, n: 0, max, every: e.every, at: -Infinity, name } });
    emit(f, { type: 'fx', name: 'ring-grow', cell: c });
  }
  if (ts.length) emit(f, { type: 'msg', text: `${name}: ${ts.map(u => u.nick).join(' · ')} 발밑에 고리. 안에서 치유를 받으면 자람` });
}

/** 헤매는 영혼 (P-SOUL): 빈 칸 하나에 영혼 칸. 파티원이 아니라 Fight.souls에만 있고, 칸 탭으로 단일 힐을 받음. 빈 칸은 1개 이상 남김 */
function spawnSoul(f: Fight, e: Extract<SkillEffect, { p: 'soul' }>): void {
  for (let i = 0; i < (e.n ?? 1); i++) spawnOneSoul(f, e); // 문에 박힌 조각 셋 (51 4-3)
}
function spawnOneSoul(f: Fight, e: Extract<SkillEffect, { p: 'soul' }>): void {
  const free = f.cells.filter(c => !c.unit && !c.block);
  if (free.length <= 1) return;
  const c = free[Math.floor(f.rng() * free.length)];
  const ref = f.party.filter(u => u.role !== 'tank' && !u.me);
  const max = (ref.length ? ref.reduce((a, u) => a + u.base, 0) / ref.length : f.me.base) * ((f.mythic && e.sizeMythic) || e.size || 1);
  const u: Unit = {
    id: f.nextId++, role: 'ranged', cls: null, aim: 0, flow: 0, traits: [], bulwark: 0, bulwarkUsed: false, acc: 0, dealt: 0, pers: null, p: {}, nick: e.short,
    base: max, max, hp: max * (f.mythic && e.hpMythic ? e.hpMythic : e.hp), dps: 0, alive: true, cell: c.i, home: c.i, hot: 0, hotTick: 0, hots: [], redu: 0, reduCut: 0, sacr: 0, immune: 0, echo: [],
    guardian: 0, shield: 0, debuffs: [], moving: null, react: null, retryAt: 0, mistakeUntil: 0, wrongUntil: 0, fleeing: false, sulking: false, lastHeal: 0,
    thanks: 0, flash: 0, barkAt: 0, ignoreZone: 0, homeAt: null, diedAt: 0, me: false, ab: null, mods: [], got: 0, senseReact: 1, senseDodge: 0, runs: 0,
    soul: { name: e.name, short: e.short, until: f.t + e.sec, total: e.sec, win: e.win, fail: e.fail, art: e.art },
  };
  if (e.type) u.debuffs.push({ id: f.nextId++, name: e.name, type: e.type, left: e.sec }); // 이 유형을 지우는 해제가 바로 성공
  c.block = 'soul';
  f.souls.push(u);
  emit(f, { type: 'fx', name: 'spawn', cell: c.i });
  emit(f, { type: 'msg', text: `${e.name} 등장: ${e.sec}초 안에 가득 채우기` });
}

/** 매 틱 헤매는 영혼: 지속 힐, 가득 차거나 해제로 지우면 축복, 시간이 다 되면 벌 */
export function soulsTick(f: Fight): void {
  for (const u of f.souls.slice()) {
    if (u.hot > 0) { u.hot -= DT; u.hotTick += DT; if (u.hotTick >= 3 - 1e-9) { u.hotTick -= 3; heal(f, u, 80, false); } }
    if (u.hots.length) hotTick(f, u, DT);
    for (const x of u.echo) { heal(f, u, x.rate * DT, false); x.left -= DT; }
    u.echo = u.echo.filter(x => x.left > 0);
    if (u.soul!.cleansed || u.hp >= u.max - 1e-6) soulEnd(f, u, true);
    else if (f.t + 1e-9 >= u.soul!.until) soulEnd(f, u, false);
  }
}

function soulEnd(f: Fight, u: Unit, ok: boolean): void {
  const s = u.soul!, at = f.cells[u.cell];
  f.souls = f.souls.filter(x => x !== u);
  u.alive = false;
  if (at.block === 'soul') at.block = undefined;
  if (f.cast?.uid === u.id) { f.cast = null; f.gcd = 0; } // 영혼에 걸던 시전은 그냥 멈춤 (마나는 안 씀)
  if (f.queued?.uid === u.id) f.queued = null;
  if (ok) {
    const w = s.win;
    emit(f, { type: 'sound', name: 'gauge' });
    emit(f, { type: 'fx', name: 'soul-purify', cell: at.i });
    emit(f, { type: 'msg', text: `${s.name} 채움: ${w.text}` });
    if (w.cure) for (const v of living(f)) {
      const d = v.debuffs.find(x => x.type === w.cure && !x.lock && !x.trap);
      if (!d) continue;
      v.debuffs = v.debuffs.filter(x => x !== d);
      if (d.maxCut) setMax(v);
      emit(f, { type: 'cure', id: v.id, name: d.name });
    }
    if (w.heal) f.bless = { heal: 1 + w.heal.pct, until: f.t + w.heal.sec };
    if (w.weak) {
      if (f.weak) f.dmgMult /= 1 - f.weak.cut;
      f.dmgMult *= 1 - w.weak.pct;
      f.weak = { cut: w.weak.pct, until: f.t + w.weak.sec };
    }
    if (w.vuln) f.expose = { vuln: 1 + w.vuln.pct, until: f.t + w.vuln.sec };
    if (w.fx) emit(f, { type: 'fx', name: w.fx, all: true });
    return;
  }
  emit(f, { type: 'sound', name: 'aoe' });
  emit(f, { type: 'fx', name: 'splash', cell: at.i });
  emit(f, { type: 'msg', text: `${s.name} 놓침: ${s.fail.text}` });
  const hit = s.fail.near ? living(f).filter(v => hexDist(cellOf(f, v), at) === 1) : living(f);
  for (const v of hit) { damage(f, v, s.fail.dmg, true); if (s.fail.debuff && v.alive) applyDebuff(f, v, s.fail.debuff); }
  if (s.fail.fx) emit(f, { type: 'fx', name: s.fail.fx, all: true }); // 성소 문이 한 칸 열림 (52 E)
  if (s.fail.boost) empowerBoss(f, s.fail.boost, `${s.name} 놓침`); // 악몽 오르말: 조각을 잃을 때마다 +5% (51 4-3)
}

/** 매 틱 넘치는 빛 그릇: 가득 차면 전원 보호막, 시간이 다 되면 그냥 사라짐 */
export function vesselTick(f: Fight): void {
  const v = f.vessel!;
  if (v.fill >= v.need - 1e-9) {
    f.vessel = null;
    for (const u of living(f)) u.shield = Math.max(u.shield, v.shield);
    if (f.sp) specVessel(f);
    emit(f, { type: 'sound', name: 'gauge' });
    emit(f, { type: 'fx', name: 'bubble', all: true });
    emit(f, { type: 'msg', text: `${v.name} 가득: 전원 보호막 ${v.shield}초` });
  } else if (f.t + 1e-9 >= v.until) {
    f.vessel = null;
    emit(f, { type: 'msg', text: `${v.name} 사라짐` });
  }
}

/** 영혼 축복이 끝나면 되돌림 (받는 치유 · 보스 피해 감소) */
export function boonTick(f: Fight): void {
  if (f.bless && f.t + 1e-9 >= f.bless.until) f.bless = null;
  if (f.weak && f.t + 1e-9 >= f.weak.until) { f.dmgMult /= 1 - f.weak.cut; f.weak = null; }
  if (f.expose && f.t + 1e-9 >= f.expose.until) f.expose = null;
}

/** 생명 사슬이 걸린 뒤 이만큼은 안 끊어짐 (차이를 맞출 틈) */
const LINK_GRACE = 2;

/** 생명 사슬 (P-LINK): 두 사람에게 해제 안 되는 사슬 표시 디버프 + Fight.links. 주문 반사로 한쪽이라도 안 걸리면 사슬도 없음 */
function linkUp(f: Fight, e: Extract<SkillEffect, { p: 'link' }>): void {
  const free = (u: Unit) => !u.debuffs.some(d => d.link);
  const pairs = (f.mythic && e.pairsMythic) || e.pairs || 1; // 20인 물그림자 사슬 3쌍 (51 4-3)
  for (let i = 0; i < pairs; i++) {
    const tanks = randomTargets(f, 2, u => u.role === 'tank' && free(u));
    const two = e.pick === 'tanks' && tanks.length === 2 ? tanks : randomTargets(f, 2, u => u.role !== 'tank' && free(u));
    if (two.length < 2) return;
    linkPair(f, two[0], two[1], e);
  }
}

/** 두 사람을 사슬로 이음. vuln = 사슬 표시 디버프에 받는 피해 +비율 (연잎 사슬 악몽) */
function linkPair(f: Fight, a: Unit, b: Unit, e: { kind: 'balance' | 'share'; name: string; sec: number; gap?: number; dmg?: number; aim?: 'tank' | 'party'; vuln?: number }): void {
  if ([a, b].some(u => u.debuffs.some(d => d.link))) return;
  const mark = { name: e.name, type: '마법', left: e.sec, lock: true, ...(e.vuln ? { vuln: e.vuln } : {}) };
  const da = applyDebuff(f, a, mark);
  const db = applyDebuff(f, b, mark);
  if (!da || !db) { a.debuffs = a.debuffs.filter(d => d !== da); b.debuffs = b.debuffs.filter(d => d !== db); return; }
  da.link = { to: b.id, kind: e.kind }; db.link = { to: a.id, kind: e.kind };
  f.links.push({ name: e.name, kind: e.kind, a: a.id, b: b.id, at: f.t, until: f.t + e.sec, gap: e.gap ?? 0.3, dmg: e.dmg ?? 0, aim: e.aim ?? 'party' });
  emit(f, { type: 'msg', text: `${e.name}: ${a.nick} · ${b.nick} 이어짐` });
}

/**
 * 매 틱 생명 사슬: 한쪽이 쓰러지거나 시간이 다 되면 풀림. 균형형은 두 사람 체력 비율 차이가 gap을 넘으면 끊어지며 둘 다 피해.
 * 모래시계 (P-GLASS) 창 안에서는 균형형이 안 끊기고 되돌린 뒤 다시 잼 (54 4-2 솔솔 · 살살: 뒤집기 전에 짝을 맞춰 두면 창 안에서 벌어져도 괜찮음)
 */
export function linksTick(f: Fight): void {
  for (const l of f.links.slice()) {
    const a = unitById(f, l.a), b = unitById(f, l.b);
    const done = !a?.alive || !b?.alive || f.t + 1e-9 >= l.until;
    const snap = !done && l.kind === 'balance' && !f.glass.length && f.t + 1e-9 >= l.at + LINK_GRACE && Math.abs(a!.hp / a!.max - b!.hp / b!.max) > l.gap + 1e-9;
    if (!done && !snap) continue;
    f.links = f.links.filter(x => x !== l);
    for (const u of [a, b]) if (u) u.debuffs = u.debuffs.filter(d => !(d.link && (d.link.to === l.a || d.link.to === l.b)));
    if (!snap) continue;
    emit(f, { type: 'sound', name: 'aoe' });
    emit(f, { type: 'fx', name: 'link-snap', on: l.a, to: l.b });
    emit(f, { type: 'msg', text: `${l.name} 끊어짐: ${a!.nick} · ${b!.nick} 피해` });
    damage(f, a!, l.dmg, true, l.aim);
    damage(f, b!, l.dmg, true, l.aim);
  }
}

/** 매 틱 무력화: 게이지를 채우면 무방비, 시간이 다 되면 땅 울림 (전원 피해 + 시전 스킬 잠김) */
export function staggerTick(f: Fight): void {
  const g = f.stagger!;
  if (g.fill >= g.need - 1e-9) {
    f.stagger = null;
    f.daze = { until: f.t + g.win.sec, vuln: g.win.vuln, name: '무방비' };
    emit(f, { type: 'sound', name: 'gauge' });
    emit(f, { type: 'fx', name: 'chain-break' });
    emit(f, { type: 'msg', text: `${g.name} 막음: 보스 ${g.win.sec}초 무방비 (받는 피해 +${Math.round((g.win.vuln - 1) * 100)}%)` });
    return;
  }
  if (f.t + 1e-9 < g.until) return;
  f.stagger = null;
  emit(f, { type: 'sound', name: 'aoe' });
  emit(f, { type: 'fx', name: 'shockwave', all: true });
  emit(f, { type: 'msg', text: `${g.name} 못 막음: 땅 울림, 시전 ${g.fail.lock}초 못 함` });
  for (const u of living(f)) damage(f, u, g.fail.dmg, false);
  const casts = Object.values(HEROES[f.hero].slots).filter((k): k is SkillKey => !!k && (f.R.cast?.[k] ?? SKILLS[k].cast) > 0);
  if (f.cast && casts.includes(f.cast.key)) { f.cast = null; if (f.sp) specBroken(f); } // 눈꽃 결정 (42 3장)
  for (const k of casts) f.lock[k] = { left: g.fail.lock, total: g.fail.lock };
}

/** 보스 기절 (반격 성공): 그동안 기술을 쉼 */
export function stunBoss(f: Fight, sec: number): void {
  f.daze = { until: f.t + sec, vuln: 1, name: '기절' };
  emit(f, { type: 'sound', name: 'gauge' });
  emit(f, { type: 'fx', name: 'dizzy' });
  emit(f, { type: 'msg', text: `반격 성공: 보스 ${sec}초 기절` });
}

/** 받침이 울림: 발판마다 위에 선 사람 (옮겨 가는 중이면 가는 칸) dmg, 비어 있으면 전원 empty (마법) */
function padHit(f: Fight, cells: Set<number>, dmg: number, empty: number): void {
  for (const i of cells) {
    const on = living(f).find(u => (u.moving ? u.moving.to : u.cell) === i);
    if (on) damage(f, on, dmg, true);
    else { emit(f, { type: 'msg', text: '빈 발판: 전원 피해' }); for (const u of living(f)) damage(f, u, empty, true); }
  }
}

/** 받침 발판: 빈 칸 n개 (빈 칸이 n개 이하면 그만큼 덜) */
export function padCells(f: Fight, n: number): Set<number> {
  const free = randomOrder(f, f.cells.filter(c => !c.unit && !c.block));
  return new Set(free.slice(0, Math.min(n, Math.max(0, free.length - 1))).map(c => c.i));
}

/** 발판에 먼저 가는 성격 (영웅 같은 사람). 겁쟁이는 안 감 (35 4-5) */
const PAD_EAGER: PersName[] = ['허세꾼', '관심종자', '신중파'];
/** 받침 예고: 발판마다 갈 수 있는 파티원 중 먼저 가는 성격 → 가까운 사람이 들어가 맞을 때까지 머묾 */
export function padsGo(f: Fight, tel: Telegraph): void {
  const used = new Set<Unit>();
  for (const i of tel.cells) if (!padTake(f, f.cells[i], used, tel.impact + 0.2)) break;
}

/** 발판 하나에 들어갈 사람: 먼저 가는 성격 → 가까운 사람 (used · 탱커 · 나 · 겁쟁이 빼고). 아무도 없으면 false */
function padTake(f: Fight, c: Cell, used: Set<Unit>, until: number): boolean {
  if (c.unit) return true; // 이미 누가 서 있거나 오는 중
  const ok = living(f).filter(u => u.role !== 'tank' && !u.me && u.pers !== '겁쟁이' && !u.moving && !u.pulled && !u.fleeing && !used.has(u)
    && !u.debuffs.some(d => d.noMove));
  if (!ok.length) return false;
  const eager = (u: Unit) => (u.pers && PAD_EAGER.includes(u.pers) ? 0 : 1);
  ok.sort((a, b) => eager(a) - eager(b) || hexDist(cellOf(f, a), c) - hexDist(cellOf(f, b), c));
  const u = ok[0];
  used.add(u);
  moveTo(f, u, c);
  u.padUntil = until; u.homeAt = null;
  return true;
}

function randomOrder<T>(f: Fight, xs: T[]): T[] {
  const c = xs.slice();
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(f.rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

/** 진동 (P-QUAKE): 시전 중인 힐이나 채널(찬가)이 끊기고 그 스킬이 잠김. 그다음 전원 피해 */
function quake(f: Fight, e: Extract<SkillEffect, { p: 'quake' }>): void {
  let key: SkillKey | null = null;
  if (f.cast) { key = f.cast.key; f.cast = null; }
  else if (f.channel > 0) { key = HEROES[f.hero].slots.raid ?? null; f.channel = 0; f.stats.hymnBroken++; }
  if (key) {
    f.lock[key] = { left: e.lock, total: e.lock };
    emit(f, { type: 'shake', id: f.me.id });
    emit(f, { type: 'msg', text: `진동: ${SKILLS[key].name} 끊김, ${e.lock}초 잠김` });
    if (f.sp) specBroken(f); // 눈꽃 결정 (42 3장)
  }
  emit(f, { type: 'fx', name: 'shockwave', all: true });
  for (const u of living(f)) damage(f, u, e.dmg, true);
  quakeJump(f);
  if (f.sp) specQuake(f); // 낙타 털실 반지 (54 6장)
}

/** 진동에 옮겨붙는 디버프 (메아리, P-JUMP on quake): 이웃 칸 아군 1명 (악몽 nMythic명)에게 남은 시간 그대로 · 초당 피해 × mult. 이웃이 없으면 사라짐 */
function quakeJump(f: Fight): void {
  const moves: [Unit, Debuff][] = [];
  for (const u of living(f)) for (const d of u.debuffs) if (d.end?.p === 'jump' && d.end.on === 'quake') moves.push([u, d]);
  for (const [u, d] of moves) {
    const e = d.end as Extract<DebuffEnd, { p: 'jump' }>;
    u.debuffs = u.debuffs.filter(x => x !== d);
    const c = cellOf(f, u);
    const near = randomOrder(f, living(f).filter(v => v !== u && hexDist(cellOf(f, v), c) === 1 && !v.debuffs.some(x => x.name === d.name)));
    const to = near.slice(0, f.mythic && e.nMythic ? e.nMythic : 1);
    if (!to.length) { emit(f, { type: 'msg', text: `${d.name}: 옆에 아무도 없어 사라짐` }); continue; }
    const { id: _id, ...rest } = d;
    for (const v of to) {
      addDebuff(f, v, { ...rest, dot: (d.dot ?? 0) * e.mult });
      emit(f, { type: 'fx', name: 'fireball-green', on: u.id, to: v.id });
    }
    emit(f, { type: 'msg', text: `${d.name}이(가) ${to.map(v => v.nick).join(' · ')}에게 옮겨붙음` });
  }
}

/** 주시 (P-AGGRO) 시작: 파티 최대 체력 합 × cap이 게이지 끝. 도발 능력이 있는 파티원이 있으면 노리는 시간이 짧음 */
export function watchInit(f: Fight, w: NonNullable<BossDef['watch']>): void {
  const taunt = f.abOn && f.party.some(u => u.ab && ABILITIES[u.ab.key]?.fx.e === 'taunt');
  f.watch = { fill: 0, max: f.party.reduce((a, u) => a + u.max, 0) * w.cap, rate: f.mythic ? w.mythicRate ?? 1 : 1, until: 0, next: 0,
    sec: taunt && w.tauntSec != null ? w.tauntSec : w.sec, every: w.every, dmg: w.dmg };
}

/** 매 틱 주시: 게이지가 차면 sec초 동안 보스가 every초마다 나를 때림 (보스가 쉬는 동안은 안 때림). 끝나면 0부터 다시 참 */
export function watchTick(f: Fight): void {
  const w = f.watch!;
  if (f.t < w.until - 1e-9) {
    if (f.t + 1e-9 >= w.next) { w.next += w.every; if (!f.daze) { damage(f, f.me, w.dmg, false); emit(f, { type: 'shake', id: f.me.id }); } }
    return;
  }
  if (w.fill < w.max) return;
  w.fill = 0; w.until = f.t + w.sec; w.next = f.t;
  emit(f, { type: 'sound', name: 'buster' });
  emit(f, { type: 'fx', name: 'warn', on: f.me.id });
  emit(f, { type: 'msg', text: `주시: 보스가 ${w.sec}초 동안 나를 노림` });
}

/** 매혹 (P-CHARM): 체력이 free 아래면 풀림, 아니면 every초마다 이웃 칸 아군을 때림. 풀렸으면 true */
export function charmTick(f: Fight, u: Unit, d: Debuff): boolean {
  const c = d.charm!;
  if (u.hp < u.max * c.free) {
    u.debuffs = u.debuffs.filter(x => x !== d);
    emit(f, { type: 'cure', id: u.id, name: d.name });
    emit(f, { type: 'msg', text: `${u.nick} 정신이 돌아옴` });
    return true;
  }
  if (d.charmAt == null) d.charmAt = f.t + c.every;
  if (f.t + 1e-9 < d.charmAt) return false;
  d.charmAt += c.every;
  const at = cellOf(f, u);
  const near = living(f).filter(v => v !== u && hexDist(cellOf(f, v), at) === 1);
  for (const v of near) damage(f, v, c.dmg, false);
  if (near.length) emit(f, { type: 'shake', id: u.id });
  return false;
}

/** 차례 번호표 */
export const ORDER_NUM = '①②③④⑤⑥';

/** 차례 중 단일 대상 힐 (healer.ts가 스킬을 쓸 때): 다음 번호면 하나 넘어가고, 앞 번호를 건너뛰면 그 사람 피해 + 처음부터 */
export function orderHeal(f: Fight, u: Unit): void {
  const o = f.order!;
  const k = o.ids.indexOf(u.id);
  const fake = !!o.fake && o.fake.id === u.id && f.t < o.fake.until; // 걷히기 전 신기루 숫자 (54 4-1)
  if (k < o.i && !fake) return; // 번호 없는 사람 · 이미 받은 사람
  if (k === o.i) { o.i++; if (o.i >= o.ids.length) orderDone(f, true); return; }
  if (f.cfg.diff !== '쉬움') damage(f, u, o.wrong, true); // 쉬움은 피해 없이 처음부터
  if (o.wrongAll) for (const v of living(f)) damage(f, v, o.wrongAll, true); // 악몽 냥크스: 틀리면 모두
  o.i = 0;
  emit(f, { type: 'msg', text: `${o.name}: ${fake ? '신기루 숫자였음, 처음부터' : '순서가 틀려 처음부터'}` });
}

/** 매 틱 차례: 쓰러진 번호는 건너뜀, 시간이 다 되면 아직 못 받은 사람마다 피해 */
export function orderTick(f: Fight): void {
  const o = f.order!;
  if (o.fake && f.t + 1e-9 >= o.fake.until) { emit(f, { type: 'fx', name: 'mirage-shimmer', on: o.fake.id }); emit(f, { type: 'msg', text: `${o.name}: 신기루 숫자가 걷힘` }); o.fake = undefined; if (f.sp) specReveal(f); }
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
  f.daze = { until: f.t + o.daze.sec + sv(f, 'numberSense'), vuln: o.daze.vuln }; // 숫자 감각 (42 기믹 02)
  emit(f, { type: 'sound', name: 'gauge' });
  emit(f, { type: 'fx', name: 'dizzy' });
  emit(f, { type: 'msg', text: `${o.name} 성공: 보스 ${o.daze.sec}초 멍함 (받는 피해 +${Math.round((o.daze.vuln - 1) * 100)}%)` });
}

/** 그 이름의 디버프를 모두에게서 지움 (숨 고르기 서리 · 천장 무너짐 뒤 먼지 범벅) */
function clearNamed(f: Fight, name: string): void {
  for (const u of living(f)) {
    const ds = u.debuffs.filter(d => d.name === name);
    if (!ds.length) continue;
    u.debuffs = u.debuffs.filter(d => !ds.includes(d));
    if (ds.some(d => d.maxCut)) setMax(u);
    emit(f, { type: 'cure', id: u.id, name });
  }
}

/** 디버프 걸기: 중첩 디버프(stackMax)는 이미 있으면 1중첩 더함, 최대 체력 깎는 디버프(maxCut)는 바로 반영 */
export function applyDebuff(f: Fight, u: Unit, def: DebuffDef): Debuff | null {
  if (u.lift) return null; // 띄워 올려진 사람에게는 보스 기술이 안 닿음 (P-LIFT)
  if (f.sp && immune(f, u, def.name)) return null; // 면역 향 (42 해제 04)
  if (def.stackMax) {
    const old = u.debuffs.find(x => x.name === def.name);
    if (old) {
      old.stack = Math.min(def.stackMax, (old.stack ?? 1) + 1); old.left = def.left;
      if (def.swap && old.stack >= def.swap) swapTank(f, u, old, def.sub); // 탱커 교대 (P-SWAP)
      return old;
    }
  }
  const d = addDebuff(f, u, { ...def, stack: def.stackMax || def.swell ? 1 : def.count ? 0 : undefined });
  if (!u.debuffs.includes(d)) return null; // 주문 반사 등으로 안 걸림
  if (d.maxCut) setMax(u);
  if (d.untilBossLoss != null) d.bossAt = f.bossHp;
  if (d.absorb) { d.absorbLeft = d.absorb * f.dmgMult; emit(f, { type: 'fx', name: 'absorb', on: u.id }); } // 치유 흡수 막 (P-ABSORB)
  if (d.cap != null) emit(f, { type: 'fx', name: 'ink-splat', on: u.id }); // 치유 상한 (P-CAP, 그림 47 E)
  if (def.fx) emit(f, { type: 'fx', name: def.fx, on: u.id }); // 모자 · 춤바람 · 벌침 (그림 49 E)
  if (def.drop) damage(f, u, def.drop, true); // 걸릴 때 한 번 (춤바람 · 완치 모자: 가득 찬 사람도 바로 안 풀림)
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

/** 보물 욕심 (P-GREED, 51 5장): 체력 비율이 가장 높은 탱커 · 나 아닌 n명. 1%p 안이면 같은 것으로 보고 무작위 (가득 찬 사람이 여럿이면 누가 맞을지 모름) */
export function greedTargets(f: Fight, n: number): Unit[] {
  const r = (u: Unit) => Math.round((u.hp / u.max) * 100);
  return randomTargets(f, 99, u => u.role !== 'tank' && !u.me).sort((a, b) => r(b) - r(a)).slice(0, n);
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
  emit(f, { type: 'fx', name: 'hook', on: u.id });
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
function spawnAdd(f: Fight, a: AddDef, at?: Cell): void {
  const j = a.job;
  const prey = j?.p === 'fixate' ? fixateTarget(f) : undefined;
  if (j?.p === 'fixate' && !prey) return;
  const c = at ?? (prey && j?.p === 'fixate' ? cellNear(f, prey, j.from ?? 3) : addCell(f, a.at ?? (a.dmg > 0 ? 'front' : j?.p === 'march' ? 'back' : 'random')));
  if (!c) return;
  const m: Mob = { id: f.nextId++, name: a.name, elite: false, hp: f.bossMax * a.hp, max: f.bossMax * a.hp, alive: true,
    add: { short: a.short, on: prey?.id ?? 0, dmg: a.dmg, every: a.every, next: f.t + a.every, down: a.down, cell: c.i, job: j, cleave: a.cleave, art: a.art } };
  const u = a.dmg > 0 || j?.p === 'smash' ? addTarget(f) : undefined;
  if (u) m.add!.on = u.id;
  c.block = 'add';
  if (a.aura) {
    const id = f.nextId++;
    f.zones.push({ id, cells: new Set(f.cells.filter(x => hexDist(x, c) === 1 && !x.block).map(x => x.i)), end: Infinity, dps: a.aura });
    m.add!.zone = id;
  }
  if (j) m.add!.jobAt = f.t + (j.p === 'bomb' || j.p === 'hatch' || j.p === 'hoard' ? j.sec : j.p === 'march' ? marchEvery(f, j.every) : 'every' in j ? j.every : Infinity);
  if (j?.p === 'march') m.add!.steps = c.row + 1; // 앞줄(0)까지 걸어와서 한 번 더 걸으면 흡수
  f.mobs.push(m);
  emit(f, { type: 'fx', name: 'spawn', cell: c.i });
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

/** 일점사 순서 (P-FOCUS): 치유하는 쫄 → 폭탄 · 부화하는 알 → 감옥 → 보호막 수정 → 마나 갈취 쫄 → 그 밖, 같으면 먼저 나온 것 */
const FOCUS: Partial<Record<AddJob['p'], number>> = { mend: 0, bomb: 1, hatch: 1, hoard: 1, jail: 2, pylon: 3, drain: 4 };
const focusRank = (m: Mob): number => (m.add!.job && FOCUS[m.add!.job.p]) ?? 9;
export function focusOrder(f: Fight): Mob[] {
  return f.mobs.filter(m => m.alive && m.add).sort((a, b) => focusRank(a) - focusRank(b) || a.id - b.id);
}

/** 보스가 받는 피해 배율: 보호막 수정 (P-PYLON) × 멍함 (차례 성공) × 영혼 축복 (숲 할아버지) */
export function bossTaken(f: Fight): number {
  let m = (f.daze ? f.daze.vuln : 1) * (f.expose ? f.expose.vuln : 1);
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
    if (a.job?.p === 'drain') f.mana = Math.max(0, f.mana - a.job.pct * DT); // 마나 갈취 쫄 (P-DRAIN)
    if (a.job?.p === 'smash' && !a.warned && f.t + 1e-9 >= a.jobAt! - a.job.warn) { a.warned = true; emit(f, { type: 'sound', name: 'buster' }); emit(f, { type: 'fx', name: 'warn', on: a.on }); }
    if (a.dmg <= 0 || f.t + 1e-9 < a.next) continue;
    a.next += a.every;
    if ((m.stun || 0) > f.t) continue;
    let u = unitById(f, a.on);
    if (!u || !u.alive) { u = addTarget(f); if (!u) continue; a.on = u.id; }
    // 파티원 도발·정의의 분노 (17): 그동안 끌어온 사람을 때림
    if (f.ab.tauntUntil > f.t) { const tu = unitById(f, f.ab.taunt); if (tu && tu.alive) u = tu; }
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
    emit(f, { type: 'fx', name: 'explode', cell: a.cell });
    emit(f, { type: 'msg', text: `${m.name}이(가) 터짐` });
    during(f, 'bomb', () => { for (const u of living(f)) damage(f, u, j.dmg, true); }); // 폭탄 해체반 (42 기믹 04)
    if (j.debuff) for (const u of living(f)) applyDebuff(f, u, j.debuff);
  } else if (j.p === 'hatch') {
    // 부화하는 알 (51 5장): 시간 안에 못 깨면 알이 사라지고 그 칸에서 새끼가 나옴
    a.jobAt = Infinity; a.done = true;
    vanish(m);
    const c = f.cells[a.cell!];
    c.block = undefined;
    emit(f, { type: 'fx', name: 'egg-hatch', cell: c.i });
    emit(f, { type: 'msg', text: `${m.name}이(가) 깨져 ${j.add.name}이(가) 나옴` });
    spawnAdd(f, j.add, c.unit ? undefined : c);
  } else if (j.p === 'hoard') {
    // 금화 더미 (51 4-1): 시간 안에 못 깨면 보스가 주워 감
    a.jobAt = Infinity;
    vanish(m);
    emit(f, { type: 'fx', name: 'greed-coin', cell: a.cell });
    empowerBoss(f, j.boost, `보스가 ${m.name}을(를) 주움`);
  } else if (j.p === 'sting') {
    // 쏘는 쫄 (꿀벌 떼): 탱커 아닌 무작위 1명에게 피해 + 쇠약
    a.jobAt! += j.every;
    if ((m.stun || 0) > f.t) return;
    const u = randomTargets(f, 1, v => v.role !== 'tank')[0];
    if (!u) return;
    damage(f, u, j.dmg, false, 'party');
    const old = u.debuffs.find(d => d.name === j.debuff.name);
    if (old) old.left = j.debuff.left; // 이미 쏘였으면 시간만 처음으로 (중첩은 체력이 낮은 동안 쌓임)
    else if (u.alive) applyDebuff(f, u, j.debuff);
  } else if (j.p === 'smash') {
    // 큰 쫄 (P-ELITE): 예고한 강타. 맡은 사람(부탱커)이 쓰러졌으면 다음 사람
    a.jobAt! += j.every; a.warned = false;
    if ((m.stun || 0) > f.t) return;
    let u = unitById(f, a.on);
    if (!u || !u.alive) { u = addTarget(f); if (!u) return; a.on = u.id; }
    damage(f, u, j.dmg, false, 'tank');
    emit(f, { type: 'fx', name: 'slam', on: u.id });
    emit(f, { type: 'shake', id: u.id });
  } else if (j.p === 'march') {
    // 걸어오는 쫄 (P-MARCH): 한 줄 앞으로. 걸음이 다 되면 보스에게 흡수
    a.jobAt! += marchEvery(f, j.every);
    a.steps = (a.steps ?? 1) - 1;
    if (a.steps > 0) { stepTo(f, m, x => x.row === f.cells[a.cell!].row - 1); return; }
    vanish(m);
    empowerBoss(f, j.boost, `${m.name}이(가) 보스에게 닿음`); // 겹칠수록 +10% · +20% · … (곱하지 않고 더함)
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
    emit(f, { type: 'fx', name: 'explode', on: u.id });
    emit(f, { type: 'msg', text: `${m.name}이(가) ${u.nick} 곁에서 터짐` });
    during(f, 'bomb', () => {
      for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), at) === 1) damage(f, v, j.splash, true);
      damage(f, u, j.dmg, true);
    });
  }
}

/**
 * 걸어오는 쫄 한 걸음 간격: every는 6줄 판 (36칸) 기준. 줄이 적은 판 (5인 3줄 · 10인 5줄)은 그만큼 천천히 걸어서
 * 뒷줄에서 보스까지 걸리는 시간 (6 × every)은 판과 상관없이 같음 (2026-10-10)
 */
const marchEvery = (f: Fight, every: number) => every * 6 / f.rows;

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
  if (m.add!.down) downDo(f, m.add!.down, unitById(f, m.add!.on));
}

/** 쓰러질 때 (파열 · 뼈 먼지): burst = 살아 있는 모두에게 1중첩, debuff = 때리던 사람 (없으면 무작위 1명) */
function downDo(f: Fight, d: AddDown, on: Unit | undefined): void {
  if (d.p === 'burst') { for (const u of living(f)) applyDebuff(f, u, d.debuff); return; }
  const u = on && on.alive ? on : randomTargets(f, 1)[0];
  if (u) applyDebuff(f, u, d.debuff);
}

/** 매 틱 일반 · 정예 구간: 새로 쓰러진 적의 down (먼지 유령 → 먼지 파열, 46 5장 「정예 구간 쫄이 쓰러질 때」) */
export function trashDown(f: Fight): void {
  for (const m of f.mobs) {
    if (m.alive || !m.down || m.downDone) continue;
    m.downDone = true;
    downDo(f, m.down, undefined);
  }
}

/** 흐르는 장판: 이 열이 맞을 때 다음 열을 예고 (예고 = every초, 파티원이 미리 비킴) */
export function flowNext(f: Fight, tel: Telegraph): void {
  const { col, dir, every } = tel.flow!;
  const cells = new Set(f.cells.filter(c => c.col === col + dir).map(c => c.i));
  if (!cells.size) return;
  const next: Telegraph = { id: f.nextId++, skill: tel.skill, kind: 'zone', start: f.t, impact: f.t + every, units: [], cells, dps: tel.dps, dur: tel.dur, flow: { col: col + dir, dir, every } };
  f.tels.push(next);
  if (!tel.skill.fixed) scheduleReactions(f, next); // 못 피하는 줄 훑기 (보물 수레)는 안 비킴
}

/** 소포 부치기 · 화살 바람 (56 4-1 · 4-5): 생명 사슬 쌍마다 한 사람 (나 빼고 무작위)을 n명까지. 사슬이 없으면 탱커 · 나 빼고 무작위 */
export function linkedOnes(f: Fight, n: number): Unit[] {
  const out: Unit[] = [];
  for (const l of f.links) {
    if (out.length >= n) continue;
    const two = [unitById(f, l.a), unitById(f, l.b)].filter((u): u is Unit => !!u && u.alive && !u.lift && !u.me);
    if (two.length) out.push(two[Math.floor(f.rng() * two.length)]);
  }
  return out.length ? out : randomTargets(f, n, u => u.role !== 'tank' && !u.me);
}

/** 사슬 짝 고르기 (46 5장): 생명 사슬에 묶인 사람 먼저 (무작위), 모자라면 탱커 · 나 빼고 무작위 */
function linkedTargets(f: Fight, n: number, ok: (u: Unit) => boolean): Unit[] {
  const tied = randomTargets(f, n, u => ok(u) && u.debuffs.some(d => d.link));
  return tied.concat(randomTargets(f, n - tied.length, u => ok(u) && !tied.includes(u) && u.role !== 'tank' && !u.me));
}

/** 그 디버프가 걸린 사람 먼저 (나 빼고, 이끼 덮기 → 이끼 표식 56 4-3), 모자라면 탱커 · 나 빼고 무작위 */
export function preferTargets(f: Fight, n: number, ok: (u: Unit) => boolean, name: string): Unit[] {
  const marked = randomTargets(f, n, u => ok(u) && !u.me && u.debuffs.some(d => d.name === name));
  return marked.concat(randomTargets(f, n - marked.length, u => ok(u) && !marked.includes(u) && u.role !== 'tank' && !u.me));
}

/** 차례 번호를 받은 사람 먼저 (나 빼고, 거꾸로 마술 48 4-3), 모자라면 탱커 · 나 빼고 무작위 */
function orderTargets(f: Fight, n: number, ok: (u: Unit) => boolean): Unit[] {
  const ids = f.order?.ids ?? [];
  const numbered = randomTargets(f, n, u => ok(u) && !u.me && ids.includes(u.id));
  return numbered.concat(randomTargets(f, n - numbered.length, u => ok(u) && !numbered.includes(u) && u.role !== 'tank' && !u.me));
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

/** 장판 칸 고르기. mirror = 신기루 피난처의 가짜 (side의 반대쪽 끝) */
export function zoneCells(f: Fight, s: BossSkill, z: ZoneCells, mirror = false): Set<number> {
  switch (z.p) {
    case 'safe': {
      // 안전 칸 n개: edge = 가운데에서 먼 칸부터, center = 가까운 칸부터 (+ 탱커 칸), side = 무작위 한쪽 끝 열에서 가까운 칸부터. 나머지가 맞는 칸
      const open = f.cells.filter(c => !c.block);
      const n = f.mythic && z.nMythic ? z.nMythic : z.n;
      const ringed = new Set(f.zones.flatMap(x => (x.ring ? [...x.cells] : []))); // 요정 고리 칸은 안전 칸이 아님 (48 축제 대장 퐁가)
      if (z.at === 'side' && !mirror) s.st.left = f.rng() < 0.5;
      const left = mirror ? !s.st.left : !!s.st.left, midRow = (f.rows - 1) / 2;
      const order = open.filter(c => !ringed.has(c.i)).sort((a, b) => (z.at === 'side' ? (left ? a.px - b.px : b.px - a.px) || Math.abs(a.row - midRow) - Math.abs(b.row - midRow)
        : z.at === 'edge' ? fromMid(f, b) - fromMid(f, a) : fromMid(f, a) - fromMid(f, b)));
      const safe = new Set(order.slice(0, n).map(c => c.i));
      if (z.tank) { const tk = aggroTarget(f); if (tk) safe.add(tk.moving ? tk.moving.to : tk.cell); }
      return new Set(open.filter(c => !safe.has(c.i)).map(c => c.i));
    }
    case 'line':
      return new Set(f.cells.filter(c => !c.block && zoneOf(f, c.row) === z.at).map(c => c.i));
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
    case 'phase': f.phase = d.n; f.phaseName = d.name; if (f.sp) specPhase(f); return;
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
    case 'empower': empowerBoss(f, d.boost, d.why); return;
    case 'cheer':
      f.cheer = { until: f.t + d.sec, mult: 1 + d.pct };
      emit(f, { type: 'sound', name: 'gauge' });
      emit(f, { type: 'fx', name: 'cheer', all: true });
      return;
    case 'dark': f.dark = true; return;
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
