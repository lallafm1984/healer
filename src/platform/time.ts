/**
 * 게임 시각 (기획 120 9-3, 2026-10-29 Lim 「서버시간을 기준으로하여 로컬 시계영향을 안받게」). 기기 시계 (Date.now)는 쓰지 않는다.
 * 「지금」 = 기준 시각 + (지금 경과 시계 − 기준 때 경과 시계). 기준 시각은 서버 (app_boot)가 준 시각, 경과 시계는 부팅 뒤 흐른 시간
 * (안드로이드 SystemClock.elapsedRealtime: 잠든 시간도 세고 사람이 못 바꿈, 네이티브 ElapsedClock 플러그인).
 * 다른 부팅이면 (재부팅 뒤 아직 서버를 못 봄) 「마지막으로 알던 지금 + 이번 부팅 뒤 흐른 시간」: 실제보다 늦거나 같고 앞서 가지 않는다.
 * 서버를 한 번도 못 본 기기는 앱을 만든 시각 (__BUILD_TIME__)에서 시작. 서버 주소가 없는 빌드 (개발 · 화면 · 단위 테스트)만 기기 시계.
 * 앱 안에서는 경과 시계를 performance.now로 이어 세고 (잠든 동안 덜 셀 수 있음 = 늦는 쪽), 앞으로 올 때 네이티브 값으로 다시 맞춤
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { serverOn } from './server-config';

interface ElapsedClockPlugin { now(): Promise<{ elapsed: number; boot: string }> }
const Native = registerPlugin<ElapsedClockPlugin>('ElapsedClock');

const KEY = 'healer.clock';
/** 기준: t = 그 순간의 게임 시각 (ms), e = 그 순간의 경과 시계 (ms), b = 부팅 표시, s = 서버 시각에서 이어 옴 */
export interface Anchor { t: number; e: number; b: string; s: boolean }

/** 그 경과 시계 때의 게임 시각 */
export const timeAt = (a: Anchor, e: number): number => a.t + (e - a.e);
/** 다른 부팅에서 온 기준을 이번 부팅으로: 마지막으로 알던 시각 + 이번 부팅 뒤 흐른 시간 e (부팅은 그 뒤에 일어났으므로 앞서 가지 않음) */
export const carry = (a: Anchor, boot: string, e: number): Anchor => (a.b === boot ? a : { t: a.t + e, e, b: boot, s: a.s });
/** 서버 시각을 받은 기준. 요청 앞뒤 경과 시계의 가운데를 그 시각으로 */
export const fromServer = (serverMs: number, e0: number, e1: number, boot: string): Anchor => ({ t: serverMs, e: (e0 + e1) / 2, b: boot, s: true });

const perf = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);
let base = { elapsed: 0, perf: 0, boot: '' };
let anchor: Anchor | null = null;
let ready = false;
let savedAt = -Infinity;

/** 지금 경과 시계 (ms) */
export const elapsedNow = (): number => base.elapsed + (perf() - base.perf);

function load(): Anchor | null {
  try {
    const a = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null') as Anchor | null;
    return a && Number.isFinite(a.t) && Number.isFinite(a.e) && typeof a.b === 'string' ? a : null;
  } catch { return null; }
}
/** 지금 순간으로 기준을 옮겨 저장 (재부팅 뒤 「마지막으로 알던 지금」이 최근 값이 되게) */
function persist(): void {
  if (!anchor) return;
  const e = elapsedNow();
  anchor = { ...anchor, t: timeAt(anchor, e), e };
  savedAt = e;
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(anchor)); } catch { /* 저장소가 없으면 그만 */ }
}

async function readNative(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await Native.now();
      if (Number.isFinite(r.elapsed) && r.boot) { base = { elapsed: r.elapsed, perf: perf(), boot: String(r.boot) }; return; }
    } catch { /* 플러그인이 없는 옛 앱 → 아래 */ }
  }
  // 웹 (개발 서버): 페이지를 연 뒤 흐른 시간, 페이지마다 다른 「부팅」 → 늘 늦는 쪽
  const origin = typeof performance !== 'undefined' ? Math.round(performance.timeOrigin) : 0;
  base = { elapsed: perf(), perf: perf(), boot: `web-${origin}` };
}

/** 앱이 켜질 때 한 번 (main.ts, 저장 · 리셋보다 먼저). 서버 주소가 없으면 할 일 없음 */
export async function initClock(): Promise<void> {
  if (!serverOn()) { ready = true; return; }
  await readNative();
  const e = elapsedNow();
  anchor = carry(load() ?? { t: __BUILD_TIME__, e, b: base.boot, s: false }, base.boot, e);
  ready = true;
  persist();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persist();
      else void resumeClock();
    });
  }
}

/** 앱이 다시 앞으로 올 때: 잠든 동안 performance.now가 덜 셌을 수 있어 네이티브 경과 시계로 다시 맞춤 */
export async function resumeClock(): Promise<void> {
  if (!serverOn() || !anchor) return;
  const t = now();
  await readNative();
  const e = elapsedNow();
  anchor = carry(anchor, base.boot, e);
  // 같은 부팅이면 이어진 그대로, 경과 시계가 이 앱 안에서 거꾸로 갈 일은 없지만 혹시 늦어지면 앞서 본 시각 밑으로는 안 내려감
  if (timeAt(anchor, e) < t) anchor = { ...anchor, t, e };
  persist();
}

/** 서버 시각을 받음 (app_boot). e0 · e1 = 요청 앞뒤 경과 시계 */
export function syncServer(serverMs: number, e0: number, e1: number): void {
  if (!serverOn() || !Number.isFinite(serverMs)) return;
  anchor = fromServer(serverMs, e0, e1, base.boot);
  persist();
}

/** 게임 시각 (ms). 리셋 · 휴식 · 길드 공고 · 정산이 모두 이것을 씀 */
export function now(): number {
  if (!serverOn()) return Date.now();
  if (!ready || !anchor) return load()?.t ?? __BUILD_TIME__; // initClock 전 (첫 저장 만들기 정도): 마지막으로 알던 시각
  const e = elapsedNow();
  if (e - savedAt > 30_000) persist();
  return timeAt(anchor, e);
}

/** 서버 시각에서 이어 온 시각인가 (아니면 앱을 만든 시각에서 센 것) */
export const serverSynced = (): boolean => !serverOn() || !!anchor?.s;
