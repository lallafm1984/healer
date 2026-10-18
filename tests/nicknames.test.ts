/** 파티원 닉네임 (74 문서 · 97 FM): 직업별 목록 1000개 (200 + 새 800), 직업군 비율, 공개모집 · 길드 지원자는 자기 직업 목록에서 */
import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../src/data/classes';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import { CLASS_NICKS, PARTY_POOL, pickNick, STORY_NICKS } from '../src/data/nicknames';
import { PERS, PERS_NAMES } from '../src/data/personalities';
import * as E from '../src/engine';
import { makeCandidates } from '../src/game/guild';
import { newSave } from '../src/platform/storage';

const ALL = Object.values(CLASS_NICKS).flat();
const classOf = (nick: string) => (Object.keys(CLASS_NICKS) as ClassKey[]).find(k => CLASS_NICKS[k].includes(nick));
/** 그 직업이 가질 수 있는 성격: 탱커 불가 · 탱커 묶음, 끊기 욕심은 끊기 능력이 있는 직업만 (95) */
const ELIGIBLE = (k: ClassKey) => PERS_NAMES.filter(p => !((CLASSES[k].role === 'tank' ? 'noTank' : 'tankOnly') in PERS[p])
  && (p !== '끊기 욕심' || Object.values(ABILITIES).some(a => a.cls === k && a.fx.e === 'interrupt')));

describe('닉네임 데이터', () => {
  it('1000개 (97 FM: 직업마다 × 5) · 직업군 비율 탱커 25% · 근접 30% · 원거리 45%', () => {
    expect(ALL.length).toBe(1000);
    expect(Object.fromEntries(Object.entries(CLASS_NICKS).map(([k, v]) => [k, v.length]))).toEqual({
      warrior: 125, paladin: 125, rogue: 100, berserker: 100, swordsman: 100, mage: 150, archer: 150, hunter: 150,
    });
    const byRole = { tank: 0, melee: 0, ranged: 0 };
    for (const k of RECRUIT_CLASSES) byRole[CLASSES[k].role] += CLASS_NICKS[k].length;
    expect(byRole).toEqual({ tank: 250, melee: 300, ranged: 450 });
  });

  it('2~5자, 띄어쓰기 없음, 숫자로 끝나지 않음 (다 쓰면 붙는 번호와 헷갈림), 모두 다름', () => {
    for (const n of ALL) {
      expect([...n].length, n).toBeGreaterThanOrEqual(2);
      expect([...n].length, n).toBeLessThanOrEqual(5);
      expect(n, n).toMatch(/^[가-힣0-9]*[가-힣]$/);
    }
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it('스토리 동료 · 성격 · 직업 · 보스 · 능력 이름과 겹치지 않음', () => {
    const taken = new Set<string>([...STORY_NICKS, ...PERS_NAMES, ...Object.values(CLASSES).map(c => c.name)]);
    for (const e of Object.values(ENCOUNTERS)) for (const w of e.name.split(/\s+/)) taken.add(w);
    for (const a of Object.values(ABILITIES)) taken.add(a.name.replace(/\s+/g, ''));
    expect(ALL.filter(n => taken.has(n))).toEqual([]);
  });

  it('성격을 직업마다 고르게 (75 · 95 · 97): 직업마다 고를 수 있는 성격이 모두 있고 한쪽에 몰리지 않음, 탱커 직업엔 탱커 불가 없음 · 딜러 직업엔 탱커 묶음 없음, 70종 모두 14~16명', () => {
    for (const k of RECRUIT_CLASSES) {
      const ps = PARTY_POOL[k].map(m => m.pers), tank = CLASSES[k].role === 'tank';
      expect(ps.filter(p => (tank ? 'noTank' : 'tankOnly') in PERS[p]), k).toEqual([]);
      expect(ELIGIBLE(k).filter(p => !ps.includes(p)), k).toEqual([]);
      // 탱커 묶음 6종 (14명씩)은 두 탱커 직업에만 있어 탱커 직업은 한 성격 9명까지, 딜러 직업은 3명까지
      const most = Math.max(...ELIGIBLE(k).map(p => ps.filter(x => x === p).length));
      expect(most, k).toBeLessThanOrEqual(tank ? 9 : 3);
    }
    const all = Object.values(PARTY_POOL).flat();
    for (const p of PERS_NAMES) {
      const n = all.filter(m => m.pers === p).length;
      expect(n, p).toBeGreaterThanOrEqual(14);
      expect(n, p).toBeLessThanOrEqual(16);
    }
    // 생존기 성격 (미리미리 · 아슬아슬)은 방어 능력, 끊기 욕심은 끊기 능력을 가진 파티원 (95)
    for (const m of all) {
      if (m.pers === '미리미리' || m.pers === '아슬아슬') expect(ABILITIES[m.ab].kind, m.nick).toBe('def');
      if (m.pers === '끊기 욕심') expect(ABILITIES[m.ab].fx.e, m.nick).toBe('interrupt');
    }
  });

  it('직업 스킬은 그 직업 것, 등급은 공개모집 확률대로 (탱커 80 · 35 · 10, 근접 65 · 30 · 5, 원거리 100 · 40 · 10)', () => {
    const want = { tank: [80, 35, 10], melee: [65, 30, 5], ranged: [100, 40, 10] };
    for (const k of RECRUIT_CLASSES) {
      const g = PARTY_POOL[k].map(m => { expect(ABILITIES[m.ab]?.cls, m.ab).toBe(k); return ABILITIES[m.ab].grade; });
      expect(['common', 'rare', 'epic'].map(x => g.filter(y => y === x).length), k).toEqual(want[CLASSES[k].role]);
    }
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

  it('파티원 = 목록 그대로 (이름 · 성격 · 직업 스킬), 같은 시드 같은 파티, 튜토리얼 파티는 스킬 없음', () => {
    for (let s = 1; s <= 30; s++) {
      const b = E.recruitParty('plague', s, { abilities: true });
      for (const m of b) {
        const x = PARTY_POOL[m.cls!].find(y => y.nick === m.nick)!;
        expect({ nick: x.nick, pers: x.pers, ab: x.ab }).toEqual({ nick: m.nick, pers: m.pers, ab: m.ab });
        expect(m.fm!.stats).toEqual(x.fm.stats); // 97: 능력치는 그 사람 것 그대로
      }
      expect(E.recruitParty('plague', s, { abilities: true })).toEqual(b);
      expect(E.recruitParty('plague', s).every(m => !m.ab)).toBe(true);
    }
  });

  it('저레벨 던전 (04 6-F): 희귀 성격 없음 · 탱커 ★1 · ★★★ 파티당 1명까지', () => {
    for (let s = 1; s <= 200; s++) {
      const p = E.recruitParty('warden', s);
      expect(p.some(m => 'rare' in PERS[m.pers])).toBe(false);
      expect(p.filter(m => m.role === 'tank').every(m => PERS[m.pers].star === 1)).toBe(true);
      expect(p.filter(m => PERS[m.pers].star === 3).length).toBeLessThanOrEqual(1);
    }
  });

  it('희귀 성격은 덜 나옴 (가중치 0.4), 탱커 불가 성격은 탱커로 안 나옴', () => {
    let rare = 0, all = 0;
    for (let s = 1; s <= 300; s++) for (const m of E.recruitParty('choir', s)) {
      all++; if ('rare' in PERS[m.pers]) rare++;
      if (m.role === 'tank') expect('noTank' in PERS[m.pers]).toBe(false);
    }
    expect(rare / all).toBeLessThan(4 / 30 * 0.7);
    expect(rare / all).toBeGreaterThan(0.02);
  });

  it('길드 지원자도 자기 직업 목록에서, 길드원과 겹치지 않음', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const s = newSave(1);
    s.player.level = 30;
    for (let i = 0; i < 300; i++) {
      const c = makeCandidates(s, 'normal', 'any', rng)[0];
      expect(classOf(c.nick.replace(/\d+$/, '')), c.nick).toBe(c.cls); // 목록 이름은 숫자로 끝나지 않음
      expect(s.guild.members.some(m => m.nick === c.nick)).toBe(false);
      if (s.guild.members.length < 60) s.guild.members.push({ ...c, id: s.guild.nextId++ });
    }
  });
});
