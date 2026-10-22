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
// 보스 기술 착탄 · 주의 표시 경고는 배경음 위로 크게 (2026-10-21 Lim), 쉬는 화면 반복은 바탕으로
Object.assign(VOL, { 'boss-impact': 1, 'boss-wave': 1, 'boss-zone': 1, 'warn-alert': 0.6, 'rest-loop': 0.6 }); // 경고 딩 (2026-10-22)은 맑고 높아 0.6이면 충분
// 빠진 순간 소리 (2026-10-22 Lim 「전투를 풍요롭게」): 보스 처치 · 붉은 경고는 크게, 장전은 작게
Object.assign(VOL, { 'boss-down': 1, 'alarm-rule': 0.8, 'boss-aggro': 0.8, 'boss-cast': 0.8, 'cast-break': 0.6, 'ui-arm': 0.4, 'ui-disarm': 0.4 });
// 높고 가는 공격 소리 (도적 단검 · 궁수 화살)는 몸통이 작아 다른 직업 공격과 들리는 크기를 맞춤
// 도적 · 사냥꾼 · 마법사는 2026-10-22 Lim 「소리가 너무 작다」로 다시 만들며 조금 더 크게
// 전사 3안 「너무 작다」, 검사 (아까 저음) 「조금만 더 크게」도 함께
Object.assign(VOL, { 'atk-rogue': 0.6, 'atk-archer': 0.55, 'atk-mage': 0.45, 'atk-hunter': 0.6, 'atk-warrior': 0.7, 'atk-swordsman': 0.5 }); // 마법사 3안은 「너무 크다, 조금 줄이자」 (2026-10-22)
// 드루이드는 「소리가 잘 안 들린다」 (2026-10-22): 다시 만들며 다른 직업보다 크게
Object.assign(VOL, { 'heal-druid': 0.75, 'renew-druid': 0.85, 'hymn-druid': 1 });
for (const n of ['growth', 'wildflower', 'nature-cleanse', 'bark', 'rebirth', 'spring-rain', 'forest-memory', 'old-tree', 'crit']) VOL[`druid-${n}`] = 0.85;
/** 보스 기술 특성 착탄 (boss-<특성>-<hit|wave|ground>, scripts/sfx/boss.mjs) */
const BOSS_THEME = /^boss-[a-z]+-(hit|wave|ground|cast)$/;
/** 6직업 기술 소리 (class-sound, 2026-10-22): 사제 소리처럼 */
const CLASS_SND = /^(druid|paladin|shaman|monk|astrologer|warder)-/;
const volOf = (n: string) => VOL[n] ?? (n.endsWith('-cast') || n.startsWith('bc-') ? 0.8 : BOSS_THEME.test(n) ? 1 : CLASS_SND.test(n) ? 0.7 : n.startsWith('ab-') || n.startsWith('spec-') ? 0.6 : n.startsWith('atk-') ? 0.42 : n.startsWith('priest-') ? 0.65 : n.startsWith('attack-') ? 0.5 : n.startsWith('ally-') ? 0.6 : n.startsWith('magic-') ? 0.65 : n.startsWith('heal-') ? 0.55 : n.startsWith('renew-') ? 0.7 : n.startsWith('debuff-') ? 0.6 : 0.85);
/** 같은 소리를 다시 울리기까지 (ms). 20인 판에서 쌓이지 않게 (16 7-2) */
const GAP: Record<string, number> = { proc: 1200, heart: 900, chime: 250, 'mob-down': 150, 'ally-hurt': 300, shield: 350, parry: 250, 'status-stagger': 900, 'boss-impact': 200, 'boss-wave': 300, 'boss-zone': 300, 'stone-break': 300, 'warn-alert': 400 };
const gapOf = (n: string) => GAP[n] ?? (BOSS_THEME.test(n) || n.startsWith('bc-') ? 200 : n.startsWith('ab-') ? 250 : n.startsWith('atk-') ? 100 : n === 'priest-relay-hop' ? 350 : n === 'priest-crit' ? 450 : n.startsWith('attack-') ? 220 : n.startsWith('ally-') ? 450 : n.startsWith('magic-') ? 300 : n.startsWith('debuff-') ? 400 : n.startsWith('renew-') ? 150 : 60);
/** 우선순위 (16 7-2): 소리가 많이 겹치면 낮은 것부터 안 냄 */
const PRIO: Record<string, number> = { heart: 3, buster: 3, aoe: 3, zone: 3, death: 3, 'boss-enrage': 3, 'boss-phase': 3, 'boss-impact': 3, 'boss-wave': 3, 'boss-zone': 3, 'warn-alert': 3, 'boss-down': 3, 'alarm-rule': 3, 'boss-aggro': 2, burst: 3, crit: 2, dispel: 2, chime: 2, revive: 2, gauge: 2, win: 3, lose: 3 };
const prioOf = (name: string) => PRIO[name] ?? (name.endsWith('-cast') || name.startsWith('bc-') || CLASS_SND.test(name) ? 2 : BOSS_THEME.test(name) ? 3 : name.startsWith('atk-') ? 0 : name === 'priest-rescue' || name === 'priest-ready' ? 3 : /^(heal|renew|hymn|priest)-/.test(name) ? 2 : 1);
const MAX_VOICES = 10;

let on = true;
/** 설정 「효과음」 크기 (0~1) */
let volume = 1;
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

/** 설정 「효과음」 크기 (0~1, 설정 막대): 모든 효과음 · 합성음이 지나는 출구 크기 */
export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (out && ctx) (out as GainNode).gain.setTargetAtTime(0.9 * volume, ctx.currentTime, 0.03);
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
      master.gain.value = 0.9 * volume;
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

/**
 * 보스 기술 착탄 소리 (특성 boss-<특성>-<방식> · 주요 보스 전용 bs-…, 수백 개): 앱 시작 때 모두 풀면 폰 메모리를 많이 써서
 * 전투를 시작할 때 그 보스 것만 풂 (preloadSfx). 다른 보스 것은 내려 놓음
 */
const perBattle = (n: string) => n.startsWith('bs-') || n.startsWith('bc-') || BOSS_THEME.test(n);

/** Decode before the battle countdown ends, instead of waiting for idle menu warming. boss = 이번 보스의 기술 착탄 소리 */
export async function preloadSfx(boss: string[] = []): Promise<void> {
  if (!audioCtx()) return;
  const keep = new Set(boss);
  for (const n of [...bufs.keys(), ...loading.keys()]) if (perBattle(n) && !keep.has(n)) { bufs.delete(n); loading.delete(n); }
  const names = [...Object.keys(urlOf).filter(n => !perBattle(n)), ...boss.filter(n => n in urlOf)];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let name = names.pop(); name; name = names.pop()) await load(name);
  }));
}

/** 처음 소리 문맥을 만들 때: 쉬는 틈에 모든 소리를 하나씩 미리 풀어 둠 (메뉴 · 공통 먼저) */
function warm(): void {
  const names = Object.keys(urlOf).filter(n => !perBattle(n)).sort((a, b) => Number(b.startsWith('ui-')) - Number(a.startsWith('ui-')));
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
  // 파티원 공격 (prio 0)도 보통 소리만큼 자리를 줌 (2026-10-21 Lim 「공격 효과음이 잘 안 들린다」: 6개 넘게 울리면 거의 다 빠졌음). 힐 · 경고 몫 3개는 남김
  const budget = prio <= 1 ? MAX_VOICES - 3 : MAX_VOICES; // Reserve space for healing and warnings.
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

/**
 * 시전음 파일 (2026-10-21 Lim 「시전음은 따로 만들어서 알려줄 테니 직업 공동으로 적용할 수 있도록」):
 * 직업 파일 src/sfx/cast-loop-<직업>.ogg가 있으면 그것, 없으면 공통 src/sfx/cast-loop.ogg, 둘 다 없으면 조용 (null)
 */
export const castLoopFor = (hero: string): string | null =>
  `cast-loop-${hero}` in urlOf ? `cast-loop-${hero}` : 'cast-loop' in urlOf ? 'cast-loop' : null;
// 사제 시전음 (Lim이 준 파일, 원본 RMS 약 −13 dBFS): 효과음 아래로 깔리게 줄임
VOL['cast-loop-priest'] = 0.45;

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
