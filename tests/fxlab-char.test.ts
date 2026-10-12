/** 개발용 이펙트 공방 · 도트 캐릭터 (fx.html?mode=char, src/fxlab/char) 2026-10-12: 형식 healer.char@1 · 뼈대 그리기 · 손질 · 고치기 도우미 · 저장 / 시트 굽기 창구 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type CharDoc, type CharMotion, charJson, poseAt, renderCharFrame, renderCharSheet, validateChar } from '../scripts/fxr/char.mjs';
import { bakeChar, listChars, saveChar } from '../scripts/fxr/dev-server.mjs';
import {
  blankChar, duplicatePart, editCount, fillPart, mirrorPart, newChar, partTree, pixelOf, PRESETS, type PresetKey, presetMotion, removeColor, removePart, renamePart,
  resizeCanvas, retimeMotion, setEdit, setPixel, setTrackKey, valueAt,
} from '../src/fxlab/char/char-doc';

const clone = <T>(x: T): T => structuredClone(x);
/** 그려진 칸의 테두리 상자 */
const bbox = (doc: CharDoc, idx: Int16Array) => {
  const n = doc.size; let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let i = 0; i < idx.length; i++) if (idx[i] >= 0) { const x = i % n, y = (i / n) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};
/** 막대 하나 (1×3, 기준점 = 왼쪽 아래 모서리) */
const bar = (rot = 0): CharDoc => ({
  format: 'healer.char@1', name: '막대', size: 16, palette: ['#000000', '#ffffff'],
  parts: [{ id: 'a', name: 'a', w: 1, h: 3, pixels: ['1', '1', '1'], pivot: [0, 3], parent: null, at: [8, 8], rot, z: 0 }], motions: [],
});
const motion = (tracks: CharMotion['tracks'] = {}, frames = 8): CharMotion => ({ id: 'm', name: 'm', frames, fps: 10, loop: true, tracks });

describe('기본 캐릭터 · 기본 모션', () => {
  const doc = newChar();
  it('견습 사제: 검사 통과 · 기본 모션 5개', () => {
    expect(validateChar(doc)).toEqual({ errors: [], warnings: [] });
    expect(doc.motions.map(m => m.id)).toEqual(['idle', 'walk', 'attack', 'cast', 'hit']);
  });
  it('어느 모션 · 프레임도 캔버스 가장자리에 안 닿음 (잘리지 않음)', () => {
    const n = doc.size;
    for (const m of [null, ...doc.motions]) for (let f = 0; f < (m?.frames ?? 1); f++) {
      const b = bbox(doc, renderCharFrame(doc, m, f).idx);
      expect([m?.id ?? 'rest', f, b.x0 > 0 && b.y0 > 0 && b.x1 < n - 1 && b.y1 < n - 1]).toEqual([m?.id ?? 'rest', f, true]);
    }
  });
  it('기본 모션은 모두 검사 통과, 없는 부품 움직임은 빼고 만듦', () => {
    for (const k of Object.keys(PRESETS) as PresetKey[]) {
      const d = clone(doc); d.motions = [presetMotion(d, k, 'x')];
      expect(validateChar(d).errors).toEqual([]);
    }
    const b = blankChar();
    for (const k of Object.keys(PRESETS) as PresetKey[]) expect(Object.keys(presetMotion(b, k).tracks).every(id => id === 'body')).toBe(true);
  });
  it('움직이는 모션은 프레임마다 그림이 바뀜', () => {
    for (const m of doc.motions) {
      const frames = new Set(Array.from({ length: m.frames }, (_, f) => renderCharFrame(doc, m, f).idx.join(',')));
      expect(frames.size, m.id).toBeGreaterThan(1);
    }
  });
});

describe('그리기 (뼈대)', () => {
  it('돌리지 않으면 부품 그림 그대로 (기준점이 붙는 자리에)', () => {
    const doc = blankChar('b', 32), p = doc.parts[0], { idx } = renderCharFrame(doc, null, 0);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) expect(idx[(28 - 8 + y) * 32 + 16 - 4 + x]).toBe(pixelOf(p, x, y));
    expect(bbox(doc, idx)).toEqual({ x0: 12, y0: 20, x1: 19, y1: 27 });
  });
  it('시계 방향 90° → 위로 선 막대가 오른쪽으로 누움', () => {
    const up = bbox(bar(), renderCharFrame(bar(), null, 0).idx), right = bbox(bar(90), renderCharFrame(bar(90), null, 0).idx);
    expect(up).toEqual({ x0: 8, y0: 5, x1: 8, y1: 7 });
    expect(right.y1 - right.y0).toBe(0);
    expect(right.x1 - right.x0).toBe(2);
    expect(right.x0).toBeGreaterThanOrEqual(8);
  });
  it('자식은 부모 회전을 따라감 (기준점 위치 · 각도)', () => {
    const doc = bar(90);
    doc.parts.push({ id: 'b', name: 'b', w: 1, h: 1, pixels: ['1'], pivot: [0, 0], parent: 'a', at: [0, 1], z: 1 });
    const pose = poseAt(doc, null, 0);
    expect(pose.get('a')).toEqual({ x: 8, y: 8, rot: 90 });
    // 부모 안 (0, -2) → 시계 방향 90° → (2, 0)
    expect(pose.get('b')).toEqual({ x: 10, y: 8, rot: 90 });
  });
  it('모션 움직임은 쉬는 자세에 더함 (x · y · rot)', () => {
    const doc = bar(), m = motion({ a: { x: 3, y: { k: [[0, 0], [7, -4]] }, rot: 90 } });
    expect(poseAt(doc, m, 0).get('a')).toEqual({ x: 11, y: 8, rot: 90 });
    expect(poseAt(doc, m, 7).get('a')).toEqual({ x: 11, y: 4, rot: 90 });
  });
  it('z가 큰 부품이 위에, owner는 그린 부품 번호', () => {
    const doc = bar();
    doc.palette.push('#ff0000');
    doc.parts.push({ id: 'b', name: 'b', w: 1, h: 3, pixels: ['2', '2', '2'], pivot: [0, 3], parent: null, at: [8, 8], z: 1 });
    let r = renderCharFrame(doc, null, 0);
    expect([r.idx[6 * 16 + 8], r.owner[6 * 16 + 8]]).toEqual([2, 1]);
    doc.parts[1].z = -1;
    r = renderCharFrame(doc, null, 0);
    expect([r.idx[6 * 16 + 8], r.owner[6 * 16 + 8]]).toEqual([1, 0]);
    expect(renderCharFrame(doc, null, 0, { hide: ['a'] }).idx[6 * 16 + 8]).toBe(2);
  });
  it('프레임 손질은 뼈대 그림 위에 덮음 (-1 = 투명), edits: false면 뺌', () => {
    const doc = bar(), m = motion();
    setEdit(m, 2, 8, 6, -1); setEdit(m, 2, 0, 0, 0);
    const on = renderCharFrame(doc, m, 2), off = renderCharFrame(doc, m, 2, { edits: false });
    expect([on.idx[6 * 16 + 8], on.idx[0], on.owner[0]]).toEqual([-1, 0, -1]);
    expect([off.idx[6 * 16 + 8], off.idx[0]]).toEqual([1, -1]);
    expect(renderCharFrame(doc, m, 3).idx[6 * 16 + 8]).toBe(1);
  });
});

describe('검사', () => {
  const errs = (fn: (d: CharDoc) => void) => { const d = newChar(); fn(d); return validateChar(d).errors; };
  it('틀린 곳을 짚음', () => {
    expect(validateChar(null).errors).toHaveLength(1);
    expect(errs(d => { d.format = 'x' as CharDoc['format']; })[0]).toMatch(/format/);
    expect(errs(d => { d.parts[0].pixels[0] = 'zz000000..'; })[0]).toMatch(/팔레트 밖/);
    expect(errs(d => { d.parts[0].pixels.pop(); })[0]).toMatch(/12줄/);
    expect(errs(d => { d.parts[0].parent = 'weapon'; })[0]).toMatch(/순환|뿌리/);
    expect(errs(d => { d.parts[1].parent = 'nope'; })[0]).toMatch(/없는 부모/);
    expect(errs(d => { d.parts[1].id = 'body'; })[0]).toMatch(/겹침/);
    expect(errs(d => { d.motions[0].tracks.body = { z: 1 } as never; })[0]).toMatch(/rot · x · y/);
    expect(errs(d => { d.motions[0].edits = { 99: [[0, 0, 1]] }; })[0]).toMatch(/밖/);
    expect(errs(d => { d.motions[0].edits = { 0: [[0, 0, 99]] }; })[0]).toMatch(/틀림/);
    expect(errs(d => { d.motions[0].tracks.body = { rot: { k: [[3, 0], [1, 2]] } }; }).length).toBeGreaterThan(0);
  });
  it('없는 부품 움직임은 경고만', () => {
    const d = newChar(); d.motions[0].tracks.ghost = { rot: 5 };
    expect(validateChar(d)).toMatchObject({ errors: [] });
    expect(validateChar(d).warnings[0]).toMatch(/ghost/);
  });
});

describe('고치기 도우미', () => {
  it('자동 키: 움직임이 없으면 처음 · 끝은 예전 값, 이 프레임에 새 값', () => {
    const m = motion({}, 8);
    setTrackKey(m, 'a', 'rot', 3, 40);
    expect(m.tracks.a.rot).toEqual({ k: [[0, 0, 'linear'], [3, 40, 'linear'], [7, 0]] });
    setTrackKey(m, 'a', 'rot', 5, 10);
    expect(valueAt(m, 'a', 'rot', 5)).toBe(10);
    expect(valueAt(m, 'a', 'rot', 3)).toBe(40);
    setTrackKey(m, 'a', 'x', 0, 2);
    expect(m.tracks.a.x).toEqual({ k: [[0, 2, 'linear'], [7, 0]] });
    // 고정값은 처음 · 끝에 그 값을 남김
    m.tracks.a.y = 4;
    setTrackKey(m, 'a', 'y', 7, 1);
    expect(m.tracks.a.y).toEqual({ k: [[0, 4, 'linear'], [7, 1]] });
  });
  it('손질 한 칸: 더하기 · 바꾸기 · 같으면 그대로 · 빼면 비워짐', () => {
    const m = motion();
    expect(setEdit(m, 1, 2, 3, 4)).toBe(true);
    expect(setEdit(m, 1, 2, 3, 4)).toBe(false);
    expect(setEdit(m, 1, 2, 3, 5)).toBe(true);
    expect(m.edits).toEqual({ 1: [[2, 3, 5]] });
    setEdit(m, 2, 0, 0, -1);
    expect([editCount(m), editCount(m, 1), editCount(m, 4)]).toEqual([2, 1, 0]);
    expect(setEdit(m, 1, 9, 9, null)).toBe(false);
    setEdit(m, 1, 2, 3, null); setEdit(m, 2, 0, 0, null);
    expect(m.edits).toBeUndefined();
  });
  it('부품 그림: 칠하기 · 채우기 · 좌우 뒤집기 두 번 = 그대로', () => {
    const doc = blankChar(), p = doc.parts[0];
    expect(setPixel(p, 0, 0, 2)).toBe(true);
    expect(setPixel(p, 0, 0, 2)).toBe(false);
    expect(setPixel(p, 99, 0, 2)).toBe(false);
    expect(fillPart(p, 3, 3, 3)).toBe(36);
    expect(p.pixels[3]).toBe('03333330');
    const before = clone(doc);
    mirrorPart(doc, 'body');
    expect(doc.parts[0].pixels[0]).toBe('00000002');
    mirrorPart(doc, 'body');
    expect(doc).toEqual(before);
  });
  it('부품 지우기: 자식은 할아버지에 붙고 쉬는 자세 자리는 그대로, 움직임도 뺌', () => {
    const doc = newChar();
    doc.parts.find(p => p.id === 'armR')!.rot = 0;
    const kept = poseAt(doc, null, 0).get('weapon');
    removePart(doc, 'armR');
    expect(doc.parts.find(p => p.id === 'weapon')!.parent).toBe('body');
    expect(poseAt(doc, null, 0).get('weapon')).toMatchObject({ x: kept!.x, y: kept!.y });
    expect(doc.motions.some(m => m.tracks.armR)).toBe(false);
    expect(validateChar(doc).errors).toEqual([]);
  });
  it('부품 id 바꾸기: 자식 부모 · 모션 움직임도 따라감, 겹치거나 틀린 id는 거절', () => {
    const doc = newChar();
    expect(renamePart(doc, 'armR', 'arm-front')).toBeNull();
    expect(doc.parts.find(p => p.id === 'weapon')!.parent).toBe('arm-front');
    expect(doc.motions.find(m => m.id === 'attack')!.tracks['arm-front']).toBeDefined();
    expect(renamePart(doc, 'head', 'body')).toMatch(/이미/);
    expect(renamePart(doc, 'head', 'a b')).toMatch(/id/);
    expect(validateChar(doc).errors).toEqual([]);
  });
  it('부품 복제 · 트리 순서', () => {
    const doc = newChar(), id = duplicatePart(doc, 'armL')!;
    expect(id).toBe('armL2');
    expect(partTree(doc).map(({ p, depth }) => `${p.id}:${depth}`)).toEqual(['body:0', 'head:1', 'armL:1', 'armR:1', 'weapon:2', 'legL:1', 'legR:1', 'armL2:1']);
  });
  it('색 빼기: 그 색은 투명, 뒤 번호는 당김 (손질도)', () => {
    const doc = blankChar(); doc.motions.push(motion());
    setEdit(doc.motions[0], 0, 1, 1, 3); setEdit(doc.motions[0], 0, 2, 2, 1);
    removeColor(doc, 1);
    expect(doc.palette).toHaveLength(3);
    expect(doc.parts[0].pixels[1]).toBe('0......0');
    expect(doc.motions[0].edits![0]).toEqual([[1, 1, 2], [2, 2, -1]]);
  });
  it('캔버스 크기: 뿌리 · 손질이 가운데로 같이 옮겨지고 넘친 손질은 버림', () => {
    const doc = blankChar('b', 32); doc.motions.push(motion());
    setEdit(doc.motions[0], 0, 0, 0, 1); setEdit(doc.motions[0], 0, 20, 20, 1);
    resizeCanvas(doc, 40);
    expect(doc.parts[0].at).toEqual([20, 32]);
    expect(doc.motions[0].edits![0]).toEqual([[4, 4, 1], [24, 24, 1]]);
    resizeCanvas(doc, 24);
    expect(doc.parts[0].at).toEqual([12, 24]);
    expect(doc.motions[0].edits![0]).toEqual([[16, 16, 1]]);
    expect(validateChar(doc).errors).toEqual([]);
  });
  it('장 수 바꾸기: 키는 같은 비율로, 넘친 손질은 버림', () => {
    const m = motion({ a: { rot: { k: [[0, 0], [7, 90]] }, x: 2 } }, 8);
    setEdit(m, 6, 0, 0, 1); setEdit(m, 2, 0, 0, 1);
    retimeMotion(m, 4);
    expect(m.tracks.a).toEqual({ rot: { k: [[0, 0], [3, 90]] }, x: 2 });
    expect(Object.keys(m.edits!)).toEqual(['2']);
  });
});

describe('저장 형식 · 시트', () => {
  it('저장 JSON: 다시 읽으면 같고, 숫자 쌍 · 손질은 한 줄', () => {
    const doc = newChar();
    setEdit(doc.motions[0], 1, 3, 4, 5);
    const text = charJson(doc);
    expect(JSON.parse(text)).toEqual(doc);
    expect(text).toContain('"pivot": [5, 12]');
    expect(text).toContain('[3, 4, 5]');
    expect(text.endsWith('}\n')).toBe(true);
  });
  it('시트: 모션마다 한 줄, 가로는 가장 긴 모션 장 수', () => {
    const doc = newChar(), s = renderCharSheet(doc), n = doc.size;
    expect([s.w, s.h]).toEqual([n * 12, n * 5]);
    expect(s.rgba).toHaveLength(s.w * s.h * 4);
    expect(s.meta).toMatchObject({ format: 'healer.char-sheet@1', size: n });
    expect(s.meta.motions.map(m => [m.id, m.row, m.frames])).toEqual([['idle', 0, 8], ['walk', 1, 8], ['attack', 2, 10], ['cast', 3, 12], ['hit', 4, 6]]);
    // 짧은 모션 뒤 칸은 비어 있음
    const at = (x: number, y: number) => s.rgba[(y * s.w + x) * 4 + 3];
    let any = 0;
    for (let y = 4 * n; y < 5 * n; y++) for (let x = 6 * n; x < 12 * n; x++) any += at(x, y);
    expect(any).toBe(0);
  });
});

describe('저장 · 굽기 창구 (개발 서버)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'fxlab-char-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  it('이름 · 검사가 틀리면 거절', () => {
    expect(() => saveChar('../evil', newChar(), tmp)).toThrow(/이름/);
    expect(() => saveChar('Bad', newChar(), tmp)).toThrow(/이름/);
    expect(() => bakeChar('ok', { ...newChar(), size: 3 }, tmp)).toThrow(/검사 오류/);
  });
  it('저장 → 목록 → 굽기 (PNG 크기 · 시트 JSON)', () => {
    const doc = newChar();
    saveChar('apprentice', doc, tmp);
    expect(JSON.parse(readFileSync(join(tmp, 'apprentice.char.json'), 'utf8'))).toEqual(doc);
    expect(listChars(tmp)).toEqual([{ name: 'apprentice', title: '견습 사제', size: 48, motions: 5, sheet: false }]);
    const r = bakeChar('apprentice', doc, tmp), png = readFileSync(join(tmp, 'apprentice.png'));
    expect([r.w, r.h]).toEqual([48 * 12, 48 * 5]);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([r.w, r.h]);
    expect(JSON.parse(readFileSync(join(tmp, 'apprentice.sheet.json'), 'utf8')).motions).toHaveLength(5);
    expect(listChars(tmp)[0].sheet).toBe(true);
    expect(existsSync(join(tmp, 'apprentice.char.json'))).toBe(true);
  });
  it('폴더가 없으면 빈 목록', () => expect(listChars(join(tmp, 'none'))).toEqual([]));
});
