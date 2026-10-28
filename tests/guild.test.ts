/**
 * 길드 v2 (93 · FM 97, 사슬 4번): 열림 · 스킬 레벨 · 길드 Lv · 정원 · 결성 · 공고 · 명성 지원자 영입 · 관리 · 규모별 편성 ·
 * 출전 경험 (레벨 · 능력치) · 명성 · 첫 처치 · 정산 · 저장 v19.
 * 출시판은 길드를 빼 둘 수 있으므로 (features.ts) 맨 위 「빼 둠」 말고는 길드를 켜고 검사한다.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../src/data/classes';
import { dayKey } from '../src/game/clock';
import { ENCOUNTERS } from '../src/data/encounters';
import { FEATURES } from '../src/data/features';
import {
  deedOf, FAME, GUILD_MAX, GUILD_NEED, GUILD_STEPS, guildLvOf, habitOf, hireGold, POST, REST_SHARE, SPONSOR, sponsorGold, memberSkillLevel, spendPoints, statPerLevel, statWeights, type GuildMember,
} from '../src/data/guild';
import { abilityStars, birthV25, growWeights, lvAdds, ROLE_CORE, STAT_KEYS, type Stats } from '../src/data/fm';
import { DAILY, GUILD_GOAL } from '../src/data/missions';
import { PARTY_POOL } from '../src/data/nicknames';
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
    expect([x.guild, x.founded]).toEqual([null, false]);
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
  });
});

describe('길드원이 없으면 (2026-10-22 가상 사용자 QA: 결성 뒤 영입을 안 한 사람이 「길드파티로 클리어」를 한 번도 못 채움)', () => {
  const T = new Date(2026, 9, 7, 12).getTime();
  it('결성만 하고 길드원이 0명이면 「길드파티로 클리어」가 안 뽑히고, 뽑혀 있던 것은 다른 임무로', () => {
    for (let i = 0; i < 40; i++) {
      const s = save(30); s.guild.founded = true;
      rollover(s, T + i * 864e5, rng);
      expect(s.daily.missions.some(m => m.key === 'guild2')).toBe(false);
    }
    const s = save(30); s.guild.founded = true;
    rollover(s, T, rng);
    s.daily.missions[4] = { key: 'guild2', n: 1, got: false };
    expect(rollover(s, T, rng).fixed).toBe(1);
    expect(s.daily.missions.map(m => m.key)).not.toContain('guild2');
  });
  it('길드원이 한 명이라도 있으면 뽑힘', () => {
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      const s = save(30); add(s);
      rollover(s, T + i * 864e5, rng);
      seen = s.daily.missions.some(m => m.key === 'guild2');
    }
    expect(seen).toBe(true);
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
  it('Lv 15: 길드원 없이 결성, 영입은 모집 공고로만 (2026-10-21 Lim 「자동 영입 제거」, 예전엔 말없는탱 + 근접 1명)', () => {
    const s = save(15);
    expect(Gd.foundGuild(s)).toBe(true);
    expect([s.guild.founded, s.guild.members, Gd.capOf(s).cap]).toEqual([true, [], 2]);
    expect(Gd.foundGuild(s)).toBe(false);
    expect(Gd.foundGuild(save(14))).toBe(false);
    expect(s.guild.post!.cands.length).toBe(POST.cands); // 결성 직후 그날 공고 3명 (2026-10-22)
    expect(Gd.hire(s, 0)).toBe('');
    expect(s.guild.members.length).toBe(1);
  });
});

describe('영입 (93 4-2, 2026-10-22 Lim 매일 공고 · 광고 새로 뽑기 · Lv 1 ~ 내 레벨 · 레벨 비례 영입 골드)', () => {
  beforeEach(() => { seed = 7; });
  const T = new Date(2026, 9, 22, 12).getTime(), H = 3600e3;
  const founded = (lv: number, gold = 100000) => { const s = save(lv, gold); s.guild.founded = s.guild.storySeen = true; return s; };
  it('공고는 무료, 하루 한 번 (오전 6시) 지원자 3명. 같은 날은 그대로 · 다 데려가도 그날은 새로 안 옴 · 시계를 뒤로 돌린 날도 그대로', () => {
    const s = founded(30, 0); s.guild.fame = GUILD_STEPS[3]; // 정원 5 (셋을 다 데려가려고)
    expect(Gd.refreshPost(s, rng, T)).toBe(true);
    expect(s.player.gold).toBe(0);
    const p = s.guild.post!;
    expect([p.day, p.cands.length, p.seen, new Set(p.cands.map(c => c.nick)).size]).toEqual([dayKey(T), POST.cands, false, 3]);
    expect(Gd.refreshPost(s, rng, T + 5 * H)).toBe(false);
    s.player.gold = 1e6;
    while (s.guild.post!.cands.length) expect(Gd.hire(s, 0)).toBe('');
    expect(Gd.refreshPost(s, rng, T + 6 * H)).toBe(false); // 다음 날 오전 6시 전 (밤 12시 ~ 6시는 아직 그날)
    expect(s.guild.post!.cands).toEqual([]);
    expect(Gd.refreshPost(s, rng, T + 19 * H)).toBe(true); // 다음 날 오전 7시
    expect(s.guild.post!.cands.length).toBe(3);
    const now = JSON.stringify(s.guild.post);
    expect(Gd.refreshPost(s, rng, T)).toBe(false);
    expect(JSON.stringify(s.guild.post)).toBe(now);
    expect(Gd.refreshPost(save(30), rng, T)).toBe(false); // 결성 전
  });
  it('지원자 레벨은 Lv 1 ~ 내 레벨 고르게, 아무나 그 레벨로 (2026-10-26 Lim 「1레벨 기준으로 시작해서 해당 레벨까지」) · 능력치는 그 레벨까지 공개모집 굴림', () => {
    const s = founded(40), lvs: number[] = [];
    for (let i = 0; i < 400; i++) for (const c of Gd.makeCandidates(s, rng)) {
      lvs.push(c.lv);
      expect(ABILITIES[c.ab].cls).toBe(c.cls);
    }
    expect([Math.min(...lvs), Math.max(...lvs)]).toEqual([1, 40]);
    const mean = lvs.reduce((a, b) => a + b, 0) / lvs.length;
    expect(mean).toBeGreaterThan(19); expect(mean).toBeLessThan(22.5);
    for (let lo = 1; lo <= 31; lo += 10) { const share = lvs.filter(l => l >= lo && l < lo + 10).length / lvs.length; expect(share, `Lv ${lo}~${lo + 9}`).toBeGreaterThan(0.18); expect(share).toBeLessThan(0.32); }
    const c = Gd.makeCandidates(s, rng)[0], role = CLASSES[c.cls].role as 'tank' | 'melee' | 'ranged', p = Gd.personOf(c.nick)!;
    const add2 = lvAdds(c.nick, c.pers, role, c.lv, p.fm.stats);
    expect(c.stats).toEqual(Object.fromEntries(STAT_KEYS.map(k => [k, p.fm.stats[k] + add2[k]])));
    expect(Gd.makeCandidates(founded(1), rng).every(x => x.lv === 1)).toBe(true);
    for (const lv of [5, 60, 100]) { const t = founded(lv); for (const x of Gd.makeCandidates(t, rng, 5)) { expect(x.lv).toBeLessThanOrEqual(lv); expect(x.lv).toBeGreaterThanOrEqual(1); } }
    const who = new Set<string>(); // 같은 목표 레벨이라도 여러 사람 (예전엔 빠르기가 맞는 몇 사람만)
    for (let i = 0; i < 200; i++) for (const c of Gd.makeCandidates(founded(80), rng)) who.add(c.nick);
    expect(who.size).toBeGreaterThan(300);
  });
  it('공고에 떠 있는 지원자는 길드원처럼 공개모집에서 빠짐 (Lim 10-22 「맞추고 빼기」), 영입하면 길드원으로 계속 빠짐', () => {
    const s = founded(50); add(s, 'mage', 0);
    Gd.refreshPost(s, rng, T);
    const cands = s.guild.post!.cands.map(c => c.nick), ex = Gd.recruitExclude(s);
    expect([...ex].sort()).toEqual([...new Set([s.guild.members[0].nick, ...cands])].sort());
    for (const c of s.guild.post!.cands) {
      const enc = contentOf('rustfort').fights('보통')[0];
      for (let sd = 1; sd <= 40; sd++) for (const m of E.recruitParty(enc, sd, { abilities: true, myLv: 50, stageLv: c.lv, exclude: ex })) expect(cands, `${m.nick} Lv ${m.lv}`).not.toContain(m.nick);
    }
    Gd.hire(s, 0);
    expect(Gd.recruitExclude(s).has(cands[0])).toBe(true);
  });
  it('영입 골드 = 능력치 (레벨을 곱하지 않음): 능력 점수 6을 넘는 1점마다 1,000골드 · 10골드 단위 · 적어도 100 (2026-10-28 Lim)', () => {
    const flat = (v: number) => Object.fromEntries(STAT_KEYS.map(k => [k, v])) as Stats;
    expect(POST).toMatchObject({ hireFrom: 6, hirePer: 1000, hireMin: 100 });
    expect([1, 6, 9.2, 11.16, 15.68, 20].map(v => hireGold({ cls: 'warrior', stats: flat(v) }))).toEqual([100, 100, 3200, 5160, 9680, 14000]);
    // 역할 핵심 넷 60% · 나머지 여덟 40% (능력 ★과 같은 점수): 같은 합이라도 핵심 칸이 높은 사람이 비쌈
    const core = (role: 'tank' | 'melee', hi: number, lo: number) => Object.fromEntries(STAT_KEYS.map(k => [k, ROLE_CORE[role].includes(k) ? hi : lo])) as Stats;
    expect(hireGold({ cls: 'warrior', stats: core('tank', 14, 8) })).toBe(Math.round((14 * 0.6 + 8 * 0.4 - 6) * 100) * 10);
    expect(hireGold({ cls: 'warrior', stats: core('tank', 14, 8) })).toBeGreaterThan(hireGold({ cls: 'rogue', stats: core('tank', 14, 8) }));
    // 같은 레벨의 지원자는 능력 ★이 높을수록 비쌈, 레벨은 값에 직접 안 들어감
    const s = founded(60, 0);
    const cands = Gd.makeCandidates(s, rng, 40);
    for (const a of cands) for (const b of cands) {
      const role = (m: GuildMember) => CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged';
      if (a.lv === b.lv && abilityStars(a.stats, role(a), a.lv) > abilityStars(b.stats, role(b), b.lv)) expect(hireGold(a), `${a.nick} > ${b.nick}`).toBeGreaterThanOrEqual(hireGold(b));
    }
    const low: GuildMember = { ...cands[0], lv: 1 }, high: GuildMember = { ...cands[0], lv: 100 };
    expect(hireGold(low)).toBe(hireGold(high));
  });
  it('영입 골드가 모자라면 못 함. 영입한 사람만 빠지고 나머지는 저장을 다시 읽어도 남음', () => {
    const s = founded(30, 0); s.guild.fame = GUILD_STEPS[5]; // 길드 Lv 6 · 정원 7 (103)
    Gd.refreshPost(s, rng, T);
    const cands = [...s.guild.post!.cands], cost = hireGold(cands[1]);
    expect(Gd.hire(s, 1)).toBe(`골드 부족 (${cost.toLocaleString()} 필요)`);
    s.player.gold = cost + 5;
    expect(Gd.hire(s, 1)).toBe('');
    expect([s.player.gold, s.guild.members[0].nick, s.guild.post?.cands.map(c => c.nick)]).toEqual([5, cands[1].nick, [cands[0].nick, cands[2].nick]]);
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    restored.player.gold = 1e6;
    expect(restored.guild.post).toMatchObject({ day: dayKey(T), cands: [{ nick: cands[0].nick }, { nick: cands[2].nick }] });
    expect(Gd.hire(restored, 1)).toBe('');
    expect(Gd.hire(restored, 0)).toBe('');
    expect(restored.guild.members.map(m => m.nick)).toEqual([cands[1].nick, cands[2].nick, cands[0].nick]);
    expect(restored.player.gold).toBe(1e6 - hireGold(cands[2]) - hireGold(cands[0]));
    expect(restored.guild.post).toMatchObject({ cands: [] });
    expect(Gd.hire(restored, 0)).toBe('지원자 없음');
  });
  it('광고 보고 새로 뽑기 = 지원자 5명, 실제 시간 1시간에 한 번 (시계를 뒤로 돌리면 바로), 그날 공고는 그대로 하루 한 번', () => {
    const s = founded(50);
    Gd.refreshPost(s, rng, T);
    expect(Gd.postAdWait(s, T)).toBe(0);
    expect(Gd.adRefreshPost(s, rng, T)).toBe('');
    expect([s.guild.post!.cands.length, s.guild.postAdAt, s.guild.post!.day, s.guild.post!.seen]).toEqual([POST.adCands, T, dayKey(T), true]);
    expect(Gd.postAdWait(s, T + 20 * 60e3)).toBe(40 * 60e3);
    expect(Gd.adRefreshPost(s, rng, T + 59 * 60e3)).toBe('아직 쿨타임');
    expect(Gd.adRefreshPost(s, rng, T + H)).toBe('');
    expect(Gd.postAdWait(s, T - 1)).toBe(0);
    expect(Gd.refreshPost(s, rng, T + 2 * H)).toBe(false); // 같은 날: 광고로 뽑은 5명 그대로
    expect(Gd.adRefreshPost(save(50), rng, T)).toBe('길드 결성 전');
  });
  it('빨간 점 (postNew): 새 공고를 아직 안 봤거나 날이 바뀜, 정원이 차면 없음', () => {
    const s = founded(30);
    expect(Gd.postNew(s, T)).toBe(true); // 공고가 아직 없음 = 곧 옴
    Gd.refreshPost(s, rng, T);
    expect(Gd.postNew(s, T)).toBe(true);
    s.guild.post!.seen = true;
    expect(Gd.postNew(s, T)).toBe(false);
    expect(Gd.postNew(s, T + 24 * H)).toBe(true);
    for (let i = 0; i < Gd.capOf(s).cap; i++) add(s, 'mage', i);
    expect(Gd.postNew(s, T + 24 * H)).toBe(false);
  });
  it('하나의 공고에서 모든 직업이 나오고 희귀는 지원자당 약 3% (안쪽 굴림, 화면에는 등급 표시 없음)', () => {
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
    // 지원자마다 굴림 셋: 희귀 여부 · 사람 · 레벨
    const roll = (chance: number) => { let n = 0; return () => n++ % 3 === 0 ? chance : 0.5; };
    expect(Gd.makeCandidates(s, roll(POST.rareChance - 0.00001)).every(Gd.rareCandidate)).toBe(true);
    expect(Gd.makeCandidates(s, roll(POST.rareChance)).some(Gd.rareCandidate)).toBe(false);
    const advanced = Object.values(ABILITIES).find(a => a.grade === 'rare')!;
    expect(Gd.rareCandidate({ pers: '고집불통', ab: advanced.key })).toBe(false);
  });
  it('정원이 다 차면 영입 안 됨 (지원자는 그대로 보임)', () => {
    const s = save(15);
    for (let i = 0; i < 6; i++) add(s, 'mage', i);
    expect(Gd.refreshPost(s, rng, T)).toBe(true);
    expect(Gd.hire(s, 0)).toMatch(/정원/);
    expect(s.guild.post!.cands.length).toBe(3);
  });
  it('영입 도중 정원이 차면 남은 지원자는 유지하고, 자리가 나면 이어서 영입한다', () => {
    const s = save(30); s.guild.fame = GUILD_STEPS[4]; // 길드 Lv 5 · 정원 6 (103)
    for (let i = 0; i < 5; i++) add(s, 'mage', i);
    Gd.refreshPost(s, rng, T);
    const cands = [...s.guild.post!.cands];
    expect(Gd.hire(s, 0)).toBe('');
    expect(Gd.hire(s, 0)).toMatch(/정원/);
    expect(s.guild.post?.cands.map(c => c.nick)).toEqual(cands.slice(1).map(c => c.nick));
    Gd.release(s, s.guild.members[0].id);
    expect(Gd.hire(s, 0)).toBe('');
    expect(s.guild.post?.cands.map(c => c.nick)).toEqual([cands[2].nick]);
  });
  it('v31 저장의 공고 지원자는 그대로 그날 공고로 (다음 날 오전 6시에 새로), 영입 골드는 그 지원자 레벨로', () => {
    const s = founded(60), cands = Gd.makeCandidates(s, rng);
    const old = JSON.parse(JSON.stringify({ ...s, v: 31, guild: { ...s.guild, post: { cands } } }));
    delete old.guild.postAdAt;
    const d = migrate(old);
    expect(d.guild.post).toMatchObject({ day: dayKey(), seen: true, cands: cands.map(c => ({ nick: c.nick, lv: c.lv })) });
    expect(d.guild.postAdAt).toBe(0);
    expect(migrate(JSON.parse(JSON.stringify(d))).guild).toEqual(d.guild);
    const g0 = d.player.gold;
    expect(Gd.hire(d, 0)).toBe('');
    expect(d.player.gold).toBe(g0 - hireGold(cands[0]));
  });
});

describe('관리 (93 4-3 · 5-5)', () => {
  it('내보내기: 모든 규모 편성에서 제외, 재초대 목록 없음', () => {
    const s = save(30), m = add(s, 'mage', 2);
    s.guild.picks = { '5': [m.id], '10': [m.id, 99] };
    expect(Gd.release(s, m.id)).toBe(true);
    expect([s.guild.members.length, s.guild.picks]).toEqual([0, { '5': [], '10': [99] }]);
    const t = save(15);
    Gd.foundGuild(t);
    Gd.release(t, add(t, 'rogue', 0).id);
    expect(t.guild).not.toHaveProperty('away');
  });
});

describe('길드파티 편성 (93 7-2)', () => {
  const plague = ENCOUNTERS.plague, warden = ENCOUNTERS.warden;
  it('처음 편성 = 레벨 순으로 탱커 · 딜러 자리 모양 먼저, 남은 자리는 남은 길드원. 넣고 빼기는 역할 제한 없이 자리 수까지 (2026-10-28 Lim), 규모마다 지난 편성을 따로 기억', () => {
    const s = save(40);
    const t = [add(s, 'warrior', 0, { lv: 30 }), add(s, 'warrior', 1, { lv: 40 }), add(s, 'warrior', 2, { lv: 35 })];
    const d = add(s, 'mage', 0, { lv: 38 });
    const pick = Gd.autoPick(s, plague);
    expect(pick).toEqual([t[1].id, d.id, t[2].id, t[0].id]); // 10인 탱커 자리 2 → 셋째 탱커는 남은 자리로 (빈 칸보다 나음)
    expect(Gd.togglePick(s, warden, [t[1].id], t[2].id)).toEqual({ pick: [t[1].id, t[2].id], msg: '' }); // 5인에 탱커 둘도 됨
    Gd.savePick(s, warden, [t[0].id]);
    expect(Gd.autoPick(s, warden)).toEqual([t[0].id, d.id, t[1].id, t[2].id]);
    expect(Gd.autoPick(s, plague)).toEqual([t[1].id, d.id, t[2].id, t[0].id]);
    expect(Gd.autoPick(s, warden, true)).toEqual([t[1].id, d.id, t[2].id, t[0].id]);
    const e = add(s, 'archer', 0, { lv: 5 });
    expect(Gd.togglePick(s, warden, [t[0].id, t[1].id, t[2].id, d.id], e.id).msg).toBe('자리가 다 참'); // 5인 자리 4
    expect(['3', '5', '10', '20'].map(k => k)).toEqual([Gd.sizeKey(ENCOUNTERS.field), Gd.sizeKey(warden), Gd.sizeKey(plague), Gd.sizeKey(ENCOUNTERS.choir)]);
  });
  it('길드파티 = 고른 길드원만 (빈자리는 빈 칸, 2026-10-28 Lim), 전투에 자기 레벨 · 능력치 · 인연 ★ · 버릇이 넘어감. 공개모집에는 길드원이 안 나옴', () => {
    const s = save(40);
    const t = add(s, 'warrior', 0, { lv: 33 }), d = add(s, 'archer', 0, { lv: 31, ab: 'archer.snipe' });
    t.skillFloor = 3;
    const pub = E.recruitParty('plague', 5, { abilities: true, exclude: Gd.guildNicks(s) });
    expect(pub.some(p => p.nick === t.nick || p.nick === d.nick)).toBe(false);
    const roster = Gd.guildRoster(s, [d.id, t.id]);
    expect(roster.map(r => r.gid)).toEqual([t.id, d.id]); // 탱커 먼저
    expect(Gd.isGuildParty(roster)).toBe(true);
    expect(roster[0]).toMatchObject({ gid: t.id, lv: 33, pub: true, star: 3, ab: t.ab, habit: habitOf(t.stats), fm: { stats: t.stats } });
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, party: roster, stageLv: 35 });
    const u = f.party.find(x => x.gid === d.id)!;
    expect(u.ab!.key).toBe('archer.snipe');
    expect(u.did).toEqual({ dodge: 0, move: 0, cut: 0, buster: 0, adds: 0, help: 0 });
    expect(f.party.map(x => x.role)).toEqual(['tank', 'ranged', 'healer']); // 10인 판에 셋만 (빈 칸으로 출발)
    // 내 길드원 3명 이상이 다른 시드 공개모집에도 안 나옴
    for (let sd = 1; sd <= 30; sd++) for (const p of E.recruitParty('choir', sd, { exclude: Gd.guildNicks(s) })) expect([t.nick, d.nick]).not.toContain(p.nick);
  });
  it('탱커 없는 길드파티 · 빈 칸 길드파티도 전투가 끝까지 돌고, 추천 편성은 역할 자리 모양 뒤 남은 자리를 남은 길드원으로 (2026-10-28)', () => {
    const s = save(40);
    const ms = [add(s, 'mage', 0, { lv: 40 }), add(s, 'archer', 0, { lv: 40 }), add(s, 'rogue', 0, { lv: 40 })];
    const f = E.simulate({ encounter: 'warden', diff: '쉬움', seed: 3, party: Gd.guildRoster(s, ms.map(m => m.id)), stageLv: 30 });
    expect(f.party.some(u => u.role === 'tank')).toBe(false);
    expect(f.over).toBeTruthy(); // 끝남 (이기든 지든)
    const t = [add(s, 'warrior', 0, { lv: 40 }), add(s, 'warrior', 1, { lv: 40 })];
    const pick = recommendPick(s, warden, ['warden'], 30).pick;
    expect(pick.length).toBe(4); // 5인 자리 4 (탱커 1 · 딜러 3 자리가 찬 뒤 남은 자리 없음)
    expect(pick.filter(id => t.some(m => m.id === id)).length).toBe(1);
    s.guild.members = s.guild.members.filter(m => m.cls === 'warrior' || m === ms[0]);
    expect(recommendPick(s, warden, ['warden'], 30).pick.length).toBe(3); // 탱커 둘 + 딜러 하나: 빈 칸보다 둘째 탱커
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
    return Gd.guildRoster(s, ms.map(m => m.id));
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
  it('길드원이 자리 절반 아래인 섞인 파티 (2026-10-28 전 편성)면 명성 · 첫 처치 없음 (경험은 받음), 진 판 · 포기는 아무것도 없음', () => {
    const s = save(30);
    const a = add(s, 'warrior', 0, { lv: 30 });
    const roster = [entry(s, a), ...E.recruitParty('warden', 3, { abilities: true, exclude: Gd.guildNicks(s) }).filter(p => p.role !== 'tank')];
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
  it('settle: Lv 15 이상 판 뒤 결성 (길드원 없이), 길드파티면 정산 · 주간 목표 1, 포기는 정산 없음', () => {
    const s = save(20);
    const x = settle(s, result(), rng, []);
    expect(x.founded).toBe(true);
    expect([x.guild, s.guild.members.length]).toEqual([null, 0]);
    add(s, 'warrior', 0); add(s, 'rogue', 0);
    const ms = s.guild.members;
    const roster = warden(s, ms);
    const party = roster.map(e => ({ nick: e.nick, pers: e.pers, role: e.role, alive: true, got: 10, gid: e.gid }));
    const y = settle(s, result({ party }), rng, roster);
    expect(y.founded).toBe(false);
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
  it('그 길드원 Lv × 20 골드 = 3판 (2026-10-28 Lim, 예전 5판), 지원 중에는 중첩 불가, 모두 쓰면 다시 지원 가능', () => {
    expect(SPONSOR).toMatchObject({ per: 20, runs: 3 });
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
    const roster = Gd.guildRoster(s, [a.id, b.id]);
    const o = { win: true, quit: false, grade: 'A' as const, diff: '보통' as const, stage: 30, raid: 0 as const, content: 'rustfort', kind: 'dungeon', party: [], roster };
    const full = Gd.memberXp(r, o);
    const x = Gd.guildAfter(s, rng, o);
    expect(x.boosted).toEqual([{ nick: r.nick, xp: full, left: 4 }]);
    expect(top.boost).toBe(5); // 내 레벨과 같음: 안 씀
    Gd.guildAfter(s, rng, { ...o, win: false });
    expect(r.boost).toBe(4);
    const withR = Gd.guildRoster(s, [a.id, r.id]);
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
    expect([a.boost, b.boost, c.boost]).toEqual([0, SPONSOR.runs, SPONSOR.runs]);
    expect(SAVE_VERSION).toBe(32);
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.members.map(m => m.boost)).toEqual([0, SPONSOR.runs, SPONSOR.runs]);
    expect(migrate({ v: 20, guild: { founded: true, members: [{ ...b, boost: 99 }], nextId: 9 } }).guild.members[0].boost).toBe(SPONSOR.max);
    expect(migrate(JSON.parse(JSON.stringify({ ...s, guild: { ...s.guild, members: [{ ...b, boost: 5 }] } }))).guild.members[0].boost).toBe(5); // 3판으로 줄이기 전에 산 5판은 그대로 (2026-10-28)
    const gold = s.player.gold;
    expect(Gd.sponsorRest(s)).toBe('후원할 쉬는 길드원 없음');
    expect(s.player.gold).toBe(gold);
    b.boost = 1; c.boost = 0;
    expect(Gd.restSponsor(s)).toEqual({ ids: [c.id], gold: sponsorGold(c.lv) });
    expect(Gd.sponsorRest(s)).toBe('');
    expect([b.boost, c.boost, s.player.gold]).toEqual([1, SPONSOR.runs, gold - sponsorGold(c.lv)]);
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
  it('v25 스토리 동료 (story 표시)는 v30이 버림, 같이 있던 길드원은 v26 바탕으로', () => {
    const s = save(30), r = add(s, 'rogue', 0, { lv: 30 });
    const old = JSON.parse(JSON.stringify(s)); old.v = 25;
    old.guild.members.unshift({ ...JSON.parse(JSON.stringify(r)), id: 99, nick: '말없는탱', cls: 'warrior', pers: '고집불통', ab: 'warrior.holdFast', story: 'tank' });
    const d = migrate(old);
    expect(d.guild.members.map(m => m.nick)).toEqual([r.nick]);
    expect(d.guild.members[0].stats).toEqual(dbl({ ...r, stats: statsV26(r) }).stats);
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
    add(s, 'warrior', 0); add(s, 'rogue', 0); // 결성은 길드원 없이 (2026-10-21)
    const roster = Gd.guildRoster(s, s.guild.members.map(m => m.id));
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
  it('길드원만으로 다 채운 길드파티 인원: 탐험 2 · 5인 4 · 10인 9 · 20인 19명 (2026-10-28 길드원만 출전, 예전 자리 절반)', () => {
    expect([3, 5, 10, 20].map(Gd.guildPartyNeed)).toEqual([2, 4, 9, 19]);
  });
});

describe('낮은 장소 명성 (103 「넷 다」 1)', () => {
  it('그 판 적 레벨이 내 Lv − 10보다 낮으면 길드파티로 이겨도 명성 · 첫 처치 없음 (기록도 안 남김), 레이드는 늘 받음', () => {
    const s = save(30);
    const a = add(s, 'warrior', 0, { lv: 30 }), b = add(s, 'mage', 0, { lv: 30 });
    const roster = Gd.guildRoster(s, [a.id, b.id]);
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
    const roster = Gd.guildRoster(s, [a.id, b.id]);
    const go = (o: Partial<Parameters<typeof Gd.guildAfter>[2]>) => Gd.guildAfter(s, rng, { win: true, quit: false, grade: 'A', diff: '보통', stage: 7, raid: 0, content: 'rustfort', kind: 'dungeon', party: [], roster, ...o });
    expect(go({ myLv: 17 }).low).toBe(false);
    expect(go({ myLv: 18 }).low).toBe(true);
    const c = go({ myLv: 17, chal: true, content: 'crypt' });
    expect([c.first, s.guild.firsts.includes('crypt|보통')]).toEqual([false, false]);
  });
  it('길드원만으로 빈 칸 없이 꾸릴 수 있나는 역할 자리로 셈: 탱커 3 + 딜러 16 = 20인 18자리뿐 (자리 탱커 2 · 딜러 17)', () => {
    const s = save(80);
    for (let i = 0; i < 3; i++) add(s, 'warrior', i);
    for (let i = 0; i < 16; i++) add(s, 'mage', i);
    const enc20 = ENCOUNTERS[contentOf('cathedral1').fights('보통')[0]];
    expect(Gd.slotsOf(enc20)).toEqual({ tank: 2, dps: 17 });
    expect(Gd.guildSeatCount(s, enc20)).toBe(18);
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
