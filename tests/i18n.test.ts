/**
 * 다국어 (기획 121): 한국어 항등 (t(k) === k), 자리값, 코드의 모든 t('…') 열쇠가 en · ja 사전에 있는지, 번역의 자리값이 열쇠와 같은지, 숫자 표기 세 언어.
 * 화면 전체가 예전과 같은지는 tests/e2e/i18n-ko.mjs (HTML 스냅샷)
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanHtmlKeys, scanKeys, slots } from '../scripts/i18n/scan.mjs';
import { fmtInt, lang, LANGS, loadDict, setLang, shortAmount, t, tc } from '../src/i18n';
import en from '../src/i18n/en';
import ja from '../src/i18n/ja';

const found = scanKeys(fileURLToPath(new URL('../src', import.meta.url)));
const keys = [...new Set([...found.map(k => k.key), ...scanHtmlKeys(fileURLToPath(new URL('../index.html', import.meta.url)))])];

describe('i18n', () => {
  it('단위 테스트 · 시뮬은 한국어', () => { expect(lang()).toBe('ko'); expect(LANGS.map(l => l.key)).toEqual(['ko', 'en', 'ja']); });
  it('한국어는 원문 그대로 (사전 열쇠 전부 · 코드 열쇠 전부)', () => {
    for (const k of [...Object.keys(en), ...Object.keys(ja), ...keys]) expect(t(k)).toBe(k);
    expect(t('휴식 보너스 +{n}', { n: 3 })).toBe('휴식 보너스 +3');
    expect(t('{a} / {b}', { a: 1, b: '둘' })).toBe('1 / 둘');
    expect(t('없는 자리값 {x}', { n: 1 })).toBe('없는 자리값 {x}');
  });
  it('코드의 t() 열쇠는 모두 en · ja 사전에 (감싼 글은 그 PR에서 번역)', () => {
    expect(found.filter(k => k.bad).map(k => `${k.file}:${k.line}`)).toEqual([]);
    expect(keys.filter(k => !(k in en))).toEqual([]);
    expect(keys.filter(k => !(k in ja))).toEqual([]);
  });
  it('번역의 자리값은 열쇠와 같고 빈 번역은 없음 · 꼬리표 열쇠 (@short)는 바탕 열쇠가 있어야 함', () => {
    for (const d of [en, ja]) for (const [k, v] of Object.entries(d)) {
      expect(v, k).not.toBe('');
      expect(slots(v), `${k} → ${v}`).toBe(slots(k));
      const at = k.indexOf('@');
      if (at > 0) expect(k.slice(0, at) in d, k).toBe(true);
    }
    expect(tc('주간 도전', 'short')).toBe('주간 도전');
  });
  it('영어 · 일본어: 사전에 있으면 번역, 없으면 한국어, 자리값', async () => {
    const enD = loadDict('en');
    expect(enD['설정']).toBe('Settings');
    await setLang('en');
    expect(t('설정')).toBe('Settings');
    expect(t('Lv {n}에 열림', { n: 30 })).toBe('Unlocks at Lv 30');
    expect(t('사전에 없는 말')).toBe('사전에 없는 말');
    expect(tc('주간 도전', 'short')).toBe('Weekly');
    expect(tc('주간 도전', '없는꼬리표')).toBe('Weekly Challenge');
    await setLang('ja');
    expect(t('설정')).toBe('設定');
    expect(t('특성 {n} 남음', { n: 2 })).toBe('特性 残り2');
    await setLang('ko');
    expect(t('설정')).toBe('설정');
  });
  it('숫자: 1만부터 줄임 · 버림, 언어마다', async () => {
    expect([1234, 12345, 123456, 1234567, 123456789, 19999, Infinity].map(shortAmount)).toEqual(['1,234', '1.23만', '12.3만', '123만', '1.23억', '1.99만', '∞']);
    expect(fmtInt(1234567.4)).toBe('1,234,567');
    await setLang('en');
    expect([12345, 123456, 1234567, 123456789].map(shortAmount)).toEqual(['12.3K', '123K', '1.23M', '123M']);
    await setLang('ja');
    expect([12345, 123456, 1234567, 123456789].map(shortAmount)).toEqual(['1.23万', '12.3万', '123万', '1.23億']);
    await setLang('ko');
  });
});
