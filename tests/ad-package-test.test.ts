import { afterEach, expect, it, vi } from 'vitest';
import { adsFree, staminaMax } from '../src/game/stamina';
import { newSave } from '../src/platform/storage';
import { adPackageTestAvailable } from '../src/platform/ad-package-test';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('시험 ON/OFF는 실제 구매 기록과 휴식 잔액을 바꾸지 않고 패키지 효과만 바꿈', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_ADMOB_TESTING', 'true');
  const s = newSave(); s.stamina.n = 123;
  s.settings.devNoAds = true; expect([adsFree(s), staminaMax(s)]).toEqual([true, 150]);
  s.settings.devNoAds = false; expect([adsFree(s), staminaMax(s)]).toEqual([false, 100]);
  expect(s.bought).toEqual([]); expect(s.stamina.n).toBe(123);
});
it('구매자도 OFF 시험 가능하며 실제 구매 상태로 돌아가면 원래 혜택 복원', () => {
  vi.stubEnv('DEV', true);
  const s = newSave(); s.bought.push('noads'); s.settings.devNoAds = false;
  expect(adsFree(s)).toBe(false); expect(s.bought).toEqual(['noads']);
  delete s.settings.devNoAds; expect([adsFree(s), staminaMax(s)]).toEqual([true, 150]);
});
it('출시 광고 빌드는 저장된 시험 ON/OFF를 무시하고 실제 구매 기록만 사용', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_ADMOB_TESTING', 'false'); vi.stubGlobal('navigator', { webdriver: false });
  const s = newSave(); s.settings.devNoAds = true;
  expect(adPackageTestAvailable()).toBe(false); expect([adsFree(s), staminaMax(s)]).toEqual([false, 100]);
  s.bought.push('noads'); s.settings.devNoAds = false; expect([adsFree(s), staminaMax(s)]).toEqual([true, 150]);
});
it('자동 화면 검사는 출시용 웹 번들에서도 시험 조작 가능', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_ADMOB_TESTING', 'false'); vi.stubGlobal('navigator', { webdriver: true });
  const s = newSave(); s.settings.devNoAds = true; expect(adsFree(s)).toBe(true);
});
