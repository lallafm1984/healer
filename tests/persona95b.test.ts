/** 파티원 성격 95 문서 2차 (2026-10-18): 기존 묶음 회피 · 위치 · 관계 · 감정 · 리듬 25종의 데이터와 전투 행동 */
import { describe, expect, it } from 'vitest';
import { PERS, PERS_NAMES, type PersCat, type PersName } from '../src/data/personalities';
import type { ClassKey } from '../src/data/classes';
import * as E from '../src/engine';
import { aggroTarget } from '../src/engine/bossParts';
import { addDebuff, damage, heal, onDebuffEnd } from '../src/engine/core';
import { doReact, scheduleReaction } from '../src/engine/movement';
import { mentored, pairDodge, persDodge, persDps, persIgnoresZone, persPosPref, persReact, persZoneImpact } from '../src/engine/persona';
import type { RosterEntry, Telegraph } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const R = (role: RosterEntry['role'], cls: ClassKey, pers: PersName, nick: string, ab?: string): RosterEntry => ({ role, cls, pers, nick, ab });
/** 5인: 탱커 전사 · 근접 도적 · 원거리 마법사 · 궁수. 보스 기술은 끔 */
const fight = (o: { tank?: PersName; melee?: PersName; mage?: PersName; archer?: PersName; tankAb?: string; meleeAb?: string } = {}): F => {
  const f = E.create({
    encounter: 'warden', diff: '보통', seed: 1,
    party: [R('tank', 'warrior', o.tank ?? '신중파', '탱', o.tankAb), R('melee', 'rogue', o.melee ?? '사교형', '근', o.meleeAb), R('ranged', 'mage', o.mage ?? '사교형', '마'), R('ranged', 'archer', o.archer ?? '사교형', '궁')],
  });
  f.skills.forEach(s => { s.next = Infinity; });
  return f;
};
const who = (f: F, nick: string) => f.party.find(u => u.nick === nick)!;
const bark = (f: F, sit: string) => f.events.some(e => e.type === 'bark' && e.sit === sit);
/** 그 사람 칸이 든 장판 예고 (cells = 그 칸 + 옆 칸들) */
const zoneOn = (f: F, cells: number[], sec = 2, more: object = {}): Telegraph => {
  const tel = { id: f.nextId++, kind: 'zone', units: [], start: f.t, impact: f.t + sec, cells: new Set(cells), skill: { name: '장판', key: `z${f.nextId}`, hitDmg: 30 }, ...more } as unknown as Telegraph;
  f.tels.push(tel);
  return tel;
};
const NEW25: PersName[] = ['예언가', '점프광', '참을성', '모서리파', '얼음땡', '앞장이', '뒷줄파', '짝꿍', '양보왕', '집돌이', '대타', '큰형', '분위기메이커', '칭찬왕', '보은형', '샘쟁이',
  '울보', '오뚝이', '예민형', '신바람', '화풀이', '폭주기관차', '쉬엄쉬엄', '타이밍 장인', '끈기형'];

describe('데이터', () => {
  it('45종 뒤에 25종 (모두 70종): 회피 5 · 위치 5 · 관계 6 · 감정 5 · 리듬 4, 탱커 불가 4 · 희귀 4', () => {
    expect(PERS_NAMES.length).toBe(70);
    expect(PERS_NAMES.slice(45)).toEqual(NEW25);
    const by = (c: PersCat) => NEW25.filter(p => PERS[p].cat === c).length;
    expect([by('회피'), by('위치'), by('관계'), by('감정'), by('리듬')]).toEqual([5, 5, 6, 5, 4]);
    expect(NEW25.filter(p => 'noTank' in PERS[p])).toEqual(['얼음땡', '뒷줄파', '대타', '울보']);
    expect(NEW25.filter(p => 'rare' in PERS[p])).toEqual(['예언가', '대타', '큰형', '타이밍 장인']);
    for (const p of NEW25) expect(PERS[p].desc, p).toMatch(/니다\.$/);
  });
});

describe('회피', () => {
  it('예언가: 1초 먼저 움직이고, 다섯 번에 한 번은 장판 안 칸으로 갔다가 다시 피함', () => {
    const f = fight({ melee: '예언가' }), u = who(f, '근'), base = who(f, '마');
    const near = f.cells.filter(c => E.hexDist(c, f.cells[u.cell]) <= 1).map(c => c.i);
    f.rng = () => 0.5;
    const tel = zoneOn(f, [...near, base.cell]);
    scheduleReaction(f, tel, u); scheduleReaction(f, tel, base);
    expect(u.react!.at).toBeLessThan(base.react!.at - 0.5);
    expect(u.react!.fore).toBeUndefined();
    const g = fight({ melee: '예언가' }), v = who(g, '근');
    const cells = g.cells.filter(c => E.hexDist(c, g.cells[v.cell]) <= 1).map(c => c.i);
    g.rng = () => 0;
    const t2 = zoneOn(g, cells);
    scheduleReaction(g, t2, v);
    expect(v.react!.fore).toBe(true);
    doReact(g, v);
    expect(v.moving && t2.cells.has(v.moving.to)).toBe(true);
    expect(v.react).not.toBeNull(); // 다시 피함
    expect(bark(g, 'foreseeWrong')).toBe(true);
  });
  it('점프광: 나를 안 노리는 장판 예고에도 반은 옆 칸으로 뜀, 회피 +25%p · 딜 ×0.95', () => {
    const f = fight({ melee: '점프광' }), u = who(f, '근'), far = f.cells.find(c => !c.block && E.hexDist(c, f.cells[u.cell]) >= 3)!;
    f.rng = () => 0.3;
    const tel = zoneOn(f, [far.i]);
    scheduleReaction(f, tel, u);
    expect(u.react?.hop).toBe(true);
    f.t = u.react!.at; doReact(f, u);
    expect(u.moving).not.toBeNull();
    expect(PERS['점프광']).toMatchObject({ dodge: 0.25, dps: 0.95 });
  });
  it('참을성: 최대 체력 30%가 안 되는 장판은 안 피하고 생존기를 켬', () => {
    const f = fight({ melee: '참을성', meleeAb: 'rogue.evasion' }), u = who(f, '근');
    const tel = zoneOn(f, [u.cell], 2, { dps: 0 });
    (tel.skill as { hitDmg: number }).hitDmg = u.max * 0.1 / f.dmgMult;
    scheduleReaction(f, tel, u);
    f.t = u.react!.at; doReact(f, u);
    expect(u.moving).toBeNull();
    expect(u.ignoreZone).toBe(tel.id);
    expect(u.ab!.uses).toBe(1);
    expect(bark(f, 'endure')).toBe(true);
  });
  it('모서리파: 피할 때 가장자리 칸에 가산점, 제자리 복귀 2초 늦게', () => {
    const f = fight({ melee: '모서리파' }), u = who(f, '근');
    const cx = f.cells.reduce((a, c) => a + c.px, 0) / f.cells.length;
    const edge = f.cells.reduce((a, c) => (Math.abs(c.px - cx) > Math.abs(a.px - cx) ? c : a));
    const mid = f.cells.reduce((a, c) => (Math.abs(c.px - cx) < Math.abs(a.px - cx) ? c : a));
    expect(persPosPref(f, u, edge, true) - persPosPref(f, u, mid, true)).toBeGreaterThan(20);
    expect(persPosPref(f, u, edge, false)).toBe(persPosPref(f, u, mid, false));
  });
  it('얼음땡: 다른 장판 예고가 있는데 또 오면 1초 굳음', () => {
    const f = fight({ melee: '얼음땡' }), u = who(f, '근');
    const t1 = zoneOn(f, [u.cell]);
    scheduleReaction(f, t1, u); const a1 = u.react!.at - f.t;
    u.react = null;
    const t2 = zoneOn(f, [u.cell]);
    scheduleReaction(f, t2, u);
    expect(u.react!.at - f.t).toBeCloseTo(a1 + 1);
    expect(bark(f, 'freeze')).toBe(true);
  });
});

describe('위치', () => {
  it('앞장이 · 뒷줄파: 설 수 있는 칸 중 앞줄 · 뒷줄, 뒷줄파 근접은 딜 ×0.9', () => {
    const f = fight({ melee: '앞장이', archer: '뒷줄파' });
    const front = f.cells.find(c => c.row === 0)!, back = f.cells.find(c => c.row === f.rows - 1)!;
    expect(persPosPref(f, who(f, '근'), front, false)).toBeGreaterThan(persPosPref(f, who(f, '근'), back, false));
    expect(persPosPref(f, who(f, '궁'), back, false)).toBeGreaterThan(persPosPref(f, who(f, '궁'), front, false));
    expect(PERS['앞장이'].dps).toBe(1.1);
    const g = fight({ melee: '뒷줄파' });
    expect(persDps(g, who(g, '근'))).toBeCloseTo(0.9);
  });
  it('짝꿍: 시작 때 가장 가까운 아군과 짝, 붙어 있으면 둘 다 회피 +5%p', () => {
    const f = fight({ melee: '짝꿍' }), u = who(f, '근');
    const v = f.party.find(x => x.id === u.pairWith)!;
    expect(v && !v.me && v.pairWith).toBe(u.id);
    steps(f, 3);
    const adj = E.hexDist(f.cells[u.moving ? u.moving.to : u.cell], f.cells[v.cell]) === 1;
    if (!u.moving && adj) { expect(pairDodge(f, u)).toBeCloseTo(0.05); expect(pairDodge(f, v)).toBeCloseTo(0.05); }
    else expect(adj).toBe(true);
  });
  it('양보왕: 피할 때 아군 옆 칸 감점 · 집돌이: 제자리 가까운 칸, 제자리면 딜 ×1.05', () => {
    const f = fight({ melee: '양보왕', mage: '집돌이' }), y = who(f, '근'), h = who(f, '마');
    const free = f.cells.filter(c => !c.unit && !c.block);
    const n = (c: typeof free[0]) => f.party.filter(x => x !== y && x.alive && E.hexDist(f.cells[x.cell], c) === 1).length;
    const lone = free.reduce((a, c) => (n(c) < n(a) ? c : a), free[0]), busy = free.reduce((a, c) => (n(c) > n(a) ? c : a), free[0]);
    expect(persPosPref(f, y, lone, true) - persPosPref(f, y, busy, true)).toBeCloseTo((n(busy) - n(lone)) * 25);
    expect(persDps(f, h)).toBeCloseTo(1.05);
    const farC = free.reduce((a, c) => (E.hexDist(c, f.cells[h.home]) > E.hexDist(a, f.cells[h.home]) ? c : a), free[0]);
    expect(persPosPref(f, h, farC, true)).toBeLessThan(persPosPref(f, h, f.cells[h.home], true));
  });
});

describe('관계', () => {
  it('대타: 탱커가 모두 쓰러지면 10초 동안 보스를 붙잡고 (받는 피해 −40%), 그동안 탱커 없음 광폭화를 안 셈', () => {
    const f = fight({ melee: '대타' }), u = who(f, '근'), tk = who(f, '탱');
    damage(f, tk, tk.max * 10, false, 'fixed');
    expect(tk.alive).toBe(false);
    expect(aggroTarget(f)).toBe(u);
    expect(u.mods.find(m => m.k === 'cut')?.v).toBeCloseTo(0.4);
    steps(f, 5);
    expect(f.noTankAt).toBeNull();
    steps(f, 5.5);
    expect(f.noTankAt).not.toBeNull(); // 끝나면 그때부터 광폭화 카운트다운
  });
  it('큰형: 옆 소심이의 당황 시간이 반', () => {
    const f = fight({ melee: '큰형', mage: '소심이', archer: '소심이' });
    const m = who(f, '마'), a = who(f, '궁'), bro = who(f, '근');
    const near = [m, a].find(x => E.hexDist(f.cells[x.cell], f.cells[bro.cell]) === 1);
    const far = [m, a].find(x => E.hexDist(f.cells[x.cell], f.cells[bro.cell]) > 1);
    for (const x of [near, far]) if (x) addDebuff(f, x, { name: '독', type: '독', left: 10, dot: 1 } as never);
    if (near) { expect(mentored(f, near)).toBe(true); expect(near.ps!.panicUntil! - f.t).toBeCloseTo(1.5); }
    if (far) expect(far.ps!.panicUntil! - f.t).toBeCloseTo(3);
    expect(near || far).toBeTruthy();
  });
  it('분위기메이커: 시작 10초 동안 파티 전원 반응 ×0.9', () => {
    const f = fight({ melee: '분위기메이커' }), g = fight(), v = who(f, '마'), w = who(g, '마');
    const z1 = zoneOn(f, [v.cell]), z2 = zoneOn(g, [w.cell]);
    scheduleReaction(f, z1, v); scheduleReaction(g, z2, w);
    expect((v.react!.at - f.t) / (w.react!.at - g.t)).toBeCloseTo(0.9);
    f.t = 11; v.react = null; scheduleReaction(f, z1, v);
    expect(v.react!.at - f.t).toBeCloseTo(w.react!.at - g.t);
  });
  it('칭찬왕 · 보은형: 25% 아래였던 아군이 60% 위로 살아나면 파티 딜 +5% (5초) · 보은형은 회피 +10%p (10초)', () => {
    const f = fight({ melee: '칭찬왕', mage: '보은형' }), m = who(f, '마'), a = who(f, '궁');
    m.hp = m.max * 0.2; steps(f, 0.3);
    m.hp = m.max * 0.7; steps(f, 0.3);
    expect(persDps(f, a)).toBeCloseTo(1.05);
    expect(persDodge(f, m)).toBeCloseTo(0.1);
    f.t += 6; expect(persDps(f, a)).toBeCloseTo(1);
  });
  it('샘쟁이: 내가 힐 받으면 딜 +10% (5초), 옆 사람만 받으면 −5% (3초)', () => {
    const f = fight({ melee: '샘쟁이' }), u = who(f, '근');
    const nb = f.party.find(x => x !== u && !x.me && E.hexDist(f.cells[x.cell], f.cells[u.cell]) === 1)!;
    nb.hp = nb.max * 0.5; heal(f, nb, 10, true);
    expect(persDps(f, u)).toBeCloseTo(0.95);
    u.hp = u.max * 0.5; heal(f, u, 10, true);
    expect(persDps(f, u)).toBeCloseTo(1.1);
  });
});

describe('감정', () => {
  it('울보: 아군이 쓰러지면 5초 딜 0 (피하기는 함)', () => {
    const f = fight({ melee: '울보' }), u = who(f, '근'), m = who(f, '마');
    damage(f, m, m.max * 10, false, 'fixed');
    expect(persDps(f, u)).toBe(0);
    expect(persIgnoresZone(f, u)).toBe(false);
    f.t += 5.1; expect(persDps(f, u)).toBe(1);
  });
  it('오뚝이: 처음 10% 아래로 가면 3초 받는 피해 −50% (한 번)', () => {
    const f = fight({ melee: '오뚝이' }), u = who(f, '근');
    damage(f, u, u.max * 0.95 / f.dmgMult, false, 'fixed');
    expect(u.mods.find(m => m.k === 'cut')?.v).toBeCloseTo(0.5);
    const h0 = u.hp; damage(f, u, 10, false, 'fixed');
    expect(h0 - u.hp).toBeCloseTo(10 * f.dmgMult * 0.5);
    expect(u.ps!.bounced).toBe(true);
  });
  it('예민형: 디버프가 있으면 딜 −20%, 해제받으면 5초 +15%', () => {
    const f = fight({ melee: '예민형' }), u = who(f, '근');
    const d = addDebuff(f, u, { name: '독', type: '독', left: 10, dot: 1 } as never);
    expect(persDps(f, u)).toBeCloseTo(0.8);
    u.debuffs = []; onDebuffEnd(f, u, d, true);
    expect(persDps(f, u)).toBeCloseTo(1.15);
  });
  it('신바람: 내 칸 장판을 세 번 연달아 피하면 5초 딜 +20%, 맞으면 처음부터', () => {
    const f = fight({ melee: '신바람' }), u = who(f, '근');
    const free = f.cells.find(c => !c.unit && !c.block)!;
    for (let i = 0; i < 2; i++) { const t = zoneOn(f, [free.i, u.cell]); scheduleReaction(f, t, u); u.react = null; t.cells.delete(u.cell); persZoneImpact(f, t); }
    expect(persDps(f, u)).toBe(1);
    const hit = zoneOn(f, [u.cell]); scheduleReaction(f, hit, u); u.react = null; persZoneImpact(f, hit);
    expect(u.ps!.streak).toBe(0);
    for (let i = 0; i < 3; i++) { const t = zoneOn(f, [u.cell]); scheduleReaction(f, t, u); u.react = null; t.cells.delete(u.cell); persZoneImpact(f, t); }
    expect(persDps(f, u)).toBeCloseTo(1.2);
  });
  it('화풀이: 한 번에 15% 넘게 맞으면 3초 딜 +15%', () => {
    const f = fight({ melee: '화풀이' }), u = who(f, '근');
    damage(f, u, u.max * 0.1 / f.dmgMult, false, 'fixed');
    expect(persDps(f, u)).toBe(1);
    damage(f, u, u.max * 0.2 / f.dmgMult, false, 'fixed');
    expect(persDps(f, u)).toBeCloseTo(1.15);
  });
});

describe('리듬', () => {
  it('폭주기관차: 30초마다 끝 5초 딜 ×1.5 · 장판 안 피함', () => {
    const f = fight({ melee: '폭주기관차' }), u = who(f, '근');
    f.t = 20; expect(persDps(f, u)).toBe(1); expect(persIgnoresZone(f, u)).toBe(false);
    f.t = 26; expect(persDps(f, u)).toBeCloseTo(1.5); expect(persIgnoresZone(f, u)).toBe(true);
    f.t = 31; expect(persDps(f, u)).toBe(1);
  });
  it('쉬엄쉬엄: 25초마다 끝 2초 쉼 (딜 0, 회피 +20%p)', () => {
    const f = fight({ melee: '쉬엄쉬엄' }), u = who(f, '근');
    f.t = 22; expect(persDps(f, u)).toBe(1);
    f.t = 23.5; expect(persDps(f, u)).toBe(0); expect(persDodge(f, u)).toBeCloseTo(0.2);
  });
  it('타이밍 장인: 보스가 멍한 동안 딜 ×2', () => {
    const f = fight({ melee: '타이밍 장인' }), u = who(f, '근');
    expect(persDps(f, u)).toBe(1);
    f.daze = { name: '무방비', until: f.t + 5, vuln: 1.3 } as never;
    expect(persDps(f, u)).toBe(2);
  });
  it('끈기형: 30초마다 반응 ×0.95, 최대 ×0.8', () => {
    const f = fight({ melee: '끈기형' }), u = who(f, '근');
    const tel = { skill: { key: 'zz' } } as unknown as Telegraph;
    expect(persReact(f, u, tel)).toBe(1);
    f.t = 65; expect(persReact(f, u, tel)).toBeCloseTo(0.95 ** 2);
    f.t = 900; expect(persReact(f, u, tel)).toBeCloseTo(0.8);
  });
});

describe('전투 전체', () => {
  it('새 25종이 섞인 파티 (능력 있음)로 여러 판을 끝까지 돌려도 숫자가 깨지지 않음', () => {
    const tank = NEW25.filter(p => !('noTank' in PERS[p])), dealer = NEW25;
    for (let s = 0; s < 14; s++) {
      const pick = (i: number, list: PersName[]) => list[(s * 3 + i) % list.length];
      const party: RosterEntry[] = [
        R('tank', 'warrior', pick(0, tank), 't', 'warrior.defStance'), R('melee', 'rogue', pick(1, dealer), 'm', 'rogue.evasion'),
        R('ranged', 'mage', pick(2, dealer), 'r1', 'mage.iceBarrier'), R('ranged', 'hunter', pick(3, dealer), 'r2', 'hunter.trap'),
      ];
      for (const enc of ['warden', 'plague']) {
        const f = E.simulate({ encounter: enc as never, diff: '어려움', gear: 'adv0', seed: s + 1, party });
        expect(['win', 'lose']).toContain(f.over);
        expect(Number.isFinite(f.bossHp) && f.party.every(u => Number.isFinite(u.hp))).toBe(true);
      }
    }
  });
  it('공개모집 (70종) 파티는 같은 시드 같은 결과, 탱커 자리에 탱커 불가 없음 · 딜러 자리에 탱커 묶음 없음', () => {
    for (const enc of ['plague', 'choir', 'warden'] as const) for (let s = 1; s <= 60; s++) {
      const p = E.recruitParty(enc, s, { abilities: true });
      for (const m of p) expect(m.role === 'tank' ? 'noTank' in PERS[m.pers] : 'tankOnly' in PERS[m.pers], m.pers).toBe(false);
    }
    const party = E.recruitParty('choir', 4, { abilities: true });
    const a = E.simulate({ encounter: 'choir', diff: '악몽', gear: 'rare5', seed: 4, party }), b = E.simulate({ encounter: 'choir', diff: '악몽', gear: 'rare5', seed: 4, party });
    expect([a.over, a.t, a.bossHp]).toEqual([b.over, b.t, b.bossHp]);
  });
});
