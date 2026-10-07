/** 탱커 전멸 규칙과 특성 「버팀목」 (2026-10-07 Lim) */
import { describe, expect, it } from 'vitest';
import { BULWARK, TRAIT_CHANCE } from '../src/data/traits';
import * as E from '../src/engine';
import type { Fight, RosterEntry } from '../src/engine';

const PARTY: RosterEntry[] = [
  { role: 'tank', pers: '신중파', nick: '방패', cls: 'warrior' },
  { role: 'melee', pers: '신중파', nick: '칼날', cls: 'rogue' },
  { role: 'melee', pers: '신중파', nick: '버팀', cls: 'swordsman', traits: ['bulwark'] },
  { role: 'ranged', pers: '신중파', nick: '화살', cls: 'archer' },
];
const killTanks = (f: Fight) => { for (const u of f.party) if (u.role === 'tank') { u.guardian = 0; u.hp = 1; } };
const run = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end) { E.step(f); f.events.length = 0; } };

describe('탱커가 모두 쓰러져도 전투는 계속', () => {
  it('탱커가 쓰러지면 버팀목 특성 근접이 대신 맞고, 10초간 받는 피해 절반 (1회)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: PARTY });
    run(f, 3);
    const tank = f.party.find(u => u.role === 'tank')!;
    tank.hp = 0.5; tank.guardian = 0;
    const msgs: string[] = [];
    while (tank.alive && f.t < 60) { E.step(f); for (const ev of f.events) if (ev.type === 'msg') msgs.push(ev.text); f.events.length = 0; }
    expect(tank.alive).toBe(false);
    E.step(f); for (const ev of f.events) if (ev.type === 'msg') msgs.push(ev.text); f.events.length = 0;
    expect(f.over).toBeNull();
    const b = f.party.find(u => u.nick === '버팀')!;
    expect(b.bulwarkUsed).toBe(true);
    expect(b.bulwark).toBeGreaterThan(BULWARK.sec - 0.2);
    expect(msgs.some(m => m.includes('버팀목'))).toBe(true);
    // 받는 피해 -50%: 같은 광역을 버팀목 켜짐/꺼짐으로 비교
    const aoe = (g: Fight) => (g.skills.find(s => s.key === 'aoe')!.hit as (g: Fight, t: unknown) => void)(g, null);
    for (const on of [false, true]) {
      const g = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: PARTY });
      const u = g.party.find(x => x.nick === '버팀')!;
      if (on) u.bulwark = 5;
      const full = u.hp; aoe(g);
      expect(full - u.hp).toBeCloseTo(170 * g.dmgMult * (on ? 1 - BULWARK.cut : 1));
    }
    // 끝나면 다시 켜지지 않음
    run(f, BULWARK.sec + 1);
    if (b.alive) expect(b.bulwark).toBeLessThanOrEqual(0);
  });

  it('보스는 탱커 → 버팀목 → 근접 → 원거리 → 나 순서로 때림', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: PARTY });
    const who = () => {
      const s = f.skills.find(x => x.key === 'buster')!;
      return s.target!(f).map(id => f.party.find(u => u.id === id)!.nick);
    };
    expect(who()).toEqual(['방패']);
    const kill = (nick: string) => { const u = f.party.find(x => x.nick === nick)!; u.alive = false; u.hp = 0; };
    kill('방패'); expect(who()).toEqual(['버팀']);
    kill('버팀'); expect(who()).toEqual(['칼날']);
    kill('칼날'); expect(who()).toEqual(['화살']);
    kill('화살'); expect(who()).toEqual(['나']);
  });

  it('파티원이 모두 쓰러지면 전멸, 힐러가 쓰러지면 실패', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 2, party: PARTY });
    killTanks(f); run(f, 1);
    for (const u of f.party) if (!u.me) { u.alive = false; u.hp = 0; }
    E.step(f);
    expect(f.over).toBe('lose');
    expect(f.reason).toBe('파티 전멸');
    const g = E.create({ encounter: 'scrap', diff: '보통', seed: 2, party: PARTY });
    g.me.alive = false; g.me.hp = 0; E.step(g);
    expect(g.reason).toBe('힐러가 쓰러짐');
  });

  it('탱커가 없어도 힐을 안 하면 결국 짐 (끝없는 전투 없음)', () => {
    for (const seed of [1, 2, 3]) {
      const f = E.create({ encounter: 'warden', diff: '보통', seed, party: PARTY });
      while (!f.over && f.t < 700) { E.step(f); f.events.length = 0; }
      expect(f.over).toBe('lose');
    }
  });
});

describe('공개모집 특성', () => {
  it('버팀목은 근접에게만, 대략 정해진 확률로 붙음', () => {
    let melee = 0, withTrait = 0;
    for (let s = 1; s <= 400; s++) {
      for (const m of E.recruitParty('plague', s)) {
        if (m.traits?.length) expect(m.role).toBe('melee');
        if (m.role === 'melee') { melee++; if (m.traits?.includes('bulwark')) withTrait++; }
      }
    }
    expect(withTrait / melee).toBeGreaterThan(TRAIT_CHANCE - 0.06);
    expect(withTrait / melee).toBeLessThan(TRAIT_CHANCE + 0.06);
  });
});
