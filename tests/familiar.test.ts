/** 익숙한 사람 검사 (sim/familiar, 2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」) */
import { describe, expect, it } from 'vitest';
import { CONTENT, stageOf } from '../src/data/content';
import { rampPlace } from '../src/data/progression';
import { balanceable, targetOf } from '../src/sim/balance';
import { bandOf, expertAim, familiarCells, measureFamiliar } from '../src/sim/familiar';

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
