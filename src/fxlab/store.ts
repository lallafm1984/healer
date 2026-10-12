// 개발용 이펙트 화면: 지금 고치는 그래프 · 되돌리기 · 화면 상태
import type { PxfGraph } from '../../scripts/fxr/render.mjs';

export type Change = 'graph' | 'load' | 'select' | 'frame' | 'view';
type Listener = (c: Change, from?: string) => void;

export class Store {
  graph: PxfGraph;
  /** 저장 파일 이름 (src/art/pxf/<이름>.pxf.json), 새 그래프는 '' */
  file = '';
  saved = '';
  selected: string | null = null;
  frame = 0;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastKey = '';
  private lastAt = 0;
  private listeners: Listener[] = [];

  constructor(g: PxfGraph) { this.graph = g; this.saved = JSON.stringify(g); }

  on(fn: Listener): void { this.listeners.push(fn); }
  emit(c: Change, from?: string): void { for (const fn of this.listeners) fn(c, from); }
  get dirty(): boolean { return JSON.stringify(this.graph) !== this.saved; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  /** 그래프 고치기. key가 같은 고침이 1초 안에 이어지면 (끌기 · 슬라이더) 되돌리기 한 번으로 묶음 */
  edit(fn: (g: PxfGraph) => void, key = '', from?: string): void {
    const before = JSON.stringify(this.graph);
    fn(this.graph);
    if (JSON.stringify(this.graph) === before) return;
    const now = Date.now();
    if (!(key && key === this.lastKey && now - this.lastAt < 1000)) this.undoStack.push(before);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.lastKey = key; this.lastAt = now;
    this.redoStack = [];
    if (this.selected && !this.graph.nodes.some(n => n.id === this.selected)) this.selected = null;
    this.emit('graph', from);
  }
  undo(): void { this.step(this.undoStack, this.redoStack); }
  redo(): void { this.step(this.redoStack, this.undoStack); }
  private step(from: string[], to: string[]): void {
    const s = from.pop();
    if (!s) return;
    to.push(JSON.stringify(this.graph));
    this.graph = JSON.parse(s) as PxfGraph;
    this.lastKey = '';
    if (this.selected && !this.graph.nodes.some(n => n.id === this.selected)) this.selected = null;
    this.frame = Math.min(this.frame, this.graph.settings.frames - 1);
    this.emit('graph');
  }
  load(g: PxfGraph, file: string, saved = true): void {
    this.graph = g; this.file = file; this.saved = saved ? JSON.stringify(g) : '';
    this.undoStack = []; this.redoStack = []; this.lastKey = '';
    this.selected = null; this.frame = Math.min(this.frame, g.settings.frames - 1);
    this.emit('load');
  }
  markSaved(file: string): void { this.file = file; this.saved = JSON.stringify(this.graph); this.emit('view'); }
  select(id: string | null): void { if (id !== this.selected) { this.selected = id; this.emit('select'); } }
  setFrame(f: number): void {
    const n = this.graph.settings.frames, v = ((Math.round(f) % n) + n) % n;
    if (v !== this.frame) { this.frame = v; this.emit('frame'); }
  }
}
