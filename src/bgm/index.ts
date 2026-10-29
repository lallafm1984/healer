/**
 * 배경음 (2026-10-21 Lim 「mureka를 이용한 배경음 만들기」 · 「노래는 자르지 말고 … 구간별로 등록」).
 * 곡은 구간마다 여럿: 이 폴더의 <구간>-<번호>.ogg (Mureka로 만들어 배경음 등록판에 올린 곡을 scripts/bgm/import.py가 줄여 넣음).
 * 곡을 자르지 않고 통째로 틀고, 끝나면 그 구간의 다음 곡. 구간이 바뀌면 줄이며 바꾸고, 돌아오면 멈췄던 곡 · 자리부터 이어서.
 * 차례는 무작위 (2026-10-28 Lim 「순차 재생이 아닌 랜덤재생 … 4개 다 재생되었다면 다시 처음 나온 순서로 순차재생」): 구간을 처음 틀 때 곡 차례를 한 번 섞고 (playOrder), 다 돌면 그 차례 그대로 다시.
 * 화면이 바뀌면 (kit go · 전투 show) syncBgm(화면 id) → 구간은 bgmFor. 전투 곡은 지역마다 (Lim 「탐험 던전 레이드는 각 지역에 맞는 테마 곡」):
 * 전투 시작 때 setBattleRegion으로 그 장소의 지역 (출전 화면 지역, data/adventure-regions)을 알려 두고, 그 지역의 탐험 · 던전 · 레이드가 같은 곡을 씀.
 * 설정 「배경음」을 끄면 멈춤 (효과음 「소리」와 따로). 앱을 내리면 멈추고 돌아오면 이어서. 곡이 없는 구간은 조용히.
 * 길게 도는 곡이라 통째로 풀어 두지 않고 <audio>로 흘려 틂 (메모리를 거의 안 씀).
 */
import type { AdventureRegionKey } from '../data/adventure-regions';

const files = import.meta.glob<string>('./*.{ogg,opus,mp3,m4a}', { eager: true, query: '?url', import: 'default' });

/** 구간 → 곡 주소 (번호 순) */
const lists: Record<string, string[]> = {};
for (const [path, url] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
  const m = /^\.\/(.+)-\d+\.\w+$/.exec(path);
  if (m) (lists[m[1]] ??= []).push(url);
}

export type BgmKey = 'title' | 'lobby' | 'victory' | 'defeat' | AdventureRegionKey | `place-${string}`;

let battleRegion: AdventureRegionKey = 'rust';
let battlePlace: string | null = null;
/**
 * 전투 시작 때 (battle start): 이번 전투 장소의 지역 · 장소 key. 장소 전용 곡 (place-<장소>-<n>.ogg, 113 초반 추가 스테이지부터)이 있으면 그 곡, 없으면 지역 곡
 */
export function setBattleRegion(k: AdventureRegionKey, place?: string): void { battleRegion = k; battlePlace = place ?? null; }
let resultWin = true;
/** 결과 화면에 들어갈 때 (result enter): 이긴 판인가 (2026-10-21 Lim 「전투 종료후 결과 화면의 사운드」) */
export function setResultWin(v: boolean): void { resultWin = v; }
/** 곡이 아직 없는 구간은 이 구간 곡으로 (결과 화면 곡이 없으면 마을 곡) */
const FALLBACK: Partial<Record<BgmKey, BgmKey>> = { victory: 'lobby', defeat: 'lobby' };
/** 한 번만 트는 구간 (결과 곡 = 30초 안팎, 처음부터 세게, Lim 「시작부터 강렬하게」): 바로 크게 시작, 끝나면 FALLBACK 구간 (마을 곡)이 이어짐 */
const ONE_SHOT = new Set<BgmKey>(['victory', 'defeat']);

/**
 * 화면 → 구간. 첫 장 (타이틀 · 이야기 · 튜토리얼 카드) = title, 전투 = 그 장소의 지역, 결과 = victory · defeat, 그 밖 = lobby (마을).
 * 구간 사이 쉬는 화면은 배경음 없이 쉬는 효과음만 (2026-10-21 Lim 「쉬는 화면에서는 배경음악이 없이 효과음만」, battle rest-loop): null = 조용히, 전투로 돌아가면 멈췄던 자리부터
 */
export function bgmFor(screen: string): BgmKey | null {
  if (screen === 'rest') return null;
  if (screen === 'battle') return battlePlace && lists[`place-${battlePlace}`] ? `place-${battlePlace}` : battleRegion;
  if (screen === 's-settle') return resultWin ? 'victory' : 'defeat';
  if (screen === 's-title' || screen === 's-story' || screen === 's-tut') return 'title';
  return 'lobby';
}

/** 구간마다 크기 (효과음보다 아래, 전투 = 지역 곡은 효과음이 많아 더 작게 BATTLE_VOL). 곡은 넣을 때 같은 세기로 맞춤 */
const VOL: Record<string, number> = { title: 0.55, lobby: 0.45, victory: 0.5, defeat: 0.45 };
const BATTLE_VOL = 0.33;
/** 설정 「배경음」 크기 (0~1) */
let userVol = 1;
const volOf = (k: string) => (VOL[k] ?? BATTLE_VOL) * userVol;
const FADE_IN = 1.6, FADE_OUT = 1.0;
/** 화면마다 늦게 시작 (초). 결과 곡은 처음부터 세게라 바로 */
const DELAY: Record<string, number> = {};

let on = true;
let paused = false;
let want: BgmKey | null = null;
let cur: { key: BgmKey; el: HTMLAudioElement; idx: number; step: number } | null = null;
/** 화면 전환 중 작아지고 있는 이전 곡도 일시정지에 포함한다. */
const retiring = new Set<HTMLAudioElement>();
/** 구간마다 멈췄던 차례 (playOrder 안의 몇 번째) · 자리 (돌아오면 이어서) */
const pos = new Map<string, { step: number; t: number }>();
/** 구간마다 곡 차례 (앱을 켠 동안 그대로) */
const orders = new Map<string, number[]>();
let token = 0;
let unlockWait = false;

/** 이 구간의 곡 수 */
export const bgmCount = (key: string): number => lists[key]?.length ?? 0;

/** 0 ~ n−1을 고르게 섞음 (Fisher–Yates) */
export function shuffled(n: number, rnd: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** 구간의 곡 차례: 처음 부를 때 한 번 섞고 그 뒤로는 같은 차례 (곡 수가 바뀌면 다시 섞음) */
export function playOrder(key: string, n = bgmCount(key), rnd: () => number = Math.random): number[] {
  let o = orders.get(key);
  if (!o || o.length !== n) { o = shuffled(n, rnd); orders.set(key, o); }
  return o;
}

/** 소리 크기를 서서히 (HTMLAudioElement.volume, 50 ms마다) */
function ramp(el: HTMLAudioElement, to: number, sec: number, then?: () => void): void {
  const from = el.volume, t0 = performance.now();
  const prev = (el as unknown as { _ramp?: number })._ramp;
  if (prev) clearInterval(prev);
  const id = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(id); then?.(); }
  }, 50);
  (el as unknown as { _ramp?: number })._ramp = id;
}

/** 브라우저가 첫 누름 전에는 소리를 막으면 (앱 웹뷰는 안 막음) 첫 누름에 다시 */
function tryPlay(el: HTMLAudioElement): void {
  if (!on || paused || document.hidden) return;
  void el.play().catch(() => {
    if (unlockWait) return;
    unlockWait = true;
    const go = () => {
      unlockWait = false;
      window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true);
      if (cur && on && !paused && !document.hidden) void cur.el.play().catch(() => {});
    };
    window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
  });
}

function stop(): void {
  if (!cur) return;
  const { el, key, step } = cur;
  pos.set(key, { step, t: el.currentTime || 0 });
  cur = null;
  retiring.add(el);
  ramp(el, 0, FADE_OUT, () => { el.pause(); el.removeAttribute('src'); el.load(); retiring.delete(el); });
}

function begin(key: BgmKey, step: number, at: number, delay: number, my: number): void {
  const list = lists[key];
  const order = playOrder(key, list.length);
  step %= list.length;
  const idx = order[step];
  const el = new Audio();
  el.preload = 'auto';
  el.volume = 0;
  el.src = list[idx];
  const vol = volOf(key);
  el.addEventListener('loadedmetadata', () => { if (at > 0 && at < el.duration - 5) el.currentTime = at; }, { once: true });
  // 곡이 끝나면 그 구간 차례의 다음 곡 (짧게 쉬었다가, 다 돌면 같은 차례 처음부터). 한 번만 트는 구간은 이어 마을 곡
  el.addEventListener('ended', () => {
    if (cur?.el !== el) return;
    cur = null;
    el.removeAttribute('src'); el.load();
    if (my !== token) return;
    if (ONE_SHOT.has(key)) {
      const fb = FALLBACK[key];
      pos.delete(key); // 다음 결과 화면은 처음부터
      if (fb && bgmCount(fb)) { const p = pos.get(fb); begin(fb, p ? p.step : 0, p ? p.t : 0, 0.8, my); }
      return;
    }
    begin(key, step + 1, 0, 1.2, my);
  });
  cur = { key, el, idx, step };
  window.setTimeout(() => {
    if (my !== token || cur?.el !== el || paused || document.hidden) return;
    tryPlay(el);
    if (ONE_SHOT.has(key)) el.volume = vol; else ramp(el, vol, FADE_IN);
  }, delay * 1000);
}

function apply(delay = 0): void {
  const my = ++token;
  const fb = want ? FALLBACK[want] : undefined;
  const key = !on || !want ? null : bgmCount(want) ? want : fb && bgmCount(fb) ? fb : null;
  if (cur && cur.key === key) { if (cur.el.paused && !paused && !document.hidden) { tryPlay(cur.el); ramp(cur.el, volOf(key!), FADE_IN); } return; }
  stop();
  if (!key) return;
  // 처음 트는 구간은 섞은 차례의 첫 곡부터, 들었던 구간은 멈췄던 곳부터 (한 번만 트는 곡은 늘 처음부터)
  if (ONE_SHOT.has(key)) pos.delete(key);
  const p = pos.get(key);
  begin(key, p ? p.step : 0, p ? p.t : 0, delay, my);
}

/** 화면이 바뀜 (kit go · 전투 show가 부름) */
export function syncBgm(screen: string): void {
  // 설정은 들어오기 전 곡을 이어 듣는다. 결과로 돌아와도 같은 곡을 다시 시작하지 않는다.
  if (screen === 's-settings') return;
  const next = bgmFor(screen);
  if (next === want) return;
  want = next;
  apply(DELAY[screen] ?? 0);
}

/** 전투 일시정지: 곡과 재생 위치를 유지하고, 계속할 때 같은 자리에서 이어 듣는다. */
export function setBgmPaused(v: boolean): void {
  if (paused === v) return;
  paused = v;
  if (v) {
    cur?.el.pause();
    for (const el of retiring) el.pause();
  } else if (cur && on && !document.hidden) {
    tryPlay(cur.el);
    ramp(cur.el, volOf(cur.key), 0.15);
  }
}

/** 설정 「배경음」 크기 (0~1, 설정 막대). 지금 곡에도 바로 */
export function setBgmVolume(v: number): void {
  userVol = Math.max(0, Math.min(1, v));
  if (cur && !cur.el.paused) ramp(cur.el, volOf(cur.key), 0.15);
}

/** 설정 「배경음」 */
export function setBgmOn(v: boolean): void {
  if (on === v) return;
  on = v;
  apply();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cur?.el.pause(); for (const el of retiring) el.pause(); }
    else if (cur && on) tryPlay(cur.el);
  });
}

/** 화면 테스트용: 지금 구간 · 곡 */
if (typeof window !== 'undefined') {
  (window as unknown as { __bgm: () => object }).__bgm = () => ({ want, on, playing: cur?.key ?? null, idx: cur?.idx ?? null, step: cur?.step ?? null, order: cur ? orders.get(cur.key) ?? null : null, paused: cur?.el.paused ?? null, volume: cur?.el.volume ?? null, lists: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])) });
}
