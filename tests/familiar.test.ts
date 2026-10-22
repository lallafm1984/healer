/** 익숙한 사람 검사 (sim/familiar, 2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」) */
import { describe, expect, it } from 'vitest';
import { CONTENT, stageOf } from '../src/data/content';
import { rampPlace } from '../src/data/progression';
import { balanceable, targetOf } from '../src/sim/balance';
import { bandOf, expertAim, familiarCells, familiarPlayer, familiarTarget, measureFamiliar } from '../src/sim/familiar';
import { gearAt, journey } from '../src/sim/journey';
import { itemScore, SLOTS } from '../src/data/equipment';
import { contentOf } from '../src/data/content';

describe('익숙한 사람 검사', () => {
  it('칸 = 순차 구간 밖 장소 (레이드 포함) × 난이도, 적 레벨 순', () => {
    const xs = familiarCells(['보통']);
    expect(xs.length).toBe(CONTENT.filter(c => balanceable(c) && !rampPlace(c)).length);
    expect(xs.some(x => rampPlace(x.c))).toBe(false);
    expect(xs.some(x => x.c.kind === 'raid')).toBe(true);
    for (let i = 1; i < xs.length; i++) expect(stageOf(xs[i].c, '보통')).toBeGreaterThanOrEqual(stageOf(xs[i - 1].c, '보통'));
  });
  it('숙련 목표 = 장소 레벨 곡선 가운데값, 구간 끊음은 103과 같음', () => {
    const x = familiarCells(['어려움'])[0];
    expect(expertAim(x)).toBe(targetOf(x.c, '어려움').aim);
    expect([bandOf(21), bandOf(45), bandOf(46), bandOf(70), bandOf(71), bandOf(120)]).toEqual(['Lv 21~45', 'Lv 21~45', 'Lv 46~70', 'Lv 46~70', 'Lv 71~100+', 'Lv 71~100+']);
  });
  it('같은 시드면 같은 결과 (익숙한 사람 · 숙련 모두)', () => {
    const x = familiarCells(['쉬움'])[0];
    expect(measureFamiliar(x, 1, 'familiar', ['priest'])).toEqual(measureFamiliar(x, 1, 'familiar', ['priest']));
    expect(measureFamiliar(x, 1, 'expert', ['priest']).rate).toBeGreaterThanOrEqual(0);
  });
});

describe('Lv 21 ~ 100 하한 (2026-10-22 Lim 「고친다. 20레벨 이후는 장비를 감안해서 고치자」)', () => {
  it('하한 목표: 적 레벨 21 → 100 사이 직선 (보통 85 → 80 · 어려움 60 → 45 · 악몽 45 → 30, 쉬움 90)', () => {
    const at = (key: string, d: '쉬움' | '보통' | '어려움' | '악몽') => familiarTarget({ c: contentOf(key as never), d });
    expect(at('mossroot', '보통')).toBeCloseTo(85 - (5 * 2) / 79, 1); // 이끼 뿌리 사원 보통 = 적 Lv 23
    expect(at('heartcrack', '악몽')).toBe(30); // 멈춘 심장 속 (적 Lv 100 넘음)
    expect(at('heartcrack', '쉬움')).toBe(90);
  });
  it('길잡이 길 장비: 레벨이 오르면 장비 점수가 늘고, 같은 길 시드면 같은 장비', () => {
    const j = journey('priest', 1), avg = (lv: number) => SLOTS.reduce((a, s) => a + (gearAt(j, lv)[s.key] ? itemScore(gearAt(j, lv)[s.key]!, lv) : 0), 0) / SLOTS.length;
    expect(Math.max(...j.keys())).toBe(100);
    expect(avg(50)).toBeGreaterThan(avg(25));
    expect(avg(100)).toBeGreaterThan(avg(50));
    expect(SLOTS.every(s => gearAt(j, 50)[s.key])).toBe(true);
    const x = familiarCells(['어려움'])[0];
    expect(familiarPlayer(x, 'priest', 1)).toEqual(familiarPlayer(x, 'priest', 6)); // 길 시드 5개를 돌려 씀
  });
});
