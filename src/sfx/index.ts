/**
 * 효과음 (기획 107). 이 폴더의 소리는 파일 이름으로 찾는다 (그림 art/와 같은 방식): 파일을 넣기만 하면 그 이름으로 울리고,
 * 없으면 sfx()가 false를 돌려 부른 쪽이 합성음 자리표시 (battle/core.ts Snd)를 낸다.
 * 이름 · 쓰는 곳 · 생성 문장은 scripts/sfx/sounds.mjs (107 표). 설정 「소리」를 끄면 아무것도 안 울림.
 */
import { sfxTiming } from './timing';
const files = import.meta.glob<string>('./*.{ogg,mp3,m4a,wav}', { eager: true, query: '?url', import: 'default' });

const urlOf: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) urlOf[path.slice(2).replace(/\.\w+$/, '')] = url;

/** 이 이름의 소리 파일이 있음 */
export const hasSfx = (name: string): boolean => name in urlOf;

// 파일은 만들 때 같은 세기로 맞춤 (scripts/sfx/make.mjs). 여기서는 자주 · 겹쳐 울리는 것만 줄임
const VOL: Record<string, number> = { 'ui-tap': 0.45, 'ui-toggle': 0.45, 'ui-tab': 0.55, 'ui-open': 0.5, 'ui-close': 0.45, tick: 0.55, proc: 0.45, heart: 0.85, gauge: 0.8, 'ally-hurt': 0.45, shield: 0.55, parry: 0.55, 'status-stagger': 0.4 };
Object.assign(VOL, { 'heal-priest': .75, 'renew-priest': .75, 'hymn-priest': .75, 'priest-crit': .85, 'priest-scatter': .75 });
const volOf = (n: string) => VOL[n] ?? (n.startsWith('atk-') ? 0.32 : n.startsWith('priest-') ? 0.65 : n.startsWith('attack-') ? 0.5 : n.startsWith('ally-') ? 0.6 : n.startsWith('magic-') ? 0.65 : n.startsWith('heal-') ? 0.55 : n.startsWith('renew-') ? 0.7 : n.startsWith('debuff-') ? 0.6 : 0.85);
/** 같은 소리를 다시 울리기까지 (ms). 20인 판에서 쌓이지 않게 (16 7-2) */
const GAP: Record<string, number> = { proc: 1200, heart: 900, chime: 250, 'mob-down': 150, 'ally-hurt': 300, shield: 350, parry: 250, 'status-stagger': 900, 'boss-impact': 200, 'boss-wave': 300, 'stone-break': 300 };
const gapOf = (n: string) => GAP[n] ?? (n.startsWith('atk-') ? 100 : n === 'priest-relay-hop' ? 350 : n === 'priest-crit' ? 450 : n.startsWith('attack-') ? 220 : n.startsWith('ally-') ? 450 : n.startsWith('magic-') ? 300 : n.startsWith('debuff-') ? 400 : n.startsWith('renew-') ? 150 : 60);
/** 우선순위 (16 7-2): 소리가 많이 겹치면 낮은 것부터 안 냄 */
const PRIO: Record<string, number> = { heart: 3, buster: 3, aoe: 3, zone: 3, death: 3, 'boss-enrage': 3, 'boss-phase': 3, 'boss-impact': 2, 'boss-wave': 2, burst: 3, crit: 2, dispel: 2, chime: 2, revive: 2, gauge: 2, win: 3, lose: 3 };
const prioOf = (name: string) => PRIO[name] ?? (name.startsWith('atk-') ? 0 : name === 'priest-rescue' || name === 'priest-ready' ? 3 : /^(heal|renew|hymn|priest)-/.test(name) ? 2 : 1);
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

/** Decode before the battle countdown ends, instead of waiting for idle menu warming. */
export async function preloadSfx(): Promise<void> {
  if (!audioCtx()) return;
  const names = Object.keys(urlOf);
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let name = names.pop(); name; name = names.pop()) await load(name);
  }));
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
  const prio = prioOf(name);
  const budget = prio === 0 ? 6 : prio === 1 ? MAX_VOICES - 3 : MAX_VOICES; // Reserve space for healing and warnings.
  if (voices >= budget && prio < 3) return true;
  lastAt.set(name, now); lastAny = now;
  const start = (buf: AudioBuffer) => {
    if (!on || !out) return;
    if (voices >= budget && prio < 3) return; // Recheck after asynchronous decoding.
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf;
    const timing = sfxTiming(buf.duration, o.rate);
    const at = c.currentTime + (o.delay ?? 0);
    src.playbackRate.value = timing.rate;
    g.gain.value = volOf(name) * (o.vol ?? 1);
    if (timing.fadeAt !== null) {
      g.gain.setValueAtTime(g.gain.value, at + timing.fadeAt);
      g.gain.linearRampToValueAtTime(0, at + timing.seconds);
    }
    src.connect(g).connect(out);
    voices++;
    src.onended = () => { voices = Math.max(0, voices - 1); src.disconnect(); g.disconnect(); };
    src.start(at);
    src.stop(at + timing.seconds);
  };
  const buf = bufs.get(name);
  if (buf) start(buf);
  else void load(name).then(b => { if (b && performance.now() - now < 250) start(b); }); // 아직 안 풀린 첫 소리: 금방 풀리면 냄
  return true;
}

/** 직업 공통 시전음 파일 이름 (2026-10-21 Lim 「시전음은 따로 만들어서 알려줄 테니 직업 공동으로 적용할 수 있도록」): src/sfx/cast-loop.ogg */
export const CAST_LOOP = 'cast-loop';

/**
 * 이음새 없이 도는 소리 (시전하는 동안의 시전음). 파일이 없거나 소리가 꺼져 있으면 null.
 * 한 번 울리는 효과음의 1.5초 상한 (timing.ts)과 겹침 수 (voices)는 이 소리에 적용하지 않음: 시전이 끝나면 stop()으로 짧게 줄이며 멈춤
 */
export function sfxLoop(name: string, o: { vol?: number; fade?: number } = {}): { stop(fade?: number): void } | null {
  if (!(name in urlOf)) return null;
  const c = audioCtx();
  if (!c || !out) return null;
  const g = c.createGain(), target = (VOL[name] ?? 0.45) * (o.vol ?? 1), fade = o.fade ?? 0.08;
  g.gain.value = 0;
  g.connect(out);
  let src: AudioBufferSourceNode | null = null, stopped = false;
  const begin = (buf: AudioBuffer) => {
    if (stopped || !on) return;
    src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(g);
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(target, t + fade);
    src.start(t);
  };
  const buf = bufs.get(name);
  if (buf) begin(buf);
  else void load(name).then(b => { if (b) begin(b); });
  return {
    stop(f = 0.12) {
      if (stopped) return;
      stopped = true;
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + f);
      const s = src;
      if (s) { s.onended = () => { s.disconnect(); g.disconnect(); }; s.stop(t + f + 0.02); } else setTimeout(() => g.disconnect(), (f + 0.05) * 1000);
    },
  };
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
