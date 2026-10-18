/** 길드 업데이트 묶음 (93 4-4 · 6-3 · 8장, 사슬 7번): 시설 셋 · 부탁 쪽지 · 주간 원정 · 스토리 동료 이슬 · 칼날 · 고유 스킬 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CONTENT } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { FEATURES } from '../src/data/features';
import { EXPED, FAC_GOLD, knowStage, POSTS, REQ, STORY, type GuildMember } from '../src/data/guild';
import { PARTY_POOL } from '../src/data/nicknames';
import * as E from '../src/engine';
import { claimExped } from '../src/game/economy';
import * as Gd from '../src/game/guild';
import { expedReady, jobsAfter, jobsDot, refreshExped, refreshReqs } from '../src/game/guildjobs';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave, type SaveData } from '../src/platform/storage';

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

describe('시설 (93 6-3)', () => {
  it('골드 5,000 · 10,000 · 20,000 · 40,000 · 80,000, 길드 Lv 4 · 6 · 7에 열림, 5단계까지', () => {
    const s = save();
    expect(Gd.buildFac(s, 'feast')).toMatch(/길드 Lv 4/);
    s.guild.fame = 120;
    let gold = s.player.gold;
    for (let i = 0; i < 5; i++) { expect(Gd.buildFac(s, 'feast')).toBe(''); gold -= FAC_GOLD[i]; }
    expect([Gd.facLv(s, 'feast'), s.player.gold]).toEqual([5, gold]);
    expect(Gd.buildFac(s, 'feast')).toBe('최고 단계');
    expect(Gd.buildFac(s, 'war')).toMatch(/길드 Lv 6/);
    expect(migrate(JSON.parse(JSON.stringify(s))).guild.fac).toEqual({ feast: 5, war: 0, post: 0 });
  });
  it('연회장: 길드파티 승리 인연 +10% × 단계 (소수는 쌓임)', () => {
    const s = save(), m = add(s);
    s.guild.fac.feast = 3;
    s.users[m.nick] = { pt: 10, met: 1, wins: 1, saved: 0, mvp: 0 };
    const gains = [{ nick: m.nick, pt: 3 }];
    Gd.feastBonus(s, gains);
    expect([s.users[m.nick].pt, gains[0].pt]).toEqual([10.9, 3.9]);
    expect(migrate(JSON.parse(JSON.stringify(s))).users[m.nick].pt).toBe(10.9);
  });
  it('작전실: 숙지 문턱이 줄고, 5단계는 3단계 길드원이 있는 전투를 모두 1단계부터 (공략 공유)', () => {
    expect([0, 1, 2, 3, 4].map(w => knowStage(3, w))).toEqual([2, 2, 2, 2, 3]);
    expect([0, 1, 2, 3, 4].map(w => knowStage(2, w))).toEqual([1, 1, 2, 2, 2]);
    expect(knowStage(5, 1)).toBe(3);
    const s = save(), a = add(s, 'mage', 0), b = add(s, 'mage', 1);
    a.know = { warden: 6 };
    expect(Gd.knowStages(b, s)).toEqual({});
    s.guild.fac.war = 5;
    expect(Gd.knowStages(b, s)).toEqual({ warden: 1 });
    expect(Gd.memberEntry(s, b).know).toEqual({ warden: 1 });
  });
  it('모집소: 공고 지원자 +1 · 머무는 날 +2 · 공고 골드 −20% · 명성 지원자 +1 · 명문 지원자 +2', () => {
    const s = save(30);
    expect(Gd.postCands(s, 'normal')).toBe(POSTS.normal.cands);
    s.guild.fac.post = 5;
    expect([Gd.postCands(s, 'normal'), Gd.postCands(s, 'elite'), Gd.postCost(s, 'normal')]).toEqual([POSTS.normal.cands + 1, POSTS.elite.cands + 2, Math.round(30 * 30 * 0.8)]);
    s.guild.fame = 480; // 길드 Lv 7: 하루 2 + 1명
    Gd.refreshApps(s, rng, new Date(2026, 9, 7, 12).getTime());
    expect(s.guild.apps.length).toBe(3);
    expect(s.guild.apps[0].until).toBe('2026-10-11'); // 사흘 + 이틀
  });
});

describe('스토리 동료 이슬 · 칼날 (93 4-4)', () => {
  it('첫 10인 레이드 = 이슬, 정원이 차면 친구 초대에서 기다림 · 한 번만 · 합류 카드', () => {
    const s = save(50);
    expect(Gd.storyArrive(s, 'isle')).toBe('joined');
    const isle = s.guild.members.find(m => m.story === 'isle')!;
    expect(isle).toMatchObject({ nick: '이슬', cls: 'archer', ab: STORY.isle.ab, lv: 50 });
    expect(s.guild.storyCard).toBe('isle');
    expect(Gd.storyArrive(s, 'isle')).toBeNull();
    for (let i = 0; i < 5; i++) add(s, 'mage', i);
    expect(Gd.storyArrive(s, 'blade')).toBe('wait');
    expect(s.guild.storyWait).toEqual(['blade']);
    expect(Gd.inviteStory(s, 'blade')).toMatch(/정원/);
    s.guild.fame = 20;
    expect(Gd.inviteStory(s, 'blade')).toBe('');
    expect(s.guild.members.some(m => m.nick === '칼날' && m.ab === 'swordsman.flurry')).toBe(true);
    expect(Gd.rerollAbility(s, isle.id, rng)).toMatch(/고유/);
  });
  it('고유 스킬은 뽑기 목록에 없음, 옛 말없는탱은 「끝까지 곁에」로', () => {
    for (let i = 0; i < 300; i++) expect(['warrior.holdFast', 'archer.mend', 'swordsman.flurry']).not.toContain(Gd.makeCandidates(save(), 'normal', 'any', rng)[0].ab);
    const s = save(20);
    Gd.foundGuild({ ...s, guild: { ...s.guild, founded: false } } as SaveData);
    const old = { ...newSave(1), v: 20, guild: { ...newSave(1).guild, founded: true, members: [{ id: 1, nick: '말없는탱', cls: 'warrior', pers: '고집불통', ab: 'warrior.intervene', lv: 20, story: 'tank' }], nextId: 2 } };
    expect(migrate(old).guild.members[0].ab).toBe('warrior.holdFast');
  });
  it('엔진: 끝까지 곁에 = 힐러 지정 피해를 대신, 응급 처치 = 탱커 아닌 아군 25% 아래 15%, 일섬 연격 = 딜 +40% 뒤 옆 아군 딜 +10%', () => {
    const party = E.recruitParty('warden', 3, { abilities: true });
    party[0] = { ...party[0], cls: 'warrior', ab: 'warrior.holdFast' };
    party[1] = { ...party[1], cls: 'archer', ab: 'archer.mend', role: 'ranged' };
    party[2] = { ...party[2], cls: 'swordsman', ab: 'swordsman.flurry', role: 'melee' };
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 3, party });
    expect(f.party.filter(u => u.ab).map(u => u.ab!.key)).toEqual(expect.arrayContaining(['archer.mend', 'swordsman.flurry', 'warrior.holdFast']));
    expect(ABILITIES['archer.mend'].fx).toEqual({ e: 'healAlly', v: 0.15 });
    // 일섬 연격: 전투 시작에 딜 +40%
    for (let i = 0; i < 40; i++) E.step(f);
    const sw = f.party.find(u => u.ab?.key === 'swordsman.flurry')!;
    expect(sw.mods.some(m => m.k === 'dps' && Math.abs(m.v - 0.4) < 1e-9)).toBe(true);
    // 응급 처치: 탱커 아닌 아군이 25% 아래
    const v = f.party.find(u => u.role !== 'tank' && !u.me && u.ab?.key !== 'archer.mend')!;
    v.hp = v.max * 0.2;
    const before = v.hp;
    for (let i = 0; i < 20; i++) E.step(f);
    expect(v.hp - before).toBeGreaterThan(v.max * 0.1);
  });
});

describe('부탁 쪽지 · 주간 원정 (93 8장)', () => {
  const T = new Date(2026, 9, 7, 12).getTime();
  const stages = [{ content: 'rustfort', diff: '어려움' as const }, { content: 'plateau', diff: '보통' as const }];
  it('부탁: 매일 길드원 2명, 그 사람을 넣고 그 장소를 그 난이도 이상으로 깨면 인연 +3 · 명성 +2, 날이 바뀌면 새로', () => {
    seed = 5;
    const s = save(30), a = add(s, 'mage', 0), b = add(s, 'mage', 1);
    s.users[a.nick] = { pt: 10, met: 1, wins: 1, saved: 0, mvp: 0 }; s.users[b.nick] = { pt: 10, met: 1, wins: 1, saved: 0, mvp: 0 };
    refreshReqs(s, stages, rng, T);
    expect(s.guild.reqs.list.length).toBe(REQ.perDay);
    expect(jobsDot(s)).toBe(true);
    const q = s.guild.reqs.list[0], m = s.guild.members.find(x => x.nick === q.nick)!;
    const roster = [{ role: 'ranged' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }];
    expect(jobsAfter(s, { win: true, quit: false, content: q.content, diff: '쉬움', roster }).reqs).toEqual(q.diff === '쉬움' ? [q.nick] : []);
    const done = jobsAfter(s, { win: true, quit: false, content: q.content, diff: '악몽', roster });
    expect(done.reqs).toEqual([q.nick]);
    expect([s.users[q.nick].pt, s.guild.fame]).toEqual([10 + REQ.bond, REQ.fame]);
    refreshReqs(s, stages, rng, T + 3600e3);
    expect(s.guild.reqs.list[0].done).toBe(true); // 같은 날은 그대로
    refreshReqs(s, stages, rng, T + 864e5);
    expect(s.guild.reqs.list.every(x => !x.done)).toBe(true);
  });
  it('원정: 주마다 3곳 (5인 · 10인 · 20인, 안 열렸으면 던전), 길드파티로 보통 이상 = 칸마다 명성 +5, 셋 다 = 상자 (골드 5판 + 장비 1)', () => {
    const s = save(80), ms = [add(s, 'warrior', 0), add(s, 'mage', 0), add(s, 'mage', 1)];
    refreshExped(s, () => true, T);
    expect(s.guild.exped.list.length).toBe(EXPED.n);
    const sizes = s.guild.exped.list.map(x => CONTENT.find(c => c.key === x.content)!.size('보통'));
    expect(sizes).toEqual([5, 10, 20]);
    const roster = ms.map(m => ({ role: 'melee' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }));
    expect(jobsAfter(s, { win: true, quit: false, content: s.guild.exped.list[0].content, diff: '쉬움', roster }).exped).toEqual([]);
    let fame = 0;
    for (const x of s.guild.exped.list) fame += jobsAfter(s, { win: true, quit: false, content: x.content, diff: '보통', roster }).fame;
    expect(fame).toBe(EXPED.fame * 3);
    expect(expedReady(s)).toBe(true);
    const gold = s.player.gold, bag = s.gear.bag.length;
    const g = claimExped(s, rng, T);
    expect(typeof g).not.toBe('string');
    expect([s.player.gold > gold, s.gear.bag.length]).toEqual([true, bag + 1]);
    expect(claimExped(s, rng, T)).toBe('이번 주는 받음');
    const lowS = save(20); add(lowS);
    refreshExped(lowS, (c, d) => c.kind !== 'raid' && d === '보통', T);
    expect(lowS.guild.exped.list.every(x => CONTENT.find(c => c.key === x.content)!.kind !== 'raid')).toBe(true);
    void ENCOUNTERS;
  });
});
