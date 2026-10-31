/**
 * 계정 · 자동 백업 (기획 120 9-2 · 3-1, 처음 켜면 익명 계정 → 설정에서 구글 연동 (2026-10-29 Lim), 2026-10-29 Lim 「저장 백업은 구글 로그인 한 사람만 … 앱종료시 자동 저장 및 백업」 · 「구글 계정 연결(사용자 선택)」 · 「설정에만」).
 * - 설정 「계정」 판에서만 구글 연결 · 로그아웃 · 계정 삭제. 백업 · 불러오기 버튼은 없다.
 * - 앱을 끄거나 내릴 때 (pause) 저장이 바뀌었으면 올림. 같은 내용은 다시 안 올림, 응답을 못 받은 올림은 같은 upload_id로 다시 (서버가 한 번만 처리).
 * - 서버 저장을 받는 때는 둘뿐: 로그인할 때 (진행 고르기)와 저장이 깨졌을 때 (복구 대기, storage.load). 그 전에는 올리지 않는다.
 * - 계정이 바뀌면 이전 계정의 대기를 버림 (백업 상태는 사용자 ID마다 하나).
 * - 한 계정 = 한 기기 (9-2b, 2026-10-29 Lim 「1번으로 하여 문제없도록 … 앱을 지우고 다시 복구시에도 문제 없도록」): 서버가 현재 기기 (설치 번호)를 적고,
 *   다른 기기가 고르기로 받아 가면 옛 기기는 다음에 서버를 볼 때 안내 → 로그아웃 → 그 기기의 진행을 지움. 다시 깐 앱은 새 설치 번호라 구글 연결 → 고르기로 다시 현재 기기.
 */
import { App } from '@capacitor/app';
import { t } from '../i18n';
import { Capacitor } from '@capacitor/core';
import { askModal, noticeModal } from '../platform/ads';
import { chooseProgress, connectGoogle, deleteAccount, deviceStatus, downloadSave, googleReady, logLogin, me, signOut, startAnonymous, uploadSave, watchAccount, type DeviceStatus, type Download, type Me } from '../platform/account';
import { initInstall, markActive, renewInstall, wasActive } from '../platform/install';
import { lastBoot, remoteFlag } from '../platform/server';
import { serverOn } from '../platform/server-config';
import { migrate, restoreStatus, save, saveIssue, SAVE_KEY, setRestorePending, type SaveData, type Settings } from '../platform/storage';
import { now } from '../platform/time';
import { G, resetSave } from '../game/state';
import { notify } from './toast';

const STATE_KEY = 'healer.backup';
const PRE_MERGE_KEY = 'healer.save.pre-merge';

/** 백업 상태 (사용자마다 하나): rev = 마지막으로 서버와 맞춘 판, hash = 그때 저장, at = 서버 시각, pending = 응답을 못 받은 올림, conflict = 다른 폰이 먼저 올림 */
export interface BackupState { uid: string; rev: number; hash: string; at: number; pending?: { id: string; hash: string }; conflict?: boolean; error?: string }

/** 저장 글의 지문 (FNV-1a 32비트): 바뀌었는지만 봄 */
export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type DeviceAction = 'ok' | 'none' | 'reconcile' | 'moved';
/**
 * 켤 때 · 앞으로 올 때 현재 기기 확인: ok = 이 설치가 현재 기기, none = 서버에 저장이 없음 (첫 백업 때 잡음),
 * reconcile = 현재 기기였던 적 없는 설치 (다시 깐 앱 · 새 폰 · 복사된 저장) → 받아 보고 고르기, moved = 현재 기기였다가 다른 기기로 옮겨짐
 */
export function deviceAction(st: DeviceStatus, active: boolean): DeviceAction {
  if (!st.exists) return 'none';
  if (st.active) return 'ok';
  return active ? 'moved' : 'reconcile';
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
  if (!e) return t('구글 계정');
  const [id, host] = e.split('@');
  return `${id.slice(0, 3)}${id.length > 3 ? '***' : ''}${host ? `@${host}` : ''}`;
};
/** 서버 시각 → 「10월 29일 15:20」 (한국 시간) */
export function kstText(ms: number): string {
  const d = new Date(ms + 9 * 3600e3);
  const p = (n: number) => String(n).padStart(2, '0');
  return t('{m}월 {d}일 {hh}:{mm}', { m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: p(d.getUTCHours()), mm: p(d.getUTCMinutes()) });
}

const store = globalThis.localStorage as Storage | undefined;
const readState = (): BackupState | null => { try { return JSON.parse(store?.getItem(STATE_KEY) || 'null') as BackupState | null; } catch { return null; } };
const writeState = (st: BackupState | null): void => {
  if (!store) throw new Error('local_save');
  if (st) store.setItem(STATE_KEY, JSON.stringify(st)); else store.removeItem(STATE_KEY);
};
const restorePending = (): boolean => !!restoreStatus();
const clearRestore = (): void => setRestorePending(null);
const serverPaused = (): boolean => !remoteFlag('backup', true) || !!lastBoot()?.config?.maintenance;

let who: Me | null = null;
let busy = false;
let leaving = false;
let lastFailure: string | null = null;
const listeners: (() => void)[] = [];
/** 설정 화면이 계정 상태가 바뀌면 다시 그리게 */
export const onAccountChange = (fn: () => void): void => { listeners.push(fn); };
const changed = (): void => { for (const fn of listeners) fn(); };

export interface AccountView { on: boolean; ready: boolean; user: Me | null; lastAt: number | null; error: boolean }
/** 설정 「계정」 판이 보일 것 */
export function accountView(): AccountView {
  const st = readState(), g = who && !who.anonymous ? who : null;
  return { on: serverOn(), ready: googleReady(), user: g, lastAt: g && st?.uid === g.id && st.at ? st.at : null, error: !!(lastFailure || st?.error) };
}

/** 구글 계정 (익명이 아님)일 때만 백업 */
const googleUser = async (): Promise<Me | null> => {
  const u = who = await me(), st = readState();
  if (u && st && st.uid !== u.id && (st.rev > 0 || st.pending)) { failed('account_mismatch'); return null; }
  return u && !u.anonymous ? u : null;
};

/** 익명 계정으로 돌아감 (로그아웃 · 계정 삭제 뒤): 새 익명 계정 · 첫 익명 기록 */
async function backToAnonymous(): Promise<void> {
  who = await startAnonymous();
  if (who) void logLogin('anon_start');
  changed();
}

const err = (e: unknown): string => (e instanceof Error ? e.message : String(e));
function failed(e: unknown): void {
  lastFailure = err(e);
  const st = readState();
  try { if (st) writeState({ ...st, error: lastFailure }); } catch { /* 메모리에도 실패 상태 유지 */ }
  changed();
}
function failureText(code: string): string {
  if (code === 'newer_save' || code === 'newer') return t('새 버전에서 저장한 진행입니다. 앱을 업데이트한 뒤 다시 연결할 수 있습니다.');
  if (code === 'local_save') return t('진행을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도할 수 있습니다.');
  if (code === 'paused') return t('서버 점검 중입니다. 게임은 그대로 할 수 있습니다.');
  if (code === 'conflict') return t('그 사이 계정 진행이 바뀜');
  if (code === 'rate_limited') return t('잠시 후 다시 시도할 수 있습니다.');
  if (code === 'account_mismatch') return t('이 진행을 백업한 구글 계정에 다시 연결할 수 있습니다. 다른 계정으로 옮길 수 없습니다.');
  return t('진행을 백업하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도할 수 있습니다.');
}
export async function showBackupError(): Promise<void> {
  await noticeModal(t('백업 대기'), failureText(lastFailure || readState()?.error || 'network'));
}
const validRev = (n: unknown): n is number => Number.isInteger(n) && Number(n) > 0;

/** 지금 저장을 올림 (base = 마지막으로 맞춘 판). 결과대로 상태를 고침 */
async function upload(u: Me, base: number): Promise<boolean> {
  const json = JSON.stringify(G.save), hash = fnv(json), st = readState();
  if (saveIssue(G.save) || restoreStatus() === 'newer') throw new Error('newer_save');
  const id = uploadIdFor(st && st.uid === u.id ? st : null, hash, () => crypto.randomUUID());
  const keep = st && st.uid === u.id ? st : { uid: u.id, rev: base, hash: '', at: 0 };
  writeState({ ...keep, pending: { id, hash } });
  const r = await uploadSave(JSON.parse(json), base, id, now());
  if (r.reason === 'moved') { await handleMoved(); return false; }
  if (r.ok && validRev(r.rev) && !(r.duplicate && r.latest_rev && r.latest_rev > r.rev)) {
    writeState({ uid: u.id, rev: r.rev, hash, at: r.now ?? now() });
    lastFailure = null;
    markActive();
    changed();
    return true;
  }
  if (r.ok || r.reason === 'conflict') writeState({ ...keep, pending: { id, hash }, conflict: true });
  failed(r.reason || 'conflict');
  return false;
}

/** 서버 진행을 이 폰 저장으로 (이 폰 것은 pre-merge 사본, 기기 설정은 지킴) → 다시 켬 */
function applyServer(u: Me, d: Download): void {
  const next = keepDeviceSettings(migrate(d.data), G.save.settings);
  if (!save(next) || store?.getItem(SAVE_KEY) !== JSON.stringify(next)) throw new Error('local_save');
  writeState({ uid: u.id, rev: d.rev!, hash: fnv(JSON.stringify(next)), at: d.updated_at ?? now() });
  clearRestore();
  lastFailure = null;
  markActive();
  G.save = next;
  leaving = true; // reload의 visibilitychange가 복원 전 메모리를 다시 올리지 않게 함
  location.reload();
}

/**
 * 다른 기기로 옮겨진 계정 (한 계정 = 한 기기): 안내 → 로그아웃 → 이 기기의 진행을 지우고 처음부터 (새 익명 계정 · 새 설치 번호).
 * 진행은 계정 (지금 현재 기기)에 있고, 이 폰에서 다시 구글 연결 → 「계정 진행」으로 받아 올 수 있다 (그러면 저쪽이 옛 기기가 됨)
 */
async function handleMoved(): Promise<void> {
  await noticeModal(t('다른 기기로 옮겨진 계정'), t('이 계정의 진행을 다른 기기에서 불러왔습니다.<br>이 기기는 로그아웃되고, 이 기기의 진행은 지워집니다.'));
  try { await logLogin('sign_out'); } catch { /* 그만 */ }
  await signOut();
  who = null;
  writeState(null);
  renewInstall();
  resetSave();
  leaving = true;
  location.reload();
}

let checkedAt = -Infinity;
let checkedUser = '';
const CHECK_MS = 5 * 60e3;
/** 현재 기기 확인 (구글 계정). 계속해도 되면 true */
async function checkDevice(u: Me, force = false): Promise<boolean> {
  if (!force && checkedUser === u.id && performance.now() - checkedAt < CHECK_MS) return true;
  const a = deviceAction(await deviceStatus(), wasActive());
  checkedAt = performance.now(); checkedUser = u.id;
  if (a === 'ok') { markActive(); return true; }
  if (a === 'moved') { await handleMoved(); return false; }
  if (a === 'reconcile') { await reconcile(u); return false; }
  return true;
}

/**
 * 서버와 맞춤 (구글 로그인 직후 · 이 계정을 아직 안 맞춘 채 켬 · 다른 폰이 먼저 올림 · 저장이 깨짐).
 * 서버 저장이 없으면 이 폰 것을 첫 판으로, 있으면 고르기
 */
async function reconcile(u: Me): Promise<void> {
  if (serverPaused()) throw new Error('paused');
  if (restoreStatus() === 'newer') throw new Error('newer_save');
  const st = readState();
  writeState({ ...(st?.uid === u.id ? st : { uid: u.id, rev: -1, hash: '', at: 0 }), conflict: true });
  const d = await downloadSave();
  if (!d.exists) {
    if (!(await upload(u, 0))) throw new Error(lastFailure || 'backup');
    clearRestore(); return;
  }
  const issue = saveIssue(d.data);
  if (issue) throw new Error(issue === 'newer' ? 'newer_save' : issue);
  if (!validRev(d.rev)) throw new Error('bad_response');
  const takeAccount = async (): Promise<void> => {
    try {
      setRestorePending('1');
      if (!store) throw new Error('local_save');
      store.setItem(PRE_MERGE_KEY, JSON.stringify(G.save));
    } catch { throw new Error('local_save'); }
    const r = await chooseProgress('account', d.rev!, G.save, null, now());
    if (!r.ok || r.rev !== d.rev) throw new Error(r.reason || 'conflict');
    applyServer(u, d);
  };
  const mine = G.save.player.level, theirs = d.level ?? 1, when = d.updated_at ? kstText(d.updated_at) : '';
  const deviceUp = async (): Promise<void> => {
    const json = JSON.stringify(G.save), id = crypto.randomUUID();
    const r = await chooseProgress('device', d.rev!, JSON.parse(json), id, now());
    if (!r.ok || !validRev(r.rev)) throw new Error(r.reason || 'backup');
    writeState({ uid: u.id, rev: r.rev, hash: fnv(json), at: r.now ?? now() });
    clearRestore(); lastFailure = null;
    markActive();
    changed();
  };
  if (restorePending()) {
    const back = await askModal(t('저장 복구'), t('이 폰의 저장을 읽지 못해 새로 시작했습니다.<br>백업된 진행 Lv {lv} ({when})으로 되돌릴 수 있습니다.', { lv: theirs, when }), t('새로 시작'), t('되돌리기'));
    if (back) { await takeAccount(); return; }
    if (await askModal(t('새로 시작'), t('백업된 Lv {lv} 진행은 사본으로 물러나고 지금 진행이 백업됩니다.', { lv: theirs }), t('취소'), t('새로 시작'))) await deviceUp();
    return;
  }
  for (;;) {
    const account = await askModal(t('진행 고르기'), t('이 계정에 백업된 진행이 있습니다.<br>이 폰 Lv {a} · 계정 Lv {b} ({when})', { a: mine, b: theirs, when }), t('이 폰 Lv {n}', { n: mine }), t('계정 Lv {n}', { n: theirs }));
    if (account) { await takeAccount(); return; }
    if (await askModal(t('이 폰 진행으로'), t('계정의 Lv {b} 진행은 사본으로 물러나고 이 폰 Lv {a} 진행이 백업됩니다.', { a: mine, b: theirs }), t('취소'), t('이 폰 진행 백업'))) { await deviceUp(); return; }
  }
}

/** 앱을 내릴 때 (끌 때 포함) 자동 백업 */
export async function backupOnPause(): Promise<void> {
  if (busy || leaving || !serverOn()) return;
  busy = true;
  try {
    const u = await googleUser();
    if (!u) return;
    const st = readState();
    const step = backupStep(st, u.id, fnv(JSON.stringify(G.save)), { restorePending: restorePending(), paused: serverPaused() });
    if (step === 'upload' && st) await upload(u, st.rev);
  } catch (e) { failed(e); } finally { busy = false; }
}

/** 앞으로 올 때 · 켤 때: 맞춰야 하면 맞춤 */
async function syncForeground(): Promise<void> {
  if (busy || leaving || !serverOn()) return;
  busy = true;
  try {
    const u = await googleUser();
    if (!u || serverPaused()) return;
    if (!(await checkDevice(u))) return; // 옮겨짐 · 고르기를 했으면 끝
    const st = readState();
    if (backupStep(st, u.id, '', { restorePending: restorePending(), paused: false }) === 'sync') await reconcile(u);
  } catch (e) { failed(e); } finally { busy = false; }
}

/** 설정 「구글 계정 연결」 */
export async function linkGoogle(): Promise<void> {
  if (!googleReady()) { await noticeModal(t('구글 계정 연결'), t('아직 준비 중입니다.')); return; }
  if (serverPaused()) { await noticeModal(t('서버 점검'), failureText('paused')); return; }
  if (restoreStatus() === 'newer') { await noticeModal(t('업데이트 필요'), failureText('newer_save')); return; }
  if (busy) return;
  busy = true;
  try {
    const { user: u, mode } = await connectGoogle();
    who = u;
    const owner = readState();
    if (owner && owner.uid !== u.id && (owner.rev > 0 || owner.pending)) {
      await signOut(); who = null; throw new Error('account_mismatch');
    }
    if (readState()?.uid !== u.id) writeState(null); // 다른 계정이면 이전 대기를 버림
    void logLogin(mode); // link = 익명 계정에 연동 (같은 ID) · sign_in = 이미 있던 구글 계정으로
    changed();
    await reconcile(u);
    notify(t('구글 계정 연결됨'));
  } catch (e) {
    if (err(e) !== '구글 로그인 취소') { failed(e); await noticeModal(t('구글 계정 연결'), failureText(err(e))); }
  } finally { busy = false; changed(); }
}

/** 로그아웃 전 마지막 백업: 바뀐 게 없거나 올렸으면 true. 서버와 맞춘 적 없거나 (복구 대기 · 충돌) 못 올리면 false */
async function finalBackup(u: Me): Promise<boolean> {
  const st = readState();
  const step = backupStep(st, u.id, fnv(JSON.stringify(G.save)), { restorePending: restorePending(), paused: serverPaused() });
  if (step === 'same') return true;
  if (step !== 'upload' || !st) return false;
  try { return await upload(u, st.rev); } catch { return false; }
}

/**
 * 설정 「로그아웃」: 이 기기의 진행은 계정의 것이라 로그아웃하면 지운다 (한 계정 = 한 기기, 9-2b. 남겨 두면 다른 구글 계정에 연결해 진행을 복사할 수 있음).
 * 지우기 전에 마지막 백업 (못 올리면 로그아웃하지 않음). 다시 로그인하면 「계정 진행」으로 받아 올 수 있다
 */
export async function signOutFlow(): Promise<void> {
  if (!(await askModal(t('로그아웃'), t('로그아웃하면 이 기기의 진행은 지워지고, 계정에 백업된 진행은 그대로 남습니다.<br>다시 로그인하면 불러올 수 있습니다.'), t('취소'), t('로그아웃')))) return;
  if (busy) return;
  busy = true;
  try {
    const u = await googleUser();
    if (!u) return;
    if (!(await finalBackup(u))) { await noticeModal(t('로그아웃'), t('마지막 진행을 백업하지 못했습니다.<br>인터넷에 연결된 뒤 다시 할 수 있습니다.')); return; }
    await logLogin('sign_out');
    await signOut();
    who = null;
    writeState(null);
    renewInstall();
    resetSave();
    leaving = true;
    location.reload(); // 새 익명 계정으로 처음부터
  } catch (e) { failed(e); await showBackupError(); } finally { busy = false; }
}

/** 설정 「계정 삭제」 (Google Play 정책) */
export async function deleteFlow(): Promise<void> {
  if (busy) return;
  if (!(await askModal(t('계정 삭제'), t('서버의 백업 · 로그인 기록이 모두 지워지고 되돌릴 수 없습니다. 이 폰의 진행은 그대로 남습니다.'), t('취소'), t('삭제')))) return;
  if (busy) return;
  busy = true;
  try {
    const r = await deleteAccount();
    if (!r.ok) throw new Error('delete_failed');
    await signOut(); who = null; writeState(null);
    await backToAnonymous(); notify(t('계정을 삭제했습니다'));
  } catch (e) { await noticeModal(t('계정 삭제'), t('삭제하지 못했습니다.<br>{e}', { e: err(e).replace(/[<>&]/g, '') })); }
  finally { busy = false; }
}

/** 앱이 켜질 때 (main.ts): 로그인 상태 읽기 (없으면 익명 계정) · 켬 기록 · 맞춤, 내릴 때 자동 백업 · 앞으로 올 때 맞춤 */
export function mountAccount(): void {
  if (!serverOn()) return;
  watchAccount(u => { who = u; checkedAt = -Infinity; changed(); });
  void (async () => {
    await initInstall();
    who = await me();
    if (!who) { await backToAnonymous(); return; } // 처음 켬: 익명 계정
    changed();
    void logLogin('open');
    if (!who.anonymous) await syncForeground();
  })().catch(failed);
  if (Capacitor.isNativePlatform()) {
    void App.addListener('pause', () => { void backupOnPause(); });
    void App.addListener('resume', () => { void syncForeground(); });
  } else {
    document.addEventListener('visibilitychange', () => { void (document.hidden ? backupOnPause() : syncForeground()); });
  }
}
