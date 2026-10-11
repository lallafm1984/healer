/**
 * 사제 빛의 비둘기 (휠 8번째 칸, Lim 2026-10-11 「캐릭터별로 스킬이 7개 밖에 없어서 슬롯 한자리가 빈다」).
 * 대상에게 앉고, 앉은 사람이 피해를 받으면 회복한 뒤 가까운 아군 중 체력이 가장 낮은 사람에게 날아간다 (수치는 data/heroConst DOVE).
 * 판 위에 한 마리만: 다시 쓰면 새 비둘기가 새 대상에게 (남은 횟수는 처음부터)
 */
import { DOVE } from '../data/heroConst';
import { SKILLS } from '../data/skills';
import { hexDist } from './board';
import { cellOf, emit, heal, living } from './core';
import { fillWords } from './healer';
import { under } from './specials';
import type { Fight, Unit } from './types';

/**
 * 힐하면 손해인 사람에게는 앉지 않음: 뒤집힌 축복 (힐이 피해) · 매혹 (지배가 길어짐) · 과부하 표식 (넘친 치유가 이웃을 아프게) ·
 * 뒤집힘 저주 (50% 위면 끝날 때 뒤집힘) · 아직 자라는 요정 고리 안 (치유를 받으면 자람)
 */
const shy = (f: Fight, u: Unit) => u.debuffs.some(d => d.invert || d.charm || d.over || d.end?.p === 'flip')
  || (f.zones.length > 0 && f.zones.some(z => !!z.ring && z.ring.n < z.ring.max && z.cells.has(u.cell)));

export function putDove(f: Fight, u: Unit): void {
  f.dove = { id: u.id, left: DOVE.hops, until: f.t + DOVE.sec, flyUntil: f.t };
  emit(f, { type: 'fx', name: 'dove-land', on: u.id });
}

/** 피해를 받은 뒤 (core damage): 앉은 사람이 살아 있으면 회복하고 다음 사람에게. 날아오는 중이면 아무 일 없음 */
export function doveHurt(f: Fight, u: Unit): void {
  const d = f.dove!;
  if (f.t < d.flyUntil || u.hp <= 0) return; // 이번 피해로 쓰러지면 doveTick이 다른 사람에게 보냄
  if (shy(f, u)) { fly(f, u); return; } // 앉은 뒤 힐하면 손해인 상태가 됨: 회복하지 않고 날아감
  const amt = SKILLS.dove.amt!;
  if (f.sp) under('dove', false, () => heal(f, u, amt, true)); else heal(f, u, amt, true);
  fillWords(f, 0, DOVE.gs);
  if (--d.left <= 0) { gone(f, u); return; }
  fly(f, u);
}

/** 힐러 한 틱: 시간이 다 되면 사라지고, 앉은 사람이 쓰러지거나 떠오르면 (P-LIFT) 다른 사람에게 (횟수는 그대로) */
export function doveTick(f: Fight): void {
  const d = f.dove!, u = f.party.find(x => x.id === d.id);
  if (!u || f.t >= d.until - 1e-9) { gone(f, u); return; }
  if (f.t >= d.flyUntil && (!u.alive || u.lift)) fly(f, u);
}

/**
 * 다음 자리: DOVE.range칸 안에서 체력 비율이 가장 낮은 사람 (같으면 가까운 사람), 그 안에 아무도 없으면 가장 가까운 사람.
 * 갈 사람이 없으면 그 자리에 그대로 (앉은 사람이 쓰러졌으면 사라짐)
 */
function fly(f: Fight, from: Unit): void {
  const c = cellOf(f, from), dist = (v: Unit) => hexDist(cellOf(f, v), c), pct = (v: Unit) => v.hp / v.max;
  const all = living(f).filter(v => v !== from && !shy(f, v));
  const near = all.filter(v => dist(v) <= DOVE.range);
  const to = near.length
    ? near.sort((a, b) => pct(a) - pct(b) || dist(a) - dist(b) || a.id - b.id)[0]
    : all.sort((a, b) => dist(a) - dist(b) || pct(a) - pct(b) || a.id - b.id)[0];
  if (!to) { if (!from.alive || from.lift) gone(f, from); return; }
  f.dove = { ...f.dove!, id: to.id, flyUntil: f.t + DOVE.fly };
  emit(f, { type: 'fx', name: 'dove-fly', on: from.id, to: to.id });
}

function gone(f: Fight, u: Unit | undefined): void {
  f.dove = null;
  if (u) emit(f, { type: 'fx', name: 'dove-gone', on: u.id });
}
