import { describe, expect, it } from 'vitest';
import { battleConfirmation } from '../src/battle/dialogs';

describe('전투 중단 확인 문구', () => {
  it('재시작이 현재 구간만이 아니라 전체 도전을 초기화함을 설명한다', () => {
    const text = battleConfirmation('restart', 2);
    expect(text.message).toContain('모든 구간 진행과 전투 기록을 초기화');
    expect(text.message).toContain('첫 구간부터');
    expect(text.action).toBe('전체 구간 다시 시작');
  });
  it('나가기와 실패 정산을 구분하면서 사용한 아이템을 숨기지 않는다', () => {
    const quit = battleConfirmation('quit', 3), giveUp = battleConfirmation('giveUp', 3);
    expect(quit.message).toContain('보상 없이');
    expect(quit.message).toContain('소비 아이템 3개');
    expect(giveUp.message).toContain('전멸과 같은 실패');
    expect(giveUp.message).toContain('소비 아이템 3개');
    expect(quit.action).not.toBe(giveUp.action);
  });
  it('사용 이력이 없으면 미사용 상태를 명확히 표시한다', () => {
    expect(battleConfirmation('quit', 0).message).toContain('사용한 소비 아이템은 없습니다');
    expect(battleConfirmation('giveUp', -1).message).not.toContain('-1');
  });
});
