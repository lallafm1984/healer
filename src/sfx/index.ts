/**
 * 효과음 (기획 107). 이 폴더의 소리는 파일 이름으로 찾는다 (그림 art/와 같은 방식): 파일을 넣기만 하면 그 이름으로 울리고,
 * 없으면 sfx()가 false를 돌려 부른 쪽이 합성음 자리표시 (battle/core.ts Snd)를 낸다.
 * 이름 · 쓰는 곳 · 생성 문장은 scripts/sfx/sounds.mjs (107 표). 설정 「소리」를 끄면 아무것도 안 울림.
 */
const files = import.meta.glob<string>('./*.{ogg,mp3,m4a,wav}', { eager: true, query: '?url', import: 'default' });

const urlOf: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) urlOf[path.slice(2).replace(/\.\w+$/, '')] = url;

/** 이 이름의 소리 파일이 있음 */
export const hasSfx = (name: string): boolean => name in urlOf;

// 파일은 만들 때 같은 세기로 맞춤 (scripts/sfx/make.mjs). 여기서는 자주 · 겹쳐 울리는 것만 줄임
const VOL: Record<string, number> = { 'ui-tap': 0.45, 'ui-toggle': 0.45, 'ui-tab': 0.55, 'ui-open': 0.5, 'ui-close': 0.45, tick: 0.55, cast: 0.5, proc: 0.45, heart: 0.85, gauge: 0.8 };
const volOf = (n: string) => VOL[n] ?? (n.startsWith('heal-') ? 0.55 : n.startsWith('renew-') ? 0.7 : n.startsWith('debuff-') ? 0.6 : 0.85);
/** 같은 소리를 다시 울리기까지 (ms). 20인 판에서 쌓이지 않게 (16 7-2) */
const GAP: Record<string, number> = { proc: 1200, heart: 900, chime: 250, 'mob-down': 150 };
const gapOf = (n: string) => GAP[n] ?? (n.startsWith('debuff-') ? 400 : n.startsWith('renew-') ? 150 : 60);
/** 우선순위 (16 7-2): 소리가 많이 겹치면 낮은 것부터 안 냄 */
const PRIO: Record<string, number> = { heart: 3, buster: 3, aoe: 3, zone: 3, death: 3, 'boss-enrage': 3, 'boss-phase': 3, burst: 3, crit: 2, dispel: 2, chime: 2, revive: 2, gauge: 2, win: 3, lose: 3 };
const MAX_VOICES = 10;

let on = true;
let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
let voices = 0, lastAny = -1e9;
const lastAt = new Map<string, number>();
const bufs = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

/** 설정 「소리」 (settings → battle settings()에서 부름). 끄면 지금 울리는 것도 멈춤 */
export function setSfxOn(v: boolean): void {
  on = v;
  if (!ctx) return;
  if (v && !document.hidden) void ctx.resume().catch(() => {});
  else void ctx.suspend().catch(() => {});
}

/** 소리 문맥 (합성음도 같이 씀). 처음이면 만들고, 멈춰 있으면 깨움. 못 만들면 null */
export function audioCtx(): AudioContext | null {
  if (!on || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // 여러 소리가 한꺼번에 겹쳐도 찢어지지 않게 모두 압축기를 거침
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
      out = master;
      warm();
    }
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume().catch(() => {});
    return ctx;
  } catch { ctx = null; return null; }
}
/** 모든 소리가 나가는 곳 (합성음도 여기로) */
export const audioOut = (): AudioNode | null => out;

function load(name: string): Promise<AudioBuffer | null> {
  const have = bufs.get(name);
  if (have) return Promise.resolve(have);
  let p = loading.get(name);
  if (!p) {
    const c = ctx!;
    p = fetch(urlOf[name])
      .then(r => r.arrayBuffer())
      .then(b => c.decodeAudioData(b))
      .then(buf => { bufs.set(name, buf); return buf; })
      .catch(() => null);
    loading.set(name, p);
  }
  return p;
}

/** 처음 소리 문맥을 만들 때: 쉬는 틈에 모든 소리를 하나씩 미리 풀어 둠 (메뉴 · 공통 먼저) */
function warm(): void {
  const names = Object.keys(urlOf).sort((a, b) => Number(b.startsWith('ui-')) - Number(a.startsWith('ui-')));
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 40));
  const next = () => { const n = names.shift(); if (n && ctx) void load(n).then(() => idle(next)); };
  idle(next);
}

/**
 * 소리를 냄. 파일이 없으면 false (부른 쪽이 합성음을 냄). 파일이 있으면 true (꺼져 있거나 너무 잦아 안 울려도).
 * rate = 재생 빠르기 (음정도 같이), vol = 크기 배율, delay = 늦게 (초)
 */
export function sfx(name: string, o: { rate?: number; vol?: number; delay?: number } = {}): boolean {
  if (!(name in urlOf)) return false;
  const c = audioCtx();
  if (!c || !out) return true;
  const now = performance.now();
  if (now - (lastAt.get(name) ?? -1e9) < gapOf(name)) return true;
  const prio = PRIO[name] ?? 1;
  if (voices >= MAX_VOICES && prio < 3) return true;
  lastAt.set(name, now); lastAny = now;
  const start = (buf: AudioBuffer) => {
    if (!on || !out) return;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf;
    if (o.rate) src.playbackRate.value = o.rate;
    g.gain.value = volOf(name) * (o.vol ?? 1);
    src.connect(g).connect(out);
    voices++;
    src.onended = () => { voices = Math.max(0, voices - 1); src.disconnect(); g.disconnect(); };
    src.start(c.currentTime + (o.delay ?? 0));
  };
  const buf = bufs.get(name);
  if (buf) start(buf);
  else void load(name).then(b => { if (b && performance.now() - now < 250) start(b); }); // 아직 안 풀린 첫 소리: 금방 풀리면 냄
  return true;
}

/** 방금 (ms 안에) 소리를 냈음: 메뉴 누름 소리가 다른 소리와 겹치지 않게 */
export const sfxRecent = (ms = 40): boolean => performance.now() - lastAny < ms;

if (typeof document !== 'undefined') {
  // 처음 누를 때 소리 문맥을 엶 (브라우저는 누름 없이 소리를 못 냄). 앱이 뒤로 가면 멈춤
  document.addEventListener('pointerdown', () => { audioCtx(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else if (on) void ctx.resume().catch(() => {});
  });
}
