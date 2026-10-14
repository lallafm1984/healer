/** 파티원 닉네임 (74 문서): 직업별 목록 200개, 직업군 비율, 공개모집 · 길드 지원자는 자기 직업 목록에서 */
import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../src/data/classes';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import { CLASS_NICKS, pickNick, STORY_NICKS } from '../src/data/nicknames';
import { PERS_NAMES } from '../src/data/personalities';
import * as E from '../src/engine';
import { makeCandidate } from '../src/game/guild';
import { newSave } from '../src/platform/storage';

const ALL = Object.values(CLASS_NICKS).flat();
const classOf = (nick: string) => (Object.keys(CLASS_NICKS) as ClassKey[]).find(k => CLASS_NICKS[k].includes(nick));

describe('닉네임 데이터', () => {
  it('200개 · 직업군 비율 탱커 25% · 근접 30% · 원거리 45%', () => {
    expect(ALL.length).toBe(200);
    expect(Object.fromEntries(Object.entries(CLASS_NICKS).map(([k, v]) => [k, v.length]))).toEqual({
      warrior: 25, paladin: 25, rogue: 20, berserker: 20, swordsman: 20, mage: 30, archer: 30, hunter: 30,
    });
    const byRole = { tank: 0, melee: 0, ranged: 0 };
    for (const k of RECRUIT_CLASSES) byRole[CLASSES[k].role] += CLASS_NICKS[k].length;
    expect(byRole).toEqual({ tank: 50, melee: 60, ranged: 90 });
  });

  it('2~5자, 띄어쓰기 없음, 모두 다름', () => {
    for (const n of ALL) {
      expect([...n].length, n).toBeGreaterThanOrEqual(2);
      expect([...n].length, n).toBeLessThanOrEqual(5);
      expect(n, n).toMatch(/^[가-힣0-9]+$/);
    }
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it('스토리 동료 · 성격 · 직업 · 보스 · 능력 이름과 겹치지 않음', () => {
    const taken = new Set<string>([...STORY_NICKS, ...PERS_NAMES, ...Object.values(CLASSES).map(c => c.name)]);
    for (const e of Object.values(ENCOUNTERS)) for (const w of e.name.split(/\s+/)) taken.add(w);
    for (const a of Object.values(ABILITIES)) taken.add(a.name.replace(/\s+/g, ''));
    expect(ALL.filter(n => taken.has(n))).toEqual([]);
  });

  it('다 쓰면 목록 이름 뒤에 숫자', () => {
    const used = new Set(CLASS_NICKS.warrior);
    const n = pickNick('warrior', () => 0, used);
    expect(n).toBe(`${CLASS_NICKS.warrior[0]}2`);
    expect(pickNick('warrior', () => 0, new Set([...used, n]))).toBe(`${CLASS_NICKS.warrior[0]}3`);
  });
});

describe('공개모집 · 길드 지원자', () => {
  it('공개모집 파티원 닉네임은 자기 직업 목록에서, 한 파티 안에서 겹치지 않음', () => {
    const encs: EncounterKey[] = ['warden', 'plague', 'choir'];
    for (const enc of encs) for (let s = 1; s <= 60; s++) {
      const p = E.recruitParty(enc, s, { abilities: true });
      for (const m of p) expect(classOf(m.nick), `${enc} ${s} ${m.nick}`).toBe(m.cls);
      expect(new Set(p.map(m => m.nick)).size).toBe(p.length);
    }
  });

  it('닉네임을 붙여도 성격 · 직업 · 능력은 그대로 (따로 굴린 난수)', () => {
    for (let s = 1; s <= 30; s++) {
      const a = E.rollParty('plague', s), b = E.recruitParty('plague', s, { abilities: true });
      expect(b.map(m => [m.role, m.pers])).toEqual(a.map(m => [m.role, m.pers]));
      expect(E.recruitParty('plague', s, { abilities: true })).toEqual(b);
    }
  });

  it('길드 지원자도 자기 직업 목록에서, 길드원과 겹치지 않음', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const s = newSave(1);
    s.player.level = 30;
    for (let i = 0; i < 300; i++) {
      const c = makeCandidate(s, rng, 'normal');
      expect(classOf(c.nick.replace(/\d+$/, '')), c.nick).toBe(c.cls);
      expect(s.guild.members.some(m => m.nick === c.nick)).toBe(false);
      if (s.guild.members.length < 60) s.guild.members.push({ ...c, id: s.guild.nextId++ });
    }
  });
});
