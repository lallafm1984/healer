/**
 * 서버 부르기 (Supabase RPC, 기획 120 9-5). 지금은 app_boot 하나: 서버 시각 · 강제 업데이트 · 점검 · 원격 스위치 · 공지.
 * 게스트도 공개 키로 부름. 서버에 못 닿으면 null (게임은 그대로, 다음에 다시)
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SUPABASE_KEY, SUPABASE_URL, serverOn } from './server-config';
import { elapsedNow, syncServer } from './time';

export interface BootConfig {
  /** 이보다 낮은 앱은 업데이트 전까지 막음 */
  min_version: number;
  /** 이보다 낮으면 새 버전 알림 */
  latest_version: number;
  store_url: string | null;
  update_message: string | null;
  maintenance: boolean;
  maintenance_message: string | null;
  flags: Record<string, unknown>;
}
export interface Notice { id: number; title: string; body: string; popup: boolean; starts_at: number }
export interface Boot { now: number; config: BootConfig | null; notices: Notice[] }

const TIMEOUT_MS = 8000;
const NOTICE_KEY = 'healer.notices';

/**
 * 머리글: apikey = 공개 키. Authorization = 로그인 사용자 토큰, 없으면 옛 anon 키 (JWT)일 때만 같은 키
 * (새 publishable 키 sb_publishable_… 는 JWT가 아니라 Authorization에 넣지 않음)
 */
export function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  const bearer = token ?? (SUPABASE_KEY.startsWith('eyJ') ? SUPABASE_KEY : '');
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  return h;
}

/** RPC 한 번 (POST /rest/v1/rpc/<이름>). token = 로그인 사용자 토큰 (없으면 공개 키) */
export async function rpc<T>(name: string, args: Record<string, unknown>, token?: string): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(args),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return (await res.json()) as T;
  } finally { clearTimeout(timer); }
}

export const platform = (): string => Capacitor.getPlatform();

let version: number | null = null;
/** 앱 버전 = 안드로이드 versionCode (CI 실행 번호). 웹은 0 */
export async function appVersion(): Promise<number> {
  if (version != null) return version;
  if (Capacitor.isNativePlatform()) {
    try { version = Number((await App.getInfo()).build) || 0; } catch { version = 0; }
  } else version = 0;
  return version;
}

let last: Boot | null = null;
/** 마지막으로 받은 app_boot (설정 「공지」 목록 · 원격 스위치) */
export const lastBoot = (): Boot | null => last;

/** 공지 목록: 이번에 받은 것, 못 받았으면 지난번에 받아 둔 것 */
export function noticeList(): Notice[] {
  if (last) return last.notices;
  try { return JSON.parse(globalThis.localStorage?.getItem(NOTICE_KEY) || '[]') as Notice[]; } catch { return []; }
}

/** 원격 스위치 (app_config.flags). 못 받았으면 dflt */
export const remoteFlag = (k: string, dflt: boolean): boolean => {
  const v = last?.config?.flags?.[k];
  return typeof v === 'boolean' ? v : dflt;
};

/**
 * 앱이 켜질 때 (count = true, 버전별 켠 수를 셈) · 앞으로 올 때 (false). 받으면 게임 시각을 서버에 맞춤.
 * 서버 주소가 없거나 못 닿으면 null
 */
export async function appBoot(count: boolean): Promise<Boot | null> {
  if (!serverOn()) return null;
  const v = await appVersion();
  const e0 = elapsedNow();
  try {
    const r = await rpc<Boot>('app_boot', { p_platform: platform(), p_version: v, p_count: count });
    syncServer(Number(r.now), e0, elapsedNow());
    last = { now: Number(r.now), config: r.config, notices: Array.isArray(r.notices) ? r.notices : [] };
    try { globalThis.localStorage?.setItem(NOTICE_KEY, JSON.stringify(last.notices)); } catch { /* 그만 */ }
    return last;
  } catch { return null; }
}
