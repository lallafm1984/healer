import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { walk } from '../scripts/i18n/scan.mjs';
import { debuffDisplay } from '../src/battle/party-display';
import type { Debuff } from '../src/engine/types';
import { loadDict, setLang, t } from '../src/i18n';

describe('실제 전투 이름과 배지의 번역', () => {
  afterAll(async () => { await setLang('ko'); });
  for (const lang of ['en', 'ja'] as const) {
    it(`${lang}: 엔진에서 직접 만드는 이름과 예고 종류도 등록돼 있다`, () => {
      const dir = fileURLToPath(new URL('../src/engine', import.meta.url));
      const files = [...walk(dir), fileURLToPath(new URL('../src/battle/hud.ts', import.meta.url)), fileURLToPath(new URL('../src/screens/art.ts', import.meta.url))];
      const missing = [];
      for (const file of files) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\bname:\s*'((?:[^'\\]|\\.)*)'/g)) {
          const k = m[1].replace(/\\'/g, "'");
          if (/[가-힣]/.test(k) && !(k in loadDict(lang))) missing.push(`${file.split('/').pop()}: ${k}`);
        }
      }
      expect(missing).toEqual([]);
    });
    it(`${lang}: 기절 · 침묵 · 어픽스 · 이름만 있는 표식도 긴 배지와 짧은 배지 모두 번역된다`, async () => {
      await setLang(lang);
      const defs: Partial<Debuff>[] = [
        { name: '별빛 어지럼', type: '물리', left: 3, noDps: true, noMove: true, lock: true },
        { name: '침묵', type: '물리', left: 6, noDps: true, lock: true },
        { name: '역병 독', type: '독', left: 10, dot: 15 },
        { name: '거품', type: '물리', left: 3, lock: true },
      ];
      for (const d of defs) for (const short of [false, true]) {
        const out = debuffDisplay({ id: 1, ...d } as Debuff, 'priest', short);
        expect(`${out.text} ${out.detail}`, `${d.name} ${short}`).not.toMatch(/[가-힣]/);
      }
      await setLang('ko');
    });
  }
  it('스킬 상세와 현재 효과 · 발동 로그가 같은 스킬 이름을 사용한다', async () => {
    for (const lang of ['en', 'ja'] as const) {
      await setLang(lang);
      for (const [name, key, args] of [
        ['빛의 전이', '빛의 전이 {n}초 (피해를 받으면 회복하고 옆 사람에게, 남은 회복 {k}번)', { n: 5, k: 2 }],
        ['수호 영혼', '수호 영혼 {n}초', { n: 5 }],
        ['별의 잠', '별의 잠: {n}', { n: 'X' }],
        ['차 한 잔', '차 한 잔: 리듬 {x}', { x: 2 }],
      ] as const) expect(t(key, args)).toContain(t(name));
    }
  });
  it('UI · 스킬 · 장비 설명 전체에 이전의 혼동되는 스킬 표기를 다시 넣지 않는다', () => {
    for (const [lang, stale] of [
      ['en', /Qi Rhythm|Clear Qi|Light Relay|Starry Sleep/],
      ['ja', /レイドバフ|蘇生の風|守護の精霊|お茶一杯/],
    ] as const) {
      const found = Object.entries(loadDict(lang)).filter(([, text]) => stale.test(text));
      expect(found, lang).toEqual([]);
    }
  });
});
