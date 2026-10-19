import { hexDist } from './board';
import { bark, cellOf, living } from './core';
import { abMoved, dodgeMods, guardNow, moveMods, reactMods } from './abilities';
import { sv } from './specials';
import { calmDodge } from './talents';
import { posPref } from './position';
import { followPref, pairDodge, persDodge, persIgnoresZone, persLate, persMove, persPosPref, persReact } from './persona';
import type { Cell, Fight, Role, Telegraph, Unit, Zone } from './types';
import { STAT_ACT } from '../data/rules';
import { clumsy, sharp } from '../data/fm';

export type Zone3 = 'front' | 'mid' | 'back';

export function zoneOf(f: Fight, row: number): Zone3 {
  const x = f.rows === 1 ? 0 : row / (f.rows - 1);
  return x < 0.34 ? 'front' : x > 0.66 ? 'back' : 'mid';
}

/** 역할별 선호 줄 (04 5-2) */
export const ZONE_PREF: Record<Role, Record<Zone3, number>> = {
  tank: { front: 70, mid: 0, back: -40 },
  melee: { front: 20, mid: 15, back: -10 },
  ranged: { front: -10, mid: 5, back: 20 },
  healer: { front: -30, mid: 5, back: 25 },
};

export function adjAllies(f: Fight, cell: Cell, self: Unit): number {
  let n = 0;
  for (const c of f.cells) if (c.unit && c.unit !== self && c.unit.alive && hexDist(c, cell) === 1) n++;
  return n;
}

export function centerX(f: Fight): number {
  let a = Infinity, b = -Infinity;
  for (const c of f.cells) { a = Math.min(a, c.px); b = Math.max(b, c.px); }
  return (a + b) / 2;
}

export function dangerAt(f: Fight, idx: number, extra?: Set<number>): boolean {
  if (extra && extra.has(idx)) return true;
  for (const z of f.zones) if (z.cells.has(idx)) return true;
  for (const t of f.tels) if (t.kind === 'zone' && t.cells.has(idx) && !veiledSafe(f, t, idx)) return true;
  return false;
}

/** 신기루 피난처 (54 4-3): 걷히기 전에는 두 안전 칸 묶음이 모두 안전해 보임 (짝 예고의 안전 칸이면 위험하지 않음) */
function veiledSafe(f: Fight, t: Telegraph, idx: number): boolean {
  return t.veil != null && !!t.skill.mirrorCells && f.t < t.veil && f.tels.some(o => o !== t && o.skill === t.skill && o.veil === t.veil && !!o.safe?.has(idx));
}

export interface PickOpts {
  safe?: boolean;
  extra?: Set<number>;
  back?: boolean;
  home?: boolean;
}

/** 이동할 칸 고르기 (04 5-1) */
export function pickCell(f: Fight, u: Unit, opts: PickOpts): Cell | null {
  const cur = cellOf(f, u);
  let best: Cell | null = null, bs = -Infinity;
  for (const c of f.cells) {
    if (c.unit && c.unit !== u) continue;
    if (c.i === u.cell || c.block) continue;
    if (opts.safe && dangerAt(f, c.i, opts.extra)) continue;
    let s = 100;
    s += ZONE_PREF[u.role][zoneOf(f, c.row)] * (u.role === 'tank' ? 1 : 0.8);
    if (f.R.pos) s += posPref(f, u.role, c, 40); // 위치 규칙: 지키는 칸 쪽으로 (막히면 밖으로)
    s += (u.p.dist || 0) * adjAllies(f, c, u) * 8;
    s -= 10 * hexDist(cur, c);
    if (opts.back) s += c.row * 40 - adjAllies(f, c, u) * 5;
    if (opts.home && c.i === u.home) s += 60;
    if (u.p.follow) s += followPref(f, u, c) / 2; // 따라쟁이: 피할 때도 탱커 옆 (75)
    if (u.ps) s += persPosPref(f, u, c, opts.safe === true); // 앞장이 · 뒷줄파 · 짝꿍 · 모서리파 · 양보왕 · 집돌이 (95)
    s += f.rng() * (2 + (u.wob != null && u.role !== 'tank' && !u.me ? STAT_ACT.posNoise * clumsy(u.fmStats?.position ?? 10) : 0)); // 99 위치 잡기: 15 밑은 나쁜 자리도 고름
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}

export function moveTo(f: Fight, u: Unit, c: Cell | null): boolean {
  if (!c) return false;
  const from = cellOf(f, u);
  let time = 0.4 * Math.max(1, hexDist(from, c));
  if (u.mods.length) time *= moveMods(u); // 치타의 상·돌진
  if (f.sp && !u.me) time *= 1 - sv(f, 'march'); // 신나는 행진 (42 지원 07)
  if (u.ps) time *= persMove(u); // 느림보 (75)
  if (u.fm) time *= u.fm.move; // 발놀림 (97 FM)
  if (u.wob != null) time *= 1 + STAT_ACT.slowMove * clumsy(u.fmStats?.agility ?? 10); // 99 라: 15보다 낮으면 더 느림
  if (u.did) u.did.move++;
  c.unit = u;
  u.moving = { from: from.i, to: c.i, left: time, total: time };
  return true;
}

export function finishMove(f: Fight, u: Unit): void {
  const m = u.moving!;
  f.cells[m.from].unit = null;
  u.cell = m.to;
  u.moving = null;
  if (u.ab) abMoved(f, u); // 연발 사격
}

/** 장판 예고에 대한 반응 예약 */
export function scheduleReactions(f: Fight, tel: Telegraph): void {
  for (const u of living(f)) scheduleReaction(f, tel, u);
}

/** 한 사람의 반응 예약 (예고가 뜰 때 · 띄워졌다가 장판 위에 내려앉았을 때) */
export function scheduleReaction(f: Fight, tel: Telegraph, u: Unit): void {
  const pos = u.moving ? u.moving.to : u.cell;
  const inZ = tel.cells.has(pos);
  let rt = 0.8 * f.diff.react * (u.p.react || 1);
  if (u.me) rt = 0.6 * f.diff.react;
  rt *= u.senseReact; // 눈치 자질 (17 9-1)
  if (u.mods.length) rt *= reactMods(u); // 기합·매의 눈
  if (f.sp && !u.me) rt = Math.max(0.1, rt - sv(f, 'quickPeer')); // 눈치 빠른 동료 (42 지원 09)
  if (f.mood != null && f.t < f.mood && !u.me) rt *= f.moodReact!; // 분위기메이커 (95): 시작 10초 모두
  if (u.fm && u.fm.focus > 0 && bigStage(f)) rt *= 1 - u.fm.focus; // 집중 (97 FM): 악몽 · 레이드 · 보스 30% 아래
  // 능력치 (99 가): 꾸준함이 15보다 낮으면 예고마다 들쭉날쭉 (평균 1, 폭 = wob). 15 이상은 예전처럼 늘 같은 값 (다 같이 정확히)
  // 늦어진 쪽은 터지기 직전 (lastCall초 전)까지만: 예전 시간에 피하던 사람이 흔들림 때문에 맞지는 않게 (늦게 피함은 못 피한 모양에서)
  if (u.wob && inZ) {
    const j = rt * (1 + STAT_ACT.react * u.wob * (2 * f.rng() - 1));
    rt = Math.max(STAT_ACT.minReact, j > rt ? Math.min(j, Math.max(rt, tel.impact - f.t - STAT_ACT.lastCall)) : j);
  }
  if (inZ && u.hesitUntil != null && f.t < u.hesitUntil) rt += u.hesitUntil - f.t; // 99 마: 보스를 뺏고 당황해 머뭇거림 (침착 15 밑)
  if (u.ps && inZ) {
    rt = rt * persReact(f, u, tel) + persLate(f, u); // 뉴비 · 완벽주의자 · 끈기형 (75 · 95) · 끊기 욕심 (95)
    if (u.p.foresee) rt = Math.max(0.05, rt - u.p.foresee.lead); // 예언가 (95)
    if (u.p.freeze && f.tels.some(t => t !== tel && t.kind === 'zone' && t.impact > f.t + 1e-9)) { rt += u.p.freeze.sec; bark(f, u, null, true, 'freeze'); } // 얼음땡 (95)
    if (u.ps.dodgeTels) u.ps.dodgeTels.add(tel.id); // 신바람 (95)
  }
  if (inZ) {
    let at = f.t + rt;
    if (u.p.greedy) at = Math.max(at, tel.impact - 0.3);
    u.react = { at, tel: tel.id };
    if (u.p.foresee) { if (f.rng() < u.p.foresee.wrong) u.react.fore = true; else bark(f, u, null, false, 'foresee'); }
  } else if (u.p.wrongWay && f.rng() < u.p.wrongWay && !u.fleeing) {
    u.react = { at: f.t + rt, tel: tel.id, wrong: true };
    u.wrongUntil = f.t + rt;
  } else if (u.p.jumpy && tel.kind === 'zone' && !u.react && !u.moving && !u.fleeing && f.rng() < u.p.jumpy.chance) {
    u.react = { at: f.t + rt, tel: tel.id, hop: true }; // 점프광 (95): 나를 안 노려도 뜀
  }
}

/** 참을성 (95): 맞을 피해 (터질 때 + 남는 장판 2초)가 최대 체력 small 아래인 장판 */
export const endurable = (f: Fight, u: Unit, tel: Telegraph | Zone): boolean =>
  !!u.p.endure && ((('skill' in tel && tel.skill.hitDmg) || 0) + (tel.dps || 0) * 2) * f.dmgMult < u.p.endure.small * u.max;

export function zoneThreat(f: Fight, tel: Telegraph | Zone): number {
  return (tel.dps || 0) * 2 * f.dmgMult;
}


export function dodgeRate(f: Fight, u: Unit): number {
  if (u.mods.length || u.senseDodge) {
    const m = dodgeMods(u);
    if (m >= 1) return 1; // 연막탄
    const base = dodgeBase(f, u);
    return Math.max(0.05, Math.min(0.98, base + m + u.senseDodge));
  }
  return dodgeBase(f, u);
}

function dodgeBase(f: Fight, u: Unit): number {
  return Math.max(0.05, Math.min(0.98, u.me ? f.diff.dodge + 0.1 : f.diff.dodge + (u.p.dodge || 0) + calmDodge(f, u) + (u.ps ? persDodge(f, u) : 0) + (u.pairWith != null ? pairDodge(f, u) : 0)
    + (u.fm && u.fm.focus > 0 && bigStage(f) ? u.fm.focus / 2 : 0) // 집중 (97 FM)
    + (u.wob != null ? STAT_ACT.evadeHigh * sharp(u.fmStats?.evade ?? 10) - STAT_ACT.evadeLow * clumsy(u.fmStats?.evade ?? 10) : 0))); // 99 라: 회피 15 = 예전
}

/** 집중 (97 FM)이 힘을 내는 판: 악몽 · 레이드 (10인 넘게) · 보스 체력 30% 아래 */
export const bigStage = (f: Fight): boolean => f.mythic || f.party.length >= 10 || (!f.invuln && f.bossMax > 0 && f.bossHp <= f.bossMax * 0.3);

export function doReact(f: Fight, u: Unit): void {
  const r = u.react!; u.react = null;
  if (r.late) { lateStep(f, u, r.late); return; }
  const tel: Telegraph | Zone | undefined = f.tels.find(t => t.id === r.tel) || f.zones.find(z => z.id === r.tel);
  if (!tel) return;
  if (r.wrong) {
    const free = f.cells.filter(c => !c.unit && !c.block && tel.cells.has(c.i));
    if (free.length) { moveTo(f, u, free[Math.floor(f.rng() * free.length)]); bark(f, u, u.p.barks![1], true, 'wrongStep'); }
    return;
  }
  if (r.hop) { // 점프광 (95): 나를 안 노리는 예고에도 옆 안전한 칸으로
    const c = pickCell(f, u, { safe: true, extra: tel.cells });
    if (c && hexDist(c, cellOf(f, u)) <= 2) { moveTo(f, u, c); bark(f, u, null, false, 'hop'); }
    return;
  }
  if (r.fore) { // 예언가 (95): 장판 안 다른 칸으로 잘못 갔다가 again초 뒤 다시 피함
    const free = f.cells.filter(c => !c.unit && !c.block && tel.cells.has(c.i) && c.i !== u.cell && hexDist(c, cellOf(f, u)) <= 2);
    if (free.length) {
      moveTo(f, u, free[Math.floor(f.rng() * free.length)]);
      bark(f, u, null, true, 'foreseeWrong');
      u.react = { at: f.t + u.moving!.total + u.p.foresee!.again, tel: tel.id };
      return;
    }
  }
  if (endurable(f, u, tel)) { u.ignoreZone = tel.id; guardNow(f, u); bark(f, u, null, true, 'endure'); return; } // 참을성 (95)
  if (u.p.stubborn && zoneThreat(f, tel) < u.p.stubborn * u.max) { u.ignoreZone = tel.id; bark(f, u, u.p.barks![0], false, 'stubborn'); return; }
  if (u.p.brave && u.hp / u.max >= u.p.brave) { u.retryAt = f.t + 1; bark(f, u, u.p.barks![0], false, 'brave'); return; }
  if (u.ps && persIgnoresZone(f, u)) { u.retryAt = f.t + 1; return; } // 다혈질 분노 · 소심이 당황 (75)
  const rate = dodgeRate(f, u);
  const impact = 'impact' in tel ? tel.impact : 0;
  let extra = tel.cells;
  if ('impact' in tel && tel.veil != null && tel.skill.mirrorCells && f.t < tel.veil) {
    // 신기루 피난처: 신중파는 걷힐 때까지 기다리고, 다른 사람은 두 안전 칸 묶음 중 가까운 쪽으로 (걷히면 mirageTick이 다시 반응시킴)
    if (u.pers === '신중파') return;
    extra = new Set([...tel.cells].filter(i => !veiledSafe(f, tel, i)));
  }
  if (f.rng() < rate) {
    const c = pickCell(f, u, { safe: true, extra });
    if (c) {
      moveTo(f, u, c);
      if (u.did) u.did.dodge++; // 길드원 「한 일」 (97)
      if (u.pers === '신중파' || u.pers === '눈치백단') bark(f, u, null, false, 'dodge'); else if (u.p.slow) bark(f, u, null, false, 'slowMove');
      else if (u.p.edge) bark(f, u, null, false, 'edgeStep'); else if (u.p.yieldTo) bark(f, u, null, false, 'yieldStep'); // 모서리파 · 양보왕 (95)
    }
    else { bark(f, u, '피할 곳이 없어!', true, 'noEscape'); u.retryAt = f.t + 1.5; }
  } else {
    u.mistakeUntil = Math.max(f.t, (impact || f.t) - 0.5) + 0.5;
    if (u.wob != null && impact && missShape(f, u, tel, impact)) return; // 능력치 (99 가): 늦게 피함 · 엉뚱한 쪽
    u.retryAt = recoverAt(f, u, impact || f.t); // 침착 (97 FM)
    bark(f, u, null, true, 'mistake'); // 실수 신호 (04 6-1)
  }
}

const st = (u: Unit, k: 'react' | 'judgment') => u.fmStats?.[k] ?? 10;
/**
 * 못 피한 뒤 다시 움직이는 때 (99, Codex 검토 A): 멈칫 · 늦게 피함 · 엉뚱한 쪽 모두 같은 침착 중심 식 (예전 멈칫 식 그대로).
 * 반응은 예고를 보고 언제 움직이기 시작하는지 (scheduleReaction), 침착은 실수 뒤 수습 속도. 예전엔 늦게 피함이 터진 뒤 0.3~0.9초에 나와 멈칫 (1.5~4초)보다 빨라 반응 낮은 쪽이 유리했음
 */
export function recoverAt(f: Fight, u: Unit, impact: number): number {
  return impact + (1.5 + f.rng() * 2.5) * (u.fm?.retry ?? 1);
}
/**
 * 못 피한 모양 (99 가, 못 피할 확률은 그대로): 늦게 피함 (반응 느림 · 판단 좋음) = 늦어도 맞는 칸으로 터진 뒤 뛰어나옴, 엉뚱한 쪽 (반응 빠름 · 판단 나쁨) = 먼저 장판 안 다른 칸으로 뛰었다가 터진 뒤 다시,
 * 나머지는 멈칫 (예전 모양: 제자리, 침착만큼 기다렸다 다시, 둘 다 낮으면 대개 이것). 반응 · 판단 15 이상이면 예전처럼 멈칫만. 모양을 정했으면 true (Codex 검토 반영 1)
 */
function missShape(f: Fight, u: Unit, tel: Telegraph | Zone, impact: number): boolean {
  const cr = clumsy(st(u, 'react')), cj = clumsy(st(u, 'judgment')), late = STAT_ACT.late * cr * (1 - cj), wrong = STAT_ACT.wrong * cj * (1 - cr);
  if (late + wrong <= 0) return false;
  const x = f.rng();
  if (x < late) {
    const at = recoverAt(f, u, impact); // 늦게 피함도 멈칫과 같은 때에 벗어남 (먼저 벗어나지 않게), 대신 맞는 칸 (안전한 칸)으로
    u.react = { at, tel: tel.id, late: new Set(tel.cells) };
    u.retryAt = at + 0.4;
    return true;
  }
  if (x < late + wrong) {
    const here = cellOf(f, u), free = f.cells.filter(c => !c.unit && !c.block && tel.cells.has(c.i) && c.i !== u.cell && hexDist(c, here) <= 2);
    if (!free.length) return false;
    moveTo(f, u, free[Math.floor(f.rng() * free.length)]);
    u.wrongUntil = f.t + 0.6; // 칸 위 「?」
    u.retryAt = recoverAt(f, u, impact);
    bark(f, u, null, true, 'wrongDodge');
    return true;
  }
  return false;
}

/** 늦게 피함 (99 가): 터진 뒤에 예고 칸 · 남는 장판에서 안전한 칸으로 뛰어나옴 */
function lateStep(f: Fight, u: Unit, cells: Set<number>): void {
  if (!cells.has(u.cell) && !dangerAt(f, u.cell)) return;
  const c = pickCell(f, u, { safe: true, extra: cells });
  if (c) { moveTo(f, u, c); bark(f, u, null, true, 'lateDodge'); }
}
