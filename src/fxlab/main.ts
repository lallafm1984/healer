// 개발용 이펙트 화면 (fx.html, `npm run fx`, Lim 2026-10-12 「게임 저장소 안 도구」): PXF 공방처럼 노드 그래프로 픽셀 이펙트를 만들고
// 미리 보고 · 값을 고치고 · 저장하고 · 게임 띠로 굽는다. 그리기는 scripts/fxr (게임 띠를 굽는 것과 같은 렌더러), 저장 · 굽기는 개발 서버 창구 /__fx (scripts/fxr/dev-server.mjs).
// 앱 빌드에는 안 들어감 (vite build 입구는 index.html뿐).
import './fxlab.css';
import type { Contract, PxfGraph } from '../../scripts/fxr/render.mjs';
import { validateGraph } from '../../scripts/fxr/validate.mjs';
import { clear, h, prefs, toast } from './dom';
import { gameChecks } from './game-link';
import { addNode, autoLayout, CATEGORIES, type Check, insertAfter, needsLayout, newGraph, nodeLabel, previewGraph, removeNode, renderChecks } from './graph-edit';
import { GraphView } from './graph-view';
import { Inspector } from './inspector';
import { Preview } from './preview';
import type { RenderReq, RenderRes } from './render-worker';
import { Store } from './store';

interface Entry { name: string; title: string; size: number; frames: number; timeline: boolean; strip: boolean }
interface Draft { file: string; graph: PxfGraph; at: number }
const GROUPS: [string, string][] = [['priest-', '사제'], ['druid-', '드루이드'], ['paladin-', '성기사'], ['common-', '전투 공통'], ['ally-', '파티원 능력'], ['boss-', '보스 판 전체 공격']];
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 그리기 일꾼: 그리는 중에 또 바뀌면 마지막 것만 이어서 그림 */
class RenderClient {
  private w = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
  private seq = 0;
  private busy: { node: string | null } | null = null;
  private queued: { graph: PxfGraph; size: number; node: string | null } | null = null;
  constructor(contract: Contract, private done: (r: RenderRes, node: string | null) => void, private onBusy: (b: boolean) => void) {
    this.w.postMessage({ type: 'contract', contract } satisfies RenderReq);
    this.w.onmessage = (e: MessageEvent<RenderRes>) => {
      const node = this.busy?.node ?? null;
      this.busy = null;
      this.done(e.data, node);
      this.flush();
    };
  }
  request(graph: PxfGraph, size: number, node: string | null): void {
    this.queued = { graph, size, node };
    if (!this.busy) this.flush();
  }
  private flush(): void {
    const q = this.queued;
    this.onBusy(!!q);
    if (!q) return;
    this.queued = null;
    this.busy = { node: q.node };
    this.w.postMessage({ type: 'render', id: ++this.seq, graph: q.graph, size: q.size } satisfies RenderReq);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `${r.status}`);
  return j;
}
/** 확인 창 (버튼 값, 닫으면 null) */
function ask(title: string, body: (Node | string)[], buttons: { label: string; value: string; kind?: string }[]): Promise<string | null> {
  return new Promise(ok => {
    const d = h('dialog', { class: 'fx-dialog', 'aria-labelledby': 'fxDlgTitle' },
      h('form', { method: 'dialog' }, h('h2', { id: 'fxDlgTitle' }, title), h('div', { class: 'fx-dlg-body' }, ...body),
        h('div', { class: 'fx-dlg-btns' }, h('button', { class: 'fx-btn', value: '' }, '취소'), ...buttons.map(b => h('button', { class: `fx-btn ${b.kind ?? ''}`, value: b.value }, b.label)))));
    d.addEventListener('close', () => { ok(d.returnValue || null); d.remove(); });
    document.body.append(d);
    d.showModal();
  });
}
function download(name: string, blob: Blob): void {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const parseGraph = (text: string): PxfGraph => {
  const j = JSON.parse(text) as { graph?: unknown };
  const g = (j && typeof j === 'object' && 'graph' in j && j.graph && typeof j.graph === 'object' ? j.graph : j) as PxfGraph;
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.links) || !g.settings) throw new Error('pxf.graph@1 그래프가 아님 (nodes · links · settings 필요)');
  return g;
};

async function boot(): Promise<void> {
  const app = document.getElementById('fxApp')!;
  let contract: Contract, list: Entry[];
  try {
    [contract, list] = await Promise.all([getJson<Contract>('/__fx/contract'), getJson<Entry[]>('/__fx/list')]);
  } catch {
    app.replaceChildren(h('p', { class: 'fx-fatal' }, '개발 서버에서 열어 주세요: 저장소에서 ', h('code', {}, 'npm run fx'), ' (저장 · 굽기 창구 /__fx 가 없음)'));
    return;
  }
  const store = new Store(newGraph());
  let nodeOnly = prefs.get('nodeOnly', false), renderErr = '', renderCk: Check[] = [], saveWarns: string[] = [], pendingName = '';

  // ── 화면 조각 ──
  const preview = new Preview(store);
  const graphView = new GraphView(store, contract);
  const inspector = new Inspector(store, contract, { gameChecks: () => gameChecks(store.file, store.graph) });
  const checksEl = h('ul', { class: 'fx-checks' });
  const picker = h('select', { class: 'fx-picker', 'aria-label': '그래프 고르기' });
  const dirtyEl = h('span', { class: 'fx-dirty', hidden: true }, '● 저장 안 함');
  const undoBtn = h('button', { class: 'fx-btn icon', type: 'button', title: '되돌리기 (Ctrl Z)', 'aria-label': '되돌리기', onclick: () => store.undo() }, '↶');
  const redoBtn = h('button', { class: 'fx-btn icon', type: 'button', title: '다시 (Ctrl Shift Z)', 'aria-label': '다시', onclick: () => store.redo() }, '↷');
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const nodeOnlyBtn = h('button', { class: `fx-btn${nodeOnly ? ' on' : ''}`, type: 'button', title: '고른 노드까지만 그려 미리보기 (강도 그림은 흰색)', 'aria-pressed': String(nodeOnly) }, '고른 노드만 보기');
  const main = h('main', { class: 'fx-main', 'data-tab': prefs.get('tab', 'graph') });

  const fillPicker = () => {
    clear(picker);
    picker.append(h('option', { value: '', selected: !store.file }, store.file ? '— 그래프 고르기 —' : '(새 그래프)'));
    const used = new Set<string>();
    for (const [pre, label] of GROUPS) {
      const es = list.filter(e => e.name.startsWith(pre));
      if (!es.length) continue;
      es.forEach(e => used.add(e.name));
      picker.append(h('optgroup', { label }, ...es.map(e => h('option', { value: e.name, selected: e.name === store.file }, `${e.name} · ${e.title}`))));
    }
    const rest = list.filter(e => !used.has(e.name));
    if (rest.length) picker.append(h('optgroup', { label: '그 밖' }, ...rest.map(e => h('option', { value: e.name, selected: e.name === store.file }, `${e.name} · ${e.title}`))));
  };
  const updateTop = () => {
    dirtyEl.hidden = !store.dirty;
    undoBtn.disabled = !store.canUndo; redoBtn.disabled = !store.canRedo;
    document.title = `${store.dirty ? '● ' : ''}${store.file || '새 그래프'} · 이펙트 공방`;
  };
  const showChecks = () => {
    const v = validateGraph(store.graph, contract), items: { level: string; text: string }[] = [];
    for (const e of v.errors) items.push({ level: 'err', text: e });
    if (renderErr) items.push({ level: 'err', text: `그리기 실패: ${renderErr}` });
    for (const w of v.warnings) items.push({ level: 'warn', text: w });
    for (const w of saveWarns) items.push({ level: 'warn', text: w });
    for (const c of gameChecks(store.file, store.graph)) if (c.level === 'warn') items.push(c);
    items.push(...renderCk);
    if (!v.errors.length && !renderErr) items.unshift({ level: 'ok', text: '공방 계약 검사 통과' });
    clear(checksEl);
    for (const it of items) {
      const m = /노드 ([A-Za-z0-9_-]+)/.exec(it.text), id = m && store.graph.nodes.some(n => n.id === m[1]) ? m[1] : null;
      checksEl.append(h('li', { class: `${it.level}${id ? ' link' : ''}`, onclick: id ? () => store.select(id) : undefined }, it.text));
    }
  };

  // ── 그리기 ──
  const renderer = new RenderClient(contract, (r, node) => {
    if ('error' in r) { renderErr = r.error; showChecks(); return; }
    renderErr = '';
    const frames = r.frames.map(f => new ImageData(new Uint8ClampedArray(f.buffer as ArrayBuffer), r.size, r.size));
    if (!node) renderCk = renderChecks(r.frames, r.size, store.graph, !store.file.startsWith('boss-'));
    preview.setRendered({ size: r.size, frames, ms: r.ms, node });
    showChecks();
  }, b => preview.setBusy(b));
  let pending = 0;
  const scheduleRender = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const sel = nodeOnly && store.selected ? store.selected : null, g = sel ? previewGraph(store.graph, sel) : store.graph;
      if (!g.nodes.some(n => n.type === 'Output')) { renderErr = 'Output 노드가 없음'; showChecks(); return; }
      renderer.request(structuredClone(g), preview.renderSize, sel);
    });
  };
  preview.onScale = scheduleRender;

  // ── 저장 안 한 고친 판 (새로 고침해도 남게) ──
  let draftTimer = 0;
  const saveDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => {
      if (store.dirty) prefs.set('draft', { file: store.file, graph: store.graph, at: Date.now() } satisfies Draft);
      else if (prefs.get<Draft | null>('draft', null)?.file === store.file) prefs.del('draft');
    }, 400);
  };
  const offerDraft = () => {
    const d = prefs.get<Draft | null>('draft', null);
    if (!d || (d.file === store.file && JSON.stringify(d.graph) === store.saved)) { preview.showBanner(null); return; }
    const when = new Date(d.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const restore = () => { store.edit(g => { Object.assign(g, structuredClone(d.graph)); }); preview.showBanner(null); };
    const same = d.file === store.file;
    preview.showBanner(h('div', { class: 'fx-row' }, h('span', {}, `저장 안 한 고친 판이 있어요: ${d.file || '새 그래프'} (${when})`),
      h('button', { class: 'fx-btn primary', type: 'button', onclick: async () => {
        if (same) { restore(); return; }
        if (!(await confirmDiscard())) return;
        if (d.file) await openFile(d.file); else loadGraph(newGraph(), '', false);
        restore();
      } }, same ? '되살리기' : '열어서 되살리기'),
      h('button', { class: 'fx-btn', type: 'button', onclick: () => { prefs.del('draft'); preview.showBanner(null); } }, '버리기')));
  };

  // ── 불러오기 ──
  const loadGraph = (g: PxfGraph, file: string, saved: boolean) => {
    if (needsLayout(g)) autoLayout(g);
    store.load(g, file, saved);
    if (file) { prefs.set('last', file); history.replaceState(null, '', `?g=${encodeURIComponent(file)}`); } else history.replaceState(null, '', location.pathname);
    saveWarns = [];
    fillPicker();
  };
  const openFile = async (name: string) => {
    try {
      loadGraph(await getJson<PxfGraph>(`/__fx/graph?name=${encodeURIComponent(name)}`), name, true);
      offerDraft();
    } catch (e) { toast(`못 읽음: ${e instanceof Error ? e.message : e}`, 'err'); }
  };
  const confirmDiscard = async () => !store.dirty || (await ask('저장 안 한 고침이 있어요', ['지금 그래프의 고친 내용을 버릴까요? (되살리기 판은 남아요)'], [{ label: '버리기', value: 'y', kind: 'danger' }])) === 'y';
  const importText = async (text: string, hint = '') => {
    let g: PxfGraph;
    try { g = parseGraph(text); } catch (e) { toast(`JSON을 못 읽음: ${e instanceof Error ? e.message : e}`, 'err', 6000); return; }
    if (!(await confirmDiscard())) return;
    loadGraph(g, '', false);
    const suggest = hint.replace(/\.pxf\.json$|\.json$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '');
    if (suggest && NAME.test(suggest)) pendingName = suggest;
    toast('불러옴: 저장하려면 이름을 정해 저장', 'ok');
  };

  // ── 저장 · 굽기 · 내려받기 ──
  const pickName = async (initial: string): Promise<string | null> => {
    const inp = h('input', { class: 'fx-name-input', value: initial, placeholder: 'priest-new-skill', spellcheck: false, 'aria-label': '파일 이름' });
    const r = await ask('저장할 이름', [h('p', {}, '소문자 · 숫자 · - 만 (src/art/pxf/<이름>.pxf.json)'), inp], [{ label: '저장', value: 'ok', kind: 'primary' }]);
    if (r !== 'ok') return null;
    const name = inp.value.trim();
    if (!NAME.test(name)) { toast('이름은 소문자 · 숫자 · - 만', 'err'); return null; }
    if (list.some(e => e.name === name) && name !== store.file
      && (await ask('이미 있는 그래프', [`${name}.pxf.json을 덮어쓸까요?`], [{ label: '덮어쓰기', value: 'y', kind: 'danger' }])) !== 'y') return null;
    return name;
  };
  const save = async (asNew = false): Promise<boolean> => {
    const v = validateGraph(store.graph, contract);
    if (v.errors.length) { toast(`검사 오류 ${v.errors.length}개라 저장 못 함: ${v.errors[0]}`, 'err', 6000); return false; }
    let name = store.file;
    if (!name || asNew) { name = (await pickName(store.file || pendingName)) ?? ''; if (!name) return false; }
    try {
      const r = await post<{ file: string; warns: string[] }>('/__fx/save', { name, graph: store.graph });
      saveWarns = r.warns;
      const renamed = name !== store.file;
      store.markSaved(name);
      if (renamed) preview.loadSide();
      pendingName = '';
      prefs.del('draft');
      list = await getJson<Entry[]>('/__fx/list');
      fillPicker();
      history.replaceState(null, '', `?g=${encodeURIComponent(name)}`);
      toast(`저장함: ${r.file}${r.warns.length ? ` (알림 ${r.warns.length}개, 검사 칸)` : ''}`, 'ok');
      showChecks();
      return true;
    } catch (e) { toast(`저장 못 함: ${e instanceof Error ? e.message : e}`, 'err', 6000); return false; }
  };
  const bake = async () => {
    if ((!store.file || store.dirty) && !(await save())) return;
    const g = store.graph, e = list.find(x => x.name === store.file), wide = g.settings.size === 128, size = wide ? 256 : g.settings.size;
    const cols = wide ? Math.ceil(Math.sqrt(g.settings.frames)) : g.settings.frames, rows = Math.ceil(g.settings.frames / cols);
    const body: (Node | string)[] = [
      h('p', {}, h('code', {}, `src/art/fx-pxf-${store.file}.png`), '를 이 화면과 같은 렌더러 (fxr)로 굽습니다.'),
      h('p', {}, `${size}px × ${g.settings.frames}장, ${wide ? `격자 ${cols}×${rows}` : '가로 한 줄'} = ${size * cols}×${size * rows}px`),
    ];
    if (e?.timeline && !wide && e.strip) body.push(h('p', { class: 'fx-warn' }, '지금 게임 띠는 공방 엔진 그림 (타임라인)으로 구운 것이에요. fxr 그림은 파티클 무작위 모양 같은 곳이 조금 달라요 (「나란히: 공방 렌더」로 견줘 보기).'));
    for (const c of gameChecks(store.file, g)) if (c.level === 'warn') body.push(h('p', { class: 'fx-warn' }, c.text));
    if ((await ask('게임 띠 굽기', body, [{ label: '굽기', value: 'y', kind: 'primary' }])) !== 'y') return;
    try {
      const r = await post<{ file: string; w: number; h: number; ms: number }>('/__fx/bake', { name: store.file, graph: g });
      toast(`구움: ${r.file} (${r.w}×${r.h}, ${r.ms}ms)`, 'ok', 5000);
      list = await getJson<Entry[]>('/__fx/list');
      preview.loadSide();
    } catch (err) { toast(`굽기 실패: ${err instanceof Error ? err.message : err}`, 'err', 6000); }
  };
  const downloadPng = () => {
    const r = preview.rendered;
    if (!r) return;
    const cv = h('canvas', { width: r.size * r.frames.length, height: r.size }), g = cv.getContext('2d')!;
    r.frames.forEach((f, i) => g.putImageData(f, i * r.size, 0));
    cv.toBlob(b => { if (b) download(`${store.file || 'effect'}${r.node ? `.${r.node}` : ''}.${r.size}px.png`, b); }, 'image/png');
  };
  const jsonText = () => `${JSON.stringify(store.graph, null, 2)}\n`;
  const copyJson = async () => {
    try { await navigator.clipboard.writeText(jsonText()); toast('JSON 복사함 (공방 「JSON 가져오기」에 붙여 넣기)', 'ok'); }
    catch { toast('복사 못 함: 「JSON 내려받기」를 써 주세요', 'err'); }
  };

  // ── 노드 더하기 ──
  const addMenu = h('details', { class: 'fx-menu' }, h('summary', { class: 'fx-btn primary' }, '+ 노드'),
    h('div', { class: 'fx-menu-pop wide' }, h('p', { class: 'fx-muted small' }, '노드를 고른 채로 더하면 그 뒤에 끼워 이어 줌'),
      ...CATEGORIES.map(c => h('div', { class: 'fx-menu-group' }, h('b', {}, c.label), h('div', { class: 'fx-chips' }, ...c.types.map(t => h('button', {
        type: 'button', class: 'fx-chip', title: t,
        onclick: () => {
          const sel = store.selected, at = graphView.center();
          let id = '';
          store.edit(g => {
            const s = sel ? g.nodes.find(n => n.id === sel) : undefined;
            id = addNode(g, t, s ? { x: s.x + 60, y: s.y + 110 } : at);
            if (s && s.type !== 'Output') insertAfter(g, s.id, id, contract.nodes[t]?.inputs.length ?? 0);
          });
          store.select(id);
          addMenu.open = false;
        },
      }, nodeLabel(contract, t))))))));

  nodeOnlyBtn.addEventListener('click', () => {
    nodeOnly = !nodeOnly; prefs.set('nodeOnly', nodeOnly);
    nodeOnlyBtn.classList.toggle('on', nodeOnly); nodeOnlyBtn.setAttribute('aria-pressed', String(nodeOnly));
    scheduleRender();
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (f) await importText(await f.text(), f.name);
    fileInput.value = '';
  });
  picker.addEventListener('change', async () => {
    const name = picker.value;
    if (!name) { fillPicker(); return; }
    if (!(await confirmDiscard())) { fillPicker(); return; }
    await openFile(name);
  });
  const pasteDialog = async () => {
    const ta = h('textarea', { class: 'fx-paste', rows: 12, placeholder: '{"format":"pxf.graph@1", …}', spellcheck: false, 'aria-label': '그래프 JSON' });
    const r = await ask('JSON 붙여 넣기', [h('p', {}, '공방 「JSON 복사」 · Claude가 만든 그래프를 붙여 넣으세요.'), ta], [{ label: '불러오기', value: 'ok', kind: 'primary' }]);
    if (r === 'ok' && ta.value.trim()) await importText(ta.value);
  };
  const menuBtn = (label: string, fn: () => void) => h('button', { type: 'button', class: 'fx-menu-item', onclick: (e: Event) => { (e.target as HTMLElement).closest('details')!.open = false; fn(); } }, label);

  const top = h('header', { class: 'fx-top' },
    h('div', { class: 'fx-brand' }, h('b', {}, '이펙트 공방'), h('span', { class: 'fx-tag' }, '개발용')),
    h('div', { class: 'fx-file' }, picker, dirtyEl),
    h('div', { class: 'fx-actions' },
      h('details', { class: 'fx-menu' }, h('summary', { class: 'fx-btn' }, '파일'), h('div', { class: 'fx-menu-pop' },
        menuBtn('새 그래프', async () => { if (await confirmDiscard()) { loadGraph(newGraph(), '', false); offerDraft(); } }),
        menuBtn('JSON 파일 열기…', () => fileInput.click()),
        menuBtn('JSON 붙여 넣기…', () => void pasteDialog()),
        menuBtn('다른 이름으로 저장…', () => void save(true)),
        h('hr'),
        menuBtn('JSON 복사 (공방에 붙이기)', () => void copyJson()),
        menuBtn('JSON 내려받기', () => download(`${store.file || 'effect'}.pxf.json`, new Blob([jsonText()], { type: 'application/json' }))),
        menuBtn('PNG 띠 내려받기 (지금 그린 크기)', downloadPng))),
      undoBtn, redoBtn,
      h('button', { class: 'fx-btn', type: 'button', title: '저장 (Ctrl S)', onclick: () => void save() }, '저장'),
      h('button', { class: 'fx-btn primary', type: 'button', title: '게임에 쓰는 띠 PNG로 굽기', onclick: () => void bake() }, '게임 띠 굽기')),
    fileInput);

  const tabBtn = (tab: string, label: string) => h('button', { type: 'button', class: main.dataset.tab === tab ? 'on' : '', 'data-tab': tab, onclick: (e: Event) => {
    main.dataset.tab = tab; prefs.set('tab', tab);
    for (const b of (e.target as HTMLElement).parentElement!.children) b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab);
    if (tab === 'graph') requestAnimationFrame(() => graphView.fit());
  } }, label);
  main.append(
    h('div', { class: 'fx-col-left' }, preview.el, h('section', { class: 'fx-check-box', 'aria-label': '검사' }, h('h3', {}, '검사'), checksEl)),
    h('div', { class: 'fx-tabs', role: 'tablist' }, tabBtn('graph', '노드 그래프'), tabBtn('values', '값 고치기')),
    h('div', { class: 'fx-col-mid' },
      h('div', { class: 'fx-graph-bar' }, addMenu,
        h('button', { class: 'fx-btn', type: 'button', title: '출력까지 거리로 줄 세움', onclick: () => { store.edit(g => autoLayout(g)); requestAnimationFrame(() => graphView.fit()); } }, '줄 세우기'),
        h('button', { class: 'fx-btn', type: 'button', title: '그래프 전체가 보이게', onclick: () => graphView.fit() }, '맞춤'),
        nodeOnlyBtn),
      h('div', { class: 'fx-graph' }, graphView.svg)),
    h('div', { class: 'fx-col-right' }, inspector.el));
  app.replaceChildren(top, main);
  graphView.svg.addEventListener('fx-cycle', () => toast('순환 연결이 생겨서 못 이음', 'err'));

  // ── 바뀜 → 다시 그리기 ──
  let insPending = 0;
  const renderInspector = () => { cancelAnimationFrame(insPending); insPending = requestAnimationFrame(() => inspector.render()); };
  store.on((c, from) => {
    if (c === 'frame') { preview.draw(); inspector.setFrame(); return; }
    if (c === 'select') { graphView.markSelected(); renderInspector(); if (nodeOnly) scheduleRender(); return; }
    if (c === 'view') { updateTop(); renderInspector(); showChecks(); return; }
    if (from !== 'graph-move') { scheduleRender(); graphView.render(); }
    if (from !== 'inspector') renderInspector();
    if (c === 'load') { requestAnimationFrame(() => graphView.fit()); preview.loadSide(); renderCk = []; }
    preview.updateInfo();
    updateTop();
    showChecks();
    if (c === 'graph') saveDraft();
  });

  // ── 키보드 · 끌어 놓기 · 닫기 ──
  window.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
    if (typing || document.querySelector('dialog[open]')) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }
    if (e.key === ' ') { e.preventDefault(); preview.toggle(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); preview.step(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); preview.step(1); return; }
    if (e.key === 'Escape') { store.select(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selected) { const id = store.selected; store.edit(g => removeNode(g, id)); }
  });
  window.addEventListener('dragover', e => { e.preventDefault(); });
  window.addEventListener('drop', async e => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) await importText(await f.text(), f.name);
  });
  window.addEventListener('beforeunload', e => { if (store.dirty) e.preventDefault(); });
  document.addEventListener('click', e => {
    for (const d of document.querySelectorAll<HTMLDetailsElement>('details.fx-menu[open]')) if (!d.contains(e.target as Node)) d.open = false;
  });

  // ── 처음 ──
  const want = new URLSearchParams(location.search).get('g') ?? prefs.get('last', 'heal-dust');
  const first = list.find(e => e.name === want) ?? list.find(e => e.name === 'heal-dust') ?? list[0];
  if (first) await openFile(first.name);
  else { loadGraph(newGraph(), '', false); offerDraft(); }
  updateTop();
}

void boot();
