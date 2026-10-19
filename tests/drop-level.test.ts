/** 장비 레벨 = 그 콘텐츠 레벨 (2026-10-19 Lim 「70레벨의 20인 레이드 클리어시 100레벨 영웅장비가 나왔다. 던전 레벨에 맞는 장비」) */
import { describe, expect, it } from 'vitest';
import { CONTENT, raidSize, stageOf } from '../src/data/content';
import { dropOdds, heroChance, LEGEND_CHANCE, legendChance, REPEAT_LEGEND } from '../src/data/equipment';
import { settle, type BattleResult } from '../src/game/settle';
import { newSave } from '../src/platform/storage';

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
  it('다시 깬 판 = 같은 레벨 던전 표 (영웅 확률 · 바탕 표), 20인 · Lv 100 어려움 · 악몽만 전설 1%', () => {
    for (const diff of ['보통', '어려움', '악몽'] as const) for (const raid of [10, 20] as const) {
      const again = dropOdds({ diff, raid, tierLv: 70, level: 70, repeat: true }), dungeon = dropOdds({ diff, raid: 0, tierLv: 70, level: 70 });
      expect(again, `${diff} ${raid}`).toEqual(dungeon);
      expect(heroChance({ diff, raid, tierLv: 70, level: 70, repeat: true })).toBe(heroChance({ diff, raid: 0, tierLv: 70, level: 70 }));
    }
    const legend = (diff: '보통' | '어려움' | '악몽', raid: 10 | 20, level: number, repeat: boolean) => legendChance({ diff, raid, tierLv: 100, level, grade: 'B', repeat });
    expect([legend('어려움', 20, 100, true), legend('악몽', 20, 100, true), legend('보통', 20, 100, true), legend('악몽', 10, 100, true), legend('악몽', 20, 99, true)]).toEqual([REPEAT_LEGEND['어려움'], REPEAT_LEGEND['악몽'], 0, 0, 0]);
    expect(REPEAT_LEGEND).toEqual({ '어려움': 0.01, '악몽': 0.01 });
    expect(legend('악몽', 20, 100, false)).toBe(LEGEND_CHANCE['악몽']); // 주 첫 클리어는 그대로
  });
});
