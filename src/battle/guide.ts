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
import { bossSvg } from './art';
import { bossSkillArt, gimArt, mobSkillArt, skillArtImg } from './skillArt';
import { BOSSES, type DebuffDef, type SkillDef, type SkillEffect } from '../data/bosses';
import { bossNums } from './guideNums';
import { ARROW, heroSkill, ICON_COLOR, iga, josa, mmss, READ_ORDER, S, secT } from './core';

// 숫자는 엔진에서 읽는다: 기술 이름·아이콘·첫 시각·주기·예고·탱커 피해·장판 초당 피해/지속은 시험 전투(E.create)의 skills에서,
// 피해 배율·회피는 E.DIFFS에서, 보스·파티 체력(악몽 배율 포함)은 시험 전투에서.
// 기술 안쪽 숫자 (평타·광역 피해, 디버프, 페이즈 문턱)는 보스 데이터(data/bosses.ts)에서 읽어 GB로 모음
type Num = any;
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
/** art = 기술 아이콘 그림 이름 (battle/skillArt.ts, 없으면 글자 아이콘) */
export interface GuideSkill { ic: string; name: string; art?: string; enr?: boolean; when?: string; what: string; how?: string; every: string; tip: (F?: Fight | null) => string[] }
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
      skills.push({ ic: a.icon || m.name.slice(0, 2), name: a.name || `${m.name} 공격`, art: mobSkillArt(m.name, a.key),
        what: `${who}에게 <b>${amt}</b> 피해${each}${a.cast ? ` · 예고 ${secT(a.cast)}` : ''}. ${m.name}${josa(m.name, '이', '가')} 쓰러지면 멈춤`,
        every: `${secT(a.period)}마다`, tip: () => [`${who}에게 ${m.count > 1 ? '한 마리당 ' : ''}${amt} 피해를 줍니다.`] });
    }
    // 쓰러질 때 (46 5장 먼지 유령): 쓰러질 때마다 디버프
    for (const m of mobs) if (m.down) {
      const what = `${m.name}${josa(m.name, '이', '가')} 쓰러질 때마다 ${m.down.p === 'burst' ? '살아 있는 모두' : '때리던 사람'}에게 ${debuffText(m.down.debuff, n)}`;
      skills.push({ ic: m.name.slice(0, 2), name: `${m.name} 쓰러짐`, art: m.down.p === 'burst' ? gimArt('burst') : '', what, how: '여럿이 한꺼번에 쓰러지면 겹침. 거의 다 잡힐 때 지속 힐을 미리', every: '쓰러질 때마다', tip: () => [what.replace(/<\/?b>/g, '')] });
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
  // 유령 성가대 (26 4-3): 20인 입문. 판을 열(구역)로 나눠 읽기
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
const ROW_NAME = { front: '앞줄', mid: '가운데 줄', back: '뒷줄' } as const;
/** 디버프 한 줄: 「부패」 질병 20초 · 최대 체력 −10% */
function debuffText(d: DebuffDef, n: (x: number) => number): string {
  const fx = [d.dot ? `초당 ${n(d.dot)}` : '', d.maxCut ? `최대 체력 −${pctT(d.maxCut)}` : '', d.healCut ? `받는 치유 −${pctT(d.healCut)}` : '',
    d.noDps ? '딜 0' : '', d.invert ? '받는 치유가 피해로' : '', d.trap ? '지우면 터짐' : '', d.lock ? '해제 안 됨' : '',
    d.cureAt ? `체력 ${pctT(d.cureAt)} 채우면 떨어짐` : '', d.end?.p === 'hit' ? `시간 끝에 <b>${n(d.end.dmg)}</b>` : '',
    d.feed ? `빨아들인 만큼 × ${d.feed} 보스 회복` : '', d.end?.p === 'trapHit' ? `두면 시간 끝에 <b>${n(d.end.dmg)}</b>, 지우면 이웃 칸 <b>${n(d.end.burst)}</b>` : '',
    d.end?.p === 'blast' ? `끝나거나 지우면 이웃 칸 <b>${n(d.end.dmg)}</b>` : '',
    d.end?.p === 'jump' && d.end.on === 'quake' ? `진동이 울리면 이웃 칸 아군에게 옮겨붙고 ×${d.end.mult}, 지우면 사라짐` : '',
    d.vuln ? `받는 피해 +${pctT(d.vuln)}${d.stackMax ? ' 중첩' : ''}` : '', d.swap ? `${d.swap}중첩이면 탱커 교대` : '',
    d.absorb ? `치유 흡수 <b>${n(d.absorb)}</b> (다 채우면 사라짐)` : '', d.end?.p === 'stackHit' ? `끝나면 중첩 × <b>${n(d.end.dmg)}</b>` : '',
    d.swell ? `${secT(d.swell.every)}마다 1중첩 (최대 ${d.swell.max})` : '',
    d.end?.p === 'pop' ? `지우면 이웃 칸 중첩 × <b>${n(d.end.pop)}</b>, 두면 끝날 때 본인 중첩 × <b>${n(d.end.self)}</b> + 이웃 칸 중첩 × <b>${n(d.end.near)}</b>` : '',
    d.cap != null ? `체력이 ${pctT(d.cap)}까지만 참` : '', d.end?.p === 'flip' ? '끝날 때 체력 비율이 뒤집힘 (80% → 20%)' : '',
    d.drop ? `걸릴 때 <b>${n(d.drop)}</b>` : '', d.end?.p === 'pass' ? '지우면 남은 막이 가장 건강한 아군에게 넘어감, 두면 끝날 때 남은 막만큼 피해' : ''].filter(Boolean);
  return `「${d.name}」 (${d.type}, ${secT(d.left)}${fx.length ? ` · ${fx.join(' · ')}` : ''})`;
}
/** 디버프 대응: 지울 수 있으면 해제, 아니면 버티기 */
const debuffHow = (d: DebuffDef) => (d.lock || d.trap ? '' : d.end?.p === 'flip' ? flipHow(d) : d.swell ? swellHow(d) : d.cap != null ? capHow(d) : d.end?.p === 'pass' ? passHow(d)
  : canDispel(S.hero, d.type) ? `${act('purify', RO)} 지우기` : cantDispel(d.type));
/** 새 부품 대응 (46 5장): 지울 수 있는지에 따라 */
const swellHow = (d: DebuffDef) => (canDispel(S.hero, d.type) ? `중첩이 적고 옆에 사람이 적을 때 ${act('purify', RO)} 지우기` : `못 지움. 터지기 전에 본인과 옆 칸 사람을 가득 채우기`);
const capHow = (d: DebuffDef) => (canDispel(S.hero, d.type) ? `큰 피해 예고가 뜨면 ${act('purify', RO)} 먼저 지우기` : `상한 위로는 힐이 안 들어감. 큰 피해 전에 보호막 · 지속 힐`);
/** 묶음 C 새 부품 (48 5장) */
const passHow = (d: DebuffDef) => (canDispel(S.hero, d.type) ? `낮은 사람에게 붙으면 ${act('purify', RO)} 지워 건강한 사람에게 넘기고, 그 사람 몸에서 힐로 녹이기` : `못 지움. 붙은 사람에게 힐을 몰아 막을 녹이기`);
const flipHow = (d: DebuffDef) => `끝날 때 체력이 높으면 낮아지니 힐을 멈추고, 낮으면 오히려 둠${canDispel(S.hero, d.type) ? `. 높을 때는 ${act('purify', RO)} 지우기` : ''}`;
/** 기술 효과 → [무엇, 어떻게] */
function effectText(d: SkillDef, e: SkillEffect | undefined, c: GuideCtx, ps: ProbeSkill | undefined): [string, string] {
  const { n } = c;
  if (!e && d.fixed) return [`${ROW_NAME[d.cells?.p === 'line' ? d.cells.at : 'mid']}에 선 사람 모두 <b>${n(d.hitDmg ?? 0)}</b> (피할 수 없음)`, `맞기 전에 그 줄을 ${act('poh', RO)} · ${act('renew', EUL)} 미리 채우기`];
  if (!e) return d.cells ? [`장판${d.hitDmg ? `: 맞는 순간 그 칸 <b>${n(d.hitDmg)}</b>` : ''}${d.dps ? `${d.hitDmg ? ',' : ':'} 안에 있으면 초당 <b>${n(ps?.dps ?? d.dps)}</b>` : ''}${d.dur ? ` (${secT(d.dur)})` : ''}`, '파티원이 알아서 피함. 늦게 피하는 사람을 채우기'] : ['', ''];
  switch (e.p) {
    case 'tank': return [`탱커에게 <b>${n(ps?.dmg ?? d.dmg ?? 0)}</b> 피해${e.debuff ? ` + ${debuffText(e.debuff, n)}` : ''}`, e.debuff?.swap ? '교대한 탱커에게도 지속 힐을 걸어 두기' : '예고가 뜨면 탱커를 미리 가득 채우기'];
    case 'hunt': return [`그 순간 체력 비율이 가장 낮은 탱커 아닌 ${c.mythic && e.nMythic ? e.nMythic : 1}명에게 <b>${n(e.dmg)}</b> 피해`, '예고 동안 가장 낮은 사람을 먼저 채우기'];
    case 'all': return [`파티 전원에게 <b>${n(e.dmg)}</b> 피해${e.debuff ? ` + ${debuffText(e.debuff, n)}` : ''}`, `예고 동안 ${act('renew', EUL)} 미리 걸고, 맞은 뒤 ${act('poh', RO)} 채우기`];
    case 'debuff': return [`${e.n === 'all' ? '모두' : `${c.mythic && e.nMythic ? e.nMythic : e.n}명`}에게 ${debuffText(e.debuff, n)}`, debuffHow(e.debuff)];
    case 'rot': return [`${e.n}명 최대 체력 −${pctT(e.pct)} 중첩 (최대 ${e.max}) ${debuffText(e.debuff, n)}`, debuffHow(e.debuff)];
    case 'pull': return [`뒷줄 1명을 보스 앞으로 끌어옴. ${secT(e.sec)} 동안 평타를 탱커와 번갈아 맞음 (한 대에 <b>${n(e.dmg)}</b>)${e.pad ? `. 그 칸에 받침: 끝에 위 사람 <b>${n(e.pad.dmg)}</b>, 비어 있으면 전원 <b>${n(e.pad.empty)}</b>` : ''}`,
      e.pad ? '끌려온 사람을 받침 끝까지 세워 두기 (탱커와 묶어 광역, 울림 직전 단일 힐)' : `끌려온 사람이 탱커 옆이라 ${act('poh', RO)} 둘을 한 번에 채우기`];
    case 'adds': return [`「${e.add.name}」 ${c.mythic && e.nMythic ? e.nMythic : e.n}마리 등장`, '딜러가 잡음. 맞는 사람을 채우기'];
    case 'hole': return [`가장자리 바닥 ${e.n}칸이 무너짐`, '파티원이 알아서 비킴'];
    case 'order': return [`${c.mythic && e.nMythic ? e.nMythic : e.n}명 칸에 번호. ${secT(e.sec)} 안에 번호 순서대로 단일 힐 → 보스 ${secT(e.daze.sec)} 멍함`, '번호 순서대로 한 번씩 힐 넣기'];
    case 'jail': return [`${c.mythic && e.nMythic ? e.nMythic : e.n}명을 「${e.name}」에 가둠 (딜 0 · 초당 ${n(e.dot)})`, '딜러가 감옥을 깰 때까지 갇힌 사람을 채우기'];
    case 'quake': return [`시전 중인 힐이 끊기고 그 스킬 ${secT(e.lock)} 잠김 + 전원 <b>${n(e.dmg)}</b>`, '예고가 뜨면 새 시전을 시작하지 않기 (즉시 스킬 · 지속 힐)'];
    case 'rest': return [`${secT(e.sec)} 동안 기술을 쉼`, '그동안 마나를 아끼며 채우기'];
    case 'clear': return [`「${e.name}」이 모두에게서 사라짐`, ''];
    case 'stagger': return [`${secT(e.sec)} 안에 게이지 채우기: 체력 ${pctT(e.hp)} 이상인 파티원의 딜만 셈`, '딜러 체력을 높게 유지'];
    case 'counter': return [`끊기 능력으로 끊으면 보스 ${secT(e.stun)} 기절, 못 끊으면 앞줄 <b>${n(e.dmg)}</b>`, '앞줄을 미리 채우기'];
    case 'tower': return [`발판 ${e.n}곳: 위 사람 <b>${n(e.dmg)}</b>, 빈 발판마다 전원 <b>${n(e.empty)}</b>`, '발판에 선 사람을 채워 끝까지 세워 두기'];
    case 'cycle': return e.random
      ? [`탱커 아닌 ${c.mythic && e.nMythic ? e.nMythic : e.n}명에게 셋 중 하나: ${e.debuffs.map(x => debuffText(x, n)).join(' / ')}`, '칸 위 모자를 보고 다르게: 뒤집힘은 힐 멈춤 · 상한은 지우거나 보호막 · 완치는 몰아서 채우기']
      : [`${e.n}명에게 디버프를 차례로 (${e.debuffs.map(x => x.type).join(' → ')})`, '지울 수 있는 것부터 지우기'];
    case 'ring': return [`탱커 아닌 ${c.mythic && e.nMythic ? e.nMythic : e.n}명 발밑에 고리 ${secT(e.sec)} (안에 있으면 초당 <b>${n(e.dps)}</b>). 안에서 치유를 받으면 한 겹 자람 (최대 ${c.mythic && e.maxMythic != null ? e.maxMythic : e.max}겹)`,
      '고리 안 사람은 걸어 나올 때까지 힐을 미루기 (위급하면 예외). 광역 힐은 고리를 피해서'];
    case 'soul': return [`빈 칸에 「${e.name}」. ${secT(e.sec)} 안에 단일 힐로 가득 채우면 ${e.win.text}`, `영혼 칸에 ${act('heal', EUL)} 넣기`];
    case 'link': return [`두 사람을 「${e.name}」으로 ${secT(e.sec)} 이음`, e.kind === 'balance' ? '두 사람 체력 비율을 비슷하게' : '둘이 피해 · 치유를 나눔'];
    case 'vessel': return [`「${e.name}」: 넘친 치유를 모아 가득 차면 전원 보호막`, '일부러 넘치게 힐하기'];
    case 'auto': return [`탱커에게 ${n(e.dmg)}`, ''];
    case 'share': return [`🎯 대상과 이웃 칸 아군이 <b>${n(e.dmg)}</b>를 인원 수로 나눠 받음 (혼자면 그대로)`, '가까운 파티원이 모임. 대상을 미리 채우고, 모인 칸에 광역 힐'];
    case 'trade': return [`두 탱커의 「${e.name}」 중첩이 서로 바뀜`, '바뀐 뒤 바로 교대가 오니 두 탱커 모두 채워 두기'];
    case 'slow': return [`${secT(e.sec)} 동안 내 시전 시간 ×${e.mult}`, '그동안 즉시 스킬 · 지속 힐로 버티기'];
    case 'empower': return [`보스 피해 +${pctT(e.boost)} (끝까지 쌓임)`, '오래 끌수록 아파짐. 쿨기를 이때 쓰기'];
  }
}
/** 기술이 도는 때 (페이즈 · 체력 문턱) */
function whenText(d: SkillDef): string {
  const w = d.when;
  if (w?.hpBelow != null) return `체력 ${pctT(w.hpBelow)} 아래`;
  if (w?.phase && !w.phase.includes(1)) return `${w.phase.join('·')}페이즈`;
  return '';
}
function dataGuide(c: GuideCtx): GuideBody {
  const def = BOSSES[c.enc.script as Exclude<ScriptKey, 'trash'>], { sk, B, n } = c;
  // 대기열에 안 보이는 기술도 공략 글(how)이 있으면 공략에 (가시 중첩 · 짙어지는 저녁)
  const shown = def.skills.filter(d => (!d.hidden || d.how) && (d.when?.mythic == null || d.when.mythic === c.mythic));
  const phases: GuidePhase[] = [{ id: 'p1', name: '시작', at: '처음부터', text: shown.filter(d => !whenText(d)).map(d => d.name).join(' · ') }];
  // 체력 문턱 · 페이즈 흐름: 문턱마다 한 줄
  const marks = new Map<number, string[]>();
  for (const d of shown) if (d.when?.hpBelow != null) marks.set(d.when.hpBelow, [...(marks.get(d.when.hpBelow) ?? []), `${iga(d.name!)} 더해짐`]);
  for (const st of def.flow ?? []) if (st.p === 'when' && st.if.hpBelow != null && (st.if.mythic == null || st.if.mythic === c.mythic)) {
    const t = st.do.find(x => x.p === 'text') as { text: string } | undefined;
    if (t) marks.set(st.if.hpBelow, [t.text]);
  }
  for (const [at, txt] of [...marks].sort((a, b) => b[0] - a[0])) phases.push({ id: `h${at}`, name: txt[0].split(':')[0], at: `체력 ${pctT(at)} 아래`, text: txt.join(' · ') });
  if (isFinite(c.enc.enrage)) phases.push({ id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true });
  const skills: GuideSkill[] = shown.map(d => {
    const ps = sk[d.key], [what, how0] = effectText(d, d.effect, c, ps), wt = whenText(d);
    const every = `${wt ? `${wt} · ` : ''}${secT(d.period)}마다`;
    return { ic: d.icon ?? d.name!.slice(0, 2), name: d.name!, art: bossSkillArt(c.enc, d), when: `${wt ? `${wt}부터 · ` : `${secT((d.first ?? 0) + d.cast)}에 첫 타, 그 뒤 `}${secT(d.period)}마다${d.cast ? ` · 예고 ${secT(d.cast)}` : ''}${d.cut ? ' · 끊기 ✋' : ''}`,
      what, how: d.how ?? (how0 || undefined), every, tip: () => [what.replace(/<\/?b>/g, '')] };
  });
  skills.push({ ic: '광폭', name: B.enrName, enr: true, when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`,
    what: `파티 전원에게 <b>${n(B.enrDmg)}</b> 피해. 몇 번이면 전멸`, how: ENRAGE_HOW, every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 파티 전원에게 ${n(B.enrDmg)} 피해를 줍니다.`] });
  const thresholds = [...marks.keys()].sort((a, b) => a - b);
  return {
    nums: {}, phases, skills,
    cur: F => { if (F.enraged) return 'enrage'; const r = F.bossHp / F.bossMax, at = thresholds.find(x => r <= x); return at != null ? `h${at}` : 'p1'; },
  };
}

export type GuideModel = GuideBody & { enc: Encounter; diff: DiffName; m: number; dodge: number; bossMax: number; hp: Probe['hp']; tier: string; B: Record<string, Num> };
export function guideModel(encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number): GuideModel {
  const enc = ENCOUNTERS[encKey], P = probe(encKey, diff, stageLv, heroLv);
  const m = P.m, n = (x: number) => Math.round(x * m);
  const B = bossNums(enc.script);
  const g = (GUIDE[enc.script] ?? dataGuide)({ enc, diff, m, n, mythic: diff === '악몽', sk: P.sk, hp: P.hp, B, hpMult: P.bossMax / enc.hp });
  return Object.assign({ enc, diff, m, dodge: DIFFS[diff].dodge, bossMax: P.bossMax, hp: P.hp, tier: enc.tier.replace(' · ', ' '), B }, g);
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
    // 기술 그림이 있으면 그림 + 색 테두리, 없으면 색 바탕 글자 아이콘 (37 1장)
    const img = s.art ? skillArtImg(s.art) : '';
    const ic = img ? `<span class="ic art" style="border-color:${iconColor(s.ic)}">${img}</span>` : `<span class="ic" style="background:${iconColor(s.ic)}">${s.ic}</span>`;
    return `<article class="gs${s.enr ? ' enr' : ''}${live ? ' live' : ''}" data-ic="${s.ic}"><header>${ic}<b>${s.name}</b>${live ? now : ''}</header>
      <p class="gs-line">${s.tip(F)[0]}<small>${s.every}</small></p></article>`;
  }).join('')}</div>`;
  return `<div class="gd">${head}${phases}${skills}</div>`;
}