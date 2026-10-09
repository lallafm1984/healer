/**
 * 공략 화면 숫자 중 시험 전투로는 안 보이는 것 (평타·광역 피해, 디버프, 페이즈 문턱): 보스 데이터(data/bosses.ts)에서 읽음.
 * 화면 코드(guide.ts)와 떼어 둬서 테스트가 그대로 읽을 수 있음
 */
import { BOSSES, bossSkill, CHOIR, SPREAD, type FlowDo, type FlowIf, type FlowStep, type SkillEffect } from '../data/bosses';
import type { ScriptKey } from '../data/encounters';

type BossKey = Exclude<ScriptKey, 'trash'>;
const eff = <P extends SkillEffect['p']>(k: BossKey, key: string, p: P) => { const e = bossSkill(k, key).effect!; if (e.p !== p) throw new Error(`${k}.${key}`); return e as Extract<SkillEffect, { p: P }>; };
/** 페이즈 흐름에서 조건이 맞는 전환 */
const flowWhen = (k: BossKey, test: (c: FlowIf) => boolean) => BOSSES[k].flow!.find((x): x is Extract<FlowStep, { p: 'when' }> => x.p === 'when' && test(x.if))!;
const flowDo = <P extends FlowDo['p']>(w: { do: FlowDo[] }, p: P, skill?: string) => w.do.find(d => d.p === p && (!skill || (d as { skill?: string }).skill === skill)) as Extract<FlowDo, { p: P }>;
const enr = (k: BossKey) => ({ enrName: BOSSES[k].enrage.name, enrDmg: BOSSES[k].enrage.dmg, enrPeriod: BOSSES[k].enrage.period, enrCast: 1 });
const PLAGUE = (() => {
  const rot = eff('plague', 'breath', 'rot'), sting = eff('plague', 'sting', 'debuff'), pulse = eff('plague', 'aoe', 'all'), cont = eff('plague', 'contagion', 'debuff');
  const inter = flowWhen('plague', c => c.phase === 1), p2 = flowWhen('plague', c => !!c.interOver), p3 = flowWhen('plague', c => !!c.mythic);
  const rats = BOSSES.plague.flow!.find((x): x is Extract<FlowStep, { p: 'rats' }> => x.p === 'rats')!;
  return {
    auto: eff('plague', 'auto', 'auto').dmg, breathPct: Math.round(rot.pct * 100), breathMax: rot.max, breathDur: rot.debuff.left, stingDot: sting.debuff.dot, stingDur: sting.debuff.left,
    pulse1: pulse.phaseDmg![1], pulse2: pulse.dmg, pulse2Period: flowDo(p2, 'period', 'aoe').sec, pulse2Delay: flowDo(p2, 'start', 'aoe').in,
    interAt: inter.if.hpBelow, interDur: flowDo(inter, 'inter').sec, rats: rats.dps, contDelay: flowDo(p2, 'start', 'contagion').in, contDur: cont.debuff.left, spread: SPREAD.dmg, p3At: p3.if.hpBelow,
    targets: { breath: rot.n, cont: [cont.n, cont.nMythic ?? cont.n], rats: flowDo(inter, 'rats').n }, // cont = [보통, 악몽] — 10인 악몽은 전염 2명 동시 (26 3-1)
    ...enr('plague'),
  };
})();
export const GB: Record<ScriptKey, Record<string, any>> = {
  warden: { auto: eff('warden', 'auto', 'auto').dmg, aoe: eff('warden', 'aoe', 'all').dmg, zoneAt: bossSkill('warden', 'zone').when!.hpBelow, ...enr('warden') },
  scrap: { auto: eff('scrap', 'auto', 'auto').dmg, aoe: eff('scrap', 'aoe', 'all').dmg, ...enr('scrap') },
  trash: {},
  plague: PLAGUE,
  choir: { ...CHOIR, ...enr('choir') },
};
