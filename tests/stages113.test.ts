/** 113 초반 추가 스테이지 (보충 장소): 원본 연결 경험치 · 입장 · 길잡이 · 변주 · 새 공통 기믹 */
import { describe, expect, it } from 'vitest';
import { chainOpen, CONTENT, contentOf, variantOf } from '../src/data/content';
import { BOSSES, inVariant } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { rampMain, rampRefLevel, rampSpan, rampXp, recLevel } from '../src/data/progression';
import { rankStages, type GuideCtx } from '../src/game/guide';
import * as E from '../src/engine';
import { step } from '../src/engine/fight';

const supps = CONTENT.filter(c => c.anchor);
const rec = { stars: 1, grade: 'A', best: 99, n: 1 };

describe('보충 장소 (113 4장)', () => {
  it('원본과 같은 레벨 · 같은 종류, 길 (rampMain)이 아님, 원본 몫 · 권장 레벨 그대로', () => {
    expect(supps.length).toBeGreaterThan(0);
    for (const c of supps) {
      const a = contentOf(c.anchor!);
      expect([c.stageLv, c.kind, c.ready], c.key).toEqual([a.stageLv, a.kind, true]);
      expect(rampMain(c), c.key).toBe(false);
      expect(rampSpan(c), c.key).toBe(rampSpan(a));
      for (const d of ['쉬움', '보통', '어려움'] as const) {
        expect(rampRefLevel(c, d), `${c.key} ${d}`).toBe(rampRefLevel(a, d));
        expect(recLevel(c, d), `${c.key} ${d}`).toBe(recLevel(a, d));
      }
    }
  });
  it('경험치 = 원본 반복판 (첫 방문도 첫 클리어 몫 없음)', () => {
    for (const c of supps) for (const d of ['보통', '어려움'] as const) {
      const a = contentOf(c.anchor!), again = rampXp(a, d, { first: false, grade: 'A', win: true });
      expect(rampXp(c, d, { first: true, grade: 'A', win: true }), `${c.key} ${d}`).toBe(again);
      expect(rampXp(c, d, { first: true, grade: 'A', win: true })).toBeLessThan(rampXp(a, d, { first: true, grade: 'A', win: true }));
    }
  });
  it('입장: 원본에서 연 난이도로 바로 (보충 장소 쉬움 · 보통을 다시 깨지 않음)', () => {
    const c = contentOf('washyard');
    expect(chainOpen(c, '어려움', {}, 1)).toBe(false);
    expect(chainOpen(c, '어려움', {}, 1, { '보통': rec })).toBe(true);
    expect(chainOpen(c, '보통', {}, 1, { '쉬움': rec })).toBe(true);
  });
  it('길잡이: 원본 다시 하기 차례에 안 가 본 보충 장소, 다 가 봤으면 최근에 안 간 곳', () => {
    const clears: GuideCtx['clears'] = {};
    for (const x of CONTENT.filter(y => rampMain(y) && y.stageLv <= 8)) clears[x.key] = { '쉬움': rec, '보통': rec };
    const ctx = (o: Partial<GuideCtx> = {}): GuideCtx => ({ level: 8, gear: 0, clears, open: c => c.unlockLv <= 8, ...o });
    const first = rankStages(ctx())[0];
    expect(['washyard', 'ashalley']).toContain(first.content);
    expect(first.diff).toBe('보통');
    clears.washyard = { '보통': rec }; clears.ashalley = { '보통': rec };
    const top = rankStages(ctx({ recent: ['ashalley', 'washyard'] }))[0];
    expect(top.content).toBe('alley'); // 원본 · 보충 둘 다 최근에 갔으니 원본
    expect(rankStages(ctx({ recent: ['alley', 'washyard'] }))[0].content).toBe('ashalley');
  });
  it('Lv 21부터는 보충 장소를 첫 클리어로 추천하지 않음 (원본 길과 같은 규칙)', () => {
    const r = rankStages({ level: 25, gear: 10, clears: {}, open: c => c.unlockLv <= 25 });
    expect(r.some(x => contentOf(x.content).anchor)).toBe(false);
  });
});

describe('전투 변주 A · B · C (113 7-4)', () => {
  it('깬 횟수 합 % 3, 처음 = A', () => {
    expect(variantOf(undefined)).toBe(0);
    expect(variantOf({ '보통': { n: 1 } })).toBe(1);
    expect(variantOf({ '보통': { n: 2 }, '어려움': { n: 3 } })).toBe(2);
  });
  it('보충 장소 최종 보스는 변주 세 줄, 변주마다 그 기술만 만들어짐', () => {
    for (const c of supps) {
      const enc = ENCOUNTERS[c.fights('보통').at(-1)!], def = BOSSES[enc.script as keyof typeof BOSSES];
      expect(def.variants?.length, c.key).toBe(3);
      for (const v of [0, 1, 2]) {
        const f = E.create({ encounter: enc.key, diff: '보통', seed: 1, variant: v });
        expect(f.skills.map(s => s.key), `${c.key} ${v}`).toEqual(def.skills.filter(s => inVariant(s.when, v)).map(s => s.key));
        expect(f.vtext).toBe(def.variants![v]);
      }
    }
  });
});

describe('새 공통 기믹 (113 6장)', () => {
  it('꽃의 파티 회복: 꽃을 채우면 살아 있는 파티원 각자 최대 체력 × pct', () => {
    const f = E.create({ encounter: 'mallim', diff: '보통', seed: 3, variant: 0 });
    for (const u of f.party) u.hp = u.max * 0.5;
    while (!f.souls.length && f.t < 30) step(f);
    expect(f.souls.length).toBe(1);
    const before = f.party.map(u => u.hp);
    const bud = f.souls[0];
    bud.hp = bud.max;
    step(f);
    expect(f.souls.length).toBe(0);
    f.party.forEach((u, i) => { if (u.alive) expect(u.hp - before[i]).toBeGreaterThan(u.max * 0.05); });
  });
  it('dropPct: 걸리자마자 최대 체력 비율만큼 깎여 체력선 (75%) 아래에서 시작', () => {
    const f = E.create({ encounter: 'chorereu', diff: '보통', seed: 2, variant: 0 });
    while (!f.party.some(u => u.debuffs.some(d => d.name === '밀랍 굳음')) && f.t < 20) step(f);
    const u = f.party.find(x => x.debuffs.some(d => d.name === '밀랍 굳음'))!;
    expect(u).toBeTruthy();
    expect(u.role === 'tank' || u.me).toBe(false);
    expect(u.hp / u.max).toBeLessThan(0.75);
  });
});
