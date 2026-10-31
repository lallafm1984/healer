import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let appBoot: typeof import('../src/platform/server').appBoot;
let noticeList: typeof import('../src/platform/server').noticeList;
let setLang: typeof import('../src/i18n').setLang;
vi.mock('../src/platform/server-config', () => ({ serverOn: () => true, SUPABASE_URL: 'https://test.invalid', SUPABASE_KEY: 'public-test-key' }));
vi.mock('../src/platform/time', () => ({ elapsedNow: () => 100, syncServer: vi.fn() }));
const config = { min_version: 0, latest_version: 0, flags: {}, maintenance: false };
const reply = (title: string) => ({ now: 100, config, notices: [{ id: 1, title, body: title, popup: true, starts_at: 1 }] });
let cache: Map<string, string>;
beforeEach(async () => {
  vi.resetModules();
  cache = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => cache.get(k) ?? null, setItem: (k: string, v: string) => cache.set(k, v) });
  ({ appBoot, noticeList } = await import('../src/platform/server'));
  ({ setLang } = await import('../src/i18n'));
  await setLang('ko');
});
afterEach(() => { vi.unstubAllGlobals(); });

it('설정 언어를 RPC에 전달하고 공지를 언어별로 보관', async () => {
  const fetch = vi.fn(async (_: unknown, options: any) => ({ ok: true, json: async () => reply(JSON.parse(options.body).p_lang) }));
  vi.stubGlobal('fetch', fetch);
  for (const l of ['ko', 'en', 'ja'] as const) {
    await setLang(l); await appBoot(false);
    expect(JSON.parse(fetch.mock.calls.at(-1)![1].body)).toMatchObject({ p_lang: l, p_count: false });
    expect(noticeList()[0].title).toBe(l);
    expect(JSON.parse(cache.get(`healer.notices.${l}`)!)[0].title).toBe(l);
  }
  expect(JSON.parse(cache.get('healer.notices')!)[0].title).toBe('ko');
});
it('오프라인일 때 다른 언어의 공지로 섞이지 않고 해당 언어의 캐시만 사용', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  cache.set('healer.notices', JSON.stringify(reply('legacy ko').notices));
  cache.set('healer.notices.en', JSON.stringify(reply('cached en').notices));
  await setLang('en'); await appBoot(false); expect(noticeList()[0].title).toBe('cached en');
  await setLang('ja'); await appBoot(false); expect(noticeList()).toEqual([]);
  cache.set('healer.notices.ja', '{}'); expect(noticeList()).toEqual([]);
});
it('언어를 바꾸기 전의 느린 응답이 새 언어의 결과를 덮지 않음', async () => {
  let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (_: unknown, options: any) => {
    const language = JSON.parse(options.body).p_lang;
    if (language === 'en') await held;
    return { ok: true, json: async () => reply(language) };
  }));
  await setLang('en'); const slow = appBoot(false); await Promise.resolve();
  await setLang('ja'); await appBoot(false); finish();
  expect(await slow).toBeNull(); expect(noticeList()[0].title).toBe('ja');
});
