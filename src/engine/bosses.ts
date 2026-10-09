import type { MobAttack, ScriptKey } from '../data/encounters';
import { NO_TANK_RAMP, NO_TANK_SEC } from '../data/armor';
import { hexDist } from './board';
import { addDebuff, cellOf, damage, DT, emit, living, randomTargets, spread, unitById } from './core';
import { scheduleReactions } from './movement';
import { abCut, abOnTel } from './abilities';
import { affChaos } from './affixes';
import type { BossSkill, Fight, Mob, TelKind, Telegraph, Unit } from './types';

type SkillSpec = Omit<BossSkill, 'active'> & { active?: BossSkill['active'] };

function skill(f: Fight, s: SkillSpec): BossSkill {
  const o: BossSkill = { active: () => true, ...s };
  f.skills.push(o);
  return o;
}

/**
 * 보스가 때릴 사람: 살아 있는 탱커. 탱커가 모두 쓰러지면 대신 막는 사람
 * (버팀목 특성 → 근접 → 원거리 → 나, 2026-10-07 Lim)
 */
export function aggroTarget(f: Fight): Unit | null {
  const alive = f.party.filter(u => u.alive);
  return alive.find(u => u.role === 'tank') || alive.find(u => u.traits.includes('bulwark')) || alive.find(u => u.role === 'melee') || alive.find(u => u.role === 'ranged') || alive.find(u => u.me) || null;
}

/** 보스 평타 ±30% (전사 「단단한 몸」은 ±15%, 17) */
function autoHit(f: Fight, tk: Unit, base: number): void {
  const r = f.rng();
  damage(f, tk, base * (tk.cls === 'warrior' ? 0.85 + 0.3 * r : 0.7 + 0.6 * r), false, 'tank');
}

interface BossScript {
  init(f: Fight): void;
  update(f: Fight): void;
}

/** 광폭화: 시각이 되면 짧은 주기 광역 */
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

/** 보스 기술 스크립트 (05, 23) */
const SCRIPTS: Record<ScriptKey, BossScript> = {
  // 고철 경비병 (23 3장): 문지기를 순하게 줄인 첫 보스. 탱커 버스터 + 광역만
  scrap: {
    init(f) {
      f.phaseName = '';
      skill(f, { key: 'auto', hidden: true, next: 2, period: 2, cast: 0, fire(f) { const tk = aggroTarget(f); if (tk) autoHit(f, tk, 75); } });
      skill(f, {
        key: 'buster', name: '고철 휘두르기', icon: '휘두', kind: 'buster', next: 10, period: 16, cast: 2, warn: 'buster', dmg: 450,
        target(f) { const tk = aggroTarget(f); return tk ? [tk.id] : []; },
        hit(f, tel) { for (const id of tel.units) { const u = unitById(f, id); if (u) damage(f, u, tel.skill.dmg!, false, 'tank'); } },
      });
      skill(f, {
        key: 'aoe', name: '쇳조각 비', icon: '쇳조', kind: 'aoe', next: 20, period: 22, cast: 3, warn: 'aoe', cut: true,
        hit(f) { for (const u of living(f)) damage(f, u, 170, true); },
      });
    },
    update(f) { enrageAt(f, '고철 폭주', 2, 150); },
  },
  // 일반·정예 구간 (23 2장): 적마다 공격을 따로 돌리고, 쓰러지면 그 적 기술은 멈춘다
  trash: {
    init(f) {
      f.phaseName = '';
      const scale = f.bossMax / f.enc.hp;
      for (const def of f.enc.mobs!) for (let i = 0; i < def.count; i++) {
        const m: Mob = { id: f.nextId++, name: def.name, elite: !!def.elite, hp: def.hp * scale, max: def.hp * scale, alive: true };
        f.mobs.push(m);
        for (const a of def.attacks) {
          const tel = a.cast > 0;
          skill(f, {
            key: `${a.key}${m.id}`, mob: m.id, name: a.name, icon: a.icon, kind: a.kind, hidden: !tel, cut: a.cut, other: a.to === 'other',
            // 같은 적 여럿이 한 틱에 같이 때리지 않게 조금씩 어긋나게
            next: a.first + i * 0.7, period: a.period, cast: a.cast, warn: tel ? a.kind : undefined,
            active: f => f.mobs.some(x => x.id === m.id && x.alive),
            target: a.to === 'all' ? undefined : f => mobTargets(f, a.to).map(u => u.id),
            fire(f) {
              for (const u of mobTargets(f, a.to)) {
                const j = (a.jitter || 0) * (u.cls === 'warrior' ? 0.5 : 1);
                damage(f, u, a.dmg * (1 - j + 2 * j * f.rng()), a.to === 'all', a.to === 'tank' ? 'tank' : 'party');
              }
            },
            hit(f, tel) {
              const us = a.to === 'all' ? living(f) : tel.units.map(id => unitById(f, id)).filter((u): u is Unit => !!u);
              for (const u of us) damage(f, u, a.dmg, a.to === 'all', a.to === 'tank' ? 'tank' : 'party');
            },
          });
        }
      }
    },
    update() { /* 일반·정예 구간은 광폭화 없음 */ },
  },
  warden: {
    init(f) {
      f.phaseName = '';
      skill(f, { key: 'auto', hidden: true, next: 2, period: 2, cast: 0, fire(f) { const tk = aggroTarget(f); if (tk) autoHit(f, tk, 70); } });
      skill(f, {
        key: 'buster', name: '내려찍기', icon: '찍기', kind: 'buster', next: 12, period: 20, cast: 2, warn: 'buster', dmg: 600,
        target(f) { const tk = aggroTarget(f); return tk ? [tk.id] : []; },
        hit(f, tel) { for (const id of tel.units) { const u = unitById(f, id); if (u) damage(f, u, tel.skill.dmg!, false, 'tank'); } },
      });
      skill(f, {
        key: 'aoe', name: '증기 분출', icon: '증기', kind: 'aoe', next: 25, period: 30, cast: 3, warn: 'aoe',
        hit(f) { for (const u of living(f)) damage(f, u, 220, true); },
      });
      f.zoneSkill = skill(f, {
        key: 'zone', name: '녹물 웅덩이', icon: '장판', kind: 'zone', next: Infinity, period: 20, cast: 2.5, dps: 60, dur: 8, warn: 'zone', cut: true,
        active: f => f.bossHp <= f.bossMax * 0.4,
        cellsFor(f) {
          // 05 1-B: 던전에서는 "피할 곳이 없어!"가 나오지 않게, 범위 밖 빈 칸이 범위 안 인원 이상 남는 중심만 고른다
          const ok = randomTargets(f, 99).map(u => {
            const center = f.cells[u.cell];
            const set = new Set(f.cells.filter(x => hexDist(x, center) <= 1).map(x => x.i));
            const inside = living(f).filter(v => set.has(v.cell)).length;
            const free = f.cells.filter(x => !x.unit && !set.has(x.i)).length;
            return free >= inside ? set : null;
          }).filter((s): s is Set<number> => !!s);
          if (ok.length) return ok[0];
          const c = randomTargets(f, 1)[0];
          return c ? new Set([c.cell]) : new Set<number>();
        },
      });
    },
    update(f) {
      const zs = f.zoneSkill!;
      if (zs.next === Infinity && f.bossHp <= f.bossMax * 0.4) { zs.next = f.t + 3; emit(f, { type: 'phase', text: '녹이 흘러내린다' }); }
      enrageAt(f, '증기 폭주', 2, 220);
    },
  },
  plague: {
    init(f) {
      // 10인 악몽 전용 (26 3-1): 전염 2명 동시 + 30% 아래 역병 폭풍. 디버프 대상 수는 그대로 2명
      const mythic = f.mythic;
      const nDeb = 2;
      f.phase = 1; f.phaseName = '1페이즈';
      skill(f, { key: 'auto', hidden: true, next: 2, period: 2, cast: 0, fire(f) { const tk = aggroTarget(f); if (tk) autoHit(f, tk, 60); } });
      skill(f, {
        key: 'breath', name: '썩은 숨결', icon: '숨결', kind: 'instant', next: 6, period: 12, cast: 0, active: f => f.phase === 1 || f.phase >= 2,
        fire(f) {
          for (const u of randomTargets(f, nDeb)) {
            let d = u.debuffs.find(x => x.name === '썩은 숨결');
            if (!d) d = addDebuff(f, u, { name: '썩은 숨결', type: '질병', left: 60, stack: 0 });
            d.stack = Math.min(4, (d.stack || 0) + 1); d.left = 60;
            u.max = u.base * (1 - 0.05 * d.stack); u.hp = Math.min(u.hp, u.max);
          }
        },
      });
      skill(f, {
        key: 'sting', name: '독침', icon: '독침', kind: 'instant', next: 10, period: 15, cast: 0, active: f => f.phase === 1, cut: true,
        fire(f) { for (const u of randomTargets(f, nDeb, u => !u.debuffs.some(d => d.name === '독침'))) addDebuff(f, u, { name: '독침', type: '독', left: 12, dot: 15 }); },
      });
      f.pulse = skill(f, {
        key: 'aoe', name: '역병 파동', icon: '파동', kind: 'aoe', next: 27, period: 30, cast: 3, warn: 'aoe', active: f => f.phase === 1 || f.phase >= 2,
        hit(f) { const dmg = f.phase === 1 ? 150 : 180; for (const u of living(f)) damage(f, u, dmg, true); },
      });
      f.contagion = skill(f, {
        key: 'contagion', name: '전염', icon: '전염', kind: 'instant', next: Infinity, period: 20, cast: 0, active: f => f.phase >= 2,
        fire(f) {
          const ts = randomTargets(f, mythic ? 2 : 1, u => !u.debuffs.some(d => d.name === '전염'));
          for (const u of ts) addDebuff(f, u, { name: '전염', type: '질병', left: 8, trap: true });
          if (ts.length === 2 && hexDist(cellOf(f, ts[0]), cellOf(f, ts[1])) === 1) {
            emit(f, { type: 'msg', text: '전염 대상이 붙어 있어 바로 터짐' });
            for (const u of ts) { const d = u.debuffs.find(x => x.name === '전염'); if (d) { u.debuffs = u.debuffs.filter(x => x !== d); spread(f, u); } }
          }
        },
      });
      f.storm = skill(f, {
        key: 'storm', name: '역병 폭풍', icon: '폭풍', kind: 'zone', next: Infinity, period: 10, cast: 2.5, dps: 40, dur: 7.5, warn: 'zone', active: f => f.phase === 3,
        cellsFor(f) {
          // 26 3-1: 판 절반이면 19칸에 10명이 피할 칸이 모자라 바깥 1열 (줄마다 맨 왼쪽 또는 맨 오른쪽 칸), 좌우 번갈아
          f.stormSide = !f.stormSide;
          const out = new Set<number>();
          for (let r = 0; r < f.rows; r++) {
            const row = f.cells.filter(c => c.row === r);
            if (row.length) out.add(row.reduce((a, b) => ((f.stormSide ? b.px < a.px : b.px > a.px) ? b : a)).i);
          }
          return out;
        },
      });
    },
    update(f) {
      const r = f.bossHp / f.bossMax;
      if (f.phase === 1 && r <= 0.6) {
        f.phase = 0; f.phaseName = '인터미션'; f.invuln = true; f.interEnd = f.t + 25;
        emit(f, { type: 'phase', text: '인터미션: 쥐떼가 뒷줄 공격' });
        const ranged = living(f).filter(u => u.role === 'ranged').sort((a, b) => cellOf(f, b).row - cellOf(f, a).row);
        f.rats = ranged.slice(0, 3).map(u => u.id);
        for (const u of living(f)) if (u.debuffs.length) addDebuff(f, u, { name: '독침', type: '독', left: 12, dot: 15 });
      }
      if (f.phase === 0) {
        for (const id of f.rats) { const u = unitById(f, id); if (u) damage(f, u, 30 * DT); }
        if (f.t >= f.interEnd!) {
          f.phase = 2; f.phaseName = '2페이즈'; f.invuln = false; f.rats = [];
          f.contagion!.next = f.t + 10; f.pulse!.next = f.t + 22; f.pulse!.period = 25;
          emit(f, { type: 'phase', text: '2페이즈: 전염은 해제하면 바로 퍼짐' });
        }
      }
      if (f.mythic && f.phase === 2 && r <= 0.3) {
        f.phase = 3; f.phaseName = '3페이즈'; f.storm!.next = f.t + 1;
        emit(f, { type: 'phase', text: '3페이즈: 역병 폭풍이 판 바깥 1열을 번갈아 덮음' });
      }
      enrageAt(f, '역병 폭주', 3, 180);
    },
  },
  // 무음 성가대 (26 4-3): 20인 입문. 성가대원 셋이 맡은 2열에 노래, 다 잡으면 지휘자 2페이즈
  choir: {
    init(f) {
      f.phase = 1; f.phaseName = '1페이즈 · 세 성부'; f.voice = 0;
      const scale = f.bossMax / f.enc.hp;
      for (const name of CHOIR.voices) f.mobs.push({ id: f.nextId++, name, elite: true, hp: CHOIR.voiceHp * scale, max: CHOIR.voiceHp * scale, alive: true });
      const boss = CHOIR.bossHp * scale;
      f.mobs.push({ id: f.nextId++, name: '지휘자', elite: true, boss: true, hp: boss, max: boss, alive: true });
      skill(f, { key: 'auto', hidden: true, next: 2, period: 2, cast: 0, fire(f) { const tk = aggroTarget(f); if (tk) autoHit(f, tk, CHOIR.auto); } });
      skill(f, {
        key: 'baton', name: '지휘봉', icon: '지휘', kind: 'buster', next: 9, period: 18, cast: 2, warn: 'buster', dmg: CHOIR.baton,
        target(f) { const tk = aggroTarget(f); return tk ? [tk.id] : []; },
        hit(f, tel) { for (const id of tel.units) { const u = unitById(f, id); if (u) damage(f, u, tel.skill.dmg!, false, 'tank'); } },
      });
      skill(f, {
        key: 'crescendo', name: '크레센도', icon: '크레', kind: 'zone', next: 12, period: 15, cast: 3, dps: CHOIR.crescDps * (f.mythic ? CHOIR.discord : 1), dur: 5, warn: 'zone',
        active: f => f.phase === 1 && f.mobs.some((m, i) => i < 3 && m.alive),
        // 살아 있는 성부를 왼쪽부터 차례로. 악몽 「불협화음」은 두 성부 동시 (4열, 열마다 피해 ×0.7)
        cellsFor(f) {
          const alive = [0, 1, 2].filter(i => f.mobs[i].alive);
          const order = alive.filter(i => i >= f.voice!).concat(alive.filter(i => i < f.voice!));
          const pick = order.slice(0, f.mythic ? 2 : 1);
          f.voice = (pick[pick.length - 1] + 1) % 3;
          const cols = new Set(pick.flatMap(i => [i * 2, i * 2 + 1]));
          return new Set(f.cells.filter(c => cols.has(c.col)).map(c => c.i));
        },
      });
      f.forte = skill(f, {
        key: 'forte', name: '포르테', icon: '포르', kind: 'aoe', next: Infinity, period: 25, cast: 3, warn: 'aoe', active: f => f.phase === 2,
        hit(f) { for (const u of living(f)) damage(f, u, CHOIR.forte, true); },
      });
      f.solo = skill(f, {
        key: 'solo', name: '독창', icon: '독창', kind: 'instant', next: Infinity, period: 20, cast: 0, active: f => f.phase === 2, cut: true,
        fire(f) { for (const u of randomTargets(f, CHOIR.soloN, u => !u.debuffs.some(d => d.name === '독창'))) addDebuff(f, u, { name: '독창', type: '마법', left: CHOIR.soloSec }); },
      });
    },
    update(f) {
      if (f.phase === 1) {
        // 노래: 살아 있는 성가대원이 맡은 2열에 선 사람 초당 피해 (상시)
        const cols = new Set([0, 1, 2].filter(i => f.mobs[i].alive).flatMap(i => [i * 2, i * 2 + 1]));
        for (const u of living(f)) if (cols.has(cellOf(f, u).col)) damage(f, u, CHOIR.song * DT, true);
        if (!cols.size) {
          f.phase = 2; f.phaseName = '2페이즈 · 마지막 악장';
          f.forte!.next = f.t + 8; f.solo!.next = f.t + 5;
          emit(f, { type: 'phase', text: '2페이즈: 지휘자가 직접 지휘' });
        }
      }
      enrageAt(f, '대합창', 3, 200);
    },
  },
};

/** 무음 성가대 수치 (26 4-3, 보통 기준. 피해는 난이도·단계 배율을 곱함) */
export const CHOIR = {
  voices: ['높은 성부', '가운데 성부', '낮은 성부'], voiceHp: 4000, bossHp: 30000,
  auto: 70, baton: 600, song: 4, crescDps: 35, discord: 0.7, forte: 170, soloN: 3, soloSec: 6, soloDmg: 200,
};

export function initBoss(f: Fight): void {
  SCRIPTS[f.enc.script].init(f);
}

/** 보스 진행: 기술 예고 → 적중 */
export function bossTick(f: Fight): void {
  SCRIPTS[f.enc.script].update(f);
  for (const s of f.skills) {
    if (f.t + 1e-9 < s.next) continue;
    s.next += s.period;
    if (!s.active(f)) continue;
    if (f.abOn) {
      // 파티원 능력 (17 7장): 기절한 적은 기술을 안 씀, 끊기 가능 기술은 시전 시작에 끊길 수 있음
      if (s.mob != null && (f.mobs.find(m => m.id === s.mob)?.stun || 0) > f.t) continue;
      if (abCut(f, s)) continue;
    }
    if (s.cast <= 0) { s.fire!(f); continue; }
    const tel: Telegraph = { id: f.nextId++, skill: s, kind: s.kind, start: f.t, impact: f.t + s.cast, units: s.target ? s.target(f) : [], cells: s.cellsFor ? s.cellsFor(f) : new Set(), dps: s.dps, dur: s.dur };
    f.tels.push(tel);
    if (f.abOn) abOnTel(f, tel);
    if (f.aff) affChaos(f, tel);
    if (s.warn) emit(f, { type: 'sound', name: s.warn });
    if (tel.kind === 'zone' && f.tels.includes(tel)) scheduleReactions(f, tel);
  }
  for (const tel of f.tels.filter(t => t.impact <= f.t + 1e-9)) {
    if (tel.kind === 'zone') {
      f.zones.push({ id: tel.id, cells: tel.cells, end: f.t + tel.dur!, dps: tel.dps! });
    } else tel.skill.hit!(f, tel);
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
}

/** 화면 상단 보스 기술 예고: 다음 3개 */
export function queue(f: Fight): QueueEntry[] {
  const list: QueueEntry[] = [];
  for (const t of f.tels) list.push({ name: t.skill.name, icon: t.skill.icon, kind: t.kind, impact: t.impact, start: t.start, casting: true });
  for (const s of f.skills) {
    if (s.hidden || s.next === Infinity) continue;
    let n = s.next;
    for (let i = 0; i < 3; i++) {
      const imp = n + s.cast;
      if (imp - f.t < 120 && s.active(f)) list.push({ name: s.name, icon: s.icon, kind: s.kind, impact: imp, casting: false });
      n += s.period;
    }
  }
  list.sort((a, b) => a.impact - b.impact);
  return list.slice(0, 3);
}
