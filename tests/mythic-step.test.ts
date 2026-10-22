/** 기획 111 공통 ③ 악몽 변화: 악몽 차이가 없던 보스마다 기술 하나의 규칙 (옮겨붙음 · 광역 디버프 · 썩는 상처) */
import { describe, expect, it } from 'vitest';
import { BOSSES, mythicDef } from '../src/data/bosses';

describe('악몽 변화 (111 공통 ③)', () => {
  it('가리키는 기술이 있고, 악몽에서만 규칙이 바뀐다', () => {
    let n = 0;
    for (const [k, def] of Object.entries(BOSSES)) {
      const m = def.mythicStep;
      if (!m) continue;
      n++;
      const d = def.skills.find(s => s.key === m.skill);
      expect(d, k).toBeDefined();
      expect(mythicDef(d!, undefined), k).toBe(d);
      const after = mythicDef(d!, m).effect as { p: string; debuff?: { end?: { p: string }; healCut?: number } };
      if (m.kind === 'jump') expect(after.debuff?.end?.p, k).toBe('jump');
      if (m.kind === 'aoeDebuff') { expect(after.p, k).toBe('all'); expect(after.debuff, k).toBeDefined(); }
      if (m.kind === 'rot') { expect(after.p, k).toBe('tank'); expect(after.debuff?.healCut, k).toBeGreaterThan(0); }
    }
    expect(n).toBeGreaterThan(40);
  });
});
