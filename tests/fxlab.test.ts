/** 개발용 이펙트 화면 (fx.html, src/fxlab) · 우리 렌더러 (scripts/fxr) 2026-10-12: 계약 29종 · 게임 그래프 50개 · 검사기 · 그래프 고치기 · 저장 / 굽기 창구 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PXF, type PxfKey } from '../src/battle/pxf';
import { gameChecks } from '../src/fxlab/game-link';
import {
  addKey, addNode, autoLayout, connect, insertAfter, needsLayout, newGraph, previewGraph, removeKey, removeNode, renameNode, renderChecks, resize, retime, toMode,
} from '../src/fxlab/graph-edit';
import { bakeGraph, bakeLayout, NAME, saveGraph } from '../scripts/fxr/dev-server.mjs';
import { renderGraph, type Contract, type PxfGraph } from '../scripts/fxr/render.mjs';
import { validateGraph } from '../scripts/fxr/validate.mjs';

const contract = JSON.parse(readFileSync(new URL('../scripts/fxr/pxf-contract.json', import.meta.url), 'utf8')) as Contract;
const dir = new URL('../src/art/pxf/', import.meta.url);
const names = readdirSync(dir).filter(f => f.endsWith('.pxf.json')).map(f => f.slice(0, -'.pxf.json'.length));
const graph = (name: string) => JSON.parse(readFileSync(new URL(`${name}.pxf.json`, dir), 'utf8')) as PxfGraph;
const alpha = (fr: Uint8ClampedArray) => { let n = 0; for (let i = 3; i < fr.length; i += 4) if (fr[i]) n++; return n; };
const errs = (g: unknown) => validateGraph(g, contract).errors;

describe('우리 렌더러 (fxr): 공방 계약 노드 전부', () => {
  it('계약 29종', () => expect(Object.keys(contract.nodes)).toHaveLength(29));
  for (const name of names) {
    it(`게임 그래프 ${name}: 검사 통과 · 그려짐`, () => {
      const g = graph(name), v = validateGraph(g, contract);
      expect(v.errors).toEqual([]);
      expect(v.warnings).toEqual([]);
      const r = renderGraph(g, { contract });
      expect(r.frames).toHaveLength(g.settings.frames);
      expect(r.frames.some(f => alpha(f) > 0)).toBe(true);
    });
  }
  // 노드마다 기본값으로: 그리기 노드 → 팔레트 → 출력, 바꾸는 노드는 동그라미를 입력으로
  for (const [type, spec] of Object.entries(contract.nodes)) {
    if (type === 'Output' || type === 'Palette') continue;
    it(`${type}: 기본값으로 그려짐`, () => {
      const nodes: PxfGraph['nodes'] = [
        { id: 'src', type: 'Shape', x: 0, y: 0, params: { size: 14, falloff: 0.3 } },
        { id: 'src2', type: 'Shape', x: 0, y: 100, params: { size: 20, shape: 'ring' } },
        { id: 'n', type, x: 200, y: 0, params: {} },
        { id: 'pal', type: 'Palette', x: 400, y: 0, params: {} },
        { id: 'out', type: 'Output', x: 600, y: 0, params: { alpha: 'soft' } },
      ];
      const links = [...spec.inputs.map((p, i) => ({ f: i ? 'src2' : 'src', t: 'n', p: p.p })), { f: 'n', t: 'pal', p: 0 }, { f: 'pal', t: 'out', p: 0 }];
      const g: PxfGraph = { format: 'pxf.graph@1', name: type, settings: { size: 32, frames: 6, fps: 12, loop: false }, nodes: nodes.filter(n => n.id.startsWith('src') ? spec.inputs.length > (n.id === 'src' ? 0 : 1) : true), links };
      expect(errs(g)).toEqual([]);
      const r = renderGraph(g, { contract, size: 64 });
      expect(r.size).toBe(64);
      expect(r.frames.some(f => alpha(f) > 0), '빈 그림').toBe(true);
    });
  }
});

describe('그래프 검사기', () => {
  const ok = newGraph();
  it('새 그래프는 통과', () => expect(validateGraph(ok, contract)).toEqual({ errors: [], warnings: [] }));
  const bad = (fn: (g: PxfGraph) => void) => { const g = structuredClone(ok); fn(g); return errs(g); };
  it('형식 · 노드 종류 · 값 범위 · 키프레임 · 연결 · 순환 · 출력', () => {
    expect(bad(g => { g.format = 'x'; })[0]).toMatch(/format/);
    expect(bad(g => { g.nodes[0].type = 'Nope'; }).join()).toMatch(/계약에 없는 노드/);
    expect(bad(g => { g.nodes[0].params.falloff = 9; }).join()).toMatch(/범위 밖/);
    expect(bad(g => { g.nodes[0].params.size = { k: [[5, 1], [2, 3]] }; }).join()).toMatch(/오름차순/);
    expect(bad(g => { g.nodes[0].params.size = { k: [[0, 1], [40, 3]] }; }).join()).toMatch(/프레임 40/);
    expect(bad(g => { g.nodes[0].params.shape = { a: 1, b: 2 }; }).join()).toMatch(/움직일 수 없음/);
    expect(bad(g => { g.links.push({ f: 'orb', t: 'pal', p: 0 }); }).join()).toMatch(/둘 이상/);
    expect(bad(g => { g.links.push({ f: 'pal', t: 'orb', p: 0 }); }).join()).toMatch(/입력 0번이 없음/);
    expect(bad(g => { g.nodes.push({ id: 't', type: 'Transform', x: 0, y: 0, params: {} }); g.links.push({ f: 't', t: 't', p: 0 }); }).join()).toMatch(/순환/);
    expect(bad(g => { g.nodes = g.nodes.filter(n => n.type !== 'Output'); g.links = g.links.filter(l => l.t !== 'out'); }).join()).toMatch(/Output/);
    expect(validateGraph({ ...ok, nodes: [...ok.nodes, { id: 'lost', type: 'Shape', x: 0, y: 300, params: {} }] }, contract).warnings.join()).toMatch(/lost/);
  });
});

describe('그래프 고치기 (src/fxlab/graph-edit)', () => {
  it('노드 더하기 · 뒤에 끼우기 · 지우기 · 이름 바꾸기', () => {
    const g = newGraph(), id = addNode(g, 'Glow', { x: 270, y: 40 });
    expect(id).toBe('glow');
    expect(g.nodes.find(n => n.id === id)!.y).not.toBe(40); // 팔레트 자리와 안 겹치게 내려감
    insertAfter(g, 'orb', id, 1);
    expect(g.links).toEqual(expect.arrayContaining([{ f: 'orb', t: 'glow', p: 0 }, { f: 'glow', t: 'pal', p: 0 }]));
    expect(g.links.some(l => l.f === 'orb' && l.t === 'pal')).toBe(false);
    expect(errs(g)).toEqual([]);
    expect(renameNode(g, 'glow', 'pal')).toMatch(/이미/);
    expect(renameNode(g, 'glow', 'a b')).toMatch(/영문/);
    expect(renameNode(g, 'glow', 'halo')).toBeNull();
    expect(g.links.filter(l => l.f === 'halo' || l.t === 'halo')).toHaveLength(2);
    removeNode(g, 'halo');
    expect(g.links.some(l => l.f === 'halo' || l.t === 'halo')).toBe(false);
  });
  it('연결: 같은 입력은 바꾸고, 순환은 거절', () => {
    const g = newGraph();
    expect(connect(g, 'out', 'orb', 0)).toBe(false);
    expect(connect(g, 'pal', 'pal', 0)).toBe(false);
    addNode(g, 'Shape', { x: 40, y: 300 });
    expect(connect(g, 'shape', 'pal', 0)).toBe(true);
    expect(g.links.filter(l => l.t === 'pal')).toEqual([{ f: 'shape', t: 'pal', p: 0 }]);
  });
  it('고정 ↔ 키프레임 ↔ 구간', () => {
    const spec = contract.nodes.Shape.params.size;
    expect(toMode(10, 'keys', spec, 16, 3)).toEqual({ k: [[0, 10, 'linear'], [15, 10]] });
    expect(toMode(10, 'range', spec, 16, 3)).toEqual({ a: 10, b: 10, e: 'linear', t0: 0, t1: 1 });
    expect(toMode({ k: [[0, 0], [10, 20]] }, 'fixed', spec, 16, 5)).toBe(10);
    expect(toMode({ a: 0, b: 16, e: 'linear', t0: 0, t1: 1 }, 'keys', spec, 16, 0)).toEqual({ k: [[0, 0, 'linear'], [15, 16]] });
    const k = addKey({ k: [[0, 1], [10, 5]] }, 4, 3, 'out');
    expect(k.k).toEqual([[0, 1], [4, 3, 'out'], [10, 5]]);
    expect(removeKey({ k: [[2, 7]] }, 0)).toBe(7);
  });
  it('장 수 바꾸기: 키프레임 · 맞는 순간도 같은 비율', () => {
    const g = newGraph();
    retime(g, 31);
    expect(g.settings.frames).toBe(31);
    expect(g.nodes[0].params.size).toEqual({ k: [[0, 4, 'out'], [24, 26]] });
    expect(g.game?.impactFrame).toBe(2);
    expect(errs(g)).toEqual([]);
  });
  it('캔버스 크기 바꾸기: 픽셀 값 같은 비율, 범위 밖은 알려 줌', () => {
    const g = newGraph();
    g.nodes[0].params.stroke = 2;
    expect(resize(g, 128, contract)).toEqual([]);
    expect(g.nodes[0].params.size).toEqual({ k: [[0, 8, 'out'], [12, 52]] });
    expect(g.nodes[0].params.stroke).toBe(4);
    const h = newGraph();
    h.nodes[0].params.size = 60;
    expect(resize(h, 128, contract)).toEqual(['orb.size']);
  });
  it('고른 노드만 보기 · 줄 세우기', () => {
    const g = newGraph(), p = previewGraph(g, 'orb');
    expect(p.nodes.map(n => n.id)).toEqual(['orb', '__preview']);
    expect(errs(p)).toEqual([]);
    expect(renderGraph(p, { contract }).frames.some(f => alpha(f) > 0)).toBe(true);
    for (const n of g.nodes) { n.x = 0; n.y = 0; }
    expect(needsLayout(g)).toBe(true);
    autoLayout(g);
    expect(g.nodes.map(n => n.x)).toEqual([40, 270, 500]);
    expect(needsLayout(g)).toBe(false);
  });
  it('그린 프레임 살펴보기: 끝에 남은 그림 · 가장자리', () => {
    const g = newGraph(), r = renderGraph(g, { contract });
    expect(renderChecks(r.frames, r.size, g).filter(c => c.level === 'warn')).toEqual([]);
    const full = new Uint8ClampedArray(4 * 4 * 4).fill(255), msgs = renderChecks([full, full], 4, { ...g, settings: { ...g.settings, frames: 2 } }).map(c => c.text).join();
    expect(msgs).toMatch(/마지막 프레임/);
    expect(msgs).toMatch(/가장자리/);
    expect(renderChecks([full, full], 4, { ...g, settings: { ...g.settings, frames: 2 } }, false).map(c => c.text).join()).not.toMatch(/가장자리/);
  });
});

describe('게임 값과 견주기 (src/fxlab/game-link)', () => {
  it('저장소 그래프는 모두 게임 값과 같음', () => {
    for (const k of Object.keys(PXF) as PxfKey[]) expect(gameChecks(k, graph(k)).filter(c => c.level === 'warn'), k).toEqual([]);
  });
  it('장 수가 다르면 알려 줌', () => {
    const g = graph('heal-dust');
    g.settings.frames = 20;
    expect(gameChecks('heal-dust', g).map(c => c.text).join()).toMatch(/장 수: 그래프 20, 게임 24/);
  });
});

describe('저장 · 굽기 창구 (scripts/fxr/dev-server, 개발 서버 전용)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'fxlab-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  it('이름은 소문자 · 숫자 · - 만 (다른 폴더에 못 씀)', () => {
    for (const bad of ['', '../x', 'a/b', 'A', '-x', 'a.b', 'x'.repeat(65)]) expect(NAME.test(bad), bad).toBe(false);
    for (const good of ['heal-dust', 'boss-wedge', 'a1']) expect(NAME.test(good)).toBe(true);
    expect(() => saveGraph('../evil', newGraph(), tmp)).toThrow(/이름/);
  });
  it('굽는 모양: 128px 설계 = 256px 격자, 나머지 = 설계 크기 가로 띠', () => {
    expect(bakeLayout(graph('boss-wedge'))).toEqual({ size: 256, grid: true });
    expect(bakeLayout(graph('heal-dust'))).toEqual({ size: 64, grid: false });
  });
  it('저장: 저장소 모양 (2칸 들여쓰기), 검사 오류면 안 씀', () => {
    const g = newGraph(), r = saveGraph('fx-test', g, tmp);
    expect(r.warns).toEqual([]);
    expect(readFileSync(join(tmp, 'fx-test.pxf.json'), 'utf8')).toBe(`${JSON.stringify(g, null, 2)}\n`);
    expect(() => saveGraph('fx-bad', { ...g, format: 'x' }, tmp)).toThrow(/검사 오류/);
    expect(existsSync(join(tmp, 'fx-bad.pxf.json'))).toBe(false);
  });
  it('보스 판 전체 공격은 64px 조각 그래프도 같이 (조각 타임라인이 없으면 알림)', () => {
    const r = saveGraph('boss-wedge', graph('boss-wedge'), tmp);
    expect(readdirSync(join(tmp, 'tiles')).length).toBeGreaterThan(0);
    expect(r.warns.join()).toMatch(/타임라인 그림이 없음/);
  });
  it('굽기: 띠 PNG 크기', () => {
    const r = bakeGraph('fx-test', newGraph(), tmp), b = readFileSync(join(tmp, 'fx-pxf-fx-test.png'));
    expect({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) }).toEqual({ w: 64 * 16, h: 64 });
    expect(r).toMatchObject({ size: 64, frames: 16, cols: 16 });
  });
});
