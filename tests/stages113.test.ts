/** 113 초반 추가 스테이지 (보충 장소): 원본 연결 경험치 · 입장 · 길잡이 · 변주 · 새 공통 기믹 */
import { describe, expect, it } from 'vitest';
import { chainOpen, CONTENT, contentOf, variantOf, type ContentKey } from '../src/data/content';
import { BOSSES, inVariant } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { rampMain, rampRefLevel, rampSpan, rampXp, recLevel } from '../src/data/progression';
import { rankStages, type GuideCtx } from '../src/game/guide';
import { noviceCells, noviceTarget, SUPP_HARD } from '../src/sim/novice';
import { noviceCellOf } from '../src/sim/balance';
import * as E from '../src/engine';
import { step } from '../src/engine/fight';
import { heal } from '../src/engine/core';

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
  it('입장: 보충 장소도 그 장소에서 쉬움부터 차례로 (원본에서 연 난이도로 바로 들어가지 않음, 2026-10-27 Lim 「각 스테이지별로 순차적으로」)', () => {
    const c = contentOf('washyard');
    expect(chainOpen(c, '쉬움', {})).toBe(true);
    expect(chainOpen(c, '보통', {})).toBe(false);
    expect(chainOpen(c, '보통', { '쉬움': rec })).toBe(true);
    expect(chainOpen(c, '어려움', { '쉬움': rec })).toBe(false);
    expect(chainOpen(c, '어려움', { '보통': rec })).toBe(true); // 옛 저장: 원본에서 열고 보통부터 깬 보충 장소도 그대로 이어짐
  });
  it('길잡이: 원본 다시 하기 차례에 안 가 본 보충 장소 (처음엔 쉬움, 깨 가며 원본 난이도까지), 다 가 봤으면 최근에 안 간 곳', () => {
    const clears: GuideCtx['clears'] = {};
    for (const x of CONTENT.filter(y => rampMain(y) && y.stageLv <= 8)) clears[x.key] = { '쉬움': rec, '보통': rec };
    const ctx = (o: Partial<GuideCtx> = {}): GuideCtx => ({ level: 8, gear: 0, clears, open: (c, d) => c.unlockLv <= 8 && chainOpen(c, d, clears[c.key]), ...o });
    const first = rankStages(ctx())[0];
    expect(['washyard', 'ashalley']).toContain(first.content);
    expect(first.diff).toBe('쉬움'); // 보통은 그 보충 장소 쉬움을 깨야 열림
    clears.washyard = { '쉬움': rec }; clears.ashalley = { '쉬움': rec };
    const next = rankStages(ctx({ recent: ['ashalley', 'washyard'] }))[0];
    expect(next).toEqual({ content: 'alley', diff: '보통' }); // 원본 · 보충 둘 다 최근에 갔으니 원본
    expect(rankStages(ctx({ recent: ['alley', 'washyard'] }))[0]).toEqual({ content: 'ashalley', diff: '보통' }); // 쉬움을 깬 보충 장소는 보통으로
  });
  it('초보 하한 (113 7-1): 보충 장소도 자동 밸런스가 봄, 어려움은 Lv 10 80% · Lv 11~20 75%, 쉬움 · 보통 · 길 밖은 원본 목표', () => {
    expect(noviceCells(['쉬움', '보통', '어려움']).some(x => x.c.anchor)).toBe(false); // sim:novice 기본은 길만
    const all = noviceCells(['쉬움', '보통', '어려움'], true);
    expect(supps.every(c => all.some(x => x.c.key === c.key))).toBe(true);
    const at = (key: ContentKey, d: '쉬움' | '보통' | '어려움') => noviceTarget(noviceCellOf(contentOf(key), d)!);
    expect(at('sproutworks', '어려움')).toBe(SUPP_HARD.early); // 장소 Lv 10
    expect(at('lilygate', '어려움')).toBe(SUPP_HARD.later); // 장소 Lv 20
    expect(at('washyard', '어려움')).toBe(at('alley', '어려움')); // 장소 Lv 8: 길 밖 (원본과 같음)
    expect(at('lilygate', '보통')).toBe(at('lilypalace', '보통'));
    expect(at('sproutworks', '쉬움')).toBe(at('greenhouse', '쉬움'));
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
  it('꽃봉오리 (2026-10-28 Lim 「이로운 스킬을 해로운 스킬로」, 예전 채우면 파티 회복): 채우면 아무 일 없고, 못 채우면 시들며 가시가 터져 전원 피해', () => {
    const go = (fill: boolean) => {
      const f = E.create({ encounter: 'mallim', diff: '보통', seed: 3, variant: 0 });
      while (!f.souls.length && f.t < 30) step(f);
      expect(f.souls.length).toBe(1);
      f.skills.forEach(s => { s.next = Infinity; }); // 끝날 때까지 다른 기술 · 평타 없음
      for (const u of f.party) u.hp = u.max;
      if (fill) f.souls[0].hp = f.souls[0].max;
      while (f.souls.length) step(f);
      return f.party.filter(u => u.alive && u.hp < u.max - 1e-6).length;
    };
    expect(go(true)).toBe(0);
    expect(go(false)).toBe(5);
  });
  it('봉합 상처: 실제로 오른 체력만큼 봉합량이 줄고 (넘친 치유는 안 셈), 다 채우면 멎음', () => {
    const f = E.create({ encounter: 'ttakkeum', diff: '보통', seed: 4, variant: 0 });
    while (!f.party.some(u => u.debuffs.some(d => d.staunch)) && f.t < 20) step(f);
    const u = f.party.find(x => x.debuffs.some(d => d.staunch))!, d = u.debuffs.find(x => x.staunch)!;
    expect(d.staunchNeed).toBeCloseTo(u.max * 0.3, 0);
    expect(u.hp / u.max).toBeLessThan(0.7);
    const left0 = d.staunchLeft!, gain = u.max * 0.1, hp0 = u.hp;
    heal(f, u, gain, true, true);
    expect(left0 - d.staunchLeft!).toBeCloseTo(u.hp - hp0, 3);
    u.hp = u.max; // 가득 찬 채로 힐 = 모두 넘친 치유 → 봉합량 그대로
    const left1 = d.staunchLeft!;
    heal(f, u, gain, true, true);
    expect(d.staunchLeft).toBe(left1);
    u.hp = u.max * 0.2;
    heal(f, u, u.max * 0.5, true, true);
    expect(u.debuffs.includes(d)).toBe(false);
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
