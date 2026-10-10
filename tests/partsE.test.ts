/** 묶음 E 새 부품 (54 5장): 신기루 · 모래시계, 자동 힐러 대응 */
import { describe, expect, it } from 'vitest';
import type { SkillDef, SkillEffect } from '../src/data/bosses';
import * as E from '../src/engine';
import { autoHealer } from '../src/engine/auto';
import { applyDebuff, orderHeal, runEffect } from '../src/engine/bossParts';
import { fromDef } from '../src/engine/bosses';
import { heal } from '../src/engine/core';
import type { BossSkill, Fight, FightEvent } from '../src/engine';

const steps = (f: Fight, sec: number, ev?: FightEvent[]) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { E.step(f); ev?.push(...f.events); f.events.length = 0; } };
const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const fight = (hero: 'priest' | 'druid' | 'paladin' = 'priest', encounter: E.FightConfig['encounter'] = 'plague') => {
  const f = E.create({ encounter, diff: '보통', seed: 1, hero }); quiet(f); return f;
};
const skill = { name: '모래시계 뒤집기', st: {} } as unknown as BossSkill;
const run = (f: Fight, e: SkillEffect) => runEffect(f, skill, e);
const others = (f: Fight) => f.party.filter(u => u.role !== 'tank' && !u.me);
const idle = (f: Fight) => { f.cast = null; f.gcd = 0; f.queued = null; f.channel = 0; };

const SPEAR: SkillDef = { key: 'spear', name: '신기루 창', icon: '창', kind: 'buster', first: 0, period: 99, cast: 2.5, warn: 'buster',
  target: { p: 'random', n: 1, nMythic: 2 }, mirage: { n: 1 }, effect: { p: 'strike', dmg: 270 } };

describe('신기루 (P-MIRAGE)', () => {
  it('사람 기술: 다른 사람에게 가짜 예고가 같이 뜨고, 끝 1초에 걷혀 진짜만 맞음 · 대기열에는 한 번', () => {
    const f = fight();
    fromDef(f, SPEAR);
    const ev: FightEvent[] = [];
    steps(f, 0.1, ev);
    const tels = f.tels.filter(t => t.skill.key === 'spear');
    expect(tels.length).toBe(2);
    const real = tels.find(t => !t.fake)!, fake = tels.find(t => t.fake)!;
    expect(real.veil).toBeCloseTo(real.impact - 1, 6);
    expect(fake.veil).toBe(real.veil);
    expect(fake.units.length).toBe(1);
    expect(fake.units[0]).not.toBe(real.units[0]);
    const fu = f.party.find(u => u.id === fake.units[0])!, ru = f.party.find(u => u.id === real.units[0])!;
    expect(fu.role).not.toBe('tank'); expect(fu.me).toBe(false);
    expect(E.queue(f).filter(q => q.skill?.key === 'spear' && q.casting).length).toBe(1);
    steps(f, real.veil! - f.t + 0.05, ev);
    expect(f.tels.includes(fake)).toBe(false);
    expect(f.tels.includes(real)).toBe(true);
    expect(ev.some(e => e.type === 'fx' && e.name === 'mirage-shimmer' && e.on === fu.id)).toBe(true);
    const fh = fu.hp, rh = ru.hp;
    steps(f, 1.2);
    expect(fu.hp).toBeCloseTo(fh, 0);
    expect(ru.hp).toBeLessThan(rh);
  });

  it('악몽은 진짜 nMythic명 + 가짜 n명', () => {
    const f = fight();
    f.mythic = true;
    fromDef(f, SPEAR);
    steps(f, 0.1);
    const tels = f.tels.filter(t => t.skill.key === 'spear');
    expect(tels.find(t => !t.fake)!.units.length).toBe(2);
    expect(tels.find(t => t.fake)!.units.length).toBe(1);
    expect(new Set(tels.flatMap(t => t.units)).size).toBe(3);
  });

  it('탱커 버스터 신기루는 다른 탱커에게 가짜', () => {
    const f = fight();
    fromDef(f, { key: 'shell', name: '등껍질 박치기', kind: 'buster', first: 0, period: 99, cast: 3, warn: 'buster', dmg: 500, target: 'tank', mirage: { n: 1 }, effect: { p: 'tank' } });
    steps(f, 0.1);
    const fake = f.tels.find(t => t.fake)!;
    expect(f.party.find(u => u.id === fake.units[0])!.role).toBe('tank');
    expect(fake.units[0]).not.toBe(f.tels.find(t => !t.fake)!.units[0]);
  });

  it('장판 신기루: 진짜와 다른 칸에 가짜 장판, 파티원이 둘 다 피하고 가짜는 안 맞음', () => {
    const f = fight();
    const s = fromDef(f, { key: 'pile', name: '신기루 짐더미', kind: 'zone', first: 0, period: 99, cast: 3, warn: 'zone', hitDmg: 240, cells: { p: 'around' }, mirage: { n: 1 } });
    steps(f, 0.1);
    const real = f.tels.find(t => t.skill === s && !t.fake)!, fake = f.tels.find(t => t.skill === s && t.fake)!;
    expect(fake.cells.size).toBeGreaterThan(0);
    expect([...fake.cells].some(i => !real.cells.has(i))).toBe(true);
    const inFake = f.party.filter(u => fake.cells.has(u.cell) && !real.cells.has(u.cell)).map(u => [u, u.hp] as const);
    steps(f, 3.2);
    for (const [u, hp] of inFake) if (fake.cells.has(u.cell) && !real.cells.has(u.cell)) expect(u.hp).toBeGreaterThanOrEqual(hp - 1);
    expect(f.tels.some(t => t.skill === s)).toBe(false);
  });

  it('광역 반은 신기루: 가짜면 끝 1초에 걷히고 아무도 안 맞음, 진짜면 맞음', () => {
    const tail = (chance: number): SkillDef => ({ key: 'tail', name: '신기루 꼬리', kind: 'aoe', first: 0, period: 99, cast: 3, warn: 'aoe', mirage: { chance }, effect: { p: 'all', dmg: 200 } });
    const f = fight();
    fromDef(f, tail(1));
    const ev: FightEvent[] = [];
    steps(f, 0.1, ev);
    expect(E.queue(f).some(q => q.skill?.key === 'tail' && q.casting)).toBe(true);
    const hp0 = f.party.map(u => u.hp);
    steps(f, 3.2, ev);
    f.party.forEach((u, i) => expect(u.hp).toBeGreaterThanOrEqual(hp0[i] - 1));
    expect(ev.some(e => e.type === 'msg' && e.text.includes('신기루였음'))).toBe(true);
    const g = fight();
    fromDef(g, tail(0));
    steps(g, 0.1);
    const hp1 = g.party.map(u => u.hp);
    steps(g, 3.2);
    expect(g.party.some((u, i) => u.hp < hp1[i] - 50)).toBe(true);
  });

  it('신기루 숫자 (차례 × 신기루): 번호 없는 사람에게 ① 아닌 번호가 하나 더, 걷히기 전에 그 사람에게 힐하면 틀림', () => {
    const f = fight();
    run(f, { p: 'order', n: 3, sec: 12, wrong: 150, miss: 240, daze: { sec: 6, vuln: 1.3 }, fake: { at: 5 }, wrongAll: 90 });
    const o = f.order!;
    expect(o.fake).toBeDefined();
    expect(o.ids.includes(o.fake!.id)).toBe(false);
    expect(o.fake!.num).toBeGreaterThanOrEqual(1);
    expect(o.fake!.num).toBeLessThan(o.ids.length);
    expect(o.wrongAll).toBeUndefined(); // 악몽만
    const fk = f.party.find(u => u.id === o.fake!.id)!, hp = fk.hp;
    orderHeal(f, f.party.find(u => u.id === o.ids[0])!);
    expect(o.i).toBe(1);
    orderHeal(f, fk);
    expect(o.i).toBe(0);
    expect(fk.hp).toBeLessThan(hp);
    // 걷힌 뒤에는 그냥 번호 없는 사람
    steps(f, 5.1);
    expect(o.fake).toBeUndefined();
    orderHeal(f, f.party.find(u => u.id === o.ids[0])!);
    orderHeal(f, fk);
    expect(o.i).toBe(1);
  });

  it('악몽 신기루 숫자: 틀리면 전원 피해', () => {
    const f = fight();
    f.mythic = true;
    run(f, { p: 'order', n: 3, sec: 12, wrong: 150, miss: 240, daze: { sec: 6, vuln: 1.3 }, fake: { at: 5 }, wrongAll: 90 });
    const tk = f.party.find(u => u.role === 'tank')!, hp = tk.hp;
    orderHeal(f, f.party.find(u => u.id === f.order!.ids[1])!);
    expect(tk.hp).toBeLessThan(hp);
  });

  it('자동 힐러: 안 걷힌 예고에는 생존기 · 큰 힐 대신 지속 힐, 걷히면 진짜에게 바로', () => {
    const f = fight('priest');
    f.level = 30; f.mana = 100; f.cd.guardian = 0;
    fromDef(f, { ...SPEAR, cast: 3 });
    steps(f, 0.1);
    const real = f.tels.find(t => t.skill.key === 'spear' && !t.fake)!, fake = f.tels.find(t => t.fake)!;
    const ru = f.party.find(u => u.id === real.units[0])!, fu = f.party.find(u => u.id === fake.units[0])!;
    ru.hp = ru.max * 0.7; fu.hp = fu.max * 0.7;
    idle(f);
    autoHealer(f);
    expect(ru.guardian).toBe(0); expect(fu.guardian).toBe(0);
    expect(f.cast == null || f.cast.key === 'renew').toBe(true);
    expect([ru.hot, fu.hot].some(h => h > 0)).toBe(true);
    steps(f, real.veil! - f.t + 0.05);
    ru.hp = ru.max * 0.7;
    idle(f);
    autoHealer(f);
    expect(f.cast?.uid === ru.id || ru.hp > ru.max * 0.75 || ru.guardian > 0).toBe(true);
  });

  it('자동 힐러: 같은 번호가 둘로 보이면 걷힐 때까지 기다림', () => {
    const f = fight('priest');
    f.level = 30; f.mana = 100;
    run(f, { p: 'order', n: 3, sec: 12, wrong: 150, miss: 240, daze: { sec: 6, vuln: 1.3 }, fake: { at: 5 } });
    const o = f.order!;
    o.i = o.fake!.num;
    for (const u of f.party) u.hp = u.max;
    idle(f);
    autoHealer(f);
    const tgt = f.cast?.uid ?? -1;
    expect(tgt === o.fake!.id || tgt === o.ids[o.i]).toBe(false);
    o.fake!.until = f.t;
    idle(f);
    autoHealer(f);
    expect(f.cast?.uid === o.ids[o.i] || o.i > o.fake!.num).toBe(true);
  });
});

const GLASS: SkillDef = { key: 'glass', name: '모래시계 뒤집기', kind: 'aoe', first: 0, period: 99, cast: 3, warn: 'aoe', effect: { p: 'glass', sec: 8, then: [{ skill: 'roll', in: 0.5 }] } };
const ROLL: SkillDef = { key: 'roll', name: '데굴데굴', kind: 'aoe', first: null, period: 9999, cast: 1.5, warn: 'aoe', effect: { p: 'all', dmg: 180 } };

describe('모래시계 (P-GLASS)', () => {
  it('뒤집은 순간 체력을 적고 8초 뒤 모두 그 비율로: 그 사이 피해도 힐도 사라짐, 쓰러진 사람은 그대로', () => {
    const f = fight();
    const [a, b, c] = others(f);
    a.hp = a.max * 0.9; b.hp = b.max * 0.4; c.hp = c.max * 0.5;
    const ev: FightEvent[] = [];
    run(f, { p: 'glass', sec: 8 });
    expect(f.glass.length).toBe(1);
    a.hp = a.max * 0.3; // 맞음
    heal(f, b, b.max, true); // 힐
    c.hp = 0; c.alive = false; // 쓰러짐
    steps(f, 8.05, ev);
    expect(f.glass.length).toBe(0);
    expect(a.hp / a.max).toBeCloseTo(0.9, 2);
    expect(b.hp / b.max).toBeCloseTo(0.4, 2);
    expect(c.alive).toBe(false);
    expect(ev.filter(e => e.type === 'fx' && e.name === 'sand-rewind').length).toBeGreaterThanOrEqual(2);
  });

  it('뒤집으면 창 안 기술이 열림 (예고가 뜨고 한 번만)', () => {
    const f = fight();
    fromDef(f, GLASS);
    const roll = fromDef(f, ROLL);
    const ev: FightEvent[] = [];
    steps(f, 3.05, ev);
    expect(ev.some(e => e.type === 'fx' && e.name === 'hourglass-flip')).toBe(true);
    expect(f.glass.length).toBe(1);
    steps(f, 0.6);
    expect(f.tels.some(t => t.skill === roll)).toBe(true);
    steps(f, 10);
    expect(roll.next).toBeGreaterThan(f.t + 1000);
  });

  it('둘이 겹치면 각자 자기 기록으로 (짧은 것이 먼저)', () => {
    const f = fight();
    const u = others(f)[0];
    u.hp = u.max * 0.8;
    run(f, { p: 'glass', sec: 8 });
    u.hp = u.max * 0.5;
    run(f, { p: 'glass', sec: 4 });
    u.hp = u.max * 0.2;
    steps(f, 4.05);
    expect(u.hp / u.max).toBeCloseTo(0.5, 2);
    u.hp = u.max * 0.1;
    steps(f, 4.05);
    expect(u.hp / u.max).toBeCloseTo(0.8, 2);
  });

  it('보호막 · 디버프는 안 되돌림, 악몽 둘둘이는 붕대가 남은 사람에게 피해', () => {
    const f = fight();
    const [a, b] = others(f);
    run(f, { p: 'glass', sec: 8, absorbHit: 120 });
    applyDebuff(f, a, { name: '칭칭 붕대', type: '저주', left: 30, absorb: 180 });
    applyDebuff(f, b, { name: '모래 기침', type: '질병', left: 30 });
    steps(f, 8.05);
    expect(a.debuffs.some(d => d.name === '칭칭 붕대')).toBe(true);
    expect(b.debuffs.some(d => d.name === '모래 기침')).toBe(true);
    expect(a.hp / a.max).toBeLessThan(0.95);
    expect(b.hp / b.max).toBeCloseTo(1, 2);
  });

  it('자동 힐러: 뒤집기 예고 동안 거의 가득까지 채우고, 창 안에서는 쓰러질 사람 · 붕대만', () => {
    const f = fight('priest');
    f.level = 30; f.mana = 100;
    for (const u of f.party) { u.hp = u.max; u.hot = 20; } // 지속 힐은 이미 깔림
    const u = others(f)[0];
    u.hp = u.max * 0.9;
    fromDef(f, GLASS);
    steps(f, 0.1);
    idle(f);
    autoHealer(f);
    expect(f.cast?.uid).toBe(u.id); // 평소면 0.85 위라 안 채움
    // 창 안: 0.6인 사람은 두고, 0.2인 사람만
    idle(f);
    f.tels = [];
    run(f, { p: 'glass', sec: 8 });
    const [a, b] = others(f);
    a.hp = a.max * 0.6; b.hp = b.max * 0.2;
    autoHealer(f);
    expect(f.cast?.uid ?? f.party.find(x => x.hp > x.max * 0.25 && x === b)?.id).toBe(b.id);
    idle(f);
    b.hp = b.max;
    autoHealer(f);
    expect(f.cast).toBeNull();
    // 붕대 (치유 흡수 막)는 창 안에서도 벗김
    applyDebuff(f, a, { name: '칭칭 붕대', type: '저주', left: 30, absorb: 180 });
    idle(f);
    autoHealer(f);
    expect(f.cast?.uid).toBe(a.id);
  });

  it('드루이드 · 성기사도 창 안에서는 가득 찬 사람에게 힐을 안 넣음', () => {
    for (const hero of ['druid', 'paladin'] as const) {
      const f = fight(hero);
      f.level = 30; f.mana = 100;
      for (const u of f.party) u.hp = u.max * 0.8;
      run(f, { p: 'glass', sec: 8 });
      idle(f);
      autoHealer(f);
      expect(f.cast, hero).toBeNull();
    }
  });
});
