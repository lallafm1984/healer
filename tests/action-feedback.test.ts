import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { actionReason } from '../src/battle/action-feedback';
import { setLang } from '../src/i18n';

const literals = [...new Set(['healer', 'talents', 'auto'].flatMap(name =>
  [...readFileSync(new URL(`../src/engine/${name}.ts`, import.meta.url), 'utf8').matchAll(/reason:\s*'([^']+)'/g)].map(m => m[1])))];
const dynamic = ['신성한 힘 부족 (1/3)', '방패든양은(는) 쓰러짐', '닿지 않음: 방패든양은(는) 하늘에 떠 있음',
  '나: 정화로 못 지움', '나: 단일 힐만 들어감', '치유: Lv 20에 배움', '치유 재사용 대기 12초',
  '치유 잠김 5초 (진동)', '평온: 고르지 않은 특성', '평온: 전투당 1회', '평온 효과 중', '정화로 지울 디버프 없음'];

afterEach(() => setLang('ko'));
describe('스킬·특성 실패 사유 표시', () => {
  it('한국어 원문은 그대로 유지한다', () => {
    for (const text of [...literals, ...dynamic]) expect(actionReason(text)).toBe(text);
  });
  it.each(['en', 'ja'] as const)('%s: 엔진의 모든 고정 문구와 이름·숫자 문장에 한국어가 남지 않는다', async lang => {
    await setLang(lang);
    for (const text of [...literals, ...dynamic]) expect(actionReason(text), text).not.toMatch(/[가-힣]/);
    expect(actionReason('신성한 힘 부족 (1/3)')).toContain('1/3');
    expect(actionReason('치유 재사용 대기 12초')).toContain('12');
    expect(actionReason('쓰러진 파티원 없음')).toBe(lang === 'en' ? 'No fallen party members' : '倒れたパーティメンバーなし');
  });
  it('모든 실패 알림 경로가 표시 변환을 사용한다', () => {
    const source = readFileSync(new URL('../src/battle/index.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/toast\((?:res|r)\.reason\)/);
  });
});
