/** 일괄 검사 (38 0-7): 모든 장소에 이름 · 지역 · 열림 레벨 · 드롭 목록, 같은 레벨에 같은 종류 두 곳 없음, 만든 장소는 네 난이도 모두 끝까지 돎 */
import { describe, expect, it } from 'vitest';
import { ALL_DIFFS, CONTENT, type ContentDef } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACE_KINDS } from '../src/data/equipment';
import { CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import { FEATURED } from '../src/data/specials';
import { runOnce } from '../src/sim/balance';

/** 종류: 탐험 · 던전 · 10인 · 20인 */
const kindOf = (c: ContentDef) => (c.kind === 'raid' ? `${c.size('보통')}인` : c.kind);
/** 한 레이드의 층 · 구역 (심연의 탑 1층 ~ 꼭대기)은 이름 앞부분이 같음 */
const groupOf = (c: ContentDef) => (c.kind === 'raid' ? c.name.replace(/ \S+$/, '') : c.key);
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
  it('같은 종류는 같은 레벨에 두 곳 없음 (한 레이드의 층 · 구역은 한 곳)', () => {
    const seen = new Map<string, string>();
    for (const c of shown) {
      const k = `${kindOf(c)} Lv ${c.unlockLv}`, g = groupOf(c);
      expect(seen.get(k) ?? g, `${c.key}와 ${seen.get(k)}`).toBe(g);
      seen.set(k, g);
    }
  });
});

describe('만든 장소', () => {
  it('자주 나오는 특수능력 3개, 탐험 · 던전은 장비 종류 표 (이름 있는 장신구는 20인 구역으로, 61 3-4)', () => {
    for (const c of made) {
      expect(FEATURED[c.key]?.length, c.key).toBe(3);
      if (c.kind === 'raid') continue;
      expect(PLACE_KINDS[c.key], c.key).toBeDefined();
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
  // 시간 초과는 「못 잡는 보스 (기믹 · 체력 오류)」만 잡음: 딜러가 대부분 살아 있는데 700초. 딜러가 거의 (3/4 넘게) 쓰러지고 탱커 · 힐러만 광폭화를 버티는 판 (보스는 거의 다 깎음)은
  // 난수 흐름 (성격 · 99 능력치 행동)에 따라 칸마다 나왔다 안 나왔다 해서 (예전엔 칸마다 피해 배율을 0.01씩 손봄) 빼고, 99 통합 점검에서 따로 봄
  // 못 잡는 보스는 시드와 상관없이 늘 시간 초과라, 시드 1이 딜러 여럿 살아 있는 채 시간을 넘기면 시드 2로 한 번 더 봄 (광폭화를 넘겨 버티다 늘어진 판은 시드마다 갈림,
  // 예: 99 방어 PR에서 포자 동굴 정원 뿌리방 악몽 시드 1이 광폭화 405초를 넘겨 버섯 화분이 보스를 채움 → 99 통합 점검 「지나치게 길어진 판」)
  const stuck = (r: ReturnType<typeof runOnce>) => r.reason === '시간 초과' && (r.dealersLeft ?? 1) / (r.dealers ?? 1) > 0.25;
  it.each(made.map(c => [c.name, c] as const))('%s: 네 난이도 모두 한 판이 시간 안에 끝남 (자동 힐러)', (_, c) => {
    for (const d of ALL_DIFFS) {
      const r = runOnce(c, d, 'priest', 1);
      if (!stuck(r)) continue;
      const r2 = runOnce(c, d, 'priest', 2);
      expect(stuck(r2), `${c.key} ${d} 시드 1 · 2 모두 시간 초과 · 딜러 ${r2.dealersLeft}/${r2.dealers} 살아 있음 (보스 체력 ${Math.round((r2.bossLeft ?? 1) * 100)}% 남음)`).toBe(false);
    }
  });
});
