/** 전투 이펙트 프레임 띠 (battle/pxf.ts): 손그림풍 (scripts/vfx → fx-skill-*), 보스 판 전체 공격 (Codex fx-wide-*). PXF 도트는 없음 (Lim 2026-10-16 「도트를 모두 제거」) */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_KEYS, HEROES } from '../src/data/heroes';
import type { SkillKey } from '../src/data/skills';
import { ALLY_PXF, ALWAYS_FX, BEACON_RING, BOSS_PXF, bossPxfOf, COMMON_PXF, HERO_LOOP_FX, heroSkillFx, isBossPxf, loopFrame, PXF, pxfArtName, SKILL_FX_SIZE, pxfCell, pxfCrop, pxfDrawSize, pxfFrame, pxfMs, pxfTargets, SKILL_PXF, TOTEM_STAND, WIDE_DESIGN, wideArtName, type CommonFx, type PxfKey, HERO_TALENT_FX } from '../src/battle/pxf';
import { ENCOUNTERS } from '../src/data/encounters';
import { AB_KIND, type AbKind } from '../src/data/abilities';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
// @ts-expect-error 빌드 도구 스크립트 (.mjs, 타입 없음)
import { FX, FX_SIZE } from '../scripts/vfx/index.mjs';
// @ts-expect-error 빌드 도구 스크립트 (.mjs, 타입 없음)
import { TOTEM as SHAMAN_TOTEM } from '../scripts/vfx/shaman.mjs';
// @ts-expect-error 빌드 도구 스크립트 (.mjs, 타입 없음)
import { RING as PALADIN_RING } from '../scripts/vfx/paladin.mjs';

/** src/art 그림 파일의 가로 · 세로 (PNG · WebP 머리), 없으면 null */
const artSize = (name: string): { w: number; h: number } | null => {
  for (const ext of ['webp', 'png']) {
    const f = new URL(`../src/art/${name}.${ext}`, import.meta.url);
    if (!existsSync(f)) continue;
    const b = readFileSync(f);
    if (ext === 'png') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
};
const KEYS = Object.keys(PXF) as PxfKey[];
/** 손그림풍 (scripts/vfx), 보스 판 전체 공격 (Codex fx-wide) */
const SMOOTH_KEYS = KEYS.filter(k => !isBossPxf(k)), BOSS_KEYS = KEYS.filter(isBossPxf);
/** 아직 이펙트를 안 넣은 휠 스킬 (없음) */
const LATER = new Set<SkillKey>([]);

describe('도트 이펙트 없음 (Lim 2026-10-16 「도트를 모두 제거」)', () => {
  it('PXF 그래프 · 도트 띠 · 조각이 하나도 없음 (src/art/pxf에는 모양 표 requests.md만)', () => {
    expect(readdirSync(new URL('../src/art/pxf/', import.meta.url))).toEqual(['requests.md']);
    expect(readdirSync(new URL('../src/art/', import.meta.url)).filter(f => f.startsWith('fx-pxf-'))).toEqual([]);
  });
});

describe('손그림풍 스킬 이펙트 (Lim 2026-10-16 「스킬이펙트가 너무 허술한게 많다. 퀄리티 있게 모두 다시」)', () => {
  type Fx = { frames: number; logical: number; scope: string; size?: number; gray?: boolean; loop?: boolean; fps?: number };
  const fx = FX as Record<string, Fx>;
  it('scripts/vfx의 이펙트 = 게임의 손그림풍 이펙트 (224px, 공통 효과는 192px)', () => {
    expect(Object.keys(fx).sort()).toEqual([...SMOOTH_KEYS].sort());
    expect(FX_SIZE).toBe(SKILL_FX_SIZE);
  });
  for (const k of SMOOTH_KEYS) {
    it(`${k}: 장 수 · 그림 지름 · 재생 칸이 그리기 코드와 같고, 격자 띠가 있음`, () => {
      const c = PXF[k], f = fx[k];
      expect({ frames: c.frames, logical: c.logicalSize, size: c.size, cols: c.cols, impact: c.impactFrame, blend: c.blend, gray: c.gray, fps: c.fps })
        .toEqual({ frames: f.frames, logical: f.logical, size: f.size ?? FX_SIZE, cols: Math.ceil(Math.sqrt(f.frames)), impact: 0, blend: 'normal', gray: !!f.gray, fps: f.fps ?? 24 });
      expect(pxfArtName(k)).toBe(`fx-skill-${k}`);
      expect(artSize(pxfArtName(k))).toEqual({ w: c.size * c.cols, h: c.size * Math.ceil(c.frames / c.cols) });
      expect(c.size * c.cols).toBeLessThanOrEqual(2048); // 폰 텍스처 한도 안
      const uses = Object.values(SKILL_PXF).filter(s => s!.fx === k);
      const talentFx = Object.values(HERO_TALENT_FX).includes(k);
      expect(uses.length).toBe(ALWAYS_FX.has(k) || f.loop || talentFx ? 0 : 1); // 판 위 물건 루프 · 특성 버튼 발동 (talent 사건)은 스킬 기록이 아님
      if (uses.length) expect(uses[0]!.scope).toBe(f.scope);
    });
  }
  it('들어간 순간부터 그림 · 칸보다 크게 (범위 · 파티 스킬은 칸만 하게)', () => {
    const c = PXF['priest-heal'];
    expect(pxfFrame(c, 0)).toBe(0);
    expect(pxfFrame(c, pxfMs(c))).toBe(-1);
    expect(pxfDrawSize(c, 62)).toBe(80);
    for (const k of SMOOTH_KEYS) expect(PXF[k].logicalSize, k).toBeLessThanOrEqual(fx[k].scope === 'target' ? 100 : 84);
  });
  it('판 위 루프 (주술사 토템 · 성기사 봉화 대상 Lim 2026-10-18 · 직업마다 지속 그림 2026-10-19): 그 직업 전투에서만 읽고, 토템 그림 크기가 그리기 코드와 같고, 프레임이 이어 돎', () => {
    const loops = Object.keys(fx).filter(k => fx[k].loop);
    expect(loops.sort()).toEqual([
      'astro-nova-loop', 'astro-sleep-loop', 'druid-moss-loop', 'monk-mist-loop', 'monk-pool-loop', 'paladin-beacon-loop', 'paladin-sanctuary-loop',
      'priest-shelter-loop', 'shaman-earth-loop', 'shaman-rain-loop', 'shaman-sea-loop', 'shaman-spring-loop', 'warder-citadel-loop',
    ]); // 판 위 지속 그림 루프 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」)
    expect(Object.values(HERO_LOOP_FX).flat().sort()).toEqual(loops.sort());
    for (const h of HERO_KEYS) for (const k of HERO_LOOP_FX[h] ?? []) expect(heroSkillFx(h)).toContain(k);
    for (const h of HERO_KEYS) expect(heroSkillFx(h).filter(k => loops.includes(k) && !(HERO_LOOP_FX[h] ?? []).includes(k))).toEqual([]);
    expect(SHAMAN_TOTEM).toBe(TOTEM_STAND);
    expect(PALADIN_RING).toBe(BEACON_RING); // 봉화 대상 고리 루프 (2026-10-18 Lim): 고리 반지름이 board.ts와 같음
    const c = PXF['shaman-spring-loop'];
    expect([loopFrame(c, 0), loopFrame(c, (c.frames - 0.5) / c.fps), loopFrame(c, c.frames / c.fps), loopFrame(c, -0.01)]).toEqual([0, c.frames - 1, 0, c.frames - 1]);
  });
  it('전투마다 지금 직업 것만 읽음 (하나에 2–5MB)', () => {
    expect(heroSkillFx('priest').sort()).toEqual(['priest-flash', 'priest-guardian', 'priest-heal', 'priest-hymn', 'priest-poh', 'priest-purify', 'priest-relay', 'priest-renew', 'priest-serenity', 'priest-shelter-loop', 'priest-talent']);
    expect(heroSkillFx('druid')).toHaveLength(10); // 스킬 8 + 이끼 자리 루프 + 특성 버튼 발동
    for (const k of heroSkillFx('monk')) expect(k.startsWith('monk-')).toBe(true);
    // 전투 공통 효과 · 파티원 능력은 직업과 상관없이 늘 읽어 둠
    expect([...ALWAYS_FX].sort()).toEqual([...Object.values(COMMON_PXF), ...Object.values(ALLY_PXF)].sort());
    for (const h of HERO_KEYS) expect(heroSkillFx(h).filter(k => ALWAYS_FX.has(k))).toEqual([]);
    // art:optimize가 줄이지 않음 (fx- 규칙 256보다 먼저)
    expect(readFileSync(new URL('../scripts/art-optimize.mjs', import.meta.url), 'utf8')).toMatch(/re: \/\^fx-skill-\/, w: 2048, h: 2048/);
  });
});

describe('직업별 휠 스킬', () => {
  // 켠 직업마다 (79 직업은 직업 PR에서 켤 때 휠 8개 + 가운데 스킬 이펙트를 같이 넣음)
  for (const hero of HERO_KEYS.map(h => HEROES[h])) {
    it(`${hero.name}: 휠 스킬 · 가운데 스킬마다 PXF 이펙트`, () => {
      const missing = [...Object.values(hero.slots), hero.core].filter((k): k is SkillKey => !!k && !LATER.has(k) && !SKILL_PXF[k]);
      expect(missing).toEqual([]);
    });
  }
  it('스킬마다 다른 이펙트', () => {
    const fx = Object.values(SKILL_PXF).map(s => s!.fx);
    expect(new Set(fx).size).toBe(fx.length);
  });
});

describe('모양 표 (Lim 2026-10-11 「스킬별로 이펙트가 달라야 하는데 중복되는 게 있다」)', () => {
  /** requests.md 「모양 표」: | 이름 | 모양 | 이름 | 모양 | 두 쌍씩 */
  const table = () => {
    const md = readFileSync(new URL('../src/art/pxf/requests.md', import.meta.url), 'utf8');
    const sec = md.split('## 모양 표')[1]?.split('\n## ')[0] ?? '';
    const rows = sec.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| 이름') && !l.startsWith('|---'));
    return rows.flatMap(l => {
      const c = l.split('|').slice(1, -1).map(x => x.trim());
      return [[c[0], c[1]], [c[2], c[3]]].filter(([n]) => n).map(([n, m]) => ({ name: n.split(' ')[0], shape: m }));
    });
  };
  it('PXF 이펙트마다 한 줄씩, 모양은 모두 다름 (새 이펙트는 표에 없는 모양으로)', () => {
    const t = table();
    expect(t.map(x => x.name).sort()).toEqual([...KEYS].sort());
    const shapes = t.map(x => x.shape.replace(/ \(.*\)$/, ''));
    expect(shapes.filter((x, i) => shapes.indexOf(x) !== i)).toEqual([]);
  });
});

describe('전투 공통 효과 · 파티원 능력 (손그림풍, scripts/vfx/common.mjs)', () => {
  const COMMON: CommonFx[] = ['hit', 'crit', 'heal', 'dispel', 'revive', 'death', 'debuff', 'proc'];
  /** 게임이 색을 곱해 칠하는 회색 그림 (치유 = 문장 색 · 쓰러짐 = 역할 색 · 디버프 = 종류 색 · 장비 발동 = 묶음 색) */
  const GRAY = new Set<CommonFx>(['heal', 'death', 'debuff', 'proc']);
  it('공통 효과 8종 · 능력 종류 5개 모두', () => {
    expect(Object.keys(COMMON_PXF).sort()).toEqual([...COMMON].sort());
    expect(Object.keys(ALLY_PXF).sort()).toEqual(Object.keys(AB_KIND).sort());
  });
  for (const k of COMMON) {
    it(`${k}: ${GRAY.has(k) ? '회색 그림 (게임이 칠함, 굽기가 색이 섞이면 멈춤)' : '구운 색 그대로'} · 192px 손그림`, () => {
      const key = COMMON_PXF[k]!;
      expect({ gray: PXF[key].gray, size: PXF[key].size }).toEqual({ gray: GRAY.has(k), size: 192 });
      expect((FX as Record<string, { gray?: boolean }>)[key].gray ?? false).toBe(GRAY.has(k));
    });
  }
  it('능력 종류마다 다른 이펙트, 휠 스킬과도 겹치지 않음', () => {
    const all = [...Object.values(SKILL_PXF).map(s => s!.fx), ...Object.values(COMMON_PXF), ...Object.values(ALLY_PXF)];
    expect(new Set(all).size).toBe(all.length);
    for (const kind of Object.keys(AB_KIND) as AbKind[]) expect(PXF[ALLY_PXF[kind]!].gray).toBe(false);
  });
});

describe('보스 판 전체 공격 (Codex 손그림 띠 66 `fx-wide-`, PXF 도트 띠는 2026-10-16 Lim 「도트를 모두 제거」로 지움)', () => {
  it('판 전체 연출 11가지, 모두 다른 이펙트 · 다른 이펙트와 안 겹침 · 외침만 세력 색을 곱함 · 띠는 Codex 그림 (256 격자)', () => {
    expect(Object.keys(BOSS_PXF).sort()).toEqual(['cream-burst', 'door-open', 'heartbeat', 'hush', 'island-tilt', 'lantern', 'melt-heat', 'sandstorm', 'shockwave', 'shout', 'wedge']);
    const all = [...Object.values(SKILL_PXF).map(s => s!.fx), ...Object.values(COMMON_PXF), ...Object.values(ALLY_PXF), ...Object.values(BOSS_PXF)];
    expect(new Set(all).size).toBe(all.length);
    expect(BOSS_KEYS.sort()).toEqual(Object.values(BOSS_PXF).sort());
    for (const [name, key] of Object.entries(BOSS_PXF)) {
      const c = PXF[key!];
      expect(key, name).toBe(`boss-${name}`);
      expect(c.gray, name).toBe(name === 'shout');
      expect({ size: c.size, cols: c.cols, logical: c.logicalSize }, name).toEqual({ size: 256, cols: Math.ceil(Math.sqrt(c.frames)), logical: WIDE_DESIGN });
      expect(c.size * c.cols, name).toBeLessThanOrEqual(2048); // 폰 텍스처 한도 안 (한 줄로 이으면 5632px)
      expect(pxfArtName(key!), name).toBe(wideArtName(key!));
      expect(artSize(wideArtName(key!)), name).toEqual({ w: c.size * c.cols, h: c.size * Math.ceil(c.frames / c.cols) });
    }
    expect(existsSync(new URL('../src/art/pxf/tiles', import.meta.url))).toBe(false);
  });
  it('판 너비로 키우고 판 밖은 잘라 냄 (픽셀은 정사각형)', () => {
    const c = PXF['boss-shockwave'];
    expect(pxfCrop(c, 340, 245)).toEqual({ x: 0, y: 36, w: 256, h: 184 }); // 5인: 가로로 넓음 → 위아래
    expect(pxfCrop(c, 300, 300)).toEqual({ x: 0, y: 0, w: 256, h: 256 });
    expect(pxfCrop(c, 240, 320)).toEqual({ x: 32, y: 0, w: 192, h: 256 }); // 세로로 길면 좌우
    expect(pxfCell(c, 0)).toEqual({ x: 0, y: 0 });
    expect(pxfCell(c, 5)).toEqual({ x: 256, y: 256 }); // 16장 = 4×4 격자
    expect(pxfCell(PXF['boss-sandstorm'], 21)).toEqual({ x: 256, y: 1024 }); // 22장 = 5열
  });
  it('Codex 그림 띠 (66 `fx-wide-`, Lim 「도트 느낌이 아닌 이펙트로」): art:optimize가 줄이지 않음', () => {
    for (const [name, k] of Object.entries(BOSS_PXF)) expect(wideArtName(k!), name).toBe(`fx-wide-${name}`);
    // art:optimize가 줄이지 않음 (fx- 규칙 256보다 먼저)
    expect(readFileSync(new URL('../scripts/art-optimize.mjs', import.meta.url), 'utf8')).toMatch(/re: \/\^fx-wide-\/, w: 1280, h: 1280/);
  });
  it('전투마다 그 전투에서 나올 수 있는 것만 읽음 (256px 띠라 하나에 4–6MB)', () => {
    const of = (key: string) => bossPxfOf(ENCOUNTERS[key as keyof typeof ENCOUNTERS]).sort();
    const all = new Set(Object.values(ENCOUNTERS).flatMap(e => bossPxfOf(e)));
    expect([...all].sort()).toEqual(Object.values(BOSS_PXF).sort()); // 11가지 모두 어딘가에서 나옴
    expect(of('scrap')).toEqual([]); // 고철 경비병: 광역 (쇳조각 비)만
    expect(of('monggeul')).toContain('boss-cream-burst'); // 크림 폭발 (art.ts BOSS_FX hit)
    expect(of('swit')).toContain('boss-hush'); // 크게 뛰기 → 조용히 (BOSS_FX swap)
    const counts = Object.values(ENCOUNTERS).map(e => bossPxfOf(e).length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(3); // 한 전투에 많아야 몇 개 (모두 읽던 때 11개)
  });
});

describe('엔진: 스킬이 들어간 순간 (Fight.used)', () => {
  it('시전 스킬은 끝까지 들어간 틱에 한 번, 그 틱에 대상 치유 사건', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const tank = f.party.find(u => u.role === 'tank')!;
    tank.hp = tank.max * 0.5;
    expect(E.use(f, 'heal', tank.cell).ok).toBe(true);
    expect(f.used ?? []).toEqual([]); // 시전 시작은 아님
    const hits: { healed: boolean }[] = [];
    for (let i = 0; i < 400; i++) {
      f.events.length = 0;
      E.step(f);
      for (const x of f.used?.splice(0) ?? []) {
        expect(x).toEqual({ key: 'heal', uid: tank.id });
        hits.push({ healed: f.events.some(e => e.type === 'heal' && e.id === tank.id) });
      }
    }
    expect(hits).toEqual([{ healed: true }]);
  });

  it('취소한 시전은 안 남음, 즉시 스킬은 쓰는 순간', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const [a, b] = f.party.filter(u => u.role !== 'tank');
    E.use(f, 'heal', a.cell);
    E.step(f);
    E.use(f, 'renew', b.cell); // 다른 대상 → 치유 취소 후 소생
    expect(f.used).toEqual([{ key: 'renew', uid: b.id }]);
    f.used!.length = 0;
    for (let i = 0; i < 400; i++) E.step(f);
    expect(f.used ?? []).toEqual([]);
  });

  it('정신 집중 공대 쿨기는 시작할 때 한 번 (파티 전원 칸)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 20 });
    expect(E.use(f, 'hymn', f.me.cell).ok).toBe(true);
    expect(f.used).toEqual([{ key: 'hymn', uid: f.me.id }]);
    expect(pxfTargets(f, 'heal', f.me.id).map(u => u.id)).toEqual([f.me.id]);
  });

  it('정신 집중 동안 1초마다 그 스킬로 다시 (찬가 회복이 공통 치유 빛 대신 스킬 이펙트, 82: 고요한 숲은 즉시라 빠짐)', () => {
    for (const [hero, key] of [['priest', 'hymn']] as const) {
      const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 20, hero });
      f.skills.forEach(k => { k.next = Infinity; });
      expect(E.use(f, key, f.me.cell).ok, hero).toBe(true);
      f.used!.length = 0;
      const ticks: boolean[] = [];
      for (let i = 0; i < 200 && f.channel > 0; i++) {
        f.events.length = 0;
        E.step(f);
        for (const x of f.used?.splice(0) ?? []) {
          expect(x, hero).toEqual({ key, uid: f.me.id });
          ticks.push(E.living(f).every(u => f.events.some(e => e.type === 'heal' && e.id === u.id)));
        }
      }
      expect(ticks, hero).toEqual([true, true, true, true]); // 4초 정신 집중 = 4번, 그때마다 파티 전원 치유 사건
    }
  });

  it('빛의 전이: 빛이 깃든 사람이 회복할 때마다 그 칸에 다시', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 100, hero: 'priest' });
    f.skills.forEach(k => { k.next = Infinity; });
    const t = f.party.find(u => u.role === 'tank')!;
    expect(E.use(f, 'relay', t.cell).ok).toBe(true);
    for (let n = 0; f.gcd > 0 && n < 200; n++) E.step(f);
    f.used!.length = 0; f.events.length = 0;
    t.hp = t.max * 0.8;
    f.relay!.flyUntil = f.t;
    damage(f, t, 300);
    expect(f.used).toEqual([{ key: 'relay', uid: t.id }]);
    expect(f.events.some(e => e.type === 'heal' && e.id === t.id)).toBe(true);
  });

  it('범위 스킬은 대상과 붙어 있는 아군 칸마다', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const u = f.party.find(x => x.role === 'tank')!;
    const near = E.living(f).filter(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) <= 1).map(v => v.id).sort();
    const s = SKILL_PXF.poh;
    if (s) expect(pxfTargets(f, 'poh', u.id).map(v => v.id).sort()).toEqual(near);
    expect(near.length).toBeGreaterThan(1);
  });

  it('기록은 비우지 않아도 끝없이 쌓이지 않음 (시뮬레이션)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    for (let i = 0; i < 20000 && !f.over; i++) { E.autoHealer(f); E.step(f); f.events.length = 0; }
    expect((f.used ?? []).length).toBeLessThanOrEqual(32);
  });
});
