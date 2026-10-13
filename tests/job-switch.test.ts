/** v12: 한 캐릭터 공통 성장, 직업별 세팅, 출전 직업 장비 보상 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UNIQUES } from '../src/data/uniques';
import { ITEM_GRADES, itemSpecs, makeItem, SLOTS, specsOf } from '../src/data/equipment';
import { HERO_KEYS } from '../src/data/heroes';
import { SPECS, SPEC_KEYS, specTotals } from '../src/data/specials';
import * as E from '../src/engine';
import { heal } from '../src/engine/core';
import { under } from '../src/engine/specials';
import { cdOf, costOf } from '../src/engine/talents';
import { rngFrom } from '../src/engine/rng';
import { claimChalChest, raidLootOpen, rollover } from '../src/game/economy';
import { Flow } from '../src/game/flow';
import { settle, type BattleResult } from '../src/game/settle';
import { equip, G, heroStatus, makeChar, pickChar, salvage, switchHero } from '../src/game/state';
import { migrate, newSave, save, load, heroSaveOf, type KV } from '../src/platform/storage';

const now = new Date(2026, 9, 14, 12).getTime();
const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '어려움', win: true, quit: false, reason: '', segIdx: 3, segN: 4,
  time: 90, restSec: 0, deaths: 0, healed: 7000, overheal: 100, dispels: 1, dispellable: 1,
  endMana: 80, minMana: 60, auto: false, party: [], detail: [], stage: 30, ...o,
});
const owned = () => [...G.save.gear.bag, ...Object.values(G.save.gear.equipped).filter(x => !!x)].map(x => x!.id).sort((a,b) => a-b);
const fresh = () => {
  G.save = newSave(now); G.save.tut = 3; G.save.settings.devUnlock = false;
  G.save.player = { level: 30, xp: 123, gold: 456 }; G.save.mats = { stone: 78, refined: 9 };
  G.save.roster.slots = 2; rollover(G.save, now, () => .5); Flow.running = false;
};
afterEach(() => { Flow.running = false; });

describe('공통 성장과 직업별 착용 조합', () => {
  beforeEach(fresh);
  it('무료 전환은 현재 캐릭터·레벨·경험치·재화·진행을 그대로 유지', () => {
    const d = G.save, snapshot = JSON.stringify([d.player, d.mats, d.daily, d.weekly, d.wallet, d.clears, d.guild, d.pass]);
    const w = makeItem(() => .5, 'weapon', '희귀', 1); w.plus = 5; w.specs = [{ key: 'deepWord', roll: 1 }];
    d.gear.equipped.weapon = w;
    for (const h of ['druid', 'paladin', 'priest'] as const) {
      expect(switchHero(h, now)).toBe(true);
      expect(G.save).toBe(d); expect(d.roster.cur).toBe(1); expect(d.roster.chars).toHaveLength(1);
      expect(JSON.stringify([d.player, d.mats, d.daily, d.weekly, d.wallet, d.clears, d.guild, d.pass])).toBe(snapshot);
      expect(d.gear.equipped.weapon).toBe(w);
      expect(d.gear.equipped.weapon!.plus).toBe(5);
      expect(!!specsOf(d.gear.equipped, h).deepWord).toBe(h === 'priest');
    }
  });
  it('해금 경계와 이전 사용 직업 보존: 드루이드 10, 성기사 20', () => {
    G.save.player.level = 9; expect(switchHero('druid')).toBe(false);
    G.save.player.level = 10; expect(switchHero('druid')).toBe(true);
    expect(heroStatus('paladin').state).toBe('locked');
    G.save.player.level = 20; expect(switchHero('paladin')).toBe(true);
    G.save.player.level = 1; expect(switchHero('druid')).toBe(true);
  });
  it('다른 캐릭터의 높은 레벨이나 직업을 가져오지 않음', () => {
    makeChar('paladin', '', now);
    expect(G.save.roster.cur).toBe(2); expect(G.save.player.level).toBe(1);
    expect(switchHero('druid')).toBe(false);
    expect(switchHero('priest')).toBe(true);
    expect(G.save.player.level).toBe(1); expect(G.save.player.gold).toBe(0);
    expect(pickChar(1, now)).toBe(true); expect(G.save.player.level).toBe(30);
  });
  it('아이템 ID로 세팅을 복원하며 강화된 같은 실물을 사용, 분해한 아이템은 재생성하지 않음', () => {
    const one = makeItem(() => .5, 'weapon', '희귀', 1), two = makeItem(() => .5, 'weapon', '희귀', 2);
    G.save.gear.equipped.weapon = one; G.save.gear.bag = [two];
    switchHero('druid'); equip(2); two.plus = 7;
    switchHero('priest'); expect(G.save.gear.equipped.weapon?.id).toBe(1);
    switchHero('druid'); expect(G.save.gear.equipped.weapon).toBe(two); expect(two.plus).toBe(7);
    expect(owned()).toEqual([1,2]);
    salvage([1]); switchHero('priest');
    expect(owned()).toEqual([2]); expect(G.save.gear.equipped.weapon).toBeUndefined();
    switchHero('druid'); expect(owned()).toEqual([2]); expect(G.save.gear.equipped.weapon?.id).toBe(2);
  });
  it('스킬 설정·특성을 직업별로 보관하고 기기 저장 후 복원', () => {
    G.save.settings.tapKey = 'flash'; G.save.settings.layout = { N: 'hymn' };
    heroSaveOf(G.save, 'priest').talents = [2,1];
    switchHero('druid'); G.save.settings.tapKey = 'renew'; heroSaveOf(G.save, 'druid').talents = [0];
    const m = new Map<string,string>(); const kv: KV = { getItem: k => m.get(k) ?? null, setItem: (k,v) => { m.set(k,v); } };
    save(G.save, kv); G.save = load(kv);
    switchHero('priest'); expect(G.save.settings.tapKey).toBe('flash'); expect(G.save.settings.layout).toEqual({ N: 'hymn' });
    expect(G.save.heroes.priest?.talents).toEqual([2,1]);
    switchHero('druid'); expect(G.save.settings.tapKey).toBe('renew'); expect(G.save.heroes.druid?.talents).toEqual([0]);
  });
  it('출발부터 정산까지 (휴식 포함) 직업·캐릭터 전환 불가', () => {
    makeChar('druid', '', now); pickChar(1, now); Flow.running = true;
    expect(switchHero('druid')).toBe(false); expect(pickChar(2)).toBe(false); expect(makeChar('paladin')).toMatch(/정산/);
    Flow.running = false; expect(switchHero('druid')).toBe(true);
  });
  it('v11 저장의 다른 캐릭터·유료 칸·자산을 합치거나 삭제하지 않음', () => {
    makeChar('druid', '', now); const raw = JSON.parse(JSON.stringify(G.save)); raw.v = 11;
    raw.weekly.loot = ['priest|abyss1|보통','druid|abyss1|보통'];
    const s = migrate(raw);
    expect(s.roster).toEqual(raw.roster); expect(s.gear).toEqual(raw.gear); expect(s.player).toEqual(raw.player);
    expect(s.weekly.loot).toEqual(['abyss1|보통']);
    expect(s.roster.chars[0].park!.player).toEqual({ level: 30, xp: 123, gold: 456 });
  });
});

describe('클리어 직업과 보상 횟수', () => {
  beforeEach(fresh);
  it('직업을 바꿔도 레이드 장비·공훈 상한·첫 클리어 보상을 다시 받지 않음', () => {
    const r = result({ hero: 'priest', content: 'abyss1' });
    const a = settle(G.save, r, () => .5, [], now);
    expect(a.items).toHaveLength(1); const crystal = G.save.wallet.crystal;
    G.save.weekly.merit[10] = 150;
    switchHero('druid', now);
    const b = settle(G.save, { ...r, hero: 'druid' }, () => .5, [], now);
    expect(b.items).toHaveLength(0); expect(b.lootLocked).toBe(true); expect(b.merit).toBe(0);
    expect(b.first).toBe(false); expect(G.save.wallet.crystal).toBe(crystal);
    expect(raidLootOpen(G.save, 'abyss1', '어려움')).toBe(false);
    expect(G.save.heroes.priest?.wins).toBe(1); expect(G.save.heroes.druid?.wins).toBe(1);
  });
  it('드롭·클리어 기록은 결과의 출전 직업 기준', () => {
    const rng = rngFrom(7);
    const xs = Array.from({length:100}, () => settle(G.save, result({ hero: 'druid' }), rng, [], now));
    const defs = xs.flatMap(x => x.items).flatMap(itemSpecs).map(s => SPECS[s.key]).filter(d => d?.hero);
    expect(defs.length).toBeGreaterThan(0); expect(defs.every(d => d.hero === 'druid')).toBe(true);
    expect(G.save.heroes.druid?.wins).toBe(100); expect(G.save.heroes.priest?.wins ?? 0).toBe(0);
  });
  it('주간 상자는 다른 직업에서 받아도 최고 기록 직업 장비, 한 번만 지급', () => {
    G.save.chalChest = 20; G.save.chalChestHero = 'druid';
    const g = claimChalChest(G.save, () => .1, now);
    expect(typeof g).toBe('object'); if (typeof g === 'string') throw new Error(g);
    expect(g.items).toHaveLength(2);
    for (const it of g.items!) expect(itemSpecs(it).filter(s => SPECS[s.key]?.hero).map(s => SPECS[s.key].hero)).toEqual(['druid']);
    switchHero('druid'); expect(claimChalChest(G.save, () => .5, now)).toMatch(/없음/);
  });
  it('실패·포기에는 전용 장비나 클리어 기록을 지급하지 않음', () => {
    expect(settle(G.save, result({ win: false, quit: true }), () => .5, [], now).items).toEqual([]);
    expect(G.save.heroes.priest?.wins ?? 0).toBe(0);
  });
});

describe('직업별 드롭 풀', () => {
  it('직업마다 16종, 그중 8종 신규 효과', () => {
    for (const hero of HERO_KEYS) {
      const ds = SPEC_KEYS.map(k => SPECS[k]).filter(d => d.hero === hero);
      expect(ds).toHaveLength(16); expect(ds.filter(d => d.skillMod)).toHaveLength(8);
    }
  });
  it('전 부위 희귀·영웅·일반 전설: 1줄 유지, 전용 약 70%, 타 직업 효과 없음', () => {
    const r = rngFrom(714); let jobs = 0, count = 0;
    for (const hero of HERO_KEYS) for (const slot of SLOTS) for (const grade of ['희귀','영웅','전설'] as const) for (let i=0; i<80; i++) {
      const it = makeItem(r, slot.key, grade, i, undefined, { hero, classLoot: true });
      const specs = itemSpecs(it).map(s => SPECS[s.key]);
      const job = specs.filter(d => d.hero);
      expect(job.every(d => d.hero === hero)).toBe(true); jobs += job.length; count++;
      expect(new Set(specs.map(d => d.group)).size).toBe(specs.length);
      expect(specs.length).toBe(1);
      for (const d of specs) expect(ITEM_GRADES.indexOf(d.min)).toBeLessThanOrEqual(ITEM_GRADES.indexOf(grade));
    }
    expect(jobs/count).toBeGreaterThan(.67); expect(jobs/count).toBeLessThan(.73);
  });
  it('등급·전설 고유 효과 계약 유지: 일반은 특수능력 없음, 고급은 확률, 고유 전설은 원래 효과', () => {
    expect(itemSpecs(makeItem(() => .1, 'weapon', '일반', 1, undefined, { hero: 'priest', classLoot: true }))).toEqual([]);
    const r = rngFrom(7), advanced = Array.from({length:100},(_,i) => makeItem(r,'head','고급',i,undefined,{hero:'druid',classLoot:true}));
    expect(advanced.some(it => !it.specs?.length)).toBe(true); expect(advanced.some(it => it.specs?.length)).toBe(true);
    const def = UNIQUES[0];
    const un = makeItem(() => 0, def.slot, '전설', 1, undefined, { hero:'priest', classLoot:true, place:def.place });
    expect(un.unique).toBeTruthy(); expect(itemSpecs(un)).toHaveLength(1);
  });
});

describe('신규 전용 효과: 실제 엔진 훅', () => {
  const defs = SPEC_KEYS.map(k => SPECS[k]).filter(d => !!d.skillMod);
  for (const d of defs) it(`${d.name}: 해당 직업·스킬만 적용, 상한 유지`, () => {
    const mod = d.skillMod!;
    const create = (on: boolean, other = false) => {
      const f = E.create({ encounter:'warden', diff:'보통', seed:7, level:100, hero: other ? HERO_KEYS.find(h => h !== d.hero)! : d.hero,
        specs:on ? specTotals([{key:d.key,v:d.val}],d.hero!) : {}});
      f.gear.crit=0; f.power=1; f.gear.heal=1; f.standin=null;
      return f;
    };
    const a=create(true), b=create(false), off=create(true,true), baseOff=create(false,true);
    if (mod.kind==='heal') {
      const amount = (f: typeof a) => { const u=f.party.find(u => u.role==='tank')!; u.max=100000; u.hp=1; return under(mod.key,true,()=>heal(f,u,100,false)); };
      expect(amount(a)/amount(b)).toBeCloseTo(1+d.val,6); expect(amount(off)).toBeCloseTo(amount(baseOff),6);
    } else if (mod.kind==='cost') {
      expect(costOf(b,mod.key)).toBeGreaterThan(0);
      expect(costOf(a,mod.key)/costOf(b,mod.key)).toBeCloseTo(1-d.val,6);
      expect(costOf(off,mod.key)).toBe(costOf(baseOff,mod.key));
    } else {
      expect(cdOf(b,mod.key)).toBeGreaterThan(0);
      expect(cdOf(a,mod.key)/cdOf(b,mod.key)).toBeCloseTo(1-d.val,6);
      expect(cdOf(off,mod.key)).toBe(cdOf(baseOff,mod.key));
    }
    const cap=specTotals(Array.from({length:6},()=>({key:d.key,v:d.val})),d.hero!)[d.key];
    expect(cap).toBeLessThanOrEqual(d.cap!);
    expect(specTotals([{key:d.key,v:d.val}],HERO_KEYS.find(h=>h!==d.hero)!)).toEqual({});
  });
});

describe('실제 스킬 시전과 지속 치유 연결', () => {
  for (const [hero,key,spec] of [
    ['priest','heal','steadyPrayer'], ['druid','sprout','tenderSprout'], ['paladin','holyStrike','radiantStrike'],
  ] as const) it(`${hero} ${key}: 시전 또는 지속 틱에 장비 효과 적용`, () => {
    const amount = (on:boolean) => {
      const f=E.create({encounter:'warden',diff:'보통',seed:14,level:100,hero,specs:on?{[spec]:SPECS[spec].val}:{}});
      f.standin=null; f.gear.crit=0; f.gear.heal=1; f.power=1;
      f.skills.forEach(sk=>{sk.next=Infinity;});
      for (const u of f.party) {u.max=u.base=1e6;u.hp=1000;u.ab=null;}
      const u=f.party.find(u=>u.role==='tank')!;
      expect(E.use(f,key,u.cell).ok).toBe(true);
      for (let i=0;i<160;i++) {
        if (u.got > 0) return u.got;
        E.step(f);
      }
      throw new Error('회복 이벤트 없음');
    };
    expect(amount(true)/amount(false)).toBeCloseTo(1+SPECS[spec].val,2);
  });
});
