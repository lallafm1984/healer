/** 익숙한 사람 검사 (sim/familiar, 2026-10-22 Lim 「나머지 레벨구간도 익숙한 사람 기준으로 체크해보자」) */
import { describe, expect, it } from 'vitest';
import { CONTENT, stageOf } from '../src/data/content';
import { rampPlace } from '../src/data/progression';
import { balanceable, targetOf } from '../src/sim/balance';
import { bandOf, designTarget, expertAim, familiarCells, familiarPlayer, familiarTarget, measureFamiliar, midGear, MID_GRADE } from '../src/sim/familiar';
import { designCell, designDmg } from '../src/sim/balance';
import { gearAt, journey } from '../src/sim/journey';
import { ITEM_GRADES, itemScore, SLOTS } from '../src/data/equipment';
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
    expect(familiarPlayer(x, 'priest', 1, 'journey')).toEqual(familiarPlayer(x, 'priest', 6, 'journey')); // 길 시드 5개를 돌려 씀
  });
});

describe('레벨 디자인 기준 (2026-10-22 Lim 「장비는 20레벨 부터 부위마다 중간 등급 기준으로해서 너무 쉽지도, 너무 어렵지도 않는」)', () => {
  it('장비 = 6부위 모두 희귀 (다섯 등급 가운데), 옵션 굴림 100%, 아이템 레벨 = 내 레벨, 같은 시드면 같은 장비', () => {
    const eq = midGear(47, 'druid', 3);
    expect(MID_GRADE).toBe(ITEM_GRADES[2]);
    for (const s of SLOTS) {
      const it = eq[s.key]!;
      expect(it.grade).toBe('희귀');
      expect(it.lv).toBe(47);
      expect((it.fixedRolls ?? []).every(r => r === 1)).toBe(true);
      expect(it.lines.every(l => l.roll === 1)).toBe(true);
    }
    expect(midGear(47, 'druid', 3)).toBe(eq);
    const x = familiarCells(['보통'])[0];
    expect(familiarPlayer(x, 'priest', 2).eq.weapon!.grade).toBe('희귀');
  });
  it('띠: 아래 선 = 하한, 위 선 = 아래 선 + 14, 가운데를 겨눔 (쉬움은 아래 선만)', () => {
    const at = (key: string, d: '쉬움' | '보통' | '어려움' | '악몽') => designTarget({ c: contentOf(key as never), d });
    expect(at('heartcrack', '악몽')).toEqual({ min: 30, max: 44, aim: 37 });
    expect(at('heartcrack', '어려움')).toEqual({ min: 45, max: 59, aim: 52 });
    expect(at('heartcrack', '쉬움')).toEqual({ min: 90, max: 100, aim: 97 });
  });
  it('자동 밸런스: 순차 구간 밖 장소는 레벨 디자인 칸, 띠 안이면 배율 그대로 · 밖이면 겨눌 값으로 (쉬움은 내리기만)', () => {
    expect(designCell(contentOf('mossroot'))).toBe(true);
    expect(designCell(contentOf('rustfort'))).toBe(false);
    const rate = (m: number) => Math.max(0, Math.min(100, 140 - 60 * m));
    const band = { min: 60, max: 74, aim: 67 }; // 겨눔 67% = 배율 약 1.22
    expect(designDmg(rate, '어려움', 1.2, band)).toBe(1.2); // 68% 띠 안
    expect(designDmg(rate, '어려움', 1.4, band)).toBeCloseTo(1.22, 1); // 56% 너무 어려움 → 내림
    expect(designDmg(rate, '어려움', 0.8, band)).toBeCloseTo(1.22, 1); // 92% 너무 쉬움 → 올림
    expect(designDmg(rate, '쉬움', 1.0, { min: 90, max: 100, aim: 97 })).toBeLessThanOrEqual(1.0); // 쉬움은 내리기만
  });
});
