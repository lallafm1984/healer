// 그래프 검사기 (Lim 2026-10-12 「게임 저장소 안 이펙트 도구」): pxf.graph@1 그래프가 공방 계약 (scripts/fxr/pxf-contract.json)에 맞는지.
// 공방이 받아들이는 범위 (계약 프롬프트 「공방이 받아들이는 범위」 · 「애니메이션」)를 그대로 옮김. 렌더러처럼 브라우저에서도 돈다 (node 모듈 없음).
// errors = 공방이 거절하거나 렌더러가 틀리게 그릴 것, warnings = 그려지지만 고치는 게 좋은 것.

const SIZES = [32, 48, 64, 96, 128];
const EASES = new Set(['linear', 'in', 'out', 'inout', 'in3', 'out3', 'pulse', 'wave', 'step']);
const TOP = new Set(['format', 'name', 'settings', 'nodes', 'links', 'game']);
/** game 블록: 계약 키 + 공방 작품 · 우리 게임이 더 쓰는 키 (referenceCell = 기준 칸, battle/pxf.ts) */
const GAME = new Set(['pivot', 'logicalSize', 'blend', 'impactFrame', 'referenceCell', 'style', 'durationMs', 'role']);
const COLOR = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z0-9_-]+$/;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/**
 * @param {any} graph 그래프 객체 (JSON.parse 결과)
 * @param {any} contract 공방 계약 { format, limits, nodes }
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateGraph(graph, contract) {
  const errors = [], warnings = [], L = contract.limits;
  const err = m => errors.push(m), warn = m => warnings.push(m);
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { errors: ['그래프가 JSON 객체가 아님'], warnings };
  for (const k of Object.keys(graph)) if (!TOP.has(k)) warn(`최상위에 계약 밖 키 「${k}」`);
  if (graph.format !== contract.format) err(`format이 「${contract.format}」이 아님`);
  if (typeof graph.name !== 'string' || graph.name.length < 1 || graph.name.length > 60) err('name은 1–60자');
  const bytes = new TextEncoder().encode(JSON.stringify(graph)).length;
  if (bytes > L.bytes) err(`JSON ${bytes}바이트 (최대 ${L.bytes})`);

  // settings
  const s = graph.settings ?? {};
  if (!SIZES.includes(s.size)) err(`settings.size는 ${SIZES.join('·')} 중 하나 (지금 ${s.size})`);
  if (!Number.isInteger(s.frames) || s.frames < 1 || s.frames > L.frames) err(`settings.frames는 정수 1–${L.frames} (지금 ${s.frames})`);
  if (!isNum(s.fps) || s.fps < 1 || s.fps > 60) err(`settings.fps는 1–60 (지금 ${s.fps})`);
  if (typeof s.loop !== 'boolean') err('settings.loop는 true / false');
  const frames = Number.isInteger(s.frames) ? s.frames : 1;

  // 노드
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : (err('nodes가 배열이 아님'), []);
  const links = Array.isArray(graph.links) ? graph.links : (err('links가 배열이 아님'), []);
  if (nodes.length > L.nodes) err(`노드 ${nodes.length}개 (최대 ${L.nodes})`);
  if (links.length > L.links) err(`연결 ${links.length}개 (최대 ${L.links})`);
  const byId = new Map();
  for (const nd of nodes) {
    const where = `노드 ${nd?.id ?? '?'}`;
    if (!nd || typeof nd !== 'object') { err('노드가 객체가 아님'); continue; }
    if (typeof nd.id !== 'string' || !ID.test(nd.id)) err(`${where}: id는 영문 · 숫자 · _ · -만`);
    else if (byId.has(nd.id)) err(`${where}: id가 겹침`);
    else byId.set(nd.id, nd);
    const spec = contract.nodes[nd.type];
    if (!spec) { err(`${where}: 계약에 없는 노드 「${nd.type}」`); continue; }
    if (!isNum(nd.x) || !isNum(nd.y)) warn(`${where}: 편집기 자리 x · y가 없음`);
    const params = nd.params ?? {};
    if (typeof params !== 'object' || Array.isArray(params)) { err(`${where}: params가 객체가 아님`); continue; }
    for (const [k, v] of Object.entries(params)) {
      const ps = spec.params[k];
      if (!ps) { err(`${where} (${nd.type}): 계약에 없는 값 「${k}」`); continue; }
      checkParam(`${where} ${k}`, ps, v, frames, L, err);
    }
  }

  // 연결
  const taken = new Set(), outs = new Map(), ins = new Map();
  for (const l of links) {
    if (!l || typeof l !== 'object') { err('연결이 객체가 아님'); continue; }
    for (const k of Object.keys(l)) if (!['f', 't', 'p'].includes(k)) err(`연결 ${l.f}→${l.t}: 키는 f · t · p만 (「${k}」)`);
    const a = byId.get(l.f), b = byId.get(l.t);
    if (!a) { err(`연결: 없는 노드 「${l.f}」에서 나감`); continue; }
    if (!b) { err(`연결: 없는 노드 「${l.t}」로 들어감`); continue; }
    if (a.type === 'Output') err(`연결 ${l.f}→${l.t}: Output에서 나가는 연결`);
    const nIn = contract.nodes[b.type]?.inputs.length ?? 0;
    if (!Number.isInteger(l.p) || l.p < 0 || l.p >= nIn) { err(`연결 ${l.f}→${l.t}: ${b.type}에 입력 ${l.p}번이 없음 (입력 ${nIn}개)`); continue; }
    const port = `${l.t}#${l.p}`;
    if (taken.has(port)) err(`연결 ${l.f}→${l.t}: 입력 ${l.p}번에 연결이 둘 이상`);
    taken.add(port);
    (outs.get(l.f) ?? outs.set(l.f, []).get(l.f)).push(l.t);
    (ins.get(l.t) ?? ins.set(l.t, []).get(l.t)).push(l.f);
  }
  const outputs = nodes.filter(nd => nd?.type === 'Output');
  if (outputs.length !== 1) err(`Output은 정확히 하나 (지금 ${outputs.length}개)`);
  else if (!taken.has(`${outputs[0].id}#0`)) err('Output 입력 0번에 연결이 없음');

  // 순환
  const state = new Map();
  const visit = id => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const t of outs.get(id) ?? []) if (visit(t)) return true;
    state.set(id, 2);
    return false;
  };
  for (const id of byId.keys()) if (visit(id)) { err('순환 연결이 있음'); break; }

  // 출력에 닿지 않는 노드
  if (outputs.length === 1) {
    const seen = new Set(), stack = [outputs[0].id];
    while (stack.length) { const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); for (const f of ins.get(id) ?? []) stack.push(f); }
    for (const id of byId.keys()) if (!seen.has(id)) warn(`노드 ${id}: Output에 닿지 않아 그림에 안 나옴`);
  }

  // game
  if (graph.game !== undefined) {
    const g = graph.game;
    if (!g || typeof g !== 'object') err('game이 객체가 아님');
    else {
      for (const k of Object.keys(g)) if (!GAME.has(k)) warn(`game에 계약 밖 키 「${k}」`);
      if (g.pivot !== undefined && !(Array.isArray(g.pivot) && g.pivot.length === 2 && g.pivot.every(v => isNum(v) && v >= 0 && v <= 1))) err('game.pivot은 [0–1, 0–1]');
      if (g.logicalSize !== undefined && !(isNum(g.logicalSize) && g.logicalSize >= 8 && g.logicalSize <= 320)) err('game.logicalSize는 8–320');
      if (g.blend !== undefined && !['normal', 'add'].includes(g.blend)) err('game.blend는 normal 또는 add');
      if (g.impactFrame !== undefined && !(Number.isInteger(g.impactFrame) && g.impactFrame >= 0 && g.impactFrame < frames)) err(`game.impactFrame은 정수 0–${frames - 1}`);
    }
  }
  return { errors, warnings };
}

/** 파라미터 하나: 고정값 또는 (num · int만) 키프레임 {k} · 구간 {a, b, e, t0, t1} */
function checkParam(where, ps, v, frames, L, err) {
  const inRange = x => isNum(x) && (ps.min === undefined || x >= ps.min) && (ps.max === undefined || x <= ps.max) && (ps.type !== 'int' || Number.isInteger(x));
  const range = `${ps.type === 'int' ? '정수 ' : ''}${ps.min}–${ps.max}`;
  if (ps.type === 'num' || ps.type === 'int') {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const hasK = 'k' in v, hasAB = 'a' in v || 'b' in v;
      if (hasK && hasAB) return err(`${where}: k 형식과 a · b 형식을 섞음`);
      if (hasK) {
        if (!Array.isArray(v.k) || v.k.length < 1) return err(`${where}: k는 [프레임, 값, 이징] 목록`);
        if (v.k.length > L.keyframes) err(`${where}: 키프레임 ${v.k.length}개 (최대 ${L.keyframes})`);
        let last = -Infinity;
        for (const e of v.k) {
          if (!Array.isArray(e) || e.length < 2 || e.length > 3) { err(`${where}: 키프레임은 [프레임, 값, 이징]`); continue; }
          const [f, x, ease] = e;
          if (!isNum(f) || f < 0 || f > frames - 1) err(`${where}: 키프레임 프레임 ${f}는 0–${frames - 1}`);
          else if (f <= last) err(`${where}: 키프레임 프레임이 오름차순이 아님 (${f})`);
          last = isNum(f) ? f : last;
          if (!inRange(x)) err(`${where}: 키프레임 값 ${x}가 범위 밖 (${range})`);
          if (ease !== undefined && !EASES.has(ease)) err(`${where}: 이징 「${ease}」 없음`);
        }
        return;
      }
      if (!inRange(v.a) || !inRange(v.b)) err(`${where}: a · b는 ${range}`);
      const t0 = v.t0 ?? 0, t1 = v.t1 ?? 1;
      if (!isNum(t0) || !isNum(t1) || t0 < 0 || t1 > 1 || t0 > t1) err(`${where}: t0 · t1은 0 ≤ t0 ≤ t1 ≤ 1`);
      if (v.e !== undefined && !EASES.has(v.e)) err(`${where}: 이징 「${v.e}」 없음`);
      for (const k of Object.keys(v)) if (!['a', 'b', 'e', 't0', 't1'].includes(k)) err(`${where}: 구간 형식에 없는 키 「${k}」`);
      return;
    }
    if (!inRange(v)) err(`${where}: ${v}가 범위 밖 (${range})`);
    return;
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) return err(`${where}: ${ps.type}은 움직일 수 없음 (고정값만)`);
  if (ps.type === 'sel' && !ps.options.includes(v)) err(`${where}: 「${v}」는 ${ps.options.join(' · ')} 중 하나가 아님`);
  if (ps.type === 'bool' && typeof v !== 'boolean') err(`${where}: true / false`);
  if (ps.type === 'color' && !(typeof v === 'string' && COLOR.test(v))) err(`${where}: 색은 #RRGGBB`);
  if (ps.type === 'palette' && !(Array.isArray(v) && v.length >= 1 && v.length <= 32 && v.every(c => typeof c === 'string' && COLOR.test(c)))) err(`${where}: 팔레트는 #RRGGBB 1–32개`);
  if (ps.type === 'seed' && !(Number.isInteger(v) && v >= 0 && v <= 99999)) err(`${where}: 시드는 정수 0–99999`);
}
