/** 해제 시작 레벨 (2026-10-18 해금 레벨 검토): 해제 스킬 Lv 7, 「해제 성공」 임무는 그 직업이 지울 디버프가 처음 나오는 레벨 (missions DEBUFF_FROM) */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/data/content';
import { ALL_HERO_KEYS, HEROES } from '../src/data/heroes';
import { dispelFrom } from '../src/data/missions';
import { SKILL_LEVEL } from '../src/data/skills';
import { balanceable, runOnce } from '../src/sim/balance';

describe('해제 시작 레벨', () => {
  it('일곱 직업 해제 스킬은 Lv 7 (Lv 1~6 장소엔 지울 디버프가 없음)', () => {
    for (const h of ALL_HERO_KEYS) expect(SKILL_LEVEL[HEROES[h].slots.dispel!], h).toBe(7);
  });
  it('「해제 성공」: 사제 · 수도사 · 성기사 7 (질병), 드루이드 · 점성술사 13 (독), 주술사 · 결계사 22 (마법 · 저주)', () => {
    expect(Object.fromEntries(ALL_HERO_KEYS.map(h => [h, dispelFrom(h)]))).toEqual({ priest: 7, druid: 13, paladin: 7, shaman: 22, monk: 7, astrologer: 13, warder: 22 });
  });
  // 그 종류가 시작 레벨을 정하는 직업 하나씩: 사제 = 질병, 점성술사 = 독, 결계사 = 마법 · 저주.
  // heroUp으로 해제 스킬을 미리 배워 두고 셈 (그 아래 장소의 같은 종류는 잠김 · 덫뿐이라 0)
  it.each([['priest', 7], ['astrologer', 13], ['warder', 22]] as const)('%s: Lv %i 장소에서 처음 지움, 그 아래 장소는 0 (자동 힐러, 보통 · 악몽)', (h, lv) => {
    const at: Record<number, number> = {};
    for (const c of CONTENT.filter(c => balanceable(c) && c.kind !== 'raid' && c.stageLv <= lv)) {
      for (const d of ['보통', '악몽'] as const) runOnce(c, d, h, 1, undefined, 'common', { heroUp: 7, onFight: f => { at[c.stageLv] = (at[c.stageLv] ?? 0) + f.stats.dispels; } });
    }
    for (const [stage, n] of Object.entries(at)) if (Number(stage) < lv) expect(n, `Lv ${stage}`).toBe(0);
    expect(at[lv]).toBeGreaterThan(0);
  }, 60_000);
});
