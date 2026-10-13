// 직업 아이콘 한 벌 (편성 칸·줄 · 전투 칸, 2026-10-13 Lim 「인게임에서도 동일하게, 인게임 디자인 모양으로」)
import { describe, expect, it } from 'vitest';
import { CLASSES, RECRUIT_CLASSES } from '../src/data/classes';
import { CLASS_GLYPH, classGlyphSvg, GLYPH_EDGE, GLYPH_INK } from '../src/screens/class-icons';

describe('직업 아이콘', () => {
  it('8직업 모두 그림이 있고 서로 다름', () => {
    expect(Object.keys(CLASS_GLYPH).sort()).toEqual(Object.keys(CLASSES).sort());
    const svgs = RECRUIT_CLASSES.map(classGlyphSvg);
    expect(new Set(svgs).size).toBe(8);
  });
  it('전투 칸과 같은 색: 크림색 몸 + 검은 테', () => {
    for (const k of RECRUIT_CLASSES) {
      const svg = classGlyphSvg(k);
      expect(svg).toContain(`fill="${GLYPH_INK}"`);
      expect(svg).toContain(`stroke="${GLYPH_EDGE}"`);
    }
  });
  it('호 (A) · 줄임 곡선 (S · T)은 안 씀: 전투판 (Pixi)이 돌린 호를 틀리게 옮김', () => {
    for (const parts of Object.values(CLASS_GLYPH)) for (const p of parts) for (const d of [p.fill, p.line, p.cut]) {
      if (d) expect(d).not.toMatch(/[AaSsTt]/);
    }
  });
});
