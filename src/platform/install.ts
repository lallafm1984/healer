/**
 * 앱 설치 번호 (기획 120 9-2b, 2026-10-29 Lim 「한 계정 = 한 기기」): 서버가 「현재 기기」로 적는 값.
 * 처음 켤 때 무작위로 만들고, 기기 키 (네이티브 DeviceKey: ANDROID_ID 해시, 서버로 안 보냄)에 묶는다.
 * 앱을 지우면 함께 지워지고 (다시 깔면 새 번호 → 구글 연결 · 고르기로 다시 현재 기기),
 * 저장이 다른 폰으로 복사되면 (안드로이드 자동 백업 · 직접 복사) 기기 키가 달라 새 번호가 된다 (두 폰이 같은 번호를 쓰지 않게).
 * active = 서버가 이 설치를 현재 기기로 알려 준 적이 있음 (그 뒤 아니라고 하면 「다른 기기로 옮겨짐」)
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface DeviceKeyPlugin { key(): Promise<{ key: string }> }
const Native = registerPlugin<DeviceKeyPlugin>('DeviceKey');

const KEY = 'healer.install';
export interface InstallSave { id: string; dev: string; active: boolean }

/** 저장된 설치 번호를 쓸지: 기기 키가 같을 때만. 아니면 새 번호 (현재 기기였던 적 없음) */
export function pickInstall(saved: InstallSave | null, dev: string, mk: () => string): InstallSave {
  return saved && saved.id && saved.dev === dev ? saved : { id: mk(), dev, active: false };
}

let cur: InstallSave | null = null;
const store = (): Storage | undefined => globalThis.localStorage as Storage | undefined;
const write = (): void => { try { if (cur) store()?.setItem(KEY, JSON.stringify(cur)); } catch { /* 그만 */ } };

async function deviceKey(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try { const r = await Native.key(); if (r.key) return r.key; } catch { /* 옛 앱 */ }
  }
  return 'web';
}

/** 앱이 켜질 때 (계정보다 먼저) */
export async function initInstall(): Promise<InstallSave> {
  let saved: InstallSave | null = null;
  try { saved = JSON.parse(store()?.getItem(KEY) || 'null') as InstallSave | null; } catch { saved = null; }
  cur = pickInstall(saved, await deviceKey(), () => crypto.randomUUID());
  write();
  return cur;
}

export const installId = (): string | null => cur?.id ?? null;
export const wasActive = (): boolean => !!cur?.active;
/** 서버가 이 설치를 현재 기기로 알려 줌 */
export function markActive(): void { if (cur && !cur.active) { cur.active = true; write(); } }
/** 다른 기기로 옮겨진 뒤: 새 설치 번호 (이 폰에서 다시 구글 연결하면 고르기로 다시 현재 기기가 될 수 있게) */
export function renewInstall(): void { if (cur) { cur = { id: crypto.randomUUID(), dev: cur.dev, active: false }; write(); } }
