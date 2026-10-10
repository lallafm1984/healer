/** 일괄 검사 (38 0-7): 모든 장소에 이름 · 지역 · 열림 레벨 · 드롭 목록, 같은 레벨에 같은 종류 두 곳 없음, 만든 장소는 네 난이도 모두 끝까지 돎 */
import { describe, expect, it } from 'vitest';
import { ALL_DIFFS, CONTENT, type ContentDef } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACE_KINDS } from '../src/data/equipment';
import { CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { runOnce } from '../src/sim/balance';

/** 종류: 탐험 · 던전 · 10인 · 20인 */
const kindOf = (c: ContentDef) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind);
const shown = CONTENT.filter(c => !c.hidden);
const made = shown.filter(c => c.ready);

describe('모든 장소', () => {
  it('이름 · 지역과 세력 · 열림 레벨 · 보스 이름 · 장소 그림 자리', () => {
    for (const c of shown) {
      expect(c.name, c.key).toBeTruthy();
      expect(c.place, c.key).toMatch(/ · /);
      expect(Number.isInteger(c.unlockLv) && c.unlockLv >= 1, c.key).toBe(true);
      expect(c.stageLv, c.key).toBe(c.unlockLv);
      expect(c.bosses.length, c.key).toBeGreaterThan(0);
      const p = PLACES[CONTENT_PLACE[c.key]];
      expect(p && FACTIONS[p.faction], c.key).toBeTruthy();
    }
  });
  it('같은 종류는 같은 레벨에 두 곳 없음', () => {
    const seen = new Map<string, string>();
    for (const c of shown) {
      const k = `${kindOf(c)} Lv ${c.unlockLv}`;
      expect(seen.get(k), `${c.key}와 ${seen.get(k)}`).toBeUndefined();
      seen.set(k, c.key);
    }
  });
});

describe('만든 장소', () => {
  it('자주 나오는 특수능력 3개, 탐험 · 던전은 장비 종류 표와 이름 있는 장신구', () => {
    for (const c of made) {
      expect(FEATURED[c.key]?.length, c.key).toBe(3);
      if (c.kind === 'raid') continue;
      expect(PLACE_KINDS[c.key], c.key).toBeDefined();
      expect(NAMED.some(n => n.place === c.key), c.key).toBe(true);
    }
  });
  it('네 난이도 모두 구간이 있고, 보스 이름이 구간에 나옴', () => {
    for (const c of made) {
      for (const d of ALL_DIFFS) {
        const segs = c.fights(d);
        expect(segs.length, `${c.key} ${d}`).toBeGreaterThan(0);
        for (const k of segs) expect(ENCOUNTERS[k], `${c.key} ${d} ${k}`).toBeDefined();
      }
      const names = c.fights('보통').map(k => ENCOUNTERS[k].name);
      for (const b of c.bosses) expect(names, `${c.key} ${b}`).toContain(b);
    }
  });
  it.each(made.map(c => [c.name, c] as const))('%s: 네 난이도 모두 한 판이 시간 안에 끝남 (자동 힐러)', (_, c) => {
    for (const d of ALL_DIFFS) {
      const r = runOnce(c, d, 'priest', 1);
      expect(r.reason, `${c.key} ${d}`).not.toBe('시간 초과');
    }
  });
});
