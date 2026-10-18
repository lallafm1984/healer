/** 탱커 전멸 규칙 (2026-10-07 Lim). 특성 「버팀목」은 2026-10-12에 뺌 (파티원 = 성격 + 직업 스킬) */
import { describe, expect, it } from 'vitest';
import * as E from '../src/engine';
import type { Fight, RosterEntry } from '../src/engine';

const PARTY: RosterEntry[] = [
  { role: 'tank', pers: '신중파', nick: '방패', cls: 'warrior' },
  { role: 'melee', pers: '신중파', nick: '칼날', cls: 'rogue' },
  { role: 'melee', pers: '신중파', nick: '검', cls: 'swordsman' },
  { role: 'ranged', pers: '신중파', nick: '화살', cls: 'archer' },
];
const killTanks = (f: Fight) => { for (const u of f.party) if (u.role === 'tank') { u.guardian = 0; u.hp = 1; } };
const run = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end) { E.step(f); f.events.length = 0; } };

describe('탱커가 모두 쓰러져도 전투는 계속', () => {
  it('탱커가 쓰러지면 첫 근접이 대신 맞고 전투는 계속 (버티는 특성 없음)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: PARTY });
    run(f, 3);
    const tank = f.party.find(u => u.role === 'tank')!;
    tank.hp = 0.5; tank.guardian = 0;
    while (tank.alive && f.t < 60) { E.step(f); f.events.length = 0; }
    expect(tank.alive).toBe(false);
    E.step(f); f.events.length = 0;
    expect(f.over).toBeNull();
    expect(E.aggroTarget(f)?.nick).toBe('칼날');
  });

  it('보스는 탱커 → 근접 → 원거리 → 나 순서로 때림', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: PARTY });
    const who = () => {
      const s = f.skills.find(x => x.key === 'buster')!;
      return s.target!(f).map(id => f.party.find(u => u.id === id)!.nick);
    };
    expect(who()).toEqual(['방패']);
    const kill = (nick: string) => { const u = f.party.find(x => x.nick === nick)!; u.alive = false; u.hp = 0; };
    kill('방패'); expect(who()).toEqual(['칼날']);
    kill('칼날'); expect(who()).toEqual(['검']);
    kill('검'); expect(who()).toEqual(['화살']);
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

describe('공개모집 파티원', () => {
  it('성격과 직업 스킬만 가짐 (특성 없음)', () => {
    for (let s = 1; s <= 100; s++) {
      for (const m of E.recruitParty('plague', s, { abilities: true })) {
        expect(Object.keys(m).sort()).toEqual(['ab', 'cls', 'fm', 'nick', 'pers', 'role']); // fm = 97 능력치 · 그날 컨디션
      }
    }
  });
});
