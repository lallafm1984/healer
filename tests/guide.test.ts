// 모험 길잡이 · 난이도 레벨 열림 · 장소 레벨대 장비 등급 (86, 2026-10-16 Lim 「불친절함」 · 「등급에 맞지 않는 장비」)
import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_DIFFS, CONTENT, chainOpen, contentOf, isLeveling, RAID10_LV, stageOf, type ContentDef } from '../src/data/content';
import type { DiffName } from '../src/data/difficulty';
import { DROP_TABLES, dropTable, ITEM_GRADES, LEVELING_TIERS, lootTier, presetScore, RECOMMENDED, type ItemGrade } from '../src/data/equipment';
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

describe('난이도 열림: 장소마다 앞 난이도를 깨야 (2026-10-27 Lim 「각 스테이지별로 순차적으로」, 예전 86 「적 레벨이 내 레벨 이하면 사슬 없이」는 없앰)', () => {
  it('쉬움 → 보통 → 어려움 → 악몽 차례, 위 난이도를 깬 옛 기록은 그 아래가 다 열림, 레이드는 사슬 없음', () => {
    const fort = contentOf('rustfort'); // 적 Lv 5 · 7 · 9 · 11
    expect(chainOpen(fort, '쉬움', undefined)).toBe(true);
    expect(chainOpen(fort, '보통', undefined)).toBe(false);
    expect(chainOpen(fort, '보통', rec('쉬움'))).toBe(true);
    expect(chainOpen(fort, '어려움', rec('쉬움'))).toBe(false);
    expect(chainOpen(fort, '악몽', rec('어려움'))).toBe(true);
    expect(chainOpen(fort, '보통', rec('악몽'))).toBe(true); // 옛 저장에서 위를 깼으면 그대로 열림
    expect(chainOpen(contentOf('abyss1'), '악몽', undefined)).toBe(true); // 레이드는 사슬 없음
  });
  it('게임 잠금 (lockOf): 내 레벨이 높아도 앞 난이도를 깨야 열림', () => {
    G.save = newSave(1); G.save.settings.devUnlock = false; G.save.player.level = 100;
    expect(lockOf(contentOf('rustfort'), '쉬움').locked).toBe(false);
    expect(lockOf(contentOf('rustfort'), '보통')).toMatchObject({ locked: true, need: '쉬움' });
    expect(lockOf(contentOf('rustfort'), '악몽')).toMatchObject({ locked: true, need: '어려움' });
    G.save.clears.rustfort = rec('어려움') as never;
    expect(lockOf(contentOf('rustfort'), '악몽').locked).toBe(false);
    expect(lockOf(contentOf('brasspress'), '보통')).toMatchObject({ locked: true, need: '쉬움' }); // 보충 장소도 원본 기록과 상관없이 쉬움부터
  });
});

describe('적합도 (fitOf, 92: 난이도 + 레벨 + 장비)', () => {
  const c = contentOf('snowlab'); // 장소 Lv 30: 적 Lv 30 · 32 · 34 · 36
  // 권장 장비 점수 (91: 프리셋 장비 점수, 어려움 고급 · 악몽 희귀 × 1.4 = 예전 희귀 +5), 한 단계 위 = 영웅 × 1.4 + 특수능력 1줄
  const ADV = RECOMMENDED['어려움']!.score, RARE = RECOMMENDED['악몽']!.score, EPIC = presetScore('영웅', 1.4, 1);
  const four = (x: ContentDef, lv: number, g: number) => ALL_DIFFS.map(d => fitOf(x, d, lv, g));

  it('난이도 몫: 순차 구간 장소는 −2 · −1 · 0 · +2 (Lv 10~20 장소 악몽은 길이라 0), Lv 21~100 장소는 어려움도 +2 (#382 중간 등급 장비로 빠듯한 칸, 2026-10-22)', () => {
    expect(ALL_DIFFS.map(d => diffStep(c, d))).toEqual([-2, -1, 2, 2]);
    expect(ALL_DIFFS.map(d => diffStep(contentOf('rustfort'), d))).toEqual([-2, -1, 0, 2]); // 장소 Lv 1~9 악몽은 길이 아님
    expect(diffStep(contentOf('greenhouse'), '악몽')).toBe(0);
  });
  it('레벨 몫: 모자라면 2레벨마다 +1, 앞서면 레벨 힘이 12% 늘 때마다 −1 (Lv 20 넘으면 1~3레벨 앞서도 클리어율이 거의 같음)', () => {
    expect([30, 31, 32, 34, 36].map(r => lvStep(r, 30))).toEqual([0, 0, 1, 2, 3]);
    expect(lvStep(30, 34)).toBe(0); // 힘 +11%
    expect(lvStep(30, 35)).toBe(-1); // 힘 +14%
    expect(lvStep(2, 4)).toBe(-2); // 낮은 레벨은 한 레벨 차이도 큼 (+28%)
  });
  it('Lv 21~100 장소 (#382): 중간 등급 장비면 보통이 적정 · 어려움은 도전, 한 단계 위 (영웅)면 보통 여유, 어려움은 장비로 안 내려가고 레벨이 앞서야 적정, 악몽은 전설 + 2줄부터 적정', () => {
    const EPIC1 = presetScore('영웅', 1), LEGEND = presetScore('전설', 1, 2);
    expect(four(c, 34, ADV)).toEqual(['여유', '적정', '도전', '위험']); // ADV = 중간 등급 희귀 (권장), 악몽은 장비 미달 (+2)
    expect(four(c, 34, EPIC1)).toEqual(['여유', '여유', '도전', '도전']); // 한 단계 위 장비 (영웅 ×1은 악몽 권장 희귀 ×1.4를 넘어 도전)
    expect(four(c, 34, EPIC)).toEqual(['여유', '여유', '도전', '도전']); // 가상 사용자 QA: Lv 90대 어려움은 길 장비 (영웅 위)로도 38 ~ 63%
    expect(four(c, 34, LEGEND)).toEqual(['여유', '여유', '도전', '도전']); // 악몽 (적 Lv 36)은 내 Lv 34라 레벨 몫 +1
    expect(fitOf(c, '악몽', 36, LEGEND)).toBe('적정');
    expect(fitOf(c, '어려움', 39, ADV)).toBe('적정'); // 5레벨 앞서면 (힘 +14%) 적정 (권장 장비는 있어야)
    expect(fitOf(c, '악몽', 36, RARE)).toBe('도전');
    expect(fitOf(c, '악몽', 36, EPIC)).toBe('도전'); // 예전 적정 (#382 전 시뮬 영웅 92%)
    expect(fitOf(c, '악몽', 41, RARE)).toBe('적정'); // 힘 +12% 앞섬
    expect(fitOf(c, '어려움', 34, ADV - 0.1)).toBe('위험'); // 권장 장비 미달은 +2 더 (중간 등급 아래로 어려움은 위험)
    expect(fitOf(c, '악몽', 39, 0)).toBe('위험');
    expect(fitOf(c, '악몽', 58, RARE - 0.5)).toBe('도전'); // 레벨이 한참 앞서도 장비가 모자라면 도전 (88)
    expect(four(c, 28, 0)).toEqual(['적정', '적정', '위험', '위험']);
  });
  it('레이드도 던전처럼 레벨 몫 (2026-10-21 Lim: 적이 장소 레벨에 고정, 예전엔 내 레벨이라 장비 몫만)', () => {
    const r = contentOf('cathedral1'); // 쉬움 ~ 어려움 Lv 70 · 악몽 80
    // 그 레이드 레벨에서: 장비 없으면 어려움 위험, 중간 등급 장비면 도전 (#382)
    expect(four(r, 70, 0).slice(0, 3)).toEqual(['여유', '적정', '위험']);
    expect(four(r, 70, ADV).slice(0, 3)).toEqual(['여유', '적정', '도전']);
    expect([fitOf(r, '악몽', 80, RARE), fitOf(r, '악몽', 80, EPIC), fitOf(r, '악몽', 80, presetScore('전설', 1, 2))]).toEqual(['도전', '도전', '적정']);
    // 내가 높으면 쉬워짐 (힐러만 셈), 낮으면 (개발 잠금 해제) 어려워짐. 장비 미달은 그대로 적어도 도전
    expect(four(contentOf('abyss1'), 100, RARE)).toEqual(['여유', '여유', '여유', '여유']);
    expect(fitOf(r, '보통', 85, ADV)).toBe('여유');
    expect(fitOf(r, '어려움', 100, 0)).toBe('도전');
    expect(four(r, 60, ADV)).toEqual(['도전', '위험', '위험', '위험']);
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
      for (let i = 0; i < 80; i++) { const it = settle(s, { content, diff: '악몽', win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 60, restSec: 0, deaths: 2,
        healed: 1, overheal: 0, dispels: 0, dispellable: 0, endMana: 1, minMana: 1, auto: false, party: [], detail: [] }, rngFrom(i + 1)).items[0]; if (it) seen.add(it.grade); } // 탐험은 판마다 50% (103)
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

  it('출전 화면 꼬리표는 지금 레벨로 들어갈 수 있는 칸만 (2026-10-17 Lim 「지금 레벨로 진입 못하는 레이드의 난이도 버튼이 적정」)', () => {
    const raid = contentOf('abyss1'); // 10인 Lv 45, 악몽 Lv 60
    G.save.settings.devUnlock = false; G.save.player.level = 11;
    expect(ALL_DIFFS.map(d => fitShown(raid, d))).toEqual([null, null, null, null]);
    G.save.settings.devUnlock = true; // 개발 빌드로 들어갈 수 있어도 실제 레벨로는 못 들어감
    expect(ALL_DIFFS.map(d => fitShown(raid, d))).toEqual([null, null, null, null]);
    G.save.player.level = 45;
    expect(ALL_DIFFS.map(d => fitShown(raid, d))).toEqual(['여유', '적정', '위험', null]); // 장비 없음 (어려움은 중간 등급 미달 → 위험), 악몽은 Lv 60
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

  it('악몽은 장비와 상관없이 추천 안 함, 순차 구간 뒤는 안 깬 여유 · 적정 칸을 장소 레벨 순 · 쉬움 → 보통 → 어려움 (적 Lv < 내 Lv − 10 · 위험은 건너뜀), 다 깨면 적정 어려움 가운데 적 레벨 높은 곳 (2026-10-20 Lim), 안 깬 도전 칸은 그 뒤 (2026-10-22 가상 사용자 QA)', () => {
    const open = (c: ContentDef, d: DiffName) => !lockOf(c).locked && !lockOf(c, d).locked;
    G.save.player.level = 40;
    for (const gear of [0, presetScore('고급', 1), presetScore('희귀', 1.4), presetScore('영웅', 1.4, 1)]) {
      const list = rankStages({ level: 40, gear, clears: {}, open });
      expect(list.some(x => x.diff === '악몽'), `장비 ${gear}`).toBe(false);
      // 앞쪽 = 안 깬 칸 (적 Lv 30 이상 · 여유 · 적정)을 장소 레벨 순 · 쉬운 난이도부터 (같은 장소는 쉬움 → 보통 → 어려움)
      const fit = (x: { content: string; diff: DiffName }) => fitOf(contentOf(x.content as never), x.diff, 40, gear);
      const ok = (x: { content: string; diff: DiffName }) => stageOf(contentOf(x.content as never), x.diff) >= 30 && (fit(x) === '여유' || fit(x) === '적정');
      const cut = list.findIndex(x => !ok(x)), head = (cut < 0 ? list : list.slice(0, cut)).map(x => ({ lv: contentOf(x.content).stageLv, i: ALL_DIFFS.indexOf(x.diff) }));
      expect(head.length, `장비 ${gear}`).toBeGreaterThan(3);
      for (let i = 1; i < head.length; i++) expect(head[i].lv > head[i - 1].lv || (head[i].lv === head[i - 1].lv && head[i].i > head[i - 1].i), `${i}`).toBe(true);
      const want = CONTENT.filter(c => isLeveling(c) && !c.hidden && c.ready).flatMap(c => (['쉬움', '보통', '어려움'] as DiffName[]).filter(d => open(c, d) && ok({ content: c.key, diff: d })).map(() => c.stageLv));
      expect(head[0].lv).toBe(Math.min(...want));
      // 안 깬 도전 칸 (적 레벨이 4쯤 높은 어려움)은 여유 · 적정 칸을 다 지나고 나서야 (2레벨 오르면 적정이 되어 차례로)
      const lastOk = list.map(ok).lastIndexOf(true), firstHard = list.findIndex(x => fit(x) === '도전');
      expect(firstHard, `장비 ${gear}`).toBeGreaterThan(lastOk);
    }
    // 다 깬 뒤: 적정 어려움 (적 레벨 높은 곳)
    const gear = presetScore('희귀', 1.4), all: Record<string, Partial<Record<DiffName, unknown>>> = {};
    for (const c of CONTENT) if (isLeveling(c)) all[c.key] = rec('쉬움', '보통', '어려움', '악몽');
    G.save.player.level = 40; G.save.clears = all as never; // 난이도 사슬 잠금도 이 기록으로
    // 다 깬 뒤 반복은 보통 (여유 · 적정) 가운데 적 레벨 높은 곳 (2026-10-22 #382 기준: 어려움 반복은 장비가 좋아도 지는 판이 많음), 장비와 상관없이
    for (const g of [gear, presetScore('영웅', 1.4, 1)]) {
      const rep = rankStages({ level: 40, gear: g, clears: all, open });
      expect(rep[0].diff).toBe('보통');
      const norm = rep.filter(x => x.diff === '보통' && ['여유', '적정'].includes(fitOf(contentOf(x.content), '보통', 40, g))).map(x => stageOf(contentOf(x.content), '보통'));
      expect(norm[0]).toBe(Math.max(...norm));
      // 반복은 번갈아: 마지막으로 한 칸은 다른 보통 뒤로, 그 칸을 또 하면 원래 1순위로 돌아옴
      const rep2 = rankStages({ level: 40, gear: g, clears: all, open, last: rep[0] });
      expect(rep2[0]).not.toEqual(rep[0]);
      expect(rep2[0].diff).toBe('보통');
      expect(rankStages({ level: 40, gear: g, clears: all, open, last: rep2[0] })[0]).toEqual(rep[0]);
    }
    // 보통을 다 쓸 수 없을 때 (장소 하나뿐): 적정 어려움 (5레벨쯤 앞선 칸) 반복
    const one: Record<string, Partial<Record<DiffName, unknown>>> = { snowlab: rec('쉬움', '보통', '어려움', '악몽') };
    const rep1 = rankStages({ level: 40, gear, clears: one, open: (c, d) => c.key === 'snowlab' && open(c, d) });
    expect(rep1[0]).toEqual({ content: 'snowlab', diff: '보통' });
    expect(rep1.find(x => x.diff === '어려움')).toEqual({ content: 'snowlab', diff: '어려움' }); // 적 Lv 34, 내 Lv 40 → 적정
  });

  it('추천은 길 첫 클리어 (순차 구간, 들어가는 레벨이 내 레벨 ±1이면 쉬움 (여유)도) · 안 깬 칸 (위험 · 한참 아래 빼고) · 적정 칸, 악몽은 없음. 탐험 · 던전만', () => {
    for (const lv of [2, 9, 15, 25, 33, 47, 60, 77, 90, 100]) {
      G.save.player.level = lv;
      const list = rankStages({ level: lv, gear: 0, clears: {}, open: (c, d) => !lockOf(c).dev && !lockOf(c).locked && !lockOf(c, d).locked && !lockOf(c, d).dev });
      expect(list.length, `Lv ${lv}`).toBeGreaterThan(0);
      expect(list.some(x => x.diff === '악몽'), `Lv ${lv}`).toBe(false);
      const top = contentOf(list[0].content), d = list[0].diff, path = lv <= RAMP_LV && rampDiffs(top).includes(d) && Math.abs(rampRefLevel(top, d)! - lv) <= 1;
      const fresh = fitOf(top, d, lv, 0) !== '위험' && stageOf(top, d) >= lv - 10;
      expect(isLeveling(top)).toBe(true);
      expect(path || fresh || fitOf(top, d, lv, 0) === '적정', `Lv ${lv} ${top.name} ${d}`).toBe(true);
    }
  });

  it('튜토리얼 뒤 길잡이만 따라가면 Lv 21까지 늘 추천이 있음 (막히는 칸 없음, 휴식 판 = 예전의 2/3라 다시 하기가 끼어 88판. 보충 장소를 원본 난이도로 바로 들어가던 때 80판 · 길 밖 어려움을 추천하던 때 73판 · 악몽을 길에서 빼기 전 87판 · 예전 56판)', () => {
    G.save.player.level = 2; G.save.clears.plateau = rec('쉬움');
    G.save.player.xp = 202; // 녹슨 고원 쉬움 첫 클리어
    G.save.settings.devStamina = true; // 순서만 봄: 같은 시각에 여러 판이라 휴식 무제한 (휴식은 tests/stamina.test.ts, 90)
    let runs = 1, repeats = 0, supp = 0;
    while (G.save.player.level <= RAMP_LV && runs < 200) {
      const g = guide();
      expect(g, `Lv ${G.save.player.level} ${runs}판째 추천 없음`).not.toBeNull();
      expect(rampPlace(contentOf(g!.content)), `${g!.content} ${g!.diff}`).toBe(true);
      expect(rampDiffs(contentOf(g!.content)).includes(g!.diff), `${g!.content} ${g!.diff}: 길 밖 칸`).toBe(true); // 2026-10-22: Lv 20까지는 길 칸만 (장소 Lv 1~9 어려움은 처음 하는 사람이 11~19%만 깸)
      if (G.save.clears[g!.content]?.[g!.diff]) repeats++;
      else if (contentOf(g!.content).anchor) supp++; // 보충 장소 첫 방문 (113): 원본 다시 하기 자리
      const xp = settle(G.save, { content: g!.content, diff: g!.diff, win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 60, restSec: 0, deaths: 1,
        healed: 1, overheal: 0, dispels: 0, dispellable: 0, endMana: 1, minMana: 1, auto: false, party: [], detail: [] }, rngFrom(runs)).xp;
      expect(xp).toBeGreaterThan(0);
      runs++;
    }
    // 2026-10-17 Lim 「1레벨부터 골드와 함께 적용」: 첫 클리어 길만으로는 다음 장소 레벨에 모자라 깬 길 칸 다시 하기 (33판)가 낌
    // (2026-10-20 악몽은 추천 안 함, 2026-10-22 지나온 장소 어려움도 추천 안 함: 다시 하기 19 → 33판)
    // 2026-10-27 (113): 다시 하기 자리에 안 가 본 보충 장소 (같은 경험치)가 들어감. 판 수는 그대로, 32곳 가운데 31곳이 길에 (Lv 7 둘째는 휴식 · 등급이 모자랄 때),
    // Lv 5~20 다시 하기는 0판 (남은 2판은 Lv 4 고철 더미 언덕, 113 4-4 대입표와 같음)
    // 2026-10-27 Lim 「각 스테이지별로 순차적으로」: 보충 장소도 쉬움부터라 첫 방문은 쉬움 (경험치 = 원본 쉬움 다시 하기, 어려움 다시 하기의 약 70%).
    // 그만큼 모자라 원본 어려움 다시 하기 8판이 더 끼어 80 → 88판
    expect(G.save.player.level).toBe(21);
    expect(runs).toBe(88);
    expect(repeats).toBe(10);
    expect(supp).toBe(31);
  });
});

describe('공개모집 레벨 바탕 = 권장 레벨 (2026-10-27 Lim 「권장레벨에 맞춰」 → 1)', () => {
  it('순차 구간은 적 레벨보다 낮을 수 있고 (온실 악몽 적 Lv 16 · 권장 Lv 11), 그 밖은 적 레벨. 파티원 레벨 = 이것 ± 1', async () => {
    const { recruitParty } = await import('../src/engine/fight');
    const gh = contentOf('greenhouse');
    expect(stageOf(gh, '악몽')).toBe(16);
    expect(recLevel(gh, '악몽')).toBe(11);
    const p = recruitParty(gh.fights('악몽')[0], 7, { abilities: true, myLv: 11, stageLv: recLevel(gh, '악몽') });
    for (const m of p) expect(Math.abs((m.lv ?? 0) - 11)).toBeLessThanOrEqual(1);
    for (const c of CONTENT.filter(x => !isLeveling(x))) for (const d of ALL_DIFFS) expect(recLevel(c, d)).toBe(stageOf(c, d));
    const lower = CONTENT.flatMap(c => ALL_DIFFS.filter(d => recLevel(c, d) < stageOf(c, d)).map(d => ({ c, d })));
    expect(lower.length).toBeGreaterThan(40);
    for (const { c } of lower) expect(rampPlace(c)).toBe(true);
  });
});
