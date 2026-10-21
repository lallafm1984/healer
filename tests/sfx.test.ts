/** 효과음 목록 (107, scripts/sfx/sounds.mjs)과 코드가 부르는 소리 이름이 맞는지 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERO_KEYS } from '../src/data/heroes';
// @ts-expect-error 생성 스크립트의 목록 (mjs, 타입 없음)
import { SOUNDS } from '../scripts/sfx/sounds.mjs';
// @ts-expect-error 생성 스크립트의 목록
import { COMBAT_SOUNDS, EXTRA_SOUNDS } from '../scripts/sfx/combat.mjs';
import { FX_SOUND } from '../src/battle/combat-sound';
import { BOSS_SKILL_OWN, BOSS_SKILL_SOUND } from '../src/battle/boss-themes';
import { BOSSES } from '../src/data/bosses';
import { PRIEST_SKILL_SOUNDS, PRIEST_TALENT_SOUNDS, PRIEST_FEEDBACK_SOUNDS } from '../src/battle/priest-sound';

type Sound = { name: string; group: string; where: string; ko: string; prompt: string; gen: number; keep: number; loop?: boolean };
const list = [...SOUNDS, ...EXTRA_SOUNDS] as Sound[];
const names = new Set(list.map(s => s.name));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** 코드가 내는 소리 이름: sfx · Snd.play · hasSfx · sound 부름의 글자 (조건 ? 'a' : 'b' 둘 다), 디버프 · 장비 카드 · 메뉴 소리 표, 엔진 사건 · 보스 예고 소리, 직업 소리 (heal · renew · hymn → -<직업>) */
const PATS = [
  /(?:sfx|sfxLoop|Snd\.play|hasSfx|\.sound)\(\s*'([a-z-]+)'/g,
  /(?:sfx|Snd\.play)\([^;\n]*?\?\s*'([a-z-]+)'\s*:\s*'([a-z-]+)'/g,
  /\bgot\([^)\n]*'([a-z-]+)'\)/g,
  /'(loot(?:-[a-z]+)?|(?:debuff|ui|atk)-[a-z]+)'/g,
  /type: 'sound', name: '([a-z-]+)'/g,
  /type: 'sound', name: [^\n]*?\? '([a-z-]+)' : '([a-z-]+)'/g,
  /\bwarn: '([a-z-]+)'/g,
];
function used(): Set<string> {
  const out = new Set<string>();
  for (const f of files('src')) {
    const text = readFileSync(f, 'utf8');
    for (const re of PATS) for (const m of text.matchAll(re)) for (const g of m.slice(1)) if (g) out.add(g);
  }
  for (const base of ['heal', 'renew', 'hymn']) { out.delete(base); for (const h of HERO_KEYS) out.add(`${base}-${h}`); }
  for (const n of Object.values(FX_SOUND)) out.add(n);
  for (const n of [...Object.values(BOSS_SKILL_SOUND), ...Object.values(BOSS_SKILL_OWN)]) out.add(n);
  for (const mapping of [PRIEST_SKILL_SOUNDS, PRIEST_TALENT_SOUNDS, PRIEST_FEEDBACK_SOUNDS]) for (const n of Object.values(mapping)) out.add(n!);
  out.add('priest-relay-hop');
  const combat = readFileSync('src/battle/combat-sound.ts', 'utf8');
  for (const s of EXTRA_SOUNDS as Sound[]) if (combat.includes(`'${s.name}'`)) out.add(s.name);
  return out;
}

describe('효과음 목록 (107)', () => {
  it('사용자가 확정한 사제 음원 17종을 이전 후보로 되돌리지 않는다', () => {
    const approval = JSON.parse(readFileSync('scripts/sfx/priest-approved.json', 'utf8')) as {
      files: { name: string; file: string; sha256: string }[];
    };
    const specs = JSON.parse(readFileSync('scripts/sfx/priest-theme.json', 'utf8')) as { name: string }[];
    expect(approval.files).toHaveLength(17);
    expect(approval.files.map(f => f.name).sort()).toEqual(specs.map(s => s.name).sort());
    for (const file of approval.files) {
      expect(createHash('sha256').update(readFileSync(file.file)).digest('hex'), file.name).toBe(file.sha256);
    }
  });

  it('이름은 겹치지 않고 파일 이름으로 쓸 수 있음, 문장 · 길이가 있음', () => {
    expect(names.size).toBe(list.length);
    for (const s of list) {
      expect(s.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(s.prompt.length).toBeGreaterThan(40);
      expect(s.gen).toBeGreaterThanOrEqual(2);
      expect(s.keep).toBeGreaterThan(0);
      expect(s.keep).toBeLessThanOrEqual(s.gen);
      if (!s.loop) expect(s.keep, s.name).toBeLessThanOrEqual(1.5); // 반복 소리 (쉬는 화면)는 한 번 소리 상한 밖
    }
  });

  it('직업마다 직접 힐 · 지속 힐 · 큰 기술 소리', () => {
    for (const h of HERO_KEYS) for (const b of ['heal', 'renew', 'hymn']) expect(names.has(`${b}-${h}`), `${b}-${h}`).toBe(true);
  });

  it('모든 전투음에 실제 OGG 파일이 있어 합성 자리표시로 빠지지 않는다', () => {
    for (const sound of COMBAT_SOUNDS as Sound[]) {
      const data = readFileSync(join('src/sfx', `${sound.name}.ogg`));
      expect(data.subarray(0, 4).toString(), sound.name).toBe('OggS');
      expect(data.length, sound.name).toBeGreaterThan(200);
    }
  });

  it('예고가 있는 보스 기술마다 특성 착탄 소리가 있고, 방식 (강타 · 광역 · 장판)이 예고 종류와 맞는다', () => {
    const TAG: Record<string, string> = { buster: 'hit', aoe: 'wave', zone: 'ground' };
    const kinds = new Map<string, string>();
    for (const [script, def] of Object.entries(BOSSES)) for (const s of def.skills) if (s.kind && TAG[s.kind]) kinds.set(`${script}:${s.key}`, s.kind);
    expect([...kinds.keys()].filter(id => !BOSS_SKILL_SOUND[id])).toEqual([]);
    for (const [id, name] of Object.entries(BOSS_SKILL_SOUND)) expect(name, id).toMatch(new RegExp(`^boss-[a-z]+-${TAG[kinds.get(id) ?? ''] ?? '?'}$`));
  });

  it('코드가 부르는 소리는 모두 목록에 있고, 목록의 소리는 모두 어딘가에서 울림', () => {
    const u = used();
    expect([...u].filter(n => !names.has(n)).sort()).toEqual([]);
    expect([...names].filter(n => !u.has(n)).sort()).toEqual([]);
  });
});
