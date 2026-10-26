/**
 * 위치 규칙 (2026-10-13 Lim): 탱커는 1열, 근접은 1 · 2열에서만 공격, 원거리는 1 · 2열이면 공격력 50% · 받는 피해 +50% (레이드 판만,
 * Lim 「탐험 및 던전은 원거리 패널티 해제」). 1열 = 적에 가장 가까운 줄
 */
import { describe, expect, it } from 'vitest';
import { POS_RULES } from '../src/data/rules';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { pickCell } from '../src/engine/movement';
import { looseTick } from '../src/engine/position';
import type { EncounterKey } from '../src/data/encounters';
import type { Cell, Fight, Unit } from '../src/engine';

const quiet = (f: Fight) => f.skills.forEach(s => { s.next = Infinity; });
const rowOf = (f: Fight, u: Unit) => f.cells[u.cell].row;
/** 1열 전체에 피해 없는 장판 (탱커가 못 돌아가게) */
const blockFront = (f: Fight) => { const z = { id: 9999, cells: new Set(f.cells.filter(c => c.row === 0).map(c => c.i)), end: Infinity, dps: 0 }; f.zones.push(z); return z; };
/** 그 줄의 빈 칸으로 바로 옮김 (집도 거기로: 제자리로 돌아오지 않게) */
const place = (f: Fight, u: Unit, row: number) => {
  const c = f.cells.find(x => x.row === row && !x.unit && !x.block) as Cell;
  f.cells[u.cell].unit = null; c.unit = u; u.cell = c.i; u.home = c.i;
};

describe('위치 규칙', () => {
  it('규칙 값: 탱커 1열 · 근접 1 · 2열 · 원거리 1 · 2열이면 공격력 50% · 받는 피해 +50% (5줄 이상 판 = 10 · 20인 레이드만)', () => {
    expect(POS_RULES).toEqual({ tankRows: 1, meleeRows: 2, rangedRows: 2, rangedMinRows: 5, rangedDps: 0.5, rangedTaken: 1.5 });
  });

  it.each<[string, EncounterKey]>([['탐험 b7', 'patrol'], ['5인 b10', 'scrap'], ['10인 b25', 'plague'], ['20인 b36', 'choir']])('%s 시작 배치는 규칙을 지킴 (시드 1~20)', (_, enc) => {
    for (let seed = 1; seed <= 20; seed++) {
      const f = E.create({ encounter: enc, diff: '보통', seed });
      for (const u of f.party) {
        if (u.role === 'tank') expect(rowOf(f, u)).toBe(0);
        if (u.role === 'melee') expect(rowOf(f, u)).toBeLessThan(2);
        if (u.role === 'ranged' && f.rows >= 5) expect(rowOf(f, u)).toBeGreaterThanOrEqual(2); // 레이드만 (탐험 · 던전은 원거리 패널티 없음)
      }
    }
  });

  it('탱커가 1열을 벗어나면 적이 다른 파티원 (나 빼고) 중 무작위 1명을 때리고, 돌아오면 다시 탱커', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 2 });
    const tank = f.party.find(u => u.role === 'tank')!;
    expect(E.aggroTarget(f)).toBe(tank);
    place(f, tank, 1);
    looseTick(f);
    const hit = E.aggroTarget(f)!;
    expect(f.loose?.id).toBe(hit.id);
    expect(hit.role).not.toBe('tank');
    expect(hit.me).toBe(false);
    expect(f.events.some(e => e.type === 'loose' && e.on === hit.id)).toBe(true);
    // 그대로면 같은 사람, 쓰러지면 다른 사람으로
    looseTick(f);
    expect(E.aggroTarget(f)).toBe(hit);
    hit.alive = false; hit.hp = 0;
    looseTick(f);
    expect(E.aggroTarget(f)).not.toBe(hit);
    expect(E.aggroTarget(f)!.role).not.toBe('tank');
    place(f, tank, 0);
    looseTick(f);
    expect(f.loose).toBeNull();
    expect(E.aggroTarget(f)).toBe(tank);
  });

  it('여러 사람이 고르게 뽑힘 (시드마다 무작위)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const f = E.create({ encounter: 'plague', diff: '보통', seed });
      for (const t of f.party.filter(u => u.role === 'tank')) place(f, t, 2);
      looseTick(f);
      seen.add(E.aggroTarget(f)!.role);
    }
    expect(seen).toEqual(new Set(['melee', 'ranged']));
  });

  it('탱커가 둘이면 한 명이라도 1열에 있으면 그 탱커가 맞음', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1 });
    const [a, b] = f.party.filter(u => u.role === 'tank');
    place(f, a, 2);
    looseTick(f);
    expect(f.loose).toBeNull();
    expect(E.aggroTarget(f)).toBe(b);
  });

  it('보스 평타가 실제로 그 사람에게 감 (1열이 막혀 탱커가 못 돌아가는 동안)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 4 });
    const tank = f.party.find(u => u.role === 'tank')!;
    place(f, tank, 1);
    blockFront(f);
    const hp0 = new Map(f.party.map(u => [u.id, u.hp]));
    for (let i = 0; i < 20 * 8 && !f.over; i++) { for (const u of f.party) if (u.id !== f.loose?.id) u.hp = hp0.get(u.id)!; E.step(f); f.events.length = 0; }
    expect(rowOf(f, tank)).toBe(1);
    const hit = f.party.find(u => u.id === f.loose?.id)!;
    expect(hit.hp).toBeLessThan(hp0.get(hit.id)!);
    expect(tank.hp).toBe(hp0.get(tank.id)!);
  });

  it('1열에 비고 안전한 칸이 생기면 탱커가 스스로 나가 다시 잡음 (거기가 새 자리)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 4 });
    quiet(f);
    const tank = f.party.find(u => u.role === 'tank')!;
    place(f, tank, 1);
    const z = blockFront(f);
    for (let i = 0; i < 20; i++) { E.step(f); f.events.length = 0; }
    expect(f.loose).not.toBeNull();
    f.zones = f.zones.filter(x => x !== z);
    for (let i = 0; i < 20 && f.loose; i++) { E.step(f); f.events.length = 0; }
    expect(f.loose).toBeNull();
    expect(E.aggroTarget(f)).toBe(tank);
    for (let i = 0; i < 20; i++) { E.step(f); f.events.length = 0; }
    expect(rowOf(f, tank)).toBe(0);
    expect(f.cells[tank.home].row).toBe(0);
  });

  it('1열의 다른 칸이 모두 장판이고 남은 칸에 딜러가 서 있으면 딜러가 1열 밖으로 비켜 주고 탱커가 그 칸으로 (2026-10-27 Lim 「탱커가 1분가까이 … 방황」)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 4 });
    quiet(f);
    const tank = f.party.find(u => u.role === 'tank')!;
    place(f, tank, 1);
    const front = f.cells.filter(c => c.row === 0 && !c.block);
    let seat = front.find(c => c.unit && c.unit.role !== 'tank' && !c.unit.me);
    const v = seat ? seat.unit! : f.party.find(u => u.role !== 'tank' && !u.me)!;
    if (!seat) { seat = front.find(c => !c.unit)!; f.cells[v.cell].unit = null; seat.unit = v; v.cell = seat.i; v.home = seat.i; }
    f.zones.push({ id: 9998, cells: new Set(front.filter(c => c !== seat).map(c => c.i)), end: Infinity, dps: 0 });
    for (let i = 0; i < 20 * 4 && rowOf(f, tank) !== 0; i++) { E.step(f); f.events.length = 0; }
    expect(rowOf(f, tank)).toBe(0);
    expect(tank.cell).toBe(seat!.i);
    expect(rowOf(f, v)).toBeGreaterThanOrEqual(1);
    if (v.role === 'melee') expect(rowOf(f, v)).toBeLessThan(POS_RULES.meleeRows); // 근접은 공격하는 줄 안으로
    expect(v.home).toBe(v.cell); // 비킨 칸이 새 자리 (제자리로 돌아와 다시 막지 않게)
    expect(f.loose).toBeNull();
    expect(E.aggroTarget(f)).toBe(tank);
  });

  it('교대: 1열 밖 부탱커가 보스를 넘겨받으면 1열로 나가며 받음', () => {
    const f = E.create({ encounter: 'pililli', diff: '보통', seed: 1 });
    quiet(f);
    const [a, b] = f.party.filter(u => u.role === 'tank');
    place(f, b, 2);
    expect(E.aggroTarget(f)).toBe(a);
    const swap = f.bs['buster'];
    expect(swap).toBeTruthy();
    // 교대 디버프가 가득 찬 상태를 만들고 교대 실행
    for (let i = 0; i < 20 * 40 && f.hold !== b.id; i++) { swap!.next = f.t; E.step(f); f.events.length = 0; a.hp = a.max; b.hp = b.max; }
    expect(f.hold).toBe(b.id);
    for (let i = 0; i < 20; i++) { E.step(f); f.events.length = 0; }
    expect(rowOf(f, b)).toBe(0);
    expect(E.aggroTarget(f)).toBe(b);
  });

  it('근접 (탱커 포함)은 3열부터 공격 못 함, 원거리는 1 · 2열이면 공격력 50%', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1 });
    const melee = f.party.find(u => u.role === 'melee')!, ranged = f.party.find(u => u.role === 'ranged')!, tank = f.party.find(u => u.role === 'tank')!;
    const m0 = E.unitDps(melee, f), r0 = E.unitDps(ranged, f), t0 = E.unitDps(tank, f);
    expect(m0).toBeGreaterThan(0);
    place(f, melee, 1); expect(E.unitDps(melee, f)).toBeCloseTo(m0);
    place(f, melee, 2); expect(E.unitDps(melee, f)).toBe(0);
    place(f, tank, 3); expect(E.unitDps(tank, f)).toBe(0);
    expect(t0).toBeGreaterThan(0);
    place(f, ranged, 1); expect(E.unitDps(ranged, f)).toBeCloseTo(r0 * 0.5);
    place(f, ranged, 0); expect(E.unitDps(ranged, f)).toBeCloseTo(r0 * 0.5);
  });

  it('탐험 · 5인 던전은 원거리 패널티 없음: 1 · 2열에서도 공격력 · 받는 피해 그대로', () => {
    for (const enc of ['patrol', 'scrap'] as const) {
      const f = E.create({ encounter: enc, diff: '보통', seed: 1 });
      quiet(f);
      const ranged = f.party.find(u => u.role === 'ranged')!;
      const d0 = E.unitDps(ranged, f);
      let hp = ranged.hp; damage(f, ranged, 10); const back = hp - ranged.hp;
      place(f, ranged, 1);
      expect(E.unitDps(ranged, f)).toBeCloseTo(d0);
      hp = ranged.hp; damage(f, ranged, 10);
      expect(hp - ranged.hp).toBeCloseTo(back);
    }
  });

  it('원거리가 1 · 2열에 서면 받는 피해 +50% (레이드, 뒷줄은 그대로)', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1 });
    quiet(f);
    const ranged = f.party.find(u => u.role === 'ranged')!;
    let hp = ranged.hp; damage(f, ranged, 10); const back = hp - ranged.hp;
    place(f, ranged, 1);
    hp = ranged.hp; damage(f, ranged, 10);
    expect(hp - ranged.hp).toBeCloseTo(back * 1.5);
  });

  it('장판을 피할 때도 규칙을 지키는 칸을 고름: 탱커는 1열에 빈 안전 칸이 있으면 1열로', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1 });
    const tank = f.party.find(u => u.role === 'tank')!;
    for (let i = 0; i < 20; i++) {
      const c = pickCell(f, tank, { safe: true });
      expect(c!.row).toBe(0);
    }
  });

  it('프로토타입 규칙 (parity)에는 위치 규칙이 없음', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, proto: true });
    expect(f.R.pos).toBeUndefined();
    const tank = f.party.find(u => u.role === 'tank')!;
    place(f, tank, 2);
    looseTick(f);
    expect(f.loose).toBeNull();
  });
});
