/** 사제 빛의 비둘기 (휠 8번째 칸, Lim 2026-10-11 「모든 직업군에 비는 스킬이 없도록 한개를 더」) */
import { describe, expect, it } from 'vitest';
import { DOVE } from '../src/data/heroConst';
import { SKILLS } from '../src/data/skills';
import * as E from '../src/engine';
import { hexDist } from '../src/engine/board';
import { cellOf, damage } from '../src/engine/core';
import type { Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const fight = (level = 100, proto = false) => {
  const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level, hero: 'priest', proto });
  f.gear.crit = 0;
  f.standin = null;
  return f;
};
const tank = (f: F) => f.party.find(u => u.role === 'tank')!;
const others = (f: F, u: Unit) => f.party.filter(v => v !== u && v.alive);
/** 앉히기 (즉시 시전, GCD만 지나감 · 보스는 그동안 안 때림) */
const put = (f: F, u: Unit) => {
  f.skills.forEach(k => { k.next = Infinity; });
  expect(E.use(f, 'dove', u.cell).ok).toBe(true);
  let n = 0; while ((f.cast || f.gcd > 0) && n++ < 200) { E.step(f); f.events.length = 0; }
};
/** 비둘기가 앉은 뒤 (날아오는 1초가 지남) */
const landed = (f: F) => { f.dove!.flyUntil = f.t; };

describe('빛의 비둘기', () => {
  it('8번째 칸 · Lv 15에 배움 · 마나 3 · 재사용 12초', () => {
    expect(SKILLS.dove).toMatchObject({ slot: 'unique', lv: 15, cost: 3, cd: 12, cast: 0 });
    const low = fight(14), t = tank(low);
    expect(E.use(low, 'dove', t.cell).ok).toBe(false);
    const f = fight(), m0 = f.mana;
    put(f, tank(f));
    expect(f.dove).toMatchObject({ id: tank(f).id, left: DOVE.hops });
    expect(f.mana).toBeLessThan(m0);
    expect(f.cd.dove).toBeGreaterThan(SKILLS.dove.cd! - 2); // GCD만큼 지남
  });

  it('앉은 사람이 맞으면 회복하고, 2칸 안에서 체력이 가장 낮은 다른 사람에게 날아감', () => {
    const f = fight(), t = tank(f), g = fight(), gt = tank(g);
    put(f, t); put(g, gt);
    g.dove = null; // 비교용: 같은 판, 비둘기 없음
    const near = others(f, t).filter(v => hexDist(cellOf(f, v), cellOf(f, t)) <= DOVE.range);
    expect(near.length).toBeGreaterThan(1);
    const target = near[near.length - 1];
    for (const v of others(f, t)) v.hp = v.max;
    target.hp = target.max * 0.3;
    t.hp = gt.hp = t.max * 0.8;
    landed(f);
    damage(f, t, 300); damage(g, gt, 300);
    expect(t.hp - gt.hp).toBeCloseTo(SKILLS.dove.amt! * f.gear.heal * f.power, 3);
    expect(f.dove).toMatchObject({ id: target.id, left: DOVE.hops - 1 });
    expect(f.dove!.flyUntil).toBeCloseTo(f.t + DOVE.fly);
  });

  it('날아오는 동안 맞으면 아무 일 없음, 다섯 번 회복하면 사라짐', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    damage(f, t, 100);
    const u = f.party.find(v => v.id === f.dove!.id)!, hp = u.hp;
    damage(f, u, 50); // 아직 날아오는 중
    expect(u.hp).toBeLessThan(hp);
    expect(f.dove).toMatchObject({ id: u.id, left: DOVE.hops - 1 });
    for (let k = 1; k < DOVE.hops; k++) {
      const v = f.party.find(x => x.id === f.dove!.id)!;
      landed(f);
      damage(f, v, 100);
    }
    expect(f.dove).toBeNull();
  });

  it('20초가 지나면 사라지고, 앉은 사람이 쓰러지면 다른 사람에게 (횟수는 그대로)', () => {
    const f = fight(), d = others(f, tank(f)).find(v => !v.me)!;
    put(f, d);
    landed(f);
    d.ab = null; d.guardian = 0; // 얼음 방패 · 수호 영혼 없이
    damage(f, d, 1e6); // 쓰러짐: 회복 없이
    expect(d.alive).toBe(false);
    E.step(f);
    expect(f.dove).not.toBeNull();
    expect(f.dove!.id).not.toBe(d.id);
    expect(f.dove!.left).toBe(DOVE.hops);
    f.dove!.until = f.t;
    E.step(f);
    expect(f.dove).toBeNull();
  });

  it('뒤집힌 축복 (힐이 피해)이 걸리면 회복하지 않고 날아감', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    t.debuffs.push({ id: 999, name: '뒤집힌 축복', type: '마법', left: 10, invert: true } as unknown as Unit['debuffs'][number]);
    t.hp = t.max * 0.8;
    const hp = t.hp;
    damage(f, t, 200);
    expect(t.hp).toBeLessThan(hp);
    expect(f.dove!.id).not.toBe(t.id);
    expect(f.dove!.left).toBe(DOVE.hops);
  });

  it('회복할 때마다 신성화 게이지가 참 (평온 게이지는 그대로)', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    f.g.p = 10; f.g.s = 10;
    damage(f, t, 200);
    expect(f.g.p).toBe(10);
    expect(f.g.s).toBeGreaterThanOrEqual(10 + DOVE.gs);
  });

  it('자동 힐러: Lv 15부터 씀, 프로토타입 일치 비교 (proto)에서는 안 씀', () => {
    const run = (level: number, proto = false) => {
      const f = E.create({ encounter: 'warden', diff: '보통', seed: 3, level, hero: 'priest', proto });
      let n = 0;
      while (!f.over && f.t < 120) {
        E.autoHealer(f); E.step(f);
        n += f.events.filter(e => e.type === 'fx' && e.name === 'dove-land').length;
        f.events.length = 0;
      }
      return n;
    };
    expect(run(30)).toBeGreaterThan(3);
    expect(run(14)).toBe(0);
    expect(run(30, true)).toBe(0);
  });
});
