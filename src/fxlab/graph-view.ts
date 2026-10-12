// 개발용 이펙트 화면: 노드 그림 (SVG). 노드를 눌러 고르고, 끌어 옮기고, 오른쪽 출력 점을 끌어 다른 노드 입력에 이음.
// 이어진 입력 점을 끌면 그 연결을 떼어 냄. 빈 곳을 끌면 화면 이동, 휠 · 두 손가락으로 확대.
import type { Contract, PxfGraph, PxfNode } from '../../scripts/fxr/render.mjs';
import { s } from './dom';
import { CATEGORIES, connect, disconnect, upstream } from './graph-edit';
import type { Store } from './store';

const W = 168, HEAD = 26, ROW = 18, TOP = HEAD + 18;
const CAT_OF = new Map<string, number>(CATEGORIES.flatMap((c, i) => c.types.map(t => [t, i] as [string, number])));
const portY = (p: number) => TOP + p * ROW + ROW / 2;

export class GraphView {
  readonly svg = s('svg', { class: 'fx-graph-svg', role: 'application', 'aria-label': '노드 그래프' });
  private world = s('g');
  private linkLayer = s('g');
  private nodeLayer = s('g');
  private temp = s('path', { class: 'fx-link temp' });
  private view = { x: 0, y: 0, k: 0.8 };
  private nodeEls = new Map<string, SVGGElement>();
  private drag: null | { kind: 'move'; id: string; dx: number; dy: number; moved: boolean; pid: number }
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean; pid: number }
    | { kind: 'link'; from: string; pid: number } = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; k: number } | null = null;

  constructor(private store: Store, private contract: Contract) {
    this.temp.style.display = 'none';
    this.world.append(this.linkLayer, this.nodeLayer, this.temp);
    this.svg.append(this.world);
    this.svg.addEventListener('pointerdown', e => this.down(e));
    this.svg.addEventListener('pointermove', e => this.move(e));
    this.svg.addEventListener('pointerup', e => this.up(e));
    this.svg.addEventListener('pointercancel', e => this.up(e));
    this.svg.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomAt(e.clientX, e.clientY, this.view.k * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }

  get graph(): PxfGraph { return this.store.graph; }

  private toWorld(cx: number, cy: number) {
    const r = this.svg.getBoundingClientRect();
    return { x: (cx - r.left - this.view.x) / this.view.k, y: (cy - r.top - this.view.y) / this.view.k };
  }
  private applyView() { this.world.setAttribute('transform', `translate(${this.view.x} ${this.view.y}) scale(${this.view.k})`); }
  private zoomAt(cx: number, cy: number, k: number) {
    const r = this.svg.getBoundingClientRect(), nk = Math.min(2.5, Math.max(0.2, k)), px = cx - r.left, py = cy - r.top;
    this.view.x = px - ((px - this.view.x) / this.view.k) * nk;
    this.view.y = py - ((py - this.view.y) / this.view.k) * nk;
    this.view.k = nk;
    this.applyView();
  }
  /** 그래프 전체가 보이게 (글자를 읽을 수 있는 만큼만 줄이고, 넘치면 왼쪽 위부터) */
  fit(): void {
    const r = this.svg.getBoundingClientRect(), ns = this.graph.nodes;
    if (!ns.length || !r.width) return;
    const x0 = Math.min(...ns.map(n => n.x)), y0 = Math.min(...ns.map(n => n.y));
    const x1 = Math.max(...ns.map(n => n.x + W)), y1 = Math.max(...ns.map(n => n.y + this.height(n)));
    const k = Math.min(1.1, Math.max(0.7, Math.min((r.width - 40) / (x1 - x0), (r.height - 40) / (y1 - y0))));
    const cx = (r.width - (x1 - x0) * k) / 2, cy = (r.height - (y1 - y0) * k) / 2;
    this.view = { k, x: Math.max(20, cx) - x0 * k, y: Math.max(20, cy) - y0 * k };
    this.applyView();
  }
  /** 화면 가운데 (새 노드 자리) */
  center(): { x: number; y: number } {
    const r = this.svg.getBoundingClientRect();
    return this.toWorld(r.left + r.width / 2 - (W * this.view.k) / 2, r.top + r.height / 2 - 40 * this.view.k);
  }

  private height(n: PxfNode) { return TOP + Math.max(1, this.contract.nodes[n.type]?.inputs.length ?? 0) * ROW + 8; }

  /** 다시 그리기 */
  render(): void {
    const g = this.graph, out = g.nodes.find(n => n.type === 'Output'), live = out ? upstream(g, out.id) : new Set<string>();
    if (out) live.add(out.id);
    this.nodeLayer.replaceChildren();
    this.nodeEls.clear();
    for (const n of g.nodes) {
      const spec = this.contract.nodes[n.type], ins = spec?.inputs ?? [], hgt = this.height(n), cat = CAT_OF.get(n.type) ?? 4;
      const animated = Object.values(n.params).filter(v => v && typeof v === 'object' && !Array.isArray(v)).length;
      const el = s('g', { class: `fx-node cat${cat}${n.id === this.store.selected ? ' sel' : ''}${live.has(n.id) ? '' : ' dead'}`, 'data-node': n.id, transform: `translate(${n.x} ${n.y})` },
        s('rect', { class: 'body', width: W, height: hgt, rx: 7 }),
        s('rect', { class: 'head', width: W, height: HEAD, rx: 7 }),
        s('rect', { class: 'head', y: HEAD - 7, width: W, height: 7 }),
        s('text', { class: 'title', x: 10, y: 17 }, spec?.label ?? n.type),
        s('text', { class: 'type', x: W - 22, y: 17, 'text-anchor': 'end' }, n.type),
        s('text', { class: 'nid', x: 10, y: HEAD + 13 }, n.id + (animated ? `  ◆${animated}` : '')),
      );
      if (n.type !== 'Output') el.append(s('circle', { class: 'port out', cx: W, cy: HEAD / 2, r: 6, 'data-out': n.id }));
      ins.forEach((p, i) => {
        const linked = g.links.some(l => l.t === n.id && l.p === p.p);
        el.append(s('circle', { class: `port in${linked ? ' linked' : ''}`, cx: 0, cy: portY(i), r: 5.5, 'data-in': n.id, 'data-port': p.p }),
          s('text', { class: 'plabel', x: 12, y: portY(i) + 4 }, p.label ?? `입력 ${p.p}`));
      });
      this.nodeLayer.append(el);
      this.nodeEls.set(n.id, el);
    }
    this.renderLinks();
    this.applyView();
  }
  private linkPath(f: PxfNode, t: PxfNode, p: number) {
    const x0 = f.x + W, y0 = f.y + HEAD / 2, x1 = t.x, y1 = t.y + portY(this.contract.nodes[t.type]?.inputs.findIndex(i => i.p === p) ?? p);
    const dx = Math.max(40, Math.abs(x1 - x0) * 0.5);
    return `M${x0} ${y0} C${x0 + dx} ${y0} ${x1 - dx} ${y1} ${x1} ${y1}`;
  }
  private renderLinks(): void {
    const byId = new Map(this.graph.nodes.map(n => [n.id, n]));
    this.linkLayer.replaceChildren(...this.graph.links.flatMap(l => {
      const f = byId.get(l.f), t = byId.get(l.t);
      if (!f || !t) return [];
      const on = this.store.selected === l.f || this.store.selected === l.t;
      return [s('path', { class: `fx-link${on ? ' on' : ''}`, d: this.linkPath(f, t, l.p) })];
    }));
  }
  /** 고른 노드 표시만 바꿈 */
  markSelected(): void {
    for (const [id, el] of this.nodeEls) el.classList.toggle('sel', id === this.store.selected);
    this.renderLinks();
  }

  private down(e: PointerEvent): void {
    const t = e.target as Element;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.view.k };
      this.drag = null;
      return;
    }
    this.svg.setPointerCapture(e.pointerId);
    const outId = t.getAttribute('data-out'), inId = t.getAttribute('data-in');
    if (outId) { this.drag = { kind: 'link', from: outId, pid: e.pointerId }; this.updateTemp(outId, e); return; }
    if (inId) {
      const port = Number(t.getAttribute('data-port')), l = this.graph.links.find(x => x.t === inId && x.p === port);
      if (l) {
        // 이어진 입력을 끌면 연결을 떼어 들고 다님
        this.store.edit(g => disconnect(g, inId, port));
        this.drag = { kind: 'link', from: l.f, pid: e.pointerId };
        this.updateTemp(l.f, e);
      }
      return;
    }
    const nodeEl = t.closest('[data-node]');
    if (nodeEl) {
      const id = nodeEl.getAttribute('data-node')!, n = this.graph.nodes.find(x => x.id === id)!, w = this.toWorld(e.clientX, e.clientY);
      this.store.select(id);
      this.drag = { kind: 'move', id, dx: w.x - n.x, dy: w.y - n.y, moved: false, pid: e.pointerId };
      return;
    }
    this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false, pid: e.pointerId };
  }
  private move(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (this.pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.d);
      return;
    }
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    if (d.kind === 'pan') {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      this.view.x = d.vx + e.clientX - d.sx; this.view.y = d.vy + e.clientY - d.sy;
      this.applyView();
    } else if (d.kind === 'move') {
      const w = this.toWorld(e.clientX, e.clientY), n = this.graph.nodes.find(x => x.id === d.id);
      if (!n) return;
      const x = Math.round((w.x - d.dx) / 10) * 10, y = Math.round((w.y - d.dy) / 10) * 10;
      if (x === n.x && y === n.y) return;
      d.moved = true;
      this.store.edit(g => { const m = g.nodes.find(q => q.id === d.id); if (m) { m.x = x; m.y = y; } }, `move:${d.id}`, 'graph-move');
      this.nodeEls.get(d.id)?.setAttribute('transform', `translate(${x} ${y})`);
      this.renderLinks();
    } else this.updateTemp(d.from, e);
  }
  private up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    this.drag = null;
    if (d.kind === 'pan' && !d.moved) this.store.select(null);
    if (d.kind !== 'link') return;
    this.temp.style.display = 'none';
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const inEl = hit?.closest('[data-in]'), nodeEl = hit?.closest('[data-node]');
    let to: string | null = null, port = 0;
    if (inEl) { to = inEl.getAttribute('data-in'); port = Number(inEl.getAttribute('data-port')); }
    else if (nodeEl) {
      // 노드 몸통에 놓으면 빈 입력 중 첫째 (없으면 0번)
      to = nodeEl.getAttribute('data-node');
      const n = this.graph.nodes.find(x => x.id === to), ins = n ? this.contract.nodes[n.type]?.inputs ?? [] : [];
      if (!ins.length) to = null;
      else port = (ins.find(p => !this.graph.links.some(l => l.t === to && l.p === p.p)) ?? ins[0]).p;
    }
    if (!to) return;
    let ok = true;
    this.store.edit(g => { ok = connect(g, d.from, to, port); });
    if (!ok) this.svg.dispatchEvent(new CustomEvent('fx-cycle', { bubbles: true }));
  }
  private updateTemp(from: string, e: PointerEvent): void {
    const f = this.graph.nodes.find(n => n.id === from);
    if (!f) return;
    const w = this.toWorld(e.clientX, e.clientY), x0 = f.x + W, y0 = f.y + HEAD / 2, dx = Math.max(40, Math.abs(w.x - x0) * 0.5);
    this.temp.setAttribute('d', `M${x0} ${y0} C${x0 + dx} ${y0} ${w.x - dx} ${w.y} ${w.x} ${w.y}`);
    this.temp.style.display = '';
  }
}
