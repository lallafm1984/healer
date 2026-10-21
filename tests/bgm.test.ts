/** 배경음 (src/bgm): 화면마다 구간, 곡 파일 이름 · 크기 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bgmFor, setBattleRegion, setResultWin } from '../src/bgm';
import { ADVENTURE_REGIONS } from '../src/data/adventure-regions';

/** src/screens에서 만드는 화면 id (screen('s-…')) */
function screenIds(): string[] {
  const ids: string[] = [];
  for (const f of readdirSync('src/screens').filter(f => f.endsWith('.ts'))) {
    for (const m of readFileSync(join('src/screens', f), 'utf8').matchAll(/screen\('(s-[a-z-]+)'/g)) ids.push(m[1]);
  }
  return ids;
}

describe('배경음', () => {
  it('첫 장은 타이틀, 전투 · 구간 사이 휴식은 그 장소의 지역 곡, 결과는 승리 · 패배 곡, 그 밖 화면은 마을', () => {
    expect(bgmFor('s-title')).toBe('title');
    expect(bgmFor('s-story')).toBe('title');
    for (const r of ADVENTURE_REGIONS) {
      setBattleRegion(r.key);
      expect(bgmFor('battle')).toBe(r.key);
      expect(bgmFor('rest')).toBe(r.key);
    }
    for (const id of ['s-lobby', 's-char', 's-guild', 's-shop', 's-party', 's-settings']) expect(bgmFor(id), id).toBe('lobby');
    setResultWin(true); expect(bgmFor('s-settle')).toBe('victory');
    setResultWin(false); expect(bgmFor('s-settle')).toBe('defeat');
    const ids = screenIds();
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(['title', 'lobby', 'defeat'], id).toContain(bgmFor(id));
  });

  it('곡 파일은 <구간>-<번호>.ogg, 구간은 타이틀 · 로비 · 결과 · 지역, 번호는 1부터 빠짐없이, 한 곡 4 MB 밑 (폰 앱)', () => {
    const files = existsSync('src/bgm') ? readdirSync('src/bgm').filter(f => /\.(ogg|opus|mp3|m4a)$/.test(f)) : [];
    const by: Record<string, number[]> = {};
    for (const f of files) {
      const m = /^([a-z]+)-(\d+)\.ogg$/.exec(f);
      expect(m, f).not.toBeNull();
      expect(['title', 'lobby', 'victory', 'defeat', ...ADVENTURE_REGIONS.map(r => r.key)], f).toContain(m![1]);
      (by[m![1]] ??= []).push(Number(m![2]));
      expect(statSync(join('src/bgm', f)).size, f).toBeLessThan(4 * 1024 * 1024);
    }
    for (const [k, ns] of Object.entries(by)) expect(ns.sort((a, b) => a - b), k).toEqual(ns.map((_, i) => i + 1));
  });
});
