/** 초보 자동 힐러 (engine/novice · auto noviceHealer) · 초보 검사 (sim/novice), 2026-10-22 Lim 「처음사용자 시점의 조작의 테스트로 초반 난이도 체크」 */
import { describe, expect, it } from 'vitest';
import { contentOf, CONTENT, stageOf } from '../src/data/content';
import { gearStatsOf, specsOf } from '../src/data/equipment';
import { rampDiffs, rampPlace, rampRefLevel } from '../src/data/progression';
import { TALENTS } from '../src/data/talents';
import * as E from '../src/engine';
import { bigButton } from '../src/engine/novice';
import { measureNovice, noviceCells, noviceTarget, runNovice, TUT_TARGET, type NoviceCell } from '../src/sim/novice';
import { rampPlayer } from '../src/sim/ramp';

const cell = (key: string, d: NoviceCell['d']) => noviceCells(['쉬움', '보통', '어려움']).find(x => x.c.key === key && x.d === d)!;
/** 녹슨 고원 보통 첫 구간 한 판 (길의 레벨 · 장비, 공개모집) */
function fight(seed: number): E.Fight {
  const c = contentOf('plateau'), d = '보통' as const, rp = rampPlayer(c, d, 'priest', seed), seg = c.fights(d)[0];
  return E.create({
    encounter: seg, diff: d, seed, hero: 'priest', level: rp.lv, heroLv: rp.lv, stageLv: stageOf(c, d), talents: TALENTS.map(t => (t.lv <= rp.lv ? 0 : null)),
    party: E.recruitParty(seg, seed, { abilities: true, myLv: rp.lv, stageLv: stageOf(c, d) }), gearStats: gearStatsOf(rp.eq, rp.lv), specs: specsOf(rp.eq, 'priest'),
  });
}
/** 한가해진 뒤 다음 시전까지 걸린 초 (40초까지) */
function gaps(healer: (f: E.Fight) => void, seed: number, opts?: Parameters<typeof E.noviceHealer>[1]): number[] {
  const f = fight(seed), out: number[] = [];
  let freeAt: number | null = null, casts = 0;
  while (!f.over && f.t < 40) {
    if (opts) E.noviceHealer(f, opts); else healer(f);
    const n = Object.values(f.stats.casts).reduce((a, b) => a + b, 0);
    if (n !== casts) { if (freeAt != null) out.push(f.t - freeAt); casts = n; freeAt = null; }
    E.step(f); f.events.length = 0;
    if (freeAt == null && !f.cast && f.gcd <= 0 && f.channel <= 0 && !f.queued) freeAt = f.t;
  }
  return out;
}

describe('초보 자동 힐러', () => {
  it('숙련 자동 힐러는 한가해진 틱에 바로 이어 누르고, 초보는 반응 · 고르기 · 누르기만큼 늦게 누름', () => {
    const fast = gaps(E.autoHealer, 1), slow = gaps(E.noviceHealer, 1);
    expect(Math.min(...fast)).toBeLessThan(0.1);
    // 반응 0.25초 (흔들림 σ 0.3 → 거의 0.1초 위), 바꿔 누르면 고르기 · 누르기가 더해짐
    expect(Math.min(...slow)).toBeGreaterThan(0.08);
    expect(slow.reduce((a, b) => a + b, 0) / slow.length).toBeGreaterThan(0.4);
  });
  it('한계를 모두 빼면 숙련과 거의 같은 빠르기 (판단은 자동 힐러 그대로)', () => {
    const pro = gaps(E.autoHealer, 2, { react: 0, pick: 0, tap: 0, spread: 0, lapse: { every: 1e9, min: 0, max: 0 }, see: 0, misTap: 0, notice: 1e-6, recall: 1, queue: true, tactics: true });
    expect(Math.min(...pro)).toBeLessThan(0.1);
    expect(pro.filter(g => g < 0.1).length).toBeGreaterThanOrEqual(gaps(E.autoHealer, 2).filter(g => g < 0.1).length - 2);
  });
  it('같은 시드면 같은 판 (엔진 난수와 따로 굴림)', () => {
    const x = cell('scrapheap', '쉬움');
    expect(runNovice(x, 'priest', 3)).toEqual(runNovice(x, 'priest', 3));
  });
  it('옆 칸: misTap 1이면 대상이 있는 탭은 모두 옆 칸 (빈 칸이면 헛탭)', () => {
    const r = runNovice(cell('plateau', '보통'), 'priest', 1, 'novice', { misTap: 1 });
    expect(r.misTaps).toBeGreaterThan(0);
    expect(r.misTaps).toBeLessThanOrEqual(r.presses);
  });
  it('큰 버튼 = 재사용 30초 이상 · 평온 성언 · 환생', () => {
    expect(bigButton('guardian')).toBe(true);
    expect(bigButton('hymn')).toBe(true);
    expect(bigButton('serenity')).toBe(true);
    expect(bigButton('rebirth')).toBe(true);
    expect(bigButton('heal')).toBe(false);
    expect(bigButton('purify')).toBe(false);
  });
});

describe('초보 검사 (초반 순차 레벨링 구간)', () => {
  it('칸 = 첫 전투 → 장소 Lv 20까지 장소 레벨 순 · 길의 난이도', () => {
    const xs = noviceCells(['쉬움', '보통', '어려움']);
    expect(xs[0].c.key).toBe('tutorial');
    expect(xs[1]).toMatchObject({ d: '쉬움', tut: true });
    expect(xs[1].c.key).toBe('plateau');
    const places = CONTENT.filter(c => rampPlace(c) && c.ready);
    expect(xs.length).toBe(1 + places.reduce((a, c) => a + rampDiffs(c).length, 0));
    expect(xs.filter(x => x.tut).length).toBe(2);
  });
  it('그 칸에 처음 들어갈 때의 레벨 = 길잡이 권장 레벨 흐름 (rampRefLevel)', () => {
    for (const c of CONTENT.filter(x => rampPlace(x) && x.ready)) for (const d of ['쉬움', '보통'] as const) {
      expect(rampPlayer(c, d, 'priest', 1).lv, `${c.name} ${d}`).toBe(rampRefLevel(c, d));
    }
  });
  it('튜토리얼 두 판 (첫 전투 · 녹슨 고원 쉬움)은 처음 하는 사람도 거의 다 깸', () => {
    for (const x of noviceCells(['쉬움']).filter(x => x.tut)) {
      expect(noviceTarget(x)).toBe(TUT_TARGET);
      expect(measureNovice(x, 'priest', 10).rate, x.c.name).toBeGreaterThanOrEqual(TUT_TARGET);
    }
  });
});

describe('초보 하한 지킴 (2026-10-22 Lim 「추천대로」, data/tune)', () => {
  it('예전에 가장 낮던 녹슨 고원 보통 · 고철 더미 언덕 보통도 처음 하는 사람이 목표 근처 (시드 1 ~ 20, 흔들림 10%p)', () => {
    for (const key of ['plateau', 'scrapheap']) {
      const x = cell(key, '보통');
      expect(measureNovice(x, 'priest', 20).rate, x.c.name).toBeGreaterThanOrEqual(noviceTarget(x)! - 10);
    }
  });
});
