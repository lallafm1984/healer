// 개발용 이펙트 화면: 그리기는 따로 (128px · 22장이면 1초 가까이 걸려 화면이 멈추지 않게)
import { renderGraph, type Contract, type PxfGraph } from '../../scripts/fxr/render.mjs';

export type RenderReq = { type: 'contract'; contract: Contract } | { type: 'render'; id: number; graph: PxfGraph; size: number };
export type RenderRes = { id: number; size: number; frames: Uint8ClampedArray[]; ms: number } | { id: number; error: string };

let contract: Contract | undefined;
self.onmessage = (e: MessageEvent<RenderReq>) => {
  const m = e.data;
  if (m.type === 'contract') { contract = m.contract; return; }
  const t = performance.now();
  try {
    const r = renderGraph(m.graph, { size: m.size, contract });
    const res: RenderRes = { id: m.id, size: r.size, frames: r.frames, ms: Math.round(performance.now() - t) };
    self.postMessage(res, { transfer: r.frames.map(f => f.buffer as ArrayBuffer) });
  } catch (err) {
    const res: RenderRes = { id: m.id, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(res);
  }
};
