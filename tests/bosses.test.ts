/** 보스 데이터 틀 (38 0-2): 데이터가 서로 맞는지, 공략 숫자가 데이터에서 그대로 나오는지 */
import { describe, expect, it } from 'vitest';
import { BOSSES, CHOIR, type FlowDo } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { GB } from '../src/battle/guideNums';
import * as E from '../src/engine';

const KEYS = Object.keys(BOSSES) as (keyof typeof BOSSES)[];

describe('보스 데이터', () => {
  it('모든 보스 전투가 데이터를 가짐', () => {
    for (const enc of Object.values(ENCOUNTERS)) if (enc.script !== 'trash') expect(BOSSES[enc.script], enc.key).toBeDefined();
  });
  for (const k of KEYS) {
    it(`${k}: 기술 key가 겹치지 않고, 흐름이 부르는 기술·몸통이 있음`, () => {
      const def = BOSSES[k];
      const keys = def.skills.map(s => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      const dos: FlowDo[] = (def.flow || []).flatMap(st => (st.p === 'when' ? st.do : []));
      for (const d of dos) if (d.p === 'start' || d.p === 'period') expect(keys, `${k} ${d.p} ${d.skill}`).toContain(d.skill);
      for (const st of def.flow || []) if (st.p === 'when' && st.if.idle) expect(keys).toContain(st.if.idle);
      // 처음엔 꺼진 기술 (first: null)은 흐름 어딘가에서 열림
      for (const s of def.skills) if (s.first === null) expect(dos.some(d => d.p === 'start' && d.skill === s.key), `${k}.${s.key}`).toBe(true);
      const nb = def.bodies?.length ?? 0;
      for (const s of def.skills) for (const i of s.when?.bodyAlive ?? []) expect(i).toBeLessThan(nb);
      // 장판은 칸 규칙, 나머지는 하는 일이 있음
      for (const s of def.skills) expect(s.kind === 'zone' ? !!s.cells && !!s.dps && !!s.dur : !!s.effect, `${k}.${s.key}`).toBe(true);
    });
  }
  it('전투에 들어가면 기술이 데이터 순서대로, key로도 찾힘', () => {
    for (const k of KEYS) {
      const enc = Object.values(ENCOUNTERS).find(e => e.script === k)!;
      const f = E.create({ encounter: enc.key, diff: '보통', seed: 1 });
      expect(f.skills.map(s => s.key)).toEqual(BOSSES[k].skills.map(s => s.key));
      for (const s of BOSSES[k].skills) expect(f.bs[s.key]).toBe(f.skills.find(x => x.key === s.key));
      expect([f.phase, f.phaseName]).toEqual(BOSSES[k].phase);
    }
  });
});

describe('공략 화면 숫자 = 보스 데이터 (전에 손으로 옮겨 적던 값)', () => {
  it('문지기·경비병·역병 군주·성가대', () => {
    expect(GB.warden).toEqual({ auto: 70, aoe: 220, zoneAt: 0.4, enrName: '증기 폭주', enrDmg: 220, enrPeriod: 2, enrCast: 1 });
    expect(GB.scrap).toEqual({ auto: 75, aoe: 170, enrName: '고철 폭주', enrDmg: 150, enrPeriod: 2, enrCast: 1 });
    expect(GB.plague).toEqual({
      auto: 60, breathPct: 5, breathMax: 4, breathDur: 60, stingDot: 15, stingDur: 12, pulse1: 150, pulse2: 180, pulse2Period: 25, pulse2Delay: 22,
      interAt: 0.6, interDur: 25, rats: 30, contDelay: 10, contDur: 8, spread: 150, p3At: 0.3,
      targets: { breath: 2, cont: [1, 2], rats: 3 },
      enrName: '역병 폭주', enrDmg: 180, enrPeriod: 3, enrCast: 1,
    });
    expect(GB.choir).toEqual({ ...CHOIR, enrName: '대합창', enrDmg: 200, enrPeriod: 3, enrCast: 1 });
  });
});
