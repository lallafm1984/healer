// 실제 설정 칩 → 서버 요청 → 타이틀·설정 공지·강제 업데이트. 외부 HTTP·네이티브 브리지만 모형.
import { chromium } from 'playwright';
import { start, normal } from './server-startup.mjs';
const text = {
  ko: ['운영 공지', '한국어 공지 본문', '한국어 업데이트 안내', '한국어 점검 안내'],
  en: ['Server Notice', 'This is the English notice.', 'Please update to continue.', 'Server maintenance is in progress.'],
  ja: ['運営からのお知らせ', '日本語のお知らせ本文です。', 'アップデート後に続けられます。', 'サーバーメンテナンス中です。'],
};
const localized = ({ p_lang }) => {
  const b = normal(), t = text[p_lang];
  b.language = p_lang; b.notices = [{ id: 1001, title: t[0], body: t[1], popup: true, starts_at: Date.now() }];
  b.config.update_message = t[2]; b.config.maintenance_message = t[3]; return b;
};
export default async function serverLanguage(url, shots) {
  const browser = await chromium.launch(), errs = []; let fails = 0;
  const ok = (v, label) => { console.log(`${v ? 'PASS' : 'FAIL'} ${label}`); if (!v) fails++; };
  try {
    for (const language of ['ko', 'en', 'ja']) {
      const x = await start(browser, url, errs, { language, boot: localized });
      try {
        const { page: p, state: s } = x; await p.locator('.admodal.notice').waitFor();
        ok(s.requests[0].body.p_lang === language, `${language}: 저장된 설정 언어를 실제 app_boot 요청에 전달`);
        ok(await p.locator('.admodal h3').innerText() === text[language][0] && await p.locator('.admodal p').innerText() === text[language][1], `${language}: 타이틀 공지는 서버의 선택 언어 제목·본문`);
        await p.screenshot({ path: `${shots}/server-language-notice-${language}.png` });
        await p.click('.admodal [data-ask="close"]'); await p.waitForFunction(() => !document.querySelector('#titleStart').disabled);
        await p.click('#titleStart'); await p.locator('#s-lobby').waitFor({ state: 'visible' }); await p.click('#s-lobby [data-go="s-settings"]');
        for (const next of ['en', 'ja', 'ko']) {
          const before = s.requests.length;
          await p.click(`[data-lang="${next}"]`);
          await p.click('#noticeOpen'); await p.locator('.admodal.notice').waitFor();
          ok(await p.locator('.admodal .st-notice').textContent() === text[next][0] + text[next][1], `${language}→${next}: 설정 변경 후 재실행 없이 공지 갱신`);
          ok(s.requests.slice(before).filter(r => r.path.endsWith('/app_boot')).every(r => r.body.p_lang === next && r.body.p_count === false), `${next}: 언어 갱신·공지 열기는 켠 수를 늘리지 않음`);
          await p.click('.admodal [data-ask="close"]');
        }
        // 확인한 같은 공지 번호는 다른 번역을 읽어도 재실행 시 자동 팝업을 반복하지 않는다.
        await p.reload(); await p.waitForFunction(() => !document.querySelector('#titleStart').disabled);
        ok(await p.locator('.admodal').count() === 0, `${language}: 번역이 바뀌어도 공지 읽음 번호는 공통`);
      } finally { await x.close(); }

      const y = await start(browser, url, errs, { language, boot: args => {
        const b = localized(args); b.config.min_version = 652; b.config.latest_version = 652; b.config.maintenance = true; return b;
      } });
      try {
        const p = y.page; await p.locator('.admodal.block').waitFor();
        ok(await p.locator('.admodal').count() === 1 && await p.locator('.admodal p').innerText() === text[language][2], `${language}: 번역된 강제 업데이트가 공지·점검보다 먼저 단독 표시`);
        await p.screenshot({ path: `${shots}/server-language-force-${language}.png` });
      } finally { await y.close(); }
      const messages = await start(browser, url, errs, { language, boot: args => {
        const b = localized(args); b.config.maintenance = true; b.config.latest_version = 652; return b;
      } });
      try {
        const p = messages.page; await p.locator('.admodal.notice').waitFor();
        ok(await p.locator('.admodal p').innerText() === text[language][3], `${language}: 점검 안내도 서버 번역 사용`);
        await p.click('.admodal [data-ask="close"]'); await p.locator('.admodal [data-ask="no"]').waitFor();
        ok(await p.locator('.admodal p').innerText() === text[language][2], `${language}: 일반 업데이트 안내도 서버 번역 사용`);
        await p.click('.admodal [data-ask="no"]'); await p.locator('.admodal.notice').waitFor();
        ok(await p.locator('.admodal p').innerText() === text[language][1], `${language}: 점검·일반 업데이트 뒤 공지 순서 유지`);
      } finally { await messages.close(); }
    }
    const race = await start(browser, url, errs);
    try {
      const { page: p, state: s } = race; await p.waitForFunction(() => !document.querySelector('#titleStart').disabled);
      await p.click('#titleStart'); await p.locator('#s-lobby').waitFor({ state: 'visible' }); await p.click('#s-lobby [data-go="s-settings"]');
      s.hold = true; s.boot = localized;
      await p.click('[data-lang="en"]'); await p.waitForFunction(() => document.querySelector('[data-lang="en"]').getAttribute('aria-pressed') === 'true');
      await p.click('[data-lang="ja"]'); await p.click('#noticeOpen'); s.release.resolve(); await p.locator('.admodal.notice').waitFor();
      ok(await p.locator('.admodal .st-notice').textContent() === text.ja[0] + text.ja[1], '빠른 영어→일본어 전환에서 느린 영어 응답이 일본어를 덮지 않음');
      await p.click('.admodal [data-ask="close"]');
      let release;
      s.release = { promise: new Promise(resolve => { release = resolve; }), resolve: () => release() };
      await p.click('[data-lang="en"]'); await p.click('#noticeOpen'); await p.clock.fastForward(8100); await p.locator('.admodal.notice').waitFor();
      ok(await p.locator('.admodal .st-notice').textContent() === text.en[0] + text.en[1], '서버 무응답에서도 선택 언어의 지난 공지만 표시 (일본어 캐시 혼입 없음)');
    } finally { await race.close(); }
    const priority = await start(browser, url, errs);
    try {
      const { page: p, state: s } = priority; await p.waitForFunction(() => !document.querySelector('#titleStart').disabled);
      await p.click('#titleStart'); await p.locator('#s-lobby').waitFor({ state: 'visible' }); await p.click('#s-lobby [data-go="s-settings"]');
      s.hold = true; s.boot = args => { const b = localized(args); b.config.min_version = 652; return b; };
      await p.click('[data-lang="ja"]'); await p.click('#noticeOpen'); s.release.resolve(); await p.locator('.admodal.block').waitFor();
      ok(await p.locator('.admodal').count() === 1 && await p.locator('.admodal p').innerText() === text.ja[2], '설정 언어 변경·공지 열기에서도 새 강제 업데이트가 공지 목록보다 우선');
    } finally { await priority.close(); }
  } catch (e) { errs.push(e.stack || String(e)); }
  finally { await browser.close(); }
  return { fails, errs };
}
