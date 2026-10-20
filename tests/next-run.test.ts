// 결과 화면 「다음」 갈 곳: 탐험 · 던전은 모험 길잡이 (86) 추천 가운데 방금 깬 칸이 아닌 첫 곳 (Lv 20까지는 70 순서), 레이드는 다음 장소
import { beforeEach, describe, expect, it } from 'vitest';
import type { DiffName } from '../src/data/difficulty';
import type { ItemGrade } from '../src/data/equipment';
import { presetGear } from './fixtures/preset-gear';
import { guide } from '../src/game/guide';
import { nextRun } from '../src/game/next-run';
import { G } from '../src/game/state';
import { newSave } from '../src/platform/storage';

const clear = (key: string, ...ds: DiffName[]) => {
  const rec = (G.save.clears as Record<string, Partial<Record<DiffName, unknown>>>)[key] ??= {};
  for (const d of ds) rec[d] = { stars: 3, grade: 'S', best: 100, n: 1 };
};
/** 프리셋 세기 장비 (91: 희귀 × 1.4 = 예전 희귀 +5) */
const wear = (grade: ItemGrade, mult = 1.4) => { G.save.gear.equipped = presetGear(grade, mult, G.save.player.level); };

describe('결과 화면 다음 갈 곳', () => {
  beforeEach(() => { G.save = newSave(1); G.save.settings.devUnlock = false; });

  it('순차 구간: 쉬움을 처음 깨면 같은 장소 보통', () => {
    G.save.player.level = 2; clear('plateau', '쉬움');
    expect(nextRun('plateau', '쉬움')).toEqual({ content: 'plateau', diff: '보통' });
  });

  it('순차 구간: 보통까지 깨면 다음 장소 쉬움 (같은 판을 다시 깨도)', () => {
    G.save.player.level = 3; clear('plateau', '쉬움', '보통');
    expect(nextRun('plateau', '보통')).toEqual({ content: 'scrapheap', diff: '쉬움' });
    expect(nextRun('plateau', '쉬움')).toEqual({ content: 'scrapheap', diff: '쉬움' });
  });

  it('분류를 넘어 감: 고철 더미 언덕 (탐험) 보통 → 녹슨 요새 (던전) 쉬움', () => {
    G.save.player.level = 5; clear('plateau', '쉬움', '보통'); clear('scrapheap', '쉬움', '보통');
    expect(nextRun('scrapheap', '보통')).toEqual({ content: 'rustfort', diff: '쉬움' });
    G.save.player.level = 6; clear('rustfort', '쉬움');
    expect(nextRun('rustfort', '쉬움')).toEqual({ content: 'rustfort', diff: '보통' });
  });

  it('순차 구간 뒤: 장비가 좋아도 악몽은 추천 안 함 (2026-10-20 Lim), 방금 깬 칸이면 그다음 추천 · 악몽 판 뒤 「다음」도 악몽 아님', () => {
    G.save.player.level = 50; wear('희귀');
    const g = guide()!;
    expect(g.diff).not.toBe('악몽');
    const n = nextRun(g.content, g.diff)!;
    expect(n).not.toEqual(g);
    expect(n.diff).not.toBe('악몽');
    expect(nextRun(g.content, '악몽')?.diff).not.toBe('악몽');
  });

  it('레이드는 다음 장소를 지금 난이도로 (악몽 판 뒤면 어려움, 악몽은 「다음」으로 안 고름), 그 난이도가 잠겼으면 가장 낮은 열린 난이도', () => {
    G.save.player.level = 50;
    expect(nextRun('abyss1', '보통')).toEqual({ content: 'abyss2', diff: '보통' });
    expect(nextRun('abyss1', '악몽')).toEqual({ content: 'abyss2', diff: '어려움' });
  });
});
