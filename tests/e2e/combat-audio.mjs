// Real Web Audio decoding/playback: battle events, all seven healer voices,
// mass-hit deduplication, mute, and browser errors. No audio API mocks.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
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
      const buffers = new WeakMap(), bytes = new WeakMap();
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
        if (name) window.__audioQA.starts.push({ name, at: performance.now(), rate: this.playbackRate.value });
        return start.apply(this, args);
      };
    }, { names, hashes });
    await page.clock.install();
    await page.goto(url);
    await page.clock.runFor(500);
    await patchSave(page, { player: { level: 100 }, settings: { devUnlock: true, auto: false, sound: true, vibrate: false } });
    await toParty(page, { content: 'rustfort', tab: 'dungeon', diff: '쉬움' });
    await departGo(page);
    for (let i = 0; i < 600; i++) {
      if (await page.evaluate(count => new Set(window.__audioQA.decoded.map(x => x.name)).size >= count, COMBAT_SOUNDS.length)) break;
      await page.waitForTimeout(100);
      await page.clock.runFor(10);
    }
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
    ok(decoded.every(x => x.duration > 0 && x.duration <= 1.5), '모든 효과음 최대 1.5초');
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
      await page.clock.runFor(40);
      const actual = await page.evaluate(i => window.__audioQA.starts.slice(i).map(s => s.name), before);
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
    await page.screenshot({ path: `${shots}/combat-audio.png` });
    const failed = await page.evaluate(() => window.__audioQA.failed);
    ok(failed.length === 0, '음원 HTTP·디코딩 오류 없음', failed);
    ok(errs.length === 0, '브라우저 실행 오류 없음', errs);
    writeFileSync(`${shots}/combat-audio.json`, JSON.stringify({ checks, errs, decoded }, null, 2));
    await context.close();
  } finally { await browser.close(); }
  return { fails, errs };
}
