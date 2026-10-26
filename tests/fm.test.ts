/** 파티원 능력치 FM식 (97 문서): 1000명 고정 능력치 · 학습력 · 꾸준함 · 빠르기, 공개모집 저마다 레벨, 능력치 → 엔진 값, 능력 ★ */
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/data/classes';
import { abilityStars, BIRTH, dayOffset, fmFx, LV_JITTER, lvAdds, profileOf, ROLE_CORE, STAT_KEYS, STAR, starText, type Stats } from '../src/data/fm';
import { PARTY_POOL, pickMember } from '../src/data/nicknames';
import * as E from '../src/engine';

const ALL = Object.values(PARTY_POOL).flat();
/** 그 사람 역할 (직업 목록에서) */
const roleOf = (m: (typeof ALL)[number]) => CLASSES[(Object.keys(PARTY_POOL) as (keyof typeof PARTY_POOL)[]).find(k => PARTY_POOL[k].includes(m))!].role as 'tank' | 'melee' | 'ranged';
const flat = (v: number): Stats => Object.fromEntries(STAT_KEYS.map(k => [k, v])) as Stats;

describe('1000명 능력치', () => {
  it('닉네임마다 고정 (다시 계산해도 같음), 능력치 · 학습력 · 꾸준함은 1~20 정수', () => {
    for (const m of ALL) {
      expect(profileOf(m.nick, m.pers, roleOf(m))).toEqual(m.fm);
      for (const v of [...Object.values(m.fm.stats), m.fm.learn, m.fm.steady]) {
        expect(Number.isInteger(v), m.nick).toBe(true);
        expect(v, m.nick).toBeGreaterThanOrEqual(1);
        expect(v, m.nick).toBeLessThanOrEqual(20);
      }
    }
  });

  it('타고난 값 = Lv 1 바탕 (104): 칸마다 1~10 고르게, 역할 핵심 넷은 4~10, 평균 6 근처', () => {
    const vs = ALL.flatMap(m => Object.values(m.fm.stats));
    const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
    expect(avg).toBeGreaterThan(5.8);
    expect(avg).toBeLessThan(6.2);
    expect(Math.max(...vs)).toBe(BIRTH.hi);
    for (const m of ALL) for (const k of ROLE_CORE[roleOf(m)]) expect(m.fm.stats[k], `${m.nick} ${k}`).toBeGreaterThanOrEqual(BIRTH.coreLo);
    for (let v = 1; v <= 10; v++) expect(vs.filter(x => x === v).length / vs.length, `${v}`).toBeGreaterThan(0.05); // 고르게
  });


  it('성격 결은 레벨업 때 오를 칸 무게 (104): 딜 욕심쟁이는 Lv 100까지 공격이 침착보다 많이 오름', () => {
    const g = ALL.filter(m => m.pers === '딜 욕심쟁이');
    const up = (k: keyof Stats) => g.reduce((a, m) => a + lvAdds(m.nick, m.pers, roleOf(m), 100, m.fm.stats)[k], 0) / g.length;
    expect(up('atk')).toBeGreaterThan(up('composure') + 4);
  });
});

describe('능력치 → 엔진 값', () => {
  it('모두 10이면 예전 값 그대로 (배율 1 · 더함 0), 위치 잡기만 5 → 1초 한 줄', () => {
    const fx = fmFx(flat(10));
    for (const k of ['dps', 'hp', 'taken', 'move', 'cd', 'react', 'retry', 'flee', 'panic', 'bias'] as const) expect(fx[k], k).toBeCloseTo(1, 9);
    expect(fx.homeWait).toBeCloseTo(5 - 4 * 9 / 19, 9);
    for (const k of ['cut', 'guard', 'focus'] as const) expect(fx[k], k).toBeCloseTo(0, 9);
    expect(fx.dodge).toBeCloseTo(-0.13 + 0.21 * 9 / 19, 9); // 회피 −13%p → +8%p 한 줄 (2026-10-26, 예전 새 층 −2.9%p를 합침)
  });

  it('끝 값 (1 → 20, 2026-10-25 Lim: 공격 · 맷집 · 방어 최대 1.5배 · 위치 잡기 5 → 1초 · 끊기 −50 · +10%p · 반응 × 2 · × 0.5 · 침착 · 판단 × 1.5 · × 0.5)', () => {
    const lo = fmFx(flat(1)), hi = fmFx(flat(20));
    expect([lo.dps, hi.dps]).toEqual([1 / 1.5, 1.5]);
    expect([lo.hp, hi.hp]).toEqual([1 / 1.5, 1.5]);
    expect([lo.taken, hi.taken]).toEqual([1.5, 1 / 1.5]);
    expect([lo.move, hi.move]).toEqual([1.15, 0.8]);
    expect([lo.homeWait, hi.homeWait]).toEqual([5, 1]);
    expect([lo.cut, hi.cut]).toEqual([-0.5, 0.1]);
    expect([lo.react, hi.react]).toEqual([2, 0.5]);
    for (const k of ['retry', 'flee', 'panic', 'bias'] as const) expect([lo[k], hi[k]], k).toEqual([1.5, 0.5]);
    expect([lo.guard, hi.guard]).toEqual([-0.1, 0.1]);
    expect([lo.focus, hi.focus]).toEqual([-0.1, 0.1]); // 집중 1은 큰 판에서 반응 · 회피가 나쁨 (2026-10-26 「1과 10이 같지 않게」, 예전 0). 예전 쫄 처리 딜 배율은 협동으로 바꾸며 뺌
    expect(lo.dodge).toBeCloseTo(-0.13, 9); expect(hi.dodge).toBeCloseTo(0.08, 9);
  });

  it('꾸준함: 20이면 흔들림 없음, 1이면 ±2.5 안, 같은 판 · 같은 사람이면 같은 값', () => {
    for (let s = 1; s <= 50; s++) {
      expect(Math.abs(dayOffset(20, s, '방패든양'))).toBe(0);
      const d = dayOffset(1, s, '방패든양');
      expect(Math.abs(d)).toBeLessThanOrEqual(2.5);
      expect(dayOffset(1, s, '방패든양')).toBe(d);
    }
    expect(new Set(Array.from({ length: 20 }, (_, s) => dayOffset(5, s, '방패든양').toFixed(3))).size).toBeGreaterThan(10);
  });

  it('공개모집 파티원은 엔진 유닛에 능력치 효과가 붙음 (맷집 → 최대 체력)', () => {
    const party = E.recruitParty('plague', 3, { abilities: true });
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 3, party });
    for (const r of party) {
      const u = f.party.find(x => x.nick === r.nick)!;
      expect(u.fm, r.nick).toEqual(fmFx(r.fm!.stats, r.fm!.off));
    }
    // 같은 사람 능력치만 바꾸면 체력이 그만큼
    const tough = party.map(r => ({ ...r, fm: { stats: { ...r.fm!.stats, tough: 20 }, off: 0 } }));
    const weak = party.map(r => ({ ...r, fm: { stats: { ...r.fm!.stats, tough: 1 }, off: 0 } }));
    const hp = (p: typeof party) => E.create({ encounter: 'plague', diff: '보통', seed: 3, party: p }).party.filter(u => !u.me).map(u => u.max);
    const a = hp(tough), b = hp(weak);
    a.forEach((v, i) => expect(v / b[i]).toBeCloseTo(1.5 * 1.5, 5));
  });

  it('내가 칸보다 높아도 공개모집은 칸 레벨 기준: 같은 사람들 · 칸 ±3 (2026-10-26 Lim 「고치기」, 예전엔 내 레벨 기준이라 직업마다 몇 사람만 남음)', () => {
    for (const s of [1, 2, 3, 4]) {
      const same = E.recruitParty('plague', s, { abilities: true, myLv: 60, stageLv: 60 });
      for (const my of [65, 70, 80]) {
        const hi = E.recruitParty('plague', s, { abilities: true, myLv: my, stageLv: 60 });
        expect(hi.map(m => m.nick)).toEqual(same.map(m => m.nick));
        expect(hi.every(m => Math.abs((m.lv ?? 0) - 60) <= 3)).toBe(true);
      }
    }
  });

  it('튜토리얼 파티 (스킬 없음)는 능력치 · 레벨 없음', () => {
    for (const m of E.recruitParty('plague', 5, { myLv: 30, stageLv: 30 })) {
      expect(m.fm).toBeUndefined();
      expect(m.lv).toBeUndefined();
    }
  });
});

describe('공개모집 저마다 레벨 (세상 모험가)', () => {
  it('레벨 = 칸 레벨 ± 1 (내 레벨과 상관없음), 공개모집 표시 (2026-10-26 Lim 「1레벨 기준으로 시작해서 해당 레벨까지」)', () => {
    for (const [my, stage] of [[30, 30], [50, 20], [60, 58], [100, 100], [10, 10], [4, 11]] as const) {
      const lvs = new Set<number>();
      for (let s = 1; s <= 40; s++) {
        for (const m of E.recruitParty('choir', s, { abilities: true, myLv: my, stageLv: stage })) {
          expect(m.pub).toBe(true);
          expect(Math.abs(m.lv! - stage), `${my}/${stage} ${m.nick} ${m.lv}`).toBeLessThanOrEqual(LV_JITTER);
          lvs.add(m.lv!);
        }
      }
      expect(lvs.size).toBe(stage >= 100 ? 2 : 3); // 칸 − 1 · 칸 · 칸 + 1 (100은 99 · 100)
    }
  });

  it('높은 칸도 그 직업 목록 전체가 후보: 많은 판에서 여러 사람이 나옴 (예전 Lv 80 칸은 직업마다 10명 안팎)', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) for (const m of E.recruitParty('choir', s, { abilities: true, myLv: 80, stageLv: 80 })) if (m.role === 'tank') seen.add(m.nick);
    expect(seen.size).toBeGreaterThan(60);
    const any = pickMember('warrior', () => 0.999, new Set(), { tank: true })!;
    expect(PARTY_POOL.warrior.map(m => m.nick)).toContain(any.nick);
  });

  it('내 레벨이 칸보다 낮아도 레벨 = 칸 ± 1', () => {
    for (let s = 1; s <= 20; s++) for (const m of E.recruitParty('plague', s, { abilities: true, myLv: 4, stageLv: 11 })) expect(Math.abs(m.lv! - 11), m.nick).toBeLessThanOrEqual(1);
  });

  it('레벨이 칸보다 높은 사람은 그만큼 강함 (적 레벨 위로 막지 않음)', () => {
    const party = E.recruitParty('choir', 1, { abilities: true, myLv: 40, stageLv: 40 });
    const up = party.map(r => ({ ...r, lv: 43 })), down = party.map(r => ({ ...r, lv: 37 }));
    const hp = (p: typeof party) => E.create({ encounter: 'choir', diff: '보통', seed: 1, party: p, stageLv: 40 }).party.filter(u => !u.me).map(u => u.max);
    const a = hp(up), b = hp(down);
    a.forEach((v, i) => expect(v).toBeGreaterThan(b[i]));
  });
});

describe('능력 ★', () => {
  it('½ 단위 ★½ ~ ★★★★★, Lv 1 평균 (6 안팎)이면 ★★, 같은 레벨 대비 (레벨업 점수 몫을 뺌), 역할 핵심이 높으면 더 많음', () => {
    expect(abilityStars(flat(6.4), 'tank')).toBe(2);
    expect(abilityStars(flat(6.4 + STAR.lv * 99), 'tank', 100)).toBe(2);
    expect(abilityStars(flat(10), 'tank', 40)).toBe(abilityStars(flat(10 - STAR.lv * 39), 'tank'));
    expect(abilityStars(flat(1), 'tank')).toBe(0.5);
    expect(abilityStars(flat(20), 'tank')).toBe(5);
    const core = { ...flat(10), tough: 14, armor: 14, position: 14, judgment: 14 };
    expect(abilityStars(core, 'tank')).toBeGreaterThan(abilityStars(core, 'ranged'));
    expect(starText(3.5)).toBe('★★★½');
    expect(starText(2)).toBe('★★');
  });

  it('1000명 분포 (Lv 1 · 40 · 100 화면 숫자): 평균 ★★ 근처, ★★ 언저리가 가장 많고 ★★★★ 이상은 드묾', () => {
    for (const lv of [1, 40, 100]) {
      const st = ALL.map(m => { const add = lvAdds(m.nick, m.pers, roleOf(m), lv, m.fm.stats); return abilityStars(Object.fromEntries(STAT_KEYS.map(k => [k, m.fm.stats[k] + add[k]])) as Stats, roleOf(m), lv); });
      const mean = st.reduce((a, b) => a + b, 0) / st.length;
      expect(mean, `Lv ${lv}`).toBeGreaterThan(1.8);
      expect(mean, `Lv ${lv}`).toBeLessThan(2.2);
      expect(st.filter(v => v >= 1.5 && v <= 2.5).length / st.length, `Lv ${lv}`).toBeGreaterThan(0.5);
      expect(st.filter(v => v >= 4).length / st.length, `Lv ${lv}`).toBeLessThan(0.05);
    }
  });
});
