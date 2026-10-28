/** 길드 업데이트 묶음 (93 6-3 · 8장, 사슬 7번): 부탁 쪽지 · 주간 원정 (스토리 동료 · 고유 스킬은 2026-10-21 없앰, v30) */
import { beforeAll, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CONTENT } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { FEATURES } from '../src/data/features';
import { EXPED, GUILD_STEPS, REQ, type GuildMember } from '../src/data/guild';
import { PARTY_POOL } from '../src/data/nicknames';
import { claimExped } from '../src/game/economy';
import * as Gd from '../src/game/guild';
import { expedReady, jobsAfter, jobsDot, refreshExped, refreshReqs } from '../src/game/guildjobs';
import { dayKey } from '../src/game/clock';
import { TUT } from '../src/game/tutorial';
import { doubleV27, migrate, newSave, statsV26, type SaveData } from '../src/platform/storage';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function save(level = 30, gold = 1e6): SaveData {
  const s = newSave(1);
  s.tut = TUT.done; s.player.level = level; s.player.gold = gold; s.settings.devUnlock = false;
  s.guild.founded = s.guild.storySeen = true;
  return s;
}
function add(s: SaveData, cls: 'warrior' | 'mage' | 'archer' = 'mage', i = 0, o: Partial<GuildMember> = {}): GuildMember {
  const m: GuildMember = { ...Gd.newMember(s, Gd.personOf(PARTY_POOL[cls][i].nick)!, s.player.level), ...o, id: s.guild.nextId++ };
  s.guild.members.push(m);
  return m;
}
beforeAll(() => { FEATURES.guild = true; });

describe('시설 제거와 저장 보존 (v22)', () => {
  it('v21 시설 투자액은 한 번 환급, 옛 명문 공고 지원자는 모두 보존', () => {
    const s = save(), a = add(s, 'mage', 0), b = add(s, 'mage', 1);
    const cands = Gd.makeCandidates(s, rng);
    const old = { ...s, v: 21, guild: { ...s.guild, fac: { war: 5, post: 3, feast: 5 }, post: { kind: 'elite', pick: 'mage', cands } } };
    const d = migrate(old);
    expect(d.player.gold).toBe(s.player.gold + 155000 + 35000);
    expect(d.guild).not.toHaveProperty('fac');
    expect(d.guild.post).toEqual({ day: dayKey(), seen: true, cands: cands.map(c => ({ ...c, skillFloor: 1, stats: statsV26(c) })) }); // v26이 능력치를 새 바탕으로, v31이 그날 공고로
    expect(d.guild.members).toEqual([a, b].map(m => { const x = { ...m, skillFloor: 1, stats: statsV26(m) }; doubleV27(x); return x; })); // v27: 지난 레벨 두 배 몫 (모집 후보는 그대로)
    expect(migrate(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('시설 환급은 잘못된 값을 제외하고 단계 상한까지', () => {
    const s = save();
    expect(migrate({ ...s, v: 21, guild: { ...s.guild, fac: { war: NaN, post: -3 } } }).player.gold).toBe(s.player.gold);
    expect(migrate({ ...s, v: 21, guild: { ...s.guild, fac: { war: 99, post: '5' } } }).player.gold).toBe(s.player.gold + 155000);
  });
  it('명성 지원자는 없음 (2026-10-20 Lim 「길드원 모집은 새공고만 있게」): 옛 저장 (v28)의 지원자는 버림', () => {
    const s = save(30); s.guild.fame = GUILD_STEPS[9];
    const m = Gd.newMember(s, Gd.personOf(PARTY_POOL.mage[0].nick)!, 30);
    const d = migrate({ ...JSON.parse(JSON.stringify(s)), v: 28, guild: { ...JSON.parse(JSON.stringify(s.guild)), apps: [{ m, until: '2026-10-09' }], appsDay: '2026-10-07' } });
    expect(['apps' in d.guild, 'appsDay' in d.guild]).toEqual([false, false]);
    expect('refreshApps' in Gd).toBe(false);
  });
});

describe('스토리 동료 · 자동 영입 없음 (2026-10-21 Lim 「길드에서 스토리 동료 제거, 자동 영입 제거」, v30)', () => {
  it('결성 = 길드원 0명, 스토리 동료 합류 길 · 고유 스킬 없음', () => {
    const s = save(20); s.guild.founded = false; s.guild.storySeen = false;
    expect(Gd.foundGuild(s)).toBe(true);
    expect(s.guild).toMatchObject({ founded: true, members: [] });
    expect(Gd.foundGuild(s)).toBe(false);
    expect(['storyArrive', 'inviteStory'].filter(k => k in Gd)).toEqual([]);
    expect(['warrior.holdFast', 'archer.mend', 'swordsman.flurry'].filter(k => k in ABILITIES)).toEqual([]);
    expect(['storyWait', 'storyCard'].filter(k => k in s.guild)).toEqual([]);
  });
  it('v29 저장: story 표시 길드원 (말없는탱 · 이슬)과 storyWait · storyCard는 버리고, 결성 때 들어온 도적 · 지난 편성 · 부탁은 남은 사람만', () => {
    const s = save(40), rogue = Gd.newMember(s, Gd.personOf(PARTY_POOL.rogue[0].nick)!, 40), mage = Gd.newMember(s, Gd.personOf(PARTY_POOL.mage[0].nick)!, 40);
    const tank = { ...Gd.newMember(s, Gd.personOf(PARTY_POOL.warrior[0].nick)!, 40), nick: '말없는탱', pers: '고집불통', ab: 'warrior.holdFast', story: 'tank' };
    const isle = { ...Gd.newMember(s, Gd.personOf(PARTY_POOL.archer[0].nick)!, 40), nick: '이슬', pers: '신중파', ab: 'archer.mend', story: 'isle' };
    const old = JSON.parse(JSON.stringify({ ...s, v: 29, guild: { ...s.guild,
      members: [{ ...tank, id: 1 }, { ...rogue, id: 2 }, { ...isle, id: 3 }, { ...mage, id: 4 }], nextId: 5,
      picks: { '5': [1, 2, 4], '10': [3, 4, 2], '3': [1] }, storyWait: ['blade'], storyCard: 'isle',
      reqs: { day: '2026-10-21', list: [{ nick: '말없는탱', content: 'rustfort', diff: '보통', done: false }, { nick: rogue.nick, content: 'plateau', diff: '쉬움', done: true }] } } }));
    const d = migrate(old);
    expect(d.v).toBeGreaterThanOrEqual(30);
    expect(d.guild.members.map(m => [m.id, m.nick])).toEqual([[2, rogue.nick], [4, mage.nick]]);
    expect(d.guild.members.every(m => !('story' in m))).toBe(true);
    expect(['storyWait', 'storyCard'].filter(k => k in d.guild)).toEqual([]);
    expect(d.guild.picks).toEqual({ '5': [2, 4], '10': [4, 2], '3': [] });
    expect(d.guild.reqs.list.map(q => q.nick)).toEqual([rogue.nick]);
    expect(d.guild.nextId).toBe(5);
    expect(migrate(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('길드원 0 · 1명: 부탁은 그날을 쓰지 않고 첫 영입 뒤 바로, 주간 원정은 던전 칸 (레이드는 길드원으로 자리를 다 채울 때만), 판 뒤 정산도 그대로', () => {
    const T = new Date(2026, 9, 7, 12).getTime(), stages = [{ content: 'rustfort', diff: '보통' as const }];
    const s = save(30);
    refreshReqs(s, stages, rng, T);
    expect(s.guild.reqs).toEqual({ day: '', list: [] });
    expect(jobsDot(s)).toBe(false);
    refreshExped(s, () => true, T);
    expect(s.guild.exped.list.length).toBeGreaterThan(0);
    expect(s.guild.exped.list.every(x => CONTENT.find(c => c.key === x.content)?.kind === 'dungeon')).toBe(true);
    expect(jobsAfter(s, { win: true, quit: false, content: s.guild.exped.list[0].content, diff: '보통', roster: [] }, T)).toEqual({ reqs: [], exped: [], expedAll: false, fame: 0 });
    add(s, 'mage', 0);
    refreshReqs(s, stages, rng, T + 3600e3);
    expect(s.guild.reqs.list.map(q => q.nick)).toEqual([s.guild.members[0].nick]);
  });
});

describe('부탁 쪽지 · 주간 원정 (93 8장)', () => {
  const T = new Date(2026, 9, 7, 12).getTime();
  const stages = [{ content: 'rustfort', diff: '어려움' as const }, { content: 'plateau', diff: '보통' as const }];
  it('부탁: 매일 길드원 2명, 그 사람을 넣고 그 장소를 그 난이도 이상으로 깨면 경험치 2배 대상에 한 번 포함, 날이 바뀌면 새로', () => {
    seed = 5;
    const s = save(30); add(s, 'mage', 0); add(s, 'mage', 1);
    refreshReqs(s, stages, rng, T);
    expect(s.guild.reqs.list.length).toBe(REQ.perDay);
    expect(jobsDot(s)).toBe(true);
    const q = s.guild.reqs.list[0], m = s.guild.members.find(x => x.nick === q.nick)!;
    const roster = [{ role: 'ranged' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }];
    expect(jobsAfter(s, { win: true, quit: false, content: q.content, diff: '쉬움', roster }, T).reqs).toEqual(q.diff === '쉬움' ? [q.nick] : []);
    const done = jobsAfter(s, { win: true, quit: false, content: q.content, diff: '악몽', roster }, T);
    expect(done.reqs).toEqual([q.nick]);
    expect(done.fame).toBe(0);
    expect(s.guild.fame).toBe(0);
    expect(jobsAfter(s, { win: true, quit: false, content: q.content, diff: '악몽', roster }, T).reqs).toEqual([]);
    expect(s).not.toHaveProperty('users');
    refreshReqs(s, stages, rng, T + 3600e3);
    expect(s.guild.reqs.list[0].done).toBe(true); // 같은 날은 그대로
    refreshReqs(s, stages, rng, T + 864e5);
    expect(s.guild.reqs.list.every(x => !x.done)).toBe(true);
  });
  it('원정: 주마다 3곳 (5인 · 10인 · 20인, 안 열렸거나 길드파티 인원이 모자라면 던전), 길드파티로 보통 이상 = 칸마다 명성 +10, 셋 다 = 상자 (골드 5판 + 장비 1)', () => {
    const few = save(80); [add(few, 'warrior', 0), add(few, 'mage', 0), add(few, 'mage', 1)];
    refreshExped(few, () => true, T);
    expect(few.guild.exped.list.map(x => CONTENT.find(c => c.key === x.content)!.size('보통'))).toEqual([5, 5, 5]); // 길드원 3명: 10인 (9자리) · 20인 (19자리)을 길드원만으로 못 채움 (103, 2026-10-28 길드파티는 길드원만)
    const s = save(80), ms = [add(s, 'warrior', 0), add(s, 'mage', 0), add(s, 'mage', 1)];
    add(s, 'warrior', 1);
    for (let i = 2; i < 17; i++) add(s, 'archer', i); // 19명 (탱커 2 · 딜러 17) = 20인 자리를 다 채움
    s.guild.fame = 2000;
    refreshExped(s, () => true, T);
    expect(s.guild.exped.list.length).toBe(EXPED.n);
    const sizes = s.guild.exped.list.map(x => CONTENT.find(c => c.key === x.content)!.size('보통'));
    expect(sizes).toEqual([5, 10, 20]);
    const roster = ms.map(m => ({ role: 'melee' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }));
    expect(jobsAfter(s, { win: true, quit: false, content: s.guild.exped.list[0].content, diff: '쉬움', roster }, T).exped).toEqual([]);
    let fame = 0;
    for (const x of s.guild.exped.list) fame += jobsAfter(s, { win: true, quit: false, content: x.content, diff: '보통', roster }, T).fame;
    expect(fame).toBe(EXPED.fame * 3);
    expect(s.guild.fame).toBe(2000 + EXPED.fame * 3);
    expect(expedReady(s)).toBe(true);
    const gold = s.player.gold, bag = s.gear.bag.length;
    const g = claimExped(s, rng);
    expect(typeof g).not.toBe('string');
    expect([s.player.gold > gold, s.gear.bag.length]).toEqual([true, bag + 1]);
    expect(claimExped(s, rng)).toBe('이번 주는 받음');
    const lowS = save(20); add(lowS);
    refreshExped(lowS, (c, d) => c.kind !== 'raid' && d === '보통', T);
    expect(lowS.guild.exped.list.every(x => CONTENT.find(c => c.key === x.content)!.kind !== 'raid')).toBe(true);
    void ENCOUNTERS;
  });
});

describe('주간 원정 주 중 다시 뽑기 (105 QA)', () => {
  it('주 중에 길드원이 줄어 길드파티를 못 꾸리는 안 깬 레이드 칸만 던전으로', () => {
    const T = new Date(2026, 9, 7, 12).getTime(), s = save(80);
    add(s, 'warrior', 0); add(s, 'warrior', 1);
    for (let i = 0; i < 17; i++) add(s, i % 2 ? 'archer' : 'mage', i);
    refreshExped(s, () => true, T);
    const size = () => s.guild.exped.list.map(x => CONTENT.find(c => c.key === x.content)!.size('보통'));
    expect(size()).toEqual([5, 10, 20]);
    s.guild.exped.list[1].done = true; // 10인은 이미 깸
    s.guild.members.splice(2, 3); // 16명: 10인 (9자리) 은 되고 20인 (19자리) 은 안 됨
    refreshExped(s, () => true, T + 3600e3);
    expect(size()).toEqual([5, 10, 5]);
    expect(s.guild.exped.list[1].done).toBe(true);
    expect(new Set(s.guild.exped.list.map(x => x.content)).size).toBe(3);
  });
});

describe('105 QA 2바퀴', () => {
  it('지난 주 원정 · 지난 날 부탁은 정산에서 건너뜀, 다 끝냈는데 못 받은 원정 상자는 주가 바뀌어도 받게 둠', () => {
    const T = new Date(2026, 9, 7, 12).getTime(), s = save(30), a = add(s, 'warrior', 0), b = add(s, 'mage', 0);
    refreshExped(s, () => true, T);
    const roster = [a, b].map(m => ({ role: 'melee' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }));
    const next = T + 7 * 864e5;
    expect(jobsAfter(s, { win: true, quit: false, content: s.guild.exped.list[0].content, diff: '보통', roster }, next).exped).toEqual([]); // 지난주 목록
    s.guild.exped.list.forEach(x => { x.done = true; });
    refreshExped(s, () => true, next);
    expect(expedReady(s)).toBe(true); // 못 받은 상자는 그대로
    s.guild.exped.got = true;
    refreshExped(s, () => true, next);
    expect(s.guild.exped.list.every(x => !x.done)).toBe(true); // 받은 뒤 새 주
  });
  it('내보낸 길드원의 부탁은 지움', () => {
    const s = save(30), a = add(s, 'warrior', 0), b = add(s, 'mage', 0);
    s.guild.reqs = { day: '2026-10-07', list: [{ nick: a.nick, content: 'rustfort', diff: '보통', done: false }, { nick: b.nick, content: 'rustfort', diff: '보통', done: false }] };
    Gd.release(s, a.id);
    expect(s.guild.reqs.list.map(q => q.nick)).toEqual([b.nick]);
  });
  it('결과창 길드원 경험치 = 실제로 오른 값 (내 레벨 상한이면 0)', () => {
    expect(Gd.gainedXp(5, 10, 5, 40)).toBe(30);
    const s = save(30), m = add(s, 'warrior', 0, { lv: 30, xp: 0 });
    const roster = [Gd.memberEntry(s, m), Gd.memberEntry(s, add(s, 'mage', 0, { lv: 30 }))];
    const r = Gd.guildAfter(s, () => 0.5, { win: true, quit: false, grade: 'A', diff: '보통', stage: 30, raid: 0, content: 'rustfort', kind: 'dungeon', party: [], roster });
    const before = r.members[0].xp;
    expect(before).toBe(m.xp); // 0에서 시작, 상한 (내 Lv 30)에서 모아 두기만
  });
});
