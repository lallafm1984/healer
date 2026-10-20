/**
 * 길드 v2 (93 · FM 97, 사슬 4번): 열림 · 스킬 레벨 · 길드 Lv · 정원 · 결성 · 공고 · 명성 지원자 영입 · 관리 · 규모별 편성 ·
 * 출전 경험 (레벨 · 능력치) · 명성 · 첫 처치 · 정산 · 저장 v19.
 * 출시판은 길드를 빼 둘 수 있으므로 (features.ts) 맨 위 「빼 둠」 말고는 길드를 켜고 검사한다.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { RECRUIT_CLASSES, type ClassKey } from '../src/data/classes';
import { ENCOUNTERS } from '../src/data/encounters';
import { FEATURES } from '../src/data/features';
import {
  deedOf, FAME, GUILD_MAX, GUILD_NEED, GUILD_STEPS, guildLvOf, habitOf, POST, postGold, REST_SHARE, rerollGold, SPONSOR, sponsorGold, memberSkillLevel, spendPoints, statPerLevel, statWeights, STORY, type GuildMember,
} from '../src/data/guild';
import { birthV25, growthOf, growWeights, lvAdds, lvPoints, STAT_KEYS, type Stats } from '../src/data/fm';
import { DAILY, GUILD_GOAL } from '../src/data/missions';
import { PARTY_POOL, STORY_NICKS } from '../src/data/nicknames';
import { PERS } from '../src/data/personalities';
import { clearXp, xpToNext } from '../src/data/progression';
import * as E from '../src/engine';

import { claimGuildGoal, rollover } from '../src/game/economy';
import * as Gd from '../src/game/guild';
import { abilityFeatures, encFeatures, REC, recommendPick, recScore } from '../src/game/recommend';
import { settle, type BattleResult } from '../src/game/settle';
import { TUT } from '../src/game/tutorial';
import { doubleV27, migrate, newSave, SAVE_VERSION, statsV26, type SaveData } from '../src/platform/storage';
import { contentOf } from '../src/data/content';

let seed = 1;
/** v26 · v27 옮김 뒤 길드원 (새 바탕 + 지난 레벨 두 배 몫) */
const dbl = (m: GuildMember): GuildMember => { const x = JSON.parse(JSON.stringify(m)) as GuildMember; doubleV27(x); return x; };
const v27 = (m: GuildMember): GuildMember => dbl({ ...m, stats: statsV26(m) });
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function save(level = 15, gold = 100000): SaveData {
  const s = newSave(1);
  s.tut = TUT.done; s.player.level = level; s.player.gold = gold; s.settings.devUnlock = false;
  return s;
}
const nickOf = (cls: ClassKey, i = 0) => PARTY_POOL[cls][i].nick;
/** 1000명 줄의 사람을 길드원으로 (결성은 지난 것으로) */
function add(s: SaveData, cls: ClassKey = 'warrior', i = 0, o: Partial<GuildMember> = {}): GuildMember {
  const m: GuildMember = { ...Gd.newMember(s, Gd.personOf(nickOf(cls, i))!, s.player.level), ...o, id: s.guild.nextId++ };
  s.guild.members.push(m);
  s.guild.founded = s.guild.storySeen = true;
  return m;
}
const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 3, time: 200, restSec: 0, deaths: 0, healed: 1000, overheal: 100,
  dispels: 0, dispellable: 0, endMana: 50, minMana: 20, auto: false, party: [], detail: [], ...o,
});
const entry = (s: SaveData, m: GuildMember) => Gd.memberEntry(s, m);

beforeAll(() => { FEATURES.guild = true; });

describe('길드를 빼 두면', () => {
  beforeAll(() => { FEATURES.guild = false; });
  afterAll(() => { FEATURES.guild = true; });
  it('Lv 30이어도 안 열리고, 판 뒤 결성 · 길드 정산 없음', () => {
    const s = save(30);
    s.settings.devUnlock = true;
    expect(Gd.guildOpen(s).ok).toBe(false);
    const m = add(s, 'warrior', 0, { lv: 25 });
    const x = settle(s, result({ party: [{ nick: m.nick, pers: m.pers, role: 'tank', alive: true, got: 10, gid: m.id }] }), rng, [entry(s, m)]);
    expect([x.guild, x.founded]).toEqual([null, null]);
    expect([m.xp, m.runs, s.guild.fame]).toEqual([0, 0, 0]);
  });
  it('일일 임무에 「길드파티로 클리어」가 안 뽑히고, 이미 뽑힌 것은 교체 횟수 없이 다른 임무로', () => {
    const T = new Date(2026, 9, 7, 12).getTime();
    for (let i = 0; i < 40; i++) {
      const s = save(30);
      rollover(s, T + i * 864e5, rng);
      expect(s.daily.missions.some(m => m.key === 'guild2')).toBe(false);
    }
    const s = save(30);
    rollover(s, T, rng);
    s.daily.missions[4] = { key: 'guild2', n: 1, got: false };
    expect(rollover(s, T, rng).fixed).toBe(1);
    const keys = s.daily.missions.map(m => m.key);
    expect(keys).not.toContain('guild2');
    expect(new Set(keys).size).toBe(5);
    expect(keys.every(k => DAILY.find(d => d.key === k)!.lv <= 30)).toBe(true);
    expect(s.daily.swapped).toBe(false);
  });
});

describe('열림 · 길드 Lv · 정원 (93 6-2)', () => {
  it('Lv 15에 열림, 튜토리얼 전엔 닫힘, 개발 빌드 잠금 무시면 미리 열림', () => {
    expect(Gd.guildOpen(save(14)).ok).toBe(false);
    expect(Gd.guildOpen(save(15)).ok).toBe(true);
    const s = save(3); s.settings.devUnlock = true;
    expect(Gd.guildOpen(s)).toMatchObject({ ok: true, dev: true });
    const t = save(20); t.tut = 1;
    expect(Gd.guildOpen(t).ok).toBe(false);
  });
  it('명성 = 길드 경험치 (103): 길드 Lv 1~30, 레벨마다 필요량 (줄지 않음), 정원 = Lv + 1 (2 → 31), 지원자 Lv 2~9 1명 · 10~19 2명 · 20~30 3명', () => {
    expect(GUILD_MAX).toBe(30);
    expect(GUILD_NEED).toHaveLength(29);
    for (let i = 1; i < GUILD_NEED.length; i++) expect(GUILD_NEED[i]).toBeGreaterThanOrEqual(GUILD_NEED[i - 1]);
    expect(GUILD_STEPS[29]).toBe(GUILD_NEED.reduce((a, n) => a + n, 0));
    const n0 = GUILD_NEED[0], n1 = GUILD_NEED[1];
    expect(guildLvOf(0)).toEqual({ lv: 1, cap: 2, next: n0, have: 0, need: n0 });
    expect(guildLvOf(n0 - 1)).toEqual({ lv: 1, cap: 2, next: n0, have: n0 - 1, need: n0 });
    expect(guildLvOf(n0 + 3)).toEqual({ lv: 2, cap: 3, next: n0 + n1, have: 3, need: n1 });
    expect(guildLvOf(GUILD_STEPS[29])).toEqual({ lv: 30, cap: 31, next: null, have: 0, need: null });
    expect(guildLvOf(GUILD_STEPS[29] + 99999)).toMatchObject({ lv: 30, cap: 31, next: null, need: null });
    const s = save(30);
    for (let i = 0; i < 2; i++) add(s, 'mage', i);
    expect(Gd.full(s)).toBe(true);
    s.guild.fame = n0;
    expect(Gd.full(s)).toBe(false);
  });
});

describe('레벨에 따른 스킬 성장', () => {
  it('Lv 1/20/40/60/80 경계와 상한, 기존 스킬 하한을 전투에도 적용한다', () => {
    expect([1, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(lv => memberSkillLevel({ lv }))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    const s = save(30), m = add(s);
    expect(entry(s, m).star).toBe(2);
    m.skillFloor = 4;
    expect(entry(s, m).star).toBe(4);
    m.lv = 80;
    expect(entry(s, m).star).toBe(5);
  });
});

describe('결성 (93 4-1)', () => {
  it('Lv 15: 말없는탱 (고정 능력치) + 근접 1명 (정원 2, 103)', () => {
    const s = save(15);
    const got = Gd.foundGuild(s)!;
    const fast = PARTY_POOL.rogue.find(p => p.fm.speed >= 0.95)!; // 딜러는 나와 함께 크는 사람 (103 다른 문제점 4)
    expect(got).toEqual([STORY.tank.nick, fast.nick]);
    expect(s.guild.members[1].lv).toBeGreaterThanOrEqual(14);
    const tank = s.guild.members[0];
    expect(tank).toMatchObject({ nick: '말없는탱', cls: 'warrior', story: 'tank', ab: STORY.tank.ab, lv: 15 });
    const sum = (st: Stats) => STAT_KEYS.reduce((a, k) => a + st[k], 0);
    expect([Gd.birthStats(tank).tough, Gd.birthStats(tank).armor]).toEqual([10, 10]); // 고정 능력치 = Lv 1 바탕 (104)
    expect(tank.stats.tough).toBeGreaterThanOrEqual(10);
    expect(sum(tank.stats)).toBe(sum(Gd.birthStats(tank)) + lvPoints(growthOf(tank.nick, 'tank').type, 15)); // + Lv 15까지 레벨업 점수
    expect(s.guild.founded).toBe(true);
    expect(Gd.foundGuild(s)).toBeNull();
    expect(Gd.foundGuild(save(14))).toBeNull();
  });
  it('만남 기록 없이 두 명 결성, 스토리 동료는 공고에 안 나옴', () => {
    const s = save(20);
    expect(Gd.foundGuild(s)).toHaveLength(2);
    for (let i = 0; i < 30; i++) expect(STORY_NICKS).not.toContain(Gd.makeCandidates(s, rng)[0].nick);
  });
});

describe('영입 (93 4-2)', () => {
  beforeEach(() => { seed = 7; });
  it('모집 공고: 내 Lv × 30 골드로 3명을 모집하고, 저장을 다시 읽어도 남은 지원자를 모두 영입한다', () => {
    const s = save(30, 1000); s.guild.fame = GUILD_STEPS[5]; // 길드 Lv 6 · 정원 7 (103)
    expect(postGold(30)).toBe(900);
    expect(Gd.postRecruit(s, rng)).toBe('');
    expect(s.player.gold).toBe(100);
    const cands = s.guild.post!.cands;
    expect(cands.length).toBe(POST.cands);
    for (const c of cands) {
      expect(c.lv).toBeGreaterThanOrEqual(25); expect(c.lv).toBeLessThanOrEqual(30);
      expect(ABILITIES[c.ab].cls).toBe(c.cls);
    }
    expect(new Set(cands.map(x => x.nick)).size).toBe(3);
    expect(Gd.postRecruit(s, rng)).toMatch(/골드 부족/);
    const pick = cands[1];
    expect(Gd.hire(s, 1)).toBe('');
    expect([s.guild.members.length, s.guild.members[0].nick, s.guild.post?.cands.map(c => c.nick)]).toEqual([1, pick.nick, [cands[0].nick, cands[2].nick]]);
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    expect(restored.guild.post?.cands.map(c => c.nick)).toEqual([cands[0].nick, cands[2].nick]);
    expect(Gd.hire(restored, 1)).toBe('');
    expect(Gd.hire(restored, 0)).toBe('');
    expect(restored.guild.members.map(m => m.nick)).toEqual([pick.nick, cands[2].nick, cands[0].nick]);
    expect(new Set(restored.guild.members.map(m => m.id)).size).toBe(3);
    expect(restored.player.gold).toBe(100);
    expect(restored.guild.post).toBeNull();
    expect(Gd.hire(restored, 0)).toBe('지원자 없음');
  });
  it('하나의 모집 공고에서 모든 직업이 나오고 희귀는 지원자당 약 3%', () => {
    const s = save(40), classes = new Set<string>();
    let rare = 0, all = 0;
    for (let i = 0; i < 1000; i++) {
      const cands = Gd.makeCandidates(s, rng);
      expect(new Set(cands.map(c => c.nick)).size).toBe(3);
      for (const c of cands) { classes.add(c.cls); all++; if (Gd.rareCandidate(c)) rare++; }
    }
    expect([...classes].sort()).toEqual([...RECRUIT_CLASSES].sort());
    expect(rare / all).toBeGreaterThan(0.02);
    expect(rare / all).toBeLessThan(0.04);
    const existing = add(s, 'mage', 0);
    for (let i = 0; i < 50; i++) expect(Gd.makeCandidates(s, rng).map(c => c.nick)).not.toContain(existing.nick);
  });
  it('희귀 확률 경계와 고급 스킬 구분', () => {
    const s = save(40);
    const roll = (chance: number) => { let n = 0; return () => n++ % 2 === 0 ? chance : 0.5; };
    expect(Gd.makeCandidates(s, roll(POST.rareChance - 0.00001)).every(Gd.rareCandidate)).toBe(true);
    expect(Gd.makeCandidates(s, roll(POST.rareChance)).some(Gd.rareCandidate)).toBe(false);
    const advanced = Object.values(ABILITIES).find(a => a.grade === 'rare')!;
    expect(Gd.rareCandidate({ pers: '고집불통', ab: advanced.key })).toBe(false);
  });
  it('정원이 다 차면 공고 · 영입 안 됨', () => {
    const s = save(15);
    for (let i = 0; i < 6; i++) add(s, 'mage', i);
    expect(Gd.postRecruit(s, rng)).toMatch(/정원/);
    s.guild.post = { cands: Gd.makeCandidates(s, rng) };
    expect(Gd.hire(s, 0)).toMatch(/정원/);
  });
  it('영입 도중 정원이 차면 남은 지원자는 유지하고, 자리가 나면 이어서 영입한다', () => {
    const s = save(30); s.guild.fame = GUILD_STEPS[4]; // 길드 Lv 5 · 정원 6 (103)
    for (let i = 0; i < 5; i++) add(s, 'mage', i);
    expect(Gd.postRecruit(s, rng)).toBe('');
    const cands = [...s.guild.post!.cands];
    expect(Gd.hire(s, 0)).toBe('');
    expect(Gd.hire(s, 0)).toMatch(/정원/);
    expect(s.guild.post?.cands.map(c => c.nick)).toEqual(cands.slice(1).map(c => c.nick));
    Gd.release(s, s.guild.members[0].id);
    expect(Gd.hire(s, 0)).toBe('');
    expect(s.guild.post?.cands.map(c => c.nick)).toEqual([cands[2].nick]);
  });
  it('공고 영입 시 그 지원자만 빼고 나머지 지원자는 보존한다 (명성 지원자는 2026-10-20 없앰)', () => {
    const s = save(30);
    Gd.postRecruit(s, rng);
    const cands = [...s.guild.post!.cands];
    expect(Gd.hire(s, 0)).toBe('');
    expect(s.guild.members.map(m => m.nick)).toEqual([cands[0].nick]);
    expect(s.guild.post?.cands.map(m => m.nick)).toEqual(cands.slice(1).map(m => m.nick));
    expect(['apps' in s.guild, 'appsDay' in s.guild]).toEqual([false, false]);
  });
});

describe('관리 (93 4-3 · 5-5)', () => {
  it('스킬 다시 뽑기: 내 Lv × 60 골드, 같은 직업 안에서. 스토리 동료는 안 됨', () => {
    seed = 3;
    const s = save(30, rerollGold(30)), m = add(s);
    expect(Gd.rerollAbility(s, m.id, rng)).toBe('');
    expect([ABILITIES[m.ab].cls, s.player.gold]).toEqual(['warrior', 0]);
    expect(Gd.rerollAbility(s, m.id, rng)).toMatch(/골드 부족/);
    const t = save(15);
    Gd.foundGuild(t);
    expect(Gd.rerollAbility(t, t.guild.members[0].id, rng)).toMatch(/고유/);
  });
  it('내보내기: 모든 규모 편성에서 제외, 재초대 목록 없음', () => {
    const s = save(30), m = add(s, 'mage', 2);
    s.guild.picks = { '5': [m.id], '10': [m.id, 99] };
    expect(Gd.release(s, m.id)).toBe(true);
    expect([s.guild.members.length, s.guild.picks]).toEqual([0, { '5': [], '10': [99] }]);
    const t = save(15);
    Gd.foundGuild(t);
    Gd.release(t, t.guild.members[0].id);
    expect(t.guild).not.toHaveProperty('away');
  });
});

describe('길드파티 편성 (93 7-2)', () => {
  const plague = ENCOUNTERS.plague, warden = ENCOUNTERS.warden;
  it('처음 편성 = 레벨 순 (탱커 · 딜러 자리를 넘지 않음), 규모마다 지난 편성을 따로 기억', () => {
    const s = save(40);
    const t = [add(s, 'warrior', 0, { lv: 30 }), add(s, 'warrior', 1, { lv: 40 }), add(s, 'warrior', 2, { lv: 35 })];
    const d = add(s, 'mage', 0, { lv: 38 });
    const pick = Gd.autoPick(s, plague);
    expect(pick).toEqual([t[1].id, d.id, t[2].id]);
    expect(Gd.togglePick(s, plague, pick, t[0].id).msg).toMatch(/탱커 자리/);
    Gd.savePick(s, warden, [t[0].id]);
    expect(Gd.autoPick(s, warden)).toEqual([t[0].id, d.id]);
    expect(Gd.autoPick(s, plague)).toEqual([t[1].id, d.id, t[2].id]);
    expect(Gd.autoPick(s, warden, true)).toEqual([t[1].id, d.id]);
    expect(['3', '5', '10', '20'].map(k => k)).toEqual([Gd.sizeKey(ENCOUNTERS.field), Gd.sizeKey(warden), Gd.sizeKey(plague), Gd.sizeKey(ENCOUNTERS.choir)]);
  });
  it('빈자리는 공개모집에서 같은 역할로, 전투에 자기 레벨 · 능력치 · 인연 ★ · 버릇이 넘어감. 공개모집에는 길드원이 안 나옴', () => {
    const s = save(40);
    const t = add(s, 'warrior', 0, { lv: 33 }), d = add(s, 'archer', 0, { lv: 31, ab: 'archer.snipe' });
    t.skillFloor = 3;
    const pub = E.recruitParty('plague', 5, { abilities: true, exclude: Gd.guildNicks(s) });
    expect(pub.some(p => p.nick === t.nick || p.nick === d.nick)).toBe(false);
    const roster = Gd.guildRoster(s, [t.id, d.id], pub, plague);
    expect(roster.length).toBe(9);
    expect(roster.filter(r => r.role === 'tank').length).toBe(2);
    expect(roster[0]).toMatchObject({ gid: t.id, lv: 33, pub: true, star: 3, ab: t.ab, habit: habitOf(t.stats), fm: { stats: t.stats } });
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, party: roster, stageLv: 35 });
    const u = f.party.find(x => x.gid === d.id)!;
    expect(u.ab!.key).toBe('archer.snipe');
    expect(u.did).toEqual({ dodge: 0, move: 0, cut: 0, buster: 0, adds: 0, help: 0 });
    expect(f.party.find(x => x.gid == null && x.role !== 'healer')!.did).toBeUndefined();
    // 내 길드원 3명 이상이 다른 시드 공개모집에도 안 나옴
    for (let sd = 1; sd <= 30; sd++) for (const p of E.recruitParty('choir', sd, { exclude: Gd.guildNicks(s) })) expect([t.nick, d.nick]).not.toContain(p.nick);
  });
  it('버릇 = 침착 · 판단 평균: 1 → 단점 ×1.2 · 10 → ×1 · 20 → ×1/3', () => {
    const st = (v: number) => ({ ...add(save(), 'mage').stats, composure: v, judgment: v });
    expect([habitOf(st(1)), habitOf(st(10)), habitOf(st(20))].map(x => +x.toFixed(3))).toEqual([1.2, 1, 0.333]);
  });
});

describe('출전 경험 (97): 레벨', () => {
  const mem = (lv: number, xp = 0): GuildMember => ({ ...Gd.newMember(save(100), Gd.personOf(nickOf('warrior'))!, lv), xp });
  it('레벨 상한 = 내 레벨, 상한에서도 다음 레벨 바로 앞까지 모아 둠', () => {
    const m = mem(14);
    expect(Gd.addMemberXp(m, 1e9, 15)).toEqual([15]);
    expect([m.lv, m.xp]).toEqual([15, xpToNext(15) - 1]);
    expect(Gd.addMemberXp(m, 100, 15)).toEqual([]);
    expect(Gd.addMemberXp(m, 1, 16)).toEqual([16]);
    const n = mem(20);
    expect(Gd.addMemberXp(n, 50, 20)).toEqual([]);
    expect([n.lv, n.xp]).toEqual([20, 50]);
  });
  it('그 칸 경험치를 자기 레벨 기준으로: ±5 칸 가득, 더 높은 칸도 자기 몫, 더 낮은 칸은 한 레벨에 10%씩 덜 (30%까지)', () => {
    const o = (stage: number) => ({ stage, diff: '보통' as const, grade: 'A' as const, raid: 0 as const, win: true });
    const full = clearXp(30, '보통', 'A', { raid: 0, win: true });
    expect(Gd.memberXp({ lv: 30 }, o(25))).toBe(full);
    expect(Gd.memberXp({ lv: 30 }, o(60))).toBe(full);
    expect(Gd.memberXp({ lv: 30 }, o(20))).toBe(Math.round(full * 0.5));
    expect(Gd.memberXp({ lv: 30 }, o(1))).toBe(Math.round(full * 0.3));
  });
});

describe('능력치는 레벨업할 때 (Lim 10-18)', () => {
  const mem = (o: Partial<GuildMember> = {}): GuildMember => ({ ...Gd.newMember(save(100), Gd.personOf(nickOf('warrior'))!, 40), ...o });
  it('레벨 하나에 학습력 1 → 0.9 · 10 → 1 · 20 → 1.1점 (공개모집은 1점, 104)', () => {
    expect([1, 10, 20].map(l => +statPerLevel(l).toFixed(2))).toEqual([0.9, 1, 1.1]);
  });
  it('오를 칸 무게: 성장 결 무게 (공개모집과 같음) × 「한 일」 표 1장마다 1.5배, 20이면 0', () => {
    const m = mem(), flat = Object.fromEntries(Object.keys(m.stats).map(k => [k, 10])) as GuildMember['stats'], g = growWeights(m.nick, m.pers, 'tank');
    expect(statWeights({ ...m, stats: flat, votes: [] }, 'tank')).toEqual(g);
    const v = statWeights({ ...m, stats: flat, votes: [['evade', 'react']] }, 'tank');
    expect(v.evade).toBeCloseTo(g.evade * 1.5, 9);
    expect(v.atk).toBeCloseTo(g.atk, 9);
    expect(statWeights({ ...m, stats: { ...flat, atk: 20 }, votes: [] }, 'tank').atk).toBe(0);
  });
  it('합류할 때 = 공개모집 그 사람 그대로 (타고난 값 + 그 레벨까지 레벨업 점수)', () => {
    const p = Gd.personOf(nickOf('warrior'))!, m = mem(), add = lvAdds(p.nick, p.pers, 'tank', 40, p.fm.stats);
    expect(m.stats).toEqual(Object.fromEntries(STAT_KEYS.map(k => [k, p.fm.stats[k] + add[k]])));
  });
  it('오른 레벨만큼 점수, 1점마다 한 칸 +1, 표는 최근 5장, 오를 칸이 없으면 3점까지 모아 둠', () => {
    seed = 9;
    const m = mem({ sxp: 0, learn: 10 }), sum = () => Object.values(m.stats).reduce((a, b) => a + b, 0), before = sum();
    let ups = 0, dbl = 0;
    for (let i = 0; i < 30; i++) { ups += Gd.growStats(m, 1, 'dodge', rng).length; dbl += m.lastDouble ?? 0; } // 레벨 30개 × 1 + 두 배 나온 레벨
    expect(dbl).toBeGreaterThan(0);
    expect(ups).toBe(30 + dbl);
    expect(sum() - before).toBe(30 + dbl);
    expect(m.votes.length).toBe(5);
    expect(Gd.growStats(m, 0, undefined, rng)).toEqual([]);
    const slow = mem({ sxp: 0, learn: 1 }), no = () => 0.5; // 0.5 ≥ LV_DOUBLE: 두 배 안 나옴
    expect([Gd.growStats(slow, 1, undefined, no).length, slow.sxp, slow.lastDouble]).toEqual([0, 0.9, undefined]);
    expect(Gd.growStats(slow, 1, undefined, no).length).toBe(1);
    const lucky = mem({ sxp: 0, learn: 1 });
    expect([Gd.growStats(lucky, 1, undefined, () => 0.1).length, lucky.sxp, lucky.lastDouble]).toEqual([1, 0.8, 1]); // 두 배: 1.8점
    // 두 배 = 서로 다른 두 칸에 1점씩 (Lim 10-20 「한 능력에 2업이 아니고 각각 다른 능력치」): 늘 같은 난수여도 같은 칸을 두 번 안 뽑음
    const two = mem({ sxp: 0, learn: 10 }), b2 = { ...two.stats }, got = Gd.growStats(two, 1, undefined, () => 0.1);
    expect(got).toHaveLength(2);
    expect(got[0].k).not.toBe(got[1].k);
    expect(got.map(x => two.stats[x.k] - b2[x.k])).toEqual([1, 1]);
    expect([two.lastDouble, two.lastDoubleStats]).toEqual([1, got.map(x => x.k)]);
    const back = migrate(JSON.parse(JSON.stringify({ ...save(30), guild: { ...newSave().guild, founded: true, members: [two], nextId: two.id + 1 } }))).guild.members[0];
    expect([back.lastDouble, back.lastDoubleStats]).toEqual([1, got.map(x => x.k)]); // 다시 불러도 남음
    Gd.growStats(two, 1, undefined, no);
    expect(two).not.toHaveProperty('lastDouble'); // 다음 레벨업에 두 배가 없으면 지움
    const top = mem({ lv: 1, learn: 10 });
    top.stats = Object.fromEntries(Object.keys(top.stats).map(k => [k, 20])) as GuildMember['stats'];
    expect(Gd.growStats(top, 500, undefined, rng)).toEqual([]);
    expect(top.sxp).toBe(3);
  });
  it('직전 레벨업에서 오른 항목을 저장하고, 레벨이 오르지 않은 판에는 유지한다', () => {
    const s = save(100), m = add(s, 'warrior', 0, { lv: 40, sxp: 0.9, learn: 10 });
    const before = { ...m.stats };
    const ups = Gd.growStats(m, 1, undefined, rng);
    expect(ups).toHaveLength(1);
    expect(m.lastStatGains).toEqual(ups.map(x => x.k));
    expect(m.stats[ups[0].k]).toBe(before[ups[0].k] + 1);
    Gd.growStats(m, 0, 'dodge', rng);
    expect(m.lastStatGains).toEqual(ups.map(x => x.k));
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.members[0].lastStatGains).toEqual(m.lastStatGains);
    // 다음 레벨업에서 능력치가 안 오르면 이전 화살표를 지운다 (학습력 1 = 레벨 하나에 0.9점).
    m.sxp = 0; m.learn = 1;
    Gd.growStats(m, 1, undefined, rng);
    expect(m.lastStatGains).toEqual([]);
  });
  it('상승 기록이 없는 과거 저장은 표시하지 않고, 잘못된 키와 중복 기록을 걸러낸다', () => {
    const s = save(100), m = add(s, 'mage');
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.guild.members[0].lastStatGains;
    expect(migrate(raw).guild.members[0].lastStatGains).toEqual([]);
    raw.guild.members[0].lastStatGains = ['atk', 'atk', 'unknown', null, 'skill'];
    expect(migrate(raw).guild.members[0].lastStatGains).toEqual(['atk', 'skill']);
    m.sxp = 2.9; m.learn = 10;
    const ups = Gd.growStats(m, 1, undefined, () => 0.5); // 두 배 없음: 2.9 + 1 = 3점
    expect(ups).toHaveLength(3);
    expect(m.lastStatGains).toEqual([...new Set(ups.map(x => x.k))]);
  });
  it('「한 일」 표: 판 크기와 상관없이 가장 두드러진 일 하나, 모자라면 없음', () => {
    const did = { dodge: 0, move: 0, cut: 0, buster: 0, adds: 0, help: 0 };
    const x = (o: Partial<Parameters<typeof deedOf>[0]>) => deedOf({ did, dealt: 0, top: false, low: 0.9, alive: true, role: 'melee', ...o });
    expect(x({ top: true })).toBe('top');
    expect(x({ role: 'tank', did: { ...did, buster: 4 } })).toBe('buster');
    expect(x({ role: 'melee', did: { ...did, buster: 4 } })).toBeUndefined();
    expect(x({ did: { ...did, dodge: 3 } })).toBe('dodge');
    expect(x({ low: 0.1 })).toBe('calm');
    expect(x({ did: { ...did, help: 1 } })).toBe('help'); // 99 협동: 대신 끊기 · 나눠 맞기 · 붙잡기 한 번
    expect(x({ low: 0.1, alive: false })).toBeUndefined();
    expect(x({})).toBeUndefined();
  });
});

describe('판 뒤 길드 정산 (93 6-1)', () => {
  const warden = (s: SaveData, ms: GuildMember[]) => {
    const pub = E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) });
    return Gd.guildRoster(s, ms.map(m => m.id), pub, ENCOUNTERS.warden);
  };
  const after = (s: SaveData, roster: ReturnType<typeof warden>, o: Partial<Parameters<typeof Gd.guildAfter>[2]> = {}) =>
    Gd.guildAfter(s, rng, { win: true, quit: false, grade: 'A', diff: '보통', stage: 30, raid: 0, content: 'rustfort', kind: 'dungeon', party: [], roster, ...o });
  it('길드파티 (자리 절반 이상): 명성 던전 +2 · 첫 처치 +6 (장소 · 난이도마다 한 번), 출전 길드원 레벨 · 능력치 경험, 쉬는 명단 30%', () => {
    seed = 11;
    const s = save(30);
    const a = add(s, 'warrior', 0, { lv: 30 }), b = add(s, 'mage', 0, { lv: 30 }), rest = add(s, 'archer', 0, { lv: 30 });
    const roster = warden(s, [a, b]);
    expect(Gd.isGuildParty(roster)).toBe(true);
    const r = after(s, roster, { party: [{ nick: b.nick, deed: 'top' }] });
    expect([r.fame, r.first, s.guild.fame, s.guild.wins, s.guild.firsts]).toEqual([FAME.dungeon + FAME.first, true, 8, 1, ['rustfort|보통']]);
    expect(r.members.map(x => x.nick)).toEqual([a.nick, b.nick]);
    expect([a.runs, b.runs, rest.runs]).toEqual([1, 1, 0]);
    const full = clearXp(30, '보통', 'A', { raid: 0, win: true });
    expect(r.members[0].xp).toBe(full);
    expect(rest.xp).toBe(Math.round(full * REST_SHARE));
    expect(r.rest).toBe(rest.xp);
    expect(b.votes).toEqual([['atk']]);
    expect(r.members[0].stats.length).toBe(Math.floor((r.members[0].ups.length + (r.members[0].dbl ?? 0)) * statPerLevel(a.learn) + 1e-9)); // 레벨업만큼 (두 배 나온 레벨은 2번)
    // 두 번째: 첫 처치 없음
    const r2 = after(s, roster);
    expect([r2.fame, r2.first]).toEqual([FAME.dungeon, false]);
    expect(after(s, roster, { kind: 'explore' }).fame).toBe(FAME.explore);
    expect(after(s, roster, { raid: 10 }).fame).toBe(FAME.raid10);
    expect(after(s, roster, { raid: 20 }).fame).toBe(FAME.raid20);
    expect([FAME.explore, FAME.dungeon, FAME.raid10, FAME.raid20, FAME.first]).toEqual([1, 2, 4, 6, 6]);
  });
  it('길드원이 자리 절반 아래면 명성 · 첫 처치 없음 (경험은 받음), 진 판 · 포기는 아무것도 없음', () => {
    const s = save(30);
    const a = add(s, 'warrior', 0, { lv: 30 });
    const roster = warden(s, [a]);
    expect(Gd.isGuildParty(roster)).toBe(false);
    const r = after(s, roster);
    expect([r.fame, r.first, s.guild.fame, r.members.length]).toEqual([0, false, 0, 1]);
    expect(after(s, roster, { win: false }).members).toEqual([]);
    expect(after(s, roster, { quit: true, win: false }).members).toEqual([]);
    expect(a.runs).toBe(1);
  });
  it.each([GUILD_STEPS[29] - 1, GUILD_STEPS[29], 1000000])('명성 %i에서도 전투·주간 보상은 계속 누적되고 저장 후 유지된다', fame => {
    const s = save(30), ms = [add(s, 'warrior'), add(s, 'mage')];
    s.guild.fame = fame;
    const roster = warden(s, ms);
    after(s, roster);
    after(s, roster, { raid: 20 });
    s.weekly.guild = { n: GUILD_GOAL.need, got: false };
    expect(claimGuildGoal(s)).toBe('');
    const total = fame + FAME.dungeon + FAME.first + FAME.raid20 + GUILD_GOAL.fame;
    expect(s.guild.fame).toBe(total);
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    expect(restored.guild.fame).toBe(total);
    expect(Gd.capOf(restored)).toMatchObject({ lv: 30, cap: 31, next: null, need: null });
  });
  it('주간 목표: 명성 지급은 한 번만, 스킬 레벨은 그대로', () => {
    const s = save(30);
    const a = add(s, 'warrior', 0), b = add(s, 'mage', 0);
    s.weekly.guild = { n: GUILD_GOAL.need, got: false };
    Gd.release(s, b.id);
    expect(claimGuildGoal(s)).toBe('');
    expect([s.guild.fame, memberSkillLevel(a)]).toEqual([GUILD_GOAL.fame, 2]);
    expect(claimGuildGoal(s)).toBe('아직 못 채움');
  });
  it('settle: Lv 15 이상 판 뒤 결성 (창단 멤버 두 명), 길드파티면 정산 · 주간 목표 1, 포기는 정산 없음', () => {
    const s = save(20);
    const x = settle(s, result(), rng, []);
    expect(x.founded).toHaveLength(2);
    expect(x.guild).toBeNull();
    const ms = s.guild.members;
    const roster = warden(s, ms);
    const party = roster.map(e => ({ nick: e.nick, pers: e.pers, role: e.role, alive: true, got: 10, gid: e.gid }));
    const y = settle(s, result({ party }), rng, roster);
    expect(y.founded).toBeNull();
    expect(y.guild!.members.length).toBe(2);
    expect(y.guild!.members[0].xp).toBeGreaterThan(0);
    expect(s.weekly.guild.n).toBe(1);
    expect(settle(s, result({ party, quit: true, win: false }), rng, roster).guild!.members).toEqual([]);
    expect(settle(s, result(), rng, []).guild).toBeNull();
  });
});

describe('저장 v19 (길드 v2)', () => {
  it('v18 길드 (자질 · 육성 포인트): 같은 닉네임 사람의 능력치로, 레벨 · 스킬 그대로, 기존 스킬 단계 보존, 옛 스카우트 제거', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(19);
    const nick = nickOf('mage', 4), scout = nickOf('archer', 4);
    const old = {
      ...JSON.parse(JSON.stringify(newSave(1))), v: 18,
      users: { [scout]: { pt: 1, met: 1, wins: 0, saved: 0, mvp: 0 } },
      guild: {
        name: '새벽의 손', members: [{ id: 3, nick, cls: 'mage', pers: PARTY_POOL.mage[4].pers, lv: 25, xp: 10, apt0: [3, 3, 3], aptUp: [1, 0, 0], ab: 'mage.blink', star: 2, runs: 4 }, { nick: 7 }],
        scouts: [{ nick: scout, cls: 'archer', pers: '신중파', lv: 12, apt0: [3, 3, 3], ab: 'archer.snipe', from: 'x' }], pick: [3, 8], fame: 30, nextId: 4, post: null,
      },
    };
    const d = migrate(old);
    expect(d.v).toBe(SAVE_VERSION);
    const m = d.guild.members[0];
    expect(d.guild.members.length).toBe(1);
    const born = PARTY_POOL.mage[4].fm.stats, add = lvAdds(nick, PARTY_POOL.mage[4].pers, 'ranged', 25, born);
    expect(m).toMatchObject({ id: 3, nick, cls: 'mage', lv: 25, xp: 10, ab: 'mage.blink', runs: 4, stats: Object.fromEntries(STAT_KEYS.map(k => [k, born[k] + add[k]])), sxp: 0, votes: [] }); // v26: 새 바탕 + Lv 25까지 점수
    expect(m).not.toHaveProperty('apt0');
    expect(memberSkillLevel(m)).toBe(4);
    expect(d).not.toHaveProperty('users');
    expect(d.guild).toMatchObject({ founded: true, storySeen: true, fame: 60, nextId: 4, picks: { '5': [3] } }); // v24: 옛 명성 × 2 (103)
    expect(d.guild).not.toHaveProperty('apps'); // v29: 명성 지원자 없음
    expect(d.guild).not.toHaveProperty('scouts');
    // 다시 불러도 그대로
    expect(migrate(JSON.parse(JSON.stringify(d))).guild).toEqual(d.guild);
  });
  it('깨진 값은 기본값, 모자란 능력치 칸은 그 사람 능력치로', () => {
    expect(migrate({ v: 19, guild: { members: 'x', fame: 'y', post: { cands: 1 } } }).guild).toMatchObject({ members: [], fame: 0, post: null, founded: false, name: '해바라기 원정대' });
    const nick = nickOf('rogue', 2);
    const g = migrate({ v: 19, guild: { founded: true, members: [{ id: 2, nick, cls: 'rogue', pers: PARTY_POOL.rogue[2].pers, ab: 'rogue.kick', lv: 9, stats: { atk: 30 } }], nextId: 3 } }).guild;
    expect(g.members[0].stats.atk).toBe(PARTY_POOL.rogue[2].fm.stats.atk + lvAdds(nick, PARTY_POOL.rogue[2].pers, 'melee', 9, PARTY_POOL.rogue[2].fm.stats).atk); // v26: 새 바탕 + Lv 9까지 점수
    expect([g.members.length, g.nextId, g.founded]).toEqual([1, 3, true]);
  });
});

describe('추천 편성 (93 7-1)', () => {
  it('보스 특징: 역병 군주 = 독 · 질병 · 끊기 · 광역 · 장판, 일반 구간 = 쫄', () => {
    const p = encFeatures('plague');
    for (const f of ['poison', 'cut', 'aoe', 'zone'] as const) expect(p.has(f), f).toBe(true);
    expect(encFeatures('gate').has('adds')).toBe(true);
    expect(abilityFeatures(ABILITIES['paladin.cleanse'])).toEqual(['poison']);
    expect(abilityFeatures(ABILITIES['paladin.avenger'])).toEqual(['cut']);
    expect(abilityFeatures(ABILITIES['warrior.shieldBlock'])).toEqual(['buster']);
  });
  it('특징에 맞는 스킬이 점수를 올리고 이유 칩, 다루기 어려운 성격은 버릇을 고친 만큼 덜 깎음, 레벨이 모자라면 깎음 (공략 숙지는 없앰, 99)', () => {
    const s = save(30);
    const flat = (v: number) => Object.fromEntries(Object.keys(add(save(), 'mage').stats).map(k => [k, v])) as GuildMember['stats'];
    const a = add(s, 'paladin', 0, { ab: 'paladin.devotion', pers: '신중파', stats: flat(10), lv: 30 });
    const b = add(s, 'paladin', 1, { ab: 'paladin.cleanse', pers: '신중파', stats: flat(10), lv: 30 });
    const r = recommendPick(s, ENCOUNTERS.warden, ['plague'], 30);
    expect(r.pick[0]).toBe(b.id);
    expect(r.why).toContain('독 · 질병 → 독소 정화');
    expect(r.why.some(w => /숙지/.test(w))).toBe(false);
    expect(a.id).not.toBe(r.pick[0]);
    const hard = (Object.keys(PERS) as (keyof typeof PERS)[]).find(k => PERS[k].star === 3 && !('tankOnly' in PERS[k]))!;
    const c = add(s, 'mage', 1, { pers: hard, stats: flat(10) }), calm = add(s, 'mage', 2, { pers: hard, ab: c.ab, stats: { ...flat(10), composure: 20, judgment: 20 } });
    expect(recScore(s, calm, ['plague'], 30).score).toBeGreaterThan(recScore(s, c, ['plague'], 30).score + REC.hard3 * 0.7);
    const low = add(s, 'mage', 3, { pers: '신중파', stats: flat(10), lv: 26 }), ok = add(s, 'mage', 4, { pers: '신중파', stats: flat(10), lv: 30, ab: low.ab });
    expect(recScore(s, ok, ['plague'], 30).score - recScore(s, low, ['plague'], 30).score).toBeCloseTo(4 * REC.lvGap);
  });
});

describe('후원 (98, Lim 10-18 「훈련 대신 지원」)', () => {
  it('그 길드원 Lv × 20 골드 = 5판, 지원 중에는 중첩 불가, 모두 쓰면 다시 지원 가능', () => {
    const s = save(30, 2000), m = add(s, 'mage', 0, { lv: 20 }), top = add(s, 'mage', 1, { lv: 30 });
    expect(sponsorGold(20)).toBe(400);
    expect(Gd.sponsor(s, m.id)).toBe('');
    expect([m.boost, s.player.gold]).toEqual([SPONSOR.runs, 1600]);
    expect(Gd.sponsorWhy(s, top)).toBe('내 레벨과 같음');
    expect(Gd.sponsor(s, top.id)).toBe('내 레벨과 같음');
    for (const left of [1, 5, 20]) {
      m.boost = left;
      expect(Gd.sponsorWhy(s, m)).toBe('지원 중');
      expect(Gd.sponsor(s, m.id)).toBe('지원 중');
      expect([m.boost, s.player.gold]).toEqual([left, 1600]);
    }
    m.boost = 0;
    expect(Gd.sponsor(s, m.id)).toBe('');
    expect([m.boost, s.player.gold]).toEqual([SPONSOR.runs, 1200]);
    s.player.gold = 0;
    const n = add(s, 'archer', 0, { lv: 10 });
    expect(Gd.sponsor(s, n.id)).toMatch(/골드 부족/);
  });
  it('쉬는 판에 출전만큼 경험치 · 1판 씀, 출전한 판 · 진 판 · 내 레벨에 닿으면 안 씀, 레벨이 오르면 능력치도', () => {
    seed = 21;
    const s = save(30), a = add(s, 'warrior', 0, { lv: 30 }), b = add(s, 'mage', 0, { lv: 30 }), r = add(s, 'archer', 0, { lv: 20, learn: 20 }), top = add(s, 'archer', 1, { lv: 30 });
    r.boost = 5; top.boost = 5;
    const roster = Gd.guildRoster(s, [a.id, b.id], E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }), ENCOUNTERS.warden);
    const o = { win: true, quit: false, grade: 'A' as const, diff: '보통' as const, stage: 30, raid: 0 as const, content: 'rustfort', kind: 'dungeon', party: [], roster };
    const full = Gd.memberXp(r, o);
    const x = Gd.guildAfter(s, rng, o);
    expect(x.boosted).toEqual([{ nick: r.nick, xp: full, left: 4 }]);
    expect(top.boost).toBe(5); // 내 레벨과 같음: 안 씀
    Gd.guildAfter(s, rng, { ...o, win: false });
    expect(r.boost).toBe(4);
    const withR = Gd.guildRoster(s, [a.id, r.id], E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }), ENCOUNTERS.warden);
    Gd.guildAfter(s, rng, { ...o, roster: withR });
    expect(r.boost).toBe(4); // 출전한 판
    const lv0 = r.lv, st0 = Object.values(r.stats).reduce((t, v) => t + v, 0), sxp0 = r.sxp;
    let dbl = 0;
    for (let i = 0; i < 4; i++) { const l = r.lv; Gd.guildAfter(s, rng, o); if (r.lv > l) dbl += r.lastDouble ?? 0; }
    expect(r.boost).toBe(0);
    expect(r.lv).toBeGreaterThan(lv0);
    expect(Object.values(r.stats).reduce((t, v) => t + v, 0) - st0).toBe(Math.floor(sxp0 + (r.lv - lv0 + dbl) * statPerLevel(r.learn) + 1e-9));
  });
  it('쉬는 길드원 (어느 편성에도 없는 사람) 모두 후원, 저장 v20', () => {
    const s = save(30, 100000), a = add(s, 'warrior', 0, { lv: 25 }), b = add(s, 'mage', 0, { lv: 22 }), c = add(s, 'archer', 0, { lv: 28 });
    s.guild.picks = { '5': [a.id] };
    expect(Gd.restSponsor(s)).toEqual({ ids: [b.id, c.id], gold: sponsorGold(22) + sponsorGold(28) });
    expect(Gd.sponsorRest(s)).toBe('');
    expect([a.boost, b.boost, c.boost]).toEqual([0, 5, 5]);
    expect(SAVE_VERSION).toBe(29);
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.members.map(m => m.boost)).toEqual([0, 5, 5]);
    expect(migrate({ v: 20, guild: { founded: true, members: [{ ...b, boost: 99 }], nextId: 9 } }).guild.members[0].boost).toBe(SPONSOR.max);
    const gold = s.player.gold;
    expect(Gd.sponsorRest(s)).toBe('후원할 쉬는 길드원 없음');
    expect(s.player.gold).toBe(gold);
    b.boost = 1; c.boost = 0;
    expect(Gd.restSponsor(s)).toEqual({ ids: [c.id], gold: sponsorGold(c.lv) });
    expect(Gd.sponsorRest(s)).toBe('');
    expect([b.boost, c.boost, s.player.gold]).toEqual([1, 5, gold - sponsorGold(c.lv)]);
  });
});

describe('v21 친구·인연 제거 저장 이전', () => {
  it('기존 스킬 단계 · 능력치 · 후원 · 상승 표시를 보존하고 연회장 골드를 한 번 환급한다', () => {
    const s = save(50), m = add(s, 'mage', 0, { lv: 19, xp: 11, boost: 10, lastStatGains: ['atk'] });
    (m as GuildMember & { know?: Record<string, number> }).know = { warden: 6 }; // 옛 저장의 공략 숙지 (99에서 없앰)
    const old = { ...s, v: 20, users: { [m.nick]: { pt: 110 } }, guild: { ...s.guild, fac: { war: 2, post: 3, feast: 3 }, away: [m] } };
    const d = migrate(old), kept = d.guild.members[0];
    expect(memberSkillLevel(kept)).toBe(4);
    expect(kept).toMatchObject({ id: m.id, lv: 19, xp: 11, boost: 10, stats: v27(m).stats, lastStatGains: ['atk'] }); // v26이 능력치를 새 바탕으로, v27이 두 배 몫
    expect(kept).not.toHaveProperty('know'); // 공략 숙지 저장 필드는 버림
    expect(Gd.memberEntry(d, kept)).not.toHaveProperty('know');
    expect(d.player.gold).toBe(s.player.gold + 35000 + 15000 + 35000);
    expect(d.guild).not.toHaveProperty('fac');
    expect(d).not.toHaveProperty('users');
    expect(d.guild).not.toHaveProperty('away');
    const again = migrate(JSON.parse(JSON.stringify(d)));
    expect(again).toEqual(d);
    kept.lv = 80;
    expect(memberSkillLevel(kept)).toBe(5);
  });
  it.each([[0, 1], [8, 1], [20, 2], [55, 3], [110, 4], [200, 5], [330, 5], [NaN, 1]])('이전 점수 %s의 스킬 하한 %s 보존', (pt, skill) => {
    const s = save(15), m = add(s);
    const d = migrate({ ...s, v: 20, users: { [m.nick]: { pt } } });
    expect(memberSkillLevel(d.guild.members[0])).toBe(skill);
  });
  it('레벨업과 재접속 후에도 새 스킬 단계가 전투에 적용된다', () => {
    const s = save(30), m = add(s, 'mage', 0, { lv: 19 });
    expect(entry(s, m).star).toBe(1);
    Gd.addMemberXp(m, xpToNext(19), 30);
    expect(m.lv).toBe(20);
    expect(entry(s, m).star).toBe(2);
    const d = migrate(JSON.parse(JSON.stringify(s)));
    expect(entry(d, d.guild.members[0]).star).toBe(2);
    const x = settle(s, result(), rng, []);
    expect(x).not.toHaveProperty('bond');
    expect(s).not.toHaveProperty('users');
  });
});

it('v18의 직접 저장된 스킬 LV도 낮추지 않는다', () => {
  const nick = nickOf('mage');
  const d = migrate({ v: 18, guild: { members: [{ id: 1, nick, cls: 'mage', pers: PARTY_POOL.mage[0].pers, lv: 1, ab: PARTY_POOL.mage[0].ab, star: 5 }] } });
  expect(memberSkillLevel(d.guild.members[0])).toBe(5);
});

describe('저장 v26 (104 「Lv 1 바탕 1~10 · 레벨업마다 1점」)', () => {
  it('v25 길드원: 새 타고난 값 + 그 레벨까지 레벨업 점수 + 예전에 키운 몫 (저장 값 − v23 타고난 값), 레벨 · 학습력 · 표 · 남은 점수 그대로', () => {
    const s = save(60), a = add(s, 'warrior', 0, { lv: 40 }), p = Gd.personOf(a.nick)!;
    const old = JSON.parse(JSON.stringify(s)), o = old.guild.members[0];
    const v23 = birthV25(a.nick, a.pers);
    o.stats = { ...v23, atk: Math.min(20, v23.atk + 3), tough: Math.max(1, v23.tough - 2) }; // 공격 3칸 키움 · 맷집은 v23 바탕보다 낮게 (0 밑은 버림)
    o.sxp = 0.4; o.votes = [['atk']]; o.learn = 13; old.v = 25;
    const st = statsV26(o), add24 = lvAdds(a.nick, a.pers, 'tank', 40, p.fm.stats);
    expect(st.atk).toBe(Math.min(20, p.fm.stats.atk + add24.atk + (Math.min(20, v23.atk + 3) - v23.atk)));
    expect(st.tough).toBe(p.fm.stats.tough + add24.tough);
    for (const k of STAT_KEYS.filter(k => k !== 'atk' && k !== 'tough')) expect(st[k], k).toBe(p.fm.stats[k] + add24[k]);
    const m = migrate(old).guild.members[0], want = dbl({ ...o, stats: st }); // v27이 Lv 16~40 두 배 몫을 더함
    expect(m.stats).toEqual(want.stats);
    expect(m).toMatchObject({ lv: 40, sxp: want.sxp, votes: [['atk']], learn: 13 });
    expect(migrate(JSON.parse(JSON.stringify(migrate(old)))).guild.members[0].stats).toEqual(m.stats); // 다시 불러도 그대로
  });
  it('스토리 동료: 예전 고정 능력치 (16 · 15 …)를 빼고 새 고정 바탕 (10 · 10 …)으로', () => {
    const s = save(30);
    Gd.foundGuild(s);
    const old = JSON.parse(JSON.stringify(s)), o = old.guild.members.find((x: GuildMember) => x.story === 'tank');
    o.stats = { ...birthV25(o.nick, o.pers), tough: 16, armor: 15, position: 13, judgment: 12 }; old.v = 25;
    const m = migrate(old).guild.members.find(x => x.story === 'tank')!, born = Gd.birthStats(m), add = lvAdds(m.nick, m.pers, 'tank', m.lv, born);
    expect(statsV26(o)).toEqual(Object.fromEntries(STAT_KEYS.map(k => [k, born[k] + add[k]])));
    expect(m.stats).toEqual(dbl({ ...o, stats: statsV26(o) }).stats); // v27 두 배 몫 (Lv 15 뒤)
  });
});

describe('저장 v27 (103 Lim 「레벨업시 20프로 확률로 2업」)', () => {
  it('v26 길드원: Lv 15 뒤 지난 레벨마다 20%를 다시 굴려 두 배 몫을 더함, 깎지 않음 · 다시 불러도 그대로 · Lv 15 이하는 그대로', () => {
    const s = save(80), a = add(s, 'warrior', 0, { lv: 75, sxp: 0, learn: 10 }), low = add(s, 'mage', 0, { lv: 15, sxp: 0.3 });
    const old = JSON.parse(JSON.stringify(s)); old.v = 26;
    const d = migrate(old), m = d.guild.members.find(x => x.id === a.id)!, l = d.guild.members.find(x => x.id === low.id)!;
    const sum = (x: Stats) => STAT_KEYS.reduce((t, k) => t + x[k], 0), got = sum(m.stats) - sum(a.stats);
    for (const k of STAT_KEYS) expect(m.stats[k], k).toBeGreaterThanOrEqual(a.stats[k]);
    expect(got).toBeGreaterThan(5); // 60레벨 × 20% = 12점 안팎
    expect(got).toBeLessThan(22);
    expect([l.stats, l.sxp]).toEqual([low.stats, 0.3]);
    expect(migrate(JSON.parse(JSON.stringify(d))).guild.members).toEqual(d.guild.members);
    // 더하는 1점은 그 레벨에 이미 오른 칸 (공개모집 굴림)을 빼고 = 다른 두 칸
    const sp = { ...a, stats: { ...a.stats }, sxp: 1 };
    expect(spendPoints(sp, 'tank', () => 0, [STAT_KEYS[0], STAT_KEYS[1]])).toEqual([STAT_KEYS.find((k, i) => i > 1 && statWeights(a, 'tank')[k] > 0)]);
    let n = 0, tot = 0;
    for (const c of RECRUIT_CLASSES) for (const p of PARTY_POOL[c].slice(0, 20)) { const x = Gd.newMember(s, { ...p, cls: c }, 100); const y = dbl(x); tot += sum(y.stats) + y.sxp - sum(x.stats) - x.sxp; n++; }
    expect(tot / n).toBeGreaterThan(0.2 * 85 * 0.9 - 2); // 사람마다 평균 17점 안팎 (학습력 0.9~1.1)
    expect(tot / n).toBeLessThan(0.2 * 85 * 1.1 + 2);
  });
});

describe('99 협동 (예전 쫄 처리, Lim 10-19 07:04)', () => {
  it('저장 v22 길드원의 쫄 처리 값 · 오른 칸 · 표가 협동으로 그대로 옮겨짐', () => {
    const s = save(30, 100000), a = add(s, 'warrior', 0, { lv: 25 });
    const old = JSON.parse(JSON.stringify(s));
    const m0 = old.guild.members[0];
    const { coop, ...rest } = m0.stats;
    m0.stats = { ...rest, adds: 17 }; m0.lastStatGains = ['adds', 'atk']; m0.votes = [['adds'], ['atk', 'adds']];
    void coop; void a;
    old.v = 22;
    const m = migrate(old).guild.members[0];
    expect(m.stats.coop).toBe(statsV26({ ...a, stats: { ...a.stats, coop: 17 } }).coop); // v26이 새 바탕으로 (예전에 키운 몫 = 17 − v23 타고난 값)
    expect((m.stats as Record<string, number>).adds).toBeUndefined();
    expect(m.lastStatGains).toEqual(['atk', 'coop']);
    expect(m.votes).toEqual([['coop'], ['atk', 'coop']]);
  });
});

describe('저장 v24 (103 「명성 탐험 1 · 던전 2 · 10인 4 · 20인 6」)', () => {
  it('옛 저장의 명성은 × 2 (값이 두 배가 되어서), v24 저장은 그대로', () => {
    const s = save(30); add(s, 'warrior'); s.guild.fame = 777;
    const old = { ...JSON.parse(JSON.stringify(s)), v: 23 };
    expect(migrate(old).guild.fame).toBe(1554);
    expect(migrate(JSON.parse(JSON.stringify(migrate(old)))).guild.fame).toBe(1554);
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.fame).toBe(777);
  });
});

describe('결과창 길드 막대 (103 「명성 = 길드 경험치」)', () => {
  it('settle.guildFame: 길드파티로 얻은 명성 (승리 · 첫 처치) = 판 전 쌓인 명성 + 얻은 양, 공개모집 판은 null', () => {
    const s = save(15); // 녹슨 요새 보통 적 Lv 7 ≥ 내 Lv 15 − 10
    settle(s, result(), rng, []);
    const roster = Gd.guildRoster(s, s.guild.members.map(m => m.id), E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }), ENCOUNTERS.warden);
    s.guild.fame = GUILD_STEPS[1] - 3;
    const y = settle(s, result({ party: [] }), rng, roster);
    expect(y.guildFame).toEqual({ before: GUILD_STEPS[1] - 3, gain: FAME.dungeon + FAME.first });
    expect(guildLvOf(y.guildFame!.before + y.guildFame!.gain).lv).toBe(2); // 이 판에 길드 Lv 2
    expect(settle(s, result(), rng, []).guildFame).toBeNull();
  });
});

describe('103 다른 문제점 3 · 5', () => {
  it('v24 전 저장: 명성 × 2와 옛 길드원이 다 들어가는 길드 Lv의 누적 명성 가운데 큰 쪽 (넘치지 않게)', () => {
    const s = save(30);
    for (let i = 0; i < 4; i++) add(s, 'mage', i);
    s.guild.fame = 10;
    const d = migrate({ ...JSON.parse(JSON.stringify(s)), v: 23 });
    expect(d.guild.fame).toBe(Math.max(20, GUILD_STEPS[2])); // 4명 → 길드 Lv 3 (정원 4)
    expect(Gd.capOf(d).cap).toBeGreaterThanOrEqual(4);
    s.guild.fame = 5000;
    expect(migrate({ ...JSON.parse(JSON.stringify(s)), v: 23 }).guild.fame).toBe(10000);
  });
  it('길드파티 인원: 탐험 1 · 5인 2 · 10인 5 · 20인 10명 (자리 절반 이상)', () => {
    expect([3, 5, 10, 20].map(Gd.guildPartyNeed)).toEqual([1, 2, 5, 10]);
  });
});

describe('낮은 장소 명성 (103 「넷 다」 1)', () => {
  it('그 판 적 레벨이 내 Lv − 10보다 낮으면 길드파티로 이겨도 명성 · 첫 처치 없음 (기록도 안 남김), 레이드는 늘 받음', () => {
    const s = save(30);
    const a = add(s, 'warrior', 0, { lv: 30 }), b = add(s, 'mage', 0, { lv: 30 });
    const roster = Gd.guildRoster(s, [a.id, b.id], E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }), ENCOUNTERS.warden);
    const go = (stage: number, raid: 0 | 10 | 20 = 0) => Gd.guildAfter(s, rng, { win: true, quit: false, grade: 'A', diff: '보통', stage, raid, content: 'rustfort', kind: raid ? 'raid' : 'dungeon', party: [], roster });
    const low = go(19);
    expect([low.low, low.fame, low.first, s.guild.fame, s.guild.firsts]).toEqual([true, 0, false, 0, []]);
    expect(low.members.length).toBe(2); // 길드원 경험치는 그대로
    const ok = go(20);
    expect([ok.low, ok.fame, ok.first]).toEqual([false, FAME.dungeon + FAME.first, true]);
    expect(go(30, 20).fame).toBe(FAME.raid20); // 레이드 적 = max(내 Lv, 레이드 Lv)
  });
});

describe('105 QA 1바퀴', () => {
  it('낮은 장소는 판 전 레벨로 (Lv 17이 녹슨 요새 보통을 깨며 Lv 18이 돼도 명성), 주간 도전 판은 첫 처치 아님', () => {
    const s = save(18);
    const a = add(s, 'warrior', 0, { lv: 18 }), b = add(s, 'mage', 0, { lv: 18 });
    const roster = Gd.guildRoster(s, [a.id, b.id], E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }), ENCOUNTERS.warden);
    const go = (o: Partial<Parameters<typeof Gd.guildAfter>[2]>) => Gd.guildAfter(s, rng, { win: true, quit: false, grade: 'A', diff: '보통', stage: 7, raid: 0, content: 'rustfort', kind: 'dungeon', party: [], roster, ...o });
    expect(go({ myLv: 17 }).low).toBe(false);
    expect(go({ myLv: 18 }).low).toBe(true);
    const c = go({ myLv: 17, chal: true, content: 'crypt' });
    expect([c.first, s.guild.firsts.includes('crypt|보통')]).toEqual([false, false]);
  });
  it('길드파티를 꾸릴 수 있나는 역할 자리로 셈: 탱커 3 + 딜러 7 = 20인 9명뿐 (자리 탱커 2)', () => {
    const s = save(80);
    for (let i = 0; i < 3; i++) add(s, 'warrior', i);
    for (let i = 0; i < 7; i++) add(s, 'mage', i);
    const enc20 = ENCOUNTERS[contentOf('cathedral1').fights('보통')[0]];
    expect(Gd.guildPartyFits(s, enc20)).toBe(false);
    add(s, 'archer', 0);
    expect(Gd.guildPartyFits(s, enc20)).toBe(true);
  });
  it('v24 저장도 정원 바닥 보정 (명성 × 2는 v24 전만)', () => {
    const s = save(30);
    for (let i = 0; i < 10; i++) add(s, 'mage', i);
    s.guild.fame = 100;
    const d = migrate({ ...JSON.parse(JSON.stringify(s)), v: 24 });
    expect(d.guild.fame).toBe(GUILD_STEPS[8]); // 10명 → 길드 Lv 9 (정원 10)
    expect(Gd.capOf(d).cap).toBeGreaterThanOrEqual(10);
    expect(migrate({ ...JSON.parse(JSON.stringify(s)), v: 24, guild: { ...s.guild, fame: 9999 } }).guild.fame).toBe(9999);
  });
});
