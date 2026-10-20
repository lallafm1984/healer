/**
 * 어그로 (96 문서, Lim 10-18 「1A · 2C · 3A · 4B · 5A · 6A · 7B」): 보스는 「최근 위협」이 가장 큰 사람을 친다.
 * - 딜러 위협 = 보스에게 준 딜 (반감기 5초라 최근 10초만). 탱커 위협 = 그동안 딜러들이 준 딜의 평균 × K (판 · 보스마다 딜 크기가 달라도
 *   보통 딜러 = 탱커의 1/K로 같게) × 기술 숙련 · 집중 · 어그로 흘림. 나 (힐러) = 넣은 치유 전부 (넘친 치유 포함) ÷ 파티가 받은 피해 × H.
 * - 딜러 · 나 (힐러)의 위협이 보스를 잡은 탱커의 위협 × 여유를 넘으면 보스가 그 사람을 친다 (평타 · 예고 없는 탱커 기술만, 강타 예고는 그대로 탱커).
 * - 능력치 (97 FM): 탱커 기술 숙련 = 쌓는 양 · 되찾기까지 조금, 집중 = 이동 · 생존기 · 강타 1초 동안 쌓기, 반응 = 되찾기까지 (4~8초, 그동안 보스는 뺏은 사람을 침), 딜러 판단 = 딜 줄이기 시작 · 침착 = 뺏은 뒤 딜 멈추기까지.
 * - 레벨 차이: 탱커보다 1레벨 높을 때마다 위협 +4% (×0.6 ~ ×2).
 * 튜토리얼 · 프로토타입 · 파티원 능력이 없는 판 (옛 시드 파티) · 일반 · 정예 구간 · 탱커 없는 파티는 끔.
 */
import { STAT_ACT, THREAT } from '../data/rules';
import { clumsy, lerp3, sharp } from '../data/fm';
import { holdGuard } from './abilities';
import { hexDist } from './board';
import { aggroTarget } from './bossParts';
import { bark, cellOf, DT, emit, living, regrouping, slip } from './core';
import { dangerAt, moveTo } from './movement';
import type { BarkSit } from '../data/talk/sits';
import type { Fight, Unit } from './types';

export interface ThreatState {
  /** 사람마다 위협 (유닛 id → 값) */
  v: Map<number, number>;
  /** 보스를 잡은 탱커 */
  holder: number | null;
  /** 보스를 뺏은 사람: at = 뺏은 때, stopAt = 딜러가 딜을 멈추는 때 (침착) */
  steal: { id: number; at: number; stopAt: number; stopFor?: number; cut?: number; breakUntil?: number } | null;
  /** 탱커가 되찾는 때 (반응) · 되찾기를 다시 쓸 수 있는 때 · 되찾은 횟수 */
  retakeAt: number | null;
  readyAt: number;
  retakes: number;
  /** 뺏기 직전 (선의 90%)인 딜러 (판 위 주황 테두리) */
  warn: number[];
  /** 내 위협 ÷ 뺏는 선 (화면에는 안 보임, 2026-10-19 Lim 「어그로 게이지는 보이지 않게」) */
  me: number;
  /** 경고 대사를 한 딜러 · 그 시각 */
  warned: Map<number, number>;
  /** 「딜 줄임」 대사를 한 딜러 · 그 시각 (선 근처에서 줄였다 풀었다 할 때마다 말하지 않게) */
  eased: Map<number, number>;
  /** sim 보정용: 딜러 · 나의 위협 ÷ 탱커 위협 합 · 틱 수 (시작 5초 뒤부터) */
  acc: { d: number; dn: number; me: number; mn: number };
  /** 이번 틱 딜러들이 보스에게 준 딜 (탱커 위협 바탕) · 보통 탱커 위협 (능력치 · 성격 없이) */
  inc: number;
  vN: number;
  /** 최근 내 치유 (넘친 치유 포함) · 파티가 받은 피해 (반감기 같음) */
  heal: number;
  taken: number;
  /** 받은 피해 바닥 (파티 최대 체력 합 × healFloor): 시작 · 아무도 안 다친 때 지속 힐 틱으로 튀지 않게 */
  floor: number;
  /** 선을 넘은 때 (dwell초 동안 넘어 있어야 뺏음: 딜 한 방 · 큰 힐 한 번으로 바로 튀지 않게) */
  over: Map<number, number>;
}

/** 이 판에 어그로를 켜나 */
export function threatOn(f: Fight): boolean {
  return !f.cfg.proto && f.party.some(u => !!u.ab) && f.party.some(u => u.role === 'tank');
}

export function threatInit(f: Fight): void {
  f.thr = threatOn(f) ? {
    v: new Map(), holder: null, steal: null, retakeAt: null, readyAt: 0, retakes: 0, warn: [], me: 0, warned: new Map(), eased: new Map(), acc: { d: 0, dn: 0, me: 0, mn: 0 },
    inc: 0, vN: 0, heal: 0, taken: 0, over: new Map(), floor: f.party.reduce((a, u) => a + u.max, 0) * THREAT.healFloor,
  } : null;
}

/** 여유 (뺏는 선 = 탱커 위협 × 여유): 쉬움 · 3인 1.4, 보통 1.3, 어려움 1.2, 악몽 1.15 (THREAT.leeway) */
export function leewayOf(f: Fight): number {
  if (f.party.length <= 3) return THREAT.leeway['쉬움'];
  return THREAT.leeway[f.cfg.diff];
}

const lvOf = (f: Fight, u: Unit) => u.lv ?? f.cfg.stageLv ?? 1;
/** 레벨 차이 보정: 탱커보다 1레벨 높을 때마다 +4% */
export function levelMult(f: Fight, u: Unit, tank: Unit): number {
  return Math.max(THREAT.lvMin, Math.min(THREAT.lvMax, 1 + THREAT.lvStep * (lvOf(f, u) - lvOf(f, tank))));
}

const stat = (u: Unit, k: 'skill' | 'focus' | 'react' | 'judgment' | 'composure') => u.fmStats?.[k] ?? 10;

/** 딜러가 딜을 줄이기 시작하는 때 (뺏는 선의 몇 %): 판단 1 → 안 줄임 · 10 → 85% · 20 → 70%. 성격이 판단을 바꿈 */
export function easeAt(u: Unit): number {
  const a = u.p.aggro;
  const j = a?.judge != null ? a.judge : stat(u, 'judgment') + (a?.judgeUp ?? 0);
  return lerp3(j, THREAT.easeNever, THREAT.easeAt, THREAT.easeBest);
}

/** 딜을 줄이지 않는 때 (경쟁심이 1위를 쫓는 동안 · 다혈질 분노 · 폭주기관차 폭주) */
function noEase(f: Fight, u: Unit): boolean {
  const ps = u.ps, p = u.p;
  if (!ps || !p.aggro?.noEase) return false;
  if (p.rival && ps.rivalOn) return true;
  if (p.rage && ps.rageUntil != null && f.t < ps.rageUntil) return true;
  if (p.burst && (f.t % p.burst.every) >= p.burst.every - p.burst.sec - 1e-9) return true;
  return false;
}

/** 딜러가 보스에게 준 딜 (fight.ts partyHits, 쫄 · 몸통 말고 보스 몫만). 레벨 차이는 비교할 때 곱함 */
export function dealerThreat(f: Fight, u: Unit, amt: number): void {
  const t = f.thr!;
  t.v.set(u.id, (t.v.get(u.id) ?? 0) + amt * (u.wob != null ? 1 + STAT_ACT.dealerThreat * sharp(u.fmStats?.atk ?? 10) : 1)); // 99 마: 압도적으로 센 딜러
  t.inc += amt;
}

interface StealHabit { stopFor: number; cut: number; panic: number; guard: number }
/**
 * 99 마 · Codex 검토 반영 1: 뺏은 딜러는 판단으로 고르고 (멈출지 · 얼마나), 침착으로 해냄 (당황 = panic, 0~1). 예전엔 둘의 평균.
 * - 판단 · 침착 ↑ (둘 다 15 넘음): 멈추고 기다리며 guard (잘함 중 작은 쪽) 확률로 방어 생존기를 켜고 버팀
 * - 판단 ↑ · 침착 ↓: 멈추기로 했지만 당황해 한 대 더 치고 이동을 머뭇거림
 * - 판단 ↓ · 침착 ↑: 차분히 계속 때림 (되찾기가 늦음)
 * - 판단 ↓ · 침착 ↓: 딜이 끊기고 자리를 잃음 (힐러가 먼저 챙길 사람)
 * 능력치가 없으면 예전 (stopSec · ease)
 */
function stealHabit(u: Unit): StealHabit {
  if (u.wob == null) return { stopFor: THREAT.stopSec, cut: THREAT.ease, panic: 0, guard: 0 };
  const j = stat(u, 'judgment'), c = stat(u, 'composure');
  const panic = clumsy(c), guard = Math.min(sharp(j), sharp(c));
  if (j >= 15) return { stopFor: sharp(j) >= 1 ? Infinity : THREAT.stopSec + sharp(j) * 6, cut: THREAT.ease, panic, guard };
  const cj = clumsy(j);
  return { stopFor: THREAT.stopSec * Math.max(0, 1 - 2 * cj), cut: THREAT.ease * (1 - cj), panic, guard };
}

/** 딜러가 쫄에게 준 딜: 위협은 없고 탱커 위협 바탕 (파티 딜 속도)에만 들어감. 쫄을 치는 동안 보스만 치는 사람 (외골수)이 튀지 않게 */
export function dealerOutput(f: Fight, amt: number): void {
  f.thr!.inc += amt;
}

/** 내 치유 전부 (넘친 치유 포함, core heal). 주시 (P-AGGRO)가 있는 보스는 주시만 */
export function healThreat(f: Fight, amt: number): void {
  if (!f.watch) f.thr!.heal += amt;
}

/** 파티가 받은 피해 (core damage, 체력이 실제로 준 양) */
export function takenThreat(f: Fight, amt: number): void {
  f.thr!.taken += amt;
}

/** 탱커가 보스를 노리지 못하는 동안 (이동 · 생존기 · 강타를 맞은 1초 (맷집으로 버티면 빼고) · 멍한 동안 (99 집중) · 휘청 (99 맷집)): 집중이 낮을수록 위협을 덜 쌓음 */
function busy(f: Fight, u: Unit): boolean {
  return !!u.moving || (u.dazeUntil != null && f.t < u.dazeUntil) || (u.staggerUntil != null && f.t < u.staggerUntil) || (u.busterAt != null && f.t - u.busterAt < 1 && !(u.steadyAt != null && f.t - u.steadyAt < 1)) || u.mods.some(m => m.by === u.id && m.until > f.t && (m.k === 'cut' || m.k === 'mcut' || m.k === 'imm' || m.k === 'spell'));
}

/** 어그로 흘림 (A안): first초부터 every초마다 sec초 동안 위협 쌓기가 멈춤 (딴생각) */
export function slipping(f: Fight, u: Unit): boolean {
  const s = u.p.slip;
  if (!s || f.t < s.first) return false;
  return ((f.t - s.first) % s.every) < s.sec - 1e-9;
}

/** 탱커 한 틱 위협 배율 (보통 탱커 = 1): 기술 숙련 × 집중 (이동 · 생존기 · 강타 1초 동안) × 어그로 흘림 (딴생각 동안 0) */
function tankMult(f: Fight, u: Unit): number {
  if (!u.alive || u.lift || (u.sleep != null && u.sleep > f.t) || slipping(f, u)) return 0;
  const skill = lerp3(stat(u, 'skill'), THREAT.skill[0], 1, THREAT.skill[1]) * (u.wob != null ? (1 - STAT_ACT.tankThreat * clumsy(stat(u, 'skill'))) * (1 + STAT_ACT.tankDps * sharp(u.fmStats?.atk ?? 10)) : 1); // 99 나: 15보다 낮으면 초보만큼 덜 쌓음 · 99 다: 딜 잘하는 탱커는 그만큼 더
  const focus = busy(f, u) ? lerp3(stat(u, 'focus'), THREAT.focus[0], THREAT.focus[1], 1) : 1;
  return skill * focus * (u.p.slip?.dps ?? 1);
}

/**
 * 내 위협 ÷ 탱커 위협 (1을 넘고 여유까지 넘으면 뺏음): H × √(치유 ÷ 받은 피해) × 레벨 차이 ÷ (탱커 위협 ÷ 보통 탱커 위협).
 * 제곱근: 넘친 치유가 많은 판 (지속 힐 · 광역 힐이 몰리는 보스)마다 너무 벌어지지 않게. 레벨이 높아 힐이 크면 넘친 치유 · 레벨 차이가 함께 올라 뺏음
 */
function healerRaw(f: Fight, tank: Unit): number {
  const t = f.thr!, vT = t.v.get(tank.id) ?? 0;
  if (f.watch || vT <= 0) return 0;
  return THREAT.heal * Math.sqrt(t.heal / Math.max(t.taken, t.floor)) * levelMult(f, f.me, tank) * (t.vN / vT);
}

/** 되찾기까지 (초): 반응 1 → 8 · 10 → 6 · 20 → 4, 기술 숙련 1 → × 1.1 · 20 → × 0.9, 4~8초. 뉴비는 처음 보는 보스에서 느림, 끈기형은 길어질수록 빠름 */
export function retakeDelay(f: Fight, u: Unit): number {
  let d = lerp3(stat(u, 'react'), THREAT.retake[0], THREAT.retake[1], THREAT.retake[2]) * lerp3(stat(u, 'skill'), THREAT.retakeSkill[0], 1, THREAT.retakeSkill[1]);
  if (u.p.learn) d *= u.p.learn.react;
  if (u.p.grit) d *= Math.max(u.p.grit.min, 1 - u.p.grit.step * Math.floor(f.t / u.p.grit.every));
  return Math.max(THREAT.retakeMin, Math.min(THREAT.retakeMax, d));
}
/** 되찾기까지 (실제로 쓰는 값): 99 나 꾸준함 흔들림 (평균 1)을 더함 */
function retakeAfter(f: Fight, u: Unit): number {
  const d = retakeDelay(f, u);
  return u.wob ? Math.max(THREAT.retakeMin * 0.75, d * (1 + STAT_ACT.react * u.wob * (2 * f.rng() - 1))) : d;
}

/** 딜러가 뺏은 뒤 딜을 멈추기까지 (초): 침착 1 → 2 · 10 → 1 · 20 → 바로 */
const calmDelay = (u: Unit) => lerp3(stat(u, 'composure'), THREAT.calm[0], THREAT.calm[1], 0);

/** 보스가 칠 사람 (평타 · 예고 없는 탱커 기술): 뺏은 사람이 있으면 그 사람, 아니면 aggroTarget */
export function bossTarget(f: Fight): Unit | null {
  const st = f.thr?.steal;
  if (st) {
    const u = f.party.find(x => x.id === st.id);
    if (u && u.alive && !u.lift && !(u.sleep != null && u.sleep > f.t)) return u;
  }
  return aggroTarget(f);
}

/**
 * 딜 배율 (units unitDps): 뺏은 딜러는 침착만큼 지나면 딜을 멈추고 (stopSec초), 되찾을 때까지 줄여서 침 · 선 가까이에서 줄인 동안 1 − ease.
 * 되찾기가 4~8초라 그동안 내내 멈추면 판 딜이 너무 빠져서 멈춤은 처음 몇 초만 (2026-10-19)
 */
export function threatDps(f: Fight, u: Unit): number {
  const t = f.thr;
  if (!t) return 1;
  if (t.steal && t.steal.id === u.id && addsUp(f, u)) return 1; // Codex 검토 반영 2: 뺏은 딜러는 쫄 · 감옥이 있으면 그쪽을 계속 침 (쫄 딜은 보스 위협이 안 됨, dealerOutput)
  if (t.steal && t.steal.id === u.id && t.steal.breakUntil != null && f.t < t.steal.breakUntil) return 0; // 99 마: 당황해 딜이 끊김
  if (t.steal && t.steal.id === u.id && f.t >= t.steal.stopAt) return f.t < t.steal.stopAt + (t.steal.stopFor ?? THREAT.stopSec) ? 0 : 1 - (t.steal.cut ?? THREAT.ease);
  return u.thrEase ? 1 - THREAT.ease : 1;
}

/** 이 딜러의 한 방이 쫄 · 감옥으로 가나 (fight.ts land와 같은 길: 몸통 판이 아니고, 살아 있는 쫄이 있고, 외골수가 아님) */
export const addsUp = (f: Fight, u: Unit): boolean => u.role !== 'tank' && !f.bodyHp && !(u.p.oneTrack && !f.invuln) && f.mobs.some(m => m.alive && m.add);

/** 한 틱 (fight.ts step, partyHits 뒤) */
export function threatTick(f: Fight): void {
  const t = f.thr!;
  const decay = Math.pow(0.5, DT / THREAT.half);
  for (const [id, x] of t.v) t.v.set(id, x * decay);
  t.vN *= decay; t.heal *= decay; t.taken *= decay;
  // 탱커: 이번 틱 딜러 한 사람 몫의 딜 × K × 배율
  const dealers = living(f).filter(u => u.role !== 'tank' && !u.me).length;
  const inc = t.inc / Math.max(1, dealers) * THREAT.tank;
  t.inc = 0;
  t.vN += inc;
  for (const u of f.party) if (u.role === 'tank' && u.alive) { const m = tankMult(f, u); if (m) t.v.set(u.id, (t.v.get(u.id) ?? 0) + inc * m); }
  const base = f.bodyHp ? null : aggroTarget(f);
  if (!base || base.role !== 'tank') { endSteal(f); t.warn = []; t.me = 0; t.holder = base?.role === 'tank' ? base.id : null; return; }
  // 보스를 받은 탱커가 바뀜 (교대 · 띄우기 · 별의 잠 · 쓰러짐): 지금 탱커의 위협을 이어받음
  if (t.holder !== base.id) {
    if (t.holder != null) t.v.set(base.id, Math.max(t.v.get(base.id) ?? 0, t.v.get(t.holder) ?? 0));
    t.holder = base.id;
  }
  const vT = t.v.get(base.id) ?? 0, L = leewayOf(f);
  /** 위협 ÷ 탱커 위협 (1을 넘으면 탱커보다 큼, 여유를 넘으면 뺏음) */
  const raw = (u: Unit) => (u.me ? healerRaw(f, base) : vT > 0 ? ((t.v.get(u.id) ?? 0) * levelMult(f, u, base)) / vT : 0);
  t.warn = [];
  let top: Unit | null = null, topR = 0;
  for (const u of living(f)) {
    if (u.role === 'tank' || u.lift) continue;
    const rw = raw(u), r = rw / L;
    if (f.t > 5) { if (u.me) { t.acc.me += rw; t.acc.mn++; } else { t.acc.d += rw; t.acc.dn++; } }
    if (u.me) { t.me = r; }
    else if (u.thrCool != null && f.t < u.thrCool) { u.thrEase = true; t.over.delete(u.id); continue; } // 뺏었다 돌려준 뒤: 한동안 딜을 줄이고 조심함
    else {
      if (r >= THREAT.warn) {
        t.warn.push(u.id);
        if (f.t - (t.warned.get(u.id) ?? -99) > THREAT.warnGap && !t.steal) { t.warned.set(u.id, f.t); if (f.rng() <= 0.6) aggroBark(f, base, 'aggroWarn', u); }
      }
      // 딜 줄이기 (판단): 선 가까이 오면 25% 줄이고, 조금 내려가면 다시. 보스를 뺏은 사람은 뺏은 뒤 버릇 (stealHabit, 99 마)대로
      const at = easeAt(u);
      if (t.steal?.id === u.id && u.wob != null) u.thrEase = false;
      else if (!u.thrEase && r >= at && !noEase(f, u)) {
        u.thrEase = true;
        if (f.t - (t.eased.get(u.id) ?? -99) > THREAT.easeGap) { t.eased.set(u.id, f.t); bark(f, u, null, false, 'aggroEase'); }
      }
      else if (u.thrEase && (r < at - THREAT.easeBack || noEase(f, u))) u.thrEase = false;
    }
    if (r > 1) { if (!t.over.has(u.id)) t.over.set(u.id, f.t); } else t.over.delete(u.id);
    if (r > topR && f.t - (t.over.get(u.id) ?? Infinity) + 1e-9 >= THREAT.dwell) { topR = r; top = u; }
  }
  if (t.steal) {
    const s = t.steal, who = f.party.find(x => x.id === s.id);
    if (!who || !who.alive) { f.stats.stealDeaths = (f.stats.stealDeaths ?? 0) + 1; endSteal(f); return; } // 쓰러짐
    // 되찾을 때까지 보스는 그 사람을 봄 (위협이 식어도 저절로 안 돌아감): 판 위 주황 띠도 그 사람에게 (내가 뺏으면 띠 없음)
    if (!who.me && !t.warn.includes(who.id)) t.warn.push(who.id);
    if (t.retakeAt != null && f.t + 1e-9 >= t.retakeAt) { // 되찾기 (모든 탱커의 기본 행동, 재사용 8초): 탱커 위협 = 뺏은 사람의 1.1배
      t.v.set(base.id, raw(who) * vT * THREAT.retakeMult);
      t.readyAt = f.t + THREAT.retakeCd; t.retakes++;
      aggroBark(f, base, !who.me && t.retakes >= THREAT.levelBarkAt ? 'aggroLevel' : 'aggroRegain'); // 「딜러 레벨 차이」 대사는 딜러가 뺏었을 때만
      emit(f, { type: 'aggro', id: base.id, from: s.id });
      endSteal(f);
    }
    return;
  }
  if (f.t < THREAT.start || !top) return;
  // 뺏음: 보스가 그 사람을 봄
  const hb = top.me ? null : stealHabit(top);
  const stops = !!hb && hb.stopFor > 0;
  t.steal = { id: top.id, at: f.t, stopAt: top.me ? Infinity : f.t + calmDelay(top) + (stops ? STAT_ACT.panicHit * hb!.panic : 0), ...(hb ? { stopFor: hb.stopFor, cut: hb.cut } : {}) };
  // 99 마: 판단이 낮아 계속 때리는 딜러면 탱커가 되찾기 어려움
  const ign = hb && top.wob != null ? clumsy(stat(top, 'judgment')) : 0;
  t.retakeAt = Math.max(f.t + retakeAfter(f, base) * (1 + STAT_ACT.ignoreRetake * ign), t.readyAt);
  top.thrEase = false;
  if (top.me) f.stats.healerSteals = (f.stats.healerSteals ?? 0) + 1; else f.stats.steals = (f.stats.steals ?? 0) + 1;
  let shape: 'guard' | 'panic' | 'lost' | null = null; // Codex 검토 반영 1: 판단 × 침착 네 모양
  if (hb && stops && hb.guard > 0 && f.rng() < hb.guard && holdGuard(f, top)) shape = 'guard';
  else if (hb && stops && hb.panic > 0 && !regrouping(f, top)) { top.hesitUntil = f.t + STAT_ACT.hesit * hb.panic; if (hb.panic >= 0.2) { shape = 'panic'; slip(f, top); } }
  else if (hb && !stops && !regrouping(f, top) && f.rng() < STAT_ACT.stealLost * clumsy(stat(top, 'judgment')) * hb.panic && loseSpot(f, top)) { t.steal.breakUntil = f.t + STAT_ACT.breakSec; shape = 'lost'; slip(f, top); }
  const high = lvOf(f, top) - lvOf(f, base) >= THREAT.highLv; // 고렙이 뺏음 (레벨 차이만으로 선을 넘음)
  if (top.me) aggroBark(f, base, high ? 'aggroHealerHigh' : 'aggroHealer'); // 고렙 힐러: 탱커가 감탄 · 농담
  else if (slipping(f, base)) aggroBark(f, base, 'aggroSlip'); // 어그로 흘림이 딴생각하다 놓침
  else {
    if (high) aggroBark(f, base, 'aggroDealerHigh', top); // 고렙 딜러: 탱커 한마디
    if (shape === 'lost') aggroBark(f, top, 'aggroLost'); // 99 마: 판단 · 침착 ↓ 딜 끊기고 자리 잃음
    else if (shape === 'panic') aggroBark(f, top, 'aggroPanic'); // 99 마: 판단 ↑ · 침착 ↓ 한 대 더 · 머뭇거림
    else if (stops && addsUp(f, top)) aggroBark(f, top, 'aggroAdds'); // Codex 검토 반영 2: 멈추는 대신 쫄 · 감옥으로
    else if (hb && hb.stopFor === Infinity || shape === 'guard') aggroBark(f, top, 'aggroHold'); // 99 마: 멈추고 기다림 (생존기를 켜고 버팀)
    else if (hb && hb.stopFor <= 0 && hb.cut < THREAT.ease * 0.5) aggroBark(f, top, 'aggroIgnore'); // 99 마: 계속 때림
    else aggroBark(f, top, high ? 'aggroStealHigh' : 'aggroSteal');
  }
  emit(f, { type: 'aggro', id: top.id, from: base.id });
}

/** 99 마 · Codex 검토 반영 1 (판단 · 침착 ↓): 당황해 옆 칸 (안전한 빈 칸)으로 자리를 잃음, 칸 위 「?」 · 그동안 제자리로 안 돌아감. 옮겼으면 true */
function loseSpot(f: Fight, u: Unit): boolean {
  if (u.moving || u.fleeing) return false;
  const at = cellOf(f, u), free = f.cells.filter(c => !c.unit && !c.block && !dangerAt(f, c.i) && hexDist(c, at) === 1);
  if (!free.length || !moveTo(f, u, free[Math.floor(f.rng() * free.length)])) return false;
  u.lostUntil = u.awayUntil = f.t + STAT_ACT.breakSec + 0.5;
  return true;
}

function endSteal(f: Fight): void {
  const t = f.thr!, who = t.steal ? f.party.find(u => u.id === t.steal!.id) : null;
  if (who && !who.me) who.thrCool = f.t + THREAT.cool;
  t.steal = null; t.retakeAt = null;
}

/**
 * 어그로 대사 (탱커 · 딜러 모두): 한 사람이 한 판에 첫 talkFirst번은 talkGap초 간격, 그 뒤는 talkLate초에 한 번 talkLateP 확률로만 (2026-10-19 Lim 「계속 어그로 뺏겨서 대사를 난발」).
 * ally가 있으면 {ally} 자리표시 (탱커 → 딜러)
 */
function aggroBark(f: Fight, u: Unit, sit: BarkSit, ally?: Unit): void {
  if (!u.alive || u.me) return;
  const n = u.aggroTalk ?? 0, last = u.aggroTalkAt ?? -99;
  if (n < THREAT.talkFirst ? f.t - last < THREAT.talkGap : f.t - last < THREAT.talkLate || f.rng() >= THREAT.talkLateP) return;
  u.aggroTalk = n + 1; u.aggroTalkAt = f.t; u.barkAt = f.t;
  if (!ally) { bark(f, u, null, true, sit); return; }
  emit(f, { type: 'bark', id: u.id, text: u.p.barks?.[0] || '', sit, ally: ally.id });
}
