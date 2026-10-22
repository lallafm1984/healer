/** 파티원 성격 95 문서 1차 (2026-10-18): 새 묶음 손버릇 · 탱커 · 힐 15종의 데이터와 전투 행동 */
import { describe, expect, it } from 'vitest';
import { CATS, PERS, PERS_NAMES, type PersCat, type PersName } from '../src/data/personalities';
import type { AddDef } from '../src/data/bosses';
import type { ClassKey } from '../src/data/classes';
import * as E from '../src/engine';
import { abCut, abOnTel, shieldShown } from '../src/engine/abilities';
import { runEffect } from '../src/engine/bossParts';
import { damage, heal, takenAmt } from '../src/engine/core';
import { gatherMult, persCast, persDps, persHealTaken, persLate } from '../src/engine/persona';
import { slipping } from '../src/engine/threat';
import type { BossSkill, RosterEntry, Telegraph } from '../src/engine/types';
import { CLASSES } from '../src/data/classes';
import { makeCandidates } from '../src/game/guild';
import { newSave } from '../src/platform/storage';

type F = ReturnType<typeof E.create>;
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const R = (role: RosterEntry['role'], cls: ClassKey, pers: PersName, nick: string, ab?: string): RosterEntry => ({ role, cls, pers, nick, ab });
/** 5인: 탱커 전사 (tank) · 근접 도적 · 원거리 마법사 · 궁수. 보스 기술은 끔 */
const fight = (o: { tank?: [PersName, string?]; melee?: [PersName, string?]; mage?: [PersName, string?]; archer?: [PersName, string?]; enc?: string } = {}): F => {
  const f = E.create({
    encounter: (o.enc ?? 'warden') as never, diff: '보통', seed: 1,
    party: [
      R('tank', 'warrior', o.tank?.[0] ?? '신중파', '탱', o.tank?.[1]), R('melee', 'rogue', o.melee?.[0] ?? '사교형', '근', o.melee?.[1]),
      R('ranged', 'mage', o.mage?.[0] ?? '사교형', '마', o.mage?.[1]), R('ranged', 'archer', o.archer?.[0] ?? '사교형', '궁', o.archer?.[1]),
    ],
  });
  f.skills.forEach(s => { s.next = Infinity; });
  return f;
};
const who = (f: F, nick: string) => f.party.find(u => u.nick === nick)!;
const IMP: AddDef = { name: '꼬마 악마', short: '악마', hp: 0.5, dmg: 20, every: 2 };
const NEW15: PersName[] = ['쿨 아끼미', '스킬 난사', '끊기 욕심', '쫄 사냥꾼', '외골수', '미리미리', '아슬아슬', '쫄 모으기', '어그로 흘림', '든든이', '자급자족', '보호막 애호가', '지속힐 체질', '큰 힐 체질', '자립형'];

describe('데이터', () => {
  it('30종 뒤에 15종: 손버릇 5 · 탱커 6 · 힐 4, 탱커 묶음은 탱커만 · 외골수는 탱커 불가', () => {
    expect(PERS_NAMES.slice(30, 45)).toEqual(NEW15);
    const by = (c: PersCat) => NEW15.filter(p => PERS[p].cat === c);
    expect([by('손버릇').length, by('탱커').length, by('힐').length]).toEqual([5, 6, 4]);
    expect(PERS_NAMES.filter(p => 'tankOnly' in PERS[p])).toEqual(by('탱커'));
    expect(PERS_NAMES.filter(p => 'tankOnly' in PERS[p] && 'noTank' in PERS[p])).toEqual([]);
    expect('noTank' in PERS['외골수']).toBe(true);
    expect(new Set(Object.values(CATS)).size).toBe(Object.keys(CATS).length);
    for (const p of NEW15) expect(PERS[p].desc).toMatch(/니다\.$/);
  });
});

describe('손버릇', () => {
  it('쿨 아끼미: 위기 전엔 직업 스킬을 안 쓰고, 위기에 쓰면 효과 ×1.25', () => {
    const f = fight({ archer: ['쿨 아끼미', 'archer.aimedShot'] }), u = who(f, '궁');
    steps(f, 3);
    expect(u.ab!.uses).toBe(0);
    const ally = who(f, '마'); ally.hp = ally.max * 0.3;
    steps(f, 0.25);
    expect(u.ab!.uses).toBe(1);
    expect(u.mods.find(m => m.k === 'dps')!.v).toBeCloseTo(0.25 * 1.25);
  });
  it('쿨 아끼미: 보스 체력 30% 아래도 위기', () => {
    const f = fight({ archer: ['쿨 아끼미', 'archer.aimedShot'] }), u = who(f, '궁');
    f.bossHp = f.bossMax * 0.29;
    steps(f, 1.5);
    expect(u.ab!.uses).toBe(1);
  });
  it('스킬 난사: 쓰는 때와 상관없이 쿨이 돌자마자 씀 (2초부터)', () => {
    const f = fight({ archer: ['스킬 난사', 'archer.camo'] }), u = who(f, '궁');
    steps(f, 1.8);
    expect(u.ab!.uses).toBe(0);
    steps(f, 0.5);
    expect(u.ab!.uses).toBe(1);
    steps(f, 60.5);
    expect(u.ab!.uses).toBe(2);
  });
  it('스킬 난사: 죽을 피해에 쓰는 능력 (얼음 방패)은 난사하지 않음', () => {
    const f = fight({ mage: ['스킬 난사', 'mage.iceBlock'] }), u = who(f, '마');
    steps(f, 5);
    expect(u.ab!.uses).toBe(0);
  });
  it('끊기 욕심: 먼저 끊고 성공률 +15%p, 시전을 노려보는 2초 동안 장판 반응 +0.6초', () => {
    const f = fight({ mage: ['신중파', 'mage.counterspell'], archer: ['끊기 욕심', 'archer.harass'] });
    const kicker = who(f, '궁'), mage = who(f, '마');
    f.rng = () => 0.7; // 주문 차단 60% · 견제 사격 60% + 15%p = 75%
    const s = { cut: true, kind: 'aoe', key: 'boom', name: '대폭발' } as unknown as BossSkill;
    expect(abCut(f, s)).toBe(true);
    expect(kicker.ab!.uses).toBe(1);
    expect(mage.ab!.uses).toBe(0);
    expect(persLate(f, kicker)).toBe(0);
    persCast(f);
    expect(persLate(f, kicker)).toBeCloseTo(0.6);
    expect(persLate(f, mage)).toBe(0);
    f.t += 2.1;
    expect(persLate(f, kicker)).toBe(0);
  });
  it('쫄 사냥꾼: 쫄에게 딜 ×1.3, 쫄이 없으면 보스에게 ×0.9', () => {
    const dealt = (p: PersName) => {
      const f = fight({ melee: [p] });
      f.party.forEach(u => { if (u.nick !== '근') u.dps = 0; });
      runEffect(f, {} as BossSkill, { p: 'adds', n: 1, add: IMP });
      const m = f.mobs.find(x => x.add)!;
      const b0 = f.bossHp;
      steps(f, 6);
      const toAdd = m.max - m.hp;
      m.alive = false; m.hp = 0; f.mobs = f.mobs.filter(x => x !== m);
      const b1 = f.bossHp;
      steps(f, 6);
      return { toAdd, toBoss: b1 - f.bossHp, leak: b0 - b1 };
    };
    const base = dealt('사교형'), hunt = dealt('쫄 사냥꾼');
    expect(base.toAdd).toBeGreaterThan(0);
    expect(hunt.toAdd / base.toAdd).toBeCloseTo(1.3, 2);
    expect(hunt.toBoss / base.toBoss).toBeCloseTo(0.9, 2);
  });
  it('외골수: 쫄을 안 치고 보스만 (×1.1)', () => {
    const run = (p: PersName) => {
      const f = fight({ melee: [p] });
      f.party.forEach(u => { if (u.nick !== '근') u.dps = 0; });
      runEffect(f, {} as BossSkill, { p: 'adds', n: 1, add: IMP });
      const m = f.mobs.find(x => x.add)!, b0 = f.bossHp;
      steps(f, 6);
      return { toAdd: m.max - m.hp, toBoss: b0 - f.bossHp };
    };
    const base = run('사교형'), one = run('외골수');
    expect(base.toBoss).toBe(0);
    expect(one.toAdd).toBe(0);
    expect(one.toBoss / base.toAdd).toBeCloseTo(1.1, 2);
  });
});

describe('탱커', () => {
  const buster = (f: F, id: number, sec = 2): Telegraph => {
    const tel = { id: f.nextId++, kind: 'buster', units: [id], start: f.t, impact: f.t + sec, cells: new Set<number>(), skill: { name: '강타', dmg: 100, hit: () => {} } } as unknown as Telegraph;
    f.tels.push(tel);
    return tel;
  };
  it('미리미리: 강타 예고가 뜨면 체력 조건 생존기 (방어 태세)도 바로 켬', () => {
    for (const [p, used] of [['미리미리', 1], ['신중파', 0]] as const) {
      const f = fight({ tank: [p, 'warrior.defStance'] }), tk = who(f, '탱');
      abOnTel(f, buster(f, tk.id));
      expect(tk.ab!.uses, p).toBe(used);
    }
  });
  it('아슬아슬: 강타 0.3초 전에 켜서 효과 ×1.2, 늦으면 맞은 뒤에 켬', () => {
    const f = fight({ tank: ['아슬아슬', 'warrior.defStance'] }), tk = who(f, '탱');
    f.rng = () => 0; // 딱 맞춤
    const tel = buster(f, tk.id, 2);
    abOnTel(f, tel);
    expect(tk.ab!.uses).toBe(0);
    steps(f, 1.6);
    expect(tk.ab!.uses).toBe(0);
    steps(f, 0.15);
    expect(tk.ab!.uses).toBe(1);
    expect(tk.mods.find(m => m.k === 'cut')!.v).toBeCloseTo(0.3 * 1.2);

    const g = fight({ tank: ['아슬아슬', 'warrior.defStance'] }), t2 = who(g, '탱');
    g.rng = () => 0.99; // 늦음
    const tel2 = buster(g, t2.id, 1);
    abOnTel(g, tel2);
    steps(g, 1);
    g.tels = g.tels.filter(t => t !== tel2); // 맞음
    expect(t2.ab!.uses).toBe(0);
    steps(g, 0.3);
    expect(t2.ab!.uses).toBe(1);
    expect(t2.mods.find(m => m.k === 'cut')!.v).toBeCloseTo(0.3);
  });
  it('쫄 모으기: 딜러를 때리는 쫄을 1초 뒤 끌어오고, 둘 이상 모이면 쫄 딜 ×1.25', () => {
    const f = fight({ tank: ['쫄 모으기'] }), tk = who(f, '탱');
    runEffect(f, {} as BossSkill, { p: 'adds', n: 2, add: IMP });
    const adds = f.mobs.filter(m => m.add);
    expect(adds.length).toBe(2);
    expect(adds.every(m => m.add!.on !== tk.id)).toBe(true);
    expect(gatherMult(f)).toBe(1);
    steps(f, 1.5);
    expect(adds.every(m => m.add!.on === tk.id)).toBe(true);
    expect(gatherMult(f)).toBeCloseTo(1.25);
  });
  it('어그로 흘림 (96 A안): 15초부터 20초마다 3초 동안 위협 쌓기가 멈춤, 탱커 딜 ×1.2', () => {
    const f = fight({ tank: ['어그로 흘림'] }), tk = who(f, '탱');
    expect(persDps(f, tk)).toBeCloseTo(1.2);
    const at = (t: number) => { f.t = t; return slipping(f, tk); };
    expect([at(14.9), at(15.1), at(17.9), at(18.1), at(35.5), at(38.5)]).toEqual([false, true, true, false, true, false]);
  });
  it('든든이: 체력 50% 넘으면 옆 아군이 받는 피해 −5% (강타 예고 숫자도 같은 계산)', () => {
    const f = fight({ tank: ['든든이'] }), tk = who(f, '탱');
    const near = f.party.find(u => u !== tk && E.hexDist(f.cells[u.cell], f.cells[tk.cell]) === 1)!;
    const far = f.party.find(u => u !== tk && E.hexDist(f.cells[u.cell], f.cells[tk.cell]) > 1);
    const base = takenAmt(f, tk, 100, false, 'fixed');
    expect(takenAmt(f, near, 100, false, 'fixed') / base).toBeCloseTo(0.95);
    if (far) expect(takenAmt(f, far, 100, false, 'fixed')).toBeCloseTo(base);
    tk.hp = tk.max * 0.4;
    expect(takenAmt(f, near, 100, false, 'fixed')).toBeCloseTo(base);
  });
  it('자급자족: 체력 40% 아래면 스스로 15% 회복, 30초에 한 번', () => {
    const f = fight({ tank: ['자급자족'] }), tk = who(f, '탱');
    tk.hp = tk.max * 0.3;
    steps(f, 0.25);
    expect(tk.hp / tk.max).toBeCloseTo(0.45, 2);
    tk.hp = tk.max * 0.3;
    steps(f, 10);
    expect(tk.hp / tk.max).toBeCloseTo(0.3, 2);
    steps(f, 20.5);
    expect(tk.hp / tk.max).toBeCloseTo(0.45, 2);
  });
});

describe('힐', () => {
  it('보호막 애호가: 최대 체력 3% 넘는 보호막을 받으면 5초 딜 +15%', () => {
    const f = fight({ melee: ['보호막 애호가'] }), u = who(f, '근');
    shieldShown(f, u, u.max * 0.01);
    expect(persDps(f, u)).toBe(1);
    shieldShown(f, u, u.max * 0.1);
    expect(persDps(f, u)).toBeCloseTo(1.15);
    f.t += 5.1;
    expect(persDps(f, u)).toBe(1);
  });
  it('지속힐 체질 · 큰 힐 체질: 직접 힐과 지속 · 간접 회복 배율', () => {
    const f = fight({ melee: ['지속힐 체질'], mage: ['큰 힐 체질'] });
    expect([persHealTaken(who(f, '근'), true), persHealTaken(who(f, '근'), false)]).toEqual([0.9, 1.2]);
    expect([persHealTaken(who(f, '마'), true), persHealTaken(who(f, '마'), false)]).toEqual([1.2, 0.9]);
    const got = (nick: string, direct: boolean) => { const u = who(f, nick); u.hp = 1; return heal(f, u, 50, direct, true); };
    expect(got('근', false) / got('궁', false)).toBeCloseTo(1.2);
    expect(got('마', true) / got('궁', true)).toBeCloseTo(1.2);
  });
  it('자립형: 체력 60% 넘으면 3초마다 최대 체력 2%, 받는 치유 ×0.9', () => {
    const f = fight({ melee: ['자립형'] }), u = who(f, '근');
    u.hp = u.max * 0.7;
    steps(f, 3.3);
    expect(u.hp / u.max).toBeCloseTo(0.74, 2); // 0.2초 · 3.2초 두 번
    u.hp = u.max * 0.5;
    steps(f, 6);
    expect(u.hp / u.max).toBeCloseTo(0.5, 2);
    expect(persHealTaken(u, true)).toBeCloseTo(0.9);
  });
});

describe('공개모집 · 길드 (2026-10-18 길드 다시 켬)', () => {
  it('길드 지원자: 탱커는 탱커 불가 성격 없음, 딜러는 탱커 묶음 없음, 새 성격도 나옴', () => {
    const rng = E.rngFrom(11);
    const s = newSave(1);
    s.player.level = 40;
    const got = new Set<PersName>();
    for (let i = 0; i < 1500; i++) {
      // 희귀율 3%와 별개로 두 후보 풀의 성격/직업 계약을 모두 검사한다.
      let roll = 0;
      const c = makeCandidates(s, () => roll++ % 3 === 0 ? (i % 2 ? 0 : 0.99) : rng())[0], tank = CLASSES[c.cls].role === 'tank'; // 지원자마다 굴림 셋: 희귀 여부 · 목표 레벨 · 사람
      expect('noTank' in PERS[c.pers] && tank, `${c.cls} ${c.pers}`).toBe(false);
      expect('tankOnly' in PERS[c.pers] && !tank, `${c.cls} ${c.pers}`).toBe(false);
      got.add(c.pers);
    }
    expect(NEW15.filter(p => !got.has(p))).toEqual([]);
  });
  it('공개모집: 탱커 묶음은 탱커 자리에만, 외골수는 탱커 자리에 안 나옴', () => {
    for (const enc of ['warden', 'plague', 'choir'] as const) for (let s = 1; s <= 120; s++) for (const m of E.recruitParty(enc, s)) {
      if (m.role === 'tank') expect('noTank' in PERS[m.pers], m.pers).toBe(false);
      else expect('tankOnly' in PERS[m.pers], m.pers).toBe(false);
    }
  });
});

describe('전투 전체', () => {
  it('새 15종이 섞인 파티 (능력 있음)로 여러 판을 끝까지 돌려도 숫자가 깨지지 않음', () => {
    const tank = NEW15.filter(p => !('noTank' in PERS[p]));
    const dealer = NEW15.filter(p => !('tankOnly' in PERS[p]));
    for (let s = 0; s < 12; s++) {
      const pick = (i: number, list: PersName[]) => list[(s * 3 + i) % list.length];
      const party: RosterEntry[] = [
        R('tank', 'warrior', pick(0, tank), 't', ['warrior.shieldBlock', 'warrior.defStance', 'warrior.shieldWall'][s % 3]),
        R('melee', 'rogue', pick(1, dealer), 'm', 'rogue.kick'), R('ranged', 'mage', pick(2, dealer), 'r1', 'mage.counterspell'), R('ranged', 'hunter', pick(3, dealer), 'r2', 'hunter.trap'),
      ];
      for (const enc of ['warden', 'plague']) {
        const f = E.simulate({ encounter: enc as never, diff: '어려움', gear: 'adv0', seed: s + 1, party });
        expect(['win', 'lose']).toContain(f.over);
        expect(Number.isFinite(f.bossHp) && f.party.every(u => Number.isFinite(u.hp))).toBe(true);
      }
    }
  });
  it('공개모집 파티 (능력 있음)는 같은 시드 같은 결과', () => {
    for (const enc of ['plague', 'choir'] as const) {
      const party = E.recruitParty(enc, 9, { abilities: true });
      const a = E.simulate({ encounter: enc, diff: '어려움', gear: 'adv0', seed: 9, party });
      const b = E.simulate({ encounter: enc, diff: '어려움', gear: 'adv0', seed: 9, party });
      expect([a.over, a.t, a.bossHp]).toEqual([b.over, b.t, b.bossHp]);
    }
  });
  it('흡수막이 강타를 다 막으면 받은 피해 없음 (든든이 배율이 0을 만들지 않음)', () => {
    const f = fight({ tank: ['든든이'] }), tk = who(f, '탱');
    const h0 = tk.hp;
    damage(f, tk, 10, false, 'fixed');
    expect(tk.hp).toBeLessThan(h0);
  });
});
