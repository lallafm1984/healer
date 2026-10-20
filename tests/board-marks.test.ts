import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEBUFF_EDGE, GIM_ICON, MARK_ART } from '../src/battle/board-marks';

// 2026-10-16 전투판 검수 (89): 도형 대신 그리는 칸 테두리 · 표식 그림이 모두 src/art에 있어야 함 (없으면 도형으로 되돌아감)
const has = (name: string) => existsSync(`src/art/${name}.webp`) || existsSync(`src/art/${name}.png`);

describe('전투판 칸 테두리 · 표식 그림', () => {
  it('미리 읽는 그림 · 디버프 종류 띠 · 기믹 그림 파일이 모두 있음', () => {
    const names = [...MARK_ART, ...Object.values(DEBUFF_EDGE), ...GIM_ICON.map(([, n]) => n), 'fx-swell-bubble', 'board-spore-puff', 'fx-melt-embers'];
    expect(names.filter(n => !has(n))).toEqual([]);
  });
  it('해제 종류 넷은 각자 다른 띠', () => {
    expect(Object.keys(DEBUFF_EDGE).sort()).toEqual(['독', '마법', '저주', '질병'].sort());
    expect(new Set(Object.values(DEBUFF_EDGE)).size).toBe(4);
  });
});
