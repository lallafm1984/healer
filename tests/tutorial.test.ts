/** 첫 5분 튜토리얼 (02 11장, 09 4장): 2인 첫 전투, 3인 탐험 「녹슨 고원」, 단계 저장 */
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/data/classes';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import * as E from '../src/engine';
import { advanceTutorial, DUO_PARTY, TUT } from '../src/game/tutorial';
import { migrate, newSave } from '../src/platform/storage';

describe('2인 첫 전투', () => {
  it('탱커 1 + 나, 2인 판', () => {
    const f = E.create({ encounter: 'duo', diff: '쉬움', seed: 1, level: 1, party: DUO_PARTY });
    expect(f.party.map(u => u.role).sort()).toEqual(['healer', 'tank']);
    expect(f.cells.length).toBe(7);
    expect(f.party.find(u => u.role === 'tank')!.cls).toBe('warrior');
  });

  it('Lv 1 자동 힐러면 이기고, 힐을 안 하면 탱커가 쓰러짐', () => {
    for (let s = 1; s <= 20; s++) {
      const win = E.simulate({ encounter: 'duo', diff: '쉬움', seed: s, level: 1, party: DUO_PARTY });
      expect(win.over).toBe('win');
      expect(win.t).toBeGreaterThan(15);
      expect(win.t).toBeLessThan(60);
    }
    const f = E.create({ encounter: 'duo', diff: '쉬움', seed: 1, level: 1, party: DUO_PARTY });
    while (!f.over && f.t < 120) { E.step(f); f.events.length = 0; }
    expect(f.over).toBe('lose');
  });
});

describe('3인 탐험 「녹슨 고원」', () => {
  it('탱커 1 + 원거리 1 + 나, 공개모집 직업도 붙음', () => {
    for (let s = 1; s <= 30; s++) {
      const p = E.recruitParty('field', s);
      expect(p.map(m => m.role).sort()).toEqual(['ranged', 'tank']);
      for (const m of p) expect(CLASSES[m.cls!].role).toBe(m.role);
    }
    expect(contentOf('plateau').size('쉬움')).toBe(3);
    expect(contentOf('plateau').fights('쉬움')).toEqual(['field', 'patrol']);
    expect(ENCOUNTERS.patrol.board).toBe('b7');
  });

  it('Lv 2 자동 힐러, 쉬움이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 30; s++) {
      const r = E.simulateDungeon({ dungeon: 'plateau', diff: '쉬움', seed: s, level: 2, gear: 'none' });
      if (r.win) wins++;
      expect(r.time).toBeLessThan(240);
    }
    expect(wins).toBeGreaterThanOrEqual(28);
  });

  it('탐험은 콘텐츠 목록에 보이고, 첫 전투는 숨김', () => {
    expect(contentOf('plateau').hidden).toBeFalsy();
    expect(contentOf('tutorial').hidden).toBe(true);
  });
});

describe('튜토리얼 단계', () => {
  it('탐험 클리어 → 던전 안내 → 녹슨 요새 클리어 → 끝 (지면 그대로)', () => {
    const s = newSave(1);
    expect(s.tut).toBe(TUT.intro);
    s.tut = TUT.explore;
    advanceTutorial(s, 'plateau', false); expect(s.tut).toBe(TUT.explore);
    advanceTutorial(s, 'rustfort', true); expect(s.tut).toBe(TUT.explore);
    advanceTutorial(s, 'plateau', true); expect(s.tut).toBe(TUT.dungeon);
    advanceTutorial(s, 'plateau', true); expect(s.tut).toBe(TUT.dungeon);
    advanceTutorial(s, 'rustfort', true); expect(s.tut).toBe(TUT.done);
  });

  it('튜토리얼 전 저장: 이미 레벨이 올랐거나 깬 던전이 있으면 건너뜀', () => {
    expect(migrate({ v: 2, createdAt: 1, player: { level: 1, xp: 0, gold: 0 } }).tut).toBe(TUT.intro);
    expect(migrate({ v: 2, createdAt: 1, player: { level: 3, xp: 0, gold: 0 } }).tut).toBe(TUT.done);
    expect(migrate({ v: 2, createdAt: 1, player: { level: 1, xp: 0, gold: 0 }, clears: { rustfort: { 보통: { n: 1 } } } }).tut).toBe(TUT.done);
    expect(migrate({ ...newSave(1), tut: TUT.explore }).tut).toBe(TUT.explore);
  });
});
