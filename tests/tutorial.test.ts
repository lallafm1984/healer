/** 첫 5분 튜토리얼 (02 11장, 09 4장): 2인 첫 전투, 3인 탐험 「녹슨 고원」, 단계 저장 */
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/data/classes';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import * as E from '../src/engine';
import { damage, dripDamage, heal } from '../src/engine/core';
import { advanceTutorial, DUO_PARTY, firstDungeonDue, TUT, tutLockedContent, tutReplay } from '../src/game/tutorial';
import { settle } from '../src/game/settle';
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

describe('튜토리얼 체력 보호', () => {
  it.each(['duo', 'field', 'patrol'] as const)('%s: 큰 한 방·광역·지속 피해에도 체력 1을 유지하고 다시 치유할 수 있음', encounter => {
    const f = E.create({ encounter, diff: '쉬움', seed: 1, level: encounter === 'duo' ? 1 : 2,
      party: encounter === 'duo' ? DUO_PARTY : E.recruitParty('field', 1), tutorial: true });
    for (const u of f.party) {
      u.hp = 8; u.guardian = 5;
      damage(f, u, 1e6, true, 'fixed');
      expect([u.hp, u.alive, u.guardian]).toEqual([1, true, 5]);
      dripDamage(f, u, 1e6, true, 'fixed');
      expect([u.hp, u.alive]).toEqual([1, true]);
      expect(f.cells[u.cell].unit).toBe(u);
      heal(f, u, 20, true, true);
      expect(u.hp).toBeGreaterThan(1);
    }
    expect(f.stats.deaths).toBe(0);
    expect(f.events.some(e => e.type === 'death')).toBe(false);
  });

  it('치유하지 않아도 2인 첫 전투에서 패배하지 않음', () => {
    const f = E.create({ encounter: 'duo', diff: '쉬움', seed: 1, level: 1, party: DUO_PARTY, tutorial: true });
    while (!f.over && f.t < 120) { E.step(f); f.events.length = 0; }
    expect(f.over).toBe('win');
    expect(f.party.every(u => u.alive && u.hp >= 1)).toBe(true);
    expect(f.stats.deaths).toBe(0);
  });

  it('튜토리얼 보호가 없는 일반 전투는 치명적인 피해로 쓰러짐', () => {
    const f = E.create({ encounter: 'field', diff: '쉬움', seed: 1, level: 2 });
    const tank = f.party.find(u => u.role === 'tank')!;
    damage(f, tank, 1e6, true, 'fixed');
    expect([tank.hp, tank.alive, f.stats.deaths]).toEqual([0, false, 1]);
  });
});

describe('3인 탐험 「녹슨 고원」', () => {
  it('탱커 1 + 근접 또는 원거리 1 (무작위, 76) + 나, 공개모집 직업도 붙음', () => {
    const second = new Set<string>();
    for (let s = 1; s <= 30; s++) {
      const p = E.recruitParty('field', s);
      expect(p[0].role).toBe('tank');
      expect(p.length).toBe(2);
      second.add(p[1].role);
      for (const m of p) expect(CLASSES[m.cls!].role).toBe(m.role);
    }
    expect([...second].sort()).toEqual(['melee', 'ranged']);
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
  it('녹슨 고원 클리어 → 끝 (지면 · 다른 곳은 그대로), 끝난 판만 true', () => {
    const s = newSave(1);
    expect(s.tut).toBe(TUT.intro);
    s.tut = TUT.explore;
    expect(advanceTutorial(s, 'plateau', false)).toBe(false); expect(s.tut).toBe(TUT.explore);
    expect(advanceTutorial(s, 'rustfort', true)).toBe(false); expect(s.tut).toBe(TUT.explore);
    expect(advanceTutorial(s, 'plateau', true)).toBe(true); expect(s.tut).toBe(TUT.done);
    expect(advanceTutorial(s, 'plateau', true)).toBe(false); expect(s.tut).toBe(TUT.done);
  });

  it('첫 던전 안내: 튜토리얼 뒤 · 녹슨 요새가 열림 · 아직 못 깸', () => {
    const s = newSave(1);
    expect(firstDungeonDue(s, true)).toBe(false);
    s.tut = TUT.done;
    expect(firstDungeonDue(s, false)).toBe(false);
    expect(firstDungeonDue(s, true)).toBe(true);
    s.clears.rustfort = { 쉬움: { n: 1 } } as typeof s.clears.rustfort;
    expect(firstDungeonDue(s, true)).toBe(false);
  });

  it('튜토리얼 전 저장: 이미 레벨이 올랐거나 깬 던전이 있으면 건너뜀', () => {
    expect(migrate({ v: 2, createdAt: 1, player: { level: 1, xp: 0, gold: 0 } }).tut).toBe(TUT.intro);
    expect(migrate({ v: 2, createdAt: 1, player: { level: 3, xp: 0, gold: 0 } }).tut).toBe(TUT.done);
    expect(migrate({ v: 2, createdAt: 1, player: { level: 1, xp: 0, gold: 0 }, clears: { rustfort: { 보통: { n: 1 } } } }).tut).toBe(TUT.done);
    expect(migrate({ ...newSave(1), tut: TUT.explore }).tut).toBe(TUT.explore);
    // 예전 「녹슨 요새 첫 클리어」 단계(2)는 끝으로
    expect(migrate({ ...newSave(1), tut: 2 }).tut).toBe(TUT.done);
  });
});

describe('튜토리얼 판만 튜토리얼 보상 (103 다른 문제점 2)', () => {
  it('튜토리얼 중 (다시 보기 포함)에는 첫 전투 · 녹슨 고원만 출전, 다른 판은 보통 판으로 정산 (휴식을 씀)', () => {
    const s = newSave(1); s.player.level = 60; s.tut = TUT.intro;
    expect(tutLockedContent(s, 'rustfort')).toBe(true);
    expect(tutLockedContent(s, 'abyss1')).toBe(true);
    expect([tutLockedContent(s, 'tutorial'), tutLockedContent(s, 'plateau')]).toEqual([false, false]);
    s.tut = TUT.done;
    expect(tutLockedContent(s, 'rustfort')).toBe(false);
    s.tut = TUT.intro;
    const n0 = s.stamina.n;
    const x = settle(s, { content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 300, restSec: 0, deaths: 0, healed: 5000, overheal: 500, dispels: 0, dispellable: 0, endMana: 30, minMana: 10, auto: false, party: [], detail: [] }, () => 0.5);
    expect(x.rest).not.toBeNull();
    expect(s.stamina.n).toBeLessThan(n0);
  });
});

describe('튜토리얼 다시 보기 (105 QA)', () => {
  it('이미 녹슨 고원을 깬 저장의 다시 보기 판은 경험치 · 골드 없음, 처음 하는 판은 그대로', () => {
    const run = (s: ReturnType<typeof newSave>) => settle(s, { content: 'plateau', diff: '쉬움', win: true, quit: false, reason: '', segIdx: 1, segN: 2, time: 120, restSec: 0, deaths: 0, healed: 3000, overheal: 300, dispels: 0, dispellable: 0, endMana: 40, minMana: 20, auto: false, party: [], detail: [] }, () => 0.5);
    const first = newSave(1); first.tut = TUT.explore;
    const a = run(first);
    expect(a.xp).toBeGreaterThan(0); expect(a.tutReplay).toBe(false);
    const again = newSave(1); again.tut = TUT.intro; again.player.level = 40; again.clears.plateau = { 쉬움: { stars: 3, grade: 'S', best: 60, n: 1 } };
    const b = run(again);
    expect([b.xp, b.gold, b.tutReplay]).toEqual([0, 0, true]);
  });
});

describe('다시 보기 판정 (105 QA 2)', () => {
  it('녹슨 고원 기록이 없는 옛 · 건너뛴 저장도 Lv 3부터는 다시 보기', () => {
    const s = newSave(1); s.tut = TUT.intro; s.player.level = 30;
    expect(tutReplay(s)).toBe(true);
    s.player.level = 2;
    expect(tutReplay(s)).toBe(false);
  });
});
