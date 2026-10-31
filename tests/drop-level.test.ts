/** 장비 레벨 = 그 콘텐츠 레벨 (2026-10-19 Lim 「70레벨의 20인 레이드 클리어시 100레벨 영웅장비가 나왔다. 던전 레벨에 맞는 장비」) */
import { describe, expect, it } from 'vitest';
import { CONTENT, contentOf, raidSize, stageOf } from '../src/data/content';
import { dropOdds, heroChance, LEGEND, LEGEND_LEVEL, LEGEND_CHANCE, LEGEND_CHANCE_10, legendChance, makeLegend, REPEAT_LEGEND, REPEAT_LEGEND_10, rollItem } from '../src/data/equipment';
import { rngFrom } from '../src/engine';
import { settle, type BattleResult } from '../src/game/settle';
import { newSave } from '../src/platform/storage';
import { gearGradeOdds } from '../src/data/reward-preview';
import { milestonesAt } from '../src/data/milestones';
import { rollover } from '../src/game/economy';

const run = (content: string, diff: BattleResult['diff'], stage: number): BattleResult => ({
  content: content as BattleResult['content'], diff, win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 200, restSec: 0, deaths: 0,
  healed: 1000, overheal: 100, dispels: 0, dispellable: 0, endMana: 40, minMana: 20, auto: false, party: [], detail: [], stage,
});

describe('장비 레벨은 그 콘텐츠 레벨', () => {
  it('Lv 100이 Lv 70 안팎 20인 레이드를 깨면 (적은 내 레벨 100) 장비는 그 레이드 레벨', () => {
    const c = CONTENT.find(x => x.ready && raidSize(x) === 20 && stageOf(x, '어려움') >= 60 && stageOf(x, '어려움') <= 80)!;
    expect(c).toBeTruthy();
    const s = newSave(); s.player.level = 100; s.tut = 99;
    const x = settle(s, run(c.key, '어려움', 100), () => 0.5);
    expect(x.items.length).toBe(1);
    expect(x.items[0].lv).toBe(stageOf(c, '어려움'));
    expect(x.items[0].lv).toBeLessThan(100);
  });
  it('탐험 · 던전은 예전처럼 장소 레벨 + 난이도', () => {
    const c = CONTENT.find(x => x.ready && x.kind === 'dungeon' && stageOf(x, '악몽') >= 30)!;
    const s = newSave(); s.player.level = 100; s.tut = 99;
    const x = settle(s, run(c.key, '악몽', stageOf(c, '악몽')), () => 0.5);
    expect(x.items[0].lv).toBe(stageOf(c, '악몽'));
  });
});

describe('레이드 다시 깬 판 (2026-10-19 Lim 「주 첫 판만 크게」)', () => {
  it('다시 깬 판 = 같은 레벨 던전 표의 영웅 확률 + 어려움 · 악몽 전설 20인 1% · 10인 0.5%', () => {
    for (const diff of ['보통', '어려움', '악몽'] as const) for (const raid of [10, 20] as const) {
      const again = dropOdds({ diff, raid, tierLv: 70, level: 70, repeat: true }), dungeon = dropOdds({ diff, raid: 0, tierLv: 70, level: 70 });
      const legend = legendChance({ diff, raid, tierLv: 70, level: 70, repeat: true });
      expect(again[4], `${diff} ${raid}`).toBeCloseTo(legend, 12);
      for (let i = 0; i < 3; i++) expect(again[i], `${diff} ${raid} 등급 ${i}`).toBeCloseTo(dungeon[i] * (1 - again[3] - legend) / (1 - dungeon[3]), 12);
      expect(heroChance({ diff, raid, tierLv: 70, level: 70, repeat: true })).toBe(heroChance({ diff, raid: 0, tierLv: 70, level: 70 }));
    }
    const legend = (diff: '보통' | '어려움' | '악몽', raid: 10 | 20, level: number, repeat: boolean) => legendChance({ diff, raid, tierLv: 100, level, grade: 'B', repeat });
    expect([legend('어려움', 20, 100, true), legend('악몽', 20, 100, true), legend('보통', 20, 100, true), legend('악몽', 10, 100, true), legend('악몽', 20, 99, true)]).toEqual([REPEAT_LEGEND['어려움'], REPEAT_LEGEND['악몽'], 0, REPEAT_LEGEND_10['악몽'], 0]);
    expect(REPEAT_LEGEND).toEqual({ '어려움': 0.01, '악몽': 0.01 });
    expect(REPEAT_LEGEND_10).toEqual({ '어려움': 0.005, '악몽': 0.005 });
    expect([legend('어려움', 10, 100, false), legend('악몽', 10, 100, false), legend('보통', 10, 100, false), legend('악몽', 10, 99, false)]).toEqual([LEGEND_CHANCE_10['어려움'], LEGEND_CHANCE_10['악몽'], 0, 0]);
    expect(LEGEND_CHANCE_10).toEqual({ '어려움': 0.01, '악몽': 0.025 });
    expect(legend('악몽', 20, 100, false)).toBe(LEGEND_CHANCE['악몽']); // 주 첫 클리어는 그대로
  });
});

describe('전설은 첫 20인 레이드 시작 레벨 이상이며 각 난이도 입장 레벨부터', () => {
  it('모든 레이드: 출전 확률과 실제 첫 보상 · 반복 보상에 전설 포함, 아이템 레벨은 해당 레이드 레벨', () => {
    for (const c of CONTENT.filter(x => x.ready && x.kind === 'raid')) for (const diff of ['어려움', '악몽'] as const) {
      const stage = stageOf(c, diff), level = Math.max(LEGEND_LEVEL, stage), raid = raidSize(c);
      for (const repeat of [false, true]) {
        const label = `${c.key} ${diff} ${repeat ? '반복' : '첫 판'}`;
        expect(gearGradeOdds(diff, raid, level - 1, 'A', false, stage, repeat)['전설'], label).toBe(0);
        const odds = gearGradeOdds(diff, raid, level, 'A', false, stage, repeat);
        expect(odds['전설'], label).toBeGreaterThan(0);
        const s = newSave(); s.player.level = level; s.tut = 99;
        const now = Date.UTC(2026, 9, 31);
        rollover(s, now, rngFrom(1));
        if (repeat) s.weekly.loot.push(`${c.key}|${diff}`);
        // 등급 추첨의 마지막 구간을 골라 실제 정산도 전설을 지급하는지 확인한다.
        const result = settle(s, run(c.key, diff, stage), () => 0.999999, [], now);
        expect(result.raidLoot, label).toBe(repeat ? 'again' : 'first');
        expect(result.items[0], label).toMatchObject({ grade: LEGEND, lv: stage });
        if (raid === 20) expect(!!result.items[0].unique || !!result.items[0].named, label).toBe(true);
      }
    }
  });

  it('Lv 69의 10인 첫 보상 · 반복 보상에서는 전설을 지급하지 않음', () => {
    const c = contentOf('abyss1'), now = Date.UTC(2026, 10, 1);
    for (const diff of ['어려움', '악몽'] as const) for (const repeat of [false, true]) {
      const s = newSave(); s.player.level = LEGEND_LEVEL - 1; s.tut = 99;
      rollover(s, now, rngFrom(1));
      if (repeat) s.weekly.loot.push(`${c.key}|${diff}`);
      const result = settle(s, run(c.key, diff, stageOf(c, diff)), () => 0.999999, [], now);
      expect(result.items[0].grade).not.toBe(LEGEND);
    }
  });

  it('전설 해금 안내도 첫 20인 레이드 입장 레벨', () => {
    const legend = '전설 장비 (노란색, 레이드 어려움 · 악몽)';
    expect(LEGEND_LEVEL).toBe(contentOf('cathedral1').unlockLv);
    expect(milestonesAt(LEGEND_LEVEL, 'priest').some(m => m.text === legend)).toBe(true);
    expect(milestonesAt(contentOf('abyss1').unlockLv, 'priest').some(m => m.text === legend)).toBe(false);
    expect(milestonesAt(100, 'priest').some(m => m.text === legend)).toBe(false);
  });
});

describe('10인 레이드 전설 (2026-10-22 Lim 「10인 레이드에서도 어려움, 악몽에서 확률은 20인 레이드 반으로」)', () => {
  it('10인 구역은 고유 장비 · 이름 있는 장신구 배치가 없어 보통 전설: 고유 능력 한 줄 (1.3~1.7배) + 특수능력, 아이템 레벨 = 그 레이드 레벨', () => {
    for (const c of CONTENT.filter(x => x.kind === 'raid' && raidSize(x) === 10)) expect(makeLegend(rngFrom(1), 1, { place: c.key }), c.key).toBeNull();
    let n = 0;
    for (let sd = 1; sd <= 40; sd++) {
      const seq = rngFrom(sd); let first = true;
      const r = () => { if (first) { first = false; return 0.99999; } return seq(); }; // 첫 굴림 = 등급: 맨 끝 (전설)
      const it = rollItem(r, '악몽', 'A', 100, sd, { place: 'abyss1', raid: 10, lv: stageOf(CONTENT.find(x => x.key === 'abyss1')!, '악몽'), hero: 'priest' });
      expect(it.grade).toBe(LEGEND);
      expect([it.unique, it.named]).toEqual([undefined, undefined]);
      expect(it.lv).toBe(60);
      const lg = (it.specs ?? []).filter(l => l.legend);
      expect(lg.length).toBe(1);
      expect(it.uniqueMult!).toBeGreaterThanOrEqual(1.3); expect(it.uniqueMult!).toBeLessThanOrEqual(1.7);
      expect((it.specs ?? []).length).toBeGreaterThanOrEqual(2);
      n++;
    }
    expect(n).toBe(40);
  });
});
