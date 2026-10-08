/**
 * 보스 공략 (전투 전 화면 · 일시정지 · 전투 중 기술 팝업 · 휴식이 모두 이 한 곳의 데이터를 씀).
 * 프로토타입 v11 화면에서 옮김.
 */
import type { DiffName } from '../data/difficulty';
import { DIFFS } from '../data/difficulty';
import { ENCOUNTERS, mobGrade, type Encounter, type EncounterKey, type ScriptKey } from '../data/encounters';
import { canDispel, HEROES } from '../data/heroes';
import { SKILLS } from '../data/skills';
import { create, type Fight, type Role } from '../engine';
import { CHOIR } from '../engine/bosses';
import { bossSvg } from './art';
import { ARROW, heroSkill, ICON_COLOR, iga, josa, mmss, READ_ORDER, S, secT } from './core';

// 숫자는 엔진에서 읽는다: 기술 이름·아이콘·첫 시각·주기·예고·탱커 피해·장판 초당 피해/지속은 시험 전투(E.create)의 skills에서,
// 피해 배율·회피는 E.DIFFS에서, 보스·파티 체력(악몽 배율 포함)은 시험 전투에서.
// 기술 함수 안쪽 숫자처럼 엔진 밖으로 안 나오는 값만 GB에 옮겨 적음 → engine.js SCRIPTS를 바꾸면 여기도 같이 (guide.js가 엔진과 대조함)
type Num = any;
const GB: Record<ScriptKey, Record<string, Num>> = {
  warden: { auto: 70, aoe: 220, zoneAt: 0.4, enrName: '증기 폭주', enrDmg: 220, enrPeriod: 2, enrCast: 1 },
  scrap: { auto: 75, aoe: 170, enrName: '고철 폭주', enrDmg: 150, enrPeriod: 2, enrCast: 1 },
  trash: {},
  plague: {
    auto: 60, breathPct: 5, breathMax: 4, breathDur: 60, stingDot: 15, stingDur: 12, pulse1: 150, pulse2: 180, pulse2Period: 25, pulse2Delay: 22,
    interAt: 0.6, interDur: 25, rats: 30, contDelay: 10, contDur: 8, spread: 150, p3At: 0.3,
    targets: { breath: 2, cont: [1, 2], rats: 3 }, // cont = [보통, 악몽] — 10인 악몽은 전염 2명 동시 (26 3-1)
    enrName: '역병 폭주', enrDmg: 180, enrPeriod: 3, enrCast: 1,
  },
  choir: { ...CHOIR, enrName: '대합창', enrDmg: 200, enrPeriod: 3, enrCast: 1 },
};
interface ProbeSkill { name: string; icon: string; next: number; period: number; cast: number; dmg: number; dps: number; dur: number }
interface Probe { sk: Record<string, ProbeSkill>; m: number; bossMax: number; hp: { tank: number; dps: number; me: number } }
const probeCache: Record<string, Probe> = {};
/** 시험 전투 하나로 숫자를 읽음. 단계 레벨 배율(24 10장)을 넣어야 레이드 숫자가 전투와 같음 */
function probe(encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number): Probe {
  const k = `${encKey}|${diff}|${stageLv ?? 1}|${heroLv ?? ''}`;
  if (!probeCache[k]) {
    const f = create({ encounter: encKey, diff, seed: 1, stageLv, heroLv });
    const sk: Record<string, ProbeSkill> = {};
    for (const s of f.skills) sk[s.key] = { name: s.name ?? '', icon: s.icon ?? '', next: s.next, period: s.period, cast: s.cast, dmg: s.dmg ?? 0, dps: s.dps ?? 0, dur: s.dur ?? 0 };
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
  const nm = SKILLS[heroSkill(slot)].name, d = READ_ORDER.find(x => S.layout[x] === slot);
  return `${nm}${d ? `(${ARROW[d]} 쓸기)` : ''}${p ? josa(nm, p[0], p[1]) : ''}`;
}
const EUL: [string, string] = ['을', '를'], RO: [string, string] = ['으로', '로'];
/** 독처럼 지금 직업이 못 지우는 디버프의 대응 */
const cantDispel = (type: string) => `${HEROES[S.hero].name}${josa(HEROES[S.hero].name, '은', '는')} ${type}${josa(type, '을', '를')} 못 지움. ${act('renew', EUL)} 걸고 ${act('heal', RO)} 버티기`;
const ENRAGE_HOW = '버티는 기술이 아님. 그 전에 잡으려면 딜러가 쓰러지지 않게';

interface GuideCtx { enc: Encounter; diff: DiffName; m: number; n: (x: number) => number; mythic: boolean; sk: Record<string, ProbeSkill>; hp: Probe['hp']; B: Record<string, Num>; hpMult: number }
export interface GuidePhase { id: string; name: string; at: string; text: string; enr?: boolean }
export interface GuideSkill { ic: string; name: string; enr?: boolean; when?: string; what: string; how?: string; every: string; tip: (F?: Fight | null) => string[] }
interface GuideBody { nums: Record<string, Num>; cur: (F: Fight) => string; phases: GuidePhase[]; skills: GuideSkill[] }

const GUIDE: Record<ScriptKey, (c: GuideCtx) => GuideBody> = {
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
        { id: 'p1', name: '시작', at: '처음부터', text: `${bu.name} · ${ao.name} 반복` },
        { id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true },
      ],
      skills: [
        { ic: bu.icon, name: bu.name,
          what: `탱커에게 <b>${N.buster}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.buster, hp.tank)}%)`,
          every: `${secT(bu.period)}마다`, tip: () => [`탱커에게 ${N.buster} 피해를 줍니다.`] },
        { ic: ao.icon, name: ao.name,
          what: `파티 전원에게 <b>${N.aoe}</b> 피해`,
          every: `${secT(ao.period)}마다`, tip: () => [`파티 전원에게 ${N.aoe} 피해를 줍니다.`] },
        { ic: '광폭', name: B.enrName, enr: true,
          what: `파티 전원에게 <b>${N.enr}</b> 피해`,
          every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 파티 전원에게 ${N.enr} 피해를 줍니다.`] },
      ],
    };
  },
  // 일반·정예 구간 (23 2장): 잡는 순서 = 진행, 적 공격 = 기술
  trash(c) {
    const { enc, n } = c;
    const mobs = enc.mobs!;
    const skills: GuideSkill[] = [];
    for (const m of mobs) for (const a of m.attacks) {
      const who = a.to === 'tank' ? '탱커' : a.to === 'other' ? '탱커 아닌 1명' : '파티 전원';
      const amt = a.jitter ? `${n(a.dmg * (1 - a.jitter))}~${n(a.dmg * (1 + a.jitter))}` : n(a.dmg);
      const each = m.count > 1 ? ' (한 마리당)' : '';
      skills.push({ ic: a.icon || m.name.slice(0, 2), name: a.name || `${m.name} 공격`,
        what: `${who}에게 <b>${amt}</b> 피해${each}${a.cast ? ` · 예고 ${secT(a.cast)}` : ''}. ${m.name}${josa(m.name, '이', '가')} 쓰러지면 멈춤`,
        every: `${secT(a.period)}마다`, tip: () => [`${who}에게 ${m.count > 1 ? '한 마리당 ' : ''}${amt} 피해를 줍니다.`] });
    }
    return {
      nums: {},
      cur: F => { const m = F.mobs.find(x => x.alive); return m ? 'm' + mobs.findIndex(d => d.name === m.name) : ''; },
      phases: mobs.map((m, i) => ({ id: 'm' + i, name: `${m.name}${m.count > 1 ? ` ×${m.count}` : ''}`, at: `${mobGrade(m)} · ${i + 1}번째로 잡음`, text: `체력 ${Math.round(m.hp * c.hpMult).toLocaleString('ko-KR')}${m.count > 1 ? '씩' : ''}` })),
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
        { id: 'p1', name: '시작', at: `체력 100~${B.zoneAt * 100}%`, text: `${bu.name} · ${ao.name} 반복` },
        { id: 'p40', name: '녹이 흘러내림', at: `체력 ${B.zoneAt * 100}% 아래`, text: `${iga(zo.name)} 더해짐` },
        { id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true },
      ],
      skills: [
        { ic: bu.icon, name: bu.name,
          when: `${secT(bu.next + bu.cast)}에 첫 타, 그 뒤 ${secT(bu.period)}마다 · 예고 ${secT(bu.cast)}`,
          what: `탱커에게 <b>${N.buster}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.buster, hp.tank)}%)`,
          how: `예고가 뜨면 탱커를 미리 가득 채우기. 못 채우면 ${act('guardian', EUL)} 걸어 한 번 버티기`,
          every: `${secT(bu.period)}마다`, tip: () => [`탱커에게 ${N.buster} 피해를 줍니다.`] },
        { ic: ao.icon, name: ao.name,
          when: `${secT(ao.next + ao.cast)}에 첫 타, 그 뒤 ${secT(ao.period)}마다 · 예고 ${secT(ao.cast)}`,
          what: `파티 전원에게 <b>${N.aoe}</b> 피해 (파티원 체력 ${hp.dps}의 ${pct(N.aoe, hp.dps)}%)`,
          how: `예고 동안 여러 명에게 ${act('renew', EUL)} 걸고, 맞은 뒤 ${act('poh', RO)} 모인 칸을 채우기`,
          every: `${secT(ao.period)}마다`, tip: () => [`파티 전원에게 ${N.aoe} 피해를 줍니다.`] },
        { ic: zo.icon, name: zo.name,
          when: `보스 체력 ${B.zoneAt * 100}% 아래부터 · ${secT(zo.period)}마다 · 예고 ${secT(zo.cast)}`,
          what: `파티원 1명 자리와 옆 칸에 ${secT(zo.dur)} 장판. 안에 있으면 초당 <b>${N.zoneDps}</b> (다 맞으면 ${N.zoneTot})`,
          how: '파티원이 알아서 피함. 고집불통·허세꾼은 잘 안 피하니 그 사람을 채우기',
          every: `체력 ${B.zoneAt * 100}%부터 ${secT(zo.period)}마다`, tip: () => [`파티원 1명 주변에 장판을 깔아 초당 ${N.zoneDps} 피해를 줍니다.`] },
        { ic: '광폭', name: B.enrName, enr: true,
          when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`,
          what: `파티 전원에게 <b>${N.enr}</b> 피해. 몇 번이면 전멸`,
          how: ENRAGE_HOW,
          every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 파티 전원에게 ${N.enr} 피해를 줍니다.`] },
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
      { id: 'p1', name: '1페이즈', at: `체력 100~${B.interAt * 100}%`, text: `${br.name} · ${st.name} · ${pu.name}` },
      { id: 'inter', name: '인터미션', at: `체력 ${B.interAt * 100}%, ${B.interDur}초`, text: `보스 무적, 예고 기술 멈춤. 쥐떼가 뒷줄 ${T.rats}명 공격` },
      { id: 'p2', name: '2페이즈', at: '인터미션 뒤', text: `${st.name} 끝 · ${co.name} 시작 · 파동이 ${N.pulse2}로 세지고 ${B.pulse2Period}초마다` },
    ];
    if (mythic) phases.push({ id: 'p3', name: '3페이즈 (악몽)', at: `체력 ${B.p3At * 100}% 아래`, text: `${iga(so.name)} 더해짐` });
    phases.push({ id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true });
    const skills: GuideSkill[] = [
      { ic: br.icon, name: br.name,
        when: `${secT(br.next)}에 첫 번째, ${secT(br.period)}마다 · 예고 없음 · 인터미션엔 멈춤`,
        what: `무작위 ${T.breath}명에게 질병: 겹칠 때마다 최대 체력 -${B.breathPct}% (최대 ${B.breathMax}번, -${B.breathPct * B.breathMax}%) · ${B.breathDur}초`,
        how: `${act('purify', RO)} 지우기. 많이 겹친 사람부터. 체력 ${B.interAt * 100}% 직전엔 다 지워 두기: 디버프가 남은 사람은 인터미션 때 독침이 더 걸림`,
        every: `${secT(br.period)}마다`, tip: () => [`${T.breath}명에게 질병을 걸어 최대 체력을 ${B.breathPct}%씩 겹쳐 줄입니다.`] },
      { ic: st.icon, name: st.name,
        when: `1페이즈만 · ${secT(st.next)}에 첫 번째, ${secT(st.period)}마다 · 예고 없음`,
        what: `무작위 ${T.breath}명에게 독: ${B.stingDur}초 동안 초당 <b>${N.sting}</b> (모두 ${N.stingTot})`,
        how: canDispel(S.hero, '독') ? `${act('purify', RO)} 지우기. 해제 재사용 대기가 남으면 질병 먼저` : cantDispel('독'),
        every: `1페이즈 · ${secT(st.period)}마다`, tip: () => [`${T.breath}명에게 독을 걸어 ${B.stingDur}초 동안 초당 ${N.sting} 피해를 줍니다.`] },
      { ic: pu.icon, name: pu.name,
        when: `${secT(pu.next + pu.cast)}에 첫 타, ${secT(pu.period)}마다 · 2페이즈는 시작 ${secT(B.pulse2Delay + pu.cast)} 뒤부터 ${secT(B.pulse2Period)}마다 · 예고 ${secT(pu.cast)}`,
        what: `파티 전원에게 <b>${N.pulse1}</b> 피해 · 2페이즈부터 <b>${N.pulse2}</b>`,
        how: `예고 동안 ${act('renew', EUL)} 깔고, 맞은 뒤 ${act('poh')}. 여러 명이 절반 아래면 ${act('hymn')}`,
        every: `${secT(pu.period)}마다 · 2페이즈 ${secT(B.pulse2Period)}마다`, tip: F => [F && F.phase >= 2 ? `파티 전원에게 ${N.pulse2} 피해를 줍니다.` : `파티 전원에게 ${N.pulse1} 피해를 줍니다. 2페이즈부터 ${N.pulse2}입니다.`] },
      { ic: '쥐떼', name: '쥐떼 (인터미션)',
        when: `보스 체력 ${B.interAt * 100}%에서 ${B.interDur}초 동안 · 보스 무적`,
        what: `맨 뒷줄 원거리 ${T.rats}명이 초당 <b>${N.rats}</b> 피해 (${B.interDur}초면 ${N.ratsTot}). 시작할 때 디버프가 있는 사람은 독침이 하나 더`,
        how: `‘쥐떼’ 표시가 붙은 사람에게 ${act('renew', EUL)} 걸고 ${act('heal', EUL)} 몰아주기`,
        every: `체력 ${B.interAt * 100}%에서 ${B.interDur}초`, tip: () => [`뒷줄 ${T.rats}명에게 초당 ${N.rats} 피해를 줍니다. 그동안 보스는 무적입니다.`] },
      { ic: co.icon, name: co.name,
        when: `2페이즈부터 · 인터미션 끝 ${secT(B.contDelay)} 뒤 첫 번째, ${secT(co.period)}마다`,
        what: `무작위 ${T.cont}명에게 함정 질병 (점선 테두리) ${secT(B.contDur)}. 끝나면 터져 옆 칸 사람에게 <b>${N.spread}</b> 피해 + 독침. 해제하면 그 자리에서 바로 터짐${mythic ? '. 악몽은 2명 동시, 두 대상이 붙어 있으면 걸리자마자 터짐' : ''}`,
        how: '해제하지 말고 기다리기. 터지기 전에 옆 칸 사람 체력을 채워 두기',
        every: `2페이즈 · ${secT(co.period)}마다`, tip: () => [`${secT(B.contDur)} 뒤 터져 옆 칸에 ${N.spread} 피해와 독침을 줍니다. 해제하면 바로 터집니다.`] },
    ];
    if (mythic) skills.push({ ic: so.icon, name: so.name,
      when: `악몽 3페이즈(체력 ${B.p3At * 100}% 아래)부터 ${secT(so.period)}마다 · 예고 ${secT(so.cast)}`,
      what: `판 바깥 1열 (왼쪽·오른쪽 번갈아)에 ${secT(so.dur)} 장판. 안에 있으면 초당 <b>${N.stormDps}</b> (다 맞으면 ${N.stormTot})`,
      how: '파티원(나 포함)이 알아서 옮김. 못 피한 사람부터 채우기',
      every: `3페이즈 · ${secT(so.period)}마다`, tip: () => [`판 바깥 1열에 장판을 깔아 초당 ${N.stormDps} 피해를 줍니다.`] });
    skills.push({ ic: '광폭', name: B.enrName, enr: true,
      when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`,
      what: `파티 전원에게 <b>${N.enr}</b> 피해. 몇 번이면 전멸`,
      how: ENRAGE_HOW,
      every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 파티 전원에게 ${N.enr} 피해를 줍니다.`] });
    return {
      nums: N,
      cur: F => (F.enraged ? 'enrage' : F.phase === 0 ? 'inter' : F.phase === 3 ? 'p3' : F.phase === 2 ? 'p2' : 'p1'),
      phases, skills,
    };
  },
  // 무음 성가대 (26 4-3): 20인 입문. 판을 열(구역)로 나눠 읽기
  choir(c) {
    const { sk, B, n, hp, mythic, hpMult } = c;
    const cr = sk.crescendo, ba = sk.baton, fo = sk.forte, so = sk.solo;
    const N = { song: n(B.song), cresc: n(cr.dps), crescTot: n(cr.dps * cr.dur), baton: n(ba.dmg), forte: n(B.forte), solo: n(B.soloDmg), enr: n(B.enrDmg), voiceHp: Math.round(B.voiceHp * hpMult).toLocaleString('ko-KR'), bossHp: Math.round(B.bossHp * hpMult).toLocaleString('ko-KR') };
    const pct = (a: number, b: number) => Math.round((a / b) * 100);
    return {
      nums: N,
      cur: F => (F.enraged ? 'enrage' : F.phase === 2 ? 'p2' : 'p1'),
      phases: [
        { id: 'p1', name: '1페이즈 · 세 성부', at: '성가대원이 살아 있는 동안 (지휘자 무적)', text: `성가대원 셋 (체력 ${N.voiceHp}씩)을 왼쪽부터 잡음. 하나 잡을 때마다 그 2열이 조용해짐` },
        { id: 'p2', name: '2페이즈 · 마지막 악장', at: '성가대원 전멸 뒤', text: `지휘자 (체력 ${N.bossHp}) · ${fo.name} · ${so.name}` },
        { id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true },
      ],
      skills: [
        { ic: '노래', name: '노래',
          when: '1페이즈 내내 · 예고 없음',
          what: `살아 있는 성가대원이 맡은 2열 (높은 성부 1·2열, 가운데 3·4열, 낮은 5·6열)에 선 사람 초당 <b>${N.song}</b>`,
          how: `성가대원을 잡을수록 조용해짐. 그 전엔 ${act('renew', EUL)} 넓게 깔아 두기`,
          every: '1페이즈 내내', tip: () => [`맡은 2열에 선 사람에게 초당 ${N.song} 피해를 줍니다.`] },
        { ic: cr.icon, name: cr.name,
          when: `${secT(cr.next + cr.cast)}에 첫 번째, ${secT(cr.period)}마다 · 예고 ${secT(cr.cast)} · 1페이즈만`,
          what: `살아 있는 성부 하나 (왼쪽부터 차례로)의 2열에 ${secT(cr.dur)} 장판. 안에 있으면 초당 <b>${N.cresc}</b> (다 맞으면 ${N.crescTot})${mythic ? '. 악몽 「불협화음」: 두 성부 4열 동시' : ''}`,
          how: `그 2열에 6~7명이 서 있고 빈 칸은 10개뿐이라 다 못 피함. 남은 사람이 모인 곳에 ${act('poh', RO)} 한 번에 채우기`,
          every: `1페이즈 · ${secT(cr.period)}마다`, tip: () => [`성부 하나의 2열에 장판을 깔아 초당 ${N.cresc} 피해를 줍니다.`] },
        { ic: ba.icon, name: ba.name,
          when: `${secT(ba.next + ba.cast)}에 첫 타, 그 뒤 ${secT(ba.period)}마다 · 예고 ${secT(ba.cast)}`,
          what: `탱커에게 <b>${N.baton}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.baton, hp.tank)}%)`,
          how: `예고가 뜨면 탱커를 미리 채우기. 못 채우면 ${act('guardian', EUL)} 걸기`,
          every: `${secT(ba.period)}마다`, tip: () => [`탱커에게 ${N.baton} 피해를 줍니다.`] },
        { ic: fo.icon, name: fo.name,
          when: `2페이즈 · 시작 ${secT(8 + fo.cast)} 뒤 첫 타, ${secT(fo.period)}마다 · 예고 ${secT(fo.cast)}`,
          what: `파티 전원 (20명)에게 <b>${N.forte}</b> 피해 (파티원 체력 ${hp.dps}의 ${pct(N.forte, hp.dps)}%)`,
          how: `예고 동안 ${act('renew', EUL)} 깔고, 맞은 뒤 사람이 많이 모인 칸에 ${act('poh')}. 여러 명이 절반 아래면 ${act('hymn')}`,
          every: `2페이즈 · ${secT(fo.period)}마다`, tip: () => [`파티 전원에게 ${N.forte} 피해를 줍니다.`] },
        { ic: so.icon, name: so.name,
          when: `2페이즈 · 시작 5초 뒤 첫 번째, ${secT(so.period)}마다 · 예고 없음`,
          what: `무작위 ${B.soloN}명에게 마법 「독창」 ${secT(B.soloSec)}. 끝나면 그 사람이 선 <b>열 전체</b>에 <b>${N.solo}</b>. 해제하면 바로 사라짐 (함정 아님)`,
          how: canDispel(S.hero, '마법') ? `${act('purify', RO)} 지우기. ${B.soloN}명이라 다 못 지우니 못 지운 사람의 열을 미리 채우기` : cantDispel('마법'),
          every: `2페이즈 · ${secT(so.period)}마다`, tip: () => [`${B.soloN}명에게 독창을 걸어 ${secT(B.soloSec)} 뒤 그 열 전체에 ${N.solo} 피해를 줍니다.`] },
        { ic: '광폭', name: B.enrName, enr: true,
          when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`,
          what: `파티 전원에게 <b>${N.enr}</b> 피해. 몇 번이면 전멸`,
          how: ENRAGE_HOW,
          every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 파티 전원에게 ${N.enr} 피해를 줍니다.`] },
      ],
    };
  },
};
export type GuideModel = GuideBody & { enc: Encounter; diff: DiffName; m: number; dodge: number; bossMax: number; hp: Probe['hp']; tier: string; B: Record<string, Num> };
export function guideModel(encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number): GuideModel {
  const enc = ENCOUNTERS[encKey], P = probe(encKey, diff, stageLv, heroLv);
  const m = P.m, n = (x: number) => Math.round(x * m);
  const g = GUIDE[enc.script]({ enc, diff, m, n, mythic: diff === '악몽', sk: P.sk, hp: P.hp, B: GB[enc.script], hpMult: P.bossMax / enc.hp });
  return Object.assign({ enc, diff, m, dodge: DIFFS[diff].dodge, bossMax: P.bossMax, hp: P.hp, tier: enc.tier.replace(' · ', ' '), B: GB[enc.script] }, g);
}
// 지금 돌고 있는 기술인지 (일시정지에서 '지금' 표시): 엔진 기술 상태 그대로 읽음
export function skillLive(F: Fight, ic: string): boolean {
  if (ic === '쥐떼') return F.phase === 0 && F.phaseName === '인터미션';
  if (ic === '노래') return F.enc.script === 'choir' && F.phase === 1;
  return F.skills.some(s => s.icon === ic && !s.hidden && s.next !== Infinity && s.active(F));
}
export function guideHtml(g: GuideModel, F: Fight | null): string {
  const cur = F ? g.cur(F) : null;
  const now = '<em class="now">지금</em>';
  const head = `<div class="gd-top"><div class="gd-art">${bossSvg(g.enc.script, g.enc.key)}</div><div class="gd-id">
    <b class="gd-name">${g.enc.name}</b>
    <div class="gd-tags"><span class="tag">${g.tier}</span><span class="tag diff">${g.diff}</span>${isFinite(g.enc.enrage) ? `<span class="tag enr">광폭화 ${mmss(g.enc.enrage)}</span>` : ''}</div></div></div>`;
  const phases = `<h4 class="gd-h">진행</h4><ol class="gd-phases">${g.phases.map((p, i) => `<li class="${p.id === cur ? 'cur' : ''}${p.enr ? ' enr' : ''}"><i>${i + 1}</i><div><b>${p.name}</b><small>${p.at}</small><p>${p.text}</p></div>${p.id === cur ? now : ''}</li>`).join('')}</ol>`;
  const skills = `<h4 class="gd-h">보스 기술 <small>전투 중 위쪽 예고 칸을 누르면 짧은 설명</small></h4><div class="gd-skills">${g.skills.map(s => {
    const live = F && skillLive(F, s.ic);
    return `<article class="gs${s.enr ? ' enr' : ''}${live ? ' live' : ''}" data-ic="${s.ic}"><header><span class="ic" style="background:${ICON_COLOR[s.ic] || '#BBB'}">${s.ic}</span><b>${s.name}</b>${live ? now : ''}</header>
      <p class="gs-line">${s.tip(F)[0]}<small>${s.every}</small></p></article>`;
  }).join('')}</div>`;
  return `<div class="gd">${head}${phases}${skills}</div>`;
}