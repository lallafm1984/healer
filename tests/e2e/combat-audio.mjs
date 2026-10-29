// Real Web Audio decoding/playback: battle events, all seven healer voices,
// mass-hit deduplication, mute, and browser errors. No audio API mocks.
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COMBAT_SOUNDS } from '../../scripts/sfx/combat.mjs';
import { departGo, patchSave, toParty } from './nav.mjs';

export default async function combatAudio(url, shots) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [], checks = [];
  let fails = 0;
  const ok = (pass, name, detail) => {
    checks.push({ pass, name, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${!pass ? ` ${JSON.stringify(detail)}` : ''}`);
    if (!pass) fails++;
  };
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const names = COMBAT_SOUNDS.map(s => s.name).sort((a, b) => b.length - a.length);
    const hashes = Object.fromEntries(names.map(name => [
      createHash('sha256').update(readFileSync(`src/sfx/${name}.ogg`)).digest('hex'), name,
    ]));
    await page.addInitScript(({ names, hashes }) => {
      const buffers = new WeakMap(), bytes = new WeakMap(), playing = new WeakMap();
      window.__audioQA = { starts: [], decoded: [], failed: [], contexts: [] };
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const path = response.url.split('/').pop().split('?')[0];
        let name = names.find(n => path === `${n}.ogg` || path.startsWith(`${n}-`) && path.endsWith('.ogg'));
        // Vite may inline a very short OGG; identify those by the exact asset bytes.
        if (name || /^data:(audio|application)\/ogg/.test(response.url)) {
          if (!response.ok) window.__audioQA.failed.push({ name, status: response.status });
          const arrayBuffer = response.arrayBuffer.bind(response);
          response.arrayBuffer = async () => {
            const data = await arrayBuffer();
            if (!name) {
              const hash = await crypto.subtle.digest('SHA-256', data);
              name = hashes[Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')];
            }
            if (name) bytes.set(data, name);
            return data;
          };
        }
        return response;
      };
      const decode = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = async function(data) {
        const name = bytes.get(data);
        try {
          const buffer = await decode.call(this, data);
          if (name) { buffers.set(buffer, name); window.__audioQA.decoded.push({ name, duration: buffer.duration }); }
          if (!window.__audioQA.contexts.includes(this)) window.__audioQA.contexts.push(this);
          return buffer;
        } catch (e) { window.__audioQA.failed.push({ name, error: String(e) }); throw e; }
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        const name = buffers.get(this.buffer);
        if (name) {
          const record = { name, at: performance.now(), rate: this.playbackRate.value,
            startAt: args[0] ?? this.context.currentTime, stopAt: null };
          playing.set(this, record);
          window.__audioQA.starts.push(record);
        }
        return start.apply(this, args);
      };
      const stop = AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.stop = function(...args) {
        const record = playing.get(this);
        if (record) record.stopAt = args[0] ?? this.context.currentTime;
        return stop.apply(this, args);
      };
    }, { names, hashes });
    await page.clock.install();
    await page.goto(url);
    await page.clock.runFor(500);
    await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: true, vibrate: false } });
    await toParty(page, { content: 'rustfort', tab: 'dungeon', diff: '쉬움' });
    await departGo(page);
    // 보스 기술 착탄 소리 (bs- · bc- · boss-<특성>-<방식>)는 전투마다 그 보스 것만 풂 (src/sfx/index.ts perBattle, #352): 나머지가 다 풀릴 때까지만 기다림
    const BOSS_THEME = /^boss-[a-z]+-(hit|wave|ground|cast)$/;
    const perBattle = n => n.startsWith('bs-') || n.startsWith('bc-') || BOSS_THEME.test(n);
    const always = COMBAT_SOUNDS.filter(s => !perBattle(s.name)).length;
    for (let i = 0; i < 600; i++) {
      if (await page.evaluate(count => new Set(window.__audioQA.decoded.map(x => x.name)).size >= count, always)) break;
      await page.waitForTimeout(100);
      await page.clock.runFor(10);
    }
    // 이번 전투에서 안 푼 보스 기술 소리도 실제로 풀리는지: 빌드된 파일을 같은 소리 문맥으로 직접 풂
    const assets = readdirSync('dist/assets');
    const inline = new Map();
    for (const js of assets.filter(f => f.endsWith('.js'))) {
      for (const [data] of readFileSync(`dist/assets/${js}`, 'utf8').matchAll(/data:(?:audio|application)\/ogg;base64,[A-Za-z0-9+/=]+/g)) {
        const name = hashes[createHash('sha256').update(Buffer.from(data.split(',')[1], 'base64')).digest('hex')];
        if (name) inline.set(name, data);
      }
    }
    const bossUrls = COMBAT_SOUNDS.filter(s => perBattle(s.name)).map(s => {
      const file = assets.find(f => f.startsWith(`${s.name}-`) && /^[\w-]{8}\.ogg$/.test(f.slice(s.name.length + 1)));
      return file ? `assets/${file}` : inline.get(s.name);
    });
    ok(bossUrls.every(Boolean), '보스 기술 소리 파일이 빌드에 모두 있음', bossUrls.filter(x => !x).length);
    await page.evaluate(async urls => {
      const c = window.__audioQA.contexts[0];
      for (const u of urls) { try { await c.decodeAudioData(await (await fetch(u)).arrayBuffer()); } catch { /* failed에 남음 */ } }
    }, bossUrls.filter(Boolean));
    await page.clock.runFor(4500);
    await page.evaluate(() => {
      const f = window.__proto.F;
      f.skills.forEach(s => { s.next = Infinity; });
      f.party.forEach(u => { u.hp = u.max; u.dps = 0; u.acc = 0; });
      f.bossHp = 1e9;
      f.mobs.forEach(m => { m.hp = 1e9; });
    });
    const decoded = await page.evaluate(() => window.__audioQA.decoded);
    ok(new Set(decoded.map(x => x.name)).size === COMBAT_SOUNDS.length, `전투음 ${COMBAT_SOUNDS.length}종 실제 디코딩`);
    // Chromium can expose Vorbis end padding (e.g. 1.5s boss-enrage decodes as 1.519s).
    // The playback cap is the source's scheduled stop, checked below, not buffer length.
    ok(decoded.every(x => x.duration > 0 && Number.isFinite(x.duration)), '전투음 디코딩 길이 정상');
    const states = await page.evaluate(() => window.__audioQA.contexts.map(c => c.state));
    ok(states.length > 0 && states.every(s => s === 'running'), '실제 오디오 출력 문맥 실행 중', states);
    await page.waitForTimeout(1800);
    const inject = async (events, expected, label) => {
      await page.clock.runFor(1000);
      const before = await page.evaluate(() => window.__audioQA.starts.length);
      await page.evaluate(list => {
        const f = window.__proto.F, u = f.party.find(u => !u.me);
        f.events.push(...list.map(e => ({ ...e, ...(e.id === -1 ? { id: u.id } : {}), ...(e.uid === -1 ? { uid: u.id } : {}) })));
      }, events);
      // 사건은 매 장 handleEvents가 소리로 바꿈: CI 러너에서 한 장 늦을 때가 있어 기대한 소리가 날 때까지 20ms씩 (40ms부터 600ms까지, 예전 40ms 한 번)
      let actual = [];
      for (let i = 0; i < 30; i++) {
        await page.clock.runFor(20);
        actual = await page.evaluate(i => window.__audioQA.starts.slice(i).map(s => s.name), before);
        if (i >= 1 && expected.every(n => actual.includes(n))) break;
      }
      ok(expected.every(n => actual.includes(n)), label, actual);
      await page.waitForTimeout(1600);
      return actual;
    };
    const attack = await inject([{ type: 'hit', uid: -1, amt: 20 }, { type: 'miss', uid: -1 }, { type: 'parry', id: -1 }], ['attack-miss', 'parry'], '공격·빗나감·막기 이벤트');
    ok(attack.filter(n => n.startsWith('atk-')).length === 1, '기존 직업별 공격음 한 번 재생');
    ok(!attack.some(n => /^attack-(melee|heavy|bow|magic)$/.test(n)), '공통 공격음을 겹쳐 재생하지 않음');
    const mass = await inject(Array.from({ length: 20 }, () => ({ type: 'dmg', id: -1, amt: 20 })), ['ally-hurt'], '20개 동시 피격');
    ok(mass.filter(n => n === 'ally-hurt').length === 1, '동시 피격은 한 번만 재생');
    await inject([{ type: 'impact', kind: 'buster' }, { type: 'shield', id: -1, amt: 20 }], ['boss-impact', 'shield'], '강타 착탄·보호막');
    await inject([{ type: 'fx', name: 'chain-strike' }, { type: 'fx', name: 'splash' }], ['magic-lightning', 'magic-water'], '번개·물 기믹');
    for (const hero of ['priest', 'druid', 'paladin', 'shaman', 'monk', 'astrologer', 'warder']) {
      await page.evaluate(hero => window.__battle.settings({ hero, sound: true, vibrate: false }), hero);
      await inject([{ type: 'sound', name: 'heal' }, { type: 'sound', name: 'renew' }, { type: 'sound', name: 'hymn' }],
        [`heal-${hero}`, `renew-${hero}`, `hymn-${hero}`], `${hero} 직접·지속·큰 치유`);
    }
    await page.evaluate(() => window.__battle.settings({ hero: 'priest', sound: false, vibrate: false }));
    const muted = await inject([{ type: 'sound', name: 'heal' }, { type: 'dmg', id: -1, amt: 20 }], [], '음소거 설정');
    ok(muted.length === 0, '음소거 중 신규 재생 없음', muted);
    await page.evaluate(() => window.__battle.settings({ hero: 'priest', sound: true, vibrate: false }));
    await inject([{ type: 'sound', name: 'heal' }], ['heal-priest'], '음소거 해제 후 정상 복귀');
    await inject([{ type: 'sound', name: 'boss-enrage' }], ['boss-enrage'], '1.5초 경계 효과음 재생');
    const playback = await page.evaluate(() => window.__audioQA.starts.map(s => ({
      name: s.name, seconds: s.stopAt === null ? null : s.stopAt - s.startAt,
    })));
    ok(playback.length > 0 && playback.every(s => s.seconds !== null && s.seconds > 0 && s.seconds <= 1.5 + 1e-6),
      '모든 재생 효과음이 최대 1.5초 안에 종료하도록 예약됨', playback.filter(s => s.seconds === null || s.seconds <= 0 || s.seconds > 1.5 + 1e-6));
    await page.screenshot({ path: `${shots}/combat-audio.png` });
    const failed = await page.evaluate(() => window.__audioQA.failed);
    ok(failed.length === 0, '음원 HTTP·디코딩 오류 없음', failed);
    ok(errs.length === 0, '브라우저 실행 오류 없음', errs);
    writeFileSync(`${shots}/combat-audio.json`, JSON.stringify({ checks, errs, decoded, playback }, null, 2));
    await context.close();
  } finally { await browser.close(); }
  return { fails, errs };
}
