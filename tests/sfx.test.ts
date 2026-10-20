/** 효과음 목록 (107, scripts/sfx/sounds.mjs)과 코드가 부르는 소리 이름이 맞는지 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERO_KEYS } from '../src/data/heroes';
// @ts-expect-error 생성 스크립트의 목록 (mjs, 타입 없음)
import { SOUNDS } from '../scripts/sfx/sounds.mjs';

type Sound = { name: string; group: string; where: string; ko: string; prompt: string; gen: number; keep: number };
const list = SOUNDS as Sound[];
const names = new Set(list.map(s => s.name));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** 코드가 내는 소리 이름: sfx · Snd.play · hasSfx · sound 부름의 글자 (조건 ? 'a' : 'b' 둘 다), 디버프 · 장비 카드 · 메뉴 소리 표, 엔진 사건 · 보스 예고 소리, 직업 소리 (heal · renew · hymn → -<직업>) */
const PATS = [
  /(?:sfx|Snd\.play|hasSfx|\.sound)\(\s*'([a-z-]+)'/g,
  /(?:sfx|Snd\.play)\([^;\n]*?\?\s*'([a-z-]+)'\s*:\s*'([a-z-]+)'/g,
  /\bgot\([^)\n]*'([a-z-]+)'\)/g,
  /'(loot(?:-[a-z]+)?|(?:debuff|ui)-[a-z]+)'/g,
  /type: 'sound', name: '([a-z-]+)'/g,
  /\bwarn: '([a-z-]+)'/g,
];
function used(): Set<string> {
  const out = new Set<string>();
  for (const f of files('src')) {
    const text = readFileSync(f, 'utf8');
    for (const re of PATS) for (const m of text.matchAll(re)) for (const g of m.slice(1)) if (g) out.add(g);
  }
  for (const base of ['heal', 'renew', 'hymn']) { out.delete(base); for (const h of HERO_KEYS) out.add(`${base}-${h}`); }
  return out;
}

describe('효과음 목록 (107)', () => {
  it('이름은 겹치지 않고 파일 이름으로 쓸 수 있음, 문장 · 길이가 있음', () => {
    expect(names.size).toBe(list.length);
    for (const s of list) {
      expect(s.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(s.prompt.length).toBeGreaterThan(40);
      expect(s.gen).toBeGreaterThanOrEqual(2);
      expect(s.keep).toBeGreaterThan(0);
      expect(s.keep).toBeLessThanOrEqual(s.gen);
    }
  });

  it('직업마다 직접 힐 · 지속 힐 · 큰 기술 소리', () => {
    for (const h of HERO_KEYS) for (const b of ['heal', 'renew', 'hymn']) expect(names.has(`${b}-${h}`), `${b}-${h}`).toBe(true);
  });

  it('코드가 부르는 소리는 모두 목록에 있고, 목록의 소리는 모두 어딘가에서 울림', () => {
    const u = used();
    expect([...u].filter(n => !names.has(n)).sort()).toEqual([]);
    expect([...names].filter(n => !u.has(n)).sort()).toEqual([]);
  });
});
