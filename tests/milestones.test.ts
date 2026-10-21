import { describe, expect, it } from 'vitest';
import { levelUpMilestones, nextMilestone } from '../src/data/milestones';
import type { HeroKey } from '../src/data/heroes';

describe('현재 직업의 레벨업 안내', () => {
  it.each<[HeroKey, string]>([
    ['priest', '빛의 전이'], ['druid', '환생'], ['paladin', '보호의 손'],
  ])('%s: Lv 14 → 16에서 해당 직업의 고유 스킬과 공통 기능만 표시', (hero, skill) => {
    const items = levelUpMilestones([15, 16], hero);
    expect(items.filter(m => m.text.startsWith('스킬')).map(m => m.text)).toEqual([`스킬 「${skill}」`]);
    expect(items.map(m => m.text)).toEqual(expect.arrayContaining([
      '탐험 「늪지 어귀」', '특성 3단',
    ]));
    expect(items.some(m => /소비 아이템 단축칸/.test(m.text))).toBe(false);
    expect(items.find(m => m.text === `스킬 「${skill}」`)?.lv).toBe(15);
    expect(items.some(m => /8번째 칸|드루이드·성기사/.test(m.text))).toBe(false);
  });

  it.each<[HeroKey, string, string, string[]]>([
    ['priest', '빛의 은총', '평온 게이지', ['천상의 찬가']],
    ['druid', '뿌리 깊음', '군락', ['고요한 숲']],
    ['paladin', '굳건한 손', '봉화', ['봉화', '빛의 성역']], // 2026-10-16: 봉화 스킬 (빠른 힐 칸, Lv 6)
  ])('%s: 패시브 · 고유 시스템 · 공대 스킬도 직업에 맞게 안내', (hero, passive, system, skills) => {
    const text = levelUpMilestones([4, 6, 12], hero).map(m => m.text);
    expect(text).toContain(`패시브 「${passive}」`);
    expect(text).toContain(system);
    expect(text.filter(t => t.startsWith('스킬'))).toEqual(skills.map(s => `스킬 「${s}」`));
    expect(text.filter(t => t.startsWith('패시브'))).toEqual([`패시브 「${passive}」`]);
  });

  it.each<[HeroKey, RegExp]>([
    ['priest', /드루이드|성기사|환생|보호의 손|뿌리 깊음|굳건한 손|군락|봉화/],
    ['druid', /사제|성기사|빛의 전이|보호의 손|빛의 은총|굳건한 손|성언|봉화/],
    ['paladin', /사제|드루이드|빛의 전이|환생|빛의 은총|뿌리 깊음|성언|군락/],
  ])('%s: 여러 레벨을 올려도 다른 직업이나 미구현 항목을 섞지 않음', (hero, otherJobs) => {
    const items = levelUpMilestones(Array.from({ length: 99 }, (_, i) => i + 2), hero);
    expect(items.every(m => m.live && !otherJobs.test(m.text))).toBe(true);
    expect(items.map(m => m.text)).toContain('주간 도전 「모래시계 시련」');
    expect(items.map(m => m.text)).not.toContain('공개모집 직업 +6종');
  });

  it('장비 재설정 안내는 없음 (2026-10-21 Lim 「아이템의 능력치 재설정 기능제거」), 해제는 Lv 7 (2026-10-18 해금 레벨 검토)', () => {
    const at = (lv: number) => levelUpMilestones([lv], 'priest').map(m => m.text);
    for (const lv of [20, 50, 60]) expect(at(lv).some(t => /재설정/.test(t))).toBe(false);
    expect(at(7)).toContain('스킬 「정화」');
    expect(at(3)).not.toContain('스킬 「정화」');
  });

  it('로비 다음 목표도 현재 직업 기준이며 최대 레벨 뒤에는 없음', () => {
    expect(nextMilestone(1, 'druid')).toEqual({ level: 2, items: [{ text: '스킬 「피워 내기」', live: true }] });
    expect(nextMilestone(100, 'priest')).toBeNull();
    expect(levelUpMilestones([], 'priest')).toEqual([]);
  });
});
