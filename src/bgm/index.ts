/**
 * 배경음 (2026-10-21 Lim 「mureka를 이용한 배경음 만들기」 · 「노래는 자르지 말고 … 구간별로 등록」).
 * 곡은 구간마다 여럿: 이 폴더의 <구간>-<번호>.ogg (Mureka로 만들어 배경음 등록판에 올린 곡을 scripts/bgm/import.py가 줄여 넣음).
 * 곡을 자르지 않고 통째로 틀고, 끝나면 그 구간의 다음 곡. 구간이 바뀌면 줄이며 바꾸고, 돌아오면 멈췄던 곡 · 자리부터 이어서.
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

export type BgmKey = 'title' | 'lobby' | 'victory' | 'defeat' | AdventureRegionKey;

let battleRegion: AdventureRegionKey = 'rust';
/** 전투 시작 때 (battle start): 이번 전투 장소의 지역 */
export function setBattleRegion(k: AdventureRegionKey): void { battleRegion = k; }
let resultWin = true;
/** 결과 화면에 들어갈 때 (result enter): 이긴 판인가 (2026-10-21 Lim 「전투 종료후 결과 화면의 사운드」) */
export function setResultWin(v: boolean): void { resultWin = v; }
/** 곡이 아직 없는 구간은 이 구간 곡으로 (결과 화면 곡이 없으면 마을 곡) */
const FALLBACK: Partial<Record<BgmKey, BgmKey>> = { victory: 'lobby', defeat: 'lobby' };

/** 화면 → 구간. 첫 장 (타이틀 · 이야기 · 튜토리얼 카드) = title, 전투 · 구간 사이 휴식 = 그 장소의 지역, 결과 = victory · defeat, 그 밖 = lobby (마을) */
export function bgmFor(screen: string): BgmKey {
  if (screen === 'battle' || screen === 'rest') return battleRegion;
  if (screen === 's-settle') return resultWin ? 'victory' : 'defeat';
  if (screen === 's-title' || screen === 's-story' || screen === 's-tut') return 'title';
  return 'lobby';
}

/** 구간마다 크기 (효과음보다 아래, 전투 = 지역 곡은 효과음이 많아 더 작게 BATTLE_VOL). 곡은 넣을 때 같은 세기로 맞춤 */
const VOL: Record<string, number> = { title: 0.55, lobby: 0.45, victory: 0.5, defeat: 0.45 };
const BATTLE_VOL = 0.33;
const volOf = (k: string) => VOL[k] ?? BATTLE_VOL;
const FADE_IN = 1.6, FADE_OUT = 1.0;
/** 결과 화면은 승리 · 패배 소리가 먼저 울리게 늦게 */
const DELAY: Record<string, number> = { 's-settle': 1.8 };

let on = true;
let want: BgmKey | null = null;
let cur: { key: BgmKey; el: HTMLAudioElement; idx: number } | null = null;
/** 구간마다 멈췄던 곡 · 자리 (돌아오면 이어서) */
const pos = new Map<string, { idx: number; t: number }>();
let token = 0;
let unlockWait = false;

/** 이 구간의 곡 수 */
export const bgmCount = (key: string): number => lists[key]?.length ?? 0;

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
  void el.play().catch(() => {
    if (unlockWait) return;
    unlockWait = true;
    const go = () => {
      unlockWait = false;
      window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true);
      if (cur && on && !document.hidden) void cur.el.play().catch(() => {});
    };
    window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
  });
}

function stop(): void {
  if (!cur) return;
  const { el, key, idx } = cur;
  pos.set(key, { idx, t: el.currentTime || 0 });
  cur = null;
  ramp(el, 0, FADE_OUT, () => { el.pause(); el.removeAttribute('src'); el.load(); });
}

function begin(key: BgmKey, idx: number, at: number, delay: number, my: number): void {
  const list = lists[key];
  const el = new Audio();
  el.preload = 'auto';
  el.volume = 0;
  el.src = list[idx % list.length];
  const vol = volOf(key);
  el.addEventListener('loadedmetadata', () => { if (at > 0 && at < el.duration - 5) el.currentTime = at; }, { once: true });
  // 곡이 끝나면 그 구간의 다음 곡 (짧게 쉬었다가)
  el.addEventListener('ended', () => {
    if (cur?.el !== el) return;
    const next = (idx + 1) % list.length;
    cur = null;
    el.removeAttribute('src'); el.load();
    if (my === token) begin(key, next, 0, 1.2, my);
  });
  cur = { key, el, idx: idx % list.length };
  window.setTimeout(() => {
    if (my !== token || cur?.el !== el || document.hidden) return;
    tryPlay(el);
    ramp(el, vol, FADE_IN);
  }, delay * 1000);
}

function apply(delay = 0): void {
  const my = ++token;
  const fb = want ? FALLBACK[want] : undefined;
  const key = !on || !want ? null : bgmCount(want) ? want : fb && bgmCount(fb) ? fb : null;
  if (cur && cur.key === key) { if (cur.el.paused && !document.hidden) { tryPlay(cur.el); ramp(cur.el, volOf(key!), FADE_IN); } return; }
  stop();
  if (!key) return;
  // 처음 트는 구간은 곡 하나를 골라서 (여럿이면 매번 같은 곡으로 시작하지 않게), 들었던 구간은 멈췄던 곳부터
  const p = pos.get(key);
  begin(key, p ? p.idx : Math.floor(Math.random() * bgmCount(key)), p ? p.t : 0, delay, my);
}

/** 화면이 바뀜 (kit go · 전투 show가 부름) */
export function syncBgm(screen: string): void {
  const next = bgmFor(screen);
  if (next === want) return;
  want = next;
  apply(DELAY[screen] ?? 0);
}

/** 설정 「배경음」 */
export function setBgmOn(v: boolean): void {
  if (on === v) return;
  on = v;
  apply();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!cur) return;
    if (document.hidden) cur.el.pause();
    else if (on) tryPlay(cur.el);
  });
}

/** 화면 테스트용: 지금 구간 · 곡 */
if (typeof window !== 'undefined') {
  (window as unknown as { __bgm: () => object }).__bgm = () => ({ want, on, playing: cur?.key ?? null, idx: cur?.idx ?? null, paused: cur?.el.paused ?? null, volume: cur?.el.volume ?? null, lists: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])) });
}
