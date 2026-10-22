/** 영웅 「대신 맞아 줌」 (75) 두 사람이 서로 맡으면 피해를 끝없이 주고받아 스택이 넘쳤음 (2026-10-22, 길드 v2 스레드가 sim:players hardcore #1 1일째 Lv 12에서 찾음) */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { coverPart } from '../src/engine/persona';

function fight(): E.Fight {
  const c = contentOf('rustfort'), seg = c.fights('보통')[0];
  const party = E.recruitParty(seg, 7);
  party[1].pers = '영웅'; party[2].pers = '영웅';
  return E.create({ encounter: seg, diff: '보통', seed: 7, party, level: 10, heroLv: 10, stageLv: 7 });
}

describe('영웅이 서로 대신 맞아 줄 때', () => {
  it('맡아 준 피해는 다시 떠넘기지 않아 끝없이 주고받지 않음', () => {
    const f = fight();
    const [a, b] = f.party.filter(u => !u.me && u.pers === '영웅');
    expect(a && b).toBeTruthy();
    a.coverBy = { id: b.id, until: f.t + 5, share: 0.3 };
    b.coverBy = { id: a.id, until: f.t + 5, share: 0.3 };
    const ha = a.hp, hb = b.hp;
    expect(() => damage(f, a, 100)).not.toThrow();
    // a는 70, b는 30 × (배율 보정)만 받음: b가 받은 몫을 다시 a에게 떠넘기지 않음
    expect(ha - a.hp).toBeGreaterThan(0);
    expect(hb - b.hp).toBeGreaterThan(0);
    expect((hb - b.hp) / (ha - a.hp)).toBeCloseTo(0.3 / 0.7, 1);
    // 판을 끝까지 돌려도 터지지 않음
    expect(() => { while (!f.over && f.t < 120) { E.autoHealer(f); E.step(f); f.events.length = 0; } }).not.toThrow();
  });
  it('coverPart: 서로 맡은 두 사람도 몫을 돌려주되 (떠넘기기는 damage가 한 번만), 쓰러진 영웅 · 시간이 지나면 없음', () => {
    const f = fight();
    const [a, b] = f.party.filter(u => !u.me && u.pers === '영웅');
    a.coverBy = { id: b.id, until: f.t + 5, share: 0.3 };
    expect(coverPart(f, a, 100)).toMatchObject({ by: b, part: 30 });
    b.alive = false;
    expect(coverPart(f, a, 100)).toBeNull();
    b.alive = true; a.coverBy.until = f.t;
    expect(coverPart(f, a, 100)).toBeNull();
  });
});
