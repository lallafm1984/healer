/** 배경음 (src/bgm): 화면마다 구간, 곡 파일 이름 · 크기 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bgmFor, playOrder, setBattleRegion, setResultWin, shuffled } from '../src/bgm';
import { ADVENTURE_REGIONS } from '../src/data/adventure-regions';
import { CONTENT } from '../src/data/content';

/** src/screens에서 만드는 화면 id (screen('s-…')) */
function screenIds(): string[] {
  const ids: string[] = [];
  for (const f of readdirSync('src/screens').filter(f => f.endsWith('.ts'))) {
    for (const m of readFileSync(join('src/screens', f), 'utf8').matchAll(/screen\('(s-[a-z-]+)'/g)) ids.push(m[1]);
  }
  return ids;
}

describe('배경음', () => {
  it('첫 장은 타이틀, 전투는 그 장소의 지역 곡 (구간 사이 쉬는 화면은 배경음 없이), 결과는 승리 · 패배 곡, 그 밖 화면은 마을', () => {
    expect(bgmFor('s-title')).toBe('title');
    expect(bgmFor('s-story')).toBe('title');
    for (const r of ADVENTURE_REGIONS) {
      setBattleRegion(r.key);
      expect(bgmFor('battle')).toBe(r.key);
      expect(bgmFor('rest')).toBeNull();
    }
    for (const id of ['s-lobby', 's-char', 's-guild', 's-shop', 's-party', 's-settings']) expect(bgmFor(id), id).toBe('lobby');
    setResultWin(true); expect(bgmFor('s-settle')).toBe('victory');
    setResultWin(false); expect(bgmFor('s-settle')).toBe('defeat');
    const ids = screenIds();
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(['title', 'lobby', 'defeat'], id).toContain(bgmFor(id));
  });

  it('장소 전용 곡 (place-<장소>-<n>.ogg)이 있는 장소 전투는 그 곡, 없으면 지역 곡', () => {
    setBattleRegion('rust', 'brasspress');
    expect(bgmFor('battle')).toBe('place-brasspress');
    setBattleRegion('rust', 'plateau');
    expect(bgmFor('battle')).toBe('rust');
  });

  it('곡 차례 (2026-10-28 Lim): 처음 한 바퀴는 섞은 차례로 모든 곡을 한 번씩, 그 뒤로는 같은 차례 그대로', () => {
    for (const n of [1, 2, 4, 7]) expect(shuffled(n).slice().sort((a, b) => a - b)).toEqual([...Array(n).keys()]);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(shuffled(4, rnd).join(''));
    expect(seen.size).toBeGreaterThan(10); // 여러 차례가 나옴 (늘 1-2-3-4가 아님)
    const first = playOrder('test-section', 4, rnd).slice();
    expect(playOrder('test-section', 4, rnd)).toEqual(first); // 다시 불러도 같은 차례
    expect(playOrder('test-section', 5, rnd)).toHaveLength(5); // 곡 수가 바뀌면 다시 섞음
  });

  it('곡 파일은 <구간>-<번호>.ogg, 구간은 타이틀 · 로비 · 결과 · 지역 · 장소 (place-<장소 key>), 번호는 1부터 빠짐없이, 한 곡 4 MB 밑 (폰 앱)', () => {
    const files = existsSync('src/bgm') ? readdirSync('src/bgm').filter(f => /\.(ogg|opus|mp3|m4a)$/.test(f)) : [];
    const by: Record<string, number[]> = {};
    for (const f of files) {
      const m = /^((?:place-)?[a-z0-9]+)-(\d+)\.ogg$/.exec(f);
      expect(m, f).not.toBeNull();
      expect(['title', 'lobby', 'victory', 'defeat', ...ADVENTURE_REGIONS.map(r => r.key), ...CONTENT.map(c => `place-${c.key}`)], f).toContain(m![1]);
      (by[m![1]] ??= []).push(Number(m![2]));
      expect(statSync(join('src/bgm', f)).size, f).toBeLessThan(4 * 1024 * 1024);
    }
    for (const [k, ns] of Object.entries(by)) expect(ns.sort((a, b) => a - b), k).toEqual(ns.map((_, i) => i + 1));
  });
});
