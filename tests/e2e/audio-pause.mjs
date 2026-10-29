// 실제 오디오 문맥·음원으로 일시정지, 앱 복귀, 재시작·종료, 결과→설정 이동을 확인한다.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { departGo, patchSave, toParty } from './nav.mjs';

export default async function audioPause(url, shots) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [], checks = [];
  let fails = 0;
  const ok = (pass, name, detail) => {
    checks.push({ pass, name, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${!pass ? ` ${JSON.stringify(detail)}` : ''}`);
    if (!pass) fails++;
  };
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => {
      window.__audioCheck = { contexts: [], music: [], sources: [] };
      const AC = window.AudioContext, AudioEl = window.Audio;
      window.AudioContext = class extends AC {
        constructor(...args) { super(...args); window.__audioCheck.contexts.push(this); }
      };
      window.Audio = class extends AudioEl {
        constructor(...args) { super(...args); window.__audioCheck.music.push(this); }
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        window.__audioCheck.sources.push(this);
        return start.apply(this, args);
      };
    });
    await page.clock.install();
    await page.goto(url); await page.clock.runFor(300);
    await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: true, music: true, vibrate: false } });
    const sample = () => page.evaluate(() => {
      const a = window.__audioCheck, c = a.contexts.at(-1), m = a.music.at(-1);
      return { state: c?.state, time: c?.currentTime, musicTime: m?.currentTime, musicPaused: m?.paused,
        allMusicPaused: a.music.every(e => e.paused), sources: a.sources.length, loops: a.sources.filter(s => s.loop).length,
        cast: window.__proto.F?.cast?.left, fight: window.__proto.F?.t, bgm: window.__bgm() };
    });
    const settleAudio = async () => { await page.waitForTimeout(150); await page.clock.runFor(50); };
    await toParty(page, { content: 'plateau', tab: 'explore', diff: '쉬움' });
    await departGo(page);
    await page.evaluate(() => {
      const f = window.__proto.F;
      f.skills.forEach(s => { s.next = Infinity; });
      f.party.forEach(u => { u.dps = 0; u.acc = 0; });
      f.bossHp = f.bossMax = 1e9; f.mobs.forEach(m => { m.hp = 1e9; });
    });
    await page.clock.runFor(4000); await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const f = window.__proto.F, u = f.party.find(u => !u.me);
      f.cast = { key: 'heal', cell: u.cell, uid: u.id, left: 30, total: 30 };
      f.events.push({ type: 'sound', name: 'hymn' });
    });
    await page.clock.runFor(50); await settleAudio();
    const running = await sample();
    ok(running.state === 'running' && running.musicPaused === false && running.loops > 0, '배경음·시전 반복음 실제 재생', running);
    await page.click('#pauseBtn'); await settleAudio();
    const paused = await sample();
    await page.clock.runFor(1000); await page.waitForTimeout(200);
    const still = await sample();
    ok(paused.state === 'suspended' && paused.allMusicPaused && still.allMusicPaused
      && Math.abs(still.time - paused.time) < 0.002 && Math.abs(still.musicTime - paused.musicTime) < 0.002
      && still.cast === paused.cast && still.fight === paused.fight, '일시정지: 배경음·효과음·시전 시간 모두 정지', { paused, still });
    await page.click('#restartBtn'); await settleAudio();
    ok((await sample()).allMusicPaused && (await sample()).state === 'suspended', '재시작 확인 창도 소리 정지 유지');
    await page.click('#confirmCancel');
    // 앱으로 돌아오는 visibilitychange와 새 터치가 일시정지를 풀지 않아야 한다.
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('pointerdown')); });
    await settleAudio();
    ok((await sample()).state === 'suspended' && (await sample()).allMusicPaused, '앱 복귀·터치 뒤에도 계속하기 전까지 무음');
    await page.screenshot({ path: `${shots}/audio-paused.png` });
    await page.click('#resumeBtn'); await settleAudio();
    const resumed = await sample();
    ok(resumed.state === 'running' && !resumed.musicPaused && resumed.time > paused.time
      && resumed.musicTime >= paused.musicTime && resumed.loops === paused.loops, '계속하기: 같은 곡·시전 반복음이 이어짐', resumed);
    await page.click('#pauseBtn');
    await page.evaluate(() => window.__battle.settings({ sound: false, vibrate: false }));
    await page.click('#resumeBtn'); await settleAudio();
    ok((await sample()).state === 'suspended' && !(await sample()).musicPaused, '효과음 끔 설정은 계속하기 후에도 유지');
    await page.evaluate(() => window.__battle.settings({ sound: true, vibrate: false }));
    await page.click('#pauseBtn'); await page.click('#restartBtn'); await page.click('#confirmApply');
    await settleAudio();
    ok((await sample()).state === 'running' && !(await sample()).musicPaused, '처음부터 다시 시작하면 소리 정상 복귀');
    await page.click('#pauseBtn'); await page.click('#quitBtn'); await page.click('#confirmApply');
    await page.clock.runFor(1500); await settleAudio();
    ok(await page.isVisible('#s-settle') && (await sample()).state === 'running' && !(await sample()).musicPaused, '포기 후 결과 화면 소리 정상 복귀');
    await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(200);
    for (const win of [true, false]) {
      await toParty(page, { content: 'plateau', tab: 'explore', diff: '쉬움' });
      await departGo(page);
      await page.evaluate(win => {
        window.__proto.dungeon.idx = window.__proto.dungeon.segs.length - 1;
        window.__proto.F.over = win ? 'win' : 'lose';
      }, win);
      await page.clock.runFor(2500); await settleAudio();
      const before = await sample();
      await page.click('#s-settle [data-go="s-settings"]'); await page.clock.runFor(100); await settleAudio();
      const settings = await sample();
      const retained = await page.evaluate(() => { const a = window.__audioCheck.music; window.__resultMusic = a.at(-1); return a.length; });
      await page.click('#s-settings .tb-back'); await page.clock.runFor(100); await settleAudio();
      const after = await sample();
      ok(before.bgm.playing === (win ? 'victory' : 'defeat') && settings.bgm.playing === before.bgm.playing
        && after.bgm.playing === before.bgm.playing && settings.musicTime >= before.musicTime
        && after.musicTime >= settings.musicTime && await page.evaluate(n => window.__audioCheck.music.length === n
          && window.__audioCheck.music.at(-1) === window.__resultMusic, retained), `${win ? '승리' : '패배'}→옵션→뒤로: 같은 곡·재생 위치 유지`, { before, settings, after });
      await page.click('#s-settle [data-go="s-lobby"]'); await page.clock.runFor(100);
    }
    await page.click('#s-lobby [data-go="s-settings"]'); await page.clock.runFor(100);
    await page.locator('#vol-music').press('Home');
    await page.click('#s-settings .tb-back'); await page.clock.runFor(100);
    await toParty(page, { content: 'plateau', tab: 'explore', diff: '쉬움' }); await departGo(page);
    await page.click('#pauseBtn'); await settleAudio();
    await page.click('#resumeBtn'); await settleAudio();
    ok((await sample()).bgm.playing === null && (await sample()).allMusicPaused, '배경음 끔 설정은 일시정지·계속하기 뒤에도 유지');
    ok(errs.length === 0, '브라우저 실행 오류 없음', errs);
    writeFileSync(`${shots}/audio-pause.json`, JSON.stringify({ checks, errs }, null, 2));
  } finally { await browser.close(); }
  return { fails, errs };
}
