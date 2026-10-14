/** 79 힐러 직업 4종 공통 준비 (6-1): 직업 7개 데이터 · 스킬마다 GCD · 모으기 · 가운데 스킬 · 판 위 물건 · 보스 딜 · 힐러 보호막 · 받은 피해 기록 */
import { describe, expect, it } from 'vitest';
import { ASTRO_CHARGE } from '../src/data/heroConst';
import { ALL_HERO_KEYS, CORE_ID, CORE_SKILL, HERO_KEYS, HEROES, heroOfSkill, heroSkills, heroSlotNames, skillAt, slotIdOf, UPDATE_HEROES, type HeroKey } from '../src/data/heroes';
import { SKILL_INFO, SKILLS, type SkillKey } from '../src/data/skills';
import { TALENT_TREES } from '../src/data/talents';
import * as E from '../src/engine';
import { absorbLeft, giveAbsorb } from '../src/engine/abilities';
import { damage, recentDmg } from '../src/engine/core';
import { bossHit } from '../src/engine/fight';
import { chargeCancel, chargeRelease, gcdOf, slotKey, use } from '../src/engine/healer';
import { placeTotem, totemsOf } from '../src/engine/totems';
import { BASE_HEROES } from '../src/sim/balance';
import { migrate } from '../src/platform/storage';

type F = ReturnType<typeof E.create>;
const fight = (hero: HeroKey, o: Partial<Parameters<typeof E.create>[0]> = {}) => {
  const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 100, hero, ...o });
  f.gear.crit = 0;
  return f;
};
const run = (f: F, sec: number) => { for (let i = 0; i < Math.round(sec / E.DT); i++) { E.step(f); f.events.length = 0; } };
/** 보스는 그대로 두고 힐러만 (step은 보스 기술까지 돌아서 판이 바뀜) */
const tank = (f: F) => f.party.find(u => u.role === 'tank')!;
const NEW: HeroKey[] = ['shaman', 'monk', 'astrologer', 'warder'];

describe('직업 7개 데이터 (79 0장 · 1장 · 6-1)', () => {
  it('직업 키 7개, 켠 직업은 기준 세 직업 (79 직업은 직업 PR마다 켬), 곧 열림 이름', () => {
    expect(ALL_HERO_KEYS).toEqual(['priest', 'druid', 'paladin', 'shaman', 'monk', 'astrologer', 'warder']);
    expect(BASE_HEROES).toEqual(['priest', 'druid', 'paladin']);
    for (const h of BASE_HEROES) expect(HERO_KEYS).toContain(h);
    expect(UPDATE_HEROES).toEqual(ALL_HERO_KEYS.filter(h => !HEROES[h].ready).map(h => HEROES[h].name));
  });
  it('열림 레벨 30 · 40 · 50 · 60, 해제 종류 (1-1: 마법 + 하나)', () => {
    expect(NEW.map(h => HEROES[h].unlock.lv)).toEqual([30, 40, 50, 60]);
    expect(HEROES.shaman.dispel).toEqual(['마법', '저주']);
    expect(HEROES.monk.dispel).toEqual(['마법', '질병']);
    expect(HEROES.astrologer.dispel).toEqual(['마법', '독']);
    expect(HEROES.warder.dispel).toEqual(['마법', '저주']);
  });
  it('직업마다 휠 8칸이 다 있고 스킬은 겹치지 않음, 설명이 다 있음', () => {
    const seen = new Set<SkillKey>();
    for (const h of ALL_HERO_KEYS) {
      expect(heroSlotNames(h)).toHaveLength(8);
      for (const k of heroSkills(h)) {
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
        expect(SKILL_INFO[k]?.desc, k).toBeTruthy();
        expect(heroOfSkill(k)).toBe(h);
      }
    }
    expect(Object.keys(SKILLS).length).toBe(26 + 34);
    expect(seen.size).toBe(60);
  });
  it('가운데 스킬: 주술사 샘 토템 · 결계사 심판, 휠 밖 (칸 이름 core)', () => {
    expect(CORE_SKILL).toEqual({ shaman: 'springTotem', warder: 'judgment' });
    expect(heroSkills('shaman').at(-1)).toBe('springTotem');
    expect(heroSkills('warder').at(-1)).toBe('judgment');
    expect(slotIdOf('springTotem')).toBe(CORE_ID);
    expect(skillAt('warder', CORE_ID)).toBe('judgment');
    expect(skillAt('priest', CORE_ID)).toBeNull();
    expect(Object.values(HEROES.shaman.slots)).not.toContain('springTotem');
    expect(slotKey(fight('warder'), CORE_ID)).toBe('judgment');
  });
  it('79 직업은 켤 때 특성 트리 30개 (켜기 전엔 없음)', () => {
    for (const h of NEW) expect(TALENT_TREES[h].flatMap(t => t.picks)).toHaveLength(HEROES[h].ready ? 30 : 0);
  });
  it('저장: 켜지 않은 직업으로 된 옛 저장은 사제로 (저장 판은 그대로)', () => {
    const d = migrate({ v: 13, createdAt: 1, hero: 'warder' });
    expect(d.hero).toBe('priest');
  });
});

describe('스킬마다 GCD (79 6-1)', () => {
  it('수도사 생기 손바닥 GCD 1.0초 (가속 반영), 다른 스킬은 규칙 GCD', () => {
    const f = fight('monk');
    expect(gcdOf(f, 'vitalPalm')).toBeCloseTo(f.gcdBase / 1.5, 9);
    expect(gcdOf(f, 'mistWrap')).toBeCloseTo(f.gcdBase, 9);
    use(f, 'vitalPalm', tank(f).cell);
    expect(f.gcd).toBeCloseTo(f.gcdBase / 1.5, 9);
  });
  it('GCD 0 (차 한 잔): GCD · 시전 중에도 바로 나가고 시전을 끊지 않음, GCD를 안 바꿈', () => {
    const f = fight('monk');
    use(f, 'mistWrap', tank(f).cell);
    const g = f.gcd, cast = f.cast;
    expect(cast).not.toBeNull();
    const r = use(f, 'tea', 0);
    expect(r.ok).toBe(true);
    expect(r.queued).toBeFalsy();
    expect(f.cast).toBe(cast);
    expect(f.gcd).toBe(g);
    expect(f.cd.tea).toBe(60);
  });
});

describe('모으기 (점성술사 별자리 잇기, 79 4-3)', () => {
  const ready = () => { const f = fight('astrologer'); f.gear.haste = 0; return f; };
  it('누르면 별 1개, 0.5초마다 1개씩 4개까지, 모으는 동안 다른 스킬은 무시 (예약 안 함)', () => {
    const f = ready(), t = tank(f);
    expect(use(f, 'starfall', t.cell).ok).toBe(true);
    expect(f.charge!.stars).toBe(1);
    expect(use(f, 'starHeal', t.cell).ok).toBe(false);
    expect(f.queued).toBeNull();
    run(f, 0.55);
    expect(f.charge!.stars).toBe(2);
    run(f, 1.0);
    expect(f.charge!.stars).toBe(4);
    expect(f.charge!.full).not.toBeNull();
  });
  it('뗄 때 마나 · 재사용, 완벽 구간 안이면 완벽', () => {
    const f = ready(), t = tank(f), m0 = f.mana;
    use(f, 'polaris', t.cell);
    run(f, 1.6); // 4번째 별 (1.5초) 뒤 0.1초
    let out: unknown = null;
    const orig = f.chargeOut;
    expect(orig).toBeNull();
    expect(chargeRelease(f).ok).toBe(true);
    out = f.cd.polaris;
    expect(out).toBe(30);
    expect(f.mana).toBeLessThan(m0);
  });
  it('마지막 별 뒤 1초가 지나도 안 떼면 저절로 터짐 (완벽 아님)', () => {
    const f = ready(), t = tank(f);
    use(f, 'starfall', t.cell);
    run(f, 1.5 + ASTRO_CHARGE.auto + 0.1);
    expect(f.charge).toBeNull();
    expect(f.cd.starfall).toBeGreaterThan(0);
  });
  it('취소: 마나 · 재사용 없이, 북극성 대상이 쓰러지면 취소', () => {
    const f = ready(), t = tank(f), m0 = f.mana;
    use(f, 'polaris', t.cell);
    chargeCancel(f);
    expect(f.charge).toBeNull();
    expect(f.mana).toBeCloseTo(m0, 1);
    expect(f.cd.polaris ?? 0).toBe(0);
    use(f, 'polaris', t.cell);
    t.hp = 1; damage(f, t, 1e9, false, 'fixed');
    run(f, 0.1);
    expect(f.charge).toBeNull();
    expect(f.cd.polaris ?? 0).toBe(0);
  });
  it('GCD 중에 누르면 GCD가 끝난 뒤 별이 모이기 시작', () => {
    const f = ready(), t = tank(f);
    use(f, 'twinkle', t.cell);
    expect(f.gcd).toBeGreaterThan(0);
    use(f, 'starfall', t.cell);
    expect(f.charge!.stars).toBe(0);
    run(f, f.gcdBase + 0.1);
    expect(f.charge!.stars).toBe(1);
  });
  it('별 조각이 있으면 그만큼 별을 단 채로 시작 (조각은 다 씀)', () => {
    const f = ready(), t = tank(f);
    f.shards = 2;
    use(f, 'starfall', t.cell);
    expect(f.charge!.stars).toBe(3);
    expect(f.shards).toBe(0);
  });
});

describe('가운데 스킬 · 칸 스킬 (79 6-1)', () => {
  it('샘 토템: 무너진 바닥은 안 됨, 칸에 쓰면 마나 · 재사용 · GCD', () => {
    const f = fight('shaman'), c = f.cells.find(x => !x.unit)!;
    c.block = 'hole';
    expect(use(f, 'springTotem', c.i).ok).toBe(false);
    c.block = undefined;
    const m0 = f.mana;
    expect(use(f, 'springTotem', c.i).ok).toBe(true);
    expect(f.mana).toBeLessThan(m0);
    expect(f.cd.springTotem).toBe(10);
    expect(f.gcd).toBeGreaterThan(0);
  });
  it('GCD 중에 고른 칸은 칸 그대로 예약', () => {
    const f = fight('shaman'), c = f.cells.find(x => !x.unit)!;
    use(f, 'shower', tank(f).cell);
    use(f, 'springTotem', c.i);
    // 소나기 시전 중이면 시전이 끊기고, GCD 중이면 예약
    expect(f.queued?.cell ?? c.i).toBe(c.i);
  });
  it('심판 (대상 없는 시전): 2초 시전이 끝나면 나간다 (대상 쓰러짐으로 취소되지 않음)', () => {
    const f = fight('warder'), m0 = f.mana;
    expect(use(f, 'judgment', 0).ok).toBe(true);
    expect(f.cast?.key).toBe('judgment');
    run(f, 2.1);
    expect(f.cast).toBeNull();
    expect(f.mana).toBeLessThan(m0 + 2.1 * f.R.regen * 1.5);
    expect(f.stats.casts.judgment).toBe(1);
  });
});

describe('판 위 물건 (79 6-1 · 2-3)', () => {
  it('종류마다 하나 (max면 그만큼), 넘으면 가장 오래된 것이 사라짐', () => {
    const f = fight('shaman'), cs = f.cells.filter(x => !x.block).map(x => x.i);
    placeTotem(f, 'spring', cs[0], 15);
    placeTotem(f, 'spring', cs[1], 15);
    expect(totemsOf(f, 'spring').map(t => t.cell)).toEqual([cs[1]]);
    placeTotem(f, 'spring', cs[2], 15, { max: 2 });
    expect(totemsOf(f, 'spring').map(t => t.cell)).toEqual([cs[1], cs[2]]);
    placeTotem(f, 'earth', cs[0], 10);
    expect(f.totems).toHaveLength(3);
  });
  it('시간이 다 되면 사라지고, 장판 · 쫄 · 이번 틱에 맞는 예고 칸이면 깨짐 (firm은 안 깨짐)', () => {
    const f = fight('shaman'), cs = f.cells.filter(x => !x.block).map(x => x.i);
    placeTotem(f, 'spring', cs[0], 0.5);
    run(f, 0.6);
    expect(f.totems).toHaveLength(0);
    placeTotem(f, 'spring', cs[1], 15);
    placeTotem(f, 'sea', cs[1], 15, { firm: true });
    f.zones.push({ id: 999, cells: new Set([cs[1]]), end: f.t + 5, dps: 0 });
    run(f, 0.1);
    expect(f.totems.map(t => t.kind)).toEqual(['sea']);
    f.zones = [];
    placeTotem(f, 'earth', cs[2], 15);
    f.cells[cs[2]].block = 'add';
    run(f, 0.1);
    expect(totemsOf(f, 'earth')).toHaveLength(0);
  });
});

describe('보스 딜 · 보호막 · 받은 피해 기록', () => {
  it('bossHit: 딜러 한 명 평균 딜 × 초만큼 보스 체력이 줄고 통계에 쌓임', () => {
    const f = fight('warder'), b0 = f.bossHp;
    const done = bossHit(f, 1.5);
    expect(done).toBeCloseTo(10 * f.scale * 1.5, 6);
    expect(f.bossHp).toBeCloseTo(b0 - done, 6);
    expect(f.stats.healerDmg).toBeCloseTo(done, 6);
    f.invuln = true;
    expect(bossHit(f, 1)).toBe(0);
  });
  it('힐러 보호막: 남은 양에 더하고 최대 체력 × cap까지, 피해를 먼저 받음', () => {
    const f = fight('warder'), t = tank(f);
    expect(giveAbsorb(f, t, t.max * 0.4, 15, 0.6)).toBeCloseTo(t.max * 0.4, 6);
    expect(giveAbsorb(f, t, t.max * 0.4, 15, 0.6)).toBeCloseTo(t.max * 0.2, 6);
    expect(absorbLeft(f, t)).toBeCloseTo(t.max * 0.6, 6);
    const hp0 = t.hp;
    damage(f, t, (t.max * 0.3) / f.dmgMult, false, 'fixed');
    expect(t.hp).toBeCloseTo(hp0, 6);
    expect(absorbLeft(f, t)).toBeCloseTo(t.max * 0.3, 6);
    damage(f, t, (t.max * 0.5) / f.dmgMult, false, 'fixed');
    expect(absorbLeft(f, t)).toBe(0);
    expect(t.hp).toBeCloseTo(hp0 - t.max * 0.2, 6);
  });
  it('점성술사 전투만 받은 피해를 0.5초 칸으로 기록 (최근 4초 · 6초)', () => {
    const f = fight('astrologer'), t = tank(f);
    damage(f, t, 100 / f.dmgMult, false, 'fixed');
    run(f, 1);
    damage(f, t, 50 / f.dmgMult, false, 'fixed');
    const got = recentDmg(f, t, 4);
    expect(got).toBeGreaterThanOrEqual(150);
    run(f, 5);
    expect(recentDmg(f, t, 4)).toBeLessThan(got);
    const p = fight('priest'), pt = tank(p);
    damage(p, pt, 100 / p.dmgMult, false, 'fixed');
    expect(pt.dmgLog).toBeUndefined();
  });
});
