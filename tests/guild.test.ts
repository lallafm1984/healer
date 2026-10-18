/**
 * 길드 v2 (93 · FM 97, 사슬 4번): 열림 · 인연 Lv와 스킬 ★ · 길드 Lv · 정원 · 결성 · 영입 셋 (친구 초대 · 공고 · 명성 지원자) · 관리 · 규모별 편성 ·
 * 출전 경험 (레벨 · 능력치) · 명성 · 첫 처치 · 정산 · 저장 v19.
 * 출시판은 길드를 빼 둘 수 있으므로 (features.ts) 맨 위 「빼 둠」 말고는 길드를 켜고 검사한다.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CLASSES, type ClassKey } from '../src/data/classes';
import { ENCOUNTERS } from '../src/data/encounters';
import { FEATURES } from '../src/data/features';
import {
  BOND_JOIN, bondLv, deedOf, FAME, guildLvOf, habitOf, KNOW, knowGain, knowStage, POSTS, postGold, REST_SHARE, rerollGold, SPONSOR, sponsorGold, starOfBond, statCap, statPerLevel, statPot, statTop, statWeights, STORY, type GuildMember,
} from '../src/data/guild';
import { DAILY, GUILD_GOAL } from '../src/data/missions';
import { PARTY_POOL, STORY_NICKS } from '../src/data/nicknames';
import { PERS } from '../src/data/personalities';
import { clearXp, xpToNext } from '../src/data/progression';
import * as E from '../src/engine';
import { takenAmt } from '../src/engine/core';
import { claimGuildGoal, rollover } from '../src/game/economy';
import * as Gd from '../src/game/guild';
import { abilityFeatures, encFeatures, REC, recommendPick, recScore } from '../src/game/recommend';
import { settle, type BattleResult } from '../src/game/settle';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave, SAVE_VERSION, type SaveData } from '../src/platform/storage';

let seed = 1;
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
const bond = (s: SaveData, nick: string, pt: number, saved = 0) => { s.users[nick] = { pt, met: 1, wins: 1, saved, mvp: 0 }; };
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
  it('명성 → 길드 Lv 1~10 · 정원 6 → 25', () => {
    expect([0, 19, 20, 120, 1999, 2000, 99999].map(f => guildLvOf(f))).toEqual([
      { lv: 1, cap: 6, next: 20 }, { lv: 1, cap: 6, next: 20 }, { lv: 2, cap: 7, next: 60 }, { lv: 4, cap: 10, next: 200 },
      { lv: 9, cap: 22, next: 2000 }, { lv: 10, cap: 25, next: null }, { lv: 10, cap: 25, next: null },
    ]);
    const s = save(30);
    for (let i = 0; i < 6; i++) add(s, 'mage', i);
    expect(Gd.full(s)).toBe(true);
    s.guild.fame = 20;
    expect(Gd.full(s)).toBe(false);
  });
});

describe('인연 Lv · 직업 스킬 ★ (93 3-3 · 13-1)', () => {
  it('점수 → 인연 Lv 0 처음 · 1 아는 사이 · 2 친구 · 3~11 길드원 · 12 단짝', () => {
    expect([0, 1, 3, 4, 7, 8, 329, 330, 9999].map(bondLv)).toEqual([0, 1, 1, 2, 2, 3, 11, 12, 12]);
  });
  it('★: 길드원 ★1, 인연 Lv 4 · 6 · 8 · 10에서 ★2 ~ ★5. 공개모집 · 친구는 ★ 없음', () => {
    expect([0, 2, 3, 4, 5, 6, 8, 10, 12].map(starOfBond)).toEqual([0, 0, 1, 2, 2, 3, 4, 5, 5]);
    const s = save(30), m = add(s);
    bond(s, m.nick, 20);
    expect(entry(s, m).star).toBe(2);
    bond(s, m.nick, 110);
    expect(entry(s, m).star).toBe(4);
  });
});

describe('결성 (93 4-1)', () => {
  it('Lv 15: 말없는탱 (고정 능력치) + 인연 점수가 가장 높은 딜러 3명 (같으면 살려 준 횟수), 탱커는 딜러 자리에 안 옴', () => {
    const s = save(15);
    bond(s, nickOf('warrior', 3), 50); // 탱커: 안 옴
    bond(s, nickOf('mage', 1), 9);
    bond(s, nickOf('archer', 2), 7, 1);
    bond(s, nickOf('rogue', 4), 7, 3);
    bond(s, nickOf('swordsman', 5), 2);
    const got = Gd.foundGuild(s)!;
    expect(got).toEqual([STORY.tank.nick, nickOf('mage', 1), nickOf('rogue', 4), nickOf('archer', 2)]);
    const tank = s.guild.members[0];
    expect(tank).toMatchObject({ nick: '말없는탱', cls: 'warrior', story: 'tank', ab: STORY.tank.ab, lv: 15 });
    expect([tank.stats.tough, tank.stats.armor]).toEqual([16, 15]);
    expect(s.guild.members.every(m => Gd.bondPt(s, m.nick) >= BOND_JOIN)).toBe(true);
    expect(s.guild.founded).toBe(true);
    expect(Gd.foundGuild(s)).toBeNull();
    expect(Gd.foundGuild(save(14))).toBeNull();
  });
  it('만난 사람이 없으면 말없는탱만, 스토리 동료는 공고 · 친구에 안 나옴', () => {
    const s = save(20);
    expect(Gd.foundGuild(s)).toEqual(['말없는탱']);
    bond(s, '이슬', 50);
    expect(Gd.friendsOf(s).map(f => f.nick)).not.toContain('이슬');
    for (let i = 0; i < 30; i++) expect(STORY_NICKS).not.toContain(Gd.makeCandidates(s, 'normal', 'any', rng)[0].nick);
  });
});

describe('영입 (93 4-2)', () => {
  beforeEach(() => { seed = 7; });
  it('친구 초대: 인연 Lv 2 이상 · 무료 · 그 사람 지금 레벨, 보냈다 다시 부르면 키운 그대로', () => {
    const s = save(30, 500);
    add(s, 'warrior', 0);
    const a = nickOf('mage', 3), b = nickOf('archer', 3);
    bond(s, a, 4); bond(s, b, 3);
    expect(Gd.friendsOf(s).map(f => f.nick)).toEqual([a]);
    expect(Gd.inviteFriend(s, b)).toBe('친구가 아님');
    expect(Gd.inviteFriend(s, a)).toBe('');
    const m = s.guild.members.find(x => x.nick === a)!;
    expect([s.player.gold, m.lv, Gd.bondPt(s, a)]).toEqual([500, Math.min(30, Gd.worldLevel(s, Gd.personOf(a)!)), BOND_JOIN]); // 길드원 레벨은 내 레벨까지
    m.stats.atk = 19; m.lv = 22;
    expect(Gd.release(s, m.id)).toBe(true);
    expect(Gd.friendsOf(s)[0]).toMatchObject({ nick: a, away: { stats: { atk: 19 }, lv: 22 } });
    expect(Gd.inviteFriend(s, a)).toBe('');
    expect(s.guild.members.find(x => x.nick === a)).toMatchObject({ lv: 22, stats: { atk: 19 } });
    expect(s.guild.away).toEqual([]);
  });
  it('모집 공고: 내 Lv × 30 골드, 고른 역할 3명 (처음 보는 사람 · 내 Lv − 5 이상), 1명 영입하면 나머지는 돌아감', () => {
    const s = save(30, 1000);
    expect(postGold('normal', 30)).toBe(900);
    expect(Gd.postRecruit(s, 'normal', 'tank', rng)).toBe('');
    expect(s.player.gold).toBe(100);
    const cands = s.guild.post!.cands;
    expect(cands.length).toBe(POSTS.normal.cands);
    for (const c of cands) {
      expect(CLASSES[c.cls].role).toBe('tank');
      expect(c.lv).toBeGreaterThanOrEqual(25); expect(c.lv).toBeLessThanOrEqual(30);
      expect(ABILITIES[c.ab].cls).toBe(c.cls);
      expect(s.users[c.nick]).toBeUndefined();
    }
    expect(new Set(cands.map(x => x.nick)).size).toBe(3);
    expect(Gd.postRecruit(s, 'normal', 'any', rng)).toMatch(/골드 부족/);
    const pick = cands[1];
    expect(Gd.hire(s, 1)).toBe('');
    expect([s.guild.members.length, s.guild.members[0].nick, s.guild.post]).toEqual([1, pick.nick, null]);
    expect(Gd.bondOf(s, pick.nick)).toBe(3);
  });
  it('명문 공고: 길드 Lv 4부터, 고른 직업 5명, 희귀 성격 · 희귀 스킬이 더 자주', () => {
    const s = save(40);
    expect(Gd.postRecruit(s, 'elite', 'mage', rng)).toMatch(/길드 Lv 4/);
    s.guild.fame = 120;
    const gold = s.player.gold;
    expect(Gd.postRecruit(s, 'elite', 'mage', rng)).toBe('');
    expect(s.player.gold).toBe(gold - 150 * 40);
    expect(s.guild.post!.cands.map(c => c.cls)).toEqual(Array(5).fill('mage'));
    expect(Gd.postRecruit(s, 'elite', 'tank', rng)).toBe('고를 수 없음');
    const rare = (kind: 'normal' | 'elite') => {
      let n = 0, all = 0;
      for (let i = 0; i < 200; i++) for (const c of Gd.makeCandidates(s, kind, kind === 'elite' ? 'mage' : 'any', rng)) { all++; if ('rare' in PERS[c.pers] || ABILITIES[c.ab].grade !== 'common') n++; }
      return n / all;
    };
    expect(rare('elite')).toBeGreaterThan(rare('normal') * 1.2);
  });
  it('정원이 다 차면 공고 · 영입 · 초대 안 됨', () => {
    const s = save(15);
    for (let i = 0; i < 6; i++) add(s, 'mage', i);
    expect(Gd.postRecruit(s, 'normal', 'any', rng)).toMatch(/정원/);
    bond(s, nickOf('archer', 9), 10);
    expect(Gd.inviteFriend(s, nickOf('archer', 9))).toMatch(/정원/);
  });
  it('명성 지원자: 길드 Lv 2부터 하루 1명 (Lv 6 2명 · Lv 9 3명), 사흘 머묾, 적은 역할부터', () => {
    const T = new Date(2026, 9, 7, 12).getTime();
    const s = save(30);
    add(s, 'warrior', 0); add(s, 'warrior', 1);
    Gd.refreshApps(s, rng, T);
    expect(s.guild.apps).toEqual([]);
    s.guild.fame = 20;
    s.guild.appsDay = '';
    Gd.refreshApps(s, rng, T);
    Gd.refreshApps(s, rng, T + 3600e3);
    expect(s.guild.apps.length).toBe(1);
    expect(CLASSES[s.guild.apps[0].m.cls].role).not.toBe('tank');
    expect(s.guild.apps[0].until).toBe('2026-10-09');
    Gd.refreshApps(s, rng, T + 864e5);
    expect(s.guild.apps.length).toBe(2);
    Gd.refreshApps(s, rng, T + 3 * 864e5);
    expect(s.guild.apps.length).toBe(2); // 첫 사람은 떠나고 새 사람
    s.guild.fame = 480; // 길드 Lv 7: 하루 2명
    Gd.refreshApps(s, rng, T + 4 * 864e5);
    expect(s.guild.apps.length).toBe(3);
    const nick = s.guild.apps[0].m.nick;
    expect(Gd.hireApp(s, 0)).toBe('');
    expect(s.guild.members.some(m => m.nick === nick)).toBe(true);
    expect(s.guild.apps.length).toBe(2);
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
  it('보내기: 편성 (모든 규모)에서 빠지고 친구 목록으로, 인연 그대로. 스토리 동료는 친구 목록에 안 감', () => {
    const s = save(30), m = add(s, 'mage', 2);
    bond(s, m.nick, 60);
    s.guild.picks = { '5': [m.id], '10': [m.id, 99] };
    expect(Gd.release(s, m.id)).toBe(true);
    expect([s.guild.members.length, s.guild.picks]).toEqual([0, { '5': [], '10': [99] }]);
    expect([Gd.bondPt(s, m.nick), s.guild.away.map(x => x.nick)]).toEqual([60, [m.nick]]);
    const t = save(15);
    Gd.foundGuild(t);
    Gd.release(t, t.guild.members[0].id);
    expect(t.guild.away).toEqual([]);
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
    bond(s, t.nick, 55);
    const pub = E.recruitParty('plague', 5, { abilities: true, exclude: Gd.guildNicks(s) });
    expect(pub.some(p => p.nick === t.nick || p.nick === d.nick)).toBe(false);
    const roster = Gd.guildRoster(s, [t.id, d.id], pub, plague);
    expect(roster.length).toBe(9);
    expect(roster.filter(r => r.role === 'tank').length).toBe(2);
    expect(roster[0]).toMatchObject({ gid: t.id, lv: 33, pub: true, star: 3, ab: t.ab, habit: habitOf(t.stats), fm: { stats: t.stats } });
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, party: roster, stageLv: 35 });
    const u = f.party.find(x => x.gid === d.id)!;
    expect(u.ab!.key).toBe('archer.snipe');
    expect(u.did).toEqual({ dodge: 0, move: 0, cut: 0, buster: 0, adds: 0 });
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
  it('레벨 하나에 학습력 1 → 0.07 · 10 → 0.1 · 20 → 0.13점. 끝 = min(상한 12 + Lv ÷ 12, 타고난 값 + 잠재력), 처음부터 높으면 그대로', () => {
    expect([1, 10, 20].map(l => +statPerLevel(l).toFixed(2))).toEqual([0.07, 0.1, 0.13]);
    expect([1, 23, 24, 60, 96, 100].map(statCap)).toEqual([12, 13, 14, 17, 20, 20]);
    expect([1, 10, 20].map(statPot)).toEqual([2, 4, 6]);
    expect([statTop(8, 40, 10), statTop(13, 40, 10), statTop(18, 40, 10), statTop(5, 1, 20)]).toEqual([12, 15, 18, 11]);
  });
  it('오를 칸 무게: 역할 핵심 2 · 나머지 1, 「한 일」 표 +1.5, 끝이면 0', () => {
    const flat = Object.fromEntries(Object.keys(mem().stats).map(k => [k, 10])) as GuildMember['stats'];
    const w = statWeights({ stats: flat, votes: [], lv: 40, learn: 10 }, 'tank', flat);
    expect([w.tough, w.atk]).toEqual([2, 1]);
    const v = statWeights({ stats: flat, votes: [['evade', 'react']], lv: 40, learn: 10 }, 'tank', flat);
    expect(v.evade).toBe(2.5);
    expect(statWeights({ stats: { ...flat, atk: 14 }, votes: [], lv: 40, learn: 10 }, 'tank', flat).atk).toBe(0); // 타고난 10 + 잠재력 4
    expect(statWeights({ stats: { ...flat, atk: 15 }, votes: [], lv: 40, learn: 10 }, 'tank', { ...flat, atk: 13 }).atk).toBe(0); // Lv 40 상한 15
  });
  it('오른 레벨만큼 점수, 1점마다 한 칸 +1, 표는 최근 5장, 오를 칸이 없으면 3점까지 모아 둠', () => {
    seed = 9;
    const m = mem({ sxp: 0, learn: 10 }), sum = () => Object.values(m.stats).reduce((a, b) => a + b, 0), before = sum();
    let ups = 0;
    for (let i = 0; i < 60; i++) ups += Gd.growStats(m, 1, 'dodge', rng).length; // 레벨 60개 × 0.1 = 6점
    expect(ups).toBe(6);
    expect(sum() - before).toBe(6);
    expect(m.votes.length).toBe(5);
    expect(Gd.growStats(m, 0, undefined, rng)).toEqual([]);
    const slow = mem({ sxp: 0, learn: 1 });
    expect([Gd.growStats(slow, 14, undefined, rng).length, slow.sxp]).toEqual([0, 0.98]);
    expect(Gd.growStats(slow, 1, undefined, rng).length).toBe(1);
    const top = mem({ lv: 1, learn: 10 });
    top.stats = Object.fromEntries(Object.entries(Gd.birthStats(top)).map(([k, v]) => [k, statTop(v, 1, 10)])) as GuildMember['stats'];
    expect(Gd.growStats(top, 500, undefined, rng)).toEqual([]);
    expect(top.sxp).toBe(3);
  });
  it('「한 일」 표: 판 크기와 상관없이 가장 두드러진 일 하나, 모자라면 없음', () => {
    const did = { dodge: 0, move: 0, cut: 0, buster: 0, adds: 0 };
    const x = (o: Partial<Parameters<typeof deedOf>[0]>) => deedOf({ did, dealt: 0, top: false, low: 0.9, alive: true, role: 'melee', ...o });
    expect(x({ top: true })).toBe('top');
    expect(x({ role: 'tank', did: { ...did, buster: 4 } })).toBe('buster');
    expect(x({ role: 'melee', did: { ...did, buster: 4 } })).toBeUndefined();
    expect(x({ did: { ...did, dodge: 3 } })).toBe('dodge');
    expect(x({ low: 0.1 })).toBe('calm');
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
  it('길드파티 (자리 절반 이상): 명성 +1 · 첫 처치 +3 (장소 · 난이도마다 한 번), 출전 길드원 레벨 · 능력치 경험, 쉬는 명단 30%', () => {
    seed = 11;
    const s = save(30);
    const a = add(s, 'warrior', 0, { lv: 30 }), b = add(s, 'mage', 0, { lv: 30 }), rest = add(s, 'archer', 0, { lv: 30 });
    const roster = warden(s, [a, b]);
    expect(Gd.isGuildParty(roster)).toBe(true);
    const r = after(s, roster, { party: [{ nick: b.nick, deed: 'top' }] });
    expect([r.fame, r.first, s.guild.fame, s.guild.wins, s.guild.firsts]).toEqual([FAME.win + FAME.first, true, 4, 1, ['rustfort|보통']]);
    expect(r.members.map(x => x.nick)).toEqual([a.nick, b.nick]);
    expect([a.runs, b.runs, rest.runs]).toEqual([1, 1, 0]);
    const full = clearXp(30, '보통', 'A', { raid: 0, win: true });
    expect(r.members[0].xp).toBe(full);
    expect(rest.xp).toBe(Math.round(full * REST_SHARE));
    expect(r.rest).toBe(rest.xp);
    expect(b.votes).toEqual([['atk']]);
    expect(r.members[0].stats.length).toBe(Math.floor(r.members[0].ups.length * statPerLevel(a.learn) + 1e-9)); // 레벨업만큼
    expect(s.weekly.guild.ran).toEqual([a.nick, b.nick]);
    // 두 번째: 첫 처치 없음
    const r2 = after(s, roster);
    expect([r2.fame, r2.first]).toEqual([FAME.win, false]);
    expect(after(s, roster, { raid: 10 }).fame).toBe(FAME.raid10);
    expect(after(s, roster, { raid: 20 }).fame).toBe(FAME.raid20);
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
  it('주간 목표: 명성 +5 · 그 주 출전한 길드원 인연 +2 (보낸 사람은 빼고)', () => {
    const s = save(30);
    const a = add(s, 'warrior', 0), b = add(s, 'mage', 0);
    bond(s, a.nick, 20); bond(s, b.nick, 20);
    s.weekly.guild = { n: GUILD_GOAL.need, got: false, ran: [a.nick, b.nick] };
    Gd.release(s, b.id);
    expect(claimGuildGoal(s)).toBe('');
    expect([s.guild.fame, Gd.bondPt(s, a.nick), Gd.bondPt(s, b.nick)]).toEqual([GUILD_GOAL.fame, 22, 20]);
    expect(claimGuildGoal(s)).toBe('아직 못 채움');
  });
  it('settle: Lv 15 이상 판 뒤 결성 (말없는탱 + 인연 높은 딜러), 길드파티면 정산 · 주간 목표 1, 포기는 정산 없음', () => {
    const s = save(20);
    bond(s, nickOf('mage', 6), 9);
    const x = settle(s, result(), rng, []);
    expect(x.founded).toEqual(['말없는탱', nickOf('mage', 6)]);
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
  it('v18 길드 (자질 · 육성 포인트): 같은 닉네임 사람의 능력치로, 레벨 · 스킬 그대로, 인연 = max(레벨 × 5, 길드원 문턱), 인연 스카우트는 친구로', () => {
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
    expect(m).toMatchObject({ id: 3, nick, cls: 'mage', lv: 25, xp: 10, ab: 'mage.blink', runs: 4, stats: PARTY_POOL.mage[4].fm.stats, sxp: 0, votes: [] });
    expect(m).not.toHaveProperty('apt0');
    expect([d.users[nick].pt, d.users[scout].pt]).toEqual([125, 4]);
    expect(d.guild).toMatchObject({ founded: true, storySeen: true, fame: 30, nextId: 4, picks: { '5': [3] }, away: [], apps: [] });
    expect(d.guild).not.toHaveProperty('scouts');
    // 다시 불러도 그대로
    expect(migrate(JSON.parse(JSON.stringify(d))).guild).toEqual(d.guild);
  });
  it('깨진 값은 기본값, 모자란 능력치 칸은 그 사람 능력치로', () => {
    expect(migrate({ v: 19, guild: { members: 'x', fame: 'y', post: { cands: 1 } } }).guild).toMatchObject({ members: [], fame: 0, post: null, founded: false, name: '해바라기 원정대' });
    const nick = nickOf('rogue', 2);
    const g = migrate({ v: 19, guild: { founded: true, members: [{ id: 2, nick, cls: 'rogue', pers: PARTY_POOL.rogue[2].pers, ab: 'rogue.kick', lv: 9, stats: { atk: 30 } }], nextId: 3 } }).guild;
    expect(g.members[0].stats.atk).toBe(PARTY_POOL.rogue[2].fm.stats.atk);
    expect([g.members.length, g.nextId, g.founded]).toEqual([1, 3, true]);
  });
});

describe('공략 숙지 (93 5-4): 전투마다 함께 이긴 만큼, 학습력이 빠르기', () => {
  it('점수 0.5 · 3 · 6에서 1 · 2 · 3단계, 한 판에 학습력 1 → 0.7 · 10 → 1 · 20 → 1.4', () => {
    expect([0, 0.49, 0.5, 2.99, 3, 6, 50].map(x => knowStage(x))).toEqual([0, 0, 1, 1, 2, 3, 3]);
    expect([1, 10, 20].map(l => +knowGain(l).toFixed(2))).toEqual([0.7, 1, 1.4]);
  });
  it('이긴 판의 전투마다 쌓이고, 보스 (마지막 전투) 단계가 오르면 결과에, 진 판은 안 쌓임', () => {
    const s = save(30), a = add(s, 'warrior', 0, { learn: 10 }), b = add(s, 'mage', 0, { learn: 10 });
    const roster = Gd.guildRoster(s, [a.id, b.id], E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }), ENCOUNTERS.warden);
    const o = { win: true, quit: false, grade: 'A' as const, diff: '보통' as const, stage: 30, raid: 0 as const, content: 'rustfort', kind: 'dungeon', party: [], roster, encs: ['gate', 'warden'] };
    const r1 = Gd.guildAfter(s, rng, o);
    expect(a.know).toEqual({ gate: 1, warden: 1 });
    expect(r1.members[0].know).toEqual({ enc: 'warden', stage: 1 });
    Gd.guildAfter(s, rng, o);
    const r3 = Gd.guildAfter(s, rng, o);
    expect([a.know.warden, r3.members[0].know]).toEqual([3, { enc: 'warden', stage: 2 }]);
    expect(Gd.guildAfter(s, rng, o).members[0].know).toBeUndefined(); // 4번째: 단계 그대로
    Gd.guildAfter(s, rng, { ...o, win: false });
    expect(a.know.warden).toBe(4);
    expect(Gd.memberEntry(s, a).know).toEqual({ gate: 2, warden: 2 });
  });
  it('엔진: 그 전투에서만 반응 시간 × · 회피 + · 받는 피해 ×, 공개모집은 없음', () => {
    const s = save(30), m = add(s, 'warrior', 0);
    m.know = { warden: 6 };
    const e = Gd.memberEntry(s, m);
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, party: [e, ...E.recruitParty('warden', 1, { abilities: true }).slice(1)], stageLv: 30 });
    const g = E.create({ encounter: 'warden', diff: '보통', seed: 1, party: [{ ...e, know: undefined }, ...E.recruitParty('warden', 1, { abilities: true }).slice(1)], stageLv: 30 });
    const u = f.party.find(x => x.gid === m.id)!, v = g.party.find(x => x.gid === m.id)!;
    expect(u.know).toBe(3);
    expect(u.senseReact / v.senseReact).toBeCloseTo(KNOW.react[3]);
    expect(u.senseDodge - v.senseDodge).toBeCloseTo(KNOW.dodge[3]);
    expect(takenAmt(f, u, 100, false, 'fixed') / takenAmt(g, v, 100, false, 'fixed')).toBeCloseTo(KNOW.taken[3]);
    const h = E.create({ encounter: 'scrap', diff: '보통', seed: 1, party: [e, ...E.recruitParty('scrap', 1, { abilities: true }).slice(1)], stageLv: 30 });
    expect(h.party.find(x => x.gid === m.id)!.know).toBeUndefined();
  });
  it('저장: 숙지는 그대로, 이상한 값은 버림', () => {
    const s = save(30), m = add(s, 'warrior', 0);
    m.know = { warden: 3.5, plague: -1, x: Number.NaN };
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.members[0].know).toEqual({ warden: 3.5 });
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
  it('특징에 맞는 스킬 · 숙지가 점수를 올리고 이유 칩, 다루기 어려운 성격은 버릇을 고친 만큼 덜 깎음, 레벨이 모자라면 깎음', () => {
    const s = save(30);
    const flat = (v: number) => Object.fromEntries(Object.keys(add(save(), 'mage').stats).map(k => [k, v])) as GuildMember['stats'];
    const a = add(s, 'paladin', 0, { ab: 'paladin.devotion', pers: '신중파', stats: flat(10), lv: 30 });
    const b = add(s, 'paladin', 1, { ab: 'paladin.cleanse', pers: '신중파', stats: flat(10), lv: 30 });
    const r = recommendPick(s, ENCOUNTERS.warden, ['plague'], 30);
    expect(r.pick[0]).toBe(b.id);
    expect(r.why).toContain('독 · 질병 → 독소 정화');
    a.know = { plague: 6 };
    const r2 = recommendPick(s, ENCOUNTERS.warden, ['plague'], 30);
    expect(r2.pick[0]).toBe(a.id); // 숙지 3단계 (+2.4)가 스킬 맞춤 (+1.2)보다 큼
    expect(r2.why[0]).toBe(`공략 숙지 3단계 · ${a.nick}`);
    const hard = (Object.keys(PERS) as (keyof typeof PERS)[]).find(k => PERS[k].star === 3 && !('tankOnly' in PERS[k]))!;
    const c = add(s, 'mage', 1, { pers: hard, stats: flat(10) }), calm = add(s, 'mage', 2, { pers: hard, ab: c.ab, stats: { ...flat(10), composure: 20, judgment: 20 } });
    expect(recScore(s, calm, ['plague'], 30).score).toBeGreaterThan(recScore(s, c, ['plague'], 30).score + REC.hard3 * 0.7);
    const low = add(s, 'mage', 3, { pers: '신중파', stats: flat(10), lv: 26 }), ok = add(s, 'mage', 4, { pers: '신중파', stats: flat(10), lv: 30, ab: low.ab });
    expect(recScore(s, ok, ['plague'], 30).score - recScore(s, low, ['plague'], 30).score).toBeCloseTo(4 * REC.lvGap);
  });
});

describe('후원 (98, Lim 10-18 「훈련 대신 지원」)', () => {
  it('그 길드원 Lv × 20 골드 = 5판, 20판까지, 내 레벨과 같으면 안 됨', () => {
    const s = save(30, 2000), m = add(s, 'mage', 0, { lv: 20 }), top = add(s, 'mage', 1, { lv: 30 });
    expect(sponsorGold(20)).toBe(400);
    expect(Gd.sponsor(s, m.id)).toBe('');
    expect([m.boost, s.player.gold]).toEqual([SPONSOR.runs, 1600]);
    expect(Gd.sponsorWhy(s, top)).toBe('내 레벨과 같음');
    expect(Gd.sponsor(s, top.id)).toBe('내 레벨과 같음');
    for (let i = 0; i < 3; i++) Gd.sponsor(s, m.id);
    expect(m.boost).toBe(SPONSOR.max);
    expect(Gd.sponsor(s, m.id)).toMatch(/20판까지/);
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
    const lv0 = r.lv, st0 = Object.values(r.stats).reduce((t, v) => t + v, 0);
    for (let i = 0; i < 4; i++) Gd.guildAfter(s, rng, o);
    expect(r.boost).toBe(0);
    expect(r.lv).toBeGreaterThan(lv0);
    expect(Object.values(r.stats).reduce((t, v) => t + v, 0) - st0).toBe(Math.floor((r.lv - lv0) * statPerLevel(r.learn) + 1e-9));
  });
  it('쉬는 길드원 (어느 편성에도 없는 사람) 모두 후원, 저장 v20', () => {
    const s = save(30, 100000), a = add(s, 'warrior', 0, { lv: 25 }), b = add(s, 'mage', 0, { lv: 22 }), c = add(s, 'archer', 0, { lv: 28 });
    s.guild.picks = { '5': [a.id] };
    expect(Gd.restSponsor(s)).toEqual({ ids: [b.id, c.id], gold: sponsorGold(22) + sponsorGold(28) });
    expect(Gd.sponsorRest(s)).toBe('');
    expect([a.boost, b.boost, c.boost]).toEqual([0, 5, 5]);
    expect(SAVE_VERSION).toBe(20);
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.members.map(m => m.boost)).toEqual([0, 5, 5]);
    expect(migrate({ v: 20, guild: { founded: true, members: [{ ...b, boost: 99 }], nextId: 9 } }).guild.members[0].boost).toBe(SPONSOR.max);
  });
});
