// 개발용 이펙트 화면: 미리보기 (재생 · 프레임 · 배경 · 확대 · 공방 렌더 / 게임 띠와 나란히 · 프레임 줄)
import type { PxfGraph } from '../../scripts/fxr/render.mjs';
import { clear, h, prefs } from './dom';
import type { Store } from './store';

export type Bg = 'checker' | 'dark' | 'light' | 'cell';
export type Compare = 'none' | 'timeline' | 'strip';
export interface Rendered { size: number; frames: ImageData[]; ms: number; node: string | null }

/** 공방 타임라인 그림 (render_pxf): 64px 프레임을 한 줄에 여러 칸 · 줄 높이 76px · 8px 체커 (scripts/pxf-bake.mjs) */
const TL = { cell: 64, rowH: 76 };
const CHECK = ['#1d2024', '#2a2d31'];
const BG_COLOR: Record<Exclude<Bg, 'checker'>, string> = { dark: '#15120e', light: '#ece6da', cell: '#15120e' };

export class Preview {
  readonly el: HTMLElement;
  private main = h('canvas', { class: 'fx-canvas', 'aria-label': '이펙트 미리보기' });
  private side = h('canvas', { class: 'fx-canvas' });
  private sideWrap: HTMLElement;
  private sideLabel = h('div', { class: 'fx-cap' });
  private mainLabel = h('div', { class: 'fx-cap' }, 'fxr 미리보기');
  private film = h('div', { class: 'fx-film', role: 'list', 'aria-label': '프레임' });
  private info = h('div', { class: 'fx-info' });
  private slider = h('input', { type: 'range', min: 0, max: 0, step: 1, value: 0, 'aria-label': '프레임' });
  private frameLabel = h('span', { class: 'fx-frame-num' });
  private playBtn = h('button', { class: 'fx-btn icon', type: 'button', title: '재생 / 멈춤 (Space)' });
  private busy = h('span', { class: 'fx-busy', hidden: true }, '그리는 중…');
  private nodeBadge = h('span', { class: 'fx-badge', hidden: true });
  private stage = h('div', { class: 'fx-stage' });
  private banner = h('div', { class: 'fx-banner', hidden: true });
  private cells: HTMLCanvasElement[] = [];
  private frameCanvases: HTMLCanvasElement[] = [];
  private sideImg: HTMLImageElement | null = null;
  rendered: Rendered | null = null;
  playing = prefs.get('playing', true);
  loop = prefs.get('loop', true);
  fromImpact = prefs.get('fromImpact', false);
  speed = prefs.get('speed', 1);
  bg: Bg = prefs.get<Bg>('bg', 'checker');
  zoom = prefs.get<number>('zoom', 0);
  compare: Compare = prefs.get<Compare>('compare', 'none');
  /** 그릴 크기 배수 (1 = 설계 크기) */
  scale = prefs.get('scale', 1);
  private last = 0;
  private acc = 0;
  onScale: () => void = () => {};

  constructor(private store: Store) {
    this.sideWrap = h('div', { class: 'fx-view', hidden: true }, this.side, this.sideLabel);
    const sel = <T extends string | number>(label: string, value: T, opts: [T, string][], set: (v: T) => void) => h('label', { class: 'fx-field' }, h('span', {}, label),
      h('select', { onchange: (e: Event) => { const raw = (e.target as HTMLSelectElement).value; set((typeof value === 'number' ? Number(raw) : raw) as T); } },
        ...opts.map(([v, t]) => h('option', { value: String(v), selected: v === value }, t))));
    const btn = (text: string, title: string, fn: () => void) => h('button', { class: 'fx-btn icon', type: 'button', title, 'aria-label': title, onclick: fn }, text);
    this.slider.addEventListener('input', () => { this.pause(); store.setFrame(Number(this.slider.value)); });
    this.playBtn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    const chk = (label: string, on: boolean, set: (v: boolean) => void, title = '') => h('label', { class: 'fx-check', title }, h('input', { type: 'checkbox', checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);
    this.el = h('section', { class: 'fx-preview', 'aria-label': '미리보기' },
      this.banner,
      h('div', { class: 'fx-stage-wrap' }, this.stage),
      h('div', { class: 'fx-transport' },
        this.playBtn,
        btn('⏮', '처음 프레임', () => { this.pause(); store.setFrame(this.startFrame()); }),
        btn('◀', '앞 프레임 (←)', () => this.step(-1)),
        btn('▶', '다음 프레임 (→)', () => this.step(1)),
        h('div', { class: 'fx-slider' }, this.slider),
        this.frameLabel),
      h('div', { class: 'fx-opts' },
        sel('배경', this.bg, [['checker', '체커'], ['dark', '어둡게'], ['light', '밝게'], ['cell', '게임 칸']], v => { this.bg = v; prefs.set('bg', v); this.draw(); this.drawFilm(); }),
        sel('확대', this.zoom, [[0, '맞춤'], [1, '1×'], [2, '2×'], [3, '3×'], [4, '4×'], [6, '6×'], [8, '8×']], v => { this.zoom = v; prefs.set('zoom', v); this.layout(); }),
        sel('그릴 크기', this.scale, [[1, '설계 크기'], [2, '2배'], [4, '4배']], v => { this.scale = v; prefs.set('scale', v); this.onScale(); }),
        sel('빠르기', this.speed, [[1, '1×'], [0.5, '½×'], [0.25, '¼×']], v => { this.speed = v; prefs.set('speed', v); }),
        sel('나란히', this.compare, [['none', '없음'], ['timeline', '공방 렌더'], ['strip', '지금 게임 띠']], v => { this.compare = v; prefs.set('compare', v); this.loadSide(); }),
        chk('반복', this.loop, v => { this.loop = v; prefs.set('loop', v); }, '미리보기만 반복 (그래프 settings.loop와 따로)'),
        chk('맞는 순간부터', this.fromImpact, v => { this.fromImpact = v; prefs.set('fromImpact', v); }, '게임처럼 맞는 순간 프레임부터 재생')),
      this.info,
      h('div', { class: 'fx-film-head' }, h('b', {}, '프레임'), h('span', { class: 'fx-muted' }, '눌러서 이동 · 금테 = 맞는 순간')),
      this.film);
    this.stage.append(h('div', { class: 'fx-view' }, this.main, h('div', { class: 'fx-cap-row' }, this.mainLabel, this.nodeBadge, this.busy)), this.sideWrap);
    new ResizeObserver(() => this.layout()).observe(this.stage);
    this.syncPlay();
    requestAnimationFrame(t => this.tick(t));
  }

  get graph(): PxfGraph { return this.store.graph; }
  get renderSize(): number { return Math.min(512, this.graph.settings.size * this.scale); }
  private startFrame(): number { return this.fromImpact ? Math.min(this.graph.settings.frames - 1, this.graph.game?.impactFrame ?? 0) : 0; }

  setBusy(on: boolean): void { this.busy.hidden = !on; }
  /** 위에 띄우는 줄 (되살리기 · 오류) */
  showBanner(content: Node | null, kind: 'warn' | 'err' = 'warn'): void {
    clear(this.banner);
    this.banner.hidden = !content;
    this.banner.className = `fx-banner ${kind}`;
    if (content) this.banner.append(content);
  }
  setRendered(r: Rendered): void {
    this.rendered = r;
    this.frameCanvases = r.frames.map(img => { const c = h('canvas', { width: r.size, height: r.size }); c.getContext('2d')!.putImageData(img, 0, 0); return c; });
    this.nodeBadge.hidden = !r.node;
    this.nodeBadge.textContent = r.node ? `노드 ${r.node}만` : '';
    this.layout();
    this.drawFilm();
    this.updateInfo();
  }
  updateInfo(): void {
    const s = this.graph.settings, imp = this.graph.game?.impactFrame ?? 0, sec = (n: number) => `${(n / s.fps).toFixed(2)}초`;
    const r = this.rendered;
    this.info.textContent = `${s.size}px 설계 · ${s.frames}장 · ${s.fps}fps · ${sec(s.frames)} (게임은 맞는 순간 ${imp}부터 ${sec(s.frames - imp)})${s.loop ? ' · 반복' : ''}`
      + (r ? ` · ${r.size}px로 그림 ${r.ms}ms` : '');
  }

  /** 프레임 · 배경이 바뀌면 */
  draw(): void {
    const f = this.store.frame, n = this.graph.settings.frames;
    this.slider.max = String(n - 1);
    this.slider.value = String(f);
    this.frameLabel.textContent = `${f} / ${n - 1}`;
    for (const [i, c] of this.cells.entries()) c.classList.toggle('on', i === f);
    const r = this.rendered;
    if (!r) return;
    this.paint(this.main, this.frameCanvases[Math.min(f, this.frameCanvases.length - 1)], r.size);
    if (this.compare !== 'none') this.drawSide();
  }

  private paint(cv: HTMLCanvasElement, src: CanvasImageSource | undefined, size: number): void {
    const g = cv.getContext('2d')!, W = cv.width, k = W / size;
    g.imageSmoothingEnabled = false;
    this.paintBg(g, W, k);
    if (src) g.drawImage(src, 0, 0, W, W);
  }
  private paintBg(g: CanvasRenderingContext2D, W: number, k: number): void {
    const design = this.graph.settings.size, unit = (8 * W) / design;
    if (this.bg === 'checker') {
      for (let y = 0; y * unit < W; y++) for (let x = 0; x * unit < W; x++) { g.fillStyle = CHECK[(x + y) & 1]; g.fillRect(x * unit, y * unit, unit, unit); }
    } else {
      g.fillStyle = BG_COLOR[this.bg]; g.fillRect(0, 0, W, W);
    }
    if (this.bg === 'cell') {
      // 게임 칸: 기준 칸 (referenceCell) 크기일 때 그림이 logicalSize라서, 칸 = 프레임 × referenceCell / logicalSize
      const game = this.graph.game ?? {}, cell = (W * (game.referenceCell ?? 62)) / (game.logicalSize ?? design);
      const [px, py] = game.pivot ?? [0.5, 0.5], x = px * W - cell / 2, y = py * W - cell / 2;
      g.fillStyle = '#2a251e'; g.strokeStyle = '#6b5a3e'; g.lineWidth = Math.max(1, k);
      g.beginPath(); g.roundRect(x, y, cell, cell, cell * 0.14); g.fill(); g.stroke();
    }
  }

  /** 나란히 볼 그림 읽기 */
  loadSide(): void {
    this.sideImg = null;
    this.sideWrap.hidden = this.compare === 'none';
    if (this.compare === 'none' || !this.store.file) {
      this.sideLabel.textContent = this.compare === 'none' ? '' : '저장한 그래프만 견줄 수 있음';
      this.layout();
      return;
    }
    const kind = this.compare, file = this.store.file, img = new Image();
    img.onload = () => { if (this.compare === kind && this.store.file === file) { this.sideImg = img; this.sideLabel.textContent = kind === 'timeline' ? `공방 렌더 (${file}.timeline.png, 64px)` : `지금 게임 띠 (fx-pxf-${file}.png)`; this.layout(); } };
    img.onerror = () => { if (this.compare === kind) { this.sideLabel.textContent = kind === 'timeline' ? '공방 렌더 그림 없음' : '게임 띠 없음 (아직 안 구움)'; this.draw(); } };
    img.src = `/__fx/${kind === 'timeline' ? 'timeline' : 'strip'}?name=${encodeURIComponent(file)}&t=${Date.now()}`;
    this.layout();
  }
  private drawSide(): void {
    const g = this.side.getContext('2d')!, W = this.side.width, img = this.sideImg, f = this.store.frame, n = this.graph.settings.frames;
    g.imageSmoothingEnabled = false;
    if (!img) { this.paintBg(g, W, 1); return; }
    if (this.compare === 'timeline') {
      const cols = Math.max(1, Math.floor(img.width / TL.cell));
      g.drawImage(img, (f % cols) * TL.cell, Math.floor(f / cols) * TL.rowH, TL.cell, TL.cell, 0, 0, W, W);
      return;
    }
    // 게임 띠: 가로 한 줄 (프레임 = 높이) 또는 격자 (한 줄 ⌈√장 수⌉)
    const horiz = img.width === img.height * n, cols = horiz ? n : Math.ceil(Math.sqrt(n)), size = horiz ? img.height : img.width / cols;
    this.paintBg(g, W, W / size);
    g.drawImage(img, (f % cols) * size, Math.floor(f / cols) * size, size, size, 0, 0, W, W);
  }

  /** 캔버스 크기 (확대) 맞추기 */
  layout(): void {
    const r = this.rendered, size = r?.size ?? this.renderSize, two = this.compare !== 'none';
    const avail = Math.max(64, (this.stage.clientWidth - (two ? 12 : 0)) / (two ? 2 : 1));
    const z = this.zoom || Math.max(1, Math.floor(Math.min(avail, 520) / size));
    const W = size * z;
    for (const cv of [this.main, this.side]) {
      if (cv.width !== W) { cv.width = W; cv.height = W; }
      cv.style.width = `${Math.min(W, avail)}px`;
    }
    this.draw();
  }

  private drawFilm(): void {
    const r = this.rendered;
    clear(this.film);
    this.cells = [];
    if (!r) return;
    const imp = this.graph.game?.impactFrame;
    r.frames.forEach((_, i) => {
      const c = h('canvas', { width: r.size, height: r.size, class: `fx-film-cell${i === imp ? ' impact' : ''}`, role: 'listitem', title: `프레임 ${i}${i === imp ? ' (맞는 순간)' : ''}` });
      c.addEventListener('click', () => { this.pause(); this.store.setFrame(i); });
      this.paint(c, this.frameCanvases[i], r.size);
      this.cells.push(c);
      this.film.append(h('div', { class: 'fx-film-item' }, c, h('span', {}, String(i))));
    });
    this.draw();
  }

  play(): void {
    this.playing = true; prefs.set('playing', true); this.acc = 0;
    if (!this.loop && this.store.frame >= this.graph.settings.frames - 1) this.store.setFrame(this.startFrame());
    this.syncPlay();
  }
  pause(): void { this.playing = false; prefs.set('playing', false); this.syncPlay(); }
  toggle(): void { if (this.playing) this.pause(); else this.play(); }
  step(d: number): void { this.pause(); this.store.setFrame(this.store.frame + d); }
  private syncPlay(): void { this.playBtn.textContent = this.playing ? '❚❚' : '▶'; this.playBtn.classList.toggle('on', this.playing); }
  private tick(t: number): void {
    const dt = this.last ? Math.min(250, t - this.last) : 0;
    this.last = t;
    if (this.playing && this.rendered) {
      const s = this.graph.settings, per = 1000 / (s.fps * this.speed);
      this.acc += dt;
      while (this.acc >= per) {
        this.acc -= per;
        const next = this.store.frame + 1;
        if (next >= s.frames) {
          if (this.loop) this.store.setFrame(this.startFrame());
          else { this.pause(); break; }
        } else this.store.setFrame(next);
      }
    }
    requestAnimationFrame(x => this.tick(x));
  }
}
