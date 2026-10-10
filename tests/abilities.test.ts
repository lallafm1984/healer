/** 파티원 특수 능력 (17 3~7장): 데이터 80개, 쓰는 때, 효과, 자질·레벨, 프로토타입 일치 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, abilitiesOf, rollAbility, starFx } from '../src/data/abilities';
import { armorFactor } from '../src/data/armor';
import { RECRUIT_CLASSES, type ClassKey } from '../src/data/classes';
import { lvPower } from '../src/data/progression';
import * as E from '../src/engine';
import { abCut, abOnTel, addMod } from '../src/engine/abilities';
import { addDebuff, damage } from '../src/engine/core';
import type { RosterEntry, Telegraph } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const P = (role: RosterEntry['role'], cls: ClassKey, o: Partial<RosterEntry> = {}): RosterEntry => ({ role, cls, pers: '신중파', nick: `${cls}${o.ab || ''}`, ...o });
/** 5인: 탱커 전사, 근접 도적, 원거리 마법사·궁수 (능력은 하나만 넣어 봄) */
function party5(ab?: { slot: number; key: string; star?: number }): RosterEntry[] {
  const list = [P('tank', 'warrior'), P('melee', 'rogue'), P('ranged', 'mage'), P('ranged', 'archer')];
  if (ab) { list[ab.slot] = { ...list[ab.slot], ab: ab.key, star: ab.star ?? 0 }; }
  return list;
}
const unitOf = (f: F, key: string) => f.party.find(u => u.ab?.key === key)!;

describe('데이터 (17 5장)', () => {
  it('직업 8종 × 후보 10개 = 일반 6 · 고급 3 · 희귀 1, 다른 직업에는 안 붙음', () => {
    for (const c of RECRUIT_CLASSES) {
      const list = abilitiesOf(c);
      expect(list.length).toBe(10);
      expect(['common', 'rare', 'epic'].map(g => list.filter(a => a.grade === g).length)).toEqual([6, 3, 1]);
    }
    expect(Object.keys(ABILITIES).length).toBe(80);
  });
  it('회복 능력은 전부 전투당 1회, 자기 20% 이하 (17 4장)', () => {
    for (const a of Object.values(ABILITIES).filter(x => x.kind === 'heal')) {
      expect(a.cd).toBe(-1);
      if ('v' in a.fx) expect(a.fx.v).toBeLessThanOrEqual(0.2);
    }
  });
  it('뽑기 확률: 일반 66 · 고급 27 · 희귀 7 (근사)', () => {
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < 6000; i++) n[ABILITIES[rollAbility('warrior', r)].grade]++;
    expect(n.common / 6000).toBeCloseTo(0.66, 1);
    expect(n.epic / 6000).toBeGreaterThan(0.04);
    expect(n.epic / 6000).toBeLessThan(0.1);
  });
  it('★ 강화 (17 8-2): 쿨 능력 ★1 쿨 -10%, ★2 효과 +10%, ★3 쿨 -20%, ★4 효과 +20%', () => {
    const a = ABILITIES['warrior.shieldBlock'];
    expect([1, 2, 3, 4].map(s => starFx(a, s))).toEqual([
      { eff: 1, cd: 0.9, early: 0 }, { eff: 1.1, cd: 0.9, early: 0 }, { eff: 1.1, cd: 0.8, early: 0 }, { eff: 1.2, cd: 0.8, early: 0 },
    ]);
    expect(starFx(ABILITIES['warrior.bandage'], 5)).toEqual({ eff: 1.25, cd: 1, early: 0.05 });
  });
});

describe('공개모집 · 프로토타입 일치', () => {
  it('능력 없이 뽑은 파티는 abilities 옵션만 다르고 직업·특성은 같음', () => {
    for (let s = 1; s <= 30; s++) {
      const a = E.recruitParty('plague', s), b = E.recruitParty('plague', s, { abilities: true });
      expect(b.map(m => [m.nick, m.cls, m.traits])).toEqual(a.map(m => [m.nick, m.cls, m.traits]));
      expect(a.every(m => !m.ab)).toBe(true);
      expect(b.every(m => ABILITIES[m.ab!].cls === m.cls)).toBe(true);
    }
  });
  it('능력 없는 파티 = abOn 꺼짐 (능력 코드를 안 탐)', () => {
    expect(E.create({ encounter: 'warden', diff: '보통', seed: 1 }).abOn).toBe(false);
    expect(E.create({ encounter: 'warden', diff: '보통', seed: 1, party: party5({ slot: 0, key: 'warrior.shieldBlock' }) }).abOn).toBe(true);
  });
  it('능력 80개 모두 전투 3분 동안 오류 없이 (보스 3종 + 일반 구간)', () => {
    for (const a of Object.values(ABILITIES)) {
      const role = a.cls === 'warrior' || a.cls === 'paladin' ? 'tank' : ['rogue', 'berserker', 'swordsman'].includes(a.cls) ? 'melee' : 'ranged';
      for (const enc of ['warden', 'gate', 'plague'] as const) {
        const roster = enc === 'plague' ? E.recruitParty('plague', 3) : party5();
        const i = roster.findIndex(m => m.role === role);
        roster[i] = { ...roster[i], cls: a.cls, ab: a.key, star: 5 };
        const f = E.create({ encounter: enc, diff: '어려움', seed: 4, gear: 'rare5', party: roster });
        while (!f.over && f.t < 180) { E.autoHealer(f); E.step(f); f.events.length = 0; }
        expect(f.party.every(u => Number.isFinite(u.hp) && u.max > 0)).toBe(true);
      }
    }
  }, 60_000);
});

describe('쓰는 때와 효과', () => {
  it('방패 막기: 나를 노리는 버스터 피해 -40%', () => {
    const hit = (ab: boolean) => {
      const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: party5(ab ? { slot: 0, key: 'warrior.shieldBlock' } : undefined) });
      const tk = f.party[0]; tk.hp = tk.max;
      const sk = f.skills.find(s => s.key === 'buster')!;
      const tel: Telegraph = { id: 999, skill: sk, kind: 'buster', start: f.t, impact: f.t + 2, units: [tk.id], cells: new Set() };
      f.tels.push(tel);
      if (f.abOn) abOnTel(f, tel);
      sk.hit!(f, tel);
      return tk.max - tk.hp;
    };
    expect(hit(true) / hit(false)).toBeCloseTo(0.6, 5);
  });
  it('붕대 감기: 체력 35% 아래, 3초 멈춰 15% 회복, 전투당 1회', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: party5({ slot: 0, key: 'warrior.bandage' }) });
    f.skills.forEach(s => { s.next = Infinity; });
    const u = f.party[0];
    u.hp = u.max * 0.3;
    steps(f, 0.25);
    expect(u.mods.some(m => m.k === 'stop')).toBe(true);
    steps(f, 3.2);
    expect(u.hp / u.max).toBeCloseTo(0.45, 2);
    expect(f.stats.abHeal).toBeCloseTo(u.max * 0.15, 3);
    u.hp = u.max * 0.3; steps(f, 1);
    expect(u.ab!.uses).toBe(1);
  });
  it('도발: 보스 아닌 적이 딜러를 때리면 끌어옴 → 그동안 그 적은 탱커를 때림', () => {
    const f = E.create({ encounter: 'gate', diff: '보통', seed: 2, party: party5({ slot: 0, key: 'warrior.taunt' }) });
    for (let i = 0; i < 40 && !f.ab.tauntUntil; i++) E.step(f);
    expect(f.ab.taunt).toBe(f.party[0].id);
    const others = f.party.filter(u => u.role !== 'tank' && !u.me);
    const before = others.map(u => u.hp);
    steps(f, 8);
    expect(others.map(u => u.hp)).toEqual(before);
  });
  it('기절: 기절한 적은 기술을 안 씀', () => {
    const f = E.create({ encounter: 'gate', diff: '보통', seed: 2, party: party5({ slot: 1, key: 'rogue.kidney' }) });
    steps(f, 4);
    const thrower = f.mobs.find(m => m.name === '잔해 투척병')!;
    expect(thrower.stun).toBeGreaterThan(f.t);
  });
  it('끊기: 끊기 가능 기술만, 준비된 한 사람만 시도', () => {
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, party: E.recruitParty('plague', 1).map((m, i) => (i === 3 ? { ...m, role: 'melee' as const, cls: 'rogue' as const, ab: 'rogue.kick' } : m)) });
    const sting = f.skills.find(s => s.key === 'sting')!, pulse = f.skills.find(s => s.key === 'aoe')!;
    f.rng = () => 0; // 성공
    expect(abCut(f, pulse)).toBe(false);
    expect(abCut(f, sting)).toBe(true);
    expect(abCut(f, sting)).toBe(false); // 쿨
  });
  it('저격 (희귀): 끊기 가능이 아니어도 광역 1번, 버스터는 못 끊음', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, party: party5({ slot: 3, key: 'archer.snipe' }) });
    const aoe = f.skills.find(s => s.key === 'aoe')!, buster = f.skills.find(s => s.key === 'buster')!;
    expect(abCut(f, buster)).toBe(false);
    expect(abCut(f, aoe)).toBe(true);
    expect(abCut(f, aoe)).toBe(false);
  });
  it('얼음 방패: 죽을 피해를 막고 3초 얼음 (피해·치유 없음)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: party5({ slot: 2, key: 'mage.iceBlock' }) });
    const u = unitOf(f, 'mage.iceBlock');
    u.hp = 10;
    damage(f, u, 500);
    expect(u.alive).toBe(true);
    expect(u.hp).toBe(10);
    damage(f, u, 500);
    expect(u.hp).toBe(10);
  });
  it('전력 질주: 내 칸 장판 예고에서 바로 빠짐', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, party: party5({ slot: 1, key: 'rogue.sprint' }) });
    const u = unitOf(f, 'rogue.sprint');
    const sk = f.skills.find(s => s.key === 'zone')!;
    const tel: Telegraph = { id: 999, skill: sk, kind: 'zone', start: f.t, impact: f.t + 2.5, units: [], cells: new Set([u.cell]), dps: 60, dur: 8 };
    f.tels.push(tel);
    abOnTel(f, tel);
    expect(u.moving).not.toBeNull();
    expect(u.moving!.total).toBeLessThan(0.2);
    expect(tel.cells.has(u.moving!.to)).toBe(false);
  });
  it('독소 정화: 옆 아군의 독·질병 1개 (함정은 안 지움)', () => {
    const roster = party5();
    roster[0] = { ...roster[0], cls: 'paladin', ab: 'paladin.cleanse' };
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: roster });
    f.skills.forEach(s => { s.next = Infinity; });
    const pal = unitOf(f, 'paladin.cleanse');
    const near = f.party.find(u => u !== pal && E.hexDist(f.cells[u.cell], f.cells[pal.cell]) <= 2)!;
    addDebuff(f, near, { name: '전염', type: '질병', left: 8, trap: true });
    steps(f, 0.5);
    expect(near.debuffs.length).toBe(1);
    addDebuff(f, near, { name: '독침', type: '독', left: 12, dot: 15 });
    steps(f, 0.5);
    expect(near.debuffs.map(d => d.name)).toEqual(['전염']);
  });
  it('상시: 죽음의 소원 (체력 30% 아래 딜 ×1.5, 받는 피해 +10%)', () => {
    const roster = party5();
    roster[1] = { ...roster[1], cls: 'berserker', ab: 'berserker.deathWish' };
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: roster });
    f.skills.forEach(s => { s.next = Infinity; });
    const u = unitOf(f, 'berserker.deathWish');
    const d0 = E.unitDps(u);
    u.hp = u.max * 0.25;
    const raw = E.unitDps(u);
    steps(f, 0.25);
    expect(E.unitDps(u) / raw).toBeCloseTo(1.5, 5);
    expect(d0).toBeGreaterThan(0);
    const hp = u.hp; damage(f, u, 10);
    expect(hp - u.hp).toBeCloseTo(10 * f.dmgMult * armorFactor(u.role, 'party') * 1.1, 5);
  });

  it('둘이 서로 피해를 나눠 받아도 한 번만 나눔 (받는 피해가 늘어난 사람끼리 끝없이 오가다 멈추지 않음)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1 });
    const a = f.party.find(u => u.role === 'melee')!, b = f.party.find(u => u.role === 'ranged')!;
    for (const [u, o] of [[a, b], [b, a]]) {
      addMod(u, { k: 'share', v: 0.5, until: f.t + 10, src: 's', by: o.id });
      addMod(u, { k: 'vuln', v: 1, until: f.t + 10, src: 'v' }); // 받는 피해 2배: 나눈 만큼 그대로 되돌아옴
    }
    const ha = a.hp, hb = b.hp;
    expect(() => damage(f, a, 10, false, 'fixed')).not.toThrow();
    expect(ha - a.hp).toBeCloseTo(10 * f.dmgMult * 2 * 0.5, 5); // 2배로 늘고 반을 b에게
    expect(hb - b.hp).toBeCloseTo(10 * f.dmgMult * 2 * 0.5 * 2, 5); // b는 받은 몫이 다시 2배, 더 나누지 않음
  });
});

describe('자질·길드원 레벨 (17 9-1)', () => {
  it('길드원은 자기 레벨 배율 + 공격·맷집 자질, 눈치는 반응·회피', () => {
    const roster = party5();
    roster[1] = { ...roster[1], lv: 10, apt: [5, 1, 5] };
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: roster, stageLv: 20 });
    const g = f.party[1], pub = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: party5(), stageLv: 20 }).party[1];
    expect(g.max / pub.max).toBeCloseTo((lvPower(10) / lvPower(20)) * 0.9, 6);
    expect(g.dps / pub.dps).toBeCloseTo((lvPower(10) / lvPower(20)) * 1.12, 6);
    expect([g.senseReact, g.senseDodge]).toEqual([0.85, 0.04]);
    expect([pub.senseReact, pub.senseDodge]).toEqual([1, 0]);
  });
  it('보통 자동 힐러: 공개모집 능력 파티로도 깰 수 있음 (역병 군주 희귀 +5)', () => {
    let win = 0;
    for (let s = 1; s <= 6; s++) if (E.simulate({ encounter: 'plague', diff: '보통', gear: 'rare5', seed: s, items: ['mana', 'life'], party: E.recruitParty('plague', s, { abilities: true }) }).over === 'win') win++;
    expect(win).toBeGreaterThanOrEqual(5);
  });
});

