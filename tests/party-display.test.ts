import { describe, expect, it } from 'vitest';
import { cellTypography, debuffDisplay, fitPartyName, guardTimersOf, hotTimersOf, hpLabelText, primaryDebuff, sealTimerOf, shieldTimerOf, starMarkTimerOf, talentBuffTimers, talentObjectTimers } from '../src/battle/party-display';
import type { Debuff, Hot, Mod, Unit } from '../src/engine/types';

const debuff = (extra: Partial<Debuff> = {}): Debuff => ({ id: 1, name: '부패', type: '질병', left: 4.1, ...extra });
const hot = (key: Hot['key'], left: number): Hot => ({ key, left, name: key, every: 2, tick: 2, per: 10, i: 0, rest: 30 });

describe('모든 직업의 지속 치유 시간', () => {
  it('사제 소생·드루이드 지속 치유·성기사 서약을 각각 표시한다', () => {
    const timers = hotTimersOf({ hot: 6, hots: [hot('oath', 9), hot('wildflower', 4), hot('growth', 7), hot('sprout', 12)] });
    expect(timers.map(h => [h.key, h.left])).toEqual([
      ['renew', 6], ['sprout', 12], ['growth', 7], ['wildflower', 4], ['oath', 9],
    ]);
  });
  it('효과 갱신으로 입력 순서와 남은 시간이 바뀌어도 표시 순서를 유지한다', () => {
    const hots = [hot('wildflower', 20), hot('sprout', 3), hot('growth', 10)];
    const before = hots.slice();
    const keys = (hs: Hot[]) => hotTimersOf({ hot: 0, hots: hs }).map(h => h.key);
    expect(keys(hots)).toEqual(keys([hot('growth', 1), hot('sprout', 14), hot('wildflower', 2)]));
    expect(hots).toEqual(before);
  });
  it('만료된 효과만 제거하고 남아 있는 효과의 시간을 보존한다', () => {
    expect(hotTimersOf({ hot: 0, hots: [hot('sprout', 0), hot('growth', -1), hot('oath', 0.2)] })
      .map(h => [h.key, h.left])).toEqual([['oath', 0.2]]);
    expect(hotTimersOf({ hot: -1, hots: [] })).toEqual([]);
  });
});

describe('모든 직업의 보호막 시간', () => {
  const ab = (src: string, v: number, until: number): Mod => ({ k: 'absorb', v, until, src });
  it('내가 건 힐러 보호막 시간을 먼저, 남은 흡수량은 모두 더함', () => {
    expect(shieldTimerOf({ mods: [ab('bubble', 50, 18), ab('healer', 120, 13)] }, 10)).toEqual({ left: 3, amt: 170 });
  });
  it('힐러 보호막이 없으면 가장 오래 남은 것, 끝났거나 다 깎인 막 · 다른 효과는 빼고 없으면 null', () => {
    expect(shieldTimerOf({ mods: [ab('iceBarrier', 40, 14), ab('bubble', 30, 16)] }, 10)).toEqual({ left: 6, amt: 70 });
    expect(shieldTimerOf({ mods: [ab('healer', 0, 20), ab('healer', 50, 9), { k: 'cut', v: 0.3, until: 20, src: 'x' }] }, 10)).toBeNull();
  });
});

describe('모든 직업의 방어 생존기 시간 (2026-10-18 Lim)', () => {
  const none = { guardian: 0, redu: 0, immune: 0, sacr: 0 };
  it('수호 영혼 · 나무껍질 · 누그러뜨림 · 보호의 손 · 희생 · 별의 잠을 각각 남은 초로', () => {
    expect(guardTimersOf({ ...none, guardian: 7.2 }, 0, 'priest')).toEqual([{ key: 'guardian', left: 7.2 }]);
    expect(guardTimersOf({ ...none, redu: 11 }, 0, 'druid')).toEqual([{ key: 'bark', left: 11 }]);
    expect(guardTimersOf({ ...none, redu: 5 }, 0, 'monk')).toEqual([{ key: 'soothe', left: 5 }]);
    expect(guardTimersOf({ ...none, sleep: 14 }, 10, 'astrologer')).toEqual([{ key: 'sleep', left: 4 }]);
  });
  it('여러 개면 고정 순서 (남은 시간으로 바꾸지 않음), 끝난 것은 뺌', () => {
    expect(guardTimersOf({ ...none, sacr: 3, immune: 9 }, 0, 'paladin').map(g => g.key)).toEqual(['immune', 'sacrifice']);
    expect(guardTimersOf({ ...none, sacr: 9, immune: 3 }, 0, 'paladin').map(g => g.key)).toEqual(['immune', 'sacrifice']);
    expect(guardTimersOf({ ...none, sacr: -0.01, immune: 0, sleep: 9 }, 10, 'astrologer')).toEqual([]);
  });
  it('성기사 성역 (서 있는 동안 틱마다 다시 참)은 시간 원 없음: 바닥 그림이 보여 줌', () => {
    expect(guardTimersOf({ ...none, redu: 0.1 }, 0, 'paladin')).toEqual([]);
  });
});

describe('전투 칸 글자 크기', () => {
  it('모든 판이 5인 칸 모양 (작은 레이드 칸 없음): 체력 14px 이상 · 칸 크기 0.28배', () => {
    for (const scale of [20, 36, 51.8, 59.3]) {
      const fonts = cellTypography(scale);
      expect(fonts).not.toHaveProperty('compact');
      expect(fonts.hp).toBeCloseTo(Math.max(14, scale * 0.28), 5);
    }
  });
  it('이름 글자는 칸이 작을수록 작고, 큰 칸은 예전 크기 (0.24배, 11px 이상)', () => {
    const scales = [20, 29, 32.3, 34.5, 36.4, 38.4, 43.1, 51.8, 59.3, 77.7];
    const nicks = scales.map(scale => cellTypography(scale).nick);
    nicks.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(nicks[i]));
    expect(cellTypography(29).nick).toBeCloseTo(9, 5);
    expect(cellTypography(51.8).nick).toBeCloseTo(51.8 * 0.24, 5);
    expect(cellTypography(43.1).nick).toBe(11);
  });
  it('레이드 칸도 3 · 5인과 같은 체력 숫자 (% 없음), 살아 있는 극소 체력은 1, 영원한 저녁은 ?', () => {
    expect(hpLabelText(6398.2)).toBe('6399');
    expect(hpLabelText(0.01)).toBe('1');
    expect(hpLabelText(0)).toBe('0');
    expect(hpLabelText(500, true)).toBe('?');
    expect(hpLabelText(1234.5)).not.toMatch(/%/);
  });
  it('보호막이 있으면 체력 + 남은 흡수량 합을 합친 숫자 하나 (「+N」 따로 없음, 2026-10-19 Lim 「합산해서 파란색으로」), 영원한 저녁은 ?', () => {
    expect(hpLabelText(6398.2, false, 319.2)).toBe('6718');
    expect(hpLabelText(1000, false, 0)).toBe('1000');
    expect(hpLabelText(1000, false, null)).toBe('1000');
    expect(hpLabelText(0, false, 120)).toBe('120');
    expect(hpLabelText(500, true, 300)).toBe('?');
    expect(hpLabelText(1000, false, 5000)).not.toMatch(/\+/);
    const u = { mods: [{ k: 'absorb', v: 200.4, until: 9, src: 'healer' }, { k: 'absorb', v: 100, until: 5, src: 'gear' }, { k: 'absorb', v: 50, until: 1, src: 'gear' }] as unknown as Mod[] };
    expect(hpLabelText(1000, false, shieldTimerOf(u, 2)?.amt)).toBe('1301');
  });
  it('결계사 인장은 그림 대신 왼쪽 열 원 + 남은 초 (2026-10-19 Lim 「보호막 유지 시간처럼 단순하게」), 결계사 전투에서 붙어 있을 때만', () => {
    expect(sealTimerOf({ seal: 18 }, 10, 'warder')).toBe(8);
    expect(sealTimerOf({ seal: 9.9 }, 10, 'warder')).toBeNull();
    expect(sealTimerOf({}, 10, 'warder')).toBeNull();
    expect(sealTimerOf({ seal: 18 }, 10, 'priest')).toBeNull();
  });
  it('점성술사 별자리 표식은 오른쪽 지속 힐 원이 아니라 왼쪽 열 원 + 남은 초 (2026-10-19 Lim 「표식 스킬도 보호막처럼 지속시간을 숫자로」)', () => {
    const u = { hot: 0, hots: [{ key: 'starMark', left: 7.5 }, { key: 'droplet', left: 3 }] } as unknown as Unit;
    expect(starMarkTimerOf(u, 'astrologer')).toBe(7.5);
    expect(starMarkTimerOf(u, 'priest')).toBeNull();
    expect(hotTimersOf(u).map(h => h.key)).toEqual(['droplet']);
  });
  it('특성 버튼 지속 효과: 켜진 자기 강화 특성만 내 칸 원, 칸 특성은 그 칸 물건 남은 시간 (2026-10-19 Lim 「지속시간 표시도 필요」)', () => {
    expect(talentBuffTimers({ zenith: { left: 12.4 }, scatter: { left: 0 }, shelter: { left: 9 }, miracle: { left: 0 } } as never)).toEqual([{ key: 'zenith', left: 12.4 }]);
    expect(talentObjectTimers(4, 9, [{ kind: 'sea', cell: 7, until: 15 }, { kind: 'spring', cell: 2, until: 30 }, { kind: 'citadel', cell: 3, until: 9 }], 10))
      .toEqual([{ cell: 4, key: 'shelter', left: 9 }, { cell: 7, key: 'sea', left: 5 }]);
    expect(talentObjectTimers(-1, 0, [], 0)).toEqual([]);
  });
  it('닉네임을 축소하지 않고 유니코드 문자를 보존해 말줄임한다', () => {
    const measure = (text: string) => Array.from(text).length * 11;
    expect(fitPartyName('민아', 33, measure)).toBe('민아');
    expect(fitPartyName('별빛치유사', 33, measure)).toBe('별빛…');
    expect(fitPartyName('🌿치유사', 22, measure)).toBe('🌿…');
    expect(fitPartyName('별빛', 11, measure)).toBe('…');
  });
});

describe('디버프 요약', () => {
  it('종류와 올림한 잔여 초를 함께 표시한다', () => {
    expect(debuffDisplay(debuff(), 'priest', true).text).toBe('질5');
    expect(debuffDisplay(debuff({ left: -0.1 }), 'priest').seconds).toBe(0);
  });
  it('해제 불가·함정도 배지에 기호 없이 표시하고 상세 안내는 유지한다', () => {
    const poison = debuff({ type: '독' });
    expect(debuffDisplay(poison, 'priest', true)).toMatchObject({ text: '독5', state: 'unavailable' });
    expect(debuffDisplay(poison, 'druid', true)).toMatchObject({ text: '독5', state: 'available' });
    expect(debuffDisplay(debuff({ trap: true }), 'priest', true)).toMatchObject({ text: '질5', state: 'dangerous' });
    expect(debuffDisplay(debuff({ trap: true }), 'priest').detail).toContain('해제 시 전염 폭발');
  });
  it('중첩과 원래 이름은 상세 요약에 보존한다', () => {
    expect(debuffDisplay(debuff({ name: '썩은 숨결', stack: 3 }), 'priest').detail).toBe('썩은 숨결 · 질병 · 5초, 3중첩 · 해제 가능');
  });
  it('표시할 대표 디버프를 고르면서 입력 순서나 내용을 바꾸지 않는다', () => {
    const poison = debuff({ id: 2, type: '독' }), disease = debuff(), trap = debuff({ id: 3, trap: true });
    const all = [poison, disease, trap];
    expect(primaryDebuff(all)).toBe(trap);
    expect(primaryDebuff([poison, disease])).toBe(disease);
    expect(primaryDebuff([])).toBeUndefined();
    expect(all).toEqual([poison, disease, trap]);
  });
});
