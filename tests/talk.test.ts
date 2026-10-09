/**
 * 파티원 대사 (41 문서): 대사 데이터 규칙과 말풍선 감독(battle/talk.ts)이 전투에서 실제로 말하는지.
 */
import { describe, expect, it } from 'vitest';
import { createTalk, type TalkBubble } from '../src/battle/talk';
import { CLASS_LINES, COMMON_LINES, lineCount, PERS_LINES, pickLine, ROLE_LINES, SIT_KEYS, SITS, type TalkLines, type TalkSit } from '../src/data/talk';
import { PERS_NAMES } from '../src/data/personalities';
import type { EncounterKey } from '../src/data/encounters';
import * as E from '../src/engine';
import { runEffect } from '../src/engine/bossParts';
import { damageMob } from '../src/engine/core';
import type { AddDef, SkillEffect } from '../src/data/bosses';
import type { BossSkill, Fight } from '../src/engine';

const ALLY_SITS: TalkSit[] = ['allyDown', 'tankDown', 'allyRevived', 'swallowedOther', 'jailOther'];
const sources: [string, TalkLines][] = [
  ...Object.entries(PERS_LINES).map(([k, v]) => [`성격 ${k}`, v] as [string, TalkLines]),
  ...Object.entries(CLASS_LINES).map(([k, v]) => [`직업 ${k}`, v] as [string, TalkLines]),
  ...Object.entries(ROLE_LINES).map(([k, v]) => [`역할 ${k}`, v] as [string, TalkLines]),
  ['공통', COMMON_LINES],
];
const visLen = (t: string) => [...t.replace(/\{(ally|tank|boss)\}/g, '12345')].length;

describe('대사 데이터 규칙', () => {
  it('앱 문장 규칙: 「요」로 끝나지 않고, 짧고, 이모지·종·길드 없음', () => {
    const bad: string[] = [];
    for (const [name, lines] of sources) for (const [sit, arr] of Object.entries(lines)) for (const t of arr!) {
      if (/요[\s!?.~…ㅠㅜㅋㅎ^]*$/.test(t)) bad.push(`${name}.${sit} 요: ${t}`);
      if (visLen(t) > 18) bad.push(`${name}.${sit} 길이: ${t}`);
      if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) bad.push(`${name}.${sit} 이모지: ${t}`);
      if (/종탑|종소리|종지기|종루|종 조각/.test(t)) bad.push(`${name}.${sit} 종: ${t}`);
      if (/길드/.test(t)) bad.push(`${name}.${sit} 길드: ${t}`);
      for (const m of t.matchAll(/\{[^}]*\}/g)) if (!['{ally}', '{tank}', '{boss}'].includes(m[0])) bad.push(`${name}.${sit} 자리표시: ${t}`);
      if (t.includes('{ally}') && !ALLY_SITS.includes(sit as TalkSit)) bad.push(`${name}.${sit} {ally}: ${t}`);
      if (!t.trim()) bad.push(`${name}.${sit} 빈 대사`);
    }
    expect(bad).toEqual([]);
  });

  it('성격 10종이 모든 상황을 채움 (그 성격 전용 상황은 그 성격만)', () => {
    for (const p of PERS_NAMES) {
      const lines = PERS_LINES[p];
      for (const sit of SIT_KEYS) {
        const only = (SITS[sit] as { pers?: readonly string[] }).pers;
        if (only && !only.includes(p)) expect(lines[sit], `${p}.${sit}`).toBeUndefined();
        else expect(lines[sit]?.length ?? 0, `${p}.${sit}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('공통 대사가 모든 상황을 채움', () => {
    for (const sit of SIT_KEYS) expect(COMMON_LINES[sit]?.length ?? 0, sit).toBeGreaterThanOrEqual(2);
  });

  it('상황 100가지 넘게, 대사 수천 줄', () => {
    expect(SIT_KEYS.length).toBeGreaterThan(100);
    expect(lineCount().total).toBeGreaterThan(3000);
  });

  it('같은 묶음 안에 같은 대사가 두 번 없음', () => {
    for (const [name, lines] of sources) for (const [sit, arr] of Object.entries(lines)) expect(new Set(arr).size, `${name}.${sit}`).toBe(arr!.length);
  });

  it('고르기: 자리표시를 못 채우면 그 대사는 안 고름, 나온 대사는 되도록 피함', () => {
    let r = 0.1;
    const rand = () => ((r = (r * 9301 + 49297) % 233280 / 233280), r);
    const used = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const t = pickLine('idle', { pers: '감사형', cls: 'mage', role: 'ranged' }, rand, used, x => !x.includes('{tank}'));
      expect(t).toBeTruthy();
      expect(t).not.toContain('{tank}');
      used.add(t!);
    }
    expect(used.size).toBeGreaterThan(10);
    // 성격·공통 대사 모두 자리표시를 못 채우면 말하지 않음
    expect(pickLine('allyDown', { pers: '사교형', cls: null, role: 'melee' }, rand, new Set(), x => !x.includes('{ally}'))).toBeNull();
  });
});

/** 자동 힐러로 한 판 돌리며 말풍선 모으기 (화면 시계 = 전투 시간) */
function run(enc: EncounterKey, seed: number, diff: '보통' | '어려움' = '보통') {
  const party = E.recruitParty(enc, seed, { abilities: true });
  const f = E.create({ encounter: enc, diff, seed, party, items: ['mana', 'life', 'cleanse', 'feather'], gear: 'adv0' });
  let r = seed / 1000;
  const talk = createTalk(() => ((r = (r * 9301 + 49297) % 233280 / 233280), r));
  talk.start(f, { seg: 0, segN: 1, cont: 0, affix: false, chal: false }, 0);
  const out: (TalkBubble & { t: number })[] = [];
  const barks: { t: number; id: number; sit?: string }[] = [];
  for (let k = 0; k < 60; k++) for (const b of talk.frame(f, k * 50, { pulling: true, paused: false })) out.push({ ...b, t: k * 50 }); // 카운트다운 3초
  while (!f.over && f.t < 700) {
    E.autoHealer(f); E.step(f);
    const now = 3000 + f.t * 1000;
    for (const ev of f.events) if (ev.type === 'bark') barks.push({ t: now, id: ev.id, sit: ev.sit });
    for (const b of talk.frame(f, now, { pulling: false, paused: false })) out.push({ ...b, t: now });
    f.events.length = 0;
  }
  const end = 3000 + f.t * 1000;
  for (let k = 1; k <= 20; k++) for (const b of talk.frame(f, end + k * 50, { pulling: false, paused: false })) out.push({ ...b, t: end + k * 50 });
  return { f, out, barks };
}

describe('전투 중 말풍선', () => {
  const CASES: [EncounterKey, number][] = [['warden', 3], ['scrap', 8], ['plague', 5], ['choir', 2], ['gate', 4], ['patrol', 6]];
  for (const [enc, seed] of CASES) {
    it(`${enc}: 시작 인사·전투 중 반응·끝 인사가 나오고, 자리표시는 다 채워짐`, () => {
      const { f, out } = run(enc, seed);
      expect(out.length).toBeGreaterThan(5);
      expect(out.some(b => b.t < 3000)).toBe(true); // 카운트다운 중 인사
      expect(out.some(b => b.t > 3000 + f.t * 1000)).toBe(true); // 끝난 뒤 한마디
      for (const b of out) {
        expect(b.text).not.toMatch(/[{}]/);
        const u = f.party.find(x => x.id === b.id)!;
        expect(u && !u.me).toBe(true);
        expect(b.life).toBeGreaterThanOrEqual(1700);
        if (!u.alive && b.t > 3000 + f.t * 1000) expect(b.kind).toBe('chat'); // 끝난 뒤 쓰러진 사람 말은 회색 파티 채팅
      }
      expect(new Set(out.map(b => b.text)).size).toBeGreaterThan(out.length * 0.7); // 같은 말 되풀이 적음
    });
  }

  it('실수 신호(엔진 말풍선)는 빠짐없이 보여 주고, 상황 이름이 붙어 있음 (감사·회피는 빈도 제한)', () => {
    let signals = 0;
    for (const seed of [1, 2, 3]) {
      const { out, barks } = run('plague', seed, '어려움');
      expect(barks.length).toBeGreaterThan(0);
      for (const b of barks) {
        expect(b.sit, '엔진 말풍선에 상황이 없음').toBeTruthy();
        if (b.sit === 'thanks' || b.sit === 'dodge') continue;
        signals++;
        const o = out.find(x => x.t === b.t && x.id === b.id);
        expect(o, `${b.sit} t=${b.t}`).toBeTruthy();
        expect(['call', 'alert'], `${b.sit} 말풍선 테두리`).toContain(o!.kind); // 신호는 금테·붉은 테로 눈에 띄게
      }
    }
    expect(signals).toBeGreaterThan(0);
  });

  it('정신없지 않게: 같은 사람 4초 넘게 간격, 어느 1분을 봐도 9개 이하, 동시에 3개 이하 (엔진 말풍선·시작·끝 인사 빼고)', () => {
    for (const [enc, seed] of [['warden', 11], ['plague', 4], ['choir', 12]] as [EncounterKey, number][]) {
      const { f, out, barks } = run(enc, seed);
      const end = 3000 + f.t * 1000;
      const forced = new Set(barks.filter(b => b.sit !== 'thanks' && b.sit !== 'dodge').map(b => `${b.t}:${b.id}`));
      const free = out.filter(b => b.t > 3000 && b.t <= end && !forced.has(`${b.t}:${b.id}`));
      const last = new Map<number, number>();
      for (const b of free) { expect(b.t - (last.get(b.id) ?? -1e9)).toBeGreaterThanOrEqual(4000); last.set(b.id, b.t); }
      for (const b of free) expect(free.filter(x => x.t >= b.t && x.t < b.t + 60000).length, `${enc} t=${b.t}`).toBeLessThanOrEqual(9);
      for (const b of free) expect(free.filter(x => x.t <= b.t && x.t + x.life > b.t).length).toBeLessThanOrEqual(3);
      expect(free.length, `${enc} 전투 중 말이 너무 적음`).toBeGreaterThan(f.t / 60);
    }
  });

  describe('판에 나오는 적 (35 3-I)마다 맞는 말', () => {
    const IMP: AddDef = { name: '꼬마 악마', short: '악마', hp: 0.03, dmg: 20, every: 2 };
    /** 판 위 적 상황만 봄 (잡담·체력 반응 빼고) */
    const ADD_SITS = new Set<string>([...SIT_KEYS.filter(k => SITS[k].when.includes('P-') || ['jailOther', 'jailFree', 'bossHeal', 'bombBoom', 'marchIn'].includes(k)), 'adds', 'addOnMe', 'addDown', 'cured', 'noDps']);
    /** 보스 기술을 끄고 한 부품만 써서, 그 뒤 sec초 동안 나온 말풍선 (난수 0 = 확률은 늘 통과, 빈도 제한은 그대로) */
    function talkAfter(enc: EncounterKey, e: SkillEffect, sec: number, then?: (f: Fight) => void, sec2 = 0, hp = 1) {
      const f = E.create({ encounter: enc, diff: '보통', seed: 1 });
      f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; });
      f.bossHp = f.bossMax * hp; // 체력 선 페이즈(인터미션 …)가 안 오게 기본은 가득
      const talk = createTalk(() => 0);
      talk.start(f, { seg: 0, segN: 1, cont: 0, affix: false, chal: false }, 0);
      const out: TalkBubble[] = [];
      const go = (s: number, pulling = false) => {
        const end = f.t + s;
        while (!f.over && f.t < end - 1e-9) {
          f.party.forEach(u => { u.lastHeal = f.t; }); // 관심종자 삐짐 안 나게
          E.step(f);
          out.push(...talk.frame(f, 3000 + f.t * 1000, { pulling, paused: false }).filter(b => b.sit && ADD_SITS.has(b.sit)));
          f.events.length = 0;
        }
      };
      go(3, true); go(10); out.length = 0; // 시작 인사한 사람도 다시 말할 수 있게
      runEffect(f, {} as BossSkill, e);
      go(sec);
      if (then) { then(f); go(sec2); }
      return { f, out, sits: new Set(out.map(b => b.sit)) };
    }
    const adds = (add: AddDef): SkillEffect => ({ p: 'adds', n: 1, add });

    it('감옥: 갇힌 사람 · 다른 사람이 말하고, 깨지면 풀린 사람이 고마워함 (해제 대사·쫄 잡음 대사 아님)', () => {
      const { f, out, sits } = talkAfter('warden', { p: 'jail', n: 1, name: '심연 감옥', short: '감옥', hp: 0.04, dot: 1 }, 11,
        g => { const m = g.mobs.find(x => x.add?.job?.p === 'jail')!; damageMob(g, m, m.max); }, 10);
      // 갇힌 사람 또는 다른 사람 하나 (한 사건에 한마디)
      expect(out.map(b => b.sit)).toEqual([sits.has('jailed') ? 'jailed' : 'jailOther', 'jailFree']);
      const m = f.mobs.find(x => x.add?.job?.p === 'jail')!, nick = f.party.find(u => u.id === m.add!.on)!.nick;
      if (sits.has('jailed')) expect(out[0].id).toBe(m.add!.on);
      else expect(out[0].id !== m.add!.on && out[0].text.includes(nick)).toBe(true);
      expect(out[1].id).toBe(m.add!.on);
    });
    it('치유하는 쫄 → 보스 회복', () => {
      expect(talkAfter('warden', adds({ ...IMP, dmg: 0, job: { p: 'mend', every: 3, pct: 0.01 } }), 14, undefined, 0, 0.95).sits).toEqual(new Set(['mendAdd', 'bossHeal']));
    });
    it('폭탄 → 못 깨면 터짐', () => {
      expect(talkAfter('warden', adds({ ...IMP, dmg: 0, job: { p: 'bomb', sec: 8, dmg: 5 } }), 10).sits).toEqual(new Set(['bomb', 'bombBoom']));
    });
    it('폭탄을 깨면 터짐 대사 없음', () => {
      const { sits } = talkAfter('warden', adds({ ...IMP, dmg: 0, job: { p: 'bomb', sec: 8, dmg: 5 } }), 1, g => { const m = g.mobs.find(x => x.add)!; damageMob(g, m, m.max); }, 10);
      expect(sits.has('bomb')).toBe(true);
      expect(sits.has('bombBoom')).toBe(false);
    });
    it('보호막 수정', () => {
      expect(talkAfter('warden', adds({ ...IMP, dmg: 0, job: { p: 'pylon', cut: 0.5 } }), 6).sits).toEqual(new Set(['pylon']));
    });
    it('레이드 큰 쫄 · 때리는 쫄: 쫄을 맡은 부탱커가 말함', () => {
      for (const add of [{ ...IMP, dmg: 0, job: { p: 'smash', every: 99, warn: 1, dmg: 1 } } as AddDef, IMP]) {
        const { f, out } = talkAfter('plague', adds(add), 8);
        const m = f.mobs.find(x => x.add)!;
        const b = out.find(x => x.sit === (add.job ? 'eliteAdd' : 'offTank'))!;
        expect(b, add.name).toBeTruthy();
        expect(b.id).toBe(m.add!.on);
        expect(f.party.find(u => u.id === b.id)!.role).toBe('tank');
        expect(out.some(x => x.sit === 'addOnMe')).toBe(false);
      }
    });
    it('걸어오는 쫄 → 보스에 흡수', () => {
      expect(talkAfter('warden', adds({ ...IMP, dmg: 0, job: { p: 'march', every: 2, boost: 0.1 } }), 30).sits).toEqual(new Set(['marchAdd', 'marchIn']));
    });
    it('자폭 쫄: 노린 파티원이 말함 (힐러를 노리면 쫄 등장 대사)', () => {
      const { f, out } = talkAfter('warden', adds({ ...IMP, dmg: 0, job: { p: 'fixate', every: 99, dmg: 1, splash: 1 } }), 6);
      const m = f.mobs.find(x => x.add)!;
      if (m.add!.on === f.me.id) expect(out.map(b => b.sit)).toEqual(['adds']);
      else expect(out.map(b => [b.sit, b.id])).toEqual([['fixate', m.add!.on]]);
    });
    it('쫄 떼', () => {
      expect(talkAfter('warden', adds({ ...IMP, cleave: true }), 6).sits.has('swarm')).toBe(true);
    });
  });

  it('프로토타입 규칙 판에는 상황 이름을 안 붙임 (parity)', () => {
    const f = E.create({ encounter: 'plague', diff: '어려움', seed: 7, gear: 'adv0', proto: true, armor: false, items: ['mana', 'life', 'cleanse', 'feather'] });
    let n = 0;
    while (!f.over && f.t < 400) {
      E.autoHealer(f); E.step(f);
      for (const ev of f.events) if (ev.type === 'bark') { n++; expect(ev.sit).toBeUndefined(); }
      f.events.length = 0;
    }
    expect(n).toBeGreaterThan(0);
  });
});
