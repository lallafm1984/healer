/**
 * 서버 DB (supabase/migrations, 기획 120 9장): PGlite로 실제 Postgres를 띄워 마이그레이션을 그대로 돌린다.
 * auth 스키마 · 역할은 tests/fixtures/supabase-stub.sql이 Supabase 흉내를 냄.
 * 보는 것: 게스트 (anon)는 app_boot만, 로그인 사용자는 자기 저장만, 덮어쓰기 막는 절차 (upload_id · base_rev · 사본),
 * 탐지 기록 (audit_flags), 공지 대상, 계정 삭제
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const STUB = readFileSync(join(ROOT, 'tests/fixtures/supabase-stub.sql'), 'utf8');
const MIG_DIR = join(ROOT, 'supabase/migrations');
const MIGRATIONS = readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort().map(f => readFileSync(join(MIG_DIR, f), 'utf8'));

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const D = '00000000-0000-4000-8000-00000000000d';
const E = '00000000-0000-4000-8000-00000000000e';
const ANON_USER = '00000000-0000-4000-8000-0000000000ff';

let db: PGlite;
let n = 0;
const uid = () => `10000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

/** 누구로 부를지: null = 게스트 (anon), 'admin' = 대시보드 (superuser), 그 밖 = 그 사용자 (authenticated) */
async function as(who: string | null | 'admin', claims: Record<string, unknown> = {}): Promise<void> {
  await db.exec('reset role');
  if (who === 'admin') { await db.query(`select set_config('request.jwt.claims', '', false)`); return; }
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [who ? JSON.stringify({ sub: who, ...claims }) : '']);
  await db.exec(who ? 'set role authenticated' : 'set role anon');
}
async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
async function rpc(fn: string, args: unknown[] = []): Promise<Record<string, any>> {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  const row = await one<Record<string, any>>(`select public.${fn}(${ph}) as r`, args);
  return row.r;
}
const save = (o: { level?: number; gold?: number; nextId?: number; wins?: number; v?: number; bag?: number } = {}) => ({
  v: o.v ?? 33, createdAt: 1, nextId: o.nextId ?? 10,
  player: { level: o.level ?? 5, xp: 0, gold: o.gold ?? 1000 },
  clears: { rustfort: { 쉬움: { stars: 3, grade: 'A', best: 90, n: o.wins ?? 3 } } },
  gear: { equipped: {}, bag: Array.from({ length: o.bag ?? 2 }, (_, i) => ({ id: i + 1 })) },
});
const upload = (data: unknown, baseRev: number, id = crypto.randomUUID()) => rpc('upload_save', [JSON.stringify(data), baseRev, id, 101, Date.now()]);
async function flags(user: string): Promise<string[]> {
  await as('admin');
  return (await db.query<{ rule: string }>(`select rule from public.audit_flags where user_id = $1 order by id`, [user])).rows.map(r => r.rule);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const m of MIGRATIONS) await db.exec(m);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x'), ('${D}', 'd@x'), ('${E}', 'e@x');
    insert into auth.users (id, is_anonymous) values ('${ANON_USER}', true)`);
});

describe('게스트 (공개 키)', () => {
  it('app_boot: 서버 시각 · 설정 · 공지를 받고 켠 수를 셈', async () => {
    await as('admin');
    await db.exec(`update public.app_config set min_version = 100, latest_version = 120, flags = '{"backup": true}' where platform = 'android';
      insert into public.notices (title, body, popup, sort) values ('점검 안내', '본문', true, 5);
      insert into public.notices (title, active) values ('꺼진 공지', false);
      insert into public.notices (title, starts_at) values ('나중 공지', now() + interval '1 day');
      insert into public.notices (title, ends_at) values ('끝난 공지', now() - interval '1 minute');
      insert into public.notices (title, min_version) values ('새 버전만', 200);
      insert into public.notices (title, max_version) values ('옛 버전만', 50);
      insert into public.notices (title, platform) values ('아이폰만', 'ios');`);
    await as(null);
    const before = Date.now();
    const r = await rpc('app_boot', ['android', 101]);
    expect(Math.abs(Number(r.now) - before)).toBeLessThan(60_000);
    expect(r.config).toMatchObject({ min_version: 100, latest_version: 120, maintenance: false, flags: { backup: true } });
    expect(r.notices.map((x: { title: string }) => x.title)).toEqual(['점검 안내']);
    expect(r.notices[0].popup).toBe(true);
    await rpc('app_boot', ['android', 101]);
    await rpc('app_boot', ['android', 101, false]);
    await as('admin');
    const st = await one<{ n: string }>(`select n from public.boot_stats where platform = 'android' and version = 101`);
    expect(Number(st.n)).toBe(2);
  });

  it('server_now는 게스트도 부름', async () => {
    await as(null);
    const r = await one<{ t: string }>('select public.server_now() as t');
    expect(Math.abs(Number(r.t) - Date.now())).toBeLessThan(60_000);
  });

  it('게스트는 백업 · 받기 · 계정 삭제 · 도우미 · 관리자 함수를 못 부름', async () => {
    await as(null);
    for (const sql of [
      `select public.upload_save('{}'::jsonb, 0, gen_random_uuid())`,
      'select public.download_save()',
      'select public.delete_account()',
      `select public._store_save('${A}'::uuid, '{}'::jsonb, 0, gen_random_uuid(), 1, 1, 'replaced', true)`,
      `select public.admin_restore_save('${A}'::uuid, 1)`,
    ]) await expect(db.query(sql)).rejects.toThrow(/permission denied/);
  });

  it('게스트는 표를 직접 못 읽고 못 씀', async () => {
    await as(null);
    for (const sql of ['select * from public.saves', 'select * from public.app_config', 'select * from public.notices', 'select * from public.audit_flags',
      `insert into public.notices (title) values ('x')`, `update public.app_config set min_version = 0`]) {
      await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    }
  });
});

describe('로그인 사용자 · 백업', () => {
  it('첫 올림 → rev 1 · first_upload 기록, 자기 저장만 읽음', async () => {
    await as(A);
    const r = await upload(save({ level: 7, gold: 2000 }), 0);
    expect(r).toMatchObject({ ok: true, rev: 1 });
    const mine = (await db.query<{ user_id: string; level: number }>('select user_id, level from public.saves')).rows;
    expect(mine).toEqual([{ user_id: A, level: 7 }]);
    expect(await flags(A)).toEqual(['first_upload']);
    await as(B);
    expect((await db.query('select * from public.saves')).rows).toEqual([]);
    expect((await rpc('download_save')).exists).toBe(false);
  });

  it('같은 upload_id를 다시 보내면 판이 두 번 오르지 않음 (응답을 못 받은 재시도)', async () => {
    const u = uid();
    await as('admin'); await db.query(`insert into auth.users (id) values ($1)`, [u]);
    await as(u);
    const id = crypto.randomUUID();
    expect(await upload(save(), 0, id)).toMatchObject({ ok: true, rev: 1 });
    expect(await upload(save(), 0, id)).toMatchObject({ ok: true, rev: 1, duplicate: true });
    const id2 = crypto.randomUUID();
    expect(await upload(save({ wins: 4 }), 1, id2)).toMatchObject({ ok: true, rev: 2 });
    expect(await upload(save({ wins: 5 }), 2)).toMatchObject({ ok: true, rev: 3 });
    // 더 옛 올림 (rev 2)의 재시도: 사본에 있는 upload_id → 그때 판 그대로
    expect(await upload(save({ wins: 4 }), 1, id2)).toMatchObject({ ok: true, duplicate: true, rev: 2, latest_rev: 3 });
    expect((await rpc('download_save')).rev).toBe(3);
  });

  it('base_rev가 서버보다 뒤면 거절하고 덮지 않음 (두 폰 · 늦은 올림)', async () => {
    await as(C);
    await upload(save({ level: 10 }), 0);
    await upload(save({ level: 11, wins: 4 }), 1);
    const r = await upload(save({ level: 3 }), 1);
    expect(r).toMatchObject({ ok: false, reason: 'conflict', rev: 2, level: 11 });
    const d = await rpc('download_save');
    expect(d).toMatchObject({ exists: true, rev: 2, level: 11 });
    expect(d.data.player.level).toBe(11);
  });

  it('사본은 history_keep개만 남음, 사용자는 사본 표를 못 읽음', async () => {
    await as(D);
    for (let i = 0; i < 6; i++) await upload(save({ wins: 3 + i }), i);
    await as('admin');
    const h = (await db.query<{ rev: number; reason: string }>(`select rev, reason from public.save_history where user_id = $1 order by id`, [D])).rows;
    expect(h).toEqual([{ rev: 4, reason: 'replaced' }, { rev: 5, reason: 'replaced' }]);
    await as(D);
    await expect(db.query('select * from public.save_history')).rejects.toThrow(/permission denied/);
  });

  it('표에 직접 쓰기 · 남의 구매 보기 · 탐지 표 보기는 막힘', async () => {
    await as(A);
    await expect(db.query(`update public.saves set gold = 999999999`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`insert into public.purchases (user_id, product_id, source) values ('${A}', 'noads', 'store')`)).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from public.audit_flags')).rejects.toThrow(/permission denied/);
    expect((await db.query('select * from public.purchases')).rows).toEqual([]);
  });

  it('잘못된 저장 · 너무 큰 저장은 거절', async () => {
    const u = uid();
    await as('admin'); await db.query(`insert into auth.users (id) values ($1)`, [u]);
    await as(u);
    expect(await upload({ hello: 1 }, 0)).toMatchObject({ ok: false, reason: 'bad_save' });
    const big = { ...save(), pad: 'x'.repeat(600_000) };
    expect(await upload(big, 0)).toMatchObject({ ok: false, reason: 'too_big' });
    await expect(db.query(`select public.upload_save('[1]'::jsonb, 0, gen_random_uuid())`)).rejects.toThrow(/object/);
  });

  it('익명 계정은 백업 · 받기 · 고르기 못 함 (구글 계정만 백업, 다시 로그인할 길이 없음)', async () => {
    await as(ANON_USER, { is_anonymous: true });
    await expect(upload(save(), 0)).rejects.toThrow(/anonymous/);
    await expect(db.query('select public.download_save()')).rejects.toThrow(/anonymous/);
    await expect(db.query(`select public.choose_progress('account', 1)`)).rejects.toThrow(/anonymous/);
  });

  it('점검 중이거나 원격 스위치로 백업을 끄면 paused', async () => {
    await as('admin');
    await db.exec(`update public.app_config set flags = '{"backup": false}' where platform = 'android'`);
    await as(A);
    expect(await upload(save(), 1)).toMatchObject({ ok: false, reason: 'paused' });
    await as('admin');
    await db.exec(`update public.app_config set flags = '{}', maintenance = true where platform = 'android'`);
    await as(A);
    expect(await upload(save(), 1)).toMatchObject({ ok: false, reason: 'paused' });
    await as('admin');
    await db.exec(`update public.app_config set maintenance = false where platform = 'android'`);
  });
});

describe('탐지 · 기록 (막지 않음)', () => {
  it('골드 · 레벨이 판 수에 비해 크게 늘거나 범위 밖 · 발급 번호가 줄면 적고, 백업은 됨', async () => {
    const u = uid();
    await as('admin'); await db.query(`insert into auth.users (id) values ($1)`, [u]);
    await as(u);
    await upload(save({ level: 5, gold: 1000, nextId: 50, wins: 3 }), 0);
    // 판 1개 더 이겼는데 골드 +500만 · 레벨 +30 · 발급 번호 줆
    const r = await upload(save({ level: 35, gold: 5_001_000, nextId: 40, wins: 4 }), 1);
    expect(r).toMatchObject({ ok: true, rev: 2 });
    expect(await flags(u)).toEqual(['first_upload', 'jump_gold', 'jump_level', 'next_id_back']);
    await as(u);
    await upload(save({ level: 120, gold: -5, nextId: 40, wins: 2 }), 2);
    expect((await flags(u)).slice(4)).toEqual(['range_level', 'range_gold', 'jump_level', 'wins_back']);
    await as('admin');
    const g = await one<{ detail: { diff: number; wins_diff: number } }>(`select detail from public.audit_flags where user_id = $1 and rule = 'jump_gold'`, [u]);
    expect(g.detail).toMatchObject({ diff: 5_000_000, wins_diff: 1 });
  });

  it('판 수만큼 는 골드는 적지 않음', async () => {
    const u = uid();
    await as('admin'); await db.query(`insert into auth.users (id) values ($1)`, [u]);
    await as(u);
    await upload(save({ gold: 1000, wins: 3 }), 0);
    await upload(save({ gold: 1000 + 30 * 20_000, wins: 33, level: 12 }), 1);
    expect(await flags(u)).toEqual(['first_upload']);
  });
});

describe('구글 로그인 때 진행 고르기', () => {
  it('device: 이 폰 진행을 올리고 계정 옛 판은 merge 사본 · 기록', async () => {
    await as(E);
    await upload(save({ level: 45 }), 0);
    const r = await rpc('choose_progress', ['device', 1, JSON.stringify(save({ level: 3 })), crypto.randomUUID(), 101, Date.now()]);
    expect(r).toMatchObject({ ok: true, rev: 2 });
    expect((await rpc('download_save')).level).toBe(3);
    await as('admin');
    expect((await db.query(`select reason, level from public.save_history where user_id = $1`, [E])).rows).toEqual([{ reason: 'merge', level: 45 }]);
    expect((await db.query(`select kept, account_level, device_level, new_rev from public.account_merges where user_id = $1`, [E])).rows)
      .toEqual([{ kept: 'device', account_level: 45, device_level: 3, new_rev: 2 }]);
  });

  it('account: 기록만, 고르기 창 뒤 판이 바뀌었으면 conflict', async () => {
    await as(E);
    expect(await rpc('choose_progress', ['account', 2, JSON.stringify(save({ level: 9 }))])).toMatchObject({ ok: true, rev: 2 });
    expect(await rpc('choose_progress', ['account', 1])).toMatchObject({ ok: false, reason: 'conflict', rev: 2 });
    await expect(db.query(`select public.choose_progress('both', 2)`)).rejects.toThrow(/keep must be/);
  });
});

describe('로그인 기록 (Lim 「로그인 기록도 따로 테이블로 남겨두자. (60일 유지)」)', () => {
  it('구글 로그인 · 켬 · 로그아웃을 적고, 60일 지난 줄은 지움. 앱은 표를 못 읽고 게스트는 못 적음', async () => {
    await as(B);
    for (const ev of ['sign_in', 'open', 'sign_out']) expect(await rpc('log_login', [ev, 'android', 101])).toMatchObject({ ok: true });
    await expect(db.query(`select public.log_login('hack')`)).rejects.toThrow(/unknown login event/);
    await expect(db.query('select * from public.login_logs')).rejects.toThrow(/permission denied/);
    await as(null);
    await expect(db.query(`select public.log_login('open')`)).rejects.toThrow(/permission denied/);
    await as('admin');
    expect((await db.query(`select event, platform, app_version from public.login_logs where user_id = $1 order by id`, [B])).rows)
      .toEqual([{ event: 'sign_in', platform: 'android', app_version: 101 }, { event: 'open', platform: 'android', app_version: 101 }, { event: 'sign_out', platform: 'android', app_version: 101 }]);
    await db.query(`update public.login_logs set created_at = now() - interval '61 days' where user_id = $1 and event = 'sign_in'`, [B]);
    await db.query(`update public.login_logs set created_at = now() - interval '59 days' where user_id = $1 and event = 'open'`, [B]);
    await as(B);
    await rpc('log_login', ['open', 'android', 102]);
    await as('admin');
    expect((await db.query<{ event: string }>(`select event from public.login_logs where user_id = $1 order by id`, [B])).rows.map(r => r.event))
      .toEqual(['open', 'sign_out', 'open']);
  });
});

describe('익명 로그인 → 구글 연동 (Lim 「일단 첫 사용자는 수파베이스에 익명로그인」)', () => {
  it('익명 계정도 로그인 기록 (anonymous 표시) · 계정 삭제', async () => {
    const u = uid();
    await as('admin'); await db.query(`insert into auth.users (id, is_anonymous) values ($1, true)`, [u]);
    await as(u, { is_anonymous: true });
    expect(await rpc('log_login', ['anon_start', 'android', 101])).toMatchObject({ ok: true });
    await as('admin');
    expect((await db.query(`select event, anonymous from public.login_logs where user_id = $1`, [u])).rows).toEqual([{ event: 'anon_start', anonymous: true }]);
    // 구글을 연결한 뒤 (같은 ID, 토큰의 is_anonymous가 꺼짐): link 기록, 백업 됨
    await db.query(`update auth.users set is_anonymous = false, email = 'g@x' where id = $1`, [u]);
    await as(u, { is_anonymous: false });
    await rpc('log_login', ['link', 'android', 101]);
    expect(await upload(save(), 0)).toMatchObject({ ok: true, rev: 1 });
    await as('admin');
    expect((await db.query<{ event: string; anonymous: boolean }>(`select event, anonymous from public.login_logs where user_id = $1 order by id`, [u])).rows.map(r => `${r.event}:${r.anonymous}`)).toEqual(['anon_start:true', 'link:false']);
    const v = uid();
    await db.query(`insert into auth.users (id, is_anonymous) values ($1, true)`, [v]);
    await as(v, { is_anonymous: true });
    expect(await rpc('delete_account')).toEqual({ ok: true });
    await as('admin');
    expect(Number((await one<{ n: string }>(`select count(*) as n from auth.users where id = $1`, [v])).n)).toBe(0);
  });

  it('admin_cleanup_anonymous: 오래 안 쓴 익명만 지움 (구글 · 최근에 쓴 익명은 남김), 앱은 못 부름', async () => {
    const stale = uid(), fresh = uid(), old = uid(), google = uid();
    await as('admin');
    await db.query(`insert into auth.users (id, is_anonymous, created_at) values ($1, true, now() - interval '90 days'), ($2, true, now() - interval '90 days'), ($3, true, now() - interval '90 days'), ($4, false, now() - interval '90 days')`, [stale, fresh, old, google]);
    await db.query(`insert into public.login_logs (user_id, event, created_at) values ($1, 'open', now() - interval '5 days'), ($2, 'open', now() - interval '70 days')`, [fresh, old]);
    const r = await one<{ n: number }>('select public.admin_cleanup_anonymous() as n');
    expect(r.n).toBeGreaterThanOrEqual(2);
    const left = (await db.query<{ id: string }>(`select id from auth.users where id = any($1::uuid[])`, [[stale, fresh, old, google]])).rows.map(x => x.id).sort();
    expect(left).toEqual([fresh, google].sort());
    await as(A);
    await expect(db.query('select public.admin_cleanup_anonymous()')).rejects.toThrow(/permission denied/);
  });
});

describe('관리자 · 계정 삭제', () => {
  it('admin_restore_save: 사본 한 판을 지금 판으로, 앱의 다음 올림은 conflict', async () => {
    await as(C);
    await upload(save({ level: 12, wins: 5 }), 2);
    await as('admin');
    const h = await one<{ id: number; level: number }>(`select id, level from public.save_history where user_id = $1 order by id desc limit 1`, [C]);
    expect(h.level).toBe(11);
    const r = await one<{ r: { ok: boolean; rev: number } }>(`select public.admin_restore_save($1, $2) as r`, [C, h.id]);
    expect(r.r).toMatchObject({ ok: true, rev: 4 });
    await as(C);
    expect(await upload(save({ level: 13 }), 3)).toMatchObject({ ok: false, reason: 'conflict', rev: 4, level: 11 });
  });

  it('delete_account: Auth 사용자와 저장 · 사본 · 기록 · 로그인 기록이 함께 지워짐', async () => {
    await as(A); await rpc('log_login', ['open']);
    await as(A);
    expect(await rpc('delete_account')).toEqual({ ok: true });
    await as('admin');
    for (const t of ['auth.users where id', 'public.saves where user_id', 'public.save_history where user_id', 'public.audit_flags where user_id', 'public.login_logs where user_id']) {
      expect(Number((await one<{ n: string }>(`select count(*) as n from ${t} = $1`, [A])).n)).toBe(0);
    }
  });
});
