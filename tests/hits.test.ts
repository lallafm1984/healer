/** 파티원 공격은 한 방씩, 적 체력도 그만큼 깎임 · 딜미터기 (2026-10-07 Lim) */
import { describe, expect, it } from 'vitest';
import * as E from '../src/engine';

describe('파티원 공격', () => {
  it('공격 한 방마다 hit 이벤트, 적 체력은 그 합만큼만 깎임', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 3 });
    const hits: { uid: number; amt: number }[] = [];
    let prev = f.bossHp, drops = 0;
    while (f.t < 20 && !f.over) {
      E.step(f);
      const now = f.events.filter(e => e.type === 'hit') as { uid: number; amt: number }[];
      hits.push(...now);
      const sum = now.reduce((s, h) => s + h.amt, 0);
      expect(prev - f.bossHp).toBeCloseTo(sum, 6); // 공격이 없는 틱은 체력이 그대로
      if (sum > 0) drops++;
      prev = f.bossHp;
      f.events.length = 0;
    }
    expect(drops).toBeGreaterThan(10);
    expect(drops).toBeLessThan(20 * 20 / 2); // 틱마다 깎이지 않음
    // 사람마다 따로 (같은 틱에 합치지 않음), 근접은 1.5초 · 나머지는 2초 간격
    const byUnit = new Map<number, number>();
    for (const h of hits) byUnit.set(h.uid, (byUnit.get(h.uid) || 0) + 1);
    for (const u of f.party.filter(x => !x.me && x.alive)) {
      const n = byUnit.get(u.id) || 0;
      expect(n).toBeGreaterThanOrEqual(u.role === 'melee' ? 11 : 8);
      expect(n).toBeLessThanOrEqual(u.role === 'melee' ? 14 : 10);
    }
  });

  it('평균 딜은 초당 딜과 같음, 딜미터기 합 = 깎인 체력', () => {
    const f = E.create({ encounter: 'warden', diff: '쉬움', seed: 4 });
    let expected = 0;
    while (f.t < 30 && !f.over) { E.autoHealer(f); E.step(f); expected += E.partyDps(f) * E.DT; f.events.length = 0; }
    expect(f.stats.deaths).toBe(0); // 쓰러지면 모아 둔 딜은 버리니 비교는 아무도 안 쓰러진 판으로
    const dealt = f.party.reduce((s, u) => s + u.dealt, 0);
    const pending = f.party.reduce((s, u) => s + u.acc, 0);
    expect(f.bossMax - f.bossHp).toBeCloseTo(dealt, 6);
    expect(dealt + pending).toBeCloseTo(expected, 3);
    expect(f.me.dealt).toBe(0);
  });
});
