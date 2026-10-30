import { describe, expect, it } from 'vitest';
import { ALL_DIFFS, contentOf } from '../src/data/content';
import { rngFrom } from '../src/engine';
import { clearGoldReward } from '../src/game/gold-reward';
import { settle, type BattleResult } from '../src/game/settle';
import { newSave } from '../src/platform/storage';
import { TUT } from '../src/game/tutorial';

const NOW = Date.UTC(2026, 9, 31, 0);
const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'snowpass', diff: '쉬움', win: true, quit: false, reason: '', segIdx: 1, segN: 2,
  time: 60, restSec: 0, deaths: 0, healed: 1000, overheal: 0, dispels: 0, dispellable: 0,
  endMana: 50, minMana: 20, auto: false, party: [], detail: [], ...o,
});

describe('표시한 기본 골드와 실제 정산', () => {
  it('눈보라 고개 쉬움은 평가와 무관하게 기본 33, 휴식 3은 43, 휴식 충분은 66', () => {
    for (const deaths of [0, 1, 2, 4]) for (const [rest, total] of [[0, 33], [3, 43], [10, 66]]) {
      const s = newSave(NOW); s.tut = TUT.done; s.player.level = 37; s.stamina.n = rest;
      const before = JSON.stringify(s), preview = clearGoldReward(s, contentOf('snowpass'), '쉬움');
      expect(preview.base).toBe(33);
      expect(JSON.stringify(s)).toBe(before);
      const x = settle(s, result({ deaths }), rngFrom(1), [], NOW);
      expect(x.gold).toBe(total);
      expect(x.gold - (x.restBonus?.gold ?? 0)).toBe(33);
      expect(s.player.gold).toBe(total);
      expect(x.items).toHaveLength(1);
    }
  });

  it('탐험·던전·10/20인 모든 난이도: 기본액 = 실제 수령액 − 별도 휴식 보너스, 모든 평가·부분 휴식·무제한', () => {
    for (const key of ['snowpass', 'rustfort', 'abyss1', 'cathedral1'] as const)
      for (const diff of ALL_DIFFS) for (const deaths of [0, 1, 2, 4]) for (const rest of [0, 3, 100, -1]) {
        const s = newSave(NOW); s.tut = TUT.done; s.player.level = 100;
        s.stamina.n = Math.max(0, rest); s.settings.devStamina = rest === -1;
        const base = clearGoldReward(s, contentOf(key), diff).base;
        const x = settle(s, result({ content: key, diff, deaths }), rngFrom(123), [], NOW);
        expect(x.gold - (x.restBonus?.gold ?? 0), `${key}/${diff}/${deaths}/${rest}`).toBe(base);
        expect(s.player.gold).toBe(x.gold);
        expect(x.items).toHaveLength(1);
      }
  });

  it('전멸·포기는 골드·장비 없음', () => {
    for (const o of [{ win: false }, { win: false, quit: true }]) {
      const s = newSave(NOW); s.tut = TUT.done;
      const x = settle(s, result(o), rngFrom(1), [], NOW);
      expect(x.gold).toBe(0); expect(x.items).toHaveLength(0);
    }
  });
});
