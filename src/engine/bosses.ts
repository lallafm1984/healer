/**
 * 보스 전투 진행: 보스 데이터(data/bosses.ts)를 읽어 기술을 만들고, 매 틱 페이즈 흐름·광폭화·예고·적중을 돌린다.
 * 기술이 하는 일은 부품(bossParts.ts). 일반·정예 구간은 encounters.ts의 적 목록 (23 2장).
 */
import { NO_TANK_RAMP, NO_TANK_SEC } from '../data/armor';
import { BOSSES, type SkillDef } from '../data/bosses';
import type { MobAttack } from '../data/encounters';
import { abCut, abOnTel } from './abilities';
import { affChaos } from './affixes';
import { addsTick, aggroTarget, applyDebuff, backTargets, flowNext, greedTargets, orderTick, padCells, padsGo, runEffect, runFlow, boonTick, linksTick, soakGo, soulsTick, staggerTick, stunBoss, trashDown, vesselTick, watchInit, watchTick, whenFn, zoneCells } from './bossParts';
import { damage, emit, living, randomTargets, unitById } from './core';
import { scheduleReactions } from './movement';
import { specBuster, specCut, specTel } from './specials';
import type { BossSkill, Fight, Mob, TelKind, Telegraph, Unit } from './types';

export { aggroTarget } from './bossParts';

type SkillSpec = Omit<BossSkill, 'active' | 'st'> & { active?: BossSkill['active'] };

function skill(f: Fight, s: SkillSpec): BossSkill {
  const o: BossSkill = { active: () => true, st: {}, ...s };
  f.skills.push(o);
  return o;
}

/** 데이터의 기술 하나를 전투 기술로 (테스트에서 부품을 따로 돌릴 때도) */
export function fromDef(f: Fight, d: SkillDef): BossSkill {
  const e = d.effect, z = d.cells;
  const s = skill(f, {
    key: d.key, name: d.name, icon: d.icon, kind: d.kind, hidden: d.hidden, next: d.first ?? Infinity, period: d.period, cast: d.cast,
    warn: d.warn, cut: d.cut || e?.p === 'counter', dmg: d.dmg, dps: d.dps != null ? d.dps * (f.mythic && d.dpsMythic ? d.dpsMythic : 1) : undefined, dur: d.dur,
    active: whenFn(d.when),
    target: d.target === 'tank' ? g => { const tk = aggroTarget(g); return tk ? [tk.id] : []; }
      : d.target ? g => {
        const t = d.target as Exclude<SkillDef['target'], 'tank' | undefined>, n = g.mythic && t.nMythic ? t.nMythic : t.n;
        return (t.p === 'random' ? randomTargets(g, n, u => u.role !== 'tank' && !u.me) : t.p === 'greed' ? greedTargets(g, n) : backTargets(g, n)).map(u => u.id);
      } : undefined,
    fire: e ? g => runEffect(g, s, e) : undefined,
    hit: e ? (g, tel) => runEffect(g, s, e, tel) : undefined,
    cellsFor: z ? g => zoneCells(g, s, z) : e?.p === 'tower' ? g => padCells(g, e.n) : undefined,
    flowEvery: z?.p === 'flow' ? z.every : undefined, hitDmg: d.hitDmg, hitDebuff: d.hitDebuff, safe: z?.p === 'safe' || undefined, quake: e?.p === 'quake' || undefined,
    stunOnCut: e?.p === 'counter' ? e.stun : undefined, pads: e?.p === 'tower' || undefined, fixed: d.fixed, soak: e?.p === 'share' || undefined,
    greed: e?.p === 'greed' ? e.dmg : undefined,
  });
  f.bs[d.key] = s;
  return s;
}

/** 장판 예고가 맞는 순간 그 칸에 선 사람 (옮겨 가는 중이면 가는 칸) 한 번 피해. 두꺼비 배 속(hide)은 안 맞음 (피난처) */
function cellHit(f: Fight, tel: Telegraph, dmg: number): void {
  for (const u of living(f)) {
    const pos = u.moving ? u.moving.to : u.cell;
    if (!tel.cells.has(pos) || u.debuffs.some(d => d.hide)) continue;
    damage(f, u, dmg, true);
    if (tel.skill.hitDebuff && u.alive) applyDebuff(f, u, tel.skill.hitDebuff); // 줄 불길 불씨 (51 3-1)
  }
}

/** 광폭화: 시각이 되거나 레이드 탱커 공백 (35 6-4)이면 짧은 주기 전원 광역 */
function enrageAt(f: Fight, name: string, period: number, dmg: number): void {
  const noTank = f.noTankAt != null && f.t >= f.noTankAt + NO_TANK_SEC; // 탱커 공백 (35 6-4)
  if (f.enraged || (f.t < f.enc.enrage && !noTank)) return;
  f.enraged = true; emit(f, { type: 'phase', text: '광폭화' });
  const tankless = f.t < f.enc.enrage;
  if (tankless) emit(f, { type: 'msg', text: '탱커가 없어 보스가 광폭화' });
  // 탱커 없음 광폭화는 맞을 때마다 세짐: 탱커 대신 막는 사람이 버텨도 오래 못 감 (35 6-4)
  let n = 0;
  skill(f, { key: 'enrage', name, icon: '광폭', kind: 'aoe', next: f.t, period, cast: 1, hit(f) { const m = tankless ? 1 + NO_TANK_RAMP * n++ : 1; for (const u of living(f)) damage(f, u, dmg * m, true); } });
}

/** 적 공격 대상 */
function mobTargets(f: Fight, to: MobAttack['to']): Unit[] {
  if (to === 'tank') { const tk = aggroTarget(f); return tk ? [tk] : []; }
  if (to === 'other') {
    // 도발·눈속임 (17): 그동안 끌어온 사람을 때림
    if (f.ab.tauntUntil > f.t) { const tu = f.party.find(u => u.id === f.ab.taunt && u.alive); if (tu) return [tu]; }
    const t = randomTargets(f, 1, u => u.role !== 'tank'); return t.length ? t : randomTargets(f, 1);
  }
  return living(f);
}

/** 일반·정예 구간 (23 2장): 적마다 공격을 따로 돌리고, 쓰러지면 그 적 기술은 멈춘다 */
function initTrash(f: Fight): void {
  f.phaseName = '';
  f.bodyHp = true;
  const scale = f.bossMax / f.enc.hp;
  for (const def of f.enc.mobs!) for (let i = 0; i < def.count; i++) {
    const m: Mob = { id: f.nextId++, name: def.name, elite: !!def.elite, hp: def.hp * scale, max: def.hp * scale, alive: true, down: def.down };
    f.mobs.push(m);
    for (const a of def.attacks) {
      const tel = a.cast > 0, e = a.effect;
      const s: BossSkill = skill(f, {
        key: `${a.key}${m.id}`, mob: m.id, name: a.name, icon: a.icon, kind: a.kind, hidden: !tel, cut: a.cut, other: a.to === 'other',
        // 같은 적 여럿이 한 틱에 같이 때리지 않게 조금씩 어긋나게
        next: a.first + i * 0.7, period: a.period, cast: a.cast, warn: tel ? a.kind : undefined,
        active: f => f.mobs.some(x => x.id === m.id && x.alive),
        target: a.to === 'all' ? undefined : f => mobTargets(f, a.to).map(u => u.id),
        fire(f) {
          if (e) { runEffect(f, s, e); return; } // 졸개 디버프 (39 2장 ③): 대상은 부품이 고름
          for (const u of mobTargets(f, a.to)) {
            const j = (a.jitter || 0) * (u.cls === 'warrior' ? 0.5 : 1);
            damage(f, u, a.dmg * (1 - j + 2 * j * f.rng()), a.to === 'all', a.to === 'tank' ? 'tank' : 'party');
          }
        },
        hit(f, tel) {
          if (e) { runEffect(f, s, e, tel); return; }
          const us = a.to === 'all' ? living(f) : tel.units.map(id => unitById(f, id)).filter((u): u is Unit => !!u);
          for (const u of us) damage(f, u, a.dmg, a.to === 'all', a.to === 'tank' ? 'tank' : 'party');
        },
      });
    }
  }
}

/** 보스 데이터 (data/bosses.ts)로 전투 시작: 페이즈 · 몸통 · 기술 */
export function initBoss(f: Fight): void {
  if (f.enc.script === 'trash') { initTrash(f); return; }
  const def = BOSSES[f.enc.script];
  [f.phase, f.phaseName] = def.phase;
  if (def.bodies) {
    f.bodyHp = true;
    const scale = f.bossMax / f.enc.hp;
    for (const b of def.bodies) f.mobs.push({ id: f.nextId++, name: b.name, elite: !!b.elite, boss: b.boss, hp: b.hp * scale, max: b.hp * scale, alive: true });
  }
  f.split = !!def.split;
  for (const d of def.skills) fromDef(f, d);
  if (def.watch && !def.watch.from) watchInit(f, def.watch);
}

/** 매 틱 보스 쪽: 페이즈 흐름 → 광폭화 */
function bossUpdate(f: Fight): void {
  if (f.enc.script === 'trash') { if (f.mobs.some(m => m.down)) trashDown(f); return; } // 일반·정예 구간은 광폭화 없음
  const def = BOSSES[f.enc.script];
  if (def.flow) runFlow(f, def.flow);
  if (def.watch?.from && !f.watch && f.phase === def.watch.from) watchInit(f, def.watch); // 주시가 이 페이즈부터 (심연의 군주 3페이즈)
  if (f.mobs.length) addsTick(f);
  if (f.order) orderTick(f);
  if (f.watch) watchTick(f);
  if (f.stagger) staggerTick(f);
  if (f.souls.length) soulsTick(f);
  if (f.links.length) linksTick(f);
  if (f.vessel) vesselTick(f);
  if (f.bless || f.weak || f.expose) boonTick(f);
  if (f.daze && f.t >= f.daze.until) f.daze = null;
  enrageAt(f, def.enrage.name, def.enrage.period, def.enrage.dmg);
}

/** 보스 진행: 기술 예고 → 적중 */
export function bossTick(f: Fight): void {
  bossUpdate(f);
  for (const s of f.skills) {
    if (f.t + 1e-9 < s.next) continue;
    s.next += s.period;
    if (!s.active(f)) continue;
    if (f.daze && s.mob == null) continue; // 멍한 보스는 그 차례를 건너뜀 (차례 성공)
    if (f.abOn) {
      // 파티원 능력 (17 7장): 기절한 적은 기술을 안 씀, 끊기 가능 기술은 시전 시작에 끊길 수 있음
      if (s.mob != null && (f.mobs.find(m => m.id === s.mob)?.stun || 0) > f.t) continue;
      if (abCut(f, s)) { if (s.stunOnCut) stunBoss(f, s.stunOnCut); if (f.sp) specCut(f); continue; } // 반격 틈 (P-COUNTER) · 끊기 박자 (42 지원 05)
    }
    if (s.cast <= 0) { s.fire!(f); continue; }
    const tel: Telegraph = { id: f.nextId++, skill: s, kind: s.kind, start: f.t, impact: f.t + s.cast, units: s.target ? s.target(f) : [], cells: s.cellsFor ? s.cellsFor(f) : new Set(), dps: s.dps, dur: s.dur };
    if (s.flowEvery && tel.cells.size) tel.flow = { col: f.cells[[...tel.cells][0]].col, dir: s.st.dir === -1 ? -1 : 1, every: s.flowEvery };
    if (s.safe) tel.safe = new Set(f.cells.filter(c => !c.block && !tel.cells.has(c.i)).map(c => c.i));
    f.tels.push(tel);
    if (s.pads) { tel.safe = new Set(tel.cells); padsGo(f, tel); } // 받침: 금빛 발판으로 파티원이 들어감
    if (s.soak) soakGo(f, tel); // 집결 분담: 가까운 파티원이 대상 옆으로
    if (f.abOn) abOnTel(f, tel);
    if (f.sp) specTel(f, tel); // 북소리 (42 발동 13)
    if (f.aff) affChaos(f, tel);
    if (s.warn) emit(f, { type: 'sound', name: s.warn });
    if (tel.kind === 'zone' && f.tels.includes(tel) && !s.fixed) scheduleReactions(f, tel); // 줄 피해 (P-ROW)는 안 비킴
  }
  for (const tel of f.tels.filter(t => t.impact <= f.t + 1e-9)) {
    if (tel.kind === 'zone') {
      if (tel.skill.hitDmg) cellHit(f, tel, tel.skill.hitDmg);
      if (tel.dur) f.zones.push({ id: tel.id, cells: tel.cells, end: f.t + tel.dur, dps: tel.dps! });
      if (tel.flow) flowNext(f, tel); // 흐르는 장판: 다음 열 예고
    } else tel.skill.hit!(f, tel);
    if (f.sp && tel.kind === 'buster') specBuster(f, tel); // 고철 호루라기 (42 3장)
    emit(f, { type: 'impact', kind: tel.kind });
  }
  f.tels = f.tels.filter(t => t.impact > f.t + 1e-9);
  f.zones = f.zones.filter(z => z.end > f.t);
}

export interface QueueEntry {
  name?: string;
  icon?: string;
  kind?: TelKind;
  impact: number;
  start?: number;
  casting: boolean;
  /** 화면용: 이 기술 (아이콘 그림 찾기, battle/skillArt.ts). 엔진은 안 읽음 */
  skill?: BossSkill;
}

/** 화면 상단 보스 기술 예고: 다음 3개 */
export function queue(f: Fight): QueueEntry[] {
  const list: QueueEntry[] = [];
  for (const t of f.tels) list.push({ name: t.skill.name, icon: t.skill.icon, kind: t.kind, impact: t.impact, start: t.start, casting: true, skill: t.skill });
  for (const s of f.skills) {
    if (s.hidden || s.next === Infinity) continue;
    let n = s.next;
    for (let i = 0; i < 3; i++) {
      const imp = n + s.cast;
      if (imp - f.t < 120 && s.active(f)) list.push({ name: s.name, icon: s.icon, kind: s.kind, impact: imp, casting: false, skill: s });
      n += s.period;
    }
  }
  list.sort((a, b) => a.impact - b.impact);
  return list.slice(0, 3);
}
