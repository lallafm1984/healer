/**
 * 구글 계정 · 자동 백업 (기획 120 9-2 · 3-1, 2026-10-29 Lim 「저장 백업은 구글 로그인 한 사람만 … 앱종료시 자동 저장 및 백업」 · 「구글 계정 연결(사용자 선택)」 · 「설정에만」).
 * - 설정 「계정」 판에서만 구글 연결 · 로그아웃 · 계정 삭제. 백업 · 불러오기 버튼은 없다.
 * - 앱을 끄거나 내릴 때 (pause) 저장이 바뀌었으면 올림. 같은 내용은 다시 안 올림, 응답을 못 받은 올림은 같은 upload_id로 다시 (서버가 한 번만 처리).
 * - 서버 저장을 받는 때는 둘뿐: 로그인할 때 (진행 고르기)와 저장이 깨졌을 때 (복구 대기, storage.load). 그 전에는 올리지 않는다.
 * - 계정이 바뀌면 이전 계정의 대기를 버림 (백업 상태는 사용자 ID마다 하나).
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { askModal, noticeModal } from '../platform/ads';
import { chooseProgress, deleteAccount, downloadSave, googleReady, logLogin, me, signInWithGoogle, signOut, uploadSave, type Download, type Me } from '../platform/account';
import { lastBoot, remoteFlag } from '../platform/server';
import { serverOn } from '../platform/server-config';
import { migrate, RESTORE_PENDING_KEY, save, type SaveData, type Settings } from '../platform/storage';
import { now } from '../platform/time';
import { G } from '../game/state';
import { notify } from './toast';

const STATE_KEY = 'healer.backup';
const PRE_MERGE_KEY = 'healer.save.pre-merge';

/** 백업 상태 (사용자마다 하나): rev = 마지막으로 서버와 맞춘 판, hash = 그때 저장, at = 서버 시각, pending = 응답을 못 받은 올림, conflict = 다른 폰이 먼저 올림 */
export interface BackupState { uid: string; rev: number; hash: string; at: number; pending?: { id: string; hash: string }; conflict?: boolean }

/** 저장 글의 지문 (FNV-1a 32비트): 바뀌었는지만 봄 */
export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type BackupStep = 'upload' | 'same' | 'sync' | 'wait';
/**
 * 앱을 내릴 때 할 일: upload = 올림, same = 바뀐 것 없음, sync = 먼저 서버와 맞춰야 함 (이 계정 첫 백업 · 충돌 · 복구 대기, 다음에 앞으로 올 때),
 * wait = 서버가 백업을 멈춤 (점검 · 원격 스위치)
 */
export function backupStep(st: BackupState | null, uid: string, hash: string, o: { restorePending: boolean; paused: boolean }): BackupStep {
  if (o.restorePending || !st || st.uid !== uid || st.rev < 0 || st.conflict) return 'sync';
  if (o.paused) return 'wait';
  return st.hash === hash ? 'same' : 'upload';
}
/** 이번 올림의 upload_id: 같은 내용을 다시 보내면 지난번 id (서버가 한 번만 처리) */
export const uploadIdFor = (st: BackupState | null, hash: string, mk: () => string): string => (st?.pending?.hash === hash ? st.pending.id : mk());

/** 서버에서 받아도 이 폰 것을 지키는 설정 (기기마다): 소리 · 진동 · 휠 손 · 확대 · 시각 효과 */
const DEVICE_SETTINGS = ['sound', 'music', 'sfxVol', 'musicVol', 'vibrate', 'hand', 'zoom', 'reducedEffects'] as const satisfies readonly (keyof Settings)[];
export function keepDeviceSettings(next: SaveData, mine: Settings): SaveData {
  const s = { ...next.settings } as Record<string, unknown>;
  for (const k of DEVICE_SETTINGS) s[k] = mine[k];
  return { ...next, settings: s as unknown as Settings };
}

export const maskEmail = (e: string | null): string => {
  if (!e) return '구글 계정';
  const [id, host] = e.split('@');
  return `${id.slice(0, 3)}${id.length > 3 ? '***' : ''}${host ? `@${host}` : ''}`;
};
/** 서버 시각 → 「10월 29일 15:20」 (한국 시간) */
export function kstText(ms: number): string {
  const d = new Date(ms + 9 * 3600e3);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const store = globalThis.localStorage as Storage | undefined;
const readState = (): BackupState | null => { try { return JSON.parse(store?.getItem(STATE_KEY) || 'null') as BackupState | null; } catch { return null; } };
const writeState = (st: BackupState | null): void => { try { if (st) store?.setItem(STATE_KEY, JSON.stringify(st)); else store?.removeItem(STATE_KEY); } catch { /* 그만 */ } };
const restorePending = (): boolean => { try { return store?.getItem(RESTORE_PENDING_KEY) === '1'; } catch { return false; } };
const clearRestore = (): void => { try { store?.removeItem(RESTORE_PENDING_KEY); } catch { /* 그만 */ } };
const serverPaused = (): boolean => !remoteFlag('backup', true) || !!lastBoot()?.config?.maintenance;

let who: Me | null = null;
let busy = false;
const listeners: (() => void)[] = [];
/** 설정 화면이 계정 상태가 바뀌면 다시 그리게 */
export const onAccountChange = (fn: () => void): void => { listeners.push(fn); };
const changed = (): void => { for (const fn of listeners) fn(); };

export interface AccountView { on: boolean; ready: boolean; user: Me | null; lastAt: number | null }
/** 설정 「계정」 판이 보일 것 */
export function accountView(): AccountView {
  const st = readState();
  return { on: serverOn(), ready: googleReady(), user: who, lastAt: who && st?.uid === who.id && st.at ? st.at : null };
}

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** 지금 저장을 올림 (base = 마지막으로 맞춘 판). 결과대로 상태를 고침 */
async function upload(u: Me, base: number): Promise<boolean> {
  const json = JSON.stringify(G.save), hash = fnv(json), st = readState();
  const id = uploadIdFor(st && st.uid === u.id ? st : null, hash, () => crypto.randomUUID());
  const keep = st && st.uid === u.id ? st : { uid: u.id, rev: base, hash: '', at: 0 };
  writeState({ ...keep, pending: { id, hash } });
  const r = await uploadSave(G.save, base, id, now());
  if (r.ok && !(r.duplicate && r.latest_rev && r.rev && r.latest_rev > r.rev)) {
    writeState({ uid: u.id, rev: r.rev ?? base, hash, at: r.now ?? now() });
    changed();
    return true;
  }
  if (r.ok || r.reason === 'conflict') writeState({ ...keep, pending: { id, hash }, conflict: true });
  return false;
}

/** 서버 진행을 이 폰 저장으로 (이 폰 것은 pre-merge 사본, 기기 설정은 지킴) → 다시 켬 */
function applyServer(u: Me, d: Download): void {
  try { store?.setItem(PRE_MERGE_KEY, JSON.stringify(G.save)); } catch { /* 그만 */ }
  const next = keepDeviceSettings(migrate(d.data), G.save.settings);
  save(next);
  clearRestore();
  writeState({ uid: u.id, rev: d.rev ?? 0, hash: fnv(JSON.stringify(next)), at: d.updated_at ?? now() });
  location.reload();
}

/**
 * 서버와 맞춤 (구글 로그인 직후 · 이 계정을 아직 안 맞춘 채 켬 · 다른 폰이 먼저 올림 · 저장이 깨짐).
 * 서버 저장이 없으면 이 폰 것을 첫 판으로, 있으면 고르기
 */
async function reconcile(u: Me): Promise<void> {
  const d = await downloadSave();
  if (!d.exists) { clearRestore(); await upload(u, 0); return; }
  const mine = G.save.player.level, theirs = d.level ?? 1, when = d.updated_at ? kstText(d.updated_at) : '';
  const deviceUp = async (): Promise<void> => {
    const json = JSON.stringify(G.save), id = crypto.randomUUID();
    const r = await chooseProgress('device', d.rev ?? null, G.save, id, now());
    if (!r.ok) throw new Error(r.reason === 'conflict' ? '그 사이 계정 진행이 바뀜' : '백업 실패');
    clearRestore();
    writeState({ uid: u.id, rev: r.rev ?? 0, hash: fnv(json), at: r.now ?? now() });
    changed();
  };
  if (restorePending()) {
    const back = await askModal('저장 복구', `이 폰의 저장을 읽지 못해 새로 시작했습니다.<br>백업된 진행 Lv ${theirs} (${when})으로 되돌릴 수 있습니다.`, '새로 시작', '되돌리기');
    if (back) { await chooseProgress('account', d.rev ?? null, G.save, null, now()); applyServer(u, d); return; }
    if (await askModal('새로 시작', `백업된 Lv ${theirs} 진행은 사본으로 물러나고 지금 진행이 백업됩니다.`, '취소', '새로 시작')) await deviceUp();
    return;
  }
  for (;;) {
    const account = await askModal('진행 고르기', `이 계정에 백업된 진행이 있습니다.<br>이 폰 Lv ${mine} · 계정 Lv ${theirs} (${when})`, `이 폰 Lv ${mine}`, `계정 Lv ${theirs}`);
    if (account) { await chooseProgress('account', d.rev ?? null, G.save, null, now()); applyServer(u, d); return; }
    if (await askModal('이 폰 진행으로', `계정의 Lv ${theirs} 진행은 사본으로 물러나고 이 폰 Lv ${mine} 진행이 백업됩니다.`, '취소', '이 폰 진행 백업')) { await deviceUp(); return; }
  }
}

/** 앱을 내릴 때 (끌 때 포함) 자동 백업 */
export async function backupOnPause(): Promise<void> {
  if (busy || !serverOn()) return;
  busy = true;
  try {
    const u = who ?? (who = await me());
    if (!u) return;
    const st = readState();
    const step = backupStep(st, u.id, fnv(JSON.stringify(G.save)), { restorePending: restorePending(), paused: serverPaused() });
    if (step === 'upload' && st) await upload(u, st.rev);
  } catch { /* 연결이 없으면 다음에 (같은 upload_id로) */ } finally { busy = false; }
}

/** 앞으로 올 때 · 켤 때: 맞춰야 하면 맞춤 */
async function syncForeground(): Promise<void> {
  if (busy || !serverOn()) return;
  const u = who ?? (who = await me());
  if (!u || serverPaused()) return;
  const st = readState();
  if (backupStep(st, u.id, '', { restorePending: restorePending(), paused: false }) !== 'sync') return;
  busy = true;
  try { await reconcile(u); } catch { /* 다음에 */ } finally { busy = false; }
}

/** 설정 「구글 계정 연결」 */
export async function linkGoogle(): Promise<void> {
  if (!googleReady()) { await noticeModal('구글 계정 연결', '아직 준비 중입니다.'); return; }
  if (busy) return;
  busy = true;
  try {
    const u = await signInWithGoogle();
    who = u;
    if (readState()?.uid !== u.id) writeState(null); // 다른 계정이면 이전 대기를 버림
    void logLogin('sign_in');
    changed();
    await reconcile(u);
    notify('구글 계정 연결됨');
  } catch (e) {
    if (err(e) !== '구글 로그인 취소') await noticeModal('구글 계정 연결', `연결하지 못했습니다.<br>${err(e).replace(/[<>&]/g, '')}`);
  } finally { busy = false; changed(); }
}

/** 설정 「로그아웃」 */
export async function signOutFlow(): Promise<void> {
  if (!(await askModal('로그아웃', '로그아웃하면 자동 백업이 멈춥니다. 이 폰의 진행은 그대로 남습니다.', '취소', '로그아웃'))) return;
  await logLogin('sign_out');
  await signOut();
  who = null;
  writeState(null);
  changed();
  notify('로그아웃됨');
}

/** 설정 「계정 삭제」 (Google Play 정책) */
export async function deleteFlow(): Promise<void> {
  if (!(await askModal('계정 삭제', '서버의 백업 · 로그인 기록이 모두 지워지고 되돌릴 수 없습니다. 이 폰의 진행은 그대로 남습니다.', '취소', '삭제'))) return;
  try { await deleteAccount(); } catch (e) { await noticeModal('계정 삭제', `삭제하지 못했습니다.<br>${err(e).replace(/[<>&]/g, '')}`); return; }
  await signOut();
  who = null;
  writeState(null);
  changed();
  notify('계정을 삭제했습니다');
}

/** 앱이 켜질 때 (main.ts): 로그인 상태 읽기 · 켬 기록 · 맞춤, 내릴 때 자동 백업 · 앞으로 올 때 맞춤 */
export function mountAccount(): void {
  if (!serverOn()) return;
  void (async () => {
    who = await me();
    changed();
    if (who) { void logLogin('open'); await syncForeground(); }
  })();
  if (Capacitor.isNativePlatform()) {
    void App.addListener('pause', () => { void backupOnPause(); });
    void App.addListener('resume', () => { void syncForeground(); });
  } else {
    document.addEventListener('visibilitychange', () => { void (document.hidden ? backupOnPause() : syncForeground()); });
  }
}
