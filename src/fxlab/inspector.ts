// 개발용 이펙트 화면: 오른쪽 값 고치기. 노드를 고르면 그 노드 값 (계약 이름 · 범위로 자동), 안 고르면 그래프 설정 · 게임 값.
// 숫자 값은 고정 · 키프레임 · 구간 셋 중 하나 (공방 애니메이션 형식 그대로).
import type { Contract, ParamSpec, PxfGraph, PxfNode } from '../../scripts/fxr/render.mjs';
import { type AnimCtx, modeSeg, numericBody, numInput } from './anim-editor';
import { clear, h, toast } from './dom';
import {
  type Check, disconnect, connect, downstream, duplicateNode, paramMode, removeNode, renameNode, resize, retime, setParam, SIZES,
} from './graph-edit';
import type { Store } from './store';

export interface InspectorHooks {
  gameChecks: () => Check[];
}

export class Inspector {
  readonly el = h('section', { class: 'fx-inspector', 'aria-label': '값 고치기' });
  private cursors: (() => void)[] = [];
  private scalePx = true;
  private scaleKeys = true;

  constructor(private store: Store, private contract: Contract, private hooks: InspectorHooks) {}

  get graph(): PxfGraph { return this.store.graph; }
  private edit(fn: (g: PxfGraph) => void, key = '', live = false) { this.store.edit(fn, key, live ? 'inspector' : undefined); }

  render(): void {
    const top = this.el.scrollTop, act = document.activeElement, focus = act && this.el.contains(act) ? act.getAttribute('aria-label') : null;
    clear(this.el);
    this.cursors = [];
    const n = this.store.selected ? this.graph.nodes.find(x => x.id === this.store.selected) : undefined;
    if (n) this.nodePanel(n); else this.graphPanel();
    this.el.scrollTop = top;
    // 값을 고치고 Tab으로 다음 칸에 간 채로 다시 그려도 그 칸에 그대로
    if (focus) this.el.querySelector<HTMLElement>(`[aria-label="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
  }
  /** 프레임이 바뀌면 곡선 위 지금 자리 · 지금 값만 */
  setFrame(): void { for (const fn of this.cursors) fn(); }

  // ── 노드 ─────────────────────────────────────────────
  private nodePanel(n: PxfNode): void {
    const spec = this.contract.nodes[n.type];
    const idInput = h('input', { class: 'fx-id', value: n.id, spellcheck: false, 'aria-label': '노드 id' });
    idInput.addEventListener('change', () => {
      const to = idInput.value.trim();
      let err: string | null = null;
      this.edit(g => { err = renameNode(g, n.id, to); });
      if (err) { toast(`id를 못 바꿈: ${err}`, 'err'); idInput.value = n.id; } else this.store.select(to);
    });
    this.el.append(
      h('div', { class: 'fx-ins-head' },
        h('div', {}, h('h2', {}, spec?.label ?? n.type), h('span', { class: 'fx-muted' }, n.type)),
        h('div', { class: 'fx-row' },
          h('button', { class: 'fx-btn', type: 'button', onclick: () => { let id: string | null = null; this.edit(g => { id = duplicateNode(g, n.id); }); if (id) this.store.select(id); } }, '복제'),
          h('button', { class: 'fx-btn danger', type: 'button', onclick: () => { this.edit(g => removeNode(g, n.id)); this.store.select(null); } }, '지우기'),
          h('button', { class: 'fx-btn', type: 'button', title: '그래프 설정으로 (Esc)', onclick: () => this.store.select(null) }, '닫기'))),
      h('label', { class: 'fx-field wide' }, h('span', {}, 'id'), idInput),
    );
    if (!spec) { this.el.append(h('p', { class: 'fx-err' }, `계약에 없는 노드 「${n.type}」`)); return; }
    if (spec.inputs.length) {
      const down = downstream(this.graph, n.id);
      const cands = this.graph.nodes.filter(x => x.id !== n.id && x.type !== 'Output' && !down.has(x.id));
      this.el.append(h('h3', {}, '입력'), ...spec.inputs.map(p => {
        const cur = this.graph.links.find(l => l.t === n.id && l.p === p.p)?.f ?? '';
        const sel = h('select', { 'aria-label': p.label ?? `입력 ${p.p}` }, h('option', { value: '' }, '(없음)'),
          ...cands.map(c => h('option', { value: c.id, selected: c.id === cur }, `${c.id} · ${this.contract.nodes[c.type]?.label ?? c.type}`)));
        sel.addEventListener('change', () => this.edit(g => { if (sel.value) connect(g, sel.value, n.id, p.p); else disconnect(g, n.id, p.p); }));
        return h('label', { class: 'fx-field wide' }, h('span', {}, p.label ?? `입력 ${p.p}`), sel);
      }));
    }
    this.el.append(h('h3', {}, '값', h('span', { class: 'fx-muted' }, ' · 흐린 값 = 계약 기본값')));
    for (const [key, ps] of Object.entries(spec.params)) this.el.append(this.paramRow(n, key, ps));
  }

  private ctx(): AnimCtx {
    return {
      frames: this.graph.settings.frames, frame: () => this.store.frame, setFrame: f => this.store.setFrame(f),
      mark: this.graph.game?.impactFrame, cursors: this.cursors, rerender: () => this.render(),
    };
  }

  private paramRow(n: PxfNode, key: string, ps: ParamSpec): HTMLElement {
    const has = key in n.params, v = has ? n.params[key] : ps.default, mode = paramMode(v), numeric = ps.type === 'num' || ps.type === 'int';
    const set = (x: unknown, live = false) => this.edit(g => setParam(g, n.id, key, x), `p:${n.id}.${key}`, live);
    const head = h('div', { class: 'prm-head' }, h('span', { class: 'prm-label' }, ps.label ?? key), h('code', {}, key));
    if (numeric) head.append(modeSeg(v, ps, key, this.ctx(), set));
    if (has) head.append(h('button', { class: 'fx-btn tiny', type: 'button', title: `기본값으로 (${JSON.stringify(ps.default)})`, onclick: () => set(undefined) }, '↺'));
    const row = h('div', { class: `prm${has ? '' : ' unset'}${mode !== 'fixed' ? ' anim' : ''}` }, head);
    row.append(numeric ? numericBody(v, ps, key, this.ctx(), set) : this.fixedEditor(ps, v, set, key));
    return row;
  }

  /** 숫자가 아닌 값 (고정만) */
  private fixedEditor(ps: ParamSpec, v: unknown, set: (x: unknown, live?: boolean) => void, key: string): HTMLElement {
    switch (ps.type) {
      case 'seed': {
        const num = numInput({ ...ps, type: 'int', min: 0, max: 99999 }, Number(v), y => set(y), key);
        return h('div', { class: 'prm-body num' }, num, h('button', { class: 'fx-btn', type: 'button', title: '다른 시드', onclick: () => set(Math.floor(Math.random() * 100000)) }, '🎲 다른 무작위'));
      }
      case 'sel': {
        const sel = h('select', { 'aria-label': key }, ...(ps.options ?? []).map(o => h('option', { value: o, selected: o === v }, o)));
        sel.addEventListener('change', () => set(sel.value));
        return h('div', { class: 'prm-body' }, sel);
      }
      case 'bool': return h('div', { class: 'prm-body' }, h('label', { class: 'fx-check' }, h('input', { type: 'checkbox', checked: v === true, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), v ? '켬' : '끔'));
      case 'color': {
        const txt = h('input', { class: 'fx-hex', value: String(v), spellcheck: false, 'aria-label': `${key} 색 글자` });
        const col = h('input', { type: 'color', value: String(v), 'aria-label': key });
        col.addEventListener('input', () => { txt.value = col.value; set(col.value, true); });
        txt.addEventListener('change', () => { if (/^#[0-9a-fA-F]{6}$/.test(txt.value)) set(txt.value.toLowerCase()); else txt.value = String(v); });
        return h('div', { class: 'prm-body num' }, col, txt);
      }
      default: {
        const cols = Array.isArray(v) ? (v as string[]) : [];
        const put = (next: string[], live = false) => set(next, live);
        const sw = cols.map((c, i) => {
          const inp = h('input', { type: 'color', value: c, title: c, 'aria-label': `${key} ${i + 1}번째 색` });
          inp.addEventListener('input', () => { const next = [...cols]; next[i] = inp.value; put(next, true); });
          return h('div', { class: 'swatch' }, inp, cols.length > 1 ? h('button', { type: 'button', class: 'x', title: '이 색 빼기', onclick: () => put(cols.filter((_, j) => j !== i)) }, '×') : null);
        });
        return h('div', { class: 'prm-body pal' }, ...sw,
          cols.length < 32 ? h('button', { class: 'fx-btn tiny', type: 'button', title: '색 더하기', onclick: () => put([...cols, cols[cols.length - 1] ?? '#ffffff']) }, '+') : null,
          h('button', { class: 'fx-btn tiny', type: 'button', title: '순서 뒤집기', onclick: () => put([...cols].reverse()) }, '⇄'));
      }
    }
  }

  // ── 그래프 설정 · 게임 값 ───────────────────────────────
  private graphPanel(): void {
    const g = this.graph, s = g.settings, frames = s.frames;
    const field = (label: string, el: HTMLElement, hint = '') => h('label', { class: 'fx-field wide', title: hint }, h('span', {}, label), el);
    const num = (value: number, min: number, max: number, onChange: (x: number) => void, step = 1, label = '') => {
      const el = h('input', { type: 'number', value: String(value), min, max, step, 'aria-label': label });
      el.addEventListener('change', () => {
        const x = Number(el.value);
        if (!Number.isFinite(x) || x < min || x > max) { toast(`${label} ${min}–${max}`, 'err'); el.value = String(value); return; }
        onChange(x);
      });
      return el;
    };
    const name = h('input', { value: g.name, maxlength: 60, 'aria-label': '그래프 이름' });
    name.addEventListener('change', () => this.edit(gg => { gg.name = name.value.trim() || gg.name; }));
    const size = h('select', { 'aria-label': '캔버스 크기' }, ...SIZES.map(z => h('option', { value: z, selected: z === s.size }, `${z}px`)));
    size.addEventListener('change', () => {
      let clipped: string[] = [];
      this.edit(gg => { clipped = resize(gg, Number(size.value), this.contract, this.scalePx); });
      if (clipped.length) toast(`범위 밖이라 잘린 값: ${clipped.join(', ')}`, 'err', 6000);
    });
    const chk = (label: string, on: boolean, set: (v: boolean) => void) => h('label', { class: 'fx-check small' }, h('input', { type: 'checkbox', checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);
    const game = g.game;
    this.el.append(
      h('div', { class: 'fx-ins-head' }, h('div', {}, h('h2', {}, '그래프'), h('span', { class: 'fx-muted' }, this.store.file ? `src/art/pxf/${this.store.file}.pxf.json` : '저장 안 한 새 그래프'))),
      field('이름', name, '공방에 보이는 이름 (1–60자)'),
      h('h3', {}, '캔버스'),
      field('크기', size), chk('픽셀 단위 값도 같은 비율로', this.scalePx, v => { this.scalePx = v; }),
      field('장 수', num(frames, 1, 32, x => this.edit(gg => retime(gg, x, this.scaleKeys)), 1, '장 수')), chk('키프레임 · 맞는 순간도 같은 비율로', this.scaleKeys, v => { this.scaleKeys = v; }),
      field('fps', num(s.fps, 1, 60, x => this.edit(gg => { gg.settings.fps = x; }), 1, 'fps')),
      field('반복', h('label', { class: 'fx-check' }, h('input', { type: 'checkbox', checked: s.loop, onchange: (e: Event) => this.edit(gg => { gg.settings.loop = (e.target as HTMLInputElement).checked; }) }), s.loop ? '반복함' : '한 번')),
      h('h3', {}, '게임'),
    );
    if (!game) {
      this.el.append(h('button', { class: 'fx-btn', type: 'button', onclick: () => this.edit(gg => { gg.game = { pivot: [0.5, 0.5], logicalSize: gg.settings.size, blend: 'normal', impactFrame: 0, referenceCell: 62 }; }) }, '게임 값 넣기'));
    } else {
      const setGame = (fn: (gm: NonNullable<PxfGraph['game']>) => void) => this.edit(gg => { if (gg.game) fn(gg.game); });
      const [px, py] = game.pivot ?? [0.5, 0.5];
      const blend = h('select', { 'aria-label': '섞기' }, ...['normal', 'add'].map(b => h('option', { value: b, selected: (game.blend ?? 'normal') === b }, b === 'normal' ? '보통 (원본 색)' : '더하기 (빛)')));
      blend.addEventListener('change', () => setGame(gm => { gm.blend = blend.value as 'normal' | 'add'; }));
      this.el.append(
        field('맞는 순간', h('div', { class: 'fx-row' }, num(game.impactFrame ?? 0, 0, frames - 1, x => setGame(gm => { gm.impactFrame = x; }), 1, '맞는 순간'),
          h('button', { class: 'fx-btn', type: 'button', onclick: () => setGame(gm => { gm.impactFrame = this.store.frame; }) }, '지금 프레임')), '스킬이 들어간 순간 = 이 프레임 (게임은 이 앞을 건너뜀)'),
        field('게임 크기', num(game.logicalSize ?? s.size, 8, 320, x => setGame(gm => { gm.logicalSize = x; }), 1, '게임 크기'), '기준 칸에서 그릴 크기 (logicalSize)'),
        field('기준 칸', num(game.referenceCell ?? 62, 8, 320, x => setGame(gm => { gm.referenceCell = x; }), 1, '기준 칸'), '이 칸 크기일 때 그림이 게임 크기'),
        field('중심', h('div', { class: 'fx-row' },
          num(px, 0, 1, x => setGame(gm => { gm.pivot = [x, gm.pivot?.[1] ?? 0.5]; }), 0.01, '중심 x'),
          num(py, 0, 1, x => setGame(gm => { gm.pivot = [gm.pivot?.[0] ?? 0.5, x]; }), 0.01, '중심 y')), '칸 가운데에 놓을 점 (0–1)'),
        field('섞기', blend),
      );
    }
    const checks = this.hooks.gameChecks();
    this.el.append(h('h3', {}, '게임 연결'), h('ul', { class: 'fx-checks' }, ...checks.map(c => h('li', { class: c.level }, c.text))));
    this.el.append(h('h3', {}, '단축키'), h('ul', { class: 'fx-help' },
      h('li', {}, h('kbd', {}, 'Space'), ' 재생 · 멈춤  ', h('kbd', {}, '← →'), ' 프레임'),
      h('li', {}, h('kbd', {}, 'Ctrl Z'), ' 되돌리기  ', h('kbd', {}, 'Ctrl Shift Z'), ' 다시'),
      h('li', {}, h('kbd', {}, 'Ctrl S'), ' 저장  ', h('kbd', {}, 'Delete'), ' 고른 노드 지우기  ', h('kbd', {}, 'Esc'), ' 고르기 풀기'),
      h('li', {}, '노드 오른쪽 점을 끌어 다른 노드 왼쪽 점에 이음 · 이어진 왼쪽 점을 끌면 뗌')));
  }
}
