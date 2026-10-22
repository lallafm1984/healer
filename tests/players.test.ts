/** 가상 사용자 QA (sim/players · players-signals), 2026-10-22 Lim 「처음 사용자 및 신규 사용자 입장에서의 시뮬레이션 qa 테스터」 */
import { describe, expect, it } from 'vitest';
import { handLevel, livePlayer, PLAYER_TYPES, playerType, type PlayerLog, type RunLog } from '../src/sim/players';
import { findSignals } from '../src/sim/players-signals';

describe('가상 사용자', () => {
  it('타입 여섯, 손 곡선은 기본 사람 (10 · 20 · 60) 위에 옮김', () => {
    expect(PLAYER_TYPES.map(t => t.key)).toEqual(['casual', 'normal', 'hardcore', 'greedy', 'lazy', 'switcher']);
    const normal = playerType('normal')!, casual = playerType('casual')!;
    for (const lv of [1, 10, 15, 20, 40, 60, 80]) expect(handLevel(normal, lv)).toBeCloseTo(lv);
    expect(handLevel(casual, 20)).toBeCloseTo(10); // 느린 사람은 Lv 20에야 「처음 하는 사람」이 끝남
    expect(handLevel(casual, 30)).toBeCloseTo(20);
  });

  it('새 저장 → 튜토리얼 두 판 → 길잡이 칸, 판 · 날 기록', { timeout: 60_000 }, () => {
    const log = livePlayer(playerType('normal')!, 1, { maxLv: 5 });
    expect(log.runs[0].content).toBe('tutorial');
    expect(log.runs.find(r => r.why === 'tut' && r.content === 'plateau' && r.win)).toBeTruthy();
    expect(log.runs.some(r => r.why === 'guide')).toBe(true);
    expect(log.days.at(-1)!.lv).toBeGreaterThanOrEqual(5);
    expect(log.levelDay[5]).toBeGreaterThanOrEqual(1);
    expect(log.done).toBe(log.levelDay[5]);
    // 정산이 실제로 돌아감: 경험치 · 골드 · 휴식
    expect(log.runs.filter(r => r.win && r.why === 'guide').every(r => r.xp > 0)).toBe(true);
    expect(log.days[0].goldIn).toBeGreaterThan(0);
    expect(log.runs.some(r => r.share === 1)).toBe(true);
  });
});

describe('이상 신호', () => {
  const run = (o: Partial<RunLog>): RunLog => ({
    day: 1, ses: 0, lv: 30, hero: 'priest', content: 'dawn' as RunLog['content'], name: '새벽 길', kind: '탐험', diff: '어려움', stage: 32, fit: '적정', first: true, why: 'guide',
    win: true, reason: '', seg: 0, segs: 2, time: 200, deaths: 0, busy: 25, apm: 20, gear: 3, rec: 2.5, empty: 0, rest: 50, share: 1, xp: 100, gold: 10, item: null, goldAfter: 100, guild: false,
    hand: { react: 0.2, pick: 0.06, queue: true, tactics: true }, ...o,
  });
  const log = (runs: RunLog[]): PlayerLog => ({ type: 'normal', seed: 1, runs, days: [], flows: [], levelDay: { 1: 1 }, opens: {}, done: null, totalRuns: runs.length });

  it('같은 칸을 세 번 연달아 지면 막힘, 적정 칸을 절반도 못 깨면 길잡이 어긋남', () => {
    const lose = run({ win: false, reason: '파티 전멸' });
    const s = findSignals(log([lose, lose, lose, run({ first: false })]));
    expect(s.find(x => x.kind === 'stuck')?.runs).toEqual([0, 1, 2]);
    expect(s.find(x => x.kind === 'guideMiss')?.key).toBe('새벽 길 어려움');
    expect(findSignals(log([lose, lose, run({}), lose])).some(x => x.kind === 'stuck')).toBe(false);
  });

  it('한가한 이긴 판이 길게 이어지면 너무 쉬움, 권장 장비 밑이 길면 장비', () => {
    const easy = Array.from({ length: 30 }, () => run({ busy: 8 }));
    expect(findSignals(log(easy)).some(x => x.kind === 'easy')).toBe(true);
    expect(findSignals(log(Array.from({ length: 30 }, () => run({ busy: 30 })))).some(x => x.kind === 'easy')).toBe(false);
    const low = Array.from({ length: 25 }, () => run({ gear: 2, rec: 2.5 }));
    expect(findSignals(log(low)).some(x => x.kind === 'gear')).toBe(true);
  });
});
