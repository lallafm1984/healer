/** 파티원 성격 30종 (75 문서): 새 20종의 데이터와 전투 행동 */
import { describe, expect, it } from 'vitest';
import { PERS, PERS_NAMES, PROTO_PERS, SULK, type PersName } from '../src/data/personalities';
import type { ClassKey } from '../src/data/classes';
import * as E from '../src/engine';
import { addDebuff, damage, heal } from '../src/engine/core';
import { moveTo } from '../src/engine/movement';
import { persDps, persGuard, persReact } from '../src/engine/persona';
import { stepAway, unitDps } from '../src/engine/units';
import type { RosterEntry, Telegraph, Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const R = (role: RosterEntry['role'], cls: ClassKey, pers: PersName, nick = `${pers}`): RosterEntry => ({ role, cls, pers, nick });
/** 5인 (탱커 전사 · 근접 도적 · 원거리 마법사 · 궁수). who = 근접 자리 성격 */
const fight = (who: PersName, o: { enc?: string; others?: PersName } = {}): F => E.create({
  encounter: (o.enc ?? 'warden') as never, diff: '보통', seed: 1,
  party: [R('tank', 'warrior', '신중파', '탱'), R('melee', 'rogue', who, '주인공'), R('ranged', 'mage', o.others ?? '사교형', '마'), R('ranged', 'archer', o.others ?? '사교형', '궁')],
});
const hero = (f: F) => f.party.find(u => u.nick === '주인공')!;
const bark = (f: F, sit: string) => f.events.some(e => e.type === 'bark' && e.sit === sit);

describe('데이터', () => {
  it('30종: 앞 10종은 프로토타입 순서, 분류 5개, ★ 9 · 16 · 5, 탱커 불가 5, 희귀 4', () => {
    expect(PERS_NAMES.length).toBe(30);
    expect(PROTO_PERS).toEqual(['신중파', '딜 욕심쟁이', '고집불통', '덜렁이', '허세꾼', '외톨이', '사교형', '관심종자', '감사형', '겁쟁이']);
    const all = Object.values(PERS) as { star: number; cat: string; ch: string; noTank?: boolean; rare?: boolean; desc: string }[];
    expect([1, 2, 3].map(s => all.filter(p => p.star === s).length)).toEqual([9, 16, 5]);
    expect(new Set(all.map(p => p.cat))).toEqual(new Set(['회피', '위치', '관계', '감정', '리듬']));
    expect(PERS_NAMES.filter(p => 'noTank' in PERS[p])).toEqual(['덜렁이', '겁쟁이', '따라쟁이', '방랑자', '소심이']);
    expect(PERS_NAMES.filter(p => 'rare' in PERS[p])).toEqual(['눈치백단', '미신쟁이', '경쟁심', '몰입형']);
    expect(new Set(all.map(p => p.ch)).size).toBe(30);
    for (const p of all) expect(p.desc).toMatch(/니다\.$/);
  });

  it('예전 10종만 있는 파티는 새 성격 훅이 꺼짐 (프로토타입 일치)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 3 });
    expect(f.persOn).toBe(false);
    expect(f.party.every(u => !u.ps)).toBe(true);
  });
});

describe('리듬 · 감정 배율', () => {
  it('용두사미: 60초까지 ×1.3, 그 뒤 ×0.9 (넘어갈 때 한마디)', () => {
    const f = fight('용두사미'), u = hero(f);
    expect(persDps(f, u)).toBeCloseTo(1.3);
    f.t = 61; expect(persDps(f, u)).toBeCloseTo(0.9);
  });
  it('대기만성: ×0.8에서 30초마다 +0.1, 최대 ×1.4', () => {
    const f = fight('대기만성'), u = hero(f);
    expect(persDps(f, u)).toBeCloseTo(0.8);
    f.t = 95; expect(persDps(f, u)).toBeCloseTo(1.1);
    f.t = 400; expect(persDps(f, u)).toBeCloseTo(1.4);
  });
  it('몰입형: 크게 안 맞은 5초마다 +5% (최대 +40%), 최대 체력 5% 넘게 맞으면 처음부터', () => {
    const f = fight('몰입형'), u = hero(f);
    f.t = 20; expect(persDps(f, u)).toBeCloseTo(1.2);
    f.t = 100; expect(persDps(f, u)).toBeCloseTo(1.4);
    damage(f, u, u.max * 0.02 / f.dmgMult, false, 'fixed');
    expect(persDps(f, u)).toBeCloseTo(1.4); // 작은 피해는 그대로
    damage(f, u, u.max * 0.1 / f.dmgMult, false, 'fixed');
    expect(persDps(f, u)).toBeCloseTo(1);
    expect(bark(f, 'focusBroken')).toBe(true);
  });
  it('완벽주의자: 평소 +10%, 한 번에 15% 넘게 맞으면 8초 동안 −20% · 반응 ×1.3', () => {
    const f = fight('완벽주의자'), u = hero(f);
    expect(persDps(f, u)).toBeCloseTo(1.1);
    damage(f, u, u.max * 0.2 / f.dmgMult, false, 'fixed');
    expect(persDps(f, u)).toBeCloseTo(0.8);
    expect(bark(f, 'shaken')).toBe(true);
    f.t += 9; expect(persDps(f, u)).toBeCloseTo(1.1);
  });
  it('승부사: 보스 30% 아래 딜 +20% · 회피 −10%p', () => {
    const f = fight('승부사'), u = hero(f);
    const d0 = unitDps(u, f);
    f.bossHp = f.bossMax * 0.25;
    expect(persDps(f, u)).toBeCloseTo(1.2);
    expect(unitDps(u, f) / d0).toBeCloseTo(1.2);
  });
  it('다혈질: 아군이 쓰러지면 10초 분노 (딜 +30%, 장판 안 피함)', () => {
    const f = fight('다혈질'), u = hero(f);
    const ally = f.party.find(x => x.nick === '마')!;
    damage(f, ally, ally.max * 10, false, 'fixed');
    expect(ally.alive).toBe(false);
    expect(persDps(f, u)).toBeCloseTo(1.3);
    expect(bark(f, 'rage')).toBe(true);
    f.t += 11; expect(persDps(f, u)).toBeCloseTo(1);
  });
  it('경쟁심: 같은 역할 딜 1위가 아니면 +15%, 1위가 되면 보통', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, party: [
      R('tank', 'warrior', '신중파', '탱1'), R('tank', 'paladin', '신중파', '탱2'), R('melee', 'rogue', '경쟁심', '주인공'), R('melee', 'berserker', '사교형', '근2'),
      R('melee', 'swordsman', '사교형', '근3'), R('ranged', 'mage', '사교형', '원1'), R('ranged', 'archer', '사교형', '원2'), R('ranged', 'hunter', '사교형', '원3'), R('ranged', 'mage', '사교형', '원4'),
    ] });
    const u = hero(f), rival = f.party.find(x => x.nick === '근2')!;
    rival.dealt = 1000; u.dealt = 10;
    steps(f, 1.1);
    expect(persDps(f, u)).toBeCloseTo(1.15);
    u.dealt = 1e9; f.t = 20; steps(f, 1.1);
    expect(persDps(f, u)).toBeCloseTo(1);
  });
});

describe('위치 · 관계', () => {
  it('느림보: 이동 시간 ×2', () => {
    const f = fight('느림보', { others: '사교형' }), u = hero(f), v = f.party.find(x => x.nick === '마')!;
    const free = f.cells.filter(c => !c.unit && !c.block);
    moveTo(f, u, free[0]); moveTo(f, v, free[1]);
    expect(u.moving!.total / (0.4 * Math.max(1, E.hexDist(f.cells[u.cell], free[0])))).toBeCloseTo(2);
    expect(v.moving!.total / (0.4 * Math.max(1, E.hexDist(f.cells[v.cell], free[1])))).toBeCloseTo(1);
  });
  it('미신쟁이: 시작 칸이 명당 (+25%), 밀려나면 5초 −20%', () => {
    const f = fight('미신쟁이'), u = hero(f);
    expect(u.ps!.lucky).toBe(u.home);
    expect(persDps(f, u)).toBeCloseTo(1.25);
    const to = f.cells.find(c => !c.unit && !c.block && E.hexDist(c, f.cells[u.cell]) === 1)!;
    moveTo(f, u, to); u.home = to.i;
    steps(f, 1.2);
    expect(persDps(f, u)).toBeCloseTo(0.8);
    expect(bark(f, 'luckLost') || u.ps!.luckLostUntil! > f.t).toBe(true);
  });
  it('따라쟁이: 탱커 옆에 서고, 탱커가 옮기면 따라감', () => {
    const f = fight('따라쟁이'), u = hero(f), tank = f.party.find(x => x.role === 'tank')!;
    expect(E.hexDist(f.cells[u.cell], f.cells[tank.cell])).toBe(1);
    const far = f.cells.filter(c => !c.unit && !c.block).sort((a, b) => E.hexDist(b, f.cells[u.cell]) - E.hexDist(a, f.cells[u.cell]))[0];
    moveTo(f, tank, far); tank.home = far.i;
    steps(f, 4);
    expect(E.hexDist(f.cells[u.moving ? u.moving.to : u.cell], f.cells[tank.moving ? tank.moving.to : tank.cell])).toBe(1);
  });
  it('방랑자: 15초마다 30%로 근처 빈 칸 (거기가 새 자리)', () => {
    const f = fight('방랑자'), u = hero(f), home = u.home;
    f.rng = () => 0; // 꼭 옮김
    steps(f, 15.5);
    expect(u.home).not.toBe(home);
  });
  it('영웅: 반경 2 아군이 25% 아래면 5초 동안 그 피해 30%를 대신 받음', () => {
    const f = fight('영웅'), u = hero(f);
    const ally = f.party.filter(x => x !== u && !x.me && x.role !== 'tank').sort((a, b) => E.hexDist(f.cells[a.cell], f.cells[u.cell]) - E.hexDist(f.cells[b.cell], f.cells[u.cell]))[0];
    expect(E.hexDist(f.cells[ally.cell], f.cells[u.cell])).toBeLessThanOrEqual(2);
    ally.hp = ally.max * 0.2;
    steps(f, 0.25);
    expect(ally.coverBy?.id).toBe(u.id);
    const h0 = u.hp, a0 = ally.hp;
    damage(f, ally, 100, false, 'fixed');
    expect((h0 - u.hp) / ((h0 - u.hp) + (a0 - ally.hp))).toBeCloseTo(0.3, 1);
  });
  it('응원단장: 옆 아군이 위험하면 옆 아군 딜 +10% 5초', () => {
    const f = fight('응원단장'), u = hero(f);
    const near = f.party.filter(x => x !== u && !x.me && E.hexDist(f.cells[x.cell], f.cells[u.cell]) === 1);
    expect(near.length).toBeGreaterThan(0);
    near[0].hp = near[0].max * 0.2;
    steps(f, 0.25);
    expect(persDps(f, near[0])).toBeCloseTo(1.1);
    f.t += 6; expect(persDps(f, near[0])).toBeCloseTo(1);
  });
  it('이기주의자: 옆 아군이 위험하면 옆 사람이 더 적은 칸으로', () => {
    const f = fight('이기주의자'), u = hero(f);
    const near = f.party.filter(x => x !== u && !x.me && E.hexDist(f.cells[x.cell], f.cells[u.cell]) === 1);
    expect(near.length).toBeGreaterThan(0);
    near[0].hp = near[0].max * 0.2;
    const adj = (c: number) => f.party.filter(x => x !== u && x.alive && E.hexDist(f.cells[x.cell], f.cells[c]) === 1).length;
    const before = adj(u.cell);
    steps(f, 0.25);
    expect(u.moving).not.toBeNull();
    expect(adj(u.moving!.to)).toBeLessThan(before);
  });
});

describe('회피 · 위기', () => {
  it('뉴비: 반응 ×1.6에서 같은 기술을 볼 때마다 ×0.85 (3번까지), 회피도 늘어남', () => {
    const f = fight('뉴비'), u = hero(f);
    const tel = { skill: { key: 'zz', name: '장판' } } as unknown as Telegraph;
    const r = [0, 1, 2, 3, 4].map(() => persReact(f, u, tel));
    expect(r[0]).toBeCloseTo(1.6);
    expect(r[3]).toBeCloseTo(1.6 * 0.85 ** 3);
    expect(r[4]).toBeCloseTo(r[3]);
  });
  it('낙천가 · 비관론자: 생존 능력 체력 기준', () => {
    const f1 = fight('낙천가'), f2 = fight('비관론자');
    expect(persGuard(hero(f1), 0.3)).toBeCloseTo(0.15);
    expect(persGuard(hero(f2), 0.3)).toBeCloseTo(0.6);
    expect(persGuard(hero(f2), 0.7)).toBeCloseTo(0.7);
  });
  it('소심이: 디버프가 걸리면 당황 (딜 0), 해제하면 바로 진정', () => {
    const f = fight('소심이'), u = hero(f);
    addDebuff(f, u, { name: '독', type: '독', left: 10, dot: 1 } as never);
    expect(persDps(f, u)).toBe(0);
    expect(bark(f, 'panic')).toBe(true);
    u.debuffs = [];
    steps(f, 0.25);
    expect(u.ps!.panicUntil).toBeUndefined();
    expect(persDps(f, u)).toBe(1);
  });
  it('침착함: 옮겨붙는 디버프를 받으면 회피율과 상관없이 꼭 비켜 섬', () => {
    let moved = 0;
    for (let s = 1; s <= 10; s++) {
      const f = E.create({ encounter: 'warden', diff: '악몽', seed: s, party: [R('tank', 'warrior', '신중파'), R('melee', 'rogue', '침착함', '주인공'), R('ranged', 'mage', '사교형'), R('ranged', 'archer', '외톨이')] });
      const u = hero(f);
      f.rng = () => 0.999; // 회피 굴림은 늘 실패
      if (!f.party.some(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1)) continue;
      if (stepAway(f, u, 5)) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });
  it('눈치백단: 반응 ×0.3 · 회피 +20%p · 딜 0.95', () => {
    expect(PERS['눈치백단']).toMatchObject({ react: 0.3, dodge: 0.2, dps: 0.95 });
  });
});

describe('전투 전체', () => {
  it('새 20종이 섞인 파티로 여러 판을 끝까지 돌려도 숫자가 깨지지 않음', () => {
    const fresh = PERS_NAMES.slice(10) as PersName[];
    const tankOk = fresh.filter(p => !('noTank' in PERS[p]));
    for (let s = 0; s < 12; s++) {
      const pick = (i: number, list: PersName[]) => list[(s * 3 + i) % list.length];
      const party: RosterEntry[] = [R('tank', 'warrior', pick(0, tankOk), 't'), R('melee', 'rogue', pick(1, fresh), 'm'), R('ranged', 'mage', pick(2, fresh), 'r1'), R('ranged', 'hunter', pick(3, fresh), 'r2')];
      const r = E.simulate({ encounter: 'warden', diff: '보통', gear: 'rare5', seed: s + 1, party });
      expect(['win', 'lose']).toContain(r.over);
      expect(Number.isFinite(r.t)).toBe(true);
    }
  });
  it('예전 성격 파티는 결과가 그대로 (같은 시드 같은 결과)', () => {
    const a = E.simulate({ encounter: 'warden', diff: '보통', gear: 'rare5', seed: 5 });
    const b = E.simulate({ encounter: 'warden', diff: '보통', gear: 'rare5', seed: 5 });
    expect([a.over, a.t, a.bossHp, a.stats.deaths]).toEqual([b.over, b.t, b.bossHp, b.stats.deaths]);
  });
});

describe('관심종자 삐짐 (2026-10-16 Lim 「너무 자주 · 힐해 주고 끝나면 또 삐짐」)', () => {
  /** 보스 기술 · 딜을 끄고 sec초 (삐짐 말 횟수를 셈) */
  const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
  const run = (f: F, sec: number) => { let n = 0; const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); n += f.events.filter(e => e.type === 'bark' && e.sit === 'sulk').length; f.events.length = 0; } return n; };

  it('12초에 삐짐 → 힐로 풀림 → 60초 안엔 다시 안 삐짐 → 두 번째 뒤 25초면 혼자 풀리고 그 판엔 더 안 삐짐', () => {
    const f = fight('관심종자'); quiet(f);
    const u = hero(f);
    expect(run(f, 11.5)).toBe(0);
    expect(run(f, 1)).toBe(1);
    expect(u.sulking).toBe(true);
    heal(f, u, 1, true);
    expect(u.sulking).toBe(false);
    const healed = f.t;
    expect(run(f, SULK.again - 1)).toBe(0);
    expect(u.sulking).toBe(false);
    expect(run(f, 1.5)).toBe(1);
    expect(u.sulking).toBe(true);
    expect(f.t - healed).toBeGreaterThan(SULK.again);
    expect(run(f, SULK.long - 1)).toBe(0);
    expect(u.sulking).toBe(true);
    run(f, 1.5);
    expect(u.sulking).toBe(false);
    expect(run(f, 200)).toBe(0); // 한 전투 SULK.max번까지
    expect(u.sulkN).toBe(SULK.max);
  });

  it('프로토타입 일치 판은 옛 규칙 (힐 받고 12초면 또 삐짐)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, proto: true, party: [R('tank', 'warrior', '신중파', '탱'), R('melee', 'rogue', '관심종자', '주인공')] });
    quiet(f);
    const u = hero(f);
    for (let i = 0; i < 4; i++) { run(f, 13); expect(u.sulking, `${i + 1}번째`).toBe(true); heal(f, u, 1, true); } // 프로토타입 말에는 sit이 없음
  });
});

export type { Unit };
