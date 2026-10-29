// 보스 공략 시트 세 언어 (기획 121 3단계 ⑤-b): 영어 · 일본어로 모든 장소 × 난이도 공략 HTML의 글에 한국어가 남지 않고, 대상 칩 · 머리글 · 주기 · 굵은 피해 숫자가 번역된다.
// 한국어가 그대로인지는 tests/guide-ko.test.ts (지문) · tests/e2e/i18n-ko.mjs (일시정지 · 정비 공략 스냅샷).
import { afterAll, describe, expect, it } from 'vitest';
import { guideHtml, guideModel } from '../src/battle/guide';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import { DIFFS, type DiffName } from '../src/data/difficulty';
import { setLang } from '../src/i18n';

const text = (h: string) => h.replace(/<[^>]+>/g, ' ');

describe('공략 시트 영어 · 일본어', () => {
  afterAll(async () => { await setLang('ko'); });
  for (const lang of ['en', 'ja'] as const) {
    it(`${lang}: 모든 장소 × 난이도의 공략 글에 한국어가 없다`, async () => {
      await setLang(lang);
      const bad: string[] = [];
      for (const key of Object.keys(ENCOUNTERS) as EncounterKey[]) for (const diff of Object.keys(DIFFS) as DiffName[]) {
        const h = text(guideHtml(guideModel(key, diff, 30, 30), null));
        const m = h.match(/[^\s<>]*[가-힣][^\s<>]*/g);
        if (m) bad.push(`${key}|${diff}: ${[...new Set(m)].slice(0, 6).join(' ')}`);
      }
      expect(bad.slice(0, 20)).toEqual([]);
    });
  }
  it('en: 머리글 · 대상 칩 · 주기 · 굵은 피해 숫자', async () => {
    await setLang('en');
    const h = guideHtml(guideModel('warden', '보통', 30, 30), null);
    expect(h).toContain('<h4 class="gd-h">Progress</h4>');
    expect(h).toContain('<h4 class="gd-h">Boss Ability</h4>');
    expect(h).toMatch(/<span class="gs-who tank">Tank<\/span>/);
    expect(h).toMatch(/<span class="gs-who all">All<\/span>/);
    expect(h).toMatch(/<span class="gs-who zone">AoE<\/span>/);
    expect(h).toMatch(/class="gs-every">every [\d.]+s</);
    expect(h).toMatch(/<b>\d+<\/b> damage/);
    expect(h).toMatch(/<b>\d+<\/b> damage per sec/);
    expect(h).toContain('<span class="tag diff">Normal</span>');
    const trash = guideHtml(guideModel('gate', '보통', 30, 30), null);
    expect(trash).toContain('Kill Order');
    expect(trash).toContain('Enemy Ability');
    expect(trash).toMatch(/<span class="gs-who some">1 player<\/span>/);
  });
  it('ja: 굵은 피해 숫자 · 글자 아이콘은 이름 앞 2자', async () => {
    await setLang('ja');
    const h = guideHtml(guideModel('warden', '보통', 30, 30), null);
    expect(h).toMatch(/<b>\d+<\/b>ダメージ/);
    expect(h).toMatch(/毎秒<b>\d+<\/b>/);
    expect(h).toMatch(/<span class="gs-who tank">タンク<\/span>/);
    expect(h).toMatch(/class="gs-every">[\d.]+秒ごと</);
    expect(h).toMatch(/<span class="ic" style="background:[^"]+">[^<가-힣]{1,2}<\/span>/);
  });
});
