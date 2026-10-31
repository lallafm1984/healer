import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
let db: PGlite;
const admin = () => db.exec('reset role');
const boot = async (language?: string | null, count = false) => {
  await db.exec('set role anon');
  const args = language === undefined ? ['android', 652, count] : ['android', 652, count, language];
  return (await db.query<{ b: any }>(`select public.app_boot(${args.map((_, i) => `$${i + 1}`).join(',')}) as b`, args)).rows[0].b;
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests/fixtures/supabase-stub.sql'), 'utf8'));
  const dir = join(root, 'supabase/migrations');
  for (const name of readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, name), 'utf8'));
  await db.exec(`update public.app_config set min_version=650, latest_version=652, update_message='한국어 업데이트', maintenance_message='한국어 점검' where platform='android';
    insert into public.notices(id,title,body,popup,sort) overriding system value values (-1,'한국어 제목','한국어 본문',true,9),(-2,'기존 한국어','기존 본문',false,1);
    insert into public.notices(id,title,active) overriding system value values (-3,'비활성',false);
    insert into public.notices(id,title,min_version) overriding system value values (-4,'미래 버전',700);
    insert into public.notices(id,title,platform) overriding system value values (-5,'아이폰','ios');
    insert into public.notices(id,title,starts_at) overriding system value values (-6,'미래 공지',now()+interval '1 day');
    insert into public.notices(id,title,ends_at) overriding system value values (-7,'종료 공지',now()-interval '1 day');
    insert into public.notice_translations values (-1,'en','English title','English body'),(-1,'ja','日本語タイトル','日本語の本文');
    insert into public.app_config_translations values ('android','en','English update','English maintenance'),('android','ja','日本語更新','日本語メンテナンス');`);
});
afterAll(async () => { await db.close(); });

describe('서버 선택 언어', () => {
  it('기존 2/3인자 호출은 원래 한국어와 필터를 그대로 유지', async () => {
    const b = await boot();
    expect(b.notices.map((n: any) => n.title)).toEqual(['한국어 제목', '기존 한국어']);
    expect(b.config.update_message).toBe('한국어 업데이트');
    expect((await db.query<{ b: any }>(`select public.app_boot('android',652) as b`)).rows[0].b.notices[0].title).toBe('한국어 제목');
  });
  for (const [lang, title, body, update, maintenance] of [
    ['ko', '한국어 제목', '한국어 본문', '한국어 업데이트', '한국어 점검'],
    ['en', 'English title', 'English body', 'English update', 'English maintenance'],
    ['ja', '日本語タイトル', '日本語の本文', '日本語更新', '日本語メンテナンス'],
  ]) it(`${lang}: 공지·업데이트·점검은 선택 언어, 대상·순서·번호 유지`, async () => {
    const b = await boot(lang);
    expect(b).toMatchObject({ language: lang, config: { min_version: 650, latest_version: 652, update_message: update, maintenance_message: maintenance } });
    expect(b.notices).toEqual([
      expect.objectContaining({ id: -1, title, body, popup: true, language: lang }),
      expect.objectContaining({ id: -2, title: '기존 한국어', body: '기존 본문', popup: false, language: 'ko' }),
    ]);
  });
  it('지역 코드 정규화와 지원하지 않는 언어의 영어 대체', async () => {
    for (const [input, output] of [[' ja_JP ', 'ja'], ['EN-us', 'en'], ['ko-KR', 'ko'], ['fr', 'en'], [null, 'en']]) {
      expect((await boot(input)).language).toBe(output);
    }
  });
  it('누락된 일본어는 영어 한 묶음으로 대체, 빈 본문을 다른 언어로 섞지 않음', async () => {
    await admin(); await db.exec(`begin; delete from public.notice_translations where notice_id=-1 and lang='ja'; update public.notice_translations set body='' where notice_id=-1 and lang='en';`);
    try { expect((await boot('ja')).notices[0]).toMatchObject({ title: 'English title', body: '', language: 'en' }); }
    finally { await admin(); await db.exec('rollback'); }
  });
  it('빈 안내 문구는 영어, 영어도 없으면 기존 문구로 대체', async () => {
    await admin(); await db.exec(`begin; update public.app_config_translations set update_message=' ', maintenance_message=null where lang='ja'; update public.app_config_translations set maintenance_message=null where lang='en';`);
    try { expect((await boot('ja')).config).toMatchObject({ update_message: 'English update', maintenance_message: '한국어 점검' }); }
    finally { await admin(); await db.exec('rollback'); }
  });
  it('한국어 번역을 등록하면 새 앱에 우선 적용, 이전 응답과 데이터는 유지', async () => {
    await admin(); await db.exec(`begin; insert into public.notice_translations values (-1,'ko','새 한국어','새 본문');`);
    try {
      expect((await boot('ko')).notices[0].title).toBe('새 한국어');
      expect((await boot()).notices[0].title).toBe('한국어 제목');
    } finally { await admin(); await db.exec('rollback'); }
  });
  it('언어 갱신은 통계를 늘리지 않고 count=true도 정확히 한 번만 집계', async () => {
    await admin();
    const total = async () => Number((await db.query<{ n: string }>('select coalesce(sum(n),0) n from public.boot_stats')).rows[0].n);
    const before = await total();
    await boot('en'); await boot('ja'); await admin(); expect(await total()).toBe(before);
    await boot('en', true); await admin(); expect(await total()).toBe(before + 1);
  });
  it('없는 플랫폼은 설정 없음·빈 공지로 안전하게 응답', async () => {
    await db.exec('set role anon');
    const b = (await db.query<{ b: any }>(`select public.app_boot('invalid',652,false,'ja') b`)).rows[0].b;
    expect(b.config).toBeNull();
    expect(b.notices.every((n: any) => n.id !== -5)).toBe(true);
  });
  it('게스트·로그인 사용자는 번역 표를 직접 읽거나 변경할 수 없음', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      for (const table of ['notice_translations', 'app_config_translations']) {
        await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
        await expect(db.query(`delete from public.${table}`)).rejects.toThrow(/permission denied/);
      }
      expect((await db.query<{ b: any }>(`select public.app_boot('android',652,false,'en') b`)).rows[0].b.language).toBe('en');
    }
  });
  it('지원 언어·빈 제목 제약과 원본 공지 삭제의 번역 정리', async () => {
    await admin();
    await expect(db.exec(`insert into public.notice_translations values (-1,'fr','Titre','')`)).rejects.toThrow(/check constraint/);
    await expect(db.exec(`insert into public.notice_translations values (-2,'en','  ','')`)).rejects.toThrow(/check constraint/);
    await db.exec(`begin; delete from public.notices where id=-1;`);
    expect((await db.query('select * from public.notice_translations where notice_id=-1')).rows).toEqual([]);
    await db.exec('rollback');
  });
});
