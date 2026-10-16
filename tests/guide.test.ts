// 모험 길잡이 · 난이도 레벨 열림 · 장소 레벨대 장비 등급 (86, 2026-10-16 Lim 「불친절함」 · 「등급에 맞지 않는 장비」)
import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_DIFFS, CONTENT, chainOpen, contentOf, isLeveling, RAID10_LV, stageOf } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { DROP_TABLES, dropTable, ITEM_GRADES, LEVELING_TIERS, lootTier, RECOMMENDED, type ItemGrade } from '../src/data/equipment';
import { presetGear } from './fixtures/preset-gear';
import { rampDiffs, rampFour, rampPlace, rampRefLevel, RAMP_LV } from '../src/data/progression';
import { gearGradeOdds } from '../src/data/reward-preview';
import { fitOf, guide, rankStages } from '../src/game/guide';
import { settle, type BattleResult } from '../src/game/settle';
import { G, lockOf } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { rngFrom } from '../src/engine';
import { rampLevel } from '../src/sim/ramp';
import { newSave } from '../src/platform/storage';

const rec = (...ds: DiffName[]) => Object.fromEntries(ds.map(d => [d, { stars: 1, grade: 'B', best: 1, n: 1 }]));
/** 등급 이상 확률 (누적, 높은 등급부터) */
const atLeast = (row: number[]) => row.map((_, i) => row.slice(i).reduce((a, p) => a + p, 0));

describe('난이도 열림 (86): 앞 난이도를 깼거나, 적 레벨이 내 레벨 이하', () => {
  it('레벨이 지난 장소는 쉬움을 안 깨도 악몽까지 열림, 내 레벨보다 높은 난이도만 사슬', () => {
    const fort = contentOf('rustfort'); // 적 Lv 5 · 7 · 9 · 11
    expect(chainOpen(fort, '악몽', undefined, 11)).toBe(true);
    expect(chainOpen(fort, '악몽', undefined, 10)).toBe(false);
    expect(chainOpen(fort, '악몽', rec('어려움'), 10)).toBe(true);
    expect(chainOpen(fort, '보통', undefined)).toBe(false); // 레벨을 안 주면 예전 사슬 그대로
    expect(chainOpen(contentOf('abyss1'), '악몽', undefined, 1)).toBe(true); // 레이드는 사슬 없음
  });
  it('게임 잠금 (lockOf)이 내 레벨을 씀', () => {
    G.save = newSave(1); G.save.settings.devUnlock = false; G.save.player.level = 11;
    expect(lockOf(contentOf('rustfort'), '악몽').locked).toBe(false);
    G.save.player.level = 10;
    expect(lockOf(contentOf('rustfort'), '악몽')).toMatchObject({ locked: true, need: '어려움' });
  });
});

describe('적합도 (fitOf)', () => {
  const c = contentOf('snowlab'); // 장소 Lv 30: 적 Lv 30 · 32 · 34 · 36
  it('적 레벨 − 내 레벨: −2 이하 여유 · −1 ~ +1 적정 (88) · +2 ~ +3 도전 · +4 이상 위험', () => {
    expect(fitOf(c, '쉬움', 32, 0)).toBe('여유');
    expect(fitOf(c, '쉬움', 31, 0)).toBe('적정');
    expect(fitOf(c, '쉬움', 29, 0)).toBe('적정');
    expect(fitOf(c, '쉬움', 28, 0)).toBe('도전');
    expect(fitOf(c, '보통', 28, 0)).toBe('위험');
  });
  // 권장 장비 점수 (91: 프리셋 장비 점수, 어려움 고급 · 악몽 희귀 × 1.4 = 예전 희귀 +5)
  const ADV = RECOMMENDED['어려움']!.score, RARE = RECOMMENDED['악몽']!.score;
  it('권장 장비 (어려움 고급 · 악몽 희귀, 프리셋 장비 점수)에 못 미치면 적어도 도전', () => {
    expect(fitOf(c, '어려움', 34, ADV)).toBe('적정');
    expect(fitOf(c, '어려움', 34, ADV - 0.1)).toBe('도전');
    expect(fitOf(c, '악몽', 39, 0)).toBe('도전'); // 여유 (−3)여도 장비가 없으면 도전
    // Lv 4 녹슨 고원: 쉬움 · 보통은 여유, 어려움 · 악몽만 적정 (예전엔 네 칸 모두 적정)
    expect((['쉬움', '보통', '어려움', '악몽'] as const).map(d => fitOf(contentOf('plateau'), d, 4, 0))).toEqual(['여유', '여유', '적정', '적정']);
    expect(fitOf(c, '악몽', 46, 0)).toBe('도전'); // −10
    expect(fitOf(c, '악몽', 58, RARE - 0.5)).toBe('도전'); // −22여도 장비가 모자라면 도전 (88: 예전엔 레벨이 많이 앞서면 적정)
    expect(fitOf(c, '악몽', 36, RARE)).toBe('적정');
  });
  it('레이드 (88): 적이 내 레벨이라 권장 장비를 채운 가장 어려운 난이도가 적정, 쉬운 쪽 여유 · 어려운 쪽 도전', () => {
    const r = contentOf('abyss1'), f = (g: number) => (['쉬움', '보통', '어려움', '악몽'] as const).map(d => fitOf(r, d, 60, g));
    expect(f(0)).toEqual(['여유', '적정', '도전', '도전']);
    expect(f(ADV)).toEqual(['여유', '여유', '적정', '도전']);
    expect(f(RARE)).toEqual(['여유', '여유', '여유', '적정']);
  });
  it('순차 구간 장소는 70 · 90의 길에서 그 난이도에 들어가는 레벨 기준 (어려움 · 악몽 = 밸런스 기준 플레이어와 같음), 장비 조건 없음', () => {
    for (const x of CONTENT.filter(y => rampPlace(y) && y.ready)) {
      for (const d of ['어려움', '악몽'] as const) expect(rampRefLevel(x, d), `${x.name} ${d}`).toBe(rampLevel(x, d));
      expect(rampRefLevel(x, '쉬움')).toBeLessThanOrEqual(rampRefLevel(x, '보통')!);
      // 장소 Lv 10~20: 네 난이도 모두 그 장소 레벨 ~ +1에 들어감 (한 곳 110%라 넘친 몫이 쌓여 뒤쪽 장소는 어려움 · 악몽 전에 한 레벨 오름)
      if (rampFour(x)) for (const d of ALL_DIFFS) expect(rampRefLevel(x, d)! - x.stageLv, `${x.name} ${d}`).toBeOneOf([0, 1]);
    }
    const plateau = contentOf('plateau'); // 어려움 적 Lv 5, 열리는 레벨 Lv 3
    expect(fitOf(plateau, '어려움', 3, 0)).toBe('적정');
    expect(rampRefLevel(contentOf('rustfort'), '보통')).toBe(5); // 적 Lv 7이지만 쉬움을 깬 Lv 5에 들어가는 칸
    expect(fitOf(contentOf('rustfort'), '보통', 5, 0)).toBe('적정');
    expect(rampRefLevel(contentOf('snowlab'), '보통')).toBeNull();
  });
});

describe('장소 레벨대 장비 등급 (86)', () => {
  it('레벨대: 장소 Lv 1~20 · 21~44 · 45~69 (10인이 열리는 레벨) · 70~ (20인이 열리는 레벨)', () => {
    expect([1, RAMP_LV, RAMP_LV + 1, RAID10_LV - 1, RAID10_LV, 69, 70, 100].map(lootTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(LEVELING_TIERS[0]).toBe(DROP_TABLES[0]);
    expect(dropTable('보통')).toBe(DROP_TABLES[0]['보통']);
    expect(dropTable('악몽', 20, 1)).toBe(DROP_TABLES[20]['악몽']); // 레이드는 장소 레벨과 상관없음
  });
  it('표마다 합 100% · 전설 없음 · 같은 난이도에서 어느 등급 이상 확률도 앞 등급대보다 줄지 않고 10인 레이드보다는 같거나 아래', () => {
    for (const d of ALL_DIFFS) {
      const rows = [...LEVELING_TIERS.map(t => t[d]), DROP_TABLES[10][d]];
      for (const [i, row] of rows.entries()) {
        expect(row.reduce((a, p) => a + p, 0)).toBeCloseTo(1, 9);
        if (i < LEVELING_TIERS.length) expect(row[ITEM_GRADES.indexOf('전설')]).toBe(0);
        if (i) atLeast(row).forEach((p, g) => expect(p, `${d} 등급대 ${i} ${ITEM_GRADES[g]} 이상`).toBeGreaterThanOrEqual(atLeast(rows[i - 1])[g] - 1e-9));
      }
    }
  });
  it('정산 드롭은 장소 레벨 표: 장소 Lv 44 악몽은 희귀만 (최소 희귀), 녹슨 고원 악몽은 고급 · 희귀 (최소 고급)', () => {
    const grades = (content: BattleResult['content']) => {
      const s = newSave(1); s.tut = TUT.done; s.player.level = 50; s.daily.pub = 3;
      const seen = new Set<ItemGrade>();
      for (let i = 0; i < 80; i++) seen.add(settle(s, { content, diff: '악몽', win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 60, restSec: 0, deaths: 2,
        healed: 1, overheal: 0, dispels: 0, dispellable: 0, endMana: 1, minMana: 1, auto: false, party: [], detail: [] }, rngFrom(i + 1)).items[0].grade);
      return seen;
    };
    expect([...grades('abyssedge')]).toEqual(['희귀']); // 둘째 레벨대 악몽 최소 희귀 (88 v0.2)
    expect([...grades('plateau')].sort()).toEqual(['고급', '희귀']);
  });
  it('출전 화면 확률 = 그 장소 등급대 표', () => {
    expect(gearGradeOdds('쉬움', 0, 30, 'B', false, contentOf('snowlab').stageLv)['고급']).toBeCloseTo(0.3, 9);
    expect(gearGradeOdds('쉬움', 0, 30, 'B', false, contentOf('plateau').stageLv)['일반']).toBeCloseTo(1, 9);
  });
});

describe('모험 길잡이 (guide)', () => {
  beforeEach(() => { G.save = newSave(1); G.save.settings.devUnlock = true; G.save.tut = TUT.done; });
  /** 프리셋 세기 장비 (91: 고급 × 1 · 희귀 × 1.4 = 예전 +0 · +5) */
  const wear = (grade: ItemGrade, mult: number) => { G.save.gear.equipped = presetGear(grade, mult, G.save.player.level); };

  it('개발 빌드 「레벨 잠금 무시」로 열린 곳은 추천하지 않음', () => {
    G.save.player.level = 5;
    G.save.clears.plateau = rec('쉬움', '보통'); G.save.clears.scrapheap = rec('쉬움', '보통');
    expect(guide()).toEqual({ content: 'rustfort', diff: '쉬움' });
  });

  it('장비에 따라 난이도: 없으면 보통 · 고급이면 어려움 · 희귀 (× 1.4, 예전 +5)면 악몽 (모두 적 레벨 = 내 레벨 근처)', () => {
    G.save.player.level = 40;
    const at = () => { const g = guide()!; return { d: g.diff, gap: stageOf(contentOf(g.content), g.diff) - 40 }; };
    expect(at().d).toBe('보통');
    wear('고급', 1);
    expect(at().d).toBe('어려움');
    wear('희귀', 1.4);
    expect(at()).toEqual({ d: '악몽', gap: 0 });
  });

  it('추천은 늘 적정 칸 (있으면), 탐험 · 던전만', () => {
    for (const lv of [2, 9, 15, 25, 33, 47, 60, 77, 90, 100]) {
      G.save.player.level = lv;
      const list = rankStages({ level: lv, gear: 0, clears: {}, open: (c, d) => !lockOf(c).dev && !lockOf(c).locked && !lockOf(c, d).locked && !lockOf(c, d).dev });
      expect(list.length, `Lv ${lv}`).toBeGreaterThan(0);
      const top = contentOf(list[0].content);
      expect(isLeveling(top)).toBe(true);
      expect(fitOf(top, list[0].diff, lv, 0), `Lv ${lv} ${top.name} ${list[0].diff}`).toBe('적정');
    }
  });

  it('튜토리얼 뒤 길잡이만 따라가면 Lv 20까지 70 · 90 순서 그대로 (다시 하기 없이, 장소 Lv 10부터 네 난이도, 56판에 Lv 21)', () => {
    G.save.player.level = 2; G.save.clears.plateau = rec('쉬움');
    G.save.player.xp = 202; // 녹슨 고원 쉬움 첫 클리어
    G.save.settings.devStamina = true; // 순서만 봄: 같은 시각에 35판이라 휴식 무제한 (휴식은 tests/stamina.test.ts, 90)
    let runs = 1, repeats = 0;
    while (G.save.player.level <= RAMP_LV && runs < 80) {
      const g = guide()!;
      if (G.save.clears[g.content]?.[g.diff]) repeats++;
      expect(rampDiffs(contentOf(g.content)), `${g.content} ${g.diff}`).toContain(g.diff);
      settle(G.save, { content: g.content, diff: g.diff, win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 60, restSec: 0, deaths: 1,
        healed: 1, overheal: 0, dispels: 0, dispellable: 0, endMana: 1, minMana: 1, auto: false, party: [], detail: [] }, rngFrom(runs));
      runs++;
    }
    expect(repeats).toBe(0);
    expect(runs).toBe(56); // 녹슨 고원 쉬움부터 두꺼비 왕국 수련궁 보통까지 (넘친 몫이 쌓여 수련궁 보통에서 Lv 21. 예전 쉬움 · 보통 길은 35판)
    expect(G.save.player.level).toBe(21);
  });
});
