// 결과 화면 「다음」 갈 곳 (2026-10-13 Lim): 탐험 · 던전은 기획 70 순서 (쉬움 → 보통 → 다음 장소), 레이드는 다음 장소
import { beforeEach, describe, expect, it } from 'vitest';
import type { DiffName } from '../src/data/difficulty';
import { nextRun } from '../src/game/next-run';
import { G } from '../src/game/state';
import { newSave } from '../src/platform/storage';

const clear = (key: string, ...ds: DiffName[]) => {
  const rec = (G.save.clears as Record<string, Partial<Record<DiffName, unknown>>>)[key] ??= {};
  for (const d of ds) rec[d] = { stars: 3, grade: 'S', best: 100, n: 1 };
};

describe('결과 화면 다음 갈 곳', () => {
  beforeEach(() => { G.save = newSave(1); G.save.settings.devUnlock = false; });

  it('쉬움을 처음 깨면 같은 장소 보통', () => {
    G.save.player.level = 2; clear('plateau', '쉬움');
    expect(nextRun('plateau', '쉬움')).toEqual({ content: 'plateau', diff: '보통' });
  });

  it('보통까지 깨면 같은 분류 다음 장소의 쉬움 (레벨 순)', () => {
    G.save.player.level = 3; clear('plateau', '쉬움', '보통');
    expect(nextRun('plateau', '보통')).toEqual({ content: 'scrapheap', diff: '쉬움' });
    // 쉬움을 다시 깬 판에서도 보통을 이미 깼으면 다음 장소로
    expect(nextRun('plateau', '쉬움')).toEqual({ content: 'scrapheap', diff: '쉬움' });
  });

  it('다음 장소는 아직 안 깬 가장 낮은 열린 난이도, 다 깼으면 지금 난이도', () => {
    G.save.player.level = 20; clear('plateau', '쉬움', '보통'); clear('scrapheap', '쉬움');
    expect(nextRun('plateau', '보통')).toEqual({ content: 'scrapheap', diff: '보통' });
    clear('scrapheap', '보통', '어려움', '악몽');
    expect(nextRun('plateau', '어려움')).toEqual({ content: 'scrapheap', diff: '어려움' });
  });

  it('다음 장소가 레벨로 잠겼으면 같은 장소 다음 난이도, 그것도 없으면 없음', () => {
    G.save.player.level = 2; clear('plateau', '쉬움', '보통');
    expect(nextRun('plateau', '보통')).toEqual({ content: 'plateau', diff: '어려움' });
    clear('plateau', '어려움', '악몽');
    expect(nextRun('plateau', '악몽')).toBeNull();
  });

  it('던전도 같은 길 (녹슨 요새 → 녹슨 광산)', () => {
    G.save.player.level = 6; clear('rustfort', '쉬움');
    expect(nextRun('rustfort', '쉬움')).toEqual({ content: 'rustfort', diff: '보통' });
    clear('rustfort', '보통');
    expect(nextRun('rustfort', '보통')).toEqual({ content: 'mine', diff: '쉬움' });
  });

  it('레이드는 다음 장소를 지금 난이도로, 악몽이 레벨로 잠겼으면 가장 낮은 열린 난이도', () => {
    G.save.player.level = 50;
    expect(nextRun('abyss1', '보통')).toEqual({ content: 'abyss2', diff: '보통' });
    expect(nextRun('abyss1', '악몽')).toEqual({ content: 'abyss2', diff: '쉬움' });
  });
});
