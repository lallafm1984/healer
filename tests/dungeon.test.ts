/** 던전 잡몹 구간·구간 이어가기 (23) */
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../src/data/dungeons';
import { ENCOUNTERS } from '../src/data/encounters';
import * as E from '../src/engine';

describe('잡몹 구간', () => {
  it('잡몹을 목록 순서대로 잡고, 다 잡으면 이김', () => {
    const f = E.create({ encounter: 'gate', diff: '보통', seed: 3 });
    expect(f.mobs.map(m => m.name)).toEqual(['고철 졸개', '고철 졸개', '고철 졸개', '잔해 투척병']);
    expect(f.bossMax).toBe(ENCOUNTERS.gate.hp);
    const order: number[] = [];
    while (!f.over && f.t < 300) {
      E.autoHealer(f); E.step(f);
      for (const ev of f.events) if (ev.type === 'mobDown') order.push(ev.id);
      f.events.length = 0;
      expect(f.bossHp).toBeCloseTo(f.mobs.reduce((s, m) => s + m.hp, 0));
    }
    expect(f.over).toBe('win');
    expect(f.reason).toBe('모두 쓰러뜨렸어요');
    expect(order).toEqual(f.mobs.map(m => m.id));
  });

  it('쓰러진 잡몹은 기술을 멈추고, 시전 중이던 기술도 끊김', () => {
    const f = E.create({ encounter: 'boiler', diff: '보통', seed: 5 });
    const golem = f.mobs.find(m => m.name === '보일러 골렘')!;
    // 증기 폭발 시전이 시작될 때까지
    while (!f.tels.some(t => t.skill.mob === golem.id)) { E.step(f); f.events.length = 0; }
    expect(E.queue(f)[0].name).toBe('증기 폭발');
    for (const m of f.mobs) { m.hp = m === golem ? 0.01 : 0; m.alive = m === golem; }
    E.step(f);
    expect(golem.alive).toBe(false);
    expect(f.tels.length).toBe(0);
    expect(f.over).toBe('win');
  });

  it('악몽은 잡몹 체력도 ×1.3', () => {
    const f = E.create({ encounter: 'boiler', diff: '악몽', seed: 1 });
    expect(f.mobs[0].max).toBeCloseTo(400 * 1.3);
    expect(f.bossMax).toBeCloseTo(ENCOUNTERS.boiler.hp * 1.3);
  });
});

describe('구간 이어가기', () => {
  it('휴식 뒤 마나는 초당 10% 회복, 성언 게이지는 그대로', () => {
    const f = E.create({ encounter: 'gate', diff: '보통', seed: 1 });
    f.mana = 40; f.g = { p: 60, s: 100 };
    expect(E.restCarry(f, 3)).toEqual({ mana: 70, g: { p: 60, s: 100 } });
    expect(E.restCarry(f, 30).mana).toBe(100);
    const g = E.create({ encounter: 'scrap', diff: '보통', seed: 1, carry: E.restCarry(f, 3) });
    expect(g.mana).toBe(70);
    expect(g.g).toEqual({ p: 60, s: 100 });
  });

  it('파티는 던전 내내 같은 사람들', () => {
    const run = { dungeon: 'rustfort' as const, diff: '보통' as const, seed: 9 };
    const parties = DUNGEONS.rustfort.segments.map((_, i) => E.segmentConfig(run, i).party);
    for (const p of parties) expect(p).toEqual(parties[0]);
  });

  it('자동 힐러 기준 보통·장비 없음은 대부분 클리어', () => {
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = E.simulateDungeon({ dungeon: 'rustfort', diff: '보통', gear: 'none', seed, items: ['mana', 'life'] });
      expect(r.fights.map(f => f.enc.key)).toEqual(DUNGEONS.rustfort.segments.slice(0, r.fights.length));
      if (r.win) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(16);
  });
});
