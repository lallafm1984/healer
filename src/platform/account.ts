/**
 * 계정 · 서버 백업 통신 (기획 120 9-2, 2026-10-29 Lim 결정: 구글 로그인 한 사람만 백업, 연결은 설정에서 사용자가 고를 때만).
 * 처음 켜면 Supabase 익명 계정 (2026-10-29 Lim 「일단 첫 사용자는 수파베이스에 익명로그인으로 되며, 구글계정 활성화하면 연동되는 방식으로 하자」),
 * 설정에서 구글을 연결하면 같은 사용자 ID로 연동 (linkIdentity). 그 구글 계정이 이미 다른 사용자에 붙어 있으면 그 계정으로 로그인 (signInWithIdToken).
 * 구글 로그인은 Credential Manager (@capgo/capacitor-social-login).
 * 여기는 통신만. 언제 올리고 무엇을 고르는지는 screens/account.ts, 저장은 RPC (upload_save · download_save · choose_progress · delete_account · log_login)
 */
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GOOGLE_WEB_CLIENT_ID, SUPABASE_KEY, SUPABASE_URL, serverOn } from './server-config';
import { appVersion, platform } from './server';
import { installId } from './install';
import { accountFetch } from './network';

let sb: SupabaseClient | null = null;
/** Supabase 클라이언트 (서버 주소가 없으면 null). 로그인 정보는 기기 저장소 healer.auth */
export function client(): SupabaseClient | null {
  if (!serverOn()) return null;
  return (sb ||= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: 'healer.auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: accountFetch },
  }));
}

/** 구글 로그인을 쓸 수 있나 (서버 · 웹 클라이언트 ID · 앱) */
export const googleReady = (): boolean => serverOn() && !!GOOGLE_WEB_CLIENT_ID && Capacitor.isNativePlatform();

export interface Me { id: string; email: string | null; anonymous: boolean }
const toMe = (u: { id: string; email?: string | null; is_anonymous?: boolean }): Me => ({ id: u.id, email: u.email ?? null, anonymous: !!u.is_anonymous });
/** 콜백 안에서는 인증 API를 기다리지 않는다 (SDK의 인증 잠금을 다시 잡지 않게). */
export function watchAccount(fn: (user: Me | null) => void): () => void {
  const subscription = client()?.auth.onAuthStateChange((_event, session) => fn(session?.user ? toMe(session.user) : null)).data.subscription;
  return () => subscription?.unsubscribe();
}
/** 지금 로그인한 사람 (기기에 남은 로그인 정보, 익명 포함) */
export async function me(): Promise<Me | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user ? toMe(data.session.user) : null;
}

/** 익명 계정 만들기 (처음 켤 때 · 로그아웃 · 계정 삭제 뒤). Supabase에서 익명 로그인이 꺼져 있거나 연결이 없으면 null */
export async function startAnonymous(): Promise<Me | null> {
  const c = client();
  if (!c) return null;
  try {
    const { data, error } = await c.auth.signInAnonymously();
    return error || !data.user ? null : toMe(data.user);
  } catch { return null; }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
let socialInit: Promise<void> | null = null;

/**
 * 구글 연결: 지금 익명 계정이면 같은 사용자 ID로 연동 (mode 'link'), 그 구글 계정이 이미 다른 사용자에 붙어 있거나
 * 익명 계정이 없으면 그 구글 계정으로 로그인 (mode 'sign_in', 사용자 ID가 바뀔 수 있음 → 진행 고르기).
 * nonce: 구글에는 SHA-256 해시, Supabase에는 원래 값 (토큰 다시 쓰기 막음). 실패하면 까닭 글을 던짐
 */
export async function connectGoogle(): Promise<{ user: Me; mode: 'link' | 'sign_in' }> {
  const c = client();
  if (!c || !googleReady()) throw new Error('준비 중');
  socialInit ||= SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' } }).then(() => undefined);
  await socialInit;
  const raw = crypto.randomUUID();
  const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  // scopes를 넘기지 않음: 기본 (openid · email · profile)으로 ID 토큰에 충분하고, 넘기면 안드로이드에서 MainActivity를 고치라며 거절함
  const res = await SocialLogin.login({ provider: 'google', options: { nonce: hashed } });
  const token = (res.result as { idToken?: string | null }).idToken;
  if (!token) throw new Error('구글 로그인 취소');
  const cur = (await c.auth.getSession()).data.session?.user;
  if (cur?.is_anonymous) {
    const { data, error } = await c.auth.linkIdentity({ provider: 'google', token, nonce: raw });
    if (!error && data.user) return { user: toMe(data.user), mode: 'link' };
    if (error && error.code !== 'identity_already_exists') throw new Error(error.message);
  }
  const { data, error } = await c.auth.signInWithIdToken({ provider: 'google', token, nonce: raw });
  if (error || !data.user) throw new Error(error?.message || '로그인 실패');
  return { user: toMe(data.user), mode: 'sign_in' };
}

/** 이 세션만 로그아웃. 실패하면 호출부가 진행을 지우지 않도록 오류를 전달한다. */
export async function signOut(): Promise<void> {
  const c = client();
  if (c) { const { error } = await c.auth.signOut({ scope: 'local' }); if (error) throw error; }
  if (Capacitor.isNativePlatform()) { try { await SocialLogin.logout({ provider: 'google' }); } catch { /* 그만 */ } }
}

/** 로그인한 사람의 RPC. 실패하면 던짐 */
async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const c = client();
  if (!c) throw new Error('서버 없음');
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export interface UploadResult { ok: boolean; rev?: number; latest_rev?: number; duplicate?: boolean; reason?: 'conflict' | 'paused' | 'too_big' | 'bad_save' | 'moved' | 'rate_limited' | 'newer_save'; level?: number; now?: number }
/** 이 설치가 이 계정의 현재 기기인가 (한 계정 = 한 기기, 9-2b). exists = 서버에 저장이 있음 */
export interface DeviceStatus { exists: boolean; active: boolean; claimed?: boolean; rev?: number }
export interface Download { exists: boolean; rev?: number; level?: number; v?: number; data?: unknown; updated_at?: number; now?: number }

export const uploadSave = async (data: unknown, baseRev: number, uploadId: string, clientAt: number): Promise<UploadResult> =>
  call<UploadResult>('upload_save', { p_data: data, p_base_rev: baseRev, p_upload_id: uploadId, p_app_version: await appVersion(), p_client_at: Math.round(clientAt), p_install: installId() });
export const downloadSave = (): Promise<Download> => call<Download>('download_save');
export const chooseProgress = async (keep: 'account' | 'device', accountRev: number | null, data: unknown, uploadId: string | null, clientAt: number): Promise<UploadResult> =>
  call<UploadResult>('choose_progress', { p_keep: keep, p_account_rev: accountRev, p_data: data, p_upload_id: uploadId, p_app_version: await appVersion(), p_client_at: Math.round(clientAt), p_install: installId() });
export const deviceStatus = (): Promise<DeviceStatus> => call<DeviceStatus>('device_status', { p_install: installId() });
export const deleteAccount = (): Promise<{ ok: boolean }> => call<{ ok: boolean }>('delete_account');

/** 로그인 기록 (첫 익명 · 구글 연동 · 구글 로그인 · 켬 · 로그아웃, 서버 login_logs 60일). 실패해도 그만 */
export async function logLogin(event: 'anon_start' | 'link' | 'sign_in' | 'open' | 'sign_out'): Promise<void> {
  try { await call('log_login', { p_event: event, p_platform: platform(), p_version: await appVersion() }); } catch { /* 그만 */ }
}
