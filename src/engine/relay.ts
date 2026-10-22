/**
 * 사제 빛의 전이 (휠 8번째 칸, Lim 2026-10-11 「캐릭터별로 스킬이 7개 밖에 없어서 슬롯 한자리가 빈다」).
 * 대상에게 빛이 깃들고, 빛이 깃든 사람이 피해를 받으면 회복한 뒤 빛이 가까운 아군 중 체력이 가장 낮은 사람에게 옮겨 간다 (바로 옆 칸만, 수치는 data/heroConst RELAY).
 * 2026-10-22 Lim 「지속 15초 재사용 15초로 하고 장비로 인한 차이가 발생하면 동시에 걸리게」: 다시 걸어도 앞의 빛은 그대로 두고 새 빛이 하나 더 (f.relays).
 * 재사용 = 지속이라 보통은 하나, 장비로 재사용이 짧아지면 여럿이 함께 남는다. 빛마다 따로 회복 · 옮겨 감 · 사라짐
 */
import { RELAY } from '../data/heroConst';
import { SKILLS } from '../data/skills';
import { hexDist } from './board';
import { cellOf, emit, heal, living } from './core';
import { fillWords, noteUsed } from './healer';
import { sv, under } from './specials';
import type { Fight, Relay, Unit } from './types';

/**
 * 힐하면 손해인 사람에게는 옮겨 가지 않음: 뒤집힌 축복 (힐이 피해) · 매혹 (지배가 길어짐) · 과부하 표식 (넘친 치유가 이웃을 아프게) ·
 * 뒤집힘 저주 (50% 위면 끝날 때 뒤집힘) · 아직 자라는 요정 고리 안 (치유를 받으면 자람)
 */
const shy = (f: Fight, u: Unit) => u.debuffs.some(d => d.invert || d.charm || d.over || d.end?.p === 'flip')
  || (f.zones.length > 0 && f.zones.some(z => !!z.ring && z.ring.n < z.ring.max && z.cells.has(u.cell)));

export function putRelay(f: Fight, u: Unit): void {
  f.relays.push({ id: u.id, left: RELAY.hops + sv(f, 'relayStep'), until: f.t + RELAY.sec, flyUntil: f.t }); // 빛의 발자국 (42 사제 22)
  emit(f, { type: 'fx', name: 'relay-land', on: u.id });
}

/** 피해를 받은 뒤 (core damage): 그 사람에게 깃든 빛마다 회복하고 다음 사람에게. 옮겨 오는 중인 빛은 아무 일 없음 */
export function relayHurt(f: Fight, u: Unit): void {
  for (const d of f.relays.filter(x => x.id === u.id)) {
    if (f.t < d.flyUntil || u.hp <= 0) continue; // 이번 피해로 쓰러지면 relayTick이 다른 사람에게 보냄
    if (shy(f, u)) { fly(f, d, u); continue; } // 깃든 뒤 힐하면 손해인 상태가 됨: 회복하지 않고 옮겨 감
    const amt = SKILLS.relay.amt!;
    if (f.sp) under('relay', false, () => heal(f, u, amt, true)); else heal(f, u, amt, true);
    noteUsed(f, 'relay', u.id); // 회복할 때마다 빛의 전이 이펙트 (공통 치유 빛 대신)
    fillWords(f, RELAY.gp);
    if (--d.left <= 0) { gone(f, d, u); continue; }
    fly(f, d, u);
  }
}

/** 힐러 한 틱: 빛마다 시간이 다 되면 사라지고, 깃든 사람이 쓰러지거나 떠오르면 (P-LIFT) 다른 사람에게 (횟수는 그대로) */
export function relayTick(f: Fight): void {
  for (const d of [...f.relays]) {
    const u = f.party.find(x => x.id === d.id);
    if (!u || f.t >= d.until - 1e-9) { gone(f, d, u); continue; }
    if (f.t >= d.flyUntil && (!u.alive || u.lift)) fly(f, d, u);
  }
}

/**
 * 다음 자리: RELAY.range칸 안 (바로 옆 칸)에서 체력 비율이 가장 낮은 사람 (같으면 가까운 사람).
 * 그 안에 아무도 없으면 그 자리에 그대로 (깃든 사람이 쓰러지거나 떠올랐으면 사라짐)
 */
function fly(f: Fight, d: Relay, from: Unit): void {
  const c = cellOf(f, from), dist = (v: Unit) => hexDist(cellOf(f, v), c), pct = (v: Unit) => v.hp / v.max;
  const near = living(f).filter(v => v !== from && !shy(f, v) && dist(v) <= RELAY.range);
  const to = near.sort((a, b) => pct(a) - pct(b) || dist(a) - dist(b) || a.id - b.id)[0];
  if (!to) { if (!from.alive || from.lift) gone(f, d, from); return; }
  d.id = to.id; d.flyUntil = f.t + RELAY.fly;
  emit(f, { type: 'fx', name: 'relay-fly', on: from.id, to: to.id });
}

function gone(f: Fight, d: Relay, u: Unit | undefined): void {
  f.relays = f.relays.filter(x => x !== d);
  if (u) emit(f, { type: 'fx', name: 'relay-gone', on: u.id });
}
