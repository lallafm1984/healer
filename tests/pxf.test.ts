/** PXF 공방 스킬 이펙트 (Lim 2026-10-11): 휠 스킬이 들어가면 그 스킬의 픽셀 이펙트 (src/art/pxf/<이름>.pxf.json → fx-pxf-<이름>.png) */
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { HEROES } from '../src/data/heroes';
import type { SkillKey } from '../src/data/skills';
import { ALLY_PXF, BOSS_PXF, bossPxfOf, COMMON_PXF, isBossPxf, PXF, pxfArtName, pxfCell, pxfCrop, pxfDrawSize, pxfFrame, pxfMs, pxfTargets, SKILL_PXF, WIDE_DESIGN, type CommonFx, type PxfKey } from '../src/battle/pxf';
import { ENCOUNTERS } from '../src/data/encounters';
import { AB_KIND, type AbKind } from '../src/data/abilities';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
// @ts-expect-error 빌드 도구 스크립트 (.mjs, 타입 없음)
import { splitGraph, TILE_KEYS } from '../scripts/pxf-split.mjs';
// @ts-expect-error 빌드 도구 스크립트 (.mjs, 타입 없음)
import { renderStripRgba, WIDE_SIZE } from '../scripts/fxr.mjs';

const graph = (name: string) => JSON.parse(readFileSync(new URL(`../src/art/pxf/${name}.pxf.json`, import.meta.url), 'utf8'));
/** PNG 머리 (IHDR)의 가로 · 세로 */
const pngSize = (art: string) => {
  const b = readFileSync(new URL(`../src/art/${art}.png`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
/** 우리 렌더러 (scripts/fxr/png.mjs)가 쓴 PNG의 픽셀 (RGBA 8비트 · 줄마다 필터 0만) */
const pngPixels = (art: string) => {
  const b = readFileSync(new URL(`../src/art/${art}.png`, import.meta.url)), w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const idat: Buffer[] = [];
  for (let o = 8; o < b.length;) { const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8); if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + n)); o += 12 + n; }
  const raw = inflateSync(Buffer.concat(idat)), px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    if (raw[y * (w * 4 + 1)] !== 0) throw new Error(`${art}: ${y}줄 필터 ${raw[y * (w * 4 + 1)]} (fxr로 구운 띠가 아님)`);
    px.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
  }
  return { w, h, px };
};
const KEYS = Object.keys(PXF) as PxfKey[];
/** 아직 이펙트를 안 넣은 휠 스킬 (없음) */
const LATER = new Set<SkillKey>([]);

describe('PXF 이펙트 파일', () => {
  for (const k of KEYS) {
    it(`${k}: 게임 값이 그래프의 settings · game과 같고, 프레임 띠 · 타임라인 그림이 있음`, () => {
      const g = graph(k), c = PXF[k], design = isBossPxf(k) ? WIDE_DESIGN : c.size;
      expect(g.format).toBe('pxf.graph@1');
      expect({ size: design, frames: c.frames, fps: c.fps, loop: false }).toEqual({ size: g.settings.size, frames: g.settings.frames, fps: g.settings.fps, loop: g.settings.loop });
      expect({ impactFrame: c.impactFrame, logicalSize: c.logicalSize, referenceCell: c.referenceCell })
        .toEqual({ impactFrame: g.game.impactFrame, logicalSize: g.game.logicalSize, referenceCell: g.game.referenceCell ?? 62 });
      expect(g.game.pivot).toEqual([0.5, 0.5]); // 칸 가운데에 그림
      expect(c.blend).toBe('normal'); // Lim 2026-10-11: 원본 색이 잘 보이게 보통 섞기
      expect(pngSize(pxfArtName(k))).toEqual({ w: c.size * c.cols, h: c.size * Math.ceil(c.frames / c.cols) });
      if (!isBossPxf(k)) expect(existsSync(new URL(`../src/art/pxf/${k}.timeline.png`, import.meta.url))).toBe(true); // 다시 굽는 원본
      else {
        // 보스 판 전체 공격은 128px 설계를 공방에서 64px 조각 4개로 확인 (scripts/pxf-tiles.mjs): 조각 그래프가 원본을 나눈 것과 같고, 조각마다 타임라인 그림이 있음
        expect(g.settings.size).toBe(128);
        const { tiles } = splitGraph(g);
        for (const q of TILE_KEYS as readonly string[]) {
          const f = new URL(`../src/art/pxf/tiles/${k}.${q}.pxf.json`, import.meta.url);
          if (!tiles[q]) { expect(existsSync(f), q).toBe(false); continue; }
          expect(JSON.parse(readFileSync(f, 'utf8')), q).toEqual(tiles[q]);
          expect(existsSync(new URL(`../src/art/pxf/tiles/${k}.${q}.timeline.png`, import.meta.url)), q).toBe(true);
        }
      }
    });
  }

  it('맞는 순간이 첫 프레임, 끝까지 재생하고 사라짐', () => {
    const c = PXF['heal-dust'];
    expect(pxfFrame(c, 0)).toBe(2);
    expect(pxfFrame(c, 1000 / 24)).toBe(3);
    expect(pxfFrame(c, pxfMs(c) - 1)).toBe(23);
    expect(pxfFrame(c, pxfMs(c))).toBe(-1);
    expect(pxfMs(c)).toBeCloseTo((22 * 1000) / 24);
    expect(pxfDrawSize(c, 62)).toBe(64);
  });
});

describe('직업별 휠 스킬', () => {
  for (const hero of Object.values(HEROES)) {
    it(`${hero.name}: 휠 스킬마다 PXF 이펙트`, () => {
      const missing = Object.values(hero.slots).filter((k): k is SkillKey => !!k && !LATER.has(k) && !SKILL_PXF[k]);
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

describe('전투 공통 효과 · 파티원 능력 (모든 효과 PXF 1단계)', () => {
  const COMMON: CommonFx[] = ['hit', 'crit', 'heal', 'dispel', 'revive', 'death', 'debuff', 'proc'];
  /** 게임이 색을 곱해 칠하는 회색 그림 (치유 = 문장 색 · 쓰러짐 = 역할 색 · 디버프 = 종류 색 · 장비 발동 = 묶음 색) */
  const GRAY = new Set<CommonFx>(['heal', 'death', 'debuff', 'proc']);
  const gray = (c: string) => c.length === 7 && c.slice(1, 3) === c.slice(3, 5) && c.slice(3, 5) === c.slice(5, 7);
  it('공통 효과 8종 · 능력 종류 5개 모두', () => {
    expect(Object.keys(COMMON_PXF).sort()).toEqual([...COMMON].sort());
    expect(Object.keys(ALLY_PXF).sort()).toEqual(Object.keys(AB_KIND).sort());
  });
  for (const k of COMMON) {
    it(`${k}: ${GRAY.has(k) ? '회색 팔레트 (게임이 칠함)' : '구운 색 그대로'}`, () => {
      const key = COMMON_PXF[k]!, g = graph(key), cols = g.nodes.filter((n: { type: string }) => n.type === 'Palette' || n.type === 'Outline')
        .flatMap((n: { type: string; params: { colors?: string[]; color?: string } }) => (n.type === 'Palette' ? n.params.colors! : [n.params.color ?? '#10142e']).map((c: string) => c.toLowerCase()));
      expect(PXF[key].gray).toBe(GRAY.has(k));
      if (GRAY.has(k)) expect(cols.filter((c: string) => !gray(c))).toEqual([]);
    });
  }
  it('능력 종류마다 다른 이펙트, 휠 스킬과도 겹치지 않음', () => {
    const all = [...Object.values(SKILL_PXF).map(s => s!.fx), ...Object.values(COMMON_PXF), ...Object.values(ALLY_PXF)];
    expect(new Set(all).size).toBe(all.length);
    for (const kind of Object.keys(AB_KIND) as AbKind[]) expect(PXF[ALLY_PXF[kind]!].gray).toBe(false);
  });
});

describe('보스 판 전체 공격 (Lim 「보스의 판 전체 공격 이펙트를 … 픽셀 크기를 늘려서」 → 「픽셀이 좀더 디테일」)', () => {
  const gray = (c: string) => c.length === 7 && c.slice(1, 3) === c.slice(3, 5) && c.slice(3, 5) === c.slice(5, 7);
  it('판 전체 연출 11가지, 모두 다른 이펙트 · 다른 PXF와 안 겹침 · 외침만 회색 (세력 색을 곱함)', () => {
    expect(Object.keys(BOSS_PXF).sort()).toEqual(['cream-burst', 'door-open', 'heartbeat', 'hush', 'island-tilt', 'lantern', 'melt-heat', 'sandstorm', 'shockwave', 'shout', 'wedge']);
    const all = [...Object.values(SKILL_PXF).map(s => s!.fx), ...Object.values(COMMON_PXF), ...Object.values(ALLY_PXF), ...Object.values(BOSS_PXF)];
    expect(new Set(all).size).toBe(all.length);
    for (const [name, key] of Object.entries(BOSS_PXF)) {
      expect(key, name).toBe(`boss-${name}`);
      const cols = graph(key!).nodes.filter((n: { type: string }) => n.type === 'Palette' || n.type === 'Outline')
        .flatMap((n: { type: string; params: { colors?: string[]; color?: string } }) => (n.type === 'Palette' ? n.params.colors! : [n.params.color ?? '#10142e']).map((c: string) => c.toLowerCase()));
      expect(PXF[key!].gray, name).toBe(name === 'shout');
      expect({ size: PXF[key!].size, cols: PXF[key!].cols }, name).toEqual({ size: 256, cols: Math.ceil(Math.sqrt(PXF[key!].frames)) });
      expect(PXF[key!].size * PXF[key!].cols, name).toBeLessThanOrEqual(2048); // 폰 텍스처 한도 안 (한 줄로 이으면 5632px)
      if (name === 'shout') expect(cols.filter((c: string) => !gray(c))).toEqual([]);
    }
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
  for (const k of Object.values(BOSS_PXF)) {
    it(`${k}: 띠 = 128px 설계를 우리 렌더러로 256px로 그린 것 (node scripts/fxr.mjs --wide ${k})`, () => {
      const r = renderStripRgba(graph(k!), WIDE_SIZE, { grid: true }), png = pngPixels(pxfArtName(k!));
      expect({ w: png.w, h: png.h, cols: r.cols }).toEqual({ w: r.w, h: r.h, cols: PXF[k!].cols });
      expect(Buffer.from(png.px).equals(Buffer.from(r.rgba.buffer, r.rgba.byteOffset, r.rgba.length))).toBe(true);
      // 마지막 프레임은 비어 있음 (끝나면 사라짐)
      const last = pxfCell(PXF[k!], PXF[k!].frames - 1);
      let alpha = 0;
      for (let y = last.y; y < last.y + 256; y++) for (let x = last.x; x < last.x + 256; x++) alpha = Math.max(alpha, png.px[(y * png.w + x) * 4 + 3]);
      expect(alpha).toBe(0);
    }, 30000);
  }
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

  it('정신 집중 동안 1초마다 그 스킬로 다시 (찬가 · 고요한 숲 회복이 공통 치유 빛 대신 스킬 이펙트)', () => {
    for (const [hero, key] of [['priest', 'hymn'], ['druid', 'quietwood']] as const) {
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
