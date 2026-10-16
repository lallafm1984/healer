import { describe, expect, it } from 'vitest';
import { battleConfirmation } from '../src/battle/dialogs';

describe('전투 중단 확인 문구', () => {
  it('재시작이 현재 구간만이 아니라 전체 도전을 초기화함을 설명한다', () => {
    const text = battleConfirmation('restart');
    expect(text.message).toContain('모든 구간 진행과 전투 기록을 초기화');
    expect(text.message).toContain('첫 구간부터');
    expect(text.action).toBe('전체 구간 다시 시작');
  });
  it('나가기와 실패 정산을 구분한다 (소비 아이템 안내는 2026-10-16 소비 아이템과 함께 없앰)', () => {
    const quit = battleConfirmation('quit'), giveUp = battleConfirmation('giveUp');
    expect(quit.message).toContain('보상 없이');
    expect(giveUp.message).toContain('전멸과 같은 실패');
    expect(`${quit.message}${giveUp.message}${giveUp.detail ?? ''}`).not.toContain('아이템');
    expect(quit.action).not.toBe(giveUp.action);
  });
});
