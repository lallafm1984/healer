/** 자동 밸런스 (38 0-6): 배율 찾기 · 기준 조건 · tune 표 쓰기 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { TUNE } from '../src/data/tune';
import * as E from '../src/engine';
import { applyRows, BUSY, findDmg, placeTune, renderTune, rewriteTuneFile, runOnce, standard, TARGET, tooIdle, verdictOf, type Measure, type Row } from '../src/sim/balance';

describe('배율 찾기', () => {
  it('클리어율이 배율에 따라 줄면 목표에 맞는 배율을 찾음', () => {
    const rate = (m: number) => Math.max(0, Math.min(100, 100 - 40 * (m - 1)));
    const r = findDmg(rate, 85);
    expect(r.dmg).toBeCloseTo(1.375, 1);
    expect(Math.abs(r.rate - 85)).toBeLessThanOrEqual(1);
  });
  it('너무 쉬우면 배율을 올리고, 범위 끝에 닿으면 가장 가까운 값', () => {
    expect(findDmg(m => (m < 2 ? 100 : 80), 85).dmg).toBeGreaterThanOrEqual(2);
    expect(findDmg(() => 100, 85).dmg).toBeGreaterThan(2.9);
  });
});

describe('바쁨 하한 (Lim 2026-10-10 「초반에도 힐러가 충분히 바빠야」)', () => {
  const m = (rate: number, busy: number): Measure => ({ rate, busy, byHero: { priest: rate, druid: rate, paladin: rate }, time: 120, fails: {} });
  it('쉬움 · 보통만, 클리어율이 목표 안인데 받는 피해가 치유 분당 하한 아래면 한가함', () => {
    expect(BUSY['보통']).toBeGreaterThan(BUSY['쉬움']!);
    expect(BUSY['어려움']).toBeUndefined();
    expect(tooIdle('보통', m(100, 15))).toBe(true);
    expect(tooIdle('보통', m(100, BUSY['보통']!))).toBe(false);
    expect(tooIdle('보통', m(90, 15))).toBe(false); // 어려우면 낮추는 쪽이 먼저
    expect(tooIdle('어려움', m(85, 5))).toBe(false);
  });
  it('한 판의 바쁨 = 받은 피해 ÷ 치유 한 번 크기 (구간 합)', () => {
    const r = runOnce(contentOf('plateau'), '보통', 'priest', 1);
    expect(r.heals).toBeGreaterThan(0);
    expect(r.heals / (r.time / 60)).toBeGreaterThan(5);
  });
});

describe('기준 조건과 목표 (26 9-2)', () => {
  it('목표: 보통 > 어려움 > 악몽, 보통은 아래 선만', () => {
    expect(TARGET['보통'].aim).toBeGreaterThan(TARGET['어려움'].aim);
    expect(TARGET['어려움'].aim).toBeGreaterThan(TARGET['악몽'].aim);
    expect(verdictOf('보통', 100)).toBe('ok');
    expect(verdictOf('보통', 90)).toBe('hard');
    expect(verdictOf('어려움', 95)).toBe('easy');
    expect(verdictOf('악몽', 75)).toBe('ok');
  });
  it('레벨은 열림 레벨 (악몽만 따로 잠긴 레이드는 그 레벨), 권장 장비, 던전만 어픽스', () => {
    expect(standard(contentOf('abyss1'), '악몽')).toEqual({ lv: 50, gear: 'rare5', affixes: [] });
    expect(standard(contentOf('abyss1'), '어려움')).toEqual({ lv: 35, gear: 'adv0', affixes: [] });
    expect(standard(contentOf('rustfort'), '보통').gear).toBe('none');
  });
  it('보정을 넘기면 data/tune 대신 그 값', () => {
    const a = E.create({ encounter: 'plague', diff: '어려움', seed: 1, level: 35 });
    const b = E.create({ encounter: 'plague', diff: '어려움', seed: 1, level: 35, tune: { dmg: 1 } });
    expect(a.dmgMult / b.dmgMult).toBeCloseTo(TUNE.plague!['어려움']!.dmg!);
  });
  it('한 판: 장소의 구간을 끝까지 (탐험 녹슨 고원)', () => {
    const r = runOnce(contentOf('plateau'), '보통', 'priest', 1);
    expect(typeof r.win).toBe('boolean');
    expect(r.time).toBeGreaterThan(0);
  });
});

describe('tune 표', () => {
  it('장소의 지금 보정: 레이드는 그 보스 값, 보정 없는 던전은 빈 값', () => {
    expect(placeTune(TUNE, contentOf('abyss1'), '악몽')).toEqual(TUNE.plague!['악몽']);
    expect(placeTune({}, contentOf('rustfort'), '보통')).toEqual({});
    expect(placeTune({ gate: { '어려움': { dmg: 1.1 } } }, contentOf('rustfort'), '어려움')).toBeNull();
  });
  it('찾은 값은 장소의 모든 구간에, 1이면 지움', () => {
    const row = (dmg: number) => ({ key: 'rustfort', diff: '어려움', next: { dmg } }) as unknown as Row;
    const t = applyRows(TUNE, [row(1.2)]);
    for (const k of ['gate', 'scrap', 'boiler', 'warden'] as const) expect(t[k]?.['어려움']).toEqual({ dmg: 1.2 });
    expect(t.plague).toEqual(TUNE.plague);
    expect(applyRows(t, [row(1)]).gate?.['어려움']).toBeUndefined();
  });
  it('data/tune.ts를 다시 써도 지금 내용 그대로 (위 설명은 남김)', () => {
    const src = readFileSync('src/data/tune.ts', 'utf8');
    expect(rewriteTuneFile(src, TUNE)).toBe(src);
    expect(renderTune({ warden: { '악몽': { dmg: 1.1, hp: 0.9 } } })).toContain("warden: { '악몽': { dmg: 1.1, hp: 0.9 } },");
  });
});
