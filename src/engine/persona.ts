/**
 * 성격 20종 추가 (75 문서, 2026-10-14): 전투 행동. 예전 10종은 movement · units · abilities에 그대로 있고,
 * 여기는 새 20종만 (u.ps가 있는 사람만). 새 성격이 없는 전투에서는 아무 일도 안 하고 난수도 안 씀 (프로토타입 일치).
 */
import { hexDist } from './board';
import { bark, cellOf, living } from './core';
import { dangerAt, moveTo } from './movement';
import type { Cell, Fight, Telegraph, Unit } from './types';

/** 성격 상태 (새 20종) */
export interface PersState {
  /** 미신쟁이: 명당 칸 · 지금 명당에 있는지 · 밀려난 벌이 끝나는 시각 */
  lucky?: number;
  onLucky?: boolean;
  luckLostUntil?: number;
  /** 방랑자: 다음에 옮길지 보는 시각 */
  wanderAt?: number;
  /** 따라쟁이: 다음에 탱커 옆인지 보는 시각 */
  followAt?: number;
  /** 영웅 · 이기주의자 · 응원단장: 다시 쓸 수 있는 시각 */
  ready?: number;
  /** 경쟁심: 1위가 아님 (무리하는 중) · 다음 판단 시각 */
  rivalOn?: boolean;
  rivalAt?: number;
  /** 다혈질: 분노가 끝나는 시각 */
  rageUntil?: number;
  /** 소심이: 당황이 끝나는 시각 · 다음에 허둥지둥 옮기는 시각 */
  panicUntil?: number;
  panicMoveAt?: number;
  /** 승부사 · 용두사미 · 대기만성: 말 한 번 했는지 */
  said?: boolean;
  /** 몰입형: 집중을 시작한 시각 */
  focusFrom?: number;
  /** 완벽주의자: 흔들림이 끝나는 시각 */
  shakenUntil?: number;
  /** 뉴비: 보스 기술마다 본 횟수 · 지금 반응하는 기술의 숙련 */
  seen?: Record<string, number>;
  lv?: number;
  /** 낙천가 · 비관론자: 다음 말 시각 */
  talkAt?: number;
}

const NEW_KEYS = ['slow', 'follow', 'wander', 'lucky', 'cover', 'selfish', 'cheer', 'rival', 'rage', 'calm', 'lateGuard', 'earlyGuard', 'panic', 'allIn', 'dash', 'warm', 'focus', 'perfect', 'learn'] as const;
/** 새 20종 성격인지 (눈치백단은 숫자만이라 상태 없음) */
export const isNewPers = (u: Unit): boolean => NEW_KEYS.some(k => k in u.p);

/** 전투 시작 (배치가 끝난 뒤): 상태를 만들고 명당을 정함 */
export function initPers(f: Fight): void {
  for (const u of f.party) {
    if (u.me || !isNewPers(u)) continue;
    const ps: PersState = {};
    if (u.p.lucky) { ps.lucky = u.home; ps.onLucky = true; }
    if (u.p.wander) ps.wanderAt = u.p.wander.every;
    if (u.p.focus) ps.focusFrom = 0;
    if (u.p.learn) { ps.seen = {}; ps.lv = 0; }
    u.ps = ps;
  }
  f.persOn = f.party.some(u => !!u.ps);
}

/** 따라쟁이 배치 점수: 가장 가까운 탱커 옆 칸 */
export function followPref(f: Fight, u: Unit, c: Cell): number {
  if (!u.p.follow) return 0;
  return f.party.some(v => v !== u && v.role === 'tank' && v.cell >= 0 && hexDist(f.cells[v.cell], c) === 1) ? 40 : 0;
}

// ---------- 배율 ----------
/** 딜 배율 */
export function persDps(f: Fight, u: Unit): number {
  const ps = u.ps;
  let m = 1;
  if (u.cheerUntil != null && f.t < u.cheerUntil) m *= 1 + (u.cheerUp ?? 0); // 응원단장이 응원해 줌 (누구든)
  if (!ps) return m;
  const p = u.p;
  if (ps.panicUntil != null && f.t < ps.panicUntil) return 0;
  if (p.lucky) { if (ps.onLucky) m *= 1 + p.lucky.up; else if (ps.luckLostUntil != null && f.t < ps.luckLostUntil) m *= 1 - p.lucky.down; }
  if (p.rival && ps.rivalOn) m *= 1 + p.rival.up;
  if (p.rage && ps.rageUntil != null && f.t < ps.rageUntil) m *= 1 + p.rage.up;
  if (p.allIn && !f.invuln && f.bossHp > 0 && f.bossHp <= f.bossMax * p.allIn.at) m *= 1 + p.allIn.up;
  if (p.dash) m *= f.t < p.dash.sec ? p.dash.up : p.dash.after;
  if (p.warm) m *= Math.min(p.warm.max, p.warm.start + p.warm.step * Math.floor(f.t / p.warm.every));
  if (p.focus) m *= 1 + Math.min(p.focus.max, p.focus.step * Math.floor((f.t - (ps.focusFrom ?? 0)) / p.focus.every));
  if (p.perfect) m *= ps.shakenUntil != null && f.t < ps.shakenUntil ? 1 - p.perfect.down : 1 + p.perfect.up;
  return m;
}

/** 회피 보정 (더함) */
export function persDodge(f: Fight, u: Unit): number {
  const ps = u.ps, p = u.p;
  if (!ps) return 0;
  let d = 0;
  if (p.rival && ps.rivalOn) d += p.rival.dodge;
  if (p.allIn && !f.invuln && f.bossHp > 0 && f.bossHp <= f.bossMax * p.allIn.at) d += p.allIn.dodge;
  if (p.learn) d += p.learn.dodge + p.learn.stepDodge * (ps.lv ?? 0);
  return d;
}

/** 반응 시간 배율. 뉴비는 이 예고의 기술을 몇 번 봤는지로 (보고 나면 1번 더 본 것) */
export function persReact(f: Fight, u: Unit, tel: Telegraph): number {
  const ps = u.ps, p = u.p;
  if (!ps) return 1;
  let m = 1;
  if (p.perfect && ps.shakenUntil != null && f.t < ps.shakenUntil) m *= p.perfect.react;
  if (p.learn) {
    const key = tel.skill.key || tel.skill.name || '?';
    const n = ps.seen![key] ?? 0;
    ps.lv = Math.min(p.learn.max, n);
    m *= p.learn.react * Math.pow(p.learn.stepReact, ps.lv);
    if (n < p.learn.max) {
      ps.seen![key] = n + 1;
      if (n + 1 === p.learn.max) bark(f, u, null, false, 'learned');
    }
  }
  return m;
}

/** 이동 시간 배율 (느림보) */
export const persMove = (u: Unit): number => u.p.slow ?? 1;

/** 분노 · 당황 중이면 장판을 안 피함 (분노) · 허둥지둥 (당황은 따로 움직임) */
export function persIgnoresZone(f: Fight, u: Unit): boolean {
  const ps = u.ps;
  return !!ps && ((ps.rageUntil != null && f.t < ps.rageUntil) || (ps.panicUntil != null && f.t < ps.panicUntil));
}

// ---------- 일이 생겼을 때 ----------
/** 맞음 (피해를 받은 뒤): 몰입형 처음부터 · 완벽주의자 흔들림 */
export function persHurt(f: Fight, u: Unit, amt: number): void {
  const ps = u.ps, p = u.p;
  if (!ps || amt <= 0) return;
  if (p.focus && amt > u.max * p.focus.hit) {
    const was = Math.min(p.focus.max, p.focus.step * Math.floor((f.t - (ps.focusFrom ?? 0)) / p.focus.every));
    ps.focusFrom = f.t;
    if (was >= 0.2) bark(f, u, null, false, 'focusBroken');
  }
  if (p.perfect && amt > u.max * p.perfect.hit && !(ps.shakenUntil != null && f.t < ps.shakenUntil)) {
    ps.shakenUntil = f.t + p.perfect.sec;
    bark(f, u, null, false, 'shaken');
  }
}

/** 누가 쓰러짐: 다혈질 분노 */
export function persDeath(f: Fight, dead: Unit): void {
  if (dead.me) return;
  for (const u of f.party) {
    if (!u.alive || u === dead || !u.ps || !u.p.rage) continue;
    const fresh = !(u.ps.rageUntil != null && f.t < u.ps.rageUntil);
    u.ps.rageUntil = f.t + u.p.rage.sec;
    if (fresh) bark(f, u, null, true, 'rage');
  }
}

/** 디버프가 걸림: 소심이 당황 */
export function persDebuff(f: Fight, u: Unit): void {
  if (!u.ps || !u.p.panic || u.me) return;
  if (!(u.ps.panicUntil != null && f.t < u.ps.panicUntil)) bark(f, u, null, true, 'panic');
  u.ps.panicUntil = f.t + u.p.panic;
  u.ps.panicMoveAt = f.t;
}

/** 체력 조건 생존 능력의 체력 기준 (낙천가 늦게 · 비관론자 일찍) */
export function persGuard(u: Unit, thr: number): number {
  if (u.p.lateGuard) return thr * u.p.lateGuard;
  if (u.p.earlyGuard) return Math.max(thr, u.p.earlyGuard);
  return thr;
}

// ---------- 0.2초마다 판단 (think 끝에서). 움직였으면 true ----------
export function persThink(f: Fight, u: Unit): boolean {
  const ps = u.ps, p = u.p;
  if (!ps) return false;
  const pct = u.hp / u.max;
  // 소심이: 당황 → 해제받았거나 시간이 지나면 진정, 그동안 1초마다 옆 빈 칸으로 허둥지둥
  if (ps.panicUntil != null) {
    if (f.t >= ps.panicUntil || !u.debuffs.length) { ps.panicUntil = undefined; bark(f, u, null, false, 'panicEnd'); }
    else if (f.t >= (ps.panicMoveAt ?? 0)) {
      ps.panicMoveAt = f.t + 1;
      const c = nearFree(f, u, 1, true);
      if (c) moveTo(f, u, c);
    }
    return ps.panicUntil != null;
  }
  // 미신쟁이: 명당을 떠나면 벌, 돌아오면 다시 복
  if (p.lucky) {
    const on = u.cell === ps.lucky;
    if (ps.onLucky && !on) { ps.onLucky = false; ps.luckLostUntil = f.t + p.lucky.sec; bark(f, u, null, false, 'luckLost'); }
    else if (!ps.onLucky && on) { ps.onLucky = true; bark(f, u, null, false, 'luckBack'); }
  }
  // 경쟁심: 1초마다 같은 역할 딜 1위인지
  if (p.rival && f.t >= (ps.rivalAt ?? 0)) {
    ps.rivalAt = f.t + 1;
    const top = f.party.filter(v => v.alive && !v.me && v.role === u.role && v !== u).every(v => v.dealt <= u.dealt);
    if (ps.rivalOn && top && f.t > 10) bark(f, u, null, false, 'rival');
    ps.rivalOn = !top;
  }
  // 승부사 · 용두사미 · 대기만성: 바뀌는 때 한 번 말함
  if (!ps.said) {
    if (p.allIn && !f.invuln && f.bossHp > 0 && f.bossHp <= f.bossMax * p.allIn.at) { ps.said = true; bark(f, u, null, true, 'allIn'); }
    else if (p.dash && f.t >= p.dash.sec) { ps.said = true; bark(f, u, null, true, 'tired'); }
    else if (p.warm && p.warm.start + p.warm.step * Math.floor(f.t / p.warm.every) >= p.warm.max - 1e-9) { ps.said = true; bark(f, u, null, true, 'warmUp'); }
  }
  // 낙천가 · 비관론자: 위기에 한마디 (20초에 한 번)
  if ((p.lateGuard && pct < 0.25) || (p.earlyGuard && pct < p.earlyGuard)) {
    if (f.t >= (ps.talkAt ?? 0)) { ps.talkAt = f.t + 20; bark(f, u, null, false, p.lateGuard ? 'optimist' : 'pessimist'); }
  }
  const ready = f.t >= (ps.ready ?? 0);
  // 영웅: 반경 r 아군이 위험하면 대신 맞아 줌
  if (p.cover && ready && pct >= 0.4) {
    const c = cellOf(f, u);
    const v = living(f).filter(x => x !== u && !x.me && x.hp / x.max < p.cover!.hp && hexDist(cellOf(f, x), c) <= p.cover!.r && !(x.coverBy && f.t < x.coverBy.until))
      .sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (v) {
      v.coverBy = { id: u.id, until: f.t + p.cover.sec, share: p.cover.share };
      ps.ready = f.t + p.cover.cd;
      bark(f, u, null, true, 'cover');
    }
  }
  // 응원단장: 옆 아군이 위험하면 옆 아군 딜 +
  if (p.cheer && ready) {
    const c = cellOf(f, u);
    const near = living(f).filter(x => x !== u && !x.me && hexDist(cellOf(f, x), c) === 1);
    if (near.some(x => x.hp / x.max < p.cheer!.hp)) {
      for (const x of near) { x.cheerUntil = f.t + p.cheer.sec; x.cheerUp = p.cheer.up; }
      ps.ready = f.t + p.cheer.cd;
      bark(f, u, null, true, 'cheer');
    }
  }
  if (u.moving || u.react || u.pulled || (u.padUntil != null && u.padUntil > f.t)) return false;
  // 이기주의자: 옆 아군이 위험하면 혼자 떨어진 칸으로
  if (p.selfish && ready) {
    const c = cellOf(f, u);
    if (living(f).some(x => x !== u && !x.me && x.hp / x.max < p.selfish!.hp && hexDist(cellOf(f, x), c) === 1)) {
      const to = loneCell(f, u);
      if (to && moveTo(f, u, to)) {
        ps.ready = f.t + p.selfish.cd; u.home = to.i; u.homeAt = null;
        bark(f, u, null, true, 'selfish');
        return true;
      }
    }
  }
  // 방랑자: every초마다 chance로 근처 빈 칸 (거기가 새 자리)
  if (p.wander && f.t >= (ps.wanderAt ?? 0)) {
    ps.wanderAt = f.t + p.wander.every;
    if (f.rng() < p.wander.chance) {
      const to = nearFree(f, u, 2, true);
      if (to && moveTo(f, u, to)) { u.home = to.i; u.homeAt = null; bark(f, u, null, false, 'wander'); return true; }
    }
  }
  // 따라쟁이: 2초마다 가장 가까운 탱커 (없으면 가장 가까운 아군) 옆이 아니면 그 옆 빈 칸으로 (거기가 새 자리)
  if (p.follow && f.t >= (ps.followAt ?? 0)) {
    ps.followAt = f.t + 2;
    const c = cellOf(f, u);
    const lead = nearest(f, u, x => x.role === 'tank') || nearest(f, u, x => !x.me);
    if (lead && hexDist(cellOf(f, lead), c) > 1) {
      const lc = cellOf(f, lead);
      const to = f.cells.filter(x => !x.unit && !x.block && !dangerAt(f, x.i) && hexDist(x, lc) === 1).sort((a, b) => hexDist(a, c) - hexDist(b, c))[0];
      if (to && moveTo(f, u, to)) { u.home = to.i; u.homeAt = null; bark(f, u, null, false, 'follow'); return true; }
    }
  }
  return false;
}

/** 영웅이 대신 맞아 주는 몫 (맞을 피해에서 뺄 양). 영웅이 쓰러졌거나 시간이 지나면 0 */
export function coverPart(f: Fight, u: Unit, amt: number): { by: Unit; part: number } | null {
  const c = u.coverBy;
  if (!c || f.t >= c.until) return null;
  const by = f.party.find(x => x.id === c.id);
  if (!by || !by.alive || by === u) return null;
  return { by, part: amt * c.share };
}

// ---------- 칸 고르기 ----------
function nearest(f: Fight, u: Unit, ok: (v: Unit) => boolean): Unit | null {
  const c = cellOf(f, u);
  let best: Unit | null = null, bd = Infinity;
  for (const v of living(f)) {
    if (v === u || !ok(v)) continue;
    const d = hexDist(cellOf(f, v), c);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

/** 반경 r 안 안전한 빈 칸 중 무작위 1개 (rand면 난수, 아니면 가장 가까운 칸) */
function nearFree(f: Fight, u: Unit, r: number, rand: boolean): Cell | null {
  const c = cellOf(f, u);
  const list = f.cells.filter(x => !x.unit && !x.block && x.i !== u.cell && hexDist(x, c) <= r && !dangerAt(f, x.i));
  if (!list.length) return null;
  return rand ? list[Math.floor(f.rng() * list.length)] : list.sort((a, b) => hexDist(a, c) - hexDist(b, c))[0];
}

/** 옆 사람이 가장 적은 안전한 빈 칸 (같으면 가까운 곳) */
function loneCell(f: Fight, u: Unit): Cell | null {
  const cur = cellOf(f, u);
  const nearAt = (c: Cell) => f.party.filter(v => v !== u && v.alive && hexDist(f.cells[v.moving ? v.moving.to : v.cell], c) <= 1).length;
  let best: Cell | null = null, fewest = nearAt(cur);
  for (const c of f.cells) {
    if (c.block || c.unit || dangerAt(f, c.i)) continue;
    const n = nearAt(c);
    if (n < fewest || (n === fewest && best && hexDist(cur, c) < hexDist(cur, best))) { best = c; fewest = n; }
  }
  return best;
}

