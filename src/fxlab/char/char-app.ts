// 개발용 이펙트 공방 · 도트 캐릭터 화면 (fx.html?mode=char, Lim 2026-10-12 「도트 캐릭터를 만들어서 움직임 모션을 만들 수 있는 기능」 → 「둘 다」).
// 부품 (머리 · 몸 · 팔 · 다리 …)을 한 번 그리고 → 뼈대 포즈를 프레임마다 키로 잡아 모션을 만들고 → 프레임마다 손으로 픽셀을 고친다 (양파 껍질).
// 저장 = src/art/chars/<이름>.char.json, 시트 굽기 = <이름>.png (모션마다 한 줄) + <이름>.sheet.json. 그리기는 scripts/fxr/char.mjs.
import '../fxlab.css';
import type { Channel, CharDoc, CharMotion, CharPart } from '../../../scripts/fxr/char.mjs';
import { CHAR_LIMITS, charJson, charRgba, poseAt, renderCharFrame, renderCharSheet, validateChar } from '../../../scripts/fxr/char.mjs';
import type { ParamSpec } from '../../../scripts/fxr/render.mjs';
import { type AnimCtx, modeSeg, numericBody } from '../anim-editor';
import { clear, h, modeNav, prefs, toast } from '../dom';
import { paramMode } from '../graph-edit';
import { ask, download, getJson, post } from '../io';
import {
  addPart, blankChar, clearTrack, duplicatePart, editCount, fillPart, mirrorPart, newChar, nextCharId, parentCandidates, partTree, pixelOf, PRESETS, type PresetKey,
  presetMotion, removeColor, removePart, renamePart, resizeCanvas, resizePart, retimeMotion, setEdit, setPixel, setTrackKey, valueAt,
} from './char-doc';

interface Entry { name: string; title: string; size: number; motions: number; sheet: boolean }
interface Draft { file: string; doc: CharDoc; at: number }
type Change = 'doc' | 'load' | 'part' | 'motion' | 'frame' | 'view';
type Mode = 'pose' | 'part' | 'frame';
type Tool = 'rotate' | 'move' | 'pen' | 'erase' | 'pick' | 'fill' | 'pivot' | 'restore';
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CHECK = ['#1d2024', '#2a2d31'];
const TOOLS: Record<Mode, [Tool, string, string][]> = {
  pose: [['rotate', '돌리기', 'R'], ['move', '옮기기', 'M']],
  part: [['pen', '연필', 'B'], ['erase', '지우개', 'E'], ['fill', '채우기', 'G'], ['pick', '스포이트', 'I'], ['pivot', '기준점', 'P']],
  frame: [['pen', '연필', 'B'], ['erase', '투명', 'E'], ['restore', '원래대로', 'X'], ['pick', '스포이트', 'I']],
};
const SPEC: Record<Channel, ParamSpec> = {
  rot: { type: 'num', default: 0, min: -720, max: 720, label: '돌리기 (°)' },
  x: { type: 'num', default: 0, min: -64, max: 64, label: 'x 옮기기' },
  y: { type: 'num', default: 0, min: -64, max: 64, label: 'y 옮기기' },
};

/** 지금 고치는 캐릭터 · 되돌리기 · 고른 부품 · 모션 · 프레임 */
class CharStore {
  file = '';
  saved = '';
  part: string | null = null;
  /** null = 쉬는 자세 (부품 기본값) */
  motion: string | null = null;
  frame = 0;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastKey = '';
  private lastAt = 0;
  private listeners: ((c: Change, from?: string) => void)[] = [];
  constructor(public doc: CharDoc) { this.saved = JSON.stringify(doc); }
  on(fn: (c: Change, from?: string) => void): void { this.listeners.push(fn); }
  emit(c: Change, from?: string): void { for (const fn of this.listeners) fn(c, from); }
  get dirty(): boolean { return JSON.stringify(this.doc) !== this.saved; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get m(): CharMotion | null { return this.motion ? this.doc.motions.find(x => x.id === this.motion) ?? null : null; }
  get p(): CharPart | null { return this.part ? this.doc.parts.find(x => x.id === this.part) ?? null : null; }
  get frames(): number { return this.m?.frames ?? 1; }
  /** 고치기. 같은 key가 이어지면 (한 번 긋기 · 끌기는 'g:' 로 시작하는 같은 key, 그 밖은 1초 안) 되돌리기 한 번으로 */
  edit(fn: (d: CharDoc) => void, key = '', from?: string): void {
    const before = JSON.stringify(this.doc);
    fn(this.doc);
    if (JSON.stringify(this.doc) === before) return;
    const now = Date.now();
    if (!(key && key === this.lastKey && (key.startsWith('g:') || now - this.lastAt < 1000))) this.undoStack.push(before);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.lastKey = key; this.lastAt = now;
    this.redoStack = [];
    this.fix();
    this.emit('doc', from);
  }
  undo(): void { this.step(this.undoStack, this.redoStack); }
  redo(): void { this.step(this.redoStack, this.undoStack); }
  private step(from: string[], to: string[]): void {
    const s = from.pop();
    if (!s) return;
    to.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(s) as CharDoc;
    this.lastKey = '';
    this.fix();
    this.emit('doc');
  }
  /** 지운 부품 · 모션을 고르고 있으면 풀기 */
  private fix(): void {
    if (this.part && !this.p) this.part = null;
    if (this.motion && !this.m) this.motion = null;
    this.frame = Math.min(this.frame, this.frames - 1);
  }
  load(doc: CharDoc, file: string, saved = true): void {
    this.doc = doc; this.file = file; this.saved = saved ? JSON.stringify(doc) : '';
    this.undoStack = []; this.redoStack = []; this.lastKey = '';
    this.part = doc.parts.find(p => p.id === this.part)?.id ?? null;
    this.motion = doc.motions.find(m => m.id === this.motion)?.id ?? doc.motions[0]?.id ?? null;
    this.frame = Math.min(this.frame, this.frames - 1);
    this.emit('load');
  }
  markSaved(file: string): void { this.file = file; this.saved = JSON.stringify(this.doc); this.emit('view'); }
  selectPart(id: string | null): void { if (id !== this.part) { this.part = id; this.emit('part'); } }
  selectMotion(id: string | null): void { if (id !== this.motion) { this.motion = id; this.frame = Math.min(this.frame, this.frames - 1); this.emit('motion'); } }
  setFrame(f: number): void {
    const n = this.frames, v = ((Math.round(f) % n) + n) % n;
    if (v !== this.frame) { this.frame = v; this.emit('frame'); }
  }
}

const rgbaCanvas = (doc: CharDoc, idx: Int16Array) => {
  const n = doc.size, c = h('canvas', { width: n, height: n });
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(charRgba(doc, idx).buffer as ArrayBuffer), n, n), 0, 0);
  return c;
};
const paintChecker = (g: CanvasRenderingContext2D, W: number, H: number, cell: number) => {
  for (let y = 0; y * cell < H; y++) for (let x = 0; x * cell < W; x++) { g.fillStyle = CHECK[(x + y) & 1]; g.fillRect(x * cell, y * cell, cell, cell); }
};

/** 가운데 큰 그림판: 포즈 (뼈대 돌리기 · 옮기기) · 부품 그리기 · 프레임 손질 */
class CharEditor {
  readonly el: HTMLElement;
  readonly canvas = h('canvas', { class: 'ch-canvas', 'aria-label': '캐릭터 그림판' });
  private area = h('div', { class: 'ch-area' });
  private toolBar = h('div', { class: 'fx-seg ch-tools', role: 'group', 'aria-label': '도구' });
  private modeBar = h('div', { class: 'fx-seg ch-modes', role: 'group', 'aria-label': '그림판' });
  private palBar = h('div', { class: 'ch-pal', role: 'listbox', 'aria-label': '팔레트' });
  private hint = h('div', { class: 'ch-hint' });
  private colorInput = h('input', { type: 'color', class: 'ch-color-input', 'aria-label': '고른 색 바꾸기' });
  mode: Mode = prefs.get<Mode>('chMode', 'pose');
  tools: Record<Mode, Tool> = prefs.get('chTools', { pose: 'rotate', part: 'pen', frame: 'pen' } as Record<Mode, Tool>);
  color = 1;
  onion = prefs.get('chOnion', true);
  grid = prefs.get('chGrid', true);
  private z = 8;
  /** 부품 그리기 그림판 둘레 여백 (기준점 표시가 가장자리에서 안 잘리게) */
  private pad = 0;
  private gesture = 0;
  private drag: null | { kind: 'paint'; last: [number, number] | null } | { kind: 'pivot' } | { kind: 'rotate'; pid: string; cx: number; cy: number; a0: number; v0: number; moved: boolean }
    | { kind: 'move'; pid: string; sx: number; sy: number; x0: number; y0: number; prot: number; moved: boolean } = null;
  onBeforeEdit: () => void = () => {};

  constructor(private store: CharStore) {
    const chk = (label: string, on: boolean, set: (v: boolean) => void, title = '') => h('label', { class: 'fx-check small', title }, h('input', { type: 'checkbox', checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);
    this.el = h('div', { class: 'ch-editor' },
      h('div', { class: 'fx-graph-bar ch-bar' }, this.modeBar, this.toolBar,
        chk('양파 껍질', this.onion, v => { this.onion = v; prefs.set('chOnion', v); this.render(); }, '앞 · 뒤 프레임을 흐리게 (O)'),
        chk('격자', this.grid, v => { this.grid = v; prefs.set('chGrid', v); this.render(); })),
      this.area, this.hint, h('div', { class: 'ch-pal-row' }, this.palBar, this.colorInput));
    this.area.append(this.canvas);
    this.canvas.addEventListener('pointerdown', e => this.down(e));
    this.canvas.addEventListener('pointermove', e => this.move(e));
    this.canvas.addEventListener('pointerup', e => this.up(e));
    this.canvas.addEventListener('pointercancel', e => this.up(e));
    this.colorInput.addEventListener('input', () => {
      const i = this.color;
      if (i >= 0) store.edit(d => { d.palette[i] = this.colorInput.value; }, `pal:${i}`, 'palette');
      this.renderPalette(); this.render();
    });
    new ResizeObserver(() => this.render()).observe(this.area);
    this.renderBars();
  }

  get doc(): CharDoc { return this.store.doc; }
  get tool(): Tool { return this.tools[this.mode]; }
  setMode(m: Mode): void { this.mode = m; prefs.set('chMode', m); this.renderBars(); this.render(); }
  setTool(t: Tool): void {
    const mode = (Object.keys(TOOLS) as Mode[]).find(m => m === this.mode && TOOLS[m].some(x => x[0] === t)) ?? (Object.keys(TOOLS) as Mode[]).find(m => TOOLS[m].some(x => x[0] === t));
    if (!mode) return;
    if (mode !== this.mode) this.mode = mode;
    this.tools[mode] = t; prefs.set('chTools', this.tools); prefs.set('chMode', this.mode);
    this.renderBars(); this.render();
  }

  renderBars(): void {
    clear(this.modeBar); clear(this.toolBar);
    for (const [m, label, key] of [['pose', '포즈', '1'], ['part', '부품 그리기', '2'], ['frame', '프레임 손질', '3']] as [Mode, string, string][])
      this.modeBar.append(h('button', { type: 'button', class: m === this.mode ? 'on' : '', title: `${label} (${key})`, onclick: () => this.setMode(m) }, label));
    for (const [t, label, key] of TOOLS[this.mode])
      this.toolBar.append(h('button', { type: 'button', class: t === this.tool ? 'on' : '', title: `${label} (${key})`, onclick: () => this.setTool(t) }, label));
    this.hint.textContent = this.mode === 'pose'
      ? '부품을 눌러 고르고 끌면 그 프레임에 키가 들어가요 (돌리기: 기준점 둘레로, Shift = 15°씩 · 옮기기: 부모 방향 기준). 「쉬는 자세」에선 부품 기본값이 바뀌어요.'
      : this.mode === 'part' ? '고른 부품 그림을 그려요. 모든 프레임에 같이 바뀌어요. 금색 + = 기준점 (돌리는 중심), 파란 점 = 자식 부품이 붙는 자리.'
        : '이 프레임만 손으로 고쳐요 (뼈대 그림 위에 덮음). 「원래대로」는 손질을 빼요. 빨강 = 앞 프레임, 파랑 = 뒤 프레임.';
    this.renderPalette();
  }
  renderPalette(): void {
    clear(this.palBar);
    this.doc.palette.forEach((c, i) => this.palBar.append(h('button', {
      type: 'button', class: `ch-sw${i === this.color ? ' on' : ''}`, role: 'option', 'aria-selected': String(i === this.color), title: `${i.toString(36)} · ${c} (두 번 누르면 색 바꾸기)`,
      style: { background: c }, onclick: () => { this.color = i; this.renderPalette(); }, ondblclick: () => { this.color = i; this.colorInput.value = c; this.colorInput.click(); },
    }, i.toString(36))));
    this.colorInput.value = this.doc.palette[this.color] ?? '#ffffff';
    this.palBar.append(...[
      h('button', { type: 'button', class: 'fx-btn tiny', title: '고른 색 바꾸기', onclick: () => this.colorInput.click() }, '색 바꾸기'),
      this.doc.palette.length < CHAR_LIMITS.palette ? h('button', { type: 'button', class: 'fx-btn tiny', title: '고른 색을 하나 더', onclick: () => {
        this.store.edit(d => { d.palette.push(d.palette[this.color] ?? '#ffffff'); });
        this.color = this.doc.palette.length - 1; this.renderPalette();
      } }, '+') : null,
      this.doc.palette.length > 1 ? h('button', { type: 'button', class: 'fx-btn tiny', title: '고른 색 빼기 (그 색 픽셀은 투명)', onclick: async () => {
        const i = this.color;
        if ((await ask('색 빼기', [`${i.toString(36)}번 색 (${this.doc.palette[i]})을 빼요. 이 색 픽셀은 투명해지고 뒤 번호는 하나씩 당겨져요.`], [{ label: '빼기', value: 'y', kind: 'danger' }])) !== 'y') return;
        this.store.edit(d => removeColor(d, i));
        this.color = Math.max(0, Math.min(this.color, this.doc.palette.length - 1)); this.renderPalette();
      } }, '−') : null,
    ].filter(b => b !== null));
  }

  /** 그림판 크기 (맞춤 배율) */
  private fit(W: number, H: number, max: number): number {
    const r = this.area.getBoundingClientRect();
    return Math.max(2, Math.min(max, Math.floor(Math.min((r.width - 24) / W, (r.height - 24) / H))));
  }

  render(): void {
    const g = this.canvas.getContext('2d')!;
    if (this.mode === 'part') return this.renderPart(g);
    const doc = this.doc, n = doc.size, z = (this.z = this.fit(n, n, 24)), m = this.store.m, f = this.store.frame;
    this.pad = 0;
    this.canvas.width = n * z; this.canvas.height = n * z;
    g.imageSmoothingEnabled = false;
    paintChecker(g, n * z, n * z, 4 * z);
    if (this.onion && m && m.frames > 1) {
      const tint = (frame: number, color: string) => {
        const { idx } = renderCharFrame(doc, m, frame);
        g.fillStyle = color;
        for (let i = 0; i < idx.length; i++) if (idx[i] >= 0) g.fillRect((i % n) * z, Math.floor(i / n) * z, z, z);
      };
      if (f > 0 || m.loop) tint((f - 1 + m.frames) % m.frames, 'rgba(255,96,96,0.28)');
      if (f < m.frames - 1 || m.loop) tint((f + 1) % m.frames, 'rgba(96,170,255,0.28)');
    }
    const { idx, owner } = renderCharFrame(doc, m, f);
    g.drawImage(rgbaCanvas(doc, idx), 0, 0, n * z, n * z);
    if (this.grid && z >= 6) {
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < n; i++) { g.moveTo(i * z + 0.5, 0); g.lineTo(i * z + 0.5, n * z); g.moveTo(0, i * z + 0.5); g.lineTo(n * z, i * z + 0.5); }
      g.stroke();
    }
    // 고른 부품 테두리
    const sel = this.store.p ? doc.parts.indexOf(this.store.p) : -1;
    if (sel >= 0) {
      g.strokeStyle = '#f0b840'; g.lineWidth = 2; g.beginPath();
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (owner[y * n + x] !== sel) continue;
        const o = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= n || yy >= n || owner[yy * n + xx] !== sel;
        if (o(x - 1, y)) { g.moveTo(x * z, y * z); g.lineTo(x * z, (y + 1) * z); }
        if (o(x + 1, y)) { g.moveTo((x + 1) * z, y * z); g.lineTo((x + 1) * z, (y + 1) * z); }
        if (o(x, y - 1)) { g.moveTo(x * z, y * z); g.lineTo((x + 1) * z, y * z); }
        if (o(x, y + 1)) { g.moveTo(x * z, (y + 1) * z); g.lineTo((x + 1) * z, (y + 1) * z); }
      }
      g.stroke();
    }
    if (this.mode === 'pose') {
      // 뼈대: 부모 기준점 → 자식 기준점, 기준점마다 점
      const pose = poseAt(doc, m, f);
      g.lineWidth = 2; g.strokeStyle = 'rgba(108,196,240,0.75)';
      for (const p of doc.parts) {
        const a = pose.get(p.id), b = p.parent ? pose.get(p.parent) : undefined;
        if (a && b) { g.beginPath(); g.moveTo(b.x * z, b.y * z); g.lineTo(a.x * z, a.y * z); g.stroke(); }
      }
      for (const p of doc.parts) {
        const a = pose.get(p.id)!, on = p.id === this.store.part;
        g.fillStyle = on ? '#f0b840' : '#6cc4f0'; g.strokeStyle = '#0b0d10'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(a.x * z, a.y * z, on ? 6 : 4, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
    if (this.mode === 'frame' && m) {
      g.fillStyle = '#ffffff';
      for (const [x, y] of m.edits?.[String(f)] ?? []) { g.fillRect(x * z, y * z, Math.max(2, z / 4), Math.max(2, z / 4)); }
    }
  }
  private renderPart(g: CanvasRenderingContext2D): void {
    const p = this.store.p;
    this.pad = 0;
    if (!p) {
      this.canvas.width = 320; this.canvas.height = 80;
      g.fillStyle = '#98a1b0'; g.font = '14px sans-serif'; g.fillText('오른쪽 목록이나 포즈 그림판에서 부품을 고르세요', 12, 44);
      return;
    }
    const pad = (this.pad = 14), z = (this.z = this.fit(p.w + 1, p.h + 1, 40)), W = p.w * z, H = p.h * z;
    this.canvas.width = W + pad * 2; this.canvas.height = H + pad * 2;
    g.translate(pad, pad);
    paintChecker(g, W, H, z);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const c = pixelOf(p, x, y);
      if (c < 0) continue;
      g.fillStyle = this.doc.palette[c] ?? '#ff00ff'; g.fillRect(x * z, y * z, z, z);
    }
    if (this.grid) {
      g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < p.w; i++) { g.moveTo(i * z + 0.5, 0); g.lineTo(i * z + 0.5, H); }
      for (let i = 1; i < p.h; i++) { g.moveTo(0, i * z + 0.5); g.lineTo(W, i * z + 0.5); }
      g.stroke();
    }
    g.fillStyle = '#6cc4f0';
    for (const c of this.doc.parts) if (c.parent === p.id) { g.beginPath(); g.arc(c.at[0] * z, c.at[1] * z, 5, 0, Math.PI * 2); g.fill(); }
    const [px, py] = [p.pivot[0] * z, p.pivot[1] * z];
    g.strokeStyle = '#0b0d10'; g.lineWidth = 5; g.beginPath(); g.moveTo(px - 10, py); g.lineTo(px + 10, py); g.moveTo(px, py - 10); g.lineTo(px, py + 10); g.stroke();
    g.strokeStyle = '#f0b840'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px - 9, py); g.lineTo(px + 9, py); g.moveTo(px, py - 9); g.lineTo(px, py + 9); g.stroke();
  }

  /** 포인터 → 그림판 좌표 (그림 픽셀 단위, 소수) */
  private at(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [(((e.clientX - r.left) / r.width) * this.canvas.width - this.pad) / this.z, (((e.clientY - r.top) / r.height) * this.canvas.height - this.pad) / this.z];
  }
  /** 기준점: 반 칸 단위 (픽셀 모서리 · 가운데) */
  private setPivot(fx: number, fy: number): void {
    const pid = this.store.part;
    if (!pid) return;
    this.store.edit(doc => {
      const p = doc.parts.find(q => q.id === pid)!;
      p.pivot = [Math.max(0, Math.min(p.w, Math.round(fx * 2) / 2)), Math.max(0, Math.min(p.h, Math.round(fy * 2) / 2))];
    }, `g:${this.gesture}`, 'editor');
  }
  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.onBeforeEdit();
    this.gesture++;
    const [fx, fy] = this.at(e), x = Math.floor(fx), y = Math.floor(fy), doc = this.doc, m = this.store.m, f = this.store.frame;
    if (this.mode === 'pose') {
      const pose = poseAt(doc, m, f);
      // 기준점 가까이 누르면 그 부품, 아니면 그 픽셀을 그린 부품
      const near = doc.parts.map(p => ({ p, d: Math.hypot(pose.get(p.id)!.x - fx, pose.get(p.id)!.y - fy) })).filter(o => o.d < 1.6).sort((a, b) => a.d - b.d)[0]?.p;
      const own = x >= 0 && y >= 0 && x < doc.size && y < doc.size ? renderCharFrame(doc, m, f).owner[y * doc.size + x] : -1;
      const hit = near ?? (own >= 0 ? doc.parts[own] : undefined);
      if (hit) this.store.selectPart(hit.id);
      const p = this.store.p;
      if (!p) return;
      const q = pose.get(p.id)!;
      if (this.tool === 'rotate') this.drag = { kind: 'rotate', pid: p.id, cx: q.x, cy: q.y, a0: Math.atan2(fy - q.y, fx - q.x), v0: m ? valueAt(m, p.id, 'rot', f) : p.rot ?? 0, moved: false };
      else this.drag = { kind: 'move', pid: p.id, sx: fx, sy: fy, x0: m ? valueAt(m, p.id, 'x', f) : p.at[0], y0: m ? valueAt(m, p.id, 'y', f) : p.at[1], prot: p.parent ? pose.get(p.parent)?.rot ?? 0 : 0, moved: false };
      return;
    }
    if (this.tool === 'pick') { this.pick(x, y); return; }
    if (this.mode === 'part' && this.tool === 'pivot') { this.drag = { kind: 'pivot' }; this.setPivot(fx, fy); return; }
    this.drag = { kind: 'paint', last: null };
    this.paint(x, y);
  }
  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const [fx, fy] = this.at(e), m = this.store.m, f = this.store.frame;
    if (d.kind === 'paint') { this.paint(Math.floor(fx), Math.floor(fy)); return; }
    if (d.kind === 'pivot') { this.setPivot(fx, fy); return; }
    if (d.kind === 'rotate') {
      let deg = d.v0 + ((Math.atan2(fy - d.cy, fx - d.cx) - d.a0) * 180) / Math.PI;
      deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      if (!d.moved && Math.abs(deg - d.v0) < 1) return;
      d.moved = true;
      this.store.edit(doc => {
        if (m) setTrackKey(doc.motions.find(x => x.id === m.id)!, d.pid, 'rot', f, deg);
        else { const p = doc.parts.find(x => x.id === d.pid); if (p) p.rot = deg; }
      }, `g:${this.gesture}`, 'editor');
      return;
    }
    const a = (-d.prot * Math.PI) / 180, dx = fx - d.sx, dy = fy - d.sy;
    const lx = Math.round(Math.cos(a) * dx - Math.sin(a) * dy), ly = Math.round(Math.sin(a) * dx + Math.cos(a) * dy);
    if (!d.moved && !lx && !ly) return;
    d.moved = true;
    this.store.edit(doc => {
      if (m) { const mm = doc.motions.find(x => x.id === m.id)!; setTrackKey(mm, d.pid, 'x', f, d.x0 + lx); setTrackKey(mm, d.pid, 'y', f, d.y0 + ly); }
      else { const p = doc.parts.find(x => x.id === d.pid); if (p) p.at = [d.x0 + lx, d.y0 + ly]; }
    }, `g:${this.gesture}`, 'editor');
  }
  private up(e: PointerEvent): void {
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.drag = null;
  }
  private pick(x: number, y: number): void {
    const c = this.mode === 'part' ? (this.store.p ? pixelOf(this.store.p, x, y) : -1)
      : x >= 0 && y >= 0 && x < this.doc.size && y < this.doc.size ? renderCharFrame(this.doc, this.store.m, this.store.frame).idx[y * this.doc.size + x] : -1;
    if (c >= 0) { this.color = c; this.renderPalette(); toast(`색 ${c.toString(36)} (${this.doc.palette[c]})`, 'info', 1200); }
  }
  /** 한 칸 (끌면 사이 칸도) 칠하기 */
  private paint(x: number, y: number): void {
    const d = this.drag;
    if (!d || d.kind !== 'paint') return;
    const pts: [number, number][] = [];
    const [x0, y0] = d.last ?? [x, y], steps = Math.max(Math.abs(x - x0), Math.abs(y - y0), 1);
    for (let i = d.last ? 1 : 0; i <= steps; i++) pts.push([Math.round(x0 + ((x - x0) * i) / steps), Math.round(y0 + ((y - y0) * i) / steps)]);
    d.last = [x, y];
    const key = `g:${this.gesture}`, tool = this.tool, c = this.color;
    if (this.mode === 'part') {
      const pid = this.store.part;
      if (!pid) return;
      this.store.edit(doc => {
        const p = doc.parts.find(q => q.id === pid)!;
        for (const [px, py] of pts) {
          if (tool === 'fill') fillPart(p, px, py, c);
          else setPixel(p, px, py, tool === 'erase' ? -1 : c);
        }
      }, key, 'editor');
      return;
    }
    const m = this.store.m;
    if (this.mode !== 'frame' || !m) { if (!m) toast('프레임 손질은 모션을 고른 뒤에 (쉬는 자세는 「부품 그리기」로)', 'err'); this.drag = null; return; }
    const n = this.doc.size, f = this.store.frame;
    this.store.edit(doc => {
      const mm = doc.motions.find(q => q.id === m.id)!;
      for (const [px, py] of pts) if (px >= 0 && py >= 0 && px < n && py < n) setEdit(mm, f, px, py, tool === 'restore' ? null : tool === 'erase' ? -1 : c);
    }, key, 'editor');
  }
}

/** 왼쪽: 미리보기 (재생) · 모션 · 프레임 줄 */
class CharPreview {
  readonly el: HTMLElement;
  private cv = h('canvas', { class: 'fx-canvas', 'aria-label': '캐릭터 미리보기' });
  private slider = h('input', { type: 'range', min: 0, max: 0, step: 1, value: 0, 'aria-label': '프레임' });
  private label = h('span', { class: 'fx-frame-num' });
  private playBtn = h('button', { class: 'fx-btn icon', type: 'button', title: '재생 / 멈춤 (Space)' });
  private film = h('div', { class: 'fx-film', role: 'list', 'aria-label': '프레임' });
  private cells: HTMLCanvasElement[] = [];
  playing = prefs.get('chPlaying', true);
  bg = prefs.get<'checker' | 'dark' | 'light'>('chBg', 'dark');
  speed = prefs.get('chSpeed', 1);
  private last = 0;
  private acc = 0;
  constructor(private store: CharStore) {
    const btn = (t: string, title: string, fn: () => void) => h('button', { class: 'fx-btn icon', type: 'button', title, 'aria-label': title, onclick: fn }, t);
    const sel = <T extends string | number>(label: string, value: T, opts: [T, string][], set: (v: T) => void) => h('label', { class: 'fx-field' }, h('span', {}, label),
      h('select', { onchange: (e: Event) => { const raw = (e.target as HTMLSelectElement).value; set((typeof value === 'number' ? Number(raw) : raw) as T); } }, ...opts.map(([v, t]) => h('option', { value: String(v), selected: v === value }, t))));
    this.slider.addEventListener('input', () => { this.pause(); store.setFrame(Number(this.slider.value)); });
    this.playBtn.addEventListener('click', () => this.toggle());
    this.el = h('section', { class: 'fx-preview', 'aria-label': '미리보기' },
      h('div', { class: 'fx-stage ch-stage' }, h('div', { class: 'fx-view' }, this.cv)),
      h('div', { class: 'fx-transport' }, this.playBtn, btn('⏮', '처음 프레임', () => { this.pause(); store.setFrame(0); }), btn('◀', '앞 프레임 (←)', () => this.step(-1)), btn('▶', '다음 프레임 (→)', () => this.step(1)),
        h('div', { class: 'fx-slider' }, this.slider), this.label),
      h('div', { class: 'fx-opts' },
        sel('배경', this.bg, [['dark', '어둡게'], ['checker', '체커'], ['light', '밝게']], v => { this.bg = v; prefs.set('chBg', v); this.draw(); this.drawFilm(); }),
        sel('빠르기', this.speed, [[1, '1×'], [0.5, '½×'], [0.25, '¼×']], v => { this.speed = v; prefs.set('chSpeed', v); })),
      h('div', { class: 'fx-film-head' }, h('b', {}, '프레임'), h('span', { class: 'fx-muted' }, '눌러서 이동 · 흰 점 = 손질한 프레임')),
      this.film);
    this.sync();
    requestAnimationFrame(t => this.tick(t));
  }
  private paint(c: HTMLCanvasElement, frame: number, W: number): void {
    const doc = this.store.doc, g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    if (this.bg === 'checker') paintChecker(g, W, W, W / 8); else { g.fillStyle = this.bg === 'dark' ? '#15120e' : '#ece6da'; g.fillRect(0, 0, W, W); }
    g.drawImage(rgbaCanvas(doc, renderCharFrame(doc, this.store.m, frame).idx), 0, 0, W, W);
  }
  draw(): void {
    const n = this.store.doc.size, f = this.store.frame, frames = this.store.frames;
    const z = Math.max(1, Math.floor(Math.min(320, this.el.clientWidth || 320) / n)), W = n * z;
    if (this.cv.width !== W) { this.cv.width = W; this.cv.height = W; }
    this.paint(this.cv, f, W);
    this.slider.max = String(frames - 1); this.slider.value = String(f);
    this.label.textContent = `${f} / ${frames - 1}`;
    for (const [i, c] of this.cells.entries()) c.classList.toggle('on', i === f);
  }
  drawFilm(): void {
    clear(this.film);
    const m = this.store.m, n = this.store.doc.size;
    this.cells = Array.from({ length: this.store.frames }, (_, i) => {
      const c = h('canvas', { width: n, height: n, class: 'fx-film-cell', title: `프레임 ${i}` });
      this.paint(c, i, n);
      c.addEventListener('click', () => { this.pause(); this.store.setFrame(i); });
      this.film.append(h('div', { class: 'fx-film-item' }, c, h('span', {}, `${i}${m && editCount(m, i) ? ' •' : ''}`)));
      return c;
    });
    this.draw();
  }
  play(): void { this.playing = true; prefs.set('chPlaying', true); this.acc = 0; this.sync(); }
  pause(): void { this.playing = false; prefs.set('chPlaying', false); this.sync(); }
  toggle(): void { if (this.playing) this.pause(); else this.play(); }
  step(d: number): void { this.pause(); this.store.setFrame(this.store.frame + d); }
  private sync(): void { this.playBtn.textContent = this.playing ? '❚❚' : '▶'; this.playBtn.classList.toggle('on', this.playing); }
  private tick(t: number): void {
    const dt = this.last ? Math.min(250, t - this.last) : 0;
    this.last = t;
    const m = this.store.m;
    if (this.playing && m && m.frames > 1) {
      const per = 1000 / (m.fps * this.speed);
      this.acc += dt;
      while (this.acc >= per) {
        this.acc -= per;
        if (this.store.frame + 1 >= m.frames) {
          if (m.loop) this.store.setFrame(0);
          else { this.acc = -400; this.store.setFrame(0); } // 한 번짜리 모션도 미리보기는 잠깐 쉬고 다시
        } else this.store.setFrame(this.store.frame + 1);
      }
    }
    requestAnimationFrame(x => this.tick(x));
  }
}

export async function bootChar(app: HTMLElement): Promise<void> {
  let list: Entry[];
  try { list = await getJson<Entry[]>('/__fx/chars'); } catch {
    app.replaceChildren(h('p', { class: 'fx-fatal' }, '개발 서버에서 열어 주세요: 저장소에서 ', h('code', {}, 'npm run fx'), ' (저장 · 굽기 창구 /__fx 가 없음)'));
    return;
  }
  const store = new CharStore(newChar());
  const editor = new CharEditor(store), preview = new CharPreview(store);
  const ins = h('section', { class: 'fx-inspector', 'aria-label': '부품 · 움직임' });
  const motionBox = h('section', { class: 'ch-motions', 'aria-label': '모션' });
  const checksEl = h('ul', { class: 'fx-checks' });
  const banner = h('div', { class: 'fx-banner', hidden: true });
  const picker = h('select', { class: 'fx-picker', 'aria-label': '캐릭터 고르기' });
  const dirtyEl = h('span', { class: 'fx-dirty', hidden: true }, '● 저장 안 함');
  const undoBtn = h('button', { class: 'fx-btn icon', type: 'button', title: '되돌리기 (Ctrl Z)', 'aria-label': '되돌리기', onclick: () => store.undo() }, '↶');
  const redoBtn = h('button', { class: 'fx-btn icon', type: 'button', title: '다시 (Ctrl Shift Z)', 'aria-label': '다시', onclick: () => store.redo() }, '↷');
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  let cursors: (() => void)[] = [], pendingName = '', frameInfo: (() => void) | null = null;

  // ── 오른쪽: 캐릭터 · 부품 · 움직임 ──
  const field = (label: string, el: HTMLElement, hint = '') => h('label', { class: 'fx-field wide', title: hint }, h('span', {}, label), el);
  const num = (value: number, min: number, max: number, onChange: (x: number) => void, label: string, step = 1) => {
    const el = h('input', { type: 'number', value: String(value), min, max, step, 'aria-label': label });
    el.addEventListener('change', () => {
      const x = Number(el.value);
      if (!Number.isFinite(x) || x < min || x > max) { toast(`${label}: ${min}–${max}`, 'err'); el.value = String(value); return; }
      onChange(x);
    });
    return el;
  };
  const pair = (a: HTMLElement, b: HTMLElement) => h('div', { class: 'fx-row' }, a, b);
  const renderIns = () => {
    const top = ins.scrollTop, act = document.activeElement, focus = act && ins.contains(act) ? act.getAttribute('aria-label') : null;
    clear(ins);
    cursors = [];
    const doc = store.doc, p = store.p, m = store.m;
    const nameIn = h('input', { value: doc.name, maxlength: 60, 'aria-label': '캐릭터 이름' });
    nameIn.addEventListener('change', () => store.edit(d => { d.name = nameIn.value.trim() || d.name; }));
    ins.append(h('div', { class: 'fx-ins-head' }, h('div', {}, h('h2', {}, '캐릭터'), h('span', { class: 'fx-muted' }, store.file ? `src/art/chars/${store.file}.char.json` : '저장 안 한 새 캐릭터'))),
      field('이름', nameIn),
      field('캔버스', num(doc.size, CHAR_LIMITS.size[0], CHAR_LIMITS.size[1], x => store.edit(d => resizeCanvas(d, x)), '캔버스 크기'), '정사각 px (가운데 기준으로 늘고 줄어요)'));
    // 부품 목록
    const tree = h('ul', { class: 'ch-tree', role: 'listbox', 'aria-label': '부품' }, ...partTree(doc).map(({ p: q, depth }) => h('li', {
      class: q.id === store.part ? 'on' : '', role: 'option', 'aria-selected': String(q.id === store.part), style: { paddingLeft: `${8 + depth * 14}px` }, onclick: () => store.selectPart(q.id === store.part ? null : q.id),
    }, h('span', {}, q.name), h('code', {}, q.id), h('span', { class: 'fx-muted small' }, `z ${q.z}`))));
    ins.append(h('h3', { class: 'ch-h3' }, '부품', h('span', { class: 'fx-row' },
      h('button', { class: 'fx-btn tiny', type: 'button', title: '고른 부품에 붙는 새 부품 (없으면 뿌리)', onclick: () => { let id = ''; store.edit(d => { id = addPart(d, store.part); }); store.selectPart(id); editor.setMode('part'); } }, '+ 부품'))), tree);
    if (p) {
      const idIn = h('input', { class: 'fx-id', value: p.id, spellcheck: false, 'aria-label': '부품 id' });
      idIn.addEventListener('change', () => { let err: string | null = null; const to = idIn.value.trim(); store.edit(d => { err = renamePart(d, p.id, to); }); if (err) { toast(`id를 못 바꿈: ${err}`, 'err'); idIn.value = p.id; } else store.selectPart(to); });
      const pname = h('input', { value: p.name, 'aria-label': '부품 이름' });
      pname.addEventListener('change', () => store.edit(d => { const q = d.parts.find(x => x.id === p.id); if (q) q.name = pname.value.trim() || q.name; }));
      const parent = h('select', { 'aria-label': '부모' }, h('option', { value: '' }, '(없음, 캔버스에)'), ...parentCandidates(doc, p.id).map(c => h('option', { value: c.id, selected: c.id === p.parent }, `${c.name} · ${c.id}`)));
      parent.addEventListener('change', () => store.edit(d => { const q = d.parts.find(x => x.id === p.id)!; const to = parent.value || null; const par = to ? d.parts.find(x => x.id === to)! : null; q.parent = to; q.at = par ? [Math.round(par.w / 2), Math.round(par.h / 2)] : [d.size / 2, d.size / 2]; }));
      const set = (fn: (q: CharPart) => void) => store.edit(d => { const q = d.parts.find(x => x.id === p.id); if (q) fn(q); });
      ins.append(h('div', { class: 'ch-part' },
        h('div', { class: 'fx-ins-head' }, h('div', {}, h('h2', {}, p.name), h('span', { class: 'fx-muted' }, `${p.w}×${p.h}`)),
          h('div', { class: 'fx-row' },
            h('button', { class: 'fx-btn tiny', type: 'button', onclick: () => { let id: string | null = null; store.edit(d => { id = duplicatePart(d, p.id); }); if (id) store.selectPart(id); } }, '복제'),
            h('button', { class: 'fx-btn tiny', type: 'button', title: '그림 좌우 뒤집기', onclick: () => store.edit(d => mirrorPart(d, p.id)) }, '좌우'),
            h('button', { class: 'fx-btn tiny danger', type: 'button', onclick: () => { store.edit(d => removePart(d, p.id)); store.selectPart(null); } }, '지우기'))),
        field('id', idIn), field('이름', pname), field('부모', parent),
        field('붙는 자리', pair(num(p.at[0], -128, 256, x => set(q => { q.at = [x, q.at[1]]; }), '붙는 자리 x', 0.5), num(p.at[1], -128, 256, x => set(q => { q.at = [q.at[0], x]; }), '붙는 자리 y', 0.5)), '부모 그림 안 자리 (부모가 없으면 캔버스 자리)'),
        field('기준점', pair(num(p.pivot[0], 0, p.w, x => set(q => { q.pivot = [x, q.pivot[1]]; }), '기준점 x', 0.5), num(p.pivot[1], 0, p.h, x => set(q => { q.pivot = [q.pivot[0], x]; }), '기준점 y', 0.5)), '이 부품 그림 안 돌리는 중심'),
        field('쉬는 각도', num(p.rot ?? 0, -360, 360, x => set(q => { if (x) q.rot = x; else delete q.rot; }), '쉬는 각도'), '모든 모션의 바탕 각도 (°, 시계 방향 +)'),
        field('순서 z', num(p.z, -99, 99, x => set(q => { q.z = x; }), '그리는 순서'), '클수록 위에 그림'),
        field('크기', pair(num(p.w, 1, CHAR_LIMITS.part, x => set(q => resizePart(q, x, q.h)), '부품 너비'), num(p.h, 1, CHAR_LIMITS.part, x => set(q => resizePart(q, q.w, x)), '부품 높이')), '왼쪽 위 기준'),
      ));
      // 움직임
      if (m) {
        const ctx: AnimCtx = { frames: m.frames, frame: () => store.frame, setFrame: f => store.setFrame(f), cursors, rerender: renderIns };
        ins.append(h('h3', {}, `「${m.name}」 움직임`, h('span', { class: 'fx-muted' }, ' · 쉬는 자세에 더하는 값')));
        for (const ch of ['rot', 'x', 'y'] as Channel[]) {
          const has = m.tracks[p.id]?.[ch] !== undefined, v = m.tracks[p.id]?.[ch] ?? 0;
          const setV = (x: unknown, live = false) => store.edit(d => {
            const mm = d.motions.find(q => q.id === m.id)!;
            if (x === undefined) clearTrack(mm, p.id, ch); else (mm.tracks[p.id] ??= {})[ch] = x as number;
          }, `t:${m.id}.${p.id}.${ch}`, live ? 'ins' : undefined);
          const head = h('div', { class: 'prm-head' }, h('span', { class: 'prm-label' }, SPEC[ch].label!), h('code', {}, ch), modeSeg(v, SPEC[ch], `${p.id} ${ch}`, ctx, setV));
          if (has) head.append(h('button', { class: 'fx-btn tiny', type: 'button', title: '움직임 빼기', onclick: () => setV(undefined) }, '↺'));
          ins.append(h('div', { class: `prm${has ? '' : ' unset'}${paramMode(v) !== 'fixed' ? ' anim' : ''}` }, head, numericBody(v, SPEC[ch], `${p.id} ${ch}`, ctx, setV)));
        }
      } else ins.append(h('p', { class: 'fx-muted small' }, '「쉬는 자세」: 포즈 그림판에서 끌면 부품의 쉬는 각도 · 붙는 자리가 바뀌어요. 모션을 고르면 프레임마다 키가 들어가요.'));
    } else ins.append(h('p', { class: 'fx-muted small' }, '부품을 고르면 크기 · 기준점 · 움직임을 고칠 수 있어요.'));
    ins.append(h('h3', {}, '단축키'), h('ul', { class: 'fx-help' },
      h('li', {}, h('kbd', {}, '1 2 3'), ' 포즈 · 부품 그리기 · 프레임 손질'),
      h('li', {}, h('kbd', {}, 'R M'), ' 돌리기 · 옮기기  ', h('kbd', {}, 'B E G I P X'), ' 연필 · 지우개 · 채우기 · 스포이트 · 기준점 · 원래대로'),
      h('li', {}, h('kbd', {}, 'Space'), ' 재생  ', h('kbd', {}, '← →'), ' 프레임  ', h('kbd', {}, 'O'), ' 양파 껍질  ', h('kbd', {}, 'Ctrl Z'), ' 되돌리기  ', h('kbd', {}, 'Ctrl S'), ' 저장')));
    ins.scrollTop = top;
    if (focus) ins.querySelector<HTMLElement>(`[aria-label="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
  };

  // ── 왼쪽: 모션 ──
  const renderMotions = () => {
    clear(motionBox);
    frameInfo = null;
    const doc = store.doc, m = store.m;
    const chip = (id: string | null, label: string) => h('button', { type: 'button', class: `fx-chip${store.motion === id ? ' on' : ''}`, onclick: () => store.selectMotion(id) }, label);
    const add = h('details', { class: 'fx-menu' }, h('summary', { class: 'fx-chip add' }, '+ 모션'), h('div', { class: 'fx-menu-pop' },
      ...(Object.keys(PRESETS) as PresetKey[]).map(k => h('button', { type: 'button', class: 'fx-menu-item', onclick: () => {
        if (doc.motions.length >= CHAR_LIMITS.motions) { toast(`모션은 최대 ${CHAR_LIMITS.motions}개`, 'err'); return; }
        const id = nextCharId(doc.motions, k);
        store.edit(d => { d.motions.push(presetMotion(d, k, id)); });
        store.selectMotion(id);
        add.open = false;
      } }, `${PRESETS[k]}${k === 'empty' ? '' : ' (기본 움직임)'}`))));
    motionBox.append(h('div', { class: 'fx-film-head' }, h('b', {}, '모션'), h('span', { class: 'fx-muted' }, '쉬는 자세 = 부품 기본값')),
      h('div', { class: 'fx-chips' }, chip(null, '쉬는 자세'), ...doc.motions.map(x => chip(x.id, x.name)), add));
    if (!m) return;
    const name = h('input', { value: m.name, 'aria-label': '모션 이름' });
    name.addEventListener('change', () => store.edit(d => { const x = d.motions.find(q => q.id === m.id); if (x) x.name = name.value.trim() || x.name; }));
    const set = (fn: (x: CharMotion) => void) => store.edit(d => { const x = d.motions.find(q => q.id === m.id); if (x) fn(x); });
    const info = h('span', { class: 'fx-muted small' });
    const clearFrame = h('button', { class: 'fx-btn tiny', type: 'button', title: '이 프레임 손질 모두 빼기', onclick: () => set(q => { if (q.edits) { delete q.edits[String(store.frame)]; if (!Object.keys(q.edits).length) delete q.edits; } }) }, '이 프레임 손질 빼기');
    frameInfo = () => {
      info.textContent = `id ${m.id} · ${(m.frames / m.fps).toFixed(2)}초 · 손질 ${editCount(m)}칸 (이 프레임 ${editCount(m, store.frame)})`;
      clearFrame.disabled = !editCount(m, store.frame);
    };
    frameInfo();
    motionBox.append(h('div', { class: 'ch-motion-grid' },
      field('이름', name),
      field('장 수', num(m.frames, 1, CHAR_LIMITS.frames, x => set(q => retimeMotion(q, x)), '모션 장 수'), '키프레임은 같은 비율로 늘고 줄어요'),
      field('fps', num(m.fps, 1, CHAR_LIMITS.fps, x => set(q => { q.fps = x; }), '모션 fps')),
      field('반복', h('label', { class: 'fx-check' }, h('input', { type: 'checkbox', checked: m.loop, onchange: (e: Event) => set(q => { q.loop = (e.target as HTMLInputElement).checked; }) }), m.loop ? '반복함' : '한 번'))),
    h('div', { class: 'fx-row ch-motion-btns' }, info, clearFrame,
      h('button', { class: 'fx-btn tiny', type: 'button', onclick: () => { const id = nextCharId(doc.motions, m.id.replace(/\d+$/, '')); store.edit(d => { const x = d.motions.find(q => q.id === m.id)!; d.motions.push({ ...structuredClone(x), id, name: `${x.name} 사본` }); }); store.selectMotion(id); } }, '복제'),
      h('button', { class: 'fx-btn tiny danger', type: 'button', onclick: async () => {
        if ((await ask('모션 지우기', [`「${m.name}」 모션을 지울까요? (되돌리기로 살릴 수 있어요)`], [{ label: '지우기', value: 'y', kind: 'danger' }])) !== 'y') return;
        store.edit(d => { d.motions = d.motions.filter(q => q.id !== m.id); });
        store.selectMotion(store.doc.motions[0]?.id ?? null);
      } }, '지우기')));
  };

  // ── 검사 ──
  const showChecks = () => {
    const doc = store.doc, v = validateChar(doc), items: { level: string; text: string }[] = [];
    for (const e of v.errors) items.push({ level: 'err', text: e });
    for (const w of v.warnings) items.push({ level: 'warn', text: w });
    if (!v.errors.length) {
      items.unshift({ level: 'ok', text: '캐릭터 검사 통과' });
      for (const p of doc.parts) if (p.pixels.every(r => /^\.*$/.test(r))) items.push({ level: 'warn', text: `부품 ${p.id}: 그림이 비어 있음` });
      const n = doc.size;
      for (const m of [null, ...doc.motions]) {
        const edge: number[] = [];
        for (let f = 0; f < (m?.frames ?? 1); f++) {
          const { idx } = renderCharFrame(doc, m, f);
          let hit = false;
          for (let i = 0; i < n && !hit; i++) hit = idx[i] >= 0 || idx[(n - 1) * n + i] >= 0 || idx[i * n] >= 0 || idx[i * n + n - 1] >= 0;
          if (hit) edge.push(f);
        }
        if (edge.length) items.push({ level: 'warn', text: `${m ? `모션 ${m.name}` : '쉬는 자세'}: 캔버스 가장자리에 닿음 (프레임 ${edge.slice(0, 6).join(', ')}${edge.length > 6 ? ' …' : ''}) → 잘릴 수 있음` });
      }
      const usedColors = new Set<number>();
      for (const p of doc.parts) for (const r of p.pixels) for (const ch of r) if (ch !== '.') usedColors.add(parseInt(ch, 36));
      for (const m of doc.motions) for (const l of Object.values(m.edits ?? {})) for (const e of l) usedColors.add(e[2]);
      const unused = doc.palette.map((_, i) => i).filter(i => !usedColors.has(i));
      items.push({ level: 'info', text: `부품 ${doc.parts.length}개 · 모션 ${doc.motions.length}개 · 색 ${doc.palette.length}가지${unused.length ? ` (안 쓰는 색 ${unused.map(i => i.toString(36)).join(' ')})` : ''}` });
    }
    clear(checksEl);
    for (const it of items) {
      const mm = /부품 ([A-Za-z0-9_-]+)/.exec(it.text), id = mm && store.doc.parts.some(p => p.id === mm[1]) ? mm[1] : null;
      checksEl.append(h('li', { class: `${it.level}${id ? ' link' : ''}`, onclick: id ? () => store.selectPart(id) : undefined }, it.text));
    }
  };

  // ── 위 막대 ──
  const fillPicker = () => {
    clear(picker);
    picker.append(h('option', { value: '', selected: !store.file }, store.file ? '— 캐릭터 고르기 —' : '(새 캐릭터)'), ...list.map(e => h('option', { value: e.name, selected: e.name === store.file }, `${e.name} · ${e.title}`)));
  };
  const updateTop = () => {
    dirtyEl.hidden = !store.dirty;
    undoBtn.disabled = !store.canUndo; redoBtn.disabled = !store.canRedo;
    document.title = `${store.dirty ? '● ' : ''}${store.file || '새 캐릭터'} · 캐릭터 공방`;
  };
  const setUrl = () => history.replaceState(null, '', `?mode=char${store.file ? `&c=${encodeURIComponent(store.file)}` : ''}`);
  let draftTimer = 0;
  const saveDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => {
      if (store.dirty) prefs.set('charDraft', { file: store.file, doc: store.doc, at: Date.now() } satisfies Draft);
      else if (prefs.get<Draft | null>('charDraft', null)?.file === store.file) prefs.del('charDraft');
    }, 400);
  };
  const confirmDiscard = async () => !store.dirty || (await ask('저장 안 한 고침이 있어요', ['지금 캐릭터의 고친 내용을 버릴까요? (되살리기 판은 남아요)'], [{ label: '버리기', value: 'y', kind: 'danger' }])) === 'y';
  const loadDoc = (doc: CharDoc, file: string, saved: boolean) => {
    store.load(doc, file, saved);
    if (file) prefs.set('lastChar', file);
    setUrl(); fillPicker();
  };
  const openFile = async (name: string) => {
    try { loadDoc(await getJson<CharDoc>(`/__fx/char?name=${encodeURIComponent(name)}`), name, true); offerDraft(); }
    catch (e) { toast(`못 읽음: ${e instanceof Error ? e.message : e}`, 'err'); }
  };
  const offerDraft = () => {
    const d = prefs.get<Draft | null>('charDraft', null);
    if (!d || (d.file === store.file && JSON.stringify(d.doc) === store.saved)) { banner.hidden = true; return; }
    const same = d.file === store.file, when = new Date(d.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const restore = () => { store.edit(doc => { Object.assign(doc, structuredClone(d.doc)); }); banner.hidden = true; };
    banner.replaceChildren(h('div', { class: 'fx-row' }, h('span', {}, `저장 안 한 고친 판이 있어요: ${d.file || '새 캐릭터'} (${when})`),
      h('button', { class: 'fx-btn primary', type: 'button', onclick: async () => {
        if (same) { restore(); return; }
        if (!(await confirmDiscard())) return;
        if (d.file) await openFile(d.file); else loadDoc(newChar(), '', false);
        restore();
      } }, same ? '되살리기' : '열어서 되살리기'),
      h('button', { class: 'fx-btn', type: 'button', onclick: () => { prefs.del('charDraft'); banner.hidden = true; } }, '버리기')));
    banner.hidden = false;
  };
  const importText = async (text: string, hint = '') => {
    let doc: CharDoc;
    try {
      doc = JSON.parse(text) as CharDoc;
      const v = validateChar(doc);
      if (v.errors.length) throw new Error(`${v.errors.length}개 오류: ${v.errors[0]}`);
    } catch (e) { toast(`캐릭터 JSON을 못 읽음: ${e instanceof Error ? e.message : e}`, 'err', 6000); return; }
    if (!(await confirmDiscard())) return;
    loadDoc(doc, '', false);
    const s = hint.replace(/\.char\.json$|\.json$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '');
    if (s && NAME.test(s)) pendingName = s;
    toast('불러옴: 저장하려면 이름을 정해 저장', 'ok');
  };
  const pickName = async (initial: string): Promise<string | null> => {
    const inp = h('input', { class: 'fx-name-input', value: initial, placeholder: 'apprentice-priest', spellcheck: false, 'aria-label': '파일 이름' });
    if ((await ask('저장할 이름', [h('p', {}, '소문자 · 숫자 · - 만 (src/art/chars/<이름>.char.json)'), inp], [{ label: '저장', value: 'ok', kind: 'primary' }])) !== 'ok') return null;
    const name = inp.value.trim();
    if (!NAME.test(name)) { toast('이름은 소문자 · 숫자 · - 만', 'err'); return null; }
    if (list.some(e => e.name === name) && name !== store.file
      && (await ask('이미 있는 캐릭터', [`${name}.char.json을 덮어쓸까요?`], [{ label: '덮어쓰기', value: 'y', kind: 'danger' }])) !== 'y') return null;
    return name;
  };
  const save = async (asNew = false): Promise<boolean> => {
    const v = validateChar(store.doc);
    if (v.errors.length) { toast(`검사 오류 ${v.errors.length}개라 저장 못 함: ${v.errors[0]}`, 'err', 6000); return false; }
    let name = store.file;
    if (!name || asNew) { name = (await pickName(store.file || pendingName)) ?? ''; if (!name) return false; }
    try {
      const r = await post<{ file: string }>('/__fx/char-save', { name, doc: store.doc });
      store.markSaved(name); pendingName = '';
      prefs.del('charDraft');
      list = await getJson<Entry[]>('/__fx/chars');
      fillPicker(); setUrl();
      toast(`저장함: ${r.file}`, 'ok');
      return true;
    } catch (e) { toast(`저장 못 함: ${e instanceof Error ? e.message : e}`, 'err', 6000); return false; }
  };
  const bake = async () => {
    if ((!store.file || store.dirty) && !(await save())) return;
    const doc = store.doc, cols = Math.max(1, ...doc.motions.map(m => m.frames)), rows = Math.max(1, doc.motions.length);
    const body = [h('p', {}, h('code', {}, `src/art/chars/${store.file}.png`), ' (모션마다 한 줄) 과 ', h('code', {}, `${store.file}.sheet.json`), ' (줄 · 장 수 · fps)을 굽습니다.'),
      h('p', {}, `${doc.size}px 칸 · ${rows}줄 × 최대 ${cols}장 = ${doc.size * cols}×${doc.size * rows}px`),
      h('p', { class: 'fx-muted' }, '게임에는 아직 캐릭터 그림을 안 써서 앱에는 안 들어가요 (src/art/chars는 묶지 않음).')];
    if ((await ask('캐릭터 시트 굽기', body, [{ label: '굽기', value: 'y', kind: 'primary' }])) !== 'y') return;
    try {
      const r = await post<{ file: string; w: number; h: number }>('/__fx/char-bake', { name: store.file, doc });
      toast(`구움: ${r.file} (${r.w}×${r.h})`, 'ok', 5000);
      list = await getJson<Entry[]>('/__fx/chars');
    } catch (e) { toast(`굽기 실패: ${e instanceof Error ? e.message : e}`, 'err', 6000); }
  };
  const pngOf = (w: number, hh: number, rgba: Uint8ClampedArray, name: string) => {
    const c = h('canvas', { width: w, height: hh });
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer), w, hh), 0, 0);
    c.toBlob(b => { if (b) download(name, b); }, 'image/png');
  };
  const downloadStrip = () => {
    const doc = store.doc, m = store.m, n = doc.size, frames = m?.frames ?? 1, rgba = new Uint8ClampedArray(n * frames * n * 4);
    for (let f = 0; f < frames; f++) {
      const px = charRgba(doc, renderCharFrame(doc, m, f).idx);
      for (let y = 0; y < n; y++) rgba.set(px.subarray(y * n * 4, (y + 1) * n * 4), (y * n * frames + f * n) * 4);
    }
    pngOf(n * frames, n, rgba, `${store.file || 'char'}.${m?.id ?? 'rest'}.png`);
  };
  const menuBtn = (label: string, fn: () => void) => h('button', { type: 'button', class: 'fx-menu-item', onclick: (e: Event) => { (e.target as HTMLElement).closest('details')!.open = false; fn(); } }, label);
  const pasteDialog = async () => {
    const ta = h('textarea', { class: 'fx-paste', rows: 12, placeholder: '{"format":"healer.char@1", …}', spellcheck: false, 'aria-label': '캐릭터 JSON' });
    if ((await ask('캐릭터 JSON 붙여 넣기', [h('p', {}, 'Claude가 만든 캐릭터 (healer.char@1)를 붙여 넣으세요.'), ta], [{ label: '불러오기', value: 'ok', kind: 'primary' }])) === 'ok' && ta.value.trim()) await importText(ta.value);
  };
  fileInput.addEventListener('change', async () => { const f = fileInput.files?.[0]; if (f) await importText(await f.text(), f.name); fileInput.value = ''; });
  picker.addEventListener('change', async () => {
    const name = picker.value;
    if (!name || !(await confirmDiscard())) { fillPicker(); return; }
    await openFile(name);
  });
  const top = h('header', { class: 'fx-top' },
    h('div', { class: 'fx-brand' }, h('b', {}, '이펙트 공방'), h('span', { class: 'fx-tag' }, '개발용')),
    modeNav('char'),
    h('div', { class: 'fx-file' }, picker, dirtyEl),
    h('div', { class: 'fx-actions' },
      h('details', { class: 'fx-menu' }, h('summary', { class: 'fx-btn' }, '파일'), h('div', { class: 'fx-menu-pop' },
        menuBtn('새 캐릭터 (견습 사제 본보기)', async () => { if (await confirmDiscard()) { loadDoc(newChar(), '', false); offerDraft(); } }),
        menuBtn('빈 캐릭터', async () => { if (await confirmDiscard()) { loadDoc(blankChar(), '', false); editor.setMode('part'); } }),
        menuBtn('JSON 파일 열기…', () => fileInput.click()),
        menuBtn('JSON 붙여 넣기…', () => void pasteDialog()),
        menuBtn('다른 이름으로 저장…', () => void save(true)),
        h('hr'),
        menuBtn('JSON 복사', async () => { try { await navigator.clipboard.writeText(charJson(store.doc)); toast('JSON 복사함', 'ok'); } catch { toast('복사 못 함: 「JSON 내려받기」를 써 주세요', 'err'); } }),
        menuBtn('JSON 내려받기', () => download(`${store.file || 'char'}.char.json`, new Blob([charJson(store.doc)], { type: 'application/json' }))),
        menuBtn('지금 모션 PNG 띠 내려받기', downloadStrip),
        menuBtn('PNG 시트 내려받기 (모든 모션)', () => { const s = renderCharSheet(store.doc); pngOf(s.w, s.h, s.rgba, `${store.file || 'char'}.png`); }))),
      undoBtn, redoBtn,
      h('button', { class: 'fx-btn', type: 'button', title: '저장 (Ctrl S)', onclick: () => void save() }, '저장'),
      h('button', { class: 'fx-btn primary', type: 'button', title: '모든 모션을 PNG 시트로', onclick: () => void bake() }, '시트 굽기')),
    fileInput);
  const main = h('main', { class: 'fx-main ch-main', 'data-tab': prefs.get('chTab', 'edit') });
  const tabBtn = (tab: string, label: string) => h('button', { type: 'button', class: main.dataset.tab === tab ? 'on' : '', 'data-tab': tab, onclick: (e: Event) => {
    main.dataset.tab = tab; prefs.set('chTab', tab);
    for (const b of (e.target as HTMLElement).parentElement!.children) b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab);
    requestAnimationFrame(() => editor.render());
  } }, label);
  main.append(
    h('div', { class: 'fx-col-left' }, banner, preview.el, motionBox, h('section', { class: 'fx-check-box', 'aria-label': '검사' }, h('h3', {}, '검사'), checksEl)),
    h('div', { class: 'fx-tabs', role: 'tablist' }, tabBtn('edit', '그림판'), tabBtn('values', '부품 · 움직임')),
    h('div', { class: 'fx-col-mid' }, editor.el),
    h('div', { class: 'fx-col-right' }, ins));
  app.replaceChildren(top, main);
  editor.onBeforeEdit = () => preview.pause();

  // ── 바뀜 → 다시 그리기 ──
  let insPending = 0, checkPending = 0;
  const later = (fn: () => void, prev: number) => { cancelAnimationFrame(prev); return requestAnimationFrame(fn); };
  store.on((c, from) => {
    if (c === 'frame') { preview.draw(); editor.render(); for (const fn of cursors) fn(); frameInfo?.(); return; }
    if (c === 'part') { editor.render(); insPending = later(renderIns, insPending); return; }
    if (c === 'motion') { preview.drawFilm(); editor.render(); renderMotions(); insPending = later(renderIns, insPending); return; }
    if (c === 'view') { updateTop(); insPending = later(renderIns, insPending); return; }
    editor.render();
    preview.drawFilm();
    if (from === 'palette') editor.renderPalette(); else editor.renderBars();
    if (from !== 'ins') insPending = later(renderIns, insPending);
    if (c === 'load' || from !== 'editor') renderMotions(); else frameInfo?.();
    updateTop();
    checkPending = later(showChecks, checkPending);
    if (c === 'doc') saveDraft();
  });

  // ── 키보드 · 끌어 놓기 · 닫기 ──
  const toolKeys: Record<string, Tool> = { r: 'rotate', m: 'move', b: 'pen', e: 'erase', g: 'fill', i: 'pick', p: 'pivot', x: 'restore' };
  window.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
    if (typing || document.querySelector('dialog[open]')) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }
    if (mod || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); preview.toggle(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); preview.step(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); preview.step(1); return; }
    if (e.key === 'Escape') { store.selectPart(null); return; }
    if (['1', '2', '3'].includes(e.key)) { editor.setMode((['pose', 'part', 'frame'] as Mode[])[Number(e.key) - 1]); return; }
    if (e.key.toLowerCase() === 'o') { editor.onion = !editor.onion; prefs.set('chOnion', editor.onion); editor.render(); return; }
    const t = toolKeys[e.key.toLowerCase()];
    if (t) editor.setTool(t);
  });
  window.addEventListener('dragover', e => { e.preventDefault(); });
  window.addEventListener('drop', async e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) await importText(await f.text(), f.name); });
  window.addEventListener('beforeunload', e => { if (store.dirty) e.preventDefault(); });
  document.addEventListener('click', e => { for (const d of document.querySelectorAll<HTMLDetailsElement>('details.fx-menu[open]')) if (!d.contains(e.target as Node)) d.open = false; });

  // ── 처음 ──
  const want = new URLSearchParams(location.search).get('c') ?? prefs.get('lastChar', '');
  const first = list.find(e => e.name === want) ?? list[0];
  if (first) await openFile(first.name);
  else { loadDoc(newChar(), '', false); offerDraft(); }
  store.selectPart(store.part ?? 'armR');
  updateTop();
}
