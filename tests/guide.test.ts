// 모험 길잡이 · 난이도 레벨 열림 · 장소 레벨대 장비 등급 (86, 2026-10-16 Lim 「불친절함」 · 「등급에 맞지 않는 장비」)
import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_DIFFS, CONTENT, chainOpen, contentOf, isLeveling, RAID10_LV, stageOf, type ContentDef } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { DROP_TABLES, dropTable, ITEM_GRADES, LEVELING_TIERS, lootTier, presetScore, RECOMMENDED, type ItemGrade } from '../src/data/equipment';
import { presetGear } from './fixtures/preset-gear';
import { rampDiffs, rampFour, rampPlace, rampRefLevel, RAMP_LV } from '../src/data/progression';
import { gearGradeOdds } from '../src/data/reward-preview';
import { diffStep, fitOf, fitShown, guide, lvStep, rankStages, recLevel } from '../src/game/guide';
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

describe('적합도 (fitOf, 92: 난이도 + 레벨 + 장비)', () => {
  const c = contentOf('snowlab'); // 장소 Lv 30: 적 Lv 30 · 32 · 34 · 36
  // 권장 장비 점수 (91: 프리셋 장비 점수, 어려움 고급 · 악몽 희귀 × 1.4 = 예전 희귀 +5), 한 단계 위 = 영웅 × 1.4 + 특수능력 1줄
  const ADV = RECOMMENDED['어려움']!.score, RARE = RECOMMENDED['악몽']!.score, EPIC = presetScore('영웅', 1.4, 1);
  const four = (x: ContentDef, lv: number, g: number) => ALL_DIFFS.map(d => fitOf(x, d, lv, g));

  it('난이도 몫: 클리어율 목표 (쉬움 99 · 보통 97 · 어려움 85 · 악몽 75%)대로 −2 · −1 · 0 · +2, 순차 구간 Lv 10~20 장소 악몽은 길이라 0', () => {
    expect(ALL_DIFFS.map(d => diffStep(c, d))).toEqual([-2, -1, 0, 2]);
    expect(diffStep(contentOf('greenhouse'), '악몽')).toBe(0);
    expect(diffStep(contentOf('rustfort'), '악몽')).toBe(2); // 장소 Lv 1~9 악몽은 길이 아님
  });
  it('레벨 몫: 모자라면 2레벨마다 +1, 앞서면 레벨 힘이 12% 늘 때마다 −1 (Lv 20 넘으면 1~3레벨 앞서도 클리어율이 거의 같음)', () => {
    expect([30, 31, 32, 34, 36].map(r => lvStep(r, 30))).toEqual([0, 0, 1, 2, 3]);
    expect(lvStep(30, 34)).toBe(0); // 힘 +11%
    expect(lvStep(30, 35)).toBe(-1); // 힘 +14%
    expect(lvStep(2, 4)).toBe(-2); // 낮은 레벨은 한 레벨 차이도 큼 (+28%)
  });
  it('어려움 · 권장 장비면 내 레벨 칸이 적정, 악몽은 권장 장비여도 도전 (예전엔 적정이라 75% 칸을 추천)', () => {
    expect(four(c, 34, ADV)).toEqual(['여유', '여유', '적정', '위험']); // 악몽은 장비 미달 (+2)
    expect(fitOf(c, '악몽', 36, RARE)).toBe('도전');
    expect(fitOf(c, '악몽', 36, EPIC)).toBe('적정'); // 한 단계 위 장비 (시뮬 영웅 92%)
    expect(fitOf(c, '악몽', 41, RARE)).toBe('적정'); // 힘 +12% 앞섬
    expect(fitOf(c, '어려움', 34, ADV - 0.1)).toBe('도전'); // 권장 장비 미달은 적어도 도전
    expect(fitOf(c, '악몽', 39, 0)).toBe('위험');
    expect(fitOf(c, '악몽', 58, RARE - 0.5)).toBe('도전'); // 레벨이 한참 앞서도 장비가 모자라면 도전 (88)
    expect(four(c, 28, 0)).toEqual(['적정', '적정', '위험', '위험']);
  });
  it('레이드: 적이 내 레벨이라 레벨 몫 없음, 장비 몫만', () => {
    const r = contentOf('abyss1');
    expect(four(r, 60, 0)).toEqual(['여유', '적정', '도전', '위험']);
    expect(four(r, 60, ADV)).toEqual(['여유', '여유', '적정', '위험']);
    expect(four(r, 60, RARE)).toEqual(['여유', '여유', '적정', '도전']);
    expect(four(r, 60, EPIC)).toEqual(['여유', '여유', '적정', '적정']);
  });
  it('순차 구간 장소는 70 · 90의 길에서 그 난이도에 들어가는 레벨 기준 (어려움 · 악몽 = 밸런스 기준 플레이어와 같음), 장비 몫 없음', () => {
    for (const x of CONTENT.filter(y => rampPlace(y) && y.ready)) {
      for (const d of ['어려움', '악몽'] as const) expect(rampRefLevel(x, d), `${x.name} ${d}`).toBe(rampLevel(x, d));
      expect(rampRefLevel(x, '쉬움')).toBeLessThanOrEqual(rampRefLevel(x, '보통')!);
      // 장소 Lv 10~20: 네 난이도 모두 그 장소 레벨 ~ +1에 들어감 (한 곳 110%라 넘친 몫이 쌓여 뒤쪽 장소는 어려움 · 악몽 전에 한 레벨 오름)
      if (rampFour(x)) for (const d of ALL_DIFFS) expect(rampRefLevel(x, d)! - x.stageLv, `${x.name} ${d}`).toBeOneOf([0, 1]);
    }
    expect(four(contentOf('plateau'), 4, 0)).toEqual(['여유', '여유', '적정', '적정']);
    expect(four(contentOf('rustfort'), 5, 0)).toEqual(['여유', '적정', '적정', '도전']);
    expect(rampRefLevel(contentOf('rustfort'), '보통')).toBe(5); // 적 Lv 7이지만 쉬움을 깬 Lv 5에 들어가는 칸
    expect(rampRefLevel(contentOf('snowlab'), '보통')).toBeNull();
  });
  it('2026-10-17 Lim 「내 레벨이 11인데 권장레벨 16이 추천」: 역병 약초 온실 악몽은 적 Lv 16이지만 길에서 Lv 11에 들어가는 칸 → 권장 레벨 11 · 적정', () => {
    const g = contentOf('greenhouse');
    expect(stageOf(g, '악몽')).toBe(16);
    expect(recLevel(g, '악몽')).toBe(11);
    expect(four(g, 11, 0)).toEqual(['여유', '적정', '적정', '적정']);
    expect(recLevel(c, '악몽')).toBe(36); // 그 밖 장소는 적 레벨
    expect(recLevel(contentOf('abyss1'), '보통')).toBe(stageOf(contentOf('abyss1'), '보통'));
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

  it('출전 화면 꼬리표는 지금 레벨로 들어갈 수 있는 칸만 (2026-10-17 Lim 「지금 레벨로 진입 못하는 레이드의 난이도 버튼이 적정」)', () => {
    const raid = contentOf('abyss1'); // 10인 Lv 45, 악몽 Lv 60
    G.save.settings.devUnlock = false; G.save.player.level = 11;
    expect(ALL_DIFFS.map(d => fitShown(raid, d))).toEqual([null, null, null, null]);
    G.save.settings.devUnlock = true; // 개발 빌드로 들어갈 수 있어도 실제 레벨로는 못 들어감
    expect(ALL_DIFFS.map(d => fitShown(raid, d))).toEqual([null, null, null, null]);
    G.save.player.level = 45;
    expect(ALL_DIFFS.map(d => fitShown(raid, d))).toEqual(['여유', '적정', '도전', null]); // 장비 없음, 악몽은 Lv 60
    G.save.player.level = 60;
    expect(fitShown(raid, '악몽')).toBe('위험');
    // 탐험 · 던전: 앞 난이도를 못 깬 칸 · 레벨이 모자란 장소도 없음
    G.save.player.level = 11;
    expect(ALL_DIFFS.map(d => fitShown(contentOf('greenhouse'), d))).toEqual(['여유', null, null, null]); // 적 Lv 12 · 14 · 16 > 11, 앞 난이도를 안 깸
    expect(fitShown(contentOf('snowlab'), '쉬움')).toBeNull(); // 장소 Lv 30
  });

  it('개발 빌드 「레벨 잠금 무시」로 열린 곳은 추천하지 않음', () => {
    G.save.player.level = 5;
    G.save.clears.plateau = rec('쉬움', '보통'); G.save.clears.scrapheap = rec('쉬움', '보통');
    expect(guide()).toEqual({ content: 'rustfort', diff: '쉬움' });
  });

  it('장비에 따라 난이도 (92): 없으면 보통 · 고급이면 어려움 · 희귀면 악몽을 레벨이 앞선 곳에서 · 영웅이면 내 레벨 악몽', () => {
    G.save.player.level = 40;
    const at = () => { const g = guide()!; return { d: g.diff, gap: stageOf(contentOf(g.content), g.diff) - 40 }; };
    expect(at().d).toBe('보통');
    wear('고급', 1);
    expect(at()).toEqual({ d: '어려움', gap: 0 });
    wear('희귀', 1.4);
    expect(at().d).toBe('악몽');
    expect(at().gap).toBeLessThanOrEqual(-5); // 레벨 힘 +12% 앞서야 적정 (내 레벨 악몽은 도전, 클리어율 목표 75%)
    // 영웅 × 1.4 + 특수능력 1줄 세기 (한 단계 위 장비)
    const top = rankStages({ level: 40, gear: presetScore('영웅', 1.4, 1), clears: {}, open: (c, d) => !lockOf(c).locked && !lockOf(c, d).locked })[0];
    expect({ d: top.diff, gap: stageOf(contentOf(top.content), top.diff) - 40 }).toEqual({ d: '악몽', gap: 0 });
  });

  it('추천은 적정 칸 (있으면), 순차 구간의 길 첫 클리어는 들어가는 레벨이 내 레벨 ±1이면 쉬움 (여유)도. 탐험 · 던전만', () => {
    for (const lv of [2, 9, 15, 25, 33, 47, 60, 77, 90, 100]) {
      G.save.player.level = lv;
      const list = rankStages({ level: lv, gear: 0, clears: {}, open: (c, d) => !lockOf(c).dev && !lockOf(c).locked && !lockOf(c, d).locked && !lockOf(c, d).dev });
      expect(list.length, `Lv ${lv}`).toBeGreaterThan(0);
      const top = contentOf(list[0].content), d = list[0].diff, path = lv <= RAMP_LV && rampDiffs(top).includes(d) && Math.abs(rampRefLevel(top, d)! - lv) <= 1;
      expect(isLeveling(top)).toBe(true);
      expect(path || fitOf(top, d, lv, 0) === '적정', `Lv ${lv} ${top.name} ${d}`).toBe(true);
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
