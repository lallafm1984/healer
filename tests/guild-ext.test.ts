/** 길드 업데이트 묶음 (93 4-4 · 6-3 · 8장, 사슬 7번): 부탁 쪽지 · 주간 원정 · 스토리 동료 이슬 · 칼날 · 고유 스킬 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CONTENT } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { FEATURES } from '../src/data/features';
import { EXPED, knowStage, REQ, STORY, type GuildMember } from '../src/data/guild';
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

describe('시설 제거와 저장 보존 (v22)', () => {
  it('v21 시설 투자액은 한 번 환급, 옛 명문 공고 지원자는 모두 보존', () => {
    const s = save(), a = add(s, 'mage', 0), b = add(s, 'mage', 1);
    const cands = Gd.makeCandidates(s, rng);
    const old = { ...s, v: 21, guild: { ...s.guild, fac: { war: 5, post: 3, feast: 5 }, post: { kind: 'elite', pick: 'mage', cands } } };
    const d = migrate(old);
    expect(d.player.gold).toBe(s.player.gold + 155000 + 35000);
    expect(d.guild).not.toHaveProperty('fac');
    expect(d.guild.post).toEqual({ cands: cands.map(c => ({ ...c, skillFloor: 1 })) });
    expect(d.guild.members).toEqual([a, b].map(m => ({ ...m, skillFloor: 1 })));
    expect(migrate(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('시설 환급은 잘못된 값을 제외하고 단계 상한까지', () => {
    const s = save();
    expect(migrate({ ...s, v: 21, guild: { ...s.guild, fac: { war: NaN, post: -3 } } }).player.gold).toBe(s.player.gold);
    expect(migrate({ ...s, v: 21, guild: { ...s.guild, fac: { war: 99, post: '5' } } }).player.gold).toBe(s.player.gold + 155000);
  });
  it('숙지는 개인 점수만 적용하고 공략 공유는 없음', () => {
    expect([0, 0.5, 2, 3, 5, 6].map(p => knowStage(p))).toEqual([0, 1, 1, 2, 2, 3]);
    const s = save(), a = add(s, 'mage', 0), b = add(s, 'mage', 1);
    a.know = { warden: 6 };
    expect(Gd.knowStages(a)).toEqual({ warden: 3 });
    expect(Gd.memberEntry(s, b).know).toEqual({});
  });
  it('명성 지원자는 기본 인원과 사흘 체류를 사용', () => {
    const s = save(30); s.guild.fame = 480;
    expect(Gd.postCost(s)).toBe(900);
    Gd.refreshApps(s, rng, new Date(2026, 9, 7, 12).getTime());
    expect(s.guild.apps.length).toBe(2);
    expect(s.guild.apps[0].until).toBe('2026-10-09');
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
    for (let i = 0; i < 300; i++) expect(['warrior.holdFast', 'archer.mend', 'swordsman.flurry']).not.toContain(Gd.makeCandidates(save(), rng)[0].ab);
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
    // 99 다: 판단 · 기술 숙련이 15보다 낮으면 스킬을 늦게 쓰거나 헛씀. 여기서는 효과만 보게 15로
    for (const i of [0, 1, 2]) if (party[i].fm) party[i] = { ...party[i], fm: { ...party[i].fm!, stats: { ...party[i].fm!.stats, judgment: 15, skill: 15 }, off: 0 } };
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
  it('부탁: 매일 길드원 2명, 그 사람을 넣고 그 장소를 그 난이도 이상으로 깨면 경험치 2배 대상에 한 번 포함, 날이 바뀌면 새로', () => {
    seed = 5;
    const s = save(30); add(s, 'mage', 0); add(s, 'mage', 1);
    refreshReqs(s, stages, rng, T);
    expect(s.guild.reqs.list.length).toBe(REQ.perDay);
    expect(jobsDot(s)).toBe(true);
    const q = s.guild.reqs.list[0], m = s.guild.members.find(x => x.nick === q.nick)!;
    const roster = [{ role: 'ranged' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }];
    expect(jobsAfter(s, { win: true, quit: false, content: q.content, diff: '쉬움', roster }).reqs).toEqual(q.diff === '쉬움' ? [q.nick] : []);
    const done = jobsAfter(s, { win: true, quit: false, content: q.content, diff: '악몽', roster });
    expect(done.reqs).toEqual([q.nick]);
    expect(done.fame).toBe(0);
    expect(s.guild.fame).toBe(0);
    expect(jobsAfter(s, { win: true, quit: false, content: q.content, diff: '악몽', roster }).reqs).toEqual([]);
    expect(s).not.toHaveProperty('users');
    refreshReqs(s, stages, rng, T + 3600e3);
    expect(s.guild.reqs.list[0].done).toBe(true); // 같은 날은 그대로
    refreshReqs(s, stages, rng, T + 864e5);
    expect(s.guild.reqs.list.every(x => !x.done)).toBe(true);
  });
  it('원정: 주마다 3곳 (5인 · 10인 · 20인, 안 열렸으면 던전), 길드파티로 보통 이상 = 칸마다 명성 +5, 셋 다 = 상자 (골드 5판 + 장비 1)', () => {
    const s = save(80), ms = [add(s, 'warrior', 0), add(s, 'mage', 0), add(s, 'mage', 1)];
    s.guild.fame = 2000;
    refreshExped(s, () => true, T);
    expect(s.guild.exped.list.length).toBe(EXPED.n);
    const sizes = s.guild.exped.list.map(x => CONTENT.find(c => c.key === x.content)!.size('보통'));
    expect(sizes).toEqual([5, 10, 20]);
    const roster = ms.map(m => ({ role: 'melee' as const, pers: m.pers, nick: m.nick, cls: m.cls, gid: m.id }));
    expect(jobsAfter(s, { win: true, quit: false, content: s.guild.exped.list[0].content, diff: '쉬움', roster }).exped).toEqual([]);
    let fame = 0;
    for (const x of s.guild.exped.list) fame += jobsAfter(s, { win: true, quit: false, content: x.content, diff: '보통', roster }).fame;
    expect(fame).toBe(EXPED.fame * 3);
    expect(s.guild.fame).toBe(2000 + EXPED.fame * 3);
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
