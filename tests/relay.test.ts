/** 사제 빛의 전이 (휠 8번째 칸, Lim 2026-10-11 「모든 직업군에 비는 스킬이 없도록 한개를 더」) */
import { describe, expect, it } from 'vitest';
import { RELAY } from '../src/data/heroConst';
import { SKILLS } from '../src/data/skills';
import * as E from '../src/engine';
import { hexDist } from '../src/engine/board';
import { cellOf, damage } from '../src/engine/core';
import type { Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const fight = (level = 100, proto = false) => {
  const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level, hero: 'priest', proto });
  f.gear.crit = 0;
  return f;
};
const tank = (f: F) => f.party.find(u => u.role === 'tank')!;
const others = (f: F, u: Unit) => f.party.filter(v => v !== u && v.alive);
/** 빛 깃들게 하기 (즉시 시전, GCD만 지나감 · 보스는 그동안 안 때림) */
const put = (f: F, u: Unit) => {
  f.skills.forEach(k => { k.next = Infinity; });
  expect(E.use(f, 'relay', u.cell).ok).toBe(true);
  let n = 0; while ((f.cast || f.gcd > 0) && n++ < 200) { E.step(f); f.events.length = 0; }
};
/** 빛이 깃든 뒤 (옮겨 오는 1초가 지남) */
const landed = (f: F) => { f.relay!.flyUntil = f.t; };

describe('빛의 전이', () => {
  it('8번째 칸 · Lv 15에 배움 · 마나 3 · 재사용 12초', () => {
    expect(SKILLS.relay).toMatchObject({ slot: 'unique', lv: 15, cost: 3, cd: 12, cast: 0 });
    expect(RELAY).toMatchObject({ hops: 3, range: 1 }); // Lim 2026-10-11 너프 「1칸 인접, 3회 회복」
    const low = fight(14), t = tank(low);
    expect(E.use(low, 'relay', t.cell).ok).toBe(false);
    const f = fight(), m0 = f.mana;
    put(f, tank(f));
    expect(f.relay).toMatchObject({ id: tank(f).id, left: RELAY.hops });
    expect(f.mana).toBeLessThan(m0);
    expect(f.cd.relay).toBeGreaterThan(SKILLS.relay.cd! - 2); // GCD만큼 지남
  });

  it('빛이 깃든 사람이 맞으면 회복하고, 빛은 바로 옆 칸에서 체력이 가장 낮은 다른 사람에게 옮겨 감 (더 다친 먼 사람에게는 안 감)', () => {
    const f = fight(), g = fight();
    const adj = (u: Unit) => others(f, u).filter(v => hexDist(cellOf(f, v), cellOf(f, u)) <= RELAY.range);
    const b = [...f.party].sort((x, y) => adj(y).length - adj(x).length || x.id - y.id)[0]; // 옆 칸 사람이 가장 많은 사람
    const gb = g.party.find(u => u.id === b.id)!;
    put(f, b); put(g, gb);
    g.relay = null; // 비교용: 같은 판, 빛의 전이 없음
    const near = adj(b), far = others(f, b).find(v => hexDist(cellOf(f, v), cellOf(f, b)) > RELAY.range)!;
    expect(near.length).toBeGreaterThan(1);
    expect(far).toBeDefined();
    const target = near[near.length - 1];
    for (const v of others(f, b)) v.hp = v.max;
    target.hp = target.max * 0.5;
    far.hp = far.max * 0.2;
    b.hp = gb.hp = b.max * 0.8;
    landed(f);
    damage(f, b, 300); damage(g, gb, 300);
    expect(b.hp - gb.hp).toBeCloseTo(SKILLS.relay.amt! * f.gear.heal * f.power, 3);
    expect(f.relay).toMatchObject({ id: target.id, left: RELAY.hops - 1 });
    expect(f.relay!.flyUntil).toBeCloseTo(f.t + RELAY.fly);
  });

  it('바로 옆 칸에 갈 사람이 없으면 그 자리에 남아 다음에 맞을 때 또 회복', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    for (const v of others(f, t)) if (hexDist(cellOf(f, v), cellOf(f, t)) <= RELAY.range) v.debuffs.push({ id: 998, name: '뒤집힌 축복', type: '마법', left: 10, invert: true } as unknown as Unit['debuffs'][number]);
    t.hp = t.max * 0.5;
    damage(f, t, 100);
    expect(f.relay).toMatchObject({ id: t.id, left: RELAY.hops - 1 });
    damage(f, t, 100);
    expect(f.relay).toMatchObject({ id: t.id, left: RELAY.hops - 2 });
  });

  it('옮겨 오는 동안 맞으면 아무 일 없음, 정해진 횟수 (3번)를 다 회복하면 사라짐', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    damage(f, t, 100);
    const u = f.party.find(v => v.id === f.relay!.id)!, hp = u.hp;
    damage(f, u, 50); // 아직 옮겨 오는 중
    expect(u.hp).toBeLessThan(hp);
    expect(f.relay).toMatchObject({ id: u.id, left: RELAY.hops - 1 });
    for (let k = 1; k < RELAY.hops; k++) {
      const v = f.party.find(x => x.id === f.relay!.id)!;
      landed(f);
      damage(f, v, 100);
    }
    expect(f.relay).toBeNull();
  });

  it('20초가 지나면 사라지고, 빛이 깃든 사람이 쓰러지면 다른 사람에게 (횟수는 그대로)', () => {
    const f = fight(), d = others(f, tank(f)).find(v => !v.me)!;
    put(f, d);
    landed(f);
    d.ab = null; d.guardian = 0; // 얼음 방패 · 수호 영혼 없이
    damage(f, d, 1e6); // 쓰러짐: 회복 없이
    expect(d.alive).toBe(false);
    E.step(f);
    expect(f.relay).not.toBeNull();
    expect(f.relay!.id).not.toBe(d.id);
    expect(f.relay!.left).toBe(RELAY.hops);
    f.relay!.until = f.t;
    E.step(f);
    expect(f.relay).toBeNull();
  });

  it('뒤집힌 축복 (힐이 피해)이 걸리면 회복하지 않고 옮겨 감', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    t.debuffs.push({ id: 999, name: '뒤집힌 축복', type: '마법', left: 10, invert: true } as unknown as Unit['debuffs'][number]);
    t.hp = t.max * 0.8;
    const hp = t.hp;
    damage(f, t, 200);
    expect(t.hp).toBeLessThan(hp);
    expect(f.relay!.id).not.toBe(t.id);
    expect(f.relay!.left).toBe(RELAY.hops);
  });

  it('회복할 때마다 신성화 게이지가 참 (평온 게이지는 그대로)', () => {
    const f = fight(), t = tank(f);
    put(f, t);
    landed(f);
    f.g.p = 10; f.g.s = 10;
    damage(f, t, 200);
    expect(f.g.p).toBe(10);
    expect(f.g.s).toBeGreaterThanOrEqual(10 + RELAY.gs);
  });

  it('자동 힐러: Lv 15부터 씀, 프로토타입 일치 비교 (proto)에서는 안 씀', () => {
    const run = (level: number, proto = false) => {
      const f = E.create({ encounter: 'warden', diff: '보통', seed: 3, level, hero: 'priest', proto });
      let n = 0;
      while (!f.over && f.t < 120) {
        E.autoHealer(f); E.step(f);
        n += f.events.filter(e => e.type === 'fx' && e.name === 'relay-land').length;
        f.events.length = 0;
      }
      return n;
    };
    expect(run(30)).toBeGreaterThan(3);
    expect(run(14)).toBe(0);
    expect(run(30, true)).toBe(0);
  });
});
