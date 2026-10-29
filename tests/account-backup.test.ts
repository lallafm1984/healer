/**
 * 구글 계정 · 자동 백업 판단 (기획 120 9-2 · 3-1, screens/account): 언제 올리는지, 같은 올림을 다시 보낼 때 id, 받은 저장에서 기기 설정 지키기,
 * 저장이 깨지면 복구 대기 (storage.load)
 */
import { describe, expect, it } from 'vitest';
import { backupStep, fnv, keepDeviceSettings, kstText, maskEmail, uploadIdFor, type BackupState } from '../src/screens/account';
import { load, newSave, RESTORE_PENDING_KEY, SAVE_BAK_KEY, SAVE_KEY, type KV } from '../src/platform/storage';

const st = (o: Partial<BackupState> = {}): BackupState => ({ uid: 'u1', rev: 3, hash: 'aaaa', at: 1, ...o });
const ok = { restorePending: false, paused: false };

describe('앱을 내릴 때 할 일', () => {
  it('맞춘 계정 · 바뀐 저장이면 올림, 같으면 안 올림', () => {
    expect(backupStep(st(), 'u1', 'bbbb', ok)).toBe('upload');
    expect(backupStep(st(), 'u1', 'aaaa', ok)).toBe('same');
  });
  it('이 계정 첫 백업 · 다른 계정 · 충돌 · 복구 대기면 먼저 서버와 맞춤 (올리지 않음)', () => {
    expect(backupStep(null, 'u1', 'bbbb', ok)).toBe('sync');
    expect(backupStep(st({ uid: 'u2' }), 'u1', 'bbbb', ok)).toBe('sync');
    expect(backupStep(st({ conflict: true }), 'u1', 'bbbb', ok)).toBe('sync');
    expect(backupStep(st({ rev: -1 }), 'u1', 'bbbb', ok)).toBe('sync');
    expect(backupStep(st(), 'u1', 'bbbb', { restorePending: true, paused: false })).toBe('sync');
  });
  it('점검 · 원격 스위치로 백업이 멈추면 기다림', () => {
    expect(backupStep(st(), 'u1', 'bbbb', { restorePending: false, paused: true })).toBe('wait');
  });
});

describe('응답을 못 받은 올림', () => {
  it('같은 내용을 다시 보내면 지난번 upload_id (서버가 한 번만 처리), 내용이 바뀌면 새 id', () => {
    const pend = st({ pending: { id: 'id-1', hash: 'cccc' } });
    expect(uploadIdFor(pend, 'cccc', () => 'new')).toBe('id-1');
    expect(uploadIdFor(pend, 'dddd', () => 'new')).toBe('new');
    expect(uploadIdFor(null, 'cccc', () => 'new')).toBe('new');
  });
  it('저장 지문은 내용이 같으면 같고 다르면 다름', () => {
    const a = JSON.stringify(newSave(1)), b = JSON.stringify({ ...newSave(1), nextId: 2 });
    expect(fnv(a)).toBe(fnv(a));
    expect(fnv(a)).not.toBe(fnv(b));
    expect(fnv('')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('서버 진행을 받을 때', () => {
  it('소리 · 진동 · 휠 손 · 확대 · 시각 효과는 이 폰 것을 지키고, 나머지는 서버 것', () => {
    const server = newSave(1), mine = newSave(1);
    server.settings = { ...server.settings, sound: true, hand: 'right', tapKey: 'flash', devGold: true };
    mine.settings = { ...mine.settings, sound: false, sfxVol: 0.3, hand: 'left', reducedEffects: true, tapKey: 'heal' };
    const out = keepDeviceSettings(server, mine.settings);
    expect(out.settings).toMatchObject({ sound: false, sfxVol: 0.3, hand: 'left', reducedEffects: true, tapKey: 'flash', devGold: true });
    expect(server.settings.sound).toBe(true); // 원본은 그대로
  });
});

describe('표시', () => {
  it('이메일 줄임 · 한국 시간', () => {
    expect(maskEmail('lallafm0001@gmail.com')).toBe('lal***@gmail.com');
    expect(maskEmail('ab@x.com')).toBe('ab@x.com');
    expect(maskEmail(null)).toBe('구글 계정');
    expect(kstText(Date.UTC(2026, 9, 29, 6, 5))).toBe('10월 29일 15:05');
  });
});

describe('저장이 깨졌을 때 (예전: 아무 말 없이 새 저장)', () => {
  const kv = (init: Record<string, string>): KV & { data: Record<string, string> } => {
    const data = { ...init };
    return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } };
  };
  it('옛 내용을 사본 키에 남기고 복구 대기 표시', () => {
    const s = kv({ [SAVE_KEY]: '{"v":33, broken' });
    const d = load(s);
    expect(d.player.level).toBe(1);
    expect(s.data[SAVE_BAK_KEY]).toBe('{"v":33, broken');
    expect(s.data[RESTORE_PENDING_KEY]).toBe('1');
  });
  it('저장이 없으면 (첫 실행) 복구 대기 아님', () => {
    const s = kv({});
    load(s);
    expect(s.data[RESTORE_PENDING_KEY]).toBeUndefined();
  });
});
