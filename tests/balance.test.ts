/** 자동 밸런스 (38 0-6): 배율 찾기 · 기준 조건 · tune 표 쓰기 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { TUNE } from '../src/data/tune';
import * as E from '../src/engine';
import { applyRows, BUSY, closeIn, findDmg, noviceCap, noviceCellOf, placeTune, renderTune, rewriteTuneFile, runOnce, standard, TARGET, tooIdle, verdictOf, type Measure, type Row } from '../src/sim/balance';
import { rampPlayer } from '../src/sim/ramp';
import { recommendedFor, SLOTS } from '../src/data/equipment';

describe('배율 찾기', () => {
  it('클리어율이 배율에 따라 줄면 목표에 맞는 배율을 찾음', () => {
    const rate = (m: number) => Math.max(0, Math.min(100, 100 - 40 * (m - 1)));
    const r = findDmg(rate, 85);
    expect(r.dmg).toBeCloseTo(1.375, 1);
    expect(Math.abs(r.rate - 85)).toBeLessThanOrEqual(1);
  });
  it('쉬움 · 보통은 찾은 값과 지금 배율 사이를 좁혀 아래 선을 지키는 가장 큰 배율 (첫 가운데 값에서 멈추지 않음)', () => {
    const rate = (m: number) => (m <= 0.9 ? 100 : 90);
    expect(findDmg(rate, TARGET['쉬움'].aim, 0.4, 1).dmg).toBeCloseTo(0.63);
    const got = closeIn(rate, '쉬움', 0.63, 1);
    expect(got).toBeGreaterThan(0.85);
    expect(got).toBeLessThanOrEqual(0.9);
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
    expect(standard(contentOf('abyss1'), '악몽')).toEqual({ lv: 60, gear: 'rare5', affixes: [] });
    expect(standard(contentOf('abyss1'), '어려움')).toEqual({ lv: 45, gear: 'adv0', affixes: [] });
    expect(standard(contentOf('rustfort'), '보통').gear).toBe('none');
    expect(standard(contentOf('mossroot'), '어려움')).toEqual({ lv: 25, gear: 'adv0', affixes: [] });
  });
  it('순차 레벨링 구간 (장소 Lv 20까지) 어려움 · 악몽 = 그 난이도가 처음 열린 플레이어 (2026-10-13 Lim 「Lv 1 어려움이 자동 힐로 안 깨짐」)', () => {
    // 녹슨 고원: 튜토리얼 → 쉬움 · 보통을 깨면 Lv 3 (70), 어려움을 한 번 깨도 아직 Lv 3
    expect(standard(contentOf('plateau'), '어려움')).toEqual({ lv: 5, gear: 'ramp', affixes: [], heroLv: 3 });
    expect(standard(contentOf('plateau'), '악몽')).toEqual({ lv: 7, gear: 'ramp', affixes: [], heroLv: 3 });
    expect(standard(contentOf('plateau'), '보통').gear).toBe('none');
    // 장비 = 그때까지 드롭 (녹슨 고원 어려움 = 쉬움 · 보통 2개, 악몽 = 어려움 1개 더), 시드마다 같은 결과
    const n = (eq: object) => Object.values(eq).filter(Boolean).length;
    for (let s = 1; s <= 10; s++) {
      expect(n(rampPlayer(contentOf('plateau'), '어려움', 'priest', s).eq)).toBeLessThanOrEqual(2);
      expect(n(rampPlayer(contentOf('plateau'), '악몽', 'priest', s).eq)).toBeLessThanOrEqual(3);
    }
    expect(rampPlayer(contentOf('crypt'), '어려움', 'druid', 4)).toBe(rampPlayer(contentOf('crypt'), '어려움', 'druid', 4));
    // 장소를 지날수록 장비가 늘고 레벨이 다음 장소를 따라감
    const late = rampPlayer(contentOf('lilypalace'), '어려움', 'priest', 1);
    expect(late.lv).toBeGreaterThanOrEqual(20);
    expect(SLOTS.filter(x => late.eq[x.key]).length).toBeGreaterThanOrEqual(5);
    // 이 칸들은 권장 장비 경고도 없음
    expect(recommendedFor(contentOf('plateau'), '어려움')).toBeNull();
    expect(recommendedFor(contentOf('plateau'), '악몽')).toBeNull();
    expect(recommendedFor(contentOf('mossroot'), '어려움')?.label).toBe('희귀'); // 2026-10-22 #382 중간 등급 기준 (예전 고급)
    expect(recommendedFor(contentOf('abyss1'), '악몽')?.label).toBe('희귀');
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

describe('장소 레벨 목표 곡선 (2026-10-19 Lim 「초반 쉽게 후반 어렵게」, 103)', () => {
  it('구간 가운데 목표 · 사이는 직선 · 끝 밖은 그대로, 보통은 아래 선만 · 어려움 · 악몽은 ± 7', async () => {
    const { aimAt, targetOf } = await import('../src/sim/balance');
    const { CONTENT, stageOf } = await import('../src/data/content');
    expect(aimAt('어려움', 1)).toBe(92); expect(aimAt('어려움', 10.5)).toBe(92); expect(aimAt('어려움', 33)).toBe(87); expect(aimAt('어려움', 58)).toBe(82); expect(aimAt('어려움', 100)).toBe(77);
    expect(aimAt('악몽', 5)).toBe(85); expect(aimAt('악몽', 85.5)).toBe(65);
    expect(aimAt('악몽', 45.5)).toBeCloseTo(75, 1); // 33 → 58 사이 가운데: 78 · 72 사이
    expect(aimAt('보통', 1)).toBe(99); expect(aimAt('보통', 100)).toBe(94);
    expect(aimAt('쉬움', 50)).toBe(99);
    for (const c of CONTENT.filter(x => x.ready)) for (const d of ['어려움', '악몽'] as const) {
      const t = targetOf(c, d), lv = stageOf(c, d);
      expect(t.max - t.aim).toBe(7); expect(t.aim - t.min).toBe(7);
      if (lv >= 85.5) expect(t.aim).toBe(d === '어려움' ? 77 : 65);
    }
    const early = CONTENT.find(x => x.ready && stageOf(x, '보통') <= 10)!;
    expect(targetOf(early, '보통')).toEqual({ min: 97, max: 100, aim: 99 });
  });
});

describe('초보 하한 (2026-10-22 Lim 「추천대로」, sim/novice B안)', () => {
  it('지키는 가장 큰 배율: 지금 배율이 지키면 그대로, 아니면 내려 찾고 사이를 좁힘', () => {
    expect(noviceCap(m => m <= 1.5, 1.23)).toBe(1.23);
    const got = noviceCap(m => m <= 0.97, 1.23);
    expect(got).toBeLessThanOrEqual(0.97);
    expect(got).toBeGreaterThan(0.94);
    expect(noviceCap(() => false, 1, 0.4)).toBe(0.4); // 끝까지 못 지키면 찾는 범위 아래 끝
  });
  it('보는 칸 = 장소 Lv 20까지 쉬움 · 보통 (녹슨 고원 쉬움은 튜토리얼 판)', () => {
    expect(noviceCellOf(contentOf('plateau'), '쉬움')).toMatchObject({ d: '쉬움', tut: true });
    expect(noviceCellOf(contentOf('rustfort'), '보통')).toMatchObject({ d: '보통', tut: false });
    expect(noviceCellOf(contentOf('rustfort'), '어려움')).toMatchObject({ d: '어려움', off: true }); // 장소 Lv 1~9 어려움은 길 밖이지만 초보 하한 (2026-10-22)
    expect(noviceCellOf(contentOf('rustfort'), '악몽')).toBeNull();
    expect(noviceCellOf(contentOf('greenhouse'), '어려움')).toMatchObject({ d: '어려움', tut: false }); // 장소 Lv 10~20 어려움은 길
    expect(noviceCellOf(contentOf('mossroot'), '보통')).toBeNull();
  });
});
