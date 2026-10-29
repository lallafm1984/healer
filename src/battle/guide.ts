/**
 * 보스 공략 (전투 전 화면 · 일시정지 · 전투 중 기술 팝업 · 휴식이 모두 이 한 곳의 데이터를 씀).
 * 프로토타입 v11 화면에서 옮김.
 */
import { fmtInt, lang, t, tc } from '../i18n';
import type { DiffName } from '../data/difficulty';
import { DIFFS } from '../data/difficulty';
import { ENCOUNTERS, enrageOf, mobGrade, type Encounter, type EncounterKey, type ScriptKey } from '../data/encounters';
import { mobLookOf } from '../data/mob-looks';
import { canDispel, dispellable, HEROES } from '../data/heroes';
import { SKILLS } from '../data/skills';
import { CHAIN_GROW, create, ROD_HP, TIDE_CUT, type Fight, type Role } from '../engine';
import { bossSvg } from './art';
import { bossSkillArt, gimArt, mobSkillArt, skillArtImg } from './skillArt';
import { BOSSES, hardDef, hardOn, inVariant, mythicDef, SPREAD, type AddDef, type DebuffDef, type SkillDef, type SkillEffect } from '../data/bosses';
import { bossNums } from './guideNums';
import { RULES, zoneDps } from '../data/rules';
import { ARROW, glyphOf, heroSkill, ICON_COLOR, iga, josa, mmss, READ_ORDER, S, secT } from './core';

/** 같은 종류가 여럿인 구간 적: 둘째부터 보이는 다른 얼굴 이름 (data/mob-looks, 2026-10-25) */
function looksText(kind: string, count: number): string {
  const names = [...new Set(Array.from({ length: count - 1 }, (_, k) => mobLookOf(kind, k + 1).name))].filter(n => n !== kind).map(n => t(n));
  return names.length ? ` ${t('({names} 포함)', { names: names.join(' · ') })}` : '';
}

// 숫자는 엔진에서 읽는다: 기술 이름·아이콘·첫 시각·주기·예고·탱커 피해·장판 맞는 순간 · 초당 피해/지속은 시험 전투(E.create)의 skills에서 (장판 · 강타 배율 data/rules HAZARD가 들어간 값),
// 피해 배율·회피는 E.DIFFS에서, 보스·파티 체력(악몽 배율 포함)은 시험 전투에서.
// 기술 안쪽 숫자 (평타·광역 피해, 디버프, 페이즈 문턱)는 보스 데이터(data/bosses.ts)에서 읽어 GB로 모음
type Num = any;
interface ProbeSkill { name: string; icon: string; next: number; period: number; cast: number; dmg: number; dps: number; dur: number; hitDmg: number }
interface Probe { sk: Record<string, ProbeSkill>; m: number; bossMax: number; hp: { tank: number; dps: number; me: number } }
const probeCache: Record<string, Probe> = {};
/** 시험 전투 하나로 숫자를 읽음. 단계 레벨 배율(24 10장)을 넣어야 레이드 숫자가 전투와 같음 */
function probe(encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number, variant = 0): Probe {
  const k = `${encKey}|${diff}|${stageLv ?? 1}|${heroLv ?? ''}|${variant}`;
  if (!probeCache[k]) {
    const f = create({ encounter: encKey, diff, seed: 1, stageLv, heroLv, variant });
    const sk: Record<string, ProbeSkill> = {};
    for (const s of f.skills) sk[s.key] = { name: s.name ?? '', icon: s.icon ?? '', next: s.next, period: s.period, cast: s.cast, dmg: s.dmg ?? 0, dps: s.dps ?? 0, dur: s.dur ?? 0, hitDmg: s.hitDmg ?? 0 };
    // 2인·3인 판엔 근접이 없을 수 있어서 딜러 아무나
    const hp = (r: Role) => Math.round((f.party.find(u => u.role === r) || f.party.find(u => u.role !== 'tank' && !u.me) || { max: 600 }).max);
    probeCache[k] = { sk, m: f.dmgMult, bossMax: f.bossMax, hp: { tank: hp('tank'), dps: hp('melee'), me: hp('healer') } };
  }
  return probeCache[k];
}
// 대응 문구에 지금 스킬 배치의 쓸기 방향을 붙임 (로비에서 바꿀 수 있어서). slot = 휠 칸 (사제 스킬 이름), 이름은 지금 직업 스킬.
// p = 뒤에 붙는 조사 [받침 있을 때, 없을 때] (직업마다 스킬 이름이 달라서)
// 드루이드는 지속 힐이 기본 힐 칸(새싹)이고 지속 힐 칸은 거두기(피워 내기)라서, 공략 문구의 「지속 힐」·「기본 힐」을 옮김
const GUIDE_SLOT: Partial<Record<string, Record<string, string>>> = { druid: { renew: 'heal', heal: 'flash' } };
function act(key: string, p?: [string, string]) {
  const slot = GUIDE_SLOT[S.hero]?.[key] || key;
  const nm = t(SKILLS[heroSkill(slot)].name), d = READ_ORDER.find(x => S.layout[x] === slot);
  return `${nm}${d ? `(${ARROW[d]} 쓸기)` : ''}${p ? josa(nm, p[0], p[1]) : ''}`;
}
const EUL: [string, string] = ['을', '를'], RO: [string, string] = ['으로', '로'];
/** 독처럼 지금 직업이 못 지우는 디버프의 대응 */
const cantDispel = (type: string) => `${HEROES[S.hero].name}${josa(HEROES[S.hero].name, '은', '는')} ${type}${josa(type, '을', '를')} 못 지움. ${act('renew', EUL)} 걸고 ${act('heal', RO)} 버티기`;
const ENRAGE_HOW = '버티는 기술이 아님. 그 전에 잡으려면 딜러가 쓰러지지 않게';
// 시트에 보이는 글 (이름 · 주기 · 진행 · 짧은 설명 tip · 대상 칩) 은 t()로 세 언어 (121 3단계 ⑤-b). 안 보이는 what · how · when (Lim 2026-10-12 「대처 줄 모두 빼기」) 은 한국어 그대로.
/** 공략 대상 칩 (탱커 · 전원 · N명 · 장판 · 줄): 기술마다 정해 둠 (예전엔 한국어 기술 글 첫머리를 읽었음) */
export interface Who { k: 'tank' | 'all' | 'some' | 'zone' | 'enr'; t: string }
const ROW_NAME = { front: '앞줄', mid: '가운데 줄', back: '뒷줄' } as const;
/** 「N명」 (영어는 1 player · 2 players) */
const nPeople = (n: number | string) => (n === 1 ? t('1명') : tc('{n}명', 'who', { n }));
const WHO = {
  tank: (): Who => ({ k: 'tank', t: t('탱커') }), all: (): Who => ({ k: 'all', t: t('전원') }),
  some: (n: number | string): Who => ({ k: 'some', t: nPeople(n) }), zone: (): Who => ({ k: 'zone', t: t('장판') }),
  row: (r: keyof typeof ROW_NAME): Who => ({ k: 'zone', t: t(ROW_NAME[r]) }),
};
/** 「10초마다」 */
const everyT = (period: number) => t('{s}마다', { s: secT(period) });
const enragePhase = (c: GuideCtx): GuidePhase => ({ id: 'enrage', name: t('광폭화'), at: mmss(c.enc.enrage), text: t('{s} {n}초마다', { s: iga(t(c.B.enrName)), n: c.B.enrPeriod }), enr: true });
const enrageSkill = (c: GuideCtx): GuideSkill => {
  const { B, n } = c;
  return { ic: '광폭', name: t(B.enrName), enr: true, who: { k: 'enr', t: t('전원') },
    when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`, what: `파티 전원에게 <b>${n(B.enrDmg)}</b> 피해. 몇 번이면 전멸`, how: ENRAGE_HOW,
    every: t('{s}부터', { s: mmss(c.enc.enrage) }), tip: () => [t('{p}초마다 파티 전원에게 {n} 피해를 줍니다.', { p: B.enrPeriod, n: n(B.enrDmg) })] };
};

interface GuideCtx { enc: Encounter; diff: DiffName; m: number; n: (x: number) => number; mythic: boolean; sk: Record<string, ProbeSkill>; hp: Probe['hp']; B: Record<string, Num>; hpMult: number; /** 전투 변주 (113 7-4) */ variant: number }
export interface GuidePhase { id: string; name: string; at: string; text: string; enr?: boolean }
/** art = 기술 아이콘 그림 이름 (battle/skillArt.ts, 없으면 글자 아이콘) */
export interface GuideSkill { ic: string; name: string; art?: string; enr?: boolean; when?: string; what: string; how?: string; every: string; tip: (F?: Fight | null) => string[]; /** 대상 칩 (없으면 칩 없음) */ who?: Who }
interface GuideBody { nums: Record<string, Num>; cur: (F: Fight) => string; phases: GuidePhase[]; skills: GuideSkill[] }

const GUIDE: Partial<Record<ScriptKey, (c: GuideCtx) => GuideBody>> = {
  // 고철 경비병 (23 3장)
  scrap(c) {
    const { sk, B, n, hp } = c;
    const bu = sk.buster, ao = sk.aoe;
    const N = { buster: n(bu.dmg), aoe: n(B.aoe), autoLo: n(B.auto * 0.7), autoHi: n(B.auto * 1.3), enr: n(B.enrDmg) };
    const pct = (a: number, b: number) => Math.round((a / b) * 100);
    return {
      nums: N,
      cur: F => (F.enraged ? 'enrage' : 'p1'),
      phases: [
        { id: 'p1', name: t('시작'), at: t('처음부터'), text: t('{a} · {b} 반복', { a: t(bu.name), b: t(ao.name) }) },
        enragePhase(c),
      ],
      skills: [
        { ic: bu.icon, name: t(bu.name), who: WHO.tank(),
          what: `탱커에게 <b>${N.buster}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.buster, hp.tank)}%)`,
          every: everyT(bu.period), tip: () => [t('탱커에게 {n} 피해를 줍니다.', { n: N.buster })] },
        { ic: ao.icon, name: t(ao.name), who: WHO.all(),
          what: `파티 전원에게 <b>${N.aoe}</b> 피해`,
          every: everyT(ao.period), tip: () => [t('파티 전원에게 {n} 피해를 줍니다.', { n: N.aoe })] },
        enrageSkill(c),
      ],
    };
  },
  // 일반·정예 구간 (23 2장): 잡는 순서 = 진행, 적 공격 = 기술
  trash(c) {
    const { enc, n } = c;
    const mobs = enc.mobs!;
    const skills: GuideSkill[] = [];
    for (const m of mobs) for (const a of m.attacks) {
      const who = a.to === 'tank' ? tc('탱커', 'to') : a.to === 'other' ? t('탱커 아닌 1명') : t('파티 전원'); // 문장 안 「탱커에게」 = the tank
      const chip = a.to === 'tank' ? WHO.tank() : a.to === 'other' ? WHO.some(1) : WHO.all();
      const amt = a.jitter ? `${n(a.dmg * (1 - a.jitter))}~${n(a.dmg * (1 + a.jitter))}` : n(a.dmg);
      const each = m.count > 1 ? ` ${t('(한 마리당)')}` : '';
      const stop = t('{s} 쓰러지면 멈춤', { s: iga(t(m.name)) });
      const name = a.name ? t(a.name) : t('{s} 공격', { s: t(m.name) }), cast = a.cast ? ` · ${t('예고 {s}', { s: secT(a.cast) })}` : '';
      // 피해 없이 디버프만 거는 공격 (독침 사냥꾼의 독침 등): 「0 피해」 대신 디버프와 대처
      if (a.effect && !a.dmg) {
        const [ew, eh, ewho] = effectText(a as unknown as SkillDef, a.effect, c, undefined);
        skills.push({ ic: a.icon || m.name.slice(0, 2), name, art: mobSkillArt(m.name, a.key), who: ewho,
          what: `${ew}${cast}. ${stop}`, how: eh || undefined,
          every: everyT(a.period), tip: () => [ew.replace(/<\/?b>/g, '')] });
        continue;
      }
      skills.push({ ic: a.icon || m.name.slice(0, 2), name, art: mobSkillArt(m.name, a.key), who: chip,
        what: `${t('{who}에게 <b>{amt}</b> 피해', { who, amt })}${each}${cast}. ${stop}`,
        every: everyT(a.period), tip: () => [m.count > 1 ? t('{who}에게 한 마리당 {amt} 피해를 줍니다.', { who, amt }) : t('{who}에게 {amt} 피해를 줍니다.', { who, amt })] });
    }
    // 쓰러질 때 (46 5장 먼지 유령): 쓰러질 때마다 디버프
    for (const m of mobs) if (m.down) {
      const what = t('{s} 쓰러질 때마다 {who}에게 {d}', { s: iga(t(m.name)), who: m.down.p === 'burst' ? t('살아 있는 모두') : t('때리던 사람'), d: debuffText(m.down.debuff, n) });
      skills.push({ ic: m.name.slice(0, 2), name: t('{s} 쓰러짐', { s: t(m.name) }), art: m.down.p === 'burst' ? gimArt('burst') : '', what, how: '여럿이 한꺼번에 쓰러지면 겹침. 거의 다 잡힐 때 지속 힐을 미리', every: t('쓰러질 때마다'), tip: () => [what.replace(/<\/?b>/g, '')] });
    }
    return {
      nums: {},
      cur: F => { const m = F.mobs.find(x => x.alive); return m ? 'm' + mobs.findIndex(d => d.name === m.name) : ''; },
      phases: mobs.map((m, i) => ({ id: 'm' + i, name: `${t(m.name)}${m.count > 1 ? ` ×${m.count}` : ''}`, at: `${t(mobGrade(m))} · ${t('{n}번째로 잡음', { n: i + 1 })}`,
        text: `${m.count > 1 ? t('체력 {hp}씩', { hp: fmtInt(m.hp * c.hpMult) }) : t('체력 {hp}', { hp: fmtInt(m.hp * c.hpMult) })}${looksText(m.name, m.count)}` })),
      skills,
    };
  },
  warden(c) {
    const { sk, B, n, hp } = c;
    const bu = sk.buster, ao = sk.aoe, zo = sk.zone;
    const N = { buster: n(bu.dmg), aoe: n(B.aoe), autoLo: n(B.auto * 0.7), autoHi: n(B.auto * 1.3), zoneDps: n(zo.dps), zoneTot: n(zo.dps * zo.dur), enr: n(B.enrDmg) };
    const pct = (a: number, b: number) => Math.round((a / b) * 100);
    return {
      nums: N,
      cur: F => (F.enraged ? 'enrage' : F.bossHp <= F.bossMax * B.zoneAt ? 'p40' : 'p1'),
      phases: [
        { id: 'p1', name: t('시작'), at: t('체력 100~{p}%', { p: B.zoneAt * 100 }), text: t('{a} · {b} 반복', { a: t(bu.name), b: t(ao.name) }) },
        { id: 'p40', name: t('녹이 흘러내림'), at: t('체력 {p}% 아래', { p: B.zoneAt * 100 }), text: t('{s} 더해짐', { s: iga(t(zo.name)) }) },
        enragePhase(c),
      ],
      skills: [
        { ic: bu.icon, name: t(bu.name), who: WHO.tank(),
          when: `${secT(bu.next + bu.cast)}에 첫 타, 그 뒤 ${secT(bu.period)}마다 · 예고 ${secT(bu.cast)}`,
          what: `탱커에게 <b>${N.buster}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.buster, hp.tank)}%)`,
          how: `예고가 뜨면 탱커를 미리 가득 채우기. 못 채우면 ${act('guardian', EUL)} 걸어 한 번 버티기`,
          every: everyT(bu.period), tip: () => [t('탱커에게 {n} 피해를 줍니다.', { n: N.buster })] },
        { ic: ao.icon, name: t(ao.name), who: WHO.all(),
          when: `${secT(ao.next + ao.cast)}에 첫 타, 그 뒤 ${secT(ao.period)}마다 · 예고 ${secT(ao.cast)}`,
          what: `파티 전원에게 <b>${N.aoe}</b> 피해 (파티원 체력 ${hp.dps}의 ${pct(N.aoe, hp.dps)}%)`,
          how: `예고 동안 여러 명에게 ${act('renew', EUL)} 걸고, 맞은 뒤 ${act('poh', RO)} 모인 칸을 채우기`,
          every: everyT(ao.period), tip: () => [t('파티 전원에게 {n} 피해를 줍니다.', { n: N.aoe })] },
        { ic: zo.icon, name: t(zo.name), who: WHO.zone(),
          when: `보스 체력 ${B.zoneAt * 100}% 아래부터 · ${secT(zo.period)}마다 · 예고 ${secT(zo.cast)}`,
          what: `파티원 1명 자리와 옆 칸에 ${secT(zo.dur)} 장판. 안에 있으면 초당 <b>${N.zoneDps}</b> (다 맞으면 ${N.zoneTot})`,
          how: '파티원이 알아서 피함. 고집불통·허세꾼은 잘 안 피하니 그 사람을 채우기',
          every: t('체력 {p}%부터 {s}마다', { p: B.zoneAt * 100, s: secT(zo.period) }), tip: () => [t('파티원 1명 주변에 장판을 깔아 초당 {n} 피해를 줍니다.', { n: N.zoneDps })] },
        enrageSkill(c),
      ],
    };
  },
  plague(c) {
    const { sk, B, n, mythic } = c;
    const br = sk.breath, st = sk.sting, pu = sk.aoe, co = sk.contagion, so = sk.storm;
    const T = { breath: B.targets.breath, cont: B.targets.cont[mythic ? 1 : 0], rats: B.targets.rats };
    const N = {
      autoLo: n(B.auto * 0.7), autoHi: n(B.auto * 1.3), sting: n(B.stingDot), stingTot: n(B.stingDot * B.stingDur), pulse1: n(B.pulse1), pulse2: n(B.pulse2),
      rats: n(B.rats), ratsTot: n(B.rats * B.interDur), spread: n(B.spread), stormDps: n(so.dps), stormTot: n(so.dps * so.dur), enr: n(B.enrDmg),
      breathTargets: T.breath, stingTargets: T.breath, contTargets: T.cont, ratTargets: T.rats,
    };
    const phases: GuidePhase[] = [
      { id: 'p1', name: t('1페이즈'), at: t('체력 100~{p}%', { p: B.interAt * 100 }), text: `${t(br.name)} · ${t(st.name)} · ${t(pu.name)}` },
      { id: 'inter', name: t('인터미션'), at: t('체력 {p}%, {n}초', { p: B.interAt * 100, n: B.interDur }), text: t('보스 무적, 예고 기술 멈춤. 쥐떼가 뒷줄 {n}명 공격', { n: T.rats }) },
      { id: 'p2', name: t('2페이즈'), at: t('인터미션 뒤'), text: t('{a} 끝 · {b} 시작 · 파동이 {n}로 세지고 {p}초마다', { a: t(st.name), b: t(co.name), n: N.pulse2, p: B.pulse2Period }) },
    ];
    if (mythic) phases.push({ id: 'p3', name: t('3페이즈 (악몽)'), at: t('체력 {p}% 아래', { p: B.p3At * 100 }), text: t('{s} 더해짐', { s: iga(t(so.name)) }) });
    phases.push(enragePhase(c));
    const skills: GuideSkill[] = [
      { ic: br.icon, name: t(br.name), who: WHO.some(T.breath),
        when: `${secT(br.next)}에 첫 번째, ${secT(br.period)}마다 · 예고 없음 · 인터미션엔 멈춤`,
        what: `무작위 ${T.breath}명에게 질병: 겹칠 때마다 최대 체력 -${B.breathPct}% (최대 ${B.breathMax}번, -${B.breathPct * B.breathMax}%) · ${B.breathDur}초`,
        how: `${act('purify', RO)} 지우기. 많이 겹친 사람부터. 체력 ${B.interAt * 100}% 직전엔 다 지워 두기: 디버프가 남은 사람은 인터미션 때 독침이 더 걸림`,
        every: everyT(br.period), tip: () => [t('{k}명에게 질병을 걸어 최대 체력을 {p}%씩 겹쳐 줄입니다.', { k: T.breath, p: B.breathPct })] },
      { ic: st.icon, name: t(st.name), who: WHO.some(T.breath),
        when: `1페이즈만 · ${secT(st.next)}에 첫 번째, ${secT(st.period)}마다 · 예고 없음`,
        what: `무작위 ${T.breath}명에게 독: ${B.stingDur}초 동안 초당 <b>${N.sting}</b> (모두 ${N.stingTot})`,
        how: canDispel(S.hero, '독') ? `${act('purify', RO)} 지우기. 해제 재사용 대기가 남으면 질병 먼저` : cantDispel('독'),
        every: t('1페이즈 · {s}마다', { s: secT(st.period) }), tip: () => [t('{k}명에게 독을 걸어 {d}초 동안 초당 {n} 피해를 줍니다.', { k: T.breath, d: B.stingDur, n: N.sting })] },
      { ic: pu.icon, name: t(pu.name), who: WHO.all(),
        when: `${secT(pu.next + pu.cast)}에 첫 타, ${secT(pu.period)}마다 · 2페이즈는 시작 ${secT(B.pulse2Delay + pu.cast)} 뒤부터 ${secT(B.pulse2Period)}마다 · 예고 ${secT(pu.cast)}`,
        what: `파티 전원에게 <b>${N.pulse1}</b> 피해 · 2페이즈부터 <b>${N.pulse2}</b>`,
        how: `예고 동안 ${act('renew', EUL)} 깔고, 맞은 뒤 ${act('poh')}. 여러 명이 절반 아래면 ${act('hymn')}`,
        every: t('{a}마다 · 2페이즈 {b}마다', { a: secT(pu.period), b: secT(B.pulse2Period) }), tip: F => [F && F.phase >= 2 ? t('파티 전원에게 {n} 피해를 줍니다.', { n: N.pulse2 }) : t('파티 전원에게 {n} 피해를 줍니다. 2페이즈부터 {m}입니다.', { n: N.pulse1, m: N.pulse2 })] },
      { ic: '쥐떼', name: t('쥐떼 (인터미션)'), who: WHO.some(T.rats),
        when: `보스 체력 ${B.interAt * 100}%에서 ${B.interDur}초 동안 · 보스 무적`,
        what: `맨 뒷줄 원거리 ${T.rats}명이 초당 <b>${N.rats}</b> 피해 (${B.interDur}초면 ${N.ratsTot}). 시작할 때 디버프가 있는 사람은 독침이 하나 더`,
        how: `‘쥐떼’ 표시가 붙은 사람에게 ${act('renew', EUL)} 걸고 ${act('heal', EUL)} 몰아주기`,
        every: t('체력 {p}%에서 {n}초', { p: B.interAt * 100, n: B.interDur }), tip: () => [t('뒷줄 {k}명에게 초당 {n} 피해를 줍니다. 그동안 보스는 무적입니다.', { k: T.rats, n: N.rats })] },
      { ic: co.icon, name: t(co.name), who: WHO.some(T.cont),
        when: `2페이즈부터 · 인터미션 끝 ${secT(B.contDelay)} 뒤 첫 번째, ${secT(co.period)}마다`,
        what: `무작위 ${T.cont}명에게 함정 질병 (점선 테두리) ${secT(B.contDur)}. 끝나면 터져 옆 칸 사람에게 <b>${N.spread}</b> 피해 + 독침. 해제하면 그 자리에서 바로 터짐${mythic ? '. 악몽은 2명 동시, 두 대상이 붙어 있으면 걸리자마자 터짐' : ''}`,
        how: '해제하지 말고 기다리기. 터지기 전에 옆 칸 사람 체력을 채워 두기',
        every: t('2페이즈 · {s}마다', { s: secT(co.period) }), tip: () => [t('{s} 뒤 터져 옆 칸에 {n} 피해와 독침을 줍니다. 해제하면 바로 터집니다.', { s: secT(B.contDur), n: N.spread })] },
    ];
    if (mythic) skills.push({ ic: so.icon, name: t(so.name), who: WHO.zone(),
      when: `악몽 3페이즈(체력 ${B.p3At * 100}% 아래)부터 ${secT(so.period)}마다 · 예고 ${secT(so.cast)}`,
      what: `판 바깥 1열 (왼쪽·오른쪽 번갈아)에 ${secT(so.dur)} 장판. 안에 있으면 초당 <b>${N.stormDps}</b> (다 맞으면 ${N.stormTot})`,
      how: '파티원(나 포함)이 알아서 옮김. 못 피한 사람부터 채우기',
      every: t('3페이즈 · {s}마다', { s: secT(so.period) }), tip: () => [t('판 바깥 1열에 장판을 깔아 초당 {n} 피해를 줍니다.', { n: N.stormDps })] });
    skills.push(enrageSkill(c));
    return {
      nums: N,
      cur: F => (F.enraged ? 'enrage' : F.phase === 0 ? 'inter' : F.phase === 3 ? 'p3' : F.phase === 2 ? 'p2' : 'p1'),
      phases, skills,
    };
  },
  // 유령 성가대 (26 4-3): 20인 입문. 판을 열(구역)로 나눠 읽기
  choir(c) {
    const { sk, B, n, hp, mythic, hpMult } = c;
    const cr = sk.crescendo, ba = sk.baton, fo = sk.forte, so = sk.solo;
    const N = { song: n(B.song), cresc: n(cr.dps), crescTot: n(cr.dps * cr.dur), baton: n(ba.dmg), forte: n(B.forte), solo: n(B.soloDmg), enr: n(B.enrDmg), voiceHp: fmtInt(B.voiceHp * hpMult), bossHp: fmtInt(B.bossHp * hpMult) };
    const pct = (a: number, b: number) => Math.round((a / b) * 100);
    return {
      nums: N,
      cur: F => (F.enraged ? 'enrage' : F.phase === 2 ? 'p2' : 'p1'),
      phases: [
        { id: 'p1', name: t('1페이즈 · 세 성부'), at: t('성가대원이 살아 있는 동안 (지휘자 무적)'), text: t('성가대원 셋 (체력 {hp}씩)을 왼쪽부터 잡음. 하나 잡을 때마다 그 2열이 조용해짐', { hp: N.voiceHp }) },
        { id: 'p2', name: t('2페이즈 · 마지막 악장'), at: t('성가대원 전멸 뒤'), text: t('지휘자 (체력 {hp}) · {a} · {b}', { hp: N.bossHp, a: t(fo.name), b: t(so.name) }) },
        enragePhase(c),
      ],
      skills: [
        { ic: '노래', name: t('노래'),
          when: '1페이즈 내내 · 예고 없음',
          what: `살아 있는 성가대원이 맡은 2열 (높은 성부 1·2열, 가운데 3·4열, 낮은 5·6열)에 선 사람 초당 <b>${N.song}</b>`,
          how: `성가대원을 잡을수록 조용해짐. 그 전엔 ${act('renew', EUL)} 넓게 깔아 두기`,
          every: t('1페이즈 내내'), tip: () => [t('맡은 2열에 선 사람에게 초당 {n} 피해를 줍니다.', { n: N.song })] },
        { ic: cr.icon, name: t(cr.name), who: WHO.zone(),
          when: `${secT(cr.next + cr.cast)}에 첫 번째, ${secT(cr.period)}마다 · 예고 ${secT(cr.cast)} · 1페이즈만`,
          what: `살아 있는 성부 하나 (왼쪽부터 차례로)의 2열에 ${secT(cr.dur)} 장판. 안에 있으면 초당 <b>${N.cresc}</b> (다 맞으면 ${N.crescTot})${mythic ? '. 악몽 「불협화음」: 두 성부 4열 동시' : ''}`,
          how: `그 2열에 6~7명이 서 있고 빈 칸은 10개뿐이라 다 못 피함. 남은 사람이 모인 곳에 ${act('poh', RO)} 한 번에 채우기`,
          every: t('1페이즈 · {s}마다', { s: secT(cr.period) }), tip: () => [t('성부 하나의 2열에 장판을 깔아 초당 {n} 피해를 줍니다.', { n: N.cresc })] },
        { ic: ba.icon, name: t(ba.name), who: WHO.tank(),
          when: `${secT(ba.next + ba.cast)}에 첫 타, 그 뒤 ${secT(ba.period)}마다 · 예고 ${secT(ba.cast)}`,
          what: `탱커에게 <b>${N.baton}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.baton, hp.tank)}%)`,
          how: `예고가 뜨면 탱커를 미리 채우기. 못 채우면 ${act('guardian', EUL)} 걸기`,
          every: everyT(ba.period), tip: () => [t('탱커에게 {n} 피해를 줍니다.', { n: N.baton })] },
        { ic: fo.icon, name: t(fo.name), who: WHO.all(),
          when: `2페이즈 · 시작 ${secT(8 + fo.cast)} 뒤 첫 타, ${secT(fo.period)}마다 · 예고 ${secT(fo.cast)}`,
          what: `파티 전원 (20명)에게 <b>${N.forte}</b> 피해 (파티원 체력 ${hp.dps}의 ${pct(N.forte, hp.dps)}%)`,
          how: `예고 동안 ${act('renew', EUL)} 깔고, 맞은 뒤 사람이 많이 모인 칸에 ${act('poh')}. 여러 명이 절반 아래면 ${act('hymn')}`,
          every: t('2페이즈 · {s}마다', { s: secT(fo.period) }), tip: () => [t('파티 전원에게 {n} 피해를 줍니다.', { n: N.forte })] },
        { ic: so.icon, name: t(so.name), who: WHO.some(B.soloN),
          when: `2페이즈 · 시작 5초 뒤 첫 번째, ${secT(so.period)}마다 · 예고 없음`,
          what: `무작위 ${B.soloN}명에게 마법 「독창」 ${secT(B.soloSec)}. 끝나면 그 사람이 선 <b>열 전체</b>에 <b>${N.solo}</b>. 해제하면 바로 사라짐 (함정 아님)`,
          how: canDispel(S.hero, '마법') ? `${act('purify', RO)} 지우기. ${B.soloN}명이라 다 못 지우니 못 지운 사람의 열을 미리 채우기` : cantDispel('마법'),
          every: t('2페이즈 · {s}마다', { s: secT(so.period) }), tip: () => [t('{k}명에게 독창을 걸어 {s} 뒤 그 열 전체에 {n} 피해를 줍니다.', { k: B.soloN, s: secT(B.soloSec), n: N.solo })] },
        enrageSkill(c),
      ],
    };
  },
};
// ---------- 데이터 공략 (38 0-2): 손으로 쓴 공략이 없는 보스는 보스 데이터의 기술 · 페이즈에서 글을 만듦 ----------
/** 대기열 · 공략 아이콘 색: 손으로 정한 색이 없으면 기술 종류 · 디버프 유형 색 */
const KIND_COLOR: Record<string, string> = { buster: '#FF6B57', aoe: '#FF9F43', zone: '#E0664F', instant: '#B9A38A' };
const TYPE_COLOR: Record<string, string> = { '질병': '#D9A13B', '독': '#3CC24A', '저주': '#A050E0', '마법': '#3D8BFF' };
for (const def of Object.values(BOSSES)) for (const d of def.skills) {
  if (!d.icon || ICON_COLOR[d.icon]) continue;
  const e = d.effect, type = e?.p === 'debuff' || e?.p === 'rot' ? e.debuff.type : undefined;
  ICON_COLOR[d.icon] = (type && TYPE_COLOR[type]) || KIND_COLOR[d.kind ?? 'instant'];
}
/** 기술 아이콘 테두리 · 바탕 색: 정한 색 → 기술 종류 색 (그림 아이콘은 테두리만 칠함, 37 1장 · 44 4장 D) */
export const iconColor = (ic: string, kind?: string): string => ICON_COLOR[ic] || KIND_COLOR[kind ?? ''] || '#BBB';
const pctT = (x: number) => `${Math.round(x * 100)}%`;
/**
 * 디버프 한 줄: 「부패」 (질병, 20초 · 최대 체력 −10%, 끝나면 돌아옴). 걸리면 무엇이 되는지 · 끝나거나 지우면 무엇이 되는지를 숫자까지 다 적는다
 * (2026-10-27 Lim 「역병사슬이 걸리면 어떻게 되는지 … 공략에서는 상세히 설명하도록 (다른 모든 보스 스킬 해당)」). 전투 중 파티원 상세창은 짧게 (party-display.ts debuffBrief)
 */
function debuffText(d: DebuffDef, n: (x: number) => number): string {
  const e = d.end, sp = SPREAD.debuff, SP = { n: n(SPREAD.dmg), name: t(sp.name), type: t(sp.type), s: secT(sp.left), dot: n(sp.dot) };
  const fx = [d.dot ? t('초당 {n}', { n: n(d.dot) }) : '', d.stackMax && !d.vuln ? t('또 걸리면 겹침 (최대 {n}, 초당 피해 × 중첩)', { n: d.stackMax }) : '',
    d.grow && d.cureAt ? t('체력 {p} 아래인 동안 {s}마다 1중첩, 중첩마다 초당 <b>{n}</b> (최대 {m})', { p: pctT(d.cureAt), s: secT(d.grow.every), n: n(d.grow.dot), m: d.grow.max }) : '',
    d.maxCut ? t('최대 체력 −{p}', { p: pctT(d.maxCut) }) : '', e?.p === 'restoreMax' ? t('끝나거나 지우면 최대 체력이 돌아옴') : '',
    d.healCut ? `${t('받는 치유 −{p}', { p: pctT(d.healCut) })}${d.stackMax ? ` ${t('중첩')}` : ''}` : '',
    d.noDps ? t('딜 0') : '', d.noMove ? t('못 움직여 장판을 못 피함') : '', d.hide ? t('판 기술에 안 맞음') : '', d.dpsCut ? t('딜 −{p}', { p: pctT(d.dpsCut) }) : '',
    d.invert ? t('받는 치유가 그만큼 피해로') : '', dispellable(d) ? '' : t('해제 안 됨'),
    d.cureAt ? t('체력 {p} 채우면 떨어짐', { p: pctT(d.cureAt) }) : '', d.untilBossLoss != null ? t('보스 체력을 {p} 깎으면 풀림', { p: pctT(d.untilBossLoss) }) : '',
    e?.p === 'hit' ? (d.absorb ? t('막이 남은 채로 시간이 다 되면 <b>{n}</b>', { n: n(e.dmg) }) : t('두면 시간 끝에 <b>{n}</b>', { n: n(e.dmg) })) : '',
    e?.p === 'colDmg' ? t('두면 시간 끝에 그 사람이 선 열 전체 <b>{n}</b> (지우면 그냥 사라짐)', { n: n(e.dmg) }) : '',
    d.trap && (!e || e.p === 'spread') ? t('끝나면 터져 이웃 칸 아군 <b>{n}</b> + 「{name}」 ({type}, {s} · 초당 {dot}), 지우면 그 자리에서 바로 터짐', SP)
      : e?.p === 'spread' ? t('끝나면 이웃 칸 아군 <b>{n}</b> + 「{name}」 ({type}, {s} · 초당 {dot})', SP) : '',
    d.feed ? t('빨아들인 만큼 × {n} 보스 회복', { n: d.feed }) : '', e?.p === 'trapHit' ? t('두면 시간 끝에 <b>{a}</b>, 지우면 이웃 칸 아군 <b>{b}</b>', { a: n(e.dmg), b: n(e.burst) }) : '',
    e?.p === 'blast' ? t('끝나거나 지우면 (지우면 바로) 이웃 칸 아군 <b>{n}</b>', { n: n(e.dmg) }) : '',
    e?.p === 'trapLoan' ? t('두면 시간 끝에 <b>{n}</b>, 지우면 터지지 않고 이웃 칸 {k}명에게 빌린 생명 (최소 {p})', { n: n(e.dmg), k: e.n, p: pctT(e.loan.debt?.min ?? 0.3) }) : '',
    e?.p === 'jump' && e.on === 'quake' ? t('진동이 울리면 이웃 칸 아군에게 옮겨붙고 ×{m}, 지우면 사라짐', { m: e.mult })
      : e?.p === 'jump' ? (e.boost ? t('지우면 이웃 칸 아군 1명에게 {s} 옮겨붙고 초당 피해 ×{m} (옆에 아무도 없으면 사라짐), 두면 시간 끝에 보스 피해 +{p} (전투 끝까지)', { s: secT(e.sec), m: e.mult, p: pctT(e.boost) })
        : t('지우면 이웃 칸 아군 1명에게 {s} 옮겨붙고 초당 피해 ×{m} (옆에 아무도 없으면 사라짐)', { s: secT(e.sec), m: e.mult })) : '',
    d.vuln ? `${t('받는 피해 +{p}', { p: pctT(d.vuln) })}${d.stackMax ? ` ${t('중첩')}` : ''}` : '', d.swap ? t('{n}중첩이면 탱커 교대', { n: d.swap }) : '',
    d.sub ? t('탱커가 하나면 {n}중첩 때 근접 딜러가 {s} 대신 맞음', { n: d.swap ?? 0, s: secT(d.sub) }) : '',
    d.absorb ? t('치유 흡수 막 <b>{n}</b>: 받는 치유가 막을 먼저 깎고 그동안 체력은 안 참, 다 깎으면 사라짐', { n: n(d.absorb) }) : '',
    d.count ? t('내가 스킬을 쓸 때마다 1중첩 (지우는 그 한 번은 안 셈)') : '', e?.p === 'stackHit' ? t('끝나거나 지우면 중첩 × <b>{n}</b>', { n: n(e.dmg) }) : '',
    d.drain ? t('내 마나 초당 −{n}%', { n: d.drain }) : '',
    d.charm ? t('딜을 멈추고 {s}마다 이웃 칸 아군 <b>{n}</b>, 치유를 받을 때마다 +{h}, 체력 {p} 아래가 되면 풀림', { s: secT(d.charm.every), n: n(d.charm.dmg), h: secT(d.charm.heal), p: pctT(d.charm.free) }) : '',
    d.over ? t('이 사람에게 넘친 치유 × {n}만큼 이웃 칸 아군 피해', { n: d.over }) : '',
    d.swell ? t('{s}마다 1중첩 (최대 {m})', { s: secT(d.swell.every), m: d.swell.max }) : '',
    d.shell ? t('단단한 껍질 <b>{n}</b>: 최대 체력 {p} 넘는 직접 힐만 깎임 (작은 힐 · 지속 틱은 튕김), 두면 끝날 때 남은 막만큼 피해', { n: n(d.shell), p: pctT(d.shellMin ?? 0.25) }) : '',
    d.charge ? t('직접 힐 {k}번째에 방전: 본인 <b>{a}</b> · 이웃 칸 <b>{b}</b> (지속 힐 · 광역은 안 셈)', { k: d.charge.max, a: n(d.charge.self), b: n(d.charge.near) }) : '',
    e?.p === 'pop' ? t('지우면 이웃 칸 중첩 × <b>{a}</b>, 두면 끝날 때 본인 중첩 × <b>{b}</b> + 이웃 칸 중첩 × <b>{c}</b>', { a: n(e.pop), b: n(e.self), c: n(e.near) }) : '',
    d.cap != null ? t('치유로는 체력이 {p}까지만 참', { p: pctT(d.cap) }) : '', e?.p === 'flip' ? t('두면 끝날 때 체력 비율이 뒤집힘 (80% → 20%, 30% → 70%), 지우면 그냥 사라짐') : '',
    d.drop ? t('걸릴 때 <b>{n}</b>', { n: n(d.drop) }) : '', d.dropPct ? t('걸릴 때 최대 체력 {p} 깎임', { p: pctT(d.dropPct) }) : '',
    d.staunch ? t('봉합량 = 최대 체력 {a}, 실제로 회복할수록 출혈 (처음 초당 최대 체력 {b})이 줄고 다 채우면 멎음', { a: pctT(d.staunch.healPct), b: pctT(d.staunch.dotPct) }) : '',
    d.debt ? t('체력을 가득 채우고 채운 만큼 (최소 {a}) 빚, 초마다 +{b} (어둠물에 잠기면 2배), 끝나면 남은 빚만큼 피해 · 이 사람에게 넘친 치유가 빚을 갚음', { a: pctT(d.debt.min), b: pctT(d.debt.grow) }) : '',
    (e?.p === 'blast' || e?.p === 'trapHit') && e.debt ? t('빚진 사람이면 터질 때 남은 빚도 함께') : '',
    e?.p === 'pass' ? t('지우면 남은 막이 가장 건강한 아군에게 {s} 넘어감, 두면 끝날 때 남은 막만큼 피해', { s: secT(e.sec) }) : ''].filter(Boolean);
  // 종류 이름 (질병 · 독 · 마법 · 저주)은 지울 수 있을 때만. 물리 · 해제 안 됨은 「해제 안 됨」만 (2026-10-28 Lim 「물리가 무슨 뜻인지 모른다」)
  return `「${t(d.name)}」 (${dispellable(d) ? `${t(d.type)}, ` : ''}${secT(d.left)}${fx.length ? ` · ${fx.join(' · ')}` : ''})`;
}
/** 디버프 대응: 지울 수 있으면 해제, 아니면 버티기 */
const debuffHow = (d: DebuffDef) => (d.debt ? '가득 차 보여도 그 사람에게 힐해서 빚 갚기 (일찍 갚을수록 쌈). 빚보다 체력이 높으면 안 쓰러지니 바쁠 땐 버티기' : d.lock || d.trap ? '' : d.end?.p === 'flip' ? flipHow(d) : d.swell ? swellHow(d) : d.cap != null ? capHow(d) : d.end?.p === 'pass' ? passHow(d)
  : canDispel(S.hero, d.type) ? `${act('purify', RO)} 지우기` : cantDispel(d.type));
/** 새 부품 대응 (46 5장): 지울 수 있는지에 따라 */
const swellHow = (d: DebuffDef) => (canDispel(S.hero, d.type) ? `중첩이 적고 옆에 사람이 적을 때 ${act('purify', RO)} 지우기` : `못 지움. 터지기 전에 본인과 옆 칸 사람을 가득 채우기`);
const capHow = (d: DebuffDef) => (canDispel(S.hero, d.type) ? `큰 피해 예고가 뜨면 ${act('purify', RO)} 먼저 지우기` : `상한 위로는 힐이 안 들어감. 큰 피해 전에 보호막 · 지속 힐`);
/** 묶음 C 새 부품 (48 5장) */
const passHow = (d: DebuffDef) => (canDispel(S.hero, d.type) ? `낮은 사람에게 붙으면 ${act('purify', RO)} 지워 건강한 사람에게 넘기고, 그 사람 몸에서 힐로 녹이기` : `못 지움. 붙은 사람에게 힐을 몰아 막을 녹이기`);
const flipHow = (d: DebuffDef) => `끝날 때 체력이 높으면 낮아지니 힐을 멈추고, 낮으면 오히려 둠${canDispel(S.hero, d.type) ? `. 높을 때는 ${act('purify', RO)} 지우기` : ''}`;
/** 「으로 · 로」: ㄹ 받침도 「로」 (「역병 사슬」로) */
const roJ = (w: string) => { if (lang() !== 'ko') return ''; const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 && c % 28 !== 8 ? '으로' : '로'; };
/** 판에 나오는 적이 하는 일 (P-ADD): 때리기 · 오라 · 하는 일 · 쓰러질 때. 「: …」로 붙고, 하는 일이 없으면 빈 글 */
function addText(a: AddDef, c: GuideCtx): string {
  const { n } = c, j = a.job;
  const job = !j ? '' : j.p === 'mend' ? t('{s}마다 보스 체력 {p} 회복', { s: secT(j.every), p: j.pct < 0.01 ? `${+(j.pct * 100).toFixed(2)}%` : pctT(j.pct) })
    : j.p === 'bomb' ? `${t('{s} 안에 못 깨면 터져 전원 <b>{n}</b>', { s: secT(j.sec), n: n(j.dmg) })}${j.debuff ? ` + ${debuffText(j.debuff, n)}` : ''}`
    : j.p === 'pylon' ? t('서 있는 동안 보스가 받는 피해 −{p}', { p: pctT(j.cut) })
    : j.p === 'drain' ? t('살아 있는 동안 내 마나 초당 −{n}%', { n: j.pct })
    : j.p === 'smash' ? t('{s}마다 맡은 사람에게 {w} 예고 뒤 <b>{n}</b>', { s: secT(j.every), w: secT(j.warn), n: n(j.dmg) })
    : j.p === 'march' ? t('뒷줄에서 {s}마다 한 줄씩 다가와 앞줄을 넘으면 보스에게 흡수: 보스 피해 +{p} (전투 끝까지)', { s: secT(j.every), p: pctT(j.boost) })
    : j.p === 'fixate' ? t('탱커 아닌 1명을 노려 {s}마다 한 칸씩 다가가고, 붙으면 터져 그 사람 <b>{a}</b> + 이웃 칸 <b>{b}</b>', { s: secT(j.every), a: n(j.dmg), b: n(j.splash) })
    : j.p === 'sting' ? t('{s}마다 탱커 아닌 1명에게 <b>{n}</b> + {d}', { s: secT(j.every), n: n(j.dmg), d: debuffText(j.debuff, n) })
    : j.p === 'hatch' ? t('{s} 안에 못 깨면 알이 깨져 「{name}」{j} 나옴{rest}', { s: secT(j.sec), name: t(j.add.name), j: josa(j.add.name, '이', '가'), rest: addText(j.add, c) })
    : j.p === 'hoard' ? t('{s} 안에 못 깨면 보스가 주워 보스 피해 +{p} (전투 끝까지)', { s: secT(j.sec), p: pctT(j.boost) }) : '';
  const hit = a.dmg > 0 && j?.p !== 'sting' ? t('맡은 사람을 {s}마다 <b>{n}</b>', { s: secT(a.every), n: n(a.dmg) }) : '';
  const parts = [job, hit, a.aura ? t('이웃 칸에 선 사람 초당 <b>{n}</b>', { n: n(a.aura) }) : '', a.cleave ? t('떼라서 딜러 딜이 모두에게 같이 들어감') : '',
    a.down ? t('쓰러질 때 {who}에게 {d}', { who: a.down.p === 'burst' ? t('살아 있는 모두') : t('때리던 사람'), d: debuffText(a.down.debuff, n) }) : ''].filter(Boolean);
  return parts.length ? `: ${parts.join(' · ')}` : '';
}
/** 생명 사슬 쌍 수 (20인 물그림자 사슬, 51 4-3) */
const linkPairs = (e: Extract<SkillEffect, { p: 'link' }>, c: GuideCtx): number => (c.mythic && e.pairsMythic) || e.pairs || 1;
/** 예고 때 고르는 인원 (target: { n, nMythic }) */
const tgtN = (d: SkillDef, c: GuideCtx): number => (typeof d.target === 'object' ? (c.mythic && d.target.nMythic ? d.target.nMythic : d.target.n) : 1);
/** 기술 효과 → [무엇, 어떻게, 대상 칩]. 무엇은 세 언어 (tip으로 시트에 보임), 어떻게는 한국어 (안 보임) */
function effectText(d: SkillDef, e: SkillEffect | undefined, c: GuideCtx, ps: ProbeSkill | undefined): [string, string, Who?] {
  const { n } = c, hit = ps?.hitDmg ?? d.hitDmg ?? 0;
  const N = (k: number | undefined, m: number | undefined): number => (c.mythic && m ? m : k ?? 1);
  if (!e && d.fixed && d.cells?.p === 'ring') return [`${t('💓 판 가운데부터 바깥으로 박동이 {k}겹 퍼짐: 겹마다 0.5초 차이로 그 겹에 선 사람 모두 <b>{n}</b>', { k: d.cells.of, n: n(hit) })}${d.hitDebt ? ` · ${t('빌린 생명이 걸린 사람은 남은 빚 +{p}', { p: pctT(d.hitDebt) })}` : ''} ${t('(피할 수 없음)')}`, `가운데 사람부터 차례로 맞으니 ${act('poh', RO)} · ${act('renew', EUL)} 미리 채우기`];
  if (!e && d.fixed) {
    const row = d.cells?.p === 'line' ? d.cells.at : 'mid';
    const where = d.cells?.p === 'flow' ? t('세로 줄을 {n}초마다 한 줄씩 훑으며 그 줄에 선 사람', { n: d.cells.every }) : t('{row}에 선 사람', { row: t(ROW_NAME[row]) });
    return [`${t('{where} 모두 <b>{n}</b>', { where, n: n(hit) })}${d.hitDebuff ? ` + ${debuffText(d.hitDebuff, n)}` : ''} ${t('(피할 수 없음)')}`, `맞기 전에 그 줄을 ${act('poh', RO)} · ${act('renew', EUL)} 미리 채우기`, d.cells?.p === 'flow' ? undefined : WHO.row(row)];
  }
  if (!e && d.cells?.p === 'tide') {
    const rows = c.mythic && d.cells.rowsMythic ? d.cells.rowsMythic : d.cells.rows;
    return [`${t('🌊 판 아래 {rows}줄이 {s} 동안 어둠물에 잠김: 잠긴 칸에 선 사람은 <b>받는 치유 −{p}</b> (지속 힐 · 광역 힐도)', { rows, s: secT(d.dur ?? 0), p: pctT(TIDE_CUT) })}${d.dps ? ` · ${t('초당 <b>{n}</b>', { n: n(ps?.dps ?? d.dps) })}` : ''}. ${t('파티원은 위쪽 빈 칸으로 비키지만 빈 칸이 모자라면 남음')}${d.cells.islands ? `. ${t('🏝 잠길 줄 가운데 {k}칸은 물 위 섬 (안 잠김)', { k: (c.mythic && d.cells.islandsMythic) || d.cells.islands })}` : ''}`, '예고 동안 아래 줄 사람을 채우고, 잠긴 동안은 다른 사람 · 보호막, 물이 빠지면 몰아 채우기'];
  }
  if (!e) return d.cells ? [`${t('장판')}${d.hitDmg ? `: ${t('맞는 순간 그 칸 <b>{n}</b>', { n: n(hit) })}` : ''}${d.dps ? `${d.hitDmg ? ',' : ':'} ${t('안에 있으면 초당 <b>{n}</b>', { n: n(ps?.dps ?? d.dps) })}` : ''}${d.dur ? ` (${secT(d.dur)})` : ''}`, '파티원이 알아서 피함. 늦게 피하는 사람을 채우기', WHO.zone()] : ['', ''];
  switch (e.p) {
    case 'tank': { const P = { n: n(ps?.dmg ?? d.dmg ?? 0) }; return [`${d.target === 'offtank' ? t('보스를 안 맞는 탱커에게 <b>{n}</b> 피해', P) : t('탱커에게 <b>{n}</b> 피해', P)}${e.debuff ? ` + ${debuffText(e.debuff, n)}` : ''}`, e.debuff?.swap ? '교대한 탱커에게도 지속 힐을 걸어 두기' : '예고가 뜨면 탱커를 미리 가득 채우기', WHO.tank()]; }
    case 'hunt': { const k = N(e.n, e.nMythic); return [t('그 순간 체력 비율이 가장 낮은 탱커 아닌 {k}명에게 <b>{n}</b> 피해', { k, n: n(e.dmg) }), '예고 동안 가장 낮은 사람을 먼저 채우기', WHO.some(k)]; }
    case 'greed': { const k = tgtN(d, c); return [`${t('🎯 예고 때 체력 비율이 가장 높은 탱커 · 나 아닌 {k}명에게 <b>{n}</b> 피해', { k, n: n(e.dmg) })}${e.debuff ? ` + ${debuffText(e.debuff, n)}` : ''}`,
      `모두를 가득 채우면 누가 맞을지 모름. 예고된 사람에게 맞기 직전 ${act('guardian', EUL)} · 맞은 뒤 바로 힐`, WHO.some(k)]; }
    case 'thorns': return [t('🌵 {s} 동안 가시 갑옷: 보스를 때리는 사람이 한 대마다 <b>{n}</b> (탱커는 × {m}, 근접이 가장 자주 맞음)', { s: secT(e.sec), n: n(e.dmg), m: e.tank ?? 0.5 }), `탱커보다 딜러 줄을 예고 동안 ${act('renew', EUL)} · ${act('poh', RO)} 채우기`];
    case 'melt': return [t('{s} 동안 열기: 보호막이 초마다 {p}씩 녹고 외부 생존기 시간이 두 배로 빨리 줄어듦', { s: secT(e.sec), p: pctT(e.rate) }), `${act('guardian', EUL)} 미리 걸지 말고 큰 피해 예고 직전에. ${act('renew', EUL)}은 미리`];
    case 'all': return [`${t('파티 전원에게 <b>{n}</b> 피해', { n: n(e.dmg) })}${e.debuff ? ` + ${debuffText(e.debuff, n)}` : ''}`, `예고 동안 ${act('renew', EUL)} 미리 걸고, 맞은 뒤 ${act('poh', RO)} 채우기`, WHO.all()];
    case 'debuff': { const dd = debuffText(e.debuff, n); if (e.n === 'all') return [t('모두에게 {d}', { d: dd }), debuffHow(e.debuff), WHO.all()]; const k = N(e.n, e.nMythic); return [t('{k}명에게 {d}', { k, d: dd }), debuffHow(e.debuff), WHO.some(k)]; }
    case 'rot': return [t('{k}명 최대 체력 −{p} 중첩 (최대 {m}) {d}', { k: e.n, p: pctT(e.pct), m: e.max, d: debuffText(e.debuff, n) }), debuffHow(e.debuff), WHO.some(e.n)];
    case 'pull': return [`${t('뒷줄 1명을 보스 앞으로 끌어옴. {s} 동안 평타를 탱커와 번갈아 맞음 (한 대에 <b>{n}</b>)', { s: secT(e.sec), n: n(e.dmg) })}${e.pad ? `. ${t('그 칸에 받침: 끝에 위 사람 <b>{a}</b>, 비어 있으면 전원 <b>{b}</b>', { a: n(e.pad.dmg), b: n(e.pad.empty) })}` : ''}`,
      e.pad ? '끌려온 사람을 받침 끝까지 세워 두기 (탱커와 묶어 광역, 울림 직전 단일 힐)' : `끌려온 사람이 탱커 옆이라 ${act('poh', RO)} 둘을 한 번에 채우기`, WHO.some(1)];
    case 'drag': return [t('🌊 예고 때 고른 {who}을 잠긴 줄로 끌어내려 {s} 묶어 둠 + <b>{n}</b> (잠긴 칸이면 받는 치유 −{p})', { who: targetWho(d, c), s: secT(e.sec), n: n(e.dmg), p: pctT(TIDE_CUT) }), '예고 동안 찍힌 사람을 90% 위로. 끌려간 뒤에는 보호막 · 지속 힐', targetChip(d, c)];
    case 'adds': return [`${t('「{name}」 {k}마리 등장', { name: t(e.add.name), k: N(e.n, e.nMythic) })}${addText(e.add, c)}`, '딜러가 잡음. 맞는 사람을 채우기'];
    case 'hole': return [t('가장자리 바닥 {k}칸이 무너져 전투 끝까지 못 서는 칸이 됨 (모두 {m}칸까지)', { k: e.n, m: e.max }), '파티원이 알아서 비킴'];
    case 'order': { const k = N(e.n, e.nMythic); return [`${t('{k}명 칸에 번호. {s} 안에 번호 순서대로 단일 힐 → 보스 {d} 멍함 (기술을 쉬고 받는 피해 ×{v})', { k, s: secT(e.sec), d: secT(e.daze.sec), v: e.daze.vuln })}. ${c.diff === '쉬움' ? t('순서가 틀리면 처음부터') : t('순서가 틀리면 그 사람 <b>{n}</b> + 처음부터', { n: n(e.wrong) })}, ${t('시간이 다 되면 못 받은 사람마다 <b>{n}</b>', { n: n(e.miss) })}${e.fake ? `. ${t('🌫 하나는 신기루 숫자 (시작 {s} 뒤 걷힘, 그 전에 힐하면 틀림)', { s: secT(e.fake.at) })}` : ''}${c.mythic && e.wrongAll ? `. ${t('틀리면 전원 <b>{n}</b>', { n: n(e.wrongAll) })}` : ''}`,
      e.fake ? '①부터 시작하고, 같은 번호가 둘이면 걷힐 때까지 기다렸다가 진짜에게' : '번호 순서대로 한 번씩 힐 넣기', WHO.some(k)]; }
    case 'jail': { const k = N(e.n, e.nMythic); return [t('탱커 · 나 아닌 {k}명을 「{name}」에 가둠: 딜 0 · 못 움직임 · 초당 <b>{n}</b> (해제 안 됨). 딜러가 감옥 (체력 보스의 {p})을 깨면 풀림', { k, name: t(e.name), n: n(e.dot), p: pctT(e.hp) }), '딜러가 감옥을 깰 때까지 갇힌 사람을 채우기', WHO.some(k)]; }
    case 'beat': return [`${t('💓 심장이 크게 뜀: 시전 · 집중 중인 힐이 끊기고 시전 스킬이 {s} 잠김', { s: secT(c.mythic && e.secMythic ? e.secMythic : e.sec) })}${e.dmg ? ` + ${t('전원 <b>{n}</b>', { n: n(e.dmg) })}` : ''}`, '예고가 뜨면 새 시전을 시작하지 않기. 잠긴 동안은 즉시 스킬 · 지속 힐 · 보호막'];
    case 'quake': return [t('시전 중인 힐이 끊기고 그 스킬 {s} 잠김 + 전원 <b>{n}</b>', { s: secT(e.lock), n: n(e.dmg) }), '예고가 뜨면 새 시전을 시작하지 않기 (즉시 스킬 · 지속 힐)'];
    case 'rest': return [t('{s} 동안 기술을 쉼', { s: secT(e.sec) }), '그동안 마나를 아끼며 채우기'];
    case 'clear': return [t('「{name}」이 모두에게서 사라짐', { name: t(e.name) }), ''];
    case 'stagger': return [t('{s} 안에 게이지 채우기: 체력 {p} 이상인 파티원의 딜만 셈. 채우면 보스가 {w} 무방비 (기술을 쉬고 받는 피해 ×{v}), 못 채우면 전원 <b>{n}</b> + 시전 스킬 {l} 잠김', { s: secT(e.sec), p: pctT(c.mythic && e.hpMythic != null ? e.hpMythic : e.hp), w: secT(e.win.sec), v: e.win.vuln, n: n(e.fail.dmg), l: secT(e.fail.lock) }), '딜러 체력을 높게 유지'];
    case 'counter': return [t('끊기 능력으로 끊으면 보스 {s} 기절, 못 끊으면 앞줄 <b>{n}</b>', { s: secT(e.stun), n: n(e.dmg) }), '앞줄을 미리 채우기'];
    case 'tower': return [t('발판 {k}곳: 위 사람 <b>{a}</b>, 빈 발판마다 전원 <b>{b}</b>', { k: e.n, a: n(e.dmg), b: n(e.empty) }), '발판에 선 사람을 채워 끝까지 세워 두기'];
    case 'cycle': {
      if (e.random) {
        const k = N(e.n, e.nMythic), len = e.debuffs.length, one = len === 3 ? t('셋 중 하나') : len === 2 ? t('둘 중 하나') : len === 4 ? t('넷 중 하나') : t('{n}개 중 하나', { n: len });
        return [t('탱커 아닌 {k}명에게 {one}: {list}', { k, one, list: e.debuffs.map(x => debuffText(x, n)).join(' / ') }), '칸 위 모자를 보고 다르게: 뒤집힘은 힐 멈춤 · 상한은 지우거나 보호막 · 완치는 몰아서 채우기', WHO.some(k)];
      }
      const list = [...new Map(e.debuffs.map(x => [x.name + x.type, x])).values()].map(x => debuffText(x, n)).join(' → ');
      return [`${e.each ? t('{k}명이 하나씩 다른 디버프', { k: e.n }) : t('{k}명에게 쓸 때마다 다음 디버프', { k: e.n })}: ${list}`, '지울 수 있는 것부터 지우기', WHO.some(e.n)];
    }
    case 'ring': { const k = N(e.n, e.nMythic); return [t('탱커 아닌 {k}명 발밑에 고리 {s} (안에 있으면 초당 <b>{n}</b>). 안에서 치유를 받으면 한 겹 자람 (최대 {m}겹)', { k, s: secT(e.sec), n: n(zoneDps(RULES, e.dps)), m: c.mythic && e.maxMythic != null ? e.maxMythic : e.max }),
      '고리 안 사람은 걸어 나올 때까지 힐을 미루기 (위급하면 예외). 광역 힐은 고리를 피해서', WHO.some(k)]; }
    case 'soul': { // 놓쳤을 때: 피해 · 디버프 · 보스 피해 (끝까지 · 잠깐) · 보스가 받는 피해 감소
      const fl = e.fail, dd = fl.debuff ? debuffText(fl.debuff, n) : '', hits = [
        fl.dmg > 0 ? (fl.near ? t('이웃 칸에게 <b>{n}</b> 피해', { n: n(fl.dmg) }) : t('전원에게 <b>{n}</b> 피해', { n: n(fl.dmg) })) : '',
        fl.debuff ? (fl.dmg > 0 ? dd : fl.near ? t('이웃 칸에 {d}', { d: dd }) : t('모두에게 {d}', { d: dd })) : '',
        fl.boost ? t('보스 피해 +{p} (끝까지 쌓임)', { p: pctT(fl.boost) }) : '',
        fl.rage ? t('{s} 동안 적 피해 +{p}', { s: secT(fl.rage.sec), p: pctT(fl.rage.pct) }) : '',
        fl.guard ? t('{s} 동안 보스가 받는 피해 −{p}', { s: secT(fl.guard.sec), p: pctT(fl.guard.pct) }) : '',
      ].filter(Boolean);
      return [`${(e.n ?? 1) > 1 ? t('빈 칸에 「{name}」 {k}개', { name: t(e.name), k: e.n! }) : t('빈 칸에 「{name}」', { name: t(e.name) })}. ${t('{s} 안에 단일 힐로 가득 채우면 {win}. 못 채우면 {fail}', { s: secT(e.sec), win: t(e.win.text), fail: t(fl.text) })}${hits.length ? `: ${hits.join(' + ')}` : ''}`, `영혼 칸에 ${act('heal', EUL)} 넣기${(e.n ?? 1) > 1 ? ' (낮은 칸부터 돌아가며)' : ''}`];
    }
    case 'link': {
      const pairs = linkPairs(e, c), subj = pairs > 1 ? t('{k}쌍을', { k: pairs }) : e.pick === 'tanks' ? t('두 탱커를') : t('두 사람을');
      return [`${t('{subj} 「{name}」{j} {s} 이음 (해제 안 됨)', { subj, name: t(e.name), j: roJ(e.name), s: secT(e.sec) })}: ${e.kind === 'balance'
        ? t('두 사람 체력 비율 차이가 {p} 넘게 벌어지면 사슬이 끊어지며 둘 다 <b>{n}</b>', { p: pctT(e.gap ?? 0.3), n: n(e.dmg ?? 0) })
        : t('이어진 둘이 받는 피해 · 치유를 반씩 나눔 (한쪽만 힐해도 둘 다 참)')}`, e.kind === 'balance' ? '두 사람 체력 비율을 비슷하게' : '둘이 피해 · 치유를 나눔', pairs > 1 ? undefined : e.pick === 'tanks' ? WHO.tank() : WHO.some(2)];
    }
    case 'vessel': return [t('「{name}」: {s} 동안 넘친 치유가 모임 (끝 = 파티 최대 체력 합의 {p}). 못 채우면 깨지며 전원에게 <b>{n}</b> 피해 (덜 찬 비율만큼: 반만 찼으면 절반). 가득 차면 피해 없음', { name: t(e.name), s: secT(e.sec), p: pctT(e.need), n: n(e.dmg) }), '일부러 넘치게 힐하기'];
    case 'auto': return [t('탱커에게 {n}', { n: n(e.dmg) }), '', WHO.tank()];
    case 'share': return [t('🎯 대상과 이웃 칸 아군이 <b>{n}</b>를 인원 수로 나눠 받음 (혼자면 그대로)', { n: n(e.dmg) }), '가까운 파티원이 모임. 대상을 미리 채우고, 모인 칸에 광역 힐'];
    case 'trade': return [t('두 탱커의 「{name}」 중첩이 서로 바뀜', { name: t(e.name) }), '바뀐 뒤 바로 교대가 오니 두 탱커 모두 채워 두기', WHO.tank()];
    case 'slow': return [t('{s} 동안 내 시전 시간 ×{m}', { s: secT(e.sec), m: e.mult }), '그동안 즉시 스킬 · 지속 힐로 버티기'];
    case 'empower': return [t('보스 피해 +{p} (끝까지 쌓임)', { p: pctT(e.boost) }), '오래 끌수록 아파짐. 쿨기를 이때 쓰기'];
    case 'strike': { const k = tgtN(d, c); return [`${t('🎯 예고 때 고른 {k}명에게 <b>{n}</b> 피해', { k, n: n(e.dmg) })}${e.debuff ? ` + ${debuffText(e.debuff, n)}` : ''}`, '예고된 사람을 미리 채우기', WHO.some(k)]; }
    case 'glass': return [`${t('모래시계를 뒤집음: 그 순간 체력으로 {s} 뒤 모두 되돌아감 (그 사이 받은 피해도 넣은 힐도 사라짐)', { s: secT(e.sec) })}${e.absorbHit ? `. ${t('그때 치유 흡수 막이 남은 사람은 <b>{n}</b>', { n: n(e.absorbHit) })}` : ''}`,
      `뒤집기 전에 모두 채우기. 창 안에서는 쓰러질 사람만 힐 (막 벗기기 · 해제는 남음)`];
    case 'lift': return [`${t('🌪 예고 때 고른 {who}이 {s} 동안 하늘로 떠오름: 새 힐 · 해제가 안 닿고 미리 건 지속 힐 · 보호막 · 나눔 사슬 몫만 남음. 내려올 때 <b>{n}</b>', { who: targetWho(d, c), s: secT(e.sec), n: n(c.mythic && e.fallMythic != null ? e.fallMythic : e.fall) })}${e.chain ? ` + ${t('그 자리에서 연쇄 번개 <b>{n}</b> ({k}번까지 튐)', { n: n(e.chain.dmg), k: e.chain.jumps })}` : ''}${e.land === 'random' ? ` · ${t('무작위 빈 칸에 내려앉음')}` : ''}`,
      `예고 동안 ${act('renew', EUL)} · 해제를 먼저. 떠 있는 동안은 다른 사람 (사슬 짝이 있으면 짝을 힐), 내려오면 바로 힐`, targetChip(d, c)];
    case 'chain': return [t('⚡ 예고 때 고른 {who}에게 번개 <b>{n}</b>. 이웃 칸 가운데 체력 비율이 가장 낮은 사람에게 튀며 +{g}씩 ({k}번까지). 체력 {p} 이상이거나 보호막이 있는 이웃은 피뢰침: 절반만 받고 멈춤', { who: targetWho(d, c), n: n(e.dmg), g: pctT(e.grow ?? CHAIN_GROW), k: c.mythic && e.jumpsMythic ? e.jumpsMythic : e.jumps, p: pctT(ROD_HP) }),
      `예고 동안 번개 구름 옆 사람을 ${pctT(ROD_HP)} 위로 (가장 낮은 사람부터) · 보호막`, targetChip(d, c)];
  }
}
/** 예고 때 고르는 사람 (띄워 올리기 · 연쇄 번개) */
function targetWho(d: SkillDef, c: GuideCtx): string {
  const tg = d.target;
  if (typeof tg !== 'object') return tg === 'tank' ? t('탱커') : tg === 'offtank' ? t('보스를 안 맞는 탱커') : t('1명');
  return tg.p === 'linked' ? t('사슬 짝마다 1명') : tg.p === 'pad' ? t('받침 위 사람') : nPeople(c.mythic && tg.nMythic ? tg.nMythic : tg.n);
}
/** 예고 때 고르는 사람의 대상 칩 (보스를 안 맞는 탱커 · 받침 위 사람은 칩 없음) */
function targetChip(d: SkillDef, c: GuideCtx): Who | undefined {
  const tg = d.target;
  if (typeof tg !== 'object') return tg === 'tank' ? WHO.tank() : tg === 'offtank' ? undefined : WHO.some(1);
  return tg.p === 'linked' ? WHO.some(1) : tg.p === 'pad' ? undefined : WHO.some(c.mythic && tg.nMythic ? tg.nMythic : tg.n);
}
/** 신기루 (P-MIRAGE, 54 5장) 한 줄 */
function mirageText(d: SkillDef, c: GuideCtx): string {
  const m = d.mirage!, s = secT(m.reveal ?? 1);
  if (m.chance != null) return t('🌫 {p}는 신기루: 맞기 {s} 전에 걷히면 안 맞음', { p: pctT(m.chance), s });
  const k = c.mythic && m.nMythic ? m.nMythic : m.n ?? 1;
  return d.target ? t('🌫 신기루: 가짜 {k}명이 함께 보이다가 맞기 {s} 전에 걷힘', { k, s }) : t('🌫 신기루: 가짜 {k}곳이 함께 보이다가 맞기 {s} 전에 걷힘', { k, s });
}
/** 기술이 도는 때 (페이즈 · 체력 문턱) */
function whenText(d: SkillDef): string {
  const w = d.when;
  if (w?.hpBelow != null) return t('체력 {p} 아래', { p: pctT(w.hpBelow) });
  if (w?.phase && !w.phase.includes(1)) return t('{p}페이즈', { p: w.phase.join('·') });
  return '';
}
function dataGuide(c: GuideCtx): GuideBody {
  const def = BOSSES[c.enc.script as Exclude<ScriptKey, 'trash'>], { sk } = c;
  // 대기열에 안 보이는 기술도 공략 글(how)이 있으면 공략에 (가시 중첩 · 짙어지는 저녁)
  const hard = hardOn(c.diff) ? def.hard : undefined; // 어려움 변화 (111 공통 ②): 바뀐 값으로 보여 줌
  const shown = def.skills.filter(d => (!d.hidden || d.how) && (d.when?.mythic == null || d.when.mythic === c.mythic) && inVariant(d.when, c.variant)).map(d => mythicDef(hardDef(d, hard), c.mythic ? def.mythicStep : undefined));
  const phases: GuidePhase[] = [{ id: 'p1', name: t('시작'), at: t('처음부터'), text: shown.filter(d => !whenText(d)).map(d => t(d.name!)).join(' · ') }];
  // 체력 문턱 · 페이즈 흐름: 문턱마다 한 줄
  const marks = new Map<number, string[]>();
  for (const d of shown) if (d.when?.hpBelow != null) marks.set(d.when.hpBelow, [...(marks.get(d.when.hpBelow) ?? []), t('{s} 더해짐', { s: iga(t(d.name!)) })]);
  for (const st of def.flow ?? []) if (st.p === 'when' && st.if.hpBelow != null && (st.if.mythic == null || st.if.mythic === c.mythic) && inVariant(st.if, c.variant)) {
    const tx = st.do.find(x => x.p === 'text') as { text: string } | undefined;
    if (tx) marks.set(st.if.hpBelow, [t(tx.text)]); // 흐름 글 (boss-parts 사전)
  }
  for (const [at, txt] of [...marks].sort((a, b) => b[0] - a[0])) phases.push({ id: `h${at}`, name: txt[0].split(/[:：]/)[0], at: t('체력 {p} 아래', { p: pctT(at) }), text: txt.join(' · ') });
  if (isFinite(c.enc.enrage)) phases.push(enragePhase(c));
  const skills: GuideSkill[] = shown.map(d => {
    const ps = sk[d.key], [what0, how0, who] = effectText(d, d.effect, c, ps), wt = whenText(d);
    const what = d.mirage ? `${what0}. ${mirageText(d, c)}` : what0;
    const every = `${wt ? `${wt} · ` : ''}${everyT(d.period)}`;
    return { ic: d.icon ?? d.name!.slice(0, 2), name: t(d.name!), art: bossSkillArt(c.enc, d), who, when: `${wt ? `${wt}부터 · ` : `${secT((d.first ?? 0) + d.cast)}에 첫 타, 그 뒤 `}${secT(d.period)}마다${d.cast ? ` · 예고 ${secT(d.cast)}` : ''}${d.cut ? ' · 끊기 ✋' : ''}${hard?.skill === d.key ? ' · 어려움 변화' : ''}${c.mythic && def.mythicStep?.skill === d.key ? ' · 악몽 변화' : ''}`,
      what, how: d.how ?? (how0 || undefined), every, tip: () => [what.replace(/<\/?b>/g, '')] };
  });
  skills.push(enrageSkill(c));
  const thresholds = [...marks.keys()].sort((a, b) => a - b);
  return {
    nums: {}, phases, skills,
    cur: F => { if (F.enraged) return 'enrage'; const r = F.bossHp / F.bossMax, at = thresholds.find(x => r <= x); return at != null ? `h${at}` : 'p1'; },
  };
}

export type GuideModel = GuideBody & { enc: Encounter; diff: DiffName; m: number; dodge: number; bossMax: number; hp: Probe['hp']; tier: string; B: Record<string, Num> };
export function guideModel(encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number, variant = 0): GuideModel {
  const enc = { ...ENCOUNTERS[encKey], enrage: enrageOf(encKey, diff) }, P = probe(encKey, diff, stageLv, heroLv, variant); // 광폭화는 난이도마다 (data/pace)
  const m = P.m, n = (x: number) => Math.round(x * m);
  const B = bossNums(enc.script);
  const g = (GUIDE[enc.script] ?? dataGuide)({ enc, diff, m, n, mythic: diff === '악몽', sk: P.sk, hp: P.hp, B, hpMult: P.bossMax / enc.hp, variant });
  return Object.assign({ enc, diff, m, dodge: DIFFS[diff].dodge, bossMax: P.bossMax, hp: P.hp, tier: t(enc.tier).replace(' · ', ' '), B }, g);
}
// 지금 돌고 있는 기술인지 (일시정지에서 '지금' 표시): 엔진 기술 상태 그대로 읽음
export function skillLive(F: Fight, ic: string): boolean {
  if (ic === '쥐떼') return F.phase === 0 && F.phaseName === '인터미션';
  if (ic === '노래') return F.enc.script === 'choir' && F.phase === 1;
  return F.skills.some(s => s.icon === ic && !s.hidden && s.next !== Infinity && s.active(F));
}
/** 짧은 설명의 피해 숫자를 굵게 (「481 피해」 · 「초당 99」, 영어 「481 damage」 · 「99 per sec」, 일본어 「481ダメージ」 · 「毎秒99」) */
const BOLD: Record<string, [RegExp, RegExp, string]> = {
  ko: [/(\d[\d,.]*(?:~\d[\d,.]*)?)(?= ?피해)/g, /초당 (\d[\d,.]*)/g, '초당 <b>$1</b>'],
  en: [/(\d[\d,.]*(?:~\d[\d,.]*)?)(?= damage)/g, /(\d[\d,.]*) per sec/g, '<b>$1</b> per sec'],
  ja: [/(\d[\d,.]*(?:~\d[\d,.]*)?)(?=ダメージ)/g, /毎秒(\d[\d,.]*)/g, '毎秒<b>$1</b>'],
};
const boldNums = (s: string) => { const [dmg, dps, dpsTo] = BOLD[lang()]; return s.replace(dmg, '<b>$1</b>').replace(dps, dpsTo); };
export function guideHtml(g: GuideModel, F: Fight | null): string {
  const cur = F ? g.cur(F) : null;
  const now = `<em class="now">${t('지금')}</em>`;
  const trash = g.enc.script === 'trash';
  const head = `<div class="gd-top"><div class="gd-art">${bossSvg(g.enc.script, g.enc.key)}</div><div class="gd-id">
    <b class="gd-name">${t(g.enc.name)}</b>
    <div class="gd-tags"><span class="tag">${g.tier}</span><span class="tag diff">${t(g.diff)}</span>${isFinite(g.enc.enrage) ? `<span class="tag enr">${t('광폭화')} ${mmss(g.enc.enrage)}</span>` : ''}</div></div></div>`;
  // 진행: 번호 점을 세로 줄로 이음 (잡몹 구간은 잡는 순서)
  const phases = `<section class="gd-sec"><h4 class="gd-h">${trash ? t('잡는 순서') : t('진행')}</h4><ol class="gd-phases">${g.phases.map((p, i) => `<li class="${p.id === cur ? 'cur' : ''}${p.enr ? ' enr' : ''}"><i>${i + 1}</i><div><p class="gd-ph"><b>${p.name}</b><small>${p.at}</small></p><p>${p.text}</p></div>${p.id === cur ? now : ''}</li>`).join('')}</ol></section>`;
  // 기술: 아이콘 · 이름 · 주기 / 대상 칩 + 짧은 설명 (피해 숫자 굵게). 대처(how)는 시트에 안 보임 (Lim 2026-10-12 「대처 줄 모두 빼기」)
  const skills = `<section class="gd-sec"><h4 class="gd-h">${trash ? t('적 기술') : t('보스 기술')}</h4><div class="gd-skills">${g.skills.map(s => {
    const live = F && skillLive(F, s.ic);
    // 기술 그림이 있으면 그림 + 색 테두리, 없으면 색 바탕 글자 아이콘 (37 1장)
    const img = s.art ? skillArtImg(s.art) : '';
    const ic = img ? `<span class="ic art" style="border-color:${iconColor(s.ic)}">${img}</span>` : `<span class="ic" style="background:${iconColor(s.ic)}">${glyphOf(s.ic, s.name)}</span>`;
    const who = s.enr ? { k: 'enr', t: t('전원') } : s.who ?? null;
    return `<article class="gs${s.enr ? ' enr' : ''}${live ? ' live' : ''}" data-ic="${s.ic}"><header>${ic}<span class="gs-id"><b>${s.name}</b><small class="gs-every">${s.every}</small></span>${live ? now : ''}${who ? `<span class="gs-who ${who.k}">${who.t}</span>` : ''}</header>
      <p class="gs-line">${boldNums(s.tip(F)[0])}</p></article>`;
  }).join('')}</div></section>`;
  return `<div class="gd">${head}${phases}${skills}</div>`;
}